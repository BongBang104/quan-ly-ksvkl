@echo off
if exist ".venv\Scripts\uvicorn.exe" (
    echo [FAST] Starting FastAPI Analytics on port 8001...
    .venv\Scripts\uvicorn app.main:app --reload --port 8001 --host 127.0.0.1
) else (
    echo [FAST] ERROR: .venv not found in analytics/
    echo [FAST] Setup once with:
    echo [FAST]   cd analytics
    echo [FAST]   python -m venv .venv
    echo [FAST]   .venv\Scripts\pip install -r requirements.txt
    exit /b 1
)
