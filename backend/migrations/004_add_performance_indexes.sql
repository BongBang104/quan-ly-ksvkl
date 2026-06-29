-- Performance indexes for frequently-queried columns
-- CONCURRENTLY: không lock table khi tạo index trên production
-- Chạy trong psql: \i migrations/004_add_performance_indexes.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_team       ON employees(team);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_role       ON employees(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_approved   ON employees("isApproved");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_team           ON tasks(team);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status         ON tasks(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_created_by     ON tasks("createdBy");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_emp       ON activities("empId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_start     ON activities("startDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_end       ON activities("endDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requests_employee    ON requests("employeeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requests_status      ON requests(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fatigue_status       ON fatigue_reports(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fatigue_created      ON fatigue_reports("createdAt");
