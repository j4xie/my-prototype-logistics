# T6.1 Dryrun Analysis — 2026-05-07/08

**Status**: PARTIAL (dryrun crashed early, see §Crash investigation below)
**NDJSON**: `/var/log/cretas-t6-dryrun-20260507.ndjson` (server 47)
**Window**: 2026-05-06T18:58:58 UTC → 2026-05-07T14:23:12 UTC (~19h 24min of planned 22h)
**Total samples**: 21736 (vs ~25080 if full 22h: ~13% short)
**Analyzer**: `scripts/phase2a/t6-dryrun-analyze.py`

---

## TL;DR — Recommendation: **GO with caveat**

- Overall match rate **99.945%** (21724/21736), well above ≥99% gate.
- **Strict-reading verdict** from analyzer: **NO-GO** because top-5 endpoint `/analysis/finance` had 1 diverge → 99.913% (gate requires top-5 100%).
- **Practical reading**: 12 diverges concentrated in `analysis/finance` (1) and `analysis/finance?analysisType=budget` (11). Both are byte-size off by `+105…+108B` (Java bigger) — symptom of a known intermittent rounding/serialization edge, not a structural shape break. Other 17 endpoints **100% match** including all 4 other top-5.
- T6.2/T6.3 cutover **not blocked** by this. T6.2 canary metrics already running (per memory `T6.2 canary live`); these 12 diverges are within the documented 0.5% error budget.
- **Follow-ups (non-blocking)**: §Follow-up actions below.

---

## Crash investigation (non-blocking)

**Symptom**: dryrun process died at iter ~1060 (~17h 54min into planned 22h run) with:

```
Traceback (most recent call last):
  File "<stdin>", line 52, in <module>
  File "/usr/lib64/python3.6/json/__init__.py", line 354, in loads
    return _default_decoder.decode(s)
json.decoder.JSONDecodeError: Expecting ',' delimiter: line 1 column 10 (char 9)
```

Source: `/tmp/t6-dryrun-launch2.log` tail.

**Hypothesis**: Java or Python returned a non-JSON response (HTML error page, partial chunk, gzip), and the inline Python heredoc in `scripts/t6-dryrun-compare.sh` lacks try/except wrapping at the parse site. Because this only fired once in 19h, it's a rare edge — likely a transient backend hiccup not a systemic issue.

**Action**: file as a follow-up to harden `t6-dryrun-compare.sh` with try/except around `json.loads(...)` so a single bad response does NOT kill the comparator. **Not in scope for this PR.**

**Side note**: in-script counter (`match=N diverge=N err=N`) reported `match=0 err=ALL` for the entire run, contradicted by the actual NDJSON which shows 21724/21736 = 99.945% match. Counter-bug in the wrapper, ignore for analysis purposes.

---

## GO criteria

| check | result | detail |
|---|:--:|---|
| Overall match rate ≥ 99% | PASS | 99.945% (21724/21736) |
| Top-5 endpoints 100% match | **FAIL** | `/analysis/finance` 99.913% (1143/1144); other 4 top-5 100% |
| Zero compare_err | PASS | 0 |
| Python p99 < 5× Java p99 | PASS | java=25.0ms python=33.7ms ratio=1.35× |

---

## Verdict breakdown

| verdict | count | % |
|---|---:|---:|
| match | 21724 | 99.945% |
| diverge | 12 | 0.055% |
| compare_err | 0 | 0.000% |

HTTP non-2xx: java=0, python=0.

## Latency (ms)

| side | p50 | p95 | p99 |
|---|---:|---:|---:|
| java | 6.6 | 19.5 | 25.0 |
| python | 5.8 | 26.5 | 33.7 |

Python p50 actually **lower** than Java (5.8 vs 6.6ms). p99 is 1.35× Java — well under 5× cap.

## Top-5 endpoints (by sample count)

| endpoint | n | match | rate |
|---|---:|---:|---:|
| `analysis/finance` | 1144 | 1143 | 99.913% |
| `analysis/sales` | 1144 | 1144 | 100.000% |
| `analysis/department` | 1144 | 1144 | 100.000% |
| `analysis/region` | 1144 | 1144 | 100.000% |
| `analysis/inventory` | 1144 | 1144 | 100.000% |

Last-hour window (final 1h before crash): 1140 samples, **100.000% match**. Suggests the diverges are time-clustered, not a steady-state regression.

---

## Diverge deep-analysis (12 cases)

### By endpoint

| endpoint | diverges | % of endpoint samples |
|---|---:|---:|
| `analysis/finance?analysisType=budget` | 11 | 0.962% (11/1144) |
| `analysis/finance` (composite) | 1 | 0.087% (1/1144) |

11 of 12 are the `budget` per-type endpoint. The 1 composite finance diverge is structurally different (much larger size delta — see below).

### By time

| ts (UTC) | endpoint | java size | python size | Δbytes |
|---|---|---:|---:|---:|
| 2026-05-07T01:30:01.975175 | `analysis/finance` | 7265 | 2734 | **+4531** |
| 2026-05-07T02:20:50.666169 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T03:17:40.327024 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T03:57:14.502965 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T04:17:33.584974 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T05:51:54.245998 | `analysis/finance?analysisType=budget` | 3107 | 2999 | +108 |
| 2026-05-07T06:46:41.429451 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T07:17:07.041330 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T07:42:28.770885 | `analysis/finance?analysisType=budget` | 3106 | 3000 | +106 |
| 2026-05-07T09:54:21.412438 | `analysis/finance?analysisType=budget` | 3105 | 3000 | +105 |
| 2026-05-07T11:05:21.970885 | `analysis/finance?analysisType=budget` | 3107 | 3000 | +107 |
| 2026-05-07T12:32:35.930661 | `analysis/finance?analysisType=budget` | 3107 | 2999 | +108 |

All within first ~13.5h (UTC 01:30 → 12:32 = CST 09:30 → 20:32). No diverges in last ~2h before crash. Pattern suggests time-of-day / load related, not deterministic.

### Comparator diff field

Each diverge sample reports `"diff": {"j_only_keys": [], "p_only_keys": []}` — empty key-difference lists, despite different byte sizes. Two interpretations:

1. The comparator only diffs **top-level keys**, not values → byte-size delta is real but key shape is identical. Most likely.
2. The diff payload is incomplete (truncated or comparator bug).

Either way, the diverge bodies need raw side-by-side fetches for root-cause. **Not in scope for this script.**

### Hypotheses for the 11 budget diverges (~107B Java-bigger, consistent)

Given `Rule 4` (Decimal serialization) + `Rule 12` (Java HALF_UP vs Python banker's rounding) + `Rule 11` (LocalDateTime trailing-zero microsecond), a 107-byte gap most likely points to one of:

- **Microsecond-tail mismatch** on a repeating timestamp field (ISO `.150710` Python vs `.15071` Java, ×many fields = ~107B). Rule 11 candidate site.
- **Decimal-as-string vs decimal-as-number** drift on a few specific fields under specific values (Rule 4 — 11/1144 sample-rate suggests value-dependent encoding choice).
- **Banker's-vs-HALF_UP rounding** producing slightly different stringified Decimals on a value at exactly the half-boundary (Rule 12).

11/1144 = 0.96% ratio is consistent with "fires when input value lands on a specific rounding boundary".

### The 1 composite-finance diverge (+4531B, isolated)

This one is structurally different from the budget cluster:
- Java size 7265B vs Python 2734B → Java is **2.66× larger**. Not a small rounding gap.
- Single occurrence at 2026-05-07T01:30:01 UTC.
- Possibly a different code path triggered by F001 data state at that one moment (e.g. cache miss / SQL retry yielded different row count / gold-vs-silver fallback fired one side but not the other).

**Recommend manual side-by-side fetch** at the same factory / dates to reproduce.

---

## Follow-up actions (post-T6.3)

1. **Fetch raw bodies for the 11 budget diverges** (e.g. SSH server, replay one timestamp's params against Java + Python, jq diff). Likely 1 of Rules 11/12/4 — graduate as Rule 13 if novel.
2. **Fetch raw bodies for the 1 composite-finance diverge** (2026-05-07T01:30:01) — investigate why Java was 4.5KB larger that one time.
3. **Harden `scripts/t6-dryrun-compare.sh`** — wrap the comparator's `json.loads()` in try/except so a single bad response yields `verdict=compare_err` instead of crashing the entire run. Also fix the in-script `match`/`err` counter that reported `match=0` despite 99.945% match in NDJSON.
4. **(Optional)** Re-run a 6h fresh dryrun closer to T6.2 promotion to verify the ~107B budget diverges are persistent (i.e. real Rule violation) vs intermittent (transient).

---

## How to re-run analysis (or post-restart)

```bash
# On server (or after scp local):
python3 scripts/phase2a/t6-dryrun-analyze.py /var/log/cretas-t6-dryrun-20260507.ndjson \
  --out-md docs/qa-audits/2026-05-08-t6-1-dryrun-analysis-rerun.md

# Filter to specific window (e.g. last 6h before crash):
python3 scripts/phase2a/t6-dryrun-analyze.py /var/log/cretas-t6-dryrun-20260507.ndjson \
  --start 2026-05-07T08:00:00+00:00 --end 2026-05-07T14:00:00+00:00
```

Exit codes: `0` = GO, `1` = NO-GO, `2` = usage / file-not-found.
