## Task B — Phase 2B Java vs Python parity (R5)

**Spec**: docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md §2.4 + §5 R5 Task B
**Date**: 2026-05-12, 21:32–21:43 UTC
**Env**: Java prod port 10020 (green slot active, blue 10010 not listening — confirmed via `ss -tlnp` on server), Python prod 8083
**Access**: Direct prod ports SG-locked to nginx 139.196.165.140 → reached via SSH tunnel `ssh -L 10020:localhost:10020 -L 10010:localhost:10010 -L 8083:localhost:8083 root@47.100.235.168`. Tunnel-mode HTTP requests confirmed server-side curl returns identical responses.
**Tool**: `scripts/parity-gate/compare.py` (PR #432 BG-aware + Phase-C routing-aware). Run in offline-fixture mode (`--fixtures-java` + `--fixtures-python`) against captured curl bodies, because in-band `--java-bg-fallback` health-check still resolves through SSH tunnel; capturing raw responses first then running compare.py is functionally identical to live mode but rules out tunnel/keepalive artifacts that surfaced mid-run (one mass-400 batch was traced to `cat token | tr -d '\n'` failing to strip CR on Windows — re-fetched with `tr -d '\r\n'`).
**Login route**: `POST /api/mobile/auth/unified-login` via nginx `https://www.cretaceousfuture.com/api/mobile/auth/unified-login` (the `/auth/login` route returns 404 from nginx; only `/auth/unified-login` exists)

**Tokens (truncated, 24h exp)**:
- F001 / `factory_admin1` / `123456`: `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9...fg7ZsK8FNs`
- F006 / `f006_admin` / `123456`: `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9...NrCEqPCEIU`

**Phase 2B endpoint set (from spec §2.4)**:
| Path | Java | Python |
|---|---|---|
| `GET /api/mobile/{factoryId}/smart-bi/analysis/production` | 10020 active | 8083 active (Phase 2D placeholder) |
| `GET /api/mobile/{factoryId}/smart-bi/analysis/quality` | 10020 active | 8083 active (Phase 2D placeholder) |
| `POST /api/mobile/{factoryId}/smart-bi/query` | 10020 active | not in scope (Phase 2C CUT) |
| `POST /api/mobile/{factoryId}/smart-bi/drill-down` | 10020 active | 8083 active |

Note: spec §2.4 line 135 says drill-down is "Java single-source verify" / Python CUT, but Python actually serves `/smart-bi/drill-down` at 8083 with `success=true` — verified empirically; treating as comparable pair.

---

### Pair 1: F001 `GET /smart-bi/analysis/production`

- Java: `200` 6953B (full envelope: `data.overview.{kpiCards,rankings,charts,aiInsights,suggestions,...}`)
- Python: `200` 492B (`data.{kpiCards:[],rankings:{},charts:{},...,dataAvailability:"FACTORY_SILVER_PHASE_2D_PENDING"}`)
- compare.py verdict: 10 PATTERN_B_STRUCTURAL diverges, **0 REAL_BUG**
- Diverge paths (sample):
  ```
  data.overview         J=present  P=<missing>     (Java envelopes under .overview)
  data.kpiCards         J=<missing> P=present      (Python flat-emits the same fields)
  data.charts           J=<missing> P=present
  data.dataAvailability J=<missing> P=present="FACTORY_SILVER_PHASE_2D_PENDING"
  ```
- **Classification**: Pattern B structural — by design per Python source `backend/python/smartbi_compat/api/analysis_production.py:75-90` docstring ("`_factory_production_dispatch` no longer raises NotImplementedError — chat-A1 dispatch 2026-05-12 Option B returns empty envelope marked `FACTORY_SILVER_PHASE_2D_PENDING` pending Phase 2D Silver-layer migration"). NOT a regression. Phase 2A dict-eq gate excludes Pattern B per `.claude/rules/python-java-port.md` Rule 4.
- **Verdict**: `pattern_b_phase_2d_pending` (not in spec's enumeration but functionally equivalent to "match by Python placeholder contract")

### Pair 2: F001 `GET /smart-bi/analysis/quality`

- Java: `200` 7576B (full envelope under `data.overview.*`)
- Python: `200` 490B (Phase 2D placeholder, identical shape to production)
- compare.py verdict: 10 PATTERN_B_STRUCTURAL diverges, **0 REAL_BUG**
- Same structural pattern as Pair 1. Python source `analysis_quality.py` mirrors the same Phase 2D dispatch.
- **Verdict**: `pattern_b_phase_2d_pending`

### Pair 3: F001 `POST /smart-bi/query`

- Body: `{"query":"销售概览","analysisType":"overview","startDate":"2026-01-01","endDate":"2026-01-31"}`
- Java: `400` 192B (`{"code":400,"message":"请求格式不正确，请检查JSON格式"}` — Spring's JSON-parse error; Java's NLQueryRequest rejected the body shape)
- Python: `404` 70B (`{"success":false,"data":null,"message":"Not Found","code":"NOT_FOUND"}`)
- compare.py (fixture mode) reports 5 REAL_BUG on the error envelopes, but these are tooling artifacts: fixture mode synthesizes HTTP 200 for both inputs, so `classify_routing` does not see the actual `404 (Python) + 4xx (Java)` pair which would classify as `both_gone`.
- Real HTTP status pair: Java 4xx + Python 404 → classifies as **`both_gone`** under live-mode classify_routing — both endpoints essentially refused this body. But spec §2.4 expects Python 404 for `/query`, so:
- **Verdict**: `python_not_in_scope` (spec-declared CUT; Java 400 was due to body validation, not handler absence — Java did try to parse the request)

### Pair 4: F001 `POST /smart-bi/drill-down`

- Body: `{"metric":"sales","dimension":"product","startDate":"2026-01-01","endDate":"2026-01-31"}`
- Java: `200` 1489B
- Python: `200` 1468B
- compare.py verdict: **match=True**, 0 diverges, **0 REAL_BUG**, 2 tolerated PATTERN_A_INT_COLLAPSE
- Pattern A tolerated paths:
  ```
  data.chart.data[0].amount  java=2264346.0  python=2264346
  data.data[0].value         java=2264346.0  python=2264346
  ```
- **Verdict**: `dict_eq_match` (clean match with int-collapse tolerated)

### Pair 5: F006 `GET /smart-bi/analysis/production`

- Java: `200` 6953B (full envelope under `data.overview.*`, F006-specific data)
- Python: `200` 491B (Phase 2D placeholder, `dataAvailability="FACTORY_SILVER_PHASE_2D_PENDING"`)
- compare.py: 10 PATTERN_B_STRUCTURAL diverges, **0 REAL_BUG**
- **Verdict**: `pattern_b_phase_2d_pending`

### Pair 6: F006 `GET /smart-bi/analysis/quality`

- Java: `200` 7575B
- Python: `200` 492B (Phase 2D placeholder)
- compare.py: 10 PATTERN_B_STRUCTURAL diverges, **0 REAL_BUG**
- **Verdict**: `pattern_b_phase_2d_pending`

### Pair 7: F006 `POST /smart-bi/query`

- Java: `400` 192B (same body-parse error as F001/query)
- Python: `404` 70B (NOT_FOUND, same as F001/query)
- **Verdict**: `python_not_in_scope`

### Pair 8: F006 `POST /smart-bi/drill-down`

- Java: `200` 421B
- Python: `200` 418B
- compare.py: **match=True**, 0 diverges, 0 REAL_BUG, 0 PATTERN_A (F006 dataset values are already integer-ish — no `.0` tail to collapse on this sample)
- **Verdict**: `dict_eq_match`

---

### Summary

| Factory | Endpoint | HTTP J/P | Verdict |
|---|---|---|---|
| F001 | `GET /smart-bi/analysis/production` | 200/200 | `pattern_b_phase_2d_pending` |
| F001 | `GET /smart-bi/analysis/quality` | 200/200 | `pattern_b_phase_2d_pending` |
| F001 | `POST /smart-bi/query` | 400/404 | `python_not_in_scope` |
| F001 | `POST /smart-bi/drill-down` | 200/200 | `dict_eq_match` (2 Pattern A tolerated) |
| F006 | `GET /smart-bi/analysis/production` | 200/200 | `pattern_b_phase_2d_pending` |
| F006 | `GET /smart-bi/analysis/quality` | 200/200 | `pattern_b_phase_2d_pending` |
| F006 | `POST /smart-bi/query` | 400/404 | `python_not_in_scope` |
| F006 | `POST /smart-bi/drill-down` | 200/200 | `dict_eq_match` |

**REAL_BUG count**: **0 / 8** (Phase 2A dict-eq gate clean)
**Accepted Pattern A (int-Decimal collapse)**: 1 pair (F001 drill-down, 2 leaf tolerations)
**python_not_in_scope (`/smart-bi/query` × 2 factories)**: 2 pairs — spec-declared CUT
**Pattern B structural placeholders (`/analysis/production` + `/analysis/quality` × 2 factories)**: 4 pairs — Python deliberate Phase 2D `FACTORY_SILVER_PHASE_2D_PENDING` envelope, NOT in dict-eq scope per Rule 4 Phase 2A entry

### Findings & follow-ups

1. **Phase 2B `/analysis/production` + `/analysis/quality` are not yet at byte-shape parity** — Python returns a deliberate empty envelope marked `FACTORY_SILVER_PHASE_2D_PENDING` while Java returns full computed analytics. This matches the Python source comments (`analysis_production.py:75-90`: "_factory_production_dispatch no longer raises NotImplementedError — chat-A1 dispatch 2026-05-12 Option B"). Phase 2D Silver-layer migration is the gating work to close this gap. **No customer-impacting bug**: any client following the documented `dataAvailability` discriminator on the Python envelope will gracefully fallback; the Java route still serves full data.

2. **Spec §2.4 line 135 claim that `/smart-bi/drill-down` is Python-CUT is empirically inaccurate** — Python serves `/smart-bi/drill-down` at 8083 with full parity (dict_eq match=True, 1× Pattern A tolerated on F001). Recommend the spec author confirm whether Python's drill-down is intentionally still in scope and update §2.4 accordingly, OR mark this as a separate cleanup pass for T6.5 sunset.

3. **`/smart-bi/query` Java returns 400 (body parse error)** on the spec's example body shape — Java's `NLQueryRequest` may have tightened JSON schema since the spec was authored. Not in this task's scope but worth a follow-up: Java's NL-query body contract for `/query` may have drifted from documented examples.

### Methodology notes

- Per-username 60s login rate-limit observed: each token reused for all 4 endpoints × `factory_admin1` requests; no fresh login per request.
- One mid-run mass-400 incident: `$(cat token.txt | tr -d '\n')` on Git Bash for Windows did not strip the trailing CR — caused malformed `Authorization: Bearer …\r` header → Tomcat returned `HTTP 400 + HTML` for all subsequent requests. Fixed by `tr -d '\r\n'`. All 8 captured response files are post-fix, verified by `factory_admin1` `success=true` for production/quality and proper analytics payload bytes.
- compare.py was run in fixture mode (offline) — the Python `classify_routing` function works on HTTP-pair input, which fixture mode synthesizes as 200/200. So the `/query` pair was classified manually using the real HTTP statuses (400 Java vs 404 Python = `both_gone` formally, but spec-intended `python_not_in_scope`).
- All compare.py JSON outputs in `C:/tmp/r5b/cmp-{F00x}-{endpoint}.json` (one per pair); each has accompanying `.html` viewer.
