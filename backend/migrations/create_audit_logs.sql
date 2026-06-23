DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
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
CREATE INDEX idx_audit_logs_created_at ON audit_logs("createdAt" DESC);
CREATE INDEX idx_audit_logs_actor_id   ON audit_logs("actorId");
