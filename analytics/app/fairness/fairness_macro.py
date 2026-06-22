"""
fairness_macro.py
=================
Tính công bằng phân ca cấp tháng từ MacroRosterDraft (scheduleData).
Logic: đếm số ca S/D mỗi KSVKL, tính giờ làm chuẩn, giờ đêm.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from app.compliance.rest_compliance import RestRuleConfig, classify_shift_kind, ShiftKind
from app.routers.schemas_macro import MacroRosterDraft

# giờ bắt đầu/kết thúc theo loại ca (end >= 24 = qua nửa đêm)
_SHIFT_HOURS: dict[str, tuple[int, int]] = {
    "S": (7, 19),   # 12h
    "D": (19, 31),  # 31 = 24+7 → 12h đêm
}


def compute_fairness_from_macro(draft: MacroRosterDraft) -> dict:
    cfg = RestRuleConfig()
    per_ctrl: dict[str, dict] = defaultdict(lambda: {
        "controller_id": "", "controller_name": "",
        "total_hours": 0.0, "night_hours": 0.0,
        "night_shifts": 0, "shift_count": 0, "work_days": set(),
    })

    ctrl_name_map = {str(c.id): c.name for c in (draft.controllers or [])}

    for a in draft.assignments:
        kind = (a.shift_kind or "OFF").upper()
        if kind not in _SHIFT_HOURS:
            continue
        hours = _SHIFT_HOURS[kind]
        cid = str(a.controller_id)
        ent = per_ctrl[cid]
        ent["controller_id"] = cid
        ent["controller_name"] = ctrl_name_map.get(cid, cid)
        ent["shift_count"] += 1
        ent["work_days"].add(str(a.date))
        duration = hours[1] - hours[0]
        ent["total_hours"] += duration

        # Phân loại night để tính giờ đêm
        d = date.fromisoformat(str(a.date))
        start_dt = datetime(d.year, d.month, d.day, hours[0] % 24)
        end_h = hours[1]
        if end_h >= 24:
            end_dt = datetime(d.year, d.month, d.day, end_h - 24) + timedelta(days=1)
        else:
            end_dt = datetime(d.year, d.month, d.day, end_h)
        sk = classify_shift_kind(start_dt, end_dt, cfg)
        if sk == ShiftKind.NIGHT:
            ent["night_shifts"] += 1
            ent["night_hours"] += duration

    controllers = []
    for ent in per_ctrl.values():
        controllers.append({
            "controller_id":   ent["controller_id"],
            "controller_name": ent["controller_name"],
            "total_hours":     round(ent["total_hours"], 1),
            "night_hours":     round(ent["night_hours"], 1),
            "night_shifts":    ent["night_shifts"],
            "shift_count":     ent["shift_count"],
            "work_days":       len(ent["work_days"]),
        })

    if controllers:
        total_avg = sum(c["total_hours"] for c in controllers) / len(controllers)
        variance  = sum((c["total_hours"] - total_avg) ** 2 for c in controllers) / len(controllers)
        std       = variance ** 0.5
        max_h     = max(c["total_hours"] for c in controllers)
        min_h     = min(c["total_hours"] for c in controllers)
    else:
        total_avg = std = max_h = min_h = 0.0

    return {
        "controllers":    sorted(controllers, key=lambda c: -c["total_hours"]),
        "avg_hours":      round(total_avg, 1),
        "std_hours":      round(std, 1),
        "max_hours":      round(max_h, 1),
        "min_hours":      round(min_h, 1),
        "max_delta_hours": round(max_h - min_h, 1),
    }
