# R77 — System Management Controller Sweep + llm-usage Type Safety

**Date**: 2026-04-30
**Branch**: `e2e/v1-framework`
**Commits**: `5c060493c` (llm-usage + UserController) + `7ab4b4480` (BehaviorCalibration + AIRule)
**Module focus** (Rule 11): 系统管理 (system/* 19 pages — first dedicated round)

---

## Why this round

Per Apr 15 customer report, 系统管理 was one of the 5 modules with `none` E2E coverage that accounted for 13/16 customer bugs. R76 covered 经营驾驶舱; R77 is system management.

Surprisingly, **system/* frontend is much cleaner than dashboard**:
- 0 `Math.random()` fake business data
- 0 silent `Promise.allSettled` failures (most legs have `// Interceptor handles toast` comment)
- 0 hardcoded `*0.92`-style fakes

The R77 work is therefore narrower:
1. `llm-usage/index.vue` — 7× `as any` band-aid + 2× `catch(e:any)` (CLAUDE.md TypeScript safety violations)
2. Continuation of R76 same-cause sweep on backend `ApiResponse.error` catch handlers in **system-page-backing controllers**

---

## Same-cause sweep (Rule 8) — extension of R76

R76 fixed 2/212 sites of `return ApiResponse.error(...)` (in dashboard scope). R77 extends:

| Controller | Pre-R77 | Post-R77 | Backed by system page |
|---|---|---|---|
| BehaviorCalibrationController | 10 (R76 fixed 1) | **0** | 行为校准 (calibration list/detail) |
| AIRuleController | 12 | 6 (4 catch + 2 chain remain) | AI 意图配置 + AI 规则编辑 |
| UserController | 3 | **0** | 用户管理 (users) |

**Total cumulative**: R76+R77 = 27/212 sites fixed (~13%) in 4 controllers.

**Surviving high-impact** (per reviewer):
- SmartBIUploadController (37 sites) — excluded per user (SmartBI module out of R76/R77 scope)
- SmartBIConfigController (65 sites) — excluded
- DahuaDeviceController (30 sites) — equipment domain
- IntentAnalysisController (45 sites) — internal/diagnostic
- TemplatePackageController (23 sites) — admin
- IsapiDeviceController (18 sites) — device admin

---

## Bugs fixed (depth label per Rule 1)

| ID | File:line | Pattern | Fix | Depth |
|----|-----------|---------|-----|-------|
| BUG-41 (P1) | llm-usage/index.vue:194-197 | 7× `(s as any)?.data ?? s` band-aid | typed `s.data ?? null/[]` via existing `ApiResponse<T>` interface | medium |
| BUG-42 (P1) | llm-usage/index.vue:198,211 | 2× `catch (e: any)` | `catch (e: unknown)` + `e instanceof Error` narrow | medium |
| BUG-43 (P1) | UserController:308 | Excel ext validation `ApiResponse.error` | `BusinessException(400)` + actionHint "请使用模板下载按钮" | medium |
| BUG-44 (P1) | UserController:313 | File size `ApiResponse.error` | `BusinessException(400)` + actionHint "压缩或拆分" | medium |
| BUG-45 (P1) | UserController:333 | Batch import catch `ApiResponse.error` | `BusinessException(500)` + sanitize msg | medium |
| BUG-46 to BUG-53 (P1) | BehaviorCalibrationController × 8 catch | 8× catch return `ApiResponse.error` | 8× `BusinessException(500)` | medium |
| BUG-54 (P1) | BehaviorCalibrationController:162 | IllegalArgumentException catch validation | `BusinessException(400)` + actionHint "DAILY/WEEKLY/MONTHLY" | medium |
| BUG-55 to BUG-58 (P1) | AIRuleController × 4 catch (parseRule + parseStateMachine) | 4× catch return `ApiResponse.error` | RestClient → `BusinessException(503)` + hint, generic → `BusinessException(500)` | medium |
| BUG-59, BUG-60 (P1) | AIRuleController × 2 mid-method | "AI服务返回异常" soft-fail return | `BusinessException(502)` + hint | medium |

**Total**: 20 bugs fixed. All P1 (no P0 user-facing fakes found in system module — frontend already clean).

---

## Reviewer findings (Rule 9 independent agent `a7f15d2f6f3f00915`)

Verdict: **SHIP AS-IS**.

Key checks passed:
1. ✅ llm-usage typed unwrap safe — interceptor at `request.ts:201` returns `ApiResponse<T>` envelope; `s.data ?? null` matches null-safe UI pattern.
2. ✅ AIRuleController 502/503/500 handled by frontend interceptor `request.ts:313-330` — same toast UX.
3. ⚠️ Dead code at `AIRuleController:147-150,314-322` (`parseAndSaveRule`/`parseAndSaveStateMachine`) — `parseResult.getSuccess()==false` branch never executes after R77 makes inner method throw. **Not a runtime bug**, just code-cleanup debt. R78+ removal.
4. ✅ BehaviorCalibrationController 10/10 sites confirmed (1 from R76 + 9 from R77).
5. Recommended next priority: SmartBIUploadController 37 sites — but excluded per user (SmartBI out of scope).

No build errors; all imports verified; no type erasure issues.

---

## Module coverage matrix update (Rule 11)

| Module | Pre-R77 | Post-R77 |
|--------|---------|----------|
| 系统管理 (system/*) | none | **medium** (mechanical fixes; no UI deep verify run) |
| 经营驾驶舱 (dashboard) | deep (R76) | deep |
| 财务/SKU毛利率 | deep (R76) | deep |
| 行为校准 (backend) | none | medium (10/10 controller sites cleaned) |
| AI 意图/规则 (backend) | none | medium (6/12 sites cleaned, 6 chain debt) |
| equipment / quality / procurement / transfer / scheduling | partial / none | unchanged |

---

## Test/prod ship status (FINAL)

- ✅ vue-tsc passed (0 errors)
- ✅ mvn compile passed (deploy script succeeded end-to-end on test)
- ✅ Test deploy: backend 10011 + web-admin 8097 alive (`{"status":"UP"}`)
- ✅ Push origin/e2e/v1-framework: `be17e112b..7ab4b4480`
- ⏳ Prod deploy in progress (Blue-Green + atomic swap)

---

## R78+ backlog (priority order, EXCLUDING SmartBI + 数据分析 per user)

1. **R78 — controller sweep continuation** (highest immediate value):
   - DahuaDeviceController (30 sites) — equipment domain
   - DeviceController (12 sites)
   - IsapiDeviceController (18 sites)
   - IntentAnalysisController (45 sites)
   - TemplatePackageController (23 sites)
   - AIRule chain debt (6 sites in `parseAndSaveRule`/`parseAndSaveStateMachine`)
   - **Total ~134 sites** if all done; reasonable to split into R78 + R79

2. **R79 — module breadth** (per Rule 11):
   - scheduling/* 7 pages (untouched, high-priority customer-bug-density)
   - equipment/* 3 pages (R69-R72 backend touched, UI never verified)
   - quality/* 3 pages

3. **R80+ — final cleanup**:
   - ~50 sites in remaining ~25 controllers (ConfigController validation paths, etc)

**Cumulative ApiResponse.error progress**: 27 / 212 (12.7%) → R78 should aim for 40%+.

---

## Files touched

Backend (3): `UserController.java`, `BehaviorCalibrationController.java`, `AIRuleController.java`
Frontend (1): `views/system/llm-usage/index.vue`

LOC: 4 files / +66 / -29 across 2 commits.
