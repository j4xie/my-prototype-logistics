# Phase 2A `/analysis/sales` Gold Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `_get_sales_overview` stub body in `analysis_sales.py` with Gold-first dispatch (calling `smartbi.gold.queries`); when Gold returns non-null produce DashboardResponse-shape dict matching F001 golden byte-for-byte; when Gold returns null fall back to placeholder `_build_legacy_sales_overview` (overview spec replaces the legacy body later).

**Architecture:** Pure Python adapter — no HTTP self-call, no new SQL. Direct imports from `smartbi.gold.queries` (`finance_summary` / `daily_trend` / `top_products`) wrapped in module-level seam functions for monkey-patching. Mirrors Java `GoldDashboardBuilder.java` (247 LOC) function-for-function: `_build_from_gold_finance_summary` (KPIs + top_stores) + `_build_from_gold_with_charts` (wrapper) + `_fetch_gold_trend_chart` + `_fetch_gold_category_chart` + 2 helpers (`_to_decimal`, `_format_kpi_value`).

**Tech Stack:** Python 3.11 + asyncpg + `smartbi.gold.queries` + pytest with monkeypatch + `Decimal.quantize(Decimal("0.01"), ROUND_HALF_UP)` for Java BigDecimal parity.

**Spec reference:** `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-gold-design.md`

**Foundation prereqs (already on `phase2a/t5-poc`)**:
- All 5 sub-services already `async def` (foundation D.1)
- `_new_dashboard_response_dict` / `_new_kpi_card_dict` / `_new_ranking_item_dict` / `_new_chart_config_dict` / `_new_ai_insight_dict` factories all in foundation
- `_strip_volatile` available in `analysis_sales.py`
- F999 byte-shape contract test passing (foundation merge gate)

**Sibling specs** (NOT touched by this plan): overview / rankings / trend.

---

## Pre-flight check

Before starting Task A.1, confirm:

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
pwd                              # /c/Users/.../.worktrees/phase2a-t5-poc
git rev-parse --abbrev-ref HEAD  # phase2a/t5-poc
git log --oneline -1             # 7d3ab017c feat(phase2a): record-analysis-sales-goldens.sh script
git status --short               # (no output — clean)
/b/anaconda3/python.exe -m pytest tests/python/smartbi_compat/ -q 2>&1 | tail -3   # 118 passed
```

If any check fails, STOP and reconcile before proceeding.

---

## Local env note

For Python invocations, use **`/b/anaconda3/python.exe`** (Windows AppX `python3` stub lacks SQLAlchemy/asyncpg/etc).

For pytest: `/b/anaconda3/python.exe -m pytest ...`.

---

## Phase A — Pre-impl verification

### Task A.1: Verify `smartbi.gold.queries` exports + signatures match spec

**Files:** read-only

- [ ] **Step 1: Read function signatures from queries.py**

```bash
grep -n -E "^(def|async def) (finance_summary|daily_trend|top_products)" backend/python/smartbi/gold/queries.py
```

Expected output (3 lines):
```
46:async def daily_trend(
94:async def top_products(
364:async def finance_summary(
```

If any function is missing, escalate — Gold spec depends on these.

- [ ] **Step 2: Verify exact parameter names (CRITICAL — spec §2 had wrong kwarg name for top_products)**

Read each function's signature line range:

```bash
sed -n '46,52p' backend/python/smartbi/gold/queries.py
sed -n '94,102p' backend/python/smartbi/gold/queries.py
sed -n '364,371p' backend/python/smartbi/gold/queries.py
```

**Confirm**:
- `daily_trend(pool, factory_id, date_range)` — no kwargs
- `top_products(pool, factory_id, date_range, *, top_n=10)` — kwarg is `top_n` NOT `limit`
- `finance_summary(pool, factory_id, date_range, *, top_n_stores=10)` — kwarg is `top_n_stores`

Plan adapter calls MUST use `top_n=8` (NOT `limit=8` from spec §2 — spec was wrong; that was the HTTP query param name, not Python kwarg).

- [ ] **Step 3: Read return shape of `finance_summary`**

```bash
sed -n '430,445p' backend/python/smartbi/gold/queries.py
```

Expected return dict keys: `factory_id / start_date / end_date / total_revenue / bill_count / avg_bill_value / store_count / day_count / top_stores`

`top_stores` items have keys: `store_id / store_name / revenue / bill_count`.

- [ ] **Step 4: Save findings**

No commit. Log signature snapshot in your task notes for B.3 (seam function calls) and C.1-C.3 (adapter calls).

---

### Task A.2: Verify F001 has agg_daily Gold data + run Gold infra baseline

**Files:** read-only

- [ ] **Step 1: Confirm F001 has 1730+ Gold rows in 2025 window**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -t -c \"SELECT COUNT(*) FROM agg_daily WHERE factory_id='F001' AND date BETWEEN '2025-01-01' AND '2025-12-31'\""
```

Expected: `1730` (or higher). Foundation A.1 already confirmed but re-verify in case data shifted.

If 0, escalate — Gold spec depends on this.

- [ ] **Step 2: Run existing Gold aggregations test for baseline**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest tests/test_gold_aggregations.py -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: all pass (or skip if env-dependent — if all skip, that's a concern; record actual pass/fail/skip count).

If many failures, escalate — Gold infrastructure is unhealthy and adapter will inherit problems.

- [ ] **Step 3: No commit (verification only)**

---

### Task A.3: Read F001 golden overview structure (record byte-shape expectations)

**Files:** read-only

- [ ] **Step 1: Inspect F001 golden overview field**

```bash
/b/anaconda3/python.exe -c "
import json
with open('tests/fixtures/java-smartbi-golden/analysis-sales-F001.json', encoding='utf-8') as f:
    g = json.load(f)
ov = g['response']['data']['overview']
print('overview keys (16 expected):', len(ov.keys()))
print('kpiCards count (4 expected):', len(ov['kpiCards']))
print('charts keys (sales_trend + category_distribution expected):', list(ov['charts'].keys()))
print('rankings keys (top_stores expected):', list(ov['rankings'].keys()))
print('top_stores count (8 expected):', len(ov['rankings']['top_stores']))
print('sales_trend.data count (365 expected):', len(ov['charts']['sales_trend']['data']))
print('category_distribution.data count (8 expected):', len(ov['charts']['category_distribution']['data']))
print('sales_trend.options (None expected):', ov['charts']['sales_trend']['options'])
print('category_distribution.options (None expected):', ov['charts']['category_distribution']['options'])
print('aiInsights:', ov['aiInsights'])
print('suggestions:', ov['suggestions'])
"
```

Record findings:
- 4 KPI cards: total_revenue / bill_count / avg_bill_value / store_count
- 8 top_stores
- charts.sales_trend: LINE, 365 points, options=None
- charts.category_distribution: PIE, 8 categories, options=None
- aiInsights = []
- suggestions = []

If any count or shape diverges from these expectations, escalate.

- [ ] **Step 2: Inspect first KPI card byte-shape**

```bash
/b/anaconda3/python.exe -c "
import json
with open('tests/fixtures/java-smartbi-golden/analysis-sales-F001.json', encoding='utf-8') as f:
    g = json.load(f)
card = g['response']['data']['overview']['kpiCards'][0]
print('keys (13 expected):', sorted(card.keys()))
print('total_revenue card:', card)
"
```

Confirm 13 keys, status='green', most fields null except key/title/value/rawValue/unit/status.

- [ ] **Step 3: No commit (verification only)**

Total Phase A: 3 tasks, 30-45 min, 0 commits.

---

## Phase B — Helpers + module-level seams

### Task B.1: Add `_to_decimal` helper (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 1, after KPICard factory)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Append failing test class**

Append to `tests/python/smartbi_compat/test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _to_decimal


class TestToDecimal:
    def test_int_input(self):
        assert _to_decimal(42) == Decimal("42")

    def test_float_input(self):
        # float 12.5 -> str round-trip -> Decimal("12.5")
        assert _to_decimal(12.5) == Decimal("12.5")

    def test_decimal_input_passthrough(self):
        d = Decimal("100.00")
        assert _to_decimal(d) is d

    def test_string_input(self):
        assert _to_decimal("99.99") == Decimal("99.99")

    def test_none_returns_zero(self):
        """Mirror Java toBigDecimal returning ZERO on null."""
        assert _to_decimal(None) == Decimal("0")

    def test_invalid_input_returns_zero(self):
        """Mirror Java catching parse errors and returning ZERO."""
        assert _to_decimal("not_a_number") == Decimal("0")
        assert _to_decimal(object()) == Decimal("0")
```

- [ ] **Step 2: Run test - confirm RED**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestToDecimal -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError: cannot import name '_to_decimal'`.

- [ ] **Step 3: Implement helper**

Use Edit tool. APPEND to Section 1 of `analysis_sales.py` (after `_new_kpi_card_dict`):

```python
def _to_decimal(v: Any) -> Decimal:
    """Tolerant Number -> Decimal conversion. Mirrors Java GoldDashboardBuilder.toBigDecimal.

    Returns Decimal("0") on None, parse errors, or unsupported types
    (matches Java's BigDecimal.ZERO fallback).

    Decimal passthrough preserves identity (no re-wrap).
    Float input goes via str() to preserve representation (12.5 -> "12.5" -> Decimal("12.5")).
    """
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, bool):  # bool is int subclass - guard before int branch
        return Decimal("0")
    if isinstance(v, int):
        return Decimal(v)
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, str):
        try:
            return Decimal(v)
        except Exception:
            return Decimal("0")
    return Decimal("0")
```

- [ ] **Step 4: Run test - confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestToDecimal -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): _to_decimal helper for Gold adapter

Gold spec Task B.1. Mirrors Java GoldDashboardBuilder.toBigDecimal:
None / parse errors / bool / unsupported types -> Decimal('0').
Float via str() round-trip preserves representation." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task B.2: Add `_format_kpi_value` helper (TDD - trailing zero G3 risk)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Append failing test class**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _format_kpi_value


class TestFormatKpiValue:
    def test_yuan_unit_2_decimals(self):
        """Yuan unit -> 2-decimal string (matches Java setScale(2, HALF_UP).toPlainString)."""
        assert _format_kpi_value(Decimal("20639884.52"), "元") == "20639884.52"

    def test_yuan_preserves_trailing_zero(self):
        """G3 risk: 100.50 must stay '100.50', NOT normalize to '100.5'."""
        assert _format_kpi_value(Decimal("100.50"), "元") == "100.50"

    def test_yuan_round_half_up(self):
        """Java HALF_UP: 1.005 rounds to 1.01."""
        assert _format_kpi_value(Decimal("1.005"), "元") == "1.01"

    def test_yuan_one_decimal_inputs_pad_to_two(self):
        assert _format_kpi_value(Decimal("12.5"), "元") == "12.50"

    def test_integer_unit_no_decimals(self):
        """Integer-style unit -> integer string."""
        assert _format_kpi_value(Decimal("140541"), "单") == "140541"
        assert _format_kpi_value(Decimal("8"), "家") == "8"

    def test_integer_unit_rounds_decimals(self):
        """Decimal input with fraction + integer unit -> round to int."""
        assert _format_kpi_value(Decimal("8.6"), "家") == "9"

    def test_zero_value_yuan(self):
        assert _format_kpi_value(Decimal("0"), "元") == "0.00"

    def test_zero_value_integer_unit(self):
        assert _format_kpi_value(Decimal("0"), "单") == "0"
```

- [ ] **Step 2: Run test - confirm RED**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestFormatKpiValue -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError`.

- [ ] **Step 3: Implement helper**

APPEND to Section 1 of `analysis_sales.py` (after `_to_decimal`):

```python
from decimal import ROUND_HALF_UP


def _format_kpi_value(v: Decimal, unit: str) -> str:
    """Format Decimal for KPICard.value. Mirrors Java GoldDashboardBuilder.formatKpiValue.

    Yuan unit ("元") -> 2-decimal string preserving trailing zeros (Java setScale(2, HALF_UP).toPlainString).
    Other units -> integer string (rounded HALF_UP).

    Critical (G3): use str() of quantize result, NOT normalize() - normalize() strips
    trailing zeros (12.50 -> 12.5) and breaks Java byte parity.
    """
    if unit == "元":
        return str(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return str(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
```

⚠ The `from decimal import ROUND_HALF_UP` import — if it's already imported at top of `analysis_sales.py`, don't duplicate. Check existing imports first; if missing, add to the existing `from decimal import Decimal` line: `from decimal import Decimal, ROUND_HALF_UP`.

- [ ] **Step 4: Run test - confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestFormatKpiValue -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 8 tests pass.

⚠ If `test_yuan_preserves_trailing_zero` fails ("100.5" instead of "100.50"), the impl used `.normalize()` — fix to use `str()` of quantize result directly.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): _format_kpi_value helper for KPICard.value

Gold spec Task B.2. Mirrors Java formatKpiValue with G3 trailing-zero
preservation: yuan -> 2-decimal HALF_UP via str(quantize()), NOT normalize().
Other units -> integer string." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task B.3: Add 3 module-level seams for monkeypatch

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`

No new test - seams are thin pass-throughs exercised by C.1-C.3 contract tests via monkeypatch.

- [ ] **Step 1: APPEND seams to Section 3 (just after `_utc_now_iso`)**

Use Edit tool. Find the line in Section 3 where `_utc_now_iso` ends (last line is `return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()`). APPEND directly after:

```python


# ============================================================
# Section 3a: Gold-path module-level seams (monkeypatch boundary)
# ============================================================


async def _call_finance_summary(pool, factory_id: str, date_range, *, top_n_stores: int = 10):
    """Module-level seam wrapping smartbi.gold.queries.finance_summary.

    Indirection exists so contract tests can monkey-patch at this module's
    namespace without monkey-patching the queries module globally.
    """
    from smartbi.gold.queries import finance_summary
    return await finance_summary(pool, factory_id, date_range, top_n_stores=top_n_stores)


async def _call_daily_trend(pool, factory_id: str, date_range):
    """Module-level seam wrapping smartbi.gold.queries.daily_trend."""
    from smartbi.gold.queries import daily_trend
    return await daily_trend(pool, factory_id, date_range)


async def _call_top_products(pool, factory_id: str, date_range, *, top_n: int = 8):
    """Module-level seam wrapping smartbi.gold.queries.top_products.

    Note: spec said limit=8 but Python kwarg is `top_n` (verified A.1 step 2).
    Default top_n=8 here matches Java GoldDashboardBuilder.fetchCategoryChart.
    """
    from smartbi.gold.queries import top_products
    return await top_products(pool, factory_id, date_range, top_n=top_n)
```

- [ ] **Step 2: Verify import-clean (no execution)**

```bash
cd backend/python
/b/anaconda3/python.exe -c "
from smartbi_compat.api.analysis_sales import _call_finance_summary, _call_daily_trend, _call_top_products
import asyncio
print('seams importable:', all(asyncio.iscoroutinefunction(f) for f in [_call_finance_summary, _call_daily_trend, _call_top_products]))
"
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `seams importable: True`.

- [ ] **Step 3: Run cumulative regression (factories suite — should be 44 = 30 foundation + 6 ToDecimal + 8 FormatKpiValue)**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py -q 2>&1 | tail -3
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 44 passed.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): 3 module-level seams for Gold queries

Gold spec Task B.3. Wraps smartbi.gold.queries.{finance_summary, daily_trend,
top_products} so contract tests can monkey-patch at analysis_sales module
namespace. Default top_n=8 for top_products matches Java fetchCategoryChart." -- backend/python/smartbi_compat/api/analysis_sales.py
```

NOTE: B.3 commit is 1 file only.

Total Phase B: 3 tasks, 30-45 min, 3 commits.

---

## Phase C — Adapter implementations

### Task C.1: `_build_from_gold_finance_summary` (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 3a or new Section 3b)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test class**

Append to `test_analysis_sales_factories.py`:

```python
import asyncio as _asyncio_c1
from smartbi_compat.api.analysis_sales import _build_from_gold_finance_summary


class TestBuildFromGoldFinanceSummary:
    F001_GOLD = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "total_revenue": 20639884.52,
        "bill_count": 140541,
        "avg_bill_value": 146.86,
        "store_count": 8,
        "top_stores": [
            {"store_id": "S1", "store_name": "葱花传奇日月光店", "revenue": 7431228.74, "bill_count": 50000},
            {"store_id": "S2", "store_name": "葱花传奇浦东店", "revenue": 5200000.00, "bill_count": 35000},
        ],
    }

    EMPTY_GOLD = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "total_revenue": 0,
        "bill_count": 0,
        "avg_bill_value": None,
        "store_count": 0,
        "top_stores": [],
    }

    def _patch_seam(self, monkeypatch, gold_response):
        from smartbi_compat.api import analysis_sales as mod
        async def fake(pool, fid, dr, *, top_n_stores=10):
            return gold_response
        monkeypatch.setattr(mod, "_call_finance_summary", fake)

    def test_returns_dashboard_response_dict_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result is not None
        # 16-field DashboardResponse shape
        assert set(result.keys()) == {
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        }

    def test_returns_4_kpi_cards_with_correct_keys(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert len(result["kpiCards"]) == 4
        keys = [c["key"] for c in result["kpiCards"]]
        assert keys == ["total_revenue", "bill_count", "avg_bill_value", "store_count"]

    def test_kpi_card_total_revenue_full_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        card = result["kpiCards"][0]
        assert card["key"] == "total_revenue"
        assert card["title"] == "总营收"
        assert card["value"] == "20639884.52"
        assert card["rawValue"] == Decimal("20639884.52")
        assert card["unit"] == "元"
        assert card["status"] == "green"
        # Other 7 fields all None
        assert card["change"] is None
        assert card["changeRate"] is None
        assert card["trend"] is None
        assert card["compareText"] is None
        assert card["description"] is None
        assert card["targetValue"] is None
        assert card["completionRate"] is None

    def test_kpi_card_bill_count_integer_format(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        card = result["kpiCards"][1]
        assert card["key"] == "bill_count"
        assert card["title"] == "账单数"
        assert card["value"] == "140541"
        assert card["unit"] == "单"

    def test_top_stores_ranking_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert "top_stores" in result["rankings"]
        ts = result["rankings"]["top_stores"]
        assert len(ts) == 2
        assert ts[0]["rank"] == 1
        assert ts[0]["name"] == "葱花传奇日月光店"
        assert ts[0]["value"] == Decimal("7431228.74")
        assert ts[0]["target"] is None
        assert ts[0]["completionRate"] is None
        assert ts[0]["alertLevel"] is None
        assert ts[1]["rank"] == 2

    def test_ai_insights_and_suggestions_empty(self, monkeypatch, range_2025):
        """Java line 113-114: empty list, NOT None."""
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result["aiInsights"] == []
        assert result["suggestions"] == []

    def test_charts_empty_dict_initially(self, monkeypatch, range_2025):
        """Charts populated by _build_from_gold_with_charts wrapper, not here."""
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result["charts"] == {}

    def test_empty_short_circuit_returns_none(self, monkeypatch, range_2025):
        """revenue=0 AND bill_count=0 -> return None (legacy fallback)."""
        self._patch_seam(monkeypatch, self.EMPTY_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result is None

    def test_is_async(self):
        assert _asyncio_c1.iscoroutinefunction(_build_from_gold_finance_summary)
```

- [ ] **Step 2: Run test - confirm RED**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestBuildFromGoldFinanceSummary -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError`.

- [ ] **Step 3: Implement `_build_from_gold_finance_summary`**

APPEND a new Section 3b to `analysis_sales.py` (after the 3 seams from B.3):

```python


# ============================================================
# Section 3b: Gold-path adapter functions (mirror Java GoldDashboardBuilder)
# ============================================================


async def _build_from_gold_finance_summary(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.buildFromFinanceSummary (lines 58-117).

    Builds the base DashboardResponse shape from Gold's finance_summary:
      - 4 KPI cards (total_revenue / bill_count / avg_bill_value / store_count)
      - top_stores ranking (rank+name+value only)
      - charts={} (populated by _build_from_gold_with_charts wrapper)
      - aiInsights=[] / suggestions=[] (Java line 113-114)

    Returns None when both revenue and bill_count are 0 (legacy fallback signal).
    """
    gold = await _call_finance_summary(
        pool, factory_id, (range_.start_date, range_.end_date), top_n_stores=10,
    )
    revenue = _to_decimal(gold.get("total_revenue"))
    bills = _to_decimal(gold.get("bill_count"))
    avg_bill = _to_decimal(gold.get("avg_bill_value"))
    stores = _to_decimal(gold.get("store_count"))

    if revenue == Decimal("0") and bills == Decimal("0"):
        logger.info(
            "[gold-builder] factory=%s range=%s..%s empty Gold -> None (legacy fallback)",
            factory_id, range_.start_date, range_.end_date,
        )
        return None

    kpi_cards = [
        _new_kpi_card_dict(
            key="total_revenue", title="总营收",
            value=_format_kpi_value(revenue, "元"), raw_value=revenue,
            unit="元", status="green",
        ),
        _new_kpi_card_dict(
            key="bill_count", title="账单数",
            value=_format_kpi_value(bills, "单"), raw_value=bills,
            unit="单", status="green",
        ),
        _new_kpi_card_dict(
            key="avg_bill_value", title="客单价",
            value=_format_kpi_value(avg_bill, "元"), raw_value=avg_bill,
            unit="元", status="green",
        ),
        _new_kpi_card_dict(
            key="store_count", title="门店数",
            value=_format_kpi_value(stores, "家"), raw_value=stores,
            unit="家", status="green",
        ),
    ]

    top_stores = []
    for i, store in enumerate(gold.get("top_stores", []), start=1):
        top_stores.append(_new_ranking_item_dict(
            rank=i,
            name=str(store.get("store_name", "")),
            value=_to_decimal(store.get("revenue")),
            target=None,
            completion_rate=None,
            alert_level=None,
        ))

    return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        rankings={"top_stores": top_stores},
        charts={},
        ai_insights=[],
        suggestions=[],
        last_updated=_utc_now_iso(),
    )
```

- [ ] **Step 4: Run test - confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestBuildFromGoldFinanceSummary -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): _build_from_gold_finance_summary adapter

Gold spec Task C.1. Mirrors Java GoldDashboardBuilder.buildFromFinanceSummary
(lines 58-117): 4 KPI cards (total_revenue / bill_count / avg_bill_value /
store_count) + top_stores ranking + empty short-circuit (revenue=0 AND
bills=0 -> None for legacy fallback)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.2: `_fetch_gold_trend_chart` (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test class**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _fetch_gold_trend_chart


class TestFetchGoldTrendChart:
    F001_TREND = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "points": [
            {"date": "2025-01-01", "revenue": 91972.04, "bill_count": 600, "avg_bill_value": 153.29},
            {"date": "2025-01-02", "revenue": 43165.0,  "bill_count": 280, "avg_bill_value": 154.16},
        ],
    }

    EMPTY_TREND = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "points": [],
    }

    def _patch_seam(self, monkeypatch, response):
        from smartbi_compat.api import analysis_sales as mod
        async def fake(pool, fid, dr):
            return response
        monkeypatch.setattr(mod, "_call_daily_trend", fake)

    def test_returns_chart_config_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_TREND)
        result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert result is not None
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"
        assert result["seriesField"] is None
        assert result["options"] is None  # Gold path - NOT the foundation stub default

    def test_data_maps_revenue_to_amount(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_TREND)
        result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert len(result["data"]) == 2
        assert result["data"][0] == {"date": "2025-01-01", "amount": Decimal("91972.04")}
        assert result["data"][1] == {"date": "2025-01-02", "amount": Decimal("43165.0")}

    def test_empty_points_returns_none(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.EMPTY_TREND)
        result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert result is None

    def test_query_failure_returns_none_logs_warning(self, monkeypatch, range_2025, caplog):
        from smartbi_compat.api import analysis_sales as mod
        async def fail(pool, fid, dr):
            raise RuntimeError("simulated daily_trend failure")
        monkeypatch.setattr(mod, "_call_daily_trend", fail)
        with caplog.at_level("WARNING"):
            result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert result is None
        assert any("trend fetch failed" in r.message for r in caplog.records)

    def test_is_async(self):
        assert asyncio.iscoroutinefunction(_fetch_gold_trend_chart)
```

- [ ] **Step 2: Run test - confirm RED**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestFetchGoldTrendChart -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError`.

- [ ] **Step 3: Implement `_fetch_gold_trend_chart`**

APPEND to Section 3b of `analysis_sales.py` (after `_build_from_gold_finance_summary`):

```python
async def _fetch_gold_trend_chart(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.fetchTrendChart (lines 160-191).

    Builds LINE ChartConfig from daily_trend response.
    Returns None on empty points OR query failure (logs warning).
    options=None on Gold path (Java doesn't set it; foundation stub default differs).
    """
    try:
        gold = await _call_daily_trend(pool, factory_id, (range_.start_date, range_.end_date))
    except Exception as e:
        logger.warning(
            "[gold-builder] trend fetch failed factory=%s range=%s..%s: %s",
            factory_id, range_.start_date, range_.end_date, e,
        )
        return None

    points = gold.get("points") or []
    if not points:
        return None

    data = [
        {"date": p["date"], "amount": _to_decimal(p.get("revenue"))}
        for p in points
    ]

    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=data,
        options=None,
    )
```

- [ ] **Step 4: Run test - confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestFetchGoldTrendChart -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): _fetch_gold_trend_chart adapter

Gold spec Task C.2. Mirrors Java GoldDashboardBuilder.fetchTrendChart (160-191):
LINE chart with date/amount data points from daily_trend.points. options=None
(Gold path differs from foundation stub default). Returns None on empty points
or query failure (warning logged)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.3: `_fetch_gold_category_chart` (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test class**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _fetch_gold_category_chart


class TestFetchGoldCategoryChart:
    F001_PRODUCTS = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "top_products": [
            {"product_id": "P1", "name": "猪肉葱花调味(无人份)", "qty": 1000, "revenue": 1354832.6, "bill_count": 5000},
            {"product_id": "P2", "name": "猪肉葱花调味单价大型套餐", "qty": 800, "revenue": 989416.8, "bill_count": 3500},
        ],
    }

    EMPTY_PRODUCTS = {
        "factory_id": "F001", "start_date": "2025-01-01", "end_date": "2025-12-31",
        "top_products": [],
    }

    def _patch_seam(self, monkeypatch, response):
        from smartbi_compat.api import analysis_sales as mod
        async def fake(pool, fid, dr, *, top_n=8):
            return response
        monkeypatch.setattr(mod, "_call_top_products", fake)

    def test_returns_pie_chart_config(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_PRODUCTS)
        result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert result is not None
        assert result["chartType"] == "PIE"
        assert result["title"] == "产品类别占比"
        assert result["xaxisField"] == "category"
        assert result["yaxisField"] == "amount"
        assert result["seriesField"] is None
        assert result["options"] is None

    def test_data_maps_name_to_category_revenue_to_amount(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_PRODUCTS)
        result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert len(result["data"]) == 2
        assert result["data"][0] == {"category": "猪肉葱花调味(无人份)", "amount": Decimal("1354832.6")}
        assert result["data"][1] == {"category": "猪肉葱花调味单价大型套餐", "amount": Decimal("989416.8")}

    def test_empty_returns_none(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.EMPTY_PRODUCTS)
        result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert result is None

    def test_query_failure_returns_none_logs_warning(self, monkeypatch, range_2025, caplog):
        from smartbi_compat.api import analysis_sales as mod
        async def fail(pool, fid, dr, *, top_n=8):
            raise RuntimeError("simulated top_products failure")
        monkeypatch.setattr(mod, "_call_top_products", fail)
        with caplog.at_level("WARNING"):
            result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert result is None
        assert any("category fetch failed" in r.message for r in caplog.records)
```

- [ ] **Step 2: Run test - confirm RED**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestFetchGoldCategoryChart -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError`.

- [ ] **Step 3: Implement `_fetch_gold_category_chart`**

APPEND to Section 3b of `analysis_sales.py` (after `_fetch_gold_trend_chart`):

```python
async def _fetch_gold_category_chart(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.fetchCategoryChart (lines 193-227).

    Builds PIE ChartConfig from top_products response (top_n=8 by default).
    Maps {name -> category, revenue -> amount}.
    Returns None on empty top_products OR query failure (logs warning).
    """
    try:
        gold = await _call_top_products(
            pool, factory_id, (range_.start_date, range_.end_date), top_n=8,
        )
    except Exception as e:
        logger.warning(
            "[gold-builder] category fetch failed factory=%s range=%s..%s: %s",
            factory_id, range_.start_date, range_.end_date, e,
        )
        return None

    products = gold.get("top_products") or []
    if not products:
        return None

    data = [
        {"category": str(p.get("name", "")), "amount": _to_decimal(p.get("revenue"))}
        for p in products
    ]

    return _new_chart_config_dict(
        chart_type="PIE",
        title="产品类别占比",
        xaxis_field="category",
        yaxis_field="amount",
        data=data,
        options=None,
    )
```

- [ ] **Step 4: Run test - confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestFetchGoldCategoryChart -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): _fetch_gold_category_chart adapter

Gold spec Task C.3. Mirrors Java GoldDashboardBuilder.fetchCategoryChart (193-227):
PIE chart with category/amount data from top_products.top_products (top_n=8).
options=None. Returns None on empty or query failure (warning logged)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task C.4: `_build_from_gold_with_charts` wrapper (TDD)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py`

- [ ] **Step 1: Write failing test class**

Append to `test_analysis_sales_factories.py`:

```python
from smartbi_compat.api.analysis_sales import _build_from_gold_with_charts


class TestBuildFromGoldWithCharts:
    def _patch_all_seams(self, monkeypatch, finance, trend, products):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return finance
        async def fake_trend(pool, fid, dr):
            return trend
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return products
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fake_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)

    def test_returns_dashboard_with_both_charts(self, monkeypatch, range_2025):
        self._patch_all_seams(
            monkeypatch,
            finance=TestBuildFromGoldFinanceSummary.F001_GOLD,
            trend=TestFetchGoldTrendChart.F001_TREND,
            products=TestFetchGoldCategoryChart.F001_PRODUCTS,
        )
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is not None
        assert "sales_trend" in result["charts"]
        assert "category_distribution" in result["charts"]
        assert result["charts"]["sales_trend"]["chartType"] == "LINE"
        assert result["charts"]["category_distribution"]["chartType"] == "PIE"

    def test_returns_none_when_finance_summary_empty(self, monkeypatch, range_2025):
        self._patch_all_seams(
            monkeypatch,
            finance=TestBuildFromGoldFinanceSummary.EMPTY_GOLD,
            trend=TestFetchGoldTrendChart.F001_TREND,
            products=TestFetchGoldCategoryChart.F001_PRODUCTS,
        )
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is None

    def test_tolerates_trend_chart_failure(self, monkeypatch, range_2025):
        """Java lines 186-190: chart fetch failure logged but does not break the wrapper."""
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return TestBuildFromGoldFinanceSummary.F001_GOLD
        async def failing_trend(pool, fid, dr):
            raise RuntimeError("simulated trend failure")
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return TestFetchGoldCategoryChart.F001_PRODUCTS
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", failing_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is not None
        # sales_trend missing, category_distribution still present
        assert "sales_trend" not in result["charts"]
        assert "category_distribution" in result["charts"]
        # KPI cards still populated
        assert len(result["kpiCards"]) == 4

    def test_charts_dict_empty_when_both_charts_fail(self, monkeypatch, range_2025):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return TestBuildFromGoldFinanceSummary.F001_GOLD
        async def fail_t(pool, fid, dr):
            raise RuntimeError("t fail")
        async def fail_p(pool, fid, dr, *, top_n=8):
            raise RuntimeError("p fail")
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fail_t)
        monkeypatch.setattr(mod, "_call_top_products", fail_p)
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is not None
        assert result["charts"] == {}

    def test_is_async(self):
        assert asyncio.iscoroutinefunction(_build_from_gold_with_charts)
```

- [ ] **Step 2: Run test - confirm RED**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestBuildFromGoldWithCharts -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: `ImportError`.

- [ ] **Step 3: Implement wrapper**

APPEND to Section 3b of `analysis_sales.py`:

```python
async def _build_from_gold_with_charts(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.buildFromGoldWithCharts (lines 135-158).

    Wraps _build_from_gold_finance_summary with chart enrichment.
    Returns None when base is None (empty Gold -> legacy fallback).
    Tolerates individual chart fetch failures (each chart is independent).
    """
    base = await _build_from_gold_finance_summary(factory_id, range_, pool=pool)
    if base is None:
        return None

    trend_chart = await _fetch_gold_trend_chart(factory_id, range_, pool=pool)
    category_chart = await _fetch_gold_category_chart(factory_id, range_, pool=pool)

    charts = {}
    if trend_chart is not None:
        charts["sales_trend"] = trend_chart
    if category_chart is not None:
        charts["category_distribution"] = category_chart

    base["charts"] = charts
    return base
```

- [ ] **Step 4: Run test - confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestBuildFromGoldWithCharts -v 2>&1 | tail -10
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 5 tests pass.

- [ ] **Step 5: Run cumulative regression on factory suite**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py -q 2>&1 | tail -3
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ~67 passed (44 from B + 9 C.1 + 5 C.2 + 4 C.3 + 5 C.4).

- [ ] **Step 6: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): _build_from_gold_with_charts wrapper

Gold spec Task C.4. Mirrors Java GoldDashboardBuilder.buildFromGoldWithCharts
(135-158): wraps finance_summary base with trend + category chart enrichment.
Tolerates individual chart fetch failures (charts dict only includes successes).
Returns None when base is None (empty Gold short-circuit propagates)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

Total Phase C: 4 tasks, 60-90 min, 4 commits.

---

## Phase D — Wire into `_get_sales_overview` + contract tests

### Task D.1: Refactor `_get_sales_overview` — Gold-first dispatch + legacy placeholder

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (Section 3 sub-service stubs)
- Modify: `tests/python/smartbi_compat/test_analysis_sales_factories.py` (cumulative stub regression)

**Goal**: Replace the foundation stub body of `_get_sales_overview` with:
1. Try Gold path via `_build_from_gold_with_charts(factory_id, range_, pool)`
2. If non-null, return it
3. If null OR exception, fall back to `_build_legacy_sales_overview` (which is the renamed-from-foundation placeholder returning F999 empty shape — overview spec replaces this body later)

This preserves F999 behavior (empty Gold -> legacy placeholder -> F999 empty shape) AND enables F001 byte-shape match (non-empty Gold -> Gold result).

- [ ] **Step 1: Read current `_get_sales_overview` body**

```bash
grep -n -A 20 "^async def _get_sales_overview" backend/python/smartbi_compat/api/analysis_sales.py | head -25
```

Confirm body returns `_new_dashboard_response_dict(...)` with the YELLOW insight + suggestion + last_updated. This is the current foundation stub.

- [ ] **Step 2: Edit — extract foundation stub to `_build_legacy_sales_overview` + new dispatch in `_get_sales_overview`**

Use Edit tool. Find the existing function:

```python
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
```

Replace with:

```python
async def _build_legacy_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Legacy fallback placeholder — overview spec replaces with real impl.

    Returns F999 empty-state DashboardResponse matching `buildEmptyDashboard`
    Java line 1145-1159: 1 YELLOW insight + 1 suggestion + 16-field shape.

    This is the legacy SalesAnalysisServiceImpl.getSalesOverview path; will be
    populated by overview spec with real KPI computation from sales data.
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


async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Gold-first dispatch (gold spec). Falls back to legacy if Gold returns None.

    Java reference: SmartBIServiceImpl.getComprehensiveAnalysis line 568-616
    delegates overview to SalesAnalysisServiceImpl.getSalesOverview which itself
    calls GoldDashboardBuilder.buildFromGoldWithCharts FIRST, then legacy SQL.

    Pool acquisition: lazy import of get_pg_pool to avoid circular import at
    module-load time. Pool failure -> warning + legacy fallback.
    """
    pool = None
    try:
        from smartbi.gold.queries import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning(
            "[gold-builder] pool acquisition failed factory=%s: %s; using legacy",
            factory_id, e,
        )
        return await _build_legacy_sales_overview(factory_id, range_)

    try:
        gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
        if gold_dashboard is not None:
            return gold_dashboard
    except Exception as e:
        logger.warning(
            "[gold-builder] Gold fetch failed factory=%s: %s; falling back to legacy",
            factory_id, e,
        )
    return await _build_legacy_sales_overview(factory_id, range_)
```

⚠ **Pool import location verification**: spec assumes `smartbi.gold.queries` exports `get_pg_pool`. Verify before editing:

```bash
grep -n "def get_pg_pool\|get_pg_pool =" backend/python/smartbi/gold/queries.py
grep -rn "def get_pg_pool" backend/python/smartbi/ | head -5
```

If `get_pg_pool` isn't in `smartbi.gold.queries`, find where it lives (likely `smartbi.database.connection` or `smartbi.gold.pool`). Adjust the import line accordingly. **DO NOT** invent a function — escalate if you can't locate it.

- [ ] **Step 3: Verify F999 stub regression still passes (existing test in TestSubServiceStubs)**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_factories.py::TestSubServiceStubs -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 6/6 pass — F999 calls `_get_sales_overview` which now tries Gold (will fail since pool unavailable in test or returns empty for F999), falls back to legacy placeholder, returns F999 empty shape.

⚠ If `test_overview_stub_returns_F999_shape` fails:
- Likely cause: pool acquisition raised an exception that wasn't caught, OR test runner has Gold pool that returned non-empty for F999.
- Mitigation: monkey-patch `_build_from_gold_with_charts` to always return None inside the test fixture (defensive). Update the existing test:

```python
def test_overview_stub_returns_F999_shape(self, monkeypatch, range_2025):
    """F999 has no Gold data; Gold returns None; falls back to legacy placeholder."""
    from smartbi_compat.api import analysis_sales as mod
    async def no_gold(fid, dr, pool=None):
        return None
    monkeypatch.setattr(mod, "_build_from_gold_with_charts", no_gold)
    result = asyncio.run(_get_sales_overview("F999", range_2025))
    assert isinstance(result, dict)
    assert len(result["aiInsights"]) == 1
    # ... rest of existing assertions
```

If you need to update this existing test, note it in your task report (slight scope expansion within D.1).

- [ ] **Step 4: Verify foundation F999 byte-shape contract test still passes**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope -v 2>&1 | tail -15
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 5/5 pass — F999 envelope tests still green (Gold path returns None for F999, legacy placeholder produces foundation F999 shape).

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-gold): wire Gold-first dispatch in _get_sales_overview

Gold spec Task D.1. Renames foundation stub to _build_legacy_sales_overview
(overview spec replaces body later); _get_sales_overview now tries
_build_from_gold_with_charts first, falls back to legacy on None or exception.

F999 contract test still passes (Gold None -> legacy placeholder -> F999 shape).
F001 path now reachable via Gold (TestGold contract tests in D.2 verify)." -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_factories.py
```

---

### Task D.2: Add `TestGold` contract test class (5 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

- [ ] **Step 1: Append `TestGold` class with 5 tests**

Use Edit tool. Find the end of the existing `TestEnvelope` class in `test_analysis_sales_contract.py` (last line is the F999 byte-shape gate test). APPEND a new `TestGold` class:

```python


# Re-export adapter helpers used by TestGold mock setup
from smartbi_compat.api.analysis_sales import (  # noqa: E402
    _build_from_gold_with_charts,
    _build_from_gold_finance_summary,
)


F001_GOLD_FINANCE = {
    "factory_id": "F001",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "total_revenue": 20639884.52,
    "bill_count": 140541,
    "avg_bill_value": 146.86,
    "store_count": 8,
    "top_stores": [
        {"store_id": f"S{i}", "store_name": f"Store {i}", "revenue": 100000.0 * (10 - i), "bill_count": 1000 * (10 - i)}
        for i in range(1, 9)
    ],
}

F001_GOLD_TREND = {
    "factory_id": "F001",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "points": [{"date": "2025-01-01", "revenue": 91972.04, "bill_count": 600, "avg_bill_value": 153.29}],
}

F001_GOLD_PRODUCTS = {
    "factory_id": "F001",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "top_products": [
        {"product_id": f"P{i}", "name": f"Product {i}", "qty": 1000, "revenue": 100000.0 * (9 - i), "bill_count": 500}
        for i in range(1, 9)
    ],
}


class TestGold:
    """Gold-path adapter contract tests."""

    def _patch_gold_seams(self, monkeypatch, finance, trend, products):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_pool():
            return None
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return finance
        async def fake_trend(pool, fid, dr):
            return trend
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return products
        # Patch pool acquisition + 3 query seams
        async def fake_get_pool():
            return None
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fake_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)
        # Bypass pool acquisition by monkey-patching the import location
        # used by _get_sales_overview (smartbi.gold.queries.get_pg_pool).
        try:
            import smartbi.gold.queries as gq
            monkeypatch.setattr(gq, "get_pg_pool", fake_get_pool, raising=False)
        except ImportError:
            pass

    def test_F001_overview_kpi_card_count(self, monkeypatch, client, f001_token):
        self._patch_gold_seams(monkeypatch, F001_GOLD_FINANCE, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        ov = response.json()["data"]["overview"]
        assert len(ov["kpiCards"]) == 4
        keys = [c["key"] for c in ov["kpiCards"]]
        assert keys == ["total_revenue", "bill_count", "avg_bill_value", "store_count"]

    def test_F001_overview_charts_populated(self, monkeypatch, client, f001_token):
        self._patch_gold_seams(monkeypatch, F001_GOLD_FINANCE, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        assert "sales_trend" in ov["charts"]
        assert "category_distribution" in ov["charts"]
        assert ov["charts"]["sales_trend"]["chartType"] == "LINE"
        assert ov["charts"]["category_distribution"]["chartType"] == "PIE"

    def test_F001_overview_top_stores_ranking(self, monkeypatch, client, f001_token):
        self._patch_gold_seams(monkeypatch, F001_GOLD_FINANCE, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        assert "top_stores" in ov["rankings"]
        assert len(ov["rankings"]["top_stores"]) == 8
        first = ov["rankings"]["top_stores"][0]
        assert first["rank"] == 1
        assert first["target"] is None
        assert first["completionRate"] is None
        assert first["alertLevel"] is None

    def test_empty_gold_falls_back_to_legacy(self, monkeypatch, client, f001_token):
        empty_finance = {**F001_GOLD_FINANCE, "total_revenue": 0, "bill_count": 0, "top_stores": []}
        self._patch_gold_seams(monkeypatch, empty_finance, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        # Legacy placeholder shape: 1 YELLOW insight + 1 suggestion + empty kpiCards
        assert ov["kpiCards"] == []
        assert len(ov["aiInsights"]) == 1
        assert ov["aiInsights"][0]["level"] == "YELLOW"
        assert ov["suggestions"] == ["请先上传销售数据以开始分析"]

    def test_gold_chart_failure_tolerated(self, monkeypatch, client, f001_token):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return F001_GOLD_FINANCE
        async def failing_trend(pool, fid, dr):
            raise RuntimeError("simulated trend failure")
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return F001_GOLD_PRODUCTS
        async def fake_get_pool():
            return None
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", failing_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)
        try:
            import smartbi.gold.queries as gq
            monkeypatch.setattr(gq, "get_pg_pool", fake_get_pool, raising=False)
        except ImportError:
            pass
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        assert "sales_trend" not in ov["charts"]
        assert "category_distribution" in ov["charts"]
        assert len(ov["kpiCards"]) == 4
```

- [ ] **Step 2: Run test class — confirm GREEN**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestGold -v 2>&1 | tail -20
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 5 tests pass.

⚠ Common gotchas:
- If pool patching fails (test runner can't import `smartbi.gold.queries`), the `try/except ImportError` swallows it but `_get_sales_overview`'s pool acquisition will then raise. Result: legacy fallback engaged for ALL tests (including the F001 test which expects Gold path). Fix: move the pool patch BEFORE the seam patches, OR adjust D.1 to make pool acquisition graceful when Gold module unavailable.
- If a test fails because `kpiCards` is `[]` instead of 4 cards, Gold dispatch isn't reaching the seam — debug pool acquisition path.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "test(phase2a-gold): TestGold contract tests (5 tests)

Gold spec Task D.2. Tests F001 path via patched seams: 4 KPI cards / 2 charts /
8 top_stores / empty fallback / chart failure tolerance. Verifies wiring through
route -> _get_sales_overview -> _build_from_gold_with_charts." -- tests/python/smartbi_compat/test_analysis_sales_contract.py
```

---

### Task D.3: F001 byte-shape gate test (THE merge gate)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

- [ ] **Step 1: Append F001 byte-shape test to TestGold class**

Append to `TestGold` (after `test_gold_chart_failure_tolerated`):

```python
    def test_F001_overview_byte_shape_via_gold(self, monkeypatch, client, f001_token):
        """Gold spec merge gate. F001 overview field byte-matches golden after strip-volatile.

        Mock returns the EXACT shape Java's Gold queries return for F001's 2025
        window (~20.6M total revenue / 140541 bills / 8 stores / 365 trend days /
        8 categories). Mocked because tests must be hermetic.
        """
        # Build mock from golden's actual values to ensure byte parity
        with open(GOLDEN_DIR / "analysis-sales-F001.json", encoding="utf-8") as f:
            golden = json.load(f)
        golden_ov = golden["response"]["data"]["overview"]

        # Reverse-engineer Gold mock from golden KPI cards
        # KPIs: [total_revenue, bill_count, avg_bill_value, store_count]
        kpi_total_rev = golden_ov["kpiCards"][0]["rawValue"]   # str repr of decimal
        kpi_bill_count = golden_ov["kpiCards"][1]["rawValue"]
        kpi_avg_bill = golden_ov["kpiCards"][2]["rawValue"]
        kpi_stores = golden_ov["kpiCards"][3]["rawValue"]

        finance_mock = {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "total_revenue": float(kpi_total_rev),
            "bill_count": int(kpi_bill_count),
            "avg_bill_value": float(kpi_avg_bill),
            "store_count": int(kpi_stores),
            "top_stores": [
                {
                    "store_id": f"S{i+1}",
                    "store_name": s["name"],
                    "revenue": float(s["value"]),
                    "bill_count": 1000,
                }
                for i, s in enumerate(golden_ov["rankings"]["top_stores"])
            ],
        }
        trend_mock = {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "points": [
                {"date": p["date"], "revenue": float(p["amount"]), "bill_count": 100, "avg_bill_value": 100.0}
                for p in golden_ov["charts"]["sales_trend"]["data"]
            ],
        }
        products_mock = {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "top_products": [
                {"product_id": f"P{i+1}", "name": d["category"], "qty": 100, "revenue": float(d["amount"]), "bill_count": 50}
                for i, d in enumerate(golden_ov["charts"]["category_distribution"]["data"])
            ],
        }

        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return finance_mock
        async def fake_trend(pool, fid, dr):
            return trend_mock
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return products_mock
        async def fake_pool():
            return None
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fake_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)
        try:
            import smartbi.gold.queries as gq
            monkeypatch.setattr(gq, "get_pg_pool", fake_pool, raising=False)
        except ImportError:
            pass

        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200

        actual_overview = _strip_volatile(response.json()["data"]["overview"])
        expected_overview = _strip_volatile(golden_ov)

        # Compare just the overview field (this is what gold spec owns).
        # Sibling specs (rankings/trend/customerRanking) compare top-level
        # fields separately.
        assert actual_overview == expected_overview, (
            f"F001 overview byte-shape mismatch.\n"
            f"Actual keys: {sorted(actual_overview.keys())}\n"
            f"Expected keys: {sorted(expected_overview.keys())}"
        )
```

- [ ] **Step 2: Run gate test**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestGold::test_F001_overview_byte_shape_via_gold -v 2>&1 | tail -30
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: PASS.

If FAIL, debug iteratively. Common gotchas:

1. **`rawValue` is JSON number vs Python Decimal**: Golden has `"rawValue": 20639884.52` (JSON number). Python factory emits `Decimal("20639884.52")`. After `response.json()`, both become Python float (FastAPI/JSON serializes Decimal to float). After `_strip_volatile`, comparison should work. If types diverge, normalize via `Decimal` round-trip in compare or compare `str(value)` representations.

2. **Trailing zero in `value` field**: Golden has `"value": "20639884.52"` (string). Python `_format_kpi_value` should produce same. If `"20639884.5"` instead, B.2 trailing-zero fix didn't take.

3. **`top_stores` order**: Both should be rank-ordered. If golden has different order than mock generates (e.g. by `value` desc), mock should preserve golden order.

4. **`charts` key order**: Python dict insertion order matters. Foundation D.2 set `charts` field BEFORE `aiInsights` per Java declaration order. If `_build_from_gold_with_charts` mutates `base["charts"]` in-place this should still work (existing key just reassigned).

5. **`charts.sales_trend.data` items**: Each item is `{date, amount}`. Golden may use float for amount; Python `_to_decimal(float)` returns Decimal which after JSON serialization becomes float again. Round-trip parity should hold.

6. **`generatedAt` / `lastUpdated`**: Both stripped by `_strip_volatile`. If one of them sneaks through (different key spelling), the test fails. Verify VOLATILE_KEYS frozenset includes them.

If FAIL with non-trivial diff, print actual vs expected side-by-side, identify the diff field, fix the relevant adapter helper, retry. Do NOT just adjust the test to match — the byte-shape contract is the goal.

- [ ] **Step 3: Run all envelope + gold tests**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py -v 2>&1 | tail -20
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: 5 envelope (foundation) + 6 TestGold = 11 pass.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "test(phase2a-gold): F001 overview byte-shape gate test

Gold spec Task D.3. THE gold merge gate. Reverse-engineers Gold mock from
F001 golden's overview field, drives Python through Gold path, asserts
overview byte-equality after strip-volatile.

Sibling specs (rankings/trend/etc) compare top-level fields separately;
gold spec owns overview field byte-shape." -- tests/python/smartbi_compat/test_analysis_sales_contract.py
```

Total Phase D: 3 tasks, 45-60 min, 3 commits.

---

## Phase E — Verification

### Task E.1: Full pytest + 0-regression check

**Files:** read-only

- [ ] **Step 1: Run full smartbi_compat suite**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/ -v 2>&1 | tail -30
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: ~140 passed (118 baseline + 6 ToDecimal + 8 FormatKpiValue + 9 BuildFromGoldFinanceSummary + 5 FetchGoldTrendChart + 4 FetchGoldCategoryChart + 5 BuildFromGoldWithCharts + 6 TestGold = 161 — exact count depends on whether existing TestSubServiceStubs needed update in D.1 step 3).

If any pre-existing alerts/recommendations test fails, this is a regression — escalate.

- [ ] **Step 2: Confirm scope (gold-owned files only)**

```bash
git diff 7d3ab017c HEAD --stat -- ':!docs/' 2>&1 | tail -10
git log --oneline 7d3ab017c..HEAD
```

Expected diff scope:
- `backend/python/smartbi_compat/api/analysis_sales.py` (significant additions: helpers + seams + adapters + dispatch)
- `tests/python/smartbi_compat/test_analysis_sales_factories.py` (new test classes)
- `tests/python/smartbi_compat/test_analysis_sales_contract.py` (TestGold class)

NO other files should change. If `main.py` / `analysis.py` / sibling spec files appear, scope creep — investigate before committing further.

- [ ] **Step 3: Run final clean summary**

```bash
cd backend/python
/b/anaconda3/python.exe -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
```

Expected: terminal line like `161 passed in N.NNs`.

- [ ] **Step 4: Branch state summary**

```bash
git log --oneline phase2a/t5-poc -25 | head -20
echo "Commits ahead of origin/main: $(git rev-list --count origin/main..HEAD)"
```

Note delta: was 43 pre-gold, should be 43 + 11 (B.1, B.2, B.3, C.1, C.2, C.3, C.4, D.1, D.2, D.3, plus possibly stub-update mini-commit) ≈ 53-54 commits ahead.

- [ ] **Step 5: No commit (verification only)**

---

### Task E.2: Optional — deploy to test env + smoke

**Files:** none (deployment only)

⚠ Skip if working entirely locally / not yet ready to share OR if test env nginx routing for `/analysis/sales` to Python 8084 isn't yet configured.

- [ ] **Step 1: Deploy Python service to test env**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test 2>&1 | tail -20
```

Expected: rsync sync + restart + 200 health response from `http://47.100.235.168:8084/health`.

- [ ] **Step 2: Smoke F001 path on test env**

⚠ Requires Java test env to NOT intercept the route (nginx config matters).

```bash
# Mint F001 token
F001_TOKEN="<obtain test env F001 JWT>"

# Hit Python directly on 8084
curl -s -H "Authorization: Bearer ${F001_TOKEN}" \
  "http://47.100.235.168:8084/api/mobile/F001/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31" \
  | /b/anaconda3/python.exe -c "
import json, sys
resp = json.load(sys.stdin)
ov = resp['data']['overview']
print('kpi_card_count:', len(ov['kpiCards']))
print('kpi_keys:', [c['key'] for c in ov['kpiCards']])
print('charts:', list(ov['charts'].keys()))
print('top_stores:', len(ov['rankings'].get('top_stores', [])))
"
```

Expected:
```
kpi_card_count: 4
kpi_keys: ['total_revenue', 'bill_count', 'avg_bill_value', 'store_count']
charts: ['sales_trend', 'category_distribution']
top_stores: 8
```

If response is the F999 empty-state shape (kpi_card_count: 0), Gold path didn't reach the database — investigate `get_pg_pool` import / connectivity / agg_daily F001 data.

- [ ] **Step 3: No commit (deploy only)**

Total Phase E: 2 tasks, 15-30 min, 0 commits.

---

## Self-review checklist

Before marking gold spec as done, verify:

**1. Spec coverage scan**

- [ ] §2.1 `_get_sales_overview` Gold-first dispatch → Task D.1 ✓
- [ ] §2.2 `_build_from_gold_finance_summary` (4 KPIs + top_stores + empty short-circuit) → Task C.1 ✓
- [ ] §2.3 `_build_from_gold_with_charts` wrapper → Task C.4 ✓
- [ ] §2.4 `_fetch_gold_trend_chart` (LINE, daily_trend) → Task C.2 ✓
- [ ] §2.5 `_fetch_gold_category_chart` (PIE, top_products) → Task C.3 ✓
- [ ] §2.6 `_to_decimal` + `_format_kpi_value` helpers → Tasks B.1 / B.2 ✓
- [ ] §2.7 `TestGold` 5 tests → Task D.2 ✓
- [ ] §8 monkey-patch indirection (3 module-level seams) → Task B.3 ✓
- [ ] §12 acceptance F001 byte-shape → Task D.3 ✓

**2. Placeholder scan**

- [ ] No "TBD" / "TODO" / "implement later" in any task body
- [ ] All test code is complete (no `# add tests here`)
- [ ] All implementation code is shown in full (no `def function(): pass`)
- [ ] All bash commands are exact + have expected output

**3. Type consistency**

- [ ] `_to_decimal(v: Any) -> Decimal` (B.1) used by `_format_kpi_value` input + adapter functions ✓
- [ ] `_format_kpi_value(v: Decimal, unit: str) -> str` (B.2) called by C.1 with units 元 / 单 / 家 ✓
- [ ] 3 seams (B.3) async signatures match what C.1/C.2/C.3 await ✓
- [ ] `_build_from_gold_finance_summary(factory_id, range_, pool=None) -> Optional[dict]` (C.1) called by C.4 wrapper ✓
- [ ] `_fetch_gold_trend_chart` + `_fetch_gold_category_chart` (C.2/C.3) called by C.4 ✓
- [ ] `_build_from_gold_with_charts(factory_id, range_, pool=None) -> Optional[dict]` (C.4) called by D.1 dispatch ✓
- [ ] `_build_legacy_sales_overview(factory_id, range_) -> dict` (D.1) callable from `_get_sales_overview` fallback ✓

**4. Cross-cutting concerns**

- [ ] All adapter functions are `async def` ✓
- [ ] Module-level seams take `pool` first arg (mirrors queries.py signatures) ✓
- [ ] `options=None` on Gold-path ChartConfig (NOT foundation stub default) ✓
- [ ] empty short-circuit (revenue=0 AND bills=0) returns None ✓
- [ ] chart fetch failures logged + swallowed (return None) ✓
- [ ] Pool acquisition wrapped in try/except (graceful fallback) ✓

**5. Concurrent-edit safety**

- [ ] Every commit uses `git commit ... -- <specific paths>` (--only mode) per concurrent-edit rule 5b ✓
- [ ] Every commit preceded by `git status --short` ✓
- [ ] No auto-staging via `git add -A` or `git add .` ✓
- [ ] B.3 / D.1 (1-file commits) pass `-- <path>` correctly ✓

**6. Test quality**

- [ ] All TDD tasks (B.1, B.2, C.1, C.2, C.3, C.4) have explicit RED step before GREEN ✓
- [ ] Adapter tests use monkeypatch on module-level seams (not deep import patching) ✓
- [ ] D.2 TestGold tests verify route -> dispatch -> Gold seam wiring (full HTTP path) ✓
- [ ] D.3 byte-shape gate compares against actual golden file (not synthetic-shape assertions) ✓

If any item fails, fix the corresponding task inline before execution.

---

## Done criteria (gold spec merge gate)

Gold spec impl is complete when ALL of:

- [ ] All Phase A verification tasks pass (Gold infra healthy + F001 has agg_daily data + queries.py signatures match)
- [ ] All Phase B-D commits land on `phase2a/t5-poc` (10-11 commits depending on stub-update need)
- [ ] Full smartbi_compat pytest suite passes (Task E.1, ~161 tests including ~43 new)
- [ ] `test_analysis_sales_contract.py::TestGold::test_F001_overview_byte_shape_via_gold` PASSES
- [ ] No regression on alerts / recommendations / foundation envelope tests
- [ ] No scope creep (only files listed in E.1 step 2 changed)

Post-merge, sibling specs (overview / rankings / trend) can run in their own chats:
- **overview spec** replaces `_build_legacy_sales_overview` body with real KPI computation
- **rankings spec** replaces `_get_salesperson_ranking` / `_get_product_ranking` / `_get_customer_ranking` stubs (top-level composite, NOT inside overview)
- **trend spec** replaces `_get_sales_trend_chart` stub (top-level composite)

---

## Estimated execution

- Phase A: 30-45 min (3 verification tasks)
- Phase B: 30-45 min (2 TDD helpers + 3 seams)
- Phase C: 60-90 min (4 TDD adapter tasks)
- Phase D: 45-60 min (3 wiring + contract test tasks)
- Phase E: 15-30 min (verification + optional deploy)

**Total: 3-4 hours** for gold chat (matches spec §13 estimate).

---

## Parallel work analysis

| Mode | Recommendation |
|---|---|
| **Subagent parallel (single chat)** | ❌ — All tasks edit the same `analysis_sales.py` and same test files. Sequential only. |
| **Multi-chat parallel (different sub-specs)** | ⚠ — Gold + overview both edit `_get_sales_overview` / `_build_legacy_sales_overview` AND the same test file. Conflict-prone. **Recommend overview chat WAITS for gold merge** OR uses sub-worktree. |
| **Subagent-driven within this chat** | ✅ — Sequential tasks via fresh subagents per task. Same pattern as foundation execution. |

---

End of plan.
