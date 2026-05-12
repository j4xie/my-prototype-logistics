# BUG-R1B-01 Investigation — `/smart-bi/analysis/finance?analysisType=profit|cost` 404

**Date**: 2026-05-12
**Investigator**: organizer (off `origin/main` @ `a9eae5a4d0`)
**Worktree**: `C:/Users/Steve/cretas-fix-r1b-finance-profit-cost`
**Branch**: `fix/r1b-finance-profit-cost-routing`
**Triggered by**: PR #437 chat3 R1-B Vue UX smoke
**Severity**: **P1** — affects QA test env (139:8097) + internal prod web-admin (139:8086)

---

## §1 TL;DR

The chat3 hypothesis ("Python returns 501 stub for un-ported profit/cost") is **wrong**.

**Actual root cause**: a 2-layer routing gap.

1. **Java side**: `SmartBIAnalysisController.getFinanceAnalysis()` was deleted in **T6.5 Phase A → Phase C** (PR #205 410-stubbed, PR #236 deleted, May 9). The Java controller now only has `/analysis/production` and `/analysis/quality` — no `/analysis/finance|sales|department|region|inventory|procurement`.
2. **Python side**: `analysis_finance.py:3315-3322` **DOES** handle `analysisType=profit` (PR #21/#22) AND `=cost` (PR #25). Python prod 8083 returns `HTTP 200` with real `GROSS_PROFIT=12,844,563.40` for F001 with `analysisType=profit`.
3. **Nginx test (139:8097) + internal web-admin prod (139:8086)** both have a catch-all `location /api/mobile/` → `cretas_backend{,_test}` (Java). Neither has the Python carve-out regex that `api.cretaceousfuture.com.conf` has at line 50. So Java handles the request → 404 (handler deleted).

**Customer-facing prod (`api.cretaceousfuture.com`) is NOT affected** — it has the cutover regex routing `/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)` to Python for 75 cutover factories. Bug surface is QA test env + internal web-admin vhost only.

**Recommended fix**: Option (d) — add the same regex to `web-admin.conf` (8086) and `web-admin-test.conf` (8097). ~5 lines of nginx config per vhost.

---

## §2 Evidence (Step A — runtime curl)

All curls run on server 47 (2026-05-12 15:56 CST) with a valid F001 token issued by Java prod 10010.

| Backend | URL | HTTP | Body excerpt |
|---|---|---|---|
| **Java prod 10010** | `localhost:10010/.../finance?analysisType=profit` | **404** | `{"code":404,"message":"请求的资源不存在",...}` |
| **Java test 10011** | `localhost:10011/.../finance?analysisType=profit` | 401 | (token issued by prod, test JWT secret differs — not relevant) |
| **Python prod 8083** | `localhost:8083/.../finance?analysisType=profit` | **200** | `{"code":200,"data":{"metrics":[{"metricCode":"GROSS_PROFIT","value":12844563.4,...}]}}` |
| **Python prod 8083** | `localhost:8083/.../finance?analysisType=cost` | **200** | `{"code":200,"data":{"trendChart":{"chartType":"BAR","data":[{"materialCost":0,"laborCost":0,"overheadCost":0,"totalCost":2980468.7}]}}}` |
| **Python test 8084** | (without auth) `.../finance?analysisType=profit` | 401 | `Missing Bearer token` — route exists, NOT 404 |

### Verification: Java controller no longer maps `/analysis/finance`

```
grep -n '@GetMapping' backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java
  80:    @GetMapping("/analysis/production")
 119:    @GetMapping("/analysis/quality")
 158:    @PostMapping("/query")
 198:    @PostMapping("/drill-down")
```

No `/analysis/finance|sales|department|region|inventory|procurement`. Confirmed deleted via T6.5 Phase A→C (PR #205 410-stub, PR #236 delete).

### Verification: nginx 8097 routes `/api/mobile/*` → Java only (no Python carve-out)

```
# /www/server/panel/vhost/nginx/web-admin-test.conf
location /api/mobile/ {
    proxy_pass http://cretas_backend_test/api/mobile/;
    ...
}
# NO `location ~ ^/api/mobile/.../smart-bi/analysis/(finance|sales|...)` block
```

Compare to customer-facing prod (`api.cretaceousfuture.com.conf:50`):
```
location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|...)|...)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
    proxy_pass http://cretas_python;
    ...
}
```

The cutover regex was added during T6.2/T6.3 (May 7-8) and finalized in T6.4 cascade (May 9, all 75 customer factories). **It was never propagated to `web-admin.conf` (8086) or `web-admin-test.conf` (8097)** — both internal-facing vhosts retained the legacy catch-all.

---

## §3 Step B — fix options evaluated

The original 3 options were premised on Python returning 501 for profit/cost. That premise is **falsified by Step A** (Python returns 200 with real data). Re-evaluating below.

| # | Option | Work | UX | Long-term | Verdict |
|---|---|---|---|---|---|
| (a) | Port profit/cost to Python | n/a | n/a | n/a | ⛔ **Moot** — Python already ships per-type handlers (PR #21/#22/#25). Nothing to port. |
| (b) | Vue caller switches to `composite` | ~2-4h | Lose metricCode-based KPI access; composite returns nested 6-key Map, Vue currently flat-maps `metrics[].metricCode='GROSS_PROFIT'` and `trendChart.data[].materialCost`. Significant rewrite + risk of data semantic drift. | Couples Vue to composite shape, hides per-type intent | ⚠️ Workable but expensive and unprincipled — Python `analysisType` contract is the canonical API |
| (c) | nginx route profit/cost to Python → "501 friendly stub" | 15min nginx | Shows "尚未 port" toast instead of 404 | Hides real bug, customers see broken page | ⛔ **Moot** — Python returns 200, not 501. Adopting (c)-as-stated would still show 200/real data, identical to (d) |
| **(d)** | **nginx add `smart-bi/analysis/(finance\|sales\|department\|region\|inventory\|procurement)` regex to web-admin.conf + web-admin-test.conf, proxy to Python** | **~15min nginx edit on server 139, no code change, no deploy** | Page renders real data immediately | Aligns internal vhosts with customer-facing prod gateway (already works there since May 9) | ✅ **Recommended** |

### Why (d) over (b)

- (d) restores parity with customer-facing prod — same routing logic everywhere.
- (d) is reversible in <1 min (nginx config swap-and-reload).
- (b) requires Vue rewrite, regression risk on the financial reports page, and would diverge Vue's data access pattern from the Python per-type API contract (which is the supported contract per PR #21/#22/#25 spec).
- Option (b) becomes attractive only if Steve decides to deprecate per-type endpoints in favor of composite-only — a Phase 2A scope decision, not a P1 hotfix.

---

## §4 Step C — proposed nginx patch (apply on server 139)

The vhost configs live at `/www/server/panel/vhost/nginx/` on server 139 — **not in git repo**. Patch must be applied via SSH. Two-step rollout: test env first (low blast radius), prod web-admin second (after smoke).

### 4.1 `web-admin-test.conf` (port 8097, **apply first**)

Insert **before** the catch-all `location /api/mobile/`:

```nginx
# Phase 2A SmartBI: route smart-bi/analysis/* for cutover factories to Python test 8084.
# Java handlers deleted in T6.5 Phase A→C (May 9, PR #205/#236). Mirror prod nginx
# api.cretaceousfuture.com.conf:50 factory regex.
location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
    proxy_pass http://47.100.235.168:8084;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 900s;
    client_max_body_size 500m;
}
```

### 4.2 `web-admin.conf` (port 8086, **apply after 4.1 smoke**)

Same regex, but `proxy_pass http://cretas_python;` (use existing upstream).

### 4.3 Apply + smoke commands

```bash
# Backup
ssh root@139.196.165.140 "cp /www/server/panel/vhost/nginx/web-admin-test.conf{,.bak.20260512_$(date +%H%M%S)}"

# Edit (use sed or scp the modified file)
# ... apply patch ...

# Test syntax
ssh root@139.196.165.140 "nginx -t"

# Reload (zero-downtime)
ssh root@139.196.165.140 "nginx -s reload"

# Smoke
TOKEN=<F001-test-env-token>
curl -s -w ' HTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  'http://139.196.165.140:8097/api/mobile/F001/smart-bi/analysis/finance?startDate=2026-04-12&endDate=2026-05-12&analysisType=profit' | head -c 200
# Expect: HTTP 200 with metrics[].metricCode=GROSS_PROFIT
```

Rollback: `cp /www/server/panel/vhost/nginx/web-admin-test.conf.bak.YYYYMMDD_HHMMSS /www/server/panel/vhost/nginx/web-admin-test.conf && nginx -s reload`.

---

## §5 Scope / sister sweep

Per `.claude/rules/concurrent-edit-safety.md` Rule "narrow scope sister sweep" — same gap likely affects **all 6 Phase 2A endpoints** (`sales/department/region/inventory/procurement` in addition to `finance`) on both web-admin vhosts (8086 + 8097). The proposed regex covers all 6 in one shot. Any Vue page calling those 6 endpoints from web-admin would hit the same 404.

**Likely affected Vue pages** (grep target for R3):
- `finance/reports/index.vue` (confirmed by chat3 R1-B)
- `analytics/smart-bi/AdvancedFinanceAnalysis.vue` (orphan, but calls 4 finance subroutes)
- Any other page hitting `/smart-bi/analysis/{sales,department,region,inventory,procurement}` directly

---

## §6 Open questions for Steve

1. **Apply nginx fix now?** Test env first (lowest risk), prod web-admin after smoke. I have not applied — nginx is shared infra, per "executing actions with care" defaults to confirm-before-act.
2. **Production cutover regex factory whitelist** — should the web-admin regex mirror api.cretaceousfuture.com (75-factory whitelist) OR simplify to `[^/]+` now that Phase 2A is 100% complete (per memory May 9)? Recommend: mirror, for symmetry + safety.
3. **Vue caller follow-up** — Vue at `finance/reports/index.vue:141-144` is fine as-is once nginx fix lands. No code change needed in this PR.

---

## §7 Files

| Path | Description |
|---|---|
| `docs/qa-audits/2026-05-12-r1b-1-finance-profit-cost-investigation.md` | This doc |

No code files changed in this PR — investigation only. nginx patch (§4) is the action item, to be applied on server 139 via SSH after Steve confirms.
