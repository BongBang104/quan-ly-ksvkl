# PLAN_INTEGRATION_V2 — Rà soát phân ca + Tích hợp đầu cuối

> **Thay thế hoàn toàn** `PLAN_INTEGRATION.md` cũ. Dựa trên:
> - **QĐ 2288/QĐ-QLB (25/3/2026)** — Quy định Quản lý rủi ro mệt mỏi cho KSVKL của VATM. **Văn bản nền.**
> - **QĐ 2701/QĐ-QLB (07/5/2024)** — Quy định chế độ ca, kíp trực; bàn giao, nhận ca; bình giảng sau ca. **Bám theo QĐ 2288.**
> - **QĐ 2289/QĐ-QLB (25/3/2026)** — Chương trình Quản lý mệt mỏi (FMP). Khung tổ chức, không áp ngưỡng.
>
> Mục tiêu: chuyển mọi ngưỡng "ví dụ" sang đúng quy định pháp lý, gộp rà soát vào màn hình phân ca, mở rộng cho cấp trung tâm, sinh tự động checklist QĐ 2288 Phụ lục I, và điều chỉnh tab Báo cáo hiện có cho khớp form/workflow của QĐ.
>
> **Cách dùng:** đặt file vào thư mục gốc dự án. Yêu cầu Claude trong VSCode: "Đọc PLAN_INTEGRATION_V2.md, làm tuần tự, sau mỗi mục chạy bước Xác minh thực sự, ghi DONE vào CHANGELOG_INTEGRATION.md. Khi gặp câu hỏi mở, dừng và hỏi."

---

## Nguyên tắc xuyên suốt

1. **QĐ 2288 là gốc.** Mọi ngưỡng theo QĐ 2288 Chương IV. Khi QĐ 2701 nêu cùng vấn đề ở góc độ vận hành (vd. on-call), bám vào ngưỡng 2288 nhưng giữ workflow của 2701.
2. **Mỗi trường trong `RestRuleConfig` có citation pháp lý.** Comment ghi rõ `# QĐ 2288 Điều X.Y` hoặc `# QĐ 2701 Điều Z`, kèm `EFFECTIVE_FROM = "2026-03-25"`. Khi pháp luật đổi, đổi citation và ngày.
3. **Hai cấp rà soát độc lập:**
   - `DetailedRosterModal` (vi mô): time-in-position, phủ năng định từng phiên, nghỉ giữa phiên, hoán đổi cùng khung giờ.
   - `SchedulerScreen` (vĩ mô): giờ 30 ngày, ngày liên tiếp, ca đêm liên tiếp + nghỉ phục hồi, phân bố on-call.
4. **Vị trí phụ trợ (HDA/HDC/HDT/HDG, TKT_T6/T8, QS)** đã có trong code — không động lại.
5. **Công cụ HỖ TRỢ.** Mọi đầu ra ghi rõ "Quyết định cuối thuộc kíp trưởng/cán bộ cơ sở." Tinh thần "Just Culture" của QĐ 2288 Điều 8 và QĐ 2289 Chương I.V.5.
6. **Không refactor** ngoài phạm vi từng mục. Trước khi sửa file lớn, `view` nguyên file. Gặp xung đột — dừng và hỏi.
7. **Sau mỗi mục:** chạy bước Xác minh thực sự (không tự tin là đã làm), ghi `[DONE] Mục N — <tên> — <ngày>` vào `CHANGELOG_INTEGRATION.md`.

---

# PHẦN 1 — Cập nhật ngưỡng theo QĐ 2288

## Mục 1.1 — Viết lại `RestRuleConfig` với citation đầy đủ

**File:** `analytics/app/compliance/rest_compliance.py`

`view` toàn file trước. Tìm class `RestRuleConfig` hiện có, **thay thế nguyên khối** bằng phiên bản dưới đây. Giữ nguyên tên trường nếu trùng — để không phá test đã pass; chỉ đổi giá trị mặc định và thêm trường mới.

```python
@dataclass
class RestRuleConfig:
    """Ngưỡng quy định cho KSVKL — bám theo QĐ 2288/QĐ-QLB ngày 25/3/2026.

    Nguồn pháp lý:
    - QĐ 2288/QĐ-QLB (25/3/2026) — Quy định Quản lý rủi ro mệt mỏi cho KSVKL của VATM.
    - QĐ 2701/QĐ-QLB (07/5/2024) — Chế độ ca, kíp trực, bàn giao ca, bình giảng.

    Khi văn bản pháp lý thay đổi: cập nhật EFFECTIVE_FROM và các trường tương ứng.
    Đặt một trường = None để bỏ qua quy tắc đó.
    """
    # Phiên bản quy định (cập nhật khi pháp luật đổi)
    effective_from: str = "2026-03-25"
    source_primary: str = "QĐ 2288/QĐ-QLB"

    # ── Chương IV Điều 11: Giới hạn theo ngày, tuần ─────────────────────────
    # Điều 11.1: Tổng thời gian thực hiện nhiệm vụ (gồm cả nghỉ trong ca) ≤ 10h
    max_designed_shift_hours: float | None = 10.0
    # Điều 11.3: Khi có làm thêm, tổng ngày ≤ 12h (kéo dài ca)
    max_extended_shift_hours: float | None = 12.0
    # Điều 11.2: Giờ làm bình thường/tuần ≤ 48
    max_duty_hours_per_week: float | None = 48.0

    # ── Chương IV Điều 12: Giới hạn tích lũy 30 ngày ─────────────────────────
    # Điều 12.1: Tổng giờ trong 30 ngày liên tiếp ≤ 180h
    max_duty_hours_per_30days: float | None = 180.0
    # Điều 12.2: Số ngày làm liên tiếp ≤ 6, sau đó nghỉ ≥ 24h liên tục
    max_consecutive_working_days: int | None = 6
    min_rest_after_6consecutive_days_hours: float | None = 24.0
    # Điều 12.2: Trong 30 ngày, ≥ 4 ngày nghỉ (24h liên tục mỗi ngày)
    min_full_rest_days_per_30days: int | None = 4

    # ── Chương IV Điều 13: Nghỉ giữa hai ca ─────────────────────────────────
    # Điều 13.1: ≥ 12 giờ liên tục
    min_rest_between_shifts_hours: float | None = 12.0

    # ── Chương IV Điều 14: Giới hạn trong ca trực ───────────────────────────
    # Điều 14.1.a: Thời gian trực tiếp tại vị trí liên tục ≤ 2h
    max_on_position_minutes: int | None = 120
    # Điều 14.1.b: Khi lưu lượng thấp, kíp trưởng có thể nới lên 4h
    max_on_position_low_traffic_minutes: int | None = 240
    # Điều 14.2.a: Nghỉ sau phiên — ngày ≥ 30 phút, đêm ≥ 45 phút
    min_break_after_position_day_minutes: int | None = 30
    min_break_after_position_night_minutes: int | None = 45
    # Điều 14: gộp phiên liền kề cùng vị trí (giữ trường cũ)
    merge_adjacent_session_gap_minutes: int = 0

    # ── Chương IV Điều 15: Ca đêm, ca sớm, ca muộn ──────────────────────────
    # Điều 15.1.a: Ca đêm = phần lớn thời gian trong 22h00-06h00
    night_window_start_hour: int = 22
    night_window_end_hour: int = 6
    # Điều 15.1.b: Không quá 3 ca đêm liên tiếp
    max_consecutive_night_shifts: int | None = 3
    # Điều 15.1.c: Sau chuỗi 3 ca đêm, nghỉ ≥ 48h, có ≥ 2 đêm ngủ đầy đủ
    min_rest_after_night_block_hours: float | None = 48.0
    min_full_sleep_nights_after_night_block: int = 2
    # Điều 15.2.a: Ca sớm bắt đầu 04h00-07h00 (cảnh báo, không cấm)
    early_shift_window_start_hour: int = 4
    early_shift_window_end_hour: int = 7
    # Điều 15.2.b: Không sắp ca sớm ngay sau ca muộn/đêm (trừ đánh giá rủi ro)
    forbid_early_after_late_or_night: bool = True
    late_shift_end_hour: int = 22

    # ── Chương IV Điều 16: Trực dự phòng on-call ───────────────────────────
    # QĐ 2288 Điều 16.1 + QĐ 2701 Điều 7.2: ≤ 3 lần on-call/7 ngày liên tiếp
    max_oncall_per_7days: int | None = 3
    # QĐ 2288 Điều 16.2: thời lượng tối đa mỗi lượt on-call ≤ 20h
    max_oncall_duration_hours: float | None = 20.0
    # QĐ 2701 Điều 7.2.a: số lượng KSVKL on-call ≥ 20% kíp (kíp ≥ 6 người)
    oncall_min_ratio_per_shift: float = 0.20

    # ── Chương IV Điều 17: Ngưỡng thức liên tục — TẠM BỎ QUA ─────────────
    # Điều 17.2: 16h. Cần dữ liệu giấc ngủ KSVKL (FRMS), roster đơn thuần
    # không tính được. Phương án (a) theo lựa chọn của người dùng: bỏ qua.
    # Khi có module báo cáo FRMS, mở lại bằng cách đặt giá trị này.
    max_continuous_awake_hours: float | None = None

    # ── Năng định theo vị trí (đã có trong code) ───────────────────────────
    max_days_between_position_use: int | None = 90
```

**Xác minh:**
- `grep -c "QĐ 2288\|QĐ 2701" analytics/app/compliance/rest_compliance.py` ≥ 10.
- `cd analytics && pytest tests/test_rest_compliance.py -q` vẫn pass (số test cũ + bằng cũ).
- Nếu test fail vì giá trị mặc định thay đổi, **không đổi test**: đó là test đang kiểm chứng giá trị mặc định cũ. Đọc thông báo lỗi, xác định test nào dùng số cứng, sửa test sang `CFG = RestRuleConfig()` rồi dùng động — KHÔNG hard-code số mới vào test.

---

## Mục 1.2 — Bổ sung quy tắc nghỉ sau phiên (phân biệt ngày/đêm)

**File:** `analytics/app/compliance/rest_compliance.py`

Trong `ComplianceChecker`, thêm method mới:

```python
def _check_break_after_position(self, shifts):
    """Sau mỗi phiên vị trí phải có nghỉ ≥ 30 phút (ca ngày) hoặc ≥ 45 phút (ca đêm).
    QĐ 2288 Điều 14.2.a. Áp dụng cho mọi cặp phiên liền kề trong cùng ca,
    trừ phiên cuối của ca (không có phiên kế tiếp để kiểm tra).
    """
    out = []
    day_min = self.cfg.min_break_after_position_day_minutes
    night_min = self.cfg.min_break_after_position_night_minutes
    if day_min is None and night_min is None:
        return out
    for s in shifts:
        sessions = sorted(s.sessions, key=lambda x: x.start)
        for cur, nxt in zip(sessions, sessions[1:]):
            gap_min = (nxt.start - cur.end).total_seconds() / 60.0
            required = night_min if s.is_night else day_min
            if required is None or gap_min >= required:
                continue
            out.append(Violation(
                rule="min_break_after_position",
                severity=Severity.WARNING,
                controller_id=s.controller_id, controller_name=s.controller_name,
                message=(
                    f"Chỉ nghỉ {gap_min:.0f} phút sau phiên {cur.position.value} "
                    f"(ca {'đêm' if s.is_night else 'ngày'}), dưới mức tối thiểu "
                    f"{required} phút (QĐ 2288 Điều 14.2.a)."
                ),
                related_shift_ids=[s.shift_id],
            ))
    return out
```

Trong `check_controller`, gọi thêm `out += self._check_break_after_position(shifts)`.

**Xác minh:** thêm 2 test mới trong `tests/test_rest_compliance.py`:
- Phiên ngày, gap = `day_min - 5 phút` → vi phạm.
- Phiên đêm, gap = `night_min - 5 phút` → vi phạm; gap = `night_min` → không vi phạm.

Tổng test ≥ +2.

---

## Mục 1.3 — Bổ sung quy tắc on-call

**File:** `analytics/app/compliance/rest_compliance.py`

Thêm class mới và quy tắc kiểm tra. **Trước khi sửa**, hỏi người dùng: "Trong dữ liệu hiện tại có ghi nhận on-call không? Nếu có, lưu ở đâu (cột nào trong shift, hay bảng riêng)?"

Nếu CHƯA có dữ liệu on-call: tạm thời stub class này, có method nhưng không gắn vào `check_all` cho đến khi có dữ liệu. Ghi chú rõ trong code.

```python
@dataclass
class OncallAssignment:
    """Một lượt trực dự phòng từ xa (on-call). QĐ 2288 Điều 16, QĐ 2701 Điều 7.2."""
    controller_id: str | int
    controller_name: str
    start: datetime
    end: datetime
    activated: bool = False  # True nếu được gọi vào trực thật

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


def check_oncall_limits(
    oncalls: list[OncallAssignment],
    cfg: RestRuleConfig,
) -> list[Violation]:
    """Kiểm tra giới hạn on-call. KHÔNG gọi từ check_all() vì on-call không
    nằm trong list[Shift]; gọi riêng từ tầng review khi có dữ liệu."""
    out: list[Violation] = []
    # 1. Mỗi lượt ≤ 20h (QĐ 2288 Điều 16.2)
    if cfg.max_oncall_duration_hours is not None:
        for oc in oncalls:
            if oc.duration_hours > cfg.max_oncall_duration_hours:
                out.append(Violation(
                    rule="max_oncall_duration", severity=Severity.WARNING,
                    controller_id=oc.controller_id, controller_name=oc.controller_name,
                    message=(
                        f"Lượt on-call kéo dài {oc.duration_hours:.1f} giờ, "
                        f"vượt giới hạn {cfg.max_oncall_duration_hours} giờ "
                        f"(QĐ 2288 Điều 16.2)."
                    ),
                    related_shift_ids=[],
                ))
    # 2. Mỗi người ≤ 3 lần/7 ngày (QĐ 2288 Điều 16.1)
    if cfg.max_oncall_per_7days is not None:
        by_person: dict = {}
        for oc in oncalls:
            by_person.setdefault(oc.controller_id, []).append(oc)
        for cid, lst in by_person.items():
            lst.sort(key=lambda x: x.start)
            for i, anchor in enumerate(lst):
                window_end = anchor.start + timedelta(days=7)
                count = sum(1 for oc in lst[i:] if oc.start < window_end)
                if count > cfg.max_oncall_per_7days:
                    out.append(Violation(
                        rule="max_oncall_per_7days", severity=Severity.WARNING,
                        controller_id=cid, controller_name=lst[i].controller_name,
                        message=(
                            f"{count} lượt on-call trong 7 ngày kể từ {anchor.start.date()}, "
                            f"vượt giới hạn {cfg.max_oncall_per_7days} (QĐ 2288 Điều 16.1)."
                        ),
                        related_shift_ids=[],
                    ))
                    break  # đã báo cho người này
    return out
```

**Xác minh:** thêm test trong `tests/test_rest_compliance.py`:
- 4 lượt on-call trong 7 ngày của một người → vi phạm.
- 3 lượt → không vi phạm.
- 1 lượt dài 25h → vi phạm `max_oncall_duration`.

---

## Mục 1.4 — Phân loại loại ca (ShiftKind)

**File:** `analytics/app/compliance/rest_compliance.py`

Hiện chỉ có `Shift.is_night: bool`. QĐ 2288 Điều 15 phân biệt EARLY/LATE/NIGHT/NORMAL. Thêm enum:

```python
class ShiftKind(Enum):
    """Phân loại ca theo QĐ 2288 Điều 15."""
    NORMAL = "NORMAL"
    EARLY  = "EARLY"   # bắt đầu 04h00-07h00
    LATE   = "LATE"    # kết thúc sau 22h00
    NIGHT  = "NIGHT"   # phần lớn thời gian trong 22h00-06h00


def classify_shift_kind(start: datetime, end: datetime, cfg: RestRuleConfig) -> ShiftKind:
    """Phân loại ca dựa trên khung giờ và cấu hình."""
    # NIGHT: phần lớn thời gian trong [night_window_start, night_window_end+24)
    # Đơn giản: nếu start ≥ 22h hoặc start < 6h → NIGHT.
    if start.hour >= cfg.night_window_start_hour or start.hour < cfg.night_window_end_hour:
        return ShiftKind.NIGHT
    if cfg.early_shift_window_start_hour <= start.hour < cfg.early_shift_window_end_hour:
        return ShiftKind.EARLY
    if end.hour >= cfg.late_shift_end_hour or end.hour < cfg.early_shift_window_start_hour:
        return ShiftKind.LATE
    return ShiftKind.NORMAL
```

**KHÔNG xóa** trường `is_night`. Bổ sung trường mới `Shift.kind: ShiftKind | None = None`, để code cũ vẫn chạy:

```python
@dataclass
class Shift:
    # ... các trường hiện có ...
    is_night: bool = False
    kind: ShiftKind | None = None  # nếu None, suy từ is_night
```

Thêm property:
```python
@property
def effective_kind(self) -> ShiftKind:
    if self.kind is not None:
        return self.kind
    return ShiftKind.NIGHT if self.is_night else ShiftKind.NORMAL
```

**Xác minh:** test `classify_shift_kind` cho 4 khung giờ điển hình → trả về đúng kind.

---

## Mục 1.5 — Quy tắc cấm ca sớm ngay sau ca muộn/đêm

```python
def _check_early_after_late_or_night(self, shifts):
    """QĐ 2288 Điều 15.2.b: Không sắp ca sớm ngay sau ca muộn/đêm, trừ
    trường hợp đánh giá rủi ro. Áp dụng cho hai ca liền kề của cùng người."""
    out = []
    if not self.cfg.forbid_early_after_late_or_night:
        return out
    for prev, nxt in zip(shifts, shifts[1:]):
        prev_kind = prev.effective_kind
        nxt_kind  = nxt.effective_kind
        if nxt_kind == ShiftKind.EARLY and prev_kind in {ShiftKind.LATE, ShiftKind.NIGHT}:
            out.append(Violation(
                rule="early_after_late_or_night", severity=Severity.WARNING,
                controller_id=prev.controller_id, controller_name=prev.controller_name,
                message=(
                    f"Ca {nxt_kind.value} ngay sau ca {prev_kind.value} "
                    f"(QĐ 2288 Điều 15.2.b — cần đánh giá rủi ro/deviation)."
                ),
                related_shift_ids=[prev.shift_id, nxt.shift_id],
            ))
    return out
```

Gọi từ `check_controller`. Thêm 2 test.

---

# PHẦN 2 — Gộp Analytics vào DetailedRosterModal

## Mục 2.1 — Thực hiện Phase A-C của PLAN_INTEGRATION (cũ) với chỉnh sửa

Phần này **tái sử dụng** kế hoạch trong `PLAN_INTEGRATION.md` cũ (đã không còn dùng nhưng nội dung Phase A/B/C còn giá trị). Cụ thể:

**Mục 2.1.a** — Analytics: thêm endpoint `POST /analytics/roster/review-draft` với:
- Schema `RosterDraft` y như `PLAN_INTEGRATION.md` mục A1.
- Converter `convert_draft` y như mục A2, **nhưng** trong constructor `Shift`, bổ sung tính `kind`:
  ```python
  kind = classify_shift_kind(start, end, cfg)
  ```
  thay vì chỉ `is_night = draft.shift_code.upper() == "D"`.
- Endpoint y như mục A3.

**Mục 2.1.b** — NestJS: `AnalyticsModule`, `AnalyticsClient`, `AnalyticsController` y như mục B1-B3 của PLAN_INTEGRATION cũ. Endpoint `POST /api/schedules/review-roster-draft`.

**Mục 2.1.c** — Frontend: thêm hàm `reviewRosterDraft` vào `src/services/ApiService.js`, mở rộng `DetailedRosterModal` y như mục C1-C4 của PLAN_INTEGRATION cũ.

**Khác biệt với plan cũ:**
- `ReviewResultPanel` hiển thị thêm trường `legal_basis` (mỗi vi phạm có viện dẫn điều luật).
- Khi `unknown_abbreviations` không rỗng: chỉ CẢNH BÁO, không chặn publish (đây là điều bạn từng nói "nhân sự ngoài kíp" có thể xuất hiện hợp pháp như OJTI). Đổi tinh thần Mục C4: chỉ chặn publish khi có vi phạm CRITICAL từ analytics (mismatched qualification), abbr không xác định chỉ là warning.

**Xác minh:** smoke test theo Mục E1 của PLAN_INTEGRATION cũ.

---

## Mục 2.2 — Loại bỏ tab Analytics riêng

**File:** `App.jsx`

`view` toàn file để biết đang dùng menu/route gì. Tìm cụm:
```jsx
case 'ANALYTICS': return <AnalyticsScreen ... />;
```
**KHÔNG xóa AnalyticsScreen** — chỉ đổi vai trò ở mục 2.3. Tạm thời, sau khi rà soát đã nằm trong `DetailedRosterModal`, **đổi nhãn menu** từ "Phân tích" / "Analytics" sang "Báo cáo":

Tìm trong menu items:
```jsx
{ id: 'ANALYTICS', icon: '...', label: 'Phân tích', section: '...' }
```
Đổi thành:
```jsx
{ id: 'ANALYTICS', icon: '...', label: 'Báo cáo', section: 'MANAGE' }
```

Sau Mục 3 và 4 dưới đây, AnalyticsScreen sẽ được tái cấu trúc thành màn hình báo cáo tổng hợp.

**Xác minh:** UI hiển thị "Báo cáo" thay vì "Phân tích" / "Analytics".

---

# PHẦN 3 — Rà soát cấp Trung tâm cho SchedulerScreen

## Mục 3.1 — Schema cho draft cấp tháng/chu kỳ

**File mới:** `analytics/app/routers/schemas_macro.py`

```python
"""Schemas cho rà soát phân ca cấp trung tâm (SchedulerScreen).

Cấp trung tâm phân *KSVKL X làm kíp/ca Y vào ngày Z*, chưa đến mức phân vị trí.
Quy tắc kiểm tra khác hẳn cấp ca chi tiết — xem rest_compliance + chu_ky_review.
"""
from __future__ import annotations
from datetime import date
from pydantic import BaseModel, Field


class ControllerMacroInfo(BaseModel):
    """Thông tin KSVKL gửi kèm draft cấp tháng."""
    id: str
    name: str
    abbr: str = ""
    team: str = Field(..., description="Kíp A/B/C/D... hoặc 'Trung tâm'")
    qualification: str = ""


class DayAssignment(BaseModel):
    """Một ngày, một KSVKL, một loại ca."""
    date: date
    controller_id: str
    shift_kind: str = Field(
        ...,
        description="'S' (ngày), 'D' (đêm), 'OFF', 'ONCALL', 'LEAVE' (nghỉ phép), "
                    "'TRAINING' (đi học), 'REINFORCE' (tăng cường ngoài kíp gốc)"
    )
    # Tùy chọn: nếu cơ sở dùng giờ ca cụ thể (07h-19h, 19h-07h, ...) thì có thể nhập.
    # Nếu không, analytics suy từ shift_kind theo cấu hình chuẩn.
    start_hour: int | None = None
    end_hour: int | None = None


class MacroRosterDraft(BaseModel):
    """Bản phân ca cấp tháng / chu kỳ 14 ngày, gửi từ SchedulerScreen."""
    period_start: date
    period_end:   date
    controllers:  list[ControllerMacroInfo]
    assignments:  list[DayAssignment]


class MacroReviewResult(BaseModel):
    can_publish:  bool
    violations:   list[dict]
    suggestions:  list[dict]
    coverage_warnings: list[dict] = Field(
        default_factory=list,
        description="Cảnh báo về ngày thiếu năng định bao phủ trong kíp trực."
    )
```

---

## Mục 3.2 — Module review cấp trung tâm

**File mới:** `analytics/app/review/chu_ky_review.py`

```python
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
from datetime import date, datetime, timedelta
from dataclasses import dataclass, field

from app.compliance.rest_compliance import (
    Shift, PositionSession, Position, Qualification, RestRuleConfig,
    ComplianceChecker, OncallAssignment, check_oncall_limits, ALL_POSITIONS,
    Severity, Violation, ShiftKind, classify_shift_kind,
)
from app.routers.schemas_macro import MacroRosterDraft, MacroReviewResult


# Giờ ca chuẩn nếu draft không nêu cụ thể. Cấu hình trong cfg sau này.
DEFAULT_SHIFT_HOURS = {
    "S": (7, 19),     # ca ngày 07-19
    "D": (19, 31),    # ca đêm 19-07 hôm sau (31 = 24+7)
    "OFF": None,
    "LEAVE": None,
    "TRAINING": None,
    "ONCALL": None,
    "REINFORCE": (7, 19),  # mặc định theo ngày, có thể được ghi đè
}


def _to_shift(asg, controller_name: str, shift_id: int, cfg: RestRuleConfig) -> Shift | None:
    """Quy đổi DayAssignment sang Shift để feed vào ComplianceChecker."""
    if asg.shift_kind in ("OFF", "LEAVE", "TRAINING", "ONCALL"):
        return None  # không tạo Shift
    hours = (asg.start_hour, asg.end_hour) if asg.start_hour is not None else DEFAULT_SHIFT_HOURS.get(asg.shift_kind)
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
        sessions=[],  # cấp tháng không có session — checker bỏ qua các quy tắc cần session
    )


def _check_qualification_coverage_per_day(draft: MacroRosterDraft) -> list[dict]:
    """Mỗi ngày trong period phải có ít nhất 1 KSVKL có năng định cho mỗi vị trí
    điều hành chính (APP/CTL/TWR/GCU) trong số những người làm ca ngày đó.
    Trả về danh sách cảnh báo."""
    from collections import defaultdict
    warnings = []
    quals = {c.id: c.qualification for c in draft.controllers}
    names = {c.id: c.name for c in draft.controllers}

    def has(qual_str: str, pos: Position) -> bool:
        if qual_str.strip().lower() == "full":
            return True
        return pos.value in [t.strip().upper() for t in qual_str.split(",")]

    by_day = defaultdict(list)  # date -> list[controller_id] làm ca thực
    for asg in draft.assignments:
        if asg.shift_kind in ("S", "D", "REINFORCE"):
            by_day[asg.date].append(asg.controller_id)

    for d, cids in by_day.items():
        for pos in [Position.APP, Position.CTL, Position.TWR, Position.GCU]:
            n_qual = sum(1 for cid in cids if has(quals.get(cid, ""), pos))
            if n_qual == 0:
                warnings.append({
                    "date": d.isoformat(),
                    "position": pos.value,
                    "message": (
                        f"Ngày {d}: KHÔNG có KSVKL nào có năng định {pos.value} "
                        f"trong số người làm ca. (QĐ 2288 yêu cầu đủ năng lực điều hành)"
                    ),
                })
    return warnings


def _build_oncalls(draft: MacroRosterDraft) -> list[OncallAssignment]:
    """Quy đổi assignments có shift_kind='ONCALL' thành OncallAssignment."""
    names = {c.id: c.name for c in draft.controllers}
    out = []
    for asg in draft.assignments:
        if asg.shift_kind != "ONCALL":
            continue
        sh_start, sh_end = asg.start_hour or 0, asg.end_hour or 20
        start = datetime.combine(asg.date, datetime.min.time()) + timedelta(hours=sh_start)
        end   = datetime.combine(asg.date, datetime.min.time()) + timedelta(hours=sh_end)
        out.append(OncallAssignment(
            controller_id=asg.controller_id,
            controller_name=names.get(asg.controller_id, asg.controller_id),
            start=start, end=end, activated=False,
        ))
    return out


def review_macro_draft(draft: MacroRosterDraft, cfg: RestRuleConfig | None = None) -> MacroReviewResult:
    """Rà soát phân ca cấp tháng. Trả MacroReviewResult."""
    cfg = cfg or RestRuleConfig()
    names = {c.id: c.name for c in draft.controllers}

    # Dựng list[Shift] để dùng ComplianceChecker đã có
    shifts: list[Shift] = []
    for i, asg in enumerate(draft.assignments, start=1):
        sh = _to_shift(asg, names.get(asg.controller_id, asg.controller_id), i, cfg)
        if sh is not None:
            shifts.append(sh)

    checker = ComplianceChecker(cfg)
    # Bỏ các quy tắc cần session (cấp tháng không có)
    raw_violations = checker.check_all(shifts, qualifications=None)
    macro_violations = [
        {
            "rule": v.rule,
            "severity": v.severity.value,
            "controller_id": str(v.controller_id),
            "controller_name": v.controller_name,
            "message": v.message,
            "related_shift_ids": v.related_shift_ids,
        }
        for v in raw_violations
        if v.rule not in {"max_on_position", "qualification_coverage", "position_recency",
                          "min_break_after_position"}
    ]

    # Bổ sung kiểm tra on-call
    oncalls = _build_oncalls(draft)
    oncall_violations = check_oncall_limits(oncalls, cfg)
    macro_violations.extend([
        {
            "rule": v.rule, "severity": v.severity.value,
            "controller_id": str(v.controller_id), "controller_name": v.controller_name,
            "message": v.message, "related_shift_ids": v.related_shift_ids,
        } for v in oncall_violations
    ])

    coverage_warnings = _check_qualification_coverage_per_day(draft)
    can_publish = not any(v["severity"] == Severity.CRITICAL.value for v in macro_violations)

    return MacroReviewResult(
        can_publish=can_publish,
        violations=macro_violations,
        suggestions=[],  # cấp tháng — đề xuất phức tạp hơn, làm sau
        coverage_warnings=coverage_warnings,
    )
```

---

## Mục 3.3 — Endpoint và route cho rà soát cấp tháng

**File:** `analytics/app/routers/roster.py` (hoặc tạo `routers/macro.py` nếu file gốc đã đầy)

Thêm endpoint:
```python
from app.routers.schemas_macro import MacroRosterDraft, MacroReviewResult
from app.review.chu_ky_review import review_macro_draft

@router.post("/macro/review", response_model=MacroReviewResult)
def review_macro(draft: MacroRosterDraft) -> MacroReviewResult:
    """Rà soát phân ca cấp trung tâm (SchedulerScreen). QĐ 2288 + QĐ 2701."""
    return review_macro_draft(draft)
```

**Xác minh:** test `tests/test_macro_review.py` với 4 trường hợp:
- Draft sạch → can_publish=true.
- KSVKL làm 7 ngày liên tiếp → vi phạm `max_consecutive_days`.
- 4 ca đêm liên tiếp cho một người → vi phạm `max_consecutive_nights`.
- Ngày X không có ai có năng định APP → coverage_warning.

---

## Mục 3.4 — NestJS proxy cho macro review

**File:** `backend/src/analytics/analytics.controller.ts`

Thêm endpoint mới song song với `review-roster-draft`:
```typescript
class MacroReviewDto {
  @IsString() period_start!: string;
  @IsString() period_end!: string;
  @IsArray() assignments!: any[];
  @IsArray() @IsOptional() abbreviations?: string[];
}

@Post('review-macro-roster')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
async reviewMacro(@Body() dto: MacroReviewDto) {
  // Thu thập controller_id từ assignments
  const cids = new Set<string>();
  for (const a of dto.assignments ?? []) {
    if (a.controller_id) cids.add(a.controller_id);
  }
  const ids = [...cids];
  const emps = ids.length
    ? await this.empRepo.find({ where: { id: In(ids), isApproved: true } })
    : [];
  const controllers = emps.map(e => ({
    id: e.id, name: e.name, abbr: e.icaoCode ?? "",
    team: e.team ?? "", qualification: e.qualification ?? "",
  }));
  return this.client.reviewMacro({
    period_start: dto.period_start,
    period_end:   dto.period_end,
    controllers,
    assignments: dto.assignments,
  });
}
```

Thêm method tương ứng vào `AnalyticsClient`:
```typescript
async reviewMacro(payload: any): Promise<any> {
  try {
    const res = await firstValueFrom(
      this.http.post('/analytics/roster/macro/review', payload),
    );
    return res.data;
  } catch (err: any) {
    this.log.error(`Analytics macro call failed: ${err?.message}`);
    throw new ServiceUnavailableException('Dịch vụ phân tích chưa sẵn sàng.');
  }
}
```

---

## Mục 3.5 — Tích hợp vào SchedulerScreen

**File:** `src/screens/SchedulerScreen.jsx`

**`view` toàn file** trước. Cần xác định:
- Cấu trúc dữ liệu `scheduleData` (mảng nào chứa thông tin ngày × KSVKL × ca?).
- Vị trí render thanh công cụ (nơi đặt nút "Rà soát").
- Có hàm `handlePublish` không (để khóa khi vi phạm CRITICAL).

Nếu cấu trúc dữ liệu khác mô tả mục 3.1, **DỪNG và hỏi người dùng** về cách chuyển đổi `scheduleData` sang `assignments[]`.

Sau khi xác định được, thêm:

```jsx
// import
import { reviewMacroRoster } from '../services/ApiService';
import ReviewResultPanel from '../components/ReviewResultPanel.jsx';

// state
const [macroReview, setMacroReview] = useState(null);
const [reviewing,   setReviewing]   = useState(false);
const [reviewError, setReviewError] = useState(null);

// handler — sửa converter theo cấu trúc thực tế
const handleMacroReview = useCallback(async () => {
  setReviewing(true);
  setReviewError(null);
  try {
    // CHUYỂN scheduleData thành assignments[]
    // GỢI Ý: lặp qua ngày × KSVKL, đọc ô shiftCode (S/D/OFF/...)
    const assignments = [];
    // ... (Claude phải tự sửa theo cấu trúc thực)
    const result = await reviewMacroRoster({
      period_start: startDate.toISOString().slice(0, 10),
      period_end: /* 14 ngày sau */,
      assignments,
    });
    setMacroReview(result);
  } catch (e) {
    setReviewError(e?.response?.data?.message ?? e.message);
  } finally {
    setReviewing(false);
  }
}, [/* deps */]);

// JSX: thêm nút "Rà soát chu kỳ" cạnh nút Publish
{isAdmin && (
  <button onClick={handleMacroReview} disabled={reviewing}>
    {reviewing ? 'Đang rà soát…' : 'Rà soát chu kỳ'}
  </button>
)}
{macroReview && <ReviewResultPanel result={macroReview} />}
```

**File:** `src/services/ApiService.js` — thêm:
```js
export const reviewMacroRoster = async (payload) => {
  const res = await api.post('/api/schedules/review-macro-roster', payload);
  return res.data;
};
```

**Xác minh:** chạy dev đầy đủ, mở SchedulerScreen, bấm Rà soát chu kỳ với dữ liệu thật → hiển thị kết quả.

---

# PHẦN 4 — Sinh tự động Checklist Phụ lục I (QĐ 2288)

## Mục 4.1 — Schema và logic sinh checklist

**File mới:** `analytics/app/review/qd2288_checklist.py`

```python
"""
qd2288_checklist.py
===================
Sinh tự động Checklist đánh giá lịch trực theo Phụ lục I của QĐ 2288.
Cấu trúc: A1-A5 (giới hạn thời gian), B1-B4 (nghỉ giữa ca), C1-C5 (trực đêm),
D1-D4 (on-call), E1-E5 (nguy cơ tiềm ẩn).

Đầu vào: kết quả review (vi phạm + cảnh báo) + draft gốc.
Đầu ra: dict đúng cấu trúc Phụ lục I, dùng để xuất PDF.
"""
from __future__ import annotations
from typing import Literal


Status = Literal["pass", "fail", "na"]


def _status(violated: bool) -> Status:
    return "fail" if violated else "pass"


def build_checklist(violations: list[dict], draft) -> dict:
    """Sinh checklist Phụ lục I từ kết quả review.

    `violations` là list các dict đã chuẩn hóa (xem schemas).
    `draft` là RosterDraft (cấp ca) hoặc MacroRosterDraft (cấp tháng) — hỗ trợ cả hai.
    """
    by_rule = {}
    for v in violations:
        by_rule.setdefault(v["rule"], []).append(v)

    has = lambda rule: rule in by_rule

    return {
        "header": {
            "source": "QĐ 2288/QĐ-QLB Phụ lục I",
            "effective_from": "2026-03-25",
        },
        "sections": [
            {
                "code": "A", "title": "GIỚI HẠN THỜI GIAN LÀM VIỆC - CẤP LỊCH",
                "items": [
                    {"code": "A1", "criterion": "Ca làm việc thiết kế ≤ 10h",
                     "requirement": "Không vượt",
                     "status": _status(has("max_designed_shift")),
                     "note": "; ".join(v["message"] for v in by_rule.get("max_designed_shift", []))},
                    {"code": "A2", "criterion": "Ca có khả năng kéo dài ≤ 12h",
                     "requirement": "Có kiểm soát",
                     "status": _status(has("max_extended_shift")),
                     "note": ""},
                    {"code": "A3", "criterion": "Tổng giờ/tuần theo mẫu ≤ 48h",
                     "requirement": "Tuân thủ",
                     "status": _status(has("max_duty_per_week")),
                     "note": ""},
                    {"code": "A4", "criterion": "Mẫu lịch 30 ngày ≤ 180h/người",
                     "requirement": "Tuân thủ",
                     "status": _status(has("max_duty_per_30days")),
                     "note": ""},
                    {"code": "A5", "criterion": "Có ≥ 4 ngày nghỉ/30 ngày",
                     "requirement": "Đảm bảo",
                     "status": _status(has("min_full_rest_days_per_30days")),
                     "note": ""},
                ],
            },
            {
                "code": "B", "title": "NGHỈ GIỮA CÁC CA - ĐÁNH GIÁ CHUỖI CA",
                "items": [
                    {"code": "B1", "criterion": "Nghỉ giữa 2 ca ≥ 12h",
                     "requirement": "Không vi phạm",
                     "status": _status(has("min_rest_between_shifts")),
                     "note": ""},
                    {"code": "B2", "criterion": "Chuỗi ca sớm → muộn hợp lý",
                     "requirement": "Tránh đảo chiều",
                     "status": _status(has("early_after_late_or_night")),
                     "note": ""},
                    {"code": "B3", "criterion": "Không có chuỗi 'kết thúc muộn - bắt đầu sớm'",
                     "requirement": "Bị cấm",
                     "status": _status(has("early_after_late_or_night")),
                     "note": ""},
                    {"code": "B4", "criterion": "Có đủ cơ hội ngủ thực tế",
                     "requirement": "Xem xét di chuyển",
                     "status": "na",  # cần dữ liệu FRMS để chấm
                     "note": "Cần dữ liệu báo cáo cá nhân để chấm."},
                ],
            },
            {
                "code": "C", "title": "THIẾT KẾ TRỰC ĐÊM",
                "items": [
                    {"code": "C1", "criterion": "Ca đêm đúng khung 22h-06h", "requirement": "Chuẩn hóa",
                     "status": "pass", "note": ""},  # phân loại ShiftKind đã đảm bảo
                    {"code": "C2", "criterion": "Không quá 3 ca đêm liên tiếp", "requirement": "Bắt buộc",
                     "status": _status(has("max_consecutive_nights")), "note": ""},
                    {"code": "C3", "criterion": "Có nghỉ phục hồi ≥ 48h sau chuỗi đêm",
                     "requirement": "Bắt buộc",
                     "status": _status(has("min_rest_after_night_block")), "note": ""},
                    {"code": "C4", "criterion": "Nghỉ phục hồi có ≥ 2 đêm ngủ", "requirement": "Phải có",
                     "status": "na", "note": "Cần dữ liệu chi tiết giờ nghỉ thực tế."},
                    {"code": "C5", "criterion": "Không bố trí ca sớm ngay sau ca đêm", "requirement": "Tránh",
                     "status": _status(has("early_after_late_or_night")), "note": ""},
                ],
            },
            {
                "code": "D", "title": "TRỰC DỰ PHÒNG (ON-CALL)",
                "items": [
                    {"code": "D1", "criterion": "On-call ≤ 3 lần/7 ngày", "requirement": "Tuân thủ",
                     "status": _status(has("max_oncall_per_7days")), "note": ""},
                    {"code": "D2", "criterion": "On-call không trùng lịch trực chính", "requirement": "Tránh",
                     "status": "na", "note": "Kiểm tra logic ở tầng nhập liệu."},
                    {"code": "D3", "criterion": "Có phương án điều chỉnh ca nếu bị gọi", "requirement": "Bắt buộc",
                     "status": "na", "note": "Quy trình QĐ 2289 Chương III."},
                    {"code": "D4", "criterion": "On-call không làm mất nghỉ phục hồi", "requirement": "Phải đảm bảo",
                     "status": _status(has("max_oncall_duration")), "note": ""},
                ],
            },
            {
                "code": "E", "title": "NGUY CƠ MỆT MỎI TIỀM ẨN TRONG LỊCH TRỰC",
                "items": [
                    {"code": "E1", "criterion": "Chuỗi ca dài liên tục ≥ 6 ngày", "requirement": "Cảnh báo",
                     "status": "fail" if has("max_consecutive_days") else "pass", "note": ""},
                    {"code": "E2", "criterion": "Nhiều ca kéo dài gần giới hạn", "requirement": "Cảnh báo",
                     "status": "fail" if has("max_extended_shift") else "pass", "note": ""},
                    {"code": "E3", "criterion": "Tập trung ca đêm vào ít người", "requirement": "Cảnh báo",
                     "status": "na", "note": "Cần phân tích phân bố — Phase 2."},
                    {"code": "E4", "criterion": "Nghỉ giữa ca 'đạt luật nhưng kém sinh học'", "requirement": "Cảnh báo",
                     "status": "na", "note": "Cần dữ liệu báo cáo cá nhân."},
                    {"code": "E5", "criterion": "Có lịch cần xem xét variation", "requirement": "Cảnh báo",
                     "status": "na", "note": "Đánh dấu thủ công bởi cán bộ lập lịch."},
                ],
            },
        ],
    }
```

---

## Mục 4.2 — Endpoint sinh checklist

**File:** `analytics/app/routers/roster.py`

```python
from app.review.qd2288_checklist import build_checklist

@router.post("/checklist")
def get_checklist(draft: RosterDraft):
    """Sinh checklist QĐ 2288 Phụ lục I cho một roster cấp ca."""
    shifts, qualifications, unknown = convert_draft(draft)
    cfg = RestRuleConfig()
    result = RosterReviewer(cfg).review(shifts, qualifications)
    violations_dicts = [
        {"rule": v.rule, "severity": v.severity.value, "message": v.message}
        for v in result.violations
    ]
    return build_checklist(violations_dicts, draft)
```

Tương tự cho macro: thêm `/macro/checklist`.

---

## Mục 4.3 — Frontend: nút "Xuất Checklist" và PDF

**File:** `src/components/DetailedRosterModal.js`

Cạnh nút Rà soát, thêm nút Xuất Checklist:
```jsx
<button onClick={handleExportChecklist} disabled={!reviewResult || exporting}>
  {exporting ? 'Đang tạo…' : 'Xuất Checklist (PL I)'}
</button>
```

Handler dùng thư viện `@react-pdf/renderer` hoặc đơn giản hơn là `window.print()` với template HTML in được:

```js
const handleExportChecklist = useCallback(async () => {
  setExporting(true);
  try {
    const checklist = await api.post('/api/schedules/checklist', {
      team, shift_code: currentShift, shift_date: currentDate, rows: /* same as review */
    });
    // Render thành HTML, mở cửa sổ in
    const html = renderChecklistHtml(checklist.data);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  } finally {
    setExporting(false);
  }
}, [/* deps */]);
```

Hàm `renderChecklistHtml` đặt trong file mới `src/utils/checklistHtml.js`, dựng HTML đúng format Phụ lục I của QĐ 2288 (bảng A-B-C-D-E).

**Xác minh:** bấm Xuất Checklist → cửa sổ in mở ra với bảng đầy đủ A-B-C-D-E, các ô Đạt/Không đạt được tô màu, header có chữ "QĐ 2288/QĐ-QLB Phụ lục I".

---

# PHẦN 5 — Điều chỉnh Tab Báo cáo hiện có

> Phần này dựa trên việc bạn nói "tab báo cáo đã có gần đủ nội dung nhưng form/workflow chưa sát". Mình KHÔNG biết chính xác tab Báo cáo hiện đang có gì. Claude trong VSCode phải `view` `src/screens/AnalyticsScreen.jsx` (và các screen "báo cáo" khác nếu có) TRƯỚC khi sửa.

## Mục 5.1 — Khảo sát tab Báo cáo hiện có

**Hành động bắt buộc trước khi sửa:**

1. `view src/screens/AnalyticsScreen.jsx` đầy đủ.
2. Liệt kê các sub-tab/tính năng hiện có trong file (ví dụ: compliance, fairness, lịch sử vi phạm, báo cáo mệt mỏi, đổi ca…).
3. So sánh từng tính năng hiện có với form/workflow chuẩn trong các văn bản:
   - **Báo cáo mệt mỏi** → mẫu Phụ lục III QĐ 2288 (Phần A/B/C + cam kết).
   - **Đổi ca/Trực thay** → mẫu Phụ lục I QĐ 2701 (theo từng đối tượng KSVKL/Kíp trưởng/TWR).
   - **Bình giảng sau ca** → mẫu Phụ lục II QĐ 2701.
   - **Giao nhận ca** → mô hình WEST (QĐ 2701 Điều 10-12).
4. Lập bảng so sánh trong `CHANGELOG_INTEGRATION.md`:
   ```
   | Tính năng hiện có | Văn bản tương ứng | Mức độ khớp | Cần chỉnh |
   |---|---|---|---|
   | ... | ... | ... | ... |
   ```
5. **DỪNG và đợi người dùng xác nhận** từng dòng cần chỉnh trước khi sửa.

Lý do dừng: nếu sửa form mà không hỏi, dễ phá những workflow đang chạy thực tế.

---

## Mục 5.2 — Điều chỉnh form Báo cáo mệt mỏi (theo Phụ lục III QĐ 2288)

(Chỉ thực hiện sau khi Mục 5.1 đã có xác nhận của người dùng.)

Form Báo cáo mệt mỏi phải có 3 phần:
- **Phần A — Thông tin chung (tùy chọn):** ngày/giờ, cơ sở/vị trí, ca trực (Ngày/Đêm/On-call), thời gian ca, liên hệ (tùy chọn — không bắt buộc danh tính).
- **Phần B — Tình trạng mệt mỏi (bắt buộc):** thời điểm xuất hiện, mức độ theo thang KSS (1-9, dropdown), lịch sử giấc ngủ (72h, 24h, chất lượng), mô tả ảnh hưởng, các yếu tố góp phần (checkbox: lịch làm việc, khai thác, cá nhân/môi trường), hành động khắc phục tức thời.
- **Phần C — Cam kết:** hiển thị 2 đoạn cam kết của KSVKL và Tổng công ty đúng nguyên văn QĐ 2288 trang 19.

Workflow chuẩn theo Chương VI QĐ 2289:
1. KSVKL điền form → submit.
2. Hệ thống tạo bản ghi với *mã ẩn danh tự sinh* (không hiển thị tên trong báo cáo tổng hợp).
3. Gửi thông báo cho Kíp trưởng/Quản lý kíp (Bước 3 Quy trình QĐ 2288).
4. Sau 24h, nếu chưa được xử lý, gửi cho Ban An toàn - Chất lượng (Bước 5).
5. Lưu trữ ≥ 5 năm.

**Quan trọng:** không dùng báo cáo mệt mỏi để xử lý kỷ luật, trừ các trường hợp "Ranh giới đỏ" (QĐ 2289 Chương VI.VII):
- Cố ý che giấu tình trạng không đủ điều kiện.
- Cố ý cung cấp thông tin sai lệch.
- Sử dụng rượu, chất kích thích trước nhiệm vụ.
- Cố ý không báo cáo mệt mỏi nghiêm trọng.

UI phải có disclaimer rõ ràng về nguyên tắc Just Culture.

---

## Mục 5.3 — Điều chỉnh form Đổi ca/Trực thay (theo Phụ lục I QĐ 2701)

QĐ 2701 có **3 biểu mẫu khác nhau** theo đối tượng:
- KSVKL tại ACC, APP/TWR.
- Kíp trưởng (mọi cơ sở).
- KSVKL tại TWR (không có Kíp trưởng kíp trực).

Form phải tự động chọn biểu mẫu đúng dựa trên `currentUser.role` và cơ sở của họ.

Các trường bắt buộc (Phụ lục I QĐ 2701):
1. Người đề nghị đổi ca (họ tên, chức danh, kíp trực, ca trực hiện tại).
2. Người nhận đổi/được trực thay (cùng thông tin).
3. Thời gian hoàn trả ca (nếu đổi ca) hoặc "không hoàn trả" (nếu trực thay).
4. Cam kết "Đã đảm bảo thời giờ làm việc, nghỉ ngơi đúng quy định".
5. Phê duyệt của:
   - Tại ACC/APP/TWR: KSVKL → Kíp trưởng kíp trực của người đề nghị + Kíp trưởng kíp trực của người nhận.
   - Tại TWR: Trưởng cơ sở (Đài trưởng/phó).
   - Vị trí Kíp trưởng: Trưởng cơ sở.

Workflow:
1. Người đề nghị điền form → chọn người nhận.
2. Hệ thống tự động **kiểm tra năng định tương đương** (Điều 8.1.b QĐ 2701) — Kíp trưởng chỉ đổi cho Kíp trưởng đã được bổ nhiệm.
3. Hệ thống **chạy rà soát giờ làm/nghỉ** cho cả hai người sau khi đổi → cảnh báo nếu vi phạm.
4. Gửi cho người nhận xác nhận đồng ý.
5. Gửi cho người phê duyệt ký số.
6. Lưu trữ ≥ 1 năm (Điều 8.5 QĐ 2701).

UI nên có nút "Kiểm tra điều kiện đổi ca" — gọi analytics endpoint mới `/analytics/exchange/check`, trả về kết quả check trước khi submit.

---

## Mục 5.4 — Điều chỉnh form Bình giảng sau ca (theo Phụ lục II QĐ 2701)

Form Báo cáo bình giảng theo nguyên văn Phụ lục II:
- Tiêu đề: "BÁO CÁO BÌNH GIẢNG SAU CA TRỰC".
- Kíp trực + ca trực + ngày.
- Người nhận: Giám đốc Công ty, Phòng Không lưu, Phòng An toàn - Chất lượng và An ninh.
- Phần 1: Thành phần tham gia (Người chủ trì, Đại diện Cán bộ cơ sở, Toàn bộ thành viên kíp giao ca).
- Phần 2: Nội dung bình giảng.
- Phần 3: Ý kiến đề xuất, kiến nghị.
- Chữ ký: Đại diện Cán bộ cơ sở + Người chủ trì.

Workflow theo Điều 14 QĐ 2701:
1. Sau khi kíp giao ca hoàn tất bàn giao vị trí trực → tự động kích hoạt form bình giảng.
2. Người chủ trì (Kíp trưởng/KSVKL quản lý kíp) điền nội dung.
3. Lưu mặc định; chỉ tạo Báo cáo chính thức khi có sự việc liên quan an toàn bay.
4. Báo cáo chính thức → gửi Giám đốc + 2 Phòng (tự động email/notification).
5. Lưu trữ ≥ 1 năm.

UI nên có 2 mức:
- **Bình giảng nhẹ**: ghi nội dung ngắn, không cần báo cáo chính thức.
- **Báo cáo bình giảng**: form đầy đủ Phụ lục II, có ký số, gửi đi các nơi.

---

## Mục 5.5 — Form Giao ca theo mô hình WEST (QĐ 2701 Điều 10-12)

Mô hình WEST = Weather, Equipment, Situation, Traffic.

Đây là form **mới hoàn toàn** so với mức "báo cáo". Tích hợp như sau:

Trong `DetailedRosterModal` hoặc một màn hình "Giao nhận ca" mới:
- Trước thời điểm giao ca 15 phút (Điều 10.1.a), hệ thống nhắc nhở kíp giao chuẩn bị nội dung.
- Form 4 trường lớn:
  - **W (Weather):** tình hình và diễn biến thời tiết.
  - **E (Equipment):** tình trạng hệ thống/thiết bị (radar/ADS-B, sóng vô tuyến, đài dẫn đường).
  - **S (Situation):** khu vực có hoạt động quân sự, chuyến bay đặc biệt, NOTAM/SNOWTAM.
  - **T (Traffic):** tình hình bay hiện tại + xu hướng, huấn lệnh đã cấp, đường CHC đang sử dụng.
- Kíp giao điền → in nháp.
- Cuộc họp giao ca: Đại diện Cán bộ cơ sở chủ trì.
- Kíp nhận xác nhận hiểu rõ → ký số.
- Khi cả hai bên ký, **tự động tạo bản ghi vào Sổ Nhật ký không lưu điện tử + Sổ Giao nhận vị trí trực điện tử**.

**Lưu ý:** Mục này là *mở rộng lớn*, có thể tách ra Sprint sau nếu phạm vi PLAN_V2 đã quá nặng. Mức ưu tiên: thấp hơn Mục 5.2-5.4. **Hỏi người dùng** trước khi triển khai: có làm trong đợt này không, hay sau khi 5.2-5.4 ổn.

---

# PHẦN 6 — Deployment + Smoke test

## Mục 6.1 — Cập nhật docker-compose

Y như mục D1 của PLAN_INTEGRATION cũ. Thêm `ANALYTICS_URL` cho backend nếu chưa có.

## Mục 6.2 — Cập nhật README và CHANGELOG

- README: thêm mục "Cơ sở pháp lý" liệt kê 3 QĐ + ngày hiệu lực.
- CHANGELOG_INTEGRATION.md: ghi rõ tiến độ từng mục.

## Mục 6.3 — Smoke test đầu cuối

Bước thủ công sau khi tất cả các phần đã xong:

1. Kíp trưởng đăng nhập → SchedulerScreen → bấm "Rà soát chu kỳ" cho 14 ngày → xem vi phạm.
2. Sửa các vi phạm → rà soát lại → can_publish=true → Publish.
3. Mở DetailedRosterModal cho 1 ngày → dán bảng phân ca → bấm "Rà soát" → xem vi phạm + đề xuất hoán đổi.
4. Sửa hết vi phạm → bấm "Xuất Checklist (PL I)" → in PDF → đối chiếu với Phụ lục I QĐ 2288.
5. KSVKL đăng nhập → tab Báo cáo → điền Báo cáo mệt mỏi theo Phụ lục III → submit.
6. KSVKL khác → điền form Đổi ca → gửi.
7. Sau ca trực → form Bình giảng → tạo Báo cáo chính thức nếu có sự việc.

Tất cả 7 bước trên chạy được mà không có lỗi 500 → coi là đạt.

---

# Câu hỏi mở Claude phải hỏi người dùng

1. **Mục 1.3 (on-call):** Trong DB hiện tại có ghi nhận on-call không? Lưu ở đâu?
2. **Mục 2.2:** Nhãn menu — bạn muốn giữ "Báo cáo" hay đổi sang tên khác (vd "Báo cáo & Thống kê")?
3. **Mục 3.5:** Cấu trúc `scheduleData` trong `SchedulerScreen` ra sao? (mảng/dict?)
4. **Mục 5.1:** *Sau khi khảo sát* — Claude bắt buộc dừng để bạn xác nhận từng dòng cần chỉnh.
5. **Mục 5.5:** Có làm form WEST trong đợt này không, hay tách sang sprint sau?

---

# Lưu ý cuối

- KHÔNG sửa các file ngoài phạm vi từng mục, kể cả khi thấy code có thể cải thiện.
- KHÔNG chỉnh `analytics/app/compliance/` ở các vị trí mà PLAN_V2 không nêu rõ.
- Mục 5 (điều chỉnh tab Báo cáo) yêu cầu **khảo sát + xác nhận** trước khi sửa.
- Trước khi sửa file lớn (`AnalyticsScreen.jsx`, `SchedulerScreen.jsx`, `DetailedRosterModal.js`), luôn `view` toàn file.
- Khi gặp xung đột với code thực tế khác mô tả trong plan, DỪNG và báo cáo cụ thể.
- Mỗi mục xong → chạy Xác minh thực sự → ghi `[DONE]` vào `CHANGELOG_INTEGRATION.md`.
