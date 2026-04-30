"""ai/matcher/llm.py — LLM-based intent selection (stage 8)."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_llm_match_returns_candidate_when_intent_recognized():
    """LLM returns valid intent_code → matcher returns single candidate."""
    fake_llm_response = json.dumps({
        "intentCode": "INVENTORY_QUERY",
        "confidence": 0.85,
        "reasoning": "User asks about stock"
    })
    visible_intents = [
        {"intent_code": "INVENTORY_QUERY", "intent_name": "库存查询",
         "description": "查询库存", "example_queries": '["查库存","看库存"]'},
        {"intent_code": "OTHER_INTENT", "intent_name": "其他",
         "description": "x", "example_queries": "[]"},
    ]
    with patch("ai.matcher.llm._call_llm", new=AsyncMock(return_value=fake_llm_response)):
        from ai.matcher.llm import LlmMatcher
        matcher = LlmMatcher()
        cands = await matcher.match(
            "查 F001 工厂的库存",
            visible_intents=visible_intents,
            history=[],
        )
        assert len(cands) == 1
        assert cands[0].intentCode == "INVENTORY_QUERY"
        assert cands[0].confidence == 0.85


@pytest.mark.asyncio
async def test_llm_match_returns_empty_when_llm_says_unknown():
    fake_llm_response = json.dumps({
        "intentCode": None,
        "confidence": 0.0,
        "reasoning": "Cannot map"
    })
    with patch("ai.matcher.llm._call_llm", new=AsyncMock(return_value=fake_llm_response)):
        from ai.matcher.llm import LlmMatcher
        matcher = LlmMatcher()
        cands = await matcher.match(
            "随便聊聊",
            visible_intents=[{"intent_code": "X", "intent_name": "X",
                              "description": "x", "example_queries": "[]"}],
            history=[],
        )
        assert cands == []


@pytest.mark.asyncio
async def test_llm_match_handles_malformed_json():
    with patch("ai.matcher.llm._call_llm", new=AsyncMock(return_value="not json")):
        from ai.matcher.llm import LlmMatcher
        matcher = LlmMatcher()
        cands = await matcher.match(
            "查询",
            visible_intents=[{"intent_code": "X", "intent_name": "X",
                              "description": "x", "example_queries": "[]"}],
            history=[],
        )
        assert cands == []


@pytest.mark.asyncio
async def test_llm_match_returns_empty_on_timeout():
    with patch("ai.matcher.llm._call_llm", new=AsyncMock(side_effect=TimeoutError())):
        from ai.matcher.llm import LlmMatcher
        matcher = LlmMatcher()
        cands = await matcher.match(
            "查询",
            visible_intents=[{"intent_code": "X", "intent_name": "X",
                              "description": "x", "example_queries": "[]"}],
            history=[],
        )
        assert cands == []


def test_build_prompt_contains_intent_examples():
    from ai.matcher.llm import build_prompt
    intents = [
        {"intent_code": "X", "intent_name": "X名", "description": "X描述",
         "example_queries": '["示例1","示例2"]'},
    ]
    prompt = build_prompt(query="测试", visible_intents=intents, history=[])
    assert "X" in prompt
    assert "X名" in prompt
    assert "X描述" in prompt
    assert "示例1" in prompt
    assert "测试" in prompt
