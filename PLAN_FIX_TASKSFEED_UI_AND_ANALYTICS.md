# PLAN_FIX_TASKSFEED_UI_AND_ANALYTICS

> **Phạm vi:** 2 phần độc lập, làm theo thứ tự.
>
> **Cách dùng trong Claude VSCode:**
> *"Đọc PLAN_FIX_TASKSFEED_UI_AND_ANALYTICS.md. Làm tuần tự Phần 1 → Phần 2.
> Xem file trước khi sửa. Không sửa file nào ngoài danh sách."*

---

## Phần 1 — Fix UI tab "Bảng tin Nhiệm vụ" trong AnalyticsScreen

### Chẩn đoán lỗi từ ảnh chụp

Ảnh cho thấy khi chọn tab "Bảng tin Nhiệm vụ", nội dung hiển thị nhưng **bị thu gọn trong
một vùng nhỏ ở giữa** thay vì chiếm toàn bộ panel phải. Có 2 nguyên nhân gốc rễ:

**Nguyên nhân 1 — Wrapper thiếu `minHeight`:**
Tab content container `<div style={{ backgroundColor: '#f8fafc' }}>` (dòng ~2905) không có
`minHeight`. Các tab khác (`ComplianceTab`, `FairnessTab`...) tự phình ra vì có bảng/chart
có chiều cao cố định. `TasksFeedTab` bắt đầu với danh sách rỗng → container xẹp xuống ~0px.

**Nguyên nhân 2 — `TasksFeedTab` dùng `padding: 16` thay vì fill parent:**
```javascript
// Hiện tại trong taskStyles.container:
container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 }
```
`flex: 1` không hoạt động khi parent là `display: block` (không phải flex container).
`TasksFeedTab` render `<div style={{ position: 'relative', backgroundColor: '#f1f5f9', padding: 16 }}>` —
thiếu `minHeight` và thiếu `width: '100%'`.

**Nguyên nhân 3 — Sidebar AnalyticsScreen dùng `overflow: hidden` trên contentArea:**
Phần layout chính dùng sticky sidebar — `contentArea` có thể đang clip nội dung của `TasksFeedTab`.

---

### Bước 1.A — Fix wrapper tab content trong `AnalyticsScreen.jsx`

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm đoạn render tab content (dòng ~2905):

```jsx
{/* Tab content */}
<div style={{ backgroundColor: '#f8fafc' }}>
  {tab === 'compliance'     && <ComplianceTab />}
  ...
  {tab === 'tasks_feed'     && <TasksFeedTab />}
</div>
```

Sửa wrapper để fill toàn bộ chiều cao panel phải:

```jsx
{/* Tab content */}
<div style={{
  backgroundColor: '#f8fafc',
  minHeight: 'calc(100vh - 120px)',   // đảm bảo luôn có chiều cao tối thiểu
  width: '100%',
}}>
  {tab === 'compliance'     && <ComplianceTab />}
  {tab === 'fairness'       && <FairnessTab />}
  {tab === 'qualifications' && <QualificationsTab />}
  {tab === 'optimizer'      && <OptimizerTab employees={employees} />}
  {tab === 'spi'            && <SpiDashboardTab />}
  {tab === 'checklist'      && <ChecklistTab />}
  {tab === 'fatigue'        && <FatigueReportTab currentUser={currentUser} />}
  {tab === 'exchange'       && <ShiftExchangeTab currentUser={currentUser} />}
  {tab === 'briefing'       && <ShiftBriefingTab currentUser={currentUser} />}
  {tab === 'handover'       && <WestHandoverTab currentUser={currentUser} />}
  {tab === 'tasks_feed'     && <TasksFeedTab />}
</div>
```

---

### Bước 1.B — Fix root container của `TasksFeedTab`

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm phần `return` của `TasksFeedTab` (dòng ~2543):

```jsx
// Hiện tại:
return (
  <div style={{ position: 'relative', backgroundColor: '#f1f5f9', padding: 16 }}>
```

Sửa:

```jsx
return (
  <div style={{
    position: 'relative',
    backgroundColor: '#f1f5f9',
    padding: 16,
    minHeight: 'calc(100vh - 120px)',  // fill toàn bộ panel
    width: '100%',
    boxSizing: 'border-box',
  }}>
```

---

### Bước 1.C — Fix `taskStyles.container` (dùng ở chỗ khác trong cùng file)

**File:** `src/screens/AnalyticsScreen.jsx`

Tìm `taskStyles.container` (dòng ~2119):

```javascript
// Hiện tại:
container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },

// Sửa thành:
container: {
  backgroundColor: '#f1f5f9',
  padding: 16,
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 'calc(100vh - 120px)',
},
```

---

### Bước 1.D — Fix `FloatingToast` — `position: absolute` bị clip

**File:** `src/screens/AnalyticsScreen.jsx`

`FloatingToast` dùng `position: absolute` (trong `taskStyles.toastContainer`) — khi parent
không có `position: relative` đúng nghĩa, toast có thể bị ẩn. Đã có `position: 'relative'`
trên root div ở bước 1.B — chỉ cần đảm bảo `zIndex` đủ cao:

```javascript
// taskStyles.toastContainer — sửa zIndex:
toastContainer: {
  position: 'fixed',                 // đổi từ 'absolute' → 'fixed'
  top: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  padding: '12px 20px',
  borderRadius: 8,
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  borderLeft: '4px solid #10b981',
  zIndex: 9999,                      // cao hơn Modal (thường là 1000)
},
```

> **Lý do dùng `fixed` thay `absolute`:** Sidebar AnalyticsScreen có thể có
> `overflow: hidden` → toast `absolute` bị clip. `fixed` luôn hiển thị đúng.

---

### Bước 1.E — Kiểm tra `Modal` component — z-index conflict

**File:** `src/screens/AnalyticsScreen.jsx`

`TasksFeedTab` dùng `<Modal visible={!!viewingTask} maxWidth="860px">` và
`<Modal visible={confirmDialog.visible} maxWidth="400px" zIndex={10001}>`.

Kiểm tra `src/components/Modal.jsx` — nếu Modal render với `position: fixed` và
`zIndex` thấp hơn sidebar overlay, modal sẽ bị che. Sửa nếu cần:

```jsx
// Trong Modal.jsx — backdrop style:
style={{
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  zIndex: zIndex || 9000,       // dùng prop zIndex nếu truyền vào
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}}
```

---

### Bước 1.F — Thêm trạng thái empty state khi tasks = []

**File:** `src/screens/AnalyticsScreen.jsx`

Khi danh sách `filteredTasks` rỗng, hiện tại có thể đang render empty state nhưng
thiếu `minHeight` → tab trông như bị vỡ. Tìm đoạn render empty state trong `TasksFeedTab`:

```jsx
// Đảm bảo empty state có chiều cao đủ để dễ nhìn:
{filteredTasks.length === 0 && (
  <div style={{
    ...taskStyles.emptyState,
    minHeight: 400,                    // thêm minHeight
    justifyContent: 'center',
  }}>
    <div style={taskStyles.emptyIconWrap}>
      <Icon name="inbox" size={32} color="#94a3b8" />
    </div>
    <span style={taskStyles.emptyTitle}>Không có bài đăng nào</span>
    <span style={taskStyles.emptyText}>
      {filter === 'ALL'
        ? 'Chưa có nhiệm vụ hoặc thông báo nào được tạo.'
        : 'Không có bài đăng nào thuộc loại này.'}
    </span>
  </div>
)}
```

---

### Checklist Phần 1

- [ ] 1.A — Tab content wrapper: thêm `minHeight: 'calc(100vh - 120px)'` + `width: '100%'`
- [ ] 1.B — Root div `TasksFeedTab`: thêm `minHeight` + `width: '100%'` + `boxSizing`
- [ ] 1.C — `taskStyles.container`: đổi `flex: 1` → `width: '100%'` + `minHeight`
- [ ] 1.D — `taskStyles.toastContainer`: đổi `position: 'absolute'` → `'fixed'`, tăng `zIndex: 9999`
- [ ] 1.E — Kiểm tra `Modal.jsx` — backdrop `zIndex` đủ cao, `position: fixed`
- [ ] 1.F — Empty state: thêm `minHeight: 400` + `justifyContent: 'center'`
- [ ] **Verify:** Chọn tab "Bảng tin Nhiệm vụ" → panel phải fill toàn bộ chiều cao, không bị thu nhỏ
- [ ] **Verify:** Tạo bài đăng mới → modal hiển thị đúng, không bị che bởi sidebar
- [ ] **Verify:** Toast "Tạo thành công" hiện ở giữa màn hình, không bị clip

---

## Phần 2 — Rà soát và fix Analytics Server (FastAPI)

### Tổng quan kiến trúc

```
Frontend (Vite :5173)
        │
        ├── API calls → NestJS (:3000)   [CRUD: employees, shifts, tasks, settings]
        │
        └── Analytics calls → FastAPI (:8001)   [READ-ONLY: compliance, fairness, ratings...]
                                    │
                                    └── Đọc trực tiếp PostgreSQL (cùng DB với NestJS)
```

> **Port analytics:** Code frontend dùng `:8001` (xem `apiErr` message trong `AnalyticsScreen.jsx`),
> nhưng `dev.bat` khởi động ở `--port 8000`. **Đây là bug #1.**

---

### Bug đã xác định

| # | Vị trí | Mô tả | Mức độ |
|---|---|---|---|
| B1 | `dev.bat` / `package.json` | Server khởi động ở `:8000`, frontend gọi `:8001` | 🔴 Critical — mọi analytics call đều 404 |
| B2 | `analytics/.env` | Không tồn tại → `Settings()` dùng default `postgres:postgres@localhost:5432/atc_pro` — có thể sai DB name/pass | 🔴 Critical — không kết nối được DB |
| B3 | `backend/.env` | Không tồn tại trong repo — `DATABASE_URL` chưa được set | 🔴 Critical — NestJS cũng không có DB |
| B4 | `main.py` CORS | Chỉ allow `:5173` và `:3000`, thiếu `:8001` (analytics tự gọi lại) | 🟡 Medium |
| B5 | `database.py` | `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` — psycopg3 dùng `execute()` nhưng connection-level command cần `autocommit=True` trước | 🔴 Critical — session bị lỗi ngay khi khởi tạo |
| B6 | `models.py` | `ScheduleModel` ánh xạ bảng `schedules` nhưng `repository.py` không import `ScheduleModel` → có thể gây `ImportError` khi khởi động | 🟡 Medium |
| B7 | `dev.bat` | Không `cd` vào thư mục `analytics` trước khi chạy — nếu gọi từ root, Python không tìm thấy module `app.main` | 🔴 Critical — `ModuleNotFoundError` |
| B8 | `package.json` root | `"dev:fast": "cd analytics && dev.bat"` — `cd` trong cmd shell không persist sang lệnh tiếp theo trên Windows | 🔴 Critical — uvicorn chạy ở thư mục sai |

---

### Bước 2.A — Tạo file `.env` mẫu cho analytics

**File mới:** `analytics/.env.example`

```env
# Analytics FastAPI Service — copy sang .env và điền giá trị thật
# DATABASE_URL phải trỏ đến cùng DB với NestJS backend

DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/atc_pro
```

**File mới:** `analytics/.env` (tạo thật, KHÔNG commit — đã có trong .gitignore)

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/atc_pro
```

> **Lấy password từ đâu:** Xem `backend/.env` — tìm `DATABASE_URL` hoặc `DB_PASSWORD`.
> Hai service phải kết nối cùng 1 database.

Thêm vào `.gitignore` nếu chưa có:
```
analytics/.env
backend/.env
```

---

### Bước 2.B — Fix `database.py` — lỗi read-only session (B5)

**File:** `analytics/app/data/database.py`

Vấn đề: psycopg3 với `autocommit=False` (mặc định) không cho phép chạy `SET SESSION CHARACTERISTICS` nằm ngoài transaction. Cần set read-only **sau khi** có connection đúng cách:

```python
"""
database.py
===========
SQLAlchemy engine + session — CHỈ ĐỌC.
"""

import re
from functools import lru_cache

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import Settings


def _normalize_url(raw: str) -> str:
    """Chuyển URL kiểu Prisma/NestJS sang psycopg3 driver."""
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+psycopg://", raw)
    return url


@lru_cache(maxsize=1)
def get_engine():
    cfg = Settings()
    url = _normalize_url(cfg.database_url)
    engine = create_engine(
        url,
        pool_pre_ping=True,
        echo=False,
        connect_args={"options": "-c default_transaction_read_only=on"},
        # ↑ Dùng PostgreSQL GUC thay vì SET SESSION — an toàn hơn với psycopg3
    )
    return engine


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=None)


def get_session():
    engine = get_engine()
    SessionLocal.configure(bind=engine)
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


class Base(DeclarativeBase):
    pass
```

> **Giải thích:** `connect_args={"options": "-c default_transaction_read_only=on"}` là
> PostgreSQL GUC (Grand Unified Configuration) — set ở level connection string, không cần
> chạy lệnh SQL riêng. Psycopg3 hỗ trợ trực tiếp, không có vấn đề autocommit.

---

### Bước 2.C — Fix port — thống nhất `:8001` toàn stack (B1)

**Kiểm tra port frontend dùng:**

```bash
grep -rn "8000\|8001\|analytics" src/ --include="*.jsx" --include="*.js" --include="*.ts" | grep -v node_modules
```

**Quyết định:** Dùng `:8001` thống nhất (tránh đụng với các tool khác thường dùng `:8000`).

**File:** `analytics/dev.bat` — sửa port:

```bat
@echo off
if exist ".venv\Scripts\uvicorn.exe" (
    echo [FAST] Starting FastAPI Analytics on port 8001...
    .venv\Scripts\uvicorn app.main:app --reload --port 8001 --host 127.0.0.1
) else (
    echo [FAST] ERROR: .venv not found in analytics/
    echo [FAST] Setup once with:
    echo [FAST]   cd analytics
    echo [FAST]   python -m venv .venv
    echo [FAST]   .venv\Scripts\pip install -r requirements.txt
    exit /b 1
)
```

**File:** `analytics/dev.sh` — sửa port:

```bash
#!/bin/bash
set -e
if [ -f ".venv/bin/uvicorn" ]; then
    echo "[FAST] Starting FastAPI Analytics on port 8001..."
    .venv/bin/uvicorn app.main:app --reload --port 8001 --host 127.0.0.1
else
    echo "[FAST] ERROR: .venv not found in analytics/"
    echo "[FAST] Setup once with:"
    echo "[FAST]   cd analytics && python -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
fi
```

---

### Bước 2.D — Fix `package.json` root — Windows `cd` không persist (B7, B8)

**File:** `package.json` (root)

Vấn đề: `"cd analytics && dev.bat"` trên Windows — `cd` chỉ đổi thư mục trong subshell,
khi chạy `dev.bat` thì working directory vẫn là root → uvicorn không tìm thấy `app.main`.

Sửa `dev:fast`:

```json
"scripts": {
  "dev":              "concurrently --names \"FRONT,NEST,FAST\" --prefix-colors \"cyan,yellow,magenta\" \"npm run dev:front\" \"npm run dev:nest\" \"npm run dev:fast\"",
  "dev:front":        "vite",
  "dev:nest":         "npm --prefix backend run start:dev",
  "dev:fast":         "cd analytics && npm run start",
  "dev:no-analytics": "concurrently --names \"FRONT,NEST\" --prefix-colors \"cyan,yellow\" \"npm run dev:front\" \"npm run dev:nest\"",
  "reset-superadmin": "npm --prefix backend run reset-superadmin",
  "build":            "vite build",
  "preview":          "vite preview"
}
```

**File mới:** `analytics/package.json` (tạo mới — npm sẽ dùng file này khi gọi `npm run start`):

```json
{
  "name": "ksvkl-analytics",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node -e \"require('child_process').execSync(process.platform==='win32'?'dev.bat':'bash dev.sh',{stdio:'inherit',shell:true})\""
  }
}
```

> **Tại sao dùng `npm --prefix analytics run start`?** Lệnh `npm --prefix` tự động
> `cd` vào thư mục đó trước khi chạy script → uvicorn chạy đúng working directory,
> Python tìm thấy `app/main.py`.

---

### Bước 2.E — Fix CORS trong `main.py` (B4)

**File:** `analytics/app/main.py`

Sửa `allow_origins` — thêm port `:8001` (analytics tự gọi nếu cần) và `*` cho dev:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Bước 2.F — Thêm startup health-check log vào `main.py`

**File:** `analytics/app/main.py`

Thêm vào cuối file — log rõ khi server sẵn sàng và khi DB không kết nối được:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text as sql_text

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Chạy khi startup — kiểm tra kết nối DB và log rõ ràng."""
    from app.data.database import get_engine
    print("\n" + "═" * 60)
    print("  KSVKL Analytics Service đang khởi động...")
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(sql_text("SELECT current_database(), current_user"))
            db_name, db_user = result.fetchone()
        print(f"  ✓ Kết nối DB thành công: database={db_name}, user={db_user}")
        print(f"  ✓ Server sẵn sàng tại: http://127.0.0.1:8001")
        print(f"  ✓ Docs: http://127.0.0.1:8001/docs")
    except Exception as e:
        print(f"  ✗ KHÔNG kết nối được DB: {e}")
        print(f"  → Kiểm tra DATABASE_URL trong analytics/.env")
        print(f"  → Server vẫn khởi động nhưng mọi API call sẽ lỗi 500")
    print("═" * 60 + "\n")
    yield
    print("\n[Analytics] Server đã dừng.")


# Sửa khởi tạo app — thêm lifespan:
app = FastAPI(
    title="KSVKL Analytics",
    version="1.0.0",
    description="Analytics read-only service cho hệ thống quản lý KSVKL.",
    lifespan=lifespan,
)
```

> **Lưu ý:** Nếu đã có `app = FastAPI(...)` ở trên, thêm `lifespan=lifespan` vào và
> di chuyển function `lifespan` lên trước dòng `app = FastAPI(...)`.

---

### Bước 2.G — Tạo `analytics/.env` từ thông tin backend

Sau khi có backend `.env`, chạy lệnh này để tạo analytics `.env` tự động:

```bash
# Lấy DATABASE_URL từ backend (nếu backend dùng biến khác tên):
# Ví dụ nếu backend .env có: DB_HOST=localhost, DB_PORT=5432, DB_NAME=atc_pro, DB_USER=postgres, DB_PASS=secret

# Tạo analytics/.env:
echo "DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/atc_pro" > analytics/.env
```

Kiểm tra kết nối thủ công trước khi chạy server:

```bash
cd analytics
.venv/Scripts/python -c "
from app.core.config import Settings
from app.data.database import get_engine
from sqlalchemy import text
cfg = Settings()
print('DATABASE_URL:', cfg.database_url[:40], '...')
with get_engine().connect() as c:
    print('DB:', c.execute(text('SELECT current_database()')).scalar())
    print('Kết nối OK!')
"
```

---

### Bước 2.H — Fix `frontend` ApiService — đảm bảo gọi đúng `:8001`

**File:** `src/services/ApiService.jsx` hoặc nơi gọi analytics API

Tìm base URL của analytics API. Nếu dùng biến môi trường:

```javascript
// Tạo file .env ở root frontend (nếu chưa có):
// VITE_ANALYTICS_URL=http://127.0.0.1:8001

// Trong ApiService:
const ANALYTICS_BASE = import.meta.env.VITE_ANALYTICS_URL || 'http://127.0.0.1:8001';
```

Nếu hardcode — tìm tất cả chỗ gọi analytics và đổi port:

```bash
grep -rn "8000\|localhost:8001\|127.0.0.1:8001" src/ --include="*.jsx" --include="*.js"
```

Đảm bảo mọi analytics call dùng `:8001`, không phải `:8000`.

---

### Bước 2.I — Tạo `backend/.env` và `backend/.env.example`

**File mới:** `backend/.env.example`

```env
# NestJS Backend — copy sang .env và điền giá trị thật

# PostgreSQL
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/atc_pro

# JWT
JWT_SECRET=change-this-to-a-long-random-string-at-least-32-chars
JWT_EXPIRES_IN=24h

# App
PORT=3000
NODE_ENV=development

# Superadmin
HIDDEN_ADMIN_ID=tctsvip
```

> **Lưu ý:** `backend/.env` phải được tạo thủ công và không commit lên git.

---

### Bước 2.J — Kiểm tra `requirements.txt` — đủ dependencies

**File:** `analytics/requirements.txt`

Đảm bảo có đủ:

```
fastapi>=0.111
uvicorn[standard]>=0.29
sqlalchemy>=2.0
psycopg[binary]>=3.1
pydantic>=2
pydantic-settings>=2
pandas>=2.0
pytest>=8
httpx>=0.27
ortools>=9.10
python-dotenv>=1.0   # ← thêm nếu chưa có — cần cho pydantic-settings đọc .env
```

Cài lại sau khi thêm:

```bash
cd analytics
.venv/Scripts/pip install -r requirements.txt
```

---

### Thứ tự thực hiện Phần 2

```
2.A — Tạo analytics/.env với DATABASE_URL đúng      ← làm đầu tiên
2.I — Tạo backend/.env với đầy đủ biến              ← làm song song
2.B — Fix database.py (read-only session)
2.C — Fix port 8000 → 8001 trong dev.bat + dev.sh
2.D — Fix package.json root + tạo analytics/package.json
2.E — Fix CORS trong main.py
2.F — Thêm lifespan startup health-check
2.G — Test kết nối DB thủ công trước khi chạy
2.H — Kiểm tra frontend ApiService gọi đúng :8001
2.J — Kiểm tra requirements.txt + cài python-dotenv
```

---

### Checklist Phần 2

**Config & Môi trường:**
- [ ] 2.A — Tạo `analytics/.env` với `DATABASE_URL` đúng (cùng DB với NestJS)
- [ ] 2.I — Tạo `backend/.env` với `DATABASE_URL`, `JWT_SECRET`, `PORT`
- [ ] 2.J — Thêm `python-dotenv` vào `requirements.txt`, cài lại pip

**Code fixes:**
- [ ] 2.B — `database.py`: đổi `SET SESSION` → `connect_args options GUC`
- [ ] 2.C — `dev.bat` + `dev.sh`: đổi `--port 8000` → `--port 8001`
- [ ] 2.D — `package.json` root: sửa `dev:fast`; tạo `analytics/package.json`
- [ ] 2.E — `main.py`: thêm `:8001` vào `allow_origins`
- [ ] 2.F — `main.py`: thêm `lifespan` startup health-check
- [ ] 2.H — `ApiService`: đảm bảo analytics URL dùng `:8001`

**Verify:**
- [ ] `cd analytics && .venv/Scripts/python -c "from app.data.database import get_engine; ..."` → in "Kết nối OK!"
- [ ] `npm run dev` → terminal in `[FAST] Starting FastAPI Analytics on port 8001...`
- [ ] Terminal analytics in `✓ Kết nối DB thành công: database=atc_pro`
- [ ] Mở `http://127.0.0.1:8001/docs` → Swagger UI hiển thị đầy đủ 7 router
- [ ] Mở `http://127.0.0.1:8001/health` → `{"status": "ok"}`
- [ ] Vào tab "Tuân thủ" trong AnalyticsScreen → không còn lỗi "Không thể kết nối Analytics Service"
- [ ] Vào tab "Công bằng" → dữ liệu load về từ DB thật
