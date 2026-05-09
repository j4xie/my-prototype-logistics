# 派工 — T6.6 Phase B: 8-chat parallel execute marching order (Q1 real-DB sign-off)

**Status**: ⛔ HOLD — DRAFT ONLY. Do not execute. Awaiting organizer trigger after T6.5 Phase C 100% close + post-Phase-C 30-day soak (or HARD rule `active-E2E-replaces-passive-soak` shortcut window).
**Dispatch date**: TBD (filename target ~mid-August 2026; may compress per HARD rule `active-E2E-replaces-passive-soak`).
**Predecessor**: T6.5 Phase C close (Round 2 ship of Sub-A through Sub-K per PR #227 MO + sub-batch follow-ups).
**Author**: organizer T6.6 Phase B execute MO draft (2026-05-09 fresh organizer chat dispatched chat7 reuse, deferred trigger).
**Successor**: T6.6 Phase D — controller method body removal for the 4 newly-Python-routed endpoints (mirror of T6.5 Phase B+C pattern).

---

## 0. 必读 context (~25 min)

1. **PR #196 — T6.6 Phase A overall design** (Chat D, the `/query` Approach A decision + 4-endpoint port architecture):
   - `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` — read §1 (Java intent service inventory) + §2 (Approach A vs B vs C) + §3 (spec drift catches: production/quality MOCK; `/query` two-path dispatch) + §6.2 (sister-chat plan) + §0 effort revision.
2. **PR #199 — `/analysis/production` endpoint port detail** (Chat M):
   - `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` — Q1 amendment header (real-DB chosen, JavaRandom DROP) + §1 Java behavior trace + §5 Rule audit checklist.
3. **PR #203 — `/analysis/quality` endpoint port detail** (Chat N):
   - `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md` — Q1 amendment header (real-DB chosen) + §1.1 current state + §2.2 D-series (RuleAudit) — note R7/R12 still apply for real-DB impl.
4. **PR #202 — `/query` rule engine port detail** (Chat O):
   - `docs/superpowers/specs/2026-05-09-t6-6-query-port-detail.md` — §0 TL;DR (3-layer entry + 2-supporting ports + D1-D4 discoveries) + §1 SmartBIServiceImpl.processQuery trace + §9 day-by-day 7d firm.
5. **PR #204 — `/drill-down` parity verify** (Chat P):
   - `docs/qa-audits/2026-05-09-t6-6-drilldown-parity-verify.md` — §0 verdict (Python impl already shipped Phase 2A, byte-shape parity confirmed F001 product spot-check) + §7 nginx GO criteria.
6. **PR #220 — cross-PR consistency audit** (Chat 7, scope-binding for THIS MO):
   - `docs/qa-audits/2026-05-09-t6-6-cross-pr-consistency.md` — §1 JavaRandom helper coordination (R1.A path) + §2 effort variance (13-14d total, ceiling 12d) + §3 dependency graph + §4 nginx batch coordination + §6 follow-up recommendations.
7. **PR #223 — Q1 real-DB sign-off** (organizer commit, 2026-05-09):
   - `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` — **AUTHORITATIVE** for production+quality data source decision. **Supersedes** PR #199 §3 BLOCKER + PR #203 §0 #1 risk + PR #226 helper applicability for production/quality. ETL §3 + §4 + §5 sections define Excel import + Silver/Gold schema + ~10d shared infra.
8. **PR #226 — JavaRandom helper** (Chat 3, shipped BEFORE Q1 decision):
   - `backend/python/smartbi_compat/_java_compat.py` (`_java_string_hashcode`, `_JavaRandom` LCG) + tests `tests/test_java_compat_random.py` + reference dump `tests/fixtures/JavaRandomReferenceDump.java` + `tests/fixtures/java-random-reference.json`.
   - **Status post-Q1**: ORPHAN — no consumer in real-DB design. Phase B may delete or keep dormant; resolve in §5 Q-3.
9. **PR #227 — T6.5 Phase C MO** (organizer, mirror style for THIS MO):
   - `docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md` — section structure + per-sub-batch protocol + STOP-and-ping cadence.
10. **Memory** (read before any push / deploy / Java code touch / Python module add):
    - `feedback_pause_before_deploy_or_push.md` — STOP-and-ping organizer before deploy or push.
    - `feedback_concurrent_edit_safety.md` — Rule 5b safe-commit `git commit -- F1 F2 …` paths-only mode.
    - `reference_blue_green_java_deploy.md` — Java prod default Blue-Green via 10010↔10020 nginx upstream switch (T6.6 cutover irrelevant since this MO does not touch Java; mentioned for sub-batch context only).
    - `feedback_active_e2e_replaces_passive_soak.md` — pre-customer-return state, no passive soak; active Playwright/curl probe is the verification.
    - `feedback_dispatch_on_technical_readiness.md` — fire on technical readiness, not inherited timing anchors.
    - `feedback_no_defensive_in_verify_scripts.md` — Phase B verify scripts must let exceptions bubble; no try/except masking.
    - `feedback_30s_precheck_selective_bug_pattern.md` — selective per-factory bug → grep factory_id literals + env flags + config defaults FIRST (~30 s) before deep investigation.
    - `feedback_marching_order_method_name_grep.md` — every Java method / Python function name in this MO must be `grep`-verified against actual source before action.
    - `feedback_audit_endpoint_impl_not_router.md` — Python ✓ rubber-stamp must verify @router declaration + impl behavior, not just file existence.
    - `feedback_narrow_scope_fix_sister_site_sweep.md` — when Sub-X fixes a pattern, grep all sister sites in the same file; ship sweep or schedule follow-up.
    - `reference_smartbi_gold_layer_architecture.md` — Gold layer is Python-side; Java GoldDashboardBuilder is downstream HTTP client of Python `/api/smartbi/gold/*`. Phase B real-DB ETL output flows into the same Gold layer.
    - `reference_smartbi_prod_db_migration_gap.md` + `reference_smartbi_migration_runner.md` — schema changes for ETL must use `V<YYYYMMDD>_NN__*.sql` migrations + `apply-smartbi-migrations.sh` runner.
    - `reference_local_backend_db.md` — local backend connects to local PG. Test data setup via API upsert preferred.
11. **HARD rules (from `.claude/rules/`)** — every sub-batch must follow:
    - `python-java-port.md` Rules 1–12 — full Python↔Java parity protocol. Rule 4 (Phase 2A dict-eq gate) is authoritative; **strict-byte gate stays OFF for T6.6** unless §5 Q-7 reopens.
    - `field-naming-convention.md` — JSON camelCase, DB snake_case.
    - `database-entity-sync.md` — PG strict GROUP BY + Hibernate `CAST(:param AS string) IS NULL` workaround for parameter-side null.
    - `concurrent-edit-safety.md` — Rule 5b paths-only commit; per-sub-batch isolated worktree.
    - `python-services-architecture.md` — all new modules under `backend/python/smartbi_compat/api/` or `smartbi_compat/intent/`; **no new ports / processes**.

---

## ⛔ Pre-flight gates (organizer responsibility — verify BEFORE dispatching this MO)

- [ ] **T6.5 Phase C 100% close** — all 11 sub-batches (Sub-A through Sub-K) merged per PR #227 sequencing; Sub-J/K orphan delete confirmed; cross-batch `mvn clean package -DskipTests` green on origin/main HEAD.
- [ ] **T6.5 Phase C prod cutover ≥30d soak** OR active-E2E shortcut window verified per HARD rule `active-E2E-replaces-passive-soak` (probe via Playwright / curl across all 23 stubbed endpoints + alive Java fallthrough — 0 P1).
- [ ] **No P1 customer reports** open against any SmartBI controller path (Analysis / Dashboard / Config / Upload / PublicDemo) in the soak window.
- [ ] **F999 internal team confirmed** acceptance of current 410 behavior on the 23 Phase B stubbed endpoints — Decision 2A status (current 410) reaffirmed OR a new decision recorded in §5 Q-6 BEFORE this MO fires.
- [ ] **Q1 real-DB sign-off (PR #223) merged + binding** — confirm PR #199 + PR #203 detail specs reference the amendment header. If either spec is updated post-amendment, re-read.
- [ ] **PR #196, #199, #202, #203, #204, #220, #223, #226** all merged on origin/main (pre-flight `git log --oneline | grep -E "#196|#199|#202|#203|#204|#220|#223|#226"` returns all 8).
- [ ] **Phase 2A active-E2E framework v1** (PR #218) re-runnable as smoke baseline; existing Phase 2A endpoints still pass dict-eq gate against current Java prod.
- [ ] **No competing T6.6 / Phase 2B / Phase 3 PRs in flight** that touch:
  - `backend/python/smartbi_compat/api/analysis_*.py`
  - `backend/python/smartbi_compat/_java_compat.py`
  - `backend/python/main.py` (router include block)
  - `nginx` upstream config on server 139 (`api.cretaceousfuture.com.conf`)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java`
- [ ] **Server 47 + server 139 healthy** — `systemctl status cretas-backend cretas-python cretas-embedding` all `active (running)`; nginx on 139 `active (running)`; smoke `curl /api/mobile/health` 200 across both stacks.
- [ ] **Phase 2A 75/75 customer factories** still on Python upstream for in-scope endpoints (per `project_2026_05_09_phase_2a_complete.md`); no rollback in flight.

If any gate not green → **STOP, do not dispatch**. Ping Steve.

---

## 1. Scope summary

| Sub-batch | Owner | Scope | Estimated effort |
|---|---|---|---|
| **Sub-A** | chat-A | `/analysis/production` Python port — real-DB consumption (Q1 amendment Option B) | ~5 person-days impl + share Sub-B ETL |
| **Sub-B** | chat-B | `/analysis/quality` Python port — real-DB consumption (Q1 amendment Option B) | ~5 person-days impl + share Sub-A ETL |
| **Sub-C** | chat-C | `/query` Python intent service equivalent — Approach A rule engine 1:1 (5 EntityRecognizer + recognizeIntent + processQuery + IntentMapper + PromptService + DTO mirrors) | ~9 person-days firm (per PR #202 §9) |
| **Sub-D** | chat-D | `/drill-down` parity verify re-run + golden refresh + readiness gate confirm | ~0.5 person-day (Python impl already shipped per PR #204) |
| **Sub-E** | chat-E | 4-endpoint dict-eq parity gate consolidation — record + diff F999 + F001 goldens for production + quality + query + drill-down post-cutover | ~1 person-day (post Sub-F batch flip) |
| **Sub-F** | organizer-owned | nginx regex update batch — coordinated 4-endpoint flip on server 139 (`api.cretaceousfuture.com.conf`) per PR #220 §4 + PR #204 §7 | ~30 min nginx + 2 h smoke + rollback rehearsal |
| **Sub-G** | chat-G | F999 SmartBI Analysis migration consideration — write decision doc: "F999 stays on 410 (Decision 2A current)" OR "F999 routes to Python like other 75 factories" | ~0.5 person-day (decision doc only, no code) |
| **Sub-H** | chat-H (continuity) | Post-deploy active E2E framework v1 (PR #218) reuse + 30-day soak monitoring + Phase D readiness checklist | ongoing — daily monitor + week-1 active E2E + week-4 close-out report |

**ETL infrastructure (shared by Sub-A + Sub-B)**: ~10 person-days total, embedded in Sub-A's first 2 phases (Excel import scripts + Silver/Gold schema + V<date>_NN__t6_6_*.sql migrations). Sub-B imports Sub-A's ETL output schema; Sub-B kickoff blocks on Sub-A ETL phase merge (NOT full Sub-A merge).

**Total**: ~21 person-days serialized; ~9-10 days wall-clock with 4 chats parallel (Sub-A + Sub-C + Sub-D dispatched at T+0; Sub-B at T+ETL-merge ≈ T+3d; Sub-E at T+Sub-F-flip; Sub-F + Sub-G organizer-side at T+all-impl-merge; Sub-H ongoing).

**HARD KEEP (do not touch in Phase B)** per PR #178 §3.2.a + PR #196 §6:
- `SmartBIDashboardController` HARD KEEP method bodies (composite Dashboard + PublicDemo paths).
- `SmartBIServiceImpl` Java methods called by Dashboard composite (e.g. `getOEEOverview` invoked by `getDashboardExecutive`) — Phase B does NOT remove Java; Java + Python intentionally diverge for production/quality once cutover completes (per Q1 amendment §1 final paragraph).
- `DynamicAnalysisServiceImpl` (alive — `/query` + `/drill-down` Java-side stays for fallback during T6.6 Phase B; Phase D removes controller method body).
- All Phase 2A Python modules already shipped (`analysis_finance.py`, `analysis_sales.py`, etc.) — Sub-C reuses 13 of these via `executeIntent` dispatch table; do NOT re-port.
- `GoldDashboardBuilder` + entire Java Gold-layer composite chain.
- `SmartBiQueryTemplateRepository` + `SmartBiQueryTemplate` (already deleted T6.5 Phase C Sub-J/K).

---

## 2. Cross-cutting per-sub-batch protocol

Every impl sub-batch (A/B/C/D/E/H) follows this exact protocol. **No deviations without organizer approval.** Sub-F + Sub-G are organizer-owned and follow the §6 + §7 alternative protocol.

### 2.1 Step 0 — Worktree + base sync

```bash
git fetch origin
git worktree add .worktrees/t6-6-phase-b-sub-<X> -b ops-t6-6-phase-b-sub-<X> origin/main
cd .worktrees/t6-6-phase-b-sub-<X>
git log --oneline -1                  # MUST be at origin/main HEAD; verify base contains:
                                       #   - all T6.5 Phase C sub-batch merge commits
                                       #   - PR #196 / #199 / #202 / #203 / #204 / #220 / #223 / #226 merge commits
```

**Concurrent edit safety**: each sub-batch gets its own worktree — physical isolation per memory `feedback_concurrent_edit_safety.md` rule §2. **Never share a worktree across sub-batches.**

### 2.2 Pre-flight build + smoke gate (run BEFORE any edits)

```bash
# Java side (no edits planned, but baseline must be green for the Sub-F flip prereq)
cd backend/java/cretas-api
mvn clean compile -DskipTests          # MUST pass — Sub-F prereq
mvn clean test -DskipTests=false       # MUST pass — record baseline

# Python side
cd ../../python
python -m pytest tests/ -q --no-header # MUST pass; record baseline test count

# Test env smoke (10011 Java + 8084 Python)
curl -s http://47.100.235.168:10011/api/mobile/health | jq .
curl -s http://47.100.235.168:8084/health | jq .
```

If pre-flight fails on origin/main HEAD, **STOP and ping organizer** — base is broken, do not proceed (do not "fix" unrelated breakage in this PR per memory `feedback_concurrent_edit_safety.md` Rule 5b scope-creep avoidance).

### 2.3 Spec re-read + sister-chat coordination ping

For each sub-batch, the assigned chat MUST:

1. Re-read its detail spec (Sub-A: PR #199 + PR #223; Sub-B: PR #203 + PR #223; Sub-C: PR #202; Sub-D: PR #204; Sub-E: PR #220 §6; Sub-H: PR #218 v1 doc).
2. Re-read PR #220 §1-§6 for cross-PR consistency findings — apply §1 R1.A path pin (`backend/python/smartbi_compat/_java_compat.py` is the JavaRandom location IF used; see §5 Q-3) + §2 effort variance ceiling + §3 import dependency graph + §4 nginx batch coordination.
3. Ping organizer in dispatch thread with: "Sub-<X> kickoff, base = `<git rev-parse HEAD>`, spec re-read complete, blockers identified: <list or none>". Wait for organizer ACK before any code edit.

### 2.4 Byte-shape parity protocol (Sub-A / Sub-B / Sub-C / Sub-E)

Per `python-java-port.md` Rule 4 Phase 2A dict-eq gate. For every endpoint port:

1. **Record Java goldens** (real-DB cases for Sub-A/B; rule-engine cases for Sub-C; existing 9 goldens reused for Sub-D):

   ```bash
   # F999 + F001 are required factories per Phase 2A pattern. Q1 amendment §3 + §5 lists data sources for production/quality.
   ./scripts/record-java-golden.sh F999 <factoryId> <endpoint> <args> > tests/fixtures/java-smartbi-golden/<name>.json
   ./scripts/record-java-golden.sh F001 <factoryId> <endpoint> <args> > tests/fixtures/java-smartbi-golden/<name>.json
   ```

   ⛔ **For Sub-A/B real-DB**: Per Q1 amendment §1 final paragraph, Java side stays mock; Python side becomes real-DB. **Goldens are recorded against Python real-DB output, NOT Java**, and become the new source of truth. Document this clearly in Sub-A/B PR description.

2. **Implement Python port** mirroring Java semantic (Rules 1–12). Use `_decimal_to_number` + `_format_decimal_half_up` + `_java_isoformat` helpers from `_java_compat.py`. **Do NOT** introduce new ad-hoc helpers without documenting in PR description.

3. **Run dict-eq parity test**:

   ```python
   from smartbi_compat._strict_byte import assert_response_eq  # dict-eq dispatcher
   import json
   golden = json.loads(open("tests/fixtures/java-smartbi-golden/<name>.json").read())
   actual = client.post("/api/mobile/F001/smart-bi/<endpoint>", json=<args>).json()
   assert_response_eq(actual, golden, gate="dict-eq")
   ```

4. **Per-Rule audit** — go through Rules 1–12 in `python-java-port.md`. For each Rule, answer "applies / N/A / addressed at <line>". File a `phase-b-sub-<X>-rule-audit.md` in `docs/qa-audits/` as part of the PR. Reviewer cross-checks.

5. **Record Π divergence** — if any non-Rule-4 (i.e. non-dict-eq) divergence found, classify per Rule 4 §"Phase 2A dict-eq gate official standard" Pattern A / A2 (accept) vs Pattern B (fix). Document in PR description.

### 2.5 ⛔ STOP-and-ping organizer (Steve) BEFORE git push

Per memory `feedback_pause_before_deploy_or_push.md` — Steve uses multi-worktree / multi-chat. Push without ping risks colliding with concurrent worktree merges Steve hasn't sequenced yet.

```
ORGANIZER PING TEMPLATE:
> Sub-<X> Phase B ready to push. Branch ops-t6-6-phase-b-sub-<X> staged.
> Diff: <git diff --stat origin/main..HEAD>
> Files added/modified: <list>
> Goldens recorded: <list of fixture files>
> Tests: pre-flight <baseline> → post <count>; dict-eq parity <pass/fail per endpoint>
> Rule audit doc: docs/qa-audits/phase-b-sub-<X>-rule-audit.md
> Awaiting GO to push + open PR.
```

### 2.6 Safe-commit (memory rule §5b paths-only mode)

```bash
git status --short                     # MUST show only your sub-batch's files staged + dirty

# Only commit explicit paths — paths-only mode prevents husky/lint-staged from sweeping concurrent-session files
./scripts/safe-commit.sh "feat(t6-6-phase-b-sub-<X>): <description>" \
    backend/python/smartbi_compat/api/<your_module>.py \
    backend/python/smartbi_compat/intent/<your_module>.py \
    backend/python/main.py \
    backend/python/tests/test_<your_module>.py \
    tests/fixtures/java-smartbi-golden/<your-goldens>.json \
    docs/qa-audits/phase-b-sub-<X>-rule-audit.md

# Post-commit verify
git show --name-only HEAD              # MUST equal exactly the paths you listed; flag if husky added anything
```

### 2.7 Push + open PR (after organizer GO)

```bash
git push -u origin ops-t6-6-phase-b-sub-<X>
gh pr create --title "feat(t6-6-phase-b-sub-<X>): <description>" --body "$(cat <<'EOF'
## Summary

T6.6 Phase B sub-<X> port per PR #196 / PR #<detail-spec> / PR #223 (Q1 real-DB).

- N modules added/modified
- M goldens recorded against <Java mock | Python real-DB | rule-engine deterministic>
- Rule 1-12 audit doc: `docs/qa-audits/phase-b-sub-<X>-rule-audit.md`
- dict-eq parity: <PASS/FAIL summary per endpoint>

## Verification

- Pre-flight: mvn clean compile + Python pytest PASS at base origin/main
- Post-impl: dict-eq gate PASS for all goldens
- Test count: <pre> → <post>

## Predecessors

- PR #196 (T6.6 Phase A design)
- PR #<detail-spec>
- PR #223 (Q1 real-DB sign-off — applies to Sub-A/B only)
- PR #220 (cross-PR consistency audit)

## Test plan

- [ ] Reviewer spot-checks 2 goldens per endpoint, runs dict-eq compare locally
- [ ] Reviewer verifies Rule audit doc against `python-java-port.md` Rules 1-12
- [ ] Reviewer confirms HARD KEEP list (§1 of MO) untouched
- [ ] Steve approves before admin merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 2.8 ⛔ Sub-F nginx flip is ORGANIZER-OWNED, not sub-batch-owned

**Sub-batches A/B/C/D/E do NOT touch nginx.** After all impl sub-batch PRs merge to `main` AND `cretas-python` redeploys (test env first, then prod), organizer dispatches Sub-F: a single coordinated nginx regex update on server 139 to flip all 4 endpoint paths to the `cretas_python` upstream.

If a sub-batch chat tries to edit nginx → **STOP, ping Steve**. Phase B nginx flip needs all impl PRs green-merged + Python prod healthcheck + golden parity dryrun (Sub-E pre-flip dryrun against test env) before any prod cutover. Per PR #220 §4 + PR #204 §7.

### 2.9 ⛔ Active-E2E discipline (memory `feedback_active_e2e_replaces_passive_soak.md`)

Pre-customer-return state — NO passive 24h/48h soak windows. Sub-H runs active E2E (Playwright + agent-browser + curl probe) within 30 min of each sub-batch merge AND within 30 min of Sub-F nginx flip. Per stage: cutover → smoke 5-10 min → active E2E 15-30 min → next stage IMMEDIATELY (subject to organizer dispatch cadence, not wall-clock soak).

---

## 3. Per-sub-batch specifics

### Sub-A — `/analysis/production` Python port (real-DB) (chat-A)

**Files (create)**:
- `backend/python/smartbi_compat/api/analysis_production.py` — FastAPI router + 4-branch dispatcher (`oee` / `efficiency` / `equipment` / default-overview) + 9 internal sub-method functions (mirror Java line 80, 129, 146, 213, 224, 309, 318, 330, 339 entry points).
- `backend/python/smartbi_compat/etl/restaurant_chains_import.py` — Excel/CSV importer for the 22 files in `smartbi维度分析/大众点评/真实餐饮连锁数据/` per Q1 amendment §2.
- `backend/python/tests/test_analysis_production.py` — pytest suite covering all 4 dispatch branches × F999 + F001 = 8 dict-eq gate tests.
- `backend/python/smartbi/database/migrations/V20260815_01__t6_6_etl_silver_layer.sql` — Silver-layer schema (raw Excel imports normalized).
- `backend/python/smartbi/database/migrations/V20260815_02__t6_6_etl_gold_production.sql` — Gold-layer aggregations for production endpoint.

**Files (modify)**:
- `backend/python/main.py` — add `from smartbi_compat.api import analysis_production` + `app.include_router(analysis_production.router, prefix="/api/mobile", tags=["SmartBI-Production"])` block (mirror existing pattern at lines 1192-1193).

**Goldens (record against Python real-DB output, NOT Java mock)**:
- `tests/fixtures/java-smartbi-golden/analysis-production-F999-overview.json`
- `tests/fixtures/java-smartbi-golden/analysis-production-F999-oee.json`
- `tests/fixtures/java-smartbi-golden/analysis-production-F999-efficiency.json`
- `tests/fixtures/java-smartbi-golden/analysis-production-F999-equipment.json`
- `tests/fixtures/java-smartbi-golden/analysis-production-F001-{overview,oee,efficiency,equipment}.json`

**Action sequence**:
1. ETL phase (~5d): write `restaurant_chains_import.py` Excel reader (use `xlrd` for legacy `.xls` BIFF8 + `openpyxl` for `.xlsx` per Q1 amendment §2.4). Land V20260815_01 + V20260815_02 migrations. Import 22 files into Silver layer; run aggregation queries to populate Gold layer for production semantics. Test on dev DB first; STOP-and-ping organizer for prod ETL run schedule.
2. Service-layer port phase (~3d): port the 4-branch dispatcher + 9 sub-methods using Gold-layer reads. Apply Rules 1-12 per protocol §2.4.
3. Goldens + tests phase (~1d): record + dict-eq gate.
4. Per-protocol §2.5–§2.7 commit + push.

**JavaRandom helper handling**: Q1 amendment §1 confirms NOT NEEDED for real-DB. Per §5 Q-3, Sub-A does NOT use `_JavaRandom` from `_java_compat.py`. Helper stays as orphan in `_java_compat.py` until §5 Q-3 resolves.

**Sub-B kickoff blocks on**: Sub-A ETL phase merge (Step 1 above) — NOT full Sub-A merge. Sub-B reuses Sub-A's Silver-layer schema + restaurant_chains_import.py.

### Sub-B — `/analysis/quality` Python port (real-DB) (chat-B)

**Files (create)**:
- `backend/python/smartbi_compat/api/analysis_quality.py` — FastAPI router + 4-branch dispatcher (`fpy` / `defect` / `rework` / default-overview) + 7 internal sub-methods (mirror Java per PR #203 §1.2).
- `backend/python/tests/test_analysis_quality.py`
- `backend/python/smartbi/database/migrations/V20260815_03__t6_6_etl_gold_quality.sql` — Gold-layer aggregations for quality endpoint (defect / FPY / rework). Reuses Sub-A Silver layer.

**Files (modify)**:
- `backend/python/main.py` — add quality router include block.

**Goldens** (against Python real-DB):
- `tests/fixtures/java-smartbi-golden/analysis-quality-F{999,001}-{overview,fpy,defect,rework}.json` (8 total).

**Action sequence**:
1. WAIT for Sub-A ETL phase merge confirmation from organizer. Pull origin/main; confirm Silver-layer schema available.
2. Quality semantic mapping phase (~1d): per Q1 amendment §3.2, redefine quality semantics for restaurant tenants (FPY → 出餐合格率; defect → 退货/退菜率; rework → 重做/换菜率). Document in PR description. Land V20260815_03.
3. Service-layer port phase (~3d): mirror Java 4-branch + 7 sub-methods. Apply Rules 1-12.
4. Goldens + tests phase (~1d).
5. Per-protocol §2.5–§2.7.

**JavaRandom helper handling**: same as Sub-A — NOT NEEDED.

### Sub-C — `/query` rule engine port (Approach A) (chat-C)

**Files (create)** — per PR #202 §0 effort breakdown:
- `backend/python/smartbi_compat/intent/__init__.py`
- `backend/python/smartbi_compat/intent/intent_recognizer.py` — port of `SmartBIIntentServiceImpl.recognizeIntent` (~450 LOC).
- `backend/python/smartbi_compat/intent/base_entity_recognizer.py` — Trie longest-match base.
- `backend/python/smartbi_compat/intent/region_recognizer.py`
- `backend/python/smartbi_compat/intent/department_recognizer.py`
- `backend/python/smartbi_compat/intent/metric_recognizer.py`
- `backend/python/smartbi_compat/intent/time_recognizer.py`
- `backend/python/smartbi_compat/intent/dimension_recognizer.py`
- `backend/python/smartbi_compat/intent/intent_mapper.py` — LLM fallback bridge.
- `backend/python/smartbi_compat/intent/prompt_service.py` — 6 markdown templates + `{{var}}` substitution (~200 LOC).
- `backend/python/smartbi_compat/intent/dictionaries/` — copy of 6 classpath JSONs from `backend/java/cretas-api/src/main/resources/config/smartbi/` (intent_patterns, region, time, metric, department, dimension). **Single source of truth = Java classpath**; Python loads at startup. Document path in PR.
- `backend/python/smartbi_compat/api/query.py` — FastAPI router + processQuery orchestrator + executeIntent dispatcher (15 case branches dispatching to existing `analysis_*.py` modules per PR #202 §1.3).
- `backend/python/smartbi_compat/api/_dto/intent_result.py` — Pydantic DTO mirror.
- `backend/python/smartbi_compat/api/_dto/nl_query.py` — `NLQueryRequest` + `NLQueryResponse` Pydantic mirrors.
- `backend/python/tests/test_query_intent.py` + `tests/test_query_dispatch.py`.

**Files (modify)**:
- `backend/python/main.py` — query router include.

**D-discoveries handling (per PR #202 §0)**:
- D1: existing `backend/python/smartbi/services/intent/query_intent_extractor.py` co-exists; do NOT delete.
- D2: `executeIntent` default branch → 400 error (mirror post-Tool-Skill-fail Java line). Document in PR.
- D3: `ConversationMemoryService` 指代消解 → no-op pass-through (`resolved_query = effective_query`). Document.
- D4: `ai_intent_configs` table read via existing Phase 2A asyncpg pool wiring; no new DB infra.

**Goldens (deterministic — rule engine takes string in + dictionary state, no Random)**:
- `tests/fixtures/java-smartbi-golden/query-F999-<intent-code>-<query-hash>.json` — sample 30+ queries × 30+ intents = ~30 goldens (organizer + Sub-C chat agree on 30+ representative-query list before recording).
- F001 cohort: same query set re-recorded.

**Action sequence**: per PR #202 §9 day-by-day (7d core + 2d buffer = 9d firm).

**JavaRandom helper handling**: NOT USED — `/query` is pure deterministic per PR #220 §1.

**Sub-C parallelizable with Sub-A/B** (independent surfaces). Dispatched at T+0.

### Sub-D — `/drill-down` parity verify re-run (chat-D)

**Files (modify only — Python impl already shipped per PR #204)**:
- (none unless Sub-D finds drift)

**Action sequence**:
1. Re-run dict-eq parity gate against current Java prod 10010 + test 10011 for `dimension=region/department/product/time/salesperson` + error path = 6 cases × F999 + F001 = 12 dict-eq comparisons.
2. If any drift since PR #204 audit: file follow-up per PR #220 §6 OR fix in Sub-D PR (organizer call).
3. Refresh existing 9 goldens in `tests/fixtures/java-smartbi-golden/drill-down-*.json` if stale (audit cycle ≥ 90 days old; re-record).
4. Ship a `phase-b-sub-D-readiness.md` audit doc confirming GO for Sub-F nginx flip inclusion.

**Effort**: ~0.5 person-day. If parity drift found, +1 person-day per drift case (escalate to organizer first).

### Sub-E — 4-endpoint dict-eq parity gate consolidation (chat-E)

**Dispatched at T+Sub-F-flip-complete**. Sub-E does the post-flip re-run of dict-eq gate for all 4 endpoints (production / quality / query / drill-down) against:
- Local Python (8083 prod / 8084 test) — should be 100% match (golden source).
- Production traffic via nginx-routed path — sample 10 real factory IDs per endpoint.

**Files (create)**:
- `docs/qa-audits/2026-XX-XX-t6-6-phase-b-post-flip-parity-consolidation.md` — table of all 4 endpoints × 2 factories × N dispatch modes × pass/fail.
- `backend/python/tests/test_phase_b_post_flip_consolidation.py` — automated dict-eq harness re-runnable for week-1 / week-4 monitoring (Sub-H reuses).

**Action sequence**:
1. WAIT for Sub-F nginx flip merge confirmation.
2. Run consolidation harness against test env first; report result. STOP-and-ping organizer.
3. If GO: run against prod (no traffic-side changes — just observe). Report.
4. Per-protocol §2.5–§2.7 commit consolidation doc + harness.

**Effort**: ~1 person-day.

### Sub-F — nginx regex update batch (organizer-owned)

**Files (modify on server 139, NOT in repo)**:
- `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (or current equivalent).

**Action sequence (organizer-side)**:
1. Backup current vhost: `cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_6_pre.<YYYYMMDD_HHMMSS>`.
2. Add 4 new `location ~* "..." { proxy_pass http://cretas_python; }` regex blocks for `/api/mobile/<factoryId>/smart-bi/analysis/production`, `/analysis/quality`, `/query`, `/drill-down`. Cohort regex: same 75-factory pattern as T6.4 final state (per `project_2026_05_09_phase_2a_complete.md`); F999 included or excluded per §5 Q-6 Sub-G decision.
3. `nginx -t` (config syntax check).
4. STOP-and-ping Steve for cutover go/no-go.
5. `nginx -s reload` (master PID unchanged; workers cycle gracefully).
6. Smoke 4 endpoints × 5 sample factories = 20 curls; verify Python upstream serves (check `cretas-python.log` for matching request lines + Java log absence on these paths).
7. Active E2E via Playwright / agent-browser per memory `feedback_active_e2e_replaces_passive_soak.md` — 15-30 min.
8. If any failure: `cp <backup> api.cretaceousfuture.com.conf && nginx -s reload` to roll back. Diagnose. Re-attempt.
9. Commit the backup-name + post-flip vhost diff to repo as audit artifact: `docs/qa-audits/2026-XX-XX-t6-6-phase-b-nginx-flip-record.md`.

**Effort**: ~30 min nginx + 2h smoke + active-E2E.

**No sub-batch chat may run this.** Organizer-only.

### Sub-G — F999 SmartBI Analysis migration consideration (chat-G)

**Files (create)**:
- `docs/superpowers/specs/2026-XX-XX-t6-6-f999-decision-record.md` — decision doc only.

**Action sequence**:
1. Re-read PR #178 audit §3.1.a + Decision 2A (current 410 for F999 SmartBI Analysis paths).
2. Re-read PR #196 §0 + PR #199 + PR #203 to confirm F999 cohort is INCLUDED or EXCLUDED in production / quality / query / drill-down nginx routing — current state per Q1 amendment is unclear; resolve.
3. Survey F999 internal team (organizer-mediated) on whether they want the 4 newly-Python-routed endpoints to:
   - **Option A** (status quo): Stay 410 — F999 has no SmartBI Analysis access via this path.
   - **Option B** (route to Python): F999 included in cohort regex; uses Python real-DB output for production/quality (with synthetic showcase data) + Python rule engine for query/drill-down.
4. Write decision doc capturing rationale + cohort regex update if Option B. Ship as PR.

**Effort**: ~0.5 person-day (decision doc only, no code).

**Sub-F cohort regex depends on Sub-G outcome.** Organizer holds Sub-F dispatch until Sub-G merged.

### Sub-H — post-deploy active E2E + 30-day soak monitoring (chat-H, continuity)

**Files (modify)**:
- `tests/e2e/active-e2e-framework-v1/` — extend PR #218 framework with 4 new endpoint suites.
- `docs/qa-audits/2026-XX-XX-t6-6-phase-b-week-1-active-e2e.md` — week-1 close-out report.
- `docs/qa-audits/2026-XX-XX-t6-6-phase-b-week-4-soak-close-out.md` — week-4 / 30-day close-out + Phase D readiness.

**Action sequence**:
1. T+0 (post Sub-F flip): 30-min active E2E across 4 endpoints + 5 sample factories. File week-1 audit doc.
2. T+1 day, T+3 days, T+7 days: 15-min active E2E re-runs (per HARD rule, not passive soak).
3. T+14 days, T+30 days: full active E2E + close-out report.
4. If any P1/P2 finding at any checkpoint: STOP-and-ping organizer; consider rollback (Sub-F backup vhost).
5. T+30 days clean → Phase D readiness GREEN. File Phase D MO draft trigger doc.

**Effort**: ongoing — daily monitor (10 min) + week-1 30-min E2E + week-4 close-out report.

---

## 4. Dispatch sequencing

```
Pre-flight gates green (§⛔)
    ↓
Dispatch Sub-A + Sub-C + Sub-D + Sub-G in parallel (4 chats, T+0)
    ↓
Sub-A ETL phase merges (~T+3d) → unblocks Sub-B
    ↓
Dispatch Sub-B (chat-B, T+3d)
    ↓
Sub-D readiness gate confirm (~T+1d) — synchronous; minimal work
    ↓
Sub-G decision doc merge (~T+1d) — synchronous; minimal work
    ↓
All Sub-A + Sub-B + Sub-C impl PRs merge (~T+9-10d wall-clock)
    ↓
Cross-batch Python smoke: pytest + dict-eq gate harness re-run on origin/main HEAD (organizer-side)
    ↓
deploy-smartbi-python.sh --env test → smoke → deploy-smartbi-python.sh --env prod (per Phase B-N memory or successor)
    ↓
Sub-F dispatch (organizer-owned nginx flip) → §3.Sub-F protocol
    ↓
Sub-F merge + nginx reloaded
    ↓
Sub-E dispatch (post-flip parity consolidation)
    ↓
Sub-E PR merged
    ↓
Sub-H ongoing — week-1 / week-4 / 30-day close-out
    ↓
Phase D readiness GREEN → Phase D MO draft trigger
```

---

## 5. Open questions for organizer (resolve before dispatch)

1. **Sub-A/B cohort dispatch**: dispatch Sub-A + Sub-B in parallel from T+0 with Sub-B internally waiting on Sub-A ETL phase merge ping (smaller wall-clock), OR serialize Sub-B behind full Sub-A merge (cleaner but +5d wall-clock)? Recommendation: parallel with explicit ETL-merge gate communicated in Sub-B kickoff ping.
2. **Q1 amendment binding interpretation**: PR #199 + PR #203 detail specs were written PRE-Q1; their main bodies still describe mock-parity. Q1 amendment headers say "drop JavaRandom etc". Should this MO incorporate spec-body inline corrections, OR rely on the amendment header alone? Recommendation: this MO §3 Sub-A/B specifics codify the real-DB path; Sub-A/B chats authoritative on amendment + this MO §3, NOT the unamended spec body. PR #220 §6 follow-up (rec to bake amendment into spec bodies) is still pending — organizer can resolve in parallel as a doc-only PR.
3. **JavaRandom helper PR #226 fate**: helper exists in `backend/python/smartbi_compat/_java_compat.py` + tests; Q1 chose real-DB so no T6.6 consumer remains. Options:
   - **A** (recommend): KEEP dormant — minimal carrying cost (~120 LOC + tests); useful if Phase 2C / future port revisits a Java mock-data service.
   - **B**: DELETE in a Sub-G companion PR — net negative LOC; clean codebase signal.
   - **C**: REPURPOSE — find another consumer (none currently identified).
4. **Active-E2E framework reuse vs net-new**: PR #218 v1 framework is shipped for Phase 2A endpoints. Sub-H extension scope: extend PR #218 + add 4 new suites in same package, OR write a T6.6-specific framework? Recommendation: extend PR #218 — same harness, same dict-eq gate dispatcher, less divergence.
5. **Sub-F cohort regex inclusion of T6.4 14 customer factories**: T6.4 cascade put 14 real customer factories on Python upstream for Phase 2A endpoints. Sub-F flip adds 4 more endpoints. Should the same 14 customers + F001 + F999 be in cohort, OR canary 1-3 customers first then expand? Recommendation: **canary 1-3 customers first** (e.g. F001 + RES_3101_009 + R_GML_DEMO) — match Phase 2A T6.2 canary pattern. PR-Sub-F backup vhost + active E2E provide rollback safety.
6. **F999 status (Sub-G)**: keep current 410 (Decision 2A), OR include F999 in Sub-F cohort? Hard precondition for Sub-F dispatch.
7. **Strict-byte gate adoption**: Phase 2A officially dict-eq (per `python-java-port.md` Rule 4 + PR #153 chat 3 decision). T6.6 inherits dict-eq. Should T6.6 Phase B re-evaluate for any of the 4 endpoints (e.g. `/query` LLM narrative text where byte-identical might matter)? Recommendation: **stay dict-eq** — Phase 2A stayed dict-eq for analysis_*.py with no customer impact; T6.6 has no stronger driver. If Phase 3+ flips, retroactive sweep can include T6.6.
8. **Sub-H 30-day soak compression**: HARD rule `active-E2E-replaces-passive-soak` allows compression. Should Sub-H run a compressed 7-day active-E2E window instead of 30-day calendar soak? Recommendation: **active-E2E checkpoints at T+1, T+3, T+7, T+14, T+30**. If T+7 clean + 0 P1, organizer may declare Phase D readiness early without waiting full 30 days. Document the compression decision in Sub-H week-1 close-out.

---

## 6. ⛔ HOLD INSTRUCTIONS

This document is a **DRAFT MARCHING ORDER**. Do NOT:
- Touch any Python source code in `backend/python/smartbi_compat/`.
- Modify `backend/python/main.py` router includes.
- Run any deploy script (`deploy-smartbi-python.sh`, `deploy-backend.sh`).
- Touch nginx vhost on server 139.
- Push branches to origin (other than the dispatch doc itself per §7 below).
- Create any sub-batch chats / worktrees.
- Land any database migration (V20260815_*).

Until organizer (Steve) explicitly says "GO T6.6 Phase B dispatch" AND all pre-flight gates §⛔ green.

---

## 7. Dispatch doc finalization (this PR — what THIS chat does)

This chat (the MO drafter) does **only** the following:

```bash
# Already in worktree .worktrees/t6-6-phase-b-mo-draft (per Step 0 above)
git status --short                      # confirm only this dispatch file is staged/dirty
./scripts/safe-commit.sh "docs(t6-6-phase-b): 8-chat parallel execute marching order draft (Q1 real-DB)" \
    docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md
git push -u origin ops-t6-6-phase-b-mo-draft

gh pr create --title "docs(t6-6-phase-b): execute marching order draft (8-chat parallel, Q1 real-DB, HOLD)" --body "$(cat <<'EOF'
## Summary

Drafts the T6.6 Phase B execute marching order per PR #196 (Phase A design) + PR #199/#202/#203/#204 (4 endpoint detail specs) + PR #220 (cross-PR consistency audit) + PR #223 (Q1 real-DB sign-off) + PR #226 (JavaRandom helper, now ORPHAN per Q1).

8 sub-batches:
- Sub-A: `/analysis/production` Python port (real-DB, ~5d + share ETL)
- Sub-B: `/analysis/quality` Python port (real-DB, ~5d + share ETL)
- Sub-C: `/query` rule engine port (Approach A, ~9d firm)
- Sub-D: `/drill-down` parity verify re-run (~0.5d, Python impl shipped per PR #204)
- Sub-E: 4-endpoint dict-eq parity gate consolidation (post-flip, ~1d)
- Sub-F: nginx regex update batch (organizer-owned)
- Sub-G: F999 SmartBI Analysis migration decision doc (~0.5d)
- Sub-H: post-deploy active E2E + 30-day soak monitoring (ongoing)

Each sub-batch enforces: pre-flight build + smoke gate, byte-shape parity protocol (Rule 4 dict-eq + Rules 1-12 audit), safe-commit Rule 5b paths-only mode, STOP-and-ping organizer BEFORE push, Sub-F nginx flip organizer-only.

## Status

⛔ **DRAFT / HOLD** — Do not execute. Awaiting organizer trigger after:
- T6.5 Phase C 100% close
- T6.5 Phase C prod cutover ≥30d soak (or active-E2E shortcut window)
- Pre-flight gates §⛔ all green
- §5 open questions resolved by organizer

## Predecessors

- PR #196 (T6.6 Phase A design) — merged
- PR #199 (production-port detail) — merged
- PR #202 (query-port detail) — merged
- PR #203 (quality-port detail) — merged
- PR #204 (drill-down parity verify) — merged
- PR #220 (cross-PR consistency audit) — merged
- PR #223 (Q1 real-DB sign-off) — merged
- PR #226 (JavaRandom helper, orphan post Q1) — merged
- PR #227 (T6.5 Phase C MO, mirror style) — merged

## Test plan

- [ ] Organizer reviews scope vs PR #196 §6 + PR #220 §6
- [ ] Organizer resolves §5 open questions (8 items)
- [ ] Organizer confirms HARD KEEP list (§1) reflects Q1 amendment §1 final paragraph (Java mock stays for Dashboard composite)
- [ ] Organizer confirms cohort dispatch (§5 Q-1 + Q-5)
- [ ] Steve approves before any sub-batch dispatch fires

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After PR opens — ping organizer for admin-merge. **Do not deploy. Do not start any sub-batch chat from this session. Do not touch any Python module. Do not touch nginx.**

---

**End of T6.6 Phase B execute marching order DRAFT.**
