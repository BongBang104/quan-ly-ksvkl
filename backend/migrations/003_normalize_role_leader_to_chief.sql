-- Migration 003: Chuẩn hoá role LEADER → CHIEF
-- Chạy trước khi deploy backend có P4 changes.
-- Sau khi chạy: KHÔNG còn record nào có role = 'LEADER' trong bảng employees.

UPDATE employees SET role = 'CHIEF' WHERE role = 'LEADER';

-- Verify:
-- SELECT COUNT(*) FROM employees WHERE role = 'LEADER';  -- Phải = 0
