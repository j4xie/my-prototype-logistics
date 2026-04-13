# Canvas V3 R22 — Fix + Expand (75% → 80%) Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 1 HIGH + 4 MEDIUM bugs found by deep audit, then expand Canvas coverage to 3 more modules + 5 more backend services.

**Architecture:** Bug fixes in CanvasDynamicFields.vue + 4 module list pages. Expansion adds CanvasAwareWrapper + CanvasDynamicFields to warehouse/scheduling/restaurant pages, and injects DynamicFieldService into 5 backend services.

**Tech Stack:** Vue 3 + Element Plus (frontend), Java 21 + Spring Boot 3.2 (backend)

---

## Context

R10-R21 pushed Canvas V3 execution fidelity from 27% to ~75% across 11 rounds. A 3-agent deep audit (backend + frontend + prod) identified:

- **1 HIGH bug**: computedWhen watcher infinite loop risk in CanvasDynamicFields.vue
- **4 MEDIUM bugs**: All 4 module list pages (sales/procurement/production/quality) reset form without `customFields: {}` — loses custom field values on dialog reopen
- **1 MEDIUM risk**: CanvasAwareWrapper doesn't handle `DUAL` rendering mode (config store does)
- **5 services** lack DynamicFieldService injection

## Phase 1: Bug Fixes (P1)

### P1-1: computedWhen infinite loop fix (B1 — HIGH)

**File:** `web-admin/src/components/canvas/CanvasDynamicFields.vue`

**Problem:** The `watch(localValues, ...)` with `{ deep: true }` directly mutates `localValues.value[field.fieldCode] = result` inside the watcher body. Vue 3's reactivity system re-triggers the watcher when the watched object mutates, creating at minimum a double-trigger per keystroke, and potentially an infinite loop if two computed fields reference each other.

**Fix:** Add an `isComputing` boolean guard. Accumulate all computed changes into a temp object, then batch-assign after the loop completes only if the guard is not already active.

```typescript
let isComputing = false
watch(localValues, () => {
  if (isComputing) return
  isComputing = true
  try {
    let changed = false
    for (const field of computedFields.value) {
      if (!field.computedWhen) continue
      try {
        const result = evaluateSpelValue(field.computedWhen, localValues.value)
        if (result !== undefined && result !== localValues.value[field.fieldCode]) {
          localValues.value[field.fieldCode] = result
          changed = true
        }
      } catch { /* expression may reference fields not yet filled */ }
    }
    if (changed) emit('update:modelValue', { ...localValues.value })
  } finally {
    nextTick(() => { isComputing = false })
  }
}, { deep: true })
```

The `nextTick` ensures the guard stays active through Vue's synchronous flush, then releases for the next user-initiated change.

### P1-2: customFields form reset fix (B3-B6 — MEDIUM ×4)

**Files:**
- `web-admin/src/views/sales/orders/list.vue` — `openCreateDialog()` + `handleEdit()`
- `web-admin/src/views/procurement/orders/list.vue` — `resetForm()`
- `web-admin/src/views/production/plans/list.vue` — `handleCreate()` + `handleAiFill()`
- `web-admin/src/views/quality/inspections/list.vue` — `handleCreate()`

**Problem:** Each reset path sets `form.value = { ... }` without including `customFields: {}`. The property becomes `undefined`, causing CanvasDynamicFields to treat it as empty and re-fetch defaults (overwriting any edited values).

**Fix:** Add `customFields: {} as Record<string, unknown>` to every form reset object literal in all 4 files. Mechanical find-and-fix — no logic change.

### P1-3: DUAL mode consistency (R2 — MEDIUM)

**File:** `web-admin/src/components/canvas/CanvasAwareWrapper.vue`

**Problem:** `useCanvas` computed checks `CANVAS || DYNAMIC` but the config store's `isDynamicRenderingEnabled` also includes `DUAL`. A module configured with `DUAL` mode would be reported as dynamic-enabled by the store but rendered as legacy by the wrapper.

**Fix:** Add `|| renderingMode.value === 'DUAL'` to the `useCanvas` computed.

## Phase 2: Expansion (P2)

### P2-1: 3 more modules with CanvasAwareWrapper + CanvasDynamicFields

Identify the list/create pages for:
- **warehouse / inventory** — material batches list or inventory page
- **scheduling** — scheduling list page (if exists as standalone)
- **restaurant** — restaurant operations page (if exists as standalone)

For each: import CanvasAwareWrapper + CanvasDynamicFields, wrap template, add `customFields` to form ref.

### P2-2: 5 backend services — DynamicFieldService injection

Inject `@Autowired(required=false) DynamicFieldService` into:
- ShipmentRecordService
- InvoiceServiceImpl
- PaymentRecordServiceImpl
- ProcessWorkReportingServiceImpl
- BomServiceImpl

Injection only — no `setDynamicFields()` calls added (these services' DTOs/entities don't have customFields fields yet). This is scaffolding for when those modules get Canvas dynamic field definitions.

## Deferred (out of scope)

- R3: finance_manager sidebar bypass — low-frequency role
- R4: DefaultValueResolver dead injection — keep as scaffolding
- R6: BomUpdatedEvent — needs event design
- R7: Transfer target factory trigger chain — needs event architecture change

## Success Criteria

1. B1: computedWhen watcher does NOT re-trigger itself (verifiable by console.log count)
2. B3-B6: Dialog close → reopen cycle preserves `customFields: {}`
3. R2: `DUAL` mode factories see DynamicModulePage
4. 7+ modules have CanvasAwareWrapper (currently 4)
5. 17+ services have DynamicFieldService (currently 12)
6. `mvn test` passes, `npm run build` passes
7. Deploy to prod succeeds
8. Canvas V3 execution fidelity: ~80%
