from __future__ import annotations

"""BOM layer status section — reports current cost/BOM precision layer.


Wraps ``RestaurantAnalyzerV2._build_bom_layer_status`` which inspects
``self.sku_form_manager`` and ``self.monthly_calibrator`` to determine
which BOM layer (1/2/3) the factory has reached and what accuracy that
provides.

If neither sku_form_manager nor monthly_calibrator are available, the
analyzer returns Layer 1 with default ±15% accuracy + an upgrade hint.
This is *not* an error — it's the legitimate state for a factory that
hasn't yet uploaded SKU formulas.

Supported params (all optional):
  - ``db_session``: SQLAlchemy session for analyzer construction (forwarded
    via context["db_session"] in batch mode). Not required for the basic
    Layer 1 report.
"""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class BomLayerStatusHandler(AbstractSectionHandler):
    """Wraps :meth:`RestaurantAnalyzerV2._build_bom_layer_status`.

    Cached analyzer per ``(factory_id, sub_sector)`` to avoid re-initializing
    the BomResolver / DynamicConfigResolver dependency graph each call.
    """
    section_name = "bom_layer_status"

    def __init__(self) -> None:
        # Lazy cache: (factory_id, sub_sector) -> RestaurantAnalyzerV2
        self._analyzer_cache: dict[tuple[str, str], Any] = {}

    def _get_analyzer(self, factory_id: str, sub_sector: str, db_session=None):
        """Lazy-build + cache RestaurantAnalyzerV2 per (factory_id, sub_sector)."""
        key = (factory_id, sub_sector)
        analyzer = self._analyzer_cache.get(key)
        if analyzer is None:
            # Lazy-import to avoid pulling the full dependency graph at
            # module load time.
            from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2
            analyzer = RestaurantAnalyzerV2(
                factory_id=factory_id,
                sub_sector=sub_sector,
                db_session=db_session,
            )
            self._analyzer_cache[key] = analyzer
        return analyzer

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        db_session = context.get("db_session") or request.params.get("db_session")

        try:
            analyzer = self._get_analyzer(
                request.factory_id,
                request.sub_sector,
                db_session=db_session,
            )
            section_data = analyzer._build_bom_layer_status()
        except Exception as e:
            return self.skipped(request, f"bom_layer_status 构建失败: {e}", started)

        if not isinstance(section_data, dict):
            return self.skipped(
                request,
                f"_build_bom_layer_status 返回非 dict 类型: {type(section_data).__name__}",
                started,
            )

        return self.ok(request, data=section_data, started=started)
