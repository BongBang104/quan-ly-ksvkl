"""
test_roster_review.py
=====================
Test cho lớp rà soát phân ca trước khi publish (RosterReviewer) và đề xuất hoán đổi.

Chạy: pytest test_roster_review.py -v
"""

from datetime import datetime, timedelta

from rest_compliance import (
    Shift, PositionSession, Position, Qualification, RestRuleConfig, Severity,
)
from roster_review import RosterReviewer, ReviewResult

CFG = RestRuleConfig()
T = datetime(2026, 6, 1, 6, 0)


def sess(pos, start, hours):
    return PositionSession(pos, start, start + timedelta(hours=hours))


def shift(shift_id, controller_id, name, start, hours, sessions):
    return Shift(shift_id, controller_id, name, start, start + timedelta(hours=hours),
                 sessions=sessions)


def reviewer():
    return RosterReviewer(CFG)


# ===================== Rà soát: cờ can_publish =====================

def test_clean_roster_can_publish():
    quals = {1: Qualification(1, is_full=True)}
    short = CFG.max_on_position_minutes / 60.0 / 2
    s = shift(1, 1, "A", T, short, [sess(Position.CTL, T, short)])
    r = reviewer().review([s], quals)
    assert isinstance(r, ReviewResult)
    assert r.can_publish
    assert r.violations == []


def test_coverage_violation_blocks_publish():
    quals = {1: Qualification(1, is_full=False, positions=frozenset({Position.TWR}))}
    short = CFG.max_on_position_minutes / 60.0 / 2
    s = shift(1, 1, "A", T, short, [sess(Position.APP, T, short)])   # A không có APP
    r = reviewer().review([s], quals)
    assert not r.can_publish
    assert any(v.rule == "qualification_coverage" for v in r.violations)


def test_warning_only_still_can_publish():
    """Chỉ có cảnh báo (không có vi phạm nghiêm trọng) -> vẫn đủ điều kiện publish."""
    quals = {1: Qualification(1, is_full=True)}
    over = (CFG.max_on_position_minutes + 30) / 60.0     # phiên quá dài -> WARNING
    s = shift(1, 1, "A", T, over, [sess(Position.TWR, T, over)])
    r = reviewer().review([s], quals)
    assert any(v.severity == Severity.WARNING for v in r.violations)
    assert all(v.severity != Severity.CRITICAL for v in r.violations)
    assert r.can_publish


# ===================== Đề xuất hoán đổi sạch =====================

def test_clean_swap_suggested_once():
    """B(chỉ TWR/GCU) bị phân APP, C(chỉ APP) đang ở TWR cùng khung giờ -> hoán đổi sạch."""
    quals = {
        102: Qualification(102, is_full=False, positions=frozenset({Position.TWR, Position.GCU})),
        103: Qualification(103, is_full=False, positions=frozenset({Position.APP})),
    }
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        shift(1, 102, "B", T, h, [sess(Position.APP, T, h)]),
        shift(2, 103, "C", T, h, [sess(Position.TWR, T, h)]),
    ]
    r = reviewer().review(shifts, quals)
    swaps = [s for s in r.suggestions if s.kind == "swap"]
    assert len(swaps) == 1                       # đối xứng nhưng chỉ đề xuất một lần
    assert set(swaps[0].shift_ids) == {1, 2}


def test_reassign_when_no_clean_swap():
    """B(chỉ GCU) bị phân APP; D là full đang ở CTL cùng giờ -> chuyển một chiều
    (không hoán đổi sạch vì B không làm được CTL)."""
    quals = {
        102: Qualification(102, is_full=False, positions=frozenset({Position.GCU})),
        104: Qualification(104, is_full=True),
    }
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        shift(1, 102, "B", T, h, [sess(Position.APP, T, h)]),
        shift(2, 104, "D", T, h, [sess(Position.CTL, T, h)]),
    ]
    r = reviewer().review(shifts, quals)
    kinds = {s.kind for s in r.suggestions}
    assert "reassign" in kinds
    assert "swap" not in kinds


def test_no_candidate_when_nobody_qualified_in_window():
    """Không ai trong khung giờ đủ năng định cho vị trí lỗi -> báo cần bổ sung nhân sự."""
    quals = {
        102: Qualification(102, is_full=False, positions=frozenset({Position.GCU})),
        105: Qualification(105, is_full=False, positions=frozenset({Position.GCU})),
    }
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        shift(1, 102, "B", T, h, [sess(Position.APP, T, h)]),   # APP, nhưng không ai có APP
        shift(2, 105, "E", T, h, [sess(Position.GCU, T, h)]),
    ]
    r = reviewer().review(shifts, quals)
    assert any(s.kind == "no_candidate" for s in r.suggestions)


def test_no_suggestion_when_no_overlap_in_time():
    """Người đủ năng định nhưng KHÔNG cùng khung giờ -> không đề xuất hoán đổi tức thì."""
    quals = {
        102: Qualification(102, is_full=False, positions=frozenset({Position.GCU})),
        103: Qualification(103, is_full=False, positions=frozenset({Position.APP})),
    }
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        shift(1, 102, "B", T, h, [sess(Position.APP, T, h)]),
        shift(2, 103, "C", T + timedelta(days=1), h,
              [sess(Position.APP, T + timedelta(days=1), h)]),   # khác ngày, không giao giờ
    ]
    r = reviewer().review(shifts, quals)
    # C không cùng khung giờ -> chỉ còn no_candidate, không có swap/reassign khả thi
    assert any(s.kind == "no_candidate" for s in r.suggestions)
    assert not any(s.kind == "swap" for s in r.suggestions)
