# Active E2E Test Framework v1 — Spec

**Phase**: Cross-cutting infrastructure (replaces passive 24h/48h soak windows in pre-customer-return state)
**Status**: Framework v1 ready for review — code shipped under `scripts/active-e2e/`
**Date**: 2026-05-09
**Predecessors**:
- HARD rule `feedback_active_e2e_replaces_passive_soak.md` graduated 2026-05-09
- T6.5 Phase B prod cutover smoke (chat 1, 2026-05-09 13:43 CST: 1748/1748 stubs + 8/8 NOT_SAFE alive)
- Phase 2A T6.1 dryrun pattern (`scripts/t6-dryrun-compare.sh`, dual-call dict_eq sidecar)
- Chat F/G strict-byte test infrastructure (`backend/python/smartbi_compat/_strict_byte/`, PR #194 + PR #192)

---

## 0. TL;DR

`scripts/active-e2e/` is a one-time framework investment that codifies the active synthetic E2E pattern Steve graduated to a HARD rule on 2026-05-09. Replaces 24h/48h passive soak windows that produce zero signal in pre-customer-return state (0 customers using product → 0 traffic → soak ≈ empty restaurant kitchen check).

**v1 deliverables** (all shipped this PR, ~750 LOC framework + ~270 LOC presets + this spec):

| Component | Files | Purpose |
|---|---|---|
| Smoke / assertion | `curl-replay/record-batch.sh` | N×M HTTP capture with status/marker assertion (status / status-not / marker) |
| Dryrun / parity | `curl-replay/replay-and-compare.py` | Dual-call Java vs Python dict-eq comparator with NDJSON log |
| Aggregation | `curl-replay/parity-report.py` | NDJSON → markdown summary (auto-detects single-call vs replay-compare schema) |
| Load gen | `load-gen/asyncio-stress.py` | Sustained aiohttp load (76 factory × N endpoint, 5min default) |
| Pytest harness | `parity-assertion/run-parity-tests.sh` | Wrapper over Chat F/G strict-byte fixtures + smartbi_compat tests |
| UI flow | `playwright/flows/login-smartbi.spec.ts` | Customer-perspective Playwright flow (login + dashboard render + analysis subpage) |
| Preset endpoints | `curl-replay/preset-{stub-23,not-safe-4,analysis-22,health}.txt` | Reusable endpoint lists matching shipped Phase 2A / T6 patterns |
| Per-phase docs | `README.md` | Per-phase checklist (stub-out / cutover / generic deploy verify) |

**Self-validation (run pre-push, 2026-05-09)**:
- Synthetic NDJSON of chat 1 cutover shape (1748 stubs × 410 + 8 NOT_SAFE × 200) → `parity-report.py` aggregates correctly to 100% PASS, exactly matches chat 1 ping output.
- Synthetic dryrun NDJSON (100 match + 1 Pattern A2 diverge) → `parity-report.py` reports 99.01% match rate with diverge sample preserved; GO verdict above 99% threshold (Phase 2A standard).
- All 5 scripts pass syntax check (`ast.parse` for Python, `bash -n` for shell).
- CLI `--help` of all entry-point scripts validates argument parsing.

**Live HTTP self-validation deferred** — replaying chat 1's actual 1748/1748 against `47.100.235.168:10010` from local Windows requires JWT_SECRET from server `.env.prod`, which is server-resident only. Framework is ready to run on server; live replay is the first user's call.

---

## 1. Why this framework

### 1.1 Anti-pattern catalog (HARD rule source)

Per `feedback_active_e2e_replaces_passive_soak.md` graduated 2026-05-09 by Steve:

| Anti-pattern | Why rejected |
|---|---|
| "Wait 24h soak between stages" | 0 customers → 0 traffic → 0 signal |
| "Stage 3 needs 48h because high-stakes customers" | If 0 customers, defense is hypothetical |
| "Conservative buffer for observation" | Observation of nothing |
| "Let metrics stabilize" | No traffic = nothing to stabilize |
| "Wait X hour for cleaner sequencing" | Aesthetic, not technical |

Active E2E tests **generate** customer-perspective requests + verify response shape + UI rendering = real safety net, in <30 min/stage instead of 24h/stage.

### 1.2 Where it would have helped (retrospective)

- **T6.4 May 9 5-stage cascade**: original plan had 24h passive soak between stages 1→2, 48h before stage 3 (high-stakes). HARD rule compressed to active E2E + 5-10 min smoke between stages. Total compressed window: 40 minutes for the entire cascade. **Today** (post-rule) it would have been an obvious choice; **tomorrow** any sister chat without the framework would re-implement smoke from scratch every cutover.
- **T6.3 May 8 cutover**: 1159/1159 smoke at 11:34 CST in 55s — exactly the pattern this framework codifies.
- **T6.5 Phase B prod cutover May 9**: 1748/1748 stubs + 8/8 NOT_SAFE alive at 13:43 CST — chat 1 wrote `scripts/t6-5-phase-b-smoke.py` from scratch. v1 framework extracts the generic harness so future cutover chats parameterize via CLI flags + preset files.

### 1.3 Framework vs ad-hoc smoke scripts

| Aspect | Ad-hoc smoke (current state) | Framework v1 |
|---|---|---|
| Effort per cutover | 200-300 LOC each chat | 0 LOC (preset file edit + CLI flags) |
| Output format | Each chat prints differently | Standardized NDJSON + markdown via `parity-report.py` |
| Aggregation | Hand-written in chat ping | Auto-generated md table |
| Chat F/G strict-byte reuse | Not integrated | `parity-assertion/run-parity-tests.sh` reuses fixtures |
| Pytest markers | Not exposed | `--strict-byte` / `--dict-eq` filters |
| Load generation | Ad-hoc cURL loops | aiohttp asyncio sustained stress |
| Playwright UI | Manual click-through | `login-smartbi.spec.ts` template |

---

## 2. Architecture

### 2.1 Component map

```
scripts/active-e2e/
├── README.md                          ← Per-phase usage checklist
│
├── playwright/
│   └── flows/
│       └── login-smartbi.spec.ts      ← Customer-perspective UI flow (Web-Admin)
│
├── curl-replay/                       ← HTTP-level testing
│   ├── record-batch.sh                ← Single-target N×M capture + assertion
│   ├── replay-and-compare.py          ← Dual-target Java vs Python dict-eq
│   ├── parity-report.py               ← NDJSON → markdown aggregator
│   ├── preset-stub-23.txt             ← T6.5 Phase B 23 stub endpoints
│   ├── preset-not-safe-4.txt          ← 4 NOT_SAFE_FALLTHROUGH paths
│   ├── preset-analysis-22.txt         ← 22 SmartBI analysis paths (post-T6.4 Python)
│   └── preset-health.txt              ← Generic deploy-verify health check
│
├── load-gen/
│   └── asyncio-stress.py              ← aiohttp 76-factory sustained stress
│
└── parity-assertion/
    └── run-parity-tests.sh            ← Pytest wrapper over Chat F/G fixtures
```

### 2.2 Data flow per phase

**Cutover smoke flow** (T6.5 Phase B model):
```
deploy → record-batch.sh
  ↓ (76 factories × 23 endpoints = 1748 calls, ~55s parallel)
NDJSON
  ↓
parity-report.py
  ↓
markdown (paste into ping / PR comment)
```

**Dryrun parity flow** (T6.1 model):
```
[Java prod 10010] ← replay-and-compare.py → [Python prod 8083]
                          ↓ (per pair: dict-eq strip-volatile + diverge summary)
                    NDJSON (1 line per pair)
                          ↓
                    parity-report.py
                          ↓
                    markdown (match rate %, diverge samples)
```

**Pre-cutover acceptance flow** (combines all three):
```
1. record-batch.sh (current state assertion)
2. replay-and-compare.py (Java vs Python dict-eq)
3. asyncio-stress.py (load + p99 latency check)
4. run-parity-tests.sh (Chat F/G strict-byte goldens)
5. login-smartbi.spec.ts (UI customer-perspective)
```

All five steps default to <30 min total.

### 2.3 Integration with Chat F/G strict-byte infrastructure (PR #194 + PR #192)

`run-parity-tests.sh` is a thin wrapper that invokes `python -m pytest tests/python/smartbi_compat/` with marker filters:

- `--strict-byte` → `pytest -m strict_byte` (compares raw `.json.bytes` recordings via `_strict_byte/strict_diff.py` char-by-char)
- `--dict-eq` → `pytest -m 'not strict_byte'` (Phase 2A default — `_strict_byte/dispatcher.py` with volatile keys stripped)
- (no flag) → run both

Reuses:
- `tests/python/smartbi_compat/conftest.py` — `comparator_mode` fixture, marker registration
- `backend/python/smartbi_compat/_strict_byte/dispatcher.py` — `assert_response_eq(actual, expected, mode=…)` mode-aware comparator
- `backend/python/smartbi_compat/_strict_byte/strict_diff.py` — char-by-char comparator with hex dump + UTF-8 decode failure report
- `tests/fixtures/java-smartbi-golden/*.json` (dict-eq) + `*.json.bytes` (strict-byte) — recorded via `scripts/record-java-golden.sh`

---

## 3. Per-phase usage patterns

### 3.1 Java endpoint stub-out (T6.5 Phase B model)

Trigger: deployed Java jar with stubbed endpoint bodies returning 410.

```bash
# Step 1: assert all 23 stubs return 410 + SMARTBI_MIGRATED marker
JWT_SECRET=$(ssh root@47.100.235.168 "grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2") \
  ./scripts/active-e2e/curl-replay/record-batch.sh \
    --base-url http://47.100.235.168:10010 \
    --factories ALL_76 \
    --endpoints scripts/active-e2e/curl-replay/preset-stub-23.txt \
    --expect-status 410 \
    --expect-marker SMARTBI_MIGRATED \
    --output ./out/phase-b-stubs.ndjson

# Step 2: assert NOT_SAFE paths still alive (no 410)
JWT_SECRET=... ./scripts/active-e2e/curl-replay/record-batch.sh \
    --base-url http://47.100.235.168:10010 \
    --factories F001,F002 \
    --endpoints scripts/active-e2e/curl-replay/preset-not-safe-4.txt \
    --expect-status-not 410 \
    --output ./out/phase-b-not-safe.ndjson

# Step 3: aggregate
python3 scripts/active-e2e/curl-replay/parity-report.py \
  ./out/phase-b-stubs.ndjson ./out/phase-b-not-safe.ndjson
```

GO criteria: 1748/1748 stubs PASS (410 + marker), 8/8 NOT_SAFE PASS (no 410, no 5xx).

### 3.2 Python service cutover (T6.3 / T6.4 model)

Trigger: nginx config switched cohort to Python upstream.

```bash
# Step 1: replay both stacks for 30 min, dict-eq compare each pair
JWT_SECRET=... ./scripts/active-e2e/curl-replay/replay-and-compare.py \
  --java-base http://47.100.235.168:10010 \
  --python-base http://47.100.235.168:8083 \
  --factories F002,F003 \
  --endpoints scripts/active-e2e/curl-replay/preset-analysis-22.txt \
  --duration 30m --interval 30 \
  --output ./out/cutover-stage-N.ndjson

# Step 2: load-gen sample (5 min sustained)
JWT_SECRET=... python3 scripts/active-e2e/load-gen/asyncio-stress.py \
  --base-url http://47.100.235.168:8083 \
  --factories F002,F003 \
  --endpoints scripts/active-e2e/curl-replay/preset-analysis-22.txt \
  --duration 5m --concurrency 50

# Step 3: pytest parity over Chat F/G fixtures
JWT_SECRET=... BASE_URL=http://47.100.235.168:8083 \
  bash scripts/active-e2e/parity-assertion/run-parity-tests.sh

# Step 4: Web-Admin UI flow
E2E_USERNAME=... E2E_PASSWORD=... E2E_FACTORY=F002 \
  npx playwright test scripts/active-e2e/playwright/flows/login-smartbi.spec.ts
```

GO criteria:
- dict-eq match rate ≥99% (Phase 2A standard per `python-java-port.md` Rule 4)
- p99 latency <2.0s, error rate <0.5% (Phase 2A T6.1 baseline)
- pytest 0 failures (or all failures explained by Pattern A/A2)
- Playwright: 0 page errors, KPI cards render, no infinite spinner

### 3.3 Generic deploy verify

Trigger: any deploy where contract is "service still healthy".

```bash
JWT_SECRET=... ./scripts/active-e2e/curl-replay/record-batch.sh \
  --factories F001,F002,F999 \
  --endpoints scripts/active-e2e/curl-replay/preset-health.txt \
  --expect-status 200 \
  --output ./out/deploy-verify.ndjson
```

---

## 4. Self-validation results

### 4.1 Synthetic chat-1 reproduction

```python
# Generate synthetic NDJSON matching chat 1 1748+8 prod cutover shape
1748 rows: status=410, verdict=PASS, marker_present=True   (stubs)
   8 rows: status=200, verdict=PASS, marker_present=False  (NOT_SAFE alive)
```

`parity-report.py out/synthetic-chat1.ndjson` output:
```
- Total calls: **1756**
- PASS: 1756 (100.00%)

| Verdict | Count | % |
| PASS | 1756 | 100.00% |

| Status | Count |
| 410 | 1748 |
| 200 | 8 |
```

Matches chat 1 ping output exactly.

### 4.2 Synthetic dryrun reproduction

```python
# 100 match + 1 Pattern A2 diverge (data.executionRate: 99.9900 vs 99.99)
```

`parity-report.py out/synthetic-dryrun.ndjson` output:
```
- Total pairs: **101**
- Match: 100 (99.0099%)

| Verdict | Count | % |
| diverge | 1 | 0.99% |
| match | 100 | 99.01% |

## Verdict: GO
Match rate 99.0099% ≥ Phase 2A threshold 99%.
```

Diverge sample preserved with field path `data.executionRate: 99.9900 vs 99.99` — useful for triaging Rule 4 Pattern A2 vs real bugs.

### 4.3 Syntax + CLI validation

| Check | Result |
|---|---|
| `ast.parse` of 3 Python scripts | OK |
| `bash -n` of 2 shell scripts | OK |
| `record-batch.sh --help` | Renders 24-line usage |
| `replay-and-compare.py --help` | Renders argparse output |
| `parity-report.py` (no args) | Errors cleanly with usage hint |

### 4.4 Live replay (deferred)

Replaying actual chat 1 1748/1748 against `47.100.235.168:10010` requires JWT_SECRET from server `.env.prod`. From local Windows shell this is a credential-fetch step the framework intentionally does not automate. First user (any sister chat with server access) can run:

```bash
ssh root@47.100.235.168 "
  cd /www/wwwroot/cretas/code &&
  git pull &&
  JWT_SECRET=\$(grep '^JWT_SECRET=' .env.prod | cut -d= -f2) \
    bash scripts/active-e2e/curl-replay/record-batch.sh \
      --factories ALL_76 \
      --endpoints scripts/active-e2e/curl-replay/preset-stub-23.txt \
      --expect-status 410 \
      --expect-marker SMARTBI_MIGRATED \
      --output /tmp/active-e2e-self-validate.ndjson
"
```

Expected output: 1748/1748 PASS within ~55s (matches chat 1 baseline).

---

## 5. Future extensions (NOT v1)

| Extension | Trigger | Priority |
|---|---|---|
| WeChat Mini Program flow harness | When MallCenter mini program needs cutover verification (43 pages) | Medium |
| Maestro RN native flow harness | When RN customer cutover happens | Medium |
| SSE stream comparator (`scripts/active-e2e/sse-replay/`) | Phase 2C Tier 2 prereq (Dashboard `/insights/custom/stream`) | High (Phase 2C kickoff) |
| Multipart Excel upload comparator | Phase 2C Tier 3 prereq (Upload endpoints) | Medium |
| Auto-trigger on deploy hook | When deploy pipeline standardizes around this framework | Low |
| ML-based regression baseline (compare to N previous runs) | When framework has ≥10 deploy cycles of NDJSON history | Low |
| GitHub Action runner (`.github/workflows/active-e2e.yml`) | When deploy pipeline lifts to CI | Low |

Each extension stays a separate `scripts/active-e2e/<sub>/` sub-tree to avoid v1 scope bloat.

---

## 6. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|:-:|:-:|---|
| R-1 | Preset endpoint files drift from real Java controller | M | M | Each preset file cites source script (`scripts/t6-5-phase-b-smoke.py`); diff at framework-update time |
| R-2 | JWT_SECRET leaked to NDJSON output | L | H | NDJSON only logs status / latency / endpoint / verdict; never logs token or auth headers |
| R-3 | aiohttp + asyncio resource leak under load | L | M | Workers bounded by `--concurrency`; TCPConnector with `limit=2x concurrency`; 15s timeout per request |
| R-4 | Replay-compare false-positive divergence on Pattern A/A2 (Java 100.00 vs Python 100) | M | L | `_diverge_summary` shows field path → triager can recognize Rule 4 patterns; future v2: integrate `_decimal_to_number` normalizer in dict-eq |
| R-5 | Playwright flow brittle to Web-Admin UI changes | M | L | Selectors use multiple fallbacks (CSS class + data-test + Chinese text); failures surface fast (15s timeout); flow is template, not contract |
| R-6 | parity-report.py stale schema detection | L | L | `detect_schema()` reads first row; explicit `replay-compare` requires `java + python` keys, otherwise falls to `single-call`; unknown schema errors out |
| R-7 | Sister chats fork the framework instead of using it | M | M | README explicitly directs CLI flag + preset edits; spec doc lists future extensions to absorb common needs |
| R-8 | Volatile keys list incomplete (new endpoint emits new volatile field) | M | L | `replay-and-compare.py` VOLATILE_KEYS is module-level set; framework v2 can accept `--volatile-keys` CLI flag |
| R-9 | preset-stub-23.txt POST endpoints (datasource/upload, /apply, query-templates POST/PUT, /query, /drill-down) need richer Spring binding to bypass 415/400 validation | H | M | v1 sends empty `{}` JSON which works for the 410 stub case (Java stub fires before validation). For Python cutover dryrun (replay-and-compare), Spring 415/400 may surface — flag as known limitation, document pre-existing `_build_request_body` helper in `t6-5-phase-b-smoke.py:97` for v2 import |
| R-10 | Framework runs from the wrong worktree (sister chat impl in flight) | L | L | Worktree-isolation per `concurrent-edit-safety.md` Rule 2 — framework lives at `scripts/active-e2e/` once merged, sister chats `cd <repo-root>` then run |

---

## 7. Acceptance criteria

This spec doc lock-in requires:

- [x] Framework code shipped under `scripts/active-e2e/` (8 files, ~750 LOC + 4 preset files ~270 LOC)
- [x] Self-validation against synthetic chat-1 1748+8 dataset confirms `parity-report.py` aggregates correctly
- [x] Self-validation against synthetic dryrun (100 match + 1 diverge) confirms 99% threshold gating
- [x] All 5 entry-point scripts pass syntax check (Python `ast.parse`, bash `bash -n`)
- [x] CLI `--help` of all entry-point scripts validates argument parsing
- [ ] Live replay from server validates 1748/1748 chat-1 reproduction (deferred to first user with server access)
- [ ] Reviewer audit + sign-off

---

## 8. Parallel work analysis (per `parallel-work-analysis.md`)

### Subagent (single chat, this design):
- ✅ Framework code review (this PR)
- ✅ Synthetic NDJSON validation
- ❌ Live HTTP replay (requires server JWT_SECRET)

### Multi-chat:
- ✅ Sister chats can use framework immediately (after merge) for upcoming Phase 2C / Phase 2B / Tier 1 cutover smoke
- ✅ Framework + Tier 2 Dashboard design + T6.5 Phase B post-merge soak monitoring all parallel-safe (different files)
- ❌ Framework changes must serialize through `ops-active-e2e-framework` branch (single source of truth for `scripts/active-e2e/`)

### Conflict risk:
- Low for v1 ship (greenfield directory).
- Medium when v2 starts (multiple sister chats may want to extend simultaneously). Mitigate per `concurrent-edit-safety.md` Rule 5b safe-commit pattern.

---

## 9. Reference index

| Resource | Location |
|---|---|
| HARD rule | `feedback_active_e2e_replaces_passive_soak.md` (graduated 2026-05-09) |
| Chat 1 prod cutover smoke | `scripts/t6-5-phase-b-smoke.py` (2026-05-09 13:43 CST result: 1748/1748 + 8/8) |
| Phase 2A T6.1 dryrun pattern | `scripts/t6-dryrun-compare.sh` |
| Chat F/G strict-byte dispatcher | `backend/python/smartbi_compat/_strict_byte/` (PR #194 + PR #192) |
| Pytest fixtures | `tests/python/smartbi_compat/conftest.py` (`comparator_mode` fixture) |
| Java golden recorder | `scripts/record-java-golden.sh` (Chat F output, dict-eq + strict-byte modes) |
| PR #178 audit (endpoint inventory source) | `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` |
| Phase 2C Tier 2 design (next consumer of SSE comparator extension) | `docs/superpowers/specs/2026-05-09-phase-2c-tier-2-dashboard-design.md` (PR #206) |

---

## Status

This is a **framework + spec doc combined PR**. Acceptance requires:
- Reviewer audit (4-cycle: self-review → sister-chat reviewer → cross-spec audit → fresh subagent audit).
- Operator sign-off.
- First sister chat using v1 framework for next cutover (Phase 2C Tier 1 smoke / Tier 2 SSE prereq) reports back on usability.
- Estimated v2 trigger: when ≥3 sister chats have used v1 and accumulated extension requests.

Pre-push HOLD: per ⛔ HOLD in marching order, sister chat must STOP and ping Steve before `git push`.
