# Round 1 part 2 — SmartBI Vue page smoke (Rule 11 breadth coverage)

**Date**: 2026-05-13  
**Branch**: `qa/r1-vue-page-smoke`  
**Target**: `http://139.196.165.140:8086` (prod)  
**Account**: `f006_admin` / 123456 (F006 六腾门 prod seed)  
**Scope**: SmartBI Vue routes — 15 under `/smart-bi/*` (router/modules/smartbi.ts) + 3 under `/system/smartbi-config/*` (router/index.ts L647-L662) = **18 pages**.

## Coverage tally

| Source of truth                                        | Count | Tested | Coverage |
| ------------------------------------------------------ | ----- | ------ | -------- |
| `router/modules/smartbi.ts` children                   | 15    | 15     | 15/15    |
| `router/index.ts` `/system/smartbi-config/*` children  | 3     | 3      | 3/3      |
| **Routable SmartBI pages total**                       | **18**| **18** | **100%** |

`.vue` files under `web-admin/src/views/smart-bi/**` total ≈ 53, of which 35 are sub-components (Card / Dialog / Bar / Panel under `analysis/`, `components/chat/`, `components/chat/cards/`, `calibration/`) and are exercised indirectly through their parent route. L1 smoke is route-level only by spec §5 — no synthetic mounting of components in isolation.

## Per-page result

Legend: **PASS** = `.app-main` mounted, no redirect, body text > 50 chars, screenshot captured.

| # | Page | Route | Verdict | console.error | api ≥ 400 | Error toast | Note |
|--|------|-------|---------|--------------:|----------:|:-----------:|------|
| 1 | SmartBIDashboard | `/smart-bi/dashboard` | PASS | 2 | 1 | – | `/smartbi-api/api/smartbi/capability/F006` 503 — falls back to permissive mode (graceful) |
| 2 | SmartBIFinance | `/smart-bi/finance` | PASS | 2 | 1 | – | same `capability/F006` 503 fallback |
| 3 | SmartBISales | `/smart-bi/sales` | PASS | 0 | 0 | – | clean |
| 4 | SmartBIQuery | `/smart-bi/query` | PASS | 0 | 0 | – | clean |
| 5 | SmartBIQueryTemplates | `/smart-bi/query-templates` | PASS | 2 | 1 | **Y** | `/api/mobile/F006/smart-bi/query-templates` **404 — endpoint missing**, user-visible toast |
| 6 | SmartBIAnalysis | `/smart-bi/analysis` | PASS | 0 | 0 | – | clean |
| 7 | SmartBIExcelUpload | `/smart-bi/upload` | PASS | 0 | 0 | – | clean |
| 8 | SmartBIDataCompleteness | `/smart-bi/data-completeness` | PASS | 0 | 0 | – | clean |
| 9 | SmartBIFoodKBFeedback | `/smart-bi/food-kb-feedback` | PASS | 0 | 0 | – | clean |
| 10 | SmartBIFallbackLog | `/smart-bi/fallback-log` | PASS | 0 | 0 | – | clean |
| 11 | SmartBICalibration | `/smart-bi/calibration` | PASS | 3 | 2 | – | `/api/admin/calibration/statistics` & `/sessions` **404** — endpoints missing for F006 |
| 12 | FinancialDashboardPBI | `/smart-bi/financial-dashboard` | PASS | 0 | 0 | – | clean |
| 13 | SmartBIWhatIf | `/smart-bi/whatif` | PASS | 0 | 0 | – | clean |
| 14 | SmartBIRestaurantV2 | `/smart-bi/restaurant-v2` | PASS | 0 | 0 | – | clean |
| 15 | SmartBIGoldPreview | `/smart-bi/gold-preview` | PASS | 0 | 0 | – | clean |
| 16 | SmartBIConfig | `/system/smartbi-config` | PASS | 0 | 0 | – | clean |
| 17 | SmartBIDataSources | `/system/smartbi-config/data-sources` | PASS | 0 | 0 | – | clean |
| 18 | SmartBIChartTemplates | `/system/smartbi-config/chart-templates` | PASS | 0 | 0 | – | clean |

**Tally**: 18/18 rendered. 4 pages emit console.error noise; 4 pages have ≥1 API ≥400; 1 page shows a visible user-facing error toast.

## Findings (worth filing follow-up tickets — organizer decides)

### F1 — `query-templates` endpoint missing on prod / F006 (high)
- **URL**: `GET /api/mobile/F006/smart-bi/query-templates` → **404** `请求的接口不存在`
- **User-visible**: yes — Element Plus error toast `"加载模板失败"` is visible to f006_admin on every page load
- **Page**: `/smart-bi/query-templates`
- **Hypothesis**: Java/Python controller for this route either not deployed under F006 or never shipped. The frontend already routes the message through `request.ts` so it's not a frontend issue.
- **Evidence**: `screenshots/SmartBIQueryTemplates.png`; `round-1-vue-smoke.json[4]`.

### F2 — calibration admin endpoints 404 (medium)
- **URLs**:
  - `GET /api/admin/calibration/statistics?factoryId=F006` → **404**
  - `GET /api/admin/calibration/sessions?page=0&size=10&factoryId=F006` → **404**
- **User-visible**: no toast surfaced in this run, but the page renders empty stat tiles. Tracked in console as `"[失败] Error: 请求的资源不存在"`.
- **Page**: `/smart-bi/calibration`
- **Hypothesis**: admin-calibration controller path / RBAC mismatch — endpoint may be `/api/mobile/F006/calibration/...` per the F006 convention, or admin endpoints are not exposed to factory-scoped roles.
- **Evidence**: `screenshots/SmartBICalibration.png`; `round-1-vue-smoke.json[10]`.

### F3 — SmartBI capability probe 503 on Dashboard + Finance (low — graceful fallback)
- **URL**: `GET /smartbi-api/api/smartbi/capability/F006` → **503 Service Unavailable**
- **User-visible**: no — `useCapability.ts` catches and switches to permissive mode (`[capability] fetch failed, falling back to permissive mode`)
- **Pages**: `/smart-bi/dashboard`, `/smart-bi/finance`
- **Hypothesis**: smartbi-python service unhealthy or the `/smartbi-api/` nginx upstream is down. Same call pattern returns 503 on both pages so it is the upstream, not page-specific.
- **Evidence**: `screenshots/SmartBIDashboard.png`, `SmartBIFinance.png`; `round-1-vue-smoke.json[0,1]`.

## Method notes (spec §3.1 / Rule 7-8)

- **Render detect** uses `page.waitForSelector('.app-main', { state: 'visible' })` (Playwright MutationObserver), not `setTimeout`. Mount timeout 12s.
- **Toast detect** uses `page.locator('.el-message--error').first().isVisible()` after `networkidle` settles (event-driven).
- **Post-mount grace** of 800ms is the only timer — used only to let the toast enter-transition finish before sampling visibility. It is not an assertion gate; the assertion is the subsequent `isVisible()` call.
- **Login** caches `storageState` after a single password submit to respect the per-username 60s rate limit on `/api/auth/login`.
- **No writes**: only GET navigation. f006_admin is a prod account; no form submits, no POST/PUT/DELETE issued by the smoke script.
- **Noise filter** drops `favicon`, `ResizeObserver loop`, `chrome-extension://`, devtools banner. Everything else is preserved.

## Out of scope (deferred to L2+ or chat3)

- **L2 CRUD**: no form fills / submits. The MO scopes Round 1 to L1 smoke only.
- **Customer-facing UI** (#423/#413/#414): chat3 owns these.
- **Sub-components** under `smart-bi/analysis/`, `smart-bi/components/chat/cards/` — exercised through parent routes but no isolated component smoke (out of scope for L1).
- **App platform (RN Expo Web)**: this round is web-admin only.
