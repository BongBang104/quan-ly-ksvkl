"""
test_optimizer.py
=================
Test tối ưu hóa phân ca với bài toán nhỏ có lời giải biết trước.

Nguyên tắc:
- Mọi ngưỡng đọc động từ RestRuleConfig (không gán số cứng).
- Phương án tìm được PHẢI không vi phạm ràng buộc cứng (ComplianceChecker, không có CRITICAL).
- Test chạy được trên cả CP-SAT và greedy fallback.
"""

from datetime import datetime, timedelta

import pytest

from app.core.domain import Position, Qualification, RestRuleConfig, Severity
from app.optimize.shift_optimizer import (
    ControllerProfile, ShiftOptimizer, ShiftSlot,
)

CFG = RestRuleConfig()
BASE = datetime(2026, 6, 1, 7, 0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slot(sid, start, hours, positions=None, is_night=False):
    return ShiftSlot(
        slot_id=sid,
        start=start,
        end=start + timedelta(hours=hours),
        is_night=is_night,
        required_positions=list(positions or []),
    )


def profile(cid, name, is_full=False, positions=None, unavail=None):
    q = Qualification(
        controller_id=cid, is_full=is_full,
        positions=frozenset(positions or []),
        controller_name=name,
    )
    return ControllerProfile(
        controller_id=cid, controller_name=name, qualification=q,
        unavailable_dates=frozenset(unavail or []),
    )


def optimizer():
    return ShiftOptimizer(CFG)


def assert_no_critical(result):
    """Ràng buộc cứng: phương án tìm được không được có vi phạm CRITICAL."""
    critical = [v for v in result.compliance_violations if v.severity == Severity.CRITICAL]
    assert critical == [], f"CRITICAL violations found: {[v.message for v in critical]}"


# ---------------------------------------------------------------------------
# Bài toán cơ bản — đủ điều kiện
# ---------------------------------------------------------------------------

def test_empty_slots_returns_optimal():
    r = optimizer().optimize([], [])
    assert r.status == "OPTIMAL"
    assert r.assignments == {}


def test_single_slot_single_controller():
    slots = [slot("S1", BASE, 8)]
    controllers = [profile("C1", "Alice", is_full=True)]
    r = optimizer().optimize(slots, controllers)
    assert r.status in ("OPTIMAL", "FEASIBLE")
    assert "S1" in r.assignments
    assert r.assignments["S1"] == "C1"
    assert_no_critical(r)


def test_all_slots_assigned_when_enough_controllers():
    """4 ca chia đều cho 2 KSVKL full — mỗi người nhận 2 ca."""
    slots = [slot(f"S{i}", BASE + timedelta(days=i * 2), 8) for i in range(4)]
    controllers = [
        profile("C1", "Alice", is_full=True),
        profile("C2", "Bob",   is_full=True),
    ]
    r = optimizer().optimize(slots, controllers)
    assert r.status in ("OPTIMAL", "FEASIBLE")
    assert set(r.assignments.keys()) == {"S0", "S1", "S2", "S3"}
    assert r.unassigned_slots == []
    assert_no_critical(r)


def test_qualification_hard_constraint():
    """KSVKL chỉ có GCU không được phân vào ca yêu cầu TWR."""
    slots = [slot("S1", BASE, 8, positions=[Position.TWR])]
    controllers = [profile("C1", "Alice", positions=[Position.GCU])]
    r = optimizer().optimize(slots, controllers)
    # Không ai đủ năng định -> infeasible hoặc unassigned
    assert r.status == "INFEASIBLE" or "S1" in r.unassigned_slots


def test_qualified_controller_assigned_correct_position():
    """Chỉ C2 (APP) mới đủ năng định cho ca APP; C1 (TWR) không được phân."""
    slots = [slot("S1", BASE, 8, positions=[Position.APP])]
    controllers = [
        profile("C1", "Alice", positions=[Position.TWR]),
        profile("C2", "Bob",   positions=[Position.APP]),
    ]
    r = optimizer().optimize(slots, controllers)
    assert r.status in ("OPTIMAL", "FEASIBLE")
    assert r.assignments.get("S1") == "C2"
    assert_no_critical(r)


def test_full_controller_handles_any_position():
    """KSVKL full đủ năng định cho mọi vị trí."""
    for pos in Position:
        slots = [slot("S1", BASE, 6, positions=[pos])]
        controllers = [profile("C1", "Alice", is_full=True)]
        r = optimizer().optimize(slots, controllers)
        assert r.status in ("OPTIMAL", "FEASIBLE"), f"Failed for {pos}"
        assert "S1" in r.assignments
        assert_no_critical(r)


# ---------------------------------------------------------------------------
# Ràng buộc nghỉ ngơi
# ---------------------------------------------------------------------------

def test_rest_constraint_prevents_back_to_back():
    """Hai ca liên tiếp (không đủ thời gian nghỉ) không được phân cho cùng người.
    Với 2 controller thì mỗi người nhận 1 ca."""
    min_rest = CFG.min_rest_between_shifts_hours      # ví dụ 11 giờ
    gap = min_rest / 2                                 # chưa đủ nghỉ
    s1 = slot("S1", BASE, 6)
    s2 = slot("S2", s1.end + timedelta(hours=gap), 6)
    controllers = [
        profile("C1", "Alice", is_full=True),
        profile("C2", "Bob",   is_full=True),
    ]
    r = optimizer().optimize([s1, s2], controllers)
    assert r.status in ("OPTIMAL", "FEASIBLE")
    # Hai ca KHÔNG được cùng một controller (vi phạm rest)
    assert r.assignments.get("S1") != r.assignments.get("S2"), (
        "Hai ca liên tiếp thiếu thời gian nghỉ phải được phân cho hai người khác nhau"
    )
    assert_no_critical(r)


def test_sufficient_rest_allows_same_controller():
    """Hai ca cách nhau đủ thời gian nghỉ -> có thể phân cho cùng người."""
    min_rest = CFG.min_rest_between_shifts_hours
    s1 = slot("S1", BASE, 6)
    s2 = slot("S2", s1.end + timedelta(hours=min_rest + 1), 6)
    controllers = [profile("C1", "Alice", is_full=True)]
    r = optimizer().optimize([s1, s2], controllers)
    assert r.status in ("OPTIMAL", "FEASIBLE")
    assert_no_critical(r)
    # Với chỉ 1 controller đủ năng định và đủ rest, cả hai ca được phân
    assert "S1" in r.assignments and "S2" in r.assignments


# ---------------------------------------------------------------------------
# Không khả dụng (unavailability)
# ---------------------------------------------------------------------------

def test_unavailable_date_excluded():
    """Controller không khả dụng ngày hôm đó không được phân ca."""
    unavail_date = BASE.date()
    s = slot("S1", BASE, 8)
    controllers = [
        profile("C1", "Alice", is_full=True, unavail=[unavail_date]),
        profile("C2", "Bob",   is_full=True),
    ]
    r = optimizer().optimize([s], controllers)
    assert r.assignments.get("S1") == "C2"
    assert_no_critical(r)


def test_all_unavailable_leads_to_unassigned():
    """Tất cả controller không khả dụng -> ca không được phân."""
    unavail_date = BASE.date()
    s = slot("S1", BASE, 8)
    controllers = [profile("C1", "Alice", is_full=True, unavail=[unavail_date])]
    r = optimizer().optimize([s], controllers)
    assert "S1" in r.unassigned_slots or r.status == "INFEASIBLE"


# ---------------------------------------------------------------------------
# Công bằng (fairness)
# ---------------------------------------------------------------------------

def test_fairness_balances_hours():
    """4 ca đồng đều giờ, 2 controller -> mỗi người nhận xấp xỉ một nửa."""
    slots = [slot(f"S{i}", BASE + timedelta(days=i * 2), 8) for i in range(4)]
    controllers = [
        profile("C1", "Alice", is_full=True),
        profile("C2", "Bob",   is_full=True),
    ]
    r = optimizer().optimize(slots, controllers)
    assert r.status in ("OPTIMAL", "FEASIBLE")
    hours = r.metrics.get("hours_per_controller", {})
    h1 = hours.get("C1", 0)
    h2 = hours.get("C2", 0)
    # Với tối ưu hóa công bằng, chênh lệch không quá 1 ca (8 giờ)
    assert abs(h1 - h2) <= 8.0 + 1e-6, f"Chênh lệch giờ quá lớn: {h1} vs {h2}"
    assert_no_critical(r)


# ---------------------------------------------------------------------------
# Infeasible & partial
# ---------------------------------------------------------------------------

def test_infeasible_when_no_qualified_controller():
    """Không có controller nào đủ năng định -> infeasible."""
    slots = [slot("S1", BASE, 8, positions=[Position.APP])]
    controllers = [profile("C1", "Alice", positions=[Position.GCU])]
    r = optimizer().optimize(slots, controllers)
    assert r.status == "INFEASIBLE" or "S1" in r.unassigned_slots


def test_partial_when_some_slots_unassignable():
    """Một số ca không thể phân -> partial, ca còn lại vẫn được phân."""
    s_ok  = slot("S1", BASE,                        8, positions=[Position.TWR])
    s_bad = slot("S2", BASE + timedelta(days=1),    8, positions=[Position.APP])
    controllers = [profile("C1", "Alice", positions=[Position.TWR])]
    r = optimizer().optimize([s_ok, s_bad], controllers)
    assert "S1" in r.assignments        # S1 có thể phân
    assert "S2" in r.unassigned_slots   # S2 không ai đủ APP


# ---------------------------------------------------------------------------
# Xác nhận ComplianceChecker không có CRITICAL — tiêu chí chính của Phase 4
# ---------------------------------------------------------------------------

def test_solution_passes_compliance_checker():
    """Phương án tìm được khi chạy qua ComplianceChecker không có vi phạm CRITICAL.

    Dùng ca 8 giờ (trong ngưỡng max_designed_shift_hours=10) và khoảng cách
    đủ thời gian nghỉ giữa ca sáng và ca ngày hôm sau.
    """
    shift_len = min(8.0, (CFG.max_designed_shift_hours or 10.0) - 0.5)
    min_rest  = CFG.min_rest_between_shifts_hours or 11.0
    # Ca sáng 07:00 kéo dài shift_len giờ; ca kế cách đủ min_rest
    slots = []
    t = BASE
    for i in range(6):
        slots.append(slot(f"S{i}", t, shift_len))
        t = t + timedelta(hours=shift_len + min_rest + 0.5)   # đảm bảo đủ nghỉ

    # 3 controller full (đủ để xoay ca nghỉ đúng quy định)
    controllers = [profile(f"C{i}", f"Ctrl-{i}", is_full=True) for i in range(3)]

    r = optimizer().optimize(slots, controllers, time_limit_seconds=30)
    # Không được có vi phạm CRITICAL — đây là tiêu chí cốt lõi Phase 4
    assert_no_critical(r)


def test_to_dict_shape():
    slots = [slot("S1", BASE, 8)]
    controllers = [profile("C1", "Alice", is_full=True)]
    r = optimizer().optimize(slots, controllers)
    d = r.to_dict()
    assert set(d.keys()) >= {
        "status", "assignments", "unassigned_slots",
        "compliance_violations", "metrics", "solver_used",
    }


def test_metrics_keys():
    slots = [slot("S1", BASE, 8)]
    controllers = [profile("C1", "Alice", is_full=True)]
    r = optimizer().optimize(slots, controllers)
    assert "total_assigned" in r.metrics
    assert "hours_per_controller" in r.metrics
