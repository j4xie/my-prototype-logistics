"""Review competitive: compare own brand's reviews against competitors."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.review_competitive import ReviewCompetitiveHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id=None, store_name=None, params=params)

def test_competitive_ranking():
    resp = ReviewCompetitiveHandler().compute(
        _req({"own_brand": {"name": "青花椒", "rating": 4.2, "review_count": 850, "avg_ticket": 128},
              "competitors": [
                  {"name": "海底捞", "rating": 4.6, "review_count": 5200, "avg_ticket": 155},
                  {"name": "小龙坎", "rating": 4.3, "review_count": 2100, "avg_ticket": 118},
                  {"name": "大龙燚", "rating": 4.1, "review_count": 1200, "avg_ticket": 110}]}), {})
    assert resp.status.value == "ok"
    assert resp.data["ranking"][0]["name"] == "海底捞"
    own = next(r for r in resp.data["ranking"] if r["name"] == "青花椒")
    assert own["rank"] > 0
    assert "insights" in resp.data

def test_own_brand_only():
    resp = ReviewCompetitiveHandler().compute(
        _req({"own_brand": {"name": "青花椒", "rating": 4.2, "review_count": 500, "avg_ticket": 120}}), {})
    assert resp.status.value == "ok"
    assert resp.data["ranking"][0]["name"] == "青花椒"

def test_skipped_no_brand():
    resp = ReviewCompetitiveHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
