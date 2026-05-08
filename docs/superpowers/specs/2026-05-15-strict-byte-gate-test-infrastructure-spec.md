# Strict-byte Gate Test Infrastructure — Implementation Spec

**Phase**: companion to chat 3 strict-byte adoption decision spec
**Status**: Spec / planning doc only — implementation contingent on hard-trigger emerging (Phase 2B Tier 3 Upload, Phase 3+ frontend hash-compare, third-party byte contract)
**Date**: 2026-05-15
**Author**: chat 2 (test infra implementer)
**Sister docs**:
- chat 3 strict-byte adoption decision spec (in flight) — defines **when** to adopt
- `docs/superpowers/specs/2026-05-15-phase2b-port-pipeline-scoping-spec.md` (PR #152) — per-tier strict-byte hybrid recommendation
- `.claude/rules/python-java-port.md` — 12 codified Phase 2A learnings, Rule 4 dict-eq gate

---

## 0. TL;DR

Phase 2A standardized on **dict-eq** parity (numeric `0` ≡ `0.0` ≡ `0.00` tolerated). Some triggers may require strict-byte (frontend hash-compare, SSE chunk framing, upload envelope contracts, third-party integration). This doc specifies the **test infrastructure** to add when strict-byte is adopted — explicit how-to companion to chat 3's "when to adopt" decision.

**Core deliverables when triggered**:
1. New `--strict-byte` flag for `record-java-golden.sh` capturing raw HTTP bytes (NOT pretty-printed via Python parse-emit roundtrip).
2. New comparator helpers (`_decimal_preserve_scale` / `_strict_compare_response` / `assert_response_eq` with marker dispatch).
3. Pytest marker infrastructure (`@pytest.mark.strict_byte` / `@pytest.mark.dict_eq` default) registered in `conftest.py`.
4. Per-tier application matrix (Tier 1 dict-eq / Tier 2 hybrid / Tier 3 strict-byte envelope / Tier 4 dict-eq).

**Foundation effort**: ~3 weeks one-time. **Per-port adoption** (build during port): ~3-4 days extra per controller. **Retroactive Phase 2A migration**: ~8-12 weeks (50 endpoints × ~1-2 days each).

This spec is **planning only**. No implementation, no test infra changes, no `record-java-golden.sh` edits.

---

## 1. Pre-strict-byte test infra state (Phase 2A baseline)

### 1.1 Golden recording — current state

`scripts/record-java-golden.sh` (89 LOC) records Java responses with **lossy
transformation**:

```bash
curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
    | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
    > "$OUT_PATH"
```

The `json.load → json.dumps(indent=2)` roundtrip:
- **Loses** Java's exact whitespace (including pretty-print style differences).
- **Loses** Decimal scale information (Python `json.load` parses `100.00` → `float(100.0)` → re-emits as `100.0`; loses trailing zero).
- **Reorders** keys deterministically by Python dict insertion order (preserves Java `Map.of` order on Python 3.7+ since dict insert-order matches input).
- **Normalizes** number formats (e.g., `1e10` → `10000000000.0`).

**Implication**: current goldens cannot serve as strict-byte references. Strict-byte mode must capture **raw HTTP response body bytes** before any parsing.

### 1.2 Comparator pattern — current state

Phase 2A tests use one of these patterns:

```python
# Pattern 1: dict-eq with volatile stripping
def _strip_volatile(obj):
    """Recursively strip timing keys before byte compare."""
    VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj

assert _strip_volatile(actual) == _strip_volatile(expected), "byte-shape divergence"
```

```python
# Pattern 2: direct dict equality after _decimal_to_number normalization
expected = _load_golden_overview("analysis-finance-overview-F999-state-c.json")
actual = await _get_finance_overview("F999", date_range)
assert _strip_volatile(actual) == expected
```

Both patterns:
- Compare parsed Python dicts, NOT raw bytes.
- Tolerate Pattern A (`Decimal("100.00")` → `int(100)` collapse) and Pattern A2 (scale-4 trailing-zero loss) per Rule 4 official acceptance.
- Strip 4 hardcoded volatile keys (`generatedAt` / `lastUpdated` / `cacheExpireAt` / `timestamp`).

**Implication**: dict-eq comparator is well-established. Strict-byte will be an **additional** comparator, not a replacement.

### 1.3 Test framework

- pytest 9.0.2, pytest-asyncio 1.3.0
- `tests/python/smartbi_compat/conftest.py` (8 LOC) — minimal sys.path setup only, **no markers registered yet**
- ~22 test files in `tests/python/smartbi_compat/`, all using dict-eq patterns

---

## 2. Strict-byte test infra requirements

### 2.1 Golden recording requirements

**Dual-mode recording**: each endpoint can have:
- **dict-eq golden** (`<name>.json`): pretty-printed via Python parse-emit (current behavior). Used by dict-eq tests.
- **strict-byte golden** (`<name>.json.bytes`): raw HTTP body bytes preserved. Used by strict-byte tests.

Default mode stays dict-eq for backward compatibility. Strict-byte added via `--strict-byte` flag (records BOTH dict-eq + bytes) or `--strict-byte-only` flag (records only bytes).

### 2.2 Comparator requirements

Add 3 new helper functions:

| Helper | Purpose | LOC est. |
|---|---|:---:|
| `_decimal_preserve_scale(v)` | Convert `Decimal` to JSON string preserving Java `BigDecimal` scale (`Decimal("100.00")` → `"100.00"` NOT `100`) | ~30 |
| `_strict_compare_response(actual_bytes, expected_bytes)` | Char-by-char compare with rich `StrictDiff` failure report | ~60 |
| `assert_response_eq(actual, expected, mode=None)` | Auto-dispatch to dict-eq or strict-byte based on pytest marker | ~30 |

Total: ~120 LOC helpers + ~50 LOC tests for the helpers themselves.

### 2.3 Pytest marker requirements

Register markers in `conftest.py`:

```python
# tests/python/smartbi_compat/conftest.py — addition
def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "strict_byte: test compares raw response bytes (strict gate). "
        "Requires .json.bytes golden file."
    )
    config.addinivalue_line(
        "markers",
        "dict_eq: test compares parsed dict equality (default Phase 2A gate). "
        "Tolerates Pattern A/A2 numeric collapse."
    )
```

Default marker: `dict_eq` (when neither marker specified). Tests can opt-in to
`strict_byte` per-endpoint.

### 2.4 Failure mode requirements

Strict-byte failure must report:
- Total byte count (expected vs actual).
- First N=100 bytes of divergence with byte offsets.
- Hex dump of the divergent region (16 bytes per line).
- Decoded UTF-8 around the divergence (with `replace` errors mode).
- Expected vs actual character at first diff position.

Example output:

```
StrictByteDiff at offset 1247:
  Expected: 100.00, "currency": "CNY"
  Actual:   100,    "currency": "CNY"
                ^ first divergence byte 1247
  Total expected: 4583 bytes
  Total actual:   4576 bytes (-7 bytes)

Hex dump @ offset 1240-1280:
  Expected: 31 30 30 2e 30 30 2c 20 22 63 75 72 72 65  100.00, "curre
            6e 63 79 22 3a 20 22 43 4e 59 22           ncy": "CNY"
  Actual:   31 30 30 2c 20 22 63 75 72 72 65 6e 63 79  100, "currency
            22 3a 20 22 43 4e 59 22                    ": "CNY"
```

This level of detail is necessary because byte divergence in deep responses is otherwise extremely hard to localize.

---

## 3. Helper functions needed

### 3.1 `_decimal_preserve_scale`

```python
def _decimal_preserve_scale(v: Decimal) -> str:
    """Convert Decimal to JSON-safe string preserving Java BigDecimal scale.

    Mirrors Java BigDecimal.toPlainString() (NOT toString()).
    Used in strict-byte mode where Java emits scale-preserved numerics:
      Java BigDecimal("100.00") → JSON "100.00" (6 chars)
      Java BigDecimal("0.00")   → JSON "0.00"   (4 chars)
      Java BigDecimal("99.9900") → JSON "99.9900" (7 chars)

    Compare to Phase 2A `_decimal_to_number(v)` which collapses to int/float.

    Output is a string so caller wraps it appropriately:
      response_dict["value"] = _decimal_preserve_scale(amount)  # if dict-build path
      OR
      bypass dict assembly entirely and emit raw bytes via custom JSONResponse.

    Note: returning a string means `json.dumps` will quote it — for true byte
    parity, the response must be assembled at the bytes layer, NOT the dict
    layer. See §3.2 for the bytes-level pipeline.
    """
    if v is None:
        return "null"
    return v.to_eng_string()  # preserves scale (vs `str(v)` which can use scientific notation)
```

Coexistence with Phase 2A `_decimal_to_number`:
- `_decimal_to_number` continues serving dict-eq endpoints (Phase 2A 50 + Phase 2B Tier 1 / Tier 4).
- `_decimal_preserve_scale` only used by strict-byte endpoints (Tier 2 SSE / Tier 3 envelope / future Phase 3+ universal).

### 3.2 `_strict_compare_response`

```python
@dataclass(frozen=True)
class StrictDiff:
    matched: bool
    first_diff_offset: int | None  # None if matched
    expected_chunk: bytes          # 100 bytes around diff
    actual_chunk: bytes
    expected_total_len: int
    actual_total_len: int

    def format_report(self) -> str:
        """Format multi-line failure report with hex dump + UTF-8 decode."""
        ...

def _strict_compare_response(
    actual: bytes,
    expected: bytes,
    *,
    volatile_byte_patterns: list[bytes] | None = None,
) -> StrictDiff:
    """Char-by-char compare; optionally mask volatile byte patterns first.

    volatile_byte_patterns lets caller substitute volatile timestamps (e.g.,
    `lastUpdated` ISO-8601 strings) with a fixed placeholder before compare.
    Default: no masking (callers handle volatile via test setup, e.g. mock
    LocalDateTime.now() to a fixed value).
    """
    if volatile_byte_patterns:
        for pattern in volatile_byte_patterns:
            actual = re.sub(pattern, b"<MASKED>", actual)
            expected = re.sub(pattern, b"<MASKED>", expected)

    if len(actual) != len(expected):
        # Find first diff offset
        for i, (a, e) in enumerate(zip(actual, expected)):
            if a != e:
                return StrictDiff(
                    matched=False, first_diff_offset=i,
                    expected_chunk=expected[max(0, i-50):i+50],
                    actual_chunk=actual[max(0, i-50):i+50],
                    expected_total_len=len(expected),
                    actual_total_len=len(actual),
                )
        # Lengths differ but prefix matched — divergence at shorter end
        diff_offset = min(len(actual), len(expected))
        return StrictDiff(
            matched=False, first_diff_offset=diff_offset,
            expected_chunk=expected[max(0, diff_offset-50):diff_offset+50],
            actual_chunk=actual[max(0, diff_offset-50):diff_offset+50],
            expected_total_len=len(expected),
            actual_total_len=len(actual),
        )

    if actual == expected:
        return StrictDiff(
            matched=True, first_diff_offset=None,
            expected_chunk=b"", actual_chunk=b"",
            expected_total_len=len(expected), actual_total_len=len(actual),
        )

    # Same length, content differs — find first diff byte
    for i, (a, e) in enumerate(zip(actual, expected)):
        if a != e:
            return StrictDiff(
                matched=False, first_diff_offset=i,
                expected_chunk=expected[max(0, i-50):i+50],
                actual_chunk=actual[max(0, i-50):i+50],
                expected_total_len=len(expected),
                actual_total_len=len(actual),
            )

    raise RuntimeError("unreachable: lengths equal, content equal, but != ?")
```

### 3.3 `assert_response_eq` (marker-aware dispatcher)

```python
def assert_response_eq(
    actual,
    expected,
    *,
    mode: str | None = None,  # "strict_byte" or "dict_eq"; None = auto-detect from marker
    volatile_keys: frozenset[str] = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"}),
    volatile_byte_patterns: list[bytes] | None = None,
):
    """Marker-aware response comparator.

    - `mode="dict_eq"` or unset+`@pytest.mark.dict_eq` (default):
      Both args are parsed dicts/lists. Strip volatile keys recursively, then
      compare via Python dict equality.
    - `mode="strict_byte"` or `@pytest.mark.strict_byte`:
      Both args are raw bytes. Optionally mask volatile byte patterns, then
      char-by-char compare. On diff, raise AssertionError with rich report.

    Auto-detect: inspect current pytest item's markers (via pytest hooks).
    """
    if mode is None:
        # Auto-detect from current pytest item (requires fixture access)
        mode = _detect_mode_from_marker()

    if mode == "strict_byte":
        if not isinstance(actual, bytes) or not isinstance(expected, bytes):
            raise TypeError(
                f"strict_byte mode requires bytes args, got {type(actual)} / {type(expected)}"
            )
        diff = _strict_compare_response(actual, expected,
                                          volatile_byte_patterns=volatile_byte_patterns)
        if not diff.matched:
            raise AssertionError(diff.format_report())
        return

    # dict_eq (default)
    actual_stripped = _strip_volatile_with_keys(actual, volatile_keys)
    expected_stripped = _strip_volatile_with_keys(expected, volatile_keys)
    assert actual_stripped == expected_stripped, (
        f"dict-eq divergence (volatile keys stripped: {sorted(volatile_keys)})"
    )
```

Total helper LOC: ~120 LOC + ~50 LOC tests = ~170 LOC.

---

## 4. `record-java-golden.sh` extensions

### 4.1 New `--strict-byte` / `--strict-byte-only` flags

```bash
# Current (dict-eq only — pretty-printed JSON):
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/...' \
    analysis-finance-F999.json

# New: dict-eq + strict-byte (records BOTH):
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/...' \
    analysis-finance-F999.json --strict-byte

# Output:
#   tests/fixtures/java-smartbi-golden/analysis-finance-F999.json        (existing)
#   tests/fixtures/java-smartbi-golden/analysis-finance-F999.json.bytes  (NEW)

# Strict-byte ONLY (skip dict-eq pretty-print):
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/...' \
    analysis-finance-F999.json --strict-byte-only
```

Implementation sketch (additions to existing script):

```bash
# Capture raw response to temp file
RAW_TMP=$(mktemp)
curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" --output "$RAW_TMP"

# Pretty-print to .json (if not --strict-byte-only)
if [[ "$STRICT_MODE" != "strict-byte-only" ]]; then
    python3 -c "import json, sys; print(json.dumps(json.load(open('$RAW_TMP'), encoding='utf-8'), indent=2, ensure_ascii=False))" \
        > "$OUT_PATH"
fi

# Copy raw bytes to .json.bytes (if --strict-byte or --strict-byte-only)
if [[ "$STRICT_MODE" == "strict-byte" || "$STRICT_MODE" == "strict-byte-only" ]]; then
    cp "$RAW_TMP" "$OUT_PATH.bytes"
fi

rm "$RAW_TMP"
```

### 4.2 Naming convention

- `<name>.json` — dict-eq golden (Phase 2A default; pretty-printed).
- `<name>.json.bytes` — strict-byte golden (raw HTTP response body).
- `<name>.sse.bytes` — SSE stream golden (concatenated chunks, separator-preserved).

Co-locate in same `tests/fixtures/java-smartbi-golden/` dir; `.json.bytes` extension makes git-grep easy and signals "binary-stable byte file".

---

## 5. Pytest infrastructure changes

### 5.1 `conftest.py` additions

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
    """Auto-detect mode from test markers."""
    if request.node.get_closest_marker("strict_byte"):
        return "strict_byte"
    return "dict_eq"  # default
```

### 5.2 Per-test usage

```python
@pytest.mark.strict_byte
async def test_upload_envelope_byte_stable():
    """Tier 3 Upload: confirm uploadId/confirmToken envelope byte-stable."""
    actual_bytes = await _post_upload_request_raw(factory_id="F001", file=b"...")
    with open("tests/fixtures/java-smartbi-golden/upload-F001-envelope.json.bytes", "rb") as f:
        expected_bytes = f.read()
    assert_response_eq(actual_bytes, expected_bytes)  # mode auto from marker
```

```python
@pytest.mark.dict_eq  # explicit; or omit (default)
async def test_finance_overview_dict_eq():
    """Tier 1 / Phase 2A: dict-eq tolerance."""
    actual = await _get_finance_overview("F999", date_range)
    expected = _load_golden_overview("analysis-finance-overview-F999-state-c.json")
    assert_response_eq(actual, expected)  # dict-eq dispatched
```

### 5.3 CI gate per marker

```yaml
# .github/workflows/test.yml addition
- name: Run dict-eq tests (Phase 2A baseline)
  run: pytest -m "dict_eq or not strict_byte" --tb=short
- name: Run strict-byte tests (selective, fail-fast)
  run: pytest -m "strict_byte" --tb=long --maxfail=1
```

Strict-byte runs separately to surface the rich failure report and fail fast on first divergence (one byte off can cascade — see first diff is enough info to fix).

---

## 6. Per-tier (Phase 2B) test infra application

Cross-references Phase 2B scoping spec PR #152 §5 strict-byte hybrid recommendation:

| Tier | Strict-byte tests needed? | Infra changes per tier |
|---|:-:|---|
| Tier 1 — Config (41) | **No** | Use existing dict-eq comparator. No new helpers. |
| Tier 2 — Dashboard (11) | **Yes for SSE chunks** (1 endpoint: `/dashboard/executive/insights/custom/stream`) | New `record-java-golden.sh --sse` mode (records concatenated chunks). New `_strict_compare_sse_stream` helper. |
| Tier 3 — Upload (13) | **Yes for envelope** (`uploadId` / `confirmToken` byte-stable contract) | New strict-byte comparator (§3.2). New goldens for two-phase upload flow. |
| Tier 4 — PublicDemo (10, sunset recommend) | **No** if sunset; dict-eq if ported | If ported, reuse Tier 1 patterns. |

Per-tier rough effort estimate:

| Tier | Test infra effort | Source code adoption effort |
|---|---|---|
| Tier 1 | 0 (reuse existing) | 0 (no new helpers needed) |
| Tier 2 | ~1 week (SSE recorder + comparator) | ~3 days (1 endpoint flag + helper integration) |
| Tier 3 | ~2 weeks (strict-byte + Excel parser parity audit) | ~1 week per controller batch (envelope helpers + goldens) |
| Tier 4 | 0 if sunset / Tier 1-equivalent if ported | 0 / Tier 1-equivalent |

---

## 7. Migration path (if Phase 2A retroactive adoption triggered)

If frontend hash-compare or third-party byte contract emerges as a Phase 3+
trigger and Phase 2A endpoints need retroactive strict-byte:

### Step 1 — Foundation (one-time, no behavior change)

- Add `_decimal_preserve_scale` / `_strict_compare_response` / `assert_response_eq` helpers (§3).
- Add pytest markers in `conftest.py` (§5.1).
- Extend `record-java-golden.sh` with `--strict-byte` flag (§4).
- Document in `python-java-port.md` (Rule 4 already mentions strict-byte; add explicit "when strict-byte adopted, use these helpers" section).

Effort: ~1 week (1 chat). No production code changes.

### Step 2 — Per-endpoint annotation (gradual)

For each endpoint to upgrade:
- Add `@pytest.mark.strict_byte` to existing test.
- Record `.json.bytes` golden via `record-java-golden.sh --strict-byte`.
- Run test → likely fails on Pattern A / A2 / Map.of order / Lombok null differences.

Effort: ~30 min per endpoint × 50 = ~25 hours over multiple weeks.

### Step 3 — Per-endpoint divergence resolution

For each strict-byte failure, decide:
- **Fix Python**: replace `_decimal_to_number` with `_decimal_preserve_scale` at this site.
- **Fix Java**: change Java DTO annotations (`@JsonInclude(NON_NULL)` / `@JsonPropertyOrder`) — requires Java side rework, may not be feasible.
- **Document accepted divergence**: keep as dict-eq (downgrade marker).

Effort: ~1-2 days per endpoint × 50 = ~8-12 weeks total. Highest risk: some Phase 2A endpoints may have structural divergences (Pattern B residues) that strict-byte exposes; those require source rewrite.

### Step 4 — Golden re-recording for new ports

Going forward, all new Phase 2B/2C/3+ endpoints record both modes.
`record-java-golden.sh --strict-byte` becomes default for new endpoints.

---

## 8. Effort estimate

Mirroring chat 3 strict-byte adoption decision spec §5 effort numbers (when chat 3 spec ships, cross-reference exact figures here):

### 8.1 Foundation (one-time)

| Item | LOC | Effort |
|---|---:|---|
| `_decimal_preserve_scale` helper + tests | ~80 | 0.5 week |
| `_strict_compare_response` + `StrictDiff` + tests | ~150 | 1 week |
| `assert_response_eq` marker-aware dispatcher | ~80 | 0.5 week |
| `conftest.py` marker registration | ~30 | 0.25 week |
| `record-java-golden.sh --strict-byte` extension | ~50 | 0.5 week |
| Documentation update (`python-java-port.md` + new spec) | ~200 | 0.25 week |
| **Foundation total** | **~590 LOC** | **~3 weeks one-time** |

### 8.2 Per-port adoption (during port)

For each new controller/sub-domain ported under strict-byte:
- Record strict-byte goldens: ~30 min per endpoint.
- Add `@pytest.mark.strict_byte` annotations: ~10 min per test.
- Resolve initial byte divergences: ~1-2 hours per endpoint typical, more if Java-side changes needed.

Per-controller batch: ~3-4 days extra vs dict-eq-only port.

### 8.3 Retroactive Phase 2A migration

Per §7: ~8-12 weeks total for 50 endpoints.

| Phase | Endpoints | Effort estimate |
|---|---:|---|
| Foundation | — | 3 weeks |
| Phase 2A retroactive (50 endpoints) | 50 | 8-12 weeks |
| **If full retroactive triggered** | | **11-15 weeks total** |

---

## 9. Out of scope (this spec)

| Item | Why out of scope | Owner |
|---|---|---|
| Java-side annotation changes (`@JsonInclude(NON_NULL)`, `@JsonPropertyOrder`, custom `BigDecimal` serializers) | Java alignment is chat 3's adoption decision spec scope (when to adopt + Java migration recommendations) | chat 3 |
| Frontend test infrastructure (frontend hash-compare adoption requires separate Vue/RN test rig) | Frontend separate effort, owned by mobile/web team | TBD |
| Performance benchmarks (strict-byte comparator may be measurably slower than dict-eq) | Separate workstream; benchmark when foundation lands and run perf-regression tests | TBD post-foundation |
| Embedding service (gRPC) byte parity | Not byte-shape JSON parity scope | Out of scope indefinitely |
| AI Tool/Skill architecture (Java-side stays per Phase 2A scope) | Out of scope per Phase 2A decision | Out of scope indefinitely |
| Database migration scripts (smartbi_migrations runner already enforces tracker — orthogonal) | Tooling overlap zero — migration runner + strict-byte are independent layers | n/a |

---

## 10. Triggers for infra implementation

This spec stays planning-only until ANY of:

| Trigger | Likelihood | Phase |
|---|:-:|---|
| Phase 2B Tier 3 Upload kickoff (binary fidelity requirement for `uploadId`/`confirmToken`) | HIGH (~2027-Q1) | Phase 2B |
| Phase 3+ first hard-trigger (frontend HMAC/cache-key hash, third-party byte contract, audit log integrity, cryptographic signature on response) | LOW-MEDIUM (no current request) | Phase 3+ |
| Retroactive Phase 2A demand emerges (operator/business reports byte divergence breaking unforeseen consumer) | LOW (Phase 2A 99.945% match has been stable) | Reactive |
| Phase 2B Tier 2 SSE chunk timing regression (Dashboard cutover surfaces frontend SSE consumer break) | MEDIUM (~2026-Q4) | Phase 2B Tier 2 |

If trigger fires, implementer (chat 2 or successor) opens implementation PR
chain referencing this spec as the authoritative how-to.

---

## 11. Decision points / open questions

These need explicit answers BEFORE implementation kickoff (when triggered):

### Q-1 — Pluggable comparator design

Single `assert_response_eq` with marker dispatch (recommended in §3.3) vs separate `assert_dict_eq` / `assert_strict_byte` exports? Single dispatcher reduces test boilerplate; separate functions are more explicit. Reviewer choice.

### Q-2 — Golden file naming convention

`<name>.json.bytes` (recommended) vs `<name>.json.strict` vs `<name>.bytes.json`? `.json.bytes` makes the binary-stable nature explicit; co-locating in same dir keeps grep workflows uniform.

### Q-3 — CI failure UX

Is the rich `StrictDiff.format_report()` (hex dump + UTF-8 decode + offset) sufficient, or do we need a separate byte-diff visualization tool (HTML side-by-side, similar to JSON diff viewer)? For Phase 2B Tier 3 binary upload diffs, hex dump may not be enough.

### Q-4 — Resource allocation for foundation

Foundation = 3 weeks. 1 chat sequential = 3 weeks elapsed. 2 chats parallel (strict-byte helpers vs golden recording extension are independent) = ~1.5-2 weeks elapsed. Reviewer confirms parallelism.

### Q-5 — Volatile byte pattern catalog

§3.2 `_strict_compare_response` accepts `volatile_byte_patterns: list[bytes]`. Need a Phase 2A-equivalent catalog of common volatile patterns (LocalDateTime ISO format, request UUID, cache timestamps). Should the catalog live in `python-java-port.md` (alongside existing volatile keys) or in `_strict_compare_response` as a default arg?

### Q-6 — Performance regression budget

Strict-byte comparator allocates byte slices for each diff lookup. For very large responses (Tier 2 streaming KPIs, Tier 3 50MB upload responses), runtime may matter. Acceptable budget: ≤10× dict-eq comparator runtime? Or no budget — strict-byte tests run only in dedicated CI lane?

### Q-7 — Backward compat for existing 22 dict-eq test files

When markers added, do existing tests need explicit `@pytest.mark.dict_eq` annotation? Or default (no marker) → dict_eq is sufficient? Recommended: default to dict_eq, NO retroactive annotation needed (zero churn for Phase 2A test suite).

---

## 12. Cross-references

- **chat 3 strict-byte adoption decision spec** (in flight, not yet shipped) — defines **when** to adopt strict-byte. This doc is the **how** companion.
- **Phase 2B scoping spec** PR #152 (`8b88dbb9b`) §5 strict-byte hybrid recommendation — this spec implements §5's per-tier infrastructure.
- **Phase 2A retrospective** PR #151 (`8912e137d`) — baseline test infra context.
- **`.claude/rules/python-java-port.md` Rule 4** — official dict-eq gate doc; should add cross-reference to this spec when foundation lands.
- **`scripts/record-java-golden.sh`** — current 89-LOC golden recorder; this spec's §4 plans the extension.
- **`tests/python/smartbi_compat/conftest.py`** — current 8-LOC sys.path setup; this spec's §5.1 plans marker registration.
- **`tests/fixtures/java-smartbi-golden/`** — current ~50 dict-eq goldens; strict-byte will add `.json.bytes` siblings as needed.

---

## 13. Parallel work analysis (per `parallel-work-analysis.md` rule)

### Subagent (single chat):
- ✅ Helper function drafts (3 helpers independent — `_decimal_preserve_scale` / `_strict_compare_response` / `assert_response_eq`).
- ✅ Documentation update across multiple cross-reference files.
- ❌ Cross-helper integration tests (sequential dependency on helper completion).

### Multi-chat:
- ✅ Foundation (helpers) + golden recording extension in parallel — different files, no conflict.
- ✅ Per-tier adoption work in parallel (Tier 2 SSE infra vs Tier 3 envelope helpers).
- ❌ Modifying `conftest.py` (single file, must sequence).

### Conflict risk:
- **Low** for spec/helper drafting (different files).
- **Medium** for `conftest.py` + `python-java-port.md` updates (shared files; per Rule 4 of `concurrent-edit-safety.md`, status-check before edit).
- **HIGH** for `record-java-golden.sh` extension (shared script — per Rule 4: status-check before any edit; consider git worktree isolation if 2+ chats need to modify simultaneously).

---

## Status

This is a **scoping doc**. No code changes. No test infra modifications.

**Implementation kickoff requires**:
- Hard trigger fires per §10 (Tier 3 upload, Phase 3+ frontend hash, third-party byte contract, retroactive Phase 2A demand).
- chat 3 adoption decision spec shipped (cross-reference exact decision criteria).
- Q-1 through Q-7 answered.
- Foundation chat assigned (1-2 chats; ~1.5-3 weeks elapsed).
