"""
SmartBI Utilities Module

Common utilities for SmartBI services:
- robust_json_parse: Robust JSON parsing for LLM responses
- safe_get_column: Safe DataFrame column access for duplicate column names
"""

from .json_parser import robust_json_parse, extract_json_from_text
from .dataframe_utils import safe_get_column, safe_groupby_agg

__all__ = [
    "robust_json_parse",
    "extract_json_from_text",
    "safe_get_column",
    "safe_groupby_agg",
]
