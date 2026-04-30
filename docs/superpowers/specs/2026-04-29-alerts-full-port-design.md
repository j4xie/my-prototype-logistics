# Phase 2A — `/alerts` Full Port Design

| Field | Value |
|---|---|
| **Status** | Draft, awaiting user review (this chat: spec only — no implementation) |
| **Created** | 2026-04-29 |
| **Owner** | stevenj4xie |
| **Worktree** | `C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc` |
| **Branch** | `phase2a/t5-poc` |
| **Successor skill** | `superpowers:writing-plans` — formalizes §6 marathon outline into an actionable plan document |

---

## 1. Context

Phase 2A: port 50 SmartBI Java endpoints to Python aliases for byte-shape parity before T6 nginx cutover. As of Apr 29, 3 thin Z-class endpoints have shipped (data-date-range PoC + query-templates + datasource-list). The remaining 47 contain ~10 endpoints backed by 1000+ LOC services in `RecommendationServiceImpl` / `*AnalysisServiceImpl` — far more complex than T0 size estimate.

This spec covers `GET /api/mobile/{factory_id}/smart-bi/alerts` — the simplest of the 1000+ LOC service endpoints, suitable as a precedent for the rest of the analysis subdomain (procurement / region / department / sales / finance / production / quality / inventory / recommendations).

**Why now**: calibrate the Phase 2A 256h estimate against a real "factory-with-data + threshold logic + per-element loops" port. Result feeds back into deferred-endpoints plan §4 to refine downstream estimates.

**Reference docs**:
- `docs/superpowers/handoff/2026-04-29-phase2a-batch-2-handoff.md` — what's done before this chat
- `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md` §4 — original `/alerts` scope sketch

---

## 2. Goals

### In scope
1. Python alias for `GET /api/mobile/{factoryId}/smart-bi/alerts[?category=sales|finance|department]`
2. Faithful 1:1 port of `RecommendationServiceImpl.generateSalesAlerts/Finance/Department/All` business logic
3. F999 synthetic test factory (factories row + user + smart_bi seed copy from DEMO_FACTORY) — reusable foundation for the rest of Phase 2A
4. Bundled `alert_thresholds.json` + Python loader + CI diff guard against Java's copy
5. Java sort fix in `RecommendationServiceImpl` (sales + department generators use `HashMap.entrySet()` iteration → non-deterministic across JVM restarts)
6. Contract tests + unit tests + golden recordings for all 4 entry points
7. ADR for "factory-with-synthetic-data" pattern (deferred plan §4 deliverable)

### Non-goals (explicitly deferred)
- `/recommendations` endpoint (same `RecommendationServiceImpl`, separate scope)
- `/alerts` POST/write variants (none exist)
- Migration of the standalone `smart_bi_alert_thresholds` PG table to be authoritative — orthogonal Phase 3 cleanup
- DEMO_FACTORY data cleanup from prod database — pre-existing pollution, separate PR
- Multipart / SSE / write-op endpoints from deferred plan §3
- Java enum bug fix from deferred plan §1 — not blocking `/alerts`

---

## 3. Architecture

### 3.1 Module placement

```
backend/python/smartbi_compat/
├── api/
│   └── analysis.py            (+~250 LOC: 4 routes + 4 generator helpers)
├── alert_thresholds.py        (NEW, ~80 LOC: typed loader + dataclasses)
├── date_range.py              (NEW, ~30 LOC: Python equivalent of DateRangeUtils.DateRange + rangeByPeriod)
└── config/
    └── alert_thresholds.json  (NEW: byte-equal copy of Java's classpath JSON)
```

`analysis.py` already exists with `query-templates` + `datasource-list` routes. New routes follow the same triplet pattern (route handler → module-level `_query_*` DB seam → `_*_row_to_dict` is replaced here by `_generate_*_alerts` business helper).

### 3.2 Threshold loader (`alert_thresholds.py`)

- Module-level `load_thresholds() -> Thresholds` parses bundled JSON on import
- Falls back to hardcoded defaults matching `RecommendationServiceImpl` line 65–79 if JSON missing
- Exports three `@dataclass(frozen=True)` types: `SalesThresholds`, `FinanceThresholds`, `DepartmentThresholds`
- All numeric fields use `Decimal` (not float) — matches Java BigDecimal semantics

**Drift defense (CI guard)**: GitHub Actions workflow (or pre-commit hook) compares the bundled copy against the Java source:

```yaml
- name: Verify alert_thresholds.json parity
  run: |
    diff backend/python/smartbi_compat/config/alert_thresholds.json \
         backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json
```

Non-zero exit → CI fails. This closes the "Java edited, Python forgot" drift class.

**Decision**: bundle (not symlink, not absolute-path read) — Python deploys to `/www/wwwroot/cretas/code/backend/python/`, Java's `resources/` is inside the jar. No filesystem path bridges those.

### 3.3 F999 foundation

New migration `V20260430_01__phase2a_test_factory_F999.sql` (PG-converted):

```sql
-- 1. Factory entity (idempotent)
INSERT INTO factories (id, name, factory_type, ...)
VALUES ('F999', 'Phase 2A Test Factory', 'TEST', ...)
ON CONFLICT (id) DO NOTHING;

-- 2. Test user (password from env-injected placeholder; see §3.4)
INSERT INTO users (
    id, username, factory_id, role, password_hash, ...
) VALUES (
    'phase2a_test_user_id',
    'phase2a_test_user',
    'F999',
    'factory_super_admin',
    '${PHASE2A_TEST_USER_PASSWORD_HASH}',
    ...
)
ON CONFLICT (username) DO NOTHING;

-- 3. SmartBI seed copy from DEMO_FACTORY
INSERT INTO smart_bi_sales_data (factory_id, order_date, salesperson_id, ...)
SELECT 'F999', order_date, salesperson_id, ...
FROM smart_bi_sales_data
WHERE factory_id = 'DEMO_FACTORY'
ON CONFLICT DO NOTHING;
-- (same for smart_bi_finance_data, smart_bi_department_data, smart_bi_billing_config)
```

Reuses the existing 198-line `V2026_01_18_02__smart_bi_sample_data.sql` content via `INSERT ... SELECT`. No new fixture authoring.

### 3.4 F999 user password handling (Q2 decision: env-var injection)

- Migration uses placeholder `${PHASE2A_TEST_USER_PASSWORD_HASH}` (Flyway placeholder syntax; **escape `$` carefully** — see `feedback_flyway_dollar_brace_placeholder.md`)
- `.env.test` and `.env.prod` set `PHASE2A_TEST_USER_PASSWORD_HASH=<bcrypt-hash>`
- Recorder reads plaintext from a separate env var: `PHASE2A_TEST_USER_PASSWORD`
- **Prod posture**: `.env.prod` may set `PHASE2A_TEST_USER_PASSWORD_HASH=DISABLED` to render the user un-loginable in prod (login flow rejects "DISABLED" hash). Test env sets a real bcrypt hash.
- Rotation: regenerate hash + update both env files; redeploy. No code change.

### 3.5 Java sort fix

Two locations in `RecommendationServiceImpl`:

| Line range | Change |
|---|---|
| ~252-271 (sales per-salesperson loop) | Wrap the existing `Map<String, BigDecimal> salespersonSales` in a `TreeMap<>(salespersonSales)` (or replace the `Collectors.groupingBy()` collector with a `TreeMap` supplier: `Collectors.groupingBy(..., TreeMap::new, Collectors.reducing(...))`). For-each loop body unchanged. |
| ~396-431 (department per-department loop) | Same pattern: wrap `byDepartment` in a `TreeMap<>` (or use `TreeMap` supplier in `Collectors.groupingBy`). |

`generateAllAlerts` (line 438) sorts by `AlertLevel.severity` DESC — already deterministic; **no change**. Finance generator (`for (data : financeData)`) iterates a List from repository — already stable; **no change**.

Add 2 Java unit tests in `RecommendationServiceImplTest`:
- `salesAlertsAreSortedBySalespersonName`: input 3 salespeople in random order → output `relatedEntityName` lex-sorted
- `departmentAlertsAreSortedByDepartmentName`: same pattern

### 3.6 Recorder updates

`scripts/phase2a/record-java-golden.mjs` — add 4 endpoint definitions for `alerts` / `alerts-sales` / `alerts-finance` / `alerts-department`. **No login-flow code change** — the script already accepts `--user` / `--password` / `--factory` CLI flags.

New convenience wrapper: `scripts/phase2a/record-alerts-goldens.sh`:
```bash
#!/usr/bin/env bash
# Wraps record-java-golden.mjs with F999 + alert endpoint preset
exec node scripts/phase2a/record-java-golden.mjs \
  --base "${BASE_URL:-http://localhost:10011}" \
  --user phase2a_test_user \
  --password "${PHASE2A_TEST_USER_PASSWORD:?must set}" \
  --factory F999 \
  --endpoints alerts,alerts-sales,alerts-finance,alerts-department
```

Reusable for the next Phase 2A endpoint that needs F999 — just change `--endpoints`.

---

## 4. Components

### 4.1 Common pattern (all 4 entry points)

```python
def _generate_<X>_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    rows = _query_<X>_data(factory_id, range_)  # SQLAlchemy module-level seam
    if not rows:
        return []
    alerts = []
    # ... build alerts based on threshold checks (per-generator logic below)
    return alerts
```

Each `_query_<X>_data` is a module-level function so contract tests can monkey-patch without standing up Postgres (matching dashboard.py PoC pattern).

### 4.2 Sales generator (`_generate_sales_alerts`)

**Data source**: `SELECT * FROM smart_bi_sales_data WHERE factory_id = :fid AND order_date BETWEEN :start AND :end`

**Three alert types** (1:1 with Java line 162-274):

1. **整体目标完成率** (max 1 alert):
   - `completion_rate = sum(amount) / sum(monthly_target) * 100`
   - `< red (60)` → RED alert "销售目标严重滞后"
   - `< yellow (80)` → YELLOW alert "销售目标需加速"
2. **环比增长** (max 1 alert; requires extra query for previous month):
   - Fetch previous-month data via second `_query_sales_data(factory_id, prev_month_range)`
   - `growth = (current_sum - prev_sum) / prev_sum * 100`
   - `< red (-20)` → RED alert "销售额大幅下降"
   - `< yellow (-10)` → YELLOW alert "销售额有所下降"
3. **Per-salesperson loop** (N alerts):
   - Group by `salesperson_name` → sum amount + sum target
   - Sort entries by salesperson name (matches Java sort fix)
   - For each: `rate = sum / target * 100`, if `< red (60)` → RED alert with `relatedEntityName = name`

### 4.3 Finance generator (`_generate_finance_alerts`)

**Data source**: `SELECT * FROM smart_bi_finance_data WHERE factory_id = :fid AND record_date BETWEEN :start AND :end`

**Three alert types** (1:1 with Java line 278-376):

1. **应收账款账龄** (per-record loop on List — already stable):
   - For each row where `receivable_amount > 0`:
     - `aging_days > red (90)` → RED alert "应收账款严重逾期"
     - `aging_days > yellow (60)` → YELLOW alert "应收账款即将逾期"
2. **成本超预算** (max 1 alert):
   - `variance = (sum(actual) - sum(budget)) / sum(budget) * 100`
   - `> red (20)` → RED alert "成本严重超支"
   - `> yellow (10)` → YELLOW alert "成本有所超支"
3. **大额应收** (max 1 alert):
   - `total_receivable = sum(receivable_amount)`
   - `> red (1,000,000)` → RED alert "应收账款总额过高"
   - `> yellow (500,000)` → YELLOW alert "应收账款总额较高"

### 4.4 Department generator (`_generate_department_alerts`)

**Data source**: `SELECT * FROM smart_bi_department_data WHERE factory_id = :fid AND record_date BETWEEN :start AND :end`

**One alert type** (1:1 with Java line 380-434):

- **人均产出过低** (per-department loop):
  - Group by `department` → sum `sales_amount`, max `headcount`
  - Sort entries by department name (matches Java sort fix)
  - `per_capita = total_sales / headcount` (BigDecimal scale 4, ROUNDING_MODE HALF_UP)
  - `< red (50000)` → RED alert "X 人均产出过低"
  - `< yellow (80000)` → YELLOW alert "X 人均产出偏低"

### 4.5 Aggregator (`_generate_all_alerts`)

```python
def _generate_all_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    all_alerts = []
    all_alerts.extend(_generate_sales_alerts(factory_id, range_))
    all_alerts.extend(_generate_finance_alerts(factory_id, range_))
    all_alerts.extend(_generate_department_alerts(factory_id, range_))
    # Match Java: sort by AlertLevel severity DESC
    # AlertLevel: GREEN=0, YELLOW=1, RED=2, CRITICAL=3
    all_alerts.sort(key=lambda a: -ALERT_SEVERITY[a["level"]])
    return all_alerts
```

`ALERT_SEVERITY` constant in `alert_thresholds.py`:
```python
ALERT_SEVERITY = {"GREEN": 0, "YELLOW": 1, "RED": 2, "CRITICAL": 3}
```

Python `list.sort` is **stable**, so within-severity ties preserve sub-generator output order (sales → finance → department) — same as Java's stable sort.

### 4.6 Route signature

```python
@router.get("/api/mobile/{factory_id}/smart-bi/alerts")
async def get_alerts(
    factory_id: str,
    category: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    range_ = DateRange.by_period("month")  # mirror DateRangeUtils.rangeByPeriod
    if category == "sales":
        alerts = _generate_sales_alerts(auth.factory_id, range_)
    elif category == "finance":
        alerts = _generate_finance_alerts(auth.factory_id, range_)
    elif category == "department":
        alerts = _generate_department_alerts(auth.factory_id, range_)
    else:
        alerts = _generate_all_alerts(auth.factory_id, range_)
    return wrap_response(alerts)
```

### 4.7 `DateRange` Python module (`date_range.py`)

```python
@dataclass(frozen=True)
class DateRange:
    start_date: date
    end_date: date

    @classmethod
    def by_period(cls, period: str) -> "DateRange":
        # Mirror DateRangeUtils.rangeByPeriod
        # period = "month" (only one used by /alerts):
        #   start = today.replace(day=1)
        #   end = last day of current month
        today = date.today()
        if period == "month":
            start = today.replace(day=1)
            # last day of month
            if today.month == 12:
                end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
            return cls(start, end)
        # other periods (today/week/quarter/year/default-30d) — defer until needed
        raise NotImplementedError(f"DateRange.by_period({period!r}) not yet ported")
```

Only `"month"` period is used by `/alerts` — defer the other branches until a downstream Phase 2A endpoint demands them (YAGNI).

### 4.8 Byte-shape contract (per-alert dict)

13 keys, strict Jackson order from `Alert.java` `@Data` declaration order:

```python
{
    "id": str(uuid4()),                          # NEVER byte-equal — test-normalized
    "level": "RED" | "YELLOW" | "GREEN",         # AlertLevel.name(); CRITICAL never emitted by these 4 generators
    "category": "sales" | "finance" | "department",
    "title": str,
    "message": str,
    "metric": str,
    "value": Decimal_str,                        # serialized to JSON like Java BigDecimal — see §4.9
    "threshold": Decimal_str,
    "gapPercent": Decimal_str | None,            # almost always null in current Java logic
    "suggestion": str,
    "relatedEntityId": str | None,               # almost always null
    "relatedEntityName": str | None,             # set on per-salesperson alerts (sales) and per-department alerts (department)
    "createdAt": "<ISO LocalDateTime>",          # NEVER byte-equal — test-normalized
}
```

`id` and `createdAt` are inherently fresh per `Alert.builder().build()` invocation. Contract tests strip these fields before deep-equal against goldens (same pattern as `tests/python/smartbi_compat/test_contract_compat.py::assert_envelope` already established).

Outer envelope is the existing 5-key Java `ApiResponse.success` shape (`code, message, data, timestamp, success`) via `wrap_response()` — no change.

### 4.9 BigDecimal ↔ Python Decimal serialization

Java `Alert.value` is `BigDecimal`. Jackson default serializes BigDecimal as a JSON number (no quotes), preserving scale. e.g. `15000.00` → `15000.00`, `0.3000` → `0.3000`.

Python: use `Decimal` for arithmetic; serialize via `json.dumps(..., default=lambda d: float(d) if isinstance(d, Decimal) else ...)` — but float coercion loses scale.

**Decision**: extend `wrap_response` (or add a custom JSON encoder for the alerts route) to emit Decimal as a JSON number with explicit scale matching Java's BigDecimal. Implementation detail: write `Decimal` → string via `format(d, 'f')` then re-emit as a raw JSON token (Python `json` doesn't natively support BigDecimal-equivalent emission). Concretely:

- Use `simplejson` (already in requirements) with `use_decimal=True` — it emits Decimal as a JSON number preserving scale.
- Or: build the response dict with `Decimal` values and use a custom `JSONResponse` subclass.

To be confirmed during chat 2 implementation; spec defers exact mechanism but **requires** scale preservation (e.g. `0.3000` not `0.3`).

### 4.10 Helper utilities (mirror Java `RecommendationServiceImpl` private methods)

- `_sum_field(rows, field_name) -> Decimal` — replaces Java `sumField(data, ::getX)`
- `_calculate_rate(numerator, denominator) -> Decimal` — denominator zero → return Decimal("0"); else `(num/den) * 100` quantized to scale 4
- `_calculate_growth_rate(current, previous) -> Decimal` — previous zero → 0; else `((current - previous) / previous) * 100`

All quantize to scale 4 with HALF_UP rounding to match Java's `RoundingMode.HALF_UP`.

---

## 5. Testing strategy

### 5.1 Java unit tests (chat 2 deliverable)

- `RecommendationServiceImplTest.salesAlertsAreSortedBySalespersonName` — fixture: 3 salespeople with non-alphabetical insertion order, all below red threshold; assert output `relatedEntityName` is lex-sorted
- `RecommendationServiceImplTest.departmentAlertsAreSortedByDepartmentName` — analogous
- Run: `mvn -pl cretas-api test -Dtest=RecommendationServiceImplTest`

### 5.2 Python contract tests (`tests/python/smartbi_compat/test_alerts_contract.py`)

- Import `from main import app` (production main:app via importlib by absolute path — handoff established pattern)
- 4 fixtures monkey-patch `_query_sales_data` / `_query_finance_data` / `_query_department_data` to return in-memory rows (no PG dependency)
- 4 contract test cases:
  - `test_alerts_default_returns_aggregator()` — no `?category` → all 3 generators concatenated, severity-sorted
  - `test_alerts_category_sales()` — `?category=sales` → only sales alerts
  - `test_alerts_category_finance()` — same for finance
  - `test_alerts_category_department()` — same for department
- 4 golden compare cases (read fixture file, strip `id` + `createdAt` + envelope `timestamp`, assert deep-equal):
  - `alerts-F999.json`, `alerts-F999-sales.json`, `alerts-F999-finance.json`, `alerts-F999-department.json`

### 5.3 Python unit tests (`tests/python/smartbi_compat/test_alerts_logic.py`)

**Coverage criteria** (not test count): each generator must cover, at minimum:
- Empty input → returns `[]`
- Each threshold boundary (red exact / red+1 / yellow / yellow+1) for each alert type — confirms threshold direction (LT vs GT) matches Java
- Null-field handling (e.g. salesperson with null `monthly_target`)
- BigDecimal scale preservation (assert `value` field has 4 decimal places where Java emits scale 4)

Plus aggregator tests:
- Severity sort ordering (RED entries before YELLOW before GREEN)
- Stable sort within severity (sales → finance → department)
- Empty cross-product (`_query_*` all return `[]`) → aggregator returns `[]`
- Mixed (sales empty, finance non-empty) → only finance alerts

### 5.4 Golden recording flow

```bash
# Pre-req: F999 migration deployed to test env (chat 2 step 1)
ssh -N -L 10011:localhost:10011 root@47.100.235.168 &

export PHASE2A_TEST_USER_PASSWORD=<plaintext from .env.test>
./scripts/phase2a/record-alerts-goldens.sh

# Outputs to tests/fixtures/java-smartbi-golden/:
#   alerts-F999.json
#   alerts-F999-sales.json
#   alerts-F999-finance.json
#   alerts-F999-department.json
```

If Java sort fix has not yet shipped, re-record after sort fix deploys (goldens will be byte-different on the per-salesperson + per-department arrays because of sort order change).

---

## 6. Plan structure (marathon — 2 chats)

This spec maps to a `superpowers:writing-plans` plan with these phases:

### Chat 2 — Sales generator + foundation (~6-8 commits)

| Step | Deliverable | Commit |
|---|---|---|
| 1 | F999 migration (factories + users + smart_bi seed copy) deployed to test env | feat(phase2a): synthetic F999 test factory |
| 2 | F999 ADR | docs(phase2a): F999 synthetic test factory ADR |
| 3 | Java sort fix (sales + department generators) + 2 unit tests | fix(smartbi): sort alerts by entity name for byte-shape stability |
| 4 | `alert_thresholds.json` bundle to Python + `alert_thresholds.py` loader + CI diff guard workflow step | feat(phase2a): bundle alert thresholds + CI parity guard |
| 5 | `date_range.py` (month period only) + `_query_sales_data` seam + `_generate_sales_alerts` Python | feat(phase2a): port sales alert generator |
| 6 | Sales contract test + golden | test(phase2a): sales alert contract + golden vs Java |
| 7 | Sales unit tests (boundaries + null fields + scale preservation) | test(phase2a): sales alert generator unit tests |
| 8 | Deploy test env + smoke verify against `factory_admin1`/F001 (returns []) and `phase2a_test_user`/F999 (returns expected alerts) | (no code commit; deploy log in chat) |

Marathon close: run `superpowers:verification-before-completion` skill — green the foundation milestone before chat 3.

### Chat 3 — Finance + department + aggregator (~5-7 commits)

| Step | Deliverable |
|---|---|
| 1 | Finance generator port + seam + 3 alert types | `_generate_finance_alerts` |
| 2 | Finance contract test + golden + unit tests |  |
| 3 | Department generator port + seam + 1 alert type (per-department loop) | `_generate_department_alerts` |
| 4 | Department contract test + golden + unit tests |  |
| 5 | Aggregator `_generate_all_alerts` + route 4-way dispatch + aggregator contract test + golden + sort unit tests |  |
| 6 | Phase 2A progress update (3 → 7 of 50) + deferred plan §4 calibration writeback | docs(phase2a): /alerts marathon close + 256h estimate calibration |
| 7 | Deploy test env + 4-way smoke verify (sales/finance/department/all on F999) |  |

Marathon close: run `superpowers:requesting-code-review` skill on the full diff vs `origin/main`.

---

## 7. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| BigDecimal scale loss in Python JSON serialization | Medium | §4.9 mandates explicit Decimal-aware encoder; chat 2 step 5 must include a unit test asserting `"0.3000"` not `"0.3"` |
| `DateRange.by_period("month")` boundary mismatch (e.g. Java includes last day at 23:59:59 but Python date-only excludes time) | Low | repository queries use `BETWEEN start_date AND end_date` on a DATE column (no time component); both Java and Python pass DATE → identical behavior. Confirmed by reading `findByFactoryIdAndOrderDateBetween` signature |
| AlertLevel.severity values diverge (Java enum vs Python constant) | Low | Section 4.5 hardcodes the constant; Java reference confirmed: GREEN=0, YELLOW=1, RED=2, CRITICAL=3 |
| Java sort fix changes existing prod customer alert ordering | Low | Customer-facing impact = within-category alert order (alphabetical instead of HashMap-arbitrary); semantically same alerts. Deploy test env first; ADR documents the change |
| F999 migration fails on prod (missing `factory_type` column or other schema drift) | Medium | Run migration on test env first; confirm prod schema parity before prod deploy; F999 deploy may be test-only until Phase 2A close-out |
| `PHASE2A_TEST_USER_PASSWORD_HASH=DISABLED` not respected by Spring Security login flow | Medium | Verify in chat 2 step 1: try logging in with random plaintext against the disabled hash → must return 401. If not respected, fall back to a real bcrypt hash + manual prod cleanup migration |
| Recorder fails on F999 because `factory_admin1` JWT was hardcoded somewhere | Low | Spec assumes recorder uses `--user --password --factory` flags consistently; if not, surfaces as chat 2 step 8 smoke failure |
| HashMap iteration produces same output as sorted list in test fixture (sort fix is undetectable) | Medium | Java unit tests use a fixture deliberately constructed to fail without sort (e.g., 3 salespeople in reverse-alphabetical insert order); Java HashMap insertion order is implementation-defined but typically preserves a hash-derived order which is NOT alphabetical for non-trivial fixtures |

---

## 8. Open items / explicit deferrals

| Item | Rationale for deferral |
|---|---|
| `/recommendations` endpoint (same RecommendationServiceImpl) | Separate scope, will benefit from this spec's foundation but has its own logic |
| Standalone `smart_bi_alert_thresholds` PG table activation | Java doesn't use it for /alerts; orthogonal Phase 3 cleanup |
| DEMO_FACTORY data cleanup from prod | Pre-existing pollution, separate PR |
| `DateRange.by_period` for non-month periods | YAGNI; defer until a downstream Phase 2A endpoint requires |
| BigDecimal exact serialization mechanism choice (simplejson vs custom encoder) | Implementation detail; chat 2 step 5 picks |
| Java `safeValueOf` enum bug (deferred plan §1) | Not blocking /alerts |

---

## 9. Cross-references

- **Brainstorm conversation**: this chat (2026-04-29)
- **Handoff doc**: `docs/superpowers/handoff/2026-04-29-phase2a-batch-2-handoff.md`
- **Deferred endpoints plan**: `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md` §4
- **F999 ADR (to be written in chat 2)**: `docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md`
- **Java reference files**:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` line 590-617
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImpl.java` line 162-454
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/Alert.java`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/enums/AlertLevel.java`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/util/DateRangeUtils.java`
  - `backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json`
  - `backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V2026_01_18_02__smart_bi_sample_data.sql`
- **Python reference files (existing patterns to follow)**:
  - `backend/python/smartbi_compat/api/analysis.py` (triplet pattern: route → seam → row helper)
  - `backend/python/smartbi_compat/api/dashboard.py` (PoC pattern, seam monkey-patching)
  - `backend/python/smartbi_compat/auth.py` (JWT verification + cross-factory enforcement)
  - `backend/python/smartbi_compat/schema_compat.py` (5-key envelope)
- **Recorder**: `scripts/phase2a/record-java-golden.mjs`

---

## 10. Acceptance criteria (when this marathon is "done")

- [ ] All 4 entry points (`/alerts`, `?category=sales|finance|department`) return Java-shape responses
- [ ] All 4 contract tests pass against recorded goldens
- [ ] Sales / finance / department / aggregator unit tests cover threshold boundaries + edge cases
- [ ] Java sort fix shipped + 2 Java unit tests pass
- [ ] CI diff guard for `alert_thresholds.json` in place + green
- [ ] F999 migration deployed to test env; F999 ADR committed
- [ ] Phase 2A counter updated: 3 → 7 of 50
- [ ] Calibration data point written into deferred plan §4 (actual hours vs T0 estimate)
