"""
routers/roster.py
=================
- POST /analytics/roster/review         — rà soát từ DB (đã lưu lịch)
- POST /analytics/roster/review-draft   — rà soát bảng phân vị trí cấp ca (từ DetailedRosterModal)
- POST /analytics/roster/checklist      — sinh checklist QĐ 2288 Phụ lục I cấp ca
- POST /analytics/roster/macro/review   — rà soát phân ca cấp tháng (từ SchedulerScreen)
- POST /analytics/roster/macro/checklist — sinh checklist cấp tháng
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.compliance.rest_compliance import (
    ComplianceChecker, Position, PositionSession, Qualification,
    RestRuleConfig, Severity, Shift, ShiftKind, classify_shift_kind,
    AUXILIARY_POSITIONS,
)
from app.core.domain import RestRuleConfig as _cfg_alias  # noqa
from app.data.database import get_session
from app.data.repository import QualificationRepository, ShiftRepository
from app.review.roster_review import RosterReviewer

router = APIRouter(prefix="/analytics/roster", tags=["roster"])


# ---------------------------------------------------------------------------
# Shared out models
# ---------------------------------------------------------------------------

class ViolationOut(BaseModel):
    rule:              str
    severity:          str
    controller_id:     str
    controller_name:   str
    message:           str
    related_shift_ids: list[str]
    legal_basis:       str = ""


class SuggestionOut(BaseModel):
    kind:      str
    severity:  str
    message:   str
    shift_ids: list[str]


# ---------------------------------------------------------------------------
# /review — rà soát từ DB
# ---------------------------------------------------------------------------

class RosterReviewRequest(BaseModel):
    month_key: str | None = None


class RosterReviewResponse(BaseModel):
    can_publish: bool
    violations:  list[ViolationOut]
    suggestions: list[SuggestionOut]


@router.post("/review", response_model=RosterReviewResponse)
def roster_review(
    req: RosterReviewRequest,
    db: Session = Depends(get_session),
) -> RosterReviewResponse:
    shifts = ShiftRepository(db).load_shifts(month_key=req.month_key)
    quals  = QualificationRepository(db).load_qualifications()
    cfg    = RestRuleConfig()
    result = RosterReviewer(cfg).review(shifts, quals)
    return RosterReviewResponse(
        can_publish=result.can_publish,
        violations=[
            ViolationOut(
                rule=v.rule, severity=v.severity.name,
                controller_id=str(v.controller_id), controller_name=v.controller_name,
                message=v.message,
                related_shift_ids=[str(i) for i in v.related_shift_ids],
                legal_basis=getattr(v, "legal_basis", ""),
            )
            for v in result.violations
        ],
        suggestions=[
            SuggestionOut(
                kind=s.kind, severity=s.severity.name,
                message=s.message, shift_ids=[str(i) for i in s.shift_ids],
            )
            for s in result.suggestions
        ],
    )


# ---------------------------------------------------------------------------
# /review-draft — rà soát bảng phân vị trí cấp ca (DetailedRosterModal)
# ---------------------------------------------------------------------------

class ControllerInfo(BaseModel):
    abbr:          str
    id:            str
    name:          str
    qualification: str = ""


class RosterRow(BaseModel):
    """Một hàng trong bảng phân vị trí. Key 'time' = "HHMM-HHMM"; các key còn lại = vị trí."""
    time:        str = ""
    assignments: dict[str, str] = {}
    # Cho phép nhận format flat (time + position keys trực tiếp) qua extra fields
    model_config = {"extra": "allow"}


class RosterDraft(BaseModel):
    team:        str
    shift_code:  str
    shift_date:  str          # YYYY-MM-DD
    rows:        list[RosterRow]
    controllers: list[ControllerInfo] = []


class DraftReviewResult(BaseModel):
    can_publish:          bool
    violations:           list[ViolationOut]
    suggestions:          list[dict]
    unknown_abbreviations: list[str]


def _parse_hhmm(s: str) -> int:
    """'0700' → 420 phút."""
    s = s.strip().replace(":", "")
    return int(s[:2]) * 60 + int(s[2:4])


def _to_position(pos_str: str) -> Position | None:
    """'CTL' → Position.CTL, bỏ qua nếu không nhận ra."""
    try:
        return Position(pos_str.strip().upper())
    except ValueError:
        return None


def convert_draft(
    draft: RosterDraft,
    cfg: RestRuleConfig | None = None,
) -> tuple[list[Shift], dict[str, Qualification], list[str]]:
    """Chuyển RosterDraft thành list[Shift] + qualifications + unknown_abbreviations.

    Mỗi KSVKL trong bảng sẽ có 1 Shift chứa nhiều PositionSession (các phiên vị trí).
    """
    cfg = cfg or RestRuleConfig()
    base_date = datetime.strptime(draft.shift_date, "%Y-%m-%d")

    # Bảng abbr → ControllerInfo
    ctrl_by_abbr: dict[str, ControllerInfo] = {c.abbr.upper(): c for c in draft.controllers}

    # Thu thập sessions theo abbr: abbr → [(position, start_dt, end_dt)]
    sessions_by_abbr: dict[str, list[tuple[Position, datetime, datetime]]] = {}
    unknown_abbrs: set[str] = set()

    prev_end_min: int | None = None
    day_offset = 0   # tăng 1 khi vòng qua midnight

    for row in draft.rows:
        # Lấy time từ trường time hoặc từ extra fields
        time_str = row.time or (row.model_extra or {}).get("time", "")
        if not time_str or "-" not in time_str:
            continue

        parts = time_str.split("-")
        if len(parts) != 2:
            continue
        start_min = _parse_hhmm(parts[0])
        end_min   = _parse_hhmm(parts[1])

        # Xử lý qua midnight: end_min < start_min khi slot "2300-0000"
        if end_min < start_min:
            end_min += 24 * 60

        # Phát hiện nhảy ngày khi start_min < prev_end_min (wrap around midnight)
        if prev_end_min is not None and start_min < prev_end_min % (24 * 60):
            day_offset += 1

        slot_start = base_date + timedelta(days=day_offset, minutes=start_min)
        slot_end   = base_date + timedelta(days=day_offset, minutes=end_min)
        prev_end_min = end_min + day_offset * 24 * 60

        # Đọc assignments: từ model_extra (flat row format) hoặc assignments dict
        pos_map: dict[str, str] = {}
        extra = row.model_extra or {}
        for k, v in extra.items():
            if k != "time":
                pos_map[k.upper()] = str(v).strip().upper()
        for k, v in (row.assignments or {}).items():
            pos_map[k.upper()] = str(v).strip().upper()

        for pos_str, abbr_raw in pos_map.items():
            if not abbr_raw:
                continue
            # Abbr có thể là "ABC DEF" (nhiều người, lấy tất cả)
            codes = [x.strip().upper() for x in abbr_raw.replace(",", " ").split() if x.strip()]
            for abbr in codes:
                pos_obj = _to_position(pos_str)
                if pos_obj is None or pos_obj in AUXILIARY_POSITIONS:
                    continue
                if abbr not in ctrl_by_abbr:
                    unknown_abbrs.add(abbr)
                sessions_by_abbr.setdefault(abbr, []).append(
                    (pos_obj, slot_start, slot_end)
                )

    # Dựng Shift + Qualification
    shifts: list[Shift] = []
    qualifications: dict[str, Qualification] = {}

    for i, (abbr, sess_list) in enumerate(sessions_by_abbr.items(), start=1):
        ctrl = ctrl_by_abbr.get(abbr)
        cid   = ctrl.id if ctrl else abbr
        cname = ctrl.name if ctrl else abbr

        shift_start = min(s for _, s, _ in sess_list)
        shift_end   = max(e for _, _, e in sess_list)
        kind = classify_shift_kind(shift_start, shift_end, cfg)

        sessions_objs = [
            PositionSession(position=p, start=s, end=e)
            for p, s, e in sess_list
        ]
        shifts.append(Shift(
            shift_id=i,
            controller_id=cid,
            controller_name=cname,
            start=shift_start,
            end=shift_end,
            is_night=(kind == ShiftKind.NIGHT),
            kind=kind,
            sessions=sessions_objs,
        ))

        if ctrl:
            is_full = ctrl.qualification.strip().lower() in ("full", "")
            pos_set: frozenset[Position] = frozenset()
            if not is_full:
                pos_set = frozenset(
                    p for pv in ctrl.qualification.upper().split(",")
                    if (p := _to_position(pv.strip())) is not None
                )
            qualifications[cid] = Qualification(
                controller_id=cid,
                is_full=is_full,
                positions=pos_set,
                controller_name=cname,
            )

    return shifts, qualifications, sorted(unknown_abbrs)


@router.post("/review-draft", response_model=DraftReviewResult)
def review_roster_draft(draft: RosterDraft) -> DraftReviewResult:
    """Rà soát bảng phân vị trí cấp ca (DetailedRosterModal). QĐ 2288 + QĐ 2701."""
    cfg = RestRuleConfig()
    shifts, qualifications, unknown_abbrs = convert_draft(draft, cfg)
    checker = ComplianceChecker(cfg)
    violations = checker.check_all(shifts, qualifications if qualifications else None)

    can_publish = not any(v.severity == Severity.CRITICAL for v in violations)

    return DraftReviewResult(
        can_publish=can_publish,
        violations=[
            ViolationOut(
                rule=v.rule, severity=v.severity.name,
                controller_id=str(v.controller_id), controller_name=v.controller_name,
                message=v.message,
                related_shift_ids=[str(i) for i in v.related_shift_ids],
                legal_basis=v.legal_basis,
            )
            for v in violations
        ],
        suggestions=[],
        unknown_abbreviations=unknown_abbrs,
    )


# ---------------------------------------------------------------------------
# /checklist — sinh checklist QĐ 2288 Phụ lục I cấp ca
# ---------------------------------------------------------------------------

@router.post("/checklist")
def get_roster_checklist(draft: RosterDraft) -> dict:
    """Sinh checklist QĐ 2288 Phụ lục I cho một roster cấp ca."""
    from app.review.qd2288_checklist import build_checklist
    cfg = RestRuleConfig()
    shifts, qualifications, _ = convert_draft(draft, cfg)
    checker = ComplianceChecker(cfg)
    violations = checker.check_all(shifts, qualifications if qualifications else None)
    violations_dicts = [
        {"rule": v.rule, "severity": v.severity.name, "message": v.message,
         "legal_basis": v.legal_basis}
        for v in violations
    ]
    return build_checklist(violations_dicts, draft)


# ---------------------------------------------------------------------------
# /macro/review + /macro/checklist — cấp tháng (SchedulerScreen)
# ---------------------------------------------------------------------------

@router.post("/macro/review")
def review_macro(draft: Any) -> Any:
    """Rà soát phân ca cấp trung tâm (SchedulerScreen). QĐ 2288 + QĐ 2701."""
    from app.routers.schemas_macro import MacroRosterDraft, MacroReviewResult
    from app.review.chu_ky_review import review_macro_draft
    parsed = MacroRosterDraft(**draft) if isinstance(draft, dict) else draft
    return review_macro_draft(parsed)


@router.post("/macro/checklist")
def get_macro_checklist(draft: Any) -> dict:
    """Sinh checklist QĐ 2288 Phụ lục I cấp tháng."""
    from app.routers.schemas_macro import MacroRosterDraft
    from app.review.chu_ky_review import review_macro_draft
    from app.review.qd2288_checklist import build_checklist
    parsed = MacroRosterDraft(**draft) if isinstance(draft, dict) else draft
    result = review_macro_draft(parsed)
    return build_checklist(result.violations, parsed)
