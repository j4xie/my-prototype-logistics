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

    Note: these imports will fail until Tasks 5-9 create the template modules.
    Do not call this function until all templates are implemented.
    """
    from . import top_n_by_dim          # noqa: F401
    from . import monthly_trend         # noqa: F401
    from . import category_distribution # noqa: F401
    from . import anomaly_detection     # noqa: F401
    from . import pareto_analysis       # noqa: F401
