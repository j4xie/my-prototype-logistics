"""Unit tests for B-stage Silver-layer MVP templates."""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

from smartbi.canonical.templates import (
    TemplateResult,
    compute_finance_monthly_balance,
    compute_inventory_alert,
    compute_product_top10,
    compute_review_rating_trend,
)
from smartbi.canonical.templates.review_rating_trend import _aggregate_keywords


def _make_mock_pool(conn):
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


# ───────────────────────────── product_top10 ─────────────────────────────

async def test_product_top10_happy_path():
    """Three products → ordered by revenue, kpis aggregate correctly."""
    rows = [
        {
            "product_id": 1,
            "name": "宫保鸡丁",
            "normalized_name": "gongbao",
            "total_qty": 200.0,
            "total_revenue": 12000.0,
            "avg_price": 60.0,
            "total_refund_qty": 5.0,
            "total_refund_amount": 300.0,
        },
        {
            "product_id": 2,
            "name": "麻婆豆腐",
            "normalized_name": "mapo",
            "total_qty": 150.0,
            "total_revenue": 6000.0,
            "avg_price": 40.0,
            "total_refund_qty": 0.0,
            "total_refund_amount": 0.0,
        },
        {
            "product_id": 3,
            "name": "西红柿炒蛋",
            "normalized_name": "xihongshi",
            "total_qty": 100.0,
            "total_revenue": 2000.0,
            "avg_price": 20.0,
            "total_refund_qty": 0.0,
            "total_refund_amount": 0.0,
        },
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)

    result = await compute_product_top10(_make_mock_pool(conn), factory_id="F001")

    assert isinstance(result, TemplateResult)
    assert result.applies is True
    assert result.code == "product_top10"
    assert len(result.data["items"]) == 3
    assert result.data["items"][0]["name"] == "宫保鸡丁"
    assert result.kpis["total_revenue"] == 20000.0
    assert result.kpis["total_qty"] == 450.0
    assert result.kpis["top_product_name"] == "宫保鸡丁"
    assert result.kpis["top_product_revenue"] == 12000.0
    # 12000 / 20000 = 60%
    assert result.kpis["top_product_share_pct"] == 60.0
    assert result.kpis["n_products"] == 3
    assert result.chart_config and result.chart_config["type"] == "bar"
    assert "宫保鸡丁" in result.insight_text


async def test_product_top10_empty_returns_skip():
    """No rows → applies=False with skip_reason."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    result = await compute_product_top10(_make_mock_pool(conn), factory_id="F002")

    assert result.applies is False
    assert "agg_product_period" in result.skip_reason
    assert result.code == "product_top10"


async def test_product_top10_period_filters():
    """When period_start/period_end provided, SQL must contain them as params."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    await compute_product_top10(
        _make_mock_pool(conn),
        factory_id="F001",
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
        top_n=20,
    )

    args = conn.fetch.await_args.args
    sql = args[0]
    # factory_id + period_start + period_end + limit
    assert "period_start >=" in sql
    assert "period_end <=" in sql
    assert args[1] == "F001"
    assert args[2] == date(2026, 1, 1)
    assert args[3] == date(2026, 3, 31)
    assert args[4] == 20


# ─────────────────────────── review_rating_trend ───────────────────────────

async def test_review_rating_trend_happy_path():
    """Two periods, weighted average rating + Top keywords aggregated."""
    rows = [
        {
            "period_start": date(2026, 1, 1),
            "period_end": date(2026, 1, 31),
            "avg_rating": 4.2,
            "total_count": 100,
            "positive_count": 70,
            "negative_count": 10,
            "keywords_arr": [
                [{"keyword": "好吃", "count": 30}, {"keyword": "服务好", "count": 12}]
            ],
        },
        {
            "period_start": date(2026, 2, 1),
            "period_end": date(2026, 2, 28),
            "avg_rating": 4.5,
            "total_count": 50,
            "positive_count": 40,
            "negative_count": 5,
            "keywords_arr": [
                [{"keyword": "好吃", "count": 20}, {"keyword": "环境好", "count": 8}]
            ],
        },
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)

    result = await compute_review_rating_trend(
        _make_mock_pool(conn), factory_id="F001"
    )

    assert result.applies is True
    assert result.code == "review_rating_trend"
    assert len(result.data["trend"]) == 2
    # Weighted avg = (4.2*100 + 4.5*50) / 150 = (420+225)/150 = 4.30
    assert result.kpis["overall_avg_rating"] == 4.30
    assert result.kpis["total_reviews"] == 150
    # 110/150 = 73.33%
    assert result.kpis["positive_pct"] == round(110 / 150 * 100, 2)
    assert result.kpis["negative_pct"] == round(15 / 150 * 100, 2)
    assert result.kpis["n_periods"] == 2
    # Top keywords: 好吃 appears in both periods → count 50
    overall = {k["keyword"]: k["count"] for k in result.data["top_keywords"]}
    assert overall["好吃"] == 50
    assert "4.3" in result.insight_text


async def test_review_rating_trend_empty_returns_skip():
    """No rows → applies=False."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    result = await compute_review_rating_trend(
        _make_mock_pool(conn), factory_id="F099"
    )

    assert result.applies is False
    assert "dim_review_summary" in result.skip_reason


def test_aggregate_keywords_helper_handles_mixed_shapes():
    """Helper should handle list-of-strings, list-of-dicts, JSON strings, None."""
    arr = [
        ["好吃", "实惠"],  # list of strings
        [{"keyword": "好吃", "count": 5}],  # list of dicts
        '[{"keyword": "好吃", "count": 3}]',  # JSON string
        None,  # null
        [{"name": "服务好", "freq": 2}],  # alt key names
    ]
    out = _aggregate_keywords(arr, top=10)
    by = {k["keyword"]: k["count"] for k in out}
    # 好吃: 1 (string) + 5 (dict) + 3 (json string) = 9
    assert by["好吃"] == 9
    assert by["实惠"] == 1
    assert by["服务好"] == 2


# ───────────────────────── finance_monthly_balance ─────────────────────────

async def test_finance_monthly_balance_happy_path():
    """Two months × 2 categories → kpis sum, chart_config set."""
    rows = [
        {
            "month": date(2026, 1, 1),
            "category": "income",
            "debit_total": 0.0,
            "credit_total": 50000.0,
        },
        {
            "month": date(2026, 1, 1),
            "category": "expense",
            "debit_total": 30000.0,
            "credit_total": 0.0,
        },
        {
            "month": date(2026, 2, 1),
            "category": "income",
            "debit_total": 0.0,
            "credit_total": 60000.0,
        },
        {
            "month": date(2026, 2, 1),
            "category": "expense",
            "debit_total": 35000.0,
            "credit_total": 0.0,
        },
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)

    result = await compute_finance_monthly_balance(
        _make_mock_pool(conn), factory_id="F001"
    )

    assert result.applies is True
    assert result.code == "finance_monthly_balance"
    assert len(result.data["items"]) == 4
    assert result.kpis["total_debit"] == 65000.0
    assert result.kpis["total_credit"] == 110000.0
    assert result.kpis["net_balance"] == 45000.0
    assert result.kpis["n_months"] == 2
    assert result.chart_config["type"] == "stacked_bar"


async def test_finance_monthly_balance_empty_returns_skip():
    """No vouchers → applies=False."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    result = await compute_finance_monthly_balance(
        _make_mock_pool(conn), factory_id="F999"
    )

    assert result.applies is False
    assert "fact_finance_voucher" in result.skip_reason


async def test_finance_monthly_balance_date_filters():
    """date_from / date_to should appear in SQL parameter list."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    await compute_finance_monthly_balance(
        _make_mock_pool(conn),
        factory_id="F001",
        date_from=date(2026, 1, 1),
        date_to=date(2026, 6, 30),
    )

    args = conn.fetch.await_args.args
    sql = args[0]
    assert "voucher_date >=" in sql
    assert "voucher_date <=" in sql
    assert args[1] == "F001"
    assert args[2] == date(2026, 1, 1)
    assert args[3] == date(2026, 6, 30)


# ────────────────────────────── inventory_alert ──────────────────────────────

async def test_inventory_alert_happy_path():
    """Two ingredients below threshold → ranked by shortage desc."""
    rows = [
        {
            "ingredient_id": 10,
            "ingredient_name": "猪肉",
            "store_id": 1,
            "store_name": "门店A",
            "stock_qty": 2.0,
            "unit": "kg",
            "snapshot_date": date(2026, 4, 25),
            "safe_stock_qty": 20.0,
            "reorder_point": 10.0,
        },
        {
            "ingredient_id": 11,
            "ingredient_name": "西红柿",
            "store_id": 1,
            "store_name": "门店A",
            "stock_qty": 5.0,
            "unit": "kg",
            "snapshot_date": date(2026, 4, 25),
            "safe_stock_qty": 10.0,
            "reorder_point": 6.0,
        },
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)

    result = await compute_inventory_alert(_make_mock_pool(conn), factory_id="F001")

    assert result.applies is True
    assert result.code == "inventory_alert"
    assert result.kpis["n_alerts"] == 2
    # Largest shortage = 猪肉 (20-2 = 18)
    assert result.kpis["max_shortage_ingredient"] == "猪肉"
    assert result.kpis["max_shortage_amount"] == 18.0
    items = result.data["items"]
    assert items[0]["ingredient_name"] == "猪肉"
    assert items[0]["shortage"] == 18.0
    assert items[1]["ingredient_name"] == "西红柿"
    assert items[1]["shortage"] == 5.0
    assert "猪肉" in result.insight_text


async def test_inventory_alert_empty_returns_skip():
    """No alerts → applies=False."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    result = await compute_inventory_alert(_make_mock_pool(conn), factory_id="F002")

    assert result.applies is False
    assert "safe stock" in result.skip_reason


async def test_inventory_alert_passes_factory_and_limit_to_sql():
    """factory_id + limit must be the two query params."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])

    await compute_inventory_alert(
        _make_mock_pool(conn), factory_id="F042", limit=25
    )

    args = conn.fetch.await_args.args
    sql = args[0]
    assert "fact_inventory_snapshot" in sql
    assert "ROW_NUMBER" in sql
    assert "dim_ingredient_threshold" in sql
    assert args[1] == "F042"
    assert args[2] == 25
