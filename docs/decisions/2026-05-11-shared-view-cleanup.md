# SharedView.vue cleanup — Phase 2C Tier 4 sunset tail item

**Date**: 2026-05-11
**Decision**: Delete (Option B per audit doc §5.2)
**Predecessor**: PR #222 (`06c2aa1691`) — `SmartBIPublicDemoController` Java backend sunset (2026-05-09)
**Audit reference**: `docs/qa-audits/2026-05-09-phase-2c-tier-4-sunset-decision.md` §3.1 + §5.2 + §7 Phase 2

---

## 0. TL;DR

`web-admin/src/views/smart-bi/SharedView.vue` was a broken caller targeting `GET /api/public/smart-bi/share/{token}` — an endpoint that **never existed in any current Java controller** (live probe 2026-05-09 returned 404 per audit §4.4). The Tier 4 audit flagged it as a "pre-existing broken caller, separate ticket" when shipping the backend sunset on May 9. This PR closes that ticket.

**Decision rationale (audit §5.2)**: chose **Option B (delete the Vue component + router entry)** over Option A (implement the `/share/` endpoint). No documented business requirement for share-token export; 0 customers using it (the audit doc verified 0 nginx hits from external IPs over 5 months Dec 27 2025 → May 9 2026); 8 historical hits were all from a single dev IP on a single QA day per audit §4.3.

---

## 1. Scope

| File | Action | Lines |
|---|---|---:|
| `web-admin/src/views/smart-bi/SharedView.vue` | **DELETE** | -[full file] |
| `web-admin/src/router/index.ts` | Remove route entry (lines 35-40 on origin/main) | -6 |
| `docs/decisions/2026-05-11-shared-view-cleanup.md` | **NEW** (this doc) | +[this file] |

No other files touched. Verified via Subagent A read-only refs grep (2026-05-11):

- 0 references to `SharedView` or `SmartBISharedView` outside the router entry
- 0 menu/sidebar entries (route had `requiresAuth: false`, never appeared in authenticated nav)
- 0 test files reference SharedView
- 0 Java `@GetMapping("/share/")` or `/api/public/smart-bi/share` impls (confirmed deleted via PR #222)
- Last commit touching the file: `06c2aa1691` (May 9 Tier 4 sunset, which intentionally left this for follow-up)

---

## 2. Pre-merge verification

| Check | Result |
|---|---|
| `npm run build` (vite bundler resolves all imports + chunks) | ✅ built in 39.25s, no errors |
| `npm run build:check` (vue-tsc baseline) | 21 pre-existing errors, **0 new errors** referencing SharedView/SmartBISharedView. Matches `79542526c6 chore(vue-tsc): Tier 3 scattered cleanup — 417 → 21 errors` ceiling. |
| `git status` post-edit | 1 modified file (router/index.ts), 1 deleted file (SharedView.vue), nothing else |

The vue-tsc 21-error baseline is pre-existing tech debt unrelated to this PR (see chunks in PR #285 follow-up history). Closing the broken caller does not change that baseline.

---

## 3. Rollback

Trivial: `git revert <this-commit>` restores both files. No DB / no deploy / no config implication. The component was unreachable anyway (target endpoint = 404 since at least May 9), so even if customer demand for `/share/` surfaces later, the path forward is to **implement the backend endpoint first**, then re-add the Vue caller as a new component — not to restore this broken version.

---

## 4. Cross-references

| Doc / commit | Relation |
|---|---|
| `docs/qa-audits/2026-05-09-phase-2c-tier-4-sunset-decision.md` §3.1 | Flagged SharedView.vue as broken caller; §5.2 recommended delete; §7 Phase 2 deferred to separate ticket |
| PR #222 (`06c2aa1691`) | Backend Tier 4 sunset (SmartBIPublicDemoController deleted) — May 9 ship |
| `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` | The 30s-precheck HARD rule that surfaced this tail item is the same rule that caught the original sunset-already-shipped projection bug today |
| `web-admin/src/views/smart-bi/analysis/ShareDialog.vue:86` | **NOT affected** — this targets the authenticated `POST /api/mobile/{factoryId}/smart-bi/share` (different controller, separate flow) |

---

## 5. What this PR does NOT do

- **Does NOT implement `/share/` endpoint**. If business later wants share-token export, the design should be redone with proper auth (the deleted endpoint was unauthenticated under `/api/public/`).
- **Does NOT touch `ShareDialog.vue`** (the admin's authenticated share-creation flow). That flow targets a different, working endpoint.
- **Does NOT regenerate showcase static snapshots** (audit §5.1 Option B alternative). No business demand documented; deferred.

---

**End of decision doc.**
