from __future__ import annotations
"""
SmartBI API Module

This module contains all API route handlers for the SmartBI service.
"""
from . import excel, field, metrics, forecast, insight, chart, analysis, ml, linucb

__all__ = ["excel", "field", "metrics", "forecast", "insight", "chart", "analysis", "ml", "linucb"]
