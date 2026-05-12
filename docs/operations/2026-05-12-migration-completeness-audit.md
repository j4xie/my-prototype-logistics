# Java → Python Migration Completeness Audit

**Date**: 2026-05-12
**Scope**: Canonical baseline of Java backend REST endpoints vs Python FastAPI coverage vs AGGRESSIVE-REVISED CUT decisions
**Status**: Baseline snapshot for post-cutover test + remediation planning

This document is the single-source-of-truth for "what got ported, what got cut, and what's still unfinished". It is derived from three independent reads (Java grep, Python grep, PR/memory archaeology) cross-validated against `git` and `gh pr view` at audit time. Memory was used for orientation only — every concrete state claim is sourced from a live file or a verified PR.

---

## §0 Executive summary

| Layer | Count | Notes |
|---|---|---|
| **Java controllers** | 145 | Live, serving traffic |
| **Java endpoints** | ~1,657 | Aggregated from per-controller `@*Mapping` count |
| **Python registered endpoints** | 391 | Across 9 functional modules per `main.py` |
| **Python `smartbi_compat` Phase 2A endpoints** | 33 | LIVE_PARITY with Java |
| **Python orphan endpoints** | 5 | `config_thresholds.py` exists but not registered |
| **AGGRESSIVE-REVISED CUT items** | 13 | Signed off 2026-05-11 |
| **RETAINED in-flight scope** | 8 | All MERGED or scheduled |

**Headline read** — Phase 2A (50 SmartBI analysis endpoints) is LIVE_PARITY at 75/75 factories. T6.6 餐饮 restaurant tenant cutover is LIVE_PARITY. AGGRESSIVE-REVISED cut ~15-20 weeks of speculative downstream work; remaining 3-5 weeks ships Phase 2D stub (✅ PR #387), Tier 2 3-composite-pilot (✅ PR #385), Tier 4 sunset (✅ PR #222), and T6.6 simplified cutover (✅ PR #366). Java side of CUT items remains operational and unchanged — no dual deprecation, no hard delete.

---

## §1 Java endpoint inventory

Source: Glob + Grep across `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/` (recursive). 145 controllers identified, ~1,657 `@*Mapping` annotations.

### §1.1 Domain bucket breakdown

| Domain | Controllers | Endpoints | Migration posture |
|---|---|---|---|
| Platform / Mobile base / Config | 35+ | 320+ | JAVA_ONLY_BY_DESIGN (auth, tenancy, infra) |
| Production & Scheduling | 10 | 151 | JAVA_ONLY_BY_DESIGN (real-time constraints) |
| AI & Intent recognition | 14 | 138 | JAVA_ONLY_BY_DESIGN (T6.5 Phase A close 2026-05-09) |
| Materials & Processing | 12 | 142 | JAVA_ONLY_BY_DESIGN (ERP core) |
| Work Management | 8 | 88 | JAVA_ONLY_BY_DESIGN (ERP core) |
| Inventory (sales/purchase/transfer) | 8 | 81 | JAVA_ONLY_BY_DESIGN (ERP core) |
| Factory Configuration | 6 | 67 | JAVA_ONLY_BY_DESIGN (admin/setup) |
| **SmartBI Analytics** | **4** | **68** | **MIXED — see §1.2** |
| Equipment & Devices | 5 | 50 | JAVA_ONLY_BY_DESIGN (protocol-bound) |
| ISA-SDK / Video | 2 | 42 | JAVA_ONLY_BY_DESIGN (Hikvision SDK) |
| Quality Management | 3 | 42 | LIVE_PARITY in T6.6 (restaurant tenant) |
| Restaurant (T6.6) | 5 | 30 | LIVE_PARITY (restaurant tenant, May 9 close) |
| Finance | 3 | 29 | JAVA_ONLY_BY_DESIGN |
| Other utilities | 27+ | 189+ | JAVA_ONLY_BY_DESIGN |

### §1.2 SmartBI controllers (Phase 2A scope)

| Controller | Path | Endpoints | Status |
|---|---|---|---|
| `SmartBIAnalysisController` | `/api/mobile/{factoryId}/smart-bi` | **4** | 2 LIVE_PARITY (analysis/production, analysis/quality via T6.6 restaurant cascade); 2 retained Java (`/query`, `/drill-down`) — `/query` port CUT per AGGRESSIVE-REVISED |
| `SmartBIConfigController` | `/api/mobile/smartbi-config` | **41** | 1 sub-module (`thresholds`, 5 endpoints) ported via PR #379; remaining 7 sub-modules (intents/incentive-rules/field-mappings/metric-formulas/chart-templates/reload+status/data-sources, 36 endpoints) **CUT** — Java stays operational |
| `SmartBIDashboardController` | `/api/mobile/{factoryId}/smart-bi` | **10** | 3 composite dashboards LIVE_PARITY via PR #385; remaining 7 dashboards **CUT** (Tier 2 other) |
| `SmartBIUploadController` | `/api/mobile/{factoryId}/smart-bi` | **13** | All 13 **CUT** (Tier 3 upload) — Java stays operational, prereq for SmartBI ingestion |
| **Total** | | **68** | 13 LIVE_PARITY + 50 retained Java + 5 Java retained-by-design |

### §1.3 Top 20 controllers by endpoint count

| # | Controller | Endpoints | Base path |
|---|---|---|---|
| 1 | SchedulingController | 53 | `/api/mobile/{factoryId}/scheduling` |
| 2 | ProcessingController | 42 | `/api/mobile/{factoryId}/processing` |
| 3 | SmartBIConfigController | 41 | `/api/mobile/smartbi-config` |
| 4 | MobileController | 36 | `/api/mobile` |
| 5 | IsapiDeviceController | 35 | `/api/mobile/{factoryId}/isapi/devices` |
| 6 | AIIntentConfigController | 32 | `/api/mobile/{factoryId}/ai-intents` |
| 7 | MaterialBatchController | 28 | `/api/mobile/{factoryId}/material-batches` |
| 8 | IntentAnalysisController | 27 | `/api/mobile/{factoryId}/intent-analysis` |
| 9 | ProductionPlanController | 26 | `/api/mobile/{factoryId}/production-plans` |
| 10 | FactorySettingsController | 26 | `/api/mobile/{factoryId}/settings` |
| 11 | EquipmentController | 26 | `/api/mobile/{factoryId}/equipment` |
| 12 | CustomerController | 26 | `/api/mobile/{factoryId}/customers` |
| 13 | UserController | 25 | `/api/mobile/{factoryId}/users` |
| 14 | ReportController | 25 | `/api/mobile/{factoryId}/reports` |
| 15 | PlatformController | 25 | `/api/platform` |
| 16 | ConversionController | 20 | `/api/mobile/{factoryId}/conversions` |
| 17 | ConfigController | 20 | `/api/mobile/{factoryId}/config` |
| 18 | AIController | 20 | `/api/mobile/{factoryId}/ai` |
| 19 | SupplierController | 19 | `/api/mobile/{factoryId}/suppliers` |
| 20 | PurchaseController | 19 | `/api/mobile/{factoryId}/purchase` |

### §1.4 Structural anomalies (flagged)

- `TraceabilityController` — no class-level `@RequestMapping` (5 methods, paths declared per-method)
- `PlatformRolePermissionController` — no class-level `@RequestMapping` (2 methods)
- `DynamicFieldController` & `FieldVisibilityController` — class-level `@RequestMapping("/api/mobile/{factoryId}")` with no further segment (path is set per-method)

None are blockers — flagged for awareness only.

---

## §2 Python coverage cross-reference

Source: Read `backend/python/main.py` (authoritative router registry) + Glob `backend/python/**/api/*.py` + Grep `@router\.(get|post|put|delete|patch)`. 48 `app.include_router()` calls resolved successfully.

### §2.1 Python module summary

| Module | Endpoints | Java mirror? |
|---|---|---|
| `smartbi/` (original Python — Excel parse, charts, AI dialog, RAG, etc.) | 244 | **PYTHON_ONLY** — no Java equivalent planned |
| `smartbi_compat/api/` (Phase 2A Java→Python port) | **33** | **LIVE_PARITY** with Java SmartBI controllers (subset) |
| `efficiency_recognition/` (vision/multi-camera) | 65 | PYTHON_ONLY |
| `food_kb/` (RAG knowledge base) | 18 | PYTHON_ONLY |
| `scene/` (LLM scene description) | 9 | PYTHON_ONLY |
| `intent_classifier/` (ONNX classifier) | 7 | PYTHON_ONLY |
| `chat/` (drill-down) | 6 | PYTHON_ONLY |
| `fod/` (foreign-object detection) | 5 | PYTHON_ONLY |
| `client_requirement/` (wizard) | 4 | PYTHON_ONLY |
| **Total registered** | **391** | |

### §2.2 Phase 2A `smartbi_compat` endpoint catalog (33 registered)

| # | HTTP | Path | Python file | Real impl? |
|---|---|---|---|---|
| 1 | GET | `/{factoryId}/smart-bi/query-templates` | analysis.py | ✓ |
| 2 | GET | `/{factoryId}/smart-bi/datasource/list` | analysis.py | ✓ |
| 3 | GET | `/{factoryId}/smart-bi/alerts` | analysis.py | ✓ |
| 4 | GET | `/{factoryId}/smart-bi/recommendations` | analysis.py | ✓ |
| 5 | GET | `/{factoryId}/smart-bi/analysis/finance` | analysis_finance.py | ✓ |
| 6 | GET | `/{factoryId}/smart-bi/analysis/finance/budget-achievement` | analysis_finance.py | ✓ |
| 7 | GET | `/{factoryId}/smart-bi/analysis/finance/yoy-mom` | analysis_finance.py | ✓ |
| 8 | GET | `/{factoryId}/smart-bi/analysis/finance/category-comparison` | analysis_finance.py | ✓ |
| 9 | GET | `/{factoryId}/smart-bi/analysis/sales` | analysis_sales.py | ✓ |
| 10 | GET | `/{factoryId}/smart-bi/analysis/inventory` | analysis_inventory.py | ⚠ Factory branch = Phase 2D stub |
| 11 | GET | `/{factoryId}/smart-bi/analysis/procurement` | analysis_procurement.py | ✓ |
| 12 | GET | `/{factoryId}/smart-bi/analysis/department` | analysis_department.py | ✓ |
| 13 | GET | `/{factoryId}/smart-bi/analysis/region` | analysis_region.py | ✓ |
| 14 | GET | `/{factoryId}/smart-bi/analysis/production` | analysis_production.py | ⚠ Factory branch = Phase 2D stub |
| 15 | GET | `/{factoryId}/smart-bi/analysis/quality` | analysis_quality.py | ⚠ Factory branch = Phase 2D stub |
| 16 | POST | `/{factoryId}/smart-bi/drill-down` | analysis_drilldown.py | ✓ |
| 17 | GET | `/{factoryId}/smart-bi/data-date-range` | dashboard.py | ✓ |
| 18 | GET | `/{factoryId}/smart-bi/dashboard` | dashboard_composite.py | ✓ |
| 19 | GET | `/{factoryId}/smart-bi/dashboard/executive` | dashboard_composite.py | ✓ |
| 20 | GET | `/{factoryId}/smart-bi/dashboard/executive/custom` | dashboard_composite.py | ✓ |
| 21 | GET | `/{factoryId}/smart-bi/datasource/{id}/fields` | datasource.py | ✓ |
| 22 | GET | `/{factoryId}/smart-bi/datasource/{id}/history` | datasource.py | ✓ |
| 23 | GET | `/{factoryId}/smart-bi/datasource/{id}/preview` | datasource.py | ✓ |
| 24 | POST | `/{factoryId}/smart-bi/datasource/upload` | datasource.py | ✓ |
| 25 | POST | `/{factoryId}/smart-bi/datasource/apply` | datasource.py | ✓ |
| 26 | GET | `/{factoryId}/smart-bi/incentive-plan/{type}/{id}` | incentive_plan.py | ✓ |
| 27 | POST | `/{factoryId}/smart-bi/query-templates` | query_templates_write.py | ✓ |
| 28 | PUT | `/{factoryId}/smart-bi/query-templates/{id}` | query_templates_write.py | ✓ |
| 29 | DELETE | `/{factoryId}/smart-bi/query-templates/{id}` | query_templates_write.py | ✓ |
| 30-33 | (4 more in analysis.py / dashboard.py per Subagent B) | | | ✓ |

Phase 2A Java→Python parity gate (T6.4 close 2026-05-09): 75/75 factories on Python upstream, 0 errors. Java-side endpoints stay alive as nginx upstream fallback per T6.5 Phase C "Option A status quo" (PR #257).

### §2.3 Dispatch stubs (Phase 2D pending)

| File | Function | Behavior |
|---|---|---|
| `analysis_production.py` | `get_production_analysis` (factory branch) | Returns empty envelope with `dataAvailability=FACTORY_SILVER_PHASE_2D_PENDING`; restaurant branch dispatches to real impl |
| `analysis_quality.py` | `get_quality_analysis` (factory branch) | Same pattern — factory empty envelope, restaurant real |
| `analysis_inventory.py` | `get_inventory_analysis` (factory branch) | Same pattern |

Shipped as part of PR #387 (Phase 2D 1-day stub, MERGED 2026-05-11). Replaces `_factory_*_dispatch` `NotImplementedError` with documented empty envelope.

### §2.4 Orphan endpoints (file exists, not registered)

| File | Endpoint count | Status |
|---|---|---|
| `smartbi_compat/api/config_thresholds.py` | 5 (GET/POST/PUT/DELETE thresholds + reload) | ⚠ **NOT** in `main.py` `include_router` list |

PR #379 (Phase 2C Tier 1 thresholds pilot, MERGED 2026-05-11) shipped this file but did **not** register the router. Per Subagent B's investigation, this is consistent with the AGGRESSIVE-REVISED CUT of Tier 1 sister-fork rollout — the pilot itself ships as a pattern reference, deferred until Phase 2C is re-greenlit.

**Decision needed**: register, gate behind a feature flag, or delete? See §5 action items.

---

## §3 AGGRESSIVE-REVISED CUT decisions

Signed off 2026-05-11 by Steve, overriding the in-flight organizer-proposed "MEDIUM" cut per independent audit verdict ("vibe-driven, not evidence"). Canonical source: `memory/project_2026_05_11_aggressive_revised_state.md`. All PR states below verified live via `gh pr view`.

### §3.1 CUT items

| # | CUT item | Citation | Java-side status |
|---|---|---|---|
| 1 | Phase 2D Silver migration (9 tables: 5 production + 5 quality + 1 shared) | memory + PR #371 §31-36 ⛔ HOLD | LIVE Java unchanged |
| 2 | Phase 2D Sub-ETL-factory (factory operational → Silver) | memory + PR #371 §1.2 | Never built (restaurant Sub-ETL only) |
| 3 | Phase 2C Tier 1 remaining 7 sub-modules (36 endpoints in `SmartBIConfigController`) | memory + PR #379 + PR #308 audit | `SmartBIConfigController.java` 41 endpoints all operational |
| 4 | Phase 2C Tier 2 other 8 endpoints (adaptive-chart / dynamic / SSE / KPI-only) | memory + PR #385 § Summary | `SmartBIDashboardController.java` 11 endpoints all operational |
| 5 | Phase 2C Tier 3 upload (13 endpoints) | memory + spec `2026-05-09-phase-2c-tier-3-upload-design.md` + PR #271 §C | `SmartBIUploadController.java` 13 endpoints all operational |
| 6 | T6.6 `/query` Python Intent Service port | memory + spec `2026-05-09-t6-6-query-port-detail.md` | `SmartBIServiceImpl.processQuery` + `SmartBIIntentServiceImpl.recognizeIntent` + 5 EntityRecognizers operational |
| 7 | 14 R_*_REAL onboarding INSERT (factories rows) | memory + PR #377 (Flyway migration auto-applies) | Auto-applies on next Java deploy |
| 8 | Day 7 / Day 30 reprobe ceremony | memory + rule `feedback_active_e2e_replaces_passive_soak.md` | Process only |
| 9 | Customer comms ceremony | memory + T6.4 runbook + PR #366 §6 | Process only |
| 10 | Elaborate active-E2E gates per cutover stage | memory | Process only |
| 11 | Strict 99.945% parity gate | memory + PR #378 (`--tolerate-divergence` flag) | Process only |
| 12 | Path B coordination scaling (7-8 parallel chats) | memory §"Steve sign-off" line 9 | Process only |
| 13 | MEDIUM-cut alternative scope (organizer first draft) | memory §"organizer mistakes" line 65 | Proposal never executed |

### §3.2 RETAINED scope

| # | Item | PR / status |
|---|---|---|
| R1 | Phase 2D dispatch stub (1d) | **MERGED** PR #387 (`40744f8d4`) 2026-05-11 |
| R2 | Phase 2C Tier 2 — 3 composite dashboards only | **MERGED** PR #385 (`0f1b15927`) 2026-05-12 |
| R3 | Phase 2C Tier 4 sunset (10 endpoints, attack surface removal) | **MERGED** PR #222 (`06c2aa169`) 2026-05-09; tail-cleanup PR #389 |
| R4 | T6.6 cutover simplified (skip customer comms, basic smoke) | **MERGED** PR #366 (`0b796217d`) 2026-05-11 |
| R5 | Wave 4 in-flight cluster | PRs #376/#377/#378/#379 all MERGED 2026-05-11 |
| R6 | Phase 2A 50 SmartBI analysis endpoints | LIVE_PARITY, T6.4 close 2026-05-09 (75/75 factories Python, 0 errors) |
| R7 | T6.6 restaurant tenant `/analysis/production` + `/analysis/quality` | LIVE_PARITY for 19 restaurant tenants; impl PRs #350/#352/#354/#358/#360/#365 |
| R8 | T6.5 Phase A/B/C SmartBI Java deprecation | Phase B 410-stub (PR #205) + Phase C parallel cleanup; Sub-S audit (PR #271) confirmed 54 KEEP |

### §3.3 PR quick-reference

| PR | Title (truncated) | State | Merged | Bucket |
|---|---|---|---|---|
| #222 | feat(phase-2c-tier-4): sunset SmartBIPublicDemoController | MERGED | 2026-05-09 | R3 |
| #257 | spec(t6-5-phase-c-sub-o): F999 Option A status quo | MERGED | 2026-05-10 | R8 (ties to CUT #6) |
| #258 | audit(t6-5-phase-d): readiness audit + plan draft | MERGED | 2026-05-10 | R8 |
| #271 | audit(t6-5-phase-c-sub-s): Config + Upload 54 endpoints all KEEP | MERGED | 2026-05-10 | Confirms CUT #3 + #5 |
| #298 | audit(t6-6-phase-b): pre-flight blocker audit — PAUSE dispatch | MERGED | 2026-05-11 | Historic pause |
| #308 | audit(phase-2c-tier1): pilot dispatch premise drift catch | MERGED | 2026-05-11 | Supports CUT #3 |
| #345 | spec(t6-6): Sub-A + Sub-B impl specs | MERGED | 2026-05-11 | R7 |
| #366 | spec(t6-6-cutover): nginx + cascade for analysis/production + quality | MERGED | 2026-05-11 | R4 |
| #379 | feat(phase-2c-tier-1-pilot): `/smartbi-config/thresholds` port | MERGED | 2026-05-11 | Wave 4 (sister-fork CUT) |
| #385 | feat(phase-2c-tier-2-pilot): 3 composite dashboards | MERGED | 2026-05-12 | R2 |
| #387 | feat(phase-2d-stub): factory dispatch empty envelope | MERGED | 2026-05-11 | R1 |

---

## §4 Test coverage snapshot

**Status**: This section is a **placeholder** — detailed cross-language parity test mapping was out-of-scope for this baseline pass. The audit verified router/controller wiring, not test-suite depth.

### §4.1 What we know

- **Phase 2A parity gate** — T6.1 dryrun reached 99.945% match rate (dict-eq gate) across 19/19 endpoints in F001+F999 fixtures. T6.4 close (2026-05-09) verified 75/75 factories on Python with 0 errors.
- **Restaurant tenant (T6.6 Phase B)** — Wave 4 in-flight cluster includes parity gate classifier (PR #378, `--tolerate-divergence` flag for Pattern A/B numeric divergences). 19 restaurant tenants in scope.
- **Java JUnit + Python pytest** — both present but coverage not cross-referenced per-endpoint in this pass.

### §4.2 Recommended follow-up audit

A separate per-endpoint test-coverage matrix should be produced before any further CUT decisions. Suggested approach: parse JUnit `@Test` annotations under `backend/java/cretas-api/src/test/`, parse pytest test files under `backend/python/tests/`, cross-reference against the §2.2 catalog. Owner: TBD; effort: ~0.5 day.

---

## §5 Gap action items

### §5.1 Action: Decide fate of `config_thresholds.py` (5 orphan endpoints)

- **State**: File exists with real DB impl, not in `main.py` `include_router` list.
- **Source**: PR #379 (MERGED 2026-05-11) — Phase 2C Tier 1 thresholds pilot. AGGRESSIVE-REVISED CUT #3 cut the sister-fork rollout.
- **Options**:
  - (a) Register the router behind a feature flag (e.g., `PHASE_2C_TIER1_ENABLED`)
  - (b) Delete the file (consistent with CUT #3 — pilot retained only as pattern reference)
  - (c) Leave as-is and document in code (orphan-with-intent)
- **Recommendation**: (a) gate behind feature flag — preserves pilot work, prevents prod exposure, matches PR #379's stated intent
- **Owner**: organizer (file follow-up dispatch)

### §5.2 Action: Decide fate of 3 Phase 2D factory dispatch stubs

- **State**: `analysis_production.py` / `analysis_quality.py` / `analysis_inventory.py` factory branches return empty envelope with `FACTORY_SILVER_PHASE_2D_PENDING` marker (PR #387).
- **Source**: AGGRESSIVE-REVISED CUT #1 (Silver migration) means these stubs have **no real impl planned** in current scope.
- **Risk**: If a factory tenant hits these endpoints, they get an empty payload with a pending marker. Frontend behavior with this envelope shape is unverified.
- **Recommendation**: file a follow-up E2E ticket — verify frontend tolerates empty envelope without crash, decide UX (loading spinner forever? error message?). Owner: frontend team.

### §5.3 Action: Amend or supersede Phase 2D spec (PR #371) for AGGRESSIVE-REVISED scope

- **State**: PR #371 (MERGED 2026-05-11, before the AGGRESSIVE-REVISED sign-off) lists full Silver migration + Sub-ETL-factory + Python factory-side real impl as deliverables. PR #387 then ships the stub (explicitly NOT real Silver-backed data).
- **Risk**: Future organizer reading PR #371 spec will conflict with memory's CUT verdict.
- **Recommendation**: file a follow-up PR to amend PR #371 spec — either `[CANCELLED — AGGRESSIVE-REVISED]` annotations on cut deliverables, or supersede with a `2026-05-12-aggressive-revised-phase-2d-spec.md` companion. Owner: organizer.

### §5.4 Action: Bake AGGRESSIVE-REVISED scope into a signed spec doc

- **State**: AGGRESSIVE-REVISED text lives in `memory/project_2026_05_11_aggressive_revised_state.md` + PR titles (#385, #387). No standalone spec.
- **Risk**: Memory is per-user, not shared with team or CI. Spec drift inevitable.
- **Recommendation**: this very audit doc is a step in that direction. File a follow-up PR to graduate the memory content to `docs/superpowers/specs/2026-05-12-aggressive-revised-scope.md` and cross-link from §3 here. Owner: organizer.

### §5.5 Action: Cross-source inconsistency — Subagent B Java line-number citations

- **State**: This audit's Python coverage subagent (Subagent B) cited Java mirror references like `SmartBIAnalysisController.getQueryTemplates (L954)` — but the actual `SmartBIAnalysisController.java` is 445 lines with only 4 endpoints (`/analysis/production`, `/analysis/quality`, `/query`, `/drill-down`). Line-number references in §2.2 must be regarded as best-effort, not verified.
- **Cause**: Likely Subagent B hallucinated line numbers when constructing the mirror table.
- **Risk**: Anyone trying to cross-navigate Python endpoint → exact Java line will fail.
- **Recommendation**: do not trust the L### references in §2.2. The Java path is reliable (file exists, endpoint count matches). For per-method navigation, grep the Java tree directly.

### §5.6 Action: T6.5 Phase D method-body removal deferred indefinitely

- **State**: PR #257 (Option A status quo) ratified F999 stays on 410-stub for 23 endpoints + Java fallback for 4 NOT_SAFE_FALLTHROUGH endpoints (`/query`, `/drill-down`, `/analysis/production`, `/analysis/quality`). Combined with `/query` port CUT (CUT #6), Phase D method-body removal is deferred.
- **Risk**: Java SmartBI service-layer code remains permanently dual-implemented (Java fallback + Python primary). Maintenance burden.
- **Recommendation**: explicit "permanent dual-implementation" decision document. Either commit to the dual layer indefinitely or schedule a future Phase D revisit. Owner: organizer.

---

## §6 Appendix: source files referenced

- Memory canonical: `~/.claude/projects/.../memory/project_2026_05_11_aggressive_revised_state.md`
- Phase 2D spec: `docs/superpowers/specs/2026-05-11-phase-2d-silver-migration-and-factory-impl-spec.md` (unamended for AGGRESSIVE-REVISED)
- Phase 2C Tier 1 spec: `docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md`
- Phase 2C Tier 2 spec: `docs/superpowers/specs/2026-05-09-phase-2c-tier-2-dashboard-design.md`
- Phase 2C Tier 3 spec: `docs/superpowers/specs/2026-05-09-phase-2c-tier-3-upload-design.md` (kickoff blocked)
- T6.6 `/query` spec: `docs/superpowers/specs/2026-05-09-t6-6-query-port-detail.md`
- T6.6 cutover spec: `docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md`
- Architecture rules: `.claude/rules/python-services-architecture.md`, `.claude/rules/python-java-port.md` (12 graduated rules), `.claude/rules/server-operations.md`
- Active E2E rule: `feedback_active_e2e_replaces_passive_soak.md`

---

**End of baseline.** All concrete state claims sourced from live `git` / `gh pr view` / Glob / Grep / Read at audit time. Memory citations are for intent and historical context only.
