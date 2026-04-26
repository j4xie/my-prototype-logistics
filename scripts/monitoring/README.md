# Monitoring Scripts

Lightweight observability scripts for Cretas / 数据织网 features.

## capability-watch.sh

Phase 4.5 observation period monitor for 数据织网 A spec capability endpoint.

**Why**: spec §9.2 requires "F001 + RES_3101_009 跑 1 周, 0 投诉 → 扩白名单". This script gives passive evidence of "0 投诉" by checking endpoint health + latency + error rate every 15 min.

**Probes**:
1. Python /health endpoint returns 200
2. /api/smartbi/capability/RES_3101_009 returns parseable JSON + measures wall latency
3. Gate semantics: non-whitelisted factory returns 503
4. journald scan for capability-related errors in last 15 min

**Output** (single line per run):
```
[2026-04-26T10:16:14] OK health=ok cap=20f/13s lat=5ms gate=ok errs=0/15min
```

OK = exit 0. ALERT = exit 1 + reason emitted on STDOUT.

**Install on prod (47.100.235.168)**:
```bash
# Copy script
scp scripts/monitoring/capability-watch.sh root@47.100.235.168:/www/wwwroot/cretas/

# Install cron (every 15 min)
ssh root@47.100.235.168 'crontab -l | grep -v capability-watch > /tmp/cron; echo "*/15 * * * * /www/wwwroot/cretas/capability-watch.sh >> /var/log/capability-watch.log 2>&1" >> /tmp/cron; crontab /tmp/cron'

# Verify
ssh root@47.100.235.168 'crontab -l | grep capability'
```

**Tail log**:
```bash
ssh root@47.100.235.168 'tail -f /var/log/capability-watch.log'
```

**Alert response** (when ALERT line appears):
- `health=000` → Python service down → `systemctl status cretas-python && journalctl -u cretas-python -n 50`
- `cap=fail` or `cap=parse-fail` → endpoint returning malformed → check above
- `lat=>500ms` → uvicorn worker saturated, OR Python pool exhausted → check `ss -tlnp \| grep 8083` + memory
- `gate=` not 503 → rollout config broken (`CAPABILITY_ROLLOUT_FACTORIES` env var lost) → check systemd EnvironmentFile
- `errs >5/15min` → exceptions spiking → grep journald for stack traces

**Tunable env vars** (set in cron line if needed):
- `PYTHON_HOST` (default: localhost)
- `PYTHON_PORT` (default: 8083)
- `INTERNAL_SECRET` (default: from server-operations.md)
- `PROBE_FACTORY` (default: RES_3101_009; can change to any whitelisted factory)
- `ALERT_LATENCY_MS` (default: 500)

**Decommission** (after observation period ends + whitelist expanded to all):
```bash
ssh root@47.100.235.168 'crontab -l | grep -v capability-watch | crontab -'
```

Or keep running indefinitely as a passive health probe (~5KB log per day at 15-min cadence is cheap).

---

## capability-soak-report.sh

24h aggregation of capability-watch.sh log lines. Replaces manual "Day 12 24h soak" verification with automated daily summary.

**Probes**: parses `/var/log/capability-watch.log` last 24h, computes:
- Total runs (96 expected if 15-min cadence held)
- PASS % vs ALERT %
- Avg + p95 latency
- Worst-latency line for context
- VERDICT: pass (≥99% PASS) / warn (≥95%) / fail (<95%)

**Output** (cron'd to `/var/log/capability-soak.log`):
```
[2026-04-26T09:00:00] DAILY-SUMMARY runs=96 pass=100% alert=0% lat_avg=18ms lat_p95=42ms worst="OK health=ok cap=20f/13s lat=48ms gate=ok"
[2026-04-26T09:00:00] DAILY-VERDICT pass (threshold: pass≥99% / warn≥95% / fail<95%)
```

**Install on prod** (already done Apr 26 2026):
```bash
scp scripts/monitoring/capability-soak-report.sh root@47.100.235.168:/www/wwwroot/cretas/
ssh root@47.100.235.168 'crontab -l | grep -v capability-soak > /tmp/cron; echo "0 9 * * * /www/wwwroot/cretas/capability-soak-report.sh >> /var/log/capability-soak.log 2>&1" >> /tmp/cron; crontab /tmp/cron'
```

**Tail**:
```bash
ssh root@47.100.235.168 'tail -20 /var/log/capability-soak.log'
```

**On-demand run** (e.g., before declaring "1-week observation passed"):
```bash
ssh root@47.100.235.168 'WINDOW_HOURS=168 bash /www/wwwroot/cretas/capability-soak-report.sh'
```
(168h = 7 days. Override `WINDOW_HOURS` env var for any window.)

**Exit codes**:
- 0 — pass or warn (cron continues silently)
- 1 — fail (cron mailer fires if MAILTO set in crontab)
- 2 — log file missing
