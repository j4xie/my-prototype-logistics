"""Tests for services.materialized_analytics.daily_order_type_meal aggregator.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.7
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task D1 (revised location)

Mocks asyncpg pool/conn to verify:
  - UPSERT SQL is correctly parametrized
  - Function returns affected row count from execute() result
  - SET LOCAL app.factory_id IS set on conn before INSERT
  - date_min / date_max passed as positional params
"""
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.services.materialized_analytics.daily_order_type_meal import (
    materialize_daily_order_type_meal,
    _AGG_DAILY_OMT_UPSERT_SQL,
)


def _make_pool(execute_return: str = "INSERT 0 12"):
    """Build a mocked asyncpg pool whose conn.execute returns the given tag."""
    pool = MagicMock()
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=execute_return)
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=ctx)
    return pool, conn


@pytest.mark.asyncio
async def test_returns_affected_row_count_from_pg_status():
    """Postgres returns 'INSERT 0 N' as the command tag; N is rows affected."""
    pool, _ = _make_pool(execute_return="INSERT 0 42")
    affected = await materialize_daily_order_type_meal(
        pool, "R_QINGHUAJIAO_REAL",
        date_min=date(2025, 10, 1), date_max=date(2025, 10, 7),
    )
    assert affected == 42


@pytest.mark.asyncio
async def test_upsert_sql_executed_with_correct_params():
    pool, conn = _make_pool()
    await materialize_daily_order_type_meal(
        pool, "R_QINGHUAJIAO_REAL",
        date_min=date(2025, 10, 1), date_max=date(2025, 10, 7),
    )
    # conn.execute called at least twice: SET LOCAL + UPSERT
    upsert_call = None
    for call in conn.execute.call_args_list:
        args = call[0]
        if args and _AGG_DAILY_OMT_UPSERT_SQL in args[0]:
            upsert_call = call
            break
    assert upsert_call is not None, "UPSERT SQL was not executed"
    # Positional args: factory_id, date_min, date_max
    assert upsert_call[0][1] == "R_QINGHUAJIAO_REAL"
    assert upsert_call[0][2] == date(2025, 10, 1)
    assert upsert_call[0][3] == date(2025, 10, 7)


@pytest.mark.asyncio
async def test_factory_id_context_is_set():
    """RLS requires app.factory_id GUC before INSERT can target the row."""
    pool, conn = _make_pool()
    await materialize_daily_order_type_meal(
        pool, "R_QINGHUAJIAO_REAL",
        date_min=date(2025, 10, 1), date_max=date(2025, 10, 7),
    )
    # set_config call should appear
    found = False
    for call in conn.execute.call_args_list:
        sql = call[0][0] if call[0] else ""
        if "set_config" in sql and "app.factory_id" in sql:
            found = True
            assert call[0][1] == "R_QINGHUAJIAO_REAL"
            break
    assert found, "app.factory_id must be set via set_config before UPSERT"


@pytest.mark.asyncio
async def test_pg_no_match_returns_zero():
    """When fact_pos_transaction has zero matching rows, UPSERT inserts 0."""
    pool, _ = _make_pool(execute_return="INSERT 0 0")
    affected = await materialize_daily_order_type_meal(
        pool, "R_QINGHUAJIAO_REAL",
        date_min=date(2025, 1, 1), date_max=date(2025, 1, 1),
    )
    assert affected == 0


def test_upsert_sql_aggregates_from_fact_pos_transaction():
    """Sanity: SQL queries the correct source table + grain."""
    assert "FROM fact_pos_transaction" in _AGG_DAILY_OMT_UPSERT_SQL
    assert "INSERT INTO agg_daily_order_type_meal" in _AGG_DAILY_OMT_UPSERT_SQL
    assert "ON CONFLICT" in _AGG_DAILY_OMT_UPSERT_SQL
    # Grain: GROUP BY factory_id, date, store_id, order_type, meal_period
    assert "GROUP BY" in _AGG_DAILY_OMT_UPSERT_SQL
    assert "factory_id" in _AGG_DAILY_OMT_UPSERT_SQL


def test_upsert_sql_uses_trim_and_default_for_null():
    """Null/whitespace order_type/meal_period must coalesce to '未分类'."""
    assert "COALESCE(TRIM" in _AGG_DAILY_OMT_UPSERT_SQL
    assert "'未分类'" in _AGG_DAILY_OMT_UPSERT_SQL
