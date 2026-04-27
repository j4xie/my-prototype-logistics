"""Unit tests for ``smartbi.canonical.provenance.cascade``.

Covers Day 13-15 inheritance cascade engine per spec 04-C v1.4 §4:

- ``compute_dish_margin`` (维度继承 + 空缺降级)
- ``_get_industry_default_cost`` (空缺降级)
- ``get_industry_default`` (factory override + global hardcode)
- ``infer_product_summary_period`` (时间继承)

All tests mock ``asyncpg.Connection`` with ``AsyncMock`` so we don't need a
running PG. Real-PG integration is exercised in
``tests/test_data_fabric_e2e.py``.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.provenance import (
    INDUSTRY_DEFAULT_COST_RATIO,
    INDUSTRY_DEFAULT_MARGIN_RATE,
)
from smartbi.canonical.provenance.cascade import (
    _coerce_field_value_to_float,
    _get_industry_default_cost,
    compute_dish_margin,
    infer_product_summary_period,
)
from smartbi.canonical.provenance.industry_defaults import (
    get_industry_default,
)
from smartbi.canonical.provenance.types import ProvenanceValue


# ── fixtures ────────────────────────────────────────────────────────────────


def _make_prov_value(
    field_value=12.50,
    confidence=0.95,
    source_type="manual",
    mapper_method="manual",
    source_upload_id=0,
) -> ProvenanceValue:
    """Build a stub ``ProvenanceValue`` for cost mocks."""
    return ProvenanceValue(
        field_value=field_value,
        confidence=confidence,
        source_upload_id=source_upload_id,
        source_type=source_type,
        mapper_method=mapper_method,
        valid_from=None,
        valid_to=None,
    )


# ── _coerce_field_value_to_float ────────────────────────────────────────────


def test_coerce_field_value_to_float_handles_primitives():
    """int/float pass through; string-encoded JSON decoded."""
    assert _coerce_field_value_to_float(12.5) == 12.5
    assert _coerce_field_value_to_float(7) == 7.0
    assert _coerce_field_value_to_float("12.5") == 12.5  # JSON-encoded scalar
    assert _coerce_field_value_to_float("7") == 7.0


def test_coerce_field_value_to_float_returns_none_for_unparseable():
    """None / non-numeric / object → None (caller decides fallback)."""
    assert _coerce_field_value_to_float(None) is None
    assert _coerce_field_value_to_float("abc") is None
    assert _coerce_field_value_to_float({"v": 12.5}) is None


# ── compute_dish_margin: happy path ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_with_provenance_cost_returns_ok():
    """Recipe cost present + sales present → status='ok' with correct margin."""
    conn = AsyncMock()
    cost_prov = _make_prov_value(field_value=12.50, confidence=0.95)
    # Sales: revenue=5000, qty=100, upload_count=2.
    conn.fetchrow.return_value = {
        "total_rev": 5000.0, "total_qty": 100.0, "upload_count": 2,
    }
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read:
        mock_read.return_value = cost_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    assert result["status"] == "ok"
    assert result["product_id"] == 42
    assert result["revenue"] == 5000.0
    assert result["cost"] == 12.50 * 100  # 1250
    assert result["margin"] == 5000.0 - 1250
    assert abs(result["margin_rate"] - (3750 / 5000)) < 1e-9
    assert result["cost_source"] == "manual"
    assert result["cost_confidence"] == 0.95
    # sales_conf = min(0.95, 0.5 + 0.1*2) = 0.7
    assert abs(result["sales_confidence"] - 0.7) < 1e-9
    # result_conf = min(0.95, 0.7) = 0.7
    assert abs(result["confidence"] - 0.7) < 1e-9


@pytest.mark.asyncio
async def test_no_provenance_falls_back_to_industry_default():
    """No recipe → _get_industry_default_cost path used."""
    conn = AsyncMock()
    conn.fetchrow.return_value = {
        "total_rev": 1500.0, "total_qty": 50.0, "upload_count": 1,
    }
    industry_prov = _make_prov_value(
        field_value=10.50, confidence=0.5, source_type="industry_default",
        mapper_method="rule",
    )
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read, patch(
        "smartbi.canonical.provenance.cascade._get_industry_default_cost",
        new_callable=AsyncMock,
    ) as mock_idc:
        mock_read.return_value = None  # no recipe
        mock_idc.return_value = industry_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    assert result["status"] == "ok"
    assert result["cost_source"] == "industry_default"
    assert result["cost_confidence"] == 0.5
    assert result["cost"] == 10.50 * 50  # 525
    # sales_conf = min(0.95, 0.5 + 0.1*1) = 0.6 ; result = min(0.5, 0.6) = 0.5
    assert abs(result["confidence"] - 0.5) < 1e-9


@pytest.mark.asyncio
async def test_no_cost_no_sales_returns_unavailable():
    """Both recipe AND industry_default fail → status='unavailable'."""
    conn = AsyncMock()
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read, patch(
        "smartbi.canonical.provenance.cascade._get_industry_default_cost",
        new_callable=AsyncMock,
    ) as mock_idc:
        mock_read.return_value = None
        mock_idc.return_value = None
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    assert result["status"] == "unavailable"
    assert "无配方且从未销售" in result["reason"]
    assert result["confidence"] == 0.0
    # When unavailable, sales aggregate query is irrelevant — no fetchrow call.
    assert conn.fetchrow.await_count == 0


@pytest.mark.asyncio
async def test_zero_revenue_zero_margin_rate_no_div_by_zero():
    """revenue=0 → margin_rate=0, NOT division-by-zero."""
    conn = AsyncMock()
    cost_prov = _make_prov_value(field_value=10.0, confidence=0.9)
    conn.fetchrow.return_value = {
        "total_rev": 0.0, "total_qty": 0.0, "upload_count": 0,
    }
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read:
        mock_read.return_value = cost_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    assert result["status"] == "ok"
    assert result["revenue"] == 0.0
    assert result["margin_rate"] == 0.0
    assert result["margin"] == 0.0


@pytest.mark.asyncio
async def test_confidence_is_min_of_cost_and_sales():
    """High cost_conf + low sales_conf → result = sales_conf."""
    conn = AsyncMock()
    cost_prov = _make_prov_value(field_value=10.0, confidence=0.95)
    conn.fetchrow.return_value = {
        "total_rev": 1000.0, "total_qty": 100.0, "upload_count": 0,
    }
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read:
        mock_read.return_value = cost_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    # sales_conf = min(0.95, 0.5 + 0.0) = 0.5; result = min(0.95, 0.5) = 0.5.
    assert abs(result["sales_confidence"] - 0.5) < 1e-9
    assert abs(result["confidence"] - 0.5) < 1e-9


@pytest.mark.asyncio
async def test_sales_confidence_caps_at_0_95():
    """upload_count >> 5 → sales_conf saturates at 0.95."""
    conn = AsyncMock()
    cost_prov = _make_prov_value(field_value=10.0, confidence=0.99)
    conn.fetchrow.return_value = {
        "total_rev": 1000.0, "total_qty": 100.0, "upload_count": 99,
    }
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read:
        mock_read.return_value = cost_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    assert abs(result["sales_confidence"] - 0.95) < 1e-9
    assert abs(result["confidence"] - 0.95) < 1e-9


@pytest.mark.asyncio
async def test_returns_cost_source_and_separate_confidences():
    """Result dict must surface separate cost/sales confidences for UI."""
    conn = AsyncMock()
    cost_prov = _make_prov_value(
        field_value=10.0, confidence=0.85, source_type="pos_excel"
    )
    conn.fetchrow.return_value = {
        "total_rev": 1000.0, "total_qty": 50.0, "upload_count": 3,
    }
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read:
        mock_read.return_value = cost_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    for k in (
        "status", "product_id", "revenue", "cost", "margin", "margin_rate",
        "confidence", "cost_source", "cost_confidence", "sales_confidence",
    ):
        assert k in result, f"missing key: {k}"
    assert result["cost_source"] == "pos_excel"
    assert result["cost_confidence"] == 0.85


@pytest.mark.asyncio
async def test_unparseable_field_value_returns_unavailable():
    """Defensive: corrupt JSONB field_value → unavailable, not silent 0 cost."""
    conn = AsyncMock()
    bad_prov = _make_prov_value(field_value={"unexpected": "shape"})
    with patch(
        "smartbi.canonical.provenance.cascade.read_authoritative_value",
        new_callable=AsyncMock,
    ) as mock_read:
        mock_read.return_value = bad_prov
        result = await compute_dish_margin(
            conn, "F999", 42, (date(2026, 2, 1), date(2026, 2, 28))
        )
    assert result["status"] == "unavailable"
    assert "无法解析" in result["reason"]


# ── get_industry_default ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_industry_default_cost_rate_known_category():
    """Known category resolves to its hardcoded cost ratio."""
    conn = AsyncMock()
    conn.fetchrow.return_value = None  # no factory override
    val = await get_industry_default(conn, "F999", "cost_rate", "川菜")
    assert val == INDUSTRY_DEFAULT_COST_RATIO["川菜"]


@pytest.mark.asyncio
async def test_get_industry_default_cost_rate_unknown_returns_default():
    """Unknown category falls back to ``_default``."""
    conn = AsyncMock()
    conn.fetchrow.return_value = None
    val = await get_industry_default(
        conn, "F999", "cost_rate", "外星料理"
    )
    assert val == INDUSTRY_DEFAULT_COST_RATIO["_default"]


@pytest.mark.asyncio
async def test_get_industry_default_factory_override_wins():
    """Factory override JSONB takes precedence over global hardcode."""
    conn = AsyncMock()
    conn.fetchrow.return_value = {
        "industry_default_overrides": {"cost_rate.川菜": 0.32}
    }
    val = await get_industry_default(conn, "F999", "cost_rate", "川菜")
    assert val == 0.32  # not the global 0.35


@pytest.mark.asyncio
async def test_get_industry_default_factory_override_string_jsonb():
    """asyncpg may surface JSONB as JSON string; we normalize."""
    conn = AsyncMock()
    conn.fetchrow.return_value = {
        "industry_default_overrides": '{"cost_rate.川菜": 0.30}'
    }
    val = await get_industry_default(conn, "F999", "cost_rate", "川菜")
    assert val == 0.30


@pytest.mark.asyncio
async def test_get_industry_default_margin_rate_known():
    """Margin rate for known category = 1 - cost_rate (rounded)."""
    conn = AsyncMock()
    conn.fetchrow.return_value = None
    val = await get_industry_default(conn, "F999", "margin_rate", "川菜")
    assert val == INDUSTRY_DEFAULT_MARGIN_RATE["川菜"]


@pytest.mark.asyncio
async def test_get_industry_default_margin_rate_falls_back_to_one_minus_default():
    """Unknown category for margin_rate → 1 - _default cost."""
    conn = AsyncMock()
    conn.fetchrow.return_value = None
    val = await get_industry_default(
        conn, "F999", "margin_rate", "外星料理"
    )
    assert abs(val - (1.0 - INDUSTRY_DEFAULT_COST_RATIO["_default"])) < 1e-9


@pytest.mark.asyncio
async def test_get_industry_default_unknown_default_type_returns_none():
    """Misuse: bad default_type → None, no exception."""
    conn = AsyncMock()
    val = await get_industry_default(
        conn, "F999", "wrong_type", "川菜"
    )
    assert val is None


# ── _get_industry_default_cost ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_dim_product_uses_default_category():
    """No dim_product row → fall back to ``_default`` category cost ratio."""
    conn = AsyncMock()
    # 1st fetchrow: dim_product.category lookup → None.
    # 2nd fetchrow: factory_provenance_config (called by get_industry_default)
    #   → None (no override).
    conn.fetchrow.side_effect = [None, None]
    # fetchval: AVG(avg_unit_price) = 20.0
    conn.fetchval.return_value = 20.0

    prov = await _get_industry_default_cost(conn, "F999", 42)
    assert prov is not None
    assert prov.source_type == "industry_default"
    assert prov.mapper_method == "rule"
    # _default cost_ratio = 0.35; cost = 20 * 0.35 = 7.0
    assert abs(prov.field_value - 7.0) < 1e-9


@pytest.mark.asyncio
async def test_avg_price_from_agg_product_period():
    """Real category + AVG → cost = avg_price * cost_rate."""
    conn = AsyncMock()
    # 1st fetchrow: dim_product.category = '川菜'
    # 2nd fetchrow: factory_provenance_config → None
    conn.fetchrow.side_effect = [{"category": "川菜"}, None]
    conn.fetchval.return_value = 30.0

    prov = await _get_industry_default_cost(conn, "F999", 42)
    assert prov is not None
    # 川菜 cost_rate = 0.35; cost = 30 * 0.35 = 10.5
    assert abs(prov.field_value - 10.5) < 1e-9
    assert prov.confidence == 0.5
    assert prov.source_upload_id == 0
    assert "industry_default" in prov.notes


@pytest.mark.asyncio
async def test_no_sales_returns_none():
    """AVG returns None (never sold) → return None per spec C-9."""
    conn = AsyncMock()
    conn.fetchrow.side_effect = [{"category": "川菜"}, None]
    conn.fetchval.return_value = None

    prov = await _get_industry_default_cost(conn, "F999", 42)
    assert prov is None


@pytest.mark.asyncio
async def test_zero_avg_price_returns_none():
    """AVG returns 0 → also None (avoid synthetic cost=0)."""
    conn = AsyncMock()
    conn.fetchrow.side_effect = [{"category": "川菜"}, None]
    conn.fetchval.return_value = 0

    prov = await _get_industry_default_cost(conn, "F999", 42)
    assert prov is None


@pytest.mark.asyncio
async def test_returns_provenance_value_with_industry_default_source():
    """Result is a ProvenanceValue dataclass with all expected fields."""
    conn = AsyncMock()
    conn.fetchrow.side_effect = [{"category": "粤菜"}, None]
    conn.fetchval.return_value = 50.0

    prov = await _get_industry_default_cost(conn, "F999", 42)
    assert isinstance(prov, ProvenanceValue)
    assert prov.source_type == "industry_default"
    assert prov.mapper_method == "rule"
    assert prov.confidence == 0.5
    assert prov.source_upload_id == 0
    assert prov.valid_from is None
    assert prov.valid_to is None
    # 粤菜 cost_rate = 0.40; cost = 50 * 0.40 = 20.0
    assert abs(prov.field_value - 20.0) < 1e-9


# ── infer_product_summary_period ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_returns_period_from_neighboring_bill_flow():
    """Single bill_flow neighbour → return its period."""
    conn = AsyncMock()
    conn.fetchval.return_value = date(2026, 2, 15)  # upload_date
    conn.fetch.return_value = [
        {"p_start": date(2026, 2, 1), "p_end": date(2026, 2, 28)},
    ]
    fake_config = {"time_inheritance_window_days": 7}
    with patch(
        "smartbi.canonical.provenance.conflict_resolver._get_factory_config",
        new_callable=AsyncMock,
    ) as mock_cfg:
        mock_cfg.return_value = fake_config
        result = await infer_product_summary_period(conn, "F999", 100)
    assert result == (date(2026, 2, 1), date(2026, 2, 28))


@pytest.mark.asyncio
async def test_returns_union_of_multiple_neighbors():
    """Multiple bill_flow uploads → (min start, max end)."""
    conn = AsyncMock()
    conn.fetchval.return_value = date(2026, 2, 15)
    conn.fetch.return_value = [
        {"p_start": date(2026, 2, 1),  "p_end": date(2026, 2, 14)},
        {"p_start": date(2026, 2, 10), "p_end": date(2026, 2, 28)},
    ]
    with patch(
        "smartbi.canonical.provenance.conflict_resolver._get_factory_config",
        new_callable=AsyncMock,
    ) as mock_cfg:
        mock_cfg.return_value = {"time_inheritance_window_days": 7}
        result = await infer_product_summary_period(conn, "F999", 100)
    assert result == (date(2026, 2, 1), date(2026, 2, 28))


@pytest.mark.asyncio
async def test_no_neighbor_returns_none():
    """fetch returns [] → None (no time inheritance possible)."""
    conn = AsyncMock()
    conn.fetchval.return_value = date(2026, 2, 15)
    conn.fetch.return_value = []
    with patch(
        "smartbi.canonical.provenance.conflict_resolver._get_factory_config",
        new_callable=AsyncMock,
    ) as mock_cfg:
        mock_cfg.return_value = {"time_inheritance_window_days": 7}
        result = await infer_product_summary_period(conn, "F999", 100)
    assert result is None


@pytest.mark.asyncio
async def test_window_days_from_factory_config():
    """factory_config.time_inheritance_window_days is plumbed to the SQL."""
    conn = AsyncMock()
    conn.fetchval.return_value = date(2026, 2, 15)
    conn.fetch.return_value = [
        {"p_start": date(2026, 2, 1), "p_end": date(2026, 2, 28)},
    ]
    with patch(
        "smartbi.canonical.provenance.conflict_resolver._get_factory_config",
        new_callable=AsyncMock,
    ) as mock_cfg:
        mock_cfg.return_value = {"time_inheritance_window_days": 14}
        await infer_product_summary_period(conn, "F999", 100)
    # The fetch SQL should mention "14 days"
    sql_call = conn.fetch.await_args
    assert sql_call is not None
    sql_text = sql_call.args[0]
    assert "INTERVAL '14 days'" in sql_text


@pytest.mark.asyncio
async def test_no_upload_id_returns_none():
    """Invalid upload_id → fetchval returns None → function returns None."""
    conn = AsyncMock()
    conn.fetchval.return_value = None
    result = await infer_product_summary_period(conn, "F999", 99999)
    assert result is None
    # Should not have queried bill_flow neighbours.
    assert conn.fetch.await_count == 0


@pytest.mark.asyncio
async def test_neighbor_with_null_p_end_excluded():
    """A bill upload with p_start but NULL p_end → can't contribute end."""
    conn = AsyncMock()
    conn.fetchval.return_value = date(2026, 2, 15)
    conn.fetch.return_value = [
        # First neighbour has both endpoints — should be the answer.
        {"p_start": date(2026, 2, 5),  "p_end": date(2026, 2, 25)},
        # Second has p_end NULL — excluded from end aggregation.
        {"p_start": date(2026, 2, 10), "p_end": None},
    ]
    with patch(
        "smartbi.canonical.provenance.conflict_resolver._get_factory_config",
        new_callable=AsyncMock,
    ) as mock_cfg:
        mock_cfg.return_value = {"time_inheritance_window_days": 7}
        result = await infer_product_summary_period(conn, "F999", 100)
    assert result == (date(2026, 2, 5), date(2026, 2, 25))
