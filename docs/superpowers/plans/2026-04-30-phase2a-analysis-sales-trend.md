# Phase 2A `/analysis/sales` Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `_get_sales_trend_chart` stub in `backend/python/smartbi_compat/api/analysis_sales.py` with real impl that buckets `(order_date, amount)` rows into daily totals + assembles a 7-key `ChartConfig` dict. Mirrors Java `SalesAnalysisServiceImpl.getSalesTrendChart` line 597-607 + `aggregateByDay` line 911-921.

**Architecture:**
- **Pure-helper bucketing**: `_bucket_sales_by_period(rows, period) → dict[bucket_key, Decimal]` is a sync pure function with no I/O. Testable in isolation.
- **DAY-only port**: composite always passes `period="DAY"`. WEEK/MONTH/YEAR raise `NotImplementedError` per spec §5 (smallest possible scope).
- **REUSE foundation factory**: `_new_chart_config_dict(...)` already produces the 7-key dict in correct Jackson order (chartType/title/seriesField/data/options/xaxisField/yaxisField). Verified in foundation+gold ship.
- **REUSE Decimal helpers**: `_to_decimal(v)` from foundation, `_decimal_to_number(v)` from foundation/gold (Decimal→JSON Number for byte parity). Already used in overview+gold builders.

**Tech Stack:** Python 3 / `decimal.Decimal` (ROUND_HALF_UP) / `datetime.date` / pytest / `unittest.mock` (no async required for the helper)

**Estimate:** ~2-3h, 6-7 tasks across 3 phases (Phase D deploy + golden re-record DEFERRED to end of A→B batch).

**Branch / Worktree:** `phase2a/sales-trend` derived from `phase2a/sales-rankings` HEAD `3de09090b` (chained — trend's branch contains rankings work). Sub-worktree at `.worktrees/phase2a-sales-trend`.

**Critical rules:**
1. **Concurrent-edit safety**: every commit uses `git commit -m "msg" -- <paths>` (`--only` mode).
2. **NO Java modifications**: Python-side only.
3. **Chained from rankings**: baseline pytest is 239 (rankings work merged in our branch ancestry). After trend ships, total = 239 + trend tests.
4. **TDD per task**: write failing test → run to fail → impl → run to pass → commit.
5. **No regression**: 239 tests must stay green at end of Phase B and Phase C.
6. **Phase D deploy + golden re-record**: DEFERRED per user instruction — batch with rankings at end of Phase 2A sales endpoint A→B sequence.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_sales.py` | MODIFY (~80 LOC) | Add `_bucket_sales_by_period` + `_format_bucket_key` helpers; replace `_get_sales_trend_chart` stub body |
| `tests/python/smartbi_compat/test_analysis_sales_contract.py` | MODIFY (append `TestTrend` class) | 4-5 tests covering DAY bucketing + empty F999 + F001 byte + unsupported period |

**File size after trend**: analysis_sales.py grows from ~1599 → ~1680 LOC. Test file grows from ~1490 → ~1620 LOC. Within acceptable single-file scope.

---

## Phase A — Pre-impl checks (~10-15 min, 1 task)

### Task A.1: Verify worktree + baseline + stub locations + helper inventory

**Files:**
- Read-only: `backend/python/smartbi_compat/api/analysis_sales.py`
- Read-only: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

- [ ] **Step 1: Worktree state**

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-sales-trend
pwd                              # ends in -sales-trend
git rev-parse --abbrev-ref HEAD  # phase2a/sales-trend
git log --oneline -1             # 3de09090b (rankings C.2 commit, chained ancestor)
git status --short               # empty
```

- [ ] **Step 2: Baseline pytest (must pass 239)**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/ -q --tb=line 2>&1 | tail -5
```

Expected: 239 PASS (223 origin/main + 16 TestRankings from Phase B+C of rankings).

If less than 239 or any failures, STOP — investigate.

- [ ] **Step 3: Locate `_get_sales_trend_chart` stub**

```bash
grep -nA15 "^async def _get_sales_trend_chart" backend/python/smartbi_compat/api/analysis_sales.py
```

Expected: stub at ~line 660-674 (foundation+gold), returns the empty-state ChartConfig:
```python
return _new_chart_config_dict(
    chart_type="LINE",
    title="销售趋势",
    xaxis_field="date",
    yaxis_field="amount",
    data=[],
    options={"showDataLabels": False, "smooth": True},
)
```

If body differs (e.g. real impl already exists), STOP.

- [ ] **Step 4: Verify reusable helpers exist (REUSE these)**

```bash
grep -nE "^def _new_chart_config_dict|^def _to_decimal\b|^def _decimal_to_number\b" backend/python/smartbi_compat/api/analysis_sales.py
```

Expected:
- `_new_chart_config_dict(chart_type, title, ...)` — 7-key factory (foundation)
- `_to_decimal(v)` — tolerant Decimal coercion (foundation)
- `_decimal_to_number(v)` — Decimal→JSON Number for byte parity (foundation/gold)

If any missing, STOP — plan assumes reusable.

- [ ] **Step 5: Verify `_query_sales_data` returns rows with `order_date` attribute**

```bash
grep -nA5 "^def _query_sales_data" backend/python/smartbi_compat/api/analysis.py | head -10
```

Confirm SQL includes `order_date` column. Also verify the row mapping (tuple vs Row vs dict access pattern).

```bash
grep -n "row\.order_date\|row\[.order_date" backend/python/smartbi_compat/api/analysis_sales.py | head -3
```

If existing code elsewhere uses `row.order_date` (attribute access — SQLAlchemy Row), trend can use same pattern. If existing code uses `row["order_date"]` (dict access), use that.

- [ ] **Step 6: Resolve §6 R4 (`order_date` type — date vs string)**

Quick smoke check via Python REPL or read existing usage:

```bash
grep -nB2 -A5 "order_date" backend/python/smartbi_compat/api/analysis_sales.py | head -30
```

Look at existing usages in `_build_legacy_trend_chart` (added by overview impl). Per overview impl pattern (verified in PR #15):

```python
"date": d.isoformat() if hasattr(d, "isoformat") else str(d),
```

This handles both `datetime.date` and string. **Mirror this pattern in trend's `_format_bucket_key`** — defensive against type variance.

- [ ] **Step 7: No commit — verification only.**

If everything ✅, report DONE and Phase B can proceed. If anything ❌, BLOCKED with findings.

---

## Phase B — Implementation (~60-90 min, 3 tasks)

### Task B.1: Add `_format_bucket_key(date, period) -> str` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Pure function: given a date object (or date-string fallback) + period string, return ISO-formatted bucket key. DAY only; WEEK/MONTH/YEAR raise `NotImplementedError` per spec §5.

- [ ] **Step 1: Append failing tests to test_analysis_sales_contract.py**

The test class `TestTrend` doesn't exist yet — create it as part of this task.

```python
# ============================================================
# TestTrend — trend sub-spec contract tests (DAY-only port)
# ============================================================


class TestTrend:
    """Sibling sub-spec: trend. DAY bucketing only per spec §5.

    Foundation gates TestEnvelope; gold gates TestGold; overview gates TestOverview;
    rankings gates TestRankings; trend (this class) gates _get_sales_trend_chart real impl.
    """

    def test_format_bucket_key_DAY_from_date_object(self):
        """date object → ISO YYYY-MM-DD string."""
        from smartbi_compat.api.analysis_sales import _format_bucket_key
        from datetime import date
        assert _format_bucket_key(date(2025, 3, 15), "DAY") == "2025-03-15"
        assert _format_bucket_key(date(2025, 12, 1), "DAY") == "2025-12-01"

    def test_format_bucket_key_DAY_from_string_fallback(self):
        """If row.order_date is already a string, return as-is (defensive)."""
        from smartbi_compat.api.analysis_sales import _format_bucket_key
        # Defensive: SQLAlchemy may return string in some configurations
        assert _format_bucket_key("2025-03-15", "DAY") == "2025-03-15"

    def test_format_bucket_key_unsupported_period_raises(self):
        """WEEK/MONTH/YEAR not implemented per spec §5."""
        from smartbi_compat.api.analysis_sales import _format_bucket_key
        from datetime import date
        import pytest
        for period in ("WEEK", "MONTH", "YEAR"):
            with pytest.raises(NotImplementedError, match="not supported"):
                _format_bucket_key(date(2025, 3, 15), period)

    def test_format_bucket_key_case_insensitive(self):
        """period accepts 'day' or 'DAY' (case-insensitive — Java uses .toUpperCase())."""
        from smartbi_compat.api.analysis_sales import _format_bucket_key
        from datetime import date
        assert _format_bucket_key(date(2025, 3, 15), "day") == "2025-03-15"
        assert _format_bucket_key(date(2025, 3, 15), "Day") == "2025-03-15"
```

- [ ] **Step 2: Run tests to verify FAIL**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v
```

Expected: 4 FAIL with `AttributeError` (no `_format_bucket_key` yet).

- [ ] **Step 3: Add `_format_bucket_key` to analysis_sales.py**

Insert near the existing `_build_legacy_trend_chart` (Section 3b — gold builders) so all trend-related code lives close together. Or create a new "Section 4.5: Trend bucketing helpers" — pick what fits the existing structure.

Look at the file structure around Section 4 (composite + route). Insert before that section, after the legacy builders:

```python
# ============================================================
# Section 3c: Trend bucketing helpers (trend sub-spec)
# ============================================================
# Mirror Java SalesAnalysisServiceImpl.aggregateByDay line 911-921.
# DAY-only port per trend spec §5; WEEK/MONTH/YEAR raise NotImplementedError.


def _format_bucket_key(d, period: str) -> str:
    """Format a date into a bucket key string.

    Mirror Java aggregateByDay line 915: `d.getOrderDate().toString()` produces
    ISO YYYY-MM-DD. Java aggregateByWeek line 932-933 / aggregateByMonth line
    949-950 not ported per spec §5.

    Args:
        d: datetime.date OR date-like string (SQLAlchemy may return either)
        period: "DAY" only; case-insensitive

    Returns:
        ISO date string (e.g. "2025-03-15")

    Raises:
        NotImplementedError: for any period other than DAY
    """
    if period.upper() != "DAY":
        raise NotImplementedError(
            f"trend chart period='{period}' not supported; only DAY is "
            f"used by /analysis/sales composite. See spec §5."
        )
    # Defensive: SQLAlchemy Row.order_date may be datetime.date or string
    if hasattr(d, "isoformat"):
        return d.isoformat()
    return str(d)
```

- [ ] **Step 4: Run tests to verify PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-trend): add _format_bucket_key helper (DAY-only ISO YYYY-MM-DD; WEEK/MONTH/YEAR raise NotImplementedError per spec §5)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.2: Add `_bucket_sales_by_period(rows, period)` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Pure function: aggregate sales rows by period bucket. Skip NULL `order_date` (Java line 913 filter). Sum amounts. Return chronologically-sorted dict (ASC by key).

- [ ] **Step 1: Append failing tests**

```python
    def test_bucket_sales_DAY_aggregates_per_date(self):
        """5 rows on 3 distinct dates → 3 buckets, summed, sorted ASC."""
        from smartbi_compat.api.analysis_sales import _bucket_sales_by_period
        from datetime import date
        from decimal import Decimal

        class _Row:
            def __init__(self, order_date, amount):
                self.order_date = order_date
                self.amount = amount

        rows = [
            _Row(date(2025, 3, 15), Decimal("100.00")),
            _Row(date(2025, 3, 15), Decimal("50.00")),
            _Row(date(2025, 3, 14), Decimal("200.00")),
            _Row(date(2025, 3, 16), Decimal("75.50")),
            _Row(None, Decimal("999.99")),  # NULL order_date → skip per Java line 913
        ]

        result = _bucket_sales_by_period(rows, "DAY")

        # Sorted ASC by ISO key (chronological)
        assert list(result.keys()) == ["2025-03-14", "2025-03-15", "2025-03-16"]
        assert result["2025-03-14"] == Decimal("200.00")
        assert result["2025-03-15"] == Decimal("150.00")  # 100+50
        assert result["2025-03-16"] == Decimal("75.50")

    def test_bucket_sales_empty_rows(self):
        """Empty input → empty dict."""
        from smartbi_compat.api.analysis_sales import _bucket_sales_by_period
        result = _bucket_sales_by_period([], "DAY")
        assert result == {}

    def test_bucket_sales_all_null_order_date(self):
        """All rows have NULL order_date → empty dict (all filtered)."""
        from smartbi_compat.api.analysis_sales import _bucket_sales_by_period
        from decimal import Decimal

        class _Row:
            def __init__(self, order_date, amount):
                self.order_date = order_date
                self.amount = amount

        rows = [_Row(None, Decimal("100")), _Row(None, Decimal("200"))]
        result = _bucket_sales_by_period(rows, "DAY")
        assert result == {}

    def test_bucket_sales_null_amount_treated_as_zero(self):
        """Defensive: row with NULL amount contributes 0 to sum (Java's reducer
        tolerates null via getOrDefault; Python uses _to_decimal coercion)."""
        from smartbi_compat.api.analysis_sales import _bucket_sales_by_period
        from datetime import date
        from decimal import Decimal

        class _Row:
            def __init__(self, order_date, amount):
                self.order_date = order_date
                self.amount = amount

        rows = [
            _Row(date(2025, 3, 15), Decimal("100")),
            _Row(date(2025, 3, 15), None),  # NULL amount → 0 contribution
        ]
        result = _bucket_sales_by_period(rows, "DAY")
        assert result == {"2025-03-15": Decimal("100")}
```

- [ ] **Step 2: pytest → expect 4 FAIL**

- [ ] **Step 3: Add `_bucket_sales_by_period` to analysis_sales.py (after `_format_bucket_key`)**

```python
def _bucket_sales_by_period(rows, period: str) -> dict:
    """Aggregate sales rows into buckets by period.

    Mirror Java SalesAnalysisServiceImpl.aggregateByDay line 911-921:
    - Filter rows where `order_date IS NULL` (Java line 913)
    - Group by formatted bucket key (e.g. ISO date string for DAY)
    - Sum amounts per bucket
    - Return TreeMap-equivalent: dict sorted ASC by key

    Args:
        rows: iterable of Row-like objects with `order_date` and `amount` attrs
        period: "DAY" only (delegates raise to _format_bucket_key)

    Returns:
        dict[bucket_key, Decimal] sorted ASC by key. Empty dict for empty input
        or all-null input.
    """
    unsorted: dict = {}
    for row in rows:
        if row.order_date is None:
            continue  # Java line 913 filter
        key = _format_bucket_key(row.order_date, period)
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        unsorted[key] = unsorted.get(key, Decimal("0")) + amount
    # Sort ASC by key (Python ≥3.7 preserves dict insertion order)
    return dict(sorted(unsorted.items()))
```

- [ ] **Step 4: pytest → expect 4 PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v -k "bucket_sales"
```

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-trend): add _bucket_sales_by_period helper (DAY aggregation, skip NULL order_date, ASC sort, defensive null amount)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.3: Replace `_get_sales_trend_chart` stub body with real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Real impl wires `_bucket_sales_by_period` + `_new_chart_config_dict` factory. Mirrors Java line 597-607 + 868-906.

- [ ] **Step 1: Append failing tests**

```python
    @pytest.mark.asyncio
    async def test_get_sales_trend_chart_DAY_full_path(self, monkeypatch):
        """Full path: query rows → bucket → ChartConfig with non-empty data."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal
        from collections import namedtuple

        Row = namedtuple("Row", "salesperson_name amount monthly_target product_category customer_name order_date")

        def fake_query(factory_id, range_):
            return [
                Row("X", Decimal("100"), None, "P", "C", date(2025, 3, 15)),
                Row("X", Decimal("50"), None, "P", "C", date(2025, 3, 15)),
                Row("X", Decimal("200"), None, "P", "C", date(2025, 3, 14)),
            ]

        monkeypatch.setattr(m, "_query_sales_data", fake_query)

        range_ = m.DateRange.custom(date(2025, 3, 1), date(2025, 3, 31))
        result = await m._get_sales_trend_chart("F999", range_, "DAY")

        # 7-key ChartConfig
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"
        assert result["seriesField"] is None
        assert result["options"] == {"showDataLabels": False, "smooth": True}
        # data sorted ASC, 2 buckets
        data = result["data"]
        assert len(data) == 2
        assert data[0]["date"] == "2025-03-14"
        assert data[0]["amount"] == Decimal("200.00")
        assert data[1]["date"] == "2025-03-15"
        assert data[1]["amount"] == Decimal("150.00")  # 100+50

    @pytest.mark.asyncio
    async def test_get_sales_trend_chart_empty_returns_empty_data(self, monkeypatch):
        """Empty rows → ChartConfig with data=[]."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date

        monkeypatch.setattr(m, "_query_sales_data", lambda f, r: [])

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        result = await m._get_sales_trend_chart("F999", range_, "DAY")

        assert result["chartType"] == "LINE"
        assert result["data"] == []
        assert result["options"] == {"showDataLabels": False, "smooth": True}

    @pytest.mark.asyncio
    async def test_get_sales_trend_chart_unsupported_period_raises(self, monkeypatch):
        """WEEK/MONTH/YEAR raise NotImplementedError before any DB call."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        import pytest

        # Spy: query should NOT be called
        called = {"count": 0}
        def fake_query(f, r):
            called["count"] += 1
            return []
        monkeypatch.setattr(m, "_query_sales_data", fake_query)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        for period in ("WEEK", "MONTH", "YEAR"):
            with pytest.raises(NotImplementedError, match="not supported"):
                await m._get_sales_trend_chart("F999", range_, period)

        assert called["count"] == 0  # Raise BEFORE query — fail fast
```

NOTE: The 3rd test asserts query is NOT called for unsupported periods. This requires the function to raise BEFORE doing the query. Implementation must check period first.

- [ ] **Step 2: pytest → expect 3 FAIL (current stub returns empty ChartConfig regardless of inputs, so first test fails on data assertion, second passes accidentally, third fails because no raise)**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v -k "get_sales_trend_chart"
```

- [ ] **Step 3: Locate and replace `_get_sales_trend_chart` stub**

Find the existing function:

```bash
grep -nA20 "^async def _get_sales_trend_chart" backend/python/smartbi_compat/api/analysis_sales.py
```

Replace the body (signature stays):

```python
async def _get_sales_trend_chart(
    factory_id: str, range_: DateRange, period: str = "DAY",
) -> dict:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getSalesTrendChart line 597-607
    + buildSalesTrendChartFromData line 868-906.

    DAY-only port per trend spec §5; raise BEFORE query for unsupported periods
    (fail fast — no wasted DB call).

    async per foundation §5: sync `_query_sales_data` wrapped via `await asyncio.to_thread(...)`.
    """
    # Fail fast: raise before query for unsupported periods
    if period.upper() != "DAY":
        raise NotImplementedError(
            f"trend chart period='{period}' not supported; only DAY is "
            f"used by /analysis/sales composite. See spec §5."
        )

    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    period_sales = _bucket_sales_by_period(rows, period)

    data_points = [
        {
            "date": key,
            "amount": amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }
        for key, amount in period_sales.items()
    ]

    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=data_points,
        options={"showDataLabels": False, "smooth": True},
    )
```

- [ ] **Step 4: pytest → expect 3 PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v
```

Expected: All 11 TestTrend tests pass (B.1=4 + B.2=4 + B.3=3 = 11).

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-trend): replace _get_sales_trend_chart stub with real impl (DAY bucketing + ChartConfig assembly, fail-fast for unsupported periods)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

## Phase C — Tests + verification (~30-45 min, 2 tasks)

### Task C.1: Add F001/F999 byte-shape regression tests via route

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Add route-level tests asserting `data.trendChart` matches the established empty-state shape on both F001 (no data) and F999 (cleared data). This catches regressions from any future helper change.

- [ ] **Step 1: Identify fixture pattern**

Look at how TestRankings did F001/F999 byte-shape tests (sync TestClient + `f001_token`/`f999_token` per Phase C of rankings):

```bash
grep -nB2 -A5 "test_F001_salesperson_ranking_byte_shape\|test_F999_all_rankings_empty" tests/python/smartbi_compat/test_analysis_sales_contract.py | head -20
```

Use the same fixture pattern.

- [ ] **Step 2: Append F001/F999 trend byte tests to TestTrend class**

```python
    def test_F001_trend_byte_shape(self, client, f001_token):
        """F001 trendChart should match the empty-state ChartConfig.

        F001 currently has no order_date data in test env (per spec §11 Q2),
        so trendChart.data == [] and the rest is the canonical 7-key shape.
        """
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        trend = response.json()["data"]["trendChart"]
        assert trend["data"] == []
        assert trend["chartType"] == "LINE"
        assert trend["title"] == "销售趋势"
        assert trend["xaxisField"] == "date"
        assert trend["yaxisField"] == "amount"
        assert trend["seriesField"] is None
        assert trend["options"] == {"showDataLabels": False, "smooth": True}

    def test_F999_trend_empty_byte_shape(self, client, f999_token):
        """F999 has cleared data → trendChart.data is []."""
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200
        trend = response.json()["data"]["trendChart"]
        assert trend["data"] == []
        assert trend["title"] == "销售趋势"
        assert trend["options"] == {"showDataLabels": False, "smooth": True}
```

NOTE: If `client` is async (httpx.AsyncClient), add `@pytest.mark.asyncio` decorator + `async`/`await`. Adapt to existing pattern (rankings used sync TestClient).

- [ ] **Step 3: pytest → expect 2 PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v -k "F001_trend or F999_trend"
```

If FAIL with byte mismatch (e.g. F001 actually has data and trend has populated bucket), STOP and report — DO NOT modify impl. Either adjust assertion to compare against the actual F001 golden, or note the divergence for Phase D golden re-record.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "test(phase2a-trend): F001/F999 trendChart byte-shape regression (route-level, asserts empty-state ChartConfig)" -- tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task C.2: Final 0-regression sweep + summary

**Files:**
- Read-only

- [ ] **Step 1: Full TestTrend count**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestTrend -v 2>&1 | tail -5
```

Expected: 13 PASS (B.1=4 + B.2=4 + B.3=3 + C.1=2 = 13).

- [ ] **Step 2: Full smartbi_compat suite for 0-regression**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q --tb=line 2>&1 | tail -5
```

Expected: 239 baseline + 13 TestTrend = 252 PASS, 0 fail.

If any baseline test fails, STOP and reconcile. Possible cause: edits to file accidentally broke an existing helper. `git diff` to inspect.

- [ ] **Step 3: Verify file growth + commit count**

```bash
wc -l backend/python/smartbi_compat/api/analysis_sales.py
# Expected: ~1680 LOC (was 1599 after rankings, +80 for trend helpers + impl)

cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-sales-trend
git log --oneline 3de09090b..HEAD | wc -l
# Expected: 4 (B.1 + B.2 + B.3 + C.1 = 4 commits)

git log --oneline 3de09090b..HEAD
# Verify commit messages are concrete
```

- [ ] **Step 4: No commit — verification only.**

---

## Phase D — Deploy + golden re-record (DEFERRED)

⚠ **DEFERRED per user instruction.** Run AFTER trend impl ships locally, batched with rankings.

When triggered:

### Task D.1 (DEFERRED): Deploy Python to test env

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-sales-trend
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Verify health:
```bash
curl -s http://47.100.235.168:8084/health
```

### Task D.2 (DEFERRED): Re-record F001 golden

```bash
./scripts/phase2a/record-analysis-sales-goldens.sh
```

If F001 still has empty `order_date` data, golden's `trendChart.data` stays `[]` (no change). If data was added, golden updates.

### Task D.3 (DEFERRED): Commit re-recorded golden separately

```bash
git status --short
git commit -m "chore(phase2a): re-record F001 analysis-sales golden after trend + rankings impl" -- tests/python/smartbi_compat/goldens/analysis-sales-F001.json
```

---

## Self-Review Checklist

### Spec coverage

- [x] §2 in-scope item 1: B.3 (`_get_sales_trend_chart` stub replaced)
- [x] §2 in-scope item 2: B.2 (`_bucket_sales_by_period` helper)
- [x] §2 in-scope item 3: B.1 (`_format_bucket_key` helper)
- [x] §2 in-scope item 4: TestTrend class — B.1 (4 tests) + B.2 (4 tests) + B.3 (3 tests) + C.1 (2 tests) = 13 tests
- [x] §3 architecture pseudo: implemented exactly per flow (query → bucket → data_points → ChartConfig factory)
- [x] §4 date bucket key formats: DAY ISO YYYY-MM-DD via `.isoformat()` (B.1)
- [x] §5 DAY-only decision: WEEK/MONTH/YEAR raise NotImplementedError (B.1, B.3)
- [x] §6 SQL strategy: reuses `_query_sales_data` (verified A.1)
- [x] §7 ChartConfig assembly: 7-key dict via `_new_chart_config_dict` factory (B.3)
- [x] §8 options field: hardcoded `{"showDataLabels": False, "smooth": True}` (B.3)
- [x] §9 data point format: `{date, amount}` with Decimal scale=2 HALF_UP quantize (B.3)
- [x] §11 R1 (Decimal serialization): RESOLVED via existing `_decimal_to_number` from foundation/gold; quantized Decimals round-trip via existing pattern
- [x] §12 Q1 (Decimal serialization): RESOLVED — use `.quantize(Decimal("0.01"), HALF_UP)` consistent with existing helpers
- [x] §12 Q2 (F001 empty data): documented; assertions assert `[]` per current state
- [x] §12 Q3 (`row.order_date` type): RESOLVED via defensive `.isoformat()` fallback in `_format_bucket_key`
- [x] §12 Q4 (WEEK/MONTH bucketing): NOT implemented per §5 decision
- [x] §12 Q5 (chartType inline): inline string per §3 design choice

### Placeholder scan

- [ ] No "TODO" / "TBD" outside Phase D DEFERRED markers
- [ ] All test code shows actual asserts with concrete expected values
- [ ] All commit messages concrete

### Type consistency

- [x] `_format_bucket_key(d, period)` → `str` (B.1)
- [x] `_bucket_sales_by_period(rows, period)` → `dict[str, Decimal]` (B.2)
- [x] `_get_sales_trend_chart(factory_id, range_, period="DAY")` → `dict` (B.3, foundation signature unchanged)

---

## Parallel Work Analysis

### Subagent: ✅ each task is independently dispatchable
- Phase A (1 task, read-only verification): trivial
- Phase B (B.1 → B.2 → B.3): sequential (B.2 depends on B.1, B.3 depends on B.2)
- Phase C (C.1, C.2): sequential

### Multi-Chat: ❌ — sub-worktree isolates
- This chat owns `.worktrees/phase2a-sales-trend` (chained from rankings)
- No conflict with rankings worktree (different sections of analysis_sales.py)
- Concurrent-edit safety rule 5b: every commit uses `--only` paths

---

End of trend implementation plan.
