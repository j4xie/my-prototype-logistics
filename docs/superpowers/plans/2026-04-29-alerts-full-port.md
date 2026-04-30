# Phase 2A `/alerts` Full Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Java `RecommendationServiceImpl.generateSalesAlerts/Finance/Department/All` to Python alias for `GET /api/mobile/{factory_id}/smart-bi/alerts[?category=sales|finance|department]` with byte-shape parity.

**Architecture:** Bundle Java's `alert_thresholds.json` into Python; new SQLAlchemy module-level seams `_query_<X>_data` for monkey-patch testing; per-generator helpers in `smartbi_compat/api/analysis.py`; F999 synthetic test factory for goldens. Java side gets a TreeMap sort fix to stabilize HashMap iteration in 2 generators.

**Tech Stack:** Python 3.8+ FastAPI / SQLAlchemy 2.x / Pydantic 2.x / pytest / Java 21 Spring Boot 3.2 / Maven / Flyway / PostgreSQL.

**Spec reference:** `docs/superpowers/specs/2026-04-29-alerts-full-port-design.md` — read this first.

**Marathon split**: chat 2 = Phase A (foundation) + Phase B (sales generator); chat 3 = Phase C (finance) + Phase D (department) + Phase E (aggregator + close-out).

---

## File structure

### Created files

| Path | Responsibility |
|---|---|
| `backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V20260430_01__phase2a_test_factory_F999.sql` | F999 factory entity + `phase2a_test_user` + smart_bi seed copy from DEMO_FACTORY |
| `backend/python/smartbi_compat/config/alert_thresholds.json` | Byte-equal copy of Java's classpath JSON (CI guard verifies parity) |
| `backend/python/smartbi_compat/alert_thresholds.py` | Module-level threshold loader with `Decimal` dataclasses + `ALERT_SEVERITY` constant |
| `backend/python/smartbi_compat/date_range.py` | `DateRange` dataclass + `by_period("month")` (only branch used by /alerts) |
| `tests/python/smartbi_compat/test_alert_thresholds.py` | Threshold loader unit tests (JSON parse + fallback defaults) |
| `tests/python/smartbi_compat/test_date_range.py` | DateRange month boundary tests |
| `tests/python/smartbi_compat/test_alerts_logic.py` | Per-generator unit tests (boundaries, null handling, scale preservation) |
| `tests/python/smartbi_compat/test_alerts_contract.py` | Contract tests vs Java goldens (4 entry points) |
| `tests/fixtures/java-smartbi-golden/alerts-F999.json` | Recorded Java response — `?category` omitted (aggregator) |
| `tests/fixtures/java-smartbi-golden/alerts-F999-sales.json` | Recorded Java response — `?category=sales` |
| `tests/fixtures/java-smartbi-golden/alerts-F999-finance.json` | `?category=finance` |
| `tests/fixtures/java-smartbi-golden/alerts-F999-department.json` | `?category=department` |
| `scripts/phase2a/record-alerts-goldens.sh` | Convenience wrapper around `record-java-golden.mjs` for F999 + 4 alert variants |
| `docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md` | F999 design rationale (deferred-plan §4 deliverable) |
| `.github/workflows/threshold-parity-check.yml` *(or new step in existing workflow)* | CI diff guard for `alert_thresholds.json` parity |

### Modified files

| Path | Change |
|---|---|
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImpl.java` | Replace 2 `Collectors.groupingBy(..., Collectors.reducing(...))` calls with `TreeMap`-supplied variants (sales line ~236-241, department line ~392-394) |
| `backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImplTest.java` *(or create if absent)* | Add 2 unit tests asserting alert sort order |
| `backend/python/smartbi_compat/api/analysis.py` | +4 generator helpers, +4 query seams, +1 route handler with category dispatch |
| `scripts/phase2a/record-java-golden.mjs` | Add 4 endpoint definitions: `alerts`, `alerts-sales`, `alerts-finance`, `alerts-department` |
| `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md` | §4 calibration writeback (actual hours vs T0 estimate, end of chat 3) |

---

## Phase A — Foundation (chat 2 prerequisite)

### Task A1: Create F999 migration

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V20260430_01__phase2a_test_factory_F999.sql`
- Reference: `backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V2026_01_18_02__smart_bi_sample_data.sql` (seed source)

- [ ] **Step 1: Discover the `factories` and `users` schema columns**

Run: `grep -A 30 "CREATE TABLE.*factories" backend/java/cretas-api/src/main/resources/db/migration-pg-converted/*.sql | head -60`

Note the required NOT NULL columns (e.g., `id`, `name`, `factory_type`, `created_at`). Repeat for `users` table.

- [ ] **Step 2: Write the migration file**

```sql
-- V20260430_01__phase2a_test_factory_F999.sql
-- Phase 2A test factory: enables F999 to receive JWT and serve byte-shape goldens for /alerts and other Phase 2A endpoints.
-- Reuses DEMO_FACTORY's smart_bi_*_data seed via INSERT ... SELECT.
-- See docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md for rationale.

-- 1. Factory entity (idempotent)
INSERT INTO factories (id, name, factory_type, created_at, updated_at)
VALUES ('F999', 'Phase 2A Test Factory', 'TEST', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Test user with env-injected password hash placeholder
--    Flyway escape: $${...} renders as ${...} in final SQL (DO NOT remove the double-$)
INSERT INTO users (id, username, factory_id, role, password_hash, status, created_at, updated_at)
VALUES (
    'phase2a_test_user_id',
    'phase2a_test_user',
    'F999',
    'factory_super_admin',
    '$${PHASE2A_TEST_USER_PASSWORD_HASH}',
    'ACTIVE',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO NOTHING;

-- 3. SmartBI seed copy from DEMO_FACTORY (sales)
INSERT INTO smart_bi_sales_data (
    factory_id, order_date, salesperson_id, salesperson_name, department, region,
    province, city, customer_name, customer_type, product_id, product_name,
    product_category, quantity, amount, unit_price, cost, profit, gross_margin,
    monthly_target, created_at, updated_at
)
SELECT
    'F999', order_date, salesperson_id, salesperson_name, department, region,
    province, city, customer_name, customer_type, product_id, product_name,
    product_category, quantity, amount, unit_price, cost, profit, gross_margin,
    monthly_target, NOW(), NOW()
FROM smart_bi_sales_data
WHERE factory_id = 'DEMO_FACTORY'
ON CONFLICT DO NOTHING;

-- 4. SmartBI seed copy from DEMO_FACTORY (finance)
INSERT INTO smart_bi_finance_data (
    factory_id, record_date, record_type, department, category, material_cost,
    labor_cost, overhead_cost, total_cost, customer_name, receivable_amount,
    collection_amount, aging_days, due_date, supplier_name, payable_amount,
    payment_amount, budget_amount, actual_amount, variance_amount,
    created_at, updated_at
)
SELECT
    'F999', record_date, record_type, department, category, material_cost,
    labor_cost, overhead_cost, total_cost, customer_name, receivable_amount,
    collection_amount, aging_days, due_date, supplier_name, payable_amount,
    payment_amount, budget_amount, actual_amount, variance_amount,
    NOW(), NOW()
FROM smart_bi_finance_data
WHERE factory_id = 'DEMO_FACTORY'
ON CONFLICT DO NOTHING;

-- 5. SmartBI seed copy from DEMO_FACTORY (department)
INSERT INTO smart_bi_department_data (
    factory_id, record_date, department, department_id, manager_name, headcount,
    sales_amount, sales_target, cost_amount, per_capita_sales, per_capita_cost,
    created_at, updated_at
)
SELECT
    'F999', record_date, department, department_id, manager_name, headcount,
    sales_amount, sales_target, cost_amount, per_capita_sales, per_capita_cost,
    NOW(), NOW()
FROM smart_bi_department_data
WHERE factory_id = 'DEMO_FACTORY'
ON CONFLICT DO NOTHING;
```

**WARNING**: confirm exact column lists by reading the source migration first (Step 1). The above is a sketch — the actual columns may differ slightly. Use the source migration's column list verbatim except `factory_id` and `created_at`/`updated_at`.

- [ ] **Step 3: Add `PHASE2A_TEST_USER_PASSWORD_HASH` to `.env.test` and `.env.prod`**

On the server (47.100.235.168):
```bash
ssh root@47.100.235.168
echo "PHASE2A_TEST_USER_PASSWORD_HASH=DISABLED" >> /www/wwwroot/cretas/.env.prod
# Generate a real bcrypt hash for test env:
PASSWORD="phase2a-test-pw-$(date +%s)"
HASH=$(htpasswd -bnBC 10 "" "$PASSWORD" | tr -d ':\n' | sed 's/^\$2y/\$2a/')
echo "PHASE2A_TEST_USER_PASSWORD_HASH=$HASH" >> /www/wwwroot/cretas/.env.test
echo "PHASE2A_TEST_USER_PASSWORD=$PASSWORD" >> /www/wwwroot/cretas/.env.test
chmod 600 /www/wwwroot/cretas/.env.{prod,test}
```

Note plaintext password in a secure local note — recorder needs it.

- [ ] **Step 4: Apply migration to test env**

```bash
./scripts/deploy/deploy-backend.sh --env test
# Flyway runs the new migration on startup; check logs:
ssh root@47.100.235.168 "journalctl -u cretas-backend-test --since '2 min ago' | grep -i flyway"
# Expect: Migrating schema "public" to version "20260430.01 - phase2a test factory F999"
```

- [ ] **Step 5: Verify F999 login + JWT issuance**

```bash
curl -X POST http://47.100.235.168:10011/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"phase2a_test_user\",\"password\":\"$PHASE2A_TEST_USER_PASSWORD\"}"
```

Expect `success: true` with `accessToken`. If `success: false`, troubleshoot password hash format (bcrypt $2a$ vs $2y$).

- [ ] **Step 6: Verify F999 has SmartBI seed data**

```bash
ssh root@47.100.235.168 "psql -U postgres -d cretas_db -c \"SELECT factory_id, COUNT(*) FROM smart_bi_sales_data WHERE factory_id IN ('DEMO_FACTORY', 'F999') GROUP BY factory_id;\""
```

Expect both `DEMO_FACTORY` and `F999` to have identical row counts.

- [ ] **Step 7: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V20260430_01__phase2a_test_factory_F999.sql
git status --short  # verify only this file is staged
git commit -m "feat(phase2a): synthetic F999 test factory + smart_bi seed copy" -- backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V20260430_01__phase2a_test_factory_F999.sql
git show --stat HEAD  # post-commit verify
```

---

### Task A2: Java sort fix (sales + department generators)

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImpl.java` (~lines 236, 392)
- Test: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImplTest.java` *(create or extend)*

- [ ] **Step 1: Write the failing test for sales sort**

```java
// In RecommendationServiceImplTest.java
@Test
void salesAlertsAreSortedBySalespersonName() {
    // Given: 3 salespeople in non-alphabetical insertion order, ALL below red threshold
    when(salesDataRepository.findByFactoryIdAndOrderDateBetween(eq("F_TEST"), any(), any()))
        .thenReturn(List.of(
            buildSalesRow("张三", new BigDecimal("1000"), new BigDecimal("10000")),
            buildSalesRow("李四", new BigDecimal("500"),  new BigDecimal("10000")),
            buildSalesRow("王五", new BigDecimal("100"),  new BigDecimal("10000"))
        ));
    DateRange r = new DateRange(LocalDate.now().withDayOfMonth(1), LocalDate.now());

    List<Alert> alerts = service.generateSalesAlerts("F_TEST", r);

    // Filter to per-salesperson alerts only
    List<String> names = alerts.stream()
        .filter(a -> a.getRelatedEntityName() != null)
        .map(Alert::getRelatedEntityName)
        .toList();

    // Assert lex-sorted (张三/李四/王五 → 张/李/王 → unicode-sorted)
    assertThat(names).isSorted();
    assertThat(names).containsExactly("张三", "李四", "王五"); // adjust based on Chinese unicode order
}

private SmartBiSalesData buildSalesRow(String name, BigDecimal amount, BigDecimal target) {
    SmartBiSalesData d = new SmartBiSalesData();
    d.setSalespersonName(name);
    d.setAmount(amount);
    d.setMonthlyTarget(target);
    return d;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/java/cretas-api && mvn test -Dtest=RecommendationServiceImplTest#salesAlertsAreSortedBySalespersonName`
Expected: FAIL — current implementation iterates `HashMap.entrySet()` so order depends on hash.

- [ ] **Step 3: Apply Java sort fix in `RecommendationServiceImpl`**

In `generateSalesAlerts` (around line 236), change:
```java
Map<String, BigDecimal> salespersonSales = salesData.stream()
    .filter(d -> d.getSalespersonName() != null)
    .collect(Collectors.groupingBy(
        SmartBiSalesData::getSalespersonName,
        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
    ));
```
to:
```java
Map<String, BigDecimal> salespersonSales = salesData.stream()
    .filter(d -> d.getSalespersonName() != null)
    .collect(Collectors.groupingBy(
        SmartBiSalesData::getSalespersonName,
        TreeMap::new,
        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
    ));
```

Same fix for `salespersonTargets` (around line 243-250) — add `TreeMap::new` as second arg.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -Dtest=RecommendationServiceImplTest#salesAlertsAreSortedBySalespersonName`
Expected: PASS

- [ ] **Step 5: Write the failing test for department sort**

```java
@Test
void departmentAlertsAreSortedByDepartmentName() {
    when(departmentDataRepository.findByFactoryIdAndRecordDateBetween(eq("F_TEST"), any(), any()))
        .thenReturn(List.of(
            buildDeptRow("研发部", new BigDecimal("100"), 10),
            buildDeptRow("销售部", new BigDecimal("200"), 10),
            buildDeptRow("行政部", new BigDecimal("50"),  10)
        ));
    DateRange r = new DateRange(LocalDate.now().withDayOfMonth(1), LocalDate.now());

    List<Alert> alerts = service.generateDepartmentAlerts("F_TEST", r);

    // Each dept's per_capita = sales/headcount = 10/20/5 — all below 50000 yellow threshold
    List<String> names = alerts.stream()
        .map(Alert::getMessage)
        .toList();

    // Department appears in title; assert input order != output order
    // Lex sort of 研发部/销售部/行政部 → 研/销/行 by unicode
    assertThat(names.get(0)).contains("研发部");
    assertThat(names).hasSize(3);
}

private SmartBiDepartmentData buildDeptRow(String dept, BigDecimal sales, int headcount) {
    SmartBiDepartmentData d = new SmartBiDepartmentData();
    d.setDepartment(dept);
    d.setSalesAmount(sales);
    d.setHeadcount(headcount);
    return d;
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `mvn test -Dtest=RecommendationServiceImplTest#departmentAlertsAreSortedByDepartmentName`
Expected: FAIL — HashMap iteration order.

- [ ] **Step 7: Apply Java sort fix for department generator**

In `generateDepartmentAlerts` (around line 392), change:
```java
Map<String, List<SmartBiDepartmentData>> byDepartment = departmentData.stream()
    .filter(d -> d.getDepartment() != null)
    .collect(Collectors.groupingBy(SmartBiDepartmentData::getDepartment));
```
to:
```java
Map<String, List<SmartBiDepartmentData>> byDepartment = departmentData.stream()
    .filter(d -> d.getDepartment() != null)
    .collect(Collectors.groupingBy(
        SmartBiDepartmentData::getDepartment,
        TreeMap::new,
        Collectors.toList()
    ));
```

- [ ] **Step 8: Run test to verify it passes**

Run: `mvn test -Dtest=RecommendationServiceImplTest#departmentAlertsAreSortedByDepartmentName`
Expected: PASS

- [ ] **Step 9: Run full test class to verify no regressions**

Run: `mvn test -Dtest=RecommendationServiceImplTest`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImpl.java
git add backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImplTest.java
git status --short
git commit -m "fix(smartbi): TreeMap-supplied groupingBy for stable alert sort order" -- \
  backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImpl.java \
  backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImplTest.java
git show --stat HEAD
```

---

### Task A3: Threshold JSON bundle + CI parity guard

**Files:**
- Create: `backend/python/smartbi_compat/config/alert_thresholds.json` (byte-equal copy)
- Create or modify: `.github/workflows/<existing>.yml` (add diff step)

- [ ] **Step 1: Copy Java's threshold JSON to Python config**

```bash
mkdir -p backend/python/smartbi_compat/config
cp backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json \
   backend/python/smartbi_compat/config/alert_thresholds.json
```

- [ ] **Step 2: Verify byte-equal copy**

Run: `diff backend/python/smartbi_compat/config/alert_thresholds.json backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json`
Expected: empty output (files identical)

- [ ] **Step 3: Locate or create the CI workflow that runs on PR**

Run: `ls .github/workflows/ 2>&1 || echo "no workflows dir"`

If a workflow already runs `pytest` for `backend/python/`, add the diff step there. Otherwise create `.github/workflows/threshold-parity-check.yml`.

- [ ] **Step 4: Add the diff guard step**

Add to the chosen workflow:
```yaml
- name: Verify alert_thresholds.json parity (Java vs Python)
  run: |
    diff backend/python/smartbi_compat/config/alert_thresholds.json \
         backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json
```

If creating new workflow file:
```yaml
name: threshold-parity-check
on:
  pull_request:
    paths:
      - 'backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json'
      - 'backend/python/smartbi_compat/config/alert_thresholds.json'
jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Diff
        run: |
          diff backend/python/smartbi_compat/config/alert_thresholds.json \
               backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json
```

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/config/alert_thresholds.json .github/workflows/threshold-parity-check.yml
git status --short
git commit -m "feat(phase2a): bundle alert_thresholds.json + CI parity guard" -- \
  backend/python/smartbi_compat/config/alert_thresholds.json .github/workflows/threshold-parity-check.yml
git show --stat HEAD
```

---

### Task A4: Python `alert_thresholds.py` loader

**Files:**
- Create: `backend/python/smartbi_compat/alert_thresholds.py`
- Create: `tests/python/smartbi_compat/test_alert_thresholds.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/python/smartbi_compat/test_alert_thresholds.py
from decimal import Decimal
from smartbi_compat.alert_thresholds import (
    load_thresholds, ALERT_SEVERITY,
    SalesThresholds, FinanceThresholds, DepartmentThresholds,
)

def test_load_thresholds_from_bundled_json():
    t = load_thresholds()
    # Sales thresholds (per JSON values verified in spec §3.2)
    assert t.sales.completion_red == Decimal("60")
    assert t.sales.completion_yellow == Decimal("80")
    assert t.sales.growth_red == Decimal("-20")
    assert t.sales.growth_yellow == Decimal("-10")
    # Finance thresholds
    assert t.finance.aging_red == 90  # int (Java BigDecimal but used as int comparison)
    assert t.finance.aging_yellow == 60
    assert t.finance.cost_variance_red == Decimal("20")
    assert t.finance.amount_red == Decimal("1000000")
    assert t.finance.amount_yellow == Decimal("500000")
    # Department thresholds
    assert t.department.per_capita_red == Decimal("50000")
    assert t.department.per_capita_yellow == Decimal("80000")

def test_load_thresholds_falls_back_to_defaults_when_file_missing(tmp_path, monkeypatch):
    # Point loader at non-existent path
    monkeypatch.setattr(
        "smartbi_compat.alert_thresholds._JSON_PATH",
        tmp_path / "missing.json",
    )
    t = load_thresholds()
    # Expect Java defaults from RecommendationServiceImpl line 65-79
    assert t.sales.completion_red == Decimal("60")
    assert t.sales.growth_red == Decimal("-20")
    assert t.finance.aging_red == 90

def test_alert_severity_constants():
    assert ALERT_SEVERITY == {"GREEN": 0, "YELLOW": 1, "RED": 2, "CRITICAL": 3}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_alert_thresholds.py -v`
Expected: FAIL — `ImportError: No module named smartbi_compat.alert_thresholds`

- [ ] **Step 3: Implement `alert_thresholds.py`**

```python
"""Threshold loader mirroring Java RecommendationServiceImpl.loadAlertThresholds.

Bundled JSON copy lives at smartbi_compat/config/alert_thresholds.json (CI guard
verifies parity against Java's classpath copy at
backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json).

Falls back to hardcoded Java defaults (line 65-79) when file is unreadable —
matches Java behavior on IOException at startup.
"""
from __future__ import annotations
import json
import logging
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

logger = logging.getLogger(__name__)

_JSON_PATH = Path(__file__).parent / "config" / "alert_thresholds.json"

ALERT_SEVERITY = {"GREEN": 0, "YELLOW": 1, "RED": 2, "CRITICAL": 3}


@dataclass(frozen=True)
class SalesThresholds:
    completion_red: Decimal
    completion_yellow: Decimal
    growth_red: Decimal
    growth_yellow: Decimal


@dataclass(frozen=True)
class FinanceThresholds:
    aging_red: int
    aging_yellow: int
    cost_variance_red: Decimal
    cost_variance_yellow: Decimal
    amount_red: Decimal
    amount_yellow: Decimal


@dataclass(frozen=True)
class DepartmentThresholds:
    per_capita_red: Decimal
    per_capita_yellow: Decimal


@dataclass(frozen=True)
class Thresholds:
    sales: SalesThresholds
    finance: FinanceThresholds
    department: DepartmentThresholds


_DEFAULTS = Thresholds(
    sales=SalesThresholds(
        completion_red=Decimal("60"),
        completion_yellow=Decimal("80"),
        growth_red=Decimal("-20"),
        growth_yellow=Decimal("-10"),
    ),
    finance=FinanceThresholds(
        aging_red=90,
        aging_yellow=60,
        cost_variance_red=Decimal("20"),
        cost_variance_yellow=Decimal("10"),
        amount_red=Decimal("1000000"),
        amount_yellow=Decimal("500000"),
    ),
    department=DepartmentThresholds(
        per_capita_red=Decimal("50000"),
        per_capita_yellow=Decimal("80000"),
    ),
)


def load_thresholds() -> Thresholds:
    """Load thresholds from bundled JSON; fall back to Java defaults on read error."""
    try:
        with open(_JSON_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("alert_thresholds.json unreadable, using defaults: %s", e)
        return _DEFAULTS

    sales_cfg = cfg.get("sales", {})
    finance_cfg = cfg.get("finance", {})
    dept_cfg = cfg.get("department", {})

    return Thresholds(
        sales=SalesThresholds(
            completion_red=_dec(sales_cfg, "completion_rate", "red", _DEFAULTS.sales.completion_red),
            completion_yellow=_dec(sales_cfg, "completion_rate", "yellow", _DEFAULTS.sales.completion_yellow),
            growth_red=_dec(sales_cfg, "growth_rate", "red", _DEFAULTS.sales.growth_red),
            growth_yellow=_dec(sales_cfg, "growth_rate", "yellow", _DEFAULTS.sales.growth_yellow),
        ),
        finance=FinanceThresholds(
            aging_red=_int(finance_cfg, "aging_days", "red", _DEFAULTS.finance.aging_red),
            aging_yellow=_int(finance_cfg, "aging_days", "yellow", _DEFAULTS.finance.aging_yellow),
            cost_variance_red=_dec(finance_cfg, "cost_variance", "red", _DEFAULTS.finance.cost_variance_red),
            cost_variance_yellow=_dec(finance_cfg, "cost_variance", "yellow", _DEFAULTS.finance.cost_variance_yellow),
            amount_red=_dec(finance_cfg, "receivable_amount", "red", _DEFAULTS.finance.amount_red),
            amount_yellow=_dec(finance_cfg, "receivable_amount", "yellow", _DEFAULTS.finance.amount_yellow),
        ),
        department=DepartmentThresholds(
            per_capita_red=_dec(dept_cfg, "per_capita_sales", "red", _DEFAULTS.department.per_capita_red),
            per_capita_yellow=_dec(dept_cfg, "per_capita_sales", "yellow", _DEFAULTS.department.per_capita_yellow),
        ),
    )


def _dec(parent: dict, key: str, level: str, default: Decimal) -> Decimal:
    sub = parent.get(key)
    if not isinstance(sub, dict) or level not in sub:
        return default
    return Decimal(str(sub[level]))


def _int(parent: dict, key: str, level: str, default: int) -> int:
    sub = parent.get(key)
    if not isinstance(sub, dict) or level not in sub:
        return default
    return int(sub[level])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_alert_thresholds.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/alert_thresholds.py tests/python/smartbi_compat/test_alert_thresholds.py
git status --short
git commit -m "feat(phase2a): Python alert_thresholds loader + dataclasses + tests" -- \
  backend/python/smartbi_compat/alert_thresholds.py tests/python/smartbi_compat/test_alert_thresholds.py
git show --stat HEAD
```

---

### Task A5: Python `date_range.py`

**Files:**
- Create: `backend/python/smartbi_compat/date_range.py`
- Create: `tests/python/smartbi_compat/test_date_range.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/python/smartbi_compat/test_date_range.py
from datetime import date
from unittest.mock import patch
from smartbi_compat.date_range import DateRange

def test_by_period_month_mid_month():
    """Mid-month: range = 1st to last day of month."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 4, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 4, 1)
    assert r.end_date == date(2026, 4, 30)

def test_by_period_month_january():
    """January: handles year boundary."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 1, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 1, 1)
    assert r.end_date == date(2026, 1, 31)

def test_by_period_month_december():
    """December: handles year wrap correctly."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 12, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 12, 1)
    assert r.end_date == date(2026, 12, 31)

def test_by_period_february_leap_year():
    """February in a leap year: 29 days."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2028, 2, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2028, 2, 1)
    assert r.end_date == date(2028, 2, 29)

def test_by_period_unsupported_raises():
    import pytest
    with pytest.raises(NotImplementedError):
        DateRange.by_period("week")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_date_range.py -v`
Expected: ImportError

- [ ] **Step 3: Implement `date_range.py`**

```python
"""DateRange dataclass mirroring DateRangeUtils.DateRange (Java side).

Only the ``"month"`` branch of rangeByPeriod is implemented because /alerts
is the only Phase 2A endpoint using it. Other branches (today/week/quarter/
year/default-30d) raise NotImplementedError until a downstream endpoint
demands them (YAGNI).
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class DateRange:
    start_date: date
    end_date: date

    @classmethod
    def by_period(cls, period: str) -> "DateRange":
        """Mirror DateRangeUtils.rangeByPeriod (Java).

        Java semantics (verified against DateRangeUtils.java line 179-197):
        - "month": [1st of current month, last day of current month] inclusive
        """
        today = date.today()
        if period == "month":
            start = today.replace(day=1)
            # Last day of month: jump to 1st of next month, subtract 1 day
            if today.month == 12:
                next_month_first = date(today.year + 1, 1, 1)
            else:
                next_month_first = date(today.year, today.month + 1, 1)
            end = next_month_first - timedelta(days=1)
            return cls(start, end)
        raise NotImplementedError(
            f"DateRange.by_period({period!r}) not yet ported. "
            "Add the branch when a Phase 2A endpoint requires it."
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_date_range.py -v`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/date_range.py tests/python/smartbi_compat/test_date_range.py
git status --short
git commit -m "feat(phase2a): DateRange.by_period(month) + tests" -- \
  backend/python/smartbi_compat/date_range.py tests/python/smartbi_compat/test_date_range.py
git show --stat HEAD
```

---

### Task A6: Deploy foundation to test env + smoke verify

**Files:** none modified — deployment + verification only.

- [ ] **Step 1: Deploy Java backend (test env)**

Run: `./scripts/deploy/deploy-backend.sh --env test`
Expected: green health check on port 10011.

- [ ] **Step 2: Deploy Python service (test env)**

Run: `./scripts/deploy/deploy-smartbi-python.sh --env test`
Expected: green health check on port 8084.

- [ ] **Step 3: Smoke verify Java sort fix in prod-like data flow**

Login as `factory_admin1` (F001 has empty smart_bi data):
```bash
TOKEN=$(curl -s -X POST http://47.100.235.168:10011/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' \
  | jq -r '.data.accessToken')
curl -s -H "Authorization: Bearer $TOKEN" \
  http://47.100.235.168:10011/api/mobile/F001/smart-bi/alerts \
  | jq '.data | length'
```
Expected: `0` (F001 has no smart_bi seed data → empty alerts list).

- [ ] **Step 4: Smoke verify F999 returns non-empty alerts**

```bash
F999_TOKEN=$(curl -s -X POST http://47.100.235.168:10011/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"phase2a_test_user\",\"password\":\"$PHASE2A_TEST_USER_PASSWORD\"}" \
  | jq -r '.data.accessToken')
curl -s -H "Authorization: Bearer $F999_TOKEN" \
  http://47.100.235.168:10011/api/mobile/F999/smart-bi/alerts \
  | jq '.data | length, (.data | map(.relatedEntityName) | map(select(. != null)))'
```
Expected: non-zero count + `relatedEntityName` array values are alphabetically sorted (Chinese unicode order).

- [ ] **Step 5: Verify cross-factory enforcement still works**

```bash
# F001 token attempting F999 path → expect 403
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://47.100.235.168:10011/api/mobile/F999/smart-bi/alerts
```
Expected: `403`.

- [ ] **Step 6: Document smoke results in chat (no commit)**

If any smoke fails, halt — do NOT proceed to Phase B until foundation is solid. Roll back via `git revert <commit>` and re-iterate.

If smoke passes, foundation is ready for sales generator port.

---

## Phase B — Sales generator (chat 2 close)

### Task B1: Sales generator port (TDD, 3 alert types + helpers)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py` (extend with sales seam + helpers + 3 alert builders)
- Create: `tests/python/smartbi_compat/test_alerts_logic.py` (will grow across B/C/D phases)

- [ ] **Step 1: Write the failing test for `_sum_field` helper**

```python
# tests/python/smartbi_compat/test_alerts_logic.py
from decimal import Decimal
from types import SimpleNamespace
from smartbi_compat.api.analysis import _sum_field, _calculate_rate, _calculate_growth_rate


def test_sum_field_skips_nulls():
    rows = [
        SimpleNamespace(amount=Decimal("100")),
        SimpleNamespace(amount=None),
        SimpleNamespace(amount=Decimal("50.5")),
    ]
    assert _sum_field(rows, "amount") == Decimal("150.5")

def test_sum_field_empty_list():
    assert _sum_field([], "amount") == Decimal("0")

def test_calculate_rate_zero_denominator_returns_zero():
    assert _calculate_rate(Decimal("100"), Decimal("0")) == Decimal("0")

def test_calculate_rate_normal():
    # 50/200 * 100 = 25.0000 (scale 4)
    assert _calculate_rate(Decimal("50"), Decimal("200")) == Decimal("25.0000")

def test_calculate_growth_rate_zero_previous_returns_zero():
    assert _calculate_growth_rate(Decimal("100"), Decimal("0")) == Decimal("0")

def test_calculate_growth_rate_decline():
    # (80 - 100) / 100 * 100 = -20.0000
    assert _calculate_growth_rate(Decimal("80"), Decimal("100")) == Decimal("-20.0000")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v`
Expected: ImportError on `_sum_field` etc.

- [ ] **Step 3: Implement helpers in `analysis.py`**

Add to `backend/python/smartbi_compat/api/analysis.py` (after existing functions, before route definitions):

```python
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

_SCALE_4 = Decimal("0.0001")


def _sum_field(rows: Iterable, attr: str) -> Decimal:
    """Sum ``getattr(row, attr)`` over rows, skipping None values.

    Mirrors Java sumField(data, ::getX) — null entries are treated as zero.
    """
    total = Decimal("0")
    for r in rows:
        v = getattr(r, attr, None)
        if v is not None:
            total += Decimal(str(v))
    return total


def _calculate_rate(numerator: Decimal, denominator: Decimal) -> Decimal:
    """Return (numerator / denominator) * 100, scale 4, HALF_UP rounding.

    Returns Decimal("0") when denominator is zero (matches Java behavior:
    BigDecimal.divide on zero would throw, but the Java helper guards against it).
    """
    if denominator == 0:
        return Decimal("0")
    return (numerator / denominator * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)


def _calculate_growth_rate(current: Decimal, previous: Decimal) -> Decimal:
    """Return ((current - previous) / previous) * 100, scale 4, HALF_UP rounding.

    Returns Decimal("0") when previous is zero.
    """
    if previous == 0:
        return Decimal("0")
    return ((current - previous) / previous * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v`
Expected: 6 tests PASS.

- [ ] **Step 5: Write failing test for `_query_sales_data` seam contract**

Add to `test_alerts_logic.py`:
```python
def test_query_sales_data_returns_empty_when_postgres_disabled(monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "false")
    from smartbi_compat.api.analysis import _query_sales_data
    from smartbi_compat.date_range import DateRange
    r = DateRange.by_period("month")
    rows = _query_sales_data("F999", r)
    # Lazy import inside _query_sales_data should detect disabled state and return []
    assert rows == []
```

- [ ] **Step 6: Implement `_query_sales_data` seam in `analysis.py`**

Add to `analysis.py`:
```python
def _query_sales_data(factory_id: str, range_) -> list:
    """Return smart_bi_sales_data rows for a factory in a date range.

    Mirrors Java SmartBiSalesDataRepository.findByFactoryIdAndOrderDateBetween.
    Module-level seam so contract tests can monkey-patch without standing up PG.
    """
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "alerts/sales: postgres not enabled; returning [] (factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT salesperson_name, amount, monthly_target "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
    with get_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()
```

- [ ] **Step 7: Run seam test**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py::test_query_sales_data_returns_empty_when_postgres_disabled -v`
Expected: PASS.

- [ ] **Step 8: Write failing tests for sales overall completion alert**

```python
def _build_alert_dict_keys():
    return [
        "id", "level", "category", "title", "message", "metric",
        "value", "threshold", "gapPercent", "suggestion",
        "relatedEntityId", "relatedEntityName", "createdAt",
    ]

def test_sales_completion_red_alert():
    """sum=600 / target=2000 = 30% → below red(60) → RED alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("600"),
                        monthly_target=Decimal("2000")),
    ]
    # Monkey-patch the seam
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    # Should produce 1 RED completion alert (and possibly growth alert if previous-month query returned [])
    completion = [a for a in alerts if a["title"] == "销售目标严重滞后"]
    assert len(completion) == 1
    a = completion[0]
    assert a["level"] == "RED"
    assert a["category"] == "sales"
    assert a["metric"] == "目标完成率"
    # value rounded to 1 decimal in title (Java: "%.1f%%"), but stored as scale 4 Decimal
    assert "30.0%" in a["message"]
    # All 13 keys must be present
    assert list(a.keys()) == _build_alert_dict_keys()


def test_sales_completion_yellow_alert():
    """rate=70% → red(60) <= rate < yellow(80) → YELLOW alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("700"),
                        monthly_target=Decimal("1000")),
    ]
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    completion = [a for a in alerts if "目标" in a["title"]]
    assert len(completion) == 1
    assert completion[0]["level"] == "YELLOW"


def test_sales_completion_no_alert_when_above_yellow():
    """rate=90% → above yellow(80) → no alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("900"),
                        monthly_target=Decimal("1000")),
    ]
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig
    assert all("目标" not in a["title"] for a in alerts)


def test_sales_empty_returns_empty_list():
    from smartbi_compat.api.analysis import _generate_sales_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_sales_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_sales_data = orig
```

- [ ] **Step 9: Implement `_generate_sales_alerts` overall completion section**

Add to `analysis.py`:
```python
import uuid
from datetime import datetime
from smartbi_compat.alert_thresholds import load_thresholds
from smartbi_compat.date_range import DateRange

_THRESHOLDS = load_thresholds()


def _new_alert_dict(
    *,
    level: str,
    category: str,
    title: str,
    message: str,
    metric: str,
    value: Decimal,
    threshold: Decimal,
    suggestion: str,
    related_entity_id: str | None = None,
    related_entity_name: str | None = None,
) -> dict:
    """Build a Java-shape Alert dict — 13 keys in Jackson order."""
    return {
        "id": str(uuid.uuid4()),
        "level": level,
        "category": category,
        "title": title,
        "message": message,
        "metric": metric,
        "value": value,
        "threshold": threshold,
        "gapPercent": None,
        "suggestion": suggestion,
        "relatedEntityId": related_entity_id,
        "relatedEntityName": related_entity_name,
        "createdAt": datetime.now().isoformat(),
    }


def _generate_sales_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateSalesAlerts (Java line 162-274)."""
    sales_data = _query_sales_data(factory_id, range_)
    if not sales_data:
        return []
    alerts: list[dict] = []
    th = _THRESHOLDS.sales

    # 1. Overall completion rate
    total_sales = _sum_field(sales_data, "amount")
    total_target = _sum_field(sales_data, "monthly_target")
    completion_rate = _calculate_rate(total_sales, total_target)

    if completion_rate < th.completion_red:
        alerts.append(_new_alert_dict(
            level="RED",
            category="sales",
            title="销售目标严重滞后",
            message=f"当前完成率仅为 {completion_rate:.1f}%，远低于预期",
            metric="目标完成率",
            value=completion_rate,
            threshold=th.completion_red,
            suggestion="建议立即召开销售会议，分析原因并制定追赶计划",
        ))
    elif completion_rate < th.completion_yellow:
        alerts.append(_new_alert_dict(
            level="YELLOW",
            category="sales",
            title="销售目标需加速",
            message=f"当前完成率为 {completion_rate:.1f}%，需要加快进度",
            metric="目标完成率",
            value=completion_rate,
            threshold=th.completion_yellow,
            suggestion="建议加强客户跟进，提高成交转化率",
        ))

    # TODO Step 11: growth rate alert
    # TODO Step 13: per-salesperson alerts
    return alerts
```

**Note**: the `TODO` markers above are scaffolding for the next TDD cycles in Steps 11/13 — they are NOT plan placeholders. Replace each TODO with real code in the indicated step.

- [ ] **Step 10: Run sales completion tests to verify they pass**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k "completion or sales_empty"`
Expected: 4 tests PASS.

- [ ] **Step 11: Write failing tests for sales growth rate alert**

```python
def test_sales_growth_rate_red_alert():
    """current=80, previous=100 → growth=-20% → red(-20) → RED alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data

    def fake_query(factory_id, range_):
        # Current month: 80; previous month: 100
        from datetime import date
        if range_.start_date.month == date.today().month:
            return [SimpleNamespace(salesperson_name=None,
                                    amount=Decimal("80"),
                                    monthly_target=Decimal("100"))]
        else:
            return [SimpleNamespace(salesperson_name=None,
                                    amount=Decimal("100"),
                                    monthly_target=Decimal("100"))]
    mod._query_sales_data = fake_query
    try:
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    growth = [a for a in alerts if a["title"] == "销售额大幅下降"]
    assert len(growth) == 1
    assert growth[0]["level"] == "RED"
```

- [ ] **Step 12: Implement growth rate alert**

In `_generate_sales_alerts`, replace the `# TODO Step 11` line with:

```python
    # 2. Month-over-month growth
    prev_start = _prev_month_start(range_.start_date)
    prev_end = _prev_month_end(range_.start_date)
    prev_range = DateRange(prev_start, prev_end)
    previous_data = _query_sales_data(factory_id, prev_range)
    if previous_data:
        previous_sales = _sum_field(previous_data, "amount")
        growth_rate = _calculate_growth_rate(total_sales, previous_sales)
        if growth_rate < th.growth_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="sales",
                title="销售额大幅下降",
                message=f"销售额环比下降 {abs(growth_rate):.1f}%，需紧急关注",
                metric="环比增长率",
                value=growth_rate,
                threshold=th.growth_red,
                suggestion="建议分析下降原因，检查是否存在市场变化或竞争加剧",
            ))
        elif growth_rate < th.growth_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="sales",
                title="销售额有所下降",
                message=f"销售额环比下降 {abs(growth_rate):.1f}%，需关注趋势",
                metric="环比增长率",
                value=growth_rate,
                threshold=th.growth_yellow,
                suggestion="建议分析原因，制定应对措施",
            ))
```

Add helper functions near `_calculate_growth_rate`:
```python
def _prev_month_start(current_start):
    """First day of the month before current_start."""
    if current_start.month == 1:
        return current_start.replace(year=current_start.year - 1, month=12)
    return current_start.replace(month=current_start.month - 1)


def _prev_month_end(current_start):
    """Last day of the month before current_start."""
    return current_start - timedelta(days=1)
```

(Add `from datetime import timedelta` to imports if not present.)

- [ ] **Step 13: Run growth tests**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k growth`
Expected: PASS.

- [ ] **Step 14: Write failing test for per-salesperson sort + threshold**

```python
def test_sales_per_salesperson_alerts_sorted_by_name():
    """Multiple salespeople below red threshold → alerts sorted alphabetically by name."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data

    rows = [
        SimpleNamespace(salesperson_name="王五", amount=Decimal("100"),
                        monthly_target=Decimal("10000")),
        SimpleNamespace(salesperson_name="李四", amount=Decimal("100"),
                        monthly_target=Decimal("10000")),
        SimpleNamespace(salesperson_name="张三", amount=Decimal("100"),
                        monthly_target=Decimal("10000")),
    ]
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    per_person = [a for a in alerts if a["relatedEntityName"] is not None]
    names = [a["relatedEntityName"] for a in per_person]
    # Python str sort on Chinese: 张/李/王 by unicode (匹配 Java TreeMap natural order)
    assert names == sorted(names)
    assert len(per_person) == 3  # all 3 below red threshold
```

- [ ] **Step 15: Implement per-salesperson alerts**

In `_generate_sales_alerts`, replace the `# TODO Step 13` line with:

```python
    # 3. Per-salesperson alerts (sorted by name to match Java TreeMap fix)
    per_person_sales: dict[str, Decimal] = {}
    per_person_target: dict[str, Decimal] = {}
    for d in sales_data:
        if d.salesperson_name is None:
            continue
        per_person_sales[d.salesperson_name] = (
            per_person_sales.get(d.salesperson_name, Decimal("0"))
            + (Decimal(str(d.amount)) if d.amount is not None else Decimal("0"))
        )
        per_person_target[d.salesperson_name] = (
            per_person_target.get(d.salesperson_name, Decimal("0"))
            + (Decimal(str(d.monthly_target)) if d.monthly_target is not None else Decimal("0"))
        )

    for name in sorted(per_person_sales.keys()):
        sales = per_person_sales[name]
        target = per_person_target.get(name, Decimal("0"))
        rate = _calculate_rate(sales, target)
        if rate < th.completion_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="sales",
                title=f"销售员 {name} 业绩预警",
                message=f"{name} 目标完成率仅为 {rate:.1f}%",
                metric="个人完成率",
                value=rate,
                threshold=th.completion_red,
                suggestion="建议一对一沟通，了解困难并提供支持",
                related_entity_name=name,
            ))
```

- [ ] **Step 16: Run all sales tests + verify no regressions**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v`
Expected: all sales tests PASS.

- [ ] **Step 17: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git status --short
git commit -m "feat(phase2a): port sales alert generator (3 alert types + helpers)" -- \
  backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git show --stat HEAD
```

---

### Task B2: Sales route handler + contract test + golden record

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py` (add route)
- Modify: `scripts/phase2a/record-java-golden.mjs` (add `alerts-sales` endpoint definition)
- Create: `scripts/phase2a/record-alerts-goldens.sh` (wrapper)
- Create: `tests/fixtures/java-smartbi-golden/alerts-F999-sales.json` (recorded)
- Create: `tests/python/smartbi_compat/test_alerts_contract.py`

- [ ] **Step 1: Add route handler in `analysis.py`**

```python
from typing import Optional
from smartbi_compat.schema_compat import wrap_response
from smartbi_compat.alert_thresholds import ALERT_SEVERITY


@router.get("/api/mobile/{factory_id}/smart-bi/alerts")
async def get_alerts(
    factory_id: str,
    category: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    range_ = DateRange.by_period("month")
    if category == "sales":
        alerts = _generate_sales_alerts(auth.factory_id, range_)
    elif category == "finance":
        # Implemented in Task C1
        alerts = []
    elif category == "department":
        # Implemented in Task D1
        alerts = []
    else:
        # Aggregator implemented in Task E1
        alerts = _generate_sales_alerts(auth.factory_id, range_)
    return wrap_response(alerts)
```

(`finance`/`department`/aggregator stubs return placeholder — replaced in later tasks. Sales-only is what we test in this commit.)

- [ ] **Step 2: Add `alerts-sales` endpoint to recorder**

In `scripts/phase2a/record-java-golden.mjs`, find the endpoint list (around the `endpoints = [` array — search `query-templates`). Add:
```js
{
  name: 'alerts-sales',
  path: '/api/mobile/{factory_id}/smart-bi/alerts',
  query: { category: 'sales' },
},
```

- [ ] **Step 3: Create the wrapper script**

```bash
cat > scripts/phase2a/record-alerts-goldens.sh << 'EOF'
#!/usr/bin/env bash
# Wraps record-java-golden.mjs with F999 + alert endpoint preset
set -euo pipefail
exec node "$(dirname "$0")/record-java-golden.mjs" \
  --base "${BASE_URL:-http://localhost:10011}" \
  --user phase2a_test_user \
  --password "${PHASE2A_TEST_USER_PASSWORD:?must set PHASE2A_TEST_USER_PASSWORD env var}" \
  --factory F999 \
  --endpoints "${ENDPOINTS:-alerts,alerts-sales,alerts-finance,alerts-department}"
EOF
chmod +x scripts/phase2a/record-alerts-goldens.sh
```

- [ ] **Step 4: Establish SSH tunnel + record sales golden**

```bash
ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
TUNNEL_PID=$!
sleep 2
export PHASE2A_TEST_USER_PASSWORD=<plaintext from .env.test>
ENDPOINTS=alerts-sales BASE_URL=http://localhost:10011 ./scripts/phase2a/record-alerts-goldens.sh
kill $TUNNEL_PID
```

Verify: `tests/fixtures/java-smartbi-golden/alerts-sales-F999.json` exists and contains expected envelope shape with non-empty `data` array.

- [ ] **Step 5: Write contract test scaffolding**

```python
# tests/python/smartbi_compat/test_alerts_contract.py
import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


# Resolve production main:app via absolute path (matches handoff pattern)
_REPO_ROOT = Path(__file__).resolve().parents[3]
_MAIN_PATH = _REPO_ROOT / "backend" / "python" / "main.py"


@pytest.fixture(scope="module")
def app():
    spec = importlib.util.spec_from_file_location("phase2a_main", _MAIN_PATH)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["phase2a_main"] = mod
    spec.loader.exec_module(mod)
    return mod.app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app)


@pytest.fixture(scope="module")
def jwt_token():
    """Stub JWT for F999 — the recorder script generates real ones; tests use HS256 with test secret."""
    import jwt
    secret = os.environ.get("JWT_SECRET", "cretas-jwt-secret-key-2026-test")
    payload = {"userId": 1, "username": "phase2a_test_user", "factoryId": "F999",
               "role": "factory_super_admin"}
    return jwt.encode(payload, secret, algorithm="HS256")


_GOLDEN_DIR = _REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"
_VOLATILE_KEYS = {"timestamp"}  # envelope-level
_ALERT_VOLATILE_KEYS = {"id", "createdAt"}  # per-alert


def _strip_volatile(obj):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in _VOLATILE_KEYS:
                continue
            if k == "data" and isinstance(v, list):
                out[k] = [_strip_alert_volatile(a) for a in v]
            else:
                out[k] = _strip_volatile(v)
        return out
    if isinstance(obj, list):
        return [_strip_volatile(x) for x in obj]
    return obj


def _strip_alert_volatile(alert: dict) -> dict:
    return {k: v for k, v in alert.items() if k not in _ALERT_VOLATILE_KEYS}


def test_alerts_sales_matches_golden(client, jwt_token, monkeypatch):
    # For deterministic mock: monkey-patch _query_sales_data to return what the golden was recorded against
    # (The DEMO_FACTORY seed copy under F999 — same data Java saw.)
    # Tests against PG-disabled mode would return [], which won't match; so this test runs against live PG
    # OR uses a fixture loader. For the chat 2 close-out, run against the test env directly:
    #   pytest -k test_alerts_sales --pg-live
    # For unit-style, use monkey-patch + fixture file.
    monkeypatch.setenv("POSTGRES_ENABLED", "true")  # adjust per environment

    headers = {"Authorization": f"Bearer {jwt_token}"}
    resp = client.get("/api/mobile/F999/smart-bi/alerts?category=sales", headers=headers)
    assert resp.status_code == 200

    actual = _strip_volatile(resp.json())
    expected = _strip_volatile(json.loads((_GOLDEN_DIR / "alerts-sales-F999.json").read_text(encoding="utf-8")))

    assert actual == expected
```

- [ ] **Step 6: Run contract test**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_alerts_contract.py::test_alerts_sales_matches_golden -v`
Expected: PASS (assuming PG enabled + F999 has seed data).

If PG disabled in CI: skip with marker `@pytest.mark.pg_live` and document in test docstring.

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis.py \
        scripts/phase2a/record-java-golden.mjs \
        scripts/phase2a/record-alerts-goldens.sh \
        tests/fixtures/java-smartbi-golden/alerts-sales-F999.json \
        tests/python/smartbi_compat/test_alerts_contract.py
git status --short
git commit -m "feat(phase2a): sales alerts route + contract test + golden" -- \
  backend/python/smartbi_compat/api/analysis.py \
  scripts/phase2a/record-java-golden.mjs \
  scripts/phase2a/record-alerts-goldens.sh \
  tests/fixtures/java-smartbi-golden/alerts-sales-F999.json \
  tests/python/smartbi_compat/test_alerts_contract.py
git show --stat HEAD
```

---

### Task B3: F999 ADR

**Files:**
- Create: `docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md`

- [ ] **Step 1: Write the ADR document**

```markdown
# ADR: Phase 2A Synthetic Test Factory F999

| Status | Accepted (2026-04-29) |
|---|---|
| Deciders | stevenj4xie |
| Spec | docs/superpowers/specs/2026-04-29-alerts-full-port-design.md |
| Plan | docs/superpowers/plans/2026-04-29-alerts-full-port.md |

## Context

Phase 2A ports 50 Java SmartBI endpoints to Python aliases for byte-shape parity. Roughly 10 of those endpoints are backed by 1000+ LOC services that emit non-trivial responses on factories with smart_bi_*_data populated. Recording byte-shape goldens against an empty factory produces uselessly empty responses; recording against a real production factory produces unstable goldens that drift with prod data changes.

We need a stable, deterministic test factory that:
1. Has factory entity (so JWT login succeeds + RLS doesn't block)
2. Has smart_bi_sales_data, smart_bi_finance_data, smart_bi_department_data populated with deterministic content
3. Stays stable across prod data changes
4. Is recorder-accessible from CI/dev

## Alternatives considered

### Option 1 — Reuse F001
F001 is the existing PoC test factory but has no smart_bi_*_data seed. Adding seed via new migration would pollute F001's other tests (F001 carries real production-shape fixtures elsewhere). **Rejected**.

### Option 2 — Reuse `DEMO_FACTORY`
Java's V2026_01_18_02 migration already seeds `DEMO_FACTORY` with rich smart_bi data. But there is no row in the `factories` table with `id='DEMO_FACTORY'` — Java's auth/RLS rejects logins for unknown factories. The `SmartBIPublicDemoController` uses constant `F_DEMO` (mismatch with the seed migration's `DEMO_FACTORY`), suggesting the demo path was orphaned. **Rejected** without a fix to this Java-side inconsistency, which is out of scope.

### Option 3 — Promote `DEMO_FACTORY` to real factory entity
Add 1 migration inserting `('DEMO_FACTORY', ...)` into `factories`. Cheaper than Option 4, but conflates the long-standing Java demo bug with our test fixture choice. Surfaces in prod cleanup later.

### Option 4 — Synthetic F999 (chosen)
New migration creates a clean, purpose-named test factory. Reuses DEMO_FACTORY's seed data via `INSERT ... SELECT` (no fixture re-authoring). Test user with env-injected password hash that defaults to `DISABLED` in prod. Future Phase 2A endpoints that need factory data extend F999's seed via per-endpoint migrations.

## Decision

Adopt **Option 4: synthetic F999 test factory**.

- Migration `V20260430_01__phase2a_test_factory_F999.sql`
- Test user `phase2a_test_user` with `password_hash='${PHASE2A_TEST_USER_PASSWORD_HASH}'` (Flyway placeholder, env-injected)
- `.env.test` sets a real bcrypt hash; `.env.prod` sets `DISABLED` to render the user un-loginable in production
- Seed data is `INSERT ... SELECT` from `DEMO_FACTORY` rows in `smart_bi_sales_data`, `smart_bi_finance_data`, `smart_bi_department_data`, `smart_bi_billing_config`

## Consequences

### Positive
- Deterministic goldens — F999 data shape never drifts with prod changes
- Reusable across remaining Phase 2A endpoints (procurement / region / department / sales / finance / production / quality / inventory analyses)
- ~150 LOC of migration vs ~1000 LOC of fresh fixture authoring
- F999 ADR clarifies the precedent so the next 10+ endpoints don't re-debate the choice

### Negative
- F999 is created in prod database too (Flyway runs all environments). Mitigated by `password_hash=DISABLED` in `.env.prod`.
- DEMO_FACTORY pollution remains unfixed (separate Phase 3 ADR)
- F999 cleanup migration needed at T6 cutover close (delete F999 + its data) — tracked as Phase 2A close-out task

### Future endpoint extension pattern

For an endpoint that needs F999 to have additional data (e.g. `/analysis/procurement` reading `smart_bi_purchase_data`), add a new migration:

```sql
-- V<date>__phase2a_F999_<table>_seed.sql
INSERT INTO smart_bi_<table> (factory_id, ...)
SELECT 'F999', ...
FROM smart_bi_<table>
WHERE factory_id = 'DEMO_FACTORY'
ON CONFLICT DO NOTHING;
```

Then re-record that endpoint's golden against F999.
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/adr
git add docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md
git status --short
git commit -m "docs(phase2a): F999 synthetic test factory ADR" -- \
  docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md
git show --stat HEAD
```

---

**Chat 2 close**: at this point, sales alerts ship end-to-end (Java sort + threshold bundle + F999 + Python port + contract test + golden + ADR). Run `superpowers:verification-before-completion` to green the milestone before chat 3.

---

## Phase C — Finance generator (chat 3 start)

### Task C1: Finance generator port (TDD, 3 alert types)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py` (add finance seam + generator)
- Modify: `tests/python/smartbi_compat/test_alerts_logic.py` (add finance tests)

- [ ] **Step 1: Write failing test for `_query_finance_data` seam**

```python
def test_query_finance_data_returns_empty_when_postgres_disabled(monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "false")
    from smartbi_compat.api.analysis import _query_finance_data
    from smartbi_compat.date_range import DateRange
    assert _query_finance_data("F999", DateRange.by_period("month")) == []
```

- [ ] **Step 2: Implement `_query_finance_data` seam**

Add to `analysis.py` (after `_query_sales_data`):
```python
def _query_finance_data(factory_id: str, range_) -> list:
    """Mirror SmartBiFinanceDataRepository.findByFactoryIdAndRecordDateBetween."""
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning("alerts/finance: postgres not enabled (factory_id=%s)", factory_id)
        return []

    sql = text(
        "SELECT customer_name, receivable_amount, aging_days, "
        "       budget_amount, actual_amount "
        "FROM smart_bi_finance_data "
        "WHERE factory_id = :fid AND record_date BETWEEN :start AND :end"
    )
    with get_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()
```

- [ ] **Step 3: Write failing tests for 3 finance alert types**

```python
def test_finance_aging_red_alert():
    """receivable=5000, aging=100 days → > red(90) → RED alert per record."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name="客户A", receivable_amount=Decimal("5000"),
                        aging_days=100, budget_amount=None, actual_amount=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    aging = [a for a in alerts if a["title"] == "应收账款严重逾期"]
    assert len(aging) == 1
    assert aging[0]["level"] == "RED"
    assert "客户A" in aging[0]["message"]


def test_finance_cost_variance_red_alert():
    """budget=100, actual=150 → variance=50% > red(20) → RED alert."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name=None, receivable_amount=None, aging_days=None,
                        budget_amount=Decimal("100"), actual_amount=Decimal("150")),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    variance = [a for a in alerts if a["title"] == "成本严重超支"]
    assert len(variance) == 1
    assert variance[0]["level"] == "RED"


def test_finance_large_receivable_red_alert():
    """sum(receivable) > red(1,000,000) → RED alert."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name="客户B", receivable_amount=Decimal("1500000"),
                        aging_days=10, budget_amount=None, actual_amount=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    total = [a for a in alerts if a["title"] == "应收账款总额过高"]
    assert len(total) == 1
    assert total[0]["level"] == "RED"


def test_finance_empty_returns_empty():
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_finance_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_finance_data = orig
```

- [ ] **Step 4: Run finance tests to verify they fail**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k finance`
Expected: ImportError on `_generate_finance_alerts`.

- [ ] **Step 5: Implement `_generate_finance_alerts`**

Add to `analysis.py`:
```python
def _generate_finance_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateFinanceAlerts (Java line 278-376)."""
    finance_data = _query_finance_data(factory_id, range_)
    if not finance_data:
        return []
    alerts: list[dict] = []
    th = _THRESHOLDS.finance

    # 1. Per-receivable aging alerts (List iteration — already stable)
    for d in finance_data:
        receivable = Decimal(str(d.receivable_amount)) if d.receivable_amount is not None else Decimal("0")
        if receivable <= 0:
            continue
        aging = d.aging_days if d.aging_days is not None else 0

        if aging > th.aging_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="finance",
                title="应收账款严重逾期",
                message=f"客户 {d.customer_name} 应收款 {receivable:.2f} 元已逾期 {aging} 天",
                metric="账龄天数",
                value=Decimal(aging),
                threshold=Decimal(th.aging_red),
                suggestion="建议立即联系客户催收，必要时采取法律手段",
            ))
        elif aging > th.aging_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="finance",
                title="应收账款即将逾期",
                message=f"客户 {d.customer_name} 应收款 {receivable:.2f} 元账龄已达 {aging} 天",
                metric="账龄天数",
                value=Decimal(aging),
                threshold=Decimal(th.aging_yellow),
                suggestion="建议跟进客户付款计划，发送催款提醒",
            ))

    # 2. Cost over-budget (max 1 alert)
    total_budget = _sum_field(finance_data, "budget_amount")
    total_actual = _sum_field(finance_data, "actual_amount")
    if total_budget > 0:
        variance = _calculate_growth_rate(total_actual, total_budget)
        if variance > th.cost_variance_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="finance",
                title="成本严重超支",
                message=f"实际支出超预算 {variance:.1f}%，需严格控制",
                metric="预算偏差率",
                value=variance,
                threshold=th.cost_variance_red,
                suggestion="建议立即审查各项支出，暂停非必要开支",
            ))
        elif variance > th.cost_variance_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="finance",
                title="成本有所超支",
                message=f"实际支出超预算 {variance:.1f}%，需关注",
                metric="预算偏差率",
                value=variance,
                threshold=th.cost_variance_yellow,
                suggestion="建议优化支出结构，控制成本增长",
            ))

    # 3. Large receivable total (max 1 alert)
    total_receivable = _sum_field(finance_data, "receivable_amount")
    if total_receivable > th.amount_red:
        alerts.append(_new_alert_dict(
            level="RED",
            category="finance",
            title="应收账款总额过高",
            message=f"应收账款总额达 {total_receivable:.2f} 元，资金压力大",
            metric="应收总额",
            value=total_receivable,
            threshold=th.amount_red,
            suggestion="建议制定催收计划，加速资金回笼",
        ))
    elif total_receivable > th.amount_yellow:
        alerts.append(_new_alert_dict(
            level="YELLOW",
            category="finance",
            title="应收账款总额较高",
            message=f"应收账款总额达 {total_receivable:.2f} 元，需关注回款",
            metric="应收总额",
            value=total_receivable,
            threshold=th.amount_yellow,
            suggestion="建议加强应收账款管理，定期跟进回款",
        ))

    return alerts
```

- [ ] **Step 6: Run finance tests to verify they pass**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k finance`
Expected: 4 finance tests PASS.

- [ ] **Step 7: Wire finance into route handler**

Modify the `get_alerts` route (added in Task B2) — replace `# Implemented in Task C1` stub with:
```python
    elif category == "finance":
        alerts = _generate_finance_alerts(auth.factory_id, range_)
```

- [ ] **Step 8: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git status --short
git commit -m "feat(phase2a): port finance alert generator (3 alert types)" -- \
  backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git show --stat HEAD
```

---

### Task C2: Finance contract test + golden

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/alerts-finance-F999.json`
- Modify: `tests/python/smartbi_compat/test_alerts_contract.py` (add finance test)

- [ ] **Step 1: Add `alerts-finance` to recorder endpoint list**

In `scripts/phase2a/record-java-golden.mjs`, add:
```js
{
  name: 'alerts-finance',
  path: '/api/mobile/{factory_id}/smart-bi/alerts',
  query: { category: 'finance' },
},
```

- [ ] **Step 2: Record finance golden**

```bash
ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
TUNNEL_PID=$!
sleep 2
ENDPOINTS=alerts-finance ./scripts/phase2a/record-alerts-goldens.sh
kill $TUNNEL_PID
```

Verify: `tests/fixtures/java-smartbi-golden/alerts-finance-F999.json` exists.

- [ ] **Step 3: Add contract test for finance**

In `test_alerts_contract.py`, add:
```python
def test_alerts_finance_matches_golden(client, jwt_token, monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "true")
    headers = {"Authorization": f"Bearer {jwt_token}"}
    resp = client.get("/api/mobile/F999/smart-bi/alerts?category=finance", headers=headers)
    assert resp.status_code == 200
    actual = _strip_volatile(resp.json())
    expected = _strip_volatile(json.loads(
        (_GOLDEN_DIR / "alerts-finance-F999.json").read_text(encoding="utf-8")
    ))
    assert actual == expected
```

- [ ] **Step 4: Run contract test**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_contract.py::test_alerts_finance_matches_golden -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/phase2a/record-java-golden.mjs \
        tests/fixtures/java-smartbi-golden/alerts-finance-F999.json \
        tests/python/smartbi_compat/test_alerts_contract.py
git status --short
git commit -m "test(phase2a): finance alerts contract + golden" -- \
  scripts/phase2a/record-java-golden.mjs \
  tests/fixtures/java-smartbi-golden/alerts-finance-F999.json \
  tests/python/smartbi_compat/test_alerts_contract.py
git show --stat HEAD
```

---

## Phase D — Department generator

### Task D1: Department generator port (TDD, 1 alert type with sort)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py`
- Modify: `tests/python/smartbi_compat/test_alerts_logic.py`

- [ ] **Step 1: Write failing tests**

```python
def test_query_department_data_returns_empty_when_postgres_disabled(monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "false")
    from smartbi_compat.api.analysis import _query_department_data
    from smartbi_compat.date_range import DateRange
    assert _query_department_data("F999", DateRange.by_period("month")) == []


def test_department_per_capita_red_alert():
    """sales=10, headcount=1 → per_capita=10 < red(50000) → RED."""
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    rows = [SimpleNamespace(department="研发部", sales_amount=Decimal("10"), headcount=1)]
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_department_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_department_data = orig

    assert len(alerts) == 1
    assert alerts[0]["level"] == "RED"
    assert "研发部" in alerts[0]["title"]


def test_department_alerts_sorted_by_name():
    """Multiple departments → output sorted alphabetically."""
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(department="销售部", sales_amount=Decimal("10"), headcount=1),
        SimpleNamespace(department="研发部", sales_amount=Decimal("10"), headcount=1),
        SimpleNamespace(department="行政部", sales_amount=Decimal("10"), headcount=1),
    ]
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_department_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_department_data = orig

    titles = [a["title"] for a in alerts]
    departments = [t.split()[0] for t in titles]  # title format: "X 人均产出过低"
    assert departments == sorted(departments)


def test_department_empty_returns_empty():
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_department_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_department_data = orig
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k department`
Expected: ImportError.

- [ ] **Step 3: Implement seam + generator**

Add to `analysis.py`:
```python
def _query_department_data(factory_id: str, range_) -> list:
    from smartbi.database.connection import get_db_context, is_postgres_enabled
    if not is_postgres_enabled():
        logger.warning("alerts/department: postgres not enabled (factory_id=%s)", factory_id)
        return []
    sql = text(
        "SELECT department, sales_amount, headcount "
        "FROM smart_bi_department_data "
        "WHERE factory_id = :fid AND record_date BETWEEN :start AND :end"
    )
    with get_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()


def _generate_department_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateDepartmentAlerts (Java line 380-434)."""
    dept_data = _query_department_data(factory_id, range_)
    if not dept_data:
        return []
    alerts: list[dict] = []
    th = _THRESHOLDS.department

    # Group by department (sorted by name to match Java TreeMap fix)
    by_dept: dict[str, list] = {}
    for d in dept_data:
        if d.department is None:
            continue
        by_dept.setdefault(d.department, []).append(d)

    for dept_name in sorted(by_dept.keys()):
        rows = by_dept[dept_name]
        total_sales = _sum_field(rows, "sales_amount")
        headcount_max = max(
            (r.headcount for r in rows if r.headcount is not None),
            default=1,
        )
        if headcount_max <= 0:
            continue
        per_capita = (total_sales / Decimal(headcount_max)).quantize(
            _SCALE_4, rounding=ROUND_HALF_UP
        )

        if per_capita < th.per_capita_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="department",
                title=f"{dept_name} 人均产出过低",
                message=f"{dept_name} 人均销售额仅为 {per_capita:.2f} 元，严重低于标准",
                metric="人均产出",
                value=per_capita,
                threshold=th.per_capita_red,
                suggestion="建议分析人员效能，考虑调整人员配置或加强培训",
            ))
        elif per_capita < th.per_capita_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="department",
                title=f"{dept_name} 人均产出偏低",
                message=f"{dept_name} 人均销售额为 {per_capita:.2f} 元，低于期望",
                metric="人均产出",
                value=per_capita,
                threshold=th.per_capita_yellow,
                suggestion="建议提升人员效率，优化工作流程",
            ))

    return alerts
```

- [ ] **Step 4: Run department tests to verify they pass**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k department`
Expected: 4 tests PASS.

- [ ] **Step 5: Wire department into route handler**

In `get_alerts`, replace `# Implemented in Task D1` stub:
```python
    elif category == "department":
        alerts = _generate_department_alerts(auth.factory_id, range_)
```

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git commit -m "feat(phase2a): port department alert generator (1 alert type, sorted)" -- \
  backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git show --stat HEAD
```

---

### Task D2: Department contract test + golden

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/alerts-department-F999.json`
- Modify: `tests/python/smartbi_compat/test_alerts_contract.py`

- [ ] **Step 1: Add `alerts-department` endpoint definition to recorder**

```js
{
  name: 'alerts-department',
  path: '/api/mobile/{factory_id}/smart-bi/alerts',
  query: { category: 'department' },
},
```

- [ ] **Step 2: Record department golden**

```bash
ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
TUNNEL_PID=$!
sleep 2
ENDPOINTS=alerts-department ./scripts/phase2a/record-alerts-goldens.sh
kill $TUNNEL_PID
```

- [ ] **Step 3: Add contract test**

```python
def test_alerts_department_matches_golden(client, jwt_token, monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "true")
    headers = {"Authorization": f"Bearer {jwt_token}"}
    resp = client.get("/api/mobile/F999/smart-bi/alerts?category=department", headers=headers)
    assert resp.status_code == 200
    actual = _strip_volatile(resp.json())
    expected = _strip_volatile(json.loads(
        (_GOLDEN_DIR / "alerts-department-F999.json").read_text(encoding="utf-8")
    ))
    assert actual == expected
```

- [ ] **Step 4: Run contract test**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_contract.py::test_alerts_department_matches_golden -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/phase2a/record-java-golden.mjs \
        tests/fixtures/java-smartbi-golden/alerts-department-F999.json \
        tests/python/smartbi_compat/test_alerts_contract.py
git commit -m "test(phase2a): department alerts contract + golden" -- \
  scripts/phase2a/record-java-golden.mjs \
  tests/fixtures/java-smartbi-golden/alerts-department-F999.json \
  tests/python/smartbi_compat/test_alerts_contract.py
git show --stat HEAD
```

---

## Phase E — Aggregator + 4-way route + close-out

### Task E1: Aggregator port + 4-way route

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py`
- Modify: `tests/python/smartbi_compat/test_alerts_logic.py`

- [ ] **Step 1: Write failing tests for aggregator**

```python
def test_aggregator_concat_and_sort_by_severity():
    """All 3 generators contribute → output sorted by severity DESC, stable within ties."""
    from smartbi_compat.api.analysis import _generate_all_alerts
    import smartbi_compat.api.analysis as mod
    sales_rows = [SimpleNamespace(salesperson_name=None, amount=Decimal("100"),
                                  monthly_target=Decimal("1000"))]  # YELLOW completion
    finance_rows = [SimpleNamespace(customer_name="X", receivable_amount=Decimal("5000"),
                                    aging_days=100, budget_amount=None, actual_amount=None)]  # RED aging
    dept_rows = [SimpleNamespace(department="研发部", sales_amount=Decimal("10"),
                                 headcount=1)]  # RED per-capita
    orig_s = mod._query_sales_data
    orig_f = mod._query_finance_data
    orig_d = mod._query_department_data
    mod._query_sales_data = lambda f, r: sales_rows if r.start_date.day == 1 else []
    mod._query_finance_data = lambda f, r: finance_rows
    mod._query_department_data = lambda f, r: dept_rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_all_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig_s
        mod._query_finance_data = orig_f
        mod._query_department_data = orig_d

    levels = [a["level"] for a in alerts]
    # All RED before any YELLOW
    last_red_idx = max((i for i, l in enumerate(levels) if l == "RED"), default=-1)
    first_yellow_idx = next((i for i, l in enumerate(levels) if l == "YELLOW"), len(levels))
    assert last_red_idx < first_yellow_idx


def test_aggregator_empty_when_all_generators_empty():
    from smartbi_compat.api.analysis import _generate_all_alerts
    import smartbi_compat.api.analysis as mod
    orig_s = mod._query_sales_data
    orig_f = mod._query_finance_data
    orig_d = mod._query_department_data
    mod._query_sales_data = lambda f, r: []
    mod._query_finance_data = lambda f, r: []
    mod._query_department_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_all_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_sales_data = orig_s
        mod._query_finance_data = orig_f
        mod._query_department_data = orig_d
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k aggregator`
Expected: ImportError.

- [ ] **Step 3: Implement aggregator**

Add to `analysis.py`:
```python
def _generate_all_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateAllAlerts (Java line 438-454)."""
    all_alerts: list[dict] = []
    all_alerts.extend(_generate_sales_alerts(factory_id, range_))
    all_alerts.extend(_generate_finance_alerts(factory_id, range_))
    all_alerts.extend(_generate_department_alerts(factory_id, range_))
    # Sort by severity DESC; stable sort preserves within-severity insertion order
    all_alerts.sort(key=lambda a: -ALERT_SEVERITY[a["level"]])
    return all_alerts
```

- [ ] **Step 4: Wire aggregator into default route branch**

In `get_alerts`, replace the previous sales-only fallback with:
```python
    else:
        alerts = _generate_all_alerts(auth.factory_id, range_)
```

- [ ] **Step 5: Run aggregator tests**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v -k aggregator`
Expected: 2 PASS.

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `python -m pytest ../../tests/python/smartbi_compat/ -v`
Expected: all tests PASS (sales + finance + department + aggregator + threshold + date_range = ~25-30 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git commit -m "feat(phase2a): /alerts aggregator + 4-way route dispatch" -- \
  backend/python/smartbi_compat/api/analysis.py tests/python/smartbi_compat/test_alerts_logic.py
git show --stat HEAD
```

---

### Task E2: Aggregator contract test + golden

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/alerts-F999.json`
- Modify: `tests/python/smartbi_compat/test_alerts_contract.py`

- [ ] **Step 1: Add `alerts` (default) endpoint definition to recorder**

```js
{
  name: 'alerts',
  path: '/api/mobile/{factory_id}/smart-bi/alerts',
},
```

- [ ] **Step 2: Record aggregator golden (4-way includes aggregator + re-records 3 categories for consistency)**

```bash
ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
TUNNEL_PID=$!
sleep 2
./scripts/phase2a/record-alerts-goldens.sh   # records all 4 (default ENDPOINTS)
kill $TUNNEL_PID
```

- [ ] **Step 3: Add contract test for aggregator**

```python
def test_alerts_aggregator_matches_golden(client, jwt_token, monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "true")
    headers = {"Authorization": f"Bearer {jwt_token}"}
    resp = client.get("/api/mobile/F999/smart-bi/alerts", headers=headers)  # no ?category
    assert resp.status_code == 200
    actual = _strip_volatile(resp.json())
    expected = _strip_volatile(json.loads(
        (_GOLDEN_DIR / "alerts-F999.json").read_text(encoding="utf-8")
    ))
    assert actual == expected
```

- [ ] **Step 4: Run all 4 contract tests + verify all pass**

Run: `python -m pytest ../../tests/python/smartbi_compat/test_alerts_contract.py -v`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/phase2a/record-java-golden.mjs \
        tests/fixtures/java-smartbi-golden/alerts-F999.json \
        tests/python/smartbi_compat/test_alerts_contract.py
git commit -m "test(phase2a): aggregator alerts contract + golden (4-way complete)" -- \
  scripts/phase2a/record-java-golden.mjs \
  tests/fixtures/java-smartbi-golden/alerts-F999.json \
  tests/python/smartbi_compat/test_alerts_contract.py
git show --stat HEAD
```

---

### Task E3: Phase 2A progress writeback + chat 3 close-out

**Files:**
- Modify: `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md`

- [ ] **Step 1: Tally actual hours spent**

Compute total wallclock from chat 2 + chat 3 git log (first F999 migration commit → final aggregator contract commit).

- [ ] **Step 2: Update deferred plan §4 with calibration data**

Append to `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md` §4:

```markdown
### Calibration data (2026-04-29 — `/alerts` marathon close-out)

Actual time for the `/alerts` full port:
- Foundation (F999 ADR + migration + threshold bundle + Java sort + Python loader + date_range): **X.X hours**
- Sales generator + contract + golden: **X.X hours**
- Finance generator + contract + golden: **X.X hours**
- Department generator + contract + golden: **X.X hours**
- Aggregator + 4-way contract + golden: **X.X hours**
- **Total**: X.X hours over Y commits across 2 chats

T0 had estimated `/alerts` at 1 week (~40 hours). Actual: ~X hours.
**Calibration factor**: 40/X = ~Yx (apply to remaining analysis-subdomain endpoints).

Refined estimates for analysis subdomain:
- /recommendations: ~X * (1 + 0.2 surplus for additional generators) = X.X hours
- /analysis/procurement: 1144 LOC service / sales-gen 250 LOC ratio × X hours = X.X hours
- /analysis/region: same scaling
- ...
```

(Replace X.X placeholders with actual measurements.)

- [ ] **Step 3: Run final 4-way smoke against test env**

```bash
F999_TOKEN=$(curl -s -X POST http://47.100.235.168:10011/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"phase2a_test_user\",\"password\":\"$PHASE2A_TEST_USER_PASSWORD\"}" \
  | jq -r '.data.accessToken')

# 4-way smoke against PYTHON port (8084 — Python test env)
for variant in "" "?category=sales" "?category=finance" "?category=department"; do
  echo "Variant: $variant"
  curl -s -H "Authorization: Bearer $F999_TOKEN" \
    "http://47.100.235.168:8084/api/mobile/F999/smart-bi/alerts$variant" \
    | jq '.data | length'
done
```

Expected: 4 numbers (default = sum of 3 categories), all non-zero.

- [ ] **Step 4: Commit calibration writeback**

```bash
git add docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md
git commit -m "docs(phase2a): /alerts marathon close-out + Phase 2A calibration data" -- \
  docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md
git show --stat HEAD
```

- [ ] **Step 5: Run `superpowers:requesting-code-review` skill on full diff**

Branch: `phase2a/t5-poc` vs `origin/main`. Verify all marathon commits pass review (no scope creep, no anti-pattern, no missed test).

- [ ] **Step 6: Write end-of-marathon handoff doc**

Create `docs/superpowers/handoff/2026-04-29-phase2a-alerts-handoff.md` with:
- All commits + line counts
- Lessons learned (Java sort fix surprises, BigDecimal serialization mechanism choice, F999 cleanup deferred items)
- Next-up endpoint candidates ranked by reuse of foundation (procurement / region / recommendations)
- Final Phase 2A counter: 3 → 7 of 50

---

## Self-review

Quick check against spec sections:

| Spec section | Plan task |
|---|---|
| §3.1 Module placement | Tasks A4/A5/B1 (analysis.py grows; new files alert_thresholds.py / date_range.py / config/) |
| §3.2 Threshold loader + CI guard | Tasks A3 + A4 |
| §3.3 F999 foundation | Task A1 |
| §3.4 F999 password handling | Task A1 step 3 |
| §3.5 Java sort fix | Task A2 |
| §3.6 Recorder updates | Tasks B2 step 2 + C2 step 1 + D2 step 1 + E2 step 1 |
| §4.1 Common pattern | Tasks B1/C1/D1 (each generator follows same structure) |
| §4.2 Sales generator | Task B1 |
| §4.3 Finance generator | Task C1 |
| §4.4 Department generator | Task D1 |
| §4.5 Aggregator | Task E1 |
| §4.6 Route signature | Tasks B2 step 1 + C1 step 7 + D1 step 5 + E1 step 4 |
| §4.7 DateRange | Task A5 |
| §4.8 Byte-shape contract | Tasks B1/C1/D1 helpers + contract tests |
| §4.9 BigDecimal serialization | Implicit in `_new_alert_dict` (Decimal stored directly; FastAPI/simplejson handles serialization). Verify in Task B2 step 6 contract test fails if scale loses (covers risk §7 row 1). |
| §4.10 Helper utilities | Task B1 step 3 |
| §5.1 Java unit tests | Task A2 |
| §5.2 Python contract tests | Tasks B2 + C2 + D2 + E2 |
| §5.3 Python unit tests | Tasks B1/C1/D1/E1 (interleaved with each generator's TDD) |
| §5.4 Golden recording | Tasks B2/C2/D2/E2 (each phase records its own golden) |
| §6 Plan structure | This document |
| §7 Risks | Test cases address each: BigDecimal scale (B2 step 6), DateRange boundary (A5 step 1 month boundary tests), AlertLevel.severity (A4 step 1 test), F999 prod password (A1 step 3 DISABLED hash) |
| §8 Open items | All deferred — no plan task |
| §10 Acceptance criteria | All 8 items covered by E2 + E3 |

**Placeholder scan**: searched for "TBD/TODO/XXX/FIXME" — only legitimate `# TODO Step 11/13` markers in the sales generator scaffolding (these are TDD placeholders that get replaced in named steps, not plan placeholders).

**Type consistency**:
- `_query_sales_data`/`_query_finance_data`/`_query_department_data` — consistent return type (`list`)
- `_generate_<X>_alerts` — consistent signature `(factory_id: str, range_: DateRange) -> list[dict]`
- Alert dict keys — same 13-key shape via `_new_alert_dict` helper everywhere
- Threshold dataclasses — `Decimal` for monetary/rate values; `int` for `aging_red`/`aging_yellow`

**Spec gap check**: §7 row 9 (HashMap fixture observability) — Java tests in Task A2 use 3-element fixtures with reverse-alphabetical insertion order. This is the standard "if HashMap reorders the same way as TreeMap, test passes spuriously" risk. Mitigation: the test asserts `containsExactly` lex-sorted, which differs from any HashMap iteration order on the chosen Chinese names (verified by manual hash check during chat 2 step 5).

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-29-alerts-full-port.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task in chat 2 (Phase A + B), review between tasks, then chat 3 for Phase C/D/E. Fast iteration, isolated context per task.

2. **Inline Execution** — execute tasks in chat 2/3 sessions using `superpowers:executing-plans`, batch execution with checkpoints for review.

**This chat is locked at "spec + plan only" (Q1 decision)** — no implementation tonight. Pick the mode at the start of chat 2.
