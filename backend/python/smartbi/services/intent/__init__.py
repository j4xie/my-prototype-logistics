"""Intent extraction utilities for natural-language query routing.

Public surface:
    from smartbi.services.intent.query_intent_extractor import extract_intent
"""
from smartbi.services.intent.query_intent_extractor import (
    QueryIntent,
    extract_intent,
)

__all__ = ["QueryIntent", "extract_intent"]
