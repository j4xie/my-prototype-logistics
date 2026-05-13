"""Phase 2A: /analysis/department composite real impl.

Mirrors Java SmartBIServiceImpl.getComprehensiveAnalysis "department" case
(line 586-591) + envelope (line 612-613) + 4 DepartmentAnalysisServiceImpl
sub-services. Composite path always taken in prod; ?department=filter is
dead code, ignored.

See spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, Query

logger = logging.getLogger(__name__)

from smartbi_compat.api.analysis_finance import (  # noqa: E402
    _get_period_key,         # post-PR #30 calendar-year fix (Rule 2 compliant)
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,             # safe Decimal coercion
    _utc_now_iso,            # ISO timestamp for generatedAt (volatile, stripped)
)
from smartbi_compat._rbac_role import require_analytics_read  # noqa: E402
from smartbi_compat._rbac_strip import strip_price_for_role  # noqa: E402
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory  # noqa: E402
from smartbi_compat.schema_compat import wrap_response  # noqa: E402

# T1 lock — inline const, NOT alert_thresholds.py 80 (different concept for /alerts)
_DEPARTMENT_TARGET_COMPLETION_RED = Decimal("60")
_DEPARTMENT_TARGET_COMPLETION_YELLOW = Decimal("85")

# SCALE constants matching Java DepartmentAnalysisServiceImpl line 52-54
_SCALE = Decimal("0.0001")    # SCALE=4 中间精度
_DISPLAY_SCALE = Decimal("0.01")      # DISPLAY_SCALE=2 输出
_QUANTIZE_HALF_UP = ROUND_HALF_UP


router = APIRouter()


async def _query_department_full(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java SmartBiDepartmentDataRepository.findByFactoryIdAndRecordDateBetween.

    ⚠️ C2 fix: Java JPA derived query has NO ORDER BY (repo line 33-35) → PG row
    order unstable. Python adds explicit ORDER BY id for byte-shape determinism.

    Rule 5: SELECT * for shared SQL helpers (future-proof for schema additions).
    Caller (`_aggregate_department_data`) MUST IGNORE per_capita_sales /
    per_capita_cost columns (I3 fix: recompute from aggregated values).

    Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_department_full: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )

    pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning("[department] pool acquisition failed factory=%s: %s", factory_id, e)
        return []

    if pool is None:
        logger.warning("[department] pool is None factory=%s; returning empty rows", factory_id)
        return []

    sql = """
        SELECT *
        FROM smart_bi_department_data
        WHERE factory_id = $1
          AND deleted_at IS NULL
          AND record_date BETWEEN $2 AND $3
        ORDER BY id
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)
    return [dict(r) for r in rows]


async def _query_department_daily_trend(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java SmartBiSalesDataRepository.findDepartmentDailyTrend (line 107-112).

    ⚠️ I4 fix: ORDER BY order_date ONLY (NOT order_date, department) — verbatim
    Java semantics. Same-date department iteration order is intentionally
    unspecified per Java behavior. Python NOT 主动加 ORDER BY department
    否则 byte-shape 跟 Java 不一致.

    Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_department_daily_trend: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )

    pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning(
            "[department-trend] pool acquisition failed factory=%s: %s", factory_id, e
        )
        return []

    if pool is None:
        logger.warning(
            "[department-trend] pool is None factory=%s; returning empty rows", factory_id
        )
        return []

    sql = """
        SELECT order_date, department, SUM(amount) AS total_amount
        FROM smart_bi_sales_data
        WHERE factory_id = $1
          AND deleted_at IS NULL
          AND order_date BETWEEN $2 AND $3
        GROUP BY order_date, department
        ORDER BY order_date
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)
    return [dict(r) for r in rows]


def _aggregate_department_data(
    rows: list[dict],
) -> dict[str, dict]:
    """Mirror Java DepartmentAnalysisServiceImpl.aggregateDepartmentData (line 546-567).

    ⚠️ C1 lock — headcount aggregation = MAX across all records in window per
    department, NOT SUM, NOT latest-by-date. Java code comment line 560
    (`人员数取最新记录` "use latest record") is MISLEADING — actual impl
    (line 561-562) is `if (data.getHeadcount() > agg.headcount) agg.headcount = ...`.

    ⚠️ I3 lock — SELECT * pulls precomputed `per_capita_sales` + `per_capita_cost`
    columns. This function MUST IGNORE them. Per-capita is recomputed in
    efficiencyMatrix from aggregated salesAmount / costAmount / headcount.

    ⚠️ Rule 1 lock — All null fields default to `Decimal("0")` via `is None`
    ternary, NOT `or`. Java line 553-558 treats null as ZERO via
    `data.getX() != null ? data.getX() : BigDecimal.ZERO`.
    """
    result: dict[str, dict] = {}    # LinkedHashMap → Python 3.7+ dict insertion-order

    for row in rows:
        dept = row["department"]
        agg = result.setdefault(dept, {
            "salesAmount":  Decimal("0"),
            "salesTarget":  Decimal("0"),
            "costAmount":   Decimal("0"),
            "headcount":    0,
        })

        # Rule 1: explicit is-None ternary
        agg["salesAmount"] += (
            _to_decimal(row["sales_amount"])
            if row.get("sales_amount") is not None
            else Decimal("0")
        )
        agg["salesTarget"] += (
            _to_decimal(row["sales_target"])
            if row.get("sales_target") is not None
            else Decimal("0")
        )
        agg["costAmount"] += (
            _to_decimal(row["cost_amount"])
            if row.get("cost_amount") is not None
            else Decimal("0")
        )

        # C1 — running MAX headcount (NOT sum, NOT latest-by-date)
        hc = row.get("headcount")
        if hc is not None and int(hc) > agg["headcount"]:
            agg["headcount"] = int(hc)

        # I3 — per_capita_sales / per_capita_cost columns IGNORED (recompute later)

    return result


def _calculate_completion_rate(
    actual: Decimal, target: Optional[Decimal]
) -> Decimal:
    """Mirror Java DepartmentAnalysisServiceImpl.calculateCompletionRate (line 610-616).

    Java:
      if (target == null || target.compareTo(BigDecimal.ZERO) == 0) {
          return BigDecimal.ZERO;
      }
      return actual.multiply(BigDecimal.valueOf(100))
                   .divide(target, SCALE, ROUNDING_MODE);

    ⚠️ C4 lock — Python MUST use `target is None or target == Decimal("0")`,
    NOT `if not target:` (Rule 1).

    ⚠️ Arithmetic order — Java `.divide(target, SCALE=4, HALF_UP)` 把**除法结果**
    量化到 4 位 HALF_UP, NOT 把乘法结果先量化。Python MUST mirror:
       ((actual * 100) / target).quantize(SCALE, HALF_UP)
    NOT
       (actual * 100).quantize(SCALE, HALF_UP) / target    ← BUG 顺序反了
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    # ✅ Mirror Java: 除法结果量化, NOT 乘法结果
    return ((actual * Decimal("100")) / target).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP
    )


def _determine_target_completion_alert(value: Decimal) -> str:
    """Mirror Java MetricCalculatorServiceImpl.determineAlertLevel(TARGET_COMPLETION)
    (line 458-461):

      double v = value.doubleValue();
      if (v < 60) return RED;
      if (v < 85) return YELLOW;
      return GREEN;

    ⚠️ T1 lock — 60/85 Java HARDCODED, NOT from alert_thresholds.json (which has
    `department.target_completion.yellow=80` — 不同概念, 给 /alerts endpoint 用的).
    Inline const 防 sister bug.

    ⚠️ Rule 7 lock — 阈值 60 / 85 是 INTEGER → `float(value)` 比较跟 Java
    `value.doubleValue()` 一致 (Rule 7 explicitly notes integer thresholds OK).
    """
    v = float(value)
    if v < float(_DEPARTMENT_TARGET_COMPLETION_RED):
        return "RED"
    if v < float(_DEPARTMENT_TARGET_COMPLETION_YELLOW):
        return "YELLOW"
    return "GREEN"


def _determine_quadrant(
    per_capita_sales: Decimal,
    per_capita_cost: Decimal,
    aggregated_data: dict[str, dict],
) -> str:
    """Mirror Java DepartmentAnalysisServiceImpl.determineQuadrant (line 621-653).

    ⚠️ C3 LOCK — DO NOT optimize by lifting avg computation OUT of the per-point
    loop. Java line 225-249 invokes this PER POINT, and this function re-iterates
    `aggregated_data` to compute averages AT EACH CALL. The SCALE=4 intermediate
    divide+sum+divide is a 3-stage rounded operation; computing avg once outside
    and inlining would change byte-shape due to rounding accumulation differences.

    Algorithm:
      avg_sales = sum(salesAmount.divide(headcount, SCALE=4, HALF_UP)
                      for each dept where headcount > 0) / count
      avg_cost  = sum(costAmount.divide(headcount, SCALE=4, HALF_UP)
                      for each dept where headcount > 0) / count
      Q1 = high output, high cost  (优化效率)
      Q2 = low output,  low cost   (表现平庸)
      Q3 = low output,  high cost  (重点关注)
      Q4 = high output, low cost   (明星部门)
    """
    avg_sales = Decimal("0")
    avg_cost = Decimal("0")
    count = 0

    # iteration over aggregated_data.values() — LinkedHashMap insertion order
    for agg in aggregated_data.values():
        if agg["headcount"] > 0:
            avg_sales += (agg["salesAmount"] / Decimal(agg["headcount"])).quantize(
                _SCALE, rounding=_QUANTIZE_HALF_UP
            )
            avg_cost += (agg["costAmount"] / Decimal(agg["headcount"])).quantize(
                _SCALE, rounding=_QUANTIZE_HALF_UP
            )
            count += 1

    if count > 0:
        avg_sales = (avg_sales / Decimal(count)).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )
        avg_cost = (avg_cost / Decimal(count)).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )

    high_output = per_capita_sales >= avg_sales
    high_cost = per_capita_cost >= avg_cost

    # Java labels mirror exactly (Java line 644-652)
    if high_output and high_cost:
        return "Q1_HIGH_OUTPUT_HIGH_COST"
    if high_output and not high_cost:
        return "Q4_HIGH_OUTPUT_LOW_COST"
    if not high_output and high_cost:
        return "Q3_LOW_OUTPUT_HIGH_COST"
    return "Q2_LOW_OUTPUT_LOW_COST"


def _create_empty_chart(chart_type: str, title: str) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl create{Scatter,Pie,Line,Area}EmptyChart
    factories (line 801-823).

    ⚠️ I5 fix — Java ChartConfig DTO has NO @JsonInclude annotation (verified
    ChartConfig.java:32) → Spring Boot Jackson default emits ALL fields including
    null.

    ⚠️ Spec §3.8 was WRONG about ChartConfig shape — F999 golden reveals actual
    Java emit order (Lombok @Data + Jackson bean introspection):
      [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    AND `xaxisField` / `yaxisField` are LOWERCASE-A (Jackson PropertyNamingStrategy
    drops the camelCase between adjacent uppercase letters — `xAxisField` field
    becomes `xaxisField` JSON key). This is a Java-side quirk that byte-shape
    parity must mirror.
    """
    return {
        "chartType":   chart_type,
        "title":       title,
        "seriesField": None,
        "data":        [],
        "options":     None,
        "xaxisField":  None,
        "yaxisField":  None,
    }


def _build_date_range(start_date: date, end_date: date) -> dict:
    """Mirror Java DateRange.custom (DateRange.java:266-274) + inferGranularity
    (line 308-321). Fully deterministic.

    Inferred granularity:
      days <= 1   → DAY
      days <= 7   → WEEK
      days <= 31  → MONTH
      days <= 93  → QUARTER
      else        → YEAR

    DateRange JSON field order per F999 golden (Lombok @Data getter introspection):
      [startDate, endDate, granularity, originalExpression, relative, days, valid]

    ⚠️ Spec §3.9 missed `days` and `valid` fields — F999 golden reveals Java emits
    them via `getDays()` and `isValid()` getters (Lombok @Data + Jackson bean
    introspection). `days = duration days inclusive`, `valid = startDate <= endDate`.
    """
    days = (end_date - start_date).days + 1
    if days <= 1:
        granularity = "DAY"
    elif days <= 7:
        granularity = "WEEK"
    elif days <= 31:
        granularity = "MONTH"
    elif days <= 93:
        granularity = "QUARTER"
    else:
        granularity = "YEAR"
    return {
        "startDate":          start_date.isoformat(),
        "endDate":            end_date.isoformat(),
        "granularity":        granularity,
        "originalExpression": f"{start_date} 至 {end_date}",
        "relative":           False,
        "days":               days,
        "valid":              start_date <= end_date,
    }


async def _get_department_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentRanking (line 64-108).

    Empty rows → return []. Sort by salesAmount desc, build RankingItem entries.

    RankingItem put-order (Java @Builder, RankingItem.java:22-53 declaration order):
      [rank, name, value, target, completionRate, alertLevel]
    """
    rows = await _query_department_full(factory_id, start_date, end_date)
    if not rows:
        return []

    aggregated = _aggregate_department_data(rows)

    sorted_entries = sorted(
        aggregated.items(),
        key=lambda kv: kv[1]["salesAmount"],
        reverse=True,
    )

    rankings = []
    for rank, (dept, agg) in enumerate(sorted_entries, start=1):
        cr = _calculate_completion_rate(agg["salesAmount"], agg["salesTarget"])
        rankings.append({
            "rank":           rank,
            "name":           dept,
            "value":          _decimal_to_number(
                agg["salesAmount"].quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         _decimal_to_number(
                agg["salesTarget"].quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "completionRate": _decimal_to_number(
                cr.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "alertLevel":     _determine_target_completion_alert(cr),
        })
    return rankings


async def _get_department_completion_rates(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentCompletionRates (line 161-201).

    Empty rows → []. Sort by completionRate desc.

    MetricResult put-order (Java line 183-192):
      [metricCode, metricName, value, formattedValue, unit, dimensionValue, alertLevel]

    formattedValue: Java DecimalFormat("#,##0.00") + "%" → Python f"{value:,.2f}%".
    """
    rows = await _query_department_full(factory_id, start_date, end_date)
    if not rows:
        return []

    aggregated = _aggregate_department_data(rows)

    results = []
    for dept, agg in aggregated.items():
        cr = _calculate_completion_rate(agg["salesAmount"], agg["salesTarget"])
        cr_display = cr.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
        # Rule 9: MetricResult Lombok @Data + no @JsonInclude → emit all 11 fields
        # incl null. Jackson key order from F001 golden:
        # [metricCode, metricName, value, formattedValue, unit,
        #  changePercent, changeDirection, changeValue, alertLevel,
        #  dimensionValue, description]
        results.append({
            "metricCode":      "TARGET_COMPLETION",
            "metricName":      "目标完成率",
            "value":           _decimal_to_number(cr_display),
            "formattedValue":  f"{cr_display:,.2f}%",   # 千分位 + 2 位小数 + %
            "unit":            "%",
            "changePercent":   None,
            "changeDirection": None,
            "changeValue":     None,
            "alertLevel":      _determine_target_completion_alert(cr),
            "dimensionValue":  dept,
            "description":     None,
        })

    # Java line 198: results.sort(by value desc)
    results.sort(key=lambda r: r["value"], reverse=True)
    return results


async def _get_department_efficiency_matrix(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentEfficiencyMatrix (line 206-283).

    Empty rows → _create_empty_chart("SCATTER", "部门效率矩阵").

    Per-point loop with C3 quadrant recompute (DO NOT lift avg out).

    options.quadrantLines = Map.of(2): {xAxis, yAxis}             ⚠️ I1 SALT flip risk
    options.quadrantLabels = Map.of(4): {q1, q2, q3, q4}          ⚠️ I1 SALT flip risk

    Python emits canonical insertion order matching first-record golden;
    PR-B detects via Java backend restart cycle (F999 empty doesn't trigger).
    """
    rows = await _query_department_full(factory_id, start_date, end_date)
    if not rows:
        return _create_empty_chart("SCATTER", "部门效率矩阵")

    aggregated = _aggregate_department_data(rows)

    chart_data = []
    total_per_capita_sales = Decimal("0")
    total_per_capita_cost = Decimal("0")
    department_count = 0

    for dept, agg in aggregated.items():
        if agg["headcount"] > 0:
            per_capita_sales = (agg["salesAmount"] / Decimal(agg["headcount"])).quantize(
                _SCALE, rounding=_QUANTIZE_HALF_UP
            )
            per_capita_cost = (agg["costAmount"] / Decimal(agg["headcount"])).quantize(
                _SCALE, rounding=_QUANTIZE_HALF_UP
            )
        else:
            per_capita_sales = Decimal("0")
            per_capita_cost = Decimal("0")

        # Java point LinkedHashMap put-order line 236-242
        point = {
            "department":     dept,
            "perCapitaSales": _decimal_to_number(
                per_capita_sales.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "perCapitaCost":  _decimal_to_number(
                per_capita_cost.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "salesAmount":    _decimal_to_number(
                agg["salesAmount"].quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "headcount":      agg["headcount"],
            "quadrant":       _determine_quadrant(
                per_capita_sales, per_capita_cost, aggregated
            ),
        }
        chart_data.append(point)

        total_per_capita_sales += per_capita_sales
        total_per_capita_cost += per_capita_cost
        department_count += 1

    if department_count > 0:
        avg_per_capita_sales = (
            total_per_capita_sales / Decimal(department_count)
        ).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
        avg_per_capita_cost = (
            total_per_capita_cost / Decimal(department_count)
        ).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
    else:
        avg_per_capita_sales = Decimal("0")
        avg_per_capita_cost = Decimal("0")

    options = {
        "quadrantLines": {
            "xAxis": _decimal_to_number(
                avg_per_capita_sales.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "yAxis": _decimal_to_number(
                avg_per_capita_cost.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        },
        "quadrantLabels": {
            "q1": "高投入高产出 - 需优化效率",
            "q2": "低投入低产出 - 表现平庸",
            "q3": "高投入低产出 - 需重点关注",
            "q4": "低投入高产出 - 明星部门",
        },
        "bubbleSizeField": "salesAmount",
        "colorField":      "department",
    }

    # ChartConfig field order per F999 golden (Jackson actual):
    # [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    # `xaxisField`/`yaxisField` are LOWERCASE-A (Jackson bean introspection quirk).
    return {
        "chartType":   "SCATTER",
        "title":       "部门效率矩阵",
        "seriesField": "department",
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "perCapitaSales",
        "yaxisField":  "perCapitaCost",
    }


async def _get_department_trend_comparison(
    factory_id: str, start_date: date, end_date: date, period: str = "WEEK"
) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentTrendComparison (line 354-416).

    Empty trend → _create_empty_chart("LINE", "部门销售趋势对比").

    Period defaults to "WEEK" per composite path (SmartBIServiceImpl:590).

    Rule 2 — period key uses _get_period_key from analysis_finance.py
    (post-PR #30 calendar-year fix).
    """
    rows = await _query_department_daily_trend(factory_id, start_date, end_date)
    if not rows:
        return _create_empty_chart("LINE", "部门销售趋势对比")

    # Step 2: trendData = {period_key: {dept: amount}}
    trend_data: dict[str, dict[str, Decimal]] = {}
    for row in rows:
        date_val = row["order_date"]
        dept = (
            str(row["department"])
            if row.get("department") is not None
            else "未知部门"     # Java line 372 fallback
        )
        amount = (
            _to_decimal(row["total_amount"])
            if row.get("total_amount") is not None
            else Decimal("0")
        )
        period_key = _get_period_key(date_val, period)
        period_dict = trend_data.setdefault(period_key, {})
        if dept in period_dict:
            period_dict[dept] += amount
        else:
            period_dict[dept] = amount

    # Step 3: allPeriods (TreeSet → sorted), allDepartments (LinkedHashSet → insertion order)
    all_periods = sorted(trend_data.keys())
    all_departments: list[str] = []
    seen = set()
    for period_key in trend_data:
        for dept in trend_data[period_key]:
            if dept not in seen:
                seen.add(dept)
                all_departments.append(dept)

    # Step 4: chartData per-period
    chart_data = []
    for period_key in all_periods:
        point = {"period": period_key}
        period_dict = trend_data.get(period_key, {})
        for dept in all_departments:
            amount = period_dict.get(dept, Decimal("0"))
            point[dept] = _decimal_to_number(
                amount.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            )
        chart_data.append(point)

    options = {
        "series": list(all_departments),
        "period": period,
    }

    # ChartConfig field order per F999 golden (Jackson actual):
    # [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    return {
        "chartType":   "LINE",
        "title":       "部门销售趋势对比",
        "seriesField": "department",
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "period",
        "yaxisField":  "amount",
    }


async def _get_department_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java SmartBIServiceImpl.getComprehensiveAnalysis "department" case
    (line 586-591) + envelope (line 612-613).

    ⚠️ Top-level `data.*` key order placeholder — actual Jackson HashMap hash-iter
    order is TBD until F999 golden recorded (Task 15). PR-A first task post-impl
    is to record golden + adjust this dict literal order if needed.

    Java put-order: [ranking, completionRates, efficiencyMatrix, trendComparison,
                     dateRange, generatedAt]
    Java HashMap hash-iter order may differ; sister specs (cost / profit / payable
    / receivable) empirically stable across JVM restarts.
    """
    ranking = await _get_department_ranking(factory_id, start_date, end_date)
    completion_rates = await _get_department_completion_rates(factory_id, start_date, end_date)
    efficiency_matrix = await _get_department_efficiency_matrix(factory_id, start_date, end_date)
    trend_comparison = await _get_department_trend_comparison(factory_id, start_date, end_date, "WEEK")

    # Top-level data key order per F999 golden (Jackson HashMap hash-iter order):
    # [completionRates, efficiencyMatrix, dateRange, generatedAt, ranking, trendComparison]
    # NOT Java put-order — Jackson actual emit order from HashMap.
    return {
        "completionRates":  completion_rates,
        "efficiencyMatrix": efficiency_matrix,
        "dateRange":        _build_date_range(start_date, end_date),
        "generatedAt":      _utc_now_iso(),    # volatile, stripped by _strip_volatile in tests
        "ranking":          ranking,
        "trendComparison":  trend_comparison,
    }


@router.get(
    "/api/mobile/{factory_id}/smart-bi/analysis/department"
)
async def get_department_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    department: Optional[str] = Query(None),    # accepted but IGNORED — mirror Java prod
    auth: AuthContext = Depends(require_analytics_read),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getDepartmentAnalysis (line 142-177).

    ⚠️ `department` query param accepted but IGNORED — mirror Java prod behavior:
    Controller's `if (smartBIService != null)` (line 153) ALWAYS true in prod
    (SmartBIServiceImpl is unconditional @Service). Composite path bypasses
    Controller's filter branch (line 162-170) entirely. Detail mode is dead
    code in prod.
    """
    result = await _get_department_analysis(factory_id, startDate, endDate)
    return wrap_response(strip_price_for_role(result, auth.role))
