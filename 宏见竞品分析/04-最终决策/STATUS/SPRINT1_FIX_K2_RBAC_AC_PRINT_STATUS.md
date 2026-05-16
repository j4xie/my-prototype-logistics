# Sprint1-Fix-K2 — Attachment + Print RBAC 补全

**Worker**: Chat K2
**Branch**: `fix/sprint1-rbac-ac-print`
**Base**: `main @ cd3d37eaa` (ops(nginx): commit shared-include snippet + sync 3 vhosts to repo)
**Worktree**: `C:\Users\Steve\my-prototype-logistics-sprint1-fix-k2`
**Scope**: PR #658 (Attachment 8 endpoints) + PR #659 (Print 5 endpoints) RBAC follow-up
**Started**: 2026-05-15
**Status**: ✅ COMPLETE — [PR #671](https://github.com/j4xie/my-prototype-logistics/pull/671) opened

---

## 2026-05-15 close-out

### Files changed (6)

**Production (3)**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/security/AttachmentPermissionResolver.java` (NEW, 184 lines)
  - Entity-type-aware permission map (18 `EntityType` → module mappings)
  - `requireRead(user, entityType)` / `requireWrite(user, entityType)` throw `BusinessException(403)` with role-aware message
  - `factory_super_admin` + `platform_admin` bypass (FactoryUserRole-based)
  - `validateUploadRequest(contentType, fileSize)`: 11-entry MIME whitelist + 10 MB cap
  - `resolveCurrentUser(HttpServletRequest)` — JwtAuthInterceptor-set `userId` attribute lookup, closed-by-default null
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/AttachmentController.java` (MODIFIED)
  - All 8 endpoints stamped with method-level `@RequirePermission` (coarse OR gate)
  - Fine-grained `permissionResolver.requireRead/Write(user, entityType)` per endpoint
  - GET `/{id}` / `/{id}/download` / PUT `/{id}`: fetch attachment → derive entityType → require
  - POST `/upload-url`: content-type whitelist + size validation (refuses .exe / oversize)
  - POST `/` register: also re-validates content-type + size (defense in depth, caller may lie)
  - DELETE `/{id}`: coarse @RequirePermission only — service-side owner+admin check unchanged
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/PrintController.java` (MODIFIED)
  - All 5 endpoints stamped with module-appropriate `@RequirePermission`:
    - `sales-order` / `quotation` → `sales:read|read_write`
    - `purchase-order` → `procurement:read|read_write`
    - `production-task` → `production:read|read_write`
    - `material-requisition` → `procurement:read|read_write` ∪ `warehouse:read|read_write`
  - `applyPriceMask(payload, auth, docType, hasMonetary)` calls `PriceMaskResolver.shouldMaskPrice` and replaces 7 top-level + 9 line-item price keys with `"—"` BEFORE Python PDF render — closes PR #423 byte[] bypass
  - Production-task / material-requisition skip masking (no monetary fields), still RBAC-gated

**Tests (3)**:
- `backend/java/cretas-api/src/test/java/com/cretas/aims/security/AttachmentPermissionResolverTest.java` (NEW, **16 tests**)
  - ❌ warehouse_manager → PAYMENT_VOUCHER read → 403 (the PR_AUDIT headline bug)
  - ❌ warehouse_manager → QUALITY_CHECK read → 403
  - ✅ finance_manager → PAYMENT_VOUCHER read → allowed
  - ✅ factory_super_admin / platform_admin bypass (verifies `hasAnyPermission` never called)
  - ❌ null user → 401 / null entityType → 400
  - ✅ requireWrite demands `module:read_write` (read alone insufficient)
  - ❌ Upload .exe (`application/octet-stream`) → 400
  - ❌ Upload 20 MB → 400 over 10 MB cap
  - ✅ Whitelist accepts pdf / jpeg / png / xlsx / docx / mp4
  - ✅ Content-Type case-insensitive
  - ✅ `resolveCurrentUser` from `request.userId` attribute (closed-by-default null)
- `backend/java/cretas-api/src/test/java/com/cretas/aims/controller/PrintControllerRBACTest.java` (NEW, **4 tests**)
  - ❌ warehouse_manager: totalAmount / subtotal / taxAmount + items[].unitPrice / subtotal all → `"—"`
  - ✅ finance_manager: prices intact (10000.00 / 9500.00 / etc.)
  - ✅ production-task: mask hook short-circuits when `hasMonetaryFields=false` (resolver not invoked)
  - ❌ Missing Authorization header → resolver defaults closed → all masked
- `backend/java/cretas-api/src/test/java/com/cretas/aims/controller/AttachmentControllerTest.java` (MODIFIED)
  - Added `@Mock AttachmentPermissionResolver` + `@Mock HttpServletRequest`
  - Each endpoint test now also `verify(permissionResolver).requireRead/Write(...)` — proves wiring is real
  - All 9 contract tests still PASS

### Test results

```
[INFO] Running com.cretas.aims.controller.AttachmentControllerTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.764 s
[INFO] Running com.cretas.aims.controller.PrintControllerRBACTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.290 s
[INFO] Running com.cretas.aims.security.AttachmentPermissionResolverTest
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.320 s
[INFO] Tests run: 29, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Full controller + security regression: **167/167 PASS** (no other controllers / Price advice tests broken).

### Security impact closed

- **#658 vuln A (cross-factory)** — `getById` / `download` / `update` now fetch attachment first, derive `entityType`, and gate via resolver. Combined with existing service-level `factoryId` filter (`findByFactoryIdAndId`), warehouse_manager from F001 cannot access F002 attachments.
- **#658 vuln B (cross-module sensitive download)** — warehouse_manager calling `GET /attachments/{id}` where the attachment is a `PAYMENT_VOUCHER` now 403s (resolver demands `finance:read|read_write`). Same for `QUALITY_CHECK`, `INVOICE`, `EXPENSE_REPORT`.
- **#658 vuln C (OSS upload abuse)** — `POST /upload-url` validates Content-Type against 11-entry MIME whitelist and rejects declared `fileSize > 10 MB`. `.exe`, `.bat`, `.dll`, raw `application/octet-stream` blocked.
- **#659 vuln D (PDF price leak)** — `applyPriceMask` runs on payload before Python proxy. PR #423 `PriceFieldResponseAdvice` only walks JSON; binary PDF byte[] bypassed it. Now closed.
- **#659 vuln E (anonymous PDF)** — Every print endpoint now requires the appropriate module read perm. Anonymous / no-role callers get 403 at `PermissionInterceptor` before payload assembly.

### DoD checklist

- ✅ AttachmentController 8 endpoint 全部 @RequirePermission
- ✅ PrintController 5 endpoint 全部 @RequirePermission
- ✅ PriceMaskResolver 在 PrintController 渲染前调用 (`applyPriceMask` hook)
- ✅ Entity-type aware permission resolver service (`AttachmentPermissionResolver`)
- ✅ OSS upload-url size (10 MB) + content-type whitelist (11 MIME types)
- ✅ 单测 ≥4 个 (实际 20 个新增 + 9 个修订)
- ✅ mvn test PASS (29 K2-scoped + 167 controller+security regression PASS)
- ✅ PR 推送 — https://github.com/j4xie/my-prototype-logistics/pull/671 (commit `05490fa8d`)
- ✅ STATUS 完整 (本文件)

### Concurrent-edit safety

- Solo worktree `../my-prototype-logistics-sprint1-fix-k2` — physical isolation per `.claude/rules/concurrent-edit-safety.md` Rule 2.
- Per Rule 5b, will use `git commit -- F1 F2 ...` with explicit path list at commit time (not `git add .`).
- No K1 / K3 file overlap (K1 = Flyway, K3 = MaterialAbacaController; K2 = AttachmentController + PrintController + 1 new resolver).
