"""Performance eval: weighted KPI scoring for store managers."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.performance_eval import PerformanceEvalHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_basic_eval():
    resp = PerformanceEvalHandler().compute(
        _req({
            "kpi_weights": {
                "controllable_profit": {"weight": 40, "target": 200000, "actual": 180000},
                "labor_productivity": {"weight": 30, "target": 35000, "actual": 32000},
                "review_score": {"weight": 30, "target": 4.5, "actual": 4.3},
            },
        }), {})
    assert resp.status.value == "ok"
    d = resp.data
    assert d["total_score"] > 0
    assert d["total_score"] <= 100
    assert len(d["kpi_details"]) == 3

def test_perfect_score():
    resp = PerformanceEvalHandler().compute(
        _req({"kpi_weights": {
            "profit": {"weight": 100, "target": 100, "actual": 100}}}), {})
    assert resp.data["total_score"] == 100.0

def test_skipped_no_kpis():
    resp = PerformanceEvalHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
