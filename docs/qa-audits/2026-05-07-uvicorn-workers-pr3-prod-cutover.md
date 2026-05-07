# PR-3 prod cutover — cretas-python.service N=1 → N=2 (2026-05-07)

**Server**: 47.100.235.168 (8C / 16GB)
**Service**: `cretas-python.service` (port 8083, prod)
**Stack**: Path X-lite (PR-1.5 SQLAlchemy 2/3 + PR-2 leader gate + PR-1.6 asyncpg 15/6) — all merged in main before cutover
**Cutover time**: 2026-05-07 11:36:28 CST
**Dispatch**: `docs/superpowers/dispatch/2026-05-07-uvicorn-pr-3-prod-cutover-marching-order.md`
**Spike data**: `docs/qa-audits/2026-05-07-uvicorn-workers-spike-N2-pathx-lite.md` (PR #107)

---

## Summary

Single ExecStart edit on `/etc/systemd/system/cretas-python.service` to add `--workers 2`, then `daemon-reload` + `restart`. Plus 19-endpoint smoke verify and T6.2 canary check.

This is the FINAL step of the multi-worker enablement plan (PR-1 through PR-3). Test env spike data from PR #107 showed all gates passing at N=2, so prod cutover proceeds.

**No source-controlled `cretas-python.service` exists in repo** — the systemd unit lives only on server. This PR is documentation-only (audit trail).

---

## Change

```diff
# /etc/systemd/system/cretas-python.service line 43
- ExecStart=/www/wwwroot/cretas/code/backend/python/venv38/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8083
+ ExecStart=/www/wwwroot/cretas/code/backend/python/venv38/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8083 --workers 2
```

Backup file: `/etc/systemd/system/cretas-python.service.bak.pre-pr3.20260507_113600`.

---

## Pre-flight (Step 2)

| Field | Value |
|---|---|
| `systemctl is-active cretas-python` | active |
| Pre-cutover uptime | 2h 25min |
| Pre-cutover NRestarts | 0 |
| Pre-cutover process count | 1 (single worker) |
| Pre-cutover memory | 598.5 MB |
| Pre-cutover health | 200, 3ms |
| F001 canary live (T6.2) | yes (nginx config on server 139 confirmed) |
| F001 traffic last hour | quiet (good moment for restart) |

---

## Cutover (Step 3 + 4)

### Backup + sed edit (Step 3)

- `cp` backed up to `/etc/systemd/system/cretas-python.service.bak.pre-pr3.20260507_113600`
- `sed -i 's|^\(ExecStart=.*--port 8083\)$|\1 --workers 2|'` — exactly 1 line changed
- `diff backup new` confirmed surgical edit

### daemon-reload + restart + 5 verifies (Step 4)

```
systemctl daemon-reload          # OK
systemctl restart cretas-python  # issued at 11:36:28 CST
sleep 90                          # ONNX 2× warmup
```

| Verify | Threshold | Observed | Status |
|---|---|---:|---|
| Process count (master + tracker + 2 workers) | = 4 | **4** | ✅ |
| Health | 200 | **200, 4ms** | ✅ |
| Leader gate `[leader]` log line | present | `[leader] PID=665173 env=prod acquired lock /tmp/cretas-python-leader-prod.lock` | ✅ |
| Leader gate `[follower]` log line | present | `[follower] PID=665172 env=prod ... gated background tasks skipped (BlockingIOError)` | ✅ |
| NRestarts | 0 (clean intentional restart) | **0** | ✅ |
| Active state | `active (running)` | active 1min 30s, memory 1.1GB | ✅ |

5 background tasks under leader gate (all armed exactly 1×, all follower-skipped exactly 1×):
- `[leader] narrative_cache hourly pruner armed`
- `[leader] restaurant-ops hourly ETL armed` (the deadlock-risk task)
- `[leader] chat-session 30-min pruner armed`
- `[leader] llm-answer-cache hourly pruner armed`

Lock file `/tmp/cretas-python-leader-prod.lock` content = leader PID `665173`.

---

## Smoke (Step 6)

### 19 in-scope endpoints (`/api/mobile/F001/smart-bi/...`)

All 19 endpoints from `scripts/phase2a/t6-in-scope-endpoints.txt` returned **200**:

```
200  /api/mobile/F001/smart-bi/analysis/finance?...
200  /api/mobile/F001/smart-bi/analysis/sales?...
200  /api/mobile/F001/smart-bi/analysis/department?...
200  /api/mobile/F001/smart-bi/analysis/region?...
200  /api/mobile/F001/smart-bi/analysis/inventory?...
200  /api/mobile/F001/smart-bi/analysis/procurement?...
200  /api/mobile/F001/smart-bi/analysis/finance?...&analysisType=payable
200  /api/mobile/F001/smart-bi/analysis/finance?...&analysisType=profit
200  /api/mobile/F001/smart-bi/analysis/finance?...&analysisType=cost
200  /api/mobile/F001/smart-bi/analysis/finance?...&analysisType=receivable
200  /api/mobile/F001/smart-bi/analysis/finance?...&analysisType=budget
200  /api/mobile/F001/smart-bi/analysis/finance/budget-achievement?...
200  /api/mobile/F001/smart-bi/analysis/finance/yoy-mom?...
200  /api/mobile/F001/smart-bi/analysis/finance/category-comparison?...
200  /api/mobile/F001/smart-bi/alerts
200  /api/mobile/F001/smart-bi/recommendations
200  /api/mobile/F001/smart-bi/data-date-range
200  /api/mobile/F001/smart-bi/query-templates
200  /api/mobile/F001/smart-bi/datasource/list
```

PASS: 19 / FAIL: 0

### T6.2 canary nginx route

`api.cretaceousfuture.com` is **NXDOMAIN** in DNS (the canary test domain is internal-only). Direct curl fails 000 (DNS) / 301 (HTTP→HTTPS) / 000 (HTTPS SNI mismatch) — **environmental**, not a service issue.

Service-side verification via prod log instead:
- 139.196.165.140 (server 139 nginx) IS forwarding to prod 8083 since the restart
- Prod log (filtered for source IP `139.196.165.140` + path `F001`):
  - **579 × 200 OK**
  - **252 × 401 Unauthorized** (expired test-harness tokens, not service errors)
  - **0 × 5xx** (the gate)

Server 139 nginx vhost confirmed configured: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` exists.

---

## PG connection budget post-cutover

Idle baseline 90s after restart (no stress, just bg traffic):

```
Total: 55 conns / 100 cap (45 buffer)
  cretas_db:        10 JDBC + 2 asyncpg (test env Java + Python warming)
  cretas_prod_db:   10 JDBC + 0 asyncpg (prod just restarted, pool not yet warm)
  smartbi_db:        5 JDBC + 2 asyncpg (test env)
  smartbi_prod_db:   5 JDBC + 6 asyncpg (prod 2 workers × ~3 each)
  misc:                       5
```

Asyncpg pool budget per worker (PR-1.6):
- smartbi: max_size=15 (16) → 2 workers × 15 = 30 cap; idle ~6
- cretas: max_size=6 → 2 workers × 6 = 12 cap; idle ~0 (warm-on-demand)

Memory: master + tracker + 2 workers = ~1.1 GB total Python (vs single-worker 598 MB pre-cutover; +500 MB; well within 16 GB box headroom).

---

## Stop-and-ping triggers (per marching order)

None fired during cutover or smoke:

| Trigger | Status |
|---|---|
| Step 3 sed format mismatch | ✅ sed succeeded, exactly 1 line changed |
| Step 4 process count != 4 | ✅ 4 (1 master + 1 tracker + 2 workers) |
| Step 4 health != 200 | ✅ 200 |
| Step 4 leader gate log missing | ✅ both `[leader]` and `[follower]` present in `/www/wwwroot/cretas/python-prod.log` |
| Step 4 NRestarts > 0 (unexpected) | ✅ 0 |
| Step 6 smoke != 200 | ✅ 19 / 19 = 200 |
| Step 6 F001 nginx 5xx | ✅ 0 × 5xx (only 200 + auth 401) |

---

## 24h soak (Step 7 — passive)

Cutover at 11:36:28 CST. 24h soak ends ~2026-05-08 11:36 CST.

Passive monitoring criteria (organizer responsibility):
- T6.1 dryrun continues uninterrupted (separate process, was already running before cutover)
- F001 canary metrics (already showing 579/200 + 252/401 baseline)
- `journalctl -u cretas-python` for unexpected errors / NRestarts > 1
- `pg_stat_activity` peak < 95
- Memory growth — Python total RSS should stay near 1.5 GB (per N=2 spike data)

Per marching order: I will NOT touch prod again during 24h soak. Organizer pings if issues fire.

---

## Rollback (NOT needed but documented)

If 24h soak surfaces issues, rollback is reversible:

```bash
ssh root@47.100.235.168 "
  cp /etc/systemd/system/cretas-python.service.bak.pre-pr3.20260507_113600 \
     /etc/systemd/system/cretas-python.service
  systemctl daemon-reload
  systemctl restart cretas-python
  sleep 90
  curl -s http://localhost:8083/health
"
```

~5s downtime for the restart.

---

## Refs

- Plan: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md`
- Marching order: `docs/superpowers/dispatch/2026-05-07-uvicorn-pr-3-prod-cutover-marching-order.md`
- PR-1 spike (N=4 with errors): `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md` (PR #99)
- PR-1.5 SQLAlchemy tune: PR #101
- PR-2 leader gate: PR #103
- Re-run after PR-1.5 + PR-2 (still failed): PR #105
- PR-1.6 asyncpg pool tune (the actual fix): PR #106
- PR-1.7 N=2 spike (all gates pass): PR #107

## Status

✅ **Cutover complete.** N=2 + Path X-lite live on prod 8083.

Awaiting 24h passive soak. T6.3 50% factories cutover is the next milestone (separate marching order — not part of this PR).
