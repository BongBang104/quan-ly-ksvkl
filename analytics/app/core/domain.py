"""
domain.py
=========
Re-exports all shared domain types from the compliance module.
Import from here in data/repository, fairness, and routers.
"""

from app.compliance.rest_compliance import (  # noqa: F401
    ALL_POSITIONS,
    ComplianceChecker,
    Position,
    PositionSession,
    Qualification,
    RestRuleConfig,
    Severity,
    Shift,
    Violation,
    format_report,
    merge_position_runs,
)
