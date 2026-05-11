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
