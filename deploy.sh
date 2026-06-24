#!/bin/sh
set -e

if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
  echo "[deploy] dist/ trống — đang build frontend..."
  npm install && npm run build
fi

echo "[deploy] Khởi động Docker Compose..."
docker compose up -d "$@"
echo "[deploy] Xong. Kiểm tra: docker compose ps"
