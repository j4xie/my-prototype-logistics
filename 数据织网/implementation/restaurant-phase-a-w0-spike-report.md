# Restaurant Phase A — W0 Spike Report

**Date**: 2026-04-28
**Branch**: e2e/v1-framework
**Author**: Claude Code (W0.1 automated investigation)

---

## W0.1 entity_resolution_admin_queue Schema Verify

**verify date**: 2026-04-28

---

### 真实 \d output (raw)

```
Table "public.entity_resolution_admin_queue"
           Column            |            Type             | Collation | Nullable |                          Default
-----------------------------+-----------------------------+-----------+----------+-----------------------------------------------------------
 id                          | bigint                      |           | not null | nextval('entity_resolution_admin_queue_id_seq'::regclass)
 factory_id                  | character varying(50)       |           | not null |
 entity_type                 | character varying(20)       |           | not null |
 raw_name                    | text                        |           | not null |
 candidate_entity_id         | bigint                      |           |          |
 confidence                  | numeric(3,2)                |           |          |
 decided_by_agent            | character varying(30)       |           |          |
 dropped_row_refs            | jsonb                       |           |          |
 admin_action                | character varying(20)       |           |          |
 admin_resolved_to_entity_id | bigint                      |           |          |
 admin_user                  | character varying(50)       |           |          |
 admin_at                    | timestamp without time zone |           |          |
 source_upload_id            | bigint                      |           |          |
 created_at                  | timestamp without time zone |           |          | now()
 priority                    | character varying(10)       |           |          | 'medium'::character varying
 status                      | character varying(20)       |           |          | 'PENDING'::character varying
 reasoning                   | text                        |           |          |
 extra                       | jsonb                       |           |          |
 reviewed_by                 | character varying(50)       |           |          |
 reviewed_at                 | timestamp without time zone |           |          |
Indexes:
    "entity_resolution_admin_queue_pkey" PRIMARY KEY, btree (id)
    "idx_er_admin_queue_pending" btree (factory_id, entity_type, created_at DESC) WHERE admin_at IS NULL
    "idx_eraq_pending_priority" btree (factory_id, priority, created_at) WHERE status::text = 'PENDING'::text
Check constraints:
    "entity_resolution_admin_queue_admin_action_check" CHECK (admin_action::text = ANY (ARRAY['confirm'::character varying, 'reject'::character varying, 'create_new'::character varying]::text[]))
    "entity_resolution_admin_queue_entity_type_check" CHECK (entity_type::text = ANY (ARRAY['store'::character varying, 'product'::character varying, 'staff'::character varying, 'ingredient'::character varying, 'shape_detection'::character varying, 'sheet_merge'::character varying, 'period_inference'::character varying, 'field_conflict'::character varying]::text[]))
    "entity_resolution_admin_queue_priority_check" CHECK (priority::text = ANY (ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying]::text[]))
    "entity_resolution_admin_queue_status_check" CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'REJECTED'::character varying, 'DEFERRED'::character varying]::text[]))
Policies (forced row security enabled):
    POLICY "tenant_isolation"
      USING (((factory_id)::text = current_setting('app.factory_id'::text, true)))
      WITH CHECK (((factory_id)::text = current_setting('app.factory_id'::text, true)))
```

---

### 真实列定义 (extracted)

- `id` BIGINT NOT NULL DEFAULT nextval(...) — primary key (BIGSERIAL pattern)
- `factory_id` VARCHAR(50) NOT NULL — tenant key; RLS FORCE (single policy `tenant_isolation` covers SELECT+INSERT+UPDATE+DELETE)
- `entity_type` VARCHAR(20) NOT NULL — CHECK constraint (see below)
- `raw_name` TEXT NOT NULL
- `candidate_entity_id` BIGINT NULL — NULL = create new
- `confidence` NUMERIC(3,2) NULL
- `decided_by_agent` VARCHAR(30) NULL
- `dropped_row_refs` JSONB NULL
- `admin_action` VARCHAR(20) NULL — CHECK: 'confirm' / 'reject' / 'create_new'
- `admin_resolved_to_entity_id` BIGINT NULL
- `admin_user` VARCHAR(50) NULL
- `admin_at` TIMESTAMP NULL
- `source_upload_id` BIGINT NULL — **no FK constraint** (soft reference to smart_bi_pg_excel_uploads.id)
- `created_at` TIMESTAMP DEFAULT now() NULL
- `priority` VARCHAR(10) DEFAULT 'medium' NULL — CHECK: 'low' / 'medium' / 'high'
- `status` VARCHAR(20) DEFAULT 'PENDING' NULL — CHECK: 'PENDING' / 'CONFIRMED' / 'REJECTED' / 'DEFERRED'
- `reasoning` TEXT NULL
- `extra` JSONB NULL
- `reviewed_by` VARCHAR(50) NULL
- `reviewed_at` TIMESTAMP NULL

**Missing columns vs. spec v2 §2.3**: NONE — all spec columns exist.

**Extra columns vs. spec v2 §2.3**: NONE — exact match.

**Notable**: `created_at` is nullable with DEFAULT now() (spec implied NOT NULL — minor discrepancy, no impact). NO `updated_at` column.

---

### 真实 entity_type CHECK constraint (raw)

```
entity_resolution_admin_queue_entity_type_check |
CHECK (((entity_type)::text = ANY ((ARRAY[
  'store'::character varying,
  'product'::character varying,
  'staff'::character varying,
  'ingredient'::character varying,
  'shape_detection'::character varying,
  'sheet_merge'::character varying,
  'period_inference'::character varying,
  'field_conflict'::character varying
])::text[])))
```

---

### Entity types accepted (parsed from CHECK)

- 'store'
- 'product'
- 'staff'
- 'ingredient'
- 'shape_detection'
- 'sheet_merge'
- 'period_inference'
- 'field_conflict'

**Total: 8 entity types — exactly matches spec v2 §2.3.** No 'field_name' (as spec noted it was excluded from v1 and deferred to Phase B).

---

### 现使用情况 (entity_type × status counts)

```
 entity_type | status | count
-------------+--------+-------
(0 rows)
```

| entity_type | status | count |
|---|---|---|
| (empty) | (empty) | table is completely empty |

**Table is empty** — no rows in either test or prod smartbi_db. This means:
- No normalizer has yet written to this table
- A-3 implementation can start from scratch without migration concerns
- W0.1 finds no usage patterns to reconcile

---

### source_upload_id field

**存在**: YES — column `source_upload_id BIGINT NULL` present.

**FK constraint**: NONE — there is no `FOREIGN KEY` constraint declared on `source_upload_id`. It is a soft reference only. The spec JOIN pattern still works:

```sql
SELECT q.*, u.uploaded_by AS submitter
FROM entity_resolution_admin_queue q
LEFT JOIN smart_bi_pg_excel_uploads u ON u.id = q.source_upload_id
WHERE q.factory_id = $1 AND q.status = 'PENDING'
```

**Implication for A-3**: The LEFT JOIN is correct (not INNER JOIN) since rows could exist with `source_upload_id = NULL` (e.g. manually injected or pre-upload resolution items). The absence of a FK constraint means application code must handle stale `source_upload_id` values gracefully.

---

### smart_bi_pg_excel_uploads uploader column name

**Column name**: `uploaded_by` (type: BIGINT)

This matches spec v2 §2.3 exactly. The column stores a user ID (integer reference, no FK constraint visible). The 4-eye check in A-3 API must do:

```python
# pseudo-code
if upload_row.uploaded_by == current_admin_user_id and factory_admin_count > 1:
    raise HTTP_403("您是该字段的提交者，需另一管理员审核（4-eye 原则）")
```

**smart_bi_pg_excel_uploads additional observations**:
- Has `merge_status`, `merge_target_id`, `merge_inferred_period_start/end`, `merge_period_inference_method` — these are C-phase merge fields, not relevant to A-3 queue UI
- Referenced by 10 other tables via FK (agg_product_period, dim_review_summary, fact_finance_voucher, fact_inventory_snapshot, fact_review_event, field_provenance, smart_bi_dynamic_data, smart_bi_pg_analysis_results, smart_bi_pg_field_definitions, and self-reference via merge_target_id)
- Has per-operation RLS policies (tenant_select/insert/update/delete separately configured)

---

### spec v2 §2.3 是否需要修订

**NO — spec v2 §2.3 is accurate. No changes required.**

The real schema matches all claims in the spec v2 §2.3 correction table (lines 263-279 of `restaurant-phase-a-only-2026-04-28-design.md`). No gap table is needed.

---

### 差异列表

| spec v2 §2.3 says | reality | gap |
|---|---|---|
| `id BIGSERIAL` | `id BIGINT NOT NULL DEFAULT nextval(...)` | None — functionally identical (BIGSERIAL is syntactic sugar) |
| `factory_id VARCHAR(50)` + RLS FORCE | `factory_id VARCHAR(50) NOT NULL` + single `tenant_isolation` policy (FORCE implied) | None |
| entity_type CHECK: store/product/staff/ingredient/shape_detection/sheet_merge/period_inference/field_conflict | Exact match | None |
| `raw_name TEXT` (not raw_value) | `raw_name TEXT NOT NULL` | None (spec correct; v1 was wrong with `raw_value`) |
| `candidate_entity_id BIGINT` (NULL=new) | `candidate_entity_id BIGINT NULL` | None |
| `confidence` | `confidence NUMERIC(3,2)` | None |
| `decided_by_agent` (string) | `decided_by_agent VARCHAR(30)` | None |
| status: PENDING/CONFIRMED/REJECTED/DEFERRED | CHECK exactly matches | None |
| NO submitter/submitter_role | Confirmed absent | None |
| source_upload_id → JOIN to get uploaded_by | `source_upload_id BIGINT` (no FK) + `smart_bi_pg_excel_uploads.uploaded_by BIGINT` | **Minor**: no FK constraint means LEFT JOIN needed (spec says LEFT JOIN, so correct) |
| `admin_resolved_to_entity_id BIGINT` | Present ✓ | None |
| `admin_user`, `admin_at` | Both present ✓ | None |
| `admin_action` ('confirm'/'reject'/'create_new') | CHECK constraint matches exactly | None |
| no separate reject_reason column, use extra JSONB | `extra JSONB` present, no reject_reason column | None |
| `reviewed_by`, `reviewed_at` | Both present ✓ | None |
| `priority` | `priority VARCHAR(10)` DEFAULT 'medium', CHECK: low/medium/high | None |
| `dropped_row_refs JSONB`, `reasoning`, `extra JSONB` | All 3 present ✓ | None |
| (implicit) `updated_at` | **ABSENT** — no `updated_at` column | **Minor gap**: spec API response schema lists no `updatedAt` so no impact on A-3 contract; but any ORM that auto-sets updated_at will fail |

**Summary**: 1 minor gap found — `updated_at` column does not exist. This is a non-blocking difference: the spec API contract does not expose `updatedAt` to the frontend, and insert/update operations only touch `admin_at`/`reviewed_at` timestamps (explicit columns).

---

### 结论

**Schema confirms spec v2 §2.3 is correct. A-3 implementation can proceed as written.** Table is empty (no live data to worry about), all 8 entity_type values are correctly constrained, `source_upload_id` is a soft FK (LEFT JOIN safe), and `smart_bi_pg_excel_uploads.uploaded_by` is BIGINT as assumed. The only minor divergence is the absence of `updated_at` which has zero impact on A-3 API contract. Spec v2 §2.3 unchanged.

---

## W0.2 Hardcoded Normalizer Hit Rate Baseline

**verify date**: 2026-04-28

---

### smart_bi_pg_field_definitions schema (verify)

```
                                        Table "public.smart_bi_pg_field_definitions"
     Column     |          Type          | Collation | Nullable |                          Default
----------------+------------------------+-----------+----------+-----------------------------------------------------------
 id             | bigint                 |           | not null | nextval('smart_bi_pg_field_definitions_id_seq'::regclass)
 upload_id      | bigint                 |           | not null |
 original_name  | text                   |           |          |
 standard_name  | character varying(500) |           |          |
 field_type     | character varying(50)  |           |          |
 semantic_type  | character varying(50)  |           |          |
 chart_role     | character varying(50)  |           |          |
 is_dimension   | boolean                |           |          | false
 is_measure     | boolean                |           |          | false
 is_time        | boolean                |           |          | false
 sample_values  | jsonb                  |           |          |
 statistics     | jsonb                  |           |          |
 display_order  | integer                |           |          | 0
 format_pattern | character varying(50)  |           |          |
 agg_strategy   | character varying(20)  |           | not null | 'sum'::character varying
```

**Schema divergence from plan template**: SIGNIFICANT. The plan assumed columns `raw_column_name`, `identified_role`, `default_to_dimension` (boolean), and `dtype_fallback_to_measure` (boolean). None of these exist. The real table stores the *output* of classification (three boolean flags: `is_dimension`, `is_measure`, `is_time`) plus `semantic_type` (string label) and `agg_strategy`. There are no `created_at`/`updated_at` columns on this table — timestamp filtering must be done via JOIN to `smart_bi_pg_excel_uploads.created_at`.

**Miss-rate proxy approach**: Because `default_to_dimension` and `dtype_fallback_*` flags do not exist in the schema, the equivalent proxies were derived from `semantic_type IS NULL`:
- `semantic_type IS NULL AND is_dimension AND NOT is_time` → row fell through to `default_to_dimension` path (step 8 of `classify_column`) or `dtype_fallback_text` (step 7), or matched a `_DIMENSION_KEYWORDS` keyword without a fine-grained semantic label
- `semantic_type IS NULL AND is_measure` → row fell through to `dtype_fallback_numeric` (step 7)
- The real "miss" = rows that were assigned the **wrong role** due to keyword coverage gap, not merely rows lacking a semantic label

---

### 90 天数据统计

No `created_at` on `smart_bi_pg_field_definitions` — date filter applied via JOIN to `smart_bi_pg_excel_uploads.created_at`.

- **Total rows in last 90 days**: **4,273** (= 100% of all rows in the table — the table is fully within the 90-day window, no older data exists)
- **Distinct column names**: 416 unique `original_name` values across 4,273 rows (10.3:1 duplication factor — same column names appear across many uploads)

**Role flag distribution (full population = 90-day population):**

| Flag | Count | % |
|---|---|---|
| `is_measure = true` | 521 | 12.2% |
| `is_dimension = true` | 3,563 | 83.4% |
| `is_time = true` | 189 | 4.4% |
| Truly unclassified (all false) | 0 | 0.0% |
| Overlap (any two flags simultaneously) | 0 | 0.0% |

Every row got exactly one role — the classifier never produces ambiguous output.

**Semantic_type coverage (hit rate proxy):**

| semantic_type | Count | % |
|---|---|---|
| NULL / empty (no keyword matched finely) | 3,554 | 83.2% |
| profit | 258 | 6.0% |
| cost | 202 | 4.7% |
| date | 189 | 4.4% |
| product | 32 | 0.7% |
| region | 21 | 0.5% |
| store | 9 | 0.2% |
| payment | 4 | 0.1% |
| revenue | 4 | 0.1% |

**Miss-rate breakdown using "wrong role" definition:**

`dim_no_semantic` = 3,507 rows classified as `is_dimension=true` with no semantic label. Of these, manual inspection of the top distinct names reveals:

| Sub-category | Count (rows) | Notes |
|---|---|---|
| `预算/实际/净利/收入` suffix patterns (should be measure) | ~2,675 | 预算数_N, 本月实际_N, 本年实际, 净利_N, 收入_N, 实际收入, 实际收入_N — numeric budget/actual columns that classify as dimension because `实际` and `预算` are not in `_MEASURE_KEYWORDS` |
| Month columns `N月` (e.g. `10月`, `1月`) | 252 | Should be time; blocked by deliberate single-char exclusion rule in `_TIME_KEYWORDS` |
| Quarter columns `Q1`–`Q4` | 64 | Should be time; not in `_TIME_KEYWORDS` |
| Year columns `2020`–`2025` | 60 | Should be time or dimension depending on context |
| `月份` (should be time) | 15 | Unambiguous time dimension name, not in `_TIME_KEYWORDS` |
| Other ambiguous names | ~441 | 产品, 项目, 预算, 收入 (base name without _N dedup), etc |

`measure_no_semantic` = 47 rows classified as `is_measure=true` with no semantic label — these are `dtype_fallback_numeric` path hits (e.g. `rate_percent_3`, `数量金额_N`, `销售金额`, `销售单价`). The role assignment is correct; only the fine-grained label is missing.

| Metric | Count | % |
|---|---|---|
| Hit: correct role AND has semantic label | 719 | **16.8%** |
| Dimension with semantic label (has named role) | 56 | 1.3% |
| Time with semantic label (date) | 189 | 4.4% |
| Measure with semantic label | 474 | 11.1% |
| **Definite miss: `预算/实际/净利/收入` classified as dimension** | **~2,675** | **~62.6%** |
| Ambiguous miss: month/quarter/year as dimension | 391 | 9.1% |
| Acceptable no-label: measure+dim without semantic label | 498 | 11.7% |
| **Combined miss (wrong role assigned)** | **~2,675–3,066** | **~62–72%** |

**Simplified 4-metric table (best proxies given real schema):**

| Metric | Count | % |
|---|---|---|
| Hit (correct role, has semantic_type) | 719 | 16.8% |
| `default_to_dimension` proxy (dim + no semantic) | 3,507 | 82.1% |
| `dtype_fallback_numeric` proxy (measure + no semantic) | 47 | 1.1% |
| **Combined miss proxy (B OR C)** | **3,554** | **83.2%** |

Note: the combined miss proxy (83.2%) significantly **overstates** true misclassification because it counts `数量金额`, `折后金额`, `分摊优惠` etc (correctly classified measures without needing a semantic label) as "misses." The narrower "wrong role" miss (budget/actual columns classified as dimension) is ~62.6%.

---

### Factory vs Restaurant breakdown (90-day window)

| Scope | Factories | Uploads | Fields | Miss (dim+no-semantic) |
|---|---|---|---|---|
| Factory (F001–F004) | F001, F002, F003, F004 | 196 | 4,019 | 3,483 (86.7%) |
| Restaurant (R_*) | R_BEJ, R_GML, R_ITE, R_SMH, R_XMX, R_YJJ | 8 | 254 | 24 (9.4%) |

**Key finding**: 93.9% of all field rows belong to factory uploads (F003/F004 dominate with 165 uploads / 3,782 fields). The restaurant-domain sample is tiny — only 254 rows across 8 uploads. The extremely high dim-no-semantic rate is driven almost entirely by factory financial Excel files with `预算数_N` / `本月实际_N` column patterns, not restaurant data.

For **restaurant factories only**: 24/254 = 9.4% dim-no-semantic, 42/254 = 16.5% measure-no-semantic, combined = 66/254 = 26.0% no-semantic proxy. Time classification is strong for restaurant data (152/254 = 59.8% `is_time`), likely reflecting POS-format timestamps.

---

### Hardcoded keyword coverage in field_classifier.py

File: `backend/python/smartbi/services/field_classifier.py` (395 lines)

- `_EXPLICIT_OVERRIDES`: **7 entries** (exact-name dict; highest priority)
  - First 7: `商品结账总数`, `账单号`, `外部单号`, `关联单号`, `发票号`, `商品信息`, `整单备注`
- `_TIME_KEYWORDS`: **23 entries** (substring match)
  - First 10: `时间`, `日期`, `周期`, `时段`, `时刻`, `year`, `month`, `period`, `date`, `time`
- `_ID_LIKE_KEYWORDS`: **11 entries** (substring match; routes to dimension)
  - First 10: `账单号`, `单号`, `编号`, `流水号`, `发票号`, `会员号`, `员工号`, `房号`, `id`, `uuid`
- `_MEASURE_KEYWORDS`: **46 entries** (substring match)
  - First 10: `营业额`, `实收额`, `实收`, `应收金额`, `应收`, `销售额`, `收款金额`, `实收金额`, `营收`, `利润`
- `_DIMENSION_KEYWORDS`: **43 entries** (substring match)
  - First 10: `门店`, `店铺`, `区域`, `省份`, `城市`, `大区`, `品牌`, `类别`, `分类`, `状态`
- `RATING_NAME_SUFFIXES`: **3 entries** (suffix match for agg_strategy; `分`, `评分`, `星级`)

**Total hardcoded entries**: 133 across 6 collections.

**Notable gap**: `_MEASURE_KEYWORDS` has no entry for `预算`, `实际`, `净利`, `本月`, `本年`, `本季` patterns. These are extremely common in Chinese management Excel exports (budget vs actual reporting) and are the primary driver of the high miss rate observed above (2,675 rows / 62.6%).

---

### 决策

Per spec v2 §1.2 thresholds:

- **< 10% miss** → spec v3 不需要 B-2 LLM, 仅扩 hardcoded keyword list
- **10-30% miss** → spec v3 需要 B-2 LLM 兜底罕见列名
- **> 30% miss** → spec v3 需要 LLM + 重新设计 hardcoded 库

**This run's miss rate (wrong role, conservative estimate)**: **~62.6%** using factory-dominated data; **~26.0%** for restaurant-only data.

**Recommendation**: **> 30% miss threshold applies when evaluating the full dataset** — spec v3 needs LLM + redesign of hardcoded library. However, the data is highly skewed: 93.9% of rows come from factory financial reports with `预算数_N`/`本月实际_N` column patterns not covered by any keyword. For **restaurant-only scope**, the miss rate falls to ~26% (10–30% band) where LLM bottom-fill without full redesign is sufficient.

**Rationale**: The headline miss rate is dominated by a single pattern class — budget/actual Excel files from F003/F004 — that is outside restaurant Phase A scope. The restaurant-domain data (254 rows, 8 factories) shows a much healthier 9.4% dim-no-semantic rate (below the < 10% threshold) but a 26% combined no-semantic proxy that suggests 10–30% miss territory. Given the restaurant Phase A focus, the practical recommendation is:

1. **Immediately**: add `予算`, `実際` → wait, these are Japanese. Add `预算`, `实际`, `净利`, `本月实际`, `本年实际`, `本季实际` to `_MEASURE_KEYWORDS` — this would resolve 62.6% of the full-dataset miss with zero LLM cost.
2. **B-2 LLM**: Still warranted for restaurant domain (26% combined rate) to handle novel column names in diverse restaurant export formats. Not needed for the F003/F004 factory data.
3. **No full redesign required** — the hardcoded library structure is sound; keyword coverage for known restaurant patterns (POS timestamps, store dimensions) is already strong. Extension, not redesign.

---

## W0.2 — W0.5 Status

| Task | Status | Notes |
|---|---|---|
| W0.1 entity_resolution_admin_queue schema verify | **DONE** | spec v2 §2.3 confirmed accurate |
| W0.2 normalizer hit-rate baseline | **DONE** | full miss-rate breakdown; see section above |
| W0.3 C-handoff coordination decision | PENDING | blocks A-3 path choice (协-α/β/γ) |
| W0.4 W0 review meeting | PENDING | depends on W0.1-W0.3 |
| W0.5 (if needed) spec v3 amendments | PENDING | likely NOT needed given W0.1 confirms spec |
