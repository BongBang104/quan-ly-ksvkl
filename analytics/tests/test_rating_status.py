"""
test_rating_status.py
=====================
Test module quản lý năng định: cảnh báo hết hạn + thống kê phủ năng định.

Nguyên tắc: đọc ngưỡng ĐỘNG từ hàm (không gán số cứng).
"""

from datetime import date, timedelta

import pytest

from app.core.domain import Position, Qualification
from app.ratings.rating_status import (
    DEFAULT_CRITICAL_DAYS,
    DEFAULT_MIN_COVERAGE,
    DEFAULT_WARN_DAYS,
    ExpiryAlert,
    compute_coverage,
    compute_expiry_alerts,
)

TODAY = date(2026, 6, 1)


def make_qual(cid, is_full=False, positions=None, expires_at=None, is_active=True, name=""):
    return Qualification(
        controller_id=cid,
        is_full=is_full,
        positions=frozenset(positions or []),
        expires_at=expires_at,
        is_active=is_active,
        controller_name=name or f"C{cid}",
    )


# ===================== compute_expiry_alerts =====================

def test_no_expiry_no_alert():
    """Năng định không có ngày hết hạn -> không sinh cảnh báo."""
    q = make_qual("E1", is_full=True, name="Alice")
    assert compute_expiry_alerts([q], as_of=TODAY) == []


def test_expired_raises_expired():
    past = TODAY - timedelta(days=10)
    q = make_qual("E1", is_full=True, expires_at=past, name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    assert len(alerts) == 1
    assert alerts[0].severity == "EXPIRED"
    assert alerts[0].days_remaining == -10


def test_critical_within_critical_days():
    exp = TODAY + timedelta(days=DEFAULT_CRITICAL_DAYS - 1)
    q = make_qual("E1", is_full=True, expires_at=exp, name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    assert len(alerts) == 1
    assert alerts[0].severity == "CRITICAL"


def test_warning_within_warn_days():
    exp = TODAY + timedelta(days=DEFAULT_CRITICAL_DAYS + 1)
    q = make_qual("E1", is_full=True, expires_at=exp, name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY, warn_days=DEFAULT_WARN_DAYS)
    assert len(alerts) == 1
    assert alerts[0].severity == "WARNING"


def test_no_alert_when_far_future():
    exp = TODAY + timedelta(days=DEFAULT_WARN_DAYS + 1)
    q = make_qual("E1", is_full=True, expires_at=exp, name="Alice")
    assert compute_expiry_alerts([q], as_of=TODAY) == []


def test_inactive_raises_inactive_regardless_of_expiry():
    q = make_qual("E1", is_full=True, expires_at=None, is_active=False, name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    assert len(alerts) == 1
    assert alerts[0].severity == "INACTIVE"
    assert alerts[0].days_remaining is None


def test_inactive_with_future_expiry_still_inactive():
    exp = TODAY + timedelta(days=90)
    q = make_qual("E1", is_full=True, expires_at=exp, is_active=False, name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    assert alerts[0].severity == "INACTIVE"


def test_qualification_label_full():
    q = make_qual("E1", is_full=True, expires_at=TODAY - timedelta(1), name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    assert alerts[0].qualification_label == "FULL"


def test_qualification_label_partial():
    q = make_qual("E1", positions=[Position.TWR, Position.GCU],
                  expires_at=TODAY - timedelta(1), name="Bob")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    assert "GCU" in alerts[0].qualification_label
    assert "TWR" in alerts[0].qualification_label


def test_alerts_sorted_most_urgent_first():
    past = TODAY - timedelta(days=5)
    soon = TODAY + timedelta(days=DEFAULT_CRITICAL_DAYS - 1)
    q1 = make_qual("E1", is_full=True, expires_at=soon, name="Alice")
    q2 = make_qual("E2", is_full=True, expires_at=past, name="Bob")
    alerts = compute_expiry_alerts([q1, q2], as_of=TODAY)
    assert alerts[0].controller_id == "E2"   # đã hết hạn = urgent nhất (days_remaining âm)


def test_accepts_dict_input():
    q = make_qual("E1", is_full=True, expires_at=TODAY - timedelta(1), name="Alice")
    alerts = compute_expiry_alerts({"E1": q}, as_of=TODAY)
    assert len(alerts) == 1


def test_to_dict_shape():
    q = make_qual("E1", is_full=True, expires_at=TODAY - timedelta(1), name="Alice")
    alerts = compute_expiry_alerts([q], as_of=TODAY)
    d = alerts[0].to_dict()
    assert set(d.keys()) == {
        "controller_id", "controller_name", "qualification_label",
        "expires_at", "days_remaining", "severity",
    }


# ===================== compute_coverage =====================

def test_full_controller_counted_for_all_positions():
    """Người full được tính vào MỌI vị trí."""
    q = make_qual("E1", is_full=True, name="Alice")
    report = compute_coverage([q], as_of=TODAY)
    for pos_cov in report.positions:
        assert pos_cov.qualified_count == 1
        assert pos_cov.active_count == 1


def test_partial_controller_only_for_own_positions():
    q = make_qual("E1", positions=[Position.TWR], name="Bob")
    report = compute_coverage([q], as_of=TODAY)
    twr = next(p for p in report.positions if p.position == Position.TWR)
    app = next(p for p in report.positions if p.position == Position.APP)
    assert twr.active_count == 1
    assert app.active_count == 0


def test_expired_not_counted_as_active():
    q = make_qual("E1", is_full=True, expires_at=TODAY - timedelta(1), name="Alice")
    report = compute_coverage([q], as_of=TODAY)
    for pos_cov in report.positions:
        assert pos_cov.qualified_count == 1
        assert pos_cov.active_count == 0


def test_inactive_not_counted_as_active():
    q = make_qual("E1", is_full=True, is_active=False, name="Alice")
    report = compute_coverage([q], as_of=TODAY)
    for pos_cov in report.positions:
        assert pos_cov.active_count == 0
        assert pos_cov.qualified_count == 1


def test_sufficient_flag_at_threshold():
    min_cov = DEFAULT_MIN_COVERAGE
    quals = [make_qual(f"E{i}", is_full=True) for i in range(min_cov)]
    report = compute_coverage(quals, as_of=TODAY, min_required=min_cov)
    for pos_cov in report.positions:
        assert pos_cov.is_sufficient


def test_insufficient_flag_below_threshold():
    min_cov = DEFAULT_MIN_COVERAGE
    quals = [make_qual("E1", is_full=True)]
    report = compute_coverage(quals, as_of=TODAY, min_required=min_cov)
    for pos_cov in report.positions:
        assert not pos_cov.is_sufficient


def test_insufficient_positions_reported():
    from app.core.domain import ALL_POSITIONS
    q = make_qual("E1", positions=[Position.APP], name="Alice")
    report = compute_coverage([q], as_of=TODAY, min_required=DEFAULT_MIN_COVERAGE)
    # APP có 1 người (dưới ngưỡng mặc định 2), CTL/TWR/GCU/... có 0 -> tất cả insufficient
    # Auxiliary positions (HDA/HDC/HDT/HDG) không tính trong phủ sóng
    assert len(report.insufficient_positions) == len(ALL_POSITIONS)


def test_total_active_full_counted():
    q1 = make_qual("E1", is_full=True, name="Alice")
    q2 = make_qual("E2", is_full=True, expires_at=TODAY - timedelta(1), name="Bob")
    q3 = make_qual("E3", positions=[Position.TWR], name="Carol")
    report = compute_coverage([q1, q2, q3], as_of=TODAY)
    assert report.total_active_full == 1   # chỉ E1 còn hiệu lực full
    assert report.total_controllers == 3


def test_mixed_full_and_partial():
    """Một full + một TWR riêng lẻ -> TWR có 2 người đủ năng định."""
    q_full = make_qual("E1", is_full=True, name="Alice")
    q_twr  = make_qual("E2", positions=[Position.TWR], name="Bob")
    report = compute_coverage([q_full, q_twr], as_of=TODAY)
    twr = next(p for p in report.positions if p.position == Position.TWR)
    app = next(p for p in report.positions if p.position == Position.APP)
    assert twr.active_count == 2   # full + TWR riêng lẻ
    assert app.active_count == 1   # chỉ full


def test_coverage_to_dict_shape():
    q = make_qual("E1", is_full=True)
    d = compute_coverage([q], as_of=TODAY).to_dict()
    assert set(d.keys()) == {
        "as_of", "positions", "total_controllers",
        "total_active_full", "insufficient_positions",
    }


def test_coverage_accepts_dict_input():
    q = make_qual("E1", is_full=True)
    report = compute_coverage({"E1": q}, as_of=TODAY)
    assert report.total_controllers == 1


def test_empty_qualifications():
    report = compute_coverage([], as_of=TODAY)
    assert report.total_controllers == 0
    assert all(p.active_count == 0 for p in report.positions)
    assert report.total_active_full == 0
