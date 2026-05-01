# Phase 2A `/analysis/finance` cost arithmetic depth tests (PR-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 arithmetic depth tests for the cost endpoint Python implementation (already on main from PR-A `d6b48738a`), covering all branches of `_get_cost_structure_chart`, `_get_cost_trend_chart`, `_get_period_key`, `_create_pie_data_item`, `_aggregate_cost_by_period` per spec §5.2.

**Architecture:** Pure tests — append two new classes (`TestCostStructureArithmetic` 6 tests + `TestCostTrendArithmetic` 5 tests) to existing `tests/python/smartbi_compat/test_analysis_finance_contract.py`. No source changes. Tests follow profit PR-B style (chart-function-level mocks via monkeypatch on `_query_finance_data`). Companion to existing `TestCostHelpers` (helper-level direct calls).

**Tech Stack:** pytest + pytest-asyncio, monkeypatch fixture, asyncio.run for async chart functions, Python `Decimal` for byte-shape parity with Java `BigDecimal`.

---

## Context

### What's on main (origin/main `fb92f4b01`)

Cost PR-A merged as `d6b48738a` (PR #25). The following symbols exist in `backend/python/smartbi_compat/api/analysis_finance.py`:

| Symbol | Line | Signature |
|---|---|---|
| `_query_finance_data` | (mock target) | `async def _query_finance_data(factory_id, record_type, start_date, end_date) -> list[dict]` |
| `_get_cost_structure_chart` | 1157 | `async def _get_cost_structure_chart(factory_id, start_date, end_date) -> dict` |
| `_get_cost_trend_chart` | 1213 | `async def _get_cost_trend_chart(factory_id, start_date, end_date, period="MONTH") -> dict` |
| `_get_period_key` | 453 | `def _get_period_key(d: date, period: str) -> str` |
| `_create_pie_data_item` | 213 | `def _create_pie_data_item(category, value: Decimal, total: Decimal) -> dict` |
| `_aggregate_cost_by_period` | 237 | `def _aggregate_cost_by_period(cost_records, period) -> dict[str, list[Decimal]]` |
| `_decimal_to_number` | 376 | `def _decimal_to_number(v: Decimal) -> Any` |
| `COST_CATEGORY_MATERIAL` | 477 | `= "原材料"` |
| `COST_CATEGORY_LABOR` | 478 | `= "人工"` |
| `COST_CATEGORY_OVERHEAD` | 479 | `= "制造费用"` |

### Existing TestCostHelpers (8 tests, line 864-965)

Helper-level direct calls. We **keep these** (decision A=keep both per brainstorm). Companion to new chart-function-level tests.

### Decisions locked from brainstorm

- **A**: Keep both `TestCostHelpers` (helper-level) and new `TestCost*Arithmetic` (chart-function-level). Defense in depth — same logic exercised at two layers.
- **B**: WEEK period key test uses **mid-year date** (`date(2025, 6, 15)`) only. Avoids C1 known bug (`_get_period_key` uses ISO year not calendar year per Rule 2). C1 deferred to its own follow-up PR.

### Baseline test count

```
$ python -m pytest tests/python/smartbi_compat/ -q
254 passed in 18.79s
```

Target after PR-B: **265 passed**.

### Decision A consequence — TestCostHelpers docstring update

The existing docstring on line 865 says:
```python
"""Cost helper unit tests (PR-A; will be supplanted by PR-B arithmetic class)."""
```

This conflicts with decision A (keep both). One-line docstring fix part of this PR. No test logic touched.

---

## File Structure

| Path | Action | Scope |
|---|---|---|
| `tests/python/smartbi_compat/test_analysis_finance_contract.py` | Modify | Update line 865 docstring + append 2 classes (~250 LOC) |
| `docs/superpowers/plans/2026-04-30-phase2a-finance-cost-pr-b.md` | Create | This plan (committed at start) |

Total LOC delta: ~280 (250 test code + 30 docstring/whitespace).

---

## Tasks

### Task 1: Commit this plan

**Files:**
- Create: `docs/superpowers/plans/2026-04-30-phase2a-finance-cost-pr-b.md`

- [ ] **Step 1: Verify plan is on disk**

Run: `ls -la docs/superpowers/plans/2026-04-30-phase2a-finance-cost-pr-b.md`
Expected: file exists, ~10-15KB.

- [ ] **Step 2: Verify nothing else is staged**

Run: `git status --short`
Expected: only this plan file untracked. If anything else dirty, investigate before commit.

- [ ] **Step 3: Commit (use --only mode for concurrent-edit safety)**

```bash
git commit -m "docs(phase2a/cost-pr-b): implementation plan" -- docs/superpowers/plans/2026-04-30-phase2a-finance-cost-pr-b.md
```

- [ ] **Step 4: Verify commit**

Run: `git show --name-only HEAD`
Expected: only `docs/superpowers/plans/2026-04-30-phase2a-finance-cost-pr-b.md` listed.

---

### Task 2: Update TestCostHelpers docstring (decision A consequence)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py:865`

- [ ] **Step 1: Apply Edit**

```python
# OLD (line 865):
class TestCostHelpers:
    """Cost helper unit tests (PR-A; will be supplanted by PR-B arithmetic class)."""

# NEW:
class TestCostHelpers:
    """Cost helper unit tests — helper-level direct coverage (PR-A baseline).

    Companion to TestCostStructureArithmetic + TestCostTrendArithmetic
    (chart-function-level coverage). Defense in depth: same logic exercised
    at two layers — if one layer's mock rots, the other still catches regression.
    """
```

- [ ] **Step 2: Verify tests still green**

Run: `python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers -v`
Expected: 8 passed (no behavior change, just docstring).

- [ ] **Step 3: Verify diff is just the docstring**

Run: `git diff --stat tests/python/smartbi_compat/test_analysis_finance_contract.py`
Expected: roughly +5 / -1 lines.

- [ ] **Step 4: Commit**

```bash
git commit -m "test(phase2a/cost-pr-b): TestCostHelpers docstring — both classes coexist (decision A)" -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 3: Add `TestCostStructureArithmetic` class (6 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append after `TestCostHelpers`, before any subsequent class — currently line 965 is end of file)

- [ ] **Step 1: Append the full class**

Append to the end of the file (after the last `TestCostHelpers` test on line 965):

```python


class TestCostStructureArithmetic:
    """Unit tests for _get_cost_structure_chart arithmetic branches.

    Direct chart-function-level calls (no HTTP/JWT) — exercises the full
    structure chart computation: aggregation across cost categories, total>0
    gating for chart_data emission, percentage rounding two-stage scale,
    and abs() defensive against negative cost rows.

    Companion to TestCostHelpers which calls _create_pie_data_item directly.
    """

    def _run_chart(self, fake_finance):
        """Run _get_cost_structure_chart with _query_finance_data mocked.

        Returns chart dict from line 1157-1210 with chartType=PIE.
        """
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_cost_structure_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31)
            ))
        finally:
            af._query_finance_data = original

    def test_total_zero_emits_empty_data(self):
        """All cost fields = 0 → totalCost=0 → chart_data=[] but options complete.

        Java line 1191: `if total_cost > Decimal("0")` gate — false when total=0.
        Empty data list, but showPercentage + 3 colors still emitted.
        """
        async def fake_zero(*_a, **_k):
            return []  # no rows = total 0
        chart = self._run_chart(fake_zero)
        assert chart["chartType"] == "PIE"
        assert chart["title"] == "成本结构分析"
        assert chart["data"] == []
        assert chart["options"]["showPercentage"] is True
        assert chart["options"]["colors"] == ["#5470c6", "#91cc75", "#fac858"]

    def test_three_categories_emit_three_pie_items(self):
        """totalCost>0 → 3 pie items in order [material, labor, overhead].

        Verifies LinkedHashMap order from Java line 521-526 (NOT alphabetic),
        matched by Python list.append sequence.
        """
        from datetime import date
        from decimal import Decimal
        async def fake_positive(*_a, **_k):
            return [{
                "material_cost": Decimal("60000"),
                "labor_cost":    Decimal("30000"),
                "overhead_cost": Decimal("10000"),
                "total_cost":    Decimal("100000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_positive)
        assert len(chart["data"]) == 3
        # Order: material, labor, overhead (Java COST_CATEGORY_* literals)
        assert chart["data"][0]["category"] == "原材料"
        assert chart["data"][0]["value"]    == 60000
        assert chart["data"][1]["category"] == "人工"
        assert chart["data"][1]["value"]    == 30000
        assert chart["data"][2]["category"] == "制造费用"
        assert chart["data"][2]["value"]    == 10000
        # Percentages: 60/30/10 of 100 → 60.00 / 30.00 / 10.00 (HALF_UP, dict-eq tolerates int)
        assert chart["data"][0]["percentage"] in (60, 60.0)
        assert chart["data"][1]["percentage"] in (30, 30.0)
        assert chart["data"][2]["percentage"] in (10, 10.0)

    def test_percentage_rounding_half_up(self):
        """Percentage HALF_UP at chart-function level — 1/3 ≈ 33.33 (not 33.34).

        Wires to _create_pie_data_item which uses two-stage Decimal arithmetic;
        this test exercises it through the chart path (vs TestCostHelpers which
        calls _create_pie_data_item directly).
        """
        from datetime import date
        from decimal import Decimal
        async def fake_thirds(*_a, **_k):
            # material 1, labor 1, overhead 1 → total 3 → each is 1/3 = 33.33%
            return [{
                "material_cost": Decimal("1"),
                "labor_cost":    Decimal("1"),
                "overhead_cost": Decimal("1"),
                "total_cost":    Decimal("3"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_thirds)
        # Java 2-stage: (1/3).setScale(4, HALF_UP) = 0.3333; * 100 = 33.3300; setScale(2, HALF_UP) = 33.33
        assert chart["data"][0]["percentage"] == 33.33
        assert chart["data"][1]["percentage"] == 33.33
        assert chart["data"][2]["percentage"] == 33.33

    def test_negative_cost_abs_defensive_in_structure(self):
        """Negative cost values in source rows → abs() at structure aggregation.

        Java P0-1 Bug B: Excel 历史数据可能存负值 cost. Python line 1172-1184
        applies `abs(_to_decimal(...))` per category before summing.
        Verified at structure-level (top-level sum), distinct from
        TestCostHelpers.test_aggregate_cost_by_period_negative_abs_defensive
        which tests aggregation per-period.
        """
        from datetime import date
        from decimal import Decimal
        async def fake_negatives(*_a, **_k):
            return [{
                "material_cost": Decimal("-50000"),  # negative
                "labor_cost":    Decimal("-20000"),  # negative
                "overhead_cost": Decimal("-30000"),  # negative
                "total_cost":    Decimal("-100000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_negatives)
        # All three categories abs()'d → positive → total = 100k → percentages 50/20/30
        assert len(chart["data"]) == 3
        assert chart["data"][0]["value"] == 50000  # abs(-50000)
        assert chart["data"][1]["value"] == 20000  # abs(-20000)
        assert chart["data"][2]["value"] == 30000  # abs(-30000)

    def test_create_pie_data_item_total_zero_value_positive_percentage_zero(self):
        """_create_pie_data_item edge: total=0 with value>0 → percentage=0.

        Java line 220 gate `if total > Decimal("0")` is false when total=0;
        percentage hardcoded to Decimal("0") regardless of value.

        Distinct from TestCostHelpers.test_create_pie_data_item_total_zero_returns_zero_percentage
        which uses value=0 (and total=0). This test uses value>0 to confirm
        the gate decision is total-driven, not value-driven.
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        item = _create_pie_data_item("X", Decimal("50"), Decimal("0"))
        assert item["category"] == "X"
        assert item["value"] == 50  # value still emitted (Java line 1567 unaffected)
        assert item["percentage"] == 0  # gate false → BigDecimal.ZERO

    def test_create_pie_data_item_percentage_calc_two_stage_scale(self):
        """Verify two-stage Decimal arithmetic: scale=4 intermediate, scale=2 final.

        Java line 1571: divide(total, SCALE=4, HALF_UP) → multiply(100) → setScale(2, HALF_UP).

        Test value 1/7 exercises full intermediate scale precision:
          1/7 = 0.142857142857...
          quantize(0.0001, HALF_UP) = 0.1429
          * 100 = 14.2900
          quantize(0.01, HALF_UP) = 14.29
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        item = _create_pie_data_item("X", Decimal("1"), Decimal("7"))
        assert item["value"] == 1
        assert item["percentage"] == 14.29
```

- [ ] **Step 2: Run only the new tests**

Run: `python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostStructureArithmetic -v`
Expected: 6 passed.

If any fails, investigate. Most likely cause if it's a real failure: PR-A impl behavior diverges from spec — STOP and discuss before "fixing".

- [ ] **Step 3: Run full module suite**

Run: `python -m pytest tests/python/smartbi_compat/ -q`
Expected: 260 passed (254 baseline + 6 new). 0 regressions.

- [ ] **Step 4: Verify staging is just the test file**

Run: `git status --short`
Expected: only `tests/python/smartbi_compat/test_analysis_finance_contract.py` modified.

- [ ] **Step 5: Commit**

```bash
git commit -m "test(phase2a/cost-pr-b): TestCostStructureArithmetic 6 tests — structure chart depth coverage" -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 4: Add `TestCostTrendArithmetic` class (5 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append after `TestCostStructureArithmetic`)

- [ ] **Step 1: Append the full class**

Append to the end of the file (after `TestCostStructureArithmetic`):

```python


class TestCostTrendArithmetic:
    """Unit tests for _get_cost_trend_chart + _aggregate_cost_by_period + _get_period_key.

    Verifies period aggregation, sort-by-period-key behavior, stacked series
    structure, abs() defensive at aggregation level, and period_key format
    for MONTH/QUARTER/WEEK/DAY (mid-year dates only — C1 ISO-year boundary
    bug deferred to its own PR per brainstorm decision B-i).
    """

    def _run_chart(self, fake_finance, period="MONTH"):
        """Run _get_cost_trend_chart with _query_finance_data mocked.

        Returns chart dict from line 1213-1259 with chartType=BAR.
        """
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_cost_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), period
            ))
        finally:
            af._query_finance_data = original

    def test_empty_data_returns_empty_chartdata(self):
        """Empty rows → chart_data=[] but options.stack + options.series (3 entries) full.

        Java line 553-562 emits chart_data per period; with no periods, list is empty.
        Options always emitted (stack=True + 3 series entries for material/labor/overhead).
        """
        async def fake_empty(*_a, **_k): return []
        chart = self._run_chart(fake_empty)
        assert chart["chartType"] == "BAR"
        assert chart["title"] == "成本趋势分析"
        assert chart["data"] == []
        assert chart["options"]["stack"] is True
        assert len(chart["options"]["series"]) == 3
        assert chart["options"]["series"][0] == {"name": "原材料",   "stack": "cost"}
        assert chart["options"]["series"][1] == {"name": "人工",     "stack": "cost"}
        assert chart["options"]["series"][2] == {"name": "制造费用", "stack": "cost"}

    def test_multi_month_aggregates_by_period_key(self):
        """Three rows in different months → 3 chart points sorted by period key.

        Java TreeMap → Python sorted(). Verifies January < March < June key order.
        """
        from datetime import date
        from decimal import Decimal
        async def fake_multi_month(*_a, **_k):
            return [
                {"material_cost": Decimal("10000"), "labor_cost": Decimal("5000"),
                 "overhead_cost": Decimal("2000"), "total_cost": Decimal("17000"),
                 "record_date": date(2025, 6, 15), "upload_id": 1},
                {"material_cost": Decimal("20000"), "labor_cost": Decimal("8000"),
                 "overhead_cost": Decimal("3000"), "total_cost": Decimal("31000"),
                 "record_date": date(2025, 1, 10), "upload_id": 2},
                {"material_cost": Decimal("15000"), "labor_cost": Decimal("6000"),
                 "overhead_cost": Decimal("2500"), "total_cost": Decimal("23500"),
                 "record_date": date(2025, 3, 5), "upload_id": 3},
            ]
        chart = self._run_chart(fake_multi_month)
        assert len(chart["data"]) == 3
        # Sorted ascending by period key (January first, June last)
        assert chart["data"][0]["period"] == "2025-01"
        assert chart["data"][1]["period"] == "2025-03"
        assert chart["data"][2]["period"] == "2025-06"
        # Spot-check materialCost values flow through correctly
        assert chart["data"][0]["materialCost"] == 20000  # Jan
        assert chart["data"][1]["materialCost"] == 15000  # Mar
        assert chart["data"][2]["materialCost"] == 10000  # Jun

    def test_stacked_series_three_categories_per_period(self):
        """Each period emits 5 keys: [period, materialCost, laborCost, overheadCost, totalCost].

        Java line 553-562 LinkedHashMap put-order. Verifies dict shape per period
        + that options.series has exactly 3 (NOT 4 — total isn't a stacked series).
        """
        from datetime import date
        from decimal import Decimal
        async def fake_one_month(*_a, **_k):
            return [{
                "material_cost": Decimal("60000"),
                "labor_cost":    Decimal("30000"),
                "overhead_cost": Decimal("10000"),
                "total_cost":    Decimal("100000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_one_month)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        # 5 keys in put-order
        assert list(point.keys()) == ["period", "materialCost", "laborCost", "overheadCost", "totalCost"]
        assert point["period"]       == "2025-06"
        assert point["materialCost"] == 60000
        assert point["laborCost"]    == 30000
        assert point["overheadCost"] == 10000
        assert point["totalCost"]    == 100000
        # Series only stacks the 3 cost categories (not total)
        assert len(chart["options"]["series"]) == 3

    def test_negative_cost_abs_defensive_in_trend_aggregation(self):
        """Negative cost rows → _aggregate_cost_by_period applies .abs() per slot.

        Java P0-1 Bug B (line 1452-1467 setdefault accumulator). Verifies abs()
        at aggregate-helper level, exposed through chart function. Distinct from
        test_negative_cost_abs_defensive_in_structure which tests structure-chart's
        own sum() (also abs-defensive at line 1172-1184 of analysis_finance.py).
        """
        from datetime import date
        from decimal import Decimal
        async def fake_negatives(*_a, **_k):
            return [{
                "material_cost": Decimal("-40000"),
                "labor_cost":    Decimal("-15000"),
                "overhead_cost": Decimal("-5000"),
                "total_cost":    Decimal("-60000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_negatives)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        assert point["materialCost"] == 40000  # abs(-40000)
        assert point["laborCost"]    == 15000  # abs(-15000)
        assert point["overheadCost"] == 5000   # abs(-5000)
        assert point["totalCost"]    == 60000  # abs(-60000)

    def test_get_period_key_format_yyyy_mm_yyyy_qN_yyyy_Wnn(self):
        """Direct unit test of _get_period_key for all 4 period types.

        WEEK uses mid-year date (2025-06-15) per brainstorm decision B-i to avoid
        C1 ISO-year boundary bug (Rule 2 violation on main; deferred to its own PR).

        Java FinanceAnalysisServiceImpl.getPeriodKey line 1472-1487.
        """
        from datetime import date
        from smartbi_compat.api.analysis_finance import _get_period_key

        # MONTH: yyyy-MM (zero-padded month) — Java line 1486 default branch
        assert _get_period_key(date(2025, 1, 5), "MONTH")  == "2025-01"
        assert _get_period_key(date(2025, 6, 15), "MONTH") == "2025-06"
        assert _get_period_key(date(2025, 12, 31), "MONTH") == "2025-12"

        # QUARTER: yyyy-Qn — Java line 1483-1485
        assert _get_period_key(date(2025, 1, 5),   "QUARTER") == "2025-Q1"
        assert _get_period_key(date(2025, 4, 15),  "QUARTER") == "2025-Q2"
        assert _get_period_key(date(2025, 8, 20),  "QUARTER") == "2025-Q3"
        assert _get_period_key(date(2025, 11, 10), "QUARTER") == "2025-Q4"

        # WEEK: yyyy-Wnn (ISO week, 2-digit zero-padded) — mid-year dates only
        # 2025-06-15 (Sunday) is in ISO week 24 of calendar year 2025
        assert _get_period_key(date(2025, 6, 15), "WEEK") == "2025-W24"
        # 2025-01-15 (Wednesday) is in ISO week 03
        assert _get_period_key(date(2025, 1, 15), "WEEK") == "2025-W03"

        # DAY: yyyy-MM-dd — Java line 1474-1476
        assert _get_period_key(date(2025, 6, 15), "DAY") == "2025-06-15"
```

- [ ] **Step 2: Run only the new tests**

Run: `python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostTrendArithmetic -v`
Expected: 5 passed.

If `test_get_period_key_format_yyyy_mm_yyyy_qN_yyyy_Wnn` fails on WEEK assertions, the C1 bug may have changed behavior unexpectedly — verify the date math manually. 2025-06-15 ISO calendar:
```python
>>> date(2025, 6, 15).isocalendar()
(2025, 24, 7)  # ISO year 2025, week 24, day 7 (Sunday)
```
Both ISO year and calendar year = 2025 → expected key "2025-W24" regardless of C1 bug.

- [ ] **Step 3: Run full module suite**

Run: `python -m pytest tests/python/smartbi_compat/ -q`
Expected: **265 passed** (254 baseline + 6 structure + 5 trend). 0 regressions.

- [ ] **Step 4: Verify staging is just the test file**

Run: `git status --short`
Expected: only `tests/python/smartbi_compat/test_analysis_finance_contract.py` modified.

- [ ] **Step 5: Commit**

```bash
git commit -m "test(phase2a/cost-pr-b): TestCostTrendArithmetic 5 tests — trend chart + period key depth coverage" -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 5: Final verification

- [ ] **Step 1: Full pytest run**

Run: `python -m pytest tests/python/smartbi_compat/ -q`
Expected: **265 passed**, no regressions.

- [ ] **Step 2: Verify commit history**

Run: `git log --oneline origin/main..HEAD`
Expected: 4 commits in order:
1. `docs(phase2a/cost-pr-b): implementation plan`
2. `test(phase2a/cost-pr-b): TestCostHelpers docstring — both classes coexist (decision A)`
3. `test(phase2a/cost-pr-b): TestCostStructureArithmetic 6 tests — structure chart depth coverage`
4. `test(phase2a/cost-pr-b): TestCostTrendArithmetic 5 tests — trend chart + period key depth coverage`

- [ ] **Step 3: Verify net diff against main**

Run: `git diff --stat origin/main..HEAD`
Expected:
- `docs/superpowers/plans/2026-04-30-phase2a-finance-cost-pr-b.md` (+~400 lines)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` (+~250 lines, -~1 line for docstring)

No source files (`backend/python/**`) modified.

- [ ] **Step 4: Verify no source impl drift**

Run: `git diff origin/main..HEAD -- backend/python/`
Expected: empty (no output). Confirms PR-B is tests-only, no impl changes.

---

### Task 6: Push branch + create PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin phase2a/t-finance-cost-pr-b
```

- [ ] **Step 2: Create PR via gh CLI**

```bash
gh pr create --title "Phase 2A: /analysis/finance cost arithmetic depth tests (PR-B)" --body "$(cat <<'EOF'
## Summary

PR-B follow-up to cost PR-A (#25 `d6b48738a`) — adds 11 arithmetic depth tests for the cost endpoint Python implementation per spec §5.2.

- 6 tests in new class `TestCostStructureArithmetic` (structure-chart-level coverage)
- 5 tests in new class `TestCostTrendArithmetic` (trend-chart + period-key coverage)
- 1-line docstring update on existing `TestCostHelpers` (clarifies both classes coexist as helper-level vs chart-function-level coverage)

Pure tests — no `backend/python/**` source changes.

## Decisions locked from brainstorm

- **A**: Keep both `TestCostHelpers` (helper-level direct calls) and new `TestCost*Arithmetic` (chart-function-level via mocked `_query_finance_data`). Defense in depth.
- **B**: WEEK period key test uses mid-year date (`2025-06-15` → `2025-W24`) to avoid the known C1 ISO-year bug in `_get_period_key` (Rule 2 violation; deferred to its own PR).

## Test plan

- [x] `pytest tests/python/smartbi_compat/` — 254 → 265 passed (+11)
- [x] No regressions in foundation/payable/profit/cost-PR-A test classes
- [x] Each new class runs standalone via `pytest -v`
- [x] No source drift: `git diff origin/main..HEAD -- backend/python/` empty

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify PR created**

Run: `gh pr list --author @me --state open --limit 5`
Expected: new PR for `phase2a/t-finance-cost-pr-b` listed.

- [ ] **Step 4: Squash merge with admin override (CI Vercel rate-limit noise expected)**

Wait briefly for CI to start, then merge:

```bash
gh pr merge --squash --admin --delete-branch
```

Per memory `project_apr30_phase2a_finance_foundation_ship.md`: real CI (java/python/rn/vue) passes; Vercel free-tier rate-limit failures are billing not code. `--admin` overrides allowed.

- [ ] **Step 5: Verify merge landed on main**

```bash
git fetch origin main
git log origin/main --oneline -3
```

Expected: PR-B commit is the new HEAD on origin/main.

---

### Task 7: Cleanup worktree

- [ ] **Step 1: Return to main repo dir**

```bash
cd C:/Users/Steve/my-prototype-logistics
```

- [ ] **Step 2: Remove worktree**

```bash
git worktree remove --force .worktrees/phase2a-finance-cost-pr-b
git worktree prune
```

- [ ] **Step 3: Verify cleanup**

```bash
git worktree list
```

Expected: `.worktrees/phase2a-finance-cost-pr-b` no longer listed. Branch `phase2a/t-finance-cost-pr-b` deleted from origin (per `--delete-branch` in Task 6 Step 4).

- [ ] **Step 4: Verify origin/main is current**

```bash
git fetch origin main
git log origin/main --oneline -1
```

Expected: PR-B squash commit visible on origin/main.

---

## Audit cycles (reduced per `feedback_subagent_driven_audit_pattern.md`)

PR-B is mechanical work — pure tests against existing impl. Audit overhead reduced:

| Cycle | Status | Reason |
|---|---|---|
| Self-review | KEEP | Catch bite-sized errors before subagent dispatch |
| Spec reviewer | SKIP | Cost spec already audit-passed 4 cycles + on main |
| Cross-spec consistency | SKIP | No infra change; no sister specs to align with |
| Final implementation reviewer | KEEP | Verify ship-readiness before push |

Expected total issues surfaced: ~5 (typo / minor style / minor edge-case).

---

## Parallel work analysis

### Subagent: ✅ Suitable

Tasks 2, 3, 4 are independent additions to the same file at different sites (line 865 docstring vs append at end). Single subagent should bundle Task 2+3 or Task 3+4 to amortize context, since each task ends with a commit anyway.

Recommended bundling:
- **Subagent A**: Tasks 1+2 (commit plan + docstring update) — small, fast warmup
- **Subagent B**: Task 3 (TestCostStructureArithmetic class + 6 tests + commit)
- **Subagent C**: Task 4 (TestCostTrendArithmetic class + 5 tests + commit)
- **Subagent D**: Tasks 5+6+7 (verification + push + PR + merge + cleanup)

4 subagent dispatches total.

### Multi-Chat: ❌ Not applicable

Single endpoint, single test file, single PR. Conflict risk too high for parallel chats.

---

## Self-review

### 1. Spec coverage

| Spec §5.2 test | Plan task | Coverage |
|---|---|---|
| `test_total_zero_emits_empty_data` | Task 3 | ✅ |
| `test_three_categories_emit_three_pie_items` | Task 3 | ✅ |
| `test_percentage_rounding_half_up` | Task 3 | ✅ |
| `test_negative_cost_abs_defensive_in_structure` | Task 3 | ✅ |
| `test_create_pie_data_item_total_zero_percentage_zero` (renamed `test_create_pie_data_item_total_zero_value_positive_percentage_zero` for clarity vs existing TestCostHelpers test) | Task 3 | ✅ |
| `test_create_pie_data_item_percentage_calc_two_stage_scale` | Task 3 | ✅ |
| `test_empty_data_returns_empty_chartdata` | Task 4 | ✅ |
| `test_multi_month_aggregates_by_period_key` | Task 4 | ✅ |
| `test_stacked_series_three_categories_per_period` | Task 4 | ✅ |
| `test_negative_cost_abs_defensive_in_trend_aggregation` | Task 4 | ✅ |
| `test_get_period_key_format_yyyy_mm_yyyy_qN_yyyy_Wnn` | Task 4 | ✅ (mid-year only per B-i) |

11/11 spec tests covered.

### 2. Placeholder scan

No "TBD"/"TODO"/"implement later" in the plan. Each test step contains exact code.

### 3. Type consistency

Verified across tasks:
- `_get_cost_structure_chart` signature: `(factory_id, start_date, end_date)` — used consistently in Task 3 helper
- `_get_cost_trend_chart` signature: `(factory_id, start_date, end_date, period="MONTH")` — used consistently in Task 4 helper
- `_get_period_key` signature: `(d: date, period: str)` — used consistently in Task 4
- `_create_pie_data_item` signature: `(category, value: Decimal, total: Decimal)` — used consistently in Task 3 tests
- `monkeypatch` not used (chose direct `af._query_finance_data = fake; ... finally restore` pattern matching profit PR-B style at line 326-340 of test file). This is intentional consistency with sister tests, not a bug.

### 4. Renamed test

Spec §5.2 line 443 test name `test_create_pie_data_item_total_zero_percentage_zero` was renamed to `test_create_pie_data_item_total_zero_value_positive_percentage_zero` because the existing TestCostHelpers (line 893) already has `test_create_pie_data_item_total_zero_returns_zero_percentage` covering total=0+value=0; the PR-B variant tests total=0+value>0 which is a different branch. The rename clarifies the distinction. Spec name is descriptive intent, not literal symbol — rename is OK per writing-plans flexibility.

---

## Branch + ship checklist

- Worktree: `.worktrees/phase2a-finance-cost-pr-b/` (created by main session)
- Branch: `phase2a/t-finance-cost-pr-b` (tracks `origin/main`)
- Base commit: `fb92f4b01` (origin/main HEAD at session start; cost PR-A `d6b48738a` is in lineage)
- Expected merged commit count: 4 → squashed to 1 on main
- Expected ship LOC: ~280 (250 tests + 30 docstring/whitespace)
- Expected pytest delta: 254 → 265
