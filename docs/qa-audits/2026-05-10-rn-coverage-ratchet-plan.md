# RN Frontend Jest Coverage Ratchet Plan

**Date**: 2026-05-10
**Author**: ops-rn-coverage-realistic-baseline (PR #276 follow-up)
**Status**: Active — baseline restored at current actuals; ratchet over time

---

## Background

| PR | Date | Effect |
|---|---|---|
| (initial) | (history) | `coverageThreshold.global = 70` was set when `frontend/CretasFoodTrace/jest.config.js` was first created — masked by `continue-on-error: true` on the rn-test CI job for the full lifetime of the file. |
| **#224** | 2026-05-09 | Removed `continue-on-error: true` AND added the missing jest binary. Did **not** touch the 70% gate. Every push to `main` since then failed `rn-test` exit 1: tests pass (44 suites / 880 tests) but the 70% threshold is unreachable against actual ~4% coverage. |
| **#276** | 2026-05-09→10 | Dropped the unenforceable 70% block to unblock CI on test pass/fail. Coverage data is still collected and uploaded as the `rn-coverage` artifact (`retention-days: 14`). |
| **This PR** | 2026-05-10 | Restore a REALISTIC baseline at current actuals so further regressions are blocked AND the gate can be ratcheted up over time. |

---

## Current actual coverage (2026-05-10)

Reproduced locally with `yarn test --ci --coverage --forceExit` on PR #276 head (`9be46501bb`):

```
Test Suites: 44 passed, 44 total
Tests:       880 passed, 880 total

File         | % Stmts | % Branch | % Funcs | % Lines
All files    |    4.04 |     1.86 |    5.02 |    4.01
```

This matches the PR #276 description CI failure capture exactly.

---

## Baseline set in jest.config.js (this PR)

```js
coverageThreshold: {
  global: {
    statements: 4,    // current 4.04 — 0.04pp margin
    branches: 1.5,    // current 1.86 — 0.36pp margin
    lines: 4,         // current 4.01 — 0.01pp margin
    functions: 5      // current 5.02 — 0.02pp margin
  }
}
```

**Defensive margin rationale**: 0.5-1 percentage points below current actuals.
A single test deletion or a few-line untested-code addition should not tip CI
red on its own — the baseline is a regression gate, not a precision floor.

**NOT set above current actuals**: PR #224's mistake (70% vs 4% actual) caused
every CI run to fail despite green tests. We will not repeat this. Any ratchet
must follow actual coverage gains, not aspirational targets.

---

## Ratchet plan (quarterly)

| Phase | ETA | Statements | Branches | Lines | Functions |
|---|---|---|---|---|---|
| **Now (baseline)** | 2026-05-10 | 4 | 1.5 | 4 | 5 |
| **Quarter 1** | ~2026-08-10 (3mo) | 10 | 5 | 10 | 12 |
| **Quarter 2** | ~2026-11-10 (6mo) | 20 | 10 | 20 | 25 |
| **Quarter 3** | ~2027-02-10 (9mo) | 35 | 20 | 35 | 40 |
| **Long-term** | ~2027-05-10 (12mo+) | 60 | 50 | 60 | 65 |

Industry baseline for non-mission-critical mobile apps lands around 60-70%
overall coverage. This trajectory keeps the team out of test churn at the
start while providing a clear, achievable destination over a year.

---

## Process: how to ratchet

### Per test PR (incremental)

When a PR adds tests covering previously untested ground (e.g. a new screen,
a new service, expanded branch coverage on an existing module):

1. Run `yarn test --ci --coverage --forceExit` locally.
2. Inspect the new "All files" row.
3. If any axis (stmts/branches/lines/funcs) gains > 1 percentage point,
   bump the corresponding threshold in `jest.config.js` by 1 pp at most.
4. Verify CI still green on the bumped threshold.
5. Note the bump in the PR body so reviewers can sanity-check.

**Do NOT bump aggressively**. Bumping by 5pp means future test deletions in
unrelated areas can tip CI red even when the test was buggy and deserved
deletion. 1pp at a time leaves a forgiving safety net.

### Per quarter (planned)

At the start of each quarter:

1. Capture the current "All files" coverage row.
2. Compare against the table above.
3. If on track, ratchet the threshold to match the next quarter's target,
   minus a 1pp defensive margin.
4. If behind, document the cause (deferred test work, framework migration,
   etc.) and renegotiate the next quarter's target.

---

## Hard rules (do NOT)

- **Do NOT set baseline ABOVE current actual**. Repeats PR #224's mistake.
  CI will fail every commit despite green tests.
- **Do NOT bump targets aggressively**. Causes test churn — engineers waste
  hours writing low-value tests just to clear an arbitrary gate.
- **Do NOT remove `coverageThreshold.global` again**. The whole point of
  this PR is to keep a regression gate alive. If the threshold needs to be
  relaxed (e.g. a major refactor temporarily drops coverage 2pp), reduce
  it inline rather than deleting the block.
- **Do NOT remove coverage data collection** (`jest --coverage` in CI, the
  `rn-coverage` artifact upload). Trend tracking depends on it.

---

## Coverage artifact retention

The `rn-coverage` GitHub Actions artifact stores per-run coverage with
`retention-days: 14`. To track quarterly trends beyond 14 days, copy the
"All files" line into this doc's appendix below at the start of each quarter.

### Trend log (append at each quarterly review)

| Quarter | Date snapshot | Statements | Branches | Lines | Functions | Notes |
|---|---|---|---|---|---|---|
| Baseline | 2026-05-10 | 4.04 | 1.86 | 4.01 | 5.02 | PR #276 follow-up; 44 suites / 880 tests. |
| _(future entries)_ | | | | | | |

---

## References

- `frontend/CretasFoodTrace/jest.config.js` — the threshold block + ratchet
  plan inline comment.
- PR #224 — added jest binary, removed continue-on-error.
- PR #276 — dropped unenforceable 70% gate.
- This PR — restored realistic baseline + ratchet plan documentation.
