# DEPLOY_AUDIT_v2 — Đánh giá sau commit `affbac5`

> **Kết luận nhanh:** Toàn bộ 10 fix production từ lần trước đã được áp dụng đúng.
> Hệ thống deploy Docker Compose giờ có thể khởi động thành công.
> Còn 7 bug nhỏ hơn cần xử lý — không có cái nào làm crash deploy, nhưng ảnh hưởng
> đến bảo mật và trải nghiệm vận hành.

---

## ✅ Đã fix hoàn toàn (10/10)

| Fix | Nội dung | Trạng thái |
|---|---|---|
| Fix-01 | `migration.sql` — 3 cột `isApproved`, `qualificationExpiresAt`, `qualificationIsActive` | ✅ |
| Fix-02 | `docker-entrypoint.sh` — chạy migration trước khi start | ✅ |
| Fix-03 | `Dockerfile` — thêm `postgresql-client`, dùng entrypoint | ✅ |
| Fix-04 | `docker-compose.yml` — healthcheck postgres + `condition: service_healthy` | ✅ |
| Fix-05 | `.env.example` root — `DB_NAME=atc_pro`, `HIDDEN_ADMIN_ID`, hướng dẫn rõ | ✅ |
| Fix-06 | `notifications.gateway.ts` — `payload.sub` (đã đúng) | ✅ |
| Fix-07 | `backend/.env.example` — thêm `HIDDEN_ADMIN_ID` | ✅ |
| Fix-08 | `nginx.conf` — thêm `/analytics/` proxy route | ✅ |
| Fix-09 | `analytics/main.py` — CORS đọc từ `CORS_ORIGINS` env | ✅ |
| Fix-10 | `DEPLOY.md` — hướng dẫn deploy đầy đủ | ✅ |

---

## Còn tồn tại — 7 vấn đề

### R-01 🔴 — `reset-superadmin.ts` vẫn dùng `DB_PASS` riêng lẻ — bug đã xác nhận

**File:** `backend/scripts/reset-superadmin.ts` dòng 29

```typescript
password: process.env.DB_PASS,   // ← undefined nếu chỉ truyền DATABASE_URL
```

Script dùng từng biến `DB_HOST`, `DB_USER`, `DB_PASS` riêng lẻ thay vì `DATABASE_URL`.
Khi `.env` chỉ có `DATABASE_URL` (không có `DB_PASS`), TypeORM nhận `password: undefined`
→ lỗi SASL mà bạn đã gặp thực tế.

**Fix — `backend/scripts/reset-superadmin.ts`:**

Sửa hàm `getDataSource()`:

```typescript
async function getDataSource(): Promise<DataSource> {
  // Ưu tiên DATABASE_URL nếu có, fallback về từng biến riêng lẻ
  const url = process.env.DATABASE_URL;
  const ds = new DataSource(
    url
      ? {
          type:        'postgres',
          url,
          entities:    [Employee],
          synchronize: false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        }
      : {
          type:        'postgres',
          host:        process.env.DB_HOST ?? 'localhost',
          port:        parseInt(process.env.DB_PORT ?? '5432'),
          username:    process.env.DB_USER ?? 'postgres',
          password:    process.env.DB_PASS ?? '',
          database:    process.env.DB_NAME ?? 'atc_pro',
          entities:    [Employee],
          synchronize: false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        }
  );
  await ds.initialize();
  return ds;
}
```

---

### R-02 🟡 — `dist/` không có trong repo → nginx mount trống nếu quên build

**Vấn đề:** `docker-compose.yml` mount `./dist:/usr/share/nginx/html:ro`.
Nếu ai clone repo và chạy `docker compose up` mà chưa chạy `npm run build` → thư mục
`dist/` không tồn tại hoặc trống → Nginx serve 404 toàn bộ.

`DEPLOY.md` đã có hướng dẫn nhưng dễ bị bỏ qua.

**Fix — thêm kiểm tra vào `docker-entrypoint.sh` hoặc tạo `Makefile`:**

Cách đơn giản nhất — thêm script `deploy.sh` ở root:

```bash
#!/bin/sh
set -e

if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
  echo "[deploy] dist/ trống — đang build frontend..."
  npm install && npm run build
fi

echo "[deploy] Khởi động Docker Compose..."
docker compose up -d "$@"
echo "[deploy] Xong. Kiểm tra: docker compose ps"
```

Cập nhật `DEPLOY.md` — đổi bước 3:

```bash
# Thay vì: docker compose up -d
# Dùng:
chmod +x deploy.sh && ./deploy.sh
```

---

### R-03 🟡 — `tasks.controller.ts` — STAFF xoá/replace được task của CHIEF

**File:** `backend/src/tasks/tasks.controller.ts`

```typescript
@Put()         // replaceByTeam — xoá và tạo lại toàn bộ task của 1 kíp
@UseGuards(JwtAuthGuard)   // ← không có RolesGuard

@Delete(':id') // xoá task bất kỳ
@UseGuards(JwtAuthGuard)   // ← STAFF xoá được task của CHIEF
```

**Fix:**

```typescript
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

@Put()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
replaceByTeam(...) { ... }

@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
remove(...) { ... }
```

`GET`, `POST`, `PUT :id` giữ nguyên `JwtAuthGuard` — STAFF cần xem và update trạng thái nhiệm vụ.

---

### R-04 🟡 — `requests.controller.ts` — STAFF tự approve yêu cầu của chính mình

**File:** `backend/src/requests/requests.controller.ts`

```typescript
@Put(':id')    // update status: pending → approved
@UseGuards(JwtAuthGuard)   // ← không có RolesGuard
```

**Fix:**

```typescript
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

@Put(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
update(...) { ... }

@Put()   // replaceAll — giữ nguyên hoặc thêm guard tương tự
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin')
replaceAll(...) { ... }
```

`POST` (tạo yêu cầu) và `GET` (xem) giữ nguyên `JwtAuthGuard`.

---

### R-05 🟡 — `employees.service.ts` — `upsertOne(isNew=false)` vẫn nhận password từ client

**File:** `backend/src/employees/employees.service.ts` dòng 86-87

```typescript
} else if (emp.password) {
  emp.password = await this.hashIfPlain(emp.password);  // ← không qua DTO validation
}
```

Nếu client gửi `PUT /api/employees/:id` với `body.password = "abc"` → password bị thay đổi,
bỏ qua hoàn toàn rule chữ hoa/thường/số của `ChangePasswordDto`.

**Fix:**

```typescript
} else {
  // isNew=false: KHÔNG cho phép đổi password qua endpoint này.
  // Dùng PATCH /api/employees/:id/password (có ChangePasswordDto validation).
  delete (emp as any).password;
}
```

---

### R-06 🟡 — `AuditService.purgeOldLogs()` không bao giờ được gọi

**File:** `backend/src/audit/` — không có file `audit.cron.ts`

Method `purgeOldLogs()` đã có trong `audit.service.ts` nhưng không có gì kích hoạt nó.
Audit log sẽ tăng vô hạn.

**Fix — tạo `backend/src/audit/audit.cron.ts`:**

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';

@Injectable()
export class AuditCron {
  constructor(private readonly audit: AuditService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge() {
    await this.audit.purgeOldLogs();
  }
}
```

**Thêm vào `backend/src/audit/audit.module.ts`:**

```typescript
import { AuditCron } from './audit.cron';

@Module({
  ...
  providers: [AuditService, AuditCron],   // ← thêm AuditCron
  exports:   [AuditService],
})
export class AuditModule {}
```

> `ScheduleModule.forRoot()` đã có trong `app.module.ts` → không cần thêm.

---

### R-07 🟢 — `AccountManagerScreen` không nhận `addNotification` qua props

**File:** `App.jsx` dòng 269

```javascript
case 'ACCOUNTS': return <AccountManagerScreen
  employees={employees}
  setEmployees={setEmployees}
  settings={settings}
/>;
// ← thiếu: addNotification, currentUser
```

Khi tạo tài khoản mới, `AccountManagerScreen` không thể push thông báo in-app.

**Fix:**

```javascript
case 'ACCOUNTS': return <AccountManagerScreen {...p} />;
```

`p` đã chứa `employees`, `setEmployees`, `settings`, `addNotification`, `currentUser`.
Đảm bảo `AccountManagerScreen.jsx` destructure đúng các props này từ argument.

---

## Tóm tắt theo mức ưu tiên

```
🔴 Làm ngay (1 bug — đã gặp thực tế):
   R-01  reset-superadmin.ts — hỗ trợ DATABASE_URL         (~10 phút)

🟡 Làm trong sprint tiếp (4 bug — bảo mật):
   R-02  deploy.sh — kiểm tra dist/ trước khi compose up   (~10 phút)
   R-03  tasks.controller.ts — thêm RolesGuard DELETE/PUT  (~5 phút)
   R-04  requests.controller.ts — thêm RolesGuard PUT      (~5 phút)
   R-05  employees.service.ts — xoá password trong upsert  (~5 phút)
   R-06  audit.cron.ts — tạo file + đăng ký module         (~10 phút)

🟢 Cải thiện (1 bug — UX):
   R-07  App.jsx AccountManagerScreen — dùng {...p}         (~2 phút)
```

---

## Đánh giá tổng thể

Hệ thống đã **sẵn sàng deploy** về mặt infrastructure. Lần chạy `docker compose up` đầu
tiên sẽ:

1. ✅ Postgres khởi động và healthy trước khi backend connect
2. ✅ Migration chạy tự động → tạo đủ bảng
3. ✅ NestJS start → `ensureHiddenSuperAdmin()` tạo `tctsvip` → in password ra log
4. ✅ Analytics connect đúng DB
5. ✅ Nginx serve frontend + proxy `/api/` và `/analytics/`

**Chỉ cần nhớ:** `npm run build` trước khi `docker compose up`.

Các bug còn lại (R-03, R-04, R-05) là bảo mật logic — không làm crash hệ thống nhưng
nên xử lý trước khi cho người dùng thật truy cập.
