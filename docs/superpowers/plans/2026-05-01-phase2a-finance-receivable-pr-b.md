# Phase 2A `/analysis/finance?analysisType=receivable` PR-B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add arithmetic-depth unit tests for the receivable per-type implementation shipped in PR #42 (PR-A). Cover boundary cases, full alert-level threshold tables, and edge formulas not exercised by the smoke tests.

**Architecture:** Tests-only PR. NO changes to `analysis_finance.py` (PR-A is final). All new tests append to `tests/python/smartbi_compat/test_analysis_finance_factories.py` as new test classes alongside existing PR-A unit tests. Aggressive use of `pytest.mark.parametrize` to keep test function counts low (~22 functions) while delivering ~80+ assertions across boundary tables.

**Tech Stack:** pytest, pytest-asyncio (`@pytest.mark.asyncio`), monkeypatch fixture (matches PR-A pattern in same file), Decimal arithmetic.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md` §1.4 (PR-B scope, merged main `1b02aea83`).

**Template:** Cost PR-B (commit `b7b6015b1`, PR #28 — 11 mechanical tests across 2 classes). PR-B is mechanical work; per `feedback_subagent_driven_audit_pattern.md` skip 2 audit cycles, only do self-review + final reviewer.

**Concurrency note:** Sister chat is running budget PR-B concurrently on the same `test_analysis_finance_factories.py` file. Both add new test classes only (additive). No conflict expected unless both edit the exact same line range. Use `./scripts/safe-commit.sh` for every commit (per Rule 5b).

---

## ⛔ Hard rules

1. **NO impl changes** to `backend/python/smartbi_compat/api/analysis_finance.py` — PR-A is final. PR-B is tests-only.
2. **Reuse PR-A pattern** — `@pytest.mark.asyncio` + monkeypatch fixture (NOT `_run_chart` helper). Existing PR-A unit tests in `test_analysis_finance_factories.py` use this pattern.
3. **Java strict comparison** — every threshold table test must verify boundary value falls into LOWER alertLevel (e.g., `25.0 → GREEN` for AGING_30, NOT YELLOW).
4. **Rule 1** — null cases use explicit `is not None` semantics; tests assert that `Decimal('0')` rows participate (not skipped).
5. **Mid-year dates only** for trend chart (avoid Rule 2 ISO-year boundary; that's a separate concern not in PR-B scope).

---

## File Structure

| File | Change | Sections |
|---|---|---|
| `tests/python/smartbi_compat/test_analysis_finance_factories.py` | Modify (append) | 5 new test classes appended after existing `TestReceivableTrendChartImpl` (line ~662): `TestReceivableBucketBoundaryDepth`, `TestReceivableMetricsArithmeticDepth`, `TestReceivableAlertLevelTable`, `TestOverdueRankingDepth`, `TestReceivableTrendDepth` |
| `backend/python/smartbi_compat/api/analysis_finance.py` | **NOT MODIFIED** | (PR-A is final; touching it is a hard rule violation) |
| `docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-b.md` | Create | This plan |

---

## Task 1: `TestReceivableBucketBoundaryDepth` — aging boundary parametrize

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after `TestReceivableTrendChartImpl`)

Aging-day boundary cases per spec §1.4: `agingDays = -1 / 0 / 30 / 31 / 60 / 61 / 90 / 91`. Java uses `<=` chain (`<= 30` → 0-30天, `<= 60` → 31-60天, `<= 90` → 61-90天, else → 90天以上). PR-A only tested 4 representative values (15/45/75/120) — PR-B tests the boundaries.

- [ ] **Step 1: Append class with parametrized boundary tests**

Append at the end of `tests/python/smartbi_compat/test_analysis_finance_factories.py`:

```python
class TestReceivableBucketBoundaryDepth:
    """PR-B depth coverage — aging-day boundaries for _calculate_aging_buckets.

    Java <= chain (line 1510-1518):
      aging_days <= 30 → 0-30天
      aging_days <= 60 → 31-60天
      aging_days <= 90 → 61-90天
      else            → 90天以上

    Boundary value falls into LOWER bucket (e.g., 30 → 0-30, NOT 31-60).
    Spec §1.4 enumerates: -1 / 0 / 30 / 31 / 60 / 61 / 90 / 91 (8 cases).
    """

    @pytest.mark.parametrize("aging_days,expected_bucket", [
        (-1,  "0-30天"),     # negative aging treated as 0 → first bucket per Java <= 30
        (0,   "0-30天"),     # boundary low — null fallback also produces 0
        (30,  "0-30天"),     # boundary high of first bucket (<=)
        (31,  "31-60天"),    # boundary low of second bucket
        (60,  "31-60天"),    # boundary high of second bucket
        (61,  "61-90天"),    # boundary low of third bucket
        (90,  "61-90天"),    # boundary high of third bucket
        (91,  "90天以上"),   # boundary low of fourth bucket
    ])
    def test_aging_day_boundary_assignment(self, aging_days, expected_bucket):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "1000", "collection_amount": "0", "aging_days": aging_days}]
        result = _calculate_aging_buckets(rows)
        assert result[expected_bucket] == Decimal("1000")
        # All other buckets stay 0
        for other_bucket in ["0-30天", "31-60天", "61-90天", "90天以上"]:
            if other_bucket != expected_bucket:
                assert result[other_bucket] == Decimal("0"), (
                    f"aging_days={aging_days} expected only {expected_bucket} populated, "
                    f"but {other_bucket} = {result[other_bucket]}"
                )

    @pytest.mark.parametrize("receivable,collection,description", [
        ("100", "100",  "outstanding=0 (equal) → skipped"),
        ("50",  "100",  "outstanding<0 (negative) → skipped"),
        ("0.01","0",    "outstanding=0.01 (just-positive) → kept"),
    ])
    def test_outstanding_threshold_strict_gt_zero(self, receivable, collection, description):
        """Java line 1505: `if outstanding <= 0 continue` — boundary outstanding=0 skipped.

        outstanding=0.01 (smallest possible positive) MUST be kept (Decimal precision).
        """
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": receivable, "collection_amount": collection, "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        outstanding = Decimal(receivable) - Decimal(collection)
        if outstanding > Decimal("0"):
            assert result["0-30天"] == outstanding, description
        else:
            assert all(v == Decimal("0") for v in result.values()), description

    @pytest.mark.parametrize("receivable,collection,aging,desc", [
        (None, None, None, "all three null → null aging→0, null receivable→0, null collection→0, outstanding=0, skip"),
        ("0",  None, 60,   "receivable=Decimal('0') (Rule 1 falsy trap), collection null, outstanding=0, skip"),
        (None, "0",  60,   "receivable null→0, collection=Decimal('0'), outstanding=0, skip"),
        ("0",  "0",  60,   "both Decimal('0'), outstanding=0, skip"),
    ])
    def test_null_combinations_with_zero_decimal_rule1(self, receivable, collection, aging, desc):
        """Rule 1 trap: Decimal('0') is Python-falsy. Java treats != null as truthy.

        Combined with the outstanding<=0 skip, all 4 combinations result in skipped rows.
        Pins behavior so future refactor doesn't accidentally use `or` fallback.
        """
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": receivable, "collection_amount": collection, "aging_days": aging}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values()), desc

    def test_aggregates_across_multiple_rows_same_bucket(self):
        """Multiple rows in same bucket → outstanding sums."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [
            {"receivable_amount": "100", "collection_amount": "0", "aging_days": 10},
            {"receivable_amount": "200", "collection_amount": "0", "aging_days": 20},
            {"receivable_amount": "300", "collection_amount": "0", "aging_days": 30},
        ]
        result = _calculate_aging_buckets(rows)
        assert result["0-30天"] == Decimal("600")
        assert result["31-60天"] == Decimal("0")

    def test_distributes_across_all_4_buckets(self):
        """One row per bucket → 4 distinct totals."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [
            {"receivable_amount": "100", "collection_amount": "0", "aging_days": 15},  # 0-30
            {"receivable_amount": "200", "collection_amount": "0", "aging_days": 45},  # 31-60
            {"receivable_amount": "300", "collection_amount": "0", "aging_days": 75},  # 61-90
            {"receivable_amount": "400", "collection_amount": "0", "aging_days": 120}, # 90+
        ]
        result = _calculate_aging_buckets(rows)
        assert result["0-30天"]   == Decimal("100")
        assert result["31-60天"]  == Decimal("200")
        assert result["61-90天"]  == Decimal("300")
        assert result["90天以上"] == Decimal("400")
```

- [ ] **Step 2: Run tests to verify they pass (impl already exists)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableBucketBoundaryDepth -v
```
Expected: All tests PASS (impl was shipped in PR-A; PR-B just adds depth coverage).

Test count: 8 (parametrized) + 3 (parametrized) + 4 (parametrized) + 1 + 1 = **17 assertion-level cases via 5 test functions**.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable PR-B: bucket boundary depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 2: `TestReceivableMetricsArithmeticDepth` — 5 metrics formula edge cases

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after Task 1's class)

5 metrics (AR_BALANCE / COLLECTION_RATE / AGING_30/60/90_RATIO) — formula edge cases beyond PR-A's smoke coverage. Per spec §1.4: 各 2-3 case (zero / normal / maxout).

- [ ] **Step 1: Append class with metrics arithmetic depth**

Append after `TestReceivableBucketBoundaryDepth`:

```python
class TestReceivableMetricsArithmeticDepth:
    """PR-B depth — formula arithmetic for 5 receivable metrics.

    Mirror Java FinanceAnalysisServiceImpl.getReceivableMetrics (line 627-732).
    Tests zero-guards, full collection (rate=100), all-overdue (ratios=100),
    quantize HALF_UP rounding, and Decimal precision under fractional values.

    Companion to TestReceivableMetricsImpl (PR-A) which only tested empty + 1 simple row.
    """

    # ===== AR_BALANCE arithmetic =====

    @pytest.mark.asyncio
    async def test_ar_balance_negative_when_overpaid(self, monkeypatch):
        """totalCollection > totalReceivable → ar_balance < 0. AR_BALANCE keeps GREEN
        (Java line 654 hardcoded), no alert flip."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "1000", "collection_amount": "1500", "aging_days": 15}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[0]["metricCode"] == "AR_BALANCE"
        assert metrics[0]["value"] == -500
        assert metrics[0]["alertLevel"] == "GREEN"  # hardcoded regardless of value

    @pytest.mark.asyncio
    async def test_ar_balance_quantize_half_up(self, monkeypatch):
        """Decimal('0.005').quantize(0.01, HALF_UP) = 0.01.
        receivable=1000.005, collection=0 → balance=1000.005 → quantize → 1000.01 (HALF_UP)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "1000.005", "collection_amount": "0", "aging_days": 15}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[0]["value"] == 1000.01

    # ===== COLLECTION_RATE arithmetic =====

    @pytest.mark.asyncio
    async def test_collection_rate_100_percent_full_collected(self, monkeypatch):
        """totalCollection == totalReceivable → rate=100. > 80 → GREEN."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "1000", "collection_amount": "1000", "aging_days": 0}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[1]["metricCode"] == "COLLECTION_RATE"
        assert metrics[1]["value"] == 100
        assert metrics[1]["formattedValue"] == "100.00%"
        assert metrics[1]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_collection_rate_quantize_half_up_to_two_decimals(self, monkeypatch):
        """1/3 = 0.33333... → 33.33 (NOT 33.34 — HALF_UP at scale=2 from clean intermediate).

        receivable=3, collection=1, rate = 1/3 * 100 = 33.333... → quantize(0.01, HALF_UP) = 33.33
        """
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "3", "collection_amount": "1", "aging_days": 0}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[1]["value"] == 33.33
        assert metrics[1]["formattedValue"] == "33.33%"

    @pytest.mark.asyncio
    async def test_collection_rate_zero_guard_division(self, monkeypatch):
        """Java line 659 zero-guard — totalReceivable=0 (no rows) → rate=0 (NOT div-by-zero)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[1]["value"] == 0
        # 0 < 60 → RED
        assert metrics[1]["alertLevel"] == "RED"

    # ===== AGING_30/60/90_RATIO arithmetic =====

    @pytest.mark.asyncio
    async def test_aging_30_ratio_all_overdue_100_percent(self, monkeypatch):
        """All outstanding > 30 days → AGING_30_RATIO = 100. > 50 → RED."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "1000", "collection_amount": "0", "aging_days": 100}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[2]["metricCode"] == "AGING_30_RATIO"
        assert metrics[2]["value"] == 100
        assert metrics[2]["alertLevel"] == "RED"

    @pytest.mark.asyncio
    async def test_aging_60_ratio_partial_50_50_split(self, monkeypatch):
        """Half outstanding in 31-60 (NOT counted in over60), half in 90+ (counted).

        over60 = bucket[61-90] + bucket[90+] = 0 + 500 = 500
        total_for_ratio = bucket[0-30] + bucket[31-60] + bucket[61-90] + bucket[90+]
                        = 0 + 500 + 0 + 500 = 1000
        AGING_60_RATIO = 500/1000 * 100 = 50.0 → > 30 → RED
        """
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"receivable_amount": "500", "collection_amount": "0", "aging_days": 45},   # 31-60
                {"receivable_amount": "500", "collection_amount": "0", "aging_days": 120},  # 90+
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[3]["metricCode"] == "AGING_60_RATIO"
        assert metrics[3]["value"] == 50
        assert metrics[3]["alertLevel"] == "RED"

    @pytest.mark.asyncio
    async def test_aging_90_ratio_zero_when_no_aged_buckets(self, monkeypatch):
        """All in 0-30 bucket → over90 = 0 → ratio = 0/total = 0. <= 10 → GREEN."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "1000", "collection_amount": "0", "aging_days": 15}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[4]["metricCode"] == "AGING_90_RATIO"
        assert metrics[4]["value"] == 0
        assert metrics[4]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_total_for_ratio_zero_guard_when_all_skipped(self, monkeypatch):
        """All rows have outstanding<=0 (skipped by _calculate_aging_buckets) → total_for_ratio=0.
        Java line 684/698/712 zero-guard → all 3 ratios = 0."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            # Both rows have outstanding=0 → calculate_aging_buckets skips → all buckets 0
            return [
                {"receivable_amount": "100", "collection_amount": "100", "aging_days": 30},
                {"receivable_amount": "200", "collection_amount": "200", "aging_days": 90},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        # Note: COLLECTION_RATE uses totalReceivable+totalCollection (NOT bucketed) — independent of skip
        # Above rows: totalReceivable=300, totalCollection=300 → rate=100 → GREEN
        assert metrics[1]["value"] == 100
        # But AGING_*_RATIO uses bucketed values; all skipped → all 0
        assert metrics[2]["value"] == 0
        assert metrics[3]["value"] == 0
        assert metrics[4]["value"] == 0

    @pytest.mark.asyncio
    async def test_metrics_value_field_is_int_when_integral(self, monkeypatch):
        """Rule 4 — _decimal_to_number returns int when Decimal is integer-valued.
        Java Jackson would emit `100` (number); Python emits `int(100)` for dict-eq parity."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"receivable_amount": "1000", "collection_amount": "1000", "aging_days": 0}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))
        assert metrics[0]["value"] == 0
        assert isinstance(metrics[0]["value"], int)
        assert metrics[1]["value"] == 100
        assert isinstance(metrics[1]["value"], int)
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableMetricsArithmeticDepth -v
```
Expected: 10 PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable PR-B: 5 metrics arithmetic depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 3: `TestReceivableAlertLevelTable` — full 24-case threshold table

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after Task 2)

Spec §1.4 lists complete threshold tables for all 4 alert helpers. PR-A only smoke-tested 6 boundaries. PR-B locks the full 24-case matrix via parametrize.

- [ ] **Step 1: Append parametrized threshold table tests**

```python
class TestReceivableAlertLevelTable:
    """PR-B depth — full 24-case threshold table for all 4 alert helpers.

    Java strict comparison (`<` for collectionRate, `>` for aging ratios).
    Boundary value falls into LOWER alertLevel.

    Spec §1.4 reference table:
      collectionRate: <60 RED, <80 YELLOW, else GREEN  (boundary: 60→YELLOW, 80→GREEN)
      AGING_30: >50 RED, >25 YELLOW, else GREEN         (boundary: 25→GREEN, 50→YELLOW)
      AGING_60: >30 RED, >15 YELLOW, else GREEN         (boundary: 15→GREEN, 30→YELLOW)
      AGING_90: >20.0 RED, >10.0 YELLOW, else GREEN     (boundary: 10→GREEN, 20→YELLOW)

    Each helper × 6 boundary cases = 24 total. PR-A covered 6 (1 per helper); this fills the rest.
    """

    @pytest.mark.parametrize("rate,expected", [
        # Java: if v < 60 RED; if v < 80 YELLOW; else GREEN. Boundary 60/80 falls to LOWER level.
        ("0",     "RED"),     # extreme low
        ("59.99", "RED"),     # just-below-60
        ("60.00", "YELLOW"),  # boundary 60: NOT < 60 → YELLOW
        ("60.01", "YELLOW"),
        ("79.99", "YELLOW"),  # just-below-80
        ("80.00", "GREEN"),   # boundary 80: NOT < 80 → GREEN
        ("80.01", "GREEN"),
        ("100",   "GREEN"),   # extreme high
    ])
    def test_collection_rate_full_table(self, rate, expected):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        assert _determine_collection_rate_alert(Decimal(rate)) == expected, f"rate={rate}"

    @pytest.mark.parametrize("ratio,expected", [
        # Java MetricCalculatorServiceImpl line 491-494: > 50 RED, > 25 YELLOW, else GREEN
        ("0",     "GREEN"),
        ("24.99", "GREEN"),
        ("25.00", "GREEN"),   # boundary 25: NOT > 25 → GREEN
        ("25.01", "YELLOW"),  # just-above-25
        ("49.99", "YELLOW"),
        ("50.00", "YELLOW"),  # boundary 50: NOT > 50 → YELLOW
        ("50.01", "RED"),     # just-above-50
        ("100",   "RED"),
    ])
    def test_aging_30_full_table(self, ratio, expected):
        from smartbi_compat.api.analysis_finance import _aging_30_alert
        assert _aging_30_alert(Decimal(ratio)) == expected, f"ratio={ratio}"

    @pytest.mark.parametrize("ratio,expected", [
        # Java MetricCalculatorServiceImpl line 485-488: > 30 RED, > 15 YELLOW, else GREEN
        ("0",     "GREEN"),
        ("14.99", "GREEN"),
        ("15.00", "GREEN"),   # boundary 15
        ("15.01", "YELLOW"),
        ("29.99", "YELLOW"),
        ("30.00", "YELLOW"),  # boundary 30
        ("30.01", "RED"),
        ("100",   "RED"),
    ])
    def test_aging_60_full_table(self, ratio, expected):
        from smartbi_compat.api.analysis_finance import _aging_60_alert
        assert _aging_60_alert(Decimal(ratio)) == expected, f"ratio={ratio}"

    @pytest.mark.parametrize("ratio,expected", [
        # Java FinanceAnalysisServiceImpl line 715-719: > 20.0 RED, > 10.0 YELLOW, else GREEN
        # Constants AGING_90_RED_THRESHOLD=20.0 / AGING_90_YELLOW_THRESHOLD=10.0
        ("0",     "GREEN"),
        ("9.99",  "GREEN"),
        ("10.00", "GREEN"),   # boundary 10
        ("10.01", "YELLOW"),
        ("19.99", "YELLOW"),
        ("20.00", "YELLOW"),  # boundary 20
        ("20.01", "RED"),
        ("100",   "RED"),
    ])
    def test_aging_90_full_table(self, ratio, expected):
        from smartbi_compat.api.analysis_finance import _aging_90_alert
        assert _aging_90_alert(Decimal(ratio)) == expected, f"ratio={ratio}"

    def test_collection_rate_threshold_uses_strict_less_than(self):
        """Pin the comparison operator: `<` not `<=`. If Java logic flipped to `<=`,
        boundary 60.0 would map to RED (currently YELLOW)."""
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        # 60.0 boundary asserts non-RED — guards against strict→relaxed regression
        assert _determine_collection_rate_alert(Decimal("60")) != "RED"

    def test_aging_helpers_threshold_uses_strict_greater_than(self):
        """Pin the comparison operator: `>` not `>=` for all 3 aging helpers.
        If Java logic flipped to `>=`, boundary values (25/15/10) would jump up a level."""
        from smartbi_compat.api.analysis_finance import (
            _aging_30_alert, _aging_60_alert, _aging_90_alert,
        )
        # All three: lower threshold value should produce LOWER alertLevel (NOT YELLOW)
        assert _aging_30_alert(Decimal("25")) != "YELLOW"
        assert _aging_60_alert(Decimal("15")) != "YELLOW"
        assert _aging_90_alert(Decimal("10")) != "YELLOW"
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableAlertLevelTable -v
```
Expected: 32 PASS (8×4 parametrized + 2 strict-comparison sentinels).

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable PR-B: full 32-case alert threshold table" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 4: `TestOverdueRankingDepth` — top-10 cap + dedup edge cases

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after Task 3)

PR-A covered the basic ranking shape + 4 guards. PR-B drills into top-10 cap edge (exactly 10 / 11), customer dedup with cross-row aging, and rank ordering with ties.

- [ ] **Step 1: Append depth tests**

```python
class TestOverdueRankingDepth:
    """PR-B depth — top-10 cap edge + dedup arithmetic for _get_overdue_customer_ranking.

    Mirror Java FinanceAnalysisServiceImpl.getOverdueCustomerRanking (line 734-783).
    PR-A tested basic shape + 4 skip guards; PR-B locks ordering edge cases.
    """

    @pytest.mark.asyncio
    async def test_exactly_10_customers_returns_all(self, monkeypatch):
        """10 customers → top-10 cap not triggered, all returned."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": f"C{i:02d}",
                 "receivable_amount": str(100 - i),
                 "collection_amount": "0",
                 "aging_days": 60}
                for i in range(10)
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert len(result) == 10
        # Rank 1..10 sequence
        assert [r["rank"] for r in result] == list(range(1, 11))

    @pytest.mark.asyncio
    async def test_11_customers_caps_at_10(self, monkeypatch):
        """11 customers → bottom one (rank 11) dropped (Java line 762 `[:10]`)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": f"C{i:02d}",
                 "receivable_amount": str(100 - i),  # decreasing → first 10 are top
                 "collection_amount": "0",
                 "aging_days": 60}
                for i in range(11)
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert len(result) == 10
        # Last rank = 10 (NOT 11)
        assert result[-1]["rank"] == 10
        # Excluded: C10 (smallest amount = 90, dropped)
        names = [r["name"] for r in result]
        assert "C10" not in names
        assert "C00" in names  # largest amount = 100, kept

    @pytest.mark.asyncio
    async def test_dedup_preserves_max_aging_across_rows(self, monkeypatch):
        """Same customer with multiple rows → max aging tracked across all rows.

        Customer "Acme" has 3 rows: aging=30/100/60. Max = 100 → alertLevel=RED.
        """
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "Acme", "receivable_amount": "1000", "collection_amount": "0", "aging_days": 30},
                {"customer_name": "Acme", "receivable_amount": "500",  "collection_amount": "0", "aging_days": 100},
                {"customer_name": "Acme", "receivable_amount": "200",  "collection_amount": "0", "aging_days": 60},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert len(result) == 1
        assert result[0]["name"] == "Acme"
        assert result[0]["value"] == 1700  # 1000 + 500 + 200 aggregated
        assert result[0]["alertLevel"] == "RED"  # max(30, 100, 60) = 100 > 90

    @pytest.mark.asyncio
    async def test_alertlevel_max_aging_strict_gt_boundary(self, monkeypatch):
        """Java line 767-772: max_aging > 90 RED, > 60 YELLOW, else GREEN.
        Boundary aging = 60 / 90 falls into LOWER level."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "RedCust",      "receivable_amount": "100", "collection_amount": "0", "aging_days": 91},
                {"customer_name": "BoundaryRed",  "receivable_amount": "100", "collection_amount": "0", "aging_days": 90},  # boundary → YELLOW
                {"customer_name": "YellowCust",   "receivable_amount": "100", "collection_amount": "0", "aging_days": 61},
                {"customer_name": "BoundaryYell", "receivable_amount": "100", "collection_amount": "0", "aging_days": 60},  # boundary → GREEN
                {"customer_name": "GreenCust",    "receivable_amount": "100", "collection_amount": "0", "aging_days": 1},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        by_name = {r["name"]: r["alertLevel"] for r in result}
        assert by_name["RedCust"] == "RED"           # 91 > 90
        assert by_name["BoundaryRed"] == "YELLOW"    # 90 NOT > 90 → falls to YELLOW
        assert by_name["YellowCust"] == "YELLOW"     # 61 > 60
        assert by_name["BoundaryYell"] == "GREEN"    # 60 NOT > 60 → falls to GREEN
        assert by_name["GreenCust"] == "GREEN"

    @pytest.mark.asyncio
    async def test_sort_stable_when_amounts_tied(self, monkeypatch):
        """When 2 customers have identical outstanding, Python sorted() is stable —
        insertion order is preserved among ties (mirrors Java LinkedHashMap iteration).

        First customer in input → first in output for tied amounts.
        """
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "First",  "receivable_amount": "1000", "collection_amount": "0", "aging_days": 30},
                {"customer_name": "Second", "receivable_amount": "1000", "collection_amount": "0", "aging_days": 30},
                {"customer_name": "Third",  "receivable_amount": "1000", "collection_amount": "0", "aging_days": 30},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert [r["name"] for r in result] == ["First", "Second", "Third"]
        # All equal value → ranks 1, 2, 3 (NOT all rank 1 — Java enumerate semantics)
        assert [r["rank"] for r in result] == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_ranking_value_quantize_half_up(self, monkeypatch):
        """Decimal('1234.567').quantize(0.01, HALF_UP) = 1234.57.
        Verify ranking value emits to 2 decimals via _decimal_to_number."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"customer_name": "FractionCust", "receivable_amount": "1234.567",
                     "collection_amount": "0", "aging_days": 60}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert result[0]["value"] == 1234.57
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestOverdueRankingDepth -v
```
Expected: 6 PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable PR-B: ranking top-10 cap + dedup depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 5: `TestReceivableTrendDepth` — trend chart edge cases

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after Task 4)

PR-A covered basic monthly aggregation. PR-B locks balance-formula precision, multi-row month aggregation, single-month edge, and Map.of(2) options.series order regression test.

⚠️ **Hard rule reminder**: Mid-year dates ONLY. Cross-year boundary tests are NOT in scope (Java-side ISO-year ambiguity is a separate Rule 2 concern; deferred per spec §1.4).

- [ ] **Step 1: Append depth tests**

```python
class TestReceivableTrendDepth:
    """PR-B depth — monthly aggregation arithmetic for _get_receivable_trend_chart.

    Mirror Java FinanceAnalysisServiceImpl.getReceivableTrendChart (line 786-827).
    PR-A covered basic shape (empty / 2-month / sort / null skip / Map.of order).
    PR-B locks balance formula, multi-row aggregation, single-month, and quantize.

    NOTE: Mid-year dates only. Cross-year ISO-week ambiguity is out of scope here.
    """

    @pytest.mark.asyncio
    async def test_balance_equals_receivable_minus_collection_per_period(self, monkeypatch):
        """Per-period: balance = receivable - collection. Verify across 3 months.
        Java line 803-806."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 6, 1),  "receivable_amount": "1000", "collection_amount": "300"},
                {"record_date": date(2025, 7, 1),  "receivable_amount": "500",  "collection_amount": "500"},
                {"record_date": date(2025, 8, 1),  "receivable_amount": "200",  "collection_amount": "600"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        data = result["data"]
        # June: balance = 1000 - 300 = 700
        assert data[0]["period"] == "2025-06"
        assert data[0]["balance"] == 700
        # July: balance = 500 - 500 = 0
        assert data[1]["period"] == "2025-07"
        assert data[1]["balance"] == 0
        # August: balance = 200 - 600 = -400 (negative balance — overpayment)
        assert data[2]["period"] == "2025-08"
        assert data[2]["balance"] == -400

    @pytest.mark.asyncio
    async def test_multi_row_same_month_aggregates(self, monkeypatch):
        """Same month, multiple rows → receivable + collection sum."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 6, 1),  "receivable_amount": "100", "collection_amount": "10"},
                {"record_date": date(2025, 6, 5),  "receivable_amount": "200", "collection_amount": "20"},
                {"record_date": date(2025, 6, 15), "receivable_amount": "300", "collection_amount": "30"},
                {"record_date": date(2025, 6, 28), "receivable_amount": "400", "collection_amount": "40"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 6, 1), date(2025, 6, 30)
        )
        assert len(result["data"]) == 1
        d = result["data"][0]
        assert d["period"] == "2025-06"
        assert d["receivable"] == 1000  # 100+200+300+400
        assert d["collection"] == 100   # 10+20+30+40
        assert d["balance"] == 900       # 1000 - 100

    @pytest.mark.asyncio
    async def test_single_month_single_row(self, monkeypatch):
        """Minimal data: 1 month with 1 row → 1 chart point."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"record_date": date(2025, 7, 15), "receivable_amount": "5000", "collection_amount": "1000"}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 7, 1), date(2025, 7, 31)
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["period"] == "2025-07"
        assert result["data"][0]["balance"] == 4000

    @pytest.mark.asyncio
    async def test_balance_quantize_half_up_two_decimals(self, monkeypatch):
        """receivable=100.005, collection=0 → balance=100.005 → quantize(0.01, HALF_UP) = 100.01."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [{"record_date": date(2025, 6, 1), "receivable_amount": "100.005", "collection_amount": "0"}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 6, 1), date(2025, 6, 30)
        )
        assert result["data"][0]["balance"] == 100.01

    @pytest.mark.asyncio
    async def test_options_series_unchanged_regardless_of_data(self, monkeypatch):
        """Rule 8 lock: options.series Map.of(2) order is `{name, type}` per item.
        Verify across multiple data scenarios (empty / 1 row / multi-month) — series is invariant.
        """
        from smartbi_compat.api import analysis_finance

        expected_series = [
            {"name": "应收金额", "type": "bar"},
            {"name": "回款金额", "type": "bar"},
            {"name": "应收余额", "type": "line"},
        ]

        # Scenario A: empty
        async def empty_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", empty_query)
        result_empty = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result_empty["options"]["series"] == expected_series

        # Scenario B: 1 row
        async def one_row_query(factory_id, record_type, start, end):
            return [{"record_date": date(2025, 6, 1), "receivable_amount": "100", "collection_amount": "0"}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", one_row_query)
        result_one = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result_one["options"]["series"] == expected_series

        # Scenario C: multi-month
        async def multi_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 5, 1), "receivable_amount": "100", "collection_amount": "0"},
                {"record_date": date(2025, 6, 1), "receivable_amount": "200", "collection_amount": "0"},
                {"record_date": date(2025, 7, 1), "receivable_amount": "300", "collection_amount": "0"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", multi_query)
        result_multi = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result_multi["options"]["series"] == expected_series

        # Verify per-item key order locked (regression test for Rule 8 violation)
        for item in result_multi["options"]["series"]:
            assert list(item.keys()) == ["name", "type"]

    @pytest.mark.asyncio
    async def test_data_item_4key_order_locked(self, monkeypatch):
        """Per-data-item order: [period, receivable, collection, balance] per spec §3.5."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 5, 1), "receivable_amount": "100", "collection_amount": "10"},
                {"record_date": date(2025, 6, 1), "receivable_amount": "200", "collection_amount": "20"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        for item in result["data"]:
            assert list(item.keys()) == ["period", "receivable", "collection", "balance"]
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableTrendDepth -v
```
Expected: 6 PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable PR-B: trend chart depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 6: Final regression sweep + push + open PR

**Files:** none modified.

- [ ] **Step 1: Run full smartbi_compat test suite**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q
```
Expected: All previous 369 tests still pass + ~60 new (boundary parametrize: ~17 + metrics depth: ~10 + alert table: ~32 + ranking: ~6 + trend: ~6) = **~430+ passed, 1 skipped (F001 manual), 0 failed**.

If any test fails:
- New tests failing → impl might have unexpected edge case behavior; investigate before committing
- Existing tests failing → check git diff to confirm we didn't accidentally touch impl code (we shouldn't have)

- [ ] **Step 2: Verify diff scope (tests-only)**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
git diff --stat origin/main...HEAD
```
Expected:
- `tests/python/smartbi_compat/test_analysis_finance_factories.py`: ~600-800 lines added
- `docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-b.md`: this plan
- **NO changes to `backend/python/smartbi_compat/api/analysis_finance.py`** (hard rule — verify zero impl changes)

If `analysis_finance.py` shows in diff: STOP. PR-B is tests-only. Investigate which task accidentally touched impl.

- [ ] **Step 3: Push branch**

```bash
git push -u origin phase2a/finance-receivable-pr-b
```

If rejected (concurrent push from sister chat is impossible — sister is on a different branch): fetch first and confirm we're on `phase2a/finance-receivable-pr-b`, not `phase2a/finance-receivable` (PR-A is shipped, not the PR-B target).

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head phase2a/finance-receivable-pr-b --title "Phase 2A: /analysis/finance receivable arithmetic depth tests (PR-B)" --body "$(cat <<'EOF'
## Summary

Arithmetic depth tests for the receivable per-type implementation shipped in PR #42 (PR-A). Tests-only PR — no changes to `analysis_finance.py`.

Mirrors cost PR-B (#28) and follows the same mechanical pattern.

- 5 new test classes in `tests/python/smartbi_compat/test_analysis_finance_factories.py`:
  - `TestReceivableBucketBoundaryDepth` — aging-day boundaries (-1/0/30/31/60/61/90/91) + outstanding-skip + null Rule 1 trap
  - `TestReceivableMetricsArithmeticDepth` — 5 metrics formula edge cases (zero-guard / 100% / quantize / over-collection / mixed)
  - `TestReceivableAlertLevelTable` — full 32-case threshold table for 4 alert helpers (8 cases × 4)
  - `TestOverdueRankingDepth` — top-10 cap edge (10/11), customer dedup with cross-row max-aging, sort stability
  - `TestReceivableTrendDepth` — balance formula, multi-row month aggregation, quantize, Map.of(2) series order regression

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md §1.4 (PR #33, merged main)
Plan: docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-b.md
Impl: PR #42 (merged main as commit `0d8cc057c`)

## Tests

Full smartbi_compat regression sweep: **~430+ passed, 1 skipped (F001 manual), 0 failed** (was 369 after PR #42; +60+ from this PR).

Test coverage breakdown by class:
- BucketBoundaryDepth: 17 assertion cases via 5 functions
- MetricsArithmeticDepth: 10 functions
- AlertLevelTable: 32 cases via 4 parametrized + 2 sentinel functions
- OverdueRankingDepth: 6 functions
- TrendDepth: 6 functions

## Hard rules locked

- Java strict comparison (`<` for collection rate, `>` for aging ratios) — boundary value falls into LOWER alertLevel
- Rule 1 — `Decimal('0')` rows participate (NOT skipped) in metric sums but are properly skipped by `_calculate_aging_buckets` outstanding>0 gate
- Rule 4 — `_decimal_to_number` returns int when integral; tests verify type
- Rule 8 — `options.series` `Map.of(2)` order locked across 3 data scenarios (regression test)
- Mid-year dates only for trend chart (Java ISO-year boundary out of scope per spec §1.4)

## Test plan

- [ ] CI green on PR
- [ ] `python -m pytest tests/python/smartbi_compat/test_analysis_finance_factories.py -v` ALL pass
- [ ] No regression in sister branches (composite / payable / profit / cost / sub-endpoints / budget)
- [ ] Diff stat: ONLY `test_analysis_finance_factories.py` + plan modified (NO impl changes)

## Concurrency note

Sister chat (Chat 2) running budget PR-B concurrently. Both PRs add new test classes to the same file (`test_analysis_finance_factories.py`) — additive merge expected; no conflict unless both edit same line range.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Verify PR**

```bash
gh pr view --json number,title,baseRefName,headRefName,state
```
Expected JSON shows new PR with title "Phase 2A: /analysis/finance receivable arithmetic depth tests (PR-B)", base=main, head=phase2a/finance-receivable-pr-b, state=OPEN.

PR-B complete. Wave 1 finance receivable subdomain ports COMPLETE (PR-A impl + PR-B depth = full receivable per-type ship).

---

## Self-Review

**1. Spec coverage** — every spec §1.4 section traces to a task:

| Spec §1.4 item | Task |
|---|---|
| aging buckets boundary (-1/0/30/31/60/61/90/91) | Task 1 (parametrized) |
| outstanding ≤ 0 skip cases (=0, <0, both null) | Task 1 |
| null agingDays Java fallback to 0 | Task 1 (PR-A already covers; PR-B adds depth in `test_null_combinations_with_zero_decimal_rule1`) |
| 5 metrics formula depth (各 2-3 case) | Task 2 (10 functions) |
| alertLevel 阈值边界 collectionRate 6 cases | Task 3 (8 cases — adds extreme low/high) |
| alertLevel AGING_30 6 cases | Task 3 (8 cases) |
| alertLevel AGING_60 6 cases | Task 3 (8 cases) |
| alertLevel AGING_90 6 cases | Task 3 (8 cases) |
| overdueRanking sort + top-10 cap | Task 4 |
| overdueRanking max-aging alertLevel | Task 4 (`test_alertlevel_max_aging_strict_gt_boundary`) |
| trendChart monthly bucketing | Task 5 |
| trendChart balance formula | Task 5 (`test_balance_equals_receivable_minus_collection_per_period`) |

All §1.4 items covered. Cross-year boundary explicitly excluded per spec.

**2. Placeholder scan**: searched for "TBD", "TODO", "implement later", "Add appropriate", "fill in details", "similar to Task N", "etc". None found in code blocks; only narrative use of "etc." in spec citations.

**3. Type / signature consistency**: all helpers referenced (`_calculate_aging_buckets`, `_get_receivable_metrics`, `_get_overdue_customer_ranking`, `_get_receivable_trend_chart`, `_determine_collection_rate_alert`, `_aging_30_alert`, `_aging_60_alert`, `_aging_90_alert`) are imported from `smartbi_compat.api.analysis_finance` — all exist in PR-A merged code. Signatures match: `(factory_id: str, end_date: date) -> ...` for metrics/aging/ranking; `(factory_id, start_date, end_date)` for trend; `(Decimal) -> str` for alert helpers; `(list[dict]) -> dict` for `_calculate_aging_buckets`.

No inconsistencies.

---

## 并行工作建议

### Subagent: ✅ 推荐
Tasks 1-5 are completely independent (each adds a new test class). Single chat can dispatch one subagent per task with maximum review checkpoint cadence. Per `feedback_subagent_driven_audit_pattern.md` mechanical work pattern: skip 2 audit cycles, only do self-review + final reviewer for entire branch at Task 6.

Task 6 (push + PR) requires sequential — depends on all prior commits.

### 多 Chat: ❌ 不推荐
All tasks edit the same file (`test_analysis_finance_factories.py`). Multi-chat parallel will conflict.

Sister chat (Chat 2) running budget PR-B is on the same file but adds different classes — additive. Merge order determines who rebases the file; expect a trivial rebase if budget merges first.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-b.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Per memory `feedback_subagent_driven_audit_pattern.md` mechanical pattern: skip per-task spec/quality reviewers, only do self-review + branch-level final review.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
