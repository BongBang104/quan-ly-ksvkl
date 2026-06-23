# CHANGELOG — PLAN_FIX_ACCOUNT_SECURITY

## Sprint 0 (P0) — Khởi động đồng thời toàn stack

### [DONE] P0.A-F — concurrently + dev scripts
- Cài `concurrently` vào devDependencies của root `package.json`
- Thêm script `dev` chạy FRONT + NEST + FAST song song với màu log phân biệt
- Tạo `analytics/dev.bat` kích hoạt virtualenv và chạy uvicorn
- Verify: `analytics/.venv/` đã có trong `.gitignore`

**Commit:** `feat: P0 concurrently dev stack + P1-P6 account security`

---

## Sprint Nhỏ (P1 + P2 + P4)

### [DONE] P1.A — generatePassword()
- Thêm private method `generatePassword()` vào `EmployeesService`
- Sinh 10 ký tự ngẫu nhiên, đảm bảo ≥1 hoa + ≥1 thường + ≥1 số, Fisher-Yates shuffle
- Dùng alphabet loại bỏ các ký tự dễ nhầm (0, O, l, 1, I)

### [DONE] P1.B — upsertOne() + UpsertResult
- Export interface `UpsertResult { employee, generatedPassword? }`
- Thêm tham số `isNew: boolean = false` vào `upsertOne()`
- `isNew=true`: sinh password ngẫu nhiên, set `isFirstLogin=true`
- `isNew=false`: giữ nguyên password (không nhận từ client)

### [DONE] P1.C — POST /api/employees truyền isNew=true
- Sửa controller `create()`: `return this.svc.upsertOne(body, true)`

### [DONE] P1.D — replaceAll() sinh password chỉ cho user mới
- Snapshot passwords hiện tại trước khi DELETE
- Existing employees → giữ password cũ
- New employees → sinh ngẫu nhiên, trả về `passwords` map
- Trả về `{ list, passwords }` (passwords: `{ id → plaintext }`)

### [DONE] P1.E — handleSaveSingle (frontend)
- Update: gọi `PUT /api/employees/:id`, không gửi password
- Create: gọi `POST /api/employees`, đọc `{ employee, generatedPassword }` từ response
- Hiển thị `createdPassword` modal (chỉ 1 lần, có nút Copy)

### [DONE] P1.F — handleSaveBulk (frontend)
- Gọi `PUT /api/employees` với mergedList
- Đọc `{ list, passwords }` từ response
- Hiển thị bảng bulkPasswords modal + nút Export CSV (UTF-8 BOM)

### [DONE] P1.G — PATCH /:id/reset-password
- Backend: `resetPassword(empId)` — sinh password mới, set `isFirstLogin=true`
- Controller: `@Patch(':id/reset-password')` yêu cầu ADMIN/superadmin
- Frontend: `handleResetPassword` gọi API, hiện `createdPassword` modal

### [DONE] P2.A — Ownership check PATCH /:id/password
- `PasswordController.changePassword()`: kiểm tra `caller.id !== id`
- Nếu không phải chủ + không phải superadmin → `ForbiddenException`
- Truyền `ip` + `userAgent` từ request vào auth service

### [DONE] P2.B — ChangePasswordDto nâng chuẩn
- Thêm `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)` — ≥8 ký tự, có hoa+thường+số

### [DONE] P4.A — SQL migration LEADER → CHIEF
- Tạo `backend/migrations/003_normalize_role_leader_to_chief.sql`
- `UPDATE employees SET role = 'CHIEF' WHERE role = 'LEADER'`

### [DONE] P4.B+C — Chuẩn hoá LEADER→CHIEF toàn stack
- `AccountManagerScreen.jsx`: roles array dùng CHIEF, tất cả comparison
- `App.jsx`, `AppContext.jsx`, `DashboardScreen.jsx`, `SchedulerScreen.jsx`
- `TeamsScreen.jsx`, `TasksScreen.jsx`, `TaskFormModal.js`, `ManagerDataScreen.jsx`
- Verify: `grep -r 'LEADER' src/` → 0 kết quả

---

## Sprint Trung (P3)

### [DONE] P3.A — src/utils/passwordValidator.js
- Export `PASSWORD_RULES` (minLength=8, regex hoa+thường+số)
- Export `validatePassword(password)` → `{ valid, message }`

### [DONE] P3.B — LoginScreen.jsx FORCE_CHANGE
- Import `validatePassword` thay logic cũ `length < 6`
- Cập nhật placeholder field mật khẩu mới

---

## Sprint Dài (P6) — Audit Log

### [DONE] P6.A — AuditLog entity
- `backend/src/audit/audit-log.entity.ts`
- Bảng `audit_logs`: id (uuid), actorId, actorName, action, resourceType, resourceId, payload (jsonb), ip, userAgent, createdAt

### [DONE] P6.B — AuditService
- `log()` — ghi 1 audit record
- `findAll(limit)` — trả về log mới nhất
- `purgeOldLogs()` — xoá log > 1 năm

### [DONE] P6.C — AuditModule
- `imports: [TypeOrmModule.forFeature([AuditLog])]`
- `exports: [AuditService]`

### [DONE] P6.D — AuditController GET /api/audit
- Yêu cầu JwtAuthGuard + SuperAdminGuard
- Query param `?limit=N`

### [DONE] P6.E — AppModule + migration.sql
- Import `AuditModule` vào `AppModule`
- Đăng ký `AuditLog` entity
- Thêm `CREATE TABLE IF NOT EXISTS audit_logs` vào `migration.sql`

### [DONE] P6.F — AuthService log actions
- LOGIN_SUCCESS: log sau xác thực thành công
- LOGIN_FAIL: log với reason `not_found | wrong_password | not_approved`
- CHANGE_PASSWORD: log actorId + resourceId
- Thêm `ip` + `userAgent` vào login endpoint

### [DONE] P6.H — AuditLogScreen.jsx + navigation
- Hiển thị bảng log với badge màu theo loại action
- Thêm tab "Lịch sử hệ thống" vào sidebar, chỉ hiện với `superadmin`

---

## Checklist bảo mật sau sprint

- [x] Không còn `'tctsdn123'` hay `password:` hardcode trong source code
- [x] Không còn `'LEADER'` trong source code — toàn bộ dùng `'CHIEF'`
- [x] Password tạo mới chỉ do backend sinh, trả về 1 lần duy nhất
- [x] `PATCH /:id/password` có ownership check
- [x] `ChangePasswordDto` enforces strong password
- [x] Login + changePassword có audit trail
- [x] `audit_logs` table có index trên `createdAt` + `actorId`
- [x] `synchronize: false` — schema do `migration.sql` quản lý

## Lưu ý deploy

1. Chạy `backend/migrations/003_normalize_role_leader_to_chief.sql` trên DB production
2. Chạy phần `audit_logs` trong `migration.sql` để tạo bảng mới
3. Deploy backend (NestJS rebuild)
4. Deploy frontend
