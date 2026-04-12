from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.daily_reconciliation import DailyReconciliationHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_normal_day():
    resp = DailyReconciliationHandler().compute(
        _req({"date": "2026-04-11", "opening_stock": {"牛肉": 20.0, "黑鱼": 15.0},
              "deliveries": {"牛肉": 10.0, "黑鱼": 8.0},
              "bom_expected_usage": {"牛肉": 12.0, "黑鱼": 10.0},
              "closing_stock": {"牛肉": 17.5, "黑鱼": 12.0}}), {})
    assert resp.status.value == "ok"
    beef = next(i for i in resp.data["reconciliation"] if i["ingredient"] == "牛肉")
    assert beef["expected_closing"] == 18.0
    assert beef["actual_closing"] == 17.5
    assert beef["variance"] == -0.5
    assert beef["within_tolerance"]

def test_over_tolerance():
    resp = DailyReconciliationHandler().compute(
        _req({"date": "2026-04-11", "opening_stock": {"牛肉": 20.0},
              "deliveries": {"牛肉": 10.0}, "bom_expected_usage": {"牛肉": 12.0},
              "closing_stock": {"牛肉": 10.0}, "tolerance_pct": 5.0}), {})
    beef = next(i for i in resp.data["reconciliation"] if i["ingredient"] == "牛肉")
    assert not beef["within_tolerance"]
    assert beef["severity"] == "HIGH"

def test_skipped_no_stock():
    resp = DailyReconciliationHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
