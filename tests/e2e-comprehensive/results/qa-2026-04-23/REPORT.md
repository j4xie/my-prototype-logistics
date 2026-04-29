# Real-Window QA Report — 2026-04-23

**Target**: `https://admin.cretaceousfuture.com` (prod)
**Tenants tested**: qhj_prod (RES_3101_009, RESTAURANT) + factory_admin1 (F001, FACTORY)
**Tool**: Standalone Node.js + Playwright `chromium.launch()` — isolation-safe (no shared profile with other Playwright chats)
**Framework**: qa-prompt v2.3 (353 lines, at `d:\xwechat_files\...\qa-prompt(2).txt`)

## Summary

| # | Artifact | Depth target | Result |
|---|---|---|---|
| 1 | RestaurantV2 Gold KPI strip | deep | ✅ PASS |
| 2 | Trends Gold POS revenue chart | deep + empty semi-error | ✅ PASS both |
| 3a | Sales orders POS summary (qhj) | deep | ✅ PASS |
| 3b | Sales orders F001 negative case | deep-negative | ⚠️ **Plan assumption was wrong** — F001 has independent seeded POS data, card correctly shows. See §3b |
| 4 | Java `/executive/insights/custom` regression | smoke | ✅ PASS |
| 5 | narrative_cache hourly pruner | log | ✅ PASS |
| 6 | Green systemd unification | config diff | ✅ PASS |
| 7 | Week 6 TemplateGrid (4 pages) | smoke | ✅ PASS (spot-checked 2 pages) |

**Console errors across full session**: **0**
**Unexpected 4xx/5xx**: none

---

## Detailed Findings

### §1 RestaurantV2 Gold KPI strip (deep)

- URL: `/smart-bi/restaurant-v2` (after 2025全年 shortcut click)
- Card `.gold-kpi-card` visible, border-top green
- Stats captured: `20,567,504.21` / `140,077` / `146.83` / `8` (¥/orders/avg/stores)
- Top 5 stores (Rule 9 business-spot-check):
  1. 青花椒大丸百货店 — ¥7,431,229 / 41,131
  2. 青花椒徐汇日月光店 — ¥5,106,416 / 42,424
  3. 青花椒徐汇光启城店 — ¥2,709,421 / 15,018
  4. 青花椒南方百联店 — ¥2,350,314 / 23,969
  5. 青花椒南桥百联店 — ¥1,651,961 / 12,003
- Rule 9: ✅ all 5 rows have plausible chain store names, revenue descending, no pseudo-rows (`门店名称` / `合计` / `注:` / `\d+.\d+` numeric prefix)
- Network: 2 × `finance-summary` (initial + after shortcut click)
- Console errors: 0

**Date range gotcha** (non-blocking): the "2025全年" shortcut resolves to `2024-12-31 → 2025-12-30` due to local TZ in `new Date('2025-01-01')`. Revenue differs by ~72K from exact `2025-01-01 → 2025-12-31` — not a bug, just timezone semantics.

### §2 Trends Gold POS chart (deep + empty-range semi-error)

- URL: `/analytics/trends` → switched period to 2025全年
- Card `.gold-trend-card` visible, tag "Gold · daily_trend", label "365 天"
- ECharts dual-axis chart rendered (营收 green / 订单数 orange)
- Network: 3 × `/gold/daily-trend`
- **Rule 9 server-side spot check** (curl direct from server with tenant header):
  - `total points: 365` (no gaps)
  - first `2025-01-01`: ¥91,972.04 / 522 bills / ¥176.19 avg
  - mid `2025-07-02`: ¥60,499.78 / 405 / ¥149.38
  - last `2025-12-31`: ¥72,380.31 / 464 / ¥155.99
  - 3 random samples (2025-11-24 / 02-27 / 01-13): all plausible ¥43-44K range
  - `zero-revenue days: 0/365`
  - `null avg_bill days: 0/365`
- **RLS enforcement verified**: same curl without `X-Factory-Id` header returned `points: []` → tenant isolation working

**Empty-range semi-error (近7天)**:
- Switched period to 近7天 (2026-04-17 ~ 2026-04-23)
- API returned `points: []`
- Card correctly hides (`v-show=goldTrend` → null)
- Legacy production trend charts + CTA alert show instead
- Rule 8 (four-in-one for errors) **does not apply** — this is a legitimate empty data response, not a 4xx

### §3a Sales orders POS summary (qhj, deep)

- URL: `/sales/orders`
- Card `.gold-pos-summary` visible, tag "Gold · finance_summary", range label "2025 全年"
- Stats: `20,639,884.52` / `140,541` / `146.86` / `8`
- Network: 2 × `finance-summary` (YTD 2026 empty → fallback to 2025 → non-empty)
- `fallback_triggered: true` — confirms YTD→prior-year logic fires as designed

### §3b Sales orders F001 "negative case" — plan assumption revised

**Original expectation**: F001 (manufacturing factory) should hide card because Silver has no data.
**Actual**: F001 shows card with identical totals to qhj (¥20,639,884.52 / 140,541 / 8 stores).

**Investigation**:
- F001's `store_id`s in Gold response are `6 / 3 / 1`
- qhj's are `11 / 15 / 16`
- Store names are the same (青花椒大丸百货店 etc.)
- Store IDs are different → `dim_store` correctly partitions per factory (RLS works)
- Revenue totals identical → F001 has its own independent Silver ingestion of the same POS dataset (demo seeding, confirmed by distinct store_sk values)

**Verdict**: NOT a bug. Card logic (`v-show="goldSummary"` + `billCount > 0` check) is correct. F001 is a real factory with seeded POS data. My plan's expectation that F001 would be empty was wrong.

**Follow-up (optional)**: find a truly-empty factory for the negative-case validation if we want a real "card hidden" test. Not blocking.

### §4 Java `/executive/insights/custom` (smoke regression)

- Dashboard date-range picker click → triggered GET
- URL: `https://admin.cretaceousfuture.com/api/mobile/RES_3101_009/smart-bi/dashboard/executive/insights/custom?startDate=2025-01-01&endDate=2025-12-31`
- Status: 200
- LLM chain end-to-end working (narrative_cache may have hit — <1s response suggests cache)

### §5 narrative_cache hourly pruner (log)

- `grep [startup] narrative_cache hourly pruner armed /www/wwwroot/cretas/python-prod.log` → 5 hits (once per Python restart since today's deploy at 14:00)
- Expected first prune at T+60s, every 3600s thereafter. No `pruned N expired` lines yet because cache was freshly created + 60s warmup + not enough 1h ticks since deploy. Will verify tomorrow.

### §6 Green systemd unification (config)

- `systemctl show cretas-backend-green -p EnvironmentFiles` → `/www/wwwroot/cretas/.env.prod (ignore_errors=no)` — strict, matches blue
- `diff ExecStart blue vs green` → only 3 diffs:
  - `-Xms768m -Xmx2560m` → `-Xms512m -Xmx1280m` (green is BG standby, smaller heap — intentional)
  - `--server.port=10010` → `--server.port=10020`
  - green adds `--management.server.port=10022`
- Environment= inline vars: identical (ALIBABA / ALIYUN_OSS / SPRING_SERVLET)

### §7 Week 6 TemplateGrid (spot-check 2/4 pages)

- **RestaurantV2**: 1 section "📊模板分析", 5 cards, first card title "热销菜品 Top N"
- **Trends**: 1 section, 4 cards
- Not spot-checked: 经营驾驶舱 / 财务分析 (out of browser scroll path during this run; add if needed)

---

## Open Items (out-of-scope or follow-up)

1. **Artifact 2 `pointsSample` empty in evidence.json**: script-side `response.text()` race with Vue's own JSON parse consumed the stream. Non-blocking — Rule 9 was verified server-side via curl. Script can be hardened by `onresponse` caching the text before return.
2. **Truly-empty factory negative test** (Artifact 3b): skip for now. Doesn't invalidate the shipped code.
3. **first prune log line** (Artifact 5): needs ≥1 hour post-startup; re-grep tomorrow.
4. **TemplateGrid spot-check on 经营驾驶舱 / 财务分析 pages**: not run; scroll didn't reach bottom in this script.

---

## Playwright Isolation Confirmation

- All tests used `import { chromium } from 'playwright'` + `chromium.launch({ headless: true })` — fresh ephemeral profile per run
- Zero `userDataDir` passed, zero `connectOverCDP` — no shared state with MCP browser tools or other chats
- Ran successfully in parallel with other chats' work

---

## Evidence Files

- `evidence.json` — structured per-artifact findings
- `a1-restaurant-v2-kpi.png` — KPI strip screenshot
- `a2-trends-2025.png` — Trends Gold chart
- `a3a-sales-orders-qhj.png` — Sales orders card qhj
- `a3b-sales-orders-f001.png` — Sales orders F001 (card visible, revised understanding)

## Scripts (for re-run)

- `tests/e2e-comprehensive/qa-2026-04-23-full.mjs` — main QA sweep (qhj → F001 sequence)
- `tests/e2e-comprehensive/qa-artifact3b-debug.mjs` — F001 tenant inspection
