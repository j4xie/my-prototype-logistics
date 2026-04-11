"""Unit tests for menu_engineering section handler (P3 Task 3.2)."""
import pandas as pd
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.menu_engineering import (
    MenuEngineeringHandler,
)


@pytest.fixture
def hotpot_pos_df():
    """Same 8-item 火锅 scenario as P3.1 analyzer tests — 2 per quadrant."""
    return pd.DataFrame([
        {"商品名称": "肥牛拼盘", "数量": 340, "实收额": 27200},
        {"商品名称": "毛肚王",   "数量": 290, "实收额": 23200},
        {"商品名称": "土豆片",   "数量": 510, "实收额": 10200},
        {"商品名称": "宽粉",     "数量": 480, "实收额": 9600},
        {"商品名称": "龙虾刺身", "数量": 15,  "实收额": 12000},
        {"商品名称": "澳牛板腱", "数量": 22,  "实收额": 17600},
        {"商品名称": "鸭血",     "数量": 30,  "实收额": 600},
        {"商品名称": "水晶粉",   "数量": 18,  "实收额": 360},
    ])


@pytest.fixture
def sku_food_costs():
    """Real food_cost lookup — matches the P3.1 margin ratios."""
    return {
        "肥牛拼盘": 10880,    # 60% margin
        "毛肚王":   9280,
        "土豆片":   6120,     # 40% margin
        "宽粉":     5760,
        "龙虾刺身": 4000,     # 67% margin
        "澳牛板腱": 6160,
        "鸭血":     360,      # 40% margin
        "水晶粉":   252,      # 30% margin
    }


def test_menu_engineering_happy_path(hotpot_pos_df, sku_food_costs):
    """POS + SKU costs → 4-quadrant classification with correct counts."""
    h = MenuEngineeringHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
    )
    resp = h.compute(
        req,
        context={"pos_df": hotpot_pos_df, "sku_food_costs": sku_food_costs},
    )
    assert resp.status == SectionStatus.OK
    summary = resp.data["summary"]
    assert summary["total_items"] == 8
    # Matches P3.1 fixture: 2 per quadrant
    assert summary["star_count"] == 2
    assert summary["cow_count"] == 2
    assert summary["puzzle_count"] == 2
    assert summary["dog_count"] == 2
    # Recommendations populated
    assert len(resp.data["recommendations"]) > 0


def test_menu_engineering_skipped_without_pos_df():
    h = MenuEngineeringHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    assert any("POS" in w for w in resp.warnings)


def test_menu_engineering_skipped_without_sku_costs(hotpot_pos_df):
    h = MenuEngineeringHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
    )
    resp = h.compute(req, context={"pos_df": hotpot_pos_df})
    assert resp.status == SectionStatus.SKIPPED
    assert any("食材成本" in w or "sku" in w.lower() for w in resp.warnings)


def test_menu_engineering_skipped_on_missing_columns():
    """POS with wrong column names → SKIPPED."""
    bad_df = pd.DataFrame([{"wrong_col": 1, "other": 2}])
    h = MenuEngineeringHandler()
    req = SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅")
    resp = h.compute(
        req,
        context={"pos_df": bad_df, "sku_food_costs": {"dish1": 100}},
    )
    assert resp.status == SectionStatus.SKIPPED
    assert any("列" in w or "column" in w.lower() for w in resp.warnings)


def test_menu_engineering_router_registration():
    from smartbi.api.restaurant_sections import HANDLERS
    assert "menu_engineering" in HANDLERS
    assert HANDLERS["menu_engineering"].section_name == "menu_engineering"
