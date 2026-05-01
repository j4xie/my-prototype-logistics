# Phase 2A `/analysis/procurement` per-type real impl — Design Spec

**Date**: 2026-05-01
**Branch**: `phase2a/spec-procurement`
**Worktree**: 主 (this is spec-only, impl chats 启动时再开 worktree)

**Predecessors**:
- PR #18 — finance payable per-type (per-type pattern source)
- PR #21 + #22 — finance profit per-type
- PR #25 + #28 — finance cost per-type + arithmetic depth
- PR #30 — `_get_period_key` calendar-year fix (Rule 2)
- PR #32 — finance 3 sub-endpoints (budget-achievement / yoy-mom / category-comparison)
- PR #33 / #34 — finance receivable / budget specs (per-type pattern peers)
- PR #35 — Rule 8 入 `python-java-port.md` (`Map.of(N)` Jackson hash order)
- **PR #36 — `/analysis/department` composite spec** (sister Tier 2 lock-in 模式来源, 你 Chat 4 ship)
- PR #37 — defer quality + production (Java mock-only); Process Rule §2.4 验证 procurement REAL ✅

**Sister chat in flight**:
- `phase2a/spec-region` (Chat 5) — sister Tier 2, cross-cycle 3 audit 互引

**Inherited audit constraints**:
- 全部参见 [`.claude/rules/python-java-port.md`](../../../.claude/rules/python-java-port.md) Rule 1-8
- Rule 8 (Map.of(N) hash order, post-PR #35) — procurement 实际**不触发** (没 Map.of 调用站点, 全 LinkedHashMap + Arrays.asList), 但 §8 仍预防性引用

**Audit history**:
- Round 1 self-review + Round 2 evidence-based grep verify (T1-T11 全 lock-in, 见 §8)
- Round 3 reviewer audit (subagent dispatch on §1+§2 design — pre spec-write)
- Round 4 fresh subagent audit (post spec-write, before push)

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main HEAD `e18affb82`）

`/api/mobile/{factoryId}/smart-bi/analysis/procurement` 在 Python 端**不存在** path handler。Java 端：
- `SmartBIAnalysisController.getProcurementAnalysis` (`SmartBIAnalysisController.java:452-486`) 直接走 4 modes 分支（**无** SmartBIService composite 包装路径，不像 department）
- `ProcurementAnalysisServiceImpl @Service`（line 49）注入 2 个 repository: `MaterialBatchRepository` + `SupplierRepository` — REAL DB query (Process Rule §2.4 ✅)
- 4 modes (analysisType): `supplier` / `cost` / `trend` / `null` (default = overview DashboardResponse)
- 7 sub-services in scope (per controller branches), 2 sub-services out of scope (controller 不调)

### 1.2 这一 chat 范围

实施 **procurement 4 modes real impl**，single spec covers ALL 4 modes + 11 traps; PR 切片 by §7:

**完整 in-scope sub-services (per controller line 467-479)**:
| analysisType | Sub-services 调用 | 输出 keys |
|---|---|---|
| `supplier` | `getSupplierRanking` + `getSupplierEvaluation` | `[startDate, endDate, ranking, evaluation]` |
| `cost` | `getCostMetrics` + `getPurchaseCostAnalysis` + `getMaterialCategoryRanking` | `[startDate, endDate, metrics, costAnalysis, categoryRanking]` |
| `trend` | `getProcurementTrendChart(period="MONTH")` | `[startDate, endDate, trendChart]` |
| default | `getProcurementOverview` (DashboardResponse) | `[startDate, endDate, overview]` |

**Helpers + scoring functions** in scope:
- 5 dimension scorers for radar chart: `calculatePriceScore` / `calculateQualityScore` / `calculateDeliveryScore` / `calculateServiceScore` / `calculateStabilityScore`
- 2 rule-based generators: `generateAiInsights` (line 914-975) + `generateSuggestions` (line 980-1005) — NO LLM, byte-port-able
- `getBatchesInDateRange` (line 451-456) — replaced with explicit Python SQL helper (T3 fix)
- `calculateTotalValue` / `calculateAverageUnitPrice` / `calculateSupplierConcentration`
- `formatCurrency` / `determineConcentrationAlertLevel` / `determineChangeDirection` / `determineOnTimeAlertLevel` / `determineQualityAlertLevel`
- `calculateMomGrowth` (external `metricCalculatorService` — to be inlined in Python or imported from `analysis_finance.py` if already ported)

### 1.3 显式不在范围

- `getSupplierDetailMetrics(factoryId, supplierId, startDate, endDate)` — single-supplier deep-dive, controller 不调
- `getSupplierTrendComparison(factoryId, List<String> supplierIds, ...)` — multi-supplier comparison, controller 不调
- T6 nginx cutover (独立 phase)
- AI insights LLM 路径（procurement aiInsights 是 rule-based, 不涉 LLM）
- Byte gate 升级 strict-byte (Phase 2A backlog)
- Supplier RLS gap 修复（T11 deferred — out of Phase 2A scope，Java backend 评估）

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
PR-A (per-type 3 modes: supplier + cost + trend):
  tests/fixtures/java-smartbi-golden/
    ├─ analysis-procurement-F999-supplier.json   [NEW via record-java-golden.sh]
    ├─ analysis-procurement-F999-cost.json       [NEW]
    └─ analysis-procurement-F999-trend.json      [NEW]

  backend/python/smartbi_compat/api/analysis_procurement.py    [NEW]
    + analysis_procurement_router (FastAPI APIRouter)
    + GET /api/mobile/{factoryId}/smart-bi/analysis/procurement endpoint dispatcher
    + _get_procurement_analysis() main dispatcher by analysisType
    + _get_supplier_mode() / _get_cost_mode() / _get_trend_mode() entry points
    + _get_supplier_ranking()                  sub-service 1
    + _get_supplier_evaluation()               sub-service 2 (radar 5-dim)
    + _calculate_price_score()                 dimension scorer 1
    + _calculate_quality_score()               dimension scorer 2
    + _calculate_delivery_score()              dimension scorer 3
    + _calculate_service_score()               dimension scorer 4
    + _calculate_stability_score()             dimension scorer 5 (CV-based)
    + _get_cost_metrics()                      sub-service 3
    + _get_purchase_cost_analysis()            sub-service 4 (PIE by category)
    + _get_material_category_ranking()         sub-service 5
    + _get_procurement_trend_chart()           sub-service 6
    + _query_material_batches_in_range()       SQL helper (T3 fix: ORDER BY id)
    + _query_active_suppliers()                SQL helper for supplier list
    + _query_supplier_by_id()                  SQL helper (T11: WHERE id=$1 AND factory_id=$2)
    + _calculate_total_value()                 mirror MaterialBatch.getTotalValue (T10)
    + _calculate_average_unit_price()
    + _calculate_supplier_concentration()
    + _calculate_mom_growth()                  T9: 3 edge cases + .abs() denom
    + _format_currency()                       T8: f"{float(v.quantize):,.2f}"
    + _determine_concentration_alert_level()   T1: inverse direction, > vs <
    + _determine_on_time_alert_level()         T1: 70/85
    + _determine_quality_alert_level()         T1: 90/95
    + _determine_change_direction()
    + _ON_TIME_RED/YELLOW                      Decimal const (70/85)
    + _QUALITY_RED/YELLOW                      Decimal const (90/95)
    + _CONCENTRATION_RED/YELLOW                Decimal const (60/40, INVERSE)
    + _SCALE / _DISPLAY_SCALE / _QUANTIZE_HALF_UP

  backend/python/main.py                                       [EDIT]
    + register analysis_procurement_router

  tests/python/smartbi_compat/test_analysis_procurement_contract.py  [NEW]
    + class TestAnalysisProcurementSupplierMode (3 tests)
    + class TestAnalysisProcurementCostMode (3 tests)
    + class TestAnalysisProcurementTrendMode (2 tests)

PR-B (default mode = overview DashboardResponse):
  tests/fixtures/java-smartbi-golden/
    └─ analysis-procurement-F999-default.json   [NEW]

  backend/python/smartbi_compat/api/analysis_procurement.py    [EDIT]
    + _get_procurement_overview()              sub-service 7 (DashboardResponse)
    + _build_kpi_cards()                       5 KPI cards builder
    + _build_supplier_pie_chart()
    + _build_material_category_chart()
    + _build_procurement_trend_chart_from_batches()  inline trend (DAY period for default)
    + _calculate_supplier_ranking_from_data()  rule-based ranking inside dashboard
    + _generate_ai_insights()                  T6: rule-based, NO LLM
    + _generate_suggestions()                  T6: rule-based 短文 list
    + _build_empty_dashboard()                 fallback for empty batches
    + _convert_metric_results_to_kpi_cards()
    + DashboardResponse JSON shape (kpiCards / charts / rankings / aiInsights /
       suggestions / lastUpdated) — NEW shape, sister Tier 2 specs (region /
       inventory) 可复用模板

  tests/python/smartbi_compat/test_analysis_procurement_contract.py  [EDIT]
    + class TestAnalysisProcurementOverviewMode (3 tests)
    + _strip_volatile masks data.overview.lastUpdated (extends VOLATILE_KEYS coverage)

PR-C (arithmetic depth tests):
  tests/python/smartbi_compat/test_analysis_procurement_contract.py  [EDIT]
    + class TestProcurementSupplierRankingArithmetic       (4 tests)
    + class TestProcurementSupplierEvaluationArithmetic    (7 tests, 5 scorers + 2 boundary)
    + class TestProcurementCostMetricsArithmetic           (5 tests)
    + class TestProcurementTrendChartArithmetic            (3 tests)
    + class TestProcurementOverviewArithmetic              (5 tests, KPI + AI insights + suggestions)
    + class TestProcurementMoMGrowthArithmetic             (4 tests, T9 edge cases)
    + class TestProcurementConcentrationAlertArithmetic    (4 tests, T1 inverse boundary)
    + Map.of SALT flip detection deferred (procurement 无 Map.of 调用 — 验证 §8)
```

### 2.2 关键架构决策

1. **新文件 `analysis_procurement.py`** — 跟 sister precedent (`analysis_sales.py` / `analysis_finance.py` / `analysis_department.py` upcoming) 一致
2. **不复用 cost spec 的 `_query_finance_data`** — procurement 查 `material_batches` + `suppliers`（不同表 + JOIN）
3. **3 个 inline threshold pairs**, 不复用 `alert_thresholds.py`：
   - 70/85 ON_TIME_DELIVERY，90/95 QUALITY_PASS，60/40 SUPPLIER_CONCENTRATION (**inverse**)
   - alert_thresholds.json 无 procurement section (verified, §3.1 cite)
4. **`getBatchesInDateRange` SQL replacement** — Java in-memory filter anti-pattern (T3)，Python 直接 SQL `WHERE factory_id=$1 AND status='AVAILABLE' AND deleted_at IS NULL AND receipt_date BETWEEN $2 AND $3 ORDER BY id`
5. **`getTotalValue` inline mirror** (T10): `unitPrice × receiptQuantity` with both-null-check
6. **`calculateMomGrowth` inline + 3 edge cases** (T9): null/zero previous + null current + .abs() denom
7. **`_strip_volatile` 复用 `analysis_finance.py` import**, `lastUpdated` 已在 VOLATILE_KEYS（无需扩展）
8. **No Map.of usage** in procurement Java — Rule 8 SALT flip risk 不适用（5 dim radar 用 `Arrays.asList` 保 declaration order ✓）
9. **DashboardResponse 是 NEW DTO shape** — sister specs (region / inventory / sales overview) 可复用本 spec PR-B 模板
10. **rule-based aiInsights / suggestions**: `generateAiInsights` (line 914-975) 检查 thresholds 生成 message+actionSuggestion, `generateSuggestions` 短文; **NO LLM call**, byte-port-able
11. **Supplier `findById` 跨 factoryId leak risk** (T11): Python 端 `_query_supplier_by_id` 主动加 `AND factory_id = $X` 比 Java 更 safer; Java 端 RLS gap 列入 §8 deferred

---

## 3. Java 引用 + 算法

### 3.1 Java reference 表

| 函数 | 位置 | 备注 |
|---|---|---|
| Controller `/analysis/procurement` | `SmartBIAnalysisController.java:452-486` | 4 modes per-type dispatcher |
| `getProcurementOverview` (default mode) | `ProcurementAnalysisServiceImpl.java:76-122` | DashboardResponse + lastUpdated volatile |
| `getSupplierEvaluation` | 同上, 126-187 | RADAR 5-dim, dimensions = `Arrays.asList(5)` |
| `getSupplierRanking` | 同上, 333-340 | 委托 `calculateSupplierRankingFromData` |
| `getMaterialCategoryRanking` | 同上, 342-385 | groupBy + sort by value desc + percentage |
| `getPurchaseCostAnalysis` | 同上, 241-280 | PIE chart by material category |
| `getCostMetrics` | 同上, 282-329 | 4 metrics + MoM growth |
| `getProcurementTrendChart` | 同上, 387-... | LINE chart by period |
| `getBatchesInDateRange` (helper) | 同上, 451-456 | **T3 anti-pattern**: in-memory filter |
| `calculateTotalValue` | 同上, 540-545 | sum batches.totalValue, null-skip |
| `calculateAverageUnitPrice` | 同上, 550-563 | sum/count of positive prices, SCALE=4 |
| `calculateSupplierConcentration` | 同上, 568-... | max supplier share % |
| `calculateKpiCards` (for overview) | 同上, 462-535 | 5 KPI cards |
| `calculatePriceScore` | 同上, 596-... | dim score 1, default 70 |
| `calculateQualityScore` | 同上, 614-... | dim score 2 |
| `calculateDeliveryScore` | 同上, 638-... | dim score 3, default 80 |
| `calculateServiceScore` | 同上, 657-... | dim score 4, default 80 |
| `calculateStabilityScore` | 同上, 665-678 | dim score 5 = `100 - cv*100`, clamped [0, 100] |
| `generateAiInsights` | 同上, 914-975 | rule-based; concentration check + top-supplier highlight |
| `generateSuggestions` | 同上, 980-1005 | rule-based 短文 list |
| `buildEmptyDashboard` | 同上, 1011-1025 | empty fallback (lastUpdated still emits volatile) |
| `convertToKPICards` | 同上, ~836 | MetricResult → KPICard mapping |
| `formatCurrency` | 同上, 1138-1143 | `String.format("%,.2f", ...)` |
| `determineOnTimeAlertLevel` | 同上, 1080-1091 | 70/85, returns AlertLevel enum |
| `determineQualityAlertLevel` | 同上, 1096-1103 | 90/95, returns AlertLevel enum |
| `determineConcentrationAlertLevel` | 同上, 1109-1116 | 60/40 INVERSE, returns String |
| `determineChangeDirection` | 同上, 1122-1133 | UP/DOWN/STABLE |
| `MetricCalculatorServiceImpl.calculateMomGrowth` | `MetricCalculatorServiceImpl.java:425-438` | **T9**: 3 edge cases + `.abs()` denom |
| `MaterialBatch.getTotalValue` (alias) + `getTotalPrice` (impl) | `MaterialBatch.java:205-219` (`@Transient`) | `getTotalValue()` (line 216-219) is alias for `getTotalPrice()` (line 205-211); formula `unitPrice × receiptQuantity`, both null-check returns ZERO |
| `MaterialBatchRepository.findByFactoryIdAndStatus` | `MaterialBatchRepository.java:134-146` | JPA derived, **NO ORDER BY** (T3) |
| `SupplierRepository.findByFactoryIdAndIsActive` | `SupplierRepository.java:43` | derived, NO ORDER BY |
| `SupplierRepository.findById` | inherited JpaRepository | **No factoryId filter** (T11 deferred) |
| `Supplier @Where(deleted_at IS NULL)` | `Supplier.java:33` | Hibernate soft-delete |
| `alert_thresholds.json` | (verified, no `procurement` key) | All 3 thresholds inline-only |

### 3.2 Imports

```python
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _get_period_key,         # Rule 2 — calendar-year WEEK fix (post-PR #30 commit 8031f2644)
                              # Used by §3.10d _get_procurement_trend_chart for WEEK period (sister composite reuse)
    _strip_volatile,         # already covers "lastUpdated" key
    VOLATILE_KEYS,
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,
    _utc_now_iso,
    _fetch_all,
    wrap_response,
)

# python-dateutil for `_minus_months(date, n)` helper used in §3.10b _get_cost_metrics
# (mirror Java startDate.minusMonths(1) — calendar-month arithmetic respecting end-of-month)
from dateutil.relativedelta import relativedelta

from smartbi_compat.auth import verify_factory_access, AuthContext
```

### 3.3 SQL helpers（T3 + T11 fix + Rule 5 + Rule 6）

```python
async def _query_material_batches_in_range(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getBatchesInDateRange (line 451-456) but as SQL not in-memory filter.

    ⚠️ T3 fix: Java uses `findByFactoryIdAndStatus(factoryId, AVAILABLE).stream()
    .filter(receiptDate in [start, end]).collect(toList())` — JPA derived query
    has NO ORDER BY → row order unstable across PG instances. Python adds explicit
    `ORDER BY id` for byte-shape determinism. Java side recommended same fix
    (out of Phase 2A scope).

    Rule 5: SELECT * future-proof for schema additions.
    Rule 6: input boundary None-check.
    Status filter: AVAILABLE (mirror Java MaterialBatchStatus.AVAILABLE enum).
    Soft-delete: WHERE deleted_at IS NULL (mirror @Where annotation).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_material_batches_in_range: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status = 'AVAILABLE'
          AND deleted_at IS NULL
          AND receipt_date BETWEEN $2 AND $3
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, start_date, end_date)


async def _query_active_suppliers(factory_id: str) -> list[dict]:
    """Mirror Java SupplierRepository.findByFactoryIdAndIsActive(factoryId, true).

    JPA derived query, NO ORDER BY in Java → row order unstable. Python adds
    explicit ORDER BY id for byte-shape determinism (T3 same).

    @Where(deleted_at IS NULL) on entity (Supplier.java:33) — mirror.
    """
    sql = """
        SELECT *
        FROM suppliers
        WHERE factory_id = $1
          AND is_active = true
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id)


async def _query_supplier_by_id(supplier_id: str, factory_id: str) -> Optional[dict]:
    """Mirror Java SupplierRepository.findById(supplierId), but with explicit
    factory_id filter (T11 fix — safer than Java).

    ⚠️ T11 — Java line 420/720/850/960 uses `supplierRepository.findById(supplierId)`
    WITHOUT factoryId filter. uniqueConstraint on Supplier is (factory_id, code) NOT
    on id, so id is globally unique by GenerationType.IDENTITY but cross-factory
    leak risk EXISTS if id reused or shared.

    Python adds explicit `AND factory_id = $2` — defensive vs Java behavior. Java
    side fix is OUT OF PHASE 2A SCOPE (deferred RLS gap, see §8).

    @Where(deleted_at IS NULL) on entity (Supplier.java:33) — mirror.
    Returns None if not found (mirror Optional.empty() Java behavior).
    """
    if supplier_id is None:
        return None
    sql = """
        SELECT *
        FROM suppliers
        WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL
        LIMIT 1
    """
    rows = await _fetch_all(sql, supplier_id, factory_id)
    return rows[0] if rows else None
```

### 3.4 `_calculate_total_value` (T10) + `_calculate_average_unit_price`

```python
def _calculate_total_value(batches: list[dict]) -> Decimal:
    """Mirror Java calculateTotalValue (line 540-545):
        batches.stream().map(MaterialBatch::getTotalValue).filter(nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add)

    `getTotalValue()` is @Transient (MaterialBatch.java:216-...):
        if (unitPrice == null || receiptQuantity == null) return ZERO;
        return unitPrice.multiply(receiptQuantity);

    Python equivalent inline (avoid 函数嵌套): only sum batches where BOTH unit_price
    AND receipt_quantity are non-null (Java's `null-check returns ZERO` semantics
    are equivalent to skipping null rows; ZERO contributes nothing to sum).

    Rule 1: explicit is-None check.
    """
    total = Decimal("0")
    for b in batches:
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        if up is not None and rq is not None:
            total += _to_decimal(up) * _to_decimal(rq)
    return total


def _calculate_average_unit_price(batches: list[dict]) -> Decimal:
    """Mirror Java calculateAverageUnitPrice (line 550-563):
        prices = batches.stream().map(getUnitPrice).filter(nonNull)
            .filter(p > 0).collect(toList())
        if (prices.isEmpty()) return ZERO
        sum = prices.stream().reduce(ZERO, ::add)
        return sum.divide(new BigDecimal(prices.size()), SCALE=4, HALF_UP)

    Note: 仅 unit_price > 0 才计入 (filter > 0)。这是有效价 average，不是总价 / 总数量。
    """
    prices = []
    for b in batches:
        up = b.get("unit_price")
        if up is not None:
            up_dec = _to_decimal(up)
            if up_dec > Decimal("0"):
                prices.append(up_dec)
    if not prices:
        return Decimal("0")
    total = sum(prices, Decimal("0"))
    return (total / Decimal(len(prices))).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
```

### 3.5 `_calculate_mom_growth` (T9 — 3 edge cases + .abs() denom)

```python
def _calculate_mom_growth(current: Optional[Decimal], previous: Optional[Decimal]) -> Decimal:
    """Mirror Java MetricCalculatorServiceImpl.calculateMomGrowth (line 425-438).

    Java:
      if (previous == null || previous.compareTo(ZERO) == 0) {
          return current != null && current.compareTo(ZERO) > 0
              ? new BigDecimal("100") : ZERO;
      }
      if (current == null) return new BigDecimal("-100");
      return current.subtract(previous)
          .divide(previous.abs(), SCALE=4, HALF_UP)        // ⚠️ .abs() of denom
          .multiply(BigDecimal("100"))
          .setScale(DISPLAY_SCALE=2, HALF_UP);

    ⚠️ T9 lock — `.abs(previous)` 是关键边界:
    previous=Decimal("-50"), current=Decimal("10")
      → change = 60
      → 60 / abs(-50) = 60/50 = 1.20
      → * 100 = 120 (positive growth shown)
    NOT 60 / -50 = -1.20 → -120 (would flip sign incorrectly).
    Python 必须 mirror `previous.copy_abs()` 或 `abs(previous)`.

    Edge cases:
    - previous None or == 0:
        - current None or <= 0 → 0
        - current > 0 → 100 (literal "100% growth from baseline 0")
    - current None (with non-zero previous) → -100
    """
    if previous is None or previous == Decimal("0"):
        if current is not None and current > Decimal("0"):
            return Decimal("100")
        return Decimal("0")
    if current is None:
        return Decimal("-100")
    diff = current - previous
    return ((diff / abs(previous)).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100")).quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
```

### 3.6 `_calculate_supplier_concentration` (T1 inverse threshold)

```python
def _calculate_supplier_concentration(batches: list[dict]) -> Decimal:
    """Mirror Java calculateSupplierConcentration (line 568-...):
        Map<String, BigDecimal> supplierValues = batches.stream()
            .filter(b -> b.getSupplierId() != null)
            .collect(Collectors.groupingBy(
                MaterialBatch::getSupplierId,
                Collectors.reducing(ZERO, MaterialBatch::getTotalValue, ::add)
            ));
        BigDecimal total = supplierValues.values().stream().reduce(ZERO, ::add);
        BigDecimal max = supplierValues.values().stream().max(...).orElse(ZERO);
        return total > 0 ? max.divide(total, SCALE=4, HALF_UP).multiply(100) : ZERO;

    返回最大供应商占比百分比 (0-100), e.g. 60.5 = 60.5%.
    ⚠️ T1 inverse: > 60 → RED (集中度高=风险大), < 40 → GREEN (足够分散).
    """
    supplier_values: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is not None:
            up = b.get("unit_price")
            rq = b.get("receipt_quantity")
            tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
            supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv

    if not supplier_values:
        return Decimal("0")
    total = sum(supplier_values.values(), Decimal("0"))
    max_value = max(supplier_values.values())
    if total <= Decimal("0"):
        return Decimal("0")
    return ((max_value / total).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100"))
```

### 3.7 Threshold constants (T1) + alert helpers

```python
# T1 — 3 inline threshold pairs, NOT alert_thresholds.py (verified empty for procurement)

# Java line 62: ON_TIME_RED_THRESHOLD = 70, ON_TIME_YELLOW = 85
_PROCUREMENT_ON_TIME_RED    = Decimal("70")
_PROCUREMENT_ON_TIME_YELLOW = Decimal("85")

# Java line 66: QUALITY_RED = 90, QUALITY_YELLOW = 95
_PROCUREMENT_QUALITY_RED    = Decimal("90")
_PROCUREMENT_QUALITY_YELLOW = Decimal("95")

# Java line 70: CONCENTRATION_RED = 60, CONCENTRATION_YELLOW = 40 (INVERSE direction)
_PROCUREMENT_CONCENTRATION_RED    = Decimal("60")
_PROCUREMENT_CONCENTRATION_YELLOW = Decimal("40")

_SCALE             = Decimal("0.0001")     # SCALE=4
_DISPLAY_SCALE     = Decimal("0.01")       # DISPLAY_SCALE=2
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


def _determine_on_time_alert_level(delivery_rate: Decimal) -> str:
    """Mirror Java determineOnTimeAlertLevel (line 1080-1091): RED < 70, YELLOW < 85, GREEN.
    Java returns AlertLevel enum; Python returns str (mirror .name())."""
    if delivery_rate < _PROCUREMENT_ON_TIME_RED:
        return "RED"
    if delivery_rate < _PROCUREMENT_ON_TIME_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_quality_alert_level(quality_rate: Decimal) -> str:
    """Mirror Java determineQualityAlertLevel (line 1096-1103): RED < 90, YELLOW < 95, GREEN."""
    if quality_rate < _PROCUREMENT_QUALITY_RED:
        return "RED"
    if quality_rate < _PROCUREMENT_QUALITY_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_concentration_alert_level(concentration: Decimal) -> str:
    """Mirror Java determineConcentrationAlertLevel (line 1109-1116) — INVERSE direction:
        if (> 60) RED;
        if (> 40) YELLOW;
        return GREEN.

    ⚠️ T1 inverse — 集中度高 = 风险大, 跟 ON_TIME / QUALITY 阈值方向相反.
    PR-C `TestProcurementConcentrationAlertArithmetic` 显式 boundary tests:
      59.9 → GREEN, 40.0 → GREEN (NOT YELLOW; strict `> 40`),
      40.01 → YELLOW, 60.0 → YELLOW (strict `> 60` for RED), 60.01 → RED.
    """
    if concentration > _PROCUREMENT_CONCENTRATION_RED:
        return "RED"
    if concentration > _PROCUREMENT_CONCENTRATION_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_change_direction(change_percent: Optional[Decimal]) -> str:
    """Mirror Java determineChangeDirection (line 1122-1133):
        null → STABLE
        > 0 → UP
        < 0 → DOWN
        == 0 → STABLE
    """
    if change_percent is None:
        return "STABLE"
    if change_percent > Decimal("0"):
        return "UP"
    if change_percent < Decimal("0"):
        return "DOWN"
    return "STABLE"


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java formatCurrency (line 1138-1143):
        if (value == null) return "-";
        return String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue());

    ⚠️ T8 — 千分位 + 2 位小数, NO trailing "%". Different from formatMetricValue
    千分位 + 2 位 + "%" (used in department/region for completion rates).
    """
    if value is None:
        return "-"
    quantized = value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return f"{float(quantized):,.2f}"
```

### 3.8 5 dimension scorers for radar (T5)

```python
def _calculate_price_score(supplier: dict, supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculatePriceScore (~line 596-...).

    ⚠️ TBD via Round 2 follow-up grep — placeholder pseudo-code:
        rating = supplier.get("rating", 70)
        return Decimal(rating)  # default 70 from Java line 598

    Spec PR-A 第一步 record golden + read Java exact impl, update here.
    """
    pass  # TBD Java 596-...


def _calculate_quality_score(supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculateQualityScore (~line 614-...).

    Algorithm summary (from grep T1 thresholds + interface comment):
      - 计算 supplier 批次的质量合格率 = pass_count / total_batches * 100
      - default 85 (line 626/631)
    """
    pass  # TBD Java 614-...


def _calculate_delivery_score(supplier: dict, supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculateDeliveryScore (~line 638-...).

    Algorithm summary (from interface comment 'expected delivery days'):
      - actual delivery days vs supplier.expected_delivery_days
      - default 80 (line 640/650)
    """
    pass  # TBD Java 638-...


def _calculate_service_score(supplier: dict) -> Decimal:
    """Mirror Java calculateServiceScore (~line 657-...).
    Based on supplier.rating, default 80 (line 659/667).
    """
    pass  # TBD Java 657-...


def _calculate_stability_score(supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculateStabilityScore (line 665-678).

    Coefficient-of-variation based:
      cv = stddev(batch_quantities) / mean(batch_quantities)
      score = 100 - cv * 100
      score.clamp(0, 100)

    Java line 677-678:
      BigDecimal score = new BigDecimal("100").subtract(cv.multiply(new BigDecimal("100")));
      return score.max(BigDecimal.ZERO).min(new BigDecimal("100"));

    Python:
      score = Decimal("100") - cv * Decimal("100")
      return max(Decimal("0"), min(score, Decimal("100")))
    """
    pass  # impl in PR-A，pseudo confirmed by Java line 677-678
```

⚠️ §3.8 dimension scorer pseudo-code 是 placeholder - PR-A 第一步必须 read Java exact impl line 596-678 (full body) 然后 fill in。Spec 锁定 5 scorers 接口 + default 数值 + clamp 语义，具体公式 PR-A plan 阶段补完。

### 3.9 `_get_supplier_evaluation` radar chart (T5 — Arrays.asList ordering)

```python
async def _get_supplier_evaluation(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getSupplierEvaluation (line 126-187).

    ⚠️ T5 lock — `dimensions` + `dimensionNames` are Java `Arrays.asList(5)` (line 175-178)
    which preserves declaration order (NOT Map.of(N) — Rule 8 SALT flip NOT applicable).
    Python list literal preserves insertion order natively. ✓
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    suppliers = await _query_active_suppliers(factory_id)

    chart_data = []
    for supplier in suppliers:
        supplier_batches = [b for b in batches if b.get("supplier_id") == supplier["id"]]
        if not supplier_batches:
            continue

        # Java line 145-167: LinkedHashMap put-order
        # [supplierName, priceCompetitiveness, qualityPassRate, onTimeDelivery,
        #  serviceResponse, supplyStability]
        data_point = {
            "supplierName":          supplier["name"],
            "priceCompetitiveness":  _decimal_to_number(_calculate_price_score(supplier, supplier_batches)),
            "qualityPassRate":       _decimal_to_number(_calculate_quality_score(supplier_batches)),
            "onTimeDelivery":        _decimal_to_number(_calculate_delivery_score(supplier, supplier_batches)),
            "serviceResponse":       _decimal_to_number(_calculate_service_score(supplier)),
            "supplyStability":       _decimal_to_number(_calculate_stability_score(supplier_batches)),
        }
        chart_data.append(data_point)

    # Java line 172-178: LinkedHashMap put-order
    # [showLegend, maxValue, dimensions, dimensionNames]
    options = {
        "showLegend": True,
        "maxValue":   100,
        "dimensions": [
            "priceCompetitiveness", "qualityPassRate", "onTimeDelivery",
            "serviceResponse",      "supplyStability",
        ],
        "dimensionNames": [
            "价格竞争力", "质量合格率", "准时交付", "服务响应", "供货稳定",
        ],
    }

    # Java line 180-186: ChartConfig builder
    return {
        "chartType":   "RADAR",
        "title":       "供应商综合评估",
        "xAxisField":  "supplierName",
        "yAxisField":  None,         # NOT set in Java builder, Jackson emits null
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }
```

### 3.10a `_get_supplier_ranking` (delegates to `_calculate_supplier_ranking_from_data`)

```python
async def _get_supplier_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getSupplierRanking (line 333-340) — delegates to
    calculateSupplierRankingFromData.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    return await _calculate_supplier_ranking_from_data(factory_id, batches)


async def _calculate_supplier_ranking_from_data(
    factory_id: str, batches: list[dict]
) -> list[dict]:
    """Mirror Java calculateSupplierRankingFromData (line 684-739).

    ⚠️ T11 enforced: Java uses `supplierRepository.findById(supplierId)` (line 720)
    without factoryId — Python uses `_query_supplier_by_id(supplier_id, factory_id)`
    which adds `AND factory_id=$X`.

    ⚠️ T11 fallback: Java line 721 `.orElse(supplierId)` — if supplier not found,
    use supplier_id literal as name. Python mirror.

    RankingItem JSON shape (Java @Builder field order):
      [rank, name, value, target, completionRate, alertLevel]

    Algorithm:
    1. groupBy supplier_id, sum getTotalValue → supplier_values dict
    2. groupBy supplier_id, count → supplier_batch_counts dict
    3. Sum all supplier_values → totalValue
    4. Sort supplier_values entries by value desc (T4 pattern)
    5. For each: lookup supplier name (T11 enforced query),
       compute percentage = value/total * 100,
       compute qualityRate via _calculate_quality_score,
       alertLevel via _determine_quality_alert_level (90/95)
    """
    # Step 1: group by supplier_id, sum total_value
    supplier_values: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is not None:
            up = b.get("unit_price")
            rq = b.get("receipt_quantity")
            tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
            supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv

    # Step 2: group by supplier_id, count batches
    supplier_batch_counts: dict[str, int] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is not None:
            supplier_batch_counts[sid] = supplier_batch_counts.get(sid, 0) + 1

    if not supplier_values:
        return []

    # Step 3: total value across all suppliers
    total_value = sum(supplier_values.values(), Decimal("0"))

    # Step 4: sort by value desc (T4 — Python sorted() stable matches Java Stream.sorted)
    sorted_entries = sorted(supplier_values.items(), key=lambda kv: kv[1], reverse=True)

    # Step 5: build RankingItem entries
    rankings = []
    for rank, (supplier_id, value) in enumerate(sorted_entries, start=1):
        batch_count = supplier_batch_counts.get(supplier_id, 0)
        percentage = (
            (value / total_value).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP) * Decimal("100")
            if total_value > Decimal("0")
            else Decimal("0")
        )
        # T11 enforced query (factory_id filter) — fallback to supplier_id literal if not found
        supplier = await _query_supplier_by_id(supplier_id, factory_id)
        supplier_name = supplier["name"] if supplier else supplier_id

        # Quality rate via dimension scorer + alert level
        supplier_batches = [b for b in batches if b.get("supplier_id") == supplier_id]
        quality_rate = _calculate_quality_score(supplier_batches)
        alert_level = _determine_quality_alert_level(quality_rate)

        rankings.append({
            "rank":           rank,
            "name":           supplier_name,
            "value":          _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "target":         batch_count,    # Java uses `new BigDecimal(batchCount)` — int → number
            "completionRate": _decimal_to_number(percentage.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "alertLevel":     alert_level,
        })

    return rankings
```

⚠️ §3.10a — `target` field semantically holds batch count (int), NOT a sales target. Java uses RankingItem.target field for arbitrary numeric metadata. Python preserves int directly via `_decimal_to_number(Decimal(batch_count))` or just int (golden record verifies serialization).

### 3.10b `_get_cost_metrics` (5 metrics)

```python
async def _get_cost_metrics(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getCostMetrics (line 282-329).

    Returns 5 MetricResult entries (when previous period non-empty):
      [PROCUREMENT_AMOUNT, BATCH_COUNT, AVG_UNIT_PRICE, MAX_UNIT_PRICE, PROCUREMENT_MOM_GROWTH]

    Or 4 entries if previous-month batches empty (skips MoM).

    MetricResult JSON shape (Java @Builder field order):
      [metricCode, metricName, value, formattedValue, unit, dimensionValue,
       changeValue, changePercent, changeDirection, alertLevel, description]
    Empty-fallback fields emit null per Lombok @Builder default.

    MAX_UNIT_PRICE conditional: only emitted if any batch has non-null unit_price
    (Java line 302-314 `Optional.max(...).isPresent()`).
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    metrics: list[dict] = []

    # Metric 1: PROCUREMENT_AMOUNT
    total_amount = _calculate_total_value(batches)
    metrics.append(_metric_result_of("PROCUREMENT_AMOUNT", "采购总额", total_amount, "元"))

    # Metric 2: BATCH_COUNT
    metrics.append(_metric_result_of("BATCH_COUNT", "采购批次", Decimal(len(batches)), "批"))

    # Metric 3: AVG_UNIT_PRICE
    avg_price = _calculate_average_unit_price(batches)
    metrics.append(_metric_result_of("AVG_UNIT_PRICE", "平均单价", avg_price, "元"))

    # Metric 4: MAX_UNIT_PRICE (conditional — Java line 302-314)
    valid_priced = [b for b in batches if b.get("unit_price") is not None]
    if valid_priced:
        max_batch = max(valid_priced, key=lambda b: _to_decimal(b["unit_price"]))
        max_unit_price = _to_decimal(max_batch["unit_price"])
        metrics.append({
            "metricCode":      "MAX_UNIT_PRICE",
            "metricName":      "最高单价",
            "value":           _decimal_to_number(max_unit_price),
            "formattedValue":  None,    # Java doesn't set formattedValue here
            "unit":            "元",
            "dimensionValue":  max_batch.get("material_type_id"),
            "changeValue":     None,
            "changePercent":   None,
            "changeDirection": None,
            "alertLevel":      "GREEN",    # Java line 312 explicit GREEN
            "description":     None,
        })

    # Metric 5: MoM growth — conditional on previous period non-empty
    previous_start = start_date.replace(month=start_date.month) - _months(1)  # placeholder; impl uses dateutil or manual
    # ⚠️ Python date arithmetic: start_date.minusMonths(1) Java equivalent
    # Java line 317-318:
    #   LocalDate previousStart = startDate.minusMonths(1);
    #   LocalDate previousEnd = endDate.minusMonths(1);
    # Python: from dateutil.relativedelta import relativedelta
    #   previous_start = start_date - relativedelta(months=1)
    #   previous_end = end_date - relativedelta(months=1)
    previous_start, previous_end = _minus_months(start_date, 1), _minus_months(end_date, 1)
    previous_batches = await _query_material_batches_in_range(factory_id, previous_start, previous_end)

    if previous_batches:
        previous_amount = _calculate_total_value(previous_batches)
        mom_growth = _calculate_mom_growth(total_amount, previous_amount)
        direction = _determine_change_direction(mom_growth)
        metrics.append({
            "metricCode":      "PROCUREMENT_MOM_GROWTH",
            "metricName":      "采购环比增长",
            "value":           _decimal_to_number(mom_growth.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "formattedValue":  None,
            "unit":            "%",
            "dimensionValue":  None,
            "changeValue":     _decimal_to_number(mom_growth),    # Java line 324: changeValue = momGrowth
            "changePercent":   _decimal_to_number(mom_growth),
            "changeDirection": direction,
            "alertLevel":      None,    # Java MetricResult.ofWithTrend doesn't set alert
            "description":     None,
        })

    return metrics
```

⚠️ §3.10b uses `_metric_result_of` (helper builder) + `_minus_months(d, n)` (date arithmetic). Both are utility helpers — PR-A first task to implement (~10 LOC each) using `python-dateutil` (likely already in requirements) or manual month arithmetic.

### 3.10c `_get_material_category_ranking` (T4 + percentage)

```python
async def _get_material_category_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getMaterialCategoryRanking (line 342-385).

    Algorithm:
    1. groupBy material_type_id (skip null), sum total_value
    2. Sum all → totalValue
    3. Sort entries by value desc (T4 pattern)
    4. For each: percentage = value/total * 100, no alert (NO determine_X_alert_level)

    RankingItem fields (Java line ~378-385):
      [rank, name, value, completionRate (= percentage)]
    NO target / alertLevel — emit null/missing.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    # Step 1: groupBy material_type_id
    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is not None:
            up = b.get("unit_price")
            rq = b.get("receipt_quantity")
            tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
            category_values[mtid] = category_values.get(mtid, Decimal("0")) + tv

    if not category_values:
        return []

    total_value = sum(category_values.values(), Decimal("0"))

    # Step 3: sort by value desc
    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (mtid, value) in enumerate(sorted_entries, start=1):
        percentage = (
            (value / total_value).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP) * Decimal("100")
            if total_value > Decimal("0")
            else Decimal("0")
        )
        rankings.append({
            "rank":           rank,
            "name":           mtid,
            "value":          _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "target":         None,    # Java doesn't set target
            "completionRate": _decimal_to_number(percentage.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "alertLevel":     None,    # Java doesn't set alert
        })
    return rankings
```

### 3.10d `_get_procurement_trend_chart` (period dispatcher)

```python
async def _get_procurement_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Mirror Java getProcurementTrendChart (line 387-...) → buildProcurementTrendChartFromData
    (line 744-782).

    Period-based aggregation:
      DAY   → date.toString() = ISO yyyy-MM-dd                 (line 791)
      WEEK  → ISO week per Rule 2 (calendar year + ISO week)   (line ~810, mirror analysis_finance._get_period_key)
      MONTH → "yyyy-MM" (line ~825)

    ⚠️ Rule 2 lock — when period="WEEK", Python MUST import _get_period_key from
    analysis_finance.py (post-PR #30 calendar-year fix commit `8031f2644`).
    Composite trend mode hardcodes period="MONTH" so Rule 2 not directly hit
    in PR-A, but PR-C `test_period_key_calendar_year` regression covers WEEK
    edge case for sister specs reusing this function.

    Java line 760-768: sort by period key (TreeMap → sorted dict) + LinkedHashMap
    chart point with [date, amount] keys.

    Java line 770-772: options LinkedHashMap [showDataLabels=false, smooth=true].
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    period_values: dict[str, Decimal] = {}
    for b in batches:
        rd = b.get("receipt_date")
        if rd is None:
            continue
        # Period key by aggregation type
        period_upper = period.upper()
        if period_upper == "WEEK":
            period_key = _get_period_key(rd, "WEEK")    # Rule 2 — import from analysis_finance
        elif period_upper == "MONTH":
            period_key = f"{rd.year}-{rd.month:02d}"
        else:    # DAY default
            period_key = rd.isoformat()
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        period_values[period_key] = period_values.get(period_key, Decimal("0")) + tv

    # Java line 760-768: sort by period key (TreeMap → sorted())
    sorted_keys = sorted(period_values.keys())
    chart_data = []
    for period_key in sorted_keys:
        chart_data.append({
            "date":   period_key,
            "amount": _decimal_to_number(
                period_values[period_key].quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        })

    options = {
        "showDataLabels": False,
        "smooth":         True,
    }

    return {
        "chartType":   "LINE",
        "title":       "采购趋势",
        "xAxisField":  "date",
        "yAxisField":  "amount",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }
```

⚠️ §3.10d imports `_get_period_key` from `analysis_finance.py` for WEEK case — needs §3.2 import addition.

### 3.10 `_get_purchase_cost_analysis` (T4 groupingBy + sort pattern)

```python
async def _get_purchase_cost_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getPurchaseCostAnalysis (line 241-280).

    ⚠️ T4 lock — Java uses `Collectors.groupingBy + entrySet().stream().sorted(by-value-desc)`.
    Java HashMap (groupingBy default) iteration is JVM-randomized BUT immediate
    `entrySet().sorted(comparingByValue().reversed())` makes output deterministic.

    Python `dict` + `sorted(items.items(), key=value, reverse=True)` is byte-equivalent.

    Empty case: groupingBy on filtered empty list → empty dict → empty chart_data.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    # group by material_type_id, sum total_value
    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is not None:
            up = b.get("unit_price")
            rq = b.get("receipt_quantity")
            tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
            category_values[mtid] = category_values.get(mtid, Decimal("0")) + tv

    # Java line 258-266: sort by value desc, build LinkedHashMap data points
    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)
    chart_data = []
    for mtid, value in sorted_entries:
        chart_data.append({
            "category": mtid,
            "value":    _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        })

    # Java line 268-270: options LinkedHashMap [showPercentage, showLegend]
    options = {
        "showPercentage": True,
        "showLegend":     True,
    }

    return {
        "chartType":   "PIE",
        "title":       "采购成本分布",
        "xAxisField":  "category",
        "yAxisField":  "value",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }
```

### 3.11 `_get_procurement_overview` (DashboardResponse, T6)

```python
async def _get_procurement_overview(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getProcurementOverview (line 76-122).

    DashboardResponse JSON shape (Java @Builder field order):
      [kpiCards, charts, rankings, aiInsights, suggestions, lastUpdated]

    Empty batches → buildEmptyDashboard (line 1011-1025) — emits empty arrays/maps
    + lastUpdated still volatile.

    ⚠️ T6 lock — DashboardResponse is NEW DTO shape; sister Tier 2 specs (region/inventory)
    可复用本 PR-B 模板 (kpiCards / charts / rankings / aiInsights / suggestions / lastUpdated).
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    if not batches:
        return _build_empty_dashboard()

    # Java line 89-91: KPI cards
    metric_results = await _build_kpi_cards(batches, factory_id, start_date, end_date)
    kpi_cards = _convert_metric_results_to_kpi_cards(metric_results)

    # Java line 93-101: charts LinkedHashMap by chart.title.replace(" ", "_")
    chart_list = [
        _build_procurement_trend_chart_from_batches(batches, period="DAY"),
        _build_supplier_pie_chart(batches),
        _build_material_category_chart(batches),
    ]
    charts: dict[str, dict] = {}
    for i, chart in enumerate(chart_list):
        title = chart.get("title")
        key = title.replace(" ", "_") if title else f"chart_{len(charts)}"
        charts[key] = chart

    # Java line 103-106: rankings LinkedHashMap with key "supplier"
    supplier_rankings = _calculate_supplier_ranking_from_data(batches)
    rankings = {"supplier": supplier_rankings}

    # Java line 109-112: rule-based generators (NO LLM)
    ai_insights = _generate_ai_insights(batches, metric_results)
    suggestions = _generate_suggestions(batches, metric_results)

    # Java line 114-121: DashboardResponse @Builder field order:
    return {
        "kpiCards":    kpi_cards,
        "charts":      charts,
        "rankings":    rankings,
        "aiInsights":  ai_insights,
        "suggestions": suggestions,
        "lastUpdated": _utc_now_iso(),    # T2 volatile, stripped by _strip_volatile in tests
    }


def _build_empty_dashboard() -> dict:
    """Mirror Java buildEmptyDashboard (line 1011-1025).

    ⚠️ C2 fix (Round 4 audit) — exact Java strings, NOT placeholder text:
    Java line 1016-1022 (verbatim):
      .aiInsights(Collections.singletonList(AIInsight.builder()
              .level("YELLOW")                                      ← NOT "INFO"
              .category("数据状态")
              .message("当前时间范围内暂无采购数据")                 ← NOT "暂无采购数据"
              .actionSuggestion("请调整时间范围或录入采购数据")     ← NOT None
              .build()))
      .suggestions(Collections.singletonList("请先录入采购数据以开始分析"))  ← NOT []
    """
    return {
        "kpiCards":    [],
        "charts":      {},
        "rankings":    {},
        "aiInsights":  [{
            "level":            "YELLOW",
            "category":         "数据状态",
            "message":          "当前时间范围内暂无采购数据",
            "actionSuggestion": "请调整时间范围或录入采购数据",
            "relatedEntity":    None,
        }],
        "suggestions": ["请先录入采购数据以开始分析"],
        "lastUpdated": _utc_now_iso(),    # Still emits volatile field even on empty
    }
```

### 3.12 `_generate_ai_insights` (T6 — rule-based, NO LLM)

```python
def _generate_ai_insights(
    batches: list[dict], kpi_cards: list[dict]
) -> list[dict]:
    """Mirror Java generateAiInsights (line 914-975).

    ⚠️ T6 — NO LLM call, fully rule-based. Two checks:
    1. Supplier concentration alert (RED if > 60, YELLOW if > 40)
    2. Top supplier highlight (INFO level, names the largest supplier)

    AIInsight JSON shape (Java @Builder field order):
      [level, category, message, actionSuggestion, relatedEntity]

    Note: Java uses MetricResult.getValue() which is BigDecimal. message uses
    `String.format("%.1f%%", val.doubleValue())` — Python `f"{val:.1f}%"`.
    Java uses `formatCurrency(...)` for amount — Python `_format_currency(...)`.
    """
    insights: list[dict] = []

    # Check 1: supplier concentration
    concentration_metric = next(
        (m for m in kpi_cards if m.get("metricCode") == "SUPPLIER_CONCENTRATION"),
        None,
    )
    if concentration_metric is not None and concentration_metric.get("value") is not None:
        concentration = _to_decimal(concentration_metric["value"])
        if concentration > _PROCUREMENT_CONCENTRATION_RED:
            insights.append({
                "level":            "RED",
                "category":         "供应商风险",
                "message":          f"供应商集中度高达 {float(concentration):.1f}%，存在供应链风险",
                "actionSuggestion": "建议开发备选供应商，分散采购风险",
                "relatedEntity":    None,
            })
        elif concentration > _PROCUREMENT_CONCENTRATION_YELLOW:
            insights.append({
                "level":            "YELLOW",
                "category":         "供应商风险",
                "message":          f"供应商集中度为 {float(concentration):.1f}%，需要关注",
                "actionSuggestion": "建议评估备选供应商，降低依赖度",
                "relatedEntity":    None,
            })

    # Check 2: top supplier (info-level, requires lookup)
    # ⚠️ Round 4 audit I4 fix — function signature MUST include factory_id parameter
    # for T11 enforced supplier name lookup. Update §3.11 _get_procurement_overview
    # to pass factory_id when calling _generate_ai_insights. PR-B implementer
    # MUST refactor signature; do NOT ship `supplier_name = "未知供应商"` placeholder
    # below — that hardcoded fallback would FAIL byte-shape vs Java which calls
    # `supplierRepository.findById(supplierId).map(::getName).orElse(...)` and gets
    # real supplier names.

    supplier_values: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is not None:
            up = b.get("unit_price")
            rq = b.get("receipt_quantity")
            tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
            supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv

    if supplier_values:
        top_sid = max(supplier_values.keys(), key=lambda k: supplier_values[k])
        top_value = supplier_values[top_sid]
        # PR-B refactor target: signature is `_generate_ai_insights(factory_id, batches, kpi_cards)`
        # then here: `supplier = await _query_supplier_by_id(top_sid, factory_id)`
        #            `supplier_name = supplier["name"] if supplier else top_sid`  (mirror Java line 720-721)
        # Below is illustrative-only — actual PR-B impl pulls supplier name via T11 enforced query.
        supplier_name = "<TBD-PR-B: query via factory_id>"
        insights.append({
            "level":            "INFO",
            "category":         "采购分布",
            "message":          f"最大供应商 {supplier_name} 采购金额 {_format_currency(top_value)} 元",
            "actionSuggestion": "建议与该供应商协商更优惠的采购条款",
            "relatedEntity":    supplier_name,
        })

    return insights
```

⚠️ §3.12 — Round 4 audit I4 fix: `_generate_ai_insights` signature **MUST** be refactored to `(factory_id, batches, kpi_cards)` in PR-B. The `supplier_name = "<TBD-PR-B: query via factory_id>"` placeholder above is illustrative only. PR-B 实施时:
1. 加 `factory_id: str` 作首参数
2. 调用 `await _query_supplier_by_id(top_sid, factory_id)` (T11 enforced query)
3. Fallback name: `supplier["name"] if supplier else top_sid` (mirror Java line 720-721 `.orElse(supplierId)`)
4. Update caller `_get_procurement_overview` (§3.11) 传 `auth.factory_id`

### 3.13 主 dispatcher

```python
analysis_procurement_router = APIRouter()


@analysis_procurement_router.get(
    "/api/mobile/{factoryId}/smart-bi/analysis/procurement"
)
async def get_procurement_analysis(
    factoryId: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    analysisType: Optional[str] = Query(None),
    auth: AuthContext = Depends(verify_factory_access),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getProcurementAnalysis (line 452-486).

    4 modes by analysisType: supplier / cost / trend / null (default = overview).
    """
    result = await _get_procurement_analysis(
        auth.factory_id, startDate, endDate, analysisType
    )
    return wrap_response(result)


async def _get_procurement_analysis(
    factory_id: str, start_date: date, end_date: date, analysis_type: Optional[str]
) -> dict:
    """4-mode dispatcher mirror Java line 462-479.

    Java HashMap key put-order at top level: [startDate, endDate, ...mode-specific].
    Jackson serializes HashMap in hash-iteration order, NOT put-order — actual
    order TBD via golden record (4 separate goldens, one per mode).
    """
    base = {
        "startDate": start_date.isoformat(),
        "endDate":   end_date.isoformat(),
    }

    if analysis_type == "supplier":
        ranking    = await _get_supplier_ranking(factory_id, start_date, end_date)
        evaluation = await _get_supplier_evaluation(factory_id, start_date, end_date)
        return {**base, "ranking": ranking, "evaluation": evaluation}

    if analysis_type == "cost":
        metrics          = await _get_cost_metrics(factory_id, start_date, end_date)
        cost_analysis    = await _get_purchase_cost_analysis(factory_id, start_date, end_date)
        category_ranking = await _get_material_category_ranking(factory_id, start_date, end_date)
        return {**base, "metrics": metrics, "costAnalysis": cost_analysis, "categoryRanking": category_ranking}

    if analysis_type == "trend":
        trend_chart = await _get_procurement_trend_chart(factory_id, start_date, end_date, "MONTH")
        return {**base, "trendChart": trend_chart}

    # default = overview
    overview = await _get_procurement_overview(factory_id, start_date, end_date)
    return {**base, "overview": overview}
```

⚠️ §3.13 — top-level dict key 顺序是 PR-A 第一步 record golden 后确定 (4 个 goldens 分别)，**实际 Java HashMap hash-iteration 顺序可能 ≠ Java put-order**。Spec PR-A 实施时 update §3.13 dict literal + §4 placeholders to match。

---

## 4. F999 byte-shape gates（4 个 goldens）

### 4.1 4 个 mode-specific goldens

```bash
# PR-A: 3 per-type modes
./scripts/record-java-golden.sh F999 \
    "/api/mobile/F999/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=supplier" \
    tests/fixtures/java-smartbi-golden/analysis-procurement-F999-supplier.json

./scripts/record-java-golden.sh F999 \
    "/api/mobile/F999/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=cost" \
    tests/fixtures/java-smartbi-golden/analysis-procurement-F999-cost.json

./scripts/record-java-golden.sh F999 \
    "/api/mobile/F999/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=trend" \
    tests/fixtures/java-smartbi-golden/analysis-procurement-F999-trend.json

# PR-B: default mode (overview DashboardResponse)
./scripts/record-java-golden.sh F999 \
    "/api/mobile/F999/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31" \
    tests/fixtures/java-smartbi-golden/analysis-procurement-F999-default.json
```

### 4.2 期望 shape (placeholder, 实际 record 后 update)

**supplier mode**:
```json
{
  "code": 200, "message": "操作成功", "success": true, "timestamp": "<volatile>",
  "data": {
    "startDate": "2025-01-01", "endDate": "2025-12-31",
    "ranking": [],
    "evaluation": {
      "chartType": "RADAR", "title": "供应商综合评估",
      "xAxisField": "supplierName", "yAxisField": null, "seriesField": null,
      "data": [],
      "options": {
        "showLegend": true, "maxValue": 100,
        "dimensions": ["priceCompetitiveness", "qualityPassRate", "onTimeDelivery", "serviceResponse", "supplyStability"],
        "dimensionNames": ["价格竞争力", "质量合格率", "准时交付", "服务响应", "供货稳定"]
      }
    }
  }
}
```

**cost mode**:
```json
{
  "code": 200, "message": "操作成功", "success": true, "timestamp": "<volatile>",
  "data": {
    "startDate": "2025-01-01", "endDate": "2025-12-31",
    "metrics": [],
    "costAnalysis": {
      "chartType": "PIE", "title": "采购成本分布",
      "xAxisField": "category", "yAxisField": "value", "seriesField": null,
      "data": [],
      "options": {"showPercentage": true, "showLegend": true}
    },
    "categoryRanking": []
  }
}
```

**trend mode**:
```json
{
  "code": 200, "message": "操作成功", "success": true, "timestamp": "<volatile>",
  "data": {
    "startDate": "2025-01-01", "endDate": "2025-12-31",
    "trendChart": {
      "chartType": "LINE", "title": "采购趋势",
      "xAxisField": "period", "yAxisField": "amount", "seriesField": null,
      "data": [],
      "options": {"period": "MONTH"}
    }
  }
}
```

**default mode**:
```json
{
  "code": 200, "message": "操作成功", "success": true, "timestamp": "<volatile>",
  "data": {
    "startDate": "2025-01-01", "endDate": "2025-12-31",
    "overview": {
      "kpiCards": [],
      "charts": {},
      "rankings": {},
      "aiInsights": [{
        "level": "YELLOW", "category": "数据状态",
        "message": "当前时间范围内暂无采购数据",
        "actionSuggestion": "请调整时间范围或录入采购数据",
        "relatedEntity": null
      }],
      "suggestions": ["请先录入采购数据以开始分析"],
      "lastUpdated": "<volatile>"
    }
  }
}
```

⚠️ Top-level `data.*` key 顺序 4 个 goldens 各自 TBD (Java HashMap hash-iteration order). PR-A/B 第一步 record + update §3.13 dispatcher dict literal + §4.2 placeholder 真实顺序.

---

## 5. 测试策略

### 5.1 PR-A contract tests (per-type 3 modes)

```python
class TestAnalysisProcurementSupplierMode:
    def test_f999_supplier_data_keys_match_golden(self, client, monkeypatch): ...
    def test_f999_supplier_byte_shape(self, client, monkeypatch): ...
    def test_f999_supplier_radar_dimensions_exact_order(self, client, monkeypatch): ...
        # T5: dimensions list exact order ["priceCompetitiveness", ..., "supplyStability"]

class TestAnalysisProcurementCostMode:
    def test_f999_cost_data_keys_match_golden(self, ...): ...
    def test_f999_cost_byte_shape(self, ...): ...
    def test_f999_cost_pie_chart_options_order(self, ...): ...

class TestAnalysisProcurementTrendMode:
    def test_f999_trend_data_keys_match_golden(self, ...): ...
    def test_f999_trend_byte_shape(self, ...): ...
```

### 5.2 PR-B contract tests (default mode = overview)

```python
class TestAnalysisProcurementOverviewMode:
    def test_f999_default_overview_byte_shape(self, ...): ...
        # _strip_volatile masks data.overview.lastUpdated
    def test_f999_default_empty_dashboard_shape(self, ...): ...
        # AIInsight placeholder "暂无采购数据" exact shape
    def test_f999_default_dashboard_field_order(self, ...): ...
        # [kpiCards, charts, rankings, aiInsights, suggestions, lastUpdated]
```

### 5.3 PR-C arithmetic depth tests (33 tests across 7 classes)

| Class | Tests | 覆盖 |
|---|---|---|
| `TestProcurementSupplierRankingArithmetic` | 4 | sort by amount desc / tie-break / on-time-rate alert / negative-amount defensive |
| `TestProcurementSupplierEvaluationArithmetic` | 7 | 5 dimension scorers (1 each) + stability score `100 - cv*100` clamped boundary + empty-batches case |
| `TestProcurementCostMetricsArithmetic` | 5 | total / avg unit price (filter > 0) / max unit price / batch count / MoM growth |
| `TestProcurementTrendChartArithmetic` | 3 | MONTH period / multi-month aggregation / sorted period axis |
| `TestProcurementOverviewArithmetic` | 6 | KPI build / AI insights concentration RED+YELLOW / suggestions trigger conditions / empty dashboard exact strings (C2 verify) / charts key naming / **concentration formula precision byte-eq** (Round 4 audit gap fix: `max=Decimal("60"), total=Decimal("100") → 60.0000` exactly) |
| `TestProcurementMoMGrowthArithmetic` | 4 | T9 edge cases: prev=null / prev=0 / current=null / **negative previous .abs() denom** |
| `TestProcurementConcentrationAlertArithmetic` | 4 | T1 inverse: 39.99→GREEN / 40.0→GREEN (strict `> 40`) / 40.01→YELLOW / 60.0→YELLOW / 60.01→RED |

### 5.4 Mock pattern

```python
async def fake_query_batches(factory_id, start_date, end_date):
    if factory_id == "F999":
        return []
    return [
        {
            "id": 1, "factory_id": "F001", "supplier_id": "SUP-A",
            "material_type_id": "MAT-001",
            "unit_price": Decimal("50.00"), "receipt_quantity": Decimal("100"),
            "receipt_date": date(2025, 6, 1),
            "status": "AVAILABLE", "deleted_at": None,
        },
        # ... more
    ]


async def fake_query_suppliers(factory_id):
    if factory_id == "F999":
        return []
    return [
        {"id": "SUP-A", "factory_id": "F001", "name": "供应商A", "rating": 85, "is_active": True},
    ]


monkeypatch.setattr("smartbi_compat.api.analysis_procurement._query_material_batches_in_range", fake_query_batches)
monkeypatch.setattr("smartbi_compat.api.analysis_procurement._query_active_suppliers", fake_query_suppliers)
```

### 5.5 F001 真窗（不进 CI）

cost spec §5.4 同模式 — Java backend record + Python curl + dict-eq diff（manual 两步），不依赖 `--compare` flag。

---

## 6. Byte gate 语义

参见 cost spec §6 + `.claude/rules/python-java-port.md` Rule 4。当前 dict-eq gate (json.load 后 dict 比较, 通过 `_strip_volatile` 移除 timestamps + lastUpdated)。strict-byte 是 Phase 2A backlog。

---

## 7. PR 切片 + 顺序

### PR-A — procurement per-type 3 modes (supplier + cost + trend)

**Title**: `Phase 2A: /analysis/procurement per-type 3 modes (supplier + cost + trend)`

**Scope**:
- §2.1 PR-A 文件清单
- §3.2-3.10 imports + SQL helpers + threshold consts + alert helpers + 5 dimension scorers (placeholder fill from Java line 596-678) + 3 mode entry points + dispatcher (without default mode)
- §5.1 contract tests (8 tests across 3 classes)
- §4.2 record 3 F999 goldens (supplier / cost / trend), update §3.13 dispatcher dict literal + §4.2 placeholders

**LOC 估**: ~600 (impl 380 + tests 130 + 3 goldens record + route registration ~ 50 + main.py edit ~10 + 5 scorers Java line 596-678 fill 30)

**CI gate**: pytest baseline + 8 tests

**依赖**:
- profit PR-A merged (`_strip_volatile` + `_decimal_to_number` + `_to_decimal` + `_utc_now_iso` + `_fetch_all` + `wrap_response` 已存在)
- 不依赖 PR-B

### PR-B — procurement default mode (overview DashboardResponse)

**Title**: `Phase 2A: /analysis/procurement default mode + DashboardResponse new shape`

**Scope**:
- §3.11 `_get_procurement_overview` + `_build_empty_dashboard`
- §3.12 `_generate_ai_insights` (rule-based, threshold checks)
- `_generate_suggestions` (rule-based 短文)
- KPI cards builder (5 KPI: total / batch count / avg / concentration with T1 alert / MoM growth)
- chart builders (trend DAY / supplier pie / material category)
- supplier ranking from data
- empty dashboard fallback
- DashboardResponse JSON shape new (sister specs reusable template)
- §5.2 contract tests (3 tests)
- §4.2 record default mode F999 golden + update §3.13 dispatcher dict literal default branch

**LOC 估**: ~450 (impl 280 + tests 80 + golden record + ~90 helpers)

**CI gate**: PR-A baseline + 3 tests

**依赖**: PR-A merged

### PR-C — procurement arithmetic depth (7 test classes, 33 tests)

Test count: 4 (ranking) + 7 (evaluation) + 5 (cost metrics) + 3 (trend) + 6 (overview) + 4 (MoM) + 4 (concentration) = **33 tests**.

**Title**: `Phase 2A: /analysis/procurement arithmetic depth tests`

**Scope**:
- §5.3 7 test classes, 33 tests 总
- T9 MoM growth edge cases (4 boundary tests including negative previous .abs() denom)
- T1 concentration inverse threshold boundary (4 tests)
- 5 dimension scorers boundary (clamp [0, 100], default scores, empty batches)
- Arithmetic byte-equal (e.g., concentration formula `max/total * 100` precision)

**LOC 估**: ~330 (tests only)

**CI gate**: PR-B baseline + 33 tests

### 顺序

```
1. spec doc commit + 4-cycle subagent audit + push（本 step ← we're here）
2. user 审 spec → OK
3. spec-only PR open (base main, head phase2a/spec-procurement)
4. PR review + merge
5. impl chat 1: writing-plans → PR-A plan ~14 tasks → subagent-driven impl → PR-A merge
6. impl chat 2: PR-B plan → impl → merge
7. impl chat 3: PR-C plan → impl → merge
8. cleanup
```

---

## 8. Open risks + mitigations

| # | 风险 | Mitigation |
|---|---|---|
| T1 | 3 个 inline thresholds — sister chat 误用 alert_thresholds.py | §3.7 inline `_PROCUREMENT_*_RED/YELLOW`, alert_thresholds.json 无 procurement section verified. PR-C 显式 boundary tests (含 T1 inverse 60/40) |
| T2 | `lastUpdated` × 2 sites volatile (default mode + empty fallback), 无 `generatedAt` | `_strip_volatile` 已覆盖 `lastUpdated`, 无需扩展 VOLATILE_KEYS |
| T3 | `getBatchesInDateRange` JPA 无 ORDER BY → row order non-deterministic | Python `_query_material_batches_in_range` 显式 `ORDER BY id`. Java 端 fix out of Phase 2A scope |
| T4 | `Collectors.groupingBy` HashMap iteration JVM-randomized | Procurement service **每次 groupingBy 后立即 `entrySet().sorted(...)`** → output deterministic. Python `dict + sorted(items())` 同模式. Verified 11+ 调用站点全 sort-after-group ✓ |
| T5 | Radar 5-dim ordering | `Arrays.asList(5)` (Java line 175-178) 保 declaration order; Rule 8 SALT flip **NOT applicable** (procurement 全 文件 0 个 Map.of(N) 调用) |
| T6 | DashboardResponse 是 NEW DTO shape | PR-B 完整 port + sister specs (region/inventory) 可复用模板. aiInsights/suggestions rule-based (NO LLM verified line 914-1005) |
| T7 | AIInsight.message format `%.1f%%` | Python `f"{x:.1f}%"` (NOT 千分位 — 不同于 formatCurrency) |
| T8 | 多 format strings — 不混用 | §3.7 `_format_currency` mirror `%,.2f` exact; AIInsight 用 `%.1f%%`; MoM 用 `%+.1f%%`; batch count 用 `%,d`. PR-C 各 1 个显式 byte-eq test |
| T9 | `calculateMomGrowth` 3 edge cases + `.abs()` denom | §3.5 完整 mirror including `abs(previous)`. PR-C `TestProcurementMoMGrowthArithmetic.test_negative_previous_abs_denom` 显式 verify (`previous=-50, current=10 → +120`, NOT `-120`) |
| T10 | `MaterialBatch.getTotalValue` `@Transient` = `unitPrice × receiptQuantity` with both null-check | §3.4 inline mirror; Python ZERO 当 either null. PR-C cost metrics test 含 null defensive |
| T11 | `supplierRepository.findById` no factoryId filter — cross-factory leak risk | Python `_query_supplier_by_id(supplier_id, factory_id)` 主动加 `AND factory_id = $X` (safer than Java). Java 端 fix **deferred — out of Phase 2A scope** (RLS gap, evaluation by Java backend team) |
| risk-A | Top-level dict key 跨 JVM HashMap iteration | 4 个 goldens 各自 record 后 update §3.13 dispatcher + §4.2 placeholder. String key hashCode deterministic per Java spec → cross-JVM stable empirically (cost/profit/payable/department/sales 5 specs 已 ship 无 flip 报告) |
| risk-B | `Map.of(N)` SALT flip | **NOT applicable** — procurement 0 Map.of 调用 (verified). Rule 8 §3.9 引用 only as preventive doc |
| risk-C | dimension scorer Java exact impl line 596-678 | §3.8 placeholder; PR-A 第一步 read Java 完整 fill in (~30 LOC) |
| risk-D | `_generate_ai_insights` signature 缺 factory_id (T11 supplier name lookup) | Plan 阶段决定: 加 factory_id 参数 vs cache supplier names in batches. PR-B 决定 |

---

## 9. References

- Sister spec (foundation): `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`
- Sister spec (cost - per-type 模板): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`
- Sister spec (profit - PR-A 来源): `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md`
- Sister spec (receivable - HashMap pattern precedent): `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md`
- Sister spec (sales-rankings): `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-rankings-design.md`
- Sister spec (department - composite Tier 2 pattern): `docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md` (你 Chat 4 ship)
- Sister spec (region - in flight): `phase2a/spec-region` branch (Chat 5)
- Java reference root: `backend/java/cretas-api/src/main/java/com/cretas/aims/`
- Java repository: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/{MaterialBatchRepository,SupplierRepository}.java`
- PR #30 lineage (Rule 2 calendar-year fix): commit `8031f2644`
- PR #35 lineage (Rule 8 Map.of(N) Jackson hash order): commit `5d284d38d` — `.claude/rules/python-java-port.md:329`
- PR #36 lineage (department spec, Tier 2 lock-in 模式): commit `91c43ec76`
- PR #37 lineage (defer quality + production, Process Rule §2.4 验证 procurement REAL): commit `e18affb82`
- Audit constraints: `.claude/rules/python-java-port.md` Rule 1-8
- Backlog map: `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md`
- Phase 2A scope lock: memory `project_apr30_tool_skill_stays_java.md`
