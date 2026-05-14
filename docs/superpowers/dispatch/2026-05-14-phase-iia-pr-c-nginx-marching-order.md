# Phase IIa PR-C Nginx Ops — Marching Order

**Dispatched**: 2026-05-14
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `ops/phase-iia-nginx-restaurant-routing` (for runbook commit; the actual nginx edit is on server 139)
**Estimated effort**: 0.5-1 day (mostly verification, the edit itself is 5 min)
**Spec source**: `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md`

## Goal

Extend nginx allowlist on **server 139** (`web-admin.conf` + `api.cretaceousfuture.com.conf`) to route restaurant tenants (`R_*/RES_*/R\d+`) to Python's `cretas_python` upstream for `/smart-bi/analysis/(finance|sales)` paths. Mirrors the production|quality cascade already at line 161.

Currently restaurant tenants hitting these paths fall through to Java's `/api/mobile/` catch-all → 404. After this change, they route to Python which serves the restaurant branch (PR-A).

## Prerequisites done

- ✅ Spec written and 4-cycle audited (PR #620 merged)
- ✅ Pre-II ETL Backfill done — 3 chains have Gold rows (PR #625 merged)
- ⏳ PR-A backend Python restaurant branch (sister chat, must deploy test BEFORE this ops change)
- ⏳ PR-B frontend (sister chat, must merge LAST)

## Read these files first

1. `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` — entire spec, especially:
   - **§6.1 Nginx Routing Required for Phase IIa** — exact rule + deploy order
   - **§9 Implementation Map** — nginx checklist
2. SSH `ssh root@139.196.165.140 "cat /www/server/panel/vhost/nginx/web-admin.conf | head -180"` — read current state
3. `.claude/rules/server-operations.md` — backup conventions, restart commands

## Concrete tasks

### Task 1 — Read current nginx state

```bash
ssh root@139.196.165.140 "grep -nE 'analysis/(finance|sales|production|quality)|R_.+REAL' /www/server/panel/vhost/nginx/web-admin.conf"
ssh root@139.196.165.140 "grep -nE 'analysis/(finance|sales|production|quality)|R_.+REAL' /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf"
```

You should see (per cycle-2 audit):
- Line ~105: factory allowlist for `/analysis/(finance|sales|...)` to `cretas_python` — restaurants NOT included
- Line ~161: restaurant cascade `(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(production|quality)` — only production+quality currently

### Task 2 — Backup BOTH config files

```bash
TS=$(date +%Y%m%d_%H%M%S)
ssh root@139.196.165.140 "
  cp /www/server/panel/vhost/nginx/web-admin.conf /www/server/panel/vhost/nginx/web-admin.conf.bak.phase-iia.$TS
  cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.phase-iia.$TS
"
```

Confirm backups exist before editing.

### Task 3 — Add new location block

**After** the existing restaurant production|quality block (around line 161-170), add a new parallel block for `finance|sales`:

```nginx
# Phase IIa (2026-05-14): restaurant tenants → Python for /analysis/(finance|sales).
# Mirrors line 161 production|quality cascade. Python's analysis_sales.py +
# analysis_finance.py polymorphic dispatch (PR-A) handles tenant-type branching.
# Backed by Pre-II ETL Backfill completed 2026-05-14 (3 chains have Gold rows).
# Rollback: cp web-admin.conf.bak.phase-iia.<TIMESTAMP> web-admin.conf && nginx -t && nginx -s reload
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

Repeat in BOTH `web-admin.conf` AND `api.cretaceousfuture.com.conf`. The two vhosts must stay in sync.

### Task 4 — Validate config

```bash
ssh root@139.196.165.140 "nginx -t"
```

Must show `syntax is ok` + `test is successful`. If error, fix or revert before proceeding.

### Task 5 — Reload nginx (atomic, zero-downtime)

```bash
ssh root@139.196.165.140 "nginx -s reload"
```

### Task 6 — Smoke verify

Coordinate with PR-A chat to confirm Python backend test env deployed first. Then:

```bash
# Login as qhj_admin / 123456 on test env first
TOKEN=$(curl -sS -X POST http://139.196.165.140:8097/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"qhj_admin","password":"123456"}' | python -c "import json,sys; print(json.load(sys.stdin)['data']['token'])")

# Hit restaurant /analysis/sales — should return 200 with tenantType=RESTAURANT
curl -sS -X GET "http://139.196.165.140:8097/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
```

Expected: HTTP 200 + JSON body with `data.tenantType == "RESTAURANT"`. If still 404, nginx routing failed or PR-A backend not deployed.

### Task 7 — Document deployment in dispatch/ runbook

Write a brief `docs/superpowers/dispatch/2026-05-14-phase-iia-nginx-deploy-evidence.md` with:
- Timestamps of test + prod deploy
- Backup filenames
- Smoke test results (HTTP status codes, sample response)
- Any issues encountered

Commit to your branch `ops/phase-iia-nginx-restaurant-routing` + open PR for archival.

## Coordination (CRITICAL)

Per spec §6.1, deploy order:
1. **PR-A backend deploys test env FIRST** (port 8084)
2. **Your nginx test config update** (139's 8097 vhost) — this MO
3. Smoke test (Task 6 above)
4. **PR-A backend deploys prod** (port 8083)
5. **Your nginx prod config update** (same MO, repeat on prod vhost)
6. Smoke prod
7. **PR-B frontend merges LAST** (web-admin deploy replaces placeholder)

Coordinate with PR-A chat on step 1 / 4 completion before you proceed with 2 / 5.

## Output / PR

- Branch: `ops/phase-iia-nginx-restaurant-routing`
- Files committed: `docs/superpowers/dispatch/2026-05-14-phase-iia-nginx-deploy-evidence.md` (runbook output)
- PR title: `ops(nginx): Phase IIa restaurant routing for /analysis/(finance|sales)`
- **DO NOT MERGE** until prod nginx + smoke test green. Ping organizer.

## Reporting back

After each phase (test reload OK / prod reload OK / smoke test result), report:
- nginx reload status (`nginx -t` + `nginx -s reload` output)
- Backup filename per env
- HTTP status code from smoke curl
- Sample response snippet (1-2 lines, redact tokens)

If `nginx -t` fails → revert backup immediately, do NOT reload.
If smoke test returns 404 → check that PR-A backend deployed first.
If smoke test returns 5xx → check PR-A Python service logs.
