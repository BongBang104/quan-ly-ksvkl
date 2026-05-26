"""
conftest.py — SQLite in-memory fixtures for repository tests.
JSONB columns are replaced with JSON for SQLite compatibility.
"""

import pytest
from sqlalchemy import JSON, create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import sessionmaker

from app.data.database import Base


def _jsonb_to_json(engine):
    """Replace JSONB with JSON in all table columns for SQLite compatibility."""
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()


@pytest.fixture(scope="session")
def sqlite_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)
    _jsonb_to_json(engine)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture()
def db(sqlite_engine):
    Session = sessionmaker(bind=sqlite_engine)
    session = Session()
    yield session
    session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()
