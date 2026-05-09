# Phase 2A Retrospective — Java→Python SmartBI Port (50 endpoints)

**Period**: 2026-04-25 (kickoff) to 2026-05-09 (T6.4 cascade complete)
**Final state**: 100% complete, 75/75 factories on Python prod 8083
**Phase 2A-tagged PRs shipped**: 101 (per `git log origin/main --grep` Phase 2A pattern, 2026-04-29 to 2026-05-09)
**Authoring date**: 2026-05-15 (per PR #150 §6.1 path naming convention)
**Trigger**: PR #150 §6.1 + §10.1 lists this retrospective as Phase A gate; T6.5 Phase A reviews this for deprecation timing caveats.

---

## 0. TL;DR

- 50 SmartBI analysis endpoints ported Java→Python with byte-shape parity (Phase 2A dict-eq gate)
- 12 hard rules graduated to project-level rule file (`.claude/rules/python-java-port.md`)
- T6.1 dryrun parity: **99.945%** (21724/21736 — official Phase 2A parity standard)
- T6.2 (F001 canary) → T6.3 (61 test factories) → T6.4 (14 real customer factories) cascade with **0 customer-impacting incidents**
- T6.4 cascade compressed from 5-day staggered plan to **40 minutes** via HARD rule `active-E2E-replaces-passive-soak`
- Sister-chat parallel organizer dispatch model (4-9 chats parallel per session) sustained through Tier 1/2/3 + multiple audit rounds
- Pattern B (Java legacy fallback structural divergence) caught + closed end-to-end through 6-PR chain (#119 → #124 → #127 → #131 → #135 → #137 → #138)
- F001 Gold POS data populated discovery (REVERTS task #24 finding) — enabled real-data State A test

---

## 1. Context

**Project**: 白垩纪食品溯源系统 (Cretas Food Traceability System).

**Phase 2A scope**: Port 50 SmartBI analysis endpoints from Java (Spring Boot, port 10010) to Python (FastAPI, port 8083) under `backend/python/smartbi_compat/api/`. Endpoints span:

- `/api/mobile/{factoryId}/smart-bi/analysis/finance/{overview,profit,cost,receivable,payable,budget}`
- `/api/mobile/{factoryId}/smart-bi/analysis/{sales,inventory,procurement,department,region}`
- `/api/mobile/{factoryId}/smart-bi/analysis/{drill-down,alerts,yoy-mom,category-comparison,budget-achievement}`
- `/api/mobile/{factoryId}/smart-bi/{datasource,query-templates,incentive-plan,data-date-range}` and other supporting paths

**Migration path**: nginx vhost on server 139 (gateway) routes per-factory regex → Python upstream `cretas_python` (server 47:8083) for cutover-cohort factories; non-cohort factories continue to Java upstream `cretas_java` (server 47:10010).

**Parity gate**: dict-eq (semantic numeric equality, e.g. `Decimal("100") == Decimal("100.00")` after parse). Strict-byte gate explicitly out of scope for Phase 2A — frontend impact verification (PR #155) confirmed apiClient.ts axios + Hermes Date truncation make dict-eq sufficient.

---

## 2. Outcomes

### 2.1 Endpoint port

- **50 endpoints** ported with parity verification
- **3 datasource stub endpoints** (POST upload/preview/apply) added in Phase A close-out (PR #185, Chat G) for scope completeness — mirror Java TODO behavior, not full functional impl
- T6.1 dryrun: 21736 samples (19 endpoints × 1144 iterations), match=21724 (99.945%), diverge=12 (0.055%), compare_err=0
  - 11 of 12 diverges = `analysis/finance?analysisType=budget` Pattern A/A2 byte deltas (integer-Decimal int-collapse + scale-4 trailing-zero loss) — **expected under dict-eq gate** per Rule 4
  - 1 of 12 diverges = `analysis/finance` composite +4531B = Pattern B (Java legacy fallback Python omits) — **fixed via PR #131 → #135 chain**
- T6.1 dryrun crashed at 17h54min due to wrapper script JSONDecodeError + Blue-Green flip; partial sample sufficient for GO criteria

### 2.2 Cutover cascade

| Stage | Date / Time CST | Cohort | Cumulative Python factories | Smoke result |
|---|---|---|---|---|
| T6.0 | 2026-05-06 | nginx prep — `_upstream_cretas_python.conf` + proxy defaults includes | 0 | n/a |
| T6.2 | 2026-05-07 04:01 | F001 canary | 1 | 7/7 |
| T6.3 | 2026-05-08 03:34 | 61 test factories (F001 + 48 FOOD_3101 + 2 MEAT_3101 + 1 OTHER_3101 + 8 RES_3101_001-008 + 1 TEST_0000_001) | 61 | 1159/1159 |
| T6.4 Stage 1 | 2026-05-09 05:54 | F002, F003 | 63 | 9/9 |
| T6.4 Stage 2 | 2026-05-09 06:09 | F004, F006, R001 | 66 | 13/13 |
| T6.4 Stage 3 | 2026-05-09 06:18 | RES_GML_001, RES_3101_009 | 68 | 15/15 |
| T6.4 Stage 4 | 2026-05-09 06:29 | R_GML_DEMO, R_XMX_CHAIN, R_XMX_FRESH | 71 | 16/16 |
| T6.4 Stage 5 | 2026-05-09 06:34 | R_XMX_FRESH2, R_XMX_FRESH3, R_YHDJ_DEMO, R_YJJ_DEMO | **75** | 17/17 |

T6.4 wall-clock from Stage 1 reload to Stage 5 reload: **40 minutes 13 seconds** (vs 5-day plan).

### 2.3 Java surface area

- Pre-T6.4: All 75 factories' analysis traffic on Java 10010
- Post-T6.4: 0 Java SmartBI analysis traffic (only F999 internal-test factory + 4 NOT_SAFE_FALLTHROUGH endpoints stay Java; T6.6 spec PR #180 will migrate these ~mid-July 2026)
- GoldDashboardBuilder explicitly KEPT (per PR #150 §A.3 + Rule §7.3) — Pattern B 3-state Python primary still depends on Java Gold layer for now

### 2.4 Multi-worker enablement

- N=2 uvicorn workers cutover live 2026-05-07 11:36 CST (PR #109, ExecStart `--workers 2`)
- Leader gate via `/tmp/cretas-python-leader-{prod,test}.lock` per-env file lock (PR #103)
- 5 background tasks armed by leader only (narrative_cache pruner / restaurant-ops ETL / chat-session pruner / llm-answer-cache pruner) — avoids 4× INSERT deadlock
- asyncpg pool tuned smartbi 40→15, cretas 8→6 (PR #106) — empirical PG conn peak 86 / 100 cap during c=50/100 sales spike
- T6.3 unblocked by N=2 deployment — single-worker single-GIL JSON serialization was blocking event loop under c~10-15 real load

### 2.5 Database wiring fix sweep (2026-05-05 evening)

- 7/28 endpoints querying `cretas_prod_db` tables via `smartbi_prod_db` engine (silent 5xx in prod) discovered same-day
- 8 PRs shipped (#79 PR-A through #86 PR-H) + commit `e05013b25` (PR-I pb2 regen) by 5 sister chat parallel
- Test env smoke went 12-fail / 7-pass baseline → **19/19 PASS**
- Python prod redeployed + BGE Stage 5 SEMANTIC verified working (`供应商列表` → SUPPLIER_LIST short-circuit @ 0.578)
- Embedding model migrated gte-base-zh-finetuned-onnx-fixed → bge-base-zh-v1.5-onnx-cls (model collapse: cos_sim ≈ 0.999997 between unrelated 4-char Chinese phrases)

### 2.6 Parallel infrastructure work

- Smartbi DB schema migration runner shipped (PR-A #98 / PR-B #100 / PR-C #102 / PR-D) — auto-apply via deploy hook, tracker PK=filename for V20260427_01 dupe defense (8-case test 31/31 PASS, hard rule in `server-operations.md`)
- 8 data fabric C-series migrations applied to smartbi_prod_db (resolves T6.2 4h `field_provenance` 503 error spike of 0.158%)
- Java Blue-Green deploy default (10010↔10020 nginx upstream millisecond zero-cutover) — discovered when wrapper hardcoded `:10010` returned non-JSON during BG flip and crashed dryrun

---

## 3. What worked

### 3.1 Sister-chat parallel organizer dispatch

4-9 chat windows parallel under organizer coordination. Multiple sessions ran the same scaffolding:
- Organizer drafts marching order (path verify → file scope verify → ⛔ HOLD blocks → ⛔ DO NOT RUN UNTIL ORGANIZER GO for prod-touching steps)
- Sister chat opens worktree → reads scope → executes → reports back
- Organizer admin-merges via `gh pr merge --admin --squash --delete-branch` after verifying file scope per `feedback_organizer_admin_merge_verify.md`

Wall-clock acceleration: 4 sister chats × 1 hour parallel = ~1 hour wall-clock vs 4 hours single-chat serial. Today's T6.5 Phase A close-out (single session, ~6 hours including dispatch coordination) shipped 7 PRs.

Effective dispatch boundaries:
- Code impl with byte-shape parity → sister chat
- Audit / cross-verify / spec amend → sister chat
- Marching order draft → sister chat
- Memory updates / handoff doc / retrospective synthesis / admin-merge → organizer-only

### 3.2 Audit pattern + rule graduation discipline

Each Phase 2A bug class went through:
1. Sister chat catches in-PR (e.g. profit chat audit 9 items, 2026-04-30)
2. Same-pattern bug surfaces in next-up sister chat (e.g. payable, then cost)
3. Third independent confirmation → graduate to project-level rule (`.claude/rules/python-java-port.md`)
4. Latent audit sweeps existing files for already-shipped sister sites

Graduation history table maintained in rule file. 12 rules graduated total (Rule 1 through Rule 12).

### 3.3 Sister-chat independent cross-verify

PR #178 audit (single chat 484 LOC) had Chat 4 cross-verify (PR #179, 306 LOC, sister chat NOT reading source audit) catch:
- 7/7 agreement on core claims (HIGH confidence)
- 3 audit-missed findings (POST datasource impl gap; /drill-down nginx route gap; /query vs /query-templates distinction)
- 1 independent confirm (IncentivePlanServiceImpl missing)

ROI estimated 100x — 5 hours cross-verify saved ~2-week Phase B impl rework. Pattern graduated as `feedback_sister_chat_cross_verify_high_value.md`.

### 3.4 Pattern A vs Pattern B distinction

PR #119 dryrun analyzer drew the line:
- Pattern A: Per-occurrence byte delta (integer-Decimal int-collapse + scale-4 trailing-zero loss) — **dict-eq tolerable** per Rule 4 official entry
- Pattern B: Java legacy fallback Python omits (composite +4531B) — **structural, requires port**

PR #122 + #125 confirmed Pattern A via raw-body reproduction at server 47, baked into Rule 4 as Phase 2A dict-eq gate official standard. PR #127 specced Pattern B port with 7/7 Python primitives reuse discovery (smaller ~150-250 LOC than typical port). PR #131/#135 implemented (3-state branching mirror Java line 111-189). PR #137 added 16 tests + 5 goldens + caught Rule 4 latent fix in #135.

### 3.5 Active-E2E-replaces-passive-soak HARD rule

Steve graduated the rule mid-T6.4 cascade (2026-05-09):
> "切换完毕以后,直接用 Claude in Chrome 或者 Playwright 去做用户客户的角度去测试。完全不需要等了。"

Reasoning: 0 customers actively using product → soak windows monitor zero traffic. Active synthetic E2E test (Playwright MCP / e2e-web-admin / agent-browser skill) **generates** customer-perspective requests + verifies UI rendering = actual safety net. Per stage: cutover (5 min) → smoke (5-10 min) → active E2E (15-30 min) → next stage **immediately**.

Compressed T6.4 cascade from 5-day staggered plan to 40 minutes. Rule applies to pre-customer-return state only; re-evaluate once real customers return.

### 3.6 Concurrent-edit safety rule 5b (`git commit -- F1 F2`)

Apr 28 incident-driven (3 same-night collisions) → graduate to default commit habit:
```bash
git commit -m "msg" -- backend/foo.py backend/bar.py
```
`--only` mode ensures only listed paths commit even when concurrent session has staged unrelated files. Phase 2A 2+ chat parallel made this default; `safe-commit.sh` wrapper for verify-after-commit.

### 3.7 Dispatch on technical readiness (not inherited timing anchors)

2026-05-09 organizer chat inherited "13:01 CST May 9 smoke re-verify GO" anchor from outgoing organizer. BG dryrun fired 05:01 instead of projected 13:00 — anchor lost meaning but I kept it for "operator alertness". Steve flagged: "no need to wait, fire now". Same lesson as Apr/May projection-bug pattern. Saved 7.5h with zero technical benefit.

Rule graduated: `feedback_dispatch_on_technical_readiness.md`. Wait ONLY for hard technical prereq / wall-clock-bound metric / sibling sync / Steve explicit ask.

### 3.8 30-second pre-check before deep investigation

Two consecutive 2026-05-09 incidents demonstrated value:
- Issue #1 Java cross-factory leak: Apr 23 deliberate data seed clone (RES_3101_009 = F001 clone for 青花椒 staging+prod pair) — NOT a code bug
- Issue #2 F006 capability 503: `CAPABILITY_ROLLOUT_FACTORIES="F001,RES_3101_009"` env flag rollout cohort gate

Both = 30-90 min deep investigation that ~30 sec grep on factory_id literals + env flags would have caught. Treat F001 + RES_3101_009 as "Gold-populated cohort" — selective behavior gating on this set is likely intentional design.

### 3.9 Frontend impact empirical verification (PR #155)

Chat 1 frontend impact verification (1cd384a01, 331 LOC) — empirical proof Phase 2A dict-eq sufficient:
- apiClient.ts:53 axios auto-unwraps response.data → frontend NEVER sees raw bytes
- formatters.ts:16 toFixed normalizes Pattern A/A2
- Hermes Date truncates µs (Rule 11 OK)
- 5 patterns × 5 categories all pass
- 0/50 endpoints need strict-byte
- ZERO SmartBI hash usage anywhere in frontend
- Phase 3+ stay dict-eq indefinitely (per PR #153 strict-byte adoption decision spec)

This closed the lingering "is dict-eq actually sufficient at the frontend layer?" question with empirical evidence rather than inference.

---

## 4. What didn't work / mistakes

### 4.1 Force-push stale base on long branches

Two incidents:
- **2026-05-02 (region-pr-a, Chat 2 PR #56)**: force-push after 4h gap, branch rebased onto pre-current main → diff showed -2587 lines on sister-owned files (5+ sister chat work would have reverted if admin-merged)
- **2026-05-06 (PR-N-2 PATH B)**: same pattern, 4h gap, branch rebased onto stale base → phantom revert of 3 PRs + deletion of chat 1's test file

Caught by **organizer mandatory `gh pr view --json files` before admin-merge**, cherry-picked sister-only files to clean branch. Rule graduated: `feedback_force_push_stale_base_after_long_branch.md` + `feedback_organizer_admin_merge_verify.md`. Squash merge alone is NOT enough — squash takes ALL commits' diff including phantom reverts.

### 4.2 Marching-order method-name drift (8/26 caught)

T6.5 Phase A close-out organizer dispatched 4 sister chats with 8 method names paraphrased from URL path or audit doc instead of grep'd from source:

| Organizer claim | Actual Java method |
|---|---|
| `getFinanceBudgetAchievement` | `getBudgetAchievementChart` |
| `getFinanceYoYMoM` | `getYoYMoMComparisonChart` |
| `getFinanceCategoryComparison` | `getCategoryStructureComparisonChart` |
| `nlQuery` | `query` |
| `uploadDatasource` | `uploadAndDetectSchema` |
| `previewDatasource` | `previewSchemaChanges` |
| `applyDatasource` | `applySchemaChanges` |
| `listDatasource` | `listDatasources` |

Caught by Chat 3 PR-Z impl review (sister chat grep-verifies before edit). Without catch: ~1-2 hours rework per impl pass. Rule graduated: `feedback_marching_order_method_name_grep.md`.

### 4.3 Audit ✓ marks based on router file existence not @router declaration

PR #178 datasource scope: 6 endpoints, all marked "Python ✓". Reality:
- 3/6 active (analysis.py:931 list, datasource.py:246 fields, datasource.py:271 history)
- 3/6 had **no @router declaration** (POST upload, GET preview, POST apply) — file existed but endpoint stubs missing

50% false positive rate. Caught by Chat 4 PR-W cross-verify (independent sister chat, didn't read PR #178). Rule graduated: `feedback_audit_endpoint_impl_not_router.md`. Audit rubric must verify endpoint method declared + non-empty body + golden-equivalent response shape.

### 4.4 Spec drift — PR #150 §1.2 IN-SCOPE vs OUT-OF-SCOPE inconsistency

T6.5 Phase A audit (PR #178) caught PR #150 spec internal contradictions about which Java classes were in deletion scope. Required spec amendment (PR #182) to bake corrections inline rather than carry as patch list. Steve decision 4B: "spec is single source of truth" — PR #150 evolves, audit findings get baked.

### 4.5 Organizer hands-on instead of dispatch (Steve corrected 2× May 9)

After Steve decided long-term combination 1A+2A+3A+4B, organizer (me) directly started editing PR #150 spec myself (PR-X work), wrote ~150 lines commit, prepared push. Steve interrupt: "怎么全是你自己做啊,我们的 prompt 里面不是说了我们有开 4 个另外的 chat 去做并行吗". Discarded commit, dispatched to sister chat.

Same root pattern across Apr/May session: organizer treats "Sister chat 5 min + you 0 min" as worse than "you 5 min + ignore sister availability". Reality is sister chat 5 min + organizer 0 min = organizer free to coordinate / queue / verify in parallel. Rule graduated: `feedback_organizer_dispatch_not_handson.md`.

### 4.6 Sister-chat phase-skip ping (task #31)

2026-05-06 task #31 chat 2 PR-C/PR-D: marching order wrote "完 PR-C ping me 看 deploy log 后才进 PR-D". Chat 2 一气呵成 PR-C + PR-D + ran deploy hook on test AND prod 7 minutes apart, finally pinged once. Outcome harmless (V20260507_02 was idempotent SELECT 1) but process violation. Rule graduated: `feedback_sister_chat_phase_skip_ping.md`. Marching orders now use ⛔ HOLD blocks (not bullet list "ping me"); prod-touching steps use ⛔ DO NOT RUN UNTIL ORGANIZER GO.

### 4.7 Verify scripts with try/except fallback (no defensive in tests)

T6.1 dryrun wrapper had:
- `try: jwt.encode(...) except: return 0, ''` — JWT bytes not decoded → returns 401 status
- `try: j = json.loads(jb); except: per_ep[name] = 'ERR'` — JSON parse failures hidden as 'ERR' label
- aggregate `if total > 0: print(rate)` — ZeroDivisionError silently absorbed

Steve original wording 2026-05-06: "做测试的时候请不要去兜底, 因为很多场景是确实需要防守的". Test code: fail loud over silent skip. Prod code: defensive intentional. Rule graduated: `feedback_no_defensive_in_verify_scripts.md`.

### 4.8 UI smoke scope creep

PR #126 (列宽 fix during Playwright smoke): organizer accepted but flagged "future scope creep rule reminder". Default path = STOP-and-ping organizer file ticket; example exception requires single file + visual evidence + zero risk + same-PR theme. Rule graduated: `feedback_ui_smoke_scope_creep_default_ticket.md`.

### 4.9 Marching-order separation (immediate vs queued)

2026-05-02 multi-chat coordination: 3 sister chats started future-conditional tasks immediately. Mixed-message marching orders (immediate task + future task in same paste) caused Chat 3 to start drill-down impl before spec PR merged; Chat 5 to skip Phase 1 department PR-B → directly Phase 2 procurement PR-B. Rule graduated: `feedback_organizer_marching_order_separation.md`. Each marching order top-tagged `⚡ IMMEDIATE` or `⏳ QUEUED — wait for X`.

### 4.10 Wrapper hardcoded port `:10010` vs Java Blue-Green

T6.1 dryrun wrapper hardcoded `:10010`. Java Blue-Green default flipped 10010 → 10020 mid-dryrun → wrapper got non-JSON (HTML error page) → JSONDecodeError → crash at 17h54min. Filed as follow-up: track active Blue-Green green port or use nginx upstream URL. Reference: `reference_blue_green_java_deploy.md`.

### 4.11 Missing smartbi prod migrations (T6.2 4h discovery)

T6.2 canary 4h hit `field_provenance` 503 errors (0.158% rate) — 8 data fabric C-series migrations originally deployed to test env but missed prod. Single BEGIN/COMMIT applied to smartbi_prod_db, schema parity restored. Long-term solution shipped same day: smartbi-migration-runner (deploy hook auto-apply with tracker table). Reference: `reference_smartbi_prod_db_migration_gap.md` + `reference_smartbi_migration_runner.md`.

---

## 5. Hard rules graduated (`.claude/rules/python-java-port.md`)

- **Rule 1**: Null fallback — `is not None` ternary, NOT Python `or` (Python falsy ≠ Java null)
- **Rule 2**: WEEK period key — calendar year, NOT ISO year (cross-year boundary divergence)
- **Rule 3**: Python function signature — 1:1 mirror Java, no DateRange wrapper
- **Rule 4**: BigDecimal serialization — `_decimal_to_number` helper (FastAPI default emits string; Phase 2A dict-eq gate official entry 2026-05-07)
- **Rule 5**: Shared SQL helpers — `SELECT *`, not enumerated columns (legacy specialized helpers OK to keep)
- **Rule 6**: Input boundary None-check — explicit precondition assertion (asyncpg silent zero-result on NULL)
- **Rule 7**: Float threshold comparison — `Decimal` for non-integer thresholds
- **Rule 8**: `Map.of(N)` Jackson hash order — record golden, mirror byte order (3 occurrences across N=2/3/4)
- **Rule 9**: Lombok + Jackson serialization quirks — getter naming (`Introspector.decapitalize` lowercase), `@JsonInclude(NON_NULL)` absence emits null, derived `is*`/`get*` getters add fields (3 sister-chat independent confirmations)
- **Rule 10**: BigDecimal divide-then-multiply — intermediate quantize at scale-4 then multiply (4 sister-chat hits: alerts/category-comparison/procurement/sales)
- **Rule 11**: Java Jackson `LocalDateTime` — drops trailing-zero microseconds; `_java_isoformat` helper (latent risk on ~50 endpoints)
- **Rule 12**: Java `String.format("%.Nf", d)` HALF_UP vs Python f-string banker's — `Decimal.quantize(rounding=ROUND_HALF_UP)` or `_format_decimal_half_up` helper

---

## 6. Process patterns graduated (memory `feedback_*.md`)

- `feedback_active_e2e_replaces_passive_soak.md` — In pre-customer-return state, NO defensive/soak waiting; replace with Playwright/agent-browser active synthetic E2E
- `feedback_dispatch_on_technical_readiness.md` — Don't pad triggers with operator alertness / aesthetic timing / inherited anchors; fire on technical readiness
- `feedback_30s_precheck_selective_bug_pattern.md` — When bug pattern is selective per-factory, grep factory_id literals + env flags + config defaults FIRST (~30 sec) before deep investigation
- `feedback_sister_chat_cross_verify_high_value.md` — Critical multi-month-plan-feeding audits dispatch independent sister chat to cross-verify (don't read source audit; ROI ~100x)
- `feedback_audit_endpoint_impl_not_router.md` — Audit ✓ marks must verify endpoint method declaration + non-empty body, NOT just router file existence
- `feedback_marching_order_method_name_grep.md` — Marching order method names must grep real source, never paraphrase from URL path or audit doc
- `feedback_organizer_dispatch_not_handson.md` — Organizer dispatches sister chats; never hands-on code/file writes when ≥1 sister chat available
- `feedback_force_push_stale_base_after_long_branch.md` — Long branches (≥2h / ≥2 commits) must `git fetch + rebase + verify diff scope` before force-push; organizer must `gh pr view --json files` before admin-merge
- `feedback_narrow_scope_fix_sister_site_sweep.md` — Narrow-scope bug fix must grep same-file same-pattern sister sites (don't leave for future T6 surface)
- `feedback_organizer_admin_merge_verify.md` — `mergeable=MERGEABLE` insufficient; must `gh pr view --json files` and check sister-owned deletion patterns
- `feedback_organizer_projection_bug.md` — Marching orders must `gh pr view` + `git log origin/main` verify, never assume PR/commit state
- `feedback_organizer_marching_order_separation.md` — Each marching order top-tagged `⚡ IMMEDIATE` or `⏳ QUEUED — wait for X`; never mix in same paste
- `feedback_sister_chat_phase_skip_ping.md` — Marching orders use ⛔ HOLD blocks for inter-phase gates; prod-touching steps use ⛔ DO NOT RUN UNTIL ORGANIZER GO
- `feedback_pause_before_deploy_or_push.md` — Deploy / `git push` always preceded by Steve confirmation (multi-worktree concurrent edit defense)
- `feedback_no_defensive_in_verify_scripts.md` — Test scripts fail loud, NOT silent skip; distinguish prod intentional defense from test fail-loud
- `feedback_ui_smoke_scope_creep_default_ticket.md` — UI smoke bug default = file follow-up ticket, NOT in-PR fix (exception: single file + screenshot + zero risk + same theme + organizer pre-approval)
- `concurrent-edit-safety.md` Rule 5b — `git commit -- F1 F2` paths-only mode default for 2+ chat / IDE active sessions

---

## 7. Pattern B chain (case study)

End-to-end coverage from divergence detection → root-cause investigation → spec → impl v1 → impl v2 → tests → smoke peer review:

| PR | Squash SHA | Date | Owner | Content |
|---|---|---|---|---|
| #119 | `c501632bb` | 2026-05-07 | chat 4 | T6.1 dryrun NDJSON analyzer + GO criteria; identified 12 diverges (11 Pattern A budget + 1 Pattern B finance composite) |
| #124 | `f356e3168` | 2026-05-07 | chat 2 | Pattern B finance composite +4531B root-cause: Java legacy fallback `FinanceAnalysisServiceImpl.getFinanceOverview` line 149+ Python omits |
| #127 | `51dc1eabb` | 2026-05-07 | chat 2 | Pattern B Phase A spec — 7/7 Python primitives reuse discovery, ~150-250 LOC port estimate, config-flip golden recording |
| #131 | `4caa2858d` | 2026-05-08 | chat 2 | PR-B impl — 3 composers (`_convert_metrics_to_kpi_cards` / `_generate_finance_insights` / `_generate_finance_suggestions`) + body rewrite (174 LOC) |
| #135 | `2e90a2016` | 2026-05-08 | chat 2 | PR-B v2 — full 3-state branching (State A Gold-populated 4 KPIs / State B empty / State C legacy fallback). Resolves task #20 `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag gate. 322 LOC cumulative |
| #137 | `5cc0e1837` | 2026-05-08 | chat 2 | PR-C v2 — 16 tests (TestFinanceOverviewStateA × 5 / StateB × 4 / StateC × 6 / ExceptionFallback × 1) + 5 goldens (4 NEW + 1 RE-RECORDED). Caught Rule 4 latent fix in #135. F001 has Gold POS data populated DISCOVERY |
| #138 | `6310f00278` | 2026-05-08 | chat 1 | Peer review smoke verify against real env 8084 (State C ✓ + State B ✓) |

Pattern B sister-endpoint scan (#146) found K-1 sales overview missing flag gate — fix shipped as #149. Both Java Pattern B sites now have Python mirror.

PR #135 prod deployment was T6.4 prereq blocker; deployed via N=2 cutover commit `2e90a2016` 2026-05-07 11:36 CST per chat 3 PR #157 investigation correction (Apr 23 flag flip, NOT May 6 as initially claimed in handoff doc — projection bug caught by chat 3 against ground truth).

---

## 8. Forward-looking (post-Phase 2A)

### 8.1 T6.5 Phase A complete (2026-05-09 evening session)

7 PRs admin-merged in single organizer-mode session:
- **#178** T6.5 Phase A audit v3.1 (Chat 1 + Chat 6) — deletion candidates rubric
- **#179** Phase A independent cross-verify (Chat 4) — 7/7 HIGH confidence + 3 latent finds
- **#180** T6.6 spec — F999 + 4 NOT_SAFE_FALLTHROUGH endpoint Python migration spec (Chat 2)
- **#181** T6.5 Phase B 23-endpoint stub marching order draft (Chat 3)
- **#182** PR #150 spec amend (Chat 1 + Chat 8) — bake audit corrections inline
- **#184** nginx-Python coverage cross-check (Chat 5) — datasource POST gap discovery
- **#185** Chat G datasource POST stub Python impl + 6 goldens + tests

Steve final decisions: 1A (audit reduced scope) + 2A (Option A 410 unconditional, F999 brief outage) + 3A (T6.6 spec) + 4B (PR #150 spec single source of truth).

### 8.2 T6.5 Phase B trigger (next session)

All prereqs satisfied (PR #178 audit + PR #182 spec amend in main). Phase B ships 23-endpoint stub-out under Java SmartBI controller (Option A unconditional 410 Gone with `newPath` migration hint). 14-day soak window per PR #150 §6.2.

### 8.3 T6.5 Phase C/D (~July 2026)

- Phase C: 30-day dead-time confirmation → file removals (controllers / services / impls). Per-domain commits.
- Phase D: Quarterly schema-write audit. Python = canonical writer for smartbi tables.

### 8.4 T6.6 spec (PR #180, ~mid-July 2026)

F999 internal-test factory + 4 NOT_SAFE_FALLTHROUGH endpoint Python migration. Trigger after T6.5 Phase B + Phase C complete. F999 nginx regex add at completion.

### 8.5 Phase 2C (75 endpoints, 4-tier — formerly named Phase 2B in early specs)

Per PR #152 + PR #191 + PR #201 + scoping spec `2026-05-15-phase2b-port-pipeline-scoping-spec.md`:
- Tier 1: SmartBIConfigController 41 endpoints (PR #191 deep-dive design)
- Tier 2: Dashboard
- Tier 3: SmartBIUploadController 13 endpoints (PR #201 design)
- Tier 4: PublicDemo — SUNSET recommended (per PR #152)

Total 75 endpoints, 6-9 month estimate, kickoff blocked on T6.5 Phase C complete.

### 8.6 Phase 3+ strict-byte gate

Per PR #153 strict-byte adoption decision spec + PR #154 test infrastructure spec:
- dict-eq stays Phase 2A indefinitely (per #155 frontend impact)
- per-tier Phase 2B
- case-by-case Phase 3+
- 11 of 12 Rules already byte-strict; Rule 4 = only dict-eq tolerance window

### 8.7 Phase 2A → 2B handoff readiness audit (PR #156)

4✓ / 3⚠ / 0✗ GO with caveats verdict. Gap closure plan: P1 ~3 weeks (Rule 13+ graduation criteria) + P2 ~1 week + P3 ~4 days. All within 58-day window before T6.5 Phase C kickoff.

---

## 9. Open questions for next phase organizer

- **PR #150 §1.2 IN-SCOPE vs OUT-OF-SCOPE final reconciliation**: PR #182 baked audit corrections inline; verify spec internal consistency holds at T6.5 Phase B kickoff
- **Rule 13+ graduation criteria** (per PR #156): Sister chat threshold for byte-strict-only quirks (Rule 1-12 all dict-eq scope) — when does a 2-occurrence pattern graduate vs stay in spec?
- **GoldDashboardBuilder long-term**: Phase A audit §A.3 verifies stays orphaned-vs-still-called by Pattern B. If still-called, Phase B/C scope expands. Pattern B 3-state Python primary depends on this — re-audit at T6.5 Phase A to Phase B advance gate (per PR #150 §6.2)
- **F999 T-72h notification text**: T6.6 spec assumes F999 brief outage during Phase B 410 Gone cutover; customer comms templates for internal team need drafting before Phase B fire
- **strict-byte test infrastructure backfill** (per PR #154): per-port ~3-4 days retroactive on Phase 2A endpoints — schedule windows during Phase 2C tier work
- **K-1 K-2... sister sweep continuation**: PR #146 → #149 closed K-1 sales overview. Are there K-2/K-3 Pattern B latent sites in other analysis_*.py files? Suggest dedicated audit sweep at T6.5 Phase A→B advance gate
- **Worktree cleanup deferral**: 8 worktrees from T6.5 Phase A close-out session still mounted (.worktrees/{t6-5-phase-a-discovery, pr150-spec-amend, pr178-followup, t6-6-spec, t6-5-phase-b-mo-draft, t6-5-phase-a-cross-verify, python-datasource-impl, python-datasource-stub-impl})
- **Embedding model collapse follow-up** (per `reference_embedding_model_collapse.md`): `AI_SEMANTIC_THRESHOLD=1.001` set on prod+test disables Stage 5 short-circuit. BGE migration restored Stage 5 SEMANTIC; long-term threshold tuning still TODO

---

## 10. Cross-references

### Memory / project entries
- `project_2026_05_09_phase_2a_complete.md` — T6.4 cascade close + 75/75 final state
- `project_2026_05_09_t6_5_phase_a_close.md` — 7-PR organizer-mode session evening of close
- `project_2026_05_05_t6_resumption.md` — DB wiring fix sweep + resumption checklist
- `project_2026_05_07_t6_2_canary_live.md` — F001 canary 24h soak
- `project_2026_05_08_t6_3_cutover_live.md` — 61 test factories cutover + 1159/1159 smoke
- `project_2026_05_07_uvicorn_n2_path_x_lite.md` — N=2 multi-worker enablement
- `project_2026_05_08_t6_4_readiness_gates.md` — 3/3 readiness gates close (#141 + #143 + #142)
- `project_2026_05_07_t6_1_dryrun_in_flight.md` — Pattern B chain end-to-end CLOSED detail

### Spec / runbook docs
- `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (PR #150) — T6.5 4-phase A/B/C/D spec
- `docs/superpowers/specs/2026-05-15-phase2b-port-pipeline-scoping-spec.md` (PR #152) — Phase 2C scoping (75 endpoints, 4-tier)
- `docs/superpowers/specs/2026-05-15-strict-byte-gate-phase3-adoption-decision-spec.md` (PR #153) — strict-byte Phase 3+ adoption
- `docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md` (PR #154) — strict-byte test infra design
- `docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md` (PR #180) — T6.6 spec
- `docs/superpowers/specs/2026-05-07-phase2a-finance-overview-real-port-spec.md` (PR #127) — Pattern B Phase A spec
- `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md` (task #30) — smartbi-migration-runner spec
- `docs/superpowers/runbooks/2026-05-07-t6-3-50pct-factories-cutover-runbook.md` (PR #110) — T6.3 cutover runbook
- `docs/superpowers/runbooks/2026-05-08-t6-4-real-customers-cutover-runbook.md` (PR #136) — T6.4 cutover runbook
- `docs/superpowers/runbooks/2026-05-08-t6-4-customer-comms-plan.md` (PR #141) — customer comms templates

### Audit docs
- `docs/qa-audits/2026-05-08-t6-1-dryrun-analysis.md` (PR #119) — T6.1 dryrun GO/no-go
- `docs/qa-audits/2026-05-07-finance-composite-diverge-investigation.md` (PR #124) — Pattern B root cause
- `docs/qa-audits/2026-05-07-h1-confirm-raw-body-evidence.md` — Rule 4 Phase 2A dict-eq gate raw-body evidence
- `docs/qa-audits/2026-05-08-t6-4-baseline-metrics.md` (PR #143) — T6.4 baseline 56 Java + 42 Python JSON fixtures
- `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` (PR #178) — T6.5 Phase A audit v3.1
- `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md` (PR #184) — coverage cross-check

### Rule files
- `.claude/rules/python-java-port.md` — 12 hard rules + audit history table
- `.claude/rules/concurrent-edit-safety.md` — Rule 5b `git commit -- F1 F2` paths-only mode
- `.claude/rules/server-operations.md` — Smartbi DB schema runner HARD RULE + Blue-Green Java deploy
- `reference_blue_green_java_deploy.md` — 10010↔10020 nginx upstream millisecond cutover
- `reference_smartbi_migration_runner.md` — auto-apply migrations via deploy hook
- `reference_smartbi_prod_db_migration_gap.md` — T6.2 4h field_provenance fix
- `reference_smartbi_gold_layer_architecture.md` — Python producer / Java consumer (task #24 reverted)
- `reference_embedding_model_collapse.md` — BGE migration outcome
- `reference_f006_liutengmen_prod_accounts.md` — F006 16 user accounts for E2E

### Backup chain (preserve 30 days minimum)
- `bak.t6_2_pre.20260507_035911` — pre-T6.2 (Java for everything)
- `bak.t6_3_pre.20260508_032339` — pre-T6.3 (F001 only on Python — actually T6.2 state per PR #142 critical find)
- `bak.t6_4_s1_pre.20260509_055328` — pre-Stage-1 (T6.3 state)
- `bak.t6_4_s2_pre.20260509_060823` — pre-Stage-2 (Stage 1 state)
- `bak.t6_4_s3_pre.20260509_061709` — pre-Stage-3 (Stage 2 state)
- `bak.t6_4_s4_pre.20260509_062910` — pre-Stage-4 (Stage 3 state)
- `bak.t6_4_s5_pre.20260509_063332` — pre-Stage-5 (Stage 4 state)

---

## 11. Closing note

Phase 2A 100% complete = nginx routes all 75 production factories' SmartBI analysis traffic to Python `:8083` with byte-shape parity (dict-eq gate, 99.945% match rate). Java SmartBI analysis traffic = 0 (only F999 internal test stays Java pending T6.6).

The compressed T6.4 cascade — 5-day plan to 40 minutes — was less about engineering speed than about correctly identifying the actual constraint: in pre-customer-return state, defensive soak windows monitor zero traffic, while active synthetic E2E generates customer-perspective signals. Every accelerated decision was traceable to a graduated rule, not improvisation.

The 12 hard rules in `python-java-port.md` are the reusable artifact; future Java→Python ports (Phase 2C tiers, T6.6, etc.) should consume these directly rather than re-deriving each pattern from scratch.

Sister-chat parallel organizer dispatch model proved sustainable across 4-9 chat windows, two-week wall-clock. The discipline that made it work — marching order verify-before-write + explicit `⛔ HOLD` gates + organizer admin-merge file-scope verify + sister-chat independent cross-verify on critical audits — became its own meta-pattern, applicable beyond Phase 2A.

T6.5 Phase A unblocked. T6.5 Phase B trigger NOW (all prereqs satisfied per PR #178 + PR #182 in main).
