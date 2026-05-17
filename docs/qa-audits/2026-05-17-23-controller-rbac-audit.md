# 23-Controller RBAC Audit — Issue #718

**Date**: 2026-05-17
**Triggered by**: Sister sweep during #710 (PR #717) fix audit
**Auditor**: Subagent C
**Scope**: 23 controllers listed in #718 with `@PostMapping`/`@PutMapping`/`@DeleteMapping` and zero `@RequirePermission`

---

## Methodology

For each controller:
1. Read class-level Javadoc and `@RequestMapping` path
2. Check `WebMvcConfig` to see if path is registered with JWT/Permission/Role interceptors
3. Check `JwtAuthInterceptor.isPublicEndpoint` for explicit public bypass
4. Verify each write method has at least one of:
   - `@RequirePermission(...)` — fires via `PermissionInterceptor`
   - `@RequireRole(...)` — fires via `RequireRoleInterceptor`
   - Class-level annotation that propagates to all methods
   - Explicit role check inside method body
5. Flag false-security cases (e.g., `@PreAuthorize` on a Spring-Security-disabled project — NO-OP)

---

## Key prior context

- `@PreAuthorize` is **silently NO-OP** because Spring Security method-security is disabled
  (`RequireRole.java:11` documents this). Any controller relying ONLY on `@PreAuthorize` is
  effectively bypassable.
- `@RequireRole` interceptor auto-grants access to PLATFORM_ADMIN_ROLES (`super_admin`,
  `platform_admin`, `developer`, `platform_super_admin`). Factory roles must match explicitly.
- `WebMvcConfig.addPathPatterns` registers interceptors for `/api/mobile/**`, `/api/platform/**`,
  `/api/admin/**`, `/api/internal/**`. Paths outside these get NO interceptor enforcement.

---

## Audit Findings

### Section 1 — Initially flagged 🔴 (10 controllers, 69 writes)

| Controller | Status | Verdict | Action |
|---|---|---|---|
| `MobileController` (22 writes) | 🟢 SAFE | All writes are intentional public (auth/login/upload/sync) or use explicit role check (`resetPassword:429`) or delegate to other secured controllers. Equipment alerts (524/541/558) use `@RequestAttribute("userId")` which is set by JWT interceptor — auth required. Feedback (726) is per-user (OK any authed). | Doc only |
| `NotificationController` (5 writes) | 🔴 **GAP FIXED** | `POST` createNotification + `DELETE` deleteNotification had ZERO gating. Any auth factory user could spam/delete notifications. mark-read endpoints OK (user-scoped). | **Added `@RequireRole` admin on POST + DELETE** |
| `ConfigController` (13 writes) | 🟢 SAFE | Class-level `@PreAuthorize` is NO-OP but every write has explicit `@RequireRole({factory_super_admin, permission_admin})`. Already protected. | Verified |
| `DynamicFieldController` (8 writes) | 🟢 SAFE | Every write has `@RequireRole({factory_super_admin, permission_admin})`. | Verified |
| `FactoryBlueprintController` (6 writes) | 🟢 SAFE | Path `/api/platform/blueprints` — JwtAuthInterceptor enforces `platform_admin` role at line 143. Method-level annotation redundant. | Verified |
| `BusinessRuleController` (5 writes) | 🟢 SAFE | Every write has `@RequireRole({factory_super_admin, permission_admin})`. Round 5 fix. | Verified |
| `RulePackController` (4 writes) | 🟢 SAFE | Path `/api/platform/rule-packs` — platform-admin-only via JwtAuthInterceptor. | Verified |
| `TemplatePackageController` (5 writes) | 🟢 SAFE | Path `/api/platform` — platform-admin-only via JwtAuthInterceptor. | Verified |
| `FieldVisibilityController` (2 writes) | 🟡 BY-DESIGN | `field-visibility/recompute` + `link-survey-company` are marked as **public endpoints** in `JwtAuthInterceptor.isPublicEndpoint:227-228` for Python→Java internal calls. `@RequireRole` would NOT fire. Real protection lives at NetworkSecurityGroup (VPC internal IPs). **Doc updated to flag this — followup: convert to `/api/internal/*` with `X-Internal-Key`.** | **Doc comment added** |
| `OnboardingController` (1 write) | 🟢 SAFE | Path `/api/internal/onboarding` + explicit `X-Internal-Key` header check at line 55 (defense in depth on top of JwtAuthInterceptor:155 enforcement). | Verified |

### Section 2 — Initially flagged 🟡 (8 controllers, 20 writes)

| Controller | Status | Verdict | Action |
|---|---|---|---|
| `CameraController` (4 writes) | 🔴 **GAP FIXED** | Path `/api/camera/*` was **NOT in WebMvcConfig** interceptor patterns. `@PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")` is NO-OP. Effectively anonymous! No frontend caller found (grep negative). | **Added `/api/camera/**` to WebMvcConfig + `@RequireRole({factory_super_admin, permission_admin, quality_manager})` on all writes** |
| `BehaviorCalibrationController` (1 write) | 🔴 **GAP FIXED** | Path `/api/admin/calibration` — JWT auth enforced (any auth user), but role gate via `@PreAuthorize` is NO-OP. Any factory user could trigger metric calculation. | **Added `@RequireRole` on `POST /metrics/calculate`** |
| `ComplexityTrainingController` (3 writes) | 🔴 **GAP FIXED** | Path `/api/ai/complexity/*` was **NOT in WebMvcConfig** interceptor patterns. ZERO auth check. Any internet visitor could trigger model retraining → DoS / model poisoning. | **Added `/api/ai/**` to WebMvcConfig + `@RequireRole({platform_admin, super_admin, developer})` on `/train` `/test` `/train-from-file`** |
| `FoodKBFeedbackController` (2 writes) | 🟢 SAFE | Path `/api/mobile/{factoryId}/food-kb/feedback` — JWT enforced. Each user submits own feedback (per-user). No role restriction needed for feedback collection. | Verified |
| `CanvasAIController` (2 writes) | 🟢 SAFE | Both writes have `@RequireRole({factory_super_admin, permission_admin})`. | Verified |
| `GenericAIChatController` (2 writes) | 🟢 SAFE | Path `/api/mobile/ai/*` — JWT-protected. RateLimit per-user. Any authed user can chat (general AI feature). | Verified |
| `FeatureConfigController` (1 write) | 🔴 **GAP FIXED** | Doc said "admin can adjust" but `PUT /{moduleId}` had ZERO annotation. Any auth user could modify factory feature configs. | **Added `@RequireRole({factory_super_admin, permission_admin})`** |
| `VoiceRecognitionController` (5 writes) | 🔴 **PARTIAL GAP FIXED** | `/recognize` + `/batch` are per-user voice services (auth required, OK). But `PUT /voice/config` updates factory-wide config — no role gate. | **Added `@RequireRole` on `PUT /voice/config`** |

### Section 3 — Initially flagged 🟢 (5 controllers, 23 writes)

| Controller | Status | Verdict | Action |
|---|---|---|---|
| `AIPublicDemoController` (3 writes) | 🟢 INTENDED PUBLIC | Path `/api/public/ai-demo` — NOT covered by WebMvcConfig (intentionally anonymous). Demo endpoint. | Verified intentional |
| `DictionaryTestController` (2 writes) | 🟢 INTENDED PUBLIC | Path `/api/public/dictionary-test` — same. | Verified intentional |
| `ImageAnalysisTestController` (2 writes) | 🟢 SAFE | Path `/api/mobile/{factoryId}/image-analysis` — JWT enforced. Any authed user can test. | Verified |
| `platform/AIReportPromptConfigController` (5 writes) | 🟢 SAFE | Path `/api/platform/report-prompts` — platform-admin-only via JwtAuthInterceptor. `@PreAuthorize` redundant. | Verified |
| `PlatformController` (11 writes) | 🟢 SAFE | Path `/api/platform` — platform-admin-only via JwtAuthInterceptor. `@PreAuthorize` redundant. | Verified |

---

## Summary

| Tier | Count | Real Gaps Found | Gaps Fixed |
|---|---|---|---|
| 🔴 Priority | 10 | 1 (NotificationController) | 1 |
| 🟡 Verify | 8 | 4 (Camera + Behavior + Complexity + FeatureConfig + Voice partial) | 5 |
| 🟢 Likely-public | 5 | 0 | 0 |
| **Total** | **23** | **6 controllers had real RBAC gaps** | **6 fixed in this PR** |

## Real Bugs Closed

| # | Controller | Endpoint | Risk |
|---|---|---|---|
| 1 | NotificationController | `POST /notifications` | Any auth user could spam factory notifications to all users |
| 2 | NotificationController | `DELETE /notifications/{id}` | Any auth user could permanently delete factory notifications |
| 3 | CameraController | `POST /api/camera/connect`, `/disconnect`, `/capture`, `/capture/quick` | Anonymous attacker could control industrial camera (path NOT in JWT filter, @PreAuthorize NO-OP) |
| 4 | ComplexityTrainingController | `POST /api/ai/complexity/train`, `/test`, `/train-from-file` | **Anonymous attacker could trigger model retraining → DoS / model poisoning** (path NOT in JWT filter at all) |
| 5 | BehaviorCalibrationController | `POST /api/admin/calibration/metrics/calculate` | Any auth user (non-admin) could trigger metric recalculation (only auth enforced, role gate was @PreAuthorize NO-OP) |
| 6 | FeatureConfigController | `PUT /api/mobile/{factoryId}/feature-config/{moduleId}` | Any auth user could modify factory feature configs |
| 7 | VoiceRecognitionController | `PUT /api/mobile/{factoryId}/voice/config` | Any auth user could update factory voice recognition config |

## Files Modified

### Backend Java
1. `backend/java/cretas-api/src/main/java/com/cretas/aims/config/WebMvcConfig.java` — added `/api/camera/**` and `/api/ai/**` to all three interceptor path patterns (JWT + Permission + RequireRole)
2. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/NotificationController.java` — `@RequireRole` on POST + DELETE
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/FeatureConfigController.java` — `@RequireRole` on PUT
4. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CameraController.java` — replaced 7×`@PreAuthorize` (NO-OP) with `@RequireRole`
5. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ComplexityTrainingController.java` — `@RequireRole` on 3 POST methods
6. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BehaviorCalibrationController.java` — `@RequireRole` on POST `/metrics/calculate`
7. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/VoiceRecognitionController.java` — `@RequireRole` on PUT `/voice/config`
8. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/FieldVisibilityController.java` — doc comment flagging as Python→Java internal endpoints (real protection at NetworkSecurityGroup layer)

---

## Follow-ups

1. **#762 sister sweep verification** (out-of-scope from #718 but audited inline):
   `InvoiceController` already implements role-split per #762 conceptual model — `POST /request` + `POST /request-from-order` accept `{finance, sales}:read_write` (sales can submit invoice request), while `POST /{invoiceId}/approve` `/reject` `/issue` are `finance:read_write` only (matches 发货 pattern from #740). **No further action needed for #762.**

2. **Long-term — FieldVisibilityController Python→Java endpoints**: Should be migrated from `/api/mobile/{factoryId}/field-visibility/recompute` + `/api/mobile/{factoryId}/link-survey-company` to `/api/internal/*` paths with `X-Internal-Key` header (per `OnboardingController` pattern). Current protection relies on NetworkSecurityGroup VPC-internal IPs only — fragile.

3. **Long-term — Spring Security @PreAuthorize cleanup**: Remaining controllers still using NO-OP `@PreAuthorize` should be migrated to `@RequireRole`. The `@PreAuthorize` lines left in CameraController and BehaviorCalibrationController are now dual-annotated (NO-OP coexists with real `@RequireRole`) to preserve audit trail; can be removed in follow-up cleanup PR.

4. **Long-term — verify with E2E**: Each fixed endpoint should be probed by `f006_viewer` (lowest privilege role) to confirm 403 response, per #718 §"Verify approach".
