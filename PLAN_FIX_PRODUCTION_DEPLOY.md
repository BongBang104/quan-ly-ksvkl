# PLAN_FIX_PRODUCTION_DEPLOY

> **Trạng thái audit:** commit `e74cd5e` — tất cả bug production từ lần trước vẫn còn nguyên.
> Commit mới chỉ thêm file docs, không thay đổi code.
>
> **Cách dùng trong Claude VSCode:**
> *"Đọc PLAN_FIX_PRODUCTION_DEPLOY.md. Làm tuần tự theo thứ tự ưu tiên.
> Xem file trước khi sửa. Sau mỗi mục đánh [DONE]."*

---

## Thứ tự thực hiện

```
NHÓM 1 — Làm trước: Deploy sẽ crash nếu thiếu (30 phút)
  Fix-01  migration.sql — thêm 3 cột thiếu
  Fix-02  docker-entrypoint.sh — chạy migration trước khi start
  Fix-03  docker-compose.yml — healthcheck + depends_on condition
  Fix-04  .env.example root — đồng nhất DB_NAME

NHÓM 2 — Làm tiếp: Bug logic nghiêm trọng (15 phút)
  Fix-05  notifications.gateway.ts — payload.id → payload.sub
  Fix-06  backend/.env.example — thêm HIDDEN_ADMIN_ID
  Fix-07  docker-compose.yml — thêm HIDDEN_ADMIN_ID vào backend env

NHÓM 3 — Hoàn thiện trước khi ra ngoài internet (20 phút)
  Fix-08  nginx.conf — thêm /analytics/ proxy route
  Fix-09  nginx.conf — thêm HTTPS redirect (nếu có domain)
  Fix-10  .env.example root — sửa FRONTEND_URL, thêm hướng dẫn
```

---

## NHÓM 1 — Deploy crash fixes

### Fix-01 — `migration.sql`: Thêm 3 cột thiếu vào bảng `employees`

**File:** `backend/migration.sql`

**Vấn đề:** Bảng `employees` trong migration thiếu 3 cột mà `Employee` entity và code đang dùng.
NestJS khởi động → `ensureHiddenSuperAdmin()` gọi `repo.save({ isApproved: true })` → PostgreSQL
báo lỗi column không tồn tại → **backend crash ngay lần đầu**.

Tìm đoạn `CREATE TABLE IF NOT EXISTS employees`. Sửa toàn bộ block:

```sql
CREATE TABLE IF NOT EXISTS employees (
  id                       VARCHAR PRIMARY KEY,
  name                     VARCHAR NOT NULL,
  "icaoCode"               VARCHAR,
  team                     VARCHAR,
  role                     VARCHAR NOT NULL DEFAULT 'STAFF',
  position                 VARCHAR,
  qualification            VARCHAR,
  "qualificationExpiresAt" DATE,
  "qualificationIsActive"  BOOLEAN NOT NULL DEFAULT TRUE,
  "isChief"                BOOLEAN NOT NULL DEFAULT FALSE,
  "isVip"                  BOOLEAN NOT NULL DEFAULT FALSE,
  phone                    VARCHAR,
  email                    VARCHAR,
  password                 VARCHAR NOT NULL,
  "isFirstLogin"           BOOLEAN NOT NULL DEFAULT TRUE,
  "isApproved"             BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> **3 thay đổi so với hiện tại:**
> - Thêm `"qualificationExpiresAt" DATE`
> - Thêm `"qualificationIsActive" BOOLEAN NOT NULL DEFAULT TRUE`
> - Thêm `"isApproved" BOOLEAN NOT NULL DEFAULT TRUE`
> - Sửa default `role` từ `'user'` → `'STAFF'`

---

### Fix-02 — Tạo `backend/docker-entrypoint.sh`

**Vấn đề:** `CMD ["node", "dist/main"]` trong Dockerfile không chạy migration trước.
DB trống → NestJS crash ngay vì bảng chưa tồn tại.

**Tạo file mới:** `backend/docker-entrypoint.sh`

```bash
#!/bin/sh
set -e

echo "[entrypoint] Waiting for PostgreSQL to be ready..."
# pg_isready không có trong node:20-alpine — dùng psql thay thế
until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "[entrypoint] PostgreSQL not ready yet — retrying in 2s..."
  sleep 2
done
echo "[entrypoint] PostgreSQL is ready."

echo "[entrypoint] Running migration..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /app/migration.sql
echo "[entrypoint] Migration complete."

echo "[entrypoint] Starting NestJS..."
exec node dist/main
```

---

### Fix-03 — Sửa `backend/Dockerfile`: cài `postgresql-client` + dùng entrypoint

**File:** `backend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
# Cần postgresql-client để chạy psql trong entrypoint
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migration.sql ./migration.sql
COPY package*.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
```

---

### Fix-04 — Sửa `docker-compose.yml`: healthcheck + depends_on condition

**File:** `docker-compose.yml`

Thay toàn bộ nội dung file:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER:     ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB:       ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 15s

  backend:
    build: ./backend
    restart: always
    environment:
      DB_HOST:        postgres
      DB_PORT:        5432
      DB_USER:        ${DB_USER}
      DB_PASS:        ${DB_PASSWORD}
      DB_NAME:        ${DB_NAME}
      JWT_SECRET:     ${JWT_SECRET}
      JWT_EXPIRES_IN: 8h
      FRONTEND_URL:   ${FRONTEND_URL}
      PORT:           3000
      HIDDEN_ADMIN_ID: ${HIDDEN_ADMIN_ID:-tctsvip}
    depends_on:
      postgres:
        condition: service_healthy
    networks: [internal]

  analytics:
    build: ./analytics
    restart: always
    environment:
      DATABASE_URL: postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      CORS_ORIGINS:  ${FRONTEND_URL}
    depends_on:
      postgres:
        condition: service_healthy
    # ports:
    #   - "8001:8001"   # bỏ comment khi cần debug analytics trực tiếp
    networks: [internal]

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
      - analytics
    networks: [internal]

volumes:
  postgres_data:

networks:
  internal:
```

---

### Fix-05 — Sửa `.env.example` (root): đồng nhất DB_NAME + hướng dẫn rõ

**File:** `.env.example` (thư mục gốc)

```env
# ── Database ──────────────────────────────────────────────────────────────────
# Dùng cho PostgreSQL container và cả backend + analytics
DB_USER=postgres
DB_PASSWORD=
DB_NAME=atc_pro

# ── JWT ───────────────────────────────────────────────────────────────────────
# Sinh bằng: openssl rand -base64 48
# Độ dài tối thiểu: 32 ký tự
JWT_SECRET=

# ── URLs ──────────────────────────────────────────────────────────────────────
# URL trình duyệt dùng để truy cập frontend (không có trailing slash)
# Dev local:    http://localhost:5173
# Production:   https://yourdomain.com
FRONTEND_URL=http://localhost:5173

# ── Superadmin ────────────────────────────────────────────────────────────────
# ID tài khoản superadmin ẩn (đổi thành ID khó đoán trước khi deploy)
HIDDEN_ADMIN_ID=tctsvip
```

---

## NHÓM 2 — Bug logic nghiêm trọng

### Fix-06 — `notifications.gateway.ts`: payload.id → payload.sub

**File:** `backend/src/notifications/notifications.gateway.ts`

**Vấn đề:** JWT token được ký với `{ sub: emp.id, role, name }` nhưng gateway đọc
`payload.id` (không tồn tại) → `client.data.userId = undefined` mọi kết nối →
real-time notification không route đúng user.

Tìm dòng (khoảng dòng 24):

```typescript
// Hiện tại — SAI:
client.data.userId = payload.id;
```

Sửa thành:

```typescript
// Đúng — JWT payload dùng 'sub' theo chuẩn JWT:
client.data.userId = payload.sub;
```

---

### Fix-07 — `backend/.env.example`: thêm `HIDDEN_ADMIN_ID`

**File:** `backend/.env.example`

Thêm vào cuối file:

```env
# ── Superadmin ────────────────────────────────────────────────────────────────
# ID tài khoản superadmin ẩn. Đổi thành ID khó đoán trước khi deploy production.
# Mật khẩu được sinh ngẫu nhiên lần đầu khởi động và in ra console 1 lần duy nhất.
HIDDEN_ADMIN_ID=tctsvip
```

---

## NHÓM 3 — Hoàn thiện

### Fix-08 — `nginx.conf`: thêm proxy route cho analytics

**File:** `nginx.conf`

Thêm location block trước `location /` để dự phòng khi frontend cần gọi FastAPI trực tiếp:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Analytics FastAPI — proxy nội bộ
    location /analytics/ {
        proxy_pass http://analytics:8001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

### Fix-09 — `analytics/app/main.py`: đọc CORS từ biến môi trường

**File:** `analytics/app/main.py`

Tìm đoạn `allow_origins=[...]`. Sửa để đọc từ biến môi trường thay vì hardcode:

```python
import os

# Đọc từ env để hoạt động đúng trong mọi môi trường (dev/staging/production)
_cors_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
)
_allow_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Fix-10 — Thêm `build` script và hướng dẫn deploy vào `README.md` hoặc `DEPLOY.md`

**Tạo file mới:** `DEPLOY.md` ở thư mục gốc

```markdown
# Hướng dẫn deploy production

## Yêu cầu
- Docker + Docker Compose v2
- Domain hoặc IP server

## Các bước

### 1. Clone repo và build frontend
```bash
git clone https://github.com/BongBang104/quan-ly-ksvkl.git
cd quan-ly-ksvkl
npm install
npm run build        # tạo thư mục dist/ — bắt buộc trước khi docker compose up
```

### 2. Tạo file .env từ .env.example
```bash
cp .env.example .env
```

Chỉnh sửa `.env`:
```
DB_USER=postgres
DB_PASSWORD=<mật_khẩu_mạnh>
DB_NAME=atc_pro
JWT_SECRET=<openssl rand -base64 48>
FRONTEND_URL=https://yourdomain.com   # URL thật của server
HIDDEN_ADMIN_ID=<id_khó_đoán>        # đổi khỏi tctsvip
```

### 3. Khởi động
```bash
docker compose up -d
```

### 4. Lấy mật khẩu superadmin lần đầu
```bash
docker compose logs backend | grep "ONE-TIME PASSWORD"
```

### 5. Kiểm tra
```bash
docker compose ps        # tất cả phải ở trạng thái healthy/running
curl http://localhost/api/health
```

## Lưu ý bảo mật
- Không commit file `.env` lên git
- JWT_SECRET phải ≥ 32 ký tự, sinh ngẫu nhiên
- HIDDEN_ADMIN_ID nên đổi khỏi `tctsvip`
- Đặt firewall chỉ mở port 80 (và 443 nếu có HTTPS)
```

---

## Checklist tổng kết

### Nhóm 1 — Bắt buộc (deploy sẽ crash nếu thiếu)
- [ ] **Fix-01** `backend/migration.sql` — thêm `isApproved`, `qualificationExpiresAt`, `qualificationIsActive`, sửa default role `'user'` → `'STAFF'`
- [ ] **Fix-02** Tạo `backend/docker-entrypoint.sh`
- [ ] **Fix-03** `backend/Dockerfile` — thêm `postgresql-client`, dùng `docker-entrypoint.sh`
- [ ] **Fix-04** `docker-compose.yml` — healthcheck postgres, depends_on condition, thêm `HIDDEN_ADMIN_ID`, `CORS_ORIGINS`
- [ ] **Fix-05** `.env.example` (root) — đổi `DB_NAME=ksvkl` → `atc_pro`, sửa `FRONTEND_URL`, thêm `HIDDEN_ADMIN_ID`

### Nhóm 2 — Bug logic
- [ ] **Fix-06** `backend/src/notifications/notifications.gateway.ts` — `payload.id` → `payload.sub`
- [ ] **Fix-07** `backend/.env.example` — thêm `HIDDEN_ADMIN_ID`

### Nhóm 3 — Hoàn thiện
- [ ] **Fix-08** `nginx.conf` — thêm `/analytics/` proxy route
- [ ] **Fix-09** `analytics/app/main.py` — CORS đọc từ `CORS_ORIGINS` env var
- [ ] **Fix-10** Tạo `DEPLOY.md` — hướng dẫn deploy đầy đủ

### Verify sau khi xong
```bash
# Build frontend
npm run build

# Khởi động toàn bộ stack
docker compose up -d

# Kiểm tra tất cả container healthy
docker compose ps

# Kiểm tra backend khởi động đúng (migration + superadmin seed)
docker compose logs backend

# Kiểm tra API
curl http://localhost/api/health

# Kiểm tra analytics
curl http://localhost/analytics/health
```
