# Phase IIa SHIPPED — Acceptance Memo (2026-05-14)

**Status**: ✅ **PROD LIVE** as of 2026-05-15T04:31 CST (web-admin deploy completed).

This memo closes out the Phase IIa restaurant analytics 8-step deploy chain (per spec `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` §6.1) and records final evidence.

---

## What restaurant customers see now

Restaurant tenants logging into `admin.cretaceousfuture.com` (or `139.196.165.140:8086`) and navigating to `/smart-bi/sales` or `/smart-bi/finance` now see:

- **Restaurant-variant analytics page** (title "销售分析（餐饮）" / "财务分析（餐饮·营收概览）"), replacing the PR #608 "Phase II 建设中" placeholder
- **KPI strip** (总营收 / 总单数 / 客单价 / 在营门店)
- **Revenue trend charts** (ECharts via `DynamicChartRenderer`, monthly grain for finance, daily for sales)
- **Cross-link button** "导出可打印的 可比同比/环比报表 →" routing to Phase I `/smart-bi/revenue-report`
- **Phase IIb preview placeholder** (gated on accounting_import / wastage data availability)
- **Coverage warning banner** when data starts later than requested date range
- **Graceful empty-state** (per spec §4.5 edge case) for tenants with no Gold data

End-to-end smoke evidence (RES_3101_009 / qhj_prod / via prod nginx 8086):

```
HTTP 200, tenantType: RESTAURANT
totalRevenue: ¥14,475,222.37 (12-month range default for finance)
billCount: 96,961
avgPerCapita: ¥91.07
storeCount: 7
revenueTrend.xAxis: 8 months (May-Dec 2025)
productRanking len: 20 dishes (sales endpoint)
channelBreakdown len: 23 (sales endpoint)
```

---

## 8-step deploy chain — completion table

| Step | Action | Result | Timestamp (UTC) |
|---|---|---|---|
| 0 | PR-A backend code merged | PR #633 → main `b9716455d` | 19:25 |
| 1 | Python test 8084 deploy | health UP, smoke 200 | ~19:32 |
| 2 | Nginx test (`web-admin-test.conf`) reload | nginx -t OK, 8097 smoke 200 RESTAURANT | 19:37 |
| 3 | Test env smoke (3 endpoints) | shape matches spec §4.2/§4.3 | 19:38 |
| 4 | Python prod 8083 deploy | health UP `2026-05-15T03:44` | 19:44 |
| 5 | Nginx prod reload (`web-admin.conf` + `api.cretaceousfuture.com.conf`) | both vhosts updated, T6.6.3c block untouched | 19:48 |
| 6 | Prod smoke (RES_3101_009 rich data) | 200, ¥20.6M, 365 days, 20 dishes, 23 channels | 19:49 |
| 7 | PR-C nginx ops PR merged | PR #641 → main `a99266be4` | 19:53 |
| 7b | PR-B frontend code merged | PR #634 → main `5a028d7dc` | 20:24 |
| 8 | Web-admin prod deploy + headed Chrome demo | 372 assets atomic-swap, 4 screenshots captured | 20:30-20:32 |

Total elapsed: ~67 minutes from PR-A merge to final demo.

---

## PR cluster — 4 PRs landed today for Phase IIa

| PR | Title | Files | Merged |
|---|---|---|---|
| #633 | feat(smartbi): Phase IIa restaurant branch for /analysis/{sales,finance} | 4 files (+1574 / -9) | ✅ |
| #634 | feat(smart-bi): Phase IIa restaurant analytics UI for /smart-bi/{sales,finance} | 5 files (+1093 / -5) | ✅ |
| #641 | ops(nginx): Phase IIa restaurant routing for /analysis/(finance\|sales) | 1 runbook + 2 server config edits | ✅ |
| (this PR) | chore(phase-iia): close-out evidence + final demo regression spec | regression tool + memo | pending |

Plus 5 supporting PRs that landed earlier in the day (#593 #596 #608 #620 #625) and 2 CI cleanup PRs (#635 #639).

---

## Restaurant data state on prod (post deploys)

Per OQ-4 SQL run during Pre-II ETL Backfill (PR #625 acceptance memo) + this final verification:

| Chain | Gold coverage | Demo value |
|---|---|---|
| `RES_3101_009` (QHJ_PROD demo) | 1730 days / ¥20.6M / 8 stores / 23 channels | Happy-path screenshot 02 (¥14.4M visible in 12-month finance view) |
| `R_GML_DEMO` (桂满陇) | 132 stores × 1 day (2026-01-15) | — |
| `R_XMX_CHAIN` (唏嘛香) | 1 store × 1 day (2026-02-15) | — |
| 14× R_*_REAL chains | 0 rows (Bronze never uploaded) | Empty-state screenshot 03/04 (graceful UX) |

The 14 R_*_REAL chains remain customer-onboarding-blocked. Operations to drive POS upload onboarding (out of engineering scope). Once uploaded, `SMARTBI_ENABLE_SILVER_DUAL_WRITE=1` (set in prod) will auto-materialize Gold and they auto-join Phase IIa.

---

## Cross-chat parallel coordination — what worked

The 4-PR parallel fan-out (PR-A backend / PR-B frontend / PR-C nginx + this organizer chat) worked because:

1. **Single source of truth in marching orders** (PR #630) — each sister chat read the same spec sections (§4.2/§4.3 contracts, §5 UI, §6.1 deploy order) and didn't drift
2. **Spec contract was 4-cycle audited** (cycles 1+2+3+4 caught 30+ findings before dispatch) — sister chats didn't surface contract mismatches
3. **Deploy chain enforced by organizer** — frontend held in OPEN state until backend+nginx prod-green prevented placeholder-swap race window (§6.1 step 8 rule)
4. **Cross-tenant gate proved smoke (b) 403 was correct** — RBAC check returning 403 on tenant mismatch verified routing reached Python and middleware worked

What had friction (lessons for next phase):

1. **Parallel chat duplicate work** — organizer (me) shipped #637 not knowing chat-x had #635 in flight 5 min earlier. Per memory `feedback_concurrent_edit_safety.md` HARD: search `gh pr list --state open` BEFORE pushing similar-scope cleanup.
2. **Premature close-out of #637** — assumed #635 covered everything; missed that #635's vitest pinia fix was REVERTED. Re-pushed as #639 after PR-A audit caught it. Cost: ~25min round-trip.
3. **Java-vs-Python deploy confusion** — I ran `deploy-backend.sh` (Java) first by reflex; PR-A is Python-only. Re-deployed via `deploy-smartbi-python.sh`. Cost: ~15min wasted Java rebuild. Memory worth adding: organizer must read PR diff (`gh pr view --json files`) before picking deploy script.
4. **`actual_receive` NULL in test smartbi_db** — caught at smoke step. NOT code bug; ETL gap upstream. Confirms why prod data (where ETL completed properly) is needed for rich-data demo. Tracked as task #90 follow-up (COALESCE defensive pattern).
5. **Phase IIa-related canceled-axios toast** (4 screenshots all show red "加载XX数据失败: canceled" banner). Cause: rapid page navigation. Fix: `if (axios.isCancel(error)) return;` in catch blocks. Tracked as task #93. ~3 LOC fix.
6. **E2E PR Gate workflow 14d full red** (0/200 runs green since 2026-04-30). Repo-wide infra bug, NOT Phase IIa-specific. Backend health 90s timeout mismatch in `tests/v1-e2e/scripts/run-pr-gate.sh`. Tracked as task #88.

---

## Out of scope (Phase IIb / IIc tracking)

Per spec §3 phasing:

- **Phase IIb** (5-8d) — Wastage / requisition cost analytics. Gated on Steve OQ-2 decision (gate on real ops data or ship empty-state-graceful immediately).
- **Phase IIc** (2-4w) — Full P&L with cost breakdowns. Gated on Steve OQ-3 (cost data ingestion strategy: accounting upload / manual entry UI / defer indefinitely).

Phase IIa restaurant FinanceAnalysis.vue already surfaces "成本运营 (Phase IIb 预览)" placeholder with copy explaining Phase IIb will arrive. Customer-facing FAQ alignment to follow.

---

## Companion artifacts in this PR

- `web-admin/phase-iia-final-demo.spec.ts` — Playwright regression spec capturing the 4-screenshot demo (qhj_prod rich + qhj_admin empty). Re-runnable for any future Phase IIa regression check via `npx playwright test --project phase-iia-final-demo --headed`.
- `web-admin/playwright.config.ts` — adds `phase-iia-final-demo` project entry.

---

*Phase IIa shipped 2026-05-14 by collaborative organizer + 3-sister-chat fan-out. Backend Python + nginx config + Vue frontend all prod live. Restaurant tenants unblocked from PR #608 placeholder.*
