"""
exchange.py
===========
Pre-check đổi ca: mô phỏng việc đổi ca, kiểm tra vi phạm tiềm năng.

Quy trình:
1. Nhận lịch hiện tại của 2 người (gửi từ NestJS).
2. Mô phỏng: gỡ shift đổi đi, thêm shift nhận vào cho từng người.
3. Chạy ComplianceChecker trước (baseline) và sau (after) khi đổi.
4. Diff: vi phạm MỚI phát sinh do việc đổi (bỏ qua vi phạm sẵn có).
5. Kiểm tra năng định tương đương (QĐ 2701 Điều 8.1.b) — chặn nếu không khớp.

Đầu ra:
- can_approve=false chỉ khi vi phạm CRITICAL hoặc năng định không tương đương.
- warnings chứa vi phạm WARNING mới — kíp trưởng đánh giá, có thể ghi đè.
- qualification_check chi tiết năng định 2 bên.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.compliance.rest_compliance import (
    ComplianceChecker, PositionSession, Position, Qualification,
    RestRuleConfig, Severity, Shift, ShiftKind, classify_shift_kind,
)

router = APIRouter(prefix="/analytics/exchange", tags=["exchange"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ShiftRef(BaseModel):
    date:       str = Field(..., description="YYYY-MM-DD")
    code:       str = Field(..., description="S | D")
    start_hour: int | None = None
    end_hour:   int | None = None


class ExistingShift(BaseModel):
    date:       str
    code:       str
    start_hour: int | None = None
    end_hour:   int | None = None


class ControllerForExchange(BaseModel):
    id:            str
    name:          str
    qualification: str = Field(..., description='"Full" hoặc danh sách: "APP,CTL"')


class PrecheckExchangeInput(BaseModel):
    type:        str = Field(..., description='"EXCHANGE" (có hoàn trả) hoặc "COVER" (trực thay)')
    applicant:   ControllerForExchange
    counterparty: ControllerForExchange
    applicant_shift:    ShiftRef
    counterparty_shift: ShiftRef | None = Field(
        None, description="Ca counterparty hoàn trả. Bắt buộc nếu type=EXCHANGE."
    )
    applicant_current_shifts:    list[ExistingShift] = []
    counterparty_current_shifts: list[ExistingShift] = []


class PrecheckViolation(BaseModel):
    rule:            str
    severity:        str
    controller_id:   str
    controller_name: str
    message:         str
    legal_basis:     str = ""


class QualificationCheckResult(BaseModel):
    applicant_has_required:    bool
    counterparty_has_required: bool
    required_for_applicant:    str = ""
    required_for_counterparty: str = ""
    legal_basis:               str = "QĐ 2701 Điều 8.1.b"


class PrecheckExchangeOutput(BaseModel):
    can_approve:                  bool
    qualification_check:          QualificationCheckResult
    new_violations_applicant:     list[PrecheckViolation] = []
    new_violations_counterparty:  list[PrecheckViolation] = []
    warnings:                     list[str] = []
    notes:                        list[str] = []


# ── Logic ────────────────────────────────────────────────────────────────────

_DEFAULT_SHIFT_HOURS: dict[str, tuple[int, int]] = {
    "S": (7, 19),
    "D": (19, 31),   # 31 = 24+7, ca qua nửa đêm
}


def _parse_qualification(cid: str, qual_str: str) -> Qualification:
    s = (qual_str or "").strip()
    if not s or s.lower() == "full":
        return Qualification(controller_id=cid, is_full=True)
    positions: set[Position] = set()
    for token in s.split(","):
        token = token.strip().upper()
        try:
            positions.add(Position(token))
        except ValueError:
            pass
    return Qualification(controller_id=cid, is_full=False, positions=frozenset(positions))


def _to_shift(
    ctrl_id: str, ctrl_name: str, shift_id: int,
    date_str: str, code: str,
    start_h: int | None, end_h: int | None,
    cfg: RestRuleConfig,
) -> Shift | None:
    """Quy đổi 1 ca cấp tháng → domain Shift."""
    code_upper = code.upper()
    if code_upper in ("OFF", "LEAVE", "TRAINING", "ONCALL", ""):
        return None
    if start_h is not None and end_h is not None:
        hours: tuple[int, int] = (start_h, end_h)
    else:
        hours = _DEFAULT_SHIFT_HOURS.get(code_upper)
        if hours is None:
            return None
    base     = datetime.fromisoformat(date_str).replace(hour=0, minute=0, second=0, microsecond=0)
    sh_start = base + timedelta(hours=hours[0])
    sh_end   = base + timedelta(hours=hours[1])
    kind     = classify_shift_kind(sh_start, sh_end, cfg)
    return Shift(
        shift_id=shift_id,
        controller_id=ctrl_id,
        controller_name=ctrl_name,
        start=sh_start,
        end=sh_end,
        is_night=(kind == ShiftKind.NIGHT),
        kind=kind,
        sessions=[],
    )


def _build_shifts(
    ctrl_id: str, ctrl_name: str,
    shifts_data: list[ExistingShift | dict],
    cfg: RestRuleConfig,
    id_offset: int = 0,
) -> list[Shift]:
    out: list[Shift] = []
    for i, sh in enumerate(shifts_data, start=id_offset + 1):
        if isinstance(sh, dict):
            d, c = sh["date"], sh["code"]
            sh_h, eh = sh.get("start_hour"), sh.get("end_hour")
        else:
            d, c = sh.date, sh.code
            sh_h, eh = sh.start_hour, sh.end_hour
        s = _to_shift(ctrl_id, ctrl_name, i, d, c, sh_h, eh, cfg)
        if s:
            out.append(s)
    return out


def _without_shift(shifts: list[Shift], target_date: str, target_code: str) -> list[Shift]:
    """Gỡ shift trùng ngày + mã ca (so sánh date part + kind nhóm S/D)."""
    code_is_night = target_code.upper() == "D"
    return [
        s for s in shifts
        if not (
            s.start.date().isoformat() == target_date
            and bool(s.is_night) == code_is_night
        )
    ]


def _diff_violations(before: list, after: list) -> list:
    """Vi phạm mới phát sinh: cùng controller đã có vi phạm cùng rule+severity trước đổi
    thì không tính là "mới" — đó là vi phạm sẵn có, không phải do việc đổi ca gây ra."""
    before_keys = {(v.controller_id, v.rule, v.severity) for v in before}
    return [v for v in after if (v.controller_id, v.rule, v.severity) not in before_keys]


def _qualification_equivalent(a: Qualification, b: Qualification) -> bool:
    """QĐ 2701 Điều 8.1.b: năng định tương đương.

    - Full ↔ Full: tương đương.
    - Full ↔ subset: không tương đương.
    - subset ↔ subset cùng tập vị trí: tương đương.
    """
    if a.is_full and b.is_full:
        return True
    if a.is_full != b.is_full:
        return False
    return a.positions == b.positions


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/precheck", response_model=PrecheckExchangeOutput)
def precheck_exchange(inp: PrecheckExchangeInput) -> PrecheckExchangeOutput:
    """Pre-check đổi ca / trực thay. QĐ 2701 Điều 8 + QĐ 2288."""
    cfg     = RestRuleConfig()
    checker = ComplianceChecker(cfg)

    # 1. Kiểm tra năng định tương đương (QĐ 2701 Điều 8.1.b)
    qa = _parse_qualification(inp.applicant.id,    inp.applicant.qualification)
    qb = _parse_qualification(inp.counterparty.id, inp.counterparty.qualification)
    qual_ok    = _qualification_equivalent(qa, qb)
    qual_check = QualificationCheckResult(
        applicant_has_required=qual_ok,
        counterparty_has_required=qual_ok,
        required_for_applicant=inp.counterparty.qualification,
        required_for_counterparty=inp.applicant.qualification,
    )

    # 2. Validate EXCHANGE cần counterparty_shift
    if inp.type.upper() == "EXCHANGE" and inp.counterparty_shift is None:
        raise HTTPException(400, "type=EXCHANGE yêu cầu counterparty_shift để hoàn trả.")

    # 3. Build BEFORE shifts
    appl_before = _build_shifts(inp.applicant.id, inp.applicant.name,
                                inp.applicant_current_shifts, cfg, id_offset=0)
    cp_before   = _build_shifts(inp.counterparty.id, inp.counterparty.name,
                                inp.counterparty_current_shifts, cfg, id_offset=1000)

    # 4. Mô phỏng AFTER
    # Applicant gỡ ca đổi đi
    appl_after = _without_shift(appl_before, inp.applicant_shift.date, inp.applicant_shift.code)
    # Counterparty nhận ca của applicant
    new_cp_shift = _to_shift(
        inp.counterparty.id, inp.counterparty.name, 9001,
        inp.applicant_shift.date, inp.applicant_shift.code,
        inp.applicant_shift.start_hour, inp.applicant_shift.end_hour, cfg,
    )
    cp_after = list(cp_before)
    if new_cp_shift:
        cp_after = cp_after + [new_cp_shift]

    if inp.type.upper() == "EXCHANGE" and inp.counterparty_shift:
        # Counterparty gỡ ca hoàn trả
        cp_after = _without_shift(cp_after,
                                  inp.counterparty_shift.date, inp.counterparty_shift.code)
        # Applicant nhận ca hoàn trả
        new_appl_shift = _to_shift(
            inp.applicant.id, inp.applicant.name, 9002,
            inp.counterparty_shift.date, inp.counterparty_shift.code,
            inp.counterparty_shift.start_hour, inp.counterparty_shift.end_hour, cfg,
        )
        if new_appl_shift:
            appl_after = appl_after + [new_appl_shift]

    # 5. Compliance check trước/sau
    quals = {inp.applicant.id: qa, inp.counterparty.id: qb}
    appl_before_v = checker.check_all(appl_before, quals)
    appl_after_v  = checker.check_all(appl_after,  quals)
    cp_before_v   = checker.check_all(cp_before,   quals)
    cp_after_v    = checker.check_all(cp_after,    quals)

    new_appl = _diff_violations(appl_before_v, appl_after_v)
    new_cp   = _diff_violations(cp_before_v,   cp_after_v)

    # 6. Quyết định can_approve
    has_critical = any(v.severity == Severity.CRITICAL for v in new_appl + new_cp)
    can_approve  = qual_ok and not has_critical

    warnings: list[str] = []
    if not qual_ok:
        warnings.append(
            "Năng định không tương đương — không thể đổi ca (QĐ 2701 Điều 8.1.b)."
        )
    for v in new_appl + new_cp:
        if v.severity == Severity.WARNING:
            warnings.append(
                f"{v.controller_name}: {v.message}"
                + (f" ({v.legal_basis})" if v.legal_basis else "")
            )

    notes: list[str] = []
    if warnings and can_approve:
        notes.append(
            "Có cảnh báo — kíp trưởng đánh giá và có thể duyệt nếu có lý do "
            "(QĐ 2701 Điều 8.3). Ghi lý do ghi đè vào extraData.precheck_override_reason."
        )

    def _to_pv(v) -> PrecheckViolation:
        return PrecheckViolation(
            rule=v.rule, severity=v.severity.value,
            controller_id=str(v.controller_id), controller_name=v.controller_name,
            message=v.message, legal_basis=v.legal_basis,
        )

    return PrecheckExchangeOutput(
        can_approve=can_approve,
        qualification_check=qual_check,
        new_violations_applicant=[_to_pv(v) for v in new_appl],
        new_violations_counterparty=[_to_pv(v) for v in new_cp],
        warnings=warnings,
        notes=notes,
    )
