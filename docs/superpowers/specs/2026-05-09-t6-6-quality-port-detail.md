# T6.6 Phase B `/analysis/quality` Endpoint Port — Detail Spec

**Phase**: T6.6 Phase B (impl detail spec — execution still blocked until T6.5 Phase B+C complete ≥30 days, ETA ~2026-08-15)
**Status**: Spec / planning artifact only — NOT a marching order
**Author**: Chat N (T6.6 Phase B endpoint detail dispatch, 2026-05-09)
**Branch**: `ops-t6-6-quality-detail`
**File**: `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md`

> **Q1 RESOLVED 2026-05-09**: Real DB path chosen (Option B), NOT mock parity. See `2026-05-09-t6-6-q1-real-db-amendment.md` for data source (real restaurant chain Excel imports) + revised effort estimate (~5 person-days impl vs original 1.5–2 person-days mock). **Implications for this spec**: §0 #2 risk (JavaRandom LCG bit-exact reproduction) + §1.3 "Real-DB upgrade" out-of-scope item + §2.2 D1 + §8.8 R7 + §9 Q1 HOLD block all **VOID** — drop the JavaRandom helper entirely. Quality semantics for restaurant tenants (defects/FPY/rework redefinition per §3.2 of the amendment) finalize in Phase B kickoff design doc. The 4-branch dispatcher + 7 service methods + 3 internal helpers + Rule 1-12 audit (§2.2 D-series) remain valid for the real-DB impl.

**Predecessors**:
- PR #180 — T6.6 base spec (`docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md`)
- PR #196 — T6.6 Phase A design (`docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md`) — caught spec drift "Quality is mock data, NOT real DB"
- PR #178 — T6.5 Phase A audit (refines NOT_SAFE_FALLTHROUGH classification)
- Phase 2A spec corpus (`2026-05-01-phase2a-analysis-procurement-design.md`, `2026-05-01-phase2a-analysis-inventory-design.md`) — pattern source for per-mode dispatch + golden gate

**Sister spec in flight**:
- Chat M `/analysis/production` detail spec (parallel sister; same dispatch pattern, different mock generator + thresholds)

**Successor**:
- Phase B kickoff marching order (separate dispatch, post T6.5 Phase B+C ≥30d)
- Impl PR by sister chat (mechanical mirror per this spec)

---

## 0. TL;DR

Java `/analysis/quality` returns mock-data-derived dashboards. PR #196 caught the spec drift ("not real DB; 10/10 entry points call `generateMockQualityData()`"); this doc converts that into an impl-level detail spec for the Python port:

1. **Scope**: 4-branch controller dispatcher (`fpy` / `defect` / `rework` / default-overview) + 7 sub-service methods + 3 internally-only helpers. Mirror Java byte-for-byte under Phase 2A dict-eq gate.
2. **#1 risk**: Mock data is seeded by `new Random(factoryId.hashCode())`. **Python port MUST replicate Java `Random` LCG + `String.hashCode()` bitwise** to produce identical row sequence. This is foundational — without it, every numeric in every golden diverges. New helper `JavaRandom` proposed (~80 LOC).
3. **#2 risk**: Rule 7 (non-integer threshold). `QUALITY_COST_YELLOW_THRESHOLD = 1.5` uses `BigDecimal` comparison in Java. Python must use `Decimal("1.5")`, not `float(1.5)`.
4. **Rule 12 surface**: 7 distinct `String.format` sites (`%.2f%%`, `%.1f%%`, `%,.2f`, `%d 件`). All must use `_format_decimal_half_up` helper from `_java_compat.py`.
5. **Rule 9 / Map ordering**: 3 grouping HashMaps (defectsByType, groupedByLine, groupedByDate) iterated without explicit `TreeMap`. Use `_sort_entries_java_iter_then_value_desc` for value-sorted outputs; document HashMap-iter risk for non-sorted ones (limited to internal ordering, mostly downstream-sorted anyway).
6. **Goldens**: 8 new (4 modes × 2 factories F999/F001) replacing the existing 2 stale `analysis-quality-F{001,999}.json` (recorded 2026-04-30 default-mode-only).
7. **PR slicing**: PR-A (4-branch dispatcher + 7 service methods + JavaRandom helper + 8 goldens), PR-B (Rule 1-12 reviewer audit + smoke). Effort: 1.5–2 person-days per PR #196 §3.2.

**Effort**: 1.5–2 person-days (single sister chat). Foundation work (JavaRandom helper) extractable for Chat M `/analysis/production` reuse — recommend coordination via organizer.

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main HEAD `0f80b14b20`）

`/api/mobile/{factoryId}/smart-bi/analysis/quality` Python 端**不存在** path handler。Java 端：

- `SmartBIAnalysisController::getQualityAnalysis` (line 373-407) 直接走 4-branch `analysisType` dispatch,**无** `SmartBIService` composite 包装路径
- `QualityAnalysisServiceImpl @Service` (line 50) 注入 0 个 repository — **mock data only**, 10/10 entry points 调用 `generateMockQualityData(factoryId, startDate, endDate)`
- Mock 数据由 `new Random(factoryId.hashCode())` deterministic 产生
- 无 `@Transactional(readOnly = true)` SQL 语义影响（虽然 annotation 仍标）— 只是模拟 service-layer transactional context

### 1.2 这一 chat 范围

实施 **`/analysis/quality` Python port**, single PR sequence (PR-A + PR-B), 4 modes + 7 service methods + 3 internal helpers + foundation `JavaRandom` helper:

**完整 in-scope service methods** (per Java interface `QualityAnalysisService`, line 42-269):

| # | Java method | Output type | Controller mode | Python target |
|---|---|---|---|---|
| 1 | `getQualitySummary(factoryId, startDate, endDate)` | `DashboardResponse` | default (overview) | `_get_quality_summary` |
| 2 | `getDefectAnalysis(factoryId, startDate, endDate)` | `List<MetricResult>` | `fpy` (metrics) | `_get_defect_analysis` |
| 3 | `getDefectTypeRanking(factoryId, startDate, endDate)` | `List<RankingItem>` | `defect` (ranking) | `_get_defect_type_ranking` |
| 4 | `getDefectParetoChart(factoryId, startDate, endDate)` | `ChartConfig` | `defect` (paretoChart) | `_get_defect_pareto_chart` |
| 5 | `getReworkCost(factoryId, startDate, endDate)` | `List<MetricResult>` | `rework` (metrics) | `_get_rework_cost` |
| 6 | `getQualityCostDistributionChart(factoryId, startDate, endDate)` | `ChartConfig` | `rework` (costChart) | `_get_quality_cost_distribution_chart` |
| 7 | `getQualityTrendChart(factoryId, startDate, endDate, period)` | `ChartConfig` | `fpy` (trendChart, period="DAY") | `_get_quality_trend_chart` |
| 8 | `getQualityByProductLine(factoryId, startDate, endDate)` | `List<MetricResult>` | NOT controller-exposed | `_get_quality_by_product_line` (internal helper) |
| 9 | `getProductLineQualityRanking(factoryId, startDate, endDate)` | `List<RankingItem>` | NOT controller-exposed | `_calculate_product_line_quality_ranking_from_data` (internal) |
| 10 | `getProductLineQualityComparisonChart(factoryId, startDate, endDate)` | `ChartConfig` | NOT controller-exposed | `_build_product_line_quality_comparison_from_data` (internal) |

Methods 8/9/10 are NOT directly accessible via `/analysis/quality` path — they are invoked internally by `getQualitySummary` (line 97, 102, 105 of impl) and by `SmartBIDashboardController` (out-of-scope for T6.6, KEEP forever per PR #178 §3.2.a). Python ports them as **module-level helpers** for `_get_quality_summary` to call but does NOT expose them on the route.

**Controller dispatch mirror** (4 modes):

| analysisType | Sub-services 调用 | 输出 keys |
|---|---|---|
| `fpy` | `getDefectAnalysis` + `getQualityTrendChart(period="DAY")` | `[startDate, endDate, metrics, trendChart]` |
| `defect` | `getDefectTypeRanking` + `getDefectParetoChart` | `[startDate, endDate, ranking, paretoChart]` |
| `rework` | `getReworkCost` + `getQualityCostDistributionChart` | `[startDate, endDate, metrics, costChart]` |
| default | `getQualitySummary` (DashboardResponse) | `[startDate, endDate, overview]` |

### 1.3 显式不在范围

- `SmartBIDashboardController::getDashboardOverview/{factoryId}/quality` — Dashboard composite caller, KEEP per T6.6 spec §2.6 (Java service impl stays alive forever)
- `QualityAnalysisServiceImpl.java` Java file deletion — KEEP forever (Dashboard composite injects)
- T6.6 Phase C nginx cutover (separate phase, single-shot edit)
- T6.6 Phase D Java `SmartBIAnalysisController::getQualityAnalysis` body removal (separate phase, T+30d post-cutover)
- Real-DB upgrade (Open Question 1 in PR #196 — Steve sign-off needed; default = keep mock parity)
- Strict-byte gate (Phase 3+ decision per PR #153)
- Existing stale goldens `analysis-quality-F{001,999}.json` (2026-04-30, default-mode-only, 75KB each) — replaced by new 8 mode-specific goldens

### 1.4 Quality-specific 设计差异 vs sister specs

| Aspect | Quality (this spec) | Procurement (PR #36) | Inventory (PR #53) |
|---|---|---|---|
| Data source | Mock (`generateMockQualityData`) | Real DB (MaterialBatch + Supplier) | Real DB (smart_bi_material_data) |
| Random reproducibility | **CRITICAL** (Java `Random(seed)` LCG mirror needed) | N/A | N/A |
| Threshold types | Mixed (95/98/5/2 int, **1.5** non-int) | Integer-only | Mixed (Decimal config) |
| Endpoint modes | 4 (fpy/defect/rework/default) | 4 (supplier/cost/trend/default) | 4 (turnover/expiry/aging/default) |
| Internal-only helpers | 3 (productLine 8/9/10) | 0 | 0 |
| Service methods | 10 total, 7 exposed | 7 in-scope | 9 in-scope |
| LLM/AI integration | No (rule-based insights only) | No | No |
| Period support | DAY/WEEK/MONTH on trend chart | MONTH only | DAY only |
| FPY/Defect alert thresholds | Yes (4 named alert helpers) | Yes (4 named) | Yes (4 named + 4 inline) |

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
PR-A (4-branch dispatcher + 7 service methods + JavaRandom + 8 goldens):

  tests/fixtures/java-smartbi-golden/
    ├─ analysis-quality-F999-fpy.json       [NEW via record-java-golden.sh]
    ├─ analysis-quality-F999-defect.json    [NEW]
    ├─ analysis-quality-F999-rework.json    [NEW]
    ├─ analysis-quality-F999-default.json   [NEW] (replaces stale -F999.json)
    ├─ analysis-quality-F001-fpy.json       [NEW]
    ├─ analysis-quality-F001-defect.json    [NEW]
    ├─ analysis-quality-F001-rework.json    [NEW]
    └─ analysis-quality-F001-default.json   [NEW] (replaces stale -F001.json)
    NOTE: Stale `analysis-quality-F{001,999}.json` (2026-04-30) deleted in same commit per Rule §2.4 (no orphan goldens).

  backend/python/smartbi_compat/_java_random.py  [NEW]
    + JavaRandom class (LCG mirror: nextInt / nextDouble / hashCode helper)
    + java_string_hashcode(s) → int32 (bitwise mirror of Java String.hashCode())

  backend/python/smartbi_compat/api/analysis_quality.py  [NEW]
    + analysis_quality_router (FastAPI APIRouter)
    + GET /api/mobile/{factoryId}/smart-bi/analysis/quality endpoint dispatcher
    + _get_quality_analysis() main dispatcher by analysisType
    + _get_fpy_mode() / _get_defect_mode() / _get_rework_mode() entry points
    # 7 controller-reachable methods (mirror Java getX methods 1-7):
    + _get_quality_summary()                       method 1 (DashboardResponse)
    + _get_defect_analysis()                       method 2 (List[MetricResult])
    + _get_defect_type_ranking()                   method 3 (List[RankingItem])
    + _get_defect_pareto_chart()                   method 4 (ChartConfig)
    + _get_rework_cost()                           method 5 (List[MetricResult])
    + _get_quality_cost_distribution_chart()       method 6 (ChartConfig)
    + _get_quality_trend_chart(period)             method 7 (ChartConfig)
    # 3 internal helpers (mirror Java methods 8/9/10 — NOT exposed on route):
    + _get_quality_by_product_line()               method 8 (called by KPI prep, NOT exposed)
    + _calculate_product_line_quality_ranking_from_data()  method 9 (called by summary)
    + _build_product_line_quality_comparison_from_data()   method 10 (called by summary)
    # KPI + chart builders:
    + _calculate_quality_kpi_cards()
    + _convert_to_kpi_cards()
    + _build_quality_trend_chart_from_data(period)
    + _build_defect_pareto_from_data()
    + _build_quality_cost_distribution_from_data()
    + _calculate_defect_type_ranking_from_data()
    + _generate_quality_insights()                 rule-based, no LLM
    + _generate_quality_suggestions()              rule-based, no LLM
    + _build_empty_dashboard()
    # Mock generator (foundation):
    + _generate_mock_quality_data(factory_id, start_date, end_date)
    # Alert helpers (4 named):
    + _determine_fpy_alert_level()
    + _determine_defect_rate_alert_level()
    + _determine_rework_rate_alert_level()
    + _determine_quality_cost_alert_level()         (NEW — exposed via Decimal threshold)
    # Aggregation helpers:
    + _aggregate_by_day(data)
    + _aggregate_by_week(data)
    + _aggregate_by_month(data)
    # Utility:
    + _sum_field(data, field_name) → Decimal
    + _format_currency(value: Decimal) → str (Java `%,.2f` parity via _format_decimal_half_up)

  backend/python/main.py  [MODIFIED]
    + register analysis_quality_router (single line: app.include_router(analysis_quality.router))

  backend/python/tests/test_analysis_quality.py  [NEW]
    + 4 dispatcher contract tests (one per mode: fpy / defect / rework / default)
    + 7 service-method contract tests (each method goldens parity)
    + 3 internal-helper contract tests (productLine 8/9/10 byte-shape)
    + 1 JavaRandom roundtrip test (verify LCG matches Java reference seed sequence)
    + 1 string.hashCode test (verify factoryId hash int32 matches Java)
    + 1 alert-level threshold test (FPY/Defect/Rework/QualityCost — 4 alert helpers × 3 zones each = 12 cases)

PR-B (Rule 1-12 reviewer audit + smoke + test env deploy):
  No code changes — process artifact via PR review thread
  + reviewer audit signed (per `.claude/rules/python-java-port.md` Rules 1-12)
  + test env deploy (`./scripts/deploy/deploy-smartbi-python.sh --env test`)
  + dict-eq smoke vs Java prod 10010 (4 modes × 2 factories = 8 calls, expect ≥99% match)
```

### 2.2 关键架构决策 (15)

#### D1. JavaRandom helper extracted to standalone module
**Why**: production sister chat (Chat M) needs same helper. Putting it in `_java_compat.py` makes it discoverable; standalone `_java_random.py` clarifies the foundation-shared nature. `_java_compat.py` already has `_java_hashmap_bucket` + `_format_decimal_half_up`.

#### D2. JavaRandom uses 48-bit LCG matching java.util.Random source
**Why**: byte-shape parity demands identical sequence. Java `Random` has well-documented public algorithm — no reverse-engineering risk. ~80 LOC Python class.

```python
class JavaRandom:
    """Mirror java.util.Random LCG (48-bit state, multiplier 0x5DEECE66D, addend 0xB)."""
    def __init__(self, seed: int):
        self.seed = (seed ^ 0x5DEECE66D) & ((1 << 48) - 1)

    def _next(self, bits: int) -> int:
        self.seed = (self.seed * 0x5DEECE66D + 0xB) & ((1 << 48) - 1)
        return self.seed >> (48 - bits)

    def next_int(self, bound: int) -> int:
        # Mirror Java Random.nextInt(int bound) — bias-correction loop included
        if bound <= 0:
            raise ValueError("bound must be positive")
        if (bound & -bound) == bound:  # power of 2
            return (bound * self._next(31)) >> 31
        bits = self._next(31)
        val = bits % bound
        while bits - val + (bound - 1) < 0:
            bits = self._next(31)
            val = bits % bound
        return val

    def next_double(self) -> float:
        # Mirror Java Random.nextDouble() — combine nextInt(26) + nextInt(27)
        return ((self._next(26) << 27) + self._next(27)) / (1 << 53)


def java_string_hashcode(s: str) -> int:
    """Mirror Java String.hashCode() — 32-bit signed int."""
    h = 0
    for c in s:
        h = (31 * h + ord(c)) & 0xFFFFFFFF
    if h >= 0x80000000:
        h -= 0x100000000
    return h
```

#### D3. Mock data generator uses pre-allocated `LinkedHashMap`-like dict literals
**Why**: Java `Map<String, Object>` mock records use `LinkedHashMap` (impl line 418). Python literal dict preserves insertion order since 3.7 → trivial mirror. 11 fields per record ordered: `[factoryId, date, productionLine, product, totalInspections, defectCount, firstPassCount, defectType, reworkCount, scrapCount, reworkCost, scrapCost, complaintCount, returnCount]`. Verify via golden record.

#### D4. `defectsByType` HashMap iteration uses `_sort_entries_java_iter_then_value_desc`
**Why**: Java `Collectors.groupingBy` produces `HashMap` (no guaranteed order). PR-N-1 finding already gives us the helper. Where Java code iterates `defectsByType.entrySet()` directly (line 173 of `getDefectAnalysis`), that order **is non-deterministic**. **Risk**: Java iter order may differ between JVM versions. Mitigation: use the helper to predict iter order based on `String.hashCode()` bucket placement.

For sites that immediately `sorted(...)` the entrySet (e.g. line 637 `sorted(Map.Entry.<String, Long>comparingByValue().reversed())`), the sort is value-deterministic so HashMap iter doesn't matter — Python `sorted(items, key=lambda kv: kv[1], reverse=True)` is sufficient.

| Site | Java line | Iter pattern | Python approach |
|---|---|---|---|
| `getDefectAnalysis` defectsByType iter (line 173) | unsorted iter | `_sort_entries_java_iter_then_value_desc(d.items())` |
| `calculateDefectTypeRankingFromData` (line 636) | sorted by value desc | sort by value desc — Python `sorted(d.items(), key=lambda x: x[1], reverse=True)` |
| `buildDefectParetoFromData` (line 797) | sorted by value desc | same as above |
| `getQualityByProductLine` groupedByLine iter (line 349) | unsorted iter | `_sort_entries_java_iter_then_value_desc` (use lineName as key) |
| `calculateProductLineQualityRankingFromData` line iter then post-sort by FPY desc (line 676/703) | post-sort by computed value | iter doesn't affect output; sort by FPY desc deterministic |
| `buildProductLineQualityComparisonFromData` line iter (line 875) | unsorted iter into chartData list | `_sort_entries_java_iter_then_value_desc` (chartData order matters for byte-shape) |
| `aggregateByDay/Week/Month` (line 1165/1175/1189) | uses `TreeMap::new` supplier | sort by key asc — Python `sorted(d.items())` |

**3 sites (defectsByType iter, groupedByLine for productLine metrics, groupedByLine for comparison chart) require helper**.

#### D5. `Random(factoryId.hashCode())` seeded BEFORE the loop, ONE Random instance shared across all date×line×product combinations
**Why**: Java line 405 `Random random = new Random(factoryId.hashCode())` is single instance. Each subsequent `random.nextInt(N)` advances state. Python must mirror this single-instance + sequential-call pattern exactly.

#### D6. `String.format("%.2f%%", fpy.doubleValue())` → `f"{_format_decimal_half_up(fpy_decimal, 2)}%"`
**Why**: Java `String.format` uses HALF_UP, Python f-string is banker's. Rule 12. 7 distinct format sites in this file:

| Java site | Format | Python equivalent |
|---|---|---|
| FPY KPI display (line 498) | `"%.2f%%"` | `f"{_format_decimal_half_up(fpy, 2)}%"` |
| Defect rate KPI display (line 517) | `"%.2f%%"` | same |
| FPY by line (line 369) | `"%.2f%%"` | same |
| Defect type ratio (line 183) | `"%.1f%%"` | `f"{_format_decimal_half_up(ratio, 1)}%"` |
| Rework rate (line 283) | `"%.1f%%"` | same |
| Scrap rate (line 298) | `"%.1f%%"` | same |
| Currency (line 1162) | `"%,.2f"` | special: comma-thousand-separator + HALF_UP — see D7 |
| Insight FPY message (line 940/947/954) | `"%.2f%%"` | string formatting INSIDE message |
| Insight topDefectRatio (line 985) | `"%.1f%%"` | same |
| Suggestion FPY gap (line 1060) | `"%.2f%%"` ×2 | same |
| Complaint count (line 564) | `"%d 件"` | `f"{int(count)} 件"` (no rounding, integer) |

#### D7. `String.format("%,.2f", value.setScale(2, HALF_UP))` (currency) requires custom formatter
**Why**: Java `%,.2f` adds comma thousand separators + HALF_UP. Existing `_format_decimal_half_up` handles HALF_UP but not commas. **Add helper**:

```python
def _format_currency_java(value: Decimal) -> str:
    """Mirror Java String.format("%,.2f", value).
    Combines comma-thousand-separator with HALF_UP rounding."""
    if value is None:
        return "-"
    quantized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{float(quantized):,.2f}"
    # NOTE: f-string :,.2f formatting on already-quantized float is safe because
    # we pre-rounded with HALF_UP. Final format is just locale-style separator.
```

Place: `_java_compat.py` (extends Rule 12 family).

#### D8. `Decimal("1.5")` for QUALITY_COST_YELLOW_THRESHOLD (Rule 7 hard)
**Why**: Java `BigDecimal("1.5")`. Python must use `Decimal("1.5")` not `float(1.5)` — Rule 7 in `python-java-port.md` is HARD. PR #196 §3.2 explicitly flags this.

```python
# Constants (mirror Java line 53-71)
SCALE = 4
DISPLAY_SCALE = 2
ROUNDING_MODE = ROUND_HALF_UP

FPY_RED_THRESHOLD = Decimal("95")
FPY_YELLOW_THRESHOLD = Decimal("98")
DEFECT_RATE_RED_THRESHOLD = Decimal("5")
DEFECT_RATE_YELLOW_THRESHOLD = Decimal("2")
QUALITY_COST_RED_THRESHOLD = Decimal("3")
QUALITY_COST_YELLOW_THRESHOLD = Decimal("1.5")  # ← Rule 7 hard
REWORK_RATE_RED_THRESHOLD = Decimal("20")
REWORK_RATE_YELLOW_THRESHOLD = Decimal("10")
```

#### D9. BigDecimal divide-then-multiply pattern (Rule 10) on FPY / defect rate / rework rate / etc.
**Why**: Java `divide(scale, HALF_UP).multiply(100)` ≠ Python `(n/d*100).quantize(scale_2)` — compounded rounding error. 8+ sites in this file use this exact pattern. Python must mirror Java intermediate-round-then-multiply:

```python
def _percentage_java(numerator: Decimal, denominator: Decimal, scale: int = 4) -> Decimal:
    """Mirror Java BigDecimal.divide(divisor, scale, HALF_UP).multiply(100)."""
    if denominator == 0:
        return Decimal("0")
    intermediate = (numerator / denominator).quantize(
        Decimal("0." + "0" * scale)[:scale + 2],
        rounding=ROUND_HALF_UP,
    )
    return intermediate * Decimal("100")
```

(Final scale-2 quantize applied at display formatting stage, not arithmetic stage.)

#### D10. KPI + Chart DTO null emit (Rule 9)
**Why**: `MetricResult` / `KPICard` / `ChartConfig` / `RankingItem` / `AIInsight` / `DashboardResponse` are all Lombok `@Data` POJOs. Verify via grep `@JsonInclude` in DTO files — if 0 hits, default Jackson emit nulls. Phase B impl reviewer **must** record golden first then mirror dict literal field-by-field, including emitting `None` for absent fields.

Field order from Lombok @Builder classes (verify via golden, NOT assume from Java source):
- `MetricResult`: `[metricCode, metricName, value, formattedValue, unit, alertLevel, dimensionValue, description, changeValue, changeDirection, changePercent]` (11 fields)
- `KPICard`: `[key, title, value, rawValue, unit, change, changeRate, trend, status, description]` (10 fields)
- `ChartConfig`: `[chartType, title, xaxisField, yaxisField, seriesField, data, options]` (7 fields, **xaxisField lowercase per Rule 9.1**)
- `RankingItem`: `[rank, name, value, target, completionRate, alertLevel]` (6 fields)
- `AIInsight`: `[level, category, message, actionSuggestion, relatedEntity]` (5 fields, verify)
- `DashboardResponse`: `[period, startDate, endDate, kpiCards, charts, rankings, aiInsights, suggestions, generatedAt, lastUpdated]` (10 fields, verify)

**ALL field orders MUST be re-verified by recording goldens via `record-java-golden.sh` BEFORE hardcoding into Python literal dicts.** (Rule 9 lesson from PR #52 / #53 / #56 — 3 sister chats independently caught spec-source-vs-golden drift.)

#### D11. `LocalDateTime.now()` → `_java_isoformat(datetime.now(ZoneInfo("Asia/Shanghai")))`
**Why**: `getQualitySummary` line 119/120 sets `generatedAt` + `lastUpdated` to `LocalDateTime.now()`. Java Jackson serializes as ISO-8601 with trailing-zero-microsecond truncation (Rule 11). Python must use `_java_isoformat()` from `schema_compat.py`.

**Test golden recording strategy**: `generatedAt` / `lastUpdated` are timestamps that change every request. Two options:
- A. Extract `_strip_volatile` to remove these from comparison (existing pattern in `analysis_drilldown.py`)
- B. Mock `datetime.now()` in test fixtures with deterministic value

**Recommend**: Option A (extract from comparison via `_strip_volatile` extension; matches sales/department/inventory pattern). Document explicitly in PR description.

#### D12. `LocalDate.toString()` → `date.isoformat()` for chart data point keys
**Why**: Java line 758 `dataPoint.put("date", dateKey)` where `dateKey = LocalDate.toString()` produces "2026-01-15". Python `date.isoformat()` matches. WEEK uses `weekStart.toString()`. MONTH uses `date.getYear() + "-" + String.format("%02d", date.getMonthValue())`.

For MONTH: Java emits e.g. `"2026-01"` (year + zero-padded 2-digit month, no day). Python `f"{d.year}-{d.month:02d}"` — equivalent.

**Critical**: Java `String.format("%02d", date.getMonthValue())` is integer formatting (no rounding risk). f-string `f"{x:02d}"` is identical for ints. Safe.

#### D13. WEEK aggregation uses Monday as week start (TemporalAdjusters.previousOrSame)
**Why**: Java `date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))` returns the Monday-of-week (or same date if already Monday). Python equivalent:

```python
from datetime import timedelta
def _week_start_monday(d: date) -> date:
    """Mirror Java date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))."""
    days_since_monday = d.weekday()  # Monday=0
    return d - timedelta(days=days_since_monday)
```

**Rule 2 (calendar-year vs ISO-year) does NOT apply here** — this method outputs a `LocalDate`, not a year-week period key. Output passes through `LocalDate.toString()` line 1182, becomes a date string. No year-rollover risk.

#### D14. `_strip_volatile` extension for quality
**Why**: `generatedAt` / `lastUpdated` change every call. Extend `analysis_drilldown.py`'s pattern (or `schema_compat.py`'s helper) to recursively strip these from response before dict-eq compare.

```python
_VOLATILE_KEYS = frozenset({"generatedAt", "lastUpdated"})
def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in _VOLATILE_KEYS}
    if isinstance(obj, list):
        return [_strip_volatile(v) for v in obj]
    return obj
```

Place: `schema_compat.py` (extends existing utilities).

#### D15. AlertLevel enum string conversion
**Why**: Java `MetricResult.AlertLevel.RED.name()` returns `"RED"` (string). Python uses string literals directly: `"RED"`, `"YELLOW"`, `"GREEN"`. No enum class needed — just string constants.

```python
ALERT_RED = "RED"
ALERT_YELLOW = "YELLOW"
ALERT_GREEN = "GREEN"
```

KPICard `status` field uses lowercase variant (`"red"` / `"yellow"` / `"green"` per impl line 583-590). Mirror via `.lower()`.

---

## 3. Java 引用 + 算法

### 3.1 Java reference 表

| Python helper | Java source | Java line range |
|---|---|---|
| `_get_quality_analysis` (route dispatcher) | `SmartBIAnalysisController.getQualityAnalysis` | 373-407 |
| `_get_quality_summary` | `QualityAnalysisServiceImpl.getQualitySummary` | 75-122 |
| `_get_defect_analysis` | `QualityAnalysisServiceImpl.getDefectAnalysis` | 126-191 |
| `_get_defect_type_ranking` | `QualityAnalysisServiceImpl.getDefectTypeRanking` | 193-200 |
| `_get_defect_pareto_chart` | `QualityAnalysisServiceImpl.getDefectParetoChart` | 202-209 |
| `_get_rework_cost` | `QualityAnalysisServiceImpl.getReworkCost` | 213-307 |
| `_get_quality_cost_distribution_chart` | `QualityAnalysisServiceImpl.getQualityCostDistributionChart` | 309-316 |
| `_get_quality_trend_chart` | `QualityAnalysisServiceImpl.getQualityTrendChart` | 320-328 |
| `_get_quality_by_product_line` | `QualityAnalysisServiceImpl.getQualityByProductLine` | 332-377 |
| `_calculate_product_line_quality_ranking_from_data` | `QualityAnalysisServiceImpl.calculateProductLineQualityRankingFromData` | 670-709 |
| `_build_product_line_quality_comparison_from_data` | `QualityAnalysisServiceImpl.buildProductLineQualityComparisonFromData` | 869-919 |
| `_calculate_quality_kpi_cards` | `QualityAnalysisServiceImpl.calculateQualityKpiCards` | 476-571 |
| `_convert_to_kpi_cards` | `QualityAnalysisServiceImpl.convertToKPICards` | 576-622 |
| `_calculate_defect_type_ranking_from_data` | `QualityAnalysisServiceImpl.calculateDefectTypeRankingFromData` | 627-665 |
| `_build_quality_trend_chart_from_data` | `QualityAnalysisServiceImpl.buildQualityTrendChartFromData` | 714-780 |
| `_build_defect_pareto_from_data` | `QualityAnalysisServiceImpl.buildDefectParetoFromData` | 785-830 |
| `_build_quality_cost_distribution_from_data` | `QualityAnalysisServiceImpl.buildQualityCostDistributionFromData` | 835-864 |
| `_generate_quality_insights` | `QualityAnalysisServiceImpl.generateQualityInsights` | 924-1007 |
| `_generate_quality_suggestions` | `QualityAnalysisServiceImpl.generateQualitySuggestions` | 1012-1075 |
| `_build_empty_dashboard` | `QualityAnalysisServiceImpl.buildEmptyDashboard` | 1080-1095 |
| `_determine_fpy_alert_level` | `QualityAnalysisServiceImpl.determineFPYAlertLevel` | 1099-1107 |
| `_determine_defect_rate_alert_level` | `QualityAnalysisServiceImpl.determineDefectRateAlertLevel` | 1109-1117 |
| `_determine_rework_rate_alert_level` | `QualityAnalysisServiceImpl.determineReworkRateAlertLevel` | 1119-1127 |
| `_determine_quality_cost_alert_level` | (NEW — exposed via Decimal threshold) | derived from Java thresholds line 66-67 |
| `_sum_field` | `QualityAnalysisServiceImpl.sumField` | 1129-1133 |
| `_format_currency_java` | `QualityAnalysisServiceImpl.formatCurrency` | 1158-1163 |
| `_aggregate_by_day` | `QualityAnalysisServiceImpl.aggregateByDay` | 1165-1173 |
| `_aggregate_by_week` | `QualityAnalysisServiceImpl.aggregateByWeek` | 1175-1187 |
| `_aggregate_by_month` | `QualityAnalysisServiceImpl.aggregateByMonth` | 1189-1200 |
| `_generate_mock_quality_data` | `QualityAnalysisServiceImpl.generateMockQualityData` | 403-471 |
| `JavaRandom` (helper) | `java.util.Random` | (JDK source — public algorithm) |
| `java_string_hashcode` (helper) | `java.lang.String.hashCode` | (JDK source — public algorithm) |

### 3.2 Mock data generation algorithm (CRITICAL — Rule §3.5)

**Java source** (line 403-471):

```java
private List<Map<String, Object>> generateMockQualityData(String factoryId, LocalDate startDate, LocalDate endDate) {
    List<Map<String, Object>> data = new ArrayList<>();
    Random random = new Random(factoryId.hashCode());

    String[] productionLines = {"产线A", "产线B", "产线C", "产线D"};
    String[] defectTypes = {"外观缺陷", "尺寸偏差", "功能故障", "材料缺陷", "装配不良"};
    String[] products = {"产品A", "产品B", "产品C"};

    long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);

    for (int i = 0; i <= daysBetween; i++) {           // INCLUSIVE of endDate (note <=)
        LocalDate date = startDate.plusDays(i);

        for (String line : productionLines) {           // 4 lines
            for (String product : products) {           // 3 products
                Map<String, Object> record = new LinkedHashMap<>();
                record.put("factoryId", factoryId);
                record.put("date", date);
                record.put("productionLine", line);
                record.put("product", product);

                int totalInspections = 100 + random.nextInt(200);     // [100, 299]
                record.put("totalInspections", totalInspections);

                int defectCount = (int) (totalInspections * (0.02 + random.nextDouble() * 0.06));  // 2-8%
                record.put("defectCount", defectCount);

                int firstPassCount = totalInspections - defectCount;
                record.put("firstPassCount", firstPassCount);

                String defectType = defectTypes[random.nextInt(defectTypes.length)];   // 5 types
                record.put("defectType", defectType);

                int reworkCount = (int) (defectCount * (0.6 + random.nextDouble() * 0.2));   // 60-80%
                record.put("reworkCount", reworkCount);

                int scrapCount = defectCount - reworkCount;
                record.put("scrapCount", scrapCount);

                BigDecimal reworkCost = new BigDecimal(reworkCount * (10 + random.nextInt(20)));   // 10-29 each
                record.put("reworkCost", reworkCost);

                BigDecimal scrapCost = new BigDecimal(scrapCount * (50 + random.nextInt(100)));    // 50-149 each
                record.put("scrapCost", scrapCost);

                int complaintCount = random.nextInt(3);          // [0, 2]
                record.put("complaintCount", complaintCount);

                int returnCount = random.nextInt(5);             // [0, 4]
                record.put("returnCount", returnCount);

                data.add(record);
            }
        }
    }
    return data;
}
```

**Per-record `Random` advance count: 8 calls** (`nextInt(200)`, `nextDouble()`, `nextInt(5)` for defectType, `nextDouble()` for rework, `nextInt(20)` for reworkCost, `nextInt(100)` for scrapCost, `nextInt(3)`, `nextInt(5)`).

**Per (date × line × product) loop**: 8 advances. Total Random calls = `(daysBetween+1) × 4 × 3 × 8` = `(N+1) × 96` advances per call to mock generator.

**Python port** (`backend/python/smartbi_compat/api/analysis_quality.py`):

```python
from datetime import date, timedelta
from decimal import Decimal
from smartbi_compat._java_random import JavaRandom, java_string_hashcode

PRODUCTION_LINES = ("产线A", "产线B", "产线C", "产线D")
DEFECT_TYPES = ("外观缺陷", "尺寸偏差", "功能故障", "材料缺陷", "装配不良")
PRODUCTS = ("产品A", "产品B", "产品C")


def _generate_mock_quality_data(factory_id: str, start_date: date, end_date: date) -> list[dict]:
    """Mirror Java QualityAnalysisServiceImpl.generateMockQualityData (line 403-471).

    CRITICAL byte-shape parity: must use JavaRandom seeded with java_string_hashcode(factory_id)
    and advance state in EXACT same order as Java loop. Each record advances state 8 times.
    """
    seed = java_string_hashcode(factory_id)
    rng = JavaRandom(seed)
    data: list[dict] = []
    days_between = (end_date - start_date).days

    for i in range(days_between + 1):  # INCLUSIVE of end_date
        d = start_date + timedelta(days=i)
        for line in PRODUCTION_LINES:
            for product in PRODUCTS:
                # 1. totalInspections
                total = 100 + rng.next_int(200)
                # 2. defectCount  (BigDecimal arithmetic for the multiplier — verify (int) cast)
                defect = int(total * (0.02 + rng.next_double() * 0.06))
                first_pass = total - defect
                # 3. defectType
                defect_type = DEFECT_TYPES[rng.next_int(len(DEFECT_TYPES))]
                # 4. reworkCount
                rework = int(defect * (0.6 + rng.next_double() * 0.2))
                scrap = defect - rework
                # 5. reworkCost
                rework_cost = Decimal(rework * (10 + rng.next_int(20)))
                # 6. scrapCost
                scrap_cost = Decimal(scrap * (50 + rng.next_int(100)))
                # 7. complaintCount
                complaint = rng.next_int(3)
                # 8. returnCount
                ret = rng.next_int(5)

                data.append({
                    "factoryId": factory_id,
                    "date": d,
                    "productionLine": line,
                    "product": product,
                    "totalInspections": total,
                    "defectCount": defect,
                    "firstPassCount": first_pass,
                    "defectType": defect_type,
                    "reworkCount": rework,
                    "scrapCount": scrap,
                    "reworkCost": rework_cost,
                    "scrapCost": scrap_cost,
                    "complaintCount": complaint,
                    "returnCount": ret,
                })
    return data
```

**T-MOCK-1 (Day 0 verification task)**: Before any other Python code, verify `JavaRandom + java_string_hashcode` against Java reference seed sequence. Test fixture: known seed (e.g. `"F999".hashCode() = 2192349`), verify first 10 outputs of `next_int(200)` / `next_double()` match Java `Random.nextInt(200)` / `nextDouble()` exactly.

**Verification harness**: Java side, write a tiny `java -jar` test that emits "for seed=hashcode('F999'), first 10 nextInt(200) = [...]". Compare against Python output. Check into `tests/fixtures/java_random_reference.json`.

**T-MOCK-2 (Day 0 verification)**: Verify `_generate_mock_quality_data("F999", 2026-01-01, 2026-01-07)` Python output against Java pre-recorded golden of same call. Records produced should be identical byte-for-byte (factoryId.hashCode() seed → same Random sequence → same outputs).

### 3.3 Constants + scale (Java line 53-71 mirror)

```python
# Decimal precision (mirror Java line 53-55)
SCALE = 4
DISPLAY_SCALE = 2
ROUNDING_MODE = ROUND_HALF_UP

# FPY alert thresholds (mirror Java line 58-59)
FPY_RED_THRESHOLD = Decimal("95")
FPY_YELLOW_THRESHOLD = Decimal("98")

# Defect rate alert thresholds (mirror Java line 62-63)
DEFECT_RATE_RED_THRESHOLD = Decimal("5")
DEFECT_RATE_YELLOW_THRESHOLD = Decimal("2")

# Quality cost alert thresholds (mirror Java line 66-67) — Rule 7 hard
QUALITY_COST_RED_THRESHOLD = Decimal("3")
QUALITY_COST_YELLOW_THRESHOLD = Decimal("1.5")  # ⚠ non-integer → Decimal mandatory

# Rework rate alert thresholds (mirror Java line 70-71)
REWORK_RATE_RED_THRESHOLD = Decimal("20")
REWORK_RATE_YELLOW_THRESHOLD = Decimal("10")

# Scrap rate threshold (mirror Java line 300, inline)
SCRAP_RATE_RED_THRESHOLD = Decimal("30")
```

### 3.4 KPI cards (`_calculate_quality_kpi_cards` — Java line 476-571)

7 KPI metrics computed from data:

| # | Metric code | Java line | Computation | Alert |
|---|---|---|---|---|
| 1 | `FPY` | 489-502 | (firstPass/totalInsp).divide(SCALE,HALF_UP).multiply(100), HALF_UP %.2f | FPY thresholds |
| 2 | `DEFECT_RATE` | 504-521 | (defect/totalInsp).divide.multiply(100), HALF_UP %.2f | DEFECT_RATE thresholds |
| 3 | `REWORK_COST` | 523-532 | sum reworkCost, currency format | GREEN |
| 4 | `SCRAP_COST` | 534-543 | sum scrapCost, currency format | GREEN |
| 5 | `TOTAL_QUALITY_COST` | 545-554 | rework + scrap, currency format | GREEN |
| 6 | `CUSTOMER_COMPLAINT_COUNT` | 556-568 | sum complaintCount, "%d 件" | inline: >10 RED, >5 YELLOW, else GREEN |

Note the inline alert calc on line 565-567:
```java
.alertLevel(complaintCount > 10 ? RED : (complaintCount > 5 ? YELLOW : GREEN))
```
**Inline alert pattern** — no dedicated `determineComplaintAlert` helper. Python mirror:
```python
if complaint_count > 10:
    alert = "RED"
elif complaint_count > 5:
    alert = "YELLOW"
else:
    alert = "GREEN"
```

### 3.5 Defect type ranking (帕累托 — Java line 627-665)

Output shape: `List[RankingItem]` sorted by defect count DESC, with cumulative percentage threshold of 80% marking RED alert.

Critical detail: The 80-20 rule sets `alertLevel = RED` for items where **cumulative percentage ≤ 80%**. Items past the 80% line stay GREEN.

```python
def _calculate_defect_type_ranking_from_data(quality_data: list[dict]) -> list[dict]:
    # Step 1: groupBy defectType, sum defectCount
    defects_by_type: dict[str, int] = {}
    for r in quality_data:
        dt = r["defectType"]
        defects_by_type[dt] = defects_by_type.get(dt, 0) + r["defectCount"]

    total_defects = sum(defects_by_type.values())

    # Step 2: sort by value desc (Java Collectors.groupingBy → sorted by value reversed)
    sorted_entries = sorted(defects_by_type.items(), key=lambda kv: kv[1], reverse=True)

    # Step 3: build RankingItem dicts in Lombok @Builder field order
    rankings = []
    for entry in sorted_entries:
        name, value = entry
        if total_defects > 0:
            pct = (Decimal(value) / Decimal(total_defects)).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP) * Decimal("100")
        else:
            pct = Decimal("0")
        rankings.append({
            "rank": None,  # filled in step 4
            "name": name,
            "value": Decimal(value),
            "target": None,
            "completionRate": pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "alertLevel": "GREEN",  # default
        })

    # Step 4: assign rank + cumulative-percentage RED-mark for top items ≤ 80%
    cumulative = Decimal("0")
    for i, item in enumerate(rankings):
        item["rank"] = i + 1
        cumulative += item["completionRate"]
        if cumulative <= Decimal("80"):
            item["alertLevel"] = "RED"

    return rankings
```

### 3.6 Quality trend chart (DAY/WEEK/MONTH — Java line 714-780)

Output: `ChartConfig` with `data = list[dict]` ordered by date asc.

**Aggregation key generation**:

| Period | Key format | Java line | Python equivalent |
|---|---|---|---|
| DAY | `LocalDate.toString()` → `"2026-01-15"` | 1169 | `d.isoformat()` |
| WEEK | week-start (Monday) `LocalDate.toString()` → `"2026-01-13"` | 1182 | `_week_start_monday(d).isoformat()` |
| MONTH | `year + "-" + zero-pad month` → `"2026-01"` | 1195 | `f"{d.year}-{d.month:02d}"` |

**Sort order**: TreeMap supplier in Java → sorted by key asc. Python `sorted(d.items())`.

For each period bucket, compute aggregated metrics:
- `totalInspections` = sum
- `firstPassCount` = sum
- `defectCount` = sum
- `fpy` = (firstPass/totalInsp) percentage, HALF_UP scale-2
- `defectRate` = (defect/totalInsp) percentage, HALF_UP scale-2

Data point dict (LinkedHashMap order, Java line 757-762):
```python
{"date": date_key, "fpy": fpy_dec, "defectRate": defect_rate_dec, "totalInspections": total_inspections}
```

ChartConfig output (Java line 770-779, **after Rule 9.1 lowercase fix**):
```python
{
    "chartType": "LINE",
    "title": "质量趋势",
    "xaxisField": "date",            # ← Rule 9.1: lowercase 'a'
    "yaxisField": "fpy",
    "seriesField": "metric",
    "data": chart_data,
    "options": {"showLegend": True, "multiLine": True, "yAxisMax": 100},
}
```

### 3.7 Defect Pareto chart (Java line 785-830)

Same pattern as defect type ranking, but emits chart points instead of RankingItem. Cumulative percentage included in each data point.

### 3.8 Quality cost distribution chart (Java line 835-864)

Pie chart: 2 slices (`返工成本` rework + `报废成本` scrap). 

```python
chart_data = [
    {"category": "返工成本", "cost": rework_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)},
    {"category": "报废成本", "cost": scrap_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)},
]
```

### 3.9 Product line quality comparison chart (Java line 869-919)

For each production line: aggregate FPY + defectRate. Data points emitted in **HashMap iter order** of `groupedByLine` (NOT sorted by FPY). This is Rule 9 / Map ordering risk site — apply `_sort_entries_java_iter_then_value_desc` with line names as keys.

```python
def _build_product_line_quality_comparison_from_data(quality_data: list[dict]) -> dict:
    grouped: dict[str, list[dict]] = {}
    for r in quality_data:
        grouped.setdefault(r["productionLine"], []).append(r)

    # Java HashMap iter order — apply helper
    iter_order_keys = [
        kv[0] for kv in _sort_entries_java_iter_then_value_desc(
            [(k, len(v)) for k, v in grouped.items()]
        )
    ]
    # NOTE: helper sorts by value desc as tiebreak, but we don't want that here —
    # we want pure Java HashMap iter order. Use a variant that doesn't value-sort.
    # See D4 + open question Q-MAP-1 below.
    ...
```

⚠️ **Open issue**: `_sort_entries_java_iter_then_value_desc` *also* re-sorts by value desc. For sites where Java doesn't sort but just iterates, we need the pure-iter helper. Either extend `_java_compat.py` with `_java_hashmap_iter_order(items)` (bucket-asc + reverse-within-bucket only), or accept the value-desc tiebreak when chart data values differ.

**Phase B impl Day 1 task**: confirm via golden whether comparison chart points are in HashMap-iter order or some other order; pick helper accordingly.

### 3.10 Quality insights generation (rule-based — Java line 924-1007)

3 insight categories:
1. **FPY-based** (line 928-958): RED < 95, YELLOW < 98, GREEN ≥ 98 — message + actionSuggestion templates
2. **Top defect type** (line 960-990): IF top type ratio > 30%, emit YELLOW insight with `relatedEntity = topType`
3. **Customer complaint** (line 992-1004): IF complaintCount > 10, emit RED insight

Templates use `String.format("%.2f%%", x)` (Rule 12). Insights inserted to list in fixed order (FPY first, defect-type second, complaint third).

### 3.11 Quality suggestions generation (rule-based — Java line 1012-1075)

4 suggestion types in fixed order:
1. **Top 3 defect types** (line 1017-1032): if ≥1 defect, emit "主要不良类型为：X、Y、Z，建议优先改善"
2. **Rework rate** (line 1034-1050): if reworkRate > 10%, emit "返工率较高..."
3. **Production line gap** (line 1052-1064): if best.value - worst.value > 3, emit "%s 的 FPY (X.XX%%) 明显高于 %s (X.XX%%)..."
4. **Cost comparison** (line 1066-1072): if scrapCost > reworkCost, emit "报废成本高于返工成本..."

Format strings using `String.format("%.2f%%", x)` × 2 in suggestion 3 (Rule 12).

---

## 4. F999 byte-shape gates (8 个 goldens)

### 4.1 Golden 录制 (HARD prereq for impl PR)

```bash
# Recording prereq (HARD): T-MOCK-1 + T-MOCK-2 verified BEFORE running record-java-golden.sh
# (else fake-shape goldens lock in pre-fix Random divergence)

# F999 (test fixture factory, dataset shape: empty Gold POS but mock generator
# uses factoryId.hashCode() seed → deterministic data regardless of DB state)
./scripts/record-java-golden.sh F999 \
  /api/mobile/F999/smart-bi/analysis/quality \
  "?startDate=2026-01-01&endDate=2026-01-31&analysisType=fpy" \
  > tests/fixtures/java-smartbi-golden/analysis-quality-F999-fpy.json

./scripts/record-java-golden.sh F999 \
  /api/mobile/F999/smart-bi/analysis/quality \
  "?startDate=2026-01-01&endDate=2026-01-31&analysisType=defect" \
  > tests/fixtures/java-smartbi-golden/analysis-quality-F999-defect.json

./scripts/record-java-golden.sh F999 \
  /api/mobile/F999/smart-bi/analysis/quality \
  "?startDate=2026-01-01&endDate=2026-01-31&analysisType=rework" \
  > tests/fixtures/java-smartbi-golden/analysis-quality-F999-rework.json

# Default (overview) mode — no analysisType param
./scripts/record-java-golden.sh F999 \
  /api/mobile/F999/smart-bi/analysis/quality \
  "?startDate=2026-01-01&endDate=2026-01-31" \
  > tests/fixtures/java-smartbi-golden/analysis-quality-F999-default.json

# F001 customer factory (real prod data exists in some tables but mock generator
# ignores DB state — Random seed determined by "F001".hashCode())
# Same 4 calls with F001
./scripts/record-java-golden.sh F001 ... × 4
```

**Date range choice**: 2026-01-01 to 2026-01-31 (31 days) gives `(31+1) × 4 × 3 = 384 records` per call × 8 Random advances = 3072 Random.next* calls per generation. Sufficient to surface any LCG sequence bug.

**Why F999 + F001**:
- F999 = internal test factory, low-traffic, safe for golden recording side-effects
- F001 = top customer factory, "Gold-populated cohort" pair (per memory `feedback_30s_precheck_selective_bug_pattern`) — but mock generator IGNORES DB state, so only `factoryId.hashCode()` matters; both will produce mock data of identical shape with different seeds

### 4.2 Byte-shape gate strategy (Phase 2A dict-eq per Rule 4)

Comparison rule: `dict_eq(java_response, python_response, strip_volatile=True)` where `_strip_volatile` removes `generatedAt` + `lastUpdated` from both sides (D14).

**Acceptance**:
- ✅ FPY 99.9999 ≡ 99.9999 (Decimal scale preserved post-D9 fix)
- ✅ Decimal int-collapse (Pattern A): `value: 100` (Python int) ≡ `value: 100.00` (Java BigDecimal scale-2) tolerated
- ✅ Decimal trailing-zero (Pattern A2): `value: 33.33` (Python float) ≡ `value: 33.3300` (Java BigDecimal scale-4) tolerated
- ❌ Field name divergence (e.g. `xAxisField` vs `xaxisField`) — FAIL, must fix per Rule 9.1
- ❌ Numeric value mismatch (e.g. fpy 95.50 vs 95.49) — FAIL, indicates Random sequence drift or Rule 10 bug

### 4.3 `_strip_volatile` extension

```python
# Add to schema_compat.py (or new helper module)
_VOLATILE_KEYS_QUALITY = frozenset({
    "generatedAt", "lastUpdated",
})

def _strip_volatile_for_quality(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile_for_quality(v) for k, v in obj.items()
                if k not in _VOLATILE_KEYS_QUALITY}
    if isinstance(obj, list):
        return [_strip_volatile_for_quality(v) for v in obj]
    return obj
```

Or extend existing `_strip_volatile` in `analysis_drilldown.py` if applicable (audit pattern reuse during PR-A).

---

## 5. Test strategy

### 5.1 PR-A contract tests

```python
# tests/python/smartbi_compat/test_analysis_quality.py

import json
from pathlib import Path
import pytest
from datetime import date
from smartbi_compat.api import analysis_quality as aq

GOLDEN_DIR = Path(__file__).parent / "fixtures" / "java-smartbi-golden"

@pytest.mark.parametrize("factory,mode", [
    ("F999", "fpy"),
    ("F999", "defect"),
    ("F999", "rework"),
    ("F999", "default"),
    ("F001", "fpy"),
    ("F001", "defect"),
    ("F001", "rework"),
    ("F001", "default"),
])
def test_dispatcher_byte_shape_parity(factory, mode):
    """Test dispatcher produces dict-eq byte shape vs Java prod golden."""
    golden_file = GOLDEN_DIR / f"analysis-quality-{factory}-{mode}.json"
    java_response = json.loads(golden_file.read_text())

    # Mock current time so generatedAt/lastUpdated are deterministic
    # OR use _strip_volatile_for_quality
    python_response = aq._get_quality_analysis(
        factory_id=factory,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        analysis_type=None if mode == "default" else mode,
    )

    java_clean = _strip_volatile_for_quality(java_response)
    python_clean = _strip_volatile_for_quality(python_response)
    assert python_clean == java_clean, (
        f"dict-eq failure for factory={factory} mode={mode}\n"
        f"diff: {_dict_diff(java_clean, python_clean)}"
    )


def test_javarandom_matches_java_reference():
    """Verify JavaRandom LCG matches Java reference seed sequence (T-MOCK-1)."""
    from smartbi_compat._java_random import JavaRandom, java_string_hashcode

    # Pre-recorded Java reference for seed = "F999".hashCode()
    expected_first_10_nextint_200 = [...]  # from tests/fixtures/java_random_reference.json
    expected_first_10_nextdouble = [...]

    seed = java_string_hashcode("F999")
    rng = JavaRandom(seed)
    actual_nextint = [rng.next_int(200) for _ in range(10)]
    assert actual_nextint == expected_first_10_nextint_200

    rng = JavaRandom(seed)
    actual_nextdouble = [rng.next_double() for _ in range(10)]
    # Float comparison: tolerate 1e-15 epsilon (LCG is bit-exact, rounding via division
    # may produce IEEE 754 rounding diff in last 1-2 ulps)
    for actual, expected in zip(actual_nextdouble, expected_first_10_nextdouble):
        assert abs(actual - expected) < 1e-15


def test_string_hashcode_matches_java():
    """Verify java_string_hashcode produces 32-bit signed int matching Java."""
    from smartbi_compat._java_random import java_string_hashcode

    # Pre-recorded Java reference values
    cases = [
        ("F999", 2192349),     # verify Java: "F999".hashCode()
        ("F001", 2192254),     # verify
        ("hello", 99162322),   # well-known JDK reference
        ("", 0),
    ]
    for s, expected in cases:
        assert java_string_hashcode(s) == expected, f"hashcode({s!r}): expected {expected}"


@pytest.mark.parametrize("fpy_pct, expected_alert", [
    (Decimal("94.99"), "RED"),
    (Decimal("95.00"), "YELLOW"),  # boundary: Java < FPY_RED_THRESHOLD (95) → YELLOW
    (Decimal("97.99"), "YELLOW"),
    (Decimal("98.00"), "GREEN"),   # boundary
])
def test_fpy_alert_level_thresholds(fpy_pct, expected_alert):
    assert aq._determine_fpy_alert_level(fpy_pct) == expected_alert


@pytest.mark.parametrize("rate, expected_alert", [
    (Decimal("1.49"), "GREEN"),
    (Decimal("1.50"), "GREEN"),     # boundary: Java > 1.5 (strict) → GREEN
    (Decimal("1.51"), "YELLOW"),    # ⚠ Rule 7: must use Decimal compare, NOT float
    (Decimal("3.01"), "RED"),
])
def test_quality_cost_alert_level_thresholds(rate, expected_alert):
    """⚠ Rule 7 hard test: 1.5 boundary uses Decimal arithmetic, not float."""
    assert aq._determine_quality_cost_alert_level(rate) == expected_alert
```

### 5.2 PR-A internal helper byte-shape tests (productLine 8/9/10)

Methods 8/9/10 are not exposed via route, but are byte-shape building blocks for `_get_quality_summary`. Direct unit test against synthesized mock data:

```python
def test_product_line_quality_ranking_internal_byte_shape():
    """Method 9: _calculate_product_line_quality_ranking_from_data."""
    mock_data = aq._generate_mock_quality_data("F999", date(2026, 1, 1), date(2026, 1, 31))
    rankings = aq._calculate_product_line_quality_ranking_from_data(mock_data)

    # Rule 9 Lombok @Data field order verified via golden
    expected_keys = ["rank", "name", "value", "target", "completionRate", "alertLevel"]
    for r in rankings:
        assert list(r.keys()) == expected_keys, f"Field order: {list(r.keys())}"

    # Rank field set correctly
    assert all(r["rank"] == i + 1 for i, r in enumerate(rankings))
```

### 5.3 PR-A arithmetic depth tests (Rule 10 compliance)

```python
@pytest.mark.parametrize("fpc, total, expected", [
    # Rule 10 lock-in: divide(scale=4, HALF_UP).multiply(100), final scale=2
    (1, 3, Decimal("33.33")),       # 1/3 = 0.3333 * 100 = 33.33
    (2, 3, Decimal("66.67")),       # 2/3 = 0.6667 * 100 = 66.67
    (1, 7, Decimal("14.29")),       # 1/7 = 0.1429 * 100 = 14.29
])
def test_percentage_rule_10_compliance(fpc, total, expected):
    """Rule 10: divide-then-multiply with intermediate scale=4 HALF_UP."""
    actual = aq._percentage_java(Decimal(fpc), Decimal(total), scale=4)
    actual_display = actual.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert actual_display == expected
```

### 5.4 PR-A boundary tests

```python
def test_empty_date_range_returns_empty_dashboard():
    """getDefectAnalysis returns empty list when no data."""
    # date range 0 days = 1 day inclusive (start == end), still has 12 records
    # To get truly empty, need to mock generate_mock_quality_data
    # OR test buildEmptyDashboard path directly
    result = aq._build_empty_dashboard()
    assert result["kpiCards"] == []
    assert result["aiInsights"][0]["level"] == "YELLOW"
    assert result["aiInsights"][0]["category"] == "数据状态"


def test_single_day_range():
    """Verify single-day range generates 1 day × 4 lines × 3 products = 12 records."""
    mock = aq._generate_mock_quality_data("F999", date(2026, 1, 1), date(2026, 1, 1))
    assert len(mock) == 12
```

### 5.5 PR-B reviewer audit checklist

**Per `.claude/rules/python-java-port.md`**:
- [ ] **Rule 1**: All Java `!= null` checks → Python `is not None` (not `or` fallback). Especially in `_generate_quality_insights` filter chains.
- [ ] **Rule 2**: WEEK period key uses calendar date (not ISO year) — D13 Monday-of-week pattern is calendar.
- [ ] **Rule 3**: Function signatures 1:1 mirror Java (factory_id, start_date, end_date) — no DateRange wrapper.
- [ ] **Rule 4**: `_decimal_to_number` applied to all Decimal-valued JSON outputs. Verify: KPI value, RankingItem value/target/completionRate, ChartConfig data points, MetricResult value.
- [ ] **Rule 5**: SQL helpers — N/A (mock data, no SQL).
- [ ] **Rule 6**: Input boundary None-check — N/A for mock generator (factory_id always present from path param).
- [ ] **Rule 7**: ⚠ HARD — `QUALITY_COST_YELLOW_THRESHOLD = Decimal("1.5")` not `float(1.5)`.
- [ ] **Rule 8**: `Map.of(N)` order — N/A (Java code uses LinkedHashMap throughout, no Map.of). But still verify chartData LinkedHashMap dict literal order against golden.
- [ ] **Rule 9**: Lombok DTO field order — verified via golden. xaxisField/yaxisField lowercase per 9.1.
- [ ] **Rule 10**: BigDecimal divide-then-multiply intermediate scale=4 HALF_UP — see §5.3 tests + D9 helper.
- [ ] **Rule 11**: `LocalDateTime` → `_java_isoformat` for generatedAt/lastUpdated. (Or strip via volatile.)
- [ ] **Rule 12**: All `String.format` sites → `_format_decimal_half_up` or new `_format_currency_java` helper. 7 sites identified in §2.2 D6.

**Plus quality-specific**:
- [ ] T-MOCK-1: JavaRandom verified vs Java reference seed sequence (50+ output values).
- [ ] T-MOCK-2: `_generate_mock_quality_data("F999", ...)` Python output byte-equal Java pre-recorded golden.
- [ ] D11: `LocalDateTime.now(Asia/Shanghai)` consistency (or volatile-strip).
- [ ] D14: `_strip_volatile_for_quality` correctly removes generatedAt + lastUpdated.

### 5.6 Test env smoke (PR-B)

```bash
# Deploy to test env (Python 8084)
./scripts/deploy/deploy-smartbi-python.sh --env test

# Smoke 4 modes × 2 factories = 8 endpoints
for factory in F999 F001; do
  for mode in fpy defect rework default; do
    qs="?startDate=2026-01-01&endDate=2026-01-31"
    [ "$mode" != "default" ] && qs="$qs&analysisType=$mode"

    java_resp=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "http://47.100.235.168:10011/api/mobile/$factory/smart-bi/analysis/quality$qs")
    py_resp=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "http://47.100.235.168:8084/api/mobile/$factory/smart-bi/analysis/quality$qs")

    # dict-eq compare via Python helper
    python -c "
import json
import sys
from smartbi_compat.testing import dict_eq, strip_volatile_for_quality
java = json.loads('''$java_resp''')
py = json.loads('''$py_resp''')
assert dict_eq(strip_volatile_for_quality(java), strip_volatile_for_quality(py)), \
    'parity FAIL for $factory $mode'
print('OK $factory $mode')
"
  done
done
```

---

## 6. Byte gate 语义 (Phase 2A dict-eq, per Rule 4)

Phase 2A 锁定 dict-eq, NOT strict-byte. Per `.claude/rules/python-java-port.md` Rule 4 §"Phase 2A dict-eq gate — official standard":

- Pattern A integer-Decimal int-collapse: tolerated
- Pattern A2 scale-4 trailing-zero loss: tolerated
- Pattern B (Java legacy fallback): N/A — Quality has no Gold/Silver split, all data from mock generator
- Map.of order divergence: N/A — Quality uses LinkedHashMap throughout
- Lombok null emit: applies (Rule 9)
- LocalDateTime microsecond: applies (Rule 11) — strip via D14

T6.6 inherits Phase 2A standard. NO upgrade to strict-byte required for Quality port.

---

## 7. PR 切片 + 顺序

### 7.1 PR-A: dispatcher + 7 service methods + JavaRandom + 8 goldens

**Branch**: `phase2a/impl-quality` (or whatever Phase B kickoff specifies)
**Reviewer**: organizer + sister chat (Chat M production for `JavaRandom` reusability cross-check)

**Commits** (suggested):
1. `feat(smartbi-compat): add JavaRandom + java_string_hashcode helper (T-MOCK-1 prereq)`
2. `feat(smartbi-compat): /analysis/quality 4-branch dispatcher + 7 service methods (PR-A)`
3. `test(smartbi-compat): /analysis/quality byte-shape parity vs F999/F001 goldens × 8 (PR-A tests)`

**Effort**: 1.5 person-days (per PR #196 §3.2, post-Phase-A discovery shrunk from 2-3d).

**GO criteria → PR-B**:
- [ ] All 8 dispatcher tests pass dict-eq
- [ ] All internal helper tests pass (productLine 8/9/10)
- [ ] All Rule-compliance tests pass (Rule 7 / Rule 10 / Rule 12 / Rule 9 field order)
- [ ] T-MOCK-1 + T-MOCK-2 verified
- [ ] No flake8/ruff lint errors

### 7.2 PR-B: Reviewer audit + smoke + test env deploy

**Branch**: same as PR-A (or follow-up commits)
**Reviewer**: organizer + dedicated reviewer chat (per Phase 2A audit pattern)

**Activities**:
1. Reviewer runs §5.5 Rule 1-12 checklist
2. Reviewer self-runs §5.6 smoke against test env 8084 vs Java 10011
3. Sign-off in PR description
4. Deploy script verifies (`deploy-smartbi-python.sh --env test` exit 0 + smoke green)

**Effort**: 0.5 person-day.

**GO criteria → Phase C cutover (organizer dispatch separate)**:
- [ ] Test env smoke: 8/8 calls dict-eq match
- [ ] Reviewer audit complete (Rules 1-12 each ✅)
- [ ] No regression in existing Phase 2A endpoint smoke (regression-protect via deploy script post-deploy smoke)
- [ ] Java prod 10010 `/analysis/quality` still serves correctly (NOT touched by Phase B)

### 7.3 Out-of-scope follow-ups

- T6.6 Phase C nginx cutover (single-shot edit to add `quality` to nginx regex; covered in PR #180 §2.5)
- T6.6 Phase D Java method body removal (T+30d post-cutover)
- Real-DB upgrade (Open Question 1 in PR #196 — Steve sign-off needed)

---

## 8. Open risks + mitigations

### 8.1 Q-MAP-1: Pure Java HashMap iter order helper missing

`_sort_entries_java_iter_then_value_desc` re-sorts by value desc as final step. For sites where Java just iterates without value-sort (e.g. `buildProductLineQualityComparisonFromData` line 875), we need a no-value-sort variant.

**Mitigation**: Phase B impl Day 1 either:
- (a) Extend `_java_compat.py` with `_java_hashmap_iter_order(items: list[tuple]) -> list[tuple]` (bucket-asc + reverse-within-bucket only), OR
- (b) Record golden for comparison chart, see whether Java actually iterates in some predictable order, OR
- (c) Determine via experiment that for 4 production lines (small map), HashMap bucket placement is unique → iter order is bucket-asc only

Recommend (a) — cheapest defensive measure, also benefits Chat M production sister.

### 8.2 R1: Java `Random.nextInt` bias-correction loop divergence

Java `Random.nextInt(int bound)` uses bias-correction loop for non-power-of-2 bounds. Python port must replicate exactly. T-MOCK-1 test catches this.

**Mitigation**: Use 200-call sample as T-MOCK-1 verification; specifically include cases where bias correction triggers (bound 200, large random sample).

### 8.3 R2: Mock data generator side-effect on `Random` state across loop iterations

Each (date, line, product) tuple advances Random state by 8 calls. If Python port has any **early-exit** condition (e.g. `if total == 0: continue`), state advances diverge. Java code has NO early exit. Python must mirror exactly.

**Mitigation**: PR-A impl reviews for early-exit branches; PR-B reviewer specifically grep for `continue` / `break` / `if ... : return` inside generation loop.

### 8.4 R3: `_generate_quality_insights` rule order divergence

Insights inserted to list in 3 fixed orders (FPY → defect-type → complaint). If Python uses HashMap-iter-order somewhere upstream (e.g. `defectsByType` for top-defect-type lookup), the topType identity could diverge. Java line 967 uses `Map.Entry.comparingByValue` for `max` selection — DETERMINISTIC if values are unique; ambiguous if tied.

**Mitigation**: Phase B impl Day 1 verify `defectsByType` value uniqueness in mock data. If ties possible, document explicitly + use stable tiebreak.

### 8.5 R4: Suggestion 3 (FPY gap) requires `lineRankings` sorted by FPY desc

`generateQualitySuggestions` line 1053-1062 calls `calculateProductLineQualityRankingFromData` (line 670) which sorts by FPY desc. Python port reuses same helper — should be deterministic.

**Mitigation**: Verify via §5.2 internal helper test.

### 8.6 R5: Decimal literal precision in `Decimal("0.02 + ...")`

Java `0.02 + random.nextDouble() * 0.06` is `double` arithmetic. Java multiplied by `int totalInspections` then cast `(int)`. Python must mirror IEEE 754 double behavior. Python `float` is IEEE 754 → safe. **DO NOT** convert intermediate to Decimal — the cast is `(int)` truncation of `double`, not `Decimal` rounding.

**Mitigation**: Python code uses `int(total * (0.02 + rng.next_double() * 0.06))` with `float` arithmetic; only cast to `Decimal` at the END for cost columns (`reworkCost`, `scrapCost`).

### 8.7 R6: T6.5 Phase B + C complete delay pushes T6.6 Phase B beyond Aug 2026

PR #180 §1 says T6.5 Phase B 410-stub + 30-day soak prereq. Phase 2A complete 2026-05-09; T6.5 Phase B/C estimated mid-late June + mid-July. Earliest T6.6 Phase B kickoff ~2026-08-15.

**Mitigation**: This spec written now; freeze + revisit at T6.5 Phase C complete. Spec re-validation at kickoff (≤2 hours; check Java source unchanged via `git diff origin/main..QualityAnalysisServiceImpl.java`).

### 8.8 R7: Production / Quality mock-vs-real-DB Steve decision pending (Open Question 1)

If Steve mandates real-DB upgrade, this spec ENTIRELY scope-creeps to "design quality DB schema + ETL + repository + service" — 3-5x effort. PR #196 §7 Q1 surfaced this; default = mock parity.

**Mitigation**: Phase B kickoff marching order MUST include "Steve sign-off Q1: keep mock parity" as prerequisite. If Steve flips to real-DB, this spec is voided + new spec required.

### 8.9 R8: Sister chat coordination on JavaRandom helper

Chat M production sister chat ALSO needs `JavaRandom` for `generateMockProductionData`. If we both write the helper independently, conflict.

**Mitigation**: Phase B kickoff organizer SHOULD designate either:
- (a) Chat N (this) lands JavaRandom in PR-A pre-quality; Chat M imports from it post-merge
- (b) Pre-PR foundation chat lands JavaRandom standalone before either Quality/Production sister kicks off
- Recommend (a) — clearer ownership, lighter coordination overhead.

### 8.10 R9: Test env F999 access requires JWT for "internal" factory

F999 is internal test factory — JWT may need different scope/role than F001 customer factory. Recording goldens via `record-java-golden.sh` should already handle this (existing F999 goldens recorded successfully Apr 30); verify token scope at PR-A start.

**Mitigation**: PR-A Day 1 task: run `record-java-golden.sh F999 ...test query...` to confirm token works before formal recording.

---

## 9. References

- PR #180 base spec (`docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md`)
- PR #196 Phase A design (`docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md`)
- PR #178 T6.5 Phase A audit (Java SmartBI deletion candidates)
- PR #150 T6.5 Phase B/C/D deprecation spec
- `.claude/rules/python-java-port.md` (Rules 1-12 governance)
- `backend/python/smartbi_compat/_java_compat.py` (`_format_decimal_half_up`, `_java_hashmap_bucket`, `_sort_entries_java_iter_then_value_desc`)
- `backend/python/smartbi_compat/api/analysis_drilldown.py` (`_strip_volatile` extraction pattern)
- Phase 2A spec corpus (procurement / inventory / department / region / sales) — pattern source
- Java sources:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` (line 373-407)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/QualityAnalysisService.java` (interface, 270 LOC)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java` (impl, 1202 LOC)

---

## 10. ⛔ HOLD Blocks

- ⛔ This is a **detail spec / planning artifact only** — NOT a marching order. T6.6 Phase B kickoff requires fresh marching order from organizer with chat assignment + concrete artifact paths.
- ⛔ T6.6 Phase B kickoff requires T6.5 Phase B + C complete ≥30 days. ETA ~2026-08-15.
- ⛔ Steve sign-off needed on Q1 (mock parity vs real-DB upgrade) BEFORE Phase B kickoff. PR #196 §7 Q1.
- ⛔ T-MOCK-1 + T-MOCK-2 (JavaRandom verification) MUST pass BEFORE recording 8 goldens — else fake-shape goldens lock in pre-fix divergence.
- ⛔ Concurrent-edit safety: PR-A impl chat MUST coordinate with Chat M production sister on `JavaRandom` helper (see R9 mitigation §8.9).
- ⛔ Phase B impl chat MUST verify Java source unchanged at kickoff (`git diff origin/main..QualityAnalysisServiceImpl.java` since 2026-05-09 spec write date).
- ⛔ Existing stale goldens (`analysis-quality-F{001,999}.json` recorded 2026-04-30, default-mode-only) MUST be deleted in same commit as new 8 mode-specific goldens (per Rule §2.4 no-orphan-goldens).

---

## 11. Sign-off

Before T6.6 Phase B PR-A kickoff this detail spec reviewed by:

- [ ] Engineering organizer (timing + scope acceptable; T6.5 Phase B/C dependency lock)
- [ ] Chat M `/analysis/production` sister spec writer (JavaRandom helper coordination per R9 §8.9)
- [ ] Phase 2A intent classifier owner / chat 3 (cross-cycle audit)
- [ ] Phase B impl chat (this chat or fresh chat assigned at kickoff)
- [ ] Steve (Q1 mock-vs-real-DB sign-off per PR #196 §7 Q1)

Sign-off recorded in PR description when this spec merges main.

---

**End of T6.6 Phase B `/analysis/quality` Endpoint Port — Detail Spec**
