# Frontend 410 SMARTBI_MIGRATED Graceful Degradation Review

**Date**: 2026-05-09
**Author**: Chat 8 (organizer dispatch)
**Branch**: `ops-frontend-410-graceful-review`
**Trigger**: PR #205 (`be5959c504`, T6.5 Phase B prod cutover) — 23 SmartBI Analysis endpoints stubbed to HTTP 410 Gone, body `{code: 410, message: "SMARTBI_MIGRATED: endpoint moved to Python {NEW_PATH} (since 2026-05-09)"}`
**Cross-refs**:
- PR #178 §3.1.a + §3.1.b (deletion-candidates audit, 22 + 1 stub-able classification)
- PR #205 (Phase B 410 stub commit `be5959c504`)
- PR #210 (deploy cutover record + F999 waiver double-record)
- HARD rule `feedback_active_e2e_replaces_passive_soak.md` (Chat 4 Playwright runtime verify in flight separately)

---

## 0. TL;DR

| Question | Answer |
|---|---|
| Does web-admin axios interceptor explicitly handle 410? | **No.** Status 410 falls through to the generic 5xx "其他错误" branch (`request.ts:313-360`). User sees raw `"SMARTBI_MIGRATED: endpoint moved to Python /api/... (since 2026-05-09)"` as a sticky red toast (`duration: 0`, must manually close). Functional, but UX-hostile — Chinese users see English-tech message. |
| Does RN axios client explicitly handle 410? | **No, even less.** `apiClient.ts:51-89` only handles 401 (token refresh); everything else `Promise.reject(error)` for caller to deal with. No global toast at all. |
| Will real customer prod traffic see 410? | **~Zero in normal flow.** 23 stubbed endpoints are all `SAFE_NGINX_ROUTED` (per PR #178 §3.1.a) — nginx routes 75 customer factories to `cretas_python` upstream → Python returns 200. The 410 only fires for: (a) F999 test factory (Decision 2A — F999 hits Java, returns 410); (b) any factory NOT in nginx regex; (c) direct backend hit bypassing nginx (dev/curl); (d) future regression in nginx config. |
| Will consumer pages crash on 410? | **No.** All 3 spot-checked SmartBI Vue pages wrap API calls in try/catch with `_silent: true` to suppress double-toast, set loading=false in `finally`, render empty UI on failure. `FinanceAnalysis.vue` is best-defended — falls back to uploaded-Excel data path or shows friendly Chinese info "系统财务数据暂不可用，请上传 Excel 数据进行分析". |
| Recommended fix priority | **Medium** — defensive code improves dev experience + future-proofs against nginx misconfig regressions. Not customer-facing crash blocker. ~1-2h work for ~10 LOC interceptor changes per platform. |

---

## 1. Web-admin Axios Interceptor (`web-admin/src/api/request.ts`)

### Current 410 fallthrough path

`request.ts:211-361` (response error interceptor). Status checks in order:
1. `axios.isCancel` / `ERR_CANCELED` → silent reject (line 219)
2. **401** → token refresh + retry queue (line 224-281)
3. **403** → `showRichError` with `severity: 'BLOCKING'` modal (line 284-293)
4. **404** → friendly Chinese "请求的接口不存在 (METHOD URL)" (line 298-308)
5. **409 vanilla optimistic-lock** → suppress toast (line 345)
6. **502/503/504** → friendly Chinese "服务暂时不可用..." (line 318-323)
7. **500** → "服务器内部错误,请联系管理员" (line 322-323)
8. **5xx generic** → "服务异常 ({status}),请稍后重试" (line 324-325)
9. **Default fallback** (line 326-360) — applies to ALL other status codes including **410**:
   - `rawMessage = error.response?.data?.message` → `"SMARTBI_MIGRATED: endpoint moved to Python {NEW_PATH} (since 2026-05-09)"`
   - Path: line 316 `message = rawMessage` → line 347 `showRichError(message, ...)` → sticky red toast, `duration: 0`

### What user sees on 410 (web-admin)

> 🔴 SMARTBI_MIGRATED: endpoint moved to Python /api/mobile/F999/smart-bi/analysis/sales (since 2026-05-09)
> [✕ close]

(sticky, requires manual close per Apr 18 UX policy at `request.ts:11`)

### Caller can suppress via `_silent: true`

`SalesAnalysis.vue:781,813,848,878` and `FinanceAnalysis.vue:1077` already pass `_silent: true` to suppress the interceptor toast — they own their own loading/empty-state UI. So **on those specific pages, 410 produces no toast** — just empty charts.

Pages that do NOT pass `_silent` (e.g., `QueryTemplateManager.vue:338,364,382,400`) will get the raw English `"SMARTBI_MIGRATED:..."` toast on 410.

---

## 2. SMARTBI_MIGRATED Code Field — Not a Structured Code

**Marching-order misframing**: MO calls this a `'code' field` to detect. Reality:
- `error.response.data.code` = `410` (numeric HTTP status mirror, NOT the string "SMARTBI_MIGRATED")
- `error.response.data.message` = `"SMARTBI_MIGRATED: endpoint moved to Python {NEW_PATH} (since 2026-05-09)"` — string with `SMARTBI_MIGRATED:` prefix

To programmatically detect SMARTBI_MIGRATED, frontend must check **either**:
- HTTP status === 410 (cleanest — no string parsing)
- `message.startsWith('SMARTBI_MIGRATED:')` (defensive backup if upstream changes status)

Per PR #205 commit msg, the message format is canonical and stable for the Phase B → C lifecycle. No structured `errorCode` enum to parse; `SMARTBI_MIGRATED:` prefix is the contract.

No frontend code anywhere currently checks for either pattern.

---

## 3. Web-admin SmartBI Page Behavior on 410

### 3.1 Caller-site inventory (8 files reference 23-stub endpoints)

| File | Endpoints called (from 23-stub list) | Defense pattern | 410 user-visible behavior |
|---|---|---|---|
| `views/smart-bi/SalesAnalysis.vue` | `/analysis/sales` (×4 with dimension param) | `_silent: true` + try/catch + console.warn + `finally { *Loading.value = false }` | Empty charts, no toast, no crash. KPI cards stay at default zero/empty state. |
| `views/smart-bi/FinanceAnalysis.vue` | `/analysis/finance` (×3 with analysisType param) | Same + multi-tier fallback (try system → try uploaded Excel → show info CTA) | **Best UX**: shows blue info "系统财务数据暂不可用，请上传 Excel 数据进行分析" (line 1287) instead of error |
| `views/smart-bi/QueryTemplateManager.vue` | `/query-templates` GET/POST/PUT/DELETE | Try/catch + `ElMessage.error('加载模板失败，请稍后重试')` (line 349) | Generic Chinese error toast, BUT NO `_silent` → also gets interceptor toast → **double toast** ("加载模板失败" + "SMARTBI_MIGRATED:...") |
| `views/finance/reports/index.vue` | finance reports (likely `/analysis/finance`) | (not deep-read — recommend reviewer spot-check) | likely similar to FinanceAnalysis pattern |
| `views/analytics/smart-bi/AdvancedFinanceAnalysis.vue` | advanced finance | (not deep-read) | likely similar |
| `components/dashboard/DashboardFinance.vue` | `/analysis/finance` (line 87) | try/catch with `error: unknown` (line 101) | (not deep-read — recommend spot-check) |
| `router/guards.ts` | (route name only, NO API call) | n/a | n/a |
| `components/layout/AppSidebar.vue` | (nav label only, NO API call) | n/a | n/a |

### 3.2 Dashboard.vue NOT in stub list

`Dashboard.vue` (2962 LOC) calls `/dashboard/executive`, `/dashboard/executive/custom`, `/dashboard/executive/insights`, `/dashboard/executive/insights/custom/stream` (SSE). All of these belong to `SmartBIDashboardController`, which is **`KEEP_FOR_COMPOSITE_DASHBOARD`** per PR #178 §3.1 (only `/data-date-range` was stubbed as the 23rd Phase B candidate). Dashboard.vue does NOT directly hit the 23 stubbed endpoints.

### 3.3 Pattern strengths

- `_silent: true` flag is a clean pattern for caller-owned UI; well-applied on Sales/Finance analytics pages.
- `loading.value = false` in `finally` consistently clears spinners.
- AbortError ignored (line 1275 in FinanceAnalysis) avoids spurious errors on date-range filter changes.
- FinanceAnalysis multi-tier fallback (system → uploaded Excel → CTA) is the gold standard for graceful degradation; recommend other SmartBI pages adopt similar pattern.

### 3.4 Pattern gaps

- **No global 410 detection** in interceptor → callers without `_silent` show raw English `SMARTBI_MIGRATED:...` to user.
- **QueryTemplateManager.vue gets double toast** (its own `ElMessage.error('加载模板失败')` + interceptor's raw message) on 410. Cosmetic only — both are non-blocking — but noisy.
- **No frontend logging for 410** — nginx misconfig regression would silently degrade UX without surfacing in any error tracker.

---

## 4. RN (CretasFoodTrace) Behavior on 410

### 4.1 Axios client (`frontend/CretasFoodTrace/src/services/api/apiClient.ts`)

Skinny by design (146 LOC vs web-admin's 397):
- Request interceptor: SecureStore JWT injection (line 28-48)
- Response interceptor: only 401 refresh + retry (line 51-89); all other errors `Promise.reject(error)` (line 87)
- **No status-based UI feedback** — every screen owns its error UI

### 4.2 SmartBI API wrapper (`services/api/smartbi.ts`, 428 LOC)

Wraps 18 SmartBI endpoints. **All 23-stubbed endpoints have RN call sites** per `smartbi.ts`:
- `getSalesAnalysis` (`/analysis/sales`), `getDepartmentAnalysis`, `getRegionAnalysis`, `getFinanceAnalysis`, `getCashFlowAnalysis`, `getFinancialRatios`, `getRFMAnalysis` — 7 wrappers all hit `/analysis/{sales,department,region,finance}` (4 of 23 stubs)
- `drillDown` (`/drill-down`) — NOT in 23-stub (NOT_SAFE_FALLTHROUGH per PR #178 §3.1.a)
- `query` (`/query`) — NOT in 23-stub (NOT_SAFE_FALLTHROUGH)
- `getAlerts` (`/alerts`), `getRecommendations` (`/recommendations`), `getIncentivePlan` (`/incentive-plan/...`) — 3 of 23 stubs
- Upload-side wrappers (`uploadExcel`, `uploadAndAnalyze`, `getDatasets`, etc.) — NOT in 23-stub (KEEP_FOR_OUT_OF_SCOPE_CONTROLLER per PR #178 §3.1)

### 4.3 Consumer screen behavior (`SmartBIDataAnalysisScreen.tsx`, 839 LOC)

Spot-checked upload path (line 81-181):
- `try/catch` with `Alert.alert('上传失败', error instanceof Error ? error.message : '未知错误')` (line 174-176)
- 410 → catch → `Alert.alert('上传失败', 'SMARTBI_MIGRATED: endpoint moved to Python ...')` — **same English-tech message exposed verbatim**, but in native modal alert (more disruptive than web-admin toast)
- Note: this screen calls `/smart-bi/sheets` and `/smart-bi/upload-batch` (NOT in 23-stub list — those are upload paths, OUT_OF_SCOPE per PR #178), so it won't actually hit 410 today. But the **pattern** would expose raw English message if it did.

### 4.4 Pattern gaps (RN)

- No global 410 detection (and no global error UI at all — by design).
- Each consumer screen would individually need to detect 410 → show friendly Chinese message → suggest re-login or page refresh.
- `SmartBIHomeScreen.tsx` + analytics-consuming screens (not deep-read) likely same pattern.

---

## 5. Suggested Defensive Code Improvements

### 5.1 Web-admin interceptor (`request.ts`) — Recommended additions

**P1 (low risk, high value)** — add 410 special-case BEFORE the generic 5xx fallthrough at line 313:

```typescript
// 410 Gone — Phase 2A SmartBI 端 Java→Python 迁移完成,后端 stub 应该只有 nginx
// 漏配 / F999 / 直连后端 时触发. 友好提示 + dev console 日志便于排查.
if (status === 410) {
  const rawMsg = error.response?.data?.message as string | undefined;
  const isMigrated = typeof rawMsg === 'string' && rawMsg.startsWith('SMARTBI_MIGRATED:');
  if (isMigrated) {
    console.warn('[SMARTBI_MIGRATED] backend returned 410 — nginx may not be routing this path to Python:', rawMsg);
  }
  if (!originalRequest._silent) {
    showMessage(
      isMigrated
        ? '该功能已迁移升级，请刷新页面重试。如反复出现请联系运维。'
        : (rawMsg || '该资源已下线 (410)'),
      'warning'  // warning level, 3s auto-dismiss (vs error sticky)
    );
  }
  return Promise.reject(new ApiError(rawMsg || '410 Gone', error.response?.data?.code, 410));
}
```

Effect:
- User sees friendly Chinese "该功能已迁移升级，请刷新页面重试" (auto-dismiss 3s) instead of raw English
- Dev console gets `[SMARTBI_MIGRATED]` warning with nginx-misconfig hint
- `_silent: true` callers (Sales/Finance analytics pages) still suppress the toast, behavior unchanged
- `QueryTemplateManager.vue` etc still gets ONE toast (the friendly Chinese one) instead of two

### 5.2 RN apiClient (`apiClient.ts`) — Recommended addition

Insert before line 87 (`return Promise.reject(error)`):

```typescript
// 410 Gone — SmartBI Java→Python migration Phase 2A. Should be nginx-routed
// to Python in normal flow; 410 only on dev / F999 / nginx misconfig.
if (error.response?.status === 410) {
  const rawMsg = error.response?.data?.message as string | undefined;
  if (typeof rawMsg === 'string' && rawMsg.startsWith('SMARTBI_MIGRATED:')) {
    apiLogger.warn('[SMARTBI_MIGRATED] backend 410 — nginx routing gap?', { url: originalRequest.url, message: rawMsg });
  }
  // Don't show Alert.alert here — let consumer screens catch and decide UI.
  // Optional: emit a global event for screens that subscribe.
}
```

Effect:
- Dev visibility into nginx routing gaps (logged via `apiLogger`)
- No behavior change for consumers — they keep their own error UI
- Optional follow-up: emit a global event (e.g., `EventEmitter`) so screens can show consistent friendly message without duplicating logic

### 5.3 Consumer-side improvements (deferred — not in this PR)

- `QueryTemplateManager.vue` should pass `_silent: true` to its 4 `/query-templates` calls and own its UI feedback (mirror SalesAnalysis pattern). Eliminates double-toast.
- `SmartBIDataAnalysisScreen.tsx` upload-path catch should detect 410 prefix and show "该功能已迁移" instead of raw error message. Low priority since upload endpoints are OUT_OF_SCOPE for Phase B 410 stubs.

---

## 6. PR Followup Recommendation List

| Item | Scope | Priority | Effort |
|---|---|---|---|
| **Add 410 case to web-admin `request.ts` interceptor** (per §5.1) | `web-admin/src/api/request.ts` (~12 LOC) | P1 | ~30 min |
| **Add 410 case to RN `apiClient.ts` interceptor** (per §5.2) | `frontend/CretasFoodTrace/src/services/api/apiClient.ts` (~8 LOC) | P1 | ~20 min |
| **Add unit test** for 410 → friendly Chinese message branch | `web-admin/src/api/__tests__/request.test.ts` (new) | P2 | ~30 min |
| **Refactor `QueryTemplateManager.vue` to use `_silent: true`** (eliminate double-toast) | 4 call sites at lines 338, 364, 382, 400 | P2 | ~15 min |
| **Spot-check 3 unread caller files** for 410 behavior consistency | `views/finance/reports/index.vue`, `views/analytics/smart-bi/AdvancedFinanceAnalysis.vue`, `components/dashboard/DashboardFinance.vue` | P3 | ~30 min reviewer spot-check |
| **Add Sentry / error-tracker hook** on 410 detection (alert ops if rate > threshold) | `web-admin/src/api/request.ts` + RN logger | P3 | ~1h (depends on observability infra) |
| **Document SMARTBI_MIGRATED contract** in CLAUDE.md or new `.claude/rules/api-migration-410.md` (frontend dev knows the pattern for future Phase 3+ migrations) | new rule file | P3 | ~15 min |

**Total P1 effort**: ~1h. **Recommend bundling P1 items into a single follow-up PR** titled `feat(frontend): 410 SMARTBI_MIGRATED graceful degradation`.

**Marching-order accuracy patches** (per HARD rule `feedback_marching_order_method_name_grep.md`):
- MO described "SMARTBI_MIGRATED 'code' field" — actually it's a `message` prefix, not a structured code field. Audit §2 clarifies.
- MO scope mentioned "23 endpoint" — accurate per PR #205 (22 from `SmartBIAnalysisController` + 1 from `SmartBIDashboardController.getDataDateRange`).
- MO listed only 3 web-admin pages (Dashboard / SalesAnalysis / FinanceAnalysis) — actual caller graph touches **8 files** (per audit §3.1). Dashboard.vue is NOT a caller of the 23 stubs (only `/dashboard/executive*` which is KEEP_FOR_COMPOSITE).

---

## Cross-References

- **Java side** (Phase B stub):
  - `backend/java/cretas-api/.../controller/SmartBIAnalysisController.java` (22 method bodies stubbed in PR #205)
  - `backend/java/cretas-api/.../controller/SmartBIDashboardController.java` (`getDataDateRange` — 23rd stub)
- **Frontend** (this audit scope):
  - `web-admin/src/api/request.ts:211-361` (response interceptor)
  - `frontend/CretasFoodTrace/src/services/api/apiClient.ts:51-89` (response interceptor)
  - `frontend/CretasFoodTrace/src/services/api/smartbi.ts` (18 SmartBI wrappers, 7 hit 23-stub endpoints)
  - SmartBI Vue pages: `views/smart-bi/{Dashboard,SalesAnalysis,FinanceAnalysis,QueryTemplateManager}.vue`
  - SmartBI RN screens: `screens/smartbi/{SmartBIDataAnalysisScreen,SmartBIHomeScreen}.tsx`
- **Audit inputs**:
  - PR #178 §3.1.a (22 SAFE_NGINX_ROUTED + 4 NOT_SAFE_FALLTHROUGH classification)
  - PR #178 §3.1.b (`getDataDateRange` 23rd Phase B candidate)
  - PR #205 commit `be5959c504` (23 stub method bodies)
  - PR #210 (deploy cutover record + F999 waiver)
- **Rules**:
  - `.claude/rules/api-response-handling.md` (8-field envelope + caller error handling)
  - `.claude/rules/typescript-type-safety.md` (avoid `as any` in interceptor patches)
  - `feedback_pause_before_deploy_or_push.md` (this PR pauses before push for Steve's worktree-merge gate)
- **Memory**:
  - `feedback_active_e2e_replaces_passive_soak.md` (Chat 4 Playwright runtime verify is the empirical complement to this static code review)
  - `feedback_marching_order_method_name_grep.md` (3 MO drift items captured in §6)
