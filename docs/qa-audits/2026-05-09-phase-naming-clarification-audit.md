# Master Plan Phase Naming Clarification Audit

**Date**: 2026-05-09
**Author**: ops chat 2 (master plan naming cleanup)
**Scope**: Doc-only — recommend canonical naming, do NOT rename shipped specs (preserves git history + back-references)
**Trigger**: Handoff doc `2026-05-08-organizer-handoff-audit.md` §1.4 flagged "three rebrands have caused overlap" — formalize as standalone audit so future Phase 2C kickoff chats are not confused.

---

## 0. TL;DR

The Apr 28 master plan defined **4 sequential phases** (Phase 1 → 2 → 3 → 4). Three subsequent rebrands have collided onto the same labels:

- "**Phase 2B**" means TWO different things across shipped docs (Apr 29 vs May 8 PR #152).
- "**Phase 3**" means TWO different things across shipped docs (Apr 28 master plan vs May 2 cleanup design).

This audit proposes a **canonical naming scheme** for going-forward docs while leaving historical specs alone. The recommendation, in one line:

> Rename the May 8 PR #152 "Phase 2B" (= remaining 75 non-analysis SmartBI endpoints) → **"Phase 2C"**, and consolidate "Phase 3 cleanup" usage onto **T6.5** (already shipped in PR #150). The Apr 28 master plan "Phase 3 Tool-Skill migration" was effectively absorbed into "Phase 2B-α/β" (Apr 29 spec).

---

## 1. Background — original Apr 28 master plan

`docs/superpowers/specs/2026-04-28-python-migration-design.md` defined the Java→Python migration as **4 ordered phases**:

```
Phase 1 (LLM client)
   ↓
Phase 3 (Tool-Skill intent system)   ‖   Phase 2 (SmartBI full migration)
                                                     ↓
                                            Phase 4 (Embedding service)
```

| Phase | Original scope | Source |
|---|---|---|
| **Phase 1** | DashScopeClient.java → Python llm_router (4-provider fallback) | §"Phase 1：LLM 客户端迁移" |
| **Phase 2** | SmartBI 全量迁移 (controllers + services + DTOs) | §"Phase 2：SmartBI 全量迁移" |
| **Phase 3** | Tool-Skill 意图系统迁移 (Python intent + Java tool execution) | §"Phase 3：Tool-Skill 意图系统迁移" |
| **Phase 4** | gRPC Embedding service → Python HTTP | §"Phase 4：Embedding 服务迁移" |

**Apr 28 implementation order** (per spec §"实施顺序与依赖"): Phase 1 → Phase 3 → Phase 2 (parallel with Phase 3) → Phase 4.

---

## 2. Naming evolution — three rebrands

### 2.1 Rebrand #1 — Apr 29 (`2026-04-29-phase2b-ai-intent-layer-design.md`)

**What changed**: Renamed "Phase 3 Tool-Skill migration" → "**Phase 2B**" (AI intent layer).

**Why**: The Apr 28 spec lumped all AI intent + Tool-Skill into a single "Phase 3". Brainstorming on Apr 29 split this:
- 402 Tools and 16 Skills **stay Java forever** (per Phase 2A scope lock + memory `project_apr30_tool_skill_stays_java.md`).
- Only the **AI compute layer** (Bucket A: 22-25 files of semantic / classifier / LLM / NLP / RAG / calibration) moves to Python.
- Phase split into **2B-α** (stage 5-8 core: SemanticIntentMatcher, ClassifierIntentMatcher, LlmIntentFallbackClient, etc.) and **2B-β** (complexity router, RAG, NLP, ML learning).

The Apr 29 spec also reserved "**Phase 3 终态**" for "stage 1-4 also搬 Python" + Java legacy cleanup (spec §4.3 / §14). This created a **forward reference** to a different "Phase 3" before the eventual May 2 rebrand.

**Effect**: After Apr 29, "Phase 2B" overloaded — original Apr 28 "Phase 2 SmartBI full migration" still existed but was being decomposed into Phase 2A (analysis byte-shape port) + the rest. "Phase 2B" now also referred to AI intent layer. Future readers conflate them.

### 2.2 Rebrand #2 — May 2 (`2026-05-02-phase3-cleanup-design.md`)

**What changed**: Renamed "**Phase 3**" → post-T6 Java SmartBI Analysis dead-code cleanup (sub-phases 3.A, 3.B, 3.C).

**Why**: After T6 nginx cutover routes 100% of `/api/mobile/{factoryId}/smart-bi/analysis/*` to Python, the corresponding Java implementations become dead code. The May 2 spec defined a 3-step cleanup:
- **3.A** — DashScopeClient SmartBI-path consumer migration (~150-300 LOC deletions)
- **3.B** — SmartBI analysis impl + controller cleanup (~3000-5000 LOC deletions)
- **3.C** — Deprecated flag + config cleanup (~50-100 LOC deletions)

**Effect**: "Phase 3" now means TWO different things in shipped docs:
- Apr 28 master plan "Phase 3" = Tool-Skill intent migration
- May 2 cleanup design "Phase 3" = Java SmartBI Analysis dead-code deletion

These are **disjoint** scopes — neither subsumes the other.

### 2.3 Rebrand #3 — May 8 PR #152 (`2026-05-15-phase2b-port-pipeline-scoping-spec.md`)

**What changed**: Reused "**Phase 2B**" label for **remaining 75 non-analysis SmartBI endpoints** (Config / Dashboard / Upload / PublicDemo controllers).

**Why**: After T6.5 (PR #150) deletes the Java SmartBI **analysis** layer, the next migration target is the **non-analysis** SmartBI controllers. The PR #152 author called this "Phase 2B" to position it as a sequel to "Phase 2A" (which was the analysis byte-shape port).

**Effect**: "Phase 2B" now means TWO different things in shipped docs:
- Apr 29 AI intent layer spec "Phase 2B" = AI compute layer migration (= original Apr 28 "Phase 3")
- May 8 PR #152 "Phase 2B" = remaining 75 non-analysis SmartBI endpoints (= subset of original Apr 28 "Phase 2")

These are **disjoint** scopes. The Apr 29 "Phase 2B-α" is **already DONE** (commit `38b545d0c` PR #16 foundation merge gate). The May 8 "Phase 2B" is **0% started** (kickoff ~July 2026).

---

## 3. Conflict matrix — which doc means what

### 3.1 "Phase 2B" — overloaded between two scopes

| Source doc | Means | Status |
|---|---|---|
| `2026-04-29-phase2b-ai-intent-layer-design.md` (PR pre-merge spec) | AI intent layer migration (= original Apr 28 Phase 3) | ✅ Phase 2B-α DONE (PR #16); Phase 2B-β extensions |
| `2026-04-29-phase2b-alpha-implementation-plan.md` (plan) | Same as above (-α subset) | ✅ DONE |
| `2026-04-30-phase2b-beta-implementation-plan.md` (plan) | Same as above (-β subset) | Status verify needed |
| Commit `38b545d0c` (PR #16 squash) | "Phase 2B-α: AI intent matching pipeline migration to Python" | ✅ Merged |
| Commit `2d8a8a272` PR #19 | "Phase 2B-α backlog" follow-ups | ✅ Merged |
| Commits `b395aad4c` PR #78, `b2f12bba7` PR #77, `6ec37ddfb` PR #76, etc. | Phase 2B prefix used for AI intent rollout (canary, metrics, flag flip) | ✅ Merged |
| `2026-05-15-phase2b-port-pipeline-scoping-spec.md` (PR #152) | Remaining 75 non-analysis SmartBI endpoints (= subset of original Apr 28 Phase 2) | ⏸️ Spec only, kickoff ~July 2026 |
| Commit `8b88dbb9b` (PR #152 squash) | "spec(phase2b): port pipeline scoping — 75 endpoints / 4-tier sequencing" | Same as above |
| `2026-05-08-organizer-handoff-audit.md` §1.4 | Flags this conflict; recommends "Phase 2C" rename | Doc-only flag |

**Reading rule for the period Apr 29 → May 7**: "Phase 2B" = AI intent.
**Reading rule for May 8 forward (post-PR #152)**: ambiguous — must check doc context.

### 3.2 "Phase 3" — overloaded between two scopes

| Source doc | Means | Status |
|---|---|---|
| `2026-04-28-python-migration-design.md` | Tool-Skill intent system migration | Renamed "Phase 2B" by Apr 29 spec; original "Phase 3" label vacated |
| `2026-04-29-phase2b-ai-intent-layer-design.md` §4.3 §14 | "Phase 3 终态" — stage 1-4 also搬 Python + Java legacy 删 (~30-40h cleanup) | Forward reference, partially absorbed into May 2 cleanup spec |
| `2026-05-01-phase3-ai-migration-rollout.md` (plan, PR #29) | Phase 3 high-level rollout (flag flip + soak + kill switch + Phase 3.A/B/C cleanup roadmap) | Plan doc, references both AI rollout AND cleanup |
| `2026-05-02-phase3-cleanup-design.md` (PR #63) | Post-T6 Java SmartBI Analysis dead-code deletion (3.A/B/C) | ⏸️ Spec ready, superseded by T6.5 (PR #150) |
| Commit `b395aad4c` (PR #78) | "phase3a" prefix used: "migrate SmartBI-path DashScopeClient consumers to PythonLLMClient" | ✅ Merged — this is May 2 cleanup design Phase 3.A executed |
| `2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (PR #150) | T6.5 4-phase cleanup (A/B/C/D, ~58 days) | ⏸️ Spec ready — supersedes May 2 "Phase 3 cleanup" naming |
| `2026-05-15-phase2b-port-pipeline-scoping-spec.md` (PR #152) | References "Phase 3+" for strict-byte adoption | Forward reference, separate scope |
| `2026-05-08-organizer-handoff-audit.md` §1.4 | Flags conflict; "Phase 3" used for both T6.5 cleanup AND original Tool-Skill migration | Doc-only flag |

**Reading rule for "Phase 3"**:
- If the doc was written before May 2 → likely Apr 28 "Tool-Skill intent migration" (now == "Phase 2B-α/β")
- If the doc was written May 2 onward → likely "post-T6 cleanup" (now == "T6.5")
- "Phase 3+" in May 8 PR #152 → strict-byte adoption far-forward (separate)

### 3.3 Naming conflicts at-a-glance

```
APR 28 "Phase 3" Tool-Skill ──────────► APR 29 "Phase 2B-α/β" AI intent ──► ✅ DONE
                                                              │
                                                              └──► §4.3 "Phase 3 终态" forward reference

APR 28 "Phase 2" SmartBI 全量 ────────► APR 30+ split:
                                          ├── "Phase 2A" Analysis byte-shape port ──► 🔄 ~96% (T6.4 in flight)
                                          └── "Phase 2-rest" = MAY 8 PR #152 "Phase 2B" ──► ⏸️ 0%
                                                                                              ▲
                                                                                              └── conflicts w/ APR 29 "Phase 2B" AI intent

MAY 2 "Phase 3 cleanup" ──────────────► MAY 8 PR #150 "T6.5" ──► ⏸️ Spec ready
                                          ▲
                                          └── conflicts w/ APR 28 "Phase 3"

APR 28 "Phase 4" Embedding ───────────► ⏸️ DEFERRED indefinitely (Apr 29 §2 decision: keep Java gRPC)
```

---

## 4. Recommended canonical naming (going forward)

### 4.1 Canonical scheme

| Canonical name | Means | Status (2026-05-09) |
|---|---|---|
| **Phase 1** | LLM client migration (DashScopeClient → Python llm_router + 38 caller shim) | ✅ **DONE** Apr 28-29 |
| **Phase 2A** | SmartBI **Analysis** byte-shape port (50 endpoints) | 🔄 **~96%** — T6.1-T6.3 cutover done, T6.4 stages May 10-14, T6.5 cleanup ~July 2026 |
| **Phase 2B-α** | AI intent matching pipeline (stage 5-8 + Bucket A core 11 files) | ✅ **DONE** PR #16 (`38b545d0c`) |
| **Phase 2B-β** | AI intent extensions (RAG / NLP / complexity router / ML learning, ~11-14 files) | ⚠️ **Status verify needed** — plan doc shipped, impl status not confirmed in this audit |
| **Phase 2C** *(rename)* | SmartBI **non-analysis** endpoints (Config / Dashboard / Upload / PublicDemo, 75 endpoints) | ⏸️ **0%** — spec ready (PR #152 → currently labeled "Phase 2B"), kickoff ~July 2026 (gated T6.5 Phase C) |
| **Phase 3** *(canonical)* | Post-T6 Java SmartBI **Analysis** dead-code cleanup (= T6.5 from PR #150) | ⏸️ **Spec ready** — 4 phases A/B/C/D, ~58 days, triggers after T6.4 100% GO + 14d dead-time verify |
| **Phase 3+** | Strict-byte gate adoption (case-by-case post-Phase-2A; Phase 2B-tier hybrid; far-forward) | Decision doc shipped (PR #153) |
| **Phase 4** | gRPC Embedding service migration | ⏸️ **DEFERRED indefinitely** (Apr 29 §2 decision: keep Java gRPC, Python calls it) |

### 4.2 Rationale for the canonical scheme

1. **Phase 2C (rename of May 8 "Phase 2B")** — disambiguates from Apr 29 "Phase 2B-α/β" (AI intent, already DONE). Clarifies that 75 non-analysis endpoints follow Phase 2A in *scope* (SmartBI subset) but are sequenced *after* AI intent (which is 2B). "Phase 2C" puts it at the right slot in the hierarchy.

2. **Phase 3 = T6.5** — consolidates the May 2 "Phase 3 cleanup" naming onto the more specific "T6.5" label (PR #150). Frees up "Phase 3" for its canonical Apr 28 master-plan slot, which is now empty since AI intent absorbed into "Phase 2B-α/β". Net effect: "Phase 3" becomes the natural label for post-Phase 2 cleanup, which T6.5 already is.

3. **Apr 28 "Phase 3" Tool-Skill migration** — historically dissolved. The "AI compute layer" subset went to Phase 2B-α/β (DONE). The Tool/Skill execution layer stays Java forever (per Phase 2A scope lock memory `project_apr30_tool_skill_stays_java.md`). No future "Phase 3 Tool-Skill migration" will happen — the original Apr 28 framing was superseded.

4. **Phase 4 deferral preserved** — Apr 29 §2 explicitly chose to keep Java gRPC :9090. Python calls it. This is unchanged.

### 4.3 Why not rename existing shipped docs?

- **git history preservation**: shipped specs at canonical paths like `2026-05-15-phase2b-port-pipeline-scoping-spec.md` are referenced in commit messages, PR descriptions, memory entries, and future cross-references. Renaming the file breaks all those.
- **Doc immutability principle**: shipped specs are historical artifacts. Even when a label is later confusing, the spec accurately represents the author's intent at write time.
- **Cross-reference preservation**: handoff docs, retrospectives, and future plans cite specs by filename. Mass-renaming creates churn without correcting reader confusion.

The audit recommendation is therefore **canonical naming for FUTURE docs only** — shipped specs stay at their current paths and labels.

---

## 5. Action plan — going forward

### 5.1 Immediate (no code/file changes; convention only)

- **Future spec authors**: when starting a new spec doc, use the canonical names from §4.1.
- **Future marching orders**: when referencing a phase, use the canonical name and add a parenthetical disambiguation: e.g. "Phase 2C (= former 'Phase 2B' per PR #152 spec)" or "Phase 3 (= T6.5 per PR #150 spec)".
- **Memory entries**: when adding new memory entries about migration progress, use canonical names.

### 5.2 When the May 8 "Phase 2B" actually kicks off (~July 2026)

The kickoff chat for the 75 non-analysis SmartBI endpoints port should:

1. **Open a new spec / kickoff doc** under the canonical "Phase 2C" name (e.g. `2026-07-XX-phase2c-non-analysis-port-kickoff.md`).
2. **Reference PR #152** as the predecessor scoping spec, with a note like: "Predecessor: `2026-05-15-phase2b-port-pipeline-scoping-spec.md` PR #152 (originally labeled 'Phase 2B' per Apr 30 multi-rebrand era; renamed to 'Phase 2C' per audit `2026-05-09-phase-naming-clarification-audit.md`)."
3. **Update Phase 2C kickoff handoff doc** to use "Phase 2C" label consistently.
4. **Leave PR #152 spec content alone** — its body stays as-is. Only the kickoff successor doc adopts the new name.

### 5.3 When T6.5 Phase A actually kicks off (~mid-May 2026)

The T6.5 execution chat should:

1. **Use "T6.5" as the primary label** in marching orders, dispatch docs, and handoff snapshots.
2. **Reference PR #150** as the source spec.
3. **Note the May 2 "Phase 3 cleanup" predecessor** in the kickoff doc — if a reader finds `2026-05-02-phase3-cleanup-design.md` they should understand T6.5 supersedes it.

### 5.4 Index doc (optional, low-priority)

If the reader confusion persists, consider adding a small canonical-naming index doc under `docs/superpowers/specs/2026-05-XX-phase-naming-canonical-index.md`. This audit can serve that purpose for now.

---

## 6. Cross-reference — every shipped doc + memory entry referencing each Phase

This is **methodology + concrete examples**, not exhaustive (full grep is straightforward via `git grep`).

### 6.1 Phase 1 references

Apr 28 master plan §"Phase 1：LLM 客户端迁移". Largely settled — no rebrands. Search: `git grep -l "Phase 1" docs/`. Memory: any project memory referring to LLM client migration is Phase 1.

### 6.2 Phase 2A references

Major shipped artifacts:
- `2026-04-30-cost-pr-a-design.md` and ~20 sister specs (per-domain analysis port designs)
- `2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (PR #150 — the Phase 2A cleanup follow-up)
- `MEMORY.md` Phase 2A entries (May 7-8 cluster of 50+ entries)
- Commit search: `git log --grep="phase2a"` returns the PR #16 → #149 chain
- Status verify: per handoff doc §1.5, Phase 2A is ~96% (T6.4 stages May 10-14)

### 6.3 Phase 2B (Apr 29 AI intent layer = canonical "Phase 2B-α/β")

Major shipped artifacts:
- `2026-04-29-phase2b-ai-intent-layer-design.md` (the spec)
- `2026-04-29-phase2b-alpha-implementation-plan.md`
- `2026-04-30-phase2b-beta-implementation-plan.md`
- Commits with prefix `phase2b` from late April through early May (38 squash commits per handoff doc PR list)
- PR #16 foundation merge gate (commit `38b545d0c`)
- Memory: `feedback_phase2a_db_wiring_blocker.md`, `project_2026_05_05_t6_resumption.md`, `reference_embedding_model_collapse.md`

### 6.4 Phase 2B (May 8 PR #152 non-analysis endpoints = canonical "Phase 2C")

Major shipped artifacts:
- `2026-05-15-phase2b-port-pipeline-scoping-spec.md` (PR #152, commit `8b88dbb9b`)
- Commit `5036bee00` (predecessor spec draft)
- Memory: May 8 entries flagging this as predecessor / Phase 2A → 2B handoff

### 6.5 Phase 3 (Apr 28 master plan Tool-Skill = absorbed into Phase 2B-α/β)

Historical only:
- `2026-04-28-python-migration-design.md` §"Phase 3：Tool-Skill 意图系统迁移"
- Apr 29 spec §1.6 documents the absorption + Tool/Skill stays Java decision
- Memory `project_apr30_tool_skill_stays_java.md`

### 6.6 Phase 3 (May 2 cleanup design = canonical "T6.5")

Major shipped artifacts:
- `2026-05-02-phase3-cleanup-design.md` (PR #63, commit `e5de718e1`)
- `2026-05-01-phase3-ai-migration-rollout.md` (PR #29) — partial overlap (rollout + cleanup roadmap)
- `2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (PR #150, commit `cf8cc48e8`) — supersedes
- Commit `b395aad4c` (PR #78 — Phase 3.A executed: SmartBI-path DashScopeClient migration)

### 6.7 Phase 4 references

- `2026-04-28-python-migration-design.md` §"Phase 4：Embedding 服务迁移"
- `2026-04-29-phase2b-ai-intent-layer-design.md` §2 (decision to keep Java gRPC)
- Status: deferred indefinitely; no kickoff planned

---

## 7. Out of scope (this audit does NOT address)

- **Renaming actual file paths** in shipped specs — preserves git history per §4.3.
- **Modifying body content of shipped specs** — historical artifacts.
- **Rewriting commit messages** — would require force-push, violates safety norms.
- **MEMORY.md entry content updates** — those reflect time-of-write context; future entries adopt canonical names.
- **Marching order template changes** — left to future organizer convention.

---

## 8. Status

This is a doc-only audit. Action items:

- [ ] Future Phase 2C kickoff chat reads §5.2 and adopts canonical naming.
- [ ] Future T6.5 execution chat reads §5.3 and adopts canonical naming.
- [ ] Optional: a separate "phase naming canonical index" spec doc could supplement this audit if confusion persists across more than 1-2 future kickoffs.

**Author note**: this audit complements the handoff doc `2026-05-08-organizer-handoff-audit.md` §1.4 by providing the full rationale + cross-reference + action plan that a 4-line table cannot fit.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
