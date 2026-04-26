"""Unit tests for staff_handler.resolve_staff_with_autocreate."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from smartbi.canonical.entity_resolution.staff_handler import (
    resolve_staff_with_autocreate,
)


def _make_conn(same_store=None, cross_store=None, new_staff_id=1001):
    """Build a mock conn with fetch returning canned same/cross store rows."""
    same_store = same_store or []
    cross_store = cross_store or []

    async def fetch_side_effect(sql, *args, **kwargs):
        # Branch on the WHERE clause
        if "store_id = $2" in sql:
            return same_store
        if "store_id != $2" in sql:
            return cross_store
        return []

    conn = AsyncMock()
    conn.fetch = AsyncMock(side_effect=fetch_side_effect)
    conn.fetchval = AsyncMock(return_value=new_staff_id)
    conn.execute = AsyncMock(return_value=None)
    return conn


# --- Validation -------------------------------------------------------


async def test_empty_name_raises():
    """Empty raw_name → ValueError."""
    conn = _make_conn()
    with pytest.raises(ValueError, match="raw_name required"):
        await resolve_staff_with_autocreate(
            raw_name="", factory_id="F001", store_id=10, conn=conn,
        )


async def test_no_store_id_raises():
    """store_id=0 → ValueError (cannot create staff without parent store)."""
    conn = _make_conn()
    with pytest.raises(ValueError, match="store_id required"):
        await resolve_staff_with_autocreate(
            raw_name="张三", factory_id="F001", store_id=0, conn=conn,
        )


# --- Resolution paths -------------------------------------------------


async def test_same_store_existing_match_returns_existing():
    """Same store has matching name → return existing id, no INSERT."""
    same_store = [
        {"staff_id": 42, "name": "张三"},
        {"staff_id": 43, "name": "李四"},
    ]
    conn = _make_conn(same_store=same_store, cross_store=[])

    staff_id, was_auto = await resolve_staff_with_autocreate(
        raw_name="张三", factory_id="F001", store_id=10, conn=conn,
    )

    assert staff_id == 42
    assert was_auto is False
    # No INSERT into dim_staff
    conn.fetchval.assert_not_awaited()
    # No admin queue INSERT
    conn.execute.assert_not_awaited()


async def test_same_store_match_after_normalization():
    """Match found via normalize_for_dim — punctuation stripped from stored name."""
    # Stored has parentheses + dash; raw is the same letters w/o punctuation.
    same_store = [
        {"staff_id": 50, "name": "Chen-Wei"},
    ]
    conn = _make_conn(same_store=same_store)

    staff_id, was_auto = await resolve_staff_with_autocreate(
        raw_name="ChenWei", factory_id="F001", store_id=10, conn=conn,
    )

    # normalize_for_dim strips dash + lowercases → "chenwei" == "chenwei"
    assert staff_id == 50
    assert was_auto is False
    conn.fetchval.assert_not_awaited()


async def test_no_match_autocreates():
    """Empty same_store + empty cross_store → INSERT, return new id, was_auto=True."""
    conn = _make_conn(same_store=[], cross_store=[], new_staff_id=999)

    staff_id, was_auto = await resolve_staff_with_autocreate(
        raw_name="王五", factory_id="F001", store_id=10, conn=conn,
    )

    assert staff_id == 999
    assert was_auto is True
    conn.fetchval.assert_awaited_once()
    insert_sql = conn.fetchval.await_args.args[0]
    assert "INSERT INTO dim_staff" in insert_sql
    insert_args = conn.fetchval.await_args.args[1:]
    assert insert_args == ("F001", "王五", None, 10)
    # No admin queue INSERT
    conn.execute.assert_not_awaited()


async def test_cross_store_match_autocreates_and_queues_admin():
    """Empty same_store, cross_store has match → INSERT + admin queue INSERT."""
    cross_store = [
        {"staff_id": 100, "store_id": 20, "name": "王五"},
        {"staff_id": 101, "store_id": 30, "name": "王五"},
    ]
    conn = _make_conn(same_store=[], cross_store=cross_store, new_staff_id=999)

    staff_id, was_auto = await resolve_staff_with_autocreate(
        raw_name="王五", factory_id="F001", store_id=10, conn=conn,
    )

    assert staff_id == 999
    assert was_auto is True
    # dim_staff INSERT happened
    conn.fetchval.assert_awaited_once()
    # admin queue INSERT happened
    conn.execute.assert_awaited_once()
    admin_sql = conn.execute.await_args.args[0]
    assert "entity_resolution_admin_queue" in admin_sql
    assert "cross_store_heuristic" in admin_sql
    # candidate_entity_id is the newly created id
    args = conn.execute.await_args.args
    assert args[1] == "F001"          # factory_id
    assert args[2] == "王五"           # raw_name
    assert args[3] == 999             # candidate_entity_id (new staff)
    # JSON dropped_row_refs is list-of-dicts per V20260426_01 column comment
    import json
    payload = json.loads(args[4])
    assert payload == [
        {"candidate_staff_id": 100, "store_id": None},
        {"candidate_staff_id": 101, "store_id": None},
    ]


async def test_cross_store_with_different_name_no_admin_queue():
    """cross_store rows present but normalized name differs → no admin queue, just autocreate."""
    cross_store = [
        {"staff_id": 100, "store_id": 20, "name": "李四"},
    ]
    conn = _make_conn(same_store=[], cross_store=cross_store, new_staff_id=777)

    staff_id, was_auto = await resolve_staff_with_autocreate(
        raw_name="王五", factory_id="F001", store_id=10, conn=conn,
    )

    assert staff_id == 777
    assert was_auto is True
    conn.fetchval.assert_awaited_once()
    # No admin queue insert because no matching cross-store name
    conn.execute.assert_not_awaited()
