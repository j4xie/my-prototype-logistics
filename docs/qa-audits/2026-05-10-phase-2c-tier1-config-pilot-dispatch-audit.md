# Phase 2C Tier 1 Config Pilot Dispatch — Premise Drift Audit

**Date**: 2026-05-10
**Status**: AUDIT-ONLY NO-OP — dispatch returned to organizer for reconciliation. No worktree created. No code touched.
**Trigger**: Dispatch received by chat2 (this session) at ~2026-05-10 evening proposing "Phase 2C Tier 1 Config Python port pilot (5 endpoints first, of 41 total)".
**Author**: chat2 recon session (xhigh effort, no impl)
**Predecessor canonical sources**:
- PR #271 — Sub-S Config + Upload 54 endpoints all KEEP (merged today)
- PR #251 — `spec(phase3+): strict-byte W3 plan + first endpoint pilot — GET /intents (Tier 1 Config) C-1 candidate` (merged 2026-05-09)
- `docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md` — Tier 1 Config port design spec (shipped 2026-05-09)
- `docs/qa-audits/2026-05-09-phase-naming-clarification-audit.md` — phase rebrand canonical naming
- HARD rule `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (graduated post Sub-M PR #261, reinforced by Sub-S PR #271 today)

---

## 0. TL;DR

> **5 hard contradictions** between the dispatch and the canonical sources merged in the last 48h. The dispatch matches the failure mode the **HARD rule graduated yesterday** is designed to catch.
>
> 1. **Tier 1 Config kickoff is explicitly BLOCKED**. Tier 1 design spec line 4 says "kickoff blocked on Phase 2C trigger gates (T6.5 Phase C complete)"; line 864 estimates kickoff **~2026-08 to 2026-09**. Dispatch wants to start today (~3 months early).
> 2. **The canonical "first endpoint pilot" is different**. PR #251 (shipped yesterday) is the canonical W3 pilot: **1 endpoint** (GET /intents), **strict-byte gate**, 5-day plan, also explicitly blocked on T6.5 Phase C complete. Dispatch proposes **5 endpoints (CRUD)**, **dict-eq gate**, 3-4h estimate.
> 3. **Sub-S audit §6.3 (PR #271, merged today) explicitly enumerates the dispatch-protocol check** organizer must run before sending. The dispatch fails 4 of the 5 axes.
> 4. **5 factual errors in dispatch text**: wrong controller file path (claims `controller/smartbi/` subdir, no such subdir), wrong URL prefix (claims `/smartbi-config/{factoryId}/intents`, actual `/api/mobile/smartbi-config/intents` with factoryId from JWT not path), wrong endpoint enumeration (claims list/detail/create/update/delete; actual list/create/update/delete/reload — no by-id GET), wrong parity gate (says dict-eq; PR #251 says strict-byte for the pilot), wrong scoping-PR reference (cites "PR #156" for "5 weeks 41 endpoints"; no such cite found, Tier 1 spec says 7-9 weeks).
> 5. **Risk row from Sub-S §8 already enumerated this exact regression class**: "If Config endpoints 410'd in Phase C, Tier 1 cutover has no Java fallback for partial-port windows" — would regress 75 customer factories.
>
> **Recommendation**: Withdraw dispatch. Re-dispatch only after (a) T6.5 Phase C complete confirmed by Phase D handoff doc, (b) operator deliverables (frontend code-path map + naming reconciliation in retrospective) closed, and (c) reconciliation with PR #251 W3 pilot scope (1 endpoint strict-byte vs 5 endpoints dict-eq — pick one, document why).

---

## 1. Dispatch text as received

Pasted verbatim from session-start dispatch (xhigh effort context, fresh /clear):

```
派工 — chat2: Phase 2C Tier 1 Config Python port pilot (5 endpoints first, of 41 total)
Status: ⚡ IMMEDIATE — 41 endpoint 整套 5 weeks per #156, 单 session deliver 不了。 本次 pilot
5 endpoint (simplest CRUD) + 验证 chain 工作 + 设 pattern for rest 36 endpoints follow-up
sessions。

⛔ /clear context fresh 接.

## 必读 (~25 min)
- QA prompt v2.4
- PR #271 Sub-S Config 41 endpoint enumeration (按 service group)
- PR #178 §1.2 OUT-OF-SCOPE list
- PR #152 Phase 2B 4-tier scoping
- backend/java/cretas-api/src/main/java/com/cretas/aims/controller/smartbi/SmartBIConfigController.java — 41 endpoint 全 list
- python-java-port.md 全 rules

## Step 0: worktree
git worktree add .worktrees/phase-2c-tier1-config-pilot -b ops-phase-2c-tier1-config-pilot origin/main

## Phase 1 — Pilot endpoint 选 5 个
基于 PR #271 Sub-S Config 41 endpoint list, 选 5 个 simplest CRUD pilot:
推荐 `intents` group (一般最小):
1. GET /smartbi-config/{factoryId}/intents (list)
2. GET /smartbi-config/{factoryId}/intents/{id} (detail)
3. POST /smartbi-config/{factoryId}/intents (create)
4. PUT /smartbi-config/{factoryId}/intents/{id} (update)
5. DELETE /smartbi-config/{factoryId}/intents/{id} (delete)

## Phase 2 — Python impl 5 endpoint
backend/python/smartbi_compat/api/config_intents.py 新建
- FastAPI router 5 method
- DB table: 找 cretas_db 对应 table (likely smartbi_intents)
- python-java-port.md rules apply

## Phase 3 — Parity gate
F999 + F001 dict-eq 5 endpoint

## Phase 4 — Report
docs/qa-audits/2026-05-11-phase-2c-tier1-config-pilot-5-endpoint.md (~400 LOC)
- 5 endpoint impl
- Parity match rate
- 36 endpoint follow-up plan (按 group 分批 dispatch)

⛔ HOLD: pilot only, NO cutover, NO frontend change。

ETA: ~3-4h | Effort: medium-high
```

---

## 2. Hard contradiction matrix

| # | Dispatch claim | Canonical truth | Source | Severity |
|---:|---|---|---|---|
| C1 | Tier 1 Config port can start NOW (⚡ IMMEDIATE) | "kickoff blocked on Phase 2C trigger gates (T6.5 Phase C complete)"; "estimated kickoff ~2026-08 to 2026-09" | Tier 1 design spec line 4 + line 864 | **CRITICAL** |
| C2 | Pilot scope = 5 endpoints CRUD, dict-eq, ~3-4h | Canonical pilot = 1 endpoint (GET /intents), strict-byte W3 gate, 5-day plan | PR #251 commit message | **CRITICAL** |
| C3 | Controller path: `controller/smartbi/SmartBIConfigController.java` | Actual: `controller/SmartBIConfigController.java` (no `smartbi/` subdir) | `ls backend/.../controller/SmartBI*.java` (verified) | HIGH (would break grep + impl from start) |
| C4 | URL: `/smartbi-config/{factoryId}/intents/{id}` (5 paths incl. detail-by-id) | Actual: `/api/mobile/smartbi-config/intents` (no factoryId in path; from JWT); intents group has list / create / update / delete / **reload** — **no by-id GET exists** | Tier 1 design spec §1.1 + Java line 56-134 | **CRITICAL** (would impl a non-existent endpoint and skip an existing one) |
| C5 | Parity: dict-eq F999+F001 | PR #251 explicitly: "Phase 2A dict-eq lock per PR #153 — pilot does NOT migrate any Phase 2A endpoint"; W3 plan is strict-byte | PR #251 commit message | HIGH (wrong test scaffolding choice from day 1) |
| C6 | "5 weeks per #156" | Tier 1 spec estimates 4-6 weeks impl + 2 weeks dryrun + 1 week cutover = 7-9 weeks; PR #156 (handoff readiness) does not contain this estimate | Tier 1 spec §7 + PR #156 grep | MEDIUM |
| C7 | "PR #152 Phase 2B 4-tier scoping" | Phase 2B (= AI intent, already DONE per PR #16) was renamed Phase 2C for the 75-endpoint scoping per naming clarification audit | `docs/qa-audits/2026-05-09-phase-naming-clarification-audit.md` §4.1 | LOW (label drift; PR #152 content is correct, label is wrong) |
| C8 | "QA prompt v2.4 必读" | No `qa-prompt-v2.4.md` found in `docs/qa-audits/` or `docs/superpowers/` | `ls` recursive search | MEDIUM (chat cannot read mandated material) |
| C9 | Worktree creation off `origin/main` HEAD | `origin/main` HEAD = `763629a46d` (Phase C QA work in flight; not "Phase C complete"). Worktree off current HEAD before Phase C closes inherits unfinished Phase C state | `git log origin/main --oneline -1` | MEDIUM (cutover prereq unmet) |

---

## 3. Detail per contradiction

### 3.1 C1 — Tier 1 Config kickoff is BLOCKED

Source: `docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md` (shipped 2026-05-09)

Line 4 (status line):

> **Status**: Design / planning doc only — kickoff blocked on Phase 2C trigger gates (T6.5 Phase C complete)

Line 48-54 (Hard prerequisites enumeration):

> **Hard prerequisites** (will not start before):
> 1. T6.5 Phase C complete (Java analysis controller files removed, `smartbi_compat/` module layout settled, no test-vs-prod schema drift unresolved).
> 2. Phase 2A retrospective (PR #151) sign-off.
> 3. Frontend code-path map snapshot (Web-Admin Vue + RN — operator deliverable).
> 4. Phase 2B ↔ Phase 2C naming reconciled in canonical retrospective.

Line 864:

> Estimated kickoff: **~2026-08 to 2026-09**, contingent on T6.5 timeline and PR #152 Phase 2C trigger gates.

**Current status of prereqs (verified 2026-05-10)**:

| # | Prereq | Status | Evidence |
|---|---|---|---|
| 1 | T6.5 Phase C complete | **NO** — Sub-S (PR #271) merged today is the most recent Phase C close-out batch. Sub-S audit §10.2 says Tier 1 "depends on Sub-S close (Config surface preserved)" — Sub-S is *necessary* but not *sufficient*. Phase C also includes service-Impl Sub-batches (Sub-B/C/D/E/F/G/H/I/L), some of which may not be all merged. Phase D not yet started per recent commits. | `git log origin/main --since 2026-05-09 --oneline` |
| 2 | Phase 2A retrospective sign-off | **YES** — PR #151 (`8912e137da`) + #193 (`c3e2485706`) + #208 (`069162b413`) all merged | `git log --grep retrospective` |
| 3 | Frontend code-path map snapshot | **NO** — no operator audit doc found at `docs/qa-audits/*frontend-code-path-map*` | recursive ls |
| 4 | Phase 2B ↔ Phase 2C naming reconciled in canonical retrospective | **PARTIAL** — `2026-05-09-phase-naming-clarification-audit.md` shipped; reconciliation in the Phase 2A retrospective is recommendation only, not yet "reconciled" | spec §5.1 |

**Implication**: Even if the dispatch is technically possible to execute, doing so violates the canonical Tier 1 design's own gate criteria. Per Sub-S §8.3 risk row: "PR #199 Tier 1 (Config) port — same issue. If Config endpoints 410'd in Phase C, Tier 1 cutover has no Java fallback for partial-port windows."

### 3.2 C2 — PR #251 is the canonical "first endpoint pilot" — and it's different

Source: PR #251 commit message (`2dabe1803e`, 2026-05-09 Sat 15:43:53 EDT, shipped yesterday)

Key lines:

> Recommended pilot: **GET /api/mobile/smartbi-config/intents (C-1)** — Tier 1 Config, flat list shape, zero Decimal, BaseEntity audit columns only, admin-only revert cost, doubles as Phase 2B Tier 1 forerunner methodology validation.
>
> Day 1–2 record + scaffold + iterate, Day 3 stub + green, Day 4 perturbation UX validation, Day 5 effort measurement + retrospective. **C-2 + C-3 reserved for Day 3–5 if early close.**
>
> Rollout post-pilot per PR #152 + PR #153 + PR #155: Tier 1 default dict-eq, Tier 2 SSE strict-byte, Tier 3 envelope strict-byte, Tier 4 sunset.
>
> **W3 kickoff blocked on T6.5 Phase C complete (still in flight 2026-05-15) per §4.1.**
>
> **Phase 2A dict-eq lock per PR #153 — pilot does NOT migrate any Phase 2A endpoint.**

Mapping to dispatch:

| Axis | PR #251 W3 pilot | Dispatch | Implication |
|---|---|---|---|
| Scope | 1 endpoint (GET /intents) | 5 endpoints (CRUD) | Dispatch is 5× wider |
| Gate | Strict-byte | dict-eq | Different test infra (strict_diff helpers from PR #154 vs Phase 2A dict-eq compare) |
| Plan | 5-day | 3-4h | Estimate is ~10× shorter |
| Status | "W3 kickoff blocked on T6.5 Phase C complete" | "⚡ IMMEDIATE" | Direct contradiction |
| Followups | C-2 + C-3 reserved if early close | 36 endpoints follow-up dispatch | Different sequencing |

**Implication**: The dispatch and PR #251 propose **incompatible pilots**. If the dispatch is the new canonical plan, PR #251 should be retired or amended in a follow-up spec; if PR #251 stays, dispatch should be withdrawn.

### 3.3 C3 — Controller file path is wrong

Dispatch: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/smartbi/SmartBIConfigController.java`

Actual (verified `ls`):

```
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIConfigController.java
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIUploadController.java
```

**No `smartbi/` subdirectory exists**. Sub-S audit §2.1 documented this same path-verification step.

Note: Sub-S §6.3 enumerates `ls controller/SmartBI*.java` as **dispatch-protocol step 1**. The dispatch failed this step.

### 3.4 C4 — Endpoint enumeration is wrong (most consequential factual error)

Dispatch enumerates the `intents` group as:

```
1. GET /smartbi-config/{factoryId}/intents       (list)
2. GET /smartbi-config/{factoryId}/intents/{id}  (detail)        ← ❌ does not exist
3. POST /smartbi-config/{factoryId}/intents      (create)
4. PUT /smartbi-config/{factoryId}/intents/{id}  (update)
5. DELETE /smartbi-config/{factoryId}/intents/{id} (delete)
```

Actual `intents` group (Tier 1 spec §1.1 + verified at `SmartBIConfigController.java` lines 56-134):

```
1. GET    /api/mobile/smartbi-config/intents?category=        listIntents(category)         line 56
2. POST   /api/mobile/smartbi-config/intents                  createIntent(config)          line 73
3. PUT    /api/mobile/smartbi-config/intents/{id}             updateIntent(id, config)      line 93
4. DELETE /api/mobile/smartbi-config/intents/{id}             deleteIntent(id)              line 114
5. POST   /api/mobile/smartbi-config/intents/reload           reloadIntents()               line 134
```

Differences:
- **URL prefix**: Dispatch says `/smartbi-config/{factoryId}/intents`; actual `/api/mobile/smartbi-config/intents`. **factoryId is NOT in the path** for any Config endpoint (it is derived from the JWT — Tier 1 spec §1 says "All endpoints share: `BASE = /api/mobile/smartbi-config`. **No `{factoryId}` in path.** Factory context derived from JWT").
- **GET by id**: Dispatch invents a `GET /intents/{id}` detail endpoint. **It does not exist**. There is no detail-by-id read; clients fetch full list and filter client-side, or call a different sub-domain.
- **Missing reload**: Dispatch omits `POST /intents/reload`. This is **the most important non-CRUD endpoint** because it invalidates the Spring cache that all read operations depend on. Skipping reload from the pilot defeats the "validation chain" goal.

**Implication**: If the dispatch were executed verbatim, the Python `config_intents.py` would:
- Implement an endpoint that has no Java counterpart (no parity ground truth to compare against)
- Skip the reload endpoint that touches the cache state machine (the actual hard parity question)
- Use a URL pattern that no frontend caller currently uses (web-admin Vue calls the JWT-derived form)

### 3.5 C5 — Parity gate framing contradicts PR #251

Dispatch §"Phase 3 — Parity gate": `F999 + F001 dict-eq 5 endpoint`.

PR #251: "**Phase 2A dict-eq lock per PR #153 — pilot does NOT migrate any Phase 2A endpoint.**" The whole point of PR #251 (and the parent PR #154 strict-byte test infrastructure spec) is that the Tier 1 pilot is the FIRST endpoint to be ported under the **strict-byte gate** that Phase 2A is locked out of.

If the dispatch's dict-eq framing is intentional, it means:
- (a) Tier 1 is being silently re-classified back into Phase 2A dict-eq scope, contradicting PR #153, OR
- (b) Dispatch was written without reading PR #251 (more likely)

Either way, the Python test scaffolding that gets written from day 1 will be wrong unless this is reconciled first.

### 3.6 C6 — "5 weeks for 41 endpoints" has no canonical source

Dispatch: "41 endpoint 整套 5 weeks per #156".

Verification attempts:
- Tier 1 spec §7 (effort estimate): "Estimated effort: ~4–6 weeks of port impl + ~2 weeks dryrun + ~1 week cutover (T6-pattern)" → 7-9 weeks
- PR #156 = `2026-05-08-phase2a-2b-handoff-readiness-audit.md` (handoff readiness for Phase 2A→2B transition). Does not contain a "5 weeks 41 endpoints" estimate.
- PR #152 (Phase 2C scoping) §4 (Tier 1): 4-tier sequencing total estimate is "12-15 weeks elapsed" per Sub-S §4.3, not 5 weeks.

**The 5-week figure has no canonical source.** This is the failure mode "feedback_marching_order_method_name_grep.md" warns about: dispatch numbers must be grep-verified, not estimated.

### 3.7 C7 — Phase 2B vs Phase 2C label drift

Dispatch refers to "PR #152 Phase 2B 4-tier scoping". This is **stale labeling** per the naming clarification audit shipped yesterday (`2026-05-09-phase-naming-clarification-audit.md` §4.1):

> Phase 2B = Apr 29 AI intent migration (= former Apr 28 "Phase 3" Tool-Skill). Already DONE PR #16.
> Phase 2C = May 8 PR #152 = remaining 75 non-analysis SmartBI endpoints (Config / Dashboard / Upload). 0% started.

PR #152's file is still named `phase2b-port-pipeline-scoping-spec.md` but its scope is canonical Phase 2C. Dispatch using "Phase 2B" for this scope is consistent with PR #152's filename but inconsistent with the canonical naming. Severity is LOW — content is correct, label is wrong — but it adds confusion for readers verifying the dispatch against memory entries that use the post-rename label.

### 3.8 C8 — "QA prompt v2.4" not found

Dispatch §"必读" lists `QA prompt v2.4`. Search results:

```bash
ls docs/qa-audits/         | grep -iE 'qa-prompt|v2.4|v2-4' → no matches
ls docs/superpowers/       | grep -iE 'qa-prompt|v2.4'      → no matches
ls .claude/                | grep -iE 'qa-prompt|v2.4'      → no matches
git log --grep='qa.prompt' → no matches
```

The reference is either (a) a doc the dispatch author has but is not committed, (b) a stale name for a doc that was renamed, or (c) a hallucinated reference. Chat2 cannot read mandated material without this resolved.

### 3.9 C9 — Worktree off current HEAD before Phase C closes

Dispatch §"Step 0":
```
git worktree add .worktrees/phase-2c-tier1-config-pilot -b ops-phase-2c-tier1-config-pilot origin/main
```

Current `origin/main` HEAD: `763629a46d` (most recent: `qa(phase-c-chat1-supp): Excel upload deep test`). Phase C work is in flight on origin/main right now. A worktree branched off this HEAD will:
- Inherit any unmerged Phase C state if subsequent Phase C PRs change `smartbi_compat/` module layout (Tier 1 spec hard prereq #1: "smartbi_compat/ module layout settled")
- Need rebase before cutover, potentially with conflicts in `smartbi_compat/api/__init__.py` if Phase C touches it

Severity MEDIUM — not blocking in itself, but reinforces that pilot kickoff is premature relative to spec-defined gate criteria.

---

## 4. Reconciliation questions for organizer

The dispatcher needs to answer these before any redispatch:

### Q-1 — Is the blocked-kickoff override intentional?

Tier 1 design spec line 4 says kickoff is BLOCKED on T6.5 Phase C complete (estimated kickoff 2026-08-09). If the dispatch is overriding this, the organizer should:
- (a) Document the override rationale in a new short spec (1-page) that supersedes Tier 1 design §0 status line, OR
- (b) Confirm the override is intentional and accept the documented risks (Sub-S §8.3: "Tier 1 cutover has no Java fallback for partial-port windows" → potential regression for 75 customer factories), OR
- (c) Withdraw the dispatch and wait for Phase C complete

### Q-2 — Is dispatch superseding PR #251 W3 pilot, or coexisting?

PR #251 (shipped yesterday) is the canonical "first endpoint pilot" — 1 endpoint (GET /intents) strict-byte. Dispatch proposes 5 endpoints CRUD dict-eq. Both cannot be the canonical pilot simultaneously.

Organizer must choose:
- (a) Dispatch supersedes PR #251 → amend PR #251 with a follow-up spec retracting the W3 pilot in favor of 5-endpoint dict-eq, OR
- (b) PR #251 stays canonical → dispatch should be reframed as "Tier 1 main port impl post-W3-pilot" (which is the 4-6 week effort per Tier 1 spec §7, not 3-4h)

### Q-3 — Where is QA prompt v2.4?

Cannot proceed without locating the QA prompt v2.4 reference. Options:
- (a) Provide the doc path (commit it to repo if not yet committed)
- (b) Update dispatch to reference the actual doc name
- (c) Drop the reference if it is not load-bearing

### Q-4 — Is the URL prefix change intentional?

Dispatch URL `/smartbi-config/{factoryId}/intents` differs from actual `/api/mobile/smartbi-config/intents` (factoryId in JWT, not path). If the dispatch intends a refactor of the URL contract (adding factoryId to path), this is a **breaking change for web-admin Vue + RN frontend callers** (Sub-S §3.2 confirmed ≥30 active frontend sites use the current contract). This needs explicit frontend impact assessment in the dispatch.

### Q-5 — Is dict-eq vs strict-byte chosen?

PR #153 (strict-byte adoption decision spec) and PR #155 (frontend impact verification, "0/50 endpoints need strict-byte") have already shipped. Per PR #251: "Tier 1 default dict-eq, Tier 2 SSE strict-byte, Tier 3 envelope strict-byte, Tier 4 sunset".

So Tier 1 **production rollout** is dict-eq. But the W3 **pilot** is strict-byte (per PR #251). The dispatch says dict-eq for the pilot. Either:
- (a) Dispatch intentionally skips the strict-byte W3 pilot and goes straight to dict-eq Tier 1 production rollout (which Tier 1 design spec says is gated)
- (b) Dispatch should be dict-eq for production rollout AND PR #251 W3 pilot is separately needed (sequencing question)
- (c) Dispatch is wrong; should be strict-byte for pilot

### Q-6 — What about reload + cache invalidation?

Dispatch §Phase 1 omits `POST /intents/reload` — but reload is the most important parity question for Config endpoints because it invalidates the Spring `CacheManager` cache that all read endpoints depend on. If reload is wrong in Python, every read endpoint silently serves stale data.

- (a) Include reload in pilot scope (then pilot is 5 endpoints: list/create/update/delete/reload, not list/detail/create/update/delete)
- (b) Defer reload to a later pilot — but then "validation chain" goal is unmet

### Q-7 — Cretas_db table name verification

Dispatch §Phase 2: "DB table: 找 cretas_db 对应 table (likely smartbi_intents)".

"likely smartbi_intents" is unverified. Per Tier 1 spec §1.1, the entity is `AiIntentConfig` (used by Tool-Skill architecture per `.claude/rules/ai-intent-tool-skill-architecture.md`). Table name needs verification — `AiIntentConfig` → `ai_intent_config` is the JPA snake_case convention; `smartbi_intents` is unlikely.

If pilot proceeds, the chat must grep-verify the actual table name before any SQL.

---

## 5. Recommended path forward

### 5.1 Immediate (organizer)

1. **Withdraw the dispatch** — do not redispatch a session to chat2 with this exact text.
2. **Read Sub-S audit §6.3 dispatcher checklist** before authoring the next Tier 1 pilot dispatch.
3. **Decide Q-1 through Q-7** above.
4. If kickoff override is intentional (Q-1 path b), write a short override spec citing the risk acceptance.
5. If withdrawing/deferring, document in organizer handoff doc that Tier 1 Config pilot is deferred until Phase C complete.

### 5.2 If proceeding with W3 pilot (PR #251 canonical path)

Re-dispatch with corrections:
- Scope: 1 endpoint (`GET /api/mobile/smartbi-config/intents`), C-1 candidate
- Gate: strict-byte (test infra from PR #154 §W1+W2 already shipped: decimal_helpers / strict_diff / dispatcher / __init__)
- Plan: 5-day per PR #251 plan
- Hard prereq: T6.5 Phase C complete (verify Phase D handoff doc exists)
- File path: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIConfigController.java` (no `smartbi/` subdir)
- URL: `/api/mobile/smartbi-config/intents` (no factoryId path param)
- Python module: `backend/python/smartbi_compat/api/config_intents.py` (matches Tier 1 spec §0 inventory)

### 5.3 If proceeding with full Tier 1 (post-pilot rollout)

Re-dispatch with corrections:
- Scope: 41 endpoints across 8 sub-modules per Tier 1 spec §0
- Gate: dict-eq for Tier 1 production rollout per PR #153 + PR #155
- Plan: 4-6 weeks impl + 2 weeks dryrun + 1 week cutover per Tier 1 spec §7
- Hard prereq: 4 prereqs per Tier 1 spec line 48-54 (T6.5 Phase C, Phase 2A retro, FE code-path map, naming reconciled)
- Sequencing: Sub-batched per sub-domain (intents / thresholds / incentive-rules / field-mappings / metric-formulas / chart-templates / admin / data-sources)
- Single-session impl not feasible: ETA is ≥7 weeks not 3-4h

### 5.4 If proceeding with 5-endpoint dict-eq pilot (dispatch as written)

Not recommended, but if intentional:
- Correct the controller file path (remove `smartbi/` subdir)
- Correct the URL prefix (`/api/mobile/smartbi-config/intents`, no factoryId in path)
- Correct the endpoint enumeration (list/create/update/delete/reload; no detail-by-id)
- Document why this supersedes PR #251 W3 plan
- Document risk acceptance for kickoff before T6.5 Phase C complete (Sub-S §8.3)
- Provide actual `QA prompt v2.4` reference or drop it
- Verify table name (`ai_intent_config`, not `smartbi_intents`)

---

## 6. Why this audit exists

This audit was triggered by **chat2 explicitly stopping** per the executing-plans skill's "If concerns: Raise them with your human partner before starting" instruction, and the HARD rule `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (graduated yesterday post Sub-M PR #261, reinforced today by Sub-S PR #271 §6.3).

The dispatch arrived at chat2 within hours of two canonical sources shipping that contradict it:
- PR #271 (Sub-S audit, merged 2026-05-10) explicitly classifies Config as HARD KEEP and warns that downstream dispatches must verify premise against 5 axes
- PR #251 (W3 pilot spec, merged 2026-05-09) is the canonical "first endpoint pilot" for Config Tier 1 — with different scope, different gate, different timing — and is itself blocked

This is the 3rd same-pattern catch in 48h (Sub-M PR #261, Sub-S PR #271, now Tier 1 pilot dispatch). The HARD rule is functioning as designed: BEFORE-edit catch, no source regression. Cost to chat2: ~30min of recon, 0 LOC of code, 0 worktree creation, 0 risk of partial impl shipping.

Per HARD rule's spirit: organizer's next Phase 2C / Phase 3+ dispatch MUST run the Sub-S §6.3 5-axis check against the dispatch premise before sending.

---

## 7. Out of scope for this audit

- Recommending a specific override path (Q-1 path a/b/c) — decision belongs to organizer + Steve
- Modifying PR #251, Tier 1 design spec, or any committed canonical source
- Writing the actual Python `config_intents.py` impl (intentionally not started)
- Creating a worktree (intentionally not created)
- Committing this audit (left in working tree for organizer review)

---

## 8. Status

- [x] Recon completed by chat2 (Opus 4.7 1M, xhigh effort)
- [x] Audit doc written to `docs/qa-audits/2026-05-10-phase-2c-tier1-config-pilot-dispatch-audit.md`
- [x] No code changes
- [x] No worktree created
- [x] No commit (left in working tree)
- [ ] Steve / organizer review
- [ ] Organizer decides path (5.2 / 5.3 / 5.4 / withdraw)
- [ ] If withdraw: chat2 session ends here, no follow-up impl
- [ ] If proceed: organizer re-dispatches with corrections; chat2 (or fresh chat) takes the corrected dispatch

🤖 Generated with [Claude Code](https://claude.com/claude-code) — Opus 4.7 1M, xhigh effort recon session
