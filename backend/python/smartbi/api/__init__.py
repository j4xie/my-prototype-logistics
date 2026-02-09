from __future__ import annotations
"""
SmartBI API Module

This module contains all API route handlers for the SmartBI service.
"""
import logging

logger = logging.getLogger(__name__)

# Core modules (always available)
from . import excel, field, metrics, forecast, insight, chart, analysis, ml, linucb, chat, db_analysis, cross_sheet, yoy, statistical, analysis_cache

__all__ = [
    "excel", "field", "metrics", "forecast", "insight", "chart",
    "analysis", "ml", "linucb", "chat", "db_analysis", "cross_sheet", "yoy", "statistical",
    "analysis_cache"
]

# Optional: classifier module (requires torch + transformers)
try:
    from . import classifier
    __all__.append("classifier")
except ImportError as e:
    logger.warning(f"Classifier module not available (missing torch/transformers): {e}")
    classifier = None
