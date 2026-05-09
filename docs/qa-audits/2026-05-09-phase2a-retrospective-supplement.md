# Phase 2A Retrospective — May 9 Supplement (T6.4 Close + T6.5 Phase A)

**Window**: 2026-05-09 (single calendar day; two organizer-mode sessions: morning Phase 2A close + evening T6.5 Phase A close-out)
**Scope**: Supplement to PR [#151](https://github.com/j4xie/my-prototype-logistics/pull/151) `docs/qa-audits/2026-05-08-phase2a-retrospective.md`. The May 8 base document was written *during* the T6.4 readiness window — before cutover executed. This supplement records what actually happened on May 9 plus the T6.5 Phase A organizer-mode evening that immediately followed the milestone close.
**Status**: Phase 2A is now **100% complete** (75/75 factories on Python via T6.4 5-stage cascade); T6.5 Phase A discovery + audit + spec amendment also closed today; T6.5 Phase B unblocked next session.
**Author**: organizer chat (PR ops-phase2a-retrospective-update branch)
**Date**: 2026-05-09

This supplement does **not** modify PR #151. Treat the two documents as a paired set: PR #151 = state through May 8 readiness, this doc = May 9 execution + Phase A follow-on.

---

## §0. TL;DR

| Layer | PR #151 base (May 8) | May 9 supplement |
|---|---|---|
| Phase 2A factories on Python | 62/75 (F001 T6.2 + 61 T6.3 test) | **75/75 (100%)** via T6.4 5-stage cascade |
| T6.4 cutover ETA | May 10-14 (5-day stagger plan) | **May 9 06:34 CST close** (40min13s wall-clock — saved 5 days) |
| T6.1 dryrun final | 99.945% (initial 21,724/21,736; crashed at 17h54m on Blue-Green port flip) | **100.000% match** (PR [#166](https://github.com/j4xie/my-prototype-logistics/pull/166) chat 4 22h BG dryrun final report) |
| Rules graduated | 12 (Rules 1-12 in `python-java-port.md`) | unchanged 12 — but **4 new organizer-side feedback rules** graduated tonight (T6.5 Phase A close-out) |
| Open follow-ups (per PR #151 §8) | PR #135 prod deploy + 24h soak + 5-stage cutover + K-1 sister sweep | **All closed during/after cutover** — see §1.4 |
| Java surface area | 50 SmartBI analysis endpoints still live for 14 customer factories + F001 | Java SmartBI traffic now **0** (only F999 internal-test remains; T6.5 Phase A audit + PR #150 spec amend in main) |
| Datasource POST gap | Not in scope | New: PR #185 Chat G shipped 3 Python stubs (mirror Java TODO behavior, no DB write) — surfaced via PR #184 nginx-Python coverage cross-check |

**Bottom line**: PR #151 closed with operational work pending (deploy + soak + cutover). On May 9, that operational work compressed end-to-end into a single calendar day (cascade morning, T6.5 Phase A evening) thanks to the new HARD rule `active-E2E-replaces-passive-soak` (graduated this morning, see §5). Today's evening session demonstrates that 7-PR organizer-mode within a single chat is sustainable when the rules in §5 are followed strictly.

---

## §1. May 9 timeline

### §1.1 Morning — T6.4 5-stage cascade (cutover execution)

Per `project_2026_05_09_phase_2a_complete.md` and PR [#175](https://github.com/j4xie/my-prototype-logistics/pull/175) handoff §1.2:

| Stage | Reload time CST | Backup | Customer factories added | Cumulative on Python |
|---|---|---|---|---|
| Stage 1 | **05:54:06** | `bak.t6_4_s1_pre.20260509_055328` | F002, F003 | 63 |
| Stage 2 | **06:09:03** | `bak.t6_4_s2_pre.20260509_060823` | F004, F006, R001 | 66 |
| Stage 3 | **06:18:01** | `bak.t6_4_s3_pre.20260509_061709` | RES_GML_001 (桂满陇), RES_3101_009 (青花椒 QHJ_PROD) | 68 |
| Stage 4 | **06:29:43** | `bak.t6_4_s4_pre.20260509_062910` | R_GML_DEMO, R_XMX_CHAIN, R_XMX_FRESH | 71 |
| Stage 5 | **06:34:19** | `bak.t6_4_s5_pre.20260509_063332` | R_XMX_FRESH2, R_XMX_FRESH3, R_YHDJ_DEMO (颐和东街), R_YJJ_DEMO | **75** |
| Phase 2A close | **06:46** (E2E verify done) | — | — | **75/75** |

**Cascade wall-clock: 40 min 13 sec** (Stage 1 reload → Stage 5 reload). PR #151 §2.5 / PR #144 originally scoped a 5-day stagger plan May 10-14. Compression came from the new HARD rule `active-E2E-replaces-passive-soak` (§5.1) — per-stage active E2E (organizer Playwright + chat 4 backend log streams) replaced 24-48h passive soak gates; Steve gave explicit GO between stages.

**Phase 2A close ETA per PR #175 outgoing handoff**: May 14 21:00 CST. **Actual close**: May 9 06:46 CST. **5 days saved on milestone close**.

Per-stage smoke totals (chat 3 routing checks via `curl --resolve api.cretaceousfuture.com:443:127.0.0.1`, response-size pattern Python 401=96B / Java 401=188B): Stage 1 9/9, Stage 2 13/13, Stage 3 15/15, Stage 4 16/16 (incl. PCRE boundary check `R_XMX_FRESH` match vs `R_XMX_FRESH2/FRESH3` NOT match), Stage 5 17/17. Backend log cross-routing leak count: **0** across all 5 stages.

### §1.2 Morning PRs (11, organizer-coordinated)

Per PR #175 handoff §3:

| PR | Squash sha | Owner | Topic |
|---|---|---|---|
| [#163](https://github.com/j4xie/my-prototype-logistics/pull/163) | `dce8cf864` | chat 2 | Phase 2B/2C/Phase 3 naming clarification (canonical) |
| [#164](https://github.com/j4xie/my-prototype-logistics/pull/164) | `068d16a4b` | chat 1 | MO worker grep ONNX rename + amendment history typo |
| [#165](https://github.com/j4xie/my-prototype-logistics/pull/165) | `9fb793ae2` | chat 3 | Stage 3 MO 9 high-stakes 48h considerations baked |
| [#166](https://github.com/j4xie/my-prototype-logistics/pull/166) | `c55eb49bf` | chat 4 | T6.1 22h BG dryrun final report — **100.000% match** |
| [#167](https://github.com/j4xie/my-prototype-logistics/pull/167) | `eb42367b7` | chat 2 | Stage 1 (F002+F003) customer comms send schedule |
| [#168](https://github.com/j4xie/my-prototype-logistics/pull/168) | `9e7ccb524` | chat 3 | cutover window override 03:00→14:00 (5 stage MOs + PR #141 amend) |
| [#170](https://github.com/j4xie/my-prototype-logistics/pull/170) | `8dd48e5c7` | chat 2 | Issue #1 Java cross-factory "leak" RCA — Apr 23 cloned data, **NOT a bug** |
| [#171](https://github.com/j4xie/my-prototype-logistics/pull/171) | `ff39fed13` | chat 1 | PR #135 prod redeploy log + analysisType selectivity finding |
| [#172](https://github.com/j4xie/my-prototype-logistics/pull/172) | `50c8e3c41` | chat 2 | F006 capability 503 RCA — `CAPABILITY_ROLLOUT_FACTORIES` cohort gate, **NOT a bug** |
| [#169](https://github.com/j4xie/my-prototype-logistics/pull/169) | `b660d9ad0` | Steve parallel | restaurant filters + recipe validation 8 customer test bug fixes |
| [#173](https://github.com/j4xie/my-prototype-logistics/pull/173) | `04a245a51` | Steve parallel | restaurant audio P1 batch (超收/预估成本/箱数/抄码 LEGACY) |

**Two RCA reframings** (#170 + #172) graduated the new HARD rule `30s-precheck-selective-bug-pattern` (see §5.3) — both turned out to be intentional design (Apr 23 data clone + rollout cohort flag), not code bugs.

### §1.3 Evening — T6.5 Phase A close-out (8 PRs + Chat 9 follow-up)

Per `project_2026_05_09_t6_5_phase_a_close.md` and PR [#187](https://github.com/j4xie/my-prototype-logistics/pull/187) handoff. Single organizer session ~6 hours, 9+ chat parallel:

| PR | Squash sha | Owner Chat | Topic |
|---|---|---|---|
| [#178](https://github.com/j4xie/my-prototype-logistics/pull/178) | `bd8e8afa79` | Chat 1 + Chat 6 (v3/v3.1) | T6.5 Phase A audit (484 → ~520 LOC, v2→v3→v3.1) |
| [#179](https://github.com/j4xie/my-prototype-logistics/pull/179) | `7fc4892ce2` | Chat 4 | Independent cross-verify (306 LOC, 7/7 HIGH confidence + 3 latent finds) |
| [#180](https://github.com/j4xie/my-prototype-logistics/pull/180) | `a0ab310b9d` | Chat 2 | T6.6 F999+4 NOT_SAFE_FALLTHROUGH Python migration spec (337 LOC, Decision 3A) |
| [#181](https://github.com/j4xie/my-prototype-logistics/pull/181) | `6e65eedc98` | Chat 3 | T6.5 Phase B 23-endpoint stub marching order draft (322 LOC) |
| [#182](https://github.com/j4xie/my-prototype-logistics/pull/182) | `b8c3579ed6` | Chat 1 + Chat 8 | PR #150 spec amend (Decision 4B) + Chat 5 typo follow-up (+250/-67) |
| [#184](https://github.com/j4xie/my-prototype-logistics/pull/184) | `962283f9b1` | Chat 5 | nginx-Python coverage cross-check (234 LOC, datasource POST gap discovery) |
| [#185](https://github.com/j4xie/my-prototype-logistics/pull/185) | `44ebf6976c` | Chat G | Python datasource POST/preview/apply stub impl (mirror Java TODO, no DB mutation) |
| [#186](https://github.com/j4xie/my-prototype-logistics/pull/186) | `bffa144c83` | Chat 1 (side) | deploy-smartbi-python.sh SG-aware health check fix (tangential, +34/-2) |
| [#188](https://github.com/j4xie/my-prototype-logistics/pull/188) | `0452e52948` | Chat 9 | placeholder `<chat-G-PR>` → `#185` cleanup post-merge |

**Steve's 4 mid-session decisions** (per project doc):

| # | Decision | Effect |
|---|---|---|
| 1 | **1A** | Approve audit's reduced Phase B/C scope (23 stub + method-level, not wholesale class deletion) |
| 2 | **2A** | Phase B Option A unconditional 410 (F999 ack outage) |
| 3 | **3A** | Schedule T6.6 spec for F999+4 NOT_SAFE_FALLTHROUGH migration |
| 4 | **4B** | Inline audit findings into PR #150 spec (single source of truth, not patch list) |

### §1.4 Open-follow-ups closure (vs PR #151 §8)

PR #151 §8 listed 5 open follow-ups (P2 + post-T6.4). Status as of May 9 23:00 CST:

| PR #151 §8 item | Status May 9 |
|---|---|
| §8.1 K-1 sales fix | ✅ Already shipped May 8 PR [#149](https://github.com/j4xie/my-prototype-logistics/pull/149) (`7e6c35495`) |
| §8.2 14d follow-up agent (May 14 trigger) | ⏸️ Still scheduled — agent will see this supplement plus PR #151 |
| §8.3 Cross-tenant `raw_material_type` schema 重构 | ⏸️ Deferred (PM/business decision, not Phase 2A scope) |
| §8.4 Strict-byte gate Phase 3+ adoption | ⏸️ Reaffirmed — dict-eq sufficient indefinitely per PR #155 frontend impact verification (already in PR #151 §8.4 logic) |
| §8.5 Latent T6.1 dryrun wrapper bugs (task #23 + hardcoded :10010) | ✅ task #23 stale (deploy script Python sync covered by Phase 2A workflow); :10010 hardcode fixed in PR [#128](https://github.com/j4xie/my-prototype-logistics/pull/128) (`66f6e6ff8`) |
| (new) PR #135 prod deploy | ✅ Deployed May 8 11:36 CST per PR [#171](https://github.com/j4xie/my-prototype-logistics/pull/171) — already on prod **before** cascade morning |
| (new) 5-stage cutover execution | ✅ Closed May 9 06:34 — cascade compression (§1.1) |

PR #151 was written assuming a 5-day cutover window. The window collapsed into 40 minutes; all the post-T6.4 P2 items either already shipped (K-1) or remain genuinely deferred (raw-material schema, strict-byte).

---

## §2. Final endpoint port count + dict-eq match rate

| Metric | Value | Source |
|---|---|---|
| SmartBI analysis endpoints ported (Phase 2A scope) | **50** | Same as PR #151 §1 (no new ports today) |
| T6.1 initial dryrun match rate (May 7) | 99.945% (21,724 / 21,736; 12 diverges) | PR #119 (`c501632bb`) — see PR #151 §2.2 |
| **T6.1 BG dryrun final match rate (May 8 → May 9)** | **100.000%** | **PR [#166](https://github.com/j4xie/my-prototype-logistics/pull/166) (`c55eb49bf`)** chat 4 22h Blue-Green dryrun |
| T6.4 cascade smoke (per-stage routing checks) | 70/70 (9+13+15+16+17) | `project_2026_05_09_phase_2a_complete.md` |
| T6.4 cascade backend log cross-routing leak count | **0** across all 5 stages | Same |
| T6.4 cascade HTTP 5xx during reloads | 0 | Same |
| Phase 2A dict-eq gate status | Officially adopted via Rule 4 + PR [#125](https://github.com/j4xie/my-prototype-logistics/pull/125) | PR #151 §1 + `python-java-port.md` Rule 4 Phase 2A standard subsection |
| Strict-byte gate decision | Deferred indefinitely (no frontend hash-compare per PR #155) | PR #151 §8.4 reaffirmed |

**Why initial 99.945% became final 100.000%**: the 12 diverges at T6.1 were 11 Pattern A int-collapse / Pattern A2 trailing-zero (dict-eq tolerable, accepted under Rule 4) + 1 Pattern B legacy-fallback-path gap (closed end-to-end via PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) → PR [#137](https://github.com/j4xie/my-prototype-logistics/pull/137) → PR [#138](https://github.com/j4xie/my-prototype-logistics/pull/138) — see PR #151 §3 Pattern B chain). The May 8 BG dryrun (post-PR-#135 deploy) shows zero diverges remaining at the dict-eq gate.

---

## §3. Per-customer T6.4 stage outcomes

7-factory `[gold-primary]` log signature E2E verification at Phase 2A close (06:10:33 → 06:46:09 CST), via authenticated curl on `api.cretaceousfuture.com` with Host header on 127.0.0.1:443 from server 139:

| Factory | Cutover stage | Gold State | Expected `[gold-primary]` signature | Observed signature | Verified at CST |
|---|---|---|---|---|---|
| F001 | T6.2 (May 7) | populated | State A `served from Gold` | ✅ State A | 06:10:33 |
| F999 | (test, stays Java) | empty | State B `Gold empty — skipping legacy` | ✅ State B | 06:10:33 |
| F002, F003 | Stage 1 (05:54) | empty | State B | (verified via per-stage smoke routing checks; no E2E `[gold-primary]` log harvested for Stage 1 since Gold-empty path doesn't exercise dispatcher) | 05:54+ |
| F004, F006, R001 | Stage 2 (06:09) | empty (F006 capability 503 unrelated to cutover routing — see §1.2 PR #172) | State B | Same | 06:09+ |
| **RES_3101_009** | Stage 3 (06:18) | **populated (Apr 23 clone of F001)** | State A | ✅ **State A** `served from Gold` | **06:43:48** |
| RES_GML_001 | Stage 3 (06:18) | empty | State B | (covered via per-stage smoke routing checks) | 06:18+ |
| Stage 4 customers (R_GML_DEMO, R_XMX_CHAIN, R_XMX_FRESH) | Stage 4 (06:29) | empty | State B | Same | 06:29+ |
| **R_XMX_FRESH2** | Stage 5 (06:34) | empty | State B | ✅ **State B** | 06:46:09 |
| **R_XMX_FRESH3** | Stage 5 (06:34) | empty | State B | ✅ **State B** | 06:46:09 |
| **R_YHDJ_DEMO** | Stage 5 (06:34) | empty | State B | ✅ **State B** | 06:46:09 |
| **R_YJJ_DEMO** | Stage 5 (06:34) | empty | State B | ✅ **State B** | 06:46:09 |

Pattern B 3-state dispatcher (PR #135) verified end-to-end across both State A (Gold-populated, RES_3101_009) and State B (Gold-empty, 4 Stage 5 factories) paths in the cascade window. State C (legacy fallback) was already verified test-side per PR #138.

**Issue catches during cascade**:
- Stage 2 F006 capability 503 — RCA in PR #172, **rollout cohort gate `CAPABILITY_ROLLOUT_FACTORIES="F001,RES_3101_009"`, intentional design, NOT a bug**. Caught via 30-second pre-check (§5.3).
- Issue #1 Java cross-factory "leak" — RCA in PR #170, **Apr 23 deliberate F001→RES_3101_009 data clone (青花椒 staging+prod cohort), NOT a code bug**. Reframed pre-cascade.
- Stage 2 chat 1 Python prod redeploy collision — completed 06:08:07, Stage 2 reload 06:09:03; window healthy, no smoke false-positives.

---

## §4. Java surface area before/after

| Layer | PR #151 base (May 8) | May 9 close + T6.5 Phase A |
|---|---|---|
| Java SmartBI analysis controller methods (live) | 22 (`SmartBIAnalysisController.java`) + 1 (`SmartBIDashboardController.java#getDataDateRange`) = 23 | 23 (unchanged code-wise; Phase B will 410-stub them) |
| Java SmartBI analysis traffic (factory share) | 14 customer factories + F001 dispatched (mid-cutover state) | **0** customer factories on Java; F999 only |
| Datasource POST/preview/apply endpoints (Java) | 3 endpoints, TODO stubs (no DB write) | 3 endpoints (Java) + **3 Python stubs added** (PR #185 mirror Java TODO behavior) |
| Phase A audit deletion candidates | n/a | Per PR #178 v3.1: 23 stub-out + method-level Phase C, **NOT** wholesale class deletion (Decision 1A reduced original spec scope) |
| `GoldDashboardBuilder` (Java) | Listed as KEEP per task #24 | **Reaffirmed KEEP** by PR #178 cross-verify — NOT orphaned (memory `reference_smartbi_gold_layer_architecture.md` may need update with this evidence) |
| F999 + 4 NOT_SAFE_FALLTHROUGH endpoints | Implicit — no explicit migration plan | **Explicit T6.6 spec** PR #180 (337 LOC, Decision 3A); trigger after T6.5 Phase B + C complete (~mid-July 2026) |
| nginx vhost regex (factories on Python) | post-T6.3: 61 test factories | post-T6.4 final: **75 factories** (`(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)`) |
| Backup chain | 4 backups (Apr 11 + T6.0 + T6.2 + T6.3) | **9 backups** (added 5 stage backups May 9 — preserve ≥30 days per Stage 5 MO ⛔ HOLD) |

The 23-endpoint stub plan + T6.6 spec mean Java SmartBI Analysis surface area starts shrinking only in Phase B; today's close moves traffic but does not yet remove code.

---

## §5. Lessons learned — May 9 (4 organizer-side feedback rules graduated)

PR #151 §6 covered Apr 30 → May 8 organizer-side patterns (projection bug, narrow-scope sweep, marching-order separation, admin-merge file scope, main-worktree isolation, pause-before-deploy, safe-commit). Today **4 additional rules** graduated. Ordered by today's incidence:

### §5.1 `feedback_active_e2e_replaces_passive_soak.md` (HARD)

**Rule**: 0-customer state — no passive soak. Active E2E (Playwright / agent-browser / e2e-web-admin / curl with Host header) replaces 24h/48h soak windows.

**Trigger**: Steve mandate during Stage 1 dispatch (~05:00 CST). Original PR #144 5-stage MO had 24-48h passive soak between stages over 5 days. Steve override: "0 customers using product → soak = empty restaurant checking the kitchen (no signal). Use Claude in Chrome / Playwright / agent-browser to actively probe instead of passively wait."

**Effect**: Cascade compressed 5-day plan to 40 min wall-clock. Per-stage flow: cutover → smoke 5-10 min → active E2E 15-30 min → next stage IMMEDIATELY.

**Boundary**: When real customers return to using the product, passive soak resumes meaning. Today's HARD rule applies specifically to pre-customer-return state.

### §5.2 `feedback_dispatch_on_technical_readiness.md` (HARD)

**Rule**: Don't pad trigger timing for operator alertness / prod runtime convenience / inherited anchors / aesthetic cleanliness. Technical prereq satisfied → fire NOW. Wait ONLY for hard prereq pending / wall-clock soak / sibling sync / Steve explicit ask.

**Trigger**: 13:01 CST inherited dispatch anchor for PR #135 prod deploy MO. Anchor was tied to wrong BG dryrun ETA (handoff projected ~13:00 CST; actual BG firing 05:01 CST per `ps lstart` + NDJSON ts). When BG fired ~8 hours early, organizer kept padding the dispatch for "operator alertness" — a meaningless hold in 0-customer state. Steve correction: "没必要等".

**Effect**: 7.5h waste this morning before correction. Going forward, any timing anchor must be recomputed against current ground truth, not inherited.

### §5.3 `feedback_30s_precheck_selective_bug_pattern.md` (HARD)

**Rule**: When a bug pattern is selective per-factory, grep factory_id literals + env flags + config defaults FIRST (~30 sec) before deep code investigation. F001 + RES_3101_009 specifically is the known "Gold-populated cohort" — selective behavior gating on this set defaults to intentional design.

**Trigger**: Two consecutive 2026-05-09 RCAs both turned out to be intentional design:
1. PR #170 (chat 2): Issue #1 Java cross-factory "Gold leak" — Apr 23 deliberate F001→RES_3101_009 data seed clone. ~90 min of deep code investigation before grep would have surfaced the cohort literal.
2. PR #172 (chat 2): F006 capability 503 — env flag `CAPABILITY_ROLLOUT_FACTORIES="F001,RES_3101_009"` rollout cohort gate. ~30 min into investigation before grep on the env flag exposed the design intent.

**Effect**: 30-90 min saved per incident in selective-pattern bugs. Two-incident-in-one-day graduation threshold met cleanly.

### §5.4 Tonight's T6.5 Phase A graduate set (4 evening rules)

`project_2026_05_09_t6_5_phase_a_close.md` records 4 organizer-side mistakes caught by sister chats during evening session, each producing one feedback rule:

| # | Mistake (caught by) | Rule graduated |
|---|---|---|
| A | Marching order path drift `intent_classifier/` → 实际 `classifier/` (Chat 2 PR-Y impl) | (folded into §5.5 below) |
| B | Marching order method name drift × 8 (`getFinanceBudgetAchievement` → 实际 `getBudgetAchievementChart` etc.) — root cause: paraphrased from URL path instead of grep'ing source (Chat 3 PR-Z impl) | `feedback_marching_order_method_name_grep.md` |
| C | `SmartBIAnalysisControllerTest.java` 不存在 (audit §C.2 假设要删) (Chat 3 PR-Z impl) | (folded into §5.5 below) |
| D | Datasource 6 endpoints 全标 "Python ✓" 但实际 3/6 false positive (POST upload/preview/apply Python no `@router` declaration despite file 存在) (Chat 4 PR-W cross-verify) | `feedback_audit_endpoint_impl_not_router.md` |

Plus two cross-cutting rules:
- `feedback_sister_chat_cross_verify_high_value.md` — Chat 4 PR-W cross-verify caught Mistake D (3/6 false positive) + 1 spec drift; ROI ~100x (5h cross-verify vs ~2-week Phase B rework prevented). Pattern: dispatch independent sister chat to grep + reach own conclusions on critical multi-month-plan-feeding audits, compare against source audit.
- `feedback_organizer_dispatch_not_handson.md` — Steve corrected organizer twice today on attempting hands-on edits when ≥1 sister chat available. Apr/May累计累犯. Organizer-only work = memory + handoff + retrospective synthesis + admin-merge clicks; everything else dispatch.

### §5.5 Process insight: organizer-side mistakes vs sister-chat verification

A-D pattern: **organizer dispatch text drifted from Java source code reality**, sister chats caught it during impl-level grep. This is the same shape as the May 2 organizer projection bug catches (PR #151 §6.1) but at a different layer — there the projection was about PR/commit existence, here it's about source code identifier accuracy.

Mitigation baked into the §5.4 rules: organizer must `Grep` real Java/Python source for any method name / file path / endpoint listing **before** including it in a marching order. The cost (~30 sec per identifier) is dwarfed by the cost of one sister chat doing wasted work on a phantom symbol.

---

## §6. 4-chat parallel coordination → 9-chat parallel pattern

PR #151 §7 documented 4-chat parallel as the Phase 2A peak. Tonight's T6.5 Phase A close-out ran **9+ chat parallel** sustainably for ~6 hours and shipped 7 PRs. Notable scaling differences:

### §6.1 Specialty assignment becomes mandatory at 9+ chats

PR #151 §7.3 noted "loose specialty alignment" at 4-chat. At 9+ chat parallel, specialty becomes load-bearing:

| Chat | Specialty (today) | PR count |
|---|---|---|
| Chat 1 | spec amend + side ops fixes | 2 (PR #182, PR #186) |
| Chat 2 | spec writer (T6.6 from cold) | 1 (PR #180) |
| Chat 3 | marching-order author (Phase B from PR #178 audit) | 1 (PR #181) |
| Chat 4 | independent cross-verifier | 1 (PR #179) |
| Chat 5 | coverage cross-check (datasource gap discovery) | 1 (PR #184) |
| Chat 6 | audit follow-up (v3 + v3.1 framing fix) | 1 (PR #178 v3) |
| Chat 7 | Chat G dispatcher (background) | 0 (orchestration) |
| Chat 8 | typo follow-up (Chat 5 catch) | 0.5 (PR #182 follow-up) |
| Chat G | Python impl (datasource POST stubs) | 1 (PR #185) |
| Chat 9 | post-merge placeholder cleanup | 0.5 (PR #188) |

Without specialty alignment + dispatch rules from §5.4, the same workload would have required organizer to context-load every chat fully each cycle.

### §6.2 Independent cross-verify pattern (proven high-value)

PR #179 (Chat 4) is a clean existence proof of the `feedback_sister_chat_cross_verify_high_value.md` rule. Chat 4 was given the audit prompt **without reading PR #178 or PR #182**, dispatched in parallel with Chat 1's audit. Chat 4 independently grep'd source and reached conclusions; the comparison surfaced 3 latent findings + 1 spec drift Chat 1's audit missed. Tonight's session shows the pattern catches both sides — organizer-projected dispatch errors AND audit blind spots.

### §6.3 Single-session admin-merge throughput at upper bound

PR #151 §7.4 noted 18 PRs in single organizer session as the May 8 throughput. Today:
- Morning session: 11 PRs admin-merged (Phase 2A close)
- Evening session: 8 PRs admin-merged (T6.5 Phase A close-out)
- Total May 9: **19 PRs single calendar day**

Per `project_2026_05_09_t6_5_phase_a_close.md` — "Proved 7-PR/session organizer-mode is sustainable with strict discipline on rules 11-14 (graduated tonight)." 11+ PRs in single session (May 8) remains hard upper bound; 7-PR T6.5-style organizer-mode sessions are repeatable with §5.4 discipline.

---

## §7. Process insights

### §7.1 Organizer dispatch borderline cleanup is acceptable

Chat 9's PR #188 (placeholder cleanup `<chat-G-PR>` → `#185`) is a borderline case: organizer would normally dispatch this to a sister chat per `feedback_organizer_dispatch_not_handson.md`. But the cleanup was a deterministic sed replace (~1 min) that needed to happen *after* PR #185 merged but *before* organizer signed off. The chat was already idle and self-discovered the cleanup as in-scope. Per Steve no objection raised, the boundary is: organizer can do trivially-deterministic post-merge cleanup that has no design judgement; anything with design judgement → dispatch.

### §7.2 Handoff projection drift is systemic

Two projection bugs caught in this morning's handoff doc (PR #175, written by outgoing organizer):
1. BG dryrun ETA "~13:00 CST" — actual ~05:01 CST per `ps lstart` + NDJSON ts (caught immediately).
2. T6.4 stage cutover "14:00 CST" — actual 03:00-05:00 per PR #144/#141 ground truth (caught by chat 2 §0 conflict gate in schedule runbook). Steve override 2026-05-09: T6.4 explicit one-time override to 14:00 (operator alertness > hypothetical low-traffic with 0 customers using product).

Lesson: verify handoff timing claims against shipped PR content via `git show` / `grep` before dispatch — handoff projection drift extends from the May 2 organizer-projection bug rule (PR #151 §6.1) into the timing dimension.

### §7.3 Verification path matters more than verification effort

PR #138 (May 8) used port 8084 test env curl → confirmed Pattern B 3-state working. Tonight's E2E (§3) used `api.cretaceousfuture.com` with Host header on 127.0.0.1:443 → confirmed cutover routing actually exercised Python's analysis_finance.py dispatcher.

A subtle pre-cascade verification gap was caught by chat 4 streams: organizer initially used Playwright via `http://139.196.165.140:8086/api/mobile/...` (web-admin frontend port). That returned 4 KPIs for RES_3101_009 — looked like State A success — BUT Python prod log showed ZERO `[gold-primary]` entries for RES_3101_009. Web-admin port 8086 uses a DIFFERENT nginx vhost (`web-admin.conf`) that proxies `/api/mobile/*` differently from the production T6.4 cutover vhost (`api.cretaceousfuture.com.conf`).

Future cutover verification MUST use `api.cretaceousfuture.com` directly (curl with Host header or DNS), NOT web-admin frontend.

Other discoveries (memorialized in `project_2026_05_09_phase_2a_complete.md`):
- Empty `analysisType` query param is the canonical composite path for `/smart-bi/analysis/finance` endpoint. `analysisType=overview` falls through to 501 envelope. Frontend Vue calls empty analysisType naturally.
- F001 + RES_3101_009 are the "Gold-populated cohort" — selective behavior gating on this set defaults to intentional design (driven §5.3 graduation).

---

## §8. Cross-references

### §8.1 PRs referenced in this supplement

**Morning Phase 2A close (11 PRs)**: #163, #164, #165, #166, #167, #168, #170, #171, #172 (organizer-coordinated) + #169, #173 (Steve parallel restaurant track)

**Evening T6.5 Phase A close-out (8 PRs + Chat 9 follow-up)**: #178, #179, #180, #181, #182, #184, #185, #186, #188

**Cross-reference (closing items from PR #151)**: #128 (`:10010` hardcode fix), #135 (Pattern B 3-state already on prod May 8), #149 (K-1 sales fix already shipped May 8)

### §8.2 Companion docs

- PR #151 base: `docs/qa-audits/2026-05-08-phase2a-retrospective.md` (May 8 readiness window snapshot — DO NOT modify)
- PR #175 morning handoff: `docs/superpowers/dispatch/2026-05-09-organizer-handoff-phase-2a-close.md`
- PR #187 evening handoff: `docs/superpowers/dispatch/2026-05-09-organizer-handoff-t6-5-phase-a-close.md`
- T6.5 Phase A audit (final v3.1, in PR #178): `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`
- T6.6 spec (PR #180): `docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md`
- T6.5 Phase B MO draft (PR #181): `docs/superpowers/dispatch/2026-05-15-t6-5-phase-b-stub-marching-order.md`
- nginx-Python coverage cross-check (PR #184): `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md`

### §8.3 Memory files added today

| File | Type |
|---|---|
| `project_2026_05_09_phase_2a_complete.md` | project — Phase 2A 100% close cascade timeline + verification matrix |
| `project_2026_05_09_organizer_handoff_taken.md` | project — fresh organizer chat takeover + 2× projection bugs caught |
| `project_2026_05_09_t6_5_phase_a_close.md` | project — evening 7-PR organizer-mode session detail |
| `feedback_active_e2e_replaces_passive_soak.md` | feedback (HARD) |
| `feedback_dispatch_on_technical_readiness.md` | feedback (HARD) |
| `feedback_30s_precheck_selective_bug_pattern.md` | feedback (HARD) |
| `feedback_marching_order_method_name_grep.md` | feedback (HARD) |
| `feedback_audit_endpoint_impl_not_router.md` | feedback (HARD) |
| `feedback_sister_chat_cross_verify_high_value.md` | feedback (pattern) |
| `feedback_organizer_dispatch_not_handson.md` | feedback (HARD) |
| `reference_f006_liutengmen_prod_accounts.md` | reference — F006 16 prod user accounts for E2E |

### §8.4 Codified rules unchanged

12 Rules in `.claude/rules/python-java-port.md` unchanged today. Rule 4 Phase 2A dict-eq gate standard subsection (added May 7 per PR #125) reaffirmed by today's 100.000% BG dryrun final + zero-leak cascade.

---

## Caveats

This supplement is written **on the same calendar day** as the events recorded — the cutover finished at 06:34 CST and this doc was drafted by an evening organizer chat. Same caveat as PR #151 applies: outcomes after May 9 (T6.5 Phase B kickoff, post-Phase-2A real-customer return, T6.6 trigger ~July) will produce further follow-up documents.

The 5-day-saved compression (§1.1) and 9-chat parallel sustainability (§6) are claims grounded in this single calendar day. Future similar work will test whether the §5 HARD rules generalize beyond the specific 0-customer state we operated in today.

Per `feedback_organizer_projection_bug.md` and the supplement's own discipline: cite PRs / commits / memory files — never speculate beyond what's verifiable. All PRs cited in this doc are merged to `origin/main` as of `git log origin/main --oneline | head -1` = `0452e52948` (PR #188); all memory files cited exist in `~/.claude/projects/.../memory/` at time of writing; all verifications (cascade timestamps, smoke totals, regex contents) are sourced from `project_2026_05_09_phase_2a_complete.md` and PR #175 / PR #187 handoff docs.

Generated 2026-05-09 by organizer chat as supplement to PR #151. Does not modify PR #151. Treat as paired set.
