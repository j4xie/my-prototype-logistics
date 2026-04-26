"""Unit tests for LLMArbitrator."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.entity_resolution.agents.llm_arbitrator import (
    LLMArbitrator,
)
from smartbi.canonical.entity_resolution.orchestrator import (
    EntityType,
    ResolutionInput,
)


def _make_mock_pool():
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=AsyncMock())
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


def _input_with_candidates(candidates, ctx_extra=None):
    ctx = {"top_k_candidates": candidates}
    if ctx_extra:
        ctx.update(ctx_extra)
    return ResolutionInput(
        raw_name="桂满陇陆家嘴",
        entity_type=EntityType.STORE,
        factory_id="F001",
        context=ctx,
    )


async def test_no_candidates_returns_none():
    """Empty top_k_candidates → AgentResult(None, 0.0, ...)."""
    agent = LLMArbitrator(llm_fn=AsyncMock())
    pool = _make_mock_pool()

    result = await agent.resolve(_input_with_candidates([]), pool)

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "no candidates" in result.reasoning


async def test_llm_returns_match():
    """LLM returns valid JSON with matched_id from candidates → matched."""
    llm = AsyncMock(
        return_value='{"matched_id": 42, "confidence": 0.88, "reasoning": "同店"}'
    )
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates(
            [
                {"entity_id": 42, "name": "桂满陇", "sim": 0.78},
                {"entity_id": 99, "name": "桂满陇北京店", "sim": 0.65},
            ],
            ctx_extra={"city": "上海"},
        ),
        pool,
    )

    assert result.matched_entity_id == 42
    assert result.confidence == pytest.approx(0.88)
    assert "同店" in result.reasoning
    assert llm.await_count == 1


async def test_llm_returns_null_match():
    """LLM returns matched_id=null → AgentResult(None, confidence>=0, ...)."""
    llm = AsyncMock(
        return_value='{"matched_id": null, "confidence": 0.5, "reasoning": "都不是"}'
    )
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates(
            [{"entity_id": 1, "name": "X", "sim": 0.6}]
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == pytest.approx(0.5)


async def test_llm_hallucinated_id_rejected():
    """LLM returns id NOT in candidates → treated as null + confidence 0."""
    llm = AsyncMock(
        return_value='{"matched_id": 7777, "confidence": 0.99, "reasoning": "确定"}'
    )
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates(
            [
                {"entity_id": 1, "name": "A", "sim": 0.7},
                {"entity_id": 2, "name": "B", "sim": 0.6},
            ]
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "hallucinated" in result.reasoning.lower()


async def test_llm_invalid_json_returns_none():
    """LLM returns 'not json' → AgentResult(None, 0.0, parse error)."""
    llm = AsyncMock(return_value="this is definitely not JSON at all")
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates([{"entity_id": 1, "name": "A", "sim": 0.6}]),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "invalid JSON" in result.reasoning


async def test_llm_empty_response_returns_none():
    """LLM returns '' (provider failure) → AgentResult(None, 0.0, empty)."""
    llm = AsyncMock(return_value="")
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates([{"entity_id": 1, "name": "A", "sim": 0.6}]),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "empty" in result.reasoning


async def test_llm_tolerates_fenced_json():
    """LLM wraps JSON in ```json ... ``` fence → still parses."""
    fenced = (
        "```json\n"
        '{"matched_id": 1, "confidence": 0.7, "reasoning": "ok"}\n'
        "```"
    )
    llm = AsyncMock(return_value=fenced)
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates([{"entity_id": 1, "name": "A", "sim": 0.7}]),
        pool,
    )

    assert result.matched_entity_id == 1
    assert result.confidence == pytest.approx(0.7)


async def test_llm_confidence_clamped():
    """LLM returns confidence > 1.0 → clamped to 1.0."""
    llm = AsyncMock(
        return_value='{"matched_id": 1, "confidence": 1.5, "reasoning": "ok"}'
    )
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates([{"entity_id": 1, "name": "A", "sim": 0.6}]),
        pool,
    )

    assert result.confidence == 1.0


async def test_llm_exception_returns_none():
    """LLM call raises → AgentResult(None, 0.0, error reason)."""
    llm = AsyncMock(side_effect=RuntimeError("provider down"))
    agent = LLMArbitrator(llm_fn=llm)
    pool = _make_mock_pool()

    result = await agent.resolve(
        _input_with_candidates([{"entity_id": 1, "name": "A", "sim": 0.6}]),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "provider down" in result.reasoning


async def test_prompt_includes_raw_name_and_candidates():
    """Prompt contains raw_name and each candidate id/name/sim."""
    captured = {}

    async def fake_llm(prompt, system_role=None, **kwargs):
        captured["prompt"] = prompt
        captured["system_role"] = system_role
        captured["max_tokens"] = kwargs.get("max_tokens")
        return '{"matched_id": null, "confidence": 0.0, "reasoning": ""}'

    agent = LLMArbitrator(llm_fn=fake_llm)
    pool = _make_mock_pool()

    await agent.resolve(
        _input_with_candidates(
            [
                {"entity_id": 1, "name": "桂满陇", "sim": 0.78},
                {"entity_id": 2, "name": "桂满陇北京店", "sim": 0.65},
            ],
            ctx_extra={"city": "上海", "irrelevant": "drop_me"},
        ),
        pool,
    )

    p = captured["prompt"]
    assert "桂满陇陆家嘴" in p
    assert "id=1" in p and "id=2" in p
    assert "桂满陇北京店" in p
    assert captured["max_tokens"] == 300
    assert "实体识别专家" in (captured["system_role"] or "")
    # ctx filter: 'city' kept, 'irrelevant' dropped
    assert "上海" in p
    assert "drop_me" not in p
