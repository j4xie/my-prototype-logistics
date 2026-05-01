# R78 — Equipment-Cluster Controller Sweep + AIRule Chain Debt Cleanup

**Date**: 2026-04-30
**Branch**: `e2e/v1-framework`
**Commits**: `17399fce1` (66-site batch) + `d265639a6` (R78-FIX-A reviewer miss)
**Module focus** (Rule 11): equipment domain controllers (DahuaDevice + Device + Isapi); R77 backlog cleanup (AIRule chain)

---

## Why this round

R76+R77 fixed 27 of 212 `ApiResponse.error` sites. R78 targets the **equipment-cluster batch** (highest immediate ROI per R77 reviewer recommendation):
- DahuaDeviceController (30 sites — Hikvision-alternative camera/NVR/DVR)
- DeviceController (12 sites — push notification registration)
- IsapiDeviceController (18 sites — Hikvision camera/NVR via ISAPI)

Plus R77 backlog cleanup: AIRule `parseAndSaveRule`/`parseAndSaveStateMachine` had unreachable validation chains after R77 made `parseRule()`/`parseStateMachine()` throw.

Equipment cluster matters because: device admin pages are user-facing, error UX directly impacts customer setup/diagnostic flows.

---

## Bugs fixed (66 sites)

### Equipment-cluster batch (60 sites)

**DahuaDeviceController (30 sites)**:
- 15 catch handlers (discover / probe / CRUD / import / sync / capture / provision / activate / stats) → `BusinessException(500)`
- 15 validation paths:
  - SSRF check → `BusinessException(403)` + actionHint "请使用公网或工厂局域网内的合法 IP"
  - Port range → `BusinessException(400)` + hint
  - Device exists (IP/MAC) → `BusinessException(409)` + hint
  - Device not found (deviceId) → `BusinessException(404)` + hint
  - Device info null (probe failure) → `BusinessException(502)` + hint
  - Image data null (capture failure) → `BusinessException(502)` + hint

**DeviceController (12 sites)**:
- 6 catch handlers (register / unregister / token / list / test / disable) → `BusinessException(500)`
- 6 validation paths:
  - userId null → `BusinessException(401)` + hint "请重新登录"
  - Device not registered → `BusinessException(404)` + hint
  - Token format invalid → `BusinessException(400)` + hint

**IsapiDeviceController (18 sites)**:
- 9 generic Exception catches → `BusinessException(500)`
- 4 IllegalArgumentException catches → `BusinessException(400, sanitize(e), e)`
- 5 validation/internal:
  - HTTP Host config IAE → `BusinessException(400)`
  - Password &lt;6 chars → `BusinessException(400)` + hint
  - capture.getError() → `BusinessException(502)`
  - reanalyzeEvent failure → `BusinessException(500)`
  - Batch import all-fail → `BusinessException(500)` + hint
  - **R78-FIX-A**: `getEventDetail` `.orElse(ApiResponse.error("事件不存在"))` → `.orElseThrow(... BusinessException(404))` (caught by reviewer)

### AIRule chain debt cleanup (6 sites)

R77 made `parseRule()`/`parseStateMachine()` throw on failure. Their callers `parseAndSaveRule`/`parseAndSaveStateMachine` had legacy `if (!parseResult.getSuccess())` branches that became unreachable. R78 cleanup:

- `parseAndSaveRule`:
  - Removed unreachable `if (!parseResult.getSuccess()) return ApiResponse.error(...)` branch
  - 4 inline validations (parsed null / DRL empty / DRL syntax) → `BusinessException` with semantic codes (500/500/400) + hints
- `parseAndSaveStateMachine`:
  - Removed unreachable success check branch
  - 2 inline validations → `BusinessException(500)`

---

## Method: regex-driven batch transform

Used Python regex transform (`/tmp/r78-transform-v3.py`) to handle 30 catch-handler + 4 IllegalArgumentException sites. Validation paths fixed via sed/python (semantic HTTP codes per pattern).

Why batch: the catch-handler pattern is uniform across ~210 sites total; manual editing each is impractical. Regex matches:
```java
} catch (Exception e) {
    log.error("X", ..., e);
    return ApiResponse.error("Y" + ErrorSanitizer.sanitize(e));
}
```
→
```java
} catch (BusinessException be) {
    throw be;
} catch (Exception e) {
    log.error("X", ..., e);
    throw new BusinessException(500, "Y" + ErrorSanitizer.sanitize(e), e);
}
```

Verification: post-transform `grep return ApiResponse.error(` per file → confirmed counts. Reviewer agent paired with grep covered the rest.

---

## Same-cause sweep findings (Rule 8)

**Initial baseline (R76 audit)**: 212 `return ApiResponse.error(...)` sites in 36 controllers.

**R78 reviewer expanded pattern**: also include `.orElse(ApiResponse.error(...))` Optional chain pattern. Broader grep finds **~387 sites in 51 files** — initial 212 was an undercount.

**Cumulative R76+R77+R78 progress**: 93/212 (~44%) of original baseline; or 93/387 (~24%) of true count.

**Remaining high-impact** (excluding SmartBI per user):
- IntentAnalysisController (~45 sites) — internal/diagnostic
- TemplatePackageController (~23 sites) — admin
- RuleController (~17 sites) — different from AIRule
- FileUploadController (~15 sites)
- AiAgentRule / SchedulingOptimization (~14-20 sites each)
- WorkReporting / Restaurant Material/Stocktaking/Wastage `.orElse` 4-5 sites

---

## Reviewer findings (Rule 9 — independent agent `a5ca130ce7e175a60`)

Verdict: **FIX BEFORE PROD** → addressed in `d265639a6`.

Caught:
1. ⚠️ **IsapiDevice:521** `.orElse(ApiResponse.error("事件不存在"))` — same-cause miss (R78 grep didn't catch Optional chain pattern). **Fixed**.
2. ✅ Regex transform produced no malformed Java (verified all `} catch (BusinessException be) { throw be; }` paired structure).
3. ✅ HTTP status codes defensible (SSRF 403, port 400, device 404/409/502, AI 500).
4. ✅ AIRule chain in-class throw propagates cleanly (BusinessException is RuntimeException, no AOP proxy interception).
5. ✅ All imports verified (BusinessException + ErrorSanitizer in all 4 files).
6. ✅ Build risk near-zero (mvn unavailable in shell but static analysis clean; deploy script's mvn package validates).
7. Reviewer expanded the "212 sites" claim to ~387 actual via broader grep — recorded in R79+ backlog.

Cosmetic: regex transform left a double-blank-line between `throw be;` and `} catch (Exception e)`. Harmless; can be cleaned in a future formatter pass.

---

## Module coverage matrix update (Rule 11)

| Module | Pre-R78 | Post-R78 |
|--------|---------|----------|
| equipment cluster (DahuaDevice + Device + IsapiDevice backend) | none | **medium** (60 sites cleaned, no UI verify) |
| AI rule / state machine (backend) | partial (R77 4/12) | **medium** (10/12 with chain debt cleaned) |
| equipment UI (3 pages) | none | none (R80 candidate) |
| Other modules | unchanged | unchanged |

---

## Test/prod ship status (FINAL)

- ✅ vue-tsc not applicable (backend-only round)
- ✅ mvn compile via deploy-backend.sh succeeded end-to-end on test
- ✅ Test deploy 10011 alive (`{"status":"UP"}`); web-admin not redeployed (no FE changes this round)
- ✅ Push origin: 2 commits — `17399fce1`, `d265639a6`
- ⏳ Prod deploy via Blue-Green in progress
- ⏳ Audit doc + memory commit pending

---

## R79+ backlog (priority, excluding SmartBI per user)

1. **R79** — IntentAnalysis + RuleController + FileUpload + TemplatePackage = ~100 sites (1-2 rounds)
2. **R80** — `.orElse(ApiResponse.error(...))` Optional chain pattern ~10 sites in restaurant + workflow + lowcode + feature controllers
3. **R81** — equipment/* + quality/* UI verify (R69-R72 backend touched but UI never live-verified)
4. **R82** — scheduling/* 7 pages module breadth (untouched)

**Cumulative goal**: R76→R82 = 100% of 387 sites + 3 modules deep coverage.

---

## Files touched

Backend (4): `AIRuleController.java`, `DahuaDeviceController.java`, `DeviceController.java`, `IsapiDeviceController.java`

LOC: 4 files / +488 / -389 / 2 commits.
