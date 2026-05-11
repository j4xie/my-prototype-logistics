# T6.6 Phase B Sub-A + Sub-B Spec — Dispatch-Readiness Audit

**Audit date**: 2026-05-12
**Auditor**: chat4 (Sub-A/B impl spec dispatch, post-`/clear` 2026-05-12)
**Branch**: `spec/t6-6-sub-a-sub-b-impl-spec`
**Scope**: Verify dispatch-readiness state of `2026-05-12-t6-6-sub-a-production-impl-spec.md` + `2026-05-12-t6-6-sub-b-quality-impl-spec.md` for sister-chat impl dispatch (chat-A1/A2/A3 + chat-B1/B2/B3 + shared chat-AB-1/AB-2).
**Status**: 🟡 **AMBER** — Specs ready for review + Steve Q-DEC default acceptance; sister-chat dispatch HOLD per MO PR #249 §⛔ pre-flight.

---

## 1. Preflight Verification

### 1.1 Ratified decisions (✅ GREEN)

| Decision | Ratification PR | Spec doc | Status |
|---|---|---|---|
| Q4 = Option B (餐饮重定义 Production) | PR #326 §1 | `2026-05-12-t6-6-restaurant-semantics-decision.md` §1 | ✅ Ratified |
| Q5 = Option B (餐饮重定义 Quality) | PR #326 §2 | same §2 | ✅ Ratified |
| Q-DEC-6 = F1 narrower scope (return_qty only, DEFAULT NULL) | PR #330 + PR #335 §5.2 amend | `2026-05-09-t6-6-q1-real-db-amendment.md` §5.2 | ✅ Ratified |
| Q-DEC-8 = Option A (single URL polymorphic envelope) | PR #330 §9 | `2026-05-12-t6-6-restaurant-semantics-decision.md` §3 | ✅ Ratified |
| `data/imports/restaurant-chains/` gitignore policy | PR #330 §9 | same §9 | ✅ Ratified |

### 1.2 ETL infrastructure status (Step 1+3 LIVE / Step 2 in flight)

| Migration | Purpose | Status | Evidence |
|---|---|---|---|
| V20260511_01 | `restaurant_chain_catalog` control-plane table | ✅ LIVE prod | PR #325 ship |
| V20260511_02 | Seed 14 REAL chains | ✅ LIVE prod | PR #325 ship; idempotent ON CONFLICT |
| V20260511_03 | `fact_pos_item.return_qty` column (Q-DEC-6 F1) | ✅ LIVE prod | PR #331 ship |
| Sub-ETL-2 Step 2 Silver/Gold loader | Canonical CSV → fact_pos_item incl. `qty_refund` → `return_qty` mapping | 🟡 **IN FLIGHT** | chat1 redispatch per PR #338 organizer brief |

**Critical**: Sub-ETL-2 Step 2 ship UNBLOCKS chat-A2 (M3 proxy SQL needs fact_pos_transaction rows) + chat-B2 (N3 return rate needs fact_pos_item.return_qty rows). Sub-B chat-B2 dispatch should NOT start until Step 2 ships.

### 1.3 Q-DEC defaults — Steve sign-off status

Per PR #330 §9 sign-off table:

| Q-DEC | Decision | Default path | Steve status | Blocking? |
|---|---|---|---|---|
| Q-DEC-1 (M1 厨房工位 default) | A1 emit null + marker | ✅ Default acceptable | ⏳ Pending explicit acceptance | Sub-A chat-A2 dispatch |
| Q-DEC-2 (M2 备菜时间 default) | B1 emit null + marker | ✅ Default acceptable | ⏳ Pending | Sub-A chat-A2 dispatch |
| Q-DEC-3 (M3 翻台率 default) | C1 proxy bills_per_store | ✅ Default acceptable | ⏳ Pending | Sub-A chat-A2 dispatch |
| Q-DEC-4 (N1 食安事故 default) | D1 emit null + marker | ✅ Default acceptable | ⏳ Pending | Sub-B chat-B2 dispatch |
| Q-DEC-5 (N2 投诉率 default) | E1 rating-based per chain | ✅ Default acceptable | ⏳ Pending | Sub-B chat-B2 dispatch |
| Q-DEC-6 (N3 退菜率 ETL extension) | F1 narrower scope | ✅ Ratified PR #330 | ✅ DONE | — |
| Q-DEC-7 (N4 损耗率 default) | G1 per-chain conditional | ✅ Default acceptable | ⏳ Pending | Sub-B chat-B2 dispatch |
| Q-DEC-8 (Endpoint shape) | Option A polymorphic | ✅ Ratified PR #330 | ✅ DONE | — |
| Q-DEC-9 (Omit OK marker) | Omit when value present | ✅ Default acceptable | ⏳ Pending | All chat-A2/B2/A3/B3 |
| Q-DEC-10 (proxyMetric nesting) | Nested object | ✅ Default acceptable | ⏳ Pending | Sub-A chat-A2 |

**Recommendation**: Organizer dispatches single AskUserQuestion batch covering Q-DEC-1..5/7/9/10 (8 questions, all recommend "Accept default") to Steve before chat-A2/B2 dispatch. Estimated ~5 min Steve time, unblocks 6 sister impl chats.

### 1.4 No canonical HOLD on spec push (✅ GREEN per organizer brief)

Per organizer pre-flight grep per HARD rule `feedback_organizer_dispatch_must_grep_canonical_HOLD.md`:
- ✅ No HOLD on Sub-A/B impl spec draft itself (spec docs only, no code)
- ⛔ HOLD applies to **execute** dispatch (chat-A1/A2/A3 + chat-B1/B2/B3) until T6.5 Phase C close + active-E2E gate clears

---

## 2. Spec Coverage Matrix

### 2.1 Sub-A Production spec coverage

| Required section | Status | Source |
|---|---|---|
| §1 Endpoint shape (Option A) | ✅ Complete | This spec |
| §2 Factory tenant impl (8 methods) | ✅ Complete | References PR #199 detail spec |
| §3 Restaurant tenant impl (3 metrics) | ✅ Complete | References PR #337 §3 verbatim |
| §4 dataAvailability marker rules | ✅ Complete | PR #330 §3.4 controlled vocab |
| §5 SQL query templates | ✅ Complete (factory provisional per §2.3) | M3 proxy from PR #337 §3.5 |
| §6 dict-eq parity gate setup | ✅ Complete | Q1 §4.5 informational + Python-vs-Python regression |
| §7 8-batch dispatch breakdown | ✅ Complete | chat-A1/A2/A3 + shared AB-1/AB-2 |
| §8 Sign-off checklist | ✅ Complete | Pre-dispatch + per-chat + close |

### 2.2 Sub-B Quality spec coverage

| Required section | Status | Source |
|---|---|---|
| §1 Endpoint shape (Option A) | ✅ Complete | References Sub-A §1.2 envelope |
| §2 Factory tenant impl (7 methods) | ✅ Complete | References PR #203 detail spec |
| §3 Restaurant tenant impl (4 metrics) | ✅ Complete | References PR #337 §4 verbatim |
| §4 dataAvailability marker rules | ✅ Complete (incl. Q-DEC-6 F1 LIVE verification) | PR #330 §3.4 + V20260511_03 evidence |
| §5 SQL query templates | ✅ Complete (factory provisional per §2.3) | N2/N3/N4/ranking from PR #337 §4 |
| §6 dict-eq parity gate setup | ✅ Complete (2-pilot regression) | Q1 §4.5 + PR #330 §6.2 |
| §7 8-batch dispatch breakdown | ✅ Complete | chat-B1/B2/B3 + shared AB-1/AB-2 |
| §8 Sign-off checklist | ✅ Complete | Same structure as Sub-A |

### 2.3 Cross-spec consistency

| Item | Sub-A | Sub-B | Consistent? |
|---|---|---|---|
| Polymorphic envelope (§1.2) | Single URL, tenant-typed | Same | ✅ |
| tenant.py module | Created by chat-A1 | Imported by chat-B1 | ✅ Coordinated |
| Per-metric envelope contract (§1.5) | 7 fields | Same | ✅ |
| LinkedHashMap key order convention | Rule 8 mirror golden | Same | ✅ |
| Lombok null-emit (Rule 9) | All fields emit | Same | ✅ |
| Java mock fallback if Silver missing | Documented §2.3 | Same §2.3 | ✅ |
| Restaurant goldens location | `python-smartbi-golden/` dir | Same | ✅ |
| Parity gate (factory dict-eq informational, restaurant regression) | §6 | §6 | ✅ |
| 8-batch shared chats (AB-1, AB-2) | §7.4-7.5 | References Sub-A §7 | ✅ |

---

## 3. Sister-Chat Dispatch Readiness Criteria

### 3.1 chat-A1 (Sub-A factory) readiness

- ✅ Spec §2 + §5.2 + §6.1 written
- ✅ PR #199 detail spec exists (method-level directive)
- ✅ Java source `ProductionAnalysisServiceImpl.java` LIVE (prod) for read-only mirror
- ⏳ Q-DEC-9 default pending Steve (envelope OK-marker omission)
- ⛔ MO #249 §⛔ HOLD on impl execution (T6.5 Phase C close + active-E2E gate)
- 🟡 **Schema gap risk**: factory Silver tables may not exist (§2.3 fallback path documented)

### 3.2 chat-A2 (Sub-A restaurant) readiness

- ✅ Spec §3 + §5.1 + §6.2 written
- ✅ PR #337 §3 mechanical sibling exists (verbatim Python code)
- ✅ V20260511_02 LIVE (factory_id R_ILTEATRO_REAL exists)
- ⏳ Sub-ETL-2c ship pending (Step 2 chat1 in flight)
- ⏳ Q-DEC-1/2/3/9/10 defaults pending Steve
- ⛔ MO #249 §⛔ HOLD

### 3.3 chat-A3 (Sub-A wiring) readiness

- ✅ Spec §4 + §7.3 written (audit + integration smoke scope)
- ⏳ Depends on chat-A1 + chat-A2 PR merges
- ⛔ MO #249 §⛔ HOLD

### 3.4 chat-B1 (Sub-B factory) readiness

- ✅ Spec §2 + §5.2 + §6.1 written
- ✅ PR #203 detail spec exists
- ✅ Java source `QualityAnalysisServiceImpl.java` LIVE
- ⏳ Q-DEC-9 pending
- ⛔ MO #249 §⛔ HOLD
- 🟡 **Pareto translation correctness**: §2.2 stateful loop is high-attention reviewer audit gate (cumulative percentage 80% threshold semantics)
- 🟡 Schema gap risk: same as chat-A1

### 3.5 chat-B2 (Sub-B restaurant) readiness

- ✅ Spec §3 + §5.1 + §6.2 written (2-pilot regression)
- ✅ V20260511_03 LIVE prod (Q-DEC-6 F1 column shipped)
- ✅ PR #337 §4 mechanical sibling exists
- ⏳ Sub-ETL-2c ship pending (return_qty rows in fact_pos_item)
- ⏳ Q-DEC-4/5/7/9/10 defaults pending Steve
- ⛔ MO #249 §⛔ HOLD
- 🟡 **Rule 1 emphasis**: N3 §3.3 null-vs-zero semantics — reviewer audit critical gate (`return_qty IS NULL` legacy vs `0` explicit zero distinct)

### 3.6 chat-B3 (Sub-B wiring) readiness

- ✅ Spec §4 + §7.3 written
- ⏳ Depends on chat-B1 + chat-B2 PR merges
- ⛔ MO #249 §⛔ HOLD

### 3.7 chat-AB-1 (combined parity) readiness

- ✅ Spec §7.4 written
- ⏳ Depends on PR-A1/A2/A3 + PR-B1/B2/B3 merges
- ⛔ MO #249 §⛔ HOLD

### 3.8 chat-AB-2 (cutover prep) readiness

- ✅ Spec §7.5 written
- ⏳ Depends on chat-AB-1 + T6.5 Phase C close + active-E2E gate
- ⛔ MO #249 §⛔ HOLD

---

## 4. 8-Batch Sequencing Dependencies

```
Pre-flight (organizer):
├── ✅ V20260511_01/02/03 LIVE prod
├── ✅ Q-DEC-6 + Q-DEC-8 ratified
├── ⏳ AskUserQuestion batch Q-DEC-1..5/7/9/10 → Steve sign-off
├── ⏳ Sub-ETL-2 Step 2 ship (chat1 in flight)
└── ⛔ MO #249 §⛔ pre-flight clear (T6.5 Phase C close + active-E2E)

  ↓ (all pre-flight green)

Wave 1 (parallel — independent file scopes):
├── chat-A1 (factory production) ~3-4pd  ──→ creates tenant.py + analysis_production.py skeleton
└── chat-B1 (factory quality)    ~3-4pd  ──→ imports tenant.py, creates analysis_quality.py skeleton
  ↓ (PR-A1 + PR-B1 merged)

Wave 2 (parallel — independent file scopes):
├── chat-A2 (restaurant production) ~3-4pd  ──→ adds restaurant branch to analysis_production.py
└── chat-B2 (restaurant quality)    ~3-4pd  ──→ adds restaurant branch to analysis_quality.py
  ↓ (PR-A2 + PR-B2 merged + Sub-ETL-2c LIVE)

Wave 3 (parallel — audit + wiring):
├── chat-A3 (Sub-A wiring) ~1-2pd
└── chat-B3 (Sub-B wiring) ~1-2pd
  ↓ (PR-A3 + PR-B3 merged)

Wave 4 (combined):
└── chat-AB-1 (parity gate + integration) ~2pd
  ↓ (PR-AB-1 merged)

Wave 5 (cutover prep):
└── chat-AB-2 (cutover prep + nginx flip prep) ~1pd
  ↓ (organizer GO)

Cutover (organizer-owned):
└── Blue-green Python flip + active-E2E + customer comms
```

**Total Sub-A+Sub-B effort**: ~14-16pd combined (5-6pd Sub-A + 9pd Sub-B per PR #330 §1.4 / §2.4) + 3pd combined chats = ~17-19pd Phase B Sub-A/B total.

---

## 5. Open Items + Risks

### 5.1 Spec docs (this PR scope)

- [x] Sub-A spec written (~480 LOC)
- [x] Sub-B spec written (~530 LOC)
- [x] This audit doc written (~150 LOC)
- [ ] Reviewer audit cycle (recommend 1-2 cycles on this PR per `feedback_subagent_driven_audit_pattern.md`)
- [ ] Steve verbal sign-off OR Q-DEC AskUserQuestion batch

### 5.2 Risks / spec-side concerns

| Risk | Impact | Mitigation |
|---|---|---|
| Factory Silver tables (`fact_production_batch` / `fact_quality_inspection` etc.) may not exist | Sub-A/B factory branch ports BLOCKED OR mock-mirror exception needed | chat-A1/B1 first-step grep + escalate to organizer; spec §2.3 documents fallback path |
| Sub-ETL-2c ship slip | Sub-A chat-A2 + Sub-B chat-B2 unblocked but produce all-null restaurant payloads | Spec §0 documents graceful degradation; dispatch chat-A2/B2 IS OK pre-Step 2 (gradual data fill post-ship) |
| Q-DEC defaults rejected by Steve | Restaurant branch impl rewrite needed | AskUserQuestion early; defaults are unambiguous (Option A1/B1/C1/D1/E1/G1 + omit-OK + nested-proxy) — low rejection risk |
| Tenant detector edge cases (HEADQUARTERS / CENTRAL_KITCHEN) | Factory-branch routing for these types | Spec §2 of PR #337 explicit — treat as factory; no test gap |
| 14 chains' fact_pos_transaction rows insufficient for meaningful M3 proxy | M3 proxy returns null when bill_count == 0 | Acceptable per spec §3.3 empty-data path; chat-AB-1 spot-checks 3+ chains |
| Java mock divergence on factory branch dict-eq | Reviewer mistakenly flags as bug | Spec §6.1 explicit: divergence informational, not gate-failing; reviewer audit cycle education |
| Concurrent edit (chat-A1 vs chat-B1 both writing tenant.py) | File-overwrite collision | Marching-order separation per `feedback_concurrent_edit_safety.md` Rule 2 — coordinate worktree timing; OR chat-A1 ships first, chat-B1 imports |

### 5.3 Out-of-scope for Sub-A/B (deferred to Phase 2D)

- M3 真值 ETL (dim_store.table_count + manual back-fill) — defer
- Cross-chain 大众点评 scrape ingestion (N2 expand beyond 青花椒) — defer
- N4 wastage Web-Admin manual entry workflow — defer
- N1 fact_food_safety_incident table — defer
- M1 fact_kitchen_station_event table — defer
- M2 dual-timestamp fact_pos_transaction extension — defer

These are PR #330 §1.5 + §2.5 ETL extension scope; out of Sub-A/B impl spec.

### 5.4 Customer-facing routing (DEFERRED)

Per Q1 §8 Q3 default: 14 new factory_ids (R_*_REAL) are **internal showcase only** by default. nginx alternation regex (per PR #178 §2.2) does NOT include `R_*_REAL` for customer-facing routes. chat-AB-2 cutover prep does NOT add customer routing — separate Q3 decision per Phase 2D customer onboarding.

---

## 6. Sign-off

### 6.1 This PR (spec docs + audit doc)

- [x] chat4 self-review: 3 docs internally consistent, cross-refs valid
- [ ] Reviewer audit cycle 1 (per `feedback_subagent_driven_audit_pattern.md`)
- [ ] Reviewer audit cycle 2 (if cycle 1 surfaces issues)
- [ ] Steve sign-off (verbal or via PR review)
- [ ] STOP-and-ping organizer per HARD rule before push

### 6.2 Phase B Sub-A/B kickoff (post-this-PR)

- [ ] AskUserQuestion batch Q-DEC-1..5/7/9/10 → Steve accept defaults
- [ ] Sub-ETL-2 Step 2 (chat1) ship + smoke
- [ ] MO PR #249 §⛔ pre-flight gates clear (T6.5 Phase C close + active-E2E)
- [ ] organizer dispatches chat-A1 + chat-B1 in parallel (Wave 1)

### 6.3 Phase B Sub-A/B close (post-Wave 5)

- [ ] All 8 sister-chat PRs merged + green
- [ ] Factory dict-eq divergence categorized in `docs/qa-audits/2026-08-XX-sub-a-sub-b-parity-gate-evidence.md`
- [ ] Restaurant regression 100% match for 3 pilot factory_ids
- [ ] active-E2E 30-min smoke incl. customer-facing surface (per HARD rule)
- [ ] T6.5 Phase C 30-day soak overlap
- [ ] Customer comms drafted (chat-AB-2)
- [ ] organizer GO for blue-green Python cutover

---

## 7. Cross-references

| Doc | Path | Relation |
|---|---|---|
| **Sub-A spec** | `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` | This audit verifies its readiness |
| **Sub-B spec** | `docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md` | This audit verifies its readiness |
| Q4/Q5 decision (PR #330) | `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` | Authoritative parent for restaurant semantics; this audit confirms ratification |
| Q4/Q5 impl-shape (PR #337) | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` | Immediate predecessor of Sub-A/B; verbatim source for restaurant branches |
| Phase B pre-flight audit (PR #298) | `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` | §6.1 recommended Sub-A/B impl spec — closed by this PR |
| ETL infra design (PR #316) | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` | Sub-ETL dependencies cited in §1.2 + §4 |
| Sub-ETL-2 sub-spec | `docs/superpowers/specs/2026-05-11-sub-etl-2-*.md` | Step 2 in flight per chat1; blocking chat-A2/B2 data fill |
| MO PR #249 | `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` | §⛔ HOLD gate blocking all chat-A*/B* dispatch |
| python-java-port.md | `.claude/rules/python-java-port.md` | Rules 1-12 applied per Sub-A §6 + Sub-B §6 |
| Concurrent edit safety | `.claude/rules/concurrent-edit-safety.md` | Rule 2 worktree isolation + Rule 5b safe commit |
| feedback_pause_before_deploy_or_push | memory HARD rule | STOP-and-ping organizer before push (this PR + all sister PRs) |
| feedback_organizer_dispatch_must_grep_canonical_HOLD | memory HARD rule | Verifies no HOLD on spec push (§1.4 GREEN) |
| feedback_subagent_driven_audit_pattern | memory | Recommends 1-2 reviewer audit cycles on this PR |

---

## 8. Audit Conclusion

**STATE**: 🟡 **AMBER — Spec docs ready for push; sister-chat dispatch HOLD per MO #249 pre-flight**

### Ready for push
- ✅ Sub-A spec (~480 LOC) consolidates factory + restaurant + 8-batch dispatch
- ✅ Sub-B spec (~530 LOC) consolidates factory + restaurant (2-pilot regression) + dispatch
- ✅ This audit doc (~150 LOC) covers preflight + coverage + risks
- ✅ All cross-refs valid (PR #196/199/203/223/249/298/316/330/335/337)
- ✅ No canonical HOLD on spec push

### Pending before sister-chat dispatch
- ⏳ Steve AskUserQuestion batch: Q-DEC-1..5/7/9/10 default acceptance (8 questions, ~5 min)
- ⏳ Sub-ETL-2 Step 2 ship (chat1 in flight)
- ⛔ MO #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate, ETA ~2026-08-15)

### Recommended next steps for organizer

1. **Immediate**: Review this PR (3 docs) + sign off OR request audit cycle
2. **Post-merge**: AskUserQuestion batch Q-DEC defaults to Steve
3. **Monitor**: Sub-ETL-2 Step 2 ship from chat1 redispatch
4. **Gate**: T6.5 Phase C close + 30-day soak / active-E2E shortcut per HARD rule
5. **Dispatch**: When all green, parallel Wave 1 (chat-A1 + chat-B1)

---

**End of T6.6 Phase B Sub-A + Sub-B Spec Dispatch-Readiness Audit.**

*Author: chat4 (T6.6 Phase B Sub-A/B impl spec dispatch, 2026-05-12 post-`/clear`).*
*Worktree: `.worktrees/t6-6-sub-a-sub-b-impl-spec` (off origin/main HEAD `3d4b702120`).*
*Branch: `spec/t6-6-sub-a-sub-b-impl-spec`.*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_organizer_dispatch_must_grep_canonical_HOLD.md`: STOP-and-ping organizer BEFORE push.*
