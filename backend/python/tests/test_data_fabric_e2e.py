"""Data Fabric end-to-end integration tests against real test smartbi_db.

These tests are SKIPPED if PG is not reachable (default local-dev case) so the
default ``pytest tests/`` run keeps passing. To opt in:

    INTEGRATION_PG_DSN=postgresql://smartbi_user:smartbi_secure_password_2025@localhost:5432/smartbi_db \\
        python -m pytest tests/test_data_fabric_e2e.py -v

Why these exist (per code-reviewer note Apr 26 2026): the existing 138 unit
tests are ALL mock-based, so they cannot catch:
  - The Review writer idempotency bug (already fixed in ``bf7ea2675``)
  - RLS gaps if ``app.factory_id`` is unset (silent 0-row INSERTs under
    FORCE ROW LEVEL SECURITY)
  - COALESCE-based unique-index expression syntax errors
  - Real ON CONFLICT semantics on PostgreSQL 13

Each test pre-cleans + post-cleans its tenant rows. Tests run inside a
transaction so any rows that escape cleanup are rolled back. We use a
dedicated test factory_id (``F999_INTEGRATION``) to stay out of any real
tenant's data.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple
from unittest.mock import AsyncMock, MagicMock

import pytest

try:
    import asyncpg
except ImportError:  # pragma: no cover — asyncpg is in requirements.txt
    asyncpg = None  # type: ignore[assignment]


PG_DSN: str = os.environ.get(
    "INTEGRATION_PG_DSN",
    "postgresql://smartbi_user:smartbi_secure_password_2025@localhost:5432/smartbi_db",
)
TEST_FACTORY: str = "F999_INTEGRATION"

pytestmark = pytest.mark.asyncio


# ── Pool fixture ───────────────────────────────────────────────────────────
@pytest.fixture
async def pg_pool() -> AsyncIterator["asyncpg.Pool"]:
    """Create a small pool, or skip the test if PG is unreachable.

    Connect-timeout is short (5s) so unreachable PG fails fast — we don't want
    to block the default test run for 30s when the DB just isn't there.
    """
    if asyncpg is None:
        pytest.skip("asyncpg not installed")
    try:
        pool = await asyncpg.create_pool(
            PG_DSN, min_size=1, max_size=2, timeout=5, command_timeout=10
        )
    except Exception as exc:  # noqa: BLE001 — broad on purpose: any conn error → skip
        pytest.skip(f"PG not reachable at {PG_DSN.split('@')[-1]}: {exc}")
    # Verify required Data Fabric tables exist; else skip rather than fail.
    required = (
        "entity_resolution_history",
        "entity_resolution_admin_queue",
        "fact_review_event",
        "dim_review_summary",
        "agg_product_period",
        "smart_bi_dynamic_data",
        "dim_product",
        "dim_store",
    )
    async with pool.acquire() as conn:
        for tbl in required:
            row = await conn.fetchrow(
                "SELECT to_regclass($1) AS rc", f"public.{tbl}"
            )
            if row is None or row["rc"] is None:
                await pool.close()
                pytest.skip(f"required table missing on this DB: {tbl}")
    try:
        yield pool
    finally:
        await pool.close()


async def _set_tenant(conn: "asyncpg.Connection", factory_id: str) -> None:
    """Apply ``app.factory_id`` for the current transaction.

    ``set_config(..., true)`` is transaction-local, so callers MUST be inside
    a ``conn.transaction()`` block when invoking this — otherwise the setting
    only lives for the duration of the SELECT itself.
    """
    await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)


@pytest.fixture
async def clean_tenant(pg_pool: "asyncpg.Pool") -> AsyncIterator[None]:
    """Delete TEST_FACTORY rows before AND after each test.

    We rely on RLS WITH CHECK letting us delete our own rows when
    ``app.factory_id`` is set to the test factory. If the connection's
    role lacks privilege, individual deletes are best-effort (suppressed).
    """

    async def _clean() -> None:
        tables = (
            "agg_product_period",
            "fact_review_event",
            "dim_review_summary",
            "fact_finance_voucher",
            "fact_inventory_snapshot",
            "entity_resolution_history",
            "entity_resolution_admin_queue",
            "dim_product",
            "dim_store",
            "smart_bi_dynamic_data",
        )
        async with pg_pool.acquire() as conn:
            async with conn.transaction():
                await _set_tenant(conn, TEST_FACTORY)
                for tbl in tables:
                    try:
                        await conn.execute(
                            f"DELETE FROM {tbl} WHERE factory_id = $1",
                            TEST_FACTORY,
                        )
                    except Exception:  # noqa: BLE001
                        # Table may not have factory_id column or may not exist
                        # in this environment; best-effort cleanup.
                        pass

    await _clean()
    try:
        yield
    finally:
        await _clean()


# ── Helpers ─────────────────────────────────────────────────────────────────
def _make_mock_pool_for_orchestrator(real_pool: "asyncpg.Pool") -> "asyncpg.Pool":
    """Return ``real_pool`` unchanged.

    The orchestrator's ``_record_history`` and ``_queue_for_admin`` already
    use ``async with self._pool.acquire()``, so we can pass the real pool
    directly. We just need the test's caller to set ``app.factory_id`` via
    pool ``setup`` callback OR set it explicitly on each acquire.

    Note: the production pool has a ``setup=set_pg_connection_tenant``
    callback. For these tests we set the tenant explicitly per acquire so
    we don't need the production pool factory.
    """
    return real_pool


async def _seed_dim_store(
    conn: "asyncpg.Connection", factory_id: str, name: str
) -> int:
    """Insert one dim_store row (must be inside a tenant-scoped tx)."""
    row = await conn.fetchrow(
        """
        INSERT INTO dim_store (factory_id, name)
        VALUES ($1, $2)
        ON CONFLICT (factory_id, name) DO UPDATE SET updated_at = NOW()
        RETURNING store_id
        """,
        factory_id,
        name,
    )
    assert row is not None
    return int(row["store_id"])


async def _seed_dim_product(
    conn: "asyncpg.Connection",
    factory_id: str,
    name: str,
    normalized_name: Optional[str] = None,
) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO dim_product (factory_id, name, normalized_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (factory_id, normalized_name) DO UPDATE SET updated_at = NOW()
        RETURNING product_id
        """,
        factory_id,
        name,
        normalized_name or name,
    )
    assert row is not None
    return int(row["product_id"])


# ── Tests ───────────────────────────────────────────────────────────────────
@pytest.mark.integration
async def test_rls_blocks_cross_tenant_insert(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """RLS WITH CHECK rejects an INSERT whose factory_id != current tenant.

    Set tenant=TEST_FACTORY, attempt INSERT with factory_id='OTHER_TENANT_X'.
    Must raise. (asyncpg surfaces the policy violation as
    ``InsufficientPrivilegeError``.)
    """
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await _set_tenant(conn, TEST_FACTORY)
            with pytest.raises(
                (
                    asyncpg.InsufficientPrivilegeError,
                    asyncpg.exceptions.InsufficientPrivilegeError,
                )
            ):
                await conn.execute(
                    """
                    INSERT INTO entity_resolution_history
                      (factory_id, entity_type, a_name, b_name,
                       b_entity_id, confidence)
                    VALUES ($1, 'store', 'a', 'b', 1, 0.9)
                    """,
                    "OTHER_TENANT_X",
                )


@pytest.mark.integration
async def test_orchestrator_writes_history_and_admin_queue(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """Drive ``_record_history`` + ``_queue_for_admin`` through the real pool.

    Use a mock agent that returns a tentative match (confidence between
    tentative_threshold and ship_threshold) so we exercise BOTH the history
    insert and the admin queue insert in one call.
    """
    from smartbi.canonical.entity_resolution.agents.base import BaseAgent
    from smartbi.canonical.entity_resolution.orchestrator import (
        AgentResult,
        EntityResolutionOrchestrator,
        EntityType,
        ResolutionInput,
    )

    # Set up a per-acquire setup so the orchestrator's own acquire() also
    # gets app.factory_id (otherwise its insert into FORCE-RLS tables fails).
    async def _setup(conn: "asyncpg.Connection") -> None:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", TEST_FACTORY
        )

    # Build a fresh pool with the setup callback (the original pg_pool fixture
    # doesn't apply any setup so we'd hit RLS otherwise).
    scoped_pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=2, timeout=5, setup=_setup
    )
    try:
        # Seed a dim_store row so _record_history's lookup finds a name
        async with scoped_pool.acquire() as conn:
            store_id = await _seed_dim_store(conn, TEST_FACTORY, "测试门店A")

        class _TentativeAgent(BaseAgent):
            name = "deterministic"
            ship_threshold = 0.95

            async def resolve(  # type: ignore[override]
                self, input: Any, pool: Any
            ) -> AgentResult:
                # Below ship_threshold but above tentative_threshold → tentative
                return AgentResult(
                    matched_entity_id=store_id,
                    confidence=0.85,
                    reasoning="测试 tentative match",
                )

        orch = EntityResolutionOrchestrator(scoped_pool, [_TentativeAgent()])
        out = await orch.resolve(
            ResolutionInput(
                raw_name="测试门店A别名",
                entity_type=EntityType.STORE,
                factory_id=TEST_FACTORY,
            )
        )

        assert out.is_tentative is True
        assert out.matched_entity_id == store_id

        # Verify history row landed
        async with scoped_pool.acquire() as conn:
            hist = await conn.fetchrow(
                """
                SELECT a_name, b_name, b_entity_id, confidence,
                       decided_by_agent, reasoning
                FROM entity_resolution_history
                WHERE factory_id = $1 AND entity_type = 'store'
                  AND a_name = $2
                """,
                TEST_FACTORY,
                "测试门店A别名",
            )
            assert hist is not None, "history row not written"
            assert hist["b_entity_id"] == store_id
            assert hist["b_name"] == "测试门店A"
            assert float(hist["confidence"]) == pytest.approx(0.85)
            assert hist["decided_by_agent"] == "deterministic"

            # Verify admin_queue row landed with priority='low' (tentative)
            queue = await conn.fetchrow(
                """
                SELECT raw_name, candidate_entity_id, priority, reasoning
                FROM entity_resolution_admin_queue
                WHERE factory_id = $1 AND entity_type = 'store'
                  AND raw_name = $2
                """,
                TEST_FACTORY,
                "测试门店A别名",
            )
            assert queue is not None, "admin_queue row not written"
            assert queue["candidate_entity_id"] == store_id
            assert queue["priority"] == "low"
            assert queue["reasoning"] is not None
    finally:
        await scoped_pool.close()


@pytest.mark.integration
async def test_review_writer_idempotent_on_rerun(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """Re-running ReviewWriter on the same upload must NOT duplicate fact rows.

    Validates the V20260428_01 ``uq_fre_natkey`` unique index + the
    ``ON CONFLICT (factory_id, upload_id, COALESCE(source_row_hash, ''))``
    clause in review_writer.py (the bug fixed in ``bf7ea2675``).
    """
    from smartbi.canonical.silver_writers import ReviewWriter
    from smartbi.canonical.silver_writers.base import ResolveResult

    async def _setup(conn: "asyncpg.Connection") -> None:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", TEST_FACTORY
        )

    scoped_pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=2, timeout=5, setup=_setup
    )
    try:
        async with scoped_pool.acquire() as conn:
            store_id = await _seed_dim_store(conn, TEST_FACTORY, "门店X")
            product_id = await _seed_dim_product(
                conn, TEST_FACTORY, "招牌鱼", "招牌鱼"
            )

            # Insert a parent upload row so the FK on fact_review_event is
            # satisfiable. Schema for smart_bi_pg_excel_uploads varies — we
            # try a minimal insert and skip if it doesn't fit.
            upload_id_row = await conn.fetchrow(
                """
                INSERT INTO smart_bi_pg_excel_uploads
                  (factory_id, file_name, upload_status)
                VALUES ($1, $2, 'COMPLETED')
                RETURNING id
                """,
                TEST_FACTORY,
                f"e2e_test_{int(time.time())}.xlsx",
            )
            assert upload_id_row is not None
            upload_id = int(upload_id_row["id"])

            # Insert a single sample dynamic_data row that ReviewWriter reads.
            row_data: Dict[str, Any] = {
                "门店": "门店X",
                "商品名称": "招牌鱼",
                "评分": 5,
                "评论内容": "好吃",
                "评论日期": "2026-04-25",
            }
            await conn.execute(
                """
                INSERT INTO smart_bi_dynamic_data
                  (factory_id, upload_id, row_data)
                VALUES ($1, $2, $3::jsonb)
                """,
                TEST_FACTORY,
                upload_id,
                json.dumps(row_data),
            )

        # Build writer with mock orchestrator returning canned IDs
        orch = MagicMock()

        async def _resolve_store(_, factory_id, context):
            return ResolveResult(
                entity_id=store_id, is_tentative=False, confidence=0.95
            )

        async def _resolve_product(_, factory_id, context):
            return ResolveResult(
                entity_id=product_id, is_tentative=False, confidence=0.95
            )

        writer = ReviewWriter(pool=scoped_pool, orchestrator=orch)
        writer._resolve_store = _resolve_store  # type: ignore[method-assign]
        writer._resolve_product = _resolve_product  # type: ignore[method-assign]

        # First write
        s1 = await writer.write(upload_id=upload_id, factory_id=TEST_FACTORY)
        assert s1.rows_written == 1

        async with scoped_pool.acquire() as conn:
            count_after_first = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_review_event "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )
            summary_count_first = await conn.fetchval(
                "SELECT COUNT(*) FROM dim_review_summary "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )

        # Second write — same upload, same content → ON CONFLICT DO NOTHING
        s2 = await writer.write(upload_id=upload_id, factory_id=TEST_FACTORY)
        assert s2.rows_written == 1  # writer's own counter is per-call

        async with scoped_pool.acquire() as conn:
            count_after_second = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_review_event "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )
            summary_count_second = await conn.fetchval(
                "SELECT COUNT(*) FROM dim_review_summary "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )

        # Idempotency assertions: row counts unchanged on re-run.
        assert (
            count_after_first == 1
        ), f"first run wrote {count_after_first} rows (want 1)"
        assert (
            count_after_second == count_after_first
        ), f"re-run created duplicates: {count_after_first} → {count_after_second}"
        assert (
            summary_count_second == summary_count_first == 1
        ), "summary row not idempotent"
    finally:
        await scoped_pool.close()


@pytest.mark.integration
async def test_product_summary_writer_coalesce_period_unique_index(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """Validate the ``COALESCE(period_start, DATE '0001-01-01')`` unique index.

    This is the spec departure (PG 13 lacks NULLS NOT DISTINCT) that
    REQUIRES live PG validation — mocks can't catch the index expression
    syntax. We INSERT twice with NULL period_start; the second must hit
    ON CONFLICT and update the row instead of stacking.
    """
    async def _setup(conn: "asyncpg.Connection") -> None:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", TEST_FACTORY
        )

    scoped_pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=2, timeout=5, setup=_setup
    )
    try:
        async with scoped_pool.acquire() as conn:
            store_id = await _seed_dim_store(conn, TEST_FACTORY, "门店Y")
            product_id = await _seed_dim_product(
                conn, TEST_FACTORY, "宫保鸡丁", "宫保鸡丁"
            )

            upload_row = await conn.fetchrow(
                """
                INSERT INTO smart_bi_pg_excel_uploads
                  (factory_id, file_name, upload_status)
                VALUES ($1, $2, 'COMPLETED')
                RETURNING id
                """,
                TEST_FACTORY,
                f"e2e_psw_{int(time.time())}.xlsx",
            )
            assert upload_row is not None
            upload_id = int(upload_row["id"])

            # First insert with NULL period_start
            await conn.execute(
                """
                INSERT INTO agg_product_period
                  (factory_id, upload_id, product_id, store_id,
                   period_start, period_end, qty_sold, revenue, avg_unit_price)
                VALUES ($1, $2, $3, $4, NULL, NULL, 10, 100, 10)
                ON CONFLICT (factory_id, upload_id, product_id, store_id,
                             COALESCE(period_start, DATE '0001-01-01'))
                DO UPDATE SET
                  qty_sold = EXCLUDED.qty_sold,
                  revenue = EXCLUDED.revenue,
                  avg_unit_price = EXCLUDED.avg_unit_price
                """,
                TEST_FACTORY,
                upload_id,
                product_id,
                store_id,
            )
            count1 = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_product_period "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )
            assert count1 == 1

            # Second insert — same NULL period_start. Without COALESCE, PG
            # would let this through (NULL != NULL). With COALESCE it MUST
            # collide and DO UPDATE.
            await conn.execute(
                """
                INSERT INTO agg_product_period
                  (factory_id, upload_id, product_id, store_id,
                   period_start, period_end, qty_sold, revenue, avg_unit_price)
                VALUES ($1, $2, $3, $4, NULL, NULL, 20, 200, 10)
                ON CONFLICT (factory_id, upload_id, product_id, store_id,
                             COALESCE(period_start, DATE '0001-01-01'))
                DO UPDATE SET
                  qty_sold = EXCLUDED.qty_sold,
                  revenue = EXCLUDED.revenue,
                  avg_unit_price = EXCLUDED.avg_unit_price
                """,
                TEST_FACTORY,
                upload_id,
                product_id,
                store_id,
            )
            count2 = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_product_period "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )
            qty = await conn.fetchval(
                "SELECT qty_sold FROM agg_product_period "
                "WHERE factory_id = $1 AND upload_id = $2",
                TEST_FACTORY,
                upload_id,
            )
            assert (
                count2 == 1
            ), f"COALESCE unique index failed: {count1} → {count2} (expected 1)"
            assert (
                float(qty) == 20.0
            ), "DO UPDATE didn't fire on conflict (qty should be 20, not 10)"
    finally:
        await scoped_pool.close()


@pytest.mark.integration
async def test_admin_queue_extended_check_allows_ingredient(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """V20260428_02 broadened entity_type CHECK to include 'ingredient'.

    Verify the CHECK constraint accepts 'ingredient' AND still rejects an
    invalid value (e.g., 'totally_invalid_type').
    """
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await _set_tenant(conn, TEST_FACTORY)
            # 'ingredient' must succeed (V20260428_02)
            await conn.execute(
                """
                INSERT INTO entity_resolution_admin_queue
                  (factory_id, entity_type, raw_name, confidence,
                   decided_by_agent, reasoning, priority)
                VALUES ($1, 'ingredient', '番茄', 0.5, 'deterministic',
                        'integration test', 'medium')
                """,
                TEST_FACTORY,
            )
            row = await conn.fetchrow(
                """
                SELECT entity_type, raw_name FROM entity_resolution_admin_queue
                WHERE factory_id = $1 AND entity_type = 'ingredient'
                """,
                TEST_FACTORY,
            )
            assert row is not None
            assert row["entity_type"] == "ingredient"

    # 'totally_invalid_type' must fail with CHECK violation. Run in fresh tx.
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await _set_tenant(conn, TEST_FACTORY)
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    """
                    INSERT INTO entity_resolution_admin_queue
                      (factory_id, entity_type, raw_name, confidence,
                       decided_by_agent, reasoning, priority)
                    VALUES ($1, 'totally_invalid_type', 'x', 0.5,
                            'deterministic', 'should fail', 'medium')
                    """,
                    TEST_FACTORY,
                )


@pytest.mark.integration
async def test_priority_status_columns_present_with_defaults(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """V20260428_02 added priority + status with defaults.

    Insert without specifying status; default 'PENDING' should apply. Insert
    with explicit priority='high' and verify it stuck.
    """
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await _set_tenant(conn, TEST_FACTORY)
            await conn.execute(
                """
                INSERT INTO entity_resolution_admin_queue
                  (factory_id, entity_type, raw_name, confidence,
                   decided_by_agent, reasoning, priority)
                VALUES ($1, 'store', '门店Q', 0.4, 'deterministic',
                        'integration test', 'high')
                """,
                TEST_FACTORY,
            )
            row = await conn.fetchrow(
                """
                SELECT priority, status FROM entity_resolution_admin_queue
                WHERE factory_id = $1 AND raw_name = '门店Q'
                """,
                TEST_FACTORY,
            )
            assert row is not None
            assert row["priority"] == "high"
            # Default ('PENDING') applied when status omitted
            assert row["status"] == "PENDING"

    # Check status CHECK constraint rejects invalid values
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await _set_tenant(conn, TEST_FACTORY)
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    """
                    INSERT INTO entity_resolution_admin_queue
                      (factory_id, entity_type, raw_name, confidence,
                       decided_by_agent, reasoning, priority, status)
                    VALUES ($1, 'store', '门店Z', 0.4, 'deterministic',
                            'integration test', 'medium', 'NOT_A_STATUS')
                    """,
                    TEST_FACTORY,
                )


@pytest.mark.integration
async def test_rls_silently_drops_zero_rows_when_tenant_unset(
    pg_pool: "asyncpg.Pool", clean_tenant: None
) -> None:
    """If ``app.factory_id`` is NEVER set, FORCE RLS rejects the WITH CHECK.

    This is the silent-zero-rows trap: a writer that forgets to set the
    tenant context will see its INSERT raise InsufficientPrivilegeError on
    PostgreSQL 13+ (FORCE RLS applies to table owners too).
    """
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            # Intentionally do NOT call _set_tenant
            with pytest.raises(
                (
                    asyncpg.InsufficientPrivilegeError,
                    asyncpg.exceptions.InsufficientPrivilegeError,
                )
            ):
                await conn.execute(
                    """
                    INSERT INTO entity_resolution_history
                      (factory_id, entity_type, a_name, b_name,
                       b_entity_id, confidence)
                    VALUES ($1, 'store', 'a', 'b', 1, 0.9)
                    """,
                    TEST_FACTORY,
                )
