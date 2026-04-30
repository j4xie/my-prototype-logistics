# Phase 2A `/analysis/sales` Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay foundation for Phase 2A `/analysis/sales` endpoint port — new `analysis_sales.py` module with route + composite + 5 async sub-service stubs + 5 DTO dict factories + DateRange port + F999 contract test gate.

**Architecture:** Add a dedicated `backend/python/smartbi_compat/api/analysis_sales.py` module (parallel to existing `analysis.py` for alerts/recommendations). All sub-services are `async def` to allow gold spec to `await` Gold queries. F999 byte-shape contract test gates merge — sibling specs (overview/rankings/trend/gold) replace stub bodies one at a time on top of foundation.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy text() + pytest + Lombok-generated Java DTO contracts (javap reference)

**Spec reference:** `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md`

**Sibling specs (DEFERRED to their own chats):** overview / rankings / trend / gold

---

## Pre-flight check

Before starting Task A.1, confirm:

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
pwd  # Must be the worktree, NOT main repo
git rev-parse --abbrev-ref HEAD  # Must be: phase2a/t5-poc
git log --oneline -1  # Most recent: 015d464b3 docs(phase2a): lock Q8=yes
git status --short  # Must be clean
```

Expected output:
```
/c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
phase2a/t5-poc
015d464b3 docs(phase2a): lock Q8=yes (calibration goldens approved)
(no output — clean)
```

If any check fails, STOP and reconcile before proceeding.

---

## Phase A — Pre-impl verification & DTO discovery

### Task A.1: Verify F001 has Gold-path data + legacy SQL is empty

**Files:** read-only, no edits

- [ ] **Step 1: Run psql query to confirm Gold projection has F001 data**

```bash
ssh root@47.100.235.168 "psql -U postgres -d smartbi_db -t -c \"SELECT COUNT(*) FROM agg_daily WHERE factory_id='F001' AND date BETWEEN '2025-01-01' AND '2025-12-31'\""
```

Expected: a positive integer (e.g. `365` or similar). If `0`, escalate — F001 Gold projection isn't populated, gold spec depends on this.

- [ ] **Step 2: Run psql query to confirm legacy `smart_bi_sales_data` has 0 rows in F001 2025 window**

```bash
ssh root@47.100.235.168 "psql -U postgres -d smartbi_db -t -c \"SELECT COUNT(*) FROM smart_bi_sales_data WHERE factory_id='F001' AND order_date BETWEEN '2025-01-01' AND '2025-12-31'\""
```

Expected: `0`. This confirms F001 golden's empty top-level rankings/trendChart fields. If non-zero, foundation R5/R12 assumptions need re-examination.

- [ ] **Step 3: Save findings as a reference comment**

No code changes — these queries set context for sibling specs. Log the actual numbers in your task notes if executing inline.

---

### Task A.2: Verify DateRange Python class has `days` / `valid` derived getters

**Files:**
- Read: `backend/python/smartbi_compat/date_range.py`

- [ ] **Step 1: Read DateRange Python class**

```bash
grep -n -E '(def |class |@property)' backend/python/smartbi_compat/date_range.py | head -40
```

Look for: `class DateRange`, `def days`, `def valid`, plus `start_date / end_date / granularity / original_expression / relative` attributes.

- [ ] **Step 2: Run inline Python check**

```bash
python3 -c "
import sys
sys.path.insert(0, 'backend/python')
from smartbi_compat.date_range import DateRange
from datetime import date
r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
print('start_date:', r.start_date)
print('end_date:', r.end_date)
print('granularity:', getattr(r, 'granularity', 'MISSING'))
print('original_expression:', getattr(r, 'original_expression', 'MISSING'))
print('relative:', getattr(r, 'relative', 'MISSING'))
print('days:', getattr(r, 'days', 'MISSING'))
print('valid:', getattr(r, 'valid', 'MISSING'))
"
```

Expected: all values printed (no `MISSING`). If `days` or `valid` is missing, add to Task B.0 backlog.

- [ ] **Step 3: If `days` / `valid` missing, add them to date_range.py**

Read full DateRange class first:

```bash
grep -n 'class DateRange' backend/python/smartbi_compat/date_range.py
```

Then if missing, add these properties to the class:

```python
@property
def days(self) -> int:
    """Inclusive day count between start_date and end_date."""
    return (self.end_date - self.start_date).days + 1

@property
def valid(self) -> bool:
    """True iff start_date <= end_date."""
    return self.start_date <= self.end_date
```

If both are present, skip this step.

- [ ] **Step 4: Commit if changes were made**

```bash
git add backend/python/smartbi_compat/date_range.py
git status --short
git commit -m "feat(phase2a): add days/valid derived properties to DateRange" -- backend/python/smartbi_compat/date_range.py
```

Skip if no changes.

---

### Task A.3: javap 5 Java DTOs to freeze dict factory field lists

**Files:** read-only — Java class files

- [ ] **Step 1: Locate compiled .class files**

```bash
find backend/java/cretas-api/target/classes/com/cretas/aims/dto/smartbi -name '*.class' 2>/dev/null | grep -E '(DashboardResponse|RankingItem|ChartConfig|AIInsight|KPICard)\.class'
```

Expected: 5 paths. If 0 results, run `mvn package -DskipTests` from `backend/java/cretas-api/` first.

- [ ] **Step 2: javap DashboardResponse**

```bash
javap -p backend/java/cretas-api/target/classes/com/cretas/aims/dto/smartbi/DashboardResponse.class | grep -E 'public.*get|public.*is' | head -30
```

Expected getter list (16 fields per @Data):
- `getPeriod() / getStartDate() / getEndDate()`
- `getKpiCards() / getMetricCards()`
- `getRankings() / getCharts() / getChartList()`
- `getAiInsights() / getAlerts() / getRecommendations() / getSuggestions()`
- `getGeneratedAt() / getLastUpdated()`
- `isFromCache() / getCacheExpireAt()`

- [ ] **Step 3: javap RankingItem**

```bash
javap -p backend/java/cretas-api/target/classes/com/cretas/aims/dto/smartbi/RankingItem.class | grep -E 'public.*get|public.*is'
```

Expected (6 fields per spec, confirmed by direct read):
- `getRank() / getName() / getValue() / getTarget() / getCompletionRate() / getAlertLevel()`

- [ ] **Step 4: javap ChartConfig**

```bash
javap -p backend/java/cretas-api/target/classes/com/cretas/aims/dto/smartbi/ChartConfig.class | grep -E 'public.*get|public.*is'
```

Expected: `getChartType() / getTitle() / getSeriesField() / getData() / getOptions() / getXaxisField() / getYaxisField()` — 7 getters, possibly also `getCategories() / getSubtitle()` etc. Note the lowercase `xaxis` not `xAxis` (Lombok demangling per Jackson default).

- [ ] **Step 5: javap AIInsight**

```bash
javap -p backend/java/cretas-api/target/classes/com/cretas/aims/dto/smartbi/AIInsight.class | grep -E 'public.*get|public.*is'
```

Expected: `getLevel() / getCategory() / getMessage() / getRelatedEntity() / getActionSuggestion()` — 5 getters.

- [ ] **Step 6: javap KPICard**

```bash
javap -p backend/java/cretas-api/target/classes/com/cretas/aims/dto/smartbi/KPICard.class | grep -E 'public.*get|public.*is'
```

Expected (~13 getters per overview agent): `getKey() / getTitle() / getValue() / getRawValue() / getUnit() / getChange() / getChangeRate() / getTrend() / getStatus() / getCompareText() / getDescription() / getTargetValue() / getCompletionRate()`.

- [ ] **Step 7: Save findings to reference doc (optional)**

Either keep getter lists in your working notes OR append to spec § "DTO Contract" if you find discrepancies vs current spec. No commit needed unless updating spec.

---

### Task A.4: Verify async/sync bridging works (smoke test)

**Files:** scratch test, no commit

- [ ] **Step 1: Write throwaway smoke test for `asyncio.to_thread` + SQLAlchemy text()**

Create `/tmp/async_bridge_smoke.py`:

```python
import asyncio
from sqlalchemy import text
import sys
sys.path.insert(0, 'backend/python')
from smartbi.database.connection import get_db_context, is_postgres_enabled


def sync_query():
    if not is_postgres_enabled():
        return "postgres not enabled"
    with get_db_context() as db:
        result = db.execute(text("SELECT 1 AS one")).first()
        return result.one


async def main():
    val = await asyncio.to_thread(sync_query)
    print(f"async result: {val}")


asyncio.run(main())
```

- [ ] **Step 2: Run smoke**

```bash
python3 /tmp/async_bridge_smoke.py
```

Expected: `async result: 1` (or `async result: postgres not enabled` if local has no PG — still validates the bridge mechanism).

If error like `RuntimeError: cannot run from inside running event loop`, alternative is `loop.run_in_executor(None, sync_query)`.

- [ ] **Step 3: Cleanup**

```bash
rm /tmp/async_bridge_smoke.py
```

No commit.

---

## Phase B — SQL helper extension

### Task B.1: Extend `_query_sales_data` with `order_date` column

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis.py:283-308`

- [ ] **Step 1: Read current SQL**

```bash
grep -n -A 6 'def _query_sales_data' backend/python/smartbi_compat/api/analysis.py | head -20
```

Confirm current SELECT lists 5 columns: `salesperson_name, amount, monthly_target, product_category, customer_name`.

- [ ] **Step 2: Edit SQL to add `order_date`**

Use Edit tool with old_string:

```python
    sql = text(
        "SELECT salesperson_name, amount, monthly_target, "
        "       product_category, customer_name "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
```

new_string:

```python
    sql = text(
        "SELECT salesperson_name, amount, monthly_target, "
        "       product_category, customer_name, order_date "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
```

- [ ] **Step 3: Re-run alerts contract tests (R8 mitigation)**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_alerts_contract.py -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: all alerts tests still pass.

- [ ] **Step 4: Re-run alerts logic tests**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_alerts_logic.py -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: all pass. Adding column to SELECT doesn't change row count or filter logic.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a): extend _query_sales_data SQL with order_date column

Required by trend sub-spec date bucketing. Alerts/recommendations callers
ignore order_date attribute access — verified by re-running their contract
+ logic tests (no regressions).

Foundation spec §6, Task B.1." -- backend/python/smartbi_compat/api/analysis.py
```

---

## Phase C — New module skeleton + DTO factories (TDD)

### Task C.1: Create empty `analysis_sales.py` with imports + module docstring

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_sales.py`

- [ ] **Step 1: Verify file does not exist**

```bash
ls backend/python/smartbi_compat/api/analysis_sales.py 2>&1
```

Expected: `No such file or directory`. If file exists, STOP and reconcile.

- [ ] **Step 2: Write skeleton file**

```python
"""Phase 2A /analysis/sales endpoint port.

Implements the composite Map<String, Object> response with 7 keys:
  overview / customerRanking / productRanking / dateRange /
  salespersonRanking / generatedAt / trendChart

Foundation defines:
  - Route registration + composite assembly
  - 5 async sub-service stubs returning F999 empty-state shape
  - 5 DTO dict factories (DashboardResponse / RankingItem / ChartConfig /
    AIInsight / KPICard)
  - DateRange dict factory

Sibling specs replace stub bodies:
  - overview spec → _get_sales_overview legacy fallback path
  - gold spec → _get_sales_overview Gold-first dispatch + helpers
  - rankings spec → _get_X_ranking real impls
  - trend spec → _get_sales_trend_chart real impl

Java reference:
  - Controller: SmartBIAnalysisController.getSalesAnalysis line 98-138
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 568-616
  - Sub-services: SalesAnalysisServiceImpl.{getSalesOverview, getXRanking,
    getSalesTrendChart}

Spec: docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from smartbi_compat.api.analysis import _query_sales_data, wrap_response
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# Section 1: DTO dict factories (FROZEN by foundation spec §4)
# ============================================================
# Populated by Tasks C.3 - C.7

# ============================================================
# Section 2: Strip-volatile shared helper
# ============================================================
# Populated by Task C.2

# ============================================================
# Section 3: Sub-service stubs (5 of them)
# ============================================================
# Populated by Task D.1; sibling specs replace bodies

# ============================================================
# Section 4: Composite assembly + route
# ============================================================
# Populated by Tasks D.2 / D.3
```

- [ ] **Step 3: Verify import-clean**

```bash
cd backend/python
python -c "from smartbi_compat.api import analysis_sales; print('OK')"
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py
git status --short
git commit -m "feat(phase2a): scaffold analysis_sales.py module

Foundation Task C.1. Empty module with imports + docstring;
DTO factories / stubs / route added in subsequent tasks." -- backend/python/smartbi_compat/api/analysis_sales.py
```

---

### Task C.2: Add `_strip_volatile` shared helper (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Create: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Create `tests/python/smartbi_compat/test_analysis_sales_factories.py`:

```python
"""Unit tests for analysis_sales.py dict factories + helpers."""
from __future__ import annotations

import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "backend" / "python"))

from smartbi_compat.api.analysis_sales import _strip_volatile


class TestStripVolatile:
    def test_removes_generated_at(self):
        obj = {"generatedAt": "2026-04-30T06:34:34", "kpiCards": []}
        assert _strip_volatile(obj) == {"kpiCards": []}

    def test_removes_last_updated(self):
        obj = {"lastUpdated": "2026-04-30T06:34:34", "value": 42}
        assert _strip_volatile(obj) == {"value": 42}

    def test_removes_cache_expire_at(self):
        obj = {"cacheExpireAt": None, "fromCache": False}
        assert _strip_volatile(obj) == {"fromCache": False}

    def test_removes_timestamp(self):
        obj = {"timestamp": "x", "data": [1, 2]}
        assert _strip_volatile(obj) == {"data": [1, 2]}

    def test_recursive_dict(self):
        obj = {
            "outer": {"inner": {"generatedAt": "x", "value": 1}},
            "lastUpdated": "y",
        }
        assert _strip_volatile(obj) == {"outer": {"inner": {"value": 1}}}

    def test_recursive_list(self):
        obj = [{"generatedAt": "x", "id": 1}, {"id": 2}]
        assert _strip_volatile(obj) == [{"id": 1}, {"id": 2}]

    def test_preserves_non_volatile(self):
        obj = {"name": "abc", "amount": 12.34, "items": [1, 2, 3]}
        assert _strip_volatile(obj) == obj

    def test_handles_primitives(self):
        assert _strip_volatile(42) == 42
        assert _strip_volatile("hello") == "hello"
        assert _strip_volatile(None) is None
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestStripVolatile -v 2>&1 | tail -20
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError: cannot import name '_strip_volatile'`.

- [ ] **Step 3: Implement `_strip_volatile` in `analysis_sales.py`**

Replace the `# Section 2: Strip-volatile shared helper\n# Populated by Task C.2` section with:

```python
# ============================================================
# Section 2: Strip-volatile shared helper
# ============================================================

VOLATILE_KEYS = frozenset({
    "generatedAt", "lastUpdated", "cacheExpireAt", "timestamp",
})


def _strip_volatile(obj: Any) -> Any:
    """Recursively strip timing/cache-dependent keys for byte-shape compare.

    Removes from any dict in the tree:
      - generatedAt          (LocalDateTime.now() per request)
      - lastUpdated          (DashboardResponse @Deprecated, also volatile)
      - cacheExpireAt        (cache TTL)
      - timestamp            (envelope-level)

    Preserves all other keys + list/primitive values.
    """
    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v)
            for k, v in obj.items()
            if k not in VOLATILE_KEYS
        }
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestStripVolatile -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _strip_volatile helper for byte-shape compare

Foundation Task C.2. Recursively strips generatedAt/lastUpdated/
cacheExpireAt/timestamp keys before contract test golden compare." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.3: Add `_new_date_range_dict` factory (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `tests/python/smartbi_compat/test_analysis_sales_factories.py`:

```python
from datetime import date
from smartbi_compat.api.analysis_sales import _new_date_range_dict
from smartbi_compat.date_range import DateRange


class TestDateRangeDict:
    def test_F999_observed_shape(self):
        """Match F999 golden 7-field shape: 5 declared + 2 derived."""
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        result = _new_date_range_dict(r)
        assert set(result.keys()) == {
            "startDate", "endDate", "granularity",
            "originalExpression", "relative", "days", "valid",
        }
        assert result["startDate"] == "2025-01-01"
        assert result["endDate"] == "2025-12-31"
        assert result["days"] == 365
        assert result["valid"] is True

    def test_key_order_matches_F999(self):
        """Foundation §3 R9: dict key order must match Java HashMap iteration order."""
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        keys = list(_new_date_range_dict(r).keys())
        # Order observed in F999 golden
        assert keys == [
            "startDate", "endDate", "granularity",
            "originalExpression", "relative", "days", "valid",
        ]

    def test_one_day_range(self):
        r = DateRange.custom(date(2025, 6, 15), date(2025, 6, 15))
        result = _new_date_range_dict(r)
        assert result["days"] == 1
        assert result["valid"] is True

    def test_invalid_range(self):
        """end before start → valid=False."""
        r = DateRange.custom(date(2025, 12, 31), date(2025, 1, 1))
        result = _new_date_range_dict(r)
        assert result["valid"] is False
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestDateRangeDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError: cannot import name '_new_date_range_dict'`.

- [ ] **Step 3: Implement factory**

Replace `# Populated by Tasks C.3 - C.7` placeholder in Section 1 with:

```python
def _new_date_range_dict(range_: DateRange) -> dict:
    """Mirror DateRange.java @Data getters incl. derived `days` and `valid`.

    F999 observed 7-field shape:
      startDate / endDate (LocalDate, ISO string)
      granularity (String — YEAR/MONTH/WEEK/DAY/CUSTOM)
      originalExpression (String — e.g. "2025-01-01 至 2025-12-31")
      relative (boolean)
      days (derived = (endDate - startDate).days + 1)
      valid (derived = startDate <= endDate)
    """
    days_count = (range_.end_date - range_.start_date).days + 1
    return {
        "startDate": range_.start_date.isoformat(),
        "endDate": range_.end_date.isoformat(),
        "granularity": getattr(range_, "granularity", "CUSTOM"),
        "originalExpression": getattr(range_, "original_expression", None),
        "relative": getattr(range_, "relative", False),
        "days": days_count,
        "valid": range_.start_date <= range_.end_date,
    }
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestDateRangeDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _new_date_range_dict factory + tests

Foundation Task C.3. 7-field shape matches F999 golden (5 declared + 2
derived). Key order locked to F999 observed (startDate/endDate/
granularity/originalExpression/relative/days/valid)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.4: Add `_new_dashboard_response_dict` factory (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _new_dashboard_response_dict


class TestDashboardResponseDict:
    DECLARED_KEYS = {
        "period", "startDate", "endDate", "kpiCards", "metricCards",
        "rankings", "charts", "chartList", "aiInsights", "alerts",
        "recommendations", "suggestions", "generatedAt", "lastUpdated",
        "fromCache", "cacheExpireAt",
    }

    def test_all_16_keys_present(self):
        result = _new_dashboard_response_dict()
        assert set(result.keys()) == self.DECLARED_KEYS

    def test_F999_empty_state_defaults(self):
        """When no kwargs, factory matches F999 empty-state defaults."""
        result = _new_dashboard_response_dict(
            ai_insights=[
                {"level": "YELLOW", "category": "数据状态",
                 "message": "test", "relatedEntity": None,
                 "actionSuggestion": "test"}
            ],
            suggestions=["test suggestion"],
            last_updated="2026-04-30T00:00:00",
        )
        assert result["period"] is None
        assert result["startDate"] is None
        assert result["endDate"] is None
        assert result["kpiCards"] == []
        assert result["metricCards"] is None
        assert result["rankings"] == {}
        assert result["charts"] == {}
        assert result["chartList"] is None
        assert len(result["aiInsights"]) == 1
        assert result["alerts"] is None
        assert result["recommendations"] is None
        assert result["suggestions"] == ["test suggestion"]
        assert result["generatedAt"] is None
        assert result["lastUpdated"] == "2026-04-30T00:00:00"
        assert result["fromCache"] is False
        assert result["cacheExpireAt"] is None

    def test_key_insertion_order_matches_java(self):
        """Foundation §4: key order = Java DashboardResponse declaration order."""
        keys = list(_new_dashboard_response_dict().keys())
        expected_order = [
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        ]
        assert keys == expected_order

    def test_deprecated_fields_emit_null(self):
        """Lombok @Data emits all 16 fields incl. 5 @Deprecated ones."""
        result = _new_dashboard_response_dict()
        # @Deprecated: metricCards / chartList / suggestions / lastUpdated
        # (fromCache is not deprecated; cacheExpireAt is not deprecated)
        assert "metricCards" in result and result["metricCards"] is None
        assert "chartList" in result and result["chartList"] is None
        assert "suggestions" in result and result["suggestions"] is None
        assert "lastUpdated" in result and result["lastUpdated"] is None
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestDashboardResponseDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError.

- [ ] **Step 3: Implement factory**

Append to Section 1 of `analysis_sales.py`:

```python
def _new_dashboard_response_dict(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    kpi_cards: Optional[list] = None,
    metric_cards: Optional[list] = None,
    rankings: Optional[dict] = None,
    charts: Optional[dict] = None,
    chart_list: Optional[list] = None,
    ai_insights: Optional[list] = None,
    alerts: Optional[list] = None,
    recommendations: Optional[list] = None,
    suggestions: Optional[list] = None,
    generated_at: Optional[str] = None,
    last_updated: Optional[str] = None,
    from_cache: bool = False,
    cache_expire_at: Optional[str] = None,
) -> dict:
    """Mirror DashboardResponse.java @Data getters (16 fields).

    All 16 fields emit including 4 @Deprecated ones (metricCards / chartList
    / suggestions / lastUpdated) — Lombok @Data sees them via getters even
    when @Deprecated. Key order matches Java field declaration order.

    F999 empty-state defaults:
      kpi_cards=[], rankings={}, charts={} when not provided
      all other Optional fields default to None
    """
    return {
        "period": period,
        "startDate": start_date.isoformat() if start_date else None,
        "endDate": end_date.isoformat() if end_date else None,
        "kpiCards": kpi_cards if kpi_cards is not None else [],
        "metricCards": metric_cards,
        "rankings": rankings if rankings is not None else {},
        "charts": charts if charts is not None else {},
        "chartList": chart_list,
        "aiInsights": ai_insights if ai_insights is not None else [],
        "alerts": alerts,
        "recommendations": recommendations,
        "suggestions": suggestions,
        "generatedAt": generated_at,
        "lastUpdated": last_updated,
        "fromCache": from_cache,
        "cacheExpireAt": cache_expire_at,
    }
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestDashboardResponseDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _new_dashboard_response_dict factory + tests

Foundation Task C.4. 16-field DashboardResponse shape with key order
locked to Java declaration order. F999 empty-state defaults: kpi_cards/
rankings/charts default to []/{}/{}." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.5: Add `_new_ranking_item_dict` factory (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `test_analysis_sales_factories.py`:

```python
from decimal import Decimal
from smartbi_compat.api.analysis_sales import _new_ranking_item_dict


class TestRankingItemDict:
    def test_6_fields_only(self):
        """RankingItem.java is exactly 6 fields, no derived getters."""
        result = _new_ranking_item_dict(rank=1, name="测试", value=Decimal("100"))
        assert set(result.keys()) == {
            "rank", "name", "value", "target", "completionRate", "alertLevel",
        }

    def test_full_shape_salesperson(self):
        result = _new_ranking_item_dict(
            rank=1, name="张三", value=Decimal("100000"),
            target=Decimal("80000"),
            completion_rate=Decimal("125.00"),
            alert_level="GREEN",
        )
        assert result == {
            "rank": 1, "name": "张三", "value": Decimal("100000"),
            "target": Decimal("80000"), "completionRate": Decimal("125.00"),
            "alertLevel": "GREEN",
        }

    def test_product_ranking_no_target(self):
        """product/customer rankings leave target null; completionRate = pct."""
        result = _new_ranking_item_dict(
            rank=2, name="蔬菜", value=Decimal("50000"),
            completion_rate=Decimal("25.00"),
            alert_level="GREEN",
        )
        assert result["target"] is None
        assert result["completionRate"] == Decimal("25.00")

    def test_key_order(self):
        result = _new_ranking_item_dict(rank=1, name="x", value=Decimal("1"))
        assert list(result.keys()) == [
            "rank", "name", "value", "target", "completionRate", "alertLevel",
        ]
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestRankingItemDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError.

- [ ] **Step 3: Implement factory**

Append to Section 1 of `analysis_sales.py`:

```python
def _new_ranking_item_dict(
    rank: int,
    name: str,
    value: Decimal,
    target: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
    alert_level: Optional[str] = None,
) -> dict:
    """Mirror RankingItem.java @Data getters (6 fields exactly).

    Per rankings spec direct file read (53 LOC source): no derived getters.

    Note: `completionRate` is OVERLOADED by Java callers:
      - salesperson rankings: target completion percent (vs `target`)
      - product/customer rankings: share-of-total percentage (target stays null)
    """
    return {
        "rank": rank,
        "name": name,
        "value": value,
        "target": target,
        "completionRate": completion_rate,
        "alertLevel": alert_level,
    }
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestRankingItemDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _new_ranking_item_dict factory + tests

Foundation Task C.5. RankingItem 6-field shape: rank/name/value/target/
completionRate/alertLevel. completionRate is dual-purpose (target completion
for salesperson, share-of-total for product/customer)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.6: Add `_new_chart_config_dict` factory (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _new_chart_config_dict


class TestChartConfigDict:
    def test_F999_trend_shape(self):
        """F999 trendChart shape: 7 keys, LINE chart with empty data."""
        result = _new_chart_config_dict(
            chart_type="LINE",
            title="销售趋势",
            xaxis_field="date",
            yaxis_field="amount",
            data=[],
            options={"showDataLabels": False, "smooth": True},
        )
        assert set(result.keys()) == {
            "chartType", "title", "seriesField", "data", "options",
            "xaxisField", "yaxisField",
        }
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["seriesField"] is None
        assert result["data"] == []
        assert result["options"] == {"showDataLabels": False, "smooth": True}
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"

    def test_lowercase_xaxis(self):
        """Jackson serializes xAxisField → xaxisField (lowercase a)."""
        result = _new_chart_config_dict(chart_type="LINE", title="t")
        assert "xaxisField" in result
        assert "xAxisField" not in result

    def test_options_can_be_null(self):
        """Gold-path ChartConfig has options=null (Java doesn't set it)."""
        result = _new_chart_config_dict(
            chart_type="PIE", title="占比",
            xaxis_field="category", yaxis_field="amount",
            data=[{"category": "x", "amount": Decimal("10")}],
        )
        assert result["options"] is None

    def test_key_order(self):
        result = _new_chart_config_dict(chart_type="LINE", title="t")
        # Order matches F999 golden observation
        assert list(result.keys()) == [
            "chartType", "title", "seriesField", "data", "options",
            "xaxisField", "yaxisField",
        ]
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestChartConfigDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError.

- [ ] **Step 3: Implement factory**

Append to Section 1 of `analysis_sales.py`:

```python
def _new_chart_config_dict(
    chart_type: str,
    title: str,
    series_field: Optional[str] = None,
    data: Optional[list] = None,
    options: Optional[dict] = None,
    xaxis_field: Optional[str] = None,
    yaxis_field: Optional[str] = None,
) -> dict:
    """Mirror ChartConfig.java @Data getters (7 fields observed in F999).

    Note: `xaxisField` / `yaxisField` are LOWERCASE (Jackson demangles
    Lombok-generated getXAxisField → "xaxisField"). Verified in F999 golden.

    `options` defaults to None (matches Gold path); legacy stub may pass
    {"showDataLabels": False, "smooth": True} per F999 observed.
    """
    return {
        "chartType": chart_type,
        "title": title,
        "seriesField": series_field,
        "data": data if data is not None else [],
        "options": options,
        "xaxisField": xaxis_field,
        "yaxisField": yaxis_field,
    }
```

⚠ Note: F999 golden has `data: []` (empty list, NOT None) and `options: {showDataLabels: false, smooth: true}` (object, NOT None). The factory above defaults `data=[]` but `options=None`. Stub callers must explicitly pass options when matching F999 stub state — see Task D.1 stub for `_get_sales_trend_chart`.

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestChartConfigDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _new_chart_config_dict factory + tests

Foundation Task C.6. ChartConfig 7-field shape (xaxisField/yaxisField
lowercase a per Jackson demangling). Options nullable for Gold path
compatibility; legacy stub passes default options object." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.7: Add `_new_ai_insight_dict` factory (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _new_ai_insight_dict


class TestAiInsightDict:
    def test_F999_yellow_shape(self):
        result = _new_ai_insight_dict(
            level="YELLOW",
            category="数据状态",
            message="当前时间范围内暂无销售数据",
            action_suggestion="请上传销售数据或调整时间范围",
        )
        assert set(result.keys()) == {
            "level", "category", "message", "relatedEntity", "actionSuggestion",
        }
        assert result["level"] == "YELLOW"
        assert result["category"] == "数据状态"
        assert result["message"] == "当前时间范围内暂无销售数据"
        assert result["relatedEntity"] is None
        assert result["actionSuggestion"] == "请上传销售数据或调整时间范围"

    def test_key_order(self):
        result = _new_ai_insight_dict(level="INFO", category="x", message="y")
        assert list(result.keys()) == [
            "level", "category", "message", "relatedEntity", "actionSuggestion",
        ]
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestAiInsightDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError.

- [ ] **Step 3: Implement factory**

Append to Section 1 of `analysis_sales.py`:

```python
def _new_ai_insight_dict(
    level: str,
    category: str,
    message: str,
    related_entity: Optional[str] = None,
    action_suggestion: Optional[str] = None,
) -> dict:
    """Mirror AIInsight.java @Data getters (5 fields observed in F999).

    level: RED / YELLOW / GREEN / INFO
    """
    return {
        "level": level,
        "category": category,
        "message": message,
        "relatedEntity": related_entity,
        "actionSuggestion": action_suggestion,
    }
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestAiInsightDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _new_ai_insight_dict factory + tests

Foundation Task C.7. AIInsight 5-field shape." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.8: Add `_new_kpi_card_dict` factory (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _new_kpi_card_dict


class TestKpiCardDict:
    def test_13_fields_present(self):
        """KPICard 13 fields per overview spec finding (javap-confirmed by Task A.3)."""
        result = _new_kpi_card_dict(key="total_revenue", title="总营收")
        assert set(result.keys()) == {
            "key", "title", "value", "rawValue", "unit", "change",
            "changeRate", "trend", "status", "compareText",
            "description", "targetValue", "completionRate",
        }

    def test_status_default_green(self):
        """Lombok @Builder.Default sets status=green when not provided."""
        result = _new_kpi_card_dict(key="x", title="x")
        assert result["status"] == "green"

    def test_F001_gold_kpi_shape(self):
        """F001 Gold-path KPI card example (4 cards × this shape)."""
        result = _new_kpi_card_dict(
            key="total_revenue", title="总营收",
            value="20639884.52", raw_value=Decimal("20639884.52"),
            unit="元", status="green",
        )
        assert result["key"] == "total_revenue"
        assert result["value"] == "20639884.52"
        assert result["rawValue"] == Decimal("20639884.52")
        assert result["unit"] == "元"
        assert result["change"] is None
        assert result["changeRate"] is None
        assert result["trend"] is None
        assert result["status"] == "green"

    def test_key_order(self):
        result = _new_kpi_card_dict(key="x", title="x")
        assert list(result.keys()) == [
            "key", "title", "value", "rawValue", "unit", "change",
            "changeRate", "trend", "status", "compareText",
            "description", "targetValue", "completionRate",
        ]
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestKpiCardDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError.

- [ ] **Step 3: Implement factory**

Append to Section 1 of `analysis_sales.py`:

```python
def _new_kpi_card_dict(
    key: str,
    title: str,
    value: Optional[Any] = None,           # str (formatted) or Decimal
    raw_value: Optional[Decimal] = None,
    unit: Optional[str] = None,
    change: Optional[Decimal] = None,
    change_rate: Optional[Decimal] = None,
    trend: Optional[str] = None,            # up / down / flat
    status: str = "green",                   # @Builder.Default per Java line 81-82
    compare_text: Optional[str] = None,
    description: Optional[str] = None,
    target_value: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
) -> dict:
    """Mirror KPICard.java @Data getters (13 fields per overview agent finding).

    Lombok @Builder.Default sets status="green" — Python factory mirrors this.

    Used by:
      - gold spec: 4 KPIs (total_revenue / bill_count / avg_bill_value / store_count)
      - overview spec: 5 KPIs from legacy from-aggregates path

    For "元" unit values, `value` is formatted string (2 decimals); for
    integer units, `value` is integer-string. `rawValue` always BigDecimal.
    """
    return {
        "key": key,
        "title": title,
        "value": value,
        "rawValue": raw_value,
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

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestKpiCardDict -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _new_kpi_card_dict factory + tests

Foundation Task C.8. KPICard 13-field shape with status='green' default
(Lombok @Builder.Default mirror). Foundation owns to break overview/
gold spec dependency cycle." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

## Phase D — Sub-service stubs + composite + route

### Task D.1: Add 5 async sub-service stubs returning F999-shape

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 3)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test for stubs**

Append to `test_analysis_sales_factories.py`:

```python
import pytest
import asyncio
from datetime import date as _date
from smartbi_compat.api.analysis_sales import (
    _get_sales_overview,
    _get_salesperson_ranking,
    _get_product_ranking,
    _get_customer_ranking,
    _get_sales_trend_chart,
)
from smartbi_compat.date_range import DateRange


@pytest.fixture
def range_2025():
    return DateRange.custom(_date(2025, 1, 1), _date(2025, 12, 31))


class TestSubServiceStubs:
    def test_overview_stub_returns_F999_shape(self, range_2025):
        result = asyncio.run(_get_sales_overview("F999", range_2025))
        assert isinstance(result, dict)
        assert len(result["aiInsights"]) == 1
        assert result["aiInsights"][0]["level"] == "YELLOW"
        assert result["aiInsights"][0]["message"] == "当前时间范围内暂无销售数据"
        assert result["suggestions"] == ["请先上传销售数据以开始分析"]
        assert result["kpiCards"] == []
        assert result["fromCache"] is False

    def test_salesperson_ranking_stub_returns_empty_list(self, range_2025):
        result = asyncio.run(_get_salesperson_ranking("F999", range_2025))
        assert result == []

    def test_product_ranking_stub_returns_empty_list(self, range_2025):
        result = asyncio.run(_get_product_ranking("F999", range_2025))
        assert result == []

    def test_customer_ranking_stub_returns_empty_list(self, range_2025):
        result = asyncio.run(_get_customer_ranking("F999", range_2025))
        assert result == []

    def test_trend_chart_stub_returns_F999_shape(self, range_2025):
        result = asyncio.run(_get_sales_trend_chart("F999", range_2025))
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"
        assert result["data"] == []
        assert result["options"] == {"showDataLabels": False, "smooth": True}

    def test_all_stubs_are_async(self):
        """All 5 sub-services must be coroutine functions per foundation §5."""
        assert asyncio.iscoroutinefunction(_get_sales_overview)
        assert asyncio.iscoroutinefunction(_get_salesperson_ranking)
        assert asyncio.iscoroutinefunction(_get_product_ranking)
        assert asyncio.iscoroutinefunction(_get_customer_ranking)
        assert asyncio.iscoroutinefunction(_get_sales_trend_chart)
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestSubServiceStubs -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError on `_get_sales_overview` etc.

- [ ] **Step 3: Implement stubs**

Replace Section 3 placeholder in `analysis_sales.py`:

```python
# ============================================================
# Section 3: Sub-service stubs (5 of them)
# ============================================================
# Sibling specs replace bodies; foundation provides F999 empty-state shape
# so F999 contract test passes after foundation merge.


def _utc_now_iso() -> str:
    """Generate ISO timestamp for generatedAt / lastUpdated fields.

    Stripped by `_strip_volatile` before byte compare.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """STUB — overview/gold specs replace.

    Returns F999 empty-state DashboardResponse matching `buildEmptyDashboard`
    Java line 1145-1159: 1 YELLOW insight + 1 suggestion + 16-field shape.
    """
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无销售数据",
                action_suggestion="请上传销售数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传销售数据以开始分析"],
        last_updated=_utc_now_iso(),
    )


async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces.

    F999 empty: legacy SQL returns [] (no rows in 2025 window).
    """
    return []


async def _get_product_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []


async def _get_customer_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []


async def _get_sales_trend_chart(
    factory_id: str, range_: DateRange, period: str = "DAY",
) -> dict:
    """STUB — trend spec replaces.

    F999 empty-state ChartConfig: empty data + hardcoded title/axes/options.
    """
    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=[],
        options={"showDataLabels": False, "smooth": True},
    )
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestSubServiceStubs -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): 5 async sub-service stubs returning F999 shape

Foundation Task D.1. Stubs gate F999 contract test PASS post-merge:
  _get_sales_overview → buildEmptyDashboard equivalent (1 YELLOW + 1 suggestion)
  _get_X_ranking → []
  _get_sales_trend_chart → empty LINE chart with hardcoded options

Sibling specs (overview/gold/rankings/trend) replace stub bodies." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task D.2: Add async `_get_comprehensive_sales_analysis` composite

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 4)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _get_comprehensive_sales_analysis


class TestComposite:
    def test_returns_7_keys_in_F999_order(self, range_2025):
        result = asyncio.run(_get_comprehensive_sales_analysis("F999", range_2025))
        # Order observed in F999 golden (Jackson HashMap iteration order)
        assert list(result.keys()) == [
            "overview", "customerRanking", "productRanking", "dateRange",
            "salespersonRanking", "generatedAt", "trendChart",
        ]

    def test_F999_empty_state(self, range_2025):
        result = asyncio.run(_get_comprehensive_sales_analysis("F999", range_2025))
        assert result["overview"]["kpiCards"] == []
        assert result["customerRanking"] == []
        assert result["productRanking"] == []
        assert result["salespersonRanking"] == []
        assert result["trendChart"]["data"] == []
        assert result["dateRange"]["startDate"] == "2025-01-01"
        assert result["dateRange"]["endDate"] == "2025-12-31"
        assert result["dateRange"]["days"] == 365
        # generatedAt is ISO string (volatile, stripped before compare)
        assert isinstance(result["generatedAt"], str)

    def test_is_async(self):
        assert asyncio.iscoroutinefunction(_get_comprehensive_sales_analysis)
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestComposite -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ImportError.

- [ ] **Step 3: Implement composite**

Replace Section 4 placeholder in `analysis_sales.py`:

```python
# ============================================================
# Section 4: Composite assembly + route
# ============================================================


async def _get_comprehensive_sales_analysis(
    factory_id: str, range_: DateRange,
) -> dict:
    """Java reference: SmartBIServiceImpl.getComprehensiveAnalysis sales
    branch (line 568-616).

    Returns 7-key composite Map. Key order matches F999/F001 golden
    (Jackson serialization of Java HashMap), NOT Java result.put() order.

    Java puts in this order (lines 578-584 + 612-613):
      overview / salespersonRanking / productRanking / customerRanking /
      trendChart / dateRange / generatedAt

    Jackson observed (F999 golden):
      overview / customerRanking / productRanking / dateRange /
      salespersonRanking / generatedAt / trendChart

    The Jackson order is what we mirror.
    """
    return {
        "overview":           await _get_sales_overview(factory_id, range_),
        "customerRanking":    await _get_customer_ranking(factory_id, range_),
        "productRanking":     await _get_product_ranking(factory_id, range_),
        "dateRange":          _new_date_range_dict(range_),
        "salespersonRanking": await _get_salesperson_ranking(factory_id, range_),
        "generatedAt":        _utc_now_iso(),
        "trendChart":         await _get_sales_trend_chart(factory_id, range_, "DAY"),
    }
```

- [ ] **Step 4: Run test — confirm pass**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestComposite -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
git status --short
git commit -m "feat(phase2a): _get_comprehensive_sales_analysis composite

Foundation Task D.2. 7-key Map with key order matching F999 golden
(Jackson serialization of Java HashMap). Async per foundation §5." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task D.3: Add async route handler

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 4)

- [ ] **Step 1: Append route handler**

Append to Section 4 of `analysis_sales.py` (after `_get_comprehensive_sales_analysis`):

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
async def get_sales_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    department: Optional[str] = None,
    dimension: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getSalesAnalysis line 98-138.

    department/dimension query params accepted but IGNORED — Java line 110
    short-circuits to getComprehensiveAnalysis when smartBIService is non-null.
    F999 goldens confirm: dimension=salesperson golden is byte-identical to
    no-dimension golden except _meta.

    Returns 7-key composite Map wrapped in standard envelope.
    """
    range_ = DateRange.custom(startDate, endDate)
    result = await _get_comprehensive_sales_analysis(auth.factory_id, range_)
    return wrap_response(result)
```

- [ ] **Step 2: Verify route is registered**

```bash
cd backend/python
python -c "
from smartbi_compat.api import analysis_sales
print('routes:')
for r in analysis_sales.router.routes:
    print(f'  {list(r.methods)[0]} {r.path}')
"
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected:
```
routes:
  GET /api/mobile/{factory_id}/smart-bi/analysis/sales
```

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_sales.py
git status --short
git commit -m "feat(phase2a): /analysis/sales route handler

Foundation Task D.3. Async route forwards to composite assembly.
department/dimension params accepted but ignored (Java short-circuit
parity)." -- backend/python/smartbi_compat/api/analysis_sales.py
```

---

### Task D.4: Register router in `main.py`

**Files:**
- Modify: `backend/python/main.py`

- [ ] **Step 1: Find current smartbi_compat router registration**

```bash
grep -n -E '(smartbi_compat|analysis)' backend/python/main.py | head -10
```

Expected: at least one `app.include_router(...analysis...)` for the existing analysis.py module.

- [ ] **Step 2: Read context around the existing registration**

```bash
grep -n 'analysis' backend/python/main.py | head -5
```

Note the line number where the existing `analysis` router is included; the new `analysis_sales` router goes adjacent.

- [ ] **Step 3: Add router import + include**

Use Edit tool. Find existing pattern like:

```python
from smartbi_compat.api import analysis
# ...
app.include_router(analysis.router, tags=["smartbi-compat"])
```

Add adjacent:

```python
from smartbi_compat.api import analysis
from smartbi_compat.api import analysis_sales
# ...
app.include_router(analysis.router, tags=["smartbi-compat"])
app.include_router(analysis_sales.router, tags=["smartbi-compat-sales"])
```

⚠ Match the actual style in main.py — if imports are grouped or patterns differ, follow the existing convention.

- [ ] **Step 4: Verify app starts cleanly**

```bash
cd backend/python
python -c "
from main import app
print(f'route count: {len(app.routes)}')
sales_routes = [r for r in app.routes if hasattr(r, 'path') and 'analysis/sales' in r.path]
print(f'sales routes: {sales_routes}')
"
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: at least 1 sales route printed.

- [ ] **Step 5: Commit**

```bash
git add backend/python/main.py
git status --short
git commit -m "feat(phase2a): register analysis_sales router in main.py

Foundation Task D.4. /analysis/sales endpoint reachable via the
production app instance (port 8083)." -- backend/python/main.py
```

---

## Phase E — F999 contract test (foundation merge gate)

### Task E.1: Create `test_analysis_sales_contract.py` skeleton

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

- [ ] **Step 1: Verify file does not exist**

```bash
ls tests/python/smartbi_compat/test_analysis_sales_contract.py 2>&1
```

Expected: `No such file or directory`.

- [ ] **Step 2: Create skeleton**

```python
"""Contract tests: Python /analysis/sales must match Java byte-shape goldens.

Foundation merge gates (this file):
  - TestEnvelope.test_route_registered
  - TestEnvelope.test_jwt_required
  - TestEnvelope.test_factory_id_isolation
  - TestEnvelope.test_dimension_param_ignored
  - TestEnvelope.test_F999_empty_state_byte_shape  ← foundation merge gate

Sibling specs add:
  - TestOverview (overview spec) — legacy fallback path tests
  - TestRankings (rankings spec) — F001 byte tests + tie-stability + Top 10
  - TestTrend (trend spec) — DAY bucketing + F001 byte
  - TestGold (gold spec) — Gold-path adapter byte tests + empty short-circuit

Goldens recorded against F999 + F001 by:
  scripts/phase2a/record-analysis-sales-goldens.sh
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
from datetime import datetime, timezone
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

GOLDEN_DIR = (
    pathlib.Path(__file__).resolve().parents[2] / "fixtures" / "java-smartbi-golden"
)


def _load_production_main() -> Any:
    main_py = (
        pathlib.Path(__file__).resolve().parents[3]
        / "backend" / "python" / "main.py"
    )
    spec = importlib.util.spec_from_file_location(
        "phase2a_production_main_analysis_sales", main_py,
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_production_main = _load_production_main()


@pytest.fixture
def app(monkeypatch):
    """F999 empty-state — stubs already return empty shapes, no patch needed."""
    return _production_main.app


@pytest.fixture
def client(app):
    return TestClient(app)


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture
def f999_token():
    return _make_token("F999")


@pytest.fixture
def f001_token():
    return _make_token("F001")


# Re-export _strip_volatile for sibling spec test classes
from smartbi_compat.api.analysis_sales import _strip_volatile  # noqa: E402


class TestEnvelope:
    """Foundation merge gate. Sibling specs add Test{Overview,Rankings,Trend,Gold}."""

    # Tests added in Tasks E.2 + E.3
    pass
```

- [ ] **Step 3: Verify import-clean**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py --collect-only 2>&1 | tail -5
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `0 tests collected` (TestEnvelope is empty `pass`).

- [ ] **Step 4: Commit**

```bash
git add tests/python/smartbi_compat/test_analysis_sales_contract.py
git status --short
git commit -m "test(phase2a): scaffold test_analysis_sales_contract.py

Foundation Task E.1. Skeleton with TestEnvelope class + fixtures
(app/client/f999_token/f001_token). Test methods added in E.2 + E.3." -- tests/python/smartbi_compat/test_analysis_sales_contract.py
```

---

### Task E.2: Add envelope tests (route / JWT / factory isolation / dimension ignored)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

- [ ] **Step 1: Replace `pass` with envelope test methods**

Replace `class TestEnvelope:` body in the test file:

```python
class TestEnvelope:
    """Foundation merge gate. Sibling specs add Test{Overview,Rankings,Trend,Gold}."""

    def test_route_registered(self, client, f999_token):
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body.get("success") is True
        assert "data" in body

    def test_jwt_required(self, client):
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
        )
        assert response.status_code in (401, 403)

    def test_factory_id_isolation(self, client, f999_token):
        """F999 token must be rejected for F001 path."""
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 403

    def test_dimension_param_ignored(self, client, f999_token):
        """Java line 110 short-circuit: when smartBIService≠null, dimension
        query param is read but NOT branched on. F999 goldens (with/without
        dimension=salesperson) are byte-identical except _meta."""
        r_no_dim = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        r_with_dim = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={
                "startDate": "2025-01-01",
                "endDate": "2025-12-31",
                "dimension": "salesperson",
            },
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert r_no_dim.status_code == 200
        assert r_with_dim.status_code == 200
        # After stripping volatile timestamps, the responses must be equal
        assert _strip_volatile(r_no_dim.json()) == _strip_volatile(r_with_dim.json())
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

⚠ If `test_factory_id_isolation` fails with status != 403, check `verify_jwt_and_factory` behavior — it should compare path factory_id against token factory_id and 403 on mismatch. If existing impl differs, this test reflects a real auth gap that must be reconciled before sibling specs proceed (escalate to user).

- [ ] **Step 3: Commit**

```bash
git add tests/python/smartbi_compat/test_analysis_sales_contract.py
git status --short
git commit -m "test(phase2a): TestEnvelope route/JWT/isolation/dimension tests

Foundation Task E.2. 4 tests covering: route registration, JWT-required,
factory_id mismatch 403, dimension param ignored (Java short-circuit
parity verified by F999 dimension=salesperson golden being byte-identical)." -- tests/python/smartbi_compat/test_analysis_sales_contract.py
```

---

### Task E.3: Add F999 byte-shape gate test

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

- [ ] **Step 1: Append the gate test to TestEnvelope**

Add to the `TestEnvelope` class body in the test file:

```python
    def test_F999_empty_state_byte_shape(self, client, f999_token):
        """Foundation merge gate. F999 has no sales data → composite Map
        matches golden after strip-volatile."""
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200

        actual = _strip_volatile(response.json())

        with open(GOLDEN_DIR / "analysis-sales-F999.json", encoding="utf-8") as f:
            golden = json.load(f)
        # Golden file format wraps response: {"verb":..., "response": {...}, "_meta": ...}
        expected_response = _strip_volatile(golden["response"])

        # The Python actual envelope shape may differ slightly from Java
        # (e.g. envelope `code`/`httpStatus` keys). Compare just the `data`
        # field which is what foundation owns.
        assert actual.get("data") == expected_response.get("data"), (
            f"F999 data byte-shape mismatch.\n"
            f"Actual data keys: "
            f"{sorted(actual.get('data', {}).keys()) if isinstance(actual.get('data'), dict) else 'N/A'}\n"
            f"Expected data keys: "
            f"{sorted(expected_response.get('data', {}).keys()) if isinstance(expected_response.get('data'), dict) else 'N/A'}"
        )
```

- [ ] **Step 2: Run gate test**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope::test_F999_empty_state_byte_shape -v 2>&1 | tail -30
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: PASS.

If FAIL, debug iteratively:
1. Print `actual["data"]` and `expected_response["data"]` side by side
2. Compare keys at top level — must match exactly (7 keys observed in F999)
3. Compare each nested dict — `overview` 16 fields, `dateRange` 7 fields, `trendChart` 7 fields
4. Common gotchas:
   - `data: []` vs `data: null` — F999 has `data: []` for ChartConfig
   - `options: {...}` vs `options: null` — F999 has hardcoded options dict
   - Key order — Python dict insertion order must match observed F999 order
   - `lastUpdated` not stripped — verify _strip_volatile catches it

- [ ] **Step 3: Run all envelope tests**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/python/smartbi_compat/test_analysis_sales_contract.py
git status --short
git commit -m "test(phase2a): F999 empty-state byte-shape gate test

Foundation Task E.3. THE foundation merge gate. F999 has no sales
data so Python stubs return empty-state shape that matches Java
buildEmptyDashboard byte for byte (after strip-volatile)." -- tests/python/smartbi_compat/test_analysis_sales_contract.py
```

---

## Phase F — Goldens recording script + verification

### Task F.1: Create `record-analysis-sales-goldens.sh`

**Files:**
- Create: `scripts/phase2a/record-analysis-sales-goldens.sh`

- [ ] **Step 1: Look at precedent script**

```bash
ls scripts/phase2a/record-*.sh 2>&1
```

Pick one (e.g. `record-alerts-goldens.sh`) to model after. Read first 50 lines:

```bash
head -50 scripts/phase2a/record-alerts-goldens.sh
```

- [ ] **Step 2: Write the analysis-sales script**

Create `scripts/phase2a/record-analysis-sales-goldens.sh` matching the alerts script style. Adapt:

```bash
#!/usr/bin/env bash
# Records F999 + F001 goldens for /analysis/sales endpoint against test env (10011).
#
# Triggers for re-recording:
#   - Java side adds/removes DashboardResponse fields
#   - Java side TreeMap/HashMap sort fix changes ranking output order
#   - F001 calibration data seeded (rankings + trend specs Q8=yes)
#
# Output:
#   tests/fixtures/java-smartbi-golden/analysis-sales-F999.json
#   tests/fixtures/java-smartbi-golden/analysis-sales-dimension-salesperson-F999.json
#   tests/fixtures/java-smartbi-golden/analysis-sales-F001.json
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GOLDEN_DIR="${REPO_ROOT}/tests/fixtures/java-smartbi-golden"
JAVA_BASE="${JAVA_BASE:-http://47.100.235.168:10011}"
START_DATE="2025-01-01"
END_DATE="2025-12-31"

mkdir -p "${GOLDEN_DIR}"

# Need: Java auth tokens for F999 + F001 (test env). The alerts golden
# script has a token-mint helper — reuse the same approach.

# 1. F999 (no dimension)
record_golden() {
    local factory_id="$1"
    local token="$2"
    local out_name="$3"
    local extra_query="${4:-}"

    local query="startDate=${START_DATE}&endDate=${END_DATE}"
    if [[ -n "$extra_query" ]]; then
        query="${query}&${extra_query}"
    fi

    echo "Recording ${out_name} for factory ${factory_id}..."
    local out_path="${GOLDEN_DIR}/${out_name}"

    local resp
    resp="$(curl -sf -H "Authorization: Bearer ${token}" \
        "${JAVA_BASE}/api/mobile/${factory_id}/smart-bi/analysis/sales?${query}")"

    local recorded_at
    recorded_at="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"

    # Wrap in canonical golden envelope
    python3 -c "
import json, sys
resp = json.loads('''${resp}''')
golden = {
    'verb': 'GET',
    'path': '/api/mobile/${factory_id}/smart-bi/analysis/sales',
    'factory': '${factory_id}',
    'response': resp,
    '_meta': {
        'name': '${out_name%.json}',
        'verb': 'GET',
        'path': '/api/mobile/${factory_id}/smart-bi/analysis/sales',
        'query': {'startDate': '${START_DATE}', 'endDate': '${END_DATE}'},
        'factory': '${factory_id}',
        'recordedAt': '${recorded_at}',
        'javaPort': 10011,
    },
}
with open('${out_path}', 'w', encoding='utf-8') as f:
    json.dump(golden, f, ensure_ascii=False, indent=2)
"
    echo "  → ${out_path}"
}

# Token minting — model after scripts/phase2a/record-alerts-goldens.sh
F999_TOKEN="${F999_TOKEN:-$(<token logic here>)}"
F001_TOKEN="${F001_TOKEN:-$(<token logic here>)}"

record_golden "F999" "${F999_TOKEN}" "analysis-sales-F999.json"
record_golden "F999" "${F999_TOKEN}" "analysis-sales-dimension-salesperson-F999.json" "dimension=salesperson"
record_golden "F001" "${F001_TOKEN}" "analysis-sales-F001.json"

echo "Done. 3 goldens written under ${GOLDEN_DIR}/"
```

⚠ Replace `<token logic here>` by reading the alerts script's token-mint pattern.

- [ ] **Step 3: Make executable**

```bash
chmod +x scripts/phase2a/record-analysis-sales-goldens.sh
```

- [ ] **Step 4: Smoke test (optional — only if test env reachable)**

```bash
ls -l scripts/phase2a/record-analysis-sales-goldens.sh
```

Confirm `-rwxr-xr-x` (executable). Don't run the full script yet — F999/F001 goldens already exist; running unnecessarily risks overwriting them mid-foundation work.

- [ ] **Step 5: Commit**

```bash
git add scripts/phase2a/record-analysis-sales-goldens.sh
git status --short
git commit -m "feat(phase2a): record-analysis-sales-goldens.sh script

Foundation Task F.1. Records F999 + F999-dimension-salesperson + F001
goldens from Java test env (10011). Triggers: Java DTO changes, sort
fix, F001 calibration seed (Q8=yes for rankings + trend specs)." -- scripts/phase2a/record-analysis-sales-goldens.sh
```

---

### Task F.2: Full pytest suite + 0-regression check

**Files:** read-only verification

- [ ] **Step 1: Run smartbi_compat full test suite**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/ -v 2>&1 | tail -25
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: all tests pass (alerts + recommendations + analysis_sales factories + analysis_sales contract). Count ≥ 74 (baseline pre-foundation) + ~30 new factory + envelope tests = ~104+.

If any pre-existing test fails, this is a regression — escalate.

- [ ] **Step 2: Confirm only foundation-owned files changed**

```bash
git log --oneline phase2a/t5-poc...HEAD~30 2>/dev/null | head -20
git diff --stat HEAD~12 HEAD -- ':!docs/' 2>&1 | tail -10
```

Verify diff includes only:
- `backend/python/smartbi_compat/api/analysis.py` (1-line SQL extension)
- `backend/python/smartbi_compat/api/analysis_sales.py` (new file)
- `backend/python/smartbi_compat/date_range.py` (potential days/valid props)
- `backend/python/main.py` (router include)
- `tests/python/smartbi_compat/test_analysis_sales_factories.py` (new)
- `tests/python/smartbi_compat/test_analysis_sales_contract.py` (new)
- `scripts/phase2a/record-analysis-sales-goldens.sh` (new)

If unrelated files appear, scope creep occurred — investigate.

- [ ] **Step 3: Run a final clean test run summary**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: terminal line like `104 passed in 5.21s` or similar.

- [ ] **Step 4: Branch state summary**

```bash
git log --oneline phase2a/t5-poc -15
echo "---"
git diff origin/main..phase2a/t5-poc --stat | tail -5
```

Note the count of commits ahead of origin/main (was 18 pre-foundation; should be ~30+ post-foundation).

- [ ] **Step 5: No commit (verification only)**

This task is read-only verification. The previous tasks have already committed their work.

---

### Task F.3: Optional — deploy to test env + smoke

**Files:** none (deployment only)

⚠ Skip if working entirely locally / not yet ready to share.

- [ ] **Step 1: Deploy Python service to test env**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test 2>&1 | tail -20
```

Expected: rsync sync + restart + 200 health response from `http://47.100.235.168:8084/health`.

- [ ] **Step 2: Smoke /analysis/sales on test env**

⚠ This requires routing the /analysis/sales path through the Python compat router to reach the Python implementation, NOT to the Java backend. Verify nginx/routing config supports this; the alerts/recommendations endpoints already do, so the same pattern applies.

```bash
F999_TOKEN="<obtain test env F999 JWT>"
curl -s -H "Authorization: Bearer ${F999_TOKEN}" \
  "http://47.100.235.168:8084/api/mobile/F999/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31" \
  | python3 -m json.tool | head -30
```

Expected: `success: true`, `data` containing `overview / customerRanking / productRanking / dateRange / salespersonRanking / generatedAt / trendChart`.

- [ ] **Step 3: No commit (deploy only)**

Tag this run in your notes; sibling spec chats may need to redeploy after their changes.

---

## Self-review checklist

Before marking foundation as done, run through:

**1. Spec coverage scan**

- [ ] §2.1 New module file → Task C.1 ✓
- [ ] §2.2 Route registration → Task D.3 ✓
- [ ] §2.3 Composite assembly → Task D.2 ✓
- [ ] §2.4 5 sub-service stubs → Task D.1 ✓
- [ ] §2.5 5 DTO dict factories → Tasks C.3-C.8 ✓ (date / dashboard / ranking / chart / insight / kpi)
- [ ] §2.6 DateRange Python port → Task A.2 ✓
- [ ] §2.7 SQL helper extension → Task B.1 ✓
- [ ] §2.8 Test fixture file → Tasks E.1-E.3 ✓
- [ ] §2.9 Strip-volatile helper → Task C.2 ✓
- [ ] §2.10 Goldens recording script → Task F.1 ✓

**2. Placeholder scan** (search for these in this plan)

- [ ] No "TBD" / "TODO" / "implement later" in any task body
- [ ] All test code is complete (no `# add tests here` placeholders)
- [ ] All implementation code is shown in full (no `def function(): pass # implement`)
- [ ] All bash commands are exact + have expected output

**3. Type consistency**

- [ ] `_new_dashboard_response_dict` parameters in C.4 == those used in D.1 stub (`ai_insights`, `suggestions`, `last_updated`) ✓
- [ ] `_new_ranking_item_dict` 6 fields in C.5 == 6 fields used by sibling specs (rank/name/value/target/completionRate/alertLevel) ✓
- [ ] `_new_chart_config_dict` parameters in C.6 == those used in D.1 trend stub ✓
- [ ] `_get_X` async signatures in D.1 == those imported in D.2 composite + tested in E.2/E.3 ✓
- [ ] `_strip_volatile` shape in C.2 matches usage in E.2/E.3 (returns same type as input) ✓

**4. Cross-task references**

- [ ] Task C.4 says key order matches Java declaration order — verified by C.4 step 1 test ✓
- [ ] Task D.2 says key order matches F999 golden Jackson order — verified by D.2 step 1 test ✓
- [ ] Task E.3 references F999 golden file path — verified to exist (foundation §3 mentions 78-line file) ✓

**5. Concurrent-edit safety**

- [ ] Every commit uses `git commit ... -- <specific paths>` (--only mode) per concurrent-edit rule 5b ✓
- [ ] Every commit preceded by `git status --short` ✓
- [ ] No auto-staging via `git add -A` or `git add .` ✓

If any item fails, fix the corresponding task inline before execution.

---

## Done criteria (foundation merge gate)

Foundation merge is complete when ALL of:

- [ ] All Phase A verification tasks pass (F001 has Gold data + legacy 0 rows + DateRange has days/valid + async bridge OK + 5 DTO getter lists known)
- [ ] All Phase B-F commits land on `phase2a/t5-poc`
- [ ] Full smartbi_compat pytest suite passes (Task F.2)
- [ ] `test_analysis_sales_contract.py::TestEnvelope` 5/5 pass (incl. F999 byte gate)
- [ ] `test_analysis_sales_factories.py` ≥ 35 pass (8 strip + 4 daterange + 4 dashboard + 4 ranking + 4 chart + 2 insight + 4 kpi + 6 stubs + 3 composite)
- [ ] No regression on alerts / recommendations contract tests
- [ ] No scope creep (only files listed in F.2 step 2 changed)

Post-merge, sibling specs (overview / gold / rankings / trend) can run sequentially or in sub-worktrees per concurrent-edit rule.

---

## Estimated execution

- Phase A: 30-45 min (4 verification tasks)
- Phase B: 15 min (1 SQL extension + regression check)
- Phase C: 60-90 min (8 TDD factory tasks)
- Phase D: 30-45 min (4 wiring tasks)
- Phase E: 30 min (3 contract test tasks)
- Phase F: 15-30 min (script + verification + optional deploy)

**Total: 3-4 hours** for foundation chat (matches spec §10 estimate).

---

End of plan.
