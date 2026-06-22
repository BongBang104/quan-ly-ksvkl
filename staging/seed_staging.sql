-- ════════════════════════════════════════════════════════════════════════════
-- seed_staging.sql — Dữ liệu giả lập cho môi trường staging
-- ════════════════════════════════════════════════════════════════════════════
-- Mục đích: cung cấp data để test toàn bộ tính năng mà không cần dữ liệu thật.
--
-- Nội dung:
-- - 25 KSVKL với năng định đa dạng (FULL, APP, CTL, TWR, GCU, mix)
-- - 4 kíp A/B/C/D, mỗi kíp có 1 kíp trưởng + 1 kíp phó
-- - 5 tài khoản test (password mặc định: test123)
-- - 2 tháng lịch trực (5/2026, 6/2026) với một số tình huống vi phạm để test
-- - Settings shift types, position labels, roster columns
--
-- Cách dùng:
--   docker compose exec postgres psql -U postgres -d ksvkl_staging < staging/seed_staging.sql
--
-- Sau khi import:
--   - Đăng nhập với 1 trong 5 tài khoản test (password: test123)
--   - Hệ thống sẽ yêu cầu đổi password lần đầu (isFirstLogin=true)
--
-- LƯU Ý: KHÔNG chạy file này trên DB production. Truncate sẽ xóa dữ liệu thật.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Bổ sung cột thiếu nếu chưa có (idempotent) ───────────────────────────
-- Migration.sql hiện tại đang thiếu vài cột so với entity TypeORM.
-- Các ALTER này an toàn nhờ IF NOT EXISTS.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "qualificationExpiresAt" DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "qualificationIsActive" BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── Truncate dữ liệu cũ (staging only) ───────────────────────────────────
TRUNCATE TABLE
  shift_position_sessions, shifts,
  shift_handovers, shift_briefings, shift_exchanges, fatigue_reports,
  tasks, requests, activities, schedules, settings, employees
RESTART IDENTITY CASCADE;

-- ─── 25 KSVKL với năng định đa dạng ───────────────────────────────────────
-- Password tất cả: test123 (bcrypt cost 10)
-- Hash: $2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq
-- isFirstLogin = true → buộc đổi password lần đầu đăng nhập

INSERT INTO employees (
  id, name, "icaoCode", team, role, position, qualification,
  "qualificationExpiresAt", "qualificationIsActive",
  "isChief", "isVip", phone, email, password, "isFirstLogin", "isApproved"
) VALUES

-- ─── KÍP A (6 người) ──────────────────────────────────────────────────────
-- Kíp trưởng FULL + 1 kíp phó tầng 6
('emp_a01', 'Nguyễn Văn A1', 'AA1', 'A', 'CHIEF',  'APP,CTL,TWR,GCU,TKT_T6,TKT_T8', 'Full',  '2027-12-31', true,  true,  false, '0901000001', 'a01@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_a02', 'Nguyễn Văn A2', 'AA2', 'A', 'STAFF',  'APP,CTL,TKT_T6', 'APP,CTL,TKT_T6',  '2027-06-30', true,  false, false, '0901000002', 'a02@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_a03', 'Lê Thị A3',    'AA3', 'A', 'STAFF',  'TWR,GCU,TKT_T8', 'TWR,GCU,TKT_T8',  '2027-03-31', true,  false, false, '0901000003', 'a03@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_a04', 'Trần Văn A4',  'AA4', 'A', 'STAFF',  'APP,CTL',        'APP,CTL',          '2026-08-15', true,  false, false, '0901000004', 'a04@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_a05', 'Phạm Thị A5',  'AA5', 'A', 'STAFF',  'TWR,GCU',        'TWR,GCU',          '2027-11-30', true,  false, false, '0901000005', 'a05@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_a06', 'Hoàng Văn A6', 'AA6', 'A', 'STAFF',  'APP',            'APP',              '2026-07-30', true,  false, false, '0901000006', 'a06@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),

-- ─── KÍP B (6 người) — cảnh báo năng định sắp hết hạn ─────────────────────
('emp_b01', 'Đỗ Thị B1',    'BB1', 'B', 'CHIEF',  'APP,CTL,TWR,GCU,TKT_T6,TKT_T8', 'Full',  '2027-12-31', true,  true,  false, '0902000001', 'b01@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_b02', 'Vũ Văn B2',    'BB2', 'B', 'STAFF',  'TWR,GCU,TKT_T8', 'TWR,GCU,TKT_T8',  '2026-08-01', true,  false, false, '0902000002', 'b02@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_b03', 'Bùi Thị B3',   'BB3', 'B', 'STAFF',  'APP,CTL,TKT_T6', 'APP,CTL,TKT_T6',  '2027-01-15', true,  false, false, '0902000003', 'b03@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_b04', 'Phan Văn B4',  'BB4', 'B', 'STAFF',  'APP,CTL',        'APP,CTL',          '2027-04-20', true,  false, false, '0902000004', 'b04@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_b05', 'Đặng Thị B5',  'BB5', 'B', 'STAFF',  'TWR,GCU',        'TWR,GCU',          '2027-09-30', true,  false, false, '0902000005', 'b05@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_b06', 'Ngô Văn B6',   'BB6', 'B', 'STAFF',  'TWR',            'TWR',              '2026-07-10', true,  false, false, '0902000006', 'b06@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),

-- ─── KÍP C (6 người) ──────────────────────────────────────────────────────
('emp_c01', 'Mai Thị C1',   'CC1', 'C', 'CHIEF',  'APP,CTL,TWR,GCU,TKT_T6,TKT_T8', 'Full',  '2027-12-31', true,  true,  false, '0903000001', 'c01@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_c02', 'Lý Văn C2',    'CC2', 'C', 'STAFF',  'APP,CTL,TKT_T6', 'APP,CTL,TKT_T6',  '2027-05-15', true,  false, false, '0903000002', 'c02@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_c03', 'Trịnh Thị C3', 'CC3', 'C', 'STAFF',  'TWR,GCU,TKT_T8', 'TWR,GCU,TKT_T8',  '2027-07-31', true,  false, false, '0903000003', 'c03@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_c04', 'Nguyễn Văn C4','CC4', 'C', 'STAFF',  'APP,CTL,TWR,GCU','Full',             '2027-10-15', true,  false, false, '0903000004', 'c04@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_c05', 'Hồ Thị C5',    'CC5', 'C', 'STAFF',  'TWR,GCU',        'TWR,GCU',          '2027-02-28', true,  false, false, '0903000005', 'c05@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_c06', 'Dương Văn C6', 'CC6', 'C', 'STAFF',  'APP',            'APP',              '2026-09-15', true,  false, false, '0903000006', 'c06@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),

-- ─── KÍP D (5 người + 2 KSVKL quân sự) ────────────────────────────────────
('emp_d01', 'Lương Thị D1', 'DD1', 'D', 'CHIEF',  'APP,CTL,TWR,GCU,TKT_T6,TKT_T8', 'Full',  '2027-12-31', true,  true,  false, '0904000001', 'd01@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_d02', 'Tô Văn D2',    'DD2', 'D', 'STAFF',  'APP,CTL',        'APP,CTL',          '2027-08-15', true,  false, false, '0904000002', 'd02@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_d03', 'Vương Thị D3', 'DD3', 'D', 'STAFF',  'TWR,GCU,TKT_T8', 'TWR,GCU,TKT_T8',  '2027-06-30', true,  false, false, '0904000003', 'd03@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_d04', 'Đinh Văn D4',  'DD4', 'D', 'STAFF',  'TWR,GCU',        'TWR,GCU',          '2026-08-20', true,  false, false, '0904000004', 'd04@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_d05', 'Trương Thị D5','DD5', 'D', 'STAFF',  'APP,CTL,TKT_T6', 'APP,CTL,TKT_T6',  '2027-11-15', true,  false, false, '0904000005', 'd05@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_q01', 'Nguyễn Quân 1','QQ1', null, 'STAFF', 'QS',             'QS',               '2027-12-31', true,  false, false, '0905000001', 'q01@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('emp_q02', 'Lê Quân 2',    'QQ2', null, 'STAFF', 'QS',             'QS',               '2027-12-31', true,  false, false, '0905000002', 'q02@test.local', '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),

-- ─── 2 tài khoản admin / superadmin ────────────────────────────────────────
('admin_test', 'Admin Test Account', null, null, 'ADMIN',       null, null, null, true,  false, false, '0900000001', 'admin@test.local',    '$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true),
('super_test', 'Super Test',         null, null, 'superadmin',  null, null, null, true,  true,  false, '0900000002', 'superadmin@test.local','$2b$10$mpM/oH/9de35uYvOK/pyou6s0S/St/bKmASximNX0KPwzmtzFCrCq', true, true)

ON CONFLICT (id) DO NOTHING;

-- ─── Settings: shift types + roster columns ───────────────────────────────

INSERT INTO settings (config) VALUES (
  '{
    "shiftTypes": [
      { "code": "S", "label": "Ca ngày",  "start": 7,  "end": 19, "color": "#fef9c3" },
      { "code": "D", "label": "Ca đêm",   "start": 19, "end": 31, "color": "#a5b4fc" },
      { "code": "OFF",   "label": "Nghỉ",        "start": 0, "end": 0, "color": "#e2e8f0" },
      { "code": "LEAVE", "label": "Nghỉ phép",   "start": 0, "end": 0, "color": "#fed7aa" },
      { "code": "TRAINING", "label": "Đào tạo",  "start": 0, "end": 0, "color": "#bfdbfe" },
      { "code": "ONCALL", "label": "Trực sẵn sàng", "start": 0, "end": 0, "color": "#ddd6fe" }
    ],
    "rosterColumns": ["APP", "CTL", "TWR", "GCU"],
    "positionLabels": {
      "APP": "Tiếp cận (APP)",
      "CTL": "Đường dài (CTL)",
      "TWR": "Đài chỉ huy (TWR)",
      "GCU": "Đài mặt đất (GCU)",
      "TKT_T6": "Kíp trưởng tầng 6",
      "TKT_T8": "Kíp trưởng tầng 8",
      "QS": "Quân sự",
      "HDA": "Hiệp đồng APP",
      "HDC": "Hiệp đồng CTL",
      "HDT": "Hiệp đồng TWR",
      "HDG": "Hiệp đồng GCU"
    },
    "facility": "ACC_APP_TWR Đà Nẵng",
    "apiBaseUrl": "http://localhost:3000"
  }'::jsonb
);

-- ─── Lịch trực tháng 5/2026 ───────────────────────────────────────────────
-- Pattern: 4 kíp luân phiên S-D-OFF-OFF (rotation 4 ngày)
-- Kíp A: S vào ngày 1, 5, 9, 13, ... (mỗi 4 ngày)
-- Kíp B: D vào ngày 1 (đêm 1-2)
-- Kíp C: OFF, Kíp D: nghỉ phục hồi sau đêm
--
-- Tình huống vi phạm CỐ Ý để test compliance:
-- - emp_a04 làm 7 ngày liên tiếp 10-16/5 → vi phạm Điều 12.2 (≤ 6 ngày liên tiếp)
-- - emp_b06 4 ca đêm liên tiếp 5-8/5 → vi phạm Điều 15.1.b (≤ 3 ca đêm)
-- - emp_c06 ngày 5 D, ngày 6 S (chỉ 7h nghỉ giữa) → vi phạm Điều 13.1 (≥ 12h)

INSERT INTO schedules ("monthKey", data) VALUES
('2026-05', '{
  "isPublished": false,
  "scheduleData": {
    "emp_a01_2026-05-01": "S", "emp_a01_2026-05-02": "OFF", "emp_a01_2026-05-03": "OFF", "emp_a01_2026-05-04": "OFF",
    "emp_a01_2026-05-05": "S", "emp_a01_2026-05-06": "OFF", "emp_a01_2026-05-07": "OFF", "emp_a01_2026-05-08": "OFF",
    "emp_a01_2026-05-09": "S", "emp_a01_2026-05-13": "S", "emp_a01_2026-05-17": "S", "emp_a01_2026-05-21": "S",
    "emp_a01_2026-05-25": "S", "emp_a01_2026-05-29": "S",

    "emp_a02_2026-05-01": "S", "emp_a02_2026-05-05": "S", "emp_a02_2026-05-09": "S", "emp_a02_2026-05-13": "S",
    "emp_a02_2026-05-17": "S", "emp_a02_2026-05-21": "S", "emp_a02_2026-05-25": "S", "emp_a02_2026-05-29": "S",

    "emp_a03_2026-05-01": "S", "emp_a03_2026-05-05": "S", "emp_a03_2026-05-09": "S", "emp_a03_2026-05-13": "S",
    "emp_a03_2026-05-17": "S", "emp_a03_2026-05-21": "S", "emp_a03_2026-05-25": "S", "emp_a03_2026-05-29": "S",

    "emp_a04_2026-05-10": "S", "emp_a04_2026-05-11": "S", "emp_a04_2026-05-12": "S",
    "emp_a04_2026-05-13": "S", "emp_a04_2026-05-14": "S", "emp_a04_2026-05-15": "S", "emp_a04_2026-05-16": "S",

    "emp_a05_2026-05-01": "S", "emp_a05_2026-05-05": "S", "emp_a05_2026-05-09": "S",
    "emp_a06_2026-05-01": "S", "emp_a06_2026-05-05": "S",

    "emp_b01_2026-05-01": "D", "emp_b01_2026-05-02": "OFF", "emp_b01_2026-05-03": "OFF",
    "emp_b01_2026-05-05": "D", "emp_b01_2026-05-09": "D", "emp_b01_2026-05-13": "D",
    "emp_b01_2026-05-17": "D", "emp_b01_2026-05-21": "D", "emp_b01_2026-05-25": "D", "emp_b01_2026-05-29": "D",

    "emp_b02_2026-05-01": "D", "emp_b02_2026-05-05": "D", "emp_b02_2026-05-09": "D", "emp_b02_2026-05-13": "D",
    "emp_b02_2026-05-17": "D", "emp_b02_2026-05-21": "D", "emp_b02_2026-05-25": "D",

    "emp_b03_2026-05-01": "D", "emp_b03_2026-05-05": "D", "emp_b03_2026-05-09": "D", "emp_b03_2026-05-13": "D",
    "emp_b03_2026-05-17": "D", "emp_b03_2026-05-21": "D",

    "emp_b06_2026-05-05": "D", "emp_b06_2026-05-06": "D", "emp_b06_2026-05-07": "D", "emp_b06_2026-05-08": "D",

    "emp_c01_2026-05-03": "S", "emp_c01_2026-05-07": "S", "emp_c01_2026-05-11": "S", "emp_c01_2026-05-15": "S",
    "emp_c01_2026-05-19": "S", "emp_c01_2026-05-23": "S", "emp_c01_2026-05-27": "S",

    "emp_c02_2026-05-03": "S", "emp_c02_2026-05-07": "S", "emp_c02_2026-05-11": "S", "emp_c02_2026-05-15": "S",
    "emp_c02_2026-05-19": "S", "emp_c02_2026-05-23": "S",

    "emp_c06_2026-05-05": "D", "emp_c06_2026-05-06": "S",

    "emp_d01_2026-05-03": "D", "emp_d01_2026-05-07": "D", "emp_d01_2026-05-11": "D", "emp_d01_2026-05-15": "D",
    "emp_d01_2026-05-19": "D", "emp_d01_2026-05-23": "D", "emp_d01_2026-05-27": "D",

    "emp_d02_2026-05-03": "D", "emp_d02_2026-05-07": "D", "emp_d02_2026-05-11": "D", "emp_d02_2026-05-15": "D",
    "emp_d02_2026-05-19": "D",

    "emp_d03_2026-05-03": "D", "emp_d03_2026-05-07": "D", "emp_d03_2026-05-11": "D", "emp_d03_2026-05-15": "D",

    "emp_q01_2026-05-01": "S", "emp_q01_2026-05-08": "S", "emp_q01_2026-05-15": "S", "emp_q01_2026-05-22": "S",
    "emp_q02_2026-05-04": "S", "emp_q02_2026-05-11": "S", "emp_q02_2026-05-18": "S", "emp_q02_2026-05-25": "S"
  },
  "extraAssignments": {}
}'::jsonb),

-- ─── Lịch trực tháng 6/2026 (lịch sạch hơn để test optimizer) ─────────────
('2026-06', '{
  "isPublished": false,
  "scheduleData": {
    "emp_a01_2026-06-01": "S", "emp_a01_2026-06-05": "S", "emp_a01_2026-06-09": "S", "emp_a01_2026-06-13": "S",
    "emp_a01_2026-06-17": "S", "emp_a01_2026-06-21": "S", "emp_a01_2026-06-25": "S", "emp_a01_2026-06-29": "S",

    "emp_a02_2026-06-01": "S", "emp_a02_2026-06-05": "S", "emp_a02_2026-06-09": "S", "emp_a02_2026-06-13": "S",
    "emp_a02_2026-06-17": "S", "emp_a02_2026-06-21": "S",

    "emp_a03_2026-06-01": "S", "emp_a03_2026-06-05": "S", "emp_a03_2026-06-09": "S", "emp_a03_2026-06-13": "S",
    "emp_a03_2026-06-17": "S", "emp_a03_2026-06-21": "S",

    "emp_b01_2026-06-01": "D", "emp_b01_2026-06-05": "D", "emp_b01_2026-06-09": "D", "emp_b01_2026-06-13": "D",
    "emp_b01_2026-06-17": "D", "emp_b01_2026-06-21": "D", "emp_b01_2026-06-25": "D", "emp_b01_2026-06-29": "D",

    "emp_b02_2026-06-01": "D", "emp_b02_2026-06-05": "D", "emp_b02_2026-06-09": "D",
    "emp_b03_2026-06-01": "D", "emp_b03_2026-06-05": "D", "emp_b03_2026-06-09": "D",

    "emp_c01_2026-06-03": "S", "emp_c01_2026-06-07": "S", "emp_c01_2026-06-11": "S", "emp_c01_2026-06-15": "S",
    "emp_c01_2026-06-19": "S", "emp_c01_2026-06-23": "S", "emp_c01_2026-06-27": "S",

    "emp_c02_2026-06-03": "S", "emp_c02_2026-06-07": "S", "emp_c02_2026-06-11": "S",

    "emp_d01_2026-06-03": "D", "emp_d01_2026-06-07": "D", "emp_d01_2026-06-11": "D", "emp_d01_2026-06-15": "D",
    "emp_d01_2026-06-19": "D", "emp_d01_2026-06-23": "D", "emp_d01_2026-06-27": "D",

    "emp_d02_2026-06-03": "D", "emp_d02_2026-06-07": "D", "emp_d02_2026-06-11": "D",
    "emp_d03_2026-06-03": "D", "emp_d03_2026-06-07": "D", "emp_d03_2026-06-11": "D"
  },
  "extraAssignments": {}
}'::jsonb);

-- ─── Một vài báo cáo mệt mỏi mẫu để test M1 ────────────────────────────────

INSERT INTO fatigue_reports (
  id, "anonCode", "reporterId", facility, "shiftType",
  "fatigueOnset", "kssScore",
  "sleepHours72", "sleepHours24", "sleepQuality",
  "impactDescription",
  "factorsSchedule", "factorsOperation", "factorsPersonal",
  status, "createdAt"
) VALUES
(
  'fr_test_001', 'FR-2026-000001', 'emp_b06', 'TWR Đà Nẵng', 'D',
  '04:30 ngày 8/5, sau ca đêm thứ 4 liên tiếp', 8,
  18.5, 5.0, 'poor',
  'Cảm thấy khó tập trung, phản xạ chậm vào cuối ca. Có 1 lần phải đề nghị KSVKL khác xem lại tình huống đang xử lý.',
  '["Nhiều kíp đêm liên tiếp", "Thời gian nghỉ không đủ"]'::jsonb,
  '["Khối lượng công việc cao"]'::jsonb,
  '["Chất lượng giấc ngủ kém (lý do cá nhân/sức khỏe)"]'::jsonb,
  'submitted', NOW() - INTERVAL '2 days'
),
(
  'fr_test_002', 'FR-2026-000002', 'emp_a04', 'APP Đà Nẵng', 'S',
  '17:00 ngày 16/5, sau 7 ngày liên tiếp', 7,
  21.0, 6.5, 'fair',
  'Mệt mỏi tích lũy. Đã đề nghị kíp trưởng cho nghỉ bù 2 ngày tới.',
  '["Nhiều kíp đêm liên tiếp", "Làm thêm giờ/thay đổi đột xuất"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'acknowledged', NOW() - INTERVAL '5 days'
),
(
  'fr_test_003', 'FR-2026-000003', 'emp_c06', null, 'D',
  '02:00 ngày 6/5, trong ca đêm liên tục từ 19h hôm trước', 6,
  20.0, 4.5, 'poor',
  'Buồn ngủ rõ nhưng cố duy trì tập trung. Cần nghỉ giải lao 10 phút.',
  '["Chuyển đổi ca nhanh"]'::jsonb,
  '["Không đủ nghỉ giải lao"]'::jsonb,
  '[]'::jsonb,
  'submitted', NOW() - INTERVAL '1 day'
);

-- Cập nhật acknowledged record
UPDATE fatigue_reports SET "acknowledgedBy" = 'emp_a01', "acknowledgedAt" = NOW() - INTERVAL '4 days'
WHERE id = 'fr_test_002';

-- ─── Một vài yêu cầu đổi ca mẫu để test M2 ────────────────────────────────

INSERT INTO shift_exchanges (
  id, type, "facilityType",
  "applicantId", "applicantName", "applicantShiftDate", "applicantShiftCode",
  "counterpartyId", "counterpartyName", "counterpartyShiftDate", "counterpartyShiftCode",
  status, "createdAt"
) VALUES
(
  'ex_test_001', 'EXCHANGE', 'ACC_APP_TWR',
  'emp_a02', 'Nguyễn Văn A2', '2026-06-13', 'S',
  'emp_c02', 'Lý Văn C2',    '2026-06-15', 'S',
  'pending', NOW() - INTERVAL '2 hours'
),
(
  'ex_test_002', 'COVER', 'ACC_APP_TWR',
  'emp_d04', 'Đinh Văn D4', '2026-06-11', 'D',
  'emp_b05', 'Đặng Thị B5', null, null,
  'counterparty_agreed', NOW() - INTERVAL '1 day'
);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- KẾT THÚC SEED
-- ═══════════════════════════════════════════════════════════════════════════
-- Kiểm tra sau khi chạy:
--   SELECT COUNT(*) FROM employees;       -- Phải = 27 (25 KSVKL + 2 admin)
--   SELECT COUNT(*) FROM schedules;       -- Phải = 2
--   SELECT COUNT(*) FROM fatigue_reports; -- Phải = 3
--   SELECT COUNT(*) FROM shift_exchanges; -- Phải = 2
--
-- Tài khoản test (password "test123" — phải đổi sau lần đăng nhập đầu):
--   super_test  → superadmin (toàn quyền)
--   admin_test  → ADMIN (admin chuẩn)
--   emp_a01     → CHIEF kíp A (Nguyễn Văn A1)
--   emp_b01     → CHIEF kíp B (Đỗ Thị B1)
--   emp_a02     → STAFF kíp A (KSVKL thường)
--   emp_c02     → STAFF kíp C (để test luồng đổi ca với emp_a02)
--
-- Tình huống test compliance:
--   1. emp_a04 làm 7 ngày liên tiếp 10-16/5 → vi phạm Điều 12.2
--   2. emp_b06 4 ca đêm liên tiếp 5-8/5 → vi phạm Điều 15.1.b
--   3. emp_c06 D→S sát nhau → vi phạm Điều 13.1 nghỉ giữa ca
-- ═══════════════════════════════════════════════════════════════════════════
