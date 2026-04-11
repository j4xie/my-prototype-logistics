"""Integration tests for RestaurantAnalyzerV2 orchestration.

No DB, no LLM. Exercises the top-level `analyze()` method with various
input combinations to verify that each section is produced (or gracefully
omitted) based on input availability.
"""
from __future__ import annotations

import pandas as pd
import pytest

from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2


# ─────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────


@pytest.fixture
def sample_financial_data() -> dict:
    """Financial metrics with both current and previous period (for cost rigidity)."""
    return {
        "current": {
            "revenue": 731048,
            "food_cost": 335213,
            "labor_cost": 237660,
            "rent": 57328,
            "other_cost": 40000,
            "net_profit": -49724,
            "stored_value_giveaway": 51680,
            "stored_value_charge": 200000,
        },
        "previous": {
            "revenue": 1390503,
            "food_cost": 578603,
            "labor_cost": 323805,
            "rent": 57328,
        },
        "monthly_revenue": 731048,
    }


@pytest.fixture
def sample_pos_df() -> pd.DataFrame:
    """POS DataFrame with product/channel/time/revenue columns."""
    return pd.DataFrame({
        "商品名称": [
            "招牌毛肚", "鲜鸭血", "虾滑", "招牌毛肚", "鲜鸭血",
            "肥牛", "虾滑", "冰粉", "招牌毛肚", "鲜鸭血",
        ],
        "订单来源": [
            "堂食", "堂食", "外卖", "外卖", "堂食",
            "堂食", "外卖", "堂食", "美团", "饿了么",
        ],
        "实收额": [50, 60, 80, 50, 60, 90, 80, 15, 48, 56],
        "开单时间": [
            "2026-02-01 12:00", "2026-02-01 19:00", "2026-02-01 20:00",
            "2026-02-02 13:00", "2026-02-02 14:00", "2026-02-03 19:00",
            "2026-02-03 20:00", "2026-02-04 15:00", "2026-02-04 19:30",
            "2026-02-05 12:30",
        ],
        "数量": [1] * 10,
        "门店名称": ["测试店"] * 10,
    })


@pytest.fixture
def sample_reviews() -> list[dict]:
    """A small handful of reviews spanning multiple dishes + sentiments."""
    base = [
        ("招牌毛肚很嫩, 鸭血一般", 4.5, "2026-01-15"),
        ("毛肚好吃, 推荐, 鸭血也不错", 5.0, "2026-01-20"),
        ("鸭血太腥, 毛肚还行", 3.0, "2026-02-01"),
        ("虾滑很鲜, 鸭血难吃", 3.5, "2026-02-05"),
        ("毛肚爽口, 虾滑鲜美", 5.0, "2026-02-10"),
        ("服务差, 菜品一般", 2.5, "2026-02-15"),
    ]
    return [
        {
            "id": i,
            "rating": rating,
            "content": content,
            "created_at": dt,
            "store_name": "测试店",
            "platform": "大众点评",
        }
        for i, (content, rating, dt) in enumerate(base, 1)
    ]


@pytest.fixture
def sample_members() -> list[dict]:
    """A small member list with enough diversity to compute quintiles."""
    return [
        {"member_id": f"M{i:03d}", "last_order_days_ago": i * 5, "order_count": 10 - i // 2, "total_amount": (10 - i) * 200}
        for i in range(1, 11)
    ]


# ─────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────


class TestRestaurantAnalyzerV2Integration:
    def test_minimal_analyze(self, sample_financial_data: dict) -> None:
        """With only financial_data → financial metrics + diagnostics + alerts."""
        v2 = RestaurantAnalyzerV2(factory_id="F1", sub_sector="火锅")
        report = v2.analyze(
            financial_data=sample_financial_data,
            store_name="测试店",
            period="2026-02",
        )
        sections = report["sections"]
        assert "financialMetrics" in sections
        assert "diagnostics" in sections
        assert "benchmarkAlerts" in sections
        assert "storePnlOnePager" in sections  # always emits when financial_data present
        assert "bomLayerStatus" in sections  # always emits

        # Financial metrics should contain computed ratios
        fm = sections["financialMetrics"]
        assert fm["revenue"] == 731048
        assert fm["foodCost"] == 335213
        assert fm["laborCost"] == 237660
        # cost_rigidity should be computed (revenue declined ~47%)
        assert fm["costRigidity"] is not None

        # Diagnostics should detect critical cost rigidity
        assert len(sections["diagnostics"]) >= 1

        # Summary should track sections
        assert "summary" in report
        assert len(report["summary"]["sectionsGenerated"]) >= 4

    def test_with_pos_only(self, sample_pos_df: pd.DataFrame) -> None:
        """With only POS df → menuNormalization + channelMargin + heatmap + long tail."""
        v2 = RestaurantAnalyzerV2(factory_id="F2", sub_sector="火锅")
        report = v2.analyze(
            pos_df=sample_pos_df,
            store_name="测试店",
            period="2026-02",
        )
        sections = report["sections"]
        assert "menuNormalization" in sections
        assert "channelMargin" in sections
        # Heatmap from datetime
        assert "diningHeatmap" in sections
        # Long tail from POS
        assert "longTailSku" in sections

        # Financial sections should NOT be present
        assert "financialMetrics" not in sections
        assert "diagnostics" not in sections

        # Menu normalization should have counts
        assert sections["menuNormalization"]["originalUniqueCount"] > 0

    def test_with_reviews(self, sample_reviews: list[dict]) -> None:
        """With reviews → reviewAnalysis section, regex fallback."""
        v2 = RestaurantAnalyzerV2(factory_id="F3", sub_sector="火锅")
        report = v2.analyze(
            reviews=sample_reviews,
            store_name="测试店",
            period="2026-02",
            use_llm_reviews=False,  # Force regex-only
        )
        sections = report["sections"]
        assert "reviewAnalysis" in sections
        review_section = sections["reviewAnalysis"]
        assert review_section["totalReviews"] == 6
        # usedLlm flag should be False
        assert review_section.get("usedLlm") is False
        # Should have extracted some dish tags (with min_mentions=2)
        assert isinstance(review_section["dishTags"], list)

    def test_with_members(self, sample_members: list[dict]) -> None:
        """With members → memberRfm section."""
        v2 = RestaurantAnalyzerV2(factory_id="F4", sub_sector="火锅")
        report = v2.analyze(
            members=sample_members,
            period="2026-02-28",
        )
        sections = report["sections"]
        assert "memberRfm" in sections
        rfm = sections["memberRfm"]
        assert rfm["totalMembers"] == 10
        assert rfm["analyzedMembers"] >= 1
        # Should have segment counts
        assert isinstance(rfm["segmentCounts"], dict)
        assert sum(rfm["segmentCounts"].values()) >= 1

    def test_full_analyze(
        self,
        sample_financial_data: dict,
        sample_pos_df: pd.DataFrame,
        sample_reviews: list[dict],
        sample_members: list[dict],
    ) -> None:
        """All inputs provided → expect at least 10 sections."""
        v2 = RestaurantAnalyzerV2(factory_id="F5", sub_sector="火锅")
        report = v2.analyze(
            pos_df=sample_pos_df,
            financial_data=sample_financial_data,
            reviews=sample_reviews,
            members=sample_members,
            store_name="全量测试店",
            period="2026-02",
            use_llm_reviews=False,
        )
        sections = report["sections"]
        expected_possible_sections = {
            "menuNormalization",
            "channelMargin",
            "financialMetrics",
            "diagnostics",
            "benchmarkAlerts",
            "storePnlOnePager",
            "diningHeatmap",
            "storedValueDependency",  # because giveaway is present
            "longTailSku",
            "reviewAnalysis",
            "memberRfm",
            "bomLayerStatus",
        }
        # All expected sections should appear
        missing = expected_possible_sections - set(sections.keys())
        assert len(missing) == 0, f"Missing sections: {missing}"
        # Should have >= 10
        assert len(sections) >= 10
        # Executive summary should have at least one item
        assert len(report["executiveSummary"]) >= 1
        # Summary stats should be present
        summary = report["summary"]
        assert summary["sectionsGenerated"]
        assert summary["totalDiagnoses"] >= 0

    def test_analyzer_graceful_degradation(self, sample_financial_data: dict) -> None:
        """Invalid POS data in one section should not break other sections."""
        # POS df without required columns → channel/heatmap/long tail should skip
        bad_pos = pd.DataFrame({"foo": [1, 2, 3], "bar": ["a", "b", "c"]})
        v2 = RestaurantAnalyzerV2(factory_id="F6", sub_sector="火锅")
        report = v2.analyze(
            pos_df=bad_pos,
            financial_data=sample_financial_data,
            store_name="降级测试店",
            period="2026-02",
        )
        sections = report["sections"]
        # Financial sections should still be produced
        assert "financialMetrics" in sections
        assert "diagnostics" in sections
        assert "benchmarkAlerts" in sections
        assert "storePnlOnePager" in sections
        # POS-dependent sections should NOT be present (missing cols)
        assert "channelMargin" not in sections
        assert "diningHeatmap" not in sections
        assert "longTailSku" not in sections
        # There should be some warnings for the missing columns
        assert len(report["warnings"]) >= 1

    def test_factory_id_required(self) -> None:
        """Empty factory_id should raise."""
        with pytest.raises(ValueError, match="factory_id"):
            RestaurantAnalyzerV2(factory_id="", sub_sector="火锅")

    def test_sub_sector_required(self) -> None:
        """Empty sub_sector should raise."""
        with pytest.raises(ValueError, match="sub_sector"):
            RestaurantAnalyzerV2(factory_id="F1", sub_sector="")


# === P3.5B F1 tests: MarginSpec integration ===

def test_f1_margin_spec_staff_meal_excluded_from_cogs():
    """When includeStaffMealInCogs=False, staff meal stays separate from food_cost."""
    from smartbi.services.finance.margin_spec import MarginSpec
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    spec = MarginSpec(include_staff_meal_in_cogs=False)
    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        margin_spec=spec,
    )
    report = analyzer.analyze(financial_data={
        "current": {
            "revenue": 731048,
            "food_cost": 307040,
            "staff_meal_cost": 8000,
            "labor_cost": 237660,
            "rent": 85000,
        },
    })
    fm = report["sections"]["financialMetrics"]
    # When excluded, food_cost stays at 307040 (not +8000)
    assert fm["foodCost"] == 307040


def test_f1_margin_spec_staff_meal_included_by_default():
    """Default includeStaffMealInCogs=True merges staff meal into food_cost."""
    from smartbi.services.finance.margin_spec import MarginSpec
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        margin_spec=MarginSpec(),  # defaults — include_staff_meal=True
    )
    report = analyzer.analyze(financial_data={
        "current": {
            "revenue": 731048,
            "food_cost": 307040,
            "staff_meal_cost": 8000,
            "labor_cost": 237660,
        },
    })
    fm = report["sections"]["financialMetrics"]
    # When included, food_cost = 307040 + 8000 = 315040
    assert fm["foodCost"] == 315040


def test_f1_no_margin_spec_uses_defaults_preserves_byte_identity():
    """Regression: omitted margin_spec must match pre-3.5B behavior."""
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(factory_id="F-TEST", sub_sector="火锅")
    report = analyzer.analyze(financial_data={
        "current": {"revenue": 731048, "food_cost": 307040, "labor_cost": 237660},
    })
    fm = report["sections"]["financialMetrics"]
    assert fm["revenue"] == 731048
    assert fm["foodCost"] == 307040
    assert fm["laborCost"] == 237660
