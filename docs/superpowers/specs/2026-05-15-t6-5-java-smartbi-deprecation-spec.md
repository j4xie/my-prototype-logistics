# T6.5 Java SmartBI Deprecation — Trigger Spec

**Phase**: T6.5 (post-T6.4 cleanup of Java SmartBI analysis layer)
**Status**: Spec / planning doc only — execution contingent on T6.4 100% GO + 14-day dead-time verification window
**Author**: chat 3 (T6.5 deprecation spec writer)
**Date**: 2026-05-08
**Target kickoff**: 2026-05-15+ (after T6.4 24h soak GO, ~2026-05-15)
**Predecessor**: T6.4 5-stage cutover (PR #144 stage MOs, May 10-14 CST)

---

## 0. TL;DR

After T6.4 routes 100% of factories' `/api/mobile/{factoryId}/smart-bi/analysis/*` to Python (8083), the Java SmartBI **analysis** controllers + backing services become dead code. T6.5 is the staged cleanup:

- **Phase A** (14 days): Verify dead status — log monitoring, operator query, no direct Java analysis hits
- **Phase B** (14 days): Stub out Java analysis endpoints (return 410 Gone), keep Spring Bean structure
- **Phase C** (after 30 days dead): Remove Java analysis controller files + service impls + tests
- **Phase D** (ongoing): DB-level audit confirming Python is canonical SmartBI writer

**Out of scope** (KEEP Java code): `GoldDashboardBuilder` + `GoldFinanceClient` (Python downstream consumers per task #24); SmartBI Config / Upload / Dashboard / PublicDemo controllers (Phase 2B+ scope, separate decisions).

---

## 1. Pre-T6.5 state (trigger conditions)

### 1.1 T6.4 completion gate

T6.5 cannot kickoff until **all** of:

- [ ] T6.4 Stage 5 (May 14) 24h soak GO declared
- [ ] All 75 factories on Python `/api/smartbi/analysis/*` via 139 nginx vhost regex
- [ ] 0 P1 customer reports in 24h post-Stage-5 window
- [ ] T6 dryrun-compare ≥99% match rate sustained
- [ ] Phase 2A retrospective doc started (`docs/superpowers/retrospectives/2026-05-15-phase2a-complete.md`)
- [ ] Per-customer §3.5 baseline metrics within ±20% of pre-cutover (revenue / order / dashboard rate)

### 1.2 Java SmartBI deprecation scope

#### IN SCOPE (T6.5 deprecates)

The 26 analysis endpoints on `SmartBIAnalysisController.java` (the 50-endpoint Phase 2A port target after counting service-level methods):

```
@RequestMapping("/api/mobile/{factoryId}/smart-bi")
class SmartBIAnalysisController {
    @GetMapping("/analysis/sales")               // ported
    @GetMapping("/analysis/department")          // ported
    @GetMapping("/analysis/region")              // ported
    @GetMapping("/analysis/finance")             // ported
    @GetMapping("/analysis/finance/budget-achievement")
    @GetMapping("/analysis/finance/yoy-mom")
    @GetMapping("/analysis/finance/category-comparison")
    @GetMapping("/analysis/production")          // ported
    @GetMapping("/analysis/quality")             // ported
    @GetMapping("/analysis/inventory")           // ported
    @GetMapping("/analysis/procurement")         // ported
    @PostMapping("/query")                       // ported (drill-down)
    @PostMapping("/drill-down")                  // ported
    @GetMapping("/alerts")                       // ported (PR-M-1)
    @GetMapping("/recommendations")              // ported
    @GetMapping("/incentive-plan/{type}/{id}")   // ported
    @PostMapping("/datasource/upload")           // ported
    @GetMapping("/datasource/{id}/preview")      // ported
    @PostMapping("/datasource/apply")            // ported
    @GetMapping("/datasource/list")              // ported (PR-M-7 microsecond fix)
    @GetMapping("/datasource/{id}/fields")       // ported
    @GetMapping("/datasource/{id}/history")      // ported
    @GetMapping("/query-templates")              // ported
    @PostMapping("/query-templates")             // ported (write)
    // ... full list per controller line 48-1000+
}
```

Plus their backing service impls (in `service/smartbi/impl/`):
- `SalesAnalysisServiceImpl`
- `DepartmentAnalysisServiceImpl`
- `RegionAnalysisServiceImpl` (if exists separately)
- `FinanceAnalysisServiceImpl`
- `ProductionAnalysisServiceImpl`
- `QualityAnalysisServiceImpl`
- `InventoryAnalysisServiceImpl`
- `ProcurementAnalysisServiceImpl`
- `DynamicAnalysisServiceImpl` (drill-down / query)
- `IncentivePlanServiceImpl`
- (~30 service impl files total per `find` survey)

#### OUT OF SCOPE (T6.5 KEEPS Java code)

| Component | Why kept |
|---|---|
| `GoldDashboardBuilder.java` | Architectural role per task #24 — wraps Python `/api/smartbi/gold/finance-summary` HTTP via `GoldFinanceClient`. Java DTOs (KPICard / DashboardResponse) consumed downstream. NOT deprecated. |
| `GoldFinanceClient.java` (in `client/`) | HTTP client to Python Gold layer — needed by GoldDashboardBuilder. |
| `SmartBIConfigController.java` (41 endpoints `/api/mobile/smartbi-config/*`) | Config / settings endpoints, NOT analysis. Phase 2B+ may port; T6.5 does not touch. |
| `SmartBIDashboardController.java` (11 endpoints) | Dashboard layout / saved-config endpoints — UI state persistence. Different from analysis path. |
| `SmartBIUploadController.java` (13 endpoints) | Excel upload pipeline (`/datasource/upload` overlap with Analysis controller — verify which controller actually routes; if duplicated may consolidate, but not deprecated). |
| `SmartBIPublicDemoController.java` (10 endpoints `/api/public/smart-bi/*`) | Public demo path, different route prefix, not in T6.4 nginx regex scope. |
| Java DTOs in `dto/smartbi/` (ChartConfig / DashboardResponse / KPICard / etc.) | Consumed by GoldDashboardBuilder for response shape; cross-language contract with Python. Keep. |
| Java entities in `entity/smartbi/postgres/` | Read by Java for legacy compat or by other Java services. Audit per Phase D. |
| Java repositories in `repository/smartbi/postgres/` | Same — Phase D audit. |

**Key architectural invariant**: Python `/api/smartbi/gold/*` is the **upstream** writer. Java GoldDashboardBuilder is **downstream consumer** via HTTP. Per memory `reference_smartbi_gold_layer_architecture.md` (task #24 finding).

---

## 2. T6.5 phases

### 2.1 Phase A — Dead-time verification (14 days post T6.4 GO)

**Goal**: Confirm zero direct Java SmartBI analysis traffic before stub-out.

#### A.1 Java prod log monitoring

Daily check (auto-cron or manual):

```bash
ssh root@47.100.235.168 "
  tail -1000000 /www/wwwroot/cretas/cretas-prod.log | \
    grep -E '/api/mobile/[^/]+/smart-bi/(analysis|alerts|recommendations|datasource|query|drill-down|query-templates)' | \
    grep -v 'GoldFinanceClient' | \
    head -20
"
```

**Expected**: 0 matches over 14 days (nginx routes 100% to Python). Any hit → investigate (nginx miss-route, direct IP-bypass, internal Java→Java call).

#### A.2 Operator query (manual)

Identify any internal tooling / automation hitting Java 10010 SmartBI directly:
- Confluence / wiki search for "10010 smart-bi" OR "47.100.235.168:10010"
- Slack / 内部群 search same
- Other Java services in cretas-api: `grep -r "smart-bi" backend/java/cretas-api/src/main/java/ | grep -v "smartbi/" | grep -v "test/"`
- Frontend (web-admin / RN): `grep -rn "smart-bi/analysis\|smart-bi/alerts" frontend/ web-admin/`

#### A.3 GoldDashboardBuilder dependency check

Verify Java GoldDashboardBuilder still receives requests from Python via `/api/smartbi/gold/finance-summary`:

```bash
ssh root@47.100.235.168 "
  tail -100000 /www/wwwroot/cretas/cretas-prod.log | \
    grep '\\[gold-builder\\]' | \
    head -20
"
```

**Expected**: continued activity (Python's analysis endpoints internally call Java GoldDashboardBuilder for some formatting? OR did Python-side replicate this? Verify per Phase A design check).

⚠️ **Open question for Phase A reviewer**: Does Python `analysis_finance.py` / `analysis_sales.py` post-T6.4 still call Java `/api/smartbi/gold/finance-summary` (which Java internally answers via `GoldFinanceClient` → Python)? If yes, the Gold path is Python→Java→Python (round-trip). If no (Python directly reads `agg_*`), Java GoldDashboardBuilder becomes orphaned and should join T6.5 scope.

→ Phase A audit task: trace Python finance/sales overview gold path, confirm GoldDashboardBuilder still has live downstream caller.

#### A.4 GO → Phase B criteria

- [ ] 14 days continuous: 0 direct Java SmartBI analysis traffic in prod log
- [ ] Operator query results: no tooling/automation hits Java 10010 analysis paths
- [ ] GoldDashboardBuilder traffic confirmed (or scoped into deprecation if orphaned)
- [ ] Frontend code reviewed: 0 calls to deprecated paths from web-admin / RN
- [ ] Phase 2A retrospective doc complete

If any criterion fails → extend Phase A by 7 days, re-verify. Don't proceed to Phase B with active Java traffic.

### 2.2 Phase B — Stub-out Java analysis endpoints (14 days)

**Goal**: Java analysis endpoints return 410 Gone — operationally dead but Spring Bean structure intact for safe rollback.

#### B.1 Implementation

Add a `@RestControllerAdvice` or refactor `SmartBIAnalysisController` to short-circuit:

```java
// Option A: per-method 410 stub (preserves controller structure)
@GetMapping("/analysis/sales")
public ResponseEntity<Map<String, Object>> getSalesAnalysis(...) {
    return ResponseEntity.status(HttpStatus.GONE).body(Map.of(
        "success", false,
        "code", "SMARTBI_MIGRATED",
        "message", "SmartBI analysis endpoints moved to Python /api/smartbi/analysis/*",
        "since", "2026-05-XX",  // Phase B start date
        "newPath", "/api/smartbi/analysis/sales"
    ));
}

// Option B: class-level @Deprecated + log filter + 410 in service layer
// (less invasive, keeps full controller method list for grep audit)
```

Recommended: **Option A** per-method stub — explicit, easier to verify dead, easy to remove in Phase C.

#### B.2 Spring Bean preservation

- Keep `SmartBIAnalysisController` class declaration + Spring `@RestController` annotation
- Keep `@Autowired` service references in controller (don't remove constructor injection)
- Keep service Bean classes (`SalesAnalysisServiceImpl` etc.) as `@Service` — other services may inject them
- Service method bodies can be simplified (return null / empty) but signatures stay
- Goal: `mvn clean package` still succeeds without compile errors

#### B.3 Rollback procedure (if Python widespread fail)

If Python fails widely during Phase B:

1. Nginx vhost regex flip back to 10010: `cp api.cretaceousfuture.com.conf.bak.t6_4_s5_pre.<ts> api.cretaceousfuture.com.conf && nginx -s reload`
2. Customer comms: PR #141 §3.6 rollback notice
3. Java controller stub returns 410 → Python returns content via `cretas_python` upstream → ⚠️ Phase B stub means even if nginx flips, Java now returns 410 = customer-visible failure
4. **Therefore**: Phase B requires nginx still routing to Python. Java rollback target = pre-Phase-B Java JAR (not 410-stubbed)

⚠️ **Phase B rollback constraint**: Phase B and nginx routing are coupled. Rolling back Phase B requires either:
- Re-deploying pre-Phase-B Java JAR (full controller bodies restored), OR
- Keeping Phase B forward (don't roll back), and rolling back Python only if Python issue

Document in Phase B rollback runbook: prefer Python forward-fix > Java rollback for Phase B period.

#### B.4 GO → Phase C criteria

- [ ] 30 days continuous: 0 410 Gone hits in Java prod log (i.e. nobody calls deprecated paths)
- [ ] Phase B 14 days complete + 16 days additional dead-time monitoring
- [ ] No customer reports of "missing endpoint" or "service moved" errors
- [ ] Operator confirmation: no scheduled jobs / CI / automation hits 410 paths
- [ ] Test environment Phase C dry-run successful (rip out files in test JAR, smoke test 75 factories)

### 2.3 Phase C — Java code removal (irreversible)

**Goal**: Remove all dead Java analysis controller / service code. Free up codebase, eliminate dead-code maintenance burden.

#### C.1 Files to remove

```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├── controller/
│   └── SmartBIAnalysisController.java                      # REMOVE
├── service/smartbi/
│   ├── DepartmentAnalysisService.java                      # REMOVE if no other caller
│   ├── DynamicAnalysisService.java                         # REMOVE if no other caller
│   ├── FinanceAnalysisService.java                         # REMOVE if no other caller
│   └── (other service interface .java for analysis)        # REMOVE per audit
└── service/smartbi/impl/
    ├── SalesAnalysisServiceImpl.java                       # REMOVE
    ├── DepartmentAnalysisServiceImpl.java                  # REMOVE
    ├── FinanceAnalysisServiceImpl.java                     # REMOVE (preserve Java line numbers as memory of port source)
    ├── ProductionAnalysisServiceImpl.java                  # REMOVE
    ├── QualityAnalysisServiceImpl.java                     # REMOVE
    ├── InventoryAnalysisServiceImpl.java                   # REMOVE
    ├── ProcurementAnalysisServiceImpl.java                 # REMOVE
    ├── DynamicAnalysisServiceImpl.java                     # REMOVE
    ├── IncentivePlanServiceImpl.java                       # REMOVE
    └── (others identified per Phase A audit)               # REMOVE
```

**KEEP** (verified per §1.2 OUT-OF-SCOPE):
- `GoldDashboardBuilder.java`
- `client/GoldFinanceClient.java`
- `SmartBIConfigController.java`, `SmartBIDashboardController.java`, `SmartBIUploadController.java`, `SmartBIPublicDemoController.java`
- All DTOs in `dto/smartbi/`
- Entities in `entity/smartbi/`
- Repositories in `repository/smartbi/`
- Tests for KEEP'd files

#### C.2 Test removal

```
backend/java/cretas-api/src/test/java/com/cretas/aims/
├── controller/SmartBIAnalysisControllerTest.java           # REMOVE
└── service/smartbi/impl/
    ├── SalesAnalysisServiceImplTest.java                   # REMOVE
    └── (other analysis service tests)                      # REMOVE
```

#### C.3 Verification before Phase C ship

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests              # MUST pass
mvn clean test -DskipTests=false           # MUST pass (remaining tests green)
mvn clean package -DskipTests              # MUST produce aims-0.0.1-SNAPSHOT.jar

# Inbound dependency check — no other Java code references removed classes
grep -rE "(import.*SmartBIAnalysisController|import.*SalesAnalysisService|import.*FinanceAnalysisService|import.*DynamicAnalysisService)" backend/java/cretas-api/src/main/java/ | grep -v "/test/"
# Expected: 0 matches (else dependency cleanup needed before Phase C)
```

#### C.4 Phase C deployment

- Test env first: `./scripts/deploy/deploy-backend.sh --env test`
- Smoke test 75 factories via test env nginx (cretas-backend-test 10011)
- 7-day test env soak before prod
- Prod: `./scripts/deploy/deploy-backend.sh --env prod` (Blue-Green per memory `reference_blue_green_java_deploy.md`)

#### C.5 GO → Phase D criteria

- [ ] Phase C deploy stable for 7 days prod
- [ ] All 75 factories `/smart-bi/analysis/*` Python responses still healthy
- [ ] No Java compile errors / no Spring context startup errors
- [ ] Journalctl `cretas-backend.service` startup log clean
- [ ] CLAUDE.md updated to reflect new Java SmartBI surface area

### 2.4 Phase D — Database verification (ongoing)

**Goal**: Confirm Python is canonical SmartBI data writer; Java does NOT write to smartbi schema tables post-T6.5.

#### D.1 Schema audit

```bash
# On server 47, check for any Java JPA/JDBC writes to smartbi tables
# (post-Phase C, all writes should originate from Python only)

ssh root@47.100.235.168 "
  sudo -u postgres psql -d smartbi_prod_db -P pager=off <<'SQL'
  -- Identify recent writers via pg_stat_user_tables
  SELECT schemaname, relname, n_tup_ins + n_tup_upd + n_tup_del AS recent_writes,
         last_autoanalyze, last_autovacuum
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
    AND (relname LIKE 'smart_bi%' OR relname LIKE 'agg_%' OR relname LIKE 'fact_pos%')
  ORDER BY recent_writes DESC
  LIMIT 20;
SQL
"
```

#### D.2 Java JPA repository audit

```bash
# Confirm Java JPA repositories under smartbi don't have @Modifying queries that hit
# tables Python is canonical for
grep -rnE "@Modifying|@Query.*INSERT|@Query.*UPDATE|@Query.*DELETE" backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/
# Audit each result — should be 0 if Python is canonical writer
```

#### D.3 Cross-DB connection audit

Confirm no Java service in main Java post-Phase-C still has direct JDBC connection to `smartbi_prod_db`:

```bash
grep -rE "smartbi_prod_db|smartbi.postgres" backend/java/cretas-api/src/main/java/ | grep -v "/test/" | grep -v "GoldFinanceClient"
# GoldFinanceClient connects to Python HTTP, not direct DB — that's OK
```

#### D.4 GO criteria — Phase D ongoing

Phase D is ongoing monitoring (no terminal "done" state):

- Quarterly schema-write audit (per §D.1)
- New Java services adding smartbi DB queries → flagged as scope creep, requires architecture review
- Phase 2B+ ports may add new Phase D items if more services migrate

---

## 3. Rollback contingency

### 3.1 Phase-level rollback summary

| Phase | Rollback target | Rollback procedure | Constraints |
|---|---|---|---|
| **Phase A** | None (verification only) | N/A | Read-only monitoring; no state to roll back |
| **Phase B** | Pre-Phase-B Java JAR | `./scripts/deploy/deploy-backend.sh --env prod` with prior JAR | Coupled with nginx — see §B.3 |
| **Phase C** | Pre-Phase-C Java JAR (irreversible after 30 days) | Same as Phase B initially; after 30 days, reverting requires git restore + redeploy | Code archived in git history `before <phase-c-commit-sha>` |
| **Phase D** | Schema state | N/A — Phase D is read-only audit | Schema mutations gated by smartbi_migrations runner per `.claude/rules/server-operations.md` |

### 3.2 Test environment validation per phase

Before each phase deploy to prod:

- [ ] Phase change deployed to test env (`--env test`)
- [ ] 7-day test env soak period (catch issues unique to data state)
- [ ] Test env smoke: 75 representative factories × 19 analysis endpoints
- [ ] Cretas-backend-test systemd `NRestarts` unchanged in 7 days

### 3.3 Communication channels per phase

| Phase | Audience | Channel | When |
|---|---|---|---|
| A | Internal ops (organizer + chat 4) | 内部群 | Daily monitoring summary |
| B start | Sales team + chat 1/2/3/4 | 内部群 + email | T-72h: "Java SmartBI analysis endpoints will return 410 Gone starting <date>; ensure no internal tooling hits 10010 paths" |
| B during | Sales team | 内部群 | If 410 hits detected + analysis blocked → escalate |
| C start | Engineering team | Internal email | "Phase C code removal — review checklist before merge" |
| C deploy | Sales team | Internal 内部群 | T-24h: "Java JAR rebuild + redeploy — typical Blue-Green window" |
| D | Engineering | Quarterly retrospective | Schema audit results |

### 3.4 No customer-facing comms

T6.5 is internal cleanup. Customer-facing endpoints (`/api/smartbi/analysis/*` via 139 nginx → Python) **stay routed to Python throughout T6.5**. Customers should observe zero behavior change — same endpoints, same shapes (per Phase 2A dict-eq parity).

If anything is customer-visible during T6.5, it's a regression and rollback should trigger. PR #141 customer comms templates not used unless rollback fires.

---

## 4. Timeline (post-T6.4)

Assuming T6.4 Stage 5 GO declared 2026-05-15 (best case):

| Phase | Start | End | Duration | Activity |
|---|---|---|---|---|
| **Phase A** | 2026-05-15 | 2026-05-29 | 14 days | Dead-time verification, log monitoring, audit |
| **Phase B** | 2026-05-29 | 2026-06-12 | 14 days stub period | 410 Gone responses, monitor for hits |
| **Phase B + 16d soak** | 2026-06-12 | 2026-06-28 | 16 days additional | Extended dead-time before Phase C |
| **Phase C** (test deploy) | 2026-06-28 | 2026-07-05 | 7 days | Test env deploy + soak |
| **Phase C** (prod deploy) | 2026-07-05 | 2026-07-12 | 7 days | Prod Blue-Green deploy + soak |
| **Phase D** | 2026-07-12+ | ongoing | quarterly cadence | DB-level audit |

**Total time T6.4 GO → Phase C done: ~58 days** (~2 months for irreversible step). This is intentional — irreversible code removal warrants extended dead-time validation.

If T6.4 slipped (e.g. stage rollback adds 7+ days), all subsequent phases shift accordingly.

---

## 5. Out-of-scope (NOT T6.5)

| Item | Why not |
|---|---|
| Pattern B Gold-primary flag flip on prod | Separate Phase B work for Python's `_get_finance_overview` 3-state branching. Pattern B is Python-side decision; T6.5 is Java-side cleanup. |
| Strict-byte gate adoption | Phase 3+ decision (currently dict-eq per `python-java-port.md` Rule 4). Independent of Java deprecation. |
| Frontend code refactor | Frontend already endpoint-agnostic — calls 139 nginx, doesn't care which upstream answers. No refactor needed. |
| Java GoldDashboardBuilder deprecation | Architecture role per task #24. Stays as Python downstream HTTP consumer. |
| SmartBI Config / Dashboard / Upload / PublicDemo controllers | Phase 2B+ scope (separate ports if pursued). T6.5 narrow to analysis endpoints only. |
| Java DTOs in `dto/smartbi/` | Cross-language contract via GoldDashboardBuilder. Keep. |
| Java entities `entity/smartbi/postgres/` | Phase D audit may flag, but not auto-removed. |
| `analysis_finance.py` / `analysis_sales.py` Python code | Python is the new canonical, not deprecated. |

---

## 6. GO criteria summary (per phase)

### 6.1 T6.4 → Phase A

- T6.4 Stage 5 24h soak GO + 0 P1 customer reports + Phase 2A retrospective started

### 6.2 Phase A → Phase B

- 14 days continuous: 0 direct Java SmartBI analysis traffic in prod log
- Operator query: no tooling hits Java 10010 analysis
- GoldDashboardBuilder traffic confirmed (or scoped in if orphaned)
- Frontend code reviewed: 0 deprecated path calls

### 6.3 Phase B → Phase C

- 30 days continuous: 0 410 Gone hits in Java prod log
- Test env Phase C dry-run successful (test JAR with files removed, 75-factory smoke clean)
- No customer-reported "missing endpoint" errors
- Operator confirmation: no scheduled jobs / CI / automation hits 410 paths

### 6.4 Phase C complete

- `mvn clean package -DskipTests` succeeds without removed files
- All tests green
- Inbound dependency grep: 0 references to removed classes
- Prod 7-day soak post-deploy stable (NRestarts unchanged, no 5xx spike)

### 6.5 Phase D ongoing

- Quarterly schema-write audit clean (Python = canonical writer for smartbi tables)
- No new Java services adding direct smartbi DB connections without architecture review

---

## 7. Rules / patterns to follow

### 7.1 Per-phase pause-before-deploy (memory `feedback_pause_before_deploy_or_push`)

Each phase's deploy step **must** stop and ping organizer before executing:
- Phase B deploy (Java stub-out)
- Phase C test env deploy
- Phase C prod deploy

Allows organizer to coordinate worktree merges + sister chat work-in-flight.

### 7.2 Concurrent-edit safety (memory `feedback_concurrent_edit_safety` Rule 5b)

Phase C is large code removal touching 30+ files. **MUST use** `git commit -- F1 F2 ...` paths-only mode or `safe-commit.sh` to avoid scope creep from parallel sessions.

Recommended: split Phase C into per-domain commits:
- C.1: Sales analysis (controller method + service impl + tests)
- C.2: Department analysis
- C.3: Region analysis
- C.4: Finance analysis
- C.5: Production / Quality / Inventory / Procurement
- C.6: Drill-down / dynamic analysis
- C.7: Incentive plan + alerts + recommendations
- C.8: Datasource + query-templates

Each commit narrow scope, easier to review and rollback.

### 7.3 Pattern B 3-state stays Python-primary

Per memory `project_2026_05_07_t6_1_dryrun_in_flight.md`: Pattern B `_get_finance_overview` 3-state branching (HOT/COLD/empty) lives in Python `analysis_finance.py`. T6.5 does NOT remove Pattern B — it only removes the Java analysis endpoints that Pattern B made irrelevant.

### 7.4 Smartbi DB schema migration policy

Per `.claude/rules/server-operations.md` HARD RULE: any smartbi schema change goes through `apply-smartbi-migrations.sh` runner. Phase D audits respect this — if Phase D finds smartbi schema drift between Java and Python expectations, fix via migration file, not direct SQL.

### 7.5 Cross-reference T6.4 retrospective

T6.5 spec assumes Phase 2A retrospective doc captures:
- Final endpoint port count + dict-eq match rate
- Per-customer T6.4 stage outcomes
- Java surface area before/after (`find` counts of removed files)
- Lessons learned re: Pattern A/A2 byte deltas, Rule 1-12 graduation history

T6.5 Phase A reviews this retrospective to identify any caveats affecting deprecation timing.

---

## 8. Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Internal tooling hits Java 10010 analysis directly during Phase A | LOW (after 30+ days dead) | MED (false positive on 410) | Phase A operator audit catches; if found, schedule tooling migration before Phase B |
| GoldDashboardBuilder orphaned (Python doesn't call it post-T6.4) | MED (architectural ambiguity per task #24) | HIGH (keep dead Java code) | Phase A audit task §A.3 explicitly verifies; if orphaned, expand Phase B/C scope |
| Phase B 410 Gone breaks unknown legacy client | LOW | MED (customer-visible if any) | Stub response includes `newPath` field for migration; rollback to pre-Phase-B JAR if hit count > 0 |
| Phase C removes file with hidden inbound dependency | MED | HIGH (compile fail) | Pre-Phase-C `grep -r imports` check; test env 7-day soak |
| Pattern B Gold dependency on Java GoldDashboardBuilder broken | LOW | HIGH | Verify `GoldDashboardBuilder` stays — explicitly OUT OF SCOPE per §1.2 |
| Test env Phase C dry-run passes but prod fails | LOW | HIGH | Test data may not exercise all paths; per-customer monitoring during prod 7-day soak |
| Phase 2B port adds new Java analysis controller during T6.5 window | LOW | LOW | Phase 2B coord — separate from T6.5; if happens, rebase scope |
| Phase 2A dict-eq divergence emerges post-T6.5 | MED | HIGH (Java code already removed, no rollback) | T6.5 timing intentional 60+ day buffer; Phase 2A 99.945% baseline gives confidence |

---

## 9. ⛔ HOLD blocks

- ⛔ This is a **spec / planning doc only**. No code changes, no deploys, no nginx mutations.
- ⛔ Phase A kickoff requires T6.4 Stage 5 24h soak GO. Cannot start sooner.
- ⛔ Phase A→B advance requires explicit organizer GO (per §6.2 criteria all PASS).
- ⛔ Phase B→C advance requires 30-day dead-time + test env dry-run + organizer GO.
- ⛔ Phase C is **irreversible** after 30 days post-deploy (git history reverts get harder, downstream branches may rebase). Treat with care.
- ⛔ GoldDashboardBuilder explicitly KEPT — do NOT remove during Phase C without re-audit per §A.3.
- ⛔ Customer-facing comms templates NOT used in T6.5 unless rollback fires (per §3.4).

---

## 10. Coordination

### 10.1 Predecessors

- T6.4 Stage 5 (`docs/superpowers/dispatch/2026-05-14-t6-4-stage-5-marching-order.md`)
- Phase 2A retrospective (`docs/superpowers/retrospectives/2026-05-15-phase2a-complete.md` — to be created post-T6.4)
- T6.4 readiness runbook (`docs/superpowers/runbooks/2026-05-08-t6-4-real-customers-cutover-runbook.md`)
- Customer comms plan (`docs/superpowers/runbooks/2026-05-08-t6-4-customer-comms-plan.md`)

### 10.2 Successors / parallel work

- T6.6+ (hypothetical): Java SmartBI Config / Dashboard / Upload / PublicDemo deprecation — Phase 2B+ port-then-deprecate cycles
- Pattern B Gold-primary flag flip — Phase B follow-up, separate scope
- Python observability hardening — independent Phase 3 work

### 10.3 chat assignments (per phase)

| Phase | Recommended owner | Rationale |
|---|---|---|
| A | organizer + chat 4 | Daily log monitoring + Pattern B/Gold path expert |
| B (impl) | chat 4 (or new chat) | Java code surgical change, Pattern B familiarity |
| B (deploy) | chat 4 | Owns Java prod deploys per `feedback_deploy_pipeline.md` |
| C (impl) | new chat (~5 sub-domain commits) | Large scope, fresh context helpful |
| C (test deploy) | chat 4 | Test env smoke expertise |
| C (prod deploy) | chat 4 | Blue-Green prod deploy |
| D | organizer | Quarterly cadence, low ongoing |

---

## 11. Discovery findings baked into this spec

| Finding | Source | Implication |
|---|---|---|
| 26 endpoints in `SmartBIAnalysisController` (controller-level count) | `grep -cE "@(Get\|Post\|Put\|Delete\|Patch)Mapping"` | Phase 2A 50-endpoint scope counts service-level methods (e.g. drill-down expansion) — actual controller line count = 26 |
| 4 other SmartBI controllers exist (Config / Dashboard / Upload / PublicDemo) | `find` | OUT-OF-SCOPE for T6.5; Phase 2B+ separate decisions |
| `GoldDashboardBuilder` is Python downstream consumer | Java line 22-46 javadoc + memory `reference_smartbi_gold_layer_architecture.md` | KEEP through T6.5 |
| `service/smartbi/impl/` has 30 .java files | `find` | Phase C removes ~10 analysis-only impls; ~20 remain (Excel parsers / chart builders / etc.) |
| Phase 2A dict-eq parity 99.945% | T6.1 dryrun match rate | Provides confidence for irreversible Phase C |
| Pattern B PR #135 already shipped, prod-deploy prereq for T6.4 | `project_2026_05_07_t6_1_dryrun_in_flight.md` | Pattern B stays Python-side; Java side never had Pattern B |
| smartbi_migrations runner ships in PR #98/#100/#102/#104 | `reference_smartbi_migration_runner.md` | Phase D schema audit relies on tracker |
| Blue-Green Java deploy pattern | `reference_blue_green_java_deploy.md` | Phase B/C deploys use 10010 ↔ 10020 nginx upstream switch |

---

## 12. Open questions for Phase A reviewer

1. **GoldDashboardBuilder caller verification**: Does Python's analysis layer post-T6.4 still hit `/api/smartbi/gold/finance-summary` (Java)? Or did Phase 2A inline the equivalent into Python's own `_build_from_gold_finance_summary`? Trace and answer before Phase B.

2. **Service interface vs impl removal**: Some service interfaces (e.g. `FinanceAnalysisService.java`) may have other implementers besides `*Impl`. Audit per file; remove interfaces only if 0 other impls.

3. **Datasource upload duplication**: `SmartBIAnalysisController.@PostMapping("/datasource/upload")` may duplicate `SmartBIUploadController.@PostMapping(...)`. Verify exact route + dispatch — one may be deprecated, the other kept.

4. **Test factory behavior post-Phase C**: TEST_0000_001 + 60 test factories on Python — will Phase C test deploy still smoke-test cleanly? Verify test env data state mirrors prod.

5. **Compatibility window with mobile app**: Are any older mobile app versions hitting Java directly (bypassing 139 nginx)? Should be 0 (mobile points to api.cretaceousfuture.com), but verify per ops.

6. **Phase 2B port pipeline timing**: If Phase 2B (port other SmartBI controllers) starts during T6.5 window, scope conflict — coordinate via separate ticket.

---

## 13. Sign-off

Before Phase A kickoff this spec reviewed by:

- [ ] Engineering organizer (timing + scope acceptable)
- [ ] chat 4 (Pattern B owner — Phase A audit task §A.3 acceptable)
- [ ] chat 1 (Python prod deploy owner — coordination acceptable)
- [ ] On-call rotation lead (60+ day timeline staffing acceptable)

Sign-off recorded in PR description when this spec merges main.

---

**End of T6.5 Java SmartBI Deprecation Trigger Spec**
