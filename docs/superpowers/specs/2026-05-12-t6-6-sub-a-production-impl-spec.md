# T6.6 Phase B Sub-A — `/analysis/production` Implementation Spec (Consolidated)

**Status**: ⛔ DRAFT — Implementation consolidation spec. No code, no migrations, no DDL, no deploy. Sister-chat dispatch input only.
**Spec date**: 2026-05-12
**Author**: chat4 (T6.6 Phase B Sub-A/B impl spec dispatch — Steve `/clear` 接 2026-05-12)
**Branch**: `spec/t6-6-sub-a-sub-b-impl-spec`
**Worktree**: `.worktrees/t6-6-sub-a-sub-b-impl-spec`
**Base SHA**: `3d4b702120` (origin/main HEAD as of 2026-05-12 dispatch)
**Audience**: chat-A1 / chat-A2 / chat-A3 sister impl chats (per §7 dispatch breakdown); reviewers running per-PR audit cycles
**Trigger**: organizer dispatch — "T6.6 Phase B Sub-A (Production) + Sub-B (Quality) impl spec DRAFT" + Q-DEC-6 F1 + Q-DEC-8 Option A verbal sign-off (PR #330 + PR #335 amend §5.2 ratified)

---

## 0. TL;DR

This spec **consolidates** prior T6.6 Phase B Production-related decision + impl-shape specs into a **single executable plan** for the `/analysis/production` Python port endpoint. It is the dispatch input for **3 sister impl chats** (chat-A1 factory branch, chat-A2 restaurant branch, chat-A3 envelope wiring) plus 2 combined chats (chat-AB-1 parity gate, chat-AB-2 cutover prep) shared with Sub-B.

| Item | This spec |
|---|---|
| Endpoint | `GET /api/mobile/{factoryId}/smart-bi/analysis/production` |
| Shape | Single URL, tenant-typed response envelope (Option A per Q-DEC-8, PR #330 §3.1) |
| Factory tenant | Mirror Java `ProductionAnalysisServiceImpl` mock — 4-metric OEE family (OEE/AVAILABILITY/PERFORMANCE/QUALITY) + 8 method entry points + LinkedHashMap charts/rankings. Per PR #199 detail spec (factory-branch method-by-method port). |
| Restaurant tenant | 3-metric envelope (KITCHEN_STATION_UTILIZATION / AVG_PREP_TIME / TABLE_TURNOVER_RATE) with `dataAvailability` markers per PR #330 §1 + PR #337 §3. Per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §3 module shape. |
| Tenant detector | `backend/python/smartbi_compat/tenant.py` (new shared module — also consumed by Sub-B) |
| New module | `backend/python/smartbi_compat/api/analysis_production.py` |
| Parity gate | **Factory branch**: Phase 2A dict-eq Java-vs-Python on F999/F001 (informational only — Java stays mock per Q1 §1). **Restaurant branch**: Python-vs-Python regression goldens on `R_ILTEATRO_REAL` pilot. Per Q1 amendment §4.5 + PR #330 §6.1. |
| Effort | Sub-A total ~5-6pd (3 sister chats per §7 batch breakdown). |
| Dependencies | Sub-ETL-3a/3b factory_id seed (V20260511_01/02 LIVE) + Sub-ETL-1c/2c canonical CSV → Silver pipeline. Without those, restaurant tenant returns all-null gracefully. |

⛔ **HOLD blocks**:
- This is a **consolidation impl spec**. No Python module creation, no DB queries, no migrations, no deploy.
- Sub-A impl chat dispatch (chat-A1/A2/A3) **HOLD** per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate; ETA ~2026-08-15 per MO filename).
- Phase B kickoff still requires Q-DEC-1..5 + Q-DEC-7 + Q-DEC-9 + Q-DEC-10 default acceptance per PR #330 §9 (currently 5 of 10 Q-DEC signed, 5 pending default acceptance).
- No Java side changes — `ProductionAnalysisServiceImpl` stays KEEP forever (Dashboard composite binds per PR #178 KEEP list).
- STOP-and-ping organizer BEFORE pushing this spec per HARD `feedback_pause_before_deploy_or_push.md`.

---

## 1. Endpoint Shape — Option A Polymorphic Envelope

### 1.1 URL contract

```
GET /api/mobile/{factoryId}/smart-bi/analysis/production
Query: startDate=YYYY-MM-DD, endDate=YYYY-MM-DD, analysisType={oee,efficiency,equipment} or omit for overview
Auth: JWT verify_jwt_and_factory dependency (existing helper)
```

Single URL serves **both factory and restaurant tenants**. Tenant-type discrimination happens server-side via `cretas_db.factories.type` lookup. Frontend uses one route for both.

### 1.2 Response envelope (per Q-DEC-8 Option A)

Top-level envelope is **stable across tenants**:

```jsonc
{
  "success": true,
  "data": {
    "startDate": "2026-05-01",       // ISO date, always present
    "endDate":   "2026-05-31",       // ISO date, always present
    "tenantType": "FACTORY"|"RESTAURANT",   // discriminator
    // Per-tenant payload (see §1.3 / §1.4) — body keys differ by tenantType
  },
  "message": "ok"
}
```

### 1.3 Factory tenant payload

Factory branch returns the existing Java `DashboardResponse` shape converted to Python dict. Per `2026-05-09-t6-6-production-port-detail.md` (PR #199 factory-branch detail spec) — fields:

| Key | Type | Source (Java DashboardResponse) | Notes |
|---|---|---|---|
| `period` | string | `"CUSTOM"` literal (line 109) | Always "CUSTOM" — only date-range mode supported |
| `tenantType` | string | NEW for §1.2 envelope | `"FACTORY"` |
| `kpiCards` | list[dict] | converted from MetricResult (line 89) | 4-12 cards per analysisType |
| `rankings` | LinkedHashMap[string, list[RankingItem]] | line 98-100 / 100-102 | Keys: `"equipment"` then `"production_line"` (Rule 8 byte order from F999 golden) |
| `charts` | LinkedHashMap[string, ChartConfig] | line 92-95 / 93-97 | Keys: `"oee_trend"`, `"production_line_comparison"`, `"downtime_distribution"` per analysisType |
| `aiInsights` | list[AIInsight] | line 103 | Mirror Java AI suggestion shape |
| `suggestions` | list[string] | line 106 | List of action strings |
| `generatedAt` | string (LocalDateTime → `_java_isoformat`) | line 117 | Use Rule 11 helper |
| `metricCards` | list[MetricResult] | @Deprecated (Lombok @Data emits) | Same as kpiCards but raw |
| `chartList` | list[ChartConfig] | @Deprecated | Flat list duplicate of `charts` |
| `alerts` | list[Alert] | @Deprecated | Empty in current mock |
| `recommendations` | list[Recommendation] | @Deprecated | Empty in current mock |
| `lastUpdated` | string\|null | @Deprecated | Null in mock |
| `fromCache` | boolean | line 116 | Always `false` in port |
| `cacheExpireAt` | string\|null | line 121 | Null in port |

**Rule 9 enforcement** (Lombok `@Data` on `DashboardResponse` + **no `@JsonInclude`**): **all fields emit explicitly including nulls and @Deprecated**. Python `_emit_with_nulls` pattern — never `if value: ... include` — always include.

### 1.4 Restaurant tenant payload

Restaurant branch returns redefined Q4 envelope (per PR #330 §1.2 + PR #337 §3.1 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §3):

```jsonc
{
  "startDate": "2026-05-01",
  "endDate":   "2026-05-31",
  "tenantType": "RESTAURANT",
  "metrics": [   // ordered list of 3 metrics — canonical order is M1, M2, M3
    {
      "metricCode": "KITCHEN_STATION_UTILIZATION",
      "value": null,
      "unit": "%",
      "trend": null,
      "alertLevel": null,
      "dataAvailability": "MISSING_KITCHEN_STATION_DATA"
    },
    {
      "metricCode": "AVG_PREP_TIME",
      "value": null,
      "unit": "minutes",
      "trend": null,
      "alertLevel": null,
      "dataAvailability": "MISSING_ORDER_TIMESTAMP_SPLIT"
    },
    {
      "metricCode": "TABLE_TURNOVER_RATE",
      "value": null,
      "unit": "turns_per_day",
      "trend": null,
      "alertLevel": null,
      "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
      "proxyMetric": {
        "metricCode": "BILLS_PER_STORE_PER_DAY",
        "value": 47.3,
        "unit": "bills_per_store_per_day",
        "trend": null,
        "alertLevel": null
      }
    }
  ]
}
```

**Per analysisType (oee/efficiency/equipment/overview) on restaurant**: 4-branch dispatch mirrors Java but restaurant branches reduce to same 3-metric envelope + per-mode auxiliary fields per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §3.3:

- `analysisType=oee` (or omitted): `metrics` + optional `trendChart` (null for restaurant — Q-DEC-1/Q-DEC-2 emit null so trend irrelevant)
- `analysisType=efficiency`: `metrics` + `ranking: []` (restaurant has no production-line ranking)
- `analysisType=equipment`: `metrics: []` + `ranking: []` + `downtimeChart: null` (restaurant has no equipment concept; Q4 omits M4 factory Quality subcomponent per PR #330 §1.2)
- `analysisType=overview` (default): `overview: {summary, kpis, recentChanges}` aggregate

### 1.5 Per-metric envelope field contract (canonical)

Common to **both factory KPI cards and restaurant metrics** — single envelope shape:

| Field | Type | Required | Semantics |
|---|---|---|---|
| `metricCode` | string | Yes | UPPER_SNAKE_CASE canonical code |
| `value` | number\|null | Yes | Numeric or null if unavailable |
| `unit` | string | Yes | `%` / `minutes` / `turns_per_day` / `bills_per_store_per_day` etc. |
| `trend` | "UP"\|"DOWN"\|"FLAT"\|null | Yes | Direction vs prior period |
| `alertLevel` | "RED"\|"YELLOW"\|"GREEN"\|null | Yes | Threshold band |
| `dataAvailability` | string\|null | No (Q-DEC-9 default: omit when OK) | Present only when value null OR proxy |
| `proxyMetric` | object\|null | No | Nested same-shape envelope when proxy substitution |

Factory branch uses this shape via converted `MetricResult` DTO (existing fields `metricCode`, `value`, `unit`, `alertLevel` map 1:1; trend/dataAvailability added by Python wrapper).

---

## 2. Factory Tenant Implementation

Factory branch is a **1:1 Python port** of Java `ProductionAnalysisServiceImpl` mock per `2026-05-09-t6-6-production-port-detail.md` (PR #199 detail spec). This spec does NOT duplicate that detail — it references it. The chat-A1 sister impl chat consumes PR #199 for method-by-method port directives.

### 2.1 Java method surface (8 entry points)

Mirror these public methods. Each maps to one or more Python helper functions.

| # | Java method | Signature | Python equivalent |
|---|---|---|---|
| 1 | `getOEEOverview(factoryId, startDate, endDate) → DashboardResponse` | default analysisType dispatch | `_factory_production_overview(factory_id, start_date, end_date)` |
| 2 | `getOEEMetrics(factoryId, startDate, endDate) → List<MetricResult>` | analysisType="oee" | `_factory_oee_metrics(factory_id, start_date, end_date)` |
| 3 | `getOEETrendChart(factoryId, startDate, endDate, period) → ChartConfig` | period="DAY" inside oee branch | `_factory_oee_trend_chart(factory_id, start_date, end_date, period)` |
| 4 | `getProductionEfficiency(factoryId, startDate, endDate) → List<MetricResult>` | analysisType="efficiency" | `_factory_production_efficiency(factory_id, start_date, end_date)` |
| 5 | `getProductionLineRanking(factoryId, startDate, endDate) → List<RankingItem>` | efficiency branch | `_factory_production_line_ranking(factory_id, start_date, end_date)` |
| 6 | `getEquipmentUtilization(factoryId, startDate, endDate) → List<MetricResult>` | analysisType="equipment" | `_factory_equipment_utilization(factory_id, start_date, end_date)` |
| 7 | `getEquipmentRanking(factoryId, startDate, endDate) → List<RankingItem>` | equipment branch | `_factory_equipment_ranking(factory_id, start_date, end_date)` |
| 8 | `getDowntimeDistributionChart(factoryId, startDate, endDate) → ChartConfig` | equipment branch | `_factory_downtime_distribution(factory_id, start_date, end_date)` |

### 2.2 Critical Java semantics to mirror

Per Track B Java audit:

- **Mock data source**: Java uses `generateMockProductionData(factoryId, startDate, endDate)` (line 340-401) — in-memory `List<Map<String, Object>>` with deterministic seed via `Random(factoryId.hashCode())`. **Per Q1 amendment §1: drop `_JavaRandom` LCG primitive entirely.** Python factory branch queries real DB (Q1 = real DB) — does NOT reproduce Java mock bit-exactly.
- **OEE 3-component formula** (line 441-442):
  ```java
  BigDecimal oee = availability.multiply(performance).multiply(quality)
          .divide(new BigDecimal("10000"), SCALE=4, ROUND_HALF_UP);
  ```
  Python (Rule 10): chain divide-then-multiply with intermediate `quantize(Decimal("0.0001"), ROUND_HALF_UP)` before final scale-2 quantize.
- **Capacity utilization** (line 157-160): `totalActualOutput.divide(totalTheoreticalOutput, 4, HALF_UP).multiply(100)` — Rule 10 pattern.
- **String.format display** (line 166): `String.format("%.1f%%", capacityUtilization.doubleValue())` — Rule 12 use `_format_decimal_half_up(value, 1) + "%"`.
- **LinkedHashMap key order** in `charts` (line 92-95) + `rankings` (line 98-100): Python dict literal insertion order MUST match — `["oee_trend", "production_line_comparison", "downtime_distribution"]` and `["equipment", "production_line"]`.
- **ChartConfig Lombok decapitalize** (Rule 9.1): `xAxisField` → `"xaxisField"` (lowercase `a`) in JSON. `yAxisField` → `"yaxisField"`. Verified by ChartConfig.java line 32 — no `@JsonInclude` annotation → null fields emit.

### 2.3 Real-DB query targets (Q1 path)

Per Q1 amendment §3.2 + §4.4, factory branch transitions from mock to real-DB. Source tables (cretas_db.smart_bi_* or smartbi_prod_db.fact_production_*):

| Java mock field | Python real-DB column | Source table | Notes |
|---|---|---|---|
| `plannedRuntime` | `planned_runtime_minutes` | `fact_production_batch` (likely Silver) | NEW — schema MAY NEED extension; chat-A1 verifies presence |
| `downtime` | `downtime_minutes` | `fact_equipment_event` | Status: TBD — investigate during chat-A1 |
| `actualRuntime` | `actual_runtime_minutes` | derived: planned - downtime | computed |
| `theoreticalOutput` | `theoretical_units` | `fact_production_batch` | TBD |
| `actualOutput` | `actual_units` | `fact_production_batch` | TBD |
| `goodUnits` | `good_units` | `fact_quality_inspection` | TBD |
| `totalUnits` | `total_units` | `fact_quality_inspection` | TBD |
| `failureCount` | `failure_count` | `fact_equipment_event` | TBD |
| `downtimeReason` | `downtime_reason` (enum) | `fact_equipment_event` | TBD |

⚠️ **chat-A1 BLOCKER awareness**: Factory tenant real-DB tables `fact_production_batch` / `fact_equipment_event` / `fact_quality_inspection` **MAY NOT YET EXIST** in current Silver layer (Track C audit confirms Phase 2A Silver tables are restaurant-centric: `fact_pos_*`, `fact_restaurant_*`). chat-A1 first step: **grep migrations for production-specific Silver tables; if absent, escalate to organizer** — may require new migration `V20260815_05__t6_6_factory_production_silver.sql` OR keep factory branch as Java-mock 1:1 mirror with deterministic seed (a controlled exception to Q1 = real-DB).

**Fallback decision** (recommended): If factory production Silver tables missing, **chat-A1 deferral** — port Java mock 1:1 (with `_JavaRandom` shim ONLY for factory branch, justified as scope-limited bridge until factory Silver schema ships in Phase 2D). This keeps Sub-A unblocked while flagging the gap. Restaurant branch (chat-A2) unaffected — uses existing `fact_pos_*` tables.

### 2.4 Factory branch goldens

Per Q1 §4.5: Java path stays mock; Python factory output is **informational parity check**, not regression gate.

| Golden | factory_id | analysisType | Path |
|---|---|---|---|
| 1 | F999 (test factory) | oee | `tests/fixtures/java-smartbi-golden/analysis-production-F999-oee.json` |
| 2 | F999 | efficiency | `analysis-production-F999-efficiency.json` |
| 3 | F999 | equipment | `analysis-production-F999-equipment.json` |
| 4 | F999 | overview | `analysis-production-F999-overview.json` |
| 5 | F001 (default seed) | oee | `analysis-production-F001-oee.json` |
| 6 | F001 | efficiency | `analysis-production-F001-efficiency.json` |
| 7 | F001 | equipment | `analysis-production-F001-equipment.json` |
| 8 | F001 | overview | `analysis-production-F001-overview.json` |

Record via `./scripts/record-java-golden.sh F999 F999 production <args>` (Java prod 10010 OR test 10011).

---

## 3. Restaurant Tenant Implementation

Restaurant branch is **3 new metric computations** per PR #330 §1.3 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §3.3-§3.5. This spec **references** the existing impl-shape spec for method bodies — chat-A2 sister consumes that spec for SQL/Python detail.

### 3.1 M1 — Kitchen Station Utilization (always null, Q-DEC-1 = A1)

Per PR #330 §1.3 M1 — emit static null + marker. No SQL query needed.

```python
def _build_kitchen_station_utilization_metric() -> dict:
    return {
        "metricCode": "KITCHEN_STATION_UTILIZATION",
        "value": None,
        "unit": "%",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "MISSING_KITCHEN_STATION_DATA",
    }
```

### 3.2 M2 — Average Prep Time (always null, Q-DEC-2 = B1)

Per PR #330 §1.3 M2 — emit static null + marker.

```python
def _build_avg_prep_time_metric() -> dict:
    return {
        "metricCode": "AVG_PREP_TIME",
        "value": None,
        "unit": "minutes",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "MISSING_ORDER_TIMESTAMP_SPLIT",
    }
```

### 3.3 M3 — Table Turnover Rate proxy (Q-DEC-3 = C1)

Per PR #330 §1.3 M3 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §3.5. See that spec for full Python implementation. Summary:

**SQL template** (chat-A2 uses this):

```sql
SELECT
    COUNT(*) AS bill_count,
    COUNT(DISTINCT store_id) AS store_count,
    COUNT(DISTINCT date) AS day_count
FROM fact_pos_transaction
WHERE factory_id = $1
  AND date BETWEEN $2 AND $3;
```

**Computation** (Rule 10 + Rule 4):
- `bills_per_store_per_day = bill_count / (store_count * day_count)`
- Intermediate `quantize(Decimal("0.0001"), ROUND_HALF_UP)` then final `quantize(Decimal("0.01"), ROUND_HALF_UP)`
- Serialize via `_decimal_to_number(proxy_q2)`

**Output** (when data present):

```python
{
    "metricCode": "TABLE_TURNOVER_RATE",
    "value": None,
    "unit": "turns_per_day",
    "trend": None,
    "alertLevel": None,
    "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
    "proxyMetric": {
        "metricCode": "BILLS_PER_STORE_PER_DAY",
        "value": 47.3,  # _decimal_to_number(...)
        "unit": "bills_per_store_per_day",
        "trend": None,        # prior-period delta deferred to Phase 2D
        "alertLevel": None,   # threshold semantics undefined for proxy
    },
}
```

**Empty-data path**: When `bill_count == 0` OR `store_count == 0` OR `day_count == 0`, emit nested `proxyMetric.value = None` with same envelope structure (do not omit `proxyMetric`). Frontend distinguishes "data unavailable" via null value.

### 3.4 Per-analysisType assembly

```python
async def _restaurant_production_dispatch(
    factory_id, start_date, end_date, analysis_type, conn
):
    result = {
        "startDate": start_date.isoformat(),
        "endDate":   end_date.isoformat(),
        "tenantType": "RESTAURANT",
    }

    metrics = [
        _build_kitchen_station_utilization_metric(),   # M1
        _build_avg_prep_time_metric(),                  # M2
        await _compute_table_turnover_proxy(factory_id, start_date, end_date, conn),  # M3
    ]

    if analysis_type == "oee" or analysis_type is None:
        result["metrics"] = metrics
        result["trendChart"] = None         # M1/M2 null → trend irrelevant
    elif analysis_type == "efficiency":
        result["metrics"] = metrics
        result["ranking"] = []              # no production-line ranking for restaurant
    elif analysis_type == "equipment":
        result["metrics"] = []              # M4 omitted per PR #330 §1.2
        result["ranking"] = []
        result["downtimeChart"] = None
    else:
        result["overview"] = await _restaurant_production_overview(
            factory_id, start_date, end_date, conn, metrics
        )

    return wrap_response(result)
```

### 3.5 Restaurant branch goldens (regression-only)

Per Q1 §4.5: Python restaurant output is the new source of truth; no Java equivalent to compare.

| Golden | factory_id | analysisType | Path |
|---|---|---|---|
| 1 | `R_ILTEATRO_REAL` (pilot real-chain) | oee | `tests/fixtures/python-smartbi-golden/analysis-production-R_ILTEATRO_REAL-oee.json` |
| 2 | `R_ILTEATRO_REAL` | efficiency | same dir, `-efficiency.json` |
| 3 | `R_ILTEATRO_REAL` | equipment | `-equipment.json` |
| 4 | `R_ILTEATRO_REAL` | overview | `-overview.json` |

**Note path divergence**: factory goldens go in `java-smartbi-golden/` (existing dir); restaurant goldens go in `python-smartbi-golden/` (new dir, established by chat-AB-1 for clarity). Both have identical naming convention.

---

## 4. dataAvailability Marker Rules

Per PR #330 §3.4 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §5. Sub-A uses these Production-specific codes:

| Code | Q-DEC ref | Emit context |
|---|---|---|
| `OK` (or omit field per Q-DEC-9) | — | Real data, no caveat. **Q-DEC-9 default: omit field when value is OK**; do not emit `"dataAvailability": "OK"`. |
| `MISSING_KITCHEN_STATION_DATA` | Q-DEC-1 = A1 | M1 (always emit; no kitchen-station schema) |
| `MISSING_ORDER_TIMESTAMP_SPLIT` | Q-DEC-2 = B1 | M2 (always emit; fact_pos_transaction has only 1 time column) |
| `PROXY_AS_BILLS_PER_STORE` | Q-DEC-3 = C1 | M3 (always emit; dim_store lacks table_count) |

### 4.1 Controlled-vocabulary enforcement

Sub-A impl chats (especially chat-A3) MUST:
- Use string constants for all marker codes (define in `smartbi_compat/api/analysis_production.py` module-level)
- Do NOT introduce new markers without organizer sign-off (would require PR #330 §3.4 amendment)
- Frontend rendering: per `project_apr20_permission_matrix_complete.md` Bug #370 pattern — chip badge per non-OK availability with tooltip explaining gap

### 4.2 Future Q-DEC-6 / Q-DEC-7 extension (Production-side)

Production endpoint does NOT consume Q-DEC-6 F1 (return_qty) or Q-DEC-7 (wastage). Those are Quality endpoint scope. Sub-A spec is independent of Q-DEC-6 ETL extension status.

---

## 5. SQL Query Templates

Consolidated for chat-A1 (factory) + chat-A2 (restaurant). Each template MUST be wrapped in a Python helper with Rule 6 precondition check (`if start_date is None or end_date is None: raise ValueError(...)`).

### 5.1 Restaurant tenant (chat-A2 scope)

**M3 proxy** (per §3.3):
```sql
SELECT
    COUNT(*) AS bill_count,
    COUNT(DISTINCT store_id) AS store_count,
    COUNT(DISTINCT date) AS day_count
FROM fact_pos_transaction
WHERE factory_id = $1
  AND date BETWEEN $2 AND $3;
```

**Overview aggregate** (`_restaurant_production_overview`):
```sql
SELECT
    date,
    COUNT(*) AS daily_bill_count,
    SUM(amount) AS daily_revenue
FROM fact_pos_transaction
WHERE factory_id = $1
  AND date BETWEEN $2 AND $3
GROUP BY date
ORDER BY date ASC;
```

**Connection pool**: cretas_db (factories table) for tenant detector; smartbi_prod_db for fact_pos_transaction. Two distinct asyncpg pools per `analysis_finance.py` reference pattern.

### 5.2 Factory tenant (chat-A1 scope)

Per §2.3 — **table schemas TBD** until chat-A1 grep verifies presence. Templates below are **provisional**; chat-A1 confirms or escalates.

**OEE base data**:
```sql
-- PROVISIONAL — chat-A1 verifies table existence
SELECT
    date,
    production_line_code,
    SUM(planned_runtime_minutes) AS planned_runtime,
    SUM(downtime_minutes) AS downtime,
    SUM(theoretical_units) AS theoretical_output,
    SUM(actual_units) AS actual_output,
    SUM(good_units) AS good_units,
    SUM(total_units) AS total_units
FROM fact_production_batch
WHERE factory_id = $1
  AND date BETWEEN $2 AND $3
GROUP BY date, production_line_code;
```

If `fact_production_batch` does not exist → chat-A1 deferral per §2.3 fallback (Java mock 1:1 mirror with `_JavaRandom` shim).

### 5.3 SELECT * convention (Rule 5)

**Per-endpoint helpers** in `analysis_production.py` use narrow `SELECT col1, col2` (Rule 5 legacy exception — endpoint-specific). **Cross-endpoint shared helpers** (none for Production unless Sub-A introduces one in chat-A3) use `SELECT *`.

---

## 6. dict-eq Parity Gate Setup

### 6.1 Factory branch: Java-vs-Python informational dict-eq

Per Phase 2A standard + Q1 amendment §1 (Java stays mock; Python real). Java parity is **informational only** — gate is NOT a Phase B GO criterion.

**Gate command** (chat-AB-1 implements):
```bash
./scripts/parity-gate.sh \
    --endpoint /api/mobile/F999/smart-bi/analysis/production \
    --java-base http://47.100.235.168:10011 \
    --python-base http://47.100.235.168:8084 \
    --params "startDate=2026-05-01&endDate=2026-05-31&analysisType=oee" \
    --mode dict-eq \
    --tolerate-divergence
```

`--tolerate-divergence` flag = log diff but don't fail. Production divergence categories expected (per Q1 §1 final paragraph):
- Java mock random vs Python real-DB → values differ
- Java mock has no `dataAvailability` field → Python always emits null per Rule 9
- Java mock `fromCache` literal vs Python query-time

These divergences are **expected**, not bugs. dict-eq output captured as `docs/qa-audits/2026-08-XX-sub-a-parity-divergence-evidence.md` for sign-off transparency.

### 6.2 Restaurant branch: Python-vs-Python regression goldens

Per Q1 §4.5 + PR #330 §6.1. Gate **IS** a Phase B GO criterion.

**Gate command** (chat-AB-1 implements):
```bash
pytest backend/python/tests/test_analysis_production.py::test_restaurant_regression \
    --golden-dir tests/fixtures/python-smartbi-golden/ \
    --factory-id R_ILTEATRO_REAL
```

**Acceptance**: 100% byte-identical match between Python output and recorded goldens. Any drift requires chat-A2 fix + golden re-record + reviewer audit cycle.

### 6.3 Test infrastructure

Per `python-java-port.md` test mock pattern:

```python
@pytest.fixture
def fake_pos_transaction():
    async def fake_query(factory_id, start_date, end_date, conn):
        return {
            "bill_count": 1420,
            "store_count": 1,
            "day_count": 30,
        }
    return fake_query

async def test_m3_proxy_basic(monkeypatch, fake_pos_transaction):
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_production._query_pos_transaction_aggregate",
        fake_pos_transaction,
    )
    result = await _compute_table_turnover_proxy("R_ILTEATRO_REAL", date(2026,5,1), date(2026,5,31), None)
    assert result["proxyMetric"]["value"] == 47.33
    assert result["dataAvailability"] == "PROXY_AS_BILLS_PER_STORE"
```

---

## 7. 8-Batch Sister-Chat Dispatch Breakdown

Per organizer brief — Sub-A and Sub-B share 8 batches total. Sub-A consumes batches 1-3 + half of 7-8.

### 7.1 chat-A1: Sub-A Production factory tenant impl (~3-4pd)

**Scope**:
- Create `backend/python/smartbi_compat/tenant.py` (shared with chat-B1) per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §2.2
- Create `backend/python/smartbi_compat/api/analysis_production.py` module skeleton
- Implement factory branch (8 method ports per §2.1)
- §2.3 real-DB query OR §2.3 fallback (Java mock mirror) depending on Silver table availability
- Record 8 factory goldens (§2.4) F999 + F001
- 2 reviewer audit cycles per Rules 1-12

**Inputs**:
- This spec §1 + §2 + §5.2 + §6.1
- PR #199 `2026-05-09-t6-6-production-port-detail.md` for method-level detail
- Java `ProductionAnalysisServiceImpl.java` source

**Outputs**:
- PR-A1: 1 commit creating tenant.py + analysis_production.py factory branch
- 8 factory goldens
- Test file `backend/python/tests/test_analysis_production_factory.py`

**Dependencies**:
- Q-DEC-8 = Option A confirmed (✅ PR #330 §9)
- Q-DEC-9 (omit OK) default acceptance — recommend chat-A1 STOP-and-ping organizer if not acked before dispatch

**Gate**:
- pytest passes
- 8 goldens recorded
- Reviewer audit clean (Rules 1-12)
- chat-A1 STOP-and-ping organizer before PR push

### 7.2 chat-A2: Sub-A Production restaurant tenant impl (~3-4pd)

**Scope**:
- Add restaurant branch to `analysis_production.py` (created by chat-A1)
- Implement M1 + M2 + M3 per §3
- Wire `_restaurant_production_dispatch` per §3.4
- SQL helper `_query_pos_transaction_aggregate` per §5.1 with Rule 6 precondition
- Record 4 restaurant goldens (§3.5) `R_ILTEATRO_REAL`
- 2 reviewer audit cycles

**Inputs**:
- This spec §1.4 + §3 + §5.1
- `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §3 (verbatim Python code)
- V20260511_02 seed migration LIVE (factory_id R_ILTEATRO_REAL exists)

**Outputs**:
- PR-A2: 1 commit adding restaurant branch + test file
- 4 restaurant goldens

**Dependencies**:
- chat-A1 PR-A1 merged (provides tenant.py + analysis_production.py skeleton)
- Sub-ETL-2c ship completing (provides fact_pos_transaction rows for R_ILTEATRO_REAL)

**Gate**:
- pytest passes
- 4 goldens recorded
- Reviewer audit clean
- chat-A2 STOP-and-ping organizer before PR push

### 7.3 chat-A3: Sub-A dataAvailability + Option A envelope wiring (~1-2pd)

**Scope**:
- Audit chat-A1 + chat-A2 output for Rule 9 (Lombok null-emit) compliance — all envelope fields explicitly present
- Verify dataAvailability controlled-vocabulary use (§4.1) — no ad-hoc strings
- Wire main router registration in `backend/python/main.py`
- Sub-A endpoint smoke against test env (8084) for factory + restaurant payloads
- Document divergence-from-Java per §6.1 in audit doc
- 1 reviewer audit cycle (consolidation focus)

**Inputs**:
- chat-A1 + chat-A2 merged
- This spec §1.5 + §4 + §6.1

**Outputs**:
- PR-A3: 1 commit — router registration + dataAvailability audit fixes + integration smoke test
- `docs/qa-audits/2026-08-XX-sub-a-envelope-wiring-evidence.md`

**Dependencies**:
- PR-A1 + PR-A2 merged

**Gate**:
- Sub-A smoke against 8084 test env passes for F999 (factory) + R_ILTEATRO_REAL (restaurant)
- Audit doc complete with divergence list
- chat-A3 STOP-and-ping organizer before PR push

### 7.4 chat-AB-1: Combined Sub-A+Sub-B parity gate + integration (~2pd) — shared with Sub-B

**Scope**:
- Implement `parity-gate.sh` script per §6.1 (if not already present from prior Phase 2A endpoints)
- Run dict-eq gate Sub-A + Sub-B against Java 10011 vs Python 8084 — collect divergence evidence
- Run Python-vs-Python regression for restaurant Sub-A + Sub-B goldens
- Cross-chat consistency audit (envelope shape parity Sub-A ↔ Sub-B for tenant-typed structure)
- Document combined parity status per spec sign-off §8

**Inputs**:
- PR-A1/A2/A3 merged
- PR-B1/B2/B3 merged (Sub-B chats)

**Outputs**:
- PR-AB-1: 1 commit — parity-gate.sh + combined integration tests
- `docs/qa-audits/2026-08-XX-sub-a-sub-b-parity-gate-evidence.md`

**Gate**:
- Restaurant regression 100% match for Sub-A + Sub-B
- Factory dict-eq divergence categorized + documented
- chat-AB-1 STOP-and-ping organizer

### 7.5 chat-AB-2: Cutover prep + Sub-F nginx flip (~1pd) — shared with Sub-B

**Scope**:
- Verify nginx regex for `/analysis/production|quality` covers single-URL Option A pattern (no new locations needed per PR #330 §3.2)
- Prep blue-green Python flip command per `feedback_blue_green_java_deploy.md` (Python is in-place per server-operations.md)
- Customer comms draft per `feedback_active_e2e_replaces_passive_soak.md`
- T6.5 Phase B 30-day soak overlap verify

**Outputs**:
- PR-AB-2: cutover-prep doc + nginx config diff (NOT applied)
- Customer comms draft

**Gate**:
- All Phase B Sub-A/B PRs merged + green
- T6.5 Phase C close per MO #249 §⛔ pre-flight
- Active-E2E gate per HARD rule (≥30-min smoke including customer-facing surface)
- organizer GO for cutover

### 7.6 Dispatch order

```
                        ┌──→ chat-A2 (restaurant) ──┐
chat-A1 (factory) ──────┤                            ├──→ chat-A3 (wiring) ──┐
                        └────────────────────────────┘                       │
                                                                              ├──→ chat-AB-1 (parity)
chat-B1 (factory) ──────┐                                                    │      ──→ chat-AB-2
                        ├──→ chat-B2 (restaurant) ──→ chat-B3 (wiring) ─────┘             (cutover)
                        └────────────────────────────┘
```

Sub-A dispatch parallel with Sub-B dispatch — independent file scopes (analysis_production.py vs analysis_quality.py). Sub-A chat-A1 + Sub-B chat-B1 can co-author tenant.py via PR-A1 + PR-B1 (one creates, other merges + extends — coordinate via marching-order separation).

### 7.7 Per-chat handoff checklist

Each sister chat MUST:
1. Read this spec §1-§6 + cited cross-refs
2. Read `python-java-port.md` Rules 1-12
3. Open worktree off `origin/main` per `feedback_concurrent_edit_safety.md` Rule 2
4. Implement scope
5. STOP-and-ping organizer BEFORE push (HARD rule)
6. Provide 1-paragraph handoff note to next chat in chain

---

## 8. Sign-off Checklist

### 8.1 Pre-dispatch (organizer)

- [x] Q-DEC-6 = F1 ratified ✅ (PR #330 §9)
- [x] Q-DEC-8 = Option A ratified ✅ (PR #330 §9)
- [x] V20260511_01 (chain_catalog) LIVE ✅ (PR #325)
- [x] V20260511_02 (14 chain seed) LIVE ✅ (PR #325)
- [x] V20260511_03 (fact_pos_item.return_qty) LIVE ✅ (PR #331)
- [ ] Q-DEC-1 default A1 accepted by Steve OR alternative chosen (recommend AskUserQuestion before chat-A2)
- [ ] Q-DEC-2 default B1 accepted by Steve OR alternative
- [ ] Q-DEC-3 default C1 accepted by Steve OR alternative
- [ ] Q-DEC-9 default (omit OK) accepted by Steve
- [ ] Q-DEC-10 default (nested proxyMetric) accepted by Steve
- [ ] Sub-ETL-2 Step 2 (Silver/Gold loader) ship (chat1 in flight per organizer brief)
- [ ] MO PR #249 §⛔ pre-flight gates clear (T6.5 Phase C close + active-E2E)

### 8.2 Per-chat (chat-A1/A2/A3 + chat-AB-1/AB-2)

- [ ] Worktree off `origin/main` HEAD (not stale)
- [ ] python-java-port.md Rules 1-12 audit clean
- [ ] Tests pass (pytest)
- [ ] Goldens recorded per §2.4 / §3.5
- [ ] Reviewer audit cycles (2 for chat-A1/A2; 1 for chat-A3)
- [ ] STOP-and-ping organizer before push
- [ ] PR push approved by organizer

### 8.3 Phase B Sub-A close

- [ ] PR-A1 + PR-A2 + PR-A3 merged
- [ ] Restaurant regression goldens 100% match
- [ ] Factory divergence categorized per §6.1
- [ ] Sub-A audit doc `2026-05-12-t6-6-sub-a-sub-b-spec-readiness.md` updated to STATE=GREEN

---

## 9. Cross-references

| Doc | Path | Relation |
|---|---|---|
| **Q4/Q5 decision ratification (PR #330)** | `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` | **Authoritative parent** for restaurant semantics |
| **Q4/Q5 impl-shape spec (PR #337)** | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` | **Immediate predecessor**; restaurant-branch Python module shape — chat-A2 verbatim source |
| Q1 real-DB amendment (PR #223) | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` | Trigger; §8 Q4+Q5 resolved by PR #330; §4.5 Java goldens informational decision |
| Phase B pre-flight audit (PR #298) | `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` | §6.1 recommended Sub-A/B impl spec — this doc |
| ETL infra design (PR #316) | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` | §1.5 verified schema state; chat-A2 relies on Sub-ETL-2c ship |
| Phase A design (PR #196) | `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` | Java method inventory for §2.1 table |
| Production-port detail (PR #199) | `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` | chat-A1 factory-branch method-by-method directive |
| Phase B execute MO (PR #249) | `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` | §⛔ HOLD gate for Sub-A dispatch |
| Sub-ETL-2 sub-spec | `docs/superpowers/specs/2026-05-11-sub-etl-2-*.md` | Silver/Gold loader (chat1 in flight) — Sub-A chat-A2 depends on its ship |
| Existing migrations | `backend/python/smartbi/database/migrations/V20260511_01__t6_6_etl_chain_catalog.sql` + `_02_seed_14_real_chains.sql` + `_03_fact_pos_item_add_return_qty.sql` | Restaurant tenant data infra LIVE |
| Java FactoryType enum | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/FactoryType.java` | RESTAURANT/BRANCH literals for tenant detector |
| Java ProductionAnalysisServiceImpl | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProductionAnalysisServiceImpl.java` | Factory branch port source |
| Java SmartBIAnalysisController | `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:80-115` | Endpoint dispatcher mirror |
| python-java-port.md Rules 1-12 | `.claude/rules/python-java-port.md` | Applies all rules per §6.1 / §6.3 |
| Concurrent edit safety | `.claude/rules/concurrent-edit-safety.md` | Rule 5b `git commit -- <paths>` for sister chats |
| Server operations migration runner | `.claude/rules/server-operations.md` | HARD RULE — any new migration via deploy-smartbi-python.sh auto-apply |
| Pause-before-push HARD | memory `feedback_pause_before_deploy_or_push.md` | Per-chat handoff gate per §7.7 |
| Active-E2E HARD | memory `feedback_active_e2e_replaces_passive_soak.md` | Phase B GO criterion per §7.5 chat-AB-2 |

---

## 10. ⛔ HOLD Blocks

- ⛔ **This is a consolidation impl spec only.** Zero code edits, zero migrations, zero DDL apply, zero deploys, zero nginx mutations.
- ⛔ **Sub-A impl dispatch (chat-A1/A2/A3) HOLD** per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate).
- ⛔ **Q-DEC-1..5 + Q-DEC-7 + Q-DEC-9 + Q-DEC-10 defaults pending Steve acceptance** before chat-A2 dispatch (per PR #330 §9). Recommend organizer AskUserQuestion batch accept.
- ⛔ **No Java side changes.** `ProductionAnalysisServiceImpl` stays KEEP forever (Dashboard composite binds per PR #178 KEEP list).
- ⛔ **No new migrations from this spec.** F1 column already shipped (V20260511_03). Factory Silver schema gap (§2.3) escalates to organizer if discovered by chat-A1 — separate scope.
- ⛔ **STOP-and-ping organizer** before this spec's PR push per HARD `feedback_pause_before_deploy_or_push.md`.
- ⛔ **No customer-facing nginx routing** for new factory_ids — Q1 §8 Q3 default = internal showcase only.
- ⛔ **Phase 2A dict-eq parity gate**: factory branch informational only (Java mock vs Python real intentionally diverge per Q1 §1); restaurant branch is Python-vs-Python regression. Sub-A reviewer audits **do not flag factory divergence as bug** per §6.1.

---

## 11. Predecessor Chain

- PR #178 — T6.5 Phase A retrospective audit (KEEP list); merged
- PR #180 — T6.6 main spec; merged
- PR #196 — T6.6 Phase A design; merged
- PR #199 — production-port detail; merged (chat-A1 verbatim source for §2)
- PR #220 — cross-PR consistency audit; merged
- PR #223 — Q1 real-DB sign-off; merged; §8 Q4+Q5 PENDING → resolved
- PR #249 — T6.6 Phase B execute MO (DRAFT/HOLD); merged
- PR #298 — T6.6 Phase B pre-flight audit; merged; §6.1 recommended this spec
- PR #316 — T6.6 ETL infra design; merged; §1.5 verified UPSERT keys
- PR #325 — V20260511_01/02 LIVE (chain catalog + 14 seed)
- PR #326 — Q4/Q5 decision ratification spec (Option B); merged
- PR #328 — Q4/Q5 verbal sign-off amendment §8.1; merged
- PR #330 — Q-DEC-6 F1 + Q-DEC-8 Option A ratification; merged
- PR #331 — V20260511_03 LIVE (fact_pos_item.return_qty); merged
- PR #335 — t6-6 main amend §1.5 + §5.2 (Q-DEC-6 F1 narrower scope); merged
- PR #337 — Q4/Q5 restaurant-tenant impl-shape spec (940 LOC); merged — this spec's mechanical sibling for restaurant branch

This spec is the **15th in the T6.6 Phase B planning chain** and unifies the Production-endpoint side of Sub-A/B dispatch into a single executable plan.

---

**End of T6.6 Phase B Sub-A — `/analysis/production` Implementation Spec (Consolidated).**

*Author: chat4 (T6.6 Phase B Sub-A/B impl spec dispatch, 2026-05-12 post-`/clear`).*
*Worktree: `.worktrees/t6-6-sub-a-sub-b-impl-spec` (off origin/main HEAD `3d4b702120`).*
*Branch: `spec/t6-6-sub-a-sub-b-impl-spec`.*
*Triggered by: organizer dispatch — "T6.6 Phase B Sub-A (Production) + Sub-B (Quality) impl spec DRAFT".*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_organizer_verbal_signoff_must_amend_spec.md`: STOP-and-ping organizer BEFORE push.*
