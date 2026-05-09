# Phase 2A `/analysis/inventory` PR-A0 + PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Java `/analysis/inventory` 3 modes (turnover / expiry / aging) to Python with byte-shape parity. Includes PR-A0 prereq (`_fetch_all` shared SQL helper landed in `analysis_finance.py`).

**Architecture:** New module `backend/python/smartbi_compat/api/analysis_inventory.py` (~750 LOC). 1 router + dispatcher + 9 sub-services + 6 SQL helpers + 4 named alert helpers + 4 inline alert sites + ~18 threshold/scale constants. Reuses existing `_strip_volatile`, `VOLATILE_KEYS`, `_decimal_to_number`, `_to_decimal`, `_utc_now_iso` from `analysis_finance.py`. PR-A0 adds `_fetch_all(sql, *args)` wrapper to `analysis_finance.py` (sister Tier 2 specs benefit).

**Tech Stack:** Python 3.8+ FastAPI + asyncpg + Decimal. Mirror Java `InventoryHealthAnalysisServiceImpl` (1352 LOC).

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md` (PR #47, merged main `b30d07686`)

**Out of scope (explicit):**
- PR-B (default mode `getInventoryHealth` DashboardResponse) — separate chat
- PR-C (arithmetic depth tests) — separate chat
- `analysis_finance.py` impl outside `_fetch_all` addition
- `analysis_department.py` (Chat 4 in flight)

**Concurrency note:** Sister Chat 2 (region) + Chat 4 (department) are in flight. We modify `main.py` (additive router register) which may trivial-conflict if sisters merge first. Use `./scripts/safe-commit.sh "msg" file1 file2` for every commit (no `--` separator).

**Spec bug fix in plan:** §3.7 line 839 references `verify_factory_access` (wrong symbol). Actual symbol per `auth.py` line 40 is `verify_jwt_and_factory`. Plan uses correct symbol throughout.

---

## ⛔ Hard rules

1. **Mock taxonomy A/B** (per spec §1.3): inventory is **Class B** (local hardcoded `getLossTrendChart` zeros). PR-A does NOT touch loss-trend (default mode only). No mock-defer.
2. **Rule 1** — `is not None` ternary, never Python `or` falsy fallback (Decimal trap)
3. **Rule 4** — `_decimal_to_number(value.quantize(...))` for every Decimal output
4. **Rule 5** — SQL helpers use `SELECT *`
5. **Rule 6** — new SQL helpers raise `ValueError` on None inputs (precondition assertion)
6. **Rule 7** — integer thresholds, `float()` cast OK
7. **Rule 8** — N/A (inventory has 0 `Map.of(N)` sites verified by grep). LinkedHashMap insertion-order trap (T-INV-5) covered via Python dict literal mirror.
8. **T-INV-12** — SQL ORDER BY truth: when Java has ORDER BY, mirror exact (NO secondary `id`). When Java has no ORDER BY, Python adds `ORDER BY id` for byte determinism.
9. **T-INV-13** — `_get_current_quantity()` mirrors `@Transient`: null receipt_quantity → ZERO; null used/reserved → 0 default. SQL `_query_inventory_value_total` mirrors SQL semantics (NULL propagates → row drops). Two paths intentionally differ; tests cover both.
10. **`date.today()`** — sub-services using `LocalDate.now()` map to Python `date.today()`. Tests `monkeypatch.setattr(analysis_inventory, "date", FrozenDate)` for determinism.

---

## File Structure

| File | Change | Sections |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_finance.py` | Modify (PR-A0) | Add `_fetch_all(sql, *args) -> list[dict]` after existing pool helpers (~line ~1395) |
| `backend/python/smartbi_compat/api/analysis_inventory.py` | Create | New file ~750 LOC: router + dispatcher + 9 sub-services + 6 SQL helpers + 4 named alert helpers + ~18 constants |
| `backend/python/main.py` | Modify | Register `analysis_inventory_router` after existing analysis routers |
| `tests/python/smartbi_compat/test_analysis_inventory_contract.py` | Create | 3 test classes (turnover / expiry / aging) with F999 byte-shape gates |
| `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json` | Create (record) | Via `./scripts/record-java-golden.sh` against test env Java backend |
| `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json` | Create (record) | Same |
| `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json` | Create (record) | Same |
| `docs/superpowers/plans/2026-05-01-phase2a-inventory-impl.md` | Create | This plan |

---

## Task 1: Pre-flight — Java line ref drift + golden script availability

**Files:** read-only.

- [ ] **Step 1: Verify Java line numbers in spec §3.1 still accurate**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
JAVA=backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java
echo "=== L89 getInventoryHealth ==="
grep -n "public DashboardResponse getInventoryHealth" "$JAVA"
echo "=== L141 getTurnoverAnalysis ==="
grep -n "public List<MetricResult> getTurnoverAnalysis" "$JAVA"
echo "=== L207 getTurnoverTrendChart ==="
grep -n "public ChartConfig getTurnoverTrendChart" "$JAVA"
echo "=== L255 getTurnoverByCategory ==="
grep -n "public List<RankingItem> getTurnoverByCategory" "$JAVA"
echo "=== L294 getExpiryRiskAnalysis ==="
grep -n "public List<MetricResult> getExpiryRiskAnalysis" "$JAVA"
echo "=== L375 getExpiringBatchesRanking ==="
grep -n "public List<RankingItem> getExpiringBatchesRanking" "$JAVA"
echo "=== L421 getExpiryRiskChart ==="
grep -n "public ChartConfig getExpiryRiskChart" "$JAVA"
echo "=== L660 getInventoryAgingChart ==="
grep -n "public ChartConfig getInventoryAgingChart" "$JAVA"
echo "=== L720 getAgingMetrics ==="
grep -n "public List<MetricResult> getAgingMetrics" "$JAVA"
echo "=== L774 getLongAgingBatchesRanking ==="
grep -n "public List<RankingItem> getLongAgingBatchesRanking" "$JAVA"
echo "=== L1058 calculateTotalInventoryValue ==="
grep -n "private BigDecimal calculateTotalInventoryValue" "$JAVA"
echo "=== controller L411 ==="
grep -n "public ResponseEntity.* getInventoryAnalysis" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java
```

Expected: each grep returns ONE match within ±10 lines of spec-cited line. If drift > ±10, document deltas inline in code blocks before impl.

- [ ] **Step 2: Verify golden recording script + test env Java health**

```bash
ls scripts/record-java-golden.sh && echo "OK"
curl -s --max-time 5 http://47.100.235.168:10011/api/mobile/health 2>&1 | head -3
```

Expected: script exists; test env Java responds. If test env down, **stop and ping user** (golden recording requires live Java endpoint).

No commit — verification only. Document drift findings (if any) for next tasks.

---

## Task 2: Record 3 F999 goldens (HARD prereq per spec §4.1)

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json`

⚠️ **Date-sensitive recording**: `getExpiryRiskAnalysis` + `getInventoryAgingChart` + `getAgingMetrics` + `getExpiringBatchesRanking` + `getLongAgingBatchesRanking` use `LocalDate.now()`. Goldens captured at recording time MUST be aligned with Python `monkeypatch.setattr(date)` in tests.

- [ ] **Step 1: Capture today's date for test fixture lock**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
echo "Recording date: $(date -u +%Y-%m-%d) UTC / $(TZ=Asia/Shanghai date +%Y-%m-%d) Beijing"
```

Save the Beijing date — needed for `monkeypatch_today` fixture in Task 14.

- [ ] **Step 2: Record F999-turnover golden**

```bash
./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31&analysisType=turnover" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json

# Verify shape
jq '.data | keys' tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json
```

Expected keys: `["endDate", "metrics", "ranking", "startDate", "trendChart"]` (Jackson alphabetic-ish; actual order is HashMap hash; dict-eq compare so order doesn't matter).

- [ ] **Step 3: Record F999-expiry golden**

```bash
./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31&analysisType=expiry" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json

jq '.data | keys' tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json
```

Expected keys: `["endDate", "expiringBatches", "riskAnalysis", "riskChart", "startDate"]`.

- [ ] **Step 4: Record F999-aging golden**

```bash
./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31&analysisType=aging" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json

jq '.data | keys' tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json
```

Expected keys: `["agingChart", "agingMetrics", "endDate", "longAgingBatches", "startDate"]`.

- [ ] **Step 5: Verify no goldens are HTTP error envelopes**

```bash
for f in tests/fixtures/java-smartbi-golden/analysis-inventory-F999-*.json; do
    success=$(jq -r '.response.success // .success' "$f")
    code=$(jq -r '.response.code // .code' "$f")
    echo "$f → success=$success code=$code"
done
```

All 3 must be `success=true code=200`. If any fail, **stop and ping user** (test env data issue).

- [ ] **Step 6: Commit goldens**

```bash
./scripts/safe-commit.sh "Phase 2A inventory: record 3 F999 goldens (turnover/expiry/aging)" \
    tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json \
    tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json \
    tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json
```

---

## Task 3: PR-A0 — add `_fetch_all` to `analysis_finance.py`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

Add canonical SQL fetch wrapper for sister Tier 2 specs (procurement / region / department / inventory) to import. Avoids inline `pool = await get_cretas_pool(); async with pool.acquire() ...` boilerplate × 6 helpers.

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^async def _query_finance_data\b" backend/python/smartbi_compat/api/analysis_finance.py
```

Insertion point: just BEFORE `_query_finance_data` (around line ~1320). Add `_fetch_all` first so all subsequent SQL helpers can use it.

- [ ] **Step 2: Add `_fetch_all` helper**

In `backend/python/smartbi_compat/api/analysis_finance.py`, find the section comment block that introduces SQL helpers (around line 1310-1320). Add this function BEFORE `_query_finance_payable_data` (or before `_query_finance_data`, whichever comes first in the file):

```python
async def _fetch_all(sql: str, *args) -> list[dict]:
    """Canonical SQL execution wrapper for shared sister-spec usage.

    Acquires cretas_pool connection, executes sql with positional args,
    returns list of dicts. Sister Tier 2 specs (inventory/region/procurement/
    department) import this for byte-shape SQL helpers.

    Pool acquisition mirrors existing _query_finance_data / _query_finance_payable_data
    pattern: `from smartbi.config import get_cretas_pool` lazy import (avoids
    circular dep at module load).

    Raises:
        Whatever asyncpg or pool acquisition raises — callers handle by
        returning [] for graceful empty.
    """
    from smartbi.config import get_cretas_pool  # type: ignore
    pool = await get_cretas_pool()
    if pool is None:
        logger.warning("[_fetch_all] pool is None; returning empty rows")
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [dict(r) for r in rows]
```

- [ ] **Step 3: Smoke test import**

```bash
cd backend/python && python -c "from smartbi_compat.api.analysis_finance import _fetch_all; print(_fetch_all.__doc__[:80])"
```

Expected: prints docstring snippet, no ImportError.

- [ ] **Step 4: Run finance regression sweep (verify no break)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py ../../tests/python/smartbi_compat/test_analysis_finance_contract.py -q 2>&1 | tail -5
```

Expected: ALL existing finance tests still pass (we only ADDED a function, didn't modify existing).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "PR-A0: add _fetch_all canonical SQL helper to analysis_finance.py" backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Task 4: Module skeleton + imports + 18 constants (§3.4)

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_inventory.py`

- [ ] **Step 1: Create file with imports + constants**

Create `backend/python/smartbi_compat/api/analysis_inventory.py`:

```python
"""Phase 2A `/analysis/inventory` per-type analysis port.

Mirror Java InventoryHealthAnalysisServiceImpl (1352 LOC). PR-A scope:
3 modes (turnover / expiry / aging); default mode (overview/DashboardResponse)
deferred to PR-B.

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
"""
from __future__ import annotations

import calendar as _cal
import logging
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _decimal_to_number,      # Rule 4 — FastAPI Decimal serialization parity
    _fetch_all,              # PR-A0 — canonical SQL wrapper
    _strip_volatile,         # already covers "lastUpdated" key
    _to_decimal,
    _utc_now_iso,
    VOLATILE_KEYS,
)
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
analysis_inventory_router = APIRouter()


# ============================================================
# Section 1: Constants + scale (T-INV-1 8 thresholds + 4 aging boundaries)
# Mirror Java InventoryHealthAnalysisServiceImpl L58-83.
# ============================================================

_SCALE             = Decimal("0.0001")
_DISPLAY_SCALE     = Decimal("0.01")
_QUANTIZE_HALF_UP  = ROUND_HALF_UP

# Turnover thresholds (regular dir, lower=worse) — Java L64/66
_TURNOVER_RED          = Decimal("6")
_TURNOVER_YELLOW       = Decimal("12")

# InventoryDays thresholds (INVERSE) — Java L1308/1311
_INVENTORY_DAYS_RED    = Decimal("60")
_INVENTORY_DAYS_YELLOW = Decimal("30")

# ExpiryRisk thresholds (INVERSE, strict `>`) — Java L68/70
_EXPIRY_RISK_RED       = Decimal("15")
_EXPIRY_RISK_YELLOW    = Decimal("10")

# LossRate thresholds (INVERSE, strict `>`) — Java L72/74. Used by PR-B.
_LOSS_RATE_RED         = Decimal("5")
_LOSS_RATE_YELLOW      = Decimal("2")

# Aging segment boundaries (days) — Java L77-79
_AGING_FRESH    = 30
_AGING_NORMAL   = 60
_AGING_WARNING  = 90

# Expiry warning days — Java L82-83
_DEFAULT_EXPIRY_WARNING_DAYS = 30
_HIGH_RISK_EXPIRY_DAYS       = 7

# Slow-moving inline thresholds (Java L747-751)
_SLOW_MOVING_RED_INLINE    = Decimal("20")
_SLOW_MOVING_YELLOW_INLINE = Decimal("10")

# Health score overall (Java L903-910) — used by PR-B
_HEALTH_SCORE_GREEN_MIN  = Decimal("80")
_HEALTH_SCORE_YELLOW_MIN = Decimal("60")

# Per-batch ranking inline thresholds — Java L398-404, L799-805
_EXPIRING_RANKING_RED_DAYS    = 7
_EXPIRING_RANKING_YELLOW_DAYS = 15
_LONG_AGING_RANKING_RED_DAYS    = 120
_LONG_AGING_RANKING_YELLOW_DAYS = 90
```

- [ ] **Step 2: Verify file imports clean**

```bash
cd backend/python && python -c "from smartbi_compat.api import analysis_inventory; print(analysis_inventory.__doc__[:60]); print('constants:', analysis_inventory._TURNOVER_RED, analysis_inventory._AGING_WARNING)"
```

Expected: no ImportError, prints `6 90`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory: module skeleton + imports + 18 threshold constants" backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 5: 6 SQL helpers (§3.3)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

T-INV-12 ORDER BY truth (per spec §3.3):
- Java has ORDER BY → mirror exact (NO secondary `id`)
- Java no ORDER BY → Python adds `ORDER BY id`
- Java `findExpiringBatches`: single col `expire_date ASC` (Java side bug — spec §7 Risk 3 deferred)

- [ ] **Step 1: Append SQL helpers**

In `analysis_inventory.py`, append after constants block:

```python
# ============================================================
# Section 2: SQL helpers (T-INV-12 ORDER BY truth + Rule 5 + Rule 6)
# ============================================================


async def _query_material_batches_by_status(
    factory_id: str, status: str = "AVAILABLE"
) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findByFactoryIdAndStatus (L146).
    JPA derived query, NO ORDER BY → Python adds ORDER BY id (T-INV-12)."""
    if factory_id is None:
        raise ValueError("_query_material_batches_by_status: factory_id required")
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status = $2
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, status)


async def _query_material_consumptions_in_range(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java MaterialConsumptionRepository.findByTimeRange (L40-44).
    NO ORDER BY in Java → Python adds ORDER BY id (T-INV-12).
    T-INV-7 atTime(23,59,59) — NOT 23:59:59.999999."""
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_material_consumptions_in_range: dates required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time(23, 59, 59))
    sql = """
        SELECT *
        FROM material_consumptions
        WHERE factory_id = $1
          AND consumption_time BETWEEN $2 AND $3
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, start_dt, end_dt)


async def _query_expiring_batches(
    factory_id: str, warning_date: date
) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findExpiringBatches (L173-177).
    YES ORDER BY expire_date ASC (single col, NO secondary id — Java side bug,
    deferred per spec §7 Risk 3).
    SQL CURRENT_DATE used (mirror Java) to avoid Python timezone drift."""
    if warning_date is None:
        raise ValueError("_query_expiring_batches: warning_date required")
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND expire_date BETWEEN CURRENT_DATE AND $2
          AND deleted_at IS NULL
        ORDER BY expire_date ASC
    """
    return await _fetch_all(sql, factory_id, warning_date)


async def _query_expired_batches(factory_id: str) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findExpiredBatches (L182-185).
    NO ORDER BY → Python adds ORDER BY id."""
    if factory_id is None:
        raise ValueError("_query_expired_batches: factory_id required")
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status != 'EXPIRED'
          AND expire_date < CURRENT_DATE
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id)


async def _query_inventory_value_total(factory_id: str) -> Decimal:
    """Mirror Java MaterialBatchRepository.calculateInventoryValue (L195-197).
    Scalar SUM. NULL aggregate → coalesce to Decimal('0').
    T-INV-13: SQL nulls in subtraction propagate → row drops. Mirrors Java SQL
    behavior (intentionally diverges from @Transient method)."""
    if factory_id is None:
        raise ValueError("_query_inventory_value_total: factory_id required")
    sql = """
        SELECT COALESCE(
            SUM((m.receipt_quantity - m.used_quantity - m.reserved_quantity) * m.unit_price),
            0
        ) AS inventory_value
        FROM material_batches m
        WHERE m.factory_id = $1
          AND m.status = 'AVAILABLE'
          AND m.deleted_at IS NULL
    """
    rows = await _fetch_all(sql, factory_id)
    if not rows or rows[0].get("inventory_value") is None:
        return Decimal("0")
    return _to_decimal(rows[0]["inventory_value"])


async def _query_batch_adjustments_in_range(
    batch_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java MaterialBatchAdjustmentRepository.findByMaterialBatchIdAnd
    AdjustmentTimeBetweenOrderByAdjustmentTimeDesc (L33).
    YES ORDER BY adjustment_time DESC (in derived name, mirror exact).
    NOT used by PR-A; PR-B `_calculate_loss_rate_for_health_score` uses it.
    Adding here so PR-B can import without round-trip."""
    if start_date is None or end_date is None:
        raise ValueError("_query_batch_adjustments_in_range: dates required")
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time(23, 59, 59))
    sql = """
        SELECT *
        FROM material_batch_adjustments
        WHERE material_batch_id = $1
          AND adjustment_time BETWEEN $2 AND $3
        ORDER BY adjustment_time DESC
    """
    return await _fetch_all(sql, batch_id, start_dt, end_dt)
```

- [ ] **Step 2: Smoke test import**

```bash
cd backend/python && python -c "
from smartbi_compat.api import analysis_inventory as ai
import asyncio
# Just verify functions exist and accept parameters (don't actually hit DB)
assert callable(ai._query_material_batches_by_status)
assert callable(ai._query_material_consumptions_in_range)
assert callable(ai._query_expiring_batches)
assert callable(ai._query_expired_batches)
assert callable(ai._query_inventory_value_total)
assert callable(ai._query_batch_adjustments_in_range)
# Verify Rule 6 None-check
try:
    asyncio.run(ai._query_material_batches_by_status(None))
except ValueError as e:
    assert 'factory_id required' in str(e)
print('OK')
"
```

Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory: 6 SQL helpers (T-INV-12 ORDER BY truth)" backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 6: 4 shared logic helpers (§3.5)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

- [ ] **Step 1: Append helpers**

```python
# ============================================================
# Section 3: Shared logic helpers
# ============================================================


def _get_current_quantity(batch: dict) -> Decimal:
    """Mirror Java MaterialBatch.getCurrentQuantity() @Transient (MaterialBatch.java:167-175).

    Formula: receiptQuantity - usedQuantity - reservedQuantity
    Null-safe (T-INV-13):
      - receiptQuantity null → return ZERO
      - usedQuantity null → 0 default
      - reservedQuantity null → 0 default

    NOTE: SQL path (_query_inventory_value_total) intentionally differs — NULL
    in subtraction propagates and drops the row. Two paths byte-parity each Java path.
    """
    rq = batch.get("receipt_quantity")
    if rq is None:
        return Decimal("0")
    used = batch.get("used_quantity")
    reserved = batch.get("reserved_quantity")
    used_dec = _to_decimal(used) if used is not None else Decimal("0")
    reserved_dec = _to_decimal(reserved) if reserved is not None else Decimal("0")
    return _to_decimal(rq) - used_dec - reserved_dec


def _calculate_total_inventory_value(batches: list[dict]) -> Decimal:
    """Mirror Java InventoryHealthAnalysisServiceImpl.calculateTotalInventoryValue (L1058-1063).

    sum(currentQuantity * unitPrice) over batches; null unit_price → 0.
    Rule 1: explicit is-None check.
    """
    total = Decimal("0")
    for b in batches:
        cq = _get_current_quantity(b)
        up = b.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        total += cq * up_dec
    return total


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java formatCurrency (L1346-1351).
    null → "-"; else → "%,.2f" formatted (1234.56 → "1,234.56")."""
    if value is None:
        return "-"
    quantized = value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return f"{float(quantized):,.2f}"


def _convert_to_kpi_cards(metric_results: list[dict]) -> list[dict]:
    """Mirror Java convertToKPICards (L1241-1287).
    Used by PR-B (default mode); add here so PR-B import is clean."""
    cards = []
    for metric in metric_results:
        alert = metric.get("alertLevel")
        status = "red" if alert == "RED" else "yellow" if alert == "YELLOW" else "green"

        direction = metric.get("changeDirection")
        trend = "up" if direction == "UP" else "down" if direction == "DOWN" else "flat"

        formatted = metric.get("formattedValue")
        raw_value = metric.get("value")
        if formatted is not None:
            display_value = formatted
        elif raw_value is not None:
            display_value = str(raw_value)
        else:
            display_value = "-"

        cards.append({
            "key":         metric.get("metricCode"),
            "title":       metric.get("metricName"),
            "rawValue":    raw_value,
            "value":       display_value,
            "unit":        metric.get("unit"),
            "changeRate":  metric.get("changePercent"),
            "change":      metric.get("changeValue"),
            "trend":       trend,
            "status":      status,
            "description": metric.get("description"),
        })
    return cards


# ============================================================
# Section 3b: Date arithmetic helpers
# ============================================================


def _plus_months(d: date, n: int) -> date:
    """Mirror Java LocalDate.plusMonths(n) — calendar-month with end-of-month clamp."""
    year = d.year
    month = d.month + n
    while month > 12:
        year += 1
        month -= 12
    while month < 1:
        year -= 1
        month += 12
    last_day = _cal.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def _one_day() -> timedelta:
    return timedelta(days=1)


def _days(n: int) -> timedelta:
    return timedelta(days=n)


def _metric_result_of(code: str, name: str, value: Decimal, unit: str) -> dict:
    """Mirror Java MetricResult.of(code, name, value, unit) static factory.
    @Builder default emits null for unset fields."""
    return {
        "metricCode":      code,
        "metricName":      name,
        "value":           _decimal_to_number(value),
        "formattedValue":  None,
        "unit":            unit,
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      None,
        "description":     None,
    }
```

- [ ] **Step 2: Smoke test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _get_current_quantity, _calculate_total_inventory_value, _format_currency,
    _plus_months, _days, _metric_result_of,
)
from decimal import Decimal
from datetime import date

# T-INV-13: null receipt_quantity → 0
assert _get_current_quantity({'receipt_quantity': None, 'used_quantity': '5', 'reserved_quantity': '2'}) == Decimal('0')
# null used → 0 default
assert _get_current_quantity({'receipt_quantity': '10', 'used_quantity': None, 'reserved_quantity': '2'}) == Decimal('8')
# All set
assert _get_current_quantity({'receipt_quantity': '10', 'used_quantity': '3', 'reserved_quantity': '2'}) == Decimal('5')

# Currency format
assert _format_currency(Decimal('1234.567')) == '1,234.57'
assert _format_currency(None) == '-'

# plus_months end-of-month clamp
assert _plus_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
assert _plus_months(date(2024, 1, 31), 1) == date(2024, 2, 29)  # leap

# metric_result_of envelope
m = _metric_result_of('FOO', '名', Decimal('100'), '元')
assert set(m.keys()) == {'metricCode','metricName','value','formattedValue','unit','dimensionValue','changeValue','changePercent','changeDirection','alertLevel','description'}
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory: 4 shared logic helpers + date arithmetic" backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 7: 4 named alert helpers (§3.6)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

- [ ] **Step 1: Append**

```python
# ============================================================
# Section 4: 4 named alert-level helpers (4 inline alert decisions stay inline)
# ============================================================


def _determine_turnover_alert_level(turnover_rate: Decimal) -> str:
    """Mirror Java determineTurnoverAlertLevel (L1294-1302).
    Regular dir (lower=worse): RED < 6, YELLOW < 12, GREEN."""
    if turnover_rate < _TURNOVER_RED:
        return "RED"
    if turnover_rate < _TURNOVER_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_inventory_days_alert_level(inventory_days: Decimal) -> str:
    """Mirror Java determineInventoryDaysAlertLevel (L1307-1315).
    INVERSE: RED > 60, YELLOW > 30, GREEN."""
    if inventory_days > _INVENTORY_DAYS_RED:
        return "RED"
    if inventory_days > _INVENTORY_DAYS_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_expiry_risk_alert_level(expiry_risk_rate: Decimal) -> str:
    """Mirror Java determineExpiryRiskAlertLevel (L1320-1328).
    INVERSE strict `>`: RED > 15, YELLOW > 10, GREEN. Boundary 15.0 → YELLOW."""
    if expiry_risk_rate > _EXPIRY_RISK_RED:
        return "RED"
    if expiry_risk_rate > _EXPIRY_RISK_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_loss_rate_alert_level(loss_rate: Decimal) -> str:
    """Mirror Java determineLossRateAlertLevel (L1333-1341).
    INVERSE strict `>`: RED > 5, YELLOW > 2, GREEN. Used by PR-B health score path."""
    if loss_rate > _LOSS_RATE_RED:
        return "RED"
    if loss_rate > _LOSS_RATE_YELLOW:
        return "YELLOW"
    return "GREEN"
```

- [ ] **Step 2: Smoke test boundaries**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _determine_turnover_alert_level,
    _determine_inventory_days_alert_level,
    _determine_expiry_risk_alert_level,
    _determine_loss_rate_alert_level,
)
from decimal import Decimal

# Turnover regular dir (lower=worse)
assert _determine_turnover_alert_level(Decimal('5')) == 'RED'
assert _determine_turnover_alert_level(Decimal('6')) == 'YELLOW'  # not < 6
assert _determine_turnover_alert_level(Decimal('11')) == 'YELLOW'
assert _determine_turnover_alert_level(Decimal('12')) == 'GREEN'  # not < 12

# InventoryDays inverse (>30/>60)
assert _determine_inventory_days_alert_level(Decimal('30')) == 'GREEN'  # not > 30
assert _determine_inventory_days_alert_level(Decimal('31')) == 'YELLOW'
assert _determine_inventory_days_alert_level(Decimal('60')) == 'YELLOW'  # not > 60
assert _determine_inventory_days_alert_level(Decimal('61')) == 'RED'

# ExpiryRisk inverse strict (>10/>15)
assert _determine_expiry_risk_alert_level(Decimal('10')) == 'GREEN'
assert _determine_expiry_risk_alert_level(Decimal('15')) == 'YELLOW'  # boundary
assert _determine_expiry_risk_alert_level(Decimal('15.01')) == 'RED'

# LossRate inverse strict (>2/>5)
assert _determine_loss_rate_alert_level(Decimal('2')) == 'GREEN'
assert _determine_loss_rate_alert_level(Decimal('5')) == 'YELLOW'
assert _determine_loss_rate_alert_level(Decimal('5.01')) == 'RED'

print('OK')
"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory: 4 named alert-level helpers" backend/python/smartbi_compat/api/analysis_inventory.py
```

---
