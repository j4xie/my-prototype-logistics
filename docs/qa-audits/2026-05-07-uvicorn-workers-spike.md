# uvicorn workers spike — 2026-05-07

**Server**: 47.100.235.168 (8C / 16GB total, 14GB cgroup-reported)
**Test env**: 8084 (nohup-managed cretas-python-test, started via `restart-test.sh`)
**Python**: venv38, uvicorn `--workers N` mode → multiprocessing.spawn workers
**Block**: T6.3 50% factories cutover GO criteria — Python p99 < 2000ms under concurrent load
**Plan**: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` PR-1

---

## TL;DR

- ❌ **Naïve `--workers 4` is NOT GO for prod.** The 4-worker run hit 67% error rate at c=50 sales and 85% at c=100 sales, with `FATAL: remaining connection slots are reserved for non-replication superuser connections` — PG `max_connections=100` exhausted by SQLAlchemy sync pool 4× per worker.
- ⚠️ **Multi-worker ALSO hurts low-concurrency latency**. At c=1, p50 jumped from 6ms (single) to 26ms (4-worker) for sales — **5× regression** at low load. Throughput at c=1 dropped from 166 RPS → 51 RPS.
- ✅ **Multi-worker DOES help high-concurrency throughput when pool budget holds**: at c=10 alerts, RPS went from 344 (single) → 445 (4-worker, +29%); c=50 alerts RPS went from 317 → 848 (+167%) **with 0% error rate**.
- ✅ **Background tasks 4× duplication confirmed** — leader gate (PR-2) is mandatory before prod cutover.
- ✅ **No deadlock observed** in 11-min sweep (but ETL deadlock risk requires longer soak).
- ✅ **Prod (8083) unaffected** during spike — no restarts, journalctl clean.

**Recommendation**: Block PR-3 prod cutover. Two prereqs before retry:
1. **PR-2 leader gate** (covers background-task 4× duplication).
2. **NEW PR-1.5 (out of scope)**: tune `pool_size`/`max_overflow` on SQLAlchemy sync engine (currently default 5+10=15 per worker → 60 conns at 4 workers, blowing 100-conn cap on shared cluster). Either lower per-worker pool to 2+5=7 (28 conns total) **or** raise PG `max_connections` to 200. See §5.

---

## 1. 配置对比

| Config | Workers | Process count | ONNX load | RSS sum | asyncpg cretas | asyncpg smartbi (idle) | asyncpg smartbi (after stress, leaked) |
|---|---|---|---|---|---|---|---|
| baseline (single) | 1 | 1 | 1× | ~535 MB | 5 | 5 | (no leak) |
| multi-worker-4 | 4 | 1 master + 1 tracker + 4 spawn workers = 6 | 4× | ~2,700 MB | 18 | 12 | **41** |

DB connection budget per worker: ~5 cretas (asyncpg) + ~3 smartbi (asyncpg) + 5–15 smartbi (SQLAlchemy sync, default `pool_size=5, max_overflow=10`). 4 workers under stress → up to 60 SQLAlchemy conns alone, exceeding PG `max_connections=100` once Java JDBC pools (~30 conns) are added.

### Endpoint substitution (deviation from marching order)

Marching order specified `analysis/dashboard?period=year_to_date` as the heavy endpoint. **Python service has no such path** (returns 404 — only Java has it; nginx layer does the rewrite for T6 cutover). Closest matches by response weight:

| Path | Status | Size |
|---|---|---|
| `analysis/sales` (YTD, JSON) | 200 | 18.6 KB |
| `analysis/inventory` (YTD) | 200 | 4.1 KB |
| `analysis/finance` (YTD) | 200 | 2.7 KB |

Picked `analysis/sales?startDate=2026-01-01&endDate=2026-05-07` as heavy substitute (largest response = most JSON serialization GIL pressure, also a key T6 endpoint). Light endpoint `alerts` matches marching order verbatim.

### wrk percentile note

wrk default `--latency` outputs **p50 / p75 / p90 / p99**, not p95. **p90 reported in lieu of p95** below. Difference is small at low concurrency, more meaningful at high concurrency (where the long tail matters most).

### wrk thread count rule

wrk requires `threads ≤ connections`. For c=1 the script uses `-t1`; for c=5/10/50/100 uses `-t4`. (First single-worker run had `-t4` for c=1 → wrk bailed out with "number of connections must be >= threads"; rerun corrected.)

---

## 2. Performance — `analysis/sales` (heavy, ~18 KB JSON, full-year aggregation)

| Concurrency | Mode | p50 (ms) | p75 (ms) | p90 (ms) | p99 (ms) | RPS | total req | err% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1   | single | **5.94** | 6.12 | 6.36 | **7.82** | **166.10** | 9,972 | 0.0% |
| 1   | 4-worker | 25.78 | 45.51 | 46.76 | 48.14 | 50.77 | 3,048 | 0.0% |
| 5   | single | 21.40 | 23.20 | 25.30 | 113.69 | 181.36 | 10,889 | 0.0% |
| 5   | 4-worker | **8.83** | 46.90 | 48.94 | 53.99 | 185.65 | 11,145 | 0.0% |
| 10  | single | 43.24 | 45.96 | 49.73 | 196.31 | 176.07 | 10,572 | 0.0% |
| 10  | 4-worker | **13.90** | 48.93 | 53.87 | **62.95** | **315.80** | 18,962 | 0.0% |
| 50  | single | 265.97 | 294.17 | 476.17 | **547.61** | 156.25 | 9,381 | **0.0%** |
| 50  | 4-worker | 94.92 | 140.87 | 212.07 | 570.90 | 436.19 | 26,200 | **66.99%** ⛔ |
| 100 | single | 749.16 | 763.72 | 785.52 | **875.84** | 146.68 | 8,806 | **0.0%** |
| 100 | 4-worker | 226.99 | 329.92 | 527.29 | **1,130.00** | 370.27 | 22,251 | **85.15%** ⛔ |

### Sales reading

- c=1: **multi-4 dramatic regression** (p50 5.9ms → 25.8ms, RPS 166 → 51). Single worker handles low-load far better. Possible causes: socket dispatch round-robin, asyncpg pool not warm in unloaded workers, or wrk keep-alive coordination cost across workers.
- c=5: multi-4 wins on p50 (median request fast) but tail p90/p99 similar. Throughput parity.
- c=10: multi-4 clearly wins — p99 63ms vs 196ms (3× better), 1.8× throughput.
- c=50: multi-4 has lower p50/p75/p90 BUT 67% error rate from PG slot exhaustion. Apples-to-oranges; multi-4 *can* serve fast but starves on DB conns.
- c=100: same story; 85% error rate, p99 above 2000ms-ish target only when error responses included.

## 3. Performance — `alerts` (light, ~580 B JSON, no heavy DB query)

| Concurrency | Mode | p50 (ms) | p75 (ms) | p90 (ms) | p99 (ms) | RPS | total req | err% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1   | single | **2.99** | 3.14 | 3.32 | **4.22** | **327.57** | 19,665 | 0.0% |
| 1   | 4-worker | 26.06 | 42.85 | 43.96 | 45.14 | 59.61 | 3,579 | 0.0% |
| 5   | single | 11.62 | 12.13 | 12.79 | 17.29 | 335.97 | 20,169 | 0.0% |
| 5   | 4-worker | **7.53** | 42.88 | 44.28 | 46.60 | 232.71 | 13,971 | 0.0% |
| 10  | single | 22.60 | 23.57 | 24.78 | 32.93 | 344.23 | 20,666 | 0.0% |
| 10  | 4-worker | **6.02** | 43.52 | 45.13 | **49.85** | **444.66** | 26,695 | 0.0% |
| 50  | single | 133.68 | 141.16 | 188.57 | 356.30 | 317.37 | 19,056 | 0.0% |
| 50  | 4-worker | 54.72 | 86.95 | 106.20 | **279.54** | **848.07** | 50,928 | **0.0%** |
| 100 | single | 283.62 | 301.58 | 502.96 | 535.82 | 304.76 | 18,300 | 0.0% |
| 100 | 4-worker | 99.03 | 183.64 | 260.54 | **490.28** | **917.69** | 55,129 | **0.0%** |

### Alerts reading

- c=1: same low-concurrency regression as sales (p50 3 → 26ms, RPS 327 → 60). The pattern is endpoint-agnostic.
- c=5+: multi-4 throughput keeps climbing where single saturates around c=10.
- c=100 alerts: multi-4 sustains 0% errors at 918 RPS, p99 490ms — **clear win** when no DB pool pressure.
- The contrast with c=50/100 sales (errors) confirms the bottleneck is **DB pool**, not workers themselves.

---

## 4. Memory + asyncpg observations

### Single worker (baseline)

- Initial RSS: 529 MB (post-startup, ONNX + LLM clients loaded)
- Peak RSS during stress: 580 MB (modest 50 MB growth)
- System available memory: 4.6 → 5.1 GB throughout sweep (no pressure)
- asyncpg conns: 5 cretas + 5 smartbi = **10 total per worker** (mid-stress snapshot)

### 4-worker

- Per-worker RSS at warmup: ~640–690 MB (4 workers ≈ 2,700 MB total + 21 MB master + 7 MB tracker)
- Master process barely used (21 MB) — workers do all the work
- System memory during stress: available floor 3.4 GB (vs 4.7 GB single-worker baseline)
- Swap usage: stable at ~5.1 GB throughout (cgroup-reported 14 Gi total, ~6 GB swap)
- **smartbi_db connection LEAK observed**: 12 conns at warmup → **41 conns post-stress**. SQLAlchemy `pool_size=5, max_overflow=10` per worker × 4 workers = up to 60. Did not release after stress ended (idle-but-checked-out).

### Initial misconfiguration (resolved before measurements were taken)

The first attempt to switch to `--workers 4` sourced `.env.test` directly. **`.env.test` uses Java-style env var names** (`DB_NAME`, `SMARTBI_DB_NAME`); Python service expects `POSTGRES_DB`/`FOOD_KB_POSTGRES_DB`. So workers fell back to defaults pointing at **prod** databases (`smartbi_prod_db`, `cretas_prod_db`), causing 500s and `password authentication failed for user "cretas_user"` log spam.

**Resolved** by extracting the canonical launch line from `restart-test.sh` (which inlines the correct env-var prefix) and adding `--workers 4` to it. Multi-worker measurements above were taken AFTER this fix.

**Implication for PR-3 prod cutover**: only update `cretas-python.service` ExecStart in-place to add `--workers 4`. Do **not** change env file source. Prod systemd unit already uses `EnvironmentFile=` correctly with the right var names.

---

## 5. Anomalies during multi-worker run

### Background task 4× duplication (CONFIRMED)

Log shows 4 copies of all five background-task arming lines:
```
2026-05-07 08:21:06,844 [startup] template embedding index has 321 rows, skipping populate
2026-05-07 08:21:06,844 [startup] template embedding index has 321 rows, skipping populate
2026-05-07 08:21:06,847 [startup] chat-session 30-min pruner armed
2026-05-07 08:21:06,848 [startup] chat-session 30-min pruner armed
... (×4 each)
```

PR-2 leader gate is **mandatory** for prod. The first incident (during the misconfigured run) showed `[restaurant-etl] tick failed: password authentication failed` 4× — even bad credentials get retried 4×, and with correct creds, every ETL tick would attempt 4× concurrent INSERT writes, which is exactly the deadlock scenario the plan §背景 predicted.

### PG connection slot exhaustion at c=50/100 sales (NEW FINDING — not in plan)

```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError)
connection to server at "localhost" (::1), port 5432 failed:
FATAL:  remaining connection slots are reserved for non-replication superuser connections
```

Root cause analysis:
- PG `max_connections = 100` (default), `superuser_reserved_connections = 3` → 97 usable
- Java backends (prod 10010 + test 10011) each have JPA pool ~10 conns to cretas + 5 to smartbi → ~30 JDBC conns idle baseline
- 4 Python workers × asyncpg pools (~3 cretas + 2 smartbi each) = ~20 idle baseline
- 4 Python workers × SQLAlchemy sync engine pool (default `pool_size=5, max_overflow=10`) under stress can grow to 15 per worker = **60 conns at peak**
- Total under stress: ~30 (JDBC) + ~20 (asyncpg) + ~60 (SQLAlchemy) = ~110 → **over the 97 cap** → `FATAL` returned to clients as 500s

Net: at c=50 sales, 67% of requests got 500s before reaching response stage. At c=100 sales, 85%. Light `alerts` endpoint avoided this because it doesn't go through the SQLAlchemy sync engine code path (alerts uses asyncpg directly via materialized analytics).

This is the **most important finding** of the spike — naïve `--workers 4` will brownout T6.3 traffic.

### No deadlock observed in 11-min stress window

But the spike does NOT load-test the `restaurant-etl` task (hourly cadence, not exercised in 11 min). Real deadlock risk requires longer soak — recommend 24h test-env soak post-PR-2.

### No socket errors / wrk timeouts

All 10 wrk runs completed cleanly from the wrk side. Errors were all 5xx returned by Python, not network failures.

### Prod (8083) unaffected

- Health 200 throughout
- Uptime 3h 44m at end of spike (no systemd restart)
- `journalctl -u cretas-python --since 08:00 --until 08:42` clean

---

## 6. 推荐 (`--workers N` for prod)

### Recommendation: ⛔ DO NOT proceed to PR-3 yet

Two prereqs before prod cutover, in order:

**A. PR-1.5 (NEW — out of original scope)**: Resolve PG connection budget exhaustion. Two viable options:

| Option | Action | Pros | Cons |
|---|---|---|---|
| A1 | Lower SQLAlchemy `pool_size=2, max_overflow=3` per worker (5 max × 4 = 20 instead of 60) | Minimal infra change; pool is in-app config | Risk of pool exhaustion within a worker if heavy concurrent reads |
| A2 | Raise PG `max_connections` from 100 → 200 (`postgresql.conf` + restart) | Generous budget, no code change | PG restart required; ~50MB extra RAM |
| A3 | Both A1+A2 (defense-in-depth) | Safe under any worker count | Two changes to deploy |

Recommended: **A2 alone** if PG can be restarted (cleanest); else A1 + A2 for safety.

**B. PR-2 leader gate** (already in plan): file-lock leader election for the 5 background tasks. `restaurant_etl` 4× concurrent INSERT is the hard blocker; the other 4 are wasteful but idempotent.

After A + B: re-run this spike on test env. If c=50/100 sales drop to 0% errors, then proceed to PR-3 with **N=4**.

### Why not N=2 as a compromise?

| N | Memory | DB conns at peak | c=10 RPS gain | c=100 RPS gain | err at c=100 sales |
|---|---|---|---|---|---|
| 1 | 535 MB | ~25 | (baseline) 176 | (baseline) 147 | 0% |
| 2 | ~1.3 GB | ~50 | _est_ 250 | _est_ 250 | _est_ 0% |
| 4 | ~2.7 GB | up to 110 | **316** | 370 | **85%** ⛔ |
| 8 | _>5 GB_ | _>200_ | _est saturate_ | _OOM risk_ | _est_ blown |

N=2 may be enough for T6.3's expected 50% factories load — likely under c=20 on prod given 12 active factories. **If A1+A2 (PG tuning) cannot land in time, fall back to N=2 as compromise**: halves both memory and DB pressure, still gains throughput at c=5–10 vs single worker, leader gate still required.

### Memory headroom math (prod)

- Prod 16GB (no swap pressure, single Python; no Java test env on same box for prod)
- Other services (Java prod, Embedding gRPC, PostgreSQL, Redis): ~5–6 GB used
- 4 workers ≈ 2.7 GB → fits with ~7 GB headroom
- 2 workers ≈ 1.3 GB → fits with ~9 GB headroom

Memory is **not** the bottleneck on prod. PG connection budget is.

### Why does multi-worker hurt c=1 latency?

Open question — needs follow-up investigation. Hypotheses:
1. **Socket dispatch overhead**: kernel SO_REUSEPORT-style routing between workers adds ~20ms per request even at single-connection load. Should be microseconds, but observed 22ms p50 increase across both endpoints suggests something more.
2. **asyncpg pool not warm**: each worker has its own pool, idle workers start from cold. wrk keep-alive routes to the same worker, but the spawned worker may be the "slow" one this run.
3. **uvicorn worker spawn coordination cost**: investigation needed by reading uvicorn source.

This is concerning for prod because real traffic is mostly low concurrency (single-user dashboard loads). **If we pick N=4, low-concurrency users may see 5× latency regression** (still ~50ms p99, well within UX budget, but a real regression). Worth noting.

---

## 7. Risks identified

| Risk | Severity | Trigger | Mitigation (PR backlog) |
|---|---|---|---|
| PG connection slot exhaustion at high concurrency | **HIGH** | confirmed @ c=50 sales (67% errors) | **PR-1.5: tune SQLAlchemy pool or raise PG max_connections** |
| `restaurant_etl` 4× concurrent INSERT → deadlock | HIGH | not exercised in 11-min spike, but predicted | PR-2 leader gate (Option A: file lock) |
| Other 4 background tasks 4× wasting cycles + DB writes | MEDIUM | confirmed startup log 4× | PR-2 leader gate |
| c=1 latency regression (5× p50, 5.5× lower RPS) | MEDIUM-LOW | confirmed | Investigate; may be acceptable if prod traffic mostly c≥5 |
| ONNX 4× load adds startup time | LOW | observed (~30s warmup) | systemd `Restart=always` self-heals |
| Memory leak over 24h | UNKNOWN | not exercised | Prod 24h soak post-cutover |
| Test env env-var convention drift (`.env.test` Java-style vs Python `POSTGRES_DB`) | LOW | resolved during spike | PR-3 must edit `cretas-python.service` ExecStart in-place, not env file |
| Spike's stress affecting prod (8083) | LOW | observed clean | Process isolation works as designed |

---

## 8. Reproducibility

Scripts on server (left in place; can be deleted by organizer):

- `/tmp/uvicorn-spike-stress.sh` — wrk sweep driver (5 conc × 2 ep × 60s + monitor)
- `/tmp/uvicorn-spike-switch-multi-v2.sh` — switches 8084 to `--workers 4` using restart-test.sh's env-var prefix
- `/tmp/parse-wrk.py` — parser for wrk output → JSON

Raw artifacts (server `/tmp/`, not committed):

- `results-single.txt`, `monitor-single.txt` — single-worker sweep
- `results-multi-4.txt`, `monitor-multi-4.txt` — 4-worker sweep

Token (test env JWT, 2h expiry, F001 super_admin) generated via:
```
JWT_SECRET=$(grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.test | cut -d= -f2-) python3 -c '...jwt.encode...'
```

To re-run after PR-1.5 + PR-2:
```bash
ssh root@47.100.235.168 'bash /tmp/uvicorn-spike-switch-multi-v2.sh'
# wait warmup
ssh root@47.100.235.168 'nohup bash /tmp/uvicorn-spike-stress.sh multi-4-v2 "$TOKEN" > /tmp/spike-driver.log 2>&1 &'
# wait ~11 min, scp results, parse, compare
ssh root@47.100.235.168 'bash /www/wwwroot/cretas/restart-test.sh'  # restore
```

---

## 9. Plan ref

- Plan: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` PR-1
- Marching order: `docs/superpowers/dispatch/2026-05-07-uvicorn-workers-pr1-marching-order.md`
- Successor PRs (decisions for organizer):
  - **PR-1.5** (new, this spike's recommendation): PG connection budget — tune SQLAlchemy pool OR raise `max_connections` to 200
  - **PR-2 leader gate**: file lock recommended (Option A); Option B/C if file lock has race issues. Background-task duplication confirmed.
  - **PR-3 prod cutover**: blocked on both PR-1.5 and PR-2 + a clean re-run of this spike with 0% errors at c=50/100 sales.
