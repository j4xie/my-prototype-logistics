"""Return anomaly: detect stores with abnormal return rates per supplier/batch."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.return_anomaly import ReturnAnomalyHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id=None, store_name=None, params=params)

def test_detects_anomaly():
    resp = ReturnAnomalyHandler().compute(
        _req({"deliveries": [
            {"store": "门店A", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 2},
            {"store": "门店B", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 3},
            {"store": "门店C", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 25},
            {"store": "门店D", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 1},
        ]}), {})
    assert resp.status.value == "ok"
    assert len(resp.data["anomalies"]) == 1
    assert resp.data["anomalies"][0]["store"] == "门店C"
    assert resp.data["anomalies"][0]["return_pct"] == 25.0

def test_no_anomaly():
    resp = ReturnAnomalyHandler().compute(
        _req({"deliveries": [
            {"store": "A", "supplier": "S1", "batch": "B1", "ordered": 100, "returned": 3},
            {"store": "B", "supplier": "S1", "batch": "B1", "ordered": 100, "returned": 4},
        ]}), {})
    assert resp.status.value == "ok"
    assert len(resp.data["anomalies"]) == 0

def test_skipped_no_deliveries():
    resp = ReturnAnomalyHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
