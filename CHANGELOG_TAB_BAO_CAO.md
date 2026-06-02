# CHANGELOG_TAB_BAO_CAO.md

Theo dõi tiến độ PLAN_TAB_BAO_CAO.md

---

## PHASE A — Tái cấu trúc AnalyticsScreen

[DONE] Mục A1 — TAB_GROUPS thay thế TABS cũ — 2026-06-02
- 2 nhóm: "Phân tích & Giám sát" (5 tab) + "Biểu mẫu & Quy trình" (5 tab)
- TABS = TAB_GROUPS.flatMap() giữ backward-compat
- Thêm import: api từ ApiService, ChecklistViewer, KssScale

[DONE] Mục A2 — Render UI 2 nhóm tab — 2026-06-02
- groupId + switchGroup state
- Thanh group tab + thanh sub-tab độc lập
- 5 placeholder components cho tab mới (được thay bằng code thật trong Phase D-F)
- currentUser prop được truyền vào AnalyticsScreen từ App.jsx

Xác minh A: npm run build pass; 2 thanh tab hiển thị đúng

---

## PHASE B — Điều chỉnh 4 tab hiện có

[DONE] Mục B1.1 + B1.2 — legal_basis vào Violation + compliance.py router — 2026-06-02
- Violation.legal_basis: str = "" trong rest_compliance.py
- Tất cả check_* methods có legal_basis đúng QĐ 2288
- compliance.py ViolationOut thêm legal_basis field
- Test kiểm tra legal_basis không rỗng

[DONE] Mục B1.3 — ViolationRow hiển thị tag legal_basis — 2026-06-02
- Tag xám nhỏ bên dưới message, render khi legal_basis không rỗng

[DONE] Mục B2.1 + B2.2 — FairnessTab night_hours — 2026-06-02
- fairness.py: thêm _night_hours() tính giờ trong 22h-06h, thêm night_hours vào ControllerStats.to_dict()
- FairnessTab: cột "GIỜ ĐÊM" mới; bỏ ngưỡng cứng 24h khỏi SummCard; thêm note FSAG (QĐ 2289)
- test_fairness.py cập nhật shape test

[DONE] Mục B3.2 — QualificationsTab dropdown daysAhead + note_auxiliary — 2026-06-02
- Dropdown 30/60/90 ngày thay hard-code 60
- Dùng pos.position_label từ response thay POS_LABEL cứng
- Hiển thị coverage.note_auxiliary ở chân bảng phủ sóng

[DONE] Mục B4.2 — OptimizerTab disclaimer + main.py docstring — 2026-06-02
- Thay "giá trị ví dụ" bằng citation QĐ 2288 cụ thể
- main.py docstring cập nhật 3 văn bản pháp lý

---

## PHASE C — Checklist Phụ lục I QĐ 2288

[DONE] Mục C1 + C2 — analytics + NestJS endpoints — 2026-06-02
- analytics/app/review/qd2288_checklist.py: build_checklist() 5 phần A-E, summary, header
- analytics/app/routers/roster.py: /checklist và /macro/checklist
- analytics/app/main.py: đăng ký spi.router + exchange.router
- NestJS: POST /api/schedules/roster-checklist và /api/schedules/macro-checklist

[DONE] Mục C3 — ChecklistViewer.jsx — 2026-06-02
- src/components/ChecklistViewer.jsx: render 5 section A-E với badge Đạt/Không đạt/N/A
- Nút In/Xuất PDF

[DONE] Mục C4 — ChecklistTab trong AnalyticsScreen — 2026-06-02
- Chọn tháng → lấy scheduleData từ /api/schedules/:mk → chuyển sang assignments[]
- Gọi /api/schedules/macro-checklist → hiển thị ChecklistViewer

[DONE] Mục C5 — Nút "Xuất Checklist (PL I)" trong DetailedRosterModal — 2026-06-02
- Đã triển khai cùng V2 Mục 4.3 (xem CHANGELOG_INTEGRATION.md)

---

## PHASE G — SPI Dashboard (QĐ 2288 Điều 24)

[DONE] Mục G1 — analytics/app/routers/spi.py — 2026-06-02
- GET /analytics/spi/summary?month_key=...
- 7 chỉ số: fatigue_reports, limit_violations (CRITICAL/WARNING), deviation, variation, extended_shifts, training
- Chỉ số chờ Phase D (fatigue_reports=0, training=null)

[DONE] Mục G2 — NestJS GET spi-summary/:monthKey + SpiDashboardTab — 2026-06-02
- AnalyticsClient.getSpiSummary()
- SpiCard component với màu theo status (ok/warning/critical)
- SpiDashboardTab trong AnalyticsScreen

---

## PHASE D — Báo cáo mệt mỏi (QĐ 2288 Phụ lục III)

[DONE] Mục D1 — DB migration fatigue_reports — 2026-06-02
- backend/migration.sql: CREATE TABLE fatigue_reports với đủ cột
- INDEX trên reporterId, status, createdAt

[DONE] Mục D2 — NestJS module fatigue-reports — 2026-06-02
- Entity, Service (với _nextAnonCode FR-YYYY-NNNNNN), Controller, Module
- Endpoints: POST /api/fatigue-reports, GET mine/for-chief, PUT :id/acknowledge, GET summary

[DONE] Mục D3 — KssScale.jsx — 2026-06-02
- 9 mức KSS với màu gradient xanh → đỏ
- Cảnh báo tự động khi KSS ≥ 7

[DONE] Mục D4 — FatigueReportTab form đầy đủ — 2026-06-02
- Phần A (tùy chọn): facility, shiftType, shiftStart/End, contact
- Phần B (bắt buộc): fatigueOnset, KssScale, sleepHours, sleepQuality, impactDescription, 3 nhóm factors
- Phần C: 2 cam kết nguyên văn QĐ 2288 + checkbox đồng ý
- Hiển thị anonCode sau submit thành công

[DONE] Mục D5 — Cron escalation 24h — 2026-06-02
- @nestjs/schedule cài qua npm install
- ScheduleModule.forRoot() trong app.module.ts
- @Cron(EVERY_HOUR) trên escalatePending() → đánh dấu safetyNotified=true sau 24h

---

## PHASE E — Đổi ca / Trực thay (QĐ 2701 Phụ lục I)

[DONE] Mục E1 — DB migration shift_exchanges — 2026-06-02
- Đủ cột: type, facilityType, applicant/counterparty info, dual-chief approval

[DONE] Mục E2 — NestJS module shift-exchanges — 2026-06-02
- Service: create, counterpartyAgree, chiefApprove (hỗ trợ dual approval cho ACC_APP_TWR), reject
- Controller: POST, GET mine, PUT agree/approve/reject

[DONE] Mục E3 — analytics/app/routers/exchange.py — 2026-06-02
- POST /analytics/exchange/precheck (stub — triển khai đầy đủ sau)

[DONE] Mục E4 — ShiftExchangeTab frontend — 2026-06-02
- Dùng `position` field hiện có để xác định facilityType (TWR_ONLY nếu position chứa 'twr')
- Form: type, ca của tôi, người nhận, ca hoàn trả (nếu EXCHANGE), cam kết
- Danh sách yêu cầu với status label

---

## PHASE F — Bình giảng sau ca (QĐ 2701 Phụ lục II)

[DONE] Mục F1 — DB migration shift_briefings — 2026-06-02
- Đủ cột: team/shiftDate/shiftCode, level (light/formal), participants, safety event

[DONE] Mục F2 + F3 — NestJS module + ShiftBriefingTab — 2026-06-02
- Trigger: kíp trưởng tự tạo thủ công (theo lựa chọn của user)
- 2 mức: "Lưu ghi chép nội bộ" (light) và "Tạo Báo cáo chính thức" (formal)
- Form: team/shiftDate, nội dung, đề xuất, hasSafetyEvent, safetyEventSummary

---

## V2 MỤC 5.5 — Giao nhận ca WEST (QĐ 2701 Điều 10-12)

[DONE] DB migration shift_handovers — 2026-06-02
- Đủ cột: team/handoverDate/shiftCode, W/E/S/T fields, dual signature

[DONE] NestJS module shift-handovers — 2026-06-02
- Service: createOrGet (upsert by team+date+code), update, signOutgoing, signIncoming
- Controller: POST, GET by team+date, PUT update/sign-outgoing/sign-incoming

[DONE] WestHandoverTab trong AnalyticsScreen — 2026-06-02
- Tab mới "Giao nhận ca (WEST)" trong nhóm "Biểu mẫu & Quy trình"
- 4 textarea: Weather/Equipment/Situation/Traffic
- Workflow: Lưu → Ký (kíp giao) → Ký (kíp nhận) → Hoàn tất

---

---

## Bổ sung (Sprint Next - 2026-06-02)

[DONE] Mục B4.1 — 5 ràng buộc QĐ 2288 trong CP-SAT solver — 2026-06-02
- shift_optimizer.py có đủ 5 hard constraints
- Điều 13.1 (nghỉ ≥12h), Điều 15.1.b (≤3 đêm liên tiếp), Điều 15.1.c (nghỉ ≥48h sau đêm),
  Điều 12.2 (≤6 ngày liên tiếp), Điều 12.1 (≤180h/30 ngày)
- (CHANGELOG ban đầu thiếu dòng này; bổ sung khi rà soát)

[DONE] Mục X1 — optimize.py docstring dọn "ví dụ" — 2026-06-02
[DONE] Mục X2 — rating_status.py docstring dọn "VATM/CAAV/ICAO" — 2026-06-02

---

## Xác minh tổng thể

- analytics: 135 tests passed (thêm 25 test mới so với ban đầu)
- NestJS: nest build clean (với @nestjs/schedule)
- Frontend: vite build clean
- migration.sql: 4 bảng mới (fatigue_reports, shift_exchanges, shift_briefings, shift_handovers)
- Không còn chuỗi "ví dụ"/"VATM/CAAV/ICAO" trong analytics code
  (đã dọn 2 chỗ sót ở Sprint Next: optimize.py + rating_status.py)
- Tất cả ngưỡng bám theo QĐ 2288/QĐ 2701 có citation
