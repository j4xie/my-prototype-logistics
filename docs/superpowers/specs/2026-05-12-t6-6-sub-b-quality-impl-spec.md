# T6.6 Phase B Sub-B — `/analysis/quality` Implementation Spec (Consolidated)

**Status**: ⛔ DRAFT — Implementation consolidation spec. No code, no migrations, no DDL, no deploy. Sister-chat dispatch input only.
**Spec date**: 2026-05-12
**Author**: chat4 (T6.6 Phase B Sub-A/B impl spec dispatch — Steve `/clear` 接 2026-05-12)
**Branch**: `spec/t6-6-sub-a-sub-b-impl-spec`
**Worktree**: `.worktrees/t6-6-sub-a-sub-b-impl-spec`
**Base SHA**: `3d4b702120` (origin/main HEAD as of 2026-05-12 dispatch)
**Audience**: chat-B1 / chat-B2 / chat-B3 sister impl chats (per §7 dispatch breakdown); reviewers running per-PR audit cycles; **chat-AB-1 / chat-AB-2 shared with Sub-A**
**Trigger**: organizer dispatch — same dispatch as Sub-A; sibling spec to `2026-05-12-t6-6-sub-a-production-impl-spec.md`

---

## 0. TL;DR

This spec **consolidates** prior T6.6 Phase B Quality-related decision + impl-shape specs into a **single executable plan** for the `/analysis/quality` Python port endpoint. It is the dispatch input for **3 sister impl chats** (chat-B1 factory branch, chat-B2 restaurant branch, chat-B3 envelope wiring) plus 2 combined chats shared with Sub-A.

| Item | This spec |
|---|---|
| Endpoint | `GET /api/mobile/{factoryId}/smart-bi/analysis/quality` |
| Shape | Single URL, tenant-typed response envelope (Option A per Q-DEC-8, PR #330 §3.1) |
| Factory tenant | Mirror Java `QualityAnalysisServiceImpl` mock — 4-metric quality family (FPY/DEFECT_RATE/REWORK_RATE/QUALITY_COST_RATE) + 7 method entry points + LinkedHashMap charts/rankings. Per PR #203 detail spec. |
| Restaurant tenant | 4-metric envelope (FOOD_SAFETY_INCIDENT_RATE / COMPLAINT_RATE / DISH_RETURN_RATE / WASTAGE_RATE) with per-metric `dataAvailability` rules per PR #330 §2 + PR #337 §4. Per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4 module shape. |
| Tenant detector | `backend/python/smartbi_compat/tenant.py` (shared with Sub-A — chat-A1 creates, chat-B1 imports) |
| New module | `backend/python/smartbi_compat/api/analysis_quality.py` |
| **N3 unlock** | ✅ V20260511_03 LIVE (`fact_pos_item.return_qty` column) — Q-DEC-6 F1 narrower-scope per PR #335 §5.2 amendment. **All 14 chains have real N3 data post-Sub-ETL-2c ship**. |
| Parity gate | **Factory branch**: dict-eq Java-vs-Python (informational). **Restaurant branch**: Python-vs-Python regression goldens on **2 pilots** — `R_QINGHUAJIAO_REAL` (with N2 review data) + `R_ILTEATRO_REAL` (without). |
| Effort | Sub-B total ~9pd vs Sub-A ~5-6pd (per PR #330 §2.4) — higher because 3 of 4 restaurant metrics involve real SQL queries (vs 2 of 3 in Sub-A) + golden recording for 2 pilots. |
| Dependencies | Same as Sub-A + V20260511_03 LIVE (✅) + Sub-ETL-2c canonical CSV mapping for `qty_refund` → `return_qty`. |

⛔ **HOLD blocks**:
- Consolidation impl spec — no Python module creation, no DB queries, no migrations, no deploy.
- Sub-B impl dispatch (chat-B1/B2/B3) **HOLD** per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate).
- Q-DEC-4, Q-DEC-5, Q-DEC-7 default acceptance pending Steve (per PR #330 §9) — recommend organizer AskUserQuestion batch before chat-B2 dispatch.
- No Java side changes — `QualityAnalysisServiceImpl` stays KEEP forever (Dashboard composite binds).
- STOP-and-ping organizer BEFORE pushing this spec.

---

## 1. Endpoint Shape — Option A Polymorphic Envelope

### 1.1 URL contract

```
GET /api/mobile/{factoryId}/smart-bi/analysis/quality
Query: startDate=YYYY-MM-DD, endDate=YYYY-MM-DD, analysisType={fpy,defect,rework} or omit for overview
Auth: JWT verify_jwt_and_factory dependency
```

Single URL serves both tenants. Tenant-type discrimination via `cretas_db.factories.type`.

### 1.2 Response envelope (per Q-DEC-8 Option A)

Same envelope structure as Sub-A (§1.2 of Sub-A spec). Top-level `{success, data: {startDate, endDate, tenantType, ...payload}, message}`.

### 1.3 Factory tenant payload

Factory branch mirrors existing Java `DashboardResponse` shape for quality endpoint. Per `2026-05-09-t6-6-quality-port-detail.md` (PR #203 factory-branch detail spec) — fields:

| Key | Type | Source (Java QualityAnalysisServiceImpl) | Notes |
|---|---|---|---|
| `period` | string | `"CUSTOM"` literal | Same as Production |
| `tenantType` | string | NEW envelope discriminator | `"FACTORY"` |
| `kpiCards` | list[dict] | line 89-90 — converted from MetricResult | Cards: FPY / DEFECT_RATE / REWORK_COST / SCRAP_COST / TOTAL_QUALITY_COST / CUSTOMER_COMPLAINT_COUNT |
| `rankings` | LinkedHashMap[string, list[RankingItem]] | line 100-102 | Keys: `"defect_type"` then `"product_line"` (Rule 8 byte order from F999 golden) |
| `charts` | LinkedHashMap[string, ChartConfig] | line 93-97 | Keys: `"quality_trend"`, `"defect_pareto"`, `"quality_cost_distribution"`, `"product_line_quality"` |
| `aiInsights` | list[AIInsight] | line 105 | Mirror Java AI suggestions |
| `suggestions` | list[string] | line 108 | Action strings |
| `generatedAt` | string (via `_java_isoformat`) | line 119 | Rule 11 helper |
| `metricCards` | list[MetricResult] | @Deprecated | Same as kpiCards raw |
| `chartList` | list[ChartConfig] | @Deprecated | Flat duplicate |
| `alerts` | list[Alert] | @Deprecated | Empty in mock |
| `recommendations` | list[Recommendation] | @Deprecated | Empty in mock |
| `lastUpdated` | string\|null | @Deprecated | Null |
| `fromCache` | boolean | line 117 | Always `false` |
| `cacheExpireAt` | string\|null | line 121 | Null |

**Rule 9 enforcement**: same as Sub-A §1.3 — all fields emit including nulls and @Deprecated. Python `_emit_with_nulls` pattern.

### 1.4 Restaurant tenant payload

Restaurant branch returns redefined Q5 envelope (per PR #330 §2.2 + PR #337 §4 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4):

```jsonc
{
  "startDate": "2026-05-01",
  "endDate":   "2026-05-31",
  "tenantType": "RESTAURANT",
  "metrics": [   // ordered list of 4 metrics — canonical order is N1, N2, N3, N4
    {
      "metricCode": "FOOD_SAFETY_INCIDENT_RATE",
      "value": null,
      "unit": "incidents_per_period",
      "trend": null,
      "alertLevel": null,
      "dataAvailability": "MISSING_FOOD_SAFETY_INCIDENT_LOG"
    },
    {
      "metricCode": "COMPLAINT_RATE",
      "value": null,            // null for 13 chains; real value for R_QINGHUAJIAO_REAL only
      "unit": "%",
      "trend": null,
      "alertLevel": null,
      "dataAvailability": "NO_REVIEW_DATA_FOR_CHAIN"   // omitted when value present
    },
    {
      "metricCode": "DISH_RETURN_RATE",
      "value": 3.45,             // ALL 14 chains have real data post-Sub-ETL-2c
      "unit": "%",
      "trend": null,
      "alertLevel": null
      // no dataAvailability — Q-DEC-9 default omit when OK
    },
    {
      "metricCode": "WASTAGE_RATE",
      "value": null,             // null for 14 chains (Excel source has no wastage column)
      "unit": "%",
      "trend": null,
      "alertLevel": null,
      "dataAvailability": "WASTAGE_NOT_TRACKED"
    }
  ]
}
```

**Per analysisType (fpy/defect/rework/overview) on restaurant**: 4-branch dispatch per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.2:

- `analysisType=fpy` (default-Java mapping): `metrics` (4-metric envelope) + optional `trendChart: null`
- `analysisType=defect`: `ranking: <per-product return rate ranking>` + `paretoChart: null` (restaurant has no defect Pareto)
- `analysisType=rework`: `metrics` + `costChart: null` (wastage distribution chart deferred to Phase 2D)
- `analysisType=overview`: `overview: {summary, kpis, recentChanges}` aggregate

### 1.5 Per-metric envelope field contract

Identical to Sub-A §1.5 — single envelope across factory/restaurant + KPI cards.

---

## 2. Factory Tenant Implementation

Factory branch is **1:1 Python port** of Java `QualityAnalysisServiceImpl` per `2026-05-09-t6-6-quality-port-detail.md` (PR #203 detail spec). This spec references; chat-B1 sister impl chat consumes PR #203 for method-by-method directives.

### 2.1 Java method surface (7 entry points)

Mirror these public methods:

| # | Java method | Signature | Python equivalent |
|---|---|---|---|
| 1 | `getQualitySummary(factoryId, startDate, endDate) → DashboardResponse` | default analysisType dispatch | `_factory_quality_summary(factory_id, start_date, end_date)` |
| 2 | `getDefectAnalysis(factoryId, startDate, endDate) → List<MetricResult>` | analysisType="fpy" | `_factory_defect_analysis(factory_id, start_date, end_date)` |
| 3 | `getQualityTrendChart(factoryId, startDate, endDate, period) → ChartConfig` | period="DAY" inside fpy branch | `_factory_quality_trend_chart(factory_id, start_date, end_date, period)` |
| 4 | `getDefectTypeRanking(factoryId, startDate, endDate) → List<RankingItem>` | analysisType="defect" | `_factory_defect_type_ranking(factory_id, start_date, end_date)` |
| 5 | `getDefectParetoChart(factoryId, startDate, endDate) → ChartConfig` | defect branch | `_factory_defect_pareto_chart(factory_id, start_date, end_date)` |
| 6 | `getReworkCost(factoryId, startDate, endDate) → List<MetricResult>` | analysisType="rework" | `_factory_rework_cost(factory_id, start_date, end_date)` |
| 7 | `getQualityCostDistributionChart(factoryId, startDate, endDate) → ChartConfig` | rework branch | `_factory_quality_cost_distribution(factory_id, start_date, end_date)` |

### 2.2 Critical Java semantics to mirror

Per Track B audit:

- **Defect rate formula** (line 152-155): `new BigDecimal(defectCount).divide(new BigDecimal(totalInspections), SCALE=4, HALF_UP).multiply(100)` — Rule 10 chain.
- **Rework rate formula** (line 275-278): same shape — `reworkCount / defectCount * 100` with intermediate quantize.
- **Pareto cumulative percentage** (line 587-595): stateful loop with cumulative tracking — 80% threshold → alertLevel = RED. **Translate to Python**:
  ```python
  cumulative_percentage = Decimal("0")
  for idx, item in enumerate(rankings, start=1):
      item["rank"] = idx
      cumulative_percentage = cumulative_percentage + item["completionRate"]
      if cumulative_percentage <= Decimal("80"):
          item["alertLevel"] = "RED"
  ```
  Note Rule 7: threshold 80 is integer → `float(Decimal)` comparison would be safe, but `Decimal` comparison is cleaner. Use `Decimal("80")` for parity.
- **LinkedHashMap key order** in `charts` (line 93-97) + `rankings` (line 100-102): Python dict literal must mirror — `["quality_trend", "defect_pareto", "quality_cost_distribution", "product_line_quality"]` and `["defect_type", "product_line"]`.
- **ChartConfig Lombok decapitalize**: same as Sub-A §2.2 — `xAxisField` → `"xaxisField"`, `yAxisField` → `"yaxisField"`.
- **String.format display** (multiple sites): use Rule 12 `_format_decimal_half_up` for percentage labels.

### 2.3 Real-DB query targets (Q1 path)

Per Q1 amendment §3.2 + PR #203 detail spec. Source tables (cretas_db.smart_bi_* or smartbi_prod_db.fact_quality_*):

| Java mock field | Python real-DB column | Source table | Status |
|---|---|---|---|
| `totalInspections` | `total_inspections` | `fact_quality_inspection` | TBD — verify presence in chat-B1 |
| `defectCount` | `defect_count` | `fact_quality_inspection` | TBD |
| `firstPassCount` | `first_pass_count` | `fact_quality_inspection` | TBD |
| `defectType` | `defect_type` (categorical) | `fact_quality_defect` | TBD |
| `reworkCount` | `rework_count` | `fact_rework_record` | TBD |
| `scrapCount` | `scrap_count` | `fact_disposal_record` | TBD |
| `reworkCost` | `rework_cost` | `fact_rework_record` | TBD |
| `scrapCost` | `scrap_cost` | `fact_disposal_record` | TBD |
| `complaintCount` | `complaint_count` | `fact_customer_complaint` | TBD |

⚠️ **chat-B1 BLOCKER awareness**: Factory quality Silver tables `fact_quality_inspection` / `fact_quality_defect` / `fact_rework_record` / `fact_disposal_record` / `fact_customer_complaint` **MAY NOT YET EXIST** in current Silver layer. **Same fallback decision as Sub-A §2.3**: if missing, chat-B1 deferral — port Java mock 1:1 with `_JavaRandom` shim scope-limited to factory branch only, flag schema gap to organizer for Phase 2D extension. Restaurant branch (chat-B2) unaffected.

### 2.4 Factory branch goldens

| Golden | factory_id | analysisType | Path |
|---|---|---|---|
| 1 | F999 | fpy | `tests/fixtures/java-smartbi-golden/analysis-quality-F999-fpy.json` |
| 2 | F999 | defect | `analysis-quality-F999-defect.json` |
| 3 | F999 | rework | `analysis-quality-F999-rework.json` |
| 4 | F999 | overview | `analysis-quality-F999-overview.json` |
| 5 | F001 | fpy | `analysis-quality-F001-fpy.json` |
| 6 | F001 | defect | `analysis-quality-F001-defect.json` |
| 7 | F001 | rework | `analysis-quality-F001-rework.json` |
| 8 | F001 | overview | `analysis-quality-F001-overview.json` |

Record via `./scripts/record-java-golden.sh F999 F999 quality <args>`.

---

## 3. Restaurant Tenant Implementation

Restaurant branch is **4 new metric computations** per PR #330 §2.3 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.3-§4.8. This spec **references** the existing impl-shape spec for method bodies — chat-B2 sister consumes that spec for SQL/Python detail.

### 3.1 N1 — Food Safety Incident Rate (always null, Q-DEC-4 = D1)

Per PR #330 §2.3 N1 — emit static null + marker. No SQL needed.

```python
def _build_food_safety_incident_metric() -> dict:
    return {
        "metricCode": "FOOD_SAFETY_INCIDENT_RATE",
        "value": None,
        "unit": "incidents_per_period",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "MISSING_FOOD_SAFETY_INCIDENT_LOG",
    }
```

### 3.2 N2 — Complaint Rate (rating-based per chain, Q-DEC-5 = E1)

Per PR #330 §2.3 N2 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.5. SQL query:

```sql
SELECT
    COUNT(*) AS total_reviews,
    SUM(CASE WHEN rating < 3.0 THEN 1 ELSE 0 END) AS complaint_count
FROM restaurant_reviews
WHERE factory_id = $1
  AND review_time::date BETWEEN $2 AND $3;
```

**Per-chain coverage**:
- `R_QINGHUAJIAO_REAL` (青花椒): has 大众点评 评价下载 review data → real N2 value
- All other 13 chains: 0 reviews → null + `NO_REVIEW_DATA_FOR_CHAIN` marker

**Computation** (Rule 10):
- `complaint_rate = complaint_count / total_reviews * 100`
- Intermediate `quantize(Decimal("0.0001"), ROUND_HALF_UP)` → final `quantize(Decimal("0.01"), ROUND_HALF_UP)`
- Serialize via `_decimal_to_number(rate_pct)`

**Empty-data path**: `total_reviews == 0` → emit `value: null` + `dataAvailability: "NO_REVIEW_DATA_FOR_CHAIN"`

### 3.3 N3 — Dish Return Rate (Q-DEC-6 = F1 ✅ LIVE)

**Critical**: V20260511_03 (`fact_pos_item.return_qty NUMERIC(18,3) DEFAULT NULL`) **already shipped prod** per PR #331. **All 14 chains have real return data post-Sub-ETL-2c canonical CSV → fact_pos_item ship**.

Per PR #330 §2.3 N3 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.6. SQL query:

```sql
SELECT
    COALESCE(SUM(qty), 0)        AS total_sales_qty,
    COALESCE(SUM(return_qty), 0) AS total_return_qty
FROM fact_pos_item fpi
INNER JOIN fact_pos_transaction fpt
    ON fpi.transaction_id = fpt.id
WHERE fpi.factory_id = $1
  AND fpt.date BETWEEN $2 AND $3;
```

**Computation** (Rule 10):
- `dish_return_rate = total_return_qty / total_sales_qty * 100`
- Intermediate `quantize(0.0001, HALF_UP)` → final `quantize(0.01, HALF_UP)`
- Serialize via `_decimal_to_number(rate_pct)`

**Null-rule per Rule 1**: `return_qty IS NULL` (legacy pre-ETL row) is **distinct** from `return_qty = 0` (explicit zero returns). The SQL `COALESCE(SUM(return_qty), 0)` collapses null-bearing rows to numeric 0; that's intentional — null rows don't contribute to numerator but DO contribute to denominator via `qty`. Sub-B chat-B2 reviewer audit MUST verify this is the desired semantic (it is, per PR #335 §5.2 amendment narrower scope rationale).

**Empty-data path**: `total_sales_qty == 0` → emit `value: null` + `dataAvailability: "NO_POS_DATA_FOR_PERIOD"`

### 3.4 N4 — Wastage Rate (Q-DEC-7 = G1)

Per PR #330 §2.3 N4 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.7. SQL query:

```sql
SELECT
    (SELECT COALESCE(SUM(estimated_cost), 0)
       FROM fact_restaurant_wastage
      WHERE factory_id = $1
        AND date BETWEEN $2 AND $3) AS total_wastage_cost,
    (SELECT COALESCE(SUM(est_cost), 0)
       FROM fact_restaurant_requisition
      WHERE factory_id = $1
        AND date BETWEEN $2 AND $3) AS total_requisition_cost,
    (SELECT COUNT(*)
       FROM fact_restaurant_wastage
      WHERE factory_id = $1
        AND date BETWEEN $2 AND $3) AS wastage_row_count;
```

**Per-chain coverage**:
- All 14 REAL chains: `wastage_row_count == 0` (Excel source has no wastage column) → null + `WASTAGE_NOT_TRACKED` marker
- Existing demo chain `RES_3101_009` (qhj seed): may have rows → real value

**Computation** (Rule 10):
- `wastage_rate = total_wastage_cost / total_requisition_cost * 100`
- Same intermediate-then-final quantize pattern
- Serialize via `_decimal_to_number(rate_pct)`

**Empty-data path** (per Rule 1 explicit `is not None`): `wastage_row_count == 0` OR `total_requisition_cost is None` OR `total_requisition_cost == 0` → emit `value: null` + `dataAvailability: "WASTAGE_NOT_TRACKED"`

### 3.5 Defect-mode ranking (N3 product-grain)

Per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.8 — when `analysisType=defect`, return per-product return rate ranking (TOP 10 desc).

```sql
SELECT
    dp.product_id,
    dp.product_name,
    COALESCE(SUM(fpi.qty), 0)        AS total_sales_qty,
    COALESCE(SUM(fpi.return_qty), 0) AS total_return_qty
FROM fact_pos_item fpi
INNER JOIN fact_pos_transaction fpt ON fpi.transaction_id = fpt.id
INNER JOIN dim_product dp ON fpi.product_id = dp.product_id
WHERE fpi.factory_id = $1
  AND fpt.date BETWEEN $2 AND $3
GROUP BY dp.product_id, dp.product_name
HAVING SUM(fpi.qty) > 0
ORDER BY (SUM(fpi.return_qty)::numeric / NULLIF(SUM(fpi.qty), 0)) DESC NULLS LAST
LIMIT 10;
```

Python wraps result as `RankingItem` envelope per `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4.8.

### 3.6 Per-analysisType assembly

```python
async def _restaurant_quality_dispatch(
    factory_id, start_date, end_date, analysis_type, conn_smartbi
):
    result = {
        "startDate": start_date.isoformat(),
        "endDate":   end_date.isoformat(),
        "tenantType": "RESTAURANT",
    }

    metrics = [
        _build_food_safety_incident_metric(),                                        # N1
        await _build_complaint_rate_metric(factory_id, start_date, end_date, conn_smartbi),       # N2
        await _build_return_rate_metric(factory_id, start_date, end_date, conn_smartbi),          # N3
        await _build_wastage_rate_metric(factory_id, start_date, end_date, conn_smartbi),         # N4
    ]

    if analysis_type == "fpy" or analysis_type is None:
        result["metrics"] = metrics
        result["trendChart"] = None
    elif analysis_type == "defect":
        result["ranking"] = await _get_restaurant_return_rate_ranking(
            factory_id, start_date, end_date, conn_smartbi
        )
        result["paretoChart"] = None
    elif analysis_type == "rework":
        result["metrics"] = metrics
        result["costChart"] = None
    else:
        result["overview"] = await _restaurant_quality_overview(
            factory_id, start_date, end_date, conn_smartbi, metrics
        )

    return wrap_response(result)
```

### 3.7 Restaurant branch goldens (regression-only, 2 pilots)

Per PR #330 §6.2 — Sub-B records **at least 2 restaurant goldens** to cover with-review vs without-review code paths:

| Golden | factory_id | analysisType | Path | Notes |
|---|---|---|---|---|
| 1 | `R_QINGHUAJIAO_REAL` (青花椒, **has reviews**) | fpy | `tests/fixtures/python-smartbi-golden/analysis-quality-R_QINGHUAJIAO_REAL-fpy.json` | N2 has real value; N3 real value; N1+N4 null |
| 2 | `R_QINGHUAJIAO_REAL` | defect | same dir, `-defect.json` | Ranking has real rows |
| 3 | `R_QINGHUAJIAO_REAL` | rework | `-rework.json` | Mostly null but envelope shape gate |
| 4 | `R_QINGHUAJIAO_REAL` | overview | `-overview.json` | Aggregate path |
| 5 | `R_ILTEATRO_REAL` (no reviews) | fpy | `analysis-quality-R_ILTEATRO_REAL-fpy.json` | N2 null + `NO_REVIEW_DATA_FOR_CHAIN`; N3 real; N1+N4 null |
| 6 | `R_ILTEATRO_REAL` | defect | `-defect.json` | Ranking has real rows from return_qty |
| 7 | `R_ILTEATRO_REAL` | rework | `-rework.json` | Envelope shape gate |
| 8 | `R_ILTEATRO_REAL` | overview | `-overview.json` | Aggregate path |

**Total**: 8 restaurant goldens (vs Sub-A 4) — reflects 2-pilot coverage requirement per PR #330 §6.2.

---

## 4. dataAvailability Marker Rules

Per PR #330 §3.4 + `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §5. Sub-B uses these Quality-specific codes:

| Code | Q-DEC ref | Emit context |
|---|---|---|
| `OK` (or omit per Q-DEC-9) | — | Real data — omit field per default |
| `MISSING_FOOD_SAFETY_INCIDENT_LOG` | Q-DEC-4 = D1 | N1 (always emit) |
| `NO_REVIEW_DATA_FOR_CHAIN` | Q-DEC-5 = E1 | N2 (13 of 14 chains) |
| `RETURN_QTY_NOT_INGESTED` | Q-DEC-6 = F3 fallback | N3 (only if V20260511_03 column missing — should not occur post-PR #331) |
| `NO_POS_DATA_FOR_PERIOD` | (custom) | N3 (column present but zero rows for period — e.g., chain not yet seeded) |
| `WASTAGE_NOT_TRACKED` | Q-DEC-7 = G1 | N4 (14 chains with no wastage rows) |

### 4.1 Q-DEC-6 F1 status verification

chat-B2 first-step verification:

```bash
psql -d smartbi_prod_db -c "\d fact_pos_item" | grep return_qty
```

Expect: `return_qty | numeric(18,3) | | | NULL` → V20260511_03 LIVE. If absent → STOP-and-ping organizer (would indicate prod migration drift; should never happen).

### 4.2 Controlled-vocabulary enforcement

Same as Sub-A §4.1 — string constants, no ad-hoc codes, frontend chip-badge rendering.

---

## 5. SQL Query Templates

Consolidated for chat-B1 (factory) + chat-B2 (restaurant). Each helper Rule 6 precondition.

### 5.1 Restaurant tenant (chat-B2 scope)

**N2 complaint rate** (per §3.2):
```sql
SELECT
    COUNT(*) AS total_reviews,
    SUM(CASE WHEN rating < 3.0 THEN 1 ELSE 0 END) AS complaint_count
FROM restaurant_reviews
WHERE factory_id = $1
  AND review_time::date BETWEEN $2 AND $3;
```

**N3 return rate** (per §3.3):
```sql
SELECT
    COALESCE(SUM(qty), 0)        AS total_sales_qty,
    COALESCE(SUM(return_qty), 0) AS total_return_qty
FROM fact_pos_item fpi
INNER JOIN fact_pos_transaction fpt ON fpi.transaction_id = fpt.id
WHERE fpi.factory_id = $1
  AND fpt.date BETWEEN $2 AND $3;
```

**N4 wastage rate** (per §3.4): 3-subquery composite as shown above.

**Defect-mode ranking** (per §3.5): per-product return rate TOP 10.

**Overview aggregate** (`_restaurant_quality_overview`):
```sql
SELECT
    date,
    COALESCE(SUM(qty), 0)        AS daily_sales_qty,
    COALESCE(SUM(return_qty), 0) AS daily_return_qty
FROM fact_pos_item fpi
INNER JOIN fact_pos_transaction fpt ON fpi.transaction_id = fpt.id
WHERE fpi.factory_id = $1
  AND fpt.date BETWEEN $2 AND $3
GROUP BY date
ORDER BY date ASC;
```

### 5.2 Factory tenant (chat-B1 scope)

Per §2.3 — table schemas TBD. Templates **provisional**; chat-B1 verifies + escalates if missing.

```sql
-- PROVISIONAL — chat-B1 verifies
SELECT
    date,
    production_line_code,
    defect_type,
    SUM(total_inspections) AS total_inspections,
    SUM(defect_count) AS defect_count,
    SUM(first_pass_count) AS first_pass_count,
    SUM(rework_count) AS rework_count,
    SUM(scrap_count) AS scrap_count,
    SUM(rework_cost) AS rework_cost,
    SUM(scrap_cost) AS scrap_cost
FROM fact_quality_inspection
WHERE factory_id = $1
  AND date BETWEEN $2 AND $3
GROUP BY date, production_line_code, defect_type;
```

### 5.3 SELECT * convention

Same as Sub-A §5.3 — endpoint-specific narrow SELECT.

---

## 6. dict-eq Parity Gate Setup

Same gate setup as Sub-A §6. Same scripts, same configuration.

### 6.1 Factory branch: Java-vs-Python informational dict-eq

Per Q1 §1 final paragraph — Java stays mock; Python real (or mock-mirror if §2.3 fallback). Divergence expected, not blocked.

### 6.2 Restaurant branch: Python-vs-Python regression goldens (2 pilots)

Gate command:
```bash
pytest backend/python/tests/test_analysis_quality.py::test_restaurant_regression \
    --golden-dir tests/fixtures/python-smartbi-golden/ \
    --factory-ids R_QINGHUAJIAO_REAL,R_ILTEATRO_REAL
```

**Acceptance**: 100% byte-identical match across both pilot factories. Both pilots are required per PR #330 §6.2 — they cover distinct code paths (with-review N2 = real value vs without-review N2 = null).

### 6.3 Test infrastructure

Same pattern as Sub-A §6.3. Mock pattern example:

```python
@pytest.fixture
def fake_n3_pos_data():
    async def fake_query(factory_id, start_date, end_date, conn):
        return {
            "total_sales_qty": Decimal("1000"),
            "total_return_qty": Decimal("34.5"),
        }
    return fake_query

async def test_n3_return_rate_basic(monkeypatch, fake_n3_pos_data):
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_quality._query_return_rate",
        fake_n3_pos_data,
    )
    result = await _build_return_rate_metric("R_ILTEATRO_REAL", date(2026,5,1), date(2026,5,31), None)
    assert result["value"] == 3.45
    assert result.get("dataAvailability") is None  # Q-DEC-9: omit when OK
```

---

## 7. 8-Batch Sister-Chat Dispatch Breakdown

Sub-B consumes batches 4-6 + shares 7-8 with Sub-A. See Sub-A spec §7 for batches 1-3 + 7-8 detail.

### 7.1 chat-B1: Sub-B Quality factory tenant impl (~3-4pd)

**Scope**:
- Import `backend/python/smartbi_compat/tenant.py` (created by chat-A1; if chat-A1 ships first OK; if parallel, coordinate via marching-order separation)
- Create `backend/python/smartbi_compat/api/analysis_quality.py` module skeleton
- Implement factory branch (7 method ports per §2.1)
- §2.3 real-DB OR fallback path (Java mock mirror with `_JavaRandom` shim if Silver tables missing)
- **Special attention**: Pareto cumulative-percentage stateful loop (§2.2) — Python translation correctness reviewer-audit gate
- Record 8 factory goldens (§2.4) F999 + F001
- 2 reviewer audit cycles per Rules 1-12

**Inputs**:
- This spec §1 + §2 + §5.2 + §6.1
- PR #203 `2026-05-09-t6-6-quality-port-detail.md` for method-level detail
- Java `QualityAnalysisServiceImpl.java` source

**Outputs**:
- PR-B1: 1 commit creating analysis_quality.py factory branch + tests
- 8 factory goldens

**Dependencies**:
- chat-A1 ship preferred (tenant.py LIVE); parallel OK with coordination

**Gate**:
- pytest passes; 8 goldens; reviewer audit clean; STOP-and-ping organizer

### 7.2 chat-B2: Sub-B Quality restaurant tenant impl (~3-4pd)

**Scope**:
- Add restaurant branch to `analysis_quality.py` (created by chat-B1)
- Implement N1 + N2 + N3 + N4 per §3
- Wire `_restaurant_quality_dispatch` per §3.6
- 4 SQL helpers per §5.1 with Rule 6 preconditions
- §4.1 V20260511_03 LIVE verification first-step
- Record 8 restaurant goldens (§3.7) — 2 pilots × 4 analysisTypes
- 2 reviewer audit cycles

**Inputs**:
- This spec §1.4 + §3 + §5.1
- `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` §4 (verbatim Python code)
- V20260511_03 LIVE prod (✅)
- Sub-ETL-2c canonical CSV mapping `qty_refund` → `return_qty` (chat1 in flight)

**Outputs**:
- PR-B2: 1 commit adding restaurant branch + test file
- 8 restaurant goldens

**Dependencies**:
- chat-B1 PR-B1 merged
- Sub-ETL-2c ship completing (provides return_qty rows in fact_pos_item)
- Q-DEC-4, Q-DEC-5, Q-DEC-7 defaults accepted (organizer AskUserQuestion batch)

**Gate**:
- pytest passes
- 8 goldens recorded (R_QINGHUAJIAO_REAL + R_ILTEATRO_REAL)
- Reviewer audit clean
- STOP-and-ping organizer

### 7.3 chat-B3: Sub-B dataAvailability + Option A envelope wiring (~1-2pd)

**Scope**:
- Audit chat-B1 + chat-B2 output for Rule 9 (Lombok null-emit) compliance
- Verify dataAvailability controlled-vocabulary use per §4.2
- Wire main router registration in `backend/python/main.py`
- Sub-B endpoint smoke against test env (8084) for factory + restaurant
- Document divergence-from-Java in audit doc
- 1 reviewer audit cycle

**Outputs**:
- PR-B3: router registration + audit fixes + integration smoke test
- `docs/qa-audits/2026-08-XX-sub-b-envelope-wiring-evidence.md`

**Gate**:
- Sub-B smoke for F999 + R_QINGHUAJIAO_REAL + R_ILTEATRO_REAL passes
- Audit doc complete
- STOP-and-ping organizer

### 7.4 chat-AB-1 + chat-AB-2 (shared with Sub-A)

See Sub-A §7.4 + §7.5 for detail. Sub-B adds:
- N3 unlock validation: chat-AB-1 confirms all 14 chains return real N3 values post-Sub-ETL-2c ship (smoke a 3-chain sample beyond pilots)
- N2 single-chain validation: 青花椒 N2 real-value gate (rating-based threshold semantics)

### 7.5 Dispatch order

```
chat-A1 ──┬─→ chat-A2 ──→ chat-A3 ──┐
          │                          ├─→ chat-AB-1 (parity) ──→ chat-AB-2 (cutover)
chat-B1 ──┴─→ chat-B2 ──→ chat-B3 ──┘
```

Sub-A and Sub-B parallel. chat-A1 + chat-B1 coordinate tenant.py creation. chat-A2 + chat-B2 parallel (independent file scopes after tenant.py LIVE).

### 7.6 Per-chat handoff checklist

Same as Sub-A §7.7.

---

## 8. Sign-off Checklist

### 8.1 Pre-dispatch (organizer)

- [x] Q-DEC-6 = F1 ratified ✅ (PR #330 §9)
- [x] Q-DEC-8 = Option A ratified ✅ (PR #330 §9)
- [x] V20260511_03 (fact_pos_item.return_qty) LIVE prod ✅ (PR #331)
- [ ] Q-DEC-4 default D1 accepted by Steve OR alternative (recommend AskUserQuestion before chat-B2)
- [ ] Q-DEC-5 default E1 accepted by Steve OR alternative
- [ ] Q-DEC-7 default G1 accepted by Steve OR alternative
- [ ] Q-DEC-9 default (omit OK) accepted (shared with Sub-A)
- [ ] Q-DEC-10 default (nested proxyMetric) accepted (shared with Sub-A)
- [ ] Sub-ETL-2c Step 2 ship (return_qty mapping LIVE in canonical CSV → fact_pos_item)
- [ ] MO PR #249 §⛔ pre-flight gates clear

### 8.2 Per-chat

- [ ] Worktree off `origin/main` HEAD
- [ ] python-java-port.md Rules 1-12 audit clean (Rule 1 emphasis for §3.3 return_qty null-vs-zero semantics)
- [ ] Tests pass
- [ ] Goldens recorded per §2.4 / §3.7
- [ ] Reviewer audit cycles
- [ ] STOP-and-ping organizer before push

### 8.3 Phase B Sub-B close

- [ ] PR-B1 + PR-B2 + PR-B3 merged
- [ ] Restaurant regression goldens 100% match for both pilots
- [ ] Factory divergence categorized per §6.1
- [ ] Sub-B audit doc updated to STATE=GREEN
- [ ] N3 real-data validation across 3+ chains beyond pilots (chat-AB-1 scope)

---

## 9. Cross-references

| Doc | Path | Relation |
|---|---|---|
| **Sub-A sibling spec** | `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` | This spec's sibling — shared sections (§1.2 envelope, §6 parity gate, §7.4-7.5 chat-AB-*) |
| **Q4/Q5 decision ratification (PR #330)** | `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` | Authoritative parent for restaurant semantics |
| **Q4/Q5 impl-shape spec (PR #337)** | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` | Immediate predecessor — chat-B2 verbatim source for §3 restaurant branch |
| Q1 real-DB amendment (PR #223) | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` | Q1 = real DB trigger; §3.2 N3/N4 quality mapping; §4.5 informational Java goldens |
| Phase B pre-flight audit (PR #298) | `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` | §6.1 recommended this spec |
| ETL infra design (PR #316) | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` | §1.5 verified schema state; V20260511_03 in scope |
| §1.5 amend (PR #335) | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` §5.2 | Q-DEC-6 F1 narrower scope (return_qty only, DEFAULT NULL) |
| Quality-port detail (PR #203) | `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md` | chat-B1 factory-branch method-by-method directive |
| Phase A design (PR #196) | `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` | Java method inventory for §2.1 |
| Existing V20260511_03 migration | `backend/python/smartbi/database/migrations/V20260511_03__fact_pos_item_add_return_qty.sql` | N3 column LIVE prod |
| Existing restaurant_reviews migration | `backend/python/smartbi/database/migrations/20260408_restaurant_reviews.sql` | N2 source table (rating column) |
| Existing fact_restaurant_wastage | `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` | N4 source table (schema ready, data missing 14 chains) |
| Java QualityAnalysisServiceImpl | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java` | Factory branch port source |
| Java SmartBIAnalysisController | `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:119-152` | Quality endpoint dispatcher mirror |
| python-java-port.md | `.claude/rules/python-java-port.md` | All Rules 1-12 (Rule 1 emphasis for §3.3 null-vs-zero, Rule 10 for §3.2/§3.3/§3.4 divide-multiply) |
| Pause-before-push HARD | memory `feedback_pause_before_deploy_or_push.md` | Per-chat handoff gate |

---

## 10. ⛔ HOLD Blocks

- ⛔ **Consolidation impl spec only.** Zero code edits, zero migrations, zero DDL apply, zero deploys.
- ⛔ **Sub-B impl dispatch (chat-B1/B2/B3) HOLD** per MO PR #249 §⛔ pre-flight.
- ⛔ **Q-DEC-4, Q-DEC-5, Q-DEC-7 defaults pending Steve** before chat-B2 dispatch.
- ⛔ **No Java side changes.** `QualityAnalysisServiceImpl` stays KEEP forever.
- ⛔ **No new migrations from this spec.** V20260511_03 already LIVE prod.
- ⛔ **STOP-and-ping organizer** before this spec's PR push per HARD rule.
- ⛔ **Factory dict-eq divergence expected**, not gate-failing — same rationale as Sub-A §10.
- ⛔ **No customer-facing nginx routing** for new factory_ids — Q1 §8 Q3 internal-showcase default.

---

## 11. Predecessor Chain

Same chain as Sub-A spec §11. Sub-B is the **Quality-side mechanical sibling** of Sub-A.

This spec is the **16th in the T6.6 Phase B planning chain** and unifies the Quality-endpoint side of Sub-A/B dispatch into a single executable plan.

---

**End of T6.6 Phase B Sub-B — `/analysis/quality` Implementation Spec (Consolidated).**

*Author: chat4 (T6.6 Phase B Sub-A/B impl spec dispatch, 2026-05-12 post-`/clear`).*
*Worktree: `.worktrees/t6-6-sub-a-sub-b-impl-spec` (off origin/main HEAD `3d4b702120`).*
*Branch: `spec/t6-6-sub-a-sub-b-impl-spec`.*
*Triggered by: organizer dispatch — same dispatch as Sub-A; sibling spec.*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_organizer_verbal_signoff_must_amend_spec.md`: STOP-and-ping organizer BEFORE push.*
