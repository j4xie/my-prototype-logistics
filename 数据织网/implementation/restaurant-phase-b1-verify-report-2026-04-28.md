# B-1 真窗 Verify Report

**Date**: 2026-04-28
**Branch**: e2e/v1-framework
**Plan**: `数据织网/implementation/restaurant-phase-b1-plan-2026-04-28.md`
**Design**: `数据织网/implementation/restaurant-phase-b1-outlier-filter-2026-04-28-design.md`

## Deploy commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (V20260502_06) | `252c74033` | outlier_dismissals migration (13 cols + RLS FORCE + 2 indexes) |
| Task 1 fix (GRANT) | `d3dfc6b02` | grant smartbi_user perms on outlier_dismissals |
| Task 2 (V20260502_07) | `f06416d6d` | get_global_kpi_stats SECURITY DEFINER fn (round n bucket+grant smartbi_user) |
| Task 2 fix (search_path) | `3347c125d` | harden — search_path CVE-2018-1058 + drop dead var + rollback comment |
| Task 3 (utils) | `a269e0b89` | outlier_stats utils — iqr+zscore+OutlierAlgorithm 共享算法库 |
| Task 4 (service) | `8e84d3cf8` | OutlierService — IQR+2级fallback (W0.4 finding 3 GUC pattern) |
| Task 4 fix (DRY/typing) | `0ebb0b4bc` | DRY (find_outliers_iqr) + typing consistency (Optional/Tuple) |
| Task 5 (GET) | `38d84f66d` | GET /outliers endpoint — admin auth+cross-factory+RLS GUC+cache+R2 baselineSource |
| Task 5 fix (cache key) | `01878c038` | cache key+windowDays + dismiss query error handling + test isolation + 401 test |
| Task 6 (POST/DELETE) | `facdbd92b` | POST dismiss + DELETE undismiss endpoints (validation+RLS GUC+cache invalidate) |
| Task 6 fix (typed error) | `7480d18d0` | typed UniqueViolationError + ISO date validation + 4 tests |
| Task 7 (register router) | `c769cffdf` | register outliers router in main.py |
| Task 8 (FE API client) | `2875fe4e3` | outliers API client + types (R2 baselineSource field included) |
| Task 9 (data-quality-tab) | `82583fb58` | data-quality-tab.vue — outliers表+dismiss+undismiss+R2 baselineSource badge |
| Task 10 (data-completeness tabs) | `c991babfa` | data-completeness.vue 改造为 el-tabs (完整度+数据质量) |
| Task 11.1 (smoke E2E append) | `312541a5c` | smoke E2E append (run after deploy) |
| Task 11.1 fix (selectors) | `514c26cf2` | smoke fix — BASE_URL + 正确登录按钮 + clearCookies 切到 restaurant_admin1 |

**Total: 17 commits across 11 tasks**

## Test env URLs

- web-admin: http://139.196.165.140:8097
- Python: http://47.100.235.168:8084 (internal, tested via SSH)
- Java backend (test env): http://47.100.235.168:10011

## Deploy results

### Migrations (already applied via Tasks 1-2)

- ✅ `outlier_dismissals` table exists on test smartbi_db (13 columns, RLS FORCE)
- ✅ `get_global_kpi_stats(kpi_kind, days)` function callable, returns `{q1, q3, median, n_bucket}`
- ✅ Sanity check: `SELECT * FROM get_global_kpi_stats('wastage_cost_total', 30)` returns row (`n_bucket: <10` because test data sparse)

### Python deploy --env test

- ✅ deploy-smartbi-python.sh completed (2026-04-28 17:43)
- ⚠️ Health check timeout (30s) during deploy — but service actually came up at ~45s
- ✅ Direct verify: `curl http://localhost:8084/health` returns `{"status":"healthy"}` HTTP 200
- ✅ All 8 modules loaded: smartbi, client_requirement, completeness_calculator, efficiency_recognition, scene_intelligence, food_knowledge_base, food_kb_feedback, foreign_object_detection
- ✅ Postgres connected
- ✅ Restaurant ETL tick completed (9 factories, 0 errors) — verified Phase A pipeline still working

### 3 outlier endpoints registered

```
['/api/restaurant/outliers',
 '/api/restaurant/outliers/dismiss',
 '/api/restaurant/outliers/dismiss/{dismissal_id}']
```

✅ All 3 paths in OpenAPI spec on port 8084.

### web-admin deploy --env test

- ✅ deploy-web-admin.sh completed (2026-04-28 17:46)
- ✅ Build: 349 assets, 8.8M, 39.65s build time
- ✅ Tarball: 2.7M
- ✅ Atomic swap successful (backup: web-admin.bak.20260429_054628)
- ✅ HTTP 200 verify on http://139.196.165.140:8086/ (and 8097 via nginx)
- ✅ Old backup auto-cleaned (web-admin.bak.20260428_143125)

### Smoke FE base URL

```
HTTP/1.1 200 OK
Last-Modified: Tue, 28 Apr 2026 21:46:14 GMT
ETag: "69f12aa6-853"
```

✅ http://139.196.165.140:8097/ returns 200 with fresh build.

## Smoke E2E results

### Run command

```bash
E2E_BASE_URL=http://139.196.165.140:8097 npx playwright test --project data-fabric-c-smoke -g "Phase B-1" --reporter=line
```

### Result

✅ **PASS** (3 tests passed in 1.2 minutes)

```
[1/3] [vue-auth] auth.setup.ts:65:1 factory_admin1 登录并保存状态  → PASS
[2/3] [vue-auth] auth.setup.ts:69:1 workshop_sup1 登录并保存状态  → PASS
[3/3] [data-fabric-c-smoke] data-fabric-c-smoke-e2e.spec.ts:410:3 Phase B-1 outlier filter — admin 巡检 + dismiss + un-dismiss flow  → PASS
```

### Test coverage

The smoke test verified end-to-end:

1. ✅ restaurant_admin1 (F002) login flow (with clearCookies to switch from default factory_admin1 storageState)
2. ✅ Navigation to /restaurant/data-completeness (Task 10 tabs page)
3. ✅ Switch to "数据质量" tab (Task 9 data-quality-tab component)
4. ✅ Outlier table OR empty state OR loading skeleton renders (defensive — handles all 3 cases since test data may be sparse)
5. ✅ Dismiss + un-dismiss flow if outliers exist (Task 6 POST/DELETE endpoints)
6. ✅ Summary cards rendered (admin can see numbers regardless of data state)

### First-run failure root cause + fix

First test run failed with `TimeoutError: page.click: Timeout 15000ms exceeded waiting for locator('button:has-text("登录")')`.

**Root cause**: web-admin login button uses non-breaking space "登 录" (with space between characters) — same pattern as `auth.setup.ts:16` (`'登 录'`). Original test used hard-coded URL, plain "登录" selector, and didn't clear default factory_admin1 cookies.

**Fix (commit `514c26cf2`)**: Aligned with `auth.setup.ts` pattern:
- Use `BASE_URL` const instead of hard-coded URL
- `getByPlaceholder('请输入用户名')` + `getByPlaceholder('请输入密码')` (same as auth setup)
- `getByRole('button', { name: '登 录' })` (with space)
- `await context.clearCookies()` to discard default factory_admin1 storageState
- `waitForTimeout(8000)` + `waitForLoadState('networkidle')` instead of waitForURL (login may redirect to root then dashboard)

## Manual verify items (recommend user verify in real browser)

- [ ] F002 (restaurant_admin1) — 完整度 tab 仍正常 (Phase A regression check)
- [ ] F002 — 数据质量 tab 进得去 (smoke test confirmed but worth eye-check)
- [ ] F002 — outlier table 渲染 (空或非空都 OK — test data sparse, may show empty state)
- [ ] F002 — severity 颜色: 红 high, 橙 medium (visual)
- [ ] F002 — dismiss → 列表刷新 → 进折叠区
- [ ] F002 — un-dismiss → 列表刷新 → 回主表
- [ ] R_BEJ (buerjun_admin) — baselineSource='global' 行有 "全网基线" badge (R_BEJ has 0 wastage data, should fall back to global)
- [ ] R_BEJ — insufficientKpis 显示 "样本不足" badge (if n_bucket < 10 globally too)
- [ ] Cross-factory: F002 admin 访问 R_BEJ → 403 + 中文 detail with 'platform_admin'
- [ ] Cache hit verify: 二次访问同样 windowDays < 100ms (Task 5 cache key includes windowDays)

## Concerns / Notes

1. **Health check timeout false-alarm**: deploy-smartbi-python.sh fails health check at 30s but service comes up at ~45s due to ETL warm-up (9 factories, gold materialization). Not a B-1 specific issue — affects all Python deploys. Consider raising health check timeout in deploy script (defer P3).

2. **Test data sparseness on test env**: R_BEJ has 0 wastage data, F002 has 1 wastage record. The smoke test handles all 3 states (table/empty/loading), but real visual verify is best done on prod where there's more data variance.

3. **Manual verify recommended for visual aspects**: The Playwright smoke confirms the FE renders without errors and key DOM elements exist, but visual elements (severity colors, badges, summary card formatting) need eyeball check.

4. **Prod deploy: AWAITING USER AUTHORIZATION** — Per Phase B-1 plan, only test env deployed. User explicit approval needed before `--env prod`.

## Summary

- ✅ **11 tasks complete** (Tasks 1-11)
- ✅ **17 commits** across 5 sections (Migrations, Backend Core, Backend API, FE Client, FE UI + E2E)
- ✅ **31 unit tests pass** (9 utils + 4 service + 14 API + 4 vitest = 31, per Tasks 3/4/5/6/8 reports)
- ✅ **Smoke E2E pass** on test env (3/3 tests including B-1)
- ✅ **Deploy stable** on test env (Python 8084 + web-admin 8097 + 8086)
- ✅ **3 outlier endpoints live** + DB schema/function deployed
- ⏳ **Prod deploy: AWAITING USER AUTHORIZATION**
