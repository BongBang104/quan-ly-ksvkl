"""
test_repository.py
==================
Test ShiftRepository và QualificationRepository trên SQLite in-memory.
"""

from datetime import datetime, timezone

from app.data.models import EmployeeModel, ShiftModel, ShiftPositionSessionModel
from app.data.repository import QualificationRepository, ShiftRepository
from app.core.domain import Position


# ===================== QualificationRepository =====================

def test_load_qualifications_full(db):
    db.add(EmployeeModel(id="E1", name="A", qualification="Full", is_approved=True))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    assert "E1" in quals
    assert quals["E1"].is_full is True


def test_load_qualifications_partial(db):
    db.add(EmployeeModel(id="E2", name="B", qualification="TWR", is_approved=True))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    q = quals["E2"]
    assert not q.is_full
    assert q.can_work(Position.TWR)
    assert not q.can_work(Position.APP)


def test_load_qualifications_none(db):
    db.add(EmployeeModel(id="E3", name="C", qualification=None, is_approved=True))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    q = quals["E3"]
    assert not q.is_full
    assert q.positions == frozenset()


def test_unapproved_employees_excluded(db):
    db.add(EmployeeModel(id="E4", name="D", qualification="Full", is_approved=False))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    assert "E4" not in quals


def test_twr_app_combined(db):
    db.add(EmployeeModel(id="E5", name="E", qualification="TWR/APP", is_approved=True))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    q = quals["E5"]
    assert q.can_work(Position.TWR) and q.can_work(Position.APP)
    assert not q.can_work(Position.CTL)


# ===================== QualificationRepository — Phase 2 expiry fields =====================

def test_load_qualifications_expiry_date(db):
    db.add(EmployeeModel(
        id="EX1", name="F", qualification="Full", is_approved=True,
        qualification_expires_at="2026-12-31", qualification_is_active=True,
    ))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    from datetime import date
    assert quals["EX1"].expires_at == date(2026, 12, 31)
    assert quals["EX1"].is_active is True


def test_load_qualifications_inactive(db):
    db.add(EmployeeModel(
        id="EX2", name="G", qualification="TWR", is_approved=True,
        qualification_is_active=False,
    ))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    assert quals["EX2"].is_active is False


def test_load_qualifications_no_expiry(db):
    db.add(EmployeeModel(id="EX3", name="H", qualification="APP", is_approved=True))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    assert quals["EX3"].expires_at is None


def test_load_qualifications_controller_name(db):
    db.add(EmployeeModel(id="EX4", name="Nguyen Van A", qualification="Full", is_approved=True))
    db.commit()
    quals = QualificationRepository(db).load_qualifications()
    assert quals["EX4"].controller_name == "Nguyen Van A"


# ===================== ShiftRepository =====================

def _dt(iso: str) -> datetime:
    """Parse ISO string as UTC-aware datetime."""
    return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)


def test_load_shifts_basic(db):
    db.add(ShiftModel(
        id="MK1|E1|2026-06-01|S", month_key="MK1",
        controller_id="E1", controller_name="Alice",
        shift_code="S", start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T12:00:00"),
        is_night=False,
    ))
    db.commit()
    shifts = ShiftRepository(db).load_shifts(month_key="MK1")
    assert len(shifts) == 1
    s = shifts[0]
    assert s.controller_id == "E1"
    assert s.controller_name == "Alice"
    assert s.sessions == []


def test_load_shifts_with_sessions(db):
    db.add(ShiftModel(
        id="MK2|E1|2026-06-01|S", month_key="MK2",
        controller_id="E1", controller_name="Alice",
        shift_code="S", start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T12:00:00"),
        is_night=False,
    ))
    db.add(ShiftPositionSessionModel(
        id="sess1", shift_id="MK2|E1|2026-06-01|S",
        position="TWR",
        start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T06:00:00"),
    ))
    db.commit()
    shifts = ShiftRepository(db).load_shifts(month_key="MK2")
    assert len(shifts[0].sessions) == 1
    assert shifts[0].sessions[0].position == Position.TWR


def test_load_shifts_filters_by_month(db):
    for mk in ["MK3", "MK4"]:
        db.add(ShiftModel(
            id=f"{mk}|E1|2026-06-01|S", month_key=mk,
            controller_id="E1", controller_name="Alice",
            shift_code="S", start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T12:00:00"),
            is_night=False,
        ))
    db.commit()
    shifts = ShiftRepository(db).load_shifts(month_key="MK3")
    assert len(shifts) == 1
    assert shifts[0].shift_id.startswith("MK3")


def test_load_shifts_unknown_position_skipped(db):
    db.add(ShiftModel(
        id="MK5|E1|2026-06-01|S", month_key="MK5",
        controller_id="E1", controller_name="Alice",
        shift_code="S", start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T12:00:00"),
        is_night=False,
    ))
    db.add(ShiftPositionSessionModel(
        id="sess_bad", shift_id="MK5|E1|2026-06-01|S",
        position="UNKNOWN",
        start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T06:00:00"),
    ))
    db.commit()
    shifts = ShiftRepository(db).load_shifts(month_key="MK5")
    assert shifts[0].sessions == []


def test_load_all_shifts_no_filter(db):
    for mk in ["MK6", "MK7"]:
        db.add(ShiftModel(
            id=f"{mk}|E1|2026-06-01|S", month_key=mk,
            controller_id="E1", controller_name="Alice",
            shift_code="S", start=_dt("2026-06-01T00:00:00"), end=_dt("2026-06-01T12:00:00"),
            is_night=False,
        ))
    db.commit()
    shifts = ShiftRepository(db).load_shifts()
    assert len(shifts) == 2
