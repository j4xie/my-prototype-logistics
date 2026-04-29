"""Tests for FieldRegistry — the global mapper-result cache.

Week 1 Day 4 of Unified Data Layer v1 spec (§1.2).

Live-DB integration tests (pytest-asyncio + asyncpg). Each test gets a
tenant-less pool (registry is global, no RLS) and cleans its own rows by
(source_type, source_version) prefix so parallel test runs don't collide.
"""
from __future__ import annotations

import pytest
import pytest_asyncio

from smartbi.canonical import FieldRegistry, RegistryEntry


# Use a distinct source_type prefix per test file so cleanup is safe.
# Any row matching this prefix is ours and can be deleted.
_TEST_SOURCE_TYPE = "_test_fr"


@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    # No tenant_ctx setup here — registry is global, not tenant-scoped.
    p = await asyncpg.create_pool(
        settings.postgres_url,
        min_size=1,
        max_size=3,
    )
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def clean_rows(pool):
    """Delete any leftover test rows before + after each test."""
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM field_registry WHERE source_type = $1",
            _TEST_SOURCE_TYPE,
        )
    yield
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM field_registry WHERE source_type = $1",
            _TEST_SOURCE_TYPE,
        )


@pytest_asyncio.fixture
async def registry(pool):
    return FieldRegistry(pool=pool, normalizer_version="v1")


# ── Basic lookup contract ────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_lookup_returns_empty(registry, clean_rows):
    """Empty input → empty result, no DB round-trip (just in case)."""
    result = await registry.lookup_batch(_TEST_SOURCE_TYPE, "v1", [])
    assert result.hits == {}
    assert result.misses == []


@pytest.mark.asyncio
async def test_lookup_all_misses_for_unknown_columns(registry, clean_rows):
    result = await registry.lookup_batch(
        _TEST_SOURCE_TYPE, "v1", ["unknown_col_a", "unknown_col_b"]
    )
    assert result.hits == {}
    assert set(result.misses) == {"unknown_col_a", "unknown_col_b"}


# ── Upsert + roundtrip ───────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_then_lookup_returns_entry(registry, clean_rows):
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE,
        source_version="v1",
        raw_column="商品名称",
        canonical_field="product_name",
        domain="restaurant",
        role="dimension",
        mapper_method="rule",
        confidence=0.95,
        sample_values=["宫保鸡丁", "番茄炒蛋"],
    )

    result = await registry.lookup_batch(
        _TEST_SOURCE_TYPE, "v1", ["商品名称", "miss_me"]
    )
    assert "商品名称" in result.hits
    assert result.misses == ["miss_me"]

    entry = result.hits["商品名称"]
    assert entry.canonical_field == "product_name"
    assert entry.domain == "restaurant"
    assert entry.role == "dimension"
    assert entry.mapper_method == "rule"
    assert entry.confidence == 0.95
    assert entry.sample_values == ["宫保鸡丁", "番茄炒蛋"]


@pytest.mark.asyncio
async def test_lookup_deduplicates_input(registry, clean_rows):
    """Same raw_column passed twice should still produce one miss."""
    result = await registry.lookup_batch(
        _TEST_SOURCE_TYPE, "v1", ["dup_col", "dup_col", "dup_col"]
    )
    assert result.misses == ["dup_col"]


# ── Automated overwrite, manual stickiness ───────────────────

@pytest.mark.asyncio
async def test_automated_upsert_overwrites_automated(registry, clean_rows):
    """Re-resolving the same column with a higher-confidence automated
    mapper updates the stored mapping (normal refresh path)."""
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="金额",
        canonical_field="unclear_revenue", domain=None, role=None,
        mapper_method="rule", confidence=0.6,
    )
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="金额",
        canonical_field="revenue", domain="finance", role="measure",
        mapper_method="llm", confidence=0.92,
    )
    result = await registry.lookup_batch(_TEST_SOURCE_TYPE, "v1", ["金额"])
    entry = result.hits["金额"]
    assert entry.canonical_field == "revenue"
    assert entry.mapper_method == "llm"
    assert entry.confidence == 0.92


@pytest.mark.asyncio
async def test_manual_mapping_is_sticky_against_automated_upsert(registry, clean_rows):
    """Admin sets manual mapping; later automated upsert must NOT overwrite.
    This is THE core invariant of the registry — admin corrections persist."""
    # Step 1: admin manually maps ambiguous column.
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="单价",
        canonical_field="unit_price", domain="restaurant", role="measure",
        mapper_method="manual", confidence=1.0,
        reviewed_by=42,
    )
    # Step 2: automated mapper comes back and tries to "correct" it to cost.
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="单价",
        canonical_field="cost",  # wrong! admin said unit_price
        domain="finance", role="measure",
        mapper_method="llm", confidence=0.85,
    )
    # Verify manual stuck.
    result = await registry.lookup_batch(_TEST_SOURCE_TYPE, "v1", ["单价"])
    entry = result.hits["单价"]
    assert entry.canonical_field == "unit_price"
    assert entry.mapper_method == "manual"
    assert entry.confidence == 1.0


@pytest.mark.asyncio
async def test_manual_upsert_overrides_existing_manual(registry, clean_rows):
    """A new manual upsert by a different reviewer overwrites an old manual
    one (admin changed their mind — legitimate)."""
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="类别",
        canonical_field="wrong_field", domain=None, role=None,
        mapper_method="manual", confidence=1.0, reviewed_by=42,
    )
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="类别",
        canonical_field="category", domain="restaurant", role="dimension",
        mapper_method="manual", confidence=1.0, reviewed_by=99,
    )
    result = await registry.lookup_batch(_TEST_SOURCE_TYPE, "v1", ["类别"])
    assert result.hits["类别"].canonical_field == "category"


# ── Normalizer version isolation ─────────────────────────────

@pytest.mark.asyncio
async def test_different_normalizer_version_is_separate_key(pool, clean_rows):
    """Bumping normalizer_version is the cache-bust mechanism. Old rows stay
    but new lookup misses them."""
    r1 = FieldRegistry(pool=pool, normalizer_version="v1")
    r2 = FieldRegistry(pool=pool, normalizer_version="v2")

    await r1.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="s1", raw_column="x",
        canonical_field="old_mapping", domain=None, role=None,
        mapper_method="rule", confidence=0.8,
    )
    hit_v1 = await r1.lookup_batch(_TEST_SOURCE_TYPE, "s1", ["x"])
    miss_v2 = await r2.lookup_batch(_TEST_SOURCE_TYPE, "s1", ["x"])
    assert "x" in hit_v1.hits
    assert miss_v2.misses == ["x"]


# ── Validation ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_mapper_method_raises(registry, clean_rows):
    with pytest.raises(ValueError, match="Invalid mapper_method"):
        await registry.upsert(
            source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="a",
            canonical_field="b", domain=None, role=None,
            mapper_method="magic", confidence=0.5,
        )


@pytest.mark.asyncio
async def test_invalid_confidence_raises(registry, clean_rows):
    with pytest.raises(ValueError, match="confidence must be"):
        await registry.upsert(
            source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="a",
            canonical_field="b", domain=None, role=None,
            mapper_method="rule", confidence=1.5,
        )


@pytest.mark.asyncio
async def test_manual_without_reviewer_raises(registry, clean_rows):
    with pytest.raises(ValueError, match="manual mappings require reviewed_by"):
        await registry.upsert(
            source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="a",
            canonical_field="b", domain=None, role=None,
            mapper_method="manual", confidence=1.0,
        )


def test_registry_requires_normalizer_version(pool):
    with pytest.raises(ValueError, match="normalizer_version required"):
        FieldRegistry(pool=None, normalizer_version="")


# ── Sample values cap ────────────────────────────────────────

@pytest.mark.asyncio
async def test_sample_values_capped_at_5(registry, clean_rows):
    many = [f"v{i}" for i in range(20)]
    await registry.upsert(
        source_type=_TEST_SOURCE_TYPE, source_version="v1", raw_column="big_samples",
        canonical_field="x", domain=None, role=None,
        mapper_method="rule", confidence=0.9,
        sample_values=many,
    )
    result = await registry.lookup_batch(_TEST_SOURCE_TYPE, "v1", ["big_samples"])
    sv = result.hits["big_samples"].sample_values
    assert sv is not None
    assert len(sv) == 5
    assert sv == ["v0", "v1", "v2", "v3", "v4"]


# ── Batch upsert ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_many_writes_all_in_one_tx(registry, clean_rows):
    entries = [
        RegistryEntry(
            source_type=_TEST_SOURCE_TYPE, source_version="v1",
            normalizer_version="v1", raw_column=f"col{i}",
            canonical_field=f"cf{i}", domain="restaurant", role="dimension",
            mapper_method="rule", confidence=0.9,
        )
        for i in range(5)
    ]
    await registry.upsert_many(entries)
    result = await registry.lookup_batch(
        _TEST_SOURCE_TYPE, "v1", [f"col{i}" for i in range(5)]
    )
    assert len(result.hits) == 5
    assert result.misses == []


@pytest.mark.asyncio
async def test_upsert_many_rejects_mismatched_normalizer_version(registry, clean_rows):
    entry = RegistryEntry(
        source_type=_TEST_SOURCE_TYPE, source_version="v1",
        normalizer_version="v999",  # ← doesn't match service's "v1"
        raw_column="x", canonical_field="y", domain=None, role=None,
        mapper_method="rule", confidence=0.9,
    )
    with pytest.raises(ValueError, match="doesn't match service's"):
        await registry.upsert_many([entry])
