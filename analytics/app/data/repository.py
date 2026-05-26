"""
repository.py
=============
Đọc dữ liệu từ PostgreSQL, chuyển đổi sang domain objects cho analytics.
Read-only. Python không ghi vào DB nghiệp vụ.
"""

from __future__ import annotations

from datetime import date
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.domain import (
    Position, PositionSession, Qualification, Shift,
)
from app.data.models import (
    EmployeeModel, SettingModel, ShiftModel, ShiftPositionSessionModel,
)

_VN = ZoneInfo("Asia/Ho_Chi_Minh")

# Map qualification string (từ settings) -> Position enum
_QUAL_MAP: dict[str, set[Position]] = {
    "full":     set(Position),
    "ctl":      {Position.CTL},
    "app":      {Position.APP},
    "twr":      {Position.TWR},
    "gcu":      {Position.GCU},
    "gnd":      {Position.GCU},   # GND mapped to GCU
    "twr/app":  {Position.TWR, Position.APP},
    "app/twr":  {Position.TWR, Position.APP},
}


def _parse_qualification(
    emp_id: str,
    qual_str: str | None,
    *,
    expires_at: date | None = None,
    is_active: bool = True,
    controller_name: str = "",
) -> Qualification:
    if not qual_str:
        return Qualification(
            controller_id=emp_id, is_full=False, positions=frozenset(),
            expires_at=expires_at, is_active=is_active, controller_name=controller_name,
        )
    key = qual_str.strip().lower()
    if key == "full" or key.startswith("full"):
        return Qualification(
            controller_id=emp_id, is_full=True,
            expires_at=expires_at, is_active=is_active, controller_name=controller_name,
        )
    positions = _QUAL_MAP.get(key, set())
    return Qualification(
        controller_id=emp_id, is_full=False, positions=frozenset(positions),
        expires_at=expires_at, is_active=is_active, controller_name=controller_name,
    )


def _to_naive_vn(dt) -> object:
    """Chuyển timestamptz (UTC) sang naive datetime theo Asia/Ho_Chi_Minh."""
    if dt is None:
        return dt
    if dt.tzinfo is not None:
        dt = dt.astimezone(_VN).replace(tzinfo=None)
    return dt


def _parse_expires_at(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw))
    except (ValueError, TypeError):
        return None


class QualificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def load_qualifications(self) -> dict[str, Qualification]:
        employees = self.db.query(EmployeeModel).filter(
            EmployeeModel.is_approved == True  # noqa: E712
        ).all()
        return {
            emp.id: _parse_qualification(
                emp.id, emp.qualification,
                expires_at=_parse_expires_at(emp.qualification_expires_at),
                is_active=bool(emp.qualification_is_active),
                controller_name=emp.name or "",
            )
            for emp in employees
        }


class ShiftRepository:
    def __init__(self, db: Session):
        self.db = db

    def load_shifts(self, month_key: str | None = None) -> list[Shift]:
        q = self.db.query(ShiftModel)
        if month_key:
            q = q.filter(ShiftModel.month_key == month_key)
        shift_rows = q.all()
        if not shift_rows:
            return []

        shift_ids = [s.id for s in shift_rows]
        session_rows = (
            self.db.query(ShiftPositionSessionModel)
            .filter(ShiftPositionSessionModel.shift_id.in_(shift_ids))
            .all()
        )

        sessions_by_shift: dict[str, list[PositionSession]] = {}
        for sess in session_rows:
            try:
                pos = Position(sess.position)
            except ValueError:
                continue
            ps = PositionSession(
                position=pos,
                start=_to_naive_vn(sess.start),
                end=_to_naive_vn(sess.end),
            )
            sessions_by_shift.setdefault(sess.shift_id, []).append(ps)

        result: list[Shift] = []
        for row in shift_rows:
            result.append(Shift(
                shift_id=row.id,
                controller_id=row.controller_id,
                controller_name=row.controller_name,
                start=_to_naive_vn(row.start),
                end=_to_naive_vn(row.end),
                is_night=bool(row.is_night),
                sessions=sessions_by_shift.get(row.id, []),
            ))
        return result
