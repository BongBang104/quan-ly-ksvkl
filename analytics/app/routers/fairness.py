"""
routers/fairness.py — POST /analytics/fairness/summary
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.data.database import get_session
from app.data.repository import ShiftRepository
from app.fairness.fairness import compute_fairness

router = APIRouter(prefix="/analytics/fairness", tags=["fairness"])


class FairnessRequest(BaseModel):
    month_key: str | None = None


class ControllerStatsOut(BaseModel):
    controller_id:   str
    controller_name: str
    total_hours:     float
    night_shifts:    int
    shift_count:     int
    work_days:       int


class FairnessResponse(BaseModel):
    avg_hours:       float
    std_hours:       float
    max_delta_hours: float
    controllers:     list[ControllerStatsOut]


@router.post("/summary", response_model=FairnessResponse)
def fairness_summary(
    req: FairnessRequest,
    db: Session = Depends(get_session),
) -> FairnessResponse:
    shifts  = ShiftRepository(db).load_shifts(month_key=req.month_key)
    summary = compute_fairness(shifts)
    return FairnessResponse(
        avg_hours=summary.avg_hours,
        std_hours=summary.std_hours,
        max_delta_hours=summary.max_delta_hours,
        controllers=[ControllerStatsOut(**s.to_dict()) for s in summary.stats],
    )
