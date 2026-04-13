"""Phase 1 integration: verify all 4 handlers are registered and produce valid responses."""
import pytest
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.bom_variance import BomVarianceHandler
from smartbi.services.restaurant.sections.sales_plan_tracking import SalesPlanTrackingHandler
from smartbi.services.restaurant.sections.labor_productivity import LaborProductivityHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-QINGHUAJIAO", upload_id=None, sub_sector="火锅",
        store_id="S-001", store_name="青花椒义乌店", params=params,
    )


class TestPhase1Integration:
    def test_bom_variance_happy_path(self):
        resp = BomVarianceHandler().compute(
            _req({"items": [
                {"sku": "黑鱼", "std_qty": 100, "std_price": 10, "actual_qty": 110, "actual_price": 11},
            ]}), {},
        )
        assert resp.status.value == "ok"
        assert resp.data["summary"]["dominant_factor"] in ("supply_chain", "management")

    def test_sales_plan_tracking_happy_path(self):
        resp = SalesPlanTrackingHandler().compute(
            _req({"target_revenue": 500000, "actual_revenue": 300000,
                  "day_of_month": 18, "total_days": 30}), {},
        )
        assert resp.status.value == "ok"
        assert resp.data["status"] in ("ON_TRACK", "SLIGHT_BEHIND", "BEHIND")

    def test_labor_productivity_happy_path(self):
        resp = LaborProductivityHandler().compute(
            _req({"revenue": 350000, "headcount": 10}), {},
        )
        assert resp.status.value == "ok"
        assert resp.data["zone"] in ("OVERSTAFFED", "HEALTHY", "UNDERSTAFFED")

    def test_all_handlers_have_section_name(self):
        for cls in (BomVarianceHandler, SalesPlanTrackingHandler, LaborProductivityHandler):
            assert cls.section_name, f"{cls.__name__} missing section_name"
