# Đặc tả dịch vụ phân tích Python — Dự án quan-ly-ksvkl

> **Mục đích tài liệu:** Đặc tả để AI coding assistant (Claude trong VSCode) xây dựng và bổ sung **dịch vụ phân tích Python** cho hệ thống quản lý Kiểm Soát Viên Không Lưu (KSVKL). Dịch vụ này là một thành phần *bổ trợ* cho backend NestJS đã có, chuyên xử lý các tác vụ tính toán nặng về dữ liệu: kiểm tra tuân thủ nghỉ ngơi, phân tích công bằng, quản lý năng định, dự báo tải, và tối ưu hóa phân ca.
>
> Hãy đọc toàn bộ tài liệu trước khi bắt đầu. Triển khai theo từng phase, đúng thứ tự. Sau mỗi phase, đối chiếu với "Tiêu chí hoàn thành" của phase đó.

---

## ⚠️ Lưu ý an toàn (đọc trước tiên)

Đây là hệ thống phục vụ ngành hàng không. Mọi tính năng liên quan đến thời gian nghỉ ngơi, mệt mỏi (fatigue), và năng định đều liên quan trực tiếp đến **an toàn bay**. Bắt buộc tuân thủ:

1. **Mọi ngưỡng quy định CHỈ LÀ GIÁ TRỊ VÍ DỤ** trong mã nguồn. Phải để cấu hình được (đọc từ DB hoặc file config), và thay bằng số liệu chính thức từ **VATM/CAAV và ICAO** trước khi dùng thật.
2. **Dịch vụ này HỖ TRỢ ra quyết định, KHÔNG thay thế** quy trình phê duyệt chính thức. Người phụ trách vẫn chịu trách nhiệm cuối cùng.
3. **Dịch vụ truy cập cơ sở dữ liệu ở chế độ CHỈ ĐỌC.** Mọi thao tác ghi (tạo/sửa/xóa ca trực, người dùng) là độc quyền của backend NestJS + TypeORM. Python không bao giờ ghi vào DB nghiệp vụ.
4. Schema cơ sở dữ liệu do **TypeORM/migration.sql (phía NestJS) sở hữu và quản lý**. Python chỉ *ánh xạ để đọc* các bảng đã tồn tại, tuyệt đối không chạy migration từ phía Python.

---

## 1. Sơ đồ kiến trúc tổng thể

```mermaid
flowchart TB
    User([Người dùng - KSVKL / Lãnh đạo])
    React["React Frontend<br/>(giao diện)"]
    Nest["NestJS Backend<br/>nghiệp vụ + auth + CRUD"]
    PG[("PostgreSQL<br/>schema do TypeORM quản lý")]
    Py["Python Analytics Service<br/>FastAPI"]

    User --> React
    React -->|"HTTPS /api/*"| Nest
    Nest -->|"đọc + ghi"| PG
    Nest -->|"gọi phân tích<br/>HTTP nội bộ /analytics/*"| Py
    Py -.->|"CHỈ ĐỌC"| PG
    Py -->|"kết quả JSON"| Nest
    Nest -->|"trả kết quả"| React
```

**Luồng điển hình:** Người dùng bấm "Kiểm tra lịch trực" trên React → NestJS xác thực và nhận yêu cầu → NestJS gọi sang Python service qua HTTP nội bộ (mạng Docker, không lộ ra ngoài) → Python đọc dữ liệu ca trực trực tiếp từ PostgreSQL, chạy phân tích → trả JSON về NestJS → NestJS trả về React để hiển thị (ví dụ tô đỏ các ca vi phạm).

**Vì sao Python đọc DB trực tiếp thay vì NestJS gửi dữ liệu sang?** Với các tác vụ phân tích trên khối lượng lớn (cả tháng/quý lịch trực), đọc trực tiếp từ DB hiệu quả hơn nhiều so với truyền dữ liệu lớn qua HTTP. NestJS chỉ gửi *tham số* (khoảng thời gian, ID đơn vị...), Python tự truy vấn.

---

## 2. Sơ đồ lộ trình các phase

```mermaid
flowchart LR
    P1["Phase 1<br/>Tuân thủ nghỉ ngơi<br/>+ Phân tích công bằng<br/>+ Lớp đọc DB"]
    P2["Phase 2<br/>Quản lý năng định<br/>+ Cảnh báo hết hạn"]
    P3["Phase 3<br/>Dự báo tải<br/>công việc theo mùa"]
    P4["Phase 4<br/>Tối ưu hóa<br/>phân ca tự động"]

    P1 --> P2 --> P3 --> P4

    P1 -.- N1["pandas + SQLAlchemy<br/>Giá trị cao, rủi ro thấp"]
    P2 -.- N2["pandas<br/>Cần bảng năng định"]
    P3 -.- N3["Prophet / scikit-learn<br/>Cần dữ liệu lịch sử"]
    P4 -.- N4["OR-Tools<br/>Khó nhất, làm sau cùng"]
```

Nguyên tắc: **làm xong và kiểm thử trọn vẹn một phase trước khi sang phase tiếp theo.** Mỗi phase đều tạo ra giá trị sử dụng được ngay, không cần đợi phase sau.

---

## 3. Sơ đồ cấu trúc nội bộ dịch vụ

```mermaid
flowchart TB
    subgraph API["Tầng API (FastAPI)"]
        R["routers/<br/>compliance, fairness,<br/>ratings, forecast, optimize"]
    end
    subgraph Core["Tầng nghiệp vụ (thuần Python, dễ test)"]
        COMP["compliance/<br/>rest_compliance.py"]
        FAIR["fairness/"]
        RAT["ratings/"]
        FC["forecast/"]
        OPT["optimize/"]
    end
    subgraph Data["Tầng dữ liệu (chỉ đọc)"]
        REPO["repository.py"]
        MODELS["models.py"]
        DBASE["database.py"]
    end

    R --> COMP & FAIR & RAT & FC & OPT
    COMP & FAIR & RAT & FC & OPT --> REPO
    REPO --> MODELS --> DBASE
    DBASE -.->|"chỉ đọc"| PG[("PostgreSQL")]
```

**Nguyên tắc phân tầng quan trọng:** tầng nghiệp vụ (Core) là Python thuần, nhận vào các đối tượng dữ liệu (dataclass) và trả ra kết quả — *không* biết gì về database hay HTTP. Nhờ vậy nó dễ kiểm thử bằng dữ liệu giả mà không cần DB thật. Tầng API và tầng dữ liệu chỉ là "vỏ bọc" xung quanh.

---

## 4. Bộ công nghệ

| Hạng mục | Công nghệ | Dùng từ phase |
|---|---|---|
| Ngôn ngữ | Python ≥ 3.11 | 1 |
| Web framework | FastAPI | 1 |
| ASGI server | uvicorn | 1 |
| Truy cập DB | SQLAlchemy 2.x (ORM, chỉ đọc) | 1 |
| Driver PostgreSQL | psycopg (v3) | 1 |
| Validation I/O | Pydantic v2 | 1 |
| Phân tích dữ liệu | pandas | 1 |
| Cấu hình | pydantic-settings (đọc `.env`) | 1 |
| Test | pytest | 1 |
| Dự báo chuỗi thời gian | Prophet hoặc scikit-learn | 3 |
| Tối ưu hóa ràng buộc | OR-Tools (ortools) | 4 |

`requirements.txt` (cập nhật dần theo phase):
```
fastapi
uvicorn[standard]
sqlalchemy>=2.0
psycopg[binary]>=3.1
pydantic>=2
pydantic-settings
pandas
pytest
# Phase 3:
# prophet
# scikit-learn
# Phase 4:
# ortools
```

---

## 5. Cấu trúc thư mục

Dịch vụ Python nằm trong một thư mục riêng, song song với `frontend/` và `backend/`:

```
quan-ly-ksvkl/
├── frontend/                    # React (đã có)
├── backend/                     # NestJS (đã có)
└── analytics/                   # ← DỊCH VỤ PYTHON (xây dựng theo tài liệu này)
    ├── app/
    │   ├── core/
    │   │   ├── config.py         # đọc DATABASE_URL, ngưỡng mặc định từ .env
    │   │   ├── domain.py         # các dataclass: Shift, PositionSession, Position, Qualification, Violation... (dùng chung)
    │   │   └── timezone.py       # xử lý múi giờ
    │   ├── data/
    │   │   ├── database.py       # tạo engine SQLAlchemy, session factory
    │   │   ├── models.py         # ORM models ánh xạ bảng TypeORM (chỉ đọc)
    │   │   └── repository.py     # ShiftRepository, RatingRepository...
    │   ├── compliance/
    │   │   └── rest_compliance.py # ĐÃ XÂY (xem mục 6.1) — copy vào đây
    │   ├── fairness/
    │   │   └── fairness.py        # Phase 1
    │   ├── ratings/
    │   │   └── rating_status.py   # Phase 2
    │   ├── forecast/
    │   │   └── workload_forecast.py # Phase 3
    │   ├── optimize/
    │   │   └── shift_optimizer.py  # Phase 4
    │   ├── routers/
    │   │   ├── compliance.py
    │   │   ├── fairness.py
    │   │   ├── ratings.py
    │   │   ├── forecast.py
    │   │   └── optimize.py
    │   └── main.py                # khởi tạo FastAPI, gắn router, CORS nội bộ
    ├── tests/
    │   ├── conftest.py            # fixture: DB SQLite in-memory để test
    │   ├── test_rest_compliance.py # ĐÃ XÂY (xem mục 6.1)
    │   ├── test_repository.py
    │   ├── test_fairness.py
    │   ├── test_rating_status.py
    │   ├── test_forecast.py
    │   └── test_optimizer.py
    ├── .env.example
    ├── requirements.txt
    ├── Dockerfile
    └── README.md
```

---

## 6. Nguyên tắc chung (áp dụng mọi phase)

### 6.1 — Hai file đã xây sẵn

Module `rest_compliance.py` và bộ test `test_rest_compliance.py` ĐÃ được xây dựng và kiểm thử (46 test pass: 39 compliance + 7 roster review). **Không viết lại từ đầu** — hãy copy chúng vào `app/compliance/rest_compliance.py` và `tests/test_rest_compliance.py`, rồi điều chỉnh đường dẫn import cho khớp cấu trúc thư mục. Module này đã có các dataclass `Shift`, `Position`, `Qualification`, `Violation`, `Severity`, `RestRuleConfig` và lớp `ComplianceChecker` với 9 quy tắc. Các phase sau dùng lại chính các dataclass này (đặt chúng trong `app/core/domain.py` để dùng chung). Module `roster_review.py` (lớp `RosterReviewer`) cũng đã xây — xem mục 7.9.

#### Mô hình ca trực, vị trí & năng định (QUAN TRỌNG — theo quy định đơn vị)

- **Vị trí điều hành** (`Position`): `APP`, `CTL`, `TWR`, `GCU`.
  - `APP` = tiếp cận; `TWR` = đài chỉ huy; `GCU` = kiểm soát mặt đất.
  - `CTL` = điều hành vùng trời **dưới FL245** (tương tự ACC nhưng thuộc đơn vị). Phần **trên FL245** do ACC HCM và ACC HN đảm nhận — **ngoài phạm vi** ứng dụng này.
- **Ca trực chứa nhiều phiên vị trí** (`PositionSession`): trong một ca, KSVKL **có thể luân phiên** nhiều vị trí. Mỗi phiên là một lượt ngồi liên tục tại một vị trí, có `position`, `start`, `end`. `Shift.sessions` là danh sách các phiên.
- **Năng định** (`Qualification`): mỗi KSVKL hoặc có năng định **`full`** (làm được cả 4 vị trí), hoặc chỉ làm được **các vị trí riêng lẻ** được liệt kê (`positions`). `can_work(pos)` = True nếu full, hoặc nếu `pos` thuộc danh sách riêng lẻ.
- Quy tắc **phủ năng định** (`qualification_coverage`, mức CRITICAL): kiểm tra **từng phiên vị trí** — nếu KSVKL đảm nhận một phiên ở vị trí họ không có năng định → vi phạm nghiêm trọng.
- Quy tắc **thời gian ngồi vị trí** (`max_on_position`): trước khi kiểm tra, các **phiên liền kề CÙNG vị trí** (cách nhau <= `merge_adjacent_session_gap_minutes`, mặc định 0) được **gộp** thành một lượt ngồi liên tục; nếu lượt đó vượt ngưỡng phút → cảnh báo. Giải lao đủ dài giữa hai phiên thì không gộp (reset thời gian liên tục).
- Quy tắc **recency theo vị trí** (`position_recency`): gom mọi phiên theo từng vị trí; khoảng cách giữa hai lần đảm nhận *cùng một vị trí* không vượt ngưỡng.

> Đây là mô hình thực tế của đơn vị, KHÔNG phải năng định ICAO chuẩn (ADC/APP/ACC). Mọi phase sau bám theo mô hình này.

### 6.2 — Xử lý múi giờ (quan trọng với ATC)

ATC vận hành theo giờ UTC (Zulu), nhưng lịch trực và khái niệm "ca đêm", "ngày làm việc" lại theo **giờ địa phương**. Quy ước thống nhất:
- PostgreSQL lưu mốc thời gian dạng `timestamptz` (có múi giờ).
- Lớp `repository.py` khi đọc lên sẽ **chuyển sang giờ địa phương** (mặc định `Asia/Ho_Chi_Minh`, để cấu hình được) rồi tạo `datetime` *naive* (không múi giờ) cho tầng nghiệp vụ. Lý do: logic ca đêm/ngày làm việc cần giờ địa phương, và giữ một quy ước duy nhất tránh nhầm lẫn.
- Mọi phép tính trong tầng nghiệp vụ đều dùng datetime naive theo giờ địa phương.

### 6.3 — Ngưỡng đọc từ cấu hình, không "code cứng"

Tất cả ngưỡng (giờ nghỉ, số ca đêm, ngày hết hạn...) phải tập trung trong `RestRuleConfig` / `core/config.py`. Lý tưởng: lưu ngưỡng trong một bảng cấu hình trong DB để người quản trị tự chỉnh. Tối thiểu: đọc từ biến môi trường `.env`. Bộ test phải đọc ngưỡng *động* từ config (như test đã xây), không gán số cứng.

### 6.4 — Định dạng phản hồi API thống nhất

Thành công:
```json
{ "success": true, "data": { ... }, "generated_at": "2026-..." }
```
Lỗi:
```json
{ "success": false, "error": "...", "detail": "..." }
```

### 6.5 — Tầng nghiệp vụ phải độc lập với DB

Mỗi module nghiệp vụ (compliance, fairness, ratings, forecast, optimize) nhận đầu vào là **các đối tượng dataclass hoặc DataFrame**, không tự truy vấn DB. Việc lấy dữ liệu là nhiệm vụ của `repository.py`. Điều này giúp test bằng dữ liệu giả dễ dàng.

---

## 7. PHASE 1 — Tuân thủ nghỉ ngơi, phân tích công bằng, lớp đọc DB

Đây là phase nền tảng. Mục tiêu: dịch vụ chạy được, đọc dữ liệu thật từ PostgreSQL, và phục vụ hai tính năng đầu tiên qua API.

### 7.1 — Schema DB kỳ vọng (đối chiếu với TypeORM thực tế)

Lớp đọc DB giả định các bảng sau (tên cột có thể khác — **phải đối chiếu với `schema.prisma` thực tế của dự án và chỉnh `models.py` cho khớp**):

```
controllers (KSVKL)
  id              INT PK
  full_name       TEXT
  employee_code   TEXT
  (các cột khác...)

shifts (ca trực)
  id              INT PK
  controller_id   INT FK -> controllers.id
  start_at        TIMESTAMPTZ
  end_at          TIMESTAMPTZ
  is_night        BOOLEAN

shift_position_sessions (các phiên vị trí trong một ca - luân phiên)
  id          INT PK
  shift_id    INT FK -> shifts.id
  position    TEXT          -- 'APP' | 'CTL' | 'TWR' | 'GCU'
  start_at    TIMESTAMPTZ
  end_at      TIMESTAMPTZ
```

> Nếu schema TypeORM thực tế dùng tên khác (ví dụ `startAt` thay vì `start_at`), chỉ cần sửa thuộc tính ánh xạ trong `models.py`, không sửa tầng nghiệp vụ.
> Lưu ý: TypeORM dùng camelCase với nháy kép trong PostgreSQL, ví dụ `"controllerId"`, `"isNight"`, `"shiftId"`, `"monthKey"`.

### 7.2 — `app/data/database.py`

- Hàm chuẩn hóa URL: TypeORM dùng `postgresql://...`, SQLAlchemy + psycopg v3 cần `postgresql+psycopg://...`. Viết hàm `normalize_db_url()` chuyển đổi đầu chuỗi.
- Hàm `create_engine_from_settings()`: tạo engine với `pool_pre_ping=True`, `echo=False`.
- Cung cấp `SessionLocal` (session factory) để các repository dùng.
- Khuyến nghị: mở session ở chế độ chỉ đọc khi có thể.

### 7.3 — `app/data/models.py`

- Định nghĩa các ORM model `ControllerModel`, `ShiftModel` ánh xạ tới bảng đã tồn tại (declarative style SQLAlchemy 2.0).
- **Không** dùng để tạo bảng trên Postgres (TypeORM/migration.sql làm việc đó). Chỉ dùng để đọc.
- `ShiftModel` có quan hệ tới `ControllerModel` để lấy tên KSVKL.

### 7.4 — `app/data/repository.py`

Lớp `ShiftRepository` với phương thức:
- `load_shifts(start=None, end=None, controller_id=None) -> list[Shift]`: truy vấn ca trực theo khoảng thời gian (và lọc theo KSVKL nếu cần), sắp xếp theo `start_at`, **ánh xạ sang dataclass `Shift`** của tầng nghiệp vụ.
- Mỗi ca đọc kèm các phiên vị trí từ `shift_position_sessions`, dựng `list[PositionSession]`. Ánh xạ vị trí: chuỗi `'APP'` → `Position.APP`; giá trị không hợp lệ → bỏ qua phiên đó (không làm sập).
- `RatingRepository.load_qualifications()` trả về `dict[controller_id, Qualification]`: đọc cờ `is_full` và danh sách vị trí riêng lẻ từ bảng năng định.
- Áp dụng chuyển múi giờ (mục 6.2) khi tạo `Shift`.

### 7.5 — Module công bằng `app/fairness/fairness.py`

Tầng nghiệp vụ thuần, nhận `list[Shift]`, dùng **pandas** để tính:
- Tổng giờ trực mỗi KSVKL trong kỳ.
- Số ca đêm, số ca cuối tuần, số ca ngày lễ mỗi người (ngày lễ cấu hình được).
- Các chỉ số phân tán: độ lệch chuẩn, chênh lệch max–min, để định lượng mức "công bằng".
- Trả về một cấu trúc kết quả (dataclass hoặc dict) gồm bảng tổng hợp theo từng KSVKL + chỉ số tổng thể.

Không vẽ biểu đồ ở backend — trả số liệu thô, để React vẽ.

### 7.6 — API (FastAPI)

`app/routers/compliance.py`:
- `POST /analytics/compliance/check` — body: `{ start, end, controller_id? }`. Đọc ca trực qua repository, chạy `ComplianceChecker`, trả danh sách vi phạm.

`app/routers/fairness.py`:
- `POST /analytics/fairness/summary` — body: `{ start, end }`. Trả bảng phân tích công bằng.

`app/main.py`:
- Khởi tạo FastAPI, gắn các router với prefix `/analytics`.
- Bật CORS chỉ cho origin nội bộ (backend NestJS gọi sang); không mở ra internet.
- Endpoint `GET /health` trả `{ "status": "ok" }` để kiểm tra sống.

### 7.7 — Test Phase 1

- `tests/conftest.py`: fixture tạo **SQLite in-memory**, tạo bảng từ ORM models, nạp dữ liệu mẫu. (Dùng SQLite để test lớp đọc mà không cần Postgres thật — SQL cơ bản tương thích.)
- `tests/test_repository.py`: kiểm tra `load_shifts` ánh xạ đúng sang dataclass `Shift` (đúng tên KSVKL, đúng danh sách phiên vị trí, lọc theo thời gian, xử lý null).
- `tests/test_fairness.py`: kiểm tra các chỉ số công bằng trên dữ liệu giả đã biết kết quả.
- `tests/test_rest_compliance.py`: đã có sẵn (26 test).

### 7.8 — Tiêu chí hoàn thành Phase 1

1. ✅ `uvicorn app.main:app` chạy, `GET /health` trả ok.
2. ✅ Kết nối được PostgreSQL thật và `load_shifts` trả về dữ liệu đúng.
3. ✅ `POST /analytics/compliance/check` phát hiện đúng vi phạm trên dữ liệu thật.
4. ✅ `POST /analytics/fairness/summary` trả bảng phân tích hợp lý.
5. ✅ `POST /analytics/roster/review` trả kết quả rà soát + đề xuất (xem 7.9).
6. ✅ `pytest` toàn bộ pass.
7. ✅ Không có thao tác ghi nào tới DB nghiệp vụ.

### 7.9 — Rà soát trước khi publish (đã xây: `roster_review.py`)

Đúng với luồng nghiệp vụ: **kíp trưởng phân ca → dán bảng phân chia ca chi tiết → [RÀ SOÁT] → publish.** Bước rà soát do lớp `RosterReviewer` đảm nhận:

- Đầu vào: bản phân ca nháp (`list[Shift]` có sessions) + năng định toàn đơn vị (`dict[controller_id, Qualification]`).
- Chạy toàn bộ `ComplianceChecker`, rồi sinh **đề xuất xử lý** cho các lỗ hổng năng định.
- Trả về `ReviewResult` gồm: `can_publish` (False nếu còn vi phạm CRITICAL), danh sách `violations`, danh sách `suggestions`.

**Logic đề xuất khi một KSVKL bị phân vị trí không đủ năng định** (xét trong cùng khung giờ — các phiên giao nhau về thời gian):
1. **Hoán đổi sạch:** tìm người khác đủ năng định cho vị trí lỗi, đồng thời người đang lỗi đủ năng định cho vị trí của họ → đổi chỗ hai bên. (Đề xuất đối xứng được khử trùng lặp, chỉ hiện một lần.)
2. **Chuyển một chiều:** nếu không có hoán đổi sạch, tìm người đủ năng định cho vị trí lỗi → chuyển vị trí đó cho họ và bố trí lại chỗ trống của họ.
3. **Cần bổ sung nhân sự:** nếu không ai trong khung giờ đủ năng định cho vị trí lỗi → báo kíp trưởng cần bổ sung người.

API: `POST /analytics/roster/review` — body là bản phân ca nháp; trả `ReviewResult`. Endpoint này phục vụ nút "Rà soát" trên giao diện trước khi kíp trưởng bấm "Publish".

> Đây là công cụ HỖ TRỢ. Đề xuất chỉ mang tính tham khảo; kíp trưởng quyết định và chịu trách nhiệm cuối cùng. Việc publish vẫn do phía NestJS thực hiện sau khi kíp trưởng xác nhận.

---

## 8. PHASE 2 — Quản lý năng định & cảnh báo hết hạn

Mở rộng từ quy tắc `position_recency` đã có trong module compliance, sang quản lý đầy đủ vòng đời năng định.


### 8.1 — Schema DB bổ sung kỳ vọng

Mô hình dữ liệu phản ánh đúng quy định đơn vị: mỗi KSVKL hoặc có năng định **full**, hoặc có **các vị trí riêng lẻ**. Gợi ý hai bảng:

```
controller_qualifications (năng định tổng quát của KSVKL)
  id              INT PK
  controller_id   INT FK -> controllers.id
  is_full         BOOLEAN       -- true: làm được mọi vị trí APP/CTL/TWR/GCU
  expires_at      DATE          -- ngày hết hiệu lực năng định (nếu áp dụng)
  is_active       BOOLEAN

controller_qualification_positions (các vị trí riêng lẻ, chỉ dùng khi is_full=false)
  id                 INT PK
  qualification_id   INT FK -> controller_qualifications.id
  position           TEXT       -- 'APP' | 'CTL' | 'TWR' | 'GCU'
  expires_at         DATE       -- (tùy chọn) hết hạn riêng theo từng vị trí
```

> Cấu trúc bảng cụ thể tùy theo entity TypeORM thực tế (dự án hiện gộp `qualification` vào một cột trong bảng `employees` thay vì 2 bảng riêng — nếu muốn tách bảng đó là cải tiến Phase 2). Điều quan trọng là `RatingRepository` phải dựng được đối tượng `Qualification(controller_id, is_full, positions)` cho mỗi KSVKL. Bảng do NestJS/TypeORM quản lý; Python chỉ đọc.

### 8.2 — Module `app/ratings/rating_status.py`

Tầng nghiệp vụ thuần. Đầu vào: danh sách `Qualification` + (tùy chọn) lịch sử ca trực. Phát hiện:
- **Sắp hết hạn:** năng định (hoặc một vị trí riêng lẻ) có `expires_at` trong vòng N ngày tới (N cấu hình được, ví dụ 30/60/90 ngày) → cảnh báo phân tầng theo mức độ gấp.
- **Đã hết hạn:** `expires_at` đã qua nhưng vẫn `is_active` → cảnh báo nghiêm trọng.
- **Mất tính cập nhật (recency) theo vị trí:** tái dùng `position_recency` đã có trong module compliance — một vị trí không được đảm nhận trong vòng X ngày.
- **Thiếu hụt năng lực theo vị trí:** với mỗi vị trí trong {APP, CTL, TWR, GCU}, đếm số KSVKL đủ năng định (full HOẶC có vị trí đó) và còn hiệu lực; nếu dưới ngưỡng tối thiểu của đơn vị → cảnh báo rủi ro thiếu người. Lưu ý: người full được tính vào *mọi* vị trí.

### 8.3 — API & Test

- `GET /analytics/ratings/expiring?days=60` — danh sách năng định/vị trí sắp/đã hết hạn.
- `GET /analytics/ratings/coverage` — với mỗi vị trí (APP/CTL/TWR/GCU), số KSVKL đủ năng định còn hiệu lực; cảnh báo nếu dưới ngưỡng.
- Test: dữ liệu giả gồm cả người full lẫn người có vị trí riêng lẻ; kiểm tra người full được tính cho mọi vị trí, người riêng lẻ chỉ tính đúng vị trí của họ; mốc hết hạn ở quá khứ/hiện tại/tương lai phân loại đúng. Ngưỡng đọc động từ config.

### 8.4 — Tiêu chí hoàn thành Phase 2

1. ✅ Phát hiện đúng năng định/vị trí sắp hết hạn theo ngưỡng cấu hình.
2. ✅ Thống kê phủ năng định theo từng vị trí, người full tính vào mọi vị trí.
3. ✅ Cảnh báo thiếu hụt khi số người đủ năng định cho một vị trí dưới ngưỡng.
4. ✅ Tích hợp recency theo vị trí từ lịch trực thật.
5. ✅ Test pass, ngưỡng đọc động.

---

## 9. PHASE 3 — Dự báo tải công việc theo mùa

### 9.1 — Mục tiêu

Từ dữ liệu lịch sử (số ca/giờ trực theo ngày, hoặc số chuyến bay nếu có), dự báo nhu cầu nhân lực các tháng tới, hỗ trợ lập kế hoạch nghỉ phép, đào tạo, bố trí nhân sự chủ động.

### 9.2 — Module `app/forecast/workload_forecast.py`

- Đầu vào: chuỗi thời gian tải công việc theo ngày/tuần (DataFrame). Repository cung cấp hàm tổng hợp lịch sử.
- Dùng **Prophet** (xử lý tốt tính mùa vụ và ngày lễ) hoặc scikit-learn nếu muốn nhẹ hơn.
- Khai báo các ngày lễ Việt Nam và mùa cao điểm (Tết, hè, lễ 30/4–1/5...) làm yếu tố mùa vụ.
- Trả về: dự báo + khoảng tin cậy cho N kỳ tới.

### 9.3 — Lưu ý dữ liệu

Dự báo chỉ chính xác khi có **đủ dữ liệu lịch sử** (lý tưởng ≥ 1–2 năm để bắt được chu kỳ mùa). Nếu dữ liệu chưa đủ, module phải trả cảnh báo "dữ liệu chưa đủ để dự báo tin cậy" thay vì đưa con số gây hiểu lầm.

### 9.4 — API & Test

- `GET /analytics/forecast/workload?horizon_weeks=12` — dự báo tải 12 tuần tới.
- Test: dùng chuỗi dữ liệu tổng hợp có xu hướng/mùa vụ đã biết, kiểm tra dự báo nằm trong khoảng hợp lý; kiểm tra cảnh báo khi dữ liệu quá ít.

### 9.5 — Tiêu chí hoàn thành Phase 3

1. ✅ Dự báo chạy được với dữ liệu lịch sử thật.
2. ✅ Có khoảng tin cậy kèm theo, không chỉ một con số.
3. ✅ Cảnh báo khi dữ liệu không đủ.

---

## 10. PHASE 4 — Tối ưu hóa phân ca tự động

Phức tạp nhất. Chỉ làm khi 3 phase trước đã ổn định.

### 10.1 — Bài toán

Phân ca KSVKL là bài toán **lập lịch có ràng buộc** (constraint scheduling). Mục tiêu: tự sinh phương án phân ca thỏa mãn đồng thời:

**Ràng buộc cứng** (bắt buộc):
- Mỗi phiên vị trí trong mỗi ca phải được phân cho KSVKL có năng định tương ứng (full hoặc có vị trí riêng lẻ — dùng `Qualification.can_work`). Cho phép luân phiên nhiều vị trí trong một ca.
- Tuân thủ mọi quy tắc nghỉ ngơi (tái dùng các ngưỡng từ `RestRuleConfig`).
- Không phân người đã đăng ký nghỉ/không khả dụng.

**Ràng buộc mềm** (tối ưu hóa, càng tốt càng tốt):
- Công bằng: cân bằng tổng giờ, ca đêm, ca cuối tuần giữa các KSVKL.
- Tôn trọng nguyện vọng cá nhân (đăng ký ca ưu tiên) ở mức tối đa có thể.

### 10.2 — Module `app/optimize/shift_optimizer.py`

- Dùng **OR-Tools** (CP-SAT solver).
- Đầu vào: danh sách ca cần phủ, danh sách KSVKL khả dụng + năng định, các ràng buộc nghỉ ngơi, nguyện vọng.
- Đầu ra: phương án phân ca đề xuất + chỉ số chất lượng (mức công bằng đạt được, số nguyện vọng thỏa mãn).
- **Quan trọng:** đây là *đề xuất*, người phụ trách phải duyệt. Phương án sinh ra nên được chạy qua `ComplianceChecker` một lần nữa để xác nhận không vi phạm (kiểm tra chéo).

### 10.3 — API & Test

- `POST /analytics/optimize/roster` — body: khoảng thời gian, ràng buộc tùy chọn. Trả phương án đề xuất.
- Test: bài toán nhỏ có lời giải biết trước; kiểm tra phương án sinh ra không vi phạm ràng buộc cứng (chạy lại qua ComplianceChecker và assert rỗng vi phạm CRITICAL).

### 10.4 — Tiêu chí hoàn thành Phase 4

1. ✅ Sinh được phương án phân ca cho bài toán quy mô thực tế của đơn vị.
2. ✅ Phương án sinh ra **không vi phạm ràng buộc cứng** (xác nhận bằng ComplianceChecker).
3. ✅ Báo cáo được mức công bằng và số nguyện vọng thỏa mãn.
4. ✅ Rõ ràng đây là đề xuất cần người duyệt.

---

## 11. Tích hợp với NestJS

Phía NestJS, tạo một module `analytics` đóng vai trò "proxy" gọi sang Python service:

- Đọc địa chỉ Python service từ biến môi trường (ví dụ `ANALYTICS_URL=http://analytics:8000`).
- Các endpoint NestJS (ví dụ `GET /api/analytics/compliance`) nhận yêu cầu từ React, xác thực JWT, rồi chuyển tiếp sang Python service, nhận kết quả trả về React.
- **React không bao giờ gọi thẳng Python service** — luôn đi qua NestJS để được xác thực và kiểm soát quyền.

```mermaid
sequenceDiagram
    participant R as React
    participant N as NestJS
    participant P as Python Service
    participant D as PostgreSQL
    R->>N: GET /api/analytics/compliance (kèm JWT)
    N->>N: Xác thực JWT, kiểm tra quyền
    N->>P: POST /analytics/compliance/check {start, end}
    P->>D: SELECT ca trực (chỉ đọc)
    D-->>P: dữ liệu ca trực
    P->>P: ComplianceChecker.check_all()
    P-->>N: JSON danh sách vi phạm
    N-->>R: kết quả (định dạng chuẩn)
```

---

## 12. Tích hợp Docker

Thêm Python service vào `docker-compose.yml` ở thư mục gốc như một container thứ tư, **không** mở cổng ra ngoài (chỉ NestJS trong mạng nội bộ gọi tới):

```yaml
  analytics:
    build: ./analytics
    restart: always
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public
      LOCAL_TZ: Asia/Ho_Chi_Minh
      NODE_ENV: production
    depends_on:
      - postgres
    networks:
      - internal
    # KHÔNG có mục "ports" -> không lộ ra ngoài, chỉ truy cập trong mạng nội bộ
```

Đồng thời backend NestJS thêm biến `ANALYTICS_URL=http://analytics:8000`.

`analytics/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 13. Quy ước & kiểm thử chung

- Tên file/thư mục: `snake_case`. Class: `PascalCase`. Hàm/biến: `snake_case`.
- Mỗi module nghiệp vụ phải có file test tương ứng trong `tests/`.
- Chạy toàn bộ test: `pytest -v` từ thư mục `analytics/`.
- Mọi ngưỡng trong test đọc động từ config, không gán số cứng (theo mẫu test đã xây ở Phase 1).
- Mỗi hàm public có docstring ngắn mô tả mục đích.
- Tầng nghiệp vụ không import gì từ tầng dữ liệu hay FastAPI (giữ độc lập để test).

---

## 14. Thứ tự thực hiện đề xuất

1. Dựng khung dự án + `database.py` + `models.py` + `repository.py` (mục 7.2–7.4).
2. Copy `rest_compliance.py` và test vào đúng vị trí, sửa import (mục 6.1).
3. Viết `conftest.py` với SQLite in-memory + `test_repository.py` (mục 7.7).
4. Viết module fairness + router + test (mục 7.5–7.7).
5. Dựng `main.py`, chạy thử với DB thật, hoàn tất Phase 1 (mục 7.8).
6. Lần lượt Phase 2 → 3 → 4, mỗi phase xong kiểm tra tiêu chí hoàn thành trước khi sang phase kế.
7. Tích hợp Docker (mục 12) và module proxy phía NestJS (mục 11).

---

## Kết luận

Tài liệu này mô tả đầy đủ dịch vụ phân tích Python cho quan-ly-ksvkl qua 4 phase. Hãy bám sát:
- **An toàn trên hết:** ngưỡng cấu hình được, chỉ đọc DB, công cụ hỗ trợ không thay thế con người.
- **Phân tầng rõ ràng:** nghiệp vụ thuần Python tách khỏi DB và HTTP.
- **Làm tuần tự theo phase,** kiểm thử trọn vẹn trước khi tiến lên.

Mọi quyết định kiến trúc (vì sao Python đọc DB trực tiếp, vì sao tách dịch vụ riêng, vì sao chỉ đọc) đã giải thích trong tài liệu — vui lòng tuân thủ, không tự ý đổi sang hướng khác.
