# Fixes applied in this PR

**Quick wins applied: 0.**

## Why zero

All 72 (and the broader 152 `test_*_pilot.py`) failures share a single root cause — `os.environ.setdefault("JWT_SECRET", <file-unique-string>)` + module-local `JWT_SECRET` constant decoupling — documented in `categorization.md`.

The fix template lives at `backend/python/tests/test_price_strip_kpi_pilot.py:71-77`:

```python
@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    yield
```

That's **4 lines per file** (5 with docstring), not a 1-line fixture refresh. The task brief explicitly capped quick-wins at "obvious 1-line fixture refreshes" and instructed "Don't fix 28 all at once — triage + quick wins only." Applying the autouse fixture to 8 files in this PR would expand it from triage-and-flag into a same-cause sweep, which deserves its own PR with focused review.

## What is NOT a viable 1-line fix (and why I rejected each)

| Candidate | Effect | Why rejected |
|---|---|---|
| Change `os.environ.setdefault` → `os.environ["JWT_SECRET"] = ...` in one file | That file would win the race deterministically. | Breaks every other file that hasn't been updated — and the "winning" file's tests pass only by accident of CLI order. Not a fix; a swap of which 7 files break. |
| Change `JWT_SECRET = "<file-unique>"` to `JWT_SECRET = os.environ.get("JWT_SECRET", "<fallback>")` at module load | Module-local constant tracks whichever file imported first. | Still order-dependent and silently masks the real bug if the fallback is wrong. Fragile. |
| Standardize all 17 setdefault'ing files to use one shared literal | One `replace_all` across files. | Touches 17 files, requires coordination of a shared constant location, and silently couples files. Not "1 line." |
| Delete the module-load `os.environ.setdefault` line entirely from one file | Forces that file to depend on another setting the env first. | Trades one fragile order-dependence for another. |

The canonical fix is the autouse `monkeypatch.setenv` fixture (multi-line per file). Deferred to follow-up issue.

## What this PR does deliver

- `categorization.md` — exhaustive failure inventory, root-cause analysis, 7 reproduction experiments, per-file failure list, fix template citation.
- `fix-applied.md` — this file.
- `file-issue-list.md` — one follow-up issue with paste-ready fix template + the 8-file (and optionally 14-file broader) target list.

No production code touched. No test code touched. Triage only.
