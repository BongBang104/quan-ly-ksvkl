"""
chu_ky_review.py
================
Rà soát phân ca cấp tháng (SchedulerScreen). Khác cấp ca chi tiết:
- Đầu vào: ai làm kíp/ca gì vào ngày nào, không có phân vị trí.
- Quy tắc áp dụng: giờ 30 ngày, ngày liên tiếp, ca đêm liên tiếp + nghỉ phục hồi,
  nghỉ giữa ca, ngày nghỉ trong 30 ngày, phân bố on-call, đủ năng định bao phủ kíp.
- KHÔNG kiểm tra time-in-position, hoán đổi cùng khung giờ (đó là cấp ca chi tiết).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.compliance.rest_compliance import (
    ComplianceChecker,
    OncallAssignment,
    Position,
    Qualification,
    RestRuleConfig,
    Severity,
    Shift,
    ShiftKind,
    check_oncall_limits,
    classify_shift_kind,
)
from app.routers.schemas_macro import DayAssignment, MacroRosterDraft, MacroReviewResult


# Giờ ca chuẩn nếu draft không nêu cụ thể.
DEFAULT_SHIFT_HOURS: dict[str, tuple[int, int] | None] = {
    "S":        (7, 19),    # ca ngày 07-19
    "D":        (19, 31),   # ca đêm 19-07 hôm sau (31 = 24+7)
    "OFF":      None,
    "LEAVE":    None,
    "TRAINING": None,
    "ONCALL":   None,
    "REINFORCE": (7, 19),
}


def _to_shift(
    asg: DayAssignment,
    controller_name: str,
    shift_id: int,
    cfg: RestRuleConfig,
) -> Shift | None:
    """Quy đổi DayAssignment sang Shift để feed vào ComplianceChecker."""
    if asg.shift_kind.upper() in ("OFF", "LEAVE", "TRAINING", "ONCALL"):
        return None
    if asg.start_hour is not None and asg.end_hour is not None:
        hours: tuple[int, int] | None = (asg.start_hour, asg.end_hour)
    else:
        hours = DEFAULT_SHIFT_HOURS.get(asg.shift_kind.upper())
    if hours is None:
        return None
    sh_start = datetime.combine(asg.date, datetime.min.time()) + timedelta(hours=hours[0])
    sh_end   = datetime.combine(asg.date, datetime.min.time()) + timedelta(hours=hours[1])
    kind = classify_shift_kind(sh_start, sh_end, cfg)
    return Shift(
        shift_id=shift_id,
        controller_id=asg.controller_id,
        controller_name=controller_name,
        start=sh_start,
        end=sh_end,
        is_night=(kind == ShiftKind.NIGHT),
        kind=kind,
        sessions=[],   # cấp tháng không có session
    )


def _check_qualification_coverage_per_day(draft: MacroRosterDraft) -> list[dict]:
    """Mỗi ngày trong period phải có ≥ 1 KSVKL có năng định cho mỗi vị trí điều hành chính."""
    from collections import defaultdict
    warnings: list[dict] = []
    quals  = {c.id: c.qualification for c in draft.controllers}

    def has(qual_str: str, pos: Position) -> bool:
        if qual_str.strip().lower() in ("full", ""):
            return True
        return pos.value in [t.strip().upper() for t in qual_str.split(",")]

    by_day: dict = defaultdict(list)
    for asg in draft.assignments:
        if asg.shift_kind.upper() in ("S", "D", "REINFORCE"):
            by_day[asg.date].append(asg.controller_id)

    for d, cids in by_day.items():
        for pos in [Position.APP, Position.CTL, Position.TWR, Position.GCU]:
            n_qual = sum(1 for cid in cids if has(quals.get(cid, ""), pos))
            if n_qual == 0:
                warnings.append({
                    "date":     d.isoformat(),
                    "position": pos.value,
                    "message":  (
                        f"Ngày {d}: không có KSVKL nào có năng định {pos.value} "
                        f"trong số người làm ca hôm đó. (QĐ 2288 — đủ năng lực điều hành)"
                    ),
                })
    return warnings


def _build_oncalls(draft: MacroRosterDraft) -> list[OncallAssignment]:
    """Quy đổi assignments có shift_kind='ONCALL' thành OncallAssignment."""
    names = {c.id: c.name for c in draft.controllers}
    out: list[OncallAssignment] = []
    for asg in draft.assignments:
        if asg.shift_kind.upper() != "ONCALL":
            continue
        sh_start_h = asg.start_hour if asg.start_hour is not None else 0
        sh_end_h   = asg.end_hour   if asg.end_hour   is not None else 20
        start = datetime.combine(asg.date, datetime.min.time()) + timedelta(hours=sh_start_h)
        end   = datetime.combine(asg.date, datetime.min.time()) + timedelta(hours=sh_end_h)
        out.append(OncallAssignment(
            controller_id=asg.controller_id,
            controller_name=names.get(asg.controller_id, asg.controller_id),
            start=start, end=end, activated=False,
        ))
    return out


def review_macro_draft(
    draft: MacroRosterDraft,
    cfg: RestRuleConfig | None = None,
) -> MacroReviewResult:
    """Rà soát phân ca cấp tháng. Trả MacroReviewResult."""
    cfg = cfg or RestRuleConfig()
    names = {c.id: c.name for c in draft.controllers}

    shifts: list[Shift] = []
    for i, asg in enumerate(draft.assignments, start=1):
        sh = _to_shift(asg, names.get(asg.controller_id, asg.controller_id), i, cfg)
        if sh is not None:
            shifts.append(sh)

    checker = ComplianceChecker(cfg)
    raw_violations = checker.check_all(shifts, qualifications=None)

    # Bỏ các quy tắc cần session (cấp tháng không có session)
    _SKIP_RULES = {
        "max_on_position", "qualification_coverage",
        "position_recency", "min_break_after_position",
    }
    macro_violations = [
        {
            "rule":             v.rule,
            "severity":         v.severity.value,
            "controller_id":    str(v.controller_id),
            "controller_name":  v.controller_name,
            "message":          v.message,
            "related_shift_ids": v.related_shift_ids,
            "legal_basis":      v.legal_basis,
        }
        for v in raw_violations
        if v.rule not in _SKIP_RULES
    ]

    # Kiểm tra on-call
    oncalls = _build_oncalls(draft)
    oncall_violations = check_oncall_limits(oncalls, cfg)
    macro_violations.extend([
        {
            "rule":             v.rule,
            "severity":         v.severity.value,
            "controller_id":    str(v.controller_id),
            "controller_name":  v.controller_name,
            "message":          v.message,
            "related_shift_ids": v.related_shift_ids,
            "legal_basis":      v.legal_basis,
        }
        for v in oncall_violations
    ])

    coverage_warnings = _check_qualification_coverage_per_day(draft)
    can_publish = not any(v["severity"] == Severity.CRITICAL.value for v in macro_violations)

    return MacroReviewResult(
        can_publish=can_publish,
        violations=macro_violations,
        suggestions=[],
        coverage_warnings=coverage_warnings,
    )
