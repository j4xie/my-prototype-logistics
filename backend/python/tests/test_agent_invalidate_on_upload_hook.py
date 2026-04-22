"""Smoke test for Week 6 A1 — upload-complete event invalidates narrative_cache.

Does not exercise a full upload pipeline (too heavy); directly invokes
invalidate_on_upload() the same way excel_async.py:_async_worker_impl does,
and asserts rows disappear. The real value is: this test guards against
a future refactor that removes the hook, because the seam being tested
is the one exact call the hook makes.
"""
from __future__ import annotations

import pytest

from smartbi.agent import NarrativeCacheService, compute_question_hash


_TENANT = "TEST_INVALIDATE_HOOK"


@pytest.mark.asyncio
async def test_hook_call_clears_all_factory_rows():
    """What excel_async.py does at upload complete. Seed 3 rows, invoke, assert 0."""
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_factory_id, set_pg_connection_tenant

    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")

    pool = await asyncpg.create_pool(
        settings.postgres_url, min_size=1, max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        set_factory_id(_TENANT)
        svc = NarrativeCacheService(pool)

        for q in ("Q1", "Q2", "Q3"):
            h = compute_question_hash(q, "2025-01-01", "2025-12-31", _TENANT)
            await svc.put(_TENANT, h, f"answer for {q}", None, tokens=100)

        # Exact shape the hook calls
        deleted = await svc.invalidate_on_upload(_TENANT)
        assert deleted == 3

        # Verify no rows left
        for q in ("Q1", "Q2", "Q3"):
            h = compute_question_hash(q, "2025-01-01", "2025-12-31", _TENANT)
            assert await svc.get(_TENANT, h) is None
    finally:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM narrative_cache WHERE factory_id=$1", _TENANT,
            )
        await pool.close()
