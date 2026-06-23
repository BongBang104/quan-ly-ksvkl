# PLAN_FIX_ACCOUNT_SECURITY — Bảo mật Workflow Tài khoản (P1-P6)

> **Bối cảnh:** Audit `AccountManagerScreen.jsx` + `auth.service.ts` phát hiện 6 vấn đề bảo mật P1-P6.
> Sprint này triển khai **Phương án B — fix toàn diện**.
>
> **Stack:** React+Vite (frontend) · NestJS+TypeORM (backend) · PostgreSQL
>
> **Cách dùng trong Claude VSCode:**
> *"Đọc PLAN_FIX_ACCOUNT_SECURITY.md. Làm tuần tự Sprint Nhỏ → Trung → Dài.
> Sau mỗi mục, ghi `[DONE]` + git commit message đề xuất vào CHANGELOG_FIX_ACCOUNT_SECURITY.md."*

---

## Sprint Ưu tiên 0 (~30 phút) — Khởi động đồng thời toàn stack bằng `npm run dev`

> Làm trước tất cả các sprint khác. Sau khi xong, chỉ cần 1 lệnh `npm run dev` ở thư mục gốc
> để khởi động đồng thời: **Vite (frontend)** + **NestJS (backend)** + **FastAPI (analytics)**.

---

### P0.A — Cài `concurrently` vào root

**Thư mục gốc dự án** (nơi chứa `package.json` frontend):

```bash
npm install --save-dev concurrently
```

`concurrently` chạy nhiều lệnh song song trong cùng 1 terminal, in log có màu phân biệt từng service.

---

### P0.B — Sửa `package.json` root

**File:** `package.json` (thư mục gốc)

Thay toàn bộ block `"scripts"` hiện tại:

```json
"scripts": {
  "dev": "concurrently --names \"FRONT,NEST,FAST\" --prefix-colors \"cyan,yellow,magenta\" --kill-others-on-fail \"npm run dev:front\" \"npm run dev:nest\" \"npm run dev:fast\"",
  "dev:front": "vite",
  "dev:nest":  "npm --prefix backend run start:dev",
  "dev:fast":  "cd analytics && uvicorn app.main:app --reload --port 8000",
  "build":     "vite build",
  "preview":   "vite preview"
},
```

> **Giải thích các flag:**
> - `--names` — nhãn in ở đầu mỗi dòng log: `[FRONT]`, `[NEST]`, `[FAST]`.
> - `--prefix-colors` — màu cyan / vàng / tím để phân biệt 3 service ngay trong terminal.
> - `--kill-others-on-fail` — nếu 1 service crash (ví dụ NestJS lỗi compile), tự kill 2 service còn lại thay vì để zombie process.

---

### P0.C — Đảm bảo Python environment đúng

Trước khi chạy lần đầu, tạo virtualenv cho analytics (chỉ cần 1 lần):

```bash
cd analytics
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

Sau đó **deactivate** và quay về thư mục gốc. Lệnh `dev:fast` trong `package.json` cần trỏ đúng vào Python của venv. Sửa lại script nếu dùng venv:

```json
"dev:fast": "cd analytics && .venv/Scripts/uvicorn app.main:app --reload --port 8000"
```

*(Windows dùng `.venv\\Scripts\\uvicorn`, Linux/macOS dùng `.venv/bin/uvicorn`)*

Hoặc cách đơn giản hơn — tạo file `analytics/dev.sh` (Linux/macOS) / `analytics/dev.bat` (Windows):

**`analytics/dev.sh`:**
```bash
#!/bin/bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**`analytics/dev.bat`:**
```bat
@echo off
call .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Rồi đổi script trong `package.json`:
```json
"dev:fast": "cd analytics && bash dev.sh"
```
*(Windows: `"dev:fast": "cd analytics && dev.bat"`)*

---

### P0.D — Kiểm tra port mặc định

Đảm bảo 3 service không đụng port:

| Service    | Port mặc định | Cấu hình          |
|------------|--------------|-------------------|
| Frontend   | `:5173`      | `vite.config.js`  |
| NestJS     | `:3000`      | `backend/.env` — `PORT=3000` |
| FastAPI    | `:8000`      | tham số `--port 8000` trong script |

Nếu máy bạn đang dùng port khác, sửa biến `PORT` trong `backend/.env` và tham số `--port` trong script `dev:fast`.

---

### P0.E — Kết quả sau khi chạy `npm run dev`

Terminal sẽ hiển thị log 3 màu xen kẽ nhau, ví dụ:

```
[FRONT] VITE v5.x.x  ready in 312 ms
[FRONT] ➜  Local:   http://localhost:5173/
[NEST]  [NestApplication] Nest application successfully started
[NEST]  Listening on port 3000
[FAST]  INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
[FAST]  INFO:     Started reloader process [12345]
```

Nhấn `Ctrl + C` một lần để kill toàn bộ 3 process cùng lúc.

---

### P0.F — Thêm vào `.gitignore` nếu chưa có

```
# Python virtualenv
analytics/.venv/
```

---

## Nguyên tắc bất biến

1. **Không bao giờ hardcode password** trong source code — kể cả "default".
2. **Backend là nguồn sự thật** — password sinh ra ở backend, trả về 1 lần duy nhất, không sinh ở frontend.
3. **Ownership check** — chỉ chính chủ hoặc superadmin được đổi password của mình.
4. **Chuẩn hoá tên role** — dùng `CHIEF` thống nhất toàn stack (không dùng `LEADER`).
5. **Mọi mutation quan trọng phải có audit log** — persistent, không chỉ WebSocket.
6. **Không refactor ngoài phạm vi từng mục.** Trước khi sửa file lớn, `view` toàn file trước.
7. **Pattern đúng:** `req.user.id` (không phải `req.user.sub`). JWT payload: `{ sub, role, name }` → JwtStrategy trả về `{ id: sub, role, name }`.

---

## Sprint Nhỏ (~4-6 giờ) — P1 · P2 · P4

### P1 — Backend sinh mật khẩu ngẫu nhiên khi tạo tài khoản

**Vấn đề hiện tại:**
- `AccountManagerScreen.jsx` dòng 69, 117, 143: hardcode `password: 'tctsdn123'` ở frontend.
- Mật khẩu mặc định lộ nguyên văn trong source code public trên GitHub.

**Mục tiêu:** Backend sinh mật khẩu 10 ký tự ngẫu nhiên mỗi lần tạo/reset, trả về plaintext 1 lần duy nhất để admin copy → gửi cho user.

---

#### P1.A — Thêm hàm `generatePassword()` vào `employees.service.ts`

**File:** `backend/src/employees/employees.service.ts`

Thêm hàm private vào cuối class `EmployeesService` (trước dấu `}`):

```typescript
private generatePassword(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all    = upper + lower + digits;

  // Đảm bảo ít nhất 1 ký tự mỗi loại
  const pick = (src: string) => src[Math.floor(Math.random() * src.length)];
  const rest = Array.from({ length: 7 }, () => pick(all));
  const chars = [pick(upper), pick(lower), pick(digits), ...rest];

  // Shuffle Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
```

---

#### P1.B — Sửa `upsertOne()` để sinh password khi tạo mới

**File:** `backend/src/employees/employees.service.ts`

Sửa method `upsertOne`. Hiện tại method chấp nhận `emp.password` từ ngoài vào — cần tách hai trường hợp: **tạo mới** (backend sinh password) vs **cập nhật** (không đổi password).

Thêm interface trả về và sửa `upsertOne`:

```typescript
// Thêm ở đầu file, sau các import:
export interface UpsertResult {
  employee: Omit<Employee, 'password'>;
  generatedPassword?: string;   // chỉ có khi tạo mới
}
```

Sửa signature và body `upsertOne`:

```typescript
async upsertOne(
  emp: Partial<Employee> & { isApproved?: boolean },
  isNew: boolean = false,
): Promise<UpsertResult> {
  // Bảo vệ superadmin
  if (emp.id === (process.env.HIDDEN_ADMIN_ID ?? 'tctsvip')) {
    emp.role = 'superadmin';
    emp.isApproved = true;
  }

  // ADMIN mới cần phê duyệt
  if (isNew && emp.isApproved === undefined && emp.role === 'ADMIN') {
    (emp as any).isApproved = false;
  }

  let generatedPassword: string | undefined;

  if (isNew) {
    // Backend sinh password — không nhận password từ client
    generatedPassword = this.generatePassword();
    emp.password      = await bcrypt.hash(generatedPassword, 10);
    emp.isFirstLogin  = true;
  } else if (emp.password) {
    // Cập nhật: chỉ hash nếu caller cố tình truyền password (trường hợp hiếm)
    emp.password = await this.hashIfPlain(emp.password);
  }

  const saved = await this.repo.save(emp);
  const { password: _pw, ...employee } = saved;
  return { employee: employee as any, generatedPassword };
}
```

---

#### P1.C — Sửa `employees.controller.ts` — endpoint `POST /api/employees`

**File:** `backend/src/employees/employees.controller.ts`

Sửa action `create` để truyền `isNew = true`:

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin')
async create(@Body() body: any) {
  return this.svc.upsertOne(body, true);   // isNew = true → backend sinh password
}
```

> **Lưu ý:** Action `@Put(':id')` (cập nhật thông tin) giữ nguyên `isNew = false` (mặc định), không truyền tham số thứ hai.

---

#### P1.D — Sửa `replaceAll()` trong `employees.service.ts`

**File:** `backend/src/employees/employees.service.ts`

Hiện tại `replaceAll` nhận `password` từ client (frontend gửi `'tctsdn123'`). Sửa để sinh password ngẫu nhiên cho từng user mới:

```typescript
async replaceAll(list: any[]): Promise<{ list: any[]; passwords: Record<string, string> }> {
  const passwords: Record<string, string> = {};   // id → plaintext password (trả admin 1 lần)

  await this.repo.delete({ role: Not('superadmin') });

  const filtered = list
    .filter(e => e.role !== 'superadmin')
    .map(e => ({
      ...e,
      isApproved: e.isApproved !== undefined ? e.isApproved : (e.role === 'ADMIN' ? false : true),
      isFirstLogin: true,
    }));

  const hashed = await Promise.all(
    filtered.map(async e => {
      const plain = this.generatePassword();
      passwords[e.id] = plain;
      return { ...e, password: await bcrypt.hash(plain, 10) };
    }),
  );

  const saved = await this.repo.save(hashed);
  return {
    list: saved.map(({ password, ...e }) => e as any),
    passwords,   // { 'tctsdn.nguyenvana': 'Kx7mQ2pR4n', ... }
  };
}
```

---

#### P1.E — Sửa `AccountManagerScreen.jsx` — hiển thị password sau khi tạo

**File:** `src/screens/AccountManagerScreen.jsx`

**Thêm state:**
```javascript
const [createdPassword, setCreatedPassword] = useState(null); // { id, password }
```

**Sửa `handleSaveSingle`** — bỏ hardcode password, gọi `POST /api/employees`, đọc `generatedPassword` từ response:

```javascript
const handleSaveSingle = async () => {
  if (!formData.id || !formData.name) {
    window.alert('Lỗi\nVui lòng nhập ID Đăng nhập và Họ tên.');
    return;
  }

  try {
    if (editingEmp) {
      // Cập nhật — KHÔNG gửi password
      const { id, ...updateData } = formData;
      await api.put(`/api/employees/${editingEmp.id}`, {
        ...updateData,
        icaoCode: formData.icaoCode.toUpperCase(),
      });
      // Refresh danh sách
      const res = await api.get('/api/employees');
      setEmployees(res.data.list);
    } else {
      // Tạo mới — backend sinh password
      const res = await api.post('/api/employees', {
        ...formData,
        icaoCode: formData.icaoCode.toUpperCase(),
        position: formData.role === 'CHIEF' ? 'Kíp trưởng' : (formData.role === 'ADMIN' ? 'Lãnh đạo' : 'Kiểm soát viên'),
      });
      const { employee, generatedPassword } = res.data;
      // Cập nhật state local
      setEmployees(prev => [...prev, employee]);
      // Hiện mật khẩu sinh ra để admin copy
      setCreatedPassword({ id: employee.id, password: generatedPassword });
    }
  } catch (err) {
    window.alert('Lỗi\nKhông thể lưu tài khoản. Vui lòng thử lại.');
    return;
  }
  setIsModalOpen(false);
};
```

**Thêm modal hiển thị password** (đặt trước `return` cuối cùng của component):

```jsx
{createdPassword && (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
  }}>
    <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '90%' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
        🔑 Mật khẩu tài khoản mới
      </h3>
      <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
        Tài khoản <strong>{createdPassword.id}</strong> đã được tạo.<br />
        Mật khẩu dưới đây chỉ hiển thị <strong>một lần duy nhất</strong>.
        Vui lòng copy và gửi cho nhân sự ngay.
      </p>
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: 8, padding: '12px 16px',
        fontFamily: 'monospace', fontSize: 22, fontWeight: 700,
        textAlign: 'center', letterSpacing: 4, color: '#15803d',
        marginBottom: 16
      }}>
        {createdPassword.password}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(createdPassword.password);
            window.alert('Đã copy mật khẩu vào clipboard.');
          }}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: '#2563eb', color: '#fff', border: 'none',
            fontWeight: 600, cursor: 'pointer'
          }}
        >
          📋 Copy mật khẩu
        </button>
        <button
          onClick={() => setCreatedPassword(null)}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: '#f3f4f6', color: '#374151', border: 'none',
            fontWeight: 600, cursor: 'pointer'
          }}
        >
          Đã lưu, đóng lại
        </button>
      </div>
    </div>
  </div>
)}
```

---

#### P1.F — Sửa `handleSaveBulk` — hiển thị bảng password CSV

**File:** `src/screens/AccountManagerScreen.jsx`

Thêm state:
```javascript
const [bulkPasswords, setBulkPasswords] = useState(null); // [{ id, name, password }]
```

Sửa `handleSaveBulk` — gọi `PUT /api/employees` (replaceAll), đọc `passwords` từ response:

```javascript
const handleSaveBulk = async () => {
  if (!bulkData.trim()) {
    window.alert('Lỗi\nVui lòng nhập danh sách nhân sự.');
    return;
  }

  const lines = bulkData
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').filter(line => line.trim() !== '');

  const newList = [];
  const errorLines = [];

  lines.forEach((line, index) => {
    const sep = line.includes('\t') ? '\t' : ',';
    const parts = line.split(sep).map(p => p.trim()).filter((_, i) => i < 4);
    if (!parts[0]) { errorLines.push(index + 1); return; }
    const name = parts[0];
    const team = parts[1] || (settings?.teams?.[0] || 'Kíp A');
    const roleInput = (parts[2] || 'STAFF').toUpperCase();
    const role = ['ADMIN', 'CHIEF', 'STAFF'].includes(roleInput) ? roleInput : 'STAFF';
    const icaoCode = (parts[3] || '').toUpperCase();
    const id = generateDefaultId(name);
    if (employees.some(e => e.id === id)) { errorLines.push(index + 1); return; }
    newList.push({
      id, name, team, role, icaoCode,
      position: role === 'CHIEF' ? 'Kíp trưởng' : (role === 'ADMIN' ? 'Lãnh đạo' : 'Kiểm soát viên'),
    });
  });

  if (newList.length === 0) {
    window.alert('Lỗi\nKhông có dòng hợp lệ nào.');
    return;
  }

  try {
    const mergedList = [...employees, ...newList];
    const res = await api.put('/api/employees', { list: mergedList });
    const { list, passwords } = res.data;
    setEmployees(list);

    // Tạo bảng password để admin xem/export
    const pwTable = newList.map(e => ({
      id: e.id, name: e.name, password: passwords[e.id] || '—'
    }));
    setBulkPasswords(pwTable);
  } catch (err) {
    window.alert('Lỗi\nKhông thể lưu danh sách. Vui lòng thử lại.');
  }
  setIsModalOpen(false);
};
```

Thêm modal bảng password bulk (đặt cạnh modal `createdPassword`):

```jsx
{bulkPasswords && (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
  }}>
    <div style={{
      background: '#fff', borderRadius: 12, padding: 28,
      maxWidth: 560, width: '95%', maxHeight: '80vh', overflowY: 'auto'
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
        🔑 Mật khẩu {bulkPasswords.length} tài khoản vừa tạo
      </h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        Danh sách dưới đây chỉ hiển thị <strong>một lần</strong>.
        Nhấn "Export CSV" để lưu và phân phát cho nhân sự.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>ID</th>
            <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Họ tên</th>
            <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace' }}>Mật khẩu</th>
          </tr>
        </thead>
        <tbody>
          {bulkPasswords.map(row => (
            <tr key={row.id}>
              <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{row.id}</td>
              <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{row.name}</td>
              <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontWeight: 600, color: '#15803d' }}>{row.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={() => {
            const csv = 'ID,Họ tên,Mật khẩu\n' +
              bulkPasswords.map(r => `${r.id},${r.name},${r.password}`).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'matkhau_taikhoan.csv'; a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: '#2563eb', color: '#fff', border: 'none',
            fontWeight: 600, cursor: 'pointer'
          }}
        >
          📥 Export CSV
        </button>
        <button
          onClick={() => setBulkPasswords(null)}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            background: '#f3f4f6', color: '#374151', border: 'none',
            fontWeight: 600, cursor: 'pointer'
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
)}
```

---

#### P1.G — Sửa `handleResetPassword` — gọi API reset (sinh password mới)

**File:** `src/screens/AccountManagerScreen.jsx`

Thêm endpoint backend trước. **File:** `backend/src/employees/employees.controller.ts`:

```typescript
@Patch(':id/reset-password')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'superadmin')
async resetPassword(@Param('id') id: string) {
  return this.svc.resetPassword(id);
}
```

**File:** `backend/src/employees/employees.service.ts` — thêm method:

```typescript
async resetPassword(empId: string): Promise<{ generatedPassword: string }> {
  const plain = this.generatePassword();
  const hash  = await bcrypt.hash(plain, 10);
  await this.repo.update(empId, { password: hash, isFirstLogin: true });
  return { generatedPassword: plain };
}
```

**Frontend** — sửa `handleResetPassword` trong `AccountManagerScreen.jsx`:

Tìm đoạn code hiện tại gọi `setConfirmDialog` để reset password. Sửa `onConfirm`:

```javascript
onConfirm: async () => {
  try {
    const res = await api.patch(`/api/employees/${empId}/reset-password`);
    const { generatedPassword } = res.data;
    setCreatedPassword({ id: empId, password: generatedPassword });
    // Không gọi window.alert ở đây — modal createdPassword sẽ hiện
  } catch (err) {
    window.alert('Lỗi\nKhông thể reset mật khẩu. Vui lòng thử lại.');
  }
},
```

---

### P2 — Ownership check khi đổi mật khẩu

**Vấn đề hiện tại:**
- `PATCH /api/employees/:id/password` không kiểm tra ownership — bất kỳ user đã login nào cũng có thể đổi password của người khác bằng cách thay `:id`.

**File:** `backend/src/auth/auth.controller.ts`

Thêm `@Request()` decorator để lấy `req.user`, kiểm tra ownership:

```typescript
import {
  Controller, Post, Body, HttpCode, HttpStatus,
  Patch, Param, UseGuards, Request, ForbiddenException
} from '@nestjs/common';
import { AuthService }       from './auth.service';
import { JwtAuthGuard }      from './jwt-auth.guard';
import { LoginDto }          from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.id, body.password);
  }
}

@Controller('api/employees')
export class PasswordController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Patch(':id/password')
  changePassword(
    @Param('id') id: string,
    @Body() body: ChangePasswordDto,
    @Request() req: any,
  ) {
    // Ownership check: chỉ chính chủ hoặc superadmin được đổi password
    const caller = req.user; // { id, role, name } — từ JwtStrategy.validate()
    if (caller.id !== id && caller.role !== 'superadmin') {
      throw new ForbiddenException('Bạn chỉ được đổi mật khẩu của chính mình.');
    }
    return this.auth.changePassword(id, body.newPassword);
  }
}
```

---

#### P2.B — Nâng chuẩn validation `ChangePasswordDto`

**File:** `backend/src/auth/dto/change-password.dto.ts`

Sửa từ `MinLength(8)` không có regex lên có pattern đủ mạnh:

```typescript
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @MaxLength(200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.',
  })
  newPassword!: string;
}
```

---

### P4 — Chuẩn hoá `LEADER` → `CHIEF`

**Vấn đề hiện tại:**
- Frontend `AccountManagerScreen.jsx`: dùng role `LEADER`.
- Backend `employees.controller.ts` + `roles.guard.ts`: dùng `CHIEF`.
- Kết quả: user được tạo với role `LEADER` không có quyền của kíp trưởng ở backend.

---

#### P4.A — SQL Migration

Chạy trên PostgreSQL trước khi deploy:

```sql
-- Migration: chuẩn hoá role LEADER → CHIEF
UPDATE employees SET role = 'CHIEF' WHERE role = 'LEADER';
```

Lưu vào `backend/migrations/003_normalize_role_leader_to_chief.sql`.

---

#### P4.B — Sửa `AccountManagerScreen.jsx`

**File:** `src/screens/AccountManagerScreen.jsx`

Tìm mảng `roles` (dòng ~28), đổi `LEADER` → `CHIEF`:

```javascript
const roles = [
  { id: 'ADMIN',  label: 'Quản trị viên (Admin)',  color: '#ef4444', bg: '#fef2f2' },
  { id: 'CHIEF',  label: 'Kíp trưởng (Chief)',     color: '#2563eb', bg: '#eff6ff' },
  { id: 'STAFF',  label: 'Nhân viên (Staff)',       color: '#10b981', bg: '#f0fdf4' },
];
```

Tìm tất cả `role === 'LEADER'` và `role === 'CHIEF'` trong file — chuẩn hoá về `'CHIEF'`:
- Dòng 68: `formData.role === 'LEADER'` → `formData.role === 'CHIEF'`
- Dòng 116: `role === 'LEADER'` → `role === 'CHIEF'`
- Dòng 104: `['ADMIN', 'LEADER', 'STAFF']` → `['ADMIN', 'CHIEF', 'STAFF']`
- Kiểm tra toàn file bằng `grep -n "LEADER" src/screens/AccountManagerScreen.jsx` — không được còn dòng nào.

---

#### P4.C — Kiểm tra backend references

```bash
grep -rn "LEADER" backend/src/
```

Nếu còn reference nào trong backend (controller, guard, service) — đổi thành `CHIEF`.

---

## Sprint Trung (~1-2 ngày) — P3 · P5

### P3 — Strong password policy toàn stack

**Vấn đề hiện tại:**
- `LoginScreen.jsx` dòng 80: chỉ check `length < 6` — quá lỏng.
- Backend `ChangePasswordDto`: vừa fix ở P2.B (đã có regex).
- Cần đồng bộ validation rule giữa frontend và backend.

---

#### P3.A — Tạo `src/utils/passwordValidator.js`

```javascript
/**
 * Quy tắc mật khẩu hệ thống quan-ly-ksvkl
 * Áp dụng nhất quán ở cả frontend và backend.
 */
export const PASSWORD_RULES = {
  minLength: 8,
  regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  description: 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số',
};

/**
 * @returns { valid: boolean, message: string }
 */
export function validatePassword(password) {
  if (!password || password.length < PASSWORD_RULES.minLength) {
    return { valid: false, message: `Mật khẩu phải có ít nhất ${PASSWORD_RULES.minLength} ký tự.` };
  }
  if (!PASSWORD_RULES.regex.test(password)) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.' };
  }
  return { valid: true, message: '' };
}
```

---

#### P3.B — Áp dụng vào `LoginScreen.jsx` (FORCE_CHANGE step)

**File:** `src/screens/LoginScreen.jsx`

Thêm import:
```javascript
import { validatePassword } from '../utils/passwordValidator';
```

Sửa `handleSaveSetup`:
```javascript
const handleSaveSetup = async () => {
  const { valid, message } = validatePassword(newPassword);
  if (!valid) { window.alert('Lỗi\n' + message); return; }
  if (newPassword !== confirmPassword) {
    window.alert('Lỗi\nXác nhận mật khẩu không khớp.'); return;
  }
  // ... phần còn lại giữ nguyên
};
```

Sửa placeholder field mật khẩu:
```jsx
<Field
  label="MẬT KHẨU MỚI *"
  icon="lock"
  type="password"
  placeholder="≥8 ký tự, có CHỮ HOA, thường và số"
  value={newPassword}
  onChange={e => setNewPassword(e.target.value)}
/>
```

---

#### P3.C — Áp dụng vào bất kỳ form đổi mật khẩu nào khác

Tìm toàn frontend:
```bash
grep -rn "password\|Password\|mật khẩu" src/ --include="*.jsx" --include="*.js" | grep -i "change\|đổi\|mới"
```

Với mỗi form đổi mật khẩu tìm thấy — import và dùng `validatePassword()`.

---

### P5 — HTTPS cho môi trường dev

**Vấn đề hiện tại:**
- Dev mode: frontend `:5173`, backend `:3000`, plain HTTP — password đi qua mạng không mã hoá.

> ⚠️ Chỉ cần thiết nếu team dev làm việc trên mạng nội bộ chia sẻ (LAN công ty). Nếu chỉ dev trên localhost, rủi ro rất thấp — có thể bỏ qua hoặc làm sau UAT.

---

#### P5.A — Tạo certificate local bằng `mkcert`

```bash
# Cài mkcert (Windows: choco install mkcert, Linux: apt install mkcert)
mkcert -install
mkcert localhost 127.0.0.1

# → tạo ra localhost+1.pem và localhost+1-key.pem
# Đặt 2 file này vào thư mục: certs/ (gitignore thư mục này)
```

---

#### P5.B — Cấu hình Vite HTTPS

**File:** `vite.config.js` (hoặc `vite.config.ts`)

```javascript
import fs from 'fs';
import path from 'path';

export default defineConfig({
  // ... config hiện tại ...
  server: {
    https: {
      key:  fs.readFileSync(path.resolve(__dirname, 'certs/localhost+1-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/localhost+1.pem')),
    },
    port: 5173,
  },
});
```

---

#### P5.C — Cập nhật `.gitignore`

```
# TLS certs local dev
certs/
```

---

## Sprint Dài (~3-5 ngày) — P6

### P6 — Audit Log

**Vấn đề hiện tại:**
- Không có bảng `audit_logs` trong DB.
- Các action quan trọng (login, đổi password, tạo/xoá account, thay đổi role, phê duyệt) không được ghi nhận persistent.

---

#### P6.A — Tạo entity `AuditLog`

**File:** `backend/src/audit/audit-log.entity.ts` (tạo mới thư mục `audit/`):

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ nullable: true }) actorId:      string;   // id người thực hiện
  @Column({ nullable: true }) actorName:    string;   // name người thực hiện
  @Column()                   action:       string;   // LOGIN_SUCCESS | LOGIN_FAIL | CHANGE_PASSWORD | ...
  @Column({ nullable: true }) resourceType: string;   // 'employee' | 'schedule' | 'exchange' | ...
  @Column({ nullable: true }) resourceId:   string;   // id của resource bị tác động
  @Column({ type: 'jsonb', nullable: true }) payload: object;  // dữ liệu bổ sung (không log password)
  @Column({ nullable: true }) ip:           string;
  @Column({ nullable: true }) userAgent:    string;
  @CreateDateColumn()         createdAt:    Date;
}
```

---

#### P6.B — Tạo `AuditService`

**File:** `backend/src/audit/audit.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export type AuditAction =
  | 'LOGIN_SUCCESS' | 'LOGIN_FAIL'
  | 'CHANGE_PASSWORD' | 'RESET_PASSWORD'
  | 'CREATE_EMPLOYEE' | 'UPDATE_EMPLOYEE' | 'DELETE_EMPLOYEE'
  | 'APPROVE_EMPLOYEE' | 'REJECT_EMPLOYEE'
  | 'CHANGE_ROLE';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(entry: {
    actorId?:      string;
    actorName?:    string;
    action:        AuditAction;
    resourceType?: string;
    resourceId?:   string;
    payload?:      object;
    ip?:           string;
    userAgent?:    string;
  }) {
    await this.repo.save(this.repo.create(entry));
  }

  async findAll(limit = 200): Promise<AuditLog[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Cron: xoá log cũ hơn 1 năm (gọi bằng @Cron hoặc schedule job)
  async purgeOldLogs() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    await this.repo.delete({ createdAt: LessThan(cutoff) });
  }
}
```

---

#### P6.C — Tạo `AuditModule`

**File:** `backend/src/audit/audit.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
```

---

#### P6.D — Tạo `AuditController` (endpoint cho UI)

**File:** `backend/src/audit/audit.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { AuditService }    from './audit.service';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  findAll(@Query('limit') limit?: string) {
    return this.svc.findAll(limit ? parseInt(limit) : 200);
  }
}
```

---

#### P6.E — Import AuditModule vào `app.module.ts`

**File:** `backend/src/app.module.ts`

Thêm `AuditModule` vào mảng `imports`:

```typescript
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    // ... các module hiện tại ...
    AuditModule,
  ],
})
export class AppModule {}
```

---

#### P6.F — Thêm log vào `AuthService`

**File:** `backend/src/auth/auth.service.ts`

Inject `AuditService` và log các action:

```typescript
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee)
    private readonly empRepo: Repository<Employee>,
    private readonly jwt:     JwtService,
    private readonly audit:   AuditService,
  ) {}

  async login(id: string, password: string, ip?: string, userAgent?: string) {
    const emp = await this.empRepo.findOne({ where: { id } });

    if (!emp) {
      await this.audit.log({ action: 'LOGIN_FAIL', resourceId: id, payload: { reason: 'not_found' }, ip, userAgent });
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    const valid = await this.verifyPassword(password, emp.password);
    if (!valid) {
      await this.audit.log({ action: 'LOGIN_FAIL', actorId: emp.id, actorName: emp.name, payload: { reason: 'wrong_password' }, ip, userAgent });
      throw new UnauthorizedException('Mật khẩu không chính xác.');
    }

    if (emp.role === 'ADMIN' && !emp.isApproved) {
      await this.audit.log({ action: 'LOGIN_FAIL', actorId: emp.id, actorName: emp.name, payload: { reason: 'not_approved' }, ip, userAgent });
      throw new ForbiddenException('Tài khoản chưa được phê duyệt.');
    }

    await this.audit.log({ action: 'LOGIN_SUCCESS', actorId: emp.id, actorName: emp.name, ip, userAgent });

    const { password: _pw, ...user } = emp;
    const token = this.jwt.sign({ sub: emp.id, role: emp.role, name: emp.name });
    return { token, user };
  }

  async changePassword(empId: string, newPassword: string, actorId?: string, actorName?: string) {
    const hash = await bcrypt.hash(newPassword, 10);
    await this.empRepo.update(empId, { password: hash, isFirstLogin: false });
    await this.audit.log({
      action: 'CHANGE_PASSWORD',
      actorId,
      actorName,
      resourceType: 'employee',
      resourceId: empId,
    });
  }
}
```

**Cập nhật `AuthController`** để truyền `ip` và `actorId` vào `login` và `changePassword`:

```typescript
@Post('login')
@HttpCode(HttpStatus.OK)
login(@Body() body: LoginDto, @Request() req: any) {
  const ip        = req.ip || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'];
  return this.auth.login(body.id, body.password, ip, userAgent);
}

// Trong PasswordController:
@Patch(':id/password')
changePassword(@Param('id') id: string, @Body() body: ChangePasswordDto, @Request() req: any) {
  const caller = req.user;
  if (caller.id !== id && caller.role !== 'superadmin') {
    throw new ForbiddenException('Bạn chỉ được đổi mật khẩu của chính mình.');
  }
  return this.auth.changePassword(id, body.newPassword, caller.id, caller.name);
}
```

---

#### P6.G — Log vào `EmployeesService` (create/update/delete)

**File:** `backend/src/employees/employees.service.ts`

Inject `AuditService` và log các action quan trọng. Thêm vào cuối `upsertOne`:

```typescript
// Sau khi save thành công:
await this.audit.log({
  action: isNew ? 'CREATE_EMPLOYEE' : 'UPDATE_EMPLOYEE',
  resourceType: 'employee',
  resourceId: saved.id,
  payload: { name: saved.name, role: saved.role, team: saved.team },
});
```

Thêm vào `remove`:
```typescript
await this.audit.log({
  action: 'DELETE_EMPLOYEE',
  resourceType: 'employee',
  resourceId: id,
  payload: { name: emp.name, role: emp.role },
});
```

Thêm vào `setApproved`:
```typescript
await this.audit.log({
  action: isApproved ? 'APPROVE_EMPLOYEE' : 'REJECT_EMPLOYEE',
  resourceType: 'employee',
  resourceId: id,
});
```

> **Lưu ý:** `EmployeesService` cần inject `AuditService` — thêm vào constructor và `AuditModule` phải export `AuditService`.

---

#### P6.H — UI Tab "Lịch sử hệ thống" (superadmin only)

**File mới:** `src/screens/AuditLogScreen.jsx`

Component đơn giản — chỉ superadmin thấy:

```jsx
import React, { useEffect, useState } from 'react';
import api from '../services/ApiService';

const ACTION_LABELS = {
  LOGIN_SUCCESS:   { label: 'Đăng nhập',           color: '#10b981' },
  LOGIN_FAIL:      { label: 'Đăng nhập thất bại',  color: '#ef4444' },
  CHANGE_PASSWORD: { label: 'Đổi mật khẩu',        color: '#2563eb' },
  RESET_PASSWORD:  { label: 'Reset mật khẩu',      color: '#f59e0b' },
  CREATE_EMPLOYEE: { label: 'Tạo tài khoản',       color: '#8b5cf6' },
  UPDATE_EMPLOYEE: { label: 'Sửa tài khoản',       color: '#6b7280' },
  DELETE_EMPLOYEE: { label: 'Xoá tài khoản',       color: '#dc2626' },
  APPROVE_EMPLOYEE:{ label: 'Phê duyệt',           color: '#059669' },
  REJECT_EMPLOYEE: { label: 'Từ chối',             color: '#ef4444' },
  CHANGE_ROLE:     { label: 'Đổi quyền',           color: '#d97706' },
};

export default function AuditLogScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/audit?limit=500')
      .then(res => setLogs(res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Đang tải...</div>;

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Lịch sử hệ thống</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Thời gian','Người thực hiện','Hành động','Đối tượng','IP'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: '#6b7280' };
              return (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    {log.actorName || log.actorId || '—'}
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                      background: meta.color + '18', color: meta.color,
                      fontWeight: 600, fontSize: 12,
                    }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ padding: '6px 12px', color: '#374151' }}>
                    {log.resourceType && log.resourceId ? `${log.resourceType}/${log.resourceId}` : '—'}
                  </td>
                  <td style={{ padding: '6px 12px', color: '#9ca3af', fontFamily: 'monospace', fontSize: 12 }}>
                    {log.ip || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Chưa có log nào.</div>
        )}
      </div>
    </div>
  );
}
```

**Tích hợp vào App:** thêm tab "Lịch sử" trong navigation, chỉ render khi `currentUser?.role === 'superadmin'`.

---

#### P6.I — Cron xoá log cũ (optional, cần `@nestjs/schedule`)

**File:** `backend/src/audit/audit.cron.ts`:

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

Thêm `AuditCron` vào `providers` trong `AuditModule`. Thêm `ScheduleModule.forRoot()` vào `AppModule.imports`.

---

## Checklist tổng kết

### Sprint Nhỏ (P1 + P2 + P4)

- [ ] P1.A — Thêm `generatePassword()` vào `employees.service.ts`
- [ ] P1.B — Sửa `upsertOne()` thêm tham số `isNew`, trả về `UpsertResult`
- [ ] P1.C — `POST /api/employees` truyền `isNew = true`
- [ ] P1.D — `replaceAll()` sinh password ngẫu nhiên, trả về `passwords` map
- [ ] P1.E — `handleSaveSingle` frontend gọi API, hiện modal password
- [ ] P1.F — `handleSaveBulk` frontend đọc `passwords`, hiện bảng + Export CSV
- [ ] P1.G — `PATCH /:id/reset-password` endpoint + frontend modal
- [ ] P2.A — Ownership check `PATCH /:id/password` bằng `req.user.id`
- [ ] P2.B — `ChangePasswordDto` thêm `@Matches` regex chữ hoa/thường/số
- [ ] P4.A — SQL migration `LEADER` → `CHIEF`
- [ ] P4.B — Frontend `AccountManagerScreen`: đổi toàn bộ `LEADER` → `CHIEF`
- [ ] P4.C — Scan backend còn `LEADER` không, đổi nếu có
- [ ] **Verify:** `grep -rn "LEADER\|tctsdn123" src/ backend/src/` → phải ra 0 kết quả

### Sprint Trung (P3 + P5)

- [ ] P3.A — Tạo `src/utils/passwordValidator.js`
- [ ] P3.B — `LoginScreen` FORCE_CHANGE dùng `validatePassword()`
- [ ] P3.C — Scan toàn frontend, áp dụng `validatePassword()` ở form đổi password nào còn lại
- [ ] P5.A/B/C — `mkcert` + Vite HTTPS (nếu cần)

### Sprint Dài (P6)

- [ ] P6.A — Tạo entity `AuditLog`
- [ ] P6.B — Tạo `AuditService`
- [ ] P6.C — Tạo `AuditModule`
- [ ] P6.D — Tạo `AuditController` (`GET /api/audit`, superadmin only)
- [ ] P6.E — Import `AuditModule` vào `AppModule`
- [ ] P6.F — `AuthService` log LOGIN_SUCCESS, LOGIN_FAIL, CHANGE_PASSWORD
- [ ] P6.G — `EmployeesService` log CREATE/UPDATE/DELETE/APPROVE/REJECT
- [ ] P6.H — `AuditLogScreen.jsx` + tích hợp navigation (superadmin only)
- [ ] P6.I — `AuditCron` xoá log > 1 năm (optional)

---

## Lưu ý cuối

**Thứ tự deploy:**
1. Chạy migration SQL (P4.A) trên DB production trước.
2. Deploy backend (có P1.B, P1.C, P1.D, P1.G, P2.A, P2.B, P6 entities) — TypeORM `synchronize: true` sẽ tự tạo bảng `audit_logs`.
3. Deploy frontend.

**Không cần migration cho `audit_logs`** nếu backend dùng `synchronize: true` — TypeORM tự tạo bảng mới. Nếu `synchronize: false` (production tốt hơn), tạo thêm:

```sql
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    varchar,
  actor_name  varchar,
  action      varchar NOT NULL,
  resource_type varchar,
  resource_id varchar,
  payload     jsonb,
  ip          varchar,
  user_agent  varchar,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor_id   ON audit_logs(actor_id);
```
