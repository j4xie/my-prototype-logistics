from __future__ import annotations
"""
Chart strategy registry.

Maps chart-type strings to strategy classes.  Strategies register themselves
via the ``@register_chart`` decorator; the subpackage ``__init__.py`` files
import the modules so that decorators execute at import time.
"""
import logging
from typing import Dict, Type, Optional

from .base import BaseChartStrategy

logger = logging.getLogger(__name__)

# Global registry  (chart_type_string -> strategy_class)
CHART_REGISTRY: Dict[str, Type[BaseChartStrategy]] = {}


def register_chart(chart_type: str):
    """Class decorator that registers a chart strategy for *chart_type*."""
    def decorator(cls: Type[BaseChartStrategy]):
        if chart_type in CHART_REGISTRY:
            logger.warning(
                "Chart type %r re-registered: %s replaces %s",
                chart_type,
                cls.__name__,
                CHART_REGISTRY[chart_type].__name__,
            )
        CHART_REGISTRY[chart_type] = cls
        return cls
    return decorator


def get_strategy(chart_type: str) -> BaseChartStrategy:
    """Look up and instantiate the strategy for *chart_type*.

    Raises ``ValueError`` if no strategy is registered.
    """
    strategy_cls = CHART_REGISTRY.get(chart_type)
    if not strategy_cls:
        raise ValueError(f"Unknown chart type: {chart_type}")
    return strategy_cls()


def list_registered() -> list[str]:
    """Return all registered chart-type keys (sorted)."""
    return sorted(CHART_REGISTRY.keys())
