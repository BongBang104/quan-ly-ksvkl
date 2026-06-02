"""
exchange.py
===========
Pre-check đổi ca: mô phỏng việc đổi ca, kiểm tra vi phạm tiềm năng.
QĐ 2701 Điều 8 + QĐ 2288.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/analytics/exchange", tags=["exchange"])


class ShiftRef(BaseModel):
    date: str     # YYYY-MM-DD
    code: str     # S, D, ...


class PrecheckExchangeInput(BaseModel):
    applicant_id:   str
    applicant_name: str
    counterparty_id:   str
    counterparty_name: str
    applicant_shift:   ShiftRef
    counterparty_shift: ShiftRef | None = None
    applicant_current_shifts:   list[dict] = []
    counterparty_current_shifts: list[dict] = []


@router.post("/precheck")
def precheck_exchange(inp: PrecheckExchangeInput):
    """Mô phỏng đổi ca, kiểm tra vi phạm tiềm năng. QĐ 2288 + QĐ 2701 Điều 8.

    STUB: trả về cấu trúc mẫu. Triển khai đầy đủ ở Phase E.
    """
    return {
        "violations_applicant":   [],
        "violations_counterparty": [],
        "can_approve": True,
        "warnings": [],
    }
