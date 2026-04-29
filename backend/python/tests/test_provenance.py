"""Unit tests for smartbi.canonical.provenance — types + writer."""
from __future__ import annotations

import dataclasses
from datetime import date
from unittest.mock import AsyncMock

import pytest

from smartbi.canonical.provenance import (
    ProvenanceValue,
    read_authoritative_value,
    write_provenance,
)


def _make_conn_mock(fetchval_return: int = 1) -> AsyncMock:
    """Build an AsyncMock conn with execute() + fetchval() both awaitable.

    write_provenance now calls conn.execute() (advisory lock) before
    conn.fetchval() (INSERT), so tests must mock both. Default AsyncMock
    instances return another AsyncMock for any attribute access, but using
    explicit AsyncMock() for each method keeps await_args inspection
    behaving as the existing tests expect.
    """
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=fetchval_return)
    return conn


# ── ProvenanceValue.from_row ────────────────────────────────────


def test_provenance_value_from_row_minimal():
    """from_row builds a ProvenanceValue from a complete asyncpg row dict."""
    row = {
        "field_value": "some-value",
        "confidence": 0.85,
        "source_upload_id": 17,
        "source_type": "pos_excel",
        "mapper_method": "rule",
        "valid_from": date(2025, 1, 1),
        "valid_to": date(2025, 12, 31),
        "notes": "imported from xmx",
    }
    pv = ProvenanceValue.from_row(row)
    assert pv.field_value == "some-value"
    assert pv.confidence == 0.85
    assert pv.source_upload_id == 17
    assert pv.source_type == "pos_excel"
    assert pv.mapper_method == "rule"
    assert pv.valid_from == date(2025, 1, 1)
    assert pv.valid_to == date(2025, 12, 31)
    assert pv.notes == "imported from xmx"


def test_provenance_value_from_row_handles_infinity_date():
    """Non-date sentinel objects on valid_from/valid_to coerce to None (NC-2)."""

    class _InfinitySentinel:
        """Stand-in for whatever object asyncpg returns for '-infinity'."""

    row = {
        "field_value": 42,
        "confidence": 1.0,
        "source_upload_id": 0,
        "source_type": "manual",
        "mapper_method": "manual",
        "valid_from": _InfinitySentinel(),
        "valid_to": _InfinitySentinel(),
        "notes": None,
    }
    pv = ProvenanceValue.from_row(row)
    assert pv.valid_from is None
    assert pv.valid_to is None
    # Other fields still populate normally.
    assert pv.confidence == 1.0
    assert pv.source_upload_id == 0


def test_provenance_value_from_row_default_upload_id_zero():
    """source_upload_id missing or None coerces to sentinel 0."""
    row = {
        "field_value": "x",
        "confidence": 0.5,
        "source_upload_id": None,
        "source_type": "inferred",
        "mapper_method": "llm",
        "valid_from": None,
        "valid_to": None,
    }
    pv = ProvenanceValue.from_row(row)
    assert pv.source_upload_id == 0
    assert pv.notes is None


def test_provenance_value_frozen():
    """ProvenanceValue is frozen — assignment raises FrozenInstanceError."""
    pv = ProvenanceValue(
        field_value="v",
        confidence=0.9,
        source_upload_id=1,
        source_type="pos_excel",
        mapper_method="rule",
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        pv.confidence = 0.5  # type: ignore[misc]


# ── write_provenance: validation ────────────────────────────────


async def test_write_provenance_validates_factory_id():
    conn = AsyncMock()
    with pytest.raises(ValueError, match="factory_id"):
        await write_provenance(
            conn,
            factory_id="",
            entity_type="store",
            entity_id=1,
            field_name="name",
            field_value="x",
            confidence=0.9,
            source_type="pos_excel",
            mapper_method="rule",
        )
    conn.fetchval.assert_not_called()


async def test_write_provenance_validates_entity_type():
    conn = AsyncMock()
    with pytest.raises(ValueError, match="entity_type"):
        await write_provenance(
            conn,
            factory_id="F001",
            entity_type="",
            entity_id=1,
            field_name="name",
            field_value="x",
            confidence=0.9,
            source_type="pos_excel",
            mapper_method="rule",
        )


async def test_write_provenance_validates_confidence_range():
    conn = AsyncMock()
    with pytest.raises(ValueError, match="confidence"):
        await write_provenance(
            conn,
            factory_id="F001",
            entity_type="store",
            entity_id=1,
            field_name="name",
            field_value="x",
            confidence=1.5,
            source_type="pos_excel",
            mapper_method="rule",
        )
    with pytest.raises(ValueError, match="confidence"):
        await write_provenance(
            conn,
            factory_id="F001",
            entity_type="store",
            entity_id=1,
            field_name="name",
            field_value="x",
            confidence=-0.1,
            source_type="pos_excel",
            mapper_method="rule",
        )


async def test_write_provenance_validates_mapper_method():
    conn = AsyncMock()
    with pytest.raises(ValueError, match="mapper_method"):
        await write_provenance(
            conn,
            factory_id="F001",
            entity_type="store",
            entity_id=1,
            field_name="name",
            field_value="x",
            confidence=0.9,
            source_type="pos_excel",
            mapper_method="bogus",
        )


# ── write_provenance: behavior ──────────────────────────────────


async def test_write_provenance_serializes_dict_field_value():
    """dict field_value is JSON-serialized before being passed to fetchval."""
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=7)

    new_id = await write_provenance(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=1,
        field_name="address",
        field_value={"city": "上海", "zip": "200000"},
        confidence=0.8,
        source_type="pos_excel",
        mapper_method="embedding",
    )

    assert new_id == 7
    # fetchval(sql, *params): args[0]=sql, args[1..N]=params. field_value JSON
    # is the 5th SQL placeholder ($5) → args[5].
    args = conn.fetchval.await_args.args
    json_arg = args[5]
    assert "上海" in json_arg
    assert "city" in json_arg
    # ensure_ascii=False keeps Chinese characters readable.
    assert "\\u" not in json_arg


async def test_write_provenance_default_upload_id_is_sentinel():
    """Omitting source_upload_id defaults to sentinel 0."""
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1)

    await write_provenance(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=1,
        field_name="name",
        field_value="x",
        confidence=1.0,  # confirms NC-1: NUMERIC(5,4) accepts 1.0
        source_type="manual",
        mapper_method="manual",
    )

    # fetchval(sql, *params): args[0]=sql, args[1..]=params.
    # SQL $6 maps to args[6] → source_upload_id.
    args = conn.fetchval.await_args.args
    assert args[6] == 0


async def test_write_provenance_passes_explicit_upload_id():
    """source_upload_id=42 is forwarded verbatim, not replaced with sentinel."""
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=99)

    await write_provenance(
        conn,
        factory_id="F001",
        entity_type="product",
        entity_id=2,
        field_name="cost",
        field_value=12.5,
        confidence=0.7,
        source_type="pos_excel",
        mapper_method="rule",
        source_upload_id=42,
    )
    assert conn.fetchval.await_args.args[6] == 42


async def test_write_provenance_returns_inserted_id():
    """fetchval result is returned as int."""
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=42)

    new_id = await write_provenance(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=10,
        field_name="rating",
        field_value=4.5,
        confidence=0.95,
        source_type="review",
        mapper_method="rule",
    )
    assert new_id == 42
    conn.fetchval.assert_awaited_once()


async def test_write_provenance_acquires_advisory_lock_before_insert():
    """Day 6+ blocker fix (spec C-3 / NS-3): write_provenance MUST acquire
    pg_advisory_xact_lock with namespace=99 (C field-conflict reserved)
    BEFORE the INSERT. Race-on-dedup-key serializes at the PG layer.
    """
    conn = _make_conn_mock(fetchval_return=1)

    await write_provenance(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=1,
        field_name="brand",
        field_value="x",
        confidence=0.9,
        source_type="manual",
        mapper_method="manual",
    )

    # The lock must have been executed exactly once.
    conn.execute.assert_awaited_once()
    sql_arg = conn.execute.await_args.args[0]
    bound_args = conn.execute.await_args.args[1:]
    assert "pg_advisory_xact_lock" in sql_arg
    # Namespace=99 reserved for C; second arg is the md5-derived key (just
    # check it's an int — exact value is implementation detail).
    assert bound_args[0] == 99
    assert isinstance(bound_args[1], int)
    assert 0 <= bound_args[1] < 2**31


async def test_write_provenance_lock_key_stable_for_same_inputs():
    """Same (factory, entity_type, entity_id, field_name) produces the same
    lock key on every call — md5-derived, so stable across processes.
    """
    conn1 = _make_conn_mock(fetchval_return=1)
    conn2 = _make_conn_mock(fetchval_return=2)

    for conn in (conn1, conn2):
        await write_provenance(
            conn,
            factory_id="F001",
            entity_type="store",
            entity_id=42,
            field_name="brand",
            field_value="x",
            confidence=0.9,
            source_type="manual",
            mapper_method="manual",
        )

    key1 = conn1.execute.await_args.args[2]
    key2 = conn2.execute.await_args.args[2]
    assert key1 == key2


async def test_write_provenance_lock_key_differs_for_different_fields():
    """Different field_name → different lock key. Two writers on different
    fields of the same entity must NOT serialize against each other.
    """
    conn_a = _make_conn_mock(fetchval_return=1)
    conn_b = _make_conn_mock(fetchval_return=2)

    await write_provenance(
        conn_a,
        factory_id="F001",
        entity_type="store",
        entity_id=42,
        field_name="brand",
        field_value="x",
        confidence=0.9,
        source_type="manual",
        mapper_method="manual",
    )
    await write_provenance(
        conn_b,
        factory_id="F001",
        entity_type="store",
        entity_id=42,
        field_name="city",
        field_value="x",
        confidence=0.9,
        source_type="manual",
        mapper_method="manual",
    )

    key_brand = conn_a.execute.await_args.args[2]
    key_city = conn_b.execute.await_args.args[2]
    assert key_brand != key_city


# ── read_authoritative_value ───────────────────────────────────


async def test_read_authoritative_value_no_match_returns_none():
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)

    pv = await read_authoritative_value(
        conn, factory_id="F001", entity_type="store", entity_id=1, field_name="name"
    )
    assert pv is None


async def test_read_authoritative_value_returns_provenance_object():
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "field_value": "墨鱼圈",
            "confidence": 0.9,
            "source_upload_id": 5,
            "source_type": "pos_excel",
            "mapper_method": "rule",
            "valid_from": date(2025, 1, 1),
            "valid_to": None,
            "notes": None,
        }
    )

    pv = await read_authoritative_value(
        conn,
        factory_id="F001",
        entity_type="product",
        entity_id=10,
        field_name="name",
    )
    assert pv is not None
    assert pv.field_value == "墨鱼圈"
    assert pv.confidence == 0.9
    assert pv.source_upload_id == 5
    assert pv.valid_from == date(2025, 1, 1)
    assert pv.valid_to is None


async def test_read_authoritative_value_filters_as_of():
    """Passing as_of binds the date for both valid_from <= $5 AND valid_to filters.

    Day 6+ blocker fix: valid_to is now ALWAYS filtered (not gated on
    as_of presence). So even when caller passes as_of explicitly, the
    valid_to clause uses the same date.
    """
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)

    cutoff = date(2025, 6, 1)
    await read_authoritative_value(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=1,
        field_name="name",
        as_of=cutoff,
    )
    sql_arg = conn.fetchrow.await_args.args[0]
    bound_args = conn.fetchrow.await_args.args[1:]
    assert "valid_from <= $5" in sql_arg
    assert "superseded_by_id IS NULL" in sql_arg
    # Both placeholders bind the same cutoff (target_date) — see writer.py
    assert bound_args == ("F001", "store", 1, "name", cutoff, cutoff)


async def test_read_authoritative_value_filters_valid_to():
    """Result must satisfy (valid_to IS NULL OR valid_to >= target_date).

    Day 6+ blocker fix (spec 04-C v1.3 §3.2): without this, a row with
    valid_from=2025-01-01 + valid_to=2025-06-30 would leak into a query
    asking for 2025-12, even though the validity window has expired.
    """
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)

    await read_authoritative_value(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=1,
        field_name="name",
        as_of=date(2025, 12, 1),
    )
    sql_arg = conn.fetchrow.await_args.args[0]
    assert "valid_to IS NULL OR valid_to >=" in sql_arg


async def test_read_authoritative_value_default_as_of_is_today():
    """Omitting as_of binds date.today() to both placeholders.

    Day 6+ blocker fix: valid_to filter is always active. Default as_of
    must be today (not "no filter") so expired rows don't leak just because
    the caller didn't specify a date.
    """
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)

    await read_authoritative_value(
        conn,
        factory_id="F001",
        entity_type="store",
        entity_id=1,
        field_name="name",
    )
    sql_arg = conn.fetchrow.await_args.args[0]
    bound_args = conn.fetchrow.await_args.args[1:]
    # valid_from clause is always present now
    assert "valid_from <= $5" in sql_arg
    assert "valid_to IS NULL OR valid_to >=" in sql_arg
    # 6 params bound: factory/entity_type/entity_id/field_name/today/today
    assert len(bound_args) == 6
    assert bound_args[:4] == ("F001", "store", 1, "name")
    today = date.today()
    assert bound_args[4] == today
    assert bound_args[5] == today
