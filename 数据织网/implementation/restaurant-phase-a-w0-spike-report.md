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

For **restaurant factories only**: 24/254 = 9.4% dim-no-semantic, 42/254 = 16.5% measure-no-semantic, **combined = 66/254 = 26.0% no-semantic proxy** (this is the metric used in §决策 below). Time classification is strong for restaurant data (152/254 = 59.8% `is_time`), likely reflecting POS-format timestamps.

⚠️ **Sample bias caveat**: 8 uploads / 6 factories is statistically thin. Treat 26% as a point estimate with high variance. Heterogeneous restaurant Excel formats may push this number meaningfully in either direction once more factories onboard.

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

**Parallel classifier alert**: `backend/python/smartbi/services/field_detector.py` exists as a second, independent classifier used for the API response path (returns `semanticType`/`chartRole` camelCase). It does **not** write to `smart_bi_pg_field_definitions` — only `field_classifier.py` does. Any keyword additions for A-1 must update BOTH files in lockstep, or the API response will diverge from what is stored. Task 0.4 review meeting must confirm this dual-update plan.

---

### 决策

Per spec v2 §1.2 thresholds:

- **< 10% miss** → spec v3 不需要 B-2 LLM, 仅扩 hardcoded keyword list
- **10-30% miss** → spec v3 需要 B-2 LLM 兜底罕见列名
- **> 30% miss** → spec v3 需要 LLM + 重新设计 hardcoded 库

**Decision metric**: combined no-semantic proxy on the **restaurant-only subset** = **26.0%** (66/254 rows). This is the metric used because Phase A scope is restaurant factories — the full-dataset 83.2% headline is driven by factory financial reports (F003/F004 budget/actual columns) that are out of scope.

**Threshold band**: 26% sits in the **10–30% band** → spec §1.2 says **B-2 LLM bottom-fill warranted, no redesign needed**.

**Recommendation** (single, unambiguous):

1. **Immediate quick-win** (zero LLM cost): add `预算`, `实际`, `净利`, `本月实际`, `本年实际`, `本季实际` to `_MEASURE_KEYWORDS` in BOTH `field_classifier.py` AND `field_detector.py` (see "Parallel classifier alert" above). This resolves the 62.6% factory-data miss and may also pull restaurant miss below 10% if any restaurants use `本月实际` patterns.
2. **B-2 LLM bottom-fill** is still warranted for restaurant domain (26% combined rate post-keyword-expansion may still leave novel column names uncovered, especially across diverse POS formats from new restaurant customers).
3. **No full redesign** — the hardcoded library structure is sound. Keyword coverage for known restaurant patterns (POS timestamps, store dimensions) is already strong. Extension, not redesign.

**Confidence**: Medium-high for the threshold-band placement. Lower for the absolute 26% figure due to thin restaurant sample (8 uploads / 6 factories — see sample-bias caveat above). After 5+ more restaurant uploads, the proxy should be re-measured and the recommendation revisited.

---

## W0.3 跟 C Handoff 协调

**verify date**: 2026-04-28

---

### C handoff doc summary

`C-trust-ui-startup-prompt.md` 关键点:

- C session 范围: Day 23-30, Trust UI + admin config (TrustIndicator 组件 + 卡片集成 + cell-audit 页 + provenance-config 页)
- C Day 26 spec (§6.3): 新建 `web-admin/src/views/system/data-fabric/cell-audit.vue`, URL 为 `/audit/cell?type=<entity_type>&id=<entity_id>&field=<field_name>`, 用途是**字段血统 lineage audit** (field_provenance 表), 不是 entity_resolution_admin_queue 的 admin UI
- C Day 27 spec (§6.4): 新建 `provenance-config.vue`, 管理 `factory_provenance_config` 表配置 (差异阈值/来源优先级/行业默认成本率)
- API: cell-audit 消费 `GET /api/smartbi/provenance/audit?factory_id=X&entity_type=Y&entity_id=Z&field=W` (field_provenance 表的 lineage 详情), 与 entity_resolution_admin_queue 完全无交叉
- C 的 `entity_type` 在 cell-audit context 中是 field_provenance 的 `entity_type` 字段 (product/review/finance/inventory 等 B-stage writer 产生的), 不是 entity_resolution_admin_queue 的 8 个枚举值
- Memory 记录 ("C Day 23-30 + post-review + 2 finance P0 fixes — Trust UI sub-project complete"): TrustIndicator + GoldPreview + cell-audit (Day 26) + provenance-config (Day 27) 全部 ship 并 push origin

### C cell-audit page 当前状态

- **File exists**: YES — `web-admin/src/views/system/data-fabric/cell-audit.vue`
- **Last 3 commits touching it**:
  - `126fe3f5c` 2026-04-27 refactor(数据织网 C): post-review P1.5+P2-cleanup — extract shared code, server-driven bounds
  - `cc38b4270` 2026-04-27 fix(数据织网 C): post-review P1+P2-12 — security/correctness/UX hardening
  - `6249bec46` 2026-04-27 feat(数据织网 C): Day 26 — cell-level lineage audit page + admin endpoint
- **Wired into router**: YES — two entries in `web-admin/src/router/index.ts`:
  1. `/system/data-fabric/cell-audit` (name: `CellAuditSystem`, `hidden: true`, admin roles only)
  2. `/audit/cell` (name: `CellAudit`, `hidden: true`, admin roles only) — canonical NS-7 URL per spec
- **Wired into sidebar**: NO — both router entries have `hidden: true`; no entry in `AppSidebar.vue`
- **entity_type scope**: **COMPLETELY DIFFERENT DOMAIN** — cell-audit.vue queries `GET /api/smartbi/provenance/audit` which reads `field_provenance` table (B-stage cascade engine). The `entity_type` URL param in cell-audit refers to field_provenance entity types (product, review, finance, inventory from B-stage writers). It has **zero coupling** to `entity_resolution_admin_queue` and its 8 entity_type enums (store/product/staff/ingredient/shape_detection/sheet_merge/period_inference/field_conflict)
- **API endpoints used**: `GET /api/smartbi/provenance/audit?factory_id=&entity_type=&entity_id=&field=` (via `pythonFetch` wrapper)
- **Active development status**: Code is stable. Last commit 2026-04-27. Post-review cleanup already done (P1.5+P2 hardening). No in-flight changes expected.

### 决策

**Selected: (协-α)** — Build a NEW page `/admin/data-quality-queue` separate from C's cell-audit.

**Rationale**: C's cell-audit page is purpose-built for `field_provenance` lineage display (B-stage cascade engine output), not for `entity_resolution_admin_queue` admin workflow. The two tables solve fundamentally different problems:
- `field_provenance`: "What data sources contributed to this KPI field value, and with what confidence?" (lineage audit, read-only display)
- `entity_resolution_admin_queue`: "Does this raw string match an existing entity, and should an admin confirm/reject/create?" (entity resolution approval workflow with write operations)

Extending cell-audit.vue (协-β) would require invasive changes to a shipped, post-reviewed, stable component — replacing its read-only lineage display with a stateful approve/reject workflow — creating two fundamentally different UX modes in one file. That tightly couples B-stage provenance UI to A-stage entity resolution admin UI with no shared rendering logic, at the cost of destabilizing C's working code.

协-γ (linking into cell-audit as a detail tab) is also rejected: cell-audit is hardcoded to `field_provenance` lineage queries and cannot render entity_resolution_admin_queue rows without rewriting the API call layer.

협-α is the default spec v2 §2.3 path and requires zero changes to C's code. The two admin queues (`/audit/cell` for field lineage, `/admin/data-quality-queue` for entity resolution) serve different admin workflows and are not redundant.

### Spec v2 §2.3 影响

A-3 路径 in spec v2 §2.3 (lines 294-310): **default (协-α) confirmed — no change to spec required**. The "假设 (协-α) 路径" qualifier at line 301 can now be considered resolved.

Selected file paths (unchanged from spec v2 §2.3):
- `web-admin/src/views/admin/data-quality-queue.vue` (~600 lines) — list + entity_type tabs + filter + bulk action
- `web-admin/src/views/admin/data-quality-queue-detail.vue` (~250 lines) — single item detail + history + approve UI
- `web-admin/src/api/admin/data-quality-queue.ts` (~120 lines)
- `backend/python/smartbi/api/data_quality_queue_admin.py` (~350 lines)

New routes:
- `web-admin/src/router/index.ts`: `/admin/data-quality-queue` (admin only)
- `web-admin/src/components/layout/AppSidebar.vue`: "数据质量队列" menu item under admin section

No cross-link from entity_resolution_admin_queue to cell-audit is planned in A-3 scope (the two tables are accessed from different admin workflows). A future "view field lineage" link from the data-quality-queue detail page TO cell-audit is a Phase B enhancement, not A-3.

### handoff 备忘录 (协-α)

**Safe zones** — things A-3 must NOT touch in C's code:
- `web-admin/src/views/system/data-fabric/cell-audit.vue` — no edits
- `web-admin/src/views/system/data-fabric/provenance-config.vue` — no edits
- `web-admin/src/utils/provenance-labels.ts` — may READ to reuse `sourceLabel()` if entity_resolution_admin_queue rows need source display (the `decided_by_agent` field maps to 'llm'/'normalizer' strings that are different from provenance source types, so reuse is unlikely but check at implementation time)
- `backend/python/smartbi/canonical/provenance/` — no edits (C's lineage engine)
- Router entries `CellAudit` and `CellAuditSystem` — no changes (they are already `hidden: true`, admin-roles-only, and stable)

**Duplication concerns**:
- `entity_type` filter tabs in data-quality-queue.vue will look similar to C's entity_type handling in cell-audit, but the underlying data is `entity_resolution_admin_queue.entity_type` (8 values), not `field_provenance.entity_type`. No code sharing needed.
- Admin role guards (`factory_super_admin`, `platform_admin`, `permission_admin`) are the same as C's cell-audit. Reuse the same meta.roles pattern.

**Sharing strategy for sidebar**: AppSidebar.vue does NOT currently have a "data fabric admin" section visible in the sidebar (C's cell-audit entries are both `hidden: true`). A-3 will add the first visible admin entry for data-quality-queue. Consider grouping future data-fabric admin links together if A-3 also wants to surface a link to provenance-config.

**For Task 0.4 review meeting**: Confirm whether A-3's data-quality-queue should include any "cross-link" to cell-audit for rows with `entity_type = 'field_conflict'` (since field_conflict rows originated from the C provenance cascade and MIGHT have a corresponding field_provenance record). This cross-link is out of A-3 scope but the spec reviewer should explicitly acknowledge the omission.

---

---

## W0.4 Review Meeting Decisions

**meeting date**: 2026-04-28
**Status**: All 3 W0 spikes complete (W0.1/W0.2/W0.3). 12 reviewer findings consolidated.

### 决策 (3 binding)

**D1 — spec v3 needed?**: **NO**.
- W0.1 confirmed schema matches spec v2 §2.3 exactly (1 minor gap: no `updated_at`, non-blocking)
- W0.3 confirmed default 协-α path is correct
- W0.2 schema divergence (column naming: `is_dimension`/`is_measure`/`is_time` vs plan template names) is in the plan template only — spec v2 already abstracts away from those names; the spec talks about the *output* of classification, not the column names
- Spec v2 stands as implementation reference. No re-review needed.

**D2 — B-2 LLM in Phase A scope?**: **NO** (defer to Phase B).
- Restaurant miss rate ~26% places it in spec §1.2's 10-30% band ("LLM bottom-fill warranted"), but Phase A scope is data closure (ETL+completeness+queue), not classifier improvements
- Quick keyword expansion (6 keywords to BOTH classifiers) is also deferred to Phase B unless miss rate degrades during A deploy and hits > 30%
- Phase B brainstorm trigger: Phase A complete + 5+ more restaurant uploads ingested; re-measure proxy then

**D3 — Confirm A-3 path = 协-α**: **CONFIRMED**.
- New separate `/admin/data-quality-queue` page (admin-scoped)
- No edits to C's `cell-audit.vue` or `provenance-config.vue`
- `field_conflict` rows in queue do NOT deep-link to cell-audit in A-3 (defer to Phase B)
- First visible admin queue UI entry in sidebar (C's cell-audit entries remain `hidden: true`)

---

### 12 Findings → A-1 / A-3 Implementation Checklist

Each finding below is binding for the implementer subagent that runs the task. Transcribe into the implementation prompt verbatim — do not paraphrase away the technical specifics.

**A-3 (Tasks 3.1–3.6):**

1. **source_upload_id has no FK constraint** → A-3 LEFT JOIN must handle `uploaded_by IS NULL` gracefully. The 4-eye bypass condition must check `join_result IS NULL` (not just `admin_count == 1`): if the LEFT JOIN returns no upload row, treat as "submitter unknown" → bypass 4-eye and record `{"four_eye_bypassed": "no_upload_row"}` in `extra` JSONB.

2. **created_at nullable despite DEFAULT now()** → Python typing for the queue row model must use `Optional[datetime]` for `created_at`. Do not use `datetime` (non-optional) or the Pydantic model will crash on any row where DEFAULT was not applied.

3. **RLS FORCE with single tenant_isolation policy** → A-3 FastAPI MUST execute `SELECT set_config('app.factory_id', $1, true)` **inside the same transaction** before any query on `entity_resolution_admin_queue`. A connection acquired from the pool that does not have the GUC set will return 0 rows silently (FORCE RLS — no permission error, just empty result). Pattern reference: `backend/python/smartbi/agent/narrative_cache.py` lines 85-88 (proven pattern already in use). Failure to set GUC is the single most dangerous silent correctness bug in A-3.

4. **Partial indexes** `idx_er_admin_queue_pending` (WHERE admin_at IS NULL) and `idx_eraq_pending_priority` (WHERE status='PENDING') are present → A-3 list API MUST default to `status=PENDING` filter when no `status` query param is provided. A full-table scan (omitting the WHERE status='PENDING' clause) will not use the partial indexes even if the table grows large. This is a performance correctness requirement, not just a UX default.

5. **Reuse `require_admin`** from `backend/python/smartbi/canonical/provenance/_admin_auth.py` — this function is already shared with `provenance_audit.py` and `factory_provenance_config.py`. DO NOT re-implement admin auth in `data_quality_queue_admin.py`. Import path: `from smartbi.canonical.provenance._admin_auth import require_admin`. If you add new roles, add them to the `_ADMIN_ROLES` set in `_admin_auth.py`, not inline in the new file.

6. **Frontend `pythonFetch` wrapper** — A-3's `web-admin/src/api/admin/data-quality-queue.ts` must use the existing `pythonFetch` utility (provides snake_case → camelCase auto-convert) for consistency with `cell-audit.vue`. Do NOT use raw `axios` or `request` for Python backend calls.

7. **Python EntityType enum is incomplete** — `backend/python/smartbi/canonical/entity_resolution/orchestrator.py` defines only 3 values (STORE/PRODUCT/STAFF). The DB CHECK constraint has 8. A-3 must hardcode the full set directly from the DB CHECK (do not import from the orchestrator enum):
   ```python
   VALID_ENTITY_TYPES = frozenset({
       "store", "product", "staff", "ingredient",
       "shape_detection", "sheet_merge", "period_inference", "field_conflict"
   })
   ```
   Validate incoming `entityType` query param against this set. Return HTTP 422 if invalid.

8. **Sidebar precedent** — all existing C data-fabric pages (`cell-audit`, `provenance-config`) are `hidden: true` in `web-admin/src/router/index.ts`. A-3's `/admin/data-quality-queue` will be the **first non-hidden** data-fabric admin queue UI. Place the sidebar entry under the existing "管理" / "数据治理" group in `AppSidebar.vue`. If this group does not yet exist in the sidebar (it is only in the router), create it. Check the sidebar group structure at implementation time.

9. **field_conflict rows deep-link to cell-audit** — defer to Phase B (NOT in A-3 scope). A-3's detail page for `entity_type='field_conflict'` rows shows the same UI as other types (raw_name + candidate + resolve/reject). The "view field lineage →" cross-link to cell-audit is explicitly out of scope. Record this as a known omission in the A-3 smoke test doc so reviewers do not flag it.

**A-1 (Tasks 1.1–1.6):**

10. **Dual-classifier alert** — keyword additions must update BOTH `backend/python/smartbi/services/field_classifier.py` (writes to `smart_bi_pg_field_definitions.semantic_type`) AND `backend/python/smartbi/services/field_detector.py` (returns `semanticType`/`chartRole` in API response) **in the same commit**. The two files are independent implementations that must stay in lockstep. Owner: whichever A-1 subtask touches keyword files. This is NOT a separate task — it is a constraint on A-1 keyword work.

11. **Quick-win keyword expansion (6 keywords)** is **Phase B candidate, NOT A-1 work**. The 6 keywords (`预算`, `实际`, `净利`, `本月实际`, `本年实际`, `本季实际`) would resolve ~62.6% of factory-data miss, but Phase A scope is ETL data closure, not classifier improvements. Do NOT add these keywords during A-1 unless the miss rate measured post-A-1 deploy degrades past 30% on the restaurant subset. If added later, remember finding 10 (dual-file update).

**General:**

12. **No spec v3 needed** — W0 confirmed all 3 critical assumptions (schema correct, classifier extensible without redesign, A-3 path stable). Spec v2 stands as the sole implementation reference. W0.5 is cancelled. Phase A proceeds directly to Task 1.1.

---

### Phase A plan structure unchanged

Total 21 tasks across 5 sections (W0 done × 4, A-1 × 6, A-2 × 2, A-3 × 6, Smoke × 3). No re-numbering. No path changes. W0.5 cancelled (not needed). Proceeds straight to Task 1.1.

---

## W0.2 — W0.5 Status

| Task | Status | Notes |
|---|---|---|
| W0.1 entity_resolution_admin_queue schema verify | **DONE** | spec v2 §2.3 confirmed accurate |
| W0.2 normalizer hit-rate baseline | **DONE** | full miss-rate breakdown; see section above |
| W0.3 C-handoff coordination decision | **DONE** | 选 (协-α): 全新页面 /admin/data-quality-queue; cell-audit 是不同域 (field_provenance lineage), 无侵入 |
| W0.4 W0 review meeting | **DONE** | 3 decisions (D1/D2/D3) + 12 findings checklist; spec v2 stands |
| W0.5 (if needed) spec v3 amendments | **NOT NEEDED** | W0 confirmed all assumptions; spec v2 is implementation reference |
