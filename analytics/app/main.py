"""
main.py
=======
FastAPI analytics service — CHỈ ĐỌC.

LƯU Ý AN TOÀN:
- Dịch vụ truy cập DB ở chế độ CHỈ ĐỌC.
- Các ngưỡng pháp lý bám theo QĐ 2288/QĐ-QLB ngày 25/3/2026 (Quản lý rủi ro mệt mỏi),
  bổ trợ bởi QĐ 2701/QĐ-QLB ngày 07/5/2024 (chế độ ca, kíp trực) và
  QĐ 2289/QĐ-QLB ngày 25/3/2026 (Chương trình FMP).
- Khi quy định pháp lý thay đổi, cập nhật RestRuleConfig.effective_from và các trường tương ứng.
- Dịch vụ này HỖ TRỢ ra quyết định, KHÔNG thay thế quy trình phê duyệt chính thức.
- Tinh thần Just Culture theo QĐ 2288 Điều 8 và QĐ 2289 Chương I.V.5.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import compliance, exchange, fairness, optimize, ratings, roster, spi

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
app.include_router(spi.router)
app.include_router(exchange.router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
