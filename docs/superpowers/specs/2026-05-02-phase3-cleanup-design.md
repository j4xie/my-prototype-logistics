# Phase 3 Cleanup Design (A/B/C, post-T6 stable)

> **Status**: Doc-only spec. Cleanup execution gated on T6 nginx cutover Stage 4 + 7-day soak (per PR #59 §6) + Phase 3.x soak windows below.
>
> **Writing date**: 2026-05-02
> **Author**: Phase 2A standby session (Chat 5)
> **Companion docs**:
> - `plans/2026-05-01-phase3-ai-migration-rollout.md` (PR #29) — Phase 3 high-level rollout timing + flag flip + soak
> - `specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` (PR #59) — T6 4-stage nginx cutover design
> - **Chat 2 in-flight T6 deploy runbook** — operator-level execute steps for T6 stages
> - **This spec** — operator-level execute steps for **Phase 3.A/B/C cleanup** AFTER T6 stable
>
> **Phase 2A scope lock (`project_apr30_tool_skill_stays_java.md`)**: Tools / Skills / AIIntentService stay Java forever. This spec respects that — does NOT delete code those depend on.

---

## 1. 背景 + Pre-cleanup prerequisites

### 1.1 What this spec is

After T6 nginx cutover (PR #59) routes Phase 2A in-scope `/api/mobile/{factoryId}/smart-bi/analysis/*` traffic to Python, the corresponding Java implementations become **dead code on the production path** but still exist in the codebase. They:

- Compile in CI builds (no functional impact, just bytecode bloat)
- Get scanned/indexed by IDE / sonar / dependabot tools (signal-to-noise increases)
- Confuse new contributors ("which path actually serves prod?")
- Carry maintenance burden (any framework upgrade still needs to compile them)

Phase 3 cleanup deletes the dead Java code in 3 ordered phases: **3.A → 3.B → 3.C**. Each phase gated on the previous phase landing + 1-week stable soak.

### 1.2 What this spec is NOT

- **NOT a deletion of all Java AI/SmartBI code.** Tools/Skills/AIIntent stay Java per scope lock. Many DashScopeClient consumers are in those paths and stay.
- **NOT execution.** No `git rm`, no actual file deletion in this PR. This is the **plan**.
- **NOT a rollback re-architecture.** Each phase is reversible via simple `git revert`.

### 1.3 Hard prereqs (gating Phase 3.A entry)

All must be ✅ before any Phase 3 cleanup PR opens:

- [ ] T6 Stage 4 100% Python traffic for **7+ days** (per PR #59 §6 T6.4 GO criteria)
- [ ] T6 monitoring metrics stable (error rate <0.5%, p99 within tolerance, no manual rollback events)
- [ ] Phase 2A in-scope endpoints all in Python with contract tests passing
- [ ] Phase 2B-β orchestrator stable >2 weeks production soak (per PR #29 §2.1 soak checklist)
- [ ] Kill switch (`AI_USE_PYTHON_MATCHER=false` revert path) verified working in last 30 days at least once (canary or planned exercise)
- [ ] No P0/P1 bugs reported against migrated endpoints in last 14 days
- [ ] Java backend baseline metrics captured for diff comparison post-cleanup (heap usage, startup time, JAR size)

### 1.4 Phase ordering (cannot be parallelized)

```
Phase 3.A (DashScopeClient SmartBI-path consumers)
    ↓ 1-week soak ↓
Phase 3.B (SmartBI analysis impl + controller)
    ↓ 1-week soak ↓
Phase 3.C (deprecated flags + config)
```

Why ordered: 3.B deletes `SmartBIServiceImpl` which is one of the DashScopeClient consumers updated in 3.A. Doing 3.B first would leave inconsistent state. 3.C touches the flag that gates Phase 2B-β's Python orchestrator — once Phase 3.A/B is done, flag becomes vestigial.

---

## 2. Phase 3.A — DashScopeClient SmartBI-path consumer migration

**⚠️ Important scope correction from initial framing**: The original task description suggested "delete `DashScopeClient.java`" but `DashScopeClient` has **25 consumers** across the codebase, many of which are in code that stays Java per scope lock (Tools/Skills/AIIntent). Phase 3.A only migrates the **SmartBI-path consumers** to `PythonLLMClient`. `DashScopeClient.java` itself remains until a future Phase 4+ scope decision (out of Phase 3 reach).

### 2.1 Consumers — full inventory

`grep DashScopeClient backend/java/cretas-api/src/main/java/` returns **25 files** as of 2026-05-02. Categorized:

#### 2.1.1 In Phase 3.A scope — migrate to PythonLLMClient

These are **SmartBI / AI-insight / analysis path** consumers whose Python equivalent is already in production via Phase 2A migrations:

| File | Path | Migration target |
|---|---|---|
| `service/smartbi/impl/SmartBIServiceImpl.java` | AI insight generation for analysis composite | Already wired to Python via Phase 2A; delete the Java DashScopeClient call sites + injected field |
| `service/smartbi/impl/ChartTemplateServiceImpl.java` | LLM chart template recommendations | Python `chart_builder.py` covers this; delete Java consumer |
| `service/AIAnalysisService.java` (interface + impl) | Analysis prompt → LLM | Python orchestrator handles all analysis intent matching post-Phase 2B-β |
| `service/impl/AnalysisRouterServiceImpl.java` | Routes analysis requests to LLM | Python `llm_router.py` covers this; delete Java consumer if no other path uses it |
| `service/impl/LongTextHandlerImpl.java` | Long-text LLM split | Python equivalent in `llm_router.py`; verify no Tool/Skill dep before delete |
| `service/impl/ResultValidatorServiceImpl.java` | LLM result validation | Python orchestrator handles; verify no Tool/Skill dep |

**Total in scope**: ~6 files, with possible cascading deletion of their interfaces if no other callers.

#### 2.1.2 Out of scope (stays Java per scope lock)

These DashScopeClient consumers are in **Tools / Skills / AIIntent code paths** which stay Java per `project_apr30_tool_skill_stays_java.md`:

| File | Reason kept |
|---|---|
| `service/execution/ToolDispatchService.java` | Tool execution orchestration |
| `service/execution/IntentExecutionOrchestrator.java` | Intent execution path |
| `service/execution/SseStreamingService.java` | SSE streaming for Canvas / Mall AI chat |
| `service/skill/impl/SkillExecutorImpl.java` | Skill execution layer |
| `service/impl/LlmIntentFallbackClientImpl.java` | Phase 3 LLM fallback (Java side, dual-path) |
| `service/impl/ToolRouterServiceImpl.java` | Dynamic Tool routing via LLM |
| `service/impl/AgentOrchestratorImpl.java` | Agent team orchestration |
| `service/impl/ConversationServiceImpl.java` | Conversation memory + chat |
| `service/impl/ConversationMemoryServiceImpl.java` | Conversation memory persistence |
| `controller/GenericAIChatController.java` | Generic AI chat endpoint |
| `controller/CanvasAIController.java` | Canvas AI integration |
| `ai/tool/impl/pagedesign/PageGenerateTool.java` | 4 Tools: page generation |
| `ai/tool/impl/pagedesign/PageStyleUpdateTool.java` | |
| `ai/tool/impl/pagedesign/PageComponentAddTool.java` | |
| `ai/tool/impl/pagedesign/PageDataBindTool.java` | |
| `ai/tool/impl/decoration/HomeLayoutUpdateTool.java` | 2 Tools: home layout |
| `ai/tool/impl/decoration/HomeLayoutGenerateTool.java` | |
| `ai/client/PythonLLMClient.java` | Phase 3 dual-path client (NEW, stays) |
| `ai/client/DashScopeClient.java` | The class itself stays for above consumers |

**Total kept**: ~19 files. None of these are touched by Phase 3.A.

### 2.2 Phase 3.A migration steps (per consumer)

For each Phase 3.A scope file (§2.1.1):

1. **Verify no Tool/Skill back-reference**: `grep -rn "{ConsumerClassName}" backend/java/cretas-api/src/main/java/com/cretas/aims/{ai/tool,service/skill}/` — must be 0 hits before proceeding
2. **Check Python equivalent shipping confirmed**: corresponding Phase 2A endpoint shows in main + T6 cutover routes traffic there
3. **Remove `@Autowired DashScopeClient` field** in the Java consumer
4. **Remove all DashScopeClient call sites** in the consumer's methods
5. **If consumer is now empty (no other logic)**: delete the file entirely + interface
6. **If consumer still has non-LLM logic**: keep file, just gut LLM-specific code paths
7. **Remove dead imports** (DashScopeClient, related DTOs)
8. **Run `mvn compile` locally** to verify no broken references

### 2.3 Phase 3.A PR shape

- 1 PR (single atomic cleanup)
- LOC: ~150-300 deletions, 0 additions
- Files touched: 6-12 (depending on cascading interface deletions)
- Test impact: Java unit tests for these classes already coverage by Python contract tests post-T6; remove obsolete Java tests
- Build verification: `mvn clean compile` green; `mvn test` green (with affected tests removed)
- Deploy gate: T6.4 + 7d soak ✅

### 2.4 Phase 3.A rollback

`git revert <commit>` restores all 6-12 files. Spring DI re-injects DashScopeClient. Java path doesn't actually serve traffic post-T6 (nginx routes to Python), so even if rollback is buggy, no production impact.

---

## 3. Phase 3.B — SmartBI analysis impl + controller cleanup

### 3.1 Inventory of in-scope deletions

**Controllers (1 file)**:
- `controller/SmartBIAnalysisController.java` — entire file. All endpoints now served by Python.

**Service interfaces + impls** (9 pairs, 7 deletable + 2 kept per scope lock):

| Service pair | Status | Reason |
|---|---|---|
| `DepartmentAnalysisService` + `DepartmentAnalysisServiceImpl` | DELETE | Migrated to Python (PR #52 + #57) |
| `FinanceAnalysisService` + `FinanceAnalysisServiceImpl` | DELETE | Migrated to Python (5 sister × PR-A+PR-B + sub-endpoints) |
| `RegionAnalysisService` + `RegionAnalysisServiceImpl` | DELETE | Migrated to Python (PR #56 + #60) |
| `SalesAnalysisService` + `SalesAnalysisServiceImpl` | DELETE | Migrated to Python (PR #14/#15/#20) |
| `ProcurementAnalysisService` + `ProcurementAnalysisServiceImpl` | DELETE | Migrated to Python (PR-A in flight; gated on Wave 3 cascade) |
| `InventoryHealthAnalysisService` + `InventoryHealthAnalysisServiceImpl` | DELETE | Migrated to Python (`/analysis/inventory` PR #53/#54). **Verify naming**: Java's `InventoryHealthAnalysisService` matches Python's `analysis_inventory.py` per spec PR #47 |
| `DynamicAnalysisService` + `DynamicAnalysisServiceImpl` | **KEEP** | Phase 2A backlog map §2.2 SmartBIDashboardController list shows `/analysis/dynamic` + `/analysis/dynamic/kpis` as Phase 2A+1 candidates (Dashboard subset). Not migrated yet. |
| `QualityAnalysisService` + `QualityAnalysisServiceImpl` | **KEEP** | Phase 2A §2.4 deferred (Java mock-only per PR #37). Re-spec when real Java entity lands. |
| `ProductionAnalysisService` + `ProductionAnalysisServiceImpl` | **KEEP** | Phase 2A §2.4 deferred (Java mock-only per PR #37). Re-spec when real Java entity lands. |

**Other Java SmartBI files unaffected by Phase 3.B**:
- `controller/SmartBIConfigController.java` — config management, out of Phase 2A scope per backlog map §1
- `controller/SmartBIDashboardController.java` — Dashboard endpoints not migrated (Phase 2A+1 candidates)
- `controller/SmartBIPublicDemoController.java` — demo data, out of Phase 2A scope
- `controller/SmartBIUploadController.java` — Excel upload, out of Phase 2A scope (Excel parsing in separate Python `/api/excel/*`)
- `service/smartbi/impl/AlertThresholdServiceImpl.java` — kept (alerts come from Java + Python both during Phase 3 transition)
- `service/smartbi/impl/ChartTemplateServiceImpl.java` — Phase 3.A migration target (LLM chart template), but file likely stays for non-LLM template code
- `service/smartbi/impl/ExcelDataPersistenceServiceImpl.java`, `ExcelDynamicParserServiceImpl.java` — Excel pipeline, kept
- `service/smartbi/impl/ForecastServiceImpl.java` — forecast logic, out of scope
- `service/smartbi/impl/IncentiveRuleServiceImpl.java` — incentive plan logic; check if Phase 2A `/incentive-plan` PR #43 fully replaced this or if Java keeps for backend internal use
- `service/smartbi/impl/LLMFieldMappingServiceImpl.java` — touched by `/datasource/upload` deferred (PR #49); kept until that endpoint re-specs
- `service/smartbi/impl/MetricCalculatorServiceImpl.java` — used by Tools/AIIntent path, kept
- `service/smartbi/impl/MetricFormulaServiceImpl.java` — same
- `service/smartbi/impl/RecommendationServiceImpl.java` — `/recommendations` Phase 2A endpoint migrated (batch shipped); verify Java side fully unused before delete (potential Phase 3.B candidate, audit during execution)
- `service/smartbi/impl/SmartBIServiceImpl.java` — touched by Phase 3.A migration (DashScopeClient consumer); after 3.A may be heavily gutted. Phase 3.B can finish-delete if no other live callers
- `service/smartbi/impl/SmartBiSchemaServiceImpl.java` — `/datasource/preview/upload/apply` are §2.4 deferred (stub), keep entire file

### 3.2 DTO retention

**KEEP all DTOs** in `dto/smartbi/` and `entity/smartbi/`. Java still:
- Reads SmartBI tables in non-Phase-2A code paths (Tools, Skills, MetricCalculator, IncentiveRule, etc.)
- Provides DTOs that may be returned by other endpoints (Dashboard, Config, Upload)

Examples of DTOs to keep: `SchemaChangePreview`, `DashboardResponse` (used by `SmartBIDashboardController`), `KPICard`, `AIInsight`, `MetricResult`, `ChartConfig`, `RankingItem`, `DateRange`, `SmartBiDatasource` (entity), `SmartBiFieldDefinition` (entity), `SmartBiSchemaHistory` (entity), `SmartBiSalesData`, `SmartBiDepartmentData`, etc.

### 3.3 Phase 3.B migration steps

1. **Delete the controller**: `git rm controller/SmartBIAnalysisController.java`
2. **Delete 7 Analysis service interface + impl pairs** (department / finance / region / sales / procurement / inventoryHealth / [pending Dynamic decision])
3. **Cascade-delete unused dependencies**: any service that was ONLY consumed by deleted Analysis impls can also delete (e.g., if a private helper service became orphan)
4. **Audit static-code-analyzer warnings**: `mvn dependency:analyze` to find newly-orphaned classes
5. **Update `pom.xml` if** any dependencies were uniquely used by deleted code (unlikely but possible)
6. **Remove obsolete tests**: any `*AnalysisServiceImplTest.java` for deleted impls
7. **Run `mvn clean compile && mvn test`** to verify
8. **Verify no Spring `@Autowired` injection failures**: search for `@Autowired ... AnalysisService` field usages — must all be in deleted-or-still-Phase-2A-migrated path

### 3.4 Phase 3.B PR shape

- 1 PR (large but atomic — easier to revert as a unit than 7 small PRs)
- LOC: ~3000-5000 deletions (each AnalysisServiceImpl is ~500-1500 LOC), ~100 additions (test cleanup)
- Files touched: ~25-35 (controller + 14 service files + tests + minor cleanup)
- Test impact: substantial — delete affected Java tests, add a single "smoke test" verifying SmartBIAnalysisController is gone (404 directly to Java if anyone bypasses nginx)
- Build verification: `mvn clean compile && mvn test` + `mvn package -DskipTests` green
- Deploy gate: Phase 3.A merged + 1-week stable soak

### 3.5 Phase 3.B rollback

`git revert <commit>` restores all files. Spring DI restores. Java path doesn't serve traffic (T6 nginx routes to Python). Even if rollback exposes a Java compilation issue, prod is unaffected because nginx still routes to Python.

**Mitigation pre-execution**: snapshot a JAR build before Phase 3.B execution and store at `gs://cretas-ops/jars/pre-phase3b-aims-0.0.1-SNAPSHOT.jar` (or equivalent) for ultra-fast emergency rollback.

---

## 4. Phase 3.C — Deprecated flags + config cleanup

### 4.1 Inventory

**Flags to remove** (per `application.properties` + `AIIntentServiceImpl.java`):

| Flag | File | Cleanup action |
|---|---|---|
| `ai.use-python-matcher` | `application.properties:1` | Remove the property line entirely; remove `@Value("${ai.use-python-matcher:false}")` injection in `AIIntentServiceImpl.java`; delete the false-branch logic (legacy in-process pipeline) |
| Phase 2A migration phase flags (TBD) | various env files | Audit for any feature-flag-style settings introduced during Phase 2A; remove if dead |
| Phase 3 canary whitelist (NOT YET ADDED) | n/a | Per PR #29 §3.1 "依赖 Java 改造", this whitelist field was suggested but not implemented. If never added → no cleanup needed. If added → remove. |

**Config files to scan** (per `find backend/java/cretas-api/src/main/resources/`):
- `application.properties`
- `application-pg.properties`
- `application-pg-prod.properties`
- `application-prod.properties`
- `application-dev.properties` (if exists)

### 4.2 Code paths to gut

`AIIntentServiceImpl.java`:
- Line 88-89: `@Value("${ai.use-python-matcher:false}") private boolean usePythonMatcher;` → DELETE
- T20 integration code (line 244-281 per PR #29 reference): the `if (usePythonMatcher) { ... } else { /* legacy */ }` branch — delete `else` arm, hardcode the `if` body as default
- Any related fallback/retry logic that's specific to "what to do when Python returns empty" since Python is now always-on

### 4.3 Phase 3.C migration steps

1. **Confirm flag is `true` in prod for ≥30 days** with no rollback events
2. **Confirm no live `@Value("${ai.use-python-matcher")` injections elsewhere**: `grep -rn "use-python-matcher\|usePythonMatcher" backend/java/cretas-api/src/main/`
3. **Remove the property line** from all `application*.properties` files
4. **Gut `AIIntentServiceImpl.java`**: delete the field + delete the legacy-pipeline branch + simplify method signatures if they took the flag
5. **Update doc references**: `docs/superpowers/plans/2026-05-01-phase3-ai-migration-rollout.md` §4.3 marks this complete
6. **Update `.env.prod` on server** to remove `AI_USE_PYTHON_MATCHER=true` (no longer read by code)
7. **Run `mvn clean compile && mvn test`**
8. **Bump JAR version** if release tooling expects a marker

### 4.4 Phase 3.C PR shape

- 1 PR (smallest of three)
- LOC: ~50-100 deletions (mostly the legacy branch in `AIIntentServiceImpl`), ~5 additions (any inline simplifications)
- Files touched: ~5 (1 Java + 3-4 properties + plan doc update)
- Test impact: affected tests already exercise the post-Python-matcher path; remove tests that specifically tested the legacy branch
- Build verification: `mvn clean compile && mvn test`
- Deploy gate: Phase 3.B merged + 1-week stable soak + flag-true ≥30 days in prod

### 4.5 Phase 3.C rollback

`git revert` restores. The flag becomes readable again as `false` default. **HOWEVER**: post-Phase 3.A/B, the legacy in-process pipeline is gone (DashScopeClient calls in SmartBI path removed, Analysis services deleted). Setting flag to `false` would NOT actually re-enable the legacy path — that path is dead code.

**Mitigation**: rollback of 3.C is mostly cosmetic; if the flag is truly needed to bypass Python orchestrator, that's a sign Phase 3.A or 3.B was premature and **those** must be reverted first.

---

## 5. PR slicing + sequencing

```
T6.4 stable + 7d soak (per PR #59 §6)
    ↓
Phase 3.A PR (DashScopeClient SmartBI-path consumer migration)
    LOC ~150-300 deletions
    7 days stable soak
    ↓
Phase 3.B PR (SmartBI analysis impl + controller cleanup)
    LOC ~3000-5000 deletions
    7 days stable soak
    ↓
Phase 3.C PR (deprecated flags + config cleanup)
    LOC ~50-100 deletions
    Phase 3 cleanup COMPLETE
```

**Total cleanup duration**: ~3-4 weeks of stable execution post-T6 stable.

**Why not parallel**: Phase 3.B deletes files Phase 3.A has gutted. Phase 3.C depends on Phase 3.A/B leaving the codebase in a state where the flag is vestigial.

---

## 6. Verification + rollback per phase

### 6.1 Pre-execution checklist (each phase)

- [ ] Previous phase merged + 7-day stable soak (or 30-day for 3.C flag)
- [ ] `pytest tests/python/smartbi_compat/` green
- [ ] `mvn clean compile` green on `origin/main`
- [ ] `mvn test` green on `origin/main`
- [ ] Java backend health curl green: `curl http://47.100.235.168:10010/api/mobile/health`
- [ ] Python backend health curl green: `curl http://47.100.235.168:8083/health`
- [ ] No P0/P1 bugs filed in last 14 days against migrated endpoints
- [ ] T6 dashboards show no Java upstream traffic for `/api/mobile/*/smart-bi/analysis/*` (post-T6.4 should be 0%)

### 6.2 During-execution checklist

- [ ] JAR snapshot stored (Phase 3.B critical): `aims-0.0.1-SNAPSHOT.jar.bak.pre-phase3{a,b,c}_<timestamp>` on server 47 + R2 backup
- [ ] Rollback git command pre-staged: `git revert <expected-commit-hash>`
- [ ] Deploy via `./scripts/deploy/deploy-backend.sh --env test` first per `feedback_test_before_prod_smartbi.md`
- [ ] Test env smoke for ≥1 hour before prod deploy
- [ ] Prod deploy via `--env prod` after test passes

### 6.3 Post-execution monitoring

- [ ] First hour: `watch -n 30 systemctl status cretas-backend cretas-python` + nginx 5xx rate via dashboard
- [ ] First 24 hours: error-rate alerting active per PR #59 §8.3
- [ ] First 7 days: collect baseline-vs-cleanup heap usage / startup time / JAR size diff (Phase 3.B will show notable JAR shrinkage)
- [ ] Filed in `docs/superpowers/handoff/<date>-phase3-{a,b,c}-snapshot.md`: pre/post metrics + GO/NO-GO decision for next phase

### 6.4 Rollback triggers (any one ⇒ revert)

- Java `mvn compile` fails post-deploy (impossible if pre-deploy build was green, but safety check)
- Java backend OOM or repeated restarts
- Tools/Skills failures attributable to Phase 3.A migration (e.g., a Tool that depended on a now-deleted helper)
- nginx 5xx spike on Java upstream (means a path was supposed to stay Java but now hits deleted code)
- Critical bug filed against any migrated SmartBI endpoint

### 6.5 Rollback procedure

```bash
# On developer workstation
ssh root@47.100.235.168
cd /www/wwwroot/cretas
cp aims-0.0.1-SNAPSHOT.jar.bak.pre-phase3{a,b,c}_<timestamp> aims-0.0.1-SNAPSHOT.jar
systemctl restart cretas-backend
# Recovery: ~95s (per .claude/rules/server-operations.md test env auto-restart §)

# Then on developer workstation, revert the commit
cd C:/Users/Steve/my-prototype-logistics
git revert <commit-hash>
git push
# Open PR for the revert; admin merge to lock the rollback in main
```

Recovery time: ~95s (JAR swap) + 1-2 min (revert PR landing). Total ~5 min to fully rolled back.

---

## 7. References

| Doc | Purpose |
|---|---|
| `plans/2026-05-01-phase3-ai-migration-rollout.md` (PR #29) | Phase 3 high-level rollout (when to flip flag, soak windows, dashboard) |
| `specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` (PR #59) | T6 nginx cutover 4-stage plan; gating prereq for Phase 3 |
| `plans/2026-04-11-nginx-upstream-migration-audit.md` | nginx upstream pattern (cretas_backend named upstream) |
| `plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` (PR #61) | Phase 2A scope tracker; auth source for "what's migrated to Python" |
| `.claude/rules/server-operations.md` | Server 47/139 architecture, systemd patterns, deploy script semantics |
| `.claude/rules/aliyun-credentials.md` | Server access credentials (for ops execution) |
| `.claude/rules/python-java-port.md` (Rules 1-9) | Byte-shape parity rules; Phase 3 cleanup must not introduce divergence |
| Memory `project_apr30_tool_skill_stays_java.md` | Phase 2A scope lock — Tools/Skills/AIIntent stay Java |
| Memory `feedback_deploy_pipeline.md` | deploy-backend.sh v5.0 blue-green semantics |
| Memory `feedback_test_before_prod_smartbi.md` | Test env first deployment hard rule |

---

## 8. Operator checklist (execution-ready printable version)

### 8.1 Phase 3.A trigger criteria

ALL must be ✅:

- [ ] T6 Stage 4 100% Python traffic for ≥7 days
- [ ] T6 monitoring metrics stable per PR #59 §6 GO criteria
- [ ] No T6 rollback events in last 30 days
- [ ] Phase 2B-β orchestrator >2 weeks production stable
- [ ] `mvn compile` + `mvn test` green on origin/main
- [ ] Backend health curls green (10010 + 8083)

### 8.2 Phase 3.A execution checklist

- [ ] Create branch `phase3/cleanup-a-dashscope-smartbi-consumers` from origin/main
- [ ] Per consumer in §2.1.1, follow §2.2 migration steps
- [ ] `mvn clean compile && mvn test` locally
- [ ] Snapshot JAR backup (deploy-backend.sh handles auto-backup, but verify)
- [ ] `./scripts/deploy/deploy-backend.sh --env test` + 1h smoke
- [ ] Open PR with body referencing this spec §2 + listing exact files deleted/modified
- [ ] Admin merge after review
- [ ] `./scripts/deploy/deploy-backend.sh --env prod`
- [ ] Watch dashboard for 1 hour (T6 §8 dashboards)
- [ ] File `docs/superpowers/handoff/<date>-phase3a-snapshot.md` with pre/post metrics

### 8.3 Phase 3.B trigger criteria

- [ ] Phase 3.A merged + 7 days stable soak
- [ ] No Tools/Skills failures attributable to Phase 3.A
- [ ] Phase 3.B JAR shrinkage estimate available (run dry-run `mvn dependency:analyze` against feature branch)

### 8.4 Phase 3.B execution checklist

- [ ] Create branch `phase3/cleanup-b-smartbi-analysis-impl`
- [ ] Per §3.1 inventory, `git rm` deletable files
- [ ] Cascade-check via `mvn dependency:analyze`
- [ ] Remove obsolete tests
- [ ] `mvn clean compile && mvn test`
- [ ] **CRITICAL**: snapshot JAR + R2 backup pre-deploy (Phase 3.B is largest deletion; safety net required)
- [ ] `./scripts/deploy/deploy-backend.sh --env test` + 24h smoke (longer than 3.A due to scope)
- [ ] Open PR
- [ ] Admin merge after review
- [ ] `./scripts/deploy/deploy-backend.sh --env prod`
- [ ] Watch dashboard for 24 hours (longer than 3.A)
- [ ] File handoff snapshot

### 8.5 Phase 3.C trigger criteria

- [ ] Phase 3.B merged + 7 days stable soak
- [ ] `ai.use-python-matcher=true` in prod for ≥30 days with no rollback
- [ ] No Phase 3.A/B issues filed

### 8.6 Phase 3.C execution checklist

- [ ] Create branch `phase3/cleanup-c-flags-config`
- [ ] Per §4.1 inventory, remove flag from `application*.properties`
- [ ] Per §4.2, gut `AIIntentServiceImpl.java`
- [ ] Update `plans/2026-05-01-phase3-ai-migration-rollout.md` §4.3 to mark complete
- [ ] `mvn clean compile && mvn test`
- [ ] Test deploy + smoke
- [ ] Open PR
- [ ] Admin merge
- [ ] Prod deploy
- [ ] Watch dashboard for 1 hour
- [ ] File handoff snapshot
- [ ] **Phase 3 cleanup COMPLETE** — file final report doc summarizing pre/post metrics across all 3 phases

---

## 9. Open questions / risks (deferred to execution time)

| # | Risk | Mitigation |
|---|---|---|
| R1 | `DynamicAnalysisServiceImpl` migration status unknown — keep or delete in 3.B? | Resolve at execution time by checking if `/analysis/dynamic` is in Phase 2A migration list (currently §2.4 Dashboard subset = Phase 2A+1 candidate, so KEEP) |
| R2 | `RecommendationServiceImpl` Java side may still have callers outside Phase 2A scope | Audit at execution time via `grep` of @Autowired usage; if any live caller, defer to Phase 3.B+1 |
| R3 | `ChartTemplateServiceImpl` mixed (DashScopeClient consumer for LLM templates + non-LLM template logic) | Phase 3.A only guts LLM portions; don't delete entire file |
| R4 | Cascade deletion may orphan a class used by Tools/Skills via reflection or @ComponentScan | Mitigate via `mvn dependency:analyze` + IDE "Find Usages" before delete |
| R5 | Phase 3.C cleanup of `AI_USE_PYTHON_MATCHER` env var on server may surprise oncall | Document in handoff snapshot + remove env var from `.env.prod` only after Java code no longer reads it (post-Phase 3.C deploy) |
| R6 | Phase 3.B JAR shrinkage may break some monitoring tools that fingerprint by JAR size | Pre-warn ops; expect 10-15% JAR shrinkage from 7 large service deletions |
| R7 | T6 Stage 4 + Phase 3 timeline may stretch beyond Phase 2A team availability | Each phase is independent + reversible — can pause between phases without Phase 3 incomplete being a blocker |

---

**Doc status**: Draft for review. Cleanup execution gated on T6.4 + 7d soak + Phase 3.x ordered soaks per §1.4. Total cleanup window estimated 3-4 weeks of stable execution post-T6 stable.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
