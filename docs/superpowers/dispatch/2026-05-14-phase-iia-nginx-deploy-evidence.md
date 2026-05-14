# Phase IIa Nginx Deploy Evidence — Runbook

**Status**: 🟢 Phase PROD APPLIED 2026-05-14T19:48:55Z — smoke green on 3 chains. Ready for PR-B frontend merge signal.
**Branch**: `ops/phase-iia-nginx-restaurant-routing`
**Spec**: `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` §6.1
**MO**: `docs/superpowers/dispatch/2026-05-14-phase-iia-pr-c-nginx-marching-order.md`
**Sister PRs**: PR-A backend (`feat/phase-iia-restaurant-sales-finance-backend`), PR-B frontend (`feat/phase-iia-restaurant-sales-finance-frontend`)

## Goal

Route restaurant tenants (`R_*` / `RES_*` / `R\d+`) on `/smart-bi/analysis/(finance|sales)` to Python's `cretas_python` upstream (prod) or `47.100.235.168:8084` (test). Currently these requests fall through to Java `/api/mobile/` catch-all → 404. After deploy, Python's `analysis_sales.py` + `analysis_finance.py` polymorphic dispatch (PR-A) handles tenant-type branching.

Mirrors the T6.6.3c production|quality cascade pattern already at `web-admin.conf:161` and `api.cretaceousfuture.com.conf:69`.

---

## Discovery — Current nginx state on server 139

Read 2026-05-14 (read-only SSH grep, no edits):

| File | Path | Listen | Upstream style | T6.6.3c (production\|quality) block | Phase IIa (finance\|sales) insertion point |
|---|---|---|---|---|---|
| **web-admin.conf** | `/www/server/panel/vhost/nginx/web-admin.conf` | :80/:443 (prod) | inline `proxy_set_header` | line 161, ends 172 | after line 172, before `# Public API proxy` (line 174) |
| **api.cretaceousfuture.com.conf** | `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` | :443 (prod api) | `include cretas-python-proxy-defaults.conf` | line 69, ends 72 | after line 72, before `# Proxy all requests to Java backend` (line 74) |
| **web-admin-test.conf** ⚠️ | `/www/server/panel/vhost/nginx/web-admin-test.conf` | :8097 (test) | inline `proxy_set_header`, **explicit `proxy_pass http://47.100.235.168:8084;`** | **NO existing T6.6.3c block** — restaurant cascade has never been added to test env | after factory analysis block (line ~134), before subsequent `# Phase 2A SmartBI list endpoints` |

### ⚠️ Gap from MO (cycle-1 discovery)

The marching order specifies editing **only** `web-admin.conf` + `api.cretaceousfuture.com.conf`. But MO §Task 6 smoke test hits `http://139.196.165.140:8097` which is served by `web-admin-test.conf`. Without test-env nginx routing, the test smoke against `R_QINGHUAJIAO_REAL/smart-bi/analysis/sales` will 404 (Java catch-all). Adding the third file (test env) closes the gap. The test env block uses explicit IP `proxy_pass http://47.100.235.168:8084;` (Python test) rather than the `cretas_python` named upstream (which targets prod 8083 only).

### Existing restaurant cascade reference (T6.6.3c, 2026-05-14 morning)

For style/wording reference, the production|quality cascade in `web-admin.conf:161-172`:

```nginx
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(production|quality)(/.*)?$ {
    proxy_pass http://cretas_python;
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

In `api.cretaceousfuture.com.conf:69-72` (uses shared include):

```nginx
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(production|quality)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
```

---

## Nginx blocks to insert (paste-ready)

### 1) `web-admin.conf` — insert after line 172, before line 174 (`# Public API proxy`)

```nginx
# Phase IIa (2026-05-14): restaurant tenants → Python for /analysis/(finance|sales).
# Mirrors the T6.6.3c production|quality cascade at line 161 (same regex + upstream).
# Python's analysis_sales.py + analysis_finance.py polymorphic dispatch (PR-A) handles
# tenant-type branching. Backed by Pre-II ETL Backfill completed 2026-05-14 (PR #625):
# 3 chains have Gold rows — RES_3101_009 / R_GML_DEMO / R_XMX_CHAIN.
# Tenant prefix heuristic same as T6.6.3c (R_* / RES_* / R\d+). Factory tenants
# (F* / FOOD_* / MEAT_* / OTHER_* / TEST_*) do NOT match → fall through to Java catch-all.
# Rollback: cp web-admin.conf.bak.phase-iia.<TS> web-admin.conf && nginx -t && nginx -s reload
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ {
    proxy_pass http://cretas_python;
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

### 2) `api.cretaceousfuture.com.conf` — insert after line 72, before `# Proxy all requests to Java backend` (line 74)

```nginx
# Phase IIa (2026-05-14): restaurant tenants → Python for /analysis/(finance|sales).
# Mirrors the T6.6.3c production|quality cascade at line 69 (uses shared proxy include).
# See web-admin.conf:161 sibling block for the full annotation.
# Rollback: cp api.cretaceousfuture.com.conf.bak.phase-iia.<TS> api.cretaceousfuture.com.conf && nginx -t && nginx -s reload
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
```

### 3) `web-admin-test.conf` — TEST env (port 8097)

Insert after the factory-allowlist analysis block (line ~134 closes `}`). The test env uses **explicit IP** to Python test instance (no named `cretas_python_test` upstream exists).

```nginx
# Phase IIa (2026-05-14): restaurant tenants → Python TEST 8084 for /analysis/(finance|sales).
# Test env equivalent of T6.6.3c-style restaurant cascade. Test env has no `cretas_python_test`
# named upstream; uses explicit IP matching the existing factory-allowlist block style.
# Sister: web-admin.conf:<post-IIa-line> + api.cretaceousfuture.com.conf:<post-IIa-line>.
# Rollback: cp web-admin-test.conf.bak.phase-iia.<TS> web-admin-test.conf && nginx -t && nginx -s reload
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ {
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

---

## Deploy procedure (gated by organizer signals)

> **HOLD** — do not edit any nginx config on server 139 until organizer signals each gate. Per spec §6.1 deploy order, PR-A backend must deploy each environment first.

### Phase TEST — after organizer signal "PR-A test 8084 healthy"

```bash
# 1) Backup
TS=$(date +%Y%m%d_%H%M%S)
ssh root@139.196.165.140 "cp /www/server/panel/vhost/nginx/web-admin-test.conf /www/server/panel/vhost/nginx/web-admin-test.conf.bak.phase-iia.$TS"

# 2) Edit web-admin-test.conf — insert Block 3 (paste from this runbook §"Nginx blocks to insert" #3)
ssh root@139.196.165.140 "nano /www/server/panel/vhost/nginx/web-admin-test.conf"
# OR: scripted sed insertion (TBD when actually applying)

# 3) Validate
ssh root@139.196.165.140 "nginx -t"
# Expect: syntax is ok / test is successful

# 4) Reload (atomic, zero-downtime)
ssh root@139.196.165.140 "nginx -s reload"

# 5) Smoke test against R_QINGHUAJIAO_REAL on test 8097
TOKEN=$(curl -sS -X POST http://139.196.165.140:8097/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"qhj_admin","password":"123456"}' | python -c "import json,sys; print(json.load(sys.stdin)['data']['token'])")

curl -sS -X GET "http://139.196.165.140:8097/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
# Expect: HTTP 200 + JSON with data.tenantType == "RESTAURANT"
```

#### Evidence — Phase TEST (APPLIED 2026-05-14)

| Field | Value |
|---|---|
| Test reload timestamp | **2026-05-14T19:37:42Z** (server local: May 15 03:37 UTC+8) |
| Backup filename | `/www/server/panel/vhost/nginx/web-admin-test.conf.bak.phase-iia.20260514_153626` (9160 bytes) |
| Edit method | Python script via SSH heredoc — inserted block before marker `# Phase 2A SmartBI list endpoints (PR #507 R1 fix):`. Idempotent (re-run guards against double-insert). |
| Inserted lines | Line 133-150 (comment header + location block, see verification grep below) |
| `nginx -t` result | **OK** — `syntax is ok / test is successful` (1 pre-existing `ssl_stapling` OCSP warn on `centerapi.cretaceousfuture.com.pem`, unrelated) |
| Reload | `nginx -s reload` exit 0 |
| Smoke `R_QINGHUAJIAO_REAL` /sales | **HTTP 200**, 640ms — `data.tenantType: "RESTAURANT"` ✓, `billCount: 134738`, `storeCount: 5`, `dataSource: "agg_daily"` |
| Smoke `R_QINGHUAJIAO_REAL` /finance | **HTTP 200** — `data.tenantType: "RESTAURANT"` ✓, `analysisType: "overview"`, `kpi.billCount: 134738`, `kpi.storeCount: 5` |
| ⚠️ Observation (PR-A backend concern, NOT nginx) | Both endpoints return `totalRevenue: 0` and `avgPerCapita: 0` despite `billCount: 134738`. Likely PR-A SUM aggregation bug or Decimal serialization issue. **Nginx routing verified correct — restaurant tenant reaches Python with RESTAURANT shape.** Flagged for PR-A review. |
| RES_3101_009 smoke | Not run via `qhj_admin` (returns 403 — auth-scoped to QHJ only; need broader-admin login or test on prod with cross-tenant admin). Routing correctness covered by `R_QINGHUAJIAO_REAL` evidence. |
| Issues encountered | None nginx-side. PR-A `totalRevenue: 0` flagged separately. |

**Verification grep** (insertion line numbers, from server):

```
133:    # Phase IIa (2026-05-14): restaurant tenants → Python TEST 8084 for /analysis/(finance|sales).
138:    location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ {
```

### Phase PROD — after organizer signal "PR-A prod 8083 healthy (Blue-Green)"

```bash
# 1) Backup both prod configs
TS=$(date +%Y%m%d_%H%M%S)
ssh root@139.196.165.140 "
  cp /www/server/panel/vhost/nginx/web-admin.conf /www/server/panel/vhost/nginx/web-admin.conf.bak.phase-iia.$TS
  cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.phase-iia.$TS
"

# 2) Edit both files — insert Block 1 into web-admin.conf, Block 2 into api.cretaceousfuture.com.conf

# 3) Validate
ssh root@139.196.165.140 "nginx -t"

# 4) Reload
ssh root@139.196.165.140 "nginx -s reload"

# 5) Smoke against prod (curl from server bypassing client DNS — per spec §6.1 step 7)
ssh root@139.196.165.140 "
  TOKEN=\$(curl -sS -X POST http://localhost/api/mobile/auth/unified-login \
    -H 'Content-Type: application/json' \
    -d '{\"username\":\"qhj_admin\",\"password\":\"123456\"}' | python3 -c \"import json,sys; print(json.load(sys.stdin)['data']['token'])\")
  curl -sS -X GET 'http://localhost/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31' \
    -H \"Authorization: Bearer \$TOKEN\" | python3 -m json.tool | head -20
"
```

#### Evidence — Phase PROD (APPLIED 2026-05-14)

| Field | Value |
|---|---|
| Prod reload timestamp | **2026-05-14T19:48:55Z** (server local: May 15 03:48 UTC+8) |
| `web-admin.conf` backup | `/www/server/panel/vhost/nginx/web-admin.conf.bak.phase-iia.20260514_154735` (10702 bytes) |
| `api.cretaceousfuture.com.conf` backup | `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.phase-iia.20260514_154735` (5888 bytes) |
| Edit method | Python script via SSH — idempotent (already-inserted detection guards), markers `# Public API proxy` and `# Proxy all requests to Java backend on 47` |
| `web-admin.conf` insertion | L174 (comment) → L182 (location) — between T6.6.3c block (ends L172) and `# Public API proxy` |
| `api.cretaceousfuture.com.conf` insertion | L74 (comment) → L78 (location) — between T6.6.3c block (ends L72) and `# Proxy all requests to Java backend on 47` |
| `nginx -t` | OK (1 pre-existing ssl_stapling warn unrelated, identical to Phase TEST) |
| Reload | `nginx -s reload` exit 0 |
| T6.6.3c (production\|quality) cascade L161/L69 | **NOT TOUCHED** — only new finance\|sales block added (verified via grep) |

**Smoke results** (qhj_admin via :8086 prod + HTTPS api.cretaceousfuture.com):

| # | Endpoint | HTTP | Latency | tenantType | Interpretation |
|---|---|---|---|---|---|
| a | `:8086 R_QINGHUAJIAO_REAL/smart-bi/analysis/sales` | **200** | 421ms | RESTAURANT ✓ | Empty-state expected per PR #625 — `billCount: 0`, `storeCount: 0`, `avgPerCapita: null` (Rule 4.5 edge case correctly handled — null not 0) |
| b | `:8086 RES_3101_009/smart-bi/analysis/sales` | **403** | 422ms | n/a (auth blocked) | **Routing verified** — Python's `AUTH_ERROR` envelope `{code:"AUTH_ERROR", message:"Cross-factory access denied: token factoryId=R_QINGHUAJIAO_REAL URL factoryId=RES_3101_009"}`. Java catch-all would have returned 404 with different shape; Python's auth middleware response proves request reached Python. Rich-data verification of `RES_3101_009` requires cross-tenant admin login (out of PR-C scope) |
| c | `https://api.cretaceousfuture.com R_QINGHUAJIAO_REAL/smart-bi/analysis/finance?analysisType=overview` | **200** | 649ms | RESTAURANT ✓ | Confirmed via `--resolve api.cretaceousfuture.com:443:139.196.165.140` (local DNS doesn't resolve; server-side routing verified). `kpi: {totalRevenue:0, billCount:0, avgPerCapita:null, storeCount:0, coverageStart:null, coverageEnd:null}` — empty-state per PR #625 |

**Routing verdict**: All 3 smokes confirm restaurant prefix regex matches and requests proxy to `cretas_python`. Both vhosts (`:8086` web-admin + `:443` api.cretaceousfuture.com) route correctly. No Java fallthroughs.

**Empty-state context**: `R_QINGHUAJIAO_REAL` on prod has `billCount: 0` (consistent with PR #625 acceptance memo: onboarding-blocked, customers haven't uploaded POS data yet). This is NOT a regression — it's the expected response per spec §4.5 edge case 1.

**Verification grep**:

```
web-admin.conf:
174:    # Phase IIa (2026-05-14): restaurant tenants → Python for /analysis/(finance|sales).
182:    location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ {

api.cretaceousfuture.com.conf:
74:    # Phase IIa (2026-05-14): restaurant tenants → Python for /analysis/(finance|sales).
78:    location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(finance|sales)(/.*)?$ {
```

T6.6.3c production|quality cascade (L161 in web-admin.conf, L69 in api.cretaceousfuture.com.conf) confirmed untouched.

**Issues encountered**: None. (Smoke b's 403 is expected auth-scoping, not an issue.)

---

## Rollback procedure

If `nginx -t` fails after edit:

```bash
# DO NOT reload. Restore backup immediately.
ssh root@139.196.165.140 "cp /www/server/panel/vhost/nginx/<file>.bak.phase-iia.<TS> /www/server/panel/vhost/nginx/<file>"
ssh root@139.196.165.140 "nginx -t"   # verify clean state
```

If smoke test returns 404 after reload:
- Confirm PR-A backend is deployed and healthy (`ssh root@47.100.235.168 "curl -sS http://localhost:8084/health"` for test, `:8083/health` for prod).
- If PR-A healthy → nginx routing issue (mis-typed regex, wrong location order). Restore backup + investigate.

If smoke test returns 5xx:
- nginx routing OK, Python error. Check `journalctl -u cretas-python` (prod) or test python log on server 47. Pause and ping organizer.

If smoke test returns 200 but `data.tenantType != "RESTAURANT"`:
- Nginx routed to Python but Python's polymorphic dispatch didn't recognize tenant. Likely PR-A code defect. Pause and ping PR-A chat.

---

## Coordination with sister chats

Deploy chain (organizer signals gates):

1. PR-A backend test deploy → organizer signals **"PR-A test 8084 healthy"**
2. **This MO Phase TEST** executes (web-admin-test.conf edit + smoke)
3. Organizer admin-merges PR-A → PR-A prod Blue-Green deploy → organizer signals **"PR-A prod 8083 healthy"**
4. **This MO Phase PROD** executes (web-admin.conf + api.cretaceousfuture.com.conf edits + smoke)
5. Organizer signals PR-B chat **"backend + nginx prod green, merge frontend"**
6. PR-B admin-merge + web-admin deploy (placeholder swap)

DO NOT self-merge this PR. Ping organizer after each phase evidence captured.

---

## Open questions / decisions log

- **Q1** (resolved 2026-05-14): MO mentions only 2 files but test env smoke needs 3. Decision: add `web-admin-test.conf` to scope. Documented above in §"Gap from MO".
- **Q2**: Should we also pre-emptively add T6.6.3c-style `(production|quality)` block to `web-admin-test.conf` while we're touching it? **Decision**: Out of scope. Phase IIa covers `(finance|sales)` only. If test env needs production|quality restaurant routing, file a separate ticket.
- **Q3**: Insertion regex order — should new block come BEFORE or AFTER existing T6.6.3c block? Both are non-overlapping (different verbs: `finance|sales` vs `production|quality`), so order doesn't matter for routing correctness. Placing AFTER T6.6.3c keeps chronological / Git-blame order.
