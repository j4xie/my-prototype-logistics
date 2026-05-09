# T6.6 Endpoint Detail Specs — Cross-PR Consistency Audit

**Date**: 2026-05-09
**Scope**: PR #199 (production) + PR #203 (quality) + PR #202 (query) + PR #204 (drill-down)
**Status**: All 4 PRs MERGED. This audit verifies cross-references / scope boundaries / shared-helper assumptions are mutually consistent before T6.6 Phase B kickoff (~Aug 2026).
**Verdict**: 4 inconsistencies found, all minor / non-blocking. None require PR re-open. Recommendations §6 should land as a small follow-up doc OR be incorporated into T6.6 Phase B kickoff marching order.

---

## §0 PR Snapshot

| PR | Endpoint | Spec file | LOC | Effort claim | Helper deps |
|---|---|---|---|---|---|
| #199 | `/analysis/production` | specs/2026-05-09-t6-6-production-port-detail.md | 548 | 1.5-2d | `_java_string_hashcode` + `_JavaRandom` (~60 LOC, NEW) |
| #203 | `/analysis/quality` | specs/2026-05-09-t6-6-quality-port-detail.md | 1248 | 2d (PR-A 1.5 + PR-B 0.5) | Same `JavaRandom` (~80 LOC est, NEW) + `_format_decimal_half_up` (existing) + `_format_currency_java` (NEW) + `_java_hashmap_iter_order` (NEW) |
| #202 | `/query` | specs/2026-05-09-t6-6-query-port-detail.md | 993 | 9d (7 core + 2 buffer) | `_jackson_indent_compat` (NEW), reuses Phase 2A `analysis_*.py` modules. **No Random usage.** |
| #204 | `/drill-down` | qa-audits/2026-05-09-t6-6-drilldown-parity-verify.md | 269 | ~0d (existing impl) + future T6.6 cutover MO (deferred) | None new — Python impl already shipped Phase 2A (`analysis_drilldown.py` 747 LOC, May 2 2026) |

---

## §1 JavaRandom Helper Coordination

### Finding: helper-location + sharing-scope claim mismatch.

**PR #199 §3 (production)** claims:
> `_java_string_hashcode` + `_JavaRandom` belong in `intent/java_random.py` per PR #196 §2.2 — **shared with `/query` rule engine**.

**PR #202 (query, this audit author's spec)**: traces full SmartBIIntentServiceImpl + 5 EntityRecognizer + processQuery surface. **NO `Random` / `Math.random` / nondeterministic source identified anywhere in `/query` Java code path.** /query is pure Trie + regex + keyword + entity-aware boost — entirely deterministic given input string + dictionary state.

**PR #203 §8.9 (quality)** says coordinator approach:
> Chat N (quality) PR-A lands JavaRandom; Chat M (production) imports post-merge.

**Inconsistency**: PR #199's "shared with /query rule engine" claim is unsupported. The helper has 2 real consumers (production mock generator + quality mock generator), NOT 3. The proposed `intent/java_random.py` path implies /query co-ownership which is incorrect.

### Recommendation

| Option | Path | Pros | Cons |
|---|---|---|---|
| **R1.A (recommend)** | `backend/python/smartbi_compat/_java_random.py` | Co-located with existing `_java_compat.py` (already houses `_format_decimal_half_up` + Phase 2A helpers). Honest about scope: 2 mock consumers. | Different from PR #199's stated path. Both production + quality specs need a one-line addendum. |
| R1.B | `backend/python/smartbi_compat/mock/_java_random.py` | Sub-namespace flags "this is for mock generators only". | Adds a directory for 1 file. |
| R1.C (PR #199's proposed) | `backend/python/smartbi_compat/intent/java_random.py` | Matches PR #199's pin. | Misleading: implies /query rule engine consumes it. |

**Recommended pin: R1.A**. Phase B kickoff marching order should specify the path explicitly so production-impl-chat and quality-impl-chat both write the same import line on Day 1.

### Coordination chat ownership

PR #199 says coordinate with "Chat C (/query owner)". PR #203 says coordinator order is "Chat N → Chat M". These reference different chat slots. Phase B kickoff marching order should resolve: **first-merger lands the helper, second-merger imports**. Recommend Chat N (quality) lands first per PR #203 §8.9, since quality's spec is the more thorough of the two on JavaRandom semantics (PR #203 §3 documented bitwise verification gates `T-MOCK-1 + T-MOCK-2`).

---

## §2 Effort Sum vs PR #196 Ceiling

### Sum

| PR | Effort claim | Notes |
|---|---|---|
| #199 production | 1.5-2d | Matches PR #196 §3.1 estimate |
| #203 quality | 2d | Matches PR #196 §3.2 post-Phase-A revised estimate (was 2-3d pre-discovery) |
| #202 query | **9d** (7 core + 2 buffer) | **Up from PR #196 §3.3 "5-7d"** — refined by full Java surface trace |
| #204 drill-down | 0.5-1d (PR #196 §3.4) → ~0d actual (existing impl) | Synthesis path collapsed via Phase 2A pre-shipment |
| **Total** | **13-14d** (#199 + #203 + #202 + #204 minimal) | |

PR #196 §0 overall estimate: **8.5-12d** (10-15 → revised down).

### Variance

13-14d > 12d ceiling by **+1 to +2 days**, dominantly from #202's 9d-firm vs #196's 5-7d. Drill-down's 0.5-1d → ~0d savings partially offset.

### Is the variance justified?

**Yes.** PR #202 §0 documents 4 discoveries (D1-D4) refining PR #196 estimates:
- D1: existing `query_intent_extractor.py` is NOT the predecessor → adds NEW intent_recognizer.py (~450 LOC).
- D2: `executeIntent` default branch falls to Tool-Skill — Python skips → mirrors as 400 error (small simplification).
- D3: ConversationMemoryService not Python-ported → no-op pass-through (small simplification).
- D4: `ai_intent_configs` table read works via existing wiring (no new DB work).

**PR #196 §3.3 estimate was 5-7d before full Java surface trace.** The `2400 LOC of EntityRecognizer + Trie infrastructure` portion of /query was underestimated in PR #196 — that single chunk now claimed at 2.0d in PR #202 §9 already exceeds half of PR #196's 5d floor. The 9d-firm refinement is internally consistent with the spec content.

### Recommendation

**Update PR #196 §0 overall estimate to 13-14d.** Add a note linking PR #202 §9 day-by-day breakdown as the source of refined `/query` figure.

Alternative: add a 1-line addendum to PR #196 closer ("Phase B post-detail-spec recalibration: 13-14d"). PR #196 is merged; can land as a follow-up note in `docs/superpowers/specs/`.

---

## §3 Dependency Graph — Hidden Couplings

### Endpoint-level

| Endpoint | Dispatches into | Imports from | Imports into |
|---|---|---|---|
| `/analysis/production` | (mock generator self-contained) | `_java_random.py` (NEW), `_java_compat.py` | (none) |
| `/analysis/quality` | (mock generator self-contained) | `_java_random.py` (NEW), `_java_compat.py` | (none) |
| `/query` | `analysis_drilldown.py` (via DRILL_DOWN intent), `analysis_finance.py` / `analysis_sales.py` / etc (15 cases) | All 14 Phase 2A `analysis_*.py` modules (existing) | (none) |
| `/drill-down` | (self-contained, queries DB) | (none new) | (used by /query DRILL_DOWN intent) |

### Hidden coupling found

**`/query` → `/drill-down` import dependency**: PR #202 §1.3 dispatch table line `DRILL_DOWN | analysis_drilldown._process_drill_down`. /query Phase B impl IMPORTS the existing drill-down Python module (already shipped Phase 2A per PR #204). **NOT a blocker** — drill-down is on `main` already. But Phase B impl chat for /query should be told: "drill-down dispatch reuses analysis_drilldown.py — verify import works in Day 1 smoke."

**No other hidden dependencies.** Production / quality / drill-down are pairwise independent. Query depends on drill-down (already satisfied) + 13 other Phase 2A modules (all already shipped).

### Recommendation

Phase B kickoff marching order for /query impl chat should include §1.3 dispatch table verbatim with a one-line note: "All 15 dispatch targets already exist in `smartbi_compat/api/`. Import smoke = Day 1 sanity check."

---

## §4 nginx Regex Update Coordination

### Finding: PR #204 explicit batch coordination; production + quality + query implicit.

**PR #204 §7 GO criteria** explicitly defers nginx flip to coordinated batch:
> Pre-cutover (T6.6 Phase B): Steve GO on coordinating with 3 sibling NOT_SAFE_FALLTHROUGH endpoints (`/query`, `/analysis/production`, `/analysis/quality`) per PR #196 §6.

PR #199 / PR #203 do NOT explicitly mention nginx coordination — focused on Python impl. PR #202 §8.7 mentions nginx routing for restaurant-keyword splitting (Q-A) but does not specify the batch nature of the cutover.

**No conflict** — PR #204's deferral is the authoritative signal. T6.6 cutover MO will batch all 4 nginx route additions.

### Recommendation

T6.6 Phase B cutover MO (drafted post-impl) must enumerate all 4 nginx path additions in one transaction. Pattern: T6.4 5-stage cascade. Pre-flight: 4 paths × `nginx -t`. Post-flip: 4 path × smoke. Rollback: single-vhost-backup-restore (per PR #204 §7 batched).

---

## §5 Q1 Mock-Parity Sign-off Scope

### Finding: Q1 explicitly applies to production + quality only.

PR #199 §10 / PR #203 test plan: "Q1 mock-parity sign-off from Steve required". Q1 origin is **PR #196 §7 Q1**: "Production / Quality mock-vs-real-DB decision (default: keep mock parity per Phase 2A standard; real-DB upgrade triples T6.6 effort to ~20d)".

PR #202 (query) and PR #204 (drill-down) are **NOT mock**:
- /query rule engine reads real `ai_intent_configs` table + real entity dictionaries.
- /drill-down already does real DB queries Phase 2A (PR #204 §1).

### Inconsistency

If PR #196 §7 Q1 is worded as a generic "all 4 endpoints" gate, that wording overreaches. **Q1 blocks 2/4 PRs (production + quality), not all 4.**

### Recommendation

Phase B kickoff marching order should restate Q1 with explicit scope:
> Q1 [Steve, BLOCKS production + quality only]: Mock-vs-real-DB sign-off. /query and /drill-down impl chats unblocked of Q1 — they use real DB / real config tables.

This unblocks /query and /drill-down impl chats from waiting on Steve's Q1 answer.

---

## §6 Open Inconsistencies + Recommendations

### Summary

| # | Issue | Severity | Recommendation |
|---|---|---|---|
| 1 | JavaRandom helper path mismatch + over-claimed sharing scope | **MED** | Phase B kickoff MO pins path R1.A: `smartbi_compat/_java_random.py`. Drop "/query" from sharing-scope claim. Coordinator order: Chat N (quality) lands first; Chat M (production) imports. |
| 2 | Effort sum 13-14d > PR #196 ceiling 12d | **LOW** | Add follow-up doc linking PR #202 §9 as source. PR #196 closer note: "Phase B post-detail-spec recalibration: 13-14d". |
| 3 | Q1 sign-off scope ambiguous | **LOW** | Phase B kickoff MO restates Q1 as production+quality only. /query and /drill-down impl chats unblocked. |
| 4 | nginx batch coordination under-documented in #199 / #203 | **LOW** | T6.6 cutover MO (later) enumerates 4 paths in one transaction. PR #204 §7 already drives this. |
| 5 (informational) | /query → /drill-down implicit import dependency | **LOW** | Phase B kickoff MO for /query impl chat includes §1.3 dispatch table verbatim. Day 1 smoke = import sanity. |

### Follow-up actions

| Action | Owner | Trigger |
|---|---|---|
| Phase B kickoff marching order — pins JavaRandom path R1.A + Chat N first ordering | Organizer (this chat or successor) | Before T6.6 Phase B kickoff (~Aug 2026) |
| Phase B kickoff marching order — restate Q1 as production+quality only | Organizer | Same |
| Phase B kickoff marching order — for /query impl chat, embed §1.3 dispatch table | Organizer | Same |
| PR #196 closer addendum — recalibrated 13-14d total | Optional, can be deferred | If anyone refers to PR #196 effort number |
| T6.6 cutover MO — batch 4 nginx routes | Phase B impl chat or organizer | Post-impl, pre-cutover |

### Non-issues confirmed

- 4-endpoint pairwise independence (except /query → /drill-down import). No circular deps.
- /drill-down zero-port effort is real (PR #204 audit confirms Phase 2A impl + 9 goldens + empirical F001 parity). Not over-claimed.
- All 4 PRs defer T6.6 Phase B kickoff to ~Aug 2026 post-T6.5+30d. Consistent.
- All 4 PRs include explicit `⛔ HOLD: spec only, no code, no deploys, no nginx mutations` blocks.

---

## §7 Verdict

**4 inconsistencies, all minor.**

- 0 blocking — none of the 4 PRs need to be re-opened or amended directly.
- 5 low-MED severity recommendations land naturally in the T6.6 Phase B kickoff marching order (when written ~Aug 2026).
- The 4 specs are mutually consistent on:
  - dict-eq parity gate (Phase 2A standard inherited).
  - HOLD discipline + Q1/Q2 gates documented.
  - T6.6 prereq sequencing (T6.5 Phase B+C complete + 30d soak).
  - nginx flip deferral to coordinated batch.

**Outcome**: T6.6 Phase B is unblocked by spec quality. Remaining blockers are external (T6.5 Phase B+C completion + Steve Q1 sign-off + customer-impact assessments per PR #202 Q-D).

---

## Appendix A — Cross-PR reference grid

| Topic | PR #199 | PR #203 | PR #202 | PR #204 |
|---|---|---|---|---|
| Effort | 1.5-2d | 2d | 9d (7+2) | ~0d existing |
| Mock-vs-real | Mock (9/9 methods) | Mock (4-branch) | Real (intent + DB) | Real (DB) |
| New helpers | `_java_random.py` | `_java_random.py` (shared), `_format_currency_java`, `_java_hashmap_iter_order` | `_jackson_indent_compat` | None |
| Existing module reuse | None | `_format_decimal_half_up` | All 14 `analysis_*.py` (incl drill-down) | N/A (this IS the existing module) |
| dict-eq gate inheritance | Phase 2A | Phase 2A | Phase 2A | Phase 2A (already validated) |
| HOLD block present | ✓ | ✓ | ✓ | ✓ |
| Q1 (mock sign-off) blocking | YES | YES | NO (not mock) | NO (not mock) |
| Q2 (`_JavaRandom` repro gate) blocking | YES (Day 0) | YES (T-MOCK-1/2) | NO | NO |
| nginx coordination explicit | implicit | implicit | partial (§8.7 restaurant) | explicit (§7) |
| Phase B kickoff prereq | T6.5 + 30d | T6.5 + 30d | T6.5 + 30d | T6.5 + 30d |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
