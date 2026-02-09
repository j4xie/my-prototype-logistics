"""
Common Utilities Module

Shared utilities for all Python modules:
- robust_json_parse: Robust JSON parsing for LLM responses
- safe_get_column: Safe DataFrame column access for duplicate column names
"""

from .json_parser import robust_json_parse, extract_json_from_text, parse_llm_json_response
from .dataframe_utils import (
    safe_get_column,
    safe_groupby_agg,
    safe_numeric_column,
    ensure_numeric_for_formula,
    deduplicate_columns,
)

__all__ = [
    # JSON utilities
    "robust_json_parse",
    "extract_json_from_text",
    "parse_llm_json_response",
    # DataFrame utilities
    "safe_get_column",
    "safe_groupby_agg",
    "safe_numeric_column",
    "ensure_numeric_for_formula",
    "deduplicate_columns",
]
