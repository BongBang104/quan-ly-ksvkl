"""
main.py
=======
FastAPI analytics service — CHỈ ĐỌC.

LƯU Ý AN TOÀN:
- Dịch vụ truy cập DB ở chế độ CHỈ ĐỌC.
- Mọi ngưỡng quy định CHỈ LÀ GIÁ TRỊ VÍ DỤ — thay bằng số liệu VATM/CAAV/ICAO thực tế.
- Dịch vụ này HỖ TRỢ ra quyết định, KHÔNG thay thế quy trình phê duyệt chính thức.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import compliance, fairness, optimize, ratings, roster

app = FastAPI(
    title="KSVKL Analytics",
    version="1.0.0",
    description="Analytics read-only service cho hệ thống quản lý KSVKL.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(compliance.router)
app.include_router(fairness.router)
app.include_router(roster.router)
app.include_router(ratings.router)
app.include_router(optimize.router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
