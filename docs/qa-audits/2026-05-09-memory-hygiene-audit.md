# Memory Hygiene Audit — 2026-05-09

## TL;DR

`MEMORY.md` was 276 lines (loaded under 200-line truncation cap → 76 lines invisible to Claude in fresh chats). Pruned to **174 lines**, 0 lines lost to truncation. All May 8-9 graduated rules verified present. Trio/quintet redundancy collapsed. Stale `userEmail` / `currentDate` trailers removed.

**Recommendation**: monthly hygiene cadence, hard cap 200 lines.

---

## Before / After

| Metric | Before | After | Change |
|---|---|---|---|
| Total lines | 276 | 174 | **-102 (-37%)** |
| Lines over 200-line truncation cap | 76 (lines 201-276 invisible) | 0 | **fixed** |
| Lines > 300 chars | ~30 | ~5 | -83% |
| Lines > 500 chars | ~12 | 0 | **fixed** |
| Longest single entry | 1524 chars (May 8 T6.4) | 374 chars | -75% |
| Memory entries (sections) | ~58 | ~70 | +12 (more granular, single-line) |
| Sub-bullets per section | up to 7 | typically 1-3 | normalized |
| Stale trailers (`# userEmail`, `# currentDate`) | present (lines 273-276) | removed | system-context already provides |

---

## Issues Identified

### Critical (truncation)
- **76 lines invisible** below line 200 cap — entire "Long-term references" section (Hard rules / YOLO lineage / SmartBI infra / Tool governance / Architecture notes / Crawling) was being silently dropped from Claude's context in fresh chats. This includes load-bearing CRITICAL entries like Deploy Pipeline v4.2, ShedLock, Maestro E2E patterns, JDK 21 path. **Highest-impact fix in this audit.**

### High (oversized entries)
- **May 8 T6.4 readiness gates** (line 56, 1524 chars): single bullet listing #141/#143/#142/#145/#144/#146 with embedded sub-narratives. Compressed to 1 line linking the project file.
- **May 8 forward-looking quintet vs trio** (lines 43-50): 8 lines covering same #150/#151/#152/#153 PRs twice — one entry as "trio" (chats 1+2+3) and one entry as "quintet" (adding #154/#155/#156). Collapsed to single quintet entry, dropped trio.
- **May 7 T6.2 canary** (lines 70-76): 7 sub-bullets on canary cutover + N=2 uvicorn + migration runner + Gold layer arch + Blue-Green deploy. Each was its own load-bearing reference; kept all but compressed each to <250 chars.

### Medium (format violations)
- Multi-line section bodies: 12 sections had 4+ sub-bullets violating the "1 title + 1 body line" rule from CLAUDE.md memory format. Normalized to ≤3 bullets, each bullet ≤300 chars except 5 compound references.
- Stale trailing `# userEmail` and `# currentDate` (Apr 30 stale value) — these come from system context, don't belong in MEMORY.md.

### Low (no action — kept as-is)
- 5 entries between 300-374 chars retained because they cover compound topics (Pattern B chain, T6.3 cutover) where splitting loses semantic coherence and detail is in linked file.

---

## Action Summary

### Removed / Collapsed
- May 8 forward-looking trio block (4 lines) → folded into quintet (1 line) since quintet is superset.
- May 7-8 Pattern B chain end-to-end CLOSED double entry → kept consolidated under May 8 section.
- May 6 11-PR T6.1 dryrun parity narrative paragraph → compressed to 2 lines.
- Apr 30 R67-R83 QA marathon 8-link bullet list → 1 line referring to project doc.
- Apr 25-27 Canvas + data fabric + mega-arc + restaurant Plan C + v1.1/v1.2 + Unified Data Layer → consolidated 6 sections into 1 grouped section with 6 single-line entries.
- Apr 18-23 Bug fixes + Permission Matrix + Server Audit → grouped section.
- Apr 16-17 Aliyun AK rotation + LLM keys + R18 QA + YOLO V2.1 → grouped.
- Apr 11-15 Canvas V2/V3/V4 + V1 E2E + Deploy Pipeline + ShedLock → grouped.
- Apr 7-10 客户需求 + Canvas V2 + 鼎鲜火腿 → grouped.
- Stale trailers (`# userEmail`, `# currentDate`).

### Added (verified all 5 newly-graduated rule files exist on disk)
- All May 9 graduated rules already present in original MEMORY.md (lines 25-35 of pre-prune):
  - `feedback_active_e2e_replaces_passive_soak.md` ✓ exists
  - `feedback_30s_precheck_selective_bug_pattern.md` ✓ exists
  - `feedback_dispatch_on_technical_readiness.md` ✓ exists
  - `feedback_marching_order_method_name_grep.md` ✓ exists
  - `feedback_audit_endpoint_impl_not_router.md` ✓ exists
  - `feedback_sister_chat_cross_verify_high_value.md` ✓ exists
  - `feedback_organizer_dispatch_not_handson.md` ✓ exists
- May 8 graduated rules present:
  - `feedback_narrow_scope_fix_sister_site_sweep.md` ✓ exists
- May 6 graduated rule:
  - `feedback_force_push_stale_base_after_long_branch.md` ✓ exists

No new entries added — they were already indexed, just got reordered/grouped under a single May 9 "newly graduated HARD rules" header for discoverability.

### Reorganized
- Created dedicated "May 9 — Newly graduated HARD rules" section consolidating 7 rule entries (was scattered across 5 different daily sections).
- "Long-term references" section restructured into sub-categories (Hard rules / YOLO / SmartBI / Tool governance / Architecture / Crawling+customer) for index-mode readability.

---

## Memory Health Metrics

| Metric | Value | Target | Status |
|---|---|---|---|
| Total lines | 174 | ≤200 | ✓ 26 line buffer |
| Longest line | 374 chars | ≤200 ideally, ≤500 hard cap | ⚠️ 5 entries 300-374 (compound topics, kept) |
| Truncation buffer | 26 lines | ≥10 lines | ✓ |
| Freshness distribution | May 9 (current): 11 entries / May 1-8: 25 entries / Apr: 28 entries / pre-Apr long-term: ~10 | mostly ≤30 days for project entries | ✓ |
| Dead links | 0 (all linked files verified to exist) | 0 | ✓ |
| Duplicate entries (same incident, same root) | 0 (post-prune) | 0 | ✓ |

---

## Recommendations (cadence)

1. **Monthly hygiene cadence** — 1st of each month, dispatch a fresh chat to:
   - `wc -l MEMORY.md` (alert if >180)
   - Check for sub-bullets >3 per section
   - Check for entries >300 chars (compress or move detail to linked file)
   - Verify all linked files exist (`for link in $(grep -oP '\(([a-z_]+\.md)\)' MEMORY.md); do test -f "$link" || echo "MISSING: $link"; done`)
   - Compress entries older than 30 days that are no longer actively load-bearing
2. **Pre-commit hook idea** (deferred, low priority): block MEMORY.md edits that push past 195 lines — nudges manual prune before truncation hits.
3. **At 200-line cap approach**: prune oldest "long-term references" sub-section, not most-recent (recent context is most likely to be load-bearing).
4. **Compound-topic entries** (Pattern B chain, T6.3 cutover, multi-PR sessions): use linked project file for detail, keep index entry to 1 line referencing link.

---

## Files Touched

- `~/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/MEMORY.md` — pruned 276 → 174 lines (overwrite, not in git repo)
- `docs/qa-audits/2026-05-09-memory-hygiene-audit.md` — this audit doc (in git repo)

## Files NOT Touched (preserved on disk per memory policy)

All 213 individual memory `.md` files preserved unchanged. Only the index (`MEMORY.md`) was pruned. Detail recovery for older entries is via:
1. Direct file read by name from `memory/` directory
2. `git log` of the project for incident timing
3. The linked project/feedback file is still discoverable via filename pattern even if not in MEMORY.md index
