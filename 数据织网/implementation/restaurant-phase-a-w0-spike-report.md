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

## W0.2 — W0.5 (Pending)

Tasks W0.2 through W0.5 are not yet completed. This report covers W0.1 only.

| Task | Status | Notes |
|---|---|---|
| W0.1 entity_resolution_admin_queue schema verify | **DONE** | spec v2 §2.3 confirmed accurate |
| W0.2 normalizer hit-rate baseline | PENDING | |
| W0.3 C-handoff coordination decision | PENDING | blocks A-3 path choice (协-α/β/γ) |
| W0.4 W0 review meeting | PENDING | depends on W0.1-W0.3 |
| W0.5 (if needed) spec v3 amendments | PENDING | likely NOT needed given W0.1 confirms spec |
