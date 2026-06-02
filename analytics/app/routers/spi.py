"""
spi.py
======
Chỉ số hiệu suất an toàn (SPI) liên quan mệt mỏi — QĐ 2288 Điều 24.
Đầu ra: tổng hợp các chỉ số trong một khoảng thời gian (mặc định: tháng hiện tại).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.compliance.rest_compliance import RestRuleConfig, Severity
from app.data.database import get_session
from app.data.repository import ShiftRepository

router = APIRouter(prefix="/analytics/spi", tags=["spi"])


def _count_extended_shifts(shifts, cfg: RestRuleConfig) -> int:
    """Đếm số ca vượt max_designed_shift_hours."""
    limit = cfg.max_designed_shift_hours
    if limit is None:
        return 0
    return sum(1 for s in shifts if s.duration_hours > limit)


def _build_violations(shifts, db):
    """Chạy ComplianceChecker để lấy số vi phạm."""
    from app.compliance.rest_compliance import ComplianceChecker
    from app.data.repository import QualificationRepository
    cfg = RestRuleConfig()
    quals = QualificationRepository(db).load_qualifications()
    return ComplianceChecker(cfg).check_all(shifts, quals)


@router.get("/summary")
def get_spi_summary(
    month_key: str | None = None,
    db: Session = Depends(get_session),
):
    """Tổng hợp SPI cho 1 tháng. Nếu month_key=None thì tháng hiện tại."""
    if month_key is None:
        now = datetime.utcnow()
        month_key = f"{now.year}-{now.month:02d}"

    shifts = ShiftRepository(db).load_shifts(month_key=month_key)
    cfg    = RestRuleConfig()
    violations = _build_violations(shifts, db)

    violations_by_severity = {s.name: 0 for s in Severity}
    for v in violations:
        violations_by_severity[v.severity.name] = violations_by_severity.get(v.severity.name, 0) + 1

    extended_shift_count = _count_extended_shifts(shifts, cfg)

    return {
        "month_key": month_key,
        "spi": {
            "fatigue_reports_count": {
                "value": 0,
                "label": "Số báo cáo mệt mỏi",
                "legal_basis": "QĐ 2288 Điều 24.1.a",
                "status": "ok",
                "note": "Chờ module Phase D."
            },
            "limit_violations_critical": {
                "value": violations_by_severity.get("CRITICAL", 0),
                "label": "Vi phạm giới hạn CRITICAL",
                "legal_basis": "QĐ 2288 Điều 24.1.b",
                "status": "critical" if violations_by_severity.get("CRITICAL", 0) > 0 else "ok",
            },
            "limit_violations_warning": {
                "value": violations_by_severity.get("WARNING", 0),
                "label": "Vi phạm giới hạn WARNING",
                "legal_basis": "QĐ 2288 Điều 24.1.b",
                "status": "warning" if violations_by_severity.get("WARNING", 0) > 5 else "ok",
            },
            "deviation_count": {
                "value": 0,
                "label": "Số deviation",
                "legal_basis": "QĐ 2288 Điều 24.1.c",
                "status": "ok",
            },
            "variation_count": {
                "value": 0,
                "label": "Số variation đang áp dụng",
                "legal_basis": "QĐ 2288 Điều 24.1.d",
                "status": "ok",
            },
            "extended_shifts_count": {
                "value": extended_shift_count,
                "label": "Số ca kéo dài (> 10h)",
                "legal_basis": "QĐ 2288 Điều 24.1.h",
                "status": "warning" if extended_shift_count > 10 else "ok",
            },
            "training_completion_pct": {
                "value": None,
                "label": "Tỷ lệ hoàn thành đào tạo FMP/FRMS (%)",
                "legal_basis": "QĐ 2288 Điều 24.1.g",
                "status": "ok",
                "note": "Chờ module đào tạo."
            },
        },
    }
