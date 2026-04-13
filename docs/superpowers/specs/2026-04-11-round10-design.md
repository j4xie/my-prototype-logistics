# Canvas V3 Round 10 — Design Spec

**Date**: 2026-04-11
**Mode**: B+A hybrid with risk-first ordering (Option D from brainstorming)
**Parent**: continues from Round 9 (`5e752ed94`) — see `docs/superpowers/handoffs/2026-04-11-canvas-v3-rounds-1-10-handoff.md` for full history

## Overview

Round 10 has 4 items — 1 critical bug fix + 2 template applications + 1 test habit seed. The goal is to close the most dangerous R7a tail item (drag-reorder silent data loss) while continuing R9's template pattern to 2 more services, and **break the 0/37 test coverage tech debt** by writing the first 2 JUnit tests for R10's own fixes.

**Not in scope**: optimistic lock version header across all APIs, 13 frontend role gates, remaining 13+ Service methods that need template integration, formula engine extension, trigger chain revival, Round 5 test backfill. These stay in the R11+ backlog.

**Effort estimate**: ~6.5 hours + 1-2h buffer for integration/deploy/findings doc.

---

## Item 1 — Drag-reorder Fix (Plan B: Dedicated Endpoint)

### Problem

`FormCanvas.vue.onReorder` updates local `sortOrder` + calls `setDirty()`, but `saveDraft()` at `index.vue:160` only sends `{enabled: true}` to `saveModuleConfig` — field ordering is **never transmitted to the backend**. Customer drags 20 fields into new order, clicks "保存草稿", gets green toast, refreshes the page — **original order restored, all drag work lost silently**. Confirmed by R6 Critic B Scenario 7 + R9 retrospective.

This is active data loss in production today.

### Design

New dedicated REST endpoint `POST /config/modules/{moduleCode}/reorder-fields` on `ConfigController`, wired through `FactoryConfigService.reorderFields(...)`. The reorder operation is atomic, versioned, and immediately persisted — no waiting for `saveDraft()` button click.

#### Backend changes

**Endpoint** (`ConfigController.java`):
```java
@PostMapping("/modules/{moduleCode}/reorder-fields")
@RequireRole({"factory_super_admin", "permission_admin"})
@Operation(summary = "重排模块字段顺序 (Round 10 Fix)")
public ApiResponse<Map<String, Object>> reorderFields(
        @PathVariable String factoryId,
        @PathVariable String moduleCode,
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestBody ReorderFieldsRequest request)
```

**DTO** (new class `dto/config/ReorderFieldsRequest.java`):
```java
public class ReorderFieldsRequest {
    @NotEmpty private List<String> fieldOrder;   // field codes in desired order
    @NotNull private Long expectedVersion;       // optimistic lock (matches FactoryConfiguration.rowVersion)
}
```

**Service** (`FactoryConfigService` interface + `FactoryConfigServiceImpl`):
```java
/** Reorder the field display order for a module in the DRAFT version.
 *  Returns {newVersion, reorderedCount} or throws OptimisticLockException on version mismatch. */
Map<String, Object> reorderFields(String factoryId, String moduleCode,
                                   List<String> fieldOrder, Long expectedVersion,
                                   Long operatorId);
```

**Behavior**:
1. Find DRAFT `FactoryConfiguration` for factory (reject if none exists — "先创建草稿")
2. Verify `rowVersion == expectedVersion` — if mismatch, return 409 with current version
3. Find or create `FactoryModuleConfig` for moduleCode at draft version
4. Read current `fieldConfig` JSONB, update each field's `sortOrder` to match request's index position
5. Persist via `factoryModuleConfigRepository.save()`
6. `@Version` on `FactoryConfiguration` increments rowVersion automatically on draft save
7. `logChange(factoryId, moduleCode, "REORDER_FIELDS", null, {fieldOrder}, "字段重排", operatorId)` — audit trail
8. Return `{newVersion, reorderedCount}`

#### Frontend changes

**API client** (`web-admin/src/api/canvasApi.ts`):
```typescript
export const reorderFields = (factoryId: string, moduleCode: string,
                               fieldOrder: string[], expectedVersion: number) =>
  request.post(`/${factoryId}/config/modules/${moduleCode}/reorder-fields`, {
    fieldOrder, expectedVersion
  })
```

**Component** (`FormCanvas.vue`):
- Replace current `onReorder` that only sets dirty
- New behavior: 500ms debounced call to `reorderFields` API
- On success: flash toast "排序已保存", do NOT set dirty (reorder is its own save)
- On 409 conflict: ElMessageBox "版本冲突,请刷新后重试" + trigger `loadVersion()` refresh
- On other error: ElMessage.error + retain local order (user can retry)

### Rollback plan

If the new endpoint breaks, frontend falls back to old behavior (setDirty, save via saveDraft). The rollback is: revert the FormCanvas.vue onReorder function to its original setDirty-only version. No data loss because the old behavior is a no-op for the field ordering anyway.

### Acceptance

- Drag 20 fields to reverse order → each drop within 500ms triggers single API call (not 20)
- After drop settles, page refresh → order is preserved
- Open 2 tabs, reorder in tab A, save, reorder in tab B without refresh → tab B gets 409, prompted to refresh
- `config_change_log` has `REORDER_FIELDS` entry with operator and field list

---

## Item 2 — MaterialBatch 3rd Hook

### Problem

R9 gave `MaterialBatchServiceImpl.createMaterialBatch` the first 2 hooks of the template (validation + customFields persist), but no event was published. The upstream `MaterialReceivedEvent` is published by `PurchaseServiceImpl` which only fires when the source is a purchase receipt — other sources (生产退料 / 销售退货 / 盘盈入库 / 赠品入库 / 手工调整) never publish any event, so factory-configured trigger chains on the `material_batch` module can't fire for those paths.

### Design

New event class `MaterialBatchCreatedEvent` (modeled after `SalesDeliveryCreatedEvent` from R9), published by `createMaterialBatch` after the dynamic field persist step.

#### New event class (`event/MaterialBatchCreatedEvent.java`)

```java
@Getter
public class MaterialBatchCreatedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String batchId;
    private final String batchNumber;
    private final String materialTypeId;
    private final BigDecimal receiptQuantity;
    private final String sourceDocType;
    private final String sourceDocId;
    private final LocalDateTime createdAt;

    public MaterialBatchCreatedEvent(Object source, String factoryId, String batchId,
                                      String batchNumber, String materialTypeId,
                                      BigDecimal receiptQuantity, String sourceDocType,
                                      String sourceDocId) {
        super(source);
        // ... assign all fields, createdAt = now
    }
}
```

#### Publisher (`MaterialBatchServiceImpl.createMaterialBatch`)

Add at end of method (after customFields persist, before match-to-plans):
```java
if (applicationEventPublisher != null) {
    try {
        applicationEventPublisher.publishEvent(new MaterialBatchCreatedEvent(
            this, factoryId, batch.getId(), batch.getBatchNumber(),
            batch.getMaterialTypeId(), batch.getReceiptQuantity(),
            request.getSourceDocType(), request.getSourceDocId()));
    } catch (Exception e) {
        log.warn("Publish MaterialBatchCreatedEvent failed: {}", e.getMessage());
    }
}
```

#### HANDLED_EVENTS whitelist (`TriggerChainExecutor.java`)

Add `"MaterialBatchCreatedEvent"` to the set (currently 15 entries, will become 16).

### Acceptance

- Creating a material batch via `MaterialBatchServiceImpl.createMaterialBatch` publishes the event
- `TriggerChainExecutor` receives the event and fires configured chains (if any enabled)
- Unit test verifies `applicationEventPublisher.publishEvent(isA(MaterialBatchCreatedEvent.class))` is called once per successful batch creation

### Rollback plan

Remove the event class + revert HANDLED_EVENTS + revert the publish call. Zero customer impact on rollback since no customer has a configured chain for this event yet.

---

## Item 3 — QualityInspection Template Application

### Problem

R9-α subagent found `QualityInspectionServiceImpl.createInspection` already has `validationRuleEvaluator.validate(factoryId, "quality_inspection", "CREATE", ctx)` at line 94. The `QualityInspection` entity has a `customFields` field but the DTO doesn't accept it, so frontend Canvas dynamic fields (e.g. 检测仪器编号, 环境温度, QC 等级) are dropped on submission.

Event is already addressed via `ProductionAlertEvent` added to HANDLED_EVENTS in R9, but that only fires on FAIL. Pass path doesn't publish — deferred to R11.

### Design

Same template as R9 SalesDelivery / MaterialBatch — DTO slot + service persist.

#### DTO change

`CreateQualityInspectionRequest` (file path verified via grep during implementation):
```java
/** Round 10 Fix: Canvas V3 dynamic field values for quality_inspection. */
@Schema(description = "Canvas 动态字段值")
private Map<String, Object> customFields;
```

#### Service change (`QualityInspectionServiceImpl.createInspection`)

After `inspection = inspectionRepository.save(inspection)`:
```java
// Round 10 Fix (R8-α Gap #3 per-module template application): persist Canvas dynamic fields.
if (dynamicFieldService != null && request.getCustomFields() != null
        && !request.getCustomFields().isEmpty()) {
    try {
        dynamicFieldService.setDynamicFields(factoryId, "quality_inspection",
            inspection.getId(), request.getCustomFields());
    } catch (Exception e) {
        log.warn("Canvas dynamic fields save failed for quality inspection {}: {}",
            inspection.getId(), e.getMessage());
    }
}
```

Inject `DynamicFieldService` as `@Autowired(required = false)`.

### Acceptance

- Creating a quality inspection via API with `customFields: {inspector_cert: "QC001", ...}` persists those fields into `cf_*` columns of `quality_inspections` table
- Unit test verifies `dynamicFieldService.setDynamicFields(eq("quality_inspection"), anyString(), eq(customFields))` is called

### Rollback plan

Revert the service method + DTO field. No data migration needed.

---

## Item 4 — Smoke Tests (First 2 JUnit Tests for R10 Fixes)

### Problem

37 R5-R9 P0 fixes have 0 tests (R6 Subagent D finding). Running more audit rounds without writing tests compounds regression risk. R10 seeds the habit by writing the first 2 tests for its own fixes.

### Design

**Test 1** — `MaterialBatchServiceImplTest.testCreateBatchPublishesEvent`
- Mock `MaterialBatchRepository.save()` to return a batch with known id
- Mock `RawMaterialTypeRepository.findById()` to return a valid type
- Mock `ApplicationEventPublisher`
- Call `createMaterialBatch(factoryId, request, userId)` with a valid request
- Verify `eventPublisher.publishEvent(captor.capture())` called once
- Verify captured event `instanceof MaterialBatchCreatedEvent`
- Verify event's `batchId == batch.getId()`

**Test 2** — `QualityInspectionServiceImplTest.testCreateInspectionPersistsCustomFields`
- Mock `QualityInspectionRepository.save()` to return inspection with known id
- Mock `DynamicFieldService`
- Call `createInspection(factoryId, request, userId)` with `customFields = Map.of("inspector_cert", "QC001")`
- Verify `dynamicFieldService.setDynamicFields(eq(factoryId), eq("quality_inspection"), eq(inspectionId), eq(customFields))` called exactly once

**Framework**: JUnit 5 + Mockito (already in Spring Boot 3.2.12 test starter — no new dependencies).

**Test location**:
- `src/test/java/com/cretas/aims/service/impl/MaterialBatchServiceImplTest.java`
- `src/test/java/com/cretas/aims/service/impl/QualityInspectionServiceImplTest.java`

**Run verification**: `mvn -pl cretas-api test -Dtest=MaterialBatchServiceImplTest,QualityInspectionServiceImplTest` should pass.

### Not in scope for these tests

- Real database integration (use `@DataJpaTest` in R11+)
- E2E flow (Playwright) — stays in `tests/canvas-v3/` pattern, R11+
- Controller layer / MVC tests — R11+

### Acceptance

- 2 test classes exist, each with at least 1 `@Test` method that passes
- `mvn test` exit code 0

### Rollback plan

Delete the test files. No production code changes.

---

## Global R10 Acceptance Criteria

At R10 DONE time, all of these must hold:

- [ ] Drag-reorder: manual test on web-admin canvas-editor → reorder + refresh → order preserved
- [ ] Drag-reorder: 2-tab conflict → second save returns 409 + user prompted
- [ ] MaterialBatch: creating a batch publishes `MaterialBatchCreatedEvent` (verified by either a unit test assertion or a log line on server)
- [ ] QualityInspection: creating with customFields persists them (verified by SQL `SELECT cf_* FROM quality_inspections WHERE id = X`)
- [ ] 2 JUnit test classes added, `mvn test` green for the new classes
- [ ] Backend `mvn clean package` compiles cleanly (2200+ files)
- [ ] Web-admin `npm run build` compiles cleanly
- [ ] Committed with ≤20 files, zero scope creep (enforced by concurrent-edit rule 5)
- [ ] Pushed to `origin/main`
- [ ] Deployed via blue-green to prod; `curl https://centerapi.cretaceousfuture.com/api/mobile/health` returns 200
- [ ] `.claude/agent-team-outputs/2026-04-11_round10-findings.md` written with summary + numbers

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Reorder endpoint breaks some existing field sortOrder use case | Medium | Medium | Read-only scan of `fieldConfig` JSONB structure first; only update `sortOrder` keys, don't touch anything else |
| Optimistic lock 409 confuses users | Medium | Low | ElMessageBox with clear "请刷新后重试" message + auto-load latest version |
| MaterialBatchCreatedEvent fires too aggressively (every batch) | Low | Low | Trigger chains check condition per chain; if too noisy, add a `sourceDocType` filter in the default chain |
| QualityInspection DTO name mismatch | Low | Low | Grep for actual DTO name during implementation; spec is nominally "CreateQualityInspectionRequest" but verify |
| Mockito version compatibility with Spring Boot 3.2.12 | Low | Medium | Spring Boot test starter bundles compatible Mockito; if issues arise, use JUnit `@ExtendWith(MockitoExtension.class)` |
| New endpoint 409 masks real errors | Low | Medium | Distinct HTTP codes: 409 for version conflict, 404 for missing draft, 400 for validation errors, 403 for role denied |

## Estimated Effort

| Item | Est | Details |
|---|---|---|
| 1 (drag-reorder endpoint + frontend) | 2h | New endpoint/DTO/service method (~60 lines Java), frontend debounced call + 409 handler (~25 lines) |
| 2 (MaterialBatch event + HANDLED_EVENTS) | 0.5h | New event class (~30 lines) + publish call (~8 lines) + 1 line in whitelist |
| 3 (QualityInspection customFields) | 1h | DTO field + service injection + persist call (~15 lines Java) |
| 4 (2 JUnit tests) | 1.5h | Two test classes, each ~30-50 lines with mocks |
| Integration / compile / commit / push | 0.5h | |
| Deploy + verify | 1h | Blue-green takes ~3 min, verify takes ~5 min, buffer for re-deploy |
| Findings doc | 0.5h | Standard round-report in agent-team-outputs |
| **Total** | **~6h** | Plus 1-2h buffer for surprises |

## Success Criteria (Definition of Done)

R10 is done when:
1. All 4 items are implemented and pushed to main
2. The 2 new JUnit tests exist and pass locally
3. Backend is deployed to prod via blue-green
4. Manual verification of drag-reorder works on prod
5. `round10-findings.md` captures the delta and sets R11 scope

## Deliberate Deviations from Brainstorming Skill

The brainstorming skill mandates invoking `writing-plans` as the terminal state. For R10, we'll still follow that rule — after user review of this spec, invoke writing-plans to break the 4 items into executable tasks with TDD-style acceptance criteria, then execute.
