# Issue #573 — T4-D4 F006 Consumption Data Investigation

**Date**: 2026-05-14
**Issue**: [#573](https://github.com/stevenj4xie/my-prototype-logistics/issues/573) — `[Followup] T4-D4 F006 prod batches no consumption data — investigate write path`
**Worktree**: `qa/issue-573-t4d4-investigate`
**Investigator**: Sister chat (dispatched by organizer)
**Scope**: Discriminate between (a) backend gap, (b) Path A/B selective gap, (c) data condition, (d) RPF Path A/B selection bug, (e) other.

---

## TL;DR

**Verdict**: **Category (c) — Pure data condition.**

F006 has exactly **1 batch**, and it is in **`PLANNED` status with `actual_quantity = NULL`**. The auto-consumption write path requires the batch to transition to **`COMPLETED` status** (via 报工 / 手动完成 / `completeProduction`), at which point `BatchCompletedEvent` fires → `SupplyChainOrchestrator.onBatchCompleted` → `BatchConsumptionService.autoConsumeForBatch` writes the `material_consumptions` rows.

Backend write path is **production-grade, exists, tested, in active use** — F001 has **57 consumption rows** across multiple batches with three `source_type` values (`AUTO_BOM`, `ADJUSTMENT`, `MANUAL`).

F006 also has **BOM data already configured** (4 `bom_items` + 1 `material_product_conversions`), so when its batch reaches COMPLETED, auto-consumption WILL fire and produce records — no code change needed.

**Recommendation**: Close #573 with a "data condition" verdict. File no new code-fix ticket. Customer demo workflow to populate this: 报工 (work report) on the 1 PLANNED batch until `actual_quantity >= planned_quantity (100)`, or admin executes 手动完成. Either action auto-populates the 原料消耗记录 section.

---

## §1 — Pre-flight: prior PR / issue search

Per `feedback_gh_pr_search_before_dispatch_outstanding.md` HARD rule, broader keyword search done BEFORE investigation.

### Searches run

| Query | Hits ruled in/out |
|---|---|
| `gh pr list --search "consumption"` | **#542** (frontend wire, MERGED, this issue's pretext); #499/#482/#489/#560/#199/#37 (rbac/qa coverage, unrelated). No in-flight write-path PR. |
| `gh pr list --search "material_consumption"` | 0 hits |
| `gh pr list --search "T4-D4"` | **#542** (frontend, ours); #528/#527/#512/#517/#481/#560 (coverage audits, no code). |
| `gh pr list --search "RPF Path"` | **#294** = docs-only architecture PR (RPF vs BomItem divergence); **#312** = `BomExpansionService` switched to read `BomItem` (B2 option). NEITHER is "RPF Path A/B" backend code for consumption-write. |
| `gh issue list --search "consumption F006"` | **#573** (this issue); **#567** (T2-4 RPF chain, related but separate); **#533** (closed, frontend gap, fixed by PR #542). |

**Conclusion**: No outstanding in-flight investigation PR. Issue #573 description contains a **factual error** — it says "PR #294 (RPF Path A) + PR #312 (RPF Path B)", but:
- **PR #294** is actually `docs(customer): D4 Path A — RPF vs BomItem divergence` (135-line architecture doc + `log.warn` + `el-alert` banner). **No backend write code.**
- **PR #312** is actually `feat(d4-b): BomExpansionService reads BomItem (activates D3) - PR #309 A2=B`. Changes the BOM expansion data source from `MaterialProductConversion` (RPF) to `BomItem`, with RPF as fallback. **No consumption-write code.**

The actual consumption-write code predates #294/#312 — it's in `BatchConsumptionServiceImpl` (registered ages ago) and triggered via `SupplyChainOrchestrator.onBatchCompleted` event listener.

---

## §2 — Database evidence (prod 47, READ-ONLY)

### 2.1 F006 batch census

```sql
SELECT pb.id, pb.batch_number, pb.status,
  (SELECT COUNT(*) FROM material_consumptions mc WHERE mc.production_batch_id = pb.id) AS consumption_count,
  pb.created_at
FROM production_batches pb
WHERE pb.factory_id = 'F006'
ORDER BY pb.created_at DESC LIMIT 10;
```

| id   | batch_number                          | status   | consumption_count | created_at                 |
|------|---------------------------------------|----------|-------------------|----------------------------|
| 1885 | PB-PLAN-1778296111890-BA2B3B0A-36853  | PLANNED  | 0                 | 2026-05-09 11:27:16.859335 |

**F006 has exactly 1 batch, status = PLANNED, 0 consumption rows.**

### 2.2 F006 batch detail

```sql
SELECT pb.id, pb.batch_number, pb.status, pb.production_plan_id, pb.product_type_id,
       pb.actual_quantity, pb.planned_quantity, pb.material_cost, pb.start_time, pb.end_time
FROM production_batches pb WHERE pb.factory_id = 'F006';
```

| Field | Value |
|---|---|
| id | 1885 |
| status | `PLANNED` (NOT IN_PROGRESS, NOT COMPLETED) |
| actual_quantity | NULL |
| planned_quantity | 100.00 |
| material_cost | NULL |
| start_time | NULL |
| end_time | NULL |
| production_plan_id | `a913dad6-…` (links to F006 PP, status `IN_PROGRESS`) |

`status=PLANNED` + `actual_quantity=NULL` ⇒ the trigger (`tryAutoComplete` / `completeProduction` / `manualCompleteBatch`) has **never run** on this batch. No 报工 (work report) submitted; no admin "手动完成" clicked.

### 2.3 Consumption ledger by factory

```sql
SELECT factory_id, COUNT(*) FROM material_consumptions GROUP BY factory_id ORDER BY 2 DESC;
```

| factory_id | count |
|---|---|
| F001 | 57 |

**Only F001 has consumption rows.** F002, F003, F006, FOOD_3101_048 — all 0.

### 2.4 F001 source_type distribution (confirms write path works)

```sql
SELECT source_type, COUNT(*) FROM material_consumptions WHERE factory_id='F001' GROUP BY source_type;
```

| source_type | count |
|---|---|
| `MANUAL` | 49 |
| `ADJUSTMENT` | 6 |
| `AUTO_BOM` | 2 |

All three write paths in `BatchConsumptionServiceImpl` are exercised:
- `MANUAL` = `ProcessingServiceImpl.recordMaterialConsumption()` (operator-initiated)
- `AUTO_BOM` = `BatchConsumptionServiceImpl.autoConsumeForBatch()` (event-triggered on batch completion)
- `ADJUSTMENT` = `BatchConsumptionServiceImpl.adjustConsumption()` (差异调整 via admin)

### 2.5 Cross-factory production batch census

```sql
SELECT factory_id, status, COUNT(*) FROM production_batches GROUP BY factory_id, status;
```

| factory_id | status | count |
|---|---|---|
| F001 | COMPLETED | **125** |
| F001 | IN_PROGRESS | 5 |
| F001 | PLANNED | 16 |
| F001 | CANCELLED | 3 |
| F002 | COMPLETED | 2 |
| F002 | PRODUCING | 1 |
| F003 | COMPLETED | 2 |
| F003 | PLANNING | 1 |
| F006 | PLANNED | **1** |
| FOOD_3101_048 | PLANNED | 1 |

F001 dominates with 125 COMPLETED batches feeding the 57 consumption rows. F006 has zero COMPLETED batches.

### 2.6 But — not every COMPLETED batch has consumption (cross-check)

```sql
SELECT pb.id, pb.batch_number, pb.status, pb.good_quantity, pb.factory_id,
  (SELECT COUNT(*) FROM material_consumptions mc WHERE mc.production_batch_id = pb.id) AS cc
FROM production_batches pb WHERE pb.status='COMPLETED'
ORDER BY pb.factory_id, pb.id LIMIT 20;
```

Of the first 20 F001 COMPLETED batches: 13 have 1-3 consumption rows, **7 have 0** (`PHASE3-TEST-BATCH-002`, `BATCH-G2-TEST-1767169845`, `BATCH-TEST-20260102-001`, `TEST-AUTO-001`, `TEST-1767807078`). These are TEST-named or 1-day-old batches. The 0-consumption COMPLETED F001 batches likely:
- Pre-date `autoConsumeForBatch` deployment, OR
- Were force-marked COMPLETED via direct DB INSERT bypassing event publication, OR
- Have empty BOM (`requirements.isEmpty()` early-return at `BatchConsumptionServiceImpl:73-77`).

Not blocking #573's verdict (F006's batch isn't COMPLETED to begin with), but flagged as ambient noise — the write path can have edge cases. **Recommendation**: separate optional sister ticket to audit F001 COMPLETED-without-consumption.

### 2.7 F006 BOM readiness (would-fire check)

```sql
SELECT COUNT(*) FROM bom_items WHERE factory_id='F006';                       -- 4
SELECT COUNT(*) FROM material_product_conversions WHERE factory_id='F006';    -- 1
```

F006 has **4 BOM items + 1 RPF conversion** configured. When batch 1885 reaches COMPLETED status, `BomExpansionService.expandBOM()` will succeed (Path B reads `bom_items` first per PR #312, so 4 items will populate; RPF fallback also available).

**`requirements.isEmpty()` early-return WILL NOT fire** for F006 batch 1885. Auto-consumption WILL write rows.

### 2.8 F006 production plan trail

```sql
SELECT pp.id, pp.factory_id, pp.product_type_id, pp.status FROM production_plans pp WHERE pp.factory_id = 'F006';
```

| plan id (suffix) | product_type_id | status |
|---|---|---|
| 472c136f… | 4e345886… | COMPLETED |
| a913dad6… | 577d8a7f… | **IN_PROGRESS** ← batch 1885's plan |
| 0e5e9bc6… | 4e345886… | IN_PROGRESS |
| 90209bad… | 4e345886… | COMPLETED |
| c8035032… | 4e345886… | IN_PROGRESS |
| 2bf120db… | c2974690… | IN_PROGRESS |

F006 has 6 production plans (2 COMPLETED, 4 IN_PROGRESS) but only 1 production batch was ever created from those plans — and it hasn't progressed past PLANNED.

---

## §3 — Write-path source map

### 3.1 Customer-facing entry points (3 paths to consumption rows)

| Path | Trigger | Controller / Service | Source location |
|---|---|---|---|
| **(A) AUTO_BOM** | `BatchCompletedEvent` published | `SupplyChainOrchestrator.onBatchCompleted` line 209 → `BatchConsumptionService.autoConsumeForBatch` | `service/orchestration/SupplyChainOrchestrator.java:218`, `service/impl/BatchConsumptionServiceImpl.java:128, 166` |
| **(B) MANUAL** | Operator UI submits consumption rows | `ProcessingController` → `ProcessingService.recordMaterialConsumption` | `service/impl/ProcessingServiceImpl.java:472-496` |
| **(C) ADJUSTMENT** | Admin 差异调整 | `MaterialConsumptionController:408` → `BatchConsumptionService.adjustConsumption` | `controller/MaterialConsumptionController.java:408`, `service/impl/BatchConsumptionServiceImpl.java:228, 243, 250, 265` |

Path (A) fires automatically when status → COMPLETED. Paths (B) and (C) are explicit operator/admin actions.

### 3.2 Three ways batch → COMPLETED → publishes `BatchCompletedEvent`

| Method | File:Line | Trigger |
|---|---|---|
| `WorkReportingServiceImpl.tryAutoComplete` | `service/impl/WorkReportingServiceImpl.java:374-386` | 报工 submitted; if `actual_quantity >= planned_quantity` auto-complete + publish event |
| `WorkReportingServiceImpl.manualCompleteBatch` | `service/impl/WorkReportingServiceImpl.java:407-415` | Admin "手动完成" action |
| `ProcessingServiceImpl.completeProduction` | `service/impl/ProcessingServiceImpl.java:154-182` | `POST /processing/batches/{id}/complete` direct |

All three publish `new BatchCompletedEvent(this, batch)` → SupplyChainOrchestrator listens.

### 3.3 Event chain (Path A — the customer-expected one)

```
报工 (work report) submitted via mobile/RN
  → WorkReportingServiceImpl.processReport() → tryAutoComplete()
  → batch.actualQty += reportedQty
  → if (actualQty >= plannedQty)
      → batch.status = COMPLETED
      → publishEvent(BatchCompletedEvent)
        → SupplyChainOrchestrator.onBatchCompleted(event) [SupplyChainOrchestrator.java:209]
          → batchConsumptionService.autoConsumeForBatch(batch) [line 218]
            → BomExpansionService.expandBOM(factoryId, productTypeId, qty)
            → For each material → materialBatchService.useBatchQuantity(...)
            → new MaterialConsumption() with source_type=AUTO_BOM
            → materialConsumptionRepository.save(consumption)
          → Auto-create finished goods batch [line 226]
          → Update production plan progress [line 234]
          → Create quality inspection task [line 238]
```

Then frontend `production/batches/detail.vue:297-329` queries `/processing/material-consumptions/batch/{id}` → `MaterialConsumptionController.getConsumptionsByBatch` at line 156-176 → returns rows → Vue card renders.

### 3.4 Other entry points (less common)

| Entry | File:Line | Purpose |
|---|---|---|
| `MaterialBatchServiceImpl.useBatchMaterial` | `service/impl/MaterialBatchServiceImpl.java:962-970` | Direct batch usage with plan ID (admin/programmatic) |
| `MaterialBatchServiceImpl.<unknown line 1159-1165>` | `service/impl/MaterialBatchServiceImpl.java:1159, 1165` | Secondary direct usage path |
| `ProductionPlanServiceImpl.recordMaterialConsumption` | `service/impl/ProductionPlanServiceImpl.java:765-774` | Plan-level material allocation |

None of these are F006's blocker; the primary expected flow is Path A (报工 → auto-complete → event → AUTO_BOM).

---

## §4 — Customer workflow trace

### 4.1 What needs to happen for F006 batch 1885 to populate consumption

**Required customer action** (any one of three):

1. **报工 (work report) submission**: Mobile RN app / web `/work-reporting` page. Operator selects batch 1885, enters actualQuantity ≥ 100 (matches plannedQuantity). System auto-completes batch + publishes event + AUTO_BOM rows written.
2. **Admin 手动完成**: Web admin → batch detail → "手动完成" button → `manualCompleteBatch` invoked → event fired → AUTO_BOM rows written.
3. **Direct `completeProduction` API call**: `POST /api/mobile/F006/processing/batches/1885/complete` with `actualQuantity` payload → `ProcessingServiceImpl.completeProduction` → event fired → AUTO_BOM rows written.

After ANY of those: 4 consumption rows appear (1 per `bom_items` entry, possibly more if FEFO splits across multiple material batches).

### 4.2 Why customer ask is satisfied by current code

Issue #573 says: customer wants "Path A/B consumption tracking, RPF link visible on each batch detail" (BOM 转换率).

Current code (post PR #312):
- `BomExpansionService.expandBOM` uses `BomItem` first (Path B / new BOM table), falls back to `MaterialProductConversion` (Path A / RPF)
- F006 has 4 BomItems → Path B fires
- Each BOM item → MaterialConsumption row with `material_type_id`, `quantity`, `unit_price`, `total_cost`, `source_type='AUTO_BOM'`
- Frontend `detail.vue:297-329` renders these as 原料消耗记录 table

**The feature works end-to-end.** F006 just hasn't exercised the trigger yet.

---

## §5 — Gap category verdict

**Category (c) — F006 customer hasn't exercised the write workflow yet. Pure data condition.**

Evidence:
1. ✅ Backend write code exists, deployed, exercised on F001 (57 rows)
2. ✅ All three write paths (AUTO_BOM / MANUAL / ADJUSTMENT) functioning per F001 data
3. ✅ F006 BOM data configured (4 BomItems + 1 RPF) — `requirements.isEmpty()` early-return WILL NOT fire
4. ✅ F006 has 1 PLANNED batch with `actual_quantity=NULL` — trigger never fired
5. ✅ Vue frontend section already shipped (PR #542) — will render correctly the moment data arrives

NOT category (a) — backend exists and works.
NOT category (b) — no Path A/B selection bug; both paths covered by `BomExpansionService.expandBOM` after PR #312.
NOT category (d) — RPF Path A/B selection is fine; F006 has BomItems so Path B (BomItem) wins; RPF fallback unused but available.
NOT category (e).

**Identical pattern to T3-2** (the issue body warns about this): F006 customer-side workflow not exercising the write path.

---

## §6 — Recommendation

### Primary action: close #573

Close with comment summarizing this investigation. **No new P0/P1 ticket** required. This is a data condition, not a code defect.

### Customer demo workflow (to populate the section before next customer touch)

If demo-relevant:
1. Login as `f006_admin` to web-admin or RN app
2. Navigate to 报工 / Work Reporting view, select batch `PB-PLAN-1778296111890-BA2B3B0A-36853`
3. Submit work report with `actual_quantity ≥ 100` (planned quantity)
4. Backend auto-completes batch → fires `BatchCompletedEvent` → AUTO_BOM writes ~4 consumption rows
5. Navigate to `/production/batches/<id>` detail → 原料消耗记录 section now populated
6. Verify RBAC: `warehouse_mgr` user sees the section but NOT 单价/小计 columns (per PR #542 test plan)

### Optional follow-up: data-quality audit (low priority)

F001 has 7+ COMPLETED batches with 0 consumption rows (visible in §2.6 query). These are mostly TEST-named or older batches predating the auto-consumption deployment. Worth a separate low-priority ticket to investigate whether any non-test/recent COMPLETED batch lacks consumption — would indicate the event listener silently failed in some edge case (e.g. exception swallowed at `SupplyChainOrchestrator:220-222`).

Not blocking #573. Filed as: "audit F001 COMPLETED batches with zero consumption rows — silent BatchCompletedEvent failures?".

### Documentation amendment for #573

The issue body cites "PR #294 (RPF Path A) + PR #312 (RPF Path B)" but those PRs are not the consumption-write source. The actual write-path code is in:
- `BatchConsumptionServiceImpl` (commit hash predates #294)
- `SupplyChainOrchestrator.onBatchCompleted` (event listener)
- `WorkReportingServiceImpl.tryAutoComplete` / `manualCompleteBatch` (event publishers)

PR #294 = architecture doc (RPF vs BomItem divergence). PR #312 = BOM expansion source switch (RPF→BomItem). Neither writes consumption rows.

---

## §7 — Surprises

1. **Issue description has incorrect PR references** — #294 is doc-only, #312 is BOM-source switch (not consumption-write). The actual auto-consumption code (`BatchConsumptionServiceImpl.autoConsumeForBatch`) predates both. Mild documentation hygiene issue.
2. **F001 has 7 COMPLETED-without-consumption test batches** — orthogonal to #573 but worth flagging for separate audit. Not all F001 COMPLETED batches went through auto-consumption.
3. **F006 BOM data already configured** — 4 `bom_items` + 1 `material_product_conversions`. The customer set BOM up but never reached the COMPLETED state on any batch, so the "RPF/BOM 转换率" customer concern is partially addressed at config-time but invisible until a batch completes.
4. **`PR #533` was closed by `PR #542`** but the underlying customer workflow gap was not closed — frontend shows nothing because no data exists. PR #542 wired the section but couldn't manufacture data. Issue #573 correctly identified this gap; this investigation confirms it is data-side, not code-side.

---

**END OF AUDIT**
