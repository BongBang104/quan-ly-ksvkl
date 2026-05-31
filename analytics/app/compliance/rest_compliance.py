"""
rest_compliance.py
==================
Module kiểm tra tuân thủ quy định cho Kiểm Soát Viên Không Lưu (KSVKL).

MÔ HÌNH CA TRỰC & VỊ TRÍ:
    - Mỗi ca trực (Shift) có thời gian bắt đầu/kết thúc tổng thể.
    - Trong một ca, KSVKL CÓ THỂ LUÂN PHIÊN nhiều vị trí -> ca chứa danh sách
      các "phiên vị trí" (PositionSession), mỗi phiên là một lượt ngồi liên tục
      tại MỘT vị trí.

    Vị trí điều hành chính (cần năng định):
        APP    = tiếp cận; TWR = đài chỉ huy; GCU = kiểm soát mặt đất;
        CTL    = vùng trời dưới FL245 (trên FL245 do ACC HCM/HN, ngoài phạm vi).
        TKT_T6 = kíp trưởng tầng 6 (APP/CTL) — cần năng định kíp trưởng.
        TKT_T8 = kíp trưởng tầng 8 (TWR/GCU) — cần năng định kíp trưởng.
        QS     = hiệp đồng quân sự — kíp trưởng sắp xếp nhân sự có năng định.

    Vị trí phụ trợ (AUXILIARY_POSITIONS — không cần năng định riêng):
        HDA, HDC, HDT, HDG: hiệp đồng, bất kỳ KSVKL nào cũng đảm nhận được.

MÔ HÌNH NĂNG ĐỊNH:
    - "full": làm được TẤT CẢ vị trí trong ALL_POSITIONS (operational).
    - Ngược lại: chỉ làm được các vị trí riêng lẻ được liệt kê.

LƯU Ý AN TOÀN:
    - Mọi ngưỡng trong RestRuleConfig CHỈ LÀ VÍ DỤ; thay bằng số liệu VATM/CAAV & ICAO.
    - Công cụ HỖ TRỢ ra quyết định, KHÔNG thay thế quy trình phê duyệt chính thức.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum


class Severity(Enum):
    CRITICAL = "Nghiêm trọng"
    WARNING = "Cảnh báo"
    INFO = "Lưu ý"


class Position(Enum):
    """Vị trí trong đơn vị KSVKL."""
    # Vị trí điều hành chính — cần năng định
    APP    = "APP"     # Approach Control - tiếp cận
    CTL    = "CTL"     # Control - vùng trời dưới FL245 (tương tự ACC, thuộc đơn vị)
    TWR    = "TWR"     # Tower - đài chỉ huy
    GCU    = "GCU"     # Ground Control Unit - kiểm soát mặt đất
    # Vị trí kíp trưởng — cần năng định kíp trưởng
    TKT_T6 = "TKT_T6"  # Kíp trưởng tầng 6 (APP/CTL)
    TKT_T8 = "TKT_T8"  # Kíp trưởng tầng 8 (TWR/GCU)
    # Vị trí hiệp đồng quân sự — cần năng định
    QS     = "QS"      # Quân sự - hiệp đồng quân sự
    # Vị trí phụ trợ — không cần năng định riêng
    HDA    = "HDA"     # Hiệp đồng A
    HDC    = "HDC"     # Hiệp đồng C
    HDT    = "HDT"     # Hiệp đồng T
    HDG    = "HDG"     # Hiệp đồng G


# Vị trí phụ trợ: bất kỳ KSVKL nào cũng đảm nhận được, không cần năng định riêng.
# Bỏ qua trong kiểm tra qualification_coverage và position_recency.
AUXILIARY_POSITIONS: frozenset[Position] = frozenset({
    Position.HDA, Position.HDC, Position.HDT, Position.HDG,
})

# Tập vị trí yêu cầu năng định — dùng cho is_full và recency tracking.
ALL_POSITIONS: frozenset[Position] = frozenset(Position) - AUXILIARY_POSITIONS


@dataclass
class Qualification:
    """Năng định của một KSVKL.
    - is_full=True  -> làm được MỌI vị trí.
    - is_full=False -> chỉ làm được các vị trí trong `positions`.
    - expires_at    -> ngày hết hiệu lực (None = không giới hạn). Phase 2.
    - is_active     -> False khi đã bị vô hiệu hóa thủ công. Phase 2.
    - controller_name -> tên KSVKL, để báo cáo. Phase 2."""
    controller_id: int
    is_full: bool = False
    positions: frozenset[Position] = field(default_factory=frozenset)
    expires_at: date | None = None
    is_active: bool = True
    controller_name: str = ""

    def can_work(self, pos: Position) -> bool:
        return True if self.is_full else (pos in self.positions)

    def qualified_positions(self) -> frozenset[Position]:
        return ALL_POSITIONS if self.is_full else frozenset(self.positions)


@dataclass
class PositionSession:
    """Một phiên đảm nhận một vị trí (một lượt ngồi liên tục) trong ca trực."""
    position: Position
    start: datetime
    end: datetime

    @property
    def minutes(self) -> float:
        return (self.end - self.start).total_seconds() / 60.0


@dataclass
class Shift:
    """Một ca trực của một KSVKL. Có thể chứa nhiều phiên vị trí (luân phiên)."""
    shift_id: int
    controller_id: int
    controller_name: str
    start: datetime
    end: datetime
    is_night: bool = False
    sessions: list[PositionSession] = field(default_factory=list)

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0

    @property
    def duty_date(self):
        return self.start.date()

    @property
    def positions_worked(self) -> set[Position]:
        return {s.position for s in self.sessions}


@dataclass
class RestRuleConfig:
    """Cấu hình ngưỡng. ĐÂY LÀ VÍ DỤ - thay bằng số liệu chính thức.
    Đặt một trường = None để bỏ qua loại kiểm tra đó."""
    min_rest_between_shifts_hours: float | None = 11.0
    max_continuous_duty_hours: float | None = 10.0
    max_on_position_minutes: int | None = 120          # mỗi phiên vị trí liên tục tối đa
    max_consecutive_night_shifts: int | None = 3
    min_rest_after_night_block_hours: float | None = 48.0
    max_consecutive_working_days: int | None = 6
    max_duty_hours_per_week: float | None = 40.0
    max_duty_hours_per_28days: float | None = 156.0
    max_days_between_position_use: int | None = 90     # recency theo từng vị trí
    merge_adjacent_session_gap_minutes: int = 0        # gộp 2 phiên cùng vị trí cách nhau <= ngưỡng này


@dataclass
class Violation:
    rule: str
    severity: Severity
    controller_id: int
    controller_name: str
    message: str
    related_shift_ids: list[int] = field(default_factory=list)

    def __str__(self) -> str:
        ids = ", ".join(map(str, self.related_shift_ids))
        return f"[{self.severity.value}] {self.controller_name}: {self.message} (ca: {ids})"


def merge_position_runs(sessions: list[PositionSession]) -> list[tuple]:
    """Gộp các phiên LIỀN KỀ CÙNG vị trí (không có giải lao xen giữa) thành một lượt
    ngồi liên tục. Trả về danh sách (position, start, end).
    Quy tắc gộp: cùng vị trí VÀ phiên sau bắt đầu không muộn hơn lúc phiên trước kết thúc
    (gap <= 0). Nếu có khoảng nghỉ xen giữa -> tách thành lượt riêng (thời gian liên tục
    được reset). Đổi sang vị trí khác cũng tách lượt."""
    if not sessions:
        return []
    ordered = sorted(sessions, key=lambda s: s.start)
    runs = []
    pos, start, end = ordered[0].position, ordered[0].start, ordered[0].end
    for s in ordered[1:]:
        if s.position == pos and s.start <= end:
            end = max(end, s.end)
        else:
            runs.append((pos, start, end))
            pos, start, end = s.position, s.start, s.end
    runs.append((pos, start, end))
    return runs


class ComplianceChecker:
    def __init__(self, config: RestRuleConfig):
        self.cfg = config

    # ----------------- Hàm công khai -----------------

    def check_all(self, shifts: list[Shift],
                  qualifications: dict[int, Qualification] | None = None) -> list[Violation]:
        by_controller: dict[int, list[Shift]] = {}
        for s in shifts:
            by_controller.setdefault(s.controller_id, []).append(s)
        out: list[Violation] = []
        for cid, cshifts in by_controller.items():
            qual = qualifications.get(cid) if qualifications else None
            out.extend(self.check_controller(cshifts, qual))
        return out

    def check_controller(self, shifts: list[Shift],
                         qualification: Qualification | None = None) -> list[Violation]:
        if not shifts:
            return []
        shifts = sorted(shifts, key=lambda s: s.start)
        v: list[Violation] = []
        v += self._check_rest_between_shifts(shifts)
        v += self._check_continuous_duty(shifts)
        v += self._check_on_position_sessions(shifts)
        v += self._check_consecutive_nights(shifts)
        v += self._check_consecutive_days(shifts)
        v += self._check_weekly_duty(shifts)
        v += self._check_28day_duty(shifts)
        v += self._check_position_recency(shifts)
        if qualification is not None:
            v += self._check_qualification_coverage(shifts, qualification)
        return v

    # ----------------- Quy định nghỉ ngơi / giờ trực -----------------

    def _check_rest_between_shifts(self, shifts):
        out, limit = [], self.cfg.min_rest_between_shifts_hours
        if limit is None:
            return out
        for prev, nxt in zip(shifts, shifts[1:]):
            rest_h = (nxt.start - prev.end).total_seconds() / 3600.0
            if rest_h < limit:
                out.append(Violation(
                    "min_rest_between_shifts", Severity.CRITICAL,
                    prev.controller_id, prev.controller_name,
                    f"Chỉ nghỉ {rest_h:.1f} giờ giữa hai ca, dưới mức tối thiểu {limit:.1f} giờ",
                    [prev.shift_id, nxt.shift_id]))
        return out

    def _check_continuous_duty(self, shifts):
        out, limit = [], self.cfg.max_continuous_duty_hours
        if limit is None:
            return out
        for s in shifts:
            if s.duration_hours > limit:
                out.append(Violation(
                    "max_continuous_duty", Severity.CRITICAL,
                    s.controller_id, s.controller_name,
                    f"Ca trực dài {s.duration_hours:.1f} giờ, vượt mức tối đa {limit:.1f} giờ",
                    [s.shift_id]))
        return out

    def _merge_sessions(self, sessions: list[PositionSession]) -> list[PositionSession]:
        """Gộp các phiên LIỀN KỀ CÙNG vị trí cách nhau <= ngưỡng gộp thành một phiên
        liên tục. Phục vụ kiểm tra thời gian ngồi vị trí (giải lao đủ dài thì không gộp)."""
        gap_limit = self.cfg.merge_adjacent_session_gap_minutes or 0
        ordered = sorted(sessions, key=lambda x: x.start)
        merged: list[PositionSession] = []
        for s in ordered:
            if merged and merged[-1].position == s.position:
                gap_min = (s.start - merged[-1].end).total_seconds() / 60.0
                if gap_min <= gap_limit:
                    merged[-1] = PositionSession(s.position, merged[-1].start,
                                                 max(merged[-1].end, s.end))
                    continue
            merged.append(PositionSession(s.position, s.start, s.end))
        return merged

    def _check_on_position_sessions(self, shifts):
        """Mỗi phiên vị trí (sau khi gộp các phiên liền kề cùng vị trí) không được vượt
        ngưỡng phút. Luân phiên sang vị trí khác/giải lao là cơ chế ngắt thời gian liên tục."""
        out, limit = [], self.cfg.max_on_position_minutes
        if limit is None:
            return out
        for s in shifts:
            for sess in self._merge_sessions(s.sessions):
                if sess.minutes > limit:
                    out.append(Violation(
                        "max_on_position", Severity.WARNING,
                        s.controller_id, s.controller_name,
                        (f"Phiên vị trí {sess.position.value} kéo dài {sess.minutes:.0f} phút "
                         f"liên tục, vượt mức {limit} phút (cần luân phiên/giải lao sớm hơn)"),
                        [s.shift_id]))
        return out

    def _check_consecutive_nights(self, shifts):
        out = []
        max_nights = self.cfg.max_consecutive_night_shifts
        rest_after = self.cfg.min_rest_after_night_block_hours
        if max_nights is None and rest_after is None:
            return out
        block: list[Shift] = []

        def close_block(next_shift):
            if not block:
                return
            if max_nights is not None and len(block) > max_nights:
                out.append(Violation(
                    "max_consecutive_nights", Severity.WARNING,
                    block[0].controller_id, block[0].controller_name,
                    f"{len(block)} ca đêm liên tiếp, vượt mức tối đa {max_nights} ca",
                    [s.shift_id for s in block]))
            if rest_after is not None and next_shift is not None:
                rest_h = (next_shift.start - block[-1].end).total_seconds() / 3600.0
                if rest_h < rest_after:
                    out.append(Violation(
                        "min_rest_after_night_block", Severity.WARNING,
                        block[0].controller_id, block[0].controller_name,
                        (f"Chỉ nghỉ {rest_h:.1f} giờ sau chuỗi {len(block)} ca đêm, "
                         f"dưới mức {rest_after:.1f} giờ"),
                        [block[-1].shift_id, next_shift.shift_id]))

        prev = None
        for s in shifts:
            if s.is_night:
                if prev is not None and prev.is_night and (s.start - prev.start) <= timedelta(hours=36):
                    block.append(s)
                else:
                    close_block(s)
                    block = [s]
            else:
                close_block(s)
                block = []
            prev = s
        close_block(None)
        return out

    def _check_consecutive_days(self, shifts):
        out, limit = [], self.cfg.max_consecutive_working_days
        if limit is None:
            return out
        work_days = sorted({s.duty_date for s in shifts})
        if not work_days:
            return out
        runs, run = [], [work_days[0]]
        for d in work_days[1:]:
            if (d - run[-1]).days == 1:
                run.append(d)
            else:
                runs.append(run)
                run = [d]
        runs.append(run)
        for r in runs:
            if len(r) > limit:
                day_set = set(r)
                ids = [s.shift_id for s in shifts if s.duty_date in day_set]
                out.append(Violation(
                    "max_consecutive_days", Severity.WARNING,
                    shifts[0].controller_id, shifts[0].controller_name,
                    f"Làm việc {len(r)} ngày liên tiếp ({r[0]} -> {r[-1]}), vượt mức {limit} ngày",
                    ids))
        return out

    def _check_rolling_duty(self, shifts, window_days, limit, rule_name, period_label):
        out = []
        if limit is None:
            return out
        for i, anchor in enumerate(shifts):
            window_end = anchor.start + timedelta(days=window_days)
            total, ids = 0.0, []
            for s in shifts[i:]:
                if s.start < window_end:
                    total += s.duration_hours
                    ids.append(s.shift_id)
                else:
                    break
            if total > limit:
                out.append(Violation(
                    rule_name, Severity.WARNING,
                    anchor.controller_id, anchor.controller_name,
                    (f"Tổng {total:.1f} giờ trực trong {period_label} kể từ "
                     f"{anchor.start.date()}, vượt mức {limit:.1f} giờ"),
                    ids))
        return out

    def _check_weekly_duty(self, shifts):
        return self._check_rolling_duty(shifts, 7, self.cfg.max_duty_hours_per_week,
                                        "max_duty_per_week", "7 ngày")

    def _check_28day_duty(self, shifts):
        return self._check_rolling_duty(shifts, 28, self.cfg.max_duty_hours_per_28days,
                                        "max_duty_per_28days", "28 ngày")

    # ----------------- Năng định theo vị trí -----------------

    def _check_position_recency(self, shifts):
        """Recency theo TỪNG vị trí, tính trên mọi phiên vị trí của mọi ca:
        khoảng cách giữa hai lần đảm nhận cùng một vị trí không vượt ngưỡng."""
        out, window = [], self.cfg.max_days_between_position_use
        if window is None:
            return out
        by_pos: dict[Position, list[tuple]] = {}
        for s in shifts:
            for sess in s.sessions:
                if sess.position in AUXILIARY_POSITIONS:
                    continue  # vị trí phụ trợ không cần recency
                by_pos.setdefault(sess.position, []).append((sess.start, s.shift_id, s.controller_id, s.controller_name))
        for pos, entries in by_pos.items():
            entries.sort(key=lambda e: e[0])
            for (t_prev, id_prev, cid, name), (t_next, id_next, _, _) in zip(entries, entries[1:]):
                gap = (t_next.date() - t_prev.date()).days
                if gap > window:
                    out.append(Violation(
                        "position_recency", Severity.WARNING, cid, name,
                        (f"Vị trí {pos.value}: cách {gap} ngày giữa hai lần đảm nhận "
                         f"({t_prev.date()} -> {t_next.date()}), vượt mức {window} ngày - "
                         f"có thể mất tính cập nhật, cần kiểm tra lại"),
                        [id_prev, id_next]))
        return out

    def _check_qualification_coverage(self, shifts, qualification):
        """PHỦ NĂNG ĐỊNH: mỗi PHIÊN vị trí, KSVKL phải có năng định cho vị trí đó.
        - full -> luôn đạt. - Ngược lại -> vị trí phải nằm trong danh sách riêng lẻ."""
        out = []
        for s in shifts:
            for sess in s.sessions:
                if sess.position in AUXILIARY_POSITIONS:
                    continue  # vị trí phụ trợ không cần năng định riêng
                if not qualification.can_work(sess.position):
                    qp = ", ".join(sorted(p.value for p in qualification.qualified_positions())) or "(không có)"
                    out.append(Violation(
                        "qualification_coverage", Severity.CRITICAL,
                        s.controller_id, s.controller_name,
                        (f"Được phân phiên vị trí {sess.position.value} nhưng KHÔNG có năng định "
                         f"cho vị trí này (năng định hiện có: {qp})"),
                        [s.shift_id]))
        return out


def format_report(violations: list[Violation]) -> str:
    if not violations:
        return "✓ Không phát hiện vi phạm. Lịch trực tuân thủ các quy định đã cấu hình."
    lines = [f"Phát hiện {len(violations)} vi phạm:\n"]
    order = {Severity.CRITICAL: 0, Severity.WARNING: 1, Severity.INFO: 2}
    for v in sorted(violations, key=lambda x: order[x.severity]):
        lines.append(f"  - {v}")
    return "\n".join(lines)
