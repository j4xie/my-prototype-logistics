"""LLM tier selector — choose cheap vs expensive LLM based on small-model classification."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_simple_query_picks_cheap_tier():
    """Small LLM says 'simple' → tier='cheap'."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    fake_response = '{"complexity": "simple", "reasoning": "single intent"}'
    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(return_value=fake_response)):
        selector = LlmTierSelector()
        tier = await selector.select(query="查库存")
    assert tier == LlmTier.CHEAP


@pytest.mark.asyncio
async def test_complex_query_picks_expensive_tier():
    """Small LLM says 'complex' → tier='expensive'."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    fake_response = '{"complexity": "complex", "reasoning": "multi-step analysis"}'
    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(return_value=fake_response)):
        selector = LlmTierSelector()
        tier = await selector.select(query="对比 F001 vs F002 三个月销售趋势并预测下季度")
    assert tier == LlmTier.EXPENSIVE


@pytest.mark.asyncio
async def test_classifier_failure_defaults_to_expensive():
    """Small LLM fails → default to EXPENSIVE for safety."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(side_effect=TimeoutError())):
        selector = LlmTierSelector()
        tier = await selector.select(query="anything")
    assert tier == LlmTier.EXPENSIVE


@pytest.mark.asyncio
async def test_malformed_json_defaults_to_expensive():
    """Garbage JSON → default EXPENSIVE."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(return_value="not json")):
        selector = LlmTierSelector()
        tier = await selector.select(query="anything")
    assert tier == LlmTier.EXPENSIVE
