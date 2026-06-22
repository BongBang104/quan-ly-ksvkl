# CHANGELOG_FIX — Sprint 2026-06-11

## Z1 · CRITICAL — Xóa mật khẩu cứng backdoor `tctsvip`

**Vấn đề:** Account `tctsvip` được tạo với mật khẩu plain-text `<REDACTED>` hard-code trong
`main.ts`, `seed-admin.ts`. Vi phạm quy ước bảo mật dự án và OWASP A07.

**Fix:**
- `backend/src/main.ts` — `ensureHiddenSuperAdmin()` dùng `randomBytes(18).toString('base64url')`
  để sinh mật khẩu ngẫu nhiên **chỉ một lần** khi khởi tạo; in ra console, không bao giờ reset.
- `backend/scripts/seed-admin.ts` — tương tự, không còn `bcrypt.hash('<REDACTED>')`.
- `backend/src/employees/employees.service.ts` — dùng `process.env.HIDDEN_ADMIN_ID` thay literal.
- `src/context/AppContext.jsx` — lọc superadmin bằng `role !== 'superadmin'` (không phụ thuộc ID).
- `src/screens/SettingsScreen.jsx` — kiểm tra `role === 'superadmin'` thay vì so sánh ID.

---

## Z2 · CRITICAL — Xóa mật khẩu khỏi toàn bộ git history

**Fix:** Dùng `git filter-repo --replace-text` viết lại 6 commits (xóa literal `&lt;REDACTED&gt;`).
Force-push lên remote. Lưu ý: remote phải được thêm lại sau mỗi lần filter-repo chạy.

---

## C1 · CRITICAL — Chặn frontend bypass JWT qua Python analytics

**Vấn đề:** `AnalyticsService.js` gọi trực tiếp `http://localhost:8000/analytics/...`
không qua JWT/NestJS. Mọi user (hoặc anonymous) có thể truy cập analytics.

**Fix:**
- Xóa `src/services/AnalyticsService.js`.
- Thêm 5 NestJS proxy endpoints trong `analytics.controller.ts`:
  `POST compliance-check`, `POST fairness-summary`, `GET ratings-expiring`,
  `GET ratings-coverage`, `POST optimize-roster` — đều có `JwtAuthGuard + RolesGuard`.
- `analytics.client.ts` — thêm 5 method tương ứng.
- `src/screens/AnalyticsScreen.jsx` — đổi 5 call site dùng `api` với path `/api/schedules/...`.

---

## C1.5 · MAJOR — Xóa block `/analytics/` khỏi nginx.conf

**Fix:** Loại bỏ hoàn toàn block `location /analytics/` trong `nginx.conf` (Option A).
Python analytics service không còn được expose qua nginx, chỉ có NestJS mới có thể gọi.

---

## C2 · MAJOR — Bổ sung bảng `shifts` và `shift_position_sessions` vào migration

**Fix:** Thêm vào cuối `backend/migration.sql`:
- Bảng `shifts` — ca trực thực tế (sau khi publish).
- Bảng `shift_position_sessions` — các phiên ngồi vị trí trong ca.
- Index trên `monthKey`, `controllerId`, `shiftId`.

---

## C3 · MAJOR — Tab Báo cáo đọc từ `scheduleData` thay vì bảng `shifts`

**Vấn đề:** Tab Compliance/Fairness gọi analytics qua `shifts` table — chỉ có dữ liệu
sau khi Publish lịch. Nếu chưa Publish thì báo cáo trống.

**Fix:**
- Backend: 2 endpoints mới `GET macro-compliance/:monthKey` và `GET macro-fairness/:monthKey`
  đọc `schedules.data.scheduleData` (JSONB), chuyển thành `DayAssignment[]` gửi analytics.
- Python: endpoint `POST /analytics/roster/macro/fairness` mới trong `roster.py`;
  module mới `analytics/app/fairness/fairness_macro.py` tính công bằng từ `MacroRosterDraft`.
- Frontend: `AnalyticsScreen.jsx` ComplianceTab/FairnessTab gọi
  `/api/schedules/macro-compliance/${mk}` và `/api/schedules/macro-fairness/${mk}`.

---

## M1 · MAJOR — FatigueReportTab: 3 view mới

**Fix:** `src/screens/AnalyticsScreen.jsx` — `FatigueReportTab` được mở rộng:
- View `form` (mặc định): biểu mẫu báo cáo mệt mỏi hiện có.
- View `mine`: danh sách lịch sử báo cáo của bản thân (`FatigueMineList`).
- View `forChief`: kíp trưởng xem báo cáo của kíp cần xử lý (`FatigueForChiefList`).
- View `summary`: admin tổng hợp toàn bộ báo cáo (`FatigueSummary`).

---

## M2 · MAJOR — ShiftExchangeTab: nút Agree/Reject cho counterparty

**Fix:** `src/screens/AnalyticsScreen.jsx` — `ShiftExchangeTab`:
- State mới: `rejectModalId`, `rejectReason`, `agreeing`.
- `handleAgree(id)`: counterparty xác nhận đồng ý → `PUT /api/shift-exchanges/:id/agree`.
- `handleReject()`: bất kỳ bên liên quan → `PUT /api/shift-exchanges/:id/reject` (kèm lý do).
- UI: nút "✓ Đồng ý nhận đổi ca" (xanh) khi `status=pending` và là counterparty;
  nút "✗ Từ chối / Hủy" (đỏ) cho counterparty/chief/applicant ở trạng thái còn hoạt động.
- Modal overlay từ chối: textarea ghi lý do, nút Xác nhận/Huỷ bỏ.

---

*Hoàn thành 2026-06-17. Mọi thay đổi tuân thủ quy ước bảo mật CLAUDE.md.*
