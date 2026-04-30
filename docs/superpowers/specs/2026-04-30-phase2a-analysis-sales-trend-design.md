# Phase 2A `/analysis/sales` — Trend Sub-Spec

| Field | Value |
|---|---|
| **Type** | Sub-spec (3 of 3 sibling specs; smallest) |
| **Status** | Drafted, awaiting user review |
| **Depends on** | `2026-04-30-phase2a-analysis-sales-foundation-design.md` (must be merged first) |
| **Endpoint contribution** | Replaces `_get_sales_trend_chart` stub created by foundation |
| **Java reference** | `SalesAnalysisServiceImpl.getSalesTrendChart` line 597-607 → `buildSalesTrendChartFromData` line 868-906 → `aggregateByDay` line 911-921 / `aggregateByWeek` line 926-940 / `aggregateByMonth` line 945-956 |
| **Java DTO** | `dto/smartbi/ChartConfig.java` (68 LOC, 7 declared `@Data` fields) |
| **Branch** | `phase2a/t5-poc` (worktree at `.worktrees/phase2a-t5-poc`) |
| **Sibling specs** | overview / rankings (each owns its sub-services) |

---

## §1. Why this spec exists

Trend chart owns **two responsibilities**:

1. **Date-bucketing** — collapse N rows of `(order_date, amount)` into M `(bucket_key, sum_amount)` pairs, where M ≤ N and bucket_key formats vary by `period`.
2. **`ChartConfig` assembly** — wrap bucketed data into a 7-key dict matching `dto/smartbi/ChartConfig.java`. This is the only sub-spec that constructs a `ChartConfig` (overview produces `KPICard`/`MetricResult`; rankings produces `RankingItem`).

Because composite always passes `period="DAY"` (foundation §3 line 142), the spec scope is narrower than Java reference suggests.

---

## §2. Scope

### In-scope (this sub-spec PRs)

1. **Replace `_get_sales_trend_chart` stub body** in `backend/python/smartbi_compat/api/analysis_sales.py`. Function signature is FROZEN by foundation §5:
   ```python
   def _get_sales_trend_chart(factory_id: str, range_: DateRange, period: str = "DAY") -> dict
   ```
2. **New private helper `_bucket_sales_by_period`** — pure function: `list[Row] × period_str → dict[str, Decimal]` (sorted-key dict).
3. **New private helper `_format_bucket_key`** — pure function: `(date, period) → str` per §4 format table.
4. **TestTrend test class** in `tests/python/smartbi_compat/test_analysis_sales_contract.py`:
   - `test_F001_trend_byte_shape` — strip-volatile compare against `analysis-sales-F001.json` `data.trendChart` field.
   - `test_DAY_bucketing_unit` — synthetic 5-row input → expected 3-bucket output.
   - `test_empty_data_returns_empty_data_array` — F999-equivalent, ensures stub-replacement preserves empty-state byte match.

### Out-of-scope (PUNT)

| Item | Owner |
|---|---|
| `_query_sales_data` SQL extension (already adds `order_date`) | foundation spec (already done) |
| KPI cards / overview impl | overview spec |
| Salesperson/product/customer rankings | rankings spec |
| `ChartConfig` dict factory `_new_chart_config_dict` | foundation spec (already created) |
| Chart-comparison endpoint (`getSalespersonComparisonChart`, line 613) | NOT this endpoint — different route |
| WEEK/MONTH/YEAR period support — see §5 decision below | future work |
| `categories` / `subtitle` / `chartId` extra `ChartConfig` fields | foundation §4 javap task confirms whether they exist |

---

## §3. Architecture

### Flow

```
_get_sales_trend_chart(factory_id, range_, period="DAY")
  ↓
rows = _query_sales_data(factory_id, range_)         # foundation extends w/ order_date
  ↓                                                    # rows = [Row(salesperson_name, amount,
                                                       #              monthly_target, product_category,
                                                       #              customer_name, order_date), ...]
period_sales = _bucket_sales_by_period(rows, period)  # dict[bucket_key, Decimal]
  ↓                                                    # SORTED by bucket_key ASC (insertion-ordered dict)
data_points = [{"date": k, "amount": v} for k, v in period_sales.items()]
  ↓
return _new_chart_config_dict(                        # foundation factory
    chart_type="LINE",
    title="销售趋势",
    xaxis_field="date",
    yaxis_field="amount",
    data=data_points,
    options={"showDataLabels": False, "smooth": True},
)
```

### Key design choices

| Decision | Why |
|---|---|
| Bucketing is a pure helper, NOT inline in `_get_sales_trend_chart` | Testable in isolation (TestTrend.test_DAY_bucketing_unit), mirrors Java's separation (line 868 vs line 911). |
| Bucket dict is sorted by key ASC at insertion time | Java uses `TreeMap::new` supplier (line 916) — natural string ordering. Python equivalent: `dict(sorted(unsorted.items()))`. ISO date strings (`YYYY-MM-DD`) sort lexicographically = chronologically, so this works. |
| Skip rows where `order_date IS NULL` | Java line 913: `.filter(d -> d.getOrderDate() != null)`. |
| Decimal arithmetic, not float | Amount precision matters for byte-match (see §10). |
| `options` dict literal hardcoded inside `_get_sales_trend_chart` | Matches Java `LinkedHashMap` of 2 entries (line 894-896). Not a constant — used once. |

---

## §4. Date bucket key formats

Confirmed against `SalesAnalysisServiceImpl` lines 911-956:

| Period | Java code | Bucket key format | Example |
|---|---|---|---|
| `DAY` | `d.getOrderDate().toString()` (line 915) | ISO `YYYY-MM-DD` | `"2025-03-15"` |
| `WEEK` | `date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()` (line 932-933) | ISO `YYYY-MM-DD` of Monday | `"2025-03-10"` |
| `MONTH` | `year + "-" + String.format("%02d", monthValue)` (line 949-950) | `YYYY-MM` | `"2025-03"` |
| `YEAR` | NOT IMPLEMENTED in Java (no `case "YEAR"` in switch) | — | — |

Notable: WEEK key is **NOT** ISO week format `YYYY-Www`. It's the Monday-of-week's date in `YYYY-MM-DD` format, sorted naturally (chronological).

⚠ Plan task: when WEEK is ever implemented, must use `previous_or_same(MONDAY)` semantics, NOT `isocalendar()` week-of-year. The two differ at year boundaries (a Monday in late December may be ISO-week-1 of next year).

⚠ Plan task: MONTH bucket key uses `String.format("%02d", ...)` — Python equivalent is `f"{date.year}-{date.month:02d}"`. Verify with javap-equivalent `python -c "from datetime import date; d=date(2025,3,15); print(f'{d.year}-{d.month:02d}')"` returns `"2025-03"`.

---

## §5. Period parameter — DAY-only port decision

**Composite always passes `period="DAY"`** (foundation §3 line 142). WEEK/MONTH callable directly via the function but **no route exposes them** — Java's `getSalesTrendChart` is also only called from `getComprehensiveAnalysis` with hardcoded `"DAY"` (verified by code search; see foundation §3 quote of line 580-584).

### Decision

**Implement DAY only. WEEK/MONTH/YEAR raise `NotImplementedError`.**

```python
def _get_sales_trend_chart(factory_id: str, range_: DateRange, period: str = "DAY") -> dict:
    if period.upper() != "DAY":
        # TODO: WEEK/MONTH/YEAR when needed by another endpoint.
        # Java reference: SalesAnalysisServiceImpl.aggregateByWeek line 926,
        # aggregateByMonth line 945. YEAR not implemented in Java.
        raise NotImplementedError(
            f"trend chart period='{period}' not supported; only DAY is "
            f"used by /analysis/sales composite. See spec §5."
        )
    ...
```

### Rationale

| Pro | Con |
|---|---|
| Smaller surface area, fewer test cases | Future endpoint adding WEEK support must reopen this file |
| 100% caller coverage (composite is sole caller) | Slight risk if Java someday changes composite to pass WEEK |
| Forces explicit decision when adding new caller | Goldens file does not document non-DAY behavior |
| Aligns with "ship the smallest possible thing" rule | — |

### Alternative considered

Implement all 3 periods now. Rejected because: (a) no test data path validates them, (b) no callsite exists, (c) WEEK has subtle correctness traps (year-boundary edge cases) that are risky to ship dark.

⚠ Plan task: confirm via `grep -rn 'getSalesTrendChart' backend/java/`** that no other Java call passes period ≠ "DAY". If found, escalate to "implement all periods".

---

## §6. SQL strategy

Foundation already extends `_query_sales_data` (foundation §6) to include `order_date` column. **This sub-spec adds NO new SQL.**

```python
# Already done by foundation:
def _query_sales_data(factory_id, range_):
    sql = text(
        "SELECT salesperson_name, amount, monthly_target, "
        "       product_category, customer_name, order_date "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
```

Trend uses `row.order_date` and `row.amount` only. Other sub-services (overview/rankings) ignore `order_date` — no conflict.

⚠ Plan task: verify `row.order_date` is a `datetime.date` (or `datetime.datetime`) in the SQLAlchemy result, NOT a string. If it's already a string, drop the `.isoformat()` step in `_format_bucket_key`. Test on F999 query result.

---

## §7. ChartConfig assembly

### Field set (FROZEN by foundation §4 dict factory)

ChartConfig.java has **7 declared fields** (verified by reading `dto/smartbi/ChartConfig.java`):

```java
private String chartType;          // line 37
private String title;              // line 42
private String xAxisField;         // line 47  → JSON key "xaxisField" (Lombok @Data lowercases first letter chain)
private String yAxisField;         // line 52  → JSON key "yaxisField"
private String seriesField;        // line 57
private List<Map<String, Object>> data;       // line 62
private Map<String, Object> options;          // line 67
```

F999/F001 goldens both confirm 7 keys appear and the JSON-key spelling:

```json
"trendChart": {
  "chartType": "LINE",
  "title": "销售趋势",
  "seriesField": null,
  "data": [],
  "options": { "showDataLabels": false, "smooth": true },
  "xaxisField": "date",
  "yaxisField": "amount"
}
```

### Key order observed (F999 + F001 identical)

```
chartType / title / seriesField / data / options / xaxisField / yaxisField
```

This is **NOT alphabetical** and **NOT Java declaration order** (declaration order would be chartType/title/xAxisField/yAxisField/seriesField/data/options). It's Jackson's serialization order for this `@Data @Builder` class. The foundation `_new_chart_config_dict` factory MUST construct dict in this exact order.

⚠ Plan task A.1 (foundation): confirm during javap pass that `_new_chart_config_dict` returns keys in this order. If foundation factory got order wrong, foundation must fix BEFORE this sub-spec PRs.

### Lowercase a in `xaxisField`/`yaxisField` is real

Java field is `xAxisField` (camelCase X). Jackson serializes as `xaxisField` (lowercase a) because `@Data` getter is `getXAxisField()` and Jackson's default `PROPERTY_NAMING_STRATEGY` lower-cases the first segment after stripping `get`. This is confirmed by the goldens — it is NOT a typo. Python factory must emit `"xaxisField"` (not `"xAxisField"`).

---

## §8. `options` field

Java `buildSalesTrendChartFromData` line 894-896:

```java
Map<String, Object> options = new LinkedHashMap<>();
options.put("showDataLabels", false);
options.put("smooth", true);
```

**Hardcoded** — no business logic. Python:

```python
options = {"showDataLabels": False, "smooth": True}
```

Key order: `showDataLabels` then `smooth`. F999 + F001 confirm. Python dict insertion-order preserved (≥3.7).

⚠ Risk: if business adds a third option key later (e.g. `"animation": False`), this spec's hardcoded literal will need updating. Low likelihood — `ChartConfig` is `@Deprecated` per file header.

---

## §9. Data point format

Per Java line 887-890:

```java
Map<String, Object> dataPoint = new LinkedHashMap<>();
dataPoint.put("date", entry.getKey());                                              // String
dataPoint.put("amount", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));   // BigDecimal scale=2
```

`DISPLAY_SCALE = 2`, `ROUNDING_MODE = HALF_UP` (lines 64-66).

### Python

```python
{
    "date": bucket_key_str,                                          # e.g. "2025-03-15"
    "amount": amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),  # 2 decimal places
}
```

### JSON serialization

Java BigDecimal with scale 2 serializes to JSON number with 2 trailing decimals (e.g. `1234.50`, not `1234.5`). Python Decimal `.quantize(Decimal("0.01"))` serializes via FastAPI/Pydantic as **string** by default (e.g. `"1234.50"`). Java emits **number** (`1234.50`).

⚠ **Risk R1 (medium)**: Decimal serialization. If FastAPI route returns Decimal as string, F001 byte-shape test fails. Two options:

1. Use `float(amount.quantize(...))` — emits as JSON number but loses precision representation (`1234.5` not `1234.50`).
2. Configure custom JSON encoder to serialize Decimal as number with scale-preserving format string (`f"{d:.2f}"` → string parsed by JSON consumer as number? No, still string.)
3. Match approach used by `/alerts` and `/recommendations` shipping (likely option 1 or a custom encoder).

⚠ Plan task: read existing alerts/recommendations response code in `smartbi_compat/api/analysis.py` to see how Decimal→JSON is handled. Mirror that approach. If they use float, use float here. If they use a custom encoder, use it here.

### Empty data → empty list

If `salesData` is empty (F999 case) or all rows have `order_date IS NULL`:

- Java: `aggregateByDay` returns empty `TreeMap` → `chartData` is empty `ArrayList` → `data: []` in JSON.
- Python: `_bucket_sales_by_period` returns `{}` → `data_points = []` → `data: []`.

F999 + F001 goldens both show `"data": []`. **F001 happens to also be empty** despite being the "full data" golden — likely no `order_date` populated in test env's `smart_bi_sales_data` for F001 in 2025-01-01 to 2025-12-31 range, OR the data exists but lies outside that window. (See §11 Open question 2.)

---

## §10. Test fixtures

Test class added to `tests/python/smartbi_compat/test_analysis_sales_contract.py` (foundation creates this file with `TestEnvelope`):

```python
class TestTrend:
    """Sub-spec test class. Foundation TestEnvelope.test_F999_empty_state_byte_shape
    already exercises stub return path. This adds:
      - Real impl byte-shape vs F001 (currently empty data, but exercises factory)
      - Unit test on _bucket_sales_by_period for non-empty input
      - Empty-data preserves stub-equivalent shape
    """

    def test_F001_trend_byte_shape(self, client, f001_token):
        """F001 trendChart must match golden (currently empty data array)."""
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200

        actual = _strip_volatile(response.json()["data"]["trendChart"])

        with open(GOLDEN_DIR / "analysis-sales-F001.json", encoding="utf-8") as f:
            golden = json.load(f)
        expected = _strip_volatile(golden["response"]["data"]["trendChart"])

        assert actual == expected

    def test_DAY_bucketing_unit(self):
        """Pure-function test: 5 rows on 3 distinct dates → 3 buckets,
        chronologically sorted, amounts summed per date."""
        from smartbi_compat.api.analysis_sales import _bucket_sales_by_period
        from datetime import date
        from decimal import Decimal

        # Synthetic rows mimicking SQLAlchemy Row attribute access
        class _Row:
            def __init__(self, order_date, amount):
                self.order_date = order_date
                self.amount = amount

        rows = [
            _Row(date(2025, 3, 15), Decimal("100.00")),
            _Row(date(2025, 3, 15), Decimal("50.00")),
            _Row(date(2025, 3, 14), Decimal("200.00")),
            _Row(date(2025, 3, 16), Decimal("75.50")),
            _Row(None, Decimal("999.99")),  # NULL order_date should be skipped
        ]

        result = _bucket_sales_by_period(rows, "DAY")

        assert list(result.keys()) == ["2025-03-14", "2025-03-15", "2025-03-16"]  # sorted ASC
        assert result["2025-03-14"] == Decimal("200.00")
        assert result["2025-03-15"] == Decimal("150.00")
        assert result["2025-03-16"] == Decimal("75.50")

    def test_empty_data_returns_empty_data_array(self, client, f999_token):
        """After stub replacement, F999 still gets data:[]. (Already covered by
        TestEnvelope.test_F999_empty_state_byte_shape, but this adds focused
        assertion on the trendChart sub-tree.)"""
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        trend = response.json()["data"]["trendChart"]
        assert trend["data"] == []
        assert trend["chartType"] == "LINE"
        assert trend["title"] == "销售趋势"
        assert trend["xaxisField"] == "date"
        assert trend["yaxisField"] == "amount"
        assert trend["seriesField"] is None
        assert trend["options"] == {"showDataLabels": False, "smooth": True}

    def test_unsupported_period_raises(self):
        """WEEK/MONTH/YEAR not implemented; raise NotImplementedError per §5."""
        from smartbi_compat.api.analysis_sales import _get_sales_trend_chart
        from smartbi_compat.date_range import DateRange
        from datetime import date

        range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))

        for unsupported in ("WEEK", "MONTH", "YEAR"):
            with pytest.raises(NotImplementedError, match="not supported"):
                _get_sales_trend_chart("F999", range_, period=unsupported)
```

---

## §11. Risk register

| # | Risk | Severity | Mitigation | Owner |
|---|---|---|---|---|
| **R1** | Decimal→JSON serialization mismatch (string vs number, trailing zeros) breaks F001 byte-match | Medium-High | Plan task: read existing alerts/recommendations Decimal handling, mirror exactly. F001 goldens currently have empty `data:[]` so risk only fires when F001 gets real `order_date` rows in future re-record. | trend plan |
| **R2** | `ChartConfig` JSON key order in `_new_chart_config_dict` factory differs from goldens | Medium | Foundation javap task A.1 verifies. If foundation factory was wrong, escalate to foundation BEFORE this sub-spec PRs. | foundation + this spec verifies |
| **R3** | F001 trend `data:[]` is misleading — implies test env has no `order_date` data, so byte-match passes trivially without exercising bucketing logic | Low (functional) / High (confidence) | Compensate with `test_DAY_bucketing_unit` synthetic rows. Document in plan that F001 byte-match is "envelope only" and unit test is "logic correctness". | trend plan |
| **R4** | `row.order_date` returns string instead of `datetime.date` from SQLAlchemy | Low | Plan task: smoke-print `type(row.order_date)` first, branch in `_format_bucket_key` if needed. | trend impl |
| **R5** | `xaxisField`/`yaxisField` Jackson lowercasing not preserved in Python factory (someone "fixes" to `xAxisField`) | Medium | Cite F999/F001 goldens in factory docstring + add explicit assertion in `test_empty_data_returns_empty_data_array`. | foundation factory + this test |
| **R6** | Java someday changes composite to pass WEEK → Python `NotImplementedError` causes 500 | Low | Plan task #1: grep all Java callers of `getSalesTrendChart` to confirm DAY-only. Re-grep on each Java schema sync. | trend plan |
| **R7** | Bucketing `dict(sorted(...))` not insertion-ordered after `.items()` iteration on older Python | None | Python ≥3.7 guarantees dict preservation; `backend/python` runs 3.8+. | n/a |
| **R8** | Fallback `period.upper()` differs from Java `period.toUpperCase()` for non-ASCII inputs | Negligible | period is one of "DAY"/"WEEK"/"MONTH"; ASCII-only. | n/a |

---

## §12. Open questions (TBD until impl)

1. **Decimal serialization approach** (R1): plan task to inspect alerts/recommendations Python code and adopt same approach. Likely `float(d)` or custom encoder. Defer firm decision to first impl task.

2. **F001 trend has empty `data:[]`** — is `smart_bi_sales_data` for F001 missing `order_date` rows entirely, OR are rows present but outside the 2025-01-01..2025-12-31 query window, OR is `order_date` column NULL for all F001 rows? Plan task: `psql smartbi_db -c "SELECT COUNT(*), MIN(order_date), MAX(order_date) FROM smart_bi_sales_data WHERE factory_id='F001'"`. If F001 has no real trend data, consider seeding test env with a small fixture (e.g. F999-trip-rows pattern from `/alerts` marathon) to exercise bucketing in a future contract test.

3. **`row.order_date` type** (R4): plan task to confirm SQLAlchemy Row attribute type. Branch one-liner in `_format_bucket_key`.

4. **Should `_bucket_sales_by_period` accept `period="WEEK"|"MONTH"`?** (i.e., implement bucketing logic for all 3 periods even if not exposed). Rationale: trivially small additional code (~10 LOC), enables future endpoint reuse without revisiting this file. Counter: violates §5 "ship smallest". Decision: KEEP DAY-only per §5; add `# TODO` comment with line number references to Java's `aggregateByWeek` / `aggregateByMonth`. Re-evaluate when next caller surfaces.

5. **`chartType="LINE"` constant placement** — inline string literal vs module constant? Java uses string literal at line 899. Mirror exactly: inline string. (One-time use — not worth a constant.)

---

## §13. Acceptance criteria

This sub-spec PR is complete when:

- [ ] `_get_sales_trend_chart` stub body replaced with real impl in `analysis_sales.py`.
- [ ] Helper `_bucket_sales_by_period(rows, period) -> dict[str, Decimal]` exists, sorted ASC by key, skips NULL `order_date`, sums amounts, returns `{}` for empty input.
- [ ] Helper `_format_bucket_key(date, period) -> str` exists for DAY only (raises for others).
- [ ] `period.upper() != "DAY"` raises `NotImplementedError` with message citing this spec §5.
- [ ] Returns dict via `_new_chart_config_dict(...)` (foundation factory; do NOT inline-construct dict).
- [ ] `options={"showDataLabels": False, "smooth": True}` literal matches Java line 894-896 byte-for-byte.
- [ ] Decimal scale=2 with HALF_UP rounding for `amount` field per `DISPLAY_SCALE` constant.
- [ ] TestTrend test class added with 4 tests (F001 byte-shape + DAY unit + empty F999 sub-tree + unsupported period).
- [ ] `test_F001_trend_byte_shape` PASSES.
- [ ] `test_DAY_bucketing_unit` PASSES with synthetic 5-row input.
- [ ] All foundation `TestEnvelope` tests still PASS (no regression).
- [ ] No changes to `analysis.py`, no changes to foundation factories, no changes to route handler, no changes to composite assembly.
- [ ] All JSON keys are camelCase per `field-naming-convention.md` (verify `xaxisField`/`yaxisField` lowercase a is preserved).

---

## §14. Plan structure preview

The trend plan (separate file `docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-trend.md`) will have ~6-8 tasks across 3 short phases. This is the smallest sibling plan.

- **Phase A** (~2 tasks): Pre-impl verification
  - Task A.1: Verify `_new_chart_config_dict` factory key order matches F999/F001 (read foundation code; re-record F999 if drift)
  - Task A.2: Inspect existing Decimal→JSON handling in alerts/recommendations to choose serialization approach (R1)

- **Phase B** (~3 tasks): Impl
  - Task B.1: Add `_format_bucket_key(date, period)` helper (DAY only; raise for others)
  - Task B.2: Add `_bucket_sales_by_period(rows, period)` helper (skip NULL `order_date`, sum, sort ASC)
  - Task B.3: Replace `_get_sales_trend_chart` stub body; wire helpers + factory

- **Phase C** (~2-3 tasks): Test + verify
  - Task C.1: Add `TestTrend` class with 4 tests
  - Task C.2: Run full `test_analysis_sales_contract.py`; debug any byte-shape mismatch
  - Task C.3 (defensive): Re-run alerts/recommendations contract tests to confirm 0 regression (foundation already did this; re-confirm)

Total: ~6-8 tasks, ~2-3h work for trend chat. **Smallest of the 3 sibling specs** by a comfortable margin (overview ~12-16h, rankings ~6-8h, trend ~2-3h).

---

## §15. Parallel work analysis

| Dimension | Parallel possible? |
|---|---|
| Trend impl in parallel with overview/rankings impl | NO — all 3 edit `analysis_sales.py`. concurrent-edit-safety rule 1+2+5b. |
| Sequential after foundation | YES — can ship in any order relative to overview/rankings (no mutual deps). Recommend trend FIRST as smallest, lowest-risk change to validate foundation factories work end-to-end. |
| Subagent within trend chat | LOW value — 6-8 tasks of ~20min each, sequential. No 2+ independent task chunks. |

End of trend sub-spec.
