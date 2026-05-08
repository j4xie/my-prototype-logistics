# T6.1 BG Dryrun — 22h Final Report

**Date**: 2026-05-09
**Author**: Chat 4 (BG dryrun monitor handoff)
**Source NDJSON**: `/var/log/cretas-t6-dryrun-20260508.ndjson` on server 47.100.235.168
**File size**: 7,155,198 bytes (6.82 MB)
**SHA-256**: `32f115254a0a4bc61c373830e742b3049524864b86cab2ff5b1bdef14f202074`
**Process**: PID 1237516, `bash /www/wwwroot/cretas/scripts/t6-dryrun-compare.sh --duration 22h --interval 60 --endpoints /tmp/t6-in-scope-endpoints.txt --python-base http://localhost:8083 --output /var/log/cretas-t6-dryrun-20260508.ndjson`
**Started**: Fri May 8 07:01:01 CST 2026
**Ended**: Sat May 9 05:01:44 CST 2026
**Runtime**: 22h 0m 43s
**Time span (NDJSON ts_first → ts_last)**: 2026-05-07T23:01:02.970660Z → 2026-05-08T21:00:31.801333Z (21h 59m 28s wall)

---

## §1 Verdict

**100.000000% match (24,814 / 24,814)** — full 22h period, zero diverges, zero errors.

**Recommendation: GO for T6 next phase progression** (PR #135 production smoke re-verification on May 9 13:01 CST and T6.4 Stage 1 cutover preparation), conditional on §X scope caveats below.

---

## §2 T6.1 GO Criteria Evaluation

| Criterion | Threshold | Observed | Result |
|---|---|---|---|
| Match rate | ≥ 99.9% | **100.000000%** (24814 / 24814) | ✅ PASS (+0.055pp vs T6.1 prior 99.945%) |
| Pattern B regression | 0 fires | **0** non-null diff records | ✅ PASS (see §X scope caveat) |
| Rule 8/9/10/11/12 fresh violation | 0 | **0** | ✅ PASS |
| p99 latency Java | < 500ms | 10ms | ✅ PASS (50× headroom) |
| p99 latency Python | < 500ms | 6ms | ✅ PASS (83× headroom) |
| Error rate Java | < 0.5% | **0.000%** (0 / 24814) | ✅ PASS |
| Error rate Python | < 0.5% | **0.000%** (0 / 24814) | ✅ PASS |
| `compare_err` (parse failures) | not blocking | **0** | ✅ PASS |

All 8 criteria pass. No conditional GO; full GO with scope-limitation acknowledgment in §X.

---

## §3 Verdict Distribution

| Verdict | Count | Percent |
|---|---|---|
| `match` | 24,814 | 100.000000% |
| `diverge` | 0 | 0.000000% |
| `java_err` | 0 | 0.000000% |
| `python_err` | 0 | 0.000000% |
| `both_err` | 0 | 0.000000% |
| `compare_err` | 0 | 0.000000% |

**HTTP status**: Java 200 × 24,814; Python 200 × 24,814. Zero non-2xx on either side over 22h.

**Diff records**: 0 non-null `diff` payloads (would populate on `diverge` with `j_only_keys` / `p_only_keys` for shape divergence — typical Pattern B signature). Strong evidence Pattern B did not fire **within scope** (see §X for what scope means).

---

## §4 Endpoint Coverage

**Factory**: F999 only (24,814 / 24,814).
**Unique endpoint paths**: 14.
**In-scope endpoint variants** (per `/tmp/t6-in-scope-endpoints.txt`): 19 (14 unique paths × multiple query-string variants for `/analysis/finance` analysisType).

| Endpoint | Samples |
|---|---|
| `/smart-bi/alerts` | 1,306 |
| `/smart-bi/analysis/department` | 1,306 |
| `/smart-bi/analysis/finance` (6 query variants combined) | 7,836 |
| `/smart-bi/analysis/finance/budget-achievement` | 1,306 |
| `/smart-bi/analysis/finance/category-comparison` | 1,306 |
| `/smart-bi/analysis/finance/yoy-mom` | 1,306 |
| `/smart-bi/analysis/inventory` | 1,306 |
| `/smart-bi/analysis/procurement` | 1,306 |
| `/smart-bi/analysis/region` | 1,306 |
| `/smart-bi/analysis/sales` | 1,306 |
| `/smart-bi/data-date-range` | 1,306 |
| `/smart-bi/datasource/list` | 1,306 |
| `/smart-bi/query-templates` | 1,306 |
| `/smart-bi/recommendations` | 1,306 |

`/smart-bi/analysis/finance` is sampled 6× more than peers because the in-scope file lists it with 6 distinct `analysisType` query variants (no qstring + payable + profit + cost + receivable + budget).

---

## §5 Latency

All samples 2xx; latency in milliseconds.

| Endpoint | Java p50 | Java p99 | Python p50 | Python p99 |
|---|---:|---:|---:|---:|
| `/smart-bi/alerts` | 4 | 7 | 4 | 8 |
| `/smart-bi/analysis/department` | 4 | 7 | 4 | 6 |
| `/smart-bi/analysis/finance` | 4 | 11 | 3 | 6 |
| `/smart-bi/analysis/finance/budget-achievement` | 3 | 7 | 3 | 4 |
| `/smart-bi/analysis/finance/category-comparison` | 3 | 7 | 3 | 5 |
| `/smart-bi/analysis/finance/yoy-mom` | 4 | 8 | 3 | 5 |
| `/smart-bi/analysis/inventory` | 4 | 7 | 3 | 5 |
| `/smart-bi/analysis/procurement` | 3 | 6 | 3 | 5 |
| `/smart-bi/analysis/region` | 4 | 7 | 4 | 6 |
| `/smart-bi/analysis/sales` | 7 | 14 | 5 | 10 |
| `/smart-bi/data-date-range` | 3 | 6 | 3 | 5 |
| `/smart-bi/datasource/list` | 3 | 7 | 3 | 5 |
| `/smart-bi/query-templates` | 3 | 6 | 3 | 5 |
| `/smart-bi/recommendations` | 4 | 7 | 4 | 6 |
| **Overall** | **4** | **10** | **3** | **6** |

Python is consistently faster than Java at p50 and p99 — confirms prior findings (T6.1 baseline + uvicorn N=2 spike). Slowest endpoint `/analysis/sales` p99 14ms Java / 10ms Python — still 35× under the 500ms gate.

---

## §6 Size-Delta Footprint (Pattern A/A2 Decimal Tolerance Evidence)

`size_delta = java.size - python.size` per match record (response body bytes).

| Statistic | Value |
|---|---|
| Sample count | 24,814 |
| Min | -1 |
| Max | +150 |
| Mean | +16.11 |
| Java bigger | 24,806 (99.97%) |
| Python bigger | 2 (0.008%) |
| Equal | 6 (0.024%) |

**Top size-delta values**:

| Delta (bytes) | Samples | % |
|---:|---:|---:|
| +3 | 6,413 | 25.84% |
| +6 | 4,652 | 18.75% |
| +18 | 1,850 | 7.46% |
| +9 | 1,848 | 7.45% |
| +21 | 1,077 | 4.34% |
| +12 | 1,066 | 4.30% |
| +24 | 1,058 | 4.26% |
| +147 | 1,052 | 4.24% |
| +7 | 912 | 3.68% |
| +5 | 875 | 3.53% |
| +4 | 754 | 3.04% |
| +2 | 657 | 2.65% |

The dominant +3 / +6 / +9 / +12 multiples-of-3 distribution is the Pattern A signature (per Rule 4 in `python-java-port.md`): Java `BigDecimal("100.00")` Jackson-serializes to `100.00` (6 chars) while Python `_decimal_to_number(Decimal("100.00"))` returns `int(100)` rendered as `100` (3 chars), yielding +3 bytes Java-bigger per integer-valued Decimal. Multiples (+6, +9, +12) reflect compound occurrences within a single response.

**Per-endpoint mean size delta** (consistent stable footprint across full 22h):

| Endpoint | Mean Δ | Range |
|---|---:|---|
| `/smart-bi/alerts` | +3.02 | [0, 6] |
| `/smart-bi/analysis/department` | +6.02 | [3, 9] |
| `/smart-bi/analysis/finance` | +13.0 | [-1, 23] |
| `/smart-bi/analysis/finance/budget-achievement` | **+147.02** | [144, 150] |
| `/smart-bi/analysis/finance/category-comparison` | +9.0 | [6, 12] |
| `/smart-bi/analysis/finance/yoy-mom` | +24.03 | [22, 27] |
| `/smart-bi/analysis/inventory` | +5.98 | [3, 9] |
| `/smart-bi/analysis/procurement` | +6.0 | [3, 9] |
| `/smart-bi/analysis/region` | +6.0 | [3, 9] |
| `/smart-bi/analysis/sales` | +8.99 | [5, 14] |
| `/smart-bi/data-date-range` | +3.0 | [0, 6] |
| `/smart-bi/datasource/list` | +3.02 | [0, 6] |
| `/smart-bi/query-templates` | +2.99 | [0, 6] |
| `/smart-bi/recommendations` | +2.98 | [-1, 5] |

The `budget-achievement` endpoint's high +147 mean reflects a Decimal-heavy waterfall+comparison structure (~49 integer-valued Decimal occurrences × 3 chars, consistent with Pattern A across the response shape). All other endpoints under +25, dominated by single-digit Pattern A occurrences.

**The 2 negative-delta samples (Python bigger by 1 byte each)** — both dict-eq `match`:

1. `2026-05-08T08:54:41Z` `/smart-bi/recommendations` (Java=154, Python=155)
2. `2026-05-08T19:04:14Z` `/smart-bi/analysis/finance?...analysisType=cost` (Java=704, Python=705)

These are within Pattern A/A2 tolerance — the +1 byte deltas reflect minor Decimal/string-formatting variations where Python's representation lands one character longer than Java's at a specific value, but `dict_eq` accepts numeric equivalence (e.g., `0` ≡ `0.0`, `100` ≡ `100.00`). No structural divergence; the contract surface is identical.

---

## §7 Comparison to T6.1 Prior Baseline

| Metric | T6.1 prior (PR #119, Apr 30) | T6.1 BG dryrun (this run) | Delta |
|---|---|---|---|
| Match rate | 99.945% | 100.000% | **+0.055pp** |
| Total samples | 1,144 | 24,814 | 21.7× |
| Wall duration | ~50min initial spike | 22h sustained | 26.4× |
| Diverge count | 11 (all budget Pattern A/A2) | 0 | -11 |
| Pattern B fires | 0 | 0 | unchanged |
| Java p99 | not recorded | 10ms | n/a |
| Python p99 | not recorded | 6ms | n/a |

The 11 diverges in the prior baseline were attributed to budget endpoint Pattern A/A2 trailing-zero / int-collapse byte deltas which the dict-eq comparator at that time did not yet treat as equivalent (those have since been documented as Phase 2A dict-eq tolerance per Rule 4 footnote, May 7). The current 22h run benefits from stable comparator semantics and produces zero diverges across an order-of-magnitude larger sample.

---

## §X Scope Limitations

**This dryrun does not exercise Pattern B's full state space.** Pattern B, introduced by PR #135 (deployed via N=2 cutover 2026-05-07 11:36 CST per memory `project_2026_05_07_t6_1_dryrun_in_flight.md`), implements a 3-state dispatcher in Python sales/finance overview paths gated on `SMARTBI_GOLD_READ_PRIMARY_ENABLED`:

- **State A** — flag=true, factory has Gold POS data → Python authoritative, no Java fallback. **NOT exercised**: F999 has no Gold POS data populated, so this path is not entered during the dryrun.
- **State B** — flag=true, factory has empty Gold POS → Python emits empty-shape response, skipping legacy Java fallback. **Exercised**: F999 follows this path on every sales/finance overview call. Logged Python-side as `[gold-primary] finance factory=F999 Gold empty — skipping legacy`.
- **State C** — flag=true, factory not in 14-customer scope → request remains on Java passthrough (nginx routes Java per T6.3 regex `(F001|FOOD_3101_…|MEAT_3101_…|OTHER_3101_…|RES_3101_…|TEST_0000_001)`). **NOT exercised** in this dryrun: sidecar issues every call to BOTH Java (10010) and Python (8083) directly, bypassing nginx; the 14 real customer factories are not part of the F999-only sample.

What this means:

1. **Pattern B State A verification is deferred to**: chat 1's May 9 13:01 CST production smoke re-verification of PR #135 against F001 (which has populated Gold POS data per task #20 / #24 reverted findings, May 8).
2. **Pattern B State C verification is deferred to**: T6.4 Stage 1–5 cutover (May 10–14 per `2026-05-08-t6-4-stage-mos`), which routes 14 real customer factories' production traffic from Java (10010) to Python (8083) progressively.
3. **T6.4 prereq blockers** (per memory `project_2026_05_08_t6_4_readiness_gates.md`):
   - ✅ T6.1 22h dryrun complete (this report)
   - ⏳ T6.3 24h soak — ETA 12:05 May 9 CST
   - ⏳ PR #135 prod smoke re-verification — May 9 13:01 CST (chat 1)
   - ⏳ K-1 sales fix (PR #149) prod deploy + 24h soak

**Recommendation**: This 100% match result establishes that the dict-eq tolerance + Decimal serialization discipline is **stable in steady state for the F999 sanity surface** over a full 22h sustained call window. It does **not** vouch for Pattern B State A / C correctness; those gates remain the responsibility of chat 1's smoke re-verification and T6.4's staged customer-factory cutover. Treat this report as one of three independent confirmations required before T6.4 Stage 1 dispatch.

---

## §8 Next Steps

1. **Organizer**: review this report and approve push to origin.
2. **Chat 1 (May 9 13:01 CST)**: PR #135 prod smoke re-verification — F001 State A (Python authoritative, has Gold POS data) + F999 State B (Python empty-shape, no fallback) + 14 customers State C (Java passthrough on nginx). Worker count grep `ps --ppid <MainPID> | grep -c spawn_main` should show 2 (N=2 leader+follower confirmed in PR #135 deploy log). Reference: dispatch MO `docs/superpowers/dispatch/2026-05-08-pr-117-prod-deploy-marching-order.md`.
3. **T6.3 24h soak**: completion ETA 2026-05-09 12:05 CST. Until then, no T6.4 dispatch.
4. **T6.4 Stage 1**: F002 + F003 (May 10) gated on prereq stack above.

---

## §9 Appendix — Aggregation Reproducibility

Re-aggregate from the source NDJSON:

```bash
ssh root@47.100.235.168 "python3 <<'PYEOF'
import json
from collections import Counter
verdicts = Counter()
total = 0
with open('/var/log/cretas-t6-dryrun-20260508.ndjson') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        r = json.loads(line)
        total += 1
        verdicts[r.get('verdict','?')] += 1
print(f'Total: {total}')
for k, v in sorted(verdicts.items(), key=lambda x: -x[1]):
    print(f'  {k}: {v} ({100*v/total:.6f}%)')
PYEOF
"
```

Expected output:
```
Total: 24814
  match: 24814 (100.000000%)
```

NDJSON file integrity:
```
sha256: 32f115254a0a4bc61c373830e742b3049524864b86cab2ff5b1bdef14f202074
size:   7155198 bytes
```

---

**End of report.**
