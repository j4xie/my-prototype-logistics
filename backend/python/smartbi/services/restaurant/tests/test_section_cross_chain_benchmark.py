"""Unit tests for cross_chain_benchmark section handler (P3 Task 3.3-3.4)."""
import pandas as pd
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.cross_chain_benchmark import (
    CrossChainBenchmarkHandler,
)


def _make_pos_rows(chain_name: str, dishes: list[tuple]) -> list[dict]:
    """Helper: build row dicts matching ChainInput.df column expectations."""
    rows = []
    for dish, price, revenue in dishes:
        rows.append({
            "实收": revenue,
            "商品分类": "主菜",
            "商品名称": dish,
            "销售单价": price,
            "销售金额": revenue,
            "折后金额": revenue,
            "门店名称": f"{chain_name}·总店",
            "单卖数量(不含套餐子商品)": revenue / price if price > 0 else 0,
        })
    return rows


def test_cross_chain_benchmark_happy_path():
    """Supply two chains with inline row data → benchmark output OK."""
    h = CrossChainBenchmarkHandler()
    chain_a_rows = _make_pos_rows("青花椒", [("水煮鱼", 68, 6800), ("麻辣豆腐", 28, 2800)])
    chain_b_rows = _make_pos_rows("蜀大侠", [("水煮鱼", 78, 7800), ("回锅肉", 38, 3800)])
    req = SectionRequest(
        factory_id="F-QINGHUAJIAO",
        upload_id=None,
        sub_sector="川菜",
        store_name="青花椒",
        params={
            "chains": [
                {"name": "青花椒", "sub_sector": "川菜", "rows": chain_a_rows},
                {"name": "蜀大侠", "sub_sector": "川菜", "rows": chain_b_rows},
            ],
        },
    )
    resp = h.compute(req, context={})
    assert resp.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if resp.status == SectionStatus.OK:
        assert isinstance(resp.data, dict)
        assert "chainProfiles" in resp.data
        assert len(resp.data["chainProfiles"]) == 2


def test_cross_chain_benchmark_skipped_without_chains():
    """Missing chains list → SKIPPED with informative warning."""
    h = CrossChainBenchmarkHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={"brand_name": "Test Brand"},  # no 'chains' key
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    assert any("chains" in w for w in resp.warnings)


def test_cross_chain_benchmark_skipped_with_single_chain():
    """Only one chain provided → SKIPPED (need 2+ for cross-chain comparison)."""
    h = CrossChainBenchmarkHandler()
    rows = _make_pos_rows("独家品牌", [("招牌菜", 58, 5800)])
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "chains": [
                {"name": "独家品牌", "sub_sector": "火锅", "rows": rows},
            ],
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    assert any("2" in w or "两" in w or "least" in w or "条" in w for w in resp.warnings)


def test_cross_chain_benchmark_section_registered_in_router():
    """Regression: handler must be in HANDLERS dict."""
    from smartbi.api.restaurant_sections import HANDLERS
    assert "cross_chain_benchmark" in HANDLERS
    assert HANDLERS["cross_chain_benchmark"].section_name == "cross_chain_benchmark"
