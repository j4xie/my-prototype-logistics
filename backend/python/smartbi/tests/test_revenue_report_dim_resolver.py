"""Tests for canonical.dim_resolver.DimResolver.resolve_store whitespace patch.

二维火 POS CSV exports have store names with trailing whitespace
(e.g. "青花椒川食山语颛桥龙湖店 " with trailing space). Without `.strip()`,
the unique constraint `dim_store.name` per factory creates duplicate rows
for the same logical store, and the resolver cache key diverges.

Patch trims leading + trailing whitespace before lookup. Closed-store
prefix (（闭店）/（停用）) is preserved as it's business data, not noise.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.3
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B4
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.dim_resolver import DimResolver


@pytest.fixture
def resolver():
    """DimResolver with a mocked asyncpg pool — no DB needed."""
    pool = MagicMock()
    # Allow `async with pool.acquire() as conn`
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=42)  # arbitrary store_id
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=ctx)
    return DimResolver(pool=pool, factory_id="R_QINGHUAJIAO_REAL"), conn


@pytest.mark.asyncio
async def test_resolve_store_strips_trailing_space(resolver):
    r, _ = resolver
    a = await r.resolve_store("青花椒南方百联店")
    b = await r.resolve_store("青花椒南方百联店 ")  # trailing space
    c = await r.resolve_store(" 青花椒南方百联店")  # leading space
    assert a == b == c, "stores with different whitespace must resolve to same id"


@pytest.mark.asyncio
async def test_resolve_store_cache_key_is_stripped(resolver):
    r, conn = resolver
    await r.resolve_store("青花椒南方百联店 ")
    # Cache should be keyed on the stripped name; subsequent calls hit cache.
    await r.resolve_store("青花椒南方百联店")
    # Only ONE conn.fetchval call total (second was cache hit).
    assert conn.fetchval.call_count == 1


@pytest.mark.asyncio
async def test_resolve_store_keeps_closed_prefix(resolver):
    r, conn = resolver
    await r.resolve_store("（闭店）青花椒上滨国际店")
    # The name passed to SQL must NOT be stripped of （闭店）— that's business data.
    sql_args = conn.fetchval.call_args[0]
    # _STORE_UPSERT_SQL is positional[0]; factory_id positional[1]; name positional[2]
    name_sent_to_db = sql_args[2]
    assert name_sent_to_db == "（闭店）青花椒上滨国际店"


@pytest.mark.asyncio
async def test_resolve_store_empty_after_strip_raises(resolver):
    r, _ = resolver
    with pytest.raises(ValueError):
        await r.resolve_store("   ")  # whitespace-only must still error
    with pytest.raises(ValueError):
        await r.resolve_store("")
