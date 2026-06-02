"""Test endpoint POST /analytics/exchange/precheck."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _ctrl(cid="E1", name="A", qual="Full"):
    return {"id": cid, "name": name, "qualification": qual}


def _shift(d, code="S"):
    return {"date": d, "code": code}


def _payload(**overrides):
    base = {
        "type": "EXCHANGE",
        "applicant":    _ctrl("E1", "Alice", "Full"),
        "counterparty": _ctrl("E2", "Bob",   "Full"),
        "applicant_shift":    {"date": "2026-06-15", "code": "S"},
        "counterparty_shift": {"date": "2026-06-20", "code": "S"},
        "applicant_current_shifts":    [_shift("2026-06-15", "S")],
        "counterparty_current_shifts": [_shift("2026-06-20", "S")],
    }
    base.update(overrides)
    return base


def test_clean_exchange_can_approve():
    """Đổi ca sạch giữa 2 người Full — không vi phạm gì."""
    r = client.post("/analytics/exchange/precheck", json=_payload())
    assert r.status_code == 200
    body = r.json()
    assert body["can_approve"] is True
    assert body["qualification_check"]["applicant_has_required"] is True
    assert body["new_violations_applicant"] == []
    assert body["new_violations_counterparty"] == []


def test_qualification_mismatch_blocks():
    """Full vs APP-only → không tương đương → can_approve=False."""
    r = client.post("/analytics/exchange/precheck", json=_payload(
        counterparty=_ctrl("E2", "Bob", "APP"),
    ))
    assert r.status_code == 200
    body = r.json()
    assert body["can_approve"] is False
    assert body["qualification_check"]["applicant_has_required"] is False
    assert any("năng định" in w.lower() for w in body["warnings"])


def test_subset_equal_qualifications_ok():
    """Cùng subset APP,CTL → tương đương → can_approve=True."""
    r = client.post("/analytics/exchange/precheck", json=_payload(
        applicant=_ctrl("E1", "Alice", "APP,CTL"),
        counterparty=_ctrl("E2", "Bob",  "APP,CTL"),
    ))
    assert r.status_code == 200
    body = r.json()
    assert body["can_approve"] is True


def test_new_consecutive_days_violation_after_swap():
    """Counterparty đã làm 6 ngày liên tiếp — nhận thêm ca ngày 21 → 7 ngày → vi phạm."""
    cp_shifts = [_shift(f"2026-06-{d:02d}", "S") for d in range(15, 21)]  # 15..20
    r = client.post("/analytics/exchange/precheck", json=_payload(
        applicant_shift={"date": "2026-06-21", "code": "S"},
        counterparty_shift={"date": "2026-06-10", "code": "S"},
        applicant_current_shifts=[_shift("2026-06-21", "S")],
        counterparty_current_shifts=cp_shifts + [_shift("2026-06-10", "S")],
    ))
    assert r.status_code == 200
    body = r.json()
    # counterparty sau khi đổi làm 7 ngày liên tiếp 15-21
    new_cp_rules = {v["rule"] for v in body["new_violations_counterparty"]}
    assert "max_consecutive_days" in new_cp_rules or body["warnings"]


def test_cover_type_no_counterparty_shift():
    """type=COVER không cần counterparty_shift."""
    payload = _payload(type="COVER")
    payload["counterparty_shift"] = None
    r = client.post("/analytics/exchange/precheck", json=payload)
    assert r.status_code == 200
    assert r.json()["can_approve"] is True


def test_exchange_without_counterparty_shift_returns_400():
    """type=EXCHANGE thiếu counterparty_shift → 400."""
    payload = _payload()
    payload["counterparty_shift"] = None
    r = client.post("/analytics/exchange/precheck", json=payload)
    assert r.status_code == 400
