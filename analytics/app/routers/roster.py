"""
routers/roster.py — POST /analytics/roster/review
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.domain import RestRuleConfig
from app.data.database import get_session
from app.data.repository import QualificationRepository, ShiftRepository
from app.review.roster_review import RosterReviewer

router = APIRouter(prefix="/analytics/roster", tags=["roster"])


class RosterReviewRequest(BaseModel):
    month_key: str | None = None


class SuggestionOut(BaseModel):
    kind:      str
    severity:  str
    message:   str
    shift_ids: list[str]


class ViolationOut(BaseModel):
    rule:              str
    severity:          str
    controller_id:     str
    controller_name:   str
    message:           str
    related_shift_ids: list[str]


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
                rule=v.rule,
                severity=v.severity.name,
                controller_id=str(v.controller_id),
                controller_name=v.controller_name,
                message=v.message,
                related_shift_ids=[str(i) for i in v.related_shift_ids],
            )
            for v in result.violations
        ],
        suggestions=[
            SuggestionOut(
                kind=s.kind,
                severity=s.severity.name,
                message=s.message,
                shift_ids=[str(i) for i in s.shift_ids],
            )
            for s in result.suggestions
        ],
    )
