# Strict-byte Phase 1 Week 2 — Helpers Integration + First Endpoint Pilot

**Date**: 2026-05-09
**Status**: SHIPPED (this PR)
**Predecessors**: PR #194 (Chat F Week 1 helpers) + PR #192 (Chat G recorder + markers)
**Successor**: Week 3 — CI gate + retroactive PoC + full docs (~330 LOC per PR #159 §4)

---

## 1. Scope

This PR closes Week 2 of the 3-week Phase 1 strict-byte foundation per PR #159
(`6a4f...`) §3 by:

1. **Integrating** Chat F's dispatcher (`assert_response_eq`) with Chat G's
   pytest marker convention (`@pytest.mark.strict_byte` / `comparator_mode`
   fixture) via a new `assert_response_match` fixture.
2. **Validating** the integration end-to-end with 15 synthetic-byte tests
   demonstrating dict-eq default + strict-byte opt-in + Pattern A/A2 catch.
3. **Piloting** strict-byte on the `/alerts` endpoint — pivoted to
   "frozen Python snapshot" purpose after PR #205 (T6.5 Phase B) decommissioned
   the Java side.

**Out of scope** (Week 3): pytest CI gate per marker, sample retroactive PoC
on a different endpoint, full docs cross-link to `python-java-port.md` Rule 4,
auto-flag for first-strict-byte-endpoint adoption.

---

## 2. What changed

### 2.1 New fixture — `assert_response_match` (conftest.py)

`tests/python/smartbi_compat/conftest.py` gains an ergonomic wrapper that
binds Chat F's dispatcher to the test's `comparator_mode`:

```python
@pytest.fixture
def assert_response_match(comparator_mode: str) -> Callable[..., None]:
    """Returns a callable pre-bound to the test's comparator_mode."""
    from smartbi_compat._strict_byte.dispatcher import (
        _DEFAULT_VOLATILE_KEYS, assert_response_eq,
    )
    def _do_assert(actual, expected, *, volatile_keys=_DEFAULT_VOLATILE_KEYS,
                   volatile_byte_patterns=None) -> None:
        assert_response_eq(actual, expected, mode=comparator_mode,
                           volatile_keys=volatile_keys,
                           volatile_byte_patterns=volatile_byte_patterns)
    return _do_assert
```

Usage in tests becomes:

```python
def test_default(assert_response_match):                # dict_eq
    assert_response_match({"a": 1.0}, {"a": 1})

@pytest.mark.strict_byte
def test_strict(assert_response_match):                 # strict_byte
    assert_response_match(b'{"v":1}', b'{"v":1}')
```

No `mode=` arg needed — the marker dictates. Backward compatible: the
underlying `assert_response_eq(mode=...)` API is unchanged.

### 2.2 New integration tests — `test_strict_byte_integration.py` (~155 LOC)

15 self-contained tests covering the wiring chain:

| Group | Cases | What it proves |
|---|---|---|
| Marker fixture wiring | 3 | No marker → `dict_eq`; `@dict_eq` → `dict_eq`; `@strict_byte` → `strict_byte` |
| dict-eq path | 4 | passes equal dicts / fails diverging / strips default volatile keys / accepts custom volatile_keys |
| strict-byte path | 3 | passes identical bytes / fails diverging bytes (rich diff report) / volatile_byte_patterns masks timestamps |
| Pattern A/A2 demo | 3 | dict-eq tolerates int-collapse `100.00`↔`100`; strict-byte catches it; same for scale-4 trailing zeros |
| Type guards | 2 | strict-byte rejects dict input with TypeError; nested volatile keys stripped recursively |

**No live env, no monkey patching, no production code touched.** Pure
foundation validation. Ships in 0.18s.

### 2.3 New pilot — `test_strict_byte_alerts_pilot.py` (~190 LOC)

Pilot strict-byte test against the `/alerts` aggregator endpoint:

- Uses `TestClient` + monkey-patched `_query_finance_data` /
  `_query_department_data` / `_query_sales_data` seams with the same
  V20260430_02 trip-rows fixture as the existing dict-eq contract test.
- Reads `tests/fixtures/python-strict-byte-golden/alerts-F999-aggregator.json.bytes`
  (3,397 bytes) and compares to `resp.content` byte-for-byte with three
  volatile patterns masked: per-alert UUID `id`, per-alert `createdAt`,
  envelope `timestamp`.
- Standalone recorder via `python <file> --record` for golden refresh.

Two tests:

| Test | Marker | Asserts |
|---|---|---|
| `test_alerts_python_self_byte_stability_F999` | `@strict_byte` | Frozen golden = current TestClient bytes (volatile masked) |
| `test_alerts_volatile_pattern_truly_volatile_across_runs` | `@strict_byte` | Two consecutive runs produce DIFFERENT raw bytes (proves masking necessary, not cosmetic) |

---

## 3. Pivot — `/alerts` is no longer Java-source-of-truth

The Week 2 marching order suggested `/alerts` for the pilot expecting
"Java byte-shape parity" semantics. **PR #205 (T6.5 Phase B,
2026-05-08) stubbed all 22 `SmartBIAnalysisController` method bodies to
return HTTP 410 Gone for all factories including F999.** `/alerts` is one
of them. Confirmed empirically:

```
$ curl -H "Authorization: Bearer $JWT" http://localhost:10011/api/mobile/F999/smart-bi/alerts
HTTP/1.1 410 Gone
```

→ **Java byte recording for `/alerts` is impossible post-T6.5 Phase B.**

### 3.1 Pivot rationale

The strict-byte gate's Phase 1 design (PR #154 / PR #156 / PR #159) framed
its purpose as "Phase 2A Java parity QA". PR #155 §0 (frontend-impact
verification) and PR #152 (Tier 3 Upload binary-fidelity) had already
identified the **future** Phase 3+ use case: **frozen Python snapshot
regression detection**.

T6.5 Phase B pulled that future forward — **the Java SmartBI Analysis
endpoints are no longer alive to compare against**. The strict-byte gate's
current and future utility is exclusively the "frozen Python snapshot"
purpose. The pilot exercises exactly this purpose.

### 3.2 What the pilot proves

The frozen-snapshot pilot demonstrates the strict-byte gate catches
regressions **invisible to dict-eq**, including:

- Pattern A int-collapse (Decimal `100.00` → int `100`)
- Pattern A2 scale-4 trailing-zero loss (`99.9900` → `99.99`)
- `Map.of` key reordering
- `_java_isoformat` trailing-zero microsecond drift (Rule 11)
- Lombok decapitalize quirks (Rule 9.1)
- Any change to FastAPI / starlette response-body emitter

Volatile-pattern masking handles the inherently non-deterministic fields
(UUID `id`, datetime `createdAt`, envelope `timestamp`) so the gate is
**signal not noise**.

### 3.3 Implications for Week 3 + future PRs

| Workstream | Week-2 finding effect |
|---|---|
| Week 3 CI gate | Configure marker as **non-blocking by default** for any first-time strict-byte test (so a snapshot-regen mistake doesn't break CI) — flip to blocking after first soak. |
| Week 3 PoC migration | Pick a second still-live endpoint (e.g. a non-SmartBI controller / `/dashboard` once Python ports it) for Java-vs-Python parity demonstration. Document the path-of-least-friction for new strict-byte adopters. |
| `python-java-port.md` Rule 4 | Cross-link to this pilot from the §"When to upgrade to strict-byte (Phase 3+)" section as the canonical "frozen snapshot" example. |
| Phase 2B Tier 3 Upload | Use this pilot's volatile-pattern + `_hit_alerts` style as the template for binary-fidelity contract tests. |

---

## 4. Verification

### 4.1 Local test results

```
$ pytest tests/python/smartbi_compat/test_alerts_contract.py \
         tests/python/smartbi_compat/test_strict_byte_integration.py \
         tests/python/smartbi_compat/test_strict_byte_alerts_pilot.py \
         backend/python/tests/test_strict_byte_helpers.py -v

====================== 55 passed, 17 warnings in 11.75s ======================
```

| Suite | Cases | Notes |
|---|---|---|
| `test_strict_byte_helpers.py` (PR #194) | 26 | Untouched, still pass |
| `test_alerts_contract.py` (Phase 2A dict-eq) | 12 | Untouched, still pass — zero regression |
| `test_strict_byte_integration.py` (this PR) | 15 | All wiring + Pattern A/A2 demo |
| `test_strict_byte_alerts_pilot.py` (this PR) | 2 | Pilot strict-byte parity + volatile masking necessity proof |

### 4.2 Files in scope

```
M  tests/python/smartbi_compat/conftest.py                      (+58 / 0)
A  tests/python/smartbi_compat/test_strict_byte_integration.py  (+155)
A  tests/python/smartbi_compat/test_strict_byte_alerts_pilot.py (+190)
A  tests/fixtures/python-strict-byte-golden/alerts-F999-aggregator.json.bytes  (3,397 bytes)
A  docs/superpowers/specs/2026-05-09-strict-byte-week-2-integration.md (this file)
```

Zero edits to:
- `backend/python/smartbi_compat/_strict_byte/` (Chat F's package)
- `scripts/record-java-golden.sh` (Chat G's recorder)
- Existing 22 dict-eq Phase 2A test files
- Any production code under `backend/python/smartbi_compat/api/`

### 4.3 Worktree commit hygiene

Worktree branched from `origin/main` at `aeec4f93e8` to avoid base-stale
issues per `.claude/rules/concurrent-edit-safety.md` Rule 2. Will commit
via `safe-commit.sh` per Rule 5b before push.

---

## 5. Design notes

### 5.1 Why a fixture wrapper, not dispatcher introspection

The dispatcher `assert_response_eq` is a pure module function in
`backend/python/smartbi_compat/_strict_byte/`. It must NOT import `pytest`
(production module under test). Marker auto-detection therefore lives in
`tests/.../conftest.py` as a pytest fixture wrapper that binds the dispatcher
to `comparator_mode`. This keeps:

- Production module pytest-free
- Test ergonomics one-liner (`assert_response_match(actual, expected)`)
- Backward compat for the `mode=` kwarg (callers outside pytest still work)

### 5.2 Why a NEW golden directory, not extending `java-smartbi-golden/`

`tests/fixtures/java-smartbi-golden/` semantically holds **Java** byte
goldens (per `.claude/rules/python-java-port.md`). The pilot's
`alerts-F999-aggregator.json.bytes` is a **Python** snapshot — putting it
under the Java directory would mislead future readers about the source of
truth. Created `tests/fixtures/python-strict-byte-golden/` as a sibling.

### 5.3 Why volatile_byte_patterns is regex bytes, not JSON-aware

The comparator runs at the byte layer (pre-JSON-parse) — it has no JSON
AST to walk. Patterns are passed as `bytes` regex strings; they substitute
matched substrings with literal `<MASKED>` before char-by-char compare.
This is intentional — JSON-aware masking would force a parse-emit
roundtrip, defeating the strict-byte purpose (lossy per PR #154 §1.1).

### 5.4 Volatile pattern set for `/alerts`

```python
_ALERTS_VOLATILE_BYTE_PATTERNS = [
    rb'"id":"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"',
    rb'"createdAt":"[^"]+"',
    rb'"timestamp":"[^"]+"',
]
```

Future strict-byte adopters across SmartBI endpoints will likely need a
similar trio. Week 3 should consider promoting this trio to a shared
`_strict_byte/volatile_patterns.py` constant.

---

## 6. Open questions for Week 3

1. **CI gate enforcement** — strict-byte tests blocking by default, or
   soft-warning until per-endpoint adoption decides? (Pilot suggests
   soft-warning for first 1-2 weeks of any new endpoint.)
2. **Golden refresh CI step** — auto-regenerate goldens on schema
   migration, or require manual `python <test> --record`? (Manual safer
   to avoid silent serialization regressions slipping through.)
3. **Volatile-pattern catalog** — promote per-endpoint patterns to
   shared module, or keep per-test? (Catalog wins as adoption scales
   beyond 3-4 endpoints.)
4. **Second pilot endpoint** — per §3.3 Week 3, pick a Java-still-live
   endpoint to demonstrate Java-vs-Python parity capability. Candidates:
   non-SmartBI controllers (material / customer / order) once a worthy
   one is identified.

---

## 7. References

- **PR #194** (`065523be4`) Chat F Week 1 — 3 helpers (`_decimal_preserve_scale`,
  `StrictDiff`, `_strict_compare_response`, `assert_response_eq` explicit-mode)
- **PR #192** (`01ab4852b`) Chat G — `record-java-golden.sh --strict-byte` flags +
  `tests/python/smartbi_compat/conftest.py` markers + `comparator_mode` fixture
- **PR #159** (`71df443b8`) Phase 1 week-by-week impl plan — week 2 § 3
- **PR #156** (`ec4537e6d`) P1 gap definition
- **PR #155** (`1cd384a01`) Frontend impact verification — confirms Phase 2A dict-eq
  sufficient, strict-byte for Phase 3+
- **PR #154** (`45a03dee3`) Strict-byte gate test infra spec
- **PR #205** (`be5959c50`) **T6.5 Phase B — 22 SmartBIAnalysisController stubbed
  to 410 (this PR's pivot trigger)**
- **PR #208** (`069162b41`) Phase 2A retrospective
- `.claude/rules/python-java-port.md` Rule 4 — Phase 2A dict-eq gate
- `.claude/rules/concurrent-edit-safety.md` Rules 2 / 5b — applied to this PR

---

## 8. Test plan

- [x] 15 integration tests pass in 0.18s
- [x] 2 pilot tests pass in 10.31s (TestClient + monkey-patched seams)
- [x] 12 existing dict-eq alerts contract tests still pass — zero regression
- [x] 26 PR #194 Chat F helpers tests still pass
- [x] No edits to Chat F's `_strict_byte/` package
- [x] No edits to Chat G's `record-java-golden.sh`
- [x] No edits to existing 22 Phase 2A dict-eq test files
- [x] Worktree branched from `origin/main` (concurrent-edit-safety Rule 2)
- [ ] Reviewer confirms pivot rationale (§3) acceptable given PR #205
- [ ] Week 3 chat picks up open questions (§6) before kickoff

---

## 9. 并行工作建议

### Subagent: ❌ Not needed
This PR's scope (1 fixture + 2 test files + 1 spec doc) is small enough for
a single chat. No independent modules to parallelize.

### 多Chat: ✅ Week 3 can split
Week 3 deliverables (CI gate / second pilot / docs cross-link) are
independent enough for 2 parallel chats:
- **Chat A**: CI gate enforcement design + `python-java-port.md` Rule 4 cross-link
- **Chat B**: Second pilot endpoint (Java-still-live) + volatile-pattern catalog

No file conflicts expected (different test files + different docs).
