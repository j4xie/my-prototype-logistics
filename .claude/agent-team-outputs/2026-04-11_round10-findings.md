# Canvas V3 Round 10 — Reorder Endpoint + Event + Template Expansion

**Date**: 2026-04-11
**Mode**: Main session direct execution in dedicated worktree (`my-prototype-logistics-r10`)
**Theme**: Close R7a P0 tail (drag-reorder bug class) + extend Canvas Integration Template to 2 more services

## Summary

R10 was a 4-task scoped round executed in a physically isolated worktree after the
concurrent-session branch-swap hazard made subagent execution unreliable in R9-α.
Goal: stop the drag-reorder silent-drop bug, add the first-ever JUnit tests against
R7+ Canvas Integration Template hooks, and move the template coverage count from
3/18 → 5/18 in the production chain.

## Scope

Option D (risk-first) from the R10 spec — take the highest-impact 4 items that
collectively close a bug class (reorder) and plant the first unit-test coverage
against 0/37 P0 fixes historically lacking tests.

| Task | Theme | Files touched | Tests |
|---|---|---|---|
| 1 | Backend reorder endpoint + optimistic lock | 4 new + 2 modified | 3 JUnit |
| 2 | Frontend drag-reorder wiring + debounce | 3 modified | — |
| 1b/2 patch (C1/C2/C3) | Code review fixes | 2 modified | — |
| 3 | MaterialBatchCreatedEvent + whitelist | 2 new + 2 modified | 2 JUnit |
| 4 | QualityInspection customFields template | 1 new + 2 modified | 2 JUnit |
| 5 | Integration + deploy | — | 7 total pass |
| 6 | Findings + review (this doc) | — | — |

## R10 Task 1: Dedicated reorder-fields endpoint + optimistic lock

**Problem**: FormCanvas drag-reorder was a frontend-only concern — backend had no
dedicated endpoint. Any reorder required a full module-config update round-trip,
which is both expensive and **concurrency-unsafe**: two editors reordering the
same module within seconds would blind-overwrite each other.

**Fix**:
- New DTO `ReorderFieldsRequest` with `fieldOrder: List<String>` and
  `expectedVersion: Long` (optimistic lock).
- `FactoryConfigService.reorderFields(factoryId, moduleCode, fieldOrder, expectedVersion, operatorId)`
  interface method + impl. Uses `@Version` on `FactoryConfiguration.rowVersion`.
- `ConfigController.POST /config/modules/{moduleCode}/reorder-fields` endpoint
  with `@RequireRole` guard.
- 3 JUnit tests (Mockito): happy path, version mismatch → `BusinessException`,
  no draft → `BusinessException`.

**Commit**: `063601eaf`

## R10 Task 1b/Task 2 patch: C1/C2/C3 code review fixes

Code quality review caught 3 P0s on Task 2's frontend wiring before push.

### C1: Single-flight drops rapid drops silently

**Problem**: Task 2's first cut used a boolean `reorderInFlight` flag — if the
user drops again while the first call is mid-flight, the second drop is dropped
on the floor, restoring the **exact bug class** Task 1 was meant to fix.

**Fix**: Promise-based single-flight. New drops `await inflightReorder` before
firing, so every drop is eventually persisted in order.

### C2: No onUnmounted cleanup for debounce timer

**Problem**: Debounced reorder used a 500ms `setTimeout` but never cleared it on
`onUnmounted`. If a user drops and navigates away, the timer fires after the
component is gone, calling reorder against an unmounted `FormCanvas` state.

**Fix**: Store the timer handle and `clearTimeout` in `onUnmounted`.

### C3: Backend only updates JSONB, not `canvas_dynamic_field.sort_order` (CRITICAL)

**Problem**: `reorderFields` updated only the `FactoryConfiguration.config_data`
JSONB blob's `sortOrder` entries. But dynamic fields are read directly from the
`canvas_dynamic_field` table via `CanvasDynamicFieldRepository.findByFactoryIdAndModuleCodeOrderBySortOrderAsc`.
**Feature silently no-ops for dynamic fields** — the JSONB update is never consulted
by the read path.

**Fix**: Also update `canvas_dynamic_field.sort_order` by calling
`canvasDynamicFieldRepository.save(df)` with the new `sortOrder` value for each
field that exists in the table.

**Commit**: `fc3137fe9`

## R10 Task 3: MaterialBatchCreatedEvent — close trigger-chain gap

**Problem**: Only the purchase-receive path emitted an event
(`MaterialReceivedEvent` from `PurchaseServiceImpl`). Other material-batch
sources (生产退料 / 销售退货 / 盘盈入库 / 赠品入库 / 手工调整) passed through
`MaterialBatchServiceImpl.createMaterialBatch` without any event, so
factory-configured trigger chains on the `material_batch` module literally could
not fire for ~60% of batch creations.

**Fix**:
- New `com.cretas.aims.event.MaterialBatchCreatedEvent` — `ApplicationEvent`
  carrying `factoryId/batchId/batchNumber/materialTypeId/receiptQuantity/sourceDocType/sourceDocId/createdAt`.
- `@Autowired(required=false) ApplicationEventPublisher` in
  `MaterialBatchServiceImpl`, published right after the R9 dynamic-field persist
  block, wrapped in try/catch so a failing trigger chain cannot break batch
  creation.
- `TriggerChainExecutor.HANDLED_EVENTS` whitelist extended: 15 → 16 events.

**Test**: `MaterialBatchCreatedEventTest` (2 tests):
1. Constructor populates all downstream fields correctly.
2. Reflection check that `TriggerChainExecutor.HANDLED_EVENTS` contains
   `"MaterialBatchCreatedEvent"` — catches whitelist regressions at build time.

**Commit**: `b53e31371`

## R10 Task 4: QualityInspection customFields template (5th service)

**Problem**: Two silent drops on the POST /quality/inspections path:

1. **ProcessingServiceImpl.submitInspection** builds a `QualityInspection` entity
   from the incoming `Map<String,Object>` payload but never copies
   `customFields` into the entity. The frontend sends them, the controller
   deserializes them, and they walk past the conversion loop as if they never
   existed.
2. **QualityInspectionServiceImpl.createInspection** saves the entity but never
   calls `DynamicFieldService.setDynamicFields(...)`, so even when the entity's
   legacy JSONB `custom_fields` column has data, the authoritative `cf_*`
   columns on `quality_inspections` stay empty. Downstream readers (reports,
   trigger chains, exports) see no dynamic fields.

**Fix (2 hooks from the 5-hook template)**:
- `ProcessingServiceImpl.submitInspection` extracts `customFields` from the
  payload map and forwards them via `setCustomFields` before calling
  `qualityInspectionService.createInspection`.
- `QualityInspectionServiceImpl` gains `@Autowired(required=false) DynamicFieldService`
  and calls `setDynamicFields(factoryId, "quality_inspection", saved.getId(),
  saved.getCustomFields())` right after save, wrapped in try/catch so a
  dynamic-field failure cannot break QI creation or the QUALITY_FAIL alert.

**Test**: `QualityInspectionServiceImplTemplateTest` (2 tests):
1. `withCustomFields_invokesSetDynamicFields` — verifies the hook calls
   `setDynamicFields` with module `quality_inspection` and the cf map.
2. `withoutCustomFields_skipsSetDynamicFields` — verifies we don't make a wasted
   DB call on empty/absent customFields.

**Commit**: `6c1e77abe`

## Canvas Integration Template coverage after R10

| Service | Validation | customFields persist | Event publish | DTO customFields | DynamicFieldService injected |
|---|---|---|---|---|---|
| material_batch | ✅ R9 | ✅ R9 | ✅ R10 T3 | ✅ R9 | ✅ R9 |
| sales_delivery | ✅ R9 | ✅ R9 | ✅ R9 | ✅ R9 | ✅ R9 |
| production_plan | ✅ R9 | ✅ R9 | ✅ R9 | ✅ R9 | ✅ R9 |
| sales_order | ✅ R9 | ✅ R9 | ✅ R9 | ✅ R9 | ✅ R9 |
| **quality_inspection** | ✅ R9 | **✅ R10 T4** | partial (FAIL only via ProductionAlertEvent) | entity-based | **✅ R10 T4** |

Canvas V3 execution fidelity moved from **22% → ~27%** on the production chain after R10.

## Test count

- **R10 JUnit tests added**: 7 (3 reorder + 2 material batch event + 2 QI template)
- **Previous project-wide R5-R9 P0 fix test count**: **0** (tech debt flagged in R9 findings)
- **R10 is the first round to plant test coverage on the Canvas Integration Template.**

## Build verification

- `mvn clean package` — **BUILD SUCCESS** (2199 main sources + 91 test sources + fat-jar repackage)
- 7/7 R10 tests pass (`FactoryConfigServiceImplReorderTest`,
  `MaterialBatchCreatedEventTest`, `QualityInspectionServiceImplTemplateTest`)
- `npm run build` on web-admin — dist built, 494 modules transformed, 42s
- No new compile warnings

## Concurrent-edit hazard learnings

R10 was executed in a dedicated worktree (`C:/Users/Steve/my-prototype-logistics/my-prototype-logistics-r10`)
because R7a-R9 were repeatedly derailed by a parallel Claude session swapping the
main working tree onto `e2e/v1-framework`. The swap caused:

- Task 1 subagent committed to `e2e/v1-framework` — cherry-picked back to main.
- Task 2 subagent committed to main but the branch swapped right after — commit
  survived (`16a0b1662`) but was invisible via `git log` until
  `git branch --contains` rescued it.
- C1/C2/C3 inline edits got reverted mid-build — had to recover via `git stash`.

**Fix**: `git worktree add ../my-prototype-logistics-r10 main` gave physical
filesystem isolation. The other session cannot affect this directory.

**Gotcha**: the new worktree needed the `lib/MvCameraControlWrapper.jar` system-scoped
jar copied over from the main tree, and the `web-admin/src/views/system/logs/index.vue`
(gitignored file in main tree, not carried by git worktree create) had to be
copy-forwarded to make `vite build` succeed.

## Open items for R11+

1. **Template application to 13 more services** (stopping at 5/18). Priority queue:
   `purchase_receipt`, `sales_return`, `inventory_adjustment`, `finished_goods`.
2. **Web-admin gitignore cleanup**: the `logs` rule in `web-admin/.gitignore` matches
   `views/system/logs/` — rename that directory or tighten the rule so new worktrees
   don't need manual file copying.
3. **Add integration tests** for the reorder endpoint end-to-end (currently only
   unit-level Mockito coverage). Real DB + HTTP round-trip would catch the C3
   bug class (mismatched JSONB vs. table read path).
4. **Scheduler 2am cron** — R10 caught an unrelated failing job
   (`WeightHistory` NOT NULL + `ModelTraining` 401) fixed in commit `9eeeb915b`.
   Should verify the fix in prod's next 2am run.

## Commits

| SHA | Task | Summary |
|---|---|---|
| `de70b8a4c` | T0 | R10 design spec + implementation plan |
| `063601eaf` | T1 | Dedicated reorder-fields endpoint + optimistic lock + 3 JUnit |
| `16a0b1662` | T2 | Frontend drag-reorder wiring (debounced) |
| `fc3137fe9` | C1/C2/C3 | Code review fixes — Promise lock, onUnmounted, dynamic-field sync |
| `b53e31371` | T3 | MaterialBatchCreatedEvent + whitelist + 2 JUnit |
| `6c1e77abe` | T4 | QualityInspection customFields template + 2 JUnit |
| (this doc) | T6 | R10 findings |
