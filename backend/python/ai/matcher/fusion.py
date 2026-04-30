"""Stage 7: FUSION — weighted combination of stage 5 + stage 6.

Combines SEMANTIC + CLASSIFIER candidate lists by intent_code. For each
intent_code present in either list, fused score = w_sem * sem_score +
w_cls * cls_score (missing side contributes 0). Default weights 0.6/0.4 per
spec §6 baseline; tunable via call-site override.

Returned candidates carry MatchMethod.FUSION. Sorted desc by fused confidence.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from ai.config import default_config
from ai.dto import CandidateIntentDto, MatchMethod


def fuse(
    sem: List[CandidateIntentDto],
    cls: List[CandidateIntentDto],
    w_sem: float = 0.6,
    w_cls: float = 0.4,
) -> List[CandidateIntentDto]:
    """Combine semantic + classifier candidate lists by intent_code.

    Args:
        sem: Stage 5 candidates (matchMethod=SEMANTIC).
        cls: Stage 6 candidates (matchMethod=CLASSIFIER).
        w_sem: Weight applied to semantic confidence.
        w_cls: Weight applied to classifier confidence.

    Returns:
        Sorted-desc list of FUSION candidates. Empty if both inputs empty.

    Note:
        intent_name and intent_category preferred from semantic side (DB-loaded
        with proper enrichment); falls back to classifier-side label_name when
        only classifier sees the intent.
    """
    by_code: Dict[str, Dict[str, Optional[object]]] = {}

    # Stage 5 sets the baseline (semantic has richer metadata from pgvector
    # row including intent_category + description).
    for c in sem:
        by_code[c.intentCode] = {
            "sem": c.confidence,
            "cls": 0.0,
            "name": c.intentName,
            "category": c.intentCategory,
            "description": c.description,
        }

    # Merge / introduce classifier-only intent codes. When the same intent
    # appears in both, only update cls score; preserve semantic-side metadata
    # unless it was missing.
    for c in cls:
        if c.intentCode in by_code:
            by_code[c.intentCode]["cls"] = c.confidence
            if not by_code[c.intentCode].get("description"):
                by_code[c.intentCode]["description"] = c.description
        else:
            by_code[c.intentCode] = {
                "sem": 0.0,
                "cls": c.confidence,
                "name": c.intentName,
                "category": c.intentCategory,
                "description": c.description,
            }

    fused: List[CandidateIntentDto] = []
    for code, vals in by_code.items():
        confidence = w_sem * float(vals["sem"]) + w_cls * float(vals["cls"])
        fused.append(CandidateIntentDto(
            intentCode=code,
            intentName=str(vals["name"]) if vals.get("name") is not None else code,
            intentCategory=vals.get("category"),
            confidence=confidence,
            matchMethod=MatchMethod.FUSION,
            description=vals.get("description"),
        ))

    fused.sort(key=lambda c: (c.confidence or 0.0), reverse=True)
    return fused


def is_strong_signal(candidates: List[CandidateIntentDto]) -> bool:
    """Stage 7 short-circuit threshold.

    Returns True if the top candidate's fused confidence >= AI_FUSION_THRESHOLD
    (default 0.70). Caller (orchestrator) skips stage 8 LLM fallback when True.
    """
    if not candidates:
        return False
    top = candidates[0].confidence or 0.0
    return top >= default_config.fusion_threshold
