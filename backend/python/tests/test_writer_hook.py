"""Unit tests for smartbi.canonical.provenance._writer_hook.

Covers env flag (is_provenance_enabled) and the batch helper
(write_provenance_for_fields). resolve_conflict is patched so we can verify
hook behaviour without real PG.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.provenance._writer_hook import (
    invalidate_provenance_flag_cache,
    is_provenance_enabled,
    write_provenance_for_fields,
)


def _make_conn_with_transaction() -> AsyncMock:
    """Build an AsyncMock conn whose ``conn.transaction()`` works as a CM.

    The hook now wraps each ``resolve_conflict`` call in
    ``async with conn.transaction()`` (I7 SAVEPOINT). Plain ``AsyncMock()``
    returns awaitables for arbitrary attributes, but ``transaction()`` needs
    to be a regular MagicMock returning an object with ``__aenter__`` /
    ``__aexit__`` coroutines.
    """
    conn = AsyncMock()
    tx_ctx = MagicMock()
    tx_ctx.__aenter__ = AsyncMock(return_value=None)
    tx_ctx.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx_ctx)
    return conn


@pytest.fixture(autouse=True)
def _clear_env_cache():
    """Each test starts with the SMARTBI_ENABLE_PROVENANCE cache cleared.

    Because :func:`is_provenance_enabled` is ``@functools.cache``-wrapped
    (I4 fix), monkeypatch.setenv alone won't change its return value once
    the cache is populated. Clear before AND after so tests can flip the
    env freely without leaking state to later tests.
    """
    invalidate_provenance_flag_cache()
    yield
    invalidate_provenance_flag_cache()


# ── is_provenance_enabled ───────────────────────────────────────────────────


def test_is_enabled_default_off(monkeypatch):
    """Unset env flag → disabled (default safety)."""
    monkeypatch.delenv("SMARTBI_ENABLE_PROVENANCE", raising=False)
    assert is_provenance_enabled() is False


@pytest.mark.parametrize("val", ["1", "true", "TRUE", "yes", "YES", "on", "On"])
def test_is_enabled_truthy_strings(monkeypatch, val):
    """1 / true / yes / on (case-insensitive) → enabled."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", val)
    invalidate_provenance_flag_cache()
    assert is_provenance_enabled() is True


@pytest.mark.parametrize("val", ["0", "false", "no", "off", "", "  ", "random"])
def test_is_enabled_falsy_strings(monkeypatch, val):
    """0 / false / no / off / empty / unknown → disabled."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", val)
    invalidate_provenance_flag_cache()
    assert is_provenance_enabled() is False


def test_is_enabled_strips_whitespace(monkeypatch):
    """Leading/trailing whitespace tolerated."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "  1  ")
    invalidate_provenance_flag_cache()
    assert is_provenance_enabled() is True


# ── I4: env-var caching ─────────────────────────────────────────────────────


def test_is_enabled_caches_env_read(monkeypatch):
    """First call reads env; subsequent calls reuse the cached value.

    Mid-run flag flips MUST NOT change behaviour for the live process —
    only a process restart (or explicit cache invalidation) picks up the
    new value. This guards against partial-batch surprises.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")
    assert is_provenance_enabled() is True

    # Flip the env mid-process. Without I4 cache this would flip the
    # function output on the next call — with the cache it sticks.
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "0")
    assert is_provenance_enabled() is True  # still cached as True


def test_invalidate_provenance_flag_cache_re_reads(monkeypatch):
    """invalidate_provenance_flag_cache() forces the next call to re-read env."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")
    assert is_provenance_enabled() is True

    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "0")
    invalidate_provenance_flag_cache()
    assert is_provenance_enabled() is False


# ── write_provenance_for_fields ─────────────────────────────────────────────


_RESOLVE_PATH = "smartbi.canonical.provenance.conflict_resolver.resolve_conflict"


@pytest.mark.asyncio
async def test_skips_none_values_and_counts_them():
    """None values skipped without calling resolve_conflict, but counted."""
    fields = {"revenue": 100.0, "qty_sold": None, "avg_unit_price": 10.0}
    with patch(_RESOLVE_PATH, new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = {"action": "written", "id": 1, "reason": "ok"}
        result = await write_provenance_for_fields(
            conn=_make_conn_with_transaction(),
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
            conn=_make_conn_with_transaction(),
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
            conn=_make_conn_with_transaction(),
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
async def test_swallows_recoverable_asyncpg_exception_per_field(caplog):
    """Recoverable asyncpg errors (UniqueViolation et al.) swallowed per field.

    Per I5 narrowing: the hook now swallows ONLY the four recoverable
    asyncpg exceptions. Each failure is logged WARNING and counted under
    ``error_swallowed`` so monitoring can alarm on a non-zero rate.
    """
    import asyncpg
    import logging

    fields = {"good": 1.0, "bad": 2.0, "also_good": 3.0}

    async def fake_resolve(conn, **kwargs):
        if kwargs["field_name"] == "bad":
            # Build a UniqueViolationError without going through PG. asyncpg's
            # error classes accept a no-arg construction.
            raise asyncpg.UniqueViolationError("simulated dedup collision")
        return {"action": "written", "id": 1, "reason": "ok"}

    with patch(_RESOLVE_PATH, side_effect=fake_resolve):
        with caplog.at_level(logging.WARNING):
            result = await write_provenance_for_fields(
                conn=_make_conn_with_transaction(),
                factory_id="F001",
                entity_type="product",
                entity_id=1,
                fields=fields,
                source_type="product_summary",
                mapper_method="rule",
                confidence=0.85,
            )
    # 2 succeeded, the bad one swallowed (counted under error_swallowed).
    assert result["written"] == 2
    assert result["error_swallowed"] == 1
    # Warning logged for the failing field.
    assert any(
        "provenance write failed (recoverable)" in r.message for r in caplog.records
    )
    assert any("bad" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_propagates_non_swallowable_exception():
    """Non-asyncpg / non-recoverable errors must escape the hook.

    Per I5: ``RLSPolicyViolationError``, ``OSError``, programming bugs etc.
    should NOT be silently logged — they indicate misconfiguration that
    operations needs to see.
    """
    fields = {"good": 1.0, "bad": 2.0}

    async def fake_resolve(conn, **kwargs):
        if kwargs["field_name"] == "bad":
            raise OSError("simulated network glitch")
        return {"action": "written", "id": 1, "reason": "ok"}

    with patch(_RESOLVE_PATH, side_effect=fake_resolve):
        with pytest.raises(OSError, match="simulated network glitch"):
            await write_provenance_for_fields(
                conn=_make_conn_with_transaction(),
                factory_id="F001",
                entity_type="product",
                entity_id=1,
                fields=fields,
                source_type="product_summary",
                mapper_method="rule",
                confidence=0.85,
            )


@pytest.mark.asyncio
async def test_uses_per_field_savepoint():
    """I7 fix: each resolve_conflict is wrapped in conn.transaction() (SAVEPOINT).

    Verifies that the hook calls ``conn.transaction()`` once per non-None
    field (asyncpg auto-promotes nested transactions to SAVEPOINTs).
    """
    fields = {"f1": 1.0, "f2": 2.0, "f3": None}

    conn = _make_conn_with_transaction()
    with patch(_RESOLVE_PATH, new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = {"action": "written", "id": 1, "reason": "ok"}
        await write_provenance_for_fields(
            conn=conn,
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            fields=fields,
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
        )
    # f1 + f2 = 2 transactions; f3 (None) is skipped before the SAVEPOINT.
    assert conn.transaction.call_count == 2


@pytest.mark.asyncio
async def test_empty_fields_dict_returns_zero_counts():
    """Empty fields dict → resolve_conflict never called, counts all zero."""
    with patch(_RESOLVE_PATH, new_callable=AsyncMock) as mock_resolve:
        result = await write_provenance_for_fields(
            conn=_make_conn_with_transaction(),
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
        "error_swallowed": 0,
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
            conn=_make_conn_with_transaction(),
            factory_id="F001",
            entity_type="product",
            entity_id=1,
            fields=fields,
            source_type="product_summary",
            mapper_method="rule",
            confidence=0.85,
        )
    assert result["weird_new_action"] == 1
