# R7 Issue 1 — `setDynamicFields` Caller Audit

**日期**: 2026-04-15
**前置**: R5 ADR `tests/canvas-security-e2e/EVIDENCE.md §14` recommended Option B (throw BusinessException on unknown fieldCode) but explicitly listed "8-caller audit" as a prerequisite before implementation.
**目的**: Audit all 8 callers of `DynamicFieldService.setDynamicFields(...)` to determine if Option B can ship immediately or needs feature flag + grace period.

---

## 0. Bottom line

**All 8 callers pass USER_INPUT from request body. Zero callers are SAFE.**

**Conclusion**: Option B **CANNOT** ship as a simple swap. Every customer-facing CRUD endpoint that uses dynamic fields would immediately start 400-ing on any stale-fieldCode case. Must ship with:
- Feature flag `canvas.dynamic-fields.strict-validation=false` (default)
- 2-week grace period with flag off
- Metric: count of would-have-thrown cases (log-only while flag off)
- Flip to `true` ONLY after grace period shows ~0 ambient hits

---

## 1. Caller audit table

| # | Caller | Call site (file:line) | Source of `fields` | Category | Risk if Option B ships without flag |
|---|---|---|---|---|---|
| 1 | `DynamicFieldController.setCustomFields` | `controller/DynamicFieldController.java:304` | `@RequestBody Map<String,Object> fields` directly | **USER_INPUT** | HIGH — user typo → HTTP 400 |
| 2 | `MaterialBatchServiceImpl.createMaterialBatch` | `service/impl/MaterialBatchServiceImpl.java:216` | `request.getCustomFields()` from `CreateMaterialBatchRequest` DTO (@RequestBody) | **USER_INPUT** | HIGH |
| 3 | `ProductionPlanServiceImpl.createProductionPlan` | `service/impl/ProductionPlanServiceImpl.java:221` | `request.getCustomFields()` from `CreateProductionPlanRequest` DTO | **USER_INPUT** | HIGH |
| 4 | `QualityInspectionServiceImpl.createInspection` | `service/impl/QualityInspectionServiceImpl.java:126` | `inspection.getCustomFields()` from `QualityInspection` entity (deserialized from @RequestBody) | **USER_INPUT** | HIGH |
| 5 | `SalesServiceImpl.createSalesOrder` | `service/inventory/impl/SalesServiceImpl.java:192` | `request.getCustomFields()` from `CreateSalesOrderRequest` DTO | **USER_INPUT** | HIGH |
| 6 | `SalesServiceImpl.updateSalesOrder` | `service/inventory/impl/SalesServiceImpl.java:434` | `request.getCustomFields()` from `UpdateSalesOrderRequest` DTO | **USER_INPUT** | HIGH |
| 7 | `PurchaseServiceImpl.recordReceive` | `service/inventory/impl/PurchaseServiceImpl.java:402` | `request.getCustomFields()` from receive DTO | **USER_INPUT** | HIGH |
| 8a | `ReturnOrderServiceImpl.createReturnOrder` | `service/inventory/impl/ReturnOrderServiceImpl.java:127` | `request.getCustomFields()` from `CreateReturnOrderRequest` DTO | **USER_INPUT** | HIGH |
| 8b | `TransferServiceImpl.createTransfer` | `service/inventory/impl/TransferServiceImpl.java:134` | `request.getCustomFields()` from `CreateTransferRequest` DTO | **USER_INPUT** | HIGH |

**Summary**:
- USER_INPUT: **9/9** (Sales has 2 call sites, Caller #8 actually 8a+8b → 9 total sites across 8 service classes)
- SAFE: 0
- MIXED: 0
- UNCLEAR: 0

---

## 2. Why silent-skip was likely intentional

Reading the current code pattern + the fact that there's **no upstream validation** on `customFields` DTO maps anywhere in the backend, it looks like the original design intent was:

- Canvas V3 allows customers to add/remove dynamic fields **live**
- Frontend form model caches fieldCode set per session
- If customer deletes a field, users with open browser tabs still have stale fieldCode in their form state
- Silent-skip = graceful degradation: user clicks "save", backend writes what it can, ignores what it doesn't recognize
- User sees success, stale field just doesn't persist (next form load has fresh schema)

This is **implicit graceful-degradation-by-design**, not a forgotten detail. Option B reverses this design decision — worth checking with product before shipping.

---

## 3. Attack vector vs. typo vector

Original R3 concern was "silent rollback hides a P0" (setCustomFields @Transactional). That bug is **unrelated** to Option B — that's about transaction boundaries, already fixed in R3+R5.

Option B is about "silent IGNORE of unknown fieldCodes" — a different concern:

| Concern | Example | Option B catches? | Current behavior |
|---|---|---|---|
| User typo in frontend | `customer_levl: "VIP"` | ✅ yes | silently dropped, no feedback |
| Stale browser cache after field delete | field deleted 5 min ago, old tab still has key | ✅ yes, but **false positive** | silently dropped, graceful |
| Malicious injection of unknown keys | F006 user sends `admin_override: true` | ❌ no — attacker gets 400, tries different key | silently dropped = effectively rejected already |
| Schema migration race | deploy changes field codes, old clients still using old codes | ✅ yes, but disruption during deploy | silently dropped, graceful |

Option B's value is mainly about catching **user typos** which are the minority case. It breaks **stale cache** and **migration race** which are the majority case.

---

## 4. Revised recommendation

**Status change**: R5 ADR's recommendation (Option B preferred) was overly optimistic. This audit shows Option B has **significant UX downside** for the majority case.

**3 paths forward** (pick based on product priority):

### Path A: Ship Option B with feature flag + grace period
- Add `canvas.dynamic-fields.strict-validation=false` config
- When `true`, throw BusinessException
- When `false`, keep current silent-skip but **log WARN with caller context** for observability
- 2-week grace with flag off, collect WARN count per caller
- Flip to `true` after count ≈ 0 per day
- **Pros**: catches typos eventually, non-breaking intermediate state
- **Cons**: 2-week delay in feedback, still breaks stale cache when flipped

### Path B: Ship a non-blocking observability layer
- Add the same WARN logging (flag `false` behavior above)
- **Never flip to throw**
- Instead: write a frontend analytics event when unknown fieldCode is sent, track in UX analytics
- **Pros**: zero breakage, full observability, problem framing becomes "reduce typos via frontend UX"
- **Cons**: doesn't fail loud for legitimate typos; relies on external tracking

### Path C: Redesign — reject at schema-bound DTO level
- Add custom `@Validated` on each DTO's `customFields` map
- Validator queries current factory's active field set, rejects unknown keys
- Errors are HTTP 400 with clear per-field diagnostics
- **Pros**: most correct, fail-loud at right layer (before service), detailed errors
- **Cons**: biggest code change — 9 DTOs to annotate, validator implementation, per-request factory context injection

### Recommended: **Path B for R7 + Path C as R8**

- R7 ships observability WITHOUT breaking anything (Path B)
- Accumulate real data for 2-4 weeks on how often unknown fieldCodes actually appear
- If data shows typos are significant portion → schedule Path C as dedicated round
- If data shows almost all are legitimate stale-cache → accept silent-skip as correct design, close Issue 1

---

## 5. Action items based on findings

1. **Update Issue 1 body** before user creates it — current draft recommends Option B directly. Should be updated to Path B (observability first, decision later).

2. **NO code change this session** — audit concluded we shouldn't ship Option B as designed.

3. **Commit this audit doc** to git for record.

4. **Ask user** which path (A/B/C) aligns with product priorities. This is PM-level decision.

---

**Status**: Audit complete. Ball in user's court for direction decision.
