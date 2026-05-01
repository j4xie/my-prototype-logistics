# Phase 2A `/analysis/finance?analysisType=payable` PR-B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add arithmetic-depth unit tests for the payable per-type implementation shipped in PR #18 (foundation phase). Final piece of Phase 2A finance Wave 1 — completes 5/5 finance subdomain PR-Bs (cost #28 / profit #22 / budget #44 / receivable #46 / payable this PR).

**Architecture:** Tests-only PR. NO changes to `analysis_finance.py` (payable impl shipped in PR #18 is final). All new tests append to `tests/python/smartbi_compat/test_analysis_finance_factories.py` as new test classes. Aggressive parametrize.

**Tech Stack:** pytest, pytest-asyncio (`@pytest.mark.asyncio`), monkeypatch fixture, Decimal arithmetic.

**Reference:** Payable shipped as PR #18 (foundation phase). NO standalone spec doc — design embedded in `2026-04-29-phase2a-analysis-finance-foundation-design.md`. Mirror Java `FinanceAnalysisServiceImpl.getPayableMetrics` (line 870-918) + `getPayableAgingChart` (line 832-867) + `calculatePayableAgingBuckets` (line 1529-1561).

**Template:** Receivable PR-B (PR #46) added 73 tests across 5 classes for 4 sub-services. Payable is simpler (2 sub-services), so PR-B targets ~30-35 tests across 3 classes.

**Concurrency note:** No active sister chat on `analysis_finance.py` at start of PR-B. Use `./scripts/safe-commit.sh` for every commit.

---

## ⛔ Hard rules

1. **NO impl changes** to `backend/python/smartbi_compat/api/analysis_finance.py` — PR #18 is final. PR-B is tests-only.
2. **Mock `_query_finance_payable_data`** (NOT `_query_finance_data` — payable uses a dedicated helper, NOT the shared one).
3. **Payable shape differs from receivable**:
   - Aging chart items have **3 keys** `{agingBucket, amount, percentage}` (NO alertLevel)
   - Aging chart `options` has 1 key `{colors}` only (NO showAlert)
   - Both metrics (AP_BALANCE, AP_TURNOVER_DAYS) hardcode `alertLevel="GREEN"` regardless of value
4. **AP_TURNOVER_DAYS formula** — verbatim Java line 902-906:
   - `avg_payable = (ap_balance / 2).quantize(Decimal("0.0001"), HALF_UP)` — scale=4 intermediate
   - `daily_payment = (total_payment / 365).quantize(Decimal("0.0001"), HALF_UP)`
   - `if daily_payment > 0: turnover_days = (avg_payable / daily_payment).quantize(0.0001, HALF_UP); else 0`
   - Final value quantized to scale=1 (`Decimal("1")`, days as integer)
5. **`AP_TURNOVER_DAYS.formatted_value` includes "天" suffix**, not "%". Unit is "天".

---

## Bug-watch

While reading the existing payable impl I noticed the following in `_get_payable_aging_chart` (line 2406):

```python
aging = r.get("aging_days") or 0
```

This is the Rule 1 `or` falsy fallback pattern. For the `aging_days` column (int from DB), `0 or 0 = 0` happens to give the same result as `is not None` ternary because both 0 and None route to bucket "0-30天" anyway. So this is **NOT** a Rule 1 violation in practice for the int type — but it's stylistic drift from Rule 1 best practice.

**Decision (per HARD RULE 1):** Do NOT fix in this PR. PR-B is tests-only. The behavior is correct (just stylistically inconsistent). Tests should pin current behavior, not aspirational behavior.

---

## File Structure

| File | Change | Sections |
|---|---|---|
| `tests/python/smartbi_compat/test_analysis_finance_factories.py` | Modify (append) | 3 new test classes appended at end of file: `TestPayableAgingBucketDepth`, `TestPayableMetricsArithmeticDepth`, `TestPayableAgingChartShapeDepth` |
| `backend/python/smartbi_compat/api/analysis_finance.py` | **NOT MODIFIED** | (PR #18 is final; touching it is a hard rule violation) |
| `docs/superpowers/plans/2026-05-01-phase2a-finance-payable-pr-b.md` | Create | This plan |

---

## Task 1: `TestPayableAgingBucketDepth` — aging boundary + outstanding skip

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append at end)

The payable aging logic is inlined in `_get_payable_aging_chart` (NO separate `_calculate_payable_aging_buckets` helper exists, unlike receivable's `_calculate_aging_buckets`). Tests must exercise the chart function directly via mocked `_query_finance_payable_data`.

- [ ] **Step 1: Append class with parametrized boundary tests**

Append at end of `tests/python/smartbi_compat/test_analysis_finance_factories.py`:

```python
class TestPayableAgingBucketDepth:
    """PR-B depth — aging-day boundaries for payable aging chart bucket assignment.

    Tests boundaries of the inlined bucket logic in _get_payable_aging_chart
    (line 2400-2414): aging_days <= 30/60/90/else chain, outstanding<=0 skip,
    null aging_days fallback (Java `r.get("aging_days") or 0` → 0).

    NOTE: Payable's bucket logic is inlined (not in a separate utility like
    receivable's _calculate_aging_buckets), so we test it through the chart
    function. Fewer tests than receivable PR-B Task 1 because payable has
    no alertLevel per bucket and no shared utility.
    """

    @staticmethod
    async def _run_chart(monkeypatch, rows):
        """Run _get_payable_aging_chart with _query_finance_payable_data mocked."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, end_date):
            return rows
        monkeypatch.setattr(analysis_finance, "_query_finance_payable_data", fake_query)
        return await analysis_finance._get_payable_aging_chart("F001", date(2025, 12, 31))

    @pytest.mark.parametrize("aging_days,expected_bucket", [
        (-1,  "0-30天"),    # negative → falls to 0-30 (aging<=30 catches negatives via `or 0` for None or via direct compare)
        (0,   "0-30天"),    # boundary low
        (30,  "0-30天"),    # boundary high of first bucket (<=)
        (31,  "31-60天"),   # boundary low of second bucket
        (60,  "31-60天"),   # boundary high of second bucket
        (61,  "61-90天"),   # boundary low of third bucket
        (90,  "61-90天"),   # boundary high of third bucket
        (91,  "90天以上"),  # boundary low of fourth bucket
    ])
    @pytest.mark.asyncio
    async def test_aging_day_boundary_assignment(self, aging_days, expected_bucket, monkeypatch):
        """Boundary value falls into LOWER bucket per Java <= chain (line 2407-2413)."""
        rows = [{"payable_amount": "1000", "payment_amount": "0", "aging_days": aging_days}]
        chart = await self._run_chart(monkeypatch, rows)
        # Exactly one bucket gets the 1000; others stay 0
        for item in chart["data"]:
            if item["agingBucket"] == expected_bucket:
                assert item["amount"] == 1000, (
                    f"aging_days={aging_days} expected {expected_bucket}=1000, got {item['amount']}"
                )
            else:
                assert item["amount"] == 0, (
                    f"aging_days={aging_days} expected only {expected_bucket} populated, "
                    f"but {item['agingBucket']} = {item['amount']}"
                )

    @pytest.mark.parametrize("payable,payment,desc", [
        ("100", "100", "outstanding=0 (equal) → skipped per line 2404"),
        ("50",  "100", "outstanding<0 (overpaid) → skipped"),
        ("0.01","0",   "outstanding=0.01 (just-positive) → kept (Decimal precision)"),
    ])
    @pytest.mark.asyncio
    async def test_outstanding_threshold_strict_gt_zero(self, payable, payment, desc, monkeypatch):
        """Java line 2404: `if outstanding <= 0 continue` — boundary outstanding=0 skipped."""
        rows = [{"payable_amount": payable, "payment_amount": payment, "aging_days": 15}]
        chart = await self._run_chart(monkeypatch, rows)
        outstanding = Decimal(payable) - Decimal(payment)
        if outstanding > Decimal("0"):
            # Should be in 0-30天 bucket
            first_bucket = next(d for d in chart["data"] if d["agingBucket"] == "0-30天")
            assert first_bucket["amount"] == outstanding, desc
        else:
            # All buckets should be 0
            assert all(d["amount"] == 0 for d in chart["data"]), desc

    @pytest.mark.asyncio
    async def test_null_aging_days_fallback_to_zero_bucket(self, monkeypatch):
        """Java line 2406: `aging = r.get("aging_days") or 0` — None → 0 → 0-30天 bucket.

        For int aging_days column, `or 0` is equivalent to is-not-None ternary
        (both produce 0 for None and 0 for 0). Pinning current behavior.
        """
        rows = [{"payable_amount": "1000", "payment_amount": "0", "aging_days": None}]
        chart = await self._run_chart(monkeypatch, rows)
        first_bucket = next(d for d in chart["data"] if d["agingBucket"] == "0-30天")
        assert first_bucket["amount"] == 1000

    @pytest.mark.asyncio
    async def test_multi_row_same_bucket_aggregates(self, monkeypatch):
        """Multiple rows in same bucket → outstanding sums."""
        rows = [
            {"payable_amount": "100", "payment_amount": "0", "aging_days": 10},
            {"payable_amount": "200", "payment_amount": "0", "aging_days": 20},
            {"payable_amount": "300", "payment_amount": "0", "aging_days": 30},
        ]
        chart = await self._run_chart(monkeypatch, rows)
        first_bucket = next(d for d in chart["data"] if d["agingBucket"] == "0-30天")
        assert first_bucket["amount"] == 600  # 100 + 200 + 300

    @pytest.mark.asyncio
    async def test_distributes_across_all_4_buckets(self, monkeypatch):
        """One row per bucket → 4 distinct totals."""
        rows = [
            {"payable_amount": "100", "payment_amount": "0", "aging_days": 15},   # 0-30
            {"payable_amount": "200", "payment_amount": "0", "aging_days": 45},   # 31-60
            {"payable_amount": "300", "payment_amount": "0", "aging_days": 75},   # 61-90
            {"payable_amount": "400", "payment_amount": "0", "aging_days": 120},  # 90+
        ]
        chart = await self._run_chart(monkeypatch, rows)
        buckets = {d["agingBucket"]: d["amount"] for d in chart["data"]}
        assert buckets["0-30天"]   == 100
        assert buckets["31-60天"]  == 200
        assert buckets["61-90天"]  == 300
        assert buckets["90天以上"] == 400
```

NOTE: `pytest`, `Decimal`, `date` already imported at top of file (from receivable PR-A/PR-B). Do NOT re-import.

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestPayableAgingBucketDepth -v
```
Expected: All tests PASS (impl shipped in PR #18; PR-B just adds depth).

Test count: 8 (parametrize) + 3 (parametrize) + 1 + 1 + 1 = ~13 cases via 5 functions.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A payable PR-B: aging bucket boundary depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 2: `TestPayableMetricsArithmeticDepth` — AP_BALANCE + AP_TURNOVER_DAYS edges

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after Task 1)

Payable has 2 metrics. AP_BALANCE is straightforward (`payable - payment`). AP_TURNOVER_DAYS has a multi-step Decimal pipeline with scale=4 intermediates and scale=1 final, plus a zero-guard on `daily_payment`.

- [ ] **Step 1: Append class with metrics edges**

```python
class TestPayableMetricsArithmeticDepth:
    """PR-B depth — formula arithmetic for 2 payable metrics.

    Mirror Java FinanceAnalysisServiceImpl.getPayableMetrics (line 870-918).
    Tests AP_BALANCE basic arithmetic + AP_TURNOVER_DAYS multi-stage Decimal pipeline.

    Both metrics hardcode alertLevel="GREEN" regardless of value (no threshold helpers
    for payable — distinct from receivable which has 4 alert helpers).
    """

    @staticmethod
    async def _run_metrics(monkeypatch, rows):
        """Run _get_payable_metrics with _query_finance_payable_data mocked."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, end_date):
            return rows
        monkeypatch.setattr(analysis_finance, "_query_finance_payable_data", fake_query)
        return await analysis_finance._get_payable_metrics("F001", date(2025, 12, 31))

    # ===== AP_BALANCE arithmetic =====

    @pytest.mark.asyncio
    async def test_ap_balance_basic_subtraction(self, monkeypatch):
        """AP_BALANCE = totalPayable - totalPayment. 3000 payable - 1200 payment = 1800."""
        rows = [{"payable_amount": "3000", "payment_amount": "1200", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[0]["metricCode"] == "AP_BALANCE"
        assert metrics[0]["value"] == 1800
        assert metrics[0]["formattedValue"] == "1800.00"
        assert metrics[0]["unit"] == "元"
        assert metrics[0]["alertLevel"] == "GREEN"  # hardcoded

    @pytest.mark.asyncio
    async def test_ap_balance_negative_when_overpaid(self, monkeypatch):
        """totalPayment > totalPayable → ap_balance < 0. AP_BALANCE keeps GREEN
        (Java line 877 hardcoded), no alert flip."""
        rows = [{"payable_amount": "1000", "payment_amount": "1500", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[0]["value"] == -500
        assert metrics[0]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_ap_balance_quantize_half_up_two_decimals(self, monkeypatch):
        """Decimal('0.005').quantize(0.01, HALF_UP) = 0.01.
        payable=1000.005, payment=0 → balance=1000.005 → 1000.01."""
        rows = [{"payable_amount": "1000.005", "payment_amount": "0", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[0]["value"] == 1000.01

    @pytest.mark.asyncio
    async def test_ap_balance_empty_data_zero(self, monkeypatch):
        """No rows → totalPayable=0, totalPayment=0, balance=0."""
        rows = []
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[0]["value"] == 0
        assert metrics[0]["formattedValue"] == "0.00"
        assert metrics[0]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_ap_balance_aggregates_across_rows(self, monkeypatch):
        """Multiple rows → sums applied per side: payable summed, payment summed, then subtracted."""
        rows = [
            {"payable_amount": "1000", "payment_amount": "200", "aging_days": 30},
            {"payable_amount": "500",  "payment_amount": "100", "aging_days": 60},
            {"payable_amount": "300",  "payment_amount": "50",  "aging_days": 90},
        ]
        metrics = await self._run_metrics(monkeypatch, rows)
        # totalPayable = 1800, totalPayment = 350, balance = 1450
        assert metrics[0]["value"] == 1450

    # ===== AP_TURNOVER_DAYS arithmetic =====

    @pytest.mark.asyncio
    async def test_ap_turnover_days_zero_guard_when_no_payment(self, monkeypatch):
        """totalPayment=0 → daily_payment=0 → zero-guard skips division → turnover_days=0.

        Java line 904: `if dailyPayment > 0` ternary.
        """
        rows = [{"payable_amount": "1000", "payment_amount": "0", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[1]["metricCode"] == "AP_TURNOVER_DAYS"
        assert metrics[1]["value"] == 0
        assert metrics[1]["formattedValue"] == "0天"
        assert metrics[1]["unit"] == "天"
        assert metrics[1]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_ap_turnover_days_full_formula(self, monkeypatch):
        """Multi-stage Decimal pipeline:

        totalPayable = 73000, totalPayment = 365, ap_balance = 72635
        avg_payable = 72635 / 2 = 36317.5  → quantize(0.0001) = 36317.5000
        daily_payment = 365 / 365 = 1.0     → quantize(0.0001) = 1.0000
        turnover = 36317.5 / 1 = 36317.5    → quantize(0.0001) = 36317.5000
        final value = quantize(Decimal("1"), HALF_UP) = 36318 (HALF_UP rounds .5 up)
        """
        rows = [{"payable_amount": "73000", "payment_amount": "365", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[1]["value"] == 36318
        assert metrics[1]["formattedValue"] == "36318天"

    @pytest.mark.asyncio
    async def test_ap_turnover_days_simple_full_year(self, monkeypatch):
        """Round-numbers test:
        payable=1095, payment=0 → balance=1095 → avg=547.5 → daily=0 (zero-guard) → turnover=0.

        For non-zero turnover need payment > 0:
        payable=730, payment=365 → balance=365 → avg=182.5 → daily=1 → turnover=182.5 → 183 (HALF_UP)
        """
        rows = [{"payable_amount": "730", "payment_amount": "365", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        # ap_balance = 730 - 365 = 365
        # avg_payable = 365/2 = 182.5 → quantize(0.0001) = 182.5000
        # daily_payment = 365/365 = 1.0 → quantize(0.0001) = 1.0000
        # turnover = 182.5/1 = 182.5 → quantize(0.0001) = 182.5000
        # final = quantize(Decimal("1"), HALF_UP) = 183 (.5 rounds up)
        assert metrics[1]["value"] == 183

    @pytest.mark.asyncio
    async def test_ap_turnover_days_negative_balance(self, monkeypatch):
        """Overpaid case: balance<0 → avg_payable<0 → turnover<0.
        AlertLevel still GREEN (hardcoded line 920)."""
        rows = [{"payable_amount": "100", "payment_amount": "365", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        # ap_balance = 100 - 365 = -265
        # avg_payable = -265/2 = -132.5 → quantize(0.0001) = -132.5000
        # daily_payment = 365/365 = 1.0 → quantize(0.0001) = 1.0000
        # turnover = -132.5 / 1 = -132.5 → quantize(0.0001) = -132.5000
        # final quantize(1, HALF_UP) on -132.5 → Decimal HALF_UP rounds toward higher absolute → -133
        assert metrics[1]["value"] == -133
        assert metrics[1]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_metrics_envelope_has_11_fields(self, monkeypatch):
        """Both metrics emit all 11 Java MetricResult fields (per Lombok @Data)."""
        rows = []
        metrics = await self._run_metrics(monkeypatch, rows)
        expected_keys = {
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue",
            "alertLevel", "dimensionValue", "description",
        }
        for m in metrics:
            assert set(m.keys()) == expected_keys

    @pytest.mark.asyncio
    async def test_metrics_descriptions_match_java(self, monkeypatch):
        """Lock exact Chinese descriptions from Java line 882/909."""
        rows = []
        metrics = await self._run_metrics(monkeypatch, rows)
        descs = [m["description"] for m in metrics]
        assert descs == [
            "尚未支付的应付账款总额",  # AP_BALANCE
            "平均付款周期",                # AP_TURNOVER_DAYS
        ]

    @pytest.mark.asyncio
    async def test_metrics_value_is_int_when_integral(self, monkeypatch):
        """Rule 4 — _decimal_to_number returns int for integer-valued Decimals.
        AP_TURNOVER_DAYS quantizes to scale=1 (Decimal('1')) so result is always integer.
        AP_BALANCE may be float when fractional, int when whole.
        """
        rows = [{"payable_amount": "100", "payment_amount": "50", "aging_days": 30}]
        metrics = await self._run_metrics(monkeypatch, rows)
        assert metrics[0]["value"] == 50
        assert isinstance(metrics[0]["value"], int)  # 50.00 → integral → int
        assert isinstance(metrics[1]["value"], int)  # turnover_days always integer per scale=1
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestPayableMetricsArithmeticDepth -v
```
Expected: 11 PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A payable PR-B: 2 metrics arithmetic depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 3: `TestPayableAgingChartShapeDepth` — 3-key item shape + options.colors regression

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_factories.py` (append after Task 2)

The payable chart shape differs from receivable in two key ways:
1. Items have **3 keys** (`agingBucket / amount / percentage`) — NO alertLevel
2. `options` has **1 key** (`colors`) — NO showAlert

Lock these distinctions so future refactor doesn't accidentally add alertLevel/showAlert to payable.

- [ ] **Step 1: Append class with shape regression tests**

```python
class TestPayableAgingChartShapeDepth:
    """PR-B depth — chart shape regression for _get_payable_aging_chart.

    Locks payable's shape distinctions from receivable:
      - data items: 3 keys (NO alertLevel)
      - options: 1 key (NO showAlert)
      - colors palette: blue/purple/violet/pink (NOT receivable's green/yellow/red)
      - title: "应付账款账龄分布" (NOT "应收...")
      - chartType=BAR (same as receivable)
    """

    @staticmethod
    async def _run_chart(monkeypatch, rows):
        """Run _get_payable_aging_chart with _query_finance_payable_data mocked."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, end_date):
            return rows
        monkeypatch.setattr(analysis_finance, "_query_finance_payable_data", fake_query)
        return await analysis_finance._get_payable_aging_chart("F001", date(2025, 12, 31))

    @pytest.mark.asyncio
    async def test_data_item_has_exactly_3_keys_no_alertLevel(self, monkeypatch):
        """Each data item has 3 keys: {agingBucket, amount, percentage}.
        NO alertLevel (which receivable has). Regression guard for shape divergence."""
        rows = [{"payable_amount": "100", "payment_amount": "0", "aging_days": 30}]
        chart = await self._run_chart(monkeypatch, rows)
        for item in chart["data"]:
            assert set(item.keys()) == {"agingBucket", "amount", "percentage"}, (
                f"payable aging chart item should have 3 keys (no alertLevel), got {list(item.keys())}"
            )

    @pytest.mark.asyncio
    async def test_options_has_only_colors_no_showAlert(self, monkeypatch):
        """options has 1 key {colors}. NO showAlert (which receivable has)."""
        rows = []
        chart = await self._run_chart(monkeypatch, rows)
        assert set(chart["options"].keys()) == {"colors"}, (
            f"payable options should have only 'colors', got {list(chart['options'].keys())}"
        )

    @pytest.mark.asyncio
    async def test_colors_palette_matches_payable_pattern(self, monkeypatch):
        """Locked colors: blue/purple-blue/violet/pink (Java line 858 — NOT receivable's GR/Y/R)."""
        rows = []
        chart = await self._run_chart(monkeypatch, rows)
        assert chart["options"]["colors"] == ["#73c0de", "#5470c6", "#9a60b4", "#ea7ccc"]

    @pytest.mark.asyncio
    async def test_chart_envelope_matches_payable_signature(self, monkeypatch):
        """Lock chartType=BAR + title="应付账款账龄分布" + xaxisField/yaxisField shape.

        chartType=BAR (same as receivable) but title differs from receivable's "应收..."
        """
        rows = []
        chart = await self._run_chart(monkeypatch, rows)
        assert chart["chartType"] == "BAR"
        assert chart["title"] == "应付账款账龄分布"
        assert chart["seriesField"] is None
        assert chart["xaxisField"] == "agingBucket"
        assert chart["yaxisField"] == "amount"

    @pytest.mark.asyncio
    async def test_empty_data_emits_4_zero_buckets(self, monkeypatch):
        """No rows → 4 buckets all (0, 0). Matches Java line 853-866 always-emit pattern."""
        rows = []
        chart = await self._run_chart(monkeypatch, rows)
        assert len(chart["data"]) == 4
        assert [d["agingBucket"] for d in chart["data"]] == ["0-30天", "31-60天", "61-90天", "90天以上"]
        assert all(d["amount"] == 0 and d["percentage"] == 0 for d in chart["data"])

    @pytest.mark.asyncio
    async def test_percentage_zero_guard_when_total_ap_zero(self, monkeypatch):
        """Java line 2421-2422: `if total_ap > 0` guards percentage calc.
        When all rows skipped (outstanding<=0), total_ap=0 → all percentages=0."""
        rows = [
            {"payable_amount": "100", "payment_amount": "100", "aging_days": 30},  # outstanding=0 skip
            {"payable_amount": "50",  "payment_amount": "100", "aging_days": 60},  # outstanding<0 skip
        ]
        chart = await self._run_chart(monkeypatch, rows)
        assert all(d["percentage"] == 0 for d in chart["data"])
        assert all(d["amount"] == 0 for d in chart["data"])

    @pytest.mark.asyncio
    async def test_percentage_quantize_two_decimal(self, monkeypatch):
        """Java line 2422: `(amount / total_ap).quantize(0.0001, HALF_UP) * 100`.
        For 1/3 → 0.3333 * 100 = 33.33 (not 33.34).

        Three rows in 3 different buckets, equal amounts → 33.33% each."""
        rows = [
            {"payable_amount": "100", "payment_amount": "0", "aging_days": 15},   # 0-30
            {"payable_amount": "100", "payment_amount": "0", "aging_days": 45},   # 31-60
            {"payable_amount": "100", "payment_amount": "0", "aging_days": 75},   # 61-90
        ]
        chart = await self._run_chart(monkeypatch, rows)
        # Total = 300, each bucket = 100, percentage each = 33.33
        for item in chart["data"][:3]:
            assert item["percentage"] == 33.33, f"{item['agingBucket']} expected 33.33, got {item['percentage']}"
        # 4th bucket (90天以上) should be 0
        assert chart["data"][3]["percentage"] == 0
```

- [ ] **Step 2: Run tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_factories.py::TestPayableAgingChartShapeDepth -v
```
Expected: 7 PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
./scripts/safe-commit.sh "Phase 2A payable PR-B: aging chart shape depth tests" tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

## Task 4: Final regression sweep + push + open PR + final reviewer

**Files:** none modified.

- [ ] **Step 1: Run full smartbi_compat test suite**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q
```
Expected: All previous 442 tests still pass + ~31 new tests = **~473+ passed, 1 skipped (F001 manual), 0 failed**.

If any test fails:
- New tests failing → impl edge case might differ from spec; investigate
- Existing tests failing → check git diff to confirm we didn't accidentally touch impl code

- [ ] **Step 2: Verify diff scope (tests-only)**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-receivable
git diff --stat origin/main...HEAD
```
Expected:
- `tests/python/smartbi_compat/test_analysis_finance_factories.py`: ~400-500 lines added
- `docs/superpowers/plans/2026-05-01-phase2a-finance-payable-pr-b.md`: this plan
- **NO `analysis_finance.py` changes** (HARD RULE — verify zero impl changes)

- [ ] **Step 3: Push branch**

```bash
git push -u origin phase2a/finance-payable-pr-b
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head phase2a/finance-payable-pr-b --title "Phase 2A: /analysis/finance payable arithmetic depth tests (PR-B)" --body "$(cat <<'EOF'
## Summary

Arithmetic depth tests for the payable per-type implementation shipped in PR #18 (foundation phase). Tests-only PR — no changes to `analysis_finance.py`.

**Final piece of Phase 2A finance Wave 1** — completes 5/5 finance subdomain PR-Bs:
- PR #28 cost PR-B
- PR #22 profit PR-B
- PR #44 budget PR-B
- PR #46 receivable PR-B
- **This PR — payable PR-B**

- 3 new test classes in `tests/python/smartbi_compat/test_analysis_finance_factories.py`:
  - `TestPayableAgingBucketDepth` — aging-day boundaries (-1/0/30/31/60/61/90/91), outstanding-skip, null aging fallback, multi-row aggregation
  - `TestPayableMetricsArithmeticDepth` — AP_BALANCE basic/negative/quantize/empty/aggregate + AP_TURNOVER_DAYS zero-guard/full-formula/negative-balance/envelope-shape
  - `TestPayableAgingChartShapeDepth` — 3-key item shape (no alertLevel) + 1-key options (no showAlert) + colors palette + percentage quantize

Reference: payable shipped without standalone spec doc (bundled into foundation spec). Mirrors Java `FinanceAnalysisServiceImpl.getPayableMetrics` (line 870-918) + `getPayableAgingChart` (line 832-867).

Plan: docs/superpowers/plans/2026-05-01-phase2a-finance-payable-pr-b.md
Impl: PR #18 (merged main; foundation phase E)

## Tests

Full smartbi_compat regression sweep: **~473 passed, 1 skipped (F001 manual), 0 failed** (was 442 after PR #46; +31 from this PR).

Test coverage breakdown by class:
- AgingBucketDepth: ~13 cases via 5 functions (parametrized)
- MetricsArithmeticDepth: 11 functions
- AgingChartShapeDepth: 7 functions

## Hard rules locked

- Java strict comparison `<=` chain for aging buckets (boundary value falls into LOWER bucket)
- AP_TURNOVER_DAYS multi-stage Decimal pipeline (scale=4 intermediate, scale=1 final, HALF_UP)
- Zero-guard on `daily_payment > 0` (Java line 904)
- Both metrics hardcode `alertLevel="GREEN"` (NO threshold helpers for payable)
- Aging chart items have **3 keys** only (NO alertLevel — distinct from receivable)
- Aging chart options have **1 key** only (NO showAlert — distinct from receivable)
- Colors palette `#73c0de/#5470c6/#9a60b4/#ea7ccc` (NOT receivable's GR/Y/R)
- Title `应付账款账龄分布` (NOT receivable's `应收账款账龄分布`)

## Test plan

- [ ] CI green on PR
- [ ] `python -m pytest tests/python/smartbi_compat/test_analysis_finance_factories.py -v` ALL pass
- [ ] No regression in sister branches (composite / payable / profit / cost / receivable / budget)
- [ ] Diff stat: ONLY `test_analysis_finance_factories.py` + plan modified (NO impl changes)

## Phase 2A finance Wave 1 status

🚀 **Wave 1 complete** — 5/5 finance subdomains have impl + depth-tests PRs merged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Dispatch final code reviewer subagent**

After PR is opened, dispatch `pr-review-toolkit:code-reviewer` subagent with `model=sonnet` to review the entire branch. Tell it the PR is mechanical (tests-only) and ask it to check:
1. NO impl file modification
2. Spec semantics — payable's distinctions from receivable (3-key items / 1-key options / no alertLevel / hardcoded GREEN metrics)
3. Rule 1 — Decimal('0') falsy trap NOT introduced in test mocks
4. AP_TURNOVER_DAYS formula chain correctness (scale=4 intermediate, scale=1 final, HALF_UP rounding edge)
5. Test quality — meaningful behavior assertions, not mock-call assertions

PR-B complete after final reviewer approves. Wave 1 finance shipping closed.

---

## Self-Review

**1. Spec coverage** — every payable requirement (no formal spec doc; derived from impl) covered:

| Payable feature | Task |
|---|---|
| Aging boundary cases (-1/0/30/31/60/61/90/91) | Task 1 (parametrized, 8 cases) |
| Outstanding ≤ 0 skip | Task 1 (parametrized, 3 cases) |
| Null aging_days fallback | Task 1 |
| Multi-row aggregation | Task 1 |
| 4-bucket distribution | Task 1 |
| AP_BALANCE basic | Task 2 (5 functions: basic/negative/quantize/empty/aggregate) |
| AP_TURNOVER_DAYS zero-guard | Task 2 |
| AP_TURNOVER_DAYS full formula | Task 2 |
| AP_TURNOVER_DAYS negative | Task 2 |
| Metric envelope 11 keys | Task 2 |
| Metric description Chinese strings | Task 2 |
| Rule 4 int when integral | Task 2 |
| 3-key item shape (no alertLevel) | Task 3 |
| 1-key options (no showAlert) | Task 3 |
| Colors palette | Task 3 |
| Title + chartType + xaxisField/yaxisField | Task 3 |
| Empty 4-zero buckets | Task 3 |
| Percentage zero-guard | Task 3 |
| Percentage quantize 33.33% | Task 3 |

All payable surface area covered.

**2. Placeholder scan**: searched plan for "TBD", "TODO", "implement later", "Add appropriate", "fill in details", "similar to Task N". None found.

**3. Type / signature consistency**: helper functions referenced (`_get_payable_metrics`, `_get_payable_aging_chart`, `_query_finance_payable_data`) all exist in PR #18 merged code. Signatures `(factory_id: str, end_date: date)` consistent. `_run_chart` and `_run_metrics` static methods are tightly scoped to each test class (no cross-class reuse needed).

No inconsistencies.

---

## 并行工作建议

### Subagent: ✅ 推荐
3 implementation tasks (1-3) are independent; each adds a new test class. Dispatch one subagent per task. Per memory `feedback_subagent_driven_audit_pattern.md` mechanical pattern: skip per-task spec/quality reviewer subagents, only do self-review + branch-level final reviewer at Task 4.

Task 4 (verify + push + PR + final review) requires sequential.

### 多 Chat: ❌ 不推荐
All 3 implementation tasks edit the same file (`test_analysis_finance_factories.py`). Multi-chat parallel will conflict.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-01-phase2a-finance-payable-pr-b.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Per memory `feedback_subagent_driven_audit_pattern.md` mechanical pattern: skip per-task spec/quality reviewers, only do self-review + branch-level final review.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
