"""End-to-end β orchestrator: all 5 sub-modules wired together."""
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


def _intent_row_with_emb(intent_code: str, intent_name: str, embedding: list,
                            factory_id=None, business_type="COMMON"):
    """Helper: snapshot row with embedding column."""
    return {
        "id": f"u-{intent_code}",
        "intent_code": intent_code,
        "intent_name": intent_name,
        "intent_category": "ANALYSIS",
        "tool_name": "x",
        "description": "d",
        "factory_id": factory_id,
        "business_type": business_type,
        "is_active": True,
        "priority": 80,
        "config_version": 1,
        "sensitivity_level": "LOW",
        "max_tokens": 2000,
        "quota_cost": 1,
        "cache_ttl_minutes": 0,
        "requires_approval": False,
        "negative_keyword_penalty": 15,
        "confidence_boost": 0.0,
        "embedding": embedding,
    }


@pytest.mark.asyncio
async def test_full_pipeline_direct_execute_path():
    """Real SemanticRouter + Calibrator (cold-start passthrough) + Scorer.
    Query nearly identical to intent embedding → DIRECT_EXECUTE → matchers NOT called."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import SemanticRouter
    from ai.scoring.calibration import Calibrator
    from ai.scoring.intent_scoring import IntentScorer

    real_router = SemanticRouter()
    real_cal = Calibrator(coefs={})  # cold-start passthrough
    real_scorer = IntentScorer()

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    intent_row = _intent_row_with_emb(
        "INVENTORY", "库存", embedding=[1.0, 0.0, 0.0] + [0.0] * 765,
    )

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=real_router, calibrator=real_cal, scorer=real_scorer,
    )
    with patch("ai.embedding.get_embedding_cached",
               new=AsyncMock(return_value=[1.0, 0.0, 0.0] + [0.0] * 765)):
        result = await orch.match(
            query="查库存", factoryId="F001", businessType="FACTORY",
            userId="22", role="factory_super_admin",
            visible_intents=[intent_row], history=[], min_confidence=0.7,
        )
    assert result.matchMethod == MatchMethod.SEMANTIC
    assert result.bestMatch is not None
    assert result.bestMatch.intentCode == "INVENTORY"
    sem_matcher.match.assert_not_called()
    cls_matcher.match.assert_not_called()
    llm_matcher.match.assert_not_called()


@pytest.mark.asyncio
async def test_full_pipeline_ood_runs_all_stages_with_flag():
    """OOD query (cosine ≈ 0 < 0.3) → still runs stages 5-8, ood flag set."""
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import SemanticRouter

    real_router = SemanticRouter()
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    intent_row = _intent_row_with_emb(
        "INVENTORY", "库存", embedding=[1.0, 0.0, 0.0] + [0.0] * 765,
    )

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher,
                          semantic_router=real_router)
    # Orthogonal query → cosine 0
    with patch("ai.embedding.get_embedding_cached",
               new=AsyncMock(return_value=[0.0, 1.0, 0.0] + [0.0] * 765)):
        await orch.match(
            query="完全无关", factoryId="F001", businessType="FACTORY",
            userId="22", role="r",
            visible_intents=[intent_row], history=[], min_confidence=0.7, enable_llm=True,
        )
    # OOD: cosine 0 < 0.3, but stages still run (flag-only behavior)
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_called_once()


@pytest.mark.asyncio
async def test_full_pipeline_with_rag_components():
    """Pipeline with all components including RAG retriever + evaluator."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import SemanticRouter, RouteDecision
    from ai.rag.retrieval import RAGCase
    from ai.rag.evaluator import RAGQuality

    # Force NEED_FULL_LLM by mocking router to return that decision (real router would
    # require very specific embeddings; mock simplifies test)
    fake_decision = RouteDecision(
        method="NEED_FULL_LLM", ood_detected=False, candidates=[],
        query_embedding=[0.1] * 768,
    )
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    high_q_cases = [RAGCase(query="历史", intent_code="X", confidence=0.95,
                              similarity=0.90, source="match_record")]
    fake_retriever = MagicMock()
    fake_retriever.retrieve = AsyncMock(return_value=high_q_cases)
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
    # Verify RAG components called
    fake_retriever.retrieve.assert_called_once()
    fake_evaluator.evaluate.assert_called_once()
    # llm_matcher received rag_cases
    call_kwargs = llm_matcher.match.call_args.kwargs
    assert call_kwargs.get("rag_cases") == high_q_cases
