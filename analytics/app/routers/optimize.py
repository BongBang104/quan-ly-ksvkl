"""
routers/optimize.py — POST /analytics/optimize/roster
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.domain import Position, Qualification, RestRuleConfig
from app.data.database import get_session
from app.data.repository import QualificationRepository
from app.optimize.shift_optimizer import (
    ControllerProfile, OptimizationResult, ShiftOptimizer, ShiftSlot,
)

router = APIRouter(prefix="/analytics/optimize", tags=["optimize"])

_QUAL_STR_MAP = {
    "full": (True, set()),
    "ctl":  (False, {Position.CTL}),
    "app":  (False, {Position.APP}),
    "twr":  (False, {Position.TWR}),
    "gcu":  (False, {Position.GCU}),
    "twr/app": (False, {Position.TWR, Position.APP}),
    "app/twr": (False, {Position.TWR, Position.APP}),
}


def _parse_qual(cid: str, qual_str: str, name: str = "") -> Qualification:
    key = qual_str.strip().lower()
    is_full, positions = _QUAL_STR_MAP.get(key, (False, set()))
    return Qualification(
        controller_id=cid, is_full=is_full,
        positions=frozenset(positions), controller_name=name,
    )


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class SlotIn(BaseModel):
    slot_id:            str
    start:              datetime
    end:                datetime
    is_night:           bool = False
    required_positions: list[str] = []   # position values, e.g. ["TWR", "APP"]

    @field_validator("required_positions")
    @classmethod
    def validate_positions(cls, v: list[str]) -> list[str]:
        valid = {p.value for p in Position}
        for pos in v:
            if pos.upper() not in valid:
                raise ValueError(f"Unknown position: {pos}")
        return [p.upper() for p in v]


class ControllerIn(BaseModel):
    controller_id:   str
    controller_name: str
    qualification:   str        # "FULL" | "TWR" | "APP" | "CTL" | "GCU" | "TWR/APP"
    unavailable_dates: list[str] = []   # YYYY-MM-DD


class OptimizeRequest(BaseModel):
    slots:               list[SlotIn]
    controllers:         list[ControllerIn] | None = None
    # None = load tất cả KSVKL active từ DB
    time_limit_seconds:  int = 30


class ViolationOut(BaseModel):
    rule:            str
    severity:        str
    controller_id:   str
    controller_name: str
    message:         str


class OptimizeResponse(BaseModel):
    status:               str
    assignments:          dict[str, str]
    unassigned_slots:     list[str]
    compliance_violations: list[ViolationOut]
    has_critical:         bool
    metrics:              dict[str, Any]
    solver_used:          str
    note:                 str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/roster", response_model=OptimizeResponse)
def optimize_roster(
    req: OptimizeRequest,
    db: Session = Depends(get_session),
) -> OptimizeResponse:
    """Tìm phương án phân ca tối ưu có ràng buộc.

    LƯU Ý: kết quả là ĐỀ XUẤT — kíp trưởng phải duyệt trước khi áp dụng.
    Mọi ngưỡng chỉ là ví dụ, cần thay bằng số liệu VATM/CAAV/ICAO chính thức.
    """
    from datetime import date as date_type

    # Build ShiftSlots
    slots = [
        ShiftSlot(
            slot_id=s.slot_id,
            start=s.start,
            end=s.end,
            is_night=s.is_night,
            required_positions=[Position(p) for p in s.required_positions],
        )
        for s in req.slots
    ]

    # Build ControllerProfiles
    if req.controllers is not None:
        profiles = [
            ControllerProfile(
                controller_id=c.controller_id,
                controller_name=c.controller_name,
                qualification=_parse_qual(c.controller_id, c.qualification, c.controller_name),
                unavailable_dates=frozenset(
                    date_type.fromisoformat(d) for d in c.unavailable_dates
                ),
            )
            for c in req.controllers
        ]
    else:
        # Load từ DB
        quals = QualificationRepository(db).load_qualifications()
        profiles = [
            ControllerProfile(
                controller_id=cid,
                controller_name=q.controller_name,
                qualification=q,
            )
            for cid, q in quals.items()
            if q.is_active
        ]

    cfg = RestRuleConfig()
    result = ShiftOptimizer(cfg).optimize(slots, profiles, req.time_limit_seconds)

    from app.core.domain import Severity
    violations_out = [
        ViolationOut(
            rule=v.rule,
            severity=v.severity.name,
            controller_id=str(v.controller_id),
            controller_name=v.controller_name,
            message=v.message,
        )
        for v in result.compliance_violations
    ]
    has_critical = any(v.severity.name == "CRITICAL" for v in result.compliance_violations)

    return OptimizeResponse(
        status=result.status,
        assignments=result.assignments,
        unassigned_slots=result.unassigned_slots,
        compliance_violations=violations_out,
        has_critical=has_critical,
        metrics=result.metrics,
        solver_used=result.solver_used,
        note=result.note,
    )
