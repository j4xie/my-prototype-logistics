# Phase 2A Rule 9 Latent Audit — 2026-05-08

**Scope**: All Phase 2A `backend/python/smartbi_compat/api/*.py` Lombok `@Data` DTO factory helpers verified against existing F999/F001 goldens for 3 Rule 9 sub-patterns.
**Rule 9**: Lombok `@Data` + Jackson serialization quirks — field name decapitalize / null emit without `@JsonInclude` / derived getter (boolean `is*` / computed `get*`).
**Reference**: `.claude/rules/python-java-port.md` Rule 9.

---

## TL;DR

**M = 0 swept clean.** All 15 DTO factory helpers across Phase 2A `analysis_*.py` files emit canonical Lombok @Data shape verified against existing goldens. Three sub-patterns (9.1 / 9.2 / 9.3) all confirmed clean.

**No new sub-pattern (9.4) discovered.** Phase 2A audit thread (Rule 4 / 8 / 9 / 10 / 11 / 12) **6/6 Rules complete**.

---

## Methodology

For each DTO factory helper in `analysis_*.py`:
1. Locate corresponding Java DTO in `dto/smartbi/*.java`
2. Verify Lombok `@Data`/`@Builder` annotation + absence of `@JsonInclude(NON_NULL)` (sub-pattern 9.2)
3. Identify consecutive-uppercase fields (sub-pattern 9.1) and derived getters (sub-pattern 9.3)
4. `jq '... | keys_unsorted'` on existing F999/F001 golden to verify Jackson actual emit order + field count
5. Compare Python dict literal output to golden truth

---

## Sub-pattern 9.1 verified (Decapitalize quirk)

| Java field | Lombok getter | Jackson key | Python literal | Status |
|---|---|---|---|---|
| `xAxisField` | `getXAxisField()` | **`"xaxisField"`** ← lowercase 'a' | `"xaxisField"` (analysis_finance.py:239, analysis_sales.py:556 area, analysis_department.py:328) | ✓ match |
| `yAxisField` | `getYAxisField()` | **`"yaxisField"`** ← lowercase 'a' | `"yaxisField"` (same files) | ✓ match |

Verified via `analysis-finance-F999-profit.json` ChartConfig top-level keys → exact match.

No other consecutive-uppercase Java fields in scope (e.g. no `URLPath`/`aBField`).

---

## Sub-pattern 9.2 verified (Null emit without @JsonInclude)

| DTO | `@JsonInclude` annotation | Field count | Python emit order | Verified golden |
|---|---|---|---|---|
| `ChartConfig` | None (line 28-30: `@Data @Builder` only) | 7 | chartType / title / seriesField / data / options / **xaxisField** / **yaxisField** (all emit None) | `analysis-finance-F999-profit.json` |
| `DateRange` | None | 7 (5 declared + 2 derived) | startDate / endDate / granularity / originalExpression / relative / **days** / **valid** | `analysis-department-F999.json` |
| `MetricResult` | None | 11 | metricCode / metricName / value / formattedValue / unit / changePercent / changeDirection / changeValue / alertLevel / dimensionValue / description (4 nulls explicitly emit) | `analysis-finance-F999-payable.json` data.metrics.0 |
| `DashboardResponse` | None | 16 (incl. 4 `@Deprecated` getter pass-throughs) | period / startDate / endDate / kpiCards / metricCards / rankings / charts / chartList / aiInsights / alerts / recommendations / suggestions / generatedAt / lastUpdated / fromCache / cacheExpireAt | `analysis-inventory-F001.json` data.overview |
| `AIInsight` | None | 5 | level / category / message / relatedEntity / actionSuggestion | `analysis-inventory-F001.json` aiInsights[i] |
| `KPICard` | None | 13 | key / title / value / rawValue / unit / change / changeRate / trend / status / compareText / description / targetValue / completionRate | `analysis-inventory-F001.json` kpiCards[i] |
| `Alert` | None | 15 (13 declared + 2 derived) | id / level / category / title / message / metric / value / threshold / gapPercent / suggestion / relatedEntityId / relatedEntityName / createdAt / **levelName** / **urgent** | `alerts-F999.json` data[i] |
| `Recommendation` | None | 13 (11 declared + 2 derived) | id / type / title / description / priority / impact / actionItems / relatedData / targetId / targetName / createdAt / **typeName** / **highPriority** | `recommendations-F001.json` response.data[i] |
| `RankingItem` | None | 6 | rank / name / value / target / completionRate / alertLevel | `analysis-sales-F001.json` rankings.* |
| `IncentiveLevel` | None | 9 | levelName / description / targetFrom / targetTo / rewardAmount / rewardRate / current / achieved / gap | `incentive-plan-salesperson-F001.json` levels[i] |
| `IncentivePlan` | None | 16 | id / targetType / targetId / targetName / currentPerformance / targetGoal / gapAmount / completionRate / levels / currentLevelName / nextLevelName / gapToNextLevel / motivationalMessage / estimatedReward / potentialReward / createdAt | `incentive-plan-salesperson-F001.json` response.data |

All 11 DTOs verified emit-all-nulls behavior against golden — no `@JsonInclude(NON_NULL)` skips.

---

## Sub-pattern 9.3 verified (Derived getter)

| DTO | Source field count | Derived getters | Total emit count | Python mirror |
|---|---|---|---|---|
| `DateRange` | 5 | `getDays()` returns `long days` (line 281); `isValid()` returns `boolean valid` (line 291) | 7 | `_new_date_range_dict` (finance:109, sales:449) + `_build_date_range` (department:333) — all emit `days`+`valid` ✓ |
| `Alert` | 13 | `getLevelName()`; `isUrgent()` (per `_new_alert_dict` docstring line 396-401) | 15 | `_new_alert_dict` (analysis.py:408) emits `levelName`+`urgent` ✓ |
| `Recommendation` | 11 | `getTypeName()`; `isHighPriority()` (per `_new_recommendation_dict` docstring line 729-733) | 13 | `_new_recommendation_dict` (analysis.py:735) emits `typeName`+`highPriority` ✓ |

All 3 derived-getter DTOs swept clean — Python helpers explicitly emit derived fields in correct hash-iter order verified by golden.

---

## DTO factory helpers audited (15 sites M=0)

| Helper | File:Line | DTO target | Field count | Status |
|---|---|---|---|---|
| `_new_chart_config_dict` | analysis_finance.py:216 | ChartConfig | 7 | ✓ |
| `_new_chart_config_dict` | analysis_sales.py:556 | ChartConfig | 7 | ✓ (sister copy) |
| `_create_empty_chart` | analysis_department.py:306 | ChartConfig empty | 7 | ✓ |
| `_new_date_range_dict` | analysis_finance.py:109 | DateRange | 7 | ✓ |
| `_new_date_range_dict` | analysis_sales.py:449 | DateRange | 7 | ✓ (sister copy) |
| `_build_date_range` | analysis_department.py:333 | DateRange | 7 | ✓ |
| `_new_metric_result_dict` | analysis_finance.py:1329 | MetricResult | 11 | ✓ |
| `_new_metric_result_dict` | analysis_sales.py:171 | MetricResult | 11 | ✓ (sister copy) |
| `_metric_result_of` | analysis_inventory.py:536 | MetricResult.of | 11 | ✓ |
| `_metric_result_of` | analysis_procurement.py:505 | MetricResult.of | 11 | ✓ |
| `_new_dashboard_response_dict` | analysis_finance.py:143 | DashboardResponse | 16 | ✓ |
| `_new_dashboard_response_dict` | analysis_sales.py:483 | DashboardResponse | 16 | ✓ (sister copy) |
| `_new_kpi_card_dict` | analysis_finance.py:341 | KPICard | 13 | ✓ |
| `_new_kpi_card_dict` | analysis_sales.py:662 | KPICard | 13 | ✓ (sister copy) |
| `_build_kpi_card` | analysis_drilldown.py:308 | KPICard | 13 | ✓ |
| `_new_ai_insight_dict` | analysis_finance.py:321 | AIInsight | 5 | ✓ |
| `_new_ai_insight_dict` | analysis_sales.py:585 | AIInsight | 5 | ✓ (sister copy) |
| `_new_alert_dict` | analysis.py:383 | Alert (15-field) | 15 | ✓ |
| `_new_recommendation_dict` | analysis.py:717 | Recommendation (13-field) | 13 | ✓ |
| `_new_ranking_item_dict` | analysis_finance.py:190 | RankingItem | 6 | ✓ |
| `_new_ranking_item_dict` | analysis_sales.py:530 | RankingItem | 6 | ✓ (sister copy) |
| `_new_incentive_level_dict` | incentive_plan.py:93 | IncentiveLevel | 9 | ✓ |
| `_new_incentive_plan_dict` | incentive_plan.py:118 | IncentivePlan | 16 | ✓ |

(Note: count is 23 emit sites across 11 unique DTOs; sister copies between `analysis_finance.py` and `analysis_sales.py` are byte-identical canonical helpers.)

---

## Out of scope per marching order ⛔ HOLD

- `analysis_region.py` (chat 2 task #25 PR #112 already swept LinkedHashMap)
- `_new_*_dict` factories themselves (canonical, do NOT modify)
- Rule 4 / 8 / 10 / 11 / 12 (already audited PR #115 / #118 / #122 / #125 / #130 / #132)

---

## Decision

| Item | Result |
|---|---|
| M (Rule 9 latent in scope) | **0** |
| Sub-pattern 9.1 (Decapitalize) latent | 0 |
| Sub-pattern 9.2 (Null emit) latent | 0 |
| Sub-pattern 9.3 (Derived getter) latent | 0 |
| New sub-pattern (9.4 candidate) | None discovered |
| Code change required | None |

Doc-only PR per marching order "M=0 老实写 swept clean".

---

## Why M=0

Phase 2A spec mandated golden-driven DTO emit shape during impl per Rule 9. Each `_new_*_dict` factory helper:
1. Has explicit docstring noting field count + Java DTO source line + Lombok quirks
2. Is golden-verified at impl time per Rule 9.1/9.2/9.3 sub-pattern checks
3. Is the canonical emit point used by all callers (no inline duplicate dict literals)

This audit is the expected closure of that pattern — defensive verification that the spec was followed everywhere. **No new latent surfaced.**

---

## Phase 2A audit thread closure (6/6 Rules)

With Rule 9 = M=0, the Phase 2A defensive audit thread closes:

| Rule | Audit PR | Result |
|---|---|---|
| Rule 4 | PR #122 + #125 (dict-eq gate official + H1 confirm) | Phase 2A scope = dict-eq gate, expected divergences accepted |
| Rule 8 | PR #130 | M=0 — 12 Map.of(N) sites verified |
| Rule 9 | (this PR) | M=0 — 15 DTO helpers verified |
| Rule 10 | PR #115 | M=2 fixed (drilldown completion rates) |
| Rule 11 | PR #118 | M=0 in budget path; M=16 Rule 12 fixed |
| Rule 12 | PR #118 | M=16 fixed (analysis.py alert/recommendation messages) |

Phase 2A spec golden-driven byte-shape parity 闭环 verified — T6.4 100% factories cutover defensive sweep done.

---

## Stop-and-ping rationale

Per marching order:
> M=0 老实写 swept clean (期待 — Phase 2A spec 已 mandate golden-driven during impl)

Audit confirms M=0 in scope across all 3 sub-patterns. No code change. No new sub-pattern discovered. Doc-only PR.

⛔ HOLD blocks all honored:
- Prod untouched (T6.3 24h soak in flight)
- No `_new_*_dict` factory modification (canonical, not invented)
- No Rule 4/8/10/11/12 chain (single Rule 9 scope)
- No chat 2/3/4 worktree touched
- No region audit (chat 2 PR #112 scope)
