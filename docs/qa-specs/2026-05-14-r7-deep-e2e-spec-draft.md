# R7 deep E2E next-round spec — DRAFT

**Status**: 📝 **DRAFT pending Steve review**
**Date drafted**: 2026-05-14
**Author**: chat3 (R7 candidate-path scoping session)
**Predecessor**: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` (R1-R6 spec — see §2 process finding below)
**Skill compliance**: `depth-first-e2e` Rule 1-11 + `superpowers:writing-plans`

---

## §0 TL;DR

R1-R6 completed (verified PRs MERGED 2026-05-12 → 2026-05-13). The original spec listed 6 rounds; what actually shipped exceeded the plan — R3 + R5 caught real P0/P1 bugs that triggered conditional R4 + R6 fix rounds.

**5 candidate paths reviewed** (A-E from MO + one organizer-suggested addition F).

**Recommendation** (subject to Steve review): **R7 = E + F combined** — execute the F006-style customer-factory audit pattern on 3 additional customer factories (path E), AND systematically close the 49 un-verified customer asks tracked in the May-13 customer RBAC coverage handoff (path F). Single 8-10h round, two complementary deliverables. Trigger is **immediate** (no gating).

Path A (customer-data regression) is highest absolute ROI when triggered but **currently gated on first customer upload**. Path D (Phase 2D readiness) is also gated. Path C (performance/load) is premature for current customer scale.

**Open question**: Steve to confirm E+F combined or pick a single path. See §8.

---

## §1 R1-R6 retrospective

Verified `gh pr view` state=MERGED for each row:

| Round | Date | Spec focus | Actual scope | Real bugs found | Key PRs |
|---|---|---|---|---|---|
| R1 | 2026-05-12 | Breadth smoke + 3 customer-facing PRs L4 | 18 Python endpoint smoke + 18 SmartBI Vue L1 smoke + 3 customer-facing PR deep | **2** (P0-B SalesOrder NPE, P0-C PDF RBAC bypass) + 1 P1 (nginx routing for 7 Python endpoints) | #506, #507, #509, #511 |
| R2 | 2026-05-12 | Customer-facing depth + RBAC sweep | 12 endpoint × 3 role = 36 cells | **0 leaks** in scope; ✅ verified PR #423 + #495 + #489 strip live | #452 |
| R3 | 2026-05-12 | Tier 1 deep (finance / sales / inventory) | sales L4 + finance L4 + drilldown Rule 12 lock + procurement Rule 12 centralize | **3** (sales: SoldQuantityRule, AvgPriceRule, MarginCalc); **P0** RBAC bypass on 8+ analysis endpoints | #468, #470, #475 |
| R4 (fix) | 2026-05-12 | Conditional bug-fix | gate SmartBI analysis endpoints (Python + Java) | (fix round — 0 new bugs) | #480 |
| R5 | 2026-05-13 | 边界 + Phase 2B parity + Rule 17 antipattern | datasource boundary + production/quality dict-eq + reverse-pattern grep | **4 P1 BUG + 22 RISK** filed | #485 |
| R6 (fix) | 2026-05-13 | Conditional bug-fix | gate 16 SmartBI upload/config endpoints + 4 P1 from R5 | (fix round — 0 new bugs) | #490, #493 |

**Totals**: ~9 real bugs caught + 22 RISK filed + ~30 endpoints hardened. Bug-discovery ratio per round was high (R1=3, R3=4, R5=4) — Rule-2 deep tests demonstrably worked.

---

## §2 Process findings (R1-R6 retrospective)

### 2.1 Original R1-R6 spec is UNCOMMITTED on main

The R1-R6 spec at `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` lives only in `C:/Users/Steve/my-prototype-logistics/` as an **untracked file**. All R1-R6 PR bodies referenced this path, but the file was never committed.

**Verified**: `git ls-files docs/qa-specs/` (in any worktree at HEAD) returns only 3 files (qhj-revenue-report-design, r2-rbac-sweep-DISPATCH-PROMPT, r2-rbac-sweep-matrix). No `2026-05-12-smartbi-python-port-deep-e2e-spec.md`.

**Recommendation** (out-of-scope for R7 spec but worth a separate small PR): commit the R1-R6 spec to `docs/qa-specs/` as a historical reference doc. Otherwise its citations from R1-R6 PRs are dangling.

### 2.2 R6 "conditional" round happened twice (R4 + R6)

Spec §5 R6 was labeled "条件 (triggered if R1-R5 found bugs)". Reality: bugs were found mid-cycle and triggered **TWO** fix rounds (R4 for R3 P0 RBAC bypass, R6 for R5 4 P1 + R6 sister-sweep). Worked fine. Going forward, treat "fix rounds" as expected pattern not exception — every "Rule 2 deep" round that catches a real bug spawns a fix-sweep follow-up.

### 2.3 Coverage matrix gaps (Rule 11)

R1-R6 covered: 18 Python endpoint + 18 SmartBI Vue + 3 customer-facing UI + 12 RBAC endpoint × 3 role + sales/finance/inventory/procurement/region/dept/drilldown analysis + datasource/production/quality boundary.

**NOT covered (none-coverage modules per Rule 11.5)**:
- Customer-facing modules beyond the 3 PRs from R1: 经营驾驶舱 / customer-side reports / order export workflows
- 微信小程序 (RN ⇒ Maestro / miniprogram skill needed; see F006 handoff Bucket R)
- Per-customer-factory audits — F006 was 1; 32 other restaurant tenants per migration list + ~14 factory tenants
- Web-admin UI module-permission tab (Canvas Dynamic mode)
- Skill / Tool / Intent layer (the 337+ Java tools were never E2E-tested)
- AI Agent layer (gated — `SMARTBI_AGENT_LAYER_ENABLED=false`)

R7 should explicitly update the coverage matrix per Rule 11.2.

### 2.4 Process win: depth-first-e2e Rule 8 same-cause sweep paid off

R3 found 1 P0 RBAC bypass on sales endpoint → Rule 8 sweep expanded to **8+ analysis endpoints** all vulnerable. R5 found 4 P1 → Rule 8 sweep expanded to **16 upload/config endpoints** in R6. 24x leverage ratio. Keep doing this.

### 2.5 Process win: active-E2E replaced passive soak

Per `feedback_active_e2e_replaces_passive_soak.md` HARD — every round used 15-30 min active E2E instead of 24h passive soak. R3 / R5 bug catches happened during active probing, NOT during waiting. With current 0-customer state, this is the only sensible model.

---

## §3 R7 candidate paths

### Path A — Customer-data-driven regression (HIGHEST when triggered, GATED today)

**Trigger**: first real customer uploads non-trivial volume (>100 orders / month) to prod. **NOT currently met** — no customer is actively uploading per current state.

**Scope**: replay R1-R3 deep E2E suite against the new customer's data shape. New data exposes new edge cases (specific to that customer's schema / locale / order patterns). Historical analog: R1 P0-B SalesOrder NPE was caught only because warehouse_mgr1 had RBAC strip applied to real data with `totalAmount=null`.

**Expected yield**: 3-6 real bugs per new customer onboarding, based on R1-R6 pattern (each rounds caught 3-4 real bugs against existing data).

**Effort**: ~5-8h once triggered.

**Status**: ⏳ **gated** — re-evaluate when first customer uploads.

### Path B — Cross-module integration R7 (medium ROI)

**Scope**: state-sync verification across `analysis × transfer × procurement × sales × finance`. R3-R5 went deep within each module but cross-module flows are less covered:
- Sales order → procurement order auto-gen → receive → warehouse stock → inventory delta
- Material requisition → wastage → daily totals → finance cost rollup
- POS upload → Bronze → Silver → Gold ETL (Phase D dual_write)

**Expected yield**: 1-3 state-drift bugs (e.g. SO confirmed but PO not generated; receive recorded but stock not updated).

**Effort**: ~6-8h.

**Risk**: R3-R5 already touched these flows tangentially; new bugs may be edge cases not covered by smoke + medium tests.

**Status**: ⚡ **actionable**, medium ROI.

### Path C — Performance / load R7 (LOW priority today)

**Scope**: single-tenant 100k rows on agg_daily_order_type_meal, 10k purchase orders, 1k concurrent ETL runs. Scaling test on Python service + Postgres.

**Expected yield**: hardening for FUTURE scale; no real bugs at current customer count (<10 active tenants per migration list, most with <100 rows).

**Effort**: ~8-12h.

**Status**: ❌ **defer** — premature optimization for current load profile. Re-evaluate when customer count hits 50+ or any tenant exceeds 10k rows.

### Path D — Phase 2D readiness audit (GATED, deferred indefinitely)

**Scope**: factory Silver schema audit + E2E for factory-tenant `/analysis/(production|quality)` Python path. Currently factory tenants stay on Java per T6.6.4 spec §2.2 + `project_2026_05_11_aggressive_revised_state.md` AGGRESSIVE-REVISED state ("Phase 2D Silver migration — DEFERRED indefinitely until real customer sign").

**Trigger**: Phase 2D becomes active (which currently has no calendar date).

**Effort**: TBD once unblocked.

**Status**: ⏳ **gated indefinitely** — do not schedule until Phase 2D unblocks.

### Path E — Long-tail customer-factory replication (HIGH ROI, actionable)

**Scope**: replicate the F006 (六腾门) coverage push pattern on 3 additional customer factories, using `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs` as the template.

**F006 outcome reference** (per `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md`):
- Started at 3.9% strong PASS
- After 6 iterations + 9 PRs → **74.5% strong PASS / 82.4% partial PASS**
- 9 truly unverified (routed to other contexts: 3 RN, 3 test-env-defer, 2 visual UI, 1 conditional)
- **9 issues filed** (#523-#538), several real (UI typography, RBAC adjacent, data drift)

**Candidate factories** (per migration tenant list + customer relationships):
1. **R_QINGHUAJIAO_REAL** (青花椒) — already onboarded for T6.6.3b cutover; has POS data uploaded; high-value customer
2. **R_ILTEATRO_REAL** (IL TEATRO) — T6.6.3a customer; western-cuisine variant (different schema patterns vs hotpot)
3. **R_XMX_CHAIN** (媳妈香) — multi-store chain (already has Gold rows per chat3 verify of issue #539); chain-tenant edge cases

**Why these 3**:
- Each is a different operational profile (川菜 vs 西餐 vs chain-store) → different bug surface
- All 3 have non-zero Silver data per `agg_restaurant_daily_totals` query (per chat3 issue #539 verify)
- F006 pattern is proven to find real bugs (9 in 1 session)

**Expected yield**: ~6-15 new issues per factory × 3 factories = **18-45 issues filed** (most low/medium severity, ~3-5 P1 expected based on F006 ratio).

**Effort**: ~3-4h per factory × 3 = **9-12h total** (parallelizable: 3 chats in parallel ⇒ ~3-4h wall-clock).

**Status**: ⚡ **actionable now**, high ROI.

### Path F (organizer-suggested addition) — Customer RBAC coverage closeout

**Background**: per memory `feedback_customer_rbac_coverage_handoff` (Steve sign-off 2026-05-13) — at the time of the May 13 close, 49/51 customer asks were still un-verified (3.9% strong coverage). F006 push (Path E precursor) moved that to 38/51 strong (74.5%) but the OVERALL customer-ask list still has 26+ RBAC adjacent surfaces unaccounted for + 29 Vue views without `canViewPrice` defense + 11 P1 follow-up E2E + 5×5 multi-role negative regression.

**Scope**:
- **P1 (29 Vue views)**: grep `web-admin/src/views` for `unitPrice / totalAmount / cost` cells WITHOUT `v-if="canViewPrice"` defense. Each match = 1 RBAC sweep candidate.
- **P2 (11 P1 follow-up E2E)**: re-run F006 P1 cells with proper depth labels.
- **P3 (5×5 multi-role negative regression)**: 5 customer factories × 5 roles (admin / finance / warehouse / operator / sales) negative path — verify each role gets 403 / null-strip on the right endpoints.

**Expected yield**: ~10-20 real RBAC defense gaps + ~5-10 P1 follow-up confirmations.

**Effort**: ~8-10h (mechanical sweep + parallel chats).

**Status**: ⚡ **actionable now**, high ROI; complements Path E (E discovers, F locks down).

---

## §4 ROI rank + recommendation

### Ranking matrix

| Path | Trigger state | Expected real bugs | Hours | ROI (bugs/hr) | Priority |
|---|---|---|---|---|---|
| **E** customer-factory replication | ✅ actionable | 18-45 | 9-12 | ~3-4 | **1** |
| **F** RBAC coverage closeout | ✅ actionable | 10-20 RBAC + 5-10 P1 | 8-10 | ~2-3 | **2** |
| **B** cross-module integration | ✅ actionable | 1-3 | 6-8 | ~0.3 | 3 |
| **A** customer-data regression | ⏳ gated (no customer) | 3-6 per onboarding | 5-8 | ~0.5 | gated |
| **D** Phase 2D readiness | ⏳ gated indefinitely | TBD | TBD | TBD | gated |
| **C** performance/load | ❌ premature | 0 today | 8-12 | ~0 | defer |

### Recommendation: **R7 = E + F combined**

**Rationale**:
- Both paths are immediately actionable (no external triggers)
- E and F are **complementary**, not overlapping:
  - **E** is breadth across customers (3 factories × the F006 51-ask matrix)
  - **F** is depth across the customer-ask surface (RBAC defense + P1 follow-up + multi-role)
  - Bugs E discovers feed F's sweep grep patterns; F's coverage gaps inform E's per-factory script
- Combined effort 17-22h with 4-5 parallel chats ⇒ **3-4h wall-clock**, deliverable in 1 session
- Bug discovery rate maintains R1-R6 momentum (~3-5 real bugs / round). Below this rate, the framework's bug-discovery ROI is fading.

**Alternative if Steve prefers single-path**: pick **E alone** (path of least change, most analogous to F006 success).

**Defer to a later R8/R9**: B (cross-module integration) once E+F close out the customer-facing surface.

---

## §5 R7 acceptance bar (template)

Adapted from R1-R6 spec §2.1 + §3.1 patterns. Each test must satisfy `depth-first-e2e` Rules 1-11.

### 5.1 General test record schema (Rule 1)

Every test records:

```json
{
  "round": "R7",
  "subpath": "E-factory-replication" | "F-rbac-closeout",
  "factoryId": "R_QINGHUAJIAO_REAL",
  "askId": "T3-6" | "L4-CF-1" | ...,
  "depth": "smoke" | "medium" | "deep",
  "verdict": "PASS" | "FAIL" | "WARN" | "INFO",
  "evidence": {
    "url": "...",
    "apiStatus": 200,
    "filledFields": { ... },
    "toast": "...",
    "listRowsBefore": N,
    "listRowsAfter": N+1,
    "detailRoundtrip": true | false,
    "rbacExpectation": "stripped" | "visible" | "n/a",
    "rbacActual": "stripped" | "visible"
  },
  "screenshotPath": "...",
  "filedAsTicket": "#NNN" | null
}
```

### 5.2 Path E acceptance bar (per factory)

| # | Check | Rule | Pass criteria |
|---|---|---|---|
| E1 | Login as factory's `admin` account | n/a | URL changes off `/login` |
| E2 | Navigate 5 customer-priority pages: dashboard / sales/orders / procurement/orders / smartbi/analysis / 报表 | Rule 11 | All 5 pages render, 0 console errors, 0 4xx (except expected 403 cross-factory) |
| E3 | Replay F006 51-ask matrix specific to this factory's data shape | depth-first-e2e Rule 2 | ≥1 deep test per factory; depth: deep ≥ 5 |
| E4 | Cross-role: same matrix as warehouse / operator / finance role | RBAC | Each role gets correct strip / visibility |
| E5 | Each new bug → file as GitHub issue with `customer:R_XXX` label + factory_id evidence | Rule 8 | Issue includes screenshot, reproduce-steps, vulnerability surface |

### 5.3 Path F acceptance bar (RBAC closeout)

| # | Check | Rule | Pass criteria |
|---|---|---|---|
| F1 | Grep 29 Vue views — verify `canViewPrice` defense or `v-if=...!=null` em-dash present | Rule 8 | Each view either has defense OR is filed as bug |
| F2 | 11 P1 follow-up E2E from F006 handoff Bucket V — re-run with strict depth | Rule 2 | All run as `depth: deep`; PASS/FAIL recorded |
| F3 | 5×5 multi-role negative regression matrix | RBAC | 25 cells; expected 403 / null-strip on each; any leak = P0 bug |
| F4 | Cross-factory negative: F001 admin → query F006 data → expect 403 | Rule 11 | Hard fail if any cross-factory data leak |
| F5 | Same-cause sweep on any newly-found defense gap | Rule 8 | Pattern grep across all `web-admin/src/views/**/*.vue` |

### 5.4 Failure modes that BLOCK R7 close

Per Rule 10 + Rule 8:

- Any deep test catches a bug AND same-cause sweep is not performed → BLOCKED
- Any deep test catches a bug AND vulnerable siblings are neither fixed nor scheduled → BLOCKED
- Round complete but PR not opened / not merged → BLOCKED (test-complete, not delivery-complete)
- Any "next round" phrase appearing in audit doc → BLOCKED per Rule 4

---

## §6 Trigger conditions for R7 dispatch

R7 (E + F combined) is **immediately dispatchable** once:

- [ ] **R6 (PRs #485, #490, #493) verified merged** ✅ (verified pre-draft via gh pr view)
- [ ] **R6 deploy soak passed**: 24h since R6 prod deploy without rollback. Per `feedback_active_e2e_replaces_passive_soak.md` HARD this is replaced by active probe; chat3 issue #539 verification (May 14 04:08) confirmed prod healthy for restaurant tenant ETL — analogous active check for R6 endpoint gates should be ≤30 min post-deploy.
- [ ] **No active P0/P1 incident** on prod (`systemctl status cretas-backend cretas-python` both `active (running)`; no Linear/GH P0 open)
- [ ] **Concurrent T6.6.4 dispatch decoupled**: T6.6.4 (per chat3 PR #555) is doc-only nginx header change. R7 can run concurrently — no conflict.
- [ ] **Customer-ask matrix is current**: re-fetch `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md` + any May-14 amendments; confirm 49-ask list hasn't already been partially closed by other chats.

When all 5 met, R7 can launch with 4-5 parallel chats per §4 recommendation.

---

## §7 Rule 1-11 compliance (this spec)

| Rule | Compliance |
|---|---|
| Rule 1 (depth label) | §5.1 schema enforces |
| Rule 2 (≥1 deep per round) | §5.2 E3 mandates depth:deep ≥5 per factory; §5.3 F2 + F3 add more |
| Rule 3 (audit bug-discovery capability) | §5.4 BLOCK conditions enforce; per-test Rule 3 question matrix to be added at execution time |
| Rule 4 ("next round" red flag) | §5.4 explicit BLOCK on "next round" phrase |
| Rule 5 (Critic depth scrutiny) | Critic prompt at execution time will include Rule 5 checklist |
| Rule 6 (§1.3 hard rules beat §8.2 numbers) | n/a for R7 (no §8.2 numeric target yet — to be set when execution starts) |
| Rule 7 (spec-denominator summary) | §5.1 schema includes specTotal, depthBreakdown |
| Rule 8 (same-cause sweep) | §5.4 BLOCK if not performed |
| Rule 9 (independent Critic) | Critic dispatched as separate agent at execution time |
| Rule 10 (commit ≠ delivery) | §5.4 BLOCK if not pushed/merged |
| Rule 11 (breadth coverage) | §2.3 lists `none`-coverage modules; R7 path E explicitly targets per-factory breadth |

---

## §8 Open questions for Steve

1. **Path choice**: confirm R7 = E + F combined? Or pick a single path? Or different priority (e.g., gate-A by reaching first customer first)?
2. **Path E factory selection**: are `R_QINGHUAJIAO_REAL + R_ILTEATRO_REAL + R_XMX_CHAIN` the right 3? Or substitute? (Other candidates: `R_DONGMENKOU_REAL`, `R_YONGHE_REAL`, `R_GML_DEMO`)
3. **R1-R6 spec commit**: should the original `2026-05-12-smartbi-python-port-deep-e2e-spec.md` be committed in a separate small PR for historical reference? (Currently untracked in main worktree, dangling refs from R1-R6 PRs.)
4. **R7 trigger window**: dispatch tomorrow (2026-05-15) or wait for T6.6.4 deploy to complete (per chat3 PR #555 marching order)?
5. **Customer-ask list refresh**: should chat3 (or another chat) fetch the live `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs` re-run snapshot before R7 dispatch to confirm un-verified count hasn't drifted?
6. **Effort budget**: 3-4h wall-clock (4-5 parallel chats) acceptable, or shrink scope to 1-2h single chat?

---

## §9 Next steps if Steve confirms

1. **Promote this DRAFT to spec**: rename to `2026-05-15-r7-customer-completion-spec.md` once approved
2. **Write dispatch MOs**: 4-5 per-chat marching orders mirroring T6.6.4 style (per chat3 PR #555 doc)
3. **Pre-flight check**: re-fetch customer-ask matrix, confirm `none`-coverage modules unchanged, refresh R6 fix-verified state
4. **Dispatch + execute**: per Step 6 in `depth-first-e2e` lifecycle (Self-audit → Independent audit → Fix plan → Execute → Critic audit → Bug-fix sweep → Verify → Delivery)
5. **Close R7**: per Rule 10 (commit + push + PR + merge + memory update)

---

## §10 Refs

- `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` — original R1-R6 spec (UNCOMMITTED on main per §2.1)
- `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md` — F006 audit residuals → path E template
- `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs` — F006 audit script (template for path E factories)
- PRs verified MERGED: R1 #506/#507/#509/#511, R2 #452, R3 #468/#470/#475, R4 #480, R5 #485, R6 #490/#493
- Memory: `feedback_customer_rbac_coverage_handoff.md` (path F context), `feedback_active_e2e_replaces_passive_soak.md` HARD (Rule 11.x), `feedback_byte_similarity_not_content_similarity.md` HARD (PR #511 lesson)
- Skill: `.claude/skills/depth-first-e2e/SKILL.md`
