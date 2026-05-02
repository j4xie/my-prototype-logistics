# Phase 2A T6 Cutover — Deploy Runbook (operational companion)

**Date**: 2026-05-02
**Author**: Chat 2 region domain (post-PR #56 + PR #60 region domain ship)
**Companion to**: [PR #59 T6 nginx cutover design spec](2026-05-02-phase2a-t6-nginx-cutover-design.md) (530 LOC, the WHAT)
**This doc scope**: the HOW — actual nginx config diff, stage-by-stage commands, GO/NO-GO numerical criteria, rollback procedures, monitoring panel refs, baseline collection script, printable operator checklist

> **Document boundary** (do not duplicate):
> - PR #59 owns: strategy, regex routing design, dict_eq dryrun design, rollback triggers (qualitative), open questions, references.
> - This runbook owns: command sequences, threshold values, CSV formats, panel IDs, day-by-day operator checklist, baseline-collection script.

---

## 1. 背景 + Pre-cutover prerequisites

### 1.1 Doc relationship

```
PR #59 design spec ────┐
                       │
                       ├──► T6 cutover decision (single source of truth for routing strategy)
                       │
This runbook ──────────┘
```

PR #59 §6 staged rollout reads "Apply nginx config that routes ONLY that factory's traffic to Python". This runbook §3.2 reads "Run `cp` + `nginx -t` + `nginx -s reload` in this exact order with this exact config snippet". They are complementary, not redundant.

### 1.2 Phase 2A 100% in-scope ship checklist

T6.0 (this stage 0) is gated on Phase 2A code completeness. As of 2026-05-02, status:

| Endpoint family | Java parity port | PR | Merge status |
|---|---|---|---|
| Sales (5 endpoints) | ✅ Wave 0 | #14 #15 — | merged |
| Finance composite + per-type | ✅ Wave 1 | #13 #18 #21 #22 #25 #28 #38 #42 #44 #46 #51 | merged |
| Department | ✅ Wave 2 Tier 2 | #36 #52 #57 | merged |
| Region | ✅ Wave 2 Tier 2 | #41 #56 #60 | merged |
| Inventory | ✅ Wave 2 Tier 2 | #47 #53 #54 | merged |
| Procurement | spec only | #40 | impl in flight (Chat 4) |
| Drill-down | not started | — | unscoped |
| Datasource GET (fields/history) | ✅ Wave 2 Tier 1 | #39 | merged |
| Datasource preview/upload/apply | ❌ deferred (Java stub only) | #45 #49 #50 | merged (defer docs) |
| Quality / Production | ❌ deferred (Java mock only) | #37 | merged (defer docs) |
| Query templates | ✅ Wave 2 Tier 1 | #48 | merged |
| Incentive plan | ✅ | #43 | merged |

**Cutover blocker**: Procurement PR-A must merge before T6.1. Drill-down is out of T6 scope (Java stays primary, see PR #59 §2.3).

### 1.3 Java backend baseline metrics — collect 1 week before cutover

The numerical GO/NO-GO criteria in §3 (Stage T6.2/T6.3/T6.4) reference **Java baseline** (e.g. "Python p99 ≤ Java p99 + 500ms"). Without a recorded Java baseline, GO/NO-GO becomes opinion. Collect 1 week of baseline using the script in §6.

Data needed (T-7d → T-1d):
- Per-endpoint p50, p95, p99 latency
- Per-endpoint error rate (5xx / total)
- Per-endpoint qps (steady-state and peak-hour)
- Per-endpoint sample request count (for statistical significance)

**Required volume**: ≥1000 samples per in-scope endpoint per day for reliable percentiles. Endpoints with <100 daily requests skip percentile gating; use error-rate-only criteria.

### 1.4 Python backend ready check

Before T6.1 dry-run, verify Python backend on 47:8083 is production-ready:

```bash
# Check 1: systemd healthy
ssh root@47.100.235.168 "systemctl status cretas-python --no-pager"
# Expect: Active: active (running)

# Check 2: health endpoint returns 200 + complete module list
curl -sS http://47.100.235.168:8083/health | jq '.modules | length'
# Expect: ≥10 (all modules registered)

# Check 3: smoke F999 against all in-scope endpoints
JWT_TEST=$(ssh root@47.100.235.168 "cat /www/wwwroot/cretas/.env.test | grep JWT_SECRET | cut -d= -f2")
TOKEN=$(JWT_SECRET="$JWT_TEST" python3 -c "import jwt,time,os; print(jwt.encode({'userId':1,'username':'smoke','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, os.environ['JWT_SECRET'], algorithm='HS256'))")

# Hit each in-scope endpoint via SSH tunnel
for path in \
  "/api/mobile/F999/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31" \
  "/api/mobile/F999/smart-bi/analysis/sales?startDate=2026-01-01&endDate=2026-12-31" \
  "/api/mobile/F999/smart-bi/analysis/region?startDate=2026-01-01&endDate=2026-12-31" \
  "/api/mobile/F999/smart-bi/analysis/inventory?startDate=2026-01-01&endDate=2026-12-31" \
  "/api/mobile/F999/smart-bi/alerts" \
  "/api/mobile/F999/smart-bi/recommendations"; do
  echo "=== $path ==="
  curl -sS -w "\n http=%{http_code} time=%{time_total}s\n" \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8083$path" -o /dev/null
done
# Expect: all http=200, all time<2s
```

---

## 2. 实际 nginx config diff

### 2.1 Current state (Java upstream port 10010, on server 139)

**File**: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (or whatever vhost serves `/api/mobile/`; verify with sysadmin via `nginx -T | grep server_name | grep cretaceous`)

```nginx
upstream cretas_backend {
    server 47.100.235.168:10010;     # blue
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.cretaceousfuture.com;
    # ... ssl + other directives ...

    location /api/mobile/ {
        proxy_pass http://cretas_backend/api/mobile/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

100% of `/api/mobile/*` → Java port 10010.

### 2.2 Target state — post-T6.4 (split routing: Python in-scope, Java out-of-scope)

```nginx
upstream cretas_backend {
    server 47.100.235.168:10010;     # blue (or 10020 green during deploys)
    keepalive 32;
}

upstream cretas_python {
    server 47.100.235.168:8083;
    keepalive 16;                    # NEW (PR #59 §4.3)
}

server {
    listen 443 ssl http2;
    server_name api.cretaceousfuture.com;
    # ... ssl + other directives unchanged ...

    # === Phase 2A T6 cutover: SmartBI to Python (in-scope routes) ===

    location ~ ^/api/mobile/[^/]+/smart-bi/(alerts|recommendations|data-date-range)$ {
        proxy_pass http://cretas_python;
        include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
    }

    location ~ ^/api/mobile/[^/]+/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
        proxy_pass http://cretas_python;
        include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
    }

    location ~ ^/api/mobile/[^/]+/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
        proxy_pass http://cretas_python;
        include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
    }

    # === Out-of-scope: routes that explicitly stay on Java ===

    location ~ ^/api/mobile/[^/]+/smart-bi/analysis/(quality|production)$ {
        proxy_pass http://cretas_backend;
        include /www/server/panel/vhost/nginx/include/cretas-java-proxy-defaults.conf;
    }

    location ~ ^/api/mobile/[^/]+/smart-bi/datasource/[^/]+/preview$ {
        proxy_pass http://cretas_backend;
        include /www/server/panel/vhost/nginx/include/cretas-java-proxy-defaults.conf;
    }

    location ~ ^/api/mobile/[^/]+/smart-bi/datasource/(upload|apply)$ {
        proxy_pass http://cretas_backend;
        include /www/server/panel/vhost/nginx/include/cretas-java-proxy-defaults.conf;
    }

    location ~ ^/api/mobile/[^/]+/smart-bi/(query|dashboard|drill-down) {
        proxy_pass http://cretas_backend;
        include /www/server/panel/vhost/nginx/include/cretas-java-proxy-defaults.conf;
    }

    # === Catch-all: everything else stays Java ===

    location /api/mobile/ {
        proxy_pass http://cretas_backend;
        include /www/server/panel/vhost/nginx/include/cretas-java-proxy-defaults.conf;
    }
}
```

### 2.3 Critical location matcher pitfalls

1. **Regex location MUST come before prefix location.** nginx evaluates regex (`~` and `~*`) before prefix matches (`/api/mobile/`). The 4 Python regex blocks above run before the catch-all `/api/mobile/`. Order within regex blocks matters for overlapping patterns — keep the explicit-allow Java blocks ABOVE the catch-all but AFTER Python blocks.

2. **`(/.*)?$` vs `(/.*)?` (no `$`).** Sub-resource paths (e.g. `/analysis/finance/budget-achievement`) need `(/.*)?` to match trailing path. Use `?$` to ensure the entire suffix is path-only (no query string interference; nginx handles query strings before location matching anyway, but $ keeps the regex deterministic).

3. **`[^/]+` vs `\w+` for factoryId.** `[^/]+` is correct — factory IDs may include letters, digits, hyphens (e.g. F001, F-Test-001). `\w+` would miss hyphens.

4. **`~` vs `~*` (case sensitivity).** Use `~` (case-sensitive). Endpoint paths from Java/Python are deterministic-cased.

5. **Path translation `factoryId` (camelCase) vs `factory_id` (snake_case).** No nginx-level handling needed; both resolve identically (per PR #59 §4.2). Python's FastAPI sees the path parameter regardless of naming.

### 2.4 Backup before apply (mandatory each stage)

```bash
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/
TS=$(date +%Y%m%d_%H%M%S)
cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6.$TS
ls -la api.cretaceousfuture.com.conf.bak.t6.* | tail -3   # confirm backup created
```

Each stage (T6.1, T6.2, T6.3, T6.4) creates its own timestamped backup. **Do not delete backups until T6.4 + 30 days** — needed for §4 rollback.

---

## 3. 4-stage execution commands

### 3.1 Stage T6.1 — 0% canary smoke (24h dryrun, no nginx change)

**Trigger**: Phase 2A 100% in-scope merged + §1.3 Java baseline collected + §1.4 Python ready check ✅.

**Action**: Run dual-call comparison sidecar on server 47, **no nginx changes**.

```bash
# On server 47 (where both Java + Python live)
ssh root@47.100.235.168

# Prepare in-scope endpoint list
cat > /tmp/t6-in-scope-endpoints.txt <<'EOF'
/api/mobile/F999/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F999/smart-bi/analysis/sales?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F999/smart-bi/analysis/region?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F999/smart-bi/analysis/department?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F999/smart-bi/analysis/inventory?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F999/smart-bi/alerts
/api/mobile/F999/smart-bi/recommendations
/api/mobile/F999/smart-bi/data-date-range
EOF

# Launch dryrun (script: scripts/t6-dryrun-compare.sh — to be authored alongside cutover, see §6)
nohup bash /www/wwwroot/cretas/scripts/t6-dryrun-compare.sh \
    --duration 24h \
    --endpoints /tmp/t6-in-scope-endpoints.txt \
    --interval 60 \
    --java-base http://localhost:10010 \
    --python-base http://localhost:8083 \
    --jwt-test \
    --output /var/log/cretas-t6-dryrun.log \
    > /tmp/t6-dryrun.out 2>&1 &
echo "PID: $!"
disown
```

**24h checkpoint**: review log at `/var/log/cretas-t6-dryrun.log`.

**GO criteria** (numerical):
- Total samples: ≥1440 (1/min × 24h × 1 endpoint × ≥1 batch)
- dict_eq pass rate: ≥99.0%
- Top-5 traffic endpoints (finance composite, sales gold, region composite, alerts, dashboard if applicable): 100% dict_eq pass
- Python p99 ≤ Java p99 + 500ms across the window
- 0 Python service restarts during window
- 0 Python 500-class errors

**NO-GO** triggers:
- Any dict_eq fail in top-5 endpoints
- Overall dict_eq fail rate > 1.0%
- Any Python 500 error
- Python p99 > Java p99 + 500ms for >5% of measurement intervals

NO-GO action: STOP, file a critical bug, re-run T6.1 only after fix shipped.

### 3.2 Stage T6.2 — 10% traffic + 24h soak (1 factory)

**Trigger**: T6.1 GO.

**Pre-action**: pick canary factory. Selection criteria:
- Low traffic volume (<10k requests/day)
- Recent activity (active within past 7 days)
- Non-customer-facing if available (e.g. F999 test factory) OR low-blast-radius real factory
- Document chosen factory: `T6.2 canary = <factory_id>` in handoff log

**Action**: insert factory-scoped Python routes ABOVE the catch-all.

```bash
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/

# Backup
TS=$(date +%Y%m%d_%H%M%S)
cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_2.$TS

# Edit (use baota panel UI or vi)
# Insert ABOVE the catch-all `location /api/mobile/`:

# === T6.2 canary: F999 only to Python ===
# location ~ ^/api/mobile/(F999)/smart-bi/(alerts|recommendations|data-date-range)$ { proxy_pass http://cretas_python; include cretas-python-proxy-defaults.conf; }
# location ~ ^/api/mobile/(F999)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ { proxy_pass http://cretas_python; include cretas-python-proxy-defaults.conf; }
# location ~ ^/api/mobile/(F999)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ { proxy_pass http://cretas_python; include cretas-python-proxy-defaults.conf; }
# (replace F999 with actual canary)

# Validate config
nginx -t
# Expect: syntax is ok, test is successful

# Reload (no downtime)
nginx -s reload

# Smoke immediately
curl -sS -w "%{http_code}\n" "https://api.cretaceousfuture.com/api/mobile/F999/smart-bi/alerts" -H "Authorization: Bearer $JWT_PROD_TOKEN"
# Expect: 200 (or 401/403 depending on token validity, but NOT 502)
```

**Soak**: 24h.

**GO criteria** (numerical):
- Python error rate < 0.5% (5xx + Python-thrown business 500s)
- Python p50 < 200ms across 24h
- Python p99 < 2000ms across 24h
- 0 Java fallbacks (canary factory traffic should not hit Java upstream — if any did, regex broken)
- 0 user-reported issues for canary factory
- Java baseline (other factories): unchanged from §1.3 baseline (no spillover impact)

**NO-GO** triggers:
- Python error rate ≥ 0.5%
- Python p99 ≥ 2000ms for >5% of intervals
- Any Java 502 in nginx access log on the canary factory's path
- ≥1 P1 user report

NO-GO → §4 rollback procedure (reload backup config, ~30s).

### 3.3 Stage T6.3 — 50% traffic + 24h soak (multi-factory)

**Trigger**: T6.2 GO.

**Action**: Expand canary to 50% of factories. Easiest: alphabetical split:

```nginx
# === T6.3: F[A-M] to Python, F[N-Z] still on Java ===
location ~ ^/api/mobile/F[a-mA-M][^/]*/smart-bi/(alerts|recommendations|data-date-range)$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}
location ~ ^/api/mobile/F[a-mA-M][^/]*/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}
location ~ ^/api/mobile/F[a-mA-M][^/]*/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}
```

If factory IDs don't follow alphabetical pattern, use enumerated regex `^/api/mobile/(F001|F003|F005|...)/smart-bi/...$` based on actual factory list (50% by traffic volume, not raw count).

**Soak**: 24h. **GO/NO-GO**: same numerical thresholds as §3.2 but applied to the larger sample. **Kill switch**: §4 rollback.

### 3.4 Stage T6.4 — 100% traffic + 7-day soak

**Trigger**: T6.3 GO.

**Action**: Apply final §2.2 config — all in-scope routes to Python, all out-of-scope explicitly to Java, catch-all to Java for safety.

```bash
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/
TS=$(date +%Y%m%d_%H%M%S)
cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_pre.$TS

# Replace vhost with §2.2 final form (via baota UI or scripted edit)
# ...

nginx -t && nginx -s reload
```

**Soak**: 7 days extended observation.

**GO criteria** (for §3.5 Java decommission):
- 7-day Python uptime: 100% (0 service restarts triggered by code/runtime issues; planned deploys OK)
- 7-day error rate: <0.5% rolling average
- 7-day p99 latency: ≤ Java baseline p99 + 200ms (tightened from T6.2 +500ms; stable steady-state)
- 0 P1/P0 user reports
- 0 dict_eq divergences in continued sampled comparison sidecar

If 7d GO: schedule Java SmartBI decommission (separate operational task, see PR #59 §9.4).

---

## 4. Rollback execution

### 4.1 Trigger detection — how to spot in real time

Detection methods (run continuously during T6.2/T6.3/T6.4):

```bash
# Method 1: nginx access log tail (5xx rate)
ssh root@139.196.165.140 "tail -f /www/wwwlogs/api.cretaceousfuture.com.log | awk '{ if (\$9 >= 500) print }'"
# If 5xx lines flood (>1/sec sustained), trigger §4.2.

# Method 2: Python service status
ssh root@47.100.235.168 "systemctl status cretas-python --no-pager | head -3"
# If "Active: failed" or repeated restart, trigger §4.2.

# Method 3: Grafana dashboard (see §5)
# Open dashboard panel "Phase 2A T6 — Python p99 latency by endpoint"
# If any endpoint p99 > 3000ms for ≥5min, trigger §4.2.
```

PR #59 §7.1 lists authoritative trigger thresholds. This runbook adds the detection one-liners.

### 4.2 Rollback commands (≤2 minutes target)

```bash
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/

# Find the most recent backup BEFORE the current stage
ls -lat api.cretaceousfuture.com.conf.bak.t6* | head -3

# Restore (replace with the appropriate timestamp)
LATEST_BAK=$(ls -t api.cretaceousfuture.com.conf.bak.t6* | head -1)
cp "$LATEST_BAK" api.cretaceousfuture.com.conf

# Validate + reload
nginx -t && nginx -s reload

# Verify rollback effective
curl -sS -w "%{http_code}\n" "https://api.cretaceousfuture.com/api/mobile/F999/smart-bi/alerts" \
  -H "Authorization: Bearer $TOKEN" -o /dev/null
# Expect: 200 (now hitting Java)

# Confirm in nginx access log: upstream IP changed
tail -20 /www/wwwlogs/api.cretaceousfuture.com.log | awk '{print $NF}'
# Should show 47.100.235.168:10010 instead of 47.100.235.168:8083
```

### 4.3 Notification list (post-rollback, within 10 minutes)

| Recipient | Channel | Message template |
|---|---|---|
| Tech lead | Slack DM / phone | "T6.[stage] rolled back at [HH:MM]. Trigger: [metric] > [threshold]. nginx config restored to pre-stage backup." |
| Ops on-call | PagerDuty + Slack | (Same as above, plus) "No customer-facing impact expected. Will follow up with RCA in 24h." |
| Customer-facing PM | Slack | "Brief T6 cutover paused; Java backend continues to serve all traffic. No customer action needed." (only if T6.3 or T6.4 stage) |
| Dev team (Phase 2A authors) | Slack channel | (Same as tech lead, plus) "Will need eyes on [endpoint that triggered rollback] for RCA." |

### 4.4 Post-rollback root cause + retry decision

Within 24h of rollback:
1. **RCA document**: open `docs/incidents/2026-XX-XX-t6-rollback-stage[N].md`. Include: stage, trigger metric + actual values, suspected root cause, fix plan, retry timing.
2. **Fix landed** (PR with regression test if applicable).
3. **Retry decision** (tech lead + dev team + ops):
   - Retry same stage: schedule once fix merged + 24h soak in test env
   - Retry from earlier stage: if confidence shaken, re-run T6.1 dryrun before next staged attempt
   - Defer cutover: if multiple rollbacks in same domain, escalate to Phase 2A retro

---

## 5. Monitoring

### 5.1 Grafana panels (build BEFORE T6.1)

Panel set "Phase 2A T6 cutover" — to be created on `grafana.internal/d/phase2a-t6` (or whatever the project's Grafana namespace is). Required panels:

| Panel ID | Title | Query basis |
|---|---|---|
| t6-1 | Java vs Python error rate (5xx) — side-by-side | nginx access log status >= 500 grouped by upstream |
| t6-2 | Java vs Python p50/p95/p99 latency by endpoint | nginx upstream timing histogram, top 10 endpoints |
| t6-3 | Java vs Python qps | request count by upstream |
| t6-4 | Python service health (systemd state) | systemd unit state |
| t6-5 | Python pool saturation | uvicorn worker active count |
| t6-6 | dict_eq sidecar pass rate | t6-dryrun-compare log parser → metric |
| t6-7 | Per-stage time-to-rollback histogram | nginx config reload event log (post-cutover audit) |

PR #59 §8.1 defines the same dashboard from a strategy lens. This runbook makes the panel IDs concrete so an oncall can find them in 10 seconds.

### 5.2 Prometheus alert rules (build BEFORE T6.2)

```yaml
# prometheus/alerts/phase2a-t6.yml

groups:
- name: phase2a-t6
  interval: 30s
  rules:

  - alert: T6PythonErrorRateHigh
    expr: |
      sum(rate(nginx_http_requests_total{upstream="cretas_python",status=~"5.."}[5m]))
      /
      sum(rate(nginx_http_requests_total{upstream="cretas_python"}[5m]))
      > 0.02
    for: 5m
    labels:
      severity: critical
      team: phase2a-t6
    annotations:
      summary: "T6 Python error rate >2% for 5min — rollback trigger"
      runbook_url: "https://github.com/j4xie/my-prototype-logistics/blob/main/docs/superpowers/specs/2026-05-02-phase2a-t6-deploy-runbook.md#42-rollback-commands"

  - alert: T6PythonP99LatencyHigh
    expr: |
      histogram_quantile(0.99,
        sum(rate(nginx_upstream_response_time_seconds_bucket{upstream="cretas_python"}[5m]))
        by (le)
      ) > 3.0
    for: 5m
    labels:
      severity: critical
      team: phase2a-t6
    annotations:
      summary: "T6 Python p99 >3s for 5min — rollback trigger"

  - alert: T6PythonServiceDown
    expr: up{job="cretas-python"} == 0
    for: 30s
    labels:
      severity: critical
      team: phase2a-t6
    annotations:
      summary: "T6 Python service is DOWN"

  - alert: T6JavaFallbackSpike
    expr: |
      sum(rate(nginx_http_requests_total{upstream="cretas_python",status="502"}[5m])) > 0.05
    for: 5m
    labels:
      severity: warning
      team: phase2a-t6
    annotations:
      summary: "T6 502 rate from cretas_python upstream — Python likely unhealthy"
```

If the project's Prometheus instance doesn't yet expose `nginx_http_requests_total` / `nginx_upstream_response_time_seconds_bucket`, install/configure `nginx-prometheus-exporter` on server 139 BEFORE T6.1. (One-time setup; not a per-stage task.)

### 5.3 Per-stage monitoring cadence

| Stage | Cadence | Operator |
|---|---|---|
| T6.1 (24h dryrun) | Real-time tail of `/var/log/cretas-t6-dryrun.log`; review every 4h | Cutover lead |
| T6.2 (24h, 10%) | Real-time first 1h, then 1h interval review for next 23h | Cutover lead + ops on-call |
| T6.3 (24h, 50%) | 1h interval throughout | Cutover lead + ops on-call |
| T6.4 (7d, 100%) | First 24h: 1h interval. Days 2-7: daily 9am check + alerts on-call | Ops on-call (daily); cutover lead (alert response) |
| Post-T6.4 (steady state) | Standard daily oncall + alerts | Ops |

---

## 6. Java baseline collection script (draft)

`scripts/baseline-java-metrics.sh` — to be authored before T6.0 (1 week before T6.1). Runs 1 week of measurement.

### 6.1 Script outline

```bash
#!/usr/bin/env bash
# scripts/baseline-java-metrics.sh
# Measure Java baseline metrics for in-scope T6 endpoints.
# Output: CSV to /var/log/baseline-java-metrics-YYYYMMDD.csv

set -euo pipefail

ENDPOINTS_FILE="${ENDPOINTS_FILE:-/tmp/t6-in-scope-endpoints.txt}"
OUTPUT_FILE="${OUTPUT_FILE:-/var/log/baseline-java-metrics-$(date +%Y%m%d).csv}"
INTERVAL_SEC="${INTERVAL_SEC:-60}"     # sample 1/min
DURATION_SEC="${DURATION_SEC:-604800}" # 1 week
JWT_SECRET="${JWT_SECRET:?required}"
JAVA_BASE="${JAVA_BASE:-http://localhost:10010}"
FACTORY="${FACTORY:?required}"

# CSV header
echo "timestamp_iso,endpoint,http_status,latency_seconds,response_bytes" > "$OUTPUT_FILE"

START=$(date +%s)
END=$((START + DURATION_SEC))

while [ "$(date +%s)" -lt "$END" ]; do
    # Generate fresh JWT
    TOKEN=$(JWT_SECRET="$JWT_SECRET" python3 -c "
import jwt,time,os
print(jwt.encode({
    'userId':1, 'username':'baseline',
    'factoryId': '$FACTORY', 'role':'factory_super_admin',
    'exp': int(time.time())+3600
}, os.environ['JWT_SECRET'], algorithm='HS256'))
")
    while IFS= read -r endpoint; do
        [ -z "$endpoint" ] && continue
        TS=$(date -Iseconds)
        # Hit endpoint, record status + timing + bytes
        RESULT=$(curl -sS -o /tmp/.bl.body -w "%{http_code},%{time_total},%{size_download}" \
                 -H "Authorization: Bearer $TOKEN" \
                 "${JAVA_BASE}${endpoint}" || echo "000,99,0")
        echo "$TS,$endpoint,$RESULT" >> "$OUTPUT_FILE"
    done < "$ENDPOINTS_FILE"
    sleep "$INTERVAL_SEC"
done
```

### 6.2 CSV output format

```csv
timestamp_iso,endpoint,http_status,latency_seconds,response_bytes
2026-05-15T09:00:01+00:00,/api/mobile/F001/smart-bi/analysis/finance?startDate=...,200,0.143,12834
2026-05-15T09:00:02+00:00,/api/mobile/F001/smart-bi/analysis/sales?startDate=...,200,0.087,8721
...
```

### 6.3 Aggregate after run completes

```bash
# Compute p50/p99/error_rate per endpoint
python3 <<'EOF'
import csv, statistics
from collections import defaultdict

samples = defaultdict(list)
errors = defaultdict(int)
totals = defaultdict(int)

with open('/var/log/baseline-java-metrics-20260515.csv') as f:
    for row in csv.DictReader(f):
        ep = row['endpoint']
        totals[ep] += 1
        if not row['http_status'].startswith('2'):
            errors[ep] += 1
            continue
        samples[ep].append(float(row['latency_seconds']))

print("endpoint,n,p50,p95,p99,error_rate")
for ep in sorted(totals.keys()):
    s = sorted(samples[ep])
    n = totals[ep]
    if not s:
        print(f"{ep},{n},,,,{errors[ep]/n:.4f}")
        continue
    p50 = s[len(s)//2]
    p95 = s[int(len(s)*0.95)]
    p99 = s[int(len(s)*0.99)]
    err = errors[ep] / n
    print(f"{ep},{n},{p50:.3f},{p95:.3f},{p99:.3f},{err:.4f}")
EOF
```

Output of this aggregation feeds the §3.2 / §3.3 GO/NO-GO comparisons. Snapshot it into the T6 cutover runbook log directory: `/var/log/baseline-java-metrics-summary-YYYYMMDD.csv`.

---

## 7. Operator checklist (printable)

Each section is a single page when printed. Operator initials + timestamp on each item.

### 7.1 Pre-cutover (T-1 week, T-1 day, T-0)

#### T-1 week (T6.0 + 7 days = T-7d)

```
[ ] Phase 2A 100% in-scope endpoints merged main (verify via §1.2 table)         _____ / _____
[ ] All sister chats (procurement at minimum) PR-A merged                        _____ / _____
[ ] Java backend baseline collection script (§6) deployed to server 47           _____ / _____
[ ] Java backend baseline collection running (verified PID + log file)           _____ / _____
[ ] Grafana dashboard "Phase 2A T6 cutover" created with all 7 panels (§5.1)     _____ / _____
[ ] Prometheus alert rules (§5.2) deployed to alertmanager                       _____ / _____
[ ] PagerDuty / Slack channel for T6 alerts subscribed by oncall                 _____ / _____
```

#### T-1 day (T-1d)

```
[ ] Java baseline collection completed (CSV + aggregated summary present)        _____ / _____
[ ] Baseline summary reviewed by tech lead (record p50/p99/error/qps per ep)     _____ / _____
[ ] Python /health smoke against all in-scope endpoints (§1.4)                   _____ / _____
[ ] Cutover lead designated + on-call ops contact confirmed                      _____ / _____
[ ] Notification list (§4.3) reviewed and contact info up-to-date                _____ / _____
[ ] §2.2 target nginx config reviewed by sysadmin (regex correctness)            _____ / _____
[ ] Backup retention policy confirmed (≥30 days for `*.bak.t6*` files)           _____ / _____
[ ] §4 rollback dry-run on staging env (if available) — measure rollback time    _____ / _____
```

#### T-0 (just before T6.1)

```
[ ] All T-1d items closed                                                        _____ / _____
[ ] Phase 2A merge freeze announced (no more in-scope changes during T6 window)  _____ / _____
[ ] Cutover lead pre-flight: review §3.1 Stage T6.1 commands                     _____ / _____
[ ] Operator runbook printed and on hand                                         _____ / _____
[ ] Slack thread for T6 cutover created (live status updates)                    _____ / _____
```

### 7.2 During cutover — 4-stage GO/NO-GO table

Initial each stage as completed; record GO/NO-GO decision + responsible lead.

```
Stage  | Start time | End time | Sample/threshold | GO / NO-GO | Responsible | Notes
-------+-----------+----------+------------------+------------+-------------+------------------
T6.1   | _____      | _____     | dict_eq ≥99%     | __________ | ___________ | _________________
T6.2   | _____      | _____     | err <0.5% / p99  | __________ | ___________ | _________________
       |           |          | <2s / 0 fallback |            |             |
T6.3   | _____      | _____     | err <0.5% / p99  | __________ | ___________ | _________________
       |           |          | <2s / 0 fallback |            |             |
T6.4   | _____      | _____     | err <0.5% / p99  | __________ | ___________ | _________________
       |           |          | <Java+200ms / 7d  |            |             |
```

If NO-GO at any stage: §4 rollback executed. Record:
```
Rollback time: _________________________________
Trigger metric value: __________________________
Backup file restored: __________________________
RCA document path: _____________________________
Retry decision: ________________________________
```

### 7.3 Post-cutover (T+1d, T+1w, T+1m)

#### T+1 day (after T6.4 begin)

```
[ ] 24h alert review — any T6PythonErrorRateHigh / T6PythonP99LatencyHigh fires? _____ / _____
[ ] dict_eq sidecar still running, pass rate ≥99%                                _____ / _____
[ ] User-reported issues for SmartBI: 0                                          _____ / _____
[ ] Grafana panel review: Java upstream qps approaching zero for in-scope routes _____ / _____
```

#### T+1 week (T6.4 + 7 days = T6.4 GO checkpoint)

```
[ ] Python service uptime: 100% (no restarts other than scheduled deploys)       _____ / _____
[ ] Error rate rolling 7d avg: <0.5%                                             _____ / _____
[ ] p99 latency rolling 7d: ≤Java baseline p99 + 200ms                           _____ / _____
[ ] User issues filed for SmartBI: 0 P0/P1                                       _____ / _____
[ ] dict_eq divergences: 0                                                       _____ / _____
[ ] T6.4 GO confirmed → schedule Java SmartBI decommission (separate task)       _____ / _____
```

#### T+1 month

```
[ ] Java SmartBI decommission task scheduled per separate plan (PR #59 §9.4)     _____ / _____
[ ] Old `*.bak.t6*` nginx backup files older than 30 days: removed               _____ / _____
[ ] Cutover retro doc filed: lessons learned / process improvements              _____ / _____
[ ] Grafana panels for T6 archived (read-only, kept for historical reference)    _____ / _____
[ ] Phase 2A T6 cutover marked DONE in project tracker                           _____ / _____
```

---

## 8. References

- [PR #59 T6 nginx cutover design spec](2026-05-02-phase2a-t6-nginx-cutover-design.md) — strategy, regex routing design, dryrun design, qualitative GO/NO-GO criteria, open questions, references
- [Phase 3 AI migration rollout plan](../plans/2026-05-01-phase3-ai-migration-rollout.md) — sister rollout pattern (LLM cutover, also 4-stage staged); structurally similar staged plan
- [.claude/rules/server-operations.md](../../../.claude/rules/server-operations.md) — server 47 / 139 architecture, ports, systemd units, deploy commands, R2/OSS endpoints
- [.claude/rules/aliyun-credentials.md](../../../.claude/rules/aliyun-credentials.md) — server 47 / 139 ECS instance IDs, security groups, AccessKey rotation history
- [.claude/rules/python-java-port.md](../../../.claude/rules/python-java-port.md) — Phase 2A Java→Python port rules (Rule 1-9), context for why per-endpoint behavior should match Java; especially Rule 8 (Map.of order) and Rule 9 (Lombok+Jackson) underpin dict_eq comparison validity
- [plans/2026-04-11-nginx-upstream-migration-audit.md](../plans/2026-04-11-nginx-upstream-migration-audit.md) — historical nginx upstream config audit (referenced by PR #59 §3.1 for current Java upstream definition)
- [.claude/skills/deploy-backend/SKILL.md](../../../.claude/skills/deploy-backend/SKILL.md) — deploy-backend.sh blue-green semantics; T6 must NOT break this — see PR #59 §7.3

---

**End of runbook**. Total: 8 sections + appendix.

Cross-PR coverage:
- PR #59 (design): WHAT — strategy, regex, dryrun semantics, rollback triggers (qualitative)
- This runbook (operational): HOW — commands, threshold values, CSV formats, panel IDs, day-by-day operator checklist, baseline collection script

If this runbook diverges from PR #59 at any point, PR #59 wins (single source of truth for strategy decisions). Operational specifics here may be tuned during execution; updates land via follow-up PR after cutover.
