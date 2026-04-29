"""RLS isolation integration test — proves tenant_ctx + pool setup +
PostgreSQL RLS policy together prevent tenant A from seeing tenant B's rows.

Week 1 Day 2 of Unified Data Layer v1 spec (§6).

Uses `tenant_rls_smoke` table (see migration
smartbi/database/migrations/2026_04_22_tenant_rls_smoke.sql). That table's
RLS policy is identical to what future Silver tables will use.

Contract verified here:
1. Writer sets factory_id = A, inserts rows with factory_id = A → success
2. Writer sets factory_id = A, tries to insert row with factory_id = B →
   blocked by WITH CHECK (row visibility = write authority)
3. Reader sets factory_id = A → sees only A rows, not B rows
4. Reader without factory_id set → sees 0 rows (safe default, not error)
5. Multiple acquires with different factory_ids don't leak across
   connection reuse in the pool
"""
from __future__ import annotations

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    p = await asyncpg.create_pool(
        settings.postgres_url,
        min_size=1,
        max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def clean_smoke_rows(pool):
    """Clean up any leftover smoke rows from prior runs. Uses an admin
    path (no factory scope) to delete unconditionally — via a raw
    connection that bypasses the pool setup by not running through it.
    """
    # Temporarily disable RLS to clean — DB owner can ALTER but we avoid
    # surprises by just deleting within a broad scope.
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    for fid in ("TEST_RLS_A", "TEST_RLS_B"):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM tenant_rls_smoke WHERE factory_id = $1",
                    fid,
                )
        finally:
            reset_factory_id(token)
    yield


@pytest.mark.asyncio
async def test_writer_can_insert_own_factory_rows(pool, clean_smoke_rows):
    """factory_id=A writer inserts 2 rows marked A — all visible to same tenant."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO tenant_rls_smoke (factory_id, label) VALUES ($1, $2), ($1, $3)",
                "TEST_RLS_A", "A-row-1", "A-row-2",
            )
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM tenant_rls_smoke"
            )
        assert count == 2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_writer_blocked_from_inserting_other_factory_rows(pool, clean_smoke_rows):
    """factory=A writer tries to insert a row tagged factory_id=B →
    WITH CHECK policy blocks with InsufficientPrivilege-like error."""
    import asyncpg.exceptions
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            # PostgreSQL raises InsufficientPrivilegeError for WITH CHECK
            # policy violations on INSERT/UPDATE (SQLSTATE 42501).
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError) as exc_info:
                await conn.execute(
                    "INSERT INTO tenant_rls_smoke (factory_id, label) VALUES ($1, $2)",
                    "TEST_RLS_B", "A-pretending-to-be-B",
                )
            # Check SQLSTATE, not message text — PG locale varies by install.
            assert exc_info.value.sqlstate == "42501"
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_reader_sees_only_own_factory_rows(pool, clean_smoke_rows):
    """Seed rows for A and B via separate scoped inserts.
    Verify A reader sees only A rows, B reader sees only B rows."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    # Seed A
    token_a = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO tenant_rls_smoke (factory_id, label) VALUES ($1,'A-secret'), ($1,'A-also')",
                "TEST_RLS_A",
            )
    finally:
        reset_factory_id(token_a)

    # Seed B
    token_b = set_factory_id("TEST_RLS_B")
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO tenant_rls_smoke (factory_id, label) VALUES ($1,'B-secret')",
                "TEST_RLS_B",
            )
    finally:
        reset_factory_id(token_b)

    # Read as A — should see exactly 2 rows
    token_a = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT label FROM tenant_rls_smoke ORDER BY label")
        labels = [r["label"] for r in rows]
    finally:
        reset_factory_id(token_a)
    assert labels == ["A-also", "A-secret"]

    # Read as B — should see exactly 1 row
    token_b = set_factory_id("TEST_RLS_B")
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT label FROM tenant_rls_smoke ORDER BY label")
        labels = [r["label"] for r in rows]
    finally:
        reset_factory_id(token_b)
    assert labels == ["B-secret"]


@pytest.mark.asyncio
async def test_reader_without_factory_sees_zero_rows(pool, clean_smoke_rows):
    """No factory_id set = INTERNAL sentinel. tenant_rls_smoke has no
    rows with factory_id = '__internal__' → reader sees 0 rows, NOT
    all rows, NOT an error. Safe default."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    # Seed as A
    token_a = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO tenant_rls_smoke (factory_id, label) VALUES ($1,'A-data')",
                "TEST_RLS_A",
            )
    finally:
        reset_factory_id(token_a)

    # Read WITHOUT setting tenant — defaults to __internal__
    # Do NOT use set_factory_id here (leave default None → INTERNAL sentinel)
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT label FROM tenant_rls_smoke")
    assert rows == []  # zero rows — policy mismatch


@pytest.mark.asyncio
async def test_cross_acquire_tenant_isolation(pool, clean_smoke_rows):
    """Two separate acquire() calls with different tenants on the same
    pool must not leak state — even if the pool happens to hand out the
    same underlying connection. The setup callback must re-run each time.
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    # Seed
    for fid, labels in (("TEST_RLS_A", ["A1", "A2"]), ("TEST_RLS_B", ["B1"])):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                for lbl in labels:
                    await conn.execute(
                        "INSERT INTO tenant_rls_smoke (factory_id, label) VALUES ($1, $2)",
                        fid, lbl,
                    )
        finally:
            reset_factory_id(token)

    # Interleaved reads
    token = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            n_a_1 = await conn.fetchval("SELECT COUNT(*) FROM tenant_rls_smoke")
    finally:
        reset_factory_id(token)

    token = set_factory_id("TEST_RLS_B")
    try:
        async with pool.acquire() as conn:
            n_b = await conn.fetchval("SELECT COUNT(*) FROM tenant_rls_smoke")
    finally:
        reset_factory_id(token)

    # Back to A
    token = set_factory_id("TEST_RLS_A")
    try:
        async with pool.acquire() as conn:
            n_a_2 = await conn.fetchval("SELECT COUNT(*) FROM tenant_rls_smoke")
    finally:
        reset_factory_id(token)

    assert n_a_1 == 2
    assert n_b == 1
    assert n_a_2 == 2  # unchanged by B's intervening query
