# CHANGELOG_SPRINT_NEXT.md

Theo dõi tiến độ PLAN_SPRINT_NEXT.md

---

## PHẦN X — Dọn 2 chỗ "ví dụ" còn sót

[DONE] Mục X1 — analytics/app/routers/optimize.py docstring — 2026-06-02
- Xóa "Mọi ngưỡng chỉ là ví dụ, cần thay bằng số liệu VATM/CAAV/ICAO"
- Thay bằng citation 5 ràng buộc cứng QĐ 2288 Điều 13.1/15.1.b/15.1.c/12.2/12.1

[DONE] Mục X2 — analytics/app/ratings/rating_status.py docstring — 2026-06-02
- Xóa "Ngưỡng ngày cảnh báo CHỈ LÀ VÍ DỤ — thay bằng số liệu VATM/CAAV/ICAO"
- Thay bằng hướng dẫn cấu hình runtime + dropdown 30/60/90 ngày

Xác minh X: grep "ví dụ|VATM/CAAV/ICAO" analytics/app/ → 0 source file match (chỉ .pyc cache)

[DONE] Mục X3 — Cập nhật CHANGELOG_TAB_BAO_CAO.md — 2026-06-02
- Bổ sung mục B4.1 CP-SAT constraints còn thiếu
- Cập nhật dòng tổng kết "không còn chuỗi ví dụ"

## PHẦN Y — Precheck đổi ca thật

[DONE] Mục Y1 — Cập nhật `backend/src/shift-exchanges/shift-exchanges.service.ts` để `_extractShifts` parse đúng `YYYY-MM-DD` và không cộng thêm 1 tháng — 2026-06-02
- `scheduleData` thực tế chứa key `"<empId>_YYYY-MM-DD"`.
- Sửa lỗi `m + 1` trong tính `isoDate`.

[DONE] Mục Y2 — Cập nhật `backend/src/shift-exchanges/shift-exchanges.module.ts` — 2026-06-02
- Thêm `Employee`, `Schedule` vào `TypeOrmModule.forFeature`.
- Import `AnalyticsModule` để `AnalyticsClient` có thể inject.

[DONE] Mục Y3 — Cập nhật `backend/src/shift-exchanges/shift-exchanges.controller.ts` — 2026-06-02
- Thêm endpoint `POST /api/shift-exchanges/precheck`.
- `POST /api/shift-exchanges` giờ chạy `runPrecheck()` và lưu `precheckResult`.
- `PUT /api/shift-exchanges/:id/approve` nhận `override_reason` trong body.

[DONE] Mục Y4 — Cập nhật frontend `src/screens/AnalyticsScreen.jsx` — 2026-06-02
- Thêm nút `🔍 Kiểm tra điều kiện` cho form Đổi ca / Trực thay.
- Hiển thị component `PrecheckPanel` với trạng thái `can_approve`, năng định tương đương, vi phạm mới và cảnh báo.

[DONE] Mục Y5 — Thêm giao diện phê duyệt kíp trưởng trong danh sách `ShiftExchange` — 2026-06-02
- Hiển thị nút `Phê duyệt` cho trạng thái `counterparty_agreed` và `chief_1_approved`.
- Mở form lý do `override_reason` khi phê duyệt, bắt buộc khi có cảnh báo/precheck không approve.

[DONE] Mục Y6 — Hiển thị chi tiết `ex.precheckResult` trong list item `ShiftExchange` — 2026-06-02
- Thêm summary `Precheck`, số lượng `warnings`, số `vi phạm mới` với màu sắc trạng thái.
- Cho phép bật/tắt xem chi tiết `PrecheckPanel` ngay trong danh sách.

[DONE] Xác minh Y — `cd backend && npm run build` thành công.
