# Phase 2A `/analysis/finance` budget per-type 真实现 — Design Spec

**Date**: 2026-05-01
**Branch**: `phase2a/t-finance-budget`
**Worktree**: `.worktrees/phase2a-finance-budget`
**Predecessors**:
- PR #18 — payable per-type real impl (`b058a0bc3`)
- PR #21 — profit per-type PR-A merged (`bfe77566c`)
- PR #22 — profit per-type PR-B merged (`8602e8374`)
- PR #25 — cost per-type real impl + composite shared upgrade (`d6b48738a`)
- PR #28 — cost per-type arithmetic depth tests (`b7b6015b1`)
- PR #30 — C1 fix `_get_period_key` WEEK calendar year (`8031f2644`)
- PR #31 — Phase 2A backlog map (`aa6741c53`)
- **PR #32 — 3 sub-endpoints port (budget-achievement + yoy-mom + category-comparison) merged (`ccdeb4b1b`)** — shipped `_determine_budget_achievement_alert` (line 449-464) used as reuse target by this spec; `import calendar` 已在 module level (no race condition)

**Sister chat (parallel Wave 1 twin)**: `phase2a/t-finance-receivable` — receivable per-type real impl (this spec must remain consistent with that one; cross-spec audit cycle reconciles).

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main `aa6741c53`）

`/api/mobile/{factoryId}/smart-bi/analysis/finance` 主端点：

| analysisType | Python 状态 |
|---|---|
| (空) — composite | ✅ real impl (PR #25 cost upgrade 包含) |
| `payable` | ✅ real impl (PR #18) |
| `profit` | ✅ real impl + arithmetic depth (PR #21 + #22) |
| `cost` | ✅ real impl + arithmetic depth (PR #25 + #28) |
| **`budget`** | **❌ 501 envelope** (`backend/python/smartbi_compat/api/analysis_finance.py:1543-1548`) — 本 spec 解决 |
| `receivable` | ❌ 501 envelope — sister chat 解决 |

### 1.2 这一 chat 范围

实施 **`analysisType=budget` per-type 真实现**：
- 3 个 sub-service helper port (`_get_budget_metrics` + `_get_budget_execution_waterfall` + `_get_budget_vs_actual_chart`)
- **1 reused alert helper** (`_determine_budget_achievement_alert` line 449-464，从 PR #32 merge 来) + **1 new alert helper** (`_determine_budget_variance_rate_alert`)
- 1 个 dispatcher (`_get_budget_analysis`) — Controller line 258-263 envelope mirror
- 1 个路由分支 (`if analysisType == "budget"` 在 `get_finance_analysis`)
- F999 byte-shape gate (golden + 3 contract tests: 2 byte-gate + 1 date-scope matrix)
- F001 真窗 smoke (post-deploy via `record-java-golden.sh` 手动两步 diff，C2 known issue workaround)
- PR-B arithmetic depth: 4 test class (TestBudgetHelpers + TestBudgetMetricsArithmetic + TestBudgetExecutionWaterfallArithmetic + TestBudgetVsActualChartArithmetic), **~22 tests** (4 + 7 + 6 + 5)

PR 切片：PR-A foundation + PR-B arithmetic depth (单 PR-B，escape hatch 见 §7)。

### 1.3 显式不在范围

- **`/analysis/finance/budget-achievement` sub-endpoint** — 跟 `analysisType=budget` **完全不是同一个端点**，**已 merged via PR #32 (`ccdeb4b1b`)**. Budget per-type (本 spec) = 主端点 query string，sub-endpoint = 独立 path。Sister 已 ship `_determine_budget_achievement_alert` (line 449-464) + `import calendar` (module level)，本 spec **直接复用**，无并发 file-conflict 风险。 |
- 其他 analysisType (`receivable`) — sister chat 平行处理。
- T6 nginx cutover — Phase 2A 后期统一切流量。
- byte gate 升级到 strict-byte (沿用 dict-eq, 见 §6 backlog)。
- AI insights / Tool-Skill / 食品知识库 — 永久留 Java per `project_apr30_tool_skill_stays_java.md`。

### 1.4 Side-effect 检查

**Composite path 不依赖 budget stub** — `_get_comprehensive_finance_analysis` (line ~1410) 的 6-key DashboardResponse (`overview` / `costStructure` / `dateRange` / `generatedAt` / `profitMetrics` / `receivableAging`) **不包含 budget**。本 PR-A merge 后 composite path **零变化**。

无 transparent upgrade 副作用，仅 dispatcher 多 1 个 branch + 501 默认枝缩到 `["receivable"]`。

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
backend/python/smartbi_compat/api/analysis_finance.py            [EDIT]
  + import calendar (module level)                               EXISTS (PR #32 already added; no-op for this spec)
                                                                 — verify presence at module top before assuming reuse
  + _create_waterfall_item(name, value, type_)                   NEW (helper)
  + _determine_budget_variance_rate_alert(rate)                  NEW (helper)
  + REUSE existing _determine_budget_achievement_alert(rate)     EXISTS (line 449-464, shipped via PR #32 `ccdeb4b1b`)
                                                                 — for both BUDGET_EXECUTION metric + comparison chart per-category alert
                                                                 — Java has 2 identical-logic methods (line 1649 determineBudgetAlertLevel
                                                                   + line 1794 determineBudgetAchievementAlertLevel) but Python collapses
                                                                   to 1 helper since logic is byte-identical (>120 RED, >100 YELLOW, else GREEN).
                                                                   tech-debt rename to neutral `_determine_budget_threshold_alert` deferred
                                                                   to Phase 3 cleanup (PR #32 already uses current name; rename would
                                                                   require coordinated update of budget-achievement endpoint).
  + _get_budget_metrics(factory_id, year, month)                 NEW (sub-service)
  + _get_budget_execution_waterfall(factory_id, year)            NEW (sub-service)
  + _get_budget_vs_actual_chart(factory_id, start_date, end_date) NEW (sub-service)
  + _get_budget_analysis(factory_id, start_date, end_date)       NEW (per-type assembler)
  + 阈值常量 (optional, named for clarity):
      BUDGET_EXECUTION_RED_THRESHOLD = 120     # mirror Java line 106
      BUDGET_EXECUTION_YELLOW_THRESHOLD = 100  # mirror Java line 107
      BUDGET_VARIANCE_RATE_RED = 20            # Java MetricCalculatorServiceImpl inlines
      BUDGET_VARIANCE_RATE_YELLOW = 10         # Java MetricCalculatorServiceImpl inlines
  + route handler: dispatch `analysisType == "budget"`            NEW (1 branch)
  + 501 default 缩 dispatch loop（drop "budget"）

tests/python/smartbi_compat/test_analysis_finance_contract.py    [EDIT]
  + class TestAnalysisFinanceBudget                              NEW (2 byte-gate + 1 date-scope contract)
  + 既有 test_f999_unimplemented_analysisType_returns_501 更新
      loop 从 ["receivable", "budget"] → ["receivable"]
  PR-B:
  + class TestBudgetHelpers                  NEW (~5 tests, helper-level)
  + class TestBudgetMetricsArithmetic        NEW (~6 tests)
  + class TestBudgetExecutionWaterfallArithmetic NEW (~5 tests)
  + class TestBudgetVsActualChartArithmetic  NEW (~5 tests)

tests/fixtures/java-smartbi-golden/  [NEW]
  + analysis-finance-F999-budget.json        NEW (recorded from Java 10011)
  + analysis-finance-F001-budget.json        NEW (recorded from Java 10010 prod)
```

### 2.2 关键架构决策

1. **3 个 sub-service 各自独立签名 per Rule 3** — 不强行复用 `DateRange`，跟 Java method 一一对应 (`year+month` / `year` / `start_date+end_date`)。
2. **共享 SQL helper** — 用既有 `_query_finance_data(factory_id, "BUDGET", start, end)` (line 1238-1278)。**Note (CC1 fix)**: helper 实际 SQL 是 explicit columns 不是 `SELECT *` (line 1260-1267 hard-codes 24 columns including `budget_amount, actual_amount, variance_amount`)。Rule 5 (SELECT *) 是 forward-looking guidance — 当时 cost spec 提议但实施时改成 explicit columns，已经包含本 spec 需要的所有 budget 列。**不新建 `_query_finance_budget_data` specialized helper** (Rule 5 spirit 仍然: 不为 budget 专门列字段)。
3. **Reuse existing `_determine_budget_achievement_alert` + new `_determine_budget_variance_rate_alert`** — Java has 2 alert methods (`FinanceAnalysisServiceImpl.determineBudgetAlertLevel` line 1649 + `determineBudgetAchievementAlertLevel` line 1794) with **byte-identical logic** (`>120 RED, >100 YELLOW, else GREEN`). Python already has `_determine_budget_achievement_alert` (line 449-464) shipped via PR #32 (`ccdeb4b1b`) for budget-achievement sub-endpoint. Reuse it for budget per-type's BUDGET_EXECUTION metric + comparison chart per-category alert (no new helper, avoid code duplication). Variance rate has different threshold semantics (abs() with diff thresholds 20/10) — separate `_determine_budget_variance_rate_alert` helper required (Python 端必须加前缀消岐义，Java 是跨 service 调用 `metricCalculatorService.determineAlertLevel`).
4. **Dispatcher derive year/month from end_date** — `_get_budget_analysis(factory_id, start_date, end_date)` 内部 `year = end_date.year, month = end_date.month`，1:1 mirror Java Controller line 259-260 (`endDate.getYear() + endDate.getMonthValue()`)。
5. **3 个 sub-service 查询不同日期范围** (F1) — metrics 单月 / waterfall 全年 / comparison dispatcher 范围。这是 Java parity 行为，spec §3 显式文档化 + 加 contract test。
6. **无 `.abs()` 防御 1:1 mirror Java** (F2) — Java line 933 + 1044 raw accumulation。Python 不加 `.abs()`，即使 Java 是潜在 bug，port 必须 mirror 求 byte-shape parity (Rule 3 红线)。

### 2.3 与 cost 的差异点

| 维度 | cost (PR #25 + #28) | budget (this spec) |
|---|---|---|
| Sub-service 数 | 2 (structureChart + trendChart) | **3** (metrics + waterfall + comparison) |
| Envelope keys | 4 (startDate, endDate, structureChart, trendChart) | **5** (startDate, endDate, metrics, waterfall, comparison) |
| Sub-service date scope | 全部 dispatcher range | **3 不同范围**（F1） |
| Defensive `.abs()` | ✅ 有 (Bug B 防御) | **❌ 无** (Java raw accumulation, F2) |
| Alert helpers | 0 (cost 不分级) | **2** (execution rate + variance rate) |
| 函数签名一致性 | 全用 `(factory_id, start_date, end_date)` | **3 不同签名** (`year+month` / `year` / `start_date+end_date`) per Rule 3 |
| PR-B test class | 2 (Structure + Trend Arithmetic) | **4** (Helpers + Metrics + Waterfall + VsActual Arithmetic) |
| LOC 估 | ~700 (PR-A 400 + PR-B 280) | **~1000** (PR-A 500 + PR-B 500) |

### 2.4 与 receivable sister 的差异点（cross-spec audit 校核条目）

| 维度 | receivable (sister chat 平行) | budget (this spec) |
|---|---|---|
| Sub-service 数 | 4 (metrics + agingChart + overdueRanking + trendChart) | 3 (metrics + waterfall + comparison) |
| Java 端独立 sub-method | `getReceivableMetrics(factoryId, date)` + 3 chart 函数 | 3 函数各自 (per F1 不同 scope) |
| Defensive `.abs()` | TBD (sister chat 决定) | 无 (F2 raw mirror) |

receivable spec drafting 期间未发布到 main；本 spec 写完后 Round 3 cross-spec audit 用 git fetch + branch 比对 (sister branch: `phase2a/t-finance-receivable`).

---

## 3. Java 引用 + 算法对照

### 3.1 Java reference 位置

| 函数 | 文件 + 行 |
|---|---|
| Controller dispatch | `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:258-263` |
| `getBudgetMetrics(factoryId, int year, int month)` | `FinanceAnalysisServiceImpl.java:1031-1116` |
| `getBudgetExecutionWaterfall(factoryId, int year)` | `FinanceAnalysisServiceImpl.java:923-979` |
| `getBudgetVsActualChart(factoryId, LocalDate start, LocalDate end)` | `FinanceAnalysisServiceImpl.java:982-1028` |
| `createWaterfallItem(name, value, type)` private helper | `FinanceAnalysisServiceImpl.java:1579-1585` |
| `determineBudgetAlertLevel(executionRate)` private helper | `FinanceAnalysisServiceImpl.java:1649-1654` |
| `determineAlertLevel(BUDGET_VARIANCE_RATE, value)` 跨 service | `MetricCalculatorServiceImpl.java:515-519` |
| Constants `BUDGET_EXECUTION_RED/YELLOW_THRESHOLD` | `FinanceAnalysisServiceImpl.java:106-107` |
| Constants `BUDGET_EXECUTION/VARIANCE/VARIANCE_RATE/REMAINING` | `MetricCalculatorService.java:73-76` |

### 3.2 Date-scope 矩阵（F1 关键）

⚠️ **3 个 sub-service 查询日期范围各不相同**，这是 Java parity 行为，端到端 byte parity 必须 mirror：

| Sub-service | 查询范围 | 来源 |
|---|---|---|
| `metrics` | **仅 endDate 所在月** (`year=endDate.year, month=endDate.month` → `[YearMonth.atDay(1), YearMonth.atEndOfMonth()]`) | Java FinanceAnalysisServiceImpl.java:1034-1036 |
| `waterfall` | **整 calendar year** (`[year-01-01, year-12-31]`) | Java FinanceAnalysisServiceImpl.java:926-927 |
| `comparison` | **dispatcher 完整范围** (`[start_date, end_date]`) | Java Controller line 263 直接传入 |

> **Note (端到端契约公示)**: 用户请求 `dateRange=[startDate, endDate]`，但 budget per-type 内部 metrics/waterfall/comparison 各自查询不同范围 — 这是 Java 行为，端到端 byte parity 必须 mirror。前端在 budget tab 展示数据时应注意：
>   - metrics KPI 反映 endDate 所在月单月汇总
>   - waterfall 瀑布图覆盖 endDate 所在年的全 12 月
>   - comparison 柱图反映 user 请求的完整 dateRange

例如 `startDate=2025-01-01, endDate=2025-06-30`：
- `metrics.range` = `[2025-06-01, 2025-06-30]`
- `waterfall.range` = `[2025-01-01, 2025-12-31]`
- `comparison.range` = `[2025-01-01, 2025-06-30]`

### 3.3 `_get_budget_metrics` 算法（1:1 mirror Java line 1031-1116）

**Signature**: `async def _get_budget_metrics(factory_id: str, year: int, month: int) -> list[dict]`

**Algorithm**:
1. Compute `start_date = date(year, month, 1)`, `end_date = date(year, month, calendar.monthrange(year, month)[1])`.
2. `budget_data = await _query_finance_data(factory_id, "BUDGET", start_date, end_date)` (existing shared helper at line 1238-1278; explicit columns include `budget_amount`/`actual_amount`/`category` needed here — see §2.2.2 CC1 note).
3. Compute `total_budget = sum(_to_decimal(r["budget_amount"]) for r in budget_data if r.get("budget_amount") is not None)` per Rule 1 (`is not None`，**不是 truthy** — `Decimal("0")` 必须 inclusive).
4. Compute `total_actual = sum(_to_decimal(r["actual_amount"]) for r in budget_data if r.get("actual_amount") is not None)`.
5. Build 4 `MetricResult` dicts (LinkedHashMap put-order, mirror Java `MetricResult.builder()`):
   - **BUDGET_EXECUTION** (line 1054-1071):
     - `executionRate_raw = (total_actual / total_budget).quantize(Decimal("0.0001"), HALF_UP) * Decimal("100")` if `total_budget > 0` else `Decimal("0")` — **two-stage Decimal arithmetic** mirror Java `divide(total, SCALE=4, HALF_UP).multiply(100)`.
     - `executionRate_display = executionRate_raw.quantize(Decimal("0.01"), ROUND_HALF_UP)` — Java line 1066 `setScale(DISPLAY_SCALE=2, HALF_UP)`.
     - `alertLevel = _determine_budget_achievement_alert(executionRate_raw)` — **REUSE existing helper** (line 449-464, identical thresholds `>120 RED, >100 YELLOW, else GREEN`). **Pass raw 4-decimal value** for boundary precision (mirrors Java line 1058 which calls `executionRate.doubleValue()` BEFORE `.setScale(2)`).
     - `value = _decimal_to_number(executionRate_display)` (per Rule 4).
     - `formattedValue = f"{executionRate_display}%"` — pass `Decimal` directly into f-string to **preserve trailing zeros** (Java `BigDecimal.toString` semantics: `Decimal("0.00")` → `"0.00"`, `Decimal("33.33")` → `"33.33"`). NOT `_decimal_to_number`'d (would give `"0%"` instead of `"0.00%"`). Mirror profit impl line 957 pattern: `f"{roi.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"`.
     - `unit = "%"`, `description = "实际支出占预算的比例"`.
   - **BUDGET_VARIANCE** (line 1074-1085):
     - `variance = total_actual - total_budget`.
     - `alertLevel = "YELLOW"` if `variance > Decimal("0")` else `"GREEN"` (sign-based, no helper needed). **Note**: Java line 1081 inlines this ternary directly — does NOT route through `metricCalculatorService.determineAlertLevel(BUDGET_VARIANCE, ...)` even though that switch case exists. The inlined ternary is the source of truth; Python mirrors verbatim (no dispatcher misdirection).
     - `value = _decimal_to_number(variance.quantize(Decimal("0.01"), HALF_UP))`.
     - `formattedValue = _format_currency(variance)` (per Java line 1079，thousands separator format).
     - `unit = "元"`, `description = "实际支出与预算的差额"`.
   - **BUDGET_VARIANCE_RATE** (line 1088-1099):
     - `varianceRate_raw = (variance / total_budget).quantize(Decimal("0.0001"), HALF_UP) * Decimal("100")` if `total_budget > 0` else `Decimal("0")` — two-stage same as executionRate.
     - `varianceRate_display = varianceRate_raw.quantize(Decimal("0.01"), ROUND_HALF_UP)` — Java line 1094 `setScale(DISPLAY_SCALE, HALF_UP)`.
     - `alertLevel = _determine_budget_variance_rate_alert(varianceRate_raw)` — `abs>20 RED, abs>10 YELLOW, else GREEN`. Pass raw value (mirrors Java MetricCalculatorServiceImpl line 515 `Math.abs(v)` where `v = value.doubleValue()` from raw input).
     - `value = _decimal_to_number(varianceRate_display)`.
     - `formattedValue = f"{varianceRate_display}%"` — same trailing-zeros preservation pattern as BUDGET_EXECUTION above.
     - `unit = "%"`, `description = "预算差异占预算的比例"`.
   - **BUDGET_REMAINING** (line 1102-1113):
     - `remaining = total_budget - total_actual`.
     - `alertLevel = "GREEN"` if `remaining >= Decimal("0")` else `"RED"` (sign-based, **note `>=`** — equality is GREEN per Java line 1109).
     - `value = _decimal_to_number(remaining.quantize(Decimal("0.01"), HALF_UP))`.
     - `formattedValue = _format_currency(remaining)`.
     - `unit = "元"`, `description = "剩余可用预算额度"`.

**MetricResult dict shape** — **11 fields per Java DTO** `MetricResult.java:24-92` (`@Data` Lombok ⇒ all non-static fields serialize). Field order = Java declaration order (mirrors what existing F999 receivable/profit goldens emit):

```python
{
    "metricCode":        str,                # "BUDGET_EXECUTION" | "BUDGET_VARIANCE" | "BUDGET_VARIANCE_RATE" | "BUDGET_REMAINING"
    "metricName":        str,                # "预算执行率" | "预算差异" | "预算偏差率" | "预算剩余"
    "value":             int | float,        # _decimal_to_number-converted
    "formattedValue":    str,                # "{n.nn}%" (Decimal direct) or _format_currency(...)
    "unit":              str,                # "%" | "元"
    "changePercent":     None,               # Lombok @Data null default; budget per-type doesn't compute YoY/MoM
    "changeDirection":   None,               # null per Java parity (budget metrics don't carry change info)
    "changeValue":       None,               # null per Java parity
    "alertLevel":        str,                # "GREEN" | "YELLOW" | "RED"
    "dimensionValue":    None,               # null per Java parity (budget metrics aren't dimensioned)
    "description":       str,
}
```

Recommended: define a `_new_budget_metric_dict(...)` factory (mirror existing `_new_kpi_card_dict` line 282-322 + `_new_chart_config_dict` patterns) to enforce 11-field shape per metric — prevents accidentally dropping null fields.

### 3.4 `_get_budget_execution_waterfall` 算法（1:1 mirror Java line 923-979）

**Signature**: `async def _get_budget_execution_waterfall(factory_id: str, year: int) -> dict`

**Algorithm**:
1. `start_date = date(year, 1, 1)`, `end_date = date(year, 12, 31)`.
2. `budget_data = await _query_finance_data(factory_id, "BUDGET", start_date, end_date)`.
3. `annual_budget = sum(_to_decimal(r["budget_amount"]) for r in budget_data if r.get("budget_amount") is not None)`.
4. Aggregate `monthly_actual: dict[int, Decimal] = {}` (TreeMap → sorted dict; key = `record_date.month`, value = sum of actual). Java semantics: `monthly_actual.merge(month, actual, BigDecimal::add)` (line 943). Java line 942: `actual = data.getActualAmount() != null ? data.getActualAmount() : BigDecimal.ZERO` — None becomes 0 (NOT skip, mirrors Java). Java line 941 `data.getRecordDate().getMonthValue()` **NPEs if record_date is null** — Python defensive **skips** (data quality divergence per §8 risks; Phase 3.B/C cleanup).

   Explicit pseudo-code:
   ```python
   monthly_actual: dict[int, Decimal] = {}
   for r in budget_data:
       # Java line 941 NPEs on null record_date — Python defensive skip (Rule 1 is_not_None).
       rec_date = r.get("record_date")
       if rec_date is None:
           continue
       month = rec_date.month
       # Java line 942 null → BigDecimal.ZERO (NOT skip).
       actual = _to_decimal(r["actual_amount"]) if r.get("actual_amount") is not None else Decimal("0")
       monthly_actual[month] = monthly_actual.get(month, Decimal("0")) + actual
   ```

   **IC1 cross-spec divergence note**: Cost's `_aggregate_cost_by_period` (line 248) does **not** defensively skip null `record_date` — it directly accesses `c["record_date"]`, mirroring Java NPE behavior identically. Budget side adds defensive skip here to avoid 500 errors on data quality issues. This is an **intentional one-sided improvement**: if a row has null `record_date` in production, cost endpoint NPEs but budget endpoint partial-results.

   Phase 3.B/C cleanup follow-up should retrofit `_aggregate_cost_by_period` with the same defensive skip for consistency. Tracked as deferred follow-up; do NOT block budget PR-A on cost retrofit.
5. Build `chart_data: list[dict]`:
   - First item: `_create_waterfall_item("年度预算", annual_budget, "total")`.
   - For `month in 1..12`: `actual = monthly_actual.get(month, Decimal("0"))`.
     - **If `actual > Decimal("0")`** (Java line 956 `actual.compareTo(BigDecimal.ZERO) > 0`): append `_create_waterfall_item(f"{month}月", -actual, "decrease")` and decrement `remaining -= actual`.
     - Else skip (months with 0 or negative actual omitted).
   - Last item: `_create_waterfall_item("剩余预算", remaining, "total")`.
6. `options: LinkedHashMap-equivalent dict`:
   ```python
   {"waterfallType": True, "increaseColor": "#91cc75", "decreaseColor": "#ee6666", "totalColor": "#5470c6"}
   ```
7. Return `_new_chart_config_dict` (factory function, reuse from cost/profit):
   - `chart_type = "WATERFALL"`, `title = f"{year}年预算执行瀑布图"`.
   - `xaxis_field = "name"`, `yaxis_field = "value"`.
   - `series_field = None`.
   - `data = chart_data`, `options = options`.

**`_create_waterfall_item` helper body** (mirrors Java line 1579-1585):

```python
def _create_waterfall_item(name: str, value: Decimal, type_: str) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.createWaterfallItem (line 1579-1585).

    LinkedHashMap put-order: [name, value, type].
    value applies setScale(DISPLAY_SCALE=2, HALF_UP) before serialization.
    """
    return {
        "name": name,
        "value": _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "type": type_,
    }
```

Note: `type_` parameter name (with trailing underscore) avoids Python `type` builtin shadowing. JSON output key remains `"type"` per Java parity.

**Edge cases**:
- Empty `budget_data` → `annual_budget = Decimal("0")`, `monthly_actual = {}`, `chart_data = [年度预算 0, 剩余预算 0]` (2 items).
- All 12 months had actuals → `chart_data` 长度 = 14 (1 total + 12 decrease + 1 total).
- Some months missing → length varies between 2 and 14.

### 3.5 `_get_budget_vs_actual_chart` 算法（1:1 mirror Java line 982-1028）

**Signature**: `async def _get_budget_vs_actual_chart(factory_id: str, start_date: date, end_date: date) -> dict`

**Algorithm**:
1. `budget_data = await _query_finance_data(factory_id, "BUDGET", start_date, end_date)`.
2. Aggregate per-category: `category_data: dict[str, list[Decimal]]` (LinkedHashMap → Python dict 3.7+ insertion order). Key = `r["category"]` if not None else `"其他"` (Java line 991). Value = `[budget_sum, actual_sum]` (length-2 list, init `[Decimal("0"), Decimal("0")]`).
3. For each row: `budget_amount = _to_decimal(r["budget_amount"]) if r.get("budget_amount") is not None else Decimal("0")` (Java line 993 `data.getBudgetAmount() != null ? ... : BigDecimal.ZERO`); same for actual_amount; accumulate into `category_data[category][0]` and `[1]`.
4. Build `chart_data` (LinkedHashMap put-order):
   ```python
   {
       "category": category,
       "budget": _decimal_to_number(values[0]),       # raw, NO setScale per Java line 1002
       "actual": _decimal_to_number(values[1]),       # raw
       "variance": _decimal_to_number(values[1] - values[0]),  # raw
       "executionRate": _decimal_to_number(executionRate),     # 2-stage scale
       "alertLevel": _determine_budget_achievement_alert(executionRate),  # REUSE existing helper (CC2 fix)
   }
   ```
   `executionRate = (values[1] / values[0]).quantize(Decimal("0.0001"), HALF_UP) * Decimal("100")` if `values[0] > 0` else `Decimal("0")` — **NO final `setScale(DISPLAY_SCALE=2)` here** (mirrors Java line 1005-1007 which only does `divide(SCALE=4).multiply(100)`, no setScale).
   - **Note (cost-style I-1 fix mirror)**: Java line 1001-1004 emits `budget`/`actual`/`variance` raw (no setScale), only `executionRate` uses SCALE=4 from divide. DB columns precision=15 scale=2，accumulator preserves scale 2 naturally. **No extra quantize on those 3 fields**.
   - Jackson serializes `Decimal("33.3300")` (4-decimal scale) as `33.33` (trailing-zeros stripped in JSON output). `_decimal_to_number(Decimal("33.3300"))` → `float(33.33)` → JSON `33.33`. Byte parity holds via `_decimal_to_number`.
   - Pass raw `executionRate` (4-decimal precision) into `_determine_budget_achievement_alert(executionRate)` (REUSED helper line 449-464) to match Java line 1009 which calls helper before any setScale (boundary precision matters for rates near 100.00 or 120.00).
5. `options: dict` (LinkedHashMap put-order for outer, Map.of(2) hash order for series items per Rule 8):
   ```python
   {
       "groupedBar": True,
       "series": [
           {"color": "#5470c6", "name": "预算"},   # Map.of(2) hash order: [color, name], NOT param order
           {"color": "#91cc75", "name": "实际"},   # verified via F999 golden line 13-20 + F001 golden line 13-20
       ],
   }
   ```
   **Rule 8 caveat**: Java line 1015-1018 source code `Map.of("name", X, "color", Y)` reads `[name, color]` order, **but Jackson serializes Map.of(2) by hash, NOT param order**. Recorded F999/F001 goldens both show `{"color": ..., "name": ...}`. Python literal MUST mirror the recorded order.
6. Return `_new_chart_config_dict`:
   - `chart_type = "BAR"`, `title = "预算 vs 实际对比"`.
   - `xaxis_field = "category"`, `yaxis_field = "budget"`.
   - `series_field = None`.

### 3.6 `_get_budget_analysis` per-type assembler (Java Controller line 258-263)

**Signature**: `async def _get_budget_analysis(factory_id: str, start_date: date, end_date: date) -> dict`

**Algorithm**:
1. `year = end_date.year`, `month = end_date.month` (1:1 mirror Java line 259-260).
2. Concurrent fetch (3 awaits, can use `asyncio.gather` if helpful for performance; sequential也可，cost 用 sequential):
   ```python
   metrics    = await _get_budget_metrics(factory_id, year, month)
   waterfall  = await _get_budget_execution_waterfall(factory_id, year)
   comparison = await _get_budget_vs_actual_chart(factory_id, start_date, end_date)
   ```
3. Return 5-key dict. **Jackson HashMap-hash order verified via 2026-05-02 golden recording** — Java Controller `result = new HashMap<>()` 是 unordered，put-order 是 `[startDate, endDate, metrics, waterfall, comparison]`，**but Jackson 实际序列化按 hash 顺序为 `[comparison, endDate, waterfall, metrics, startDate]`** (recorded F999 golden line 4-107, F001 golden identical due to test-env empty data).

```python
return {
    # Verified Jackson hash order from F999/F001 budget goldens (2026-05-02 recording)
    "comparison": comparison,
    "endDate":    end_date.isoformat(),
    "waterfall":  waterfall,
    "metrics":    metrics,
    "startDate":  start_date.isoformat(),
}
```

**Goldens recorded** at:
- `tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget.json` (test env 10011)
- `tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget.json` (test env 10011 — prod 10010 systemd inactive at recording time, deferred F001-prod re-recording for post-deploy smoke per §5.4)

### 3.7 Helper 命名 + 复用决策（F3 解释 — spec 显式条款）

**1 reused + 1 new** alert helper 配置:

| Helper | 状态 | 阈值规则 | 调用点 |
|---|---|---|---|
| `_determine_budget_achievement_alert(rate)` | **REUSE** existing line 449-464 | `>120 RED, >100 YELLOW, else GREEN` (单边) | BUDGET_EXECUTION metric + comparison chart per-category |
| `_determine_budget_variance_rate_alert(rate)` | **NEW** | `abs>20 RED, abs>10 YELLOW, else GREEN` (双边) | BUDGET_VARIANCE_RATE metric only |

**Java 重复 vs Python collapse**：
- Java side：
  - `FinanceAnalysisServiceImpl.determineBudgetAlertLevel(executionRate)` line 1649-1654 — `>120 RED, >100 YELLOW, else GREEN` (用于 budget per-type)
  - `FinanceAnalysisServiceImpl.determineBudgetAchievementAlertLevel(achievementRate)` line 1794-1799 — **byte-identical 阈值** (用于 budget-achievement sub-endpoint)
  - `MetricCalculatorServiceImpl.determineAlertLevel(metricCode, value)` switch — `BUDGET_VARIANCE_RATE` case (line 515-519): `abs(v) > 20 RED, abs(v) > 10 YELLOW, else GREEN`
- Java 因为 service 分层有 2 份重复 code (line 1649 vs 1794)；Python 已经在 PR #32 (`ccdeb4b1b`) 落地 `_determine_budget_achievement_alert` 时 collapse 成 1 个，本 spec 直接 reuse。
- 跨 service 调用 (`metricCalculatorService.determineAlertLevel(BUDGET_VARIANCE_RATE, ...)`) 阈值语义不同 (`abs(v) >` vs `v >`)，**绝不合并**为单一 helper —— 合并会引入 polymorphism + dispatch logic = bug 温床。
- Python 端 `_determine_budget_variance_rate_alert` 命名前缀消岐义因 Java 是跨 service 调用 — Python 没有 service 边界，函数名必须自带 disambiguation。

**Tech debt note**: `_determine_budget_achievement_alert` 名字 slightly misleading 当用于 budget per-type execution rate (语义是 "execution" 不是 "achievement")。Phase 3 cleanup chat 可以 rename 到中性名 `_determine_budget_threshold_alert` 同步更新 sister branch。本 spec 不动以避免 sister branch 冲突。

### 3.8 路由 handler 增加分支

```python
# backend/python/smartbi_compat/api/analysis_finance.py route handler line 1535+ 后追加：
if analysisType == "budget":
    result = await _get_budget_analysis(auth.factory_id, startDate, endDate)
    return wrap_response(result)

# 其余分支保持 (profit / cost / payable 已有，receivable 仍 501)。
# 501 default branch message 不变；它是 fallback 没具体列 type。
```

既有 501 fallback (line 1543-1548) 不需修改 — message 是动态字符串 (`f"analysisType={analysisType} 尚未 port..."`)，不硬编码 type list。

---

## 4. F999 byte-shape gate

### 4.1 Budget per-type 期望响应（pre-record fixture 设计）

F999 是空数据 factory，所有 budget 查询返回空集，所以 sub-service 输出全是 "empty state shape"。

**Recorded goldens (truth source)**: Both F999 + F001 golden fixtures recorded 2026-05-02 from test env Java 10011. F001 prod re-recording deferred (10010 systemd inactive at recording time). Goldens at:
- `tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget.json` (113 lines)
- `tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget.json` (113 lines, identical to F999 due to test-env empty data)

**Verified Jackson key orders** (impl MUST mirror these exactly per Rule 8):

```
Outer envelope (LinkedHashMap-style ApiResponse):
  [code, message, data, timestamp, success, actionHint, severity, hintTarget]

Inner data dispatcher (5-key Jackson HashMap-hash order):
  [comparison, endDate, waterfall, metrics, startDate]

ChartConfig DTO (Lombok @Data declaration order, used by waterfall + comparison):
  [chartType, title, seriesField, data, options, xaxisField, yaxisField]

MetricResult DTO (Lombok @Data declaration order, 11 fields):
  [metricCode, metricName, value, formattedValue, unit,
   changePercent, changeDirection, changeValue, alertLevel,
   dimensionValue, description]

waterfall.data items (LinkedHashMap put-order from createWaterfallItem):
  [name, value, type]

waterfall.options (LinkedHashMap put-order):
  [waterfallType, increaseColor, decreaseColor, totalColor]

comparison.options (LinkedHashMap put-order):
  [groupedBar, series]

comparison.options.series[i] Map.of(2) (Rule 8 hash order — NOT param order):
  [color, name]   ← Java source `Map.of("name", X, "color", Y)` 但 Jackson 输出 [color, name]

comparison.data items (when non-empty, LinkedHashMap put-order):
  [category, budget, actual, variance, executionRate, alertLevel]
```

**Numeric byte-shape note**: All `value` fields output as `0.0` (float, not int) for empty data. Python `_decimal_to_number(Decimal("0.00"))` returns `int(0)` → JSON `0`. dict-eq compares `0.0 == 0` → True. Per Rule 4, this is acceptable under dict-eq gate. strict-byte gate would surface this divergence (Phase 2A backlog).

**Volatile keys to strip on compare** (MC1 fix): Per-type goldens contain only `timestamp` as volatile (no `generatedAt`/`lastUpdated` keys exist in per-type response). The shared `_strip_volatile()` helper (analysis_finance.py:1075-1099) strips all 4 volatile keys (`generatedAt`, `lastUpdated`, `cacheExpireAt`, `timestamp`) uniformly — it's a **no-op on absent keys**, so existing helper reuses cleanly without per-type branching.

### 4.2 Composite path

Composite 6-key DashboardResponse 不包含 budget — **本 PR 不动 composite path**。F999 composite golden 不变。（Verify: cost spec §4.2 verified composite golden 不重录原则 — same here.）

---

## 5. 测试策略

### 5.1 Contract test 类（PR-A）

```python
# tests/python/smartbi_compat/test_analysis_finance_contract.py 追加

class TestAnalysisFinanceBudget:
    """F999 byte-shape gate for budget per-type path."""

    def test_f999_budget_data_keys_match_golden(self, client, monkeypatch):
        # mock _query_finance_data → [] (records 不存在 in F999)
        # assert list(resp.json()['data'].keys()) == golden 实际顺序
        # 例 (TBD post-recording): [endDate, metrics, waterfall, comparison, startDate]
        ...

    def test_f999_budget_byte_shape(self, client, monkeypatch):
        # mock _query_finance_data → []
        # full dict-eq compare against analysis-finance-F999-budget.json (after _strip_volatile)
        ...

    def test_f999_budget_date_scope_matrix(self, client, monkeypatch):
        """F1: verify metrics/waterfall/comparison 各自 date scope correctness.

        Fixture: startDate=2025-01-01, endDate=2025-06-30
        Capture _query_finance_data calls (record_type, start_date, end_date) tuples
        and assert:
          metrics call:    ('BUDGET', date(2025, 6, 1), date(2025, 6, 30))
          waterfall call:  ('BUDGET', date(2025, 1, 1), date(2025, 12, 31))
          comparison call: ('BUDGET', date(2025, 1, 1), date(2025, 6, 30))
        """
        ...

    def test_f999_budget_dispatcher_order_matches_golden(self):
        """Guard test: dispatcher's hardcoded key order must equal golden's recorded order.

        Loads tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget.json,
        extracts list(golden['response']['data'].keys()), compares to dispatcher's
        emit order (introspect from `_get_budget_analysis` test call with all-empty mocks).

        FAILS LOUDLY if golden recorded post-impl shows different order than dispatcher
        placeholder — prevents merging with mismatched dispatcher key order.
        """
        ...
```

**既有 `test_f999_unimplemented_analysisType_returns_501`** 更新：loop 从 `["receivable", "budget"]` 缩到 `["receivable"]` (cost spec §5.1 模式 mirror — sister `phase2a/t-finance-receivable` 之后再缩 `[]`)。

### 5.2 Unit test 类（PR-B）— 4 class，~22 tests (4 helper + 7 metrics + 6 waterfall + 5 vs-actual)

#### `TestBudgetHelpers` — helper-level 直接测试 (~4 tests)

| Test | Branch covered |
|---|---|
| `test_create_waterfall_item_key_order` | `_create_waterfall_item` 返回 `{name, value, type}` LinkedHashMap put-order；value setScale(2, HALF_UP) |
| `test_determine_budget_variance_rate_alert_thresholds_positive` | NEW helper `_determine_budget_variance_rate_alert`: positive rate `>20 RED, >10 YELLOW, else GREEN` |
| `test_determine_budget_variance_rate_alert_thresholds_negative` | NEW helper, abs application: `-25 → RED, -15 → YELLOW, -5 → GREEN` |
| `test_reused_achievement_alert_handles_negative_execution_rate` | REUSED `_determine_budget_achievement_alert` (line 449-464) edge case: negative execution rate (e.g. `-50` from negative actual) → falls through to GREEN. Note: existing helper已被 PR #32 covered budget-achievement 场景；本 test 守住的是 budget per-type **跨场景 reuse 不引入 regression** (negative rate scenario specific to per-type's no-abs() behavior, F2 risk). |

#### `TestBudgetMetricsArithmetic` — 7 tests

| Test | Branch covered |
|---|---|
| `test_empty_budget_data_returns_4_zero_metrics` | empty rows → 4 metrics with value=0, all GREEN |
| `test_total_budget_zero_actual_positive_execution_rate_zero` | budget=0, actual=1000 → executionRate=0 (Java line 1055-1057) |
| `test_execution_rate_two_stage_scale` | budget=300, actual=100 → executionRate = `(100/300).setScale(4) * 100` = `0.3333 * 100 = 33.3300` → setScale(2) = `33.33` |
| `test_variance_positive_yellow_alert` | actual=1500, budget=1000 → variance=500 YELLOW (>0) |
| `test_variance_zero_green_alert` | actual=1000, budget=1000 → variance=0 GREEN (≤0 is GREEN per Java line 1081 `compareTo > 0 ? YELLOW : GREEN`) |
| `test_remaining_negative_red_alert` | actual=1500, budget=1000 → remaining=-500 RED (<0); also covers BUDGET_VARIANCE_RATE: variance=500 / budget=1000 *100 = 50 → abs>20 RED |
| `test_negative_variance_rate_passes_through_alert_helper` | actual=750, budget=1000 → variance=-250, varianceRate = `(-250/1000).quantize(0.0001) * 100` = `-25.0000` → abs(25)>20 → RED. **Sign preserved through two-stage Decimal multiply**; Python `decimal.ROUND_HALF_UP` matches Java `RoundingMode.HALF_UP` (both round away from zero). Defensive against impl bug like `varianceRate = abs(variance) / total_budget * 100` which would silently mask sign. (BUDGET_REMAINING here = 1000-750 = 250 ≥0 → GREEN; BUDGET_VARIANCE = -250 → ≤0 → GREEN.) |

#### `TestBudgetExecutionWaterfallArithmetic` — 6 tests

| Test | Branch covered |
|---|---|
| `test_empty_data_returns_two_total_items` | empty rows → chart_data length=2 (年度预算 0 + 剩余预算 0) |
| `test_full_year_actuals_emit_14_items` | 12 月各有 actual>0 → length=14 (1 total + 12 decrease + 1 total) |
| `test_zero_actual_month_skipped` | 4 月 actual=0 → 该月不出现，length=13 (1 + 11 decrease + 1) |
| `test_negative_actual_month_skipped` | 6 月 actual=-100 → Java `compareTo(0) > 0` false → 跳过，length=13 |
| `test_remaining_decrement_correct` | annual_budget=12000, monthly actuals=1000 each Jan-Mar → 剩余预算 = `12000 - 1000*3 = 9000` |
| `test_null_record_date_row_skipped` | row with `record_date=None` (data quality issue) → row skipped, doesn't NPE. Java NPE divergence (Java would crash, Python returns partial result); Phase 3.B/C cleanup decides if Python should match Java by raising. |

#### `TestBudgetVsActualChartArithmetic` — 5 tests

| Test | Branch covered |
|---|---|
| `test_empty_data_returns_empty_chartdata` | empty rows → data=[] but options 完整 (groupedBar + series 2 entries) |
| `test_per_category_aggregation` | 2 categories → 2 chart items, budget/actual sums correct |
| `test_null_category_falls_to_other` | row.category=None → bucket "其他" |
| `test_execution_rate_alert_per_category` | category A budget=1000 actual=1300 (rate=130, RED), B budget=1000 actual=110 (rate=11, GREEN) |
| `test_zero_budget_category_execution_rate_zero` | budget=0 actual>0 → executionRate=0 (Java line 1005 short-circuit), alertLevel=GREEN (0 < 100) |

### 5.3 Mock pattern (per `python-java-port.md` Rule 5 conventions)

```python
async def fake_query(factory_id, record_type, start, end):
    if record_type == "BUDGET":
        return [
            {
                "budget_amount": Decimal("10000"),
                "actual_amount": Decimal("8500"),
                "category": "原材料采购",
                "record_date": date(2025, 6, 15),
                "upload_id": 1,
            },
        ]
    return []

monkeypatch.setattr(
    "smartbi_compat.api.analysis_finance._query_finance_data",
    fake_query,
)
```

For PR-B 的 helper-level test 直接 import `_create_waterfall_item` / `_determine_budget_achievement_alert` (REUSED) / `_determine_budget_variance_rate_alert` (NEW) 调用 (mirror existing `TestCostHelpers` class shipped in `test_analysis_finance_contract.py:864` from cost PR-B — pattern is **shipped code**, not formally documented in cost spec doc but visible in tests file).

For chart-function-level test 用 `try/finally` 替代 monkeypatch 维持 sister consistency (per profit PR-B + cost PR-B 落地的 `af._query_finance_data = fake; ... finally restore` 模式)。

### 5.4 F001 真窗（不进 CI）

`record-java-golden.sh` 是 **positional CLI** (`<factory_id> <endpoint_path> <output_filename> [--prod]`)，**没有 `--compare` flag**（C2 known issue per memory `project_apr30_cost_pr_a_ship_plus_3_sister_specs.md`）。F001 smoke 改用**手动两步 diff workaround**（cost spec §5.4 模式）：

```bash
# Step 1: re-record F001 budget golden (overwrites stored fixture)
JWT_SECRET=$(ssh root@47.100.235.168 "grep -E '^JWT_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2-") \
  ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=budget' \
    analysis-finance-F001-budget.json --prod

# Step 2: 与 git-checked-in golden diff (前一个录制版本)
git diff -- tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget.json
# 期望: 仅 timestamp 字段变 (volatile); 其它字段 byte-identical 才算 smoke pass.
```

如未来 C2 修了引入 `--compare` flag，本节回归到 cost spec/profit spec 模式（一行命令）。

### 5.5 record-java-golden.sh 录制操作

PR-A 实施前 step 1 必须先录到 golden（dispatcher 实际 key 顺序未知，golden 是 truth source）。CLI **positional，从环境变量读 `JWT_SECRET`**：

```bash
# Record F999 (test env Java 10011，empty data) — JWT_SECRET 来自 server .env.test
JWT_SECRET=$(ssh root@47.100.235.168 "grep -E '^JWT_SECRET=' /www/wwwroot/cretas/.env.test | cut -d= -f2-") \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=budget' \
    analysis-finance-F999-budget.json

# Record F001 (prod env Java 10010，real data — 用于 §5.4 smoke compare) — JWT_SECRET 来自 .env.prod
JWT_SECRET=$(ssh root@47.100.235.168 "grep -E '^JWT_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2-") \
  ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=budget' \
    analysis-finance-F001-budget.json --prod
```

**Note (C2 workaround)**: Script 不接受 `--factory` / `--path` / `--query` / `--out` flag-style — 按位置传 3 args + optional `--prod` 第 4 args (per script 实际 signature: `scripts/record-java-golden.sh:23-26`). `{factoryId}` placeholder 在 endpoint_path 内，script 会自己替换 (line 55).

录完后用 `python3 -c 'import json; print(list(json.load(open("...")).items())[0:5])'` 看 envelope 实际 key 顺序（goldens 有 verb/path/factory/response 包裹层，真正的 budget envelope 在 `.response.data` 下），写进 dispatcher 的 return dict。

---

## 6. Byte gate 语义

参见 profit spec §6 + `.claude/rules/python-java-port.md` Rule 4。当前是 dict-eq gate（`json.load` 后 dict 比较），strict-byte 是 Phase 2A backlog。Sister chats 不应假设 strict-byte 已实现。

`_decimal_to_number` helper 已在 cost PR-A 落地，本 spec 直接复用 — 整数返 `int`，小数返 `float`。

---

## 7. PR 切片 + 顺序

### PR-A — budget foundation

**Title**: `Phase 2A: /analysis/finance budget per-type real impl`

**Scope**:
- §2.1 PR-A 文件清单
- §3.3 `_get_budget_metrics` real impl + 4 metrics
- §3.4 `_get_budget_execution_waterfall` real impl
- §3.5 `_get_budget_vs_actual_chart` real impl
- §3.6 `_get_budget_analysis` per-type assembler
- §3.7 2 alert helpers
- §3.8 路由 dispatch
- §5.1 `TestAnalysisFinanceBudget` (3 tests: 2 byte-gate + 1 date-scope)
- §5.5 F999 + F001 goldens recorded

**LOC 预估**: ~500 (impl 350 + tests 80 + golden 50 + route 20)

**CI gate**: pytest baseline+3 通过

**依赖**: cost PR-A merged (`d6b48738a`) 提供 `_query_finance_data` + `_decimal_to_number` + `_format_currency`. C1 fix merged (`8031f2644`) 提供 Rule 2 compliance.

### PR-B — budget arithmetic depth

**Title**: `Phase 2A: /analysis/finance budget metrics + waterfall + comparison arithmetic depth tests`

**Scope**:
- §5.2 `TestBudgetHelpers` (~5 tests)
- §5.2 `TestBudgetMetricsArithmetic` (~6 tests)
- §5.2 `TestBudgetExecutionWaterfallArithmetic` (~5 tests)
- §5.2 `TestBudgetVsActualChartArithmetic` (~5 tests)

**LOC 预估**: ~500 (tests only)

**CI gate**: PR-A baseline + 22 通过

📌 **Escape hatch (F4)**: 如 PR-B 实施阶段发现某 sub-service (例如 waterfall 12 月 iteration) 出现未预期的 edge case 爆炸，**允许** soft 拆分为 PR-B1 (Helpers + Metrics) + PR-B2 (Waterfall + VsActual)，但**不要 pre-commit** 这个拆分。spec §7 仅承诺单 PR-B；soft split 决策延到 plan 阶段，按 plan 时实际 task scope 评估。

### 顺序

```
1. spec doc commit + reviewer audit + push（本 step）
2. user 审 spec + cross-spec audit (sister chat receivable spec) → OK
3. wait for sister receivable spec merge to main (or align via worktree fetch)
4. ⚠️ pre-rebase signature freeze 验证：
   git fetch origin
   grep -A 3 "async def _query_finance_data" backend/python/smartbi_compat/api/analysis_finance.py
   # 期望签名: async def _query_finance_data(factory_id: str, record_type: str,
   #                                         start_date: date, end_date: date) -> list[dict]
5. ⚠️ I-7 verify record-java-golden.sh CLI (per cost spec §5.4) — confirmed C2 known issue (positional CLI), §5.4/§5.5 已用 workaround
6. ⚠️ **HARD PREREQUISITE — IC3**: record F999 + F001 budget goldens BEFORE plan写作 — Jackson HashMap-hash key 顺序未定，dispatcher 必须按 golden 实际顺序写。Sister specs (cost/profit) 都在 spec 阶段就把实际录到的 key 顺序 baked-in §3.6 dispatcher (cost: `[endDate, trendChart, startDate, structureChart]`; profit: `[endDate, metrics, trendChart, startDate]`). 本 spec 现 §3.6 line ~340 是 placeholder — PR-A plan 写出之前必须录 F999 → 改 §3.6 dispatcher 实际 key 顺序 → 再过一遍 self-review on §3.6 + §4.1 (一轮 quick check, 不需重跑全 4-cycle audit) 才能继续。
7. writing-plans 出 PR-A plan
8. subagent-driven-development 执行 PR-A → push → PR → squash merge --admin
9. pull main → writing-plans 出 PR-B plan
10. subagent-driven-development 执行 PR-B → push → PR → squash merge --admin
11. cleanup worktree
```

---

## 8. Open risks + mitigations

| 风险 | Mitigation |
|---|---|
| **F2 — Negative budget/actual rows accumulate raw (no `.abs()` defensive)** | 这是 **Java line 933 + 1044 raw accumulation** — Python 1:1 mirror per Rule 3. 未来 cleanup chat 评估 Java side 是否需要修 (per Phase 3.B/C roadmap)。**不要 in port 时 paper over** — Rule 3 红线，会破 byte parity。 |
| Sister receivable spec drafting 期间签名变 | spec 仅 doc-only，不动 impl；rebase 时 sister merged to main 后再校核。Wave 1 双胞胎并行 spec 是接受的（impl 阶段才物理冲突）。 |
| Composite path 升级副作用 | composite 不依赖 budget stub (§1.4 verified)，PR-A merge 后 composite 0 变化。 |
| `record-java-golden.sh` C2 CLI bug | 用 cost spec §5.4 manual two-step diff workaround；spec §5.4 + §5.5 已注明。 |
| Jackson HashMap-hash key 顺序 vs put-order | F999 golden 录制后才能锁；dispatcher return 顺序 = golden 实际顺序 (per cost/profit 经验：endDate / startDate 在中间，sub-service keys 散布)。 |
| Sister chats 复制本 spec 漏 abs() defensive | 本 spec §2.3 + §8 表格显式列 budget vs cost 差异；reviewer audit 在 cross-spec cycle 检查 sister specs 是否自己漏 abs() 或错加 abs()。 |
| ~~I2 — Sister `phase2a/finance-sub-endpoints` worktree edits same file~~ **RESOLVED**: PR #32 (`ccdeb4b1b`) already merged to main when this spec drafted. `import calendar` + `_determine_budget_achievement_alert` 已在 main，本 spec rebase 时已自动 inherit。无 race condition，无 line-level 冲突，直接 reuse。 |
| `_format_currency` formattedValue mismatch | Java line 1079 用 `formatCurrency(BigDecimal)` (DecimalFormat #,##0.00) — Python 已有 `_format_currency` (cost PR-A)，复用。 |
| F1 — 3 sub-service date scope 不一致引发前端误用 | spec §3.2 矩阵 + §5.1 `test_f999_budget_date_scope_matrix` contract test 守住；前端 release notes 要点提及。 |
| **C3 — `executionRate` scale-4 retention vs Jackson default (comparison chart only)** | Java `getBudgetVsActualChart` line 1005-1008 emits `executionRate` 为 `divide(SCALE=4).multiply(100)` 4-decimal scale (e.g. `Decimal("33.3300")`)，**未 setScale(2)**。Jackson 实际序列化是否保留 trailing zeros 不确定 (`33.33` 还是 `33.3300`)。F999 全是 `Decimal("0")` integral，**测不出来**；只能在 F001 录到非零数据时验证。**Mitigation**: PR-A 实施 step 1 录 F999 后，**额外录一个 F001 mid-impl 取小样本验证 executionRate 的 JSON 数字位数**。如发现 Java 输出 `33.3300` (4-decimal preserved)，Python 必须改用 `Decimal` 序列化器或者 string output；如 Java 输出 `33.33` (Jackson 默认 strip)，Python 现 `_decimal_to_number` 路径直接 OK。Spec §3.5 默认假设 strip 行为；assumption breaks → §8 follow-up。 |

---

## 9. References

- Sister spec (foundation): `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`
- Sister spec (payable PR #18): merged `b058a0bc3`
- Sister spec (profit, merged): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md` (merged via PR #21)
- Sister spec (cost, merged): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md` (merged via PR #25)
- **Sister spec (receivable, parallel Wave 1 twin)**: `phase2a/t-finance-receivable` branch (worktree `.worktrees/phase2a-finance-receivable`) — cross-spec audit cycle reconciles
- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
- Existing F999 budget golden: NONE (本 spec PR-A step 1 录制)
- Live Java backend: `47.100.235.168:10011` (test env F999) + `47.100.235.168:10010` (prod F001)
- **Audit constraints inherited from**: `.claude/rules/python-java-port.md`
- Phase 2A backlog map: `docs/superpowers/specs/2026-05-01-phase2a-remaining-endpoints-backlog.md` (PR #31 `aa6741c53`)
