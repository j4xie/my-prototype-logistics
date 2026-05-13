# Phase 2C Tier 2 — Dashboard Remaining Endpoints Port-Readiness Audit

**Date**: 2026-05-14
**Branch**: `audit/phase-2c-tier-2-dashboard-8-port-readiness`
**Author**: chat2 (organizer-dispatched, doc-only audit)
**Worktree base**: `origin/main` HEAD `727d9298b` (post PR #560 F006 coverage iter 7)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java`
**Predecessors (canonical, must-cite)**:
- PR #178 — T6.5 Phase A audit v3.1 — establishes `/data-date-range` as the only Tier-2 stub candidate
- PR #205 — T6.5 Phase B execute — stubs `/data-date-range` to 410, leaves 10 alive
- PR #206 — Phase 2C Tier 2 design (11 endpoints — count taken pre-Sub-A delete)
- PR #236 — T6.5 Phase C Sub-A — physically deletes `getDataDateRange` method
- **PR #261 — T6.5 Phase C Sub-M — canonical KEEP audit, all 10 Dashboard endpoints `KEEP_FOR_COMPOSITE_DASHBOARD`**
- PR #284 — Phase C chat2 post-Sub-M E2E QA — 🟢 GO no regression across all 10
- **PR #385 — Phase 2C Tier 2 PILOT — ports 3 of 10 composites to Python under AGGRESSIVE-REVISED scope, explicitly CUTs the other 7-8 "speculative siblings"**
- PR #271 — T6.5 Phase C Sub-S — "3rd premise drift caught" same-pattern audit-only no-op
- PR #522 — May 13 corrected state map — explicitly records "Phase 2C: T1+T2 pilots live (#379/#385)"

---

## §0 TL;DR

**Classification**: 10 alive endpoint methods → already split by two prior shipped PRs:

| Bucket | Count | Endpoints | Source of decision |
|---|---:|---|---|
| **Ported to Python** | 3 | `/dashboard/executive`, `/dashboard/executive/custom`, `/dashboard` | PR #385 (May 12 pilot, AGGRESSIVE-REVISED) |
| **KEEP_FOR_COMPOSITE_DASHBOARD (Java)** | 7 | `/generate-adaptive-charts`, `/generate-chart`, `/dashboard/executive/insights`, `/dashboard/executive/insights/custom`, `/dashboard/executive/insights/custom/stream`, `/analysis/dynamic/kpis`, `/analysis/dynamic` | **PR #261 canonical (all-KEEP)** + PR #385 body §"CUT 8 speculative siblings" + PR #178 §3.1 / PR #184 §2 / PR #205 commit msg "Untouched 10 alive Dashboard endpoints" |
| Already deleted | 1 | `/dashboard/data-date-range` | PR #205 stub → PR #236 method delete |

**Headline finding** — **4th premise drift caught in same dispatch family** (1st = Sub-L PR #262, 2nd = Sub-M PR #261, 3rd = Sub-S PR #271, **4th = this audit**):

> The marching order's premise — that the 8 (sic) remaining Tier-2 endpoints' KEEP-vs-PORT-vs-SUNSET state is "unclear" — is itself the drift. The state was authoritatively decided three days ago by **PR #261 Sub-M (all 10 KEEP)** then partially overridden two days ago by **PR #385 (3 of 10 ported)**. The remaining 7 inherit Sub-M's KEEP verdict, **reinforced** by PR #385 body's explicit "**CUT 8 speculative siblings (adaptive-chart / dynamic / SSE alias / KPI-only / etc)**" annotation.
>
> A secondary drift in the MO itself: the count is **7 remaining**, not 8. The MO body §3 ("余下 7 endpoints") is correct; the MO title/scope-line ("剩 8 endpoints state unclear") double-counts `/dashboard/data-date-range`, which was already physically removed by PR #236. Filename `dashboard-8-readiness.md` is retained for MO-filename searchability; doc body uses the corrected count of 7.

**Recommended action**: **NO source changes**. This audit is the same structural template as PR #261 / PR #271 / PR #522 — **doc-only no-op, drift-catch + canonical re-affirmation**. The Phase 2C Tier 2 "remaining endpoints" cohort is closed: 3 ported, 7 KEEP, 1 deleted. The Phase 2C Tier 2 bucket has no port work left unless customer dependency escalates on a specific endpoint.

**STOP-and-ping organizer**: This MO as framed assumed a decision still owed; the decision is already made on `origin/main` two PRs deep. The audit doc is sufficient deliverable; **organizer GO required** before any cohort-level next-step (e.g., dispatching Tier-3 Upload port per spec PR #201, or T6.5 Phase D 30-day soak observation per PR #258).

### §0.1 Decision matrix (one-line per endpoint)

| # | Endpoint | Verdict | Driver |
|---|---|---|---|
| 1 | POST `/generate-adaptive-charts` | KEEP | PR #261 §2.2 + PR #385 explicit CUT-list + 0 web/RN callers |
| 2 | POST `/generate-chart` | KEEP | PR #261 §2.2 + PR #385 explicit CUT-list + 0 web/RN callers |
| 3 | GET `/dashboard/executive/insights` | KEEP | PR #261 §2.2 + Dashboard.vue:957 live caller + LLM proxy to Python (no Java logic worth porting) |
| 4 | GET `/dashboard/executive/insights/custom` | KEEP | PR #261 §2.2 + Dashboard.vue:956 live caller + LLM proxy to Python |
| 5 | GET `/dashboard/executive/insights/custom/stream` | KEEP | PR #261 §2.2 + Dashboard.vue:994 EventSource live caller + SSE proxy infra reuse (Python `/api/smartbi/insights/custom/stream` is upstream, Java is thin alias — spec PR #206 §SSE-infra-reuse) |
| 6 | GET `/analysis/dynamic/kpis` | KEEP | PR #261 §2.2 + PR #385 explicit CUT-list + 0 web/RN callers |
| 7 | GET `/analysis/dynamic` | KEEP | PR #261 §2.2 + upload.ts:447 live caller + DB-cached, immutable upload snapshot — no parity gain |

**ROI matrix collapses to**: PORT cost = ~6-8 weeks per spec PR #206 §6.2, PORT value = ~0 (3 of 7 have no callers; 4 of 7 are thin proxies or single-call wrappers). **Net: PORT NPV negative; KEEP wins on every endpoint**.

---

## §1 Methodology

Five-axis verification per PR #261 §1 template + PR #271 §"4-axis matrix" template + HARD rule `feedback_audit_endpoint_impl_not_router.md`:

1. **Enumerate live endpoints** in `SmartBIDashboardController.java` via grep `@(Get|Post|Put|Delete|Patch)Mapping` → **10 methods** (confirms PR #261 + PR #284 enumeration; one less than PR #206 spec because `getDataDateRange` was removed by PR #236).
2. **Cross PR #385 ported set** (3 composites) → leaves 7 remaining.
3. **For each of the 7**, verify five orthogonal axes:
   - **Axis A — Sub-M (PR #261) canonical verdict** for this method (re-read of audit doc §2.2)
   - **Axis B — PR #385 body explicit CUT-list** (verbatim: "CUT 8 speculative siblings (adaptive-chart / dynamic / SSE alias / KPI-only / etc)")
   - **Axis C — Python `@router` equivalent** (grep `backend/python/smartbi_compat/api/` + `backend/python/smartbi/api/` for matching path patterns)
   - **Axis D — nginx routing to Python** (per PR #184 §2 line 79 canonical table — none Tier-2 endpoints are in T6.4 / T6.6 regex)
   - **Axis E — frontend callers** (grep `web-admin/src/` + `frontend/CretasFoodTrace/src/`)
4. **Cross-check with PR #284** post-Sub-M E2E QA — confirms all 10 endpoints alive May 10 (📸 + network log evidence).
5. **Verdict per endpoint**: **KEEP** if (Axis A says KEEP) AND (Axis B says CUT or transitively KEEP-by-omission) AND (Axis C is zero) AND (Axis D out-of-regex). Single condition suffices to flip to PORT only if frontend caller count is materially high AND customer-visible value justifies port cost. None of the 7 meet that bar.

### §1.1 MO premise drift documentation (per HARD rule `feedback_gh_pr_search_before_dispatch_outstanding.md`)

**MO premise** (verbatim):
> Phase 2C Tier 2 = SmartBIDashboardController 11 endpoints. PR #385 pilot 已 port 3 composite dashboards. Spec PR #206 covers all 11. 剩 8 endpoints state unclear — KEEP (per T6.5 OUT-OF-SCOPE) 或 PORT?

**Three orthogonal drifts**:

| Drift | What MO says | What `origin/main` says | Source |
|---|---|---|---|
| **D1: endpoint count** | "11 endpoints … 剩 8" | 10 live + 1 deleted = 11 historical, but Tier-2-remaining bucket size is **7** (not 8). 1 of the 8 in MO is the deleted `data-date-range`. | PR #236 method delete, confirmed via grep `data-date-range` over `backend/java/cretas-api/src/main` returning 0 hits |
| **D2: state "unclear"** | "state unclear — KEEP 或 PORT" | State authoritatively decided. Sub-M (PR #261, May 10) classified all 10 as KEEP_FOR_COMPOSITE_DASHBOARD. PR #385 (May 12) ported 3 under Phase 2C Tier 2 pilot but explicitly CUT the other 8 (= the 7 here + KPIsOnly) as "speculative siblings". | PR #261 §0 verdict table + PR #385 body §"AGGRESSIVE-REVISED scope" |
| **D3: spec PR #206 "covers all 11"** | Implies design coverage = port intent | PR #206 was design-only doc with 7 open questions for reviewer. Q-1 through Q-7 were never answered before PR #385 shipped under AGGRESSIVE-REVISED scope. PR #385 superseded PR #206 for the 3 endpoints it picked up; remaining 7 are NOT covered by an active port spec. | PR #206 body §"Test plan" `[ ] Operator answers Q-1 through Q-7 before Tier 2-B kickoff` (unchecked) |

**Cost of executing flawed premise** (had this audit not caught it):

- 7 alive endpoints would be re-scoped for porting against canonical KEEP decision → ~3,200 LOC + ~6-8 weeks across 4 sister chats per spec PR #206 §6.2 estimate (excluding SSE alias).
- 4 of 7 endpoints have **single web-admin caller** (`Dashboard.vue` page or `upload.ts` post-upload analyze) — port introduces dict-eq parity risk on customer-visible 经营驾驶舱 main page without commensurate value.
- 3 of 7 endpoints have **0 callers** — port produces dead Python code; PR #385 already excluded these per its CUT-list, so re-introducing them would directly contradict shipped AGGRESSIVE-REVISED scope decision.
- SSE alias (`/insights/custom/stream`) is **already a thin Java proxy** to existing Python `/api/smartbi/insights/custom/stream` (spec PR #206 §"SSE infra reuse discovery") — porting the Java alias would mean either deleting it (breaks Dashboard.vue:994 EventSource) or building a Python "alias to itself" (architecturally nonsense).
- Risk row PR #178 §5.1: NOT_SAFE_FALLTHROUGH × 75 factories regression — same row Sub-M (PR #261) and Sub-S (PR #271) caught; this is 4th hit.

**Per HARD rule** `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (graduated 2026-05-09 after Sub-M / Sub-L / Sub-S 3-strike) + `feedback_gh_pr_search_before_dispatch_outstanding.md` (graduated 2026-05-13 after R2/T6.5-B/T6.6.1 3-strike), this audit reports the verified ground truth rather than executing the flawed premise.

---

## §2 Endpoint inventory + per-endpoint analysis

### §2.1 Full controller enumeration (after PR #236 delete)

| # | Java line | HTTP | Path | Bucket | Bucket source |
|---|---:|---|---|---|---|
| 1 | 93-115 | POST | `/generate-adaptive-charts` | **KEEP (remaining)** | this audit + PR #261 |
| 2 | 117-152 | POST | `/generate-chart` | **KEEP (remaining)** | this audit + PR #261 |
| 3 | 156-187 | GET | `/dashboard/executive` | Ported | PR #385 |
| 4 | 189-209 | GET | `/dashboard/executive/insights` | **KEEP (remaining)** | this audit + PR #261 |
| 5 | 211-236 | GET | `/dashboard/executive/insights/custom` | **KEEP (remaining)** | this audit + PR #261 |
| 6 | 246-317 | GET (SSE) | `/dashboard/executive/insights/custom/stream` | **KEEP (remaining)** | this audit + PR #261 |
| 7 | 319-346 | GET | `/dashboard/executive/custom` | Ported | PR #385 |
| 8 | 348-426 | GET | `/dashboard` | Ported | PR #385 |
| 9 | 435-456 | GET | `/analysis/dynamic/kpis` | **KEEP (remaining)** | this audit + PR #261 |
| 10 | 460-534 | GET | `/analysis/dynamic` | **KEEP (remaining)** | this audit + PR #261 |
| H1 | 541-589 | (private) | `enrichUnifiedDashboard` | KEEP (helper of #8) | PR #261 §H1 |

Line numbers verified against `727d9298b` (this audit base).

### §2.2 Per-endpoint analysis — 7 remaining

#### §2.2.1 POST `/generate-adaptive-charts` (Java line 93-115)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Explicit member of "adaptive-chart" CUT |
| C — Python @router | 0 matches in `backend/python/smartbi*/api/` |
| D — nginx regex | Out-of-regex (PR #184 §2 line 79) |
| E — frontend callers | **web-admin: 0** (grep `generate-adaptive-charts` over `web-admin/src/` = 0 hits) / **RN: 0** |
| Java LOC | 23 lines (95-114 body) |
| Java service dependency | `AdaptiveChartGenerator` (optional, `@Autowired(required = false)`) |

**Verdict: KEEP**. 0 production traffic. Java-only by design (analytics:read_write internal). PR #385 explicitly CUT. No customer-visible regression risk from leaving as-is.

#### §2.2.2 POST `/generate-chart` (Java line 117-152)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Member of CUT (sibling of #2.2.1) |
| C — Python @router | 0 matches |
| D — nginx regex | Out-of-regex |
| E — frontend callers | **web-admin: 0** / **RN: 0** |
| Java LOC | 35 lines |
| Java service dependency | `AdaptiveChartGenerator` (optional) |

**Verdict: KEEP**. Same profile as §2.2.1.

#### §2.2.3 GET `/dashboard/executive/insights` (Java line 189-209)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Implicit KEEP (not in 3 ported, not in CUT-list as named "SSE alias" or "KPI-only" — sits in residual KEEP bucket) |
| C — Python @router | 0 matches (Python has `/api/smartbi/insights/*` family but Java this path delegates to `SmartBIService.getDashboardLLMInsights` orchestrator, no direct mirror) |
| D — nginx regex | Out-of-regex |
| E — frontend callers | **web-admin: `views/smart-bi/Dashboard.vue:957`** (period-based fallback when no custom date) / **RN: 0** |
| Java LOC | 20 lines |
| Java service dependency | `SmartBIService.getDashboardLLMInsights` (optional, `@Autowired(required = false)`) |

**Verdict: KEEP**. Single live caller on the main 经营驾驶舱 page. Java method is thin Spring orchestration (try/catch wrapping a `SmartBIService` call that returns empty list on null service) — porting yields no parity-gain. No port pressure.

#### §2.2.4 GET `/dashboard/executive/insights/custom` (Java line 211-236)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Implicit KEEP (sibling of §2.2.3, custom-date variant) |
| C — Python @router | 0 matches (sibling of §2.2.3 — same orchestrator path) |
| D — nginx regex | Out-of-regex |
| E — frontend callers | **web-admin: `views/smart-bi/Dashboard.vue:956`** (custom date range path) / **RN: 0** |
| Java LOC | 26 lines |
| Java service dependency | `SmartBIService.getDashboardLLMInsightsCustomRange` |

**Verdict: KEEP**. Same as §2.2.3 with custom date range.

#### §2.2.5 GET `/dashboard/executive/insights/custom/stream` — SSE (Java line 246-317)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Explicit "SSE alias" member of CUT |
| C — Python @router | **Upstream Python already exists** at `/api/smartbi/insights/custom/stream` (per `backend/python/agent/api.py:83`, cited in spec PR #206 §SSE-infra-reuse-discovery) — Java endpoint is a thin proxy/alias |
| D — nginx regex | Out-of-regex |
| E — frontend callers | **web-admin: `views/smart-bi/Dashboard.vue:994`** (EventSource open) / **RN: 0** |
| Java LOC | 72 lines (most are OkHttp Response cleanup + SSE relay loop) |
| Java service dependency | `AgentInsightsClient` (optional) |

**Verdict: KEEP** (with architectural note). This endpoint is **already a Java→Python alias proxy** — the actual SSE infrastructure lives in Python. Porting the Java alias either (a) requires deleting it (breaks `Dashboard.vue:994` EventSource URL, which is hardcoded `/api/mobile/.../dashboard/executive/insights/custom/stream`), or (b) requires building "Python alias to Python self" which is architecturally nonsense. PR #385 was right to CUT this from port scope. If Dashboard.vue eventually migrates to call the Python URL directly, this Java alias becomes deletable — but that is a follow-up tracked under T6.5 Phase D 30-day soak observation, not a Phase 2C Tier 2 port concern.

#### §2.2.6 GET `/analysis/dynamic/kpis` (Java line 435-456)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Explicit "KPI-only" member of CUT |
| C — Python @router | 0 matches |
| D — nginx regex | Out-of-regex |
| E — frontend callers | **web-admin: 0** (grep `analysis/dynamic/kpis` over `web-admin/src/` = 0 hits) / **RN: 0** |
| Java LOC | 22 lines |
| Java service dependency | `DynamicAnalysisService.getKPIsOnly` (optional) |

**Verdict: KEEP**. 0 production traffic. AUDIT-052 lightweight variant of #2.2.7 — Java-only by design as "ideal for dashboard loading where only headline numbers are needed" per its own javadoc, but no current frontend client uses it. PR #385 explicitly CUT.

#### §2.2.7 GET `/analysis/dynamic` (Java line 460-534)

| Axis | Finding |
|---|---|
| A — Sub-M PR #261 verdict | KEEP_FOR_COMPOSITE_DASHBOARD |
| B — PR #385 CUT-list | Implicit KEEP (not in 3 ported; "dynamic" mentioned in CUT-list parenthetical as deferred) |
| C — Python @router | 0 matches (DB-cached `SmartBiPgAnalysisResultRepository`-backed, Java-specific cache impl) |
| D — nginx regex | Out-of-regex |
| E — frontend callers | **web-admin: `api/smartbi/upload.ts:447`** (post-upload analyze entry-point) / **RN: 0** |
| Java LOC | 74 lines (most are FIX-13 cache lookup/write logic + force-refresh semantics) |
| Java service dependency | `DynamicAnalysisService.analyzeDynamic` + `SmartBiPgAnalysisResultRepository` cache |

**Verdict: KEEP**. Single live caller. Heavy Java-side caching (FIX-13: 7-day TTL on immutable upload snapshots, force-refresh bypass) that has no Python equivalent — porting would require either re-implementing the cache layer in Python (~74 LOC + parity test infrastructure) or accepting a cache cold-start regression on every refresh. Not worth port cost for single-caller endpoint.

### §2.3 Caller grep raw output (axis E verification)

```bash
$ grep -rnE 'smart-bi/(dashboard/executive/insights|generate-adaptive-charts|generate-chart|analysis/dynamic)' web-admin/src/ frontend/CretasFoodTrace/src/
web-admin/src/api/smartbi/upload.ts:447:  return get<DynamicAnalysisResponse>(`${getSmartBIBasePath()}/analysis/dynamic`, {
web-admin/src/views/smart-bi/Dashboard.vue:956:      ? `/${factoryId.value}/smart-bi/dashboard/executive/insights/custom?startDate=${effectiveRange[0]}&endDate=${effectiveRange[1]}`
web-admin/src/views/smart-bi/Dashboard.vue:957:      : `/${factoryId.value}/smart-bi/dashboard/executive/insights?period=month`;
web-admin/src/views/smart-bi/Dashboard.vue:994:  const url = `/api/mobile/${factoryId.value}/smart-bi/dashboard/executive/insights/custom/stream?startDate=${startDate}&endDate=${endDate}`;
```

**Summary**: 4 web-admin callers across 3 endpoints; 3 endpoints have 0 callers; 0 RN callers across all 7. **Caller density consistent with PR #261 §2.2 May-10 snapshot — no drift since.**

---

## §3 ROI matrix (port cost vs. value per endpoint)

| Endpoint | Port cost (LOC + spec-est) | Port value (caller × visibility × parity-gain) | NPV |
|---|---|---|---:|
| `/generate-adaptive-charts` | ~500 LOC + 1 wk (chart-gen engine port) | 0 callers × 0 visibility | **-1 wk** |
| `/generate-chart` | ~300 LOC + 0.5 wk | 0 × 0 | **-0.5 wk** |
| `/dashboard/executive/insights` | ~150 LOC + 0.5 wk | 1 × medium (Dashboard.vue) × low (orchestrator pass-through, no Java logic) | **-0.4 wk** |
| `/dashboard/executive/insights/custom` | ~150 LOC + 0.5 wk | 1 × medium × low | **-0.4 wk** |
| `/dashboard/executive/insights/custom/stream` (SSE) | architecturally invalid — Python is already upstream | (alias-of-self) | **N/A** |
| `/analysis/dynamic/kpis` | ~200 LOC + 0.5 wk | 0 × 0 | **-0.5 wk** |
| `/analysis/dynamic` | ~600 LOC + 1.5 wk (cache layer re-impl + parity test) | 1 × medium (upload.ts) × low (cache layer needs full re-impl, parity-risk on FIX-13 immutability semantics) | **-1.4 wk** |
| **Total** | **~4.4 wk effort** | **near-zero** | **net -4.4 wk** |

Per spec PR #206 §6.2 the original Tier 2 estimate was 12 wk (10 PRs × ~1.2 wk avg). PR #385 collected ~3 wk of that (3 composite ports). The remaining estimated value of ~9 wk is overstated against current customer-visibility data — actual NPV is negative-4-to-9 wk depending on accounting.

**Conclusion**: PORT-NPV is structurally negative across all 7. KEEP-Java is the rational choice on cost-benefit grounds, fully aligned with already-shipped PR #385 AGGRESSIVE-REVISED scope decision.

---

## §4 Cross-source unanimity check

Five canonical sources, all unanimous on the 7 remaining = KEEP:

| Source | Verdict for 7 remaining | Quote |
|---|---|---|
| PR #178 §3.1 (May 9 Phase A audit) | KEEP_FOR_COMPOSITE_DASHBOARD | "11 endpoints. PARTIAL_STUB in Phase B for `/data-date-range` only; rest KEEP_FOR_COMPOSITE_DASHBOARD." |
| PR #184 §2 line 79 (May 9 nginx coverage) | Out-of-regex (= alive Java) | "All `SmartBIDashboardController` endpoints (`/dashboard/executive`, `/dashboard/executive/insights{,/custom{,/stream}}`, `/dashboard`, `/analysis/dynamic{,/kpis}`, `/generate-adaptive-charts`, `/generate-chart`, …)" |
| PR #205 commit msg (May 9 Phase B execute) | Alive Java traffic | "Untouched … plus 10 alive Dashboard endpoints (`/dashboard*`, `/generate-*`, `/analysis/dynamic*`)" |
| **PR #261 §0 (May 10 Sub-M canonical audit)** | **10 KEEP / 0 STUB / 0 DELETE** | "10 endpoint methods + 1 private helper → 10 KEEP / 0 STUB-410 / 0 DELETE / 1 KEEP private helper" |
| **PR #385 body (May 12 Tier 2 pilot)** | **3 PORT, 7-8 CUT (= KEEP-by-CUT)** | "CUT 8 speculative siblings (adaptive-chart / dynamic / SSE alias / KPI-only / etc)" |
| PR #284 (May 10 post-Sub-M E2E QA) | All 10 alive, 0 regression | "6/10 200 with valid DTO. 4/10 business-validation 400 (test uploadId rejected — endpoint alive, validation working, NOT regression). 0/10 returned 410/404/500." |
| PR #522 (May 13 corrected state map) | T1+T2 pilots live, no further port pending | "Phase 2C: T1+T2 pilots live (#379/#385), T3 spec only, T4 sunset done (#200/#222)" |

**0 dissenting sources**. **6 confirming sources**. **No additional port decision pending**.

---

## §5 Open questions (none blocking)

PR #206 spec listed Q-1 through Q-7 for operator response before Tier 2-B kickoff. AGGRESSIVE-REVISED scope (per PR #150 §6.1 + PR #385 body) made Q-1/Q-2/Q-3/Q-5/Q-6 moot by deciding "KEEP Java for the remaining 7" wholesale. Q-4 (strict-byte SSE) is naturally moot because SSE was CUT. Q-7 (chat coordination) was resolved by PR #385 single-chat ship.

**No new open questions raised by this audit.** All open questions arrived as a side-effect of premise-drift catch and are resolved by Sub-M PR #261 canonical + PR #385 ship.

---

## §6 Verdict + recommendation

1. **CLOSE Phase 2C Tier 2 port cohort.** All 11 historical endpoints have final disposition: 3 ported (PR #385), 7 KEEP (this audit + PR #261), 1 deleted (PR #205+#236).
2. **NO source changes** in this PR. Doc-only no-op, identical structural template to PR #261 / PR #271.
3. **MO premise drift documented** in §1.1 and §0 — same root cause as Sub-M / Sub-S / Strike 3 from PR #522 (dispatch premise drawn from spec / memory / mental-model instead of `gh pr view` + grep against `origin/main` head).
4. **Downstream unblock**: organizer dispatch may now move to Tier 3 (Upload, per spec PR #201 — prereq "T6.5 Phase C complete" already satisfied per PR #271 + #236) or T6.5 Phase D 30-day soak observation per PR #258, **without** any Tier 2 carry-over.
5. **Customer-traffic alarm not needed**: PR #284 E2E QA from May 10 plus PR #560 F006 iter-7 coverage push (May 13) confirm the Dashboard composite page is healthy on prod for all 75 factories.

### §6.1 Action items (none)

| Action | Owner | Status |
|---|---|---|
| Source change to controller | n/a | NOT APPLICABLE — audit-only no-op |
| Re-spec Tier 2 remaining 7 | n/a | NOT APPLICABLE — already classified KEEP |
| Customer-comm | n/a | NOT APPLICABLE — no behavior change |
| Deploy | n/a | NOT APPLICABLE — no code change |

---

## §7 Verification

- [x] `git status --short` clean — only this audit doc staged
- [x] `git diff --stat origin/main..HEAD -- backend/` → 0 files (verified before push)
- [x] `git diff --stat origin/main..HEAD -- docs/qa-audits/` → 1 file added
- [x] 5-axis verification per §1 methodology completed for all 7 remaining endpoints
- [x] Step 0 synonym-aware PR search per HARD rule completed pre-worktree (variants: "phase-2c-tier-2 OR dashboard port", "Tier 2 dashboard OR SmartBI dashboard python OR dashboard endpoint port", "phase-2c OR phase 2c", "Sub-M in:title", "dashboard 8 OR dashboard remaining") — 0 silent port found
- [x] PR #261 canonical audit doc read and cited verbatim from in-repo file `docs/qa-audits/2026-05-10-t6-5-phase-c-sub-m-dashboard-controller-audit.md`
- [x] PR #284 E2E evidence cited
- [x] PR #385 explicit CUT-list cited verbatim
- [x] PR #522 state map cited
- [ ] Reviewer confirms 4th-strike premise drift framing matches PR #261 / PR #271 / PR #522 template
- [ ] Reviewer confirms 5-axis matrix is sufficient evidence for KEEP verdict on each of 7 (no axis returns PORT signal)
- [ ] Organizer admin-merge after review

---

## §8 References

- **Canonical predecessors (must-cite)**:
  - PR #178 — T6.5 Phase A audit v3.1
  - PR #184 — nginx ↔ Python coverage cross-check
  - PR #205 — T6.5 Phase B 23-endpoint stub
  - PR #206 — Phase 2C Tier 2 design (11 endpoints, 7 open questions, AGGRESSIVE-REVISED-superseded)
  - PR #236 — T6.5 Phase C Sub-A method delete (removed `getDataDateRange`)
  - **PR #261 — T6.5 Phase C Sub-M canonical KEEP audit (all 10 endpoints)**
  - PR #271 — T6.5 Phase C Sub-S Config+Upload 54-KEEP (3rd premise drift, **template for this audit**)
  - PR #284 — Phase C chat2 post-Sub-M E2E QA (🟢 GO no regression)
  - **PR #385 — Phase 2C Tier 2 PILOT (3 composite ports + explicit CUT-list of 7-8 siblings)**
  - PR #522 — May 13 3-strike stale-MO + corrected state map
- **HARD rules invoked** (memory):
  - `feedback_audit_endpoint_impl_not_router.md` (Axis-A/B verification requires verifying endpoint impl, not router file)
  - `feedback_marching_order_method_name_grep.md` (organizer must grep real source before MO)
  - `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (HARD, 2026-05-09, 3-strike) — applied to MO premise audit §1.1
  - `feedback_gh_pr_search_before_dispatch_outstanding.md` (HARD, 2026-05-13, 3-strike) — applied to Step 0 search
  - `feedback_organizer_projection_bug.md`
- **Companion audits (same template)**: PR #261, PR #271, PR #522
