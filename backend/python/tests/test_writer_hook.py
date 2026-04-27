"""Unit tests for smartbi.canonical.provenance._writer_hook.

Covers env flag (is_provenance_enabled) and the batch helper
(write_provenance_for_fields). resolve_conflict is patched so we can verify
hook behaviour without real PG.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from smartbi.canonical.provenance._writer_hook import (
    is_provenance_enabled,
    write_provenance_for_fields,
)


# ── is_provenance_enabled ───────────────────────────────────────────────────


def test_is_enabled_default_off(monkeypatch):
    """Unset env flag → disabled (default safety)."""
    monkeypatch.delenv("SMARTBI_ENABLE_PROVENANCE", raising=False)
    assert is_provenance_enabled() is False


@pytest.mark.parametrize("val", ["1", "true", "TRUE", "yes", "YES", "on", "On"])
def test_is_enabled_truthy_strings(monkeypatch, val):
    """1 / true / yes / on (case-insensitive) → enabled."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", val)
    assert is_provenance_enabled() is True


@pytest.mark.parametrize("val", ["0", "false", "no", "off", "", "  ", "random"])
def test_is_enabled_falsy_strings(monkeypatch, val):
    """0 / false / no / off / empty / unknown → disabled."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", val)
    assert is_provenance_enabled() is False


def test_is_enabled_strips_whitespace(monkeypatch):
    """Leading/trailing whitespace tolerated."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "  1  ")
    assert is_provenance_enabled() is True


# ── write_provenance_for_fields ─────────────────────────────────────────────


_RESOLVE_PATH = "smartbi.canonical.provenance.conflict_resolver.resolve_conflict"


@pytest.mark.asyncio
async def test_skips_none_values_and_counts_them():
    """None values skipped without calling resolve_conflict, but counted."""
    fields = {"revenue": 100.0, "qty_sold": None, "avg_unit_price": 10.0}
    with patch(_RESOLVE_PATH, new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = {"action": "written", "id": 1, "reason": "ok"}
        result = await write_provenance_for_fields(
            conn=AsyncMock(),
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            fields=fields,
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
        )
    assert result["skipped_null"] == 1
    assert result["written"] == 2
    assert mock_resolve.await_count == 2


@pytest.mark.asyncio
async def test_writes_each_non_none_field():
    """Each non-None field calls resolve_conflict with the field's value."""
    fields = {"revenue": 100.0, "qty_sold": 5}
    with patch(_RESOLVE_PATH, new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = {"action": "written", "id": 1, "reason": "ok"}
        await write_provenance_for_fields(
            conn=AsyncMock(),
            factory_id="F001",
            entity_type="product",
            entity_id=42,
            fields=fields,
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
            source_upload_id=99,
            valid_from=date(2026, 1, 1),
            valid_to=date(2026, 12, 31),
        )
    # Check both calls were made with correct args
    assert mock_resolve.await_count == 2
    call_kwargs_list = [call.kwargs for call in mock_resolve.await_args_list]
    field_names = sorted(call.get("field_name") for call in call_kwargs_list)
    assert field_names == ["qty_sold", "revenue"]
    for kwargs in call_kwargs_list:
        assert kwargs["factory_id"] == "F001"
        assert kwargs["entity_type"] == "product"
        assert kwargs["entity_id"] == 42
        assert kwargs["source_type"] == "product_summary"
        assert kwargs["mapper_method"] == "rule"
        assert kwargs["confidence"] == 0.85
        assert kwargs["source_upload_id"] == 99
        assert kwargs["valid_from"] == date(2026, 1, 1)
        assert kwargs["valid_to"] == date(2026, 12, 31)


@pytest.mark.asyncio
async def test_returns_counter_dict_with_all_actions():
    """Counter dict aggregates 'written', 'queued', 'no_change', 'skipped_null'."""
    fields = {"f_w": "a", "f_q": "b", "f_nc": "c", "f_n": None}
    actions = {"f_w": "written", "f_q": "queued", "f_nc": "no_change"}

    async def fake_resolve(conn, **kwargs):
        return {"action": actions[kwargs["field_name"]], "id": None, "reason": "x"}

    with patch(_RESOLVE_PATH, side_effect=fake_resolve):
        result = await write_provenance_for_fields(
            conn=AsyncMock(),
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            fields=fields,
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
        )
    assert result["written"] == 1
    assert result["queued"] == 1
    assert result["no_change"] == 1
    assert result["skipped_null"] == 1


@pytest.mark.asyncio
async def test_swallows_exceptions_per_field(caplog):
    """If resolve_conflict raises for one field, other fields still written.

    The hook must NOT propagate provenance errors — they cannot block the
    Silver write itself. Each failure is logged at WARNING level.
    """
    import logging

    fields = {"good": 1.0, "bad": 2.0, "also_good": 3.0}

    async def fake_resolve(conn, **kwargs):
        if kwargs["field_name"] == "bad":
            raise RuntimeError("simulated PG error")
        return {"action": "written", "id": 1, "reason": "ok"}

    with patch(_RESOLVE_PATH, side_effect=fake_resolve):
        with caplog.at_level(logging.WARNING):
            result = await write_provenance_for_fields(
                conn=AsyncMock(),
                factory_id="F001",
                entity_type="product",
                entity_id=1,
                fields=fields,
                source_type="product_summary",
                mapper_method="rule",
                confidence=0.85,
            )
    # 2 succeeded, the bad one swallowed (not counted as written/queued/etc).
    assert result["written"] == 2
    # Warning logged for the failing field.
    assert any("provenance write failed" in r.message for r in caplog.records)
    assert any("bad" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_empty_fields_dict_returns_zero_counts():
    """Empty fields dict → resolve_conflict never called, counts all zero."""
    with patch(_RESOLVE_PATH, new_callable=AsyncMock) as mock_resolve:
        result = await write_provenance_for_fields(
            conn=AsyncMock(),
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            fields={},
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
        )
    assert result == {
        "written": 0,
        "queued": 0,
        "no_change": 0,
        "skipped_null": 0,
    }
    assert mock_resolve.await_count == 0


@pytest.mark.asyncio
async def test_unknown_action_increments_dynamic_key():
    """If resolve_conflict returns an unexpected action, counter still tracks it.

    Defensive coding — guards against future resolve_conflict additions
    (e.g. 'deferred' or 'skipped') silently being lost.
    """
    fields = {"f1": "x"}

    async def fake_resolve(conn, **kwargs):
        return {"action": "weird_new_action", "id": None, "reason": "x"}

    with patch(_RESOLVE_PATH, side_effect=fake_resolve):
        result = await write_provenance_for_fields(
            conn=AsyncMock(),
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            fields=fields,
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
        )
    assert result["weird_new_action"] == 1
