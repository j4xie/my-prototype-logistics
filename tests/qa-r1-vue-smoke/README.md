# tests/qa-r1-vue-smoke

Round 1 part 2 — SmartBI Vue page L1 smoke (chat2 deliverable).

## Files

- `pages.mjs` — 18-page registry derived from `web-admin/src/router/`
- `run-smoke.mjs` — Playwright smoke runner (chromium.launch + storageState cache)
- `round-1-vue-smoke.json` — per-page result (rendered/console/api/toast/screenshot)
- `console-matrix.json` — page × signal-type matrix
- `coverage-matrix.md` — Rule 11 breadth coverage + findings (human-readable)
- `screenshots/*.png` — one fullPage screenshot per page (18)

## Run

```bash
cd tests/qa-r1-vue-smoke
node run-smoke.mjs
# or: TARGET=http://other-host:8086 node run-smoke.mjs
```

Requires Playwright (1.58+). The worktree has `node_modules` as a junction
into `scripts/customer-audit-e2e-2026-05-13/node_modules` from the main
checkout to share the Chromium binary download.

`screenshots/` matches the root `.gitignore` pattern. The 18 PNGs in this
branch were committed with `git add -f` as one-shot evidence; future re-runs
that overwrite them will not show up in `git status` (still gitignored).
That is deliberate — re-run the script and inspect locally, do not re-commit.

## Spec / scope

- Spec: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` §5 Round 1 part 2 + §3.1 acceptance bar
- Out of scope: L2 CRUD writes, customer-facing UI (chat3 owns #423/#413/#414), RN App
- Acceptance bar: L1 = mount + no white screen + no unexplained console.error/warning + screenshot

## Headline result (2026-05-13)

18/18 pages render (mount + body). 3 follow-up tickets recommended:

1. **F1** `query-templates` 404 with visible error toast — `/smart-bi/query-templates`
2. **F2** calibration admin 404 (statistics + sessions) — `/smart-bi/calibration`
3. **F3** capability probe 503 on Dashboard + Finance — graceful fallback, but the upstream is unhealthy

See `coverage-matrix.md` for details and `round-1-vue-smoke.json` for full evidence.
