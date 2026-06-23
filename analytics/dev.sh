#!/bin/bash
set -e
if [ -f ".venv/bin/uvicorn" ]; then
    echo "[FAST] Starting FastAPI Analytics on port 8001..."
    .venv/bin/uvicorn app.main:app --reload --port 8001 --host 127.0.0.1
else
    echo "[FAST] ERROR: .venv not found in analytics/"
    echo "[FAST] Setup once with:"
    echo "[FAST]   cd analytics && python -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
fi
