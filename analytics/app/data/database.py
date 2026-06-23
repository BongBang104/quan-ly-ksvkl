"""
database.py
===========
SQLAlchemy engine + session — CHỈ ĐỌC. Python không bao giờ ghi vào DB nghiệp vụ.
"""

import re
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import Settings


def _normalize_url(raw: str) -> str:
    """Chuyển URL kiểu Prisma/NestJS sang psycopg3 driver."""
    url = re.sub(r"^postgres(?:ql)?://", "postgresql+psycopg://", raw)
    return url


@lru_cache(maxsize=1)
def get_engine():
    cfg = Settings()
    url = _normalize_url(cfg.database_url)
    engine = create_engine(
        url,
        pool_pre_ping=True,
        echo=False,
        # Dùng PostgreSQL GUC thay vì SET SESSION — an toàn với psycopg3 (không cần autocommit)
        connect_args={"options": "-c default_transaction_read_only=on"},
    )
    return engine


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=None)


def get_session():
    engine = get_engine()
    SessionLocal.configure(bind=engine)
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


class Base(DeclarativeBase):
    pass
