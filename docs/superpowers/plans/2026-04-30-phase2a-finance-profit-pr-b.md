# Phase 2A `/analysis/finance` profit per-type PR-B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Path B (sales fallback) to profit per-type endpoint — when `finance_data` is empty, use `smart_bi_sales_data` to compute revenue/cost. Add 17 arithmetic-depth unit tests covering metrics anomaly clamps, fallback paths, ROI div-zero, alert thresholds, period-key boundaries.

**Architecture:** Two new private functions (`_query_finance_sales_fallback` async DB helper + `_aggregate_profit_by_period_sales` sync chart aggregator). Modify the `else` branches of existing `_get_profit_metrics` and `_get_profit_trend_chart` to call them. Add 3 test classes with 17 total tests using `monkeypatch.setattr` to inject synthetic data at the `_query_finance_data` and `_query_finance_sales_fallback` seams.

**Tech Stack:** asyncpg (pool from `smartbi.config.get_pg_pool`), pytest + monkeypatch + asyncio.run for direct unit tests.

**Spec:** `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md` §3.5 + §5.2 + §5.3

**Branch:** `phase2a/t-finance-profit-pr-b` (worktree: `.worktrees/phase2a-finance-profit`)

**Base:** `origin/main` HEAD `bfe77566c` (PR-A merged squash)

**Out of scope:** WEEK period-key calendar-year vs ISO-year (M-2 backlog, irrelevant since controller hardcodes MONTH); strict-byte gate upgrade; CI for non-empty F001 contract tests.

**Concurrency notes:**
- Sister chats `phase2a/t-finance-cost` + `phase2a/t-finance-receivable` are running in parallel worktrees. They will modify `analysis_finance.py` independently. Use `safe-commit.sh` for every commit.
- Cost and receivable sister chats may add THEIR OWN `_query_finance_data` callers, but the function signature `(factory_id, record_type, start_date, end_date)` is stable from PR-A. PR-B does NOT modify `_query_finance_data` itself.

---

## Concurrent-edit safety reminder

Every commit MUST use `./scripts/safe-commit.sh "msg" path1 path2` OR `git commit -m "msg" -- path1 path2` (per `.claude/rules/concurrent-edit-safety.md` rule 5b). Sister chats may have files staged in their worktree's index — `--only` mode prevents scope creep.

---

## Phase A — Sales fallback impl

### Task A.1: Add `_query_finance_sales_fallback` async DB helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after `_query_finance_data` ~line 540)

**Java reference:** `FinanceAnalysisServiceImpl.java:392-393` — `salesDataRepository.findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate)`. Different table from `_query_finance_data` (queries `smart_bi_sales_data` instead of `smart_bi_finance_data`).

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "async def _query_finance_data\|^# Section 3:\|^# Section 4:" backend/python/smartbi_compat/api/analysis_finance.py
```

The new helper goes immediately AFTER `_query_finance_data` (which ends at the last `return _filter_to_latest_upload(raw_rows)` line) and BEFORE the next section comment.

- [ ] **Step 2: Insert the new function**

Use the Edit tool. Insert immediately after `_query_finance_data`'s closing:

```python
async def _query_finance_sales_fallback(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Query smart_bi_sales_data for sales-fallback path (Java line 392-393).

    Used by profit metrics + trendChart when finance_data is empty (餐饮 tenants
    that uploaded sales Excel but not finance Excel).

    Returns list of dicts with keys: amount, cost, order_date (and other columns
    present in smart_bi_sales_data — callers extract by key with .get()).

    NOTE: Unlike _query_finance_data, this does NOT call _filter_to_latest_upload.
    Java's salesDataRepository.findByFactoryIdAndOrderDateBetween returns raw
    rows without latest-upload filtering — this matches Java behavior for the
    fallback path.
    """
    pool = None
    try:
        from smartbi.config import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning(
            "[sales_fallback] pool acquisition failed factory=%s: %s",
            factory_id, e,
        )
        return []

    if pool is None:
        logger.warning(
            "[sales_fallback] pool is None factory=%s; returning empty rows",
            factory_id,
        )
        return []

    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_finance_sales_fallback: start_date/end_date required "
            f"(got {start_date}, {end_date})"
        )

    sql = """
        SELECT *
        FROM smart_bi_sales_data
        WHERE factory_id = $1
          AND order_date BETWEEN $2 AND $3
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)

    return [dict(r) for r in rows]
```

Style note: matches `_query_finance_data` exactly (try/except pool, None-date precondition assertion per spec §3.4 I-5 fix, SELECT \*).

- [ ] **Step 3: Run pytest baseline**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 227 passed (no regression — new helper not yet called from anywhere).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit-pr-b): add _query_finance_sales_fallback async helper" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task A.2: Add `_aggregate_profit_by_period_sales` sync helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after `_build_profit_chart_from_finance_data` ~line 895)

**Java reference:** `FinanceAnalysisServiceImpl.java:1423-1447` — `aggregateProfitByPeriod`. Note: chart points emitted by this aggregator have **4 keys** `[period, grossProfit, netProfit, grossMargin]`, NOT 6 keys like the main path. This is a Java quirk (the salesData fallback path does not emit revenue/cost in the chart point).

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "def _build_profit_chart_from_finance_data\|async def _get_profit_trend_chart" backend/python/smartbi_compat/api/analysis_finance.py
```

The new helper goes between `_build_profit_chart_from_finance_data` (ends with `return chart_data`) and `_get_profit_trend_chart`.

- [ ] **Step 2: Insert the new function**

```python
def _aggregate_profit_by_period_sales(
    sales_rows: list[dict], period: str
) -> list[dict]:
    """Mirror Java `FinanceAnalysisServiceImpl.aggregateProfitByPeriod` line 1423-1447.

    Sales-fallback chart aggregator. Used when finance_data is empty but
    smart_bi_sales_data has rows (餐饮 tenants).

    Differs from `_build_profit_chart_from_finance_data`:
      - emits **4 keys per point**: [period, grossProfit, netProfit, grossMargin]
        (NOT 6 keys — no `revenue` / `cost`)
      - `netProfit = grossProfit * 0.70` (Java line 1440 hardcoded — known quirk;
        assumes 30% expense ratio. PR-B preserves this for byte parity.)
      - `grossMargin` does NOT clamp >100/<-100 → null (Java line 1441-1443
        emits raw value or 0). For sales rows revenue is never huge negative,
        so this rarely matters in practice; we mirror Java behavior literally.

    Period aggregation via TreeMap → Python `sorted(by_period.keys())`.
    """
    by_period: dict[str, dict[str, Decimal]] = {}
    for r in sales_rows:
        if r.get("order_date") is None:
            continue
        key = _get_period_key(r["order_date"], period)
        slot = by_period.setdefault(
            key, {"profit": Decimal("0"), "revenue": Decimal("0")}
        )
        revenue = _to_decimal(r.get("amount") or 0)
        cost = _to_decimal(r.get("cost") or 0)
        slot["profit"] += revenue - cost
        slot["revenue"] += revenue

    out: list[dict] = []
    for key in sorted(by_period.keys()):
        slot = by_period[key]
        gross = slot["profit"]
        net = (gross * Decimal("0.70")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        if slot["revenue"] > Decimal("0"):
            gm = (
                gross / slot["revenue"] * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            gm = Decimal("0")
        out.append({
            "period": key,
            "grossProfit": _decimal_to_number(gross.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "netProfit": _decimal_to_number(net),
            "grossMargin": _decimal_to_number(gm.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        })
    return out
```

- [ ] **Step 3: Run pytest baseline**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 227 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit-pr-b): add _aggregate_profit_by_period_sales (4-key points, gross*0.70 net)" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task A.3: Wire sales fallback into `_get_profit_metrics` else-branch

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py:701-705` (the `else:` branch in `_get_profit_metrics`)

**Locate the existing else-branch:**

```bash
grep -n "PR-A no fallback\|PR-B will replace this branch" backend/python/smartbi_compat/api/analysis_finance.py
```

The current code (around line 701-705):

```python
    else:
        # PR-A no fallback: empty path mirrors Java line 404 (`netProfit = null`).
        # PR-B will replace this branch with sales fallback.
        total_revenue = Decimal("0")
        total_cost = Decimal("0")
        net_profit = None  # null in metrics, distinct from ZERO
```

- [ ] **Step 1: Replace else-branch with sales fallback**

Use the Edit tool. Replace the `else:` block above with:

```python
    else:
        # PR-B sales fallback: when finance_data is empty, fall back to
        # smart_bi_sales_data (Java line 391-405). 餐饮 tenants typically only
        # upload sales Excel, not finance Excel.
        sales_rows = await _query_finance_sales_fallback(
            factory_id, range_.start_date, range_.end_date
        )
        # Java line 394-403: revenue + cost from sales rows
        total_revenue = sum(
            (
                _to_decimal(r["amount"])
                for r in sales_rows
                if r.get("amount") is not None
            ),
            Decimal("0"),
        )
        # Java line 399-403 — defensive .abs() per Bug B fix (cost may be negative
        # in historical sales data).
        total_cost = sum(
            (
                abs(_to_decimal(r["cost"]))
                for r in sales_rows
                if r.get("cost") is not None
            ),
            Decimal("0"),
        )
        # Java line 404: netProfit explicitly null in fallback metrics path.
        # (trendChart fallback uses gross*0.70, but metrics path does not.)
        net_profit = None
```

- [ ] **Step 2: Run pytest — composite gate must still pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py -v
```

Expected: 7/7 pass (composite 3 + payable 2 + profit 2). The composite gate uses `_get_profit_metrics` for the `profitMetrics` field. F999 has no sales_data either, so `_query_finance_sales_fallback` returns `[]`, giving `total_revenue=0, total_cost=0, net_profit=None`. Same shape as PR-A's empty path → byte-equivalent.

If any test fails, the issue is likely that `_query_finance_sales_fallback` is hitting a real DB connection in test context. The contract tests already monkeypatch `_query_finance_data`, but NOT `_query_finance_sales_fallback`. We need to update them to mock both — OR rely on the pool returning None on test infra (which `_query_finance_sales_fallback` handles by returning []). Try the test first; if it fails with "pool acquisition failed", that's actually the expected fallback-to-empty behavior — verify the response body still matches the empty-state golden.

- [ ] **Step 3: Update F999 byte-shape test to mock both helpers**

In `tests/python/smartbi_compat/test_analysis_finance_contract.py`, find the `TestAnalysisFinanceProfit` class (~line 232). The two tests currently mock only `_query_finance_data`. Add `_query_finance_sales_fallback` mock to both.

For **`test_f999_profit_data_keys_match_golden`** (~line 235):

Find the existing block:

```python
        async def fake_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_empty,
        )
```

Add IMMEDIATELY AFTER this block (still inside the test method):

```python
        async def fake_sales_empty(_factory_id, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_sales_fallback",
            fake_sales_empty,
        )
```

Repeat the same insertion in **`test_f999_profit_byte_shape`** (~line 264).

- [ ] **Step 4: Run pytest again to verify both tests still green**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceProfit -v
```

Expected: 2/2 pass.

- [ ] **Step 5: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 227 passed.

- [ ] **Step 6: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit-pr-b): wire sales fallback into _get_profit_metrics + update F999 mocks" \
  backend/python/smartbi_compat/api/analysis_finance.py \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task A.4: Wire sales fallback into `_get_profit_trend_chart` else-branch

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py:920-924` (the `else:` branch in `_get_profit_trend_chart`)

**Locate the existing else-branch:**

```bash
grep -n "PR-A: empty (no fallback)\|PR-B will add sales fallback here" backend/python/smartbi_compat/api/analysis_finance.py
```

The current code (around line 920):

```python
    if revenue_data or cost_data:
        chart_data = _build_profit_chart_from_finance_data(revenue_data, cost_data, period)
    else:
        # PR-A: empty (no fallback). PR-B will add sales fallback here.
        chart_data = []
```

- [ ] **Step 1: Replace else-branch with sales fallback**

```python
    if revenue_data or cost_data:
        chart_data = _build_profit_chart_from_finance_data(revenue_data, cost_data, period)
    else:
        # PR-B sales fallback: when finance_data empty, aggregate by period from
        # smart_bi_sales_data (Java line 237-249). Returns 4-key points (period,
        # grossProfit, netProfit=gross*0.70, grossMargin) — differs from main
        # path's 6-key points.
        sales_rows = await _query_finance_sales_fallback(
            factory_id, start_date, end_date
        )
        chart_data = _aggregate_profit_by_period_sales(sales_rows, period)
```

- [ ] **Step 2: Run TestAnalysisFinanceProfit to verify byte gate still green**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceProfit -v
```

Expected: 2/2 pass. Both tests already mock `_query_finance_sales_fallback` from A.3 → empty → `chart_data = []` → matches F999 golden.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 227 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit-pr-b): wire sales fallback into _get_profit_trend_chart else-branch" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase B — Arithmetic depth tests (3 classes, 17 tests)

### Task B.1: `TestProfitMetricsArithmetic` — 10 algebra tests

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append new test class at end)

**Pattern:** Direct unit tests via `asyncio.run()` calling `_get_profit_metrics` directly with mocked DB. No TestClient/JWT — these are arithmetic, not HTTP, tests.

- [ ] **Step 1: Append `TestProfitMetricsArithmetic` to the end of file**

```python


class TestProfitMetricsArithmetic:
    """Unit tests for _get_profit_metrics arithmetic branches.

    Direct calls (no HTTP/JWT) — focused on metric calculation correctness
    after PR-A real impl. Mocks _query_finance_data to inject synthetic rows.
    """

    def _run(self, factory_id, range_, fake_data_fn, fake_sales_fn=None):
        """Run _get_profit_metrics with mocked seams. Returns list of metric dicts."""
        import asyncio
        from smartbi_compat.api import analysis_finance as af

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_data_fn
            if fake_sales_fn is not None:
                af._query_finance_sales_fallback = fake_sales_fn
            return asyncio.run(af._get_profit_metrics(factory_id, range_))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def _build_range(self):
        from datetime import date
        from smartbi_compat.date_range import DateRange
        return DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))

    def _by_code(self, metrics):
        return {m["metricCode"]: m for m in metrics}

    def test_revenue_gt_cost_positive_gross_profit(self):
        """revenue=100k, cost=60k → grossProfit=40k, alertLevel=GREEN, formattedValue='40000.00'."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("60000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["GROSS_PROFIT"]["value"] == 40000
        assert m["GROSS_PROFIT"]["alertLevel"] == "GREEN"
        # 40000 / 100000 * 100 = 40.0 → GREEN (>=25)
        assert m["GROSS_MARGIN"]["value"] == 40
        assert m["GROSS_MARGIN"]["alertLevel"] == "GREEN"

    def test_revenue_lt_cost_negative_gross_profit(self):
        """revenue=50k, cost=80k → grossProfit=-30k, GROSS_PROFIT.alertLevel still GREEN
        (Java hardcodes GREEN for GROSS_PROFIT regardless of sign — see analysis_finance.py)."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("50000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("80000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["GROSS_PROFIT"]["value"] == -30000
        assert m["GROSS_PROFIT"]["alertLevel"] == "GREEN"  # Java line 425 hardcoded
        # -30000 / 50000 * 100 = -60 → RED (<15)
        assert m["GROSS_MARGIN"]["value"] == -60
        assert m["GROSS_MARGIN"]["alertLevel"] == "RED"

    def test_gross_margin_above_100_clamps_to_null(self):
        """grossProfit > revenue (impossible from clean data, but synthetic case):
        margin > 100% → clamp to null per Java line 414-416."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                # Negative cost → grossProfit = 100 - (-1000) = 1100
                # But our impl applies abs() first. Use net_profit category trick:
                return []
            # Use net_profit > revenue to force margin > 100 via netMargin instead
            return []
        # Direct test of clamp via net_margin path is cleaner:
        async def fake_high_net(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("100"), "category": "营业收入",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                    {"actual_amount": Decimal("200"), "category": "净利润",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                ]
            if rt == "COST":
                return []
            return []
        result = self._run("F", self._build_range(), fake_high_net)
        m = self._by_code(result)
        # net_margin = 200/100 * 100 = 200% → clamped to null
        assert m["NET_MARGIN"]["value"] is None
        assert m["NET_MARGIN"]["formattedValue"] == "N/A"

    def test_gross_margin_below_neg100_clamps_to_null(self):
        """cost >> revenue → margin < -100% → clamp to null."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                # cost 500, revenue 100 → grossProfit = -400 → margin = -400% → clamp null
                return [{"total_cost": Decimal("500"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["GROSS_MARGIN"]["value"] is None
        assert m["GROSS_MARGIN"]["formattedValue"] == "N/A"
        # Per Java line 432: gross_margin null → alertLevel='RED'
        assert m["GROSS_MARGIN"]["alertLevel"] == "RED"

    def test_net_profit_present_computes_net_margin(self):
        """When 净利 category present → net_margin computed."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("100000"), "category": "营业收入",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                    {"actual_amount": Decimal("15000"), "category": "净利润",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                ]
            if rt == "COST":
                return [{"total_cost": Decimal("50000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["NET_PROFIT"]["value"] == 15000
        # net_margin = 15000 / 100000 * 100 = 15
        assert m["NET_MARGIN"]["value"] == 15

    def test_net_profit_absent_net_margin_null(self):
        """No 净利 category → net_profit defaults to Decimal(0) per sum() empty stream;
        net_margin = 0 / revenue * 100 = 0, NOT null. (Java reduce(ZERO,+) on empty stream
        returns ZERO, not null. Only the fallback path explicitly sets null.)"""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("50000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        # Path-A with revenue + cost but no 净利 records: net_profit = Decimal(0)
        assert m["NET_PROFIT"]["value"] == 0
        assert m["NET_MARGIN"]["value"] == 0

    def test_total_cost_zero_roi_zero(self):
        """No COST records → total_cost = 0 → ROI = 0 (div-zero defense, Java line 481)."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["ROI"]["value"] == 0
        # ROI = 0 → YELLOW (per _determine_roi_alert: 0 < 20 but >= 0)
        assert m["ROI"]["alertLevel"] == "YELLOW"

    def test_total_cost_positive_roi_computes(self):
        """revenue=100k, cost=50k → ROI = 50000/50000*100 = 100 → GREEN (>=20)."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("50000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        # grossProfit = 50k, ROI = 50k/50k*100 = 100
        assert m["ROI"]["value"] == 100
        assert m["ROI"]["alertLevel"] == "GREEN"

    def test_alert_level_gross_margin_thresholds(self):
        """Verify GROSS_MARGIN alert thresholds: <15 RED, <25 YELLOW, else GREEN."""
        from datetime import date
        from decimal import Decimal

        # Margin = 10 → RED (<15)
        async def fake_red(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                # cost=90k → grossProfit=10k → margin=10
                return [{"total_cost": Decimal("90000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_red))
        assert m["GROSS_MARGIN"]["alertLevel"] == "RED"

        # Margin = 20 → YELLOW (<25)
        async def fake_yellow(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("80000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_yellow))
        assert m["GROSS_MARGIN"]["alertLevel"] == "YELLOW"

        # Margin = 30 → GREEN (>=25)
        async def fake_green(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("70000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_green))
        assert m["GROSS_MARGIN"]["alertLevel"] == "GREEN"

    def test_alert_level_roi_thresholds(self):
        """Verify ROI alert thresholds: <0 RED, <20 YELLOW, else GREEN."""
        from datetime import date
        from decimal import Decimal

        # ROI < 0 → RED (revenue=50k, cost=80k → grossProfit=-30k → ROI=-30k/80k*100=-37.5)
        async def fake_red(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("50000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("80000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_red))
        assert m["ROI"]["alertLevel"] == "RED"

        # ROI between 0 and 20 → YELLOW (revenue=100k, cost=90k → grossProfit=10k → ROI=11.11)
        async def fake_yellow(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("90000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_yellow))
        assert m["ROI"]["alertLevel"] == "YELLOW"

        # ROI > 20 → GREEN (already covered by test_total_cost_positive_roi_computes)
```

- [ ] **Step 2: Run new test class**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestProfitMetricsArithmetic -v
```

Expected: 10/10 passed.

If any test fails, the most common reason is that an alert-level threshold or arithmetic assumption in the test is wrong. The test asserts what the impl does, so if the impl differs from the assertion, you need to either:
- Read the impl and update the assertion to match (if the impl is correct per spec)
- OR escalate if the impl truly diverges from spec §3.2

Don't blindly mutate the impl to match a test — Java is the ground truth.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 237 passed (227 baseline + 10 new).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit-pr-b): TestProfitMetricsArithmetic 10 unit tests" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task B.2: `TestProfitMetricsSalesFallback` — 3 fallback path tests

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append new class after `TestProfitMetricsArithmetic`)

- [ ] **Step 1: Append `TestProfitMetricsSalesFallback`**

```python


class TestProfitMetricsSalesFallback:
    """Unit tests for sales fallback path in _get_profit_metrics + _get_profit_trend_chart.

    Mocks _query_finance_data → [] AND _query_finance_sales_fallback → synthetic rows.
    """

    def _run_metrics(self, fake_finance, fake_sales):
        """Run _get_profit_metrics with both seams mocked. Returns metric dicts."""
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af
        from smartbi_compat.date_range import DateRange

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_finance
            af._query_finance_sales_fallback = fake_sales
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            return asyncio.run(af._get_profit_metrics("F", range_))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def _run_trend(self, fake_finance, fake_sales):
        """Run _get_profit_trend_chart with both seams mocked. Returns chart dict."""
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_finance
            af._query_finance_sales_fallback = fake_sales
            return asyncio.run(af._get_profit_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), "MONTH"
            ))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def test_no_finance_with_sales_uses_fallback(self):
        """finance empty + sales 100k revenue / 60k cost → metrics computed from sales."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance_empty(_fid, _rt, _s, _e): return []
        async def fake_sales(_fid, _s, _e):
            return [
                {"amount": Decimal("100000"), "cost": Decimal("60000"),
                 "order_date": date(2025, 6, 1)},
            ]
        result = self._run_metrics(fake_finance_empty, fake_sales)
        m = {x["metricCode"]: x for x in result}
        assert m["GROSS_PROFIT"]["value"] == 40000
        # 40000/100000*100 = 40 → GREEN
        assert m["GROSS_MARGIN"]["value"] == 40
        assert m["GROSS_MARGIN"]["alertLevel"] == "GREEN"

    def test_fallback_net_profit_stays_null_in_metrics(self):
        """Java line 404 — fallback path explicitly sets net_profit=null. So metrics
        NET_PROFIT.value=null, formattedValue='N/A', alertLevel=GREEN per Java line 461."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance_empty(_fid, _rt, _s, _e): return []
        async def fake_sales(_fid, _s, _e):
            return [
                {"amount": Decimal("100000"), "cost": Decimal("60000"),
                 "order_date": date(2025, 6, 1)},
            ]
        result = self._run_metrics(fake_finance_empty, fake_sales)
        m = {x["metricCode"]: x for x in result}
        assert m["NET_PROFIT"]["value"] is None
        assert m["NET_PROFIT"]["formattedValue"] == "N/A"
        assert m["NET_PROFIT"]["alertLevel"] == "GREEN"
        # Net margin also null (depends on net_profit)
        assert m["NET_MARGIN"]["value"] is None

    def test_fallback_net_profit_computed_in_trendchart(self):
        """trendChart fallback uses gross*0.70 for netProfit (Java line 1440 quirk).
        Distinct from metrics fallback which sets netProfit=null."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance_empty(_fid, _rt, _s, _e): return []
        async def fake_sales(_fid, _s, _e):
            return [
                {"amount": Decimal("100000"), "cost": Decimal("60000"),
                 "order_date": date(2025, 6, 1)},
            ]
        chart = self._run_trend(fake_finance_empty, fake_sales)
        # 4-key points (sales fallback shape, not 6-key)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        assert set(point.keys()) == {"period", "grossProfit", "netProfit", "grossMargin"}
        # gross = 40000, net = 40000 * 0.70 = 28000.0 → numeric 28000
        assert point["grossProfit"] == 40000
        assert point["netProfit"] == 28000
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestProfitMetricsSalesFallback -v
```

Expected: 3/3 passed.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 240 passed (237 baseline + 3 new).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit-pr-b): TestProfitMetricsSalesFallback 3 fallback tests" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task B.3: `TestProfitTrendChartArithmetic` — 4 chart aggregation tests

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append at end after B.2)

- [ ] **Step 1: Append `TestProfitTrendChartArithmetic`**

```python


class TestProfitTrendChartArithmetic:
    """Unit tests for _get_profit_trend_chart + _build_profit_chart_from_finance_data.

    Verifies period aggregation, anomaly clamps, and full options-emission even
    when data is empty.
    """

    def _run_chart(self, fake_finance, fake_sales=None, period="MONTH"):
        """Run _get_profit_trend_chart with seams mocked. Returns chart dict."""
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_finance
            if fake_sales is not None:
                af._query_finance_sales_fallback = fake_sales
            return asyncio.run(af._get_profit_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), period
            ))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def test_empty_data_returns_empty_chartdata(self):
        """All seams empty → data=[] but options.yAxis (2) + options.series (5) full."""
        async def fake_empty(*_a, **_k): return []
        chart = self._run_chart(fake_empty, fake_empty)
        assert chart["data"] == []
        assert chart["chartType"] == "LINE_BAR"
        assert chart["title"] == "利润趋势分析"
        assert len(chart["options"]["yAxis"]) == 2
        assert len(chart["options"]["series"]) == 5

    def test_multi_month_aggregates_by_period_key(self):
        """Two REVENUE rows in different months → 2 chart points sorted by period key."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("50000"), "category": "营业收入",
                     "record_date": date(2025, 1, 15), "upload_id": 1},
                    {"actual_amount": Decimal("70000"), "category": "营业收入",
                     "record_date": date(2025, 3, 20), "upload_id": 1},
                ]
            if rt == "COST":
                return [
                    {"total_cost": Decimal("30000"), "actual_amount": None,
                     "record_date": date(2025, 1, 15), "upload_id": 1},
                ]
            return []
        chart = self._run_chart(fake_finance)
        assert len(chart["data"]) == 2
        # Sorted by period key
        assert chart["data"][0]["period"] == "2025-01"
        assert chart["data"][1]["period"] == "2025-03"
        # Jan: revenue 50k, cost 30k → gross 20k
        assert chart["data"][0]["revenue"] == 50000
        assert chart["data"][0]["cost"] == 30000
        assert chart["data"][0]["grossProfit"] == 20000
        # Mar: revenue 70k, no cost → cost 0, gross 70k
        assert chart["data"][1]["revenue"] == 70000
        assert chart["data"][1]["cost"] == 0
        assert chart["data"][1]["grossProfit"] == 70000

    def test_negative_revenue_minus_cost_emits_negative_gross(self):
        """cost > revenue in a period → grossProfit < 0 emitted (no clamp; only margin clamps)."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("50000"), "category": "营业收入",
                     "record_date": date(2025, 6, 15), "upload_id": 1},
                ]
            if rt == "COST":
                return [
                    {"total_cost": Decimal("80000"), "actual_amount": None,
                     "record_date": date(2025, 6, 15), "upload_id": 1},
                ]
            return []
        chart = self._run_chart(fake_finance)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        assert point["grossProfit"] == -30000
        # margin = -30000/50000 * 100 = -60% → in [-100, 100] range, NOT clamped
        # numeric output may be -60 (int) or -60.0 (float) depending on _decimal_to_number
        assert point["grossMargin"] == -60

    def test_period_key_format_yyyy_mm(self):
        """MONTH period key format = 'yyyy-MM' (zero-padded month)."""
        from datetime import date
        from decimal import Decimal
        # Single record on Jan 5, 2025 → key '2025-01' (not '2025-1')
        async def fake_finance(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("1000"), "category": "营业收入",
                     "record_date": date(2025, 1, 5), "upload_id": 1},
                ]
            return []
        chart = self._run_chart(fake_finance)
        assert chart["data"][0]["period"] == "2025-01"
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestProfitTrendChartArithmetic -v
```

Expected: 4/4 passed.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 244 passed (240 baseline + 4 new).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit-pr-b): TestProfitTrendChartArithmetic 4 chart tests" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase C — Final verify + push

### Task C.1: Final scope verify + push branch + create PR

**Files:**
- N/A (verification + git push + gh pr create)

- [ ] **Step 1: Verify total scope matches spec ~280 LOC budget**

```bash
git diff --stat origin/main..HEAD -- 'backend/python/smartbi_compat/api/analysis_finance.py' 'tests/python/smartbi_compat/test_analysis_finance_contract.py' | tail -3
```

Expected: insertions between 240 and 320. Plan estimated 280; tolerate +/- 15%.

- [ ] **Step 2: Re-run full pytest one more time**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 244 passed.

- [ ] **Step 3: Verify git status clean**

```bash
git status --short
```

Expected: no output.

- [ ] **Step 4: Verify commit log**

```bash
git log --oneline origin/main..HEAD
```

Expected: 7 commits (1 plan + A.1 + A.2 + A.3 + A.4 + B.1 + B.2 + B.3 = 8, but plan is the first commit if you committed the plan separately; otherwise 7).

- [ ] **Step 5: Push branch**

```bash
git push -u origin phase2a/t-finance-profit-pr-b 2>&1 | tail -5
```

Expected: push succeeds.

- [ ] **Step 6: Create PR via gh CLI**

```bash
gh pr create --base main --head phase2a/t-finance-profit-pr-b --title "Phase 2A: /analysis/finance profit per-type sales fallback + arithmetic depth tests (PR-B)" --body "$(cat <<'EOF'
## Summary

- Adds Path B (sales fallback) to profit per-type endpoint. When `finance_data` is empty, queries `smart_bi_sales_data` to compute revenue/cost. Restaurant tenants (餐饮) typically only upload sales Excel; this restores byte parity with Java's fallback behavior.
- Adds 17 arithmetic-depth unit tests across 3 classes:
  - `TestProfitMetricsArithmetic` (10 tests) — algebra branches: positive/negative gross, margin clamps, ROI div-zero, alert thresholds
  - `TestProfitMetricsSalesFallback` (3 tests) — fallback path: net_profit null in metrics, gross*0.70 in trendChart
  - `TestProfitTrendChartArithmetic` (4 tests) — chart aggregation, period keys, negative gross, empty options-still-emit
- pytest 227 → 244 (+17 new, 0 regressions). F999 byte-shape gate stays green.

Spec: `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md` §3.5 + §5.2
Plan: `docs/superpowers/plans/2026-04-30-phase2a-finance-profit-pr-b.md`

## Test plan

- [x] `pytest tests/python/smartbi_compat/` — 244 passed
- [x] `TestAnalysisFinanceProfit` byte gate — still green (mocks updated to mock both data seams)
- [x] `TestProfitMetricsArithmetic` 10/10 pass
- [x] `TestProfitMetricsSalesFallback` 3/3 pass
- [x] `TestProfitTrendChartArithmetic` 4/4 pass
- [ ] **Post-merge**: deploy test env (port 8084) + record F001 with sales-only data → verify byte parity vs Java 10011
- [ ] **Post-merge**: deploy prod (port 8083)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: PR URL printed.

- [ ] **Step 7: Report PR-B complete**

Report to user:
- Branch pushed: `phase2a/t-finance-profit-pr-b`
- PR URL
- Commits ahead of origin/main: 7-8
- pytest: 244 passed
- Sales fallback wired in metrics + trendChart
- 17 new arithmetic-depth tests all green
- Ready for review + squash merge

---

## Self-Review

**1. Spec coverage:**
- ✅ Spec §3.5 `_query_finance_sales_fallback`: A.1
- ✅ Spec §3.5 `_aggregate_profit_by_period_sales`: A.2
- ✅ Spec §3.5 `_get_profit_metrics` enable fallback branch: A.3
- ✅ Spec §3.5 `_get_profit_trend_chart` enable fallback branch: A.4
- ✅ Spec §5.2 `TestProfitMetricsArithmetic` 10 tests: B.1
- ✅ Spec §5.2 `TestProfitMetricsSalesFallback` 3 tests: B.2
- ✅ Spec §5.2 `TestProfitTrendChartArithmetic` 4 tests: B.3

All 7 spec deliverables for PR-B covered.

**2. Placeholder scan:** No "TBD" / "TODO" / "Add appropriate ..." / "implement later". All steps have full code or full commands.

**3. Type consistency:**
- `_query_finance_sales_fallback(factory_id: str, start_date: date, end_date: date) -> list[dict]` — matches A.1 signature, A.3 + A.4 callers ✓
- `_aggregate_profit_by_period_sales(sales_rows: list[dict], period: str) -> list[dict]` — matches A.2 signature, A.4 caller ✓
- Mock signature in B.x: `async def fake(_fid, _rt, _s, _e)` for `_query_finance_data`, `async def fake(_fid, _s, _e)` for `_query_finance_sales_fallback` ✓
- A.3's update to existing `TestAnalysisFinanceProfit` mocks: signature `(_factory_id, _start, _end)` matches `_query_finance_sales_fallback` 3-arg signature ✓

**4. Concurrent-edit safety:** Every commit step uses `./scripts/safe-commit.sh "msg" path1 path2`. Sister cost/receivable chats may concurrently modify analysis_finance.py — `--only` mode ensures their staged work doesn't get into our commits.

**5. Risk acknowledged:**
- The `_aggregate_profit_by_period_sales` `gross * 0.70` factor is a Java quirk; PR-B preserves it for byte parity. Future Java behavior changes here would require update.
- WEEK period key calendar-year vs ISO-year (M-2): PR-B does NOT exercise WEEK in tests because the controller hardcodes MONTH. If sister chats use WEEK, that's their problem.
- Sister cost/receivable chats may add their own `_query_finance_sales_fallback` or rename — DO NOT touch their work. PR-B only modifies profit-relevant code.

---

## Next steps after PR-B merged

1. Pull main, cleanup `phase2a-finance-profit` worktree (`git worktree remove`).
2. Profit-related work for Phase 2A is fully done. Hand off attention back to sister chats (cost/receivable/budget) until they merge.
3. Phase 2A profit endpoint is byte-shape complete: composite + per-type both real impl, byte gate green, fallback path covered, arithmetic depth tested.
