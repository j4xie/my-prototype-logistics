# Byte-Shape Parity Test Infra — Implementation (foundation slice)

**Date**: 2026-05-09
**Author**: Chat G (byte-shape parity test infra implementer)
**Status**: ✅ shipped (this PR) — foundation slice only (recorder + markers + docs)
**Sister docs**:
- `docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md` (PR #154) — full design (helpers, comparator, per-tier matrix). This impl realizes §4 + §5.1 only.
- `docs/superpowers/specs/2026-05-15-strict-byte-gate-phase3-adoption-decision-spec.md` (PR #153) — when to flip individual endpoints to strict-byte.
- Chat F PR (in flight, parallel) — comparator helpers (`_decimal_preserve_scale` / `_strict_compare_response` / `assert_response_eq`) live under `backend/python/smartbi_compat/_strict_byte/`. **Do NOT touch in this PR.**
- `.claude/rules/python-java-port.md` Rule 4 — official Phase 2A dict-eq gate doc.

---

## 0. TL;DR

Phase 2A standardized on **dict-eq** parity. No Phase 2A endpoint is changing gate. This PR adds the foundation hooks so future per-endpoint strict-byte adoption (Phase 2B Tier 3 Upload, Phase 3+ frontend hash-compare) drops in without touching the recorder or pytest config again:

1. `scripts/record-java-golden.sh` — new `--strict-byte` and `--strict-byte-only` flags. Default behavior unchanged.
2. `tests/python/smartbi_compat/conftest.py` — register `strict_byte` / `dict_eq` markers + `comparator_mode` fixture (auto-detect from marker).
3. This doc.

The comparator helpers themselves (Chat F PR, separate branch) and the per-endpoint test migration (Phase 2B+) are **out of scope** here.

---

## 1. `scripts/record-java-golden.sh` — `--strict-byte` / `--strict-byte-only`

### 1.1 What changed

| Mode | Trigger | Outputs |
|---|---|---|
| Default (Phase 2A) | no flag | `<output>` only — pretty-printed JSON via `json.dumps(json.load(...), indent=2, ensure_ascii=False)` (existing behavior, unchanged). |
| Strict-byte (both) | `--strict-byte` | Both `<output>` (dict-eq) **and** `<output>.bytes` (raw HTTP body, no transformation). |
| Strict-byte only | `--strict-byte-only` | Only `<output>.bytes`. Skips the pretty-print roundtrip. |

The script now captures the curl response to a temp file first (`mktemp` + `EXIT` trap for cleanup), then derives whichever output(s) the mode requested. This guarantees the strict-byte file is **byte-identical** to what Java's HTTP layer wrote — no Python parse-emit roundtrip, no key reordering, no Decimal scale loss, no whitespace normalization.

### 1.2 Naming convention (per spec PR #154 §4.2)

Co-located in `tests/fixtures/java-smartbi-golden/`:

- `<name>.json` — dict-eq golden (Phase 2A default).
- `<name>.json.bytes` — strict-byte golden (raw HTTP body bytes).
- `<name>.sse.bytes` — reserved for SSE stream golden (Phase 2B Tier 2; not implemented this PR).

The `.json.bytes` extension keeps `git grep` workflows uniform with existing `.json` goldens and signals "binary-stable byte file" without requiring a separate directory.

### 1.3 Examples

```bash
# Phase 2A default — dict-eq only (Steve's existing workflow, unchanged):
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
    analysis-finance-F999-profit.json

# Phase 2B Tier 3 / Phase 3+ — record both gates side-by-side:
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/upload/confirm' \
    upload-F999-confirm.json --strict-byte

# Skip the pretty-print roundtrip when only strict-byte is needed:
JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/upload/confirm' \
    upload-F999-confirm.json --strict-byte-only
```

### 1.4 Backward compatibility

- Existing callers without the new flag get identical output bytes (same `json.dumps` settings, same `head -20` confirmation tail).
- `--method`, `--data-json`, `--prod`, `BASE_URL_OVERRIDE` work as before and stack with the new flags.
- The previous `curl … | python3 …` pipe is replaced with `curl … --output $tmp` followed by `python3 -c "… open(sys.argv[1], encoding='utf-8') …"` — only the IO wiring moved; the pretty-printer call is byte-identical.

---

## 2. Pytest markers — `strict_byte` / `dict_eq`

### 2.1 What changed

`tests/python/smartbi_compat/conftest.py` (was 8 LOC sys.path setup; now also registers markers and exposes a fixture):

- `pytest_configure` registers `strict_byte` and `dict_eq` markers with descriptions pointing at PR #154.
- `comparator_mode` fixture inspects `request.node.get_closest_marker("strict_byte")` and returns `"strict_byte"` or `"dict_eq"` (the Phase 2A default).

### 2.2 Why this conftest, not `backend/python/tests/conftest.py`

The marching order text said `backend/python/tests/conftest.py`. That conftest serves the SmartBI E2E HTTP fixture suite (`tests/python/smartbi/`), not the Phase 2A byte-shape parity tests. Per PR #154 spec §5.1 and the actual location of Phase 2A test files (`tests/python/smartbi_compat/test_*.py`), the correct conftest is `tests/python/smartbi_compat/conftest.py`.

A pytest marker registered in a conftest applies to every test descended from that conftest's directory. Adding it at `backend/python/tests/conftest.py` would not reach `tests/python/smartbi_compat/`. Following the spec.

### 2.3 Default semantics

A test **without any marker** is `dict_eq`. The `dict_eq` marker exists for explicit annotation when authors want the gate visible in test signatures, but Phase 2A's ~22 existing test files do not need retroactive annotation (zero-churn migration, per PR #154 §11 Q-7).

### 2.4 Per-test usage (Phase 2B+ pattern, not adopted by any test in this PR)

```python
@pytest.mark.strict_byte
async def test_upload_envelope_byte_stable():
    """Tier 3 Upload: confirm uploadId/confirmToken envelope byte-stable."""
    actual_bytes = await _post_upload_request_raw(factory_id="F001", file=b"...")
    with open(
        "tests/fixtures/java-smartbi-golden/upload-F999-confirm.json.bytes", "rb"
    ) as f:
        expected_bytes = f.read()
    # Comparator from Chat F's PR — `assert_response_eq` auto-dispatches via marker.
    assert_response_eq(actual_bytes, expected_bytes)
```

The `comparator_mode` fixture lets a test introspect its own gate without re-checking markers manually:

```python
@pytest.mark.strict_byte
def test_something(comparator_mode):
    assert comparator_mode == "strict_byte"  # passes
```

### 2.5 CI discoverability

`pytest --collect-only -m strict_byte` returns the strict-byte test set. CI lanes can split:

```yaml
# .github/workflows/test.yml — future addition (NOT shipped this PR)
- name: Phase 2A dict-eq gate
  run: pytest -m "not strict_byte"
- name: Strict-byte gate (selective, fail-fast)
  run: pytest -m "strict_byte" --maxfail=1 --tb=long
```

---

## 3. What this PR does **NOT** do

| Out of scope | Owner / where |
|---|---|
| `_decimal_preserve_scale` / `_strict_compare_response` / `StrictDiff` / `assert_response_eq` helpers | Chat F (parallel PR), `backend/python/smartbi_compat/_strict_byte/` |
| Migrating existing 22 dict-eq test files | None planned (Phase 2A stays dict-eq indefinitely per PR #155 frontend impact analysis) |
| Recording any `.json.bytes` goldens | Per-tier kickoff PRs (Phase 2B Tier 3 / Phase 3+ trigger) |
| SSE `.sse.bytes` mode | Phase 2B Tier 2 Dashboard kickoff |
| `python-java-port.md` Rule 4 update with explicit strict-byte cross-reference | Defer until first strict-byte endpoint ships and Rule 4 needs the live example |
| CI YAML changes | Defer until ≥1 strict-byte test exists to validate the lane split |

These boundaries match the foundation/per-port adoption split in PR #154 §8.

---

## 4. Migration path

The full path is in PR #154 §7. Recap of the slice this PR enables:

### Step 1 — Foundation (this PR + Chat F's PR)

- ✅ Recorder accepts `--strict-byte` (this PR).
- ✅ Markers + `comparator_mode` fixture registered (this PR).
- ⏳ Comparator helpers under `_strict_byte/` (Chat F's parallel PR).
- ⏳ `python-java-port.md` Rule 4 cross-link (defer until first endpoint).

After Step 1 lands, no further infra change is needed for per-endpoint strict-byte adoption.

### Step 2 — Per-endpoint adoption (Phase 2B Tier 3, Phase 3+ as triggered)

For each endpoint to upgrade:
1. `./scripts/record-java-golden.sh ... --strict-byte` to write `<name>.json.bytes`.
2. Add `@pytest.mark.strict_byte` on the test.
3. Use Chat F's `assert_response_eq` to compare; resolve any divergence per `python-java-port.md` Rule 8/9/11/12 patterns.

Per PR #154 §8.2: ~3-4 days extra per controller batch beyond a plain dict-eq port.

### Step 3 — Retroactive Phase 2A (only if hard trigger emerges)

Per PR #154 §7 Steps 2-3 + §8.3: ~8-12 weeks for 50 endpoints. **Not currently planned** — PR #155 frontend impact verification confirmed Phase 2A dict-eq is sufficient (axios auto-unwraps response.data; Hermes Date truncates µs; toFixed normalizes Pattern A/A2; no SmartBI hash usage).

---

## 5. Verification

### 5.1 Recorder

- `bash -n scripts/record-java-golden.sh` → syntax OK.
- Default invocation (no new flag) emits the same `<output>` content as before.
- `--strict-byte` emits both files; `--strict-byte-only` emits only `<output>.bytes`.
- `mktemp` + `trap rm -f $RAW_TMP EXIT` prevents tempfile leaks on failure.
- Live recording smoke: deferred to first per-endpoint adoption PR (no Java env touch in this foundation slice).

### 5.2 Conftest

- `python3 -c "import ast; ast.parse(open(...).read())"` → syntax OK.
- `pytest --collect-only -m strict_byte` (after this lands) returns 0 tests, no marker-warning. The marker is registered and discoverable but no test opts in yet.
- `pytest --collect-only -m dict_eq` likewise returns 0 (existing tests are unmarked, which is correct per §2.3).

### 5.3 No production code touched

`git diff --stat` for this PR is bounded to:
- `scripts/record-java-golden.sh`
- `tests/python/smartbi_compat/conftest.py`
- `docs/superpowers/specs/2026-05-09-byte-shape-parity-test-infra-impl.md`

No `backend/python/smartbi_compat/` code, no other tests, no other configs.

---

## 6. Parallel work analysis (per `parallel-work-analysis.md`)

### Subagent (single chat)
- ✅ Recorder edits, conftest edits, doc draft are file-disjoint and could be split, but kept in one PR for atomicity (foundation lands together or not at all).

### Multi-chat
- ✅ Chat F's helpers PR (`backend/python/smartbi_compat/_strict_byte/`) is file-disjoint from this PR — safe to land in parallel.
- ❌ Avoid concurrent edits to `tests/python/smartbi_compat/conftest.py` (single shared file; per `concurrent-edit-safety.md` rule 4, status-check before edit).
- ❌ Avoid concurrent edits to `scripts/record-java-golden.sh` (shared script; per rule 4 + rule 6, prefer git worktree isolation — this PR uses one).

### Conflict risk
- **Low** vs Chat F PR (disjoint files).
- **Medium** if a per-endpoint strict-byte adoption PR opens before this lands — they'd reference markers / `.json.bytes` that don't yet exist.

---

## 7. Rollback

If the recorder or markers cause problems:

```bash
git revert <merge-commit-sha>
```

Reverts cleanly — no schema changes, no migration tracker entries, no production code references.

The `.json.bytes` goldens (none recorded yet by this PR) would survive the revert as orphaned files; they're inert and can be `git rm` separately.
