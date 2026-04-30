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


# ======================================================================
# β extension: SemanticRouter pre-stage integration (T3)
# ======================================================================


@pytest.mark.asyncio
async def test_direct_execute_skips_stages_5_to_8():
    """SemanticRouter DIRECT_EXECUTE -> no stage matchers called, candidate returned directly."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    direct_candidate = CandidateIntentDto(
        intentCode="INVENTORY_QUERY", intentName="库存查询",
        confidence=0.95, matchMethod=MatchMethod.SEMANTIC,
    )
    fake_decision = RouteDecision(
        method="DIRECT_EXECUTE",
        ood_detected=False,
        candidates=[direct_candidate],
        query_embedding=[0.1] * 768,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock()
    fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher, semantic_router=fake_router)
    result = await orch.match(
        query="查库存",
        factoryId="F001", businessType="FACTORY", userId="22",
        role="factory_super_admin",
        visible_intents=[make_intent_row("INVENTORY_QUERY", "库存查询",
                                          tool_name="material_inventory_query")],
        history=[],
        min_confidence=0.7,
    )
    assert result.matchMethod == MatchMethod.SEMANTIC
    assert result.bestMatch is not None
    assert result.bestMatch.intentCode == "INVENTORY_QUERY"
    sem_matcher.match.assert_not_called()
    cls_matcher.match.assert_not_called()
    llm_matcher.match.assert_not_called()


@pytest.mark.asyncio
async def test_need_reranking_runs_stages_5_6_7_skips_8():
    """NEED_RERANKING -> run sem+cls+fusion, skip llm."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    cand = CandidateIntentDto(intentCode="X", intentName="X", confidence=0.5,
                                matchMethod=MatchMethod.SEMANTIC)
    fake_decision = RouteDecision(
        method="NEED_RERANKING",
        ood_detected=False,
        candidates=[cand],
        query_embedding=[0.1] * 768,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[cand])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher, semantic_router=fake_router)
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("X")], history=[], min_confidence=0.7,
    )
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_not_called()


@pytest.mark.asyncio
async def test_need_full_llm_runs_all_stages():
    """NEED_FULL_LLM -> run sem+cls+fusion+llm (alpha path)."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    fake_decision = RouteDecision(
        method="NEED_FULL_LLM",
        ood_detected=False,
        candidates=[],
        query_embedding=[0.1] * 768,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher, semantic_router=fake_router)
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_called_once()


@pytest.mark.asyncio
async def test_no_router_falls_back_to_alpha_behavior():
    """If semantic_router=None (alpha-style construction), behave like alpha (run all stages)."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7,
    )
    sem_matcher.match.assert_called_once()


@pytest.mark.asyncio
async def test_stage_8_uses_tier_selector_when_provided():
    """Orchestrator passes tier hint from LlmTierSelector to llm_matcher."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.llm_tier_selector import LlmTier
    from ai.router.semantic_router import RouteDecision

    fake_decision = RouteDecision(
        method="NEED_FULL_LLM", ood_detected=False, candidates=[],
        query_embedding=None,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)
    fake_tier = MagicMock(); fake_tier.select = AsyncMock(return_value=LlmTier.CHEAP)

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router, llm_tier_selector=fake_tier,
    )
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    fake_tier.select.assert_called_once_with(query="q")
    call_kwargs = llm_matcher.match.call_args.kwargs
    assert call_kwargs.get("tier") == LlmTier.CHEAP


# ======================================================================
# β extension: Calibrator + IntentScorer integration (T8)
# ======================================================================


@pytest.mark.asyncio
async def test_orchestrator_calibrates_before_build_result():
    """Calibrator with empty coefs (cold-start) → confidence unchanged → α behavior preserved."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision
    from ai.scoring.calibration import Calibrator
    from ai.scoring.intent_scoring import IntentScorer

    cand = CandidateIntentDto(intentCode="X", intentName="X名", confidence=0.85,
                                matchMethod=MatchMethod.SEMANTIC)
    fake_decision = RouteDecision(method="DIRECT_EXECUTE", ood_detected=False,
                                    candidates=[cand], query_embedding=None)
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    cal = Calibrator(coefs={})  # cold-start passthrough
    scorer = IntentScorer()

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router, calibrator=cal, scorer=scorer,
    )
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("X", "X名")], history=[], min_confidence=0.7,
    )
    # Cold-start calibrator → confidence unchanged
    assert result.confidence == 0.85


@pytest.mark.asyncio
async def test_orchestrator_calibration_with_real_coefs():
    """Calibrator with non-empty coefs → confidence transformed."""
    import math
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision
    from ai.scoring.calibration import Calibrator

    cand = CandidateIntentDto(intentCode="X", intentName="X名", confidence=0.85,
                                matchMethod=MatchMethod.SEMANTIC)
    fake_decision = RouteDecision(method="DIRECT_EXECUTE", ood_detected=False,
                                    candidates=[cand], query_embedding=None)
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    # Coefs for SEMANTIC matcher in factory F: alpha=2, beta=-1
    cal = Calibrator(coefs={("SEMANTIC", "F"): (2.0, -1.0)})

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router, calibrator=cal,
    )
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("X", "X名")], history=[], min_confidence=0.7,
    )
    expected = 1 / (1 + math.exp(-(2.0 * 0.85 + (-1.0))))
    assert abs(result.confidence - expected) < 0.001


# ======================================================================
# β extension: RAG retrieval + evaluation in stage 8 (T11, C5)
# ======================================================================


@pytest.mark.asyncio
async def test_stage_8_uses_rag_when_high_quality():
    """RAG retrieval HIGH quality → cases passed to llm_matcher."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision
    from ai.rag.retrieval import RAGCase
    from ai.rag.evaluator import RAGQuality

    fake_decision = RouteDecision(method="NEED_FULL_LLM", ood_detected=False,
                                    candidates=[], query_embedding=None)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    high_quality_cases = [RAGCase(query="hist", intent_code="X", confidence=0.95,
                                    similarity=0.90, source="match_record")]
    fake_retriever = MagicMock()
    fake_retriever.retrieve = AsyncMock(return_value=high_quality_cases)
    fake_evaluator = MagicMock()
    fake_evaluator.evaluate = MagicMock(return_value=RAGQuality.HIGH)

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router,
        rag_retriever=fake_retriever, rag_evaluator=fake_evaluator,
    )
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    fake_retriever.retrieve.assert_called_once()
    call_kwargs = llm_matcher.match.call_args.kwargs
    assert call_kwargs.get("rag_cases") == high_quality_cases


@pytest.mark.asyncio
async def test_stage_8_skips_rag_when_unreliable():
    """RAG UNRELIABLE → empty rag_cases."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision
    from ai.rag.retrieval import RAGCase
    from ai.rag.evaluator import RAGQuality

    fake_decision = RouteDecision(method="NEED_FULL_LLM", ood_detected=False,
                                    candidates=[], query_embedding=None)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    fake_retriever = MagicMock()
    fake_retriever.retrieve = AsyncMock(return_value=[])
    fake_evaluator = MagicMock()
    fake_evaluator.evaluate = MagicMock(return_value=RAGQuality.UNRELIABLE)

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router,
        rag_retriever=fake_retriever, rag_evaluator=fake_evaluator,
    )
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    call_kwargs = llm_matcher.match.call_args.kwargs
    assert call_kwargs.get("rag_cases") == []


@pytest.mark.asyncio
async def test_stage_8_no_rag_when_components_absent():
    """No retriever/evaluator → llm_matcher called with rag_cases=[]."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    fake_decision = RouteDecision(method="NEED_FULL_LLM", ood_detected=False,
                                    candidates=[], query_embedding=None)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router,
    )
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    call_kwargs = llm_matcher.match.call_args.kwargs
    # When no retriever, rag_cases either not passed OR passed as []
    rag_cases = call_kwargs.get("rag_cases")
    assert rag_cases is None or rag_cases == []
