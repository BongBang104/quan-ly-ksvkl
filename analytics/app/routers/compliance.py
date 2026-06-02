"""
routers/compliance.py — POST /analytics/compliance/check
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.domain import ComplianceChecker, RestRuleConfig, format_report
from app.data.database import get_session
from app.data.repository import QualificationRepository, ShiftRepository

router = APIRouter(prefix="/analytics/compliance", tags=["compliance"])


class ComplianceRequest(BaseModel):
    month_key: str | None = None
    include_report: bool = False


class ViolationOut(BaseModel):
    rule:              str
    severity:          str
    controller_id:     str
    controller_name:   str
    message:           str
    related_shift_ids: list[str]
    legal_basis:       str = ""   # QĐ 2288 / QĐ 2701 citation


class ComplianceResponse(BaseModel):
    violation_count: int
    violations:      list[ViolationOut]
    report:          str | None = None


@router.post("/check", response_model=ComplianceResponse)
def check_compliance(
    req: ComplianceRequest,
    db: Session = Depends(get_session),
) -> ComplianceResponse:
    shifts = ShiftRepository(db).load_shifts(month_key=req.month_key)
    quals  = QualificationRepository(db).load_qualifications()
    cfg    = RestRuleConfig()
    violations = ComplianceChecker(cfg).check_all(shifts, quals)
    out = [
        ViolationOut(
            rule=v.rule,
            severity=v.severity.name,
            controller_id=str(v.controller_id),
            controller_name=v.controller_name,
            message=v.message,
            related_shift_ids=[str(i) for i in v.related_shift_ids],
            legal_basis=v.legal_basis,
        )
        for v in violations
    ]
    report = format_report(violations) if req.include_report else None
    return ComplianceResponse(violation_count=len(out), violations=out, report=report)
