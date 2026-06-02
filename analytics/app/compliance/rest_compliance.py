"""
rest_compliance.py
==================
Module kiểm tra tuân thủ quy định cho Kiểm Soát Viên Không Lưu (KSVKL).

Nguồn pháp lý:
- QĐ 2288/QĐ-QLB (25/3/2026) — Quy định Quản lý rủi ro mệt mỏi cho KSVKL của VATM.
- QĐ 2701/QĐ-QLB (07/5/2024) — Chế độ ca, kíp trực, bàn giao ca, bình giảng.
- QĐ 2289/QĐ-QLB (25/3/2026) — Chương trình Quản lý mệt mỏi (FMP). Khung tổ chức.

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
    - Dịch vụ truy cập DB ở chế độ CHỈ ĐỌC.
    - Các ngưỡng pháp lý bám theo QĐ 2288/QĐ-QLB ngày 25/3/2026 (Quản lý rủi ro mệt mỏi),
      bổ trợ bởi QĐ 2701/QĐ-QLB ngày 07/5/2024 (chế độ ca, kíp trực) và
      QĐ 2289/QĐ-QLB ngày 25/3/2026 (Chương trình FMP).
    - Khi quy định pháp lý thay đổi, cập nhật RestRuleConfig.effective_from và các trường tương ứng.
    - Dịch vụ này HỖ TRỢ ra quyết định, KHÔNG thay thế quy trình phê duyệt chính thức.
    - Tinh thần "Just Culture" theo QĐ 2288 Điều 8 và QĐ 2289 Chương I.V.5.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum


# ---------------------------------------------------------------------------
# Enums cơ bản
# ---------------------------------------------------------------------------

class Severity(Enum):
    CRITICAL = "Nghiêm trọng"
    WARNING = "Cảnh báo"
    INFO = "Lưu ý"


class Position(Enum):
    """Vị trí trong đơn vị KSVKL."""
    # Vị trí điều hành chính — cần năng định
    APP    = "APP"     # Approach Control - tiếp cận
    CTL    = "CTL"     # Control - vùng trời dưới FL245
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


# Vị trí phụ trợ: bất kỳ KSVKL nào cũng đảm nhận được.
# Bỏ qua trong kiểm tra qualification_coverage và position_recency.
AUXILIARY_POSITIONS: frozenset[Position] = frozenset({
    Position.HDA, Position.HDC, Position.HDT, Position.HDG,
})

# Tập vị trí yêu cầu năng định — dùng cho is_full và recency tracking.
ALL_POSITIONS: frozenset[Position] = frozenset(Position) - AUXILIARY_POSITIONS


# ---------------------------------------------------------------------------
# Domain models cơ bản
# ---------------------------------------------------------------------------

@dataclass
class Qualification:
    """Năng định của một KSVKL."""
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


# ---------------------------------------------------------------------------
# RestRuleConfig — ngưỡng theo QĐ 2288/QĐ-QLB ngày 25/3/2026
# ---------------------------------------------------------------------------

@dataclass
class RestRuleConfig:
    """Ngưỡng quy định cho KSVKL — bám theo QĐ 2288/QĐ-QLB ngày 25/3/2026.

    Nguồn pháp lý:
    - QĐ 2288/QĐ-QLB (25/3/2026) — Quản lý rủi ro mệt mỏi cho KSVKL của VATM.
    - QĐ 2701/QĐ-QLB (07/5/2024) — Chế độ ca, kíp trực, bàn giao, bình giảng.

    Khi văn bản pháp lý thay đổi: cập nhật effective_from và các trường tương ứng.
    Đặt một trường = None để bỏ qua quy tắc đó.
    """
    # Phiên bản quy định (cập nhật khi pháp luật đổi)
    effective_from: str = "2026-03-25"
    source_primary: str = "QĐ 2288/QĐ-QLB"

    # ── QĐ 2288 Chương IV Điều 11: Giới hạn theo ngày, tuần ────────────────
    # Điều 11.1: Tổng thời gian thực hiện nhiệm vụ (gồm cả nghỉ trong ca) ≤ 10h
    max_designed_shift_hours: float | None = 10.0
    # Điều 11.3: Khi có làm thêm, tổng ngày ≤ 12h (giới hạn tuyệt đối)
    max_extended_shift_hours: float | None = 12.0
    # Điều 11.2: Giờ làm bình thường/tuần ≤ 48
    max_duty_hours_per_week: float | None = 48.0

    # ── QĐ 2288 Chương IV Điều 12: Giới hạn tích lũy 30 ngày ──────────────
    # Điều 12.1: Tổng giờ trong 30 ngày liên tiếp ≤ 180h
    max_duty_hours_per_30days: float | None = 180.0
    # Điều 12.2: Số ngày làm liên tiếp ≤ 6, sau đó nghỉ ≥ 24h liên tục
    max_consecutive_working_days: int | None = 6
    min_rest_after_6consecutive_days_hours: float | None = 24.0
    # Điều 12.2: Trong 30 ngày, ≥ 4 ngày nghỉ (24h liên tục mỗi ngày)
    min_full_rest_days_per_30days: int | None = 4

    # ── QĐ 2288 Chương IV Điều 13: Nghỉ giữa hai ca ────────────────────────
    # Điều 13.1: ≥ 12 giờ liên tục
    min_rest_between_shifts_hours: float | None = 12.0

    # ── QĐ 2288 Chương IV Điều 14: Giới hạn trong ca trực ──────────────────
    # Điều 14.1.a: Thời gian trực tiếp tại vị trí liên tục ≤ 2h
    max_on_position_minutes: int | None = 120
    # Điều 14.1.b: Khi lưu lượng thấp, kíp trưởng có thể nới lên 4h
    max_on_position_low_traffic_minutes: int | None = 240
    # Điều 14.2.a: Nghỉ sau phiên — ngày ≥ 30 phút, đêm ≥ 45 phút
    min_break_after_position_day_minutes: int | None = 30
    min_break_after_position_night_minutes: int | None = 45
    # Gộp phiên liền kề cùng vị trí (giữ trường cũ)
    merge_adjacent_session_gap_minutes: int = 0

    # ── QĐ 2288 Chương IV Điều 15: Ca đêm, ca sớm, ca muộn ─────────────────
    # Điều 15.1.a: Ca đêm = phần lớn thời gian trong 22h00-06h00
    night_window_start_hour: int = 22
    night_window_end_hour: int = 6
    # Điều 15.1.b: Không quá 3 ca đêm liên tiếp
    max_consecutive_night_shifts: int | None = 3
    # Điều 15.1.c: Sau chuỗi 3 ca đêm, nghỉ ≥ 48h
    min_rest_after_night_block_hours: float | None = 48.0
    min_full_sleep_nights_after_night_block: int = 2
    # Điều 15.2.a: Ca sớm bắt đầu 04h00-07h00
    early_shift_window_start_hour: int = 4
    early_shift_window_end_hour: int = 7
    # Điều 15.2.b: Không sắp ca sớm ngay sau ca muộn/đêm
    forbid_early_after_late_or_night: bool = True
    late_shift_end_hour: int = 22

    # ── QĐ 2288 Chương IV Điều 16 + QĐ 2701 Điều 7.2: Trực dự phòng ───────
    # Điều 16.1 + QĐ 2701 Điều 7.2: ≤ 3 lần on-call/7 ngày liên tiếp
    max_oncall_per_7days: int | None = 3
    # Điều 16.2: thời lượng tối đa mỗi lượt on-call ≤ 20h
    max_oncall_duration_hours: float | None = 20.0
    # QĐ 2701 Điều 7.2.a: ≥ 20% kíp (kíp ≥ 6 người) trực on-call
    oncall_min_ratio_per_shift: float = 0.20

    # ── QĐ 2288 Chương IV Điều 17: Ngưỡng thức liên tục — TẠM BỎ QUA ──────
    # Điều 17.2: 16h. Cần dữ liệu giấc ngủ (FRMS), roster đơn thuần không tính được.
    max_continuous_awake_hours: float | None = None

    # ── Năng định theo vị trí ───────────────────────────────────────────────
    max_days_between_position_use: int | None = 90


# ---------------------------------------------------------------------------
# ShiftKind — phân loại ca QĐ 2288 Điều 15
# ---------------------------------------------------------------------------

class ShiftKind(Enum):
    """Phân loại ca theo QĐ 2288 Điều 15."""
    NORMAL = "NORMAL"
    EARLY  = "EARLY"   # bắt đầu 04h00-07h00 (QĐ 2288 Điều 15.2.a)
    LATE   = "LATE"    # kết thúc sau 22h00
    NIGHT  = "NIGHT"   # phần lớn thời gian trong 22h00-06h00 (QĐ 2288 Điều 15.1.a)


def classify_shift_kind(start: datetime, end: datetime, cfg: RestRuleConfig) -> ShiftKind:
    """Phân loại ca dựa trên khung giờ và cấu hình. QĐ 2288 Điều 15.

    Kiểm tra EARLY trước NIGHT để xử lý overlap 04h-06h:
    ca bắt đầu 04h-07h là EARLY, không phải NIGHT.
    """
    # EARLY: bắt đầu 04h00-07h00 — ưu tiên kiểm tra trước (QĐ 2288 Điều 15.2.a)
    if cfg.early_shift_window_start_hour <= start.hour < cfg.early_shift_window_end_hour:
        return ShiftKind.EARLY
    # NIGHT: bắt đầu ≥ 22h hoặc < 04h (phần lớn thời gian trong 22h-06h)
    if start.hour >= cfg.night_window_start_hour or start.hour < cfg.early_shift_window_start_hour:
        return ShiftKind.NIGHT
    # LATE: kết thúc sau 22h00
    end_hour = end.hour if end.date() == start.date() else (end.hour + 24 * (end.date() - start.date()).days)
    if end_hour >= cfg.late_shift_end_hour:
        return ShiftKind.LATE
    return ShiftKind.NORMAL


# ---------------------------------------------------------------------------
# Shift
# ---------------------------------------------------------------------------

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
    kind: ShiftKind | None = None   # QĐ 2288 Điều 15; None = suy từ is_night

    @property
    def effective_kind(self) -> ShiftKind:
        """Loại ca thực tế: dùng kind nếu có, ngược lại suy từ is_night."""
        if self.kind is not None:
            return self.kind
        return ShiftKind.NIGHT if self.is_night else ShiftKind.NORMAL

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0

    @property
    def duty_date(self):
        return self.start.date()

    @property
    def positions_worked(self) -> set[Position]:
        return {s.position for s in self.sessions}


# ---------------------------------------------------------------------------
# Violation
# ---------------------------------------------------------------------------

@dataclass
class Violation:
    rule: str
    severity: Severity
    controller_id: int
    controller_name: str
    message: str
    related_shift_ids: list[int] = field(default_factory=list)
    legal_basis: str = ""   # Viện dẫn điều luật, vd "QĐ 2288 Điều 12.1"

    def __str__(self) -> str:
        ids = ", ".join(map(str, self.related_shift_ids))
        basis = f" [{self.legal_basis}]" if self.legal_basis else ""
        return f"[{self.severity.value}] {self.controller_name}: {self.message} (ca: {ids}){basis}"


# ---------------------------------------------------------------------------
# OncallAssignment — QĐ 2288 Điều 16, QĐ 2701 Điều 7.2
# ---------------------------------------------------------------------------

@dataclass
class OncallAssignment:
    """Một lượt trực dự phòng từ xa (on-call). QĐ 2288 Điều 16, QĐ 2701 Điều 7.2.

    STUB: chưa có dữ liệu on-call trong DB. Không gắn vào check_all().
    Gọi check_oncall_limits() riêng khi có dữ liệu.
    """
    controller_id: str | int
    controller_name: str
    start: datetime
    end: datetime
    activated: bool = False   # True nếu được gọi vào trực thật

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


def check_oncall_limits(
    oncalls: list[OncallAssignment],
    cfg: RestRuleConfig,
) -> list[Violation]:
    """Kiểm tra giới hạn on-call. QĐ 2288 Điều 16.1-16.2 + QĐ 2701 Điều 7.2.

    KHÔNG gọi từ check_all() vì on-call không nằm trong list[Shift];
    gọi riêng từ tầng review khi có dữ liệu on-call.
    """
    out: list[Violation] = []

    # 1. Mỗi lượt ≤ 20h — QĐ 2288 Điều 16.2
    if cfg.max_oncall_duration_hours is not None:
        for oc in oncalls:
            if oc.duration_hours > cfg.max_oncall_duration_hours:
                out.append(Violation(
                    rule="max_oncall_duration",
                    severity=Severity.WARNING,
                    controller_id=oc.controller_id,
                    controller_name=oc.controller_name,
                    message=(
                        f"Lượt on-call kéo dài {oc.duration_hours:.1f} giờ, "
                        f"vượt giới hạn {cfg.max_oncall_duration_hours} giờ."
                    ),
                    related_shift_ids=[],
                    legal_basis="QĐ 2288 Điều 16.2",
                ))

    # 2. Mỗi người ≤ 3 lần/7 ngày — QĐ 2288 Điều 16.1
    if cfg.max_oncall_per_7days is not None:
        by_person: dict = {}
        for oc in oncalls:
            by_person.setdefault(oc.controller_id, []).append(oc)
        for cid, lst in by_person.items():
            lst.sort(key=lambda x: x.start)
            for i, anchor in enumerate(lst):
                window_end = anchor.start + timedelta(days=7)
                count = sum(1 for oc in lst[i:] if oc.start < window_end)
                if count > cfg.max_oncall_per_7days:
                    out.append(Violation(
                        rule="max_oncall_per_7days",
                        severity=Severity.WARNING,
                        controller_id=cid,
                        controller_name=lst[i].controller_name,
                        message=(
                            f"{count} lượt on-call trong 7 ngày kể từ {anchor.start.date()}, "
                            f"vượt giới hạn {cfg.max_oncall_per_7days}."
                        ),
                        related_shift_ids=[],
                        legal_basis="QĐ 2288 Điều 16.1",
                    ))
                    break   # đã báo cho người này trong cửa sổ này
    return out


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def merge_position_runs(sessions: list[PositionSession]) -> list[tuple]:
    """Gộp các phiên LIỀN KỀ CÙNG vị trí thành một lượt ngồi liên tục.
    Trả về danh sách (position, start, end)."""
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


# ---------------------------------------------------------------------------
# ComplianceChecker
# ---------------------------------------------------------------------------

class ComplianceChecker:
    def __init__(self, config: RestRuleConfig):
        self.cfg = config

    # ── Hàm công khai ───────────────────────────────────────────────────────

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
        v += self._check_shift_duration(shifts)
        v += self._check_on_position_sessions(shifts)
        v += self._check_break_after_position(shifts)
        v += self._check_consecutive_nights(shifts)
        v += self._check_early_after_late_or_night(shifts)
        v += self._check_consecutive_days(shifts)
        v += self._check_weekly_duty(shifts)
        v += self._check_30day_duty(shifts)
        v += self._check_full_rest_days_per_30days(shifts)
        v += self._check_position_recency(shifts)
        if qualification is not None:
            v += self._check_qualification_coverage(shifts, qualification)
        return v

    # ── Nghỉ giữa ca ────────────────────────────────────────────────────────

    def _check_rest_between_shifts(self, shifts):
        """≥ 12h nghỉ giữa hai ca. QĐ 2288 Điều 13.1."""
        out, limit = [], self.cfg.min_rest_between_shifts_hours
        if limit is None:
            return out
        for prev, nxt in zip(shifts, shifts[1:]):
            rest_h = (nxt.start - prev.end).total_seconds() / 3600.0
            if rest_h < limit:
                out.append(Violation(
                    rule="min_rest_between_shifts",
                    severity=Severity.CRITICAL,
                    controller_id=prev.controller_id,
                    controller_name=prev.controller_name,
                    message=f"Chỉ nghỉ {rest_h:.1f} giờ giữa hai ca, dưới mức tối thiểu {limit:.1f} giờ.",
                    related_shift_ids=[prev.shift_id, nxt.shift_id],
                    legal_basis="QĐ 2288 Điều 13.1",
                ))
        return out

    # ── Thời lượng ca ───────────────────────────────────────────────────────

    def _check_shift_duration(self, shifts):
        """Ca thiết kế ≤ 10h (Điều 11.1, WARNING); ca kéo dài ≤ 12h (Điều 11.3, CRITICAL)."""
        out = []
        designed = self.cfg.max_designed_shift_hours
        extended = self.cfg.max_extended_shift_hours
        for s in shifts:
            if extended is not None and s.duration_hours > extended:
                out.append(Violation(
                    rule="max_extended_shift",
                    severity=Severity.CRITICAL,
                    controller_id=s.controller_id,
                    controller_name=s.controller_name,
                    message=(
                        f"Ca trực dài {s.duration_hours:.1f} giờ, vượt giới hạn tuyệt đối "
                        f"{extended:.1f} giờ."
                    ),
                    related_shift_ids=[s.shift_id],
                    legal_basis="QĐ 2288 Điều 11.3",
                ))
            elif designed is not None and s.duration_hours > designed:
                out.append(Violation(
                    rule="max_designed_shift",
                    severity=Severity.WARNING,
                    controller_id=s.controller_id,
                    controller_name=s.controller_name,
                    message=(
                        f"Ca trực dài {s.duration_hours:.1f} giờ, vượt mức thiết kế "
                        f"{designed:.1f} giờ."
                    ),
                    related_shift_ids=[s.shift_id],
                    legal_basis="QĐ 2288 Điều 11.1",
                ))
        return out

    # ── Thời gian ngồi vị trí ───────────────────────────────────────────────

    def _merge_sessions(self, sessions: list[PositionSession]) -> list[PositionSession]:
        """Gộp phiên liền kề cùng vị trí ≤ ngưỡng gộp."""
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
        """Mỗi phiên vị trí liên tục ≤ 120 phút. QĐ 2288 Điều 14.1.a."""
        out, limit = [], self.cfg.max_on_position_minutes
        if limit is None:
            return out
        for s in shifts:
            for sess in self._merge_sessions(s.sessions):
                if sess.minutes > limit:
                    out.append(Violation(
                        rule="max_on_position",
                        severity=Severity.WARNING,
                        controller_id=s.controller_id,
                        controller_name=s.controller_name,
                        message=(
                            f"Phiên vị trí {sess.position.value} kéo dài {sess.minutes:.0f} phút "
                            f"liên tục, vượt mức {limit} phút (cần luân phiên/giải lao sớm hơn)."
                        ),
                        related_shift_ids=[s.shift_id],
                        legal_basis="QĐ 2288 Điều 14.1",
                    ))
        return out

    def _check_break_after_position(self, shifts):
        """Sau mỗi phiên vị trí phải có nghỉ ≥ 30 phút (ca ngày) hoặc ≥ 45 phút (ca đêm).
        QĐ 2288 Điều 14.2.a. Áp dụng cho mọi cặp phiên liền kề trong cùng ca,
        trừ phiên cuối của ca (không có phiên kế tiếp để kiểm tra).
        """
        out = []
        day_min = self.cfg.min_break_after_position_day_minutes
        night_min = self.cfg.min_break_after_position_night_minutes
        if day_min is None and night_min is None:
            return out
        for s in shifts:
            sessions = sorted(s.sessions, key=lambda x: x.start)
            for cur, nxt in zip(sessions, sessions[1:]):
                gap_min = (nxt.start - cur.end).total_seconds() / 60.0
                required = night_min if s.is_night else day_min
                if required is None or gap_min >= required:
                    continue
                out.append(Violation(
                    rule="min_break_after_position",
                    severity=Severity.WARNING,
                    controller_id=s.controller_id,
                    controller_name=s.controller_name,
                    message=(
                        f"Chỉ nghỉ {gap_min:.0f} phút sau phiên {cur.position.value} "
                        f"(ca {'đêm' if s.is_night else 'ngày'}), dưới mức tối thiểu "
                        f"{required} phút."
                    ),
                    related_shift_ids=[s.shift_id],
                    legal_basis="QĐ 2288 Điều 14.2.a",
                ))
        return out

    # ── Ca đêm liên tiếp ────────────────────────────────────────────────────

    def _check_consecutive_nights(self, shifts):
        """≤ 3 ca đêm liên tiếp. Sau chuỗi đêm, nghỉ ≥ 48h. QĐ 2288 Điều 15.1.b-c."""
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
                    rule="max_consecutive_nights",
                    severity=Severity.WARNING,
                    controller_id=block[0].controller_id,
                    controller_name=block[0].controller_name,
                    message=f"{len(block)} ca đêm liên tiếp, vượt mức tối đa {max_nights} ca.",
                    related_shift_ids=[s.shift_id for s in block],
                    legal_basis="QĐ 2288 Điều 15.1.b",
                ))
            if rest_after is not None and next_shift is not None:
                rest_h = (next_shift.start - block[-1].end).total_seconds() / 3600.0
                if rest_h < rest_after:
                    out.append(Violation(
                        rule="min_rest_after_night_block",
                        severity=Severity.WARNING,
                        controller_id=block[0].controller_id,
                        controller_name=block[0].controller_name,
                        message=(
                            f"Chỉ nghỉ {rest_h:.1f} giờ sau chuỗi {len(block)} ca đêm, "
                            f"dưới mức {rest_after:.1f} giờ."
                        ),
                        related_shift_ids=[block[-1].shift_id, next_shift.shift_id],
                        legal_basis="QĐ 2288 Điều 15.1.c",
                    ))

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

    def _check_early_after_late_or_night(self, shifts):
        """Không sắp ca sớm ngay sau ca muộn/đêm. QĐ 2288 Điều 15.2.b."""
        out = []
        if not self.cfg.forbid_early_after_late_or_night:
            return out
        for prev, nxt in zip(shifts, shifts[1:]):
            prev_kind = prev.effective_kind
            nxt_kind  = nxt.effective_kind
            if nxt_kind == ShiftKind.EARLY and prev_kind in {ShiftKind.LATE, ShiftKind.NIGHT}:
                out.append(Violation(
                    rule="early_after_late_or_night",
                    severity=Severity.WARNING,
                    controller_id=prev.controller_id,
                    controller_name=prev.controller_name,
                    message=(
                        f"Ca {nxt_kind.value} ngay sau ca {prev_kind.value} "
                        f"(cần đánh giá rủi ro / deviation trước khi bố trí)."
                    ),
                    related_shift_ids=[prev.shift_id, nxt.shift_id],
                    legal_basis="QĐ 2288 Điều 15.2.b",
                ))
        return out

    # ── Ngày làm liên tiếp ──────────────────────────────────────────────────

    def _check_consecutive_days(self, shifts):
        """≤ 6 ngày làm liên tiếp. Sau 6 ngày, nghỉ ≥ 24h. QĐ 2288 Điều 12.2."""
        out, limit = [], self.cfg.max_consecutive_working_days
        if limit is None:
            return out
        work_days = sorted({s.duty_date for s in shifts})
        if not work_days:
            return out
        # Dựng các chuỗi ngày liên tiếp
        runs, run = [], [work_days[0]]
        for d in work_days[1:]:
            if (d - run[-1]).days == 1:
                run.append(d)
            else:
                runs.append(run)
                run = [d]
        runs.append(run)

        for idx, r in enumerate(runs):
            if len(r) > limit:
                day_set = set(r)
                ids = [s.shift_id for s in shifts if s.duty_date in day_set]
                out.append(Violation(
                    rule="max_consecutive_days",
                    severity=Severity.WARNING,
                    controller_id=shifts[0].controller_id,
                    controller_name=shifts[0].controller_name,
                    message=(
                        f"Làm việc {len(r)} ngày liên tiếp ({r[0]} → {r[-1]}), "
                        f"vượt mức {limit} ngày."
                    ),
                    related_shift_ids=ids,
                    legal_basis="QĐ 2288 Điều 12.2",
                ))
            # Kiểm tra nghỉ ≥ 24h sau chuỗi ≥ limit ngày
            min_rest = self.cfg.min_rest_after_6consecutive_days_hours
            if min_rest is not None and len(r) >= limit and idx + 1 < len(runs):
                # Tìm shift cuối của chuỗi này và shift đầu của chuỗi tiếp theo
                last_day = r[-1]
                first_next_day = runs[idx + 1][0]
                last_shifts = [s for s in shifts if s.duty_date == last_day]
                next_shifts  = [s for s in shifts if s.duty_date == first_next_day]
                if last_shifts and next_shifts:
                    last_end  = max(s.end for s in last_shifts)
                    next_start = min(s.start for s in next_shifts)
                    rest_h = (next_start - last_end).total_seconds() / 3600.0
                    if rest_h < min_rest:
                        out.append(Violation(
                            rule="min_rest_after_consecutive_days",
                            severity=Severity.WARNING,
                            controller_id=shifts[0].controller_id,
                            controller_name=shifts[0].controller_name,
                            message=(
                                f"Chỉ nghỉ {rest_h:.1f} giờ sau {len(r)} ngày làm liên tiếp, "
                                f"dưới mức {min_rest:.0f} giờ."
                            ),
                            related_shift_ids=[s.shift_id for s in last_shifts + next_shifts],
                            legal_basis="QĐ 2288 Điều 12.2",
                        ))
        return out

    # ── Giờ trực ────────────────────────────────────────────────────────────

    def _check_rolling_duty(self, shifts, window_days, limit, rule_name,
                            period_label, legal_basis=""):
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
                    rule=rule_name,
                    severity=Severity.WARNING,
                    controller_id=anchor.controller_id,
                    controller_name=anchor.controller_name,
                    message=(
                        f"Tổng {total:.1f} giờ trực trong {period_label} kể từ "
                        f"{anchor.start.date()}, vượt mức {limit:.1f} giờ."
                    ),
                    related_shift_ids=ids,
                    legal_basis=legal_basis,
                ))
        return out

    def _check_weekly_duty(self, shifts):
        """≤ 48h/tuần. QĐ 2288 Điều 11.2."""
        return self._check_rolling_duty(
            shifts, 7, self.cfg.max_duty_hours_per_week,
            "max_duty_per_week", "7 ngày",
            legal_basis="QĐ 2288 Điều 11.2",
        )

    def _check_30day_duty(self, shifts):
        """≤ 180h/30 ngày. QĐ 2288 Điều 12.1."""
        return self._check_rolling_duty(
            shifts, 30, self.cfg.max_duty_hours_per_30days,
            "max_duty_per_30days", "30 ngày",
            legal_basis="QĐ 2288 Điều 12.1",
        )

    def _check_full_rest_days_per_30days(self, shifts):
        """≥ 4 ngày nghỉ trong mỗi cửa sổ 30 ngày. QĐ 2288 Điều 12.2."""
        out = []
        min_rest_days = self.cfg.min_full_rest_days_per_30days
        if min_rest_days is None or not shifts:
            return out
        work_dates = {s.duty_date for s in shifts}
        # Kiểm tra cửa sổ 30 ngày bắt đầu từ ca đầu tiên
        period_start = min(work_dates)
        period_end   = max(work_dates)
        cur = period_start
        while cur <= period_end:
            window_end = cur + timedelta(days=30)
            work_in_window = sum(1 for d in work_dates if cur <= d < window_end)
            total_days = (min(window_end, period_end + timedelta(days=1)) - cur).days
            rest_days = total_days - work_in_window
            if total_days >= 30 and rest_days < min_rest_days:
                ids = [s.shift_id for s in shifts if cur <= s.duty_date < window_end]
                out.append(Violation(
                    rule="min_full_rest_days_per_30days",
                    severity=Severity.WARNING,
                    controller_id=shifts[0].controller_id,
                    controller_name=shifts[0].controller_name,
                    message=(
                        f"Chỉ có {rest_days} ngày nghỉ trong 30 ngày kể từ {cur}, "
                        f"dưới mức tối thiểu {min_rest_days} ngày."
                    ),
                    related_shift_ids=ids,
                    legal_basis="QĐ 2288 Điều 12.2",
                ))
            cur += timedelta(days=7)   # trượt cửa sổ theo tuần
        return out

    # ── Năng định theo vị trí ───────────────────────────────────────────────

    def _check_position_recency(self, shifts):
        """Recency theo từng vị trí. QĐ 2288 / quy định năng định nội bộ."""
        out, window = [], self.cfg.max_days_between_position_use
        if window is None:
            return out
        by_pos: dict[Position, list[tuple]] = {}
        for s in shifts:
            for sess in s.sessions:
                if sess.position in AUXILIARY_POSITIONS:
                    continue
                by_pos.setdefault(sess.position, []).append(
                    (sess.start, s.shift_id, s.controller_id, s.controller_name)
                )
        for pos, entries in by_pos.items():
            entries.sort(key=lambda e: e[0])
            for (t_prev, id_prev, cid, name), (t_next, id_next, _, _) in zip(entries, entries[1:]):
                gap = (t_next.date() - t_prev.date()).days
                if gap > window:
                    out.append(Violation(
                        rule="position_recency",
                        severity=Severity.WARNING,
                        controller_id=cid,
                        controller_name=name,
                        message=(
                            f"Vị trí {pos.value}: cách {gap} ngày giữa hai lần đảm nhận "
                            f"({t_prev.date()} → {t_next.date()}), vượt mức {window} ngày — "
                            f"có thể mất tính cập nhật, cần kiểm tra lại."
                        ),
                        related_shift_ids=[id_prev, id_next],
                        legal_basis="",   # chưa có điều luật cụ thể — bổ sung khi có tài liệu
                    ))
        return out

    def _check_qualification_coverage(self, shifts, qualification):
        """KSVKL phải có năng định cho từng vị trí được phân. QĐ 2288 Điều 5.1."""
        out = []
        for s in shifts:
            for sess in s.sessions:
                if sess.position in AUXILIARY_POSITIONS:
                    continue
                if not qualification.can_work(sess.position):
                    qp = ", ".join(sorted(p.value for p in qualification.qualified_positions())) or "(không có)"
                    out.append(Violation(
                        rule="qualification_coverage",
                        severity=Severity.CRITICAL,
                        controller_id=s.controller_id,
                        controller_name=s.controller_name,
                        message=(
                            f"Được phân phiên vị trí {sess.position.value} nhưng KHÔNG có năng định "
                            f"cho vị trí này (năng định hiện có: {qp})."
                        ),
                        related_shift_ids=[s.shift_id],
                        legal_basis="QĐ 2288 Điều 5.1",
                    ))
        return out


# ---------------------------------------------------------------------------
# Tiện ích
# ---------------------------------------------------------------------------

def format_report(violations: list[Violation]) -> str:
    if not violations:
        return "✓ Không phát hiện vi phạm. Lịch trực tuân thủ các quy định đã cấu hình."
    lines = [f"Phát hiện {len(violations)} vi phạm:\n"]
    order = {Severity.CRITICAL: 0, Severity.WARNING: 1, Severity.INFO: 2}
    for v in sorted(violations, key=lambda x: order[x.severity]):
        lines.append(f"  - {v}")
    return "\n".join(lines)
