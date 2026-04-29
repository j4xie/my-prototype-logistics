# SmartBIAnalysis.vue split — deferred decomposition plan

**Created**: 2026-04-26 (Item 1 from `2026-04-26-deferred-backlog-handoff.md`)
**Status**: Phase 1 done (style extracted, 6519 → 5118 lines). Phase 2-3 (template/script split into 6 components) **deferred** with explicit rationale below.

---

## What was done

**Phase 1 — Style extraction** (commit follows this doc): the 1402-line `<style scoped lang="scss">` block was moved out of `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` into a sibling SCSS file `web-admin/src/views/smart-bi/analysis/SmartBIAnalysis.scss`. The SFC now references it via `<style scoped lang="scss" src="./analysis/SmartBIAnalysis.scss"></style>`.

Net: SFC dropped from 6519 → 5118 lines (−21.5%). Build verified clean (vue-tsc exit=0, vite build succeeds, scoped class hashing preserved).

The new `analysis/` subfolder is the planned home for the future component extractions.

---

## What is deferred (and why)

The handoff (`docs/plans/2026-04-26-deferred-backlog-handoff.md` Item 1) called for 6 sub-components in `analysis/`:

1. `KPIStripPanel.vue` — KPI cards (Phase 10 D2.B1 cache-key remap lives here)
2. `UploadSwitcher.vue` — dropdown + idle pre-cache (Phase 6 dropdown switch async race guards)
3. `EnrichmentChartGrid.vue` — chart cards + skeletons (Phase 11 E1a Promise.all)
4. `AIInsightsStream.vue` — SSE stream renderer + 数字 labeling display
5. `TemplateGridPanel.vue` — Week 6 templates
6. `FilterChipsBar.vue` — global filter dimension chips

Plus parent `SmartBIAnalysis.vue` becoming a ~500-800-line orchestrator.

### Why I stopped after the style extraction

1. **Sacred items are scattered through the script section** — Phase 6 commit `3a60303a6` placed dropdown async race guards at 3 distinct call sites (`enrichSheet` lines 3627-3631, 3678-3681, `idleEnrichNext` lines 3570-3576). Phase 10 D2.B1 (`0bd94bcec`) added cache-key remap inside chart fetch. Phase 11 E1a (`2f1070ed7`) wired Promise.all across enrich steps 7+8. A clean component split must lift each into the right child while preserving the original ordering of effects, ref captures, and watcher fire timing.

2. **Refactor needs dev-server validation per component** — Vue SFC reactive scope, prop drilling, emit chains, pinia store usage all require an interactive dev server (`npm run dev`) and click-through-the-feature smoke per extraction. The handoff explicitly noted "Risk: high. Vue SFC reactive scope, refs across components, prop drilling. Be cautious with pinia store usage if any." This is incompatible with a one-shot autonomous run that's already drained ~6h on Items 2-5.

3. **Concurrent edits in adjacent files raise scope-creep risk** — `web-admin/src/views/equipment/list/index.vue` is unstaged in the working tree from a parallel session. Pre-commit hook auto-staging during a multi-component refactor would conflate scopes. Per `.claude/rules/concurrent-edit-safety.md` rule 5, this is exactly the situation to avoid.

4. **The honest 80/20 cut**: style extraction reduced visual noise by ~22% with zero behavior risk. The remaining template (1193 lines) + script (3919 lines) split is where regressions actually hide. Doing it half-correctly is worse than doing it later in a focused session with `npm run dev` open.

---

## Concrete next-session plan

**Pre-flight (fresh session)**:
- `git status` → confirm working tree clean before starting (or branch off a clean point)
- `npm run dev` in `web-admin/` and login to test env (10011 / 8084) to baseline the page

**Per-component extraction recipe** (apply to each of the 6 components):
1. Identify all `ref/reactive/computed/watch` that the component needs from parent → these become `defineProps` (immutable) or pinia store reads
2. Identify all events the component needs to send back → `defineEmits`
3. Cut-paste template + script chunks into the new child SFC
4. Wire `<NewComponent :prop1="..." @event1="handler1" />` in parent
5. Run `npm run dev` → smoke the specific area (KPI / dropdown / chart / etc.)
6. Run `agg-strategy-realwindow-prod.mjs` smoke against a stable env
7. Commit per-component (commit message references the originating Phase commit it preserves)

**Order of extraction (low risk first)**:
1. **`FilterChipsBar.vue`** (smallest, mostly props in/event out) — no Phase commit lives here
2. **`TemplateGridPanel.vue`** (Week 6 templates, mostly Tier-2 logic) — Phase 12 K2 lives in templates not in this UI block
3. **`KPIStripPanel.vue`** (KPICard already external; this is the wrapping logic) — Phase 10 D2.B1 cache-key needs careful prop pass-through
4. **`AIInsightsStream.vue`** (SSE renderer) — Phase 11 G1 数字 labeling display lives here; needs verify the el-alert path still triggers
5. **`EnrichmentChartGrid.vue`** (chart cards) — Phase 11 E1a Promise.all needs to be split between parent (orchestration) + child (fetch)
6. **`UploadSwitcher.vue`** (BIGGEST RISK) — Phase 6 async race guards. Each of the 3 sites must verify `currentSheet.uploadId !== uploadId` semantics survive the prop boundary. Recommend a dedicated test that switches uploads mid-flight.

**Verification gates** (must hold throughout):
- `agg-strategy-realwindow-prod.mjs` end-to-end PASS (review xlsx 4 平均X cards + POS render <10s)
- `pos-4169-isolated-prod.mjs` (no carryover when switching uploads)
- Phase 10 AIQuery template fast-path < 300ms TTFB (smoke command in handoff)
- Phase 11 H1 Dashboard /insights/custom < 10ms warm cache hit

**Estimated effort**: 4-6 hours focused, with `npm run dev` open. 6-8 commits.

---

## What's a non-starter

- **Don't try the entire template/script split in a single autonomous session** without dev-server smoke per component. The Vue SFC reactive boundary is genuinely error-prone and the sacred items (Phase 6/10/11) will silently regress if a watcher fires in wrong order or a prop ref breaks reactivity.
- **Don't refactor the script "while you're at it"** — the goal is mechanical extraction with behavior preservation, not improvement.
- **Don't touch the legacy `analysis.ts` line 1466-1488 area** — Phase 4 Option A already deleted the bug. Re-introducing positional rename or force-coerce during the refactor would re-break review xlsx.

---

## Status entry for memory

After Phase 1 commit, append to `MEMORY.md`:

```
- Item 1 (Vue split) **partial**: style block extracted to analysis/SmartBIAnalysis.scss (1402 lines out of SFC, 6519→5118). Remaining 6-component template/script split deferred — see docs/plans/2026-04-26-smartbi-vue-split-deferred.md for the per-component recipe and risk reasoning.
```
