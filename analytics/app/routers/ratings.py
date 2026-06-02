"""
routers/ratings.py
GET /analytics/ratings/expiring?days=60
GET /analytics/ratings/coverage?min_required=2
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.data.database import get_session
from app.data.repository import QualificationRepository
from app.ratings.rating_status import (
    DEFAULT_CRITICAL_DAYS,
    DEFAULT_MIN_COVERAGE,
    DEFAULT_WARN_DAYS,
    NOTE_AUXILIARY,
    compute_coverage,
    compute_expiry_alerts,
)

router = APIRouter(prefix="/analytics/ratings", tags=["ratings"])


class ExpiryAlertOut(BaseModel):
    controller_id:       str
    controller_name:     str
    qualification_label: str
    expires_at:          str | None
    days_remaining:      int | None
    severity:            str


class ExpiringResponse(BaseModel):
    warn_days:   int
    alert_count: int
    alerts:      list[ExpiryAlertOut]


@router.get("/expiring", response_model=ExpiringResponse)
def expiring_ratings(
    days: int = Query(default=DEFAULT_WARN_DAYS, ge=0, le=365,
                      description="Cảnh báo nếu hết hạn trong vòng N ngày"),
    critical_days: int = Query(default=DEFAULT_CRITICAL_DAYS, ge=0),
    db: Session = Depends(get_session),
) -> ExpiringResponse:
    quals = QualificationRepository(db).load_qualifications()
    alerts = compute_expiry_alerts(quals, warn_days=days, critical_days=critical_days)
    return ExpiringResponse(
        warn_days=days,
        alert_count=len(alerts),
        alerts=[ExpiryAlertOut(**a.to_dict()) for a in alerts],
    )


class PositionCoverageOut(BaseModel):
    position:        str
    position_label:  str = ""   # nhãn tiếng Việt, vd "Tiếp cận (APP)"
    qualified_count: int
    active_count:    int
    is_sufficient:   bool


class CoverageResponse(BaseModel):
    as_of:                  str
    total_controllers:      int
    total_active_full:      int
    insufficient_positions: list[str]
    positions:              list[PositionCoverageOut]
    note_auxiliary:         str = ""   # ghi chú về vị trí phụ trợ không tính trong phủ sóng


@router.get("/coverage", response_model=CoverageResponse)
def coverage_report(
    min_required: int = Query(default=DEFAULT_MIN_COVERAGE, ge=1,
                              description="Số người đủ năng định tối thiểu mỗi vị trí"),
    db: Session = Depends(get_session),
) -> CoverageResponse:
    quals = QualificationRepository(db).load_qualifications()
    report = compute_coverage(quals, min_required=min_required)
    d = report.to_dict()
    return CoverageResponse(
        as_of=d["as_of"],
        total_controllers=d["total_controllers"],
        total_active_full=d["total_active_full"],
        insufficient_positions=d["insufficient_positions"],
        positions=[PositionCoverageOut(**p) for p in d["positions"]],
        note_auxiliary=NOTE_AUXILIARY,
    )
