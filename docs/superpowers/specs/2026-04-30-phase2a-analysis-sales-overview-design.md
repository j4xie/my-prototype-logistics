# Phase 2A `/analysis/sales` — Overview Sub-Spec

| Field | Value |
|---|---|
| **Type** | Sibling sub-spec (1 of 3 — overview / rankings / trend) |
| **Status** | Drafted, awaiting user review |
| **Endpoint** | `GET /api/mobile/{factoryId}/smart-bi/analysis/sales` (overview field of composite) |
| **Java reference** | `SalesAnalysisServiceImpl.getSalesOverview` line 78-175 + `GoldDashboardBuilder.buildFromGoldWithCharts` line 135-158 + `buildEmptyDashboard` line 1145-1159 + private helpers `convertToKPICards` (672-720) / `buildKpiFromAggregates` (193-264) / `generateAiInsightsFromMetrics` (329-351) / `generateSuggestionsFromMetrics` (356-365) / threshold constants (69-74) |
| **Foundation spec** | `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md` |
| **Sibling specs** | rankings (3 ranking sub-services) / trend (DAY/WEEK/MONTH bucketing) |
| **Branch** | `phase2a/t5-poc` (worktree at `.worktrees/phase2a-t5-poc`) |
| **Depends on** | Foundation merge (4 dict factories + composite + 5 stub signatures + F999 contract test) |

---

## §1. Why this spec — what overview owns

The overview field of the composite is a `DashboardResponse` (16-field DTO). It is the largest single sub-service in `/analysis/sales`:

- 5 KPI cards (legacy path) or 4 KPI cards (Gold path) — different keys, different field shapes
- Up to 4 AI insight branches (RED completion / YELLOW completion / RED growth / GREEN growth / INFO top-salesperson) — Chinese template strings with `String.format()` substitutions that must port 1:1 for byte match
- Suggestions list (1-3 strings, conditional)
- Charts and rankings dicts populated with sub-elements (sales_trend / category_distribution / top_stores) when Gold path
- Dual-path implementation (Gold-primary vs legacy aggregation) gated by `smartbi.gold.read-primary.enabled` flag

This sub-spec replaces the foundation stub of `_get_sales_overview()` with real implementation that:

1. Mirrors Java's Gold-first / legacy-fallback decision tree (currently F001 hits Gold path producing aiInsights=[], F999 always returns empty dashboard)
2. Adds 2 new dict factories owned by overview spec: `_new_kpi_card_dict` (KPICard 13 fields, `status="green"` default) and `_new_metric_result_dict` (MetricResult 11 fields)
3. Ports all KPI math (BigDecimal precision: SCALE=4 for division, DISPLAY_SCALE=2 for output, ROUNDING_MODE=HALF_UP)
4. Ports all 4 AI insight Chinese message templates with exact `String.format` formatting
5. Ports all suggestion-generation rules (completion<80 / customer-per-person<5 / product-concentration>60)

**Goal**: F001 `data.overview` byte-shape matches golden after `_strip_volatile`. F999 envelope unchanged (already passing via foundation stub).

---

## §2. Scope (what overview OWNS vs PUNTS)

### In-scope (this spec)

1. **Replace `_get_sales_overview` stub body legacy fallback** with real impl. Foundation signature is now `async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict` (changed to async per gold spec §15 cross-cutting). Gold-path try-first dispatch is owned by gold spec; overview spec implements the legacy fallback that runs when Gold returns null/error.
2. **1 new dict factory** in `analysis_sales.py`:
   - ~~`_new_kpi_card_dict`~~ — **MOVED to foundation** per gold spec §15 (gold + overview both consume; foundation owns to break cycle). Foundation plan task #1 javap KPICard.
   - `_new_metric_result_dict(...)` — 11 fields per MetricResult.java (only used by overview legacy path)
3. **Helper: `_query_sales_aggregates`** — single-row aggregate query mirroring `salesDataRepository.findKpiSummary` (returns total_sales / total_quantity / total_profit / total_cost / total_target / order_count). Replaces full `_query_sales_data` row-load for KPI computation.
4. **Helper: `_query_sales_aggregates_previous_period`** — same SQL minus 1 month for MoM growth calculation
5. **Helper: `_build_empty_dashboard()`** — returns DashboardResponse-shape dict matching F999 byte (single AIInsight YELLOW + single suggestion + lastUpdated=now)
6. **Helper: `_build_kpi_cards_from_aggregates`** — returns list[dict] of MetricResult-shaped (intermediate); converted by `_convert_metric_results_to_kpi_cards`
7. **Helper: `_convert_metric_results_to_kpi_cards`** — mirrors Java `convertToKPICards` (672-720) — alertLevel→status mapping, changeDirection→trend mapping, formattedValue|value fallback for `value` field
8. **Helper: `_generate_ai_insights_from_metrics`** — 2 always-INFO insights (matching from-aggregates path 329-351)
9. **Helper: `_generate_suggestions_from_metrics`** — 1 conditional suggestion (matching 356-365)
10. ~~**Optional helper: `_generate_ai_insights_full`**~~ — **NOT PORTED (Q-2 RESOLVED 2026-04-30 dead code)**. Java `SalesAnalysisServiceImpl.generateAiInsights` line 998-1083 has 0 callers + parameter signature mismatch with aggregates path. See §11.Q-2.
11. **Threshold constants** mirroring Java (TARGET_RED=60 / TARGET_YELLOW=85 / MARGIN_RED=15 / MARGIN_YELLOW=25 / GROWTH_RED=-20 / GROWTH_YELLOW=-5)
12. **Decimal-precision helpers** — `_set_scale(value, scale)` wrapping `Decimal.quantize(rounding=ROUND_HALF_UP)`, `_format_currency(value)` mirroring Java `String.format("%,.2f", ...)`, `_format_completion_pct(value)` mirroring `"%.1f%%"`, `_format_growth_pct(value)` mirroring `"%+.1f%%"`
13. ~~**Gold-vs-legacy branch decision**~~ — **DEFERRED to gold spec** (`2026-04-30-phase2a-analysis-sales-gold-design.md`). gold spec owns: Gold path adapter (`_build_from_gold_with_charts`) + try-Gold-first wiring inside `_get_sales_overview`. Overview spec only covers the legacy fallback path (when Gold returns null/error).
14. **`TestOverview` test class** in `tests/python/smartbi_compat/test_analysis_sales_contract.py` — **legacy path only** (Gold path tests owned by gold spec's `TestGold` class):
    - `test_F999_overview_byte_shape_legacy_path` — F999 cleared data, Gold returns null → legacy `_build_empty_dashboard()` path → matches F999 golden
    - `test_completion_red_branch` — synthetic monkey-patched aggregates with completion<60 → assert RED insight emitted (note: this exercises `generateAiInsights` if reachable; otherwise covers from-aggregates `INFO`-only path)
    - `test_completion_yellow_branch` — completion 60-85 → YELLOW
    - `test_growth_red_branch` — growth<-20 → RED
    - `test_growth_green_branch` — growth>0 → GREEN
    - `test_kpi_status_green_default` — legacy KPI cards: status field always "green" (Java default 81-82); gold spec's TestGold owns Gold path version
    - `test_kpi_alert_level_to_status_mapping` — verify legacy `convertToKPICards` (line 672-720): RED→red, YELLOW→yellow, default→green
    - `test_change_direction_to_trend_mapping` — UP→up, DOWN→down, default→flat
    - `test_F001_overview_byte_shape_gold_returns_null_then_legacy` — when both Gold and legacy SQL produce empty (degenerate F001 in 2025 window), result matches `_build_empty_dashboard` shape (overlap with F999 path)
    - **Note**: `test_F001_overview_byte_shape` (full Gold path, the 4-KPI restaurant-flavored response) is owned by gold spec's `TestGold.test_F001_overview_byte_shape_via_gold`.

### Out-of-scope (defer to siblings or foundation)

| Item | Owned by |
|---|---|
| `_get_salesperson_ranking` / `_get_product_ranking` / `_get_customer_ranking` real impls | rankings spec |
| Top-level composite `salespersonRanking` / `productRanking` / `customerRanking` filling in F001 (currently `[]` in golden) | rankings spec |
| `_get_sales_trend_chart` real impl + DAY/WEEK/MONTH bucketing | trend spec |
| Top-level composite `trendChart.data` filling in F001 | trend spec |
| `_query_sales_data` SQL extension with `order_date` | foundation spec |
| `_strip_volatile` / 4 dict factories (DashboardResponse / RankingItem / ChartConfig / AIInsight) / `_new_date_range_dict` | foundation spec |
| Java code modifications | NONE — this spec is Python-only, no Java touch |
| Gold-finance-summary client code in Python | EXISTS — `backend/python/smartbi/gold/queries.py` (`finance_summary`, `daily_trend`, `top_products`, `kpi_summary`). gold spec consumes via direct import; overview spec doesn't touch. |
| Gold-path adapter logic | gold spec |
| Try-Gold-first dispatch inside `_get_sales_overview` | gold spec |
| Cache invalidation / `fromCache` semantics | NONE — Java always emits `fromCache: false` |

---

## §3. Architecture

### KPI calculation flow

```
_get_sales_overview(factory_id, range_)
  ├─ # Gold-first dispatch (gold spec, already shipped)
  ├─ # Legacy fallback when Gold returns None or fails:
  ├─ kpi_summary = _query_sales_aggregates(factory_id, range_)
  ├─ if kpi_summary is None or row_count<6:
  │     return _build_empty_dashboard()                # F999 path / no rows
  ├─ if total_sales == 0 and order_count == 0:
  │     return _build_empty_dashboard()
  ├─ metric_results = _build_kpi_cards_from_aggregates(...)  # 4-5 KPIs (MoM conditional)
  ├─ kpi_cards = _convert_metric_results_to_kpi_cards(metric_results)
  ├─ # Y-a (Q-1 RESOLVED 2026-04-30): nested rankings + charts mirror Java line 142-156
  ├─ rankings_dict = _build_legacy_rankings_dict(factory_id, range_)
  ├─ charts_dict = _build_legacy_charts_dict(factory_id, range_)
  ├─ ai_insights = _generate_ai_insights_from_metrics(metric_results, totals)
  ├─ suggestions = _generate_suggestions_from_metrics(metric_results, totals)
  └─ return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        charts=charts_dict,        # Y-a: {"销售趋势":..., "产品分布":...} or {} when empty
        rankings=rankings_dict,    # Y-a: {"salesperson":[...]} or {} when empty
        ai_insights=ai_insights,
        suggestions=suggestions,
        last_updated=_utc_now_iso(),
     )
```

### AI insight generation flow (legacy, from-aggregates path)

Java line 329-351 (`generateAiInsightsFromMetrics`) is the path actually called by `getSalesOverview` line 164. Always emits 1-2 INFO insights (NOT the 4-branch RED/YELLOW logic in `generateAiInsights` line 998-1083). Confirmed by line 164 calling the metrics-only variant.

```python
def _generate_ai_insights_from_metrics(metric_results, total_sales, total_profit, order_count):
    insights = []
    insights.append(_new_ai_insight_dict(
        level="INFO",
        category="销售概况",
        message=f"期间总销售额 {_format_currency(total_sales)}，共 {order_count:,} 笔订单，"
                f"总利润 {_format_currency(total_profit)}",
    ))
    if total_sales > Decimal("0"):
        profit_rate = total_profit * Decimal("100") / total_sales  # SCALE=4 quantize
        profit_rate = profit_rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        insights.append(_new_ai_insight_dict(
            level="INFO",
            category="利润率分析",
            message=f"综合利润率 {profit_rate:.1f}%",   # Java: %.1f%%
        ))
    return insights
```

⚠ **Important**: Java's branchier insights (RED/YELLOW/GREEN with thresholds) live in `generateAiInsights` (line 998-1083) which is **NOT called from `getSalesOverview`**. F001 hits Gold path → aiInsights=[]. F999 hits empty path → 1 YELLOW insight. The 2-INFO `generateAiInsightsFromMetrics` only runs when legacy path with non-empty data executes — which neither golden tests today. Plan task: confirm we still port it (either dead code the user may flip on later, or verify by setting `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` in test env and re-recording an F001 golden).

### DashboardResponse assembly

Foundation freezes 16-field shape. Overview fills:

| Field | Gold path (F001) | Legacy non-empty | Empty (F999) |
|---|---|---|---|
| `period` | null | null | null |
| `startDate` | null | null | null |
| `endDate` | null | null | null |
| `kpiCards` | 4 Gold KPIs (total_revenue/bill_count/avg_bill_value/store_count) | 4-5 Legacy KPIs (SALES_AMOUNT/ORDER_COUNT/AVG_ORDER_VALUE/TARGET_COMPLETION/MOM_GROWTH*) | `[]` |
| `metricCards` | null | null | null |
| `rankings` | `{top_stores: [...]}` | `{salesperson: [...]}` (Y-a, Q-1 RESOLVED) | `{}` |
| `charts` | `{sales_trend, category_distribution}` | `{销售趋势, 产品分布}` (Y-a, Chinese keys mirror Java line 148/154) | `{}` |
| `chartList` | null | null | null |
| `aiInsights` | `[]` | 1-2 INFO insights | 1 YELLOW insight |
| `alerts` | null | null | null |
| `recommendations` | null | null | null |
| `suggestions` | `[]` | 0-2 strings | 1 string |
| `generatedAt` | null | null | null |
| `lastUpdated` | now ISO | now ISO | now ISO |
| `fromCache` | false | false | false |
| `cacheExpireAt` | null | null | null |

\* MOM_GROWTH only emits when previous_period_sales > 0.

---

## §4. New dict factories (owned by overview spec)

### `_new_kpi_card_dict`

KPICard.java declared 13 fields (verified by reading 239 LOC). All emit via Lombok `@Data` getters. Field order from Java source (matters for byte match):

```python
def _new_kpi_card_dict(
    key: Optional[str] = None,
    title: Optional[str] = None,
    value: Optional[str] = None,             # formatted string e.g. "1,234,567.89"
    raw_value: Optional[Decimal] = None,     # JSON Number
    unit: Optional[str] = None,
    change: Optional[Decimal] = None,
    change_rate: Optional[Decimal] = None,
    trend: Optional[str] = None,             # up/down/flat
    status: str = "green",                   # KPICard.java line 81-82 @Builder.Default = "green"
    compare_text: Optional[str] = None,
    description: Optional[str] = None,
    target_value: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
) -> dict:
    """Mirror KPICard.java @Data getters. F001 golden shows all 13 keys present
    in every kpiCards element with most == null and status defaulting to 'green'.

    F001 sample kpiCards[0]:
      key='total_revenue', title='总营收', value='20639884.52',
      rawValue=20639884.52, unit='元', change=null, changeRate=null,
      trend=null, status='green', compareText=null, description=null,
      targetValue=null, completionRate=null
    """
    return {
        "key": key,
        "title": title,
        "value": value,
        "rawValue": raw_value,           # Decimal (Jackson serializes as JSON Number)
        "unit": unit,
        "change": change,
        "changeRate": change_rate,
        "trend": trend,
        "status": status,
        "compareText": compare_text,
        "description": description,
        "targetValue": target_value,
        "completionRate": completion_rate,
    }
```

⚠ **Decimal → JSON Number serialization**: F001 golden has `rawValue: 20639884.52` (no quotes, no trailing zeros stripped). FastAPI `jsonable_encoder` default coerces `Decimal` to `float` which adds float-rep noise. Plan task: verify via `_strip_volatile` numeric-tolerance OR convert Decimal to a `decimal.Decimal` that serializes as plain string then post-process to JSON Number. Existing alerts pattern uses Decimal in `value` field of alert dict — check how alerts contract test passes byte match. ⚠ TBD.

⚠ **Field ordering in JSON output**: Python dict insertion order = JSON output order under FastAPI's default JSON encoder (orjson). Verify after impl that order matches Java declaration order (line 28-106 of KPICard.java).

### `_new_metric_result_dict`

MetricResult.java 11 fields (verified by reading 165 LOC):

```python
def _new_metric_result_dict(
    metric_code: Optional[str] = None,
    metric_name: Optional[str] = None,
    value: Optional[Decimal] = None,
    formatted_value: Optional[str] = None,
    unit: Optional[str] = None,
    change_percent: Optional[Decimal] = None,
    change_direction: Optional[str] = None,        # UP/DOWN/STABLE
    change_value: Optional[Decimal] = None,
    alert_level: str = "GREEN",                    # default per AlertLevel enum
    dimension_value: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Mirror MetricResult.java @Data getters.

    Used as intermediate representation in _build_kpi_cards_from_aggregates;
    converted to KPICard via _convert_metric_results_to_kpi_cards before
    inserting into DashboardResponse.kpiCards.

    NOTE: MetricResult is NOT directly emitted in /analysis/sales response —
    DashboardResponse.metricCards (deprecated) is always null in goldens.
    """
    return {
        "metricCode": metric_code,
        "metricName": metric_name,
        "value": value,
        "formattedValue": formatted_value,
        "unit": unit,
        "changePercent": change_percent,
        "changeDirection": change_direction,
        "changeValue": change_value,
        "alertLevel": alert_level,
        "dimensionValue": dimension_value,
        "description": description,
    }
```

---

## §5. KPI list enumeration

### Gold path (F001 — currently 4 KPIs)

Per `GoldDashboardBuilder.buildFromFinanceSummary` (line 74-90):

| # | key | title | rawValue source | value formatting | unit | status |
|---|---|---|---|---|---|---|
| 1 | `total_revenue` | 总营收 | `gold["total_revenue"]` | `setScale(2, HALF_UP).toPlainString()` | 元 | green |
| 2 | `bill_count` | 账单数 | `gold["bill_count"]` | `setScale(0, HALF_UP).toPlainString()` | 单 | green |
| 3 | `avg_bill_value` | 客单价 | `gold["avg_bill_value"]` | `setScale(2, HALF_UP).toPlainString()` | 元 | green |
| 4 | `store_count` | 门店数 | `gold["store_count"]` | `setScale(0, HALF_UP).toPlainString()` | 家 | green |

All other KPICard fields = null (change/changeRate/trend/compareText/description/targetValue/completionRate). `status` always "green".

### Legacy path (5 KPIs when MoM growth available, else 4)

Per `buildKpiFromAggregates` (line 193-264):

| # | metricCode | metricName | value | formattedValue | unit | alertLevel logic |
|---|---|---|---|---|---|---|
| 1 | `SALES_AMOUNT` | 总销售额 | totalSales (DISPLAY_SCALE=2) | `String.format("%,.2f", ...)` | 元 | GREEN |
| 2 | `ORDER_COUNT` | 订单数 | orderCount (BigDecimal from long) | `String.format("%,d", orderCount)` | 单 | GREEN |
| 3 | `AVG_ORDER_VALUE` | 客单价 | totalSales/orderCount (SCALE=4 div, DISPLAY_SCALE=2 set) | `String.format("%,.2f", ...)` | 元 | GREEN |
| 4 | `TARGET_COMPLETION` | 目标完成率 | totalSales/totalTarget*100 (DISPLAY_SCALE=2) | `String.format("%.1f%%", ...)` | % | RED if <60, YELLOW if <85, else GREEN |
| 5 | `MOM_GROWTH` | 环比增长 | metricCalculatorService.calculateMomGrowth(curr, prev) (DISPLAY_SCALE=2) | `String.format("%+.1f%%", ...)` | % | RED if <-20, YELLOW if <-5, else GREEN |

⚠ **MoM growth conditional**: KPI 5 only added when `previousSales > 0` (line 249). When previous period had no data, list has 4 KPIs. Java Repository call: `findKpiSummary(factoryId, startDate.minusMonths(1), endDate.minusMonths(1))`.

⚠ **`MetricCalculatorService.calculateMomGrowth` formula**: `(curr - prev) / prev.abs() * 100`. Plan task: javap the constants `SALES_AMOUNT / ORDER_COUNT / AVG_ORDER_VALUE / TARGET_COMPLETION / MOM_GROWTH` to confirm exact strings (likely literal "SALES_AMOUNT" etc.).

⚠ **Conversion to KPICard** (line 705-718, `convertToKPICards`):
- `key = metric.metricCode`
- `title = metric.metricName`
- `rawValue = metric.value`
- `value = metric.formattedValue ?: metric.value.toString() ?: "-"`
- `unit = metric.unit`
- `changeRate = metric.changePercent`
- `change = metric.changeValue`
- `trend` = changeDirection mapping (UP→up, DOWN→down, default→flat)
- `status` = alertLevel mapping (RED→red, YELLOW→yellow, default→green)
- `description = metric.description`
- `compareText / targetValue / completionRate` left null

---

## §6. AI insight generators

### From-aggregates path (the one actually called by `getSalesOverview` line 164)

Java line 329-351 `generateAiInsightsFromMetrics`:

```
1. ALWAYS emit:
   level=INFO, category=销售概况
   message="期间总销售额 {formatCurrency(totalSales)}，共 {orderCount:%,d} 笔订单，
            总利润 {formatCurrency(totalProfit)}"

2. IF totalSales > 0:
   profitRate = totalProfit * 100 / totalSales  (SCALE=4 div, ROUND_HALF_UP)
   level=INFO, category=利润率分析
   message="综合利润率 {profitRate:.1f}%"     # Note: %.1f%%, single % literal
```

### Full-branch path (line 998-1083 `generateAiInsights` — possibly DEAD CODE on `/analysis/sales`)

⚠ Plan task: confirm reachability. If reachable via `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` flag flip, port these too:

| Branch | Trigger condition | level | category | message template | actionSuggestion |
|---|---|---|---|---|---|
| Completion-RED | `completionRate < 60` (TARGET_RED_THRESHOLD) | RED | 目标完成 | `"目标完成率仅为 %.1f%%，严重落后于计划"` | `"建议立即召开销售会议，分析原因并制定追赶计划"` |
| Completion-YELLOW | `60 <= completionRate < 85` | YELLOW | 目标完成 | `"目标完成率为 %.1f%%，需要加速"` | `"建议加强客户跟进，提高成交转化率"` |
| Growth-RED | `growth < -20` | RED | 销售趋势 | `"销售额环比下降 %.1f%%，需要关注"` (uses `growth.abs()`) | `"建议分析下降原因，是否存在季节性因素或市场变化"` |
| Growth-GREEN | `growth > 0` | GREEN | 销售趋势 | `"销售额环比增长 %.1f%%，保持良好势头"` | `"继续保持当前销售策略，同时关注增长可持续性"` |
| Top-salesperson | `salespersonSales.size() > 1` | INFO | 人员表现 | `"销冠 %s 贡献 %s 元，可分享成功经验"` (top.key, formatCurrency(top.value)) → relatedEntity=top.key | `"建议安排销冠分享会，提升团队整体能力"` |

**No GREEN branch for completion** (Java line 1003-1024 has only RED and YELLOW for completion). **No YELLOW branch for growth** between -20 and -5 (Java line 1033-1050 has only RED <-20 and GREEN >0; no else).

### Empty path (F999, `buildEmptyDashboard` line 1145-1159)

Always emits exactly 1 insight + 1 suggestion:

```
aiInsights = [{
  level: "YELLOW",
  category: "数据状态",
  message: "当前时间范围内暂无销售数据",
  relatedEntity: null,
  actionSuggestion: "请上传销售数据或调整时间范围"
}]
suggestions = ["请先上传销售数据以开始分析"]
```

### Gold path (F001 today)

Always: `aiInsights=[]`, `suggestions=[]`. Java `GoldDashboardBuilder.buildFromFinanceSummary` line 113-114 hardcodes empty.

---

## §7. SQL helpers needed

### `_query_sales_aggregates`

Mirrors `salesDataRepository.findKpiSummary(factoryId, startDate, endDate)` (single-row aggregate, fast path used by line 115). Returns 6 columns:

```sql
SELECT
  COALESCE(SUM(amount), 0)         AS total_sales,
  COALESCE(SUM(quantity), 0)       AS total_quantity,
  COALESCE(SUM(profit), 0)         AS total_profit,
  COALESCE(SUM(cost), 0)           AS total_cost,
  COALESCE(SUM(monthly_target), 0) AS total_target,
  COUNT(DISTINCT product_id)       AS order_count
FROM smart_bi_sales_data
WHERE factory_id = :fid AND order_date BETWEEN :start AND :end
```

⚠ **TBD: Java's `findKpiSummary` JPQL**: plan task to read repository to confirm exact SQL. The 6-column shape is inferred from line 124-129 access pattern. `order_count` may be `COUNT(*)` not `COUNT(DISTINCT product_id)` — Java line 743-747 uses `salesData.stream().map(::getProductId).filter(nonNull).distinct().count()` which is `COUNT(DISTINCT product_id)` semantically, BUT this is the ROW path (calculateKpiCards line 743), not the AGGREGATES path (line 129 reads from `kpiSummary[5]` produced by repo query). Plan task to confirm.

⚠ Result handling: Java line 117-119 unwraps nested `Object[]` if JPA returns `[[a,b,c,d,e,f]]` instead of `[a,b,c,d,e,f]`. Python with SQLAlchemy returns a `Row` — should not have this nesting issue. If ambiguous, fetch one row and check.

### `_query_sales_aggregates_previous_period`

Same query with `start = startDate.minusMonths(1)`, `end = endDate.minusMonths(1)`. Used only when MoM growth KPI is calculated (legacy path KPI 5).

⚠ **DateRange minus 1 month**: Java uses `LocalDate.minusMonths(1)`. Python should use `dateutil.relativedelta(months=-1)` to match (NOT `timedelta(days=30)` which produces different boundary).

---

## §8. Test fixtures

### Extends `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Foundation creates the file with `TestEnvelope` class. Overview adds `TestOverview` class:

```python
class TestOverview:
    """Overview spec contract tests. Foundation merge gates TestEnvelope only;
    this class is added by overview spec implementation.

    Gold path = SMARTBI_GOLD_READ_PRIMARY_ENABLED=true (matches prod / matches F001 golden).
    Legacy path = SMARTBI_GOLD_READ_PRIMARY_ENABLED=false (matches synthetic data tests).
    """

    def test_F001_overview_byte_shape_gold_path(self, client, monkeypatch):
        """F001 golden was recorded with Gold path on (line 145-1659 of golden).
        4 Gold KPIs + top_stores ranking + sales_trend + category_distribution charts
        + aiInsights=[] + suggestions=[].
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")
        # ... call /analysis/sales/F001, strip_volatile, compare data.overview to golden

    def test_F999_overview_empty_dashboard(self, client):
        """F999 has no Silver data → Gold empty → buildEmptyDashboard."""
        # Already covered by foundation TestEnvelope.test_F999_empty_state_byte_shape;
        # this duplicates that assertion focused on data.overview slice.

    def test_legacy_path_completion_red(self, client, monkeypatch, synthetic_factory):
        """Synthetic data: completion_rate 50% → RED insight + RED status on KPI."""
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")
        # Insert synthetic rows with totalSales=50K, totalTarget=100K → 50% completion
        # ⚠ Insight branch: assert ONLY when full-branch path is reachable (Q-2)

    def test_legacy_path_growth_red(self, client, monkeypatch, synthetic_factory):
        """Curr period 100K, prev period 200K → -50% MoM → RED insight."""

    def test_kpi_status_green_default(self, client, monkeypatch, synthetic_factory):
        """KPICard.status default 'green' (Java @Builder.Default line 81-82)."""

    def test_change_direction_to_trend_mapping(self):
        """Unit test: convertToKPICards line 691-703 mapping."""
        assert _change_direction_to_trend("UP") == "up"
        assert _change_direction_to_trend("DOWN") == "down"
        assert _change_direction_to_trend(None) == "flat"
        assert _change_direction_to_trend("STABLE") == "flat"

    def test_alert_level_to_status_mapping(self):
        assert _alert_level_to_status("RED") == "red"
        assert _alert_level_to_status("YELLOW") == "yellow"
        assert _alert_level_to_status("GREEN") == "green"
        assert _alert_level_to_status(None) == "green"

    def test_kpi_card_dict_field_order(self):
        """Field order locked by Java KPICard.java line 28-106."""
        d = _new_kpi_card_dict(key="x", title="y", value="z", raw_value=Decimal("1"))
        assert list(d.keys()) == [
            "key", "title", "value", "rawValue", "unit",
            "change", "changeRate", "trend", "status",
            "compareText", "description", "targetValue", "completionRate",
        ]
```

### Synthetic data fixtures (F999 + factory_id="F999_OVERVIEW_TEST")

Use F999 fixture pattern from alerts/recommendations marathon:

```python
@pytest.fixture
def synthetic_factory(smartbi_db_session):
    """Insert F999_OVERVIEW_TEST sales rows with controlled values for KPI assertions.
    Cleaned up post-test."""
    rows = [
        # 5 rows totaling 50K sales / 100K target → 50% completion → RED
        # ... 1 row per salesperson for top-salesperson insight
    ]
    smartbi_db_session.execute(text("INSERT INTO smart_bi_sales_data (...) VALUES ..."), rows)
    yield "F999_OVERVIEW_TEST"
    smartbi_db_session.execute(text("DELETE FROM smart_bi_sales_data WHERE factory_id='F999_OVERVIEW_TEST'"))
```

---

## §9. F001 byte-shape strategy

### Strict requirements (must byte-match after strip-volatile)

1. **Composite key order**: foundation locks (overview / customerRanking / productRanking / dateRange / salespersonRanking / generatedAt / trendChart). Overview spec doesn't touch.
2. **Overview field order**: 16 keys in DashboardResponse.java declaration order. Foundation factory locks.
3. **kpiCards element field order**: 13 keys in KPICard.java declaration order. THIS spec locks via `_new_kpi_card_dict`.
4. **kpiCards element values** (Gold path):
   - `rawValue` MUST be Decimal serialized as JSON Number with same precision as Java BigDecimal output (e.g. `20639884.52`, not `20639884.5200`)
   - `value` MUST be string-formatted with `setScale(2, HALF_UP).toPlainString()` for currency or `setScale(0, HALF_UP).toPlainString()` for count
   - All other fields explicitly null (NOT absent)
5. **rankings.top_stores element shape** (RankingItem):
   - 6 keys: rank/name/value/target/completionRate/alertLevel
   - `target/completionRate/alertLevel = null` for Gold path (line 99-103 of GoldDashboardBuilder doesn't set them)
6. **charts.sales_trend / charts.category_distribution shapes** (ChartConfig):
   - 7 keys per foundation factory
   - data array elements: dict with 2-3 keys (date+amount for trend, category+amount for pie)
   - amount serialized with DISPLAY_SCALE=2 (e.g. `91972.04`)
   - `options: null` for Gold path (line 179-185 of GoldDashboardBuilder doesn't set options on trend; for category, line 215-221 doesn't either)
7. **aiInsights = `[]`** literal empty list, NOT `null`.
8. **suggestions = `[]`** literal empty list, NOT `null`.

### Volatile (stripped via `_strip_volatile`)

- `lastUpdated` (overview field)
- `generatedAt` (overview AND composite top-level)
- `cacheExpireAt` (always null but stripped for safety)
- `timestamp` (envelope ApiResponse)

### Numeric precision risks

⚠ **Decimal → JSON Number**: Python's `json.dumps(Decimal("20639884.52"))` raises TypeError. FastAPI uses `pydantic_encoder` which converts Decimal → str by default OR float (pydantic v2). Java Jackson with `BigDecimal` serializes as JSON Number.

**Mitigation options**:
1. Custom JSON encoder converting Decimal → number-string-then-removed-quotes (hacky)
2. orjson with `OPT_SERIALIZE_NUMPY` — but orjson rejects Decimal
3. Convert Decimal to `float` at boundary — risks precision loss on large totals (20M is safe in IEEE 754)
4. Match Java behavior by emitting string with `.toPlainString()` semantics, then post-process JSON

⚠ **Plan task**: check how alerts/recommendations golden tests handle Decimal in `value` fields (they pass byte-match → there's an existing pattern). Reuse it.

⚠ **Plan task**: check Java BigDecimal output for `setScale(2, HALF_UP).toPlainString()` on integer-like values. F001 shows `"rawValue": 8` (no decimal) for store_count and `"rawValue": 20639884.52` (2 decimals) for total_revenue. Python must distinguish (use scale=0 for count, scale=2 for currency).

---

## §10. Risk register (overview-specific, plus inherited)

| # | Risk | Severity | Mitigation | Note |
|---|---|---|---|---|
| **R3-OV** (inherits R3 from foundation) | BigDecimal precision: Java's `setScale(SCALE=4, ROUND_HALF_UP).divide(...)` for completion_rate vs Python `Decimal.quantize` — small difference can flip insight branch boundary | High | Mirror `SCALE=4`, `DISPLAY_SCALE=2`, `ROUND_HALF_UP` exactly. For division: `(numerator * Decimal('100')).divide(denominator, 4, ROUND_HALF_UP)`. Add unit test asserting `_calculate_completion_rate(Decimal('60.001'), Decimal('100'))` matches Java to 4 decimals. | overview impl |
| **R4-OV** (inherits R4) | AI insight Chinese strings via `String.format` need 1:1 port. Subtle: `%,.2f` (thousands separator), `%+.1f%%` (force sign + percent literal), `%.1f%%` (single %). Python f-string `{:,.2f}` matches `%,.2f`. `f"{x:+.1f}%"` matches `%+.1f%%`. | High | Plan task: line-by-line port each template. Unit test each branch with synthetic values to assert exact string match. | overview impl |
| **R-OV-1** | KPICard `status` default = "green" via `@Builder.Default` (line 81-82). Python factory must default `status="green"`, NOT None. F001 golden confirms 4× "status": "green". | High | `_new_kpi_card_dict(status="green")` default param. Test `test_kpi_status_green_default`. | overview impl |
| **R-OV-2** | Decimal → JSON Number serialization (see §9) — pydantic v2 may emit string. Mismatch breaks F001 byte match. | Critical | Plan task: replicate alerts/recommendations Decimal serialization pattern. If fails, custom orjson encoder. | overview impl |
| **R-OV-3** | Java's `formatCurrency` uses `String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue())`. The `.doubleValue()` introduces float precision loss for very large numbers. Python `f"{value:,.2f}"` doesn't. For F001 numbers (max 20M), no observable difference. | Low | If F001 byte-match fails on currency strings, use `Decimal.quantize(Decimal('0.01'), HALF_UP)` then `f"{val:,.2f}"` — equivalent to Java for values < 2^53. | impl + verify |
| **R-OV-4** | Gold path branching: Python `_get_sales_overview` reads `SMARTBI_GOLD_READ_PRIMARY_ENABLED` env var. If env not set in test env or CI, branch is wrong. | Medium | Default to `false` when unset (matches Java `@Value(":false")`). Test env (10011 + 8084) sets explicit. Plan task: document env var in test setup docs. | impl |
| **R-OV-5** | If `generateAiInsights` (line 998-1083, full-branch RED/YELLOW logic) IS reachable via flag flip, omitting it breaks future byte match when flag flips. | Low (no current golden hits it) | Plan task Q-2: confirm reachability. If reachable, port. If dead code, document as ⚠ and skip. | impl |
| **R-OV-6** | Repo query `findKpiSummary` may use JPQL with HQL-specific syntax (`COALESCE`, `CASE WHEN`). Python SQL must reproduce semantics including null-handling. | Medium | Read the Java repo. Test against same `smart_bi_sales_data` rows to validate identical 6-tuple output. | impl |
| **R-OV-7** | `convertToKPICards` line 709-710 fallback: `value = formattedValue ?: value.toString() ?: "-"`. Python must match exactly when formattedValue is null AND value is null AND value is not null with `.toString()`. | Low | One-line ternary in helper. Unit test 3 cases. | impl |
| **R-OV-8** | DashboardResponse field order in 16-key dict — foundation factory locks. If overview spec adds new keyword arg that subtly reorders, F001 byte-shape breaks. | Low | Use foundation `_new_dashboard_response_dict` factory only — do not construct dict literals in overview. | impl |

---

## §11. Open questions (TBD before plan task execution)

| # | Question | Plan task to resolve |
|---|---|---|
| **Q-1** | **RESOLVED 2026-04-30 (Y-a)**: Legacy fills `overview.rankings + overview.charts` matching Java line 142-156. Sibling rankings/trend specs still fill top-level fields for byte-parity (even though web-admin grep confirmed 0 consumers of `data.salespersonRanking/customerRanking/productRanking/trendChart` — they're API contract only). Reasoning: web-admin `SalesAnalysis.vue:720` reads `overview?.rankings || data.rankings` with JS short-circuit on truthy `{}` → if overview leaves nested `{}`, frontend never sees rankings even when top-level filled. Y-a fixes this by filling nested directly. | DONE — see brainstorm chat 2026-04-30 |
| **Q-2** | **RESOLVED 2026-04-30 (dead code)**: `SalesAnalysisServiceImpl.generateAiInsights` (line 998-1083) is `private` with **0 callers** in entire `backend/java/` (grep `generateAiInsights\b` returned only the definition itself). Same-name methods in `ProcurementAnalysisServiceImpl:914` and `InventoryHealthAnalysisServiceImpl:1107` are different classes / different domains. **Architectural confirmation**: line 998 signature `(List<SmartBiSalesData> salesData, ...)` requires full row data; `getSalesOverview` line 115-129 uses aggregates-only path → 4-branch is unreachable even in principle. NOT PORTED. Comment `# Q-2 grep 2026-04-30: SalesAnalysisServiceImpl.generateAiInsights is dead code; not ported. If Java wires it up later, port then.` placed in code at orchestration site. | DONE — grep evidence in brainstorm |
| **Q-3** | **RESOLVED 2026-04-30**: `SmartBiSalesDataRepository.findKpiSummary` JPQL line 85-89 confirmed: `COUNT(DISTINCT s.productId)` (NOT `COUNT(*)`). Python `_query_sales_aggregates` mirrors as `COUNT(DISTINCT product_id)`. | DONE — verified line 87 |
| **Q-4** | Gold finance-summary endpoint URL + response shape — does Python already have a client (e.g. for `/analysis/finance` port), or must overview port the Java `GoldFinanceClient`? | grep `gold_finance_client / finance_summary` in `backend/python/`. |
| **Q-5** | Does FastAPI serializer emit `Decimal("8")` as `8` (JSON Number) or `"8"` (JSON String)? F001 golden has `"rawValue": 8` not `"8"`. | Check existing alerts/recommendations test pass behavior; replicate. |
| **Q-6** | F001 golden `lastUpdated: "2026-04-29T12:43:07.375181718"` has 9-digit nanos suffix (Java LocalDateTime). Python `datetime.now().isoformat()` emits 6-digit microseconds. Stripped via `_strip_volatile` — but verify regex covers both. | Verify in plan C.1 by running F001 test before stripping. |
| **Q-7** | When MoM growth is computed and previous_period_sales is NEGATIVE (refunds-only), Java `metricCalculatorService.calculateMomGrowth` divides by `prev.abs()`. Plan task: confirm formula and edge case. | Read MetricCalculatorService.calculateMomGrowth. |
| **Q-8** | KPICard.java line 200-208 `formatValue` adds 万/亿 suffix for large values. Java line 204-205: `value.divide(BigDecimal.valueOf(10000), 2, RoundingMode.HALF_UP) + "万"`. Is this called from `getSalesOverview` flow or only via static factory `KPICard.of`? `convertToKPICards` line 705-718 uses Builder, NOT static factory → does NOT use 万/亿 formatting. F001 confirms: `"value": "20639884.52"` (no 万 suffix despite >10000). | Skip 万/亿 logic in overview spec — confirmed unused on this code path. |

---

## §12. Acceptance criteria

Overview spec implementation is complete when:

- [x] `_get_sales_overview` real impl replaces foundation stub
- [x] `_new_kpi_card_dict` and `_new_metric_result_dict` factories added
- [x] `_query_sales_aggregates` and `_query_sales_aggregates_previous_period` SQL helpers added
- [x] `_build_empty_dashboard` matches F999 exact byte
- [x] `_convert_metric_results_to_kpi_cards` mirrors Java alertLevel→status + changeDirection→trend mapping
- [x] `_generate_ai_insights_from_metrics` ports both INFO templates
- [x] `_generate_suggestions_from_metrics` ports the completion<80 conditional
- [x] (Conditional on Q-2) `_generate_ai_insights_full` ports 4-branch logic
- [x] (Conditional on Q-4) Gold finance-summary client wired or reused
- [x] All 6 threshold constants ported (TARGET_RED=60, TARGET_YELLOW=85, MARGIN_RED=15, MARGIN_YELLOW=25, GROWTH_RED=-20, GROWTH_YELLOW=-5)
- [x] `TestOverview` test class with ≥9 tests passes
- [x] `test_F001_overview_byte_shape_gold_path` passes against test env (10011) golden
- [x] `test_F999_overview_byte_shape_legacy_path` passes
- [x] No regression: `test_alerts_contract.py`, `test_recommendations_contract.py`, foundation `TestEnvelope.test_F999_empty_state_byte_shape` still pass
- [x] No Java code changes
- [x] All inserted JSON keys are camelCase (verified by `_new_kpi_card_dict` field-order test)

Sibling specs (rankings / trend) gate on overview merge for any shared `analysis_sales.py` edits.

---

## §13. Plan structure preview

When the overview-spec chat runs, the plan (separate file `docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-overview.md`) will have phases:

- **Phase A** (~3-4 tasks): Pre-impl exploration
  - Task A.1: Read `SmartBIServiceImpl.getComprehensiveAnalysis` to resolve Q-1
  - Task A.2: Grep `generateAiInsights` usages to resolve Q-2
  - Task A.3: Read `SmartBiSalesDataRepository.findKpiSummary` JPQL to resolve Q-3
  - Task A.4: Grep `gold_finance_client / fetchFinanceSummary` in `backend/python/` to resolve Q-4
  - Task A.5: Check existing alerts/recommendations Decimal serialization to resolve Q-5

- **Phase B** (~5-7 tasks): Code creation
  - Task B.1: Add `_new_kpi_card_dict` + `_new_metric_result_dict` factories with field-order tests
  - Task B.2: Add threshold constants module-level
  - Task B.3: Add Decimal helpers (`_set_scale`, `_format_currency`, `_format_completion_pct`, `_format_growth_pct`)
  - Task B.4: Add `_query_sales_aggregates` + `_query_sales_aggregates_previous_period`
  - Task B.5: Add `_build_kpi_cards_from_aggregates` + `_convert_metric_results_to_kpi_cards`
  - Task B.6: Add `_generate_ai_insights_from_metrics` + `_generate_suggestions_from_metrics`
  - Task B.7: (Conditional Q-4) Add Gold finance-summary client wrapper
  - Task B.8: Replace `_get_sales_overview` stub body with branching + delegation

- **Phase C** (~3-4 tasks): Test creation + validation
  - Task C.1: Add `TestOverview` class with all ≥9 tests
  - Task C.2: Run F001 contract test, debug byte-shape diffs
  - Task C.3: Run synthetic-data branch tests
  - Task C.4: Re-run alerts/recommendations regression suite

- **Phase D** (~2 tasks): Verification
  - Task D.1: Full pytest suite (74+ → 80+ tests pass)
  - Task D.2: Deploy to test env (10011 + 8084), curl /analysis/sales/F001, diff vs golden

Total: ~13-17 tasks, ~5-8h work for overview chat (post-foundation).

---

## §14. Parallel work analysis

| Dimension | Parallel possible? |
|---|---|
| Writing overview / rankings / trend specs (now) | Yes — independent docs, different ownership scopes |
| Executing overview spec (later chat) | Sequential after foundation merge; rankings + trend can start once overview ships if `analysis_sales.py` edits are scoped to non-overlapping helpers |
| Multiple chats editing `analysis_sales.py` | NO — concurrent-edit-safety rule 1+2+5b. Sequential or sub-worktrees only. Overview must merge before rankings/trend touch shared file. |
| Dict-factory definition vs impl | Within overview chat, factories first (B.1) then impls (B.5+B.8) — sequential |

End of overview sub-spec.
