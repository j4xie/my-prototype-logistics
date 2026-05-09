# Active E2E Framework v1

**Date**: 2026-05-09
**Purpose**: Generic, reusable active E2E test framework — replaces passive 24h/48h soak windows in pre-customer-return state per HARD rule `feedback_active_e2e_replaces_passive_soak.md` (graduated 2026-05-09).
**Predecessor**: T6.5 Phase B prod cutover smoke (chat 1, 1748/1748 stubs + 8/8 NOT_SAFE alive on 2026-05-09 13:43 CST against `47.100.235.168:10010`). Template extracted from `scripts/t6-5-phase-b-smoke.py` + `scripts/t6-3-smoke.py` + `scripts/t6-dryrun-compare.sh`.

---

## TL;DR

After every cutover / migration / deploy step, run **active synthetic E2E** instead of waiting 24h+ for "soak". 0 customers using product → soak = empty restaurant kitchen check. Active E2E generates customer-perspective requests + verifies response shape + UI rendering = actual safety net.

**Per-stage workflow** (every cutover step):
1. **Cutover action** (e.g., nginx config edit + reload).
2. **Smoke verify** (5–10 min — `curl-replay/record-batch.sh` against the new state, asserts HTTP status + body markers).
3. **Active E2E** (15–30 min, customer perspective):
   - `playwright/flows/login-smartbi.spec.ts` — Web-Admin login + dashboard navigation
   - `curl-replay/replay-and-compare.py` — N factories × M endpoints dict-eq vs golden
   - `load-gen/asyncio-stress.py` — short stress sample (~5 min)
   - `parity-assertion/run-parity-tests.sh` — pytest suite over Chat F/G strict-byte fixtures
4. **Pass** → next step IMMEDIATELY (no buffer / no operator-comfort wait).
5. **Fail** → STOP + investigate root cause + fix or rollback.

---

## Directory layout

```
scripts/active-e2e/
├── README.md                              # This file (per-phase checklist + usage)
├── playwright/
│   └── flows/
│       └── login-smartbi.spec.ts          # Customer-perspective Playwright flow template
├── curl-replay/
│   ├── record-batch.sh                    # Capture N×M HTTP responses → ./out/
│   ├── replay-and-compare.py              # Replay + dict-eq compare vs goldens
│   └── parity-report.py                   # Aggregate NDJSON results → markdown summary
├── load-gen/
│   └── asyncio-stress.py                  # 76-factory × N-endpoint asyncio stress (~5 min)
└── parity-assertion/
    └── run-parity-tests.sh                # Pytest harness over Chat F/G strict-byte fixtures
```

---

## Per-phase usage (extracted from T6 cutover patterns)

### Phase: Java endpoint stub-out (T6.5 Phase B model)

Goal: assert the controller body returns 410 + `code=SMARTBI_MIGRATED`.

```bash
# Step 1: deploy Java with stubs
./scripts/deploy/deploy-backend.sh --env prod

# Step 2: smoke (replicates chat 1 1748/1748 result)
JWT_SECRET=<from .env.prod> BASE_URL=http://47.100.235.168:10010 \
  bash scripts/active-e2e/curl-replay/record-batch.sh \
    --factories ALL_76 \
    --endpoints scripts/active-e2e/curl-replay/preset-stub-23.txt \
    --expect-status 410 \
    --expect-marker SMARTBI_MIGRATED \
    --output ./out/phase-b-smoke-$(date +%Y%m%d_%H%M%S).ndjson

# Step 3: aggregate
python3 scripts/active-e2e/curl-replay/parity-report.py \
  ./out/phase-b-smoke-*.ndjson > ./out/phase-b-summary.md

# Step 4: active E2E (Web-Admin)
npx playwright test scripts/active-e2e/playwright/flows/login-smartbi.spec.ts

# Step 5: NOT_SAFE regression (4 paths × 2 factories = 8)
JWT_SECRET=<from .env.prod> BASE_URL=http://47.100.235.168:10010 \
  bash scripts/active-e2e/curl-replay/record-batch.sh \
    --factories F001,F002 \
    --endpoints scripts/active-e2e/curl-replay/preset-not-safe-4.txt \
    --expect-status-not 410 \
    --output ./out/phase-b-not-safe.ndjson
```

GO criteria: 1748/1748 stubs match expected (PASS), 8/8 NOT_SAFE alive (no 410, no 5xx).

### Phase: Python service cutover (T6.3 / T6.4 model)

Goal: assert nginx routes the cohort to Python and Python's response dict-eq matches Java prod baseline.

```bash
# Step 1: nginx config edit + nginx -t + reload (organizer-owned)

# Step 2: dual-call dict_eq sidecar
JWT_SECRET=<...> FACTORY=F002 \
  bash scripts/active-e2e/curl-replay/replay-and-compare.py \
    --java-base http://47.100.235.168:10010 \
    --python-base http://47.100.235.168:8083 \
    --endpoints scripts/active-e2e/curl-replay/preset-analysis-22.txt \
    --duration 30m --interval 30 \
    --output ./out/cutover-stage-N.ndjson

# Step 3: aggregate dict-eq match rate
python3 scripts/active-e2e/curl-replay/parity-report.py \
  ./out/cutover-stage-N.ndjson > ./out/cutover-stage-N.md
# GO criteria: ≥99% dict-eq match per Phase 2A standard

# Step 4: load test (proves Python multi-worker still healthy)
python3 scripts/active-e2e/load-gen/asyncio-stress.py \
  --base-url http://47.100.235.168:8083 \
  --factories F002,F003 \
  --duration 5m --concurrency 50

# Step 5: active E2E (Web-Admin / RN App)
npx playwright test scripts/active-e2e/playwright/flows/login-smartbi.spec.ts

# Step 6: parity assertion (uses Chat F/G strict-byte fixtures)
bash scripts/active-e2e/parity-assertion/run-parity-tests.sh
```

GO criteria: dict-eq match rate ≥99%, load p99 < 2000ms, 0 Java fallback, Web-Admin renders dashboard data without errors.

### Phase: Generic deploy verify

For any deploy where the contract is "endpoint X should still work":

```bash
JWT_SECRET=<...> bash scripts/active-e2e/curl-replay/record-batch.sh \
  --factories F001,F002,F999 \
  --endpoints scripts/active-e2e/curl-replay/preset-health.txt \
  --expect-status 200 \
  --output ./out/deploy-verify-$(date +%Y%m%d).ndjson
```

---

## Conventions

- **NDJSON output**: one JSON object per line, schema documented inline in each script. Aggregator `parity-report.py` groups by verdict.
- **Preset endpoint files**: `preset-stub-23.txt`, `preset-not-safe-4.txt`, `preset-analysis-22.txt`, `preset-health.txt` — each is `<METHOD> <path>` per line, `{factoryId}` placeholder.
- **JWT_SECRET**: required env var; pull from `.env.prod` (server) or `.env.test`. Never hard-code.
- **Concurrency cap**: 10 threads / 50 async tasks default — match `t6-5-phase-b-smoke.py` ThreadPoolExecutor pattern (verified safe at 76×23 = 1748 calls in ~55s).
- **Volatile keys stripped on dict-eq**: `generatedAt`, `lastUpdated`, `cacheExpireAt`, `timestamp` per Chat F/G `_strict_byte/dispatcher.py`.

---

## Integration with Chat F/G strict-byte infrastructure

`parity-assertion/run-parity-tests.sh` reuses:
- `tests/python/smartbi_compat/conftest.py` — `comparator_mode` fixture (strict_byte / dict_eq markers)
- `backend/python/smartbi_compat/_strict_byte/dispatcher.py` — `assert_response_eq` mode-aware comparator
- `backend/python/smartbi_compat/_strict_byte/strict_diff.py` — char-by-char comparator with hex dump
- `tests/fixtures/java-smartbi-golden/*.json` (dict-eq) + `*.json.bytes` (strict-byte) — recorded via `scripts/record-java-golden.sh`

Tests targeting strict-byte parity (Phase 2C Tier 2 SSE chunks / Tier 3 upload envelopes) opt in via `@pytest.mark.strict_byte`. Phase 2A default stays dict-eq.

---

## Anti-patterns this framework rejects

| Anti-pattern | Why rejected | Replacement |
|---|---|---|
| "Wait 24h soak between stages for safety" | 0 customers → 0 traffic → 0 signal | Active E2E in <30 min |
| "Stage 3 needs 48h because high-stakes customers" | If 0 customers, defense is hypothetical | Active E2E |
| "Conservative buffer for observation" | Observation of nothing | Replay-and-compare logs |
| "Let metrics stabilize" | No traffic = nothing to stabilize | `load-gen/asyncio-stress.py` (5 min) |
| "Wait X hour for cleaner sequencing" | Aesthetic, not technical | Trigger on technical readiness |

---

## Future extensions (NOT v1 scope)

- WeChat Mini Program flow harness (43 pages per `e2e-miniprogram` skill — separate sub-tree under `scripts/active-e2e/miniprogram/`).
- Maestro RN native flow harness (`scripts/active-e2e/maestro/`).
- SSE stream comparator (Phase 2C Tier 2 prereq — `scripts/active-e2e/sse-replay/`).
- Multipart Excel upload comparator (Phase 2C Tier 3 prereq — `scripts/active-e2e/excel-replay/`).
- Auto-trigger on deploy hook (currently manual).

---

## Reference

- `feedback_active_e2e_replaces_passive_soak.md` — HARD rule source (2026-05-09).
- `scripts/t6-5-phase-b-smoke.py` — chat 1 prod cutover template (1748/1748 + 8/8).
- `scripts/t6-dryrun-compare.sh` — Phase 2A T6.1 dryrun pattern (dual-call dict_eq).
- `scripts/record-java-golden.sh` — Chat F/G golden recorder.
- `backend/python/smartbi_compat/_strict_byte/` — Chat F/G strict-byte dispatcher.
- `tests/python/smartbi_compat/conftest.py` — Chat F/G pytest markers + fixtures.
- `docs/superpowers/specs/2026-05-09-active-e2e-framework-v1-spec.md` — design rationale + phase patterns.
