# PLAN_TAB_BAO_CAO — Tái cấu trúc tab Báo cáo + 4 form pháp lý + SPI Dashboard

> **Bổ trợ** cho `PLAN_INTEGRATION_V2.md`. Chi tiết hóa Phần 5 với cấu trúc đã thống nhất.
>
> **Tổ chức:** giữ menu "Báo cáo" (AnalyticsScreen), chia thành 2 nhóm tab:
> - **Phân tích & Giám sát** — 4 tab hiện có sau khi điều chỉnh.
> - **Biểu mẫu & Quy trình** — 4 form mới + SPI Dashboard.
>
> **Thứ tự thực hiện:** A → B → C → G → D → E → F → H. (Checklist trước Báo cáo mệt mỏi vì không cần workflow phức tạp; SPI sau Checklist vì chỉ tổng hợp dữ liệu sẵn có; ba form workflow theo thứ tự ưu tiên user đã chọn.)

## Nguyên tắc xuyên suốt

1. **QĐ 2288 là gốc**, QĐ 2701 bám theo, QĐ 2289 cho khung tổ chức.
2. **Mỗi form giữ nguyên văn cấu trúc của Phụ lục pháp lý.** Không "tối ưu hóa UI" làm mất tính pháp lý.
3. **Just Culture** (QĐ 2288 Điều 8 + QĐ 2289 Chương I.V.5): Báo cáo mệt mỏi không dùng cho kỷ luật, ẩn danh người báo cáo trong tổng hợp. Ngoại lệ là "Ranh giới đỏ" (QĐ 2289 Chương VI.VII).
4. **Mỗi cảnh báo/vi phạm có viện dẫn điều luật** dưới dạng `legal_basis: "QĐ 2288 Điều X.Y"`.
5. **Tái sử dụng pattern hiện có:** module backend theo mẫu `requests/` (entity + service + controller + `extraData jsonb`). Tránh tạo bảng mới khi có thể dùng cờ phân loại.
6. **Lưu trữ theo quy định:** Báo cáo mệt mỏi ≥ 5 năm (Điều 26.2 QĐ 2288), Đổi ca ≥ 1 năm (Điều 8.5 QĐ 2701), Bình giảng ≥ 1 năm (Điều 14.3.đ QĐ 2701), Phân ca ≥ 18 tháng (Điều 16.3 QĐ 2701).
7. Sau mỗi mục: chạy bước Xác minh **thật**, ghi `[DONE] Mục N — <tên> — <ngày>` vào `CHANGELOG_TAB_BAO_CAO.md`.

---

# PHASE A — Tái cấu trúc AnalyticsScreen

## Mục A1 — Đổi `TABS` thành cấu trúc 2 nhóm

**File:** `src/screens/AnalyticsScreen.jsx`

`view` toàn file trước. Tìm khối `const TABS = [...]` (khoảng dòng 8). Thay bằng:

```jsx
// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_GROUPS = [
  {
    id: 'analysis',
    label: 'Phân tích & Giám sát',
    desc: 'Theo dõi tuân thủ, công bằng, năng định, tối ưu hóa và chỉ số an toàn FMP.',
    tabs: [
      { id: 'compliance',     label: 'Tuân thủ',    icon: 'shield',      desc: 'Kiểm tra vi phạm quy định nghỉ ngơi và ca trực theo từng tháng.' },
      { id: 'fairness',       label: 'Công bằng',   icon: 'bar-chart-2', desc: 'Phân tích phân bổ giờ trực giữa các KSVKL để đảm bảo công bằng.' },
      { id: 'qualifications', label: 'Năng định',   icon: 'award',       desc: 'Theo dõi trạng thái năng định và cảnh báo hết hạn của KSVKL.' },
      { id: 'optimizer',      label: 'Tối ưu hóa',  icon: 'zap',         desc: 'Đề xuất phân ca tự động dựa trên QĐ 2288.' },
      { id: 'spi',            label: 'Dashboard SPI', icon: 'activity',  desc: 'Chỉ số hiệu suất an toàn theo QĐ 2288 Điều 24.' },
    ],
  },
  {
    id: 'forms',
    label: 'Biểu mẫu & Quy trình',
    desc: 'Các biểu mẫu pháp lý theo Phụ lục QĐ 2288 và QĐ 2701.',
    tabs: [
      { id: 'checklist',     label: 'Đánh giá lịch trực', icon: 'check-square', desc: 'Checklist Phụ lục I — QĐ 2288.' },
      { id: 'fatigue',       label: 'Báo cáo mệt mỏi',    icon: 'alert-triangle', desc: 'Báo cáo theo Phụ lục III — QĐ 2288. Bảo mật, không trừng phạt.' },
      { id: 'exchange',      label: 'Đổi ca / Trực thay', icon: 'repeat',       desc: 'Theo Phụ lục I — QĐ 2701.' },
      { id: 'briefing',      label: 'Bình giảng sau ca',  icon: 'file-text',    desc: 'Theo Phụ lục II — QĐ 2701.' },
    ],
  },
];

// Backward-compat: code cũ có thể tham chiếu TABS — giữ flat list
const TABS = TAB_GROUPS.flatMap(g => g.tabs);
```

**Xác minh:** `grep -c "TAB_GROUPS" src/screens/AnalyticsScreen.jsx` ≥ 1, build không lỗi.

---

## Mục A2 — Render UI 2 nhóm tab

Trong cùng file, tìm phần render thanh tab và mở rộng. `view` từ dòng 740 đến cuối file để biết cấu trúc hiện tại.

Đặt state cho group hiện hoạt động bên cạnh tab:
```jsx
const [groupId, setGroupId] = useState('analysis');
const [tab, setTab] = useState('compliance');

const currentGroup = TAB_GROUPS.find(g => g.id === groupId) ?? TAB_GROUPS[0];

// Khi đổi group, set lại tab về tab đầu của group đó
const switchGroup = (gid) => {
  const g = TAB_GROUPS.find(x => x.id === gid);
  if (!g) return;
  setGroupId(gid);
  setTab(g.tabs[0].id);
};
```

Render: thanh group ở trên, thanh tab con bên dưới:
```jsx
{/* Thanh nhóm tab */}
<div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 0 }}>
  {TAB_GROUPS.map(g => {
    const active = groupId === g.id;
    return (
      <button key={g.id} type="button" onClick={() => switchGroup(g.id)}
              style={{
                padding: '12px 24px', fontSize: 14, fontWeight: 700,
                color: active ? '#1e293b' : '#64748b',
                backgroundColor: active ? '#fff' : 'transparent',
                border: 'none',
                borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
                cursor: 'pointer',
              }}>
        {g.label}
      </button>
    );
  })}
</div>

{/* Thanh tab con */}
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 12, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
  {currentGroup.tabs.map(t => {
    const on = tab === t.id;
    return (
      <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
        padding: '8px 14px', fontSize: 13, fontWeight: 600,
        color: on ? '#fff' : '#475569',
        backgroundColor: on ? '#2563eb' : '#fff',
        border: '1px solid ' + (on ? '#2563eb' : '#e2e8f0'),
        borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name={t.icon} size={14} color={on ? '#fff' : '#475569'} />
        {t.label}
      </button>
    );
  })}
</div>
```

Mở rộng phần render tab body:
```jsx
{/* Tab analysis */}
{tab === 'compliance'     && <ComplianceTab />}
{tab === 'fairness'       && <FairnessTab />}
{tab === 'qualifications' && <QualificationsTab />}
{tab === 'optimizer'      && <OptimizerTab employees={employees} />}
{tab === 'spi'            && <SpiDashboardTab />}

{/* Tab forms */}
{tab === 'checklist' && <ChecklistTab />}
{tab === 'fatigue'   && <FatigueReportTab currentUser={currentUser} />}
{tab === 'exchange'  && <ShiftExchangeTab currentUser={currentUser} />}
{tab === 'briefing'  && <ShiftBriefingTab currentUser={currentUser} />}
```

Lưu ý: 5 component mới (`SpiDashboardTab`, `ChecklistTab`, `FatigueReportTab`, `ShiftExchangeTab`, `ShiftBriefingTab`) chưa có. Tạo file rỗng trước để build không lỗi, code thật trong các phase sau:

```jsx
// Đầu file, sau TAB_GROUPS
function SpiDashboardTab() { return <div style={{ padding: 20 }}><InfoBox msg="Đang phát triển — sẽ hoàn thiện ở Phase G." /></div>; }
function ChecklistTab() { return <div style={{ padding: 20 }}><InfoBox msg="Đang phát triển — sẽ hoàn thiện ở Phase C." /></div>; }
function FatigueReportTab() { return <div style={{ padding: 20 }}><InfoBox msg="Đang phát triển — sẽ hoàn thiện ở Phase D." /></div>; }
function ShiftExchangeTab() { return <div style={{ padding: 20 }}><InfoBox msg="Đang phát triển — sẽ hoàn thiện ở Phase E." /></div>; }
function ShiftBriefingTab() { return <div style={{ padding: 20 }}><InfoBox msg="Đang phát triển — sẽ hoàn thiện ở Phase F." /></div>; }
```

`AnalyticsScreen` nhận thêm `currentUser` qua props nếu chưa có. Kiểm tra trong `App.jsx`:
```jsx
case 'ANALYTICS': return <AnalyticsScreen employees={employees} currentUser={currentUser} />;
```

**Xác minh:** chạy `npm run build` không lỗi; mở browser → menu "Báo cáo" hiển thị 2 thanh tab; bấm "Biểu mẫu & Quy trình" thấy 4 tab placeholder.

---

# PHASE B — Điều chỉnh 4 tab hiện có

## Mục B1 — ComplianceTab: thêm `legal_basis` + nút Xuất Checklist

### Mục B1.1 — Analytics: thêm `legal_basis` vào response

**File:** `analytics/app/compliance/rest_compliance.py`

Tìm dataclass `Violation`. Thêm trường:
```python
@dataclass
class Violation:
    rule: str
    severity: Severity
    controller_id: str | int
    controller_name: str
    message: str
    related_shift_ids: list[int] = field(default_factory=list)
    legal_basis: str = ""  # MỚI — vd "QĐ 2288 Điều 12.1"
```

Trong mỗi `check_*` method, set `legal_basis`:
```python
# Ví dụ trong _check_consecutive_days
out.append(Violation(
    rule="max_consecutive_days", severity=Severity.WARNING,
    controller_id=cid, controller_name=name,
    message=f"Làm việc {count} ngày liên tiếp, vượt giới hạn {limit}.",
    related_shift_ids=[s.shift_id for s in window],
    legal_basis="QĐ 2288 Điều 12.2",
))
```

**Bảng đối chiếu** (Claude áp dụng vào từng method):

| Rule | legal_basis |
|---|---|
| `max_designed_shift` | `QĐ 2288 Điều 11.1` |
| `max_extended_shift` | `QĐ 2288 Điều 11.3` |
| `max_duty_per_week` | `QĐ 2288 Điều 11.2` |
| `max_duty_per_30days` | `QĐ 2288 Điều 12.1` |
| `max_consecutive_days` | `QĐ 2288 Điều 12.2` |
| `min_full_rest_days_per_30days` | `QĐ 2288 Điều 12.2` |
| `min_rest_between_shifts` | `QĐ 2288 Điều 13.1` |
| `max_on_position` | `QĐ 2288 Điều 14.1` |
| `min_break_after_position` | `QĐ 2288 Điều 14.2.a` |
| `max_consecutive_nights` | `QĐ 2288 Điều 15.1.b` |
| `min_rest_after_night_block` | `QĐ 2288 Điều 15.1.c` |
| `early_after_late_or_night` | `QĐ 2288 Điều 15.2.b` |
| `max_oncall_per_7days` | `QĐ 2288 Điều 16.1` |
| `max_oncall_duration` | `QĐ 2288 Điều 16.2` |
| `qualification_coverage` | `QĐ 2288 Điều 5.1` (cơ sở phải bố trí KSVKL đủ năng lực) |
| `position_recency` | (không có trong văn bản — để chuỗi rỗng, sẽ bổ sung khi có tài liệu năng định) |

**Xác minh:** `cd analytics && pytest tests/test_rest_compliance.py -q` vẫn pass; thêm 1 test mới kiểm tra `legal_basis` không rỗng cho các vi phạm có map ở trên.

### Mục B1.2 — Compliance endpoint trả `legal_basis`

**File:** `analytics/app/routers/compliance.py`

`view` file. Tìm chỗ chuyển `Violation` thành dict trả về frontend. Bổ sung trường:
```python
return {
    "rule": v.rule,
    "severity": v.severity.value,
    "controller_id": str(v.controller_id),
    "controller_name": v.controller_name,
    "message": v.message,
    "related_shift_ids": v.related_shift_ids,
    "legal_basis": v.legal_basis,  # MỚI
}
```

Áp dụng tương tự cho các endpoint khác trả về danh sách Violation (`routers/roster.py` đã được nêu trong PLAN_INTEGRATION_V2).

**Xác minh:** curl endpoint, response có field `legal_basis`.

### Mục B1.3 — ComplianceTab: hiển thị tag legal_basis

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm component `ViolationRow` (dòng ~116). `view` chính xác cấu trúc hiện có. Thêm trong render:
```jsx
function ViolationRow({ v }) {
  const s = SEV_STYLE[v.severity] || SEV_STYLE.INFO;
  return (
    <div style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14,
                  padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                  borderLeft: `4px solid ${s.dot}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                     backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
        {SEV_LABEL[v.severity] || v.severity}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
          {v.controller_name || v.controller_id}
        </div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{v.message}</div>
        {v.legal_basis && (
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#64748b',
              backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: 4,
              border: '1px solid #e2e8f0',
            }}>
              📜 {v.legal_basis}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Xác minh:** chạy compliance check, thấy tag pháp lý dưới mỗi vi phạm.

### Mục B1.4 — Nút "Xuất Checklist Phụ lục I" trong ComplianceTab

Thực hiện sau Phase C (vì Checklist endpoint cần làm ở Phase C trước). Đặt vào danh sách "DEFERRED — quay lại sau Phase C".

---

## Mục B2 — FairnessTab: phân biệt giờ ngày/đêm + bỏ ngưỡng cứng

### Mục B2.1 — Analytics: thêm `night_hours` vào response

**File:** `analytics/app/routers/fairness.py`

`view` file. Tìm chỗ tính `total_hours` cho từng controller. Bổ sung tách giờ đêm:
```python
def _night_hours(shift_start, shift_end, night_start=22, night_end=6):
    """Tính số giờ trong khung 22h-06h. Cấu hình từ RestRuleConfig."""
    # Implementation: cắt shift theo từng giờ, đếm giờ có hour ∈ [22, 23] ∪ [0, 5]
    from datetime import timedelta
    total = 0.0
    cur = shift_start
    while cur < shift_end:
        nxt = min(cur + timedelta(hours=1), shift_end)
        if cur.hour >= night_start or cur.hour < night_end:
            total += (nxt - cur).total_seconds() / 3600
        cur = nxt
    return total
```

Trong response của mỗi controller:
```python
{
    "controller_id": ...,
    "controller_name": ...,
    "total_hours": ...,
    "night_hours": round(sum(_night_hours(s.start, s.end) for s in shifts), 1),  # MỚI
    "night_shifts": ...,
    "shift_count": ...,
    "work_days": ...,
}
```

**Xác minh:** curl `/analytics/fairness/summary`, response có `night_hours`.

### Mục B2.2 — FairnessTab: thêm cột "Giờ đêm", bỏ cứng ngưỡng 24h

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm `FairnessTab` (dòng ~212). Trong bảng `<table>` (dòng ~270), thêm cột "GIỜ ĐÊM" giữa "TỔNG GIỜ" và "CA ĐÊM":

```jsx
<thead>
  <tr style={{ backgroundColor: '#f8fafc' }}>
    <th style={T.th}>KSVKL</th>
    <th style={{ ...T.th, textAlign: 'right' }}>TỔNG GIỜ</th>
    <th style={{ ...T.th, textAlign: 'right' }}>GIỜ ĐÊM</th>  {/* MỚI */}
    <th style={{ ...T.th, textAlign: 'right' }}>SỐ CA ĐÊM</th>
    <th style={{ ...T.th, textAlign: 'right' }}>SỐ CA</th>
    <th style={{ ...T.th, textAlign: 'right' }}>NGÀY TRỰC</th>
    <th style={{ ...T.th, width: 120 }}>PHÂN BỔ</th>
  </tr>
</thead>
```

Trong `<tbody>`, thêm cell tương ứng:
```jsx
<td style={{ ...T.td, textAlign: 'right', color: c.night_hours > 0 ? '#7c3aed' : '#cbd5e1', fontFamily: 'Courier New' }}>
  {(c.night_hours ?? 0).toFixed(1)}h
</td>
```

Bỏ ngưỡng cứng "24h" — đổi card "Chênh lệch Max" thành trung tính (không tô đỏ tự động):
```jsx
<SummCard
  label="Chênh lệch Max"
  value={`${res.max_delta_hours.toFixed(1)}h`}
  color="#7c3aed"  // luôn tím — không kết luận đỏ/xanh
  bg="#ede9fe"
/>
```

Thêm note dưới `HowTo`:
```jsx
<InfoBox msg="Dữ liệu phục vụ giám sát công bằng phân ca (FSAG — QĐ 2289 Chương I.III.1). Chênh lệch lớn không tự động là vi phạm — cần đánh giá cùng các yếu tố khác (nguyện vọng cá nhân, đào tạo, công tác)." />
```

**Xác minh:** mở FairnessTab, chạy phân tích, thấy cột "GIỜ ĐÊM" và note FSAG.

---

## Mục B3 — QualificationsTab: mở rộng positions + dropdown days

### Mục B3.1 — Analytics: tách AUXILIARY_POSITIONS khỏi coverage

**File:** `analytics/app/routers/ratings.py`

`view` file. Tìm endpoint `/coverage`. Hiện đang trả về phủ sóng 4 vị trí chính. Cập nhật:

```python
from app.compliance.rest_compliance import ALL_POSITIONS, AUXILIARY_POSITIONS

@router.get("/coverage")
def coverage(db: Session = Depends(get_db)):
    """Phủ sóng năng định theo vị trí.

    AUXILIARY_POSITIONS (HDA/HDC/HDT/HDG) — vị trí hiệp đồng, không cần năng định riêng,
    không tính vào phủ sóng.
    """
    all_employees = db.query(Employee).filter(Employee.isApproved == True).all()
    total_controllers = len(all_employees)
    total_active_full = sum(1 for e in all_employees if (e.qualification or '').strip().lower() == 'full')

    positions_report = []
    for pos in ALL_POSITIONS:
        if pos in AUXILIARY_POSITIONS:
            continue  # bỏ qua vị trí phụ trợ
        qualified = [e for e in all_employees if _has_qualification(e, pos)]
        positions_report.append({
            "position": pos.value,
            "position_label": POSITION_LABELS.get(pos.value, pos.value),
            "qualified_count": len(qualified),
            "active_count": sum(1 for e in qualified if e.qualificationIsActive),
            "is_sufficient": sum(1 for e in qualified if e.qualificationIsActive) >= 3,
            "is_auxiliary": False,
        })

    return {
        "total_controllers": total_controllers,
        "total_active_full": total_active_full,
        "positions": positions_report,
        "note_auxiliary": "Các vị trí hiệp đồng (HDA, HDC, HDT, HDG) không có năng định riêng và không tính trong phủ sóng này.",
    }
```

`POSITION_LABELS` đặt trong cùng file (hoặc `compliance/rest_compliance.py`):
```python
POSITION_LABELS = {
    "APP": "Tiếp cận (APP)",
    "CTL": "Đường dài nội bộ (CTL)",
    "TWR": "Đài chỉ huy (TWR)",
    "GCU": "Đài kiểm soát mặt đất (GCU)",
    "TKT_T6": "Kíp trưởng tầng 6 (APP/CTL)",
    "TKT_T8": "Kíp trưởng tầng 8 (TWR/GCU)",
    "QS": "Quân sự",
    "HDA": "Hiệp đồng APP",
    "HDC": "Hiệp đồng CTL",
    "HDT": "Hiệp đồng TWR",
    "HDG": "Hiệp đồng GCU",
}
```

**Xác minh:** curl `/analytics/ratings/coverage`, response có 7 positions chính + `note_auxiliary`, không có HDA-HDG.

### Mục B3.2 — Frontend: dropdown ngày + render mở rộng

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm `QualificationsTab` (dòng ~323). Thay state hardcode 60 thành dropdown:

```jsx
function QualificationsTab() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [daysAhead, setDaysAhead] = useState(60);  // MỚI

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [aRes, cRes] = await Promise.all([
        analyticsApi.get(`/analytics/ratings/expiring?days=${daysAhead}`),
        analyticsApi.get('/analytics/ratings/coverage'),
      ]);
      setAlerts(aRes.data);
      setCoverage(cRes.data);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  }, [daysAhead]);

  useEffect(() => { load(); }, [load]);
  // ...
}
```

Trong JSX, thay thanh nút "Tải lại" bằng dropdown + nút:
```jsx
<div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
  <div style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <label style={T.lbl}>Cảnh báo trong vòng:</label>
    <select value={daysAhead} onChange={e => setDaysAhead(parseInt(e.target.value))}
            style={{ ...T.inp, padding: '8px 12px' }}>
      <option value={30}>30 ngày</option>
      <option value={60}>60 ngày</option>
      <option value={90}>90 ngày</option>
    </select>
  </div>
  <button type="button" style={{ ...T.btn, backgroundColor: '#475569', opacity: loading ? 0.6 : 1 }}
          onClick={load} disabled={loading}>
    <Icon name="refresh-cw" size={15} color="#fff" />
    <span style={{ marginLeft: 8 }}>Tải lại</span>
  </button>
</div>
```

Trong khối render coverage (dòng ~370-401), thêm note `note_auxiliary` và bỏ `POS_LABEL` cũ (dùng `position_label` từ response):
```jsx
{coverage && (
  <>
    <div style={{ ...T.card, marginBottom: 16 }}>
      <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={T.cardTitle}>PHỦ SÓNG NĂNG ĐỊNH THEO VỊ TRÍ</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {coverage.total_controllers} KSVKL · {coverage.total_active_full} FULL
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, padding: 16 }}>
        {coverage.positions.map(pos => (
          <div key={pos.position} style={{
            backgroundColor: pos.is_sufficient ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${pos.is_sufficient ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                {pos.position_label || pos.position}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: pos.is_sufficient ? '#16a34a' : '#dc2626' }}>
                {pos.is_sufficient ? '✓ ĐỦ' : '✗ THIẾU'}
              </span>
            </div>
            <div style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: 'Courier New', fontSize: 28, fontWeight: 800,
                             color: pos.is_sufficient ? '#15803d' : '#dc2626' }}>{pos.active_count}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>/ {pos.qualified_count} người</span>
            </div>
          </div>
        ))}
      </div>
      {coverage.note_auxiliary && (
        <div style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #f1f5f9' }}>
          ℹ️ {coverage.note_auxiliary}
        </div>
      )}
    </div>
  </>
)}
```

**Xác minh:** mở QualificationsTab, thay dropdown 30/60/90 → số cảnh báo đổi; coverage hiển thị 7 vị trí chính + note phụ trợ ở chân.

---

## Mục B4 — OptimizerTab: đổi disclaimer + thêm ràng buộc QĐ 2288

### Mục B4.1 — Analytics: thêm ràng buộc cứng vào CP-SAT solver

**File:** `analytics/app/routers/optimize.py`

`view` file. Tìm CP-SAT model (`from ortools.sat.python import cp_model`). Hiện chỉ có ràng buộc cơ bản: 1 người/slot, không lặp trong ngày. Bổ sung **5 ràng buộc cứng** từ QĐ 2288:

```python
# Sau khi đã thêm các biến quyết định x[c][s] = 1 nếu controller c được gán slot s

cfg = RestRuleConfig()  # nạp ngưỡng chuẩn

# (1) QĐ 2288 Điều 13.1: nghỉ ≥ 12h giữa 2 ca
# Với mỗi cặp slot (s1, s2) liền kề trong thời gian của cùng controller, gap_hours < 12 → c không được làm cả hai.
for c_id in controller_ids:
    for s1, s2 in itertools.combinations(slot_ids, 2):
        gap = (slots[s2]["start"] - slots[s1]["end"]).total_seconds() / 3600
        if 0 <= gap < cfg.min_rest_between_shifts_hours:
            model.Add(x[c_id][s1] + x[c_id][s2] <= 1)

# (2) QĐ 2288 Điều 15.1.b: ≤ 3 ca đêm liên tiếp
# Với mỗi controller, không cho phép 4 slot đêm liên tiếp trong 4 ngày liên tiếp.
for c_id in controller_ids:
    for i in range(len(night_slots_sorted) - 3):
        window = night_slots_sorted[i:i+4]
        if _are_consecutive_days(window):
            model.Add(sum(x[c_id][s["slot_id"]] for s in window) <= 3)

# (3) QĐ 2288 Điều 15.1.c: nghỉ ≥ 48h sau chuỗi 3 ca đêm
# Sau 3 slot đêm liên tiếp, slot kế tiếp trong vòng 48h không được gán.
# (Implement: cho mỗi cụm 3 đêm liên tiếp + 1 slot sau đó trong 48h, sum ≤ 3.)

# (4) QĐ 2288 Điều 12.2: ≤ 6 ngày làm việc liên tiếp
for c_id in controller_ids:
    for i in range(len(day_dates_sorted) - 6):
        window_dates = day_dates_sorted[i:i+7]
        slots_in_window = [s for s in slot_ids if slots[s]["date"] in window_dates]
        model.Add(sum(x[c_id][s] for s in slots_in_window) <= 6)

# (5) QĐ 2288 Điều 12.1: ≤ 180h/30 ngày
# Nếu period > 30 ngày, kiểm tra cửa sổ trượt; nếu ≤ 30 ngày, áp dụng cho toàn period.
for c_id in controller_ids:
    total_hours_var = sum(
        x[c_id][s] * slots[s]["duration_hours"] for s in slot_ids
    )
    # Nếu period_days <= 30:
    if (slots_period_end - slots_period_start).days <= 30:
        model.Add(total_hours_var <= int(cfg.max_duty_hours_per_30days))
    else:
        # cửa sổ trượt 30 ngày — bỏ qua trong sprint này, đánh dấu TODO
        pass
```

Code trên là **pseudocode chỉ đạo** — Claude trong VSCode phải đọc cấu trúc thực của solver hiện tại rồi chuyển đổi cho khớp. Nếu cấu trúc khác (vd. dùng `IntVar` thay vì `BoolVar`), **DỪNG và hỏi user** trước khi sửa.

Khi thêm các ràng buộc cứng, **có thể khiến bài toán bị infeasible** với input nhỏ. Cần xử lý: trả về status `INFEASIBLE` kèm message giải thích ràng buộc nào vi phạm. Tránh để solver chạy 30 giây rồi báo "không tìm thấy phương án".

**Xác minh:** test với input chứa 2 ca đêm sát nhau (gap < 12h cho 1 người duy nhất) → solver trả `INFEASIBLE`. Test với input đủ rộng → solver trả phương án có max 3 đêm liên tiếp.

### Mục B4.2 — OptimizerTab: thay disclaimer

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm dòng 537 trong `OptimizerTab`:
```jsx
<InfoBox msg="⚠️ Mọi ngưỡng quy định (giờ nghỉ tối thiểu, giờ trực tối đa…) là giá trị ví dụ. Cần thay bằng số liệu VATM/CAAV/ICAO chính thức trước khi dùng thật." />
```

Thay bằng:
```jsx
<InfoBox msg="Áp dụng giới hạn theo QĐ 2288/QĐ-QLB ngày 25/3/2026: nghỉ ≥ 12h giữa 2 ca, ≤ 3 ca đêm liên tiếp, ≤ 6 ngày làm việc liên tiếp, ≤ 180h/30 ngày. Phương án là ĐỀ XUẤT tham khảo — kíp trưởng/cán bộ cơ sở quyết định cuối cùng (QĐ 2288 Điều 5.1)." />
```

**File:** `analytics/app/main.py`

Tìm phần docstring:
```python
"""
main.py
=======
...
LƯU Ý AN TOÀN:
- Dịch vụ truy cập DB ở chế độ CHỈ ĐỌC.
- Mọi ngưỡng quy định CHỈ LÀ GIÁ TRỊ VÍ DỤ — thay bằng số liệu VATM/CAAV/ICAO thực tế.
- Dịch vụ này HỖ TRỢ ra quyết định, KHÔNG thay thế quy trình phê duyệt chính thức.
"""
```

Thay đoạn "Mọi ngưỡng quy định..." bằng:
```python
- Các ngưỡng pháp lý bám theo QĐ 2288/QĐ-QLB ngày 25/3/2026 (Quản lý rủi ro mệt mỏi),
  bổ trợ bởi QĐ 2701/QĐ-QLB ngày 07/5/2024 (chế độ ca, kíp trực) và
  QĐ 2289/QĐ-QLB ngày 25/3/2026 (Chương trình FMP).
- Khi quy định pháp lý thay đổi, cập nhật `RestRuleConfig.effective_from` và các trường tương ứng.
```

**Xác minh:** grep "giá trị ví dụ\|VATM/CAAV/ICAO" trong toàn repo, không còn match nào (trừ trong các CHANGELOG/lịch sử).

---

# PHASE C — Checklist Phụ lục I QĐ 2288

## Mục C1 — Analytics: endpoint `/checklist`

Đã có spec trong `PLAN_INTEGRATION_V2.md` Phần 4 (Mục 4.1, 4.2). Thực hiện y như mô tả. Bổ sung:

- File `analytics/app/review/qd2288_checklist.py` (đã có spec).
- Endpoint `POST /analytics/roster/checklist` (cấp ca chi tiết) và `POST /analytics/roster/macro/checklist` (cấp tháng).

**Bổ sung yêu cầu định dạng kết quả**: response phải có thêm trường tổng kết để render PDF dễ hơn:
```python
return {
    "header": {
        "source": "QĐ 2288/QĐ-QLB ngày 25/3/2026 — Phụ lục I",
        "effective_from": "2026-03-25",
        "generated_at": datetime.utcnow().isoformat(),
        "roster_info": {
            "team": draft.team if hasattr(draft, "team") else "",
            "shift_date": str(draft.shift_date) if hasattr(draft, "shift_date") else "",
            "shift_code": draft.shift_code if hasattr(draft, "shift_code") else "",
            "period": f"{draft.period_start} – {draft.period_end}" if hasattr(draft, "period_start") else "",
        },
    },
    "summary": {
        "total_items": <int>,
        "pass_count":  <int>,
        "fail_count":  <int>,
        "na_count":    <int>,
        "overall_status": "pass" / "fail" / "needs_review",  # pass nếu fail_count=0
    },
    "sections": [...]  # như đã spec
}
```

**Xác minh:** test endpoint trả về cấu trúc đầy đủ; `summary.total_items = sum(len(s.items) for s in sections)`.

---

## Mục C2 — NestJS proxy cho checklist

**File:** `backend/src/analytics/analytics.controller.ts`

Thêm 2 endpoint song song với `review-roster-draft`:

```typescript
@Post('roster-checklist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
async getRosterChecklist(@Body() dto: ReviewDraftDto) {
  const abbrSet = new Set<string>();
  for (const row of dto.rows ?? []) {
    for (const v of Object.values(row.assignments ?? {})) {
      if (v) abbrSet.add(v as string);
    }
  }
  const abbrs = [...abbrSet];
  const emps = abbrs.length
    ? await this.empRepo.find({ where: { icaoCode: In(abbrs), isApproved: true } })
    : [];
  const controllers = emps.map(e => ({
    abbr: e.icaoCode, id: e.id, name: e.name,
    qualification: e.qualification ?? '',
  }));
  return this.client.getRosterChecklist({
    team: dto.team, shift_code: dto.shift_code, shift_date: dto.shift_date,
    rows: dto.rows, controllers,
  });
}

@Post('macro-checklist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
async getMacroChecklist(@Body() dto: MacroReviewDto) {
  // ... tương tự pattern review-macro-roster
}
```

Trong `AnalyticsClient`, thêm 2 method tương ứng (`getRosterChecklist`, `getMacroChecklist`).

**Xác minh:** `npm run build` thành công; test integration.

---

## Mục C3 — Component `ChecklistViewer.jsx`

**File mới:** `src/components/ChecklistViewer.jsx`

```jsx
import React from 'react';

const STATUS_LABEL = {
  pass: { text: 'Đạt',       color: '#15803d', bg: '#dcfce7' },
  fail: { text: 'Không đạt', color: '#dc2626', bg: '#fef2f2' },
  na:   { text: 'N/A',       color: '#64748b', bg: '#f1f5f9' },
};

export default function ChecklistViewer({ data, onPrint }) {
  if (!data) return null;
  const { header, summary, sections } = data;

  return (
    <div className="checklist-viewer" style={{ backgroundColor: '#fff', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
          CHECK LIST ĐÁNH GIÁ LỊCH TRỰC
        </h1>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          (Roster Assessment — {header.source})
        </div>
        {header.roster_info && (
          <div style={{ fontSize: 13, marginTop: 12 }}>
            {header.roster_info.team && <span>Kíp: <strong>{header.roster_info.team}</strong> · </span>}
            {header.roster_info.shift_date && <span>Ngày: <strong>{header.roster_info.shift_date}</strong> · </span>}
            {header.roster_info.shift_code && <span>Ca: <strong>{header.roster_info.shift_code}</strong></span>}
            {header.roster_info.period && <span>Chu kỳ: <strong>{header.roster_info.period}</strong></span>}
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24,
        padding: 16, backgroundColor: '#f8fafc', borderRadius: 8,
      }}>
        <div><strong>{summary.total_items}</strong> tiêu chí</div>
        <div style={{ color: '#15803d' }}><strong>{summary.pass_count}</strong> Đạt</div>
        <div style={{ color: '#dc2626' }}><strong>{summary.fail_count}</strong> Không đạt</div>
        <div style={{ color: '#64748b' }}><strong>{summary.na_count}</strong> N/A</div>
        <div style={{ marginLeft: 'auto', fontWeight: 700,
                      color: summary.overall_status === 'pass' ? '#15803d' :
                             summary.overall_status === 'fail' ? '#dc2626' : '#d97706' }}>
          KẾT QUẢ: {summary.overall_status === 'pass' ? 'ĐẠT'
                    : summary.overall_status === 'fail' ? 'KHÔNG ĐẠT' : 'CẦN RÀ SOÁT'}
        </div>
      </div>

      {/* Sections */}
      {sections.map(section => (
        <div key={section.code} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8,
                       padding: '8px 12px', backgroundColor: '#e2e8f0', borderRadius: 6 }}>
            {section.code}. {section.title}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ ...thStyle, width: 60 }}>STT</th>
                <th style={thStyle}>Tiêu chí</th>
                <th style={{ ...thStyle, width: 130 }}>Yêu cầu</th>
                <th style={{ ...thStyle, width: 100 }}>Kết quả</th>
                <th style={thStyle}>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map(item => {
                const st = STATUS_LABEL[item.status] || STATUS_LABEL.na;
                return (
                  <tr key={item.code}>
                    <td style={tdStyle}><strong>{item.code}</strong></td>
                    <td style={tdStyle}>{item.criterion}</td>
                    <td style={tdStyle}>{item.requirement}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', padding: '2px 8px',
                                     borderRadius: 4, fontWeight: 600,
                                     color: st.color, backgroundColor: st.bg }}>
                        {st.text}
                      </span>
                    </td>
                    <td style={tdStyle}>{item.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
        Sinh tự động vào {new Date(header.generated_at).toLocaleString('vi-VN')}.
        Căn cứ pháp lý: {header.source}. Hiệu lực từ {header.effective_from}.
      </div>

      {/* Print button (hidden when printing) */}
      <div className="no-print" style={{ marginTop: 24, textAlign: 'right' }}>
        <button onClick={onPrint || (() => window.print())}
                style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff',
                         border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          🖨️ In / Xuất PDF
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

const thStyle = {
  textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700,
  color: '#475569', borderBottom: '1px solid #e2e8f0',
};
const tdStyle = {
  padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'top',
};
```

**Xác minh:** import vào ChecklistTab (Mục C4) và render với data thử.

---

## Mục C4 — `ChecklistTab` trong AnalyticsScreen

Thay placeholder `ChecklistTab` ở Mục A2 bằng:

```jsx
function ChecklistTab() {
  const [mk, setMk] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  const run = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      // Sinh checklist từ kết quả compliance check theo tháng
      // Lưu ý: cấp tháng dùng /macro-checklist với assignments lấy từ scheduleData
      // Mục này: bắt đầu với cấp tháng (tổng quan). Chi tiết cấp ca cụ thể nằm trong
      // DetailedRosterModal (Mục C5).
      const { data: scheduleData } = await api.get(`/api/schedules/${mk}`);
      // chuyển scheduleData -> assignments[]
      // ... (Claude phải xem cấu trúc thực, không hard-code)
      const { data: checklist } = await api.post('/api/schedules/macro-checklist', {
        period_start: mk + '-01',
        period_end: mk + '-' + new Date(parseInt(mk.split('-')[0]), parseInt(mk.split('-')[1]), 0).getDate(),
        assignments: /* chuyển đổi từ scheduleData */,
      });
      setData(checklist);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Chọn tháng cần đánh giá.',
        'Nhấn "Sinh Checklist" — hệ thống đọc lịch trực, đối chiếu với QĐ 2288 Phụ lục I.',
        'Xem kết quả: 5 nhóm tiêu chí A-E, tổng cộng 23 mục.',
        'Nhấn "In / Xuất PDF" để in checklist (định dạng A4, gửi Ban An toàn-Chất lượng).',
      ]} />

      <div style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ gap: 4 }}>
          <label style={T.lbl}>Tháng đánh giá</label>
          <input type="month" style={T.inp} value={mk} onChange={e => setMk(e.target.value)} />
        </div>
        <button type="button" style={{ ...T.btn, opacity: loading ? 0.6 : 1 }} onClick={run} disabled={loading}>
          {loading ? <Spinner size={15} color="#fff" /> : <Icon name="check-square" size={15} color="#fff" />}
          <span style={{ marginLeft: 8 }}>{loading ? 'Đang sinh…' : 'Sinh Checklist'}</span>
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      {data && <ChecklistViewer data={data} />}

      {!data && !loading && !err && (
        <Empty icon="check-square" text="Chọn tháng và nhấn 'Sinh Checklist' để xem kết quả." />
      )}
    </div>
  );
}
```

Lưu ý ở đầu file, thêm import:
```jsx
import ChecklistViewer from '../components/ChecklistViewer.jsx';
import api from '../services/ApiService';
```

**Câu hỏi mở:** cấu trúc lưu lịch tháng tổng hợp ở backend ra sao? Endpoint `/api/schedules/:monthKey` đã tồn tại chưa? Nếu chưa, Claude phải DỪNG và hỏi user.

**Xác minh:** chuyển sang tab Checklist → chọn tháng → bấm Sinh → checklist hiển thị → bấm In → cửa sổ in browser mở.

---

## Mục C5 — Nút "Xuất Checklist" trong DetailedRosterModal

**File:** `src/components/DetailedRosterModal.js`

Thực hiện sau khi `PLAN_INTEGRATION_V2.md` Phần 2 đã hoàn thành (nút "Rà soát" đã được thêm). Thêm nút thứ hai cạnh nút "Rà soát":

```jsx
const [exportingChecklist, setExportingChecklist] = useState(false);

const handleExportChecklist = useCallback(async () => {
  setExportingChecklist(true);
  try {
    const rows = /* y như trong handleReview — chuyển gridData sang rows */;
    const { data } = await api.post('/api/schedules/roster-checklist', {
      team, shift_code: currentShift, shift_date: currentDate, rows,
    });
    // Mở cửa sổ mới render ChecklistViewer
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) {
      alert('Trình duyệt chặn cửa sổ mới. Cho phép pop-up và thử lại.');
      return;
    }
    w.document.title = `Checklist — ${team} ${currentDate} ${currentShift}`;
    // Render ChecklistViewer thông qua ReactDOM trong cửa sổ mới — phức tạp.
    // Phương án đơn giản hơn: render thành HTML tĩnh.
    w.document.body.innerHTML = renderChecklistHtml(data);
    setTimeout(() => w.print(), 500);
  } catch (e) {
    alert('Lỗi sinh checklist: ' + (e?.response?.data?.message ?? e.message));
  } finally {
    setExportingChecklist(false);
  }
}, [gridData, customCols, team, currentShift, currentDate]);
```

Trong JSX, cạnh nút "Rà soát":
```jsx
{isAdmin && reviewResult && (
  <button onClick={handleExportChecklist} disabled={exportingChecklist}
          style={{ marginRight: 8 }}>
    {exportingChecklist ? 'Đang tạo…' : '📋 Xuất Checklist (PL I)'}
  </button>
)}
```

**File mới:** `src/utils/checklistHtml.js` — hàm `renderChecklistHtml(data)` dựng HTML tĩnh (không cần React) cho cửa sổ in. Cấu trúc giống `ChecklistViewer` nhưng là string template. Đảm bảo có CSS `@media print` để bố cục đẹp khi in.

**Xác minh:** mở DetailedRosterModal, dán dữ liệu, bấm Rà soát → bấm Xuất Checklist → cửa sổ in mở với bảng A-B-C-D-E.

---

# PHASE G — SPI Dashboard (Điều 24 QĐ 2288)

> Thực hiện sau Phase C vì SPI tổng hợp từ dữ liệu sẵn có (compliance, fairness, on-call, ca kéo dài). Khi các form Phase D-E-F xong thì SPI bổ sung thêm chỉ số (số báo cáo mệt mỏi, số đổi ca, etc.) — đặt placeholder cho các chỉ số này.

## Mục G1 — Analytics endpoint `/spi/summary`

**File mới:** `analytics/app/routers/spi.py`

```python
"""
spi.py
======
Chỉ số hiệu suất an toàn (SPI) liên quan mệt mỏi — QĐ 2288 Điều 24.
Đầu ra: tổng hợp các chỉ số trong một khoảng thời gian (mặc định: tháng hiện tại).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.deps import get_db

router = APIRouter(prefix="/analytics/spi", tags=["spi"])


@router.get("/summary")
def get_spi_summary(month_key: str | None = None, db: Session = Depends(get_db)):
    """Tổng hợp SPI cho 1 tháng. Nếu month_key=None thì tháng hiện tại."""
    if month_key is None:
        now = datetime.utcnow()
        month_key = f"{now.year}-{now.month:02d}"
    year, month = map(int, month_key.split('-'))
    period_start = datetime(year, month, 1)
    period_end = datetime(year + (month // 12), (month % 12) + 1, 1) - timedelta(seconds=1)

    # 1. Số vi phạm giới hạn lập lịch (QĐ 2288 Điều 24.1.b)
    # Tận dụng compliance/check đã có
    from app.routers.compliance import _check_compliance_for_month
    compl = _check_compliance_for_month(db, month_key)
    violations_by_severity = {"CRITICAL": 0, "WARNING": 0, "INFO": 0}
    for v in compl["violations"]:
        violations_by_severity[v["severity"]] = violations_by_severity.get(v["severity"], 0) + 1

    # 2. Số ca kéo dài (QĐ 2288 Điều 24.1.h — Tỷ lệ ca kéo dài)
    # Đếm các Shift có duration > max_designed_shift_hours
    extended_shift_count = _count_extended_shifts(db, period_start, period_end)

    # 3. Tỷ lệ sử dụng on-call (QĐ 2288 Điều 24.1.h)
    # Cần dữ liệu on-call — TODO: bổ sung khi schema on-call có
    oncall_total = 0
    oncall_activated = 0

    # 4. Số báo cáo mệt mỏi (Điều 24.1.a) — TODO: chờ Phase D
    fatigue_reports_count = 0

    # 5. Số deviation (Điều 24.1.c) — TODO: chờ module deviation
    deviation_count = 0

    # 6. Số variation (Điều 24.1.d)
    variation_count = 0

    # 7. Tỷ lệ hoàn thành đào tạo FMP/FRMS (Điều 24.1.g) — TODO
    training_completion_pct = None

    return {
        "month_key": month_key,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "spi": {
            "fatigue_reports_count": {
                "value": fatigue_reports_count,
                "label": "Số báo cáo mệt mỏi",
                "legal_basis": "QĐ 2288 Điều 24.1.a",
                "trend": None,
                "status": "ok",  # ok / warning / critical
            },
            "limit_violations_critical": {
                "value": violations_by_severity["CRITICAL"],
                "label": "Vi phạm giới hạn CRITICAL",
                "legal_basis": "QĐ 2288 Điều 24.1.b",
                "trend": None,
                "status": "critical" if violations_by_severity["CRITICAL"] > 0 else "ok",
            },
            "limit_violations_warning": {
                "value": violations_by_severity["WARNING"],
                "label": "Vi phạm giới hạn WARNING",
                "legal_basis": "QĐ 2288 Điều 24.1.b",
                "status": "warning" if violations_by_severity["WARNING"] > 5 else "ok",
            },
            "deviation_count": {
                "value": deviation_count,
                "label": "Số deviation",
                "legal_basis": "QĐ 2288 Điều 24.1.c",
                "status": "ok",
            },
            "variation_count": {
                "value": variation_count,
                "label": "Số variation đang áp dụng",
                "legal_basis": "QĐ 2288 Điều 24.1.d",
                "status": "ok",
            },
            "extended_shifts_count": {
                "value": extended_shift_count,
                "label": "Số ca kéo dài",
                "legal_basis": "QĐ 2288 Điều 24.1.h",
                "status": "warning" if extended_shift_count > 10 else "ok",
            },
            "oncall_activation_rate": {
                "value": (oncall_activated / oncall_total * 100) if oncall_total else None,
                "label": "Tỷ lệ kích hoạt on-call (%)",
                "legal_basis": "QĐ 2288 Điều 24.1.h",
                "status": "ok",
                "details": {"total": oncall_total, "activated": oncall_activated},
            },
            "training_completion_pct": {
                "value": training_completion_pct,
                "label": "Tỷ lệ hoàn thành đào tạo FMP/FRMS",
                "legal_basis": "QĐ 2288 Điều 24.1.g",
                "status": "ok",
            },
        },
    }


def _count_extended_shifts(db, start, end):
    """Đếm số ca có duration > 10h (vượt max_designed_shift)."""
    # TODO: query schedules trong khoảng [start, end], tính duration
    return 0
```

Đăng ký router trong `analytics/app/main.py`:
```python
from app.routers import compliance, fairness, optimize, ratings, roster, spi
app.include_router(spi.router)
```

**Xác minh:** curl `/analytics/spi/summary?month_key=2026-05` trả JSON đầy đủ structure.

---

## Mục G2 — NestJS proxy + `SpiDashboardTab`

**File:** `backend/src/analytics/analytics.controller.ts`

```typescript
@Get('spi-summary/:monthKey')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
async getSpiSummary(@Param('monthKey') monthKey: string) {
  return this.client.getSpiSummary(monthKey);
}
```

**File:** `src/screens/AnalyticsScreen.jsx`

Thay placeholder `SpiDashboardTab`:

```jsx
function SpiDashboardTab() {
  const [mk, setMk] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const { data: res } = await api.get(`/api/schedules/spi-summary/${mk}`);
      setData(res);
    } catch (e) {
      setErr(apiErr(e));
    } finally { setLoading(false); }
  }, [mk]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Dashboard hiển thị các chỉ số hiệu suất an toàn (SPI) liên quan mệt mỏi.',
        'Cơ sở: QĐ 2288/QĐ-QLB Điều 24 — chỉ số FMP/FRMS.',
        'Một số chỉ số (báo cáo mệt mỏi, đào tạo) sẽ có dữ liệu khi các module tương ứng được triển khai.',
      ]} />

      <div style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ gap: 4 }}>
          <label style={T.lbl}>Tháng</label>
          <input type="month" style={T.inp} value={mk} onChange={e => setMk(e.target.value)} />
        </div>
        <button type="button" onClick={load} disabled={loading} style={T.btn}>
          <Icon name="refresh-cw" size={15} color="#fff" />
          <span style={{ marginLeft: 8 }}>Tải lại</span>
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {Object.entries(data.spi).map(([key, ind]) => (
            <SpiCard key={key} indicator={ind} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpiCard({ indicator }) {
  const STATUS_COLORS = {
    ok:       { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    warning:  { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  };
  const s = STATUS_COLORS[indicator.status] || STATUS_COLORS.ok;
  const val = indicator.value;
  return (
    <div style={{
      backgroundColor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{indicator.label}</div>
      <div style={{ fontFamily: 'Courier New', fontSize: 32, fontWeight: 800, color: s.text }}>
        {val === null || val === undefined ? '—' :
         (typeof val === 'number' && indicator.label.includes('%') ? `${val.toFixed(0)}%` : val)}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        📜 {indicator.legal_basis}
      </div>
    </div>
  );
}
```

**Xác minh:** chuyển sang tab "Dashboard SPI" → các card chỉ số hiển thị; một số chỉ số = 0 hoặc — (vì các module Phase D-E-F chưa có).

---

# PHASE D — Báo cáo mệt mỏi (Phụ lục III QĐ 2288)

## Mục D1 — DB migration cho `fatigue_reports`

**File:** `backend/migration.sql` — append:

```sql
-- Báo cáo mệt mỏi — QĐ 2288 Phụ lục III + QĐ 2289 Chương VI
-- Lưu trữ ≥ 5 năm (QĐ 2288 Điều 26.2).
-- Bảo mật: tên người báo cáo CHỈ hiển thị cho Ban An toàn - Chất lượng và Kíp trưởng.
-- Báo cáo tổng hợp KHÔNG hiển thị tên (chỉ mã ẩn danh).

CREATE TABLE IF NOT EXISTS fatigue_reports (
  id              VARCHAR PRIMARY KEY,
  anon_code       VARCHAR NOT NULL UNIQUE,   -- mã ẩn danh tự sinh (vd "FR-2026-000123")
  reporter_id     VARCHAR,                   -- nullable nếu báo cáo ẩn danh hoàn toàn
  facility        VARCHAR,                   -- Phần A: Cơ sở/Vị trí
  shift_type      VARCHAR,                   -- Phần A: 'DAY' / 'NIGHT' / 'ONCALL'
  shift_start     TIMESTAMPTZ,               -- Phần A
  shift_end       TIMESTAMPTZ,               -- Phần A
  contact         VARCHAR,                   -- Phần A: liên hệ (tùy chọn)
  fatigue_onset   VARCHAR NOT NULL,          -- Phần B: thời điểm xuất hiện mệt mỏi
  kss_score       INTEGER NOT NULL CHECK (kss_score BETWEEN 1 AND 9),  -- Phần B: thang KSS
  sleep_hours_72  DECIMAL(4,1),              -- Phần B: số giờ ngủ 72h qua
  sleep_hours_24  DECIMAL(4,1),              -- Phần B: số giờ ngủ 24h qua
  sleep_quality   VARCHAR,                   -- Phần B: chất lượng giấc ngủ gần nhất
  impact_description TEXT NOT NULL,          -- Phần B: mô tả ảnh hưởng
  factors_schedule JSONB DEFAULT '[]',       -- Phần B: yếu tố lịch (array of strings)
  factors_operation JSONB DEFAULT '[]',      -- Phần B: yếu tố khai thác
  factors_personal JSONB DEFAULT '[]',       -- Phần B: yếu tố cá nhân/môi trường
  factors_other   TEXT,                      -- Phần B: yếu tố khác (free text)
  immediate_action TEXT,                     -- Phần B: hành động khắc phục tức thời
  -- Phần C — cam kết được hiển thị nguyên văn QĐ 2288, không lưu vào DB
  status          VARCHAR NOT NULL DEFAULT 'submitted',
                  -- 'submitted' / 'acknowledged' / 'analyzed' / 'closed'
  acknowledged_by VARCHAR,                   -- ID kíp trưởng/quản lý đã xác nhận
  acknowledged_at TIMESTAMPTZ,
  safety_notified BOOLEAN NOT NULL DEFAULT FALSE,
                  -- TRUE nếu đã chuyển tiếp đến Ban An toàn-Chất lượng (sau 24h)
  safety_notified_at TIMESTAMPTZ,
  analysis_note   TEXT,                      -- Ghi chú phân tích của Ban An toàn
  closed_at       TIMESTAMPTZ,
  is_red_line     BOOLEAN NOT NULL DEFAULT FALSE,
                  -- TRUE nếu phát hiện "ranh giới đỏ" (QĐ 2289 Chương VI.VII)
  red_line_reason VARCHAR,
  extra_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_reports_reporter ON fatigue_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_reports_status   ON fatigue_reports(status);
CREATE INDEX IF NOT EXISTS idx_fatigue_reports_created  ON fatigue_reports(created_at);
```

**Xác minh:** chạy migration trên DB dev, `\d fatigue_reports` thấy đủ cột.

---

## Mục D2 — Backend module `fatigue_reports`

**File mới:** `backend/src/fatigue-reports/fatigue-report.entity.ts`

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fatigue_reports')
export class FatigueReport {
  @PrimaryColumn()                                 id:               string;
  @Column({ unique: true })                        anonCode:         string;
  @Column({ nullable: true })                      reporterId:       string;
  @Column({ nullable: true })                      facility:         string;
  @Column({ nullable: true })                      shiftType:        string;
  @Column({ type: 'timestamptz', nullable: true }) shiftStart:       Date;
  @Column({ type: 'timestamptz', nullable: true }) shiftEnd:         Date;
  @Column({ nullable: true })                      contact:          string;
  @Column()                                        fatigueOnset:     string;
  @Column({ type: 'int' })                         kssScore:         number;
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true }) sleepHours72: number;
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true }) sleepHours24: number;
  @Column({ nullable: true })                      sleepQuality:     string;
  @Column({ type: 'text' })                        impactDescription: string;
  @Column({ type: 'jsonb', default: '[]' })        factorsSchedule:  string[];
  @Column({ type: 'jsonb', default: '[]' })        factorsOperation: string[];
  @Column({ type: 'jsonb', default: '[]' })        factorsPersonal:  string[];
  @Column({ type: 'text', nullable: true })        factorsOther:     string;
  @Column({ type: 'text', nullable: true })        immediateAction:  string;
  @Column({ default: 'submitted' })                status:           string;
  @Column({ nullable: true })                      acknowledgedBy:   string;
  @Column({ type: 'timestamptz', nullable: true }) acknowledgedAt:   Date;
  @Column({ default: false })                      safetyNotified:   boolean;
  @Column({ type: 'timestamptz', nullable: true }) safetyNotifiedAt: Date;
  @Column({ type: 'text', nullable: true })        analysisNote:     string;
  @Column({ type: 'timestamptz', nullable: true }) closedAt:         Date;
  @Column({ default: false })                      isRedLine:        boolean;
  @Column({ nullable: true })                      redLineReason:    string;
  @Column({ type: 'jsonb', default: '{}' })        extraData:        Record<string, any>;
  @CreateDateColumn()                              createdAt:        Date;
  @UpdateDateColumn()                              updatedAt:        Date;
}
```

**File mới:** `backend/src/fatigue-reports/fatigue-reports.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { FatigueReport } from './fatigue-report.entity';

@Injectable()
export class FatigueReportsService {
  constructor(
    @InjectRepository(FatigueReport) private readonly repo: Repository<FatigueReport>,
  ) {}

  private async _nextAnonCode(): Promise<string> {
    // Format FR-YYYY-NNNNNN — không tiết lộ ai/khi nào báo cáo
    const year = new Date().getFullYear();
    const yearPrefix = `FR-${year}-`;
    const last = await this.repo
      .createQueryBuilder('fr')
      .where('fr.anonCode LIKE :p', { p: `${yearPrefix}%` })
      .orderBy('fr.anonCode', 'DESC')
      .limit(1)
      .getOne();
    const nextNum = last
      ? parseInt(last.anonCode.slice(yearPrefix.length)) + 1
      : 1;
    return `${yearPrefix}${String(nextNum).padStart(6, '0')}`;
  }

  async create(data: Partial<FatigueReport>): Promise<FatigueReport> {
    const id = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const anonCode = await this._nextAnonCode();
    const report = this.repo.create({
      ...data,
      id,
      anonCode,
      status: 'submitted',
    });
    return this.repo.save(report);
  }

  async findMine(reporterId: string): Promise<FatigueReport[]> {
    return this.repo.find({ where: { reporterId }, order: { createdAt: 'DESC' } });
  }

  async findForChief(): Promise<FatigueReport[]> {
    // Kíp trưởng thấy các báo cáo chưa acknowledged + của 30 ngày gần nhất
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    return this.repo.find({
      where: { createdAt: MoreThan(since) },
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledge(id: string, chiefId: string): Promise<FatigueReport> {
    const r = await this.repo.findOneByOrFail({ id });
    r.acknowledgedBy = chiefId;
    r.acknowledgedAt = new Date();
    if (r.status === 'submitted') r.status = 'acknowledged';
    return this.repo.save(r);
  }

  async findAnonymizedSummary(periodStart: Date, periodEnd: Date) {
    // Cho Ban An toàn-Chất lượng + FSAG: thống kê tổng hợp, KHÔNG có tên/ID người báo cáo
    const reports = await this.repo.find({
      where: { createdAt: MoreThan(periodStart) },
      order: { createdAt: 'DESC' },
    });
    return reports
      .filter(r => r.createdAt <= periodEnd)
      .map(r => ({
        anonCode: r.anonCode,
        facility: r.facility,
        shiftType: r.shiftType,
        kssScore: r.kssScore,
        fatigueOnset: r.fatigueOnset,
        factors: {
          schedule:  r.factorsSchedule,
          operation: r.factorsOperation,
          personal:  r.factorsPersonal,
        },
        status: r.status,
        createdAt: r.createdAt,
        isRedLine: r.isRedLine,
        // KHÔNG bao gồm: reporterId, contact, impactDescription, immediateAction
      }));
  }

  async notifySafetyDept(id: string) {
    const r = await this.repo.findOneByOrFail({ id });
    r.safetyNotified = true;
    r.safetyNotifiedAt = new Date();
    return this.repo.save(r);
  }
}
```

**File mới:** `backend/src/fatigue-reports/fatigue-reports.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsInt, Min, Max, IsOptional, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FatigueReportsService } from './fatigue-reports.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

class CreateFatigueReportDto {
  @IsOptional() @IsString() facility?: string;
  @IsOptional() @IsString() shiftType?: string;
  @IsOptional() @IsString() shiftStart?: string;
  @IsOptional() @IsString() shiftEnd?: string;
  @IsOptional() @IsString() contact?: string;
  @IsString() fatigueOnset!: string;
  @IsInt() @Min(1) @Max(9) kssScore!: number;
  @IsOptional() sleepHours72?: number;
  @IsOptional() sleepHours24?: number;
  @IsOptional() @IsString() sleepQuality?: string;
  @IsString() impactDescription!: string;
  @IsArray() factorsSchedule!: string[];
  @IsArray() factorsOperation!: string[];
  @IsArray() factorsPersonal!: string[];
  @IsOptional() @IsString() factorsOther?: string;
  @IsOptional() @IsString() immediateAction?: string;
}

@Controller('api/fatigue-reports')
export class FatigueReportsController {
  constructor(
    private readonly svc: FatigueReportsService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateFatigueReportDto, @Req() req: any) {
    const report = await this.svc.create({
      ...dto,
      reporterId: req.user?.sub ?? null,
    });
    // Thông báo cho kíp trưởng của reporter (KHÔNG broadcast cho tất cả)
    this.notify.broadcastNotification('fatigue:new', {
      anonCode: report.anonCode,
      kssScore: report.kssScore,
      // KHÔNG gửi tên người báo cáo
    });
    return { anonCode: report.anonCode, id: report.id };
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: any) {
    return this.svc.findMine(req.user.sub);
  }

  @Get('for-chief')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  findForChief() {
    return this.svc.findForChief();
  }

  @Put(':id/acknowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  ack(@Param('id') id: string, @Req() req: any) {
    return this.svc.acknowledge(id, req.user.sub);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  summary(@Query('start') start: string, @Query('end') end: string) {
    return this.svc.findAnonymizedSummary(new Date(start), new Date(end));
  }
}
```

**File mới:** `backend/src/fatigue-reports/fatigue-reports.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FatigueReport } from './fatigue-report.entity';
import { FatigueReportsController } from './fatigue-reports.controller';
import { FatigueReportsService } from './fatigue-reports.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([FatigueReport]), NotificationsModule],
  controllers: [FatigueReportsController],
  providers:   [FatigueReportsService],
})
export class FatigueReportsModule {}
```

Đăng ký trong `backend/src/app.module.ts` — thêm `FatigueReportsModule` vào `imports[]`.

**Xác minh:** `cd backend && npm run build` thành công; chạy backend, POST một báo cáo thử qua curl → response có `anonCode` định dạng `FR-2026-000001`.

---

## Mục D3 — Frontend: `KssScale` widget

**File mới:** `src/components/KssScale.jsx`

```jsx
import React from 'react';

const KSS_LEVELS = [
  { value: 1, label: 'Cực kỳ tỉnh táo',                       short: 'Sẵn sàng', color: '#16a34a' },
  { value: 2, label: 'Rất tỉnh táo',                          short: 'Sẵn sàng', color: '#16a34a' },
  { value: 3, label: 'Tỉnh táo',                              short: 'Sẵn sàng', color: '#22c55e' },
  { value: 4, label: 'Khá tỉnh táo',                          short: 'Sẵn sàng', color: '#84cc16' },
  { value: 5, label: 'Không tỉnh táo cũng không buồn ngủ',    short: 'Sẵn sàng', color: '#facc15' },
  { value: 6, label: 'Có một số dấu hiệu buồn ngủ',           short: 'Thận trọng', color: '#f97316' },
  { value: 7, label: 'Buồn ngủ, nhưng có thể giữ tỉnh táo',   short: 'Rủi ro tăng', color: '#ef4444' },
  { value: 8, label: 'Rất buồn ngủ, rất cố gắng để giữ tỉnh', short: 'Rủi ro cao', color: '#dc2626' },
  { value: 9, label: 'Cực kỳ buồn ngủ, gần như không thể tỉnh', short: 'Không đủ điều kiện', color: '#991b1b' },
];

export default function KssScale({ value, onChange, readOnly = false }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Thang đo buồn ngủ Karolinska (KSS) — QĐ 2288 Phụ lục II
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {KSS_LEVELS.map(lvl => (
          <label key={lvl.value}
                 style={{
                   display: 'flex', alignItems: 'center', gap: 12,
                   padding: '10px 12px',
                   border: '1px solid ' + (value === lvl.value ? lvl.color : '#e2e8f0'),
                   borderRadius: 8,
                   backgroundColor: value === lvl.value ? `${lvl.color}15` : '#fff',
                   cursor: readOnly ? 'default' : 'pointer',
                 }}>
            <input type="radio" name="kss" value={lvl.value} checked={value === lvl.value}
                   onChange={() => !readOnly && onChange?.(lvl.value)} disabled={readOnly} />
            <span style={{ fontFamily: 'Courier New', fontSize: 18, fontWeight: 800,
                           color: lvl.color, width: 24 }}>{lvl.value}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{lvl.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: lvl.color,
                           padding: '2px 8px', backgroundColor: `${lvl.color}15`, borderRadius: 4 }}>
              {lvl.short}
            </span>
          </label>
        ))}
      </div>
      {value >= 7 && (
        <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
          ⚠️ Điểm KSS từ 7 trở lên cho thấy mệt mỏi đáng kể. Báo ngay Kíp trưởng/Quản lý ca
          theo QĐ 2289 Chương VI mục III bước 2.
        </div>
      )}
    </div>
  );
}
```

**Xác minh:** import vào `FatigueReportTab` (Mục D4) và render với value=5 → ô số 5 được highlight.

---

## Mục D4 — `FatigueReportTab`: form Phần A/B/C

Thay placeholder ở Mục A2 bằng component đầy đủ. Vì code dài, mình mô tả cấu trúc — Claude trong VSCode tự code đúng theo spec:

**File:** `src/screens/AnalyticsScreen.jsx`

```jsx
function FatigueReportTab({ currentUser }) {
  const [view, setView] = useState('form'); // 'form' | 'history' | 'detail'
  // Form state
  const [facility, setFacility] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [contact, setContact] = useState('');
  const [fatigueOnset, setFatigueOnset] = useState('');
  const [kssScore, setKssScore] = useState(null);
  const [sleepHours72, setSleepHours72] = useState('');
  const [sleepHours24, setSleepHours24] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [impactDescription, setImpactDescription] = useState('');
  const [factorsSchedule, setFactorsSchedule] = useState(new Set());
  const [factorsOperation, setFactorsOperation] = useState(new Set());
  const [factorsPersonal, setFactorsPersonal] = useState(new Set());
  const [factorsOther, setFactorsOther] = useState('');
  const [immediateAction, setImmediateAction] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const submit = async () => {
    if (!fatigueOnset || !kssScore || !impactDescription) {
      alert('Vui lòng điền các trường bắt buộc (Phần B).');
      return;
    }
    if (!agreed) {
      alert('Vui lòng xác nhận cam kết (Phần C) trước khi gửi.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/fatigue-reports', {
        facility, shiftType,
        shiftStart: shiftStart || null, shiftEnd: shiftEnd || null,
        contact: contact || null,
        fatigueOnset,
        kssScore,
        sleepHours72: sleepHours72 ? parseFloat(sleepHours72) : null,
        sleepHours24: sleepHours24 ? parseFloat(sleepHours24) : null,
        sleepQuality: sleepQuality || null,
        impactDescription,
        factorsSchedule:  [...factorsSchedule],
        factorsOperation: [...factorsOperation],
        factorsPersonal:  [...factorsPersonal],
        factorsOther: factorsOther || null,
        immediateAction: immediateAction || null,
      });
      setSubmitResult(data);
      // Reset form
      // (...)
    } catch (e) {
      alert('Lỗi gửi báo cáo: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      {/* Disclaimer Just Culture — luôn hiển thị ở đầu */}
      <div style={{
        padding: 16, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
        borderRadius: 8, marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 8, color: '#0c4a6e' }}>
          🛡️ Báo cáo mệt mỏi — Văn hóa An toàn Công bằng (Just Culture)
        </h3>
        <p style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, margin: 0 }}>
          Báo cáo mệt mỏi <strong>không phải là thừa nhận lỗi</strong>. Mục đích duy nhất:
          nhận diện và kiểm soát rủi ro mệt mỏi (QĐ 2289 Chương VI mục I).
          Báo cáo của bạn <strong>không được sử dụng để xử lý kỷ luật</strong>, đánh giá thi đua,
          hoặc truy cứu trách nhiệm cá nhân (trừ trường hợp gian dối hoặc vi phạm "Ranh giới đỏ"
          theo QĐ 2289 Chương VI mục VII).
        </p>
      </div>

      {submitResult ? (
        <div style={{
          padding: 24, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Báo cáo đã được ghi nhận</h3>
          <p style={{ color: '#15803d', marginBottom: 16 }}>
            Mã ẩn danh: <strong style={{ fontFamily: 'Courier New', fontSize: 18 }}>
              {submitResult.anonCode}
            </strong>
          </p>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Kíp trưởng/Quản lý ca đã được thông báo. Bạn có thể tra cứu báo cáo này
            qua mã ẩn danh ở phần "Lịch sử báo cáo của tôi".
          </p>
          <button onClick={() => setSubmitResult(null)} style={{ marginTop: 16, ...T.btn }}>
            Tạo báo cáo mới
          </button>
        </div>
      ) : (
        <>
          {/* PHẦN A — TÙY CHỌN */}
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>
            Phần A — Thông tin chung (tùy chọn)
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            Các trường này không bắt buộc. Bỏ trống nếu muốn báo cáo hoàn toàn ẩn danh.
          </p>
          {/* facility, shiftType, shiftStart, shiftEnd, contact */}
          {/* ... (input fields) */}

          {/* PHẦN B — BẮT BUỘC */}
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>
            Phần B — Tình trạng mệt mỏi (bắt buộc) <span style={{ color: '#dc2626' }}>*</span>
          </h2>

          <label style={T.lbl}>Thời điểm xuất hiện mệt mỏi <span style={{ color: '#dc2626' }}>*</span></label>
          <input type="text" placeholder="Ghi cụ thể thời gian và số giờ đã thức tính đến thời điểm đó"
                 value={fatigueOnset} onChange={e => setFatigueOnset(e.target.value)}
                 style={{ ...T.inp, width: '100%', marginBottom: 16 }} />

          <label style={T.lbl}>Mức độ mệt mỏi (thang KSS) <span style={{ color: '#dc2626' }}>*</span></label>
          <KssScale value={kssScore} onChange={setKssScore} />

          {/* Lịch sử giấc ngủ */}
          <label style={T.lbl}>Lịch sử giấc ngủ</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <input type="number" step="0.5" placeholder="Số giờ ngủ 72h qua"
                     value={sleepHours72} onChange={e => setSleepHours72(e.target.value)} style={T.inp} />
            </div>
            <div>
              <input type="number" step="0.5" placeholder="Số giờ ngủ 24h qua"
                     value={sleepHours24} onChange={e => setSleepHours24(e.target.value)} style={T.inp} />
            </div>
          </div>
          <select value={sleepQuality} onChange={e => setSleepQuality(e.target.value)}
                  style={{ ...T.inp, marginTop: 8 }}>
            <option value="">Chất lượng giấc ngủ gần nhất...</option>
            <option value="good">Tốt</option>
            <option value="fair">Trung bình</option>
            <option value="poor">Kém</option>
            <option value="very_poor">Rất kém</option>
          </select>

          {/* Mô tả ảnh hưởng */}
          <label style={T.lbl}>Mô tả ngắn gọn sự mệt mỏi ảnh hưởng đến hiệu suất làm việc <span style={{ color: '#dc2626' }}>*</span></label>
          <textarea rows={3} value={impactDescription} onChange={e => setImpactDescription(e.target.value)}
                    style={{ ...T.inp, width: '100%' }} />

          {/* Yếu tố góp phần */}
          <label style={T.lbl}>Các yếu tố góp phần</label>
          <FactorCheckboxGroup title="Lịch làm việc"
            options={['Nhiều kíp đêm liên tiếp', 'Chuyển đổi ca nhanh', 'Thời gian nghỉ không đủ', 'Làm thêm giờ/thay đổi đột xuất']}
            selected={factorsSchedule} onChange={setFactorsSchedule} />
          <FactorCheckboxGroup title="Khai thác"
            options={['Khối lượng công việc cao', 'Khối lượng công việc quá thấp/đơn điệu', 'Không đủ nghỉ giải lao']}
            selected={factorsOperation} onChange={setFactorsOperation} />
          <FactorCheckboxGroup title="Cá nhân/Môi trường"
            options={['Chất lượng giấc ngủ kém (lý do cá nhân/sức khỏe)', 'Môi trường làm việc']}
            selected={factorsPersonal} onChange={setFactorsPersonal} />

          <label style={T.lbl}>Khác</label>
          <input type="text" value={factorsOther} onChange={e => setFactorsOther(e.target.value)}
                 style={{ ...T.inp, width: '100%' }} />

          <label style={T.lbl}>Hành động khắc phục tức thời</label>
          <textarea rows={2} placeholder="VD: Đã nghỉ 30 phút; Đổi vị trí; Được thay thế khỏi kíp trực"
                    value={immediateAction} onChange={e => setImmediateAction(e.target.value)}
                    style={{ ...T.inp, width: '100%' }} />

          {/* PHẦN C — CAM KẾT */}
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>Phần C — Cam kết</h2>

          <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>1. Cam kết của KSVKL:</p>
            <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>
              "Tôi cam kết tình trạng mệt mỏi này là thực tế và tôi đã tuân thủ đúng quy định về
              thời gian nghỉ ngơi, không làm việc riêng trước ca trực. Tôi chịu trách nhiệm trước
              Tổng công ty về tính trung thực của báo cáo này."
            </p>
          </div>

          <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>2. Cam kết của Tổng công ty:</p>
            <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>
              "Báo cáo này được sử dụng chỉ cho mục đích an toàn, tuân thủ nguyên tắc bảo mật,
              không trừng phạt và văn hóa an toàn công bằng theo FRMS của Tổng công ty."
            </p>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                   style={{ marginTop: 4 }} />
            <span style={{ fontSize: 13 }}>Tôi xác nhận đã đọc và đồng ý với cam kết tại Phần C.</span>
          </label>

          <button onClick={submit} disabled={submitting || !agreed}
                  style={{ ...T.btn, opacity: (submitting || !agreed) ? 0.5 : 1 }}>
            {submitting ? 'Đang gửi…' : '📨 Gửi báo cáo'}
          </button>
        </>
      )}
    </div>
  );
}

function FactorCheckboxGroup({ title, options, selected, onChange }) {
  const toggle = (opt) => {
    const next = new Set(selected);
    next.has(opt) ? next.delete(opt) : next.add(opt);
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{title}</div>
      {options.map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
          <span style={{ fontSize: 13 }}>{opt}</span>
        </label>
      ))}
    </div>
  );
}
```

**Xác minh:** mở tab "Báo cáo mệt mỏi", điền form đầy đủ, gửi → hiện box xác nhận với `anonCode`; mở DB, có 1 dòng mới trong `fatigue_reports`.

---

## Mục D5 — Workflow tự động: notification + escalation 24h

**File:** `backend/src/fatigue-reports/fatigue-reports.service.ts`

Thêm cron job kiểm tra báo cáo chưa được acknowledge sau 24h → tự động đánh dấu `safetyNotified` và gửi notification cho Ban An toàn:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Cron(CronExpression.EVERY_HOUR)
async checkEscalation() {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const pending = await this.repo.find({
    where: {
      status: 'submitted',
      safetyNotified: false,
      createdAt: LessThan(cutoff),
    },
  });
  for (const r of pending) {
    await this.notifySafetyDept(r.id);
    // TODO: Gửi notification thật cho người có role SAFETY_OFFICER
  }
}
```

Cài `@nestjs/schedule` nếu chưa có: `npm install @nestjs/schedule`. Đăng ký `ScheduleModule.forRoot()` trong `app.module.ts`.

**Xác minh:** Tạo báo cáo, chỉnh `createdAt` lùi 25h trong DB, đợi cron chạy → `safetyNotified=true`.

---

# PHASE E — Đổi ca / Trực thay (Phụ lục I QĐ 2701)

## Mục E1 — DB migration cho `shift_exchanges`

**File:** `backend/migration.sql` — append:

```sql
-- Đổi ca / Trực thay — QĐ 2701 Phụ lục I + Điều 8
-- Lưu trữ ≥ 1 năm (Điều 8.5).

CREATE TABLE IF NOT EXISTS shift_exchanges (
  id              VARCHAR PRIMARY KEY,
  type            VARCHAR NOT NULL,
                  -- 'EXCHANGE' (đổi ca: hoàn trả) hoặc 'COVER' (trực thay: không hoàn trả)
  facility_type   VARCHAR NOT NULL,
                  -- 'ACC_APP_TWR' (cần 2 kíp trưởng phê duyệt) hoặc 'TWR_ONLY' (Trưởng cơ sở phê duyệt)
  applicant_role  VARCHAR NOT NULL,
                  -- 'KSVKL', 'KIP_TRUONG', 'KIP_PHO'

  -- Người đề nghị
  applicant_id    VARCHAR NOT NULL,
  applicant_name  VARCHAR NOT NULL,
  applicant_team  VARCHAR,
  applicant_shift_date   DATE    NOT NULL,
  applicant_shift_code   VARCHAR NOT NULL,  -- S/D/...

  -- Người nhận đổi / được trực thay
  counterparty_id    VARCHAR NOT NULL,
  counterparty_name  VARCHAR NOT NULL,
  counterparty_team  VARCHAR,
  counterparty_shift_date DATE,
  counterparty_shift_code VARCHAR,
                  -- Với COVER: 2 trường này có thể NULL (không hoàn trả)

  -- Phê duyệt
  status          VARCHAR NOT NULL DEFAULT 'pending',
                  -- 'pending', 'counterparty_agreed', 'chief_approved', 'rejected', 'cancelled'
  counterparty_agreed_at TIMESTAMPTZ,
  chief_approver_id      VARCHAR,
  chief_approver_role    VARCHAR,  -- 'KIP_TRUONG_APPLICANT', 'KIP_TRUONG_COUNTERPARTY', 'CHIEF'
  chief_approved_at      TIMESTAMPTZ,
  chief_approver_2_id    VARCHAR,  -- Trường hợp ACC/APP/TWR cần 2 kíp trưởng
  chief_approved_2_at    TIMESTAMPTZ,
  rejection_reason       TEXT,

  -- Pre-check rà soát giờ làm
  precheck_result        JSONB,
                  -- { violations: [...], can_approve: bool }
                  -- Kết quả analytics tại thời điểm submit. Nếu can_approve=false,
                  -- vẫn cho phép submit nhưng phê duyệt cần ghi chú lý do.

  extra_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_exchanges_applicant ON shift_exchanges(applicant_id);
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_status    ON shift_exchanges(status);
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_date      ON shift_exchanges(applicant_shift_date);
```

---

## Mục E2 — Backend module `shift_exchanges`

Pattern y như `fatigue_reports/`. Cấu trúc files:
- `shift-exchange.entity.ts`
- `shift-exchanges.service.ts` (với các method: `create`, `counterpartyAgree`, `chiefApprove`, `reject`, `cancel`, `findPending`, `precheck`)
- `shift-exchanges.controller.ts`
- `shift-exchanges.module.ts`

Đặc biệt method `precheck` gọi sang analytics:
```typescript
async precheck(dto: CreateShiftExchangeDto): Promise<any> {
  // Gọi analytics để tính giả lập: nếu đổi ca này thì có vi phạm gì?
  return this.analyticsClient.precheckExchange({
    applicant_id: dto.applicantId,
    counterparty_id: dto.counterpartyId,
    applicant_shift: { date: dto.applicantShiftDate, code: dto.applicantShiftCode },
    counterparty_shift: dto.counterpartyShiftDate
      ? { date: dto.counterpartyShiftDate, code: dto.counterpartyShiftCode }
      : null,
  });
}
```

Endpoint analytics tương ứng `POST /analytics/exchange/precheck` — nhận thông tin đổi ca, tải lịch hiện tại của 2 người trong vòng 30 ngày, mô phỏng việc đổi, chạy `ComplianceChecker` lên 2 người sau khi đổi, trả về danh sách vi phạm tiềm năng. **Chi tiết spec endpoint analytics đặt vào Phase E3.**

Đăng ký `ShiftExchangesModule` trong `app.module.ts`.

**Xác minh:** create + approve workflow end-to-end qua curl.

---

## Mục E3 — Analytics endpoint precheck

**File mới:** `analytics/app/routers/exchange.py`

```python
"""Pre-check đổi ca: mô phỏng việc đổi ca, kiểm tra vi phạm tiềm năng."""
from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.compliance.rest_compliance import (
    ComplianceChecker, RestRuleConfig, Shift, classify_shift_kind, ShiftKind,
)

router = APIRouter(prefix="/analytics/exchange", tags=["exchange"])


class ShiftRef(BaseModel):
    date: str
    code: str  # S, D, ...


class PrecheckExchangeInput(BaseModel):
    applicant_id: str
    applicant_name: str
    counterparty_id: str
    counterparty_name: str
    applicant_shift: ShiftRef
    counterparty_shift: ShiftRef | None
    # Lịch hiện tại của 2 người trong 30 ngày — gửi từ backend
    applicant_current_shifts: list[dict]
    counterparty_current_shifts: list[dict]


@router.post("/precheck")
def precheck_exchange(inp: PrecheckExchangeInput):
    """Mô phỏng đổi ca, kiểm tra vi phạm tiềm năng. QĐ 2288 + QĐ 2701 Điều 8."""
    cfg = RestRuleConfig()
    # ... (Implement: gỡ shift của applicant, thêm shift mới, gọi ComplianceChecker)
    # Tạm trả về structure mẫu
    return {
        "violations_applicant": [],
        "violations_counterparty": [],
        "can_approve": True,
        "warnings": [],
    }
```

Đăng ký router trong `analytics/app/main.py`.

**Xác minh:** curl với input mẫu, response có cấu trúc chuẩn.

---

## Mục E4 — Frontend: `ShiftExchangeTab` với 3 biểu mẫu

**File:** `src/screens/AnalyticsScreen.jsx`

Thay placeholder `ShiftExchangeTab`. Pattern:

```jsx
function ShiftExchangeTab({ currentUser }) {
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [exchanges, setExchanges] = useState([]);
  // ... load exchanges

  return (
    <div style={{ padding: 20 }}>
      <HowTo steps={[
        'Tab này dành cho yêu cầu Đổi ca / Trực thay theo QĐ 2701 Phụ lục I.',
        'Đổi ca: 2 KSVKL hoán đổi ca trực — có hoàn trả.',
        'Trực thay: 1 KSVKL trực thay cho người khác — không hoàn trả.',
        'Hệ thống tự động kiểm tra điều kiện năng định và giờ làm/nghỉ trước khi cho phép gửi.',
      ]} />

      {view === 'list' && <ExchangeList exchanges={exchanges} onNew={() => setView('create')} />}
      {view === 'create' && <ExchangeForm currentUser={currentUser} onDone={() => setView('list')} onCancel={() => setView('list')} />}
    </div>
  );
}

function ExchangeForm({ currentUser, onDone, onCancel }) {
  // Xác định biểu mẫu nào dựa trên role + facility:
  // - Vị trí kíp trưởng → Biểu mẫu 1 (Phụ lục I QĐ 2701)
  // - KSVKL tại ACC/APP/TWR → Biểu mẫu 2
  // - KSVKL tại TWR → Biểu mẫu 3
  const facilityType = currentUser?.facilityType || 'ACC_APP_TWR';
  const role = currentUser?.role || 'KSVKL';
  const isChief = role === 'KIP_TRUONG' || role === 'KIP_PHO';
  const formType =
    isChief                            ? 'CHIEF'
    : facilityType === 'TWR_ONLY'      ? 'TWR'
    :                                    'ACC_APP_TWR';

  // Render 1 trong 3 form
  return (
    <div>
      <h2>Giấy đề nghị đổi ca / Trực thay</h2>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        Biểu mẫu áp dụng: {
          formType === 'CHIEF'       ? 'Vị trí trực Kíp trưởng'
        : formType === 'ACC_APP_TWR' ? 'KSVKL tại ACC/APP/TWR'
        :                              'KSVKL tại TWR'
        } (QĐ 2701 Phụ lục I)
      </div>

      {/* Form trường */}
      {/* Loại: Đổi ca / Trực thay */}
      {/* Người đề nghị (auto-fill từ currentUser) */}
      {/* Ca trực hiện tại (chọn từ lịch của mình) */}
      {/* Người nhận (chọn từ danh sách KSVKL — lọc theo năng định tương đương) */}
      {/* Thời gian hoàn trả (nếu Đổi ca) */}

      {/* Pre-check button */}
      <button onClick={runPrecheck}>Kiểm tra điều kiện</button>
      {precheckResult && <PrecheckPanel result={precheckResult} />}

      {/* Cam kết */}
      <label>
        <input type="checkbox" checked={committed} onChange={e => setCommitted(e.target.checked)} />
        Cam kết việc đổi ca/trực thay đã đảm bảo đúng quy định về thời giờ làm việc, nghỉ ngơi.
      </label>

      {/* Submit */}
      <button onClick={submit} disabled={!committed}>Gửi</button>
    </div>
  );
}
```

**Câu hỏi mở:** `currentUser.facilityType` đã có trong DB chưa? Nếu chưa, Claude phải DỪNG và hỏi user về cách phân loại cơ sở (Đà Nẵng là `ACC_APP_TWR` hay `TWR_ONLY`?).

**Xác minh:** Tạo đổi ca, người nhận đăng nhập thấy yêu cầu, đồng ý → kíp trưởng đăng nhập thấy yêu cầu, phê duyệt → trạng thái cuối `chief_approved`.

---

# PHASE F — Bình giảng sau ca (Phụ lục II QĐ 2701)

## Mục F1 — DB migration cho `shift_briefings`

**File:** `backend/migration.sql`:

```sql
-- Bình giảng sau ca — QĐ 2701 Phụ lục II + Điều 14
-- Lưu trữ ≥ 1 năm (Điều 14.3.đ).

CREATE TABLE IF NOT EXISTS shift_briefings (
  id              VARCHAR PRIMARY KEY,
  team            VARCHAR NOT NULL,         -- Kíp A/B/C/D
  shift_date      DATE    NOT NULL,
  shift_code      VARCHAR NOT NULL,         -- S/D/...
  level           VARCHAR NOT NULL DEFAULT 'light',
                  -- 'light' (ghi chép nội bộ), 'formal' (báo cáo chính thức gửi đi)
  chair_id        VARCHAR NOT NULL,         -- người chủ trì
  chair_name      VARCHAR NOT NULL,
  chair_role      VARCHAR,                  -- 'KIP_TRUONG', 'KIP_TRUONG_KIP_TRUC'
  participants    JSONB NOT NULL DEFAULT '[]',
                  -- [{ id, name, status: 'present' | 'absent' | 'reason' }]
  facility_rep_id   VARCHAR,                -- Đại diện cán bộ cơ sở
  facility_rep_name VARCHAR,

  briefing_content TEXT NOT NULL,           -- Nội dung bình giảng
  participant_comments JSONB DEFAULT '[]',  -- Ý kiến từng thành phần
  recommendations  TEXT,                    -- Ý kiến đề xuất, kiến nghị

  -- Chỉ có cho 'formal'
  formal_recipients JSONB DEFAULT '[]',
                  -- [{ to: 'director' | 'air_traffic_dept' | 'safety_dept', sent_at, ack_at? }]
  has_safety_event BOOLEAN NOT NULL DEFAULT FALSE,
  safety_event_summary TEXT,

  extra_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefings_team_date ON shift_briefings(team, shift_date);
CREATE INDEX IF NOT EXISTS idx_briefings_level     ON shift_briefings(level);
```

---

## Mục F2 — Backend module + auto-trigger

Pattern y như các module trước. Đặc biệt: khi shift bàn giao xong (event từ `DetailedRosterModal` qua API mới), tự động tạo `shift_briefings` ở `level='light'` với `briefing_content=''`, kíp trưởng vào ghi nội dung. Khi nâng `level='formal'`, kích hoạt việc gửi cho 3 nơi nhận qua notification.

**Câu hỏi mở:** Hiện tại đã có cơ chế "bàn giao ca xong" trong code chưa? Nếu chưa, Claude phải DỪNG và hỏi user về cách kích hoạt tự động — hay tạm thời để kíp trưởng tự tạo briefing thủ công?

---

## Mục F3 — Frontend `ShiftBriefingTab`

Tab có 2 view chính:
1. **Danh sách bình giảng gần đây** (mặc định 30 ngày).
2. **Tạo/Xem/Sửa briefing** (form theo Phụ lục II).

Form gồm:
- Thành phần tham gia: dropdown người chủ trì + checkbox toàn bộ kíp giao ca + đại diện cán bộ cơ sở.
- Nội dung bình giảng: textarea lớn.
- Ý kiến đề xuất, kiến nghị: textarea.
- 2 nút action: "Lưu ghi chép" (level=light) hoặc "Tạo Báo cáo chính thức" (level=formal, có thêm field `has_safety_event` + `safety_event_summary`).

Khi `level=formal`, hiển thị 3 checkbox người nhận:
- Giám đốc Công ty (mặc định)
- Phòng Không lưu (mặc định)
- Phòng An toàn - Chất lượng và An ninh (mặc định)

Có nút "In/Xuất PDF" — render theo nguyên văn Phụ lục II.

---

# PHASE H — Smoke test đầu cuối

## Mục H1 — Quy trình test thủ công

Sau khi tất cả các phase A-G hoàn thành, chạy test thủ công:

1. **Admin đăng nhập** → menu Báo cáo → thấy 2 nhóm tab.
2. **Tab Tuân thủ** → kiểm tra tháng → vi phạm có legal_basis tag.
3. **Tab Công bằng** → kiểm tra cột "Giờ đêm" hiển thị.
4. **Tab Năng định** → dropdown 30/60/90 ngày → coverage chỉ 7 vị trí chính + note phụ trợ.
5. **Tab Tối ưu hóa** → solver chạy với các ràng buộc mới → kết quả không có ca đêm ngày 4 liên tiếp.
6. **Tab Dashboard SPI** → các card hiển thị, vài card = 0 hoặc — (vì các tab D-E-F chưa có dữ liệu).
7. **Tab Đánh giá lịch trực** → chọn tháng → sinh checklist → in PDF.
8. **Tab Báo cáo mệt mỏi** → điền form đầy đủ → submit → nhận anonCode.
9. **Tab Đổi ca** → tạo yêu cầu → người nhận đồng ý → kíp trưởng phê duyệt.
10. **Tab Bình giảng** → tạo ghi chép nhẹ → nâng thành Báo cáo chính thức → thấy thông báo gửi 3 nơi.
11. **Quay lại Dashboard SPI** → các chỉ số đã cập nhật (báo cáo mệt mỏi: 1, đổi ca: 1, bình giảng: 1).

**Xác minh:** không có lỗi 500; không có response trống bất thường; ghi rõ kết quả từng bước vào `CHANGELOG_TAB_BAO_CAO.md`.

---

# Câu hỏi mở — Claude PHẢI dừng và hỏi user

1. **Mục B4.1:** Cấu trúc CP-SAT solver hiện tại — có dùng `BoolVar` hay biến khác? Có thể infeasible với input nhỏ — xử lý thế nào?
2. **Mục C4:** Endpoint `/api/schedules/:monthKey` đã tồn tại chưa? Trả về cấu trúc gì?
3. **Mục D5:** Hệ thống đã có `@nestjs/schedule` chưa? Có cron job khác chạy không?
4. **Mục E4:** `currentUser.facilityType` có trong DB không? Đà Nẵng phân loại thế nào?
5. **Mục F2:** Đã có event "bàn giao ca xong" trong code chưa? Nếu chưa, tạm để kíp trưởng tự tạo briefing thủ công.
6. **Mục G1:** Hàm `_check_compliance_for_month` đã có trong `routers/compliance.py` chưa, hay phải refactor `check` endpoint thành internal function?

---

# Lưu ý cuối

- **KHÔNG sửa file ngoài phạm vi từng mục.**
- **Trước khi tạo entity mới, kiểm tra DB migration** — chạy `psql ... -c "\d <table>"` xác nhận bảng đã tồn tại.
- **Trước khi sửa component lớn (AnalyticsScreen.jsx)**, luôn `view` toàn file.
- **Khi thấy data trả về sai format**, DỪNG và xem thực tế thay vì giả định.
- **Mỗi mục xong → chạy Xác minh THẬT → ghi `[DONE]` vào `CHANGELOG_TAB_BAO_CAO.md`.**
- **Kế hoạch này bổ trợ PLAN_INTEGRATION_V2.md.** Nếu xung đột nội dung, ưu tiên PLAN này (vì cụ thể hơn).
