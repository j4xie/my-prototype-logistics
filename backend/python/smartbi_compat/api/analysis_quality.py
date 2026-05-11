"""Phase 2B T6.6 ``/analysis/quality`` endpoint port — skeleton.

This module is the chat-B1 Wave 1 deliverable per T6.6 Phase B Sub-B
dispatch. Per organizer decision 2026-05-12 (Option B — defer factory
impl) mirroring chat-A1 PR #350 production-port precedent, BOTH
branches are intentionally ``raise NotImplementedError`` placeholders:

* **Factory branch** is blocked by missing Silver-layer tables
  (``fact_quality_inspection`` / ``fact_quality_defect`` /
  ``fact_rework_record`` / ``fact_disposal_record`` /
  ``fact_customer_complaint``). Sub-B spec §2.3 fallback to a
  ``_JavaRandom`` shim was rejected in favor of cleanly waiting on
  the factory Silver migration scheduled for Phase 2D — same
  decision as chat-A1 ``analysis_production`` per Q1 amendment §1.
* **Restaurant branch** is the chat-B2 Wave 2 scope (4-metric
  envelope: FOOD_SAFETY_INCIDENT_RATE / COMPLAINT_RATE /
  DISH_RETURN_RATE / WASTAGE_RATE per PR #330 §2 + Sub-B spec §3).
  Stubbed here so chat-B2 can drop in the real implementation
  without changing the dispatcher contract.

What this module DOES ship:

* Tenant-typed dispatcher wired to
  ``smartbi_compat.tenant.get_tenant_type`` (imports chat-A1's shared
  module — does NOT duplicate the enum).
* JWT + cross-factory enforcement (existing ``verify_jwt_and_factory``).
* Stable function boundaries for chat-B2 / Phase 2D follow-ups.
* Controlled dataAvailability vocabulary constant
  (``_RESTAURANT_DATA_AVAILABILITY_VOCAB``) for chat-B2 grep-ability.

What this module does NOT ship (intentionally):

* The factory ``DashboardResponse`` envelope builder (Sub-B spec §1.3) —
  needs golden recording vs Java which Option B obviates for now.
* Restaurant 4-metric envelope (chat-B2 scope per Sub-B spec §3).
* Router registration in ``backend/python/main.py`` — deferred to
  chat-B3 envelope wiring (Sub-B spec §7.3) to avoid exposing a 501
  surface before at least one branch returns real output.

Java reference (kept for chat-B2 / Phase 2D):

* Controller: ``SmartBIAnalysisController.getQualityAnalysis`` lines 119-152
* Service (factory branch only — mock; KEEP forever per Dashboard
  composite binds): ``QualityAnalysisServiceImpl``
* Tenant predicate: ``SmartBIServiceImpl.isRestaurantTenant`` lines 432-441

Specs:

* Sub-B impl: docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md
* Q4/Q5 decisions: docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md (PR #330)
* Q5 module shape: docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md
* Factory port detail (Phase 2D): docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md
* Sibling skeleton (chat-A1, MERGED PR #350):
  backend/python/smartbi_compat/api/analysis_production.py
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
# Stub markers (chat-B2 + Phase 2D consume these strings in messages)
# ============================================================

_FACTORY_BRANCH_DEFERRED_MSG = (
    "Factory quality analysis is deferred to Phase 2D pending the factory "
    "Silver schema migration (fact_quality_inspection / fact_quality_defect / "
    "fact_rework_record / fact_disposal_record / fact_customer_complaint). "
    "chat-B1 dispatch 2026-05-12 Option B: _JavaRandom mock-mirror fallback "
    "rejected (Q1 amendment §1; mirrors chat-A1 PR #350 production precedent)."
)

_RESTAURANT_BRANCH_DEFERRED_MSG = (
    "Restaurant quality analysis is deferred to chat-B2 Wave 2 implementation. "
    "See docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md §3 "
    "and docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md §4."
)


# Restaurant tenant dataAvailability controlled vocabulary (Sub-B spec §4).
# chat-B2 MUST use these exact strings — frontend chip-badge rendering
# depends on them. New markers require organizer sign-off (spec §4.2).
_RESTAURANT_DATA_AVAILABILITY_VOCAB = (
    "MISSING_FOOD_SAFETY_INCIDENT_LOG",  # N1 — Q-DEC-4 = D1 (always emit)
    "NO_REVIEW_DATA_FOR_CHAIN",           # N2 — Q-DEC-5 = E1 (13 of 14 chains)
    "RETURN_QTY_NOT_INGESTED",            # N3 fallback — Q-DEC-6 F3 (post V20260511_03 should not occur)
    "NO_POS_DATA_FOR_PERIOD",             # N3 — column present but zero rows for period
    "WASTAGE_NOT_TRACKED",                # N4 — Q-DEC-7 = G1 (14 chains, Excel source lacks column)
)


# ============================================================
# Dispatch shells — both branches raise; chat-B2 / Phase 2D fill bodies.
# ============================================================


async def _factory_quality_dispatch(
    factory_id: str,
    start_date: date,
    end_date: date,
    analysis_type: Optional[str],
) -> dict:
    """Factory-tenant quality analysis dispatcher (DEFERRED to Phase 2D).

    Phase 2D scope (per Sub-B spec §2): 1:1 port of Java
    ``QualityAnalysisServiceImpl`` mock — 4-metric quality family
    (FPY / DEFECT_RATE / REWORK_RATE / QUALITY_COST_RATE) + 7 method
    entry points (spec §2.1) + LinkedHashMap charts/rankings. Requires
    factory Silver schema migration
    (V20260XYZ__t6_6_factory_quality_silver.sql) before real-DB
    implementation per Q1 amendment §1.

    Rule-sensitive sites flagged for Phase 2D reviewer audit (spec §2.2):

    * **Pareto cumulative-percentage stateful loop** (Java line 587-595):
      Python translation correctness gate — Rule 7 (threshold 80 integer
      → Decimal compare for parity) + Rule 10 (intermediate quantize).
    * **Defect/rework rate formulas** (lines 152-155 / 275-278): Rule 10
      divide-multiply chain with scale-4 intermediate quantize.
    * **LinkedHashMap key order** in ``charts`` + ``rankings``: Rule 8
      byte-shape parity from F999 golden recording.
    * **ChartConfig Lombok decapitalize**: Rule 9 (``xAxisField`` →
      ``"xaxisField"`` etc.).

    chat-B2 and Phase 2D MUST keep the ``(factory_id, start_date,
    end_date, analysis_type)`` signature stable — the router-level
    dispatcher depends on it.
    """
    raise NotImplementedError(_FACTORY_BRANCH_DEFERRED_MSG)


async def _restaurant_quality_dispatch(
    factory_id: str,
    start_date: date,
    end_date: date,
    analysis_type: Optional[str],
) -> dict:
    """Restaurant-tenant quality analysis dispatcher (DEFERRED to chat-B2).

    chat-B2 fills in the 4-metric envelope per Sub-B spec §3:

    * **N1** FOOD_SAFETY_INCIDENT_RATE — always null + marker (Q-DEC-4 D1)
    * **N2** COMPLAINT_RATE — rating-based per chain (Q-DEC-5 E1);
      13 of 14 chains null + ``NO_REVIEW_DATA_FOR_CHAIN``
    * **N3** DISH_RETURN_RATE — all 14 chains have real data post-Sub-ETL-2c
      ship (V20260511_03 ``fact_pos_item.return_qty`` LIVE per Q-DEC-6 F1)
    * **N4** WASTAGE_RATE — null for 14 chains + ``WASTAGE_NOT_TRACKED``
      (Q-DEC-7 G1)

    Controlled vocabulary for ``dataAvailability`` is exposed as
    ``_RESTAURANT_DATA_AVAILABILITY_VOCAB`` for chat-B2 import. No
    additional markers without organizer sign-off (spec §4.2).

    Per-analysisType dispatch (spec §3.6): ``fpy`` (default) /
    ``defect`` / ``rework`` / ``overview`` (None) — 4 branches.

    Regression goldens required from chat-B2 (spec §3.7): 2 pilots ×
    4 analysisTypes = 8 goldens covering both
    ``R_QINGHUAJIAO_REAL`` (with-review N2) and ``R_ILTEATRO_REAL``
    (without-review N2) code paths.
    """
    raise NotImplementedError(_RESTAURANT_BRANCH_DEFERRED_MSG)


# ============================================================
# Router entry — Option A polymorphic envelope dispatch (Q-DEC-8).
# Mirrors Java SmartBIAnalysisController.getQualityAnalysis 119-152.
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/quality")
async def get_quality_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    analysisType: Optional[str] = Query(
        None,
        description="fpy / defect / rework (omit for overview) — Sub-B spec §1.1",
    ),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> Any:
    """Quality analysis polymorphic endpoint (Q-DEC-8 Option A).

    Single URL serves both factory and restaurant tenants. Tenant-type
    discrimination happens server-side via
    ``cretas_db.factories.type`` lookup mirroring Java
    ``SmartBIServiceImpl.isRestaurantTenant``.

    Per chat-B1 dispatch 2026-05-12 (Option B + chat-A1 PR #350
    precedent) both branches currently raise ``NotImplementedError`` —
    see the module docstring.
    """
    pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore

        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning(
            "[analysis_quality] cretas_db pool acquisition failed factory=%s: %s",
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
        return await _restaurant_quality_dispatch(
            factory_id, startDate, endDate, analysisType
        )
    return await _factory_quality_dispatch(
        factory_id, startDate, endDate, analysisType
    )
