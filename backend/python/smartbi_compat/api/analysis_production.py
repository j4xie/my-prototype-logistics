"""Phase 2B T6.6 ``/analysis/production`` endpoint port — skeleton.

This module is the chat-A1 Wave 1 deliverable per T6.6 Phase B Sub-A
dispatch. Per organizer decision 2026-05-12 (Option B — defer factory
impl), BOTH branches are intentionally ``raise NotImplementedError``
placeholders:

* **Factory branch** is blocked by missing Silver-layer tables
  (``fact_production_batch`` / ``fact_equipment_event`` /
  ``fact_quality_inspection``). Spec §2.3 fallback to a ``_JavaRandom``
  shim was rejected in favor of cleanly waiting on the factory Silver
  migration scheduled for Phase 2D.
* **Restaurant branch** is the chat-A2 Wave 2 scope (3-metric envelope:
  KITCHEN_STATION_UTILIZATION / AVG_PREP_TIME / TABLE_TURNOVER_RATE per
  PR #330 §1 + PR #337 §3). Stubbed here so chat-A2 can drop in the real
  implementation without changing the dispatcher contract.

What this module DOES ship:

* Tenant-typed dispatcher wired to ``smartbi_compat.tenant.get_tenant_type``
* JWT + cross-factory enforcement (existing ``verify_jwt_and_factory``)
* Stable function boundaries for chat-A2 / Phase 2D follow-ups

What this module does NOT ship (intentionally):

* The 17-field ``DashboardResponse`` envelope builder (spec §1.3) —
  needs golden recording vs Java which Option B obviates for now.
* Restaurant 3-metric envelope (chat-A2 scope per spec §3).
* Router registration in ``backend/python/main.py`` — deferred until
  at least one branch has real output to avoid exposing a 501 surface.

Java reference (kept for chat-A2 / Phase 2D):

* Controller: ``SmartBIAnalysisController.getProductionAnalysis`` lines 80-115
* Service (factory branch only — mock; KEEP per PR #178):
  ``ProductionAnalysisServiceImpl``
* Tenant predicate: ``SmartBIServiceImpl.isRestaurantTenant`` lines 432-441

Specs:

* Sub-A impl: docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md
* Q4 decisions: docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md (PR #330)
* Q4 module shape: docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md
* Factory port detail (Phase 2D): docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md
* Organizer Option B answer: docs/qa-audits/2026-05-12-t6-6-sub-a1-factory-production-impl.md
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.tenant import TenantType, get_tenant_type

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Stub markers (chat-A2 + Phase 2D consume these strings in messages)
# ============================================================

_FACTORY_BRANCH_DEFERRED_MSG = (
    "Factory production analysis is deferred to Phase 2D pending the factory "
    "Silver schema migration (fact_production_batch / fact_equipment_event / "
    "fact_quality_inspection). chat-A1 dispatch 2026-05-12 Option B: "
    "_JavaRandom mock-mirror fallback rejected (Q1 amendment §1)."
)

_RESTAURANT_BRANCH_DEFERRED_MSG = (
    "Restaurant production analysis is deferred to chat-A2 Wave 2 implementation. "
    "See docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md §3 "
    "and docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md §3."
)


# ============================================================
# Dispatch shells — both branches raise; chat-A2 / Phase 2D fill bodies.
# ============================================================


async def _factory_production_dispatch(
    factory_id: str,
    start_date: date,
    end_date: date,
    analysis_type: Optional[str],
) -> dict:
    """Factory-tenant production analysis dispatcher (DEFERRED to Phase 2D).

    Phase 2D scope (per spec §2): 1:1 port of Java
    ``ProductionAnalysisServiceImpl`` mock — 4-metric OEE family
    (OEE/AVAILABILITY/PERFORMANCE/QUALITY) + 8 method entry points +
    LinkedHashMap charts/rankings. Requires factory Silver schema
    migration (V20260XYZ__t6_6_factory_production_silver.sql) before
    real-DB implementation per Q1 amendment §1.

    chat-A2 and Phase 2D must keep the ``(factory_id, start_date,
    end_date, analysis_type)`` signature stable — the router-level
    dispatcher depends on it.
    """
    raise NotImplementedError(_FACTORY_BRANCH_DEFERRED_MSG)


async def _restaurant_production_dispatch(
    factory_id: str,
    start_date: date,
    end_date: date,
    analysis_type: Optional[str],
) -> dict:
    """Restaurant-tenant production analysis dispatcher (DEFERRED to chat-A2).

    chat-A2 fills in the 3-metric envelope (M1
    KITCHEN_STATION_UTILIZATION, M2 AVG_PREP_TIME, M3
    TABLE_TURNOVER_RATE proxy) per spec §3, using the controlled
    vocabulary {MISSING_KITCHEN_STATION_DATA,
    MISSING_ORDER_TIMESTAMP_SPLIT, PROXY_AS_BILLS_PER_STORE} for
    ``dataAvailability``. No additional markers without organizer
    sign-off (spec §4.1).
    """
    raise NotImplementedError(_RESTAURANT_BRANCH_DEFERRED_MSG)


# ============================================================
# Router entry — Option A polymorphic envelope dispatch (Q-DEC-8).
# Mirrors Java SmartBIAnalysisController.getProductionAnalysis 80-115.
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/production")
async def get_production_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    analysisType: Optional[str] = Query(
        None,
        description="oee / efficiency / equipment / overview (omit for overview)",
    ),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> Any:
    """Production analysis polymorphic endpoint (Q-DEC-8 Option A).

    Single URL serves both factory and restaurant tenants. Tenant-type
    discrimination happens server-side via
    ``cretas_db.factories.type`` lookup mirroring Java
    ``SmartBIServiceImpl.isRestaurantTenant``.

    Per chat-A1 dispatch 2026-05-12 (Option B + STOP-and-ping answer)
    both branches currently raise ``NotImplementedError`` — see the
    module docstring.
    """
    pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore

        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning(
            "[analysis_production] cretas_db pool acquisition failed factory=%s: %s",
            factory_id,
            e,
        )

    if pool is None:
        # Defensive: when pool is missing, mirror Java predicate's
        # repository-failure path (return false → factory branch). We
        # still raise NotImplementedError below because factory branch
        # is deferred.
        tenant = TenantType.FACTORY
    else:
        async with pool.acquire() as conn:
            tenant = await get_tenant_type(factory_id, conn)

    if tenant.is_restaurant_tenant:
        return await _restaurant_production_dispatch(
            factory_id, startDate, endDate, analysisType
        )
    return await _factory_production_dispatch(
        factory_id, startDate, endDate, analysisType
    )
