# PLAN_RESET_SUPERADMIN — Khôi phục mật khẩu tài khoản `tctsvip`

> **Vấn đề:** Nếu quên/mất mật khẩu `tctsvip`, không có cách nào reset qua giao diện
> vì chính superadmin đang bị khóa. Cần một script CLI chạy **trực tiếp trên server**,
> không qua HTTP, không cần đăng nhập.
>
> **Thời gian thực hiện:** ~30 phút
>
> **Cách dùng trong Claude VSCode:**
> *"Đọc PLAN_RESET_SUPERADMIN.md. Thực hiện tuần tự từng bước."*

---

## Hiểu rõ luồng mật khẩu `tctsvip` trước khi làm

```
npm run dev:nest
        │
        ▼
ensureHiddenSuperAdmin()   ← hàm trong main.ts chạy mỗi lần khởi động
        │
        ├── tctsvip ĐÃ có trong DB?
        │       │
        │       ├── CÓ  → chỉ check role=superadmin, isApproved=true
        │       │          KHÔNG đổi password → return (an toàn)
        │       │
        │       └── KHÔNG → sinh password random 24 ký tự (base64url)
        │                   hash bcrypt(10) → lưu DB
        │                   in ra terminal 1 LẦN DUY NHẤT:
        │
        │   ════════════════════════════════════════════════
        │   ⚠️  ONE-TIME PASSWORD cho tài khoản tctsvip:
        │   ⚠️  xK9mQ2pR4nLs7vBw3cYd8fGjTn
        │   ⚠️  GHI LẠI NGAY và LƯU AN TOÀN.
        │   ════════════════════════════════════════════════
        │
        ▼
Lần 2, 3, 4... restart server → KHÔNG in gì thêm về tctsvip
```

**Điểm mấu chốt:** Password chỉ lộ ra terminal đúng 1 lần — ngay lần đầu tạo DB.
Sau đó chỉ có bcrypt hash trong DB, không ai (kể cả code) biết plaintext.

---

## Tình huống cần dùng script này

| Tình huống | Cách xử lý |
|---|---|
| Lần đầu khởi động, chưa có DB | Server tự tạo, in password ra terminal → **copy ngay** |
| Đã có DB, nhớ password | Đăng nhập bình thường, vào UI đổi password |
| Đã có DB, **quên password** | Chạy script `npm run reset-superadmin` ← **nội dung file này** |
| Muốn đổi ID superadmin | Sửa biến `HIDDEN_ADMIN_ID` trong `.env` → xoá row cũ trong DB → restart |

---

## Bước 1 — Tạo file script `backend/scripts/reset-superadmin.ts`

Tạo thư mục nếu chưa có:
```bash
mkdir -p backend/scripts
```

**File:** `backend/scripts/reset-superadmin.ts`

```typescript
/**
 * Script CLI: Reset mật khẩu tài khoản superadmin (tctsvip).
 * Chạy trực tiếp trên server, không qua HTTP, không cần đăng nhập.
 *
 * Cách dùng:
 *   npm --prefix backend run reset-superadmin
 *
 * Yêu cầu: file .env ở thư mục backend/ phải có DATABASE_URL hợp lệ.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt    from 'bcrypt';
import { randomBytes } from 'crypto';
import * as readline  from 'readline';
import * as path      from 'path';
import * as dotenv    from 'dotenv';

// Load .env của backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import Employee entity (TypeORM cần đọc decorator)
import { Employee } from '../src/employees/employee.entity';

// ─── Kết nối DB ────────────────────────────────────────────────────────────
async function getDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type:        'postgres',
    url:          process.env.DATABASE_URL,
    entities:    [Employee],
    synchronize: false,   // script chỉ đọc/ghi, KHÔNG tự sửa schema
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await ds.initialize();
  return ds;
}

// ─── Hỏi xác nhận từ terminal ──────────────────────────────────────────────
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const SUPERADMIN_ID = process.env.HIDDEN_ADMIN_ID ?? 'tctsvip';

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  SCRIPT RESET MẬT KHẨU SUPERADMIN — quan-ly-ksvkl');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Tài khoản sẽ được reset: ${SUPERADMIN_ID}`);
  console.log('──────────────────────────────────────────────────────────\n');

  // Xác nhận trước khi thực hiện
  const ok = await confirm(`  Xác nhận reset password cho "${SUPERADMIN_ID}"? (y/N): `);
  if (!ok) {
    console.log('\n  Đã huỷ. Không có gì thay đổi.\n');
    process.exit(0);
  }

  let ds: DataSource | null = null;

  try {
    // Kết nối DB
    console.log('\n  Đang kết nối database...');
    ds = await getDataSource();
    console.log('  ✓ Kết nối thành công.\n');

    const repo = ds.getRepository(Employee);
    const emp  = await repo.findOne({ where: { id: SUPERADMIN_ID } });

    if (!emp) {
      console.log(`  ✗ Không tìm thấy tài khoản "${SUPERADMIN_ID}" trong DB.`);
      console.log('  → Hãy khởi động server bình thường lần đầu để tạo tài khoản.');
      process.exit(1);
    }

    // Sinh password mới 24 ký tự
    const newPassword = randomBytes(18).toString('base64url');
    const hashed      = await bcrypt.hash(newPassword, 10);

    await repo.update(SUPERADMIN_ID, {
      password:     hashed,
      isFirstLogin: true,    // bắt đổi password ngay sau khi đăng nhập
    });

    // In ra terminal — đây là lần duy nhất bạn thấy password này
    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  ✓ ĐÃ RESET MẬT KHẨU cho tài khoản: ${SUPERADMIN_ID}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  MẬT KHẨU MỚI:  ${newPassword}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log('  ⚠️  GHI LẠI NGAY. Script KHÔNG lưu và KHÔNG hiển thị lại.');
    console.log('  ⚠️  Đăng nhập → hệ thống yêu cầu đổi mật khẩu ngay lập tức.');
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n  ✗ Lỗi:', (err as Error).message);
    process.exit(1);
  } finally {
    if (ds?.isInitialized) await ds.destroy();
  }
}

main();
```

---

## Bước 2 — Thêm script vào `backend/package.json`

**File:** `backend/package.json` — thêm vào block `"scripts"`:

```json
"scripts": {
  "build":              "nest build",
  "start":              "node dist/src/main",
  "start:dev":          "nest start --watch",
  "start:debug":        "nest start --debug --watch",
  "test":               "jest",
  "test:watch":         "jest --watch",
  "reset-superadmin":   "ts-node --project tsconfig.json -r tsconfig-paths/register scripts/reset-superadmin.ts"
}
```

---

## Bước 3 — Kiểm tra `ts-node` đã có chưa

Script dùng `ts-node` để chạy TypeScript trực tiếp (không cần build trước).

```bash
# Kiểm tra
cd backend && npx ts-node --version

# Nếu chưa có:
npm install --save-dev ts-node tsconfig-paths
```

> `tsconfig-paths` cần thiết để `ts-node` hiểu các path alias trong `tsconfig.json` (ví dụ `@/...`).

---

## Bước 4 — Cách chạy khi quên mật khẩu

**Từ thư mục gốc dự án:**

```bash
npm --prefix backend run reset-superadmin
```

**Hoặc từ trong thư mục `backend/`:**

```bash
cd backend
npm run reset-superadmin
```

**Terminal sẽ hỏi xác nhận:**

```
══════════════════════════════════════════════════════════
  SCRIPT RESET MẬT KHẨU SUPERADMIN — quan-ly-ksvkl
══════════════════════════════════════════════════════════
  Tài khoản sẽ được reset: tctsvip
──────────────────────────────────────────────────────────

  Xác nhận reset password cho "tctsvip"? (y/N): y

  Đang kết nối database...
  ✓ Kết nối thành công.

══════════════════════════════════════════════════════════
  ✓ ĐÃ RESET MẬT KHẨU cho tài khoản: tctsvip
──────────────────────────────────────────────────────────
  MẬT KHẨU MỚI:  xK9mQ2pR4nLs7vBw3cYd8f
──────────────────────────────────────────────────────────
  ⚠️  GHI LẠI NGAY. Script KHÔNG lưu và KHÔNG hiển thị lại.
  ⚠️  Đăng nhập → hệ thống yêu cầu đổi mật khẩu ngay lập tức.
══════════════════════════════════════════════════════════
```

Nhấn `N` hoặc Enter (không gõ gì) để huỷ — **không có gì thay đổi**.

---

## Bước 5 — Thêm vào root `package.json` cho tiện (tuỳ chọn)

Nếu muốn gọi từ thư mục gốc mà không cần `--prefix backend`:

**File:** `package.json` (thư mục gốc) — thêm 1 dòng vào `"scripts"`:

```json
"scripts": {
  "dev":               "concurrently ...",
  "dev:front":         "vite",
  "dev:nest":          "npm --prefix backend run start:dev",
  "dev:fast":          "cd analytics && uvicorn app.main:app --reload --port 8000",
  "reset-superadmin":  "npm --prefix backend run reset-superadmin",
  "build":             "vite build",
  "preview":           "vite preview"
}
```

Sau đó chỉ cần:
```bash
npm run reset-superadmin
```

---

## Bảo mật — Những điều cần lưu ý

| Điều PHẢI làm | Lý do |
|---|---|
| Chạy script **trực tiếp trên máy chủ** (SSH vào server) | Script đọc `.env` và kết nối DB nội bộ — không phơi ra internet |
| **Không commit** `backend/.env` lên GitHub | File `.env` chứa `DATABASE_URL` — đã có trong `.gitignore` |
| Sau khi reset, **đăng nhập ngay và đổi mật khẩu** | `isFirstLogin: true` → UI bắt buộc đổi password trước khi dùng |
| Lưu mật khẩu mới vào **password manager** | Terminal history có thể bị xoá nhưng password manager thì không |

| Điều KHÔNG làm | Lý do |
|---|---|
| Không gọi script này qua HTTP endpoint | Ai cũng có thể gọi — mất toàn bộ bảo mật |
| Không copy-paste password từ terminal vào chat/email | Lộ plaintext |
| Không chạy script trên máy local khi DB ở server khác mà không có tunnel | Kết nối DB không mã hoá qua internet |

---

## Checklist

- [ ] Tạo thư mục `backend/scripts/`
- [ ] Tạo file `backend/scripts/reset-superadmin.ts` với nội dung trên
- [ ] Thêm `"reset-superadmin"` vào `backend/package.json`
- [ ] Kiểm tra `ts-node` và `tsconfig-paths` đã có trong devDependencies
- [ ] Thêm `"reset-superadmin"` vào root `package.json` (tuỳ chọn)
- [ ] **Test thử:** Chạy `npm run reset-superadmin`, nhấn `N` để huỷ → không có gì thay đổi
- [ ] **Test thật:** Chạy lại, nhấn `Y` → đăng nhập bằng password mới → đổi password ngay
