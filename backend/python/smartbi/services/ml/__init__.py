"""
ML Services Module

Machine learning and forecasting services:
- ForecastService: Time series forecasting
- MLService: Least squares and numerical computation
- LinUCBService: LinUCB algorithm for recommendations
- IntentClassifierService: Intent classification using transformers
"""

# Forecast service exports
from .forecast import (
    ForecastAlgorithm,
    ForecastService,
)

# ML service exports
from .ml_service import (
    SolveMethod,
    MLService,
)

# LinUCB service exports
from .linucb import (
    LinUCBService,
    DEFAULT_ALPHA,
    DEFAULT_FEATURE_DIM,
    DEFAULT_REGULARIZATION,
)

# Intent classifier exports
from .intent import (
    IntentClassifierService,
    get_classifier,
)

__all__ = [
    # Forecast
    "ForecastAlgorithm",
    "ForecastService",
    # ML
    "SolveMethod",
    "MLService",
    # LinUCB
    "LinUCBService",
    "DEFAULT_ALPHA",
    "DEFAULT_FEATURE_DIM",
    "DEFAULT_REGULARIZATION",
    # Intent
    "IntentClassifierService",
    "get_classifier",
]
