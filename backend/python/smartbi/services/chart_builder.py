from __future__ import annotations
"""
Chart Builder Service -- backward-compatibility shim.

The implementation has moved to ``services/charts/`` (Strategy pattern).
This module re-exports every public symbol so that existing callers
(``chart.py``, ``chat.py``, ``excel.py``, ``unified_analyzer.py``, etc.)
continue to work without any import changes.
"""

# Re-export the orchestrator and enum
from .charts import ChartBuilder, ChartType  # noqa: F401

# Re-export free functions that callers import directly
from .charts.common import (  # noqa: F401
    sanitize_for_json as _sanitize_for_json,
    is_id_column as _is_id_column,
    coerce_numeric_columns as _coerce_numeric_columns,
)
