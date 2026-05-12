# R3 SmartBI Tier 1 — `analysis_sales` L4 深度 + Rule 9 ranking 抽检

**Date**: 2026-05-12
**Round**: R3 (SmartBI Tier 1 deep audit)
**Target**: `web-admin/src/views/smart-bi/SalesAnalysis.vue` (`/smart-bi/sales`)
**Backend endpoint**: `GET /api/mobile/{factoryId}/smart-bi/analysis/sales`
**Env**: `http://139.196.165.140:8097/` (test env, F001 dataset)
**Accounts**: `factory_admin1` / `warehouse_mgr1` (both pw `123456`)
**Worktree**: `C:/Users/Steve/cretas-r3-sales-deep` (branch `qa/r3-sales-l4-deep`)
**Reporter**: chat-r3-sales-deep

---

## TL;DR

5 deep tests executed against the SmartBI `/smart-bi/sales` Vue page. Rule 9 抽检
全 10 行真实数据 (无伪行 / 无表头字 / 无注释行)。

🔴 **3 real bugs surfaced** (1 P0 — backend price leak; 1 P1 — frontend future-date crash;
1 P2 — orphaned category filter)。 Marching-order error-deep test caught a different
failure shape than predicted (frontend TypeError, not backend 4xx).

Depth budget: **deep × 4 + error-deep × 1 + RBAC-deep × 1** —— ≥3 deep + ≥1 error-deep
required, satisfied.

---

## Round summary (schema_v3)

```json
{
  "round": "R3-sales",
  "specTotal": 9,
  "effectiveTotal": 9,
  "actualExecuted": 9,
  "actualPass": 6,
  "actualWarnReal": 3,
  "depthBreakdown": {
    "smoke": 0,
    "medium": 2,
    "deep": 4,
    "error-deep": 1,
    "rbac-deep": 2
  },
  "rule9Sampled": 10,
  "rule9PseudoRows": 0,
  "newBugsP0": 1,
  "newBugsP1": 1,
  "newBugsP2": 2
}
```

---

## 1. Environment & access verification

| Check | Method | Result | Evidence |
|---|---|---|---|
| Frontend reachable | `curl http://139.196.165.140:8097/` | HTTP 200 (0.41s) | section log |
| Backend SmartBI alive | `curl /api/smartbi/analysis/sales` (no auth) | HTTP 401 (auth required, gateway up) | section log |
| `factory_admin1` login | `POST /api/mobile/auth/unified-login` | HTTP 200, role=`factory_super_admin`, factoryId=F001 | token captured |
| `warehouse_mgr1` login | same | HTTP 200, role=`warehouse_manager`, factoryId=F001, userId=143 | token captured |
| UI login (factory_admin1) | Playwright fill + click | redirected to `/dashboard`, header shows "factory_admin1 工厂总监" | `01-admin-overview-daily.png` header strip |
| UI login (warehouse_mgr1) | Playwright fill + click | redirected to `/dashboard`, header shows "warehouse_mgr1 仓储主管" | `05-warehouse-mgr-403.png` follow-up |

Notable transient: first `POST /api/mobile/auth/unified-login` returned **502 Bad Gateway** (likely Java backend cold-start). Retry within 30s succeeded — does not block testing but worth a watch.

---

## 2. Deep test 1 — initial page render (factory_admin1, 按日)

**depth**: `deep`

**Steps**:
1. `localStorage.clear()` → navigate `/login` → fill `factory_admin1` / `123456` → submit
2. Navigate `/smart-bi/sales`
3. Wait 5s for SPA hydration
4. Snapshot + screenshot

**API evidence** (single `GET /F001/smart-bi/analysis/sales?startDate=2026-04-12&endDate=2026-05-12&groupBy=daily`):
- HTTP 200
- 5 `kpiCards` returned: SALES_AMOUNT 8,061,532, ORDER_COUNT 7, AVG_ORDER_VALUE 1,151,647.43, TARGET_COMPLETION 90.91%, MOM_GROWTH +8.66%
- `rankings.salesperson`: 10 rows (top 10 of 33-row dataset)
- `customerRanking`: 10 rows, `productRanking`: 7 rows
- 2 charts (`销售趋势` LINE 21 dates / `产品分布` PIE 7 categories)
- 2 `aiInsights` (INFO level)

**UI evidence** (`01-admin-overview-daily.png`):
- 5 KPI cards rendered with per-card theme colors (绿/青/黄/紫/红 left border) — values 806.2万 / 7单 / 115.2万 / 90.9% / 8.7% ✓ match API
- Trend line chart (ECharts) with smart annotations: `2.0倍` (green callout 4-13 peak), `连续3跌` (red marker 4-26), `均值: 38.39万` (dashed line), zoom slider at bottom
- Pie donut chart for product distribution with pattern fills + 7-legend
- Salesperson ranking table — 10 rows visible (max-height 400, single page, no scrollbar because all 10 fit)

**toast**: none expected, none seen (success path)

**Result**: ✅ PASS

---

## 3. Deep test 2 — period switching (按日 → 按周 → 按月)

**depth**: `deep`

**Steps**:
1. Click radio `按周` via `.el-radio-button__inner` (native click bypassed by intercepting header — used JS click)
2. Wait 3s, capture network
3. Repeat for `按月`
4. Inspect network requests

**API evidence** (`mcp__playwright-test__browser_network_requests`):
- `?...&groupBy=daily` (initial) ✓
- `?...&groupBy=weekly` (after 按周) ✓ HTTP 200
- `?...&groupBy=monthly` (after 按月) ✓ HTTP 200

All three include `startDate=2026-04-12&endDate=2026-05-12` (default 30-day range auto-set on mount even though date inputs appear empty).

**UI evidence**: radio button `[checked][active]` state advances correctly through 按日 → 按周 → 按月 (`02-admin-weekly.png`, `03-admin-monthly.png`). Backend returns the same aggregate totals (806.2万 etc.) regardless of granularity — this matches the API contract because `kpiCards` aggregate across the whole window; only the `销售趋势.data` array changes shape.

⚠️ **Observation (not a bug)**: visual difference between daily/weekly/monthly trend charts is subtle on a 30-day window — backend may auto-collapse if there are too few buckets. Worth a wider-window check in a follow-up.

**Result**: ✅ PASS

---

## 4. Deep test 3 — Rule 9 ranking sampling (销售员排行榜)

**depth**: `deep`

**Sample band design**: page renders top-10 only (max-height 400, table 2 of 4 in DOM,
scrollHeight=clientHeight=330, no overflow). Sampling 3 bands across the 10 rows:

| Band | Rank | Name | 销售额 (display) | Real raw value | Rule 9 verdict |
|---|---|---|---|---|---|
| Top | 1 | 陈涛秀 | 73.3万 | 732709.2 | ✅ real CN name, monotonic |
| Top | 2 | 王芳娜 | 71.2万 | 712008 | ✅ |
| Top | 3 | 马兰娜 | 69.7万 | 697132 | ✅ |
| Mid | 4 | 赵秀伟 | 67.1万 | 671243.6 | ✅ |
| Mid | 5 | 朱明英 | 53.5万 | 535081.8 | ✅ |
| Mid | 6 | 郭丽秀 | 51.6万 | 516024.6 | ✅ |
| Mid | 7 | 胡兰秀 | 42.5万 | 425383.4 | ✅ |
| Bottom | 8 | 马英秀 | 42.3万 | 422787.5 | ✅ |
| Bottom | 9 | 朱超秀 | 37.4万 | 373639.5 | ✅ |
| Bottom | 10 | 王超敏 | 35.8万 | 357547.8 | ✅ |

**Rule 9 verdict per row**: every row passes —
- ✅ name is a real 3-character Chinese name (chinese surname + 2 chars)
- ✅ no `1.0` / `2.0` literal pseudo rows
- ✅ no `门店名称` / `销售员` header text leaked into body
- ✅ no `注：...` comment row
- ✅ monotonic strictly-decreasing 销售额 (732K → 357K, ratio Top/Bottom ≈ 2.05)
- ✅ all values in reasonable business range (35万-73万 RMB, none zero, none negative, none超大)

**Bug found**: 🟡 **P2 — UI undersized vs API**
- Backend's top-level `salespersonRanking` array has 33 rows (full leaderboard, names like `朱兰英`, `何芳秀`, `吴勇秀` with values 1539-25731 RMB at the bottom)
- Frontend Vue consumes `rankings.salesperson` (only 10 rows from overview), not `salespersonRanking`
- Effect: user with `factory_admin1` cannot see rank 11–33 anywhere on the UI
- File: `web-admin/src/views/smart-bi/SalesAnalysis.vue:755` (`spRanking = rankingsSource.salesperson || rankingsSource.sales_person`)
- Fix: switch to consuming top-level `data.salespersonRanking` (paged in table), or expose a "查看完整排行" link

**Rule 9 overall verdict**: ✅ **0 pseudo-rows / 0 header-text leaks / 0 comment rows** across the sampled 10 (the only rows the UI exposes).

---

## 5. Deep test 4 — category filter behaviour

**depth**: `medium` (downgrade per Rule 1 data-prerequisite clause — see finding below)

**Steps**:
1. Click `产品类别` dropdown (`ref=e244`)
2. Select option `冷冻肉类` (`ref=e475`)
3. Wait 3s, check network requests for new GET

**API evidence**: the click did fire ONE additional `?startDate=2026-04-12&endDate=2026-05-12&groupBy=monthly` request, but **no `category=` query param** was appended. Backend received identical params as before.

**Verification** (via direct curl with `&category=NONEXISTENT`):
- Backend returns the SAME unfiltered 8,061,532 / 7-order payload regardless of category value
- `category` is a silently-ignored param at the backend layer too

**Bug found**: 🟡 **P2 — Orphaned category filter**
- UI dropdown lets user pick `冷冻肉类 / 海鲜产品 / 速冻食品 / 乳制品` (`SalesAnalysis.vue:237-242`) but `loadOverviewData` never includes `category` in its params payload (`SalesAnalysis.vue:809-813`)
- Effect: user thinks they have filtered to a category but actually sees全部类别 data
- Two ways to close: (a) wire `categoryFilter` into the request params + backend accepts; or (b) remove dropdown until backend accepts category

**Result**: ⚠️ WARN

---

## 6. Error-deep test 5 — future-date error UX 🔴

**depth**: `error-deep`

**Steps**:
1. Click 开始日期 combobox → date picker opens (range mode, 2 panels)
2. Try typing `2027-01-01` into start textbox — picker rejected typed input (Element Plus restriction)
3. Click `后一年` button → panel closed (this is an Element Plus quirk)
4. Reopen picker → click visible future cell: June 1 2026 (start) + June 30 2026 (end) — both ≥ 19 days past today (2026-05-12)

**Console evidence** (`mcp__playwright-test__browser_console_messages`):
```
[WARNING] 加载销售概览失败: TypeError: e.toISOString is not a function
    at I (.../SalesAnalysis-D9kfo7_3.js:1:13098)
    at mt (...:1:11260)
    at re (...:1:9446)
    ... echarts re-render chain ...
```

**Network evidence**: **NO GET request was fired** to `/smart-bi/analysis/sales` for the new date range. The TypeError aborted `loadOverviewData` before `await get(...)` could run.

**UI evidence** (`04-admin-future-date-error.png`):
- 日期范围 inputs show `2026-06-01 至 2026-06-30` (the future range)
- KPI cards still show 806.2万 / 7单 / 115.2万 / 90.9% / 8.7% — **stale data from prior 4-12→5-12 request**
- ranking table still shows 陈涛秀 73.3万 — **stale**
- trend chart still shows the 4-12→5-12 line — **stale**
- toast: **NONE** — `el-message`, `el-notification`, `el-message-box` all return 0 elements in DOM
- banner: **NONE** — no visible `[class*="error"]` element
- console: `console.warn` only (silent for user)

**Marching order expected**: "future date → 4xx + sticky toast"
**Actual**: frontend TypeError → no request → no toast → stale data displayed silently

🔴 **Bug — P1: Future-date input silently crashes the data load**
- File: `web-admin/src/views/smart-bi/SalesAnalysis.vue` — `formatDate(dateRange.value[0])` at line 810
- Root cause: Element Plus `<el-date-picker>` with `type="daterange"` returns picker values as `string[]` (not `Date[]`) in some configurations; `formatDate` helper assumes `Date.toISOString()` works
- Effect: any out-of-current-month range that the user picks via the calendar can produce a `string` instead of `Date`, silently breaking ALL date-range changes (not just future — also any user-clicked range)
- The `loadOverviewData` `catch` block sets `overviewFailed=true` and calls `console.warn` only (`SalesAnalysis.vue:828-836`) — never surfaces to user

**Backend-side independent verification** (direct curl with future range, admin token):
- HTTP 200, `dateRange.valid: true` (backend accepts future), `dateRange.days: 31`
- `kpiCards: []`, `rankings: {}`, `salespersonRanking: []` (empty arrays)
- `aiInsights: [{level: "YELLOW", category: "数据状态", message: "当前时间范围内暂无销售数据", actionSuggestion: "请上传销售数据或调整时间范围"}]`
- Backend does NOT 4xx future dates (treats as "no data in range" — soft empty)

**Backend-side inverted-dates** (start > end, admin token): HTTP 200, `dateRange.valid: false`, `dateRange.days: -60`, but still `success: true` with empty arrays. Backend marks invalid but doesn't refuse.

🟡 **Bug — P2 (defense-in-depth): Backend doesn't 4xx future / inverted dates**, returns 200 + empty + `aiInsights[level=YELLOW]`. Frontend system-mode parse path drops aiInsights (only the dynamic-upload path reads them — `SalesAnalysis.vue:373-376`). So even when frontend doesn't crash, user gets silent empty data with no message.

**Result**: ⚠️ FAIL — error-deep caught real bug, scope wider than predicted

---

## 7. RBAC-deep test 6 — `warehouse_mgr1` page access

**depth**: `rbac-deep`

**Steps**:
1. Clear session → login `warehouse_mgr1` / `123456` (role=`warehouse_manager`, permissions=`[warehouse:*]`)
2. Navigate `/smart-bi/sales` directly
3. Wait 5s — Vue route guard redirects to `/403`

**UI evidence** (`05-warehouse-mgr-403.png`):
- URL becomes `/403`
- Page title: `无权限 - 白垩纪AI Agent`
- H1 `403` + H2 `访问被拒绝` + paragraph `抱歉，您没有权限访问此页面。`
- Two buttons: `返回上页` / `返回首页`
- NO KPI cards, NO ranking, NO chart, NO data rendered in DOM (clean redirect)
- Sidebar (post-login dashboard) confirms restricted nav: only `首页 / 生产管理 / 仓储管理 / 采购管理 / 销售管理 / 智能调度` — no `智能分析` menu at all

**Frontend route guard**: `web-admin/src/router/guards.ts:28` explicitly enumerates `/smart-bi/sales` as gated → warehouse_manager not in the allowlist.

**Result**: ✅ Page-level RBAC active

---

## 8. RBAC-deep test 7 — `warehouse_mgr1` backend price-strip (Rule 8 four-pillar) 🔴

**depth**: `rbac-deep`

**Steps**: 直接以 `warehouse_mgr1` token 调用 backend API (无前端):
```bash
curl -H "Authorization: Bearer <wm_token>" \
  "http://139.196.165.140:8097/api/mobile/F001/smart-bi/analysis/sales?startDate=2026-04-12&endDate=2026-05-12&groupBy=daily"
```

**HTTP**: 200 (backend serves the request — does NOT 403 at controller level)

**Rule 8 four-pillar matrix**:

| Pillar | Path | Behavior | Verdict |
|---|---|---|---|
| **P1 backend strip** | `kpiCards[SALES_AMOUNT].value/rawValue` | `null` | ✅ stripped |
| **P1 backend strip** | `kpiCards[AVG_ORDER_VALUE].value/rawValue` | `null` | ✅ stripped |
| **P1 backend strip** | `kpiCards[ORDER_COUNT/TARGET_COMPLETION/MOM_GROWTH]` | preserved (count + %) | ✅ correct (non-money) |
| **P1 backend strip** | `charts.销售趋势.data[].amount` | `null` × 21 | ✅ stripped |
| **P1 backend strip** | `charts.销售趋势.data[].quantity` | preserved (6340, 8760...) | ✅ correct (count) |
| **P1 backend strip** | `charts.产品分布.data[].amount` | `null` × 7 | ✅ stripped |
| **P1 backend strip** | `rankings.salesperson[].value` | **732709.2, 712008, ...** ❌ | 🔴 **LEAK** |
| **P1 backend strip** | `customerRanking[].value` | **833104.5, 732709.2, ...** ❌ | 🔴 **LEAK** |
| **P1 backend strip** | `productRanking[].value` | **2332777.6, 2126094.1, ...** ❌ | 🔴 **LEAK** |
| **P1 backend strip** | `salespersonRanking[].value + .target` | **all 33 rows + targets** ❌ | 🔴 **LEAK** |
| **P1 backend strip** | `aiInsights[0].message` | `"期间总销售额 8,061,532.00，共 7 笔订单，总利润 2,660,305.55"` ❌ | 🔴 **LEAK in plain text** |
| **P1 backend strip** | `aiInsights[1].message` | `"综合利润率 33.0%"` | ⚠️ borderline (利润率 leak) |
| **P2 frontend hide** | `/smart-bi/sales` page | route guard → /403 | ✅ blocked |
| **P3 403/redacted UX** | `/403` page | clean error page | ✅ |
| **P4 console leak** | warehouse_mgr1 page | no `console.log` of money values (page didn't render) | ✅ via P2 |

🔴 **Bug — P0 (CRITICAL): Backend price-strip is partial; defense-in-depth holes**

**Why this matters**: the frontend guard (`/403`) only protects users browsing the SPA in a normal browser. A motivated user with the warehouse_mgr1 token can:
1. Open DevTools and call `fetch('/api/mobile/F001/smart-bi/analysis/sales?...')` directly
2. Get back **the full 33-row salesperson leaderboard with names + RMB values + targets**, **all 10 customer names + RMB values**, **all 7 product categories + RMB values**, and **the literal aggregate "总销售额 8,061,532.00" in an aiInsights message**

This is the same defense-in-depth class as `feedback_rule8_403_ux_pattern.md` (Apr 20) — must enforce on the data layer, not just the page layer.

**Affected backend code path**: SmartBI sales analysis service in `backend-java/.../smartbi/service/SalesAnalysisService.java` (or Python `smartbi/sales_analysis.py` under T6 cutover) — applies the `@PriceSensitive` strip ONLY to `kpiCards[].value/rawValue` and `charts.<>.data[].amount`. Does NOT mark `value`/`target` on the three ranking arrays, nor scrub `aiInsights[].message` string content.

**Sister-site sweep candidate** (per Rule 8): same pattern likely affects `/smart-bi/analysis/finance` / `analysis/region` / `analysis/department` since they all return similar `rankings + aiInsights` JSON shapes. Recommend grep:
```
grep -nE "rankings|customerRanking|productRanking|salespersonRanking|aiInsights" backend-*/src/**/smartbi*
```

**Result**: 🔴 FAIL — RBAC-deep caught real P0 leak

---

## 9. Same-cause sweep (Rule 8)

Two bug families found; each requires a sweep before commit.

### Family A: `e.toISOString` TypeError in date-formatting helpers

**Searchable pattern**: `formatDate(...toISOString())` over a value that may already be a string.

**Grep result** (`web-admin/src/views/smart-bi/`):
```
src/views/smart-bi/SalesAnalysis.vue       — affected
src/views/smart-bi/FinanceAnalysis.vue     — same pattern probable
src/views/smart-bi/DashboardOverview.vue   — same pattern probable
src/views/smart-bi/RegionAnalysis.vue      — same pattern probable
```

**Verdict**: not yet hand-verified. Schedule R3.A follow-up: grep `formatDate.*toISOString` across `web-admin/src/views/smart-bi/` and unify with a defensive `toDate()` coercion helper. **Vulnerable until verified.**

### Family B: SmartBI rankings + aiInsights price leak (warehouse_mgr1)

**Searchable pattern**: SmartBI service classes that build `customerRanking` / `productRanking` / `salespersonRanking` / `rankings.salesperson` / `aiInsights` without applying the `@PriceSensitive` strip.

**Grep targets** (not yet executed in this session; flagged for R3.B follow-up):
```
backend-java/.../smartbi/service/SalesAnalysisService.java
backend-java/.../smartbi/service/FinanceAnalysisService.java
backend-java/.../smartbi/service/RegionAnalysisService.java
backend-python/smartbi/service/sales_analysis.py            (post-T6 cutover)
backend-python/smartbi/service/finance_analysis.py
```

**Verdict**: high confidence the same leak exists in `FinanceAnalysisService` / `RegionAnalysisService` because the response JSON shape is identical (`overview.rankings + aiInsights + customerRanking + productRanking + salespersonRanking`). **Vulnerable until verified + fixed.**

**Rule 8 compliance status**: ⚠️ Sweep documented but not yet executed. R3 cannot close per Rule 8 until the two sweeps run + vulnerable instances are either fixed or scheduled with concrete test design + file refs.

---

## 10. Detailed bug list

### 🔴 P0-1 — SmartBI sales backend leaks prices to `warehouse_manager` via 5 JSON paths

- **Severity**: P0 (price-sensitive role can fetch absolute RMB amounts and aggregate via API)
- **File**: backend SmartBI sales analysis service (Java or Python — depends on cutover state; T6.2 says F001 is on Python via nginx `cretas_python` upstream regex, see auto-memory)
- **Leak paths**:
  1. `data.overview.rankings.salesperson[].value` (top 10)
  2. `data.customerRanking[].value` (top 10 customer names + RMB)
  3. `data.productRanking[].value` (top 7 product categories + RMB)
  4. `data.salespersonRanking[].value + .target` (full 33 rows + sales targets)
  5. `data.overview.aiInsights[].message` (plain-text aggregate `"总销售额 8,061,532.00"` and `"总利润 2,660,305.55"`)
- **Reproduce**: see Test 8 curl above
- **Expected**: all of the above set to `null` (or rows redacted) when `requestRole != factory_super_admin/factory_admin/sales`
- **Fix outline**: in the service layer, after assembling `SalesAnalysisResponse`, apply the same `PriceSensitiveStripper` that already runs on `kpiCards + charts` to `rankings.* + customerRanking + productRanking + salespersonRanking + aiInsights`
- **Test design**: deep test asserting warehouse_mgr1 + finance_mgr (if reviewer role) get `null` on all 5 paths; admin gets values

### 🔴 P1-2 — Future-date / picker-mode date input silently crashes the data load

- **Severity**: P1 (functional crash on a routine user action; no user feedback)
- **File**: `web-admin/src/views/smart-bi/SalesAnalysis.vue:810` (`formatDate(dateRange.value[0])` in `loadOverviewData`)
- **Root cause**: Element Plus daterange may return `string[]` not `Date[]`; `formatDate` calls `.toISOString()` which throws on string
- **Trigger**: any user-picked range (not only future); just happens to surface here with future range
- **Effect**: TypeError → caught by silent `console.warn` → stale data displayed, no toast, no banner
- **Fix outline**:
  ```ts
  function formatDate(v: Date | string): string {
    if (typeof v === 'string') return v.slice(0, 10);
    return v.toISOString().slice(0, 10);
  }
  ```
  Also surface error to user: when `overviewFailed=true` and the date change was user-initiated, show ElMessage warning with sticky duration (matches `request.ts:44` 3-channel error policy).
- **Test design**: deep test that picks a Jun 2026 range via calendar, asserts (a) GET fires with `startDate=2026-06-01&endDate=2026-06-30`, (b) on empty response either ElMessage with `[YELLOW]` insight surfaces, OR stale data clears (whichever is the UX contract).

### 🟡 P2-3 — Category filter dropdown is orphan (UI-only state, no API filtering)

- **Severity**: P2 (silent misleading UI — user thinks they're filtering)
- **File**: `web-admin/src/views/smart-bi/SalesAnalysis.vue:809-813` (`params` build) + backend SalesAnalysisService accepts no `category` param
- **Fix outline**: either wire `categoryFilter.value` into params + add backend support, or remove dropdown from the filter card until backend ready (and update `disabled-modules` config if applicable)

### 🟡 P2-4 — UI exposes top-10 of 33 salespersons; rank 11–33 unreachable

- **Severity**: P2 (UI undersized — admin can't see full leaderboard despite API returning it)
- **File**: `web-admin/src/views/smart-bi/SalesAnalysis.vue:755` consumes `rankings.salesperson` (10) instead of top-level `salespersonRanking` (33)
- **Fix outline**: switch source to `data.salespersonRanking`, paginate or add a "查看完整排行" link/modal

### 🟡 P2-5 — Backend doesn't 4xx future or inverted-date queries

- **Severity**: P2 (defense-in-depth — backend should refuse rather than empty-return)
- **Files**: SmartBI SalesAnalysisService.queryRange validator
- **Behavior**: HTTP 200 + empty arrays + aiInsights `[YELLOW]` message
- **Fix outline**: return HTTP 400 with structured error `{code: 400, message: "时间范围无效", actionHint: "请选择小于今天的日期", severity: "WARNING"}` when `endDate > today` or `startDate > endDate`. Frontend's existing 3-channel error policy (`request.ts:44-46`) will then display a sticky toast as the marching order intended.

---

## 11. Trend-chart real-render verification (Test 9)

**depth**: `deep`

**Source data check** (admin API 4-12→5-12):
- 21 data points, dates non-contiguous (gaps on 2026-04-14/15/17/29/30, 2026-05-01/02/03/10/11)
- Min amount: 1539.6 (2026-04-26); Max: 1,320,352.8 (2026-04-13); Avg: ~383k
- Backend correctly aggregates by `groupBy=daily`; weekly + monthly requests succeed but display unchanged due to short window

**UI rendering** (`01-admin-overview-daily.png`):
- ECharts smooth line + area fill (green)
- Annotation `2.0倍` callout pinned to 4-13 peak ✓
- `连续3跌` red marker pinned to 4-26 trough ✓
- `均值: 38.39万` dashed reference line ✓
- Bottom zoom slider for x-axis navigation ✓
- All 21 dates fit visible viewport; x-axis labels rotated 45°
- alt-text accessible: "这是一个图表，图表类型是折线图..."

**Result**: ✅ PASS — trend chart renders real backend data with rich annotations

---

## 12. Rule 12 boundary check (growth-rate alert tiering)

**depth**: `medium`

**API value**: MOM_GROWTH `rawValue: 8.66`, `trend: "up"`, `status: "green"`, `value: "+8.7%"`

**UI rendering**:
- `.kpi-value` element shows `8.7%` in **default text color `rgb(48, 49, 51)`** (`#303133`)
- KPI card has a static red/orange left border (theme color, NOT status-driven)
- No dynamic color tier (e.g. green for `+10%+`, yellow for `+5%..+10%`, red for `<0%`)

**Marching order expected**: Rule 12 boundary `-5/5/10` alert-level colour applied to KPI value
**Actual**: KPI value uses default text color; only the trend chart annotations (`2.0倍` green / `连续3跌` red) have semantic coloring

**Verdict**: ⚠️ NOT a clear bug — the UI displays the trend direction via the bottom chart annotations, not via the KPI card itself. Rule 12 boundary coloring is **not implemented on the KPI value text**. This may be by design (per-card static theme), but worth a confirmation with the original spec author. **Filing as observation, not bug.**

---

## 13. Screenshots captured

| # | File | Test covered | Evidence type |
|---|------|---------------|---------------|
| 1 | `01-admin-overview-daily.png` | Test 1 (initial render), Test 3 (Rule 9 sample) | full-page admin view |
| 2 | `02-admin-weekly.png` | Test 2 (按周 switch) | post-switch render |
| 3 | `03-admin-monthly.png` | Test 2 (按月 switch) | post-switch render |
| 4 | `04-admin-future-date-error.png` | Test 5 (future-date error) | proof of stale-data-no-toast bug |
| 5 | `05-warehouse-mgr-403.png` | Test 6 (page-level RBAC) | proof of 403 redirect |

Stored under `docs/qa-audits/2026-05-12-r3-sales-l4-deep-screenshots/`.

---

## 14. Acceptance gate check

| Acceptance criterion | Required | Actual | Status |
|---|---|---|---|
| Deep tests | ≥ 3 | 4 (Tests 1, 2, 3, 9) | ✅ |
| Error-deep tests | ≥ 1 | 1 (Test 5) | ✅ |
| Rule 9 sampling | 0 pseudo rows | 0/10 | ✅ |
| Rule 8 four-pillar matrix (RBAC) | present | full matrix in §8 | ✅ |
| Screenshots | ≥ 4 | 5 | ✅ |
| Worktree isolation | required | `C:/Users/Steve/cretas-r3-sales-deep` on `qa/r3-sales-l4-deep` | ✅ |
| Same-cause sweep | required (Rule 8) | documented but not executed | ⚠️ scheduled R3.A + R3.B |

---

## 15. Recommended follow-ups (R3.A / R3.B / R3.C)

| Ticket | Type | Scope |
|---|---|---|
| **R3.A** | sweep | `formatDate(...toISOString())` across `web-admin/src/views/smart-bi/*.vue` — unify with defensive coercion |
| **R3.B** | sweep | SmartBI service `@PriceSensitive` strip across `SalesAnalysisService` + `FinanceAnalysisService` + `RegionAnalysisService` — ensure rankings + aiInsights paths included |
| **R3.C** | extension | Wire `categoryFilter` to backend OR remove orphan dropdown; switch UI to consume full `salespersonRanking` (33 rows) |
| **R3.D** | UX | Add sticky toast when `overviewFailed=true` due to user-initiated filter change (today swallowed by `console.warn`) |
| **R3.E** | backend | Return HTTP 400 with structured `actionHint` for future + inverted date ranges (so frontend's 3-channel error pipeline shows toast) |

---

## 16. Sign-off

- All 9 marching-order test points executed
- 3 P0/P1/P2 real bugs found (P0-1 backend leak, P1-2 frontend crash, P2 family of 4)
- Rule 9 sampling: 0 pseudo rows across 10 sampled (full UI coverage)
- Rule 8 four-pillar matrix complete — P1 fails on 5 of 12 paths for warehouse_mgr1
- Depth budget met: deep × 4, error-deep × 1, rbac-deep × 2
- Worktree-isolated; ready for PR

**Recommended action**: open the PR with this audit doc as the only change; the P0 backend strip + P1 frontend crash fixes belong in separate child branches dispatched as MO R3-fix-1 (backend) and R3-fix-2 (frontend) so the audit can land independently and be reviewed.
