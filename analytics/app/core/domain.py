"""
domain.py
=========
Re-exports all shared domain types from the compliance module.
Import from here in data/repository, fairness, and routers.
"""

from app.compliance.rest_compliance import (  # noqa: F401
    ALL_POSITIONS,
    AUXILIARY_POSITIONS,
    ComplianceChecker,
    OncallAssignment,
    Position,
    PositionSession,
    Qualification,
    RestRuleConfig,
    Severity,
    Shift,
    ShiftKind,
    Violation,
    check_oncall_limits,
    classify_shift_kind,
    format_report,
    merge_position_runs,
)
