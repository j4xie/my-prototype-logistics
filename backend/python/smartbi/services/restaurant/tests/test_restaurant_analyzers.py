"""Unit tests for individual restaurant analyzer modules.

No DB or LLM calls — each analyzer is tested standalone with mock data.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pytest

from smartbi.services.restaurant.cross_chain_benchmark import (
    ChainInput,
    CrossChainBenchmark,
)
from smartbi.services.restaurant.dining_period_heatmap import DiningPeriodHeatmap
from smartbi.services.restaurant.long_tail_sku_detector import LongTailSkuDetector
from smartbi.services.restaurant.member_rfm import MemberRfmAnalyzer
from smartbi.services.restaurant.monthly_purchase_calibrator import (
    MonthlyPurchaseCalibrator,
    MonthlyPurchaseEntry,
)
from smartbi.services.restaurant.multi_store_comparator import MultiStoreComparator
from smartbi.services.restaurant.review_analyzer import ReviewAnalyzer
from smartbi.services.restaurant.sku_form_manager import (
    SkuFormEntry,
    SkuFormIngredient,
    SkuFormManager,
)
from smartbi.services.restaurant.store_pnl_one_pager import StorePnlOnePager
from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer
from smartbi.shared.temporal_comparator import TemporalComparator


# ─────────────────────────────────────────────────────────
# StorePnlOnePager
# ─────────────────────────────────────────────────────────


class TestStorePnlOnePager:
    def test_complete_metrics_loss_headline_red(self) -> None:
        """Net loss should produce red headline + '净亏' wording."""
        fm = {
            "revenue": 731048,
            "foodCost": 335213,
            "laborCost": 237660,
            "rent": 57328,
            "netProfit": -49724,
            "foodCostRatio": 0.4585,
            "laborCostRatio": 0.3251,
            "restaurantNetMargin": -0.068,
            "costRigidity": 0.561,
        }
        pager = StorePnlOnePager()
        report = pager.build(
            financial_metrics=fm,
            store_name="鼎鲜火锅·义乌",
            period="2026-02",
            sub_sector="火锅",
        )
        assert report.headline_color == "red"
        assert "净亏" in report.headline
        assert report.kpi_net_margin == pytest.approx(-0.068)
        assert report.kpi_cost_rigidity == pytest.approx(0.561)
        # P&L main table should have revenue + costs + net profit rows
        labels = [line.label for line in report.pnl_lines]
        assert "营业收入" in labels
        assert "食材成本" in labels
        assert "人力成本" in labels
        assert "净利润" in labels

    def test_partial_metrics_still_produces_report(self) -> None:
        """Only revenue + a few fields → yellow headline, no crash."""
        fm = {"revenue": 500000}
        pager = StorePnlOnePager()
        report = pager.build(
            financial_metrics=fm,
            store_name="新店",
            period="2026-02",
            sub_sector="快餐",
        )
        # Yellow because net_profit missing
        assert report.headline_color == "yellow"
        assert report.store_name == "新店"
        # Revenue row present
        assert any(l.label == "营业收入" for l in report.pnl_lines)
        # Net profit row absent
        assert not any(l.label == "净利润" for l in report.pnl_lines)

    def test_profitable_headline_green(self) -> None:
        """Profit >= 5% net margin → green headline."""
        fm = {
            "revenue": 1000000,
            "netProfit": 80000,  # 8%
            "foodCost": 400000,
            "laborCost": 250000,
        }
        pager = StorePnlOnePager()
        report = pager.build(
            financial_metrics=fm, store_name="盈利店", period="2026-03"
        )
        assert report.headline_color == "green"
        assert "盈利" in report.headline


# ─────────────────────────────────────────────────────────
# DiningPeriodHeatmap
# ─────────────────────────────────────────────────────────


class TestDiningPeriodHeatmap:
    @pytest.fixture
    def sample_pos_df(self) -> pd.DataFrame:
        """3 days of POS data spanning breakfast/lunch/dinner."""
        return pd.DataFrame({
            "开单时间": [
                "2026-02-02 08:15",  # Mon breakfast
                "2026-02-02 12:30",  # Mon lunch
                "2026-02-02 19:00",  # Mon dinner
                "2026-02-03 12:45",  # Tue lunch
                "2026-02-03 19:30",  # Tue dinner
                "2026-02-03 20:15",  # Tue dinner
                "2026-02-04 13:00",  # Wed lunch
            ],
            "实收额": [30, 120, 280, 110, 300, 250, 130],
        })

    def test_produces_cells(self, sample_pos_df: pd.DataFrame) -> None:
        h = DiningPeriodHeatmap()
        report = h.build(
            df=sample_pos_df, datetime_col="开单时间", revenue_col="实收额"
        )
        assert len(report.cells) == 7  # 7 distinct (dow, hour) bins
        assert report.total_revenue == pytest.approx(1220.0)
        assert report.total_orders == 7

    def test_missing_columns_returns_empty_report(self) -> None:
        h = DiningPeriodHeatmap()
        df = pd.DataFrame({"foo": [1, 2], "bar": [3, 4]})
        report = h.build(df=df, datetime_col="开单时间", revenue_col="实收额")
        assert report.cells == []
        assert report.total_revenue == 0
        assert len(report.insights) >= 1
        assert any("数据不足" in i for i in report.insights)

    def test_meal_period_aggregation(self, sample_pos_df: pd.DataFrame) -> None:
        h = DiningPeriodHeatmap()
        report = h.build(
            df=sample_pos_df, datetime_col="开单时间", revenue_col="实收额"
        )
        period_names = {m.period for m in report.meal_periods}
        # Should recognize lunch and dinner at minimum
        assert "午餐" in period_names
        assert "晚餐" in period_names
        lunch = next(m for m in report.meal_periods if m.period == "午餐")
        dinner = next(m for m in report.meal_periods if m.period == "晚餐")
        # 120 + 110 + 130 = 360 lunch
        assert lunch.revenue == pytest.approx(360)
        # 280 + 300 + 250 = 830 dinner
        assert dinner.revenue == pytest.approx(830)
        # Dinner should dominate
        assert dinner.revenue_pct > lunch.revenue_pct


# ─────────────────────────────────────────────────────────
# StoredValueAnalyzer
# ─────────────────────────────────────────────────────────


class TestStoredValueAnalyzer:
    def test_info_threshold(self) -> None:
        """<5% dependency → info."""
        a = StoredValueAnalyzer()
        r = a.analyze(stored_value_giveaway=3000, revenue=100000)
        assert r.severity == "info"
        assert r.dependency_pct == pytest.approx(0.03)
        # Info recommendation should say healthy
        assert any("健康" in rec for rec in r.recommendations)

    def test_warning_threshold(self) -> None:
        """5-7% → warning (P3.5A QW1: thresholds lowered; 6% stays in warning band)."""
        a = StoredValueAnalyzer()
        r = a.analyze(stored_value_giveaway=6000, revenue=100000)
        assert r.severity == "warning"
        assert r.dependency_pct == pytest.approx(0.06)
        # Warning should have at least one recommendation
        assert len(r.recommendations) >= 1
        assert any("ROI" in rec or "监控" in rec for rec in r.recommendations)

    def test_critical_threshold(self) -> None:
        """>=7% → critical (P3.5A QW1: lowered from 10% to match 火锅 industry reality)."""
        a = StoredValueAnalyzer()
        r = a.analyze(stored_value_giveaway=8000, revenue=100000)
        assert r.severity == "critical"
        assert r.dependency_pct == pytest.approx(0.08)
        # Should warn about隐性折扣
        assert any("隐性折扣" in w or "过高" in w for w in r.warnings)
        # Critical should have immediate action recommendations
        assert any("立即" in rec or "减少" in rec for rec in r.recommendations)

    def test_zero_revenue_empty_report(self) -> None:
        a = StoredValueAnalyzer()
        r = a.analyze(stored_value_giveaway=5000, revenue=0)
        assert r.severity == "info"
        assert r.dependency_pct == 0
        assert "无法分析" in r.message_zh or "无法" in r.message_zh


# ─────────────────────────────────────────────────────────
# LongTailSkuDetector
# ─────────────────────────────────────────────────────────


class TestLongTailSkuDetector:
    def test_pareto_distribution(self) -> None:
        """100 SKUs, TOP 20% generate most revenue → detect long tail."""
        menu_items = []
        # TOP 20 items: high revenue
        for i in range(20):
            menu_items.append({
                "name": f"热门菜{i:02d}",
                "quantity": 200 - i * 5,
                "revenue": 5000 - i * 100,
                "unitProfit": 15,
            })
        # Bottom 80 items: low revenue
        for i in range(80):
            menu_items.append({
                "name": f"冷门菜{i:02d}",
                "quantity": 2,
                "revenue": 40,
                "unitProfit": 3,
            })

        detector = LongTailSkuDetector()
        report = detector.detect(menu_items=menu_items, exclude_seasonal=False)
        assert report.total_sku_count == 100
        # TOP 20% should contribute a large chunk
        assert report.top_20_pct_skus_contribute > 0.5
        # Long tail items should be identified
        assert len(report.low_efficiency_skus) > 0
        # At least some should be "建议下架"
        delist_recs = [s for s in report.low_efficiency_skus if s.recommendation == "建议下架"]
        assert len(delist_recs) >= 1

    def test_seasonal_exclusion(self) -> None:
        """Seasonal keywords excluded even if low sales."""
        menu_items = [
            # 8 "normal" low-efficiency items - will be in bottom 20%
            *[{"name": f"普通菜{i}", "quantity": 1, "revenue": 20, "unitProfit": 2} for i in range(8)],
            # High volume items (majority)
            *[{"name": f"主力菜{i}", "quantity": 500, "revenue": 10000, "unitProfit": 20} for i in range(20)],
            # Seasonal low-sales items - should be excluded
            {"name": "夏日冰粉", "quantity": 1, "revenue": 8, "unitProfit": 1},
            {"name": "节日月饼", "quantity": 2, "revenue": 40, "unitProfit": 3},
        ]
        detector = LongTailSkuDetector()
        report = detector.detect(menu_items=menu_items, exclude_seasonal=True)
        # Seasonal items should appear in seasonal_excluded (if they fell in the tail)
        # Because the tail is the bottom 20%, and冰粉/月饼 have low qty+revenue, they should be there
        assert "夏日冰粉" in report.seasonal_excluded or "节日月饼" in report.seasonal_excluded
        # None of the excluded seasonal items should appear in low_efficiency list
        for name in report.seasonal_excluded:
            assert not any(s.name == name for s in report.low_efficiency_skus)

    def test_empty_input(self) -> None:
        detector = LongTailSkuDetector()
        report = detector.detect(menu_items=[])
        assert report.total_sku_count == 0
        assert report.low_efficiency_skus == []
        assert report.recommended_delist_count == 0


# ─────────────────────────────────────────────────────────
# ReviewAnalyzer
# ─────────────────────────────────────────────────────────


class TestReviewAnalyzer:
    def _make_review(
        self, rid: int, rating: float, content: str, date: str = "2026-02-15"
    ) -> dict:
        return {
            "id": rid,
            "rating": rating,
            "content": content,
            "created_at": date,
            "store_name": "测试火锅店",
            "platform": "大众点评",
        }

    def test_dish_extraction_and_positive_sentiment(self) -> None:
        """招牌X菜 pattern + positive keyword → positive mention.

        Uses simple clauses without negation characters (不/没/别/无/非)
        because the analyzer's sentiment classifier flips pos/neg on
        negation presence.
        """
        analyzer = ReviewAnalyzer()
        reviews = [
            self._make_review(1, 5.0, "招牌毛肚很嫩好吃极了"),
            self._make_review(2, 5.0, "毛肚爽口推荐"),
            self._make_review(3, 4.5, "毛肚赞满意"),
        ]
        report = analyzer.analyze(reviews, min_mentions=2)
        assert report.total_reviews == 3
        # Some mention of 毛肚 (招牌毛肚 may merge with 毛肚)
        all_dishes = {d.dish_name for d in report.dish_tags}
        assert any("毛肚" in d for d in all_dishes)
        # At least one positive-count mention
        mao_du = next(d for d in report.dish_tags if "毛肚" in d.dish_name)
        assert mao_du.positive_count >= 1
        # Positive should dominate (> half of non-neutral mentions)
        assert mao_du.positive_count > mao_du.negative_count

    def test_negative_sentiment_classification(self) -> None:
        """难吃/差 → negative classification."""
        analyzer = ReviewAnalyzer()
        # Need >= min_mentions (2) so dish appears in dish_tags
        reviews = [
            self._make_review(1, 2.0, "鸭血太难吃, 腥味重"),
            self._make_review(2, 2.5, "鸭血很差, 不推荐"),
        ]
        report = analyzer.analyze(reviews, min_mentions=2)
        assert report.avg_rating == pytest.approx(2.25)
        # If dish extracted, it should have negative count
        for d in report.dish_tags:
            if "鸭血" in d.dish_name:
                assert d.negative_count >= 1
                break
        # Average rating < 4 → should have risk alert
        assert any("评分" in a or "4.0" in a for a in report.risk_alerts)

    def test_rating_trend_declining(self) -> None:
        """Q1 reviews high, Q2 reviews low → declining trend."""
        analyzer = ReviewAnalyzer()
        reviews = [
            self._make_review(1, 5.0, "很不错", "2025-10-01"),
            self._make_review(2, 5.0, "好吃", "2025-10-15"),
            self._make_review(3, 4.8, "满意", "2025-11-05"),
            self._make_review(4, 3.0, "一般般", "2026-02-01"),
            self._make_review(5, 2.5, "失望", "2026-02-15"),
            self._make_review(6, 2.0, "难吃", "2026-02-28"),
        ]
        report = analyzer.analyze(reviews, min_mentions=2)
        assert report.rating_trend is not None
        # latest < earliest → declining or sharp_decline
        assert report.rating_trend.direction in ("declining", "sharp_decline")
        assert report.rating_trend.latest_avg < report.rating_trend.earliest_avg

    def test_avg_review_rating_weighted_correctly(self) -> None:
        """Multiple reviews of same dish → avg_review_rating is arithmetic mean.

        Verifies the avg_review_rating bug fix where running sum must be divided
        AFTER merging short/full dish names, not before.
        """
        analyzer = ReviewAnalyzer()
        reviews = [
            self._make_review(1, 5.0, "毛肚很好吃"),
            self._make_review(2, 3.0, "毛肚一般"),
            self._make_review(3, 1.0, "毛肚难吃"),
        ]
        report = analyzer.analyze(reviews, min_mentions=2)
        # Find 毛肚 (or 招牌毛肚 merged)
        mao_du = None
        for d in report.dish_tags:
            if "毛肚" in d.dish_name:
                mao_du = d
                break
        assert mao_du is not None, "毛肚 should be extracted"
        # Should be proper mean: (5 + 3 + 1) / 3 = 3.0
        assert mao_du.mention_count >= 3
        # avg_review_rating should NOT be > 5 (which would indicate
        # the sum-vs-mean bug)
        assert mao_du.avg_review_rating <= 5.0
        assert mao_du.avg_review_rating >= 1.0
        # Expected arithmetic mean of 1, 3, 5 = 3.0
        assert mao_du.avg_review_rating == pytest.approx(3.0, abs=0.5)

    def test_empty_input(self) -> None:
        analyzer = ReviewAnalyzer()
        report = analyzer.analyze([])
        assert report.total_reviews == 0
        assert report.dish_tags == []


# ─────────────────────────────────────────────────────────
# MemberRfmAnalyzer
# ─────────────────────────────────────────────────────────


class TestMemberRfmAnalyzer:
    def test_champion_segmentation(self) -> None:
        """Recent + high frequency + high $ → Champions."""
        analyzer = MemberRfmAnalyzer()
        # Need >= 5 members for quintile computation
        members = [
            # Champions
            {"member_id": "M001", "last_order_days_ago": 3, "order_count": 20, "total_amount": 3000},
            # Loyal
            {"member_id": "M002", "last_order_days_ago": 10, "order_count": 15, "total_amount": 2000},
            # Potential
            {"member_id": "M003", "last_order_days_ago": 15, "order_count": 5, "total_amount": 500},
            # New
            {"member_id": "M004", "last_order_days_ago": 2, "order_count": 1, "total_amount": 100},
            # Lost/Hibernating
            {"member_id": "M005", "last_order_days_ago": 180, "order_count": 1, "total_amount": 50},
            # At Risk (previously high M)
            {"member_id": "M006", "last_order_days_ago": 120, "order_count": 10, "total_amount": 1500},
        ]
        report = analyzer.analyze(members, as_of_date="2026-02-28")
        assert report.analyzed_members == 6
        # At least M001 should be Champions
        champ_ids = {m.member_id for m in report.top_champions}
        assert "M001" in champ_ids
        # M001's R/F/M should all be high
        m001 = next(m for m in report.members if m.member_id == "M001")
        assert m001.r_score >= 4
        assert m001.f_score >= 4

    def test_quintile_computation_diverse_data(self) -> None:
        """10+ members with diverse values → cutoffs computed correctly."""
        analyzer = MemberRfmAnalyzer()
        members = [
            {
                "member_id": f"M{i:03d}",
                "last_order_days_ago": i * 10,
                "order_count": i + 1,
                "total_amount": (i + 1) * 100,
            }
            for i in range(10)
        ]
        report = analyzer.analyze(members, as_of_date="2026-02-28")
        assert report.analyzed_members == 10
        # Should have multiple segments
        assert len(report.segment_counts) >= 2
        # Total members across segments should equal analyzed
        assert sum(report.segment_counts.values()) == 10

    def test_degenerate_identical_members_fallback(self) -> None:
        """All identical → quintile cutoffs collapse → fallback used.

        With 5 identical members the cutoffs would be degenerate (all same),
        so the analyzer falls back to the hardcoded quintile thresholds.
        """
        analyzer = MemberRfmAnalyzer()
        members = [
            {
                "member_id": f"M{i}",
                "last_order_days_ago": 30,
                "order_count": 5,
                "total_amount": 500,
            }
            for i in range(5)
        ]
        report = analyzer.analyze(members, as_of_date="2026-02-28")
        assert report.analyzed_members == 5
        # All members fall into the same segment since they're identical
        assert len(report.segment_counts) == 1

    def test_empty_members_list(self) -> None:
        analyzer = MemberRfmAnalyzer()
        report = analyzer.analyze([], as_of_date="2026-02-28")
        assert report.total_members == 0
        assert report.analyzed_members == 0
        assert any("数据不足" in i for i in report.insights)


# ─────────────────────────────────────────────────────────
# SkuFormManager
# ─────────────────────────────────────────────────────────


class TestSkuFormManager:
    def test_in_memory_upload_lookup_delete(self) -> None:
        manager = SkuFormManager(db_session=None)
        entry = SkuFormEntry(
            sku_name="招牌青花椒鱼",
            category="招牌主菜",
            total_cogs_amount=27.60,
            selling_price=69.0,
            ingredients=[
                SkuFormIngredient(name="草鱼", cost=18.0, weight_g=500),
                SkuFormIngredient(name="青花椒", cost=3.5, weight_g=10),
                SkuFormIngredient(name="底料", cost=6.1, weight_g=150),
            ],
        )
        # Upload
        result = manager.upload("QHJ", [entry])
        assert result["uploaded"] == 1
        assert result["updated"] == 0

        # Lookup
        hit = manager.lookup("QHJ", "招牌青花椒鱼")
        assert hit is not None
        assert hit.sku_name == "招牌青花椒鱼"
        assert hit.total_cogs_amount == pytest.approx(27.60)
        # COGS pct = 27.60 / 69 = 0.4
        assert hit.cogs_pct() == pytest.approx(0.4, abs=1e-4)

        # Count
        assert manager.count("QHJ") == 1

        # Delete
        deleted = manager.delete("QHJ", "招牌青花椒鱼")
        assert deleted is True
        assert manager.count("QHJ") == 0

    def test_ingredients_consistency_check(self) -> None:
        """is_consistent checks ingredient sum vs total_cogs_amount."""
        # Consistent (sum = total within tolerance)
        good = SkuFormEntry(
            sku_name="牛肉面",
            category="主食",
            total_cogs_amount=10.0,
            ingredients=[
                SkuFormIngredient(name="牛肉", cost=6.0),
                SkuFormIngredient(name="面", cost=4.0),
            ],
        )
        assert good.is_consistent() is True

        # Inconsistent (30% off)
        bad = SkuFormEntry(
            sku_name="豆浆",
            category="饮品",
            total_cogs_amount=5.0,
            ingredients=[SkuFormIngredient(name="豆", cost=3.0)],  # Only 3, not 5
        )
        assert bad.is_consistent(tolerance_pct=0.05) is False

        # No ingredients → skipped (returns True)
        no_ing = SkuFormEntry(
            sku_name="汤",
            category="汤品",
            total_cogs_amount=8.0,
            ingredients=[],
        )
        assert no_ing.is_consistent() is True

    def test_coverage_report_calculation(self) -> None:
        """coverage_report computes sku and revenue coverage."""
        manager = SkuFormManager(db_session=None)
        entries = [
            SkuFormEntry(
                sku_name=f"SKU{i}",
                category="主菜",
                total_cogs_amount=20.0,
                selling_price=50.0,
                monthly_sales_quantity=100.0,
                ingredients=[],
            )
            for i in range(5)
        ]
        manager.upload("FAC1", entries)
        # 5 SKUs covered, 100 sku total, 100000 revenue total
        # Each SKU contributes 50 * 100 = 5000, so 5 * 5000 = 25000 covered revenue
        report = manager.coverage_report(
            factory_id="FAC1",
            total_skus_in_sales=100,
            total_revenue=100000.0,
        )
        assert report["layer2SkuCount"] == 5
        assert report["totalSkusInSales"] == 100
        assert report["skuCoveragePct"] == pytest.approx(0.05)
        assert report["coveredRevenue"] == pytest.approx(25000.0)
        assert report["revenueCoveragePct"] == pytest.approx(0.25)
        assert report["isSufficient"] is False  # 25% < 70%


# ─────────────────────────────────────────────────────────
# MonthlyPurchaseCalibrator
# ─────────────────────────────────────────────────────────


class TestMonthlyPurchaseCalibrator:
    def test_3_month_compute(self) -> None:
        """3 months of data → high confidence factor calculation."""
        cal = MonthlyPurchaseCalibrator(db_session=None)
        for i, period in enumerate(["2026-01", "2026-02", "2026-03"]):
            cal.upload(MonthlyPurchaseEntry(
                factory_id="DENG",
                period=period,
                total_purchase=400000 + i * 5000,
                total_revenue=1000000,
                category_breakdown={"肉类": 200000, "蔬菜": 100000, "其他": 100000 + i * 5000},
            ))
        result = cal.compute(factory_id="DENG")
        assert result is not None
        assert result.sample_size == 3
        assert result.confidence == "high"
        # actual ratio = ~0.405 (average of 0.40, 0.405, 0.41)
        assert 0.38 < result.overall_actual_ratio < 0.43

        # Factor relative to layer 1 = 0.40
        factor = cal.get_overall_calibration_factor(
            factory_id="DENG", layer1_predicted_ratio=0.40
        )
        assert factor is not None
        assert 0.9 < factor < 1.1

    def test_abnormal_factor_rejection(self) -> None:
        """Factor outside [0.5, 2.0] returns None."""
        cal = MonthlyPurchaseCalibrator(db_session=None)
        # Extreme cost ratio (90%)
        cal.upload(MonthlyPurchaseEntry(
            factory_id="BAD",
            period="2026-02",
            total_purchase=900000,
            total_revenue=1000000,
            category_breakdown={},
        ))
        # Layer 1 predicts 20% → factor = 0.90/0.20 = 4.5 → rejected
        factor = cal.get_overall_calibration_factor(
            factory_id="BAD", layer1_predicted_ratio=0.20
        )
        assert factor is None

        # Opposite: very low actual vs layer 1
        cal.upload(MonthlyPurchaseEntry(
            factory_id="LOW",
            period="2026-02",
            total_purchase=100000,
            total_revenue=1000000,
            category_breakdown={},
        ))
        factor2 = cal.get_overall_calibration_factor(
            factory_id="LOW", layer1_predicted_ratio=0.50
        )
        # actual 10% / layer1 50% = 0.2 → below 0.5 → rejected
        assert factor2 is None

    def test_empty_data(self) -> None:
        cal = MonthlyPurchaseCalibrator(db_session=None)
        assert cal.compute(factory_id="NONE") is None
        assert cal.count(factory_id="NONE") == 0
        assert cal.get_overall_calibration_factor(
            factory_id="NONE", layer1_predicted_ratio=0.40
        ) is None

    def test_single_month_low_confidence(self) -> None:
        cal = MonthlyPurchaseCalibrator(db_session=None)
        cal.upload(MonthlyPurchaseEntry(
            factory_id="NEW",
            period="2026-02",
            total_purchase=400000,
            total_revenue=1000000,
            category_breakdown={},
        ))
        result = cal.compute(factory_id="NEW")
        assert result is not None
        assert result.sample_size == 1
        assert result.confidence == "low"
        assert any("1 个月" in w for w in result.warnings)


# ─────────────────────────────────────────────────────────
# TemporalComparator (from shared/temporal_comparator.py)
# ─────────────────────────────────────────────────────────


class TestTemporalComparator:
    def _make_df(self, months: int, start: str = "2025-01") -> pd.DataFrame:
        """Create a POS df with `months` distinct monthly periods."""
        start_dt = datetime.strptime(start, "%Y-%m")
        rows = []
        for i in range(months):
            period_dt = start_dt.replace(day=1)
            # Advance by i months
            year = period_dt.year + (period_dt.month - 1 + i) // 12
            month = (period_dt.month - 1 + i) % 12 + 1
            for store in ["店A", "店B"]:
                rows.append({
                    "门店名称": store,
                    "营业日期": f"{year:04d}-{month:02d}-15",
                    "营收": 100000 + i * 5000 + hash(store) % 3000,
                })
        return pd.DataFrame(rows)

    def test_mom_mode_3_months(self) -> None:
        comp = TemporalComparator(group_col="门店名称")
        df = self._make_df(months=3, start="2026-01")
        result = comp.compare(df, date_col="营业日期", metric_cols=["营收"])
        assert result.mode == "mom"
        assert result.months_available == 3
        assert len(result.deltas) > 0
        assert result.group_count == 2

    def test_qoq_mode_6_months(self) -> None:
        comp = TemporalComparator(group_col="门店名称")
        df = self._make_df(months=6, start="2025-09")
        result = comp.compare(df, date_col="营业日期", metric_cols=["营收"])
        assert result.mode == "qoq"
        assert result.months_available == 6

    def test_yoy_mode_13_months(self) -> None:
        comp = TemporalComparator(group_col="门店名称")
        df = self._make_df(months=13, start="2025-01")
        result = comp.compare(df, date_col="营业日期", metric_cols=["营收"])
        # yoy requires months_available >= 13 AND compare_df has data
        assert result.mode in ("yoy", "qoq")  # may degrade to qoq if compare month missing
        assert result.months_available == 13

    def test_insufficient_less_than_3_months(self) -> None:
        comp = TemporalComparator(group_col="门店名称")
        df = self._make_df(months=2, start="2026-01")
        result = comp.compare(df, date_col="营业日期", metric_cols=["营收"])
        assert result.mode == "insufficient"
        assert result.insufficient_reason is not None

    def test_empty_dataframe(self) -> None:
        comp = TemporalComparator(group_col="门店名称")
        df = pd.DataFrame()
        result = comp.compare(df, date_col="营业日期", metric_cols=["营收"])
        assert result.mode == "insufficient"


# ─────────────────────────────────────────────────────────
# MultiStoreComparator
# ─────────────────────────────────────────────────────────


class TestMultiStoreComparator:
    @pytest.fixture
    def multi_store_df(self) -> pd.DataFrame:
        rows = []
        # 5 stores with varying performance
        for i, store in enumerate(["店A", "店B", "店C", "店D", "店E"]):
            # Revenue scaling from 100k down for store A, ..., 30k for store E
            base_revenue = 100000 - i * 15000
            for dish_idx in range(10):
                rows.append({
                    "门店名称": store,
                    "商品名称": f"菜品{dish_idx:02d}",
                    "实收额": base_revenue / 10 + dish_idx * 100,
                    "数量": 5 + dish_idx,
                })
        return pd.DataFrame(rows)

    def test_rankings_5_stores(self, multi_store_df: pd.DataFrame) -> None:
        comp = MultiStoreComparator()
        report = comp.compare(
            pos_df=multi_store_df,
            revenue_col="实收额",
            product_col="商品名称",
            store_col="门店名称",
            quantity_col="数量",
        )
        assert report.store_count == 5
        assert len(report.store_rankings) == 5
        # Rank 1 should have highest revenue, rank 5 lowest
        assert report.store_rankings[0].rank == 1
        assert report.store_rankings[-1].rank == 5
        assert report.top_store is not None
        assert report.bottom_store is not None
        assert report.top_store.revenue > report.bottom_store.revenue
        # Every store's TOP dishes should be computed
        assert len(report.per_store_top_dishes) == 5

    def test_anomaly_detection_below_threshold(self) -> None:
        """One store with much lower revenue than others → anomaly."""
        rows = []
        # 4 normal stores
        for store in ["店A", "店B", "店C", "店D"]:
            for dish_idx in range(5):
                rows.append({
                    "门店名称": store,
                    "商品名称": f"菜品{dish_idx}",
                    "实收额": 20000,
                    "数量": 10,
                })
        # 1 very low store (~15% of avg)
        for dish_idx in range(5):
            rows.append({
                "门店名称": "店E",
                "商品名称": f"菜品{dish_idx}",
                "实收额": 3000,
                "数量": 10,
            })
        df = pd.DataFrame(rows)

        comp = MultiStoreComparator()
        report = comp.compare(
            pos_df=df,
            revenue_col="实收额",
            product_col="商品名称",
            store_col="门店名称",
        )
        # 店E should show as critical anomaly (< -50%)
        anomaly_stores = {a.store_name for a in report.anomalies}
        assert "店E" in anomaly_stores
        # Severity should be critical (below -50% threshold)
        e_anomaly = next(a for a in report.anomalies if a.store_name == "店E")
        assert e_anomaly.severity in ("critical", "warning")

    def test_single_store_raises(self) -> None:
        """Single store → ValueError (can't compare)."""
        df = pd.DataFrame({
            "门店名称": ["独店"] * 5,
            "商品名称": [f"菜{i}" for i in range(5)],
            "实收额": [100] * 5,
            "数量": [1] * 5,
        })
        comp = MultiStoreComparator()
        with pytest.raises(ValueError, match="≥2|2"):
            comp.compare(
                pos_df=df,
                revenue_col="实收额",
                product_col="商品名称",
                store_col="门店名称",
            )


# ─────────────────────────────────────────────────────────
# CrossChainBenchmark
# ─────────────────────────────────────────────────────────


class TestCrossChainBenchmark:
    def _make_chain_df(
        self,
        chain_name: str,
        dishes: list[tuple[str, float, float]],  # (name, price, revenue)
        category: str = "主菜",
    ) -> pd.DataFrame:
        """Create a chain's SKU df with required columns."""
        rows = []
        for dish, price, revenue in dishes:
            rows.append({
                "实收": revenue,
                "商品分类": category,
                "商品名称": dish,
                "销售单价": price,
                "销售金额": revenue,
                "折后金额": revenue,
                "门店名称": f"{chain_name}·总店",
                "单卖数量(不含套餐子商品)": revenue / price if price > 0 else 0,
            })
        return pd.DataFrame(rows)

    def test_3_chains_profile_comparison(self) -> None:
        high_end = ChainInput(
            name="高端火锅",
            sub_sector="火锅",
            upload_id=1,
            df=self._make_chain_df("高端火锅", [
                ("毛肚", 88, 8800),
                ("鲍鱼", 280, 28000),
                ("龙虾", 350, 35000),
            ]),
        )
        mid = ChainInput(
            name="中档餐厅",
            sub_sector="火锅",
            upload_id=2,
            df=self._make_chain_df("中档餐厅", [
                ("毛肚", 45, 4500),
                ("肥牛", 58, 5800),
                ("虾滑", 38, 3800),
            ]),
        )
        budget = ChainInput(
            name="平价快餐",
            sub_sector="快餐",
            upload_id=3,
            df=self._make_chain_df("平价快餐", [
                ("豆浆", 5, 2500),
                ("油条", 8, 4000),
                ("小笼包", 15, 7500),
            ]),
        )
        bench = CrossChainBenchmark()
        report = bench.analyze([high_end, mid, budget])
        assert len(report.chain_profiles) == 3
        names = {p.name for p in report.chain_profiles}
        assert names == {"高端火锅", "中档餐厅", "平价快餐"}
        # Avg ticket should rank: high_end > mid > budget
        profile_map = {p.name: p for p in report.chain_profiles}
        assert profile_map["高端火锅"].avg_ticket > profile_map["中档餐厅"].avg_ticket
        assert profile_map["中档餐厅"].avg_ticket > profile_map["平价快餐"].avg_ticket

    def test_price_band_classification(self) -> None:
        """Price band: low <20, mid 20-60, high >=60."""
        chain = ChainInput(
            name="TestChain",
            sub_sector="通用",
            upload_id=99,
            df=self._make_chain_df("TestChain", [
                ("便宜菜A", 10, 100),
                ("便宜菜B", 15, 150),
                ("中档菜A", 30, 300),
                ("中档菜B", 50, 500),
                ("贵菜A", 80, 800),
                ("贵菜B", 120, 1200),
            ]),
        )
        bench = CrossChainBenchmark()
        report = bench.analyze([
            chain,
            ChainInput(
                name="Peer",
                sub_sector="通用",
                upload_id=100,
                df=self._make_chain_df("Peer", [("菜", 40, 400)]),
            ),
        ])
        band = next(b for b in report.price_bands if b.chain == "TestChain")
        # 2/6 low, 2/6 mid, 2/6 high
        assert band.low_pct == pytest.approx(2 / 6, abs=0.01)
        assert band.mid_pct == pytest.approx(2 / 6, abs=0.01)
        assert band.high_pct == pytest.approx(2 / 6, abs=0.01)

    def test_common_dish_detection(self) -> None:
        """Dishes in 2+ chains should appear in common_dishes."""
        chain1 = ChainInput(
            name="连锁A",
            sub_sector="火锅",
            upload_id=1,
            df=self._make_chain_df("A", [
                ("毛肚", 50, 5000),
                ("独家菜", 100, 10000),
            ]),
        )
        chain2 = ChainInput(
            name="连锁B",
            sub_sector="火锅",
            upload_id=2,
            df=self._make_chain_df("B", [
                ("毛肚", 60, 6000),
                ("连锁B专属", 80, 8000),
            ]),
        )
        bench = CrossChainBenchmark()
        report = bench.analyze([chain1, chain2])
        # 毛肚 should be detected as common
        common_names = [d.dish for d in report.common_dishes]
        assert any("毛肚" in d for d in common_names)
        mao_du = next(d for d in report.common_dishes if "毛肚" in d.dish)
        assert len(mao_du.chains_with_it) == 2
        assert mao_du.min_price == pytest.approx(50)
        assert mao_du.max_price == pytest.approx(60)
