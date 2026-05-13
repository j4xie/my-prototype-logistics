# T6.6.3b Canary Cutover — Rollback Runbook

**Date applied**: 2026-05-13 (UTC 2026-05-13T19:21:48Z reload)
**Branch / PR**: `ops/t6-6-3b-r-qhj-canary` / TBD
**Spec**: [`docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md`](../superpowers/specs/2026-05-11-t6-6-cutover-spec.md) §3.3 + §4.2
**Companion**: 3a runbook at [`2026-05-14-t6-6-3a-cutover-rollback.md`](2026-05-14-t6-6-3a-cutover-rollback.md)
**Operator**: chat2 (organizer-dispatched)

---

## What changed

Single tenant `R_QINGHUAJIAO_REAL` was added to the nginx routing whitelist for two endpoints:

- `/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/production(/...)` → cretas_python (47:8083)
- `/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/quality(/...)` → cretas_python (47:8083)

Applied to **both** vhosts:

- `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (customer mobile, 443)
- `/www/server/panel/vhost/nginx/web-admin.conf` (internal port 8086)

This is **additive** to 3a (R_ILTEATRO_REAL). Post-3b state has BOTH tenants on Python; all other tenants and other endpoints are **unchanged**.

---

## Rollback trigger conditions

Roll back immediately on any one of:

| Metric | Threshold | Window | How to detect |
|---|---|---|---|
| `R_QINGHUAJIAO_REAL` 5xx rate on the two new endpoints | > 2% | 5 min | grep `/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/(production|quality)` in `/www/wwwlogs/api.cretaceousfuture.com.log` for ` 5\d\d ` status |
| Python `NotImplementedError` for R_QINGHUAJIAO_REAL | any | any | `grep NotImplementedError /www/wwwroot/cretas/python-prod.log` |
| Latency P99 > 3000ms on the two endpoints | sustained | 5 min | nginx upstream timing |
| User-reported critical bug from 青花椒 (川菜) | severity ≥ P1 | any | bug tracker / direct ping |

Note: an unrelated pre-existing SmartBI gold-layer ETL error (`gold materialize failed for R_QINGHUAJIAO_REAL`) exists in `/www/wwwroot/cretas/python-prod.log` — this is a **separate** issue not caused by T6.6.3b and not a rollback trigger.

---

## Rollback procedure (~35-45s recovery)

```bash
ssh root@139.196.165.140

# Each apply produces ONE shared timestamp; both vhost backups carry the same suffix.
TS=$(ls -1t /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3b.* | head -1 | sed 's/.*\.t6-6-3b\.//')
echo "Restoring T6.6.3b backups from $TS"

cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3b.$TS \
   /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
cp /www/server/panel/vhost/nginx/web-admin.conf.bak.t6-6-3b.$TS \
   /www/server/panel/vhost/nginx/web-admin.conf

nginx -t && nginx -s reload
```

After rollback:

- R_QINGHUAJIAO_REAL/analysis/(production|quality) → Java (pre-3b state)
- **R_ILTEATRO_REAL/analysis/(production|quality) → Python (3a unchanged)**
- F006/* → Java (unchanged)
- Other Phase 2A routes → unchanged

Estimated recovery: ~35-45s from rollback decision to running on Java again for R_QINGHUAJIAO_REAL.

---

## Why isolated rollback works

T6.6.3b uses a separate backup suffix (`.bak.t6-6-3b.`) from 3a (`.bak.t6-6-3a.`). Restoring only the 3b backup brings the file back to **post-3a / pre-3b** state — 3a's R_ILTEATRO_REAL block stays present.

If you ever need to roll back **both** 3a and 3b together (worst case), use the older 3a backup suffix (`.bak.t6-6-3a.20260514_023351`).

---

## Audit trail

| When | Who | Action | Evidence |
|---|---|---|---|
| 2026-05-13T19:19:48Z | chat2 | Stage T6.6.3b on api + web-admin (nginx -t PASS, no reload) | apply script output, backups `*.bak.t6-6-3b.20260514_031948` |
| 2026-05-13T19:21:48Z | chat2 (per Steve GO) | `nginx -s reload` — T6.6.3b LIVE | `tests/qa-t6-6-3b/evidence.md` |
| 2026-05-13T19:21:50Z | chat2 | Active-E2E 4 probes (all PASS) | `tests/qa-t6-6-3b/evidence.md`, `factory-no-regression.txt` |
| 2026-05-13 | chat2 | Web smoke SKIPPED (R_QINGHUAJIAO_REAL has 0 users; qhj_prod is RES_3101_009, MO drift) | `restaurant-tenants.txt` |

---

## Related issues

- **Parity gap (P2, non-blocking)** — Python `/analysis/production` and `/analysis/quality` emit a 96 B 401 envelope vs the Java-mirrored 188 B used by other Phase 2A endpoints. Tracked in issue #530. Recommended follow-up for PR #352 / #358 auth dependency.
- **SmartBI gold-layer ETL error** for R_QINGHUAJIAO_REAL — pre-existing, unrelated to T6.6.3b. Recommend separate ticket.
