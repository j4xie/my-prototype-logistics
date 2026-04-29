"""Unit tests for template_rag.hybrid_match.

Tests mock `cosine_topk` so they don't require DashScope or pgvector —
we're testing the SCORING rules, not the vector search itself.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from smartbi.services.template_rag import (
    hybrid_match, HybridMatch, HIGH_CONFIDENCE, MIN_USEFUL,
)


@pytest.mark.asyncio
async def test_keyword_and_vector_agree_returns_keyword():
    pool = AsyncMock()
    with patch(
        "smartbi.services.template_rag.cosine_topk",
        new=AsyncMock(return_value=[("dish_sales_top_n", 0.92, "菜品销量 Top 10")]),
    ):
        r = await hybrid_match(pool, "菜品销量排行", keyword_code="dish_sales_top_n")
    assert r is not None
    assert r.template_code == "dish_sales_top_n"
    assert r.via == "keyword+vector"
    assert r.similarity == 0.92


@pytest.mark.asyncio
async def test_keyword_wins_when_vector_disagrees():
    pool = AsyncMock()
    with patch(
        "smartbi.services.template_rag.cosine_topk",
        new=AsyncMock(return_value=[("monthly_anomaly", 0.88, "哪个月异常")]),
    ):
        r = await hybrid_match(pool, "菜品销量 Top", keyword_code="dish_sales_top_n")
    assert r is not None
    assert r.template_code == "dish_sales_top_n"
    assert r.via == "keyword_only"


@pytest.mark.asyncio
async def test_vector_only_high_confidence_returns_vector():
    pool = AsyncMock()
    with patch(
        "smartbi.services.template_rag.cosine_topk",
        new=AsyncMock(return_value=[("staff_performance", 0.91, "服务员排名")]),
    ):
        r = await hybrid_match(pool, "谁是销售冠军", keyword_code=None)
    assert r is not None
    assert r.template_code == "staff_performance"
    assert r.via == "vector_only"
    assert r.similarity == 0.91


@pytest.mark.asyncio
async def test_vector_only_ambiguous_returns_none():
    """0.70 ≤ sim < 0.85 with no keyword match → None (LLM fallback)."""
    pool = AsyncMock()
    with patch(
        "smartbi.services.template_rag.cosine_topk",
        new=AsyncMock(return_value=[("dish_sales_top_n", 0.78, "菜品销量")]),
    ):
        r = await hybrid_match(pool, "卖得咋样", keyword_code=None)
    assert r is None


@pytest.mark.asyncio
async def test_empty_candidates_with_keyword_falls_back_to_keyword_only():
    """Vector returned nothing (all below MIN_USEFUL) — trust keyword."""
    pool = AsyncMock()
    with patch(
        "smartbi.services.template_rag.cosine_topk",
        new=AsyncMock(return_value=[]),
    ):
        r = await hybrid_match(pool, "xyz", keyword_code="top_n_by_dim")
    assert r is not None
    assert r.template_code == "top_n_by_dim"
    assert r.via == "keyword_only"


@pytest.mark.asyncio
async def test_empty_candidates_no_keyword_returns_none():
    pool = AsyncMock()
    with patch(
        "smartbi.services.template_rag.cosine_topk",
        new=AsyncMock(return_value=[]),
    ):
        r = await hybrid_match(pool, "totally novel query", keyword_code=None)
    assert r is None


@pytest.mark.asyncio
async def test_constants_sanity():
    """HIGH_CONFIDENCE > MIN_USEFUL (otherwise the logic is inconsistent)."""
    assert HIGH_CONFIDENCE > MIN_USEFUL
    assert 0 < MIN_USEFUL < HIGH_CONFIDENCE <= 1.0
