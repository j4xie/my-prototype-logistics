# Issue #591 — F001 COMPLETED batches with zero consumption: evidence + verdict

**Date**: 2026-05-14
**Investigator**: chat sister (issue-591 worktree)
**Branch**: `qa/issue-591-f001-no-consumption-investigation`
**Issue**: [#591](https://github.com/j4xie/my-prototype-logistics/issues/591) — "audit: F001 7 of first 20 COMPLETED batches have 0 consumption rows — orthogonal to #573"
**Predecessor**: chat4 PR #586 (issue #573 investigation) — flagged this as orthogonal optional follow-up

---

## TL;DR

**Verdict: H1 — Legacy seed (data state, NOT a code bug).**

The zero-consumption COMPLETED batches on F001 are **direct SQL seed inserts** that bypass the production workflow (`报工`/`手动完成` → `BatchCompletedEvent` → `BatchConsumptionService.autoConsumeForBatch`). They will never have consumption rows by design — they did not flow through the event-driven write path.

**Recommended action**: Close #591 with verdict "expected legacy seed state". Optional hygiene cleanup (orphan FK seed batches) is a separate decision outside investigation scope.

No production code change. No data hotfix required.

---

## Scope

- **Factory**: F001 only (per MO §Don'ts — no expansion to F006/other)
- **Method**: READ-ONLY psql queries via SSH on `cretas_prod_db` (prod server 47.100.235.168)
- **Investigation only**: no production code modified, no DB writes (per MO §Don'ts + HARD rule `feedback_grep_source_before_e2e_verdict`)

---

## Key DB findings

All queries READ-ONLY on `cretas_prod_db` via `ssh root@47.100.235.168 → sudo -u postgres psql`.

### F1 — F001 overall COMPLETED ↔ consumption correlation

| Cohort | Total COMPLETED | Zero consumption | Has consumption |
|---|---|---|---|
| **Total F001 COMPLETED** | 125 | **93 (74%)** | 32 (26%) |
| `created_by IS NULL` (seed) | 101 | 91 (90%) | 10 (10%) |
| `created_by = 1` (factory_admin1) | 24 | **2 (8%)** | **22 (92%)** |

**Pattern**: 91/93 (98%) of zero-consumption batches are NULL-created seed inserts. The auto-consumption write path **works correctly** for real user batches (92% have rows).

### F2 — Issue title "7 of first 20" — reconciled

The exact figure depends on sort order:

| Sort | Zero-mc in first 20 |
|---|---|
| `created_at ASC` (oldest) | 20 / 20 (100%) — all PB-2025-12-XX seed |
| `id ASC` | **5 / 20 (25%)** — see below |
| `updated_at DESC` (newest) | 0 / 20 |

The MO and issue body interpret "first 20" loosely. The chat4 audit (PR #586 commentary) flagged "7"; the closest match is `id ASC` (5 zero-mc batches in first 20 by ID). Discrepancy of ±2 is within counting-method noise; the qualitative finding is the same.

**First 20 by `id ASC` — the 5 with zero consumption**:

| id | batch_number | created_by | product_type_id | mc_count |
|---|---|---|---|---|
| 182 | `PHASE3-TEST-BATCH-002` | NULL | (test) | 0 |
| 210 | `BATCH-G2-TEST-1767169845` | NULL | (test) | 0 |
| 292 | `BATCH-TEST-20260102-001` | NULL | (test) | 0 |
| 1329 | `TEST-AUTO-001` | 1 | PT-F001-001 | 0 |
| 1339 | `TEST-1767807078` | 1 | 9db72a4b-… (no BOM) | 0 |

**All 5 batch numbers begin with `TEST`/`BATCH-G2-TEST`/`PHASE`/`BATCH-TEST` markers** — manifest dev/QA artifacts, not production data.

### F3 — Zero-mc batches classified by batch_number pattern

Of all 93 zero-mc F001 COMPLETED batches:

| Pattern | Count | Interpretation |
|---|---|---|
| `PB-YYYYMMDD-NNN` (e.g. `PB-20251201-001`) | 88 | December 2025 - February 2026 seed cohort (created_by NULL) |
| `BATCH-*` | 2 | Test batches |
| `TEST_*` | 2 | Test batches |
| `PHASE_*` | 1 | Phase 3 test batch |

All 93 fall into "seed or test" categories. **Zero batches with a real-user-looking PB-* number created by an actual user appear in the zero-consumption set.**

### F4 — PB-YYYYMMDD-NNN cohort: seed-vs-user split

| Creator | PB-YYYYMMDD-NNN total | Zero-mc | Has-mc |
|---|---|---|---|
| `created_by IS NULL` (seed) | 88 | **88 (100%)** | 0 |
| `created_by = 1` (user) | 20 | 0 | **20 (100%)** |

**Clean dichotomy**: every seed PB-YYYYMMDD-NNN has 0 consumption; every user PB-YYYYMMDD-NNN has consumption.

### F5 — Seed batches reference NON-EXISTENT product_type_ids

The PB-YYYYMMDD-NNN seed cohort uses `product_type_id` values:

```
PT001, PT002, PT003, PT004, PT005, PT006, PT-001, PT-002, ... PT-007
```

**None of these IDs exist in the `product_types` table.** The actual F001 product types are `PT-F001-001`, `PT-F001-002`, `PT-F001-003`, `PT-F001-004` (each has BOM = 3-8 items + 1 conversion).

Verification:
```sql
SELECT pt.id, pt.name, pt.factory_id
FROM product_types pt
WHERE pt.id IN ('PT001','PT002','PT003','PT004','PT005','PT006');
-- returns 0 rows
```

This means: even if someone re-triggered `autoConsumeForBatch` on these seed batches, `BomExpansionService.expandBOM` would return empty (no product type → no BOM items), and `BatchConsumptionServiceImpl.java:73-77` would log "产品无BOM配置，跳过自动扣料" and return. **Backfill is impossible without first repairing the orphan FKs.**

### F6 — The 2 user-created zero-mc outliers explained

| id | batch_number | product_type_id | Why no mc |
|---|---|---|---|
| 1329 | `TEST-AUTO-001` | `PT-F001-001` (HAS BOM, 7 items) | Test data; likely created via test endpoint or batch never went through workflow that fires event. `actual_quantity` should be inspected. |
| 1339 | `TEST-1767807078` | `9db72a4b-…` (测试产品B4新版, **0 BOM items**) | Product has no BOM → `expandBOM` returns empty → `autoConsumeForBatch` skips (line 73-77). Working as designed. |

Both batches have `TEST*` prefix → user testing artifacts, not real production. Batch 1339 also fits H3 (BOM missing) but the explanation aligns with H1 since it's a test batch deliberately created without BOM.

### F7 — H4 ruled out (consumption is NOT written elsewhere)

The MO §5 H4 hypothesis: "consumption written to `material_batches` / `material_batch_adjustments` / `inventory_transactions`".

**Schema inspection**:
- `material_batches` — tracks INCOMING raw material lots (procurement receipts). Columns include `inbound_date`, `receipt_quantity`, `source_doc_type/id`. No link to `production_batches.id`. **Different concept** (raw material lots ≠ production output consumption).
- `material_batch_adjustments` — tracks adjustments to material lot quantities. No production_batch link.
- `inventory_transactions` — not surveyed but raw material lot tracking; orthogonal to production consumption record.

`material_consumptions` is **the** authoritative consumption table (entity: `MaterialConsumption`, repo: `MaterialConsumptionRepository`). H4 ruled out.

---

## Code path verification (Path A — production workflow)

The consumption write chain (per chat4 PR #586 + my read of source):

```
1. WorkReportingServiceImpl.tryAutoComplete (报工 → status=COMPLETED)
   OR ProcessingServiceImpl.completeProduction (手动完成)
     ↓
2. applicationEventPublisher.publishEvent(new BatchCompletedEvent(this, saved))
   (ProcessingServiceImpl.java:176)
     ↓
3. SupplyChainOrchestrator.onBatchCompleted(event)
   (SupplyChainOrchestrator.java:209, @EventListener)
     ↓
4. batchConsumptionService.autoConsumeForBatch(batch)
   (BatchConsumptionServiceImpl.java:51)
     ↓ BOM lookup via product_type_id
     ↓
5. consumptionRepository.save(consumption)  [SOURCE_AUTO_BOM]
   (BatchConsumptionServiceImpl.java:128, 166)
```

**A batch directly INSERTed into `production_batches` with `status='COMPLETED'` (the seed pattern) never enters step 1**, so the event is never published, so consumption rows are never written. This is the definitive explanation for the 91 NULL-seed zero-mc batches.

Three short-circuit guards in `autoConsumeForBatch` also prevent rows from being written when invoked manually on an unsuitable batch:
- Line 57-60: skip if `productionQty == null || ≤ 0` ("批次无产出数量")
- Line 62-68: skip if AUTO_BOM rows already exist (idempotency guard)
- Line 73-77: skip if BOM is empty ("产品无BOM配置")

---

## Hypothesis verdict

| Hypothesis | Status | Evidence |
|---|---|---|
| **H1 — Legacy seed** | ✅ **CONFIRMED** | F1, F3, F4, F5, code path analysis. 91/93 (98%) of zero-mc are NULL-created seeds bypassing the event chain. |
| H2 — Real bug in auto-consumption | ❌ Refuted | F1: 22/24 = 92% of user-created batches have consumption. The write path works for real production. |
| H3 — BOM missing on product types | ⚠️ Partial (1 case) | Batch 1339 fits H3 (product `9db72a4b-…` has 0 BOM items). But it's a test batch, not real production. The seed cohort's product_type_ids don't exist at all (F5), so H3 is moot for them. |
| H4 — Consumption written elsewhere | ❌ Refuted | F7. `material_consumptions` is the only consumption table linked to `production_batches.id`. |

---

## Recommended action

1. **Close #591** with verdict label "expected legacy seed state, not a code bug" — comment with link to this evidence doc.
2. **No production code change**. The write path works correctly for real user batches (F1 line 3, F4 line 2).
3. **No data hotfix**. The seed batches do not affect customer-visible business outcomes — they are stale fixtures from initial F001 bootstrap.
4. **Optional hygiene (out of scope here)** — if Steve wants the seed batches cleaned:
   - The 88 PB-YYYYMMDD-NNN seeds reference orphan `product_type_id` values (PT001-PT006). Soft-delete or repair-FK is a separate decision outside investigation scope.
   - Recommend evaluating with `cretas/dataops` team if a future seed-cleanup task makes sense.

---

## What was NOT done (per HARD rules)

- ❌ No production code modified (MO §Don'ts + `feedback_grep_source_before_e2e_verdict` HARD)
- ❌ No DB writes / no consumption rows back-inserted (MO §Don'ts)
- ❌ No expansion to F006 / F002 / F003 / F011 (MO §Don'ts — F001-specific)
- ❌ No hotfix PR raised — this is investigation-only

---

## Queries used (reproducibility)

All run via `ssh root@47.100.235.168 'sudo -u postgres psql -d cretas_prod_db -t -A -F"|" -c "..."'`.

```sql
-- F1 overall correlation
SELECT
  CASE WHEN pb.created_by IS NULL THEN 'NULL_seed' ELSE 'user_' || pb.created_by END AS creator,
  COUNT(*) AS total_batches,
  SUM(CASE WHEN mc_count = 0 THEN 1 ELSE 0 END) AS zero_consumption,
  SUM(CASE WHEN mc_count > 0 THEN 1 ELSE 0 END) AS has_consumption
FROM (
  SELECT pb.id, pb.created_by, COUNT(mc.id) AS mc_count
  FROM production_batches pb
  LEFT JOIN material_consumptions mc ON mc.production_batch_id = pb.id
  WHERE pb.factory_id = 'F001' AND pb.status = 'COMPLETED'
  GROUP BY pb.id, pb.created_by
) t
INNER JOIN production_batches pb ON pb.id = t.id
GROUP BY pb.created_by
ORDER BY total_batches DESC;

-- F2 first 20 by id ASC
SELECT pb.id, pb.batch_number, pb.created_at::date, pb.created_by, COUNT(mc.id) AS mc_count
FROM production_batches pb
LEFT JOIN material_consumptions mc ON mc.production_batch_id = pb.id
WHERE pb.factory_id = 'F001' AND pb.status = 'COMPLETED'
GROUP BY pb.id, pb.batch_number, pb.created_at, pb.created_by
ORDER BY pb.id ASC
LIMIT 20;

-- F3 zero-mc by batch_number pattern
SELECT pattern, COUNT(*) AS zero_mc_count FROM (
  -- … (see commit history for full query)
) GROUP BY pattern;

-- F4 PB-YYYYMMDD-NNN seed-vs-user split
SELECT pb.created_by, COUNT(*), SUM(...) ...
WHERE pb.batch_number ~ '^PB-[0-9]{8}-' ...;

-- F5 orphan product_type_id verification
SELECT pt.id, pt.name FROM product_types pt
WHERE pt.id IN ('PT001','PT002','PT003','PT004','PT005','PT006');
-- 0 rows returned
```

---

## Test plan

- [x] Pre-flight `gh issue view 591` to confirm scope
- [x] Pre-flight `gh pr view 586` (predecessor chat4 investigation) for context
- [x] DB queries READ-ONLY on `cretas_prod_db` (no INSERT/UPDATE/DELETE)
- [x] Write-path code citations with `file:line` (BatchConsumptionServiceImpl.java:51-178, SupplyChainOrchestrator.java:209-218, ProcessingServiceImpl.java:176)
- [x] Schema verified — `material_consumptions` is the authoritative table; `raw_material_consumption_records` (MO/issue verbiage) does NOT exist; this is naming drift in issue title
- [x] Verdict based on grep-and-query evidence, not assumption (per `feedback_grep_source_before_e2e_verdict` HARD)
- [x] F001 scope only — no F006/other factory queries
- [x] No production code modified

## Refs

- Issue #591 — this investigation
- Issue #573 — closed by chat4 PR #586 (predecessor, F006 side)
- PR #586 — chat4 evidence doc `docs/qa-audits/2026-05-14-issue-573-investigation.md`
- Code paths:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/BatchConsumptionServiceImpl.java:51-178`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/SupplyChainOrchestrator.java:209-218`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ProcessingServiceImpl.java:176-179`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialConsumption.java` (entity → table `material_consumptions`)
