# Phase 2A `/analysis/finance` budget per-type real impl (PR-A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `analysisType=budget` per-type real impl to Python with byte-shape parity against Java, replacing the 501 fallback. Adds 7 new functions (2 helpers + 3 sub-services + 1 dispatcher + 1 route branch) + 3 contract tests + 1 existing-test update.

**Architecture:** Extend `backend/python/smartbi_compat/api/analysis_finance.py` with budget per-type real impl. 3 sub-services use distinct signatures per Rule 3 (year+month / year / start_date+end_date). Reuses existing helpers (`_query_finance_data`, `_decimal_to_number`, `_format_currency`, `_to_decimal`, `_determine_budget_achievement_alert` from PR #32, `_new_metric_result_dict`, `_new_chart_config_dict`). New helpers add `_create_waterfall_item` + `_determine_budget_variance_rate_alert`. Dispatcher emits 5-key Jackson-hash-order `[comparison, endDate, waterfall, metrics, startDate]` (verified via 2026-05-02 F999 golden). PR-B (arithmetic depth, ~22 tests) deferred to follow-up PR.

**Tech Stack:** FastAPI route + asyncpg via existing `_query_finance_data`, pytest contract tests with `_strip_volatile` and dict-eq compare against committed F999/F001 goldens.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md` (4-cycle audit, post-IC3 amendment with verified key orders, on `phase2a/finance-budget` branch HEAD).

**Java reference root:** `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java`

**Branch:** `phase2a/finance-budget` (worktree: `.worktrees/phase2a-finance-budget`)

**Base:** `origin/main` HEAD `5d284d38d` (PR #35 Rule 8 merged) + foundation commit `4053f2208` (this branch — spec amendment + goldens).

**Out of scope:** PR-B arithmetic depth tests (separate plan, ~22 tests across 4 classes); receivable per-type (sister chat); `/analysis/finance/budget-achievement` sub-endpoint (PR #32 already shipped).

---

## Concurrent-edit safety

Sister chat (`phase2a/finance-receivable` impl) is **actively modifying the same file** `analysis_finance.py`. ALWAYS use `./scripts/safe-commit.sh "msg" path1 path2` per `.claude/rules/concurrent-edit-safety.md` rule 5b. Expected line-level conflict at second-merger PR: route handler dispatch (~5 lines around if/elif tree). Trivial rebase resolution.

---

## File structure

| Path | Action | Scope |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_finance.py` | Modify | +2 new helpers + 3 sub-services + 1 dispatcher + 1 route branch (~250 LOC additions) |
| `tests/python/smartbi_compat/test_analysis_finance_contract.py` | Modify | +1 new class `TestAnalysisFinanceBudget` (3 contract tests) + 1 existing test update (drop "budget" from 501 loop) |
| `tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget.json` | Already added | Foundation commit `4053f2208` |
| `tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget.json` | Already added | Foundation commit `4053f2208` |
| `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md` | Already amended | Foundation commit `4053f2208` (Rule 8 fix + dispatcher key order baked) |

Total LOC delta target: ~400 (impl ~250 + tests ~150).

---

## Phase A — New helpers

### Task A.1: `_create_waterfall_item` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — insert after `_create_pie_data_item` (existing line 213-234)

Spec ref: §3.4 helper body.

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^def _create_pie_data_item\|^def _aggregate_cost_by_period" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: `_create_pie_data_item` at line 213; `_aggregate_cost_by_period` at line 237. Insert new helper between them (around line 235).

- [ ] **Step 2: Insert helper using Edit tool**

Edit target — use `_create_pie_data_item` closing brace + blank lines as anchor.

Find this exact block (lines 229-237):
```python
    return {
        "category":   category,
        "value":      _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "percentage": _decimal_to_number(percentage),
    }



def _aggregate_cost_by_period(
```

Replace with:
```python
    return {
        "category":   category,
        "value":      _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "percentage": _decimal_to_number(percentage),
    }



def _create_waterfall_item(name: str, value: Decimal, type_: str) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.createWaterfallItem (line 1579-1585).

    LinkedHashMap put-order: [name, value, type] verified via F999 budget golden
    waterfall.data[0] (name=年度预算, value=0.0, type=total).

    `type_` parameter name (with trailing underscore) avoids Python `type` builtin
    shadowing. JSON output key remains `"type"` per Java parity.

    `value` MUST be Decimal (not int/float); applies setScale(DISPLAY_SCALE=2, HALF_UP)
    inside before _decimal_to_number serialization.
    """
    return {
        "name": name,
        "value": _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "type": type_,
    }



def _aggregate_cost_by_period(
```

- [ ] **Step 3: Verify insertion**

```bash
grep -n "^def _create_waterfall_item\|^def _aggregate_cost_by_period" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: `_create_waterfall_item` listed before `_aggregate_cost_by_period`.

Run a quick Python syntax check:
```bash
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
```
Expected: no output (silent success).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): add _create_waterfall_item helper (Java line 1579-1585 mirror)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

Verify commit:
```bash
git show --name-only HEAD
```
Expected: only `backend/python/smartbi_compat/api/analysis_finance.py`.

---

### Task A.2: `_determine_budget_variance_rate_alert` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — insert after `_determine_budget_achievement_alert` (existing line 449-464)

Spec ref: §3.7 helper naming + §3.3 BUDGET_VARIANCE_RATE alert. Java MetricCalculatorServiceImpl line 515-519.

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^def _determine_budget_achievement_alert\|^def _get_metric_display_name" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: `_determine_budget_achievement_alert` line 449, `_get_metric_display_name` line 467. Insert new helper between them.

- [ ] **Step 2: Insert helper using Edit tool**

Find this exact block (lines 461-467):
```python
    if v > 100:
        return "YELLOW"
    return "GREEN"


def _get_metric_display_name(metric: Optional[str]) -> str:
```

Replace with:
```python
    if v > 100:
        return "YELLOW"
    return "GREEN"


def _determine_budget_variance_rate_alert(rate: Decimal) -> str:
    """Mirror Java MetricCalculatorServiceImpl.determineAlertLevel BUDGET_VARIANCE_RATE
    case (line 515-519).

      abs(v) > 20 → RED   (偏差超过 20%)
      abs(v) > 10 → YELLOW (偏差 10-20%)
      else        → GREEN  (正常)

    Note: Python端必须加前缀消岐义 (Java 是跨 service 调用 metricCalculatorService
    .determineAlertLevel — Python 无 service 边界，函数名自带 disambiguation)。

    Boundary: exactly 20 → YELLOW (NOT RED); exactly 10 → GREEN (NOT YELLOW).

    Sign-symmetric: -25 → RED (abs=25 > 20), -15 → YELLOW (abs=15 > 10), -5 → GREEN.
    """
    v = abs(float(rate))
    if v > 20:
        return "RED"
    if v > 10:
        return "YELLOW"
    return "GREEN"


def _get_metric_display_name(metric: Optional[str]) -> str:
```

- [ ] **Step 3: Verify**

```bash
grep -n "^def _determine_budget_variance_rate_alert" backend/python/smartbi_compat/api/analysis_finance.py
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
```
Expected: helper exists at new line; no syntax errors.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): add _determine_budget_variance_rate_alert (MetricCalculatorServiceImpl line 515-519 mirror)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase B — 3 sub-services

### Task B.1: `_get_budget_metrics` (Java line 1031-1116)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — insert near other budget functions, after `_get_payable_analysis` (existing line 2076-2094) area. Place all 3 sub-services + dispatcher together for readability.

Spec ref: §3.3 algorithm.

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^async def _get_payable_analysis\|^# =====\|^@router.get" backend/python/smartbi_compat/api/analysis_finance.py | head -10
```
Expected: `_get_payable_analysis` at line 2076; section divider before `# Section 5: Route handler` at line 2096-2098. Insert all 4 budget functions (B.1 + B.2 + B.3 + C.1) BEFORE the `# Section 5` divider.

- [ ] **Step 2: Find exact anchor for insertion**

```bash
grep -n "^async def _get_payable_analysis" backend/python/smartbi_compat/api/analysis_finance.py
sed -n '2092,2099p' backend/python/smartbi_compat/api/analysis_finance.py
```
Expected output around line 2092-2099:
```
2092: ...end of _get_payable_analysis...
2093:
2094:
2095:
2096: # ============================================================
2097: # Section 5: Route handler
2098: # ============================================================
2099:
```

- [ ] **Step 3: Insert _get_budget_metrics**

Edit: find this block (the section divider before route handler):
```python
# ============================================================
# Section 5: Route handler
# ============================================================
```

Replace with:
```python
# ============================================================
# Section 4d: Budget per-type real impl (Phase 2A)
# ============================================================


async def _get_budget_metrics(factory_id: str, year: int, month: int) -> list[dict]:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetMetrics (line 1031-1116).

    Signature `(factory_id, year, month)` per Rule 3 — does NOT take date_range
    because Java method takes (int year, int month). Date range derived inside:
        start_date = date(year, month, 1)
        end_date = date(year, month, calendar.monthrange(year, month)[1])

    Emits 4 MetricResult entries (BUDGET_EXECUTION / BUDGET_VARIANCE /
    BUDGET_VARIANCE_RATE / BUDGET_REMAINING) using _new_metric_result_dict
    (11-field DTO shape verified via F999 golden).

    F2 risk: NO `.abs()` defensive on budget_amount/actual_amount per Rule 3 raw
    mirror of Java line 1044-1052. Raw accumulation matches Java exactly.
    """
    start_date = date(year, month, 1)
    end_date = date(year, month, calendar.monthrange(year, month)[1])

    budget_data = await _query_finance_data(factory_id, "BUDGET", start_date, end_date)

    # Java line 1044-1047: raw sum of budget_amount (NOT abs, F2 raw mirror Rule 3)
    total_budget = sum(
        (_to_decimal(r["budget_amount"]) for r in budget_data
         if r.get("budget_amount") is not None),
        Decimal("0"),
    )
    # Java line 1049-1052: raw sum of actual_amount
    total_actual = sum(
        (_to_decimal(r["actual_amount"]) for r in budget_data
         if r.get("actual_amount") is not None),
        Decimal("0"),
    )

    # BUDGET_EXECUTION (Java line 1054-1071)
    if total_budget > Decimal("0"):
        execution_rate_raw = (total_actual / total_budget).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        ) * Decimal("100")
    else:
        execution_rate_raw = Decimal("0")
    execution_rate_display = execution_rate_raw.quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # BUDGET_VARIANCE (Java line 1074-1085)
    variance = total_actual - total_budget
    variance_display = variance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # BUDGET_VARIANCE_RATE (Java line 1088-1099)
    if total_budget > Decimal("0"):
        variance_rate_raw = (variance / total_budget).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        ) * Decimal("100")
    else:
        variance_rate_raw = Decimal("0")
    variance_rate_display = variance_rate_raw.quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # BUDGET_REMAINING (Java line 1102-1113)
    remaining = total_budget - total_actual
    remaining_display = remaining.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return [
        _new_metric_result_dict(
            metric_code="BUDGET_EXECUTION",
            metric_name="预算执行率",
            value=_decimal_to_number(execution_rate_display),
            formatted_value=f"{execution_rate_display}%",
            unit="%",
            alert_level=_determine_budget_achievement_alert(execution_rate_raw),
            description="实际支出占预算的比例",
        ),
        _new_metric_result_dict(
            metric_code="BUDGET_VARIANCE",
            metric_name="预算差异",
            value=_decimal_to_number(variance_display),
            formatted_value=_format_currency(variance),
            unit="元",
            alert_level="YELLOW" if variance > Decimal("0") else "GREEN",
            description="实际支出与预算的差额",
        ),
        _new_metric_result_dict(
            metric_code="BUDGET_VARIANCE_RATE",
            metric_name="预算偏差率",
            value=_decimal_to_number(variance_rate_display),
            formatted_value=f"{variance_rate_display}%",
            unit="%",
            alert_level=_determine_budget_variance_rate_alert(variance_rate_raw),
            description="预算差异占预算的比例",
        ),
        _new_metric_result_dict(
            metric_code="BUDGET_REMAINING",
            metric_name="预算剩余",
            value=_decimal_to_number(remaining_display),
            formatted_value=_format_currency(remaining),
            unit="元",
            alert_level="GREEN" if remaining >= Decimal("0") else "RED",
            description="剩余可用预算额度",
        ),
    ]


# ============================================================
# Section 5: Route handler
# ============================================================
```

- [ ] **Step 4: Verify syntax**

```bash
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
grep -n "^async def _get_budget_metrics" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: no syntax errors; function visible at new line.

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): _get_budget_metrics 4-metric impl (Java line 1031-1116 mirror)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.2: `_get_budget_execution_waterfall` (Java line 923-979)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — insert after `_get_budget_metrics`

Spec ref: §3.4 algorithm.

- [ ] **Step 1: Find anchor**

```bash
grep -n "^async def _get_budget_metrics\|^# Section 5" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: `_get_budget_metrics` at new line; `# Section 5` after that.

- [ ] **Step 2: Insert function**

Edit: find this block (end of B.1 insertion):
```python
    ]


# ============================================================
# Section 5: Route handler
# ============================================================
```

Replace with:
```python
    ]


async def _get_budget_execution_waterfall(factory_id: str, year: int) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetExecutionWaterfall (line 923-979).

    Signature `(factory_id, year)` per Rule 3 — Java takes (int year), Python mirrors.
    Date range derived: [year-01-01, year-12-31].

    Returns ChartConfig dict (chartType=WATERFALL).

    Edge cases:
    - Empty budget_data → annual_budget=0, no monthly decreases, chart_data=[
        年度预算 0 total, 剩余预算 0 total] (length 2)
    - All 12 months had actuals>0 → length 14 (1 total + 12 decrease + 1 total)
    - Months with actual<=0 skipped per Java line 956 `compareTo(BigDecimal.ZERO) > 0`
    - Java line 941 NPEs on null record_date — Python defensive skip (data quality
      divergence per spec §8 IC1 risk; Phase 3.B/C cleanup retrofits cost too).
    """
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    budget_data = await _query_finance_data(factory_id, "BUDGET", start_date, end_date)

    # Java line 933-936: raw sum (NOT abs, F2 raw mirror)
    annual_budget = sum(
        (_to_decimal(r["budget_amount"]) for r in budget_data
         if r.get("budget_amount") is not None),
        Decimal("0"),
    )

    # Java line 939-944: aggregate per month (TreeMap → sorted insertion order)
    monthly_actual: dict[int, Decimal] = {}
    for r in budget_data:
        # Defensive skip if record_date is None (Java line 941 NPEs)
        rec_date = r.get("record_date")
        if rec_date is None:
            continue
        month = rec_date.month
        # Java line 942: null actual → BigDecimal.ZERO (NOT skip), then merge add
        actual = (
            _to_decimal(r["actual_amount"])
            if r.get("actual_amount") is not None
            else Decimal("0")
        )
        monthly_actual[month] = monthly_actual.get(month, Decimal("0")) + actual

    # Java line 947-963: build waterfall data list
    chart_data: list[dict] = [
        _create_waterfall_item("年度预算", annual_budget, "total"),
    ]
    remaining = annual_budget
    # Iterate 1..12 in order (Java line 954)
    for month in range(1, 13):
        actual = monthly_actual.get(month, Decimal("0"))
        # Java line 956: only emit decrease if actual > 0
        if actual > Decimal("0"):
            chart_data.append(_create_waterfall_item(f"{month}月", -actual, "decrease"))
            remaining -= actual
    chart_data.append(_create_waterfall_item("剩余预算", remaining, "total"))

    # Java line 965-969: LinkedHashMap put-order [waterfallType, increaseColor,
    # decreaseColor, totalColor] verified via F999 golden line 43-48
    options = {
        "waterfallType": True,
        "increaseColor": "#91cc75",
        "decreaseColor": "#ee6666",
        "totalColor": "#5470c6",
    }

    return _new_chart_config_dict(
        chart_type="WATERFALL",
        title=f"{year}年预算执行瀑布图",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="name",
        yaxis_field="value",
    )


# ============================================================
# Section 5: Route handler
# ============================================================
```

- [ ] **Step 3: Verify**

```bash
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
grep -n "^async def _get_budget_execution_waterfall" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: function exists, no syntax errors.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): _get_budget_execution_waterfall impl (Java line 923-979 mirror, F2 raw, F1 全 calendar year scope)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.3: `_get_budget_vs_actual_chart` (Java line 982-1028)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — insert after `_get_budget_execution_waterfall`

Spec ref: §3.5 algorithm. Critical: Map.of(2) series hash order `[color, name]` per Rule 8 (verified via F999 golden line 13-20).

- [ ] **Step 1: Find anchor**

```bash
grep -n "^async def _get_budget_execution_waterfall\|^# Section 5" backend/python/smartbi_compat/api/analysis_finance.py
```

- [ ] **Step 2: Insert function**

Edit: find this block (end of B.2):
```python
    return _new_chart_config_dict(
        chart_type="WATERFALL",
        title=f"{year}年预算执行瀑布图",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="name",
        yaxis_field="value",
    )


# ============================================================
# Section 5: Route handler
# ============================================================
```

Replace with:
```python
    return _new_chart_config_dict(
        chart_type="WATERFALL",
        title=f"{year}年预算执行瀑布图",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="name",
        yaxis_field="value",
    )


async def _get_budget_vs_actual_chart(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetVsActualChart (line 982-1028).

    Signature `(factory_id, start_date, end_date)` per Rule 3 — matches Java
    (LocalDate startDate, LocalDate endDate).

    Returns ChartConfig dict (chartType=BAR).

    Per-category aggregation with LinkedHashMap put-order. Each chart_data item
    has 6 keys [category, budget, actual, variance, executionRate, alertLevel]
    (verified via Java line 1000-1010 LinkedHashMap put sequence).

    Java line 1005-1007 emits raw 4-decimal executionRate (no setScale(2));
    Python `_decimal_to_number(Decimal("33.3300"))` → `33.33` matches Jackson's
    BigDecimal stripping behavior. Empty-data F999 case verified.

    Rule 8 caveat: comparison.options.series Map.of(2) entries serialize as
    [color, name] (Jackson hash order, NOT Java source param order which is
    [name, color]). Verified via F999 golden line 13-20.
    """
    budget_data = await _query_finance_data(factory_id, "BUDGET", start_date, end_date)

    # Java line 989-995: per-category aggregate (LinkedHashMap insertion order)
    category_data: dict[str, list[Decimal]] = {}
    for r in budget_data:
        category = r.get("category") if r.get("category") is not None else "其他"
        slot = category_data.setdefault(category, [Decimal("0"), Decimal("0")])
        # Java line 993: null → BigDecimal.ZERO, NOT skip
        budget_amount = (
            _to_decimal(r["budget_amount"])
            if r.get("budget_amount") is not None
            else Decimal("0")
        )
        actual_amount = (
            _to_decimal(r["actual_amount"])
            if r.get("actual_amount") is not None
            else Decimal("0")
        )
        slot[0] += budget_amount
        slot[1] += actual_amount

    # Java line 998-1011: build per-category chart_data (LinkedHashMap put-order)
    chart_data: list[dict] = []
    for category, values in category_data.items():
        # Java line 1005-1007: divide(SCALE=4, HALF_UP).multiply(100), NO final setScale(2)
        if values[0] > Decimal("0"):
            execution_rate = (values[1] / values[0]).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            ) * Decimal("100")
        else:
            execution_rate = Decimal("0")

        chart_data.append({
            "category": category,
            # Java line 1001-1004: raw budget/actual/variance (NO setScale, accumulator
            # preserves DB scale=2). I-1 fix mirror.
            "budget": _decimal_to_number(values[0]),
            "actual": _decimal_to_number(values[1]),
            "variance": _decimal_to_number(values[1] - values[0]),
            "executionRate": _decimal_to_number(execution_rate),
            # Pass raw 4-decimal execution_rate into helper for boundary precision
            # (mirrors Java line 1009 calling helper before any setScale)
            "alertLevel": _determine_budget_achievement_alert(execution_rate),
        })

    # Java line 1013-1018: options (outer LinkedHashMap put-order;
    # series items Map.of(2) → Rule 8 hash order [color, name])
    options = {
        "groupedBar": True,
        "series": [
            {"color": "#5470c6", "name": "预算"},   # Map.of(2) Jackson hash: [color, name]
            {"color": "#91cc75", "name": "实际"},   # NOT Java source [name, color] order
        ],
    }

    return _new_chart_config_dict(
        chart_type="BAR",
        title="预算 vs 实际对比",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="budget",
    )


# ============================================================
# Section 5: Route handler
# ============================================================
```

- [ ] **Step 3: Verify**

```bash
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
grep -n "^async def _get_budget_vs_actual_chart" backend/python/smartbi_compat/api/analysis_finance.py
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): _get_budget_vs_actual_chart impl (Java line 982-1028 mirror, Rule 8 series order)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase C — Dispatcher + route handler

### Task C.1: `_get_budget_analysis` dispatcher (Java Controller line 258-263)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — insert after `_get_budget_vs_actual_chart`

Spec ref: §3.6 dispatcher with verified key order `[comparison, endDate, waterfall, metrics, startDate]`.

- [ ] **Step 1: Find anchor**

```bash
grep -n "^async def _get_budget_vs_actual_chart\|^# Section 5" backend/python/smartbi_compat/api/analysis_finance.py
```

- [ ] **Step 2: Insert dispatcher**

Edit: find the end of B.3 insertion:
```python
    return _new_chart_config_dict(
        chart_type="BAR",
        title="预算 vs 实际对比",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="budget",
    )


# ============================================================
# Section 5: Route handler
# ============================================================
```

Replace with:
```python
    return _new_chart_config_dict(
        chart_type="BAR",
        title="预算 vs 实际对比",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="budget",
    )


async def _get_budget_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis budget branch
    line 258-263.

    Internal year/month derivation (Java line 259-260):
        int year = endDate.getYear();
        int month = endDate.getMonthValue();

    F1 — 3 sub-services use 3 different date scopes (per spec §3.2):
      - metrics:    [date(year, month, 1), date(year, month, last_day)]  # endDate's month only
      - waterfall:  [date(year, 1, 1), date(year, 12, 31)]                # full calendar year
      - comparison: [start_date, end_date]                                 # dispatcher range

    Returns 5-key dict in **verified Jackson hash order** (recorded F999/F001 golden):
        [comparison, endDate, waterfall, metrics, startDate]
    """
    year = end_date.year
    month = end_date.month

    metrics = await _get_budget_metrics(factory_id, year, month)
    waterfall = await _get_budget_execution_waterfall(factory_id, year)
    comparison = await _get_budget_vs_actual_chart(factory_id, start_date, end_date)

    return {
        # Verified Jackson hash order from F999 golden line 4-107 (2026-05-02 recording)
        "comparison": comparison,
        "endDate": end_date.isoformat(),
        "waterfall": waterfall,
        "metrics": metrics,
        "startDate": start_date.isoformat(),
    }


# ============================================================
# Section 5: Route handler
# ============================================================
```

- [ ] **Step 3: Verify**

```bash
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
grep -n "^async def _get_budget_analysis" backend/python/smartbi_compat/api/analysis_finance.py
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): _get_budget_analysis dispatcher (5-key Jackson hash order from F999 golden)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.2: Route handler dispatch update

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` — `get_finance_analysis` function around line 2102-2139

Spec ref: §3.8 route handler.

- [ ] **Step 1: Find current dispatch chain**

```bash
sed -n '2118,2140p' backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: shows current branches (composite / payable / profit / cost / 501 fallback).

- [ ] **Step 2: Add budget branch using Edit**

Find this exact block:
```python
    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 副轨完成",
    )
```

Replace with:
```python
    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    if analysisType == "budget":
        result = await _get_budget_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 副轨完成",
    )
```

Also update the route handler docstring (line 2110-2115). Find:
```python
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 222-274.

    Branches:
      analysisType empty       → composite (6-key Map via getComprehensiveAnalysis)
      analysisType=payable     → payable per-type (4-key shape, real impl Phase E)
      analysisType=other       → 501 envelope (un-ported, see spec §6 / §12)
    """
```

Replace with:
```python
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 222-274.

    Branches:
      analysisType empty       → composite (6-key Map via getComprehensiveAnalysis)
      analysisType=payable     → payable per-type (4-key shape, real impl Phase E)
      analysisType=profit      → profit per-type (PR #21 + #22 sales fallback)
      analysisType=cost        → cost per-type (PR #25 structure + trend)
      analysisType=budget      → budget per-type (this PR, 5-key dispatcher)
      analysisType=other       → 501 envelope (un-ported, see spec §6 / §12)
    """
```

- [ ] **Step 3: Verify**

```bash
python -c "import ast; ast.parse(open('backend/python/smartbi_compat/api/analysis_finance.py').read())"
grep -A1 'analysisType == "budget"' backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: branch present, no syntax errors.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/budget): wire route dispatch + update docstring" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase D — Contract tests

### Task D.1: `TestAnalysisFinanceBudget` class skeleton + `test_f999_budget_data_keys_match_golden`

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` — append new class at end of file (after line 1689)

Spec ref: §5.1 contract test.

- [ ] **Step 1: Confirm end-of-file location**

```bash
wc -l tests/python/smartbi_compat/test_analysis_finance_contract.py
tail -5 tests/python/smartbi_compat/test_analysis_finance_contract.py
```
Expected: ~1689 lines; last lines should be end of TestAnalysisFinanceCategoryComparisonChart class.

- [ ] **Step 2: Reference an existing similar test class for pattern**

```bash
grep -n "class TestAnalysisFinanceCost:" tests/python/smartbi_compat/test_analysis_finance_contract.py
sed -n '789,861p' tests/python/smartbi_compat/test_analysis_finance_contract.py
```
Expected: shows TestAnalysisFinanceCost class (line 789) with `test_f999_cost_data_keys_match_golden` and `test_f999_cost_byte_shape` patterns. Use this as model.

- [ ] **Step 3: Append new class with first test**

Use Write tool to append the following Python code to the end of `tests/python/smartbi_compat/test_analysis_finance_contract.py`:

```python


class TestAnalysisFinanceBudget:
    """F999 byte-shape gate for /analysis/finance?analysisType=budget per-type path.

    Spec ref: 2026-05-01-phase2a-analysis-finance-budget-design.md §5.1.

    Mocks `_query_finance_data` to return [] (matches F999 empty state).
    Compares response['data'] against recorded golden after _strip_volatile.

    Goldens recorded 2026-05-02 from test env Java 10011 (prod 10010 inactive at
    recording — F001 actually identical to F999 due to test-env empty data; true
    F001 prod re-record is post-deploy smoke per spec §5.4).
    """

    def test_f999_budget_data_keys_match_golden(self, client, monkeypatch):
        """Verify dispatcher emits 5 keys in Jackson hash order.

        Expected order: [comparison, endDate, waterfall, metrics, startDate]
        (verified via F999 golden line 4-107).
        """
        async def fake_query(*_args, **_kwargs):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        token = _make_token("F999")
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=budget",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is True

        data_keys = list(body["data"].keys())
        assert data_keys == ["comparison", "endDate", "waterfall", "metrics", "startDate"], (
            f"dispatcher key order divergence — expected Jackson hash order from "
            f"recorded F999 golden, got {data_keys}"
        )
```

- [ ] **Step 4: Run the test**

```bash
cd .worktrees/phase2a-finance-budget
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceBudget::test_f999_budget_data_keys_match_golden -v
```
Expected: PASS (impl from Phase A-C should produce correct key order).

If FAIL: most likely dispatcher key order divergence. Check Phase C.1 dispatcher matches expected `[comparison, endDate, waterfall, metrics, startDate]` order.

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget): TestAnalysisFinanceBudget + test_f999_budget_data_keys_match_golden" \
  -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task D.2: `test_f999_budget_byte_shape` (full dict-eq compare against golden)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` — add second test method to `TestAnalysisFinanceBudget` class

Spec ref: §5.1.

- [ ] **Step 1: Append second test to existing class**

Edit: find this block (end of test_f999_budget_data_keys_match_golden):
```python
        assert data_keys == ["comparison", "endDate", "waterfall", "metrics", "startDate"], (
            f"dispatcher key order divergence — expected Jackson hash order from "
            f"recorded F999 golden, got {data_keys}"
        )
```

Replace with:
```python
        assert data_keys == ["comparison", "endDate", "waterfall", "metrics", "startDate"], (
            f"dispatcher key order divergence — expected Jackson hash order from "
            f"recorded F999 golden, got {data_keys}"
        )

    def test_f999_budget_byte_shape(self, client, monkeypatch):
        """Full dict-eq compare against committed F999 budget golden.

        Strips volatile keys (timestamp / generatedAt / lastUpdated / cacheExpireAt)
        from both sides before compare. Asserts complete byte-shape parity for
        empty-data state.
        """
        async def fake_query(*_args, **_kwargs):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        token = _make_token("F999")
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=budget",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text
        actual = response.json()

        golden_path = GOLDEN_DIR / "analysis-finance-F999-budget.json"
        with open(golden_path, "r", encoding="utf-8") as f:
            golden = json.load(f)

        # Strip volatile keys + drop outer envelope shell (focus on data)
        actual_stripped = _strip_volatile(actual)
        golden_stripped = _strip_volatile(golden)

        assert actual_stripped["data"] == golden_stripped["data"], (
            f"data byte-shape divergence:\n"
            f"actual:   {json.dumps(actual_stripped['data'], indent=2, ensure_ascii=False)[:1000]}\n"
            f"golden:   {json.dumps(golden_stripped['data'], indent=2, ensure_ascii=False)[:1000]}"
        )
```

- [ ] **Step 2: Run test**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceBudget::test_f999_budget_byte_shape -v
```
Expected: PASS (Phase A-C impl byte-shape-matches recorded F999 golden).

If FAIL: inspect first divergent key/value (look for Map.of(2) order issue, MetricResult missing field, scale issues).

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget): test_f999_budget_byte_shape full dict-eq compare" \
  -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task D.3: `test_f999_budget_date_scope_matrix` (F1 contract verification)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` — add third test method

Spec ref: §3.2 + §5.1 F1 date-scope verification.

- [ ] **Step 1: Append third test**

Edit: find this block (end of test_f999_budget_byte_shape):
```python
        assert actual_stripped["data"] == golden_stripped["data"], (
            f"data byte-shape divergence:\n"
            f"actual:   {json.dumps(actual_stripped['data'], indent=2, ensure_ascii=False)[:1000]}\n"
            f"golden:   {json.dumps(golden_stripped['data'], indent=2, ensure_ascii=False)[:1000]}"
        )
```

Replace with:
```python
        assert actual_stripped["data"] == golden_stripped["data"], (
            f"data byte-shape divergence:\n"
            f"actual:   {json.dumps(actual_stripped['data'], indent=2, ensure_ascii=False)[:1000]}\n"
            f"golden:   {json.dumps(golden_stripped['data'], indent=2, ensure_ascii=False)[:1000]}"
        )

    def test_f999_budget_date_scope_matrix(self, client, monkeypatch):
        """F1 contract: 3 sub-services query 3 different date ranges.

        Per spec §3.2:
          metrics:    endDate's month only [date(2025, 6, 1), date(2025, 6, 30)]
          waterfall:  full year [date(2025, 1, 1), date(2025, 12, 31)]
          comparison: dispatcher range [date(2025, 1, 1), date(2025, 6, 30)]

        Captures every _query_finance_data call's (record_type, start, end)
        and asserts the three calls match expected scopes.
        """
        from datetime import date as _date

        captured_calls: list[tuple] = []

        async def fake_query(factory_id, record_type, start, end):
            captured_calls.append((record_type, start, end))
            return []

        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        token = _make_token("F999")
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-06-30&analysisType=budget",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text

        # 3 sub-services should each call _query_finance_data exactly once
        assert len(captured_calls) == 3, (
            f"expected 3 calls (metrics + waterfall + comparison), got {len(captured_calls)}: "
            f"{captured_calls}"
        )

        # All 3 must use record_type='BUDGET'
        for rt, _, _ in captured_calls:
            assert rt == "BUDGET", f"record_type divergence: expected 'BUDGET', got '{rt}'"

        # Find each call by its start_date pattern (order is impl detail; treat as set)
        ranges = {(s, e) for _, s, e in captured_calls}

        expected_metrics_range = (_date(2025, 6, 1), _date(2025, 6, 30))
        expected_waterfall_range = (_date(2025, 1, 1), _date(2025, 12, 31))
        expected_comparison_range = (_date(2025, 1, 1), _date(2025, 6, 30))

        assert expected_metrics_range in ranges, (
            f"metrics range missing — expected {expected_metrics_range}, "
            f"got ranges {ranges}"
        )
        assert expected_waterfall_range in ranges, (
            f"waterfall range missing — expected {expected_waterfall_range}, "
            f"got ranges {ranges}"
        )
        assert expected_comparison_range in ranges, (
            f"comparison range missing — expected {expected_comparison_range}, "
            f"got ranges {ranges}"
        )
```

- [ ] **Step 2: Run test**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceBudget::test_f999_budget_date_scope_matrix -v
```
Expected: PASS (Phase B-C impl correctly derives year/month from end_date and computes 3 distinct date ranges).

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget): test_f999_budget_date_scope_matrix F1 verification" \
  -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase E — Cleanup + final verification

### Task E.1: Update existing 501 dispatch test to drop "budget"

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py:144` — `test_f999_unimplemented_analysisType_returns_501`

Spec ref: §5.1 closing note.

- [ ] **Step 1: Find existing test**

```bash
sed -n '144,165p' tests/python/smartbi_compat/test_analysis_finance_contract.py
```
Expected: shows current test with loop variable iterating over `["receivable", "budget"]` (or similar).

- [ ] **Step 2: Update list to drop "budget"**

Use Edit tool. The exact block to find depends on what's on main. After cost PR-A merge, this list was reduced to `["receivable", "budget"]`. Find a line containing both `"receivable"` and `"budget"` in a list context, replace `["receivable", "budget"]` with `["receivable"]`.

Likely pattern:
```python
        for analysis_type in ["receivable", "budget"]:
```

Replace with:
```python
        for analysis_type in ["receivable"]:
```

If the list is on multiple lines or formatted differently, locate and adjust. Do NOT remove the test itself — only shrink the loop list.

- [ ] **Step 3: Verify test still passes**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite::test_f999_unimplemented_analysisType_returns_501 -v
```
Expected: PASS (only "receivable" still falls through to 501 envelope).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget): drop 'budget' from 501-dispatch loop (now real impl)" \
  -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task E.2: Run full test suite + verify zero regressions

- [ ] **Step 1: Run full smartbi_compat suite**

```bash
python -m pytest tests/python/smartbi_compat/ -v 2>&1 | tail -30
```
Expected: all tests pass, including the 3 new TestAnalysisFinanceBudget tests + existing tests still green.

If anything fails:
- New tests fail → impl bug, fix in Phase A/B/C
- Existing tests fail → regression introduced, debug; most likely route handler change broke 501 fallback OR dispatcher patterns.

- [ ] **Step 2: Verify branch state**

```bash
git log origin/main..HEAD --oneline
```
Expected: Foundation commit + 8 impl/test commits = ~9 commits total on branch.

- [ ] **Step 3: Verify only 2 source files modified (besides goldens + spec)**

```bash
git diff --stat origin/main..HEAD
```
Expected:
- `backend/python/smartbi_compat/api/analysis_finance.py` (+~250 lines)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` (+~150 lines)
- `tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget.json` (+113 lines, foundation commit)
- `tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget.json` (+113 lines, foundation commit)
- `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md` (modified, foundation commit)
- `docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-a.md` (this plan, +~700 lines)

No other files modified.

- [ ] **Step 4: No commit needed (verification only)**

This task is verification-only. If clean, proceed to push + PR creation in next steps (Task #27 in main session task list).

---

## Self-Review

### Spec coverage check (against budget spec §1-§9)

| Spec section | Plan task |
|---|---|
| §2.1 file delta | All tasks A-E touch listed files |
| §3.3 `_get_budget_metrics` | Task B.1 |
| §3.4 `_get_budget_execution_waterfall` + `_create_waterfall_item` | Tasks A.1 + B.2 |
| §3.5 `_get_budget_vs_actual_chart` | Task B.3 |
| §3.6 `_get_budget_analysis` dispatcher | Task C.1 |
| §3.7 helper naming (reuse + new) | Task A.2 (new) + reuse documented in Task B.1 |
| §3.8 route handler dispatch | Task C.2 |
| §4.1 F999 byte-shape gate | Foundation commit (already done) + Tasks D.1/D.2 |
| §5.1 contract tests | Tasks D.1 + D.2 + D.3 |
| §5.1 501-list update | Task E.1 |
| F1 (date scope) | Task D.3 contract test |
| F2 (no abs() defensive) | Tasks B.1 + B.2 + B.3 explicit raw accumulation |
| F3 (2 alert helpers) | Task A.2 (new) + reuse in B.1 + B.3 |
| Rule 8 Map.of(2) | Task B.3 series order |

PR-B scope (`TestBudgetHelpers` + `TestBudgetMetricsArithmetic` + `TestBudgetExecutionWaterfallArithmetic` + `TestBudgetVsActualChartArithmetic`) **deferred to follow-up plan** — not in this PR-A.

### Placeholder scan

- No "TBD" / "TODO" / "implement later" remaining.
- Each task has exact file:line anchor + code block.
- `_decimal_to_number`, `_format_currency`, `_to_decimal`, `_determine_budget_achievement_alert`, `_new_metric_result_dict`, `_new_chart_config_dict`, `_query_finance_data`, `_strip_volatile`, `GOLDEN_DIR`, `_make_token` are all existing on main (verified via grep).

### Type consistency check

- Function signatures match between plan + spec:
  - `_get_budget_metrics(factory_id: str, year: int, month: int) -> list[dict]`
  - `_get_budget_execution_waterfall(factory_id: str, year: int) -> dict`
  - `_get_budget_vs_actual_chart(factory_id: str, start_date: date, end_date: date) -> dict`
  - `_get_budget_analysis(factory_id: str, start_date: date, end_date: date) -> dict`
  - `_create_waterfall_item(name: str, value: Decimal, type_: str) -> dict`
  - `_determine_budget_variance_rate_alert(rate: Decimal) -> str`
- Reused helpers' signatures verified via grep on existing code.
- All Decimal arithmetic uses `Decimal(...)` literals, never float.
- All thresholds use `float(rate)` for comparison per Rule 7 (integer thresholds 120/100/20/10).

### Branch + ship checklist

- Worktree: `.worktrees/phase2a-finance-budget` (created from origin/main `5d284d38d`)
- Branch: `phase2a/finance-budget` (tracks `origin/main`)
- Foundation commit: `4053f2208` (spec amendment + 2 goldens)
- Expected total commits before squash merge: ~9 (1 foundation + 6 impl + 3 test = 10; could collapse Tasks E.1+E.2 into single commit if needed)
- Expected PR LOC: +~400 (impl) + ~700 (plan) + foundation already counted = ~400 net code change
- Expected pytest delta: +3 tests (TestAnalysisFinanceBudget × 3)
- Concurrent-edit safety: every commit uses `safe-commit.sh -- <files>` to lock scope against sister chat receivable impl

### Parallel work analysis

**Subagent: ✅ Suitable** — Tasks A.1, A.2 are independent helpers; Tasks B.1, B.2, B.3 are independent sub-services (each touches its own function block); Tasks D.1, D.2, D.3 add tests sequentially to one class. Recommended bundling:

- **Subagent A**: Tasks A.1 + A.2 (small helpers, fast)
- **Subagent B**: Task B.1 (largest single task — `_get_budget_metrics`)
- **Subagent C**: Tasks B.2 + B.3 (waterfall + comparison)
- **Subagent D**: Tasks C.1 + C.2 (dispatcher + route)
- **Subagent E**: Tasks D.1 + D.2 + D.3 (3 contract tests as bundle)
- **Subagent F**: Tasks E.1 + E.2 (cleanup + verify)

6 subagent dispatches total. Each subagent uses `safe-commit.sh` and runs targeted pytest before commit.

**Multi-Chat: ❌ Not applicable** — sister `phase2a/finance-receivable` chat already actively editing same file; this chat must serialize against it via plan execution. No further chat parallelism within budget scope.

---

## Audit reduction (per `feedback_subagent_driven_audit_pattern.md`)

PR-A is **real impl** — NOT mechanical. Per memory: "4 audit cycles per spec catches ~30 issues". For impl plans: keep all 4 cycles.

| Cycle | Status | Reason |
|---|---|---|
| Self-review (per subagent task) | KEEP | Each subagent self-reviews before commit |
| Per-task code-review subagent | KEEP for B.1 + B.3 + C.1 (largest impl tasks) | Smaller tasks (helpers, tests) skip per-task review — final reviewer catches |
| Cross-spec audit | SKIP | Spec already cross-spec audited (cycle 3 of spec). Impl-time cross-spec is over-audit. |
| Final implementation reviewer | KEEP | Single end-of-PR reviewer over entire branch diff |

Expected total issues surfaced: ~10-15 (impl bugs, edge cases, polish).

---

## Branch + push + PR

After all tasks complete + final reviewer approves:

```bash
# Push
git push -u origin phase2a/finance-budget

# Create PR
gh pr create \
  --title "Phase 2A: /analysis/finance budget per-type real impl (PR-A)" \
  --base main \
  --head phase2a/finance-budget \
  --body "$(cat <<'EOF'
## Summary

Phase 2A `/analysis/finance?analysisType=budget` per-type **real implementation** (PR-A).
Replaces 501 fallback with full 3-sub-service Python port byte-shape parity against Java.

Spec: PR #34 `354505352` — `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md`
Plan: `docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-a.md`

### Impl scope

- 7 new functions:
  - 2 helpers (`_create_waterfall_item`, `_determine_budget_variance_rate_alert`)
  - 3 sub-services (`_get_budget_metrics`, `_get_budget_execution_waterfall`, `_get_budget_vs_actual_chart`)
  - 1 dispatcher (`_get_budget_analysis`)
  - 1 route handler branch (`if analysisType == "budget"`)
- 3 new contract tests (`TestAnalysisFinanceBudget`)
- 2 recorded F999/F001 budget goldens (foundation commit)
- Drops "budget" from 501-dispatch loop test

### F1/F2/F3/F4 lock-ins (per spec)

- **F1**: 3 sub-services use 3 different date scopes (metrics single month / waterfall full year / comparison dispatcher range) — `test_f999_budget_date_scope_matrix`守住
- **F2**: NO `.abs()` defensive; raw accumulation mirror Java line 933+1044 (Rule 3)
- **F3**: Reuse existing `_determine_budget_achievement_alert` (PR #32 ship'd) for execution rate; new `_determine_budget_variance_rate_alert` for abs-symmetric variance rate
- **F4**: PR-B (~22 arithmetic depth tests, 4 test classes) deferred to follow-up PR

### Rule 8 lock

`comparison.options.series` Map.of(2) entries serialize as `[color, name]` (Jackson hash order, NOT Java source `[name, color]` param order). Verified via F999 golden line 13-20 + Python literal mirrors recorded order.

### Test plan

- [x] All 3 new contract tests pass (F999 byte-shape gate + date scope matrix)
- [x] 501-dispatch loop test updated (no regression on `receivable` still falling through)
- [x] Full pytest `tests/python/smartbi_compat/` zero regressions
- [x] Recorded goldens committed at `tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget.json` + `analysis-finance-F001-budget.json`
- [ ] F001 prod re-record TODO post-prod-restart (10010 systemd inactive at recording time, deferred to post-deploy smoke per spec §5.4)

### Concurrent-edit notes

Sister chat `phase2a/finance-receivable` modifies same file. Used `safe-commit.sh -- <files>` for every commit (Rule 5b). Expected ~5-line route handler conflict at second-merger PR; trivial rebase.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR-A merges via `gh pr merge --squash --admin --delete-branch` per project convention.

---

## Worktree cleanup (after PR merge)

```bash
cd C:/Users/Steve/my-prototype-logistics
git worktree remove --force .worktrees/phase2a-finance-budget
git worktree prune
```
