# SmartBI Cohort Parity Sweep — Phase 2A + Phase 2C Tier 1/2 Post-Cutover Verification

**Date**: 2026-05-12
**Author**: chat2 (organizer) + 3 dispatched subagents
**Trigger**: Verify Phase 2C Tier 1 (#379 `/thresholds`) + Tier 2 (#385 composite dashboards) + Tier 4 (#222 sunset) did not introduce regression in cohort factories.
**Scope**: Read-only parity sweep, no code changes, no prod writes.
**Predecessors**: PR #341 (Rule 17.1 Batch 1, merged), PR #379, PR #385, PR #222; T6.5 Phase C method-delete cascade.

---

## §0. TL;DR

✅ **No regression detected.** 6 cohort factories × 17 endpoints = 102 endpoint-runs across 3 parallel subagents. All endpoints serve `HTTP 200` from the correct backend after Phase C cutover.

⚠️ **Mission premise needs amendment** (convergent finding from all 3 subagents): T6.5 Phase C **already deleted** Java handlers for the 14 migrated paths. A naive `Java vs Python` dict-eq compare is structurally N/A — Java returns `404`, Python returns `200`. The `REAL_BUG` counts emitted by `scripts/parity-gate/compare.py` (4-7 per row) are envelope-mismatch artifacts (404-shell vs 200-data), not regressions.

⚠️ **Pre-existing coverage gap surfaced** (not caused by Phase 2C): `/analysis/finance?analysisType=overview` and `/analysis/inventory?analysisType=overview` return Python `501` stub `"尚未 port 到 Python，请回到 Java endpoint 或等待 phase2a/t-finance-perX 完成"`. Java side is also gone for these paths post-Phase-C → a UI calling `analysisType=overview` has no working backend. Predates Phase 2C, latent since Phase 2A. Recommended for follow-up issue.

📝 **Operational note**: Java prod 10010 is down; Java prod active on **10020** (Blue-Green green slot per `reference_blue_green_java_deploy.md`). All 3 subagents discovered this independently.

---

## §1. Post-Phase-C topology

| Path family | Owner | Java 10020 | Python 8083 |
|---|---|---|---|
| `/analysis/{sales,finance,department,region,inventory,procurement}` | **Python-only** | 404 | 200 |
| `/analysis/finance/{budget-achievement,yoy-mom,category-comparison}` | **Python-only** | 404 | 200 (with corrected params) |
| `/alerts`, `/recommendations`, `/datasource/list`, `/data-date-range`, `/query-templates` | **Python-only** | 404 | 200 |
| `/dashboard`, `/dashboard/executive`, `/dashboard/executive/custom` | **Java-only** | 200 | 404 |
| `/smartbi-config/thresholds` | **Java-only** | 200 | 404 |
| `/analysis/{production,quality}`, `/query`, `/drill-down` | Java-only (NOT_SAFE — KEEP) | 200 | 404 (out of scope) |

This confirms the F999 retest doc §1.1 prediction: Phase C deleted the 23 stubbed Java methods; the 4 NOT_SAFE handlers remain Java-side.

---

## §2. Factories tested

| Factory | Subagent | Profile | Data state |
|---|---|---|---|
| F001 | #1 | Cretas dev seed | Rich data |
| F006 (六腾门) | #1 | Real customer, 16 user accounts | Rich data |
| RES_GML_001 (桂满陇) | #2 | Real customer pilot | Has data |
| R_GML_DEMO | #2 | Real customer pilot | Has data |
| R_YJJ_DEMO | #3 | Cohort pilot | "Gold empty" |
| R_XMX_FRESH (唏嘛香) | #3 | Cohort pilot | "Gold empty" |

Coordination with chat3: chat3 is parallel-testing 餐饮 endpoints (`/analysis/production`, restaurant paths) on R_GML_DEMO + RES_3101_009. This sweep covers only SmartBI Analysis paths — no endpoint overlap.

---

## §3. Results (factory × endpoint)

For all 6 factories × 17 endpoints, the verdict pattern is identical:

| Endpoint | Verdict |
|---|---|
| `/analysis/sales` | ✅ Python 200 (Java 404 = post-Phase-C expected) |
| `/analysis/finance` | ✅ Python 200 (default params, no `analysisType=overview`) |
| `/analysis/finance/budget-achievement` | ✅ Python 200 with `?year=YYYY` (not `startDate/endDate`) |
| `/analysis/finance/yoy-mom` | ✅ Python 200 with `?periodType=MONTH&startPeriod=YYYY-MM&endPeriod=YYYY-MM&metric=<m>` |
| `/analysis/finance/category-comparison` | ✅ Python 200 with `?year=YYYY&compareYear=YYYY` |
| `/analysis/department` | ✅ Python 200 |
| `/analysis/region` | ✅ Python 200 |
| `/analysis/inventory` | ✅ Python 200 (default params) |
| `/analysis/procurement` | ✅ Python 200 |
| `/alerts` | ✅ Python 200 (empty list — expected) |
| `/recommendations` | ✅ Python 200 (empty list — expected) |
| `/datasource/list` | ✅ Python 200 |
| `/data-date-range` | ✅ Python 200 |
| `/query-templates` | ✅ Python 200 |
| `/dashboard` | ✅ Java 200 |
| `/dashboard/executive` | ✅ Java 200 |
| `/dashboard/executive/custom` | ✅ Java 200 |
| `/smartbi-config/thresholds` (global) | ✅ Java 200 |

**Gold-empty factories** (R_YJJ_DEMO, R_XMX_FRESH): Python returns expected payload with `YELLOW · 数据状态 · 当前时间范围内暂无销售数据` AI insight (matches Stage 5 cutover memory).

**Sample payload shapes** (R_GML_DEMO, RES_GML_001):
- `/analysis/sales` → `{overview, customerRanking, productRanking, dateRange, salespersonRanking}`
- `/analysis/finance` → `{overview, costStructure, dateRange, generatedAt, profitMetrics}`
- `/analysis/department` → `{completionRates, efficiencyMatrix, dateRange, generatedAt, ranking}`
- `/analysis/region` → `{heatmap, targetCompletion, dateRange, opportunityScores, generatedAt}`
- `/dashboard/executive` → `{period, startDate, endDate, kpiCards, metricCards, rankings, charts, chartList}`

No 500s, no timeouts, no auth failures across 102 runs.

---

## §4. REAL_BUG verdict

**Zero genuine REAL_BUG.** Re-classification of `compare.py` output:

| compare.py classification | Underlying cause | Real bug? |
|---|---|---|
| `http_mismatch` (Java 404 ↔ Python 200) | Phase C handler deletion (intentional) | ❌ No |
| `http_mismatch` (Java 200 ↔ Python 404) | Phase 2C scope did not include Java→Python port of dashboards | ❌ No |
| Envelope field divergence (`success`, `code`, `actionHint`, etc.) | One side returns Spring 404 shell, other returns full envelope | ❌ Artifact, not bug |

**No Python code fix required.** No PR patch beyond this audit doc.

---

## §5. Findings worth follow-up

### F-1 — `analysisType=overview` Python stub vs Java-gone
- `/analysis/finance?analysisType=overview` returns Python body `{code:501, message:"尚未 port 到 Python..."}`
- `/analysis/inventory?analysisType=overview` same
- Java side gone for both paths post-Phase-C
- **Risk**: a UI client calling `analysisType=overview` has no working backend; user sees a stub message
- **Origin**: Phase 2A scope decision (not Phase 2C regression)
- **Recommendation**: file an issue for either (a) finish `overview` Python port or (b) explicit UI handling to avoid the dead-end

### F-2 — Parity-gate harness Phase-C blindness
- `compare.py` emits inflated REAL_BUG counts for HTTP-mismatch rows post-cutover
- **Recommendation**: add a "routing-aware" verdict tier (e.g. `java_gone_intentionally`, `python_not_in_scope`) so future cohort/non-cohort sweeps don't pollute REAL_BUG counts
- Optional: a config file mapping path → owner (Python-only / Java-only / both) to short-circuit the irrelevant side
- Touched files would be `scripts/parity-gate/compare.py` + `scripts/parity-gate/dict_eq.py` + a topology preset

### F-3 — Parity-gate preset params drift
- Mission brief defaulted `startDate=&endDate=` for `/finance/{budget-achievement,yoy-mom,category-comparison}` — Python returns 422 because those endpoints expect different signatures
- **Canonical signatures** (per `backend/python/smartbi_compat/api/analysis_finance.py:3335-3411`):
  - `budget-achievement`: `?year=YYYY&metric=<m>`
  - `yoy-mom`: `?periodType=MONTH&startPeriod=YYYY-MM&endPeriod=YYYY-MM&metric=<m>`
  - `category-comparison`: `?year=YYYY&compareYear=YYYY`
- **Recommendation**: add a per-endpoint default-params preset to `scripts/parity-gate/` so future sweeps use canonical signatures

### F-4 — Java 10010 down; prod on 10020
- All 3 subagents discovered Java 10010 returns 000/not-bound; prod is on 10020 (`cretas-backend-green.service`)
- Consistent with Blue-Green deploy pattern (memory `reference_blue_green_java_deploy.md`)
- Documentation note only; not a finding

---

## §6. Evidence

- Per-endpoint compare.py JSON+HTML reports: `reports/2026-05-12-cohort-parity/` (210 files, NOT committed in this PR — referenced locally only, to keep PR size manageable)
- Server-side copies (subagent 3): `47.100.235.168:/tmp/parity-gate/reports/cohort-batch5/`
- Subagent IDs (for follow-up SendMessage if needed):
  - F001/F006: `a3a07c1ef5298176a`
  - RES_GML_001/R_GML_DEMO: `ab84427d58137fded`
  - R_YJJ_DEMO/R_XMX_FRESH: `a74b5a1c6f0ccab94`

---

## §7. Acceptance against mission brief

| Acceptance item | Status |
|---|---|
| 4-6 cohort factory × 50+ endpoint = 200+ endpoint-runs | ⚠️ 6 factories × 17 endpoints = 102 runs (the "50 endpoint" framing overcounted; Python actually exposes 17 GET endpoints in Phase 2A+2C scope; the rest are POST/PUT/DELETE writes that this sweep correctly skipped per HARD constraint) |
| 100% match OR fix PR | ✅ 100% serve correctly on correct backend; no fix needed (no REAL_BUG) |
| Report cites endpoint × factory × Java 100char × Python 100char for any diff | ✅ N/A — no genuine diffs to cite (HTTP-mismatch artifacts are explained in §4) |
| PR with report doc | ✅ This file |

---

## §8. Sign-off

- ✅ §0 TL;DR — no regression, premise amendment logged
- ✅ §1 Post-Phase-C topology confirmed
- ✅ §2 6 cohort factories tested
- ✅ §3 102 endpoint-runs, all 200 OK on correct backend
- ✅ §4 Zero REAL_BUG (re-classified from inflated compare.py counts)
- ✅ §5 4 follow-up findings logged (F-1 to F-4)
- ✅ §6 Evidence appendix
- ✅ §7 Acceptance reconciled
- [ ] Steve sign-off — pending
