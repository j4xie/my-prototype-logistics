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
    """Passing as_of adds a valid_from <= $5 clause and binds the date."""
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
    assert bound_args == ("F001", "store", 1, "name", cutoff)


async def test_read_authoritative_value_omits_as_of_clause_by_default():
    """No as_of → no $5 placeholder, only the 4 base params."""
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
    assert "valid_from <=" not in sql_arg
    assert bound_args == ("F001", "store", 1, "name")
