"""Labor productivity: revenue per employee with zone monitoring.
Customer: '人效3-4万, 低于3也不对, 高于4也有问题'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.labor_productivity import LaborProductivityHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_normal_zone():
    handler = LaborProductivityHandler()
    resp = handler.compute(_req({"revenue": 350000, "headcount": 10}), context={})
    assert resp.status.value == "ok"
    assert resp.data["productivity"] == 35000
    assert resp.data["zone"] == "HEALTHY"


def test_low_zone():
    handler = LaborProductivityHandler()
    resp = handler.compute(_req({"revenue": 200000, "headcount": 10}), context={})
    assert resp.data["productivity"] == 20000
    assert resp.data["zone"] == "OVERSTAFFED"
    assert "用人过多" in resp.data["diagnosis"]


def test_high_zone():
    handler = LaborProductivityHandler()
    resp = handler.compute(_req({"revenue": 500000, "headcount": 10}), context={})
    assert resp.data["productivity"] == 50000
    assert resp.data["zone"] == "UNDERSTAFFED"
    assert "服务跟不上" in resp.data["diagnosis"]


def test_custom_zone_thresholds():
    handler = LaborProductivityHandler()
    resp = handler.compute(
        _req({"revenue": 250000, "headcount": 10, "low_threshold": 20000, "high_threshold": 35000}),
        context={},
    )
    assert resp.data["zone"] == "HEALTHY"


def test_skipped_no_headcount():
    handler = LaborProductivityHandler()
    resp = handler.compute(_req({"revenue": 100000}), context={})
    assert resp.status.value == "skipped"
