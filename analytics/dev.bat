@echo off
if exist ".venv\Scripts\uvicorn.exe" (
    echo [FAST] Starting FastAPI with virtualenv...
    .venv\Scripts\uvicorn app.main:app --reload --port 8000
) else (
    echo [FAST] .venv not found. Set up once with:
    echo [FAST]   cd analytics
    echo [FAST]   python -m venv .venv
    echo [FAST]   .venv\Scripts\pip install -r requirements.txt
    echo [FAST] Trying global uvicorn...
    uvicorn app.main:app --reload --port 8000
)
