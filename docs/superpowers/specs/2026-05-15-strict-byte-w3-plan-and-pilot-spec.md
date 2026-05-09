# Strict-byte W3 Plan + First Endpoint Pilot Spec

**Status**: Spec — Phase 1 Week 3 plan companion to PR #154 (test infrastructure spec)
**Author**: chat 2 (sister chat re-engaged)
**Date**: 2026-05-15
**Spec only — no code, no test infra changes, no record-java-golden.sh edits, no deploy.**

---

## §1. Background — W1 + W2 recap

PR #154 (chat 2 / chat F, 645 LOC) defined the strict-byte test infrastructure
across Phase 1 (foundation) Weeks 1–3. PR #153 (chat 3, 612 LOC) gated **when**
to adopt strict-byte. PR #155 (chat 1, 331 LOC) empirically verified Phase 2A
frontend never sees raw bytes (axios auto-unwrap + `toFixed` normalization +
zero hash-compare usage). PR #156 (chat 3, 510 LOC) bridged Phase 2A → 2B
handoff readiness with Priority 1 = foundation per PR #153 §3.2.

**W1 + W2 are already shipped to `main`** (verified 2026-05-15 via worktree off
`origin/main`):

| Artifact | Path | LOC | Status |
|---|---|---:|---|
| `_decimal_preserve_scale` helper | `backend/python/smartbi_compat/_strict_byte/decimal_helpers.py` | 38 | ✅ shipped |
| `StrictDiff` comparator | `backend/python/smartbi_compat/_strict_byte/strict_diff.py` | 142 | ✅ shipped |
| `assert_response_eq` dispatcher | `backend/python/smartbi_compat/_strict_byte/dispatcher.py` | 84 | ✅ shipped |
| Package `__init__` | `backend/python/smartbi_compat/_strict_byte/__init__.py` | 28 | ✅ shipped |
| `record-java-golden.sh` `--strict-byte` / `--strict-byte-only` | `scripts/record-java-golden.sh` | 138 | ✅ shipped |
| `conftest.py` markers + `assert_response_match` fixture | `tests/python/smartbi_compat/conftest.py` | 105 | ✅ shipped |

**Total infra LOC shipped**: ~535 (vs PR #154 §8 estimate ~590 — within budget).

What remains: **first endpoint pilot** that exercises the whole pipeline
end-to-end (record `.json.bytes` → `@strict_byte` test → `assert_response_match`
→ failing-then-passing demonstration).

---

## §2. W3 goal — first endpoint strict-byte gate end-to-end

W3 deliverable: **one** Phase 2A or Phase 2B Tier 1 endpoint passing a
strict-byte gate test, with:

1. Recorded `.json.bytes` golden (raw HTTP body, no roundtrip).
2. `@pytest.mark.strict_byte` test using the `assert_response_match` fixture.
3. CI green on the strict-byte path (separate from existing dict-eq path).
4. Documented diff-failure UX (intentional-fail screenshot of `StrictDiff` hex
   dump on a perturbed expected golden).
5. Per-port effort actual measurement (clock-time + LOC, vs PR #154 §8 estimate
   "~3–4 days extra per controller").

**Out of scope for W3**: 2nd / 3rd pilots, any Phase 2A retroactive migration,
any Phase 2B Tier 2/3/4 work, frontend hash audits beyond PR #155 sample.

---

## §3. First endpoint candidate selection

### §3.1 Selection criteria (ordered)

1. **Shape narrowness** — minimal nested objects, minimal Decimal/date/Map.of
   surfaces. Lower divergence surface area = faster red→green.
2. **Revert cost** — read-only or admin-only. No customer-traffic blast radius
   on test failure.
3. **Decimal/date complexity** — endpoints with no `BigDecimal` or
   `LocalDateTime` are ideal (foundation already covers, but pilot wants narrow
   first hit).
4. **Production traffic** — pilot tests don't hit prod, but if foundation has
   bugs that surface only at scale, low-traffic endpoints surface them last.
5. **Existing dict-eq test coverage** — endpoints with green dict-eq tests
   today have a known-good baseline to diff against.
6. **Cross-tier reusability** — pilot patterns should generalize to Tier 2/3
   without rewrite.

### §3.2 Candidate matrix

| # | Tier | Endpoint | Shape | Decimal | Date | Revert cost | Existing dict-eq |
|---|---|---|---|---|---|---|---|
| C-1 | Phase 2B Tier 1 Config | `GET /api/mobile/smartbi-config/intents` | Flat list of intent rows | None | `created_at` / `updated_at` | None (admin GET) | Likely none (Java today) |
| C-2 | Phase 2B Tier 1 Config | `GET /api/mobile/smartbi-config/thresholds` | Flat list | None | Standard audit cols | None (admin GET) | Likely none (Java today) |
| C-3 | Phase 2B Tier 1 Config | `GET /api/mobile/smartbi-config/chart-templates/{code}` | Single row | None | Standard audit cols | None (admin GET) | Likely none (Java today) |
| C-4 | Phase 2A | `GET /api/mobile/{factoryId}/smart-bi/analysis/finance?type=profit` | Deeply nested KPI + chart | Heavy (Rule 4/10/12) | LocalDateTime µs (Rule 11) | Soak in flight | ✅ many dict-eq tests |
| C-5 | Phase 2B Tier 4 PublicDemo | `GET /api/public/showcase/...` | Static demo response | Likely some | Likely some | None (sunset target) | Likely none |

### §3.3 Recommendation: C-1 `GET /intents`

- **Shape narrowness**: highest — single `ai_intent_configs` table → flat row
  list. No nested Decimal, no chart structures, no streaming.
- **Revert cost**: zero — admin-only Vue page consumer (PR #155 §1 confirmed
  zero React Native SmartBI hits for config endpoints).
- **Decimal complexity**: zero — `intent_code`, `intent_name`, `keywords` JSON,
  `is_active` boolean, no `BigDecimal`.
- **Date complexity**: low — only `created_at` / `updated_at` audit columns
  via `BaseEntity`. Rule 11 `_java_isoformat` already battle-tested across
  Phase 2A; pilot exercises it under strict-byte gate (vs dict-eq tolerance
  that hid Rule 11 latent for ~50 endpoints until PR-M-7).
- **Tier alignment**: Tier 1 is Phase 2B kickoff per PR #152 §2.1; pilot
  doubles as Phase 2B Tier 1 forerunner — methodology validated before tier
  kicks off.
- **Cross-tier reuse**: dispatcher + `StrictDiff` patterns proven on flat list
  generalize directly to Tier 1 CRUD GETs (5 sub-domains × ~5 endpoints each).

**Why NOT Phase 2A endpoint (C-4)**: Phase 2A dict-eq is **locked** per PR #153
§"Recommendation summary". Migrating any Phase 2A endpoint to strict-byte
without business trigger violates the adoption decision. C-4 also has the
heaviest Decimal surface — pilot wants narrow first hit, not stress test.

**Why NOT Tier 4 sunset (C-5)**: PR #152 §2.4 + §3.4 recommend defer-or-sunset.
Investing pilot effort on a sunset target is anti-pattern.

**Decision**: pilot = `GET /api/mobile/smartbi-config/intents` (C-1). C-2 and
C-3 reserved as W3 Day 3–5 second/third pilots if W3 Day 1–2 closes early.

---

## §4. Migration steps for first pilot

### §4.1 Prerequisites (MUST verify before W3 kickoff)

- [ ] T6.5 Phase C complete (Java analysis files removed) per PR #152 §6 —
      smartbi_compat module structure settled. **Status (2026-05-15): T6.5
      Phase C still in flight** per recent commits (`Sub-E` shipped May 9
      2026). W3 kickoff blocked until Phase C complete.
- [ ] PR #135 deployed to prod — confirms 3-state Pattern B dispatcher live
      (T6.4 prereq, status per `project_2026_05_07_t6_1_dryrun_in_flight.md`
      memory: deployed 2026-05-07 via N=2 cutover).
- [ ] T6.4 Stage 5 complete — all 14+1 customer factories on Python.
      **Status (2026-05-15): completed 2026-05-09 06:34 CST** per
      `project_2026_05_09_phase_2a_complete.md`.
- [ ] Foundation infra unchanged on `main` since PR #154 ship. Verify via
      `git log --oneline backend/python/smartbi_compat/_strict_byte/
      scripts/record-java-golden.sh tests/python/smartbi_compat/conftest.py`.

### §4.2 Day 1 — Record golden + scaffold test

- [ ] **Step 1: Verify W1+W2 infra still green.** Run
      `pytest tests/python/smartbi_compat/_strict_byte/ -v`. Expect all
      foundation tests pass.
- [ ] **Step 2: Record dict-eq + strict-byte goldens for `GET /intents`.**

```bash
JWT_SECRET=<from .env.test> ./scripts/record-java-golden.sh F999 \
    '/api/mobile/smartbi-config/intents' \
    smartbi-config-intents-F999.json --strict-byte
```

Expect outputs:
- `tests/fixtures/java-smartbi-golden/smartbi-config-intents-F999.json` (dict-eq)
- `tests/fixtures/java-smartbi-golden/smartbi-config-intents-F999.json.bytes` (strict-byte)

- [ ] **Step 3: Verify `.bytes` is truly raw.** Run
      `xxd <path>.bytes | head -20`. Expect no pretty-printing, no whitespace
      normalization. Confirm Decimal scale preserved (e.g. trailing zeros
      visible if any datetime fraction or BigDecimal field present).
- [ ] **Step 4: Scaffold pilot test file.**

Create `tests/python/smartbi_compat/_strict_byte/test_pilot_intents_strict_byte.py`:

```python
"""Pilot: strict-byte gate on GET /api/mobile/smartbi-config/intents.

W3 Day 1–2 deliverable per
docs/superpowers/specs/2026-05-15-strict-byte-w3-plan-and-pilot-spec.md.
"""
import pathlib

import pytest

GOLDEN_DIR = pathlib.Path(__file__).resolve().parents[4] / "tests" / "fixtures" / "java-smartbi-golden"


@pytest.mark.strict_byte
def test_intents_F999_strict_byte_match(assert_response_match):
    """Strict-byte: Python /intents response bytes must match Java byte-for-byte."""
    expected_bytes = (GOLDEN_DIR / "smartbi-config-intents-F999.json.bytes").read_bytes()
    actual_bytes = _fetch_python_intents_bytes("F999")  # see §4.3 step 6
    assert_response_match(
        actual_bytes,
        expected_bytes,
        volatile_byte_patterns=[
            rb'"createdAt":"[^"]+"',
            rb'"updatedAt":"[^"]+"',
        ],
    )
```

- [ ] **Step 5: Run test (red).** Expect FAIL — Python `_intents` endpoint
      doesn't exist yet (Phase 2B Tier 1 not started). This validates the
      dispatcher correctly routes to `StrictDiff` on a real perturbation.

### §4.3 Day 3 — Implement Python endpoint stub

This is **NOT** the production Tier 1 port. The pilot wants a minimal Python
endpoint that returns the SAME byte-shape as Java for the test fixture, to
prove the gate end-to-end.

- [ ] **Step 6: Implement `_fetch_python_intents_bytes` test helper.** It hits
      either (a) a stub Python endpoint at `8084/api/mobile/smartbi-config/intents`,
      or (b) a fixture-derived in-process fake. Recommendation: in-process fake
      using `httpx.AsyncClient` against a `FastAPI` test instance, to avoid
      coupling pilot to deploy state.
- [ ] **Step 7: Iterate Python serializer until strict-byte match.** Apply
      lessons from Phase 2A Rules 4/8/9/11/12. Likely findings:
      - Lombok `@Data` on `AIIntentConfig` DTO → field name decapitalize
        edge cases (Rule 9.1).
      - `LocalDateTime` `created_at` / `updated_at` → microsecond drop (Rule
        11). `volatile_byte_patterns` in test masks these for now;
        production port will use `_java_isoformat` per Rule 11.
      - JSON key order from Lombok getter order (Rule 9.3) — may emit
        derived getters not in source.
- [ ] **Step 8: Run test (green).** Run
      `pytest tests/python/smartbi_compat/_strict_byte/test_pilot_intents_strict_byte.py -v`.
      Expect PASS.

### §4.4 Day 4 — Diff-failure UX validation

Pilot must **also** validate the failure path (per PR #154 §3.2 `StrictDiff`
goal "rich failure report").

- [ ] **Step 9: Add intentional-perturbation test.**

```python
@pytest.mark.strict_byte
def test_intents_F999_strict_byte_perturbation_demo(assert_response_match):
    """Demo: assert StrictDiff produces actionable hex dump on byte divergence."""
    expected_bytes = (GOLDEN_DIR / "smartbi-config-intents-F999.json.bytes").read_bytes()
    perturbed = expected_bytes.replace(b'"isActive":true', b'"isActive":false', 1)
    with pytest.raises(AssertionError) as excinfo:
        assert_response_match(perturbed, expected_bytes)
    assert "offset" in str(excinfo.value).lower()
    assert "isActive" in str(excinfo.value)
```

- [ ] **Step 10: Capture failure output.** Run with `pytest -v -s` and copy
      raw stderr to
      `docs/qa-audits/2026-05-W3-strict-byte-pilot-failure-ux.md`.
      Reviewers can eyeball: is hex dump enough or do we need HTML side-by-side
      (Q-3 from PR #154)?

### §4.5 Day 5 — Effort measurement + retrospective

- [ ] **Step 11: Measure clock-time.** Sum hours per Day. Compare to PR #154
      §8 "~3–4 days extra per controller".
- [ ] **Step 12: Measure LOC.** Per pilot:
      - Test file LOC
      - Stub Python endpoint LOC (if pilot used real endpoint)
      - Golden file size
      - Volatile-pattern catalog additions
- [ ] **Step 13: Write W3 retrospective doc.**
      `docs/superpowers/dispatch/2026-05-W3-strict-byte-pilot-retrospective.md`.
      Sections: actual effort vs estimate, surprises, foundation gaps found,
      Q-1 through Q-7 from PR #154 — answer with empirical data.

---

## §5. Rollout strategy after pilot

### §5.1 W3 Day 1–2: pilot endpoint pass strict-byte gate

Deliverable: `GET /intents` strict-byte test green + perturbation demo green.

### §5.2 W3 Day 3–5: 2nd + 3rd pilot to validate methodology

If Day 1–2 closes early, run C-2 (`/thresholds`) and C-3 (`/chart-templates/{code}`)
as second/third pilots. Goal: prove methodology generalizes — different sub-domain,
different shape (single-row vs list).

If Day 1–2 runs long, defer C-2/C-3 to W4 and write retrospective Day 5.

### §5.3 W4+: tier-by-tier expansion via Phase 2B mapping

Per PR #152 §2.1 + PR #153 §"Recommendation summary":

| Tier | Endpoints | Strict-byte adoption | Rollout |
|---|---:|---|---|
| Tier 1 Config | 41 | Decision per per-endpoint audit (most likely **dict-eq**, per PR #153) | Tier 1 port-time decision per controller |
| Tier 2 Dashboard | 11 | **SSE chunks strict-byte recommended** per PR #154 §6 | Foundation reuse, new SSE recorder |
| Tier 3 Upload | 13 | **Envelope strict-byte required** per PR #153 (uploadId/confirmToken byte-stable) | Foundation reuse, new strict-byte goldens |
| Tier 4 PublicDemo | 10 | Sunset OR dict-eq | None (defer/sunset) |

Pilot establishes pattern; per-tier kickoff dispatches separate marching orders.

### §5.4 Per-pilot acceptance gates

Each pilot (and each subsequent endpoint adopted) must:

- [ ] Record `.json.bytes` golden via `record-java-golden.sh --strict-byte`.
- [ ] Have `@pytest.mark.strict_byte` test passing locally + CI.
- [ ] Have a perturbation demo test in same file showing `StrictDiff`
      output is actionable.
- [ ] Update `docs/superpowers/specs/<endpoint>-strict-byte-pilot.md` with
      effort + LOC + surprises.

---

## §6. Per-port effort estimate (Phase 2B Tier-by-Tier)

Pre-pilot estimate per PR #154 §8 + PR #156 §"Gap closure plan":

| Tier | Endpoints | Estimated days/endpoint | Parallel chats | Wall-clock |
|---|---:|---:|---:|---:|
| Tier 1 Config (if any go strict-byte) | 41 (subset) | 0.5–1 (dict-eq reuse) | 4 | < 1 week |
| Tier 1 Config (all dict-eq, default) | 41 | n/a | n/a | excluded |
| Tier 2 Dashboard | 11 | 3–4 (SSE infrastructure heavy first) | 4 | ~2 weeks |
| Tier 3 Upload | 13 | 3–4 (envelope strict-byte) | 4 | ~1.5 weeks |
| Tier 4 SUNSET | 10 | n/a | n/a | excluded |

**Note**: PR #155 empirical finding (frontend dict-eq sufficient indefinitely)
+ PR #153 recommendation (dict-eq Phase 2A locked) reduce strict-byte adoption
to **Tier 2 SSE + Tier 3 envelope only**. Tier 1 default = dict-eq unless a
specific endpoint surfaces a hash-compare contract (none currently known).

**Total Phase 2B strict-byte effort (refined post-pilot)**:
- Foundation: shipped (W1+W2)
- Pilot (W3): ~5 days
- Tier 2 SSE: ~2 weeks (new SSE infrastructure dominates)
- Tier 3 envelope: ~1.5 weeks
- **Phase 2B total: ~4–5 weeks** (down from PR #154 §8 ~5–7 weeks via PR #155 + PR #153 gating decisions)

---

## §7. Retroactive Phase 2A migration — defer per PR #153

Per PR #153 §"Cost analysis":

> Phase 2A retroactive: ~12-17 weeks (~3 months). ❌ NOT justified without
> business trigger.

PR #155 empirical finding zero hash-compare contracts → no business trigger
present. **W3 pilot does NOT include any Phase 2A endpoint migration.**

Re-evaluate when one of PR #153 §"Hard triggers" fires:
- New API contract requires byte-level commitment.
- Customer reports cache invalidation issue traceable to byte mismatch.
- Audit / compliance scope expansion.
- Third-party integration onboarding with byte contract.

---

## §8. Trigger conditions for upgrading dict-eq → strict-byte

Per PR #153 §"Strict-byte requirement scenarios" (exhaustive list, 5 categories):

1. **Frontend hash-compare contracts** (response-body hashing for cache/dedup)
   - Current state: ZERO usage (PR #155 §4 grep verification).
2. **Third-party integration APIs** (HMAC / OAuth signatures, webhook contracts)
   - Current state: NONE in SmartBI scope.
3. **Audit log integrity** (digital signature on response body)
   - Current state: NONE in SmartBI scope.
4. **Performance / cache contracts** (ETag based on body hash)
   - Current state: NONE in SmartBI scope.
5. **Compliance / regulatory byte immutability** (tax records / financial filings)
   - Current state: NONE in SmartBI scope.

**Verdict (W3 entry)**: dict-eq stays default. Strict-byte applied only to
Tier 2 SSE chunks + Tier 3 upload envelope per PR #153 + PR #156 alignment.

---

## §9. Decision matrix — when to leave dict-eq vs upgrade strict-byte

| Scenario | Default | Reason |
|---|---|---|
| Phase 2A endpoint, no business trigger | dict-eq | PR #153 lock |
| Phase 2A endpoint, trigger fires | strict-byte | Per-endpoint audit + foundation reuse (~1–2 days each) |
| Phase 2B Tier 1 Config CRUD | dict-eq | Admin-only, no contract per PR #155 |
| Phase 2B Tier 1 Config + new hash contract | strict-byte | Apply per-endpoint |
| Phase 2B Tier 2 Dashboard read | dict-eq | Frontend `toFixed` normalizes per PR #155 §3 |
| Phase 2B Tier 2 Dashboard SSE chunk | **strict-byte** | Boundary-buffer parity, per PR #154 §6 |
| Phase 2B Tier 3 Upload `uploadId`/`confirmToken` | **strict-byte** | Byte-stable contract per PR #153 |
| Phase 2B Tier 3 Upload Excel parse | dict-eq | Apache POI ↔ openpyxl semantic via Rule-style audits |
| Phase 2B Tier 4 PublicDemo | dict-eq OR sunset | Per PR #152 §2.4 |
| Phase 3+ new feature | Per requirement | Architect/PM owns trigger evaluation |

---

## §10. Open questions for reviewer (Q-W3-1 through Q-W3-6)

**Q-W3-1**: Is `GET /intents` the right pilot, or should Steve override to a
known-Phase-2A endpoint to validate strict-byte against existing Java response
shapes? (Trade-off: known-baseline vs Tier 1 forward-investment.)

**Q-W3-2**: For the pilot Python endpoint stub (§4.3 step 6), in-process fake
or actual deployed `8084` stub? Fake = faster iteration; deployed = closer to
production reality.

**Q-W3-3**: Should pilot's `volatile_byte_patterns` for `createdAt`/`updatedAt`
be promoted to a shared catalog now (`backend/python/smartbi_compat/_strict_byte/volatile_patterns.py`),
or wait until 2nd/3rd pilot to extract pattern? (Q-5 from PR #154.)

**Q-W3-4**: Does W3 Day 5 retrospective doc go in `docs/qa-audits/`,
`docs/superpowers/dispatch/`, or new `docs/superpowers/retrospectives/`?
Phase 2A used `docs/qa-audits/` for pilots; project drift opportunity.

**Q-W3-5**: If T6.5 Phase C is still in flight at W3 dispatch time (per §4.1),
do we (a) gate W3 strictly on Phase C complete, (b) start W3 with a Phase 2A
endpoint pilot that doesn't depend on Phase C, or (c) run W3 in worktree
isolation with mocked module structure? Recommendation: (a) gate strictly —
Phase C cleanup is ~58-day window, pilot can wait.

**Q-W3-6**: Per-port effort actual measurement (§4.5 step 11) — what's the
threshold to revise PR #154 §8 estimate? E.g. if pilot takes 8 days vs estimate
3–4 days, do we (a) update estimate, (b) audit foundation for friction, (c)
both?

---

## §11. Cross-references

- **PR #150** (chat 3, `cf8cc48e8`) — T6.5 Java SmartBI deprecation spec.
  W3 prereq §4.1.
- **PR #151** (chat 1, `8912e137d`) — Phase 2A retrospective. Rules 4/8/9/10/11/12
  baseline that pilot exercises.
- **PR #152** (chat 2, `8b88dbb9b`) — Phase 2B port pipeline scoping.
  Tier 1 = pilot tier per §3.3.
- **PR #153** (chat 3, `2f7bd9bda`) — Strict-byte gate adoption decision.
  Defines dict-eq lock / per-tier hybrid.
- **PR #154** (chat 2 / chat F, this PR's predecessor) — Strict-byte test
  infrastructure spec. W1+W2 design + W3 placeholder.
- **PR #155** (chat 1) — Frontend impact verification. Empirical proof
  zero hash-compare → strict-byte adoption stays narrow.
- **PR #156** (chat 3) — Phase 2A → 2B handoff readiness audit.
  P1 closure = strict-byte foundation per §3.2.
- `.claude/rules/python-java-port.md` — Rules 4/8/9/10/11/12 (Pattern A/A2
  dict-eq tolerance, Lombok quirks, BigDecimal divide-multiply, LocalDateTime
  µs, banker's rounding).
- `backend/python/smartbi_compat/_strict_byte/` — Foundation helpers shipped
  W1+W2.
- `scripts/record-java-golden.sh` — Golden recorder w/ `--strict-byte`
  flags shipped W2.
- `tests/python/smartbi_compat/conftest.py` — Markers + `assert_response_match`
  fixture shipped W2.
- `docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md`
  — PR #154 spec (W1+W2+W3 design).

---

## ⛔ HOLD blocks

- **Doc only**. No code, no test infra changes, no `record-java-golden.sh`
  edits, no goldens recorded, no deploy, no Python endpoint stubs.
- Pilot kickoff (§4.2 onwards) is a **separate marching order** post-this-PR.
- W3 kickoff blocked until §4.1 prerequisites all green. T6.5 Phase C status
  is the gating prereq as of 2026-05-15.
- Pilot does NOT migrate any Phase 2A endpoint. Phase 2A dict-eq lock per
  PR #153 stays.
- Foundation infra (W1+W2) is shipped + frozen for pilot duration. Any
  foundation change during W3 = separate PR + invalidates pilot timing data.
- Per-tier rollout (§5.3) requires separate Phase 2B kickoff dispatches; this
  spec only seeds the pilot pattern.

---

## Test plan

Doc-only PR — no code, no tests. Review checklist:

- [ ] chat 2 (PR #154 author): pilot fits W3 design; candidate selection
      rationale acceptable; Q-W3-1 through Q-W3-6 reasonable.
- [ ] chat 3 (PR #153 + PR #156 author): strict-byte adoption gating intact;
      no Phase 2A retroactive scope creep; T6.5 Phase C prereq honored.
- [ ] chat 1 (PR #151 + PR #155 author): Phase 2A retrospective accuracy;
      frontend impact matrix in §9 matches PR #155 §3.
- [ ] Engineering organizer: §6 effort estimate revisions reasonable; §10
      open questions ready for Steve review.
- [ ] Steve / PM: pilot endpoint candidate (C-1) acceptable; W3 kickoff
      timing relative to T6.5 Phase C.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
