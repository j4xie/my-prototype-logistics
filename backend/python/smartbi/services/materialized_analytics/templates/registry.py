"""TemplateRegistry — auto-discovers @register-decorated templates."""
from __future__ import annotations

import logging
import threading
from typing import Dict, List, Type

from .base import AnalysisTemplate

logger = logging.getLogger(__name__)


class _Registry:
    def __init__(self):
        # Store instances (not classes) — templates are stateless pure-functional
        # so caching a singleton per code is safe and avoids re-construction.
        self._templates: Dict[str, AnalysisTemplate] = {}
        self._lock = threading.Lock()

    def register(self, cls: Type[AnalysisTemplate]) -> Type[AnalysisTemplate]:
        instance = cls()
        with self._lock:
            if instance.code in self._templates:
                raise ValueError(f"template code collision: {instance.code}")
            self._templates[instance.code] = instance
        logger.debug(f"[registry] registered template: {instance.code}")
        return cls

    def all(self) -> List[AnalysisTemplate]:
        return list(self._templates.values())

    def by_code(self, code: str) -> AnalysisTemplate:
        instance = self._templates.get(code)
        if instance is None:
            raise KeyError(f"template not registered: {code}")
        return instance

    def codes(self) -> List[str]:
        return list(self._templates.keys())


_registry = _Registry()
register = _registry.register


def get_registry() -> _Registry:
    return _registry


def load_all_templates():
    """Trigger imports so @register decorators run.

    Called once at service startup. Add new template imports here.

    Why function-body imports: each template module imports `register` from
    this file; importing them at module level would cycle. Function-body
    imports are evaluated lazily when this function is called.

    W1 generic templates + W2 restaurant-specific templates (12 added).
    """
    # W1 generic (5)
    from . import top_n_by_dim          # noqa: F401
    from . import monthly_trend         # noqa: F401
    from . import category_distribution # noqa: F401
    from . import anomaly_detection     # noqa: F401
    from . import pareto_analysis       # noqa: F401
    # W2 restaurant-specific (12)
    from . import dish_sales_top_n           # noqa: F401
    from . import dish_slow_movers           # noqa: F401
    from . import time_slot_revenue          # noqa: F401
    from . import dish_category_breakdown    # noqa: F401
    from . import member_consumption         # noqa: F401
    from . import table_type_comparison      # noqa: F401
    from . import staff_performance          # noqa: F401
    from . import channel_analysis           # noqa: F401
    from . import promotion_impact           # noqa: F401
    from . import dish_time_slot_matrix      # noqa: F401
    from . import refund_analysis            # noqa: F401
    from . import weekday_weekend_pattern    # noqa: F401
    # W3 餐饮常见 Q-A 补充 (Apr 22 2026, 4 templates)
    from . import dish_by_table_type              # noqa: F401
    from . import combo_usage_rate                # noqa: F401
    from . import reverse_checkout_stats          # noqa: F401
    from . import store_customer_stratification   # noqa: F401
    # W3 财务端补充 (Apr 22 2026, 4 more templates)
    from . import profit_loss_statement           # noqa: F401
    from . import revenue_management_report       # noqa: F401
    from . import stored_value_card_consumption   # noqa: F401
    from . import groupon_channel_breakdown       # noqa: F401
