# Phase 2B Port Pipeline — Scoping Spec

**Phase**: 2B (post-T6.5 Java SmartBI deprecation cleanup → port remaining non-analysis SmartBI controllers to Python)
**Status**: Scoping / planning doc only — kickoff contingent on T6.5 Phase C complete
**Date**: 2026-05-15
**Predecessor**: T6.5 Java SmartBI deprecation spec (PR #150, `cf8cc48e8`)
**Sister docs**:
- `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (KEEP list source)
- `.claude/rules/python-java-port.md` (12 codified Phase 2A learnings)

---

## 0. TL;DR

After T6.5 Phase C finishes (estimated ~2026-07-15, ≥58 days post T6.4 GO), the
50 SmartBI **analysis** endpoints are off Java entirely. **75 non-analysis SmartBI
endpoints remain on Java** across 4 controllers:

| Controller | Endpoints | Route prefix | Tier |
|---|---:|---|:---:|
| `SmartBIConfigController` | **41** | `/api/mobile/smartbi-config/*` | **1** (port first) |
| `SmartBIDashboardController` | **11** | `/api/mobile/{factoryId}/smart-bi/*` | **2** (port second) |
| `SmartBIUploadController` | **13** | `/api/mobile/{factoryId}/smart-bi/*` | **3** (port third) |
| `SmartBIPublicDemoController` | **10** | `/api/public/smart-bi/*` | **4** (defer or sunset) |

This doc is **scoping only** — sequencing decisions, per-tier strategy, timeline
estimates, risk register, GO criteria. **No code changes here.** Each tier
will get its own design spec, plan doc, and execution PR chain at kickoff time.

**Estimated total Phase 2B duration: 6–9 months** (Tier 1 ~3 mo, Tier 2 ~2 mo,
Tier 3 ~2–4 mo, Tier 4 deferred). Per-tier T6.X-style cutover pattern reused.

---

## 1. Pre-Phase-2B state (trigger conditions)

### 1.1 Trigger gate

Phase 2B kickoff requires **all** of:

- [ ] T6.5 Phase C complete: Java analysis controller files removed (`SmartBIAnalysisController.java` deleted, ~30 service impls deleted, no compilation errors).
- [ ] T6.5 Phase D ongoing: zero direct Java analysis traffic confirmed by 30+ days of log monitoring.
- [ ] Phase 2A retrospective doc shipped (`docs/superpowers/retrospectives/2026-05-15-phase2a-complete.md`).
- [ ] Frontend code path map current (which UI pages hit which controllers — operator step).
- [ ] Operator + business stakeholder approval for Phase 2B kickoff.

### 1.2 What's already done (Phase 2A baseline)

- 50 analysis endpoints on Python `smartbi_compat/api/analysis_*.py` (T6.4 100% factories).
- T6.1 dryrun ≥99.945% match rate sustained.
- 12 codified rules in `.claude/rules/python-java-port.md` (Rule 1–12).
- Pattern B 3-state branching baked into `_get_finance_overview` + `_get_sales_overview` (PR #135 + #149).
- Dict-eq parity gate accepted as Phase 2A standard.
- Smartbi migration runner shipped (auto-apply on deploy).
- Blue-Green Java deploy pipeline + uvicorn N=2 multi-worker on Python.

### 1.3 What's NOT done (Phase 2B scope inherits)

- 4 non-analysis controllers (above) still served by Java 10010.
- Frontend Vue / React Native components currently call these Java endpoints.
- Java DTOs in `dto/smartbi/` consumed by both analysis (deprecated) and non-analysis (still active) paths — Phase 2A KEEP list per task #24.
- `GoldDashboardBuilder` + `GoldFinanceClient` permanent KEEP (architectural role: Java HTTP client to Python Gold producer).

---

## 2. Endpoint inventory + categorization

### 2.1 Tier 1 — `SmartBIConfigController` (41 endpoints, pure CRUD)

Route prefix: `/api/mobile/smartbi-config/*` (factory-scoped via JWT, NOT path).

7 sub-domains, each with 5–9 endpoints in standard CRUD + reload pattern:

| Sub-domain | Endpoints | Pattern |
|---|---:|---|
| `intents` | 5 | GET / POST / PUT / DELETE + reload |
| `thresholds` | 5 | GET / POST / PUT / DELETE + reload |
| `incentive-rules` | 5 | GET / POST / PUT / DELETE + reload |
| `field-mappings` | 5 | GET / POST / PUT / DELETE + reload |
| `metric-formulas` | 5 | GET / POST / PUT / DELETE + reload |
| `chart-templates` | 9 | CRUD + recommend + for-metric / {code} / build-with-analysis |
| `data-sources` | 5 | GET (list+single) / POST / PUT / DELETE |
| misc (`reload-all`, `status`) | 2 | admin operations |

**Complexity**: LOW. Standard Spring JPA repository CRUD + Spring cache invalidation
on reload endpoints. No async, no streams, no file uploads. Most endpoints touch
1–2 entity tables.

**Java LOC**: 834 (controller alone). Service layer estimated ~3,000 LOC across
7 service classes.

**Frontend touch points** (operator must verify at kickoff):
- Web-Admin: SmartBI 配置中心 / 阈值管理 / 激励规则 / 字段映射 / 指标公式 / 图表模板 / 数据源管理
- React Native: rare (likely 0 hits — config is admin-only)

**Risk**: LOW — Vue admin pages mostly hit these, customer-facing impact minimal.

### 2.2 Tier 2 — `SmartBIDashboardController` (11 endpoints, read-heavy + 1 stream)

Route prefix: `/api/mobile/{factoryId}/smart-bi/*` (factory-scoped path).

| Endpoint | Verb | Pattern |
|---|:---:|---|
| `/generate-adaptive-charts` | POST | LLM-composed chart generation |
| `/generate-chart` | POST | Single chart builder |
| `/dashboard/executive` | GET | Executive dashboard composite |
| `/dashboard/executive/insights` | GET | LLM insights (sync) |
| `/dashboard/executive/insights/custom` | GET | Custom insight query |
| `/dashboard/executive/insights/custom/stream` | GET | **SSE stream** ⚠️ |
| `/dashboard/executive/custom` | GET | Custom executive view |
| `/data-date-range` | GET | Available date range query |
| `/dashboard` | GET | Standard dashboard |
| `/analysis/dynamic/kpis` | GET | Dynamic KPI computation |
| `/analysis/dynamic` | GET | Dynamic dashboard composition |

**Complexity**: MEDIUM. Read-heavy + LLM streaming + composite endpoints
that orchestrate analysis (Phase 2A done) + chart-builder. The
`/insights/custom/stream` SSE endpoint requires Python `StreamingResponse`
+ careful chunk-byte parity (Pattern B-equivalent for streaming).

**Java LOC**: 615.

**Frontend touch points**:
- Web-Admin: 经营驾驶舱 (Dashboard.vue) / 自定义看板 / KPI overview screens
- React Native: factory user dashboard (high traffic)

**Risk**: MEDIUM-HIGH — these are the most-visited pages by customers. Streaming
endpoint is a novel byte-shape gate that Phase 2A didn't cover.

### 2.3 Tier 3 — `SmartBIUploadController` (13 endpoints, file upload + Excel parse)

Route prefix: `/api/mobile/{factoryId}/smart-bi/*`.

| Endpoint | Verb | Pattern |
|---|:---:|---|
| `/upload` | POST multipart | Excel upload |
| `/upload-and-analyze` | POST multipart | Upload + immediate analysis |
| `/upload/confirm` | POST | Two-phase upload confirm |
| `/sheets` | POST multipart | Multi-sheet Excel upload |
| `/upload-batch` | POST multipart | Batch upload |
| `/upload-batch-stream` | POST multipart **stream** | Streaming batch |
| `/retry-sheet/{uploadId}` | POST | Retry failed sheet |
| `/uploads` | GET | List uploads |
| `/uploads/{uploadId}/fields` | GET | Per-upload field metadata |
| `/uploads/{uploadId}/data` | GET | Per-upload data preview |
| `/uploads-missing-fields` | GET | Backfill candidate list |
| `/backfill/fields/{uploadId}` | POST | Backfill missing fields |
| `/backfill/batch` | POST | Bulk backfill |

**Complexity**: HIGH. 6 multipart POST + 1 streaming + Excel parse fidelity
(POI / Apache POI on Java side; openpyxl / pandas on Python side — different
parser rounding semantics, formula evaluation, cell-format handling). Large
file timeouts. JPA transaction boundaries for atomic upload.

**Java LOC**: 656.

**Frontend touch points**:
- Web-Admin: SmartBI 数据导入页 / Excel 上传向导
- React Native: factory user data submission

**Risk**: HIGH — file upload error semantics are notoriously path-dependent
(streaming buffer sizes, multipart boundary handling, MIME detection). Excel
parse parity is a brand-new gate type Phase 2A didn't address.

### 2.4 Tier 4 — `SmartBIPublicDemoController` (10 endpoints, public showcase)

Route prefix: `/api/public/smart-bi/*` (no JWT — public access for demo site).

| Endpoint | Verb | Pattern |
|---|:---:|---|
| `/query` | POST | Demo query interface |
| `/intent-test` | POST | Intent classifier demo |
| `/dashboard/executive` | GET | Public executive demo |
| `/dashboard` | GET | Public dashboard demo |
| `/analysis/sales` | GET | Public sales analysis demo |
| `/analysis/department` | GET | Public department demo |
| `/analysis/region` | GET | Public region demo |
| `/recommendations` | GET | Public recommendations demo |
| `/incentive-plan/{targetType}/{targetId}` | GET | Public incentive demo |
| `/drill-down` | POST | Public drill-down demo |

**Complexity**: LOW — mostly subset of Analysis (already on Python) + Dashboard
patterns, but with hardcoded demo factory ID + relaxed auth. Most endpoints are
near-duplicates of Phase 2A analysis paths.

**Java LOC**: 386.

**Frontend touch points**:
- `www.cretaceousfuture.com` showcase pages (`platform/factorybi-example/*` etc.)
- No customer-facing app traffic.

**Risk**: LOW — public demo, low traffic, no business-critical SLA. Strong
candidate for **sunset** (delete endpoints + redirect showcase to static
screenshots) rather than port.

---

## 3. Sequencing decisions

### 3.1 Why Config first (Tier 1)

- Lowest complexity (pure CRUD).
- Mostly admin-only frontend touchpoints (lower customer blast radius).
- Reuses standard SQLAlchemy / FastAPI CRUD patterns already proven in Python codebase.
- Builds Phase 2B team's confidence with a well-bounded port before tackling streams + uploads.
- Zero dependency on other tiers.

### 3.2 Why Dashboard second (Tier 2)

- Customer-visible but read-heavy (no upload mutation risk).
- Depends on **Phase 2A analysis already on Python** — composite endpoints already calling Python paths internally; porting Dashboard reduces Java↔Python HTTP roundtrips.
- Streaming SSE endpoint is the highest novelty here — invest in Python SSE
  byte-parity tooling that Tier 3 streaming uploads will reuse.
- LLM insight generation already lives in Python (`smartbi/services/insight_generator.py`); Dashboard port can call it directly instead of via Java HTTP.

### 3.3 Why Upload third (Tier 3)

- Highest complexity + highest data-integrity risk.
- Benefits from Tier 2 streaming infrastructure already proven.
- Excel parse fidelity needs dedicated investment (Apache POI ↔ openpyxl divergence audit, similar to Decimal / Map.of audits Phase 2A required).
- Customer-facing but time-bounded (most uploads happen in setup phase, not steady state).
- Two-phase upload (upload → confirm) gives natural rollback handle if Python parser produces different field detection vs Java.

### 3.4 Why PublicDemo defer-or-sunset (Tier 4)

- Public demo, no business SLA.
- Most endpoints are subset of Analysis (already ported) — porting just to keep
  Java parity gives no business value.
- **Recommendation**: sunset rather than port.
  - Replace dynamic public demo endpoints with static JSON snapshots served
    from `platform/` showcase static site (139 server).
  - Or: redirect public demo URLs to public Python endpoints with anonymous
    JWT (operator decision).
- If business decides to keep the demo dynamic, port AFTER Tier 1/2/3 complete
  and use it as a Phase 2B exit dryrun.

---

## 4. Phase 2A learnings to apply

Phase 2A produced 12 codified rules in `.claude/rules/python-java-port.md`. All
remain applicable to Phase 2B. The most relevant subset per tier:

| Rule | Tier 1 (Config) | Tier 2 (Dashboard) | Tier 3 (Upload) | Tier 4 (Demo) |
|---|:-:|:-:|:-:|:-:|
| Rule 1 — `is not None` not `or` | ✅ | ✅ | ✅ | ✅ |
| Rule 2 — calendar-year WEEK | — | ✅ | ✅ | — |
| Rule 3 — function signature mirror Java | ✅ | ✅ | ✅ | ✅ |
| Rule 4 — `_decimal_to_number` serialization | ✅ | ✅ | ✅ | ✅ |
| Rule 5 — `SELECT *` for shared SQL helpers | ✅ | ✅ | ✅ | — |
| Rule 6 — input boundary None-check | ✅ | ✅ | ✅ | ✅ |
| Rule 7 — Decimal threshold compare | — | ✅ | — | — |
| Rule 8 — `Map.of(N)` golden-recorded order | ✅ | ✅ | ✅ | ✅ |
| Rule 9 — Lombok + Jackson serialization quirks | ✅ | ✅ | ✅ | ✅ |
| Rule 10 — BigDecimal divide-then-multiply rounding | — | ✅ | — | — |
| Rule 11 — LocalDateTime trailing-zero microsecond | ✅ | ✅ | ✅ | ✅ |
| Rule 12 — String.format HALF_UP vs banker's | ✅ | ✅ | — | — |

### Process learnings (not yet codified as Rules but proven through Phase 2A)

- **Pattern B 3-state branching** for Gold-primary fallback paths (PR #135 / #149).
- **Narrow-scope sister-site sweep**: when fixing one Pattern site, grep for sister sites and fix together (memory `feedback_narrow_scope_fix_sister_site_sweep`).
- **Organizer projection bug**: verify PR existence with `gh pr view` before referencing in marching orders.
- **4-cycle audit pattern** before kickoff: self-review → spec reviewer → cross-spec audit → final impl reviewer (caught ~30 issues per spec in Phase 2A).
- **Worktree isolation** for parallel chats: `.worktrees/<task>` per chat, `git commit -- <paths>` for scope-locked commits per Rule 5b in `concurrent-edit-safety.md`.
- **Mock-driven test harness**: PR #135 / #149 model — 4-state mocks suffice for ship; full golden parity tests can be PR-C scope.
- **Smartbi migration runner**: schema changes go through `apply-smartbi-migrations.sh` runner; deploy aborts on migration failure (HARD RULE in `server-operations.md`).

---

## 5. Strict-byte gate decision

Phase 2A used **dict-eq** parity gate per `python-java-port.md` Rule 4 (numeric `0` ≡ `0.0` ≡ `0.00`, scale-4 trailing-zero collapse accepted). This was sufficient
because:
1. Frontend parses JSON to JS objects → dict equality, not byte equality.
2. No third-party integration contracts byte-compare Java/Python responses.
3. Decimal / Date / `Map.of` language idiom differences make strict-byte
   require non-trivial rework on either side.

**Phase 2B recommendation per tier**:

| Tier | Recommended gate | Rationale |
|---|---|---|
| 1 — Config | dict-eq | CRUD responses are simple objects; admin-only consumers; same as Phase 2A semantics. |
| 2 — Dashboard | dict-eq for JSON; **strict-byte for SSE chunks** | SSE chunk boundaries + flush timing matter for client UX. Stream framing must be character-identical. |
| 3 — Upload | **strict-byte for response envelope**; dict-eq for body | Two-phase upload depends on exact `uploadId` / `confirmToken` field shapes. Frontend may persist these and re-submit; shape drift breaks confirm step. |
| 4 — Demo | dict-eq if ported | If sunset, gate moot. |

If business decides Phase 3+ requires strict-byte universally:
- Phase 2B can't deliver it without significant rework on Java side too (Decimal scale preservation, Map.of canonical ordering, Lombok null emission control).
- Estimated +30–50% effort to upgrade.
- **Recommend: defer strict-byte universal upgrade to Phase 3+**, scope it as a separate cross-cutting initiative.

---

## 6. Per-tier port strategy

### 6.1 Tier 1 — Config (Tier 1)

**Approach**: Standard CRUD port. Per-sub-domain PR chain.
- 1 spec PR per sub-domain (~7 specs).
- 1 impl PR per sub-domain (~7 impls).
- Reuse SQLAlchemy ORM patterns from existing `smartbi_compat/`.
- Frontend keeps calling same path; nginx routes new `/api/mobile/smartbi-config/*` to Python after per-sub-domain dryrun.

**Estimated duration**: 3 months total (each sub-domain ~2 weeks design + 2 weeks impl + 1 week dryrun).

**Cutover model**: T6-style nginx regex per sub-domain. T6.1 dryrun → T6.2 canary (1 factory) → T6.3 expand → T6.4 full → T6.5 deprecate Java.

### 6.2 Tier 2 — Dashboard (Tier 2)

**Approach**: Composite-endpoint port with novel SSE framing audit.
- 1 spec covering all 11 endpoints + dedicated streaming spec.
- 2–3 impl PRs (read endpoints / chart generation / SSE stream).
- New tooling: Python SSE byte-shape recorder (mirror `record-java-golden.sh` for streams).
- Compose existing Phase 2A analysis endpoints (no Java HTTP roundtrip).

**Estimated duration**: 2 months. Streaming infrastructure is reusable for Tier 3.

**Cutover model**: T6-style. SSE stream cutover requires special care — verify chunk timing didn't regress (compare Java SSE prod traces with Python output).

### 6.3 Tier 3 — Upload (Tier 3)

**Approach**: Multi-phase port with Excel parser fidelity audit.
- 1 spec for upload pipeline architecture.
- 1 spec for Apache POI ↔ openpyxl parser parity (cell format / number scale / formula eval).
- 3–4 impl PRs (upload primitive / sheet parse / batch / backfill).
- Two-phase upload contract preserved exactly (uploadId / confirmToken field shapes byte-stable).
- New tooling: Excel-parse golden test suite (sample factory uploads, parse with both engines, dict-eq compare).

**Estimated duration**: 2–4 months depending on parser parity work.

**Cutover model**: T6-style with extra caution. Per-customer canary (1 customer, 1 week) before broader rollout. Rollback rehearsal (per T6.4 model) mandatory.

### 6.4 Tier 4 — PublicDemo (Tier 4 — defer or sunset)

**Approach**: Recommended sunset.
- Operator decision required.
- If sunset: replace dynamic endpoints with static JSON snapshots served from `platform/` (139 server) showcase site.
- If port: after Tier 1/2/3 complete, use as Phase 2B exit smoke test.

**Estimated duration**: sunset = 1 week; port = 1 month if last.

---

## 7. Timeline + dependencies

```
T6.4 100% GO (May ~2026)
    │
    ▼
T6.5 Phase A (14d) — dead-time verify
    │
    ▼
T6.5 Phase B (14d) — stub-out
    │
    ▼
T6.5 Phase C (~30d) — Java analysis removed
    │
    ▼
[Phase 2A retrospective ~2026-07]
    │
    ▼
Phase 2B Tier 1 — Config (3 mo)         → cutover ~2026-10
    │
    ▼
Phase 2B Tier 2 — Dashboard (2 mo)      → cutover ~2026-12
    │
    ▼
Phase 2B Tier 3 — Upload (2–4 mo)       → cutover ~2027-02 to 04
    │
    ▼
Phase 2B Tier 4 — Demo (sunset 1w / port 1mo)
    │
    ▼
Phase 2B complete: ~2027-Q1 to Q2
```

Tier dependencies (hard):
- Tier 2 depends on Tier 1 SSE infrastructure (none — Tier 2 builds it).
- Tier 3 depends on Tier 2 streaming framework (Tier 3 reuses Tier 2 SSE recorder + boundary-buffer patterns).
- Tier 4 depends on prior tiers if porting (each tier consumes shared dispatcher infra).

Tier dependencies (soft):
- Phase 2B Tier 1 kickoff requires T6.5 Phase C complete (Java analysis files removed) so that smartbi_compat module structure is settled.
- Each tier's cutover requires the prior tier's 24h soak GO (no overlapping cutovers).

---

## 8. Out of scope (Phase 2C+)

Items explicitly NOT addressed by Phase 2B; tracked for Phase 2C+ planning:

| Item | Rationale | Phase |
|---|---|---|
| Cross-tenant `raw_material_type` schema 重构 | Business decision pending; touches 14+ tables; unrelated to SmartBI port pipeline. | Phase 2C+ |
| Mobile app version compatibility / forced upgrade prompts | Frontend separate effort, owned by mobile team. | Phase 2C+ |
| Embedding service (`embedding-service-1.0.0.jar`, gRPC 9090) | Not byte-shape parity scope; runs alongside Java/Python independently. | Out of scope indefinitely |
| `GoldDashboardBuilder` + `GoldFinanceClient` removal | Architectural KEEP per task #24 — Java is downstream consumer of Python Gold; removal would require frontend rework on consumers. | Out of scope indefinitely |
| Java DTOs in `dto/smartbi/` removal | Same — used by GoldDashboardBuilder. | Out of scope indefinitely |
| Strict-byte universal upgrade | Requires Java-side rework; defer to Phase 3+ if business needs strict serialization. | Phase 3+ |
| Frontend Vue → React migration | Separate frontend effort. | Out of scope |
| Python service split (one process → microservices) | Premature; current 8083 unified process is fine for current scale. | Out of scope indefinitely |
| AI Tool/Skill architecture port | Java-side stays per Phase 2A scope decision (memory `project_apr30_tool_skill_stays_java.md`). | Out of scope indefinitely |

---

## 9. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|:-:|:-:|---|
| R-1 | Frontend code path drift mid-port (Vue / RN updates change which controller is hit) | M | M | Operator code-path map snapshot at each tier kickoff; freeze frontend changes during cutover window. |
| R-2 | Excel parse fidelity (Apache POI ↔ openpyxl) divergence breaks upload | M | H | Tier 3 dedicated parser-parity spec; sample golden uploads from each customer; per-customer canary cutover. |
| R-3 | SSE chunk timing regression (Tier 2 stream endpoint perceived slower than Java) | M | M | SSE byte-shape recorder + flush-timing benchmark; load-test with realistic LLM streaming load. |
| R-4 | Strict-byte gate adoption complexity | L | M | Defer universal strict-byte to Phase 3+; per-tier adopt only where contracts demand. |
| R-5 | Resource availability (Phase 2B is 6–9 months, possible team turnover) | M | H | Codify all Phase 2A learnings in `python-java-port.md` (done — 12 rules); detailed per-tier specs serve as onboarding docs. |
| R-6 | Phase 2A rule audit thread maintenance (rules accumulate; new rules emerge from Tier 2/3 work) | M | L | Each tier post-mortem audit graduates new rules to `python-java-port.md`; sister-chat sweep applied. |
| R-7 | Multi-tenant data isolation regression during port | L | H | Each tier's spec includes RLS audit (smartbi_prod_db schema migration runner already enforces). |
| R-8 | Customer demo (Tier 4) unilateral sunset surprises business | L | L | Operator decision before tier kickoff; option to defer-port instead of sunset. |
| R-9 | T6.5 Phase C delay or rollback (Java analysis re-enabled) | L | H | Phase 2B kickoff blocked until T6.5 Phase C confirmed; if T6.5 rollback occurs, Phase 2B paused, not aborted. |
| R-10 | Per-tier dryrun match rate falls below Phase 2A 99.945% baseline | M | H | Same gates per tier (T6.1 dryrun pattern); diverge investigations follow Phase 2A same-cause sweep model. |
| R-11 | Migration drift between test/prod during multi-month tier work | L | M | Smartbi migration runner enforces tracker table (HARD RULE, `server-operations.md`); cross-env diff via `comm -23` schema dumps part of per-tier checklist. |
| R-12 | Concurrent chat scope creep during 4-chat parallel impl | M | L | `git commit -- <paths>` Rule 5b mandatory; worktree isolation per chat. |

---

## 10. GO criteria per phase

### 10.1 Phase 2B kickoff GO

All of:
- T6.5 Phase C complete: Java analysis files removed from `backend/java/cretas-api/src/main/java/com/cretas/aims/`, no compile errors, deployment green.
- T6.5 Phase D 30-day audit confirms zero Java analysis traffic.
- Phase 2A retrospective doc shipped + reviewed.
- Frontend code path map current (operator deliverable).
- Operator + business stakeholder sign-off.

### 10.2 Per-tier cutover GO

For each tier (Tier 1 / 2 / 3 / 4-if-port):
- All sub-domain specs reviewed via 4-cycle audit.
- All sub-domain impl PRs merged + smoke-tested.
- T6.1-equivalent dryrun match rate ≥99% sustained.
- Per-customer baseline metrics (revenue / dashboard rate / upload success rate) within ±20% of pre-cutover.
- 24h soak with zero P1 customer reports.
- Rollback rehearsal documented + measured (per T6.4 rollback rehearsal model).
- Operator sign-off.

### 10.3 Phase 2B complete GO

All of:
- Tiers 1–3 cutover complete + 30-day soak GO each.
- Tier 4 sunset OR cutover complete.
- All 75 non-analysis SmartBI endpoints on Python.
- Java SmartBI controller files removed (parallel T6.5-equivalent for non-analysis controllers).
- Phase 2B retrospective doc shipped.

---

## 11. Open questions for Phase 2B reviewer

These need explicit answers BEFORE Phase 2B Tier 1 kickoff:

### Q-1 — Strict-byte gate scope per tier

This doc recommends dict-eq for Tier 1, hybrid for Tier 2/3, dict-eq for Tier 4
(if ported). Reviewer must confirm OR override per category. Particularly:

- Tier 2 SSE: is strict-byte chunk parity worth the engineering cost?
- Tier 3 upload envelope: confirm `uploadId` / `confirmToken` byte-stable contract.

### Q-2 — Test infrastructure changes

Does Phase 2B need:
- New SSE byte-shape recorder (Tier 2 prereq)?
- Excel parse golden test suite (Tier 3 prereq)?
- Multi-tier T6.X dryrun-compare upgrade (handle SSE / multipart)?

These aren't in current `scripts/record-java-golden.sh`. Need ~3–4 weeks of
tooling work upfront if confirmed.

### Q-3 — Frontend code path verification

Operator deliverable required at each tier kickoff:
- Sample list of Vue / RN pages that hit each tier's endpoints.
- API call traces (browser DevTools / RN flipper) for top customer journeys.
- Confirmation that frontend is byte-shape tolerant (or list of frontend
  changes required to handle Tier 2 SSE / Tier 3 envelope shifts).

### Q-4 — Upload performance benchmarks (Tier 3)

Phase 2A didn't benchmark anything. Tier 3 needs:
- Java current p99 upload latency for 1MB / 10MB / 50MB Excel files.
- Acceptable Python p99 regression band (e.g., ≤2× Java, ≤1.5× Java).
- Memory ceiling (uvicorn N=2 worker has ~2 GB combined).

### Q-5 — Public demo (Tier 4) deprecation vs port

Business decision:
- Sunset (replace dynamic with static JSON in showcase site)?
- Port (Python equivalent of Java public-demo controller)?
- Hybrid (port read endpoints, sunset write endpoints)?

### Q-6 — Phase 2B chat coordination model

Phase 2A used 4–6 parallel chats with organizer. For Phase 2B, confirm:
- Same model? Or 1 chat per tier (linear)?
- Marching order template stays as-is? (per memory `feedback_organizer_marching_order_separation.md`)
- Worktree isolation enforced (per `concurrent-edit-safety.md` Rule 2)?

### Q-7 — Smartbi schema additions during Phase 2B

Tier 1 Config port may add new tables (intent versions / threshold history).
Tier 3 Upload port may add upload-pipeline state tables. Each tier:
- Must ship migrations through `apply-smartbi-migrations.sh` runner.
- Must verify cross-env (test/prod) schema parity before cutover.

Confirmed by spec; flagged here as reviewer checkpoint.

---

## 12. Parallel work analysis (per `parallel-work-analysis.md` rule)

### Subagent (single chat):
- ✅ Tier 1 sub-domain spec drafts (7 sub-domains, independent).
- ✅ Endpoint inventory grep + analysis.
- ❌ Cross-tier dependency analysis (needs sequential review).

### Multi-chat:
- ✅ Tier 1 + Tier 2 spec drafting in parallel (different controllers).
- ✅ Tier 3 parser-parity spike + Tier 1 impl in parallel.
- ❌ Tier cutovers (must be sequential — never overlap).

### Conflict risk:
- Low for spec drafting (different docs).
- Medium for impl (shared `smartbi_compat/` module — use sub-domain sub-modules).
- HIGH for cutover windows (single nginx vhost, single deploy slot).

---

## Appendix A — Phase 2A reference numbers

For Phase 2B sizing baseline:

| Metric | Phase 2A actual |
|---|---|
| Total endpoints ported | 50 |
| Total LOC ported (Python) | ~10,000 |
| Total spec docs | ~20 |
| Total PRs | ~150 |
| Total chats coordinated | 4–6 parallel |
| Duration (kickoff → T6.4 100%) | ~7 weeks (Apr 28 → May 14, 2026 estimated) |
| Codified rules graduated | 12 |
| Pattern B latents found | 2 (finance + sales) |
| Dryrun match rate baseline | 99.945% |
| T6.1–T6.4 cutover stages | 4 stages, ~7 days total |
| Rollback rehearsals | 1 (T6.4-prep) |

Per-endpoint average: ~200 LOC + ~3 PRs + ~4 days dryrun-to-cutover.

Phase 2B 75 endpoints scaled estimate: ~15,000 LOC, ~225 PRs, ~6–9 months
(sequencing tax + tooling investment for SSE + Excel).

---

## Appendix B — File layout sketch (post Phase 2B)

```
backend/python/smartbi_compat/
├── api/
│   ├── analysis_*.py          # Phase 2A (50 endpoints)
│   ├── config_*.py            # Phase 2B Tier 1 (41 endpoints, 7 sub-modules)
│   ├── dashboard_*.py         # Phase 2B Tier 2 (11 endpoints + SSE)
│   ├── upload_*.py            # Phase 2B Tier 3 (13 endpoints + multipart)
│   └── public_demo.py         # Phase 2B Tier 4 if ported
├── streams/
│   └── sse_recorder.py        # Phase 2B Tier 2 tooling
└── parsers/
    └── excel_parity.py        # Phase 2B Tier 3 tooling

backend/java/cretas-api/src/main/java/com/cretas/aims/controller/
├── (analysis controllers REMOVED in T6.5)
├── (config controller removed end Phase 2B Tier 1)
├── (dashboard controller removed end Tier 2)
├── (upload controller removed end Tier 3)
└── (public demo removed/redirected per Tier 4 decision)
```

Java GoldDashboardBuilder + GoldFinanceClient stay (per task #24).

---

## Status

This is a **scoping doc**. Phase 2B Tier 1 kickoff requires:
- T6.5 Phase C complete.
- Q-1 through Q-7 above answered.
- Operator + business sign-off.
- Estimated kickoff: ~2026-07 to 2026-08, contingent on T6.5 timeline.
