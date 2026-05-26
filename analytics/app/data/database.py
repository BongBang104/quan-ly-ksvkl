"""
database.py
===========
SQLAlchemy engine + session — CHỈ ĐỌC. Python không bao giờ ghi vào DB nghiệp vụ.
"""

import re
from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import Settings


def _normalize_url(raw: str) -> str:
    """Chuyển URL kiểu Prisma/NestJS sang psycopg3 driver."""
    url = raw
    # postgresql:// or postgres:// -> postgresql+psycopg://
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+psycopg://", url)
    return url


@lru_cache(maxsize=1)
def get_engine():
    cfg = Settings()
    url = _normalize_url(cfg.database_url)
    engine = create_engine(url, pool_pre_ping=True, echo=False)

    # Enforce read-only at connection level
    @event.listens_for(engine, "connect")
    def _set_readonly(dbapi_conn, _record):
        dbapi_conn.autocommit = False
        dbapi_conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")

    return engine


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=None)


def get_session():
    engine = get_engine()
    SessionLocal.configure(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Base(DeclarativeBase):
    pass
