"""FastAPI router exposing each restaurant analysis section as an independent endpoint.

Each section handler from ``smartbi.services.restaurant.sections`` is exposed
at ``POST /api/smartbi/restaurant/sections/{section_name}`` so frontends can
fetch one section at a time (cheap, cacheable, parallelizable).

Use ``GET /api/smartbi/restaurant/sections/list`` to discover available
section names. The list includes ``cost_rigidity`` (which the batch
``analyze()`` does NOT emit as a standalone section because it lives inside
``diagnostics``); the standalone endpoint is useful for direct UI/AI tool
calls.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.cache import SectionCache
from smartbi.services.restaurant.sections.benchmark_alerts import BenchmarkAlertsHandler
from smartbi.services.restaurant.sections.bom_layer_status import BomLayerStatusHandler
from smartbi.services.restaurant.sections.calibration_history import (
    CalibrationHistoryHandler,
)
from smartbi.services.restaurant.sections.channel_margin import ChannelMarginHandler
from smartbi.services.restaurant.sections.cost_rigidity import CostRigidityHandler
from smartbi.services.restaurant.sections.diagnostics import DiagnosticsHandler
from smartbi.services.restaurant.sections.expense_breakdown import ExpenseBreakdownHandler
from smartbi.services.restaurant.sections.dining_heatmap import DiningHeatmapHandler
from smartbi.services.restaurant.sections.long_tail_sku import LongTailSkuHandler
from smartbi.services.restaurant.sections.member_rfm import MemberRfmHandler
from smartbi.services.restaurant.sections.menu_normalization import (
    MenuNormalizationHandler,
)
from smartbi.services.restaurant.sections.multi_store_comparison import (
    MultiStoreComparisonHandler,
)
from smartbi.services.restaurant.sections.review_analysis import ReviewAnalysisHandler
from smartbi.services.restaurant.sections.store_pnl_one_pager import (
    StorePnlOnePagerHandler,
)
from smartbi.services.restaurant.sections.stored_value import StoredValueHandler
from smartbi.services.restaurant.sections.temporal_comparison import (
    TemporalComparisonHandler,
)

logger = logging.getLogger(__name__)
_cache = SectionCache(ttl_seconds=300)

router = APIRouter(
    prefix="/api/smartbi/restaurant/sections",
    tags=["Restaurant Sections"],
)


# Singleton handler instances. Each handler caches its own per-(factory_id,
# sub_sector) analyzer / engine state — instantiating once at module load
# preserves those caches across HTTP requests.
HANDLERS = {
    "cost_rigidity": CostRigidityHandler(),
    "diagnostics": DiagnosticsHandler(),
    "expense_breakdown": ExpenseBreakdownHandler(),
    "benchmark_alerts": BenchmarkAlertsHandler(),
    "channel_margin": ChannelMarginHandler(),
    "dining_heatmap": DiningHeatmapHandler(),
    "long_tail_sku": LongTailSkuHandler(),
    "menu_normalization": MenuNormalizationHandler(),
    "temporal_comparison": TemporalComparisonHandler(),
    "review_analysis": ReviewAnalysisHandler(),
    "member_rfm": MemberRfmHandler(),
    "stored_value": StoredValueHandler(),
    "multi_store_comparison": MultiStoreComparisonHandler(),
    "calibration_history": CalibrationHistoryHandler(),
    "store_pnl_one_pager": StorePnlOnePagerHandler(),
    "bom_layer_status": BomLayerStatusHandler(),
}


class SectionRequestBody(BaseModel):
    """Request body for ``POST /api/smartbi/restaurant/sections/{section_name}``.

    ``params`` carries the section-specific inputs (POS DataFrame, financial
    data, etc). Each section handler documents what keys it consumes; this
    layer just forwards them.
    """
    factory_id: str = Field(..., description="Factory identifier")
    upload_id: Optional[str] = Field(None, description="Upload identifier")
    sub_sector: str = Field("火锅", description="Restaurant sub-sector (火锅 / 川菜 / ...)")
    store_id: Optional[str] = Field(None, description="Store identifier")
    store_name: Optional[str] = Field(None, description="Store display name")
    period: str = Field("current", description="Period label")
    params: dict[str, Any] = Field(default_factory=dict, description="Section-specific inputs")


@router.post("/{section_name}")
def compute_section(
    section_name: str = Path(..., description="Section handler name (see /list)"),
    body: SectionRequestBody = ...,
) -> dict:
    """Run a single section handler and return its envelope.

    The response shape mirrors the project's standard ``{success, data, ...}``
    envelope but additionally includes the SectionResponse metadata
    (``status``, ``warnings``, ``cacheKey``, ``computedAtMs``) so the
    frontend can render skip reasons or surface compute time.
    """
    handler = HANDLERS.get(section_name)
    if handler is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown section: {section_name!r}. Use GET /list to discover available sections.",
        )

    req = SectionRequest(
        factory_id=body.factory_id,
        upload_id=body.upload_id,
        sub_sector=body.sub_sector,
        store_id=body.store_id,
        store_name=body.store_name,
        period=body.period,
        params=body.params,
    )

    cache_key = handler.cache_key(req)
    cached = _cache.get(cache_key)
    if cached is not None:
        # Return a copy with fromCache=True; do NOT mutate the stored dict.
        return {**cached, "fromCache": True}

    try:
        response = handler.compute(req, context={})
    except Exception as exc:
        # Section handlers should normally return SKIPPED instead of raising,
        # but if one slips through we surface it as 500 rather than crashing
        # the worker.
        logger.exception("Section %s crashed during compute", section_name)
        raise HTTPException(status_code=500, detail=f"Section {section_name} crashed: {exc}") from exc

    result = {
        "success": response.status == SectionStatus.OK,
        "sectionName": response.section_name,
        "status": response.status.value,
        "data": response.data,
        "warnings": response.warnings,
        "cacheKey": response.cache_key,
        "computedAtMs": response.computed_at_ms,
        "fromCache": False,
    }
    # Only cache OK responses — SKIPPED/FAILED may resolve on next request
    # (e.g. after the caller uploads more data).
    if response.status == SectionStatus.OK:
        _cache.set(cache_key, result)
    return result


@router.get("/list")
def list_sections() -> dict:
    """Return the list of available section handler names."""
    return {"sections": sorted(HANDLERS.keys())}
