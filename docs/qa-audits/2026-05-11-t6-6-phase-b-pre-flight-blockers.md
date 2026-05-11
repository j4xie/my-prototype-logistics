# T6.6 Phase B Pre-flight Blocker Audit — Production + Quality Endpoint Port

**Status**: ⛔ PAUSE — Pre-flight gates not met; dispatch premature
**Audit date**: 2026-05-11
**Audit triggered by**: T6.6 Phase B Sub-A + Sub-B pilot impl dispatch (chat1, post-`/clear` context)
**Decision pivot**: Steve elected "Pause + findings audit" after pre-flight surfaced 5-category blocker stack
**Author**: chat1 sister chat, audit-only
**Branch**: `ops-t6-6-phase-b-pre-flight-audit`
**Worktree**: `.worktrees/t6-6-phase-b-pre-flight-audit`

---

## 0. TL;DR

- Dispatch budget: 3-4 hours, pilot impl for `/analysis/production` + `/analysis/quality` Java→Python port.
- Spec actual scope: **~20.5 person-days** (Q1 amendment PR #223 §4.7 = 3d Excel→CSV + 3d Silver/Gold ETL + 0.5d factory_id seed + 10d service refactor + 2d Java reference goldens + 2d test infra).
- Compression ratio dispatch-vs-spec: ~80× infeasible.
- Pre-flight gates §⛔ from MO (PR #249): **3 hard FAIL + 3 UNKNOWN + 4 PASS** out of 10.
- ETL infrastructure (~6.5 person-days for Steps 1+2+3): **NOT started** — `backend/python/smartbi_compat/etl/` does not exist; no `V20260815_*` migrations; 14 real-chain factory_ids not seeded.
- 2 critical Open Questions block endpoint output shape: **Q4** (production semantics for restaurant tenant) + **Q5** (quality metric redefinition for restaurant tenant). Both PENDING per Q1 amendment §8.
- T6.5 Phase C close + 30-day soak gate: **NOT MET** — 10 T6.5 Phase C Sub-* PRs merged within last 4 days (PRs #244 / #246 / #248 / #259 / #260 / #261 / #262 / #266 / #267 / #270 / #271 / #277 / #278); the post-Phase-C soak window has not begun.
- Q1 amendment (PR #223) §10 explicitly: *"This spec amendment is **not** a marching order."*
- T6.6 Phase B MO (PR #249) §6 explicitly: *"⛔ HOLD — DRAFT ONLY. Do not execute."*
- **No code written this session.** Audit doc only.

---

## 1. Dispatch vs spec scope discrepancy

### 1.1 Dispatch instruction summary

The dispatch from the outgoing `/clear`'d organizer chat reads:

> ⚡ IMMEDIATE — 当前 410 stub DOWN. Q1 sign-off real DB (PR #223), 不用 JavaRandom mock. 本次 session deliverable: pre-flight + 2 endpoint impl draft + dict-eq parity smoke (not full ship — spec says ~5d each).
>
> ETA: ~3-4h | Effort: medium-high

### 1.2 Spec scope (Q1 amendment §4.7)

| Step | Description | Person-days |
|---|---|---|
| 1 | Excel/CSV → Canonical CSV normalization | 3 |
| 2 | ETL into smartbi_prod_db Silver/Gold layer | 3 |
| 3 | factory_id naming convention + seed migration | 0.5 |
| 4 | **Production + Quality service refactor (the dispatch's target)** | **10** |
| 5 | Java goldens (now informational only — Java stays mock per §1) | 2 |
| 6 | Byte-shape parity test infrastructure | 2 |
| **Total** | | **~20.5** |

### 1.3 Direct compression analysis

- 3-4 hours ≈ 0.4-0.5 person-day.
- Sub-A (Production) impl per MO §3 alone = ~5 person-days + share ~5d ETL.
- Sub-B (Quality) impl per MO §3 alone = ~5 person-days + share Sub-A ETL.
- Producing a credible real-DB impl in 3-4h would require either:
  - **Fabricating data** (Python `random.Random(seed)` mock-mirror) — violates Q1 amendment §1 *"Drop _JavaRandom LCG primitive entirely"*.
  - **Empty/410 stubs** — no business value beyond what PR #205 already shipped.
  - **Pretending ETL is done when it isn't** — would surface in dict-eq goldens as empty arrays or HTTP errors.

None of the three is a useful 3-4h outcome.

### 1.4 Java method scope per endpoint (grep-verified)

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProductionAnalysisServiceImpl.java`:

```
line  76: DashboardResponse getOEEOverview(factoryId, startDate, endDate)
line 126: List<MetricResult> getOEEMetrics(factoryId, startDate, endDate)
line 143: List<MetricResult> getProductionEfficiency(factoryId, startDate, endDate)
line 210: List<RankingItem> getProductionLineRanking(factoryId, startDate, endDate)
line 221: List<MetricResult> getEquipmentUtilization(factoryId, startDate, endDate)
line 306: List<RankingItem> getEquipmentRanking(factoryId, startDate, endDate)
line 315: ChartConfig getDowntimeDistributionChart(factoryId, startDate, endDate)
line 326: ChartConfig getOEETrendChart(factoryId, startDate, endDate, period)
```

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java`:

```
line  77: DashboardResponse getQualitySummary(factoryId, startDate, endDate)
line 128: List<MetricResult> getDefectAnalysis(factoryId, startDate, endDate)
line 195: List<RankingItem> getDefectTypeRanking(factoryId, startDate, endDate)
line 204: ChartConfig getDefectParetoChart(factoryId, startDate, endDate)
line 215: List<MetricResult> getReworkCost(factoryId, startDate, endDate)
line 311: ChartConfig getQualityCostDistributionChart(factoryId, startDate, endDate)
line 322: ChartConfig getQualityTrendChart(factoryId, startDate, endDate, period)
```

That is **8 + 7 = 15 public methods** plus 9 + 7 internal sub-method functions per MO §3. The dispatch's "2 endpoint impl draft" wording understates the surface area.

---

## 2. Pre-flight gates §⛔ status (MO PR #249 §⛔)

Verbatim from `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` §⛔ (organizer responsibility, verify BEFORE dispatching MO):

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | T6.5 Phase C 100% close — all 11 sub-batches Sub-A through Sub-K merged | ❌ FAIL | 10 Phase C Sub-* PRs merged within last 4 days (PRs #244 / #246 / #248 / #259 / #260 / #261 / #262 / #266 / #267 / #270 / #271 / #277 / #278). Sub-Q / Sub-R / Sub-T worktrees still active per `git worktree list`. Phase C is in active progress, not closed. |
| 2 | T6.5 Phase C prod cutover ≥30d soak OR active-E2E shortcut window | ❌ FAIL | Soak start = day of full Phase C close, which has not happened. Active-E2E shortcut per HARD rule `active-E2E-replaces-passive-soak` still requires Phase C close first. |
| 3 | No P1 customer reports against any SmartBI controller path in soak window | ⚠️ VACUOUS | Soak not started — gate is vacuous until #1 + #2 met. Not verifiable. |
| 4 | F999 internal team confirms 410 acceptance OR new decision recorded in §5 Q-6 | ❓ UNKNOWN | MO Sub-G (F999 SmartBI Analysis migration decision doc) not yet dispatched per `git log` of `docs/superpowers/specs/`. |
| 5 | Q1 real-DB sign-off (PR #223) merged + binding | ✅ PASS | PR #223 merged at commit `18390ca3fe`; binding per amendment §1. |
| 6 | PRs #196 / #199 / #202 / #203 / #204 / #220 / #223 / #226 all merged on origin/main | ✅ PASS | All 8 verified via `git log --oneline \| grep -E "#196\|#199\|#202\|#203\|#204\|#220\|#223\|#226"`. |
| 7 | Phase 2A active-E2E framework v1 (PR #218) re-runnable as smoke baseline | ❓ UNKNOWN | Re-runnable status not verified this session; out of scope for audit. |
| 8 | No competing T6.6 / Phase 2B / Phase 3 PRs in flight touching shared files | ❌ FAIL | Active worktrees touching shared surface: `.worktrees/strict-byte-phase-1-week-1` + `.worktrees/strict-byte-week-2` + `.worktrees/strict-byte-w3-plan` (Phase 1+2 helpers integration in `smartbi_compat/_strict_byte.py`); `.worktrees/phase-2c-tier-{1,2,3,4-sunset-audit}`; `.worktrees/tier-4-sunset-impl`; `.worktrees/phase-2b-beta-ai-intent-verify`. Multiple touch `backend/python/smartbi_compat/`. |
| 9 | Server 47 + server 139 healthy | ❓ UNKNOWN | Not verified this session — out of scope for scope-decision audit. Verifiable in ~30s if needed via `systemctl status` over SSH. |
| 10 | Phase 2A 75/75 customer factories still on Python upstream | ✅ PRESUMED PASS | Per memory `project_2026_05_09_phase_2a_complete.md` — 75/75 final cohort. No rollback PR in flight. |

**Verdict: 3 hard FAIL (#1 / #2 / #8) + 3 UNKNOWN (#4 / #7 / #9) + 4 PASS (#5 / #6 / #10 plus #3 vacuous).**

Per MO §⛔ final line: *"If any gate not green → **STOP, do not dispatch**. Ping Steve."*

---

## 3. Open Questions blocking endpoint output shape

### 3.1 Q1 amendment (PR #223) §8 — 10 Open Questions

| Q | Question | Resolution status | Why blocks impl? |
|---|---|---|---|
| Q1 | factory_id naming `R_<CHAIN>_REAL` per §4.3 table | Default if no answer (per §8) | Soft — can use default for pilot |
| Q2 | 青花椒 25年 sub-dir treatment | Default (continuation) | Soft — pilot doesn't need 2025 data |
| Q3 | Internal showcase vs customer-facing | Default (internal only) | Soft — affects Sub-F cohort, not impl |
| **Q4** | **`/analysis/production` for restaurant tenant: tenant-gate vs redefine vs 410-stub** | **PENDING** | **HARD BLOCKER** — without this, `getOEEOverview()` for `tenant_type=RESTAURANT` is undefined. Restaurant has no equipment / production-line / OEE concept (per §3.2 verdict). |
| **Q5** | **Defect / FPY / rework redefinition for restaurant tenant** | **PENDING** | **HARD BLOCKER** — `getDefectAnalysis()` body is undefined for restaurant data (no defect column in Excel; `fact_restaurant_wastage` MISSING). §3.2 proposes returnRate / wastageRate / customerSatRate redefinition but not decided. |
| Q6 | ETL idempotence (UPSERT) | Default yes; reviewer audit gate | Soft — ETL design |
| Q7 | Customer review fact table — separate or aggregate | Default (new `fact_restaurant_review` later) | Soft — out-of-scope per §8 |
| Q8 | `.xls` legacy — pre-convert vs on-the-fly | Default (pre-convert) | Soft — ETL design |
| Q9 | T6.5 Phase B/C slip impact on Q1 scope | Default (no shift) | Soft — timing |
| Q10 | Existing Gold materialization sufficient | Verify in Step 2 | Soft — ETL design |

### 3.2 MO (PR #249) §5 — 8 Open Questions

| Q | Question | Resolution status | Effect on dispatch |
|---|---|---|---|
| Q-1 | Sub-A/B cohort dispatch parallel vs serial | PENDING | Affects sequencing of chats |
| Q-2 | Q1 amendment binding interpretation in PR #199 / #203 unamended bodies | PENDING | Affects which doc is authoritative for sub-batch chats |
| Q-3 | JavaRandom helper (PR #226) fate: KEEP / DELETE / REPURPOSE | PENDING | Affects whether cleanup PR is in Phase B scope |
| Q-4 | Active-E2E framework v1 reuse vs net-new | PENDING | Sub-H scope decision |
| Q-5 | Sub-F nginx cohort regex: canary 1-3 customers vs full 14 + F001 + F999 | PENDING | Sub-F design (organizer-owned) |
| Q-6 | F999 status: keep 410 (Decision 2A) vs route to Python | PENDING | Hard precondition for Sub-F dispatch + Sub-G content |
| Q-7 | Strict-byte gate adoption for `/query` | PENDING | Phase 2A inheritance; affects Sub-C protocol |
| Q-8 | Sub-H 30-day soak compression decision | PENDING | Phase D timing |

**8 of 8 MO §5 Open Questions unresolved.**

### 3.3 Critical-path requirement

To make Sub-A or Sub-B impl-dispatchable at all, **Steve must at minimum resolve Q4 + Q5 from Q1 amendment §8** plus **MO §5 Q-3 (JavaRandom fate)** before any code edit. Q4 + Q5 are not soft defaults — the spec explicitly says these are "meaningful design decisions for Phase B kickoff" (Q1 §3.2 last line + §8 Q4 + Q5 rows).

---

## 4. ETL absence — verified state (file-system + DB)

### 4.1 Filesystem check (run from worktree base)

```
backend/python/smartbi_compat/etl/                ←  DOES NOT EXIST
backend/python/smartbi/database/migrations/V20260815_*.sql   ←  ZERO matches
scripts/etl/import-restaurant-chain.py             ←  DOES NOT EXIST
scripts/etl/normalize-restaurant-chains.py         ←  DOES NOT EXIST
data/imports/restaurant-chains/                    ←  DOES NOT EXIST
```

### 4.2 Source data check — verified present per Q1 §2.2

```
smartbi维度分析/大众点评/真实餐饮连锁数据/    ←  PRESENT
  20260306094202727_e72f865f5e1_商品销量报表.xlsx
  IL TEATRO（西餐厅）2月_商品销量报表.xls
  上马火锅（火锅）2月商品销量报表.xls
  唏嘛香（牛肉面）2月销量报表.xls
  东门口25年/        ← sub-dir
  东门口2月商品销量报表.csv
  东门口2月采购入库明细报表.csv
  今日牛事5个月/     ← sub-dir
  xlsx/             ← partial pre-conversions
  xlsx_converted/   ← partial pre-conversions
  ... (22 total files / 14 chains per Q1 §2.2)
```

Source data is present and ready for ETL Step 1; only the ETL pipeline itself is missing.

### 4.3 Existing Silver/Gold schema state

Verified migrations under `backend/python/smartbi/database/migrations/`:

- `2026_04_24_silver_restaurant_ops.sql` — restaurant ops silver
- `2026_04_24_gold_restaurant_ops.sql` — restaurant ops gold
- `2026_04_25_restaurant_ops_intents_seed.sql`
- `2026_04_28_silver_dimensions.sql` — `dim_store`, `dim_product`, `dim_ingredient`, `dim_staff`
- `2026_04_29_silver_facts.sql` — `fact_pos_transaction`, `fact_pos_item`, `fact_pos_payment`, `fact_pos_discount`, `fact_restaurant_requisition`
- `2026_05_05_gold_aggregations.sql` — `agg_restaurant_daily_*`
- `2026_05_20_silver_cost.sql`
- `20260408_restaurant_reviews.sql`
- `20260408_smartbi_restaurant_bom_layer23.sql`
- `20260408_smartbi_restaurant_dynamic.sql`
- `V20260427_02__b_silver_writer_tables.sql`
- `V20260428_03__b_silver_grants.sql`
- `V20260501_04__restaurant_etl_failures.sql`
- `V20260501_05__restaurant_etl_failures_check_constraints.sql`

Schema present, **rows empty** for the 14 real chains per Q1 §3.3:
> *"Most Silver/Gold tables empty for the 14 chains in this inventory (none of these chains have factories matching the 75 factory_ids currently routed to Python via T6.4). F999 (test factory) and F001 (default seed) are populated for unit-test purposes only."*

### 4.4 Missing facts per Q1 §3.1 (blockers for quality endpoint)

- `fact_restaurant_wastage` — Silver table exists OR not? Per Q1 §3.1: ❌ MISSING — Excel data has no wastage column. Quality endpoint `getReworkCost` / defect derivation needs alternative source.
- `fact_restaurant_recipe_line` — ❌ MISSING — no BOM info in Excel.
- `fact_restaurant_stocktaking` — ❌ MISSING — no stocktaking events in Excel.

These gaps directly couple to Q5 (quality redefinition decision).

### 4.5 Effort to fix per Q1 §4.7

| Step | Effort |
|---|---|
| 1. Excel → Canonical CSV normalization | 3 person-days |
| 2. ETL into Silver/Gold | 3 person-days |
| 3. factory_id naming + seed migration | 0.5 person-day |
| **Subtotal ETL infrastructure** | **6.5 person-days** |

Per Q1 §5 trigger conditions:
> *"Step 1+2+3 ETL infrastructure work scheduled (~6.5 person-days, may be done in parallel with T6.5 Phase B/C)"*

This work may run in parallel with T6.5 Phase C close — it is not gated on T6.5. Steve can dispatch ETL chats immediately if desired, independent of MO pre-flight gate #1.

---

## 5. Java method signatures + controller paths (captured for future impl)

### 5.1 Controller endpoint paths (post PR #205 410-stub)

```
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java
  line  80:  @GetMapping("/analysis/production")
  line 119:  @GetMapping("/analysis/quality")
```

Both return HTTP 410 Gone per PR #205. The service impl files (`ProductionAnalysisServiceImpl.java` + `QualityAnalysisServiceImpl.java`) remain present and are KEEP per PR #178 §3.2.a — they continue to serve `SmartBIDashboardController` composites for the Dashboard executive overview.

### 5.2 Java side semantic per Q1 §1 final paragraph

> *"The Java ProductionAnalysisServiceImpl and QualityAnalysisServiceImpl files stay unchanged through T6.6. They keep returning mock data because they still serve SmartBIDashboardController composites... T6.6 Phase D removes only the controller method bodies (SmartBIAnalysisController::getProductionAnalysis + ::getQualityAnalysis), NOT the service impls."*
>
> *"This means post-T6.6 cutover, Java path is mock and Python path is real — they intentionally diverge. dict-eq gate does NOT apply between Java and Python anymore for these two endpoints once cutover happens, because they are no longer equivalent surfaces. Phase B must record goldens against the Python real-DB output as the new source of truth."*

This rules out the dispatch's "F999 + F001 record-java-golden.sh" step as a parity gate. The 410 stub plus the mock Java impl behind Dashboard composite are not the gold reference for Python real-DB output — they intentionally diverge.

---

## 6. Recommended next sequence

### 6.1 Synchronous — Steve must resolve before any sub-batch impl dispatch

1. **Resolve Q1 amendment §8 Q4 + Q5** — restaurant-tenant semantics decision doc.
   - **Q4** (production endpoint for restaurant tenant): three candidates per Q1 §3.2 — (a) tenant-type-gate to FACTORY only with restaurant returning 410 / empty + `notApplicableForTenantType: true`; (b) redefine production semantics as store-level operational metrics; (c) keep 410-stub for restaurant tenants permanently.
   - **Q5** (quality redefinition): per Q1 §3.2 — `defectRate → returnRate` (from sales return col), `reworkRate → wastageRate` (NULL if `fact_restaurant_wastage` unpopulated), `FPY → customerSatisfactionRate` (from 评价下载 if available — 青花椒 only).
   - Recommendation: write a small `docs/superpowers/specs/2026-05-XX-t6-6-restaurant-semantics-decision.md` (~0.5 person-day, Steve solo or chat dispatch).

2. **Resolve MO §5 Q-3** — JavaRandom helper fate. Recommend KEEP dormant per MO §5 Q-3 rec — minimal carrying cost. Affects future cleanup PR scope, not Sub-A/Sub-B impl.

3. **Resolve MO §5 Q-1** — Sub-A/B cohort parallel vs serial. Recommend parallel-with-ETL-gate per MO §5 Q-1 rec.

4. **Confirm T6.5 Phase C close criteria + soak compression decision** per HARD rule `active-E2E-replaces-passive-soak`. If active-E2E shortcut acceptable, MO pre-flight gate #2 can be met in days not 30 calendar days.

### 6.2 Parallelizable with T6.5 Phase C close — Steve can dispatch now

5. **Dispatch ETL infrastructure chats** (~6.5 person-days total, can split across 3 parallel chats):
   - **Chat-ETL-1**: Step 1 Excel→Canonical-CSV normalization. Output: `scripts/etl/normalize-restaurant-chains.py` + `data/imports/restaurant-chains/<chain>/<report>/<period>.csv` layout + `data/imports/_index.json` catalog. ~3 person-days.
   - **Chat-ETL-2**: Step 2 Silver/Gold loader. Output: `scripts/etl/import-restaurant-chain.py` + `V20260815_01__t6_6_etl_silver_layer.sql` + `V20260815_02__t6_6_etl_gold_production.sql` + `V20260815_03__t6_6_etl_gold_quality.sql`. ~3 person-days.
   - **Chat-ETL-3**: Step 3 factory_id seed migration per Q1 §4.3 14-chain table + Q1 + Q2 default acceptance. ~0.5 person-day.
   - Note: per Q1 §10 final paragraph and §5 trigger conditions, ETL chats are independent of T6.5 Phase C timing — they only need source-data presence (verified §4.2) and DB schema presence (verified §4.3).

### 6.3 Serial — post-ETL-merge + Phase C close + Q4 / Q5 resolved

6. **Dispatch Sub-A** (`/analysis/production` Python port) per MO §3 Sub-A — 5 person-days.
7. **Dispatch Sub-B** (`/analysis/quality` Python port) per MO §3 Sub-B — 5 person-days. Blocks on Sub-A ETL phase merge confirmation (not full Sub-A merge) per MO §3 Sub-B.
8. **Sub-C** (`/query` rule engine port) per MO §3 Sub-C — 9 person-days firm. Parallelizable with Sub-A from T+0 (independent surface).
9. **Sub-D** (`/drill-down` parity verify) per MO §3 Sub-D — 0.5 person-day. Parallelizable.
10. **Sub-G** (F999 decision doc) per MO §3 Sub-G — 0.5 person-day. Resolves MO §5 Q-6.
11. **Sub-F** (nginx flip, organizer-owned) per MO §3 Sub-F — after all impl PRs merge.
12. **Sub-E** (post-flip parity consolidation) per MO §3 Sub-E — after Sub-F flip.
13. **Sub-H** (active-E2E + 30-day soak monitoring) per MO §3 Sub-H — ongoing.

### 6.4 What this audit does NOT change

- Q1 amendment (PR #223) and MO (PR #249) remain authoritative.
- HARD KEEP list (Java service impl files for Dashboard composite) per MO §1 untouched.
- Phase 2A dict-eq gate remains the byte-shape standard (no strict-byte upgrade in this audit).
- All `.claude/rules/python-java-port.md` Rules 1-12 apply to future Sub-A / Sub-B impl unchanged.

---

## 7. What this session produced

- **This audit document** — `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md`
- **0 Python source files modified** — no `analysis_production.py`, no `analysis_quality.py`, no `etl/` modules
- **0 SQL migrations created** — no `V20260815_*.sql`
- **0 nginx vhost edits** — server 139 untouched
- **0 deploy invocations** — no `deploy-smartbi-python.sh`, no `deploy-backend.sh`
- **0 goldens recorded** — `scripts/record-java-golden.sh` not executed
- **0 Java side changes** — Java service impls + 410-stub controllers untouched per Q1 §1 / MO §1 HARD KEEP

Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_dispatch_on_technical_readiness.md` + Q1 amendment §10 + MO §6 HOLD instructions, this session's intended outcome is the audit doc + STOP-and-ping organizer Steve before push.

---

## 8. Cross-references

| Doc | Path / PR | Relation to this audit |
|---|---|---|
| Q1 real-DB amendment | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` (PR #223 merged `18390ca3fe`) | Authoritative for data source decision; §4.7 effort breakdown + §8 Open Questions + §10 HOLD = audit triggers |
| T6.6 Phase B execute MO | `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` (PR #249 merged `4705353ab4`) | Authoritative for sub-batch protocol; §⛔ pre-flight gates + §5 Open Questions + §6 HOLD = audit core |
| T6.6 Phase A design | PR #196 merged | T6.6 entry-point inventory; gate #6 PASS |
| Production-port detail | `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` (PR #199 merged) | Body voided by Q1 amendment; useful for Java method-mirror reference §5.1 |
| Quality-port detail | `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md` (PR #203 merged) | Body voided by Q1 amendment; useful for Java method-mirror reference §5.1 |
| /query port detail | PR #202 merged | Sub-C reference — independent of this audit |
| /drill-down parity | PR #204 merged | Sub-D reference — independent of this audit |
| Cross-PR consistency | PR #220 merged | Effort variance + dependency graph; informs §6.3 sequencing |
| JavaRandom helper | PR #226 merged `53f81ac104` | ORPHAN per Q1 §1; fate MO §5 Q-3 |
| 23-stub 410 deploy | PR #205 merged | Current state of `/analysis/production` + `/analysis/quality` = HTTP 410 Gone |
| T6.5 Phase C MO | `docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md` (PR #227 merged) | T6.5 Phase C close is MO pre-flight gate #1 |
| Phase 2A dict-eq gate | `.claude/rules/python-java-port.md` Rule 4 §"Phase 2A dict-eq gate official standard" | Applies to future Sub-A / Sub-B impl; not used this session |
| HARD active-E2E rule | `feedback_active_e2e_replaces_passive_soak.md` (memory) | May compress MO pre-flight gate #2 from 30 calendar days to days |
| HARD pause-before-push rule | `feedback_pause_before_deploy_or_push.md` (memory) | Drove STOP-and-ping before opening PR for this audit |
| HARD technical-readiness rule | `feedback_dispatch_on_technical_readiness.md` (memory) | Drove the pre-flight gate verification that surfaced 3 hard fails |

---

## 9. Open follow-up tasks (for organizer / Steve)

- [ ] **Q4 + Q5 decision doc** — restaurant-tenant production + quality semantics. ~0.5 person-day. Steve solo or chat dispatch.
- [ ] **MO §5 Q-3 JavaRandom fate** — KEEP / DELETE / REPURPOSE. Decide in passing, no doc needed.
- [ ] **MO §5 Q-1 Sub-A/B cohort dispatch** — parallel vs serial. Decide in passing.
- [ ] **T6.5 Phase C close watchlist** — track remaining Sub-Q / Sub-R / Sub-T worktrees; declare Phase C 100% close + start soak window.
- [ ] **Active-E2E soak-compression decision** — adopt HARD rule `active-E2E-replaces-passive-soak` shortcut to compress MO pre-flight gate #2.
- [ ] **ETL infrastructure dispatch** (3 chats, ~6.5 person-days total) — can begin in parallel with T6.5 Phase C close per Q1 §5 trigger conditions.
- [ ] **Server 47 + 139 health re-verify** if any sub-batch dispatch resumes (MO pre-flight gate #9).

---

**End of audit. Awaiting Steve decision on §6.1 synchronous steps before re-dispatch of Sub-A / Sub-B.**

---

*Author: chat1 (sister chat, post-`/clear`, 2026-05-11)*
*Triggered by: T6.6 Phase B Sub-A + Sub-B pilot impl dispatch from outgoing organizer chat*
*Decision pivot via AskUserQuestion: Steve elected "Pause + findings audit" 2026-05-11*
*Worktree: `.worktrees/t6-6-phase-b-pre-flight-audit` on branch `ops-t6-6-phase-b-pre-flight-audit` rooted at `origin/main` HEAD `763629a46d`*
