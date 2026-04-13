# Canvas V3 Round 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close R7a drag-reorder data loss P0 + continue R9 Canvas Integration Template to 2 more services + plant first 2 JUnit tests to break the 0/37 test debt.

**Architecture:** 4 items executed as 6 Tasks. Items 1-3 are TDD-style (test → impl → pass). Task 5 handles integration/deploy. Task 6 writes the findings doc.

**Tech Stack:** Spring Boot 3.2.12 + JPA/Hibernate 6 + PostgreSQL + Vue 3 + Element Plus + JUnit 5 + Mockito.

**Spec reference:** `docs/superpowers/specs/2026-04-11-round10-design.md`

---

## Pre-flight Checks (before Task 1)

- [ ] **Step 0.1: Verify main branch + clean working tree**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics"
git branch --show-current
git log --oneline -3
```

Expected: current branch is `main`, HEAD is `38e6b271e` (handoff doc commit from end of previous session).

If on a different branch: `git checkout main && git pull origin main`.

- [ ] **Step 0.2: Verify prod health (baseline)**

Run:
```bash
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -m 10 https://centerapi.cretaceousfuture.com/api/mobile/health
```

Expected: `HTTP 200`. If not, STOP and investigate — don't add changes on top of a broken prod.

- [ ] **Step 0.3: Verify build baseline**

Run:
```bash
export PATH="/c/tools/apache-maven-3.9.6/bin:$PATH"
export JAVA_HOME="/c/Program Files/Zulu/zulu-21"
cd "C:/Users/Steve/my-prototype-logistics/backend/java/cretas-api"
mvn -o compile -DskipTests 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`. If not, fix before starting R10.

---

## Task 1: Item 1 — Backend Reorder Endpoint (TDD)

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/ReorderFieldsRequest.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/FactoryConfigService.java` (add interface method)
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java` (add implementation)
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java` (add REST endpoint)

- [ ] **Step 1.1: Create the DTO**

Create file `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/ReorderFieldsRequest.java`:

```java
package com.cretas.aims.dto.config;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Round 10 Fix — field order request for ConfigController.reorderFields.
 *
 * Carries the new field code order plus the expected rowVersion of the draft
 * FactoryConfiguration for optimistic lock. If the version doesn't match, the
 * endpoint returns 409 and the frontend must reload + retry.
 */
@Data
public class ReorderFieldsRequest {
    @NotEmpty(message = "fieldOrder 不能为空")
    private List<String> fieldOrder;

    @NotNull(message = "expectedVersion 必填 (乐观锁)")
    private Long expectedVersion;
}
```

- [ ] **Step 1.2: Add interface method to FactoryConfigService**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/FactoryConfigService.java`. Find the last method (currently `logWorkflowTransition`). Add this new method signature at the end of the interface:

```java
    /**
     * Round 10 Fix: reorder fields within a module's DRAFT config.
     * Returns {newVersion, reorderedCount}. Throws if DRAFT missing or version mismatch.
     */
    Map<String, Object> reorderFields(String factoryId, String moduleCode,
                                       List<String> fieldOrder, Long expectedVersion,
                                       Long operatorId);
```

Verify the file already imports `java.util.List` and `java.util.Map` — they should be there from existing methods.

- [ ] **Step 1.3: Write failing test for service implementation (TDD red)**

Create file `backend/java/cretas-api/src/test/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImplReorderTest.java`:

```java
package com.cretas.aims.service.config.impl;

import com.cretas.aims.entity.config.FactoryConfiguration;
import com.cretas.aims.entity.config.FactoryModuleConfig;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.ConfigChangeLogRepository;
import com.cretas.aims.repository.config.FactoryConfigurationRepository;
import com.cretas.aims.repository.config.FactoryModuleConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FactoryConfigServiceImplReorderTest {

    @Mock private FactoryConfigurationRepository factoryConfigurationRepository;
    @Mock private FactoryModuleConfigRepository factoryModuleConfigRepository;
    @Mock private ConfigChangeLogRepository configChangeLogRepository;

    @InjectMocks
    private FactoryConfigServiceImpl service;

    private FactoryConfiguration draft;
    private FactoryModuleConfig moduleConfig;

    @BeforeEach
    void setUp() {
        draft = new FactoryConfiguration();
        draft.setFactoryId("F001");
        draft.setConfigVersion(1);
        draft.setStatus("DRAFT");
        draft.setRowVersion(5L);

        moduleConfig = new FactoryModuleConfig();
        moduleConfig.setFactoryId("F001");
        moduleConfig.setModuleCode("sales_order");
        moduleConfig.setConfigVersion(1);

        Map<String, Object> fields = new HashMap<>();
        Map<String, Object> fieldA = new HashMap<>();
        fieldA.put("sortOrder", 10);
        Map<String, Object> fieldB = new HashMap<>();
        fieldB.put("sortOrder", 20);
        fields.put("field_a", fieldA);
        fields.put("field_b", fieldB);
        Map<String, Object> fc = new HashMap<>();
        fc.put("fields", fields);
        moduleConfig.setFieldConfig(fc);
    }

    @Test
    void reorderFields_succeeds_whenVersionMatches() {
        when(factoryConfigurationRepository.findDraft("F001")).thenReturn(Optional.of(draft));
        when(factoryModuleConfigRepository.findByFactoryIdAndModuleCodeAndConfigVersion(
                "F001", "sales_order", 1)).thenReturn(Optional.of(moduleConfig));
        when(factoryModuleConfigRepository.save(any())).thenReturn(moduleConfig);

        Map<String, Object> result = service.reorderFields(
                "F001", "sales_order", List.of("field_b", "field_a"), 5L, 1L);

        assertNotNull(result);
        assertEquals(2, result.get("reorderedCount"));
        verify(factoryModuleConfigRepository).save(any(FactoryModuleConfig.class));
        verify(configChangeLogRepository).save(any());
    }

    @Test
    void reorderFields_throws_whenVersionMismatch() {
        when(factoryConfigurationRepository.findDraft("F001")).thenReturn(Optional.of(draft));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.reorderFields("F001", "sales_order", List.of("field_a"), 99L, 1L));

        assertTrue(ex.getMessage().contains("版本"), "expected version mismatch message");
        verify(factoryModuleConfigRepository, never()).save(any());
    }

    @Test
    void reorderFields_throws_whenNoDraft() {
        when(factoryConfigurationRepository.findDraft("F001")).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.reorderFields("F001", "sales_order", List.of("field_a"), 5L, 1L));

        assertTrue(ex.getMessage().contains("DRAFT"), "expected missing-draft message");
    }
}
```

- [ ] **Step 1.4: Run the test — it should fail (TDD red)**

Run:
```bash
export PATH="/c/tools/apache-maven-3.9.6/bin:$PATH"
export JAVA_HOME="/c/Program Files/Zulu/zulu-21"
cd "C:/Users/Steve/my-prototype-logistics/backend/java/cretas-api"
mvn -o test -Dtest=FactoryConfigServiceImplReorderTest 2>&1 | tail -30
```

Expected: **compilation failure** — `reorderFields` method does not exist on `FactoryConfigServiceImpl`. This confirms we're in the red state (failing test → implement).

- [ ] **Step 1.5: Implement reorderFields in FactoryConfigServiceImpl**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java`. Add this method near the other config mutation methods (after `logWorkflowTransition`, before the final closing brace):

```java
    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> reorderFields(String factoryId, String moduleCode,
                                              List<String> fieldOrder, Long expectedVersion,
                                              Long operatorId) {
        // 1. Find DRAFT
        FactoryConfiguration draft = factoryConfigurationRepository.findDraft(factoryId)
                .orElseThrow(() -> new BusinessException("没有 DRAFT 配置可重排字段 — 请先创建草稿"));

        // 2. Optimistic lock check
        if (draft.getRowVersion() == null || !draft.getRowVersion().equals(expectedVersion)) {
            throw new BusinessException("版本冲突: 当前版本 " + draft.getRowVersion()
                    + ", 请求版本 " + expectedVersion + " — 请刷新后重试");
        }

        int targetVersion = draft.getConfigVersion();

        // 3. Find or create FactoryModuleConfig for this module
        FactoryModuleConfig fmc = factoryModuleConfigRepository
                .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, targetVersion)
                .orElseGet(() -> {
                    FactoryModuleConfig c = new FactoryModuleConfig();
                    c.setFactoryId(factoryId);
                    c.setModuleCode(moduleCode);
                    c.setConfigVersion(targetVersion);
                    c.setEnabled(true);
                    c.setFieldConfig(new HashMap<>());
                    return c;
                });

        // 4. Update sortOrder of each field in fieldConfig.fields by its index in fieldOrder
        Map<String, Object> fieldConfig = fmc.getFieldConfig() != null
                ? fmc.getFieldConfig() : new HashMap<>();
        Map<String, Object> fields = (Map<String, Object>) fieldConfig.computeIfAbsent(
                "fields", k -> new HashMap<String, Object>());

        int reorderedCount = 0;
        for (int i = 0; i < fieldOrder.size(); i++) {
            String fieldCode = fieldOrder.get(i);
            Map<String, Object> fieldEntry = (Map<String, Object>) fields.computeIfAbsent(
                    fieldCode, k -> new HashMap<String, Object>());
            fieldEntry.put("sortOrder", (i + 1) * 10);  // 10, 20, 30... leaves gaps
            reorderedCount++;
        }
        fmc.setFieldConfig(fieldConfig);
        factoryModuleConfigRepository.save(fmc);

        // 5. Audit
        logChange(factoryId, moduleCode, "REORDER_FIELDS", null,
                Map.of("fieldOrder", fieldOrder, "reorderedCount", reorderedCount),
                "字段重排: " + reorderedCount + " 个字段", operatorId);

        Map<String, Object> result = new HashMap<>();
        result.put("newVersion", draft.getRowVersion());
        result.put("reorderedCount", reorderedCount);
        return result;
    }
```

- [ ] **Step 1.6: Run the test — it should pass (TDD green)**

Run:
```bash
mvn -o test -Dtest=FactoryConfigServiceImplReorderTest 2>&1 | tail -20
```

Expected: `Tests run: 3, Failures: 0, Errors: 0, Skipped: 0` → `BUILD SUCCESS`.

If compilation fails, fix the error and re-run. If a test assertion fails, read the assertion message and fix the implementation (NOT the test — the test encodes the acceptance criteria).

- [ ] **Step 1.7: Add the Controller endpoint**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java`. Find `@RestController` class. Add imports at the top (if not already present):

```java
import com.cretas.aims.dto.config.ReorderFieldsRequest;
```

Add this method near the other `@PutMapping`/`@PostMapping` methods (after `importConfig` is a good spot):

```java
    /**
     * Round 10 Fix (R7a drag-reorder silent data loss): immediate field reorder with
     * optimistic lock. Previously the frontend updated sortOrder locally but saveDraft
     * payload didn't include it, so customers lost field ordering on page refresh.
     */
    @PostMapping("/modules/{moduleCode}/reorder-fields")
    @RequireRole({"factory_super_admin", "permission_admin"})
    @Operation(summary = "重排模块字段顺序 (Round 10 Fix)")
    public ApiResponse<Map<String, Object>> reorderFields(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody ReorderFieldsRequest request) {
        Long operatorId = extractUserId(authorization);
        Map<String, Object> result = configService.reorderFields(
                factoryId, moduleCode, request.getFieldOrder(),
                request.getExpectedVersion(), operatorId != null ? operatorId : 0L);
        return ApiResponse.success(result);
    }
```

Verify the `@Valid` annotation import exists — `jakarta.validation.Valid`. If not, add it.

- [ ] **Step 1.8: Full compile check**

Run:
```bash
mvn -o compile -DskipTests 2>&1 | tail -8
```

Expected: `BUILD SUCCESS`. If error, fix and re-run.

- [ ] **Step 1.9: Commit Task 1**

```bash
cd "C:/Users/Steve/my-prototype-logistics"
git add backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/ReorderFieldsRequest.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/FactoryConfigService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImplReorderTest.java
git status --short | head -10
```

**STOP**: Verify `git status --short` output shows ONLY these 5 files in the staging area (`A ` or `M ` prefix). Any other files in staging = scope creep, use `git restore --staged <file>` to unstage them before committing.

Then:
```bash
git commit -m "fix(canvas-v3): R10 Item 1 — dedicated reorder-fields endpoint + optimistic lock

New POST /config/modules/{moduleCode}/reorder-fields endpoint closes the
drag-reorder silent data loss (R7a deferred P0, Scenario 7 from R6 Critic B).

Previously FormCanvas.vue.onReorder updated local sortOrder and called setDirty(),
but saveDraft() in canvas-editor/index.vue:160 only sent {enabled: true} to
saveModuleConfig — the field ordering was never transmitted to the backend.
Customer drag-reordered 20 fields, clicked save, saw green toast, and on page
refresh lost all drag work.

The new endpoint:
- Carries a fieldOrder list + expectedVersion (optimistic lock)
- Rewrites sortOrder for each field in FactoryModuleConfig.fieldConfig.fields
- Returns 409-equivalent BusinessException on version mismatch
- Logs REORDER_FIELDS to config_change_log for audit

TDD: 3 JUnit tests in FactoryConfigServiceImplReorderTest — success path,
version mismatch, missing draft. These are the first JUnit tests in the Canvas V3
service layer and seed the 0/37 test coverage tech debt.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Item 1 — Frontend Drag-Reorder Wiring

**Files:**
- Modify: `web-admin/src/api/canvasApi.ts` (add reorderFields API function)
- Modify: `web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue` (replace onReorder)

- [ ] **Step 2.1: Add the API client function**

Open `web-admin/src/api/canvasApi.ts`. Find the section with other mutation functions (near `submitForReview`). Add:

```typescript
// Round 10 Fix — dedicated reorder endpoint (replaces broken saveDraft-based flow)
export const reorderFields = (
  factoryId: string,
  moduleCode: string,
  fieldOrder: string[],
  expectedVersion: number,
) =>
  request.post<{ newVersion: number; reorderedCount: number }>(
    `/${factoryId}/config/modules/${moduleCode}/reorder-fields`,
    { fieldOrder, expectedVersion },
  )
```

- [ ] **Step 2.2: Rewrite FormCanvas.vue onReorder to call the new API**

Open `web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue`. Find the `onReorder` function (near line 63 based on R9-α subagent trace).

Replace the existing function with a debounced version that calls the new API:

```typescript
import { ElMessage, ElMessageBox } from 'element-plus'
import { reorderFields } from '@/api/canvasApi'
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { factoryId, selectedModule, configVersion, loadVersion } = useCanvasEditor()

// Round 10 Fix — debounced reorder save. Replaces the broken flow where
// onReorder only called setDirty() but saveDraft never sent the field list.
let reorderTimer: ReturnType<typeof setTimeout> | null = null
let reorderInFlight = false

async function onReorder() {
  // Update local sortOrder values for immediate visual feedback
  displayedFields.value.forEach((f, i) => { f.sortOrder = (i + 1) * 10 })

  // Debounce 500ms — if user keeps dragging, reset the timer
  if (reorderTimer) clearTimeout(reorderTimer)
  reorderTimer = setTimeout(async () => {
    if (reorderInFlight) return
    reorderInFlight = true
    try {
      const fieldOrder = displayedFields.value.map(f => f.code)
      const version = configVersion.value?.rowVersion ?? 0
      await reorderFields(factoryId.value, selectedModule.value, fieldOrder, version)
      ElMessage.success({ message: '排序已保存', duration: 1500 })
      // Reload to get the new rowVersion
      await loadVersion()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'unknown'
      if (msg.includes('版本冲突')) {
        try {
          await ElMessageBox.confirm(
            '其他会话已修改此配置,需要刷新后重试。点击确定自动刷新。',
            '版本冲突', { type: 'warning', confirmButtonText: '刷新', cancelButtonText: '取消' },
          )
          await loadVersion()
        } catch { /* user cancelled */ }
      } else {
        ElMessage.error('字段排序保存失败: ' + msg)
      }
    } finally {
      reorderInFlight = false
    }
  }, 500)
}
```

Verify that `displayedFields`, `factoryId`, `selectedModule`, `configVersion`, `loadVersion` are already in scope. If not, the import structure of FormCanvas.vue is different — read lines 1-80 of the file and adjust.

Also verify `configVersion.value` has a `rowVersion` property — check `types/canvas.ts` → `ConfigVersion` interface. If the field is named differently (e.g. `version` instead of `rowVersion`), adjust accordingly.

- [ ] **Step 2.3: Build web-admin to catch typos/type errors**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics/web-admin"
npm run build 2>&1 | tail -15
```

Expected: `✓ built in <N>s`. If TypeScript errors, fix them before committing. Common issue: `configVersion.value.rowVersion` might not exist in the type — check and rename.

- [ ] **Step 2.4: Commit Task 2**

```bash
cd "C:/Users/Steve/my-prototype-logistics"
git add web-admin/src/api/canvasApi.ts \
        web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue
git status --short | head -10
```

**STOP**: verify staging area has only 2 files.

```bash
git commit -m "fix(canvas-v3): R10 Item 1 frontend — debounced reorder API call

Replaces the broken FormCanvas.vue onReorder that only called setDirty()
with a 500ms debounced call to the new POST /reorder-fields endpoint.
On success, reloads version to pick up new rowVersion. On 409 (version
conflict), shows dialog and auto-refreshes. Single-flight lock prevents
rapid drag-drop from overlapping API calls.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Item 2 — MaterialBatchCreatedEvent

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/event/MaterialBatchCreatedEvent.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/MaterialBatchServiceImpl.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/TriggerChainExecutor.java`
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/MaterialBatchServiceImplEventTest.java`

- [ ] **Step 3.1: Create MaterialBatchCreatedEvent class**

Create file `backend/java/cretas-api/src/main/java/com/cretas/aims/event/MaterialBatchCreatedEvent.java`:

```java
package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Round 10 Fix — published by MaterialBatchServiceImpl.createMaterialBatch.
 *
 * Drives TriggerChainExecutor for factory-configured trigger chains on the
 * material_batch module. Covers all batch creation sources (purchase receive,
 * 生产退料, 销售退货, 盘盈入库, 赠品入库, 手工调整) — previously only the
 * purchase-receive path had an upstream MaterialReceivedEvent, so other paths
 * were invisible to trigger chains.
 */
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
        this.factoryId = factoryId;
        this.batchId = batchId;
        this.batchNumber = batchNumber;
        this.materialTypeId = materialTypeId;
        this.receiptQuantity = receiptQuantity;
        this.sourceDocType = sourceDocType;
        this.sourceDocId = sourceDocId;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("MaterialBatchCreatedEvent[factoryId=%s, batchId=%s, batchNumber=%s, qty=%s, sourceDocType=%s]",
                factoryId, batchId, batchNumber, receiptQuantity, sourceDocType);
    }
}
```

- [ ] **Step 3.2: Write failing test for event publication**

Create file `backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/MaterialBatchServiceImplEventTest.java`:

```java
package com.cretas.aims.service.impl;

import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.event.MaterialBatchCreatedEvent;
import com.cretas.aims.mapper.MaterialBatchMapper;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MaterialBatchServiceImplEventTest {

    @Mock private MaterialBatchRepository materialBatchRepository;
    @Mock private RawMaterialTypeRepository materialTypeRepository;
    @Mock private MaterialBatchMapper materialBatchMapper;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private MaterialBatchServiceImpl service;

    private CreateMaterialBatchRequest request;
    private MaterialBatch savedBatch;
    private RawMaterialType materialType;

    @BeforeEach
    void setUp() {
        request = new CreateMaterialBatchRequest();
        request.setMaterialTypeId("mat-1");
        request.setReceiptQuantity(new BigDecimal("100.00"));
        request.setReceiptDate(LocalDate.now());
        request.setSourceDocType("PURCHASE_RECEIVE");
        request.setSourceDocId("po-1");

        materialType = new RawMaterialType();
        materialType.setId("mat-1");

        savedBatch = new MaterialBatch();
        savedBatch.setId(UUID.randomUUID().toString());
        savedBatch.setBatchNumber("MAT-TEST-001");
        savedBatch.setMaterialTypeId("mat-1");
        savedBatch.setReceiptQuantity(new BigDecimal("100.00"));
    }

    @Test
    void createMaterialBatch_publishesEvent_withBatchMetadata() {
        when(materialTypeRepository.findById("mat-1")).thenReturn(Optional.of(materialType));
        when(materialBatchMapper.toEntity(any(), any(), any())).thenReturn(savedBatch);
        when(materialBatchRepository.save(any())).thenReturn(savedBatch);

        service.createMaterialBatch("F001", request, 1L);

        ArgumentCaptor<MaterialBatchCreatedEvent> captor =
                ArgumentCaptor.forClass(MaterialBatchCreatedEvent.class);
        verify(eventPublisher, times(1)).publishEvent(captor.capture());
        MaterialBatchCreatedEvent event = captor.getValue();
        assertEquals("F001", event.getFactoryId());
        assertEquals(savedBatch.getId(), event.getBatchId());
        assertEquals("MAT-TEST-001", event.getBatchNumber());
        assertEquals("PURCHASE_RECEIVE", event.getSourceDocType());
    }
}
```

**Note**: This test may need additional mocks depending on what `createMaterialBatch` calls internally (e.g. `generateUniqueBatchNumber`, `updateMovingAvgPrice`, `futurePlanMatchingService`). If the test fails with NullPointerException on one of those, add `@Mock` for the missing dependency and stub it to return null/empty as appropriate, OR use `lenient()` + `when(...).thenReturn(...)` to satisfy the calls.

- [ ] **Step 3.3: Run the test — should fail (no event publisher yet)**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics/backend/java/cretas-api"
mvn -o test -Dtest=MaterialBatchServiceImplEventTest 2>&1 | tail -20
```

Expected: compile error ("applicationEventPublisher field not found") or assertion failure ("wanted 1 invocation but was 0").

- [ ] **Step 3.4: Inject ApplicationEventPublisher into MaterialBatchServiceImpl**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/MaterialBatchServiceImpl.java`. Find the field declarations section near line 116-134. Add:

```java
    @Autowired(required = false)
    private org.springframework.context.ApplicationEventPublisher applicationEventPublisher;
```

- [ ] **Step 3.5: Add the event publish call in createMaterialBatch**

Still in `MaterialBatchServiceImpl.java`, find `createMaterialBatch` (around line 167). Find the end of the R9 dynamic fields persist block (the one added in commit `5e752ed94`). After that block, before the `updateMovingAvgPrice` call, add:

```java
        // Round 10 Fix (R8-α Gap #1 template 3rd hook): publish event so factory-configured
        // trigger chains on material_batch module can react. Previously only the purchase
        // receive path had MaterialReceivedEvent — other sources (return/gain/manual) were
        // invisible to trigger chains.
        if (applicationEventPublisher != null) {
            try {
                applicationEventPublisher.publishEvent(new com.cretas.aims.event.MaterialBatchCreatedEvent(
                        this, factoryId, batch.getId(), batch.getBatchNumber(),
                        batch.getMaterialTypeId(), batch.getReceiptQuantity(),
                        request.getSourceDocType(), request.getSourceDocId()));
            } catch (Exception e) {
                log.warn("Publish MaterialBatchCreatedEvent failed: {}", e.getMessage());
            }
        }
```

- [ ] **Step 3.6: Add MaterialBatchCreatedEvent to TriggerChainExecutor.HANDLED_EVENTS**

Open `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/TriggerChainExecutor.java`. Find the `HANDLED_EVENTS` Set (around line 38). Add `"MaterialBatchCreatedEvent"` to the set. Example:

```java
    private static final Set<String> HANDLED_EVENTS = Set.of(
            "SalesOrderCreatedEvent",
            "SalesOrderConfirmedEvent", "SalesOrderFinanceApprovedEvent",
            "MaterialReceivedEvent", "BatchCompletedEvent",
            "FinishedGoodsCreatedEvent", "PaymentReceivedEvent",
            "InvoiceIssuedEvent", "SalesOrderSettledEvent",
            "SalesDeliveryCreatedEvent",
            "ProductionAlertEvent",
            "SampleApprovedEvent",
            "SkuComplexityChangedEvent",
            "SopUploadedEvent",
            "RescheduleNeededEvent",
            // Round 10 Fix — R9 MaterialBatch template 3rd hook
            "MaterialBatchCreatedEvent"
    );
```

- [ ] **Step 3.7: Run the test — should pass (green)**

Run:
```bash
mvn -o test -Dtest=MaterialBatchServiceImplEventTest 2>&1 | tail -20
```

Expected: `Tests run: 1, Failures: 0, Errors: 0` → `BUILD SUCCESS`.

If NullPointerException on another dependency, add the missing mock (e.g. `@Mock FuturePlanMatchingService futurePlanMatchingService` and `lenient().when(futurePlanMatchingService.matchBatchToFuturePlans(any())).thenReturn(List.of())`).

- [ ] **Step 3.8: Full compile check**

Run:
```bash
mvn -o compile -DskipTests 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3.9: Commit Task 3**

```bash
cd "C:/Users/Steve/my-prototype-logistics"
git add backend/java/cretas-api/src/main/java/com/cretas/aims/event/MaterialBatchCreatedEvent.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/MaterialBatchServiceImpl.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/engine/TriggerChainExecutor.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/MaterialBatchServiceImplEventTest.java
git status --short | head -10
```

**STOP**: verify 4 files staged.

```bash
git commit -m "fix(canvas-v3): R10 Item 2 — MaterialBatchCreatedEvent (template 3rd hook)

R9 applied Canvas Integration Template hooks 1+2 to MaterialBatchServiceImpl
(validation + customFields persist) but skipped the event because
MaterialReceivedEvent is published upstream by PurchaseServiceImpl and only
for the purchase-receive path. Other sources (生产退料/销售退货/盘盈入库/
赠品入库/手工调整) had no Spring event at all — customer-configured trigger
chains on material_batch module could not fire for those paths.

This commit:
- New MaterialBatchCreatedEvent class with {factoryId, batchId, batchNumber,
  materialTypeId, receiptQuantity, sourceDocType, sourceDocId, createdAt}
- MaterialBatchServiceImpl.createMaterialBatch publishes after dynamic fields save
- TriggerChainExecutor.HANDLED_EVENTS += MaterialBatchCreatedEvent (now 16 events)

TDD: MaterialBatchServiceImplEventTest verifies publishEvent is called with
expected metadata. First unit test in material_batch service layer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Item 3 — QualityInspection customFields Template

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/quality/<RequestDTO>.java` (verify exact name at Step 4.1)
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/QualityInspectionServiceImpl.java` (OR similar path — verify at Step 4.1)
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/QualityInspectionServiceImplCustomFieldsTest.java`

- [ ] **Step 4.1: Locate the actual QualityInspection service and request DTO**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics/backend/java/cretas-api"
find src/main/java -name "QualityInspection*.java" | head -10
grep -l "createInspection" src/main/java/com/cretas/aims/service -r | head -5
```

Record the exact file paths. The spec nominally calls them `CreateQualityInspectionRequest` and `QualityInspectionServiceImpl` but the actual names may differ (e.g. `CreateInspectionRequest`, `QualityInspectionServiceImpl.java` under a `quality` subpackage). Use whatever the grep returns.

**Expected files** (confirm):
- DTO request class file
- Service implementation file

Use these exact paths for the rest of Task 4.

- [ ] **Step 4.2: Verify the service already has validation (R9-α said so)**

Grep for `runConfiguredValidation` or `validationRuleEvaluator.validate` in the service file:

```bash
grep -n "validationRuleEvaluator\|runConfiguredValidation" <service_file_path>
```

Expected: at least 1 match. If not, the R9-α claim is wrong and we need to add validation too — in that case, expand Task 4 to include a 4th hook (the validation hook).

- [ ] **Step 4.3: Add customFields field to the request DTO**

Open the DTO file identified in Step 4.1. Add import:

```java
import java.util.Map;
```

Add this field near the other fields:

```java
    /**
     * Round 10 Fix (R8-α Gap #3 per-module template application): Canvas V3 dynamic
     * field values for quality_inspection. Customer-configured fields like
     * 检测仪器编号, 环境温度, QC 等级, 抽样方法 etc. get persisted via
     * DynamicFieldService.setDynamicFields. Previously dropped silently.
     */
    private Map<String, Object> customFields;
```

If the DTO uses Lombok `@Data`, getter/setter are auto-generated. If not, add them manually.

- [ ] **Step 4.4: Write failing test for customFields persistence**

Create file `backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/QualityInspectionServiceImplCustomFieldsTest.java`:

```java
package com.cretas.aims.service.impl;

// NOTE: adjust imports based on Step 4.1 findings
import com.cretas.aims.engine.DynamicFieldService;
// import CreateInspectionRequest / QualityInspection / Repository / etc. based on actual names

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QualityInspectionServiceImplCustomFieldsTest {

    @Mock private DynamicFieldService dynamicFieldService;
    // add @Mock for whichever repositories + collaborators the actual service depends on

    @InjectMocks
    private QualityInspectionServiceImpl service;

    @Test
    void createInspection_persistsCustomFieldsViaDynamicFieldService() {
        // Arrange
        Map<String, Object> customFields = Map.of(
                "inspector_cert", "QC001",
                "sample_method", "ISO-2859"
        );
        // Build request with customFields, mock repository.save to return inspection with known id
        // (exact stubbing depends on actual service internals — verify at Step 4.1)

        // Act
        // service.createInspection(factoryId, request, userId)

        // Assert: DynamicFieldService was called exactly once with quality_inspection + inspection id + customFields
        verify(dynamicFieldService, times(1)).setDynamicFields(
                eq("F001"), eq("quality_inspection"), any(), eq(customFields));
    }
}
```

**Important**: this test is intentionally skeletal because the actual class names and collaborators aren't known until Step 4.1. At implementation time, flesh out the Arrange section based on what Step 4.1 revealed.

- [ ] **Step 4.5: Run the test — should fail (red)**

Run:
```bash
mvn -o test -Dtest=QualityInspectionServiceImplCustomFieldsTest 2>&1 | tail -20
```

Expected: compile error (field/method not found) or assertion failure (`setDynamicFields` never called).

- [ ] **Step 4.6: Inject DynamicFieldService into QualityInspectionServiceImpl**

In the service file, near the other `@Autowired` fields, add:

```java
    /** Round 10 Fix (R8-α Gap #3 per-module template): Canvas dynamic field persistence. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DynamicFieldService dynamicFieldService;
```

- [ ] **Step 4.7: Add the persist call in createInspection**

Find the `createInspection` method. After the line where `inspection` is saved (look for `.save(inspection)` or similar), add:

```java
        // Round 10 Fix (R8-α Gap #3 template): persist Canvas dynamic fields.
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

Ensure `log` is available (if the class uses `@Slf4j` from Lombok or manual `Logger log = LoggerFactory.getLogger(...)`). If not, use `System.err.println` as a fallback and add a TODO comment.

- [ ] **Step 4.8: Run the test — should pass (green)**

Run:
```bash
mvn -o test -Dtest=QualityInspectionServiceImplCustomFieldsTest 2>&1 | tail -20
```

Expected: `Tests run: 1, Failures: 0, Errors: 0`.

If NullPointerException on collaborators, add missing mocks.

- [ ] **Step 4.9: Full compile check**

Run:
```bash
mvn -o compile -DskipTests 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 4.10: Commit Task 4**

```bash
cd "C:/Users/Steve/my-prototype-logistics"
git add backend/java/cretas-api/src/main/java/com/cretas/aims/dto/quality/ \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/ \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/impl/QualityInspectionServiceImplCustomFieldsTest.java
git status --short | head -10
```

**STOP**: Verify staging area has ONLY QualityInspection-related files (DTO + service + test). The wildcard path patterns above may catch too much — use more specific paths based on Step 4.1 findings.

If the wildcard caught other files (from other sessions), unstage them:
```bash
git restore --staged <path>
```

```bash
git commit -m "fix(canvas-v3): R10 Item 3 — QualityInspection customFields template

Applies R9 Canvas Integration Template persist hook to QualityInspection.
createInspection. Previously R9-α subagent confirmed validation was already
wired but the DTO had no customFields slot — frontend Canvas dynamic field
submissions for inspector_cert, sample_method, environmental_temp, etc.
were silently dropped.

Changes:
- <actual DTO name>.customFields field added
- QualityInspectionServiceImpl injects DynamicFieldService
- After inspection save, call setDynamicFields(factoryId, 'quality_inspection',
  inspection.id, customFields)

Note: QualityInspectionCreatedEvent (5th template hook) deferred to R11 —
current ProductionAlertEvent (added R9) only fires on FAIL, pass path needs
its own event.

TDD: QualityInspectionServiceImplCustomFieldsTest verifies DynamicFieldService
is called exactly once with the submitted customFields map.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Integration — Compile, Deploy, Verify

**Purpose**: Take the 4 committed tasks from a local-only state to a fully deployed and verified prod state.

- [ ] **Step 5.1: Full clean build**

Run:
```bash
export PATH="/c/tools/apache-maven-3.9.6/bin:$PATH"
export JAVA_HOME="/c/Program Files/Zulu/zulu-21"
cd "C:/Users/Steve/my-prototype-logistics/backend/java/cretas-api"
mvn clean package -DskipTests 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`. Note the JAR MD5 from the log.

**Sanity check**: ensure the new classes are in the JAR:
```bash
unzip -l target/cretas-backend-system-1.0.0.jar | grep -E 'MaterialBatchCreatedEvent|ReorderFieldsRequest'
```

Expected: both classes present in `BOOT-INF/classes/com/cretas/aims/...`.

- [ ] **Step 5.2: Run the new JUnit tests to confirm no regression**

Run:
```bash
mvn -o test -Dtest='FactoryConfigServiceImplReorderTest,MaterialBatchServiceImplEventTest,QualityInspectionServiceImplCustomFieldsTest' 2>&1 | tail -20
```

Expected: `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0` (3 from reorder + 1 from material batch + 1 from quality = 5 total).

- [ ] **Step 5.3: Web-admin build**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics/web-admin"
npm run build 2>&1 | tail -10
```

Expected: `✓ built in <N>s`, no TypeScript errors.

- [ ] **Step 5.4: Push to origin/main**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics"
git log --oneline origin/main..HEAD
git push origin main 2>&1 | tail -5
```

Expected: 4 local commits listed (Task 1-4), push reports `<old>..<new>  main -> main`.

- [ ] **Step 5.5: Deploy backend to prod (blue-green)**

Run:
```bash
cd "C:/Users/Steve/my-prototype-logistics"
source ~/.bashrc 2>/dev/null
./scripts/deploy/deploy-backend.sh --env prod
```

Expected runtime: ~5 minutes. Expected output: `✅ Blue-Green 切换完成` and `✓ 生产服务正常 (HTTP 200 via nginx)`.

**If this step takes more than 10 minutes or fails**: check `cretas-backend` and `cretas-backend-green` systemd status via SSH. The blue-green swap may have put one slot in failed state — verify via `systemctl status` and `journalctl -u <service> --since '10 min ago'`.

- [ ] **Step 5.6: Deploy web-admin to prod**

Run:
```bash
./scripts/deploy/deploy-web-admin.sh
```

Expected: `✅ 部署完成` with `HTTP 200 (http://139.196.165.140:8086/)`.

- [ ] **Step 5.7: Smoke test — public health**

Run:
```bash
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -m 10 https://centerapi.cretaceousfuture.com/api/mobile/health
```

Expected: `HTTP 200`.

- [ ] **Step 5.8: Smoke test — reorder endpoint auth**

Run:
```bash
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST \
    https://centerapi.cretaceousfuture.com/api/mobile/F001/config/modules/sales_order/reorder-fields \
    -H 'Content-Type: application/json' \
    -d '{"fieldOrder":["a"],"expectedVersion":1}'
```

Expected: `HTTP 401` (JwtAuthInterceptor rejects unauthorized request — confirms endpoint is wired and auth layer is in place).

If `HTTP 404`: endpoint was not registered. Check `ConfigController.java` — likely missing `@PostMapping` annotation or wrong path.
If `HTTP 500`: check `cretas-prod.log` for stack trace.

- [ ] **Step 5.9: Smoke test — reorder endpoint with valid token**

Run:
```bash
ssh root@47.100.235.168 "TOKEN=\$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
    -H 'Content-Type: application/json' \
    -d '{\"username\":\"factory_admin1\",\"password\":\"123456\"}' \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)[\"data\"][\"token\"])') && \
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST \
    http://localhost:10010/api/mobile/F001/config/modules/sales_order/reorder-fields \
    -H \"Authorization: Bearer \$TOKEN\" \
    -H 'Content-Type: application/json' \
    -d '{\"fieldOrder\":[\"name\"],\"expectedVersion\":999}'"
```

Expected: `HTTP 400` (version mismatch — rowVersion=N will not match 999, BusinessException thrown, Global handler returns 400 with "版本冲突" message). This confirms the endpoint logic is working.

If `HTTP 200`: the version check is broken (or by coincidence rowVersion=999). Fetch current rowVersion via `curl` on `/config/current-version` and re-run with actual value to confirm success path.
If `HTTP 500`: stack trace time — check the log.

---

## Task 6: Findings Doc + Final Commit

**Files:**
- Create: `.claude/agent-team-outputs/2026-04-11_round10-findings.md`

- [ ] **Step 6.1: Write the findings doc**

Create file `.claude/agent-team-outputs/2026-04-11_round10-findings.md`. Content template:

```markdown
# Canvas V3 Round 10 — Findings & Delivery Report

**Date**: 2026-04-11 (same session as R5-R9)
**Mode**: Brainstorming → writing-plans → executing-plans (superpowers skill chain)
**Spec**: `docs/superpowers/specs/2026-04-11-round10-design.md`
**Plan**: `docs/superpowers/plans/2026-04-11-canvas-v3-round10-implementation.md`

## Executive Summary

Round 10 closed 4 items following the brainstormed Option D (risk-first ordering):
1. Drag-reorder silent data loss (R7a deferred P0) — new dedicated endpoint with optimistic lock
2. MaterialBatch Canvas template 3rd hook — new event class + HANDLED_EVENTS entry
3. QualityInspection Canvas template persist hook — DTO slot + DynamicFieldService persist
4. First 2+ JUnit tests in Canvas V3 service layer (breaks 0/37 test coverage debt)

### Metrics delta

| Metric | Before R10 | After R10 |
|---|---|---|
| Service methods FULL template | <fill in> | <fill in> |
| Service methods 2/3 hooks | <fill in> | <fill in> |
| HANDLED_EVENTS count | 15 | 16 |
| JUnit tests in service layer | 0 | 5 |
| factory_tool_configs 执行层 | 3/3 | 3/3 (unchanged) |
| Open P0 from R7a tail | 3 (drag-reorder, optimistic lock, role gates) | 2 (drag-reorder CLOSED) |

### Commits

- `<hash>` R10 Item 1 — dedicated reorder-fields endpoint + optimistic lock
- `<hash>` R10 Item 1 frontend — debounced reorder API call
- `<hash>` R10 Item 2 — MaterialBatchCreatedEvent
- `<hash>` R10 Item 3 — QualityInspection customFields template
- `<hash>` docs — R10 findings

### What went as planned

<fill in during execution>

### What went off plan

<fill in during execution>

### R11 priorities

1. Optimistic lock version header — systematic rollout to saveDraft / setValidationRule / etc (not just reorder)
2. 13 frontend role-gating buttons — `<RoleGate>` component + systematic apply
3. Template apply to WorkReport / Invoice / ProductionPlan 3rd hook
4. Test coverage backfill — at minimum SEC-1, SEC-2, OBS-1 from R5

### Open decisions carried forward

Same 6 decisions from the handoff doc (trigger chain revival, orphan triage, global rules fallback, formula priority, module coverage truth, test backfill priority).
```

Fill in the `<fill in>` placeholders after measuring the actual metrics at doc-write time.

- [ ] **Step 6.2: Commit findings doc**

```bash
cd "C:/Users/Steve/my-prototype-logistics"
git add .claude/agent-team-outputs/2026-04-11_round10-findings.md
git status --short | head -5
```

**STOP**: verify 1 file staged.

```bash
git commit -m "docs(canvas-v3): R10 findings — 4 items delivered, first JUnit tests planted

Captures the R10 session delivery:
- Item 1: drag-reorder dedicated endpoint (closes R7a P0 data loss)
- Item 2: MaterialBatchCreatedEvent (Canvas template 3rd hook, HANDLED_EVENTS 15→16)
- Item 3: QualityInspection customFields template
- Item 4: first 5 JUnit tests in Canvas V3 service layer

R11 priorities documented for continuity.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6.3: Push findings doc**

```bash
git push origin main 2>&1 | tail -5
```

Expected: `<old>..<new>  main -> main`.

---

## Done Criteria (R10 terminal state)

- [ ] All 4 Tasks 1-4 committed as separate commits (5 commits total — Task 1 has backend + frontend split)
- [ ] Task 5 (integration/deploy) complete
- [ ] Task 6 (findings doc) committed and pushed
- [ ] Prod health check returns 200 via public nginx URL
- [ ] 5 JUnit tests pass (`mvn test` on the 3 new test classes)
- [ ] Drag-reorder manual verification: drag fields in web-admin canvas-editor, refresh, see preserved order

## Failure Recovery

If any Task 1-4 fails to compile or test:
1. `git reset --soft HEAD~1` (keeps the changes staged)
2. Fix the issue
3. Re-commit with the same message
4. Continue to next Task

If Task 5 deploy fails:
1. Check blue-green state: `ssh root@47.100.235.168 "systemctl is-active cretas-backend cretas-backend-green"`
2. Note which slot is active (the one that's active is serving traffic — don't touch it)
3. Examine the failed slot's logs
4. Re-run `./scripts/deploy/deploy-backend.sh --env prod` (idempotent)
5. If prod is actually broken (both slots down), `systemctl start cretas-backend-green` from the last known-good JAR backup

Do NOT revert the commits for deployment failures — the code is correct, just needs the JAR to reach prod.

---

## Self-Review (completed before presenting plan)

**1. Spec coverage**: Each of the 4 items in the spec has at least one Task. Item 1 has Tasks 1+2 (backend + frontend). Items 2/3/4 have 1 Task each. Task 5 is integration. Task 6 is findings doc. ✅

**2. Placeholder scan**: One intentional "verify at runtime" — Step 4.1 needs to grep for actual DTO name since R9-α subagent didn't give exact file path. This is guarded by an explicit grep step, not a hidden TBD. ✅

**3. Type consistency**: `reorderFields(factoryId, moduleCode, fieldOrder, expectedVersion, operatorId)` signature matches across interface (Step 1.2), implementation (Step 1.5), and controller (Step 1.7). Event class fields match between event class (3.1), publish call (3.5), and test assertion (3.2). ✅

**4. TDD discipline**: Items 1-3 follow red→green. Item 4 (QualityInspection) also TDD but with a runtime discovery step (Step 4.1) because exact file paths weren't in scope during brainstorming. ✅
