-- ATC Pro — PostgreSQL schema
-- Run this if you prefer manual migration over synchronize:true

CREATE TABLE IF NOT EXISTS employees (
  id                       VARCHAR PRIMARY KEY,
  name                     VARCHAR NOT NULL,
  "icaoCode"               VARCHAR,
  team                     VARCHAR,
  role                     VARCHAR NOT NULL DEFAULT 'STAFF',
  position                 VARCHAR,
  qualification            VARCHAR,
  "qualificationExpiresAt" DATE,
  "qualificationIsActive"  BOOLEAN NOT NULL DEFAULT TRUE,
  "isChief"                BOOLEAN NOT NULL DEFAULT FALSE,
  "isVip"                  BOOLEAN NOT NULL DEFAULT FALSE,
  phone                    VARCHAR,
  email                    VARCHAR,
  password                 VARCHAR NOT NULL,
  "isFirstLogin"           BOOLEAN NOT NULL DEFAULT TRUE,
  "isApproved"             BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id           SERIAL PRIMARY KEY,
  config       JSONB NOT NULL DEFAULT '{}',
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id           VARCHAR PRIMARY KEY,
  "employeeId" VARCHAR NOT NULL,
  type         VARCHAR NOT NULL,
  note         VARCHAR,
  "startDate"  DATE NOT NULL,
  "endDate"    DATE NOT NULL,
  "approvedBy" VARCHAR,
  status       VARCHAR NOT NULL DEFAULT 'pending',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  "monthKey"   VARCHAR PRIMARY KEY,
  data         JSONB NOT NULL DEFAULT '{}',
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id               VARCHAR NOT NULL,
  team             VARCHAR NOT NULL,
  title            VARCHAR NOT NULL,
  description      VARCHAR,
  priority         VARCHAR NOT NULL DEFAULT 'medium',
  status           VARCHAR NOT NULL DEFAULT 'open',
  "assignedTo"     VARCHAR,
  "dueDate"        VARCHAR,
  "createdBy"      VARCHAR,
  "targetEmpIds"   JSONB NOT NULL DEFAULT '[]',
  comments         JSONB NOT NULL DEFAULT '[]',
  acknowledgments  JSONB NOT NULL DEFAULT '[]',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, team)
);

CREATE TABLE IF NOT EXISTS requests (
  id           VARCHAR PRIMARY KEY,
  "employeeId" VARCHAR NOT NULL,
  type         VARCHAR NOT NULL,
  note         VARCHAR,
  "startDate"  DATE NOT NULL,
  "endDate"    DATE NOT NULL,
  status       VARCHAR NOT NULL DEFAULT 'pending',
  "reviewedBy" VARCHAR,
  "reviewNote" VARCHAR,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tài khoản admin ban đầu được tạo bằng script: backend/scripts/seed-admin.ts
-- Lệnh: npx ts-node backend/scripts/seed-admin.ts
-- Lý do: cần hash bcrypt, không thể seed bằng SQL thuần.

-- ─── Báo cáo mệt mỏi — QĐ 2288 Phụ lục III + QĐ 2289 Chương VI ────────────
-- Lưu trữ ≥ 5 năm (QĐ 2288 Điều 26.2).
-- Bảo mật: tên người báo cáo CHỈ hiển thị cho Ban An toàn - Chất lượng và Kíp trưởng.
-- Báo cáo tổng hợp KHÔNG hiển thị tên (chỉ mã ẩn danh).

CREATE TABLE IF NOT EXISTS fatigue_reports (
  id                  VARCHAR PRIMARY KEY,
  "anonCode"          VARCHAR NOT NULL UNIQUE,   -- mã ẩn danh tự sinh (FR-YYYY-NNNNNN)
  "reporterId"        VARCHAR,                   -- nullable nếu báo cáo ẩn danh
  facility            VARCHAR,
  "shiftType"         VARCHAR,                   -- DAY / NIGHT / ONCALL
  "shiftStart"        TIMESTAMPTZ,
  "shiftEnd"          TIMESTAMPTZ,
  contact             VARCHAR,
  "fatigueOnset"      VARCHAR NOT NULL,
  "kssScore"          INTEGER NOT NULL CHECK ("kssScore" BETWEEN 1 AND 9),
  "sleepHours72"      DECIMAL(4,1),
  "sleepHours24"      DECIMAL(4,1),
  "sleepQuality"      VARCHAR,
  "impactDescription" TEXT NOT NULL,
  "factorsSchedule"   JSONB DEFAULT '[]',
  "factorsOperation"  JSONB DEFAULT '[]',
  "factorsPersonal"   JSONB DEFAULT '[]',
  "factorsOther"      TEXT,
  "immediateAction"   TEXT,
  status              VARCHAR NOT NULL DEFAULT 'submitted',
  "acknowledgedBy"    VARCHAR,
  "acknowledgedAt"    TIMESTAMPTZ,
  "safetyNotified"    BOOLEAN NOT NULL DEFAULT FALSE,
  "safetyNotifiedAt"  TIMESTAMPTZ,
  "analysisNote"      TEXT,
  "closedAt"          TIMESTAMPTZ,
  "isRedLine"         BOOLEAN NOT NULL DEFAULT FALSE,
  "redLineReason"     VARCHAR,
  "extraData"         JSONB DEFAULT '{}',
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_reports_reporter ON fatigue_reports("reporterId");
CREATE INDEX IF NOT EXISTS idx_fatigue_reports_status   ON fatigue_reports(status);
CREATE INDEX IF NOT EXISTS idx_fatigue_reports_created  ON fatigue_reports("createdAt");

-- ─── Đổi ca / Trực thay — QĐ 2701 Phụ lục I + Điều 8 ──────────────────────
-- Lưu trữ ≥ 1 năm (QĐ 2701 Điều 8.5).

CREATE TABLE IF NOT EXISTS shift_exchanges (
  id                        VARCHAR PRIMARY KEY,
  type                      VARCHAR NOT NULL,       -- EXCHANGE | COVER
  "facilityType"            VARCHAR NOT NULL DEFAULT 'ACC_APP_TWR',
  "applicantRole"           VARCHAR NOT NULL DEFAULT 'KSVKL',
  "applicantId"             VARCHAR NOT NULL,
  "applicantName"           VARCHAR NOT NULL,
  "applicantTeam"           VARCHAR,
  "applicantShiftDate"      DATE NOT NULL,
  "applicantShiftCode"      VARCHAR NOT NULL,
  "counterpartyId"          VARCHAR NOT NULL,
  "counterpartyName"        VARCHAR NOT NULL,
  "counterpartyTeam"        VARCHAR,
  "counterpartyShiftDate"   DATE,
  "counterpartyShiftCode"   VARCHAR,
  status                    VARCHAR NOT NULL DEFAULT 'pending',
  "counterpartyAgreedAt"    TIMESTAMPTZ,
  "chiefApproverId"         VARCHAR,
  "chiefApproverRole"       VARCHAR,
  "chiefApprovedAt"         TIMESTAMPTZ,
  "chiefApproverId2"        VARCHAR,
  "chiefApproved2At"        TIMESTAMPTZ,
  "rejectionReason"         TEXT,
  "precheckResult"          JSONB,
  "extraData"               JSONB DEFAULT '{}',
  "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_exchanges_applicant ON shift_exchanges("applicantId");
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_status    ON shift_exchanges(status);
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_date      ON shift_exchanges("applicantShiftDate");

-- ─── Bình giảng sau ca — QĐ 2701 Phụ lục II + Điều 14 ─────────────────────
-- Lưu trữ ≥ 1 năm (QĐ 2701 Điều 14.3.đ).

CREATE TABLE IF NOT EXISTS shift_briefings (
  id                  VARCHAR PRIMARY KEY,
  team                VARCHAR NOT NULL,
  "shiftDate"         DATE NOT NULL,
  "shiftCode"         VARCHAR NOT NULL,
  level               VARCHAR NOT NULL DEFAULT 'light',  -- light | formal
  "chairId"           VARCHAR NOT NULL,
  "chairName"         VARCHAR NOT NULL,
  "chairRole"         VARCHAR,
  participants        JSONB NOT NULL DEFAULT '[]',
  "facilityRepId"     VARCHAR,
  "facilityRepName"   VARCHAR,
  "briefingContent"   TEXT NOT NULL DEFAULT '',
  "participantComments" JSONB DEFAULT '[]',
  recommendations     TEXT,
  "formalRecipients"  JSONB DEFAULT '[]',
  "hasSafetyEvent"    BOOLEAN NOT NULL DEFAULT FALSE,
  "safetyEventSummary" TEXT,
  "extraData"         JSONB DEFAULT '{}',
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefings_team_date ON shift_briefings(team, "shiftDate");
CREATE INDEX IF NOT EXISTS idx_briefings_level     ON shift_briefings(level);

-- ─── Giao ca WEST — QĐ 2701 Điều 10-12 ─────────────────────────────────────
-- Lưu trữ ≥ 1 năm.

CREATE TABLE IF NOT EXISTS shift_handovers (
  id                VARCHAR PRIMARY KEY,
  team              VARCHAR NOT NULL,
  "handoverDate"    DATE NOT NULL,
  "shiftCode"       VARCHAR NOT NULL,
  -- WEST fields
  weather           TEXT DEFAULT '',
  equipment         TEXT DEFAULT '',
  situation         TEXT DEFAULT '',
  traffic           TEXT DEFAULT '',
  -- Trạng thái
  status            VARCHAR NOT NULL DEFAULT 'draft',  -- draft | outgoing_signed | both_signed
  "outgoingSignerId"   VARCHAR,
  "outgoingSignerName" VARCHAR,
  "outgoingSignedAt"   TIMESTAMPTZ,
  "incomingSignerId"   VARCHAR,
  "incomingSignerName" VARCHAR,
  "incomingSignedAt"   TIMESTAMPTZ,
  "extraData"       JSONB DEFAULT '{}',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handovers_team_date ON shift_handovers(team, "handoverDate");

-- ─── Shifts — populate khi admin Publish schedule (C2 fix) ─────────────────
-- Dùng bởi compliance/fairness/optimize cấp ca chi tiết.

CREATE TABLE IF NOT EXISTS shifts (
  id               VARCHAR PRIMARY KEY,
  "monthKey"       VARCHAR NOT NULL,
  "controllerId"   VARCHAR NOT NULL,
  "controllerName" VARCHAR NOT NULL,
  "shiftCode"      VARCHAR NOT NULL,
  start            TIMESTAMPTZ NOT NULL,
  "end"            TIMESTAMPTZ NOT NULL,
  "isNight"        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_shifts_month_key  ON shifts("monthKey");
CREATE INDEX IF NOT EXISTS idx_shifts_controller ON shifts("controllerId");

-- ─── Shift Position Sessions — DetailedRosterModal lưu chi tiết phân vị trí ─

CREATE TABLE IF NOT EXISTS shift_position_sessions (
  id        VARCHAR PRIMARY KEY,
  "shiftId" VARCHAR NOT NULL,
  position  VARCHAR NOT NULL,
  start     TIMESTAMPTZ NOT NULL,
  "end"     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_shift ON shift_position_sessions("shiftId");

-- ─── Audit Log — P6 security sprint ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId"      varchar,
  "actorName"    varchar,
  action         varchar NOT NULL,
  "resourceType" varchar,
  "resourceId"   varchar,
  payload        jsonb,
  ip             varchar,
  "userAgent"    varchar,
  "createdAt"    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id   ON audit_logs("actorId");

-- ─── Push Subscriptions — Web Push / PWA ────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          VARCHAR PRIMARY KEY,
  "userId"    VARCHAR NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions("userId");
