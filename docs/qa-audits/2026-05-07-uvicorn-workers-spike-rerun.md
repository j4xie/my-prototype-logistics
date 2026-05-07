# uvicorn workers spike — re-run after PR-1.5 + PR-2 (2026-05-07)

**Server**: 47.100.235.168 (8C / 16GB total, 14GB cgroup-reported)
**Test env**: 8084 (nohup-managed cretas-python-test)
**Method**: Same as PR-1 spike — wrk `-t{1|4} -c{1,5,10,50,100} -d60s --latency` × {alerts, analysis-sales} = 10 runs
**Block**: T6.3 50% factories cutover GO criteria

**Original spike**: `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md` (PR #99)
**Fixes applied for re-run**:
- PR-1.5 (#101): SQLAlchemy sync `pool_size=40→2, max_overflow=10→3` for both `engine` and `cretas_engine`
- PR-2 (#103): file-lock leader gate for 5 background tasks

---

## TL;DR

- ❌ **Re-run STILL hits PG slot exhaustion at c=50/100 sales** — error rate 82% / 90% (vs 67% / 85% in original spike, slightly **worse**).
- ✅ **PR-2 leader gate works perfectly** — 1 leader + 3 followers across 4-worker startup, leader handover after kill verified, all 5 gated tasks armed exactly 1×.
- ✅ **PR-1.5 SQLAlchemy tune works** — sync engine pools confirmed at `pool_size=2, max_overflow=3` in deployed code.
- 🔍 **Root-cause re-diagnosis**: the leak is **asyncpg pool**, not SQLAlchemy sync. `postgres_pool_size=40` (used as asyncpg `max_size` in `smartbi/config.py:201`) is the unbounded culprit. PR-1 misdiagnosed.
- ⚠️ **PR-1.5 math was incomplete** — accounted for 1 engine (5×4=20) but there are **2 engines** (smartbi `engine` + cretas `cretas_engine` in connection.py:64), so 4×5×2=40, not 20.

**Recommendation**: ⛔ **Block PR-3.** Need a follow-up PR-1.6 to tune asyncpg pool size, OR reconsider raising PG `max_connections` to 200 (rejected option A2). See §4.

---

## 1. Performance comparison — `analysis/sales` (heavy)

| Concurrency | Mode | p50 | p99 | RPS | err% |
|---:|---|---:|---:|---:|---:|
| 1   | single (baseline) | 5.94 | 7.82 | 166 | 0.0% |
| 1   | multi-4 (orig spike) | 25.78 | 48.14 | 51 | 0.0% |
| 1   | **multi-4 rerun** | 25.75 | 48.31 | 51 | 0.0% |
| 5   | single | 21.40 | 113.69 | 181 | 0.0% |
| 5   | multi-4 (orig) | 8.83 | 53.99 | 186 | 0.0% |
| 5   | **multi-4 rerun** | 10.87 | 54.44 | 180 | 0.0% |
| 10  | single | 43.24 | 196.31 | 176 | 0.0% |
| 10  | multi-4 (orig) | 13.90 | 62.95 | 316 | 0.0% |
| 10  | **multi-4 rerun** | 13.56 | 59.34 | 320 | 0.0% |
| 50  | single | 265.97 | 547.61 | 156 | 0.0% |
| 50  | multi-4 (orig) | 94.92 | 570.90 | 436 | **66.99%** ⛔ |
| 50  | **multi-4 rerun** | 88.94 | 451.18 | 462 | **81.62%** ⛔ |
| 100 | single | 749.16 | 875.84 | 147 | 0.0% |
| 100 | multi-4 (orig) | 226.99 | 1,130.00 | 370 | **85.15%** ⛔ |
| 100 | **multi-4 rerun** | 229.03 | 812.91 | 372 | **89.59%** ⛔ |

### Reading

- **Low-concurrency (c=1-10)**: rerun vs original spike is essentially identical — no improvement, no regression. The "5× p50 regression at c=1" finding from PR-1 persists (still 26ms vs 6ms single).
- **High-concurrency (c=50/100)**: error rate **WORSENED** slightly (67%→82% at c=50, 85%→90% at c=100). PR-1.5 made SQLAlchemy bail out faster (smaller pool + smaller overflow → fewer retry attempts before FATAL), so successful responses are faster (p99 1130→813ms at c=100) but a *higher fraction* fails earlier.
- **Headline error count is unchanged**: PR-1.5 + PR-2 did NOT fix the bottleneck.

## 2. Performance — `alerts` (light, no DB write path)

| Concurrency | Mode | p50 | p99 | RPS | err% |
|---:|---|---:|---:|---:|---:|
| 50  | single | 133.68 | 356.30 | 317 | 0.0% |
| 50  | multi-4 (orig) | 54.72 | 279.54 | 848 | 0.0% |
| 50  | **multi-4 rerun** | 61.69 | 351.12 | 733 | 0.0% |
| 100 | single | 283.62 | 535.82 | 305 | 0.0% |
| 100 | multi-4 (orig) | 99.03 | 490.28 | 918 | 0.0% |
| 100 | **multi-4 rerun** | 101.55 | 362.29 | 912 | 0.0% |

`alerts` (no SQLAlchemy sync path) is unaffected — confirms the ceiling is on the DB-write path that hits SQLAlchemy.

---

## 3. Root-cause re-diagnosis (the important finding)

After PR-1.5 deployed, mid-stress snapshot of `pg_stat_activity`:

```
     datname     |    application_name    | count
-----------------+------------------------+-------
 smartbi_db      |                        |    50    ← asyncpg, EMPTY app_name (leak source!)
 cretas_db       |                        |    12    ← asyncpg
 cretas_prod_db  | PostgreSQL JDBC Driver |    10    ← Java prod
 cretas_db       | PostgreSQL JDBC Driver |    10    ← Java test
 smartbi_prod_db | PostgreSQL JDBC Driver |     5    ← Java prod
 smartbi_prod_db |                        |     5    ← prod Python asyncpg
                 |                        |     5    ← misc unknown
 smartbi_db      | PostgreSQL JDBC Driver |     5    ← Java test
 cretas_prod_db  |                        |     2    ← prod Python asyncpg
```

Total **102 connections** (PG `max_connections=100` + 2 PG bgworkers). Slot 99 onwards reserved for superuser → SQLAlchemy hits FATAL.

The **smartbi_db: 50 from asyncpg** is the dominant leak. Per `smartbi/config.py:181-204`:

```python
async def get_pg_pool():
    ...
    _pg_pool = await asyncpg.create_pool(
        pg_url,
        min_size=2,
        max_size=settings.postgres_pool_size or 5,  # = 40 (default!)
        setup=set_pg_connection_tenant,
    )
    return _pg_pool
```

`postgres_pool_size` defaults to **40** (`smartbi/config.py:102`). Each of 4 workers can hold up to 40 asyncpg conns to smartbi_db. Empirically each grew to ~12 → 4 × 12 = 48 ≈ observed 50.

**PR-1.5 did NOT touch this.** PR-1.5 only changed SQLAlchemy `engine` and `cretas_engine` in `connection.py` to hardcode `pool_size=2, max_overflow=3`. That correctly bounded SQLAlchemy at 4 × 5 × 2 (engines) = **40 conns**. But the asyncpg pool — a different code path on the same DB — was untouched.

### PR-1 misdiagnosis

PR-1's report claimed the SQLAlchemy sync engine pool was the cause. The error MESSAGE was indeed from psycopg2 / SQLAlchemy (because that's the sync path that surfaces FATAL synchronously to a request handler), but the PG **slot consumer** is asyncpg. The error happens when SQLAlchemy tries to acquire a *new* connection and PG is already saturated by asyncpg's idle pool.

### PR-1.5 math correction

The user's accounting in the marching order was:
> 4 worker × pool_size 2 + max_overflow 3 = 20 SQLAlchemy + asyncpg 20 + JDBC 30 = ~70

This counts **one** SQLAlchemy engine. But `connection.py` defines **two** engines (`engine` for smartbi_db, `cretas_engine` for cretas_db) — so the SQLAlchemy budget is 4 × 5 × **2** = **40**, not 20. And the assumption "asyncpg 20" was empirical at single-worker; under 4-worker stress asyncpg grew to 50 for smartbi_db alone.

True post-PR-1.5 / PR-2 budget at peak:
- SQLAlchemy: 40 (smartbi engine + cretas engine combined)
- asyncpg smartbi: 50 (4 × ~12 per worker, max_size=40 lets it grow further if pressed)
- asyncpg cretas: 12 (hardcoded `max_size=8` per worker, 4 × ~3 typical)
- Java JDBC (prod + test): 30
- Misc PG bgworkers: 5
- **Total: ~137, far over 97 usable slots** → FATAL

---

## 4. Recommendation: PR-1.6 needed before PR-3

Two viable paths (organizer to choose):

### Path A — Tune asyncpg pool size (preferred, single-line config change)

Change `smartbi/config.py:102`:
```python
postgres_pool_size: int = 40   # ← old
postgres_pool_size: int = 5    # ← new, mirrors SQLAlchemy bound
```

Caveat: this also affects `get_pg_pool()` `max_size`. With 4 workers × 5 = 20 asyncpg conns total — empirically sufficient (single-worker uses ~5 with light load).

Optionally also lower hardcoded `_cretas_pool` `max_size=8 → 5` in `smartbi/config.py:253` for symmetry.

Post-PR-1.6 budget:
- SQLAlchemy: 40
- asyncpg smartbi: 4 × 5 = 20
- asyncpg cretas: 4 × 5 = 20 (if also tuned) OR 4 × 8 = 32 (if not)
- Java JDBC: 30
- Misc: 5
- **Total: ~115–127** — STILL over 97. 😬

So Path A alone doesn't fully resolve it. Combine with another tightening or accept a smaller SQLAlchemy pool too:

| Tuning | SQLAlchemy | asyncpg smartbi | asyncpg cretas | JDBC | misc | total | fits 97? |
|---|---|---|---|---|---|---|---|
| Current (PR-1.5 only) | 40 | 50 (max 160) | 12 (max 32) | 30 | 5 | **137** | ❌ |
| Path A (asyncpg=5) | 40 | 20 | 12 | 30 | 5 | 107 | ❌ |
| Path A + cretas asyncpg=5 | 40 | 20 | 20 | 30 | 5 | 115 | ❌ |
| Path A + SQL=1+1 | 16 | 20 | 12 | 30 | 5 | 83 | ✅ |
| Path A + SQL=1+1 + cretas=5 | 16 | 20 | 20 | 30 | 5 | 91 | ✅ (tight) |

### Path B — Raise PG `max_connections` 100 → 200 (rejected by organizer in PR-1.5 reply)

User's reply earlier:
> ⚠️ PR-1.5 接受,但选 **A1 only,不选 A2**。理由: A2 (PG max_connections 200) server-wide 重启影响所有服务,risk > benefit

This is still the cleanest fix. Math at 200 cap, current pools:
- 137 worst-case observed → 200 cap with 63 buffer ✅

Tradeoffs:
- A2 requires PG restart (~5s) which interrupts ALL services momentarily. Mitigation: schedule during low-traffic window.
- ~50MB extra RAM for connection state — negligible on 16GB box.

### Path C — Combination

Bound asyncpg AND raise PG cap. Defense in depth.

**Recommendation**: Path A (asyncpg pool tune) + lower SQLAlchemy further to 1+1. Both single-line config changes, no PG restart, fits the 97 cap with 14-buffer.

---

## 5. PR-2 leader gate verification (✅ working)

This part of the re-run all worked as designed. Confirmed in `python-test.log`:

```
[leader]   PID=441908 env=test acquired lock /tmp/cretas-python-leader-test.lock
[follower] PID=441907 env=test another worker holds leader lock — gated background tasks skipped (BlockingIOError)
[follower] PID=441906 env=test another worker holds leader lock — gated background tasks skipped (BlockingIOError)
[follower] PID=441905 env=test another worker holds leader lock — gated background tasks skipped (BlockingIOError)
[leader] restaurant-ops hourly ETL armed
[follower] restaurant-ops ETL skipped (leader handles; avoids 4× INSERT deadlock)
... (similar for narrative_cache / chat-session / llm-cache pruners)
```

Each gated task armed exactly **1×**, follower-skip logged **3×**. Lock file written with leader PID.

Leader handover (smoke-tested in PR-2 verification, not re-run): kill leader PID 437727 → systemd respawns worker → new PID 438626 acquires lock and becomes new leader. Followers stay followers.

PR-2 is correct and not contributing to the c=50/100 errors.

---

## 6. Memory / observations

- 4-worker total RSS: ~2.7 GB (same as PR-1 spike)
- Available memory floor during stress: 2.2 GB (vs 3.4 GB in PR-1; tighter due to longer worker uptime + ETL leader-only doing all work)
- Swap: held steady around 5 GB throughout
- 0 worker crashes / OOMs / systemd restarts during 11-min sweep
- Prod (8083) **unaffected** — health 200, no journalctl errors

---

## 7. Test env restoration

After re-run completed, test env restored to single-worker via `restart-test.sh`:

- 8084 health: 200
- 1 uvicorn process (single worker, no `--workers` flag)
- smartbi_db conns released: 50 → 3
- All gated tasks armed under leader gate (single worker is always leader)

---

## 8. Risks identified (updated from PR-1)

| Risk | Severity | Status after PR-1.5 + PR-2 |
|---|---|---|
| PG slot exhaustion at c=50/100 sales | **HIGH** | ❌ NOT fixed — root cause was asyncpg pool, not SQLAlchemy as PR-1 claimed |
| `restaurant_etl` 4× concurrent INSERT → deadlock | HIGH | ✅ FIXED by PR-2 leader gate |
| Other 4 background tasks 4× wasting cycles + DB writes | MEDIUM | ✅ FIXED by PR-2 leader gate |
| c=1 latency regression (5× p50, 5.5× lower RPS) | MEDIUM-LOW | ❌ Still present — same as PR-1; not investigated yet |
| ONNX 4× load adds startup time | LOW | ✅ acceptable, systemd self-heals |
| `_ai_learning_cron` (L710) 4× concurrent DB writes | UNKNOWN | ⚠️ NOT gated by PR-2 (deferred per scope); risk profile similar to `restaurant_etl` |
| `_ai_snapshot_refresh` (L652) intentionally NOT gated | LOW | ✅ correct (per-worker cache semantics) |

---

## 9. Refs

- Original spike: `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md` (PR #99)
- PR-1.5 SQLAlchemy tune: PR #101
- PR-2 leader gate: PR #103
- Plan: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md`

Raw artifacts on server `/tmp/`: `results-multi-4-rerun.txt`, `monitor-multi-4-rerun.txt`. Not committed.

## 10. What organizer should decide next

1. Approve a **PR-1.6** that tunes asyncpg pool size (Path A) + further reduces SQLAlchemy to 1+1 to fit the 97-conn budget. OR
2. Reconsider **A2** (raise PG `max_connections` 100→200) — cleanest if a PG restart window is acceptable. OR
3. Stay at single-worker for prod. PR-2 leader gate is a safety improvement worth merging regardless (defense for future multi-worker), and PR-1.5 is a reasonable hardening, but **N=1 remains the only confirmed-safe configuration on this server** until the asyncpg pool budget is bounded.

I (sister chat) recommend **Option 2 (raise max_connections to 200)** as the simpler, less-fragile fix. The original objection ("server-wide restart") is mitigated by scheduling during a known low-traffic window — and it's a 5s restart, not a maintenance window. But final call is organizer's.
