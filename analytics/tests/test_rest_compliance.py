"""
test_rest_compliance.py
=======================
Bộ test cho module kiểm tra tuân thủ KSVKL (mô hình ca có nhiều phiên vị trí).

Nguyên tắc: test đọc ngưỡng ĐỘNG từ RestRuleConfig (không gán số cứng).
Chạy: pytest tests/test_rest_compliance.py -v
"""

from datetime import datetime, timedelta

import pytest

from app.compliance.rest_compliance import (
    Shift, PositionSession, Position, Qualification, ALL_POSITIONS,
    AUXILIARY_POSITIONS, RestRuleConfig, ComplianceChecker, Severity, format_report,
    ShiftKind, classify_shift_kind, OncallAssignment, check_oncall_limits,
)

CFG = RestRuleConfig()
BASE = datetime(2026, 6, 1, 8, 0)


def sess(position, start, hours):
    return PositionSession(position, start, start + timedelta(hours=hours))


def make_shift(shift_id, start, hours, *, controller_id=1, name="KSVKL Test",
               is_night=False, sessions=None):
    return Shift(
        shift_id=shift_id, controller_id=controller_id, controller_name=name,
        start=start, end=start + timedelta(hours=hours),
        is_night=is_night, sessions=sessions if sessions is not None else [],
    )


def one_position_shift(shift_id, start, hours, position, **kw):
    """Ca chỉ có một phiên vị trí phủ toàn bộ ca."""
    return make_shift(shift_id, start, hours, sessions=[sess(position, start, hours)], **kw)


def two_shifts_with_rest(rest_hours, shift_len=6.0):
    s1 = make_shift(1, BASE, shift_len)
    s2 = make_shift(2, s1.end + timedelta(hours=rest_hours), shift_len)
    return [s1, s2]


def rules_in(violations):
    return {v.rule for v in violations}


def checker(cfg=CFG):
    return ComplianceChecker(cfg)


# ===================== LUÂN PHIÊN VỊ TRÍ TRONG MỘT CA =====================

def test_shift_can_rotate_multiple_positions():
    """Một ca chứa nhiều phiên vị trí khác nhau -> positions_worked phản ánh đủ."""
    s = make_shift(1, BASE, 8, sessions=[
        sess(Position.CTL, BASE, 4),
        sess(Position.APP, BASE + timedelta(hours=4), 4),
    ])
    assert s.positions_worked == {Position.CTL, Position.APP}


def test_rotation_qualification_checked_per_session():
    """KSVKL full hợp lệ ở mọi phiên; người riêng lẻ vi phạm ở phiên ngoài năng định."""
    quals = {
        101: Qualification(101, is_full=True),
        102: Qualification(102, is_full=False, positions=frozenset({Position.TWR})),
    }
    short = CFG.max_on_position_minutes / 60.0 / 2  # phiên ngắn để không kích hoạt on-position
    shifts = [
        make_shift(1, BASE, short * 2, controller_id=101, name="A", sessions=[
            sess(Position.TWR, BASE, short),
            sess(Position.GCU, BASE + timedelta(hours=short), short),
        ]),
        make_shift(2, BASE, short * 2, controller_id=102, name="B", sessions=[
            sess(Position.TWR, BASE, short),                                  # ok
            sess(Position.GCU, BASE + timedelta(hours=short), short),         # B không có GCU -> vi phạm
        ]),
    ]
    v = checker().check_all(shifts, quals)
    cov = [x for x in v if x.rule == "qualification_coverage"]
    assert len(cov) == 1
    assert cov[0].controller_id == 102


# ===================== NĂNG ĐỊNH: model Qualification =====================

def test_full_qualification_can_work_every_position():
    q = Qualification(1, is_full=True)
    assert all(q.can_work(p) for p in Position)
    assert q.qualified_positions() == ALL_POSITIONS


def test_partial_qualification_only_listed_positions():
    q = Qualification(1, is_full=False, positions=frozenset({Position.TWR, Position.GCU}))
    assert q.can_work(Position.TWR) and q.can_work(Position.GCU)
    assert not q.can_work(Position.APP) and not q.can_work(Position.CTL)
    assert q.qualified_positions() == frozenset({Position.TWR, Position.GCU})


# ===================== PHỦ NĂNG ĐỊNH =====================

def test_coverage_full_controller_any_position_ok():
    quals = {1: Qualification(1, is_full=True)}
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        one_position_shift(1, BASE, h, Position.APP),
        one_position_shift(2, BASE + timedelta(days=2), h, Position.CTL),
        one_position_shift(3, BASE + timedelta(days=4), h, Position.GCU),
    ]
    assert [x for x in checker().check_all(shifts, quals) if x.rule == "qualification_coverage"] == []


def test_coverage_partial_unqualified_position_violation():
    quals = {1: Qualification(1, is_full=False, positions=frozenset({Position.TWR}))}
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [one_position_shift(1, BASE, h, Position.APP)]
    cov = [x for x in checker().check_all(shifts, quals) if x.rule == "qualification_coverage"]
    assert len(cov) == 1 and cov[0].severity == Severity.CRITICAL


def test_coverage_skipped_when_no_qualifications():
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [one_position_shift(1, BASE, h, Position.APP)]
    assert [x for x in checker().check_all(shifts) if x.rule == "qualification_coverage"] == []


def test_coverage_shift_without_sessions_ignored():
    quals = {1: Qualification(1, is_full=False, positions=frozenset())}
    shifts = [make_shift(1, BASE, 6, sessions=[])]
    assert [x for x in checker().check_all(shifts, quals) if x.rule == "qualification_coverage"] == []


@pytest.mark.parametrize("pos", list(Position))
def test_coverage_full_qualifies_all_operational_positions(pos):
    quals = {1: Qualification(1, is_full=True)}
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [one_position_shift(1, BASE, h, pos)]
    assert [x for x in checker().check_all(shifts, quals) if x.rule == "qualification_coverage"] == []


# ===================== THỜI GIAN NGỒI VỊ TRÍ (theo phiên) =====================

def test_on_position_session_violation_above_threshold():
    limit_min = CFG.max_on_position_minutes
    hours = (limit_min + 30) / 60.0
    shifts = [one_position_shift(1, BASE, hours, Position.TWR)]
    assert "max_on_position" in rules_in(checker().check_all(shifts))


def test_on_position_session_ok_at_threshold():
    limit_min = CFG.max_on_position_minutes
    hours = limit_min / 60.0
    shifts = [one_position_shift(1, BASE, hours, Position.TWR)]
    assert [x for x in checker().check_all(shifts) if x.rule == "max_on_position"] == []


def test_rotation_avoids_on_position_violation():
    """Hai phiên ngắn (mỗi phiên = nửa ngưỡng) không vi phạm dù tổng vượt ngưỡng -
    đúng tinh thần: luân phiên để ngắt thời gian liên tục."""
    half = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [make_shift(1, BASE, half * 2, sessions=[
        sess(Position.TWR, BASE, half),
        sess(Position.GCU, BASE + timedelta(hours=half), half),
    ])]
    assert [x for x in checker().check_all(shifts) if x.rule == "max_on_position"] == []


# ===================== RECENCY THEO VỊ TRÍ (qua các phiên) =====================

def test_position_recency_violation_beyond_window():
    window = CFG.max_days_between_position_use
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        one_position_shift(1, BASE, h, Position.APP),
        one_position_shift(2, BASE + timedelta(days=window + 1), h, Position.APP),
    ]
    assert "position_recency" in rules_in(checker().check_all(shifts))


def test_position_recency_ok_at_window():
    window = CFG.max_days_between_position_use
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        one_position_shift(1, BASE, h, Position.APP),
        one_position_shift(2, BASE + timedelta(days=window), h, Position.APP),
    ]
    assert [x for x in checker().check_all(shifts) if x.rule == "position_recency"] == []


def test_position_recency_different_positions_independent():
    window = CFG.max_days_between_position_use
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        one_position_shift(1, BASE, h, Position.APP),
        one_position_shift(2, BASE + timedelta(days=window + 30), h, Position.TWR),
    ]
    assert [x for x in checker().check_all(shifts) if x.rule == "position_recency"] == []


def test_position_recency_across_sessions_in_same_shift():
    """Recency tính trên mọi phiên: một ca chứa APP, ca kế (cách quá window) cũng có APP."""
    window = CFG.max_days_between_position_use
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [
        make_shift(1, BASE, h, sessions=[sess(Position.APP, BASE, h)]),
        make_shift(2, BASE + timedelta(days=window + 5), h,
                   sessions=[sess(Position.APP, BASE + timedelta(days=window + 5), h)]),
    ]
    assert "position_recency" in rules_in(checker().check_all(shifts))


# ===================== Trường hợp sạch / rỗng =====================

def test_clean_schedule_no_violations():
    shifts = [
        make_shift(1, BASE, 6),
        make_shift(2, BASE + timedelta(days=2), 6),
        make_shift(3, BASE + timedelta(days=4), 6),
    ]
    assert checker().check_all(shifts) == []


def test_empty_schedule():
    assert checker().check_all([]) == []


# ===================== Nghỉ giữa ca / giờ trực (động) =====================

def test_min_rest_violation_below_threshold():
    limit = CFG.min_rest_between_shifts_hours
    assert "min_rest_between_shifts" in rules_in(checker().check_all(two_shifts_with_rest(limit - 1)))


def test_min_rest_ok_at_threshold():
    limit = CFG.min_rest_between_shifts_hours
    assert [x for x in checker().check_all(two_shifts_with_rest(limit)) if x.rule == "min_rest_between_shifts"] == []


def test_continuous_duty_violation_above_threshold():
    # Vượt ca thiết kế (10h) → max_designed_shift WARNING. QĐ 2288 Điều 11.1
    limit = CFG.max_designed_shift_hours
    assert "max_designed_shift" in rules_in(checker().check_all([make_shift(1, BASE, limit + 1)]))


def test_continuous_duty_ok_at_threshold():
    limit = CFG.max_designed_shift_hours
    assert [x for x in checker().check_all([make_shift(1, BASE, limit)]) if x.rule == "max_designed_shift"] == []


def test_extended_shift_critical():
    # Vượt ca kéo dài (12h) → max_extended_shift CRITICAL. QĐ 2288 Điều 11.3
    limit = CFG.max_extended_shift_hours
    v = checker().check_all([make_shift(1, BASE, limit + 1)])
    assert any(x.rule == "max_extended_shift" and x.severity == Severity.CRITICAL for x in v)


# ===================== Ca đêm / ngày liên tiếp (động) =====================

def test_consecutive_nights_violation():
    limit = CFG.max_consecutive_night_shifts
    shifts = [make_shift(i, BASE.replace(hour=22) + timedelta(days=i), 8, is_night=True)
              for i in range(limit + 1)]
    assert "max_consecutive_nights" in rules_in(checker().check_all(shifts))


def test_consecutive_nights_ok_at_threshold():
    limit = CFG.max_consecutive_night_shifts
    shifts = [make_shift(i, BASE.replace(hour=22) + timedelta(days=i), 8, is_night=True)
              for i in range(limit)]
    assert [x for x in checker().check_all(shifts) if x.rule == "max_consecutive_nights"] == []


def test_consecutive_days_violation():
    limit = CFG.max_consecutive_working_days
    shifts = [make_shift(i, BASE + timedelta(days=i), 4) for i in range(limit + 1)]
    assert "max_consecutive_days" in rules_in(checker().check_all(shifts))


def test_consecutive_days_ok_at_threshold():
    limit = CFG.max_consecutive_working_days
    shifts = [make_shift(i, BASE + timedelta(days=i), 4) for i in range(limit)]
    assert [x for x in checker().check_all(shifts) if x.rule == "max_consecutive_days"] == []


# ===================== Giờ trực tuần / 28 ngày (động) =====================

def test_weekly_duty_violation():
    days = CFG.max_consecutive_working_days
    h = CFG.max_designed_shift_hours   # đúng ngưỡng thiết kế — không vi phạm ca đơn lẻ
    shifts = [make_shift(i, BASE + timedelta(days=i), h) for i in range(days)]
    r = rules_in(checker().check_all(shifts))
    if days * h > CFG.max_duty_hours_per_week:
        assert "max_duty_per_week" in r
    assert "max_consecutive_days" not in r and "max_designed_shift" not in r


def test_30day_duty_violation():
    h, shifts, sid = 8.0, [], 1
    for week in range(4):
        for d in range(5):
            shifts.append(make_shift(sid, BASE + timedelta(days=week * 7 + d), h))
            sid += 1
    r = rules_in(checker().check_all(shifts))
    if 4 * 5 * h > CFG.max_duty_hours_per_30days:
        assert "max_duty_per_30days" in r
    if 5 * h <= CFG.max_duty_hours_per_week:
        assert "max_duty_per_week" not in r


# ===================== Cấu hình điều khiển hành vi =====================

def test_disabling_a_rule_via_none():
    cfg = RestRuleConfig(min_rest_between_shifts_hours=None)
    assert "min_rest_between_shifts" not in rules_in(checker(cfg).check_all(two_shifts_with_rest(1)))


def test_custom_threshold_shifts_the_boundary():
    rest = CFG.min_rest_between_shifts_hours + 1
    shifts = two_shifts_with_rest(rest)
    assert "min_rest_between_shifts" not in rules_in(checker().check_all(shifts))
    strict = RestRuleConfig(min_rest_between_shifts_hours=rest + 2)
    assert "min_rest_between_shifts" in rules_in(checker(strict).check_all(shifts))


# ===================== Nhiều KSVKL độc lập =====================

def test_multiple_controllers_isolated():
    limit = CFG.min_rest_between_shifts_hours
    shifts = [
        make_shift(1, BASE, 6, controller_id=101, name="A"),
        make_shift(2, BASE + timedelta(hours=6 + (limit - 1)), 6, controller_id=101, name="A"),
        make_shift(3, BASE, 6, controller_id=202, name="B"),
        make_shift(4, BASE + timedelta(days=3), 6, controller_id=202, name="B"),
    ]
    v = checker().check_all(shifts)
    assert any(x.rule == "min_rest_between_shifts" for x in v if x.controller_id == 101)
    assert [x for x in v if x.controller_id == 202] == []


# ===================== Báo cáo =====================

def test_format_report_no_violations():
    assert "Không phát hiện vi phạm" in format_report([])


def test_format_report_orders_critical_first():
    over = (CFG.max_on_position_minutes + 30) / 60.0
    shifts = [
        make_shift(1, BASE, CFG.max_extended_shift_hours + 1),   # CRITICAL (>12h)
        one_position_shift(2, BASE + timedelta(days=2), over, Position.TWR),   # WARNING
    ]
    report = format_report(checker().check_all(shifts))
    assert report.index("Nghiêm trọng") < report.index("Cảnh báo")


# ===================== Gộp phiên liền kề cùng vị trí =====================

def test_adjacent_same_position_sessions_merged_for_on_position():
    """Hai phiên TWR liền kề (không giải lao), mỗi phiên = 70% ngưỡng, gộp lại vượt ngưỡng."""
    part = CFG.max_on_position_minutes * 0.7 / 60.0   # giờ
    s = make_shift(1, BASE, part * 2, sessions=[
        sess(Position.TWR, BASE, part),
        sess(Position.TWR, BASE + timedelta(hours=part), part),   # liền kề, cùng vị trí
    ])
    assert "max_on_position" in rules_in(checker().check_all([s]))


def test_same_position_with_break_not_merged():
    """Hai phiên TWR cách nhau bằng giải lao đủ dài -> KHÔNG gộp, mỗi phiên dưới ngưỡng -> OK."""
    part = CFG.max_on_position_minutes * 0.7 / 60.0
    gap = 1.0  # nghỉ 1 giờ giữa hai phiên (lớn hơn ngưỡng gộp mặc định = 0)
    s = make_shift(1, BASE, part * 2 + gap, sessions=[
        sess(Position.TWR, BASE, part),
        sess(Position.TWR, BASE + timedelta(hours=part + gap), part),
    ])
    assert [x for x in checker().check_all([s]) if x.rule == "max_on_position"] == []


def test_merge_gap_configurable():
    """Với ngưỡng gộp nới rộng, hai phiên cách nhau dưới ngưỡng vẫn bị gộp."""
    part = CFG.max_on_position_minutes * 0.7 / 60.0
    cfg = RestRuleConfig(merge_adjacent_session_gap_minutes=10)
    s = make_shift(1, BASE, part * 2 + (5 / 60.0), sessions=[
        sess(Position.TWR, BASE, part),
        sess(Position.TWR, BASE + timedelta(hours=part, minutes=5), part),  # cách 5 phút < 10
    ])
    assert "max_on_position" in rules_in(checker(cfg).check_all([s]))


# ===================== Vị trí phụ trợ (HĐA/HĐC/HĐT/HĐG) =====================

def test_auxiliary_positions_no_qualification_check():
    """KSVKL không có năng định nào vẫn không vi phạm khi ngồi vị trí phụ trợ."""
    quals = {1: Qualification(1, is_full=False, positions=frozenset())}
    h = CFG.max_on_position_minutes / 60.0 / 2
    shifts = [make_shift(1, BASE, h, sessions=[
        sess(pos, BASE + timedelta(minutes=i * 10), h / len(AUXILIARY_POSITIONS))
        for i, pos in enumerate(AUXILIARY_POSITIONS)
    ])]
    cov = [x for x in checker().check_all(shifts, quals) if x.rule == "qualification_coverage"]
    assert cov == [], "Vị trí phụ trợ không được phát sinh vi phạm qualification"


def test_auxiliary_positions_no_recency_check():
    """Vị trí phụ trợ không bị kiểm tra recency dù khoảng cách rất dài."""
    window = CFG.max_days_between_position_use
    h = CFG.max_on_position_minutes / 60.0 / 2
    pos = next(iter(AUXILIARY_POSITIONS))
    shifts = [
        one_position_shift(1, BASE, h, pos),
        one_position_shift(2, BASE + timedelta(days=window * 2), h, pos),
    ]
    assert [x for x in checker().check_all(shifts) if x.rule == "position_recency"] == []


def test_all_positions_excludes_auxiliary():
    """ALL_POSITIONS chỉ chứa vị trí yêu cầu năng định, không chứa phụ trợ."""
    assert AUXILIARY_POSITIONS.isdisjoint(ALL_POSITIONS)
    assert ALL_POSITIONS | AUXILIARY_POSITIONS == frozenset(Position)


# ===================== ShiftKind + classify_shift_kind (V2 Mục 1.4) =====================

def test_classify_shift_kind_night():
    """Ca bắt đầu 22h → NIGHT. QĐ 2288 Điều 15.1.a."""
    start = BASE.replace(hour=22, minute=0)
    end   = start + timedelta(hours=8)
    assert classify_shift_kind(start, end, CFG) == ShiftKind.NIGHT


def test_classify_shift_kind_early():
    """Ca bắt đầu 05h → EARLY. QĐ 2288 Điều 15.2.a."""
    start = BASE.replace(hour=5, minute=0)
    end   = start + timedelta(hours=8)
    assert classify_shift_kind(start, end, CFG) == ShiftKind.EARLY


def test_classify_shift_kind_late():
    """Ca bắt đầu 14h, kết thúc 22h → LATE."""
    start = BASE.replace(hour=14, minute=0)
    end   = start + timedelta(hours=8)
    assert classify_shift_kind(start, end, CFG) == ShiftKind.LATE


def test_classify_shift_kind_normal():
    """Ca bắt đầu 08h, kết thúc 14h → NORMAL."""
    start = BASE.replace(hour=8, minute=0)
    end   = start + timedelta(hours=6)
    assert classify_shift_kind(start, end, CFG) == ShiftKind.NORMAL


def test_shift_effective_kind_from_is_night():
    """Shift.effective_kind suy từ is_night khi kind=None."""
    s_night  = make_shift(1, BASE, 8, is_night=True)
    s_normal = make_shift(2, BASE, 8, is_night=False)
    assert s_night.effective_kind == ShiftKind.NIGHT
    assert s_normal.effective_kind == ShiftKind.NORMAL


def test_shift_effective_kind_explicit():
    """Shift.kind ưu tiên hơn is_night."""
    s = make_shift(1, BASE, 8, is_night=False)
    s.kind = ShiftKind.EARLY
    assert s.effective_kind == ShiftKind.EARLY


# ===================== Nghỉ sau phiên (V2 Mục 1.2) ========================

def test_break_after_position_day_violation():
    """Gap < 30 phút trong ca ngày → vi phạm min_break_after_position. QĐ 2288 Điều 14.2.a."""
    day_min = CFG.min_break_after_position_day_minutes
    gap_min = day_min - 5
    part = CFG.max_on_position_minutes / 60.0 / 2
    gap_h = gap_min / 60.0
    s = make_shift(1, BASE, part * 2 + gap_h, is_night=False, sessions=[
        sess(Position.APP, BASE, part),
        sess(Position.TWR, BASE + timedelta(hours=part + gap_h), part),
    ])
    v = checker().check_all([s])
    assert any(x.rule == "min_break_after_position" for x in v)


def test_break_after_position_night_violation():
    """Gap < 45 phút trong ca đêm → vi phạm. QĐ 2288 Điều 14.2.a."""
    night_min = CFG.min_break_after_position_night_minutes
    gap_min = night_min - 5
    part = CFG.max_on_position_minutes / 60.0 / 2
    gap_h = gap_min / 60.0
    s = make_shift(1, BASE.replace(hour=22), part * 2 + gap_h, is_night=True, sessions=[
        sess(Position.CTL, BASE.replace(hour=22), part),
        sess(Position.APP, BASE.replace(hour=22) + timedelta(hours=part + gap_h), part),
    ])
    v = checker().check_all([s])
    assert any(x.rule == "min_break_after_position" for x in v)


def test_break_after_position_night_ok():
    """Gap = night_min phút trong ca đêm → không vi phạm."""
    night_min = CFG.min_break_after_position_night_minutes
    gap_h = night_min / 60.0
    part = CFG.max_on_position_minutes / 60.0 / 2
    s = make_shift(1, BASE.replace(hour=22), part * 2 + gap_h, is_night=True, sessions=[
        sess(Position.CTL, BASE.replace(hour=22), part),
        sess(Position.APP, BASE.replace(hour=22) + timedelta(hours=part + gap_h), part),
    ])
    v = checker().check_all([s])
    assert [x for x in v if x.rule == "min_break_after_position"] == []


# ===================== Ca sớm sau ca muộn/đêm (V2 Mục 1.5) ===============

def test_early_after_night_violation():
    """Ca EARLY ngay sau ca NIGHT → vi phạm early_after_late_or_night. QĐ 2288 Điều 15.2.b."""
    night = make_shift(1, BASE.replace(hour=22), 8, is_night=True)
    night.kind = ShiftKind.NIGHT
    early_start = night.end + timedelta(hours=13)   # nghỉ 13h (> 12h), nhưng ca EARLY
    early = make_shift(2, early_start.replace(hour=5), 8, is_night=False)
    early.kind = ShiftKind.EARLY
    v = checker().check_all([night, early])
    assert any(x.rule == "early_after_late_or_night" for x in v)


def test_early_after_normal_no_violation():
    """Ca EARLY sau ca NORMAL → không vi phạm."""
    normal = make_shift(1, BASE.replace(hour=8), 6, is_night=False)
    normal.kind = ShiftKind.NORMAL
    early_start = normal.end + timedelta(hours=14)
    early = make_shift(2, early_start.replace(hour=5), 8, is_night=False)
    early.kind = ShiftKind.EARLY
    v = checker().check_all([normal, early])
    assert [x for x in v if x.rule == "early_after_late_or_night"] == []


# ===================== On-call limits (V2 Mục 1.3) ========================

def _make_oncall(cid, name, day_offset, hours=8):
    start = BASE + timedelta(days=day_offset)
    return OncallAssignment(controller_id=cid, controller_name=name, start=start,
                            end=start + timedelta(hours=hours))


def test_oncall_4_in_7days_violation():
    """4 lượt on-call trong 7 ngày → vi phạm max_oncall_per_7days. QĐ 2288 Điều 16.1."""
    oncalls = [_make_oncall(1, "A", i) for i in range(4)]
    v = check_oncall_limits(oncalls, CFG)
    assert any(x.rule == "max_oncall_per_7days" for x in v)


def test_oncall_3_in_7days_ok():
    """3 lượt on-call trong 7 ngày → không vi phạm."""
    oncalls = [_make_oncall(1, "A", i) for i in range(3)]
    v = check_oncall_limits(oncalls, CFG)
    assert [x for x in v if x.rule == "max_oncall_per_7days"] == []


def test_oncall_duration_violation():
    """Lượt on-call 25h → vi phạm max_oncall_duration. QĐ 2288 Điều 16.2."""
    oc = _make_oncall(1, "A", 0, hours=25)
    v = check_oncall_limits([oc], CFG)
    assert any(x.rule == "max_oncall_duration" for x in v)


# ===================== legal_basis không rỗng (PLAN_TAB B1.1) =============

def test_violations_have_legal_basis():
    """Các vi phạm có map pháp lý phải trả legal_basis không rỗng."""
    # min_rest_between_shifts
    v_rest = checker().check_all(two_shifts_with_rest(1))
    for v in v_rest:
        if v.rule == "min_rest_between_shifts":
            assert v.legal_basis, f"legal_basis trống cho rule {v.rule}"

    # max_on_position
    over = (CFG.max_on_position_minutes + 30) / 60.0
    v_pos = checker().check_all([one_position_shift(1, BASE, over, Position.TWR)])
    for v in v_pos:
        if v.rule == "max_on_position":
            assert v.legal_basis, f"legal_basis trống cho rule {v.rule}"

    # qualification_coverage
    quals = {1: Qualification(1, is_full=False, positions=frozenset({Position.TWR}))}
    h = CFG.max_on_position_minutes / 60.0 / 2
    v_qual = checker().check_all([one_position_shift(1, BASE, h, Position.APP)], quals)
    for v in v_qual:
        if v.rule == "qualification_coverage":
            assert v.legal_basis, f"legal_basis trống cho rule {v.rule}"
