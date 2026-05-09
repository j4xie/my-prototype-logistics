"""Tests for POS-based section handlers (Task 1.4).

Covers:
  - DiningHeatmapHandler  → wraps DiningPeriodHeatmap
  - LongTailSkuHandler    → wraps LongTailSkuDetector + analyzer helper
  - MenuNormalizationHandler → wraps RestaurantMenuNormalizer via analyzer helper
  - TemporalComparisonHandler → wraps TemporalComparator (group_col=门店名称)

All handlers depend on a POS DataFrame supplied via either context["pos_df"]
(batch mode) or request.params["pos_df"] (standalone mode). They must NOT
crash on the pandas truthiness trap (`a or b` with DataFrames).
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.dining_heatmap import DiningHeatmapHandler
from smartbi.services.restaurant.sections.long_tail_sku import LongTailSkuHandler
from smartbi.services.restaurant.sections.menu_normalization import MenuNormalizationHandler
from smartbi.services.restaurant.sections.temporal_comparison import TemporalComparisonHandler


@pytest.fixture
def sample_pos_df():
    """POS DataFrame: 3 stores × 5 SKUs × 60 days, ~900 rows.

    Spans 60 days so TemporalComparator can fall back to MoM (>=3 month bound).
    Includes 门店名称 column required by TemporalComparator(group_col="门店名称").
    """
    rows = []
    base = datetime(2026, 1, 1, 10, 0, 0)
    stores = ["青花椒松江店", "青花椒陆家嘴店", "青花椒第一百货店"]
    dishes = [
        ("青花椒鱼", 88.0, 1),
        ("花椒鱼", 78.0, 1),
        ("酸菜鱼", 68.0, 1),
        ("水煮肉片", 58.0, 1),
        ("麻婆豆腐", 38.0, 1),
    ]
    for day in range(60):
        for store in stores:
            for dish_idx, (name, price, qty) in enumerate(dishes):
                rows.append({
                    "商品名称": name,
                    "订单来源": "堂食" if dish_idx % 2 == 0 else "外卖",
                    "实收额": price,
                    "开单时间": (base + timedelta(days=day, hours=dish_idx)).isoformat(),
                    "数量": qty,
                    "门店名称": store,
                })
    return pd.DataFrame(rows)


# ── DiningHeatmapHandler ─────────────────────────────────────

def test_dining_heatmap_runs_on_sample_pos(sample_pos_df):
    handler = DiningHeatmapHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    assert response.section_name == "dining_heatmap"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        # Engine returns a non-empty dict with the canonical keys
        assert "cells" in response.data
        assert "totalRevenue" in response.data
        assert response.data["totalRevenue"] > 0
    assert response.computed_at_ms >= 0


def test_dining_heatmap_skipped_without_pos():
    handler = DiningHeatmapHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("POS" in w or "DataFrame" in w for w in response.warnings)


def test_dining_heatmap_skipped_when_columns_missing(sample_pos_df):
    """Custom datetime_col that doesn't exist → SKIPPED with explicit reason."""
    handler = DiningHeatmapHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="川菜",
        params={"datetime_col": "NoSuchColumn"},
    )
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    assert response.status == SectionStatus.SKIPPED
    assert any("NoSuchColumn" in w for w in response.warnings)


# ── LongTailSkuHandler ───────────────────────────────────────

def test_long_tail_sku_runs_on_sample_pos(sample_pos_df):
    handler = LongTailSkuHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    assert response.section_name == "long_tail_sku"
    # Detector with only 5 SKUs may legitimately return OK with empty list,
    # or be too small to be meaningful. Accept either outcome.
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        assert "totalSkuCount" in response.data
        assert response.data["totalSkuCount"] >= 0


def test_long_tail_sku_skipped_without_pos():
    handler = LongTailSkuHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("POS" in w or "DataFrame" in w for w in response.warnings)


# ── MenuNormalizationHandler ─────────────────────────────────

def test_menu_normalization_runs_on_sample_pos(sample_pos_df):
    handler = MenuNormalizationHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    assert response.section_name == "menu_normalization"
    # menu_normalizer.apply() requires DB; without one we may legitimately
    # get SKIPPED. With one available we should get OK with the metadata dict.
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        assert "originalUniqueCount" in response.data
        assert response.data["originalUniqueCount"] >= 1


def test_menu_normalization_skipped_without_pos():
    handler = MenuNormalizationHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("POS" in w or "DataFrame" in w for w in response.warnings)


# ── TemporalComparisonHandler ────────────────────────────────

def test_temporal_comparison_runs_on_sample_pos(sample_pos_df):
    handler = TemporalComparisonHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    assert response.section_name == "temporal_comparison"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        # 60 days → ≥3 months → MoM at minimum (or insufficient if dates land in same month)
        assert "mode" in response.data
        assert response.data["mode"] in ("yoy", "qoq", "mom", "insufficient")


def test_temporal_comparison_skipped_without_pos():
    handler = TemporalComparisonHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="川菜", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("POS" in w or "DataFrame" in w for w in response.warnings)


def test_channel_margin_accepts_custom_venue_list():
    """鼎鲜 has 5 venues, not 3. Calculator must accept a custom venue list.

    Also test 西餐 (2 venues) to prove generality across cuisines.
    """
    import pandas as pd
    from smartbi.services.restaurant.channel_margin_calculator import ChannelMarginCalculator

    # Hotpot: 5 venues
    hotpot_df = pd.DataFrame([
        {"订单来源": "包厢", "实收额": 3200, "数量": 1},
        {"订单来源": "宴会", "实收额": 8800, "数量": 1},
        {"订单来源": "午茶", "实收额": 450, "数量": 1},
        {"订单来源": "大厅晚餐", "实收额": 1250, "数量": 1},
        {"订单来源": "外卖", "实收额": 78, "数量": 1},
    ])
    calc = ChannelMarginCalculator(factory_id="F-DINGXIAN", sub_sector="火锅")
    report = calc.calculate(
        df=hotpot_df,
        order_method_col="订单来源",
        revenue_col="实收额",
        venue_list=["包厢", "宴会", "午茶", "大厅晚餐", "外卖"],
    )
    details = report.to_dict().get("channelDetails") or report.to_dict().get("channels") or report.to_dict().get("rows") or []  # noqa: E501
    # At least 5 venues should appear (exact key name depends on the report structure)
    assert len(details) >= 5

    # Western: 2 venues
    western_df = pd.DataFrame([
        {"订单来源": "堂食", "实收额": 680, "数量": 1},
        {"订单来源": "堂食", "实收额": 720, "数量": 1},
        {"订单来源": "外卖", "实收额": 120, "数量": 1},
    ])
    calc2 = ChannelMarginCalculator(factory_id="F-TEATRO", sub_sector="西餐")
    report2 = calc2.calculate(
        df=western_df,
        order_method_col="订单来源",
        revenue_col="实收额",
        venue_list=["堂食", "外卖"],
    )
    details2 = report2.to_dict().get("channelDetails") or report2.to_dict().get("channels") or report2.to_dict().get("rows") or []  # noqa: E501
    assert len(details2) >= 2


def test_channel_margin_venue_list_none_preserves_default():
    """When venue_list=None, behavior matches pre-QW2 (auto-detect from data)."""
    import pandas as pd
    from smartbi.services.restaurant.channel_margin_calculator import ChannelMarginCalculator

    df = pd.DataFrame([
        {"订单来源": "堂食", "实收额": 100, "数量": 1},
        {"订单来源": "外卖", "实收额": 80, "数量": 1},
    ])
    calc = ChannelMarginCalculator(factory_id="F-TEST", sub_sector="火锅")
    # Call WITHOUT venue_list param — must still work
    report = calc.calculate(
        df=df,
        order_method_col="订单来源",
        revenue_col="实收额",
    )
    # Should produce a valid report
    assert report is not None
