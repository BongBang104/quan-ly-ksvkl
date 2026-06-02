"""Schemas cho rà soát phân ca cấp trung tâm (SchedulerScreen).

Cấp trung tâm phân *KSVKL X làm kíp/ca Y vào ngày Z*, chưa đến mức phân vị trí.
Quy tắc kiểm tra khác hẳn cấp ca chi tiết — xem rest_compliance + chu_ky_review.
"""
from __future__ import annotations
from datetime import date
from pydantic import BaseModel, Field


class ControllerMacroInfo(BaseModel):
    """Thông tin KSVKL gửi kèm draft cấp tháng."""
    id: str
    name: str
    abbr: str = ""
    team: str = Field(..., description="Kíp A/B/C/D... hoặc 'Trung tâm'")
    qualification: str = ""


class DayAssignment(BaseModel):
    """Một ngày, một KSVKL, một loại ca."""
    date: date
    controller_id: str
    shift_kind: str = Field(
        ...,
        description="'S' (ngày), 'D' (đêm), 'OFF', 'ONCALL', 'LEAVE', 'TRAINING', 'REINFORCE'",
    )
    start_hour: int | None = None
    end_hour:   int | None = None


class MacroRosterDraft(BaseModel):
    """Bản phân ca cấp tháng / chu kỳ 14 ngày, gửi từ SchedulerScreen."""
    period_start: date
    period_end:   date
    controllers:  list[ControllerMacroInfo]
    assignments:  list[DayAssignment]


class MacroReviewResult(BaseModel):
    can_publish:       bool
    violations:        list[dict]
    suggestions:       list[dict]
    coverage_warnings: list[dict] = Field(
        default_factory=list,
        description="Cảnh báo về ngày thiếu năng định bao phủ trong kíp trực.",
    )
