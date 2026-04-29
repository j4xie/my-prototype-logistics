"""Tests for the field_provenance LEFT JOIN added to top_products
(数据织网 Sub-Project C Day 24-25 POC).

Three real-PG scenarios:
  1. Empty field_provenance → confidence/source/source_upload_id are None,
     other product fields unchanged. Proves graceful prod-OFF fallback
     (the ``SMARTBI_ENABLE_PROVENANCE=0`` state).
  2. Populated field_provenance → matched row exposes confidence + source.
  3. Multiple versions (one superseded, one active) → only the active
     row surfaces.

Follows the ``test_gold_queries.py`` real-PG fixture pattern: skips when no
PG configured, scoped via ``set_factory_id`` so RLS allows the inserts and
reads.
"""
from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio

from smartbi.gold import top_products


_TENANT = "TEST_TPP_C"


# P2-7: pool fixture extracted to conftest.py as c_provenance_pool. Local
# alias keeps existing call sites stable.
@pytest_asyncio.fixture
async def pool(c_provenance_pool):
    yield c_provenance_pool


async def _clean(conn, tenant: str) -> None:
    """Order matters: field_provenance has FK ON DELETE RESTRICT to
    smart_bi_pg_excel_uploads, so it must be wiped first.
    """
    await conn.execute("DELETE FROM field_provenance WHERE factory_id=$1", tenant)
    await conn.execute("DELETE FROM agg_product WHERE factory_id=$1", tenant)
    await conn.execute("DELETE FROM dim_product WHERE factory_id=$1", tenant)


@pytest_asyncio.fixture
async def clean_rows(pool):
    """Pre/post wipe of tenant rows. Caller seeds inside the test."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            await _clean(conn, _TENANT)
        yield
    finally:
        async with pool.acquire() as conn:
            await _clean(conn, _TENANT)
        reset_factory_id(token)


async def _seed_product_with_revenue(conn, tenant: str, name: str, revenue: float) -> int:
    """Insert dim_product + agg_product (April 2026) → return product_id."""
    pid = await conn.fetchval(
        """
        INSERT INTO dim_product (factory_id, name, normalized_name)
        VALUES ($1, $2, $2)
        ON CONFLICT (factory_id, normalized_name)
          DO UPDATE SET updated_at = NOW()
        RETURNING product_id
        """,
        tenant,
        name,
    )
    await conn.execute(
        """
        INSERT INTO agg_product (factory_id, product_id, month, qty_sold, revenue, bill_count)
        VALUES ($1, $2, $3, 1, $4, 1)
        ON CONFLICT (factory_id, product_id, month)
          DO UPDATE SET qty_sold = EXCLUDED.qty_sold,
                        revenue  = EXCLUDED.revenue,
                        bill_count = EXCLUDED.bill_count
        """,
        tenant,
        pid,
        date(2026, 4, 1),
        revenue,
    )
    return int(pid)


async def _insert_provenance(
    conn,
    tenant: str,
    product_id: int,
    field_name: str,
    field_value: float,
    confidence: float,
    source_type: str,
    source_upload_id: int = 0,
    valid_from: date = date(2026, 4, 1),
    superseded_by_id: int | None = None,
) -> int:
    """Direct INSERT bypassing write_provenance() — tests need to control
    the supersession chain explicitly. Returns the row's id.
    """
    return int(
        await conn.fetchval(
            """
            INSERT INTO field_provenance
              (factory_id, entity_type, entity_id, field_name, field_value,
               source_upload_id, source_type, confidence, valid_from,
               mapper_method, superseded_by_id)
            VALUES ($1, 'product', $2, $3, to_jsonb($4::float8),
                    $5, $6, $7, $8, 'rule', $9)
            RETURNING id
            """,
            tenant,
            product_id,
            field_name,
            field_value,
            source_upload_id,
            source_type,
            confidence,
            valid_from,
            superseded_by_id,
        )
    )


# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_top_products_returns_null_provenance_when_table_empty(pool, clean_rows):
    """Empty field_provenance (the prod-OFF state, ``SMARTBI_ENABLE_
    PROVENANCE=0``) → graceful LEFT JOIN with NULL confidence/source.
    Other product fields are untouched.
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            pid = await _seed_product_with_revenue(conn, _TENANT, "p_empty", 250.0)

        out = await top_products(
            pool, _TENANT, (date(2026, 4, 1), date(2026, 4, 30)), top_n=5,
        )
    finally:
        reset_factory_id(token)

    products = out["top_products"]
    assert len(products) == 1
    p = products[0]
    assert p["product_id"] == pid
    assert p["product_name"] == "p_empty"
    assert p["revenue"] == 250.0
    # Provenance fields all None when table empty.
    assert p["confidence"] is None
    assert p["source"] is None
    assert p["source_upload_id"] is None
    # entity_id is always returned (constructible cell-audit URL even
    # without provenance) and field_name falls back to deterministic
    # 'revenue'.
    assert p["entity_id"] == str(pid)
    assert p["field_name"] == "revenue"


@pytest.mark.asyncio
async def test_top_products_surfaces_populated_provenance(pool, clean_rows, monkeypatch):
    """One matching active provenance row (using the writer's
    ``revenue@store_<id>`` encoding) → its confidence/source flow through.

    Post-test-audit fix: F5 wraps JOIN behind SMARTBI_ENABLE_PROVENANCE so
    explicitly enable it for this test (default OFF means JOIN is skipped
    and confidence stays NULL even with seeded provenance row).
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            pid = await _seed_product_with_revenue(conn, _TENANT, "p_populated", 500.0)
            await _insert_provenance(
                conn,
                _TENANT,
                pid,
                f"revenue@store_99",
                500.0,
                confidence=0.85,
                source_type="product_summary",
                source_upload_id=0,  # sentinel — no real upload needed for this test
            )

        out = await top_products(
            pool, _TENANT, (date(2026, 4, 1), date(2026, 4, 30)), top_n=5,
        )
    finally:
        reset_factory_id(token)

    products = out["top_products"]
    assert len(products) == 1
    p = products[0]
    assert p["product_id"] == pid
    # Provenance flowed through.
    assert p["confidence"] == 0.85
    assert p["source"] == "product_summary"
    assert p["source_upload_id"] == 0
    # field_name reflects the matched row (with @store_ suffix).
    assert p["field_name"] == "revenue@store_99"
    assert p["entity_id"] == str(pid)


@pytest.mark.asyncio
async def test_top_products_picks_active_over_superseded(pool, clean_rows, monkeypatch):
    """Two provenance rows for same product/field — one with
    ``superseded_by_id`` set (historical), one active. Only the active row
    surfaces in the JOIN.

    Post-test-audit fix: F5 wraps JOIN behind SMARTBI_ENABLE_PROVENANCE.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            pid = await _seed_product_with_revenue(conn, _TENANT, "p_versioned", 999.0)

            # Active row with confidence 0.95 (must come FIRST so the
            # second row can reference it as superseder).
            active_id = await _insert_provenance(
                conn,
                _TENANT,
                pid,
                f"revenue@store_77",
                999.0,
                confidence=0.95,
                source_type="manual",
                source_upload_id=0,
                valid_from=date(2026, 4, 15),
            )
            # Superseded row at confidence 0.6 — same dedup key requires
            # different valid_from to satisfy uq_fp_dedup, but the
            # uq_fp_dedup index has WHERE superseded_by_id IS NULL so a
            # superseded row with same valid_from is also OK. We pick a
            # different valid_from anyway to mirror writer semantics.
            await _insert_provenance(
                conn,
                _TENANT,
                pid,
                f"revenue@store_77",
                500.0,
                confidence=0.6,
                source_type="bill_flow",
                source_upload_id=0,
                valid_from=date(2026, 3, 1),
                superseded_by_id=active_id,
            )

        out = await top_products(
            pool, _TENANT, (date(2026, 4, 1), date(2026, 4, 30)), top_n=5,
        )
    finally:
        reset_factory_id(token)

    products = out["top_products"]
    assert len(products) == 1
    p = products[0]
    # Should pick the ACTIVE row (manual @ 0.95), not the superseded one
    # (bill_flow @ 0.6).
    assert p["confidence"] == 0.95
    assert p["source"] == "manual"


# ─────────────────────────────────────────────────────────────────────────
# P0-C2 (post-review test backfill): SMARTBI_ENABLE_PROVENANCE flag-gate.
# The parallel session's F5 fix (queries.py:135-194) wraps the JOIN in a
# branch on ``is_provenance_enabled()``. Both branches return the same
# result shape with NULL provenance fields when no match — but they run
# completely different SQL strings. The OFF branch is the one that runs
# in prod (where the field_provenance table doesn't even exist) so it
# MUST stay green. Without an explicit flag-off test, a regression in
# the OFF SQL string is invisible until prod traffic hits it.
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_top_products_skips_join_when_flag_off(
    pool, clean_rows, monkeypatch
):
    """SMARTBI_ENABLE_PROVENANCE=0 → the OFF SQL branch runs (no LEFT JOIN
    LATERAL). Even if field_provenance has rows for this product, they are
    NOT surfaced — the OFF branch returns NULL provenance fields by SELECT
    NULL::numeric AS confidence. This is the prod-safe path that runs when
    the C migrations haven't been applied yet.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "0")

    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            pid = await _seed_product_with_revenue(conn, _TENANT, "p_off_branch", 750.0)
            # Seed a high-confidence provenance row that WOULD be picked up
            # by the ON branch's LATERAL join. The OFF branch must ignore it.
            await _insert_provenance(
                conn,
                _TENANT,
                pid,
                "revenue@store_99",
                750.0,
                confidence=0.95,
                source_type="product_summary",
                source_upload_id=0,
            )

        out = await top_products(
            pool, _TENANT, (date(2026, 4, 1), date(2026, 4, 30)), top_n=5,
        )
    finally:
        reset_factory_id(token)

    products = out["top_products"]
    assert len(products) == 1
    p = products[0]
    # OFF branch returns NULL for all provenance fields regardless of
    # what's in field_provenance.
    assert p["confidence"] is None
    assert p["source"] is None
    assert p["source_upload_id"] is None
    # Non-provenance fields still flow normally.
    assert p["product_id"] == pid
    assert p["revenue"] == 750.0
    # field_name still falls back to deterministic 'revenue' so the FE can
    # build cell-audit URLs whether the JOIN ran or not.
    assert p["field_name"] == "revenue"


@pytest.mark.asyncio
async def test_top_products_uses_join_when_flag_on(
    pool, clean_rows, monkeypatch
):
    """SMARTBI_ENABLE_PROVENANCE=1 → the ON branch runs and the LATERAL
    JOIN surfaces provenance from a populated field_provenance row.

    Pairs with the OFF test above to lock both branches.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            pid = await _seed_product_with_revenue(conn, _TENANT, "p_on_branch", 600.0)
            await _insert_provenance(
                conn,
                _TENANT,
                pid,
                "revenue@store_42",
                600.0,
                confidence=0.88,
                source_type="bill_flow",
                source_upload_id=0,
            )

        out = await top_products(
            pool, _TENANT, (date(2026, 4, 1), date(2026, 4, 30)), top_n=5,
        )
    finally:
        reset_factory_id(token)

    products = out["top_products"]
    assert len(products) == 1
    p = products[0]
    # ON branch picks up the seeded provenance.
    assert p["confidence"] == 0.88
    assert p["source"] == "bill_flow"
    assert p["field_name"] == "revenue@store_42"
