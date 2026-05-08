# Organizer Handoff Audit — 2026-05-08 Evening (CST)

**Purpose**: Self-contained handoff for next organizer chat (avoid hallucinations from long session). Fresh chat reads this top-to-bottom, picks up 4-chat parallel coordination without re-deriving context.

**Outgoing organizer date**: 2026-05-08 evening CST
**Today's record**: 29 PRs admin-merged single-session

---

## 1. Project Context — Java→Python Migration Master Plan

Original `docs/superpowers/specs/2026-04-28-python-migration-design.md` defines 4 phases. **Naming has rebranded multiple times causing confusion** — see §1.5 for clarification.

### 1.1 Master plan (original Apr 28)

```
Phase 1 (LLM client) → Phase 2 (SmartBI 全量) ‖ Phase 3 (Tool-Skill 意图) → Phase 4 (Embedding)
```

### 1.2 Current actual progress (verified via git log + file system)

| Phase | Original scope | Status | Progress |
|---|---|---|---|
| **Phase 1 LLM client** | DashScopeClient → Python llm_router | ✅ **100% DONE** | Shipped Apr 28-29 (commits 7d2ca463c+...). PythonLLMClient.java + Python /api/llm/ + 38 callers shim-preserved |
| **Phase 2B-α AI intent** (originally Phase 3) | Bucket A 22-25 files migrated to Python | ✅ **DONE** | Foundation merge gate via #16 (38b545d0c). Stage 4 flag flipped + Stage 5 SEMANTIC BGE live. `backend/python/ai/` full module set. |
| **Phase 2A SmartBI Analysis** | 50 endpoints byte-shape parity | 🔄 **~96%** | Code 100% (T6.1 99.945%) / Cutover 82.7% (62/75 factories) / T6.4 14 customers pending May 10-14 |
| **Phase 2-rest SmartBI** (chat 2 #152 calls "Phase 2B" — naming conflict) | 75 endpoints Config/Dashboard/Upload/PublicDemo | ⏸️ **0%** | Spec scoped today. Kickoff ~July 2026 (gated T6.5 Phase C). 6-9 mo duration |
| **Phase 4 Embedding** | gRPC :9090 → Python HTTP | ⏸️ **DEFERRED indefinitely** | Apr 29 §2 decision: KEEP Java gRPC. Python calls it. |
| **Phase 3 cleanup** (= T6.5 Java SmartBI Analysis 删除) | Post-T6 Java dead code deletion | ⏸️ **spec ready** | PR #150 T6.5 spec (4 phases A/B/C/D, ~58 days). Triggers after T6.4 GO + 7d soak |

### 1.3 Overall Java→Python completion

Approximately **60-65% complete** by value (Phase 1 + Phase 2B-α + Phase 2A code = highest-value ML/AI/analysis chunks). 

Remaining ~35-40%:
- T6.4 cutover stages May 10-14 (closes Phase 2A deployment)
- Phase 2-rest SmartBI 75 endpoints (~6-9 mo)
- Phase 3 cleanup / T6.5 Java SmartBI Analysis 删除 (~58 days post-T6.4)
- Phase 4 Embedding — likely永不迁

ETA full migration complete: **~Q1-Q2 2027**

### 1.4 Naming conflicts (clarify in any future spec)

⚠️ Three rebrands have caused overlap. Future docs should explicitly disambiguate.

| Term | Used by | Means |
|---|---|---|
| "Phase 2B" | Apr 29 spec | AI intent layer migration (= original Phase 3) |
| "Phase 2B" | May 8 chat 2 PR #152 | Non-Analysis SmartBI 75 endpoints (= original Phase 2 rest) |
| "Phase 3" | Apr 28 master plan | Tool-Skill / AI intent migration |
| "Phase 3" | May 2 cleanup design (PR #150 T6.5) | Post-T6 Java code deletion |

**Recommended**: rename current "Phase 2B" (chat 2 #152) → "Phase 2C" or "Phase 2-rest" to avoid AI-intent overlap.

### 1.5 Phase 2A T6 staged cutover (current focus)

| Stage | Status | When |
|---|---|---|
| T6.0 prep | ✅ done | Apr 30 |
| T6.1 dryrun (99.945%) | ✅ done + post-fix marathon | May 5-7 |
| T6.2 F001 canary | ✅ stable since | May 7 04:01 CST |
| PR-3 N=2 multi-worker | ✅ stable since | May 7 11:36 CST |
| **T6.3 61 test factories** | **⏳ 24h soak in flight** | started May 8 11:34 CST, GO ETA ~12:05 CST May 9 |
| **T6.1 22h BG dryrun** | **⏳ ~46% complete** | started May 8 ~07:01 UTC, GO ETA ~13:00 CST May 9 |
| T6.4 14 real customer factories | ⏸️ pending T6.3 GO | starts ~May 10 14:00 CST, Strategy B 5-day stagger |
| T6.5 Java SmartBI Analysis deprecation | ⏸️ spec ready (PR #150) | starts ~July 2026, ~58 days |

---

## 2. Current Production State (verified 2026-05-08)

### 2.1 Server 47 (47.100.235.168) — backend prod

- Java :10010 — active (Blue port currently)
- Java :10020 — Green port standby
- Python :8083 — active (N=2 multi-worker per PR-3 cutover May 7 11:36 CST)
- Python :8084 — test env
- gRPC Embedding :9090 — active (NOT being migrated, per Apr 29 decision)

### 2.2 Server 139 (139.196.165.140) — nginx gateway

- Active vhost: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`
- Latest backup: `bak.t6_3_pre.20260508_032339` (T6.2 state, NOT T6.3 — see PR #142 critical finding)
- ⚠️ T6.4 cutover Step 0 MUST create new `bak.t6_4_pre.<ts>` from current T6.3 state before edit
- Upstream config: `_upstream_cretas.conf` (NOT `cretas-java-upstream.conf` — chat 4 GAP-2 finding)

### 2.3 Critical environment state

- **`SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` on prod since Apr 23** (Phase B Dashboard Gold UI port intentional, per memory `project_apr23_dashboard_gold_uiport.md` line 32 + Bug #417 fix dependency, per PR #157 investigation). DO NOT toggle.
- PR #135 Pattern B 3-state branching code **already deployed May 7 via N=2 cutover** (commit 2e90a2016 on prod disk). Python prod log confirms `[gold-primary] finance factory=F999 Gold empty — skipping legacy`.
- Factories on Python: F001 (T6.2) + 61 test factories (T6.3) = 62/75
- Factories still on Java: 14 real customers (F002/F003/F004/F006 + R001 + RES_3101_009 + RES_GML_001 + 7 R_*) — pending T6.4

### 2.4 Smartbi_prod_db

- 35 migrations applied (per `smartbi_migrations` tracker). Auto-runner shipped (PR #98/#100/#102 + tests 31/31).
- Schema parity restored 2026-05-06 06:38 CST (was missing 4 tables + 5 ALTER from data-fabric C series 8 migrations — caught at T6.2 canary).

---

## 3. Today's PR Inventory (May 8)

### 3.1 Forward-looking quintet (Phase 2A → 2B → 3 vision)

| PR | Doc | Squash commit |
|---|---|---|
| #151 | Phase 2A retrospective (chat 1) | 8912e137d |
| #150 | T6.5 Java SmartBI deprecation (chat 3) | cf8cc48e8 |
| #152 | Phase 2-rest scoping spec (chat 2) | 8b88dbb9b |
| #153 | Strict-byte adoption decision Phase 3+ (chat 3) | 2f7bd9bda |
| #156 | Phase 2A → 2B handoff readiness audit (chat 3) | ec4537e6d |

### 3.2 Empirical / test infrastructure

| PR | Doc | Squash commit |
|---|---|---|
| #154 | Strict-byte test infra spec (chat 2) | 45a03dee3 |
| #155 | Frontend impact verification (chat 1) | 1cd384a01 |
| #159 | P1 gap closure foundation impl spec (chat 2) | 71df443b8 |
| #140 | analysis_finance.py Rule 10/11/12 M=0 audit (chat 2) | 281b71ac9 |
| #139 | Cross-file Rule 10/11/12 sweep dept/region/procurement (chat 3) | dd376eeb4 |

### 3.3 T6.4 readiness (3 gates closed)

| PR | Doc | Squash commit |
|---|---|---|
| #141 | Customer comms plan (chat 3) | 068ebd8b8 |
| #143 | Real customer baseline metrics (chat 1) | 8b8f758752 |
| #142 | Rollback rehearsal + critical bak filename catch (chat 2) | 41552a9622 |
| #144 | T6.4 5-stage MOs (chat 3) | 0c8f85af7 |

### 3.4 Pattern B chain + K-1 sales

| PR | Doc | Squash commit |
|---|---|---|
| #137 | Pattern B PR-C v2 + Rule 4 latent fix (chat 2) | 5cc0e1837 |
| #138 | PR #135 Pattern B 3-state smoke verify (chat 1) | 6310f00278 |
| #146 | Pattern B sister-endpoint scan (chat 2) | 3bcf6f665 |
| #147 | K-1 customer Gold state verify (chat 3) | a687814bda |
| #149 | K-1 sales overview flag gate fix (chat 2) | 7e6c35495 |

### 3.5 Deploy MO + investigation chain (May 9 dispatch readiness)

| PR | Doc | Squash commit |
|---|---|---|
| #145 | PR #135 prod deploy MO original (chat 1) | e25642120 |
| #148 | 24h soak monitoring runbook (chat 1) | 1cd384a01 |
| #157 | SMARTBI_GOLD_READ_PRIMARY_ENABLED flag flip investigation (chat 3) | 45a71487b |
| #158 | PR #135 deploy MO rehearsal + chat 3 amend (chat 4) | d7959715f |
| #161 | PR #145 MO amendment per #157 §4.3 (chat 3) | 3bd41d7cd |

### 3.6 Other / 14d agent prep

| PR | Doc | Squash commit |
|---|---|---|
| #160 | 14-day customer bug-density follow-up checklist (chat 1) | 3deb4bcd4 |

---

## 4. Current 4-chat State (2026-05-08 evening)

| Chat | Status | Today's PR count |
|---|---|---|
| chat 1 | ✅ idle (last shipped #160 14-day agent prep) | 6 PRs (#143 #145 #148 #151 #155 #160) |
| chat 2 | ✅ idle (last shipped #159 P1 gap closure spec) | 6 PRs (#137 #142 #146 #149 #152 #154 #159) |
| chat 3 | ✅ idle (last shipped #161 MO amendment) | 9 PRs (#141 #144 #147 #150 #153 #156 #157 #161 + earlier #133/#139) |
| chat 4 | BG dryrun ~46% complete (ETA ~13:00 CST May 9) + #158 rehearsal merged | 1 PR (#158) |

---

## 5. T6.4 Prereq Blockers (4 remaining, 2 passive)

1. ⏳ **T6.3 24h soak GO** ~12:05 CST May 9 (passive monitor — chat 4 implicit watch)
2. ⏳ **T6.1 22h BG dryrun GO** ~13:00 CST May 9 (chat 4 explicit auto-trigger fires)
3. ⏸️ **May 9 13:01 CST smoke re-verification dispatch** (chat 1 specialty per PR #145 / amended MO #161)
4. ⏸️ **T6.4 Stage 1 cutover** ~May 10 14:00 CST (per PR #144 stage-1 MO)

(K-1 sales fix already shipped #149 + downgraded P2 per #147 — not blocker)

---

## 6. Master Plan Naming Cleanup (recommended next action)

⚠️ Should be done BEFORE Phase 2-rest kickoff to avoid future chat confusion. Idle chats today could:
- Update `docs/superpowers/specs/2026-04-28-python-migration-design.md` with naming clarification table
- Rename "Phase 2B" (chat 2 #152) to "Phase 2C" or "Phase 2-rest" in future docs
- Add "Naming history" section in master plan referencing all 3 rebrands

---

## 7. Recommended Tasks for 4-chat Parallel Execution

### 7.1 Standby for execution (HIGH priority, time-sensitive)

| Chat | Standby for | When |
|---|---|---|
| chat 1 | May 9 13:01 CST smoke re-verification dispatch (per amended MO #161) | ~14h from now |
| chat 3 | T6.4 Stage 1 cutover dispatch (per PR #144 stage-1 MO) | ~38h from now |
| chat 4 | BG poll auto-trigger fires + final 22h dryrun report | ~13h from now |

These 3 chats need available capacity at trigger time. Don't over-saturate with side tasks.

### 7.2 Productive idle work options (low-priority, can interrupt for execution)

**Option A** — Naming cleanup (long-term right, prevents future confusion):
- chat 2: Update Apr 28 master plan with naming clarification table + Phase 2B/Phase 3 disambiguation history
- chat 1: Audit all today's 29 PRs for Phase naming consistency, file index doc

**Option B** — Phase 2-rest (chat 2 #152 spec) Tier 1 Config detailed design spec:
- chat 2: Read SmartBIConfigController 41 endpoints, draft per-endpoint design spec (mirror Phase 2A pattern)
- ~600-1000 LOC, time consuming, only justifies if Phase 2-rest kickoff想 advance from July 2026

**Option C** — Phase 2A retrospective extension / docs consolidation:
- chat 1 or chat 3: Extract today's 29 PRs into single reference doc for future chats
- ~400-600 LOC, useful but diminishing returns

**Option D** — Standby (sustainable rest after 29-PR record day):
- All 4 chats stand down until May 9 trigger fires
- Preserve capacity, reduce hallucination risk

**Recommended Option mix**:
- chat 4: standby (BG monitoring + soon trigger)
- chat 1: **standby** (May 9 13:01 dispatch — must be fresh)
- chat 3: **standby** (May 10 T6.4 Stage 1 — must be fresh)
- chat 2: **Option A naming cleanup** (long-term right + low risk + chat 2 NOT scheduled for May 9-10 critical work)

### 7.3 Specific recommended chat 2 task (Option A)

```
派工 — Master plan naming clarification + Phase 2B/Phase 3 disambiguation

Step 0: 新 worktree
git fetch origin && git worktree add .worktrees/master-plan-naming-cleanup -b ops-master-plan-naming-cleanup origin/main
cd .worktrees/master-plan-naming-cleanup

Step 1: Reference (verify naming history accurate)
- docs/superpowers/specs/2026-04-28-python-migration-design.md (Apr 28 master plan)
- docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md (Apr 29 — uses "Phase 2B" for AI intent)
- docs/superpowers/specs/2026-05-02-phase3-cleanup-design.md (May 2 — uses "Phase 3" for cleanup)
- docs/superpowers/specs/2026-05-15-phase2b-port-pipeline-scoping-spec.md (May 8 PR #152 — uses "Phase 2B" for SmartBI rest)
- docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md (May 8 PR #150 T6.5)
- git log: commit 38b545d0c (Phase 2B-α merge) + commits with "phase2b" prefix
- Memory project_apr23_dashboard_gold_uiport.md (Phase B Gold UI port context)

Step 2: Audit doc structure (~400-500 LOC)
docs/qa-audits/2026-05-09-phase-naming-clarification-audit.md:

§1 Background — original Apr 28 master plan 4 phases
§2 Naming evolution — 3 rebrands timeline:
  - Apr 29: Phase 3 → "Phase 2B" (AI intent layer) — preserves Phase 2 SmartBI scope but expands sub-phase
  - May 2: New "Phase 3" (= post-T6 Java cleanup, not Tool-Skill migration)
  - May 8 PR #152: Phase 2 rest renamed "Phase 2B" — overlaps Apr 29 Phase 2B AI intent
§3 Conflict matrix — which doc means what when "Phase 2B" or "Phase 3" referenced
§4 Recommended canonical naming going forward:
  - Phase 1 LLM client (✅ DONE)
  - Phase 2A SmartBI Analysis (~96%, T6.4 stages May 10-14)
  - Phase 2B-α AI intent (✅ DONE)  
  - Phase 2B-β AI intent extensions (status verify)
  - **Phase 2C** SmartBI rest (= chat 2 #152 spec, kickoff July 2026) ← rename from "Phase 2B"
  - **Phase 3** post-T6 Java SmartBI Analysis cleanup (= T6.5 PR #150)
  - Phase 4 Embedding (DEFERRED)
§5 Action plan — which docs should be updated to use canonical naming
§6 Cross-references — every shipped doc + memory entry referencing each Phase

Step 3: ⛔ HOLD blocks
- Audit doc only, no code change
- DO NOT rename actual file names (preserve git history)
- DO NOT modify shipped specs (would break references)
- Right-sized: ~400-500 LOC

Step 4: Local commit + STOP ping organizer before push

完成后 = Future Phase 2C kickoff chat 不 confused. Master plan naming canonical disambiguation。
```

### 7.4 If Steve prefers all standby: Skip §7.3, all chats stand down

---

## 8. T6.4 Execution Sequence (May 9-14)

### 8.1 May 9 13:01 CST — smoke re-verification dispatch

**Use**: `docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md` (amended per PR #161)

**Key amendments to remember**:
- Step 5 F001 smoke: expect **State A 4 KPIs** (revenue/bills/avgBill/stores + top_stores) — NOT 10-card legacy
- Step 5 F999 + 14 customers: expect State B empty stub / Java legacy empty
- §6 HARD RULE: track current prod state, do NOT toggle flag (flag=true Apr 23 intentional)
- §6 status: **PR #135 already deployed May 7** — MO is smoke re-verification, NOT new deploy
- Step 1 worker grep: `ps --ppid <MainPID> | grep -c spawn_main` (NOT `ps aux | grep uvicorn`)
- §1+§2 nginx config: `_upstream_cretas.conf` (NOT `cretas-java-upstream.conf`)

### 8.2 May 10-14 T6.4 stages

**Use**: 5 standalone stage MOs in `docs/superpowers/dispatch/`:
- `2026-05-10-t6-4-stage-1-marching-order.md` — F002 + F003 (24h soak)
- `2026-05-11-t6-4-stage-2-marching-order.md` — F004 + F006 + R001 (24h)
- `2026-05-12-t6-4-stage-3-marching-order.md` — RES_GML_001 + RES_3101_009 (**48h soak**, high-stakes)
- `2026-05-13-t6-4-stage-4-marching-order.md` — R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH (24h)
- `2026-05-14-t6-4-stage-5-marching-order.md` — R_XMX_FRESH2/3 + R_YHDJ_DEMO + R_YJJ_DEMO (FINAL + Phase 2A completion artifacts)

**Each stage Step 0 MUST**:
```bash
cd /www/server/panel/vhost/nginx
cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_s<N>_pre.$(date +%Y%m%d_%H%M%S)
```

(per chat 2 PR #142 critical finding — `bak.t6_3_pre.20260508_032339` is T6.2 state NOT T6.3, would over-rollback if used as T6.4 emergency target)

### 8.3 May 14 21:00 CST — 14-day customer bug-density follow-up agent

Trigger: `trig_01T8zgazMfatrg27vqsqRoZX` (already scheduled)
Checklist: PR #160 = `docs/superpowers/runbooks/2026-05-14-14d-customer-bug-density-followup-checklist.md`

---

## 9. Memory Files Most Relevant for Fresh Chat

Top 8 must-read memory entries:
1. `project_2026_05_07_t6_1_dryrun_in_flight.md` — Pattern B chain + dryrun history
2. `project_2026_05_08_t6_4_readiness_gates.md` — T6.4 readiness 3 gates closure
3. `project_2026_05_07_uvicorn_n2_path_x_lite.md` — N=2 multi-worker cutover
4. `reference_blue_green_java_deploy.md` — Blue-Green pattern
5. `feedback_organizer_projection_bug.md` — verify-before-dispatch rule (4× incidents today)
6. `feedback_narrow_scope_fix_sister_site_sweep.md` — graduated hard rule today
7. `feedback_organizer_admin_merge_verify.md` — file scope verify before merge
8. `feedback_pause_before_deploy_or_push.md` — STOP ping rule before deploy/push

---

## 10. Discipline Rules for Next Organizer

1. **Verify before dispatch** — `gh pr view` + `git log origin/main` + grep memory file before writing marching orders. Today projection bug × 4 (chat 3 PR #133 already shipped / chat 2 file already swept M=0 / etc.)
2. **Admin merge file scope verify** — `gh pr view --json files` BEFORE `gh pr merge --admin`. Watch for sister chat pollution / stale base.
3. **STOP ping push rule** — Always require chat to ping before push (avoids worktree merge conflicts when Steve has parallel work staged).
4. **Marching order separation** — `⚡ IMMEDIATE` vs `⏳ QUEUED — wait for X` explicit labels. Don't mix immediate + future-conditional in single message.
5. **Date conversion** — relative dates ("tomorrow") → absolute (2026-05-09) when saving memory.
6. **Pattern A vs B distinction** — Pattern A = dict-eq tolerable (numeric int-collapse / scale-4 trailing-zero per Rule 4). Pattern B = structural Java code path Python omits (needs port).
7. **Today's 29-PR throughput is unusual** — sustainable normal is 5-10 PRs/session. Don't over-pace fresh chat.

---

## 11. Suggested First Action for Fresh Organizer Chat

1. Read this entire doc
2. Check current state via `gh pr list` + `gh pr view --json mergeCommit <recent>` to verify shipped state
3. Check chat 4 BG dryrun status (might already have triggered if reading >13:00 CST May 9)
4. Decide §7 option mix (recommend §7.2 chat 2 naming cleanup + 3 standby)
5. Send dispatch + standby acknowledgment to all 4 chats
6. Wait for May 9 13:01 dispatch trigger — use amended MO #161

---

**Outgoing organizer signing off** 🟢 — 29 PRs single-session record. T6.4 readiness 3/3 closed. Forward-looking quintet shipped. Phase 2A → 2B → 3 progression vision documented end-to-end.

Fresh organizer: continue from here.
