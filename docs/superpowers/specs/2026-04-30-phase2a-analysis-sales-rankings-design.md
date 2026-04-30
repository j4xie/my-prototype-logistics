# Phase 2A `/analysis/sales` — Rankings Sub-Spec

| Field | Value |
|---|---|
| **Type** | Sibling sub-spec (rankings, 1 of 3 — overview / rankings / trend) |
| **Status** | Drafted, awaiting user review |
| **Endpoint** | `GET /api/mobile/{factoryId}/smart-bi/analysis/sales` (composite assembled in foundation) |
| **Owns** | `_get_salesperson_ranking` / `_get_product_ranking` / `_get_customer_ranking` real impls (replacing 3 foundation stubs) |
| **Java reference** | `SalesAnalysisServiceImpl.java`<br>• `getSalespersonRanking` line 371-400<br>• `getProductRanking` line 491-533<br>• `getCustomerRanking` line 550-593<br>• `RankingItem.java` (53 LOC, Lombok @Data + @Builder) |
| **Foundation dependency** | `2026-04-30-phase2a-analysis-sales-foundation-design.md` §5 (signature freeze), §6 (`_query_sales_data` extends with `order_date`), §8 R1 (sort stability risk) |
| **Branch** | `phase2a/t5-poc` (worktree at `.worktrees/phase2a-t5-poc`) |
| **Sibling specs** | overview, trend (this is rankings) |

---

## §1. Why this sub-spec

Three Java methods (`getSalespersonRanking` / `getProductRanking` / `getCustomerRanking`) share the **same SQL aggregation pattern**:

```
1. SELECT smart_bi_sales_data WHERE factory_id AND order_date BETWEEN
2. GROUP BY {dimension_field} → SUM(amount)
3. ORDER BY total DESC (with optional LIMIT for customer)
4. Map to RankingItem (rank=1..N, name, value, [target], [completionRate], alertLevel)
```

The three differ only in:

| Dimension | Group field | Top N cap | Target/completion | percentage (uses `completionRate` field) | alertLevel |
|---|---|---|---|---|---|
| `salesperson` | `salesperson_name` | none | yes (per-person target) | n/a | computed (RED/YELLOW/GREEN) |
| `product` | `product_category` | none | no | yes (% of total sales) | hard-coded GREEN |
| `customer` | `customer_name` | **Top 10** | no | yes (% of total sales) | hard-coded GREEN |

A single generic `_build_ranking()` helper + 3 ~10-LOC caller wrappers cleanly captures the pattern. **One sub-spec, three impls** keeps spec count manageable (4 total: foundation + overview + rankings + trend).

The rationale also forces sort-stability handling into one place (the helper) — which matters for §7 below.

---

## §2. Scope

### In-scope (this sub-spec OWNS)

1. **Generic helper**: `_build_ranking(items, *, top_n=None, with_percentage=False, target_map=None)` in `analysis_sales.py`
2. **Three real impls** replacing foundation stubs:
   - `_get_salesperson_ranking(factory_id, range_)` — calls helper with `target_map` derived from per-person `monthly_target` sum
   - `_get_product_ranking(factory_id, range_)` — calls helper with `with_percentage=True`
   - `_get_customer_ranking(factory_id, range_)` — calls helper with `with_percentage=True, top_n=10`
3. **One private helper** `_calculate_completion_rate(actual, target) -> Decimal` (mirrors Java `calculateCompletionRate` line 1166-1171)
4. **One private helper** `_determine_completion_alert_level(rate) -> str` (mirrors Java line 1176-1184)
5. **Constants** mirrored from Java `SalesAnalysisServiceImpl.java` line 64-74:
   - `_SCALE = 4` (intermediate division precision)
   - `_DISPLAY_SCALE = 2` (final value/target/completionRate scale)
   - `_ROUNDING = ROUND_HALF_UP` (Python `decimal.ROUND_HALF_UP`)
   - `_TARGET_RED_THRESHOLD = Decimal("60")`
   - `_TARGET_YELLOW_THRESHOLD = Decimal("85")`
6. **Test additions** in `tests/python/smartbi_compat/test_analysis_sales_contract.py`:
   - `TestRankings` class with 4 tests (one per ranking + tie-stability + Top-10 cap)
7. **F001 golden re-recording** (mandatory; see §7) — non-empty rankings require synthetic seed in the `smart_bi_sales_data` table for F001 (or reuse F999 pattern with a per-rankings calibration golden) before recording

### Out-of-scope (PUNT)

| Item | Owned by |
|---|---|
| Composite assembly / route / 7-key dict | foundation (already shipped) |
| `_query_sales_data` SQL extension (`order_date` column) | foundation |
| `_new_ranking_item_dict` factory shape | foundation §4 (FROZEN; rankings consumes) |
| `_strip_volatile` test helper | foundation |
| KPI / metric calculations / overview impl | overview spec |
| AI insight strings | overview spec |
| Trend chart (`_get_sales_trend_chart`) | trend spec |
| Java code modifications (e.g. fixing `getProductRanking` HashMap → TreeMap) | **NONE** — Python-side fix only (see §7) |
| Re-recording F999 (no rankings data → still `[]`) | rankings only re-records F001 |

---

## §3. Architecture — generic builder + three thin wrappers

```
┌─────────────────────────────────────────────────────────────────┐
│ _query_sales_data(factory_id, range_)  ← extended by foundation │
│ Returns rows with: salesperson_name, amount, monthly_target,    │
│                    product_category, customer_name, order_date  │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   per-row aggregate        per-row aggregate
   into dict[name, sum]     into dict[name, sum]
        │                         │
        ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ _build_ranking(name_to_value, *, top_n=None,                    │
│                with_percentage=False, target_map=None)          │
│                                                                  │
│   1. Sort by (-value, name) for stability               ◄── §7  │
│   2. Apply top_n if set                                          │
│   3. Compute total (only if with_percentage)                     │
│   4. For each (name, value):                                     │
│        target = target_map.get(name, 0) if target_map else None  │
│        rate = _calculate_completion_rate(value, target)          │
│              if target_map else                                  │
│              percentage_of_total                                  │
│        alert = _determine_completion_alert_level(rate)           │
│                if target_map else "GREEN"                        │
│        emit _new_ranking_item_dict(rank, name, value, target,    │
│                                    completion_rate=rate,         │
│                                    alert_level=alert)            │
└─────────────────────────────────────────────────────────────────┘
        ▲              ▲              ▲
        │              │              │
   _get_salesperson  _get_product   _get_customer
   _ranking          _ranking        _ranking
   (target_map=…)   (with_pct=T)    (with_pct=T,
                                     top_n=10)
```

Each caller is a ~10 LOC dict-build + delegate call. The helper owns sort, scaling, percentage math, and dict construction.

---

## §4. SQL strategy — reuse `_query_sales_data` (already extended by foundation)

Foundation §6 mandates `_query_sales_data` returns `salesperson_name, amount, monthly_target, product_category, customer_name, order_date`. **Rankings spec uses 4 of these** (`salesperson_name`, `amount`, `monthly_target` for salesperson; `product_category` + `amount` for product; `customer_name` + `amount` for customer). `order_date` is consumed only by trend spec.

**Java behavior reference** (line 374, line 494, line 553): all three Java methods call `salesDataRepository.findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate)` and stream-aggregate in JVM. **No DB-side GROUP BY.** Rankings spec mirrors this — Python aggregates in-process, not via SQL. This:

- Matches Java behavior for byte-shape (rounding, ordering, null handling)
- Avoids DB-engine-specific GROUP BY ordering quirks
- Makes monkey-patching `_query_sales_data` in tests trivially work for all three (one fixture path)

**Salesperson note**: Java line 374 uses `salesDataRepository.findSalesBySalesperson(...)` which IS a DB-side GROUP BY query (returns `Object[]{salesperson_name, SUM(amount)}`). However, line 378-380 separately fetches all rows for `calculateSalespersonTargets`. So salesperson uses two queries (aggregate + raw). **Python rankings spec uses ONE call to `_query_sales_data` for all three rankings** and aggregates in Python. This is a deliberate divergence justified by:

1. Foundation already has `_query_sales_data` returning raw rows — no separate aggregate path exists
2. Java's separate `findSalesBySalesperson` is a duplication artifact; the result is aggregate-equivalent
3. Single-path in-process aggregation is testable with one mocking seam

**Acceptable risk**: if F001 byte-shape mismatches due to nulls-handling or precision differences with the DB GROUP BY, fall back to adding `_query_salesperson_aggregates` SQL. Plan task gates: re-record F001 → byte-compare → divergence triage.

---

## §5. Generic `_build_ranking` function — signature + impl sketch

```python
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# Constants — mirrors SalesAnalysisServiceImpl.java line 64-74
_SCALE = 4
_DISPLAY_SCALE = 2
_ROUNDING = ROUND_HALF_UP
_TARGET_RED_THRESHOLD = Decimal("60")
_TARGET_YELLOW_THRESHOLD = Decimal("85")
_HUNDRED = Decimal("100")
_ZERO = Decimal("0")


def _calculate_completion_rate(actual: Decimal, target: Optional[Decimal]) -> Decimal:
    """Mirror Java SalesAnalysisServiceImpl.calculateCompletionRate (line 1166-1171).

    Returns ZERO when target is null/zero. Else returns (actual / target * 100)
    at SCALE=4 precision (caller is responsible for setScale to DISPLAY_SCALE).
    """
    if target is None or target == _ZERO:
        return _ZERO
    return (actual / target).quantize(Decimal("1e-4"), rounding=_ROUNDING) * _HUNDRED


def _determine_completion_alert_level(completion_rate: Decimal) -> str:
    """Mirror Java SalesAnalysisServiceImpl.determineCompletionAlertLevel
    (line 1176-1184).

    < 60 → RED
    < 85 → YELLOW
    else → GREEN
    """
    if completion_rate < _TARGET_RED_THRESHOLD:
        return "RED"
    if completion_rate < _TARGET_YELLOW_THRESHOLD:
        return "YELLOW"
    return "GREEN"


def _build_ranking(
    name_to_value: dict[str, Decimal],
    *,
    top_n: Optional[int] = None,
    with_percentage: bool = False,
    target_map: Optional[dict[str, Decimal]] = None,
) -> list[dict]:
    """Generic ranking builder — covers salesperson / product / customer.

    Args:
        name_to_value: aggregated {name: total_amount} dict
        top_n: if set, slice to top N after sort (customer ranking uses 10)
        with_percentage: if True, completionRate = (value / total) * 100
                         (product + customer rankings)
        target_map: if provided, completionRate = (value / target) * 100
                    AND alertLevel computed from rate (salesperson ranking)
                    Mutually exclusive with with_percentage in practice.

    Returns:
        list of RankingItem-shaped dicts per foundation
        `_new_ranking_item_dict()` factory.

    Sort stability:
        Sort key is (-value, name) — value DESC, name ASC for ties.
        See §7 (sort-stability risk). This is a Python-side fix — Java's
        HashMap-based grouping has nondeterministic tie order.
    """
    # 1. Sort by value DESC, name ASC (tie stability)
    sorted_items = sorted(
        name_to_value.items(),
        key=lambda kv: (-kv[1], kv[0]),
    )

    # 2. Apply top_n cap if set
    if top_n is not None:
        sorted_items = sorted_items[:top_n]

    # 3. Compute total (only if needed for percentage)
    if with_percentage:
        total = sum(name_to_value.values(), _ZERO)
    else:
        total = None

    # 4. Build dicts
    rankings: list[dict] = []
    for rank, (name, value) in enumerate(sorted_items, start=1):
        target: Optional[Decimal] = None
        completion_rate: Decimal
        alert_level: str

        if target_map is not None:
            # salesperson: per-person target → completion rate
            target = target_map.get(name, _ZERO)
            completion_rate = _calculate_completion_rate(value, target)
            alert_level = _determine_completion_alert_level(completion_rate)
        elif with_percentage:
            # product/customer: percentage of total
            completion_rate = (
                _ZERO if total is None or total == _ZERO
                else (value / total).quantize(Decimal("1e-4"), rounding=_ROUNDING) * _HUNDRED
            )
            alert_level = "GREEN"  # Java line 528 / 588 hard-codes GREEN
        else:
            completion_rate = _ZERO
            alert_level = "GREEN"

        rankings.append(_new_ranking_item_dict(
            rank=rank,
            name=name,
            value=value.quantize(Decimal("0.01"), rounding=_ROUNDING),
            target=(target.quantize(Decimal("0.01"), rounding=_ROUNDING)
                    if target is not None else None),
            completion_rate=completion_rate.quantize(Decimal("0.01"), rounding=_ROUNDING),
            alert_level=alert_level,
        ))

    return rankings
```

**Decimal precision pattern** explicitly matches Java `setScale(DISPLAY_SCALE, ROUNDING_MODE)` (line 392-394, 526-527, 586-587). Intermediate division uses SCALE=4, final value/target/completionRate are quantized to 0.01.

⚠ Python `Decimal` JSON serialization: rankings spec MUST serialize with `Decimal('1234.56') → "1234.56"` (string) OR `1234.56` (number). Java Jackson default emits `BigDecimal` as JSON number with trailing zero preservation per `setScale(2)` (`1234.50` not `1234.5`). Plan task: confirm Python `json.dumps(default=str)` or pydantic / FastAPI's `jsonable_encoder` matches Java's output. R3 follow-up.

---

## §6. Three caller real impls — each ~10 LOC

```python
async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list[dict]:
    """Replace foundation stub. Mirror Java SalesAnalysisServiceImpl
    .getSalespersonRanking (line 371-400).

    Aggregates SUM(amount) and SUM(monthly_target) per salesperson_name.
    Returns RankingItem dicts with target + completionRate + computed alertLevel.
    No top-N cap (Java doesn't limit).

    async per foundation §5 cross-cutting (gold spec §15). Sync SQLAlchemy
    `_query_sales_data` wrapped via `await asyncio.to_thread(...)` per
    foundation Phase B.6 bridging strategy.
    """
    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    sales: dict[str, Decimal] = {}
    targets: dict[str, Decimal] = {}
    for row in rows:
        name = row.salesperson_name
        if name is None:
            continue
        amount = Decimal(str(row.amount)) if row.amount is not None else _ZERO
        target = (Decimal(str(row.monthly_target))
                  if row.monthly_target is not None else _ZERO)
        sales[name] = sales.get(name, _ZERO) + amount
        targets[name] = targets.get(name, _ZERO) + target
    return _build_ranking(sales, target_map=targets)


async def _get_product_ranking(factory_id: str, range_: DateRange) -> list[dict]:
    """Replace foundation stub. Mirror Java SalesAnalysisServiceImpl
    .getProductRanking (line 491-533).

    Aggregates SUM(amount) per product_category. Returns RankingItem dicts
    with completionRate=percentage_of_total + alertLevel hard-coded GREEN.
    No top-N cap. async per foundation §5.
    """
    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    sales: dict[str, Decimal] = {}
    for row in rows:
        category = row.product_category
        if category is None:
            continue
        amount = Decimal(str(row.amount)) if row.amount is not None else _ZERO
        sales[category] = sales.get(category, _ZERO) + amount
    return _build_ranking(sales, with_percentage=True)


async def _get_customer_ranking(factory_id: str, range_: DateRange) -> list[dict]:
    """Replace foundation stub. Mirror Java SalesAnalysisServiceImpl
    .getCustomerRanking (line 550-593).

    Aggregates SUM(amount) per customer_name. Returns RankingItem dicts
    with completionRate=percentage_of_total + alertLevel hard-coded GREEN.
    Top 10 cap (Java line 574). async per foundation §5.
    """
    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    sales: dict[str, Decimal] = {}
    for row in rows:
        name = row.customer_name
        if name is None:
            continue
        amount = Decimal(str(row.amount)) if row.amount is not None else _ZERO
        sales[name] = sales.get(name, _ZERO) + amount
    return _build_ranking(sales, with_percentage=True, top_n=10)
```

Total: 3 callers × ~12 LOC = ~36 LOC.

---

## §7. Sort stability — Python-side fix only

### The problem (foundation §8 R1)

Java `SalesAnalysisServiceImpl.getProductRanking` and `getCustomerRanking` use:

```java
Map<String, BigDecimal> productSales = salesData.stream()
    .collect(Collectors.groupingBy(
        SmartBiSalesData::getProductCategory,
        Collectors.reducing(BigDecimal.ZERO, ...)));   // line 498-505 (product)
                                                       // line 557-564 (customer)
// Then:
productSales.entrySet().stream()
    .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
    .collect(...);                                     // line 513-515 (product)
                                                       // line 572-575 (customer)
```

**Two issues**:

1. `Collectors.groupingBy` defaults to `HashMap` (hash-bucket-ordered, JVM-version-dependent)
2. `comparingByValue().reversed()` is **value-only** — for ties on value (rare but possible at scale boundaries), tie order is `HashMap` iteration order = nondeterministic

### Reference fix in alerts marathon

Commit `fb1fcafb2` ("fix(smartbi): TreeMap-supplied groupingBy for stable alert sort order") supplied `TreeMap::new` to `Collectors.groupingBy(...)` in `RecommendationServiceImpl` so per-salesperson + per-department alert generators iterate in alphabetical name order — fixed nondeterminism for alerts. **Same root cause exists here in `getProductRanking` / `getCustomerRanking`.** Java `getSalespersonRanking` line 371-400 doesn't have this issue because line 374 uses a DB-side aggregate query (`findSalesBySalesperson`) which returns rows in the order the Java repository defines (no tie-stability guarantee but constant for a given DB).

### This spec's strategy: Python-side fix ONLY

Per user instructions and foundation §8 R1: **rankings spec does NOT modify Java**. Instead:

1. Python sorts with composite key `(-value, name)` (value DESC, name ASC)
2. F001 golden is RE-RECORDED after impl with stable sort applied (mandatory; not conditional)
3. Java side keeps its HashMap-grouping; if Java accidentally re-orders ties later, the recorded golden becomes stale and test fails — that's the desired alarm (catches Java drift)

The trade-off: re-recording F001 is unconditional. Skipping it is a forbidden short-cut.

### Why not modify Java

- User instructions: "Do NOT modify any Java file"
- Java fix is the long-term right answer but requires a separate Java-side commit + re-deploy + re-record cycle. Defer to a later workstream (Phase 2A or beyond) that explicitly owns Java drift.
- F001 byte-shape will match because the recorder runs on test env (10011) AFTER Python is deployed. Python sorts stably; recorder captures Python's response, not Java's. **There is no Java-vs-Python comparison at byte level for rankings** — the comparison is Python's response vs the RE-RECORDED golden.

### Mandatory impl steps for sort stability

In the rankings plan (separate file), the following tasks MUST appear:

- Task: implement `_build_ranking` with composite sort key
- Task: add tie-stability unit test (synthetic dict with two equal values)
- Task: deploy Python to test env (8084)
- Task: trigger F001 golden recorder via `scripts/phase2a/record-analysis-sales-goldens.sh`
- Task: commit re-recorded `analysis-sales-F001.json`
- Task: contract test `TestRankings.test_F001_byte_shape` PASSES with re-recorded golden

These tasks are not gated on observed mismatch. The re-recording happens always.

---

## §8. RankingItem field enumeration

`backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/RankingItem.java` (53 LOC, Lombok `@Data @Builder @NoArgsConstructor @AllArgsConstructor`) declares 6 fields:

| # | Field | Type | Java getter | JSON key | Notes |
|---|---|---|---|---|---|
| 1 | `rank` | `Integer` | `getRank()` | `rank` | 1-indexed |
| 2 | `name` | `String` | `getName()` | `name` | salesperson / product category / customer |
| 3 | `value` | `BigDecimal` | `getValue()` | `value` | always set, scale=2 |
| 4 | `target` | `BigDecimal` | `getTarget()` | `target` | only salesperson sets; product/customer leave null |
| 5 | `completionRate` | `BigDecimal` | `getCompletionRate()` | `completionRate` | dual-purpose: target completion (salesperson) OR percentage of total (product/customer) |
| 6 | `alertLevel` | `String` | `getAlertLevel()` | `alertLevel` | RED / YELLOW / GREEN |

⚠ Note: foundation §4 marks 3 fields as `⚠ check javap` — this spec confirms via direct file read. Lombok `@Data` generates exactly 6 getters from these 6 declared fields — **no derived getters** (no `@Getter(lazy=true)`, no `boolean` field for `is*` getter). foundation plan task A.1 (javap) should confirm this matches what `javap` shows on the compiled `.class`.

⚠ Java emits `null` for unset `BigDecimal` fields (Jackson default). For product/customer rankings where target is unset:

```json
{
  "rank": 1,
  "name": "蔬菜",
  "value": 12345.67,
  "target": null,
  "completionRate": 25.43,
  "alertLevel": "GREEN"
}
```

Python `_new_ranking_item_dict(target=None, ...)` MUST emit `"target": null` (not omit the key) to match. Foundation factory enforces this — confirm.

---

## §9. BigDecimal precision matrix

Java `SalesAnalysisServiceImpl.java` line 64-66 declares:

```java
private static final int SCALE = 4;             // intermediate division
private static final int DISPLAY_SCALE = 2;     // final field values
private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;
```

### Per-field scale targets

| Field | Java setScale call | Python equivalent |
|---|---|---|
| `value` (all 3 rankings) | `.setScale(2, HALF_UP)` (line 392, 526, 586) | `value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` |
| `target` (salesperson only) | `.setScale(2, HALF_UP)` (line 393) | `target.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` |
| `completionRate` (all) | `.setScale(2, HALF_UP)` (line 394, 527, 587) | `rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` |
| Internal division (`actual / target`, `value / total`) | `.divide(target, 4, HALF_UP)` (line 1170, 519, 579) | `(numer / denom).quantize(Decimal("1e-4"), rounding=ROUND_HALF_UP)` |

### Edge cases

- **target = 0 or null**: Java line 1167-1169 returns `BigDecimal.ZERO` → Python `_calculate_completion_rate` mirrors (returns `Decimal("0")`). Quantized to 0.01 → `0.00`.
- **total_sales = 0**: Java line 518-521 / 578-581 returns `BigDecimal.ZERO`. Python helper mirrors.
- **amount = null**: Java filter excludes (`d -> d.getAmount() != null` not used, but reducing tolerates BigDecimal.ZERO when null; the filter is `getProductCategory() != null` only). Python uses `Decimal("0")` for null amounts (defensive — Java's `BigDecimal::add` would NPE on null but `monthlyTarget` reducer uses null check; let plan task verify with empty-amount row).

### JSON serialization

⚠ Java Jackson emits `BigDecimal` as JSON number with trailing zeros preserved (`1234.50`, not `1234.5`). Python `Decimal('1234.50')` → `json.dumps()` default raises TypeError; must use:

- Option A: `json.dumps(..., default=str)` → emits `"1234.50"` (string) — DIFFERS from Java
- Option B: `Decimal('1234.50') → float(...)` then dump as number → may drop trailing zero (`1234.5`)
- Option C: pydantic field with `BaseModel.json()` configured with `Decimal` precision — investigate

Plan task: read alerts marathon precedent (commit `4a86d05f6` "feat(phase2a): port sales alert generator") — alerts spec already faced this. Re-use whatever pattern was chosen. Likely pydantic / FastAPI's `jsonable_encoder` with custom encoder.

---

## §10. Test fixtures (TestRankings)

Add 4 tests to `tests/python/smartbi_compat/test_analysis_sales_contract.py`:

```python
class TestRankings:
    """Sibling sub-spec: rankings. Runs alongside TestEnvelope."""

    def test_F001_salesperson_ranking_byte_shape(self, client, f001_token, monkeypatch):
        """Real impl produces non-empty salespersonRanking with stable sort."""
        # Use synthetic seed (or pre-seeded F001 test env data; see plan task)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        actual = _strip_volatile(response.json())
        with open(GOLDEN_DIR / "analysis-sales-F001.json", encoding="utf-8") as f:
            golden = json.load(f)
        expected = _strip_volatile(golden["response"])
        # Compare ONLY the salespersonRanking key — overview / trend may not be impl
        # at this point if specs run sequentially
        assert actual["data"]["salespersonRanking"] == expected["data"]["salespersonRanking"]

    def test_F001_product_ranking_byte_shape(self, client, f001_token, monkeypatch):
        """Real impl produces non-empty productRanking with stable sort + percentage."""
        # ... (same shape, different key)
        assert actual["data"]["productRanking"] == expected["data"]["productRanking"]

    def test_F001_customer_ranking_top_10_cap(self, client, f001_token, monkeypatch):
        """Customer ranking max 10 entries; if data has >10 customers, only top 10 by value."""
        response = ...  # same call
        actual = response.json()
        ranking = actual["data"]["customerRanking"]
        assert len(ranking) <= 10
        # Also assert sorted DESC (no ties to verify in real F001 data, but length cap is hard)

    def test_tie_stability_synthetic(self, monkeypatch):
        """Synthetic: two products with identical amount sort by name ASC for ties."""
        # Monkey-patch _query_sales_data to return rows where two products tie
        def fake_query(factory_id, range_):
            from collections import namedtuple
            Row = namedtuple("Row", "salesperson_name amount monthly_target product_category customer_name order_date")
            return [
                Row(None, Decimal("100"), None, "蛋类", None, None),
                Row(None, Decimal("100"), None, "蔬菜", None, None),
                Row(None, Decimal("200"), None, "肉类", None, None),
            ]
        monkeypatch.setattr(
            "backend.python.smartbi_compat.api.analysis_sales._query_sales_data",
            fake_query,
        )
        result = _get_product_ranking("F999", _make_year_range())
        assert result[0]["name"] == "肉类"        # value=200, rank 1
        assert result[1]["name"] == "蛋类"        # value=100 tied, name ASC → 蛋类 first
        assert result[2]["name"] == "蔬菜"        # value=100 tied, name ASC → 蔬菜 second
```

⚠ The first three tests gate on F001 having ≥1 row of sales data in test env (`smartbi_db.smart_bi_sales_data WHERE factory_id='F001'`). Per F001 golden inspection (line 1669-1680), all three rankings are currently `[]` → F001 test data is empty. Plan task **must** seed synthetic sales rows OR the tests are no-ops asserting `[] == []` (still valid contract test, but doesn't prove sort/percentage logic). Recommended approach:

- **Option A**: Seed real F001 data via SQL migration (e.g. `V20260430_03__seed_sales_data_for_phase2a.sql`) — risk: pollutes test env, affects other tests
- **Option B**: Use synthetic monkey-patch (like `test_tie_stability_synthetic`) for non-empty assertions; keep F001 empty-state byte test
- **Option C**: Add a calibration fixture file (e.g. `analysis-sales-rankings-fake-F001.json`) recorded against a Python-side fake `_query_sales_data` — like Phase 2A F999 calibration golden pattern (commit `f84101d53`)

Recommended **Option C** — least invasive, follows established Phase 2A calibration golden precedent. Plan task implements.

---

## §11. Risk register (rankings-specific; foundation has the cross-cutting list)

| # | Risk | Severity | Mitigation | Owner |
|---|---|---|---|---|
| **R1** | Sort stability across Java HashMap and Python dict (foundation §8 R1) | High | Python-side composite sort key `(-value, name)`. Re-record F001 mandatory. | rankings impl |
| **R3** | BigDecimal precision: `Decimal.quantize` vs Java `setScale`; JSON serialization of trailing zeros | Medium-High | §9 quantize matrix. Re-use alerts spec JSON serialization pattern (commit `4a86d05f6`). | rankings impl |
| **R11** | F001 test env has no sales data → `salespersonRanking == []`, real impl is exercised only by synthetic tests (not F001 byte-shape) | Medium | Use Option C (calibration golden); keep F001 empty-state byte test as regression for empty-state path | rankings impl |
| **R12** | Java `getSalespersonRanking` uses two queries (aggregate + raw); Python uses one (raw only). Null-handling or precision divergence may cause F001 byte mismatch | Low-Medium | Plan task: monitor F001 byte compare after re-record. Fallback: add `_query_salesperson_aggregates` SQL helper. | rankings impl |
| **R13** | Java `productRanking` filter is `getProductCategory() != null` (line 499); some test data may have null categories silently dropped. Python mirrors but verify count match. | Low | Plan task adds row-count assertion to F001 product test before byte compare. | rankings impl |
| **R14** | Top-10 cap on customer ranking: Java line 574 `.limit(10)` AFTER sort. Python `[:10]` after sort matches. Edge: if ties at boundary (rank 10 + rank 11 same value), Java's `.limit()` keeps the FIRST 10 in iteration order (HashMap nondeterministic). Python sorts stably first, so deterministic. | Low | Tie-stability test covers; Python is more deterministic than Java here, golden re-record captures. | rankings impl |

R2, R4-R10 are foundation-level and don't recur for rankings.

---

## §12. Open questions (TBD until impl)

These are intentionally deferred to plan tasks:

1. **JSON serialization of `Decimal`**: Confirm whether existing Phase 2A code path (alerts `_new_alert_dict`) uses `float` cast, `str` cast, or pydantic encoder. Mirror exact pattern. (R3)
2. **F001 sales data seed strategy**: Option A / B / C from §10. Recommend C; plan task confirms.
3. **`getSalespersonRanking` divergence**: Java uses 2 queries, Python uses 1. If F001 byte-shape mismatches after re-record, plan task escalates with options. (R12)
4. **Null-amount handling**: Java's `BigDecimal::add` would NPE on null amount; Java's groupingBy reducer in line 503-504 doesn't filter `getAmount() != null`. Either Java relies on amount being non-null in DB schema, or this is a latent NPE bug. Plan task verifies via DB schema check.
5. **Product/customer alertLevel always GREEN**: Confirm Java line 528 / 588 hard-codes GREEN. (Already grep-confirmed.) Document as Java intentional design (not a bug to fix).
6. **Recorder script behavior on empty data**: `scripts/phase2a/record-analysis-sales-goldens.sh` (foundation creates) — verify it captures Python's actual response, not Java's, when test env is configured to use Python `/analysis/sales` route. (Likely runs against port 10011 still — the Java compat shim returns the same route.)

---

## §13. Acceptance criteria

Rankings sub-spec impl is complete when:

- [ ] `_build_ranking` generic helper exists in `analysis_sales.py` with composite sort key
- [ ] `_calculate_completion_rate` + `_determine_completion_alert_level` helpers exist
- [ ] 5 module constants (`_SCALE`, `_DISPLAY_SCALE`, `_ROUNDING`, `_TARGET_RED_THRESHOLD`, `_TARGET_YELLOW_THRESHOLD`) declared
- [ ] `_get_salesperson_ranking` real impl replaces foundation stub; calls helper with `target_map`
- [ ] `_get_product_ranking` real impl replaces foundation stub; calls helper with `with_percentage=True`
- [ ] `_get_customer_ranking` real impl replaces foundation stub; calls helper with `with_percentage=True, top_n=10`
- [ ] `TestRankings` class with 4 tests added to `test_analysis_sales_contract.py`
- [ ] `test_tie_stability_synthetic` PASSES (validates sort stability)
- [ ] F001 golden RE-RECORDED via `scripts/phase2a/record-analysis-sales-goldens.sh` (mandatory step, not conditional)
- [ ] `test_F001_*_byte_shape` 3 tests PASS against re-recorded golden
- [ ] BigDecimal/Decimal precision matches Java: `value`, `target`, `completionRate` all at scale=2 with HALF_UP rounding
- [ ] No changes to: foundation dict factory shapes, route handler, composite assembly, Java code, `analysis.py`
- [ ] Existing alerts/recommendations/F999 envelope tests still PASS (no regression)

---

## §14. Plan structure preview

The rankings plan (separate file `docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-rankings.md`) will have phases:

- **Phase A** (~1-2 tasks): Pre-impl checks
  - Task A.1: Verify foundation merged (`_query_sales_data` returns `order_date`; stubs in place; F999 envelope test passes)
  - Task A.2: Confirm Decimal JSON serialization pattern from alerts spec; document in plan as reusable

- **Phase B** (~4 tasks): Code creation
  - Task B.1: Add module constants + `_calculate_completion_rate` + `_determine_completion_alert_level` helpers
  - Task B.2: Implement `_build_ranking` generic helper
  - Task B.3: Replace 3 stubs with real impls
  - Task B.4: Verify foundation F999 envelope test still passes (sub-services return real but on F999 → empty rows → empty rankings, byte-identical to stubs)

- **Phase C** (~4 tasks): Test creation
  - Task C.1: Add `TestRankings` class with 4 tests
  - Task C.2: Add tie-stability synthetic test (run + pass before deploy)
  - Task C.3: Decide F001 data seed strategy (Option C calibration golden recommended)
  - Task C.4: Add F001 calibration test fixture if needed

- **Phase D** (~3 tasks): Deploy + golden re-record (MANDATORY)
  - Task D.1: Deploy Python to test env (8084) via `./scripts/deploy/deploy-smartbi-python.sh --env test`
  - Task D.2: Run `scripts/phase2a/record-analysis-sales-goldens.sh` for F001 (and F999 to confirm no drift)
  - Task D.3: Commit re-recorded `analysis-sales-F001.json` (NOT same commit as code; separate commit per Phase 2A convention)

- **Phase E** (~2 tasks): Verification
  - Task E.1: Run full pytest suite — alerts/recommendations/F999/F001 all PASS
  - Task E.2: Check no regression in alerts contract tests (foundation extended `_query_sales_data` SQL; rankings doesn't touch but defensive verify)

Total: ~13-15 tasks, est. ~3-4h work for rankings chat.

### Parallel work analysis (per `.claude/rules/parallel-work-analysis.md`)

| Dimension | Parallel possible? |
|---|---|
| Subagent (single chat): code + tests | Yes — `_build_ranking` helper + 3 callers + tests are independent files / classes within `analysis_sales.py` and `test_analysis_sales_contract.py`. Concurrent subagents OK if file-locked. |
| Multiple chats (rankings + overview parallel) | NO — both edit `backend/python/smartbi_compat/api/analysis_sales.py`. Concurrent-edit-safety rule 1+2+5b applies. Must run sequentially OR use sub-worktrees. Recommended: rankings runs AFTER overview (or in own sub-worktree). |
| Re-record F001 golden | Sequential after impl deploy. No parallelism. |

---

End of rankings sub-spec.
