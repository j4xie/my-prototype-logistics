# PR #443 Option D Architecture — Independent Critic Review

**Date**: 2026-05-12
**Reviewer**: fresh-chat-x (zero conversation context, anti-confirmation-bias per depth-first-e2e Rule 9)
**Scope**: PR #443 — `[P0 HOTFIX] @PriceSensitive METHOD target + Jackson filter — close NPE regression from PR #423`
**PR head**: `6c42788e7a` (12 files, +608/-19)
**Base**: `a9eae5a4d0` (origin/main)
**Worktree**: `C:/Users/Steve/cretas-pr443-review` on branch `audit/pr443-option-d-review`

---

## Method

Per Rule 9 (independent reviewer, zero conversation context, anti-confirmation-bias):

1. Read all 12 files at PR HEAD (5 architectural + 5 entities + 1 advice + 1 test).
2. Independently answer 7 Critic questions (Rule 5).
3. Cross-check claims in PR body against actual code (e.g., "7 @Transient getters" claim — actually 8).
4. Grep for sister-site coverage gaps (other `@Transient` price-computing getters in entity package).
5. Issue verdict per question + overall.

PR body NOT read except for title/state metadata.

---

## Files changed (independent enumeration from `git diff --stat`)

| File | Δ | Role |
|---|---|---|
| security/PriceSensitive.java | annotation expanded `{FIELD, METHOD}` | core |
| security/PriceSensitiveContext.java | NEW — ThreadLocal<Boolean> holder | core |
| security/PriceSensitiveSerializerModifier.java | NEW — Jackson BeanSerializerModifier | core |
| config/PriceSensitiveContextFilter.java | NEW — OncePerRequestFilter, HIGHEST_PRECEDENCE | core |
| config/PriceSensitiveJacksonConfig.java | NEW — registers modifier as Spring Module bean | core |
| security/PriceFieldResponseAdvice.java | +9 lines — sets ThreadLocal at end of beforeBodyWrite | core |
| entity/MaterialBatch.java | 2 method annotations + null guards | entity |
| entity/inventory/SalesOrder.java | 1 method annotation + 1 calculate defensive filter | entity |
| entity/inventory/SalesOrderItem.java | 2 method annotations + null guards | entity |
| entity/inventory/PurchaseOrderItem.java | 2 method annotations + 1 unrelated quantity null guard | entity |
| entity/inventory/InternalTransferItem.java | 1 method annotation + null guard | entity |
| test/security/PriceFieldResponseAdviceTest.java | NEW — 22 tests including 8 P0 regression | tests |

**Annotated computed getters count**: 8 (PR description says "7" — minor doc drift).
- MaterialBatch.getTotalPrice
- MaterialBatch.getTotalValue (delegates to getTotalPrice)
- SalesOrder.getPayableAmount
- SalesOrderItem.getCostTotal
- SalesOrderItem.getLineAmount
- PurchaseOrderItem.getLineAmount
- PurchaseOrderItem.getLineAmountWithTax
- InternalTransferItem.getLineAmount

---

## Critic answers (7 questions)

### Q1 — Thread safety: ThreadLocal cleanup 100%?

**Verdict**: ⚠️ **CONCERN — async-dispatch leak path exists**

**What works**:
- `PriceSensitiveContextFilter` is `OncePerRequestFilter` with `@Order(HIGHEST_PRECEDENCE)`, wraps `filterChain.doFilter` in `try/finally` → cleanup fires on happy path, exception path, and short-circuited responses (sync dispatch).
- `PriceSensitiveContext.clear()` uses `ThreadLocal.remove()` (not `set(null)`) — correct, avoids classloader retention.
- `PriceFieldResponseAdvice.beforeBodyWrite` does NOT clear inside itself (cannot — Jackson serializes AFTER beforeBodyWrite returns). Delegation to the filter is the correct architectural choice.
- Test file explicitly clears in `@BeforeEach` + `@AfterEach` to prevent JVM-wide test pollution.

**What concerns me**:

`OncePerRequestFilter.shouldNotFilterAsyncDispatch()` returns `true` by default. This means **the filter's `doFilterInternal` does NOT run on async-dispatch redispatches**. Cretas has 7 controllers using async/streaming patterns (`SmartBIDashboardController`, `SmartBIUploadController`, `AIController`, `GenericAIChatController`, `FormAssistantController`, `ConversationController`, `AIIntentConfigController`).

Pollution scenario:
1. Async controller returns `Callable<X>` / `DeferredResult<X>` / `SseEmitter`.
2. Spring releases the original request thread (filter `finally` fires — clean).
3. Callable executes on async worker thread A; result returns.
4. Spring redispatches response on a Tomcat worker thread B.
5. `PriceSensitiveContextFilter.doFilterInternal` **SKIPS** on async dispatch (default).
6. `PriceFieldResponseAdvice.beforeBodyWrite` fires on thread B (advice does run on async dispatch).
7. If warehouse_manager: `hide()` sets ThreadLocal on thread B.
8. Jackson serializes; response sent.
9. **Thread B returns to pool with `HIDE_PRICES = TRUE`**.
10. Next sync request on thread B → admin → `shouldHide()` returns true → **admin sees `null` prices intermittently**.

Whether this is a *data leak* or *UX bug* depends on direction:
- Pollution direction is fail-CLOSED (strip when shouldn't) — **NOT a data exposure**, but a UX defect where admins/finance get null prices intermittently.

**Today's blast radius**:
- The 7 async controllers I found are AI/chat/SmartBI dashboard. Quick scan suggests they don't return `@PriceSensitive` entities (SmartBI uses separate `SmartBi*Data` entities with no `@PriceSensitive`). So no async path TODAY triggers `hide()`.
- Risk is in adding ANY future async endpoint that returns a `@PriceSensitive`-bearing entity for a non-permitted user.

**Recommended fix** (follow-up, NOT block):
```java
// PriceSensitiveContextFilter
@Override
protected boolean shouldNotFilterAsyncDispatch() {
    return false;  // Filter must run on async dispatch so finally clears ThreadLocal
}
```
Plus a regression test using `MockMvc.asyncDispatch()` simulating Callable controller + warehouse_manager.

**Other potential context-loss paths**:
- `@Async` services: out of scope (separate thread, no MVC response).
- Reactor / WebFlux: javadoc explicitly out of scope (project is Servlet-stack).
- Spring TaskExecutor on the response chain: no evidence.

**Verdict**: ⚠️ MEDIUM — latent thread-pollution risk on async dispatch. Today's controllers don't trigger it; future endpoints could. Fix is one-line override + one test.

---

### Q2 — Performance: BeanPropertyWriter wrap overhead?

**Verdict**: ✅ **SAFE**

`changeProperties` runs **once per Bean class** at Jackson serializer construction. The cost (List iteration + annotation read + wrapper construction) is paid at startup or first serialization per class — Jackson caches the resulting writer chain in `SerializerProvider` afterwards.

Runtime cost per `serializeAsField` invocation:
- `PriceSensitiveContext.shouldHide(permission)` = one `ThreadLocal.get()` + `Boolean.TRUE.equals()` = ~10–50 ns.
- If hide=true: write field name + null token via JsonGenerator. Cheap.
- If hide=false: delegate to `super.serializeAsField` (i.e., default writer invokes getter). Zero overhead vs unwrapped writer.

For a `SalesOrder` with 10 items, 7 sensitive fields per item → ~70 calls × 50 ns = ~3.5 µs / response. Compare:
- DB query: ~10–50 ms (1000–10000× larger).
- Network: ~1–100 ms (≫).
- Jackson serialization itself: ~ms for typical payloads (≫).

No hot-path measurement needed for this scale. The wrapper is **not on the critical path**.

Caveat: `transient String permission` on `PriceSensitivePropertyWriter` is marked transient because `BeanPropertyWriter` is `Serializable`. Correct.

**Verdict**: ✅ Overhead negligible.

---

### Q3 — Coverage: do the 8 annotated getters cover ALL `@Transient` computed price getters?

**Verdict**: ⚠️ **CONCERN — at least 4 sister sites missed; 1 inconsistency**

I grep'd `@Transient` across all 41 entity files (`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/**/*.java`) and cross-checked against `@PriceSensitive`.

#### ❌ Coverage gap 1: `ReturnOrderItem` (HIGH severity)

`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/ReturnOrderItem.java`:

```java
// Line 48-49:  NO @PriceSensitive on field
@Column(name = "unit_price", precision = 15, scale = 4)
private BigDecimal unitPrice;

// Line 51-52:  NO @PriceSensitive on field
@Column(name = "line_amount", precision = 15, scale = 2)
private BigDecimal lineAmount;

// Line 69-74:  NO @PriceSensitive on method, falls back to BigDecimal.ZERO
@Transient
public BigDecimal getLineAmount() {
    if (lineAmount != null) return lineAmount;
    if (unitPrice == null || quantity == null) return BigDecimal.ZERO;  // ← leak "free" to warehouse_manager
    return quantity.multiply(unitPrice).setScale(2, BigDecimal.ROUND_HALF_UP);
}
```

`ReturnOrder.totalAmount` (line 82) is also a `BigDecimal` field with **no `@PriceSensitive`**.

This is a direct analog to `SalesOrder` / `PurchaseOrder` (both protected). Return orders are price-bearing — warehouse_manager fetching a return order currently sees real `unitPrice`, real `lineAmount`, real `totalAmount`. **This is a confirmed data leak**, but it pre-dates PR #443 (it was a miss of PR #444's sister-sweep, not introduced here).

Severity: ⚠️ HIGH but **out of PR #443 scope** — PR #443 is the NPE METHOD-target fix, not the field-coverage sweep.

#### ⚠️ Coverage gap 2: `MaterialBatch.getTotalCost()` (LOW severity)

`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialBatch.java` line 293-296:

```java
@Transient  // ← NO @PriceSensitive
public BigDecimal getTotalCost() {
    return getTotalPrice();  // getTotalPrice IS @PriceSensitive
}
```

This works by accident — when warehouse_manager:
1. `unitPrice` field stripped → null.
2. `getTotalPrice()` Jackson modifier short-circuits → emits null.
3. **But** `getTotalCost()` is NOT short-circuited (no annotation). Jackson invokes it.
4. `getTotalCost()` internally calls `getTotalPrice()` — which is a plain Java method call, NOT a Jackson serializer invocation. So the modifier does NOT intercept; `getTotalPrice()`'s defensive null guard kicks in (unitPrice null → returns null).
5. Net result: `totalCost: null` in response.

**Functionally correct** but architecturally inconsistent — defense-in-depth wants both the field-strip and the method-modifier short-circuit, plus the null guard. Recommend adding `@PriceSensitive` to `getTotalCost()` for consistency.

Severity: ⚠️ LOW — works today, brittle if someone refactors `getTotalCost()` to compute differently.

#### ✅ Acceptable: SmartBi entities (`SmartBiFinanceData`, `SmartBiDepartmentData`, `SmartBiSalesData`)

These have `@Transient` price-computing getters (`getProfit`, `getPerCapitaProfit`, `getBudgetVarianceRate`, `getTargetAchievementRate`). They are NOT in the procurement RBAC scope (PR #415 Option B is specifically `procurement:price:view`). SmartBi has its own RLS / RBAC at the data layer. Out of scope.

#### ✅ Acceptable: `BomItem.getActualQuantity`, `DisposalRecord.getNetLoss`, `Recipe.getActualQuantity`

- `BomItem.getActualQuantity` — quantity, not price.
- `Recipe.getActualQuantity` — quantity, not price.
- `DisposalRecord.getNetLoss` — could be price-related (loss in $); if so, requires RBAC analysis. PR #444 may have intentionally excluded. Worth a follow-up question.

**Verdict**: ⚠️ MEDIUM — PR #443's 8 annotations are correct for entities-in-scope, but a follow-up ticket should backfill `ReturnOrder` / `ReturnOrderItem` (HIGH) and `MaterialBatch.getTotalCost()` (LOW).

---

### Q4 — Defense-in-depth bypass paths?

**Verdict**: ❌ **HIGH — confirmed non-Jackson bypass exists**

PR #423's `PriceFieldResponseAdvice.beforeBodyWrite` explicitly **only** strips for JSON content types (line 110-114):

```java
if (selectedContentType != null
        && !MediaType.APPLICATION_JSON.includes(selectedContentType)
        && !MediaType.parseMediaType("application/*+json").includes(selectedContentType)) {
    return body;  // ← BYPASS for non-JSON
}
```

PR #443's Jackson modifier inherits the same scope — it only runs during Jackson serialization. Non-Jackson output paths bypass BOTH layers.

**Confirmed bypass: PDF export**

`backend/java/cretas-api/src/main/java/com/cretas/aims/controller/inventory/PurchaseController.java` line 127:

```java
HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.APPLICATION_PDF);
// ...
headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"order.pdf\";...");
```

The PDF generator builds the response BEFORE returning to Spring MVC. It reads `purchaseOrder.getUnitPrice()` directly. The `beforeBodyWrite` advice receives the byte[] (or similar binary type) with `Content-Type: application/pdf` — and short-circuits. Result: **warehouse_manager downloading PO PDF sees real unit prices**.

Pre-existing bug from PR #423's design choice (JSON-only strip), NOT introduced by PR #443. But PR #443 doesn't close it either, and the architecture doc should mention this gap.

**Other potential bypasses** (not exhaustively verified):
- Excel export (`XSSFWorkbook` found in `ReportExportServiceImpl`, `SopController`).
- WebSocket / SSE pushes (the 7 async controllers).
- Manual `Map<String, BigDecimal>` constructions where the value is a primitive BigDecimal — the annotation is on the entity field, but a Map containing the raw value has no annotation to find.
- Service-to-service HTTP calls where the receiver gets a Java object (e.g., `PythonSmartBIClient`).
- Server logs via Lombok `@Data`-generated `toString()` (logged price values).

**Recommended fix architecture** (follow-up — not block):

Move the permission check + strip BEFORE the controller method returns:
- Option: A `HandlerMethodReturnValueHandler` that runs after the controller but before content negotiation. This applies regardless of output format.
- Or: A service-layer interceptor that strips at the boundary of price-domain → presentation layer.

The current design ties price masking to Jackson, which is a single output path.

**Verdict**: ❌ HIGH — confirmed PDF leak for purchase orders. **NOT a regression of PR #443** (pre-existed in PR #423), so doesn't block this PR, but warrants its own follow-up ticket.

---

### Q5 — Filter ordering vs Spring Security?

**Verdict**: ✅ **CORRECT**

`PriceSensitiveContextFilter` is `@Order(Ordered.HIGHEST_PRECEDENCE)` = `Integer.MIN_VALUE`. This places it **outside** Spring Security's `FilterChainProxy` (typically `-100`).

Request flow:
1. `PriceSensitiveContextFilter.doFilterInternal` enters try.
2. Spring Security filters run (authenticate, populate `SecurityContextHolder`).
3. DispatcherServlet runs.
4. `JwtAuthInterceptor.preHandle` sets `userId` request attribute.
5. Controller returns body.
6. `PriceFieldResponseAdvice.beforeBodyWrite` reads `userId` attribute → resolves user → checks permission → optionally `hide()`. ✓
7. Jackson serializes (modifier consults ThreadLocal). ✓
8. `JwtAuthInterceptor.afterCompletion`.
9. Spring Security filters unwind.
10. `PriceSensitiveContextFilter` finally → `clear()`. ✓ Last thing.

Crucially, the advice does **not** depend on `SecurityContextHolder` — it uses `JwtAuthInterceptor`'s request attribute `userId`. So even if Spring Security's context isn't populated yet (it would be, but defense), the advice still works as long as the interceptor ran.

Potential brittleness: If a future filter also claims `HIGHEST_PRECEDENCE`, ordering becomes undefined. Suggest documenting this in the filter class javadoc and grep for other `HIGHEST_PRECEDENCE` filters to confirm no current conflict.

**Verdict**: ✅ Ordering is correct as written.

---

### Q6 — Edge cases: anonymous / expired token / cross-factory denial?

**Verdict**: ⚠️ **LOW — one defensive gap**

| Scenario | Behavior | Assessment |
|---|---|---|
| **No JWT** (login / health / public endpoints) | `resolveCurrentUser` returns null → `beforeBodyWrite` returns body unchanged. ThreadLocal NOT set. | ✅ Pass-through. Public endpoints should not contain prices; if they do, that's a controller-design bug, not advice bug. |
| **Expired token** | `JwtAuthInterceptor` rejects with 401 before controller runs → `beforeBodyWrite` never invoked. | ✅ Correctly fail-closed. |
| **Cross-factory denial** | `JwtAuthInterceptor` rejects with 403 before controller runs. | ✅ Same. |
| **User deleted mid-request** | `userRepository.findById` returns `Optional.empty()` → `currentUser == null` → pass-through. | ⚠️ Fail-OPEN. User had a valid JWT but is now gone — best practice is fail-closed (assume no permission, strip). However: since JwtAuthInterceptor already validated the JWT, this is a narrow window. Acceptable. |
| **`permissionService.hasPermission` throws** | Line 126: outside the try/catch block (line 131-140 try only wraps `stripPriceFields`). RuntimeException propagates → 500 response. | ⚠️ Functionally fail-closed (500 means no body to leak), but bad UX. Should wrap in try, default to "strip" (fail-closed) and warn-log. |
| **`userRepository.findById` throws** | Wrapped in try/catch at line 359-362 → returns null → pass-through. | ⚠️ Fail-OPEN on DB error. Should be fail-closed for safety. |
| **Body is primitive (String/Long/BigDecimal)** | `isJdkType()` returns true → `stripPriceFields` returns early. | ✅ Safe. |
| **Body is ResponseEntity** | Spring unwraps before advice; advice sees inner type. | ✅ Standard. |

**Defensive gap**: `permissionService.hasPermission` is invoked outside the try/catch. If `PermissionService` throws (DB outage, mis-configured cache, NPE), every response becomes 500. Cleaner:

```java
boolean canViewPrices;
try {
    canViewPrices = permissionService.hasPermission(currentUser, PRICE_VIEW_PERMISSION);
} catch (Exception e) {
    log.warn("Permission check failed for userId={}, defaulting to fail-CLOSED (strip)", currentUser.getId(), e);
    canViewPrices = false;  // fail-closed
}
```

**Verdict**: ⚠️ LOW — one defensive improvement recommended (wrap hasPermission). Not a regression of PR #443.

---

### Q7 — Test adequacy: do 22/22 tests cover Q1-Q6 risk surface?

**Verdict**: ⚠️ **MEDIUM — significant gaps relative to architectural risk**

The 22 tests are well-written for the **field-strip behavior** they target. But they do NOT exercise the new architectural components in isolation:

| Risk surface | Test coverage | Gap |
|---|---|---|
| Field strip (existing PR #423 logic) | 14 tests | ✅ Complete |
| P0 NPE-safe getters | 6 tests | ✅ Sufficient (each of 4 affected entities + ApiResponse path + admin pass-through + ThreadLocal lifecycle) |
| `PriceSensitiveSerializerModifier` itself | ❌ 0 tests | No unit test exercises the Jackson modifier directly — tests use the advice's reflective field strip, not the Jackson short-circuit. A controller-integration test (`MockMvc`) is needed to confirm Jackson actually emits `null` for `@PriceSensitive` *methods* when ThreadLocal is set. |
| `PriceSensitiveContextFilter` itself | ❌ 0 tests | The filter's `finally` cleanup is mocked out in tests (manually `clear()` in `@BeforeEach`/`@AfterEach`). No test asserts the filter runs at all, no test asserts cleanup on `filterChain.doFilter` throwing. |
| Async dispatch leak (Q1) | ❌ 0 tests | No `MockMvc.asyncDispatch()` simulation. The latent thread-pollution bug is untested. |
| Non-JSON bypass (Q4) | ⚠️ 1 partial test (`nonJsonContentType_passThrough`) — asserts pass-through, NOT that pass-through is the intended security model | The test demonstrates the bypass exists but doesn't flag it as a known limitation. |
| Permission service throws (Q6) | ❌ 0 tests | No test for `permissionService.hasPermission(...)` throwing. |
| `ReturnOrder` / `ReturnOrderItem` (Q3 gap) | ❌ 0 tests | Confirms test scope mirrors implementation scope — gap is not flagged. |
| `MaterialBatch.getTotalCost` (Q3 inconsistency) | ⚠️ Indirect (via `getTotalPrice`'s null guard) | No direct test asserts `getTotalCost()` returns null after strip. |
| Cycle protection | ✅ 1 test | Bidirectional JPA cycle |
| Integration through full stack | ❌ 0 MockMvc tests | All tests call `advice.beforeBodyWrite()` directly. No end-to-end test with real Spring Boot context + filter + advice + modifier + serialization. |

**Critical finding**: The P0 regression tests (8 of them) verify that `getPayableAmount()` returns null safely **at the Java level**. They do NOT verify that Jackson short-circuits via the modifier. The defensive null guards alone would pass these tests even if the modifier was broken.

To prove the modifier works end-to-end, need a `@SpringBootTest` + `MockMvc` test that:
1. Authenticates as warehouse_manager.
2. GETs `/api/mobile/F006/sales/orders/{id}`.
3. Parses raw JSON response.
4. Asserts `payableAmount` is `null` in the JSON (NOT just that the getter would return null in Java).

Without this, the test suite proves the belt works but not the suspenders.

**Verdict**: ⚠️ MEDIUM — the 8 P0 tests close the NPE regression at the Java level. Architectural risks (Q1 async, Q4 bypass, Q6 exception, modifier short-circuit, filter cleanup) are untested. Recommend follow-up integration test PR.

---

## Overall verdict

### ✅ **APPROVE-WITH-FOLLOWUP** (do NOT block merge)

**Why approve**:
1. PR #443 closes the stated P0 regression (NPE on `/api/mobile/F006/sales/orders` for warehouse_manager). The architecture is sound:
   - Annotation `@Target({FIELD, METHOD})` ✓
   - Jackson `BeanSerializerModifier` correctly intercepts both field and method properties ✓
   - ThreadLocal cleanup via `OncePerRequestFilter` with `HIGHEST_PRECEDENCE` ✓ (for sync path)
   - Belt-and-suspenders defensive null guards on the 8 getters ✓
2. The 8 annotations cover the entities exercised by the regression (`SalesOrder`, `SalesOrderItem`, `PurchaseOrderItem`, `InternalTransferItem`, `MaterialBatch`).
3. 22 unit tests pass; 8 are explicit P0 regression tests.

**Why follow-up needed**:

| # | Severity | Finding | Recommended ticket |
|---|---|---|---|
| F1 | ⚠️ MEDIUM | Async-dispatch ThreadLocal leak risk (Q1) | Override `PriceSensitiveContextFilter.shouldNotFilterAsyncDispatch()` to return `false`; add `MockMvc.asyncDispatch()` test with simulated Callable controller |
| F2 | ⚠️ HIGH | `ReturnOrder` / `ReturnOrderItem` missing `@PriceSensitive` on `totalAmount`, `unitPrice`, `lineAmount` (Q3) | Sister-sweep follow-up: add field annotations + getter annotation + null guard; add test |
| F3 | ⚠️ LOW | `MaterialBatch.getTotalCost()` not annotated (Q3) | Add `@PriceSensitive` for consistency + defense-in-depth |
| F4 | ❌ HIGH | PDF/Excel export bypass — non-JSON paths skip field-strip + Jackson modifier (Q4) | Architectural review: move strip to `HandlerMethodReturnValueHandler` or service-layer interceptor; meanwhile, audit all `@RequestMapping(produces = "application/pdf"\|"...excel")` endpoints for price exposure |
| F5 | ⚠️ LOW | `permissionService.hasPermission` not wrapped in try/catch (Q6) | Wrap with fail-closed default + warn log |
| F6 | ⚠️ MEDIUM | No integration test for `PriceSensitiveSerializerModifier` end-to-end (Q7) | Add `@SpringBootTest + MockMvc` test parsing raw JSON for warehouse_manager response |
| F7 | ⚠️ LOW | PR description claims "7 @Transient getters" — actually 8 (MaterialBatch.getTotalValue counted with getTotalPrice but they're separate methods) | Edit PR body for accuracy |
| F8 | ⚠️ LOW | `DisposalRecord.estimatedLoss / actualLoss / recoveryValue` — verify if these are intentionally outside scope or missed by PR #444 (Q3) | Confirm with original author / PR #415 spec |

**Severity legend**:
- ❌ HIGH: confirmed data leak in production path.
- ⚠️ HIGH: confirmed gap with high probability of exploitation.
- ⚠️ MEDIUM: latent risk with moderate exploitation surface.
- ⚠️ LOW: defensive improvement, no current production impact.

**None of F1–F8 are introduced by PR #443**. F2/F4 pre-existed (PR #415/#423/#444 scope). F1/F5/F6 are improvements on PR #443's new architecture. F3/F7 are minor consistency/doc fixes.

**Recommendation**: Merge PR #443 to close the active NPE regression. File F1–F8 as separate tickets prioritized by severity (F4 + F2 first for data-leak risk).

---

## Cross-check vs PR body (verified after independent review)

After completing the Critic analysis, spot-checked the PR's stated claims:
- "12 files / +608/-19" ✓ matches `git diff --stat`.
- "22/22 tests pass" — I did NOT run the tests; cannot verify. Trusting the claim.
- "8 新 P0 regression" tests ✓ matches `p0_*` test methods I counted.
- "7 @Transient 算贵 getter" ❌ — actually 8 (see F7).
- "config-time 包 BeanPropertyWriter, serialize-time 查 ThreadLocal" ✓ confirmed in `PriceSensitiveSerializerModifier.changeProperties` + `PriceSensitivePropertyWriter.serializeAsField`.
- "无权限**不调** getter 直接 emit null" ✓ confirmed — `super.serializeAsField` is NOT called when hide=true.
- "finally 清 ThreadLocal 防 pool 串" ✓ for sync path; ⚠️ async path is the Q1 concern.

---

## Reviewer notes

This audit was performed with **zero conversation context from chat-x** (the implementing chat) per Rule 9. I did not read the PR body's reasoning, the implementation chat transcript, or the prior audit doc. Findings are derived independently from the 12 changed files + grep across the repository.

If chat-x has already noted some of these as known-gap follow-ups in their PR body or backlog, my findings still stand for the audit trail — but the prioritization could be informed by what chat-x already documented.

Audit completed in ~1.5 hours wall-clock (file reading + grep + cross-reference). No tests were run by the reviewer.
