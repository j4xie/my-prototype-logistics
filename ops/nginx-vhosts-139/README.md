# Server 139 — Internal Nginx Vhost Configs (committed copy)

**Server**: `139.196.165.140` (nginx gateway)
**Live path**: `/www/server/panel/vhost/nginx/`
**Reason for committing**: BUG-R1B-01 fix (option d, PR #441) required carve-out patches to two internal vhosts that previously lived only on-server. Repo-tracked copy enables review, audit, and recovery.

## Files

| File | Listen | Role | Upstream for /smart-bi/analysis/* |
|---|---|---|---|
| `web-admin.conf` | 8086 | Internal prod web-admin frontend (Vue dist at `/www/wwwroot/web-admin/`) | `cretas_python` (Python prod 8083) |
| `web-admin-test.conf` | 8097 | QA test env web-admin (Vue dist at `/www/wwwroot/web-admin-test/`) | `47.100.235.168:8084` (Python test 8084) |
| `*.original` | — | Pre-patch snapshots scp'd from server 139 at 23:47 CST on 2026-05-12. Reference only — do not deploy. |

## What changed (2026-05-12, BUG-R1B-01)

Both vhosts received a Python carve-out regex block (16 lines each) inserted before the catch-all `location /api/mobile/` block. The regex mirrors `api.cretaceousfuture.com.conf:50` factory whitelist (75 cutover factories) and routes `/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)` to Python instead of Java.

**Why**: T6.5 Phase A→C (May 9 2026, PR #205/#236) deleted the Java handlers for those 6 analysis endpoints — they now live only in Python (`backend/python/smartbi_compat/api/analysis_finance.py` et al). Customer-facing `api.cretaceousfuture.com.conf` already had the carve-out since T6.2/T6.3 (May 7-8) and T6.4 cascade (May 9). The two internal vhosts here were missed and kept routing 404 → Java for the 75 cutover factories.

See `docs/qa-audits/2026-05-12-r1b-1-finance-profit-cost-investigation.md` for full RCA.

## Drift policy

If you change these vhosts on server 139:
1. Edit `ops/nginx-vhosts-139/<file>` in this repo first.
2. `scp` to server, `nginx -t`, `nginx -s reload`.
3. Commit + PR.

Server-side ad-hoc edits will drift from repo. If a drift is discovered:
1. `scp` the live conf back to `*.live-<date>` for evidence.
2. Diff against the repo copy.
3. Decide: revert server to repo OR update repo to match server.

## Rollback (BUG-R1B-01 patch)

```bash
ssh root@139.196.165.140 'cp /www/server/panel/vhost/nginx/web-admin.conf.bak.20260512_234703 /www/server/panel/vhost/nginx/web-admin.conf && cp /www/server/panel/vhost/nginx/web-admin-test.conf.bak.20260512_234703 /www/server/panel/vhost/nginx/web-admin-test.conf && nginx -t && nginx -s reload'
```

Recovery time <1 min. Backups timestamped `20260512_234703` (preserved on server).
