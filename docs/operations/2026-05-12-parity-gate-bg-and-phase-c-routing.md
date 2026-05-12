# parity-gate harness — BG-aware + Phase-C routing-aware

**Date**: 2026-05-12
**Predecessors**: PR #403 §6 (BG slot flip false-positives), `docs/qa-audits/2026-05-12-smartbi-cohort-parity-sweep-results.md` §5 F-2 finding
**Scope**: Hardening for `scripts/parity-gate/` so cohort sweeps + R_*_REAL chain sweeps don't surface false-positive `REAL_BUG` or `Connection refused` rows.

---

## §1. Background

Two operational gotchas surfaced after Phase 2C cutover went live:

1. **Phase-C handler deletion** — T6.5 Phase C deleted 23 Java handlers for paths now served by Python. A naive `Java vs Python` dict-eq compare gets a Spring 404 envelope on the Java side and a real 200 body on the Python side. Pre-fix, this produced 4-7 false-positive `REAL_BUG` per cohort row — see 2026-05-12 cohort sweep §4 re-classification.
2. **Blue-Green slot flip mid-task** — Java prod alternates between 10010 (blue) and 10020 (green) on `deploy-backend.sh --env prod`. PR #403 R_*_REAL sweep observed all 88 endpoint-runs return `verdict=java_error / Connection refused` when 10010 went inactive mid-task — required manual reclassification via report-JSON inspection and a re-run with `JAVA_BASE=http://localhost:10020`.

Both issues are now handled in-harness.

---

## §2. F-2 fix — Phase-C routing-aware classification

### Defaults

`compare.py` now runs with `--tolerate-java-deleted` + `--tolerate-python-not-in-scope` ON by default. Each per-endpoint result acquires a `routing_pattern` field; the per-factory report aggregates `total_java_deleted` / `total_both_gone` / `total_python_not_in_scope` counters.

| HTTP pair | Verdict | Counted in `match_rate`? |
|---|---|---|
| Java 404 + Python 2xx | `java_deleted` | Yes (migration complete) |
| Java 404 + Python 4xx/5xx | `both_gone` | No (logged for F-1 follow-up only) |
| Java 2xx + Python 404 | `python_not_in_scope` | Yes (Java-only paths by design) |
| Any other HTTP disagreement | `http_mismatch` | No (still investigate) |

### Strict mode

Pre-Phase-C replays (e.g. comparing against a historical Java commit that still serves the migrated paths) need the old behaviour. Run with:

```bash
python scripts/parity-gate/compare.py \
  --no-tolerate-java-deleted \
  --no-tolerate-python-not-in-scope \
  ...
```

### Reference

* Implementation: `scripts/parity-gate/compare.py:classify_routing`
* Counters: `scripts/parity-gate/report.py:build_report`
* Tests: `backend/python/tests/test_parity_gate.py::test_classify_routing_*`,
  `::test_build_report_cohort_simulation_zero_real_bug`

---

## §3. Blue-Green port detection

### Defaults

`record-restaurant-goldens.sh` defaults to `JAVA_BG_FALLBACK=1` → invokes `compare.py --java-bg-fallback`. Each batch run probes 10010 then 10020 once and caches the resolved port for every subsequent endpoint in the same process.

```bash
# Default — auto-detect.
./scripts/parity-gate/record-restaurant-goldens.sh

# Disable, force the JAVA_BASE port literally.
JAVA_BG_FALLBACK=0 ./scripts/parity-gate/record-restaurant-goldens.sh
```

### Direct invocation

```bash
python scripts/parity-gate/compare.py \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --java-bg-fallback \
  ...
```

Off by default at the CLI layer to preserve backward compatibility for explicit-URL callers. `record-restaurant-goldens.sh` opts in because prod parity runs have hit a BG flip on every sweep since 2026-05-07.

### Behaviour matrix

| Input | Result |
|---|---|
| `bg_fallback=False` | URL unchanged (no probing). |
| `--java-base http://host:10011` (non-BG port) + `--java-bg-fallback` | URL unchanged. Explicit non-BG ports are honoured — never silently move off the operator's intended slot. |
| `--java-base http://host:10010` + `--java-bg-fallback`, blue alive | URL unchanged. |
| `--java-base http://host:10010` + `--java-bg-fallback`, blue refused, green alive | URL rewritten to `:10020`. WARN line to stderr. |
| Both ports refused | URL kept as-is. WARN. Subsequent fetch surfaces `verdict=network_error` (not silently substituted). |

### Reference

* Implementation: `scripts/parity-gate/fetch_endpoint.py:_probe_java_health`,
  `:detect_active_java_port`, `:resolve_java_base`
* Mirrors `scripts/t6-dryrun-compare.sh:detect_java_port` (bash equivalent)
* Tests: `backend/python/tests/test_parity_gate.py::test_probe_*`,
  `::test_resolve_java_base_*`, `::test_detect_active_java_port_*`

---

## §4. Operator quick-reference

```bash
# Full cohort sweep — uses both fixes by default.
./scripts/parity-gate/record-restaurant-goldens.sh

# Single-endpoint diagnostic at prod.
python scripts/parity-gate/compare.py \
  --factory R_GML_DEMO \
  --endpoint '/api/mobile/{factory_id}/smart-bi/analysis/finance' \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --java-bg-fallback \
  --output /tmp/diag.json

# Pre-Phase-C historical replay (strict mode).
python scripts/parity-gate/compare.py \
  --no-tolerate-java-deleted \
  --no-tolerate-python-not-in-scope \
  ...
```

When reading a report:

* `total_real_bugs > 0` — real bug, investigate.
* `total_both_gone > 0` — latent coverage gap (F-1 family). Not a regression; file a follow-up issue.
* `total_java_deleted` / `total_python_not_in_scope` — Phase-C topology confirmed. No action.
* `match_rate < 99.945%` with `total_real_bugs == 0` — likely a `both_gone` count dragging the rate. Read the entries, file follow-up if appropriate.
