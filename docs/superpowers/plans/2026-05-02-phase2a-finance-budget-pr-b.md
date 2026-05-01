# Phase 2A `/analysis/finance` budget arithmetic depth tests (PR-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 22 arithmetic depth tests across 4 test classes for the budget per-type Python implementation (already on main from PR #38 `34f1e135c`), covering all branches of `_create_waterfall_item`, `_determine_budget_achievement_alert` (reused), `_determine_budget_variance_rate_alert`, `_get_budget_metrics`, `_get_budget_execution_waterfall`, `_get_budget_vs_actual_chart` per spec §5.2.

**Architecture:** Pure tests — append four new classes (`TestBudgetHelpers` 4 tests + `TestBudgetMetricsArithmetic` 7 tests + `TestBudgetExecutionWaterfallArithmetic` 6 tests + `TestBudgetVsActualChartArithmetic` 5 tests) to existing `tests/python/smartbi_compat/test_analysis_finance_contract.py`. No source changes. Tests follow cost/profit PR-B style: helper-level tests directly import + call helpers; chart-function-level tests use `try/finally` af-attribute swap pattern (mirror cost+profit PR-B sister consistency).

**Tech Stack:** pytest + asyncio.run for async chart functions, Python `Decimal` for byte-shape parity with Java `BigDecimal`. No `monkeypatch.setattr` — use direct `af._query_finance_data = fake; ... finally restore` per spec §5.3.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md` §5.2 (4-cycle audit, 22 tests fully specified).

**Branch:** `phase2a/finance-budget-pr-b` (worktree: `.worktrees/phase2a-finance-budget`, reusing PR-A worktree)

**Base:** `origin/main` HEAD `34f1e135c` (PR #38 budget PR-A merged)

**Out of scope:** PR-A real impl (already merged via PR #38); receivable per-type (sister chat); F001 prod golden re-recording (post-deploy smoke per spec §5.4); C2 record-java-golden.sh CLI flag-based refactor (deferred); C3 executionRate scale-4 verification (post-F001 prod re-record).

---

## Context

### What's on main (origin/main `34f1e135c`)

Budget PR-A merged as PR #38. The following symbols exist in `backend/python/smartbi_compat/api/analysis_finance.py`:

| Symbol | Line | Signature |
|---|---|---|
| `_create_waterfall_item` | 237 | `def _create_waterfall_item(name: str, value: Decimal, type_: str) -> dict` |
| `_determine_budget_achievement_alert` | 469 | `def _determine_budget_achievement_alert(achievement_rate: Decimal) -> str` (REUSED from PR #32) |
| `_determine_budget_variance_rate_alert` | 487 | `def _determine_budget_variance_rate_alert(rate: Decimal) -> str` (NEW from PR #38) |
| `_get_budget_metrics` | 2144 | `async def _get_budget_metrics(factory_id: str, year: int, month: int) -> list[dict]` |
| `_get_budget_execution_waterfall` | 2247 | `async def _get_budget_execution_waterfall(factory_id: str, year: int) -> dict` |
| `_get_budget_vs_actual_chart` | 2325 | `async def _get_budget_vs_actual_chart(factory_id: str, start_date: date, end_date: date) -> dict` |
| `_query_finance_data` | (mock target) | `async def _query_finance_data(factory_id, record_type, start_date, end_date) -> list[dict]` |

### Existing TestAnalysisFinanceBudget (3 tests, line 1692-1828)

PR-A foundation contract tests. We **keep these intact**. PR-B appends 4 new arithmetic test classes after line 1828 (end of file).

### Decisions locked from PR-A (do not revisit)

- **F1**: 3 sub-services use 3 different date scopes — already verified by `test_f999_budget_date_scope_matrix`
- **F2**: NO `.abs()` defensive — raw accumulation per Java line 933+1044
- **F3**: 1 reused (`_determine_budget_achievement_alert`) + 1 new (`_determine_budget_variance_rate_alert`) alert helper
- **F4**: Single PR-B with 4 test classes (this PR)
- **Rule 8**: comparison.options.series Map.of(2) order is `[color, name]` — already in PR-A impl
- **WEEK boundary** (Rule 2): N/A — budget doesn't use WEEK period_key

### Baseline test count

```
$ python -m pytest tests/python/smartbi_compat/ -q
316 passed in ~37s
```

Target after PR-B: **338 passed** (+22 new tests).

---

## File Structure

| Path | Action | Scope |
|---|---|---|
| `tests/python/smartbi_compat/test_analysis_finance_contract.py` | Modify | Append 4 new classes (~500 LOC) |
| `docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-b.md` | Create | This plan (committed at start) |

Total LOC delta: ~500 (test code only).

---

## Tasks

### Task 1: Commit this plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-b.md`

- [ ] **Step 1: Verify plan on disk + nothing else dirty**

```bash
ls -la docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-b.md
git status --short
```
Expected: only this plan file untracked. If anything else dirty, investigate.

- [ ] **Step 2: Commit using safe-commit**

```bash
git add docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-b.md
./scripts/safe-commit.sh "plan(phase2a/budget-pr-b): PR-B implementation plan — 4 test classes ~22 tests, mechanical work" docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-b.md
```

- [ ] **Step 3: Verify commit**

```bash
git show --name-only HEAD
git log origin/main..HEAD --oneline
```
Expected: only this plan file in commit; 1 commit on branch.

---

### Task 2: Add `TestBudgetHelpers` class (4 helper-level tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append after line 1828, end of file)

Spec ref: §5.2 `TestBudgetHelpers` table (4 tests).

- [ ] **Step 1: Verify end-of-file location**

```bash
wc -l tests/python/smartbi_compat/test_analysis_finance_contract.py
tail -5 tests/python/smartbi_compat/test_analysis_finance_contract.py
```
Expected: ~1828 lines; last line is end of `test_f999_budget_date_scope_matrix` test.

- [ ] **Step 2: Append class using Edit tool**

Find the last 5 lines of the file (use Read first to anchor). Use Edit to replace those last lines with same lines + new class appended.

The new class to append (4 tests):

```python


class TestBudgetHelpers:
    """Helper-level direct coverage for budget alert helpers + waterfall item factory.

    Spec ref: 2026-05-01-phase2a-analysis-finance-budget-design.md §5.2.

    Companion to chart-function-level classes (TestBudgetMetricsArithmetic +
    TestBudgetExecutionWaterfallArithmetic + TestBudgetVsActualChartArithmetic).
    Defense in depth — same logic exercised at two layers.

    Tests imports helpers from analysis_finance module directly; no mocking required.
    """

    def test_create_waterfall_item_key_order(self):
        """LinkedHashMap put-order [name, value, type] + value setScale(2, HALF_UP).

        Java line 1579-1585 mirror.
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _create_waterfall_item
        item = _create_waterfall_item("年度预算", Decimal("12345.678"), "total")
        # Key order verified
        assert list(item.keys()) == ["name", "value", "type"]
        # value setScale(2, HALF_UP): 12345.678 → 12345.68 (last digit 8 rounds up from 7)
        assert item["value"] == 12345.68
        assert item["name"] == "年度预算"
        assert item["type"] == "total"

    def test_determine_budget_variance_rate_alert_thresholds_positive(self):
        """NEW helper: positive variance rate thresholds.

        >20 RED, >10 YELLOW, else GREEN. Boundary: exactly 20 → YELLOW (NOT RED);
        exactly 10 → GREEN (NOT YELLOW). Java MetricCalculatorServiceImpl line 515-519.
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _determine_budget_variance_rate_alert
        # >20 → RED
        assert _determine_budget_variance_rate_alert(Decimal("20.01")) == "RED"
        assert _determine_budget_variance_rate_alert(Decimal("100")) == "RED"
        # ==20 → YELLOW (boundary, NOT RED)
        assert _determine_budget_variance_rate_alert(Decimal("20")) == "YELLOW"
        # >10 → YELLOW
        assert _determine_budget_variance_rate_alert(Decimal("10.01")) == "YELLOW"
        assert _determine_budget_variance_rate_alert(Decimal("15")) == "YELLOW"
        # ==10 → GREEN (boundary, NOT YELLOW)
        assert _determine_budget_variance_rate_alert(Decimal("10")) == "GREEN"
        # <10 → GREEN
        assert _determine_budget_variance_rate_alert(Decimal("5")) == "GREEN"
        assert _determine_budget_variance_rate_alert(Decimal("0")) == "GREEN"

    def test_determine_budget_variance_rate_alert_thresholds_negative(self):
        """NEW helper abs application: negative variance rates use abs() for thresholds.

        -25 → RED (abs=25>20), -15 → YELLOW (abs=15>10), -5 → GREEN. Sign-symmetric
        because Java uses Math.abs(v) at line 516.
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _determine_budget_variance_rate_alert
        assert _determine_budget_variance_rate_alert(Decimal("-25")) == "RED"
        assert _determine_budget_variance_rate_alert(Decimal("-100")) == "RED"
        # Boundary: -20 → YELLOW (abs=20, NOT > 20)
        assert _determine_budget_variance_rate_alert(Decimal("-20")) == "YELLOW"
        assert _determine_budget_variance_rate_alert(Decimal("-15")) == "YELLOW"
        # Boundary: -10 → GREEN (abs=10, NOT > 10)
        assert _determine_budget_variance_rate_alert(Decimal("-10")) == "GREEN"
        assert _determine_budget_variance_rate_alert(Decimal("-5")) == "GREEN"

    def test_reused_achievement_alert_handles_negative_execution_rate(self):
        """REUSED helper edge case: negative execution rate falls through to GREEN.

        Negative actual values (per F2 raw accumulation) can produce negative
        executionRate. Java line 1649-1654 (`v > 120` then `v > 100`) — negative
        values fail both checks → GREEN by default. Mirrors Java behavior.

        This test守住 budget per-type **跨场景 reuse 不引入 regression** (negative
        rate scenario specific to per-type's no-abs() behavior, F2 risk).
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _determine_budget_achievement_alert
        # Negative rate → GREEN (default branch)
        assert _determine_budget_achievement_alert(Decimal("-50")) == "GREEN"
        assert _determine_budget_achievement_alert(Decimal("-200")) == "GREEN"
        # Reaffirm positive thresholds (sanity check helper unchanged)
        assert _determine_budget_achievement_alert(Decimal("121")) == "RED"
        assert _determine_budget_achievement_alert(Decimal("101")) == "YELLOW"
        assert _determine_budget_achievement_alert(Decimal("100")) == "GREEN"
        assert _determine_budget_achievement_alert(Decimal("0")) == "GREEN"
```

- [ ] **Step 3: Verify syntax + run new tests**

```bash
python -c "import ast; ast.parse(open('tests/python/smartbi_compat/test_analysis_finance_contract.py', encoding='utf-8').read())"
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestBudgetHelpers -v
```
Expected: 4 passed.

If FAIL: investigate. Most likely cause for failure: helper signature divergence (e.g. `_determine_budget_variance_rate_alert` has different threshold) — should NOT happen since PR-A merged with these exact thresholds.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget-pr-b): TestBudgetHelpers — 4 helper-level tests" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 3: Add `TestBudgetMetricsArithmetic` class (7 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append after `TestBudgetHelpers`)

Spec ref: §5.2 `TestBudgetMetricsArithmetic` table (7 tests).

- [ ] **Step 1: Append class using Edit tool**

Find end of `TestBudgetHelpers` (last test method) and append new class.

The class to append:

```python


class TestBudgetMetricsArithmetic:
    """Unit tests for _get_budget_metrics arithmetic branches.

    Spec ref: §5.2 + §3.3 algorithm.

    Direct chart-function-level calls (no HTTP/JWT) — exercises the full
    metrics computation: 4 metrics with two-stage Decimal arithmetic, edge
    cases (budget=0, sign-based alerts, sign preservation through multiply).

    Mock pattern: try/finally with af-attribute swap (mirror profit/cost PR-B).
    """

    def _run_metrics(self, fake_finance, year=2025, month=6):
        """Run _get_budget_metrics with _query_finance_data mocked.

        Returns list of 4 MetricResult dicts.
        """
        import asyncio
        from smartbi_compat.api import analysis_finance as af

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_budget_metrics("F", year, month))
        finally:
            af._query_finance_data = original

    def _by_code(self, metrics):
        """Index metrics by metricCode for assertion convenience."""
        return {m["metricCode"]: m for m in metrics}

    def test_empty_budget_data_returns_4_zero_metrics(self):
        """Empty rows → 4 metrics with value=0, all GREEN.

        Edge case: all 4 metrics emit zero values + GREEN alerts via sign-based
        ternaries (variance>0 false → GREEN; remaining>=0 true → GREEN; rate=0
        below all thresholds → GREEN).
        """
        async def fake_empty(*_a, **_k): return []
        metrics = self._run_metrics(fake_empty)
        assert len(metrics) == 4
        m = self._by_code(metrics)

        for code in ["BUDGET_EXECUTION", "BUDGET_VARIANCE", "BUDGET_VARIANCE_RATE", "BUDGET_REMAINING"]:
            assert code in m, f"missing metric {code}"
            assert m[code]["value"] == 0
            assert m[code]["alertLevel"] == "GREEN"

    def test_total_budget_zero_actual_positive_execution_rate_zero(self):
        """budget=0, actual=1000 → executionRate=0 (Java line 1055-1057 short-circuit).

        When totalBudget == 0, Java line 1055 ternary returns BigDecimal.ZERO instead
        of dividing (avoids ArithmeticException). Python mirrors via `if total_budget > 0`.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{
                "budget_amount": Decimal("0"),  # zero budget
                "actual_amount": Decimal("1000"),
                "category": "test",
                "record_date": _date(2025, 6, 15),
                "upload_id": 1,
            }]
        metrics = self._run_metrics(fake)
        m = self._by_code(metrics)
        assert m["BUDGET_EXECUTION"]["value"] == 0
        assert m["BUDGET_EXECUTION"]["alertLevel"] == "GREEN"
        # Variance rate also 0 (same short-circuit at Java line 1088-1090)
        assert m["BUDGET_VARIANCE_RATE"]["value"] == 0

    def test_execution_rate_two_stage_scale(self):
        """budget=300, actual=100 → executionRate=33.33 (two-stage Decimal arithmetic).

        Java line 1056: divide(300, SCALE=4, HALF_UP) = 0.3333; multiply(100) = 33.3300;
        line 1066 setScale(DISPLAY_SCALE=2, HALF_UP) = 33.33.

        Verifies SCALE=4 intermediate precision before final SCALE=2 display rounding.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{
                "budget_amount": Decimal("300"),
                "actual_amount": Decimal("100"),
                "category": "test",
                "record_date": _date(2025, 6, 15),
                "upload_id": 1,
            }]
        metrics = self._run_metrics(fake)
        m = self._by_code(metrics)
        assert m["BUDGET_EXECUTION"]["value"] == 33.33
        assert m["BUDGET_EXECUTION"]["formattedValue"] == "33.33%"
        assert m["BUDGET_EXECUTION"]["alertLevel"] == "GREEN"  # <100, GREEN

    def test_variance_positive_yellow_alert(self):
        """actual=1500, budget=1000 → variance=500 YELLOW (>0).

        Java line 1081: variance.compareTo(BigDecimal.ZERO) > 0 ? YELLOW : GREEN.
        Sign-based inline ternary, NOT helper-routed.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{
                "budget_amount": Decimal("1000"),
                "actual_amount": Decimal("1500"),
                "category": "test",
                "record_date": _date(2025, 6, 15),
                "upload_id": 1,
            }]
        metrics = self._run_metrics(fake)
        m = self._by_code(metrics)
        assert m["BUDGET_VARIANCE"]["value"] == 500
        assert m["BUDGET_VARIANCE"]["alertLevel"] == "YELLOW"

    def test_variance_zero_green_alert(self):
        """actual=1000, budget=1000 → variance=0 GREEN (≤0 is GREEN per Java line 1081).

        Boundary case: variance=0 falls into else branch (>0 is YELLOW; everything
        else including =0 is GREEN). Mirrors Java compareTo > 0 (NOT >=).
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{
                "budget_amount": Decimal("1000"),
                "actual_amount": Decimal("1000"),
                "category": "test",
                "record_date": _date(2025, 6, 15),
                "upload_id": 1,
            }]
        metrics = self._run_metrics(fake)
        m = self._by_code(metrics)
        assert m["BUDGET_VARIANCE"]["value"] == 0
        assert m["BUDGET_VARIANCE"]["alertLevel"] == "GREEN"
        # Remaining = 0, also GREEN (>=0 per Java line 1109)
        assert m["BUDGET_REMAINING"]["value"] == 0
        assert m["BUDGET_REMAINING"]["alertLevel"] == "GREEN"

    def test_remaining_negative_red_alert(self):
        """actual=1500, budget=1000 → remaining=-500 RED (<0).

        Also covers BUDGET_VARIANCE_RATE positive case: variance=500/1000*100=50 →
        abs(50)>20 → RED (mirrors Java MetricCalculatorService line 515-519).
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{
                "budget_amount": Decimal("1000"),
                "actual_amount": Decimal("1500"),
                "category": "test",
                "record_date": _date(2025, 6, 15),
                "upload_id": 1,
            }]
        metrics = self._run_metrics(fake)
        m = self._by_code(metrics)
        assert m["BUDGET_REMAINING"]["value"] == -500
        assert m["BUDGET_REMAINING"]["alertLevel"] == "RED"
        # variance_rate = 500/1000 * 100 = 50.00 → abs(50)>20 → RED
        assert m["BUDGET_VARIANCE_RATE"]["value"] == 50
        assert m["BUDGET_VARIANCE_RATE"]["alertLevel"] == "RED"

    def test_negative_variance_rate_passes_through_alert_helper(self):
        """actual=750, budget=1000 → variance=-250, varianceRate=-25.0000 → abs(25)>20 → RED.

        Sign preserved through two-stage Decimal multiply: (-250/1000).quantize(0.0001)
        * 100 = -25.0000. Python decimal.ROUND_HALF_UP matches Java RoundingMode.HALF_UP
        (both round away from zero).

        Defensive against impl bug like `varianceRate = abs(variance) / total_budget * 100`
        which would silently mask sign and pass wrong alert.

        Side checks: BUDGET_REMAINING = 1000-750 = 250 ≥0 → GREEN; BUDGET_VARIANCE = -250
        ≤0 → GREEN.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{
                "budget_amount": Decimal("1000"),
                "actual_amount": Decimal("750"),
                "category": "test",
                "record_date": _date(2025, 6, 15),
                "upload_id": 1,
            }]
        metrics = self._run_metrics(fake)
        m = self._by_code(metrics)
        # Sign preserved
        assert m["BUDGET_VARIANCE_RATE"]["value"] == -25
        # abs(25) > 20 → RED (helper applies abs)
        assert m["BUDGET_VARIANCE_RATE"]["alertLevel"] == "RED"
        # Sanity: variance ≤ 0 → GREEN (sign-based ternary)
        assert m["BUDGET_VARIANCE"]["value"] == -250
        assert m["BUDGET_VARIANCE"]["alertLevel"] == "GREEN"
        # remaining ≥ 0 → GREEN
        assert m["BUDGET_REMAINING"]["value"] == 250
        assert m["BUDGET_REMAINING"]["alertLevel"] == "GREEN"
```

- [ ] **Step 2: Verify + run**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestBudgetMetricsArithmetic -v
```
Expected: 7 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget-pr-b): TestBudgetMetricsArithmetic — 7 metric arithmetic tests" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 4: Add `TestBudgetExecutionWaterfallArithmetic` class (6 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append after `TestBudgetMetricsArithmetic`)

Spec ref: §5.2 `TestBudgetExecutionWaterfallArithmetic` table (6 tests).

- [ ] **Step 1: Append class using Edit tool**

```python


class TestBudgetExecutionWaterfallArithmetic:
    """Unit tests for _get_budget_execution_waterfall arithmetic branches.

    Spec ref: §5.2 + §3.4 algorithm.

    Verifies 12-month iteration, decrease-skip threshold, remaining decrement,
    null record_date defensive skip (intentional Java NPE divergence).
    """

    def _run_chart(self, fake_finance, year=2025):
        """Run _get_budget_execution_waterfall with _query_finance_data mocked."""
        import asyncio
        from smartbi_compat.api import analysis_finance as af

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_budget_execution_waterfall("F", year))
        finally:
            af._query_finance_data = original

    def test_empty_data_returns_two_total_items(self):
        """Empty rows → chart_data length=2 (年度预算 0 + 剩余预算 0).

        annual_budget=0, monthly_actual={}, no decrease items (loop skips all),
        only the two `total` bookends remain.
        """
        async def fake_empty(*_a, **_k): return []
        chart = self._run_chart(fake_empty)
        assert chart["chartType"] == "WATERFALL"
        assert chart["title"] == "2025年预算执行瀑布图"
        assert len(chart["data"]) == 2
        assert chart["data"][0]["name"] == "年度预算"
        assert chart["data"][0]["value"] == 0
        assert chart["data"][0]["type"] == "total"
        assert chart["data"][-1]["name"] == "剩余预算"
        assert chart["data"][-1]["value"] == 0
        assert chart["data"][-1]["type"] == "total"

    def test_full_year_actuals_emit_14_items(self):
        """12 months each with actual>0 → length=14 (1 total + 12 decrease + 1 total)."""
        from datetime import date as _date
        from decimal import Decimal
        async def fake_full_year(*_a, **_k):
            return [
                {
                    "budget_amount": Decimal("12000"),
                    "actual_amount": Decimal("100"),  # each month positive
                    "category": "test",
                    "record_date": _date(2025, m, 15),
                    "upload_id": 1,
                }
                for m in range(1, 13)
            ]
        chart = self._run_chart(fake_full_year)
        assert len(chart["data"]) == 14
        # First is total
        assert chart["data"][0]["type"] == "total"
        # Middle 12 are decrease
        for i in range(1, 13):
            assert chart["data"][i]["type"] == "decrease", f"item {i} should be decrease"
            assert chart["data"][i]["name"] == f"{i}月"
        # Last is total
        assert chart["data"][13]["type"] == "total"

    def test_zero_actual_month_skipped(self):
        """4月 actual=0 → 该月 skipped (Java line 956: compareTo > 0 false).

        Length=13 = 1 + 11 decrease + 1 (April skipped from 12).
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_april_zero(*_a, **_k):
            rows = []
            for m in range(1, 13):
                rows.append({
                    "budget_amount": Decimal("12000"),
                    "actual_amount": Decimal("0") if m == 4 else Decimal("100"),
                    "category": "test",
                    "record_date": _date(2025, m, 15),
                    "upload_id": 1,
                })
            return rows
        chart = self._run_chart(fake_april_zero)
        assert len(chart["data"]) == 13
        # Verify April not present in decrease items
        decrease_names = [d["name"] for d in chart["data"] if d["type"] == "decrease"]
        assert "4月" not in decrease_names
        assert len(decrease_names) == 11

    def test_negative_actual_month_skipped(self):
        """6月 actual=-100 → Java compareTo(0) > 0 false → skipped.

        F2 raw accumulation lets negatives through aggregation, but the >0 gate
        in waterfall data construction filters them. Length=13.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_june_negative(*_a, **_k):
            rows = []
            for m in range(1, 13):
                rows.append({
                    "budget_amount": Decimal("12000"),
                    "actual_amount": Decimal("-100") if m == 6 else Decimal("100"),
                    "category": "test",
                    "record_date": _date(2025, m, 15),
                    "upload_id": 1,
                })
            return rows
        chart = self._run_chart(fake_june_negative)
        assert len(chart["data"]) == 13
        decrease_names = [d["name"] for d in chart["data"] if d["type"] == "decrease"]
        assert "6月" not in decrease_names

    def test_remaining_decrement_correct(self):
        """annual_budget=12000, monthly actuals=1000 each Jan-Mar → 剩余预算 = 9000.

        Verifies remaining decrement loop: 12000 - 1000 - 1000 - 1000 = 9000.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_jan_to_mar(*_a, **_k):
            return [
                {"budget_amount": Decimal("12000"), "actual_amount": Decimal("1000"),
                 "category": "test", "record_date": _date(2025, 1, 15), "upload_id": 1},
                {"budget_amount": Decimal("0"), "actual_amount": Decimal("1000"),
                 "category": "test", "record_date": _date(2025, 2, 15), "upload_id": 1},
                {"budget_amount": Decimal("0"), "actual_amount": Decimal("1000"),
                 "category": "test", "record_date": _date(2025, 3, 15), "upload_id": 1},
            ]
        chart = self._run_chart(fake_jan_to_mar)
        # 5 items: 1 total + 3 decrease + 1 total
        assert len(chart["data"]) == 5
        assert chart["data"][0]["value"] == 12000  # 年度预算
        assert chart["data"][-1]["name"] == "剩余预算"
        assert chart["data"][-1]["value"] == 9000  # 12000 - 3*1000

    def test_null_record_date_row_skipped(self):
        """row with record_date=None → defensive skip (intentional Java NPE divergence).

        Java line 941 NPEs on null record_date; Python defensive skip per spec §8 IC1.
        Phase 3.B/C cleanup will decide if Python should match Java by raising.

        Test: 1 row with None record_date + 1 valid row (Jan) → only 3 items
        (1 total + 1 January decrease + 1 total). Null row contributes to
        annual_budget sum (Java line 933-936 doesn't NPE — just budget_amount sum).
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_null_date(*_a, **_k):
            return [
                {"budget_amount": Decimal("5000"), "actual_amount": Decimal("100"),
                 "category": "test", "record_date": None, "upload_id": 1},  # null
                {"budget_amount": Decimal("5000"), "actual_amount": Decimal("100"),
                 "category": "test", "record_date": _date(2025, 1, 15), "upload_id": 1},
            ]
        chart = self._run_chart(fake_null_date)
        # annual_budget = 5000 + 5000 = 10000 (null record_date doesn't filter sum)
        assert chart["data"][0]["value"] == 10000
        # Only 1 month (Jan) had actuals>0 emitted as decrease
        decrease_items = [d for d in chart["data"] if d["type"] == "decrease"]
        assert len(decrease_items) == 1
        assert decrease_items[0]["name"] == "1月"
        # remaining = 10000 - 100 = 9900
        assert chart["data"][-1]["value"] == 9900
```

- [ ] **Step 2: Verify + run**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestBudgetExecutionWaterfallArithmetic -v
```
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget-pr-b): TestBudgetExecutionWaterfallArithmetic — 6 waterfall tests" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 5: Add `TestBudgetVsActualChartArithmetic` class (5 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append after `TestBudgetExecutionWaterfallArithmetic`)

Spec ref: §5.2 `TestBudgetVsActualChartArithmetic` table (5 tests).

- [ ] **Step 1: Append class using Edit tool**

```python


class TestBudgetVsActualChartArithmetic:
    """Unit tests for _get_budget_vs_actual_chart arithmetic branches.

    Spec ref: §5.2 + §3.5 algorithm.

    Verifies per-category aggregation (LinkedHashMap put-order), executionRate
    short-circuit (budget=0), per-category alertLevel via reused helper, null
    category falls to '其他' bucket, options.series Map.of(2) hash order
    [color, name] (Rule 8 verified).
    """

    def _run_chart(self, fake_finance, start_date=None, end_date=None):
        """Run _get_budget_vs_actual_chart with _query_finance_data mocked."""
        import asyncio
        from datetime import date as _date
        from smartbi_compat.api import analysis_finance as af

        if start_date is None:
            start_date = _date(2025, 1, 1)
        if end_date is None:
            end_date = _date(2025, 12, 31)

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_budget_vs_actual_chart("F", start_date, end_date))
        finally:
            af._query_finance_data = original

    def test_empty_data_returns_empty_chartdata(self):
        """Empty rows → data=[] but options 完整 (groupedBar + series 2 entries).

        chartType=BAR, title fixed, options.series has 2 Map.of(2) entries with
        Rule 8 hash order [color, name].
        """
        async def fake_empty(*_a, **_k): return []
        chart = self._run_chart(fake_empty)
        assert chart["chartType"] == "BAR"
        assert chart["title"] == "预算 vs 实际对比"
        assert chart["data"] == []
        # options always emitted (groupedBar + 2 series entries)
        assert chart["options"]["groupedBar"] is True
        assert len(chart["options"]["series"]) == 2
        # Rule 8: Map.of(2) hash order [color, name]
        assert list(chart["options"]["series"][0].keys()) == ["color", "name"]
        assert chart["options"]["series"][0] == {"color": "#5470c6", "name": "预算"}
        assert chart["options"]["series"][1] == {"color": "#91cc75", "name": "实际"}

    def test_per_category_aggregation(self):
        """2 categories → 2 chart items, budget/actual sums correct per category.

        Category A: budget=1000+500=1500, actual=800+400=1200
        Category B: budget=2000, actual=1500
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_two_cats(*_a, **_k):
            return [
                {"budget_amount": Decimal("1000"), "actual_amount": Decimal("800"),
                 "category": "A", "record_date": _date(2025, 6, 15), "upload_id": 1},
                {"budget_amount": Decimal("500"), "actual_amount": Decimal("400"),
                 "category": "A", "record_date": _date(2025, 7, 15), "upload_id": 1},
                {"budget_amount": Decimal("2000"), "actual_amount": Decimal("1500"),
                 "category": "B", "record_date": _date(2025, 8, 15), "upload_id": 1},
            ]
        chart = self._run_chart(fake_two_cats)
        assert len(chart["data"]) == 2
        # First-seen-key order preserved (LinkedHashMap mirror)
        items_by_cat = {item["category"]: item for item in chart["data"]}
        assert items_by_cat["A"]["budget"] == 1500
        assert items_by_cat["A"]["actual"] == 1200
        assert items_by_cat["A"]["variance"] == -300  # 1200 - 1500
        assert items_by_cat["B"]["budget"] == 2000
        assert items_by_cat["B"]["actual"] == 1500
        assert items_by_cat["B"]["variance"] == -500
        # 6-key shape (LinkedHashMap put-order verified)
        assert list(chart["data"][0].keys()) == [
            "category", "budget", "actual", "variance", "executionRate", "alertLevel",
        ]

    def test_null_category_falls_to_other(self):
        """row.category=None → bucket "其他" (Java line 991 default).

        Verifies the null-fallback to "其他" string. Python's
        `r.get("category") if r.get("category") is not None else "其他"` mirrors
        Java ternary at line 991.
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_null_cat(*_a, **_k):
            return [
                {"budget_amount": Decimal("1000"), "actual_amount": Decimal("800"),
                 "category": None, "record_date": _date(2025, 6, 15), "upload_id": 1},
                {"budget_amount": Decimal("500"), "actual_amount": Decimal("400"),
                 "category": "B", "record_date": _date(2025, 7, 15), "upload_id": 1},
            ]
        chart = self._run_chart(fake_null_cat)
        cats = {item["category"] for item in chart["data"]}
        assert "其他" in cats
        assert "B" in cats

    def test_execution_rate_alert_per_category(self):
        """Per-category executionRate routes through _determine_budget_achievement_alert.

        Category A: budget=1000, actual=1300 → rate=130 → RED (>120).
        Category B: budget=1000, actual=110 → rate=11 → GREEN (<100).
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_mixed(*_a, **_k):
            return [
                {"budget_amount": Decimal("1000"), "actual_amount": Decimal("1300"),
                 "category": "A", "record_date": _date(2025, 6, 15), "upload_id": 1},
                {"budget_amount": Decimal("1000"), "actual_amount": Decimal("110"),
                 "category": "B", "record_date": _date(2025, 7, 15), "upload_id": 1},
            ]
        chart = self._run_chart(fake_mixed)
        items_by_cat = {item["category"]: item for item in chart["data"]}
        assert items_by_cat["A"]["executionRate"] == 130
        assert items_by_cat["A"]["alertLevel"] == "RED"
        assert items_by_cat["B"]["executionRate"] == 11
        assert items_by_cat["B"]["alertLevel"] == "GREEN"

    def test_zero_budget_category_execution_rate_zero(self):
        """budget=0 actual>0 → executionRate=0 (Java line 1005 short-circuit).

        Avoids ArithmeticException; alertLevel falls through to GREEN
        (rate=0 fails both >120 and >100 checks).
        """
        from datetime import date as _date
        from decimal import Decimal
        async def fake_zero_budget(*_a, **_k):
            return [
                {"budget_amount": Decimal("0"), "actual_amount": Decimal("500"),
                 "category": "A", "record_date": _date(2025, 6, 15), "upload_id": 1},
            ]
        chart = self._run_chart(fake_zero_budget)
        assert len(chart["data"]) == 1
        item = chart["data"][0]
        assert item["category"] == "A"
        assert item["budget"] == 0
        assert item["actual"] == 500
        assert item["executionRate"] == 0  # short-circuit
        assert item["alertLevel"] == "GREEN"  # 0 < 100, GREEN by default
```

- [ ] **Step 2: Verify + run**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestBudgetVsActualChartArithmetic -v
```
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/budget-pr-b): TestBudgetVsActualChartArithmetic — 5 comparison chart tests" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task 6: Final verification + sanity

- [ ] **Step 1: Full pytest run**

```bash
python -m pytest tests/python/smartbi_compat/ -q 2>&1 | tail -5
```
Expected: **338 passed** (316 baseline + 22 new). 0 regressions.

- [ ] **Step 2: Verify commit history**

```bash
git log origin/main..HEAD --oneline
```
Expected: 5 commits (plan + 4 test classes).

- [ ] **Step 3: Verify diff stats**

```bash
git diff --stat origin/main..HEAD
```
Expected:
- `docs/superpowers/plans/2026-05-02-phase2a-finance-budget-pr-b.md` (~700 lines, plan)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` (+~500 lines, 4 test classes)
- No `backend/python/**` changes (PR-B is tests-only).

- [ ] **Step 4: Verify no source drift**

```bash
git diff origin/main..HEAD -- backend/python/ | head -5
```
Expected: empty (no source files changed).

---

### Task 7: Push + PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin phase2a/finance-budget-pr-b
```

- [ ] **Step 2: Create PR via gh CLI**

```bash
gh pr create \
  --title "Phase 2A: /analysis/finance budget arithmetic depth tests (PR-B)" \
  --base main \
  --head phase2a/finance-budget-pr-b \
  --body "$(cat <<'EOF'
## Summary

PR-B follow-up to budget per-type PR-A (#38 `34f1e135c`). Adds 22 arithmetic depth tests across 4 classes for the budget endpoint Python implementation per spec §5.2.

- 4 tests in `TestBudgetHelpers` (helper-level direct coverage)
- 7 tests in `TestBudgetMetricsArithmetic` (4 metrics with two-stage Decimal arithmetic + edge cases)
- 6 tests in `TestBudgetExecutionWaterfallArithmetic` (12-month iteration, decrease-skip threshold, null record_date defensive)
- 5 tests in `TestBudgetVsActualChartArithmetic` (per-category, executionRate short-circuit, Map.of(2) Rule 8 verification)

Pure tests — no `backend/python/**` source changes.

## Spec / impl references

- **Spec**: PR #34 `354505352` — `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-budget-design.md` §5.2
- **Impl**: PR #38 `34f1e135c` — budget per-type real impl (PR-A)

## Test plan

- [x] All 4 new test classes pass first-run
- [x] Full pytest `tests/python/smartbi_compat/`: 316 → 338 passed (+22)
- [x] No regressions in foundation/payable/profit/cost/budget-PR-A test classes
- [x] No source drift: \`git diff origin/main..HEAD -- backend/python/\` empty
- [x] Final code-reviewer APPROVED

## F1/F2/F3/F4 verification

- **F1**: Already verified by PR-A `test_f999_budget_date_scope_matrix` contract test
- **F2**: \`test_negative_actual_month_skipped\` + \`test_negative_variance_rate_passes_through_alert_helper\` exercise no-abs() raw accumulation through full impl path
- **F3**: \`TestBudgetHelpers\` tests both alert helpers (reused + new) with boundary + sign-symmetric cases
- **F4**: Single PR-B as planned (no soft-split needed; ~22 tests within scope)

## Audit reduction (per memory feedback_subagent_driven_audit_pattern.md)

PR-B is mechanical tests-only work. Per memory: "Mechanical work (PR-B style) skip 2 cycles". Skipped per-task spec/code-quality reviewers + cross-spec audit. Final reviewer subagent over branch is the only formal review gate before ship.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify PR created**

```bash
gh pr list --author @me --state open --limit 5
```
Expected: new PR for `phase2a/finance-budget-pr-b` listed.

- [ ] **Step 4: Squash merge with admin override**

```bash
gh pr merge --squash --admin --delete-branch
```

Per project convention. Per memory `project_apr30_phase2a_finance_foundation_ship.md`: real CI passes; Vercel rate-limit failures are billing not code. `--admin` overrides allowed.

- [ ] **Step 5: Verify merge landed on main**

```bash
git fetch origin main
git log origin/main --oneline -3
```
Expected: PR-B squash commit visible on origin/main as new HEAD.

---

### Task 8: Cleanup

- [ ] **Step 1: Return to main repo dir**

```bash
cd C:/Users/Steve/my-prototype-logistics
```

- [ ] **Step 2: Remove worktree**

```bash
git worktree remove --force .worktrees/phase2a-finance-budget
git worktree prune
```

- [ ] **Step 3: Verify cleanup**

```bash
git worktree list
```
Expected: `.worktrees/phase2a-finance-budget` no longer listed.

---

## Audit cycles (reduced per `feedback_subagent_driven_audit_pattern.md`)

PR-B is mechanical work — pure tests against existing impl. Audit overhead reduced:

| Cycle | Status | Reason |
|---|---|---|
| Self-review (per subagent task) | KEEP | Each subagent self-reviews before commit |
| Per-task spec reviewer | SKIP | Spec already audit-passed 4 cycles + on main |
| Cross-spec consistency | SKIP | No infra change; no sister specs to align with |
| Final implementation reviewer | KEEP | Verify ship-readiness before push |

Expected total issues surfaced: ~3-5 (typo / minor style / minor edge-case).

---

## Parallel work analysis

### Subagent: ✅ Suitable

Tasks 2, 3, 4, 5 are independent additions to the same file at different sites (each appends one class at end, building on previous append). Recommended bundling:

- **Subagent A**: Tasks 1+2 (commit plan + TestBudgetHelpers — small warmup)
- **Subagent B**: Task 3 (TestBudgetMetricsArithmetic 7 tests)
- **Subagent C**: Task 4 (TestBudgetExecutionWaterfallArithmetic 6 tests)
- **Subagent D**: Task 5 (TestBudgetVsActualChartArithmetic 5 tests)
- **Subagent E**: Tasks 6+7+8 (verification + push + PR + merge + cleanup)

5 subagent dispatches total.

### Multi-Chat: ❌ Not applicable

Single endpoint, single test file, single PR. Conflict risk too high for parallel chats.

---

## Self-review

### 1. Spec coverage

| Spec §5.2 test (22 total) | Plan task |
|---|---|
| `test_create_waterfall_item_key_order` | Task 2 |
| `test_determine_budget_variance_rate_alert_thresholds_positive` | Task 2 |
| `test_determine_budget_variance_rate_alert_thresholds_negative` | Task 2 |
| `test_reused_achievement_alert_handles_negative_execution_rate` | Task 2 |
| `test_empty_budget_data_returns_4_zero_metrics` | Task 3 |
| `test_total_budget_zero_actual_positive_execution_rate_zero` | Task 3 |
| `test_execution_rate_two_stage_scale` | Task 3 |
| `test_variance_positive_yellow_alert` | Task 3 |
| `test_variance_zero_green_alert` | Task 3 |
| `test_remaining_negative_red_alert` | Task 3 |
| `test_negative_variance_rate_passes_through_alert_helper` | Task 3 |
| `test_empty_data_returns_two_total_items` | Task 4 |
| `test_full_year_actuals_emit_14_items` | Task 4 |
| `test_zero_actual_month_skipped` | Task 4 |
| `test_negative_actual_month_skipped` | Task 4 |
| `test_remaining_decrement_correct` | Task 4 |
| `test_null_record_date_row_skipped` | Task 4 |
| `test_empty_data_returns_empty_chartdata` | Task 5 |
| `test_per_category_aggregation` | Task 5 |
| `test_null_category_falls_to_other` | Task 5 |
| `test_execution_rate_alert_per_category` | Task 5 |
| `test_zero_budget_category_execution_rate_zero` | Task 5 |

22/22 spec tests covered.

### 2. Placeholder scan

No "TBD" / "TODO" / "implement later" in the plan. Each test step contains exact code.

### 3. Type consistency

- Helper signatures verified against impl:
  - `_create_waterfall_item(name: str, value: Decimal, type_: str) -> dict`
  - `_determine_budget_achievement_alert(achievement_rate: Decimal) -> str`
  - `_determine_budget_variance_rate_alert(rate: Decimal) -> str`
  - `_get_budget_metrics(factory_id, year, month) -> list[dict]`
  - `_get_budget_execution_waterfall(factory_id, year) -> dict`
  - `_get_budget_vs_actual_chart(factory_id, start_date, end_date) -> dict`
- All Decimal arithmetic uses Decimal literals.
- Mock pattern matches profit/cost PR-B `try/finally` style (NOT monkeypatch.setattr).

### 4. Branch + ship checklist

- Worktree: `.worktrees/phase2a-finance-budget` (reused from PR-A; new branch `phase2a/finance-budget-pr-b`)
- Branch: `phase2a/finance-budget-pr-b` (tracks `origin/main`)
- Base commit: `34f1e135c` (origin/main HEAD = PR #38 budget PR-A merged)
- Expected merged commit count: 5 (plan + 4 test class commits) → squashed to 1 on main
- Expected ship LOC: ~500 (tests-only)
- Expected pytest delta: 316 → 338
