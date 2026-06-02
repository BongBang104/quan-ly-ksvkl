# PLAN_SPRINT_NEXT — Dọn ví dụ + Precheck đổi ca thật + Module Deviation

> **Tiếp nối** sau khi PLAN_INTEGRATION_V2 và PLAN_TAB_BAO_CAO đã hoàn thành.
>
> Sprint này có 3 phần độc lập, có thể làm song song:
> - **Phần X** — Dọn 2 chỗ "ví dụ" còn sót (5 phút).
> - **Phần Y** — Triển khai Precheck đổi ca thật, thay stub hiện có (1-2 ngày).
> - **Phần Z** — Module Deviation theo QĐ 2289 Chương IV (3-4 ngày).
>
> Nguyên tắc xuyên suốt (giữ từ các PLAN trước):
> 1. **QĐ 2288 là gốc**, QĐ 2701/2289 bám theo.
> 2. **Mỗi cảnh báo có `legal_basis`** viện dẫn điều luật.
> 3. **Không refactor** ngoài phạm vi từng mục. Trước khi sửa file lớn, `view` nguyên file.
> 4. **Just Culture**: deviation không tự động là vi phạm — đó là quy trình hợp pháp được QĐ 2288 Điều 19 + QĐ 2289 Chương IV cho phép trong tình huống khẩn cấp.
> 5. **Sau mỗi mục:** chạy bước Xác minh **thật**, ghi `[DONE] Mục N — <tên> — <ngày>` vào `CHANGELOG_SPRINT_NEXT.md`.

---

# PHẦN X — Dọn 2 chỗ "ví dụ" còn sót

CHANGELOG_TAB_BAO_CAO ghi *"Không còn chuỗi 'giá trị ví dụ' trong analytics code"* nhưng còn 2 dòng docstring lạc hậu. Cần dọn nhanh để CHANGELOG khớp thực tế.

## Mục X1 — `analytics/app/routers/optimize.py`

`view` dòng 101-115. Tìm chuỗi:

```
Mọi ngưỡng chỉ là ví dụ, cần thay bằng số liệu VATM/CAAV/ICAO chính thức.
```

Đây là dòng cuối trong docstring của `optimize_roster()`. Thay bằng:

```
Áp dụng giới hạn theo QĐ 2288/QĐ-QLB ngày 25/3/2026 — xem
RestRuleConfig.effective_from. CP-SAT solver bám 5 ràng buộc cứng:
nghỉ ≥ 12h giữa hai ca (Điều 13.1), ≤ 3 ca đêm liên tiếp (Điều 15.1.b),
nghỉ ≥ 48h sau chuỗi đêm (Điều 15.1.c), ≤ 6 ngày làm liên tiếp (Điều 12.2),
≤ 180h trong 30 ngày (Điều 12.1).
```

Lý do: dòng cũ lạc hậu so với code thật — solver đã có đủ 5 ràng buộc trong `shift_optimizer.py`. Docstring nên phản ánh đúng.

**Xác minh:** `grep "ví dụ" analytics/app/routers/optimize.py` không có match.

## Mục X2 — `analytics/app/ratings/rating_status.py`

`view` dòng 1-15. Tìm chuỗi:

```
- Ngưỡng ngày cảnh báo CHỈ LÀ VÍ DỤ — thay bằng số liệu VATM/CAAV/ICAO chính thức.
- Đây là CÔNG CỤ HỖ TRỢ. Người phụ trách vẫn chịu trách nhiệm cuối cùng.
```

Thay bằng:

```
- Ngưỡng ngày cảnh báo được cấu hình tại runtime (dropdown 30/60/90 ngày
  trong QualificationsTab). Khi có quy chế năng định nội bộ chính thức của
  VATM, cập nhật default tại đây kèm citation điều luật cụ thể.
- Đây là CÔNG CỤ HỖ TRỢ — quyết định cuối thuộc người phụ trách năng định.
```

**Xác minh:** `grep -rn "ví dụ\|VATM/CAAV/ICAO" analytics/app/` không trả về kết quả nào ngoài CHANGELOG (lịch sử).

## Mục X3 — Cập nhật CHANGELOG đối chiếu thực tế

**File:** `CHANGELOG_TAB_BAO_CAO.md`

Thêm dòng dưới mục B4:

```
[DONE] Mục B4.1 — 5 ràng buộc QĐ 2288 trong CP-SAT solver — <ngày làm B4 thực tế>
- shift_optimizer.py có đủ 5 hard constraints
- Điều 13.1 (rest 12h), 15.1.b (max 3 night consec), 15.1.c (rest 48h after night),
  12.2 (max 6 consec days), 12.1 (180h/30 days)
- (CHANGELOG ban đầu thiếu dòng này; bổ sung khi rà soát)
```

Và sửa dòng tổng kết:
```
- Không còn chuỗi "ví dụ" trong analytics code chính
```
thành:
```
- Không còn chuỗi "ví dụ"/"VATM/CAAV/ICAO" trong analytics code
  (đã dọn 2 chỗ sót ở Sprint Next: optimize.py + rating_status.py)
```

**Xác minh:** đọc CHANGELOG_TAB_BAO_CAO khớp với code thực tế.

---

# PHẦN Y — Precheck đổi ca thật

Hiện `analytics/app/routers/exchange.py` là stub trả `can_approve=True` mãi. Cần triển khai logic thực: mô phỏng việc đổi ca, chạy `ComplianceChecker` lên 2 người trước và sau khi đổi, so sánh xem có *thêm* vi phạm mới không.

## Tinh thần thiết kế

Quan trọng: **không chặn cứng**. Đổi ca có thể tạo vi phạm tạm thời (vd. một người 3 ca đêm liên tiếp do hoán đổi) — đó là chuyện kíp trưởng phải đánh giá. Kết quả precheck:
- `can_approve=true` + `warnings=[]` → đổi ca sạch.
- `can_approve=true` + `warnings=[...]` → có cảnh báo nhưng không vi phạm CRITICAL.
- `can_approve=false` → có vi phạm CRITICAL (vd. năng định không tương đương — QĐ 2701 Điều 8.1.b).

Quyết định cuối thuộc kíp trưởng. UI hiển thị rõ "có cảnh báo — vẫn có thể duyệt nhưng phải ghi rõ lý do trong `extraData.precheck_override_reason`".

## Mục Y1 — Mở rộng schema precheck

**File:** `analytics/app/routers/exchange.py`

Thay toàn bộ nội dung bằng:

```python
"""
exchange.py
===========
Pre-check đổi ca: mô phỏng việc đổi ca, kiểm tra vi phạm tiềm năng.

Quy trình:
1. Nhận lịch hiện tại của 2 người (30 ngày trước + 30 ngày sau ngày đổi).
2. Mô phỏng việc đổi: gỡ shift của applicant, thêm shift mới (counterparty shift)
   và ngược lại với counterparty.
3. Chạy ComplianceChecker lên 2 người trước (baseline) và sau (after) khi đổi.
4. Diff: liệt kê vi phạm MỚI phát sinh do việc đổi (không tính vi phạm sẵn có).
5. Kiểm tra năng định tương đương (QĐ 2701 Điều 8.1.b) — chặn nếu không khớp.

Đầu ra:
- `can_approve=false` chỉ khi có vi phạm CRITICAL hoặc năng định không tương đương.
- `warnings` chứa các vi phạm WARNING mới phát sinh — kíp trưởng đánh giá.
- `qualification_check` chi tiết năng định 2 bên.
"""
from __future__ import annotations
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.compliance.rest_compliance import (
    ComplianceChecker, RestRuleConfig, Shift, PositionSession,
    Position, Qualification, ShiftKind, classify_shift_kind, Severity,
)

router = APIRouter(prefix="/analytics/exchange", tags=["exchange"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class ShiftRef(BaseModel):
    """Tham chiếu 1 ca trực cấp tháng."""
    date: str = Field(..., description="YYYY-MM-DD")
    code: str = Field(..., description="S | D")
    start_hour: int | None = None
    end_hour:   int | None = None


class ExistingShift(BaseModel):
    """Một ca có sẵn trong lịch của KSVKL (gửi từ NestJS)."""
    date: str
    code: str
    start_hour: int | None = None
    end_hour:   int | None = None


class ControllerForExchange(BaseModel):
    id:   str
    name: str
    qualification: str = Field(..., description='"Full" hoặc danh sách: "APP,CTL"')


class PrecheckExchangeInput(BaseModel):
    """Đầu vào: thông tin 2 KSVKL + lịch hiện tại + ca dự kiến đổi."""
    type: str = Field(..., description='"EXCHANGE" (có hoàn trả) hoặc "COVER" (trực thay)')

    applicant: ControllerForExchange
    counterparty: ControllerForExchange

    applicant_shift:    ShiftRef = Field(..., description="Ca applicant muốn nhường")
    counterparty_shift: ShiftRef | None = Field(
        None, description="Ca counterparty hoàn trả cho applicant. Bắt buộc nếu type=EXCHANGE."
    )

    applicant_current_shifts:   list[ExistingShift] = []
    counterparty_current_shifts: list[ExistingShift] = []


class PrecheckViolation(BaseModel):
    rule: str
    severity: str
    controller_id: str
    controller_name: str
    message: str
    legal_basis: str = ""


class QualificationCheckResult(BaseModel):
    applicant_has_required:    bool
    counterparty_has_required: bool
    required_for_applicant:    str = ""
    required_for_counterparty: str = ""
    legal_basis: str = "QĐ 2701 Điều 8.1.b"


class PrecheckExchangeOutput(BaseModel):
    can_approve: bool
    qualification_check: QualificationCheckResult
    new_violations_applicant:    list[PrecheckViolation] = []
    new_violations_counterparty: list[PrecheckViolation] = []
    warnings: list[str] = []
    notes: list[str] = []


# ── Logic ───────────────────────────────────────────────────────────────────

DEFAULT_SHIFT_HOURS = {"S": (7, 19), "D": (19, 31)}  # 31 = 24+7 (qua nửa đêm)


def _parse_qualification(cid: str, qual_str: str) -> Qualification:
    s = (qual_str or "").strip()
    if s.lower() == "full":
        return Qualification(controller_id=cid, is_full=True)
    positions = set()
    for token in s.split(","):
        try:
            positions.add(Position(token.strip().upper()))
        except ValueError:
            pass
    return Qualification(controller_id=cid, is_full=False, positions=frozenset(positions))


def _to_shift(ctrl_id: str, ctrl_name: str, shift_id: int,
              shift_date: str, shift_code: str,
              start_h: int | None, end_h: int | None,
              cfg: RestRuleConfig) -> Shift | None:
    """Quy đổi 1 ca cấp tháng -> domain Shift."""
    if shift_code in ("OFF", "LEAVE", "TRAINING", "ONCALL"):
        return None
    hours = (start_h, end_h) if start_h is not None else DEFAULT_SHIFT_HOURS.get(shift_code)
    if hours is None:
        return None
    base = datetime.fromisoformat(shift_date)
    sh_start = base.replace(hour=0) + _hours_delta(hours[0])
    sh_end   = base.replace(hour=0) + _hours_delta(hours[1])
    kind = classify_shift_kind(sh_start, sh_end, cfg)
    return Shift(
        shift_id=shift_id, controller_id=ctrl_id, controller_name=ctrl_name,
        start=sh_start, end=sh_end,
        is_night=(kind == ShiftKind.NIGHT), kind=kind, sessions=[],
    )


def _hours_delta(hours: int):
    from datetime import timedelta
    return timedelta(hours=hours)


def _build_shifts_for(ctrl_id: str, ctrl_name: str,
                      shifts_data: list, cfg: RestRuleConfig) -> list[Shift]:
    out = []
    for i, sh in enumerate(shifts_data, start=1):
        s = _to_shift(
            ctrl_id, ctrl_name, i,
            sh.date if hasattr(sh, "date") else sh["date"],
            sh.code if hasattr(sh, "code") else sh["code"],
            sh.start_hour if hasattr(sh, "start_hour") else sh.get("start_hour"),
            sh.end_hour   if hasattr(sh, "end_hour")   else sh.get("end_hour"),
            cfg,
        )
        if s:
            out.append(s)
    return out


def _diff_violations(before: list, after: list) -> list:
    """Liệt kê vi phạm xuất hiện ở `after` mà KHÔNG có ở `before`.

    So sánh theo (rule, related_shift_ids tuple, message). Vi phạm sẵn có
    trước khi đổi không tính — đó là vấn đề riêng, không phải do đổi ca.
    """
    def _key(v):
        return (v.rule, tuple(sorted(v.related_shift_ids)), v.message)
    before_keys = {_key(v) for v in before}
    return [v for v in after if _key(v) not in before_keys]


def _required_position_from_code(code: str) -> Optional[Position]:
    """Xác định vị trí mà ca yêu cầu — đơn giản: S/D chấp nhận mọi vị trí.

    KHÔNG ràng buộc cứng. Năng định tương đương ở cấp tháng chỉ check "Full"
    hoặc đặc thù vị trí. Khi có metadata vị trí trên ca cấp tháng, mở rộng.
    """
    return None  # cấp tháng — không biết vị trí cụ thể


def _qualification_equivalent(a: Qualification, b: Qualification) -> bool:
    """QĐ 2701 Điều 8.1.b: 'năng định tương đương'.

    Định nghĩa thực dụng:
    - Full ↔ Full: tương đương.
    - Full ↔ subset: KHÔNG tương đương (subset không phủ hết Full).
    - subset ↔ subset cùng tập: tương đương.
    - Khi tập không bằng nhau: không tương đương.

    Trường hợp kíp trưởng cần đổi cho kíp trưởng đã bổ nhiệm — kiểm tra ở
    NestJS qua field `applicantRole`, không ở đây.
    """
    if a.is_full and b.is_full:
        return True
    if a.is_full != b.is_full:
        return False
    return a.positions == b.positions


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.post("/precheck", response_model=PrecheckExchangeOutput)
def precheck_exchange(inp: PrecheckExchangeInput) -> PrecheckExchangeOutput:
    """Pre-check đổi ca. QĐ 2701 Điều 8 + QĐ 2288."""
    cfg = RestRuleConfig()
    checker = ComplianceChecker(cfg)

    # 1. Kiểm tra năng định tương đương (QĐ 2701 Điều 8.1.b)
    qa = _parse_qualification(inp.applicant.id,    inp.applicant.qualification)
    qb = _parse_qualification(inp.counterparty.id, inp.counterparty.qualification)
    qual_ok = _qualification_equivalent(qa, qb)
    qual_check = QualificationCheckResult(
        applicant_has_required=qual_ok,
        counterparty_has_required=qual_ok,
        required_for_applicant=inp.counterparty.qualification,
        required_for_counterparty=inp.applicant.qualification,
    )

    # 2. Validate type=EXCHANGE phải có counterparty_shift
    if inp.type == "EXCHANGE" and inp.counterparty_shift is None:
        raise HTTPException(400, "type=EXCHANGE yêu cầu counterparty_shift để hoàn trả.")

    # 3. Build BEFORE shifts cho 2 người
    appl_before = _build_shifts_for(inp.applicant.id, inp.applicant.name,
                                     inp.applicant_current_shifts, cfg)
    cp_before   = _build_shifts_for(inp.counterparty.id, inp.counterparty.name,
                                     inp.counterparty_current_shifts, cfg)

    # 4. Build AFTER shifts: gỡ shift đổi đi, thêm shift đổi vào
    def _without(shifts: list[Shift], target_date: str, target_code: str) -> list[Shift]:
        return [s for s in shifts
                if not (s.start.date().isoformat() == target_date
                        and (s.kind.value[:1] == target_code or
                             ("N" in s.kind.value and target_code == "D") or
                             ("EARLY" in s.kind.value and target_code == "S")))]

    # Applicant gỡ ca đổi đi
    appl_after = _without(appl_before, inp.applicant_shift.date, inp.applicant_shift.code)
    # Counterparty nhận ca của applicant
    cp_after = list(cp_before) + _build_shifts_for(
        inp.counterparty.id, inp.counterparty.name,
        [{
            "date": inp.applicant_shift.date, "code": inp.applicant_shift.code,
            "start_hour": inp.applicant_shift.start_hour, "end_hour": inp.applicant_shift.end_hour,
        }], cfg,
    )

    if inp.type == "EXCHANGE" and inp.counterparty_shift:
        cp_after = _without(cp_after, inp.counterparty_shift.date, inp.counterparty_shift.code)
        appl_after = list(appl_after) + _build_shifts_for(
            inp.applicant.id, inp.applicant.name,
            [{
                "date": inp.counterparty_shift.date, "code": inp.counterparty_shift.code,
                "start_hour": inp.counterparty_shift.start_hour, "end_hour": inp.counterparty_shift.end_hour,
            }], cfg,
        )

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
    can_approve = qual_ok and not has_critical

    warnings = []
    if not qual_ok:
        warnings.append(
            "Năng định không tương đương — không thể đổi ca (QĐ 2701 Điều 8.1.b)."
        )
    for v in new_appl + new_cp:
        if v.severity == Severity.WARNING:
            warnings.append(f"{v.controller_name}: {v.message} ({v.legal_basis})")

    notes = []
    if new_appl or new_cp:
        notes.append(
            "Kết quả là CẢNH BÁO — kíp trưởng đánh giá và có thể ghi đè nếu có lý do "
            "(QĐ 2701 Điều 8.3). Lý do ghi đè lưu trong extraData.precheck_override_reason."
        )

    def _to_pv(v):
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
```

**Xác minh:**
- `python -c "from app.routers.exchange import precheck_exchange; print('OK')"` từ `analytics/` in `OK`.
- `pytest tests/test_rest_compliance.py -q` vẫn 135 pass (không động compliance).

## Mục Y2 — Test precheck

**File mới:** `analytics/tests/test_exchange_precheck.py`

```python
"""Test endpoint POST /analytics/exchange/precheck."""
from datetime import date, timedelta

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _ctrl(cid="E1", name="A", qual="Full"):
    return {"id": cid, "name": name, "qualification": qual}


def _shift(d, code="S"):
    return {"date": d, "code": code}


def _payload(**overrides):
    base = {
        "type": "EXCHANGE",
        "applicant":    _ctrl("E1", "A", "Full"),
        "counterparty": _ctrl("E2", "B", "Full"),
        "applicant_shift":    {"date": "2026-06-15", "code": "S"},
        "counterparty_shift": {"date": "2026-06-20", "code": "S"},
        "applicant_current_shifts":    [_shift("2026-06-15", "S")],
        "counterparty_current_shifts": [_shift("2026-06-20", "S")],
    }
    base.update(overrides)
    return base


def test_clean_exchange_can_approve():
    """Đổi ca sạch giữa 2 người Full, không vi phạm gì."""
    r = client.post("/analytics/exchange/precheck", json=_payload())
    assert r.status_code == 200
    body = r.json()
    assert body["can_approve"] is True
    assert body["qualification_check"]["applicant_has_required"] is True
    assert body["new_violations_applicant"] == []
    assert body["new_violations_counterparty"] == []


def test_qualification_mismatch_blocks():
    """Năng định Full vs APP-only → không tương đương → block."""
    r = client.post("/analytics/exchange/precheck", json=_payload(
        counterparty=_ctrl("E2", "B", "APP"),
    ))
    body = r.json()
    assert body["can_approve"] is False
    assert body["qualification_check"]["applicant_has_required"] is False
    assert any("năng định" in w.lower() or "Năng định" in w for w in body["warnings"])


def test_subset_equal_qualifications_ok():
    """Cùng subset năng định → tương đương → can_approve."""
    r = client.post("/analytics/exchange/precheck", json=_payload(
        applicant=_ctrl("E1", "A", "APP,CTL"),
        counterparty=_ctrl("E2", "B", "APP,CTL"),
    ))
    body = r.json()
    assert body["can_approve"] is True


def test_new_violation_detected_after_swap():
    """Counterparty đã có lịch dày — nhận thêm ca tạo vi phạm liên tiếp ngày."""
    # Counterparty đã làm 6 ngày liên tiếp (15-20), nếu nhận thêm ngày 21 → 7 ngày liên tiếp
    cp_shifts = [_shift(f"2026-06-{d:02d}", "S") for d in range(15, 21)]
    r = client.post("/analytics/exchange/precheck", json=_payload(
        applicant_shift={"date": "2026-06-21", "code": "S"},
        counterparty_shift={"date": "2026-06-10", "code": "S"},
        applicant_current_shifts=[_shift("2026-06-21", "S")],
        counterparty_current_shifts=cp_shifts + [_shift("2026-06-10", "S")],
    ))
    body = r.json()
    # Counterparty sau khi đổi sẽ có 7 ngày liên tiếp 15-21
    assert any(v["rule"] == "max_consecutive_working_days"
               for v in body["new_violations_counterparty"]) or body["warnings"]


def test_cover_type_no_counterparty_shift():
    """type=COVER không cần counterparty_shift."""
    payload = _payload(type="COVER")
    payload["counterparty_shift"] = None
    r = client.post("/analytics/exchange/precheck", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["can_approve"] is True


def test_exchange_without_counterparty_shift_400():
    """type=EXCHANGE thiếu counterparty_shift → 400."""
    payload = _payload()
    payload["counterparty_shift"] = None
    r = client.post("/analytics/exchange/precheck", json=payload)
    assert r.status_code == 400
```

**Xác minh:** `cd analytics && pytest tests/test_exchange_precheck.py -v` → 6 test pass. Tổng test ≥ 141.

## Mục Y3 — NestJS proxy gọi precheck với dữ liệu thật

**File:** `backend/src/analytics/analytics.client.ts` — thêm method:

```typescript
async precheckExchange(payload: any): Promise<any> {
  try {
    const res = await firstValueFrom(
      this.http.post('/analytics/exchange/precheck', payload),
    );
    return res.data;
  } catch (err: any) {
    this.log.error(`Precheck exchange failed: ${err?.message}`);
    throw new ServiceUnavailableException('Dịch vụ phân tích chưa sẵn sàng.');
  }
}
```

(Nếu hiện đang dùng native fetch thay axios, viết tương ứng — Claude xem mẫu `reviewDraft` đã có.)

**File:** `backend/src/shift-exchanges/shift-exchanges.service.ts`

Thêm imports đầu file:
```typescript
import { AnalyticsClient } from '../analytics/analytics.client';
import { Employee }        from '../employees/employee.entity';
import { Schedule }        from '../schedules/schedule.entity';
```

Cập nhật constructor:
```typescript
constructor(
  @InjectRepository(ShiftExchange) private readonly repo: Repository<ShiftExchange>,
  @InjectRepository(Employee)      private readonly empRepo: Repository<Employee>,
  @InjectRepository(Schedule)      private readonly schRepo: Repository<Schedule>,
  private readonly analytics: AnalyticsClient,
) {}
```

Thêm method `runPrecheck`:
```typescript
async runPrecheck(dto: {
  type: 'EXCHANGE' | 'COVER';
  applicantId: string;
  counterpartyId: string;
  applicantShiftDate: string;   // YYYY-MM-DD
  applicantShiftCode: string;
  counterpartyShiftDate?: string;
  counterpartyShiftCode?: string;
}): Promise<any> {
  // 1. Lấy thông tin 2 KSVKL
  const [appl, cp] = await Promise.all([
    this.empRepo.findOneByOrFail({ id: dto.applicantId }),
    this.empRepo.findOneByOrFail({ id: dto.counterpartyId }),
  ]);

  // 2. Lấy lịch hiện tại ±30 ngày quanh ngày đổi
  const baseDate = new Date(dto.applicantShiftDate);
  const monthKeys = this._monthKeysAround(baseDate, 30);
  const schedules = await this.schRepo.find({
    where: monthKeys.map(mk => ({ monthKey: mk })),
  });

  // 3. Quy đổi schedules sang ExistingShift[]
  const applicantShifts = this._extractShifts(schedules, dto.applicantId);
  const counterpartyShifts = this._extractShifts(schedules, dto.counterpartyId);

  // 4. Gọi analytics
  return this.analytics.precheckExchange({
    type: dto.type,
    applicant:    { id: appl.id, name: appl.name, qualification: appl.qualification || '' },
    counterparty: { id: cp.id,   name: cp.name,   qualification: cp.qualification || '' },
    applicant_shift:    { date: dto.applicantShiftDate, code: dto.applicantShiftCode },
    counterparty_shift: dto.counterpartyShiftDate
      ? { date: dto.counterpartyShiftDate, code: dto.counterpartyShiftCode }
      : null,
    applicant_current_shifts:    applicantShifts,
    counterparty_current_shifts: counterpartyShifts,
  });
}

private _monthKeysAround(d: Date, daysAround: number): string[] {
  const keys = new Set<string>();
  for (const delta of [-daysAround, 0, daysAround]) {
    const t = new Date(d); t.setDate(t.getDate() + delta);
    keys.add(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return [...keys];
}

private _extractShifts(schedules: Schedule[], empId: string): any[] {
  // CẢNH BÁO: cấu trúc schedule.data phụ thuộc vào shape của SchedulerScreen.
  // Hiện tại scheduleData lưu dạng:
  //   { empAssignments: { "<empId>_YYYY-M-DD": "S"|"D"|"OFF"|... }, ... }
  // Claude PHẢI xem cấu trúc thực tế trong DB rồi điều chỉnh.
  const out: any[] = [];
  for (const sch of schedules) {
    const assignments = sch.data?.empAssignments || {};
    for (const [key, code] of Object.entries(assignments)) {
      if (!key.startsWith(empId + '_')) continue;
      if (code === 'OFF' || code === 'LEAVE') continue;
      const datePart = key.slice(empId.length + 1);   // "2026-6-15"
      // Chuyển 2026-6-15 -> 2026-06-15
      const [y, m, d] = datePart.split('-');
      const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ date: isoDate, code });
    }
  }
  return out;
}
```

**Cảnh báo quan trọng:** `_extractShifts` giả định cấu trúc `scheduleData.empAssignments` theo Mục 3.5 của V2. Nếu cấu trúc khác, **Claude DỪNG và hỏi user** trước khi sửa.

**File:** `backend/src/shift-exchanges/shift-exchanges.module.ts`

Cập nhật imports:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftExchange } from './shift-exchange.entity';
import { Employee }      from '../employees/employee.entity';
import { Schedule }      from '../schedules/schedule.entity';
import { ShiftExchangesController } from './shift-exchanges.controller';
import { ShiftExchangesService }    from './shift-exchanges.service';
import { AnalyticsModule }          from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftExchange, Employee, Schedule]),
    AnalyticsModule,
  ],
  controllers: [ShiftExchangesController],
  providers:   [ShiftExchangesService],
})
export class ShiftExchangesModule {}
```

**File:** `backend/src/analytics/analytics.module.ts`

Đảm bảo `AnalyticsClient` được export:
```typescript
@Module({
  // ... existing config ...
  providers: [AnalyticsClient],
  exports:   [AnalyticsClient],   // ← THÊM
})
```

**Xác minh:** `cd backend && npx nest build` thành công.

## Mục Y4 — NestJS endpoint POST `/api/shift-exchanges/precheck`

**File:** `backend/src/shift-exchanges/shift-exchanges.controller.ts`

Thêm endpoint mới — trả về kết quả precheck mà KHÔNG tạo bản ghi:

```typescript
@Post('precheck')
@UseGuards(JwtAuthGuard)
async precheck(@Body() dto: {
  type: 'EXCHANGE' | 'COVER';
  applicantId: string;
  counterpartyId: string;
  applicantShiftDate: string;
  applicantShiftCode: string;
  counterpartyShiftDate?: string;
  counterpartyShiftCode?: string;
}) {
  // Validate DTO theo class-validator pattern hiện có nếu cần
  return this.svc.runPrecheck(dto);
}
```

Cập nhật `create` để **tự động chạy precheck** và lưu kết quả vào `precheckResult`:

```typescript
@Post()
@UseGuards(JwtAuthGuard)
async create(@Body() dto: any, @Req() req: any) {
  // Chạy precheck trước khi tạo
  const precheck = await this.svc.runPrecheck({
    type: dto.type,
    applicantId: req.user.sub,
    counterpartyId: dto.counterpartyId,
    applicantShiftDate: dto.applicantShiftDate,
    applicantShiftCode: dto.applicantShiftCode,
    counterpartyShiftDate: dto.counterpartyShiftDate,
    counterpartyShiftCode: dto.counterpartyShiftCode,
  });

  return this.svc.create({
    ...dto,
    applicantId: req.user.sub,
    applicantName: req.user.name,  // hoặc lấy từ empRepo
    precheckResult: precheck,
  });
}
```

**Xác minh:**
- `cd backend && npx nest build` clean.
- Tạo đổi ca qua API → response có `precheckResult` chứa `can_approve`, `qualification_check`, ...

## Mục Y5 — Frontend: nút "Kiểm tra điều kiện" + hiển thị kết quả

**File:** `src/screens/AnalyticsScreen.jsx`

Trong `ShiftExchangeTab`, thêm state precheck và logic:

```jsx
const [precheckResult, setPrecheckResult] = useState(null);
const [prechecking, setPrechecking]     = useState(false);

const runPrecheck = async () => {
  if (!appShiftDate || !counterpartyId) {
    window.alert('Cần chọn người nhận và ngày ca trước khi kiểm tra.');
    return;
  }
  setPrechecking(true);
  try {
    const { data } = await api.post('/api/shift-exchanges/precheck', {
      type,
      applicantId:    currentUser.id,
      counterpartyId,
      applicantShiftDate: appShiftDate,
      applicantShiftCode: appShiftCode,
      counterpartyShiftDate: type === 'EXCHANGE' ? cpShiftDate : undefined,
      counterpartyShiftCode: type === 'EXCHANGE' ? cpShiftCode : undefined,
    });
    setPrecheckResult(data);
  } catch (e) {
    window.alert('Lỗi kiểm tra: ' + (e?.response?.data?.message ?? e.message));
  } finally {
    setPrechecking(false);
  }
};
```

Trong JSX form, thêm nút trước nút Gửi:

```jsx
<button onClick={runPrecheck} disabled={prechecking}
        style={{ marginRight: 8 }}>
  {prechecking ? 'Đang kiểm tra…' : '🔍 Kiểm tra điều kiện'}
</button>

{precheckResult && <PrecheckPanel result={precheckResult} />}
```

**Component mới:** `src/components/PrecheckPanel.jsx`

```jsx
import React from 'react';

export default function PrecheckPanel({ result }) {
  if (!result) return null;
  const { can_approve, qualification_check, new_violations_applicant,
          new_violations_counterparty, warnings, notes } = result;

  const allNewVio = [...(new_violations_applicant ?? []), ...(new_violations_counterparty ?? [])];

  return (
    <div style={{
      marginTop: 16, padding: 16, borderRadius: 8,
      border: '1px solid ' + (can_approve ? '#bbf7d0' : '#fecaca'),
      backgroundColor: can_approve ? '#f0fdf4' : '#fef2f2',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 12, color: can_approve ? '#15803d' : '#dc2626' }}>
        {can_approve
          ? '✓ Đủ điều kiện đổi ca (chưa duyệt — cần kíp trưởng phê duyệt)'
          : '✗ KHÔNG đủ điều kiện đổi ca'}
      </div>

      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <strong>Năng định tương đương (QĐ 2701 Điều 8.1.b):</strong>{' '}
        {qualification_check.applicant_has_required ? '✓ Tương đương' : '✗ Không tương đương'}
      </div>

      {allNewVio.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong style={{ fontSize: 13 }}>Vi phạm MỚI phát sinh do việc đổi ca:</strong>
          <ul style={{ marginTop: 4, fontSize: 13 }}>
            {allNewVio.map((v, i) => (
              <li key={i} style={{ color: v.severity === 'CRITICAL' ? '#dc2626' : '#d97706', marginBottom: 4 }}>
                <strong>[{v.severity}]</strong> {v.controller_name}: {v.message}
                {v.legal_basis && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>📜 {v.legal_basis}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings?.length > 0 && (
        <div style={{ marginTop: 8, padding: 10, backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: 6, fontSize: 13 }}>
          <strong>Cảnh báo:</strong>
          <ul style={{ marginTop: 4, marginBottom: 0 }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {notes?.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
          {notes.map((n, i) => <div key={i}>ℹ️ {n}</div>)}
        </div>
      )}
    </div>
  );
}
```

Import trong `AnalyticsScreen.jsx`:
```jsx
import PrecheckPanel from '../components/PrecheckPanel.jsx';
```

**Xác minh:** mở tab Đổi ca → chọn người nhận và ngày → bấm "Kiểm tra điều kiện" → hiển thị panel kết quả với 4 phần: status, qualification, vi phạm mới, cảnh báo.

## Mục Y6 — Lưu lý do ghi đè khi kíp trưởng phê duyệt vi phạm warning

**File:** `backend/src/shift-exchanges/shift-exchanges.controller.ts`

Cập nhật endpoint `chiefApprove` để nhận `override_reason`:

```typescript
@Put(':id/chief-approve')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CHIEF', 'ADMIN', 'superadmin')
async chiefApprove(
  @Param('id') id: string,
  @Body() body: { override_reason?: string },
  @Req() req: any,
) {
  return this.svc.chiefApprove(id, req.user.sub, req.user.role, body.override_reason);
}
```

**File:** `backend/src/shift-exchanges/shift-exchanges.service.ts`

Cập nhật `chiefApprove`:

```typescript
async chiefApprove(id: string, chiefId: string, role: string,
                   overrideReason?: string): Promise<ShiftExchange> {
  const ex = await this.repo.findOneByOrFail({ id });

  // Nếu precheckResult có warnings hoặc !can_approve, BẮT BUỘC ghi override_reason
  const pc = ex.precheckResult || {};
  const hasWarnings = (pc.warnings ?? []).length > 0;
  const cantApprove = pc.can_approve === false;
  if ((hasWarnings || cantApprove) && !overrideReason) {
    throw new BadRequestException(
      'Precheck có cảnh báo/vi phạm — kíp trưởng phải ghi rõ lý do phê duyệt (override_reason).',
    );
  }

  if (!ex.chiefApproverId) {
    ex.chiefApproverId   = chiefId;
    ex.chiefApproverRole = role;
    ex.chiefApprovedAt   = new Date();
    if (overrideReason) {
      ex.extraData = { ...(ex.extraData || {}), precheck_override_reason: overrideReason };
    }
    if (ex.facilityType === 'ACC_APP_TWR') {
      ex.status = 'chief_1_approved';
    } else {
      ex.status = 'chief_approved';
    }
  } else {
    ex.chiefApproverId2  = chiefId;
    ex.chiefApproved2At  = new Date();
    if (overrideReason) {
      ex.extraData = {
        ...(ex.extraData || {}),
        precheck_override_reason_2: overrideReason,
      };
    }
    ex.status = 'chief_approved';
  }
  return this.repo.save(ex);
}
```

Thêm `BadRequestException` vào import.

**Xác minh:** tạo đổi ca với precheck có warnings → kíp trưởng bấm phê duyệt mà không nhập lý do → server trả 400. Nhập lý do → phê duyệt thành công, `extraData.precheck_override_reason` lưu giá trị.

---

# PHẦN Z — Module Deviation theo QĐ 2289 Chương IV

## Bối cảnh pháp lý

QĐ 2289 Chương IV (trang 12-15) định nghĩa Deviation là **quy trình tạm thời vượt giới hạn lập lịch** trong tình huống khẩn cấp/bất khả kháng. Khác biệt với Variation (Chương V):

| | Deviation (Chương IV) | Variation (Chương V) |
|---|---|---|
| Tính chất | Tạm thời, từng sự kiện | Dài hạn, từng loại hình |
| Lý do | Khẩn cấp, bất khả kháng | Mô hình khai thác đặc thù |
| Thẩm quyền | Trưởng cơ sở ĐHB | Cục HKVN phê chuẩn |
| Báo cáo | Trong 24-48h | Hồ sơ + giám sát định kỳ |
| Lưu trữ | ≥ 5 năm | ≥ 5 năm sau kết thúc |

Sprint này **chỉ làm Deviation** — Variation phức tạp hơn và ít dùng (cấp Tổng công ty), để sprint sau.

## Tinh thần thiết kế

**Deviation KHÔNG phải là vi phạm.** Đây là quy trình hợp pháp được QĐ 2288 Điều 19 + QĐ 2289 cho phép. Quy trình theo Chương IV mục V (Bước 1-6):

1. Nhận diện nhu cầu deviation (kíp trưởng/KSVKL quản lý kíp đánh giá).
2. Đánh giá nhanh an toàn và rủi ro mệt mỏi.
3. Trưởng cơ sở (hoặc người được ủy quyền) quyết định áp dụng.
4. Triển khai biện pháp giảm thiểu (giảm tải, nghỉ tạm, giám sát chéo, nghỉ bù sau).
5. Ghi nhận biên bản deviation trong 24h.
6. Báo cáo Ban An toàn - Chất lượng trong 48h.

Module này phải hỗ trợ đầy đủ 6 bước, không bỏ qua bước nào.

## Mục Z1 — DB schema cho deviations

**File:** `backend/migration.sql` — append:

```sql
-- Deviation — QĐ 2289 Chương IV + QĐ 2288 Điều 19
-- Quy trình tạm thời vượt giới hạn lập lịch trong tình huống khẩn cấp/bất khả kháng.
-- KHÔNG phải vi phạm — là quy trình hợp pháp.
-- Lưu trữ ≥ 5 năm (QĐ 2289 Chương IV mục VII).

CREATE TABLE IF NOT EXISTS deviations (
  id              VARCHAR PRIMARY KEY,
  -- Bước 1: Nhận diện
  facility        VARCHAR NOT NULL,           -- Cơ sở (ACC Đà Nẵng, APP/TWR Đà Nẵng, ...)
  occurred_at     TIMESTAMPTZ NOT NULL,       -- Thời điểm phát sinh
  reason_category VARCHAR NOT NULL,
                  -- 'EMERGENCY' (khẩn cấp), 'FORCE_MAJEURE' (bất khả kháng),
                  -- 'TECH_FAILURE' (sự cố kỹ thuật), 'WEATHER' (thời tiết),
                  -- 'TRAFFIC_SURGE' (lưu lượng đột biến), 'OTHER'
  reason_detail   TEXT NOT NULL,              -- Mô tả chi tiết tình huống

  -- Phạm vi vượt giới hạn (Chương IV mục II)
  limit_exceeded  VARCHAR NOT NULL,
                  -- 'DAILY_HOURS', 'WEEKLY_HOURS', '30DAYS_HOURS',
                  -- 'CONSECUTIVE_DAYS', 'CONSECUTIVE_NIGHTS',
                  -- 'REST_BETWEEN_SHIFTS', 'TIME_IN_POSITION', 'BREAK',
                  -- 'ONCALL_LIMIT', 'OTHER'
  limit_legal_basis VARCHAR NOT NULL,         -- vd "QĐ 2288 Điều 11.1"
  affected_controllers JSONB NOT NULL DEFAULT '[]',
                  -- [{ id, name, original_value, deviation_value }]
  expected_duration_minutes INTEGER,          -- Thời lượng dự kiến

  -- Bước 2: Đánh giá nhanh
  risk_assessment TEXT,                       -- Đánh giá rủi ro tóm tắt
  safety_alternatives_considered TEXT,        -- Các giải pháp an toàn hơn đã xem xét
                                              -- (Chương IV mục III.2 — deviation là cuối cùng)

  -- Bước 3: Quyết định
  decided_by_id   VARCHAR,                    -- ID Trưởng cơ sở/người được ủy quyền
  decided_by_name VARCHAR,
  decided_by_role VARCHAR,
                  -- 'TRUONG_CO_SO', 'NGUOI_DUOC_UY_QUYEN', 'KIP_TRUONG_KHAN_CAP'
                  -- (Chương IV mục IV.1.b: tình huống rất khẩn — kíp trưởng tự quyết)
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  is_emergency_decision BOOLEAN NOT NULL DEFAULT FALSE,
                  -- TRUE nếu kíp trưởng quyết định tại chỗ (Chương IV mục IV.1.b)

  -- Bước 4: Biện pháp giảm thiểu (Chương IV mục V.4)
  mitigations JSONB NOT NULL DEFAULT '[]',
                  -- [{ category: 'WORKLOAD_REDUCTION' | 'BREAK' | 'SUPERVISION' | 'RECOVERY',
                  --   description, applied_at }]

  -- Bước 5: Ghi nhận biên bản
  recorded_at     TIMESTAMPTZ,                -- Thời điểm hoàn tất biên bản (≤ 24h khuyến nghị)
  ended_at        TIMESTAMPTZ,                -- Thời điểm kết thúc deviation thực tế

  -- Bước 6: Báo cáo Ban An toàn (≤ 48h khuyến nghị)
  safety_report_sent BOOLEAN NOT NULL DEFAULT FALSE,
  safety_report_sent_at TIMESTAMPTZ,
  safety_report_content TEXT,                 -- Nội dung báo cáo gửi Ban An toàn-CL
  -- Cục HKVN (≤ 72h theo QĐ 2288 Điều 19.2)
  caav_report_sent BOOLEAN NOT NULL DEFAULT FALSE,
  caav_report_sent_at TIMESTAMPTZ,

  -- Phân tích sau (Chương IV mục VI)
  analysis_note   TEXT,                       -- Phân tích root cause của FSAG
  analysis_by_id  VARCHAR,
  analysis_at     TIMESTAMPTZ,

  status          VARCHAR NOT NULL DEFAULT 'active',
                  -- 'active' (đang áp dụng), 'recorded' (đã ghi biên bản),
                  -- 'reported' (đã báo cáo), 'analyzed' (đã phân tích), 'closed'

  extra_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deviations_facility   ON deviations(facility);
CREATE INDEX IF NOT EXISTS idx_deviations_status     ON deviations(status);
CREATE INDEX IF NOT EXISTS idx_deviations_occurred   ON deviations(occurred_at);
CREATE INDEX IF NOT EXISTS idx_deviations_limit_type ON deviations(limit_exceeded);
```

**Xác minh:** chạy migration trên DB dev, `\d deviations` thấy đủ cột.

## Mục Z2 — NestJS module `deviations`

Pattern y như `fatigue-reports/`.

**File mới:** `backend/src/deviations/deviation.entity.ts`

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('deviations')
export class Deviation {
  @PrimaryColumn() id: string;

  @Column() facility: string;
  @Column({ type: 'timestamptz' }) occurredAt: Date;
  @Column() reasonCategory: string;
  @Column({ type: 'text' }) reasonDetail: string;

  @Column() limitExceeded: string;
  @Column() limitLegalBasis: string;
  @Column({ type: 'jsonb', default: '[]' }) affectedControllers: any[];
  @Column({ type: 'int', nullable: true }) expectedDurationMinutes: number;

  @Column({ type: 'text', nullable: true }) riskAssessment: string;
  @Column({ type: 'text', nullable: true }) safetyAlternativesConsidered: string;

  @Column({ nullable: true }) decidedById: string;
  @Column({ nullable: true }) decidedByName: string;
  @Column({ nullable: true }) decidedByRole: string;
  @Column({ type: 'timestamptz', nullable: true }) decidedAt: Date;
  @Column({ type: 'text', nullable: true }) decisionNote: string;
  @Column({ default: false }) isEmergencyDecision: boolean;

  @Column({ type: 'jsonb', default: '[]' }) mitigations: any[];

  @Column({ type: 'timestamptz', nullable: true }) recordedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) endedAt: Date;

  @Column({ default: false }) safetyReportSent: boolean;
  @Column({ type: 'timestamptz', nullable: true }) safetyReportSentAt: Date;
  @Column({ type: 'text', nullable: true }) safetyReportContent: string;
  @Column({ default: false }) caavReportSent: boolean;
  @Column({ type: 'timestamptz', nullable: true }) caavReportSentAt: Date;

  @Column({ type: 'text', nullable: true }) analysisNote: string;
  @Column({ nullable: true }) analysisById: string;
  @Column({ type: 'timestamptz', nullable: true }) analysisAt: Date;

  @Column({ default: 'active' }) status: string;
  @Column({ type: 'jsonb', default: '{}' }) extraData: Record<string, any>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**File mới:** `backend/src/deviations/deviations.service.ts`

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Deviation } from './deviation.entity';

@Injectable()
export class DeviationsService {
  private readonly log = new Logger(DeviationsService.name);

  constructor(
    @InjectRepository(Deviation) private readonly repo: Repository<Deviation>,
  ) {}

  async create(data: Partial<Deviation>): Promise<Deviation> {
    if (!data.facility || !data.reasonCategory || !data.reasonDetail) {
      throw new BadRequestException(
        'Thiếu thông tin: facility, reasonCategory, reasonDetail là bắt buộc (Chương IV Bước 1).',
      );
    }
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.repo.save(this.repo.create({
      ...data, id, status: 'active', occurredAt: data.occurredAt || new Date(),
    }));
  }

  async recordDecision(id: string, data: {
    decidedById: string; decidedByName: string; decidedByRole: string;
    decisionNote?: string; isEmergencyDecision?: boolean;
  }): Promise<Deviation> {
    const dev = await this.repo.findOneByOrFail({ id });
    Object.assign(dev, {
      decidedById: data.decidedById, decidedByName: data.decidedByName,
      decidedByRole: data.decidedByRole, decidedAt: new Date(),
      decisionNote: data.decisionNote ?? null,
      isEmergencyDecision: !!data.isEmergencyDecision,
    });
    return this.repo.save(dev);
  }

  async addMitigation(id: string, mit: {
    category: string; description: string;
  }): Promise<Deviation> {
    const dev = await this.repo.findOneByOrFail({ id });
    dev.mitigations = [
      ...(dev.mitigations || []),
      { ...mit, appliedAt: new Date().toISOString() },
    ];
    return this.repo.save(dev);
  }

  async end(id: string, endedAt?: Date): Promise<Deviation> {
    const dev = await this.repo.findOneByOrFail({ id });
    dev.endedAt = endedAt || new Date();
    return this.repo.save(dev);
  }

  async recordReport(id: string, content: string): Promise<Deviation> {
    const dev = await this.repo.findOneByOrFail({ id });
    dev.recordedAt = new Date();
    if (dev.status === 'active') dev.status = 'recorded';
    return this.repo.save(dev);
  }

  async sendSafetyReport(id: string, content: string): Promise<Deviation> {
    const dev = await this.repo.findOneByOrFail({ id });
    dev.safetyReportSent = true;
    dev.safetyReportSentAt = new Date();
    dev.safetyReportContent = content;
    if (dev.status === 'recorded') dev.status = 'reported';
    return this.repo.save(dev);
  }

  async addAnalysis(id: string, analystId: string, note: string): Promise<Deviation> {
    const dev = await this.repo.findOneByOrFail({ id });
    dev.analysisNote = note;
    dev.analysisById = analystId;
    dev.analysisAt   = new Date();
    if (dev.status === 'reported') dev.status = 'analyzed';
    return this.repo.save(dev);
  }

  findActive(): Promise<Deviation[]> {
    return this.repo.find({
      where: { status: 'active' }, order: { occurredAt: 'DESC' },
    });
  }

  findByPeriod(start: Date, end: Date): Promise<Deviation[]> {
    return this.repo.find({
      where: { occurredAt: MoreThan(start) },
      order: { occurredAt: 'DESC' },
    }).then(list => list.filter(d => d.occurredAt <= end));
  }

  findOne(id: string): Promise<Deviation> {
    return this.repo.findOneByOrFail({ id });
  }

  // Cron escalation — nhắc nhở ghi biên bản trong 24h (Chương IV mục V.5)
  @Cron(CronExpression.EVERY_HOUR)
  async checkRecordingDeadline(): Promise<number> {
    const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000);
    const pending = await this.repo.find({
      where: { status: 'active', occurredAt: LessThan(cutoff24h), recordedAt: null as any },
    });
    if (pending.length) {
      this.log.warn(`${pending.length} deviation(s) chưa ghi biên bản sau 24h — cần nhắc nhở.`);
      // TODO: gửi notification cho người liên quan
    }
    return pending.length;
  }

  // Cron — nhắc báo cáo Ban An toàn trong 48h (Chương IV mục V.6)
  @Cron(CronExpression.EVERY_HOUR)
  async checkSafetyReportDeadline(): Promise<number> {
    const cutoff48h = new Date(Date.now() - 48 * 3600 * 1000);
    const pending = await this.repo.find({
      where: { safetyReportSent: false, occurredAt: LessThan(cutoff48h) },
    });
    if (pending.length) {
      this.log.warn(`${pending.length} deviation(s) chưa báo cáo Ban An toàn sau 48h.`);
    }
    return pending.length;
  }
}
```

**File mới:** `backend/src/deviations/deviations.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { DeviationsService } from './deviations.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('api/deviations')
export class DeviationsController {
  constructor(
    private readonly svc: DeviationsService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHIEF', 'ADMIN', 'superadmin')
  async create(@Body() body: any, @Req() req: any) {
    const dev = await this.svc.create(body);
    this.notify.broadcastNotification('deviation:new', {
      id: dev.id, facility: dev.facility, limitExceeded: dev.limitExceeded,
    });
    return dev;
  }

  @Put(':id/decision')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHIEF', 'ADMIN', 'superadmin')
  recordDecision(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.recordDecision(id, {
      decidedById: req.user.sub, decidedByName: req.user.name,
      decidedByRole: body.decidedByRole, decisionNote: body.decisionNote,
      isEmergencyDecision: body.isEmergencyDecision,
    });
  }

  @Put(':id/mitigations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHIEF', 'ADMIN', 'superadmin')
  addMitigation(@Param('id') id: string, @Body() body: any) {
    return this.svc.addMitigation(id, body);
  }

  @Put(':id/end')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHIEF', 'ADMIN', 'superadmin')
  end(@Param('id') id: string, @Body() body: { endedAt?: string }) {
    return this.svc.end(id, body.endedAt ? new Date(body.endedAt) : undefined);
  }

  @Put(':id/record')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHIEF', 'ADMIN', 'superadmin')
  record(@Param('id') id: string, @Body() body: { content: string }) {
    return this.svc.recordReport(id, body.content);
  }

  @Put(':id/safety-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHIEF', 'ADMIN', 'superadmin')
  sendSafetyReport(@Param('id') id: string, @Body() body: { content: string }) {
    return this.svc.sendSafetyReport(id, body.content);
  }

  @Put(':id/analysis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')   // chỉ FSAG/Ban An toàn
  analyze(@Param('id') id: string, @Body() body: { note: string }, @Req() req: any) {
    return this.svc.addAnalysis(id, req.user.sub, body.note);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  findActive() { return this.svc.findActive(); }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get()
  @UseGuards(JwtAuthGuard)
  findByPeriod(@Query('start') start: string, @Query('end') end: string) {
    return this.svc.findByPeriod(new Date(start), new Date(end));
  }
}
```

**File mới:** `backend/src/deviations/deviations.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deviation } from './deviation.entity';
import { DeviationsController } from './deviations.controller';
import { DeviationsService } from './deviations.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Deviation]), NotificationsModule],
  controllers: [DeviationsController],
  providers:   [DeviationsService],
})
export class DeviationsModule {}
```

**File:** `backend/src/app.module.ts`

Thêm `DeviationsModule` vào `imports[]`.

**Xác minh:** `cd backend && npx nest build` clean.

## Mục Z3 — Frontend `DeviationTab`

**File:** `src/screens/AnalyticsScreen.jsx`

Thêm vào `TAB_GROUPS.forms.tabs` ID mới `deviation`:

```jsx
{ id: 'deviation', label: 'Deviation', icon: 'alert-octagon',
  desc: 'Quy trình tạm thời vượt giới hạn — QĐ 2289 Chương IV.' },
```

Thêm placeholder và route:

```jsx
{tab === 'deviation' && <DeviationTab currentUser={currentUser} />}
```

Component `DeviationTab` có 2 view chính:

1. **List view** — danh sách deviation theo tháng/trạng thái + nút "Tạo deviation mới".
2. **Detail/Edit view** — wizard 6 bước theo Chương IV mục V:

**Bước 1: Nhận diện** (kíp trưởng/admin điền):
- Cơ sở (dropdown từ position hiện có)
- Thời điểm phát sinh
- Lý do (radio): EMERGENCY/FORCE_MAJEURE/TECH_FAILURE/WEATHER/TRAFFIC_SURGE/OTHER
- Mô tả chi tiết (textarea)
- Loại giới hạn vượt (dropdown từ enum)
- Cơ sở pháp lý (auto-fill theo loại giới hạn, vd "QĐ 2288 Điều 11.1")
- KSVKL bị ảnh hưởng (multi-select)
- Thời lượng dự kiến (phút)

**Bước 2: Đánh giá** (sau khi tạo bản ghi):
- Đánh giá rủi ro (textarea)
- Giải pháp an toàn hơn đã xem xét (textarea — **bắt buộc** theo Chương IV mục III.2)

**Bước 3: Quyết định**:
- Người quyết định (dropdown user role CHIEF/ADMIN, hoặc tự điền nếu là người đăng nhập)
- Vai trò (Trưởng cơ sở / Người được ủy quyền / Kíp trưởng khẩn cấp)
- Checkbox "Quyết định khẩn cấp tại chỗ" (Chương IV mục IV.1.b)
- Ghi chú quyết định

**Bước 4: Biện pháp giảm thiểu** (có thể thêm nhiều):
- Loại biện pháp: WORKLOAD_REDUCTION / BREAK / SUPERVISION / RECOVERY
- Mô tả cụ thể

**Bước 5: Ghi biên bản** (≤ 24h):
- Hiển thị deadline countdown từ `occurredAt + 24h`
- Nội dung biên bản (textarea lớn)
- Nút "Lưu biên bản chính thức" → set `recordedAt`

**Bước 6: Báo cáo Ban An toàn** (≤ 48h):
- Hiển thị deadline countdown
- Nội dung báo cáo (textarea)
- Nút "Gửi báo cáo" → set `safetyReportSent=true`, gửi notification cho ADMIN

**Bước 7 (sau): Phân tích root cause** (chỉ ADMIN):
- Phân tích nguyên nhân gốc
- Đề xuất cải tiến

```jsx
function DeviationTab({ currentUser }) {
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [deviations, setDeviations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const isChief = currentUser?.isChief || currentUser?.role === 'ADMIN'
                  || currentUser?.role === 'superadmin';
  if (!isChief) {
    return (
      <div style={{ padding: 20 }}>
        <InfoBox msg="Chỉ Kíp trưởng / Trưởng cơ sở mới có quyền truy cập module Deviation. Liên hệ admin nếu cần xem cụ thể." />
      </div>
    );
  }

  // ... load deviations, render list/wizard ...

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Deviation KHÔNG phải vi phạm — đây là quy trình hợp pháp theo QĐ 2289 Chương IV.',
        'Áp dụng khi có tình huống khẩn cấp/bất khả kháng buộc vượt giới hạn lập lịch.',
        'Quy trình 6 bước: Nhận diện → Đánh giá → Quyết định → Giảm thiểu → Ghi biên bản (24h) → Báo cáo Ban An toàn (48h).',
        'Hệ thống tự động nhắc nhở khi đến deadline. Lưu trữ ≥ 5 năm.',
      ]} />

      {/* Disclaimer Just Culture */}
      <div style={{
        padding: 16, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 8, marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 8, color: '#1e40af' }}>
          ⚖️ Deviation: quy trình hợp pháp, không phải vi phạm
        </h3>
        <p style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.5, margin: 0 }}>
          Theo QĐ 2289 Chương IV mục I: deviation là quy trình hợp pháp cho phép tạm thời
          vượt giới hạn lập lịch trong tình huống khẩn cấp/bất khả kháng. Mục tiêu là
          <strong> duy trì an toàn </strong>, không phải né tránh trách nhiệm. Mọi deviation
          phải có biện pháp giảm thiểu phù hợp và được báo cáo đúng thời hạn.
        </p>
      </div>

      {view === 'list' && (
        <DeviationList deviations={deviations}
                       onNew={() => setView('create')}
                       onView={(id) => { setSelectedId(id); setView('detail'); }} />
      )}
      {view === 'create' && <DeviationCreateWizard onDone={() => setView('list')}
                                                    onCancel={() => setView('list')}
                                                    currentUser={currentUser} />}
      {view === 'detail' && <DeviationDetail id={selectedId}
                                              onBack={() => setView('list')}
                                              currentUser={currentUser} />}
    </div>
  );
}
```

Chi tiết các sub-component (`DeviationList`, `DeviationCreateWizard`, `DeviationDetail`) — Claude phát triển theo pattern các tab khác. Yêu cầu chính:

- **Countdown timer** hiển thị thời gian còn lại trước deadline 24h/48h. Khi quá hạn, tô đỏ.
- **Stepper UI** cho 6 bước, mỗi bước hoàn thành thì check xanh.
- **Auto-fill `limitLegalBasis`**: dùng mapping
  ```javascript
  const LIMIT_LEGAL_MAP = {
    DAILY_HOURS: 'QĐ 2288 Điều 11.1',
    WEEKLY_HOURS: 'QĐ 2288 Điều 11.2',
    '30DAYS_HOURS': 'QĐ 2288 Điều 12.1',
    CONSECUTIVE_DAYS: 'QĐ 2288 Điều 12.2',
    CONSECUTIVE_NIGHTS: 'QĐ 2288 Điều 15.1.b',
    REST_BETWEEN_SHIFTS: 'QĐ 2288 Điều 13.1',
    TIME_IN_POSITION: 'QĐ 2288 Điều 14.1',
    BREAK: 'QĐ 2288 Điều 14.2.a',
    ONCALL_LIMIT: 'QĐ 2288 Điều 16',
    OTHER: '',
  };
  ```
- **Hiển thị các deviation trong vòng 30 ngày** ở `DeviationList`, sắp xếp theo `occurredAt DESC`.

**Xác minh:** mở tab Deviation → tạo 1 deviation thử qua đủ 6 bước → bản ghi trong DB có đủ `status='analyzed'` khi xong tất cả.

## Mục Z4 — Cập nhật SPI Dashboard

**File:** `analytics/app/routers/spi.py`

Hiện trường `deviation_count` đang trả 0 mãi. Cập nhật:

```python
# Trong get_spi_summary, thêm:
# Đếm deviation trong tháng — gọi NestJS hoặc query trực tiếp DB
# Vì analytics service là read-only và DB là chia sẻ, query trực tiếp:

deviation_count = 0
try:
    # Cần thêm Deviation entity vào analytics/app/data/ — hoặc query raw SQL
    from sqlalchemy import text
    result = db.execute(text("""
        SELECT COUNT(*) FROM deviations
        WHERE occurred_at >= :start AND occurred_at <= :end
    """), {"start": period_start, "end": period_end})
    deviation_count = result.scalar() or 0
except Exception as e:
    # Bảng deviations chưa tồn tại hoặc lỗi khác
    pass
```

Cập nhật response:
```python
"deviation_count": {
    "value": deviation_count,
    "label": "Số deviation",
    "legal_basis": "QĐ 2288 Điều 24.1.c",
    "status": "warning" if deviation_count > 5 else "ok",
    "details": {"note": "Theo QĐ 2289 Chương IV — quy trình hợp pháp, theo dõi xu hướng."},
},
```

**Xác minh:** tạo 2 deviation thử → mở SPI dashboard tháng đó → card "Số deviation" = 2.

## Mục Z5 — Test deviation logic

**File mới:** `backend/src/deviations/deviations.service.spec.ts`

Test các method chính:
- `create` với thiếu trường bắt buộc → throw `BadRequestException`.
- `recordDecision` → set `decidedAt`.
- `addMitigation` → array tăng size.
- `sendSafetyReport` → set flag và content.
- `checkRecordingDeadline` → identify pending khi `occurredAt < now-24h` và `recordedAt = null`.

**Xác minh:** `cd backend && npm test -- deviations` → 5 test pass.

---

# PHẦN W — Smoke test + tổng kết

## Mục W1 — Smoke test thủ công

Sau khi 3 phần X-Y-Z xong:

1. **X**: `grep -rn "ví dụ\|VATM/CAAV/ICAO" analytics/app/` không trả về kết quả.

2. **Y precheck:**
   - KSVKL A đăng nhập → tab Đổi ca → tạo yêu cầu cho KSVKL B.
   - Bấm "Kiểm tra điều kiện" trước khi gửi → panel hiển thị: năng định tương đương ✓, không vi phạm mới.
   - Tạo trường hợp test xấu: A có lịch dày, đổi ca làm vượt 6 ngày liên tiếp → panel hiển thị warning, can_approve=true (vì WARNING không CRITICAL).
   - Kíp trưởng phê duyệt → bị 400 vì thiếu `override_reason` → nhập lý do → phê duyệt thành công, `extraData.precheck_override_reason` lưu trong DB.

3. **Z deviation:**
   - Kíp trưởng tạo deviation: cơ sở "APP/TWR Đà Nẵng", lý do "TECH_FAILURE", vượt "DAILY_HOURS", `legalBasis` auto-fill "QĐ 2288 Điều 11.1".
   - Ghi quyết định: vai trò "TRUONG_CO_SO", emergency=false.
   - Thêm 2 biện pháp giảm thiểu: "Giảm tải sector" + "Nghỉ bù 4h sau ca".
   - Ghi biên bản trước 24h → status='recorded'.
   - Báo cáo Ban An toàn trước 48h → status='reported'.
   - Mở SPI Dashboard → deviation_count = 1.

**Xác minh:** chạy đủ 3 luồng không lỗi 500. Ghi kết quả vào `CHANGELOG_SPRINT_NEXT.md`.

## Mục W2 — Tổng kết CHANGELOG

Tạo `CHANGELOG_SPRINT_NEXT.md` với các mục `[DONE]` lần lượt.

**Mục cuối, ghi tổng kết:**
```
- analytics tests: 135 + 6 mới = 141 passed
- backend modules: 16 → 17 (thêm DeviationsModule)
- DB tables mới: 1 (deviations)
- Endpoints mới: precheck (đầy đủ), 8 endpoint cho deviations
- Không còn chuỗi "ví dụ" / "VATM/CAAV/ICAO" trong toàn repo
- Module Đổi ca: precheck thực, năng định tương đương, override_reason bắt buộc khi warning
- Module Deviation: 6 bước theo QĐ 2289 Chương IV với cron escalation 24h/48h
```

---

# Câu hỏi mở Claude PHẢI hỏi user

1. **Mục Y3 (`_extractShifts`):** Cấu trúc `scheduleData` trong DB là gì? Có dạng `empAssignments` như giả định, hay khác? Claude xem 1 bản ghi thực tế từ table `schedules` trước khi viết code.

2. **Mục Y4 (`create` auto-precheck):** Có muốn `applicantId` lấy từ `req.user.sub` (người đăng nhập), hay cho phép admin tạo thay người khác? Mặc định mình để `req.user.sub`.

3. **Mục Z2 (notification escalation):** Có muốn gửi email thật khi quá deadline 24h/48h, hay chỉ broadcast qua WebSocket như fatigue-reports? Hiện code stub bằng `this.log.warn`.

4. **Mục Z3 (DeviationTab quyền):** Hiện kế hoạch hạn chế Deviation cho `isChief || role=ADMIN`. Có muốn cho KSVKL thường nhìn (read-only) các deviation của kíp mình không? Mặc định: không.

5. **Mục Z4 (SPI deviation count):** Analytics service đang read-only, query bảng `deviations` qua TypeORM connection chung. Có lo ngại security không? Nếu có, đổi sang gọi NestJS API thay vì query DB trực tiếp.

---

# Lưu ý cuối

- **Phần X làm trước** (5 phút) để CHANGELOG khớp thực tế ngay.
- **Phần Y và Z độc lập** — có thể giao 2 người làm song song hoặc làm tuần tự.
- **Trước khi sửa `shift-exchanges.service.ts`**, `view` toàn file để biết constructor đang nhận gì.
- **Trước khi viết `_extractShifts`**, query 1 bản ghi `schedules` thực tế từ DB.
- **Mỗi mục xong → chạy Xác minh THẬT → ghi `[DONE]` vào `CHANGELOG_SPRINT_NEXT.md`.**

## Việc đặt nền cho sprint sau

Khi Phần Y và Z xong, có 2 hướng cho sprint tiếp:

- **Module Variation** (QĐ 2289 Chương V) — phức tạp hơn vì cần phê chuẩn Cục HKVN, workflow đa tầng.
- **Tích hợp ràng buộc QĐ 2701 Điều 6.5** vào solver — quân số tại TWR theo lịch bay (tối thiểu 60 phút trước giờ tàu bay đến/đi phải có 2 KSVKL). Cần dữ liệu lịch bay thực, có thể từ AFTN/FPL.
- **Test integration end-to-end** với supertest — gọi NestJS controller → Analytics → DB.

Bạn ưu tiên hướng nào, mình sẽ viết kế hoạch chi tiết khi gần đến đó.
