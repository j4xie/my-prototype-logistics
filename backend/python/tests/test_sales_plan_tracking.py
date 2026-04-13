from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.sales_plan_tracking import SalesPlanTrackingHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_on_track():
    handler = SalesPlanTrackingHandler()
    resp = handler.compute(
        _req({"target_revenue": 500000, "actual_revenue": 280000,
              "day_of_month": 15, "total_days": 30}), {},
    )
    assert resp.status.value == "ok"
    assert resp.data["completion_pct"] == 56.0
    assert resp.data["expected_pct"] == 50.0
    assert resp.data["status"] == "ON_TRACK"


def test_behind():
    handler = SalesPlanTrackingHandler()
    resp = handler.compute(
        _req({"target_revenue": 500000, "actual_revenue": 100000,
              "day_of_month": 20, "total_days": 30}), {},
    )
    assert resp.status.value == "ok"
    assert resp.data["status"] == "BEHIND"
    assert resp.data["gap"] == 400000
    assert resp.data["daily_needed"] == 40000


def test_skipped_when_no_target():
    handler = SalesPlanTrackingHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"
