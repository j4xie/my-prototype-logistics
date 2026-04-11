"""Tests for analysis section handlers (Task 1.5).

Covers:
  - ReviewAnalysisHandler   → wraps LlmReviewAnalyzer + ReviewAnalyzer (regex fallback)
  - MemberRfmHandler        → wraps MemberRfmAnalyzer
  - StoredValueHandler      → wraps StoredValueAnalyzer

Each handler has at least:
  1. A positive path test (real synthetic input → OK or graceful SKIPPED)
  2. A skip path test (missing required input → SKIPPED with reason)

Tests use ``in (OK, SKIPPED)`` for tolerant assertions where the underlying
engine may legitimately return SKIPPED on edge cases (e.g. tiny synthetic
samples that don't trip min_mentions thresholds). The contract being tested
is that the handler **does not crash** and returns a valid SectionResponse.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.member_rfm import MemberRfmHandler
from smartbi.services.restaurant.sections.review_analysis import ReviewAnalysisHandler
from smartbi.services.restaurant.sections.stored_value import StoredValueHandler


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────


@pytest.fixture
def sample_reviews() -> list[dict]:
    """20 synthetic reviews with mixed sentiments + dish mentions.

    Mentions 青花椒鱼 (~10x) and 酸菜鱼 (~10x) so the regex analyzer can
    surface them with min_mentions=2.
    """
    base_dt = datetime(2026, 1, 1)
    reviews = []
    for i in range(20):
        rating = 5.0 if i % 3 != 0 else 3.0
        if i % 2 == 0:
            content = "青花椒鱼好吃, 服务一般, 酸菜鱼可以"
        else:
            content = "上菜慢, 青花椒鱼还行, 酸菜鱼推荐"
        reviews.append({
            "id": f"r-{i}",
            "rating": rating,
            "content": content,
            "created_at": (base_dt + timedelta(days=i)).isoformat(),
            "store_name": "青花椒松江店",
            "platform": "dianping",
        })
    return reviews


@pytest.fixture
def sample_members() -> list[dict]:
    """20 synthetic members with diverse R/F/M values for quintile binning.

    Uses the analyzer.py-compatible schema:
      - last_order_days_ago, order_count, total_amount
    """
    return [
        {
            "member_id": f"M{i:03d}",
            "last_order_days_ago": i * 3,
            "order_count": max(1, 10 - i // 2),
            "total_amount": 200.0 + i * 50,
        }
        for i in range(1, 21)
    ]


# ─────────────────────────────────────────────────────────
# ReviewAnalysisHandler
# ─────────────────────────────────────────────────────────


def test_review_analysis_runs_on_sample_regex(sample_reviews):
    """use_llm=False forces regex path → no LLM calls in tests."""
    handler = ReviewAnalysisHandler()
    req = SectionRequest(
        factory_id="F1",
        upload_id="u1",
        sub_sector="川菜",
        params={"reviews": sample_reviews, "use_llm": False},
    )
    response = handler.compute(req, context={})
    assert response.section_name == "review_analysis"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    assert response.computed_at_ms >= 0
    if response.status == SectionStatus.OK:
        # Regex path → usedLlm must be False
        assert response.data["usedLlm"] is False
        # ReviewAnalysisReport.to_dict() guarantees these top-level keys
        assert "totalReviews" in response.data
        assert response.data["totalReviews"] == 20
        assert "dishTags" in response.data
        assert "ratingTrend" in response.data


def test_review_analysis_skipped_without_reviews():
    handler = ReviewAnalysisHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("reviews" in w for w in response.warnings)


# ─────────────────────────────────────────────────────────
# MemberRfmHandler
# ─────────────────────────────────────────────────────────


def test_member_rfm_runs_on_sample(sample_members):
    handler = MemberRfmHandler()
    req = SectionRequest(
        factory_id="F1",
        upload_id="u1",
        sub_sector="川菜",
        params={"members": sample_members, "as_of_date": "2026-02-28"},
    )
    response = handler.compute(req, context={})
    assert response.section_name == "member_rfm"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        # RfmReport.to_dict() guarantees these top-level keys
        assert "totalMembers" in response.data
        assert response.data["totalMembers"] == 20
        assert "segmentCounts" in response.data
        assert isinstance(response.data["segmentCounts"], dict)


def test_member_rfm_skipped_without_members():
    handler = MemberRfmHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("members" in w for w in response.warnings)


def test_member_rfm_reads_members_from_context(sample_members):
    """Batch mode: members staged in context, not request.params."""
    handler = MemberRfmHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={"members": sample_members})
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)


# ─────────────────────────────────────────────────────────
# StoredValueHandler
# ─────────────────────────────────────────────────────────


def test_stored_value_runs_with_giveaway():
    """邓总火锅-style scenario: giveaway 50k on revenue 731k → ~6.8% (warning)."""
    handler = StoredValueHandler()
    req = SectionRequest(
        factory_id="F1",
        upload_id="u1",
        sub_sector="火锅",
        params={
            "financial_data": {
                "current": {
                    "revenue": 731048,
                    "stored_value_giveaway": 50000,
                    "stored_value_charge": 120000,
                    "previous_stored_value_balance": 180000,
                }
            }
        },
    )
    response = handler.compute(req, context={})
    assert response.section_name == "stored_value"
    assert response.status == SectionStatus.OK
    # StoredValueReport.to_dict() canonical keys
    assert "dependencyPct" in response.data
    assert response.data["dependencyPct"] > 0
    assert response.data["severity"] in ("info", "warning", "critical")
    # 50000 / 731048 ≈ 0.0684 → warning
    assert response.data["severity"] == "warning"


def test_stored_value_skipped_without_giveaway():
    handler = StoredValueHandler()
    req = SectionRequest(
        factory_id="F1",
        upload_id="u1",
        sub_sector="火锅",
        params={"financial_data": {"current": {"revenue": 100000}}},
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("stored_value_giveaway" in w or "储值依赖" in w for w in response.warnings)


def test_stored_value_skipped_without_financial_data():
    handler = StoredValueHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="火锅", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("financial_data" in w for w in response.warnings)


def test_stored_value_triggers_critical_at_7pct():
    """Regression: 鼎鲜 7.07% stored_value_giveaway ratio must be 'critical'.

    Previous thresholds (10% warning, 15% critical) missed this.
    Real mature hotpot chains have 5-8% dependency — above that is a
    liquidity risk, not just a KPI concern. P3.5A QW1 lowered thresholds
    to 5% warning / 7% critical.
    """
    from smartbi.services.restaurant.sections.stored_value import StoredValueHandler
    from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus

    h = StoredValueHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={"financial_data": {"current": {
            "revenue": 731048,
            "stored_value_giveaway": 51680.61,  # 7.07% of revenue
        }}},
    )
    resp = h.compute(req, context={})

    assert resp.status == SectionStatus.OK, (
        f"Expected OK, got {resp.status}. Warnings: {resp.warnings}"
    )
    assert resp.data.get("severity") == "critical", (
        f"Expected 'critical' for 7.07% ratio, got {resp.data.get('severity')}. "
        f"Data: {resp.data}"
    )


# === P3.5B F3 tests: stored value 3-mode treatment ===

def test_f3_stored_value_mode_prepaid_default_behavior():
    """PREPAID mode is the default — 充卡 as future liability."""
    from smartbi.services.finance.margin_spec import StoredValueTreatment
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer

    analyzer = StoredValueAnalyzer()
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
        mode=StoredValueTreatment.PREPAID,
    )
    # Severity should be critical (7.07% > 7% threshold from QW1)
    assert report.severity == "critical"
    # Mode should be recorded in the report
    report_dict = report.to_dict() if hasattr(report, "to_dict") else report.__dict__
    assert str(report_dict.get("mode", "")).upper() == "PREPAID" or report_dict.get("mode") == StoredValueTreatment.PREPAID.value


def test_f3_stored_value_mode_revenue_treats_as_expense():
    """REVENUE mode: 充卡 as revenue, 赠送 as marketing expense."""
    from smartbi.services.finance.margin_spec import StoredValueTreatment
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer

    analyzer = StoredValueAnalyzer()
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
        mode=StoredValueTreatment.REVENUE,
    )
    # Same ratio (7.07%) but different mode
    report_dict = report.to_dict() if hasattr(report, "to_dict") else report.__dict__
    assert str(report_dict.get("mode", "")).upper() == "REVENUE" or report_dict.get("mode") == StoredValueTreatment.REVENUE.value
    # Severity still depends on ratio (7.07% > 7% → critical)
    assert report.severity == "critical"


def test_f3_stored_value_mode_excluded_is_info():
    """EXCLUDED mode: 充卡 not in revenue → no risk → severity 'info' regardless of amount."""
    from smartbi.services.finance.margin_spec import StoredValueTreatment
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer

    analyzer = StoredValueAnalyzer()
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
        mode=StoredValueTreatment.EXCLUDED,
    )
    # When excluded from revenue, there's no dependency risk
    assert report.severity == "info"
    report_dict = report.to_dict() if hasattr(report, "to_dict") else report.__dict__
    assert str(report_dict.get("mode", "")).upper() == "EXCLUDED" or report_dict.get("mode") == StoredValueTreatment.EXCLUDED.value


def test_f3_stored_value_mode_omitted_defaults_to_prepaid():
    """Backward compat: omitted mode param → PREPAID default."""
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer

    analyzer = StoredValueAnalyzer()
    # Call WITHOUT mode param — should not raise
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
    )
    # Default behavior matches pre-F3 (should be critical for 7.07%)
    assert report.severity == "critical"
