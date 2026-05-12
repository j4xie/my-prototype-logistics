"""Phase 2C Tier 2 PILOT — composite dashboard endpoints (Java → Python port).

Per AGGRESSIVE-REVISED scope (3 endpoints only — CUT 8 speculative siblings):

* ``GET /api/mobile/{factory_id}/smart-bi/dashboard/executive`` —
  period-based wrapper around the Phase 2A sales-overview primitive.
  Mirrors Java ``SmartBIDashboardController.getExecutiveDashboard``
  (line 156-186) but skips the 4-fanout enrichment + auto-range detection
  that Java does in ``SmartBIServiceImpl.getExecutiveDashboard`` (lines
  263-416). Rationale: Phase 2A primitive already does Gold/legacy
  routing + restaurant tenant handling internally (per
  ``_get_sales_overview`` flag-gated 3-state dispatch); pilot defers the
  outer fanout to a Phase 2C follow-up if real customer feedback warrants.

* ``GET /api/mobile/{factory_id}/smart-bi/dashboard/executive/custom`` —
  date-range variant of the same. Single direct call to
  ``_get_sales_overview(factory_id, DateRange.custom(start, end))``.
  Mirrors Java line 315-341.

* ``GET /api/mobile/{factory_id}/smart-bi/dashboard`` — composite that
  aggregates 4 Phase 2A primitives in parallel: sales / finance /
  inventory / procurement. Mirrors Java getUnifiedDashboard
  (line 343-420) but pilot-scopes to 4 of 9 sub-dashboards. Production +
  Quality embed empty placeholders (Phase 2D dependency — both currently
  raise ``NotImplementedError`` for FACTORY tenants per chat-A1 PR #350 /
  chat-B1 PR #354 Option B). Department + region rankings deferred. AI
  insights / alerts / recommendations return empty lists (Java side
  delegates to RecommendationService + LLM — out of pilot scope).

⛔ **Pilot HOLDs (carry into PR body)**:
- No own caching; primitives already cache via shared Redis layer.
- No date-range auto-detection (Java fallback to previous-year same period
  on zero-rows). Pilot returns whatever the requested period yields.
- No `recommendationService` integration — `alerts` / `recommendations` /
  `aiInsights` always empty list.
- No `dataVersion` field on UnifiedDashboardResponse (Java sets to commit
  SHA at startup; Python defers).
- Java has `fromCache` boolean + `cacheExpireAt` — pilot always emits
  `fromCache: false` + `cacheExpireAt: None` since no own cache.

Rule compliance (`.claude/rules/python-java-port.md`):
- Rule 1: explicit ``is not None`` on every primitive result, no Python
  ``or`` falsy hazards.
- Rule 4: ``_decimal_to_number`` already applied inside Phase 2A
  primitives — composite is a pass-through.
- Rule 9.2: DashboardResponse + UnifiedDashboardResponse have NO
  ``@JsonInclude(NON_NULL)`` (verified by chat3 research) → emit all
  null fields explicitly. Empty placeholder builder
  ``_empty_dashboard_response`` returns full 16-key dict with nulls.
- Rule 9.3: ``fromCache`` boolean field — Jackson emits
  ``"fromCache": false`` (Lombok ``isFromCache()`` getter). Mirrored.
- Rule 11: All datetime emissions use ``_java_isoformat``.

Java references (per chat3 Subagent A research):
- Controller: ``SmartBIDashboardController.java`` lines 156-420
- Service: ``SmartBIServiceImpl.java`` lines 263-565
- DTOs: ``dto/smartbi/DashboardResponse.java`` (16 fields),
  ``dto/smartbi/UnifiedDashboardResponse.java`` (18 fields)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import _get_finance_overview
from smartbi_compat.api.analysis_inventory import _get_inventory_health
from smartbi_compat.api.analysis_procurement import _get_procurement_overview
from smartbi_compat.api.analysis_sales import _get_sales_overview
from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import _java_isoformat, wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# UTC-naive datetime for Java LocalDateTime byte-parity (Rule 11)
# ============================================================
#
# Java DTO field ``generatedAt`` is ``LocalDateTime`` (per chat3 Subagent A
# research) — no timezone offset in serialized output. Python
# ``datetime.now(timezone.utc)`` produces tz-aware → ``_java_isoformat``
# preserves the ``+00:00`` suffix (helper splits on ".", finds non-digit
# fraction part, returns unmodified) AND skips trailing-zero microsecond
# stripping. Both behaviors break Rule 11 byte parity.
#
# Use ``datetime.now(timezone.utc).replace(tzinfo=None)`` to get a
# naive UTC datetime (mirror Java ``LocalDateTime.now(ZoneOffset.UTC)``).
# ``datetime.utcnow()`` would work but is deprecated in Python 3.12+.


def _now_naive_utc() -> datetime:
    """Naive UTC datetime — Java LocalDateTime mirror (Rule 11)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ============================================================
# Period → DateRange resolution
# ============================================================
#
# Mirror Java ``DateRangeUtils.rangeByPeriod`` (and the spec defaults
# in ``SmartBIDashboardController.getExecutiveDashboard`` query-param
# javadoc — values: today/week/month/quarter/year). The shared
# ``smartbi_compat.date_range.DateRange.by_period`` only supports "month"
# today (YAGNI block); we compute locally to stay self-contained.


def _resolve_period(period: str, today: Optional[date] = None) -> DateRange:
    """Mirror Java DateRangeUtils.rangeByPeriod for {today, week, month, quarter, year}.

    Java semantics (verified against DateRangeUtils.java):
    * ``today`` — start = end = today
    * ``week`` — Monday-of-this-week through Sunday (ISO week)
    * ``month`` — 1st through last day of current calendar month
    * ``quarter`` — 1st day of quarter through last day of quarter
    * ``year`` — Jan 1 through Dec 31

    Defaults to ``month`` for unknown values (Java line 162-163 same default).
    """
    if today is None:
        today = date.today()

    if period == "today":
        return DateRange.custom(today, today)

    if period == "week":
        # Monday = 0 in Python isoweekday/.weekday(); Java ISO same.
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        sunday = monday + timedelta(days=6)
        return DateRange.custom(monday, sunday)

    if period == "quarter":
        q = (today.month - 1) // 3
        q_start_month = q * 3 + 1
        start = date(today.year, q_start_month, 1)
        # Last day of quarter = day before first day of next quarter.
        if q == 3:
            next_q_start = date(today.year + 1, 1, 1)
        else:
            next_q_start = date(today.year, q_start_month + 3, 1)
        end = next_q_start - timedelta(days=1)
        return DateRange.custom(start, end)

    if period == "year":
        return DateRange.custom(date(today.year, 1, 1), date(today.year, 12, 31))

    # Default + "month" — same logic.
    start = today.replace(day=1)
    if today.month == 12:
        next_month_first = date(today.year + 1, 1, 1)
    else:
        next_month_first = date(today.year, today.month + 1, 1)
    end = next_month_first - timedelta(days=1)
    return DateRange.custom(start, end)


# ============================================================
# Empty DashboardResponse builder (Rule 9.2 — emit all 16 fields)
# ============================================================


def _empty_dashboard_response(
    period: str, start_date: date, end_date: date
) -> dict:
    """Return a 16-key DashboardResponse dict with null defaults.

    Mirrors Java ``DashboardResponse.builder().build()`` Jackson emission
    when no fields are populated. All 16 fields per chat3 Subagent A
    research:

      period / startDate / endDate / kpiCards / metricCards /
      rankings / charts / chartList / aiInsights / alerts /
      recommendations / suggestions / generatedAt / lastUpdated /
      fromCache / cacheExpireAt

    Note: Java actually emits `null` for collection fields when builder
    leaves them unset. Our analysis_*.py primitives instead return empty
    lists/dicts (Phase 2A baseline). For composite consistency we keep
    null/None on this empty builder — Rule 9 dict-eq tolerates both forms
    so frontend handles them identically.
    """
    return {
        "period": period,
        "startDate": start_date.isoformat() if start_date is not None else None,
        "endDate": end_date.isoformat() if end_date is not None else None,
        "kpiCards": [],
        "metricCards": [],
        "rankings": {},
        "charts": {},
        "chartList": [],
        "aiInsights": [],
        "alerts": [],
        "recommendations": [],
        "suggestions": [],
        "generatedAt": _java_isoformat(_now_naive_utc()),
        "lastUpdated": None,
        "fromCache": False,
        "cacheExpireAt": None,
    }


# ============================================================
# Sub-dashboard fetchers — wrap each primitive with graceful fallback
# ============================================================
#
# Pattern: each fetcher returns a DashboardResponse-shaped dict OR the
# empty 16-key placeholder. Any primitive raising is logged at WARN and
# returns the empty placeholder. Mirrors Java
# ``CompletableFuture.exceptionally(...)`` graceful-degradation
# at line 376-580 of SmartBIServiceImpl.


async def _fetch_sales_safe(
    factory_id: str, period: str, range_: DateRange
) -> dict:
    """Sales sub-dashboard — primary content. Failure here is severe."""
    try:
        return await _get_sales_overview(factory_id, range_)
    except asyncio.CancelledError:
        # Cycle 2 audit finding (Important): Python 3.8 (server venv38)
        # makes CancelledError a subclass of Exception. Letting the bare
        # except Exception swallow it would produce a fake "all empty"
        # response when the request was actually cancelled. Re-raise so
        # asyncio.gather propagates the cancellation.
        raise
    except Exception as e:
        logger.warning(
            "[dashboard_composite] sales overview failed factory=%s period=%s: %s",
            factory_id, period, e,
        )
        return _empty_dashboard_response(period, range_.start_date, range_.end_date)


async def _fetch_finance_safe(
    factory_id: str, period: str, range_: DateRange
) -> dict:
    """Finance sub-dashboard — graceful degradation per Java line 376-380."""
    try:
        return await _get_finance_overview(factory_id, range_)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.warning(
            "[dashboard_composite] finance overview failed factory=%s: %s",
            factory_id, e,
        )
        return _empty_dashboard_response(period, range_.start_date, range_.end_date)


async def _fetch_inventory_safe(
    factory_id: str, period: str, range_: DateRange
) -> dict:
    try:
        return await _get_inventory_health(
            factory_id, range_.start_date, range_.end_date
        )
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.warning(
            "[dashboard_composite] inventory health failed factory=%s: %s",
            factory_id, e,
        )
        return _empty_dashboard_response(period, range_.start_date, range_.end_date)


async def _fetch_procurement_safe(
    factory_id: str, period: str, range_: DateRange
) -> dict:
    try:
        return await _get_procurement_overview(
            factory_id, range_.start_date, range_.end_date
        )
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.warning(
            "[dashboard_composite] procurement overview failed factory=%s: %s",
            factory_id, e,
        )
        return _empty_dashboard_response(period, range_.start_date, range_.end_date)


def _empty_production_dashboard(period: str, range_: DateRange) -> dict:
    """Production sub-dashboard placeholder (Phase 2D dependency).

    Per chat-A1 PR #350 + chat-A2 PR #352: factory branch raises
    NotImplementedError until Phase 2D Silver migration ships. Restaurant
    branch returns analytics-shape data (not DashboardResponse-shape)
    that doesn't fit into UnifiedDashboardResponse's nested
    DashboardResponse slot cleanly.

    Pilot: always emit empty placeholder. Phase 2D will replace with
    real production data through `analysis_production._factory_production_dispatch`
    once factory Silver schema lands (per
    docs/qa-audits/2026-05-11-factory-silver-entity-mapping.md).
    """
    placeholder = _empty_dashboard_response(period, range_.start_date, range_.end_date)
    placeholder["aiInsights"] = [{
        "level": "INFO",
        "category": "DEFERRED",
        "message": "Production analysis pending Phase 2D Silver migration.",
        "relatedEntity": None,
        "actionSuggestion": None,
    }]
    return placeholder


def _empty_quality_dashboard(period: str, range_: DateRange) -> dict:
    """Quality sub-dashboard placeholder (Phase 2D dependency).

    Same rationale as ``_empty_production_dashboard`` — chat-B1 PR #354 +
    chat-B2 PR #358 ship restaurant N1-N4 envelope but factory branch
    still defers. Composite caller treats this as "data not yet ready".
    """
    placeholder = _empty_dashboard_response(period, range_.start_date, range_.end_date)
    placeholder["aiInsights"] = [{
        "level": "INFO",
        "category": "DEFERRED",
        "message": "Quality analysis pending Phase 2D Silver migration.",
        "relatedEntity": None,
        "actionSuggestion": None,
    }]
    return placeholder


# ============================================================
# Composite builders
# ============================================================


async def _build_executive_dashboard(
    factory_id: str, period: str, range_: DateRange
) -> dict:
    """Single-primitive wrapper — mirror Java getExecutiveDashboard (pilot scope).

    Pilot defers the 4-CompletableFuture enrichment from Java
    SmartBIServiceImpl.getExecutiveDashboard (rankings + trend chart).
    Returns whatever `_get_sales_overview` returns, augmented with
    period metadata for envelope consistency.
    """
    sales = await _fetch_sales_safe(factory_id, period, range_)

    # Cycle 2 audit finding (Important): defensive copy before mutation.
    # Phase 2A primitives return fresh dicts today, but no contract
    # enforces it. If any future cache layer memoizes the response,
    # mutating in place would corrupt the cache for subsequent callers.
    sales = dict(sales)

    # Ensure envelope metadata is consistent — Phase 2A primitives may
    # not always emit these explicitly. Set defensively per Rule 1.
    if sales.get("period") is None:
        sales["period"] = period
    if sales.get("startDate") is None:
        sales["startDate"] = range_.start_date.isoformat()
    if sales.get("endDate") is None:
        sales["endDate"] = range_.end_date.isoformat()
    if sales.get("generatedAt") is None:
        sales["generatedAt"] = _java_isoformat(_now_naive_utc())

    return sales


async def _build_unified_dashboard(
    factory_id: str, period: str, range_: DateRange
) -> dict:
    """4-primitive parallel composite — pilot scope.

    Java getUnifiedDashboard does 9 parallel calls (sales, finance,
    inventory, production, quality, procurement, department-ranking,
    region-ranking, recommendations+alerts). Pilot does 4 (sales,
    finance, inventory, procurement) + 2 empty placeholders (production,
    quality) per Phase 2D dependency. Rankings + recommendations defer.

    ``asyncio.gather(*tasks, return_exceptions=True)`` is not used here
    because each ``_fetch_*_safe`` already catches and returns empty
    placeholders — no exception ever propagates from the fetcher
    layer. This keeps the gather semantics simple.
    """
    sales_task = _fetch_sales_safe(factory_id, period, range_)
    finance_task = _fetch_finance_safe(factory_id, period, range_)
    inventory_task = _fetch_inventory_safe(factory_id, period, range_)
    procurement_task = _fetch_procurement_safe(factory_id, period, range_)

    sales, finance, inventory, procurement = await asyncio.gather(
        sales_task, finance_task, inventory_task, procurement_task
    )

    # Cycle 2 audit finding (Critical): Java ``UnifiedDashboardResponse``
    # has 3 manual derived getters Jackson emits as fields (lines 158-175
    # of UnifiedDashboardResponse.java):
    #
    #   public int  getAlertCount()                       { return alerts.size(); }
    #   public long getUrgentAlertCount()                 { return alerts.filter(isUrgent).count(); }
    #   public long getHighPriorityRecommendationCount()  { return recs.filter(isHighPriority).count(); }
    #
    # No @JsonIgnore annotation → Java golden truth at
    # tests/fixtures/java-smartbi-golden/dashboard-F001.json has 21 keys
    # (the 18 source fields + these 3 derived). Pilot emits 0 for all 3
    # since alerts=[] and recommendations=[] are pilot HOLDs.
    alerts: list = []           # pilot HOLD — empty until RecommendationService port
    recommendations: list = []  # pilot HOLD
    ai_insights: list = []      # pilot HOLD

    return {
        "period": period,
        "startDate": range_.start_date.isoformat(),
        "endDate": range_.end_date.isoformat(),
        "sales": sales,
        "finance": finance,
        "inventory": inventory,
        "production": _empty_production_dashboard(period, range_),
        "quality": _empty_quality_dashboard(period, range_),
        "procurement": procurement,
        "departmentRanking": [],
        "regionRanking": [],
        "alerts": alerts,
        "recommendations": recommendations,
        "aiInsights": ai_insights,
        "generatedAt": _java_isoformat(_now_naive_utc()),
        "fromCache": False,
        "cacheExpireAt": None,
        "dataVersion": None,
        # Lombok-derived getter fields — Java order is post-dataVersion
        # per golden truth dashboard-F001.json. Rule 9.3 mandates these.
        "alertCount": len(alerts),
        "urgentAlertCount": sum(1 for a in alerts if a.get("urgent")),
        "highPriorityRecommendationCount": sum(
            1 for r in recommendations if r.get("highPriority")
        ),
    }


# ============================================================
# Router entries
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/dashboard/executive")
async def get_executive_dashboard(
    factory_id: str,
    period: str = Query(
        "month",
        description="today / week / month / quarter / year (defaults to month per Java line 162)",
    ),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> Any:
    """Executive dashboard (period-based) — Java mirror line 156-186.

    Single-primitive call to sales overview. Pilot defers 4-CompletableFuture
    enrichment from Java SmartBIServiceImpl line 263-416. See module
    docstring §"Pilot HOLDs".
    """
    range_ = _resolve_period(period)
    data = await _build_executive_dashboard(factory_id, period, range_)
    return wrap_response(strip_price_for_role(data, auth.role))


@router.get("/api/mobile/{factory_id}/smart-bi/dashboard/executive/custom")
async def get_executive_dashboard_custom_range(
    factory_id: str,
    startDate: date = Query(..., description="Range start (inclusive)"),
    endDate: date = Query(..., description="Range end (inclusive)"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> Any:
    """Executive dashboard custom date range — Java mirror line 315-341.

    Simpler than ``/executive``: single direct ``_get_sales_overview``
    call with the supplied range. Java side has no auto-fallback either
    for this variant.
    """
    range_ = DateRange.custom(startDate, endDate)
    # Custom variant has no canonical "period" string in Java contract —
    # mirror Java by emitting the literal "CUSTOM" placeholder used by
    # _build_empty_dashboard pre-existing Phase 2A primitives.
    data = await _build_executive_dashboard(factory_id, "CUSTOM", range_)
    return wrap_response(strip_price_for_role(data, auth.role))


@router.get("/api/mobile/{factory_id}/smart-bi/dashboard")
async def get_unified_dashboard(
    factory_id: str,
    period: str = Query(
        "month",
        description="today / week / month / quarter / year (defaults to month)",
    ),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> Any:
    """Unified composite dashboard — Java mirror line 343-420 (pilot scope).

    Parallel-fanout to 4 Phase 2A primitives (sales/finance/inventory/
    procurement) + 2 empty placeholders (production/quality, Phase 2D
    dependency). Rankings + alerts + recommendations + aiInsights all
    return empty lists per pilot HOLD list in module docstring.
    """
    range_ = _resolve_period(period)
    data = await _build_unified_dashboard(factory_id, period, range_)
    return wrap_response(strip_price_for_role(data, auth.role))
