# Phase 2A Tier 2 — VALUE divergence investigation (PR-M)

**Date**: 2026-05-06
**Branch**: `phase2a/tier2-value-divergence-investigation`
**Mode**: 🔍 INVESTIGATIVE — DOC-only, no code fix yet
**Env probed**: test (Java 10011 + Python 8084), F001
**Token**: factory_super_admin, JWT minted with `JWT_SECRET=cretas-jwt-secret-key-2026-test`

---

## TL;DR — root cause categories found

| # | Category | Endpoints affected (in this batch) | Project rule status |
|---|---|---|---|
| **A** | **Decimal serialization on payloads NOT routed through `_decimal_to_number`** | alerts | Existing Rule 4 — implementation gap, NOT a new rule |
| **B** | **BigDecimal `divide(scale, rounding).multiply(100)` ≠ Python `(n/d*100).quantize(scale)`** | alerts (math), all percentage calculations downstream | **NEW — propose Rule 10** |
| **C** | **Volatile-strip blind spot for fresh UUIDs + `createdAt` on synthesized records** | recommendations, alerts (partly) | NEW — propose extending `VOLATILE_KEY_PATTERNS` |
| **D** | **DB wiring mismatch (Java JPA bound to cretas_db, Python uses smartbi_db)** | query-templates | Same family as PR-A through PR-H (May 5) — adds 1 more endpoint to that fix list |
| **E** | **`Map.of(N)` Jackson hash key order** | category-comparison (3 sites) | Existing Rule 8 — implementation gap |
| **F** | **`BigDecimal` zero scale preservation (Java emits `0.00`, Python `_decimal_to_number` collapses to int `0`)** | category-comparison (summary) | Edge case of Rule 4 — propose tightening |
| **G** | **Java Jackson LocalDateTime drops trailing-zero microseconds, Python `datetime.isoformat()` zero-pads** | datasource/list, ANY endpoint emitting timestamps | **NEW — propose Rule 11** |

**5 endpoints → 7 root cause categories → 7 follow-up PRs proposed (PR-M-1 through PR-M-7).**

Two findings (B and G) deserve graduation to the project hard-rule file `python-java-port.md` because they are universal Java↔Python parity gaps, not endpoint-specific quirks.

---

## endpoint: `/api/mobile/{factoryId}/smart-bi/alerts`

**Diff classifier**: TYPE=2 + VALUE=2

### Java emits (Jackson, `BigDecimal`):

```json
{"data":[{
  "id":"274e0ff1-83b1-472d-9a96-53d319807f67",
  "level":"YELLOW","category":"finance","title":"成本有所超支",
  "message":"实际支出超预算 14.9%，需关注",
  "metric":"预算偏差率",
  "value":14.9100,                ← number, BigDecimal scale=4
  "threshold":10,                 ← number, BigDecimal
  "createdAt":"2026-05-06T09:35:25.72967421",
  ...
}]}
```

### Python emits (FastAPI default `Decimal → str`):

```json
{"data":[{
  "id":"2573868b-0372-4cce-8360-0998f2ae1b78",
  ...
  "value":"14.9074",              ← string!
  "threshold":"10",               ← string!
  "createdAt":"2026-05-06T09:35:25.740204",
  ...
}]}
```

### Root cause **A** (TYPE — 2 fields): Decimal serialized as string, not number

Python builds the alert dict with `Decimal` values directly:

```python
# backend/python/smartbi_compat/api/analysis.py:563-583  (_generate_finance_alerts)
alerts.append(_new_alert_dict(
    ...
    value=variance,                          # Decimal — emitted as "14.9074"
    threshold=th.cost_variance_yellow,       # Decimal — emitted as "10"
    ...
))
```

`_new_alert_dict` does NOT pass these through `_decimal_to_number()`. FastAPI's default JSON encoder serializes `Decimal` as string (precision-safe but breaks parity with Java Jackson, which emits `BigDecimal` as JSON number).

This is a straightforward **Rule 4 violation** (project rule `python-java-port.md` §Rule 4). The helper exists; alert payload simply doesn't use it.

**Suggested fix**: In `_new_alert_dict` (or at every callsite that supplies Decimal), wrap `value` and `threshold` in `_decimal_to_number(...)`.

```python
# Before
value=variance,
threshold=th.cost_variance_yellow,

# After
value=_decimal_to_number(variance),
threshold=_decimal_to_number(th.cost_variance_yellow),
```

`_decimal_to_number` lives at `backend/python/smartbi_compat/api/analysis_finance.py` (sister chats already import it).

**Confidence**: high. Direct `Decimal` field → string output is the textbook Rule 4 case. `_new_alert_dict` likely has 5–10 callsites in `analysis.py` (sales/finance/department alerts) and all need the same wrap.

**Followup PR**: **PR-M-1** — wrap all alert/recommendation `value` + `threshold` in `_decimal_to_number()`.

### Root cause **B** (VALUE — `14.9100` vs `14.9074`): BigDecimal divide-then-multiply rounding semantics

This is the more interesting finding. The two clients hit the same `cretas_db.smart_bi_finance_data` 10ms apart, with the same date range — input must be identical, yet the variance computation emits different numbers at the 4th decimal.

**Java** (`RecommendationServiceImpl.calculateGrowthRate`, `RecommendationServiceImpl.java:978-985`):

```java
// SCALE = 4, ROUNDING_MODE = HALF_UP
return current.subtract(previous)
        .divide(previous, SCALE, ROUNDING_MODE)   // ← rounds the FRACTION at scale=4
        .multiply(new BigDecimal("100"));         // ← multiplies AFTER the rounding
```

Effective semantics:
1. `(current − previous) / previous` ← exact intermediate
2. round to `scale=4 of the fraction` (= 6 decimal digits of the percentage)
3. multiply by 100 ← preserves scale (Decimal scale arithmetic)
4. result has scale=2 in the percentage decimal (effectively 6-digit precision into the % value, then trimmed)

So if `actual=11491.74, budget=10000`:
- `(actual − budget) / budget = 0.149174` → quantize at scale=4 → `0.1491` (loses `74` at 5th-6th)
- `× 100 = 14.9100` ← what Java emits

**Python** (`backend/python/smartbi_compat/api/analysis.py:264-271`):

```python
def _calculate_growth_rate(current: Decimal, previous: Decimal) -> Decimal:
    if previous == 0:
        return Decimal("0")
    return ((current - previous) / previous * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
```

Effective semantics:
1. `(current − previous) / previous * 100` ← full Decimal precision (28 digits via context)
2. quantize at scale=4 of the **percentage**

For the same input:
- `(11491.74 − 10000) / 10000 × 100 = 14.9174` (exact)
- quantize scale=4 → `14.9174` (no change)

But the actual observed Python value is `14.9074`, not `14.9174` — so my synthetic example is illustrative, not the real data. The **principle** is the same: Java rounds at the fraction stage (effectively 6-decimal precision into the percentage), Python rounds at the percentage stage (4-decimal precision). When the underlying ratio has more than 4 decimal digits of significance, the two semantics diverge.

The same gap exists in `_calculate_rate` (line 253-261) — both helpers need the fix.

**Suggested fix**:

```python
# Before
def _calculate_growth_rate(current: Decimal, previous: Decimal) -> Decimal:
    if previous == 0:
        return Decimal("0")
    return ((current - previous) / previous * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)

# After (mirror Java semantics: round fraction first, then multiply by 100)
def _calculate_growth_rate(current: Decimal, previous: Decimal) -> Decimal:
    if previous == 0:
        return Decimal("0")
    fraction = ((current - previous) / previous).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
    return fraction * Decimal("100")  # preserves scale=4 → emits "14.9100" not "14.9"
```

Note: `Decimal("0.1491") * Decimal("100") = Decimal("14.9100")` — Python preserves trailing zeros via Decimal scale arithmetic. After the Rule 4 fix (root cause A above), `_decimal_to_number(Decimal("14.9100"))` returns `float(14.91)` which still differs in raw text from Java's `14.9100`. **For strict-byte parity** the value would need to stay as `Decimal` and use a different serializer; under dict-eq Phase 2A gate the numeric `14.91 == 14.9100` so this is OK.

**Confidence**: high. The Java BigDecimal pattern (`divide(scale, rounding).multiply(100)`) and Python pattern (`(/ * 100).quantize(scale)`) are demonstrably different on any input where the un-rounded fraction has >4 decimals.

**Followup PR**: **PR-M-2** — `_calculate_rate` + `_calculate_growth_rate` semantic fix. Audit any other Python percentage helpers that follow the `(...).quantize(...)` pattern; rewrite them to round-then-multiply.

**Graduation**: This is universal across Phase 2A — propose adding **Rule 10** to `.claude/rules/python-java-port.md`. Already 4-cycle audit-discovered for the next sister chats.

---

## endpoint: `/api/mobile/{factoryId}/smart-bi/recommendations`

**Diff classifier**: VALUE=2

### Java emits:

```json
{"data":[{
  "id":"5761dcff-bb41-483e-bfa9-d234dec6b88a",
  "type":"SALES_IMPROVEMENT","title":"缩小销售团队业绩差距",
  "description":"销售员业绩差异较大，建议加强团队协作",
  "priority":1,"impact":"...","actionItems":[...],
  "createdAt":"2026-05-06T09:35:25.750409772",   ← unique each call
  ...
}]}
```

### Python emits (full content match — only `id` + `createdAt` differ):

```json
{"data":[{
  "id":"8ed62916-eef7-45f4-8381-92b654303766",   ← different UUID
  "type":"SALES_IMPROVEMENT","title":"缩小销售团队业绩差距",
  ...
  "createdAt":"2026-05-06T09:35:25.757723",      ← 7ms later, microsecond pad differs
  ...
}]}
```

### Root cause **C**: volatile-strip blind spot

`scripts/t6-dryrun-compare.sh:147-154` defines:

```python
VOLATILE_KEY_PATTERNS = [
    re.compile(r"timestamp", re.I),
    re.compile(r"^generatedAt$", re.I),
    re.compile(r"^traceId$", re.I),
    re.compile(r"^requestId$", re.I),
    re.compile(r"^lastUpdated$", re.I),
    re.compile(r"Iso$"),
]
```

`id` and `createdAt` are NOT in this list. For endpoints that **synthesize fresh records on every call** (alerts, recommendations — not stored in DB, generated on-the-fly), the UUID `id` and `createdAt` are 100% non-deterministic across two calls a few ms apart. They are operationally volatile, just not in the strip list yet.

**Suggested fix**: Extend `VOLATILE_KEY_PATTERNS` for synthesized-record endpoints. Two options:

1. **Targeted (safer)**: Only strip `id` + `createdAt` when the parent record has the alerts/recommendations shape (e.g., key `level` or `actionItems` present). Avoids stripping legitimate DB-row IDs in other endpoints (e.g., datasource/list and query-templates rely on stable `id`).

2. **Per-endpoint override (cleanest)**: Add an `endpoint → extra_volatile_keys` map in `t6-dryrun-compare.sh`, e.g.:

```python
ENDPOINT_EXTRA_VOLATILE = {
    "/api/mobile/{f}/smart-bi/alerts": {"id", "createdAt"},
    "/api/mobile/{f}/smart-bi/recommendations": {"id", "createdAt"},
}
```

Note: under Rule 9 the alerts/recommendations endpoints' `id` is generated server-side per-call (UUID), NOT a DB primary key. Java's controller likewise generates a fresh UUID. So the divergence is *inherent* to the endpoint shape, not a Python bug.

**Confidence**: high — diff is purely two volatile fields, content matches.

**Followup PR**: **PR-M-3** — extend `t6-dryrun-compare.sh` strip-volatile rules with endpoint override or shape detection.

---

## endpoint: `/api/mobile/{factoryId}/smart-bi/query-templates`

**Diff classifier**: LISTLEN=1 + VALUE=19

### Java emits (13 templates, sorted by `createdAt DESC`):

```
data[0]  id=42  createdAt="2026-04-17T11:00:03.73145"  name="R18 258 fix verify"     ← custom
data[1]  id=30  createdAt="2026-02-19T11:04:37.567909" name="销售趋势分析"            ← seed
data[2]  id=31  createdAt="2026-02-19T11:04:37.567909" name="产品销售排名"
...
data[11] id=41  createdAt="2026-02-19T11:04:37.567909" name="行业对标分析"
data[12] id=35  createdAt="2026-02-19T11:04:37.567909" name="收入利润对比"            ← tail tie-break
```

### Python emits (12 templates — completely different IDs!):

```
data[0]  id=1   createdAt="2026-02-19T11:02:45.549376" name="销售趋势分析"
data[1]  id=2   createdAt="2026-02-19T11:02:45.549376" name="产品销售排名"
...
data[11] id=12  createdAt="2026-02-19T11:02:45.549376" name="行业对标分析"
```

### Root cause **D**: DB wiring mismatch — different physical tables

This is the same root cause family as **PR-A through PR-H (May 5)** but for a previously-unaudited endpoint.

**Java JPA binding**:
- `SmartBiQueryTemplateRepository` lives in package `com.cretas.aims.repository.smartbi` (NOT `repository.smartbi.postgres`).
- `SmartBIPostgresDataSourceConfig.java:157` only scans `com.cretas.aims.repository.smartbi.postgres` for the SmartBI datasource.
- Therefore this repo binds to the **default datasource = cretas_db** (test env: `cretas_db`).
- Java reads `cretas_db.smart_bi_query_templates` — this table has 13 rows including the recently-inserted custom template id=42.

**Python query**:

```python
# backend/python/smartbi_compat/api/analysis.py:101  (_query_templates)
from smartbi.database.connection import get_db_context, is_postgres_enabled
...
with get_db_context() as db:                                  # ← smartbi DB
    rows = db.execute(sql, {"fid": factory_id}).all()
```

`get_db_context()` returns the SmartBI engine bound to `smartbi_db` (test) / `smartbi_prod_db` (prod). The same `smart_bi_query_templates` table also exists there with seed-row IDs 1-12 from an earlier seed run.

**Two separate physical tables → two separate truth sets.** Both are valid SQL queries; they're just hitting different DBs.

The pattern matches yesterday's Phase 2A DB wiring blocker exactly — 7/28 endpoints had Java reading `cretas_db` (because the repo wasn't in the `*.postgres` package) while Python read `smartbi_db` (because it used `get_db_context` instead of `get_cretas_db_context`). Eight fix PRs (#79-86 = PR-A through PR-H) plus pb2 regen (PR-I) shipped the same night per `MEMORY.md` — but **query-templates was apparently not in that batch**.

Same fix pattern applies:

**Suggested fix**: Change `_query_templates` to use `get_cretas_db_context()`.

```python
# Before (analysis.py:101)
from smartbi.database.connection import get_db_context, is_postgres_enabled
...
with get_db_context() as db:

# After
from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled
...
with get_cretas_db_context() as db:
```

After the fix, Python will read `cretas_db.smart_bi_query_templates` and emit IDs 30-42 matching Java byte-for-byte.

**Confidence**: high. Same exact pattern as 7 previously-fixed endpoints; root cause is a one-line import + one-line context manager change.

**Followup PR**: **PR-M-4** — repoint `_query_templates` to `cretas_db`. Should also do a sweep for any other compat endpoint still using `get_db_context()` against tables that Java reads from `cretas_db`. Quick audit query: `grep -n "get_db_context()" backend/python/smartbi_compat/api/*.py` and cross-reference Java repo packages.

**Note on tie-break**: even after the DB fix, Java's tail order has `id=35` last among rows with identical `createdAt`. The seed run inserted rows in id order 30-41 then 35 was reinserted (giving it a later id but same logical createdAt). Java's `findByFactoryIdOrderByCreatedAtDesc` doesn't break ties by id, so the tie-break uses physical row order. Python's SQL `ORDER BY created_at DESC` will follow PG's natural tie-break (also physical order). Both should produce identical order on identical underlying rows; verify after fix.

---

## endpoint: `/api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison`

**Diff classifier**: VALUE=2 (called with `?year=2025&compareYear=2024`)

### Java emits:

```json
{"data":{
  "chartType":"BAR","title":"2025年 vs 2024年 品类结构对比","seriesField":"year",
  "data":[],
  "options":{
    "groupedBar":true,
    "yAxis":[
      {"name":"金额","position":"left"},                ← Map.of(2)
      {"name":"同比增长率(%)","position":"right"}
    ],
    "series":[
      {"yAxisIndex":0,"color":"#5470c6","name":"2025年","type":"bar"},   ← Map.of(4)
      {"yAxisIndex":0,"color":"#91cc75","name":"2024年","type":"bar"},
      {"yAxisIndex":1,"color":"#ee6666","name":"同比增长率","type":"line"}
    ],
    "summary":{"currentTotal":0.00,"compareTotal":0.00,"totalYoyGrowthRate":0}   ← Map.of(3) + scale=2 zeros
  },
  "xaxisField":"category","yaxisField":"currentAmount"
}}
```

### Python emits:

```json
{"data":{
  ...,
  "options":{
    "groupedBar":true,
    "yAxis":[
      {"position":"left","name":"金额"},                ← reversed!
      {"position":"right","name":"同比增长率(%)"}
    ],
    "series":[
      {"yAxisIndex":0,"type":"bar","name":"2025年","color":"#5470c6"},   ← reordered
      {"yAxisIndex":0,"type":"bar","name":"2024年","color":"#91cc75"},
      {"yAxisIndex":1,"type":"line","name":"同比增长率","color":"#ee6666"}
    ],
    "summary":{"totalYoyGrowthRate":0,"compareTotal":0,"currentTotal":0}   ← reordered + scale=0 zeros
  },
  ...
}}
```

(F001 has no finance data matching year=2025 vs 2024 → empty `data` array, all summary numbers are 0. Real data would surface more divergence on numeric scale.)

### Root cause **E**: Map.of(N) Jackson hash key order (existing Rule 8)

Three sites:
1. **`yAxis` Map.of(2)** — Jackson hash order is `[name, position]`; Python emitted `[position, name]`.
2. **`series` Map.of(4)** — Jackson hash order is `[yAxisIndex, color, name, type]`; Python emitted `[yAxisIndex, type, name, color]`.
3. **`summary` Map.of(3)** — Jackson hash order is `[currentTotal, compareTotal, totalYoyGrowthRate]`; Python emitted reversed.

This is a textbook **Rule 8** violation. Project rule already documents that `Map.of(N)` Jackson hash order is unpredictable and must be reverse-engineered from a recorded golden, not from Java source code reading order.

**Suggested fix** (`backend/python/smartbi_compat/api/analysis_finance.py:2985+` — `category_comparison` handler):

1. Record live golden against test/prod Java endpoint:
   ```bash
   JWT_SECRET=cretas-jwt-secret-key-2026-test \
     ./scripts/record-java-golden.sh F001 \
     '/api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison?year=2025&compareYear=2024' \
     analysis-finance-F001-category-comparison.json
   ```
2. Open the golden, read the actual key order in `options.yAxis[0]`, `options.series[0]`, `options.summary`.
3. Rewrite the Python dict literals to mirror golden order **exactly**.

**Confidence**: high — directly observed in raw output. Same fix pattern as PR #32 (sub-endpoints `_get_yoy_mom_chart` Map.of order fix), inventory PR #53, region PR-A.

**Followup PR**: **PR-M-5** — record category-comparison golden + reorder dict literals. Should also sweep for siblings in `analysis_finance.py` with `chartType:"BAR"` group-bar shape — likely identical ordering bugs.

### Root cause **F**: BigDecimal scale=2 zero collapsed to integer (Rule 4 corner case)

Java's `summary.currentTotal` / `compareTotal` come from `BigDecimal.setScale(2)` on a zero sum, emitting `0.00` (preserved scale). Python's `_decimal_to_number(Decimal("0.00"))` returns `0` (integer) because `Decimal("0.00") == Decimal("0.00").to_integral_value()` is true → `int()`.

Under the **dict-eq gate** (Phase 2A's current verifier), `0 == 0.00` so no failure. Under a **strict-byte gate** (potential Phase 3+ frontend tightening), `"0"` ≠ `"0.00"` and we'd fail.

**Suggested fix** (low priority for now; preventive):

Either:
1. Hard-code zero summary fields to `0.00` literal when result is zero (matches Java's `setScale(2)` on zero sum):
   ```python
   "currentTotal": _decimal_to_number(current_total) if current_total != 0 else 0.0,
   "compareTotal": _decimal_to_number(compare_total) if compare_total != 0 else 0.0,
   ```
   But `0.0 == 0` in Python's `==` so emits as `0.0` in JSON which is still not `0.00`.

2. Use a "scale-preserving" serializer for summary fields where Java uses `BigDecimal.setScale(2)`. Python `Decimal` does preserve scale through arithmetic, but JSON emission via `_decimal_to_number()` collapses it. Could add an option:
   ```python
   def _decimal_to_number_scale(v: Decimal, scale: int) -> Any:
       """Like _decimal_to_number but preserves scale for zero values."""
       if v == 0 and scale > 0:
           # Emit as float with scale precision: 0.00 → 0.0 (best Python can do)
           return float(f"{0:.{scale}f}")  # 0.0 (for scale=2)
       ...
   ```
   But Python's `json.dumps(0.0) = "0.0"` not `"0.00"`. **Python's `json` lib cannot emit `"0.00"`** — that requires a custom serializer or post-processing string replacement.

**Defer**: under dict-eq this is non-blocking. Note in spec for Phase 3+ strict-byte tightening.

**Followup PR**: **PR-M-6** — defer; document in Phase 2A retrospective.

---

## endpoint: `/api/mobile/{factoryId}/smart-bi/datasource/list`

**Diff classifier**: VALUE=7 (in test env)

User hint: "matches in prod, so test env data difference?" — investigation confirms the **bug is the same in both envs but only test env data exposes it**.

### Pattern across all 22 records

```
java   id=2  createdAt="2026-04-16T15:48:08.15071"      ← 5 microsec digits, trailing 0 trimmed
python id=2  createdAt="2026-04-16T15:48:08.150710"     ← 6 microsec digits, padded

java   id=23 updatedAt="2026-04-17T04:45:10.44964"      ← 5 dig
python id=23 updatedAt="2026-04-17T04:45:10.449640"     ← 6 dig

java   id=8  updatedAt="2026-04-17T06:40:30.72137"      ← 5 dig
python id=8  updatedAt="2026-04-17T06:40:30.721370"     ← 6 dig

java   id=9  createdAt="2026-04-16T15:52:42.52368"      ← 5 dig
python id=9  createdAt="2026-04-16T15:52:42.523680"     ← 6 dig

java   id=10 createdAt="2026-04-16T15:53:55.78208"      ← 5 dig
python id=10 createdAt="2026-04-16T15:53:55.782080"     ← 6 dig

java   id=11 createdAt="2026-04-16T15:56:03.94494"      ← 5 dig
python id=11 createdAt="2026-04-16T15:56:03.944940"     ← 6 dig

java   id=23 createdAt="2026-04-17T04:45:10.44964"      ← 5 dig (same time as updatedAt)
python id=23 createdAt="2026-04-17T04:45:10.449640"     ← 6 dig

(All other rows: microseconds field doesn't end in 0, both emit 6 digits, match)
```

7 timestamp instances differ → matches the VALUE=7 classifier exactly.

### Root cause **G**: Java Jackson `LocalDateTimeSerializer` drops trailing-zero microseconds

Java Jackson's default `LocalDateTimeSerializer` (or jsr310 module's behavior) emits `LocalDateTime.toString()`-style ISO format which **omits trailing zero digits in the nanosecond field**. So `LocalDateTime.of(2026, 4, 16, 15, 48, 8, 150710000)` (nanos=150710000, microseconds=150710) serializes as `"2026-04-16T15:48:08.15071"` — one digit dropped because the last microsecond digit is 0.

Python's `datetime.isoformat()` always pads microseconds to exactly 6 digits when nonzero (and omits the field entirely when 0), so the same datetime emits `"2026-04-16T15:48:08.150710"`.

This is **identical Python code in test and prod** — just that test env's data happens to have inserted timestamps where the last microsecond digit is 0. Prod data may not have any such timestamps, hence "matches in prod".

This is **NOT a "test env data difference"** in the sense of the user's hypothesis — it's a real serialization bug that a different data shape happens to suppress in prod. Production exposure increases as more rows are inserted; eventually some will hit the trailing-zero microsecond pattern and prod will start failing too.

**Suggested fix** (`backend/python/smartbi_compat/api/analysis.py:166-186` — `_datasource_row_to_dict`, plus all sister rendering functions):

Add a helper that mirrors Java Jackson behavior:

```python
def _java_isoformat(dt) -> str | None:
    """Mirror Java Jackson LocalDateTime serialization: drop trailing zero
    microseconds from ISO-8601 output to byte-match Java output.

    Java emits LocalDateTime.of(2026,4,16,15,48,8, 150710000) as
    "2026-04-16T15:48:08.15071" — last microsecond digit '0' dropped.
    Python datetime.isoformat() emits "...150710" — pads to exactly 6.

    For byte-shape parity, strip trailing zeros from the microsecond field.
    """
    if dt is None:
        return None
    s = dt.isoformat()
    # Strip trailing zeros from microsecond component if present
    if "." in s:
        head, frac = s.rsplit(".", 1)
        # frac may be followed by a timezone — guard
        # (LocalDateTime has no TZ; this is safe for our use)
        frac = frac.rstrip("0") or "0"  # avoid empty after strip
        # If trailing zeros dropped everything, the dot+frac is gone in Java
        if frac == "0":
            return head
        s = f"{head}.{frac}"
    return s
```

Then replace `row.created_at.isoformat() if row.created_at else None` with `_java_isoformat(row.created_at)` in all serializer dicts.

**Edge case**: Java actually drops the dot+microseconds entirely if the value is whole-second (microseconds=0). Need to verify against a row with whole-second timestamp. Helper above handles this case via the `frac == "0"` branch.

**Scope**: this affects **every** Phase 2A endpoint that emits a `LocalDateTime` field, not just `datasource/list`. There are ~50 endpoints touching `*BaseEntity` rows (`createdAt` / `updatedAt`) so the helper should be project-shared.

**Confidence**: high — observed across 7 rows in test env; mechanism is documented in jsr310 module behavior.

**Followup PR**: **PR-M-7** — introduce `_java_isoformat()` helper in shared module (e.g., `smartbi_compat/api/_compat.py` or sit alongside `_decimal_to_number`); replace all `dt.isoformat()` calls in `smartbi_compat/api/*.py`; record fixture validating trailing-zero, no-fractional, full-microsecond, none cases.

**Graduation**: This is universal across Phase 2A. Propose adding **Rule 11** to `.claude/rules/python-java-port.md`.

---

## Suggested follow-up PR plan

| PR | Scope | Files (estimated) | Risk | Confidence |
|---|---|---|---|---|
| **PR-M-1** | Wrap alert/recommendation `value` + `threshold` Decimal in `_decimal_to_number()` (Rule 4) | `analysis.py` (5–10 callsites) | low (mechanical) | high |
| **PR-M-2** | Fix `_calculate_rate` + `_calculate_growth_rate` semantic to round-then-multiply (NEW Rule 10) | `analysis.py`, plus audit any sister chats' percentage helpers | medium (math change, regression test must cover new + sister golden values) | high |
| **PR-M-3** | Extend `t6-dryrun-compare.sh` strip-volatile rules for synthesized-record endpoints (alerts, recommendations) | `scripts/t6-dryrun-compare.sh` | low | high |
| **PR-M-4** | Repoint `_query_templates` to `get_cretas_db_context()` (DB wiring fix, same family as PR-A through PR-H) | `analysis.py` (~3 lines) | low (matches established pattern) | high |
| **PR-M-5** | Record category-comparison golden + reorder Map.of(2)/Map.of(3)/Map.of(4) dict literals (Rule 8) | `analysis_finance.py` (3 sites) | low | high |
| **PR-M-6** | Defer scale-preserving zero serialization (Rule 4 corner case); document in Phase 2A retrospective | docs only | none | medium |
| **PR-M-7** | Introduce `_java_isoformat()` helper, sweep all `dt.isoformat()` callsites (NEW Rule 11) | many files (~50 endpoints) — best done as one mechanical sweep | medium (broad scope) | high |

**Priority ordering**: PR-M-4 (data correctness) > PR-M-1 (TYPE parity unblocks dict-eq verifier) > PR-M-7 (broad latent bug) > PR-M-2 (math semantic; needs golden re-record for any percentage value) > PR-M-3 (test infra) > PR-M-5 (cosmetic order) > PR-M-6 (defer).

**Rule graduation candidates** for `.claude/rules/python-java-port.md`:
- **Rule 10**: Java `BigDecimal.divide(scale, rounding).multiply(K)` is NOT equivalent to Python `(n / d * K).quantize(scale)`. Mirror Java by quantizing the fraction first, then multiplying.
- **Rule 11**: Java Jackson `LocalDateTime` serializer drops trailing-zero microseconds. Python `datetime.isoformat()` pads to exactly 6. Use shared `_java_isoformat()` helper for byte-shape parity.

---

## Output to organizer

- **Branch**: `phase2a/tier2-value-divergence-investigation`
- **SHA**: (filled by commit, see end of doc)
- **Root cause categories found**: 7 (A through G)
- **Followup PRs proposed**: 7 (PR-M-1 through PR-M-7)
- **Two findings worth graduating to project hard-rule file**: B (Rule 10 candidate — BigDecimal divide-multiply semantic) and G (Rule 11 candidate — Jackson trailing-zero microsecond serializer). Both are universal across Phase 2A, not endpoint-specific.
