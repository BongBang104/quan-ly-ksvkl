"""
rating_status.py
================
Quản lý vòng đời năng định KSVKL: cảnh báo hết hạn và thống kê phủ năng định.

LƯU Ý AN TOÀN:
- Ngưỡng ngày cảnh báo CHỈ LÀ VÍ DỤ — thay bằng số liệu VATM/CAAV/ICAO chính thức.
- Đây là CÔNG CỤ HỖ TRỢ. Người phụ trách vẫn chịu trách nhiệm cuối cùng.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.core.domain import ALL_POSITIONS, Position, Qualification


# Ngưỡng cảnh báo mặc định (CHỈ LÀ VÍ DỤ):
DEFAULT_WARN_DAYS = 60          # cảnh báo nếu hết hạn trong vòng 60 ngày
DEFAULT_CRITICAL_DAYS = 30      # nghiêm trọng nếu hết hạn trong vòng 30 ngày
DEFAULT_MIN_COVERAGE = 2        # tối thiểu 2 người đủ năng định mỗi vị trí


@dataclass
class ExpiryAlert:
    """Cảnh báo một năng định sắp hết hạn hoặc đã hết hạn."""
    controller_id:   str
    controller_name: str
    qualification_label: str    # 'FULL' | 'TWR' | 'APP' | 'CTL' | 'GCU' | 'INACTIVE'
    expires_at:      date | None
    days_remaining:  int | None   # None nếu không có expires_at
    severity:        str          # 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'INACTIVE'

    def to_dict(self) -> dict[str, Any]:
        return {
            "controller_id":       self.controller_id,
            "controller_name":     self.controller_name,
            "qualification_label": self.qualification_label,
            "expires_at":          self.expires_at.isoformat() if self.expires_at else None,
            "days_remaining":      self.days_remaining,
            "severity":            self.severity,
        }


@dataclass
class PositionCoverage:
    """Thống kê phủ năng định cho một vị trí."""
    position:       Position
    qualified_count: int    # tổng số người đủ năng định (bao gồm cả không active)
    active_count:   int     # người đủ năng định VÀ is_active=True VÀ chưa hết hạn
    is_sufficient:  bool    # active_count >= min_required

    def to_dict(self) -> dict[str, Any]:
        return {
            "position":       self.position.value,
            "qualified_count": self.qualified_count,
            "active_count":   self.active_count,
            "is_sufficient":  self.is_sufficient,
        }


@dataclass
class CoverageReport:
    """Báo cáo phủ năng định toàn đơn vị."""
    as_of:                   date
    positions:               list[PositionCoverage]
    total_controllers:       int
    total_active_full:       int    # số người năng định full còn hiệu lực
    insufficient_positions:  list[str]   # position.value của các vị trí thiếu người

    def to_dict(self) -> dict[str, Any]:
        return {
            "as_of":                  self.as_of.isoformat(),
            "positions":              [p.to_dict() for p in self.positions],
            "total_controllers":      self.total_controllers,
            "total_active_full":      self.total_active_full,
            "insufficient_positions": self.insufficient_positions,
        }


def _is_effective(qual: Qualification, as_of: date) -> bool:
    """Năng định còn hiệu lực: is_active=True VÀ chưa hết hạn."""
    if not qual.is_active:
        return False
    if qual.expires_at is not None and qual.expires_at < as_of:
        return False
    return True


def compute_expiry_alerts(
    qualifications: list[Qualification] | dict[str, Qualification],
    as_of: date | None = None,
    warn_days: int = DEFAULT_WARN_DAYS,
    critical_days: int = DEFAULT_CRITICAL_DAYS,
) -> list[ExpiryAlert]:
    """Sinh danh sách cảnh báo hết hạn năng định.

    Phân loại:
    - INACTIVE : is_active = False (bị vô hiệu hóa)
    - EXPIRED  : expires_at đã qua (nhưng vẫn is_active=True)
    - CRITICAL : hết hạn trong vòng critical_days ngày
    - WARNING  : hết hạn trong vòng warn_days ngày
    """
    today = as_of or date.today()
    quals: list[Qualification] = (
        list(qualifications.values()) if isinstance(qualifications, dict)
        else qualifications
    )
    alerts: list[ExpiryAlert] = []
    for q in quals:
        label = "FULL" if q.is_full else (
            "/".join(sorted(p.value for p in q.positions)) or "NONE"
        )
        name = q.controller_name or str(q.controller_id)

        if not q.is_active:
            alerts.append(ExpiryAlert(
                controller_id=str(q.controller_id), controller_name=name,
                qualification_label=label, expires_at=q.expires_at,
                days_remaining=None, severity="INACTIVE",
            ))
            continue

        if q.expires_at is None:
            continue   # không có ngày hết hạn -> không cần cảnh báo

        days = (q.expires_at - today).days
        if days < 0:
            severity = "EXPIRED"
        elif days <= critical_days:
            severity = "CRITICAL"
        elif days <= warn_days:
            severity = "WARNING"
        else:
            continue   # còn đủ thời gian

        alerts.append(ExpiryAlert(
            controller_id=str(q.controller_id), controller_name=name,
            qualification_label=label, expires_at=q.expires_at,
            days_remaining=days, severity=severity,
        ))

    alerts.sort(key=lambda a: (a.days_remaining if a.days_remaining is not None else -9999))
    return alerts


def compute_coverage(
    qualifications: list[Qualification] | dict[str, Qualification],
    as_of: date | None = None,
    min_required: int = DEFAULT_MIN_COVERAGE,
) -> CoverageReport:
    """Thống kê số KSVKL đủ năng định cho từng vị trí.

    Người FULL được tính vào MỌI vị trí (APP + CTL + TWR + GCU).
    """
    today = as_of or date.today()
    quals: list[Qualification] = (
        list(qualifications.values()) if isinstance(qualifications, dict)
        else qualifications
    )

    qualified: dict[Position, int] = {p: 0 for p in Position}
    active:    dict[Position, int] = {p: 0 for p in Position}
    total_full = 0

    for q in quals:
        effective = _is_effective(q, today)
        for pos in Position:
            if q.can_work(pos):
                qualified[pos] += 1
                if effective:
                    active[pos] += 1
        if q.is_full and effective:
            total_full += 1

    positions = [
        PositionCoverage(
            position=pos,
            qualified_count=qualified[pos],
            active_count=active[pos],
            is_sufficient=(active[pos] >= min_required),
        )
        for pos in sorted(Position, key=lambda p: p.value)
    ]
    insufficient = [p.position.value for p in positions if not p.is_sufficient]

    return CoverageReport(
        as_of=today,
        positions=positions,
        total_controllers=len(quals),
        total_active_full=total_full,
        insufficient_positions=insufficient,
    )
