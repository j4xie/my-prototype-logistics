# E5 Valuation §5.2 RBAC Decision — Evidence & Implementation

**Date**: 2026-05-12
**Branch**: `qa/e5-valuation-rbac-decision-evidence`
**Endpoint**: `GET /api/mobile/{factoryId}/material-batches/inventory/valuation`
**Source**: chat1 R2 RBAC sweep §5.2 NEEDS_REVIEW (cells C5 `warehouse_mgr` + C5 `operator`)
**Base commit**: `6ea9f1339`

---

## TL;DR

**Recommendation: Option (b) — 403 deny for roles without `procurement:price:view`.**

Add `@RequirePermission({"procurement:price:view"})` to `MaterialBatchController.getInventoryValuation`.

After fix: warehouse_manager / operator → 403; factory_super_admin / procurement_manager / finance_manager / sales_manager / dispatcher / restaurant_manager → 200 with real value (unchanged).

---

## Step A — Endpoint Analysis

### Signature

`MaterialBatchController.java:704-712`:

```java
@GetMapping("/inventory/valuation")
@Operation(summary = "获取库存价值")
public ApiResponse<BigDecimal> getInventoryValuation(
        @Parameter(...) @PathVariable @NotBlank String factoryId) {
    BigDecimal valuation = materialBatchService.getInventoryValuation(factoryId);
    return ApiResponse.success(valuation);
}
```

**Response shape**: `{ "code": 200, "data": <BigDecimal>, ... }` — the `data` IS the price; no wrapping DTO; no field paths.

### Service implementation

`MaterialBatchServiceImpl.java:1217` → `calculateInventoryValue(factoryId)` → `materialBatchRepository.calculateInventoryValue(factoryId)` — single `SUM` aggregate across all batches for the factory.

### Response evidence (current main HEAD)

| Cell | Role | Response | Verdict |
|---|---|---|---|
| C5 | admin (factory_super_admin) | `data: 604476.68` | intended (admin needs full view) |
| C5 | warehouse_mgr | `data: 604476.68` | **LEAK** — same as admin |
| C5 | operator | `data: 604476.68` | **LEAK** — same as admin |

Evidence: `docs/qa-evidence/r2-rbac-sweep-2026-05-12/raw/C5-*.json`.

### Why strip-only cannot protect this endpoint

`PriceFieldResponseAdvice` masks fields annotated with `@PriceSensitive` by walking JSON. A naked `BigDecimal` at `$.data` has no field path to null out — the advice cannot act. **Strip-only was designed for DTOs, not scalar return types.** This is a category mismatch, not a misconfiguration; the chat1 sweep classified C5 as `NEEDS_REVIEW` rather than `FAIL` for exactly this reason.

### UI consumer audit

| Caller | Status |
|---|---|
| web-admin Vue page | **0 callers** (no `inventory/valuation` reference outside `auth.setup` / `capture-guide` Playwright fixtures) |
| RN frontend Screen / Page / Hook | **0 callers** (no Screen invokes `getInventoryValuation`) |
| RN API client method (`materialBatchApiClient.ts:222`) | defined but unused outside test |
| RN unit test (`materialBatchApiClient.test.ts:226`) | mocks `{ totalValue: 50000 }` shape — already drifted from actual server response (naked BigDecimal); status irrelevant to mock semantics |
| Backend tests | **0 references** |
| QA scripts | only `scripts/qa/r2_rbac_sweep.py` (R2 sweep generator) |

→ **No live UI breaks if this endpoint denies non-price-view roles.**

### Precedent: the only other naked-`BigDecimal` endpoint

`EquipmentController.java:338-341`:

```java
@RequirePermission({"equipment:read"})
@GetMapping("/{equipmentId}/depreciated-value")
public ApiResponse<BigDecimal> calculateDepreciatedValue(...)
```

Same return shape (`ApiResponse<BigDecimal>`), already gated with `@RequirePermission` — not stripped. **Established pattern: naked-Decimal financial endpoints get permission-gated.**

### Permission semantics: `procurement:price:view`

Per `PriceViewPermissionTest` (whitelist locked by PR #415 Option B):

| HAS `procurement:price:view` | LACKS |
|---|---|
| factory_super_admin | warehouse_manager |
| procurement_manager | warehouse_worker |
| finance_manager | quality_manager / quality_inspector |
| sales_manager | operator |
| dispatcher | hr_admin |
| restaurant_manager | equipment_admin |
| | viewer |
| | unactivated |

This is the canonical price-visibility gate. `@PriceSensitive` on per-batch `MaterialBatch.totalValue` already strips for warehouse_manager via this same permission. Reusing it as the **access gate** for the aggregate endpoint is internally consistent: if you can't see per-batch prices, you can't see their sum either.

---

## Step B — 3-Option Evaluation

| Option | Mechanism | UX impact | Data risk | Code change | Aligned with existing pattern? |
|---|---|---|---|---|---|
| **(a) Strip-only (current)** | `@PriceSensitive` field annotation | warehouse_mgr sees real `data: 604476.68` | **LEAK** — naked scalar cannot be stripped | 0 lines | ❌ category mismatch — annotation has no field to act on |
| **(b) 403 deny** | `@RequirePermission({"procurement:price:view"})` | warehouse_mgr / operator → 403 with body `{success:false, message:"权限不足，无法访问此资源", ...}` | None — endpoint inaccessible to non-price-view roles | 1 import + 1 annotation | ✅ mirrors `EquipmentController.calculateDepreciatedValue` |
| **(c) Conditional 200 wrapper** | Change return to `Map<String,BigDecimal>` with `@PriceSensitive` on `totalValue` field | warehouse_mgr sees `{"data":{"totalValue":null}}`; admin sees real value | Stripped to null — safe but awkward UX (HTTP 200 + null payload) | 30-60 lines + API contract breakage | ⚠️ inconsistent with `EquipmentController` precedent; more drift surface |

---

## Step C — Recommendation: Option (b)

**Action**: Add `@RequirePermission({"procurement:price:view"})` to `MaterialBatchController.getInventoryValuation` (line 704).

**Why option (b)**:

1. **Strip-only (a) is structurally broken for this endpoint** — naked `BigDecimal` has no field path. Status quo IS the leak chat1 flagged.
2. **Aggregate-equivalence consistency**: per-batch `MaterialBatch.totalValue` is already stripped for non-price-view roles. Allowing the aggregate sum of those values while masking the components is contradictory and easily defeated.
3. **Precedent**: `EquipmentController.calculateDepreciatedValue` is naked-`BigDecimal` + `@RequirePermission` — same shape, same domain (financial scalar), same fix.
4. **Zero UI breakage**: no Screen / Page / Vue page invokes this endpoint today.
5. **Minimal blast radius**: 1-line annotation + 1 import; reuses the already-tested `PriceViewPermissionTest` whitelist semantics.

**Why not option (c)**:

- Breaks API contract (scalar → object) for negligible benefit; status-200-with-null is a worse UX than status-403-with-message anyway.
- Inconsistent with `EquipmentController` precedent.
- Larger surface area for drift over time.

---

## Implementation (this PR)

1. **`MaterialBatchController.java:704`** — add `@RequirePermission({"procurement:price:view"})` above `@GetMapping("/inventory/valuation")`.
2. **`MaterialBatchControllerAnnotationTest.java`** (new) — reflective assertion: the annotation is present on `getInventoryValuation` with value `{"procurement:price:view"}`. Locks the fix against accidental removal.

The `@RequirePermission` AOP infrastructure (interceptor + denial response body) is already tested by other endpoints (e.g. C6/C7/C8 operator-deny evidence) — no new infra needed.

---

## Follow-up risks (NOT in scope of this PR)

Surfaced during analysis; should be tracked separately:

- **`/material-batches/inventory/statistics` (line 691)**: returns `Map<String,Object>` — currently un-gated. The map likely contains aggregate totals that should also be price-view-gated. Worth a focused audit.
- **`/material-batches/inventory/alerts`** and **`/low-stock` (line 745)**: also un-gated read endpoints; warrant a sweep to confirm no price aggregates leak.

These were NOT in chat1's NEEDS_REVIEW scope. File-tickets for next R2 wave.

---

## Acceptance trace

- [x] **Step A** endpoint analysis: signature + service + UI consumer audit documented
- [x] **Step B** 3-option evaluation: data risk, UX, code change, alignment per option
- [x] **Step C** recommendation: option (b) with evidence-based rationale
- [x] Implementation: annotation + reflective unit test (this PR)

---

## Evidence files

- `docs/qa-evidence/r2-rbac-sweep-2026-05-12/raw/C5-admin.json` — admin 200 baseline
- `docs/qa-evidence/r2-rbac-sweep-2026-05-12/raw/C5-warehouse_mgr.json` — pre-fix leak (200 with real value → 403 after fix)
- `docs/qa-evidence/r2-rbac-sweep-2026-05-12/raw/C5-operator.json` — pre-fix leak (200 with real value → 403 after fix)
- `backend/java/cretas-api/src/test/java/com/cretas/aims/security/PriceViewPermissionTest.java` — permission whitelist semantics
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/EquipmentController.java:338-341` — naked-BigDecimal + `@RequirePermission` precedent
