"""
shift_optimizer.py
==================
Tối ưu hóa phân ca KSVKL bằng CP-SAT (OR-Tools).

LƯU Ý AN TOÀN:
- Kết quả là ĐỀ XUẤT — người phụ trách phải duyệt trước khi áp dụng.
- Phương án được xác nhận lại qua ComplianceChecker sau khi tìm được lời giải.
- Mọi ngưỡng trong RestRuleConfig CHỈ LÀ VÍ DỤ — thay bằng số liệu VATM/CAAV/ICAO.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from app.core.domain import (
    ALL_POSITIONS, ComplianceChecker, Position, PositionSession,
    Qualification, RestRuleConfig, Shift, Violation,
)

try:
    from ortools.sat.python import cp_model as _cp_model
    _HAS_ORTOOLS = True
except ImportError:  # pragma: no cover
    _HAS_ORTOOLS = False


# ---------------------------------------------------------------------------
# Input dataclasses
# ---------------------------------------------------------------------------

@dataclass
class ShiftSlot:
    """Một ca cần được phân cho KSVKL (đầu vào bài toán tối ưu)."""
    slot_id: str
    start: datetime
    end: datetime
    is_night: bool = False
    required_positions: list[Position] = field(default_factory=list)
    # Rỗng = không yêu cầu vị trí cụ thể (bất kỳ KSVKL active đều được)

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0

    @property
    def duty_date(self) -> date:
        return self.start.date()


@dataclass
class ControllerProfile:
    """Thông tin một KSVKL cho bài toán tối ưu."""
    controller_id: str
    controller_name: str
    qualification: Qualification
    unavailable_dates: frozenset[date] = field(default_factory=frozenset)
    preferred_shift_codes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Output dataclasses
# ---------------------------------------------------------------------------

@dataclass
class OptimizationResult:
    """Kết quả tối ưu hóa phân ca."""
    status: str               # 'OPTIMAL' | 'FEASIBLE' | 'PARTIAL' | 'INFEASIBLE'
    assignments: dict[str, str]          # slot_id -> controller_id
    unassigned_slots: list[str]          # slot_ids không thể phân
    compliance_violations: list[Violation]   # từ ComplianceChecker (CRITICAL = nguy hiểm)
    metrics: dict[str, Any]
    solver_used: str          # 'CP-SAT' | 'GREEDY'
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "status":           self.status,
            "assignments":      self.assignments,
            "unassigned_slots": self.unassigned_slots,
            "compliance_violations": [
                {
                    "rule":     v.rule,
                    "severity": v.severity.name,
                    "controller_id":   str(v.controller_id),
                    "controller_name": v.controller_name,
                    "message":  v.message,
                }
                for v in self.compliance_violations
            ],
            "metrics":    self.metrics,
            "solver_used": self.solver_used,
            "note":        self.note,
        }


# ---------------------------------------------------------------------------
# Optimizer
# ---------------------------------------------------------------------------

class ShiftOptimizer:
    """Phân ca KSVKL tối ưu có ràng buộc.

    Ưu tiên CP-SAT (OR-Tools). Tự động chuyển sang greedy nếu không có.
    Sau khi tìm lời giải, xác nhận lại bằng ComplianceChecker — kết quả
    OPTIMAL/FEASIBLE phải không có vi phạm CRITICAL.
    """

    def __init__(self, config: RestRuleConfig):
        self.cfg = config
        self.checker = ComplianceChecker(config)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def optimize(
        self,
        slots: list[ShiftSlot],
        controllers: list[ControllerProfile],
        time_limit_seconds: int = 30,
    ) -> OptimizationResult:
        """Tìm phương án phân ca tối ưu.

        Thử CP-SAT trước, nếu không có ortools thì dùng greedy.
        """
        if not slots:
            return OptimizationResult(
                status="OPTIMAL", assignments={}, unassigned_slots=[],
                compliance_violations=[], metrics={"total_assigned": 0},
                solver_used="NONE",
            )

        if _HAS_ORTOOLS:
            result = self._solve_cpsat(slots, controllers, time_limit_seconds)
        else:  # pragma: no cover
            result = self._solve_greedy(slots, controllers)

        return result

    # ------------------------------------------------------------------
    # Eligibility helpers
    # ------------------------------------------------------------------

    def _can_assign(self, slot: ShiftSlot, profile: ControllerProfile) -> bool:
        """Controller có thể đảm nhận ca này không?"""
        q = profile.qualification
        if not q.is_active:
            return False
        if slot.duty_date in profile.unavailable_dates:
            return False
        if not slot.required_positions:
            return True  # không yêu cầu vị trí cụ thể
        return all(q.can_work(pos) for pos in slot.required_positions)

    # ------------------------------------------------------------------
    # Build Shift objects for compliance checking
    # ------------------------------------------------------------------

    def _build_shifts(
        self,
        assignments: dict[str, str],
        slots: list[ShiftSlot],
        profiles: dict[str, ControllerProfile],
    ) -> list[Shift]:
        slots_by_id = {s.slot_id: s for s in slots}
        by_ctrl: dict[str, list[ShiftSlot]] = {}
        for slot_id, cid in assignments.items():
            by_ctrl.setdefault(cid, []).append(slots_by_id[slot_id])

        result: list[Shift] = []
        counter = 0
        for cid, assigned in by_ctrl.items():
            profile = profiles[cid]
            for slot in assigned:
                counter += 1
                sessions = [
                    PositionSession(pos, slot.start, slot.end)
                    for pos in slot.required_positions
                ]
                result.append(Shift(
                    shift_id=counter,
                    controller_id=cid,
                    controller_name=profile.controller_name,
                    start=slot.start,
                    end=slot.end,
                    is_night=slot.is_night,
                    sessions=sessions,
                ))
        return result

    def _build_metrics(
        self,
        assignments: dict[str, str],
        slots: list[ShiftSlot],
        controllers: list[ControllerProfile],
    ) -> dict[str, Any]:
        hours: dict[str, float] = {c.controller_id: 0.0 for c in controllers}
        nights: dict[str, int]  = {c.controller_id: 0   for c in controllers}
        slots_by_id = {s.slot_id: s for s in slots}
        for slot_id, cid in assignments.items():
            s = slots_by_id[slot_id]
            hours[cid] = hours.get(cid, 0.0) + s.duration_hours
            if s.is_night:
                nights[cid] = nights.get(cid, 0) + 1
        h_vals = [v for v in hours.values() if v > 0]
        avg = sum(h_vals) / len(h_vals) if h_vals else 0.0
        return {
            "total_assigned":      len(assignments),
            "total_unassigned":    len(slots) - len(assignments),
            "hours_per_controller": {k: round(v, 2) for k, v in hours.items() if v > 0},
            "night_shifts_per_controller": {k: v for k, v in nights.items() if v > 0},
            "max_hours":  round(max(h_vals), 2) if h_vals else 0.0,
            "min_hours":  round(min(h_vals), 2) if h_vals else 0.0,
            "avg_hours":  round(avg, 2),
        }

    # ------------------------------------------------------------------
    # CP-SAT solver
    # ------------------------------------------------------------------

    def _solve_cpsat(
        self,
        slots: list[ShiftSlot],
        controllers: list[ControllerProfile],
        time_limit_seconds: int,
    ) -> OptimizationResult:
        cp_model = _cp_model

        model = cp_model.CpModel()
        C, S = len(controllers), len(slots)
        min_rest_h = self.cfg.min_rest_between_shifts_hours or 0.0

        # eligibility[c][s] = True nếu controller c có thể làm slot s
        eligible = [
            [self._can_assign(slots[s], controllers[c]) for s in range(S)]
            for c in range(C)
        ]

        # Biến: x[c][s] = 1 nếu controller c được phân slot s
        x: list[list] = [
            [
                model.new_bool_var(f"x_{c}_{s}") if eligible[c][s]
                else model.new_constant(0)
                for s in range(S)
            ]
            for c in range(C)
        ]

        # Ràng buộc 1: mỗi slot tối đa 1 controller (slot không có ai đủ năng định -> bỏ trống)
        for s in range(S):
            elig = [x[c][s] for c in range(C) if eligible[c][s]]
            if elig:
                model.add_exactly_one(elig)
            # else: slot không có ai đủ điều kiện -> sẽ xuất hiện trong unassigned_slots

        # Ràng buộc 2: nghỉ tối thiểu giữa hai ca liên tiếp của cùng controller
        if min_rest_h > 0:
            order = sorted(range(S), key=lambda i: slots[i].start)
            for c in range(C):
                for ii in range(len(order)):
                    s1 = order[ii]
                    for jj in range(ii + 1, len(order)):
                        s2 = order[jj]
                        gap_h = (slots[s2].start - slots[s1].end).total_seconds() / 3600.0
                        if gap_h >= min_rest_h:
                            break   # sorted -> tất cả slots sau đều OK
                        # gap < min_rest -> không thể cùng phân cho controller này
                        if eligible[c][s1] and eligible[c][s2]:
                            model.add_at_most_one([x[c][s1], x[c][s2]])

        # Mục tiêu: công bằng — minimize (max_minutes - min_minutes)
        slot_min = [int(slots[s].duration_hours * 60) for s in range(S)]
        total_minutes_per_ctrl = []
        for c in range(C):
            terms = [
                x[c][s] * slot_min[s]
                for s in range(S) if eligible[c][s]
            ]
            if terms:
                t = model.new_int_var(0, sum(slot_min), f"tot_{c}")
                model.add(t == sum(terms))
            else:
                t = model.new_constant(0)
            total_minutes_per_ctrl.append(t)

        max_m = model.new_int_var(0, sum(slot_min), "max_m")
        min_m = model.new_int_var(0, sum(slot_min), "min_m")
        model.add_max_equality(max_m, total_minutes_per_ctrl)
        model.add_min_equality(min_m, total_minutes_per_ctrl)
        model.minimize(max_m - min_m)   # minimize khoảng cách max-min giờ trực

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        code = solver.solve(model)

        ok_codes = {cp_model.OPTIMAL, cp_model.FEASIBLE}
        # Các slot không ai đủ điều kiện -> luôn unassigned, tách riêng trước khi solve
        no_eligible = {slots[s].slot_id for s in range(S)
                       if not any(eligible[c][s] for c in range(C))}

        if code not in ok_codes:
            return OptimizationResult(
                status="INFEASIBLE",
                assignments={},
                unassigned_slots=[s.slot_id for s in slots],
                compliance_violations=[],
                metrics={"total_assigned": 0, "total_unassigned": len(slots)},
                solver_used="CP-SAT",
                note="Không tìm được phương án khả thi trong giới hạn thời gian.",
            )

        assignments: dict[str, str] = {}
        for s in range(S):
            for c in range(C):
                if eligible[c][s] and solver.value(x[c][s]) == 1:
                    assignments[slots[s].slot_id] = controllers[c].controller_id
                    break

        unassigned = [
            slots[s].slot_id for s in range(S)
            if slots[s].slot_id not in assignments
        ]
        has_any_assigned = bool(assignments)
        if code == cp_model.OPTIMAL and not unassigned:
            status_str = "OPTIMAL"
        elif has_any_assigned:
            status_str = "FEASIBLE" if not no_eligible else "PARTIAL"
        else:
            status_str = "INFEASIBLE"
        profiles = {c.controller_id: c for c in controllers}
        shifts = self._build_shifts(assignments, slots, profiles)
        quals = {c.controller_id: c.qualification for c in controllers}
        violations = self.checker.check_all(shifts, quals)
        metrics = self._build_metrics(assignments, slots, controllers)

        return OptimizationResult(
            status=status_str,
            assignments=assignments,
            unassigned_slots=unassigned,
            compliance_violations=violations,
            metrics=metrics,
            solver_used="CP-SAT",
            note=(
                "Đây là đề xuất — kíp trưởng phải duyệt trước khi áp dụng. "
                "Mọi ngưỡng trong cấu hình chỉ là ví dụ, cần thay bằng số liệu "
                "VATM/CAAV/ICAO chính thức."
            ),
        )

    # ------------------------------------------------------------------
    # Greedy fallback (không cần ortools)
    # ------------------------------------------------------------------

    def _solve_greedy(
        self,
        slots: list[ShiftSlot],
        controllers: list[ControllerProfile],
    ) -> OptimizationResult:
        """Gán tham lam: với mỗi ca (theo thứ tự thời gian), chọn KSVKL
        có ít giờ nhất, đủ năng định và đủ thời gian nghỉ."""
        sorted_slots = sorted(slots, key=lambda s: s.start)
        min_rest_h = self.cfg.min_rest_between_shifts_hours or 0.0

        total_min: dict[str, float] = {c.controller_id: 0.0 for c in controllers}
        last_end:  dict[str, datetime | None] = {c.controller_id: None for c in controllers}

        assignments: dict[str, str] = {}
        unassigned:  list[str] = []

        for slot in sorted_slots:
            candidates = []
            for c in controllers:
                if not self._can_assign(slot, c):
                    continue
                prev_end = last_end[c.controller_id]
                if prev_end is not None:
                    rest_h = (slot.start - prev_end).total_seconds() / 3600.0
                    if rest_h < min_rest_h:
                        continue
                candidates.append(c)

            if not candidates:
                unassigned.append(slot.slot_id)
                continue

            best = min(candidates, key=lambda c: total_min[c.controller_id])
            assignments[slot.slot_id] = best.controller_id
            total_min[best.controller_id] += slot.duration_hours * 60
            last_end[best.controller_id] = slot.end

        profiles = {c.controller_id: c for c in controllers}
        shifts = self._build_shifts(assignments, slots, profiles)
        quals = {c.controller_id: c.qualification for c in controllers}
        violations = self.checker.check_all(shifts, quals)
        metrics = self._build_metrics(assignments, slots, controllers)
        status = "FEASIBLE" if not unassigned else "PARTIAL"

        return OptimizationResult(
            status=status,
            assignments=assignments,
            unassigned_slots=unassigned,
            compliance_violations=violations,
            metrics=metrics,
            solver_used="GREEDY",
        )
