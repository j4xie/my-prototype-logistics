"""Unit tests for smartbi.canonical.provenance.conflict_resolver.

All tests use AsyncMock conn — pure unit (no PG required). The DB-backed
behavior is covered by tests/test_data_fabric_e2e.py.
"""
from __future__ import annotations

import json
import time
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from smartbi.canonical.provenance import (
    GLOBAL_PRIORITY_TABLE,
    ProvenanceValue,
    invalidate_factory_config_cache,
    resolve_conflict,
)
from smartbi.canonical.provenance import conflict_resolver as cr


def _make_conn() -> AsyncMock:
    """Build an AsyncMock conn with the methods resolve_conflict touches."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=42)
    conn.execute = AsyncMock(return_value=None)
    return conn


@pytest.fixture(autouse=True)
def _clear_cache():
    """Each test starts with an empty factory_provenance_config cache."""
    invalidate_factory_config_cache()
    yield
    invalidate_factory_config_cache()


# ── _compute_priority ─────────────────────────────────────────────────


def test_compute_priority_uses_factory_override():
    cfg = {"priority_overrides": {"manual": 3}}
    assert cr._compute_priority("manual", cfg) == 3


def test_compute_priority_falls_back_to_global():
    cfg = {"priority_overrides": None}
    assert cr._compute_priority("manual", cfg) == GLOBAL_PRIORITY_TABLE["manual"]
    assert cr._compute_priority("review", cfg) == GLOBAL_PRIORITY_TABLE["review"]


def test_compute_priority_unknown_source_type_returns_5():
    """Unknown source_type → defaults to 5 (inferred-tier fallback)."""
    cfg: dict = {}
    assert cr._compute_priority("totally_unknown", cfg) == 5


def test_compute_priority_handles_invalid_override_value():
    """Override that can't be parsed as int falls back to GLOBAL."""
    cfg = {"priority_overrides": {"manual": "not-an-int"}}
    # Falls back to GLOBAL (manual=1)
    assert cr._compute_priority("manual", cfg) == 1


# ── _get_factory_config ───────────────────────────────────────────────


async def test_get_factory_config_returns_defaults_when_no_row():
    conn = _make_conn()
    conn.fetchrow = AsyncMock(return_value=None)

    cfg = await cr._get_factory_config(conn, "F999")
    assert cfg["diff_threshold"] == 0.30
    assert cfg["priority_overrides"] is None
    assert cfg["industry_default_overrides"] is None
    assert cfg["time_inheritance_window_days"] == 7


async def test_get_factory_config_caches_5min():
    """Second call within TTL must reuse the cached config (no second fetchrow)."""
    conn = _make_conn()
    conn.fetchrow = AsyncMock(
        return_value={
            "diff_threshold": 0.20,
            "priority_overrides": None,
            "industry_default_overrides": None,
            "time_inheritance_window_days": 14,
        }
    )

    cfg1 = await cr._get_factory_config(conn, "F-CACHE")
    cfg2 = await cr._get_factory_config(conn, "F-CACHE")
    assert cfg1 == cfg2
    conn.fetchrow.assert_awaited_once()


async def test_get_factory_config_normalizes_jsonb_string():
    """asyncpg may return JSONB as str; helper must parse to dict."""
    conn = _make_conn()
    conn.fetchrow = AsyncMock(
        return_value={
            "diff_threshold": 0.40,
            "priority_overrides": '{"manual": 3}',
            "industry_default_overrides": '{"cost_rate.川菜": 0.32}',
            "time_inheritance_window_days": 5,
        }
    )
    cfg = await cr._get_factory_config(conn, "F-JSON")
    assert cfg["priority_overrides"] == {"manual": 3}
    assert cfg["industry_default_overrides"] == {"cost_rate.川菜": 0.32}


async def test_invalidate_factory_config_cache_clears_one():
    conn = _make_conn()
    conn.fetchrow = AsyncMock(
        return_value={
            "diff_threshold": 0.10,
            "priority_overrides": None,
            "industry_default_overrides": None,
            "time_inheritance_window_days": 1,
        }
    )
    await cr._get_factory_config(conn, "F-A")
    await cr._get_factory_config(conn, "F-B")
    assert "F-A" in cr._factory_config_cache
    invalidate_factory_config_cache("F-A")
    assert "F-A" not in cr._factory_config_cache
    assert "F-B" in cr._factory_config_cache


async def test_invalidate_factory_config_cache_clears_all():
    conn = _make_conn()
    conn.fetchrow = AsyncMock(
        return_value={
            "diff_threshold": 0.10,
            "priority_overrides": None,
            "industry_default_overrides": None,
            "time_inheritance_window_days": 1,
        }
    )
    await cr._get_factory_config(conn, "F-A")
    await cr._get_factory_config(conn, "F-B")
    invalidate_factory_config_cache()
    assert cr._factory_config_cache == {}


# ── _field_type / _values_equal / _is_significant_diff ────────────────


def test_field_type_classification():
    assert cr._field_type("cost_per_unit") == "decimal"
    assert cr._field_type("rating") == "decimal"
    assert cr._field_type("review_count") == "int"
    assert cr._field_type("brand") == "string"
    assert cr._field_type("top_keywords") == "array"
    # Unknown defaults to string
    assert cr._field_type("totally_unknown_field") == "string"


def test_values_equal_decimal_tolerance():
    """Float-tolerance equality: numbers within 1e-9 considered equal."""
    assert cr._values_equal(1.0, 1.0 + 1e-12, "decimal")
    assert not cr._values_equal(1.0, 1.001, "decimal")
    assert cr._values_equal(0, None, "decimal") is False  # one None
    assert cr._values_equal(None, None, "decimal") is True


def test_values_equal_string():
    assert cr._values_equal("墨鱼圈", "墨鱼圈", "string")
    assert not cr._values_equal("墨鱼圈", "墨鱼", "string")


def test_values_equal_array_sorted_compare():
    """Arrays compare by sorted JSON serialization."""
    assert cr._values_equal([1, 2, 3], [1, 2, 3], "array")
    # Different order → unequal (we don't sort the list itself, only the keys)
    assert not cr._values_equal([1, 2, 3], [3, 2, 1], "array")


def test_is_significant_diff_zero_to_nonzero():
    """current=0, new=100 should ALWAYS be significant (regardless of threshold)."""
    assert cr._is_significant_diff(0, 100, "decimal", 0.30) is True
    assert cr._is_significant_diff(0, 0.01, "decimal", 0.30) is True


def test_is_significant_diff_zero_to_zero_not_significant():
    """current=0, new=0 → identical, not significant."""
    assert cr._is_significant_diff(0, 0, "decimal", 0.30) is False


def test_is_significant_diff_below_threshold():
    """5% diff with default 30% threshold → not significant."""
    assert cr._is_significant_diff(100, 105, "decimal", 0.30) is False


def test_is_significant_diff_above_threshold():
    """50% diff with default 30% threshold → significant."""
    assert cr._is_significant_diff(100, 150, "decimal", 0.30) is True


def test_is_significant_diff_string_any_change_significant():
    """Strings: any non-equal value is treated as significant."""
    assert cr._is_significant_diff("墨鱼圈", "墨鱼", "string", 0.30) is True
    assert cr._is_significant_diff("墨鱼圈", "墨鱼圈", "string", 0.30) is False


# ── resolve_conflict: behavior ────────────────────────────────────────


async def test_resolve_conflict_no_prior_value_writes():
    """current=None → write_provenance is invoked, action='written'."""
    conn = _make_conn()
    # _get_factory_config: no row → defaults
    # read_authoritative_value: no row → None
    conn.fetchrow = AsyncMock(return_value=None)

    with patch.object(cr, "write_provenance", new=AsyncMock(return_value=42)) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="store",
            entity_id=1,
            field_name="brand",
            new_value="桂满陇",
            confidence=0.95,
            source_type="manual",
            mapper_method="manual",
        )

    assert out == {"action": "written", "id": 42, "reason": "no_prior_value"}
    wp.assert_awaited_once()


async def test_resolve_conflict_value_unchanged_no_change():
    """Identical current value → action='no_change'."""
    conn = _make_conn()

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value="桂满陇",
            confidence=0.95,
            source_upload_id=0,
            source_type="manual",
            mapper_method="manual",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="store",
            entity_id=1,
            field_name="brand",
            new_value="桂满陇",  # same as current
            confidence=0.5,
            source_type="manual",
            mapper_method="manual",
        )

    assert out["action"] == "no_change"
    assert out["id"] is None
    wp.assert_not_awaited()


async def test_resolve_conflict_higher_priority_supersedes():
    """new=manual (1), current=inferred (5) → write + supersede."""
    conn = _make_conn()
    # fetchval returns the prior_id when looked up, then write_provenance returns new id
    conn.fetchval = AsyncMock(return_value=17)  # prior id

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value=12.5,
            confidence=0.6,
            source_upload_id=0,
            source_type="inferred",
            mapper_method="rule",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=42)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            field_name="cost_per_unit",
            new_value=15.0,
            confidence=0.95,
            source_type="manual",
            mapper_method="manual",
        )

    assert out["action"] == "written"
    assert out["id"] == 42
    assert out["reason"] == "higher_priority"
    wp.assert_awaited_once()
    # Two UPDATE calls: 1) supersede prior to self-id, 2) re-point to new id
    assert conn.execute.await_count == 2


async def test_resolve_conflict_significant_diff_same_priority_queues():
    """Current=manual cost=60, new=manual cost=100 (67% diff) → queued."""
    conn = _make_conn()

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value=60.0,
            confidence=0.95,
            source_upload_id=0,
            source_type="manual",
            mapper_method="manual",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            field_name="cost_per_unit",
            new_value=100.0,
            confidence=0.95,
            source_type="manual",
            mapper_method="manual",
        )

    assert out["action"] == "queued"
    assert out["id"] is None
    assert out["reason"] == "significant_diff_same_or_lower_priority"
    wp.assert_not_awaited()
    # _enqueue_field_conflict ran exactly one INSERT
    assert conn.execute.await_count == 1
    sql = conn.execute.await_args.args[0]
    assert "entity_resolution_admin_queue" in sql
    assert "field_conflict" in sql


async def test_resolve_conflict_minor_diff_same_priority_no_change():
    """5% diff with 30% threshold + same priority → no_change (no churn)."""
    conn = _make_conn()

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value=100.0,
            confidence=0.95,
            source_upload_id=0,
            source_type="manual",
            mapper_method="manual",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            field_name="cost_per_unit",
            new_value=105.0,  # 5% > current
            confidence=0.95,
            source_type="manual",
            mapper_method="manual",
        )

    assert out["action"] == "no_change"
    assert out["reason"] == "minor_diff_same_or_lower_priority"
    wp.assert_not_awaited()


async def test_resolve_conflict_string_field_different_value_queues():
    """String field: any non-equal value at same priority → queued."""
    conn = _make_conn()

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value="墨鱼圈",
            confidence=0.95,
            source_upload_id=0,
            source_type="manual",
            mapper_method="manual",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            field_name="brand",
            new_value="老干妈",
            confidence=0.95,
            source_type="manual",
            mapper_method="manual",
        )

    assert out["action"] == "queued"
    wp.assert_not_awaited()


async def test_resolve_conflict_zero_to_nonzero_significant():
    """current=0 → new=100 same priority → queued (always significant)."""
    conn = _make_conn()

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value=0,
            confidence=0.95,
            source_upload_id=0,
            source_type="manual",
            mapper_method="manual",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            field_name="cost_per_unit",
            new_value=100.0,
            confidence=0.95,
            source_type="manual",
            mapper_method="manual",
        )

    assert out["action"] == "queued"
    wp.assert_not_awaited()


async def test_resolve_conflict_lower_priority_not_significant_no_change():
    """new=industry_default (6), current=manual (1), small diff → no_change."""
    conn = _make_conn()

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value=100.0,
            confidence=0.95,
            source_upload_id=0,
            source_type="manual",
            mapper_method="manual",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            field_name="cost_per_unit",
            new_value=102.0,  # 2% diff, sub-threshold
            confidence=0.5,
            source_type="industry_default",
            mapper_method="rule",
        )

    assert out["action"] == "no_change"
    wp.assert_not_awaited()


async def test_resolve_conflict_factory_override_changes_decision():
    """Factory override re-ranks priorities → resolution differs.

    Without override: review (4) vs manual (1) → manual wins, lower-priority
    review write would queue. With override making review=1, the new manual
    (still 1) vs current review (1) becomes same-priority → significant
    string diff queues anyway. Verify the override is consulted.
    """
    conn = _make_conn()
    # Factory has manual=2 in overrides, so a "manual" write becomes priority 2
    conn.fetchrow = AsyncMock(
        return_value={
            "diff_threshold": 0.30,
            "priority_overrides": {"manual": 2, "review": 1},
            "industry_default_overrides": None,
            "time_inheritance_window_days": 7,
        }
    )

    async def _fake_read(*_args, **_kwargs):
        return ProvenanceValue(
            field_value="老味道",
            confidence=0.9,
            source_upload_id=0,
            source_type="review",  # priority 1 with override
            mapper_method="rule",
        )

    with patch.object(cr, "read_authoritative_value", new=_fake_read), patch.object(
        cr, "write_provenance", new=AsyncMock(return_value=99)
    ) as wp:
        out = await resolve_conflict(
            conn,
            factory_id="F-OVERRIDE",
            entity_type="product",
            entity_id=1,
            field_name="brand",
            new_value="新品牌",
            confidence=0.9,
            source_type="manual",  # priority 2 with override → lower than review
            mapper_method="manual",
        )

    # new(2) >= current(1): same/lower priority + string diff → queued
    assert out["action"] == "queued"
    wp.assert_not_awaited()
