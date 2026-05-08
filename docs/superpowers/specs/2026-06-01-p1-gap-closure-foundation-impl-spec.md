# P1 Gap Closure — Foundation Implementation Spec

**Phase**: pre-Phase 2B Tier 3 prep (foundation work)
**Status**: Implementation spec — ready to dispatch when foundation kickoff trigger fires (per §9)
**Date**: 2026-06-01
**Author**: chat 2 (test infra detail)
**Sister docs**:
- PR #156 (`ec4537e6d`) handoff readiness — defines this P1 gap
- PR #154 (`45a03dee3`) strict-byte test infra spec — high-level component design
- PR #153 (`2f7bd9bda`) strict-byte adoption decision — when to adopt + Java alignment
- PR #155 (`1cd384a01`) frontend impact verification — **0/50 endpoints need strict-byte today**

---

## 0. TL;DR

PR #156 §4 identifies P1 gap: ~3 weeks Foundation per PR #153 §3.2 — `_decimal_preserve_scale` + strict-byte comparator + pytest gate annotation. This spec is the **concrete week-by-week implementation plan**: per-week deliverables, sign-off criteria, risk register, open questions for the foundation reviewer.

**Total effort**: ~3 weeks calendar (1 chat sequential) or ~1.5–2 weeks (2 chats parallel where independent).

**Deflated urgency** (per PR #155): 0/50 Phase 2A endpoints need strict-byte; Phase 3+ stay dict-eq indefinitely. The foundation is **future-proofing for Phase 2B Tier 3 Upload binary-fidelity contracts**, NOT a retroactive Phase 2A migration. Affects priority but not technical scope.

**Hard scope**: Foundation only. NO per-endpoint adoption, NO Java-side adjustments, NO retroactive Phase 2A migration. Each of those is separate effort downstream.

This spec is **planning only**. No code changes.

---

## 1. Scope reference

### 1.1 P1 gap definition (PR #156 §4)

> **P1 (must, pre-Tier 3) — ~3 weeks** — Foundation per PR #153 §3.2 — `_decimal_preserve_scale` + strict-byte comparator + pytest gate annotation.

### 1.2 Effort window

- **Earliest start**: 2026-06-01 (placeholder; actual depends on T6.5 Phase C readiness + chat assignment).
- **Target completion**: 2026-06-22 (~3 weeks calendar, sequential).
- **Hard deadline**: pre-Phase 2B Tier 3 Upload kickoff (~2027-Q1 per PR #152 timeline). Actual buffer: ~6 months.
- **Trigger condition**: Phase 2A retrospective signed off (✅ PR #151 done) + T6.5 Phase A complete (~2026-05-29 per PR #150) + Tier 3 Upload prereq window opens.

### 1.3 What changed from PR #154 sketch

PR #154 specified ~3 weeks foundation across all components. This spec breaks it into:
- **Week 1**: helpers + comparator (foundation primitives)
- **Week 2**: dispatcher + record-golden extension (integration)
- **Week 3**: pytest infra + sample migration + docs (consumer-facing)

Each week has explicit sign-off gates — implementer can pause between weeks if priorities shift.

### 1.4 What changed from PR #155 finding

PR #155 frontend impact verification found 0/50 Phase 2A endpoints actually need strict-byte. This affects:
- ❌ **Phase 2A retroactive migration**: NOT triggered. Out of scope (per §7).
- ✅ **Phase 2B Tier 3 Upload prep**: STILL triggered (binary upload-envelope contract).
- ✅ **Foundation work**: STILL valuable — primitives reusable, no waste.

Foundation tracks **as planned** but with deflated urgency — no production fire, can prioritize against other P1 work in the 58-day window.

---

## 2. Week 1 deliverables — helpers + comparator (~3-5 days)

### 2.1 `_decimal_preserve_scale` helper (~80 LOC)

Mirror Java `BigDecimal.toPlainString()`. Preserves trailing zeros and avoids
scientific-notation collapse.

**File**: `backend/python/smartbi_compat/_strict_byte.py` (NEW module)

```python
def _decimal_preserve_scale(v: Decimal | None) -> str:
    """Convert Decimal to JSON-safe string preserving Java BigDecimal scale.

    Java BigDecimal("100.00") → "100.00"  (6 chars; trailing zeros kept)
    Java BigDecimal("0.00")   → "0.00"
    Java BigDecimal("99.9900") → "99.9900"
    Java BigDecimal("1E+10")  → "10000000000"  (no scientific notation)

    Compare to Phase 2A `_decimal_to_number(v)` which collapses to int/float
    and is used by dict-eq endpoints; this helper is for strict-byte endpoints
    only.
    """
    if v is None:
        return "null"
    return v.to_eng_string()
```

**Test cases** (pytest, ~80 LOC):
- `Decimal("100")` → `"100"` (zero scale, integer)
- `Decimal("100.00")` → `"100.00"` (scale 2, trailing zeros)
- `Decimal("99.9900")` → `"99.9900"` (scale 4)
- `Decimal("0.00")` → `"0.00"` (zero with scale)
- `Decimal("0")` → `"0"` (zero no scale)
- `Decimal("-100.50")` → `"-100.50"` (negative)
- `Decimal("1E+10")` → `"10000000000"` (large, no scientific)
- `Decimal("0.000001")` → `"0.000001"` (small, no scientific)
- `None` → `"null"`

### 2.2 `StrictDiff` dataclass (~50 LOC)

**File**: `backend/python/smartbi_compat/_strict_byte.py` (same module)

```python
@dataclass(frozen=True)
class StrictDiff:
    matched: bool
    first_diff_offset: int | None     # None if matched
    first_diff_line: int | None       # 1-indexed line number containing offset
    expected_chunk: bytes             # ~100 bytes around diff
    actual_chunk: bytes
    expected_total_len: int
    actual_total_len: int

    def format_report(self) -> str:
        """Multi-line failure report with hex dump + UTF-8 decode."""
        ...
```

**Test cases** (~30 LOC):
- Constructed for matched case (`matched=True`, all other None/empty).
- Constructed for length-mismatch case (chunks at the shorter end).
- Constructed for content-mismatch case (chunks centered on diff offset).
- `format_report()` output snapshot test (golden string compare).

### 2.3 `_strict_compare_response` comparator (~150 LOC)

**File**: `backend/python/smartbi_compat/_strict_byte.py` (same module)

```python
def _strict_compare_response(
    actual: bytes,
    expected: bytes,
    *,
    volatile_byte_patterns: list[bytes] | None = None,
) -> StrictDiff:
    """Char-by-char compare; optionally mask volatile byte patterns first.

    Implementation per PR #154 §3.2 sketch. Three cases:
      1. lengths differ → diff at first byte mismatch OR at shorter end
      2. lengths equal + content equal → matched=True
      3. lengths equal + content differs → diff at first byte mismatch
    """
    if volatile_byte_patterns:
        for pattern in volatile_byte_patterns:
            actual = re.sub(pattern, b"<MASKED>", actual)
            expected = re.sub(pattern, b"<MASKED>", expected)
    ...
```

**Visualization helper** (part of `format_report()`):

```
StrictByteDiff at offset 1247 (line 47):
  Expected: ..."actual": 100.00, "currency": "CNY"...
  Actual:   ..."actual": 100,    "currency": "CNY"...
                          ^ first divergence byte 1247
  Total expected: 4583 bytes (152 lines)
  Total actual:   4576 bytes (-7 bytes)

Hex dump @ offset 1240-1280:
  Expected: 31 30 30 2e 30 30 2c 20 22 63 75 72 72 65  100.00, "curre
            6e 63 79 22 3a 20 22 43 4e 59 22           ncy": "CNY"
  Actual:   31 30 30 2c 20 22 63 75 72 72 65 6e 63 79  100, "currency
            22 3a 20 22 43 4e 59 22                    ": "CNY"
```

**Test cases** (~40 LOC):
- Identical bytes → `matched=True`, all-None diff fields.
- Single-byte diff at offset 50 → exact offset detected, chunk centered.
- Length mismatch (actual shorter by 7 bytes) → diff at end of actual.
- Volatile masking — `lastUpdated` ISO timestamp pattern → masks both, identical post-mask → matched.
- Multi-line report — verify line number = byte-newline-count up to offset + 1.

### 2.4 Unit tests for above (~100 LOC)

**File**: `tests/python/smartbi_compat/test_strict_byte_helpers.py` (NEW)

Co-locate with existing smartbi_compat tests. Discoverable by default pytest run.

### 2.5 Week 1 sign-off criteria

- [ ] `pytest tests/python/smartbi_compat/test_strict_byte_helpers.py -v` all pass.
- [ ] `python -c "import ast; ast.parse(open('backend/python/smartbi_compat/_strict_byte.py').read())"` syntax OK.
- [ ] Existing 22 dict-eq test files unchanged + still pass (zero regression).
- [ ] LOC actual within ±20% of estimate (helpers ~80 / dataclass ~50 / comparator ~150 / tests ~100 = ~380 LOC).
- [ ] No imports from production endpoint code (helpers + comparator are pure).

---

## 3. Week 2 deliverables — dispatcher + record-golden extension (~3-5 days)

### 3.1 `assert_response_eq` dispatcher (~80 LOC)

**File**: `backend/python/smartbi_compat/_strict_byte.py` (extend Week 1 module)

```python
def assert_response_eq(
    actual,
    expected,
    *,
    mode: str | None = None,
    volatile_keys: frozenset[str] = _DEFAULT_VOLATILE_KEYS,
    volatile_byte_patterns: list[bytes] | None = None,
):
    """Marker-aware response comparator.

    Mode auto-detection priority:
      1. Explicit `mode=` arg overrides.
      2. Else, current pytest item's @pytest.mark.strict_byte → "strict_byte"
      3. Else, current pytest item's @pytest.mark.dict_eq → "dict_eq" (explicit)
      4. Else default → "dict_eq" (no marker = backward compat)

    On strict_byte: actual + expected MUST be bytes; calls _strict_compare_response.
    On dict_eq: actual + expected MUST be dict/list; strips volatile keys recursively, compares via Python equality.
    """
    if mode is None:
        mode = _detect_mode_from_pytest_marker()
    ...
```

**Failure mode UX** — distinct messages per mode:

```
# dict_eq failure:
AssertionError: dict-eq divergence (volatile keys stripped: ['cacheExpireAt', 'generatedAt', 'lastUpdated', 'timestamp'])

# strict_byte failure:
AssertionError: StrictByteDiff at offset 1247 (line 47):
  Expected: ..."actual": 100.00, "currency": "CNY"...
  Actual:   ..."actual": 100,    "currency": "CNY"...
                          ^ first divergence byte 1247
  ...
```

**Test cases** (~40 LOC):
- dict_eq path (no marker) → equivalent to manual `_strip_volatile + assert ==`.
- explicit `mode="strict_byte"` → bytes-compare path.
- type mismatch error (strict_byte mode + dict args) → clear `TypeError`.
- marker auto-detection via mocked pytest fixture.

### 3.2 `record-java-golden.sh` extensions (~50 LOC)

**File**: `scripts/record-java-golden.sh` (extend existing 89 LOC script)

**Constraint**: ⚠️ shared script — per `concurrent-edit-safety.md` Rule 4, MUST `git status` before editing. Implementer should open dedicated worktree for this edit alone (no other concurrent chats touching the script).

```bash
# New flags (additive — backward compat preserved):
#   --strict-byte         Record BOTH .json (dict-eq) and .json.bytes (strict-byte)
#   --strict-byte-only    Record ONLY .json.bytes (skip dict-eq pretty-print)

# Existing usage unchanged:
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/...' \
    analysis-finance-F999.json

# New strict-byte mode:
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/...' \
    analysis-finance-F999.json --strict-byte
# Output:
#   tests/fixtures/java-smartbi-golden/analysis-finance-F999.json        (existing)
#   tests/fixtures/java-smartbi-golden/analysis-finance-F999.json.bytes  (NEW)
```

**Implementation sketch**:

```bash
# After existing curl + JWT setup, capture raw response to temp file:
RAW_TMP=$(mktemp)
curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" --output "$RAW_TMP"

# Conditionally produce dict-eq pretty-printed .json (default + --strict-byte):
if [[ "$STRICT_MODE" != "strict-byte-only" ]]; then
    python3 -c "import json, sys; print(json.dumps(json.load(open('$RAW_TMP'), encoding='utf-8'), indent=2, ensure_ascii=False))" > "$OUT_PATH"
fi

# Conditionally produce strict-byte raw .json.bytes (--strict-byte or --strict-byte-only):
if [[ "$STRICT_MODE" == "strict-byte" || "$STRICT_MODE" == "strict-byte-only" ]]; then
    cp "$RAW_TMP" "$OUT_PATH.bytes"
fi

rm "$RAW_TMP"
```

### 3.3 Integration tests dispatcher + golden recording (~100 LOC)

**File**: `tests/python/smartbi_compat/test_strict_byte_integration.py` (NEW)

Test the full pipeline:
- Record a golden with `--strict-byte` against a fake Java-equivalent response (mock httpserver).
- Verify both `.json` and `.json.bytes` artifacts produced.
- Assert dict-eq comparator passes against `.json`.
- Assert strict-byte comparator passes against `.json.bytes`.
- Inject a 1-byte difference; assert strict-byte fails with correct diff offset; dict-eq still passes (Pattern A tolerance).

### 3.4 Week 2 sign-off criteria

- [ ] `pytest tests/python/smartbi_compat/test_strict_byte_integration.py -v` all pass.
- [ ] Manual smoke: `record-java-golden.sh F999 <endpoint> <name>.json --strict-byte` produces both files (dry-run against test env, NOT prod).
- [ ] Existing 22 dict-eq test files still pass (zero regression).
- [ ] `record-java-golden.sh` backward-compat verified: omitting `--strict-byte` flag produces exactly the old single `.json` file.
- [ ] LOC actual within ±20% of estimate (dispatcher ~80 / script ext ~50 / integration tests ~100 = ~230 LOC).
- [ ] No prod nginx config changes, no deploy.

---

## 4. Week 3 deliverables — pytest infra + sample migration + docs (~3-5 days)

### 4.1 `conftest.py` marker registration (~30 LOC)

**File**: `tests/python/smartbi_compat/conftest.py` (extend existing 8 LOC)

```python
# tests/python/smartbi_compat/conftest.py — additions

import pytest

def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "strict_byte: test compares raw response bytes (strict gate). "
        "Requires .json.bytes golden file. See "
        "docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md"
    )
    config.addinivalue_line(
        "markers",
        "dict_eq: test compares parsed dict equality (default Phase 2A gate). "
        "Tolerates Pattern A/A2 numeric collapse per python-java-port.md Rule 4."
    )

@pytest.fixture
def comparator_mode(request):
    """Auto-detect mode from test markers; default dict_eq."""
    if request.node.get_closest_marker("strict_byte"):
        return "strict_byte"
    return "dict_eq"
```

### 4.2 CI gate per marker

**File**: `.github/workflows/test.yml` (or equivalent — verify with operator)

```yaml
- name: Run dict-eq tests (Phase 2A baseline + new dict-eq endpoints)
  run: pytest -m "dict_eq or not strict_byte" --tb=short
- name: Run strict-byte tests (selective, fail-fast on byte diff)
  run: pytest -m "strict_byte" --tb=long --maxfail=1
```

Strict-byte runs in dedicated CI lane to surface rich `StrictDiff.format_report()` and fail fast — first byte off cascades, diagnosing one is enough.

### 4.3 Per-test annotation pattern docs (~50 LOC examples)

**File**: `docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md` (extend §5.2 with concrete examples) — **OR** new file `docs/development/strict-byte-test-pattern.md`. Implementer choice.

Example annotations:

```python
# Default (no marker) — dict_eq applied automatically:
async def test_finance_overview_basic():
    actual = await _get_finance_overview("F999", date_range)
    expected = _load_golden("analysis-finance-F999.json")
    assert_response_eq(actual, expected)

# Explicit dict_eq (stylistic clarity):
@pytest.mark.dict_eq
async def test_finance_overview_explicit_dict():
    ...

# Strict-byte (Phase 2B Tier 3 / Phase 3+ contracts):
@pytest.mark.strict_byte
async def test_upload_envelope_byte_stable():
    actual_bytes = await _post_upload_request_raw(file=b"...")
    with open("tests/fixtures/java-smartbi-golden/upload-F001-envelope.json.bytes", "rb") as f:
        expected_bytes = f.read()
    assert_response_eq(actual_bytes, expected_bytes)
```

### 4.4 Sample retroactive Phase 2A migration (proof-of-concept) (~50 LOC test changes)

**File**: pick **one** existing Phase 2A test (e.g. `test_finance_overview.py`) and add a parallel `@pytest.mark.strict_byte` variant alongside the existing dict_eq tests.

**Goal**: prove the foundation works end-to-end without committing to full retroactive migration.

```python
# Existing dict-eq test stays untouched:
@pytest.mark.asyncio
async def test_state_b_f999_flag_true_gold_empty(self, date_range, monkeypatch):
    """State B: dict-eq parity (Phase 2A baseline)."""
    ...
    assert _strip_volatile(actual) == expected

# NEW: parallel strict-byte test (PoC):
@pytest.mark.asyncio
@pytest.mark.strict_byte
async def test_state_b_f999_strict_byte_poc(self, date_range, monkeypatch):
    """State B: strict-byte byte-shape (PoC after foundation lands).

    Expected outcome: this test will FAIL initially because Pattern A int-collapse
    in `_decimal_to_number` produces `100` instead of `100.00`. Documenting the
    failure mode end-to-end proves the foundation is wired correctly.
    """
    ...
    actual_bytes = json.dumps(actual, ...).encode("utf-8")
    with open(GOLDEN_DIR / "analysis-finance-overview-F999-state-b.json.bytes", "rb") as f:
        expected_bytes = f.read()
    assert_response_eq(actual_bytes, expected_bytes)  # auto strict_byte from marker
```

The PoC test is **expected to fail** on first run — that's the proof the
infrastructure is wired correctly. PoC test is then either:
- Fixed (replacing `_decimal_to_number` with `_decimal_preserve_scale` at this site) → demonstrates the migration recipe.
- Skipped (`pytest.mark.skip(reason="Phase 2A endpoint stays dict-eq per PR #155 finding")`) → documents that the foundation works but Phase 2A retrofit is not triggered.

### 4.5 Documentation (~200 LOC)

**File**: `docs/development/strict-byte-test-pattern.md` (NEW) **OR** extend `python-java-port.md` Rule 4 with strict-byte sub-section.

Sections:
- **When to use `@strict_byte` vs `@dict_eq`** — decision tree per PR #153 + PR #154 §6 + PR #155 finding (current default = dict_eq for everything).
- **Migration guide** — recipe for adding strict-byte to a new endpoint (record golden → annotate test → resolve divergence).
- **Troubleshooting** — common failure modes (volatile timestamp not masked / Pattern A int-collapse / Map.of order divergence).
- **CI gate diagnostics** — how to read `StrictDiff.format_report()` output, when to fix Python, when to fix Java, when to accept divergence.

### 4.6 Week 3 sign-off criteria

- [ ] `pytest --markers` shows `strict_byte` and `dict_eq` registered + descriptions.
- [ ] CI gate config commits + dry-run passes (or explicit "no CI yet, will add when triggered" note).
- [ ] PoC migration test exists, behavior documented (pass / fail / skip — each acceptable per §4.4).
- [ ] Documentation reviewed by chat 3 (cross-ref PR #153 §3.2 alignment) and chat 1 (Phase 2A test infra alignment).
- [ ] Existing 22 dict-eq test files still pass (zero regression).
- [ ] LOC actual within ±20% of estimate (conftest ~30 / docs examples ~50 / PoC ~50 / docs ~200 = ~330 LOC).

---

## 5. Per-week sign-off criteria summary

| Week | Pass criteria |
|---|---|
| 1 | `pytest -k 'strict_byte_helpers'` all pass + zero regression on 22 dict-eq tests + helpers/comparator AST OK |
| 2 | `pytest -k 'strict_byte_integration'` all pass + sample golden recording works + record-java-golden.sh backward-compat preserved + zero regression |
| 3 | `pytest --markers` shows registered + CI gate enforces + PoC migration documented + docs reviewed by chat 1+3 + zero regression |
| **All weeks** | **Existing 22 dict-eq test files unchanged + still pass** (hard constraint) |

---

## 6. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|:-:|:-:|---|
| R-1 | Coupling with Phase 2A test infrastructure (zero-churn requirement) | M | H | All new code in NEW module `_strict_byte.py`; `assert_response_eq` is opt-in; default behavior unchanged. Verify via "22 tests still pass" gate every week. |
| R-2 | `record-java-golden.sh` extension breaking existing dict-eq goldens | L | H | Default mode (no `--strict-byte` flag) MUST produce byte-identical `.json` to current behavior. Add regression test: re-record same golden with default mode pre/post extension, diff must be empty. |
| R-3 | Pytest marker conflict with existing infrastructure | L | L | `conftest.py` is 8 LOC clean slate (verified per PR #154 §1.3). No conflict expected. |
| R-4 | CI gate config per environment (local / CI / nightly) | M | M | Document explicit invocation per env. Don't auto-enable strict-byte CI lane until first endpoint annotated (Week 3 PoC). |
| R-5 | PoC migration test failure misinterpreted as broken foundation | M | M | Comment explicitly: "expected to fail — proves foundation wired". Skip with reason if PR #155 path adopted (no Phase 2A retrofit). |
| R-6 | `_decimal_preserve_scale` semantic drift from Java BigDecimal.toPlainString() | M | H | Per Java BigDecimal spec, `toPlainString()` does NOT use scientific notation. Python `Decimal.to_eng_string()` matches this; `Decimal.__str__()` may use exponential for very small numbers. Test cases §2.1 cover edge cases. Add cross-language parity test: Java emit + Python emit on same input must byte-match. |
| R-7 | Concurrent edits to `record-java-golden.sh` (chat 2 foundation + chat 1 unrelated work simultaneously) | M | M | Per `concurrent-edit-safety.md` Rule 2 + Rule 4: foundation chat opens dedicated worktree; `git status` before edit; commit with `-- <paths>` per Rule 5b. |
| R-8 | Foundation work prioritized below Phase 2B Tier 1/2 work + slips past Tier 3 kickoff | L | H | 6-month buffer (June 2026 → Jan 2027 Tier 3 kickoff per PR #152). Foundation can fit anywhere in window. Re-evaluate priority at Phase 2B Tier 1 mid-point. |

---

## 7. Out of scope

| Item | Why out of scope | Owner |
|---|---|---|
| Per-controller strict-byte adoption | Phase 2B Tier dispatch territory; foundation provides primitives only | Phase 2B Tier 1/2/3 chats |
| Java side adjustments (`@JsonInclude(NON_NULL)`, `@JsonPropertyOrder`, custom serializers) | PR #153 §3 chat 3's Java migration recommendations scope | chat 3 |
| Full retroactive Phase 2A migration (~8-12 weeks per PR #154 §8.3) | PR #155 finding deflated this — 0/50 endpoints need strict-byte today; not triggered | n/a (NOT triggered) |
| Frontend test infra (RN/Vue hash-compare) | Frontend separate effort | mobile/web team |
| Performance benchmarks for strict-byte comparator | Separate workstream post-foundation | TBD post-foundation |
| Embedding service (gRPC) byte parity | Not byte-shape JSON parity scope | Out of scope indefinitely |

---

## 8. Open questions for foundation reviewer

These need explicit answers BEFORE Week 1 starts (when triggered):

### Q-1 — Pluggable comparator design

PR #154 §11 Q-1 carry-forward: single `assert_response_eq` with marker dispatch (recommended) vs separate `assert_dict_eq` / `assert_strict_byte` exports? Single dispatcher reduces test boilerplate; separate functions are more explicit for grep-ability.

**Recommended: single dispatcher** (this spec assumes it). Reviewer override OK.

### Q-2 — Golden file naming convention

PR #154 §11 Q-2 carry-forward: `<name>.json.bytes` (recommended) vs `<name>.json.strict` vs `<name>.bytes.json`?

**Recommended: `<name>.json.bytes`** (binary-stable nature explicit; `.bytes` extension makes git-grep / `find` workflows uniform).

### Q-3 — CI failure UX

PR #154 §11 Q-3 carry-forward: is `StrictDiff.format_report()` (hex dump + UTF-8 decode + offset) sufficient, or HTML side-by-side viewer needed?

**Recommended: text report sufficient for foundation**. HTML viewer is Phase 2B Tier 3 binary upload concern (deferred).

### Q-4 — Resource allocation

1 chat sequential = 3 weeks calendar. 2 chats parallel:
- Week 1 (helpers + comparator) is sequential within itself (helpers feed comparator).
- Week 2 (dispatcher + record-golden ext) — these two are independent, can parallelize across 2 chats.
- Week 3 (conftest + PoC + docs) — conftest and PoC are sequential; docs can parallel.

**Best parallelization: 1.5–2 weeks elapsed with 2 chats**. Reviewer confirms chat assignment.

### Q-5 — Sample migration disposition

Week 3 §4.4 PoC test: pass via fix / skip with PR #155 reason / leave failing as documentation?

**Recommended: skip with PR #155 reason** (foundation works; Phase 2A stays dict-eq per actual finding). This avoids creating a precedent that foundation requires retrofit.

### Q-6 — Documentation location

Week 3 §4.5 docs: new `docs/development/strict-byte-test-pattern.md` (recommended) vs extend `python-java-port.md` Rule 4?

**Recommended: new file** + cross-ref from `python-java-port.md` Rule 4 (so existing rule doc doesn't bloat).

### Q-7 — CI gate auto-enable timing

Week 3 §4.2 CI gate: auto-enable on PR merge OR gate behind operator opt-in until first real strict-byte endpoint?

**Recommended: gate behind opt-in** (no auto-enable until Phase 2B Tier 3 first strict-byte endpoint annotated). Avoids running empty `pytest -m strict_byte` on every CI build.

---

## 9. Triggers for foundation kickoff

Foundation work starts when ALL of:

- [x] Phase 2A retrospective signed off — **PR #151 done** ✅
- [ ] T6.5 Phase A complete — ~2026-05-29 per PR #150 (14 days post T6.4 GO)
- [ ] Phase 2B Tier 3 Upload prereq window opens (~July 2026 per PR #152 timeline)
- [ ] PR #156 P1 priority confirmed against other gap closure work (P2 MO templates / P3 MEMORY pruning)
- [ ] Foundation chat assigned (1-2 chats; ~1.5–3 weeks elapsed depending on parallelism)

If urgency further deflates (e.g., Phase 2B Tier 3 Upload timeline slips, or
Phase 2C decision moves Tier 3 sunset path), foundation work can defer
without blocking anything else.

---

## 10. Cross-references

| Doc | Section | Purpose |
|---|---|---|
| PR #156 (`ec4537e6d`) | §4 P1 line item | Authoritative gap definition |
| PR #154 (`45a03dee3`) | §3 helpers / §4 record-golden / §5 pytest | High-level component design (this spec elaborates week-by-week) |
| PR #153 (`2f7bd9bda`) | §3.2 migration path | When-to-adopt criteria + Java migration recommendations |
| PR #155 (`1cd384a01`) | finding | 0/50 Phase 2A endpoints need strict-byte → urgency deflated, scope unaffected |
| PR #152 (`8b88dbb9b`) | §6.3 Tier 3 strategy | Tier 3 Upload binary fidelity = primary trigger for foundation |
| PR #151 (`8912e137d`) | §4 testing infrastructure | Phase 2A baseline (22 dict-eq test files, 8 LOC conftest) |
| PR #150 (`cf8cc48e8`) | §2 phases | T6.5 timeline gates trigger §9 |
| `.claude/rules/python-java-port.md` | Rule 4 dict-eq gate | Existing dict-eq doc; new strict-byte sub-section to add Week 3 §4.5 |
| `.claude/rules/concurrent-edit-safety.md` | Rules 2, 4, 5b | Mandatory for `record-java-golden.sh` extension |
| `scripts/record-java-golden.sh` | current 89 LOC | Extension target Week 2 §3.2 |
| `tests/python/smartbi_compat/conftest.py` | current 8 LOC | Marker registration target Week 3 §4.1 |

---

## 11. ⛔ HOLD blocks

This spec is **planning only**. No code changes happen here. Specifically:

- Spec / planning doc only — NOT execute.
- DO NOT modify Phase 2A test infrastructure (helpers / scripts / conftest.py).
- DO NOT modify `record-java-golden.sh`.
- Right-sized: ~500-700 LOC.
- Cross-reference accuracy verified against origin/main current state (PR #154 / #156 / #155 / #153 / #152 / #151 / #150 all merged + read).
- Implementation kickoff requires §9 triggers + reviewer answers Q-1 through Q-7.

---

## 12. Parallel work analysis (per `parallel-work-analysis.md` rule)

### Subagent (single chat):

- ✅ Week 1 helpers + comparator drafts (independent helpers within the module).
- ✅ Week 3 documentation across multiple cross-reference files.
- ❌ Week 2 dispatcher integration tests (sequential dependency on Week 1 helpers + comparator completion).

### Multi-chat:

- ✅ Week 2 dispatcher + record-golden ext in parallel (different files, no conflict).
- ✅ Week 3 conftest + docs in parallel (different files).
- ❌ Modifying `record-java-golden.sh` (single file; concurrent-edit-safety Rule 4 mandates worktree isolation).
- ❌ Modifying `_strict_byte.py` across weeks (one file; sequential per week).

### Conflict risk:

- **Low** for Week 1 helpers (new module).
- **Medium** for Week 2 `record-java-golden.sh` (shared script) — worktree isolation mandatory.
- **Low** for Week 3 conftest/docs (additive changes to small files).

### Recommended chat assignment:

- **Sequential 1 chat**: simplest, 3 weeks calendar. Recommended for first foundation pass.
- **Parallel 2 chats**: Week 2 split (chat A: dispatcher + tests; chat B: record-golden ext + integration tests with worktree isolation). 1.5–2 weeks elapsed. Higher coordination overhead but faster ship.

---

## Status

This is a **week-by-week implementation spec**. No code changes.

**Foundation kickoff requires**:
- §9 triggers ALL true.
- §8 Q-1 through Q-7 answered by reviewer.
- 1-2 chats assigned per §12 recommended chat assignment.

Estimated kickoff: 2026-06 to 2026-07 (Phase 2A retrospective done; T6.5 Phase A nearing complete; Tier 3 prereq window). Hard deadline: pre-Phase 2B Tier 3 Upload (~2027-Q1).

When kickoff: implementer chat dispatches against this spec week-by-week, no need to re-derive context from PR #153 / #154 / #156.
