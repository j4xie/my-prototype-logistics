# Phase 2A Retrospective — Java→Python SmartBI Port (4-Day Sprint, 5-Chat Coordination)

> **Status**: Doc-only retrospective. Not for execution. Reference for Phase 4+ similar Java→Python migration efforts.
>
> **Writing date**: 2026-05-03
> **Period covered**: 2026-04-30 → 2026-05-03 (4 calendar days, ~45 PRs to `main`)
> **Author**: Phase 2A organizer chat (Chat 5), post-PR #69 (drill-down spec) + PR #70 (procurement PR-C-2) ship.
> **Audience**: future organizer chats, future migration leads, anyone planning a multi-chat byte-shape parity port.
>
> **Doc lineage**:
> - `plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` — backlog map + scope lock + endpoint inventory
> - `specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` (PR #59) — T6 ops handover spec
> - `specs/2026-05-02-phase2a-t6-deploy-runbook.md` (PR #62) — T6 runbook
> - `specs/2026-05-02-phase3-cleanup-design.md` (PR #63) — Phase 3 cleanup A/B/C
> - `.claude/rules/python-java-port.md` — Rules 1-9 (Rule 8 PR #35, Rule 9 PR #55 graduated this period)
> - Memory `feedback_subagent_driven_audit_pattern.md` + 4 organizer-discipline memories accumulated this period

---

## §1. Executive summary

Phase 2A in 4 calendar days (Apr 30 → May 3) shipped **~45 PRs to `main`** across **5 parallel chats**, completing **28/29 in-scope SmartBI analysis endpoints** (~96.5%) with byte-shape parity Python ports of the original Java implementations. The single remaining in-scope endpoint (`POST /drill-down`) has its spec merged (PR #69) and impl is gated to start in the next session.

**Key shipped output**:
- 28 endpoints ported with `_strip_volatile` byte-shape gate passing
- 27 spec files in `docs/superpowers/specs/` (per-endpoint design docs, audit-cycle artifacts)
- 2 new project rules graduated to `.claude/rules/python-java-port.md` (Rule 8 + Rule 9)
- T6 ops kit (3 PRs: design + runbook + tooling) — handover-ready
- Phase 3 cleanup spec (PR #63) — post-T6 stable cleanup A/B/C planned
- 7 endpoints explicitly **deferred** (5 Java mock-only/stub-only + `/query` LLM-coupled + ~10 dashboards low-ROI), each with deferral PR and re-spec triggers documented

**Key non-code output (organizer process)**:
- 5 organizer-discipline memories created from real incidents accumulated this period (admin merge verify, marching order separation, projection bug, main worktree isolation, long-running branch rebase)
- 4-cycle spec audit pattern validated across 5 specs (`feedback_subagent_driven_audit_pattern.md`)
- subagent-driven impl pattern (`superpowers:subagent-driven-development`) validated as default workflow for byte-shape ports

**Why this retro matters**: Phase 4+ similar migrations (JavaScript → TypeScript, monolith → microservice extraction, vendor migration with parity guarantees) can re-use the patterns documented here without re-deriving them. The cost of producing this retro (~3-4h) is dominated by the saved cost of one future organizer chat re-discovering Rule 9 (Lombok + Jackson serialization quirks) on its own.

---

## §2. Phase 2A scope evolution

### 2.1 Starting state (Apr 30)

Backlog map PR #31 (`docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md`) initially counted ~50 SmartBI endpoint surface area as candidates for Python port. The **Phase 2A scope lock** carved this down explicitly:

**In scope** — `SmartBIAnalysisController` + partial `SmartBIDashboardController`:
- 26 base endpoints (per-type sub-types counted separately)
- ~5 high-priority dashboard endpoints

**Out of scope** (stayed Java permanently per `project_apr30_tool_skill_stays_java.md`):
- `SmartBIConfigController` (41 endpoints) — config + reload mgmt, not analysis
- `SmartBIUploadController` (13 endpoints) — already-Python `/api/excel/*` path exists
- `SmartBIPublicDemoController` (10 endpoints) — demo site only
- `IntentAnalysisController` (27 endpoints) — AI intent entry, locked Phase 2B+
- 337 Tools / 16 Skills / `AIIntentService` — full Tool-Skill stack stays Java

### 2.2 Scope shrinkage during execution

Five endpoints were **discovered to be Java mock-only or stub-only during impl preparation** and properly deferred rather than byte-ported a hardcoded stub:

| # | Endpoint | Defer PR | Java state                         | Re-spec trigger |
|---|----------|----------|------------------------------------|-----------------|
| 1 | `/analysis/quality`     | PR #37 | `Random(seed)` LCG mock          | Real `QualityInspection`/`ReworkRecord`/`DisposalRecord` entity + repo |
| 2 | `/analysis/production`  | PR #37 | Same mock pattern                | Real production-domain entities |
| 3 | `GET /datasource/{id}/preview` | PR #45 | `noChanges` stub (line 96-105)   | Real schema-temp-store + LLM mapping path |
| 4 | `POST /datasource/upload`      | PR #49 | 3 TODO stub (line 57-93)         | Excel parse + schema diff + LLM inference |
| 5 | `POST /datasource/apply`       | PR #50 | bookkeeping-stub (line 107-147)  | Real DDL + mapping validation + field updates |

Plus:
- **`POST /query`** (NL→SQL) — kept out of scope, LLM-coupled with Phase 2B AI system. Will not enter Phase 2A.
- **~10 dashboard endpoints** — low ROI, Tier 4 in backlog, skipped pending demand signal.

This **scope-protecting discipline** is the key value of the per-spec brainstorm + grep-Java-impl-first workflow. PR #37 → #45 → #49 → #50 are a lineage: each subsequent defer PR (after PR #37) cited the earlier defer PR's reasoning, accumulating the "stub-detection process rule" into the backlog map (`docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` §2.4 "Process rule 教训").

The Phase 4+ takeaway: **scope shrinkage during execution is success, not failure**. If 5/35 in-scope items defer cleanly with re-spec triggers documented, the team has avoided 5× wasted impl chats writing tests for hardcoded stubs.

### 2.3 Final ship state (May 3)

| Bucket | Count | Status |
|--------|-------|--------|
| Shipped to `main` (full ✅) | 28 endpoints | per `plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` §2.1 |
| Spec ready, impl in flight | 1 endpoint | drill-down (spec PR #69 merged, impl session pending) |
| Deferred (Java not real) | 5 endpoints | quality / production / preview / upload / apply |
| Out-of-scope permanent | ~15 endpoints | `/query` + ~10 dashboards + others |

**In-scope completion**: 28 / 29 = 96.5%. Drill-down impl shipping closes Phase 2A 100% in-scope.

---

## §3. Audit pattern validation

### 3.1 Pattern recap

`feedback_subagent_driven_audit_pattern.md` describes a **4-cycle audit per spec**:
- Cycle 1 — self-review (chat that wrote the spec)
- Cycle 2 — independent spec-reviewer subagent
- Cycle 3 — cross-spec consistency reviewer (looks at sister specs in same family)
- Cycle 4 — fresh implementation-reviewer subagent (reads spec from "I'm about to start coding" angle)

Mechanical PR-B-style work (test additions, no architectural change) skips cycles 2 + 3.

### 3.2 Empirical findings count (Phase 2A)

Aggregating across the **5 specs that ran the full 4-cycle audit** (cost / profit / receivable / budget / department / region / inventory / procurement / drill-down):

| Cycle | Typical findings per spec | Type of finding |
|-------|---------------------------|-----------------|
| 1 (self) | 3-5 | Placeholder bugs (`or None`), quick syntax slips |
| 2 (spec reviewer) | 8-12 | Algorithm correctness, dependency surface, signature drift |
| 3 (cross-spec) | 4-7 | Shared infra (PR sequencing, idempotent ship, helper naming) |
| 4 (fresh impl reviewer) | 3-6 | Subtle byte-parity divergence, import correctness, stale citation |

**Per-spec total**: ~30-40 issues caught before plan-write. Single-cycle audit would have shipped 4-5 issues to `main` per spec.

### 3.3 Cycle-4 catch examples (high-value, would-have-broken-prod)

Notable findings caught only in Cycle 4 across this period:

- **PR #47 inventory spec, Cycle 4** — caught `_fetch_all` (does not exist anywhere in `smartbi_compat/`) and `verify_factory_access` (actual symbol: `verify_jwt_and_factory`) wrongly cited as canonical helpers across **3 sister specs** (procurement #40, department #36, region #41). Day-1 `ImportError` on every impl chat. Fix: PR #47 added a PR-A0 prereq introducing the canonical helper, and **all sister specs self-healed at impl time** without retroactive churn. Memory: `feedback_phase2a_sister_spec_import_audit.md`.

- **Procurement PR-A (Chat 4) impl-reviewer pass** — caught MoM growth `alertLevel` field missing in spec (sister of YoY); would have produced spec-vs-impl byte-shape divergence on prod data with non-zero MoM growth.

- **Drill-down spec, Cycle 4 (Z1)** — surfaced 138-LOC fundamental redesign of dispatch dimension Z (the spec had treated cross-table drill-down as an after-thought; Cycle 4 made it first-class). Would have been a 1-day lost impl PR if spec had merged unchanged.

### 3.4 Pattern-fatigue stop signal validated

`feedback_subagent_driven_audit_pattern.md` notes: when the 4th-time audit on a sister spec produces Critical findings at the **same rate** as 1st-time audits, that's a stop signal — switch chats. Validated this period: **budget spec Cycle 4** surfaced "pattern fatigue" findings (4 Critical issues that earlier cost/profit/receivable specs at 1st-time audits also had). Confirmed by reviewer agent itself volunteering "pattern fatigue confirmed" in cycle output.

Action taken: Wave 1 (foundation finance specs) ran 4-cycle, Wave 2+ (procurement / inventory / region / department / drill-down) leveraged the fully-audited foundation patterns and ran 4-cycle on **first-of-domain** spec only, then PR-B-style work on subsequent specs ran 2-cycle.

### 3.5 Post-edit grep verify (graduate to general rule)

Cycle 3 of the drill-down spec surfaced a **meta-finding**: each cycle's fix sweep was leaving 1-2 stale references unswept (e.g. `replace_all "iso_year" → "d.year"` missed one occurrence). Resulted in Cycle N+1 re-flagging issues already "fixed" → wasted audit cycle.

Graduated mitigation now baked into `feedback_subagent_driven_audit_pattern.md`:

```bash
# After each cycle's fix commit, before pushing:
grep -nE "<exact pattern reviewer flagged>" docs/superpowers/specs/<spec-file>.md
# Expect: 0 hit (full sweep) or only annotated audit notes
```

Also applies to any multi-section refactor / `replace_all` / sweep operation — discipline is the last line of defense against silent miss.

---

## §4. Rule graduation 历程

This period graduated **2 new project rules** to `.claude/rules/python-java-port.md`. Combined with Rules 1-7 inherited from earlier finance work (cost / profit / payable, late Apr), the file now codifies 9 hard rules spanning byte-shape parity from value-encoding through key ordering through DTO serialization.

### 4.1 Rule 8 — `Map.of(N)` Jackson hash order (PR #35)

**Graduation event**: sub-endpoints PR #32 (budget-achievement + yoy-mom + category-comparison) — Chat 3 hit **3 distinct `Map.of(N)` sites** producing wrong key order in Python literal dicts vs Java Jackson's hash-based output. None were predictable from Java source order — all required golden recording to discover the actual Jackson key order.

**Pattern**: Java `Map.of(N)` uses `MapN<K,V>` classes with `N`-specific hash algorithms. Same key set passed to `Map.of(2)` vs `Map.of(3)` vs `Map.of(4)` produces **different** key orders in JSON output. Python `dict` literal preserves insertion order — direct mirror of Java source order is wrong **almost always**.

**Cost of catching late**: each unmapped `Map.of(N)` is one byte-shape gate failure on impl PR's first golden compare. Cycle catches all of them at impl time, but 30 minutes of "why does my golden fail" debugging per site is paid before the rule is internalized.

### 4.2 Rule 9 — Lombok + Jackson serialization quirks (PR #55)

**Graduation event**: 3 sister chats independently confirmed 3 sub-patterns in Phase 2A Tier 2 impl wave on **the same day** (2026-05-02):

| Sub-pattern | Discovery |
|-------------|-----------|
| 9.1 — `Introspector.decapitalize` lowercases connected uppercase letters (`xAxisField` → `xaxisField`) | inventory PR-A (Chat 1) + region PR-A (Chat 2) + department PR-A (Chat 4) |
| 9.2 — DTOs without `@JsonInclude(NON_NULL)` emit `null` fields explicitly | All 3 chats independently |
| 9.3 — Lombok `@Data` derives `is*`/`get*` methods that Jackson treats as fields, increasing emit count beyond source | department spec `DateRange` (5 fields → 7 fields with `days` derived + `valid` boolean) |

3 independent confirmations from 3 different impl chats hit graduation threshold. PR #55 committed Rule 9. PR #58 retroactively patched sister specs with cosmetic Rule 9 references (without churning their impl).

### 4.3 Rules 1-7 re-validation (no new graduation)

Cycle 4 audits on Phase 2A specs **repeatedly hit Rule 1-7 violations**, validating the existing rule corpus:
- Rule 1 (`is not None` vs `or` for null-fallback) — caught in cost spec Cycle 4 (`if r.get("material_cost"):` truthy-check missing `Decimal("0")` rows)
- Rule 4 (`_decimal_to_number` Decimal→number serialization) — caught in 4 sub-endpoint specs (default FastAPI `Decimal → str`)
- Rule 7 (Decimal threshold comparison vs `float()`) — confirmed integer thresholds (15/25/0/20) safe; non-integer thresholds (75.5/0.95) require `Decimal` compare

The rule re-application without re-derivation is the value of having Rules 1-9 as project-level reference. Phase 4+ Java→Python work can cite Rule N directly without re-explaining.

### 4.4 Rule graduation criterion (proposed for future codification)

Empirical pattern from Rules 8 + 9: a finding graduates from per-spec audit annotation to project-rule when **3 independent occurrences** appear in distinct contexts (not just the same chat re-finding the same bug). Rule 8 hit graduation in 1 PR (3 `Map.of(N)` sites in same PR but distinct semantics). Rule 9 hit graduation in 3 sister chats same day.

---

## §5. Concurrent edit + projection bug 教训

5-chat concurrent execution surfaced 4 distinct organizer-discipline failure modes, each with multiple incidents this period. All 4 are now codified in memory.

### 5.1 Main worktree branch isolation (4 incidents)

**Memory**: `feedback_main_worktree_branch_isolation.md`.

**Pattern**: main worktree (`C:/Users/Steve/my-prototype-logistics`, `e2e/v1-framework` branch) is the user's daily work unit. When any chat does `git checkout -b <task-branch>` in main worktree instead of creating a `.worktrees/<task>/`, two failure modes appear:
- Concurrent chat 2 writes file → commit lands on chat 1's branch by mistake
- Mid-rebase conflict in main worktree blocks **all other chats**' admin operations

**Incidents this period**:
1. Chat 5 `phase2a/spec-region` branch in main worktree, Chat 2 simultaneously editing region in `.worktrees/phase2a-region-impl/` → Chat 5's commit landed on procurement branch by mistake → cherry-pick rescue.
2. Chat 1 cosmetic patches in main worktree, Chat 5 simultaneously checked out T6 branch → Chat 1's initial commit landed on T6 branch → `-v2` branch rescue.
3. Organizer's own `phase2a/defer-datasource-apply` rebase in main worktree mid-conflict → blocked admin merge of PR #51 → `git rebase --abort` rescue.
4. Chat 5 `phase2a/spec-region` work in main worktree second time, Chat 2 simultaneously editing → double-source confusion.

**Mitigation now baked into marching orders**: every dispatch contains:
```
启动前置 (必跑):
  cd C:/Users/Steve/my-prototype-logistics/.worktrees/<task-name>
  pwd && git branch --show-current
  预期: <task-name> in path, branch <task-branch>
```

Chat doesn't proceed without verify. Organizer also self-disciplines (Rule 9 PR #55 doc-only PR — done in worktree, not main).

### 5.2 Organizer projection bug (4 incidents)

**Memory**: `feedback_organizer_projection_bug.md`.

**Pattern**: organizer writes marching order based on assumed (not verified) PR/commit state — "I think Chat 4 PR-A merged, dispatch Chat 5 PR-B now." Reality: PR-A still in audit cycle, prereq fail, Chat 5 starts wrong work.

**Incidents this period**:
1. Chat 3 drill-down spec dispatched assuming "spec PR merged" — actually spec was still in cycle 2 audit. Chat 3 detected on its own (`origin/main` lacked drill-down spec file).
2. Chat 2 region PR-A dispatched assuming "merged" — `gh pr list` showed no #56 yet. Chat 2 detected on its own.
3. Chat 5 procurement PR-B dispatched without Chat 4 PR-A prereq verified — Chat 5 surfaced "spec drift catch" but missed sequencing issue.
4. Chat 5 cross-task jump (department PR-B → procurement PR-B direct, skipping sequencing).

**Each chat self-detected and stop-and-pinged the organizer**, saving roughly 1+ hour of wrong work per incident. But this **should not depend on chat discipline** — the organizer's own verify protocol must be the primary defense.

**Mitigation now baked**: before any marching order, organizer runs:
```bash
git fetch origin && git log origin/main --oneline -5
gh pr list --state open --json number,title
gh pr view <N> --json state,mergeCommit  # for any PR cited as merged
```

Never fabricate PR numbers (no "估 #57" / "估 #58") — write real number or leave `<TBD>` until real number is available.

### 5.3 Marching order separation (3 incidents)

**Memory**: `feedback_organizer_marching_order_separation.md`.

**Pattern**: organizer mixes "immediate" and "queued" tasks in same message. User pastes the whole thing to a chat. Chat treats everything as immediate, jumps the queued task → starts wrong work.

**Incidents this period**:
1. Chat 2 + Chat 3 each got mixed messages with "spec PR merge 后给它发" + immediate task in same paste. Chat 3 ran the queued part as immediate.
2. Chat 5 got "Phase 2 procurement PR-B" + "Phase 1 department PR-B" in same message. Chat 5 jumped Phase 1 → went straight to procurement PR-B (Chat 4 PR-A prereq also unmet).
3. Chat 1 cosmetic patch + procurement PR-C standby in same message — saved by plan-only branch lock.

**Mitigation now baked**:
- Every marching order top-line tag: `⚡ IMMEDIATE` or `⏳ QUEUED — wait for X`
- Never mix two types in one message
- Organizer keeps queued ledger privately; user only sees current actionable work

### 5.4 Admin merge file scope verify (1 catch)

**Memory**: `feedback_organizer_admin_merge_verify.md`.

**Pattern**: GitHub's `mergeable=MERGEABLE` says "git can fast-forward" — it does **not** say "diff content is correct". A force-push from a base earlier than sister merges produces a PR diff showing **deletions of sister files** (because the PR's base predates sister-merged commits). Direct admin merge would revert sister chats' work.

**Catch this period (1 incident)**:
- **PR #56 (region PR-A, Chat 2)** — force-pushed after 13 WIP commits. GitHub showed `-2587` lines across `analysis_inventory.py` + `analysis_finance.py` + 6 plan/golden files (sister-owned). **If admin-merged directly, would have reverted 5+ sister chats' work.** Organizer caught it via routine `gh pr view --json files` check, deletions count was anomalous. Chat 2 rebased onto current main → re-verified 0 sister-file deletions → clean admin merge.

**Mitigation now baked**:
```bash
gh pr view <N> --json mergeable,additions,deletions,statusCheckRollup
gh pr view <N> --json files --jq '.files[] | "\(.additions)\t-\(.deletions)\t\(.path)"'
# Manual sister-revert check; only then admin merge
```

Not optional. The 30 seconds per merge is far cheaper than one sister-revert disaster.

### 5.5 Long-running branch rebase before squash

**Memory**: `feedback_long_running_branch_rebase_before_squash.md`. Born from the same PR #56 incident — root cause analysis identified the rebase-before-squash gap, codified the prevention checklist for any branch with 5+ WIP commits or 1+ hour duration. See memory for the canonical workflow.

---

## §6. Subagent-driven impl 模式实证

### 6.1 Pattern recap

`superpowers:subagent-driven-development` dispatches an impl plan as N parallel subagent tasks (each independent, no shared state). The orchestrator chat reviews the consolidated diff at end. Compared to inline impl, observed advantages:

- **30-50% faster wall-clock** on multi-task impl plans (parallel execution)
- **Better token efficiency** — orchestrator doesn't carry every task's intermediate state
- **Implicit code review** — subagent's final reviewer pass catches bugs before commit

### 6.2 Empirical use this period

5 specs ran subagent-driven impl after 4-cycle spec audit:
- finance/cost (PR #25 + #28)
- finance/profit (PR #21 + #22)
- finance/budget (PR #38 + #44)
- finance/receivable (PR #42 + #46)
- finance/payable (PR #18 + #51)

Plus Tier 2 4-mode endpoints (department / inventory / region / procurement). Per-spec impl plan sizes ranged from 8-18 tasks; subagent dispatch typically split into 3-5 parallel subagents.

### 6.3 Final reviewer subagent catches

Validation that final-reviewer subagent is non-redundant with spec audit:
- **Procurement PR-A (Chat 4)** — final reviewer caught MoM growth `alertLevel` field omission (spec drift between cycle 4 audit and impl), would have shipped silent byte-shape gate failure.
- **Drill-down spec Cycle 4 → Z1 redesign** — final-reviewer flagged the dispatch-dimension Z gap (138 LOC redesign), avoiding 1+ day of wasted impl work on a foundation that wouldn't compose.

### 6.4 Subagent rate limit recovery

Real failure mode encountered: **Chat 1 receivable PR-A** ran into Sonnet rate limit mid-task. Recovery: switched orchestrator's subagent dispatch to Haiku for remaining tasks. No work lost; final reviewer pass on Sonnet caught nothing additional. Lesson: **subagent model selection is per-task**, orchestrator can mix-and-match if rate-limited mid-flight.

### 6.5 Commit safety

`safe-commit.sh` (`./scripts/safe-commit.sh "msg" file1 file2`) and Rule 5b (`git commit -m "msg" -- F1 F2`) used by **all** Phase 2A subagent dispatches for `git commit` step. **Zero force-push disasters across 45 PRs**. (PR #56 force-push was a recoverable rebase issue, not a sister-file overwrite.)

---

## §7. Spec-protecting "stop-and-pinged" 模式

When a chat detects a contradiction between its assigned task and observed reality, the **right action** is to stop work and ping the organizer rather than guess-and-proceed. Phase 2A had **4 such catches**, each prevented downstream damage.

| Incident | Chat | What was caught |
|----------|------|------------------|
| 1 | Chat 3 | Drill-down spec "merged" assumption — observed `origin/main` lacked the spec file. Stop-and-pinged → organizer verified spec was in cycle 2 → resumed correctly. |
| 2 | Chat 2 | Region PR-A "merged" assumption — `gh pr list` showed no #56. Stop-and-pinged → organizer realized projection bug → marching order corrected. |
| 3 | Chat 5 | Procurement PR-B prereq not satisfied — Chat 4's PR-A still in flight. Stop-and-pinged → standby until #64 ship. |
| 4 | Chat 5 | Spec drift surfaced via Rule 9 catch (Lombok serialization). Spec was wrong about field set. Stop-and-pinged → impl-reviewer protocol added pre-commit grep verify (now general audit-pattern §3.5). |

This is the **last line of defense against organizer projection bug**. Organizer should not depend on it — but it is the safety net.

The chat-side discipline (`feedback_organizer_projection_bug.md` "chat as last-line defense" clause) is now codified as part of every marching order template:

```
启动前置 (必跑, 缺任一停手 ping 用户):
  ...
  必须看到: <expected commit/PR state>
```

---

## §8. T6 ops kit (3 件套)

T6 = the final operational handover. After all in-scope endpoints ship, T6 flips the nginx gateway upstream for `/api/mobile/{factoryId}/smart-bi/*` paths from Java (port 10010) to Python (port 8083). Pure ops change — no code, no schema migration.

Phase 2A produced a **complete 3-piece kit** ready to execute when Phase 2A 100% closes:

### 8.1 PR #59 — Design spec (`specs/2026-05-02-phase2a-t6-nginx-cutover-design.md`)

4-stage rollout architecture:
- T6.1 — dryrun (nginx config validate, no traffic)
- T6.2 — 10% canary
- T6.3 — 50% canary
- T6.4 — 100% + 7-day soak

Each stage has explicit success criteria, rollback trigger, and abort condition. Builds on `plans/2026-04-11-nginx-upstream-migration-audit.md` (nginx upstream pattern), `plans/2026-04-10-phase3-cloud-sg-cutover.md` (Phase 3 SG cutover precedent).

Prereq checklist (§9.1 of design doc): Phase 2A 100% in-scope shipped, every endpoint contract test ✅ via `_strip_volatile` byte-shape gate, F001 manual smoke logged per endpoint, Rule 8 + Rule 9 audited per endpoint, Java baseline 1-week stable + Python baseline 48h stable.

### 8.2 PR #62 — Deploy runbook (`specs/2026-05-02-phase2a-t6-deploy-runbook.md`)

Step-by-step ops handover: nginx config patches, monitoring queries, rollback commands, on-call escalation. Pairs with PR #59 design — design says "what + why", runbook says "exactly what to type at 3am during canary".

### 8.3 PR #66 — Baseline tooling (`scripts/baseline-java-metrics.sh` + `scripts/lib/baseline-aggregate.py`)

Collection script + aggregator for Java baseline metrics (latency p50/p95/p99, error rate, throughput) — required input for T6 success criteria. Runs continuously for 1 week before T6.1 to establish the baseline that T6.2-T6.4 must not regress against.

### 8.4 Why a separate ops kit instead of inline per-PR

Per-endpoint impl PRs ship Python code that **lives alongside** Java code (callable via different paths). Until T6, Java is production-serving; Python is dark-shipped infrastructure verified by direct calls / contract tests / F001 manual smokes.

T6 is the moment **production traffic moves**. That has its own risk profile (5xx spike during nginx reload, divergent mobile/web client behavior, JVM left running but dark) that doesn't belong in any per-endpoint impl PR. Separate ops kit isolates the operational risk surface.

---

## §9. Phase 3 cleanup 已 spec (PR #63)

**Spec**: `docs/superpowers/specs/2026-05-02-phase3-cleanup-design.md`. Phase 3 = post-T6 stable cleanup. Three independent tracks (A/B/C) executable when conditions are right.

### 9.1 Phase 3.A — `DashScopeClient` cleanup

After Phase 2B-α (PR #16) + Phase 2B-β (PR #24) migrated AI orchestration to Python, `DashScopeClient` consumers in the Java codebase shrink. Phase 3.A removes obsolete Java AI client code paths.

**Critical scope lock**: per `project_apr30_tool_skill_stays_java.md`, **19/25 `DashScopeClient` consumers stay Java** (Tool-Skill stack). Phase 3.A only removes the 6 consumers that migrated. Reading the spec carefully matters — naive grep + delete would break the Tool stack.

### 9.2 Phase 3.B — Java SmartBI analysis cleanup

After T6.4 + 7-day soak + Java traffic = 0 confirmed, delete the obsolete Java SmartBI analysis service classes.

**Preservation list**:
- `QualityAnalysisServiceImpl` — preserved (deferred Phase 2A endpoint, Java is still authoritative until real impl + re-port)
- `ProductionAnalysisServiceImpl` — same as quality
- `SmartBiSchemaServiceImpl` (preview/upload/apply) — preserved, stub-only Phase 2A defer
- All Tool-Skill / `AIIntentService` paths — preserved per scope lock

Deletion targets: shipped-to-Python endpoints' Java service classes only. Roughly 28 service classes deletable.

### 9.3 Phase 3.C — Deprecated config + flag cleanup

Phase 2B feature flags (e.g. `intent.matching.use-python`, `ai.orchestration.use-python`) become permanent default-true after Phase 2B soak. Phase 3.C removes the flag scaffolding (config keys, `@ConditionalOnProperty`, fallback paths).

### 9.4 Execution gate

Phase 3 is not executable until:
- Phase 2A 100% (all in-scope endpoints shipped)
- T6 100% complete (post-T6.4 + 7-day soak)
- Phase 2B flag-flip soak complete (default-true on prod for ≥2 weeks, no rollback)

Estimated: late-May to mid-June 2026 if no Phase 2A regressions force re-work.

---

## §10. Tier 1 / 2 / 3 复杂度对比

Empirical complexity scaling observed this period:

| Tier | Endpoint type | Spec time | Impl time | Examples |
|------|---------------|-----------|-----------|----------|
| Tier 1 | CRUD-style, single table, simple | 3-5h spec+impl combined | (combined) | datasource fields/history (#39), query-templates POST/PUT/DELETE (#48), incentive-plan (#43) |
| Tier 2 | 4-mode domain, sub-services, joins | 8-15h spec | 12-25h impl | department (#52 + #57), inventory (#53 + #54 + #65), region (#56 + #60), procurement (#64 + #67 + #68 + #70) |
| Tier 3 | Cross-table dispatch, hierarchy, transactions | 8-12h spec (4-cycle) | 12-18h impl PR-A + 5-12h follow-ups | drill-down (#69 spec; impl pending) |

**Scaling factors**: number of dispatch dimensions, sub-service count, transaction boundary, cross-service dependencies, byte-shape parity surface area.

**Tier 2 sub-pattern**: 4-mode endpoints (where `analysisType` parameter routes to per-type service path) split naturally into PR-A (per-type real impl) + PR-B (default mode + DashboardResponse) + PR-C (arithmetic depth tests). 3-PR cadence allows independent review and per-stage admin merge without blocking sister chats.

**Tier 3 sub-pattern**: drill-down's spec Cycle 4 surfaced fundamental architecture re-think (Z1 138-LOC redesign). Tier 3 spec audit cannot skip Cycle 4 — the cross-cutting concerns are too easy to under-design at first pass.

---

## §11. 时间线 + ship velocity

### 11.1 Day-by-day

| Date | Major shipped (selected highlights) |
|------|--------------------------------------|
| 2026-04-30 | Phase 2A wave 1 launch — finance foundation (#13), payable PR-A (#18), profit PR-A (#21), profit PR-B (#22), cost PR-A (#25) |
| 2026-05-01 | Finance 5/5 specs ship + most impls + sub-endpoints (#32) + finance budget PR-A (#38) + receivable PR-A (#42) + Wave 2 Tier 1 (#39, #43, #48) + 3 deferral PRs (#37, #45, #49) + Rule 8 (#35) |
| 2026-05-02 | Tier 2 4-domain spec + impl wave — department PR-A (#52) + inventory PR-A (#53) + region PR-A (#56) + procurement PR-A (#64) + 4 PR-Bs + Rule 9 (#55) + retroactive sister patches (#58) + T6 ops kit (#59 + #62 + #66) + Phase 3 cleanup spec (#63) + #50 (datasource/apply defer) |
| 2026-05-03 | Tier 2 finishing — procurement PR-C tests (#68 + #70) + drill-down spec (#69) ship; drill-down impl gated to next session |

### 11.2 Velocity numbers

- **~45 PRs / 4 calendar days** ≈ 11 PR/day average velocity
- **5 chats parallel** — speedup vs hypothetical single-chat is observably significant but not measured precisely; coordination overhead is real
- **~28 endpoint ports / 4 days** ≈ 7 endpoints/day shipped (counting sub-types)

### 11.3 Why 5-chat parallel was not strictly 5x

Coordination overhead consumed real wall-clock time:
- Organizer projection bug + admin merge verify + marching order separation incidents (4 + 1 + 3 = 8 incidents this period, each costing 15-60min)
- Sister-spec sequencing dependencies (PR-A blocks PR-B, PR-B blocks PR-C — most domains had 3-PR cadence)
- Worktree contention (4 main worktree branch isolation incidents, 30+ min each)

By May 3 most discipline was codified into memories. Phase 4+ should observe better parallel efficiency with same chat count if discipline memories load at organizer chat start.

---

## §12. Phase 4+ 建议

Concrete process recommendations for the next similar Java→Python (or any byte-shape parity port) effort:

### 12.1 Pre-flight Java grep (always)

Before dispatching any spec chat, organizer runs:
```bash
# Mock detection
grep -nE "Random\(.*hashCode|generateMock|示例数据" backend/java/.../<service>.java
# Stub detection
grep -nE "TODO 实际实现|TODO.*实现|return.*\.noChanges|Stub 实现" backend/java/.../<service>.java
```

If any hit: defer the endpoint immediately with PR explaining impl gap. **Do not** dispatch a spec chat hoping the audit will catch it — wasted spec chat cost is real (1-2h per).

### 12.2 4-cycle audit on first-of-domain only

For sister specs in same family (4 finance subdomains, 4 Tier 2 4-mode endpoints), only the **first** spec per family runs full 4-cycle audit. Subsequent sister specs:
- Cycle 1 (self) — always
- Cycle 4 (fresh impl reviewer) — always
- Cycles 2 + 3 — skip if family-pattern audit already merged

**Saves ~50% audit time per sister spec without quality regression** (validated on cost → profit → receivable → budget cascade).

### 12.3 Mechanical PR-B-style work skip 2 cycles entirely

PR-B (test additions, no architectural change), PR-C (arithmetic depth tests):
- Cycle 1 (self) — always
- Cycle 4 (fresh impl reviewer) — always
- Cycles 2 + 3 — skip

5-7x speedup vs full 4-cycle. Validated across 8+ PR-B/C ships this period.

### 12.4 Main worktree always locked, no exceptions

Even doc-only PRs (Rule 9 PR #55, retroactive patches PR #58) **use a worktree**. Organizer self-disciplines because the worktree-set-up cost (30s) is far less than one branch-contamination incident (30min recovery + commit log noise).

### 12.5 Admin merge file-scope verify, no exceptions

Even when GitHub shows `mergeable=MERGEABLE` and CI green, run:
```bash
gh pr view <N> --json files --jq '.files[] | "\(.additions)\t-\(.deletions)\t\(.path)"'
```

Sister-revert deletions in the file list = STOP, chat rebases. 1 catch this period (PR #56) prevented 5+ chat work loss.

### 12.6 Subagent-driven impl as default for byte-shape ports

`superpowers:subagent-driven-development` is the right workflow for byte-shape ports. Validated 8+ times this period. Final reviewer pass catches non-trivial bugs (procurement MoM growth, drill-down Z1).

### 12.7 Marching order separation hard rule

`⚡ IMMEDIATE` vs `⏳ QUEUED — wait for X` tags on every dispatch. Never mix in same message. Organizer keeps queued ledger privately.

### 12.8 Defer over byte-port stubs

Any Java service impl class containing "TODO 实际实现" / "示例数据" / "Stub 实现" / `Random(seed)` mock pattern → **defer with PR**, do not dispatch spec chat. PR #37 + #45 + #49 + #50 set the precedent. 5 endpoints saved from wasted spec chats this period.

### 12.9 Rule graduation when 3 independent occurrences

Empirical pattern from Rule 8 + Rule 9: graduate finding from per-spec annotation to project rule (`.claude/rules/`) when **3 independent occurrences** in distinct contexts. Below 3, keep as spec-local note.

---

## §13. 致谢 / 引用

### 13.1 PR lineage cited

- Phase 2A foundation: PR #13, #14, #15, #18, #20, #21, #22, #25, #28, #32
- Wave 2 Tier 1: PR #39, #43, #48
- Wave 1 finance (5 sub-types): PR #18, #21+#22, #25+#28, #38+#44, #42+#46, #51
- Wave 3 Tier 2 (4 4-mode domains): PR #52+#57 (department), #53+#54+#65 (inventory), #56+#60 (region), #64+#67+#68+#70 (procurement)
- Wave 3 Tier 3: PR #69 (drill-down spec; impl pending)
- Deferral PRs: #37 (quality+production), #45 (preview), #49 (upload), #50 (apply)
- Rule graduation: PR #35 (Rule 8), PR #55 (Rule 9), PR #58 (retroactive sister patches)
- T6 ops kit: PR #59 (design), PR #62 (runbook), PR #66 (baseline tooling)
- Phase 3 cleanup: PR #63
- Backlog map: PR #31 (initial), PR #61 (progress update)
- C1 fix (Rule 2 compliance): PR #30
- Hotfix: PR #23 (cretas_pool GRANT)

### 13.2 Memory entries referenced (cite paths)

- `feedback_subagent_driven_audit_pattern.md` — 4-cycle audit pattern + post-edit grep verify
- `feedback_main_worktree_branch_isolation.md` — main worktree always locked
- `feedback_organizer_projection_bug.md` — verify before dispatch
- `feedback_organizer_marching_order_separation.md` — IMMEDIATE vs QUEUED tagging
- `feedback_organizer_admin_merge_verify.md` — `gh pr view --json files` before admin merge
- `feedback_long_running_branch_rebase_before_squash.md` — fetch + rebase before squash
- `feedback_phase2a_sister_spec_import_audit.md` — grep-verify cited Python imports
- `feedback_concurrent_edit_safety.md` (cross-ref) — Rule 5b commit scope
- `project_apr30_cost_pr_a_ship_plus_3_sister_specs.md` — Wave 1 ship history
- `project_apr30_tool_skill_stays_java.md` — scope lock (Tool-Skill stays Java)
- `project_apr30_phase2a_finance_payable_ship.md` — payable PR-A patterns
- `project_apr30_phase2a_sales_kickoff.md`, `_foundation_ship.md`, `_gold_ship.md` — sales endpoint history

### 13.3 Rules referenced

`.claude/rules/python-java-port.md` — Rules 1-9:
- Rule 1 — `is not None` vs Python `or` for null fallback
- Rule 2 — WEEK period key uses calendar year
- Rule 3 — Python signatures 1:1 mirror Java
- Rule 4 — `_decimal_to_number` for BigDecimal serialization
- Rule 5 — `SELECT *` for shared SQL helpers
- Rule 6 — input boundary None-check (silent zero results)
- Rule 7 — Decimal threshold compare for non-integer thresholds
- Rule 8 — `Map.of(N)` Jackson hash order (PR #35 graduation)
- Rule 9 — Lombok + Jackson serialization quirks (PR #55 graduation)

### 13.4 5-chat coordination

This Phase 2A's 5-chat parallel execution would not have shipped 28 endpoints in 4 days without:
- Each chat's discipline in self-detecting prereq violations and stop-and-pinging
- Each chat's 4-cycle audit rigor on first-of-family specs
- Each chat's `safe-commit.sh` + Rule 5b discipline preventing force-push disasters
- Each chat's worktree isolation from main

The organizer-discipline failures (4 main worktree contamination, 4 projection bugs, 3 marching-order leak) were each rescued by chat-side defense — but the rescue cost was real. Phase 4+ should load these memories at organizer chat start to skip the discipline learning curve.

---

## §14. (Open) Future-Phase candidates the retro identifies

Not for this PR — separate planning effort. Listed here for organizer ledger:

- **Phase 2A drill-down impl** — gated to next session, ~15-25h estimate per backlog map §7.3
- **T6.1-T6.4 execution** — gated on Phase 2A 100% close (drill-down impl ship) + Java 1-week baseline + Python 48h baseline
- **Phase 3.A/B/C cleanup** — gated on T6 stable + Phase 2B soak
- **Deferred-endpoint re-spec triggers** — when Java backend implements real impl for quality/production/preview/upload/apply, dispatch new spec chats per backlog map §2.4
- **`/query` NL→SQL** — Phase 2B AI scope, separate effort

---

**End of retrospective.** This doc is the canonical reference for "how Phase 2A was actually run" — both successes (45 PRs / 4 days / 96.5% scope) and failures (4 organizer projection bugs, 4 worktree contaminations, 1 sister-revert near-miss). Phase 4+ orchestrators should read this before kicking off similar migrations.
