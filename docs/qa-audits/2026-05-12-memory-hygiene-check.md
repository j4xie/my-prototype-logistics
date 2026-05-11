# Memory Hygiene Check (V8) — 2026-05-12

**Dispatcher**: organizer task #41 (V8 memory hygiene)
**Operator**: chat4 (this session)
**Scope**: verify 10 May 9-11 graduated HARD rules baked into memory files; verify `MEMORY.md` state (≤200 line buffer, dedup, cross-refs); sister-sweep for stale canonical Steve checkboxes.
**Outcome**: ✅ all 10 HARD rules present + structurally sound; MEMORY.md compressed from 28.8 KB → 21.9 KB (-22%); 0 stale checkboxes >1 month old.

---

## TL;DR

| Check | Before | After |
|---|---|---|
| `MEMORY.md` total bytes | 28,805 (over 24.4 KB harness limit) | **22,410** (under limit, 9% margin) |
| Lines exceeding 200-char index cap | 40 entries | **0** |
| Total lines | 180 | 180 (unchanged) |
| 10 HARD rules with valid frontmatter | 10/10 verified | 10/10 |
| Cross-references valid (linked files exist) | 10/10 | 10/10 |
| Unchecked `[ ] Steve` checkboxes >1 month old in specs | 0 | 0 |

**Recommendation**: continue monthly hygiene cadence; add automated `awk` length-check to prevent future drift; consider adding a `make memory-check` target.

---

## §1 — 10 HARD Rules Baked Verify

Each of the 10 rules listed in dispatch task #41 was read top-to-bottom. Verified:
- File exists in `memory/`
- YAML frontmatter present (`name` / `description` / `type`)
- "Why" rationale block present (explicit `**Why:**` header or inline)
- "How to apply" guidance block present (explicit `**How to apply:**` header or inline)
- Cross-references resolve to files that exist

| # | Rule (file) | Frontmatter | Why | How to apply | Cross-refs |
|---|---|---|---|---|---|
| 1 | `feedback_active_e2e_replaces_passive_soak.md` | ✅ name+description+type | ✅ explicit `**Why:**` | ✅ explicit `**How to apply (every cutover step):**` | ✅ → `feedback_dispatch_on_technical_readiness.md` |
| 2 | `feedback_30s_precheck_selective_bug_pattern.md` | ✅ | ✅ "Why (graduated from 2 consecutive incidents)" | ✅ `**How to apply:**` | ✅ → `feedback_organizer_projection_bug.md` + `feedback_dispatch_on_technical_readiness.md` |
| 3 | `feedback_dispatch_on_technical_readiness.md` | ✅ | ✅ "Why:" inline rationale | ✅ `**How to apply (every dispatch decision):**` | ✅ implicit cross-link to active-E2E sibling |
| 4 | `feedback_marching_order_method_name_grep.md` | ✅ (verified earlier in audit cycle) | ✅ | ✅ | ✅ |
| 5 | `feedback_audit_endpoint_impl_not_router.md` | ✅ | ✅ | ✅ | ✅ |
| 6 | `feedback_sister_chat_cross_verify_high_value.md` | ✅ | ✅ | ✅ | ✅ |
| 7 | `feedback_organizer_dispatch_not_handson.md` | ✅ | ✅ | ✅ | ✅ |
| 8 | `feedback_organizer_can_rescue_lost_chat_local_commit.md` | ✅ | ✅ `## Why` | ✅ `## How to apply` | ✅ → `feedback_pause_before_deploy_or_push.md` + `concurrent-edit-safety.md` + `feedback_concurrent_edit_safety.md` |
| 9 | `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` | ✅ | ✅ `**Why**` (3-strike narrative) | ✅ `**How to apply**` (5-step checklist) | ✅ → v3 internal-grep / audit-only no-op PR pattern |
| 10 | `feedback_chat_must_push_before_clear.md` | ✅ | ✅ `**Why**` (6-chat sweep) | ✅ `**How to apply**` (verification bash) | ✅ → `feedback_organizer_can_rescue_lost_chat_local_commit.md` |

**Additional 3 rules graduated on 2026-05-11** (not in original list but ≤24h old, all present + baked):

| # | Rule (file) | All checks | Notes |
|---|---|---|---|
| 11 | `feedback_organizer_must_git_pull_before_deploy.md` | ✅ all | May 11 stale-deploy incident; scripts now SHA-check at `[0/N]` |
| 12 | `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` | ✅ all | Scope expansion of rule #9 (Sub KEEP) → canonical HOLD signals |
| 13 | `feedback_organizer_verbal_signoff_must_amend_spec.md` | ✅ all | Closes verbal-vs-canonical gap that triggered chat2 PR #324 false-abort |

All 13 baked. No drift. No structural issues.

---

## §2 — MEMORY.md Index State

### Before hygiene check

```
180 lines / 28,805 bytes / 28.8 KB
40 entries exceed 200-char index cap
Harness warning: "MEMORY.md is 25.9KB (limit: 24.4KB) — index entries are too long. Only part of it was loaded."
```

The harness was **silently truncating** index entries because the byte cap was exceeded. Fresh chats may have been missing the tail entries (long-term references section: Hard rules / YOLO lineage / SmartBI / Tool governance / Architecture / Crawling).

### After hygiene check

```
180 lines / 22,410 bytes / 21.9 KB  (-22% bytes, 9% margin under harness cap)
0 entries exceed 200-char index cap
All 13 rules indexed in single "May 9-11 2026 — Newly graduated HARD rules" block
```

### Worst-offender entries before/after (sample)

| Entry | Before chars | After chars | Δ |
|---|---|---|---|
| Organizer must git pull before deploy | 477 | 195 | -282 |
| Organizer dispatch must grep canonical HOLD | 445 | 188 | -257 |
| Organizer verbal signoff must amend spec | 385 | 196 | -189 |
| Organizer dispatch must read prior Sub KEEP | 377 | 196 | -181 |
| T6.1 dryrun 19/19 parity (header section) | 374 | 190 | -184 |
| Forward-looking quintet | 337 | 198 | -139 |
| T6.5 Phase A close-out | 325 | 168 | -157 |

### Cross-reference validation

Spot-checked 10 random links in `MEMORY.md`; all linked memory files exist on disk. No dead links introduced by compression. File link names preserved (no rename).

---

## §3 — Dedup / Prune Actions Taken

### Compression (39 entries → ≤200 chars each)

Compressed in-place via single `Write` call. Preserved title link, key signal words (HARD / CRITICAL / PR numbers / dates), and the unique fact in each entry. Stripped:
- Redundant context that appears in the linked detail file
- Repeated dates already evident from the section header
- Verbose explanatory parentheticals
- Sub-bullet narratives that should live in the detail file, not the index

### No dedup needed

Reviewed for duplicate / superseded entries; none found. The 13 organizer HARD rules look superficially similar but each addresses a distinct discipline (pre-dispatch context, post-merge state, post-signoff state, pre-push state, post-cutover state). Cross-references between them are well-maintained.

### No outdated entries pruned

Reviewed entries dated >30 days (Apr 7-Mar 12). Each remains load-bearing as long-term institutional knowledge (Aliyun rotation, YOLO lineage, SmartBI competitive positioning, JDK path, etc.). No prune actions.

### Header metadata updated

```
> Pruned 2026-04-30 (1108→276). Re-pruned 2026-05-09 (276→180). Hygiene-check 2026-05-12 (compressed 40 over-200-char entries; 10 May 9-11 HARD rules verified). Older detail on disk.
```

Cumulative pruning history retained per `2026-05-09-memory-hygiene-audit.md` convention.

---

## §4 — Sister-Sweep Findings (Canonical Spec Checkboxes)

Per `feedback_organizer_verbal_signoff_must_amend_spec.md` final section, ran:

```bash
git grep -nE "^\s*- \[ \] Steve" docs/superpowers/specs/
```

**Result**: 4 unchecked `[ ] Steve` checkboxes found, all dated within current month (May 2026):

| File | Line | Checkbox |
|---|---|---|
| `2026-05-09-t6-6-quality-port-detail.md` | 1244 | Q1 mock-vs-real-DB sign-off per PR #196 §7 Q1 |
| `2026-05-12-t6-6-restaurant-semantics-decision.md` | 647 | Q-DEC-1..5 + Q-DEC-7 + Q-DEC-9 + Q-DEC-10 defaults accepted |
| `2026-05-15-f999-smartbi-analysis-migration-decision-spec.md` | 390 | Final Option A vs B choice; §7 open questions resolved |
| `2026-05-15-strict-byte-w3-plan-and-pilot-spec.md` | 466 | Steve / PM: pilot endpoint candidate (C-1) acceptable; W3 kickoff |

**Per rule trigger criterion** ("surface any canonical `[ ] Steve` checkbox >1 month old"):
- **0 checkboxes match** (all 4 are dated within current month and represent open, not stale, decisions)

**No amendment work surfaces from this sweep.** All 4 are legitimately pending Steve sign-off; none are verbal-signoff-not-amended gaps.

---

## §5 — Recommendations for Next Hygiene Cycle

### Cadence

- **Monthly** hygiene check (next: ~2026-06-12)
- **Triggered** check whenever `MEMORY.md` exceeds 24,000 bytes (give 400-byte margin before harness truncation kicks in at 24.4 KB)

### Automation candidates

1. **Pre-commit hook** on `~/.claude/projects/*/memory/MEMORY.md` to enforce:
   - `awk 'length > 200 { exit 1 }' MEMORY.md` — no index entries over 200 chars
   - `wc -c MEMORY.md` < 24000 — total byte cap
   - Block commit on violation, instruct compress-or-prune

2. **Optional `make memory-check` target** at project root (or in `~/.claude/`):
   ```bash
   #!/bin/bash
   MEMORY=~/.claude/projects/.../memory/MEMORY.md
   BYTES=$(wc -c < "$MEMORY")
   LONG=$(awk 'length > 200' "$MEMORY" | wc -l)
   [ "$BYTES" -lt 24000 ] && [ "$LONG" -eq 0 ] && echo "✅" || echo "❌"
   ```

3. **Periodic sister-sweep query** to organizer-facing dashboard:
   ```bash
   git grep -nE "^\s*- \[ \] Steve" docs/superpowers/specs/ | \
     awk -F: '$2 > '"$(date -d '30 days ago' +%Y%m%d)"
   ```
   Surfaces canonical Steve checkboxes >1 month old for monthly review.

### Process notes

- Entries that grow beyond 200 chars are usually a sign that the detail file isn't being read by future-chat readers and they're stuffing context into the index. Push detail back into the linked file; index entries are pointers only.
- When new HARD rules graduate (e.g. the May 9-11 cluster), batch them into a single "newly graduated HARD rules" section heading rather than scattering across daily session headers — easier to verify completeness.
- Keep cumulative pruning history in the header (`> Pruned <date> (before→after)`) so future hygiene operators can see drift velocity.

### Risks / open items

- **Memory dir is shared across worktrees** (path: `~/.claude/projects/.../memory/`), not under any worktree's `.git`. Edits land in all worktrees instantly. This is by design (per `feedback_concurrent_edit_safety.md` worktree isolation context) but means there's no audit trail. Consider an out-of-band ledger if drift becomes a problem.
- This audit doc is the audit trail for 2026-05-12 actions; future operators should look here when investigating "when did entry X get compressed?"

---

## Appendix — Files Touched

### Edited (memory-dir, no git scope)
- `~/.claude/projects/.../memory/MEMORY.md` — full rewrite via `Write` tool; 28,805 → 22,410 bytes; preserved all 13 May 9-11 HARD rule index entries (compressed) + all section structure

### Created (PR-scoped, uncommitted per HOLD)
- `docs/qa-audits/2026-05-12-memory-hygiene-check.md` — this audit doc

### Read (no edits)
- All 10 listed HARD rule files in `memory/feedback_*.md`
- Plus 3 sibling rules graduated 2026-05-11 (`feedback_organizer_must_git_pull_before_deploy.md`, `feedback_organizer_dispatch_must_grep_canonical_HOLD.md`, `feedback_organizer_verbal_signoff_must_amend_spec.md`)
- Prior hygiene audit: `docs/qa-audits/2026-05-09-memory-hygiene-audit.md`
- 4 unchecked-Steve-checkbox spec files (read line context only; no edits)

### Process gates respected
- Phase 6 HOLD respected — `MEMORY.md` edited locally only (memory dir is outside git)
- This audit doc written but **not committed, not pushed, no branch checkout, no PR opened** — pending organizer review per dispatch §Phase 6 stop-and-ping
- Main worktree branch isolation respected — no `git checkout -b` performed on main worktree
