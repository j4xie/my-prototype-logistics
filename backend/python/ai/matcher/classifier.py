"""Stage 6: CLASSIFIER — wrap existing classifier/ ONNX module.

Java currently calls into classifier/ via internal HTTP. This wrap exposes
the same semantics for ai/orchestrator. When the legacy Java path is fully
deprecated (Phase 3), this is the only consumer.

Underlying API (verified 2026-04-29):
    backend/python/classifier/services/intent_classifier.py exposes
    `IntentClassifierService.classify(text, top_k=N) -> dict` with shape:
        {"success": bool, "intents": [{"intent_code": str, "confidence": float,
         "label_id": int}, ...], "top_intent": ..., "entropy": float, ...}
    `intents` is already sorted desc by confidence.
    Module-level `get_classifier()` returns a lazy-init singleton.
"""
from __future__ import annotations

import asyncio
import logging
from functools import partial
from typing import Any, Callable, List, Tuple


async def _to_thread(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    """Python 3.8-compatible shim for asyncio.to_thread (added in 3.9).

    Server venv38 = Python 3.8.17; asyncio.to_thread raises AttributeError there.
    Per memory feedback_python_version_compat_deployment.md.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

from ai.dto import CandidateIntentDto, MatchMethod

logger = logging.getLogger(__name__)


def _predict(query: str) -> List[Tuple[str, float]]:
    """Sync call into existing classifier service.

    Wraps `classifier.services.IntentClassifierService.classify(text, top_k=10)`
    and adapts its dict output to `[(intent_code, confidence), ...]` (sorted
    desc by confidence). Returns [] if the model isn't loaded or classify
    reports failure (Tests mock this function — bare invocation requires
    classifier model to be loaded via ONNX_MODEL_PATH).

    Use asyncio.to_thread() at call site to avoid blocking event loop.
    """
    from classifier.services import get_classifier  # type: ignore

    classifier = get_classifier()
    result = classifier.classify(query, top_k=10)
    if not result.get("success"):
        return []
    intents = result.get("intents") or []
    return [
        (intent["intent_code"], float(intent["confidence"]))
        for intent in intents
        if "intent_code" in intent and "confidence" in intent
    ]


class ClassifierMatcher:
    """Stage 6 ONNX BERT classifier wrap."""

    def __init__(self, min_confidence: float = 0.05):
        self.min_confidence = min_confidence

    async def match(
        self,
        query: str,
        factoryId: str,
        businessType: str,
    ) -> List[CandidateIntentDto]:
        """Run classifier in thread (sync fn) and convert results."""
        try:
            predictions = await _to_thread(_predict, query)
        except Exception:
            logger.exception("Stage 6 CLASSIFIER failed")
            return []

        candidates = [
            CandidateIntentDto(
                intentCode=code,
                intentName=code,  # name enriched by orchestrator from ai_intent_configs
                confidence=float(prob),
                matchMethod=MatchMethod.CLASSIFIER,
            )
            for code, prob in predictions
            if prob >= self.min_confidence
        ]
        return candidates
