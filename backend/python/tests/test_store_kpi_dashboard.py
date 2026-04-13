"""Store KPI dashboard: unified view of financial + operational + external metrics."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.store_kpi_dashboard import StoreKpiDashboardHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_full_dashboard():
    resp = StoreKpiDashboardHandler().compute(
        _req({
            "financial": {"controllable_profit": 180000, "revenue": 500000, "labor_cost_pct": 22.5},
            "operational": {"labor_productivity": 35000, "staff_turnover_pct": 8.0, "shift_compliance": 95.0},
            "external": {"review_score": 4.3, "negative_review_pct": 2.1},
        }), {})
    assert resp.status.value == "ok"
    d = resp.data
    assert len(d["dimensions"]) == 3
    assert d["overall_health"] in ("GOOD", "WARNING", "CRITICAL")

def test_partial_data():
    resp = StoreKpiDashboardHandler().compute(
        _req({"financial": {"revenue": 300000}}), {})
    assert resp.status.value == "ok"
    assert len(resp.data["dimensions"]) >= 1

def test_skipped_empty():
    resp = StoreKpiDashboardHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
