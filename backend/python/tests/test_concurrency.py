"""Unit tests for concurrency.with_factory_serialization 3-layer defense."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical import concurrency
from smartbi.canonical.concurrency import (
    _factory_lock_key,
    _peek_factory_locks,
    cleanup_factory_lock,
    with_factory_serialization,
)


def _make_mock_conn():
    """Mock asyncpg.Connection with transaction() context manager + execute."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=None)
    txn = MagicMock()
    txn.__aenter__ = AsyncMock(return_value=None)
    txn.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=txn)
    return conn


@pytest.fixture(autouse=True)
def _isolate_lock_registry():
    """Reset the module-level _factory_locks before each test."""
    concurrency._factory_locks.clear()
    yield
    concurrency._factory_locks.clear()


@pytest.fixture(autouse=True)
def _stub_clear_cache(monkeypatch):
    """Replace dim_resolver.clear_cache with a Mock so tests can assert on it."""
    mock = MagicMock()
    monkeypatch.setattr("smartbi.canonical.dim_resolver.clear_cache", mock)
    return mock


# --- 1. Same factory serializes ----------------------------------------


async def test_factory_lock_serializes_same_factory():
    """Two concurrent calls on same factory_id execute serially, not interleaved."""
    timeline = []

    async def slow_work(label, conn):
        timeline.append(f"{label}:enter")
        await asyncio.sleep(0.05)
        timeline.append(f"{label}:exit")
        return label

    async def call(label):
        conn = _make_mock_conn()
        return await with_factory_serialization(
            "F1", conn, lambda c: slow_work(label, c),
        )

    results = await asyncio.gather(call("A"), call("B"))
    assert set(results) == {"A", "B"}
    # Serialized: enter→exit pairs do not interleave
    # Either: A:enter, A:exit, B:enter, B:exit OR B:enter, B:exit, A:enter, A:exit
    assert timeline[0].endswith(":enter")
    assert timeline[1].endswith(":exit")
    assert timeline[0].split(":")[0] == timeline[1].split(":")[0]
    assert timeline[2].endswith(":enter")
    assert timeline[3].endswith(":exit")
    assert timeline[2].split(":")[0] == timeline[3].split(":")[0]


# --- 2. Different factories run in parallel ----------------------------


async def test_factory_lock_parallelizes_different_factories():
    """F1 and F2 can interleave (no shared lock)."""
    timeline = []

    async def slow_work(label, conn):
        timeline.append(f"{label}:enter")
        await asyncio.sleep(0.05)
        timeline.append(f"{label}:exit")
        return label

    async def call(factory_id, label):
        conn = _make_mock_conn()
        return await with_factory_serialization(
            factory_id, conn, lambda c: slow_work(label, c),
        )

    start = asyncio.get_event_loop().time()
    results = await asyncio.gather(call("F1", "A"), call("F2", "B"))
    elapsed = asyncio.get_event_loop().time() - start
    assert set(results) == {"A", "B"}
    # If serialized → ~0.10s; parallel → ~0.05s. Allow generous margin.
    assert elapsed < 0.09, f"Different factories should run in parallel (took {elapsed:.3f}s)"


# --- 3. Advisory xact lock invoked -------------------------------------


async def test_advisory_xact_lock_called():
    """conn.execute('SELECT pg_advisory_xact_lock($1)', key) called inside transaction."""
    conn = _make_mock_conn()

    async def work(c):
        return "ok"

    result = await with_factory_serialization("F1", conn, work)
    assert result == "ok"

    # Verify pg_advisory_xact_lock was called
    advisory_calls = [
        c for c in conn.execute.await_args_list
        if "pg_advisory_xact_lock" in c.args[0]
    ]
    assert len(advisory_calls) == 1
    # Second positional arg = the int4 lock key
    assert advisory_calls[0].args[1] == _factory_lock_key("F1")
    # Transaction was started
    conn.transaction.assert_called_once()


# --- 4. clear_cache called after success -------------------------------


async def test_dim_cache_cleared_after_work(_stub_clear_cache):
    """clear_cache(factory_id) called after work succeeds."""
    conn = _make_mock_conn()

    async def work(c):
        return "ok"

    await with_factory_serialization("F1", conn, work)
    _stub_clear_cache.assert_called_once_with("F1")


# --- 5. clear_cache called even on error -------------------------------


async def test_dim_cache_cleared_even_on_error(_stub_clear_cache):
    """work raises → clear_cache still called via finally; exception re-raised."""
    conn = _make_mock_conn()

    async def boom(c):
        raise RuntimeError("explosion")

    with pytest.raises(RuntimeError, match="explosion"):
        await with_factory_serialization("F1", conn, boom)
    _stub_clear_cache.assert_called_once_with("F1")


# --- 6. Lock key stable + distinct -------------------------------------


def test_factory_lock_key_stable():
    """Same factory_id → same int4 key. Different IDs → (almost certainly) different keys."""
    assert _factory_lock_key("F1") == _factory_lock_key("F1")
    assert _factory_lock_key("F1") != _factory_lock_key("F2")
    # Range check: must fit signed int4 (Postgres advisory lock takes int4 or int8)
    key = _factory_lock_key("anything")
    assert 0 <= key < 2**31


# --- 7. cleanup_factory_lock removes registry entry ---------------------


async def test_cleanup_factory_lock_removes_entry():
    """After with_factory_serialization, F1 is in registry; cleanup removes it."""
    conn = _make_mock_conn()

    async def work(c):
        return None

    await with_factory_serialization("F1", conn, work)
    assert "F1" in _peek_factory_locks()

    cleanup_factory_lock("F1")
    assert "F1" not in _peek_factory_locks()

    # Cleaning up a non-existent factory is a no-op
    cleanup_factory_lock("NEVER_SEEN")  # must not raise


# --- 8. Empty factory_id raises ----------------------------------------


async def test_empty_factory_id_raises():
    """Empty factory_id → ValueError before any lock work happens."""
    conn = _make_mock_conn()

    async def work(c):
        return "should not run"

    with pytest.raises(ValueError, match="factory_id required"):
        await with_factory_serialization("", conn, work)
    # No transaction started, no execute called
    conn.transaction.assert_not_called()


# --- Bonus: work receives the conn passed in ---------------------------


async def test_work_receives_conn():
    """work callable receives the same conn object as its argument."""
    conn = _make_mock_conn()
    captured = {}

    async def work(c):
        captured["conn"] = c
        return "done"

    result = await with_factory_serialization("F1", conn, work)
    assert result == "done"
    assert captured["conn"] is conn
