"""ai/orchestrator.py — stage 5-8 short-circuit logic."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


# Helper: build a "visible_intents row" dict
def make_intent_row(intent_code: str, intent_name: str = None,
                    tool_name: str = "x", category: str = "ANALYSIS",
                    description: str = "d") -> dict:
    return {
        "id": f"uuid-{intent_code}",
        "factory_id": None,
        "business_type": "COMMON",
        "intent_code": intent_code,
        "intent_name": intent_name or intent_code,
        "intent_category": category,
        "sensitivity_level": "LOW",
        "tool_name": tool_name,
        "is_active": True,
        "priority": 80,
        "config_version": 1,
        "deleted_at": None,
        "keywords": "[]",
        "description": description,
        "max_tokens": 2000,
        "quota_cost": 1,
        "cache_ttl_minutes": 0,
        "requires_approval": False,
        "negative_keyword_penalty": 15,
        "confidence_boost": 0.0,
    }


@pytest.mark.asyncio
async def test_stage_5_short_circuit_when_strong():
    """Strong SEMANTIC signal → skip stages 6/7/8, return SEMANTIC result."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    sem_matcher = MagicMock()
    sem_matcher.match = AsyncMock(return_value=[
        CandidateIntentDto(intentCode="INVENTORY_QUERY", intentName="库存查询",
                            confidence=0.95, matchMethod=MatchMethod.SEMANTIC),
    ])
    cls_matcher = MagicMock()
    cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock()
    llm_matcher.match = AsyncMock(return_value=[])

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    result = await orch.match(
        query="查库存",
        factoryId="F001",
        businessType="FACTORY",
        userId="22",
        role="factory_super_admin",
        visible_intents=[make_intent_row("INVENTORY_QUERY", "库存查询",
                                          tool_name="material_inventory_query")],
        history=[],
        min_confidence=0.7,
    )
    assert result.matchMethod == MatchMethod.SEMANTIC
    assert result.bestMatch is not None
    assert result.bestMatch.intentCode == "INVENTORY_QUERY"
    assert result.confidence == 0.95
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_not_called()  # skipped due to short-circuit
    llm_matcher.match.assert_not_called()


@pytest.mark.asyncio
async def test_falls_through_to_classifier_when_semantic_weak():
    """Weak SEMANTIC → run CLASSIFIER, then FUSION."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    sem = [CandidateIntentDto(intentCode="A", intentName="A", confidence=0.4,
                                matchMethod=MatchMethod.SEMANTIC)]
    cls = [CandidateIntentDto(intentCode="A", intentName="A", confidence=0.85,
                                matchMethod=MatchMethod.CLASSIFIER)]

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=sem)
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=cls)
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("A", "A名")],
        history=[], min_confidence=0.7,
    )
    # Fusion: 0.6*0.4 + 0.4*0.85 = 0.58 — below 0.7 → falls to LLM (returns [])
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_called_once()


@pytest.mark.asyncio
async def test_returns_none_match_when_all_stages_fail():
    """All stages return [] → result with bestMatch=None, MatchMethod.NONE."""
    from ai.dto import MatchMethod
    from ai.orchestrator import Orchestrator

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[],
        history=[], min_confidence=0.7,
    )
    assert result.bestMatch is None
    assert result.matchMethod == MatchMethod.NONE
    assert result.confidence == 0.0
    assert result.userInput == "q"


@pytest.mark.asyncio
async def test_strong_signal_field_populated_correctly():
    """isStrongSignal True iff matched + confidence high + gap to next > 0.3."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    sem = [
        CandidateIntentDto(intentCode="A", intentName="A", confidence=0.95,
                            matchMethod=MatchMethod.SEMANTIC),
        CandidateIntentDto(intentCode="B", intentName="B", confidence=0.50,
                            matchMethod=MatchMethod.SEMANTIC),
    ]
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=sem)
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("A", "A名"), make_intent_row("B", "B名")],
        history=[], min_confidence=0.7,
    )
    assert result.isStrongSignal is True


@pytest.mark.asyncio
async def test_below_min_confidence_marked_low():
    """All stages weak → requiresConfirmation True."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm = [CandidateIntentDto(intentCode="X", intentName="X",
                                confidence=0.3, matchMethod=MatchMethod.LLM)]
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=llm)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("X", "X名")],
        history=[], min_confidence=0.7,
    )
    assert result.requiresConfirmation is True


@pytest.mark.asyncio
async def test_classifier_out_of_scope_intent_filtered_from_top_candidates():
    """I2: classifier returns intent_code not in visible_intents → filtered before
    reaching topCandidates (info-leak prevention)."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    # Classifier returns OUT-OF-SCOPE intent (RESTAURANT_MENU) for FACTORY user
    cls = [
        CandidateIntentDto(intentCode="RESTAURANT_MENU", intentName="菜单",
                            confidence=0.9, matchMethod=MatchMethod.CLASSIFIER),
    ]

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=cls)
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    # visible_intents has ONLY INVENTORY_QUERY (no RESTAURANT_MENU)
    result = await orch.match(
        query="q", factoryId="F001", businessType="FACTORY",
        userId="22", role="r",
        visible_intents=[make_intent_row("INVENTORY_QUERY", "库存查询")],
        history=[], min_confidence=0.7,
    )

    # RESTAURANT_MENU must NOT appear anywhere in the response
    assert result.bestMatch is None, "out-of-scope intent must not become bestMatch"
    leaked = any(c.intentCode == "RESTAURANT_MENU" for c in result.topCandidates)
    assert not leaked, "out-of-scope intent must be filtered from topCandidates"
