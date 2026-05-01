# Phase 2A `/analysis/finance` 3 sub-endpoints port — Design Spec

**Date**: 2026-04-30
**Branch**: `phase2a/finance-sub-endpoints`
**Worktree**: `.worktrees/phase2a-finance-sub-endpoints`
**Predecessors**:
- PR #21 — profit per-type PR-A merged (`bfe77566c`)
- PR #22 — profit per-type PR-B merged (`8602e8374`)
- PR #23 — finance hotfix (`get_pg_pool` → `get_cretas_pool`) merged (`fd90a61d7`)
- PR #25 — cost per-type real impl merged (`d6b48738a`)

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main `fb92f4b01`）

`/api/mobile/{factory}/smart-bi/analysis/finance` 主端点功能完整 (composite + payable + profit + cost real impl).

3 个 finance sub-endpoint **完全未 port** — 仍走 Java 10010:
- `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement?year=N&metric=X`
- `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom?periodType=X&startPeriod=Y&endPeriod=Z&metric=W`
- `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison?year=N&compareYear=M`

每个返回 `ApiResponse<ChartConfig>` (单 ChartConfig wrapped).

### 1.2 这一 chat 范围

实施 **3 个 sub-endpoint Python real impl + F999 byte gate + 算术深度单元测试**, 单 PR ship.

### 1.3 显式不在范围

- 其他 analysis endpoint (department / region / production / quality / inventory / procurement) — 各自独立 chat
- T6 nginx cutover — Phase 2A 后期统一切流量
- byte gate 升级到 strict-byte (沿用 dict-eq, spec §6 backlog)
- F001 真窗 contract test (用 post-deploy smoke 替代)
- AI insights / Tool-Skill / 食品知识库 (永久留 Java)

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
backend/python/smartbi_compat/api/analysis_finance.py            [EDIT]
  + _get_budget_amount_by_metric(record, metric)         NEW (helper)
  + _get_actual_amount_by_metric(record, metric)         NEW (helper)
  + _determine_budget_achievement_alert(rate)            NEW (helper)
  + _get_metric_display_name(metric)                     NEW (helper)
  + _get_budget_achievement_chart()                      NEW (impl)
  + _calculate_metric_from_sales(sales_rows, metric)     NEW (helper, audit C-1 fix)
  + _get_metric_value_for_period(factory, year_month, metric)  NEW (helper)
  + _get_metric_value_for_quarter(factory, year, quarter, metric)  NEW (helper)
  + _safe_growth_rate(current, base)                     NEW (helper, audit I-1 fix)
  + _calculate_month_yoy_mom(factory, period, metric)    NEW (sub-impl)
  + _calculate_quarter_yoy_mom(factory, period, metric)  NEW (sub-impl)
  + _calculate_month_range_yoy_mom(factory, start, end, metric)  NEW (sub-impl)
  + _calculate_quarter_range_yoy_mom(factory, start, end, metric)  NEW (sub-impl)
  + _get_yoy_mom_chart()                                 NEW (impl, dispatches to 4 sub-impl)
  + _aggregate_sales_by_category(sales_rows)             NEW (helper)
  + _get_category_comparison_chart()                     NEW (impl)
  + 3 new route handlers:
      GET /api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement
      GET /api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom
      GET /api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison

tests/python/smartbi_compat/test_analysis_finance_contract.py    [EDIT]
  + class TestBudgetAchievementChart      (2 byte gate tests + 4 arithmetic tests)
  + class TestYoYMoMComparisonChart       (2 byte gate tests + 4 arithmetic tests, covering 4 periodType)
  + class TestCategoryComparisonChart     (2 byte gate tests + 3 arithmetic tests)

tests/fixtures/java-smartbi-golden/ [NEW]
  + analysis-finance-F999-budget-achievement.json
  + analysis-finance-F001-budget-achievement.json
  + analysis-finance-F999-yoy-mom.json
  + analysis-finance-F001-yoy-mom.json
  + analysis-finance-F999-category-comparison.json
  + analysis-finance-F001-category-comparison.json
```

### 2.2 关键架构决策

1. **复用 `_query_finance_data`** (PR-A + hotfix → cretas_pool): budget-achievement 用 `BUDGET`; yoy-mom 用 `REVENUE` + `COST` 等 record types.
2. **复用 `_query_finance_sales_fallback`** (PR-B + hotfix): category-comparison 跨年查询销售数据, 传 `(year, 1, 1)` ~ `(year, 12, 31)` 作为 date range.
3. **复用既有 chart factory**: `_new_chart_config_dict` / `_new_yaxis_entry` / `_new_series_entry`.
4. **共享 helper `_get_metric_display_name`**: budget-achievement 与 yoy-mom 都用. 抽到 module level (Section 2 helpers).
5. **不在 composite 路径调用**: 3 个 sub-endpoint 独立路由, 不影响 composite 字节形状.
6. **`_calculate_*_yoy_mom` 4 个独立函数** (而非 single dispatcher): Java 用 switch 4-case, Python mirror — 简单 dispatcher (单 if-elif), 4 子函数各自隔离.
7. **Imports** (audit I-2 fix): `date` from datetime + `Optional` from typing 已在 module level; `import calendar` 需要在 module top 加 (现 inline in `_infer_granularity` line 61). Plan 一并清理.

---

## 3. Java 引用 + 算法对照

### 3.1 Java reference 位置

| 函数 | 位置 |
|---|---|
| Controller `getBudgetAchievementChart` | `SmartBIAnalysisController.java:276-292` |
| Controller `getYoYMoMComparisonChart` | `SmartBIAnalysisController.java:294-312` |
| Controller `getCategoryStructureComparisonChart` | `SmartBIAnalysisController.java:314-330` |
| Service `getBudgetAchievementChart` | `FinanceAnalysisServiceImpl.java:1121-1195` |
| Service `getYoYMoMComparisonChart` | `FinanceAnalysisServiceImpl.java:1200-1254` |
| Service `getCategoryStructureComparisonChart` | `FinanceAnalysisServiceImpl.java:1259-1365` |
| Helper `getBudgetAmountByMetric` | `FinanceAnalysisServiceImpl.java:1716-1749` |
| Helper `getActualAmountByMetric` | `FinanceAnalysisServiceImpl.java:1754-1786` |
| Helper `determineBudgetAchievementAlertLevel` | `FinanceAnalysisServiceImpl.java:1794-1799` |
| Helper `getMetricDisplayName` | `FinanceAnalysisServiceImpl.java:1804-1820` |
| Helper `calculateMonthYoYMoM` | `FinanceAnalysisServiceImpl.java:1825-1864` |
| Helper `calculateQuarterYoYMoM` | `FinanceAnalysisServiceImpl.java:1869-1923` |
| Helper `calculateMonthRangeYoYMoM` | `FinanceAnalysisServiceImpl.java:1925-1947` |
| Helper `calculateQuarterRangeYoYMoM` | `FinanceAnalysisServiceImpl.java:1949-1968` |
| Helper `getMetricValueForPeriod` | `FinanceAnalysisServiceImpl.java:1970-2000` |
| Helper `getMetricValueForQuarter` | `FinanceAnalysisServiceImpl.java:2005-2035` |
| Helper `calculateMetricFromSales` | `FinanceAnalysisServiceImpl.java:2040-2065` |
| Helper `aggregateSalesByCategory` | `FinanceAnalysisServiceImpl.java:2070-2087` |
| Constants `SCALE / DISPLAY_SCALE / ROUNDING_MODE` | `FinanceAnalysisServiceImpl.java:81-83` |

### 3.2 `_get_budget_achievement_chart` 算法 (1:1 mirror)

```python
async def _get_budget_achievement_chart(
    factory_id: str, year: int, metric: str = "revenue"
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetAchievementChart line 1121-1195.

    Uses _query_finance_data with RecordType=BUDGET for [year-01-01, year-12-31].
    Aggregates by month (1-12), each month emits {month, budget, actual,
    achievementRate, variance, alertLevel}. Always emits 12 month entries
    (even when 0 data — Java line 1132-1135 pre-fills monthlyData with zeros).
    """
    from datetime import date as date_

    start_date = date_(year, 1, 1)
    end_date = date_(year, 12, 31)

    budget_data = await _query_finance_data(
        factory_id, "BUDGET", start_date, end_date
    )

    # Java line 1131-1135: TreeMap of 12 months pre-filled with [0, 0]
    monthly_data: dict[int, list[Decimal]] = {
        m: [Decimal("0"), Decimal("0")] for m in range(1, 13)
    }

    for record in budget_data:
        if record.get("record_date") is None:
            continue
        month = record["record_date"].month
        budget_amt = _get_budget_amount_by_metric(record, metric)
        actual_amt = _get_actual_amount_by_metric(record, metric)
        monthly_data[month][0] += budget_amt
        monthly_data[month][1] += actual_amt

    chart_data: list[dict] = []
    for month in range(1, 13):
        budget = monthly_data[month][0]
        actual = monthly_data[month][1]
        if budget > Decimal("0"):
            achievement_rate = (
                actual / budget * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            achievement_rate = Decimal("0")
        variance = actual - budget
        alert_level = _determine_budget_achievement_alert(achievement_rate)

        chart_data.append({
            "month": f"{month}月",
            "budget": _decimal_to_number(budget.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "actual": _decimal_to_number(actual.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "achievementRate": _decimal_to_number(achievement_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "variance": _decimal_to_number(variance.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "alertLevel": alert_level,
        })

    metric_name = _get_metric_display_name(metric)

    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            # Java line 1175 has extra min/max keys — Map.of(4): hash order
            # ["min", "name", "max", "position"] OR ["name", "position", "min", "max"]?
            # Map.of(4) typical hash order verified by golden recording (D.1 step 2).
            # Spec defaults to ["name", "position", "min", "max"] but golden is ground truth.
            {"name": "达成率(%)", "position": "right", "min": 0, "max": 150},
        ],
        "series": [
            # Map.of(4): {name, type, yAxisIndex, color} — hash order TBD by golden.
            # Empirical from PR-A: Map.of(3) = [type, yAxisIndex, name].
            # For Map.of(4) need golden verification. Spec defaults to
            # ["color", "name", "type", "yAxisIndex"] (typical Java-internal hash order).
            {"color": "#5470c6", "name": "预算", "type": "bar", "yAxisIndex": 0},
            {"color": "#91cc75", "name": "实际", "type": "bar", "yAxisIndex": 0},
            {"color": "#ee6666", "name": "达成率", "type": "line", "yAxisIndex": 1},
        ],
        # Java line 1182: Map.of("value", 100, "label", "目标线") — 2 entries put-order
        "referenceLine": {"value": 100, "label": "目标线"},
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title=f"{year}年{metric_name}预算达成分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="month",
        yaxis_field="budget",
    )


def _get_budget_amount_by_metric(record: dict, metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetAmountByMetric (line 1716-1749).

    **Java fall-through behavior** (audit I-4 fix): the switch's `case "revenue":` etc
    have an inner `if (category contains keyword) return budget_amount; break;`.
    When the inner `if` is false, the `break` exits the switch, then control flows
    to line 1748 which returns `data.getBudgetAmount()`. So the function ALWAYS
    returns budget_amount regardless of category match — the keyword filter is
    effectively dead code in Java.

    The `metric` parameter is accepted but unused (kept in signature for Java
    parity and future use). This matches Java behavior literally.
    """
    if record.get("budget_amount") is None:
        return Decimal("0")
    return _to_decimal(record["budget_amount"])


def _get_actual_amount_by_metric(record: dict, metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getActualAmountByMetric (line 1754-1786).

    Same fall-through behavior as _get_budget_amount_by_metric — always returns
    actual_amount regardless of category match. The Java keyword filter is dead code.
    """
    if record.get("actual_amount") is None:
        return Decimal("0")
    return _to_decimal(record["actual_amount"])


def _determine_budget_achievement_alert(achievement_rate: Decimal) -> str:
    """Mirror Java line 1794-1799.
      v > 120 → RED
      v > 100 → YELLOW
      v <= 100 → GREEN
    """
    v = float(achievement_rate)
    if v > 120:
        return "RED"
    if v > 100:
        return "YELLOW"
    return "GREEN"


def _get_metric_display_name(metric: str) -> str:
    """Mirror Java line 1804-1820."""
    if metric is None:
        return "综合"
    m = metric.lower()
    return {
        "revenue": "收入",
        "cost": "成本",
        "expense": "费用",
        "profit": "利润",
        "gross_margin": "毛利率",
    }.get(m, "综合")
```

### 3.3 `_get_yoy_mom_chart` 算法

```python
async def _get_yoy_mom_chart(
    factory_id: str,
    period_type: str,
    start_period: str,
    end_period: Optional[str],
    metric: str = "revenue",
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getYoYMoMComparisonChart line 1200-1254.

    Dispatches to 4 sub-impl based on period_type:
      MONTH         → _calculate_month_yoy_mom (single point)
      QUARTER       → _calculate_quarter_yoy_mom (single point)
      MONTH_RANGE   → _calculate_month_range_yoy_mom (multiple points)
      QUARTER_RANGE → _calculate_quarter_range_yoy_mom (multiple points)
      default       → _calculate_month_yoy_mom (matches Java line 1226)
    """
    if period_type == "MONTH":
        chart_data = await _calculate_month_yoy_mom(factory_id, start_period, metric)
    elif period_type == "QUARTER":
        chart_data = await _calculate_quarter_yoy_mom(factory_id, start_period, metric)
    elif period_type == "MONTH_RANGE":
        chart_data = await _calculate_month_range_yoy_mom(factory_id, start_period, end_period, metric)
    elif period_type == "QUARTER_RANGE":
        chart_data = await _calculate_quarter_range_yoy_mom(factory_id, start_period, end_period, metric)
    else:
        # Java line 1224-1226 default fallback
        logger.warning("Unknown periodType=%s, using MONTH default", period_type)
        chart_data = await _calculate_month_yoy_mom(factory_id, start_period, metric)

    metric_name = _get_metric_display_name(metric)

    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="增长率(%)", position="right"),
        ],
        "series": [
            # Map.of(4) hash order — golden verifies
            {"color": "#5470c6", "name": "本期", "type": "bar", "yAxisIndex": 0},
            {"color": "#91cc75", "name": "同期", "type": "bar", "yAxisIndex": 0},
            {"color": "#ee6666", "name": "同比增长率", "type": "line", "yAxisIndex": 1},
            {"color": "#fac858", "name": "环比增长率", "type": "line", "yAxisIndex": 1},
        ],
        "tooltip": {"trigger": "axis"},
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title=f"{metric_name}同比环比分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="currentValue",
    )


async def _calculate_month_yoy_mom(factory_id: str, period: str, metric: str) -> list[dict]:
    """Mirror Java line 1825-1864.

    period format: 'YYYY-MM' (e.g. '2026-01')
    Returns single chart point with currentValue / lastYearValue / lastPeriodValue
    + yoyGrowthRate / momGrowthRate / yoyChange / momChange.
    """
    from datetime import date as date_
    year, month = map(int, period.split("-"))
    current_ym = (year, month)
    last_year_ym = (year - 1, month)
    last_month_y, last_month_m = (year, month - 1) if month > 1 else (year - 1, 12)
    last_period_ym = (last_month_y, last_month_m)

    current_value = await _get_metric_value_for_period(factory_id, current_ym, metric)
    last_year_value = await _get_metric_value_for_period(factory_id, last_year_ym, metric)
    last_period_value = await _get_metric_value_for_period(factory_id, last_period_ym, metric)

    yoy_growth_rate = _safe_growth_rate(current_value, last_year_value)
    mom_growth_rate = _safe_growth_rate(current_value, last_period_value)

    return [{
        "period": period,
        "currentValue": _decimal_to_number(current_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastYearValue": _decimal_to_number(last_year_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastPeriodValue": _decimal_to_number(last_period_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momGrowthRate": _decimal_to_number(mom_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyChange": _decimal_to_number((current_value - last_year_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momChange": _decimal_to_number((current_value - last_period_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
    }]


def _safe_growth_rate(current: Decimal, base: Decimal) -> Decimal:
    """Java line 1839-1850: (current - base) / base * 100, with 0 fallback when base <= 0."""
    if base > Decimal("0"):
        return ((current - base) / base * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    return Decimal("0")


async def _get_metric_value_for_period(
    factory_id: str, year_month: tuple[int, int], metric: str
) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricValueForPeriod (line 1970-2000).

    **CRITICAL** (audit C-1 fix): Java has 3 distinct branches by data source:
      - revenue / profit / gross_margin → smart_bi_sales_data via _query_finance_sales_fallback
      - cost / expense                  → smart_bi_finance_data RecordType.COST, sum total_cost
      - default                         → smart_bi_sales_data, sum amount

    Initial spec wrongly conflated all metrics into _query_finance_data with REVENUE/COST.
    """
    import calendar
    year, month = year_month
    last_day = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    metric_lower = (metric or "").lower()

    if metric_lower in ("revenue", "profit", "gross_margin"):
        sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
        return _calculate_metric_from_sales(sales_rows, metric_lower)

    if metric_lower in ("cost", "expense"):
        cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)
        # Java line 1987-1990: sum total_cost (NOT actual_amount), filter null
        return sum(
            (
                _to_decimal(r["total_cost"])
                for r in cost_records
                if r.get("total_cost") is not None
            ),
            Decimal("0"),
        )

    # Default: sum amount from sales (Java line 1991-1998)
    sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
    return sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )


def _calculate_metric_from_sales(sales_rows: list[dict], metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.calculateMetricFromSales (line 2040-2065).

    Pre-aggregates total_revenue + total_cost from sales_rows, then dispatches by metric:
      revenue       → total_revenue
      profit        → total_revenue - total_cost
      gross_margin  → (revenue - cost) / revenue * 100, scale=4 (or 0 if revenue=0)
      default       → total_revenue
    """
    metric_lower = (metric or "").lower()

    total_revenue = sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )
    # Java line 2046-2049: NO .abs() here (unlike profit metrics which apply abs)
    total_cost = sum(
        (
            _to_decimal(r["cost"])
            for r in sales_rows
            if r.get("cost") is not None
        ),
        Decimal("0"),
    )

    if metric_lower == "revenue":
        return total_revenue
    if metric_lower == "profit":
        return total_revenue - total_cost
    if metric_lower == "gross_margin":
        if total_revenue > Decimal("0"):
            return (
                (total_revenue - total_cost) / total_revenue * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return Decimal("0")
    # default
    return total_revenue
```

`_get_metric_value_for_quarter` follows identical 3-branch structure with quarter date math (Java line 2005-2035) — see plan for full detail.

Quarter / range yoy-mom variants (`_calculate_quarter_yoy_mom`, `_calculate_month_range_yoy_mom`, `_calculate_quarter_range_yoy_mom`) follow identical pattern to `_calculate_month_yoy_mom` with quarter / multi-period iteration (Java line 1869-1968) — see plan for full detail.

### 3.4 `_get_category_comparison_chart` 算法

```python
async def _get_category_comparison_chart(
    factory_id: str, year: int, compare_year: int
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getCategoryStructureComparisonChart line 1259-1365.

    Queries smart_bi_sales_data for both years via _query_finance_sales_fallback.
    Aggregates by product_category, computes ratio/yoy growth, sorts by currentAmount desc.
    """
    from datetime import date as date_

    current_sales = await _query_finance_sales_fallback(
        factory_id, date_(year, 1, 1), date_(year, 12, 31)
    )
    compare_sales = await _query_finance_sales_fallback(
        factory_id, date_(compare_year, 1, 1), date_(compare_year, 12, 31)
    )

    current_category_amount = _aggregate_sales_by_category(current_sales)
    compare_category_amount = _aggregate_sales_by_category(compare_sales)

    current_total = sum(current_category_amount.values(), Decimal("0"))
    compare_total = sum(compare_category_amount.values(), Decimal("0"))

    # Java LinkedHashSet preserves first-encounter order (current then compare additions)
    all_categories: list[str] = []
    seen: set[str] = set()
    for cat in list(current_category_amount.keys()) + list(compare_category_amount.keys()):
        if cat not in seen:
            seen.add(cat)
            all_categories.append(cat)

    chart_data: list[dict] = []
    for category in all_categories:
        current_amount = current_category_amount.get(category, Decimal("0"))
        compare_amount = compare_category_amount.get(category, Decimal("0"))

        current_ratio = (current_amount / current_total * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        ) if current_total > Decimal("0") else Decimal("0")
        compare_ratio = (compare_amount / compare_total * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        ) if compare_total > Decimal("0") else Decimal("0")

        # Java line 1304-1308: yoy growth rate with fallback to 100 (new category)
        if compare_amount > Decimal("0"):
            yoy_growth_rate = ((current_amount - compare_amount) / compare_amount * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
        elif current_amount > Decimal("0"):
            yoy_growth_rate = Decimal("100")
        else:
            yoy_growth_rate = Decimal("0")

        ratio_change = current_ratio - compare_ratio

        chart_data.append({
            "category": category,
            "currentAmount": _decimal_to_number(current_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "compareAmount": _decimal_to_number(compare_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "currentRatio": _decimal_to_number(current_ratio.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "compareRatio": _decimal_to_number(compare_ratio.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "ratioChange": _decimal_to_number(ratio_change.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "currentYear": year,
            "compareYear": compare_year,
        })

    # Java line 1327-1331: sort by currentAmount DESC
    chart_data.sort(key=lambda x: x["currentAmount"], reverse=True)

    if compare_total > Decimal("0"):
        total_yoy_growth_rate = ((current_total - compare_total) / compare_total * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    else:
        total_yoy_growth_rate = Decimal("0")

    options = {
        "groupedBar": True,
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="同比增长率(%)", position="right"),
        ],
        "series": [
            # Map.of(4) hash order — golden verifies
            {"color": "#5470c6", "name": f"{year}年", "type": "bar", "yAxisIndex": 0},
            {"color": "#91cc75", "name": f"{compare_year}年", "type": "bar", "yAxisIndex": 0},
            {"color": "#ee6666", "name": "同比增长率", "type": "line", "yAxisIndex": 1},
        ],
        "summary": {
            "currentTotal": _decimal_to_number(current_total.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "compareTotal": _decimal_to_number(compare_total.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "totalYoyGrowthRate": _decimal_to_number(total_yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        },
    }

    return _new_chart_config_dict(
        chart_type="BAR",
        title=f"{year}年 vs {compare_year}年 品类结构对比",
        series_field="year",
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="currentAmount",
    )


def _aggregate_sales_by_category(sales_rows: list[dict]) -> dict[str, Decimal]:
    """Mirror Java line 2070-2087. Groups by product_category, sums amount.
    Java behavior: when category is null/empty → grouped under '其他' bucket.
    """
    result: dict[str, Decimal] = {}
    for row in sales_rows:
        cat = row.get("product_category") or "其他"
        amount = _to_decimal(row.get("amount") or 0)
        result[cat] = result.get(cat, Decimal("0")) + amount
    return result
```

### 3.5 路由 handler 增加 3 个分支

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement")
async def get_budget_achievement(
    factory_id: str,
    year: int = Query(...),
    metric: str = Query("revenue"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    result = await _get_budget_achievement_chart(auth.factory_id, year, metric)
    return wrap_response(result)


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom")
async def get_yoy_mom(
    factory_id: str,
    periodType: str = Query(...),
    startPeriod: str = Query(...),
    endPeriod: Optional[str] = Query(None),
    metric: str = Query("revenue"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    result = await _get_yoy_mom_chart(auth.factory_id, periodType, startPeriod, endPeriod, metric)
    return wrap_response(result)


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison")
async def get_category_comparison(
    factory_id: str,
    year: int = Query(...),
    compareYear: int = Query(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    result = await _get_category_comparison_chart(auth.factory_id, year, compareYear)
    return wrap_response(result)
```

---

## 4. F999 byte-shape gate

### 4.1 Budget achievement F999 期望响应 (real Java recording)

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "chartType": "LINE_BAR",
    "title": "2025年收入预算达成分析",
    "seriesField": "metric",
    "data": [
      {"month": "1月", "budget": 0, "actual": 0, "achievementRate": 0,
       "variance": 0, "alertLevel": "GREEN"},
      ...12 月一致 (空 F999, 全 0 + GREEN)
    ],
    "options": {
      "yAxis": [
        {"name": "金额", "position": "left"},
        {"name": "达成率(%)", "position": "right", "min": 0, "max": 150}
        // Map.of(4) order pending golden recording
      ],
      "series": [...3 entries, Map.of(4) hash order...],
      "referenceLine": {"value": 100, "label": "目标线"}
    },
    "xaxisField": "month",
    "yaxisField": "budget"
  },
  "success": true,
  "timestamp": "<volatile>"
}
```

### 4.2 Yoy-mom F999 期望响应 (single MONTH default)

```json
{
  "code": 200,
  "data": {
    "chartType": "LINE_BAR",
    "title": "收入同比环比分析",
    "seriesField": "metric",
    "data": [{
      "period": "2026-01",
      "currentValue": 0, "lastYearValue": 0, "lastPeriodValue": 0,
      "yoyGrowthRate": 0, "momGrowthRate": 0,
      "yoyChange": 0, "momChange": 0
    }],
    "options": {
      "yAxis": [
        {"name": "金额", "position": "left"},
        {"name": "增长率(%)", "position": "right"}
      ],
      "series": [...4 entries...],
      "tooltip": {"trigger": "axis"}
    },
    "xaxisField": "period",
    "yaxisField": "currentValue"
  }
}
```

### 4.3 Category comparison F999 期望响应

```json
{
  "code": 200,
  "data": {
    "chartType": "BAR",
    "title": "2025年 vs 2024年 品类结构对比",
    "seriesField": "year",
    "data": [],
    "options": {
      "groupedBar": true,
      "yAxis": [...2 entries...],
      "series": [...3 entries...],
      "summary": {"currentTotal": 0, "compareTotal": 0, "totalYoyGrowthRate": 0}
    },
    "xaxisField": "category",
    "yaxisField": "currentAmount"
  }
}
```

### 4.4 Golden 命名 + 记录策略

每个 endpoint × {F999, F001} = 6 个 golden. F999 用 fixed test args:
- budget-achievement: `year=2025&metric=revenue`
- yoy-mom: `periodType=MONTH&startPeriod=2026-01&metric=revenue`
- category-comparison: `year=2025&compareYear=2024`

F001 同 args (post-deploy smoke 用 — 数据非空时 sister chats 也能 reference).

记录工具: `scripts/record-java-golden.sh` (PR-A 已建).

---

## 5. 测试策略

### 5.1 Contract test 类 (F999 byte gate)

每个 endpoint 一个 test class, 各 2 tests:
- `test_f999_<endpoint>_data_keys_match_golden` — sanity: top-level keys order
- `test_f999_<endpoint>_byte_shape` — full dict-eq compare against golden

3 endpoints × 2 tests = 6 byte gate tests.

Mock pattern (复用 PR-A/PR-B):
```python
async def fake_finance(*_): return []
async def fake_sales(*_): return []
monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_data", fake_finance)
monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)
```

### 5.2 Unit test 类 (算术深度)

**`TestBudgetAchievementChart`** — 4 tests:
| Test | Branch |
|---|---|
| `test_budget_amount_always_returned_regardless_of_category` | audit I-5 fix: Java fall-through returns budget_amount always (keyword filter is dead code) |
| `test_alert_level_thresholds` | <=100 GREEN, 100-120 YELLOW, >120 RED |
| `test_zero_budget_zero_achievement_rate` | budget=0 → rate=0 (避免 div0) |
| `test_always_emits_12_months` | 即使 0 records 也 emit 12 entries |

**`TestYoYMoMComparisonChart`** — 4 tests:
| Test | Branch |
|---|---|
| `test_month_periodtype_yoy_mom_calc` | yoy = (cur-lastYear)/lastYear*100 |
| `test_quarter_periodtype_dispatches_to_quarter_calc` | QUARTER branch hit |
| `test_unknown_periodtype_falls_back_to_month` | 未知 periodType → MONTH default + warning log |
| `test_zero_base_growth_rate_zero` | lastYear=0 → growth=0 (avoid div0) |

**`TestCategoryComparisonChart`** — 3 tests:
| Test | Branch |
|---|---|
| `test_category_aggregation_by_product_category` | groupBy product_category, sum amount |
| `test_sort_by_current_amount_desc` | 数据按 currentAmount 降序 |
| `test_new_category_yoy_growth_100` | compare=0, current>0 → yoyGrowth=100 |

总 17 tests (6 byte gate + 11 unit tests).

### 5.3 F001 真窗 (不进 CI)

部署 test env 后用 `record-java-golden.sh --compare`:
```bash
./scripts/record-java-golden.sh --factory F001 \
  --path /api/mobile/F001/smart-bi/analysis/finance/budget-achievement \
  --query "year=2025&metric=revenue" \
  --out tests/fixtures/.../analysis-finance-F001-budget-achievement.json
```

3 endpoints × 1 record 各 ≤ 1 min.

---

## 6. Byte gate 语义说明

沿用 PR-A/PR-B 既有 dict-eq 语义 (spec §6 of profit spec). 不升级 strict-byte.

主要风险:
- **`Map.of(4)` Jackson hash 顺序未知** — budget-achievement 的 yAxis[1] (4 keys) + series 各 3 entries (4 keys each) + yoy-mom series 4 entries (4 keys each) + category-comparison series (4 keys each).
- 推荐: 录 F999 golden 后, 用 golden 顺序回写 spec 里的 dict literal.

---

## 7. PR 切片 + 顺序

**单 PR**: `phase2a/finance-sub-endpoints` — 全 ship.

**Commits 估计** (~12-14):
1. spec + plan
2. 4 helpers (budget metric, alert, display name) — 1 commit
3. `_get_budget_achievement_chart` real impl + route
4. `_get_metric_value_for_period` + `_get_metric_value_for_quarter` + `_safe_growth_rate` helpers
5. 4 calculate sub-impl (month / quarter / month_range / quarter_range)
6. `_get_yoy_mom_chart` dispatcher + route
7. `_aggregate_sales_by_category` helper
8. `_get_category_comparison_chart` real impl + route
9. record 6 goldens (F999 × 3 + F001 × 3)
10. `TestBudgetAchievementChart` (2 byte gate + 4 unit)
11. `TestYoYMoMComparisonChart` (2 byte gate + 4 unit)
12. `TestCategoryComparisonChart` (2 byte gate + 3 unit)
13. final scope verify + push + PR

LOC 估计: ~700 (impl 400 + tests 250 + spec/plan 50).

CI gate: pytest 244 (PR-B baseline) + 17 new = 261 全过.

---

## 8. Open risks + mitigations

| 风险 | Mitigation |
|---|---|
| `Map.of(4)` Jackson 顺序未知 | 录 golden 后回写 spec 里的 dict literal; 关键 helper 加注释标 hash order |
| `_query_finance_data` w/ "COST" record_type 在 cretas_db 是否存在 | hotfix 已确认 cretas_user 有 GRANT, prod 6235 行 live data; F999 empty path validated. (audit C-1 fix: revenue/profit/gross_margin 不再用 finance_data, 改用 sales) |
| `_aggregate_sales_by_category` w/ null category Java 行为 | Java line 2074: `data.getProductCategory() != null ? data.getProductCategory() : "其他"` — 已 1:1 mirror with `or "其他"` in Python |
| sales_data 行序非确定 (无 ORDER BY in Java repo) | audit C-3 fix: golden 录的是 Java 实际 emit 顺序; Python 用 `_query_finance_sales_fallback` (asyncpg) 行序可能不同. 加 `ORDER BY id` 到 Python SQL 强制 PK 序 (与 Java JPA default 一致) |
| sales 跨年 (2024 + 2025) 1+ 年 date range | `_query_finance_sales_fallback` 不限制 date range 长度; Java 也不限 |
| F001 sub-endpoint 数据可能没 — 跟 profit F001 一样空 | 与 profit F001 同 (录但不 enforce); F001 golden 仅 sister 参考 |
| budget-achievement metric 默认 "revenue" 但 Java 默认 也是 "revenue" | 已 1:1 mirror; 只改 default 时同步改 Java |
| 3 endpoint 同时 ship 一个 PR — 一坏全坏 | 单 file 同 helper, 测试 isolation 好; 反向 hotfix 也容易 |

---

## 9. References

- Sister specs (Phase 2A finance):
  - `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`
  - `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md`
  - `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`
- PRs merged: #21 (profit PR-A), #22 (profit PR-B), #23 (hotfix), #25 (cost)
- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
- Live Java backend: `47.100.235.168:10011` (test env, JWT secret in `/www/wwwroot/cretas/.env.test`)
- Recorder: `scripts/record-java-golden.sh` (PR-A built)
