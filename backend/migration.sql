-- ATC Pro — PostgreSQL schema
-- Run this if you prefer manual migration over synchronize:true

CREATE TABLE IF NOT EXISTS employees (
  id           VARCHAR PRIMARY KEY,
  name         VARCHAR NOT NULL,
  "icaoCode"   VARCHAR,
  team         VARCHAR,
  role         VARCHAR NOT NULL DEFAULT 'user',
  position     VARCHAR,
  qualification VARCHAR,
  "isChief"    BOOLEAN NOT NULL DEFAULT FALSE,
  "isVip"      BOOLEAN NOT NULL DEFAULT FALSE,
  phone        VARCHAR,
  email        VARCHAR,
  password     VARCHAR NOT NULL DEFAULT 'tctsdn123',
  "isFirstLogin" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Seed a default admin account (password: tctsdn123)
INSERT INTO employees (id, name, role, password, "isFirstLogin")
VALUES ('admin', 'Administrator', 'admin', 'tctsdn123', TRUE)
ON CONFLICT (id) DO NOTHING;
