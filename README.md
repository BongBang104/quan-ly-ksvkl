# quan-ly-ksvkl

Hệ thống quản lý Kiểm Soát Viên Không Lưu (KSVKL) — quản lý nhân sự, lịch trực,
năng định, và phân tích/tối ưu hóa phân ca.

## Kiến trúc

- **frontend (gốc, src/)** — React + Vite, giao diện web cho KSVKL và quản lý.
- **backend/** — NestJS + TypeORM + PostgreSQL, REST API + WebSocket.
- **analytics/** — Python FastAPI, dịch vụ phân tích **CHỈ ĐỌC** (kiểm tra
  tuân thủ nghỉ ngơi, rà soát phân ca trước publish, gợi ý tối ưu).

## Yêu cầu hệ thống

- Node.js ≥ 20, npm
- Python ≥ 3.11
- PostgreSQL ≥ 15

## Cài đặt nhanh (dev)

### 1. Backend

```bash
cd backend
cp .env.example .env   # điền JWT_SECRET (>= 32 ký tự), DB_*
npm install
psql -U postgres -d atc_pro -f migration.sql
npx ts-node scripts/seed-admin.ts   # tạo admin ban đầu
npm run start:dev
```

### 2. Analytics

```bash
cd analytics
cp .env.example .env   # điền DATABASE_URL
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload
```

### 3. Frontend

```bash
npm install
npm run dev
```

## Test

- Analytics: `cd analytics && pytest`
- Backend: `cd backend && npm test` (sau khi mục 13 hoàn tất)

## Cấu trúc thư mục

- `src/` — mã nguồn React frontend
- `backend/src/` — module NestJS (auth, employees, schedules, tasks, ...)
- `analytics/app/` — service FastAPI và các module phân tích Python
- `analytics/tests/` — pytest

## Tài liệu

- `PYTHON_ANALYTICS_SPEC.md` — đặc tả dịch vụ analytics, 4 phase phát triển
- `CLAUDE.md` — quy ước cho AI coding assistant
- `CHANGELOG_FIX.md` — nhật ký khắc phục

## An toàn

Hệ thống phục vụ ngành hàng không. Mọi ngưỡng quy định (giờ nghỉ, recency
năng định, ...) phải đối chiếu với quy định **VATM/CAAV và ICAO** hiện hành
trước khi đưa vào sử dụng. Công cụ phân tích HỖ TRỢ ra quyết định, KHÔNG
thay thế quy trình phê duyệt chính thức của kíp trưởng.
