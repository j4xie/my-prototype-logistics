# Phase 2A `/analysis/procurement` PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Java `/analysis/procurement` per-type modes (`supplier` / `cost` / `trend`) to Python with byte-shape parity vs Java backend; ship as PR-A. Default mode (overview DashboardResponse) is OUT OF SCOPE — Chat 5 ships PR-B.

**Architecture:** New file `backend/python/smartbi_compat/api/analysis_procurement.py` mirroring `analysis_department.py` template. Imports shared helpers (`_to_decimal`, `_decimal_to_number`, `_strip_volatile`, `VOLATILE_KEYS`, `_utc_now_iso`, `_fetch_all`, `_get_period_key`) from `analysis_finance.py`. Auth via `verify_jwt_and_factory`. Three modes dispatched in `_get_procurement_analysis`. Each mode delegates to sub-service helpers; SQL helpers query `material_batches` + `suppliers` tables.

**Tech Stack:** Python 3.8 / FastAPI / asyncpg / pytest / `python-dateutil` (relativedelta).

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md`

**Reference impls:**
- `backend/python/smartbi_compat/api/analysis_department.py` (Tier 2 template, PR #52)
- `backend/python/smartbi_compat/api/analysis_inventory.py` (Tier 2 sister, PR #53)
- `backend/python/smartbi_compat/api/analysis_finance.py` (foundation helpers)

**Critical Rule 9 carry-over (spec drift, MUST mirror golden not spec):**
- ChartConfig field names are **`xaxisField`** / **`yaxisField`** (lowercase 'a' from `Introspector.decapitalize`), NOT `xAxisField` / `yAxisField` as spec §3.9/§3.10/§3.10c/§3.10d literals show.
- ChartConfig has **7 fields all-emit** even when unset (`chartType`, `title`, `xaxisField`, `yaxisField`, `seriesField`, `data`, `options`) — no `@JsonInclude(NON_NULL)`.
- Top-level `data.*` dict key order is determined by Java HashMap hash-iteration, **NOT put-order**. Record goldens FIRST then mirror.

**Auth symbol drift:** Spec §3.2 cites `verify_factory_access` but actual symbol is `verify_jwt_and_factory` (`smartbi_compat/auth.py:40`). Spec wrong; impl uses real symbol.

**Java line ranges to mirror exactly:**
- Controller: `SmartBIAnalysisController.java:452-486` (4-mode dispatcher)
- Service impl: `ProcurementAnalysisServiceImpl.java`
  - `getSupplierRanking` 333-340
  - `getSupplierEvaluation` 126-187 (RADAR)
  - `calculateSupplierRankingFromData` 684-738
  - `getMaterialCategoryRanking` 342-383
  - `getCostMetrics` 282-329
  - `getPurchaseCostAnalysis` 241-280
  - `buildProcurementTrendChartFromData` 744-782 (+ aggregateByDay/Week/Month 787-832)
  - `calculateTotalValue` 540-545
  - `calculateAverageUnitPrice` 550-563
  - `calculateSupplierConcentration` ~568+
  - `calculatePriceScore` 596-601 — **rating × 20, default 70**
  - `calculateQualityScore` 606-618 — **availableCount/total × 100, ZERO on empty**
  - `calculateDeliveryScore` 623-632 — **hardcoded 85** (NOT 80)
  - `calculateServiceScore` 637-643 — **rating × 20, default 70** (NOT 80)
  - `calculateStabilityScore` 648-679 — variance-CV based, default 80 when size<2 / no quantities / avg=0

⚠️ Spec §3.8 placeholder values are **WRONG**. Actual Java uses different defaults — fill from line 596-679 read in Task 6, not spec.

---

## File structure

```
NEW backend/python/smartbi_compat/api/analysis_procurement.py    (~520 LOC)
EDIT backend/python/main.py                                       (+2 LOC: import + register)
NEW tests/python/smartbi_compat/test_analysis_procurement_contract.py  (~220 LOC)
NEW tests/fixtures/java-smartbi-golden/analysis-procurement-F999-supplier.json
NEW tests/fixtures/java-smartbi-golden/analysis-procurement-F999-cost.json
NEW tests/fixtures/java-smartbi-golden/analysis-procurement-F999-trend.json
```

---

## Task 1: Read Java exact dimension scorer logic (verification only)

**Files:**
- Read: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProcurementAnalysisServiceImpl.java:596-679`

- [ ] **Step 1: Read & document scorer logic**

Read Java lines 596-679 and confirm these formulas / defaults (spec §3.8 has WRONG defaults):

| Scorer | Formula | Default |
|---|---|---|
| `calculatePriceScore` | `rating * 20` if rating non-null | `70` if rating null |
| `calculateQualityScore` | `availableCount / total * 100` | `0` (`BigDecimal.ZERO`) on empty batches |
| `calculateDeliveryScore` | hardcoded `85` always (Java line 631) | `85` if deliveryDays null/0 |
| `calculateServiceScore` | `rating * 20` if rating non-null | `70` if rating null |
| `calculateStabilityScore` | `100 - cv*100`, clamped `[0,100]`. cv = sqrt(variance)/avg | `80` if `batches.size() < 2` OR quantities empty OR avg=0 |

- [ ] **Step 2: Save findings inline to Task 6 step**

No commit yet. Just internalize for Task 6.

---

## Task 2: Create skeleton file with imports + threshold constants + empty router

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_procurement.py`

- [ ] **Step 1: Create the skeleton**

```python
"""Phase 2A: /analysis/procurement per-type real impl (PR-A: supplier + cost + trend).

Mirrors Java SmartBIAnalysisController.getProcurementAnalysis (line 452-486)
+ ProcurementAnalysisServiceImpl 7 sub-services. PR-A scope: 3 per-type modes
(supplier / cost / trend). PR-B (Chat 5) adds default mode = overview DashboardResponse.

See spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query

logger = logging.getLogger(__name__)

from smartbi_compat.api.analysis_finance import (
    _decimal_to_number,
    _fetch_all,
    _get_period_key,
    _strip_volatile,
    _to_decimal,
    _utc_now_iso,
    VOLATILE_KEYS,
)
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

# T1: 3 inline threshold pairs (alert_thresholds.json has NO procurement section, verified)
_PROCUREMENT_ON_TIME_RED          = Decimal("70")
_PROCUREMENT_ON_TIME_YELLOW       = Decimal("85")
_PROCUREMENT_QUALITY_RED          = Decimal("90")
_PROCUREMENT_QUALITY_YELLOW       = Decimal("95")
# T1 INVERSE direction: high concentration = high risk
_PROCUREMENT_CONCENTRATION_RED    = Decimal("60")
_PROCUREMENT_CONCENTRATION_YELLOW = Decimal("40")

# Java SCALE constants (mirror ProcurementAnalysisServiceImpl line 52-54)
_SCALE             = Decimal("0.0001")
_DISPLAY_SCALE     = Decimal("0.01")
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


router = APIRouter()
```

- [ ] **Step 2: Sanity-import test (no router yet)**

```bash
cd backend/python && python -c "from smartbi_compat.api import analysis_procurement; print('OK')"
```
Expected: `OK` (no ImportError).

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_procurement.py
git commit -m "WIP: procurement skeleton (imports + threshold consts)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 3: Register router in main.py

**Files:**
- Modify: `backend/python/main.py:1114-1121` (add import + register line)

- [ ] **Step 1: Add import after existing imports (after line 1114)**

```python
    from smartbi_compat.api import analysis_procurement
```

- [ ] **Step 2: Add include_router after existing registrations (after line 1121)**

```python
    app.include_router(analysis_procurement.router, tags=["SmartBI Compat: Analysis Procurement"])
```

- [ ] **Step 3: Smoke-test FastAPI app loads**

```bash
cd backend/python && JWT_SECRET=test python -c "
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'main.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
print([r.path for r in m.app.routes if 'procurement' in r.path])
"
```
Expected: empty list (no endpoints yet — router has no paths yet) but no ImportError.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "WIP: register procurement router in main.py" -- backend/python/main.py
```

---

## Task 4: Record 3 F999 goldens (supplier / cost / trend)

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-procurement-F999-supplier.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-procurement-F999-cost.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-procurement-F999-trend.json`

⚠️ **REQUIRES SSH tunnel to test env Java backend** (port 10011) OR running Java backend locally. Java cretas-backend-test has F999 empty dataset (no material_batches / suppliers for F999). JWT_SECRET from `/www/wwwroot/cretas/.env.test` on server.

- [ ] **Step 1: Establish SSH tunnel (if not running)**

```bash
ssh -L 10011:localhost:10011 root@47.100.235.168 -N &
SSH_PID=$!
# verify
curl -s http://localhost:10011/api/mobile/health | head -c 100
```

If SSH key auth fails, ask user to start the tunnel manually.

- [ ] **Step 2: Get JWT_SECRET**

```bash
ssh root@47.100.235.168 'grep ^JWT_SECRET /www/wwwroot/cretas/.env.test | cut -d= -f2-'
# capture into JWT_SECRET shell var
```

- [ ] **Step 3: Record 3 goldens via record-java-golden.sh**

```bash
JWT_SECRET=<value> BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=supplier' \
    analysis-procurement-F999-supplier.json

JWT_SECRET=<value> BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=cost' \
    analysis-procurement-F999-cost.json

JWT_SECRET=<value> BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=trend' \
    analysis-procurement-F999-trend.json
```

- [ ] **Step 4: Verify each golden has `success: true` + sane shape**

```bash
for mode in supplier cost trend; do
  echo "=== $mode ==="
  jq '{success, code, data_keys: (.data | keys)}' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-$mode.json
done
```

Expected: all three `success: true`, each `data` block has `[startDate, endDate]` plus mode-specific keys.

- [ ] **Step 5: Document the actual top-level `data.*` key order in each golden**

Inspect each file's `data` keys order and capture for use in Task 13 dispatcher dict literal. Run:

```bash
for mode in supplier cost trend; do
  echo "$mode: $(jq '.data | keys_unsorted' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-$mode.json)"
done
```

Save the orders inline in the next step's planning notes.

- [ ] **Step 6: Inspect ChartConfig empty-case shape (Rule 9 verify)**

```bash
# evaluation (RADAR), costAnalysis (PIE), trendChart (LINE)
jq '.data.evaluation | keys_unsorted' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-supplier.json
jq '.data.costAnalysis | keys_unsorted' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-cost.json
jq '.data.trendChart | keys_unsorted' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-trend.json
```

Expected per Rule 9 §9.2: ALL chartConfig instances emit 7 fields with `xaxisField` (lowercase 'a').
**Capture exact key order for Task 9-12 dict literals.**

- [ ] **Step 7: Commit goldens**

```bash
git status --short
git commit -m "WIP: record 3 F999 procurement goldens (supplier/cost/trend)" -- \
  tests/fixtures/java-smartbi-golden/analysis-procurement-F999-supplier.json \
  tests/fixtures/java-smartbi-golden/analysis-procurement-F999-cost.json \
  tests/fixtures/java-smartbi-golden/analysis-procurement-F999-trend.json
```

---

## Task 5: SQL helpers (3 functions)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

- [ ] **Step 1: Add SQL helpers**

Append after the `router = APIRouter()` line:

```python
async def _query_material_batches_in_range(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getBatchesInDateRange (line 451-456) but as explicit SQL.

    T3 fix: Java JPA derived `findByFactoryIdAndStatus(factoryId, AVAILABLE).stream()
    .filter(receiptDate in [start, end])` has NO ORDER BY → row order non-deterministic.
    Python adds explicit `ORDER BY id` for byte-shape determinism.
    Soft-delete: WHERE deleted_at IS NULL (mirror @Where annotation on entity).
    Rule 5: SELECT * future-proof. Rule 6: input boundary None-check.
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
    JPA derived query has NO ORDER BY → Python adds explicit ORDER BY id.
    @Where(deleted_at IS NULL) on Supplier.java:33 — mirror.
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
    factory_id filter (T11 — safer than Java which has cross-factory leak risk).
    Returns None if not found (mirror Optional.empty()).
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

- [ ] **Step 2: Smoke test**

```bash
cd backend/python && python -c "from smartbi_compat.api import analysis_procurement; print(analysis_procurement._query_material_batches_in_range)"
```
Expected: prints function repr.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement SQL helpers (T3 + T11)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 6: Calculation helpers (T9 MoM growth + total/avg + concentration + currency format + month arithmetic)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

- [ ] **Step 1: Add calculation helpers**

```python
def _calculate_total_value(batches: list[dict]) -> Decimal:
    """Mirror Java calculateTotalValue (line 540-545) + getTotalValue() @Transient
    (line 216-219): unitPrice × receiptQuantity, ZERO when either null.
    """
    total = Decimal("0")
    for b in batches:
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        if up is not None and rq is not None:
            total += _to_decimal(up) * _to_decimal(rq)
    return total


def _calculate_average_unit_price(batches: list[dict]) -> Decimal:
    """Mirror Java calculateAverageUnitPrice (line 550-563): filter unit_price > 0,
    then sum / count, SCALE=4 HALF_UP.
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


def _calculate_supplier_concentration(batches: list[dict]) -> Decimal:
    """Mirror Java calculateSupplierConcentration: groupBy supplier_id, max/total*100.
    Returns max supplier % (0-100). T1 inverse: > 60 = RED risk.
    """
    supplier_values: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv
    if not supplier_values:
        return Decimal("0")
    total = sum(supplier_values.values(), Decimal("0"))
    if total <= Decimal("0"):
        return Decimal("0")
    max_value = max(supplier_values.values())
    return ((max_value / total).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100"))


def _calculate_mom_growth(current: Optional[Decimal], previous: Optional[Decimal]) -> Decimal:
    """Mirror Java MetricCalculatorServiceImpl.calculateMomGrowth (line 425-438).

    T9 — 3 edge cases + .abs(previous) denom:
    - previous None or == 0 → if current > 0: 100; else 0
    - current None (with non-zero previous) → -100
    - else: (current - previous) / abs(previous) * 100, SCALE=4 then DISPLAY_SCALE=2 HALF_UP

    Critical: abs() on denom prevents sign-flip when previous is negative.
    e.g. previous=-50, current=10 → 60/50 = 1.20 → 120 (positive growth shown).
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


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java formatCurrency (line 1138-1143):
        if (value == null) return "-";
        return String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue());
    """
    if value is None:
        return "-"
    quantized = value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return f"{float(quantized):,.2f}"


def _minus_months(d: date, n: int) -> date:
    """Mirror Java LocalDate.minusMonths(n) — calendar-month arithmetic respecting EoM.
    Uses python-dateutil relativedelta for end-of-month behavior matching Java.
    """
    return d - relativedelta(months=n)
```

- [ ] **Step 2: Quick sanity check**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_procurement import _calculate_mom_growth
from decimal import Decimal
# Edge cases
assert _calculate_mom_growth(None, None) == Decimal('0')
assert _calculate_mom_growth(Decimal('10'), None) == Decimal('100')
assert _calculate_mom_growth(None, Decimal('100')) == Decimal('-100')
assert _calculate_mom_growth(Decimal('120'), Decimal('100')) == Decimal('20.00')
# Negative previous → abs() denom
val = _calculate_mom_growth(Decimal('10'), Decimal('-50'))
assert val == Decimal('120.00'), f'got {val}'
print('OK')
"
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement calculation helpers (total/avg/conc/MoM/format/months)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 7: Alert helpers (4 functions)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

- [ ] **Step 1: Add alert level helpers**

```python
def _determine_on_time_alert_level(delivery_rate: Decimal) -> str:
    """Mirror Java determineOnTimeAlertLevel (line 1080-1091): RED < 70, YELLOW < 85, GREEN."""
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
    """Mirror Java determineConcentrationAlertLevel (line 1109-1116) — T1 INVERSE direction:
        if (> 60) RED; if (> 40) YELLOW; else GREEN.
    Note strict `>` not `>=`: 40.0 → GREEN, 60.0 → YELLOW, 60.01 → RED.
    """
    if concentration > _PROCUREMENT_CONCENTRATION_RED:
        return "RED"
    if concentration > _PROCUREMENT_CONCENTRATION_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_change_direction(change_percent: Optional[Decimal]) -> str:
    """Mirror Java determineChangeDirection (line 1122-1133): null/0=STABLE, >0=UP, <0=DOWN."""
    if change_percent is None:
        return "STABLE"
    if change_percent > Decimal("0"):
        return "UP"
    if change_percent < Decimal("0"):
        return "DOWN"
    return "STABLE"
```

- [ ] **Step 2: Sanity check**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_procurement import (
    _determine_concentration_alert_level as conc, _determine_quality_alert_level as qual,
)
from decimal import Decimal
# T1 inverse boundary
assert conc(Decimal('39.99')) == 'GREEN'
assert conc(Decimal('40.00')) == 'GREEN'   # strict >
assert conc(Decimal('40.01')) == 'YELLOW'
assert conc(Decimal('60.00')) == 'YELLOW'
assert conc(Decimal('60.01')) == 'RED'
# Quality (forward direction)
assert qual(Decimal('89.99')) == 'RED'
assert qual(Decimal('90.00')) == 'YELLOW'  # strict <
assert qual(Decimal('95.00')) == 'GREEN'
print('OK')
"
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement alert helpers (T1 inverse concentration)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 8: 5 dimension scorers (mirror Java 596-679 exactly)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

⚠️ **Spec §3.8 default values are WRONG.** Use Task 1 verified values.

- [ ] **Step 1: Add 5 dimension scorers**

```python
def _calculate_price_score(supplier: dict, supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculatePriceScore (line 596-601): rating × 20, default 70 if rating null."""
    rating = supplier.get("rating")
    if rating is None:
        return Decimal("70")
    return Decimal(rating) * Decimal("20")


def _calculate_quality_score(supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculateQualityScore (line 606-618):
        availableCount / totalBatches × 100. Empty batches → ZERO.
    """
    if not supplier_batches:
        return Decimal("0")
    available_count = sum(1 for b in supplier_batches if b.get("status") == "AVAILABLE")
    return ((Decimal(available_count) / Decimal(len(supplier_batches)))
            .quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100"))


def _calculate_delivery_score(supplier: dict, supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculateDeliveryScore (line 623-632): hardcoded 85 always.
    Java line 631 falls through to `return new BigDecimal("85")` regardless of branch.
    """
    return Decimal("85")


def _calculate_service_score(supplier: dict) -> Decimal:
    """Mirror Java calculateServiceScore (line 637-643): rating × 20, default 70."""
    rating = supplier.get("rating")
    if rating is None:
        return Decimal("70")
    return Decimal(rating) * Decimal("20")


def _calculate_stability_score(supplier_batches: list[dict]) -> Decimal:
    """Mirror Java calculateStabilityScore (line 648-679): variance-CV based.
    Default 80 when batches.size() < 2 OR no quantities OR avg=0.
    score = 100 - cv*100, clamped [0, 100].
    """
    if len(supplier_batches) < 2:
        return Decimal("80")
    quantities = []
    for b in supplier_batches:
        q = b.get("receipt_quantity")
        if q is not None:
            quantities.append(_to_decimal(q))
    if not quantities:
        return Decimal("80")
    avg = (sum(quantities, Decimal("0")) / Decimal(len(quantities))).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP)
    if avg == Decimal("0"):
        return Decimal("80")
    variance = (sum(((q - avg) ** 2 for q in quantities), Decimal("0"))
                / Decimal(len(quantities))).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
    # Java line 675: variance.sqrt(MathContext(10)).divide(avg, SCALE=4, HALF_UP)
    # Decimal.sqrt requires Python 3.8+ via context; use float() bridge for sqrt
    cv = (Decimal(str(float(variance) ** 0.5)) / avg).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP)
    score = Decimal("100") - cv * Decimal("100")
    return max(Decimal("0"), min(score, Decimal("100")))
```

- [ ] **Step 2: Sanity check**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_procurement import (
    _calculate_price_score, _calculate_quality_score, _calculate_delivery_score,
    _calculate_service_score, _calculate_stability_score,
)
from decimal import Decimal
# Defaults
assert _calculate_price_score({'rating': None}, []) == Decimal('70')
assert _calculate_price_score({'rating': 5}, []) == Decimal('100')
assert _calculate_quality_score([]) == Decimal('0')
assert _calculate_delivery_score({}, []) == Decimal('85')
assert _calculate_service_score({'rating': None}) == Decimal('70')
assert _calculate_service_score({'rating': 4}) == Decimal('80')
assert _calculate_stability_score([]) == Decimal('80')
assert _calculate_stability_score([{'receipt_quantity': Decimal('100')}]) == Decimal('80')  # size<2
# Quality with one available out of 2
batches = [{'status': 'AVAILABLE'}, {'status': 'EXPIRED'}]
assert _calculate_quality_score(batches) == Decimal('50.0000')
print('OK')
"
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: 5 procurement dimension scorers (Java 596-679 exact)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 9: `_get_supplier_evaluation` + `_get_supplier_ranking` + `_calculate_supplier_ranking_from_data`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

⚠️ **Rule 9 carry-over**: dict literals MUST use `xaxisField` / `yaxisField` (lowercase 'a'). Verify against `evaluation` block in `analysis-procurement-F999-supplier.json` Task 4 §6 inspection.

- [ ] **Step 1: Add supplier mode sub-services**

```python
async def _get_supplier_evaluation(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getSupplierEvaluation (line 126-187). RADAR ChartConfig with 5 dimensions.

    T5: dimensions/dimensionNames are Arrays.asList(5) — declaration order preserved.
    Rule 9 §9.1: ChartConfig field is 'xaxisField' (lowercase 'a').
    Rule 9 §9.2: ChartConfig has 7 emit-all fields (no @JsonInclude).
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    suppliers = await _query_active_suppliers(factory_id)

    chart_data = []
    for supplier in suppliers:
        supplier_batches = [b for b in batches if b.get("supplier_id") == supplier["id"]]
        if not supplier_batches:
            continue
        # Java line 145-167: LinkedHashMap put-order
        chart_data.append({
            "supplierName":         supplier["name"],
            "priceCompetitiveness": _decimal_to_number(_calculate_price_score(supplier, supplier_batches)),
            "qualityPassRate":      _decimal_to_number(_calculate_quality_score(supplier_batches)),
            "onTimeDelivery":       _decimal_to_number(_calculate_delivery_score(supplier, supplier_batches)),
            "serviceResponse":      _decimal_to_number(_calculate_service_score(supplier)),
            "supplyStability":      _decimal_to_number(_calculate_stability_score(supplier_batches)),
        })

    # Java line 172-178: LinkedHashMap put-order [showLegend, maxValue, dimensions, dimensionNames]
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

    # ChartConfig 7-field shape per Rule 9 §9.2 (no @JsonInclude on DTO).
    # Field NAMES from golden: 'xaxisField' / 'yaxisField' (lowercase 'a' per Rule 9 §9.1).
    # Adjust field ORDER to match Task 4 step 6 golden inspection.
    return {
        "chartType":   "RADAR",
        "title":       "供应商综合评估",
        "xaxisField":  "supplierName",
        "yaxisField":  None,
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }


async def _get_supplier_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getSupplierRanking (line 333-340) — delegates to _calculate_supplier_ranking_from_data."""
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    return await _calculate_supplier_ranking_from_data(factory_id, batches)


async def _calculate_supplier_ranking_from_data(
    factory_id: str, batches: list[dict]
) -> list[dict]:
    """Mirror Java calculateSupplierRankingFromData (line 684-738).
    T11: Python uses _query_supplier_by_id with factory_id filter (safer than Java).
    RankingItem field order (Lombok @Builder): [rank, name, value, target, completionRate, alertLevel].
    """
    supplier_values: dict[str, Decimal] = {}
    supplier_batch_counts: dict[str, int] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv
        supplier_batch_counts[sid] = supplier_batch_counts.get(sid, 0) + 1

    if not supplier_values:
        return []

    total_value = sum(supplier_values.values(), Decimal("0"))
    sorted_entries = sorted(supplier_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (sid, value) in enumerate(sorted_entries, start=1):
        batch_count = supplier_batch_counts.get(sid, 0)
        if total_value > Decimal("0"):
            percentage = ((value / total_value).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
                          * Decimal("100"))
        else:
            percentage = Decimal("0")
        supplier = await _query_supplier_by_id(sid, factory_id)
        supplier_name = supplier["name"] if supplier else sid

        supplier_batches = [b for b in batches if b.get("supplier_id") == sid]
        quality_rate = _calculate_quality_score(supplier_batches)
        alert_level = _determine_quality_alert_level(quality_rate)

        rankings.append({
            "rank":           rank,
            "name":           supplier_name,
            "value":          _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "target":         _decimal_to_number(Decimal(batch_count)),
            "completionRate": _decimal_to_number(percentage.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "alertLevel":     alert_level,
        })
    return rankings
```

- [ ] **Step 2: Smoke test against empty batches**

```bash
cd backend/python && python -c "
import asyncio
from smartbi_compat.api.analysis_procurement import _calculate_supplier_ranking_from_data
result = asyncio.run(_calculate_supplier_ranking_from_data('F999', []))
assert result == [], f'expected [], got {result}'
print('OK')
"
```

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement supplier mode (evaluation + ranking)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 10: `_get_cost_metrics` (5 metrics) + `_get_purchase_cost_analysis` (PIE) + `_get_material_category_ranking`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

- [ ] **Step 1: Add cost mode sub-services**

```python
async def _get_cost_metrics(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getCostMetrics (line 282-329). 4-or-5 metrics (5 when previous period non-empty).
    MetricResult fields per Lombok @Builder: [metricCode, metricName, value, formattedValue,
    unit, dimensionValue, changeValue, changePercent, changeDirection, alertLevel, description].
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    metrics: list[dict] = []

    total_amount = _calculate_total_value(batches)
    metrics.append(_metric_result_of("PROCUREMENT_AMOUNT", "采购总额", total_amount, "元"))
    metrics.append(_metric_result_of("BATCH_COUNT", "采购批次", Decimal(len(batches)), "批"))
    metrics.append(_metric_result_of("AVG_UNIT_PRICE", "平均单价",
                                     _calculate_average_unit_price(batches), "元"))

    # Java line 302-314: MAX_UNIT_PRICE conditional on any non-null unit_price
    valid_priced = [b for b in batches if b.get("unit_price") is not None]
    if valid_priced:
        max_batch = max(valid_priced, key=lambda b: _to_decimal(b["unit_price"]))
        metrics.append({
            "metricCode":      "MAX_UNIT_PRICE",
            "metricName":      "最高单价",
            "value":           _decimal_to_number(_to_decimal(max_batch["unit_price"])),
            "formattedValue":  None,
            "unit":            "元",
            "dimensionValue":  max_batch.get("material_type_id"),
            "changeValue":     None,
            "changePercent":   None,
            "changeDirection": None,
            "alertLevel":      "GREEN",
            "description":     None,
        })

    # Java line 317-326: MoM growth conditional on previous period non-empty
    previous_start = _minus_months(start_date, 1)
    previous_end = _minus_months(end_date, 1)
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
            "changeValue":     _decimal_to_number(mom_growth),
            "changePercent":   _decimal_to_number(mom_growth),
            "changeDirection": direction,
            "alertLevel":      None,
            "description":     None,
        })

    return metrics


def _metric_result_of(metric_code: str, metric_name: str, value: Decimal, unit: str) -> dict:
    """Mirror Java MetricResult.of(code, name, value, unit) - basic factory.
    11-field MetricResult shape (Lombok @Data + Jackson — emit nulls per Rule 9 §9.2).
    """
    return {
        "metricCode":      metric_code,
        "metricName":      metric_name,
        "value":           _decimal_to_number(value if isinstance(value, Decimal) else Decimal(value)),
        "formattedValue":  None,
        "unit":            unit,
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      None,
        "description":     None,
    }


async def _get_purchase_cost_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getPurchaseCostAnalysis (line 241-280). PIE chart by material category.
    T4: groupBy + sort-by-value-desc deterministic. ChartConfig 7-field shape.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        category_values[mtid] = category_values.get(mtid, Decimal("0")) + tv

    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)
    chart_data = [
        {
            "category": mtid,
            "value":    _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        }
        for mtid, value in sorted_entries
    ]

    options = {
        "showPercentage": True,
        "showLegend":     True,
    }
    return {
        "chartType":   "PIE",
        "title":       "采购成本分布",
        "xaxisField":  "category",
        "yaxisField":  "value",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }


async def _get_material_category_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getMaterialCategoryRanking (line 342-383). RankingItem with NO target,
    alertLevel always GREEN per Java line 378.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        category_values[mtid] = category_values.get(mtid, Decimal("0")) + tv

    if not category_values:
        return []

    total_value = sum(category_values.values(), Decimal("0"))
    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (mtid, value) in enumerate(sorted_entries, start=1):
        if total_value > Decimal("0"):
            percentage = ((value / total_value).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
                          * Decimal("100"))
        else:
            percentage = Decimal("0")
        rankings.append({
            "rank":           rank,
            "name":           mtid,
            "value":          _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "target":         None,
            "completionRate": _decimal_to_number(percentage.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "alertLevel":     "GREEN",
        })
    return rankings
```

- [ ] **Step 2: Smoke test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_procurement import _metric_result_of
from decimal import Decimal
m = _metric_result_of('X', '名', Decimal('100'), '元')
assert list(m.keys()) == ['metricCode','metricName','value','formattedValue','unit',
                           'dimensionValue','changeValue','changePercent','changeDirection',
                           'alertLevel','description']
print('OK')
"
```

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement cost mode (5 metrics + PIE + category ranking)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 11: `_get_procurement_trend_chart` (LINE chart, period=MONTH)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

- [ ] **Step 1: Add trend chart**

```python
async def _get_procurement_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Mirror Java getProcurementTrendChart + buildProcurementTrendChartFromData (line 744-782).

    Period dispatch (Java line 747-758):
      DAY   → b.getReceiptDate().toString()  (ISO yyyy-MM-dd)
      WEEK  → date.with(previousOrSame(MONDAY)).toString()  (ISO yyyy-MM-dd of Monday)
      MONTH → year + "-" + month%02d         (default for procurement trend mode)

    ⚠️ NOTE: Java WEEK uses Monday-of-week ISO date, NOT Rule 2 ISO-week format.
    Spec §3.10d cited _get_period_key — that's WRONG for procurement (Rule 2 fix
    is for finance trend specs). PR-A trend mode hardcodes MONTH so this doesn't
    bite, but documenting for sister chats.

    TreeMap → sorted dict keys for byte determinism. ChartConfig 7-field shape.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    period_upper = period.upper()
    period_values: dict[str, Decimal] = {}
    for b in batches:
        rd = b.get("receipt_date")
        if rd is None:
            continue
        if period_upper == "WEEK":
            # Mirror Java date.with(previousOrSame(MONDAY)).toString()
            # Python: weekday() returns 0=Mon..6=Sun; subtract to get Monday.
            from datetime import timedelta
            week_start = rd - timedelta(days=rd.weekday())
            period_key = week_start.isoformat()
        elif period_upper == "MONTH":
            period_key = f"{rd.year}-{rd.month:02d}"
        else:    # DAY default
            period_key = rd.isoformat()
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        period_values[period_key] = period_values.get(period_key, Decimal("0")) + tv

    sorted_keys = sorted(period_values.keys())
    chart_data = [
        {
            "date":   k,
            "amount": _decimal_to_number(
                period_values[k].quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for k in sorted_keys
    ]

    # Java line 770-772: options LinkedHashMap [showDataLabels=false, smooth=true]
    options = {"showDataLabels": False, "smooth": True}

    return {
        "chartType":   "LINE",
        "title":       "采购趋势",
        "xaxisField":  "date",
        "yaxisField":  "amount",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }
```

- [ ] **Step 2: Smoke test empty**

```bash
cd backend/python && python -c "
import asyncio
from smartbi_compat.api.analysis_procurement import _get_procurement_trend_chart
async def main():
    # Mock empty batches via direct call won't work without DB; smoke import-only
    pass
print('OK (import smoke)')
"
```

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement trend chart (LINE, period dispatch)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 12: Mode dispatcher + GET endpoint

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_procurement.py` (append)

⚠️ Top-level `data.*` key order MUST match goldens recorded in Task 4 step 5. Adjust dict literal field order accordingly.

- [ ] **Step 1: Add dispatcher + endpoint**

```python
async def _get_procurement_analysis(
    factory_id: str, start_date: date, end_date: date, analysis_type: Optional[str]
) -> dict:
    """Mirror Java SmartBIAnalysisController.getProcurementAnalysis 4-mode dispatch.
    PR-A: supplier / cost / trend modes only. PR-B (Chat 5) adds default = overview.

    Top-level dict key order from F999 goldens (Java HashMap hash-iteration order):
      supplier: [<TBD from Task 4 §5>]
      cost:     [<TBD from Task 4 §5>]
      trend:    [<TBD from Task 4 §5>]
    Adjust dict literals below to match goldens exactly.
    """
    base_keys = {
        "startDate": start_date.isoformat(),
        "endDate":   end_date.isoformat(),
    }

    if analysis_type == "supplier":
        ranking    = await _get_supplier_ranking(factory_id, start_date, end_date)
        evaluation = await _get_supplier_evaluation(factory_id, start_date, end_date)
        # TODO: reorder keys to match analysis-procurement-F999-supplier.json data keys
        return {**base_keys, "ranking": ranking, "evaluation": evaluation}

    if analysis_type == "cost":
        metrics       = await _get_cost_metrics(factory_id, start_date, end_date)
        cost_analysis = await _get_purchase_cost_analysis(factory_id, start_date, end_date)
        category_ranking = await _get_material_category_ranking(factory_id, start_date, end_date)
        # TODO: reorder keys to match analysis-procurement-F999-cost.json data keys
        return {**base_keys, "metrics": metrics, "costAnalysis": cost_analysis, "categoryRanking": category_ranking}

    if analysis_type == "trend":
        trend_chart = await _get_procurement_trend_chart(factory_id, start_date, end_date, "MONTH")
        # TODO: reorder keys to match analysis-procurement-F999-trend.json data keys
        return {**base_keys, "trendChart": trend_chart}

    # default mode (overview DashboardResponse) — out of PR-A scope, Chat 5 ships PR-B
    raise NotImplementedError(
        "procurement default (overview) mode is PR-B scope (Chat 5); "
        "PR-A only handles analysisType=supplier/cost/trend"
    )


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/procurement")
async def get_procurement_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    analysisType: Optional[str] = Query(None),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getProcurementAnalysis (line 452-486)."""
    result = await _get_procurement_analysis(factory_id, startDate, endDate, analysisType)
    return wrap_response(result)
```

- [ ] **Step 2: Inspect goldens & adjust key orders**

For each mode, run jq and update dispatcher dict literal so Python emits same insertion order:

```bash
for mode in supplier cost trend; do
  echo "=== $mode ==="
  jq '.data | keys_unsorted' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-$mode.json
done
```

Edit `_get_procurement_analysis` dict literals so `**base_keys` plus mode-specific keys appear in the **exact** order golden shows. (May need to drop `**base_keys` and inline all keys explicitly if `startDate` doesn't appear first in golden.)

- [ ] **Step 3: Smoke test endpoint registration**

```bash
cd backend/python && JWT_SECRET=test python -c "
import importlib.util, sys
spec = importlib.util.spec_from_file_location('m', 'main.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
proc_routes = [r.path for r in m.app.routes if 'procurement' in r.path]
assert proc_routes == ['/api/mobile/{factory_id}/smart-bi/analysis/procurement'], f'got {proc_routes}'
print('OK')
"
```

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "WIP: procurement dispatcher + GET endpoint (3 modes)" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 13: Contract test fixture skeleton

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_procurement_contract.py`

Mirror `test_analysis_department_contract.py:1-110` (production_app loader + JWT setup + _strip_volatile + monkeypatch fixtures).

- [ ] **Step 1: Create test scaffold**

```python
"""Byte-shape contract gate for /analysis/procurement per-type modes (PR-A).

Java reference:
  - Controller: SmartBIAnalysisController.getProcurementAnalysis line 452-486
  - Service: ProcurementAnalysisServiceImpl

Mirrors sister test_analysis_department_contract.py pattern.
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import jwt
import pytest


JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1, "username": "test_user", "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


@pytest.fixture
def patched_empty(monkeypatch):
    """Patch SQL helpers to return empty rows (F999 baseline)."""

    async def _empty_batches(factory_id, start_date, end_date):
        return []

    async def _empty_suppliers(factory_id):
        return []

    async def _empty_supplier_by_id(supplier_id, factory_id):
        return None

    monkeypatch.setattr(
        "smartbi_compat.api.analysis_procurement._query_material_batches_in_range",
        _empty_batches,
    )
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_procurement._query_active_suppliers",
        _empty_suppliers,
    )
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_procurement._query_supplier_by_id",
        _empty_supplier_by_id,
    )


def _hit(client, mode, factory_id="F999"):
    """Helper to hit the endpoint with consistent params."""
    suffix = f"&analysisType={mode}" if mode else ""
    return client.get(
        f"/api/mobile/{factory_id}/smart-bi/analysis/procurement"
        f"?startDate=2025-01-01&endDate=2025-12-31{suffix}",
        headers={"Authorization": f"Bearer {_make_token(factory_id)}"},
    )


def _byte_compare_data(client, mode, golden_filename, patched_empty):
    """Shared body for byte-shape comparison test."""
    resp = _hit(client, mode)
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    py_data = _strip_volatile(resp.json()["data"])
    with io.open(GOLDEN_DIR / golden_filename, encoding="utf-8") as f:
        golden_data = _strip_volatile(json.load(f)["data"])
    if py_data != golden_data:
        diffs = {}
        for k in set(py_data.keys()) | set(golden_data.keys()):
            if py_data.get(k) != golden_data.get(k):
                diffs[k] = {"python": py_data.get(k), "golden": golden_data.get(k)}
        pytest.fail(
            f"BYTE SHAPE MISMATCH on {list(diffs.keys())}\n"
            f"{json.dumps(diffs, indent=2, ensure_ascii=False, default=str)[:2000]}"
        )
```

- [ ] **Step 2: Smoke test pytest discovery**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py --collect-only -q 2>&1 | head -10
```

Expected: `0 tests collected` (no tests defined yet, but no import errors).

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement contract test scaffold" -- tests/python/smartbi_compat/test_analysis_procurement_contract.py
```

---

## Task 14: TestAnalysisProcurementSupplierMode (3 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_procurement_contract.py` (append)

- [ ] **Step 1: Append supplier mode tests**

```python
class TestAnalysisProcurementSupplierMode:
    """F999 byte-shape gate for analysisType=supplier."""

    def test_f999_supplier_data_keys_match_golden(self, client, patched_empty):
        """Top-level data keys order matches Java HashMap hash-iter order."""
        resp = _hit(client, "supplier")
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-supplier.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"].keys())
        assert py_keys == golden_keys, (
            f"data key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )

    def test_f999_supplier_byte_shape(self, client, patched_empty):
        _byte_compare_data(client, "supplier",
                           "analysis-procurement-F999-supplier.json", patched_empty)

    def test_f999_supplier_radar_dimensions_exact_order(self, client, patched_empty):
        """T5: dimensions list preserves declaration order [price, quality, on-time, service, stability]."""
        resp = _hit(client, "supplier")
        assert resp.status_code == 200
        evaluation = resp.json()["data"]["evaluation"]
        assert evaluation["options"]["dimensions"] == [
            "priceCompetitiveness", "qualityPassRate", "onTimeDelivery",
            "serviceResponse", "supplyStability",
        ], f"dimensions order wrong: {evaluation['options']['dimensions']}"
        assert evaluation["options"]["dimensionNames"] == [
            "价格竞争力", "质量合格率", "准时交付", "服务响应", "供货稳定",
        ], f"dimensionNames order wrong: {evaluation['options']['dimensionNames']}"
```

- [ ] **Step 2: Run supplier tests**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestAnalysisProcurementSupplierMode -v 2>&1 | tail -50
```

Expected: 3 PASS. If FAIL, the diff message shows exact byte-shape drift — fix `_get_supplier_evaluation` / dispatcher dict literals to match golden, repeat.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement supplier mode contract tests (3 tests)" -- tests/python/smartbi_compat/test_analysis_procurement_contract.py
```

---

## Task 15: TestAnalysisProcurementCostMode (3 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_procurement_contract.py` (append)

- [ ] **Step 1: Append cost mode tests**

```python
class TestAnalysisProcurementCostMode:
    """F999 byte-shape gate for analysisType=cost."""

    def test_f999_cost_data_keys_match_golden(self, client, patched_empty):
        resp = _hit(client, "cost")
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-cost.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"].keys())
        assert py_keys == golden_keys, (
            f"data key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )

    def test_f999_cost_byte_shape(self, client, patched_empty):
        _byte_compare_data(client, "cost",
                           "analysis-procurement-F999-cost.json", patched_empty)

    def test_f999_cost_pie_chart_options_order(self, client, patched_empty):
        """costAnalysis (PIE ChartConfig) options keys: [showPercentage, showLegend]."""
        resp = _hit(client, "cost")
        cost_analysis = resp.json()["data"]["costAnalysis"]
        assert list(cost_analysis["options"].keys()) == ["showPercentage", "showLegend"], (
            f"options keys order wrong: {list(cost_analysis['options'].keys())}"
        )
```

- [ ] **Step 2: Run cost tests**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestAnalysisProcurementCostMode -v 2>&1 | tail -50
```

Expected: 3 PASS. Iterate on dispatcher / sub-service dict literals if FAIL.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement cost mode contract tests (3 tests)" -- tests/python/smartbi_compat/test_analysis_procurement_contract.py
```

---

## Task 16: TestAnalysisProcurementTrendMode (2 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_procurement_contract.py` (append)

- [ ] **Step 1: Append trend mode tests**

```python
class TestAnalysisProcurementTrendMode:
    """F999 byte-shape gate for analysisType=trend."""

    def test_f999_trend_data_keys_match_golden(self, client, patched_empty):
        resp = _hit(client, "trend")
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-trend.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"].keys())
        assert py_keys == golden_keys, (
            f"data key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )

    def test_f999_trend_byte_shape(self, client, patched_empty):
        _byte_compare_data(client, "trend",
                           "analysis-procurement-F999-trend.json", patched_empty)
```

- [ ] **Step 2: Run trend tests**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestAnalysisProcurementTrendMode -v 2>&1 | tail -50
```

Expected: 2 PASS.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: procurement trend mode contract tests (2 tests)" -- tests/python/smartbi_compat/test_analysis_procurement_contract.py
```

---

## Task 17: Full pytest run + iterate on byte-shape diffs

**Files:** all touched files

- [ ] **Step 1: Run all 8 procurement tests**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py -v 2>&1 | tail -60
```

Expected: 8 PASS.

- [ ] **Step 2: Run baseline pytest to confirm no regressions**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/ -q --tb=no 2>&1 | tail -10
```

Expected: all previous tests still pass; only the 8 new tests are added.

- [ ] **Step 3: Investigate any FAIL**

If byte-shape FAILS, the diff dict in pytest.fail message shows exact key/value drift.
Common drifts (Rule 9 carry-over from inventory/department impls):
- `xAxisField` → `xaxisField` (lowercase 'a')
- ChartConfig missing `seriesField: None` field (must emit-all 7 fields)
- top-level `data.*` key order doesn't match HashMap hash-iter order
- MetricResult missing one of 11 fields
- RankingItem missing one of 6 fields

Fix each in the relevant sub-service helper. Re-run.

- [ ] **Step 4: Commit any byte-shape fixes**

```bash
git status --short
git commit -m "fix: procurement byte-shape parity with goldens" -- backend/python/smartbi_compat/api/analysis_procurement.py
```

---

## Task 18: Squash WIP commits + push

- [ ] **Step 1: Confirm branch state**

```bash
git log --oneline phase2a/procurement-impl..HEAD 2>&1 | head -20
git log origin/main..HEAD --oneline | head -20
```

- [ ] **Step 2: Interactive rebase to squash WIP commits into one**

```bash
git rebase -i origin/main
# In editor: keep first commit as 'pick', mark rest as 'squash' (or 'fixup' for already-good messages).
# Final commit message:
# "Phase 2A: /analysis/procurement per-type real impl (supplier + cost + trend) (PR-A)"
```

- [ ] **Step 3: Final pytest run after squash**

```bash
cd <repo-root> && pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py -v 2>&1 | tail -30
```

Expected: 8 PASS.

- [ ] **Step 4: Push branch**

```bash
git push -u origin phase2a/procurement-impl
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --base main --head phase2a/procurement-impl --title "Phase 2A: /analysis/procurement per-type real impl (supplier + cost + trend) (PR-A)" --body "$(cat <<'EOF'
## Summary
- Port Java `/analysis/procurement` 3 per-type modes (supplier / cost / trend) to Python with byte-shape parity vs Java backend.
- Default mode (overview DashboardResponse) is OUT OF SCOPE — Chat 5 ships PR-B; arithmetic depth tests are PR-C (Chat 1).
- New file `backend/python/smartbi_compat/api/analysis_procurement.py` (~520 LOC).
- 8 contract tests against 3 F999 goldens.

## What's in
- 3 SQL helpers (T3 ORDER BY id determinism, T11 supplier_id factory_id filter)
- 7 calculation/format helpers (total/avg/concentration/MoM/format_currency/minus_months/metric_result)
- 4 alert helpers (T1 inverse concentration boundary)
- 5 dimension scorers (rating × 20 default 70, quality availableCount/total, delivery hardcoded 85, service rating × 20 default 70, stability variance-CV default 80)
- 3 sub-services per mode + dispatcher

## Rules applied
- Rule 1 (None vs `or`): all batch null fields use explicit `is not None`
- Rule 4 (`_decimal_to_number` for Jackson parity)
- Rule 5+6 (SELECT * shared SQL helpers + None-check precondition)
- Rule 9.1 (`xaxisField` lowercase 'a' in ChartConfig)
- Rule 9.2 (ChartConfig 7-field emit-all, no `@JsonInclude`)
- Rule 9.3 (MetricResult 11-field, RankingItem 6-field via Lombok @Data)
- T1 inverse concentration threshold (60/40, strict `>`)
- T9 MoM growth `.abs()` denom + 3 edge cases

## Test plan
- [x] `pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py` — 8 PASS
- [x] `pytest tests/python/smartbi_compat/` baseline — all previous tests still pass
- [ ] F999 / F001 真窗 verify (manual two-step diff post-merge)

## Spec
docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md

## Out of scope
- PR-B (default mode = overview DashboardResponse) — Chat 5
- PR-C (arithmetic depth tests, ~33 tests) — Chat 1
- T11 Java-side RLS fix (deferred per spec §8)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Verify PR URL + CI status**

```bash
gh pr view --json url,state,statusCheckRollup -q '.url,.state'
```

---

## Self-review checklist (run by writer before handing off)

- [x] All 11 traps (T1-T11) addressed in tasks 5-12.
- [x] Rule 9 spec drift surfaced upfront (xaxisField lowercase, 7-field ChartConfig, 11-field MetricResult, 6-field RankingItem).
- [x] Auth symbol drift (`verify_factory_access` → `verify_jwt_and_factory`) noted upfront.
- [x] Spec §3.8 dimension scorer defaults (price 70, quality 0/empty, delivery 85, service 70, stability 80) — Task 1 reads Java exact, Task 8 implements actual values not spec values.
- [x] Goldens recorded BEFORE writing impl (Task 4) — used as truth for Task 9-12 dict literals + Task 12 dispatcher key order.
- [x] WIP commits use `safe-commit` pattern (`git commit -- <files>`) per concurrent-edit-safety §5b.
- [x] No PR-B / PR-C scope creep (default mode raises NotImplementedError).
- [x] Squash to single commit before push (Task 18).
- [x] PR description includes spec link + applied rules + scope-out list.

## Parallel work analysis

### Subagent: ❌ NOT recommended within plan
Tasks are sequential — each builds on prior helpers. Subagent dispatch per task is fine for review checkpoints, but tasks themselves cannot run in parallel within a single chat session.

### Multi-Chat: ✅ Independent of sister chats
- Creates ONLY new file `analysis_procurement.py` + new tests file + 3 new goldens
- Does NOT touch `analysis_finance.py` / `analysis_department.py` / `analysis_inventory.py` / `analysis_region.py`
- `main.py` edit is additive (2-line append), low conflict risk with sister chats
- Chat 5 (PR-B) and Chat 1 (PR-C) await this PR-A merge before they can start their work
