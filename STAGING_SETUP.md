# STAGING_SETUP — Hướng dẫn dùng seed_staging.sql

> Đi kèm `PLAN_STAGING_TEST.md` (Phần A). Mục đích: setup môi trường staging với 27 tài khoản giả lập + 2 tháng lịch + dữ liệu mẫu để test toàn bộ tính năng.

---

## Cấu trúc dữ liệu sinh ra

**27 tài khoản:**
- 1 superadmin (`super_test`)
- 1 admin (`admin_test`)
- 4 kíp trưởng (`emp_a01`, `emp_b01`, `emp_c01`, `emp_d01`) — role `CHIEF`, `isChief=true`
- 19 KSVKL thường (role `STAFF`, mix kíp A/B/C/D)
- 2 KSVKL quân sự (`emp_q01`, `emp_q02`)

**Phân năng định đa dạng:**
- 6 người **FULL** (làm được mọi vị trí + kíp trưởng) — 4 kíp trưởng + `emp_c04`
- 6 người **APP+CTL+TKT_T6** (tầng 6, có thể kíp trưởng tầng 6)
- 6 người **TWR+GCU+TKT_T8** (tầng 8, có thể kíp trưởng tầng 8)
- 4 người **APP+CTL** hoặc **TWR+GCU** (KSVKL không kíp trưởng)
- 3 người **chỉ APP** hoặc **chỉ TWR** (KSVKL mới)
- 2 người **QS** (quân sự)

**Năng định sắp hết hạn (để test cảnh báo):**
- `emp_b02` hết hạn 1/8/2026
- `emp_b06` hết hạn 10/7/2026
- `emp_a06` hết hạn 30/7/2026
- `emp_d04` hết hạn 20/8/2026
- `emp_a04` hết hạn 15/8/2026
- `emp_c06` hết hạn 15/9/2026

**2 tháng lịch trực:**
- `2026-05` — có tình huống vi phạm cố ý (test compliance)
- `2026-06` — lịch sạch hơn (test optimizer + macro flow)

**Vi phạm cố ý trong tháng 5/2026:**
- `emp_a04` làm 7 ngày liên tiếp (10-16/5) → vi phạm Điều 12.2 (≤ 6 ngày liên tiếp).
- `emp_b06` 4 ca đêm liên tiếp (5-8/5) → vi phạm Điều 15.1.b (≤ 3 ca đêm liên tiếp).
- `emp_c06` ca D đêm 5/5 → ca S sáng 6/5, chỉ 7h nghỉ → vi phạm Điều 13.1 (≥ 12h nghỉ).

**Dữ liệu test sẵn:**
- 3 báo cáo mệt mỏi (KSS 8, 7, 6 — test M1).
- 2 yêu cầu đổi ca (1 EXCHANGE, 1 COVER — test M2).

---

## Cách chạy

### Bước 1 — Khởi động staging stack

```bash
# Trong thư mục gốc repo
cp .env.example .env.staging
# Sửa .env.staging:
# - DB_NAME=ksvkl_staging
# - JWT_SECRET=<random 48 chars>
# - FRONTEND_URL=http://localhost
# - PORT=3001 (tránh đụng production nếu chạy song song)

# Tạo docker-compose.staging.yml — override port để tránh đụng production
cat > docker-compose.staging.yml << 'EOF'
services:
  postgres:
    ports: ["5433:5432"]   # tránh đụng 5432 production
  backend:
    ports: ["3001:3000"]
    env_file: [.env.staging]
  analytics:
    ports: ["8002:8001"]
  nginx:
    ports: ["8080:80"]     # truy cập http://localhost:8080
EOF

# Khởi động
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

### Bước 2 — Chạy migration

```bash
# Đợi 10s cho postgres khởi xong
sleep 10

# Chạy migration tạo bảng
docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U postgres -d ksvkl_staging < backend/migration.sql
```

Kết quả mong đợi: 12 bảng (`employees`, `settings`, `activities`, `schedules`, `tasks`, `requests`, `fatigue_reports`, `shift_exchanges`, `shift_briefings`, `shift_handovers`, `shifts`, `shift_position_sessions`).

Kiểm tra:
```bash
docker compose -f docker-compose.staging.yml exec postgres \
  psql -U postgres -d ksvkl_staging -c "\dt"
```

### Bước 3 — Chạy seed_staging.sql

Đặt file `seed_staging.sql` (mình đã giao kèm) vào thư mục `staging/` của repo:

```bash
mkdir -p staging
mv seed_staging.sql staging/

# Chạy seed
docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U postgres -d ksvkl_staging < staging/seed_staging.sql
```

Kết quả mong đợi:
```
BEGIN
ALTER TABLE
ALTER TABLE
ALTER TABLE
TRUNCATE TABLE
INSERT 0 27
INSERT 0 1
INSERT 0 2
INSERT 0 3
UPDATE 1
INSERT 0 2
COMMIT
```

### Bước 4 — Kiểm tra seed thành công

```bash
docker compose -f docker-compose.staging.yml exec postgres \
  psql -U postgres -d ksvkl_staging -c "
    SELECT 'employees' AS t, COUNT(*) FROM employees
    UNION ALL SELECT 'schedules', COUNT(*) FROM schedules
    UNION ALL SELECT 'fatigue_reports', COUNT(*) FROM fatigue_reports
    UNION ALL SELECT 'shift_exchanges', COUNT(*) FROM shift_exchanges
    UNION ALL SELECT 'settings', COUNT(*) FROM settings;"
```

Mong đợi:
```
       t        | count
----------------+-------
 employees      |    27
 schedules      |     2
 fatigue_reports|     3
 shift_exchanges|     2
 settings       |     1
```

### Bước 5 — Đăng nhập lần đầu

Truy cập `http://localhost:8080` (hoặc port nginx của bạn).

**Tài khoản test (password mặc định: `test123`):**

| Username | Role | Mục đích test |
|---|---|---|
| `super_test` | superadmin | Test toàn quyền + Settings nâng cao |
| `admin_test` | ADMIN | Test workflow admin chuẩn |
| `emp_a01` | CHIEF (kíp A) | Test workflow kíp trưởng + phê duyệt đổi ca |
| `emp_b01` | CHIEF (kíp B) | Test phê duyệt chéo |
| `emp_a02` | STAFF (kíp A) | Test KSVKL thường |
| `emp_c02` | STAFF (kíp C) | Test luồng đổi ca với emp_a02 (đã có sẵn yêu cầu) |
| `emp_b06` | STAFF (kíp B) | Test KSVKL đã gửi báo cáo mệt mỏi |

⚠️ **Sau đăng nhập lần đầu, hệ thống yêu cầu đổi password (isFirstLogin=true).** Đổi sang password riêng cho từng tester, ghi lại tại nơi an toàn.

---

## Test ngay sau seed

Sau khi đăng nhập, các test cases sau **phải work** với data đã seed:

### Tab Tuân thủ (test C3 — đọc từ scheduleData)

1. Đăng nhập `admin_test`.
2. Menu Báo cáo → Tuân thủ → tháng `2026-05` → bấm Kiểm tra.
3. **Mong đợi:** ít nhất 3 vi phạm hiển thị:
   - `emp_a04`: "Làm 7 ngày liên tiếp" (legal_basis: QĐ 2288 Điều 12.2)
   - `emp_b06`: "4 ca đêm liên tiếp" (Điều 15.1.b)
   - `emp_c06`: "Nghỉ giữa 2 ca < 12h" (Điều 13.1)

4. Đổi sang tháng `2026-06` → kết quả ít vi phạm hơn (lịch sạch).

### Tab Công bằng

1. Tháng `2026-05` → bấm Phân tích.
2. **Mong đợi:** bảng KSVKL có cột "GIỜ ĐÊM". `emp_b06` có giờ đêm cao bất thường (4 ca x 12h = 48h chỉ trong 4 ngày).

### Tab Năng định

1. Dropdown chọn 60 ngày.
2. **Mong đợi:** 5 KSVKL trong danh sách cảnh báo hết hạn (emp_b02, emp_b06, emp_a06, emp_d04, emp_a04).
3. Phủ sóng năng định: 7 vị trí chính (không có HDA-HDG).

### Tab Báo cáo mệt mỏi (M1)

1. Đăng nhập `emp_a01` (CHIEF kíp A).
2. Tab "Cần xử lý" → thấy 2 báo cáo đang `submitted` (KSS=8 của emp_b06 và KSS=6 của emp_c06).
3. Bấm "Tôi đã xem & ghi nhận" cho KSS=8 → status đổi sang `acknowledged`.

4. Đăng nhập `admin_test`.
5. Tab "Tổng hợp ẩn danh" → biểu đồ phân bố KSS có cột 6/7/8 mỗi cột.
6. **KHÔNG có** tên `emp_b06`, `emp_a04`, `emp_c06` hiển thị — chỉ có `anonCode` `FR-2026-000001/2/3`.

### Tab Đổi ca (M2)

1. Đăng nhập `emp_c02` (counterparty của yêu cầu test).
2. Tab "Yêu cầu của tôi" → thấy yêu cầu của `emp_a02` (đổi ca S 13/6 ↔ S 15/6).
3. Bấm "✓ Đồng ý nhận đổi ca" → status `counterparty_agreed`.

4. Đăng nhập `emp_a01` (CHIEF) → thấy yêu cầu chờ duyệt → bấm "Phê duyệt" → status `chief_approved`.

5. Test luồng từ chối: đăng nhập `emp_c02`, mở yêu cầu khác, bấm "✗ Từ chối / Hủy", ghi lý do → status `rejected`.

---

## Reset staging

Khi muốn xóa tất cả dữ liệu test và làm lại từ đầu:

```bash
# Cách 1: Chạy lại seed (đã có TRUNCATE TABLE ở đầu)
docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U postgres -d ksvkl_staging < staging/seed_staging.sql

# Cách 2: Xóa volume Docker hẳn (mất tất cả)
docker compose -f docker-compose.staging.yml down -v
# Sau đó lặp lại Bước 2 (migration) + Bước 3 (seed)
```

---

## Lưu ý quan trọng

1. **TUYỆT ĐỐI KHÔNG chạy seed_staging.sql trên DB production.** File có `TRUNCATE TABLE` đầu tiên → xóa toàn bộ dữ liệu thật.

2. **Password `test123` chỉ dùng cho staging.** Nếu deploy file này lên môi trường thật, đổi password mặc định trước.

3. **Backdoor `tctsvip` vẫn được tạo tự động khi backend khởi động** (Z1 phương án 1). Theo dõi console log backend lúc start để biết password OTP. Đăng nhập 1 lần để đổi password, sau đó tài khoản này dùng cho disaster recovery.

4. **Email/SĐT trong seed là giả** (`@test.local`, `0901xxx`). Khi test các tính năng gửi notification (M3), không gửi thật ra ngoài.

---

## Bug build phải fix trước khi setup staging

Trước khi chạy staging, đảm bảo đã fix bug `RosterGrid.js:166` (xem `PLAN_FIX_BUILD_BUG_2026_06_22.md`). Nếu frontend không build được → docker compose build sẽ fail.

---

## Sau khi staging chạy ổn

1. Tự test theo Phần B của `PLAN_STAGING_TEST.md` (27 mục).
2. Ghi bug vào `BUG_LOG_STAGING.md`.
3. Khi B1-B9 ổn → mời tester thực tế (Phần D).
4. Khi UAT xong → quyết định production hay sprint thêm theo Phần E + F.

**Không thêm tính năng mới trong giai đoạn này.** Mục tiêu duy nhất: validate những gì đã build trước khi production.
