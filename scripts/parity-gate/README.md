# parity-gate — Java↔Python byte-shape compare harness

Phase 2A/2B parity gate per [`.claude/rules/python-java-port.md` Rule 4](../../.claude/rules/python-java-port.md). Hits a Java endpoint and the parallel Python endpoint with the same params, parses both JSON bodies, and compares them with **dict-eq** semantics (Pattern A int-collapse tolerated, Pattern A2 scale-loss invisible post-parse, REAL_BUG flagged).

T6.1 dryrun bar: **≥99.945% dict-eq match**.

---

## Quick start

```bash
# Single endpoint
python scripts/parity-gate/compare.py \
  --factory R_QINGHUAJIAO_REAL \
  --endpoint '/api/mobile/{factory_id}/smart-bi/analysis/production' \
  --params 'analysisType=overview&startDate=2026-01-01&endDate=2026-01-31' \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --output reports/qhj-overview.json
# → writes reports/qhj-overview.json + reports/qhj-overview.html
# → exit 0 if match_rate ≥ 99.945%, else 1

# Batch from preset
python scripts/parity-gate/compare.py \
  --factory R_ILTEATRO_REAL \
  --endpoint-list scripts/parity-gate/presets/production.txt \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --output-dir reports/

# Batch from spec doc (auto-extract endpoints)
python scripts/parity-gate/compare.py \
  --factory R_ILTEATRO_REAL \
  --endpoint-list docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --output-dir reports/

# Offline self-test (no HTTP — uses JSON fixtures)
python scripts/parity-gate/compare.py \
  --factory R_TEST_MOCK \
  --endpoint '/api/mobile/{factory_id}/smart-bi/analysis/production' \
  --params 'analysisType=overview' \
  --fixtures-java tests/fixtures/parity-gate/java-overview.json \
  --fixtures-python tests/fixtures/parity-gate/python-overview.json \
  --output /tmp/parity-self-test.json
```

`$JWT_SECRET` must be set for HTTP mode (use `--jwt-secret` to override). PyJWT must be installed (it's already in `backend/python/requirements.txt`).

---

## Mock data for testing

When real customer data isn't loaded yet, generate a fictitious factory to test the harness end-to-end:

```bash
python scripts/parity-gate/mock_data_generator.py \
  --factory R_TEST_MOCK \
  --stores 3 --days 30 --txn-per-day 50 \
  --output-dir mock_data/

# → writes mock_data/R_TEST_MOCK/<timestamp>/seed.sql (~4500 transactions)
# Apply to test env:
psql -h 47.100.235.168 -d smartbi_db -f mock_data/R_TEST_MOCK/<timestamp>/seed.sql
# Apply to prod env (after Steve approval):
psql -h 47.100.235.168 -d smartbi_prod_db -f mock_data/R_TEST_MOCK/<timestamp>/seed.sql
```

The generator is **deterministic** (seed=42 default) — same flags → same SQL. Edge cases baked in:

* 1 of 3 stores has **zero transactions** (empty-store edge)
* 1 mid-period date has **zero transactions across all stores** (day-count edge)
* ~3% of transactions have `NULL gross_amount`
* ~5% of transactions have `NULL table_no`

---

## Phase-C routing-aware verdicts (F-2 fix, 2026-05-12)

Post-Phase-C the Java side **intentionally** returns 404 for the 23 migrated SmartBI handlers. A naive Java↔Python dict-eq compare would treat the Spring 404 envelope vs Python's real 200 body as an enormous shape divergence (the cohort sweep reported 4-7 false-positive REAL_BUG per row). The harness now classifies HTTP-status pairs against the Phase-C topology *before* running dict-eq:

| HTTP pair | Verdict | Counted as | Tolerance flag (default ON) |
|---|---|---|---|
| Java 404 + Python 2xx | `java_deleted` | matched (migration complete) | `--tolerate-java-deleted` |
| Java 404 + Python 4xx/5xx | `both_gone` | logged separately (latent gap, e.g. F-1 `analysisType=overview`) | `--tolerate-java-deleted` |
| Java 2xx + Python 404 | `python_not_in_scope` | matched (Java-only paths: `/dashboard*`, `/smartbi-config/*`) | `--tolerate-python-not-in-scope` |
| any other status disagreement | `http_mismatch` | NOT matched — still a concern | — |

Pass `--no-tolerate-java-deleted` to revert to strict `http_mismatch` (useful for pre-Phase-C historical replay).

The report JSON gains `total_java_deleted`, `total_both_gone`, `total_python_not_in_scope` counters and each per-endpoint entry now includes a `routing_pattern` field.

---

## Blue-Green Java port detection (Task B, PR #403 §6)

Java prod runs on **either** 10010 (blue) **or** 10020 (green) depending on which side `deploy-backend.sh --env prod` last activated. The harness can probe both `/api/mobile/health` endpoints and use whichever returns 200:

```bash
# Opt-in for live HTTP mode. No-op for --fixtures-* mode and for explicit
# non-BG ports (e.g. :10011 test env stays put).
python scripts/parity-gate/compare.py \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --java-bg-fallback \
  ...

# record-restaurant-goldens.sh defaults to JAVA_BG_FALLBACK=1.
# Disable with:
JAVA_BG_FALLBACK=0 ./scripts/parity-gate/record-restaurant-goldens.sh
```

The resolved port is cached per process so a 50-endpoint batch only probes once. If both ports refuse, the input URL is kept as-is and a WARN line goes to stderr — the actual fetch will surface a `network_error` verdict rather than this helper silently substituting a different host.

Reference impl pattern: `scripts/t6-dryrun-compare.sh:99-126`.

---

## What dict-eq tolerates as MATCH (Pattern A / A2)

Per Rule 4, byte-shape divergence below is **expected** post-Python-cutover and counts as MATCH:

| Pattern | Example | Detectable? |
|---|---|---|
| **A** integer-Decimal int-collapse | Java `100.00` (→ `100.0` float) vs Python `100` (int) | ✅ tracked in `tolerated_byte_diffs` |
| **A2** scale-4 trailing-zero collapse | Java `99.9900` (→ `99.99` float) vs Python `99.99` (float) | ❌ invisible post-`json.loads` — both parse to same float |

What's classified as **REAL_BUG** and fails the gate:

* Type mismatch (str vs int, dict vs list, etc.)
* Numeric values not equal under exact-Decimal comparison
* Missing keys on either side
* List length mismatch
* Boolean vs numeric (`true != 1` per JSON semantics)

Volatile keys are auto-stripped before compare:
`generatedAt` / `lastUpdated` / `cacheExpireAt` / `timestamp` / `dataVersion` (matches `replay-and-compare.py` convention).

---

## Architecture

```
scripts/parity-gate/
├── compare.py              # CLI entrypoint
├── fetch_endpoint.py       # HTTP fetch + JWT (urllib + PyJWT)
├── dict_eq.py              # Rule 4 algorithm — pure, no I/O
├── endpoint_list.py        # Preset / spec-doc parsers
├── report.py               # JSON + HTML output
├── mock_data_generator.py  # Restaurant Silver seed SQL
└── README.md               # this file
```

Tests live in `backend/python/tests/test_parity_gate.py`.

---

## Rule 4 reference

* `.claude/rules/python-java-port.md` Rule 4 (Phase 2A dict-eq standard)
* T6.1 dryrun evidence: `docs/qa-audits/2026-05-07-h1-confirm-raw-body-evidence.md`
* Predecessor scripts (strict-byte only, kept for compatibility):
  * `scripts/active-e2e/curl-replay/replay-and-compare.py`
  * `scripts/active-e2e/curl-replay/parity-report.py`
  * `scripts/phase2a/t6-dryrun-analyze.py`

---

## Phase 3 followups (not in scope of this PR)

* **Pattern A2 detection**: raw-byte comparison pre-`json.loads` to surface
  scale-4 trailing-zero divergence (requires fetching raw text, not parsed).
* **Rule 8 strict-byte mode**: compare Map.of key insertion order
  (separate concern from dict-eq).
* **Caching**: skip re-fetching identical (endpoint, params) pairs within
  one run.
* **CI integration**: GitHub Actions workflow that runs the gate against
  a smoke factory_id on PR.
