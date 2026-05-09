"""BOM Variance dual attribution: split cost delta into supply chain (price) vs management (usage)."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.bom_variance import BomVarianceHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        store_id=None,
        store_name=None,
        params=params,
    )


def test_dual_attribution_basic():
    handler = BomVarianceHandler()
    resp = handler.compute(
        _req({
            "items": [
                {
                    "sku": "黑鱼",
                    "std_qty": 100, "std_price": 10.0,
                    "actual_qty": 120, "actual_price": 11.0,
                },
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    d = resp.data
    assert len(d["items"]) == 1
    item = d["items"][0]
    assert item["sku"] == "黑鱼"
    assert item["price_variance"] == 100.0
    assert item["usage_variance"] == 200.0
    assert item["total_variance"] == 300.0
    assert d["summary"]["total_price_variance"] == 100.0
    assert d["summary"]["total_usage_variance"] == 200.0


def test_skipped_when_no_items():
    handler = BomVarianceHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"


def test_negative_variance_means_savings():
    handler = BomVarianceHandler()
    resp = handler.compute(
        _req({
            "items": [
                {"sku": "牛肉", "std_qty": 50, "std_price": 40.0,
                 "actual_qty": 45, "actual_price": 38.0},
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    item = resp.data["items"][0]
    assert item["price_variance"] == -100.0
    assert item["usage_variance"] == -200.0
    assert item["total_variance"] == -300.0
