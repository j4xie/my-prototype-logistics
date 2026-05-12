# BUG-R1B-01 — Nginx Vhost Patch Apply Evidence

**Date**: 2026-05-12
**Worktree**: `C:/Users/Steve/cretas-r1b-nginx-apply`
**Branch**: `ops/r1b-1-nginx-internal-vhost-python-carveout`
**Triggered by**: PR #441 (option d, recommended fix from investigation)
**Action**: Applied §4.1 + §4.2 nginx patches on server 139 — internal web-admin vhosts now route Phase 2A SmartBI analysis endpoints to Python.

---

## §1 4-state acceptance matrix

| State | profit | cost | Verdict |
|---|---|---|---|
| **Test env 8097** (post-patch) | HTTP 200, `GROSS_PROFIT=12,844,563.40` | HTTP 200, `totalCost=2,980,468.70` | ✅ PASS |
| **Prod 8086** (post-patch) | HTTP 200, `GROSS_PROFIT=12,844,563.40` | HTTP 200, `totalCost=2,980,468.70` | ✅ PASS |
| **Prod 8086** (pre-patch baseline) | HTTP 404 `请求的资源不存在` | (skipped — same root cause) | ❌ confirmed bug pre-fix |
| **Customer-facing api** (post-patch) | HTTP 200, `GROSS_PROFIT=12,844,563.40` | HTTP 200, `totalCost=2,980,468.70` | ✅ unaffected |

**Regression checks on prod 8086** (after patch):

| Endpoint | HTTP | Verdict |
|---|---|---|
| `/smart-bi/analysis/sales` (Phase 2A, Python) | 200 | ✅ other Python routes still 200 |
| `/api/mobile/health` (Java catch-all) | 200 | ✅ Java catch-all still works |

Evidence files: `ops/nginx-vhosts-139/smoke-evidence-20260512/*.json`

---

## §2 Apply timeline

| Time (CST) | Action | Result |
|---|---|---|
| 23:47:03 | Backup both vhosts on 139 (`.bak.20260512_234703`) | OK |
| ~23:48 | scp patched `web-admin-test.conf` to `/tmp/`, mv into place | OK |
| ~23:48 | `nginx -t` then `nginx -s reload` | OK (only pre-existing ssl_stapling warn) |
| ~23:49 | Smoke 8097 profit + cost (F001 test admin token) | 200 / 200 |
| 23:50:35 | Baseline 8086 profit (PRE prod patch) | **404** (bug confirmed) |
| ~23:51 | Baseline `api.cretaceousfuture.com` profit (via `--resolve 139.196.165.140`) | **200** (healthy) |
| ~23:51 | scp patched `web-admin.conf`, mv, `nginx -t`, reload | OK |
| ~23:52 | Smoke 8086 profit/cost/sales/health | 200 / 200 / 200 / 200 |
| ~23:52 | Post-patch verify api.cretaceousfuture.com profit/cost | 200 / 200 (unaffected) |

Patch live: 2026-05-12 ~23:51 CST. Zero-downtime via nginx reload.

---

## §3 Same-cause sweep verdict (Rule 8 narrow-scope)

`ssh root@139.196.165.140 'ls /www/server/panel/vhost/nginx/*.conf'` enumerates 20 vhost configs. Per-vhost verdict:

| Vhost | Listen | Has `/api/mobile/` → Java catch-all | Python carve-out exists | Verdict |
|---|---|---|---|---|
| `web-admin-test.conf` | 8097 | yes (line 130) | **PATCHED THIS PR** | ✅ FIX |
| `web-admin.conf` | 8086 | yes (line 115) | **PATCHED THIS PR** | ✅ FIX |
| `api.cretaceousfuture.com.conf` | 443 ssl | yes (line 50 with regex carve-out) | yes (3 carve-out blocks: alerts/analysis/datasource) | ✅ already correct (customer-facing prod) |
| **`admin.cretaceousfuture.com.conf`** | **443 ssl** | **yes (line 126)** | **NO** | ⚠️ **SWEEP FINDING — likely bug, out of this PR scope** |
| `www.cretaceousfuture.com.conf` | 80 + 443 ssl | yes (line 68, but with custom SSE-style headers — proxy_buffering off, chunked) | NO | ⚠️ Public showcase domain. Investigate use before patching: does it serve real `/smart-bi/analysis/*` traffic? If customer-facing, same sweep finding. If only marketing site, out of scope. |
| `0.default.conf` | 80 | no (prototype paths only) | n/a | out of scope |
| `aiassist.cretaceousfuture.com.conf` | 443 ssl | no (only `/api/food-kb/`) | n/a | out of scope |
| `_bluegreen_poc.conf` | 8099 | no (POC) | n/a | out of scope |
| `client-request.conf` | 8087 | no | n/a | out of scope |
| `java_logistics-admin.conf` | 443 ssl | no (mall `/weixin/api/`) | n/a | out of scope (Mall) |
| `mall_admin.conf` | 8081 | no (`/prod-api/`) | n/a | out of scope (Mall) |
| `phpfpm_status.conf` | 80 (127.0.0.1) | no | n/a | out of scope (PHP stats) |
| `prototype.conf` | 8088 | no | n/a | out of scope |
| `_upstream_*.conf` | upstream defs | n/a | n/a | upstream pool defs only |
| `0.{websocket,site_total_log_format}.conf` | shared snippets | n/a | n/a | out of scope |
| `waf2monitor_data.conf` | WAF | n/a | n/a | out of scope |

### ⚠️ Critical sweep finding: `admin.cretaceousfuture.com.conf`

Port 443 HTTPS on `admin.cretaceousfuture.com` proxies `/api/mobile/` → `cretas_backend` (Java prod 10010) with NO Python carve-out. Same root cause as the 2 vhosts patched here. **Any customer accessing the admin UI over HTTPS (vs internal `:8086`) hits the same 404 on the 6 Phase 2A SmartBI analysis endpoints.**

This is **out of MO scope** (MO listed 2 internal vhosts only). Flagging to organizer for follow-up dispatch:

- Quickest fix: copy `web-admin.conf` carve-out block into `admin.cretaceousfuture.com.conf` (same upstream `cretas_python`).
- Caveat: this vhost has multiple custom locations (`/api/admin/`, `/api/platform/`, `/api/smartbi/`, `/smartbi-api/`) — need to verify insertion point doesn't shadow the SSE streaming regex at line 35.

### Note: `www.cretaceousfuture.com.conf`

Public showcase domain. Has `/api/mobile/` proxy but with SSE-friendly custom headers. Need product clarification whether www serves real factory user traffic OR only marketing/demo content. If the former, same sweep candidate. If the latter, out of scope.

---

## §4 Rollback

```bash
ssh root@139.196.165.140 'cp /www/server/panel/vhost/nginx/web-admin.conf.bak.20260512_234703 /www/server/panel/vhost/nginx/web-admin.conf && cp /www/server/panel/vhost/nginx/web-admin-test.conf.bak.20260512_234703 /www/server/panel/vhost/nginx/web-admin-test.conf && nginx -t && nginx -s reload'
```

Recovery time <1 min. Backups preserved on 139.

---

## §5 Files added in this PR

| Path | Description |
|---|---|
| `ops/nginx-vhosts-139/web-admin.conf` | Patched prod vhost (live on 139:8086) |
| `ops/nginx-vhosts-139/web-admin-test.conf` | Patched test vhost (live on 139:8097) |
| `ops/nginx-vhosts-139/web-admin.conf.original` | Pre-patch snapshot |
| `ops/nginx-vhosts-139/web-admin-test.conf.original` | Pre-patch snapshot |
| `ops/nginx-vhosts-139/README.md` | Drift policy + rollback |
| `ops/nginx-vhosts-139/smoke-evidence-20260512/*.json` | 8 curl response captures (baselines + post-patch) |
| `docs/qa-audits/2026-05-12-r1b-1-nginx-patch-apply-evidence.md` | This doc |

No application code changed.
