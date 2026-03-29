"""
Charts package -- Strategy-pattern chart building with auto-registration.

Re-exports ``ChartBuilder`` and ``ChartType`` so existing callers that do
``from services.chart_builder import ChartBuilder`` continue to work
after the thin shim in ``chart_builder.py`` redirects here.
"""

# Import all subpackages so that @register_chart decorators fire.
from . import basic        # noqa: F401
from . import financial    # noqa: F401
from . import statistical  # noqa: F401
from . import specialized  # noqa: F401

# Public API
from .base import ChartBuilder, ChartType, BaseChartStrategy  # noqa: F401
from .registry import CHART_REGISTRY, register_chart, get_strategy  # noqa: F401
from .common import (  # noqa: F401
    sanitize_for_json,
    _sanitize_for_json,
    coerce_numeric_columns,
    _coerce_numeric_columns,
    is_id_column,
    _is_id_column,
    THEME_PALETTES,
    get_palette,
)
