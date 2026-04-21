"""TemplateRegistry — auto-discovers @register-decorated templates."""
from __future__ import annotations

import logging
from typing import Dict, List, Type

from .base import AnalysisTemplate

logger = logging.getLogger(__name__)


class _Registry:
    def __init__(self):
        self._templates: Dict[str, Type[AnalysisTemplate]] = {}

    def register(self, cls: Type[AnalysisTemplate]) -> Type[AnalysisTemplate]:
        instance = cls()
        if instance.code in self._templates:
            raise ValueError(f"template code collision: {instance.code}")
        self._templates[instance.code] = cls
        logger.debug(f"[registry] registered template: {instance.code}")
        return cls

    def all(self) -> List[AnalysisTemplate]:
        return [cls() for cls in self._templates.values()]

    def by_code(self, code: str) -> AnalysisTemplate:
        cls = self._templates.get(code)
        if cls is None:
            raise KeyError(f"template not registered: {code}")
        return cls()

    def codes(self) -> List[str]:
        return list(self._templates.keys())


_registry = _Registry()
register = _registry.register


def get_registry() -> _Registry:
    return _registry


def load_all_templates():
    """Trigger imports so @register decorators run.

    Called once at service startup. Add new template imports here.
    Note: these imports will fail until Tasks 5-9 create the template modules.
    Do not call this function until all templates are implemented.
    """
    from . import top_n_by_dim          # noqa: F401
    from . import monthly_trend         # noqa: F401
    from . import category_distribution # noqa: F401
    from . import anomaly_detection     # noqa: F401
    from . import pareto_analysis       # noqa: F401
