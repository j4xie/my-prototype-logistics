# T6.6 — F999 + 4 NOT_SAFE_FALLTHROUGH Endpoint Python Migration Spec

**Phase**: T6.6 (post-T6.5 cleanup of last Java SmartBI Analysis surface)
**Status**: Spec / planning doc only — execution blocked until T6.5 Phase B + C complete
**Author**: T6.6 spec writer (Decision 3A follow-up to PR #178 §6.4)
**Date**: 2026-05-09
**Predecessor**: T6.5 Phase A audit (PR #178), T6.5 deprecation spec (PR #150)
**Successor**: Phase 2C SmartBI Config / Dashboard / Upload / PublicDemo port (PR #152), hypothetical T7 strict-byte gate

---

## 0. TL;DR

Phase 2A 100% close (2026-05-09 06:34 CST) routed 75/75 customer factories to Python, but PR #178 Phase A audit identified **4 endpoint methods that still serve Java for ALL 75 factories** (not in nginx regex) plus **F999 internal test factory** that stays on Java for everything. T6.5 Phase B/C tackle the 22 SAFE_NGINX_ROUTED stub + delete; T6.6 closes the **last 4 NOT_SAFE_FALLTHROUGH paths + F999 nginx coverage** so the Java SmartBI Analysis surface can truly be retired.

**4 endpoints in scope**:
- `GET /analysis/production` (Java `ProductionAnalysisServiceImpl`)
- `GET /analysis/quality` (Java `QualityAnalysisServiceImpl`)
- `POST /query` (Java NL query — `SmartBIIntentService` + 5 `EntityRecognizer` + `SmartBIIntentMapper` + `SmartBIPromptService`)
- `POST /drill-down` (Python `analysis_drilldown.py` already exists; nginx routing missing only)

**F999 nginx coverage**: add `F999` literal to existing factory regex in `api.cretaceousfuture.com.conf` so internal team stops needing Java fallback.

**Effort**: ~10-15 person-days end-to-end (Phases A–D). Two of the four ports are mechanical mirrors (production / quality); `/query` is genuinely new Python work because Python lacks an equivalent of the 6-class entity recognition cluster; `/drill-down` is config-only (Python file exists).

**Outcome**: Java SmartBI Analysis Controller fully retirable. Combined with T6.5 Phase C, the only Java SmartBI surface remaining is Config / Dashboard / Upload / PublicDemo (Phase 2C scope) + Gold infrastructure (KEEP indefinitely per task #24).

---

## 1. Pre-T6.6 trigger conditions

T6.6 cannot kickoff until **all** of:

- [ ] T6.5 Phase A audit reviewed + organizer-acknowledged (PR #178)
- [ ] T6.5 Phase B 410-stub of 23 SAFE_NGINX_ROUTED endpoints deployed prod stable ≥30 days
- [ ] T6.5 Phase C method-level service audit + controller body removal complete (~mid-July 2026)
- [ ] 0 customer P1 reports in 30-day post-Phase-C soak window
- [ ] F999 internal test team acknowledges brief outage during cutover (T-72h notice)
- [ ] Phase 2C scoping decisions known (so T6.6 doesn't conflict with parallel ports)

---

## 2. Scope

### 2.1 `/analysis/production` port

| Aspect | Detail |
|---|---|
| Java source | `controller/SmartBIAnalysisController.java::getProductionAnalysis` → `service/smartbi/impl/ProductionAnalysisServiceImpl.java` |
| Python target | `backend/python/smartbi_compat/api/analysis_production.py` (new file) |
| Pattern | Mirror `analysis_finance.py` / `analysis_sales.py` — module-level helpers, `_decimal_to_number`, golden-driven dict literals |
| Byte-shape gate | dict-eq (per `python-java-port.md` Rule 4 Phase 2A standard) |
| Goldens | Record `analysis-production-F999-default.json` + `analysis-production-F001-default.json` via `scripts/record-java-golden.sh` |
| Effort | ~2-3 person-days (impl + 1 golden + reviewer audit per Rules 1-12) |

### 2.2 `/analysis/quality` port

Same pattern as §2.1.

| Aspect | Detail |
|---|---|
| Java source | `service/smartbi/impl/QualityAnalysisServiceImpl.java` |
| Python target | `backend/python/smartbi_compat/api/analysis_quality.py` (new file) |
| Effort | ~2-3 person-days |

### 2.3 `/query` (NL query) port — most complex

| Aspect | Detail |
|---|---|
| Java source | `controller/SmartBIAnalysisController.java::nlQuery` (line 491) → `SmartBIIntentService` (impl `SmartBIIntentServiceImpl`) → 5 `EntityRecognizer` (Region / Department / Metric / Time / Dimension) + `BaseEntityRecognizer` + `SmartBIIntentMapper` + `SmartBIPromptService` → dispatches to existing analysis services |
| Python target | `backend/python/smartbi_compat/api/analysis_query.py` (new) + new package `backend/python/smartbi_compat/intent/` for entity recognizers |
| Existing Python pieces to leverage | `backend/python/classifier/` (ONNX BERT classifier service); `backend/python/smartbi/services/intent/query_intent_extractor.py` (partial intent extraction). **Both are partial — neither covers the 5-EntityRecognizer + IntentMapper cluster.** |
| Major blocker | Python has **no equivalent** of `SmartBIIntentServiceImpl` rule-engine (keyword matching + regex patterns + confidence scoring + parameter extraction loaded from `config/smartbi/intent_patterns.json`). Phase A must scope the recognizer port before Phase B impl can start. |
| Byte-shape gate | dict-eq |
| Goldens | Record ≥10 representative NL queries spanning all 5 entity types on F999 + F001 |
| Effort | ~5-7 person-days (Phase A design 1-2d + Phase B impl 4-5d + reviewer cycles) |

### 2.4 `/drill-down` port — config-only

| Aspect | Detail |
|---|---|
| Java source | `controller/SmartBIAnalysisController.java::drillDown` → `DynamicAnalysisServiceImpl` |
| Python target | **Already exists**: `backend/python/smartbi_compat/api/analysis_drilldown.py` (per PR #178 §3.1.a footnote — "Python has but nginx doesn't route") |
| Action | **Verify** byte-shape parity vs Java (record fresh F999/F001 goldens, run dict-eq diff); add nginx regex route |
| Effort | ~1-2 person-days |

### 2.5 Nginx regex update

Current regex (PR #178 §2.2, server 139 `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`):

```
location ~ ^/api/mobile/(F00[1-46]|...)/smart-bi/(alerts|recommendations|...|analysis/(sales|department|region|finance|inventory|procurement)) {
    proxy_pass http://cretas_python;
}
```

T6.6 amendment:

1. Add `production|quality|drill-down` to analysis path alternation.
2. Add `query` to top-level alternation (separate from analysis path because `POST /query` not `POST /analysis/query`).
3. Add `F999` to the factory ID alternation: `(F00[1-46]|...|F999)`.
4. Remove F999 carve-outs from any T6.5 Phase B 410 stubs (so F999 hits Python uniformly).

| Aspect | Detail |
|---|---|
| Action | Single nginx config edit + `nginx -t` + `nginx -s reload` |
| Backup | `cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_6_pre.<ts>` per memory `reference_smartbi_prod_db_migration_gap` |
| Rollback | `cp <backup> <conf> && nginx -s reload` (~1 min) |
| Effort | ~0.5 person-day (excluding pre-cutover smoke and post-cutover active E2E per HARD rule `feedback_active_e2e_replaces_passive_soak`) |

### 2.6 Out-of-scope

| Item | Why not |
|---|---|
| `GoldDashboardBuilder.java` + `GoldFinanceClient.java` | KEEP per PR #178 §4.3 (active Java→Python round-trip, dashboard composite still served by Java). Same reasoning as T6.5 Phase D. |
| `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` Java file deletion | KEEP — `SmartBIDashboardController` injects them for `/dashboard/executive*` (PR #178 §3.2.a). T6.6 only nullifies `/analysis/production` + `/analysis/quality` Java traffic; the service impls remain alive for Dashboard composite. |
| 5 `EntityRecognizer` + `SmartBIIntentService` Java file deletion | KEEP through T6.6 — they are still callers for any non-cutover scenarios. Phase D cleanup considers only after stable Python `/query` ≥30 days. |
| Phase 2C SmartBI Config / Dashboard / Upload / PublicDemo ports | Separate decisions per PR #152 (~6-9mo). T6.6 narrow to Analysis Controller only. |
| Strict-byte gate adoption | Phase 3+ decision (PR #153). T6.6 stays dict-eq per Phase 2A standard. |
| Pattern B Gold-primary flag flip prod runtime change | Independent of T6.6 (PR #135 already shipped). |

---

## 3. Phases

### 3.1 Phase A — Design + intent service equivalent (~3-5 person-days)

**Goal**: Resolve the `/query` port blocker before Phase B implementation chats can parallelize the 4 endpoints.

**Activities**:

1. Trace `SmartBIIntentServiceImpl` rule-engine: enumerate keyword maps, regex patterns, confidence scoring, parameter extraction from `config/smartbi/intent_patterns.json`.
2. Trace each of the 5 `EntityRecognizer` (Region / Department / Metric / Time / Dimension) + `BaseEntityRecognizer` shared logic.
3. Trace `SmartBIIntentMapper` + `SmartBIPromptService` (LLM fallback path).
4. Decide between **A) port-rule-engine** (translate Java pattern config + regex literally) vs **B) leverage-existing-classifier** (extend `backend/python/classifier/` ONNX BERT) vs **C) hybrid** (rule-engine for fast paths, classifier for fallback).
5. Validate via prototype on F999 + F001 (~10 representative queries spanning all 5 entity types) before Phase B kickoff.
6. Audit `query_intent_extractor.py` for reusable pieces — likely partial coverage of Time + Metric entities, but not Region / Department / Dimension.

**Deliverable**: design doc (~200-300 LOC) added to `docs/superpowers/specs/` with class breakdown, file-tree, recognized scope gaps, and Phase B PR plan.

**GO criteria → Phase B**: design doc reviewed by organizer + Phase 2A intent classifier owner (likely chat 3 per PR #150 §10.3); Python `/query` prototype answers ≥80% of the F999 golden queries.

### 3.2 Phase B — Port impl (~5-7 person-days, 4 endpoints in parallel)

Each endpoint can dispatch as a separate sister chat per memory `feedback_main_worktree_branch_isolation` (parallel work, isolated worktrees):

| Endpoint | Effort | Sister chat assignment |
|---|---|---|
| `/analysis/production` | 2-3d | chat A |
| `/analysis/quality` | 2-3d | chat B |
| `/query` | 4-5d | chat C (Phase A owner) |
| `/drill-down` parity verify | 1-2d | chat D (smallest, can absorb organizer side work) |

Per port checklist (mirrors Phase 2A pattern):

1. Record Java goldens (F999 + F001) via `scripts/record-java-golden.sh`.
2. Implement Python module under `smartbi_compat/api/`.
3. Reviewer audit per `python-java-port.md` Rules 1–12 (especially Rules 4 / 8 / 9 / 10 / 11 / 12 — Decimal serialization, Map.of order, Lombok null emit, BigDecimal arithmetic, microsecond, HALF_UP).
4. Pytest with synthetic mocks per Rule reference test pattern.
5. Test env deploy via `./scripts/deploy/deploy-smartbi-python.sh --env test`.
6. dict-eq parity verification ≥99% match against Java prod 10010.

**GO criteria → Phase C**: 4 endpoints impl complete + dict-eq parity rate ≥99% against Java baseline + reviewer audits ✅ + test env smoke clean.

### 3.3 Phase C — Cutover (~1 person-day)

Single coordinated cutover (not staged like T6.4 — T6.6 affects 4 endpoints + 1 internal factory, much smaller blast radius):

1. Record pre-cutover nginx config backup `bak.t6_6_pre.<ts>`.
2. T-72h notify F999 internal test team.
3. Edit nginx regex per §2.5; `nginx -t`; `nginx -s reload`.
4. Smoke 4 endpoints × 76 factories (75 customer + F999) within 5–10 min.
5. **Active E2E** per HARD rule `feedback_active_e2e_replaces_passive_soak`: Playwright / curl / `agent-browser` exercises NL query + drill-down + production + quality scenarios for ≥15 min. **No 24h passive soak.**
6. Update `feedback_pause_before_deploy_or_push` — STOP and ping organizer before nginx reload.

**Rollback**: `cp <backup> <conf> && nginx -s reload` if any 5xx spike or customer report (~1 min).

**GO criteria → Phase D**: 76 factories smoke clean (0 errors) + 7-day prod stability post-cutover + 0 P1 reports.

### 3.4 Phase D — Java deletion (~2-3 person-days)

After 7-day Phase C stability, the 4 NOT_SAFE_FALLTHROUGH endpoints' Java method bodies become deletable (mirroring T6.5 Phase C method-level audit pattern):

| Java surface | Action |
|---|---|
| `SmartBIAnalysisController::getProductionAnalysis` body | Remove method (controller method removed entirely, not just stubbed — T6.5 already proved Phase C path works) |
| `SmartBIAnalysisController::getQualityAnalysis` body | Same |
| `SmartBIAnalysisController::nlQuery` body | Same |
| `SmartBIAnalysisController::drillDown` body | Same |
| `ProductionAnalysisServiceImpl` Java file | **KEEP** — `SmartBIDashboardController` still injects (PR #178 §3.2.a) |
| `QualityAnalysisServiceImpl` Java file | **KEEP** — same |
| `DynamicAnalysisServiceImpl` Java file | **KEEP** — Dashboard composite caller |
| `SmartBIIntentService` + 5 `EntityRecognizer` + `SmartBIIntentMapper` + `SmartBIPromptService` Java files | **KEEP through Phase D**; re-evaluate ≥30 days post-cutover. Removable only if zero non-`/query` callers found via repo-wide grep. |

**GO criteria — Phase D complete**: `mvn clean compile -DskipTests` passes; `grep` for removed method names returns 0 matches in non-test sources; `SmartBIAnalysisController.java` is now a 22-stub-removed + 4-method-deleted controller (or fully deletable if all 26 methods now empty).

---

## 4. Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `/query` Python intent service complexity exceeds 5-7 person-day estimate | MED | HIGH (delays whole T6.6) | Phase A produces design doc + prototype before Phase B; if prototype reveals deeper issues, escalate scope re-estimate to organizer |
| 4 endpoint port byte-shape diverges (Pattern A/A2 / Map.of / Decimal) | MED | LOW (dict-eq tolerates per Rule 4 Phase 2A standard) | Reviewer audits per Rules 1-12; record goldens early in Phase B |
| F999 internal team blocked during cutover window | HIGH | LOW | T-72h notice; cutover scheduled outside internal team's active hours |
| `ProductionAnalysisServiceImpl` / `QualityAnalysisServiceImpl` permanently retained because Dashboard still uses | MED | MED (incomplete cleanup, dead-code feel) | Explicitly accepted — KEEP per Phase 2C handles those eventually. T6.6 scope narrowed to controller surface only. |
| Phase 2C work in parallel creates merge conflicts | LOW | LOW | Coordinate sister chat dispatch via organizer; Phase 2C tier scoping (PR #152) defers config/dashboard work to ≥July 2026, post-T6.5 |
| `SmartBIIntentService` Java code never removable (some non-`/query` caller persists) | MED | LOW (Phase D acceptable to keep Intent service forever) | Phase D method-level audit decides; if persists, accept and close T6.6 |
| Phase 2A dict-eq divergence emerges post-T6.6 nginx flip | LOW | HIGH (Java already retired for these 4 paths, no immediate fallback) | Phase B reviewer audit + Phase C 7-day soak provide buffer; rollback restores Java path in <1 min via nginx backup |
| Nginx regex edit introduces typo blocking 75 factories | LOW | HIGH (mass outage) | `nginx -t` validates syntax; smoke test 4 endpoints × 76 factories within 10 min of reload |

---

## 5. Out-of-scope (NOT T6.6)

| Item | Why not |
|---|---|
| T6.5 Phase B/C 23-endpoint stub + delete | T6.5 scope; T6.6 starts AFTER T6.5 Phase C stable |
| Phase 2C SmartBI Config / Dashboard / Upload / PublicDemo (PR #152) | Separate ~6-9mo project; different controllers, different prefixes |
| Strict-byte gate adoption | Phase 3+ decision (PR #153) |
| Pattern B Gold-primary flag flip on test/staging | Independent (PR #135 already shipped prod) |
| 10 analysis service class file deletion (`*ServiceImpl.java`) | KEEP forever — Dashboard composite caller. T6.6 + T6.5 only remove controller method bodies, not service impls. |
| F999 dataset migration | F999 stays as test factory with same data; T6.6 just changes routing layer. F999 data lifecycle is separate decision. |
| Java GoldDashboardBuilder + GoldFinanceClient deletion | KEEP forever per task #24 / PR #178 §4.3 (active downstream consumer). |

---

## 6. GO criteria summary

### 6.1 T6.5 Phase C → T6.6 Phase A

- T6.5 Phase B + C complete ≥30 days
- 0 P1 customer reports in T6.5 post-Phase-C soak
- Steve / organizer explicit approval to proceed

### 6.2 Phase A → Phase B

- Design doc reviewed (organizer + Phase 2A intent classifier owner)
- Python `/query` prototype answers ≥80% of F999 golden queries
- 4 sister chats dispatched (or sequential plan agreed if no parallel capacity)

### 6.3 Phase B → Phase C

- 4 endpoint Python impl complete (PR-merged)
- Reviewer audits per Rules 1-12 ✅
- Test env smoke clean (76 factories × 4 endpoints)
- dict-eq parity ≥99% match vs Java prod 10010

### 6.4 Phase C → Phase D

- 76 factories smoke clean post-cutover (0 errors within 5-10 min)
- Active E2E ≥15 min on customer-facing scenarios (per HARD rule)
- 7-day prod stability post-cutover, NRestarts unchanged
- 0 P1 customer reports

### 6.5 Phase D complete

- `mvn clean compile -DskipTests` passes after method body removal
- `grep` for removed method names returns 0 non-test matches
- Spring context startup clean (no missing controller beans)
- CLAUDE.md updated to reflect SmartBIAnalysisController surface

---

## 7. Coordination

### 7.1 Predecessors

- T6.5 Phase A audit (PR #178)
- T6.5 Phase B 410-stub + 30-day soak
- T6.5 Phase C method-level service audit + controller body removal
- Phase 2A dict-eq gate + Rules 1-12 governance (`python-java-port.md`)

### 7.2 Successors / parallel work

- Phase 2C SmartBI Config / Dashboard / Upload / PublicDemo ports (PR #152) — likely parallel kickoff post-T6.6
- Hypothetical T7 strict-byte gate (PR #153) — independent decision per tier
- F999 dataset retention or migration decision (independent)

### 7.3 Recommended chat assignments

| Phase | Recommended owner | Rationale |
|---|---|---|
| A (design) | chat 3 (Phase 2A intent classifier owner) or new chat with Java intent service trace expertise | `/query` design dominates Phase A scope |
| B `/analysis/production` | new chat A | Mechanical mirror of Phase 2A patterns |
| B `/analysis/quality` | new chat B | Same |
| B `/query` | chat 3 / Phase A owner | Continuity from design |
| B `/drill-down` parity verify | chat D | Smallest scope; can also handle nginx config preparation |
| C (cutover) | chat 4 (or whichever owns prod nginx) | Single-shot operational task per PR #141 / #144 cutover patterns |
| D (Java deletion) | new chat | Method-level removal mirrors T6.5 Phase C |

---

## 8. Discovery findings baked into this spec

| Finding | Source | Implication |
|---|---|---|
| 4 NOT_SAFE_FALLTHROUGH endpoints classified | PR #178 §3.1.a | T6.6 scope = exactly these 4 + F999 nginx coverage |
| F999 excluded from current nginx regex | PR #178 §4.1 | T6.6 must add F999 to factory ID alternation |
| Python `analysis_drilldown.py` exists but nginx doesn't route | PR #178 §3.1.a (NOT_SAFE row) | `/drill-down` is config-only effort, smallest of 4 |
| Java `SmartBIIntentServiceImpl` rule-engine + 5 `EntityRecognizer` + `SmartBIIntentMapper` + `SmartBIPromptService` | `service/smartbi/SmartBIIntentService.java` + `service/smartbi/*EntityRecognizer.java` (verified by `Glob`) | `/query` Python port requires Phase A design doc; cannot start Phase B blindly |
| Python `backend/python/classifier/` (ONNX BERT) + `backend/python/smartbi/services/intent/query_intent_extractor.py` | `Bash ls` verification | Partial coverage — Phase A design must scope what's reusable vs what's new |
| Python `intent_classifier/` path **does not exist** | `Bash ls` verification | Marching order's `backend/python/intent_classifier/` reference corrected to `backend/python/classifier/` in this spec |
| `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` shared with Dashboard composite | PR #178 §3.2.a | Service impls KEEP forever (already accepted under T6.5); only controller method bodies removable |
| Phase 2A dict-eq 99.945% match standard | T6.1 dryrun + PR #178 §1.1 | T6.6 inherits dict-eq gate, no strict-byte upgrade |
| Active-E2E HARD rule replaces passive 24h soak | memory `feedback_active_e2e_replaces_passive_soak.md` | Phase C cutover smoke = active probing, not 24h soak |
| Pause-before-push HARD rule | memory `feedback_pause_before_deploy_or_push.md` | Nginx reload + each Python deploy step must STOP and ping organizer |

---

## 9. ⛔ HOLD blocks

- ⛔ This is a **spec / planning doc only** — no code changes, no deploys, no nginx mutations.
- ⛔ T6.6 Phase A kickoff requires T6.5 Phase B + C complete ≥30 days. Cannot start sooner.
- ⛔ `/query` port: do **NOT** begin Phase B impl before Phase A design + prototype validates intent service approach. Risk of dead-end refactor too high.
- ⛔ Phase D Java method body removal is **irreversible after 30 days post-deploy** (downstream branches rebase, git history reverts get harder). Treat with care; mirror T6.5 Phase C discipline.
- ⛔ `ProductionAnalysisServiceImpl` / `QualityAnalysisServiceImpl` Java files **stay** — never auto-removed in T6.6. Dashboard composite still binds them.
- ⛔ Customer-facing comms templates **NOT used** in T6.6 normal path (only F999 internal team T-72h notice). If rollback fires, escalate per PR #141 customer comms framework.
- ⛔ Nginx regex change must include `bak.t6_6_pre.<ts>` backup before reload, per memory `reference_smartbi_prod_db_migration_gap` Strategy B precedent.
- ⛔ This spec is **not** a marching order. Phase A kickoff requires fresh marching order from organizer with chat assignment + concrete artifact paths.

---

## 10. Sign-off

Before Phase A kickoff this spec reviewed by:

- [ ] Engineering organizer (timing + scope acceptable; T6.5 Phase B/C dependency lock)
- [ ] T6.5 Phase B/C lead (handoff handoff acknowledgement, no scope-creep into T6.5)
- [ ] `/query` Python intent service design reviewer (Phase 2A intent classifier expertise — likely chat 3 or designate)
- [ ] On-call rotation lead (cutover time-window staffing acceptable)

Sign-off recorded in PR description when this spec merges main.

---

**End of T6.6 F999 + 4 NOT_SAFE_FALLTHROUGH Endpoint Python Migration Spec**
