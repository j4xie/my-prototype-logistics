"""Phase IIb restaurant kitchen-cost & ops analytics endpoint.

Spec: docs/superpowers/specs/2026-05-15-restaurant-phase-iib-kitchen-cost-analytics-spec.md

Implements ``GET /api/mobile/{factory_id}/smart-bi/analysis/kitchen-cost``
which returns 4 sub-reports for restaurant tenants:

1. ``wastageAnalytics`` — 食材损耗分析
2. ``requisitionTrend`` — 领料成本趋势
3. ``stocktakingVariance`` — 盘点差异报告
4. ``foodCostRatio`` — 食材成本占比 (with benchmark alert)

Factory tenants receive a ``FACTORY_BRANCH_NOT_APPLICABLE`` envelope (§4.3)
mirroring the IIa polymorphic dispatch pattern from
``analysis_production.py:446-506`` and ``analysis_finance.py:3412-3500``.

Phase IIb has NO Java equivalent — endpoint is Python-native per Phase 2A
architecture. Rules 8 / 9 (Java Map.of / Lombok Jackson serialization) do
NOT apply. Rules 1 / 4 / 6 / 10 / 11 / 12 from ``.claude/rules/python-java-port.md``
DO apply and are enforced inline.

Data sources (per spec §2):

* ``agg_restaurant_daily_totals`` — Gold daily scalars (PRIMARY trend path)
* ``agg_restaurant_daily_ops`` — Gold EAV breakdowns (Top-N rankings; prod
  emits 5 ``kpi_kind`` codes per pre-IIb audit, NOT the 7 declared in the
  migration comment)
* ``fact_restaurant_wastage`` / ``fact_restaurant_requisition`` /
  ``fact_restaurant_stocktaking`` — Silver fact tables (status-filtered
  reads, Silver fallback on Gold drift)
* ``dim_ingredient`` — name/category joins (category is messy free-text
  with synonym pollution + NULL rows; Python-side normalization required)
* ``agg_daily`` — Phase IIa Gold POS revenue (``foodCostRatio``
  denominator, mirrors IIa ``_get_restaurant_finance_kpi`` COALESCE
  pattern at ``analysis_finance.py:3312-3328``)

OQ-2 Hybrid (Steve signed off 2026-05-15): ship empty-state-graceful.
Single chain with real ops data is enough to dispatch — 13 empty chains
see graceful zero/null per-section.

OQ-IIB-NEW (signed off 2026-05-15): ``est_cost`` is accepted denominator
with caveat surfaced in ``foodCostRatio.dataCaveats``.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from smartbi_compat._rbac_role import require_analytics_read
from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.api.analysis_finance import _decimal_to_number
from smartbi_compat.api.analysis_sales import _validate_restaurant_date_range
from smartbi_compat.auth import AuthContext
from smartbi_compat.schema_compat import _java_isoformat, wrap_response
from smartbi_compat.tenant import TenantType, get_tenant_type

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Constants
# ============================================================

# Spec §4.5: topN cap. Default 10, max 50 (cycle-4 IMPORTANT-1).
DEFAULT_TOP_N = 10
MAX_TOP_N = 50

# Spec §2.1: synonym normalization for messy free-text categories.
CATEGORY_NORMALIZE = {
    "蔬菜类": "蔬菜",
    "调料": "调味料",
    "主粮类": "主食",
}
CATEGORY_OTHER = "其他"

# Spec §1.2 / §4.2: food cost ratio benchmark thresholds. Decimal — not
# float — per Rule 7 (non-integer thresholds use Decimal comparison).
BENCHMARK_HEALTHY = Decimal("0.30")
BENCHMARK_WARNING = Decimal("0.35")
BENCHMARK_CRITICAL = Decimal("0.40")

# Spec §4.3: not-applicable code for factory branch.
FACTORY_BRANCH_NOT_APPLICABLE = "FACTORY_BRANCH_NOT_APPLICABLE"


# ============================================================
# Helpers
# ============================================================


def _normalize_category(raw: Optional[str]) -> str:
    """Spec §2.1 category normalization.

    * NULL / empty / whitespace-only → "其他"
    * Known synonyms (蔬菜类 / 调料 / 主粮类) → canonical form
    * Other free-text values → returned as-is
    """
    if raw is None:
        return CATEGORY_OTHER
    stripped = raw.strip()
    if not stripped:
        return CATEGORY_OTHER
    return CATEGORY_NORMALIZE.get(stripped, stripped)


def _safe_topn(top_n: Optional[int]) -> int:
    """Clamp ``topN`` query param to [1, MAX_TOP_N] with DEFAULT fallback."""
    if top_n is None or top_n <= 0:
        return DEFAULT_TOP_N
    return min(top_n, MAX_TOP_N)


def _compute_alert_level(
    ratio: Optional[Decimal],
) -> tuple[Optional[str], Optional[str]]:
    """Spec §4.2 alert level + message.

    Rule 7: thresholds 0.30 / 0.35 / 0.40 are non-integer → Decimal
    comparison, NOT ``float()``. Returns (alertLevel, alertMessage).

    Mapping:
    * ratio is None         → (None, "暂无营收数据，无法计算占比")
    * ratio < 0.30          → ("GREEN", optimistic message)
    * 0.30 ≤ ratio < 0.35   → ("GREEN", neutral message)
    * 0.35 ≤ ratio < 0.40   → ("YELLOW", warning message)
    * ratio ≥ 0.40          → ("RED", critical message)
    """
    if ratio is None:
        return None, "暂无营收数据，无法计算占比"
    if ratio < BENCHMARK_HEALTHY:
        return "GREEN", "食材成本占比健康"
    if ratio < BENCHMARK_WARNING:
        return "GREEN", "食材成本占比正常"
    if ratio < BENCHMARK_CRITICAL:
        # Spec §4.2 example: "食材成本占比偏高（34.4%），建议优化领料计划"
        # Use Rule 12 — _format_decimal_half_up via quantize-then-render so
        # we mirror Java String.format("%.1f", d) HALF_UP, not Python
        # banker's rounding.
        percent_str = _format_percent_half_up(ratio)
        return "YELLOW", f"食材成本占比偏高（{percent_str}%），建议优化领料计划"
    percent_str = _format_percent_half_up(ratio)
    return "RED", f"食材成本占比严重偏高（{percent_str}%），需立即优化成本结构"


def _format_percent_half_up(ratio: Decimal) -> str:
    """Spec §7.5 Rule 12: format ratio (0-1) as ``XX.X`` percent string
    using ROUND_HALF_UP, NOT Python f-string banker's rounding.

    Pre-quantize to scale 1 with HALF_UP, then render — avoids the
    f-string banker's-rounding zone (per Rule 12 SAFE pattern).
    """
    percent = (ratio * Decimal("100")).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    )
    return str(percent)


def _ratio_with_intermediate_quantize(
    numerator: Decimal, denominator: Decimal
) -> tuple[Optional[Decimal], Optional[Decimal]]:
    """Spec §7.5 Rule 10: divide → quantize(4) → multiply → quantize(2).

    Returns ``(ratio_0_to_1, ratio_percent_0_to_100)``. When denominator
    is zero, returns ``(None, None)`` — caller decides null vs 0 semantics
    (see §4.5 edge cases).
    """
    if denominator == 0:
        return None, None
    intermediate = (numerator / denominator).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP
    )
    percent = (intermediate * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return intermediate, percent


def _money(v: Optional[Decimal]) -> Any:
    """Money quantize(0.01) + _decimal_to_number for JSON. None passthrough."""
    if v is None:
        return None
    return _decimal_to_number(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _qty(v: Optional[Decimal]) -> Any:
    """Quantity quantize(0.001) + _decimal_to_number. None passthrough."""
    if v is None:
        return None
    return _decimal_to_number(v.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def _coerce_decimal(v: Any) -> Decimal:
    """Coerce DB numeric / None to Decimal('0'). Use only when summing
    fields that are documented non-null after WHERE filter; for
    nullable fields prefer ``is not None`` check (Rule 1)."""
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


def _period_key(d: date, group_by: str) -> str:
    """Spec §4.2: format trend period key.

    * day   → YYYY-MM-DD
    * week  → YYYY-Www (Rule 2 calendar year + ISO week)
    * month → YYYY-MM
    """
    if group_by == "week":
        # Rule 2: use calendar year ``d.year`` (NOT ISO year) + ISO week.
        _iso_year, iso_week, _iso_day = d.isocalendar()
        return f"{d.year}-W{iso_week:02d}"
    if group_by == "month":
        return f"{d.year:04d}-{d.month:02d}"
    return d.isoformat()


# ============================================================
# Sub-report 1: Wastage analytics
# ============================================================


async def _get_wastage_analytics(
    factory_id: str,
    start_date: date,
    end_date: date,
    group_by: str,
    top_n: int,
    total_requisition_cost: Optional[Decimal],
    conn: Any,
) -> dict:
    """Spec §4.2 ``wastageAnalytics`` — wastage trend + top ingredients +
    breakdown by type.

    Reads Silver ``fact_restaurant_wastage`` with status filter
    ``IN ('APPROVED', 'SUBMITTED')`` (per §2.1; ``DRAFT`` + ``REJECTED``
    excluded). JOINs ``dim_ingredient`` for ingredient names with
    COALESCE on deleted ingredients (§4.5 deleted-ingredient edge case).

    ``wastageRate`` denominator is ``total_requisition_cost`` — caller
    threads it in from the requisition sub-report (avoids redundant
    query). Returns null when denominator is 0 (Rule 1, §4.5).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_wastage_analytics: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )

    # ---------- Totals + by-type breakdown ----------
    summary_row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(estimated_cost), 0)::numeric(18,2) AS total_cost,
            COUNT(*)                                        AS event_count
        FROM fact_restaurant_wastage
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status IN ('APPROVED', 'SUBMITTED')
        """,
        factory_id, start_date, end_date,
    )
    total_wastage_cost = _coerce_decimal(summary_row["total_cost"]) if summary_row else Decimal("0")
    total_wastage_events = int(summary_row["event_count"]) if summary_row else 0

    by_type_rows = await conn.fetch(
        """
        SELECT
            wastage_type                                AS type,
            COALESCE(SUM(estimated_cost), 0)::numeric(18,2) AS total_cost,
            COUNT(*)                                    AS event_count
        FROM fact_restaurant_wastage
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status IN ('APPROVED', 'SUBMITTED')
        GROUP BY wastage_type
        ORDER BY SUM(estimated_cost) DESC NULLS LAST
        """,
        factory_id, start_date, end_date,
    )
    wastage_by_type = [
        {
            "type": r["type"],
            "totalCost": _money(_coerce_decimal(r["total_cost"])),
            "eventCount": int(r["event_count"]),
        }
        for r in by_type_rows
    ]

    # ---------- Top-N ingredients ----------
    top_ingredient_rows = await conn.fetch(
        """
        SELECT
            w.ingredient_id                              AS ingredient_id,
            COALESCE(i.name, '(已删除食材 #' || w.ingredient_id || ')') AS name,
            i.category                                   AS category,
            i.unit                                       AS unit,
            COALESCE(SUM(w.estimated_cost), 0)::numeric(18,2) AS total_cost,
            COALESCE(SUM(w.quantity), 0)::numeric(18,3)  AS quantity,
            COUNT(*)                                     AS event_count
        FROM fact_restaurant_wastage w
        LEFT JOIN dim_ingredient i
               ON i.ingredient_id = w.ingredient_id
              AND i.factory_id    = w.factory_id
        WHERE w.factory_id = $1
          AND w.date BETWEEN $2 AND $3
          AND w.status IN ('APPROVED', 'SUBMITTED')
        GROUP BY w.ingredient_id, i.name, i.category, i.unit
        ORDER BY SUM(w.estimated_cost) DESC NULLS LAST
        LIMIT $4
        """,
        factory_id, start_date, end_date, top_n,
    )
    top_waste_ingredients = [
        {
            "ingredientId": int(r["ingredient_id"]) if r["ingredient_id"] is not None else None,
            "name": r["name"],
            "category": _normalize_category(r["category"]),
            "totalCost": _money(_coerce_decimal(r["total_cost"])),
            "quantity": _qty(_coerce_decimal(r["quantity"])),
            "unit": r["unit"],
            "eventCount": int(r["event_count"]),
        }
        for r in top_ingredient_rows
    ]

    # ---------- Trend ----------
    trend_rows = await conn.fetch(
        """
        SELECT
            date                                          AS day,
            COALESCE(SUM(estimated_cost), 0)::numeric(18,2) AS total_cost,
            COUNT(*)                                     AS event_count
        FROM fact_restaurant_wastage
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status IN ('APPROVED', 'SUBMITTED')
        GROUP BY date
        ORDER BY date
        """,
        factory_id, start_date, end_date,
    )
    trend = _aggregate_trend(
        trend_rows, group_by, total_cost_key="total_cost", count_key="event_count"
    )

    # ---------- wastage rate (Rule 1 + Rule 10) ----------
    if total_requisition_cost is not None and total_requisition_cost > 0:
        rate, rate_percent = _ratio_with_intermediate_quantize(
            total_wastage_cost, total_requisition_cost
        )
    else:
        rate = None
        rate_percent = None

    return {
        "totalWastageCost": _money(total_wastage_cost),
        "totalWastageEvents": total_wastage_events,
        "wastageRate": _decimal_to_number(rate) if rate is not None else None,
        "wastageRatePercent": _decimal_to_number(rate_percent) if rate_percent is not None else None,
        "topWasteIngredients": top_waste_ingredients,
        "wastageByType": wastage_by_type,
        "trend": trend,
        "dataSource": "agg_restaurant_daily_totals+fact_restaurant_wastage",
    }


def _aggregate_trend(
    daily_rows: list,
    group_by: str,
    total_cost_key: str,
    count_key: str,
) -> list[dict]:
    """Bucket daily rows into day / week / month trend periods.

    Spec §4.2 trend objects have shape ``{period, totalCost, eventCount}``.
    Sort ascending by period key.
    """
    buckets: dict[str, dict[str, Any]] = {}
    for r in daily_rows:
        d = r["day"]
        if d is None:
            continue
        period = _period_key(d, group_by)
        bucket = buckets.setdefault(
            period, {"period": period, "_cost": Decimal("0"), "_count": 0}
        )
        bucket["_cost"] = bucket["_cost"] + _coerce_decimal(r[total_cost_key])
        bucket["_count"] = bucket["_count"] + int(r[count_key])
    out = []
    for period in sorted(buckets.keys()):
        b = buckets[period]
        out.append({
            "period": period,
            "totalCost": _money(b["_cost"]),
            "eventCount": int(b["_count"]),
        })
    return out


# ============================================================
# Sub-report 2: Requisition trend
# ============================================================


async def _get_requisition_trend(
    factory_id: str,
    start_date: date,
    end_date: date,
    group_by: str,
    conn: Any,
) -> dict:
    """Spec §4.2 ``requisitionTrend`` — total cost + by-category + trend.

    Reads Silver ``fact_restaurant_requisition`` with status filter
    ``status = 'APPROVED'`` (per §2.1; only APPROVED requisitions
    contribute to cost trend).

    Rule 7.2 + Rule 1: ``WHERE est_cost IS NOT NULL`` when summing —
    Decimal("0") is a valid cost but NULL est_cost has no unit-price
    backing and biases the trend.

    ``byCategory`` applies Python-side ``CATEGORY_NORMALIZE`` synonym
    merge + NULL → "其他" bucketing, then keeps Top-5 + "其他" per §4.5.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_requisition_trend: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )

    summary_row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(est_cost), 0)::numeric(18,2) AS total_cost,
            COUNT(*)                                  AS event_count
        FROM fact_restaurant_requisition
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status = 'APPROVED'
          AND est_cost IS NOT NULL
        """,
        factory_id, start_date, end_date,
    )
    total_cost = _coerce_decimal(summary_row["total_cost"]) if summary_row else Decimal("0")
    total_events = int(summary_row["event_count"]) if summary_row else 0

    # ---------- By raw category ----------
    raw_category_rows = await conn.fetch(
        """
        SELECT
            i.category                                AS raw_category,
            COALESCE(SUM(r.est_cost), 0)::numeric(18,2) AS total_cost,
            COUNT(*)                                  AS event_count
        FROM fact_restaurant_requisition r
        LEFT JOIN dim_ingredient i
               ON i.ingredient_id = r.ingredient_id
              AND i.factory_id    = r.factory_id
        WHERE r.factory_id = $1
          AND r.date BETWEEN $2 AND $3
          AND r.status = 'APPROVED'
          AND r.est_cost IS NOT NULL
        GROUP BY i.category
        """,
        factory_id, start_date, end_date,
    )
    by_category = _normalize_category_aggregation(raw_category_rows, total_cost)

    # ---------- Trend ----------
    trend_rows = await conn.fetch(
        """
        SELECT
            date                                       AS day,
            COALESCE(SUM(est_cost), 0)::numeric(18,2)  AS total_cost,
            COUNT(*)                                   AS event_count
        FROM fact_restaurant_requisition
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status = 'APPROVED'
          AND est_cost IS NOT NULL
        GROUP BY date
        ORDER BY date
        """,
        factory_id, start_date, end_date,
    )
    trend = _aggregate_trend(
        trend_rows, group_by, total_cost_key="total_cost", count_key="event_count"
    )

    return {
        "totalCost": _money(total_cost),
        "totalEvents": total_events,
        "byCategory": by_category,
        "trend": trend,
        "dataSource": "agg_restaurant_daily_totals+fact_restaurant_requisition",
    }


def _normalize_category_aggregation(
    raw_rows: list, total_cost: Decimal
) -> list[dict]:
    """Apply Python-side ``CATEGORY_NORMALIZE`` synonym merge + NULL →
    "其他" bucketing. Returns Top-5 by total cost + "其他" rollup row.

    Spec §4.5 numeric caps: ``byCategory`` is normalized to 5 buckets max
    + "其他" — no separate ``topN`` slicing (bucketing already caps).
    """
    # Merge synonyms first.
    merged: dict[str, dict[str, Any]] = {}
    for r in raw_rows:
        category = _normalize_category(r["raw_category"])
        bucket = merged.setdefault(
            category, {"category": category, "_cost": Decimal("0"), "_count": 0}
        )
        bucket["_cost"] = bucket["_cost"] + _coerce_decimal(r["total_cost"])
        bucket["_count"] = bucket["_count"] + int(r["event_count"])

    # Sort by cost desc, take top 5, roll up rest into "其他".
    ordered = sorted(merged.values(), key=lambda b: b["_cost"], reverse=True)
    top_5 = ordered[:5]
    rest = ordered[5:]

    out = []
    for b in top_5:
        out.append(_render_category_row(b["category"], b["_cost"], b["_count"], total_cost))
    if rest:
        rest_cost = sum((b["_cost"] for b in rest), Decimal("0"))
        rest_count = sum(int(b["_count"]) for b in rest)
        # Merge rest into existing "其他" bucket if present in top 5, else append.
        existing_other = next(
            (row for row in out if row["category"] == CATEGORY_OTHER), None
        )
        if existing_other is not None:
            # Existing row already has 'share' computed; recompute after merge.
            new_cost = (
                _coerce_decimal(existing_other["totalCost"]) + rest_cost
                if existing_other["totalCost"] is not None
                else rest_cost
            )
            existing_other["totalCost"] = _money(new_cost)
            existing_other["eventCount"] = int(existing_other["eventCount"]) + rest_count
            ratio, _ = _ratio_with_intermediate_quantize(new_cost, total_cost)
            existing_other["share"] = (
                _decimal_to_number(ratio) if ratio is not None else None
            )
        else:
            out.append(
                _render_category_row(
                    CATEGORY_OTHER, rest_cost, rest_count, total_cost
                )
            )
    return out


def _render_category_row(
    category: str, cost: Decimal, count: int, total_cost: Decimal
) -> dict:
    """Render single byCategory entry with share (Rule 10 intermediate quantize)."""
    ratio, _ = _ratio_with_intermediate_quantize(cost, total_cost)
    return {
        "category": category,
        "totalCost": _money(cost),
        "eventCount": count,
        "share": _decimal_to_number(ratio) if ratio is not None else None,
    }


# ============================================================
# Sub-report 3: Stocktaking variance
# ============================================================


async def _get_stocktaking_variance(
    factory_id: str,
    start_date: date,
    end_date: date,
    top_n: int,
    conn: Any,
) -> dict:
    """Spec §4.2 ``stocktakingVariance``.

    Reads Silver ``fact_restaurant_stocktaking`` with status filter
    ``status IN ('COMPLETED', 'APPROVED')`` (per §2.1).

    Aggregations:
    * ``totalShortageQty`` — sum of difference_qty < 0 (negative)
    * ``totalShortageCost`` — sum of difference_cost where diff_qty < 0
    * ``totalSurplusQty`` — sum of difference_qty > 0
    * ``totalSurplusCost`` — sum of difference_cost where diff_qty > 0
    * ``netVarianceCost`` = totalShortageCost - totalSurplusCost (positive = net loss)

    §4.5 edge case: ``difference_cost = NULL`` rows are excluded from
    totals but included in ``stocktakingCount`` for audit transparency.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_stocktaking_variance: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )

    summary_row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(CASE WHEN difference_qty < 0 THEN difference_qty END), 0)::numeric(18,3) AS shortage_qty,
            COALESCE(SUM(CASE WHEN difference_qty < 0 THEN difference_cost END), 0)::numeric(18,2) AS shortage_cost,
            COALESCE(SUM(CASE WHEN difference_qty > 0 THEN difference_qty END), 0)::numeric(18,3) AS surplus_qty,
            COALESCE(SUM(CASE WHEN difference_qty > 0 THEN difference_cost END), 0)::numeric(18,2) AS surplus_cost,
            MAX(date)                                  AS last_date,
            COUNT(*)                                   AS event_count
        FROM fact_restaurant_stocktaking
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status IN ('COMPLETED', 'APPROVED')
        """,
        factory_id, start_date, end_date,
    )
    shortage_qty = _coerce_decimal(summary_row["shortage_qty"]) if summary_row else Decimal("0")
    shortage_cost = _coerce_decimal(summary_row["shortage_cost"]) if summary_row else Decimal("0")
    surplus_qty = _coerce_decimal(summary_row["surplus_qty"]) if summary_row else Decimal("0")
    surplus_cost = _coerce_decimal(summary_row["surplus_cost"]) if summary_row else Decimal("0")
    last_date = summary_row["last_date"] if summary_row else None
    event_count = int(summary_row["event_count"]) if summary_row else 0

    # Net variance: positive = net loss (shortage outweighs surplus).
    net_variance_cost = shortage_cost - surplus_cost

    # ---------- Top-N ingredients by abs(diff_cost) ----------
    top_rows = await conn.fetch(
        """
        SELECT
            s.ingredient_id                            AS ingredient_id,
            COALESCE(i.name, '(已删除食材 #' || s.ingredient_id || ')') AS name,
            i.category                                 AS category,
            COALESCE(SUM(s.difference_qty), 0)::numeric(18,3) AS diff_qty,
            COALESCE(SUM(
                CASE
                    WHEN s.difference_qty < 0 THEN -ABS(s.difference_cost)
                    WHEN s.difference_qty > 0 THEN  ABS(s.difference_cost)
                    ELSE 0
                END
            ), 0)::numeric(18,2)                       AS diff_cost
        FROM fact_restaurant_stocktaking s
        LEFT JOIN dim_ingredient i
               ON i.ingredient_id = s.ingredient_id
              AND i.factory_id    = s.factory_id
        WHERE s.factory_id = $1
          AND s.date BETWEEN $2 AND $3
          AND s.status IN ('COMPLETED', 'APPROVED')
        GROUP BY s.ingredient_id, i.name, i.category
        ORDER BY ABS(
            COALESCE(SUM(s.difference_cost), 0)
        ) DESC NULLS LAST
        LIMIT $4
        """,
        factory_id, start_date, end_date, top_n,
    )
    by_ingredient = [
        {
            "ingredientId": int(r["ingredient_id"]) if r["ingredient_id"] is not None else None,
            "name": r["name"],
            "category": _normalize_category(r["category"]),
            "diffQty": _qty(_coerce_decimal(r["diff_qty"])),
            "diffCost": _money(_coerce_decimal(r["diff_cost"])),
        }
        for r in top_rows
    ]

    return {
        "totalShortageQty": _qty(shortage_qty),
        "totalShortageCost": _money(shortage_cost),
        "totalSurplusQty": _qty(surplus_qty),
        "totalSurplusCost": _money(surplus_cost),
        "netVarianceCost": _money(net_variance_cost),
        "byIngredient": by_ingredient,
        "lastStocktakingDate": last_date.isoformat() if last_date is not None else None,
        "stocktakingCount": event_count,
        "dataSource": "fact_restaurant_stocktaking",
    }


# ============================================================
# Sub-report 4: Food cost ratio
# ============================================================


async def _get_food_cost_ratio(
    factory_id: str,
    start_date: date,
    end_date: date,
    conn: Any,
) -> tuple[dict, Decimal]:
    """Spec §4.2 ``foodCostRatio`` — requisition est_cost / POS revenue.

    Revenue source: ``agg_daily`` Gold table (NOT ``fact_pos_transaction``)
    with ``COALESCE(SUM(actual_receive), SUM(gross_amount), 0)`` fallback
    mirroring IIa ``_get_restaurant_finance_kpi`` at
    ``analysis_finance.py:3312-3328``.

    §4.5 edge cases:
    * Requisition data exists but revenue == 0 → totalRequisitionCost
      preserved (NOT zeroed), ratio=null, alertLevel=null, alertMessage
      explains missing revenue.
    * Revenue exists but no requisition rows → totalRequisitionCost=0,
      ratio=0.0, alertLevel=GREEN (honest "no cost incurred").

    Returns (food_cost_ratio_dict, total_requisition_cost). The second
    value is threaded into ``_get_wastage_analytics`` so wastageRate
    shares the same denominator (avoid double-query).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_food_cost_ratio: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )

    requisition_row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(est_cost), 0)::numeric(18,2) AS total_cost,
            COUNT(*)                                  AS event_count
        FROM fact_restaurant_requisition
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
          AND status = 'APPROVED'
          AND est_cost IS NOT NULL
        """,
        factory_id, start_date, end_date,
    )
    total_requisition_cost = (
        _coerce_decimal(requisition_row["total_cost"]) if requisition_row else Decimal("0")
    )
    requisition_event_count = (
        int(requisition_row["event_count"]) if requisition_row else 0
    )

    revenue_row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(actual_receive), SUM(gross_amount), 0)::numeric(18,2) AS total_revenue
        FROM agg_daily
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        """,
        factory_id, start_date, end_date,
    )
    total_revenue = _coerce_decimal(revenue_row["total_revenue"]) if revenue_row else Decimal("0")

    # ---------- Edge case branching (§4.5) ----------
    if total_revenue == 0 and requisition_event_count > 0:
        # REQ_OK + POS_EMPTY: preserve requisition cost, ratio null,
        # alert null, message explains missing revenue.
        ratio = None
        ratio_percent = None
        alert_level, alert_message = None, "暂无营收数据，无法计算占比"
    elif total_revenue > 0 and requisition_event_count == 0:
        # POS_OK + REQ_EMPTY: ratio is honestly 0.0 (no waste), GREEN.
        ratio = Decimal("0")
        ratio_percent = Decimal("0")
        alert_level = "GREEN"
        alert_message = "暂无领料数据"
    elif total_revenue > 0:
        # Standard path: divide-quantize-multiply per Rule 10.
        ratio, ratio_percent = _ratio_with_intermediate_quantize(
            total_requisition_cost, total_revenue
        )
        alert_level, alert_message = _compute_alert_level(ratio)
    else:
        # Both 0 → no signal at all. Ratio null + alert null with neutral
        # message. Frontend renders whole-tab empty state per §5.6.
        ratio = None
        ratio_percent = None
        alert_level = None
        alert_message = "暂无营收数据，无法计算占比"

    return (
        {
            "totalRequisitionCost": _money(total_requisition_cost),
            "totalRevenue": _money(total_revenue),
            "ratio": _decimal_to_number(ratio) if ratio is not None else None,
            "ratioPercent": _decimal_to_number(ratio_percent) if ratio_percent is not None else None,
            "benchmark": {
                "healthy": _decimal_to_number(BENCHMARK_HEALTHY),
                "warning": _decimal_to_number(BENCHMARK_WARNING),
                "critical": _decimal_to_number(BENCHMARK_CRITICAL),
            },
            "alertLevel": alert_level,
            "alertMessage": alert_message,
            "dataCaveats": ["使用领料估算成本（est_cost），非会计实际成本"],
            "dataSource": "agg_daily+fact_restaurant_requisition",
        },
        total_requisition_cost,
    )


# ============================================================
# Orchestrator
# ============================================================


def _empty_kitchen_cost_envelope(
    factory_id: str,
    start_date: date,
    end_date: date,
    group_by: str,
) -> dict:
    """Defensive empty envelope when SmartBI pool unavailable.

    Mirrors IIa ``_restaurant_finance_overview`` defensive pool-failure
    path (analysis_finance.py:3445-3463). Returns a non-error envelope
    so the UI renders empty state, not a 500.
    """
    days = (end_date - start_date).days + 1
    return {
        "tenantType": "RESTAURANT",
        "factoryId": factory_id,
        "dateRange": {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "days": days,
            "groupBy": group_by,
        },
        "wastageAnalytics": {
            "totalWastageCost": 0,
            "totalWastageEvents": 0,
            "wastageRate": None,
            "wastageRatePercent": None,
            "topWasteIngredients": [],
            "wastageByType": [],
            "trend": [],
            "dataSource": "agg_restaurant_daily_totals+fact_restaurant_wastage",
        },
        "requisitionTrend": {
            "totalCost": 0,
            "totalEvents": 0,
            "byCategory": [],
            "trend": [],
            "dataSource": "agg_restaurant_daily_totals+fact_restaurant_requisition",
        },
        "stocktakingVariance": {
            "totalShortageQty": 0,
            "totalShortageCost": 0,
            "totalSurplusQty": 0,
            "totalSurplusCost": 0,
            "netVarianceCost": 0,
            "byIngredient": [],
            "lastStocktakingDate": None,
            "stocktakingCount": 0,
            "dataSource": "fact_restaurant_stocktaking",
        },
        "foodCostRatio": {
            "totalRequisitionCost": 0,
            "totalRevenue": 0,
            "ratio": None,
            "ratioPercent": None,
            "benchmark": {
                "healthy": _decimal_to_number(BENCHMARK_HEALTHY),
                "warning": _decimal_to_number(BENCHMARK_WARNING),
                "critical": _decimal_to_number(BENCHMARK_CRITICAL),
            },
            "alertLevel": None,
            "alertMessage": "暂无营收数据，无法计算占比",
            "dataCaveats": ["使用领料估算成本（est_cost），非会计实际成本"],
            "dataSource": "agg_daily+fact_restaurant_requisition",
        },
        "generatedAt": _java_isoformat(datetime.now()),
    }


async def _restaurant_kitchen_cost_dispatch(
    factory_id: str,
    start_date: date,
    end_date: date,
    group_by: str,
    top_n: int,
) -> dict:
    """Spec §4 restaurant branch orchestrator.

    Calls all 4 sub-report helpers in sequence on a single pooled
    connection. Returns a ``wrap_response``-wrapped envelope.

    Sub-report dependency: ``foodCostRatio`` computes
    ``total_requisition_cost`` once and threads it into
    ``wastageAnalytics`` so ``wastageRate`` shares the same denominator
    without an extra SQL round-trip.
    """
    _validate_restaurant_date_range(start_date, end_date)

    pool = None
    try:
        from smartbi.config import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
    except Exception as e:  # pragma: no cover — defensive logging branch
        logger.warning(
            "[analysis_restaurant_ops] smartbi pool acquisition failed factory=%s: %s",
            factory_id, e,
        )

    if pool is None:
        return wrap_response(
            _empty_kitchen_cost_envelope(factory_id, start_date, end_date, group_by)
        )

    async with pool.acquire() as conn:
        food_cost_ratio, total_requisition_cost = await _get_food_cost_ratio(
            factory_id, start_date, end_date, conn
        )
        wastage = await _get_wastage_analytics(
            factory_id, start_date, end_date, group_by, top_n,
            total_requisition_cost, conn,
        )
        requisition = await _get_requisition_trend(
            factory_id, start_date, end_date, group_by, conn
        )
        stocktaking = await _get_stocktaking_variance(
            factory_id, start_date, end_date, top_n, conn
        )

    days = (end_date - start_date).days + 1
    return wrap_response({
        "tenantType": "RESTAURANT",
        "factoryId": factory_id,
        "dateRange": {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "days": days,
            "groupBy": group_by,
        },
        "wastageAnalytics": wastage,
        "requisitionTrend": requisition,
        "stocktakingVariance": stocktaking,
        "foodCostRatio": food_cost_ratio,
        "generatedAt": _java_isoformat(datetime.now()),
    })


def _factory_branch_not_applicable_envelope(factory_id: str) -> dict:
    """Spec §4.3 — factory tenants get a friendly not-applicable envelope.

    Intentionally success:true (not 404) so the frontend can show a
    type-mismatch notice without an error toast. Mirrors
    ``analysis_production.py`` factory-branch handling.
    """
    return wrap_response({
        "tenantType": "FACTORY",
        "factoryId": factory_id,
        "notApplicable": True,
        "code": FACTORY_BRANCH_NOT_APPLICABLE,
        "message": (
            "厨房成本运营分析仅适用于餐饮租户。"
            "工厂租户请使用利润/成本/应收/应付分析。"
        ),
    })


# ============================================================
# Router entry
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/kitchen-cost")
async def get_kitchen_cost_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    groupBy: str = Query("day", description="day / week / month"),
    topN: Optional[int] = Query(
        DEFAULT_TOP_N,
        ge=1,
        le=MAX_TOP_N,
        description=(
            f"Top-N cap for ranking lists (wastage / stocktaking). "
            f"Default {DEFAULT_TOP_N}, max {MAX_TOP_N}."
        ),
    ),
    auth: AuthContext = Depends(require_analytics_read),
) -> Any:
    """Phase IIb kitchen-cost analytics endpoint (spec §4).

    Polymorphic dispatch (§4.1):
    * Restaurant tenants (cretas_db.factories.type ∈ {RESTAURANT, BRANCH})
      → 4-sub-report envelope (§4.2).
    * Factory tenants → FACTORY_BRANCH_NOT_APPLICABLE envelope (§4.3).
    """
    # Param validation (§4.5 edge case 4 + Rule 6 explicit precondition).
    if startDate is None or endDate is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_DATE_RANGE",
                "message": "startDate / endDate are required",
            },
        )

    if groupBy not in ("day", "week", "month"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_GROUP_BY",
                "message": "groupBy must be one of: day / week / month",
            },
        )

    top_n_clamped = _safe_topn(topN)

    # ---------- Tenant detection (mirror analysis_production.py 468-488) ----------
    cretas_pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        cretas_pool = await get_cretas_pool()
    except Exception as e:  # pragma: no cover — defensive logging branch
        logger.warning(
            "[analysis_restaurant_ops] cretas_db pool acquisition failed factory=%s: %s",
            auth.factory_id, e,
        )

    if cretas_pool is None:
        # Defensive: pool unavailable → fall back to factory branch
        # (returns not-applicable envelope, no DB work). Matches the
        # Java predicate-on-failure fallback that
        # analysis_production.py:480-485 uses.
        tenant = TenantType.FACTORY
    else:
        async with cretas_pool.acquire() as conn:
            tenant = await get_tenant_type(auth.factory_id, conn)

    if tenant.is_restaurant_tenant:
        envelope = await _restaurant_kitchen_cost_dispatch(
            auth.factory_id, startDate, endDate, groupBy, top_n_clamped
        )
        if isinstance(envelope, dict):
            strip_price_for_role(envelope.get("data"), auth.role)
        return envelope

    # Factory branch.
    envelope = _factory_branch_not_applicable_envelope(auth.factory_id)
    return envelope
