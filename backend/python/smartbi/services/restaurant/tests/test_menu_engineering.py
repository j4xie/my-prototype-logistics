"""Tests for Kasavana-Smith Menu Engineering analyzer (P3 Task 3.1)."""
import pandas as pd
import pytest

from smartbi.services.restaurant.menu_engineering import (
    MenuEngineeringAnalyzer,
    MenuItemClassification,
    MenuQuadrant,
)


@pytest.fixture
def sample_menu_df():
    """8 hotpot menu items covering all 4 quadrants.

    Median sold_qty = 160 (between 30 and 290)
    Median margin_ratio = 0.5 (between 0.4 and 0.6)

    Expected classification:
      肥牛拼盘 (340, 60%)  -> STAR
      毛肚王 (290, 60%)    -> STAR
      土豆片 (510, 40%)    -> CASH_COW
      宽粉 (480, 40%)      -> CASH_COW
      龙虾刺身 (15, 66%)   -> PUZZLE
      澳牛板腱 (22, 65%)   -> PUZZLE
      鸭血 (30, 40%)       -> DOG
      水晶粉 (18, 30%)     -> DOG
    """
    return pd.DataFrame([
        {"name": "肥牛拼盘", "sold_qty": 340, "revenue": 27200, "food_cost": 10880},
        {"name": "毛肚王",   "sold_qty": 290, "revenue": 23200, "food_cost": 9280},
        {"name": "土豆片",   "sold_qty": 510, "revenue": 10200, "food_cost": 6120},
        {"name": "宽粉",     "sold_qty": 480, "revenue": 9600,  "food_cost": 5760},
        {"name": "龙虾刺身", "sold_qty": 15,  "revenue": 12000, "food_cost": 4000},
        {"name": "澳牛板腱", "sold_qty": 22,  "revenue": 17600, "food_cost": 6160},
        {"name": "鸭血",     "sold_qty": 30,  "revenue": 600,   "food_cost": 360},
        {"name": "水晶粉",   "sold_qty": 18,  "revenue": 360,   "food_cost": 252},
    ])


def test_classifies_into_4_quadrants(sample_menu_df):
    analyzer = MenuEngineeringAnalyzer()
    result = analyzer.analyze(sample_menu_df)

    stars = [c.name for c in result.classifications if c.quadrant == MenuQuadrant.STAR]
    cows = [c.name for c in result.classifications if c.quadrant == MenuQuadrant.CASH_COW]
    puzzles = [c.name for c in result.classifications if c.quadrant == MenuQuadrant.PUZZLE]
    dogs = [c.name for c in result.classifications if c.quadrant == MenuQuadrant.DOG]

    assert "肥牛拼盘" in stars, f"Expected 肥牛拼盘 in STAR, got stars={stars}"
    assert "毛肚王" in stars
    assert "土豆片" in cows
    assert "龙虾刺身" in puzzles
    assert "鸭血" in dogs


def test_report_has_summary_counts(sample_menu_df):
    analyzer = MenuEngineeringAnalyzer()
    result = analyzer.analyze(sample_menu_df)
    assert result.summary["total_items"] == 8
    assert result.summary["star_count"] == 2
    assert result.summary["cow_count"] == 2
    assert result.summary["puzzle_count"] == 2
    assert result.summary["dog_count"] == 2


def test_recommends_dog_removal(sample_menu_df):
    analyzer = MenuEngineeringAnalyzer()
    result = analyzer.analyze(sample_menu_df)
    # Dog recommendation should mention removal/淘汰/砍
    assert any(
        any(kw in rec for kw in ("淘汰", "砍", "移除"))
        for rec in result.recommendations
    ), f"Expected dog removal recommendation, got: {result.recommendations}"


def test_handles_empty_input():
    analyzer = MenuEngineeringAnalyzer()
    result = analyzer.analyze(pd.DataFrame())
    assert result.summary["total_items"] == 0
    assert result.classifications == []
    assert result.recommendations == []


def test_median_split_is_stable_for_odd_count():
    # 5 items: median index = 2 (middle element)
    df = pd.DataFrame([
        {"name": f"m{i}", "sold_qty": i * 10, "revenue": i * 100, "food_cost": i * 50}
        for i in range(1, 6)
    ])
    analyzer = MenuEngineeringAnalyzer()
    result = analyzer.analyze(df)
    # Verify no crash and all items classified
    assert len(result.classifications) == 5
    # Summary totals should equal 5
    total = (result.summary["star_count"] + result.summary["cow_count"]
             + result.summary["puzzle_count"] + result.summary["dog_count"])
    assert total == 5
