# Phase 2A `/analysis/finance?analysisType=receivable` PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Java `/analysis/finance?analysisType=receivable` to Python with byte-shape parity. Replace existing 4-bucket stub `_get_receivable_aging_chart` with real impl; add 1 main helper + 4 sub-helpers + 2 utilities + module constants + 1 dispatcher branch.

**Architecture:** 1:1 mirror of Java `FinanceAnalysisServiceImpl` lines 583-827, 1492-1524, 1590-1603. Reuse existing helpers (`_query_finance_data`, `_decimal_to_number`, `_format_currency`, `_new_metric_result_dict`, `_new_chart_config_dict`, `_new_ranking_item_dict`). 1-year data window for metrics/agingChart/overdueRanking via `dateutil.relativedelta(years=1)` (leap-year safe); trendChart uses [start_date, end_date]. Composite path transparently upgrades when stub is replaced.

**Tech Stack:** Python 3.8+ (FastAPI, asyncpg, Decimal), pytest + monkeypatch, `python-dateutil>=2.8.0` (already in `requirements.txt`).

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md` (PR #33, merged main `1b02aea83`)

**Concurrency note:** Sister chat `phase2a/finance-budget` is concurrently editing `analysis_finance.py` (budget per-type impl). Expect ~5-line dispatcher conflict on second-to-merge PR (trivial rebase). Use `./scripts/safe-commit.sh` for every commit (per `.claude/rules/concurrent-edit-safety.md` Rule 5b).

---

## File Structure

| File | Change | Sections |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_finance.py` | Modify | Add `dateutil.relativedelta` import (top); add `# === Receivable constants ===` block near top; add 2 utilities (`_calculate_aging_buckets`, `_get_aging_bucket_alert_level`) + 4 threshold helpers near other module-level helpers; replace existing stub `_get_receivable_aging_chart` (line 1853) with real impl; add 3 new sub-helpers (`_get_receivable_metrics`, `_get_overdue_customer_ranking`, `_get_receivable_trend_chart`) and main `_get_receivable_analysis`; add `if analysisType == "receivable":` dispatcher branch in `get_finance_analysis` |
| `tests/python/smartbi_compat/test_analysis_finance_contract.py` | Modify | Add `TestAnalysisFinanceReceivable` class with F999 byte-shape gate, F001 manual smoke (skipped), composite side-effect test |
| `tests/python/smartbi_compat/test_analysis_finance_factories.py` | Modify | Add unit tests for `_get_aging_bucket_alert_level`, `_calculate_aging_buckets`, 4 threshold helpers (PR-A smoke depth only; arithmetic depth is PR-B) |
| `tests/fixtures/java-smartbi-golden/analysis-finance-F999-receivable.json` | (already exists) | F999 byte-shape golden recorded Apr 30 |
| `tests/fixtures/java-smartbi-golden/analysis-finance-F001-receivable.json` | (already exists) | F001 manual smoke golden recorded Apr 30 |

---

## Task 1: Pre-flight — Java line ref drift check

**Files:** read-only inspection.

Spec §8 risks line says: "PR-A plan 第一 task: pre-impl 重新 grep 8 个 Java line refs, 漂移则更新 spec 后 plan 再生成". This task verifies spec line refs are still valid against current `origin/main` Java source.

- [ ] **Step 1: Verify Java service file lines for 8 referenced anchors**

Run:
```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
JAVA=backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java
grep -n "AGING_90_RED_THRESHOLD\|AGING_90_YELLOW_THRESHOLD\|public.*getReceivableAgingChart\|public.*getReceivableMetrics\|public.*getOverdueCustomerRanking\|public.*getReceivableTrendChart\|private.*calculateAgingBuckets\|private.*getAgingBucketAlertLevel\|private.*determineCollectionRateAlertLevel" "$JAVA"
```

Expected (from spec §3.1):
- `AGING_90_RED_THRESHOLD` ≈ line 104
- `AGING_90_YELLOW_THRESHOLD` ≈ line 105
- `getReceivableAgingChart` ≈ line 586
- `getReceivableMetrics` ≈ line 627
- `getOverdueCustomerRanking` ≈ line 734
- `getReceivableTrendChart` ≈ line 786
- `calculateAgingBuckets` ≈ line 1492
- `getAgingBucketAlertLevel` ≈ line 1590
- `determineCollectionRateAlertLevel` ≈ line 1639

- [ ] **Step 2: Decide drift action**

If all 9 anchors are within ±5 lines of spec → proceed. Note actual lines for each section's reference comments (used in helper docstrings).

If any anchor drifted more than ±5 lines → STOP. Update plan tasks' inline `Java line N-M` references with corrected lines before proceeding. Do NOT modify the spec doc (it ships PR #33 already).

- [ ] **Step 3: Capture metric code constants location**

Run:
```bash
grep -n "AR_BALANCE\|COLLECTION_RATE\|AGING_30_RATIO\|AGING_60_RATIO\|AGING_90_RATIO" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/MetricCalculatorService.java | head -10
```

Expected: 5 metric code consts ≈ lines 61-67.

No commit — verification only. Document drifts (if any) in subsequent task code blocks before editing.

---

## Task 2: Add module constants + `relativedelta` import

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Add `dateutil.relativedelta` import**

Open `backend/python/smartbi_compat/api/analysis_finance.py`. After line 30 (`from decimal import Decimal, ROUND_HALF_UP`), add:

```python
from dateutil.relativedelta import relativedelta
```

Verify `python-dateutil>=2.8.0` is already in `backend/python/requirements.txt`:
```bash
grep -n "python-dateutil" backend/python/requirements.txt
```
Expected: a line like `python-dateutil>=2.8.0`. If missing (unexpected), add `python-dateutil>=2.8.0` to requirements.txt.

- [ ] **Step 2: Add `# === Receivable constants ===` block**

Find the existing constants section near top (after imports, before `Section 1: Shared DTO dict factories`). Insert before `Section 1`:

```python
# ============================================================
# Section 0b: Receivable constants (Phase 2A receivable per-type)
# Mirror Java FinanceAnalysisService interface line 37-43 (4 bucket name constants),
# FinanceAnalysisServiceImpl line 104-105 (AGING_90 thresholds),
# and FinanceAnalysisServiceImpl line 1590-1603 (bucket → alert level map).
# ============================================================

AGING_BUCKET_0_30 = "0-30天"
AGING_BUCKET_31_60 = "31-60天"
AGING_BUCKET_61_90 = "61-90天"
AGING_BUCKET_OVER_90 = "90天以上"

# Java FinanceAnalysisServiceImpl line 600 — Arrays.asList(0_30, 31_60, 61_90, OVER_90)
AGING_BUCKETS_ORDER = [
    AGING_BUCKET_0_30,
    AGING_BUCKET_31_60,
    AGING_BUCKET_61_90,
    AGING_BUCKET_OVER_90,
]

# Java FinanceAnalysisServiceImpl line 1590-1603 — hardcoded bucket → alertLevel map
_AGING_BUCKET_ALERT_LEVELS = {
    AGING_BUCKET_0_30: "GREEN",
    AGING_BUCKET_31_60: "YELLOW",
    AGING_BUCKET_61_90: "YELLOW",
    AGING_BUCKET_OVER_90: "RED",
}

# Java FinanceAnalysisServiceImpl line 104-105
AGING_90_RED_THRESHOLD = 20.0
AGING_90_YELLOW_THRESHOLD = 10.0
```

- [ ] **Step 3: Verify import + constants resolve**

Run:
```bash
cd backend/python && python -c "from smartbi_compat.api.analysis_finance import AGING_BUCKETS_ORDER, _AGING_BUCKET_ALERT_LEVELS, AGING_90_RED_THRESHOLD; print(AGING_BUCKETS_ORDER); print(_AGING_BUCKET_ALERT_LEVELS)"
```
Expected output:
```
['0-30天', '31-60天', '61-90天', '90天以上']
{'0-30天': 'GREEN', '31-60天': 'YELLOW', '61-90天': 'YELLOW', '90天以上': 'RED'}
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add module constants + dateutil import" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected: commit succeeds; `git show --name-only HEAD` shows ONLY `analysis_finance.py`.

---

## Task 3: Utility — `_get_aging_bucket_alert_level`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

- [ ] **Step 1: Write failing tests**

In `test_analysis_finance_factories.py`, append:

```python
class TestAgingBucketAlertLevel:
    """Mirror Java FinanceAnalysisServiceImpl.getAgingBucketAlertLevel (line 1590-1603)."""

    def test_0_30_returns_green(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("0-30天") == "GREEN"

    def test_31_60_returns_yellow(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("31-60天") == "YELLOW"

    def test_61_90_returns_yellow(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("61-90天") == "YELLOW"

    def test_over_90_returns_red(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("90天以上") == "RED"

    def test_unknown_bucket_returns_green_default(self):
        """Java map.getOrDefault(..., GREEN) — unknown key returns GREEN."""
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("invalid-bucket") == "GREEN"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestAgingBucketAlertLevel -v
```
Expected: 5 FAILS with `ImportError: cannot import name '_get_aging_bucket_alert_level'`.

- [ ] **Step 3: Add helper function**

In `analysis_finance.py`, after `_get_period_key` (line ~1044), add:

```python
def _get_aging_bucket_alert_level(bucket: str) -> str:
    """Hardcoded bucket → alertLevel map.
    Mirror Java FinanceAnalysisServiceImpl.getAgingBucketAlertLevel (line 1590-1603).
    Unknown bucket defaults to GREEN (Java map.getOrDefault behavior).
    """
    return _AGING_BUCKET_ALERT_LEVELS.get(bucket, "GREEN")
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestAgingBucketAlertLevel -v
```
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add _get_aging_bucket_alert_level utility" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 4: Utility — `_calculate_aging_buckets`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

- [ ] **Step 1: Write failing tests**

Append to `test_analysis_finance_factories.py`:

```python
from decimal import Decimal


class TestCalculateAgingBuckets:
    """Mirror Java FinanceAnalysisServiceImpl.calculateAgingBuckets (line 1492-1524).

    Outstanding = receivable - collection. Skip rows where outstanding <= 0.
    Null aging_days fallback to 0 → 0-30天 bucket.
    """

    def test_empty_input_returns_4_zero_buckets(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        result = _calculate_aging_buckets([])
        assert result == {
            "0-30天": Decimal("0"),
            "31-60天": Decimal("0"),
            "61-90天": Decimal("0"),
            "90天以上": Decimal("0"),
        }

    def test_single_row_aging_15_goes_to_0_30(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "1000", "collection_amount": "200", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert result["0-30天"] == Decimal("800")
        assert result["31-60天"] == Decimal("0")

    def test_aging_45_goes_to_31_60(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "500", "collection_amount": "0", "aging_days": 45}]
        result = _calculate_aging_buckets(rows)
        assert result["31-60天"] == Decimal("500")

    def test_aging_75_goes_to_61_90(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "300", "collection_amount": "0", "aging_days": 75}]
        result = _calculate_aging_buckets(rows)
        assert result["61-90天"] == Decimal("300")

    def test_aging_120_goes_to_over_90(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "200", "collection_amount": "0", "aging_days": 120}]
        result = _calculate_aging_buckets(rows)
        assert result["90天以上"] == Decimal("200")

    def test_outstanding_zero_skipped(self):
        """Java line 1505 — skip if outstanding <= 0."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "100", "collection_amount": "100", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())

    def test_outstanding_negative_skipped(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "50", "collection_amount": "150", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())

    def test_null_aging_days_treated_as_0_30(self):
        """Java line 1500 — null fallback to 0 → 0-30天 bucket."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "1000", "collection_amount": "0", "aging_days": None}]
        result = _calculate_aging_buckets(rows)
        assert result["0-30天"] == Decimal("1000")

    def test_null_receivable_treated_as_zero(self):
        """Rule 1 — null receivable → Decimal('0'). Combined with non-null collection
        produces negative outstanding → skipped."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": None, "collection_amount": "100", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())

    def test_decimal_zero_receivable_not_skipped_when_collection_negative(self):
        """Rule 1 edge — Decimal('0') is falsy in Python `or` but Java treats != null.
        With receivable=Decimal('0') and collection=null → outstanding=0, SKIPPED (Java line 1505 <=).
        This test pins behavior to mirror Java strictly."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "0", "collection_amount": None, "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestCalculateAgingBuckets -v
```
Expected: 10 FAILS with `ImportError: cannot import name '_calculate_aging_buckets'`.

- [ ] **Step 3: Add helper function**

In `analysis_finance.py`, immediately after `_get_aging_bucket_alert_level` (added in Task 3), add:

```python
def _calculate_aging_buckets(ar_data: list[dict]) -> dict[str, Decimal]:
    """4-bucket outstanding aggregation by aging_days.

    Mirror Java FinanceAnalysisServiceImpl.calculateAgingBuckets (line 1492-1524).

    For each row:
      - outstanding = receivable_amount - collection_amount (null treated as 0 per Rule 1)
      - skip if outstanding <= 0 (Java line 1505)
      - bucket by aging_days (null fallback to 0 per Java line 1500):
        <= 30 → 0-30天, <= 60 → 31-60天, <= 90 → 61-90天, else → 90天以上

    Returns dict with all 4 buckets initialized to Decimal('0').
    """
    buckets: dict[str, Decimal] = {b: Decimal("0") for b in AGING_BUCKETS_ORDER}

    for row in ar_data:
        # Java line 1500 — null aging_days fallback to 0
        aging_days = (
            int(row["aging_days"])
            if row.get("aging_days") is not None
            else 0
        )
        # Java line 1501-1503 — receivable/collection null guards (Rule 1)
        receivable = (
            _to_decimal(row["receivable_amount"])
            if row.get("receivable_amount") is not None
            else Decimal("0")
        )
        collection = (
            _to_decimal(row["collection_amount"])
            if row.get("collection_amount") is not None
            else Decimal("0")
        )
        outstanding = receivable - collection
        # Java line 1505 — skip non-positive outstanding
        if outstanding <= Decimal("0"):
            continue

        # Java line 1510-1518 — bucket assignment
        if aging_days <= 30:
            bucket = AGING_BUCKET_0_30
        elif aging_days <= 60:
            bucket = AGING_BUCKET_31_60
        elif aging_days <= 90:
            bucket = AGING_BUCKET_61_90
        else:
            bucket = AGING_BUCKET_OVER_90
        buckets[bucket] += outstanding

    return buckets
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestCalculateAgingBuckets -v
```
Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add _calculate_aging_buckets utility" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 5: Threshold helpers — `_determine_collection_rate_alert` + 3 aging ratio alerts

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

Java uses `>` strict comparison (NOT `>=`). Boundary value falls into LOWER alertLevel — boundary smoke locked here, full ×24 boundary table is PR-B scope.

- [ ] **Step 1: Write failing tests**

Append to `test_analysis_finance_factories.py`:

```python
class TestReceivableAlertHelpers:
    """4 threshold helpers — boundary smoke only (PR-A). Full 24-case table is PR-B.

    Java uses > strict; boundary value falls into LOWER alertLevel.
    """

    def test_collection_rate_below_60_red(self):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        assert _determine_collection_rate_alert(Decimal("59.99")) == "RED"
        assert _determine_collection_rate_alert(Decimal("0")) == "RED"

    def test_collection_rate_60_to_80_yellow(self):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        # Java line 1639-1644: if v<60 RED; if v<80 YELLOW; else GREEN
        # Boundary 60.0: NOT < 60 → falls to YELLOW
        assert _determine_collection_rate_alert(Decimal("60.00")) == "YELLOW"
        assert _determine_collection_rate_alert(Decimal("79.99")) == "YELLOW"

    def test_collection_rate_above_80_green(self):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        assert _determine_collection_rate_alert(Decimal("80.00")) == "GREEN"
        assert _determine_collection_rate_alert(Decimal("100.00")) == "GREEN"

    def test_aging_30_alert_thresholds(self):
        """Java MetricCalculatorServiceImpl line 491-494: >50 RED, >25 YELLOW, else GREEN."""
        from smartbi_compat.api.analysis_finance import _aging_30_alert
        assert _aging_30_alert(Decimal("0")) == "GREEN"
        assert _aging_30_alert(Decimal("25")) == "GREEN"      # NOT > 25
        assert _aging_30_alert(Decimal("25.01")) == "YELLOW"  # > 25
        assert _aging_30_alert(Decimal("50")) == "YELLOW"     # NOT > 50
        assert _aging_30_alert(Decimal("50.01")) == "RED"     # > 50

    def test_aging_60_alert_thresholds(self):
        """Java MetricCalculatorServiceImpl line 485-488: >30 RED, >15 YELLOW, else GREEN."""
        from smartbi_compat.api.analysis_finance import _aging_60_alert
        assert _aging_60_alert(Decimal("0")) == "GREEN"
        assert _aging_60_alert(Decimal("15")) == "GREEN"
        assert _aging_60_alert(Decimal("15.01")) == "YELLOW"
        assert _aging_60_alert(Decimal("30")) == "YELLOW"
        assert _aging_60_alert(Decimal("30.01")) == "RED"

    def test_aging_90_alert_thresholds(self):
        """Java FinanceAnalysisServiceImpl line 715-719: >20.0 RED, >10.0 YELLOW, else GREEN."""
        from smartbi_compat.api.analysis_finance import _aging_90_alert
        assert _aging_90_alert(Decimal("0")) == "GREEN"
        assert _aging_90_alert(Decimal("10")) == "GREEN"
        assert _aging_90_alert(Decimal("10.01")) == "YELLOW"
        assert _aging_90_alert(Decimal("20")) == "YELLOW"
        assert _aging_90_alert(Decimal("20.01")) == "RED"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableAlertHelpers -v
```
Expected: 6 FAILS with `ImportError: cannot import name '_determine_collection_rate_alert'` etc.

- [ ] **Step 3: Add 4 threshold helpers**

In `analysis_finance.py`, immediately after `_calculate_aging_buckets` (Task 4), add:

```python
def _determine_collection_rate_alert(rate: Decimal) -> str:
    """Mirror Java FinanceAnalysisServiceImpl.determineCollectionRateAlertLevel (line 1639-1644).
    Thresholds use < (not <=); boundary 60/80 falls into LOWER level.
    Rule 7: integer thresholds → float() cast OK (matches Java doubleValue()).
    """
    v = float(rate)
    if v < 60:
        return "RED"
    if v < 80:
        return "YELLOW"
    return "GREEN"


def _aging_30_alert(ratio: Decimal) -> str:
    """Mirror Java MetricCalculatorServiceImpl line 491-494: >50 RED, >25 YELLOW, else GREEN.
    Boundary 25/50 falls into LOWER level (Java > strict)."""
    v = float(ratio)
    if v > 50:
        return "RED"
    if v > 25:
        return "YELLOW"
    return "GREEN"


def _aging_60_alert(ratio: Decimal) -> str:
    """Mirror Java MetricCalculatorServiceImpl line 485-488: >30 RED, >15 YELLOW, else GREEN.
    Boundary 15/30 falls into LOWER level."""
    v = float(ratio)
    if v > 30:
        return "RED"
    if v > 15:
        return "YELLOW"
    return "GREEN"


def _aging_90_alert(ratio: Decimal) -> str:
    """Mirror Java FinanceAnalysisServiceImpl line 715-719:
    >AGING_90_RED_THRESHOLD (20.0) RED, >AGING_90_YELLOW_THRESHOLD (10.0) YELLOW, else GREEN.
    Boundary 10/20 falls into LOWER level."""
    v = float(ratio)
    if v > AGING_90_RED_THRESHOLD:
        return "RED"
    if v > AGING_90_YELLOW_THRESHOLD:
        return "YELLOW"
    return "GREEN"
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableAlertHelpers -v
```
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add 4 threshold alert helpers" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 6: Replace stub `_get_receivable_aging_chart` with real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py:1853-1877` (existing stub)
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

The existing stub returns 4 hardcoded zero buckets — already shape-matches F999 golden's `agingChart` block. Replacement keeps shape; only difference is real impl reads `_query_finance_data` and computes percentages.

- [ ] **Step 1: Write failing test (real-impl behavior, not stub behavior)**

Append to `test_analysis_finance_factories.py`:

```python
import pytest
from datetime import date


class TestReceivableAgingChartRealImpl:
    """Replace stub at line 1853 with real impl mirroring Java line 586-624.
    Empty data path must still emit 4 buckets in fixed order (Java line 600)."""

    @pytest.mark.asyncio
    async def test_empty_data_emits_4_buckets(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        result = await analysis_finance._get_receivable_aging_chart("F999", date(2025, 12, 31))

        assert result["chartType"] == "BAR"
        assert result["title"] == "应收账款账龄分布"
        assert result["seriesField"] is None
        assert result["xaxisField"] == "agingBucket"
        assert result["yaxisField"] == "amount"
        assert result["options"] == {
            "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
            "showAlert": True,
        }
        # 4 buckets in fixed order, all amount=0/percentage=0
        data = result["data"]
        assert len(data) == 4
        assert [d["agingBucket"] for d in data] == ["0-30天", "31-60天", "61-90天", "90天以上"]
        assert all(d["amount"] == 0 and d["percentage"] == 0 for d in data)
        # alertLevel hardcoded map (regardless of amount)
        assert [d["alertLevel"] for d in data] == ["GREEN", "YELLOW", "YELLOW", "RED"]

    @pytest.mark.asyncio
    async def test_real_data_computes_amounts_and_percentages(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            assert record_type == "AR"
            # 1y window check — start ≈ end - 1y
            assert (end - start).days >= 364
            return [
                {"receivable_amount": "1000", "collection_amount": "200", "aging_days": 15},
                {"receivable_amount": "500", "collection_amount": "0", "aging_days": 75},
                {"receivable_amount": "300", "collection_amount": "0", "aging_days": 120},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        result = await analysis_finance._get_receivable_aging_chart("F001", date(2025, 12, 31))

        # Total = 800 + 500 + 300 = 1600
        data = result["data"]
        assert data[0]["agingBucket"] == "0-30天"
        assert data[0]["amount"] == 800   # 1000 - 200
        assert data[0]["percentage"] == 50.0  # 800/1600 * 100
        assert data[2]["agingBucket"] == "61-90天"
        assert data[2]["amount"] == 500
        assert data[3]["agingBucket"] == "90天以上"
        assert data[3]["amount"] == 300

    @pytest.mark.asyncio
    async def test_uses_relativedelta_not_timedelta_365(self, monkeypatch):
        """Leap-year boundary: end_date = 2024-02-29 should yield start_date = 2023-02-28
        (relativedelta clamps), NOT 2023-03-01 (timedelta(days=365) wraps wrong)."""
        from smartbi_compat.api import analysis_finance

        captured = {}
        async def fake_query(factory_id, record_type, start, end):
            captured["start"] = start
            captured["end"] = end
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        await analysis_finance._get_receivable_aging_chart("F999", date(2024, 2, 29))

        assert captured["start"] == date(2023, 2, 28)  # relativedelta clamps to Feb 28
        assert captured["end"] == date(2024, 2, 29)
```

Note: pytest-asyncio is already configured in this repo (sister contract tests use it). Verify with `grep "asyncio_mode" backend/python/pyproject.toml` if uncertain — if not configured, decorate with `@pytest.mark.asyncio` and ensure `asyncio_mode = "auto"` or import `pytest_asyncio`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableAgingChartRealImpl -v
```
Expected: 3 FAILS — empty data passes shape but real-data tests fail (current stub doesn't compute).

- [ ] **Step 3: Replace stub at lines 1853-1877**

Find:
```python
async def _get_receivable_aging_chart(factory_id: str, end_date: date) -> dict:
    """F999 empty-state — Java getReceivableAgingChart ALWAYS emits 4 aging buckets
    even when AR=0 (per A.2). chartType=BAR (NOT PIE). A.5 golden verified shape.

    4 buckets (in order): 0-30天 (GREEN), 31-60天 (YELLOW), 61-90天 (YELLOW), 90天以上 (RED).
    Each bucket: {agingBucket, amount=0, percentage=0, alertLevel}.
    options={colors: ["#91cc75", "#fac858", "#ee6666", "#c23531"], showAlert: true}.
    """
    return _new_chart_config_dict(
        chart_type="BAR",
        title="应收账款账龄分布",
        series_field=None,
        data=[
            {"agingBucket": "0-30天",  "amount": 0, "percentage": 0, "alertLevel": "GREEN"},
            {"agingBucket": "31-60天", "amount": 0, "percentage": 0, "alertLevel": "YELLOW"},
            {"agingBucket": "61-90天", "amount": 0, "percentage": 0, "alertLevel": "YELLOW"},
            {"agingBucket": "90天以上","amount": 0, "percentage": 0, "alertLevel": "RED"},
        ],
        options={
            "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
            "showAlert": True,
        },
        xaxis_field="agingBucket",
        yaxis_field="amount",
    )
```

Replace with:
```python
async def _get_receivable_aging_chart(factory_id: str, end_date: date) -> dict:
    """4-bucket BAR chart of outstanding AR by aging.

    Mirror Java FinanceAnalysisServiceImpl.getReceivableAgingChart (line 586-624).
    Data window: [end_date - 1 year, end_date] using dateutil.relativedelta (leap-year safe).

    Composite path (_get_comprehensive_finance_analysis) calls this — replacement keeps
    {agingBucket, amount, percentage, alertLevel} shape so composite F999 golden stays valid.
    """
    # Java line 591 — date.minusYears(1). Use relativedelta (calendar-aware leap-year clamp).
    start_window = end_date - relativedelta(years=1)
    ar_data = await _query_finance_data(factory_id, "AR", start_window, end_date)

    aging_buckets = _calculate_aging_buckets(ar_data)
    total_ar = sum(aging_buckets.values(), Decimal("0"))

    chart_data: list[dict] = []
    for bucket in AGING_BUCKETS_ORDER:  # Java line 600 fixed order
        amount = aging_buckets.get(bucket, Decimal("0"))
        # Java line 605 — zero-guard
        percentage = (
            amount / total_ar * Decimal("100")
            if total_ar > Decimal("0")
            else Decimal("0")
        )
        chart_data.append({
            "agingBucket": bucket,
            "amount": _decimal_to_number(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "percentage": _decimal_to_number(percentage.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "alertLevel": _get_aging_bucket_alert_level(bucket),
        })

    return _new_chart_config_dict(
        chart_type="BAR",
        title="应收账款账龄分布",
        series_field=None,
        data=chart_data,
        options={
            "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
            "showAlert": True,
        },
        xaxis_field="agingBucket",
        yaxis_field="amount",
    )
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableAgingChartRealImpl -v
```
Expected: 3 PASS.

Also re-run `TestAnalysisFinanceComposite` (existing) to verify composite path still works:
```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite -v
```
Expected: 2 PASS (unchanged — replacement returns same shape for empty data).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: replace _get_receivable_aging_chart stub with real impl" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 7: Add `_get_receivable_metrics`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

5 metrics: AR_BALANCE / COLLECTION_RATE / AGING_30_RATIO / AGING_60_RATIO / AGING_90_RATIO. Mirror Java line 627-732. 1-year window.

- [ ] **Step 1: Write failing tests**

Append to `test_analysis_finance_factories.py`:

```python
class TestReceivableMetricsImpl:
    """Mirror Java FinanceAnalysisServiceImpl.getReceivableMetrics (line 627-732).
    Empty-data path produces 5 metrics with value=0; F999 golden lock."""

    @pytest.mark.asyncio
    async def test_empty_data_emits_5_metrics_f999_shape(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))

        assert len(metrics) == 5
        codes = [m["metricCode"] for m in metrics]
        assert codes == ["AR_BALANCE", "COLLECTION_RATE", "AGING_30_RATIO", "AGING_60_RATIO", "AGING_90_RATIO"]
        names = [m["metricName"] for m in metrics]
        assert names == ["应收余额", "回款率", "30天以上账龄占比", "60天以上账龄占比", "90天以上账龄占比"]
        # All values 0
        assert all(m["value"] == 0 for m in metrics)
        # AR_BALANCE alertLevel hardcoded GREEN
        assert metrics[0]["alertLevel"] == "GREEN"
        # COLLECTION_RATE: 0 < 60 → RED
        assert metrics[1]["alertLevel"] == "RED"
        # 30/60/90 ratio: 0 not > threshold → GREEN
        assert metrics[2]["alertLevel"] == "GREEN"
        assert metrics[3]["alertLevel"] == "GREEN"
        assert metrics[4]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_normal_data_arithmetic_shape(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            # 1000 receivable, 600 collected, 1 row aged 15
            return [{"receivable_amount": "1000", "collection_amount": "600", "aging_days": 15}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))

        # AR_BALANCE = 1000 - 600 = 400
        assert metrics[0]["value"] == 400
        assert metrics[0]["formattedValue"] == "400.00"
        assert metrics[0]["unit"] == "元"
        # COLLECTION_RATE = 600/1000*100 = 60.00 → boundary 60 NOT < 60 → YELLOW
        assert metrics[1]["value"] == 60
        assert metrics[1]["formattedValue"] == "60.00%"
        assert metrics[1]["unit"] == "%"
        assert metrics[1]["alertLevel"] == "YELLOW"
        # All outstanding (400) is in 0-30天 bucket → over30/60/90 ratios all = 0
        assert metrics[2]["value"] == 0  # AGING_30_RATIO
        assert metrics[3]["value"] == 0
        assert metrics[4]["value"] == 0

    @pytest.mark.asyncio
    async def test_zero_receivable_collection_rate_zero(self, monkeypatch):
        """Zero-guard line 659: total_receivable=0 → collection_rate=0 (not div-by-zero)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))
        assert metrics[1]["metricCode"] == "COLLECTION_RATE"
        assert metrics[1]["value"] == 0
        assert metrics[1]["alertLevel"] == "RED"  # 0 < 60

    @pytest.mark.asyncio
    async def test_metric_envelope_has_11_fields(self, monkeypatch):
        """F999 golden lock — _new_metric_result_dict emits all 11 Java MetricResult fields."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))
        expected_keys = {
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue",
            "alertLevel", "dimensionValue", "description",
        }
        for m in metrics:
            assert set(m.keys()) == expected_keys

    @pytest.mark.asyncio
    async def test_descriptions_match_f999_golden(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))
        descs = [m["description"] for m in metrics]
        assert descs == [
            "尚未收回的应收账款总额",
            "已回款金额占应收总额的比例",
            "账龄超过30天的应收款占比",
            "账龄超过60天的应收款占比",
            "账龄超过90天的高风险应收款占比",
        ]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableMetricsImpl -v
```
Expected: 5 FAILS with `ImportError: cannot import name '_get_receivable_metrics'`.

- [ ] **Step 3: Add `_get_receivable_metrics`**

In `analysis_finance.py`, immediately after the replaced `_get_receivable_aging_chart` (Task 6), add:

```python
async def _get_receivable_metrics(
    factory_id: str, end_date: date
) -> list[dict]:
    """5 metrics: AR_BALANCE / COLLECTION_RATE / AGING_30_RATIO / AGING_60_RATIO / AGING_90_RATIO.

    Mirror Java FinanceAnalysisServiceImpl.getReceivableMetrics (line 627-732).
    Data window: [end_date - 1 year, end_date] (Java line 631 minusYears(1)).
    """
    start_window = end_date - relativedelta(years=1)
    ar_data = await _query_finance_data(factory_id, "AR", start_window, end_date)

    # Java line 636-639 — totalReceivable, null-filtered (Rule 1)
    total_receivable = sum(
        (_to_decimal(r["receivable_amount"])
         for r in ar_data
         if r.get("receivable_amount") is not None),
        Decimal("0"),
    )
    # Java line 641-644 — totalCollection
    total_collection = sum(
        (_to_decimal(r["collection_amount"])
         for r in ar_data
         if r.get("collection_amount") is not None),
        Decimal("0"),
    )

    metrics: list[dict] = []

    # ===== Metric 1: AR_BALANCE (Java line 647-656) =====
    ar_balance = total_receivable - total_collection
    metrics.append(_new_metric_result_dict(
        metric_code="AR_BALANCE",
        metric_name="应收余额",
        value=_decimal_to_number(ar_balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        formatted_value=_format_currency(ar_balance),
        unit="元",
        alert_level="GREEN",  # Java line 654 — hardcoded GREEN
        description="尚未收回的应收账款总额",
    ))

    # ===== Metric 2: COLLECTION_RATE (Java line 658-670) =====
    # Java line 659 — zero-guard (totalReceivable > 0)
    collection_rate = (
        total_collection / total_receivable * Decimal("100")
        if total_receivable > Decimal("0")
        else Decimal("0")
    )
    metrics.append(_new_metric_result_dict(
        metric_code="COLLECTION_RATE",
        metric_name="回款率",
        value=_decimal_to_number(collection_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        formatted_value=str(collection_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) + "%",
        unit="%",
        alert_level=_determine_collection_rate_alert(collection_rate),
        description="已回款金额占应收总额的比例",
    ))

    # ===== Aging buckets (Java line 673-679) =====
    aging_buckets = _calculate_aging_buckets(ar_data)
    over30 = (
        aging_buckets[AGING_BUCKET_31_60]
        + aging_buckets[AGING_BUCKET_61_90]
        + aging_buckets[AGING_BUCKET_OVER_90]
    )
    over60 = aging_buckets[AGING_BUCKET_61_90] + aging_buckets[AGING_BUCKET_OVER_90]
    over90 = aging_buckets[AGING_BUCKET_OVER_90]
    total_for_ratio = sum(aging_buckets.values(), Decimal("0"))

    # ===== Metric 3-5: AGING_30/60/90_RATIO (Java line 683-728) =====
    for ratio_value, code, name, desc, threshold_func in [
        (over30, "AGING_30_RATIO", "30天以上账龄占比", "账龄超过30天的应收款占比", _aging_30_alert),
        (over60, "AGING_60_RATIO", "60天以上账龄占比", "账龄超过60天的应收款占比", _aging_60_alert),
        (over90, "AGING_90_RATIO", "90天以上账龄占比", "账龄超过90天的高风险应收款占比", _aging_90_alert),
    ]:
        ratio = (
            ratio_value / total_for_ratio * Decimal("100")
            if total_for_ratio > Decimal("0")
            else Decimal("0")
        )
        metrics.append(_new_metric_result_dict(
            metric_code=code,
            metric_name=name,
            value=_decimal_to_number(ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            formatted_value=str(ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) + "%",
            unit="%",
            alert_level=threshold_func(ratio),
            description=desc,
        ))

    return metrics
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableMetricsImpl -v
```
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add _get_receivable_metrics (5 metrics)" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 8: Add `_get_overdue_customer_ranking`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

Top-10 customers by overdue amount. Java line 734-783. 1-year window. Customer dedup via dict (Python 3.7+ insertion-order parity with Java LinkedHashMap).

- [ ] **Step 1: Write failing tests**

Append to `test_analysis_finance_factories.py`:

```python
class TestOverdueCustomerRankingImpl:
    """Mirror Java FinanceAnalysisServiceImpl.getOverdueCustomerRanking (line 734-783).
    Top-10 by overdue (outstanding > 0). Customer dedup. RankingItem 4-key shape."""

    @pytest.mark.asyncio
    async def test_empty_data_returns_empty_list(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        result = await analysis_finance._get_overdue_customer_ranking("F999", date(2025, 12, 31))
        assert result == []

    @pytest.mark.asyncio
    async def test_skips_null_customer_name(self, monkeypatch):
        """Java line 743 — guard 1/3."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": None, "receivable_amount": "1000", "collection_amount": "0", "aging_days": 60}
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert result == []

    @pytest.mark.asyncio
    async def test_skips_null_aging_days(self, monkeypatch):
        """Java line 743 — guard 2/3."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "Acme", "receivable_amount": "1000", "collection_amount": "0", "aging_days": None}
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert result == []

    @pytest.mark.asyncio
    async def test_skips_zero_aging_days(self, monkeypatch):
        """Java line 743 — guard 3/3 (aging_days <= 0 means not yet overdue)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "Acme", "receivable_amount": "1000", "collection_amount": "0", "aging_days": 0}
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert result == []

    @pytest.mark.asyncio
    async def test_sorts_desc_by_overdue_amount(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "Small", "receivable_amount": "100", "collection_amount": "0", "aging_days": 70},
                {"customer_name": "Big",   "receivable_amount": "5000", "collection_amount": "0", "aging_days": 50},
                {"customer_name": "Medium","receivable_amount": "1000", "collection_amount": "0", "aging_days": 100},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert [r["name"] for r in result] == ["Big", "Medium", "Small"]
        assert [r["rank"] for r in result] == [1, 2, 3]
        assert [r["value"] for r in result] == [5000, 1000, 100]

    @pytest.mark.asyncio
    async def test_alert_level_by_max_aging(self, monkeypatch):
        """Java line 767-772: max_aging > 90 RED, > 60 YELLOW, else GREEN."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "RedCust",   "receivable_amount": "100", "collection_amount": "0", "aging_days": 91},
                {"customer_name": "YellowCust","receivable_amount": "100", "collection_amount": "0", "aging_days": 61},
                {"customer_name": "GreenCust", "receivable_amount": "100", "collection_amount": "0", "aging_days": 30},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        by_name = {r["name"]: r["alertLevel"] for r in result}
        assert by_name["RedCust"] == "RED"
        assert by_name["YellowCust"] == "YELLOW"
        assert by_name["GreenCust"] == "GREEN"

    @pytest.mark.asyncio
    async def test_top_10_cap(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": f"C{i:02d}",
                 "receivable_amount": str(100 - i),  # decreasing so first 10 are top
                 "collection_amount": "0",
                 "aging_days": 60}
                for i in range(15)
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert len(result) == 10

    @pytest.mark.asyncio
    async def test_customer_dedup_uses_max_aging(self, monkeypatch):
        """Java line 754 — same customer rows aggregate; max aging tracked across rows."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "Acme", "receivable_amount": "1000", "collection_amount": "0", "aging_days": 30},
                {"customer_name": "Acme", "receivable_amount": "500",  "collection_amount": "0", "aging_days": 100},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert len(result) == 1
        assert result[0]["name"] == "Acme"
        assert result[0]["value"] == 1500   # aggregated
        assert result[0]["alertLevel"] == "RED"  # max aging 100 > 90

    @pytest.mark.asyncio
    async def test_skips_outstanding_zero_or_negative(self, monkeypatch):
        """Java line 751 — outstanding > 0 only."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "A", "receivable_amount": "100", "collection_amount": "100", "aging_days": 60},
                {"customer_name": "B", "receivable_amount": "50",  "collection_amount": "200", "aging_days": 60},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert result == []

    @pytest.mark.asyncio
    async def test_ranking_item_has_4_keys(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"customer_name": "Acme", "receivable_amount": "1000", "collection_amount": "0", "aging_days": 60},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_overdue_customer_ranking("F001", date(2025, 12, 31))
        assert set(result[0].keys()) == {"rank", "name", "value", "alertLevel"}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestOverdueCustomerRankingImpl -v
```
Expected: 10 FAILS with `ImportError: cannot import name '_get_overdue_customer_ranking'`.

- [ ] **Step 3: Add `_get_overdue_customer_ranking`**

In `analysis_finance.py`, immediately after `_get_receivable_metrics` (Task 7), add:

```python
async def _get_overdue_customer_ranking(
    factory_id: str, end_date: date
) -> list[dict]:
    """Top-10 customers by overdue outstanding amount.

    Mirror Java FinanceAnalysisServiceImpl.getOverdueCustomerRanking (line 734-783).
    1-year window. Per-customer aggregation (sum outstanding, max aging_days).
    AlertLevel by max aging: >90 RED, >60 YELLOW, else GREEN.
    """
    start_window = end_date - relativedelta(years=1)
    ar_data = await _query_finance_data(factory_id, "AR", start_window, end_date)

    # Java line 741-756 — per-customer aggregation. Python dict 3.7+ insertion-order
    # parity with Java LinkedHashMap.
    customer_overdue: dict[str, list] = {}  # name → [Decimal total, int max_aging]
    for row in ar_data:
        customer_name = row.get("customer_name")
        aging_days = row.get("aging_days")
        # Java line 743 — 3-condition guard (Rule 1 — explicit None checks)
        if customer_name is None or aging_days is None or aging_days <= 0:
            continue
        receivable = (
            _to_decimal(row["receivable_amount"])
            if row.get("receivable_amount") is not None
            else Decimal("0")
        )
        collection = (
            _to_decimal(row["collection_amount"])
            if row.get("collection_amount") is not None
            else Decimal("0")
        )
        outstanding = receivable - collection
        # Java line 751 — outstanding > 0 only
        if outstanding <= Decimal("0"):
            continue
        if customer_name not in customer_overdue:
            customer_overdue[customer_name] = [Decimal("0"), 0]
        customer_overdue[customer_name][0] += outstanding
        # Java line 754 — track max aging
        customer_overdue[customer_name][1] = max(
            customer_overdue[customer_name][1], int(aging_days)
        )

    # Java line 760-763 — sort desc by overdue, top-10
    sorted_customers = sorted(
        customer_overdue.items(),
        key=lambda kv: kv[1][0],
        reverse=True,
    )[:10]

    rankings: list[dict] = []
    for rank, (customer, (total, max_aging)) in enumerate(sorted_customers, start=1):
        # Java line 767-772 — alertLevel by max aging
        if max_aging > 90:
            alert = "RED"
        elif max_aging > 60:
            alert = "YELLOW"
        else:
            alert = "GREEN"
        rankings.append(_new_ranking_item_dict(
            rank=rank,
            name=customer,
            value=_decimal_to_number(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            alert_level=alert,
        ))

    return rankings
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestOverdueCustomerRankingImpl -v
```
Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add _get_overdue_customer_ranking (top-10)" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 9: Add `_get_receivable_trend_chart`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

Monthly LINE_BAR chart, [start_date, end_date] window (NOT 1-year). Java line 786-827.

⚠️ **Rule 8 watch**: `options.series` contains `Map.of(2)` per item — `name`/`type`. Java `Map.of(2)` Jackson hash order may differ from source order. Empty data path: `data=[]` but `options.series` always emits 3 series. **F999 golden shows `name` then `type` order** — Python dict literal must match. The plan locks this order.

- [ ] **Step 1: Write failing tests**

Append to `test_analysis_finance_factories.py`:

```python
class TestReceivableTrendChartImpl:
    """Mirror Java FinanceAnalysisServiceImpl.getReceivableTrendChart (line 786-827).
    Monthly LINE_BAR; uses [start_date, end_date] (NOT 1y window)."""

    @pytest.mark.asyncio
    async def test_empty_data_emits_chart_with_3_series(self, monkeypatch):
        """F999 golden lock: data=[] but options.series unchanged."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        result = await analysis_finance._get_receivable_trend_chart(
            "F999", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result["chartType"] == "LINE_BAR"
        assert result["title"] == "应收账款趋势"
        assert result["seriesField"] is None
        assert result["xaxisField"] == "period"
        assert result["yaxisField"] == "balance"
        assert result["data"] == []
        # Series exact key order locked from F999 golden (Map.of(2) Jackson hash order)
        series = result["options"]["series"]
        assert len(series) == 3
        assert list(series[0].keys()) == ["name", "type"]
        assert series == [
            {"name": "应收金额", "type": "bar"},
            {"name": "回款金额", "type": "bar"},
            {"name": "应收余额", "type": "line"},
        ]

    @pytest.mark.asyncio
    async def test_uses_query_window_not_1y(self, monkeypatch):
        """trendChart uses [start_date, end_date], NOT minusYears(1)."""
        from smartbi_compat.api import analysis_finance

        captured = {}
        async def fake_query(factory_id, record_type, start, end):
            captured["start"] = start
            captured["end"] = end
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        await analysis_finance._get_receivable_trend_chart(
            "F999", date(2025, 6, 1), date(2025, 8, 31)
        )
        assert captured["start"] == date(2025, 6, 1)
        assert captured["end"] == date(2025, 8, 31)

    @pytest.mark.asyncio
    async def test_groups_by_month_yyyy_mm(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 1, 15), "receivable_amount": "1000", "collection_amount": "200"},
                {"record_date": date(2025, 1, 20), "receivable_amount": "500",  "collection_amount": "100"},
                {"record_date": date(2025, 2, 10), "receivable_amount": "300",  "collection_amount": "0"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        data = result["data"]
        assert len(data) == 2
        assert data[0]["period"] == "2025-01"
        assert data[0]["receivable"] == 1500  # 1000 + 500
        assert data[0]["collection"] == 300   # 200 + 100
        assert data[0]["balance"] == 1200     # 1500 - 300
        assert data[1]["period"] == "2025-02"
        assert data[1]["receivable"] == 300
        assert data[1]["collection"] == 0
        assert data[1]["balance"] == 300

    @pytest.mark.asyncio
    async def test_sorts_by_period_chronologically(self, monkeypatch):
        """Java line 793 TreeMap = sorted by yyyy-MM string key (chronological)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 12, 1), "receivable_amount": "100", "collection_amount": "0"},
                {"record_date": date(2025, 1, 1),  "receivable_amount": "200", "collection_amount": "0"},
                {"record_date": date(2025, 6, 1),  "receivable_amount": "300", "collection_amount": "0"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        periods = [d["period"] for d in result["data"]]
        assert periods == ["2025-01", "2025-06", "2025-12"]

    @pytest.mark.asyncio
    async def test_data_item_has_4_keys_correct_order(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": date(2025, 1, 15), "receivable_amount": "1000", "collection_amount": "200"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert list(result["data"][0].keys()) == ["period", "receivable", "collection", "balance"]

    @pytest.mark.asyncio
    async def test_skips_rows_with_null_record_date(self, monkeypatch):
        """Defensive — record_date should always be present, but guard anyway."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return [
                {"record_date": None, "receivable_amount": "1000", "collection_amount": "0"},
                {"record_date": date(2025, 6, 1), "receivable_amount": "500", "collection_amount": "0"},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)
        result = await analysis_finance._get_receivable_trend_chart(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["period"] == "2025-06"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableTrendChartImpl -v
```
Expected: 6 FAILS with `ImportError: cannot import name '_get_receivable_trend_chart'`.

- [ ] **Step 3: Add `_get_receivable_trend_chart`**

In `analysis_finance.py`, immediately after `_get_overdue_customer_ranking` (Task 8), add:

```python
async def _get_receivable_trend_chart(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Monthly LINE_BAR chart of receivable / collection / balance.

    Mirror Java FinanceAnalysisServiceImpl.getReceivableTrendChart (line 786-827).
    Uses [start_date, end_date] window (NOT 1-year).

    options.series key order locked from F999 golden (Java Map.of(2) hash order
    emits {name, type} per Rule 8). data items: {period, receivable, collection, balance}.
    """
    ar_data = await _query_finance_data(factory_id, "AR", start_date, end_date)

    # Java line 793 — TreeMap = sorted by key (yyyy-MM string sort = chronological)
    monthly_data: dict[str, list] = {}  # period → [Decimal receivable, Decimal collection]
    for row in ar_data:
        # Defensive null-check (Rule 1) — record_date should always be present
        record_date = row.get("record_date")
        if record_date is None:
            continue
        month_key = record_date.strftime("%Y-%m")  # Java line 795 yyyy-MM
        if month_key not in monthly_data:
            monthly_data[month_key] = [Decimal("0"), Decimal("0")]
        receivable = (
            _to_decimal(row["receivable_amount"])
            if row.get("receivable_amount") is not None
            else Decimal("0")
        )
        collection = (
            _to_decimal(row["collection_amount"])
            if row.get("collection_amount") is not None
            else Decimal("0")
        )
        monthly_data[month_key][0] += receivable
        monthly_data[month_key][1] += collection

    # Java line 793 — TreeMap natural ordering
    chart_data: list[dict] = []
    for month_key in sorted(monthly_data.keys()):
        receivable, collection = monthly_data[month_key]
        chart_data.append({
            "period": month_key,
            "receivable": _decimal_to_number(receivable.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "collection": _decimal_to_number(collection.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "balance": _decimal_to_number((receivable - collection).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        })

    # Java line 812-817 — options.series. Each item is Map.of("name", ..., "type", ...).
    # Rule 8 — F999 golden shows {name, type} order; Python literal mirrors it.
    options = {
        "series": [
            {"name": "应收金额", "type": "bar"},
            {"name": "回款金额", "type": "bar"},
            {"name": "应收余额", "type": "line"},
        ],
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",  # Java line 820
        title="应收账款趋势",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="balance",
    )
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestReceivableTrendChartImpl -v
```
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add _get_receivable_trend_chart (LINE_BAR monthly)" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 10: Add main helper `_get_receivable_analysis` + dispatcher branch

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add main helper after `_get_payable_analysis`; modify `get_finance_analysis` route at lines 2101-2139)

- [ ] **Step 1: Write failing test (integration through dispatcher)**

Append to `test_analysis_finance_contract.py` (NOT factories — this is an integration test):

```python
class TestAnalysisFinanceReceivableSmoke:
    """Integration smoke for receivable per-type dispatcher branch.
    Full byte-shape gate is in TestAnalysisFinanceReceivable below (Task 11)."""

    def test_receivable_branch_returns_200_with_6_key_envelope(self, client, monkeypatch):
        """analysisType=receivable hits new branch; returns 6-key envelope."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=receivable",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        data = resp.json()["data"]
        # 6-key envelope (key order may vary; dict-eq compare in Task 11)
        assert set(data.keys()) == {"startDate", "endDate", "metrics", "agingChart", "overdueRanking", "trendChart"}
        assert data["startDate"] == "2025-01-01"
        assert data["endDate"] == "2025-12-31"
        assert isinstance(data["metrics"], list) and len(data["metrics"]) == 5
        assert data["overdueRanking"] == []
        assert data["agingChart"]["chartType"] == "BAR"
        assert data["trendChart"]["chartType"] == "LINE_BAR"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceReceivableSmoke -v
```
Expected: FAIL — current dispatcher returns 501 envelope for `analysisType=receivable`.

- [ ] **Step 3: Add `_get_receivable_analysis` main helper**

In `analysis_finance.py`, immediately after `_get_payable_analysis` (line ~2076-2093), add:

```python
async def _get_receivable_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Receivable per-type analysis (analysisType=receivable).

    Mirror Java SmartBIAnalysisController.getFinanceAnalysis receivable branch
    (line ~244-254) which calls FinanceAnalysisService methods. 6-key envelope.

    Sub-services use 1-year window for metrics/agingChart/overdueRanking;
    trendChart uses [start_date, end_date].

    Java HashMap put-order is startDate/endDate/metrics/agingChart/overdueRanking/trendChart,
    but Jackson serialization re-orders by HashMap hash. F999 golden actual order:
    [endDate, overdueRanking, metrics, agingChart, trendChart, startDate].
    Compare uses dict-eq (key order ignored) per Phase 2A foundation gate.
    """
    metrics = await _get_receivable_metrics(factory_id, end_date)
    aging_chart = await _get_receivable_aging_chart(factory_id, end_date)
    overdue_ranking = await _get_overdue_customer_ranking(factory_id, end_date)
    trend_chart = await _get_receivable_trend_chart(factory_id, start_date, end_date)

    return {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "metrics": metrics,
        "agingChart": aging_chart,
        "overdueRanking": overdue_ranking,
        "trendChart": trend_chart,
    }
```

- [ ] **Step 4: Add dispatcher branch in `get_finance_analysis`**

Find the route handler at lines 2101-2139. After the `if analysisType == "cost":` block (line 2130-2132), insert a new branch BEFORE the 501 fallback:

Find:
```python
    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    return wrap_response(
```

Replace with:
```python
    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    if analysisType == "receivable":
        result = await _get_receivable_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    return wrap_response(
```

Also update the route handler docstring (lines 2109-2115) to add receivable to the branches list:

Find:
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
      analysisType=profit      → profit per-type (PR #21+#22)
      analysisType=cost        → cost per-type (PR #25+#28)
      analysisType=receivable  → receivable per-type (6-key shape, this PR)
      analysisType=other       → 501 envelope (un-ported, see spec §6 / §12)
    """
```

- [ ] **Step 5: Run test to verify pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceReceivableSmoke -v
```
Expected: PASS.

Also re-run all sister branches to check for regression:
```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py -v
```
Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add main helper + dispatcher branch" backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Task 11: F999 byte-shape contract test

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

Full byte-shape compare (dict-eq) of `data` block against `analysis-finance-F999-receivable.json` golden.

- [ ] **Step 1: Add F999 byte-shape gate**

Append to `test_analysis_finance_contract.py`:

```python
class TestAnalysisFinanceReceivable:
    """F999 byte-shape gate for receivable per-type path (analysisType=receivable).

    Compare mode: dict-eq (Phase 2A foundation default; key order ignored).
    Golden source: tests/fixtures/java-smartbi-golden/analysis-finance-F999-receivable.json
    Recorded Apr 30 2026 against test env Java backend (port 10011).
    """

    def test_f999_receivable_data_keys_match_golden(self, client, monkeypatch):
        """Verify all 6 envelope keys present (key order may differ — dict-eq below)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=receivable",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = set(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-receivable.json", encoding="utf-8") as f:
            golden_data_keys = set(json.load(f)["data"].keys())
        assert py_data_keys == golden_data_keys, (
            f"data key set mismatch:\n"
            f"  python: {sorted(py_data_keys)}\n"
            f"  golden: {sorted(golden_data_keys)}"
        )

    def test_f999_receivable_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block (envelope skipped per A.5 finding).
        Mocks _query_finance_data to return [] (F999 has no AR data)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=receivable",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])
        with io.open(GOLDEN_DIR / "analysis-finance-F999-receivable.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            # Pretty-print divergence to make Phase 2A debug fast
            import difflib
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=3,
            ))
            pytest.fail(f"F999 receivable byte-shape mismatch:\n{diff}")
```

- [ ] **Step 2: Run test**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceReceivable -v
```
Expected: 2 PASS.

If FAIL, the diff output points to the divergent key. Common issues:
- Numeric serialization (`0` vs `0.00`) — `_decimal_to_number` integral-int conversion
- Key spelling differs (e.g., `xAxisField` vs `xaxisField`) — verify against `_new_chart_config_dict` factory output
- Missing key (e.g., metric envelope omits `dimensionValue: null`) — `_new_metric_result_dict` should always emit 11 keys

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: F999 byte-shape contract test" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Task 12: Composite path side-effect test

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

Verify that replacing `_get_receivable_aging_chart` stub doesn't break the composite path (`analysisType=null`). The composite F999 golden (`analysis-finance-F999-composite.json`) was recorded against the stub's hardcoded zero output; the real impl must produce identical output for empty data.

- [ ] **Step 1: Verify composite golden exists**

```bash
ls .worktrees/phase2a-finance-receivable/tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json
```
Expected: file exists. If missing, the existing `TestAnalysisFinanceComposite` would already have been failing — investigate before continuing.

- [ ] **Step 2: Add side-effect contract test**

Append to `test_analysis_finance_contract.py`:

```python
    def test_f999_composite_receivable_aging_shape_locked(self, client, monkeypatch):
        """Post stub-replacement, composite path's receivableAging is real impl.
        Verify: envelope key set unchanged + 4-bucket shape + alertLevel hardcoded map.

        This test is the contract gate for the transparent upgrade. If it fails after
        replacing the stub, the composite F999 golden would also have to be re-recorded."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]

        # Composite envelope unchanged (6-key per existing golden)
        with io.open(GOLDEN_DIR / "analysis-finance-F999-composite.json", encoding="utf-8") as f:
            golden_data = json.load(f)["data"]
        assert set(data.keys()) == set(golden_data.keys())

        # receivableAging shape locked (was stub returning placeholder, now real impl)
        items = data.get("receivableAging", {}).get("data", [])
        assert len(items) == 4
        for item in items:
            assert set(item.keys()) == {"agingBucket", "amount", "percentage", "alertLevel"}
        # bucket order locked (Java line 600 fixed order)
        assert [i["agingBucket"] for i in items] == ["0-30天", "31-60天", "61-90天", "90天以上"]
        # alertLevel hardcoded map (regardless of amount)
        assert [i["alertLevel"] for i in items] == ["GREEN", "YELLOW", "YELLOW", "RED"]
        # Empty AR data → all amounts/percentages 0
        assert all(i["amount"] == 0 and i["percentage"] == 0 for i in items)
```

- [ ] **Step 3: Run test + verify composite byte-shape still passes**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceReceivable::test_f999_composite_receivable_aging_shape_locked -v
python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite -v
```
Expected: side-effect test PASS; existing composite tests still PASS (transparent upgrade verified).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: composite side-effect contract test" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Task 13: F001 manual smoke test (skipped)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

F001 is the real-data factory (test env, port 10011). Manual smoke against live data, not part of CI.

- [ ] **Step 1: Add skipped F001 manual test**

Append to `TestAnalysisFinanceReceivable` class (alongside F999 tests):

```python
    @pytest.mark.skip(reason="manual smoke against test env Java backend (port 10011)")
    def test_f001_receivable_byte_shape_manual(self, client):
        """F001 manual smoke. Run by hand:
            pytest -v -m '' --no-skip tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceReceivable::test_f001_receivable_byte_shape_manual

        Requires:
          - Test env Java backend running on port 10011 with F001 fixture data
          - cretas_pool / smartbi_user GRANTs configured
          - Python service running locally with the same DB pool

        Compares full byte-shape against analysis-finance-F001-receivable.json.
        """
        resp = client.get(
            "/api/mobile/F001/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=receivable",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F001-receivable.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        assert py_data == golden_data, "F001 byte-shape mismatch — re-record golden if Java logic changed"
```

- [ ] **Step 2: Verify test is collected as skipped**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceReceivable -v
```
Expected: 3 PASS + 1 SKIPPED (the F001 test marked with skip reason).

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A receivable: add F001 manual smoke (skipped in CI)" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Task 14: Full test suite verify + push + open PR

**Files:** none modified.

- [ ] **Step 1: Run full test suite (regression sweep)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v --tb=short
```
Expected: ALL tests pass (no regression in sister contract tests for composite/payable/profit/cost/sub-endpoints).

If a sister test fails:
- For composite: check that `_get_receivable_aging_chart` empty-data output exactly matches the previous stub's output — should be identical (4 buckets, all 0, same alertLevel map)
- For other (sales/alerts): unrelated to this PR — check git diff to confirm we didn't accidentally touch unrelated code

- [ ] **Step 2: Verify only intended files changed**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
git diff --stat origin/main...HEAD
```
Expected:
- `backend/python/smartbi_compat/api/analysis_finance.py`: ~250-350 lines added
- `tests/python/smartbi_compat/test_analysis_finance_contract.py`: ~100-150 lines added
- `tests/python/smartbi_compat/test_analysis_finance_factories.py`: ~400-500 lines added
- `docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-a.md`: this plan
- (If `python-dateutil` was missing earlier) `backend/python/requirements.txt`: 1 line added

NO other files should appear. If unexpected files show up:
- They may belong to a parallel sister chat (per concurrent-edit-safety Rule 5b, our `safe-commit.sh "msg" <files>` should have prevented this).
- Run `git log --oneline origin/main..HEAD` to confirm only our 12-13 commits are present.
- If a wayward file is committed, check whether any prior `safe-commit.sh` invocation included it (`git log --diff-filter=A --name-only origin/main..HEAD`).

- [ ] **Step 3: Push branch**

```bash
git push -u origin phase2a/finance-receivable
```

If the push is rejected (e.g., remote moved during a concurrent rebase): fetch first and confirm we're behind only on `main`, never on our own branch.

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head phase2a/finance-receivable --title "Phase 2A: /analysis/finance receivable per-type real impl (PR-A)" --body "$(cat <<'EOF'
## Summary

Real implementation of `/analysis/finance?analysisType=receivable` Java→Python port (byte-shape parity). Replaces existing 4-bucket stub `_get_receivable_aging_chart` with real impl; composite path transparently upgrades.

- 1 main helper `_get_receivable_analysis(factory_id, start_date, end_date)` returning 6-key envelope
- 4 sub-helpers: `_get_receivable_metrics` (5 metrics), `_get_receivable_aging_chart` (4-bucket BAR, replaces stub), `_get_overdue_customer_ranking` (top-10), `_get_receivable_trend_chart` (LINE_BAR monthly)
- 2 utilities: `_calculate_aging_buckets`, `_get_aging_bucket_alert_level`
- 4 threshold helpers: `_determine_collection_rate_alert`, `_aging_30_alert`, `_aging_60_alert`, `_aging_90_alert`
- 5 module constants (4 bucket names + order list + alert map + 2 thresholds)
- 1 dispatcher branch `if analysisType == "receivable":` in `get_finance_analysis`

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-finance-receivable-design.md (PR #33, merged main)
Plan: docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-a.md

## Tests

- F999 byte-shape gate (`tests/fixtures/java-smartbi-golden/analysis-finance-F999-receivable.json`)
- F001 manual smoke (skipped in CI; gated on test env Java backend port 10011)
- Composite path side-effect lock (4-bucket shape preserved when stub upgraded)
- Unit tests in `test_analysis_finance_factories.py`:
  - 5 alert level map cases
  - 10 aging bucket calculation cases (boundary + outstanding skip + null handling)
  - 6 threshold smoke cases
  - 3 aging chart real-impl cases
  - 5 metrics arithmetic cases
  - 10 ranking cases (skip / sort / dedup / cap / 4-key)
  - 6 trend chart cases (window / monthly / sort / 4-key / null skip)

PR-B follow-up: arithmetic depth (~16-20 parametrized tests covering 24-case threshold table + boundary stress + leap-year edge).

## Test plan

- [ ] CI green on PR
- [ ] `python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py -v` ALL pass
- [ ] `python -m pytest tests/python/smartbi_compat/test_analysis_finance_factories.py -v` ALL pass
- [ ] No regression in sister branches (composite / payable / profit / cost / sub-endpoints)
- [ ] Diff stat: only `analysis_finance.py` + 2 test files + this plan modified

## Concurrency note

Sister chat `phase2a/finance-budget` is concurrently editing `analysis_finance.py`. If this PR merges first, budget PR rebase conflict on dispatcher (~5 lines, trivial). If budget merges first, this PR rebase same way.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 5: Verify PR title + body + base**

```bash
gh pr view --json number,title,baseRefName,headRefName
```
Expected:
```
{
  "number": <new PR number>,
  "title": "Phase 2A: /analysis/finance receivable per-type real impl (PR-A)",
  "baseRefName": "main",
  "headRefName": "phase2a/finance-receivable"
}
```

PR-A complete. Hand off to PR-B chat for arithmetic depth tests.

---

## Self-Review

**1. Spec coverage check** — every spec section traces to a task:

| Spec section | Plan task |
|---|---|
| §1.2 PR-A scope: 1 main + 4 sub + 2 utility + 5 const + 1 route | Tasks 2 (const) + 3-4 (utilities) + 5 (thresholds) + 6 (aging chart) + 7 (metrics) + 8 (ranking) + 9 (trend) + 10 (main + dispatcher) |
| §1.3 Composite side effect | Task 12 (composite contract test) |
| §1.5 Out of scope | (nothing to do — explicitly excluded) |
| §2.1 File delta | Task 2 + 6 + 10 |
| §2.2 Architecture decisions A-E | Task 6 (relativedelta), Task 7 (Decimal scale), Tasks 4/6 (bucket order), Task 4 (outstanding > 0), all tasks (Rule 1 None-checks) |
| §3.2 metrics algorithm | Task 7 |
| §3.3 aging chart algorithm | Task 6 |
| §3.4 ranking algorithm | Task 8 |
| §3.5 trend chart algorithm | Task 9 |
| §3.6 calculate_aging_buckets | Task 4 |
| §3.7 alert level map | Task 3 |
| §3.8 dispatcher | Task 10 |
| §4.1 F999 envelope | Task 11 |
| §4.2 composite side effect | Task 12 |
| §5 testing strategy | Tasks 3-13 (each with TDD) |
| §6 byte gate semantics | Task 11 (dict-eq via `_strip_volatile`) |
| §7 PR slicing | Task 14 (PR-A only) |
| §8 risks | Task 1 (drift check), Task 9 (Map.of(2) order), Task 6 (relativedelta), Task 10 (auth.factory_id) |

All 8 risks in §8 are addressed in plan steps.

**2. Placeholder scan**: searched plan for "TBD", "TODO", "implement later", "Add appropriate", "fill in details", "similar to Task N". None found — every step has the actual code.

**3. Type / signature consistency**:
- `_get_receivable_metrics(factory_id, end_date)` — used in Tasks 7 + 10. Consistent.
- `_get_receivable_aging_chart(factory_id, end_date)` — replacing stub @1853 with same signature. Consistent.
- `_get_overdue_customer_ranking(factory_id, end_date)` — Tasks 8 + 10. Consistent.
- `_get_receivable_trend_chart(factory_id, start_date, end_date)` — Tasks 9 + 10. Consistent.
- `_get_receivable_analysis(factory_id, start_date, end_date)` — Tasks 10 + dispatcher. Sister `_get_payable_analysis` uses same shape. Consistent.
- `_calculate_aging_buckets(ar_data: list[dict])` — used by both metrics (Task 7) and aging chart (Task 6). Consistent.
- `_get_aging_bucket_alert_level(bucket: str)` — used by aging chart (Task 6). Consistent.
- `_determine_collection_rate_alert / _aging_30_alert / _aging_60_alert / _aging_90_alert` — all take `Decimal`, return `str`. Used in metrics (Task 7). Consistent.

No inconsistencies found.

---

## 并行工作建议

### Subagent: ✅ 推荐
Tasks 3-9 are largely independent (each adds a small helper with focused tests). A single chat dispatching one subagent per task achieves the strongest review checkpoint cadence.

Tasks 1, 10-14 require sequential dispatch (each depends on previous task's commit).

### 多 Chat: ❌ 不推荐
All tasks edit `backend/python/smartbi_compat/api/analysis_finance.py` — multi-chat parallel work guaranteed to conflict.

The sister `phase2a/finance-budget` chat is already concurrent on the same file (per spec §1.2). The `phase2a/finance-receivable` worktree provides physical isolation; the merge order will determine which PR rebases the dispatcher branch (~5 lines).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-01-phase2a-finance-receivable-pr-a.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
