from __future__ import annotations
"""
Base Analysis Service

Contains shared utilities for analysis services.
"""
import logging
from typing import List, Optional
import pandas as pd

logger = logging.getLogger(__name__)


class BaseAnalysisService:
    """Base class for analysis services with common utilities"""

    def _find_column(self, df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        """Find a column from candidate names (case-insensitive)"""
        for col in df.columns:
            col_lower = col.lower()
            for candidate in candidates:
                if candidate.lower() in col_lower or col_lower in candidate.lower():
                    return col
        return None

    def _to_dataframe(self, data: List[dict]) -> pd.DataFrame:
        """Convert list of dicts to DataFrame"""
        return pd.DataFrame(data)

    def _round_value(self, value: Optional[float], decimals: int = 2) -> Optional[float]:
        """Round value to specified decimals"""
        if value is None:
            return None
        return round(float(value), decimals)

    def _safe_divide(self, numerator: float, denominator: float, default: float = 0) -> float:
        """Safe division with default value"""
        if denominator == 0:
            return default
        return numerator / denominator

    def _success_response(self, data: dict) -> dict:
        """Return success response"""
        return {"success": True, "data": data}

    def _error_response(self, error: str) -> dict:
        """Return error response"""
        return {"success": False, "error": error, "data": None}
