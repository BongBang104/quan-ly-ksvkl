# PLAN_FIX_ROSTER_REVIEW_LOGIC

> **File cần sửa:** `analytics/app/compliance/rest_compliance.py`
> và `analytics/app/routers/roster.py`
>
> **3 bug logic trong engine rà soát:**
> - Bug A: Ca ngày bị phân loại nhầm thành NIGHT → cảnh báo sai về ca đêm
> - Bug B: 2 giờ liên tiếp tại 1 vị trí bị cảnh báo — sai, QĐ cho phép đến 120 phút
> - Bug C: Cùng 1 nhân sự ngồi 2 vị trí trong cùng 1 slot → không có CRITICAL
>
> **Cách dùng trong Claude VSCode:**
> *"Đọc PLAN_FIX_ROSTER_REVIEW_LOGIC.md. Sửa tuần tự Bug-A → Bug-B → Bug-C.
> View file trước khi sửa."*

---

## Bug-A — Ca ngày bị phân loại nhầm NIGHT → cảnh báo sai

### Chẩn đoán

**File:** `analytics/app/compliance/rest_compliance.py` — hàm `classify_shift_kind()`

```python
def classify_shift_kind(start, end, cfg):
    # 1. EARLY: bắt đầu 04h-07h
    if cfg.early_shift_window_start_hour <= start.hour < cfg.early_shift_window_end_hour:
        return ShiftKind.EARLY

    # 2. NIGHT: bắt đầu ≥22h HOẶC < 04h   ← BUG Ở ĐÂY
    if start.hour >= cfg.night_window_start_hour or start.hour < cfg.early_shift_window_start_hour:
        return ShiftKind.NIGHT

    # 3. LATE ...
    # 4. NORMAL
```

**Ví dụ lỗi:** Ca bắt đầu `07:00` → `start.hour = 7`.
- Điều kiện 1: `4 <= 7 < 7` → False (7 không nhỏ hơn 7)
- Điều kiện 2: `7 >= 22` → False, `7 < 4` → False → OK, không bị NIGHT

Ca bắt đầu `07:30` → `start.hour = 7`.
- Tương tự → NORMAL ✅

**Ca bắt đầu `06:30`** → `start.hour = 6`.
- Điều kiện 1: `4 <= 6 < 7` → **True** → trả về **EARLY** ✅

**Ca bắt đầu `06:00`** → `start.hour = 6`.
- Điều kiện 1: `4 <= 6 < 7` → True → EARLY ✅

**Nhưng ca S (ngày) bắt đầu `07:00`** với `early_shift_window_end_hour = 7`:
- Điều kiện 1: `4 <= 7 < 7` → **False** (7 không < 7)
- Điều kiện 2: `7 >= 22` False, `7 < 4` False → **NORMAL** ✅ — đúng nhưng biên giới nguy hiểm

**Ca ngày bắt đầu `07:00` kết thúc `19:00`** — NORMAL, sẽ không bị lỗi.

**Nhưng ca thực tế trong bảng phân vị trí**: `convert_draft` tính `shift_start` = min của tất cả slot, `shift_end` = max. Nếu bảng có slot đầu tiên `"0700-0900"`, `shift_start.hour = 7` → OK. Nhưng nếu bảng có slot `"1900-2100"` (ca chiều tối kết thúc 21h), `shift_start.hour = 19`:

- Điều kiện 1: `4 <= 19 < 7` → False
- Điều kiện 2: `19 >= 22` → False, `19 < 4` → False
- Điều kiện 3 (LATE): kết thúc 21h00, `21 >= 22` → False
- → **NORMAL** ✅ không bị lỗi

**Tìm ra bug thật:** Slot `"2100-2300"` → `shift_start.hour = 21`:
- Điều kiện 1: `4 <= 21 < 7` → False
- Điều kiện 2: `21 >= 22` → False, `21 < 4` → False
- Điều kiện 3 LATE: kết thúc 23h00, `23 >= 22` → True → **LATE** ✅

**Slot `"2300-0100"`** → `shift_start.hour = 23`:
- Điều kiện 2: `23 >= 22` → True → **NIGHT** ✅

**Vậy bug ở đâu?** `_check_break_after_position` dùng `s.is_night` chứ không dùng `s.effective_kind`:

```python
def _check_break_after_position(self, shifts):
    for s in shifts:
        sessions = sorted(s.sessions, key=lambda x: x.start)
        for cur, nxt in zip(sessions, sessions[1:]):
            gap_min = (nxt.start - cur.end).total_seconds() / 60.0
            required = night_min if s.is_night else day_min   # ← s.is_night
```

Trong `convert_draft`, `is_night` được set từ `classify_shift_kind`:

```python
kind = classify_shift_kind(shift_start, shift_end, cfg)
shifts.append(Shift(
    ...
    is_night=(kind == ShiftKind.NIGHT),
    kind=kind,
```

Vấn đề: `shift_start` và `shift_end` của Shift được tính từ **min/max của tất cả slot** trong bảng. Nếu ca S có slot từ `07:00` đến `19:00`, nhưng **có thêm slot `19:00-21:00`** (tăng cường), `shift_end = 21:00`. `classify_shift_kind(07:00, 21:00)`:
- Điều kiện LATE: `21 >= 22` → False → **NORMAL** ✅

Nhưng nếu người dùng nhập bảng ca **đêm** (S đêm bắt đầu 19h) và có slot `"1900-0700"` (cross midnight), `shift_start.hour = 19`, `shift_end = ngày hôm sau 07:00`:
- Điều kiện LATE: `end.hour=7`, khác ngày → `end_hour = 7 + 24 = 31 >= 22` → **LATE**
- Nhưng thực tế đây là ca **đêm** → `is_night = False` → dùng `day_min = 30` thay vì `night_min = 45`

**Bug thật: `end_hour` calculation sai khi cross midnight:**

```python
# Hiện tại:
end_hour = end.hour if end.date() == start.date() else (end.hour + 24 * (end.date() - start.date()).days)
# Ca bắt đầu 19:00, kết thúc 07:00 hôm sau:
# end.hour = 7, khác ngày → end_hour = 7 + 24 = 31 → 31 >= 22 → LATE
# Đúng ra phải là NIGHT (phần lớn thời gian trong 22h-06h)
```

**Fix đúng theo QĐ 2288 Điều 15.1.a:** "Ca đêm = phần lớn thời gian trong 22h00-06h00."

---

### Fix-A.1 — Sửa `classify_shift_kind` dùng overlap ratio thay vì chỉ nhìn `start.hour`

**File:** `analytics/app/compliance/rest_compliance.py`

Thay toàn bộ hàm `classify_shift_kind`:

```python
def classify_shift_kind(start: datetime, end: datetime, cfg: RestRuleConfig) -> ShiftKind:
    """Phân loại ca dựa trên tỉ lệ thời gian trong cửa sổ đêm/sáng.
    QĐ 2288 Điều 15: ca đêm = phần lớn (>50%) thời gian trong 22h00-06h00.

    Thứ tự ưu tiên: EARLY > NIGHT > LATE > NORMAL.
    """
    # ── EARLY: bắt đầu trong 04h00-07h00 (QĐ 2288 Điều 15.2.a) ────────────
    if (cfg.early_shift_window_start_hour <= start.hour < cfg.early_shift_window_end_hour):
        return ShiftKind.EARLY

    # ── Tính phút overlap với cửa sổ đêm (22h-06h) ─────────────────────────
    total_minutes = max(1.0, (end - start).total_seconds() / 60.0)
    night_minutes = _night_overlap_minutes(start, end,
                                           cfg.night_window_start_hour,
                                           cfg.night_window_end_hour)

    # NIGHT: >50% thời gian trong 22h-06h (QĐ 2288 Điều 15.1.a)
    if night_minutes / total_minutes > 0.5:
        return ShiftKind.NIGHT

    # ── LATE: kết thúc sau 22h (QĐ 2288 Điều 15.2.c) ──────────────────────
    # Tính giờ kết thúc thực tế (có thể qua midnight)
    if end > start:
        effective_end_hour = (end - start.replace(hour=0, minute=0, second=0,
                                                   microsecond=0)).total_seconds() / 3600.0
        # Chỉ xem giờ trong ngày đầu tiên
        actual_end_hour = end.hour + (24 if end.date() > start.date() else 0)
        if actual_end_hour >= cfg.late_shift_end_hour:
            return ShiftKind.LATE

    return ShiftKind.NORMAL


def _night_overlap_minutes(start: datetime, end: datetime,
                           night_start_h: int, night_end_h: int) -> float:
    """Tính số phút ca nằm trong cửa sổ đêm (22h-06h), bao gồm cross-midnight."""
    if end <= start:
        return 0.0

    total = 0.0
    current = start

    # Xử lý từng ngày trong khoảng [start, end]
    while current < end:
        day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)

        # Cửa sổ đêm trong ngày này: [22h, 24h] + [0h, 6h] ngày hôm sau
        # = [22h, 06h ngày hôm sau] nhưng split thành 2 phần:
        # Phần 1: current_day 22:00 → current_day+1 00:00
        night1_start = day_start + timedelta(hours=night_start_h)
        night1_end   = day_end   # = 00:00 hôm sau

        # Phần 2: current_day 00:00 → current_day 06:00
        night2_start = day_start
        night2_end   = day_start + timedelta(hours=night_end_h)

        for ns, ne in [(night1_start, night1_end), (night2_start, night2_end)]:
            overlap_start = max(current, ns)
            overlap_end   = min(end, ne)
            if overlap_end > overlap_start:
                total += (overlap_end - overlap_start).total_seconds() / 60.0

        current = day_end

    return total
```

---

### Fix-A.2 — Sửa `_check_break_after_position` dùng `effective_kind` thay vì `is_night`

**File:** `analytics/app/compliance/rest_compliance.py`

```python
def _check_break_after_position(self, shifts):
    """Sau mỗi phiên vị trí phải có nghỉ ≥ 30 phút (ca ngày) hoặc ≥ 45 phút (ca đêm).
    QĐ 2288 Điều 14.2.a.
    """
    out = []
    day_min   = self.cfg.min_break_after_position_day_minutes
    night_min = self.cfg.min_break_after_position_night_minutes
    if day_min is None and night_min is None:
        return out

    for s in shifts:
        sessions = sorted(s.sessions, key=lambda x: x.start)
        for cur, nxt in zip(sessions, sessions[1:]):
            gap_min  = (nxt.start - cur.end).total_seconds() / 60.0
            # Dùng effective_kind thay vì is_night để nhận diện đúng loại ca
            is_night_shift = s.effective_kind == ShiftKind.NIGHT
            required = night_min if is_night_shift else day_min
            if required is None or gap_min >= required:
                continue
            out.append(Violation(
                rule="min_break_after_position",
                severity=Severity.WARNING,
                controller_id=s.controller_id,
                controller_name=s.controller_name,
                message=(
                    f"Chỉ nghỉ {gap_min:.0f} phút sau phiên {cur.position.value} "
                    f"(ca {'đêm' if is_night_shift else 'ngày'}), dưới mức tối thiểu "
                    f"{required} phút (QĐ 2288 Điều 14.2.a)."
                ),
                related_shift_ids=[s.shift_id],
                legal_basis="QĐ 2288 Điều 14.2.a",
            ))
    return out
```

---

## Bug-B — 2 giờ liên tiếp (120 phút) bị cảnh báo — sai theo QĐ 2288

### Chẩn đoán

**File:** `analytics/app/compliance/rest_compliance.py` — `_check_on_position_sessions()`

```python
def _check_on_position_sessions(self, shifts):
    out, limit = [], self.cfg.max_on_position_minutes   # limit = 120
    for s in shifts:
        for sess in self._merge_sessions(s.sessions):
            if sess.minutes > limit:   # ← ">" nghĩa là > 120 mới báo
```

Nhìn qua có vẻ `> 120` là đúng (120 phút OK, 121 phút mới báo).

**Nhưng `_merge_sessions` có bug:**

```python
def _merge_sessions(self, sessions):
    gap_limit = self.cfg.merge_adjacent_session_gap_minutes or 0  # = 0
    ordered = sorted(sessions, key=lambda x: x.start)
    merged = []
    for s in ordered:
        if merged and merged[-1].position == s.position:
            gap_min = (s.start - merged[-1].end).total_seconds() / 60.0
            if gap_min <= gap_limit:   # ← gap_limit = 0, nên chỉ gộp khi gap = 0
                merged[-1] = PositionSession(s.position, merged[-1].start, max(merged[-1].end, s.end))
                continue
        merged.append(PositionSession(s.position, s.start, s.end))
    return merged
```

Nếu `merge_adjacent_session_gap_minutes = 0`, chỉ gộp khi 2 slot liền nhau không có khoảng hở (end của slot 1 = start của slot 2). Trong bảng phân vị trí thực tế:

```
07:00 - 09:00  APP
09:00 - 11:00  APP   ← liền kề, gap = 0 phút → được gộp → tổng = 120 phút
```

120 phút → `sess.minutes = 120`, `120 > 120` → **False** → không cảnh báo ✅

**Nhưng nếu:**
```
07:00 - 09:00  APP
09:00 - 09:00  APP   ← dữ liệu có thể có slot rỗng hoặc overlap
```

**Bug thật:** Khi frontend gửi bảng có các slot **không liền nhau hoàn hảo** (ví dụ chênh nhau 1 phút do làm tròn):

```
07:00 - 09:01  APP   → 121 phút → WARNING ← SAI
```

Hoặc frontend gửi slot `"0700-0900"` và `"0900-0900"` (slot rỗng) → gộp thành 120 phút OK, nhưng slot `"0700-0901"` → 121 phút → báo.

**Nguyên nhân chính xác:** `_parse_hhmm` trong `roster.py`:

```python
def _parse_hhmm(s: str) -> int:
    s = s.strip().replace(":", "")
    return int(s[:2]) * 60 + int(s[2:4])
```

`"0700"` → 420, `"0900"` → 540. Slot duration = 540 - 420 = 120 phút → đúng.
Nhưng `"0700"` → `"0900"` là 2 slot riêng = 120 phút mỗi slot, khi gộp = 240 phút.

**Vấn đề thực sự:** Bảng phân vị trí chia thành nhiều slot nhỏ. Nếu KSVKL ngồi APP từ `07:00-09:00` (120 phút), đây là 1 slot duy nhất. `sess.minutes = 120`, `120 > 120` → False → **không cảnh báo** ✅

Nhưng nếu slot `"0700-0900"` = 120 phút và slot `"0900-1100"` = 120 phút kế tiếp (cùng APP), khi gộp → 240 phút → `240 > 120` → **WARNING** ✅ Đúng logic.

**Tuy nhiên khi kíp trưởng PHÂN CÔNG chính xác, mỗi slot 2 tiếng là ổn.** Vấn đề là `_merge_sessions` gộp 2 slot liền nhau cùng vị trí thành 1 phiên 4 tiếng → báo sai.

**Điều chỉnh:** Không gộp slots nếu chúng là các phân công riêng biệt (mỗi slot = 1 phiên vị trí riêng). Chỉ gộp khi **không có giải lao** (gap = 0) giữa chúng. Nếu kíp trưởng xếp `07:00-09:00 APP` và `09:00-11:00 APP` liên tiếp, đó là 2 phiên mà không có giải lao → vi phạm nghỉ sau phiên, không phải vi phạm 120 phút.

**Fix:** Tách riêng hai rule:
1. Mỗi phiên vị trí (session) ≤ 120 phút → kiểm tra từng session gốc, **không gộp**
2. Giải lao sau mỗi phiên ≥ 30/45 phút → kiểm tra gap giữa các session liền kề

---

### Fix-B.1 — `_check_on_position_sessions` kiểm tra từng session gốc, không gộp

**File:** `analytics/app/compliance/rest_compliance.py`

```python
def _check_on_position_sessions(self, shifts):
    """Mỗi phiên vị trí liên tục ≤ 120 phút. QĐ 2288 Điều 14.1.a.

    Kiểm tra từng PositionSession gốc (không gộp),
    vì mỗi dòng trong bảng phân vị trí là một phiên riêng biệt.
    Hai phiên liên tiếp cùng vị trí mà không có giải lao → vi phạm Điều 14.2.a,
    không phải Điều 14.1.a.
    """
    out  = []
    limit = self.cfg.max_on_position_minutes
    if limit is None:
        return out

    for s in shifts:
        for sess in s.sessions:
            dur = sess.minutes
            if dur > limit:
                out.append(Violation(
                    rule="max_on_position",
                    severity=Severity.WARNING,
                    controller_id=s.controller_id,
                    controller_name=s.controller_name,
                    message=(
                        f"Phiên {sess.position.value} "
                        f"{sess.start.strftime('%H:%M')}-{sess.end.strftime('%H:%M')} "
                        f"kéo dài {dur:.0f} phút, vượt mức {limit} phút "
                        f"(QĐ 2288 Điều 14.1.a — cần giải lao sớm hơn)."
                    ),
                    related_shift_ids=[s.shift_id],
                    legal_basis="QĐ 2288 Điều 14.1.a",
                ))
    return out
```

> **Kết quả:** Slot `07:00-09:00` (120 phút) → `120 > 120` = False → **không cảnh báo** ✅
> Slot `07:00-09:01` (121 phút) → `121 > 120` = True → **WARNING** ✅

---

## Bug-C — Cùng nhân sự ngồi 2 vị trí trong cùng 1 slot không có CRITICAL

### Chẩn đoán

**File:** `analytics/app/routers/roster.py` — `convert_draft()`

```python
for pos_str, abbr_raw in pos_map.items():
    ...
    sessions_by_abbr.setdefault(abbr, []).append(
        (pos_obj, slot_start, slot_end)
    )
```

Nếu bảng có slot `"0700-0900"`:
```
APP: NVA
CTL: NVA    ← cùng NVA ngồi 2 vị trí
```

→ `sessions_by_abbr["NVA"] = [(Position.APP, 07:00, 09:00), (Position.CTL, 07:00, 09:00)]`

Hai session có cùng `[07:00, 09:00]` → **overlap 100%**. Nhưng `ComplianceChecker` không có rule kiểm tra overlap giữa các session của cùng một người.

`_check_on_position_sessions` chỉ kiểm tra thời lượng từng phiên (120 phút) → không phát hiện overlap.

`_check_break_after_position` kiểm tra gap giữa phiên liên tiếp:
- Session 1: APP 07:00-09:00
- Session 2: CTL 07:00-09:00 (sorted by start → cùng thời điểm)
- `gap_min = (07:00 - 09:00) = -120 phút` → `gap_min >= required` khi `required = 30` và `-120 >= 30` → False → **báo WARNING "nghỉ -120 phút"** (vô nghĩa)

Hoặc sorted → APP trước CTL → gap = `CTL.start - APP.end = 07:00 - 09:00 = -120 phút`. Python tính `-120 >= 30` = False → báo nhưng message sai.

**Đây là vi phạm CRITICAL theo QĐ 2288 Điều 14.1.b:** Không thể đồng thời đảm nhận 2 vị trí điều hành. Cần thêm rule riêng.

---

### Fix-C.1 — Thêm `_check_position_overlap` vào `ComplianceChecker`

**File:** `analytics/app/compliance/rest_compliance.py`

Thêm method mới vào `ComplianceChecker`:

```python
def _check_position_overlap(self, shifts: list[Shift]) -> list[Violation]:
    """Kiểm tra cùng 1 KSVKL được phân công 2 vị trí điều hành CÙNG LÚC.
    Đây là vi phạm CRITICAL: không thể đồng thời đảm nhận 2 vị trí.
    QĐ 2288 Điều 14.1.b + QĐ 2701 Điều 9.1.
    """
    out = []
    for s in shifts:
        # Chỉ xét vị trí điều hành chính (loại bỏ AUXILIARY)
        op_sessions = [
            sess for sess in s.sessions
            if sess.position not in AUXILIARY_POSITIONS
        ]
        if len(op_sessions) < 2:
            continue

        # Kiểm tra mọi cặp session xem có overlap không
        for i, a in enumerate(op_sessions):
            for b in op_sessions[i + 1:]:
                # Overlap khi: a.start < b.end AND b.start < a.end
                overlap_start = max(a.start, b.start)
                overlap_end   = min(a.end,   b.end)
                if overlap_end > overlap_start:
                    overlap_min = (overlap_end - overlap_start).total_seconds() / 60.0
                    out.append(Violation(
                        rule="position_overlap",
                        severity=Severity.CRITICAL,   # ← CRITICAL, không phải WARNING
                        controller_id=s.controller_id,
                        controller_name=s.controller_name,
                        message=(
                            f"Phân công đồng thời tại 2 vị trí: "
                            f"{a.position.value} và {b.position.value} "
                            f"trong {overlap_min:.0f} phút "
                            f"({overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}). "
                            f"Một người không thể đảm nhận 2 vị trí điều hành cùng lúc."
                        ),
                        related_shift_ids=[s.shift_id],
                        legal_basis="QĐ 2288 Điều 14.1.b",
                    ))
    return out
```

---

### Fix-C.2 — Đăng ký `_check_position_overlap` vào `check_controller`

**File:** `analytics/app/compliance/rest_compliance.py`

Tìm `check_controller`. Thêm dòng **đầu tiên** (trước các check khác) để vi phạm CRITICAL này xuất hiện đầu tiên trong kết quả:

```python
def check_controller(self, shifts, qualification=None):
    if not shifts:
        return []
    shifts = sorted(shifts, key=lambda s: s.start)
    v: list[Violation] = []
    v += self._check_position_overlap(shifts)      # ← THÊM DÒNG NÀY (đặt đầu tiên)
    v += self._check_rest_between_shifts(shifts)
    v += self._check_shift_duration(shifts)
    v += self._check_on_position_sessions(shifts)
    v += self._check_break_after_position(shifts)
    v += self._check_consecutive_nights(shifts)
    v += self._check_early_after_late_or_night(shifts)
    v += self._check_consecutive_days(shifts)
    v += self._check_weekly_duty(shifts)
    v += self._check_30day_duty(shifts)
    v += self._check_full_rest_days_per_30days(shifts)
    v += self._check_position_recency(shifts)
    if qualification is not None:
        v += self._check_qualification_coverage(shifts, qualification)
    return v
```

---

### Fix-C.3 — Sửa `_check_break_after_position` để bỏ qua session overlap

Khi 2 session cùng thời điểm (overlap), `gap_min` âm → message sai "nghỉ -120 phút". Thêm guard:

```python
def _check_break_after_position(self, shifts):
    ...
    for s in shifts:
        sessions = sorted(s.sessions, key=lambda x: x.start)
        for cur, nxt in zip(sessions, sessions[1:]):
            gap_min = (nxt.start - cur.end).total_seconds() / 60.0

            # Bỏ qua nếu overlap (gap âm) — đã được xử lý bởi _check_position_overlap
            if gap_min < 0:
                continue

            is_night_shift = s.effective_kind == ShiftKind.NIGHT
            required = night_min if is_night_shift else day_min
            if required is None or gap_min >= required:
                continue
            # ... rest giữ nguyên
```

---

## Checklist

### Bug-A — classify_shift_kind sai loại ca
- [ ] Thêm hàm helper `_night_overlap_minutes(start, end, night_start_h, night_end_h)` vào `rest_compliance.py`
- [ ] Thay toàn bộ `classify_shift_kind` bằng phiên bản dùng overlap ratio
- [ ] `_check_break_after_position`: đổi `s.is_night` → `s.effective_kind == ShiftKind.NIGHT`
- [ ] **Verify A:** Nhập bảng ca ngày (07:00-19:00) → không còn cảnh báo về ca đêm
- [ ] **Verify A:** Nhập bảng ca đêm (19:00-07:00) → cảnh báo dùng ngưỡng đêm (45 phút)

### Bug-B — 120 phút bị cảnh báo sai
- [ ] `_check_on_position_sessions`: đổi `self._merge_sessions(s.sessions)` → `s.sessions` trực tiếp
- [ ] **Verify B:** Slot `07:00-09:00` APP (120 phút) → **không** có cảnh báo `max_on_position`
- [ ] **Verify B:** Slot `07:00-09:01` APP (121 phút) → **có** cảnh báo
- [ ] **Verify B:** Slot `07:00-09:00` APP + `09:00-11:00` APP liền nhau, không có giải lao → cảnh báo `min_break_after_position` (30 phút nghỉ), không phải `max_on_position`

### Bug-C — Phân công 2 vị trí cùng lúc không có CRITICAL
- [ ] Thêm method `_check_position_overlap` vào `ComplianceChecker`
- [ ] Đăng ký vào `check_controller` ở vị trí đầu tiên
- [ ] `_check_break_after_position`: thêm `if gap_min < 0: continue`
- [ ] **Verify C:** Bảng có `APP: NVA` và `CTL: NVA` cùng slot `07:00-09:00` → CRITICAL "Phân công đồng thời tại 2 vị trí"
- [ ] **Verify C:** Bảng có vị trí phụ trợ HDA và CTL cùng slot → **không** báo (HDA là AUXILIARY)
- [ ] **Verify C:** `can_publish = False` khi có position_overlap violation
