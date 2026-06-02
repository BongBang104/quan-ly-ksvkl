"""
qd2288_checklist.py
===================
Sinh tự động Checklist đánh giá lịch trực theo Phụ lục I của QĐ 2288.
Cấu trúc: A1-A5 (giới hạn thời gian), B1-B4 (nghỉ giữa ca),
          C1-C5 (trực đêm), D1-D4 (on-call), E1-E5 (nguy cơ tiềm ẩn).

Đầu vào: violations list + draft gốc.
Đầu ra: dict chuẩn Phụ lục I, dùng để render hoặc xuất PDF.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

Status = Literal["pass", "fail", "na"]


def _status(violated: bool) -> Status:
    return "fail" if violated else "pass"


def build_checklist(violations: list[dict], draft) -> dict:
    """Sinh checklist Phụ lục I từ kết quả review.

    `violations` — list dict đã chuẩn hóa (mỗi dict có key 'rule').
    `draft`      — RosterDraft (cấp ca) hoặc MacroRosterDraft (cấp tháng).
    """
    by_rule: dict[str, list[dict]] = {}
    for v in violations:
        by_rule.setdefault(v.get("rule", ""), []).append(v)

    def has(rule: str) -> bool:
        return rule in by_rule

    def notes(rule: str) -> str:
        return "; ".join(v.get("message", "") for v in by_rule.get(rule, []))[:200]

    # Metadata từ draft
    team       = getattr(draft, "team", "")
    shift_date = str(getattr(draft, "shift_date", ""))
    shift_code = getattr(draft, "shift_code", "")
    period     = ""
    if hasattr(draft, "period_start") and hasattr(draft, "period_end"):
        period = f"{draft.period_start} – {draft.period_end}"

    sections = [
        {
            "code": "A",
            "title": "GIỚI HẠN THỜI GIAN LÀM VIỆC - CẤP LỊCH",
            "items": [
                {"code": "A1", "criterion": "Ca làm việc thiết kế ≤ 10h",
                 "requirement": "Không vượt",
                 "status": _status(has("max_designed_shift")),
                 "note": notes("max_designed_shift")},
                {"code": "A2", "criterion": "Ca có khả năng kéo dài ≤ 12h",
                 "requirement": "Có kiểm soát",
                 "status": _status(has("max_extended_shift")),
                 "note": notes("max_extended_shift")},
                {"code": "A3", "criterion": "Tổng giờ/tuần theo mẫu ≤ 48h",
                 "requirement": "Tuân thủ",
                 "status": _status(has("max_duty_per_week")),
                 "note": notes("max_duty_per_week")},
                {"code": "A4", "criterion": "Mẫu lịch 30 ngày ≤ 180h/người",
                 "requirement": "Tuân thủ",
                 "status": _status(has("max_duty_per_30days")),
                 "note": notes("max_duty_per_30days")},
                {"code": "A5", "criterion": "Có ≥ 4 ngày nghỉ/30 ngày",
                 "requirement": "Đảm bảo",
                 "status": _status(has("min_full_rest_days_per_30days")),
                 "note": notes("min_full_rest_days_per_30days")},
            ],
        },
        {
            "code": "B",
            "title": "NGHỈ GIỮA CÁC CA - ĐÁNH GIÁ CHUỖI CA",
            "items": [
                {"code": "B1", "criterion": "Nghỉ giữa 2 ca ≥ 12h",
                 "requirement": "Không vi phạm",
                 "status": _status(has("min_rest_between_shifts")),
                 "note": notes("min_rest_between_shifts")},
                {"code": "B2", "criterion": "Chuỗi ca sớm → muộn hợp lý",
                 "requirement": "Tránh đảo chiều",
                 "status": _status(has("early_after_late_or_night")),
                 "note": notes("early_after_late_or_night")},
                {"code": "B3", "criterion": "Không có chuỗi 'kết thúc muộn - bắt đầu sớm'",
                 "requirement": "Bị cấm",
                 "status": _status(has("early_after_late_or_night")),
                 "note": ""},
                {"code": "B4", "criterion": "Có đủ cơ hội ngủ thực tế",
                 "requirement": "Xem xét di chuyển",
                 "status": "na",
                 "note": "Cần dữ liệu báo cáo cá nhân để chấm."},
            ],
        },
        {
            "code": "C",
            "title": "THIẾT KẾ TRỰC ĐÊM",
            "items": [
                {"code": "C1", "criterion": "Ca đêm đúng khung 22h-06h",
                 "requirement": "Chuẩn hóa", "status": "pass",
                 "note": "Phân loại ShiftKind đã đảm bảo."},
                {"code": "C2", "criterion": "Không quá 3 ca đêm liên tiếp",
                 "requirement": "Bắt buộc",
                 "status": _status(has("max_consecutive_nights")),
                 "note": notes("max_consecutive_nights")},
                {"code": "C3", "criterion": "Có nghỉ phục hồi ≥ 48h sau chuỗi đêm",
                 "requirement": "Bắt buộc",
                 "status": _status(has("min_rest_after_night_block")),
                 "note": notes("min_rest_after_night_block")},
                {"code": "C4", "criterion": "Nghỉ phục hồi có ≥ 2 đêm ngủ",
                 "requirement": "Phải có", "status": "na",
                 "note": "Cần dữ liệu chi tiết giờ nghỉ thực tế."},
                {"code": "C5", "criterion": "Không bố trí ca sớm ngay sau ca đêm",
                 "requirement": "Tránh",
                 "status": _status(has("early_after_late_or_night")),
                 "note": notes("early_after_late_or_night")},
            ],
        },
        {
            "code": "D",
            "title": "TRỰC DỰ PHÒNG (ON-CALL)",
            "items": [
                {"code": "D1", "criterion": "On-call ≤ 3 lần/7 ngày",
                 "requirement": "Tuân thủ",
                 "status": _status(has("max_oncall_per_7days")),
                 "note": notes("max_oncall_per_7days")},
                {"code": "D2", "criterion": "On-call không trùng lịch trực chính",
                 "requirement": "Tránh", "status": "na",
                 "note": "Kiểm tra logic ở tầng nhập liệu."},
                {"code": "D3", "criterion": "Có phương án điều chỉnh ca nếu bị gọi",
                 "requirement": "Bắt buộc", "status": "na",
                 "note": "Quy trình QĐ 2289 Chương III."},
                {"code": "D4", "criterion": "On-call không làm mất nghỉ phục hồi",
                 "requirement": "Phải đảm bảo",
                 "status": _status(has("max_oncall_duration")),
                 "note": notes("max_oncall_duration")},
            ],
        },
        {
            "code": "E",
            "title": "NGUY CƠ MỆT MỎI TIỀM ẨN TRONG LỊCH TRỰC",
            "items": [
                {"code": "E1", "criterion": "Chuỗi ca dài liên tục ≥ 6 ngày",
                 "requirement": "Cảnh báo",
                 "status": "fail" if has("max_consecutive_days") else "pass",
                 "note": notes("max_consecutive_days")},
                {"code": "E2", "criterion": "Nhiều ca kéo dài gần giới hạn",
                 "requirement": "Cảnh báo",
                 "status": "fail" if has("max_extended_shift") else "pass",
                 "note": notes("max_extended_shift")},
                {"code": "E3", "criterion": "Tập trung ca đêm vào ít người",
                 "requirement": "Cảnh báo", "status": "na",
                 "note": "Cần phân tích phân bổ — Phase 2."},
                {"code": "E4", "criterion": "Nghỉ giữa ca 'đạt luật nhưng kém sinh học'",
                 "requirement": "Cảnh báo", "status": "na",
                 "note": "Cần dữ liệu báo cáo cá nhân."},
                {"code": "E5", "criterion": "Có lịch cần xem xét variation",
                 "requirement": "Cảnh báo", "status": "na",
                 "note": "Đánh dấu thủ công bởi cán bộ lập lịch."},
            ],
        },
    ]

    total = sum(len(s["items"]) for s in sections)
    pass_c  = sum(1 for s in sections for it in s["items"] if it["status"] == "pass")
    fail_c  = sum(1 for s in sections for it in s["items"] if it["status"] == "fail")
    na_c    = total - pass_c - fail_c
    overall = "pass" if fail_c == 0 else ("needs_review" if fail_c <= 3 else "fail")

    return {
        "header": {
            "source": "QĐ 2288/QĐ-QLB ngày 25/3/2026 — Phụ lục I",
            "effective_from": "2026-03-25",
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "roster_info": {
                "team":       team,
                "shift_date": shift_date,
                "shift_code": shift_code,
                "period":     period,
            },
        },
        "summary": {
            "total_items":   total,
            "pass_count":    pass_c,
            "fail_count":    fail_c,
            "na_count":      na_c,
            "overall_status": overall,
        },
        "sections": sections,
    }
