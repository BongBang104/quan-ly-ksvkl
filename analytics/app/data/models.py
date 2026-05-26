"""
models.py
=========
SQLAlchemy read-only ORM models ánh xạ các bảng do NestJS/TypeORM quản lý.
Python KHÔNG tạo/migrate bảng — chỉ đọc.
"""

from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.data.database import Base


class EmployeeModel(Base):
    __tablename__ = "employees"

    id                         = Column(String, primary_key=True)
    name                       = Column(String, nullable=False)
    icao_code                  = Column("icaoCode",                String,  nullable=True)
    team                       = Column(String, nullable=True)
    role                       = Column(String, nullable=True)
    position                   = Column(String, nullable=True)
    qualification              = Column(String, nullable=True)
    qualification_expires_at   = Column("qualificationExpiresAt", String,  nullable=True)
    qualification_is_active    = Column("qualificationIsActive",  Boolean, default=True)
    is_chief                   = Column("isChief",                Boolean, default=False)
    is_vip                     = Column("isVip",                  Boolean, default=False)
    is_approved                = Column("isApproved",             Boolean, default=True)


class ScheduleModel(Base):
    __tablename__ = "schedules"

    month_key  = Column("monthKey", String, primary_key=True)
    data       = Column(JSONB, nullable=False)
    updated_at = Column("updatedAt", DateTime(timezone=True))


class SettingModel(Base):
    __tablename__ = "settings"

    id         = Column(String, primary_key=True)
    config     = Column(JSONB, nullable=False)
    updated_at = Column("updatedAt", DateTime(timezone=True))


class ShiftModel(Base):
    __tablename__ = "shifts"

    id              = Column(String, primary_key=True)
    month_key       = Column("monthKey",       String,  nullable=False, index=True)
    controller_id   = Column("controllerId",   String,  nullable=False)
    controller_name = Column("controllerName", String,  nullable=False)
    shift_code      = Column("shiftCode",      String,  nullable=False)
    start           = Column(DateTime(timezone=True), nullable=False)
    end             = Column(DateTime(timezone=True), nullable=False)
    is_night        = Column("isNight",        Boolean, default=False)


class ShiftPositionSessionModel(Base):
    __tablename__ = "shift_position_sessions"

    id       = Column(String, primary_key=True)
    shift_id = Column("shiftId",  String, nullable=False, index=True)
    position = Column(String, nullable=False)
    start    = Column(DateTime(timezone=True), nullable=False)
    end      = Column(DateTime(timezone=True), nullable=False)
