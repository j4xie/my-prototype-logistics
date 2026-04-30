"""Stage 5-8 short-circuit orchestration.

Runs stages in order: SEMANTIC → CLASSIFIER → FUSION → LLM. Short-circuits
on strong signal at each stage per Java pipeline behavior:

- Stage 5 SEMANTIC: if confidence >= AI_SEMANTIC_THRESHOLD (default 0.85),
  skip 6/7/8.
- Stage 6 CLASSIFIER: always runs if stage 5 didn't short-circuit.
- Stage 7 FUSION: combines stage 5 + 6, if confidence >= AI_FUSION_THRESHOLD
  (default 0.70), skip stage 8.
- Stage 8 LLM: only runs if FUSION didn't short-circuit AND `enable_llm=True`.
- All stages empty: return IntentMatchResultDto.empty(userInput=query).

Failure tolerance: each matcher exception is logged and treated as []. One
matcher's failure does not abort the pipeline; orchestration continues to
the next stage.

Builds final IntentMatchResultDto with all 19 top-level fields populated 1:1
with Java IntentMatchResult shape.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from ai.db import row_to_dto
from ai.dto import (
    ActionType,
    AIIntentConfigDto,
    CandidateIntentDto,
    IntentMatchResultDto,
    MatchMethod,
    QuestionType,
)
from ai.matcher import fusion as fusion_module
from ai.matcher import semantic as semantic_module

logger = logging.getLogger(__name__)


class Orchestrator:
    """Composes the 4 stage matchers into a short-circuit pipeline.

    β extension: optionally accepts a SemanticRouter for pre-stage 3-tier routing.
    If router=None, behaves as α (runs all stages 5-8 short-circuit).
    """

    def __init__(self, semantic_matcher, classifier_matcher, llm_matcher, semantic_router=None):
        self.semantic_matcher = semantic_matcher
        self.classifier_matcher = classifier_matcher
        self.llm_matcher = llm_matcher
        self.semantic_router = semantic_router  # β: optional pre-stage router

    async def match(
        self,
        query: str,
        factoryId: str,
        businessType: str,
        userId: str,
        role: str,
        visible_intents: List[Dict[str, Any]],
        history: List[Dict[str, Any]],
        min_confidence: float,
        enable_llm: bool = True,
    ) -> IntentMatchResultDto:
        """Run stages 5-8 short-circuit, return Java-shaped result.

        β: if a semantic_router was provided, runs pre-stage routing first and
        honors its decision (DIRECT_EXECUTE / NEED_RERANKING / NEED_FULL_LLM).
        Without a router, behaves identically to α.
        """
        t0 = time.time()
        timing: Dict[str, int] = {}

        # ===== β Stage 0: SemanticRouter (optional) =====
        skip_stage_8_due_to_reranking = False
        if self.semantic_router is not None:
            t_router = time.time()
            try:
                decision = await self.semantic_router.route(
                    query=query, visible_intents=visible_intents,
                    factoryId=factoryId, businessType=businessType,
                )
            except Exception:
                logger.exception("SemanticRouter failed, falling through to all stages")
                decision = None
            timing["routerMs"] = int((time.time() - t_router) * 1000)

            if decision is not None:
                if decision.method == "DIRECT_EXECUTE":
                    logger.info(
                        "SemanticRouter DIRECT_EXECUTE (top conf=%.3f)",
                        decision.candidates[0].confidence if decision.candidates else 0.0,
                    )
                    timing["totalMs"] = int((time.time() - t0) * 1000)
                    return self._build_result(
                        query=query,
                        top_candidates=decision.candidates,
                        method=MatchMethod.SEMANTIC,
                        visible_intents=visible_intents,
                        min_confidence=min_confidence,
                        timing=timing,
                    )
                elif decision.method == "NEED_RERANKING":
                    skip_stage_8_due_to_reranking = True
                # NEED_FULL_LLM falls through, all stages run

        # ===== Stage 5 SEMANTIC =====
        t_stage_start = time.time()
        try:
            sem_candidates = await self.semantic_matcher.match(
                query, factoryId=factoryId, businessType=businessType
            )
        except Exception:
            logger.exception("Stage 5 SEMANTIC failed, treating as empty")
            sem_candidates = []
        timing["semanticMs"] = int((time.time() - t_stage_start) * 1000)

        if semantic_module.is_strong_signal(sem_candidates):
            logger.info(
                "Stage 5 SEMANTIC short-circuit (confidence=%.3f)",
                sem_candidates[0].confidence,
            )
            timing["totalMs"] = int((time.time() - t0) * 1000)
            return self._build_result(
                query=query,
                top_candidates=sem_candidates,
                method=MatchMethod.SEMANTIC,
                visible_intents=visible_intents,
                min_confidence=min_confidence,
                timing=timing,
            )

        # ===== Stage 6 CLASSIFIER =====
        t_stage_start = time.time()
        try:
            cls_candidates = await self.classifier_matcher.match(
                query, factoryId=factoryId, businessType=businessType
            )
        except Exception:
            logger.exception("Stage 6 CLASSIFIER failed, treating as empty")
            cls_candidates = []
        timing["classifierMs"] = int((time.time() - t_stage_start) * 1000)

        # ===== Stage 7 FUSION =====
        if sem_candidates or cls_candidates:
            fused = fusion_module.fuse(sem_candidates, cls_candidates)
            if fusion_module.is_strong_signal(fused):
                logger.info(
                    "Stage 7 FUSION short-circuit (confidence=%.3f)",
                    fused[0].confidence,
                )
                timing["totalMs"] = int((time.time() - t0) * 1000)
                return self._build_result(
                    query=query,
                    top_candidates=fused,
                    method=MatchMethod.FUSION,
                    visible_intents=visible_intents,
                    min_confidence=min_confidence,
                    timing=timing,
                )

        # ===== Stage 8 LLM =====
        # β: also skip if NEED_RERANKING decided
        if enable_llm and not skip_stage_8_due_to_reranking:
            t_stage_start = time.time()
            try:
                llm_candidates = await self.llm_matcher.match(
                    query, visible_intents=visible_intents, history=history
                )
            except Exception:
                logger.exception("Stage 8 LLM failed, treating as empty")
                llm_candidates = []
            timing["llmMs"] = int((time.time() - t_stage_start) * 1000)

            if llm_candidates:
                logger.info(
                    "Stage 8 LLM result: %s @ %.3f",
                    llm_candidates[0].intentCode,
                    llm_candidates[0].confidence,
                )
                timing["totalMs"] = int((time.time() - t0) * 1000)
                return self._build_result(
                    query=query,
                    top_candidates=llm_candidates,
                    method=MatchMethod.LLM,
                    visible_intents=visible_intents,
                    min_confidence=min_confidence,
                    timing=timing,
                )

        # ===== No match =====
        logger.info("All stages 5-8 returned empty for query=%r", query[:80])
        timing["totalMs"] = int((time.time() - t0) * 1000)
        result = IntentMatchResultDto.empty(userInput=query)
        result.timingMs = timing
        return result

    def _build_result(
        self,
        query: str,
        top_candidates: List[CandidateIntentDto],
        method: MatchMethod,
        visible_intents: List[Dict[str, Any]],
        min_confidence: float,
        timing: Dict[str, int],
    ) -> IntentMatchResultDto:
        """Build full IntentMatchResultDto from top candidates.

        Populates all 19 top-level fields per Java IntentMatchResult shape.
        Falls back to IntentMatchResultDto.empty() if top_candidates is empty
        (defensive — should not happen on the matched path).
        """
        # I2 fix: filter candidates to visible scope (info-leak prevention).
        # Classifier (stage 6) returns predictions for any trained intent_code,
        # including codes outside this user's factory/business scope. Strip them
        # before they reach topCandidates / bestMatch, otherwise an out-of-scope
        # code can leak via topCandidates[0].intentCode even when bestMatch is
        # None (the downstream meta lookup already filters bestMatch).
        visible_codes = {i.get("intent_code") for i in visible_intents}
        top_candidates = [c for c in top_candidates if c.intentCode in visible_codes]

        if not top_candidates:
            result = IntentMatchResultDto.empty(userInput=query)
            result.timingMs = timing
            return result

        top1 = top_candidates[0]
        top1_conf = top1.confidence or 0.0

        # Find full config row for top1 → convert via row_to_dto for byte-shape
        # parity with Java AIIntentConfig serialization.
        meta = next(
            (i for i in visible_intents if i.get("intent_code") == top1.intentCode),
            None,
        )
        best_match: Optional[AIIntentConfigDto] = (
            row_to_dto(meta) if meta else None
        )

        # Strong signal: confidence >= 0.7 AND (only 1 candidate OR top1-top2
        # gap > 0.3). Mirrors Java IntentMatchResult.isStrongSignal heuristic.
        is_strong = False
        if top1_conf >= 0.7:
            if len(top_candidates) < 2:
                is_strong = True
            else:
                top2_conf = top_candidates[1].confidence or 0.0
                gap = top1_conf - top2_conf
                is_strong = gap > 0.3

        # requiresConfirmation: top1 confidence below caller's threshold →
        # caller (Java side) should ask user to confirm/disambiguate.
        requires_confirmation = top1_conf < min_confidence

        # questionType: best-effort guess from intent_category. Java side
        # generates more sophisticated classification via IntentKnowledgeBase;
        # here we map a few obvious categories to the corresponding enum.
        # Default OPERATIONAL_COMMAND for action-style intents.
        q_type: QuestionType = QuestionType.OPERATIONAL_COMMAND
        if best_match and best_match.intentCategory:
            cat = best_match.intentCategory
            if cat == "CONVERSATIONAL":
                q_type = QuestionType.CONVERSATIONAL
            elif cat == "GENERAL_QUESTION":
                q_type = QuestionType.GENERAL_QUESTION

        return IntentMatchResultDto(
            bestMatch=best_match,
            topCandidates=top_candidates[:5],  # cap to top-5 for response
            confidence=top1_conf,
            matchMethod=method,
            matchedKeywords=top1.matchedKeywords or [],
            isStrongSignal=is_strong,
            requiresConfirmation=requires_confirmation,
            clarificationQuestion=None,  # Java side generates dynamically
            userInput=query,
            actionType=ActionType.QUERY,  # default; Java may infer better
            questionType=q_type,
            targetEntity=None,
            sessionId=None,
            conversationMessage=None,
            isMultiIntent=False,
            additionalIntents=None,
            executionStrategy=None,
            timingMs=timing,
            preprocessedQuery=None,
        )


__all__ = ["Orchestrator"]
