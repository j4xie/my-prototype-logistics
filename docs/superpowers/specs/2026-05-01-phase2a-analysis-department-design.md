# Phase 2A `/analysis/department` composite real impl — Design Spec

**Date**: 2026-05-01
**Branch**: `phase2a/spec-department`
**Worktree**: 主 (this is spec-only, impl chat 启动时再开 worktree)

**Predecessors**:
- PR #13 — finance foundation + composite (`4dc4f2e3d`)
- PR #14 — sales foundation + alerts (4 alert generators)
- PR #18 — finance payable per-type real impl
- PR #21 + #22 — finance profit per-type + sales fallback
- PR #25 + #28 — finance cost per-type + arithmetic depth tests
- **PR #30 — `_get_period_key` WEEK calendar-year fix** (commit `8031f2644`, Rule 2 compliance) — 本 spec 直接 import, 不重复定义
- PR #31 — Phase 2A 剩余 endpoints backlog map
- 🚧 PR #35 (mergeable, awaiting admin merge) — Rule 8 入 `python-java-port.md` (`Map.of(N)` Jackson hash order)。本 spec 当前**经验性引用** sister specs (receivable line 677 / sales-rankings line 363 / alerts line 35)；PR #35 merge 后 polish §3.7 / §8 / §9 cite Rule 8。

**Sister chats unblocked by this spec**:
- `phase2a/t-region` — region composite analysis (similar 4 sub-service shape)
- `phase2a/t-quality` — quality composite analysis
- `phase2a/t-procurement` — procurement composite analysis
- (其余 Tier 2 域参见 backlog map)

**Inherited audit constraints**:
- 全部参见 [`.claude/rules/python-java-port.md`](../../../.claude/rules/python-java-port.md) Rule 1-7
- Rule 8 待 PR #35 merge 后引用

**Audit history**:
- Round 1 self-review + Round 2 evidence-based lock-in (T1/T2/T3 grep verify)
- Round 3 reviewer audit (this iteration) — 4 critical / 7 important / 3 minor + 7 Rule gaps, ALL baked into §3-§9
- Round 4 fresh subagent audit (post-spec-write, before push)

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main HEAD `aa6741c53`）

`/api/mobile/{factoryId}/smart-bi/analysis/department` 在 Python 端**无 path handler** (`backend/python/smartbi_compat/api/analysis.py` 仅有 `_query_department_data` + `_generate_department_alerts` 给 `/alerts` endpoint 用，**不**覆盖 composite analysis path)。

Java 端：
- Controller `SmartBIAnalysisController.getDepartmentAnalysis` (`SmartBIAnalysisController.java:142-177`) 在 prod 永远走 composite 分支 (line 153-156: `if (smartBIService != null) { result = smartBIService.getComprehensiveAnalysis(factoryId, startDate, endDate, "department"); return ... }`)
- `SmartBIServiceImpl @Service` 注解 (`SmartBIServiceImpl.java:69`) **无任何 @ConditionalOnXxx / @Profile 限制**，在 prod 一定被注入 → `if (smartBIService != null)` 永远 true
- Composite 实现 (`SmartBIServiceImpl.java:586-591` "department" case + line 612-613 envelope) 调 4 sub-services + dateRange + generatedAt
- Controller line 158-176 direct path (with/without `department` filter) **在 prod 不可达 = dead code**

### 1.2 这一 chat 范围

实施 **department composite real impl**，2 个 PR 顺序合 main：

**PR-A — department foundation**:
- 新文件 `backend/python/smartbi_compat/api/analysis_department.py`
- 4 sub-services real impl: `_get_department_ranking` / `_get_department_completion_rates` / `_get_department_efficiency_matrix` / `_get_department_trend_comparison`
- 2 SQL helpers: `_query_department_full` (SELECT * `smart_bi_department_data`) + `_query_department_daily_trend` (aggregation mirror `findDepartmentDailyTrend`)
- Composite assembler `_get_department_analysis` + envelope (dateRange + generatedAt)
- Empty chart helper `_create_empty_chart` (含 I5 fix: emit `null` 字段 mirror Jackson default)
- 路由分支 `GET /api/mobile/{factoryId}/smart-bi/analysis/department` 注册到 FastAPI router；`department` query param 接受但 **IGNORED** (mirror Java prod composite)
- F999 byte-shape gate 新增（含 `_strip_volatile` strip `data.generatedAt`）
- F999 golden record 后 update placeholder + composite assembler dict literal 真实顺序

**PR-B — department arithmetic depth**:
- `_aggregate_department_data` MAX headcount 边界（C1 wording lock）
- `_calculate_completion_rate` divide-by-zero 边界（C4 fix）
- `_determine_target_completion_alert` 60/85 阈值边界（T1 lock）
- `_determine_quadrant` 4 象限边界 + per-point recompute byte-equal vs single-pass test（C3 lock）
- `_query_department_daily_trend` SQL 同日多 dept 顺序未指定（I4 verify）
- `_get_period_key` WEEK Rule 2 (post-PR #30) regression test
- Map.of SALT flip detection（PR-B 录 golden 3-5 次跨 Java backend restart）

### 1.3 显式不在范围（dead code in prod, Java 验证）

- `?department={name}` filter detail mode (`DepartmentAnalysisServiceImpl.java:113-156` `getDepartmentDetail`, returns `DashboardResponse` with `kpiCards` / `charts` / `rankings` / `lastUpdated`) — Controller line 162-170 path 在 prod 永远不可达（line 153-156 composite always returns first）
- `getDepartmentHeadcountChart` / `getDepartmentShareTrend` — Java interface 定义但 Controller `/analysis/department` 不调（其他 endpoint 也未引用）
- T6 nginx cutover (独立 phase)
- AI insights / Tool-Skill 路由 (永久留 Java per `project_apr30_tool_skill_stays_java.md`)
- Byte gate 升级 strict-byte (Phase 2A backlog)
- F002 / F001 真窗 contract test（用 `record-java-golden.sh --compare` post-deploy smoke 替代）

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
PR-A:
  tests/fixtures/java-smartbi-golden/
    └─ analysis-department-F999.json                                [NEW via record-java-golden.sh]
       期望 shape (HashMap put-order placeholder; Jackson 实际可能不同 — 录后再确定):
       data.{ranking[], completionRates[], efficiencyMatrix{}, trendComparison{}, dateRange{}, generatedAt}

  backend/python/smartbi_compat/api/analysis_department.py          [NEW]
    + analysis_department_router (FastAPI APIRouter)
    + GET /api/mobile/{factoryId}/smart-bi/analysis/department endpoint handler
    + _get_department_analysis()                  composite assembler (mirror SmartBIServiceImpl:586-591 + envelope 612-613)
    + _get_department_ranking()                   sub-service 1 (mirror DeptImpl:64-108)
    + _get_department_completion_rates()          sub-service 2 (mirror DeptImpl:161-201)
    + _get_department_efficiency_matrix()         sub-service 3 (mirror DeptImpl:206-283, C3 per-point recompute lock)
    + _get_department_trend_comparison()          sub-service 4 (mirror DeptImpl:354-416)
    + _aggregate_department_data()                helper (running MAX for headcount, sum for amounts) — C1 + I3 fix
    + _calculate_completion_rate()                helper (C4 fix: is None or == Decimal("0"))
    + _determine_target_completion_alert()        helper (T1 fix: inline 60/85 const, NOT alert_thresholds.py)
    + _determine_quadrant()                       helper (C3 lock: per-point recompute, DO NOT optimize)
    + _create_empty_chart()                       helper (I5 fix: emit null fields per Jackson default)
    + _query_department_full()                    SQL helper (C2 fix: ORDER BY id) — I6 rename from _query_department_data_records
    + _query_department_daily_trend()             SQL helper (I4 fix: verbatim ORDER BY order_date only)
    + _build_date_range()                         DateRange.custom mirror (DateRange.java:266-274)
    + _DEPARTMENT_TARGET_COMPLETION_RED/_YELLOW   Decimal const (60/85 inline)
    + _SCALE / _DISPLAY_SCALE / _QUANTIZE_HALF_UP local const (4 / 2 / ROUND_HALF_UP)

  backend/python/main.py (or wherever analysis routers registered)  [EDIT]
    + register analysis_department_router (mirror analysis_finance_router / analysis_sales_router pattern)

  tests/python/smartbi_compat/test_analysis_department_contract.py  [NEW]
    + class TestAnalysisDepartmentComposite (3 contract tests)

PR-B:
  tests/python/smartbi_compat/test_analysis_department_contract.py  [EDIT]
    + class TestDepartmentRankingArithmetic           (4 tests)
    + class TestDepartmentCompletionRatesArithmetic   (3 tests)
    + class TestDepartmentEfficiencyMatrixArithmetic  (6 tests)
    + class TestDepartmentTrendComparisonArithmetic   (5 tests)
```

### 2.2 关键架构决策

1. **新文件 `analysis_department.py`** — 跟 sister precedent (`analysis_sales.py`, `analysis_finance.py`) 一致，避免 monolith。`analysis.py` 已 large。
2. **不复用 cost spec 的 `_query_finance_data`** — department 查 `smart_bi_department_data`（不同表），必须新建 helper。
3. **不复用 `alert_thresholds.py.department.target_completion=80`** — Java MetricCalculatorImpl:457-461 hardcode 60/85，inline const 防 sister bug。alert_thresholds.json 的 80 是给 `/alerts` endpoint per_capita 阈值用的，**不同概念**。
4. **trendComparison SQL 1:1 mirror Java** `findDepartmentDailyTrend`（含 I4: ORDER BY order_date ONLY）。
5. **Headcount running MAX** — Java-side iteration with `if-greater` check，**NOT SQL `MAX()`**, **NOT latest-by-date**。Java code comment line 560 (`人员数取最新记录`) 误导，actual impl 是 max。
6. **`_strip_volatile` 复用 `analysis_finance.py` import** — `VOLATILE_KEYS` frozenset 已含 `generatedAt`，无需新增。
7. **Top-level dict key 顺序由 F999 golden record 确定** — Java HashMap String-key hashCode deterministic per Java spec，sister specs (cost / profit / payable / receivable) 经验跨 JVM stable，但具体顺序 ≠ Java put-order，必须录后 update Python emit-order。
8. **`Map.of(2)/Map.of(4)` 顺序经验性处理** — Java 9+ `ImmutableCollections.SALT32L` 每 JVM 启动 randomize iteration，跨 backend restart 可能 flip。F999 empty case 不触发；PR-B 非空 case 录 golden 3-5 次跨 Java restart 检测；如 flip detected，标 §8 known shape divergence。

---

## 3. Java 引用 + 4 sub-service 算法

### 3.1 Java reference 表

| 函数 | 位置 | 备注 |
|---|---|---|
| Controller `/analysis/department` | `SmartBIAnalysisController.java:142-177` | line 153-156 prod path 进 composite |
| `getComprehensiveAnalysis` department case | `SmartBIServiceImpl.java:586-591` | result HashMap, period 硬编码 `"WEEK"` (line 590) |
| Composite envelope wrap | 同上, line 612-613 | dateRange + generatedAt put 在 sub-services 之后 |
| `getDepartmentRanking` | `DepartmentAnalysisServiceImpl.java:64-108` | sort by salesAmount desc, calls determineAlertLevel(TARGET_COMPLETION) |
| `getDepartmentCompletionRates` | 同上, 161-201 | sort by completionRate desc, calls determineAlertLevel |
| `getDepartmentEfficiencyMatrix` | 同上, 206-283 | scatter, per-point determineQuadrant **per-point recompute avg** |
| `getDepartmentTrendComparison` | 同上, 354-416 | SQL aggregation `findDepartmentDailyTrend`, multi-dept LINE chart |
| `aggregateDepartmentData` | 同上, 546-567 | LinkedHashMap, **headcount = MAX (running if-greater check, NOT SUM/latest)** |
| `calculateCompletionRate` | 同上, 610-616 | divide-by-zero → `Decimal("0")` |
| `determineQuadrant` | 同上, 621-653 | re-iterate aggregated for avg per call (don't optimize) |
| `getPeriodKey` | 同上, 594-605 | calendar year + ISO week (Rule 2 compliant, post-PR #30) |
| `MetricCalculatorServiceImpl.determineAlertLevel(TARGET_COMPLETION)` | `MetricCalculatorServiceImpl.java:457-461` | **hardcoded 60/85** (NOT alert_thresholds.json 80) |
| `findDepartmentDailyTrend` SQL | `SmartBiSalesDataRepository.java:107-110` | `SELECT order_date, department, SUM(amount) ... GROUP BY order_date, department ORDER BY order_date` |
| `findByFactoryIdAndRecordDateBetween` | `SmartBiDepartmentDataRepository.java:33-35` | **JPA derived query, NO ORDER BY** — Python 必须加 ORDER BY id |
| `ChartConfig` DTO | `ChartConfig.java:32-68` | **无 @JsonInclude 注解** → Jackson default 序列化 null 字段为 `null` (NOT omit) |
| `DateRange.custom` | `DateRange.java:266-274` | 全确定: granularity infer / originalExpression str format / relative=false |
| `SmartBiDepartmentData` entity | `SmartBiDepartmentData.java:37-150` | 含 precomputed `per_capita_sales/cost` 列 — **I3 fix: 必须 ignore** |

### 3.2 Imports（避免重复定义）

```python
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

# Reuse PR #21+#28 落地的 helpers
from smartbi_compat.api.analysis_finance import (
    _get_period_key,         # post-PR #30 calendar-year fix (commit 8031f2644, Rule 2 compliant)
    _strip_volatile,         # already covers "generatedAt" key
    VOLATILE_KEYS,           # frozenset includes generatedAt
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,             # safe Decimal coercion
    _utc_now_iso,            # ISO timestamp for generatedAt (volatile, stripped)
    _fetch_all,              # asyncpg pool wrapper
    wrap_response,           # {success, data, message, code, timestamp} envelope
)

from smartbi_compat.auth import verify_factory_access, AuthContext
```

### 3.3 SQL helpers（含 C2 + I4 + I6 + Rule 5 + Rule 6 fix）

```python
async def _query_department_full(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java SmartBiDepartmentDataRepository.findByFactoryIdAndRecordDateBetween.

    ⚠️ C2 fix: Java JPA derived query has NO ORDER BY (repo line 33-35) → PG row
    order unstable → LinkedHashMap aggregation order non-deterministic →
    tiebreak in ranking / scatter point order in efficiencyMatrix flake.

    Python 加 explicit ORDER BY id 保证 deterministic byte-shape across DB runs.
    Java side recommended same fix (out of Phase 2A scope; Java 端 prod 行为已经
    在用 — 只要 PG instance stable, 行 order in practice stable).

    Rule 5: SELECT * for shared SQL helpers (future-proof for schema additions).
    Caller (`_aggregate_department_data`) MUST IGNORE per_capita_sales /
    per_capita_cost columns (I3 fix: recompute from aggregated salesAmount /
    costAmount / headcount).

    Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_department_full: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    sql = """
        SELECT *
        FROM smart_bi_department_data
        WHERE factory_id = $1
          AND deleted_at IS NULL
          AND record_date BETWEEN $2 AND $3
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, start_date, end_date)


async def _query_department_daily_trend(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java SmartBiSalesDataRepository.findDepartmentDailyTrend (line 107-112).

    Java JPQL (verbatim):
      SELECT s.orderDate, s.department, SUM(s.amount) FROM SmartBiSalesData s
      WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end
      GROUP BY s.orderDate, s.department ORDER BY s.orderDate

    ⚠️ I4 fix: ORDER BY order_date ONLY (NOT order_date, department) — verbatim
    Java semantics. Same-date department iteration order is intentionally
    unspecified per Java behavior. Python 端 NOT 主动加 ORDER BY department
    否则 byte-shape 跟 Java 不一致 (Java 端不同 PG 实例可能给不同 dept 顺序;
    Python 加固定 ORDER BY 反而打破 parity).

    F999 empty 不触发; PR-B test 显式 verify 同日多 dept 顺序未指定 (I4 verify).

    Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_department_daily_trend: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    sql = """
        SELECT order_date, department, SUM(amount) AS total_amount
        FROM smart_bi_sales_data
        WHERE factory_id = $1
          AND deleted_at IS NULL
          AND order_date BETWEEN $2 AND $3
        GROUP BY order_date, department
        ORDER BY order_date
    """
    return await _fetch_all(sql, factory_id, start_date, end_date)
```

### 3.4 `_aggregate_department_data` (含 C1 wording + I3 ignore + Rule 1)

```python
def _aggregate_department_data(
    rows: list[dict],
) -> dict[str, dict]:
    """Mirror Java DepartmentAnalysisServiceImpl.aggregateDepartmentData (line 546-567).

    ⚠️ C1 lock — headcount aggregation = MAX across all records in window per
    department, NOT SUM, NOT latest-by-date. The Java code comment at line 560
    (`人员数取最新记录` "use latest record") is **MISLEADING** — actual impl
    (line 561-562) is `if (data.getHeadcount() > agg.headcount) agg.headcount = ...`,
    initial value 0 (DepartmentAggregation inner class line 842). Effectively MAX
    across records in window.

    Future maintainer reading "use latest" may port wrong (sort-by-date + take-last)
    which produces DIFFERENT result when an older record has higher headcount. DO
    NOT trust the comment; mirror the actual `if-greater` impl.

    ⚠️ I3 lock — SELECT * pulls precomputed `per_capita_sales` + `per_capita_cost`
    columns. This function MUST IGNORE them. Per-capita is recomputed in
    efficiencyMatrix from aggregated salesAmount / costAmount / headcount with
    SCALE=4 HALF_UP (Java line 229-234 重新算, 不读 entity getter).

    ⚠️ Rule 1 lock — All null fields default to `Decimal("0")` via `is None`
    ternary, NOT `or`. Java line 553-558 treats null as ZERO via
    `data.getX() != null ? data.getX() : BigDecimal.ZERO`. Python 端用
    `data["x"] if data.get("x") is not None else Decimal("0")` 三元.
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

        # Rule 1: explicit is-None ternary, NOT `or` (Decimal("0") falsy 工作但违反 rule)
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
```

### 3.5 `_calculate_completion_rate` + `_determine_target_completion_alert` (含 C4 + T1 + Rule 7)

```python
# T1 lock — inline const, NOT alert_thresholds.py 80 (different concept for /alerts)
_DEPARTMENT_TARGET_COMPLETION_RED    = Decimal("60")
_DEPARTMENT_TARGET_COMPLETION_YELLOW = Decimal("85")

# Java FinanceAnalysisServiceImpl 风格 SCALE 常量 (DeptImpl line 52-54 同值)
_SCALE             = Decimal("0.0001")    # SCALE=4 中间精度
_DISPLAY_SCALE     = Decimal("0.01")      # DISPLAY_SCALE=2 输出
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


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
    NOT `if not target:` (Rule 1: 即使 Decimal("0") falsy 工作, 显式 `is None` 必须).

    ⚠️ Arithmetic order — Java `.divide(target, SCALE=4, HALF_UP)` 把**除法结果**
    量化到 4 位 HALF_UP, NOT 把乘法结果先量化。Python 必须 mirror:
       ((actual * 100) / target).quantize(SCALE, HALF_UP)
    NOT
       (actual * 100).quantize(SCALE, HALF_UP) / target    ← BUG 顺序反了

    Note: actual 在实际调用中 never None — _aggregate_department_data 已经在 row
    级别 coerce null → Decimal("0"). 不需要 actual-None defensive.
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    # ✅ Mirror Java: 除法结果量化, NOT 乘法结果
    return ((actual * Decimal("100")) / target).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP
    )


def _determine_target_completion_alert(value: Decimal) -> str:
    """Mirror Java MetricCalculatorServiceImpl.determineAlertLevel(TARGET_COMPLETION)
    (line 457-461):

      double v = value.doubleValue();
      if (v < 60) return RED;
      if (v < 85) return YELLOW;
      return GREEN;

    ⚠️ T1 lock — 60/85 Java HARDCODED, NOT from alert_thresholds.json (which has
    `department.target_completion.yellow=80` — 不同概念, 给 /alerts endpoint 用的).
    Inline const 防 sister bug.

    ⚠️ Rule 7 lock — 阈值 60 / 85 是 INTEGER → `float(value)` 比较跟 Java
    `value.doubleValue()` 一致 (Rule 7 explicitly notes integer thresholds OK).

    For non-integer thresholds in sister specs, must use Decimal compare.
    """
    v = float(value)
    if v < float(_DEPARTMENT_TARGET_COMPLETION_RED):
        return "RED"
    if v < float(_DEPARTMENT_TARGET_COMPLETION_YELLOW):
        return "YELLOW"
    return "GREEN"
```

### 3.6 `_determine_quadrant` (含 C3 lock — 不能 lift avg)

```python
def _determine_quadrant(
    per_capita_sales: Decimal,
    per_capita_cost: Decimal,
    aggregated_data: dict[str, dict],
) -> str:
    """Mirror Java DepartmentAnalysisServiceImpl.determineQuadrant (line 621-653).

    ⚠️ C3 LOCK — DO NOT optimize by lifting avg computation OUT of the per-point
    loop. Java line 225-249 `_get_department_efficiency_matrix` invokes this
    function PER POINT, and this function re-iterates `aggregated_data` to
    compute averages AT EACH CALL. The SCALE=4 intermediate divide+sum+divide
    is a 3-stage rounded operation; computing avg once outside and inlining
    would change byte-shape due to rounding accumulation differences.

    Caller pattern (Java line 225-249):
        for each dept in aggregatedData:
            perCapitaSales = salesAmount.divide(headcount, SCALE=4, HALF_UP)
            perCapitaCost  = costAmount.divide(headcount, SCALE=4, HALF_UP)
            quadrant = determineQuadrant(perCapitaSales, perCapitaCost, aggregatedData)  ← per-point recompute
            point.put("quadrant", quadrant)

    Algorithm:
      avg_sales = sum(salesAmount.divide(headcount, SCALE=4, HALF_UP)
                      for each dept where headcount > 0) / count
      avg_cost  = sum(costAmount.divide(headcount, SCALE=4, HALF_UP)
                      for each dept where headcount > 0) / count
      quadrant = Q1/Q2/Q3/Q4 based on (per_capita >= avg) booleans:
        Q1 = high output, high cost  (优化效率)
        Q2 = low output,  low cost   (表现平庸)    ← NOTE Java labels Q2/Q3 swap
        Q3 = low output,  high cost  (重点关注)    ←      from "natural" reading
        Q4 = high output, low cost   (明星部门)

    PR-B test will verify per-point recompute byte-equal vs single-pass mistake.
    """
    avg_sales = Decimal("0")
    avg_cost  = Decimal("0")
    count = 0

    # iteration over aggregated_data.values() — LinkedHashMap insertion order
    for agg in aggregated_data.values():
        if agg["headcount"] > 0:
            avg_sales += (agg["salesAmount"] / Decimal(agg["headcount"])).quantize(
                _SCALE, rounding=_QUANTIZE_HALF_UP
            )
            avg_cost  += (agg["costAmount"] / Decimal(agg["headcount"])).quantize(
                _SCALE, rounding=_QUANTIZE_HALF_UP
            )
            count += 1

    if count > 0:
        avg_sales = (avg_sales / Decimal(count)).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )
        avg_cost  = (avg_cost / Decimal(count)).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )

    high_output = per_capita_sales >= avg_sales
    high_cost   = per_capita_cost  >= avg_cost

    # Java labels mirror exactly (Java line 644-652)
    if high_output and high_cost:
        return "Q1_HIGH_OUTPUT_HIGH_COST"
    if high_output and not high_cost:
        return "Q4_HIGH_OUTPUT_LOW_COST"
    if not high_output and high_cost:
        return "Q3_LOW_OUTPUT_HIGH_COST"
    return "Q2_LOW_OUTPUT_LOW_COST"
```

### 3.7 4 个 sub-service（pseudo-code, 关键算法）

```python
async def _get_department_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentRanking (line 64-108).

    Empty rows → return []. Sort by salesAmount desc, build RankingItem entries.

    RankingItem put-order (Java @Builder, RankingItem.java:22-53 declaration order):
      [rank, name, value, target, completionRate, alertLevel]
    Python emits in same insertion order.

    Rule 4: All BigDecimal outputs → _decimal_to_number for FastAPI parity.
    """
    rows = await _query_department_full(factory_id, start_date, end_date)
    if not rows:
        return []

    aggregated = _aggregate_department_data(rows)

    # Java: aggregatedData.entrySet().stream().sorted((a,b) -> b.salesAmount.compareTo(a.salesAmount)).collect(...)
    # Python sorted() stable matches Java Stream.sorted stable
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

    formattedValue = `metricCalculatorService.formatMetricValue(TARGET_COMPLETION, value)`
    — Java impl returns f"{value:.2f}%" pattern (TBD verify with golden record;
    PR-B test asserts exact format string).
    """
    rows = await _query_department_full(factory_id, start_date, end_date)
    if not rows:
        return []

    aggregated = _aggregate_department_data(rows)

    results = []
    for dept, agg in aggregated.items():
        cr = _calculate_completion_rate(agg["salesAmount"], agg["salesTarget"])
        cr_display = cr.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
        results.append({
            "metricCode":     "TARGET_COMPLETION",
            "metricName":     "目标完成率",
            "value":          _decimal_to_number(cr_display),
            "formattedValue": f"{cr_display}%",    # TBD verify Java format
            "unit":           "%",
            "dimensionValue": dept,
            "alertLevel":     _determine_target_completion_alert(cr),
        })

    # Java line 198: results.sort((a,b) -> b.value.compareTo(a.value)) → desc by value
    # Python sorted() stable
    results.sort(key=lambda r: r["value"], reverse=True)
    return results


async def _get_department_efficiency_matrix(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentEfficiencyMatrix (line 206-283).

    Empty rows → _create_empty_chart("SCATTER", "部门效率矩阵") (per Java line 213).

    Per-point loop (Java line 225-249):
      for each (dept, agg) in aggregated_data:
          perCapitaSales = agg.salesAmount / headcount (SCALE=4 HALF_UP) if hc>0 else 0
          perCapitaCost  = agg.costAmount  / headcount (SCALE=4 HALF_UP) if hc>0 else 0
          point = LinkedHashMap [department, perCapitaSales, perCapitaCost, salesAmount,
                                 headcount, quadrant]
          quadrant = _determine_quadrant(perCapitaSales, perCapitaCost, aggregated_data)
                     ← C3: per-point recompute, DO NOT lift avg out

    Avg per-capita as quadrant-line split (Java line 252-257):
      avg_per_capita_sales = total_per_capita_sales / dept_count
      avg_per_capita_cost  = total_per_capita_cost  / dept_count

    options LinkedHashMap (Java line 260-272) put-order:
      [quadrantLines, quadrantLabels, bubbleSizeField, colorField]
    quadrantLines = Map.of(2): {xAxis, yAxis}                           ⚠️ I1 SALT flip risk
    quadrantLabels = Map.of(4): {q1, q2, q3, q4}                        ⚠️ I1 SALT flip risk

    ⚠️ I1 lock — Map.of(2) and Map.of(4) iteration order is JVM-randomized
    (`ImmutableCollections.SALT32L`) since Java 9. Python emits canonical
    insertion order matching FIRST-recorded golden; if golden-flip detected
    across Java backend restarts, document as accepted divergence in §8.

    ChartConfig final shape (Java line 274-282):
      {chartType: "SCATTER", title: "部门效率矩阵",
       xAxisField: "perCapitaSales", yAxisField: "perCapitaCost",
       seriesField: "department", data: [...], options: {...}}
    """
    rows = await _query_department_full(factory_id, start_date, end_date)
    if not rows:
        return _create_empty_chart("SCATTER", "部门效率矩阵")

    aggregated = _aggregate_department_data(rows)

    chart_data = []
    total_per_capita_sales = Decimal("0")
    total_per_capita_cost  = Decimal("0")
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
            per_capita_cost  = Decimal("0")

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
        total_per_capita_cost  += per_capita_cost
        department_count += 1

    # Java line 252-257: avg = total / count (single divide, SCALE=4)
    if department_count > 0:
        avg_per_capita_sales = (
            total_per_capita_sales / Decimal(department_count)
        ).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
        avg_per_capita_cost = (
            total_per_capita_cost / Decimal(department_count)
        ).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
    else:
        avg_per_capita_sales = Decimal("0")
        avg_per_capita_cost  = Decimal("0")

    # Java line 260-272 options LinkedHashMap put-order
    # quadrantLines / quadrantLabels = Map.of(N) — I1 SALT-flip risk, mirror first-record order
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

    return {
        "chartType":   "SCATTER",
        "title":       "部门效率矩阵",
        "xAxisField":  "perCapitaSales",
        "yAxisField":  "perCapitaCost",
        "seriesField": "department",
        "data":        chart_data,
        "options":     options,
    }


async def _get_department_trend_comparison(
    factory_id: str, start_date: date, end_date: date, period: str = "WEEK"
) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl.getDepartmentTrendComparison (line 354-416).

    Empty trend → _create_empty_chart("LINE", "部门销售趋势对比") (per Java line 366).

    ⚠️ M3 — Uses inline LinkedHashMap (Java line 369) — DO NOT confuse with
    `aggregateTrendData` helper (line 572) which uses TreeMap. trendComparison
    sorts via TreeSet at line 380 for `allPeriods` (alphabetical sort), but
    per-period dept-key uses LinkedHashMap iteration (insertion order from
    SQL row order).

    Period defaults to "WEEK" per composite path (SmartBIServiceImpl:590).
    Controller fallback "MONTH" (Controller line 169) is dead code — not exposed.

    Java algorithm (line 369-400):
      1. SQL aggregation `findDepartmentDailyTrend` returns Object[3] rows
         (orderDate, department, SUM(amount))
      2. Build trendData LinkedHashMap<periodKey, LinkedHashMap<dept, amount>>
         iterating rows in SQL order; computeIfAbsent + merge
      3. Collect allPeriods (TreeSet → sorted) + allDepartments (LinkedHashSet →
         insertion order)
      4. Build chartData list iterating allPeriods (sorted), per period emit
         LinkedHashMap [period, dept1, dept2, ...]

    Rule 2 — period key uses _get_period_key from analysis_finance.py
    (post-PR #30 calendar-year fix).
    """
    rows = await _query_department_daily_trend(factory_id, start_date, end_date)
    if not rows:
        return _create_empty_chart("LINE", "部门销售趋势对比")

    # Step 2: trendData = {period_key: {dept: amount}}
    # LinkedHashMap iteration order (= SQL row order)
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
    for period_key in trend_data:    # iterate in original insertion order
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

    # Java line 403-405 options LinkedHashMap
    options = {
        "series": list(all_departments),
        "period": period,
    }

    return {
        "chartType":   "LINE",
        "title":       "部门销售趋势对比",
        "xAxisField":  "period",
        "yAxisField":  "amount",
        "seriesField": "department",
        "data":        chart_data,
        "options":     options,
    }
```

### 3.8 Empty case `_create_empty_chart` (含 I5 fix)

```python
def _create_empty_chart(chart_type: str, title: str) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl create{Scatter,Pie,Line,Area}EmptyChart
    factories (line 801-823).

    ⚠️ I5 fix — Java ChartConfig DTO has NO @JsonInclude annotation (verified
    ChartConfig.java:32) → Spring Boot Jackson default emits ALL fields including
    null. Empty chart JSON shape:
      {"chartType": "SCATTER", "title": "部门效率矩阵",
       "xAxisField": null, "yAxisField": null, "seriesField": null,
       "data": [], "options": null}

    Python emits None for unset fields (FastAPI default JSON serializes None → null).

    ChartConfig field order (Java DTO line 37-67):
      [chartType, title, xAxisField, yAxisField, seriesField, data, options]
    Lombok @Data @Builder preserves declaration order in serialization.
    """
    return {
        "chartType":   chart_type,
        "title":       title,
        "xAxisField":  None,
        "yAxisField":  None,
        "seriesField": None,
        "data":        [],
        "options":     None,
    }
```

### 3.9 `_get_department_analysis` composite assembler

```python
async def _get_department_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java SmartBIServiceImpl.getComprehensiveAnalysis "department" case
    (line 586-591) + envelope (line 612-613).

    Java code:
      Map<String, Object> result = new HashMap<>();
      result.put("ranking", deptService.getDepartmentRanking(...));
      result.put("completionRates", deptService.getDepartmentCompletionRates(...));
      result.put("efficiencyMatrix", deptService.getDepartmentEfficiencyMatrix(...));
      result.put("trendComparison", deptService.getDepartmentTrendComparison(..., "WEEK"));
      result.put("dateRange", DateRange.custom(startDate, endDate));
      result.put("generatedAt", LocalDateTime.now());

    ⚠️ I2 (HashMap iteration order) — Java composite uses `result = new HashMap<>()`
    (SmartBIServiceImpl:575). String key hashCode is Java-spec-deterministic →
    iteration order STABLE across JVM restarts (cost / profit / payable specs
    empirical evidence; receivable spec line 677 实测 finance composite key 顺序
    `[endDate, metrics, agingChart, startDate]` — ≠ put-order, but stable).

    Python emits dict in insertion order matching recorded F999 golden's actual
    Jackson output order (NOT Java put-order). **Order TBD until first golden
    record** via record-java-golden.sh — likely some HashMap-hash permutation
    of [ranking, completionRates, efficiencyMatrix, trendComparison, dateRange,
    generatedAt]. Spec PR-A first step = record golden, then update both this
    function's dict literal AND §4.1 placeholder to match.

    M1 — period hardcoded "WEEK" per composite path (SmartBIServiceImpl:590).
    Controller fallback "MONTH" (Controller:169) is dead code, not used.
    """
    ranking          = await _get_department_ranking          (factory_id, start_date, end_date)
    completion_rates = await _get_department_completion_rates (factory_id, start_date, end_date)
    efficiency_matrix = await _get_department_efficiency_matrix(factory_id, start_date, end_date)
    trend_comparison = await _get_department_trend_comparison (factory_id, start_date, end_date, "WEEK")

    # ⚠️ TBD: actual key order from F999 golden record. Placeholder matches Java put-order.
    # PR-A first step: record golden, update this dict literal to match Java's HashMap
    # hash-iteration order.
    return {
        "ranking":          ranking,
        "completionRates":  completion_rates,
        "efficiencyMatrix": efficiency_matrix,
        "trendComparison":  trend_comparison,
        "dateRange":        _build_date_range(start_date, end_date),
        "generatedAt":      _utc_now_iso(),    # volatile, stripped by _strip_volatile in tests
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

    DateRange Lombok @Data @Builder field order (DateRange.java line 31-55):
      [startDate, endDate, granularity, originalExpression, relative]
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
    }
```

### 3.10 路由注册

```python
# backend/python/smartbi_compat/api/analysis_department.py

analysis_department_router = APIRouter()


@analysis_department_router.get(
    "/api/mobile/{factoryId}/smart-bi/analysis/department"
)
async def get_department_analysis(
    factoryId: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    department: Optional[str] = Query(None),    # accepted but IGNORED — mirror Java prod
    auth: AuthContext = Depends(verify_factory_access),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getDepartmentAnalysis (line 142-177).

    ⚠️ `department` query param accepted but IGNORED — mirror Java prod behavior:
    Controller's `if (smartBIService != null)` (line 153) ALWAYS true in prod
    (SmartBIServiceImpl is unconditional @Service). Composite path bypasses
    Controller's filter branch (line 162-170) entirely. Detail mode is dead
    code in prod.

    Future Java change to default-detail-mode would require spec update; current
    spec is composite-only.
    """
    result = await _get_department_analysis(auth.factory_id, startDate, endDate)
    return wrap_response(result)


# backend/python/main.py 增加注册
# from smartbi_compat.api.analysis_department import analysis_department_router
# app.include_router(analysis_department_router)
```

---

## 4. F999 byte-shape gate

### 4.1 F999 期望响应（pre-record placeholder, 实际 record 后 update）

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "ranking": [],
    "completionRates": [],
    "efficiencyMatrix": {
      "chartType": "SCATTER",
      "title": "部门效率矩阵",
      "xAxisField": null,
      "yAxisField": null,
      "seriesField": null,
      "data": [],
      "options": null
    },
    "trendComparison": {
      "chartType": "LINE",
      "title": "部门销售趋势对比",
      "xAxisField": null,
      "yAxisField": null,
      "seriesField": null,
      "data": [],
      "options": null
    },
    "dateRange": {
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "granularity": "YEAR",
      "originalExpression": "2025-01-01 至 2025-12-31",
      "relative": false
    },
    "generatedAt": "<volatile>"
  },
  "success": true,
  "timestamp": "<volatile>"
}
```

**⚠️ Pre-record placeholder**: top-level `data.*` key 顺序 pending F999 golden record。Java HashMap hash for String keys is deterministic per Java spec, but actual Jackson emit order ≠ Java put-order. Spec PR-A first step:
1. Record F999 golden via `record-java-golden.sh F999 /api/mobile/F999/smart-bi/analysis/department tests/fixtures/java-smartbi-golden/analysis-department-F999.json`
2. Inspect actual key order
3. Update §4.1 placeholder above
4. Update §3.9 `_get_department_analysis` dict literal to match
5. PR-A test 全 green 后 merge

### 4.2 F999 record protocol

```bash
./scripts/record-java-golden.sh F999 \
  /api/mobile/F999/smart-bi/analysis/department \
  tests/fixtures/java-smartbi-golden/analysis-department-F999.json
```

**SALT flip detection (PR-B 阶段)**:
- F999 empty case 不触发 Map.of (efficiencyMatrix 是 empty scatter, options=null)
- PR-B 非空 case 录 golden 跨 Java backend restart 3-5 次:
  ```bash
  for i in 1 2 3 4 5; do
    ssh root@47.100.235.168 "systemctl restart cretas-backend-test"
    sleep 90    # systemd RestartSec=15 + Spring Boot 启动 ~80s
    ./scripts/record-java-golden.sh F001 \
      /api/mobile/F001/smart-bi/analysis/department \
      tests/fixtures/java-smartbi-golden/analysis-department-F001-run${i}.json
  done
  ```
- diff 5 个 golden 文件，若 `quadrantLines` / `quadrantLabels` key 顺序 flip → 标 §8 known divergence; Python emit 用 first-record canonical 顺序

---

## 5. 测试策略

### 5.1 Contract test 类（PR-A）

```python
# tests/python/smartbi_compat/test_analysis_department_contract.py

class TestAnalysisDepartmentComposite:
    """F999 byte-shape gate for department composite path."""

    def test_f999_composite_data_keys_match_golden(self, client, monkeypatch):
        """Top-level `data.*` keys exactly match recorded golden order."""
        # mock _query_department_full + _query_department_daily_trend → []
        # assert list(_strip_volatile(resp.json()['data']).keys()) == golden's stripped keys

    def test_f999_composite_byte_shape(self, client, monkeypatch):
        """Full dict-eq compare: Python output vs golden, both _strip_volatile."""
        # mock both helpers → []
        # assert _strip_volatile(resp.json()) == _strip_volatile(json.load(golden))

    def test_f999_department_filter_param_ignored(self, client, monkeypatch):
        """`?department=销售部` produces SAME shape as no-filter case (composite ignores filter)."""
        # mock helpers → []
        # request with ?department=销售部 vs no filter
        # assert both responses byte-equal after _strip_volatile
```

### 5.2 Unit test 类（PR-B）— 4 sub-services 各一 class

#### `TestDepartmentRankingArithmetic` (4 tests)

| Test | Branch covered |
|---|---|
| `test_empty_rows_returns_empty_list` | `[] → []` |
| `test_sort_stability_tie_break` | 多 dept salesAmount 相同, sort stable (matches Java Stream.sorted) |
| `test_completion_rate_zero_emits_alert_red` | `salesAmount=0 / target=10000 → cr=0 → alertLevel=RED` |
| `test_completion_rate_85_boundary_emits_green` | `cr=85.0 → alertLevel=GREEN` (boundary `< 85` strict) |

#### `TestDepartmentCompletionRatesArithmetic` (3 tests)

| Test | Branch |
|---|---|
| `test_sort_by_completion_rate_desc` | 多 dept, completionRate 降序排 |
| `test_target_zero_returns_completion_zero` | `target=0 → cr=Decimal("0")` (C4 fix verify) |
| `test_formatted_value_percent_format` | `formattedValue == "85.00%"` exact format string |

#### `TestDepartmentEfficiencyMatrixArithmetic` (6 tests)

| Test | Branch |
|---|---|
| `test_empty_rows_returns_empty_scatter_chart` | empty → `_create_empty_chart("SCATTER", ...)` (I5 verify) |
| `test_single_department_quadrant_q4` | 单 dept, avg = self → high_output && !high_cost → Q4 |
| `test_four_departments_full_quadrant_matrix` | 4 dept 各占一象限 |
| `test_quadrant_per_point_recompute_byte_equal` | C3 verify — 显式 single-pass vs per-point recompute byte-different |
| `test_map_of_2_quadrant_lines_order_canonical` | I1 — `options.quadrantLines` keys exact `[xAxis, yAxis]` (mirror golden) |
| `test_map_of_4_quadrant_labels_order_canonical` | I1 — `options.quadrantLabels` keys exact `[q1, q2, q3, q4]` (mirror golden) |

#### `TestDepartmentTrendComparisonArithmetic` (5 tests)

| Test | Branch |
|---|---|
| `test_empty_rows_returns_empty_line_chart` | empty → `_create_empty_chart("LINE", ...)` (I5 verify) |
| `test_multi_dept_multi_period_merge` | 多 period × 多 dept aggregation |
| `test_sorted_period_axis` | period TreeSet → sorted output |
| `test_week_period_key_calendar_year_post_pr30` | Rule 2 regression (e.g. 2024-12-30 → "2024-W01" 跨年 calendar year) |
| `test_same_date_dept_order_unspecified` | I4 verify — Python NOT 主动加 ORDER BY department |

### 5.3 Mock pattern

```python
async def fake_query_full(factory_id, start_date, end_date):
    if factory_id == "F999":
        return []
    return [
        {
            "id": 1,
            "factory_id": "F001",
            "department": "销售部",
            "record_date": date(2025, 6, 1),
            "sales_amount":   Decimal("100000"),
            "sales_target":   Decimal("80000"),
            "cost_amount":    Decimal("60000"),
            "headcount":      10,
            "per_capita_sales": Decimal("9999"),    # I3: ignored by aggregator
            "per_capita_cost":  Decimal("9999"),    # I3: ignored
        },
        # ... more rows
    ]


async def fake_query_trend(factory_id, start_date, end_date):
    if factory_id == "F999":
        return []
    return [
        {"order_date": date(2025, 6, 1), "department": "销售部", "total_amount": Decimal("50000")},
        {"order_date": date(2025, 6, 2), "department": "运营部", "total_amount": Decimal("30000")},
    ]


monkeypatch.setattr(
    "smartbi_compat.api.analysis_department._query_department_full",
    fake_query_full,
)
monkeypatch.setattr(
    "smartbi_compat.api.analysis_department._query_department_daily_trend",
    fake_query_trend,
)
```

### 5.4 F001 真窗（不进 CI）

Cost spec 同模式: `scripts/record-java-golden.sh --compare` post-deploy smoke。Python deploy 后:

```bash
./scripts/record-java-golden.sh --compare \
  --factory F001 \
  --path /api/mobile/F001/smart-bi/analysis/department \
  --query "startDate=2025-01-01&endDate=2025-12-31"
```

⚠️ 同 cost spec §5.4 caveat: profit PR-A 落地的实际 CLI 是位置参数 `<factory> <path> <output> [--prod]`，没 `--compare` flag。F001 smoke 走两步手动:
1. Record Java: `./scripts/record-java-golden.sh F001 /api/mobile/F001/smart-bi/analysis/department /tmp/java-dept-F001.json --prod`
2. Curl Python: `curl ... > /tmp/python-dept-F001.json`
3. Python `_strip_volatile` 双边 → `dict_eq` diff

---

## 6. Byte gate 语义

参见 cost spec §6 + `.claude/rules/python-java-port.md` Rule 4。当前是 dict-eq gate (`json.load` 后 dict 比较, 通过 `_strip_volatile` 移除 timestamps), strict-byte 是 Phase 2A backlog。Sister chats 不应假设 strict-byte 已实现。

---

## 7. PR 切片 + 顺序

### PR-A — department foundation

**Title**: `Phase 2A: /analysis/department composite real impl + 4 sub-services`

**Scope**:
- §2.1 PR-A 文件清单
- §3.2 imports
- §3.3 `_query_department_full` + `_query_department_daily_trend` SQL helpers
- §3.4 `_aggregate_department_data` (C1 + I3 + Rule 1)
- §3.5 `_calculate_completion_rate` + `_determine_target_completion_alert` (C4 + T1 + Rule 7)
- §3.6 `_determine_quadrant` (C3 lock)
- §3.7 4 个 sub-services
- §3.8 `_create_empty_chart` (I5)
- §3.9 `_get_department_analysis` composite assembler + `_build_date_range`
- §3.10 路由注册
- §5.1 `TestAnalysisDepartmentComposite` (3 tests)
- §4.2 record F999 golden, update §4.1 placeholder + §3.9 dict literal

**LOC 估**: ~450 (impl 280 + tests 80 + golden record + route registration ~ 50 + main.py edit ~10)

**CI gate**: pytest baseline + 3 tests (post-cost ~294 → 297)

**依赖**:
- profit PR-A 已 merged (`_get_period_key` post-PR #30 calendar-year fix + `_strip_volatile` + `_decimal_to_number` + `_to_decimal` + `_utc_now_iso` + `_fetch_all` + `wrap_response` 全部已存在)
- PR #35 (Rule 8) merge 不阻塞 PR-A — sister spec 引用模式已经经验性 stable

### PR-B — department arithmetic depth

**Title**: `Phase 2A: /analysis/department arithmetic depth tests (4 sub-services)`

**Scope**:
- §5.2 4 个 test class, 18 tests 总
- Map.of SALT flip detection (本地手动跨 Java backend restart 录 golden)

**LOC 估**: ~250 (tests only)

**CI gate**: PR-A baseline + 18 tests = 315

### 顺序

```
1. spec doc commit + 4-cycle subagent audit + push（本 step ← we're here）
2. user 审 spec → OK
3. spec-only PR open (base main, head phase2a/spec-department)
4. PR review + merge OR 等 sister chats prepared → impl chat 启动
5. impl chat:
   - rebase phase2a/t-department onto post-spec-merge main
   - writing-plans → PR-A plan (~14 tasks)
   - subagent-driven-development 执行 PR-A
   - PR-A 第一步: record F999 golden, update §4.1 + §3.9 placeholder
   - PR-A push → PR → squash merge
6. pull main → writing-plans → PR-B plan
7. PR-B impl → PR → squash merge
8. cleanup worktree
9. (PR #35 merge 后) polish §3.7 / §8 / §9 cite Rule 8 (cosmetic)
```

---

## 8. Open risks + mitigations

| 风险 | Mitigation |
|---|---|
| Top-level HashMap key 跨 JVM 顺序 flip | String key hashCode deterministic per Java spec; sister specs (cost / profit / payable / receivable) 经验跨 JVM stable. Mitigation: 录一次 F999 golden 即可 (§4.2 step 1); 若 PR-A CI 在不同 Java 实例首次 record 时发现 mismatch, 按 receivable spec line 677 pattern: re-record + update Python emit-order |
| `Map.of(2)` quadrantLines / `Map.of(4)` quadrantLabels SALT32L per-JVM flip | F999 empty case 不触发 (efficiencyMatrix=empty scatter, options=null). PR-B 非空 case 必发. Mitigation: §4.2 step 5x record golden 跨 Java backend restart; Python emit 固定 canonical insertion order (matching first-record); 若 flip detected, 标 §8 known shape divergence (acceptable — 业务字段值不变只是 key 顺序) 或 patch Java 改 LinkedHashMap (out of Phase 2A scope). PR #35 merge 后引用 Rule 8 |
| `findByFactoryIdAndRecordDateBetween` JPA 无 ORDER BY | Python `_query_department_full` 加 `ORDER BY id` 保证 deterministic. F999 empty 不触发, F001 真窗 smoke 验证。Java 端推荐同样 fix (out of scope) |
| `findDepartmentDailyTrend` same-date dept 顺序未指定 | Verbatim mirror Java `ORDER BY order_date` only (无 dept). Python NOT 加 ORDER BY department, 否则跨 PG 实例顺序差异打破 Java parity. F999 empty 不触发, F001 同一 PG 实例下顺序 stable, PR-B test 显式 verify 同日多 dept 顺序未指定 |
| `_determine_quadrant` 优化 trap (lift avg out of per-point loop) | §3.6 explicit lock "DO NOT lift avg out of per-point loop" + PR-B test `test_quadrant_per_point_recompute_byte_equal` 显式比对 single-pass vs per-point 结果 (single-pass 跟 Java byte 不同, byte gate fail) |
| `headcount` 误 port 成 SUM/latest | §3.4 wording "MAX, NOT latest-by-date" + Java comment misleading 警告 (人员数取最新记录 是错误注释, code 是 max). PR-B test `test_headcount_max_not_latest_by_date` (隐含在 ranking sort + ranking value 验证) |
| `per_capita_sales/cost` 列误用 (从 SELECT * 直接读) | §3.4 explicit "ignore precomputed columns; recompute". PR-B mock data 含 `per_capita_*` 故意错误值, verify 输出值不等于 mock 值 (说明已 ignore) |
| ChartConfig empty case `options` 字段 emit 错 | §3.8 lock emit `None` (mirror Jackson default no-@JsonInclude). PR-B test `test_*_empty_returns_empty_chart` 直接 byte-eq 验证 `options=None` |
| TARGET_COMPLETION 阈值 sister bug (60/80 vs 60/85) | §3.5 inline `_DEPARTMENT_TARGET_COMPLETION_RED/_YELLOW = Decimal("60")/Decimal("85")` const, 不复用 alert_thresholds.py. Inline `_determine_target_completion_alert` 避免 sister 在写 region/quality/procurement spec 时误用 alert_thresholds.json |
| `_calculate_completion_rate` 算式顺序错 (中间量化 vs 末尾量化) | §3.5 explicit `((actual * Decimal("100")) / target).quantize(SCALE)` mirror Java `actual.multiply(100).divide(target, SCALE, HALF_UP)` (除法结果量化, NOT 乘法结果). PR-B test 直接 assert byte-equal 边界 case (e.g. actual=Decimal("33.333"), target=Decimal("9.7") → cr=Decimal("343.6392")) |
| WEEK period key 跨年 boundary Rule 2 violation | Import `_get_period_key` from `analysis_finance.py` (post-PR #30 calendar-year fix `8031f2644`). PR-B test `test_week_period_key_calendar_year_post_pr30` 跨年 boundary regression (e.g. 2024-12-30 → "2024-W01") |
| `formattedValue` Java 实际 format string 待 verify | §3.7 `_get_department_completion_rates` placeholder `f"{cr_display}%"`. PR-A 第一步 record F999 (空) + small synthetic golden (PR-B test data) 验证 Java MetricCalculatorService.formatMetricValue 实际返回。如 Java 用千分位 (e.g. `"1,234.56%"`), Python 调整 |
| F999 真窗找不到 (factory_id=F999 不存在 / RLS 阻挡) | profit / cost spec 已建 F999 测试工厂 + RLS bypass。本 spec 直接复用. PR-A 验证 record-java-golden.sh F999 调用成功 |

---

## 9. References

- Sister spec (foundation): `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`
- Sister spec (cost - 模板): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`
- Sister spec (profit - PR-A 来源): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md`
- Sister spec (receivable - HashMap pattern precedent): `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md` line 677
- Sister spec (sales-rankings - HashMap precedent): `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-rankings-design.md` line 363
- Sister spec (alerts - Java sort fix precedent): `docs/superpowers/specs/2026-04-29-alerts-full-port-design.md` line 35
- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
- Existing Python (alerts handler): `backend/python/smartbi_compat/api/analysis.py:340-360` (`_query_department_data` + `_generate_department_alerts` — 不同 scope, 不复用)
- Live Java backend (test env): `47.100.235.168:10011`
- PR #30 lineage (Rule 2 calendar-year fix): commit `8031f2644`
- PR #35 (待 merge, Rule 8 Map.of(N) Jackson hash order): branch `rules/rule-8-map-of-jackson-order` — merge 后 polish §3.7 / §8 / §9 cite Rule 8 替代 inline reasoning
- Audit constraints: `.claude/rules/python-java-port.md` Rule 1-7 (Rule 8 post-PR #35)
- Backlog map: `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md`
- Phase 2A scope lock: memory `project_apr30_tool_skill_stays_java.md`
