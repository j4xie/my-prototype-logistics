"""
Insight generation package.

Re-exports ``InsightGenerator`` and ``InsightType`` so that existing
``from services.insights import InsightGenerator`` (and the legacy
``from services.insight_generator import InsightGenerator``) both work.
"""
from .generator import InsightGenerator
from .statistical import InsightType, INSIGHT_TEMPLATES

__all__ = [
    "InsightGenerator",
    "InsightType",
    "INSIGHT_TEMPLATES",
]
