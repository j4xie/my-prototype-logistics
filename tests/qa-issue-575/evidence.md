# Issue #575 — T2-11 + T2-12 data depth verification

**Date:** 2026-05-14 (UTC), chat5 dispatch
**Branch:** `qa/issue-575-t2-11-12-depth`
**Base commit:** `b43a4742a` (origin/main)
**Target:** prod (F006 六膳门食品科技, factoryType=FACTORY) via Java prod 10010 reached through nginx 139:8086
**Tester account:** `f006_admin` (userId=1309, role=factory_super_admin)
**Method:** source-grep first (per HARD rule `feedback_grep_source_before_e2e_verdict`) → endpoint curl with real F006 prod JWT → aggregation replay → verdict.

---

## Summary

| Page | Route | Verdict | Reason |
|---|---|---|---|
| T2-11 工序投入产出 + 出成率 | `/production/process-io` | **PARTIAL** | UI wiring OK; 14 process tasks return with real `plannedQuantity` (投入) but all status=PENDING → `completedQuantity=0` → 产出 = 0 → 出成率 = 0% across all 7 processes. Not a UI bug; data-pipeline gap (F006 has no completed production work yet). |
| T2-12 SKU 毛利率分析 | `/finance/sku-margin` | **PARTIAL** | UI wiring OK; both primary path (AI intent `SKU_GROSS_MARGIN` tool `report_sku_gross_margin`) and fallback path (`/processing/batches?status=COMPLETED`) return 0 rows. F006 has 1 PLANNED batch + 0 completed → no margin data possible. Empty state renders silently (notice banner only shows when fallback finds ≥1 batch). |

**Both PARTIAL, same root cause.** F006 prod DB has 1 PLANNED production batch + 14 PENDING process tasks created 2026-05-09, **zero completed production output**. The Vue pages are wired correctly to real backend endpoints — they just have nothing to display until F006 completes some production work.

**Demo blocker level:** P2 confirmed. If the customer demo uses F006 as the demo tenant, both pages will appear empty. Mitigations in §Recommendations.

---

## Source grep evidence (Step 1)

### T2-11 route + endpoint

```
web-admin/src/router/index.ts:109     path: 'process-io',
                                      name: 'ProcessIOComparison',
                                      component: production/ProcessIOComparison.vue
```

`ProcessIOComparison.vue:104` calls:
```ts
const response = await get<{...}>(
  `/${factoryId.value}/process-tasks`, { params: { page: 1, size: 200, ... } }
);
```

Backing API: **`GET /api/mobile/{factoryId}/process-tasks?page=1&size=200`**

Client-side aggregation in `aggregateByProcess()` (lines 129-180):
- groups tasks by `processName`
- Input = sum of `plannedQuantity`
- Output = sum of `completedQuantity`
- 出成率 (yield rate) = Output / Input × 100

### T2-12 route + endpoint

```
web-admin/src/router/index.ts:437     path: 'sku-margin',
                                      name: 'FinanceSkuMargin',
                                      component: finance/sku-margin/index.vue
```

`finance/sku-margin/index.vue:179` (primary path):
```ts
const intentRes = await post<{...}>(
  `/${factoryId.value}/ai-intents/execute`,
  { userInput: '查询SKU毛利率排名' }
);
```

`finance/sku-margin/index.vue:259` (fallback path, called if intent returns no extractable data):
```ts
const response = await get<{...}>(
  `/${factoryId.value}/processing/batches`,
  { params: { page: 1, size: 200, status: 'COMPLETED', ... } }
);
```

**Important:** The fallback path explicitly does NOT compute cost/margin numbers (per R76 comment at index.vue:280-282 removing prior `Math.random()` fakery). If the primary AI intent path returns empty, the page shows either:
- empty + notice "找到 N 个产品但成本数据待接入" (only if ≥1 batch found)
- empty silent state (if 0 batches)

The dead code `loadSampleData()` (15 hardcoded restaurant dishes — 麻婆豆腐, 香辣蟹...) is unreachable from `loadData()`. Confirmed unused.

---

## Endpoint evidence (Step 2)

### Login

```http
POST http://139.196.165.140:8086/api/mobile/auth/unified-login
{"username":"f006_admin","password":"123456","deviceInfo":{...}}

HTTP 200
{ "userId":1309, "factoryId":"F006", "factoryName":"六膳门食品科技",
  "factoryType":"FACTORY", "role":"factory_super_admin", "token":"eyJ..." }
```

JWT captured. All subsequent calls use `Authorization: Bearer <token>`.

### T2-11: `GET /api/mobile/F006/process-tasks?page=1&size=200`

```
HTTP 200, 13027 bytes
data.totalElements = 14
data.content.length = 14
```

Replaying the Vue's `aggregateByProcess()` client-side aggregation:

| Process (processName) | Category | Tasks | totalInput (plannedQuantity) | totalOutput (completedQuantity) | 出成率 |
|---|---|---|---|---|---|
| 装框 | 包装 | 2 | 200.00 | 0.00 | 0.00% |
| 装盒 | 包装 | 2 | 200.00 | 0.00 | 0.00% |
| 煮制 | 加工 | 2 | 200.00 | 0.00 | 0.00% |
| 拌料 | 加工 | 2 | 200.00 | 0.00 | 0.00% |
| 腌制 | 加工 | 2 | 200.00 | 0.00 | 0.00% |
| 分割 | 前处理 | 2 | 200.00 | 0.00 | 0.00% |
| 解冻 | 前处理 | 2 | 200.00 | 0.00 | 0.00% |

(Process names mojibaked in console output but verified in raw JSON via UTF-8 decode — see `t2-11-process-tasks-raw.json` for source.)

- All 14 tasks have `status: PENDING`, `completedQuantity: 0.00`
- All 14 tasks point to a single product: "叮咚好食光卤猪蹄(去大骨) 200g"
- Created 2026-05-09 (5 days ago)

Customer expectation: "≥1 process row with non-empty 投入/产出/出成率 columns".
- 投入 (Input): **PASS** — 200.00 per row (7 rows)
- 产出 (Output): **FAIL** — 0.00 per row (real zero, not null; all PENDING)
- 出成率: **FAIL** — 0.00% per row (derived)

Verdict: **PARTIAL** (UI works, primary metric column populates, derivative metrics empty due to data state).

### T2-12 primary path attempt 1: AI intent without forceExecute

```http
POST /api/mobile/F006/ai-intents/execute
{"userInput":"查询SKU毛利率排名"}
```
```
HTTP 200, 2003 bytes
intentRecognized=true, intentCode=SKU_GROSS_MARGIN
status=NEED_CLARIFICATION (confidence 65%)
suggestedActions=[SELECT_INTENT/REPHRASE/SHOW_INTENTS]
resultData=null
```

Primary path on first call doesn't return data — Vue would extract `null` → empty list → fall through to fallback. (Note: Vue page does NOT auto-retry with forceExecute; user has to manually pick clarification options.)

### T2-12 primary path attempt 2: forceExecute

```http
POST /api/mobile/F006/ai-intents/execute
{"userInput":"查询SKU毛利率排名","intentCode":"SKU_GROSS_MARGIN","forceExecute":true}
```
```
HTTP 200, 1096 bytes
status=SUCCESS
metadata.toolName=report_sku_gross_margin
resultData.data = { "totalProducts": 0, "skuMargins": [] }
```

Tool `report_sku_gross_margin` is wired and returns valid response shape, **but returns 0 products for F006**. This confirms backend computation works; the data input is the issue.

### T2-12 fallback path: completed batches

```http
GET /api/mobile/F006/processing/batches?page=1&size=200&status=COMPLETED
```
```
HTTP 200
data.totalElements = 0
data.content = []
```

### T2-12 sanity check: all batches (no status filter)

```http
GET /api/mobile/F006/processing/batches?page=1&size=20
```
```
HTTP 200
data.totalElements = 1
status breakdown = { "PLANNED": 1 }
```

F006 has exactly **1 batch in PLANNED status** — same product "叮咚好食光卤猪蹄(去大骨) 200g", `actualQuantity: null`, no `startTime`/`endTime`. Created 2026-05-09 in lockstep with the process tasks.

**Conclusion for T2-12:** AI intent tool wired correctly, fallback wired correctly, both return 0 because F006 has 1 PLANNED batch and 0 COMPLETED. Vue would show silent empty state (notice banner skipped because batch count is 0 and `productMap.size` would be `1` only if the un-completed batch happened to leak through, which it doesn't per the `status=COMPLETED` filter on the fallback query).

Verdict: **PARTIAL** (UI works, both code paths exercised correctly, no data to display until F006 has completed production output).

---

## Why both PARTIAL (vs PASS or FAIL)

- **NOT FAIL**: every endpoint responded 200, no 500/404, no auth/permission issues. Vue components render their normal states. Customer is not seeing a broken page.
- **NOT PASS**: customer's stated bar ("≥1 process row with non-empty 出成率", "≥1 SKU row with 销售收入/成本/毛利率 numbers") is not met. They will see all-zero / empty tables and reasonably conclude "analysis doesn't work".
- **PARTIAL** is the honest middle ground: pages do what they're built to do, but production data state makes them appear unusable.

---

## Filter functionality (T2-12)

Customer also wanted "filter by date/客户/产品 works".

- Vue page has date range + product filter dropdowns
- Date filter only applies to the **fallback path** (`startDate`/`endDate` query params on `/processing/batches`)
- Date filter is NOT plumbed through the **primary AI intent path** (which only sends `userInput`)
- Customer filter (`客户`) is not present in either request payload at all

This is a known design gap independent of data state: even if F006 had completed batches, the AI intent path would ignore date/customer filters. Worth a separate ticket if customer relies on filtering by date or customer.

---

## Recommendations

Filing in order of demo-blocker severity:

### Immediate (before any F006 customer demo)

1. **Backfill or simulate completed production output for F006.** Either (a) mark the 14 process tasks as COMPLETED with realistic `completedQuantity` matching their `plannedQuantity` (or 95%+ to make 出成率 look healthy), or (b) seed a few historical completed batches into `processing_batches` for F006. Without one of these, T2-11 and T2-12 both stay empty regardless of what we fix code-side.

2. **If demo is in days, switch demo tenant to F001 or another factory with historical data.** F006 is too new (data created 2026-05-09 = 5 days ago, no completion events yet).

### Short-term (next sprint, not demo-blocking)

3. **T2-12 design gap — date/customer filter through AI intent path.** Either pass filters to the AI intent payload (extending `IntentExecuteRequest`) or document that filters only apply to fallback view.

4. **T2-12 dead code — remove `loadSampleData()`.** 36 lines of unreachable code at `index.vue:298-334` listing hardcoded restaurant dishes (麻婆豆腐 etc.) — confusing for FACTORY-type tenant readers. Already preceded by R76 comment removing Math.random() fakery; the sample function should follow.

5. **Auto-retry with forceExecute on first NEED_CLARIFICATION.** The current Vue flow drops empty data when AI intent returns NEED_CLARIFICATION + suggestedActions. The `SKU_GROSS_MARGIN` intent at 65% confidence is close to threshold; either auto-forceExecute when top suggestion confidence ≥ 60%, or display the clarification dialog instead of silently falling back.

### Open question for Steve

6. **Should T2-11 + T2-12 verdict be flipped back to PASS** in the Coverage E2E iter-7 audit, with a footnote that data depth is dependent on tenant data state (PARTIAL for F006 due to no completed production, would be PASS for a tenant with completion data)? Or treat current state as a real PARTIAL and require the data backfill before lifting the audit gate?

---

## Files in this audit

- `t2-11-process-tasks-raw.json` — raw response from process-tasks endpoint (14 tasks)
- `t2-11-aggregated.json` — replay of client-side `aggregateByProcess()` (7 rows)
- `t2-12-ai-intent-raw.json` — primary AI intent call without forceExecute (NEED_CLARIFICATION)
- `t2-12-ai-intent-force.json` — forceExecute SKU_GROSS_MARGIN (SUCCESS but 0 products)
- `t2-12-batches-completed.json` — fallback path with status=COMPLETED (0 rows)
- `t2-12-batches-all.json` — sanity: all batches regardless of status (1 PLANNED only)
