# CHANGELOG_INTEGRATION.md

Theo dõi tiến độ PLAN_INTEGRATION_V2.md

---

## PHẦN 1 — Cập nhật ngưỡng theo QĐ 2288

[DONE] Mục 1.1 — Viết lại RestRuleConfig với citation đầy đủ — 2026-06-02
- 59 citations QĐ 2288/QĐ 2701 trong rest_compliance.py
- Đổi: max_continuous_duty_hours → max_designed_shift_hours (10h) + max_extended_shift_hours (12h)
- Đổi: max_duty_hours_per_28days (156h/28 ngày) → max_duty_hours_per_30days (180h/30 ngày)
- Đổi: min_rest_between_shifts 11h → 12h (QĐ 2288 Điều 13.1)
- Đổi: max_duty_hours_per_week 40h → 48h (QĐ 2288 Điều 11.2)
- Thêm: min_break_after_position, night/early/late window fields, oncall limits, effective_from

[DONE] Mục 1.2 — _check_break_after_position (QĐ 2288 Điều 14.2.a) — 2026-06-02
- 3 test mới: day violation, night violation, night OK

[DONE] Mục 1.3 — OncallAssignment + check_oncall_limits (stub) — 2026-06-02
- DB chưa có on-call → stub, không gắn vào check_all()
- 3 test: 4 lượt/7 ngày vi phạm, 3 lượt OK, 25h vi phạm max_oncall_duration

[DONE] Mục 1.4 — ShiftKind + classify_shift_kind + Shift.kind — 2026-06-02
- EARLY ưu tiên trước NIGHT (xử lý overlap 04h-06h)
- 6 test: NIGHT/EARLY/LATE/NORMAL, effective_kind từ is_night và explicit

[DONE] Mục 1.5 — _check_early_after_late_or_night (QĐ 2288 Điều 15.2.b) — 2026-06-02
- 2 test: EARLY after NIGHT vi phạm, EARLY after NORMAL không vi phạm

Xác minh Phần 1: pytest tests/ → 135 passed; grep QĐ 2288|QĐ 2701 → 59 hits

---

## PHẦN 2 — Gộp Analytics vào DetailedRosterModal

[DONE] Mục 2.1.a — Analytics endpoint POST /analytics/roster/review-draft — 2026-06-02
- Schema RosterDraft + ControllerInfo + RosterRow (hỗ trợ flat format từ DetailedRosterModal)
- convert_draft() tính classify_shift_kind thay vì chỉ is_night = D
- Endpoint /analytics/roster/checklist cấp ca
- File: analytics/app/routers/roster.py

[DONE] Mục 2.1.b — NestJS AnalyticsModule/Client/Controller — 2026-06-02
- AnalyticsClient dùng native fetch (không cần @nestjs/axios)
- Endpoints: POST review-roster-draft, roster-checklist, review-macro-roster, macro-checklist, GET spi-summary/:monthKey
- File: backend/src/analytics/

[DONE] Mục 2.1.c — Frontend: reviewRosterDraft, ReviewResultPanel, DetailedRosterModal — 2026-06-02
- src/services/ApiService.js: thêm reviewRosterDraft, reviewMacroRoster, getRosterChecklist, getMacroChecklist
- src/components/ReviewResultPanel.jsx: hiển thị violations + legal_basis tag
- src/components/DetailedRosterModal.js: nút "Rà soát" + "Xuất Checklist (PL I)" + ReviewResultPanel
- src/utils/checklistHtml.js: renderChecklistHtml() cho cửa sổ in

[DONE] Mục 2.2 — Đổi nhãn menu "Phân tích" → "Báo cáo" — 2026-06-02
- App.jsx: label, truyền currentUser vào AnalyticsScreen

---

## PHẦN 3 — Rà soát cấp Trung tâm (SchedulerScreen)

[DONE] Mục 3.1 — schemas_macro.py: MacroRosterDraft, DayAssignment, MacroReviewResult — 2026-06-02

[DONE] Mục 3.2 — chu_ky_review.py: review_macro_draft() — 2026-06-02
- Quy đổi DayAssignment → Shift, bỏ rules cần session
- Kiểm tra on-call limits + coverage theo ngày

[DONE] Mục 3.3 — Endpoints /macro/review và /macro/checklist trong roster.py — 2026-06-02

[DONE] Mục 3.4 — NestJS: AnalyticsController.reviewMacro + getMacroChecklist — 2026-06-02

[DONE] Mục 3.5 — SchedulerScreen: nút "Rà soát chu kỳ" + ReviewResultPanel — 2026-06-02
- handleMacroReview(): chuyển scheduleData (empId_year-month-day format, month 0-indexed) sang assignments[]
- Coverage warnings hiển thị riêng

---

## PHẦN 4 — Checklist Phụ lục I (trong DetailedRosterModal)

[DONE] Mục 4.1 + 4.2 — qd2288_checklist.py + endpoint /checklist — 2026-06-02
- 5 phần A-E, 23 tiêu chí
- summary: total_items, pass_count, fail_count, na_count, overall_status
- header.roster_info với team/shift_date/shift_code/period

[DONE] Mục 4.3 — Nút "Xuất Checklist (PL I)" trong DetailedRosterModal — 2026-06-02
- handleExportChecklist: gọi /api/schedules/roster-checklist, render HTML, window.print()

---

## PHẦN 5 — Tab Báo cáo (đã làm theo PLAN_TAB_BAO_CAO)

Xem CHANGELOG_TAB_BAO_CAO.md cho chi tiết.

---

## Xác minh cuối

- analytics: 135 tests passed
- NestJS: nest build clean
- Frontend: vite build clean (chunk size warning only — không phải error)
- Không còn chuỗi "giá trị ví dụ/VATM/CAAV/ICAO" trong analytics code chính
