# PLAN_MERGE_TASKS_ANALYTICS_FIX_STATS

> **Phạm vi:** 2 thay đổi độc lập, làm tuần tự.
>
> **Cách dùng trong Claude VSCode:**
> *"Đọc PLAN_MERGE_TASKS_ANALYTICS_FIX_STATS.md. Làm từng phần theo thứ tự.
> Không sửa file nào ngoài danh sách trong mỗi phần."*

---

## Phần 1 — Hợp nhất Tab "Nhiệm vụ" + Tab "Báo cáo" thành một tab duy nhất

### Lý do hợp nhất

Audit hai tab hiện tại cho thấy sự trùng lặp workflow:

| Điểm so sánh | `TasksScreen` (tab Nhiệm vụ) | `AnalyticsScreen` (tab Báo cáo) |
|---|---|---|
| Chức năng chính | Đăng nhiệm vụ, bình giảng, báo cáo sự cố, nộp báo cáo cuối ca | Phân tích tuân thủ, biểu mẫu pháp lý (đổi ca, bình giảng, mệt mỏi, giao nhận ca) |
| Phần trùng lặp | `SmsReportModal` — nộp báo cáo cuối ca, sinh text report | `FatigueReportTab` — gửi báo cáo mệt mỏi; `BriefingTab` — bình giảng sau ca |
| Cấu trúc UI | Danh sách bài đăng + filter type + modal tạo mới | Sidebar 2 nhóm tab + panel nội dung phức tạp |
| User journey | STAFF: xem nhiệm vụ được giao → nộp báo cáo cuối ca | CHIEF/ADMIN: tra cứu biểu mẫu, phân tích lịch trực |
| Vấn đề | Người dùng phải đi 2 tab để làm các việc liên quan đến ca trực | Không liên kết với dữ liệu nhiệm vụ/báo cáo đã có trong `TasksScreen` |

**Quyết định hợp nhất:** Giữ nguyên `AnalyticsScreen` làm vỏ, thêm nhóm tab thứ 3 "Nhiệm vụ & Báo cáo Ca" chứa toàn bộ logic từ `TasksScreen`. Xoá tab "Nhiệm vụ" khỏi nav.

---

### Sơ đồ cấu trúc sau hợp nhất

```
Tab "Báo cáo & Phân tích" (AnalyticsScreen)
│
├── Nhóm 1: Phân tích & Giám sát  (giữ nguyên)
│   ├── Tuân thủ
│   ├── Công bằng
│   ├── Năng định
│   ├── Tối ưu hóa
│   └── Dashboard SPI
│
├── Nhóm 2: Biểu mẫu & Quy trình  (giữ nguyên)
│   ├── Đánh giá lịch trực
│   ├── Báo cáo mệt mỏi
│   ├── Đổi ca / Trực thay
│   ├── Bình giảng sau ca
│   └── Giao nhận ca (WEST)
│
└── Nhóm 3: Nhiệm vụ & Báo Cáo Ca  ← THÊM MỚI
    ├── Danh sách bài đăng (toàn bộ TasksScreen UI)
    ├── Nút "Tạo bài đăng mới" → TaskFormModal
    └── Nút "Nộp Báo Cáo Cuối Ca" → SmsReportModal
```

---

### Bước 1.A — Thêm nhóm tab mới vào `TAB_GROUPS` trong `AnalyticsScreen.jsx`

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm hằng số `TAB_GROUPS` (dòng ~9). Thêm nhóm thứ 3 vào cuối mảng:

```javascript
const TAB_GROUPS = [
  {
    id: 'analysis', label: 'Phân tích & Giám sát',
    desc: 'Theo dõi tuân thủ, công bằng, năng định, tối ưu hóa và chỉ số an toàn FMP.',
    tabs: [
      // ... giữ nguyên 5 tab hiện tại ...
    ],
  },
  {
    id: 'forms', label: 'Biểu mẫu & Quy trình',
    desc: 'Các biểu mẫu pháp lý theo Phụ lục QĐ 2288 và QĐ 2701.',
    tabs: [
      // ... giữ nguyên 5 tab hiện tại ...
    ],
  },
  // ── THÊM MỚI ──────────────────────────────────────────────────────────
  {
    id: 'operations', label: 'Nhiệm vụ & Báo Cáo Ca',
    desc: 'Quản lý nhiệm vụ, bình giảng, sự cố và báo cáo cuối ca trực.',
    tabs: [
      {
        id: 'tasks_feed',
        label: 'Bảng tin',
        icon: 'layers',
        desc: 'Tất cả nhiệm vụ, bình giảng và báo cáo được phân công cho bạn.'
      },
    ],
  },
];
```

---

### Bước 1.B — Thêm import vào `AnalyticsScreen.jsx`

**File:** `src/screens/AnalyticsScreen.jsx`

Thêm vào đầu file, sau các import hiện có:

```javascript
import { useContext }      from 'react';
import { AppContext }      from '../context/AppContext';
import TaskFormModal       from '../components/TaskFormModal';
import { DataService }     from '../services/DataService';
```

> **Lưu ý:** `useState` và `useEffect` đã có trong import `React` hiện tại của file — không cần thêm.

---

### Bước 1.C — Di chuyển toàn bộ logic Tasks vào `AnalyticsScreen.jsx`

**File:** `src/screens/AnalyticsScreen.jsx`

**1. Copy toàn bộ component `SmsReportModal`** từ `TasksScreen.jsx` — paste nguyên vẹn vào `AnalyticsScreen.jsx`, đặt trước function `AnalyticsScreen`.

**2. Copy hàm `formatDate`** từ `TasksScreen.jsx` — paste vào `AnalyticsScreen.jsx` ở phần constants, trước các function tab.

**3. Copy object `smsStyles`** từ `TasksScreen.jsx` — merge vào cuối object `T` (styles của AnalyticsScreen) hoặc đặt thành biến riêng `const smsStyles = { ... }`.

**4. Tạo component `TasksFeedTab`** — paste vào `AnalyticsScreen.jsx`, đặt sau `SmsReportModal`. Đây là phần cốt lõi — toàn bộ UI danh sách + modal chi tiết của `TasksScreen`:

```javascript
function TasksFeedTab({ currentUser, employees, settings, addNotification }) {
  // Copy toàn bộ state và handler từ TasksScreen:
  // - tasks, isLoadingData, toast, isProcessing
  // - isFormOpen, isSmsModalOpen, viewingTask, newConclusion, newComment, confirmDialog
  // - filter, viewingTaskRef
  // - fetchTasksData + useEffect polling 5 giây
  // - persistTaskUpdate, persistNewTask, persistDeleteTask
  // - handleSaveNewTask, handleSaveConclusion, toggleChatLock, handleSendComment
  // - handleAcknowledge, handleAcknowledgeAll, confirmDeleteTask, openTask, closeTask
  // - showToast, getTypeConfig

  // Copy toàn bộ JSX return từ TasksScreen (phần sau <div style={styles.container}>):
  // - FloatingToast
  // - Modal confirmDialog
  // - TaskFormModal
  // - SmsReportModal
  // - Modal viewingTask (chi tiết)
  // - HeaderCard với 2 nút (Nộp Báo Cáo + Tạo Bài Đăng)
  // - FilterWrapper
  // - Danh sách filteredTasks
}
```

> **Styles:** Copy object `styles` và `detailStyles` từ `TasksScreen.jsx` — đổi tên thành `taskStyles` và `taskDetailStyles` để tránh đụng với `T` (styles của AnalyticsScreen).
> Thay mọi `styles.xxx` trong `TasksFeedTab` bằng `taskStyles.xxx`, thay `detailStyles.xxx` bằng `taskDetailStyles.xxx`.

---

### Bước 1.D — Thêm `TasksFeedTab` vào `renderTab` của `AnalyticsScreen`

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm hàm/switch `renderTab` (hoặc nơi render nội dung tab theo `activeTab`). Thêm case mới:

```javascript
case 'tasks_feed':
  return (
    <TasksFeedTab
      currentUser={currentUser}
      employees={employees}
      settings={settings}
      addNotification={addNotification}
    />
  );
```

---

### Bước 1.E — Truyền thêm props vào `AnalyticsScreen`

**File:** `src/screens/AnalyticsScreen.jsx`

Sửa signature của component `AnalyticsScreen`:

```javascript
// Trước:
export default function AnalyticsScreen({ employees, currentUser }) {

// Sau:
export default function AnalyticsScreen({ employees, currentUser, settings, addNotification, activities }) {
```

---

### Bước 1.F — Cập nhật `App.jsx` — truyền props mới vào `AnalyticsScreen`

**File:** `App.jsx`

Tìm dòng render `AnalyticsScreen`:

```javascript
// Trước:
case 'ANALYTICS': return <AnalyticsScreen employees={employees} currentUser={currentUser} />;

// Sau:
case 'ANALYTICS': return <AnalyticsScreen {...p} />;
```

> `{...p}` đã chứa `employees`, `currentUser`, `settings`, `addNotification`, `activities` — tất cả props cần thiết.

---

### Bước 1.G — Xoá tab "Nhiệm vụ" khỏi navigation trong `App.jsx`

**File:** `App.jsx`

Tìm mảng định nghĩa nav items (dòng ~240). Xoá dòng:

```javascript
// XOÁ dòng này:
{ id: 'TASKS', icon: 'clipboard', label: 'Nhiệm vụ', section: 'MAIN' },
```

Đổi label tab "Báo cáo" thành rõ ràng hơn để user biết có nhiệm vụ ở đây:

```javascript
// Trước:
{ id: 'ANALYTICS', icon: 'activity', label: 'Báo cáo', section: 'MANAGE' },

// Sau:
{ id: 'ANALYTICS', icon: 'activity', label: 'Báo cáo & Nhiệm vụ', section: 'MANAGE' },
```

---

### Bước 1.H — Giữ `TasksScreen.jsx` nhưng đánh dấu deprecated

**File:** `src/screens/TasksScreen.jsx`

Thêm comment ở dòng đầu tiên:

```javascript
/**
 * @deprecated Toàn bộ logic đã được di chuyển vào AnalyticsScreen.jsx (tab tasks_feed).
 * File này giữ lại để tham chiếu. Không xoá cho đến khi TasksFeedTab đã test ổn định.
 */
```

> Xoá `import TasksScreen` và case `'TASKS'` trong `App.jsx` sau khi test xong.

---

### Checklist Phần 1

- [ ] 1.A — Thêm nhóm `operations` + tab `tasks_feed` vào `TAB_GROUPS`
- [ ] 1.B — Thêm import `AppContext`, `TaskFormModal`, `DataService` vào `AnalyticsScreen`
- [ ] 1.C — Copy `SmsReportModal`, `formatDate`, `smsStyles`, tạo `TasksFeedTab` trong `AnalyticsScreen`
- [ ] 1.D — Thêm `case 'tasks_feed'` vào `renderTab`
- [ ] 1.E — Mở rộng props của `AnalyticsScreen`
- [ ] 1.F — `App.jsx` — đổi `<AnalyticsScreen employees={...} currentUser={...} />` thành `<AnalyticsScreen {...p} />`
- [ ] 1.G — Xoá nav item `TASKS`, đổi label `ANALYTICS` thành `'Báo cáo & Nhiệm vụ'`
- [ ] 1.H — Thêm comment `@deprecated` vào `TasksScreen.jsx`
- [ ] **Verify:** Mở tab "Báo cáo & Nhiệm vụ" → chọn nhóm "Nhiệm vụ & Báo Cáo Ca" → bảng tin hiển thị, tạo bài đăng được, nộp báo cáo cuối ca được

---

## Phần 2 — Fix giao diện tab Thống kê (`StatsScreen`)

### Danh sách lỗi tìm thấy

Audit `src/screens/StatsScreen.jsx` phát hiện 5 lỗi giao diện:

| # | Vị trí | Lỗi | Triệu chứng |
|---|---|---|---|
| L1 | `styles.headerArea` | Nằm **ngoài** `scrollArea` nhưng không có `position: sticky` → khi scroll nội dung, header biến mất | Header cuộn cùng trang thay vì cố định |
| L2 | `styles.tableScroll` | Thiếu `overflowX: 'auto'` và `display: 'block'` → bảng 900px bị tràn ra ngoài viewport, không có thanh cuộn ngang | Bảng bị cắt, không xem được hết cột |
| L3 | `styles.tableHead` và `styles.tableRow` | Dùng `flexDirection: 'row'` nhưng thiếu `display: 'flex'` → các `<span>` và `<div>` con xếp dọc thay vì ngang | Các cột bị xếp thành hàng dọc thay vì ngang |
| L4 | `styles.summaryRow` | Dùng `flexDirection: 'row'` nhưng thiếu `display: 'flex'` → 4 summary card xếp dọc thay vì 1 hàng ngang | 4 card xếp chồng lên nhau |
| L5 | `styles.scrollArea` | Thiếu `paddingTop: 16` → nội dung sát header không có khoảng cách | Bảng lọc chạm ngay header |

---

### Bước 2.A — Fix `styles` trong `StatsScreen.jsx`

**File:** `src/screens/StatsScreen.jsx`

Tìm object `const styles = { ... }` ở cuối file. Sửa các key sau:

```javascript
const styles = {
  // L1: thêm sticky cho headerArea, tách khỏi scrollArea
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',        // ← thêm: ngăn container bị scroll
  },

  headerArea: {
    display: 'flex',           // ← thêm
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottom: '1px solid #e2e8f0',  // ← đổi từ borderBottomWidth/borderColor
    flexWrap: 'wrap',
    gap: 12,
    flexShrink: 0,             // ← thêm: không bị co lại khi scroll
    // Bỏ marginBottom: 16 — scrollArea sẽ tự có paddingTop
  },

  headerTitleBox: {
    display: 'flex',           // ← thêm
    flexDirection: 'row',
    alignItems: 'center',
  },

  // L5: thêm paddingTop cho scrollArea
  scrollArea: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,            // ← thêm
    paddingBottom: 24,         // ← thêm: khoảng thở dưới cùng
    overflowY: 'auto',
    display: 'block',
  },

  // L4: fix summaryRow
  summaryRow: {
    display: 'flex',           // ← thêm
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },

  summaryCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',   // ← đổi từ borderWidth/borderColor
    padding: 16,
    display: 'flex',               // ← thêm
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
  },

  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'flex',               // ← thêm
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // L2: fix tableScroll — thanh cuộn ngang
  tableScroll: {
    backgroundColor: '#f8fafc',
    overflowX: 'auto',             // ← thêm: cho phép cuộn ngang
    display: 'block',              // ← thêm
    WebkitOverflowScrolling: 'touch', // ← thêm: cuộn mượt trên mobile
  },

  // L3: fix tableHead và tableRow — thêm display flex
  tableHead: {
    display: 'flex',               // ← thêm
    flexDirection: 'row',
    paddingTop: 14,
    paddingBottom: 14,
    borderBottom: '1px solid #e2e8f0',  // ← đổi
    backgroundColor: '#f1f5f9',
    minWidth: 900,                 // ← thêm: đảm bảo header cùng width với rows
  },

  tableRow: {
    display: 'flex',               // ← thêm
    flexDirection: 'row',
    paddingTop: 14,
    paddingBottom: 14,
    borderBottom: '1px solid #f1f5f9',  // ← đổi
    alignItems: 'center',
    minWidth: 900,                 // ← thêm: cùng width với header
  },

  // Các style có borderWidth/borderColor cần đổi sang border shorthand:
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',   // ← đổi từ borderWidth + borderColor
    padding: 20,
    marginBottom: 20,
    boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
  },

  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',   // ← đổi
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
    marginBottom: 24,              // ← thêm: khoảng thở dưới bảng
  },

  // Fix các row style khác dùng borderBottomWidth
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: '#fdfdfd' },

  td: {
    paddingLeft: 8,
    paddingRight: 8,
    display: 'flex',               // ← thêm
    flexDirection: 'column',
    justifyContent: 'center',
  },

  teamBadge: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',   // ← đổi
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    display: 'inline-block',       // ← thêm
  },

  totalBadge: {
    backgroundColor: '#ecfccb',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 8,
    border: '1px solid #bef264',   // ← đổi
    display: 'flex',               // ← thêm
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Giữ nguyên các style còn lại không có lỗi
};
```

---

### Bước 2.B — Fix JSX trong `StatsScreen.jsx` — `filterCard` các flex container

**File:** `src/screens/StatsScreen.jsx`

Tìm các div trong JSX dùng style object inline (không dùng `styles.xxx`) có `flexDirection: 'row'` — thêm `display: 'flex'`:

**Dòng ~165** (quick date buttons container):
```jsx
// Trước:
<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>

// Giữ nguyên — đã có display: 'flex' ✓
```

**Dòng ~185** (customDateRow):
```jsx
// styles.customDateRow — thêm display: 'flex':
customDateRow: {
  display: 'flex',           // ← thêm
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
},
```

**Dòng ~195** (team filter buttons container):
```jsx
// Trước:
<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>

// Giữ nguyên — đã có display: 'flex' ✓
```

---

### Bước 2.C — Bổ sung nút Xuất Excel hoạt động (placeholder → chức năng cơ bản)

**File:** `src/screens/StatsScreen.jsx`

Hiện tại nút "Xuất Excel" không có `onClick`. Thêm export CSV đơn giản (tương tự bulk password ở P1.F):

Thêm hàm `handleExportCSV` trước `return`:

```javascript
const handleExportCSV = () => {
  const headers = ['Họ tên', 'ICAO', 'Đơn vị', 'Ca Sáng', 'Ca Đêm', 'Tăng cường', 'On-call', 'Phép', 'Ốm', 'Công tác', 'Học', 'Tổng ca'];
  const rows = statsData.list.map(e => [
    e.name, e.icaoCode || '', e.team || '',
    e.S, e.D, e.TC, e.OC, e.P, e.O, e.CT, e.H, e.totalShifts
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thong-ke-${startDate}-${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

Thêm `onClick` vào nút:
```jsx
<button type="button" style={styles.btnExport} onClick={handleExportCSV}>
  <Icon name="download" size={16} color="#fff" />
  <span style={styles.btnExportText}>Xuất CSV</span>
</button>
```

> Đổi label "Xuất Excel" → "Xuất CSV" để đúng với chức năng thực tế.

---

### Checklist Phần 2

- [ ] 2.A — Sửa `styles` — thêm `display: 'flex'` vào `summaryRow`, `summaryCard`, `summaryIconWrap`, `tableHead`, `tableRow`, `td`, `totalBadge`
- [ ] 2.A — Sửa `styles` — thêm `overflowX: 'auto'` + `display: 'block'` vào `tableScroll`
- [ ] 2.A — Sửa `styles` — thêm `minWidth: 900` vào `tableHead` và `tableRow`
- [ ] 2.A — Sửa `styles` — thêm `flexShrink: 0` + bỏ `marginBottom` khỏi `headerArea`; thêm `overflow: 'hidden'` + `display: 'flex'` vào `container`
- [ ] 2.A — Sửa `styles` — thêm `paddingTop: 16` + `paddingBottom: 24` vào `scrollArea`
- [ ] 2.A — Đổi toàn bộ `borderWidth: 1, borderColor: '...'` → `border: '1px solid ...'`
- [ ] 2.B — Thêm `display: 'flex'` vào `customDateRow`
- [ ] 2.C — Thêm `handleExportCSV`, gắn vào nút, đổi label → "Xuất CSV"
- [ ] **Verify L1:** Scroll xuống dưới trong StatsScreen → header không cuộn theo
- [ ] **Verify L2:** Bảng có thanh cuộn ngang, kéo sang phải thấy hết cột TỔNG CA
- [ ] **Verify L3:** Các hàng trong bảng xếp ngang đúng như header cột
- [ ] **Verify L4:** 4 summary card (Ca Sáng / Ca Đêm / Tăng cường / Nghỉ Ốm) xếp thành 1 hàng ngang
- [ ] **Verify L5:** Có khoảng trắng giữa header và filterCard
- [ ] **Verify 2.C:** Click "Xuất CSV" → tải về file `.csv` mở được trong Excel

---

## Tổng quan thứ tự thực hiện

```
Phần 2 (fix StatsScreen) ← làm trước: nhanh, ít rủi ro, độc lập hoàn toàn
        ↓
Phần 1 (merge Tasks → Analytics) ← làm sau: phức tạp hơn, cần test kỹ
```

> **Lý do làm Phần 2 trước:** Fix UI bug không ảnh hưởng logic; nếu có lỗi cú pháp
> dễ debug hơn. Phần 1 di chuyển nhiều code hơn, nên cần môi trường sạch để test.
