# T6 Cutover Baseline Metrics — Operations Guide

Tools for collecting and aggregating Java baseline metrics during the 1-week pre-T6.1 measurement window.

**Spec source-of-truth**: `docs/superpowers/specs/2026-05-02-phase2a-t6-deploy-runbook.md` §6
**Strategic context**: `docs/superpowers/specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` (PR #59)

---

## Files

| Path | Role |
|---|---|
| `scripts/baseline-java-metrics.sh` | Continuous sampler. Hits in-scope Java endpoints once per `--interval` seconds, writes per-request CSV. Default 7-day run. |
| `scripts/lib/baseline-aggregate.py` | Post-run aggregator. Reads collector CSV → outputs per-endpoint p50/p95/p99/error-rate/qps as CSV or markdown table. |
| `tests/scripts/test_baseline.py` | 5 pytest smokes for the aggregator. |

## Run procedure (server 47, 1 week before T6.1)

### Step 1: prep endpoints file

```bash
ssh root@47.100.235.168
cat > /tmp/t6-in-scope-endpoints.txt <<'EOF'
/api/mobile/F001/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F001/smart-bi/analysis/sales?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F001/smart-bi/analysis/region?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F001/smart-bi/analysis/department?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F001/smart-bi/analysis/inventory?startDate=2026-01-01&endDate=2026-12-31
/api/mobile/F001/smart-bi/alerts
/api/mobile/F001/smart-bi/recommendations
/api/mobile/F001/smart-bi/data-date-range
EOF
```

### Step 2: launch collector (background, 7 days)

```bash
JWT_SECRET=$(grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2-)
nohup /www/wwwroot/cretas/scripts/baseline-java-metrics.sh \
    --factory F001 \
    --duration 7d \
    --interval 60 \
    --output /var/log/baseline-java-metrics-$(date +%Y%m%d).csv \
    --endpoints /tmp/t6-in-scope-endpoints.txt \
    --java-base http://localhost:10010 \
  > /var/log/baseline-collector.log 2>&1 &
echo "PID: $!"
disown
```

### Step 3: monitor periodically (every 24h)

```bash
# Row count growth (should be monotonic)
wc -l /var/log/baseline-java-metrics-*.csv

# Last sample timestamp
tail -1 /var/log/baseline-java-metrics-*.csv | cut -d, -f1

# Collector log (warnings, errors)
tail -50 /var/log/baseline-collector.log
```

### Step 4: post-run aggregate (after 7 days)

```bash
python3 /www/wwwroot/cretas/scripts/lib/baseline-aggregate.py \
    --input /var/log/baseline-java-metrics-20260515.csv \
    --output /var/log/baseline-summary-20260522.csv \
    --format csv

# Or markdown for runbook attachment
python3 /www/wwwroot/cretas/scripts/lib/baseline-aggregate.py \
    --input /var/log/baseline-java-metrics-20260515.csv \
    --format markdown > /tmp/baseline-summary.md
```

The summary feeds into the §3.2 / §3.3 / §3.4 GO/NO-GO comparisons in the T6 deploy runbook (e.g. "Python p99 ≤ Java p99 + 500ms").

---

## Input args

### `baseline-java-metrics.sh`

| Flag | Default | Meaning |
|---|---|---|
| `--factory <id>` | (required) | Factory ID for JWT |
| `--duration <Nd\|Nh\|Ns>` | `7d` | Run duration |
| `--interval <seconds>` | `60` | Sample interval (per-endpoint cycle) |
| `--output <path>` | `/var/log/baseline-java-metrics-YYYYMMDD.csv` | Output CSV |
| `--endpoints <file>` | `/tmp/t6-in-scope-endpoints.txt` | Newline-separated endpoint paths |
| `--java-base <url>` | `http://localhost:10010` | Java upstream base URL |
| `JWT_SECRET` env var | (required) | Java JWT signing secret |

### `baseline-aggregate.py`

| Flag | Default | Meaning |
|---|---|---|
| `--input <path>` | (required) | Input CSV from collector |
| `--output <path>` | `-` (stdout) | Output path |
| `--format csv\|markdown` | `csv` | Output format |
| `--endpoint-filter <substr>` | (none) | Substring filter (only matching endpoints aggregated) |

---

## Output schema

### Collector CSV (per-request)

```csv
timestamp_iso,endpoint,http_status,latency_seconds,response_bytes
2026-05-15T09:00:01+00:00,/api/mobile/F001/smart-bi/analysis/finance?...,200,0.143,12834
2026-05-15T09:00:02+00:00,/api/mobile/F001/smart-bi/analysis/sales?...,200,0.087,8721
```

Special status sentinels:
- `0` → curl failed (network error, DNS, connection refused). `latency_seconds` will be `99`.
- `99` (in latency) → not a real value; paired with `0` status.

Aggregator counts these as errors and excludes them from latency percentile calculations.

### Aggregator CSV (summary)

```csv
endpoint,n,n_errors,p50_seconds,p95_seconds,p99_seconds,error_rate,qps
/api/mobile/F001/smart-bi/analysis/finance?...,10080,5,0.143,0.287,0.412,0.0005,0.0167
```

### Aggregator markdown

```markdown
| Endpoint | N | Errors | p50 (s) | p95 (s) | p99 (s) | Error rate | QPS |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/api/mobile/F001/smart-bi/analysis/finance?...` | 10080 | 5 | 0.143 | 0.287 | 0.412 | 0.0005 | 0.0167 |
```

---

## Troubleshooting

### Lock file says another instance running

```
ERROR: another instance running (PID xxx, lockfile /tmp/baseline-java-metrics.lock)
```

If the named PID is genuinely active (`kill -0 <PID>`), don't double-run. If the PID is stale (process gone but lockfile remains), the script auto-removes stale lockfiles on startup. Force-remove only if you're certain: `rm /tmp/baseline-java-metrics.lock`.

### CSV missing rows / collector log shows 401 or 403

- JWT expired → check that `JWT_SECRET` matches `/www/wwwroot/cretas/.env.prod`.
- Token regen happens every 50 minutes; if 401s persist past that, secret is wrong.

### `aggregate.py` reports lots of `skipped` rows

Most common: malformed CSV from a previous interrupted run that wasn't cleanly shut down. Check the file with `head -5` and `tail -5` — incomplete final row is OK (aggregator handles), but corrupted middle rows need manual cleanup.

### "No module named pytest" when running tests

Tests need pytest. Run from the project's Python venv:

```bash
cd backend/python
python -m pytest ../../tests/scripts/test_baseline.py -v
```

### Disk space concerns for 7-day run

At default 60s interval × 8 endpoints × 7 days = 80,640 rows. Each row ≈ 150 bytes → ~12 MB total. Negligible.

If you increase frequency to 1s or run on a high-traffic factory with 50+ endpoints, monitor disk: `df -h /var/log/`.

---

## Compatibility notes

- **bash**: server 47 uses bash (not zsh). Script uses bash 4+ features (`[[ ]]`, parameter expansion).
- **Python**: server venv38 = Python 3.8.17. Script uses only stdlib (`csv`, `statistics`, `collections`, `argparse`, `math`, `datetime`). No numpy/pandas/requests dependency.
- **curl**: assumed installed (every Linux distro). Uses `-w '%{http_code},%{time_total},%{size_download}'` for compact telemetry.
- **PyJWT**: required for token generation in the bash script. Installed in the project's Python venv (`pip show pyjwt`).
