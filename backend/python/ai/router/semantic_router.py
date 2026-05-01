"""Stage 0 SemanticRouter — 3-tier decision + OOD flag (β C1).

Runs ONCE per query before stages 5-8. Computes query embedding (cached via
ai.embedding.get_embedding_cached, so stage 5 SEMANTIC reuses it). Calculates
cosine similarity vs all factory-visible intent embeddings.

Decision matrix:
- max_sim >= 0.92  -> DIRECT_EXECUTE (skip stages 5-8, return top candidate immediately)
- 0.75 <= max < 0.92 -> NEED_RERANKING (run stages 5+6+7 only, skip 8 LLM)
- max_sim < 0.75   -> NEED_FULL_LLM (run stages 5+6+7+8 full pipeline)
- max_sim < 0.30   -> ALSO sets ood_detected=True (flag only, doesn't block stages)

CR-7 fix: visible_intents already filtered by factory_id + business_type via
ai.db.filter_intents_for_request. SemanticRouter NEVER sees out-of-scope intents.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional

from ai import embedding as embedding_module
from ai.dto import CandidateIntentDto, MatchMethod

logger = logging.getLogger(__name__)


# Thresholds (config-overridable later)
DIRECT_EXECUTE_THRESHOLD = 0.92
NEED_RERANKING_THRESHOLD = 0.75
OOD_THRESHOLD = 0.30


@dataclass
class RouteDecision:
    """SemanticRouter output. Consumed by orchestrator."""

    method: Literal["DIRECT_EXECUTE", "NEED_RERANKING", "NEED_FULL_LLM"]
    ood_detected: bool
    candidates: List[CandidateIntentDto] = field(default_factory=list)
    query_embedding: Optional[List[float]] = None  # for stage 5 reuse


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine of two equal-length vectors. Returns 0.0 if either is zero-vector."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class SemanticRouter:
    """Pre-stage router using cosine similarity to all visible intent embeddings."""

    def __init__(self, top_k: int = 5):
        self.top_k = top_k

    async def route(
        self,
        query: str,
        visible_intents: List[Dict],
        factoryId: str,
        businessType: str,
    ) -> RouteDecision:
        """Compute query embedding, cosine vs all intents, decide tier.

        visible_intents must already be factory_id+business_type filtered by caller.
        """
        query_emb = await embedding_module.get_embedding_cached(query)
        if query_emb is None:
            logger.warning("SemanticRouter: embedding unavailable, fall through to NEED_FULL_LLM")
            return RouteDecision(
                method="NEED_FULL_LLM", ood_detected=False, candidates=[],
                query_embedding=None,
            )

        rows_with_emb = [r for r in visible_intents if r.get("embedding")]
        if not rows_with_emb:
            logger.info("SemanticRouter: no visible intents with embeddings, fall through")
            return RouteDecision(
                method="NEED_FULL_LLM", ood_detected=False, candidates=[],
                query_embedding=query_emb,
            )

        scored = []
        for row in rows_with_emb:
            sim = _cosine_similarity(query_emb, row["embedding"])
            scored.append((sim, row))
        scored.sort(key=lambda x: x[0], reverse=True)

        top_k_scored = scored[: self.top_k]
        candidates = [
            CandidateIntentDto(
                intentCode=row["intent_code"],
                intentName=row["intent_name"],
                intentCategory=row.get("intent_category"),
                confidence=float(sim),
                matchMethod=MatchMethod.SEMANTIC,
                description=row.get("description"),
            )
            for sim, row in top_k_scored
        ]

        max_sim = scored[0][0] if scored else 0.0
        ood = max_sim < OOD_THRESHOLD
        if max_sim >= DIRECT_EXECUTE_THRESHOLD:
            method = "DIRECT_EXECUTE"
        elif max_sim >= NEED_RERANKING_THRESHOLD:
            method = "NEED_RERANKING"
        else:
            method = "NEED_FULL_LLM"

        logger.debug("SemanticRouter: max_sim=%.3f -> %s (ood=%s)", max_sim, method, ood)
        return RouteDecision(
            method=method,
            ood_detected=ood,
            candidates=candidates,
            query_embedding=query_emb,
        )
