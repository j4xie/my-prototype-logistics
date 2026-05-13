# Organizer Stale-MO — 3-Strike Record + Corrected State Map

**Date**: 2026-05-13
**Author**: chat1 (audit-3strikes worktree)
**Branch**: `docs/audit-organizer-stale-mo-3-strikes`
**Scope**: Doc-only. No code, no deploy. Records 3 stale dispatches caught in single organizer session + provides verified current state map for T6.5 / T6.6 / Phase 2C / Phase 2D / canViewPrice.

---

## 0. TL;DR

Three stale "do outstanding work X" marching orders surfaced in one session — all caught at premise-check before any code was touched.

| # | Topic | Claimed pending | Reality | Caught by |
|---|---|---|---|---|
| 1 | R2 RBAC sweep | Not yet run | **PR #452** merged 2026-05-12 18:36 UTC (28 PASS / 6 WARN / 2 NEEDS_REVIEW / **0 FAIL**) | Steve self-audit pre-dispatch |
| 2 | T6.5 Phase B — stub 23 methods to 410 | "Now Phase B: stub these 23 method bodies" | **PR #205** stub-out merged May 9 + **PR #236** + Sub-A through Sub-N (#243/#244/#246/#248/#259/#260/#267/#270 etc) — the 23 methods are physically deleted from disk, not just stubbed | chat1 mid-dispatch (worktree created, no edits) |
| 3 | T6.6.1 parity dryrun | "Run parity-gate harness... compare Java vs Python... ≥99.5% acceptance bar" | **PR #386** + #398 + #403 + #405 + #432 (May 11-12) — 2 demo tenants + 14 R_*_REAL chains, **100% match, 0 REAL_BUG**, audit doc + 32 evidence files committed | chat1 pre-worktree (option-1 hold) |

**Net cost**: ~0 LOC redo, ~10 min wasted per strike (premise verification), 0 worktree mess. **Cost avoided**: each strike would have been a 2-3h chat doing duplicate work and producing a no-op or conflicting PR.

**Single root cause** (all three strikes): the dispatch prompt's "X is outstanding" premise was derived from spec / memory / mental-model — *none* of which reflect current `origin/main` head. Strike 3 added a synonym-search miss on top (PRs titled `chore(parity-gate): ...` don't match a `t6-6 in:title` search).

Rule already updated: `feedback_gh_pr_search_before_dispatch_outstanding.md` (HARD, May 13 graduation incident — this file).

---

## 1. Strike-by-Strike Evidence

### Strike 1 — R2 RBAC sweep claimed pending

**Dispatch context**: Organizer was drafting an R2 dispatch when self-audit caught that R2 was already merged.

**Reality**:

| Field | Value |
|---|---|
| PR | **#452** |
| Title | `qa(r2): RBAC sweep — 36 cells verified, 0 FAIL` |
| Merge timestamp | 2026-05-12T18:36:06Z |
| Merge commit | `25352813de389583d082f22109ce0c74479607e6` |
| Verdict | 🟢 0 FAIL, ship as-is. 28 PASS / 6 WARN (all explainable) / 2 NEEDS_REVIEW (E5 §5.2 policy question) |

**What was verified in PR #452**: PR #423 (Java `@PriceSensitive` field strip), PR #435 (Python KPI strip), PR #443 (Jackson method-target NPE expectation refuted), PR #444 latent leak (flagged for follow-up).

**Catch mechanism**: Organizer's own pre-dispatch self-audit. No chat dispatched.

### Strike 2 — T6.5 Phase B stub claimed pending

**Dispatch context**: chat1 was given a marching order to stub 23 SmartBI Analysis endpoint methods to 410 Gone. MO explicitly cited "Phase A audit closed 5/9. Now Phase B."

**Reality**: Phase B AND Phase C Sub-A both shipped May 9 — Phase B at 15:07 UTC, Phase C Sub-A at 17:44 UTC, same day Steve dispatched the chat:

| Phase | PR | Title | Merged UTC | Merge commit |
|---|---|---|---|---|
| B | **#205** | `feat(t6-5-phase-b): stub 23 SmartBI Analysis endpoint methods to 410 Gone` | 2026-05-09 15:07 | `be5959c50` |
| B follow-up | #210 | `audit(t6-5-phase-b): prod deploy cutover record + F999 waiver double-record` | 2026-05-09 | — |
| B follow-up | #213 | `audit(t6-5-phase-b): active E2E Playwright prod verify (12/12 PASS)` | 2026-05-09 | — |
| C Sub-A | **#236** | `feat(t6-5-phase-c-sub-a): delete 23 stubbed methods + orphan repo (Phase C MO Sub-A) -334 LOC` | 2026-05-09 17:44 | `c8d509b8d` |
| C Sub-B | #243 | `feat(t6-5-phase-c-sub-b): SalesAnalysisServiceImpl dead method delete -352 LOC` | 2026-05-09 | — |
| C Sub-C | #244 | `feat(t6-5-phase-c-sub-c): DepartmentAnalysisServiceImpl dead method delete` | 2026-05-09 | — |
| C Sub-D | #245 | `feat(t6-5-phase-c-sub-d): RegionAnalysisServiceImpl 5 dead methods delete` | 2026-05-09 | — |
| C Sub-E | #248 | `feat(t6-5-phase-c-sub-e): FinanceAnalysisServiceImpl 10 dead methods delete` | 2026-05-09 | — |
| C Sub-F | #246 | `feat(t6-5-phase-c-sub-f): ProductionAnalysisServiceImpl dead method delete` | 2026-05-09 | — |
| C Sub-H | #260 | `feat(t6-5-phase-c-sub-h): InventoryHealthAnalysisServiceImpl 5 dead methods delete` | 2026-05-10 | — |
| C Sub-I | #267 | `feat(t6-5-phase-c-sub-i): ProcurementAnalysisServiceImpl 8 dead methods + 5 helpers delete` | 2026-05-10 | — |
| C Sub-K | #259 | `feat(t6-5-phase-c-sub-k): SmartBiQueryTemplate entity orphan delete` | 2026-05-10 | — |
| C Sub-N | #270 | `feat(t6-5-phase-c-sub-n): SmartBIServiceImpl 2 dead method delete` | 2026-05-10 | — |

Current state of `SmartBIAnalysisController.java`: only 4 `@*Mapping` annotations remain, and they are *precisely* the 4 NOT_SAFE_FALLTHROUGH endpoints the MO told chat1 to **EXCLUDE** (`/analysis/production`, `/analysis/quality`, `POST /query`, `POST /drill-down`). Class Javadoc lines 30-32 explicitly state: *"The remaining migrated endpoints … were removed in T6.5 Phase C."*

**Bonus catch**: MO snippet `ApiResponse.error("410", "..." + factoryPythonRoute)` doesn't compile against the actual `ApiResponse` API (no `factoryPythonRoute` variable in scope; `error(String)` returns code 400). PR #205 commit message literally calls out the same MO drift — *"MO snippet's `ApiResponse.error(Map.of(...))` doesn't compile against actual ApiResponse API"* — so chat1 would have hit the same wall a second time.

**Catch mechanism**: chat1 created worktree (per MO), then read controller file to map current method bodies BEFORE editing. Found 4 mappings instead of expected 26. Verified via `git log --all --oneline --grep="t6-5-phase-b"` → PR #205 lands. Worktree + branch removed; no edits.

### Strike 3 — T6.6.1 parity dryrun claimed pending

**Dispatch context**: chat1 was given an MO to run the parity-gate harness comparing Java vs Python for 4 endpoints (production / quality / query / drill-down) × restaurant tenants, target ≥99.5% byte-equality.

**Reality**: T6.6.1 parity dryrun was effectively executed across 5 PRs spanning May 11-12, with extension well beyond the MO's stated scope:

| PR | Title | Merged UTC | Tenants × endpoints | Result |
|---|---|---|---|---|
| **#386** | `chore(parity-gate): real prod parity evidence (RES_3101_009 + R_GML_DEMO, 0 REAL_BUG, 16/16 PASS)` | 2026-05-11 21:52 | 2 × 8 = 16 endpoint-runs | 100.0% match, REAL_BUG = 0 |
| **#398** | `chore(parity-gate): 14 R_*_REAL real-prod parity evidence (3 chains × 4 analysisType × 2 endpoints, 0 REAL_BUG)` | 2026-05-12 02:12 | 3 × 8 = 24 goldens | 0 REAL_BUG |
| **#403** | `chore(parity-gate): 14 R_*_REAL full sweep — remaining 11 chains (88 goldens, 0 REAL_BUG)` | 2026-05-12 03:27 | 11 × 8 = 88 goldens | 0 REAL_BUG |
| **#405** | `docs(qa-audit): SmartBI cohort parity sweep post Phase 2C — 0 regression in 6 cohort factories` | 2026-05-12 03:27 | 6 × 17 = 102 cells | 0 regression |
| **#432** | `chore(parity-gate): F-2 Phase-C routing-aware + BG-aware Java port detection` | 2026-05-12 05:50 | (harness improvement) | — |

**Total achieved**: ~218 endpoint-runs across 19 tenants. Spec PR #366 §3.2 acceptance bar was **99.5%**; actual delivered = **100.0%** on every run. Audit doc at `docs/qa-audits/2026-05-11-restaurant-parity-real-prod-run.md` (245 LOC, 7 sections) explicitly states *"🎯 Phase 2B parity GO — REAL_BUG = 0 across both restaurant tenants"*. Evidence files committed at `reports/parity-real-prod-2026-05-11/` (32 files: 16 JSON + 16 HTML).

**Three MO scope drifts on top of stale premise**:

1. **MO claimed 4 endpoints; spec scope = 2**. Spec PR #366 §2 explicit scope: `/analysis/production` + `/analysis/quality` only. `/query` and `/drill-down` are not yet ported with restaurant tenant routing — `backend/python/smartbi_compat/api/analysis_drilldown.py` has no `is_restaurant_tenant` branch; there's no `analysis_query.py` at all. They're deferred to T6.6.bis or T7.
2. **MO tenant list incorrect**. MO query asked `id LIKE 'R_%_REAL' OR id LIKE 'RES_3101_%' OR id LIKE 'R_GML%'`. Per `scripts/parity-gate/record-restaurant-goldens.sh:51-57` comment, at PR #386 time the 14 R_*_REAL tenants were *not* in `cretas_prod_db.factories` (only in `smartbi_prod_db.restaurant_chain_catalog`) → tenant detector returned FACTORY → Phase 2D `NotImplementedError`. They got onboarded between #386 and #398, then swept clean in #403.
3. **Synonym search failure (HARD-rule-graduating root cause)**: `gh pr list --search "t6-6 in:title"` returned 0 hits for the actual work because PR titles used the functional descriptor `chore(parity-gate): ...` not the canonical phase label. Search by 5-7 synonyms (`parity-gate`, `parity-dryrun`, `parity-real-prod`, `REAL_BUG`, `byte-shape compare`, etc.) is mandatory before any dispatch claiming "T6.6.1 outstanding".

**Catch mechanism**: chat1 ran `git log --all --grep="t6-6\|T6.6\|stage-1"` BEFORE creating worktree, found PR #386 in the result list, then `gh pr view 386` confirmed scope + GO verdict + audit doc + 32 evidence files. Hold reported to organizer; no worktree created.

---

## 2. Corrected Current State Map (as of 2026-05-13)

All entries below verified against `origin/main` via `gh pr view <N>` + on-disk file checks.

### 2.1 T6.5 — Java SmartBI analysis deprecation

| Phase | State | Evidence |
|---|---|---|
| A — audit | ✅ Closed May 9 | PR #182 (spec bake-in), audit doc `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` |
| B — stub 23 to 410 | ✅ Closed May 9 | PR #205 (stub), #210 (deploy record), #213 (active-E2E 12/12 PASS), #216 (F999 T-72h notice) |
| C — delete dead code | ✅ Closed May 9-10 across 12+ sub-PRs | Sub-A #236, Sub-B #243, Sub-C #244, Sub-D #245, Sub-E #248, Sub-F #246, Sub-H #260, Sub-I #267, Sub-K #259, Sub-N #270, audit-orphan #253 (no-op) |
| D — DB verification + 30-day soak | 🟡 Readiness audit only | PR #258 (readiness + plan draft, Option C 30-day soak). **No exec PRs yet** — soak is observation-only, no further code work scheduled until cooldown. |

### 2.2 T6.6 — Restaurant-tenant cutover for /analysis/production + /analysis/quality

| Stage | State | Evidence |
|---|---|---|
| Specs (Phase B impl + cutover) | ✅ Closed May 9-11 | PRs #180/#196/#199/#202/#203/#204/#220/#223 (per-endpoint specs), #298/#316 (ETL infra audit + design), #326/#328/#330/#335/#344 (Q-DEC ratification), #345 (Sub-A+Sub-B consolidated), #366 (cutover spec) |
| Foundation utilities | ✅ Closed May 9, partially removed May 11 | PR #226 (JavaRandom + hashCode helpers landed), PR #339 (JavaRandom helper deleted after active-E2E shortcut) |
| Sub-A impl: /analysis/production restaurant | ✅ Closed May 11 | PR #350 (skeleton + tenant.py), PR #352 (M1+M2+M3 impl) |
| Sub-B impl: /analysis/quality restaurant | ✅ Closed May 11 | PR #354 (skeleton), PR #358 (N1+N2+N3+N4 impl) |
| Router wiring | ✅ Closed May 11 | PR #360 (`feat(router): wire analysis_production + analysis_quality endpoints`) |
| Parity-gate harness | ✅ Closed May 11 | PR #359 (byte-shape compare framework), PR #365 (restaurant harness + schema audit + caught P0 tenant.py bug), PR #368 (tenant.py SQL fix `factory_id` → `id`), PR #369 (defaults + P0 smoke), PR #378 (Pattern B classifier + tolerate flag) |
| **T6.6.1 — parity dryrun** | ✅ **Closed May 11-12** (Strike 3 above) | PR #386 / #398 / #403 / #405 / #432 — 100% match, 0 REAL_BUG, 19 tenants, 218 endpoint-runs |
| **T6.6.2 — R_TEST_MOCK seed + canary** | ❌ **NOT STARTED** | 0 PRs found searching `t6-6-2 in:title`. MO chain triggers on T6.6.1 PASS (satisfied), but no chat dispatched yet. |
| **T6.6.3 — sequential restaurant tenant cutover (nginx flip)** | ❌ **NOT STARTED** | 0 PRs found searching `t6-6-3 in:title` or `restaurant cutover in:title`. nginx vhost not yet modified for `/analysis/production` + `/analysis/quality` restaurant routing. |
| **T6.6.4 — Java 410 deprecation header** | ❌ **NOT STARTED** | Gated on T6.6.3c + 24h. |
| /query and /drill-down restaurant impl | ❌ **OUT OF T6.6 SCOPE** | Spec PR #366 §2 explicit: production + quality only. Per-endpoint specs exist (#202 /query, #204 /drill-down audit) but no Python restaurant impl. Deferred to T6.6.bis / T7. |

**Net T6.6 outstanding work**: T6.6.2 (R_TEST_MOCK seed + canary E2E) → T6.6.3a/b/c (sequential nginx flip per restaurant tenant) → T6.6.4 (24h soak + Java 410 header). **Two endpoints in scope**, not four.

### 2.3 Phase 2C — Tier-by-tier port of remaining Java SmartBI controllers

| Tier | Scope | State | Evidence |
|---|---|---|---|
| Tier-1 | SmartBIConfigController (41 endpoints) | 🟡 Pilot live, full port pending | Spec PR #191, pilot PR #379 (`/smartbi-config/thresholds`), audit PR #308 (dispatch premise drift caught before edit — separate stale-MO instance, not counted in 3-strike) |
| Tier-2 | SmartBIDashboardController (11 endpoints) | 🟡 Pilot live (AGGRESSIVE-REVISED) | Spec PR #206, pilot PR #385 (3 composite dashboards, AGGRESSIVE-REVISED scope) |
| Tier-3 | SmartBIUploadController (13 endpoints) | 🟡 Spec only | Spec PR #201, no impl PRs |
| Tier-4 | SmartBIPublicDemoController (10 endpoints) | ✅ Sunset | Audit PR #200 (sunset decision, 0 prod traffic), impl PR #222 (10 endpoints removed) |

### 2.4 Phase 2D — Factory-tenant Silver migration

| Item | State | Evidence |
|---|---|---|
| Spec | ✅ Closed May 11 | PR #371 (Silver migration + factory branch impl plan), PR #377 (Steve §5+§4.5 amend + 14 R_*_REAL onboarding migration), PR #367 (restaurant N1-N4 readiness + Silver schema audit) |
| Stub | ✅ Closed May 11 | PR #387 (factory dispatch empty envelope, AGGRESSIVE-REVISED scope — defers real factory Silver to indefinite future) |
| Factory cutover | ❌ **INDEFINITELY DEFERRED** per AGGRESSIVE-REVISED state (memory `project_2026_05_11_aggressive_revised_state.md`). Factory tenants continue on Java until business-case for migration arises. |

### 2.5 canViewPrice / RBAC UI defense

| Item | State | Evidence |
|---|---|---|
| Java backend strip (`@PriceSensitive` field strip) | ✅ PR #423 (May 12) — strips price fields server-side for warehouse_mgr + operator roles |
| Python KPI strip | ✅ PR #435 (May 12) — analysis_finance + dashboard executive money-card null for non-finance roles |
| Vue UI v-if sweep | ✅ **PR #520** merged 2026-05-13T17:58:43Z — `feat(rbac): UI defense — canViewPrice v-if on 35 Vue views (PR #423 sister sweep)` |
| R2 RBAC verification | ✅ PR #452 (Strike 1 above) — 36 cells, 0 FAIL |
| Customer-facing P1 follow-up sweep | 🟡 **OUTSTANDING** per memory `docs/superpowers/handoffs/2026-05-13-customer-rbac-coverage-handoff.md` — 49/51 customer asks un-verified (3.9% strong coverage); 26+ RBAC-adjacent surfaces un-closed |

### 2.6 R1 P1 ops follow-up (most recent — May 13)

| Item | State | Evidence |
|---|---|---|
| nginx 7 SmartBI Python endpoint routing fix | ✅ PR #515 (May 13) — `ops(nginx): route 7 SmartBI Python endpoints (R1 P1 fix)` |
| R1 Python endpoint smoke + bug-find | ✅ PR #507 (May 13) — 22 probes / 18 modules, P1 nginx routing bug found → #515 fix |
| QHJ revenue report Phase I (Vue + uploader + E2E) | ✅ PR #516 (May 13) — most recent feature shipped |
| Phase I import-path hotfix | ✅ PR #518 (May 13) — `@/stores/auth` + named-vs-default `request` (caught by `vite build`, not Vitest/Playwright) |

---

## 3. What's Actually Next

Based on the verified state map, candidates for the next dispatch are:

| Candidate | Why now | Why pause |
|---|---|---|
| **T6.6.2 — R_TEST_MOCK seed + canary** | T6.6.1 PASS trigger satisfied. Specs ratified. Cutover spec PR #366 enumerates the stage gates. | Need fresh MO with synonym-verified premise + confirm R_TEST_MOCK fixture readiness (no PR found). |
| Customer-facing canViewPrice P1 sweep | Per `2026-05-13-customer-rbac-coverage-handoff.md` — 49/51 customer asks un-verified, 26+ RBAC surfaces un-closed. Steve flagged as next-session priority. | Bigger scope; multi-chat coordination. |
| Phase 2C Tier-1 full port | Pilot PR #379 already merged. Remaining 40 of 41 SmartBIConfigController endpoints. | Lower urgency than T6.6.2 / customer RBAC. |
| Phase 2C Tier-2 remainder | Pilot PR #385 (3 dashboards). 8 remaining dashboard endpoints. | Same as Tier-1 — not blocking. |
| T6.5 Phase D soak observation | 30-day soak ongoing per PR #258 plan. No PR work needed — observation only. | Schedule passive: 0 hits in 14 days = GO Phase C deeper cleanup, but no chat action required. |

**Recommendation**: pause for Steve's organizer-side re-audit, then re-dispatch one of the above with synonym-verified premise per the HARD rule.

---

## 4. HARD Rule Cross-Reference

### Existing (graduated by these 3 strikes, May 13)

**`feedback_gh_pr_search_before_dispatch_outstanding.md`** (HARD).

Key mandates (full text in memory):

1. Before any "X is outstanding" dispatch — run `gh pr list --state merged --search "<keyword> in:title" --limit 20`.
2. Generate **≥3 synonym keywords** per topic (Strike 3 root cause). Example for T6.6.1: `t6-6-1`, `parity-gate`, `parity-dryrun`, `parity-real-prod`, `REAL_BUG`, `byte-shape compare`.
3. Cross-search in `in:body` (catches PRs that *refer* to topic but use different title): `gh pr list --state merged --search "t6.6.1 in:body OR parity-dryrun in:body"`.
4. Re-read spec **§scope-definition section**, NOT just §plan section — Strike 3 had a secondary drift (MO claimed 4 endpoints; spec §2 = 2 endpoints only).
5. On-disk verify file existence + acceptance match: `ls docs/qa-audits/2026-05-*parity*`, `grep -c "@.*Mapping" SmartBIAnalysisController.java`.

ROI: ~30s of pre-dispatch search saves ~3-6h per duplicate dispatch chat. ~720x return.

### Companion rules (already in memory)

- **`verification-before-completion`** — evidence before assertions, always.
- **`feedback_organizer_projection_bug`** — organizer must `gh pr view <N>` before claiming PR exists *or* doesn't exist.
- **`feedback_organizer_verify_pr_merged_before_cascade`** (HARD) — cascade MO must cite `gh pr view <N> state=MERGED + mergeCommit` on origin/main.
- **`feedback_count_dont_estimate_at_close_out`** — count, don't estimate, when reporting gap state.

### What's not adequately covered yet (suggested for next rule iteration)

The synonym-search mandate is the most actionable addition. Steve has signalled an additional rule pass is incoming — recommended angles:

- **Mandate synonym keyword list be written IN the MO** (not just in pre-dispatch search), so the chat receiving the MO can do its own verification with the same keyword set.
- **Mandate cross-link to relevant audit doc in MO** when one exists — e.g. `2026-05-11-restaurant-parity-real-prod-run.md` would have ended Strike 3 instantly.

---

## 5. Reproducibility

To verify any claim in §1 or §2:

```bash
# 1. PR existence + merge state
gh pr view <N> --json title,state,mergedAt,mergeCommit

# 2. PR body + files
gh pr view <N> --json title,body,files

# 3. Topic-broad search (synonym set)
for KW in "<canonical>" "<functional1>" "<functional2>" "<artifact>" "<acceptance-metric>"; do
  gh pr list --state merged --search "$KW in:title" --limit 10 \
    --json number,title,mergedAt --jq '.[] | "#\(.number) | \(.mergedAt[0:10]) | \(.title)"'
done

# 4. On-disk state
grep -c "@.*Mapping" backend/java/.../SmartBIAnalysisController.java
ls reports/parity-real-prod-* 2>&1
ls docs/qa-audits/2026-05-*parity* 2>&1

# 5. Git log on file
git log --oneline --follow -20 <file>

# 6. Git log all-branches by topic
git log --all --oneline --grep="<keyword>" -30
```

---

## 6. Sign-off

| | |
|---|---|
| Audit author | chat1 (audit-3strikes worktree) |
| Date | 2026-05-13 |
| Branch | `docs/audit-organizer-stale-mo-3-strikes` |
| Doc-only | Yes — 0 code changes, 0 deploys |
| Next action | Organizer admin-merge → hold for fresh dispatch with synonym-verified premise |

**End of 3-strike audit + corrected state map.**
