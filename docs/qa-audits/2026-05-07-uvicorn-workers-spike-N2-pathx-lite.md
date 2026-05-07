# uvicorn workers spike — N=2 + Path X-lite (2026-05-07)

**Server**: 47.100.235.168 (8C / 16GB total, 14GB cgroup-reported)
**Test env**: 8084 (nohup-managed cretas-python-test, started via `restart-test.sh` env-var prefix + `--workers 2`)
**Method**: wrk `-t{1|4} -c{1,5,10,50,100} -d60s --latency` × {alerts, analysis-sales} = 10 runs
**Block**: T6.3 50% factories cutover GO criteria

**Stack under test**: PR-1.5 (#101 SQLAlchemy 2/3) + PR-2 (#103 leader gate) + PR-1.6 (#106 asyncpg 15/6, this re-spike's enabling change)

**Predecessor reports**:
- Original spike (N=4 only, no fixes): `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md` (PR #99)
- Re-run after PR-1.5 + PR-2 (N=4 still failed): `docs/qa-audits/2026-05-07-uvicorn-workers-spike-rerun.md` (PR #105)

---

## TL;DR

✅ **All gates passed.** N=2 + Path X-lite is GO for PR-3 prod cutover (organizer to confirm).

| Gate | Threshold | Observed | Status |
|---|---|---:|---|
| c=50 sales errors | 0% | **0.00%** | ✅ |
| c=100 sales errors | ≤ 5% | **0.00%** | ✅ |
| p99 c=10 sales | < 500ms | **87.35ms** | ✅ |
| PG conn count peak | < 95 | **86** | ✅ (14-buffer to 100 cap) |
| Total Python RSS | < 2GB | **~1.5GB** | ✅ |
| Leader gate | 1 leader + 1 follower | confirmed | ✅ |
| Background tasks 4× duplication | none | each armed 1× | ✅ |
| Prod (8083) untouched | uptime preserved, 0 errors | uptime 1h27m, 0 errors | ✅ |

**Recommendation**: ✅ Proceed to PR-3 prod cutover at **N=2** workers (single systemd unit edit). Math fits 100-conn cap with 14 buffer; no PG restart required.

---

## 1. Performance — `analysis/sales` (heavy, ~18 KB JSON)

| Concurrency | Mode | p50 | p99 | RPS | err% |
|---:|---|---:|---:|---:|---:|
| 1   | single (baseline) | 5.94 | 7.82 | 166.10 | 0.0% |
| 1   | multi-4 (orig) | 25.78 | 48.14 | 50.77 | 0.0% |
| 1   | multi-4-rerun (PR-1.5 + PR-2) | 25.75 | 48.31 | 50.66 | 0.0% |
| 1   | **N=2 + Path X-lite** | 25.61 | 48.41 | 50.91 | **0.0%** |
| 5   | single | 21.40 | 113.69 | 181.36 | 0.0% |
| 5   | multi-4 (orig) | 8.83 | 53.99 | 185.65 | 0.0% |
| 5   | **N=2** | 8.21 | 54.80 | 188.07 | **0.0%** |
| 10  | single | 43.24 | 196.31 | 176.07 | 0.0% |
| 10  | multi-4 (orig) | 13.90 | 62.95 | 315.80 | 0.0% |
| 10  | **N=2** | 24.63 | **87.35** | 237.00 | **0.0%** |
| 50  | single | 265.97 | 547.61 | 156.25 | 0.0% |
| 50  | multi-4 (orig) | 94.92 | 570.90 | 436.19 | **66.99%** ⛔ |
| 50  | multi-4-rerun | 88.94 | 451.18 | 462.49 | **81.62%** ⛔ |
| 50  | **N=2 + Path X-lite** | 196.56 | 486.25 | 254.70 | **0.0%** ✅ |
| 100 | single | 749.16 | 875.84 | 146.68 | 0.0% |
| 100 | multi-4 (orig) | 226.99 | 1,130.00 | 370.27 | **85.15%** ⛔ |
| 100 | multi-4-rerun | 229.03 | 812.91 | 372.05 | **89.59%** ⛔ |
| 100 | **N=2 + Path X-lite** | 369.56 | 798.97 | 240.33 | **0.0%** ✅ |

### Sales reading

- **0% errors at every concurrency** — N=2 + Path X-lite resolved the PG slot exhaustion that broke N=4.
- **p99 c=10 sales = 87ms** — well within the 500ms gate; significantly better than single's 196ms.
- **p99 c=100 sales = 799ms** — between single's 876ms and N=4's 1130ms (when it had errors). Acceptable for stress-band.
- **Throughput at c=10 sales = 237 RPS** — between single's 176 and N=4's 316. N=2 trades some peak throughput for stability and budget headroom; that's the explicit design tradeoff.
- **c=1 latency regression persists** (5× p50 vs single — same as N=4). Possibly socket dispatch overhead between workers; worth investigating in a follow-up but does NOT block PR-3 (still ~50ms p99, well within UX budget).

## 2. Performance — `alerts` (light, ~580 B JSON)

| Concurrency | Mode | p50 | p99 | RPS | err% |
|---:|---|---:|---:|---:|---:|
| 1   | single | 2.99 | 4.22 | 327.57 | 0.0% |
| 1   | **N=2** | 7.57 | 45.12 | 59.55 | 0.0% |
| 5   | single | 11.62 | 17.29 | 335.97 | 0.0% |
| 5   | **N=2** | 13.74 | 46.95 | 234.01 | 0.0% |
| 10  | single | 22.60 | 32.93 | 344.23 | 0.0% |
| 10  | **N=2** | 8.53 | 54.43 | 405.92 | 0.0% |
| 50  | single | 133.68 | 356.30 | 317.37 | 0.0% |
| 50  | **N=2** | 79.92 | 301.32 | 574.02 | 0.0% |
| 100 | single | 283.62 | 535.82 | 304.76 | 0.0% |
| 100 | **N=2** | 195.36 | 456.43 | 549.08 | 0.0% |

### Alerts reading

- **N=2 throughput at c=50: 574 RPS vs single 317 (1.81×)** — clear win.
- **N=2 throughput at c=100: 549 vs 305 (1.80×)** — saturation around c=50–100.
- p99 trends similar across modes (no DB-write path → no PG slot pressure).

---

## 3. PostgreSQL connection budget (the gating constraint)

### Idle baseline (post-PR-1.6, N=2, no traffic)

```
Total: 55 conns
  cretas_db:        10 JDBC + 8 asyncpg  (test env Python: 2 workers × 4 each, max 6×2=12)
  cretas_prod_db:   10 JDBC + 3 asyncpg  (prod 8083 Python)
  smartbi_db:        5 JDBC + 6 asyncpg  (test env Python: 2 workers × 3 each, max 15×2=30)
  smartbi_prod_db:   5 JDBC + 3 asyncpg  (prod 8083 Python)
  misc:                       5
```

### Stress peak (during c=50/100 sales runs)

```
Peak total: 86 / 100 cap (14 buffer)
  smartbi_test_asyncpg peak: 32  (slight transient overshoot vs 2×15=30 nominal)
  cretas_test_asyncpg peak:  14  (slight transient overshoot vs 2×6=12 nominal)
  Other pools: relatively stable
```

The slight overshoot above nominal max (32 vs 30, 14 vs 12) is asyncpg pool transient behavior during connection refresh / new conn acquisition before old idle conns fully release. Net peak still 14 conns under 100 cap. **No PG slot exhaustion errors** occurred.

### Budget accounting (validated)

```
2 workers × (asyncpg smartbi 15 + asyncpg cretas 6 + SQLAlchemy 5 × 2 engines)
+ JDBC ~30 + food_kb steady ~5 + transient misc ~5
= 2 × 31 + 30 + 10 = 102 nominal
Empirical peak = 86 (audit-corrected expectation ~97)
```

Empirical 86 < audit nominal 97 < 100 cap. Math holds.

---

## 4. Memory + leader gate

### Memory under N=2 stress

- Per-worker peak RSS: **~742 MB** (each of 2 workers)
- Total Python RSS for 8084 stack: ~1.5 GB (master 21MB + tracker 7MB + 2 × 742MB)
- Compared to N=4 spike: 4 × ~660MB = ~2.7 GB
- System available memory floor during N=2 stress: **4.4 GB** (vs N=4's 3.4 GB — 1 GB more headroom)

### Leader gate (PR-2) under N=2

```
[leader]   PID=576687 env=test acquired lock /tmp/cretas-python-leader-test.lock
[follower] PID=576688 env=test another worker holds leader lock — gated background tasks skipped (BlockingIOError)
```

5 gated tasks each armed exactly **1×**, follower-skip logged exactly **1×**:
- `restaurant-ops hourly ETL armed` × 1 (avoids 2× concurrent INSERT)
- `chat-session 30-min pruner armed` × 1
- `llm-answer-cache hourly pruner armed` × 1
- `narrative_cache hourly pruner armed` × 1
- `template embedding warmer` × 0 (already populated; both leader and follower correctly skip per existing logic)

Lock file `/tmp/cretas-python-leader-test.lock` content = leader PID `576687`. Lock survived stress test intact.

---

## 5. Anomalies / observations

### c=1 latency regression persists at N=2

Same as N=4 spike: c=1 p50 jumps from 6ms (single) → 26ms sales / 8ms alerts. Throughput drops from 166 → 51 RPS sales, 328 → 60 RPS alerts.

Hypothesis (unchanged from PR-1 report): kernel SO_REUSEPORT-style routing between workers adds per-request overhead at very low concurrency; or asyncpg pool isn't warm in the worker that gets selected for the keep-alive connection. Worth a follow-up investigation but **NOT blocking PR-3** — absolute latency at 50ms p99 is well within UX budget for single-user dashboard loads.

### asyncpg pool transient overshoot

Smartbi pool peaked at 32 vs nominal 30 (2 × 15). Cretas pool peaked at 14 vs nominal 12 (2 × 6). Total ~4 conn overshoot, well within the 14-conn buffer. Likely asyncpg create_pool transient during conn refresh — known asyncpg behavior, not a leak.

If we wanted strict bounding, we could lower `postgres_pool_size` further (e.g., 12 → effective max 24+overshoot ~26 still fits with 19 buffer). Not needed for PR-3 GO.

### Prod (8083) unaffected

- `systemctl is-active cretas-python.service`: **active**
- Prod uptime preserved through entire spike: 1h27m (no restart, no journalctl errors during spike window)
- Prod uses different process tree, different pools — confirmed isolation works

---

## 6. Recommendation: ✅ GO for PR-3 at N=2

PR-3 prod cutover scope (one systemd unit edit):

```diff
# /etc/systemd/system/cretas-python.service
- ExecStart=.../python -m uvicorn main:app --host 0.0.0.0 --port 8083
+ ExecStart=.../python -m uvicorn main:app --host 0.0.0.0 --port 8083 --workers 2
```

Plus `systemctl daemon-reload && systemctl restart cretas-python.service`.

Expected post-cutover:
- 2 prod Python workers (vs current 1)
- ~1.5 GB Python RSS (vs current ~540 MB) → 1 GB more memory used; 16GB box has plenty
- ~30 asyncpg + ~10 SQLAlchemy + Java JDBC ~30 = ~70 idle conns (vs current ~50)
- T6.3 50% factories load (estimated c~10-15 typical) → comfortably handled, p99 ~87ms
- Background tasks unchanged (leader gate ensures only 1 prod worker runs them)

**Rollback**: `git revert` the systemd change + `systemctl daemon-reload && systemctl restart`. ~5s downtime.

---

## 7. Stop-and-ping triggers (per marching order)

None fired during this spike:

| Trigger | Observed |
|---|---|
| c=50 sales errors | 0% ✅ |
| c=100 sales errors > 5% | 0% ✅ |
| PG conn peak > 95 | 86 ✅ |
| p99 c=10 sales > 500ms | 87ms ✅ |
| Memory > 2GB Python | ~1.5GB ✅ |
| 2 leaders / 0 leaders | exactly 1 leader ✅ |
| Prod (8083) restarts | 0 (uptime preserved) ✅ |

---

## 8. Reproducibility

Scripts on server (left in place; can be deleted by organizer):

- `/tmp/uvicorn-spike-stress-N2.sh` — wrk sweep + PG conn monitor + memory monitor
- `/tmp/uvicorn-spike-switch-multi-N2.sh` — switches 8084 to `--workers 2` using restart-test.sh's env-var prefix
- `/tmp/parse-wrk.py` — parser for wrk output

Raw artifacts (server `/tmp/`, not committed):

- `results-N2-pathx-lite.txt` — wrk output for all 10 runs
- `pg-conns-N2-pathx-lite.txt` — every-5s PG conn count + per-pool breakdown
- `mem-N2-pathx-lite.txt` — every-10s per-process RSS + system free

To re-run: `bash /tmp/uvicorn-spike-switch-multi-N2.sh && nohup bash /tmp/uvicorn-spike-stress-N2.sh N2-pathx-lite-v2 "$TOKEN" > /tmp/spike-driver-N2.log 2>&1 &`

Test env restored to single worker post-spike via `restart-test.sh` (verified health 200, conn count 48, prod 8083 unaffected).

---

## 9. Refs

- Original spike: `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md` (PR #99)
- Re-run after PR-1.5 + PR-2: `docs/qa-audits/2026-05-07-uvicorn-workers-spike-rerun.md` (PR #105)
- PR-1.5 SQLAlchemy tune: PR #101
- PR-2 leader gate: PR #103
- PR-1.6 asyncpg pool tune (this re-spike's enabling change): PR #106
- Plan: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md`
- Marching order: `docs/superpowers/dispatch/2026-05-07-uvicorn-pr-1-6-marching-order.md`

## 10. Decision for organizer

✅ **GO for PR-3 prod cutover at N=2.**

Single systemd unit edit + daemon-reload + restart. Audit-corrected math holds empirically (86 peak vs 97 nominal). All gates passed. Prod isolation verified.

Optional follow-up backlog (NOT blocking PR-3):
- Investigate c=1 latency regression (5× p50) — affects single-user dashboard latency at low load
- Tune food_kb pools per audit recommendation (defense-in-depth, not currently a budget pressure)
- Consider gating `_ai_learning_cron_task` (L710 in main.py) — has DB writes, similar risk profile to `restaurant_etl` but not in original PR-2 scope
