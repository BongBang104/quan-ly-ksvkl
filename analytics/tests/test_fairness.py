"""
test_fairness.py
================
Test compute_fairness trên dữ liệu tổng hợp.
"""

from datetime import datetime, timedelta

from app.core.domain import Shift
from app.fairness.fairness import compute_fairness, FairnessSummary


BASE = datetime(2026, 6, 1, 7, 0)


def make_shift(sid, cid, name, start, hours, is_night=False):
    return Shift(
        shift_id=sid, controller_id=cid, controller_name=name,
        start=start, end=start + timedelta(hours=hours),
        is_night=is_night,
    )


def test_empty_returns_zeros():
    s = compute_fairness([])
    assert s.avg_hours == 0.0
    assert s.std_hours == 0.0
    assert s.stats == []


def test_single_controller():
    shifts = [make_shift(1, "C1", "Alice", BASE, 8)]
    s = compute_fairness(shifts)
    assert len(s.stats) == 1
    assert s.stats[0].total_hours == 8.0
    assert s.std_hours == 0.0
    assert s.max_delta_hours == 0.0


def test_equal_hours_zero_std():
    shifts = [
        make_shift(1, "C1", "Alice", BASE, 8),
        make_shift(2, "C2", "Bob",   BASE + timedelta(days=1), 8),
    ]
    s = compute_fairness(shifts)
    assert s.std_hours == 0.0
    assert s.avg_hours == 8.0


def test_unequal_hours_nonzero_std():
    shifts = [
        make_shift(1, "C1", "Alice", BASE, 8),
        make_shift(2, "C2", "Bob",   BASE + timedelta(days=1), 12),
    ]
    s = compute_fairness(shifts)
    assert s.avg_hours == 10.0
    assert s.std_hours > 0
    assert s.max_delta_hours == 2.0


def test_night_shift_counted():
    shifts = [
        make_shift(1, "C1", "Alice", BASE, 12, is_night=True),
        make_shift(2, "C1", "Alice", BASE + timedelta(days=1), 12, is_night=False),
    ]
    s = compute_fairness(shifts)
    assert s.stats[0].night_shifts == 1
    assert s.stats[0].shift_count == 2


def test_work_days_counted():
    shifts = [
        make_shift(1, "C1", "Alice", BASE, 8),
        make_shift(2, "C1", "Alice", BASE + timedelta(days=1), 8),
        make_shift(3, "C1", "Alice", BASE + timedelta(days=2), 8),
    ]
    s = compute_fairness(shifts)
    assert s.stats[0].work_days == 3


def test_same_day_shifts_count_once_for_work_days():
    shifts = [
        make_shift(1, "C1", "Alice", BASE, 6),
        make_shift(2, "C1", "Alice", BASE + timedelta(hours=8), 4),
    ]
    s = compute_fairness(shifts)
    assert s.stats[0].work_days == 1   # same calendar day


def test_multiple_controllers_stats():
    shifts = [
        make_shift(1, "C1", "Alice", BASE,                  8),
        make_shift(2, "C1", "Alice", BASE + timedelta(days=1), 8),
        make_shift(3, "C2", "Bob",   BASE,                  10),
    ]
    s = compute_fairness(shifts)
    assert len(s.stats) == 2
    alice = next(x for x in s.stats if x.controller_id == "C1")
    bob   = next(x for x in s.stats if x.controller_id == "C2")
    assert alice.total_hours == 16.0
    assert bob.total_hours == 10.0
    assert s.avg_hours == 13.0


def test_to_dict_shape():
    shifts = [make_shift(1, "C1", "Alice", BASE, 8)]
    d = compute_fairness(shifts).to_dict()
    assert set(d.keys()) == {"avg_hours", "std_hours", "max_delta_hours", "controllers"}
    assert set(d["controllers"][0].keys()) == {
        "controller_id", "controller_name", "total_hours", "night_hours",
        "night_shifts", "shift_count", "work_days",
    }
