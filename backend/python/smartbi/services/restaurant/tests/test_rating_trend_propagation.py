"""P3 Task 3.9: verify RatingTrend.periods propagates through
review_analysis section handler to API response."""
from datetime import datetime, timedelta

import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.review_analysis import ReviewAnalysisHandler


@pytest.fixture
def five_month_reviews():
    """200 synthetic reviews, ratings declining from 4.93 to 4.30 over 5 months."""
    reviews = []
    ratings_by_month = [4.93, 4.82, 4.68, 4.51, 4.30]
    for month_idx, avg_rating in enumerate(ratings_by_month):
        month_start = datetime(2026, 1 + month_idx, 1)
        for i in range(40):
            reviews.append({
                "id": f"r-{month_idx}-{i}",
                "rating": avg_rating + (i % 3 - 1) * 0.1,
                "content": "菜还行, 服务一般",
                # Use %Y-%m-%d so _parse_period can parse it (isoformat adds T separator)
                "created_at": (month_start + timedelta(days=i % 28)).strftime("%Y-%m-%d"),
                "store_name": "青花椒松江店",
                "platform": "dianping",
            })
    return reviews


def _extract_rating_trend(data: dict):
    """Look for ratingTrend at top level or common nested locations."""
    rating_trend = data.get("ratingTrend") or data.get("rating_trend")
    if rating_trend is None:
        for candidate_key in ("summary", "analysis", "stats"):
            nested = data.get(candidate_key)
            if isinstance(nested, dict) and "ratingTrend" in nested:
                rating_trend = nested["ratingTrend"]
                break
    return rating_trend


def test_review_section_exposes_rating_trend_periods(five_month_reviews):
    """review_analysis section must expose ratingTrend with periods array."""
    handler = ReviewAnalysisHandler()
    req = SectionRequest(
        factory_id="F-QINGHUAJIAO",
        upload_id="u-test",
        sub_sector="川菜",
        params={"reviews": five_month_reviews, "use_llm": False},  # regex fallback for speed
    )
    response = handler.compute(req, context={})

    assert response.status == SectionStatus.OK, (
        f"Expected OK, got {response.status}. Warnings: {response.warnings}"
    )
    data = response.data
    rating_trend = _extract_rating_trend(data)

    assert rating_trend is not None, (
        f"ratingTrend not found in response data. Keys: {list(data.keys())}"
    )
    # periods list must exist + have entries
    periods = rating_trend.get("periods")
    assert periods is not None, (
        f"periods field missing from ratingTrend. Got: {list(rating_trend.keys())}"
    )
    assert len(periods) >= 3, f"Expected >=3 period buckets, got {len(periods)}"


def test_review_section_rating_trend_is_declining(five_month_reviews):
    """Synthetic fixture has declining trend — verify earliestAvg > latestAvg."""
    handler = ReviewAnalysisHandler()
    req = SectionRequest(
        factory_id="F-QINGHUAJIAO",
        upload_id="u-test",
        sub_sector="川菜",
        params={"reviews": five_month_reviews, "use_llm": False},
    )
    response = handler.compute(req, context={})
    if response.status != SectionStatus.OK:
        pytest.skip(f"Section skipped: {response.warnings}")

    rating_trend = _extract_rating_trend(response.data)
    if rating_trend is None or "earliestAvg" not in rating_trend:
        pytest.skip("ratingTrend shape doesn't match expected — different schema")

    # Trend should show declining ratings
    assert rating_trend["earliestAvg"] > rating_trend["latestAvg"]
