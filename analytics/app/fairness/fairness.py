"""
fairness.py
===========
Phân tích công bằng phân ca: tổng giờ trực, số ca đêm, số ngày nghỉ theo KSVKL.

LƯU Ý: Đây là CÔNG CỤ HỖ TRỢ. Các ngưỡng CHỈ LÀ VÍ DỤ.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.domain import Shift


@dataclass
class ControllerStats:
    controller_id:   str
    controller_name: str
    total_hours:     float = 0.0
    night_shifts:    int   = 0
    shift_count:     int   = 0
    duty_dates:      set   = field(default_factory=set)

    @property
    def work_days(self) -> int:
        return len(self.duty_dates)

    def to_dict(self) -> dict[str, Any]:
        return {
            "controller_id":   self.controller_id,
            "controller_name": self.controller_name,
            "total_hours":     round(self.total_hours, 2),
            "night_shifts":    self.night_shifts,
            "shift_count":     self.shift_count,
            "work_days":       self.work_days,
        }


@dataclass
class FairnessSummary:
    stats:             list[ControllerStats]
    avg_hours:         float
    std_hours:         float
    max_delta_hours:   float   # max deviation from average

    def to_dict(self) -> dict[str, Any]:
        return {
            "avg_hours":       round(self.avg_hours, 2),
            "std_hours":       round(self.std_hours, 2),
            "max_delta_hours": round(self.max_delta_hours, 2),
            "controllers":     [s.to_dict() for s in self.stats],
        }


def compute_fairness(shifts: list[Shift]) -> FairnessSummary:
    by_controller: dict[str, ControllerStats] = {}
    for s in shifts:
        st = by_controller.setdefault(
            s.controller_id,
            ControllerStats(s.controller_id, s.controller_name),
        )
        st.total_hours += s.duration_hours
        st.shift_count += 1
        st.duty_dates.add(s.duty_date)
        if s.is_night:
            st.night_shifts += 1

    stats = list(by_controller.values())
    if not stats:
        return FairnessSummary(stats=[], avg_hours=0.0, std_hours=0.0, max_delta_hours=0.0)

    hours = [s.total_hours for s in stats]
    avg = sum(hours) / len(hours)
    variance = sum((h - avg) ** 2 for h in hours) / len(hours)
    std = variance ** 0.5
    max_delta = max(abs(h - avg) for h in hours)

    return FairnessSummary(stats=stats, avg_hours=avg, std_hours=std, max_delta_hours=max_delta)
