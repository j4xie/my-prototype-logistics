# Phase 2A `/analysis/inventory` per-type PR-A0 + PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port Java `/api/mobile/{factoryId}/smart-bi/analysis/inventory` 3 per-type modes (turnover/expiry/aging) to Python with byte-shape parity. Default mode + PR-C depth tests are out-of-scope (deferred to follow-up chats per spec §6).

**Architecture:** New file `backend/python/smartbi_compat/api/analysis_inventory.py` with 9 sub-services + 6 SQL helpers + 4 named alert helpers + 4 inline alert sites + 12 module constants. Dispatcher returns 501 envelope for default mode (PR-B will replace). Combined PR-A0 + PR-A in one PR for efficiency.

**Tech Stack:** Python 3.8+ (FastAPI, asyncpg, Decimal HALF_UP), pytest + pytest-asyncio, monkeypatch.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md` (PR #47, merged main `b30d07686`). 2721 lines. Full audit cycle locked 15 traps T-INV-1 to T-INV-15.

**Goldens (HARD prereq):** Per spec §4.1 — 4 goldens MUST be recorded before contract tests. Recording requires SSH to test env (`47.100.235.168:10011`) + JWT_SECRET from `/www/wwwroot/cretas/.env.test`.

**Concurrency note:** Sister chats: Chat 2 (region #41), Chat 4 (department #36), possibly Chat 5 (procurement #40). All edit DIFFERENT files (`analysis_region.py` / `analysis_department.py` / `analysis_procurement.py`). My only shared touch is `backend/python/main.py` route registration (additive, no conflict). Use `./scripts/safe-commit.sh` for every commit.

---

## ⛔ Hard rules (per spec)

1. **PR-A0 `_fetch_all` MUST land first** in `analysis_finance.py` — sister specs (procurement #40, department #36) depend on it. Spec §3.2 line 346-377 documents this prereq.
2. **15 T-INV-* traps** must be respected (spec §2.2 + §7). Critical:
   - T-INV-8: `getLossTrendChart` mock-zero literal mirror — but **NOT in PR-A scope** (default-mode-only call path)
   - T-INV-9: Asymmetric null verbatim mirror — **NOT in PR-A scope** (PR-B `_get_health_score`)
   - T-INV-12: SQL ORDER BY truth — Java has ORDER BY → 1:1 mirror; Java has none → Python adds `ORDER BY id`
   - T-INV-13: `getCurrentQuantity()` @Transient inline formula
3. **6 SQL helpers** explicit ORDER BY truth (spec §3.3 line 378-580)
4. **No `Map.of(N)` Rule 8 risk** (verified 0 hits) — but **16 LinkedHashMap insertion-order sites** (T-INV-5) must mirror Java order
5. **`MetricCalculatorService` Java side dead-code** — Python does NOT import `_calculate_mom_growth`
6. **`date.today()` determinism** — tests `monkeypatch.setattr` `analysis_inventory.date` to fixed date matching golden record date
7. **`_to_thread` shim** for Python 3.8 compatibility (server venv38) — already pattern in sister files
8. **F999 seed invariant**: All AVAILABLE batches must have unique `expire_date` (spec §4.1 Cycle 4 MAJOR 6) — record-time sanity check; if violated, recording will produce non-deterministic goldens
9. **NO impl changes to sister files** (`analysis_finance.py` ONLY for PR-A0 `_fetch_all` add; `analysis_department.py` etc untouched)
10. **NO PR-B / PR-C** — default mode + arithmetic depth tests deferred to follow-up chats

---

## File Structure

| File | Change | Sections |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_finance.py` | Modify (PR-A0) | Add `async def _fetch_all(sql, *args) -> list[dict]` shared helper (~10 lines) |
| `backend/python/smartbi_compat/api/analysis_inventory.py` | **CREATE** | New file ~750 LOC: imports + router + 6 SQL helpers + 12 constants + 4 shared logic helpers + 4 alert helpers + dispatcher + 9 sub-services |
| `backend/python/main.py` | Modify | Register `analysis_inventory.router` |
| `tests/python/smartbi_compat/test_analysis_inventory_contract.py` | **CREATE** | New file ~400 LOC: 4 contract test classes (3 modes byte-shape + 1 default-501) |
| `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-{turnover,expiry,aging}.json` | **CREATE** (record live) | 3 per-mode goldens |
| `docs/superpowers/plans/2026-05-01-phase2a-analysis-inventory-pr-a.md` | Create | This plan |

---

## Task 1: Record 4 goldens (HARD prereq — HALT if blocked)

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json`
- (Optional smoke) Re-record: `analysis-inventory-F999-default.json` (already exists; PR-A dispatcher returns 501 for default → only used for shape sanity comparison, not byte-shape gate)

⚠️ **Recording date is locked into golden output** — capture `date.today()` value used; tests `monkeypatch.setattr` to that date.

- [ ] **Step 1: Verify test env Java backend is up**

```bash
curl -sS http://47.100.235.168:10011/actuator/health 2>&1 | head -3
```
Expected: `{"status":"UP"}` or similar. If connection refused / timeout → test env down. STOP and ping user.

- [ ] **Step 2: Obtain JWT_SECRET**

```bash
ssh root@47.100.235.168 "grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.test | head -1"
```
Expected: `JWT_SECRET=<long string>`. If SSH fails → ping user for `JWT_SECRET` value via secure channel.

- [ ] **Step 3: Record turnover golden**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
JWT_SECRET=<value from Step 2> ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/inventory?startDate=2025-01-01&endDate=2025-01-31&analysisType=turnover' \
    analysis-inventory-F999-turnover.json
```
Expected: `OK. Top of file:` followed by JSON dump showing `data.metrics`, `data.ranking`, `data.trendChart`. Verify `data.metrics` has 4 entries (TURNOVER_RATE / INVENTORY_DAYS / CONSUMPTION_AMOUNT / INVENTORY_VALUE).

- [ ] **Step 4: Record expiry golden**

```bash
JWT_SECRET=<value> ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/inventory?startDate=2025-01-01&endDate=2025-01-31&analysisType=expiry' \
    analysis-inventory-F999-expiry.json
```
Expected: `data.riskAnalysis` (5 metrics), `data.expiringBatches` (≤20 ranking), `data.riskChart` (5-bucket PIE).

- [ ] **Step 5: Record aging golden**

```bash
JWT_SECRET=<value> ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/inventory?startDate=2025-01-01&endDate=2025-01-31&analysisType=aging' \
    analysis-inventory-F999-aging.json
```
Expected: `data.agingMetrics` (3 metrics), `data.agingChart` (4-bucket BAR), `data.longAgingBatches` (≤20 ranking with inline alerts).

- [ ] **Step 6: Verify F999 seed invariant for expiry**

```bash
python -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json'))
batches = g['response']['data']['expiringBatches']
expire_dates = [b.get('expireDate') for b in batches]
print(f'expiringBatches count: {len(batches)}')
print(f'unique expire_dates: {len(set(expire_dates))}')
assert len(set(expire_dates)) == len(expire_dates), 'F999 seed invariant violated — duplicate expire_dates'
print('OK: F999 expire_date uniqueness verified')
"
```
Expected: `OK: F999 expire_date uniqueness verified`. If FAIL → ping user (seed needs adjusting per spec §4.1 Cycle 4 MAJOR 6 fix).

- [ ] **Step 7: Capture recording date**

The Java backend's `LocalDate.now()` value baked into goldens. Capture it for test mocks:

```bash
# Pull the timestamp from the response envelope
python -c "
import json
for mode in ['turnover','expiry','aging']:
    g = json.load(open(f'tests/fixtures/java-smartbi-golden/analysis-inventory-F999-{mode}.json'))
    ts = g['response'].get('timestamp', 'N/A')
    print(f'{mode}: timestamp = {ts}')
"
```
Note the date portion (e.g., `2026-05-01`). This will be the `monkeypatch` target date in contract tests.

- [ ] **Step 8: Commit goldens**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory PR-A: record 3 per-mode F999 goldens" \
    tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json \
    tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json \
    tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json
```

If any step 1-6 fails → STOP and ping user. Do NOT proceed to impl tasks without goldens.

---

## Task 2: PR-A0 — Add `_fetch_all` shared helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add `_fetch_all` helper near other DB helpers)

This helper is used by sister specs (procurement, department, region) and must land first. ~10 LOC addition, no test required (impl validation through inventory's SQL helpers in Task 4).

- [ ] **Step 1: Find insertion point**

```bash
grep -n "^async def _query_finance_payable_data\|^async def _query_finance_data" backend/python/smartbi_compat/api/analysis_finance.py
```
Expected: `_query_finance_payable_data` at line ~1349 and `_query_finance_data` at line ~1225. Insert `_fetch_all` IMMEDIATELY BEFORE `_query_finance_data` so all SQL helpers can use it.

- [ ] **Step 2: Add helper**

In `backend/python/smartbi_compat/api/analysis_finance.py`, find the line `async def _query_finance_data(` (or `_query_finance_payable_data` — whichever comes first). Add IMMEDIATELY BEFORE it:

```python
async def _fetch_all(sql: str, *args) -> list[dict]:
    """Canonical SQL fetch wrapper. Runs `conn.fetch(sql, *args)` against the cretas
    pool and converts asyncpg Records to dict.

    Sister specs (procurement #40, department #36, inventory #47) reference this
    helper. Lands here as PR-A0 prereq — the smartbi_compat shared util location
    so all per-type modules import via:
        from smartbi_compat.api.analysis_finance import _fetch_all

    Pool acquisition mirrors `_query_finance_data` pattern (cretas_db pool from
    smartbi.config.get_cretas_pool — RLS via SQL `factory_id` filter, no GUC needed).
    """
    pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning("[_fetch_all] pool acquisition failed: %s", e)
        return []
    if pool is None:
        logger.warning("[_fetch_all] pool is None; returning empty rows")
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [dict(r) for r in rows]
```

- [ ] **Step 3: Smoke verify import**

```bash
cd backend/python && python -c "from smartbi_compat.api.analysis_finance import _fetch_all; print(_fetch_all)"
```
Expected: `<function _fetch_all at 0x...>`. If `ImportError` → check syntax / indentation.

- [ ] **Step 4: Run existing smartbi_compat test suite (regression check)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```
Expected: 502 passed (post payable PR-B baseline), 1 skipped, 0 failed. If any test fails → revert and investigate.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory PR-A0: add _fetch_all shared SQL helper" backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Task 3: New file `analysis_inventory.py` skeleton + main.py registration

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_inventory.py` (skeleton)
- Modify: `backend/python/main.py` (register router)

- [ ] **Step 1: Create skeleton file**

`backend/python/smartbi_compat/api/analysis_inventory.py`:

```python
"""Phase 2A /analysis/inventory per-type endpoint port.

Implements 3 modes (turnover / expiry / aging). Default mode (`getInventoryHealth`)
returns 501 envelope in PR-A; PR-B will replace with real DashboardResponse.

Java reference:
  - Controller: SmartBIAnalysisController.getInventoryAnalysis line 411-448
  - Service: InventoryHealthAnalysisServiceImpl line 50-1352 (1352 LOC)

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
PR-A0 dependency: _fetch_all helper in analysis_finance.py (PR #47 follow-up).

Out of scope (PR-B/PR-C):
  - getInventoryHealth (default mode, DashboardResponse)
  - getHealthScore (T-INV-9 asymmetric null)
  - getLossTrendChart (T-INV-8 mock-zero literal mirror)
  - getHealthRadarChart, getLossAnalysis, getLossReasonChart (not controller-dispatched)
  - PR-C arithmetic depth tests
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _strip_volatile,
    VOLATILE_KEYS,
    _decimal_to_number,
    _to_decimal,
    _utc_now_iso,
    _fetch_all,  # PR-A0 dependency (Task 2)
)
from smartbi_compat.schema_compat import wrap_response
from smartbi_compat.auth import verify_jwt_and_factory, AuthContext

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Section 1: Constants + scale (T-INV-1 8 thresholds + 4 aging boundaries)
# (Filled in Task 5)
# ============================================================


# ============================================================
# Section 2: SQL helpers (T-INV-12 ORDER BY truth, Rule 5 + Rule 6)
# (Filled in Task 4)
# ============================================================


# ============================================================
# Section 3: Shared logic helpers
# (Filled in Task 6)
# ============================================================


# ============================================================
# Section 4: Alert-level helpers (4 named, T-INV-1 thresholds)
# (Filled in Task 7)
# ============================================================


# ============================================================
# Section 5: Mode dispatcher + 9 sub-services (PR-A scope)
# (Filled in Tasks 8-11)
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/inventory")
async def get_inventory_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    analysisType: Optional[str] = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java SmartBIAnalysisController.getInventoryAnalysis line 411-448.

    Branches:
      analysisType=turnover  → turnover per-type (5-key envelope, PR-A)
      analysisType=expiry    → expiry per-type (5-key envelope, PR-A)
      analysisType=aging     → aging per-type (5-key envelope, PR-A)
      analysisType empty     → default getInventoryHealth (501 in PR-A; PR-B real impl)
      analysisType=other     → 501 envelope (un-ported)
    """
    # Filled in Task 8 — for now, return 501 fallback for everything
    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python (skeleton only, PR-A 进行中)",
    )
```

- [ ] **Step 2: Register router in `main.py`**

```bash
grep -n "include_router\|analysis_finance" backend/python/main.py | head -10
```
Locate the existing `include_router` block. Add a new line for inventory after the analysis_finance/analysis_sales router registrations:

```python
# Phase 2A — /analysis/inventory per-type port (3 modes: turnover/expiry/aging)
from smartbi_compat.api import analysis_inventory  # noqa: E402
app.include_router(analysis_inventory.router)
```

If a different pattern is used (e.g., grouped imports at top), follow that pattern.

- [ ] **Step 3: Smoke test — server starts + route registered**

```bash
cd backend/python && python -c "
from main import app
routes = [r.path for r in app.routes if hasattr(r, 'path')]
inventory_routes = [r for r in routes if '/analysis/inventory' in r]
print(f'Inventory routes registered: {inventory_routes}')
assert any('/analysis/inventory' in r for r in routes), 'inventory route NOT registered'
print('OK: skeleton + route registered')
"
```
Expected: `OK: skeleton + route registered`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory PR-A: skeleton + router registration" \
    backend/python/smartbi_compat/api/analysis_inventory.py \
    backend/python/main.py
```

---

## Task 4: 6 SQL helpers (per spec §3.3 line 378-580)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` Section 2 placeholder

Read spec section §3.3 (line 378-580 of `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md`) and copy the 6 helper definitions verbatim:

1. `_query_material_batches_by_status(factory_id, status="AVAILABLE")` — line 393-418
2. `_query_material_consumptions_in_range(factory_id, start_date, end_date)` — line 421-449 (T-INV-7 atTime trap)
3. `_query_expiring_batches(factory_id, warning_date)` — line 452-478 (single-col ORDER BY)
4. `_query_expired_batches(factory_id)` — line 481-499
5. `_query_inventory_value_total(factory_id) -> Decimal` — line 502-542 (scalar SUM, NULL coalesce)
6. `_query_batch_adjustments_in_range(batch_id, start_date, end_date)` — line 545-579 (PR-B-only call site, but include for completeness so PR-B doesn't add)

⚠️ **T-INV-12 ORDER BY rules** (per spec §3.3 line 378-391):
- Java has ORDER BY → Python mirrors EXACT (NO secondary `id` tiebreaker)
- Java no ORDER BY → Python adds `ORDER BY id`

⚠️ **T-INV-13 SQL `_query_inventory_value_total`** uses different null-handling than `_get_current_quantity()` @Transient (spec §3.3 line 511-527 + §7 Risk 5). Spec locks this divergence.

⚠️ **Rule 5/6**: All helpers `SELECT *` + explicit None-check at boundaries.

- [ ] **Step 1: Read spec §3.3 carefully**

```bash
sed -n '378,580p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```
Read the full section. Pay attention to:
- Comment blocks above each helper (capture them — they document the trap rationale)
- T-INV-7 atTime semantics (`time(23, 59, 59)` NOT `time(23, 59, 59, 999999)`)
- `_query_inventory_value_total` returns `Decimal` (NOT list)

- [ ] **Step 2: Append 6 helpers to Section 2 of `analysis_inventory.py`**

Copy the 6 helper definitions verbatim from spec §3.3. Section 2 placeholder header is at line ~50-55 of the skeleton from Task 3.

- [ ] **Step 3: Smoke test — imports + signatures**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _query_material_batches_by_status,
    _query_material_consumptions_in_range,
    _query_expiring_batches,
    _query_expired_batches,
    _query_inventory_value_total,
    _query_batch_adjustments_in_range,
)
print('OK: 6 SQL helpers importable')
"
```

- [ ] **Step 4: Run existing test suite (regression)**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```
Expected: still 502 passed (no new tests yet, no regression).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory PR-A: 6 SQL helpers (T-INV-12 ORDER BY truth)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 5: Constants + scale block (per spec §3.4)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` Section 1 placeholder

Read spec §3.4 (line 582-641) and copy constants block. 12 module constants total: 8 thresholds (T-INV-1) + 3 aging boundaries + 1 default expiry warning + scale/rounding constants.

- [ ] **Step 1: Read spec §3.4**

```bash
sed -n '582,641p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

- [ ] **Step 2: Append constants to Section 1 of `analysis_inventory.py`**

Copy verbatim from spec. Constants include:
- `_TURNOVER_RED = Decimal("6")` / `_TURNOVER_YELLOW = Decimal("12")` (regular direction)
- `_INVENTORY_DAYS_RED = Decimal("60")` / `_INVENTORY_DAYS_YELLOW = Decimal("30")` (INVERSE direction)
- `_EXPIRY_RISK_RED = Decimal("15")` / `_EXPIRY_RISK_YELLOW = Decimal("10")` (INVERSE, strict `>`)
- `_LOSS_RATE_RED = Decimal("5")` / `_LOSS_RATE_YELLOW = Decimal("2")` (INVERSE, strict `>`) — used by PR-B health score, but constants land here in PR-A
- `_AGING_FRESH = 30` / `_AGING_NORMAL = 60` / `_AGING_WARNING = 90` (aging boundaries)
- `_DEFAULT_EXPIRY_WARNING_DAYS = 30` / `_HIGH_RISK_EXPIRY_DAYS = 7`
- `_SCALE = 4` / `_DISPLAY_SCALE = 2` / `_QUANTIZE_HALF_UP = ROUND_HALF_UP`

⚠️ **Cycle 4 MAJOR 4 — threshold UNIT scale notes** (spec §3.4 line 593-600): Easy to confuse rate-scale (raw number) with percentage-scale (already × 100). Document inline.

- [ ] **Step 3: Smoke test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _TURNOVER_RED, _INVENTORY_DAYS_RED, _EXPIRY_RISK_RED, _LOSS_RATE_RED,
    _AGING_FRESH, _AGING_NORMAL, _AGING_WARNING,
)
from decimal import Decimal
assert _TURNOVER_RED == Decimal('6')
assert _AGING_FRESH == 30
print('OK: constants imported with correct values')
"
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: 12 constants + scale block (T-INV-1)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 6: 4 shared logic helpers (per spec §3.5)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` Section 3 placeholder

Read spec §3.5 (line 642-760) and copy 4 helpers:

1. `_get_current_quantity(batch: dict) -> Decimal` — T-INV-13 @Transient formula, null-safe
2. `_calculate_total_inventory_value(batches: list[dict]) -> Decimal` — sum getCurrentQuantity * unitPrice
3. `_format_currency(value: Optional[Decimal]) -> str` — `"%,.2f"` no trailing %
4. `_convert_to_kpi_cards(metric_results: list[dict]) -> list[dict]` — MetricResult → KPICard mapping

⚠️ **T-INV-13** (`_get_current_quantity`): null usedQuantity/reservedQuantity → 0 default; null receiptQuantity → entire return `Decimal("0")`. Verbatim mirror of `MaterialBatch.java:167-175`.

- [ ] **Step 1: Read spec §3.5**

```bash
sed -n '642,760p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

- [ ] **Step 2: Append helpers to Section 3**

- [ ] **Step 3: Smoke test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _get_current_quantity, _calculate_total_inventory_value,
    _format_currency, _convert_to_kpi_cards,
)
from decimal import Decimal
# T-INV-13: receiptQty=10, used=3, reserved=2 → 5
batch = {'receipt_quantity': '10', 'used_quantity': '3', 'reserved_quantity': '2'}
assert _get_current_quantity(batch) == Decimal('5'), f'got {_get_current_quantity(batch)}'
# null receiptQty → 0
batch_null = {'receipt_quantity': None, 'used_quantity': '3', 'reserved_quantity': '2'}
assert _get_current_quantity(batch_null) == Decimal('0')
# format currency
assert _format_currency(Decimal('1234.56')) == '1,234.56'
print('OK: helpers behave per T-INV-13')
"
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: 4 shared logic helpers (T-INV-13 @Transient)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 7: 4 alert helpers (per spec §3.6 line 761-826)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` Section 4 placeholder

Read spec §3.6 (line 761-826) for the 4 named alert helpers. Note the **direction** semantics — turnover is regular (high=GREEN), the other 3 are INVERSE (high=RED).

1. `_determine_turnover_alert_level(turnover_rate)` — `<6 RED, <12 YELLOW, else GREEN` (REGULAR — strict `<`)
2. `_determine_inventory_days_alert_level(inventory_days)` — `>60 RED, >30 YELLOW, else GREEN` (INVERSE — strict `>`)
3. `_determine_expiry_risk_alert_level(expiry_risk_rate)` — `>15 RED, >10 YELLOW, else GREEN` (INVERSE, strict `>`)
4. `_determine_loss_rate_alert_level(loss_rate)` — `>5 RED, >2 YELLOW, else GREEN` (INVERSE, strict `>`) — used by PR-B health score path; lands here for shared util reuse

⚠️ **Strict comparison** — boundary value falls into LOWER alertLevel.

- [ ] **Step 1: Read spec §3.6**

```bash
sed -n '761,826p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

- [ ] **Step 2: Append helpers to Section 4**

- [ ] **Step 3: Smoke test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _determine_turnover_alert_level,
    _determine_inventory_days_alert_level,
    _determine_expiry_risk_alert_level,
    _determine_loss_rate_alert_level,
)
from decimal import Decimal
# Turnover: <6 RED, <12 YELLOW, else GREEN
assert _determine_turnover_alert_level(Decimal('5.99')) == 'RED'
assert _determine_turnover_alert_level(Decimal('6')) == 'YELLOW'  # boundary 6: NOT < 6
assert _determine_turnover_alert_level(Decimal('12')) == 'GREEN'  # boundary 12: NOT < 12
# InventoryDays: >60 RED, >30 YELLOW, else GREEN (INVERSE)
assert _determine_inventory_days_alert_level(Decimal('60')) == 'YELLOW'  # boundary 60: NOT > 60
assert _determine_inventory_days_alert_level(Decimal('60.01')) == 'RED'
print('OK: 4 alert helpers boundary-correct')
"
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: 4 named alert helpers (T-INV-1 8 thresholds)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 8: Dispatcher + 501 default fallback

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` route handler at end

Update the dispatcher to route 3 modes (will be wired in Tasks 9-11). For now keep the 501 fallback for default mode + unknown.

- [ ] **Step 1: Update dispatcher**

Replace the existing skeleton dispatcher body with:

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/inventory")
async def get_inventory_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    analysisType: Optional[str] = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java SmartBIAnalysisController.getInventoryAnalysis line 411-448.

    Branches:
      analysisType=turnover  → turnover per-type (5-key envelope, PR-A)
      analysisType=expiry    → expiry per-type (5-key envelope, PR-A)
      analysisType=aging     → aging per-type (5-key envelope, PR-A)
      analysisType empty     → default getInventoryHealth (501 in PR-A; PR-B real impl)
      analysisType=other     → 501 envelope (un-ported)
    """
    if analysisType == "turnover":
        result = await _get_turnover_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if analysisType == "expiry":
        result = await _get_expiry_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if analysisType == "aging":
        result = await _get_aging_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType or '(default getInventoryHealth)'} 尚未 port 至 Python，请暂用 Java endpoint 或等待 PR-B",
    )


async def _get_turnover_mode(factory_id: str, start_date: date, end_date: date) -> dict:
    """Turnover mode entry — wired in Task 9."""
    # Forward decl — populated by Task 9
    raise NotImplementedError("turnover mode wired in Task 9")


async def _get_expiry_mode(factory_id: str, start_date: date, end_date: date) -> dict:
    """Expiry mode entry — wired in Task 10."""
    raise NotImplementedError("expiry mode wired in Task 10")


async def _get_aging_mode(factory_id: str, start_date: date, end_date: date) -> dict:
    """Aging mode entry — wired in Task 11."""
    raise NotImplementedError("aging mode wired in Task 11")
```

- [ ] **Step 2: Smoke test — 501 still works**

```bash
cd backend/python && python -c "
from main import app
from fastapi.testclient import TestClient
import jwt, os, time
os.environ['JWT_SECRET'] = 'test-secret'
client = TestClient(app)
token = jwt.encode({'userId':1,'username':'t','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, 'test-secret', algorithm='HS256')
resp = client.get('/api/mobile/F999/smart-bi/analysis/inventory?startDate=2025-01-01&endDate=2025-01-31', headers={'Authorization': f'Bearer {token}'})
print(f'status={resp.status_code} body={resp.json()}')
assert resp.status_code == 200
assert resp.json()['code'] == 501
print('OK: dispatcher 501 fallback works')
"
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: dispatcher + 3 mode forward decls + 501 default" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 9: Turnover mode (3 sub-services + main entry)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` (replace `_get_turnover_mode` NotImplementedError)

Read spec §3.7.1 + §3.7.2 + §3.7.3 (line 827-1180 approx).

Sub-services:
1. `_get_turnover_analysis(factory_id, start_date, end_date)` — 4 metrics (TURNOVER_RATE / INVENTORY_DAYS / CONSUMPTION_AMOUNT / INVENTORY_VALUE)
2. `_get_turnover_trend_chart(factory_id, start_date, end_date)` — LINE chart, MONTH iteration via `_plus_months`
3. `_get_turnover_by_category(factory_id, start_date, end_date)` — ranking sorted desc, all GREEN alert

Main entry:
```python
async def _get_turnover_mode(factory_id: str, start_date: date, end_date: date) -> dict:
    metrics = await _get_turnover_analysis(factory_id, start_date, end_date)
    ranking = await _get_turnover_by_category(factory_id, start_date, end_date)
    trend_chart = await _get_turnover_trend_chart(factory_id, start_date, end_date)
    return {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "metrics": metrics,
        "ranking": ranking,
        "trendChart": trend_chart,
    }
```

⚠️ **Java HashMap key order may differ from put-order** — verify against `analysis-inventory-F999-turnover.json` golden recorded in Task 1. If golden shows different envelope key order (Jackson hash), adjust dict literal (rare for 5-key HashMap).

⚠️ **T-INV-2 div-by-zero guards** — TURNOVER_RATE / INVENTORY_DAYS use `if total > 0 else 0` ternaries.

⚠️ **`_plus_months(d, n)` helper** — simple month-iteration utility (spec §3.7.2 includes inline definition).

- [ ] **Step 1: Read spec §3.7.1, §3.7.2, §3.7.3**

```bash
sed -n '900,1300p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```
(Approximate range — adjust by actual section boundaries via `grep -n "^####" docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md`.)

- [ ] **Step 2: Implement 3 turnover sub-services + main entry**

Replace the `_get_turnover_mode` `NotImplementedError` stub. Add the 3 sub-services and update the main entry.

- [ ] **Step 3: Verify against F999 turnover golden (rough byte-shape)**

```bash
cd backend/python && python -c "
import json
g = json.load(open('../../tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json'))
data = g['response']['data']
print(f'top keys: {list(data.keys())}')
print(f'metrics count: {len(data.get(\"metrics\", []))}')
print(f'ranking count: {len(data.get(\"ranking\", []))}')
print(f'trendChart shape: {set((data.get(\"trendChart\") or {}).keys())}')
"
```
Expected: 5 top keys (startDate, endDate, metrics, ranking, trendChart), 4 metrics, ranking is list, trendChart has chartType/data/options.

- [ ] **Step 4: Smoke test (manual TestClient)**

```bash
cd backend/python && python -c "
import os
os.environ['JWT_SECRET'] = 'test-secret'
from main import app
from fastapi.testclient import TestClient
import jwt, time
client = TestClient(app)
token = jwt.encode({'userId':1,'username':'t','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, 'test-secret', algorithm='HS256')
resp = client.get('/api/mobile/F999/smart-bi/analysis/inventory?startDate=2025-01-01&endDate=2025-01-31&analysisType=turnover', headers={'Authorization': f'Bearer {token}'})
print(f'status={resp.status_code}')
data = resp.json().get('data', {})
print(f'top keys: {list(data.keys())}')
"
```
Expected: 5-key envelope. (Empty values OK because no DB seed in test env locally.)

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: turnover mode (3 sub-services)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 10: Expiry mode (3 sub-services + main entry)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

Read spec §3.7.4 + §3.7.5 + §3.7.6.

Sub-services:
1. `_get_expiry_risk_analysis(factory_id)` — 5 metrics (EXPIRY_RISK_RATE / EXPIRING_COUNT / HIGH_RISK_COUNT / EXPIRED_COUNT / EXPIRING_VALUE)
2. `_get_expiring_batches_ranking(factory_id, days_to_expiry=30)` — FEFO sort, limit 20, **inline alert: `<=7 RED, <=15 YELLOW, else GREEN`**
3. `_get_expiry_risk_chart(factory_id)` — PIE chart, 5-bucket LinkedHashMap pre-populate, 5-color array

Main entry:
```python
async def _get_expiry_mode(factory_id: str, start_date: date, end_date: date) -> dict:
    risk_analysis = await _get_expiry_risk_analysis(factory_id)
    expiring_batches = await _get_expiring_batches_ranking(factory_id, days_to_expiry=30)
    risk_chart = await _get_expiry_risk_chart(factory_id)
    return {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "riskAnalysis": risk_analysis,
        "expiringBatches": expiring_batches,
        "riskChart": risk_chart,
    }
```

⚠️ **`days_to_expiry` Java default = 30** (controller line 432). Pass through as default.

⚠️ **Inline alert 7/15** — strict `<=` (boundary 7 → RED, boundary 15 → YELLOW). NOT a named helper — keep inline.

⚠️ **5-bucket LinkedHashMap order** (T-INV-5) — Python dict literal must mirror Java insertion order:
- 已过期 (expired)
- 7天内到期 (≤7 days)
- 15天内到期 (≤15 days)
- 30天内到期 (≤30 days)
- 30天后到期 (>30 days)

⚠️ **`date.today()` usage** — wrap in helpers per spec §3.7.4-§3.7.6 to allow monkeypatching in tests.

- [ ] **Step 1: Read spec §3.7.4-§3.7.6**

```bash
grep -n "^#### 3\.7\." docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```
Find exact line ranges, then `sed -n '<start>,<end>p'`.

- [ ] **Step 2: Implement 3 expiry sub-services + main entry**

- [ ] **Step 3: Verify against F999 expiry golden**

```bash
cd backend/python && python -c "
import json
g = json.load(open('../../tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json'))
data = g['response']['data']
print(f'top keys: {list(data.keys())}')
print(f'riskAnalysis metrics: {len(data.get(\"riskAnalysis\", []))}')
chart = data.get('riskChart', {})
chart_data = chart.get('data', [])
print(f'riskChart data buckets: {[d.get(\"bucket\") or d.get(\"name\") for d in chart_data]}')
"
```
Expected: 5 top keys, 5 metrics, 5 buckets in fixed order.

- [ ] **Step 4: Smoke test via TestClient**

(Same pattern as Task 9 Step 4 with `analysisType=expiry`.)

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: expiry mode (3 sub-services + 5-bucket LinkedHashMap)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 11: Aging mode (3 sub-services + main entry)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

Read spec §3.7.7 + §3.7.8 + §3.7.9.

Sub-services:
1. `_get_aging_metrics(factory_id)` — 3 metrics (SLOW_MOVING_RATE inline alert / SLOW_MOVING_VALUE / AVG_AGING_DAYS Optional)
2. `_get_inventory_aging_chart(factory_id)` — BAR chart, 4-bucket LinkedHashMap (新鲜<30 / 正常30-60 / 警告60-90 / 长期>90), 4-color array
3. `_get_long_aging_batches_ranking(factory_id, min_days=60)` — age desc sort, limit 20, **inline alert `>120 RED, >90 YELLOW, else GREEN`**, `>=60` inclusive filter

Main entry:
```python
async def _get_aging_mode(factory_id: str, start_date: date, end_date: date) -> dict:
    aging_metrics = await _get_aging_metrics(factory_id)
    aging_chart = await _get_inventory_aging_chart(factory_id)
    long_aging_batches = await _get_long_aging_batches_ranking(factory_id, min_days=60)
    return {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "agingMetrics": aging_metrics,
        "agingChart": aging_chart,
        "longAgingBatches": long_aging_batches,
    }
```

⚠️ **`min_days=60` Java default** (controller line 438). Pass through.

⚠️ **Inline alert 90/120** in `_get_long_aging_batches_ranking` — strict `>` (boundary 90 → YELLOW, boundary 120 → RED). NOT a named helper.

⚠️ **SLOW_MOVING_RATE inline alert 10/20** in `_get_aging_metrics` — `>20% RED, >10% YELLOW, else GREEN` (INVERSE direction). NOT a named helper.

⚠️ **AVG_AGING_DAYS Optional** — spec uses `Optional<MetricResult>` from Java, may be null when no batches. Python: skip the metric (don't emit) OR emit with `value=null`. Verify against golden.

⚠️ **4-bucket aging boundaries** (`_AGING_FRESH=30 / _AGING_NORMAL=60 / _AGING_WARNING=90`) — uses constants from Task 5.

- [ ] **Step 1: Read spec §3.7.7-§3.7.9**

```bash
sed -n '<start>,<end>p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

- [ ] **Step 2: Implement 3 aging sub-services + main entry**

- [ ] **Step 3: Verify against F999 aging golden**

```bash
cd backend/python && python -c "
import json
g = json.load(open('../../tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json'))
data = g['response']['data']
print(f'top keys: {list(data.keys())}')
print(f'agingMetrics: {[m.get(\"metricCode\") for m in data.get(\"agingMetrics\", [])]}')
print(f'agingChart data: {len(data.get(\"agingChart\", {}).get(\"data\", []))} buckets')
"
```
Expected: 5 top keys, agingMetrics 3 entries, agingChart 4 buckets.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: aging mode (3 sub-services + 4-bucket LinkedHashMap)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 12: Contract tests (4 tests — 3 byte-shape + 1 default-501)

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_inventory_contract.py`

Read spec §5.1 (line 2374-2415) for contract test pattern. Mirror sister `test_analysis_finance_contract.py`.

Pattern:
- JWT_SECRET set BEFORE imports
- `_load_production_main()` via importlib
- `_make_token(factory_id)`, `_strip_volatile(obj)`, `client` fixture
- `monkeypatch.setattr(analysis_inventory, 'date', <fixed_date>)` to freeze `date.today()` to golden record date
- Compare `response.json()['data']` dict-eq vs `golden['response']['data']` after `_strip_volatile`

4 contract tests:
1. `TestAnalysisInventoryTurnover::test_f999_turnover_byte_shape` — full dict-eq vs `analysis-inventory-F999-turnover.json`
2. `TestAnalysisInventoryExpiry::test_f999_expiry_byte_shape` — full dict-eq vs `analysis-inventory-F999-expiry.json`
3. `TestAnalysisInventoryAging::test_f999_aging_byte_shape` — full dict-eq vs `analysis-inventory-F999-aging.json`
4. `TestAnalysisInventoryDefault::test_f999_default_returns_501` — verify dispatcher routes default mode to 501 envelope (no real impl in PR-A)

⚠️ **Date freeze**: each test must `monkeypatch.setattr` `analysis_inventory.date` (or import date wrapper) to match golden record date (captured in Task 1 Step 7).

⚠️ **DB mock strategy**: tests `monkeypatch.setattr` `analysis_inventory._fetch_all` (or each `_query_*` helper) to return canned rows that produce golden output. See sister contract tests for pattern. Goldens recorded against live test env DB; mocks must reproduce the same rows.

⚠️ **Mock rows source**: extract from goldens. The expected output IS the golden; mock the inputs that produce it. For F999 (empty DB), most queries return `[]` and goldens reflect empty-state shape. Easier to mock — return `[]` for all `_query_*` helpers and verify Python produces same empty-state envelope as Java.

- [ ] **Step 1: Read spec §5.1**

```bash
sed -n '2374,2415p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

- [ ] **Step 2: Create test file**

Mirror `test_analysis_finance_contract.py` boilerplate (top of file: imports, JWT_SECRET set, REPO_ROOT, `_load_production_main`, `_make_token`, `_strip_volatile`, `production_app`+`client` fixtures).

Then 4 test classes per spec §5.1 pattern. Each `byte_shape` test:
```python
class TestAnalysisInventoryTurnover:
    def test_f999_turnover_byte_shape(self, client, monkeypatch):
        # Freeze date.today() to golden record date
        from datetime import date as real_date
        from smartbi_compat.api import analysis_inventory
        FROZEN = real_date(2026, 5, 1)  # or whatever Task 1 Step 7 captured
        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return FROZEN
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        # Mock _fetch_all (F999 = empty DB)
        async def empty_fetch(*_args):
            return []
        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-01-31&analysisType=turnover",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])
        with open(GOLDEN_DIR / "analysis-inventory-F999-turnover.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["response"]["data"])

        if py_data != golden_data:
            import difflib
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=5,
            ))
            pytest.fail(f"F999 turnover byte-shape mismatch:\n{diff}")
```

(Repeat structure for expiry / aging.)

Default mode test:
```python
class TestAnalysisInventoryDefault:
    def test_f999_default_returns_501(self, client):
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-01-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 501
        assert "default" in body["message"].lower() or "getInventoryHealth" in body["message"]
```

- [ ] **Step 3: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py -v 2>&1 | tail -30
```

If any byte-shape test fails:
- Examine diff output
- Most likely root causes: dict key order (LinkedHashMap mirror), Decimal serialization (`_decimal_to_number`), date formatting (`isoformat()`), null vs missing key
- Fix impl in `analysis_inventory.py` (NOT golden — golden is the truth)

- [ ] **Step 4: Commit (when all 4 tests PASS)**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-A: 4 contract tests (3 byte-shape + 1 default-501)" \
    tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 13: Final regression sweep + push + open PR + final reviewer

**Files:** none modified.

- [ ] **Step 1: Full smartbi_compat suite**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```
Expected: 502 (baseline) + 4 (new contract tests) = **506 passed, 1 skipped, 0 failed**.

If any sister test fails → check git diff to confirm we didn't accidentally touch other files. PR-A0 added `_fetch_all` to `analysis_finance.py` — that's expected.

- [ ] **Step 2: Verify diff scope**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
git diff --stat origin/main...HEAD
```
Expected:
- `backend/python/smartbi_compat/api/analysis_finance.py`: ~10 lines added (_fetch_all)
- `backend/python/smartbi_compat/api/analysis_inventory.py`: ~700-800 lines (NEW)
- `backend/python/main.py`: ~3 lines added (router registration)
- `tests/python/smartbi_compat/test_analysis_inventory_contract.py`: ~300-400 lines (NEW)
- `tests/fixtures/java-smartbi-golden/analysis-inventory-F999-{turnover,expiry,aging}.json`: 3 NEW files
- `docs/superpowers/plans/2026-05-01-phase2a-analysis-inventory-pr-a.md`: this plan

NO other files. If unexpected files appear → STOP and review.

- [ ] **Step 3: Push branch**

```bash
git push -u origin phase2a/inventory-impl
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head phase2a/inventory-impl --title "Phase 2A: /analysis/inventory per-type real impl (PR-A0 + PR-A)" --body "$(cat <<'EOF'
## Summary

Real implementation of `/analysis/inventory` 3 per-type modes (turnover / expiry / aging). Default mode returns 501 envelope (PR-B follow-up will replace with `getInventoryHealth` DashboardResponse).

**Combined PR-A0 + PR-A** for efficiency:
- **PR-A0**: `_fetch_all` shared SQL helper added to `analysis_finance.py`. Sister specs (procurement #40, department #36, region #41) depend on this.
- **PR-A**: 9 sub-services + 6 SQL helpers + 4 named alert helpers + 4 inline alert sites + 12 module constants + new `analysis_inventory.py` module + dispatcher + 4 contract tests + 3 F999 goldens.

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md (PR #47, merged main `b30d07686`)
Plan: docs/superpowers/plans/2026-05-01-phase2a-analysis-inventory-pr-a.md

## Modes

| analysisType | Java reference | Sub-services | Output keys |
|---|---|---|---|
| turnover | `getTurnoverAnalysis` + `getTurnoverByCategory` + `getTurnoverTrendChart(period="MONTH")` | 3 | `[startDate, endDate, metrics, ranking, trendChart]` |
| expiry | `getExpiryRiskAnalysis` + `getExpiringBatchesRanking` + `getExpiryRiskChart` | 3 | `[startDate, endDate, riskAnalysis, expiringBatches, riskChart]` |
| aging | `getAgingMetrics` + `getInventoryAgingChart` + `getLongAgingBatchesRanking` | 3 | `[startDate, endDate, agingMetrics, agingChart, longAgingBatches]` |
| (default) | `getInventoryHealth` (PR-B) | — | 501 envelope (PR-A scope: deferred) |

## Tests

Full smartbi_compat regression sweep: **506 passed, 1 skipped, 0 failed** (was 502 post payable PR-B; +4 new contract tests).

- F999 turnover byte-shape gate (dict-eq vs `analysis-inventory-F999-turnover.json`)
- F999 expiry byte-shape gate
- F999 aging byte-shape gate
- F999 default mode 501-envelope smoke

## T-INV-* traps respected

- T-INV-1: 8 thresholds with INVERSE direction documented for inventoryDays / expiryRisk / lossRate
- T-INV-2: 5 div-by-zero guards in turnover / aging metrics
- T-INV-5: 16 LinkedHashMap insertion-order sites mirrored (no Map.of(N) Rule 8 risk)
- T-INV-7: `time(23, 59, 59)` boundary (NOT microseconds) in 2 SQL helpers
- T-INV-12: ORDER BY truth — Java has → mirror exact; Java none → Python adds `ORDER BY id`
- T-INV-13: `getCurrentQuantity()` @Transient inline formula null-safe

## Out of scope (deferred)

- PR-B: default mode `getInventoryHealth` + DashboardResponse + `_get_health_score` (T-INV-9 asymmetric null) + `_calculate_loss_rate_for_health_score` + AI insights / suggestions
- PR-C: 10 arithmetic depth test classes (T-INV-1 to T-INV-15 verbatim regression coverage)

## Test plan

- [ ] CI green on PR
- [ ] `python -m pytest tests/python/smartbi_compat/test_analysis_inventory_contract.py -v` 4/4 PASS
- [ ] No regression in sister branches (finance, sales, alerts, etc)
- [ ] Diff stat: 4 source files modified/created + 3 goldens + 1 plan; NO other changes

## Concurrency note

Sister chats running on `analysis_region.py` / `analysis_department.py` / `analysis_procurement.py` (different files; no impl conflict). Only shared touch is `main.py` route registration (additive).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Dispatch final code reviewer subagent**

After PR is opened, dispatch `pr-review-toolkit:code-reviewer` (model=sonnet) with:
- HARD RULE check: only the 6 expected files modified
- Spec semantics: T-INV-12 ORDER BY truth, T-INV-13 @Transient formula, T-INV-7 atTime boundary
- Rule 1 / Rule 4 / Rule 5 / Rule 6 compliance throughout
- LinkedHashMap order matches goldens (16 sites)
- Inline alert vs named helper distinction (4 inline + 4 named)
- Contract tests actually verify byte-shape (not just smoke)

PR-A complete after final reviewer approves.

---

## Self-Review

**1. Spec coverage** — every PR-A spec section traces to a task:

| Spec section | Task |
|---|---|
| §1.2 PR-A scope | Tasks 9-11 (3 modes) + Task 12 (contract tests) |
| §3.2 Imports + PR-A0 prereq | Task 2 (PR-A0) + Task 3 (skeleton imports) |
| §3.3 SQL helpers (T-INV-12) | Task 4 |
| §3.4 Constants (T-INV-1) | Task 5 |
| §3.5 Shared logic helpers (T-INV-13) | Task 6 |
| §3.6 Alert helpers (4 named) | Task 7 |
| §3.7 Mode dispatcher + 9 sub-services | Tasks 8-11 |
| §4.1 Golden recording (HARD prereq) | Task 1 |
| §5.1 Contract tests | Task 12 |
| §6 PR slicing (PR-A scope) | All tasks bounded to PR-A scope |
| §7 Risks 1-7 | Risk 1 (mock taxonomy) → §1.3 noted out-of-scope; Risk 2 (T-INV-9) → out-of-scope (PR-B); Risk 3 (single-col ORDER BY) → spec §3.3 mirror exact; Risk 4 (dead-code) → no import; Risk 5 (SQL vs @Transient) → mirror Java verbatim; Risk 6 (date determinism) → Task 1 Step 7 capture + Task 12 monkeypatch; Risk 7 (loss rate helper) → out-of-scope (PR-B) |

PR-B and PR-C scope explicitly excluded.

**2. Placeholder scan**: searched plan for "TBD", "TODO", "implement later", "Add appropriate", "fill in details", "similar to Task N". None found in commit-actionable steps. References to spec line numbers are intentional (avoid duplicating 2700-line spec content).

**3. Type / signature consistency**: All 9 sub-services use `(factory_id, start_date, end_date)` or `(factory_id)`-only signatures matching Java. SQL helpers consistently `(factory_id, ...)`. Alert helpers consistently `(Decimal) -> str`. `_get_current_quantity(batch: dict) -> Decimal`. `_fetch_all(sql, *args) -> list[dict]`.

No inconsistencies.

---

## 并行工作建议

### Subagent: ✅ 推荐
Tasks 4-11 are largely independent additions to `analysis_inventory.py` (each adds a separate section). Tasks 9/10/11 (3 modes) are completely independent.

Tasks 1-3 must run first sequentially (goldens → PR-A0 → skeleton).
Tasks 12-13 must run last sequentially (tests need impl complete).

### 多 Chat: ❌ 不推荐
All Tasks 3-12 edit `analysis_inventory.py`. Multi-chat parallel will conflict.

Sister chats (region / department / procurement) work on DIFFERENT files. No file-level conflict expected.

---

## Execution Handoff

Plan complete and saved. Ready for **subagent-driven-development**:

- Task 1 (golden recording) is the HARD prereq + may need user assistance (SSH access / JWT_SECRET)
- Tasks 2-11 are mechanical (spec provides exact code) — can dispatch with `haiku` model
- Tasks 12-13 are integration + review — dispatch with `sonnet` model for byte-shape diff debugging

**HALT condition**: if Task 1 fails (test env down, JWT_SECRET unavailable, F999 seed invariant violated), STOP and ping user with diagnostic info. Do NOT proceed to impl tasks without goldens.
