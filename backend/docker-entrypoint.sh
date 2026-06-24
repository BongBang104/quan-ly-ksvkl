#!/bin/sh
set -e

echo "[entrypoint] Waiting for PostgreSQL to be ready..."
until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "[entrypoint] PostgreSQL not ready yet — retrying in 2s..."
  sleep 2
done
echo "[entrypoint] PostgreSQL is ready."

echo "[entrypoint] Running migration..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /app/migration.sql
echo "[entrypoint] Migration complete."

echo "[entrypoint] Starting NestJS..."
exec node dist/main
