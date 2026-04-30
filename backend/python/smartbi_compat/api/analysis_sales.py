"""Phase 2A /analysis/sales endpoint port.

Implements the composite Map<String, Object> response with 7 keys:
  overview / customerRanking / productRanking / dateRange /
  salespersonRanking / generatedAt / trendChart

Foundation defines:
  - Route registration + composite assembly
  - 5 async sub-service stubs returning F999 empty-state shape
  - 5 DTO dict factories (DashboardResponse / RankingItem / ChartConfig /
    AIInsight / KPICard)
  - DateRange dict factory

Sibling specs replace stub bodies:
  - overview spec → _get_sales_overview legacy fallback path
  - gold spec → _get_sales_overview Gold-first dispatch + helpers
  - rankings spec → _get_X_ranking real impls
  - trend spec → _get_sales_trend_chart real impl

Java reference:
  - Controller: SmartBIAnalysisController.getSalesAnalysis line 98-138
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 568-616
  - Sub-services: SalesAnalysisServiceImpl.{getSalesOverview, getXRanking,
    getSalesTrendChart}

Spec: docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from smartbi_compat.api.analysis import _query_sales_data, wrap_response
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# Section 1: DTO dict factories (FROZEN by foundation spec §4)
# ============================================================
# Populated by Tasks C.3 - C.7


def _new_date_range_dict(range_: DateRange) -> dict:
    """Mirror DateRange.java @Data getters incl. derived `days` and `valid`.

    F999 observed 7-field shape:
      startDate / endDate (LocalDate, ISO string)
      granularity (String — YEAR/MONTH/WEEK/DAY/CUSTOM)
      originalExpression (String — e.g. "2025-01-01 至 2025-12-31")
      relative (boolean)
      days (derived = (endDate - startDate).days + 1)
      valid (derived = startDate <= endDate)
    """
    days_count = (range_.end_date - range_.start_date).days + 1
    return {
        "startDate": range_.start_date.isoformat(),
        "endDate": range_.end_date.isoformat(),
        "granularity": getattr(range_, "granularity", "CUSTOM"),
        "originalExpression": getattr(range_, "original_expression", None),
        "relative": getattr(range_, "relative", False),
        "days": days_count,
        "valid": range_.start_date <= range_.end_date,
    }


def _new_dashboard_response_dict(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    kpi_cards: Optional[list] = None,
    metric_cards: Optional[list] = None,
    rankings: Optional[dict] = None,
    charts: Optional[dict] = None,
    chart_list: Optional[list] = None,
    ai_insights: Optional[list] = None,
    alerts: Optional[list] = None,
    recommendations: Optional[list] = None,
    suggestions: Optional[list] = None,
    generated_at: Optional[str] = None,
    last_updated: Optional[str] = None,
    from_cache: bool = False,
    cache_expire_at: Optional[str] = None,
) -> dict:
    """Mirror DashboardResponse.java @Data getters (16 fields).

    All 16 fields emit including 4 @Deprecated ones (metricCards / chartList
    / suggestions / lastUpdated) — Lombok @Data sees them via getters even
    when @Deprecated. Key order matches Java field declaration order.

    F999 empty-state defaults:
      kpi_cards=[], rankings={}, charts={} when not provided
      all other Optional fields default to None
    """
    return {
        "period": period,
        "startDate": start_date.isoformat() if start_date else None,
        "endDate": end_date.isoformat() if end_date else None,
        "kpiCards": kpi_cards if kpi_cards is not None else [],
        "metricCards": metric_cards,
        "rankings": rankings if rankings is not None else {},
        "charts": charts if charts is not None else {},
        "chartList": chart_list,
        "aiInsights": ai_insights if ai_insights is not None else [],
        "alerts": alerts,
        "recommendations": recommendations,
        "suggestions": suggestions,
        "generatedAt": generated_at,
        "lastUpdated": last_updated,
        "fromCache": from_cache,
        "cacheExpireAt": cache_expire_at,
    }

# ============================================================
# Section 2: Strip-volatile shared helper
# ============================================================

VOLATILE_KEYS = frozenset({
    "generatedAt", "lastUpdated", "cacheExpireAt", "timestamp",
})


def _strip_volatile(obj: Any) -> Any:
    """Recursively strip timing/cache-dependent keys for byte-shape compare.

    Removes from any dict in the tree:
      - generatedAt          (LocalDateTime.now() per request)
      - lastUpdated          (DashboardResponse @Deprecated, also volatile)
      - cacheExpireAt        (cache TTL)
      - timestamp            (envelope-level)

    Preserves all other keys + list/primitive values.
    """
    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v)
            for k, v in obj.items()
            if k not in VOLATILE_KEYS
        }
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj

# ============================================================
# Section 3: Sub-service stubs (5 of them)
# ============================================================
# Populated by Task D.1; sibling specs replace bodies

# ============================================================
# Section 4: Composite assembly + route
# ============================================================
# Populated by Tasks D.2 / D.3
