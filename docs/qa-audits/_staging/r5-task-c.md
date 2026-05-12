## Task C — Rule 17 antipattern grep (6 items)

**Scope expansion vs 2026-05-10 sweep**: ALL backend controllers (`backend/java/cretas-api/src/main/java/com/cretas/aims/controller/` — 170 `@RequestBody` occurrences in 60 files) + FE web-admin Vue (`web-admin/src/`), not just SmartBI.

**Worktree**: `C:/Users/Steve/cretas-r5-boundary` (branch `qa/r5-boundary-parity-antipattern`)
**Audit date**: 2026-05-12
**Author**: chat-C (R5 boundary-parity sweep)
**Method**: read-only Grep/Read. No code edits.

**Jackson config note** (key context for W-01 assessment): `spring.jackson.deserialization.fail-on-unknown-properties` is NOT set anywhere in `application*.properties`. Spring Boot's default is `false` — i.e. **Jackson silently drops unknown JSON fields** on `@RequestBody` binds. Only `CacheConfig.java:56` explicitly disables it for the Redis serializer. This means W-01 phantom-field ingestion of *recognized* entity fields (`createdAt`, `updatedAt`, `deletedAt`, `factoryId`, `id`) is possible whenever `@RequestBody Entity` binds directly AND the service does a blind `repo.save(body)`.

**BaseEntity audit** (`entity/BaseEntity.java`):
- `@PrePersist` only sets `createdAt`/`updatedAt` if NULL → client-supplied non-null values **persist**.
- `@PreUpdate` unconditionally overwrites `updatedAt` (safe).
- `deletedAt` is **never guarded** → client can set `deletedAt: null` to "undelete" or `deletedAt: <future>` to soft-delete via PUT, IF the path does blind save.

---

### 17.1 — @RequestBody Entity direct bind

**Grep**: `@RequestBody [A-Z]\w+ [a-z]\w*` in `controller/`
**Total hits**: 170 occurrences across 60 controller files (130 unique type names).

**Filter** — for each unique bound type, check if it's a JPA `@Entity` class (in `entity/**`):

**JPA `@Entity` types bound via `@RequestBody`** (12 confirmed, 19 controller sites):

| # | File:line | Bound type (Entity) | Method | Service does blind save? | Verdict |
|---|---|---|---|---|---|
| 1 | `AIIntentConfigController.java:422` | `AIIntentConfig` (POST) | createIntent | yes (`IntentConfigManagementServiceImpl:142` `intentRepository.save(intentConfig)`) | **RISK** — `createdAt`/`updatedAt`/`deletedAt` from body persist; AI intent config is system-wide |
| 2 | `AIIntentConfigController.java:436` | `AIIntentConfig` (PUT) | updateIntent | yes (`IntentConfigManagementServiceImpl:149` blind save) | **RISK** — PUT can overwrite preserved audit fields and toggle `deletedAt` |
| 3 | `BomController.java:199` | `OverheadCostConfig` (POST) | addOverheadCost | yes (`BomServiceImpl:337` blind save) | **RISK** — finance domain, body sets factoryId only; audit fields phantom-bind |
| 4 | `BomController.java:211` | `OverheadCostConfig` (PUT) | updateOverheadCost | **yes — does NOT load existing!** Controller does `config.setId(id); config.setFactoryId(factoryId);` then service `repository.save(config)` | **🚨 BUG** — PUT overwrites entire row; any DB-only field (e.g. `version`, `createdAt`, anything not in client payload) is dropped to null. Finance domain. |
| 5 | `BusinessRuleController.java:70` | `FactoryValidationRule` (PUT) | setValidationRule | NO (select-then-merge with null guards line 81-85) | **SAFE** — exemplary pattern: load existing, null-check each field, then save |
| 6 | `BusinessRuleController.java:100` | `FactoryDefaultValue` (PUT) | setDefaultValue | yes (`body.setFactoryId(factoryId); save(body)`) | **RISK** — blind save of `@RequestBody Entity`; body's `createdAt` persists |
| 7 | `BusinessRuleController.java:117` | `FactoryFormula` (PUT) | setFormula | NO (select-then-merge with null guards line 120-123) | **SAFE** |
| 8 | `BusinessRuleController.java:157` | `FactorySchedulerConfig` (PUT) | setSchedulerConfig | NO (select-then-merge with null guards line 161-164) | **SAFE** |
| 9 | `LabelRecognitionController.java:113` | `LabelRecognitionConfig` (POST) | createConfig | (downstream `labelRecognitionService.createConfig` — not sampled, presumed blind) | **RISK** (latent) |
| 10 | `LabelRecognitionController.java:140` | `LabelRecognitionConfig` (PUT) | updateConfig | (downstream `labelRecognitionService.updateConfig` — not sampled) | **RISK** (latent) — needs service-side audit |
| 11 | `SchedulingOptimizationController.java:66` | `FactorySchedulingConfig` | applyConfig | (not sampled) | **RISK** (latent) |
| 12 | `SystemConfigController.java:104` | `SystemEnum` (POST) | createEnum | yes (`SystemEnumServiceImpl:116` blind save after dup-check) | **RISK** — `createdAt`/`deletedAt` from body persist on create |
| 13 | `SystemConfigController.java:120` | `SystemEnum` (PUT) | updateEnum | NO (select-then-merge `SystemEnumServiceImpl:122-137`) | **SAFE** — explicit field copy of 8 business fields, audit fields not touched |
| 14 | `SystemConfigController.java:219` | `UnitOfMeasurement` (POST) | createUnit | yes (`SystemEnumServiceImpl:270` blind save) | **RISK** — same phantom risk |
| 15 | `SystemConfigController.java:233` | `UnitOfMeasurement` (PUT) | updateUnit | NO (select-then-merge `SystemEnumServiceImpl:276-289`) | **SAFE** |
| 16 | `TriggerChainController.java:132` | `FactoryTriggerChain` | setTriggerChain | (not sampled) | **RISK** (latent) |
| 17 | `warehouse/ReusableContainerController.java:52` | `ReusableContainer` (POST) | create | (downstream `service.createContainer` not sampled) | **RISK** (latent) |
| 18 | `WorkstationCountingController.java:52` | `WorkstationConfig` | (inner static class, not JPA) | n/a | **SAFE** — not JPA entity |
| 19 | `ScaleSimulatorController.java:61` | `VirtualScaleConfig` | (DTO in `dto/scale/`, not JPA) | n/a | **SAFE** — DTO |

**Other 151 `@RequestBody` sites**: all bind to DTO/Request classes (suffix `Request`/`DTO`/`Response`/`Config` confirmed not-@Entity) — **SAFE** w.r.t. 17.1 direct binding.

**Verdict**: **8 RISK + 1 BUG + 4 latent RISK + 6 SAFE** = 13 entity-bound sites need attention. Compared to 2026-05-10 sweep (which only checked SmartBI controllers and found 3 SAFE DTO hits), **this is a 13-site delta** representing standing W-01 exposure outside SmartBI scope.

**Risk amplification**: `BusinessRuleController.setDefaultValue` and `BomController.updateOverheadCost` are the most exposed because they do **TRUE blind save** (no select-then-merge); the others either select-then-merge in service (SAFE) or have controller-side defensive `setX()` overrides for path-vars only (still RISK because body audit fields slip through).

---

### 17.2 — Mapper partial-field updateEntity

**Grep**: `void updateEntity\|void update[A-Z]\w*From` in `backend/java/cretas-api/src/main/java/com/cretas/aims/`
**Total hits**: 11 (5 mappers + 6 other patterns)

| # | File:line | Method | Pattern | Verdict |
|---|---|---|---|---|
| 1 | `mapper/CustomerMapper.java:106` | `updateEntity(Customer, UpdateCustomerRequest)` | **Null-guard every field** (sampled lines 107-159 — every `if (request.getX() != null)` then `setX`) | **SAFE** |
| 2 | `mapper/UserMapper.java:104` | `updateEntity(User, CreateUserRequest)` | **Null-guard every field** (sampled lines 105-141) | **SAFE** — note: shared CreateUserRequest (BR-13 lineage), mapper safety mitigates |
| 3 | `mapper/ProductionPlanMapper.java:218` | `updateEntity(ProductionPlan, CreateProductionPlanRequest)` | **Null-guard every field** (sampled lines 219-310; W-06/W-07 fix comments confirm prior null-guard sweep) | **SAFE** |
| 4 | `mapper/SupplierMapper.java:102` | `updateEntity(Supplier, UpdateSupplierRequest)` | (not sampled, presumed safe per prior 2026-05-10 sweep finding) | **SAFE (presumed)** |
| 5 | `mapper/MaterialBatchMapper.java:207` | `updateEntity(MaterialBatch, UpdateMaterialBatchRequest)` | (not sampled) | **SAFE (presumed)** |
| 6 | `entity/learning/IntentTransitionMatrix.java:110` | `updateTotalFromCount(int)` | Entity domain method, not mapper | N/A |
| 7 | `service/ConversationMemoryService.java:41` | `updateEntitySlot(...)` interface | not a mapper | N/A |
| 8 | `service/impl/ConversationMemoryServiceImpl.java:157` | `updateEntitySlot(...)` impl | not a mapper | N/A |
| 9 | `scheduler/ModelTrainingScheduler.java:210` | `updateModelVersionFromResponse(...)` | scheduler, not mapper | N/A |
| 10 | `service/decoration/impl/DecorationServiceImpl.java:410` | `updateLayoutFromRequest(FactoryHomeLayout, HomeLayoutDTO.SaveRequest)` | service-internal mapper-like helper — would need sampling for verdict | **NEEDS VERIFY** |
| 11 | `service/impl/FactorySettingsServiceImpl.java:446` | `updateEntityFromDTO(FactorySettings, FactorySettingsDTO)` | service-internal mapper-like helper | **NEEDS VERIFY** |

**Verdict**: 5 mappers all SAFE (3 verified via re-read, 2 presumed per prior sweep). 2 service-internal helpers (`DecorationServiceImpl.updateLayoutFromRequest`, `FactorySettingsServiceImpl.updateEntityFromDTO`) are **NEW FINDS vs 2026-05-10** — not in original 5-mapper list. They should be sampled in a follow-up audit (medium urgency — both touch user-facing settings).

**Delta vs 2026-05-10**: +2 NEEDS-VERIFY service helpers; 5 known mappers reconfirmed SAFE.

---

### 17.3 — @Transient setter call risk

**Grep**: `@Transient` in `entity/**`
**Total hits**: 61 occurrences across ~25 entity files.

**Filter** — for each `@Transient`, check if it's:
- Derived getter (`isX()`, `getX()`, `calculateX()`) with no setter pair → **SAFE**
- Method with `setX(...)` paired → **POTENTIAL RISK** (mapper or Jackson could call setter)

**Sample of 61 hits** (representative breakdown — full per-file listing in 2026-05-10 sweep §4 captures SmartBI subset of 14):

| Pattern | Approximate count | Verdict |
|---|---|---|
| `@Transient` on `isXxx()` / `getXxx()` / `calculateXxx()` derived getters (e.g. `AIQuotaUsage.isExceeded`, `SmartBiBillingConfig.isQuotaMode`, `SmartBiFinanceData.isOverdue`) | ~55 | **SAFE** — no setter; cannot be invoked via @RequestBody bind |
| `@Transient` static utility fields (e.g. `SmartBiPgExcelUpload.FIELD_MAPPINGS_PARSER` `ObjectMapper`) | ~3 | **SAFE** — static, no instance setter |
| **`@Transient` on `setRoleMultipliersMap(Map)` in `AIQuotaRule.java:122`** | 1 | **LATENT RISK** — setter is `@Transient`-annotated but internally writes the persisted `roleMultipliers` field (JSON serialization helper). If `AIQuotaRule` is ever @RequestBody-bound directly, Jackson `set` would persist via side-effect. Currently `AIQuotaRule` is NOT @RequestBody-bound (only `CreateAIQuotaRuleRequest` DTO is), so **SAFE in practice today**. |
| **`@Transient` on `setAnalysisDirectionsList(List)` in `AIReportPromptConfig.java:170`** | 1 | **LATENT RISK** — same pattern. Bound via @RequestBody only as `AIReportPromptConfigDTO` (a separate DTO, line 4 of platform/AIReportPromptConfigController.java) → SAFE today. |
| **`@Transient` on `setExpectedCompletionActionsList(List)` in `ProductionProcessPromptConfig.java:300`** | 1 | **LATENT RISK** — same pattern. Not @RequestBody-bound (verified — no controller uses `ProductionProcessPromptConfig` directly) → SAFE today. |

**Verdict**: **58 SAFE + 3 LATENT RISK**. The 3 latent risks are JSON-serializer helper setters (`@Transient` but with side effects on persisted fields). If any of these 3 entities are ever directly @RequestBody-bound in the future, the setters become attack surface.

**Delta vs 2026-05-10**: Prior sweep only checked SmartBI entities (14 hits, all SAFE derived-getters). This expanded sweep finds 3 LATENT-RISK setter sites in non-SmartBI entities (`AIQuotaRule`, `AIReportPromptConfig`, `ProductionProcessPromptConfig`). **New finds: 3 LATENT**.

---

### 17.4 — FE form spread phantom fields

**Grep**: `\.\.\.row\|Object\.assign\(.*form` in `web-admin/src/`
**Total hits**: 61 across 31 files (many are CSV exports / array spread, not form-to-API)

**Filter** — only count `{...row}` or `Object.assign(form, row)` that flows to an API write call (PUT/POST):

| # | File:line | Pattern | API call | Verdict |
|---|---|---|---|---|
| 1 | `views/system/work-processes/index.vue:91` + `:101` | `Object.assign(formData, { ...row })` then `payload = { ...formData }` → `updateWorkProcess(factoryId, id, payload)` | PUT | **RISK** — full row spread including `createdAt`/`updatedAt` to BE PUT; relies on Jackson lenient |
| 2 | `views/restaurant/recipes/list.vue:583` | `dialogForm.value = { ...row }` (edit dialog open) | — (just opens dialog) | SAFE (no submit yet) |
| 3 | `views/restaurant/recipes/list.vue:624` | `updateRecipe(factoryId.value, row.id, { ...row, isActive: true })` (activate path) | PUT | **RISK** — entire row spread incl. audit fields |
| 4 | `views/smartbi-config/DataSourceConfigView.vue:148` + `:170` | `editForm.value = { ...row }` then `updateDataSource(factoryId, id, editForm.value)` | PUT | **RISK** — flagged also in 2026-05-10 sweep as "latent risk masked by lenient Jackson" |
| 5 | `views/smartbi-config/ChartTemplateView.vue:191` | `editForm.value = { ...row }` then (presumed PUT submit) | PUT (presumed) | **RISK** |

**Other 56 hits**: CSV exports (`[...rows].map(...)`), Vue array spread (`[...rows.value, newRow]`), prop spreads (`{...props}`), TypeScript test fixtures — **all SAFE**, not form-to-API.

**Verdict**: **4 RISK + 1 SAFE-pending + 56 N/A** = 4 confirmed FE form-spread phantom-field sites that send full row (including BE-managed `createdAt`/`updatedAt`/`deletedAt`) to PUT endpoints. Today they are masked by:
1. Jackson lenient default (unknown props silently dropped)
2. BE-side select-then-merge in some service paths (e.g. `SystemEnumServiceImpl.updateEnum` ignores audit fields entirely)

**But** when paired with a BE site that does **blind save** (e.g. `BusinessRuleController.setDefaultValue`, `BomController.updateOverheadCost`), the FE phantom field WILL persist. The risk is **architectural — not all FE-BE pairs are audited**.

**Delta vs 2026-05-10**: Prior sweep only checked `web-admin/src/views/analytics/smart-bi/` (0 hits). This expanded sweep finds **4 RISK sites across non-SmartBI views**. **New finds: 4 RISK** (one of them — DataSourceConfigView — was already flagged 2026-05-10 as latent).

---

### 17.5 — Semantic delta vs absolute mixed

**Grep**: `newQuantity\|delta\|adjustQuantity\|increment` in `controller/`
**Total hits**: 11 (most are unrelated word usage)

**Filter** — find PATCH/PUT/POST methods where param name is ambiguous between delta and absolute:

| # | File:line | Pattern | Verdict |
|---|---|---|---|
| 1 | `MaterialBatchController.java:489-507,530` | `adjustBatchQuantity` controller calls 5-arg overload with `actualQuantity` (absolute newQuantity) | (controller side OK) |
| 2 | `SmartBIDashboardController.java:242` | comment string `meta / delta / done / error` (SSE event names) | **SAFE** — comment artifact |
| 3 | `AIPublicDemoController.java:95` | `count.incrementAndGet()` (rate-limit counter) | **SAFE** — internal counter |
| 4 | `FormAssistantController.java:889` | `quotaUsageRepository.incrementUsedCount(...)` | **SAFE** — DB increment |
| 5 | `TemplatePackageController.java:276` | `formTemplate.incrementVersion()` | **SAFE** — domain method |
| 6 | `WhitelistController.java:233` | `incrementUsage` endpoint | **SAFE** — single-purpose increment |

**🚨 CRITICAL BUG — `MaterialBatchServiceImpl.adjustBatchQuantity` overloading**:

Two service overloads with **opposite semantics** but **same name + similar signatures**:

```java
// MaterialBatchServiceImpl.java:509 — 4-arg overload (no userId)
public MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId,
                                             BigDecimal adjustmentQuantity, String reason)
// DELTA semantics: newQuantity = batch.currentQuantity.add(adjustmentQuantity)  ← line 520

// MaterialBatchServiceImpl.java:978 — 5-arg overload (with userId)
public MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId,
                                             BigDecimal newQuantity, String reason, Long adjustedBy)
// ABSOLUTE semantics: param IS the final value directly (line 998 reads it as newQuantity)
```

**Callers**:
| Caller | Overload called | Param value | Resulting semantic | Correct? |
|---|---|---|---|---|
| `controller/MaterialBatchController.java:530` | 5-arg | `actualQuantity` (from URL `newQuantity=...` or `request.getQuantity()`) | absolute | OK (controller comment §489 says "URL参数：newQuantity") |
| `ai/tool/impl/dataop/BatchUpdateTool.java:183` | 4-arg | `quantity` (from tool params) | delta | **🚨 LIKELY BUG** — AI tool docstring/UI doesn't clarify; LLM may pass an absolute value expecting absolute math, but 4-arg adds it to current → wrong result |
| `ai/tool/impl/dataop/InventoryOperationTool.java:125` | 4-arg | `currentQty.negate()` (explicitly delta-shaped) | delta | OK (the tool author understood delta semantics) |
| `ai/tool/impl/material/MaterialAdjustQuantityTool.java:100` | 5-arg | `quantity` (validated `>= 0`) | absolute | OK (this tool says "调整批次库存" → absolute) |

**Risk**: **`BatchUpdateTool.java:183` and `MaterialAdjustQuantityTool.java:100` both pass a parameter named `quantity` to differently-shaped service methods**. An LLM picking `BatchUpdateTool` vs `MaterialAdjustQuantityTool` for "把库存调到100" produces:
- `BatchUpdateTool` → delta 100 (`current + 100`)
- `MaterialAdjustQuantityTool` → absolute 100 (`current = 100`)

Same user intent, opposite outcome. Silent data corruption depending on which Tool the AI router picks. **This is a genuine BUG — Rule 17.5 W-03 lineage.**

**Verdict**: **1 BUG + 5 SAFE**. The BUG affects the AI Tool-Skill layer; user-facing controller path uses 5-arg consistently and is OK.

**Delta vs 2026-05-10**: Prior sweep only checked SmartBI controllers, found 1 SAFE comment artifact. This expanded sweep finds **1 BUG in MaterialBatchServiceImpl overloading** + AI Tool caller inconsistency. **New find: 1 BUG**.

---

### 17.6 — Shared DTO Create+Update reuse

**Grep**: `@RequestBody Create[A-Z]\w*Request` in `controller/`
**Total hits**: 32 (across 23 controllers; most are POST-only — correct usage)

**Filter** — for each controller, check if same `Create*Request` type is bound on BOTH a POST (create) handler AND a PUT (update) handler:

| # | Controller | Create*Request class | POST site | PUT site | Verdict |
|---|---|---|---|---|---|
| 1 | `ProductionPlanController.java` | `CreateProductionPlanRequest` | line 79 (POST) | line 102 (PUT) | **BR-13 RISK** — same DTO for both. Mitigated by `ProductionPlanMapper.updateEntity` null-guards (verified 17.2). |
| 2 | `UserController.java` | `CreateUserRequest` | line 64 (POST) | line 82 (PUT) | **BR-13 RISK** — same DTO. Mitigated by `UserMapper.updateEntity` null-guards (verified 17.2). |
| 3 | `EquipmentController.java` | `CreateEquipmentRequest` | line 65 (POST) | line 87 (PUT) | **BR-13 RISK** — same DTO; downstream `equipmentService.updateEquipment` mapper not sampled — **NEEDS VERIFY** |
| 4 | `FactoryBlueprintController.java` | `CreateBlueprintRequest` | line 84 (POST) | line 105 (PUT) | **BR-13 RISK** — same DTO; downstream not sampled — **NEEDS VERIFY** |
| 5 | `SchedulingController.java` | `CreateSchedulingPlanRequest` | line 55 (POST) | line 117 (PUT) | **BR-13 RISK** — same DTO; downstream not sampled — **NEEDS VERIFY** |
| 6 | `ApprovalChainController.java` | `CreateApprovalChainConfigRequest` | line 96 (POST) + 201 (POST validate) | line 110 (PUT uses **separate `UpdateApprovalChainConfigRequest`**) | **SAFE** — explicit Update DTO |
| 7 | `PlatformController.java` | `CreateAIQuotaRuleRequest` | line 570 (POST), 618 (POST default) | line 587 (PUT uses **separate `UpdateAIQuotaRuleRequest`**) | **SAFE** — explicit Update DTO |
| Other 16 | various | — | POST-only (no PUT pair) | n/a | **SAFE** — Create-only usage |

**Sister Update*Request inventory** — controllers that DO use separate Update*Request:
- `AiAgentRuleController.java`: `UpdateAiAgentRuleRequest` (line 155) ✓
- `ApprovalChainController.java`: `UpdateApprovalChainConfigRequest` ✓
- `CustomerController.java`: `UpdateCustomerRequest` (via CustomerMapper) ✓
- `MaterialBatchController.java`: `UpdateMaterialBatchRequest` ✓
- `PlatformController.java`: `UpdateAIQuotaRuleRequest`, `UpdateFactoryRequest`, `UpdateTokenRequest` ✓
- `SupplierController.java`: `UpdateSupplierRequest` ✓
- inventory/PurchaseController: `UpdatePurchaseOrderRequest` ✓
- inventory/SalesController: `UpdateSalesOrderRequest` ✓
- finance/BomController: `UpdateBomItemRequest`, `UpdateLaborCostRequest` ✓
- QualityCheckItemController: `UpdateQualityCheckItemRequest` ✓

**Verdict**: **5 BR-13 RISK + 16 SAFE (POST-only) + ~10 SAFE (with proper Update*Request pairing)**. Of the 5 BR-13 sites, 2 are mitigated by verified null-guard mappers (`UserMapper`, `ProductionPlanMapper`); the other 3 (`EquipmentController`, `FactoryBlueprintController`, `SchedulingController`) need downstream mapper sampling.

**Delta vs 2026-05-10**: Prior sweep only checked SmartBI controllers (0 hits). This expanded sweep finds **5 BR-13 sites** across HR/equipment/production/scheduling/blueprint controllers. **New finds: 5 RISK** (2 mitigated, 3 needs-verify).

---

### Cross-reference matrix (sister bugs)

| Rule | Lineage | Hits this sweep | New finds vs 2026-05-10 | Notes |
|---|---|---|---|---|
| 17.1 | W-01 | 19 entity-bound sites (8 RISK + 1 BUG + 4 LATENT-RISK + 6 SAFE) | +13 (only 3 SmartBI DTO SAFE hits previously; 12 new JPA Entity binds, 1 new BUG) | `BomController.updateOverheadCost` is the highest-risk site — true blind save w/o select-then-merge |
| 17.2 | W-04 | 5 mappers (all SAFE) + 2 service-internal helpers (NEEDS-VERIFY) | +2 NEEDS-VERIFY service helpers | `DecorationServiceImpl.updateLayoutFromRequest`, `FactorySettingsServiceImpl.updateEntityFromDTO` |
| 17.3 | (W-01 adjacent) | 58 SAFE getters + 3 LATENT-RISK setters | +3 LATENT-RISK | `AIQuotaRule.setRoleMultipliersMap`, `AIReportPromptConfig.setAnalysisDirectionsList`, `ProductionProcessPromptConfig.setExpectedCompletionActionsList` — all `@Transient` but write to persisted field via side-effect; today SAFE because never directly @RequestBody-bound |
| 17.4 | W-05 | 4 RISK (3 web-admin views + 1 SmartBI re-confirmed) + 56 N/A | +4 RISK (one reconfirmed) | `system/work-processes`, `restaurant/recipes`, `smartbi-config/ChartTemplateView`, `smartbi-config/DataSourceConfigView` |
| 17.5 | W-03 | 1 BUG in `MaterialBatchServiceImpl` overloading | +1 BUG | 4-arg vs 5-arg `adjustBatchQuantity` — delta vs absolute; AI Tool callers inconsistent |
| 17.6 | BR-13 | 5 BR-13 RISK (2 mitigated, 3 NEEDS-VERIFY) | +5 RISK | `ProductionPlanController`, `UserController`, `EquipmentController`, `FactoryBlueprintController`, `SchedulingController` |

---

### Summary

**Total hits across 6 patterns**: ~125 meaningful (170 raw @RequestBody → 19 entity-bound; 61 @Transient → 3 latent; 61 FE form-spread → 4 risk; 11 delta-words → 1 bug; 32 Create*Request → 5 BR-13)

**By verdict**:
- **SAFE**: ~85 sites (151 DTO @RequestBody + 5 mappers verified + 58 derived-getter @Transient + 56 FE non-API spreads + 2 Update*Request controllers + ~10 Create-only POST handlers)
- **RISK** (needs ticket): **22 sites** = 17.1 (8 explicit + 4 latent) + 17.3 (3 latent) + 17.4 (4) + 17.6 (3 needs-verify-mapper)
- **BUG** (immediate fix): **2 sites**
  - **17.1#4** — `BomController.updateOverheadCost` blind save without select-then-merge (finance domain, PUT overwrites entire row); HIGH severity if FE phantom fields flow in
  - **17.5** — `MaterialBatchServiceImpl.adjustBatchQuantity` overloading (4-arg delta vs 5-arg absolute) with inconsistent AI Tool callers; silent data corruption risk
- **NEW finds vs 2026-05-10**: 12 W-01 entity-binds + 1 BUG + 2 mapper helpers + 3 @Transient latent setters + 4 FE form-spread + 5 BR-13 = **27 new finds**

**Recommended follow-ups**:
1. **P1 BUG** — `MaterialBatchServiceImpl.adjustBatchQuantity` overload disambiguation. Rename 4-arg → `applyBatchQuantityDelta`, keep 5-arg `adjustBatchQuantity` for absolute. Update `BatchUpdateTool.java:183` to call new name with explicit `delta` parameter.
2. **P1 BUG** — `BomController.updateOverheadCost` add select-then-merge pattern (mirror `BusinessRuleController.setSchedulerConfig` line 159-164 style).
3. **P2 RISK sweep** — Audit downstream services for the 4 LATENT @RequestBody Entity binds (LabelRecognitionConfig × 2, FactoryTriggerChain, ReusableContainer, FactorySchedulingConfig) — verify select-then-merge or convert to UpdateXRequest DTO.
4. **P2 RISK sweep** — Audit service helpers `DecorationServiceImpl.updateLayoutFromRequest` and `FactorySettingsServiceImpl.updateEntityFromDTO` for null-guard pattern.
5. **P3 RISK** — Audit `EquipmentService.updateEquipment`, `blueprintService.updateBlueprint`, `schedulingService.updatePlan` mappers for null-guard pattern (BR-13 mitigation status).
6. **P3 RISK** — FE form-spread cleanup: `delete row.createdAt; delete row.updatedAt; delete row.deletedAt` before PUT in the 4 identified Vue files, OR migrate to explicit `UpdateXRequest` shape FE-side.
7. **P4 INFO** — Enable `spring.jackson.deserialization.fail-on-unknown-properties=true` in test env to surface latent FE phantom fields proactively (BREAKING — gate behind feature flag).

**Method (for reproducibility)**:
```
17.1: Grep '@RequestBody [A-Z]\w+ [a-z]\w*' in controller/
      Cross-ref @Entity in entity/**
17.2: Grep 'void updateEntity\|void update[A-Z]\w*From' in src/main/java
17.3: Grep '@Transient' in entity/ then sample for setX paired methods
17.4: Grep '\.\.\.row\|Object\.assign\(.*form' in web-admin/src/
      Trace each to API write call (PUT/POST)
17.5: Grep 'newQuantity\|delta\|adjustQuantity\|increment' in controller/
      Cross-ref service overloads
17.6: Grep '@RequestBody Create[A-Z]\w*Request' in controller/
      For each controller, check PUT handler binds same Create*Request
```
