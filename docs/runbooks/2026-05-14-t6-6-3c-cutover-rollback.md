# T6.6.3c Full Cascade Cutover — Rollback Runbook

**Date applied**: 2026-05-13 (UTC 2026-05-13T19:36:45Z reload)
**Branch / PR**: `ops/t6-6-3c-full-cascade` / TBD
**Spec**: [`docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md`](../superpowers/specs/2026-05-11-t6-6-cutover-spec.md) §3.3 + §4.1
**Predecessors**: T6.6.3a [PR #526](https://github.com/j4xie/my-prototype-logistics/pull/526), T6.6.3b [PR #536](https://github.com/j4xie/my-prototype-logistics/pull/536)
**Operator**: chat2 (organizer-dispatched)

---

## What changed

Replaced the two explicit single-tenant location blocks (T6.6.3a for `R_ILTEATRO_REAL` and T6.6.3b for `R_QINGHUAJIAO_REAL`) with a single **broad prefix regex** that covers the entire restaurant-tenant universe for the two T6.6 endpoints:

```nginx
location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(production|quality)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
```

Applied to **both** vhosts on server 139:

- `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (port 443, customer mobile + external API)
- `/www/server/panel/vhost/nginx/web-admin.conf` (port 8086, internal direct-IP gateway)

Tenant-type heuristic by `factory_id` prefix:

- `R_*` — real restaurant chains and demos (R_ILTEATRO_REAL, R_QINGHUAJIAO_REAL, R_DONGMENKOU_REAL, R_GML_DEMO, R_XMX_*, R_YHDJ_DEMO, R_YJJ_DEMO, …)
- `RES_*` — restaurant test/staging factories (RES_3101_001..009, RES_GML_001, …)
- `R\d+` — legacy numeric restaurant IDs (R001, …)

Factory tenants (F* / FOOD_* / MEAT_* / OTHER_* / TEST_*) do NOT match — they fall through to the catch-all `location /api/mobile/` → Java upstream, unchanged.

Apply timestamp: `20260514_033550` (UTC 2026-05-13T19:35:50Z)
Reload time: 2026-05-13T19:36:45Z
nginx -t: PASS (pre-existing ssl_stapling warn on centerapi cert, unrelated).

---

## Rollback trigger conditions

Roll back immediately on any one of:

| Metric | Threshold | Window | How to detect |
|---|---|---|---|
| 5xx rate on `R_*|RES_*|R\d+` `/analysis/(production|quality)` | > 2% | 5 min | grep `analysis/(production|quality)` in `/www/wwwlogs/api.cretaceousfuture.com.log` for ` 5\d\d ` status |
| Python `NotImplementedError` for any restaurant tenant | any | any | `grep NotImplementedError /www/wwwroot/cretas/python-prod.log` |
| Latency P99 > 3000ms on the two endpoints | sustained | 5 min | nginx upstream timing |
| User-reported critical bug from any newly-covered tenant | severity ≥ P1 | any | bug tracker / direct ping |

Java fallback rate is NOT a rollback trigger — by design only restaurant tenants are routed to Python; factory traffic continues to hit Java as before.

---

## Rollback procedure (~35-45s recovery)

```bash
ssh root@139.196.165.140

TS=$(ls -1t /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3c.* | head -1 | sed 's/.*\.t6-6-3c\.//')
echo "Restoring T6.6.3c backups from $TS"

cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3c.$TS \
   /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
cp /www/server/panel/vhost/nginx/web-admin.conf.bak.t6-6-3c.$TS \
   /www/server/panel/vhost/nginx/web-admin.conf

nginx -t && nginx -s reload
```

After rollback:

- `R_ILTEATRO_REAL/analysis/(production|quality)` → Python (3a explicit block restored)
- `R_QINGHUAJIAO_REAL/analysis/(production|quality)` → Python (3b explicit block restored)
- All other restaurants → Java (regressed back from 3c coverage)
- F006 / factory tenants → Java (unchanged)
- Other Phase 2A routes → unchanged

The 3c backup files contain the **post-3b** state — i.e. both 3a and 3b explicit single-tenant blocks. Restoring them brings the system back to the canary stage.

---

## Audit trail

| When | Who | Action | Evidence |
|---|---|---|---|
| 2026-05-13T19:35:50Z | chat2 | Stage T6.6.3c on api + web-admin (nginx -t PASS, no reload) | apply script output, backups `*.bak.t6-6-3c.20260514_033550` |
| 2026-05-13T19:36:45Z | chat2 (per Steve GO) | `nginx -s reload` — T6.6.3c full cascade LIVE | `tests/qa-t6-6-3c/tenant-sample-matrix.md` |
| 2026-05-13T19:37:05Z | chat2 | Active-E2E 14 restaurant probes + 2 factory regressions + 2 finance refs (all PASS) | `tests/qa-t6-6-3c/tenant-sample-matrix.md`, `factory-no-regression.txt` |
| 2026-05-13T19:38Z | chat2 | Authenticated smoke (qhj_prod → RES_3101_009 production+quality) HTTP 200 | `tests/qa-t6-6-3c/tenant-sample-matrix.md` |
| 2026-05-13 | chat2 | Web-admin UI smoke deferred — current SPA does not call `/analysis/(production|quality)` (verified by grep) | `tests/qa-t6-6-3c/tenant-sample-matrix.md` |

---

## Related artifacts

- **Issue #530** — Python `/analysis/production` + `/analysis/quality` 401 envelope parity gap (96 B vs 188 B). P2, non-blocking. The authenticated 200 response shape mirrors Java correctly; only the unauth 401 diverges.
- **T6.6.4 (separate PR pending)** — `X-SmartBI-Deprecated` header on the Java fallback path. Scheduled after ~24 h soak per spec §3.4.
- **`admin.cretaceousfuture.com.conf`** — known pre-existing Phase 2A gap (does not contain the T6.6 cutover regex). Separate ticket; out of scope.
- **Phase 2D** — factory-tenant Silver schema (when shipped, factory tenants will gain Python `/analysis/(production|quality)` handlers and a corresponding nginx regex extension).
