# Phase 2A `/analysis/department` Implementation Plan (PR-A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Python port of Java `/api/mobile/{factoryId}/smart-bi/analysis/department` composite endpoint (Tier 2, 4 sub-services) with byte-shape parity vs F999 golden.

**Architecture:** New file `backend/python/smartbi_compat/api/analysis_department.py` mirroring sister `analysis_finance.py` / `analysis_sales.py` patterns. 4 sub-services + composite assembler + 2 SQL helpers + 5 logic helpers. asyncpg pool pattern (no `_fetch_all` helper — inline `pool = await get_cretas_pool(); async with pool.acquire() as conn:` per sister code convention). Composite path always taken in prod (`?department=` filter is dead code; ignored).

**Tech Stack:** Python 3.8+, FastAPI, asyncpg, Decimal, pytest. Reuses helpers from `analysis_finance.py` (`_get_period_key`, `_strip_volatile`, `_decimal_to_number`, `_to_decimal`, `_utc_now_iso`, `wrap_response` via `schema_compat`).

**Spec reference:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md` (1250 LOC, merged in PR #36)

**Critical traps locked by spec** (all addressed by tasks below):
- **C1**: `headcount` aggregation is MAX (running `if-greater`), NOT SUM, NOT latest-by-date. Java code comment line 560 misleads (says "use latest"); actual impl is max. → Task 4 verify.
- **C2**: JPA `findByFactoryIdAndRecordDateBetween` has NO ORDER BY; Python adds `ORDER BY id`. → Task 2.
- **C3**: `_determine_quadrant` MUST be called per-point inside efficiency matrix loop; lifting avg out changes byte-shape. → Tasks 7, 11.
- **C4**: `_calculate_completion_rate` divide-by-zero check uses `target is None or target == Decimal("0")`. Arithmetic order: `((actual * 100) / target).quantize(SCALE)` — divide result quantized, NOT multiply. → Task 5.
- **I1**: `Map.of(2)` quadrantLines / `Map.of(4)` quadrantLabels SALT32L per-JVM flip risk (Rule 8). F999 empty doesn't trigger; PR-B detects. Spec mirrors first-record canonical order. → Task 11.
- **I3**: `per_capita_sales` / `per_capita_cost` columns from SELECT * MUST BE IGNORED (recompute from aggregated values). → Task 4.
- **I4**: `_query_department_daily_trend` SQL ORDER BY `order_date` ONLY (NOT order_date, department) — verbatim Java mirror. → Task 3.
- **I5**: `_create_empty_chart` emits `null` for unset fields (Java `ChartConfig` DTO has no `@JsonInclude` annotation). → Task 8.
- **T1**: `_DEPARTMENT_TARGET_COMPLETION_RED/_YELLOW = 60/85` HARDCODED inline, NOT from `alert_thresholds.json` (which has 80 for `/alerts` endpoint, different concept). → Task 6.
- **Rule 1**: All Java `!= null` checks port to Python `is not None` (not `or` falsy fallback). → Task 4.
- **Rule 2**: WEEK period key uses calendar year (post-PR #30 fix); reuse `_get_period_key` from `analysis_finance`. → Task 12.
- **Rule 4**: All `BigDecimal` outputs wrap with `_decimal_to_number` for FastAPI parity. → All sub-services.
- **Rule 8**: `Map.of(N)` Jackson hash order — F999 empty doesn't trigger; PR-B detects.

**PR-B scope** (NOT this plan): arithmetic depth tests (`TestDepartmentRankingArithmetic`, `TestDepartmentCompletionRatesArithmetic`, `TestDepartmentEfficiencyMatrixArithmetic`, `TestDepartmentTrendComparisonArithmetic`) — 21 tests total. PR-A only does 3 contract tests for byte-shape gate.

---

## File Structure

**Files to create:**
- `backend/python/smartbi_compat/api/analysis_department.py` — main impl (~480 LOC)
- `tests/python/smartbi_compat/test_analysis_department_contract.py` — 3 contract tests (~120 LOC)
- `tests/fixtures/java-smartbi-golden/analysis-department-F999.json` — golden recording

**Files to modify:**
- `backend/python/main.py:1110-1117` — register `analysis_department.router` (additive 1-2 lines)

**Files to read (no edit):**
- `backend/python/smartbi_compat/api/analysis_finance.py` — sister precedent + helper imports source
- `backend/python/smartbi_compat/api/datasource.py` — `_get_cretas_pool()` pattern source
- `backend/python/smartbi_compat/api/analysis_sales.py` — alternate sister pattern reference
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` — sister contract test pattern
- `tests/python/smartbi_compat/conftest.py` — fixtures (client, _strip_volatile, etc.)

---

## Task 1: Skeleton file + constants module + import block

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_department.py`

- [ ] **Step 1: Create skeleton with imports + constants (no impl yet)**

```python
"""Phase 2A: /analysis/department composite real impl.

Mirrors Java SmartBIServiceImpl.getComprehensiveAnalysis "department" case
(line 586-591) + envelope (line 612-613) + 4 DepartmentAnalysisServiceImpl
sub-services. Composite path always taken in prod; ?department=filter is
dead code, ignored.

See spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _get_period_key,         # post-PR #30 calendar-year fix (Rule 2 compliant)
    _strip_volatile,         # already covers "generatedAt" key
    VOLATILE_KEYS,
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,             # safe Decimal coercion
    _utc_now_iso,            # ISO timestamp for generatedAt (volatile, stripped)
)
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

# T1 lock — inline const, NOT alert_thresholds.py 80 (different concept for /alerts)
_DEPARTMENT_TARGET_COMPLETION_RED    = Decimal("60")
_DEPARTMENT_TARGET_COMPLETION_YELLOW = Decimal("85")

# SCALE constants matching Java DepartmentAnalysisServiceImpl line 52-54
_SCALE             = Decimal("0.0001")    # SCALE=4 中间精度
_DISPLAY_SCALE     = Decimal("0.01")      # DISPLAY_SCALE=2 输出
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


router = APIRouter()
```

- [ ] **Step 2: Verify imports succeed by syntax-checking**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_department.py
git commit -m "feat(department): scaffold analysis_department module + constants" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 2: `_query_department_full` SQL helper (C2 + Rule 5 + Rule 6)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.3 lines 188-222.

- [ ] **Step 1: Add `_query_department_full` helper**

```python
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

    from smartbi.config import get_cretas_pool  # type: ignore
    pool = await get_cretas_pool()

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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _query_department_full SQL helper (C2 ORDER BY id)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 3: `_query_department_daily_trend` SQL helper (I4)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.3 lines 225-259.

- [ ] **Step 1: Add `_query_department_daily_trend` helper**

```python
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

    from smartbi.config import get_cretas_pool  # type: ignore
    pool = await get_cretas_pool()

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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _query_department_daily_trend SQL helper (I4 verbatim ORDER BY)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 4: `_aggregate_department_data` (C1 MAX + I3 ignore + Rule 1)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.4 lines 264-326.

- [ ] **Step 1: Add `_aggregate_department_data`**

```python
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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _aggregate_department_data (C1 MAX headcount + I3 ignore + Rule 1)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 5: `_calculate_completion_rate` (C4 + arithmetic order)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.5 lines 342-371.

- [ ] **Step 1: Add `_calculate_completion_rate`**

```python
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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _calculate_completion_rate (C4 div-by-zero + arithmetic order)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 6: `_determine_target_completion_alert` (T1 60/85)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.5 lines 374-397.

- [ ] **Step 1: Add `_determine_target_completion_alert`**

```python
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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _determine_target_completion_alert (T1 60/85 inline)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 7: `_determine_quadrant` (C3 — DO NOT optimize)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.6 lines 402-470.

- [ ] **Step 1: Add `_determine_quadrant`**

```python
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

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _determine_quadrant (C3 per-point recompute lock)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 8: `_create_empty_chart` (I5) + `_build_date_range`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.8 lines 791-816, §3.9 lines 871-902.

- [ ] **Step 1: Add `_create_empty_chart`**

```python
def _create_empty_chart(chart_type: str, title: str) -> dict:
    """Mirror Java DepartmentAnalysisServiceImpl create{Scatter,Pie,Line,Area}EmptyChart
    factories (line 801-823).

    ⚠️ I5 fix — Java ChartConfig DTO has NO @JsonInclude annotation (verified
    ChartConfig.java:32) → Spring Boot Jackson default emits ALL fields including
    null.

    ChartConfig field order (Java DTO line 37-67):
      [chartType, title, xAxisField, yAxisField, seriesField, data, options]
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

- [ ] **Step 2: Add `_build_date_range`**

```python
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

- [ ] **Step 3: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(department): _create_empty_chart (I5 null fields) + _build_date_range" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 9: `_get_department_ranking` sub-service 1

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.7 lines 476-520.

- [ ] **Step 1: Add `_get_department_ranking`**

```python
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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _get_department_ranking sub-service 1" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 10: `_get_department_completion_rates` sub-service 2

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.7 lines 523-565.

- [ ] **Step 1: Add `_get_department_completion_rates`**

```python
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
        results.append({
            "metricCode":     "TARGET_COMPLETION",
            "metricName":     "目标完成率",
            "value":          _decimal_to_number(cr_display),
            "formattedValue": f"{cr_display:,.2f}%",    # 千分位 + 2 位小数 + %
            "unit":           "%",
            "dimensionValue": dept,
            "alertLevel":     _determine_target_completion_alert(cr),
        })

    # Java line 198: results.sort(by value desc)
    results.sort(key=lambda r: r["value"], reverse=True)
    return results
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _get_department_completion_rates sub-service 2" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 11: `_get_department_efficiency_matrix` sub-service 3 (I1 + C3 invocation)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.7 lines 568-691.

- [ ] **Step 1: Add `_get_department_efficiency_matrix`**

```python
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
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _get_department_efficiency_matrix sub-service 3 (C3 + I1 SALT mirror)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 12: `_get_department_trend_comparison` sub-service 4 (Rule 2 WEEK)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.7 lines 694-785.

- [ ] **Step 1: Add `_get_department_trend_comparison`**

```python
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

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): _get_department_trend_comparison sub-service 4 (Rule 2 WEEK)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 13: `_get_department_analysis` composite assembler + endpoint handler

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (append)

Spec reference: §3.9 lines 822-868, §3.10 lines 907-941.

- [ ] **Step 1: Add `_get_department_analysis` composite + endpoint**

```python
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
    ranking          = await _get_department_ranking          (factory_id, start_date, end_date)
    completion_rates = await _get_department_completion_rates (factory_id, start_date, end_date)
    efficiency_matrix = await _get_department_efficiency_matrix(factory_id, start_date, end_date)
    trend_comparison = await _get_department_trend_comparison (factory_id, start_date, end_date, "WEEK")

    # ⚠️ TBD: actual key order from F999 golden. Initial placeholder = Java put-order.
    return {
        "ranking":          ranking,
        "completionRates":  completion_rates,
        "efficiencyMatrix": efficiency_matrix,
        "trendComparison":  trend_comparison,
        "dateRange":        _build_date_range(start_date, end_date),
        "generatedAt":      _utc_now_iso(),    # volatile, stripped by _strip_volatile in tests
    }


@router.get(
    "/api/mobile/{factory_id}/smart-bi/analysis/department"
)
async def get_department_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    department: Optional[str] = Query(None),    # accepted but IGNORED — mirror Java prod
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getDepartmentAnalysis (line 142-177).

    ⚠️ `department` query param accepted but IGNORED — mirror Java prod behavior:
    Controller's `if (smartBIService != null)` (line 153) ALWAYS true in prod
    (SmartBIServiceImpl is unconditional @Service). Composite path bypasses
    Controller's filter branch (line 162-170) entirely. Detail mode is dead
    code in prod.
    """
    result = await _get_department_analysis(factory_id, startDate, endDate)
    return wrap_response(result)
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_department.py').read())"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(department): composite assembler + endpoint handler (?department ignored)" -- backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 14: Register router in `main.py`

**Files:**
- Modify: `backend/python/main.py:1110-1117`

- [ ] **Step 1: Read current registration block to confirm context**

Run: `sed -n '1107,1127p' backend/python/main.py`
Expected: shows the `try: ... except ImportError` block with `analysis_finance` etc.

- [ ] **Step 2: Add `analysis_department` import and `include_router` call**

Edit the file:

Find:
```python
    from smartbi_compat.api import analysis_sales
    from smartbi_compat.api import analysis_finance
    app.include_router(smartbi_compat_analysis.router, tags=["SmartBI Compat: Analysis"])
    app.include_router(smartbi_compat_upload.router, tags=["SmartBI Compat: Upload"])
    app.include_router(smartbi_compat_dashboard.router, tags=["SmartBI Compat: Dashboard"])
    app.include_router(analysis_sales.router, tags=["smartbi-compat-sales"])
    app.include_router(analysis_finance.router, tags=["SmartBI Compat: Analysis Finance"])
```

Replace with:
```python
    from smartbi_compat.api import analysis_sales
    from smartbi_compat.api import analysis_finance
    from smartbi_compat.api import analysis_department
    app.include_router(smartbi_compat_analysis.router, tags=["SmartBI Compat: Analysis"])
    app.include_router(smartbi_compat_upload.router, tags=["SmartBI Compat: Upload"])
    app.include_router(smartbi_compat_dashboard.router, tags=["SmartBI Compat: Dashboard"])
    app.include_router(analysis_sales.router, tags=["smartbi-compat-sales"])
    app.include_router(analysis_finance.router, tags=["SmartBI Compat: Analysis Finance"])
    app.include_router(analysis_department.router, tags=["SmartBI Compat: Analysis Department"])
```

- [ ] **Step 3: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/python/main.py').read())"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(department): register analysis_department router in main.py" -- backend/python/main.py
```

---

## Task 15: Record F999 golden + update top-level key order if needed

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-department-F999.json`
- Modify: `backend/python/smartbi_compat/api/analysis_department.py` (only if key order differs from placeholder)

Spec reference: §4.2 lines 996-1015.

- [ ] **Step 1: Record F999 golden against test Java backend**

Run:
```bash
./scripts/record-java-golden.sh F999 \
  /api/mobile/F999/smart-bi/analysis/department \
  tests/fixtures/java-smartbi-golden/analysis-department-F999.json
```
Expected: golden file created with F999 empty-data shape.

If `record-java-golden.sh` fails (test backend down or F999 RLS blocked), run:
```bash
ssh root@47.100.235.168 "systemctl status cretas-backend-test --no-pager"
```
to diagnose. If test backend is healthy, retry. Common issue: F999 factory not seeded in test_db.

- [ ] **Step 2: Inspect actual top-level `data.*` key order in golden**

Run: `python -c "import json; d=json.load(open('tests/fixtures/java-smartbi-golden/analysis-department-F999.json')); print(list(d['data'].keys()))"`
Expected: prints something like `['ranking', 'completionRates', 'efficiencyMatrix', 'trendComparison', 'dateRange', 'generatedAt']` — but order may differ from put-order due to HashMap hash iteration.

- [ ] **Step 3: Update `_get_department_analysis` dict literal if order differs**

If the printed order differs from current dict literal in `_get_department_analysis`, edit the function to match. For example, if golden shows `['endDate', ...]` but dict has `["startDate", ...]`, reorder.

If order matches placeholder, no edit needed.

- [ ] **Step 4: Commit golden + any reorder**

```bash
git add tests/fixtures/java-smartbi-golden/analysis-department-F999.json
git commit -m "test(department): record F999 golden + adjust top-level key order if needed" -- tests/fixtures/java-smartbi-golden/analysis-department-F999.json backend/python/smartbi_compat/api/analysis_department.py
```

---

## Task 16: Add 3 contract tests

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_department_contract.py`

Spec reference: §5.1 lines 1024-1044, §5.3 lines 1091-1129.

- [ ] **Step 1: Read sister test pattern**

Run: `head -80 tests/python/smartbi_compat/test_analysis_finance_contract.py`
Expected: shows fixture imports + test class structure — follow this pattern.

- [ ] **Step 2: Create contract test file**

```python
"""Contract tests for /analysis/department composite path (PR-A).

F999 byte-shape gate: dict-eq compare Python output vs golden, _strip_volatile
applied to both sides.
"""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from smartbi_compat.api.analysis_finance import _strip_volatile

GOLDEN_PATH = (
    Path(__file__).resolve().parents[3]
    / "tests"
    / "fixtures"
    / "java-smartbi-golden"
    / "analysis-department-F999.json"
)


async def _empty_full(factory_id, start_date, end_date):
    """Mock _query_department_full returning empty rows."""
    return []


async def _empty_trend(factory_id, start_date, end_date):
    """Mock _query_department_daily_trend returning empty rows."""
    return []


@pytest.fixture
def patched_empty(monkeypatch):
    """Patch both SQL helpers to return empty rows (F999 baseline)."""
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_department._query_department_full",
        _empty_full,
    )
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_department._query_department_daily_trend",
        _empty_trend,
    )


class TestAnalysisDepartmentComposite:
    """F999 byte-shape gate for department composite path."""

    def test_f999_composite_data_keys_match_golden(self, client, patched_empty):
        """Top-level `data.*` keys exactly match recorded golden order."""
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/department",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
        )
        assert resp.status_code == 200, resp.text

        actual_data = _strip_volatile(resp.json()["data"])
        golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
        golden_data = _strip_volatile(golden["data"])

        assert list(actual_data.keys()) == list(golden_data.keys()), (
            f"Top-level data keys differ:\n"
            f"  actual: {list(actual_data.keys())}\n"
            f"  golden: {list(golden_data.keys())}"
        )

    def test_f999_composite_byte_shape(self, client, patched_empty):
        """Full dict-eq compare: Python output vs golden, both _strip_volatile."""
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/department",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
        )
        assert resp.status_code == 200, resp.text

        actual = _strip_volatile(resp.json())
        golden = _strip_volatile(json.loads(GOLDEN_PATH.read_text(encoding="utf-8")))

        assert actual == golden, (
            f"Byte-shape mismatch (after _strip_volatile):\n"
            f"  actual: {json.dumps(actual, ensure_ascii=False, indent=2)}\n"
            f"  golden: {json.dumps(golden, ensure_ascii=False, indent=2)}"
        )

    def test_f999_department_filter_param_ignored(self, client, patched_empty):
        """`?department=销售部` produces SAME shape as no-filter case (composite ignores filter)."""
        resp_filtered = client.get(
            "/api/mobile/F999/smart-bi/analysis/department",
            params={
                "startDate": "2025-01-01",
                "endDate": "2025-12-31",
                "department": "销售部",
            },
        )
        resp_unfiltered = client.get(
            "/api/mobile/F999/smart-bi/analysis/department",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
        )
        assert resp_filtered.status_code == 200
        assert resp_unfiltered.status_code == 200

        filtered = _strip_volatile(resp_filtered.json())
        unfiltered = _strip_volatile(resp_unfiltered.json())

        assert filtered == unfiltered, (
            "Department filter must be IGNORED in composite path (Java prod behavior)"
        )
```

- [ ] **Step 3: Run the 3 contract tests**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_department_contract.py -v`
Expected: 3 tests PASS

If a test FAILS:
- `test_f999_composite_data_keys_match_golden` failure → key order in `_get_department_analysis` differs from golden. Re-do Task 15 Step 3 (reorder dict literal).
- `test_f999_composite_byte_shape` failure → some sub-service emits different empty shape. Inspect diff and adjust `_create_empty_chart` or sub-service empty branch.
- `test_f999_department_filter_param_ignored` failure → endpoint dispatching on `department` param. Verify endpoint handler does NOT branch on `department`.

- [ ] **Step 4: Commit tests**

```bash
git commit -m "test(department): 3 contract tests for F999 composite byte-shape gate" -- tests/python/smartbi_compat/test_analysis_department_contract.py
```

---

## Task 17: Run full pytest baseline + push branch + open PR

**Files:** none changed; verification + push only.

- [ ] **Step 1: Run full pytest suite to confirm no regression**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v --tb=short`
Expected: existing tests still PASS, plus the 3 new department contract tests PASS. Total should be baseline + 3.

If ANY pre-existing test fails: STOP and investigate. Do not proceed until baseline is green.

- [ ] **Step 2: Verify all changes scope is what we expect**

Run: `git status --short && git log --oneline phase2a/department-impl ^origin/main`
Expected:
- `git status` shows clean working tree
- `git log` shows ~16 commits (one per task) on `phase2a/department-impl`

- [ ] **Step 3: Push branch**

Run: `git push -u origin phase2a/department-impl 2>&1 | tail -5`
Expected: `[new branch] phase2a/department-impl -> phase2a/department-impl`

- [ ] **Step 4: Open PR**

Run:
```bash
gh pr create --base main --head phase2a/department-impl \
  --title "Phase 2A: /analysis/department composite real impl + 4 sub-services (PR-A)" \
  --body "$(cat <<'EOF'
## Summary

Implements Python port of `/api/mobile/{factoryId}/smart-bi/analysis/department` composite endpoint per spec PR #36. 4 sub-services (ranking / completionRates / efficiencyMatrix / trendComparison) + composite assembler + envelope (dateRange + generatedAt). asyncpg pool pattern (no `_fetch_all` helper — inline mirroring sister code per `analysis_finance.py`).

## Spec compliance

All locked traps from spec §3 + §8 implemented:
- **C1**: `headcount = MAX` running check (NOT SUM, NOT latest-by-date)
- **C2**: `_query_department_full` adds `ORDER BY id` for byte determinism
- **C3**: `_determine_quadrant` per-point recompute (NOT lifted out of efficiency loop)
- **C4**: `_calculate_completion_rate` divide-by-zero check; arithmetic order `((actual * 100) / target).quantize(SCALE)`
- **I1**: `Map.of(2)/(4)` quadrantLines/Labels canonical order (mirrors first-record golden)
- **I3**: precomputed `per_capita_*` columns from SELECT * IGNORED, recomputed
- **I4**: `_query_department_daily_trend` ORDER BY `order_date` ONLY (verbatim Java)
- **I5**: `_create_empty_chart` emits `null` fields (Jackson default no @JsonInclude)
- **T1**: `_DEPARTMENT_TARGET_COMPLETION_RED/_YELLOW = 60/85` HARDCODED inline
- **Rule 1**: explicit `is not None` ternary for null fallback
- **Rule 2**: `_get_period_key` imported from `analysis_finance` (post-PR #30 calendar-year fix)
- **Rule 4**: all `BigDecimal` outputs wrap with `_decimal_to_number`
- **Rule 8**: `Map.of(N)` order — F999 empty doesn't trigger; PR-B will detect via Java backend restart cycle

## Tests

3 contract tests in `tests/python/smartbi_compat/test_analysis_department_contract.py`:
1. Top-level `data.*` keys order matches golden
2. Full dict-eq compare with `_strip_volatile`
3. `?department=` filter is ignored (composite always taken)

PR-B will add 21 arithmetic depth tests (4 sub-service classes).

## Files

- `backend/python/smartbi_compat/api/analysis_department.py` (NEW, ~480 LOC)
- `backend/python/main.py` (1-2 line additive: register router)
- `tests/python/smartbi_compat/test_analysis_department_contract.py` (NEW, ~120 LOC)
- `tests/fixtures/java-smartbi-golden/analysis-department-F999.json` (NEW)

## Sister chats unblocked

- `phase2a/t-region` / `phase2a/t-quality` / `phase2a/t-procurement` — same composite shape pattern; this PR is template.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: prints PR URL.

- [ ] **Step 5: Verify PR opened**

Run: `gh pr view --json url,number | jq`
Expected: shows PR #N URL.

---

## Self-Review Checklist (run by impl chat after Task 17)

- [ ] All 17 tasks committed?
- [ ] All 3 contract tests passing?
- [ ] Pre-existing pytest baseline still green?
- [ ] PR opened with full body?
- [ ] No `as any` / no `or` falsy fallback / no `if x:` truthy-check on `Decimal`?
- [ ] Every Java line cited in code comments matches the spec's §3 line refs?
