# Kế hoạch khắc phục dự án quan-ly-ksvkl

> **Mục đích:** Đặc tả để Claude trong VSCode tự khắc phục các lỗi đã phát hiện qua rà soát.
> Đọc TOÀN BỘ file này trước khi bắt đầu. Làm tuần tự **theo đúng thứ tự** mục 1 → mục 17.
> Sau mỗi mục, chạy bước "Xác minh" của mục đó. Nếu xác minh thất bại, dừng lại và báo cáo.

## Nguyên tắc làm việc

1. **Surgical changes** (theo CLAUDE.md): chỉ sửa đúng những gì mục yêu cầu, không "cải thiện" code lân cận.
2. **Không xóa dữ liệu DB** trong bất kỳ bước nào. Mọi thay đổi schema chỉ ở mức entity/migration file.
3. **Nếu một mục đụng tới file mà bạn chưa chắc cấu trúc, hãy `view` file trước khi sửa**, không đoán.
4. Sau mỗi mục đã làm xong, ghi một dòng tóm tắt vào file `CHANGELOG_FIX.md` ở thư mục gốc (tạo nếu chưa có) theo định dạng: `- [DONE] Mục N — <tên mục> — <ngày>`.
5. Khi xác minh chạy lệnh và lệnh đó cần dependencies chưa cài, cài rồi mới chạy. Không bỏ qua bước xác minh.
6. Nếu phát hiện bước nào đã làm trước đó (file đã ở trạng thái mong muốn), ghi `[ALREADY DONE]` và sang mục tiếp theo.

---

## NHÓM A — BẢO MẬT NGHIÊM TRỌNG (ưu tiên cao nhất)

### Mục 1 — Bỏ default password plain-text trong entity

**File:** `backend/src/employees/employee.entity.ts`

**Tìm dòng:**
```ts
@Column({ default: 'tctsdn123' }) password: string;
```

**Thay bằng:**
```ts
@Column() password: string; // bcrypt hash, bắt buộc set khi tạo
```

**Xác minh:** `grep -n "tctsdn123" backend/src/employees/employee.entity.ts` không trả về kết quả nào.

---

### Mục 2 — Hash mật khẩu khi tạo/cập nhật employee

**File:** `backend/src/employees/employees.service.ts`

**Vấn đề:** `upsertOne` và `replaceAll` lưu password plain-text.

**Cần làm:**
1. Import `import * as bcrypt from 'bcrypt';` ở đầu file.
2. Thêm hàm private:
```ts
private async hashIfPlain(password: string | undefined): Promise<string | undefined> {
  if (!password) return undefined;
  if (password.startsWith('$2')) return password; // đã hash
  return bcrypt.hash(password, 10);
}
```
3. Trong `upsertOne`, trước khi `this.repo.save(emp)`:
```ts
if (emp.password) {
  emp.password = await this.hashIfPlain(emp.password);
}
```
4. Trong `replaceAll`, sau `.map(e => ({ ... }))`, thêm bước hash:
```ts
const hashed = await Promise.all(
  filtered.map(async e => ({ ...e, password: await this.hashIfPlain(e.password) })),
);
const saved = await this.repo.save(hashed);
```
(thay biến `filtered` bằng `hashed` ở lời gọi `repo.save`)

**Xác minh:** `grep -n "bcrypt" backend/src/employees/employees.service.ts` trả về ít nhất 2 dòng (import + hash).

---

### Mục 3 — Bỏ nhánh "legacy plain-text" trong xác thực

**File:** `backend/src/auth/auth.service.ts`

**Tìm:**
```ts
private async verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored; // legacy plain-text — will be replaced on first change
}
```

**Thay bằng:**
```ts
private async verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Chỉ chấp nhận bcrypt hash. Nếu DB còn password plain-text (legacy),
  // chạy script migration để hash trước khi triển khai.
  if (!stored.startsWith('$2')) return false;
  return bcrypt.compare(plain, stored);
}
```

**Xác minh:** `grep -n "legacy plain-text\|plain === stored" backend/src/auth/auth.service.ts` không trả về kết quả.

---

### Mục 4 — Sửa migration.sql và viết script hash mật khẩu hiện có

**File:** `backend/migration.sql`

**Tìm:**
```sql
password     VARCHAR NOT NULL DEFAULT 'tctsdn123',
```
**Thay bằng:**
```sql
password     VARCHAR NOT NULL,
```

**Tìm:**
```sql
INSERT INTO employees (id, name, role, password, "isFirstLogin")
VALUES ('admin', 'Administrator', 'admin', 'tctsdn123', TRUE)
ON CONFLICT (id) DO NOTHING;
```
**Thay bằng comment hướng dẫn dùng seed script:**
```sql
-- Tài khoản admin ban đầu được tạo bằng script: backend/scripts/seed-admin.ts
-- Lệnh: npx ts-node backend/scripts/seed-admin.ts
-- Lý do: cần hash bcrypt, không thể seed bằng SQL thuần.
```

**Tạo mới:** `backend/scripts/seed-admin.ts`
```ts
/**
 * Seed tài khoản admin ban đầu với password đã hash bcrypt.
 * Chạy MỘT LẦN sau khi DB rỗng: npx ts-node backend/scripts/seed-admin.ts
 *
 * Đọc password từ env ADMIN_INITIAL_PASSWORD, hoặc sinh ngẫu nhiên và in ra console.
 */
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Employee } from '../src/employees/employee.entity';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    database: process.env.DB_NAME ?? 'atc_pro',
    entities: [Employee],
    synchronize: false,
  });
  await ds.initialize();
  const repo = ds.getRepository(Employee);

  const existing = await repo.findOne({ where: { id: 'admin' } });
  if (existing) {
    console.log('Tài khoản admin đã tồn tại — bỏ qua.');
    await ds.destroy();
    return;
  }

  const plain = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(plain, 10);

  await repo.save({
    id: 'admin',
    name: 'Administrator',
    role: 'superadmin',
    password: hash,
    isFirstLogin: true,
    isApproved: true,
  } as Employee);

  console.log('✓ Đã tạo tài khoản admin.');
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log('  Mật khẩu sinh ngẫu nhiên: ' + plain);
    console.log('  Hãy đăng nhập và đổi mật khẩu NGAY.');
  }
  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
```

Thêm `dotenv` và `ts-node` vào devDependencies nếu chưa có:
```bash
cd backend && npm install --save-dev ts-node dotenv
```

**Xác minh:**
- `grep -n "tctsdn123" backend/migration.sql` không trả về kết quả.
- File `backend/scripts/seed-admin.ts` tồn tại.

---

### Mục 5 — Bỏ JWT secret và CORS mặc định không an toàn

**File:** `backend/src/auth/jwt.strategy.ts`

**Tìm:**
```ts
secretOrKey: cfg.get<string>('JWT_SECRET', 'atc_secret_key'),
```
**Thay bằng:**
```ts
secretOrKey: (() => {
  const s = cfg.get<string>('JWT_SECRET');
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET phải được khai báo trong .env và dài ≥ 32 ký tự.');
  }
  return s;
})(),
```

**File:** `backend/src/auth/auth.module.ts`

**Tìm:**
```ts
secret: cfg.get<string>('JWT_SECRET', 'atc_secret_key'),
```
**Thay bằng:**
```ts
secret: (() => {
  const s = cfg.get<string>('JWT_SECRET');
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET phải được khai báo trong .env và dài ≥ 32 ký tự.');
  }
  return s;
})(),
```

**File:** `backend/src/main.ts`

**Tìm:**
```ts
app.enableCors({
  origin: process.env.FRONTEND_URL?.split(',') ?? '*',
  credentials: true,
});
```
**Thay bằng:**
```ts
const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
  throw new Error('FRONTEND_URL phải được khai báo trong .env (danh sách origin, ngăn cách dấu phẩy).');
}
app.enableCors({
  origin: frontendUrl.split(',').map(s => s.trim()),
  credentials: true,
});
```

**Cập nhật** `backend/.env.example` — đổi mô tả JWT_SECRET:
```
# JWT_SECRET phải có độ dài >= 32 ký tự. Sinh bằng: openssl rand -base64 48
JWT_SECRET=
JWT_EXPIRES_IN=8h
```

**Xác minh:**
- `grep -n "atc_secret_key" backend/src/` không trả về kết quả.
- `grep -n "?? '\*'" backend/src/main.ts` không trả về kết quả.

---

### Mục 6 — Tắt `synchronize: true`

**File:** `backend/src/app.module.ts`

**Tìm:**
```ts
synchronize: true, // Auto-create tables — disable in production, use migrations
```
**Thay bằng:**
```ts
synchronize: false, // Schema do migration.sql quản lý. KHÔNG bật trong production.
```

**Xác minh:** `grep -n "synchronize: true" backend/src` không trả về kết quả.

---

### Mục 7 — Thêm phân quyền role cho endpoint nhạy cảm

**Tạo file mới:** `backend/src/auth/roles.guard.ts`
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return user && required.includes(user.role);
  }
}
```

**Tạo file mới:** `backend/src/auth/roles.decorator.ts`
```ts
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './roles.guard';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Cập nhật:** `backend/src/employees/employees.controller.ts` — thêm role guard cho thao tác sửa đổi:
```ts
// Đầu file, sau các import hiện có:
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

// Với các endpoint @Put(), @Post(), @Put(':id'), @Delete(':id'):
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin')
```
GIỮ NGUYÊN `@Get()` chỉ với `JwtAuthGuard` (cho phép mọi user xem danh sách).
GIỮ NGUYÊN `@Patch(':id/approve')` đã có `SuperAdminGuard`.

**Cập nhật:** `backend/src/schedules/schedules.controller.ts` — `@Put(':monthKey')` và `@Post('notify-roster')` cần role check:
```ts
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

// Thêm trước @Put(':monthKey'):
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin', 'CHIEF')
```
(`CHIEF` ứng với kíp trưởng — nếu role string thực tế khác, hỏi người dùng trước khi quyết)

**Xác minh:**
- File `backend/src/auth/roles.guard.ts` và `roles.decorator.ts` tồn tại.
- `grep -n "RolesGuard\|Roles(" backend/src/employees/employees.controller.ts` trả về ít nhất 3 kết quả.
- `grep -n "RolesGuard\|Roles(" backend/src/schedules/schedules.controller.ts` trả về ít nhất 2 kết quả.

---

### Mục 8 — Thêm DTO validation cho các endpoint nhạy cảm

**Tạo file mới:** `backend/src/auth/dto/login.dto.ts`
```ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString() @MinLength(1) @MaxLength(100)
  id!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  password!: string;
}
```

**Tạo file mới:** `backend/src/auth/dto/change-password.dto.ts`
```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(200)
  newPassword!: string;
}
```

**Cập nhật:** `backend/src/auth/auth.controller.ts` — thay type inline bằng DTO:
```ts
import { LoginDto }          from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// trong AuthController.login:
login(@Body() body: LoginDto) {
  return this.auth.login(body.id, body.password);
}

// trong PasswordController.changePassword:
changePassword(@Param('id') id: string, @Body() body: ChangePasswordDto) {
  return this.auth.changePassword(id, body.newPassword);
}
```

**Cài thêm package nếu chưa có:**
```bash
cd backend && npm install class-validator class-transformer
```
(Có thể đã cài rồi — kiểm tra `package.json` trước.)

**Xác minh:**
- File `backend/src/auth/dto/login.dto.ts` và `change-password.dto.ts` tồn tại.
- `grep -n "LoginDto\|ChangePasswordDto" backend/src/auth/auth.controller.ts` trả về ít nhất 4 dòng.

---

### Mục 9 — Thêm rate limiting cho login

**Cài:** `cd backend && npm install @nestjs/throttler`

**Cập nhật:** `backend/src/app.module.ts` — thêm import và imports[]:
```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Trong imports[] (sau ConfigModule.forRoot):
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),

// Trong providers (thêm nếu chưa có providers, hoặc bổ sung):
providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },
],
```

**Xác minh:** `grep -n "ThrottlerModule\|ThrottlerGuard" backend/src/app.module.ts` trả về ít nhất 2 dòng.

---

## NHÓM B — CẤU TRÚC DỰ ÁN

### Mục 10 — Xóa thư mục `Model/` (code Expo cũ trùng lặp)

**Hành động:** Xóa toàn bộ thư mục `Model/` ở thư mục gốc.

```bash
rm -rf Model
```

**Lý do:** `Model/` là bản React Native Expo gốc, đã được chuyển đổi sang web React trong `src/`. Hai bản gần như giống nhau, bản trong `Model/` đã chết và gây nhầm lẫn cho AI assistant khi đọc code.

**Trước khi xóa, kiểm tra một lần nữa:** không có file nào trong `Model/` được import từ ngoài. Chạy:
```bash
grep -rE "from ['\"].*Model/" . --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "^Model/"
```
Nếu lệnh trên trả về kết quả nào, **DỪNG LẠI** và báo cho người dùng — có chỗ vẫn import từ `Model/`.

Nếu rỗng, xóa thư mục.

**Xác minh:** `ls Model 2>/dev/null` không có gì.

---

### Mục 11 — Xóa các script di sản chuyển đổi từ Expo sang web

**Hành động:** Sau khi đã xóa `Model/`, các script chuyển đổi không còn cần:
```bash
rm -f convert-web.js fix-imports.ps1
```

**Xác minh:** Hai file trên không còn tồn tại.

---

### Mục 12 — Viết lại `README.md` cho dự án thật

**File:** `README.md` (ghi đè hoàn toàn)

Nội dung mới (Markdown):
```markdown
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
```

**Xác minh:** `grep -c "Snack\|Expo Snack" README.md` trả về `0`.

---

### Mục 13 — Thêm khung test cho backend

**Cài:**
```bash
cd backend && npm install --save-dev @nestjs/testing jest @types/jest ts-jest
```

**Cập nhật:** `backend/package.json` — thêm vào `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

**Thêm vào `package.json` (cùng cấp với "scripts"):**
```json
"jest": {
  "moduleFileExtensions": ["js","json","ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "testEnvironment": "node"
}
```

**Tạo file test mẫu:** `backend/src/auth/auth.service.spec.ts`
```ts
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Employee } from '../employees/employee.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  const fakeEmp = (overrides: Partial<Employee> = {}) => ({
    id: 'u1', name: 'User', role: 'STAFF', isApproved: true,
    password: '', ...overrides,
  } as Employee);

  const buildModule = async (emp: Employee | null) => {
    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: () => 'fake-token' } },
        { provide: getRepositoryToken(Employee),
          useValue: { findOne: async () => emp, update: async () => undefined } },
      ],
    }).compile();
    return mod.get(AuthService);
  };

  it('reject login khi mật khẩu sai', async () => {
    const hash = await bcrypt.hash('correct', 10);
    service = await buildModule(fakeEmp({ password: hash }));
    await expect(service.login('u1', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('reject login khi password lưu plain-text (legacy không còn được chấp nhận)', async () => {
    service = await buildModule(fakeEmp({ password: 'tctsdn123' }));
    await expect(service.login('u1', 'tctsdn123')).rejects.toThrow(UnauthorizedException);
  });

  it('cho phép login khi mật khẩu đúng và đã hash', async () => {
    const hash = await bcrypt.hash('correct', 10);
    service = await buildModule(fakeEmp({ password: hash }));
    const result = await service.login('u1', 'correct');
    expect(result.token).toBe('fake-token');
    expect((result.user as any).password).toBeUndefined();
  });
});
```

**Xác minh:** `cd backend && npm test 2>&1 | tail -5` cho thấy 3 test pass.

---

### Mục 14 — Tạo docker-compose.yml ở thư mục gốc

**File mới:** `docker-compose.yml`
```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [internal]

  backend:
    build: ./backend
    restart: always
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASS: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: 8h
      FRONTEND_URL: ${FRONTEND_URL}
      PORT: 3000
    depends_on: [postgres]
    networks: [internal]

  analytics:
    build: ./analytics
    restart: always
    environment:
      DATABASE_URL: postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
    depends_on: [postgres]
    networks: [internal]

  nginx:
    image: nginx:alpine
    restart: always
    ports: ["80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./dist:/usr/share/nginx/html:ro
    depends_on: [backend, analytics]
    networks: [internal]

volumes:
  postgres_data:

networks:
  internal:
```

**File mới:** `nginx.conf`
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

    location /analytics/ {
        proxy_pass http://analytics:8001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**File mới:** `backend/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migration.sql ./migration.sql
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

**File mới:** `.env.example` ở thư mục gốc
```
DB_USER=ksvkl_user
DB_PASSWORD=
DB_NAME=ksvkl
JWT_SECRET=
FRONTEND_URL=http://localhost
```

**Xác minh:**
- `docker-compose.yml`, `nginx.conf`, `backend/Dockerfile`, `.env.example` (gốc) tồn tại.
- Tổng dòng `docker-compose.yml` ≥ 30.

---

## NHÓM C — TÀI LIỆU & CHẤT LƯỢNG

### Mục 15 — Cập nhật CLAUDE.md với quy ước riêng dự án

**File:** `CLAUDE.md` (giữ nội dung hiện có, **thêm vào cuối**):

```markdown

---

## Quy ước riêng cho dự án quan-ly-ksvkl

### Tech stack đã chốt
- Backend: NestJS + TypeORM + PostgreSQL (KHÔNG dùng Prisma).
- Analytics: Python FastAPI, CHỈ ĐỌC DB.
- Frontend: React + Vite.

### Quy ước database
- Tên cột trong DB: `camelCase` có dấu nháy kép (TypeORM convention),
  ví dụ `"controllerId"`, `"isNight"`.
- Schema do `backend/migration.sql` quản lý. `synchronize` PHẢI là `false`.
- Analytics đọc các bảng do TypeORM tạo — KHÔNG được ghi.

### Quy ước mật khẩu & bảo mật
- TUYỆT ĐỐI không bao giờ commit mật khẩu plain-text, kể cả seed/migration.
- Mọi mật khẩu lưu trong DB phải là bcrypt hash (`$2...`).
- JWT_SECRET phải ≥ 32 ký tự; CORS không bao giờ dùng `*`.
- Endpoint thao tác dữ liệu nhạy cảm (tạo/sửa/xóa nhân sự, publish lịch)
  phải có cả `JwtAuthGuard` và `RolesGuard`.

### Mô hình vị trí (KSVKL)
- 4 vị trí điều hành: APP, CTL, TWR, GCU.
- CTL = vùng trời dưới FL245 (trên FL245 do ACC HCM/HN, ngoài phạm vi).
- Năng định: "full" hoặc danh sách vị trí riêng lẻ.
- Một ca trực có thể chứa NHIỀU phiên vị trí (luân phiên).
- Phiên liền kề cùng vị trí (không giải lao) được gộp khi tính ngồi vị trí.

### Ngưỡng quy định
- Mọi ngưỡng (giờ nghỉ, recency, ...) đọc từ cấu hình, KHÔNG hard-code.
- Đây là hệ thống an toàn hàng không — luôn coi công cụ là HỖ TRỢ,
  không thay thế quy trình phê duyệt chính thức.

### Khi sửa code
- Ưu tiên bảo mật trước, mọi thay đổi.
- Đọc `FIX_PLAN.md` để biết kế hoạch khắc phục đang ở đâu.
- Sau khi xong một mục, ghi vào `CHANGELOG_FIX.md`.
```

**Xác minh:** `grep -c "quan-ly-ksvkl\|VATM\|CTL\|GCU" CLAUDE.md` trả về số ≥ 4.

---

### Mục 16 — Cập nhật PYTHON_ANALYTICS_SPEC.md cho khớp TypeORM

**File:** `PYTHON_ANALYTICS_SPEC.md`

**Tìm các đoạn nhắc tới "Prisma"** và sửa thành "TypeORM" cho khớp thực tế. Cụ thể:
- Câu "Schema do Prisma (phía NestJS) sở hữu và quản lý migration." → "Schema do TypeORM/migration.sql (phía NestJS) sở hữu và quản lý."
- Phần "Schema DB kỳ vọng" của Phase 1: cập nhật tên cột theo entity thực tế (camelCase với nháy kép: `"controllerId"`, `"isNight"`, `"shiftId"`, `"monthKey"`).
- Phần Phase 2 "Schema DB bổ sung": ghi chú rằng dự án hiện gộp `qualification` vào một cột trong bảng `employees` (theo entity hiện tại), thay vì 2 bảng riêng. Nếu muốn tách bảng, đó là cải tiến Phase 2.

**Xác minh:** `grep -c "Prisma" PYTHON_ANALYTICS_SPEC.md` trả về `0`.

---

### Mục 17 — Mở rộng Position cho vị trí thực tế của đơn vị

**Hành động:** Đây là mục liên quan đến quyết định nghiệp vụ. **DỪNG TRƯỚC KHI SỬA** và hỏi người dùng:

1. Các vị trí HĐA/HĐC/HĐT/HĐG (hiệp đồng) có cần năng định riêng không, hay là vị trí phụ trợ bất kỳ KSVKL nào cũng làm được?
2. TKT T6/T8 và QS là vị trí điều hành cần năng định, hay chỉ là cách phân tổ?
3. GRD trên bảng phân ca thực tế có phải là GCU trong code không?

Sau khi có câu trả lời, mở rộng `Position` enum trong `analytics/app/compliance/rest_compliance.py` và cập nhật các test tương ứng. Không tự đoán.

**Xác minh:** Đặt câu hỏi rõ ràng cho người dùng và đợi phản hồi.

---

## Kiểm tra cuối cùng (sau khi hoàn tất Mục 1–16)

Chạy lần lượt:

```bash
# 1. Backend build và test
cd backend
npm install
npm run build && npm test
cd ..

# 2. Analytics test
cd analytics
pip install -r requirements.txt
pytest
cd ..

# 3. Frontend build
npm install
npm run build

# 4. Kiểm tra không còn vấn đề bảo mật cũ
grep -rE "tctsdn123|atc_secret_key|synchronize: true|plain === stored|\\?\\? '\\*'" \
     backend/ --include="*.ts" --include="*.sql" 2>/dev/null
# Lệnh trên phải trả về RỖNG.
```

Nếu tất cả pass và lệnh `grep` cuối trả về rỗng, **báo cho người dùng** kèm tóm tắt từ `CHANGELOG_FIX.md`.

Nếu bất kỳ bước nào thất bại, dừng và báo cáo chính xác lỗi gặp phải — không tự ý "sửa thêm" ngoài kế hoạch này.

---

## Lưu ý cuối

- **Không tự ý refactor** ngoài phạm vi từng mục, kể cả khi thấy code có thể "đẹp hơn".
- **Không xóa file nào ngoài `Model/`, `convert-web.js`, `fix-imports.ps1`** đã được liệt kê rõ.
- **Không đụng đến `analytics/`** trừ Mục 16 và 17.
- Nếu phát hiện file bị conflict hoặc đã có nội dung khác với mô tả "Tìm" trong tài liệu này, **DỪNG và báo cho người dùng** thay vì đoán.
- Khi gặp lỗi build/test sau khi sửa, debug TRƯỚC khi chuyển sang mục tiếp theo.
