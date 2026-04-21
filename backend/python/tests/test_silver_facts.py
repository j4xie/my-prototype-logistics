"""Tests for Silver fact tables.

Week 2 Day 2 of Unified Data Layer v1 spec (§2.2).

Covers:
- All 4 fact tables have RLS + policy (introspection)
- fact_pos_transaction UNIQUE (factory, source_type, store, bill_no) blocks
  duplicate bill imports within the same source
- Same bill_no from a DIFFERENT source_type IS allowed (so merging Excel +
  meituan API for the same store won't collide — they track different lanes)
- Cross-tenant: two factories can each have source_bill_no='A001' for the
  same source_type (different store_ids anyway)
- fact_pos_item.product_id nullable: parser-miss row is writable with NULL
- FK CASCADE: deleting a transaction removes its items/payments/discounts
- FK RESTRICT: can't delete a dim_store that has transactions
"""
from __future__ import annotations

import pytest
import pytest_asyncio


_FACT_TABLES = (
    "fact_pos_transaction",
    "fact_pos_item",
    "fact_pos_payment",
    "fact_pos_discount",
)

_TENANT_A = "TEST_FACT_A"
_TENANT_B = "TEST_FACT_B"


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
async def clean_rows(pool):
    """Wipe test-tenant rows across dim + fact tables. Fact cleanup has
    implicit cascade to children via FK ON DELETE CASCADE, so deleting
    transactions cleans items/payments/discounts as a side effect."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    for fid in (_TENANT_A, _TENANT_B):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM fact_pos_transaction WHERE factory_id = $1", fid
                )
                # Clean dims last (FK dependencies).
                for t in ("dim_staff", "dim_product", "dim_payment_channel",
                          "dim_discount", "dim_store"):
                    await conn.execute(f"DELETE FROM {t} WHERE factory_id = $1", fid)
        finally:
            reset_factory_id(token)
    yield
    for fid in (_TENANT_A, _TENANT_B):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM fact_pos_transaction WHERE factory_id = $1", fid
                )
                for t in ("dim_staff", "dim_product", "dim_payment_channel",
                          "dim_discount", "dim_store"):
                    await conn.execute(f"DELETE FROM {t} WHERE factory_id = $1", fid)
        finally:
            reset_factory_id(token)


async def _seed_store(conn, factory_id: str, name: str) -> int:
    """Helper: upsert a dim_store and return its id."""
    return await conn.fetchval(
        """
        INSERT INTO dim_store (factory_id, name) VALUES ($1, $2)
        ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW()
        RETURNING store_id
        """,
        factory_id, name,
    )


async def _seed_product(conn, factory_id: str, norm: str) -> int:
    return await conn.fetchval(
        """
        INSERT INTO dim_product (factory_id, name, normalized_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (factory_id, normalized_name) DO UPDATE SET updated_at=NOW()
        RETURNING product_id
        """,
        factory_id, norm, norm,
    )


async def _seed_channel(conn, factory_id: str, name: str) -> int:
    return await conn.fetchval(
        """
        INSERT INTO dim_payment_channel (factory_id, name, category)
        VALUES ($1, $2, 'online')
        ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW()
        RETURNING channel_id
        """,
        factory_id, name,
    )


async def _seed_discount(conn, factory_id: str, name: str) -> int:
    return await conn.fetchval(
        """
        INSERT INTO dim_discount (factory_id, name, parsed_ok)
        VALUES ($1, $2, TRUE)
        ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW()
        RETURNING discount_id
        """,
        factory_id, name,
    )


# ── RLS metadata ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_all_fact_tables_have_rls_policy(pool):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT relname, relrowsecurity, relforcerowsecurity
              FROM pg_class
             WHERE relkind = 'r' AND relname = ANY($1::text[])
            """,
            list(_FACT_TABLES),
        )
        found = {r["relname"]: (r["relrowsecurity"], r["relforcerowsecurity"]) for r in rows}
        assert set(found.keys()) == set(_FACT_TABLES)
        for t, (rls, force) in found.items():
            assert rls, f"{t} missing ENABLE RLS"
            assert force, f"{t} missing FORCE RLS"

        policies = await conn.fetch(
            "SELECT tablename FROM pg_policies WHERE tablename = ANY($1::text[]) AND policyname='tenant_isolation'",
            list(_FACT_TABLES),
        )
        assert {p["tablename"] for p in policies} == set(_FACT_TABLES)


# ── Duplicate-bill protection ────────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_bill_blocked_within_same_source(pool, clean_rows):
    """Two inserts with same (factory, source_type, store, bill_no) → second
    raises UniqueViolationError. This is the "don't re-ingest the same
    Excel file twice" guard."""
    import asyncpg.exceptions
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    from datetime import date
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            store_id = await _seed_store(conn, _TENANT_A, "S1")
            await conn.execute(
                """
                INSERT INTO fact_pos_transaction
                  (factory_id, source_type, source_bill_no, store_id, date, net_amount)
                VALUES ($1, 'excel', 'BILL-001', $2, $3, 100.00)
                """,
                _TENANT_A, store_id, date(2026, 4, 21),
            )
            with pytest.raises(asyncpg.exceptions.UniqueViolationError):
                await conn.execute(
                    """
                    INSERT INTO fact_pos_transaction
                      (factory_id, source_type, source_bill_no, store_id, date, net_amount)
                    VALUES ($1, 'excel', 'BILL-001', $2, $3, 100.00)
                    """,
                    _TENANT_A, store_id, date(2026, 4, 21),
                )
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_same_bill_no_ok_across_different_sources(pool, clean_rows):
    """Excel ingests BILL-001, then meituan API also reports BILL-001 for the
    same store — both rows land (different source_type lanes). Merging them
    downstream is a business concern, not a constraint violation."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    from datetime import date
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            store_id = await _seed_store(conn, _TENANT_A, "S1")
            await conn.execute(
                """
                INSERT INTO fact_pos_transaction
                  (factory_id, source_type, source_bill_no, store_id, date, net_amount)
                VALUES ($1, 'excel', 'BILL-001', $2, $3, 100.00)
                """,
                _TENANT_A, store_id, date(2026, 4, 21),
            )
            await conn.execute(
                """
                INSERT INTO fact_pos_transaction
                  (factory_id, source_type, source_bill_no, store_id, date, net_amount)
                VALUES ($1, 'meituan_api', 'BILL-001', $2, $3, 100.00)
                """,
                _TENANT_A, store_id, date(2026, 4, 21),
            )
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1 AND source_bill_no='BILL-001'",
                _TENANT_A,
            )
        assert n == 2
    finally:
        reset_factory_id(token)


# ── fact_pos_item parser-miss path ───────────────────────────

@pytest.mark.asyncio
async def test_item_with_null_product_id_and_raw_blob(pool, clean_rows):
    """Parser fails for row → writes product_id=NULL + source_item_raw=<blob>.
    This is how we preserve unparseable rows instead of dropping them."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    from datetime import date
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            store_id = await _seed_store(conn, _TENANT_A, "S1")
            txn_id = await conn.fetchval(
                """
                INSERT INTO fact_pos_transaction
                  (factory_id, source_type, source_bill_no, store_id, date, net_amount)
                VALUES ($1, 'excel', 'B1', $2, $3, 50.00)
                RETURNING id
                """,
                _TENANT_A, store_id, date(2026, 4, 21),
            )
            await conn.execute(
                """
                INSERT INTO fact_pos_item
                  (transaction_id, factory_id, product_id, qty, amount, source_item_raw)
                VALUES ($1, $2, NULL, 1, 50.00, '#奇怪的菜品名#@不可解析')
                """,
                txn_id, _TENANT_A,
            )
            row = await conn.fetchrow(
                "SELECT product_id, source_item_raw FROM fact_pos_item WHERE transaction_id=$1",
                txn_id,
            )
        assert row["product_id"] is None
        assert row["source_item_raw"] == "#奇怪的菜品名#@不可解析"
    finally:
        reset_factory_id(token)


# ── CASCADE deletes ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_transaction_cascades_to_children(pool, clean_rows):
    """Deleting a transaction row removes its items/payments/discounts.
    Prevents orphaned child rows that would misreport revenue."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    from datetime import date
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            store_id = await _seed_store(conn, _TENANT_A, "S1")
            product_id = await _seed_product(conn, _TENANT_A, "pname")
            channel_id = await _seed_channel(conn, _TENANT_A, "现金")
            discount_id = await _seed_discount(conn, _TENANT_A, "VIP卡")

            txn_id = await conn.fetchval(
                """
                INSERT INTO fact_pos_transaction
                  (factory_id, source_type, source_bill_no, store_id, date)
                VALUES ($1, 'excel', 'CASC-1', $2, $3)
                RETURNING id
                """,
                _TENANT_A, store_id, date(2026, 4, 21),
            )
            await conn.execute(
                "INSERT INTO fact_pos_item (transaction_id, factory_id, product_id, qty, amount) VALUES ($1, $2, $3, 1, 10)",
                txn_id, _TENANT_A, product_id,
            )
            await conn.execute(
                "INSERT INTO fact_pos_payment (transaction_id, factory_id, channel_id, amount) VALUES ($1, $2, $3, 10)",
                txn_id, _TENANT_A, channel_id,
            )
            await conn.execute(
                "INSERT INTO fact_pos_discount (transaction_id, factory_id, discount_id, quantity, amount) VALUES ($1, $2, $3, 1, 5)",
                txn_id, _TENANT_A, discount_id,
            )
            # Delete the parent — cascades.
            await conn.execute("DELETE FROM fact_pos_transaction WHERE id=$1", txn_id)

            for t in ("fact_pos_item", "fact_pos_payment", "fact_pos_discount"):
                n = await conn.fetchval(f"SELECT COUNT(*) FROM {t} WHERE transaction_id=$1", txn_id)
                assert n == 0, f"cascade missed {t}"
    finally:
        reset_factory_id(token)


# ── FK RESTRICT on dim_store ─────────────────────────────────

@pytest.mark.asyncio
async def test_cannot_delete_store_with_transactions(pool, clean_rows):
    """dim_store.store_id is a NOT-NULL FK on fact_pos_transaction, so
    deleting a store that has bills is blocked (RESTRICT). Protects
    historical revenue from being orphaned."""
    import asyncpg.exceptions
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    from datetime import date
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            store_id = await _seed_store(conn, _TENANT_A, "RestrictMe")
            await conn.execute(
                """
                INSERT INTO fact_pos_transaction
                  (factory_id, source_type, source_bill_no, store_id, date)
                VALUES ($1, 'excel', 'R1', $2, $3)
                """,
                _TENANT_A, store_id, date(2026, 4, 21),
            )
            with pytest.raises(asyncpg.exceptions.ForeignKeyViolationError):
                await conn.execute("DELETE FROM dim_store WHERE store_id=$1", store_id)
    finally:
        reset_factory_id(token)
