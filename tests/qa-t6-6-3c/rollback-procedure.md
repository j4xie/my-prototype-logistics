# T6.6.3c Full Cascade — Rollback Procedure (≤45s)

Restoring 3c backups returns prod to **post-3b state** (3a + 3b explicit single-tenant blocks LIVE; broad cascade absent). Isolated from 3a/3b backup suffixes — restoring 3c does NOT touch the earlier 3a/3b backups.

## When to roll back

- 5xx rate > 2% on any restaurant tenant's `/analysis/(production|quality)` for 5 min
- Python `NotImplementedError` for any tenant matching `R_*|RES_*|R\d+` on either endpoint (indicates Python tenant detection mis-classifies)
- P1 customer report from any newly-covered restaurant tenant (R_DONGMENKOU_REAL, R_GML_DEMO, RES_3101_009, R001, RES_GML_001, …)
- Latency P99 > 3000 ms sustained for 5 min
- Steve direct command

## Rollback (≤45s recovery)

```bash
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/

TS=20260514_033550
cp api.cretaceousfuture.com.conf.bak.t6-6-3c.$TS api.cretaceousfuture.com.conf
cp web-admin.conf.bak.t6-6-3c.$TS                web-admin.conf

nginx -t && nginx -s reload
echo "rollback complete — back to 3a + 3b explicit state"
```

After rollback:

- `R_ILTEATRO_REAL/analysis/(production|quality)` → Python (3a still LIVE)
- `R_QINGHUAJIAO_REAL/analysis/(production|quality)` → Python (3b still LIVE)
- All other restaurants (R_DONGMENKOU_REAL, R_GML_DEMO, RES_3101_009, R001, …) → **Java (regressed back from 3c)**
- F006 / factory tenants → Java (unchanged)
- Other Phase 2A routes → unchanged

## Verify rollback (from 139, loopback HTTPS)

```bash
# Should now show Java envelope (188 B) for non-3a/3b restaurant tenants
curl -sk --resolve api.cretaceousfuture.com:443:127.0.0.1 -o /dev/null -w "HTTP=%{http_code} size=%{size_download}\n" \
  "https://api.cretaceousfuture.com/api/mobile/RES_3101_009/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview"
# Expect: HTTP=401 size=188 (Java)

# R_ILTEATRO_REAL and R_QINGHUAJIAO_REAL should still be Python (3a/3b)
curl -sk --resolve api.cretaceousfuture.com:443:127.0.0.1 -o /dev/null -w "HTTP=%{http_code} size=%{size_download}\n" \
  "https://api.cretaceousfuture.com/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview"
# Expect: HTTP=401 size=96 (Python)
```

## Sequence of recoverable states

| State | api & web vhosts | Description |
|---|---|---|
| pre-3a (initial) | catch-all only | Pre-PR #526 baseline |
| post-3a (PR #526 LIVE) | + R_ILTEATRO_REAL explicit | Single canary tenant on Python |
| post-3b (PR #536 LIVE) | + R_QINGHUAJIAO_REAL explicit | Two canary tenants on Python |
| **post-3c (this PR LIVE)** | broad regex `R_*|RES_*|R\d+` | All restaurant tenants on Python |
| 3c-rollback → post-3b | restore from `.bak.t6-6-3c.*` | Drops new 3c coverage; keeps 3a/3b |
| 3c-rollback → post-3a | also restore from `.bak.t6-6-3b.*` | Drops 3b too |
| 3c-rollback → pre-3a | also restore from `.bak.t6-6-3a.*` | Full rewind |
