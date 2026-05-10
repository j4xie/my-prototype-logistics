# F999 SmartBI Analysis — Long-Term Migration Decision Record

**Phase**: T6.5 Phase C Sub-O (decision-record companion to T6.6 Phase B Sub-G placeholder per PR #249 §3 Sub-G)
**Status**: Decision spec — doc only, no code
**Author**: chat7 reuse / Round 3 Sub-O
**Date**: 2026-05-15 (target dispatch — actual write 2026-05-09)
**Predecessor**:
- PR #178 (T6.5 Phase A audit, §3.1.a F999 row, §6.4 T6.6 candidate flag)
- PR #205 (T6.5 Phase B 410-stub of 23 endpoints — Decision 2A unconditional 410)
- PR #196 (T6.6 Phase A design)
- PR #249 (T6.6 Phase B execute MO draft, §3 Sub-G placeholder)
- `docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md` (implementation spec for Option B path — recommends adding F999 to nginx regex)
**Successor**: T6.6 Phase B Sub-G ratification (this doc graduates the placeholder into a defended choice) + nginx regex amendment if Option B chosen

---

## 0. TL;DR

**Recommendation: Option A — F999 stays on the status-quo 410 stub for the 23 already-cutover endpoints AND continues to fall through to Java for the 4 NOT_SAFE_FALLTHROUGH endpoints until T6.6 Phase B impl ships. Defer Option B (route F999 to Python) until a concrete F999 use-case demands it.**

Rationale in one paragraph: F999 is the internal test/showcase factory. Per T6.5 Phase B (PR #205, Decision 2A) it now serves 410 on 22 SmartBIAnalysisController + 1 SmartBIDashboardController endpoint methods. Internal testing post-cutover has been verified against F001 / RES_3101_009 / R_GML_DEMO (Phase 2A canary cohort) — F999 is no longer the active test surface for SmartBI Analysis. Routing F999 to Python (Option B) requires either real F999 data populated in Python's `smart_bi_*` schema (~1-2d ETL work) or an explicit "synthetic test fixture" decision; neither carries enough value to justify the engineering cost given F001+ already covers internal QA needs. Deleting endpoints (Option C) is already the natural progression of T6.5 Phase C method-level audit (Sub-J/K orphan delete pattern) and is **not F999-specific** — it happens regardless of this decision. This spec therefore ratifies Option A as the explicit long-term position rather than an accidental status quo.

**Net consequence of Option A**:
- 0 engineering days
- 0 nginx changes
- F999 internal team continues to use F001 / canary cohort for SmartBI Analysis testing (already happening)
- 4 NOT_SAFE endpoints (production / quality / query / drill-down) remain Java-served for F999 even after T6.6 Phase B Python flips them for the 75-customer cohort — this is acceptable because Java code stays alive for Dashboard composite anyway (PR #178 §3.2.a)

---

## 1. Scope clarification

The marching order phrases this as "F999 SmartBI Analysis 5 endpoint" — that count is approximate. The actual F999-impacted SmartBI Analysis surface is:

### 1.1 The 23 already-cutover endpoints (T6.5 Phase B PR #205, Decision 2A unconditional 410)

| Controller | Method | Path | F999 current behavior |
|---|---|---|---|
| SmartBIAnalysisController | `getSalesAnalysis` | `GET /analysis/sales` | 410 SMARTBI_MIGRATED |
| SmartBIAnalysisController | `getDepartmentAnalysis` | `GET /analysis/department` | 410 |
| SmartBIAnalysisController | `getRegionAnalysis` | `GET /analysis/region` | 410 |
| SmartBIAnalysisController | `getFinanceAnalysis` | `GET /analysis/finance` | 410 |
| SmartBIAnalysisController | `getBudgetAchievementChart` | `GET /analysis/finance/budget-achievement` | 410 |
| SmartBIAnalysisController | `getYoYMoMComparisonChart` | `GET /analysis/finance/yoy-mom` | 410 |
| SmartBIAnalysisController | `getCategoryStructureComparisonChart` | `GET /analysis/finance/category-comparison` | 410 |
| SmartBIAnalysisController | `getInventoryAnalysis` | `GET /analysis/inventory` | 410 |
| SmartBIAnalysisController | `getProcurementAnalysis` | `GET /analysis/procurement` | 410 |
| SmartBIAnalysisController | `getAlerts` | `GET /alerts` | 410 |
| SmartBIAnalysisController | `getRecommendations` | `GET /recommendations` | 410 |
| SmartBIAnalysisController | `getIncentivePlan` | `GET /incentive-plan/{type}/{id}` | 410 |
| SmartBIAnalysisController | `uploadAndDetectSchema` | `POST /datasource/upload` | 410 (deferred Phase 3 — PR #185 stub) |
| SmartBIAnalysisController | `previewSchemaChanges` | `GET /datasource/{id}/preview` | 410 (deferred Phase 3) |
| SmartBIAnalysisController | `applySchemaChanges` | `POST /datasource/apply` | 410 (deferred Phase 3) |
| SmartBIAnalysisController | `listDatasources` | `GET /datasource/list` | 410 |
| SmartBIAnalysisController | `getDatasourceFields` | `GET /datasource/{id}/fields` | 410 |
| SmartBIAnalysisController | `getSchemaHistory` | `GET /datasource/{id}/history` | 410 |
| SmartBIAnalysisController | `getQueryTemplates` | `GET /query-templates` | 410 |
| SmartBIAnalysisController | `createQueryTemplate` | `POST /query-templates` | 410 |
| SmartBIAnalysisController | `updateQueryTemplate` | `PUT /query-templates/{id}` | 410 |
| SmartBIAnalysisController | `deleteQueryTemplate` | `DELETE /query-templates/{id}` | 410 |
| SmartBIDashboardController | `getDataDateRange` | `GET /data-date-range` | 410 |

**Count: 23 endpoint methods.** Per PR #178 §3.1.a + §3.1.b verdict matrix and PR #205 stub commit.

### 1.2 The 4 NOT_SAFE_FALLTHROUGH endpoints (T6.6 Phase B Sub-A/B/C/D scope)

| Controller | Method | Path | F999 current behavior |
|---|---|---|---|
| SmartBIAnalysisController | `getProductionAnalysis` | `GET /analysis/production` | Java (mock generator) |
| SmartBIAnalysisController | `getQualityAnalysis` | `GET /analysis/quality` | Java (mock generator) |
| SmartBIAnalysisController | `query` | `POST /query` | Java (rule engine + LLM fallback) |
| SmartBIAnalysisController | `drillDown` | `POST /drill-down` | Java (DynamicAnalysisService) |

**Count: 4 endpoint methods.** Per PR #178 §3.1.a NOT_SAFE_FALLTHROUGH rows. These are scheduled to flip to Python for the 75-customer cohort during T6.6 Phase B (~Aug 2026 per PR #249 dispatch sequence). F999's status during/after that flip is the question PR #249 §3 Sub-G defers to this spec.

### 1.3 Combined surface

**Total F999-touching SmartBI Analysis endpoints: 27** (23 stubbed + 4 still-Java-served). The marching order's "5" count is closest to a coarse grouping (sales / dept / region / finance-cluster / inventory-procurement, or the 4 NOT_SAFE + 1 dashboard) — interpretation isn't load-bearing. This spec covers all 27 with two distinct decisions:

- **Sub-decision 1**: long-term fate of the 23 stubbed endpoints' 410 state for F999. Q: stay 410, route F999 to Python, or delete?
- **Sub-decision 2**: T6.6 Phase B nginx regex inclusion of F999 for the 4 NOT_SAFE endpoints. Q: include F999 in cohort regex (Option B for the 4) OR keep F999 on Java fallthrough indefinitely (Option A).

The two sub-decisions are **independent** but share enough rationale that this spec analyzes them together.

---

## 2. Historical context

### 2.1 Decision 2A — unconditional 410 (T6.5 Phase B kickoff, PR #181 dispatch / PR #205 ship)

PR #178 §6.1 + §8.1 Open Question 2 framed the choice for T6.5 Phase B as:

- **Option A (unconditional 410)**: 23 stubbed methods return 410 to ALL factories including F999. Cleaner controller code, no branching.
- **Option B (F999 carve-out)**: stubbed methods check `factoryId == "F999"` first and fall through to existing Java implementation. F999 keeps working, all other factories see 410.

The organizer chose **Option A** during T6.5 Phase B kickoff (Decision 2A), with the rationale documented in PR #181 marching order §⛔ pre-flight:
> "F999 internal team confirmed acceptance of current 410 behavior on the 23 Phase B stubbed endpoints."

PR #205 (`feat(t6-5-phase-b): stub 23 SmartBI Analysis endpoint methods to 410 Gone`, merged 2026-05-09) implemented Decision 2A. **Status as of this spec**: 23 endpoints return 410 unconditionally on Java prod 10010; nginx routes 75 customer factories to Python (which serves them normally) and routes F999 to Java (which returns 410).

### 2.2 Why F999 was not migrated alongside the 75 customer cohort

Per PR #178 §4.1, the nginx regex on server 139 (`/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`) enumerates factory IDs explicitly. F999 was NOT included in T6.4's 5-stage cascade cohort regex because:

1. F999 is the internal test/showcase factory — not customer-bearing.
2. Phase 2A T6.1 dryrun used F999 as the **golden recording** factory, NOT the parity-validation factory (per T6.1 dispatch §3 + Phase 2A patterns). So F999 was the source of goldens, but the 75-cohort cutover was validated against F001 + canary customers (RES_3101_009, R_GML_DEMO) per PR #143 baseline metrics + PR #144 5-stage MOs.
3. Routing F999 to Python required Python's `smart_bi_*` schema to have F999-attributed data, which was not part of Phase 2A scope (Phase 2A focused on customer-cohort byte-shape parity).

### 2.3 Where F999 stands today (2026-05-09 post-cutover)

- F999 is still a registered factory in the auth + permissions layer.
- F999 still has data in the **Java-side** `cretas_prod_db.smart_bi_*` tables — Java continues to serve F999 reads when nginx falls through.
- F999 is NOT registered in **Python-side** `smartbi_prod_db` Bronze/Silver/Gold tables (Phase 2A cutover left F999 out of cohort).
- Internal QA / Cretas team uses F001 for active SmartBI Analysis testing post-T6.4 cascade.
- F999 use cases remaining: (a) golden-recording for any new endpoint port, (b) showcase / demo screen content (some Vue components hard-code F999 sample queries).

### 2.4 What changed in T6.6 Phase B context

PR #196 (T6.6 Phase A design) + PR #249 (T6.6 Phase B execute MO) plan to flip the 4 NOT_SAFE_FALLTHROUGH endpoints to Python via nginx regex amendment around mid-Aug 2026. PR #249 §3 Sub-G explicitly defers the F999-cohort question to a decision doc — **this spec**. Until Sub-G ratifies, the 4 NOT_SAFE endpoints will fall through to Java for F999 even after T6.6 Phase B Python impl ships, because the cohort regex will only include the 75-customer set (per PR #220 §4 + PR #249 §5 Q-5 canary recommendation: 1-3 customers first, then expand to 75).

---

## 3. Three options analyzed

### 3.1 Option A — Stay on 410 (status quo) for 23 stubbed; stay on Java for the 4 NOT_SAFE

**What this means concretely**:
- 23 endpoints: F999 continues to receive `410 Gone` with `code: SMARTBI_MIGRATED, newPath: /api/smartbi/analysis/...` body. No code change, no nginx change.
- 4 NOT_SAFE endpoints (post-T6.6 Phase B impl + cutover): nginx cohort regex stays `(F00[1-46]|...)` excluding F999. F999 keeps hitting Java for production / quality / query / drill-down — same as today. T6.6 Phase B Python impl serves only the 75-customer cohort.

**Pros**:
- **Zero engineering effort.** No PRs, no migrations, no nginx edits.
- **No revert cost.** If Steve later wants to flip to Option B, the change is additive (nginx regex amendment + Python data setup) — Option A doesn't lock anything in.
- **Decision 2A already operational.** F999 internal team has accepted 410 since 2026-05-09; switching to Python now would itself be a behavioral change that would need T-72h notice.
- **Java code stays alive anyway.** Per PR #178 §3.2.a, the 10 analysis service classes (Sales / Department / Region / Finance / Production / Quality / Inventory / Procurement / Dynamic / Recommendation) are KEEP forever because SmartBIDashboardController + SmartBIPublicDemoController inject them. F999 hitting Java for the 4 NOT_SAFE endpoints reuses code that's already alive — no incremental maintenance burden.
- **Phase D (T6.5) compatible.** T6.5 Phase C Sub-J/K orphan delete pattern + Phase D method-body removal can proceed regardless of F999's nginx status; the 22 SmartBIAnalysisController stubbed method bodies become deletable after 30-day soak per `2026-05-09-t6-6-f999-python-migration-spec.md` §3.4. Removing the method bodies converts F999's 410 into Spring's default 404 — semantically slightly different but operationally indistinguishable for an endpoint that nobody is calling.

**Cons**:
- **F999 cannot exercise the migrated SmartBI Analysis paths via API.** Internal QA loses one test fixture for the 23 endpoints. Mitigation: F001 + canary cohort already covers this.
- **Two-tier behavior requires documentation.** Future readers of `SmartBIAnalysisController.java` need to know: 410 for everyone (Decision 2A) / Java fallthrough for F999 on 4 NOT_SAFE / Python for 75 customers via nginx. The mental model is "factory routing happens at nginx, except F999 which deliberately bypasses 410 for the 4 NOT_SAFE because Python doesn't have F999 data". This complexity is real.
- **Doesn't resolve the "F999 is a second-class citizen" friction.** If the org's long-term direction is "Python-first", F999's permanent Java tether is an awkward exception.

**Cost**: 0 person-days. 0 nginx changes. 0 migrations.

**Revert cost (if Steve later flips to Option B)**: ~1-1.5 person-days — same as Option B's first-time cost (see §3.2). Nothing about Option A makes Option B harder later.

**适用场景 (when Option A is right)**:
- F999 has no concrete use case for SmartBI Analysis in the next 6 months
- Engineering bandwidth is constrained and any net-new work needs business justification
- "Internal test factory" semantics already handled by F001 / canary
- Dashboard composite + GoldDashboardBuilder Java path is staying alive anyway

### 3.2 Option B — Route F999 to Python (add F999 to nginx regex + populate Python data)

**What this means concretely**:
- nginx regex on server 139 amended from `(F00[1-46]|RES_*|R_GML_DEMO|...)` to `(F00[1-46]|RES_*|R_GML_DEMO|...|F999)`. Single edit + `nginx -t` + `nginx -s reload`.
- For the 23 already-cutover endpoints: F999 now hits Python upstream (8083). Python serves F999 normally if F999 data exists in `smartbi_prod_db.smart_bi_*` tables; otherwise returns empty/zero results (per PR #178 §4.1 implication — Python's row-zero behavior).
- For the 4 NOT_SAFE endpoints (post T6.6 Phase B Python impl): same — F999 included in cohort regex, hits Python.
- Python data setup: F999 needs Bronze/Silver/Gold rows in `smartbi_prod_db`. Either (a) ETL F999's existing Java-side `cretas_prod_db.smart_bi_*` rows into Python's schema, or (b) accept empty/zero results, or (c) seed synthetic showcase data per F999's demo role.

**Pros**:
- **Removes the F999 carve-out exception.** All factories route through nginx → Python uniformly. Cleaner mental model.
- **F999 testing surface restored.** Internal team can use F999 for SmartBI Analysis testing again (subject to data being populated).
- **Future-proofs T6.6 Phase D.** Removing the 4 NOT_SAFE controller method bodies (Phase D) is unambiguous if F999 also hits Python — no "but F999 still uses Java" exception to track.
- **Aligns with `2026-05-09-t6-6-f999-python-migration-spec.md` §2.5 step 3** (the existing T6.6 implementation spec assumes Option B and recommends adding F999 to nginx regex). Choosing Option B here ratifies that spec's implicit assumption.

**Cons**:
- **Python data setup non-trivial.** F999's data lifecycle becomes a real engineering question:
  - If we ETL existing `cretas_prod_db.smart_bi_*` F999 rows → Python's `smartbi_prod_db` mirror, that's ~1d of migration work plus ongoing sync if F999's data changes.
  - If we accept empty results, F999 demos / QA looks broken (zero charts, zero KPIs).
  - If we seed synthetic showcase data, that's ~2-3d of fixture work + maintenance burden.
- **T6.6 Phase B Sub-A/B (real-DB) makes this worse.** Per Q1 amendment (PR #223), production/quality endpoints will move to real-DB consumption (not mock). F999's real-DB data must come from somewhere. The 22 Excel/CSV files in `smartbi维度分析/大众点评/真实餐饮连锁数据/` are restaurant chain real data; F999 isn't a restaurant chain. So F999's production/quality data either stays empty or needs a synthetic generator.
- **Soak risk.** F999 hitting Python introduces a new traffic source; even at low volume, any P1 (e.g. Python returns malformed response when F999 data is empty) could surface at unfortunate times. Active-E2E (HARD rule per memory) covers it but adds cycles.
- **Engineering effort: ~1-2.5 person-days minimum** (nginx + smoke + verify-data-or-accept-empty), more if data ETL/seed needed (~3-5d).
- **Revert cost.** Adding F999 to regex is easy to revert (drop F999 from regex + reload). But once internal team starts depending on F999 SmartBI Analysis again, reverting is a behavioral change.

**Cost**: 1.5-5 person-days depending on data path:
- nginx-only + accept empty results: ~1.5d (nginx + smoke + active-E2E)
- + ETL existing Java-side F999 data to Python: ~2.5-3d
- + seed synthetic showcase data: ~3-5d

**Revert cost**: ~30 min nginx config (drop F999 from regex + reload). Behavioral revert (telling internal team "no longer testable") = social, not technical.

**适用场景 (when Option B is right)**:
- F999 has a known concrete use case in the next quarter (e.g., Cretas is doing customer demos that depend on F999 SmartBI Analysis working)
- Internal QA wants F999 as a clean test fixture independent of customer factories
- Long-term vision is "all factories on Python", and F999 is the last holdout
- Engineering capacity for the 1.5-5d work is available

### 3.3 Option C — Delete the endpoints completely

**What this means concretely**:
- T6.5 Phase C is **already** removing the 23 stubbed method bodies (per PR #178 §6.2 + PR #227 T6.5 Phase C MO). After Phase C, those 23 methods are gone from Java; F999 hitting them returns Spring's default 404 (no method handler).
- For the 4 NOT_SAFE endpoints, "delete" means: skip T6.6 Phase B Python port entirely AND remove the 4 Java method bodies. Customers lose the endpoints. Frontend would need to remove the corresponding Vue / RN screen sections.

**Pros**:
- **Simplest possible end state.** Java SmartBIAnalysisController shrinks to 0 endpoints (or 0 of the 27 in scope).
- **No nginx complexity for F999.** With endpoints gone, there's nothing to route.
- **No data setup question.** No data → no setup.

**Cons**:
- **For the 23 stubbed**: this option is actually **the existing T6.5 Phase C plan**, not a new option. PR #227 sub-batches Sub-J/K already plan method-body deletion. So choosing "Option C for the 23" = "let T6.5 Phase C do its job" — F999 will get 404 after Phase C ships, regardless of this decision. **Therefore Option C is not a meaningful F999-specific choice for the 23 stubbed endpoints.** It happens anyway.
- **For the 4 NOT_SAFE**: deleting these means cancelling T6.6 Phase B + removing customer-facing functionality. Production/quality/query/drill-down are real customer features (per PR #196 §1 Java intent service inventory + per Phase 2A baseline). 75 customers actively use them through Java. **Option C is therefore a customer regression, not just an F999 question.** Out of scope for an F999 decision spec.
- **Doesn't address the F999 question at all.** The whole point of this spec is "what to do with F999"; deleting endpoints from the codebase doesn't answer "should F999 access SmartBI Analysis or not" — it just removes the question by removing the surface.

**Cost**: For the 23 stubbed, $0 incremental (already T6.5 Phase C). For the 4 NOT_SAFE, **negative-value** (customer regression).

**适用场景 (when Option C is right)**:
- For the 23 stubbed: always (this is T6.5 Phase C's job, runs regardless)
- For the 4 NOT_SAFE: never within current product roadmap; would require a separate "sunset SmartBI Analysis" product decision orthogonal to F999

**Conclusion on Option C**: not a real third choice for this spec. The 23-stubbed deletion path is already the T6.5 Phase C plan. The 4 NOT_SAFE deletion path is a customer-facing product decision that this spec is not authorized to make. **Option C is dropped from the active comparison.**

---

## 4. Decision matrix

Score each Option against axes that matter. Scale: 5 = best, 1 = worst.

| Axis | Weight | Option A (stay 410 / Java) | Option B (route to Python) |
|---|---|---|---|
| Engineering effort cost | 30% | 5 (zero) | 2 (1.5-5d depending on data path) |
| Revert cost if wrong | 15% | 5 (no commitment to revert) | 4 (nginx revert easy; social revert harder) |
| F999 testing utility | 15% | 2 (F999 cannot exercise endpoints) | 4 (F999 testable IF data populated) |
| Customer impact | 20% | 5 (none) | 5 (none — F999 not customer-bearing) |
| Code clarity / mental model | 10% | 3 (two-tier exception persists) | 4 (uniform routing) |
| Phase D / cleanup compatibility | 10% | 4 (Phase D unaffected) | 4 (Phase D unaffected; helps method-body removal narrative) |
| **Weighted total** | **100%** | **4.20** | **3.40** |

**Tie-breakers**:

- F999 testing utility is the single biggest pull toward Option B. **Has the gap actually been felt?** Per Decision 2A acceptance log (PR #181 pre-flight), internal team explicitly accepted the gap. No follow-up demand has been raised in 6+ days post-cutover. Empirically the gap is small.
- Engineering effort cost is the single biggest pull toward Option A. Even the lowest-cost Option B variant (1.5d nginx + accept-empty) consumes a sister chat slot that could go to higher-value work (e.g. Phase 2B Tier 5 candidates, T6.6 Phase B Sub-A real-DB ETL, or T6.5 Phase C orphan delete sweep).
- Real-DB binding (Q1 amendment per PR #223) makes Option B for the 4 NOT_SAFE endpoints structurally harder — F999 has no real restaurant data, so Python serving F999 production/quality returns empty. Empty data is **worse than 410** for testing UX (looks-broken vs explicitly-gone).

**Result**: Option A wins 4.20 vs 3.40. Tie-breakers reinforce.

---

## 5. Recommendation

### 5.1 The decision

**Option A — F999 stays on 410 for the 23 stubbed endpoints AND falls through to Java for the 4 NOT_SAFE endpoints (both pre- and post-T6.6 Phase B cutover for the 75-customer cohort).**

### 5.2 Concrete operational meaning

| Surface | F999 behavior | Why |
|---|---|---|
| 23 stubbed endpoints (pre T6.5 Phase C method-body removal) | 410 SMARTBI_MIGRATED | Decision 2A unchanged |
| 23 stubbed endpoints (post T6.5 Phase C method-body removal) | Spring default 404 | T6.5 Phase C runs regardless of this spec |
| 4 NOT_SAFE endpoints (current state) | Java-served (mock generator + intent service) | nginx regex doesn't include F999; falls through to Java |
| 4 NOT_SAFE endpoints (post T6.6 Phase B Python impl + 75-cohort cutover) | **Still Java-served** | nginx regex still doesn't include F999; T6.6 Phase B Sub-G ratifies "no F999 inclusion" |
| 4 NOT_SAFE Java method bodies (post T6.6 Phase D) | **Cannot delete** without F999 nginx flip | Java method bodies stay alive for F999 fallthrough — same as today |

### 5.3 What this binds about Phase D

Phase D for the 4 NOT_SAFE endpoints (Java method body removal) becomes **conditional**:
- Either F999 is also flipped to Python at some future date (Option B reconsideration), THEN Phase D Java removal can proceed
- OR Phase D for the 4 NOT_SAFE is deferred indefinitely and the controller methods stay alive as F999-only fallback paths

This is acceptable because the 10 analysis service class files are KEEP forever anyway (per PR #178 §3.2.a — Dashboard composite caller). Keeping 4 controller method bodies alive on top of already-alive service impls is small incremental maintenance burden.

### 5.4 Revisit triggers

Option A should be reconsidered (potentially flipping to Option B) when **any** of these fire:

1. F999 internal team raises a concrete need — e.g., a new demo / customer pitch requires F999 to serve SmartBI Analysis live.
2. T6.6 Phase D completion is gated only on F999 flip (i.e., Phase D becomes valuable enough that 1.5-5d Option B work is justified).
3. Phase 2C SmartBI Config / Dashboard / Upload / PublicDemo (PR #152) ports require F999 cohort coverage anyway, making Option B a free byproduct.
4. A net-new internal tool emerges that needs F999 to behave like a "normal" customer factory across all SmartBI surfaces (rare).

If none of these fire within 6 months (≈ Q4 2026), Option A becomes the de facto permanent state. Document closure in a follow-up "F999 deprecation" ticket if appropriate.

---

## 6. Implementation plan

### 6.1 If Option A (chosen — recommended)

**Action items**: NONE.

This is a ratification doc, not a change request. Sub-O's deliverable is this PR, which serves as the durable decision record so future organizers don't re-litigate.

| Step | Owner | Trigger |
|---|---|---|
| Merge this spec PR | organizer admin-merge | After Steve approval |
| Update PR #249 §3 Sub-G reference | organizer | Same PR or follow-up: replace `2026-XX-XX-t6-6-f999-decision-record.md` placeholder with `2026-05-15-f999-smartbi-analysis-migration-decision-spec.md` actual filename |
| Update T6.6 Phase B Sub-G dispatch | organizer when T6.6 Phase B fires (~Aug 2026) | At dispatch: "Sub-G is closed by `2026-05-15-f999-smartbi-analysis-migration-decision-spec.md` — Option A. No code work; cohort regex stays without F999." |
| Update `2026-05-09-t6-6-f999-python-migration-spec.md` §2.5 | organizer follow-up | Annotate that spec as "Option B implementation reference, NOT the chosen path; see decision spec `2026-05-15-f999-...`" — single line at top of §2.5 |

### 6.2 If Option B (rejected per recommendation, but documented for completeness)

If Steve overrides the recommendation and chooses Option B, the implementation path is already documented in `2026-05-09-t6-6-f999-python-migration-spec.md` §2.5 (nginx regex amendment) + §3.3 (cutover steps). The decision-record-specific addition would be:

| Step | Effort | Notes |
|---|---|---|
| Decide F999 data path (a/b/c per §3.2 cons) | 0.5d organizer-side | Pick: ETL existing Java-side data / accept empty / synthetic seed |
| Land nginx regex amendment with F999 added | 0.5d | Mirrors T6.4 5-stage cascade pattern; backup vhost; `nginx -t`; reload |
| Smoke 27 endpoints × F999 | 0.5d | Active-E2E per HARD rule; no 24h soak |
| Update Phase D readiness gate | 0.5d | T6.6 Phase D Java method body removal now unblocked for the 4 NOT_SAFE (same trigger as 75-cohort 30-day soak) |

Total Option B: 2 person-days minimum + data-path effort (0d / 1d / 3d depending on choice).

This work could integrate into T6.6 Phase B as Sub-G impl (rather than Sub-G decision-doc) OR land as a standalone Phase 2B Tier 5 candidate per PR #152.

### 6.3 If Option C (rejected)

For the 23 stubbed: T6.5 Phase C handles it. No Sub-O action.
For the 4 NOT_SAFE: out of scope for this decision; would require product-side input.

---

## 7. Open questions for Steve / fresh organizer

1. **Acceptance of Option A**: does Steve agree with the recommendation to keep F999 on status-quo 410 / Java fallthrough for the 4 NOT_SAFE endpoints? If no, which option would Steve prefer and why? (Defaults to Option A on no objection.)

2. **F999 internal team explicit re-confirmation**: PR #181 §⛔ pre-flight noted F999 team "confirmed acceptance" pre-cutover. Is there a re-confirmation channel post-Decision 2A (6+ days) where internal team can flag if 410 has caused concrete pain? If yes, where (Slack channel, internal ticket queue)?

3. **Phase D conditional gate** (per §5.3): does Steve accept that T6.6 Phase D removal of the 4 NOT_SAFE controller method bodies is **deferred indefinitely** under Option A — i.e., the methods stay alive as F999-only fallback paths? Or does Steve want Phase D forced through (which would require flipping to Option B)?

4. **Annotation of `2026-05-09-t6-6-f999-python-migration-spec.md`**: that spec implicitly recommends Option B (assumes F999 in nginx regex). Should it be (a) annotated with a top-of-§2.5 banner pointing to this decision spec and clarifying it's Option B reference only, (b) deprecated outright if Option A holds for ≥6 months, or (c) kept as-is with cross-reference only?

5. **Revisit cadence**: should this decision get a calendar-based revisit (e.g., re-evaluate at T6.6 Phase D close-out, ≈ Q4 2026)? Or only event-driven per §5.4 triggers? Recommendation: event-driven only — no calendar revisit. But Steve's call.

6. **PR #249 Sub-G dispatch update**: PR #249 §3 Sub-G currently describes a 0.5-person-day decision-doc effort. With Option A ratified, Sub-G becomes a 0-person-day reference-and-close. Should T6.6 Phase B MO (PR #249) be amended in a follow-up PR to remove Sub-G as a dispatch-able sub-batch and convert it to a §1 "DECIDED" reference row? (The 8-batch table becomes 7-batch.)

---

## 8. Cross-references

### 8.1 Predecessor docs

- `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` (PR #178) — §3.1.a F999 row + §3.1.b /data-date-range + §6.1 Phase B scope + §8.1 Open Question 2 (Option A vs B for stub) + §6.4 T6.6 candidate flag
- `docs/superpowers/dispatch/2026-05-15-t6-5-phase-b-execute-marching-order.md` (PR #181, dispatch — has §⛔ pre-flight F999 acceptance gate)
- T6.5 Phase B PR #205 — `feat(t6-5-phase-b): stub 23 SmartBI Analysis endpoint methods to 410 Gone` — the Decision 2A implementation
- `docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md` — implementation spec for Option B path (has nginx regex amendment + per-endpoint port plan)
- `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` (PR #196) — T6.6 design overall, including F999 status open question
- `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` (PR #223) — Q1 real-DB binding makes F999 production/quality data-path harder under Option B (per §3.2 cons)
- `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` (PR #249) — §3 Sub-G placeholder this spec closes; §5 Q-6 pre-flight gate

### 8.2 Java surface references

- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` — 26 endpoint methods (22 stubbed + 4 NOT_SAFE)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java::getDataDateRange` (line 345) — 1 stubbed
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ProductionAnalysisServiceImpl.java` — alive for Java + Dashboard composite
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java` — same
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DynamicAnalysisServiceImpl.java` — same (`/query` + `/drill-down`)

### 8.3 Python surface references

- `backend/python/smartbi_compat/api/analysis_*.py` — 14 modules covering all 22 SAFE_NGINX_ROUTED endpoints for the 75-customer cohort (Phase 2A 100% close per PR #175)
- `backend/python/smartbi_compat/api/dashboard.py:84` — `/data-date-range` for the 75-cohort (Sub-J of T6.5 Phase C)
- `backend/python/smartbi_compat/api/analysis_drilldown.py` — `/drill-down` mirror exists, just not nginx-routed (per PR #178 §3.1.a footnote)
- `backend/python/smartbi_compat/intent/` — does NOT exist; T6.6 Phase B Sub-C will create it (per PR #202 detail spec)

### 8.4 Operational reference

- nginx vhost: server 139, `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` — current cohort regex per PR #178 §2.2
- F999 data: lives in `cretas_prod_db.smart_bi_*` (Java side), NOT in `smartbi_prod_db.smart_bi_*` (Python side)
- Java SmartBI prod port: 10010 (`cretas-backend.service`)
- Python SmartBI prod port: 8083 (`cretas-python.service`)

### 8.5 Memory references

- `feedback_pause_before_deploy_or_push.md` — STOP-and-ping organizer before any push
- `feedback_concurrent_edit_safety.md` — Rule 5b paths-only commit
- `feedback_active_e2e_replaces_passive_soak.md` — pre-customer-return state, no passive soak
- `feedback_dispatch_on_technical_readiness.md` — fire dispatch on technical readiness, not calendar
- `project_2026_05_09_phase_2a_complete.md` — Phase 2A 75/75 cutover record (75-customer cohort, F999 excluded)
- `project_2026_05_09_t6_5_phase_a_close.md` — T6.5 Phase A deletion-candidate audit shipping context

---

## 9. ⛔ HOLD blocks

- ⛔ **Doc only** — this PR adds one decision-record file under `docs/superpowers/specs/`. No code changes, no nginx mutations, no deploys, no migrations.
- ⛔ **STOP-and-ping organizer BEFORE push** per memory `feedback_pause_before_deploy_or_push.md`. Steve coordinates multi-worktree merges; do not push without explicit GO.
- ⛔ **Safe-commit Rule 5b paths-only mode** per memory `feedback_concurrent_edit_safety.md` §5b. Commit only this single spec file; verify `git show --name-only HEAD` post-commit.
- ⛔ **No T6.6 Phase B kickoff implication.** Merging this spec does NOT trigger T6.6 Phase B dispatch. PR #249 §⛔ pre-flight gates remain authoritative for that.
- ⛔ **No retroactive Decision 2A change.** This spec ratifies Decision 2A's effect on F999 going forward; it does NOT alter PR #205's already-merged 410 behavior or the 23 stubbed methods.

---

## 10. Sign-off

Before merge, this spec reviewed by:

- [ ] Engineering organizer (recommendation acceptable; Phase D conditional gate per §5.3 acknowledged)
- [ ] Steve (final Option A vs B choice; §7 open questions resolved)
- [ ] T6.6 Phase B MO author (PR #249 §3 Sub-G filename pointer updated; §5 Q-6 marked decided)

Sign-off recorded in PR description when this spec lands.

---

**End of F999 SmartBI Analysis Long-Term Migration Decision Record.**
