"""Phase 2A: POST /api/mobile/{factoryId}/smart-bi/drill-down

Mirror Java SmartBIServiceImpl.processDrillDown (line 1018-1069).
PR-A scope: 5 dimension dispatch + T7 audit write + T10 error envelope.

See spec: docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
"""
from __future__ import annotations

import calendar
import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text

logger = logging.getLogger(__name__)

from smartbi_compat.api.analysis_finance import (  # noqa: E402
    _decimal_to_number, _to_decimal, _utc_now_iso,
)
from smartbi_compat.api.analysis_sales import (  # noqa: E402
    _to_thread, _get_sync_engine,
    _get_product_ranking, _get_sales_trend_chart, _get_salesperson_ranking,
)
from smartbi_compat.api.analysis_region import _get_region_analysis  # noqa: E402
from smartbi_compat.api.analysis_department import _get_department_ranking  # noqa: E402
from smartbi_compat._java_compat import _format_decimal_half_up  # noqa: E402
from smartbi_compat._rbac_strip import strip_price_for_role  # noqa: E402
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory  # noqa: E402
from smartbi_compat.date_range import DateRange  # noqa: E402
from smartbi_compat.schema_compat import wrap_response, wrap_error  # noqa: E402


_SUPPORTED_DIMENSIONS = frozenset({
    "region", "department", "product", "time", "salesperson",
})
_ACTION_TYPE_DRILLDOWN = "DRILLDOWN"


router = APIRouter()


class DrilldownBusinessException(Exception):
    """Mirror Java BusinessException(code, message). withHint/withHintTarget
    NOT exposed (T10: controller catch flattens to 5-field envelope)."""

    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class DrillDownRequestModel(BaseModel):
    """Mirror controller-level DrillDownRequestDTO (7 fields) + 6 forward-compat fields."""
    dimension: str = Field(..., min_length=1, description="下钻维度")
    value: Optional[str] = None
    parentDimension: Optional[str] = None
    parentValue: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    parentContext: Optional[str] = None
    level: Optional[int] = 1
    sortBy: Optional[str] = None
    sortDirection: Optional[str] = None
    limit: Optional[int] = None
    includeChildren: Optional[bool] = None


def _compute_drill_path(parent_context: Optional[str], filter_value: Optional[str]) -> str:
    """Mirror DrillDownRequest.getDrillPath (Java line 295-302). T4 lock.

    Rule 1: explicit None+empty checks (mirror Java `== null || isEmpty()`).
    """
    if parent_context is None or parent_context == "":
        return filter_value if filter_value is not None else "全部"
    if filter_value is None or filter_value == "":
        return parent_context
    return f"{parent_context} > {filter_value}"


def _default_date_range_this_month() -> tuple:
    """Mirror DateRange.thisMonth() (Java line 123-133). T5 lock.

    Returns (start, end) tuple where end is LAST day of current month
    (NOT today, per Java line 130: `today.withDayOfMonth(today.lengthOfMonth())`).
    """
    today = date.today()
    start_of_month = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end_of_month = today.replace(day=last_day)
    return start_of_month, end_of_month


async def _drilldown_get_province_ranking(
    factory_id: str, region: str, range_: DateRange,
) -> list:
    """Mirror RegionAnalysisServiceImpl.getProvinceRanking (Java line 97).
    Returns List<RankingItem> dicts. Aggregate by province where region=:region.

    KEY-ORDER per RankingItem (Lombok @Data declaration order):
      [rank, name, value, target, completionRate, alertLevel]
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT province AS name,
                       SUM(amount) AS total_amount,
                       SUM(monthly_target) AS total_target
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND region = :region
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
                GROUP BY province
                ORDER BY total_amount DESC
            """), {
                "factory_id": factory_id,
                "region": region,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchall()
            return _build_drilldown_ranking(rows)
    return await _to_thread(_exec)


async def _drilldown_get_city_ranking(
    factory_id: str, province: str, range_: DateRange,
) -> list:
    """Mirror RegionAnalysisServiceImpl.getCityRanking (Java line 146).

    D6 dead branch — controller DTO has no `level` field; HTTP path always
    sees level=1 → L2 path. Ported for byte parity (PR-B unit test).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT city AS name,
                       SUM(amount) AS total_amount,
                       SUM(monthly_target) AS total_target
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND province = :province
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
                GROUP BY city
                ORDER BY total_amount DESC
            """), {
                "factory_id": factory_id,
                "province": province,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchall()
            return _build_drilldown_ranking(rows)
    return await _to_thread(_exec)


def _build_drilldown_ranking(rows) -> list:
    """Build RankingItem dict list from (name, total_amount, total_target) rows.

    RankingItem 6-field shape (Lombok @Data declaration order):
      [rank, name, value, target, completionRate, alertLevel]
    """
    rankings = []
    for rank, row in enumerate(rows, start=1):
        name = row[0]
        total_amount = _to_decimal(row[1] if row[1] is not None else 0)
        total_target = _to_decimal(row[2] if row[2] is not None else 0)
        if total_target > Decimal("0"):
            # Rule 10: divide quantize 4 first, then multiply, mirrors Java
            # BigDecimal.divide(scale=4, HALF_UP).multiply(100). Final scale-2
            # quantize uses explicit ROUND_HALF_UP to match Java setScale(2, HALF_UP).
            completion_rate = (
                (total_amount / total_target).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                * Decimal("100")
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            completion_rate = Decimal("0")
        rankings.append({
            "rank": rank,
            "name": name,
            "value": _decimal_to_number(total_amount),
            "target": _decimal_to_number(total_target),
            "completionRate": _decimal_to_number(completion_rate),
            "alertLevel": _determine_target_completion_alert(completion_rate),
        })
    return rankings


def _determine_target_completion_alert(rate: Decimal) -> str:
    """Sister-pattern target completion alert (60/85 thresholds)."""
    if rate < Decimal("60"):
        return "RED"
    if rate < Decimal("85"):
        return "YELLOW"
    return "GREEN"


async def _drilldown_get_department_detail(
    factory_id: str, dept_name: str, start_date: date, end_date: date,
) -> dict:
    """Mirror DepartmentAnalysisServiceImpl.getDepartmentDetail (Java line 113).
    Returns DashboardResponse dict (16 fields with 4 hardcoded KpiCards).

    Empty F999 case → all aggregates 0, 4 KPI cards with 0 values.
    Real-data case (production): aggregate metrics from smart_bi_department_data
    by (factory_id, department, date range) — not exercised in F999 contract test.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT
                    COALESCE(SUM(amount), 0) AS total_amount,
                    COALESCE(SUM(monthly_target), 0) AS total_target,
                    COUNT(DISTINCT salesperson) AS member_count,
                    COALESCE(SUM(cost), 0) AS total_cost
                FROM smart_bi_department_data
                WHERE factory_id = :factory_id
                  AND department = :dept_name
                  AND record_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
            """), {
                "factory_id": factory_id,
                "dept_name": dept_name,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchone()
            return _build_department_detail_response(row)
    return await _to_thread(_exec)


def _build_department_detail_response(row) -> dict:
    """Build DashboardResponse dict matching drill-down-F999-department-L2.json golden.

    16-field shape (Lombok @Data declaration order):
      [period, startDate, endDate, kpiCards, metricCards, rankings, charts, chartList,
       aiInsights, alerts, recommendations, suggestions, generatedAt, lastUpdated,
       fromCache, cacheExpireAt]

    KpiCard 13-field shape (Lombok @Data declaration order):
      [key, title, value, rawValue, unit, change, changeRate, trend, status,
       compareText, description, targetValue, completionRate]
    """
    if row is None:
        total_amount = Decimal("0")
        total_target = Decimal("0")
        member_count = 0
        total_cost = Decimal("0")
    else:
        total_amount = _to_decimal(row[0] if row[0] is not None else 0)
        total_target = _to_decimal(row[1] if row[1] is not None else 0)
        member_count = int(row[2] if row[2] is not None else 0)
        total_cost = _to_decimal(row[3] if row[3] is not None else 0)

    if total_target > Decimal("0"):
        # Rule 10: divide quantize 4 first, then multiply, mirrors Java
        # BigDecimal.divide(scale=4, HALF_UP).multiply(100). Final scale-2
        # quantize uses explicit ROUND_HALF_UP to match Java setScale(2, HALF_UP).
        completion_rate = (
            (total_amount / total_target).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        completion_rate = Decimal("0")
    if member_count > 0:
        sales_per_capita = (total_amount / Decimal(member_count)).quantize(Decimal("0.01"))
        cost_per_capita = (total_cost / Decimal(member_count)).quantize(Decimal("0.01"))
    else:
        sales_per_capita = Decimal("0")
        cost_per_capita = Decimal("0")

    target_status = "red" if completion_rate < Decimal("60") else (
        "yellow" if completion_rate < Decimal("85") else "green"
    )

    kpi_cards = [
        _build_kpi_card("SALES_AMOUNT", "销售额", total_amount, "元", "green"),
        _build_kpi_card("TARGET_COMPLETION", "目标完成率", completion_rate, "%", target_status),
        _build_kpi_card("SALES_PER_CAPITA", "人均产出", sales_per_capita, "元", "green"),
        _build_kpi_card("COST_PER_CAPITA", "人均成本", cost_per_capita, "元", "green"),
    ]

    return {
        "period": None,
        "startDate": None,
        "endDate": None,
        "kpiCards": kpi_cards,
        "metricCards": None,
        "rankings": {"salesperson": []},
        "charts": {},
        "chartList": None,
        "aiInsights": None,
        "alerts": None,
        "recommendations": None,
        "suggestions": None,
        "generatedAt": None,
        "lastUpdated": _utc_now_iso(),
        "fromCache": False,
        "cacheExpireAt": None,
    }


def _build_kpi_card(key: str, title: str, value: Decimal, unit: str, status: str) -> dict:
    """KpiCard 13-field shape (Lombok @Data declaration order)."""
    # Rule 12 fix 2026-05-07: Decimal.quantize default = ROUND_HALF_EVEN (banker's),
    # but Java BigDecimal.setScale + String.format use HALF_UP. _format_decimal_half_up
    # mirrors Java %.2f exactly (HALF_UP rounding, no float precision loss).
    quantized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "key": key,
        "title": title,
        "value": _format_decimal_half_up(value, 2),
        "rawValue": float(quantized),
        "unit": unit,
        "change": None,
        "changeRate": None,
        "trend": "flat",
        "status": status,
        "compareText": None,
        "description": None,
        "targetValue": None,
        "completionRate": None,
    }


async def _drilldown_get_product_distribution_chart(
    factory_id: str, range_: DateRange,
) -> dict:
    """Mirror SalesAnalysisServiceImpl.getProductDistributionChart (Java line 537).
    Returns ChartConfig dict (PIE) — Rule 9 carry-over: 7-field emit-all + lowercase xaxis/yaxis.

    KEY-ORDER from F999 golden (drill-down-F999-product.json):
      [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    options KEY-ORDER: [showPercentage, showLegend]
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT product_name AS category, SUM(amount) AS amount
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
                GROUP BY product_name
                ORDER BY amount DESC
                LIMIT 10
            """), {
                "factory_id": factory_id,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchall()
            return _build_product_distribution_chart(rows)
    return await _to_thread(_exec)


def _build_product_distribution_chart(rows) -> dict:
    """ChartConfig 7-field shape from F999 golden truth (drill-down-F999-product.json).

    Rule 9: xaxisField/yaxisField are LOWERCASE 'a' (Introspector.decapitalize quirk).
    Rule 9: All 7 fields emitted (no @JsonInclude(NON_NULL) on ChartConfig DTO).
    Key order strictly mirrors Lombok @Data declaration order per golden.
    """
    chart_data = [
        {
            "category": row[0],
            "amount": _decimal_to_number(_to_decimal(row[1] if row[1] is not None else 0)),
        }
        for row in rows
    ]
    return {
        "chartType": "PIE",
        "title": "产品销售占比",
        "seriesField": None,
        "data": chart_data,
        "options": {"showPercentage": True, "showLegend": True},
        "xaxisField": "category",
        "yaxisField": "amount",
    }


async def _drilldown_get_salesperson_metrics(
    factory_id: str, salesperson: str, range_: DateRange,
) -> list:
    """Mirror SalesAnalysisServiceImpl.getSalespersonMetrics (Java line 404).
    Returns LIST of MetricResult dicts. F999 has no L2 salesperson golden;
    real-data shape verified by sister analysis_sales.py MetricResult conventions.

    Each MetricResult element has 11 Lombok @Data fields:
      [metricCode, metricName, value, formattedValue, unit, changePercent,
       changeDirection, changeValue, alertLevel, dimensionValue, description]
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT
                    COALESCE(SUM(amount), 0) AS total_sales,
                    COALESCE(SUM(quantity), 0) AS total_quantity,
                    COALESCE(SUM(profit), 0) AS total_profit,
                    COUNT(DISTINCT order_id) AS order_count
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND salesperson = :salesperson
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
            """), {
                "factory_id": factory_id,
                "salesperson": salesperson,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchone()
            return _build_salesperson_metrics(salesperson, row)
    return await _to_thread(_exec)


def _build_salesperson_metrics(salesperson: str, row) -> list:
    """Build List[MetricResult] dicts. 4 metrics (sales/quantity/profit/orders).

    MetricResult 11-field shape (Lombok @Data declaration order):
      [metricCode, metricName, value, formattedValue, unit, changePercent,
       changeDirection, changeValue, alertLevel, dimensionValue, description]

    Rule 1: explicit is not None checks (mirror Java != null) for all numeric fields.
    Rule 4: _decimal_to_number for all Decimal output values.
    """
    if row is None:
        total_sales = Decimal("0")
        total_quantity = Decimal("0")
        total_profit = Decimal("0")
        order_count = 0
    else:
        total_sales = _to_decimal(row[0] if row[0] is not None else 0)
        total_quantity = _to_decimal(row[1] if row[1] is not None else 0)
        total_profit = _to_decimal(row[2] if row[2] is not None else 0)
        order_count = int(row[3] if row[3] is not None else 0)

    def _metric(code: str, name: str, value: Decimal, unit: str) -> dict:
        return {
            "metricCode": code,
            "metricName": name,
            "value": _decimal_to_number(value),
            "formattedValue": None,
            "unit": unit,
            "changePercent": None,
            "changeDirection": None,
            "changeValue": None,
            "alertLevel": "GREEN",
            "dimensionValue": salesperson,
            "description": None,
        }

    return [
        _metric("SALESPERSON_TOTAL_SALES", "销售总额", total_sales, "元"),
        _metric("SALESPERSON_TOTAL_QUANTITY", "销售数量", total_quantity, "件"),
        _metric("SALESPERSON_TOTAL_PROFIT", "销售利润", total_profit, "元"),
        _metric("SALESPERSON_ORDER_COUNT", "订单数", Decimal(order_count), "单"),
    ]


# updated_at: Java JPA @LastModifiedDate auto-fills via Hibernate; Python
# must set explicitly because cretas_db.smart_bi_usage_records has updated_at
# NOT NULL without DEFAULT (verified 2026-05-05). Surfaced by PR-B cascade
# routing audit INSERT to cretas_engine — schema constraint exposed Python
# vs Java code-path divergence. See spec §2.3.
_RECORD_USAGE_SQL = text("""
    INSERT INTO smart_bi_usage_records (
        factory_id, user_id, action_type, query_text, token_count,
        cost_amount, cache_hit, response_time_ms, success,
        created_at, updated_at
    ) VALUES (
        :factory_id, :user_id, :action_type, :query_text, :token_count,
        :cost_amount, :cache_hit, :response_time_ms, :success,
        NOW(), NOW()
    )
""")


def _drilldown_record_usage(
    conn,
    factory_id: str,
    user_id: Optional[int] = None,
    action_type: str = _ACTION_TYPE_DRILLDOWN,
    query_text: Optional[str] = None,
    token_count: int = 0,
    cost_amount: Decimal = Decimal("0"),
    cache_hit: bool = False,
    response_time_ms: Optional[int] = None,
    success: bool = True,
) -> None:
    """Mirror SmartBIServiceImpl.recordUsage (called Java line 1066).

    Java call: recordUsage(factoryId, null, "DRILLDOWN", 0, false).
    Python defaults match exactly EXCEPT cost_amount (D8 documented divergence —
    Java computes via calculateCost; Python hardcodes Decimal("0") per Phase 2A scope).

    D7: user_id=None mirrors Java passing null at line 1066 despite SecurityContext having userId.
    T11/T12 RLS app-layer: explicit factory_id IS the tenant isolation (no PG RLS).
    """
    conn.execute(_RECORD_USAGE_SQL, {
        "factory_id": factory_id,
        "user_id": user_id,
        "action_type": action_type,
        "query_text": query_text,
        "token_count": token_count,
        "cost_amount": cost_amount,
        "cache_hit": cache_hit,
        "response_time_ms": response_time_ms,
        "success": success,
    })


async def _drilldown_record_usage_async(
    factory_id: str,
    action_type: str = _ACTION_TYPE_DRILLDOWN,
    user_id: Optional[int] = None,
    query_text: Optional[str] = None,
    token_count: int = 0,
    cost_amount: Decimal = Decimal("0"),
    cache_hit: bool = False,
    success: bool = True,
) -> None:
    """Async wrapper — opens fresh `engine.begin()` write tx (commit on success,
    rollback on exception). Wrapped in `_to_thread` shim for Python 3.8 compat.

    Z1 cycle 4 (per spec §3.7): separate from read dispatch. Java atomicity
    preserved by raise-before-write control flow (caller raises before this
    is awaited, so no row written).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.begin() as conn:
            _drilldown_record_usage(
                conn=conn,
                factory_id=factory_id,
                user_id=user_id,
                action_type=action_type,
                query_text=query_text,
                token_count=token_count,
                cost_amount=cost_amount,
                cache_hit=cache_hit,
                success=success,
            )
    await _to_thread(_exec)


async def _process_region_drilldown(
    factory_id: str, request, range_: DateRange,
):
    """Mirror processRegionDrillDown (service line 1975-1996).
    Returns tuple (data, next_level) — caller assembles final dict in golden order.
    """
    filter_value = request.value
    level = request.level
    if filter_value is None or filter_value == "":
        composite = await _get_region_analysis(factory_id, range_)
        return composite["ranking"], "province"
    if level is None or level <= 1:
        return await _drilldown_get_province_ranking(factory_id, filter_value, range_), "city"
    # D6 dead branch — port for parity (unreachable from HTTP per R3)
    return await _drilldown_get_city_ranking(factory_id, filter_value, range_), None


async def _process_department_drilldown(
    factory_id: str, request, start_date, end_date,
):
    """Mirror processDepartmentDrillDown (service line 2001-2017)."""
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return await _get_department_ranking(factory_id, start_date, end_date), "salesperson"
    return (
        await _drilldown_get_department_detail(factory_id, filter_value, start_date, end_date),
        None,
    )


async def _process_product_drilldown(
    factory_id: str, request, range_: DateRange,
):
    """Mirror processProductDrillDown (service line 2022-2032). Single layer.
    Returns tuple (data, chart) — caller assembles final dict.
    """
    data = await _get_product_ranking(factory_id, range_)
    chart = await _drilldown_get_product_distribution_chart(factory_id, range_)
    return data, chart


async def _process_time_drilldown(
    factory_id: str, request, range_: DateRange,
):
    """Mirror processTimeDrillDown (service line 2037-2059).
    Period mapping: level None→DAY, 1→MONTH, 2→WEEK, else→DAY (T2 dead).
    Returns tuple (data, period).

    Sister `_get_sales_trend_chart` (analysis_sales.py) ports DAY only per its
    spec §5; raises NotImplementedError for WEEK/MONTH. Production HTTP traffic
    sees level=1 → MONTH, so we re-raise as DrilldownBusinessException to keep
    HTTP 200 + success=false envelope (Java parity at HTTP layer; sister helper
    extension to MONTH/WEEK is deferred to a follow-up PR that touches sales).
    """
    level = request.level
    if level is None:
        period = "DAY"
    elif level == 1:
        period = "MONTH"
    elif level == 2:
        period = "WEEK"
    else:
        period = "DAY"
    try:
        data = await _get_sales_trend_chart(factory_id, range_, period)
    except NotImplementedError as e:
        raise DrilldownBusinessException(
            code=501,
            message=f"时间维度下钻暂未支持周期 '{period}': {e}",
        )
    return data, period


async def _process_salesperson_drilldown(
    factory_id: str, request, range_: DateRange,
):
    """Mirror processSalespersonDrillDown (service line 2064-2076).
    Returns just `data` (no nextLevel, no extras — golden has [drillPath, data, level, dimension]).
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return await _get_salesperson_ranking(factory_id, range_)
    return await _drilldown_get_salesperson_metrics(factory_id, filter_value, range_)


async def _process_drilldown_tx(factory_id: str, request) -> dict:
    """Mirror SmartBIServiceImpl.processDrillDown @Transactional (line 1018-1069).

    Z1 cycle 4 redesign: read dispatch via async sister helpers (no shared tx),
    then separate sync engine.begin() tx for recordUsage write.
    Atomicity: raise-before-write control flow preserves Java observable behavior.

    Top-level dict key order is HashMap hash-iter (golden truth) — assembled per-dim
    in EXACT order matching drill-down-F999-{dim}-*.json goldens.
    """
    start_date = request.startDate
    end_date = request.endDate
    if start_date is None or end_date is None:
        start_date, end_date = _default_date_range_this_month()
    range_ = DateRange.custom(start_date, end_date)

    drill_path = _compute_drill_path(request.parentContext, request.value)
    level = request.level
    dimension = request.dimension

    dim_lower = dimension.lower()
    if dim_lower == "region":
        data, next_level = await _process_region_drilldown(factory_id, request, range_)
        # Golden order: [drillPath, data, level, nextLevel, dimension]
        result = {
            "drillPath": drill_path,
            "data": data,
            "level": level,
            "nextLevel": next_level,
            "dimension": dimension,
        }
    elif dim_lower == "department":
        data, next_level = await _process_department_drilldown(
            factory_id, request, start_date, end_date)
        # Golden order: [drillPath, data, level, nextLevel, dimension]
        result = {
            "drillPath": drill_path,
            "data": data,
            "level": level,
            "nextLevel": next_level,
            "dimension": dimension,
        }
    elif dim_lower == "product":
        data, chart = await _process_product_drilldown(factory_id, request, range_)
        # Golden order: [drillPath, data, level, nextLevel, chart, dimension]
        result = {
            "drillPath": drill_path,
            "data": data,
            "level": level,
            "nextLevel": None,
            "chart": chart,
            "dimension": dimension,
        }
    elif dim_lower == "time":
        data, period = await _process_time_drilldown(factory_id, request, range_)
        # Golden order: [period, drillPath, data, level, dimension] — NO nextLevel
        result = {
            "period": period,
            "drillPath": drill_path,
            "data": data,
            "level": level,
            "dimension": dimension,
        }
    elif dim_lower == "salesperson":
        data = await _process_salesperson_drilldown(factory_id, request, range_)
        # Golden order: [drillPath, data, level, dimension] — NO nextLevel
        result = {
            "drillPath": drill_path,
            "data": data,
            "level": level,
            "dimension": dimension,
        }
    else:
        raise DrilldownBusinessException(
            code=400, message=f"不支持的下钻维度: {dimension}",
        )

    # T7: separate write tx after successful dispatch
    await _drilldown_record_usage_async(
        factory_id=factory_id, action_type=_ACTION_TYPE_DRILLDOWN,
    )
    return result


@router.post("/api/mobile/{factory_id}/smart-bi/drill-down")
async def drill_down(
    factory_id: str,
    request: DrillDownRequestModel,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror SmartBIAnalysisController.drillDown (line 531-586).
    HTTP 200 always (Java returns ResponseEntity.ok even on BusinessException).

    I3+I4 carry-over: controller-level DrillDownRequestDTO (Java
    `SmartBIAnalysisController.java:787-798`) does NOT propagate `level` or
    `parentContext` to the service-level DTO. Java service ALWAYS sees
    `level=1` (@Builder.Default) and `parentContext=null`. Python mirrors at
    handler entry to prevent client-injected divergence on these fields.
    """
    request.level = 1
    request.parentContext = None
    try:
        result = await _process_drilldown_tx(
            factory_id=auth.factory_id, request=request,
        )
        return wrap_response(strip_price_for_role(result, auth.role))
    except DrilldownBusinessException as e:
        return wrap_error(f"Drill-down failed: {e.message}", code=e.code)
    except Exception as e:  # I1: mirror Java controller `catch (Exception e)`
        logger.error("Drill-down failed", exc_info=True)
        return wrap_error(f"Drill-down failed: {type(e).__name__}", code=500)
