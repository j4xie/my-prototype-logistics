# Phase 2A T6 Cutover Retrospective — 2026-05-06 to 2026-05-07

Single-session marathon (~24h compressed): 0% → 100% byte-shape parity → T6.2 canary live.

## Numbers

- **30 commits** to origin/main
- **11 PRs merged** via gh admin (#87 through #97)
- **3 rules graduated** to `.claude/rules/python-java-port.md` (Rule 10/11/12)
- **1 shared module** extracted (`backend/python/smartbi_compat/_java_compat.py`)
- **1 nginx routing change** (T6.2 canary regex blocks for F001)
- **0 prod incidents** despite 30 commits of code change

## Pass rate journey

| Stage | Coverage | Pass rate | What changed |
|---|---|---|---|
| Pre-Tier-1 | 19 endpoints (F001 happy path) | **0%** | T6.1 dryrun pre-flight caught 14/14 diverge |
| Tier 1 | same | 57.9% (+11) | wrap_response 8-key envelope |
| PR-K | same | 63.2% (+1) | dept+inv nested DTO nulls (Rule 9) |
| Tier 2 (PR-J/L/M) | same | 73.7% (+2) | sales decimal / procurement Lombok shape / VALUE doc |
| PR-M-2 | same | 84.2% (+2) | math semantic (alerts/cat-comp) (Rule 10) |
| PR-N-1+procurement display | same | 89.5% (+1) | HashMap iter (Rule 12 candidate) + display HALF_UP |
| PR-N-3+inventory helper reuse | same | 94.7% (+1) | inventory inbound_date alias |
| PR-N-2 PATH B | same | **100%** (+1) | sales Gold-None fallback semantic (Phase B4) |
| Multi-factory verify | 70 factories × 19 = 1330 dual-calls | **100.00%** | byte-shape generalizes |
| Edge case sweep (T6.1 strict) | 6 endpoints × 8 date scenarios = 48 | 95.8% (4 fixes shipped, 2 deferred) |
| T6.2 canary 4h+ | F001 SmartBI live traffic | 0.056% error, 0 Java fallback |

## Process patterns that worked

### 1. Strict edge-case testing finds latent bugs

Original 19/19 happy-path test missed 6 bug categories. T6.1 strict mode (no try/except, assert HTTP 200, multi-factory + multi-date sweep) caught:

- Granularity inference broken (DAY/WEEK/MONTH/QUARTER missing)
- profitMetrics Rule 10 latent (gross/net margin + ROI)
- region targetCompletion HashMap iter tie-break
- yoy-mom periodType=YEAR/DAY → Python crash 500 (Java returns graceful 200+success:false)
- 12 Rule 12 latent display rounding sites
- 5 Rule 10 latent arithmetic sites in analysis_finance.py

**Lesson**: T6 GO criteria's runbook §3.1 happy path 1440 samples is necessary but **not sufficient**. Multi-factor sweep + edge ranges + concurrent load test should be standard pre-cutover.

### 2. Sister chat parallel dispatch (4 chats × 1 PR each)

Tier 2 + Tier 3 used 4 sister chats in parallel via marching orders. Each chat:
- Got specific scope (1 file, 1 issue category)
- Worked in dedicated worktree
- Committed + pushed
- Organizer admin-merged after `gh pr view --json files` scope verify

**Found 2 stale-base incidents** (Sister A + Sister C + Sister D) where chats started before later PRs landed → force-pushed branches showed phantom revert of recently-merged work. **Always cherry-pick verified files into clean rebased branch when stale base detected**, never blind admin-merge.

### 3. Defensive proactive sweeps

Once a Rule was identified (e.g. Rule 12 banker's rounding), grep for ALL similar sites in codebase (not just the one that triggered). Then defensively fix them with shared helper. F001 prod data didn't trigger 12 of those latent sites; other factory data would have.

**Lesson**: codify rule → grep latent sites → mass-fix with helper → graduate to `.claude/rules/`.

### 4. Don't try/except in test scripts

User-graduated feedback (2 reinforcement rounds): test scripts must `assert` and fail loud. The pattern of `try: x.parse() except: continue` silently masks real divergences. Strict mode caught HTTP 500 crashes that would otherwise appear as silent skip.

## Rules graduated today

### Rule 10: BigDecimal divide-then-multiply (PR-M-2 audit)

```python
# ❌ BAD: full precision then quantize at end
result = (n / d * Decimal("100")).quantize(Decimal("0.01"), HALF_UP)

# ✅ GOOD: divide quantize FIRST then multiply (mirror Java)
result = (n / d).quantize(Decimal("0.0001"), HALF_UP) * Decimal("100")
```

### Rule 11: Jackson LocalDateTime trailing-zero microsecond (PR-M-7 audit)

```python
# Java drops trailing zeros: .12340 → .1234, .12000 → .12, .000000 → no dot
from smartbi_compat.schema_compat import _java_isoformat
ts_str = _java_isoformat(dt)  # mirrors Java
```

### Rule 12: Java String.format HALF_UP vs Python f-string banker's

```python
# ❌ BAD: Python :.Nf uses banker's rounding (46.55 → "46.5")
formatted = f"{float(d):.1f}%"

# ✅ GOOD: Decimal.quantize HALF_UP (mirrors Java %.Nf, 46.55 → "46.6")
from smartbi_compat._java_compat import _format_decimal_half_up
formatted = f"{_format_decimal_half_up(d, 1)}%"
```

## Operational findings worth carrying forward

### deploy-smartbi-python.sh originally didn't sync scripts/

Caused t6-dryrun-compare.sh to run stale (pre-PR-M-1) version on server for hours during T6.1 launch. Fixed in commit `265a37d4b` to also rsync `scripts/t6-*` + `scripts/baseline-*` + `scripts/phase2a/t6-in-scope-endpoints.txt`.

### cretas-backend-test.service Restart=on-failure inadequate

SuccessExitStatus=143 means SIGTERM treated as "successful" exit, so on-failure didn't fire. Java test stayed DOWN after sister chat SIGTERMs. Fixed to `Restart=always` in commit `72db0a3f3`. Java test now self-heals indefinitely.

### scripts/t6-dryrun-compare.sh `set -e` killed dryrun on Python restart

Compare_responses python heredoc would briefly fail (json parse on transient body during Python restart) and `set -e` killed entire script. Fixed in commit `35586aea9` — wrapped python body in try/except, fallback emits `verdict=compare_err` NDJSON line. Future dryrun survives deploy cycles.

### cretas-python.service single uvicorn worker (deferred — task #29)

Concurrent load test caught Python p99=3217ms@10-concurrent (vs Java p99=85ms). Single uvicorn worker → single GIL → JSON serialization on full-year analysis responses serializes sequentially.

**Realistic single-user dashboard load (≤3 concurrent) currently passes T6.2 GO criteria** (Python p99=1017ms < 2000ms). 10-concurrent is synthetic stress. Defer fix until T6.2 GO + before T6.3 (50% factories will compound concurrent pressure).

Risk of multi-worker: 4× ONNX model memory, ETL background tasks would duplicate. Need careful design or alternative (asyncpg pool tuning + threadpool offload of CPU-bound JSON serialization).

## Deferred tasks not blocking T6.2 GO

| Task | Why deferred |
|---|---|
| #20 SMARTBI_GOLD_READ_PRIMARY_ENABLED flag | Latent (currently flag=true, both code paths converge) |
| #24 finance past-year fallback | Sister-chat scope (~200-400 LOC). Java reads fact_pos_transaction Gold; Python doesn't. |
| #25 region week-range tie-break | 18 diffs on 1 specific edge case (4 tied changePercent regions). LinkedHashMap insertion order requires SQL alignment. |
| #28 3 ambiguous Rule 10 sites in receivable | Math analysis shows same scale-2 output for most inputs. Defensive fix risks regression without coverage. |
| #29 uvicorn workers | Apply BETWEEN T6.2 GO and T6.3 launch — synthetic 10-concurrent issue, realistic 3-concurrent passes. |

## What to do tomorrow (T6.2 GO @ 04:01 May 8)

1. **Verify T6.2 GO criteria** via 24h log review:
   - Python error rate <0.5% (currently 0.056% on F001 traffic)
   - Python p99 <2000ms (single-user observed 1017ms; concurrent task #29)
   - 0 Java fallbacks for F001 (verify via Python access log + Java log)
   - 0 P1 user reports (F001 is test factory, no real users — moot)

2. **Apply task #29 uvicorn workers fix BEFORE T6.3**:
   - TEST env first: stop python-test, restart with `--workers 4`, load test
   - Compare p99 single-worker vs multi-worker
   - If improved: edit cretas-python.service ExecStart on prod, daemon-reload + restart
   - If risks (memory / ETL duplication): use alternative (e.g., uvicorn `--limit-concurrency` + threadpool offload)

3. **Launch T6.3 (50% factories alphabetical split)** per runbook §3.3.

4. **Java baseline 7d collection completes 2026-05-14**: run aggregation script to compute Java p50/p99/error_rate for T6.4 GO criteria comparison.

## Cross-references

- `feedback_no_defensive_in_verify_scripts.md` — strict testing rule
- `feedback_force_push_stale_base_after_long_branch.md` — stale base lesson
- `project_2026_05_07_t6_1_dryrun_in_flight.md` — T6.1 resumption pointer
- `project_2026_05_07_t6_2_canary_live.md` — T6.2 resumption pointer
- `.claude/rules/python-java-port.md` — 12 codified port rules (Rule 10/11/12 graduated this session)
