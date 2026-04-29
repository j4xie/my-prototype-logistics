# Real-Window QA Plan — 2026-04-23 Session Prod Deliverables

**Purpose**: Verify all 2026-04-23 prod deploys against **qa-prompt v2.3** (full 8-point self-check + depth tags + MutationObserver toasts + 4-in-1 error check + Rule 9 business-semantics spot check).

**Scope**: user-visible prod changes from 6 commits today. Python background task + server systemd changes verified via logs, not UI.

**Test environment**: **prod** `https://admin.cretaceousfuture.com` — **not** test vhost. These are live prod changes; we verify the user's actual experience. No deploy actions during QA.

---

## Playwright Isolation (HARD RULE — 2 other chats are using Playwright concurrently)

Each test script in this plan MUST:

1. **Fresh `chromium.launch()`** (not `connectOverCDP`, not persistent context). Every run spawns a new isolated Chromium process with an ephemeral profile.
2. **No shared `userDataDir`**. Default behaviour of `chromium.launch({ headless: true })` creates a temp dir; leave it that way. Never pass `userDataDir` that points at any real Chrome profile.
3. **Unique debug port** auto-picked (`--remote-debugging-port=0`). Do not hard-code `9222` or `9223`.
4. **Do not use Playwright MCP tools** (`browser_click`, `browser_snapshot`, `browser_run_code`, etc.) — those share the MCP server's Chrome profile with other chats. Use standalone Node scripts invoking `playwright` directly via `import { chromium } from 'playwright'`.
5. **Headless: true** for all runs by default. If inspection needs the window open, temporarily flip to `headless: false` but accept that multiple visible windows may appear alongside other chats' tests.
6. **No MCP `playwright-rn` / `playwright-test` / `plugin_playwright` tools** in this plan — all via Node scripts.

Example scaffold (already the pattern used in `tests/e2e-comprehensive/`):

```javascript
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });   // fresh ephemeral profile
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
// ... test steps
await browser.close();
```

Existing scripts from today (`v1.1-gold-kpi-smoke.mjs`, `v1.2-trends-gold-smoke.mjs`, `v1.2-sales-orders-gold-smoke.mjs`, `v1.1-agent-insights-e2e.mjs`) all follow this pattern and are isolation-safe.

---

## Startup Actions (qa-prompt v2.3 step "起步动作" 7 items)

Before running any test:

1. [ ] **TaskList**: enumerate all test tasks below into TodoWrite with 3 phases (核对 / 执行 / 证据记录)
2. [ ] **Read this plan + qa-prompt v2.3** at `d:\xwechat_files\...\qa-prompt(2).txt` 353 lines
3. [ ] **List depth targets**: this plan targets `deep` on 3 new UI sections + `error-deep` on 1 write path (narrative_cache invalidation not UI-driven — skipped)
4. [ ] **TodoWrite** split into 核对→执行→证据 3-stage tasks per artifact
5. [ ] **Honesty check**: smoke vs deep — this plan calls out the depth per row below, don't inflate
6. [ ] **Error-path triggers enumerated** (section below) — at least 1 error-deep
7. [ ] **Task type**: 新功能 E2E — focus Rule 1-9. Not 发版前回归 (those checklist items are outside scope since v1.1/v1.2 Gold flip is new, not old-regression)

---

## Artifacts to Verify

| # | Artifact | Commit | Prod path | Depth target | Error trigger available? |
|---|---|---|---|---|---|
| 1 | RestaurantV2 Gold KPI strip | `6aeaa2ac3` | `/smart-bi/restaurant-v2` header | deep | No (read-only view) |
| 2 | Trends Gold POS revenue chart | `2a3ef3859` | `/analytics/trends` | deep | Yes — period switch + empty range |
| 3 | Sales orders POS summary card | `cdb600309` | `/sales/orders` | deep | Yes — manufacturing tenant (F001) should see NO card |
| 4 | Java `/executive/insights/custom` E2E | `7bf12b7e2` (Week 5, already verified) | Dashboard.vue:744 | smoke (re-verify) | No new risk this session |
| 5 | narrative_cache hourly pruner | `ee9a76a26` | Python server log | log-level | — |
| 6 | Green systemd unification | server-side | systemd daemon | config check | — |

---

## Per-Artifact Deep Test Specs

### Artifact 1: RestaurantV2 Gold KPI strip (deep)

**Script**: `tests/e2e-comprehensive/qa-v1.1-restaurant-v2-kpi-deep.mjs` (to create)

**Steps**:
1. Install MutationObserver on `document.body` to catch any toast
2. Login qhj_prod prod
3. Navigate `/smart-bi/restaurant-v2`
4. Wait for `.gold-kpi-card` visible
5. **Rule 5 console**: assert no `page.on('console', 'error')` red lines fired during load
6. **Rule 6 network**: confirm GET `/api/smartbi/gold/finance-summary?factory_id=RES_3101_009&...` returned 200
7. **Rule 7 UI text**: read 4 KPI labels: "总营收", "订单数", "客单价", "门店数" — match exact Chinese
8. **Rule 9 business spot check**: click "2025全年" shortcut → verify `totalRevenue=20,639,884.52` + `billCount=140,541` (from prod memory) + Top 5 stores show specific names (青花椒大丸百货店 etc., NOT placeholders like "门店1/2/3" or "1.0/2.0")
9. **Rule 9 mid/tail**: verify 5th store name is 青花椒南桥百联店 (specific real store), not a pseudo-row
10. Screenshot: `qa-v1.1-restaurant-v2-kpi-deep.png`

**Evidence to record**:
- API URL + status
- Top 5 store names (tuples of name + revenue + billCount)
- Toast log (expected: empty, no errors)
- Console errors (expected: 0)

### Artifact 2: Trends Gold POS revenue chart (deep + error-deep)

**Script**: `tests/e2e-comprehensive/qa-v1.2-trends-deep.mjs` (to create)

**Happy path (deep)**:
1. Login qhj_prod prod
2. Navigate `/analytics/trends`
3. Click "2025全年" shortcut
4. Wait for `.gold-trend-card` visible + `#gold-revenue-chart canvas`
5. **Rule 6**: GET `/gold/daily-trend?factory_id=RES_3101_009&start_date=2025-01-01&end_date=2025-12-31` = 200, `points.length === 365`
6. **Rule 9 business spot check on chart data**:
   - First point (2025-01-01): revenue > 0 and bill_count > 0
   - Mid point (~index 182, ~2025-07-01): revenue > 0
   - Last point (2025-12-31): revenue > 0
   - Random mid sample is NOT `avg_bill_value=null`
7. ECharts instance has 2 series (营收 + 订单数) — read via `echarts.getInstanceByDom`

**Error-path (error-deep)**:
1. Click "近7天" shortcut (today's range should be empty for qhj since data ends 2025)
2. Expected: `points === []`, card hides (`goldTrend=null` → v-show false)
3. Legacy CTA alert should appear for isEmptyAll && !goldTrend
4. **Rule 8 four-in-one**: this is not a 4xx error — it's legitimate empty data. So the check is: does the UI clearly indicate "empty"? Yes if the card hides and CTA shows.
5. **Rule 5 console**: no errors swallowed

**Evidence**:
- 3 sample points (first/mid/last) with actual revenue values
- Series count (2)
- Screenshot on 2025 range
- Network trace showing both period switches

### Artifact 3: Sales orders POS summary card (deep + error-deep)

**Script**: `tests/e2e-comprehensive/qa-v1.2-sales-orders-deep.mjs` (to create)

**Happy path (deep, qhj tenant)**:
1. Login qhj_prod → `/sales/orders`
2. Wait `.gold-pos-summary` visible
3. Read 4 stats — verify against spec values (¥20,639,884.52 / 140,541 / ¥146.86 / 8)
4. Read range label ("2025 全年" via fallback since YTD 2026 is empty)
5. **Rule 6 network**: 2 GET calls to finance-summary (YTD first → fallback 2025)
6. **Rule 7 UI**: title = "POS 交易概览", tag = "Gold · finance_summary"

**Manufacturing tenant test (critical negative-case — error-deep equivalent)**:
1. Logout, login as `factory_admin1` / F001 (manufacturing factory)
2. Navigate `/sales/orders`
3. Assert `.gold-pos-summary` is hidden (`v-show=false` because billCount=0 for F001)
4. Legacy orders table still renders (no regression)
5. **Rule 5**: no console error from the fallback logic

**Evidence**:
- Screenshot both tenants
- 2 network calls for qhj (YTD empty → 2025 non-empty)
- F001 screenshot with card absent + legacy table present

### Artifact 4: Java /executive/insights/custom (smoke re-verify)

Already verified earlier this session (10 AI insight DOM elements, Vue → Java → Python chain). Just confirm regression didn't break it.

**Script**: reuse `tests/e2e-comprehensive/v1.1-agent-insights-e2e.mjs` (already exists). Re-run on prod.

Evidence: request count ≥ 1, insight element count ≥ 1.

### Artifact 5: narrative_cache pruner (log check, not UI)

**Command** (not a browser test):
```bash
ssh root@47.100.235.168 "grep -E 'narrative_cache|pruner armed' /www/wwwroot/cretas/python-prod.log | tail -5"
```

Expected output contains `[startup] narrative_cache hourly pruner armed`.

Optionally verify first prune fires within 60-3660 seconds post-startup.

### Artifact 6: Green systemd unification (config check)

**Commands**:
```bash
ssh root@47.100.235.168 "systemctl show cretas-backend-green -p EnvironmentFiles,Environment | head -5"
ssh root@47.100.235.168 "diff <(sed -n '/^ExecStart=/,/^StandardOutput/p' /etc/systemd/system/cretas-backend.service) <(sed -n '/^ExecStart=/,/^StandardOutput/p' /etc/systemd/system/cretas-backend-green.service)"
```

Expected: `EnvironmentFiles=/www/wwwroot/cretas/.env.prod (ignore_errors=no)`, and diff shows only port/heap/log differences (no env var inline divergence).

---

## Error Triggers Enumeration (qa-prompt 起步 #6)

v1.1/v1.2 flip is largely read-only — **no POST/PUT paths added**. So true 4xx error-deep opportunities are limited to:

1. **Empty-range path (semi-error)** — Artifact 2 "近7天" empty. Not a 4xx but a legitimate empty response. Counts as data-boundary UX test.
2. **Manufacturing tenant negative case** — Artifact 3 F001 login. Card correctly hides. Counts as conditional-render test.

Since no write paths were added, **Rule 8 four-in-one toast check doesn't apply to this session's artifacts**. Document that clearly — don't fake an error-deep where none exists.

---

## What this plan does NOT cover (honest scope)

- Rule 10 (min-body API) — no new POST endpoints this session
- Rule 11 (read-after-write) — no write endpoints this session
- Rule 12 (list.vue 5-item checklist) — sales/orders/list.vue touched but not structurally modified; spot-check search + pagination continue to work
- Rule 13 (real-user shadow test) — out of scope, requires human user, schedule separately
- Rule 14 (version management) — no build-version injection change this session
- v2 unblocker specs — documentation only, no UI to QA
- narrative_cache pruner live tick — would require 60s+ wait; log-line presence is sufficient

---

## Execution Order (when you run this plan)

1. Run Artifact 6 (systemd diff) — fastest, no browser
2. Run Artifact 5 (log grep) — fast, no browser
3. Run Artifact 4 (re-verify insights) — existing script, minimal reuse
4. Run Artifact 1 (RestaurantV2) — new script
5. Run Artifact 2 (Trends) — new script, dual-scenario
6. Run Artifact 3 (Sales orders) — new script, dual-tenant, needs 2 logins

Total estimated time (headless): ~8 minutes end-to-end.

**Commit plan**: at the end, commit all new `qa-v1.*-*-deep.mjs` scripts under `tests/e2e-comprehensive/` with results JSON in `results/qa-2026-04-23/`.
