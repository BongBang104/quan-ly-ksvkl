"""
roster_review.py
================
Rà soát bản phân ca chi tiết TRƯỚC KHI kíp trưởng publish.

Luồng nghiệp vụ: kíp trưởng phân ca -> dán bảng phân chia ca chi tiết -> [RÀ SOÁT] -> publish.
Module này đóng vai trò bước RÀ SOÁT: nhận bản phân ca nháp, chạy toàn bộ kiểm tra
tuân thủ, và ngoài cảnh báo còn ĐỀ XUẤT phương án xử lý — đặc biệt là hoán đổi nhân sự
giữa các vị trí trong cùng một khung giờ khi có người bị phân vị trí không đủ năng định.

LƯU Ý AN TOÀN: đây là CÔNG CỤ HỖ TRỢ. Mọi đề xuất chỉ mang tính tham khảo;
kíp trưởng là người quyết định và chịu trách nhiệm cuối cùng trước khi publish.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.compliance.rest_compliance import (
    Shift, PositionSession, Position, Qualification,
    RestRuleConfig, ComplianceChecker, Violation, Severity,
)


@dataclass
class Suggestion:
    """Một đề xuất xử lý cho kíp trưởng."""
    kind: str                 # 'swap' | 'reassign' | 'no_candidate'
    severity: Severity
    message: str
    shift_ids: list[int] = field(default_factory=list)

    def __str__(self) -> str:
        ids = ", ".join(map(str, self.shift_ids))
        return f"[{self.kind}] {self.message} (ca: {ids})"


@dataclass
class ReviewResult:
    """Kết quả rà soát trước khi publish."""
    can_publish: bool                       # False nếu còn vi phạm nghiêm trọng
    violations: list[Violation]
    suggestions: list[Suggestion]

    def summary(self) -> str:
        head = ("✓ ĐỦ ĐIỀU KIỆN PUBLISH (không còn vi phạm nghiêm trọng)."
                if self.can_publish else
                "✗ CHƯA NÊN PUBLISH — còn vi phạm nghiêm trọng cần xử lý.")
        lines = [head, ""]
        if self.violations:
            lines.append(f"Vi phạm ({len(self.violations)}):")
            order = {Severity.CRITICAL: 0, Severity.WARNING: 1, Severity.INFO: 2}
            for v in sorted(self.violations, key=lambda x: order[x.severity]):
                lines.append(f"  - {v}")
        if self.suggestions:
            lines.append("")
            lines.append(f"Đề xuất ({len(self.suggestions)}):")
            for s in self.suggestions:
                lines.append(f"  → {s}")
        return "\n".join(lines)


def _overlaps(a: PositionSession, b: PositionSession) -> bool:
    """Hai phiên có giao nhau về thời gian không (cùng khung giờ trực)?"""
    return a.start < b.end and b.start < a.end


@dataclass
class _Slot:
    """Một phiên vị trí gắn với ca và KSVKL đảm nhận — dùng nội bộ để dò hoán đổi."""
    shift: Shift
    session: PositionSession


class RosterReviewer:
    """Rà soát phân ca + sinh đề xuất."""

    def __init__(self, config: RestRuleConfig):
        self.config = config
        self.checker = ComplianceChecker(config)

    def review(self, shifts: list[Shift],
               qualifications: dict[int, Qualification]) -> ReviewResult:
        violations = self.checker.check_all(shifts, qualifications)
        suggestions = self._suggest_for_coverage(shifts, qualifications)
        can_publish = not any(v.severity == Severity.CRITICAL for v in violations)
        return ReviewResult(can_publish, violations, suggestions)

    # ----------------- Đề xuất hoán đổi cho lỗ hổng năng định -----------------

    def _suggest_for_coverage(self, shifts: list[Shift],
                              qualifications: dict[int, Qualification]) -> list[Suggestion]:
        """Với mỗi phiên mà KSVKL không đủ năng định, tìm phương án trong CÙNG khung giờ:
        1. Hoán đổi sạch: tìm người khác (phiên giao thời gian) đủ năng định cho vị trí lỗi,
           đồng thời người đang lỗi đủ năng định cho vị trí của người kia -> đổi chỗ hai bên.
        2. Nếu không có hoán đổi sạch: tìm bất kỳ ai (giao thời gian) đủ năng định cho vị trí
           lỗi -> đề xuất chuyển vị trí đó cho họ (cần bố trí lại chỗ trống của họ).
        3. Nếu không có ai phù hợp trong khung giờ -> báo cần bổ sung nhân sự."""
        out: list[Suggestion] = []
        suggested_swaps: set[frozenset] = set()   # khử trùng lặp hoán đổi đối xứng

        slots: list[_Slot] = [
            _Slot(s, sess) for s in shifts for sess in s.sessions
        ]

        for bad in slots:
            cid = bad.shift.controller_id
            qual = qualifications.get(cid)
            if qual is None or qual.can_work(bad.session.position):
                continue  # không phải lỗ hổng năng định

            gap_pos = bad.session.position
            bad_name = bad.shift.controller_name

            candidates = [
                c for c in slots
                if c.shift.controller_id != cid and _overlaps(bad.session, c.session)
            ]

            # 1. Hoán đổi sạch
            swap = None
            for c in candidates:
                cq = qualifications.get(c.shift.controller_id)
                if cq is None:
                    continue
                if cq.can_work(gap_pos) and qual.can_work(c.session.position):
                    swap = c
                    break
            if swap is not None:
                pair = frozenset({bad.shift.shift_id, swap.shift.shift_id})
                if pair in suggested_swaps:
                    continue
                suggested_swaps.add(pair)
                out.append(Suggestion(
                    kind="swap", severity=Severity.CRITICAL,
                    message=(f"{bad_name} không đủ năng định cho {gap_pos.value}. "
                             f"Đề xuất HOÁN ĐỔI với {swap.shift.controller_name}: "
                             f"{bad_name} ⇄ {swap.session.position.value}, "
                             f"{swap.shift.controller_name} ⇄ {gap_pos.value} "
                             f"(cả hai đều đủ năng định sau khi đổi)."),
                    shift_ids=[bad.shift.shift_id, swap.shift.shift_id]))
                continue

            # 2. Chuyển một chiều cho người đủ năng định
            reassign = None
            for c in candidates:
                cq = qualifications.get(c.shift.controller_id)
                if cq is not None and cq.can_work(gap_pos):
                    reassign = c
                    break
            if reassign is not None:
                out.append(Suggestion(
                    kind="reassign", severity=Severity.CRITICAL,
                    message=(f"{bad_name} không đủ năng định cho {gap_pos.value}. "
                             f"Đề xuất chuyển vị trí {gap_pos.value} cho "
                             f"{reassign.shift.controller_name} (đủ năng định), "
                             f"và bố trí lại vị trí {reassign.session.position.value} "
                             f"cho người phù hợp."),
                    shift_ids=[bad.shift.shift_id, reassign.shift.shift_id]))
                continue

            # 3. Không có ai trong khung giờ
            out.append(Suggestion(
                kind="no_candidate", severity=Severity.CRITICAL,
                message=(f"{bad_name} không đủ năng định cho {gap_pos.value} và KHÔNG có "
                         f"KSVKL nào đủ năng định cho {gap_pos.value} trong cùng khung giờ. "
                         f"Cần bổ sung nhân sự có năng định {gap_pos.value}."),
                shift_ids=[bad.shift.shift_id]))

        return out
