# Phase 2A `/analysis/inventory` per-type real impl — Design Spec

**Date**: 2026-05-01
**Branch**: `phase2a/spec-inventory`
**Worktree**: 主 (this is spec-only, impl chats 启动时再开 worktree)

**Predecessors**:
- PR #18 — finance payable per-type (per-type pattern source)
- PR #21 + #22 — finance profit per-type
- PR #25 + #28 — finance cost per-type + arithmetic depth
- PR #30 — `_get_period_key` calendar-year fix (Rule 2)
- PR #32 — finance 3 sub-endpoints (budget-achievement / yoy-mom / category-comparison)
- PR #33 / #34 — finance receivable / budget specs (per-type pattern peers)
- PR #35 — Rule 8 入 `python-java-port.md` (`Map.of(N)` Jackson hash order)
- PR #36 — `/analysis/department` composite spec (sister Tier 2 lock-in 模式来源)
- PR #37 — defer quality + production (Java mock-only); **关键参考: Process Rule §2.4 mock taxonomy 区分**
- PR #38 — finance budget per-type real impl (PR-A pattern)
- PR #39 — `/datasource` fields + history GET
- **PR #40 — `/analysis/procurement` per-type spec (Tier 2 直接前驱, 4-mode dispatcher 模板源)**
- PR #41 — `/analysis/region` per-type spec (sister Tier 2)

**Sister chats in flight**:
- 无并发 sister Tier 2 chat (procurement / region / department 已 ship; quality / production deferred per #37)
- inventory 是 Tier 2 第 4 个 spec, 模板成熟; 重点是 inventory-specific traps

**Inherited audit constraints**:
- 全部参见 [`.claude/rules/python-java-port.md`](../../../.claude/rules/python-java-port.md) Rule 1-8
- Rule 8 (Map.of(N) hash order, post-PR #35) — inventory 实际**不触发** (源码 grep 验证: 无 `Map.of` 调用站点, 全 `LinkedHashMap.put()` + `Arrays.asList`), 但 §8 仍预防性引用 + LinkedHashMap insertion-order trap (T-INV-5) 占据等同重要性

**Audit history**:
- Round 1 self-review + Round 2 evidence-based grep verify (T-INV-1 ~ T-INV-12 全 lock-in, 见 §3 + §7)
- Round 3 reviewer audit (subagent dispatch on §1+§2+§3 design — pre spec-write)
- Round 4 cross-spec audit (cite procurement #40 + region #41 + department #36 + PR #37 mock-defer + Rule 1-8)
- Round 5 fresh subagent audit (post spec-write, before push)

---

## 1. 背景 + 范围锁定

### 1.1 当前状态（main HEAD `34f1e135c`）

`/api/mobile/{factoryId}/smart-bi/analysis/inventory` 在 Python 端**不存在** path handler。Java 端：
- `SmartBIAnalysisController.getInventoryAnalysis` (`SmartBIAnalysisController.java:411-448`) 4 modes 分支 (无 SmartBIService composite 包装，直接 controller 内 dispatch — 跟 procurement #40 同 pattern, 不像 department composite)
- `InventoryHealthAnalysisServiceImpl @Service` (line 50) 用 `@RequiredArgsConstructor` 注入 4 dependencies:
  - `MaterialBatchRepository` (REAL JPA)
  - `MaterialConsumptionRepository` (REAL JPA)
  - `MaterialBatchAdjustmentRepository` (REAL JPA)
  - `MetricCalculatorService` (注入但实际不使用 — 见 §1.4)
- 4 modes (analysisType): `turnover` / `expiry` / `aging` / `null` (default = `getInventoryHealth` DashboardResponse)
- 15 service methods total in interface; 10 controller-dispatched; 5 internal-only (loss + healthScore + radar)
- **Mock-check (Process Rule §2.4)**: 1352 LOC of REAL DB query — **类别 B 局部 mock** 仅 1 处 (`getLossTrendChart` line 634 hardcoded `BigDecimal.ZERO` per month with comment "简化处理"). 跟 PR #37 deferred quality/production (类别 A 全 mock generator) **不同决策**, 见 §1.3

### 1.2 这一 chat 范围

实施 **inventory 4 modes real impl**, single spec covers ALL 4 modes + 12 traps; PR 切片 by §6:

**完整 in-scope sub-services (per controller line 426-441)**:

| analysisType | Sub-services 调用 | 输出 keys |
|---|---|---|
| `turnover` | `getTurnoverAnalysis` + `getTurnoverByCategory` + `getTurnoverTrendChart(period="MONTH")` | `[startDate, endDate, metrics, ranking, trendChart]` |
| `expiry` | `getExpiryRiskAnalysis` + `getExpiringBatchesRanking(daysToExpiry=30)` + `getExpiryRiskChart` | `[startDate, endDate, riskAnalysis, expiringBatches, riskChart]` |
| `aging` | `getAgingMetrics` + `getInventoryAgingChart` + `getLongAgingBatchesRanking(minDays=60, **inclusive `>=`**)` | `[startDate, endDate, agingMetrics, agingChart, longAgingBatches]` |
| default | `getInventoryHealth` (DashboardResponse) | `[startDate, endDate, overview]` |

**Helpers + scoring functions** in scope:
- 4 named alert-level helpers: `determineTurnoverAlertLevel` / `determineInventoryDaysAlertLevel` / `determineExpiryRiskAlertLevel` / `determineLossRateAlertLevel`
- 4 inline alert decisions (NOT helpers, embedded in service methods):
  - `getExpiringBatchesRanking` per-batch: `<=7天 RED, <=15天 YELLOW, else GREEN` (line 398-404)
  - `getLongAgingBatchesRanking` per-batch: `>120天 RED, >90天 YELLOW, else GREEN` (line 798-805)
  - `getAgingMetrics` SLOW_MOVING_RATE inline: `>20% RED, >10% YELLOW, else GREEN` (line 747-751, **inverse**)
  - `getHealthScore` overall: `>=80 GREEN, >=60 YELLOW, else RED` (line 903-910)
- Aggregation helpers: `calculateTotalInventoryValue` (line 1058) — uses `getCurrentQuantity()` `@Transient` formula
- `getCurrentQuantity()` `@Transient` formula (`MaterialBatch.java:167-175`): `receiptQuantity - usedQuantity - reservedQuantity` (null-safe: usedQuantity/reservedQuantity null→ZERO; receiptQuantity null→entire return ZERO)
- 2 rule-based generators: `generateAiInsights` (line 1107-1177) + `generateSuggestions` (line 1182-1217) — NO LLM, byte-port-able
- Rule-based dashboard builders: `calculateKpiCards` / `buildMaterialCategoryValueChart` / `buildEmptyDashboard` / `convertToKPICards` / `formatCurrency`
- Internal-only health score + radar: `getHealthScore` (line 824-921) + `getHealthRadarChart` (line 925-998) — 仅 default mode 经 `calculateKpiCards` 链式调用; 不被 controller direct dispatch

### 1.3 显式不在范围 + Mock taxonomy A/B 区分

**Mock-port 决策 — inventory 是 类别 B (局部硬编码常量), 不 defer 整个 endpoint:**

```
Inventory mock taxonomy (区分两类 Java mock 的 port 决策):

类别 A — 全 mock generator (deferred per PR #37):
  - quality: generateMockQualityData(Random(factoryId.hashCode()) LCG seed)
  - production: 同上 generateMockProductionData
  - 决策: 全 endpoint deferred. byte-port 不可达
    (Java LCG 算法 ≠ Python Mersenne Twister; seeded sequences 不可重现).
  - PR #37 已 ship docs/superpowers/specs/2026-05-01-defer-quality-production-design.md

类别 B — 局部硬编码常量 (本 spec inventory T-INV-8):
  - getLossTrendChart line 634-637: lossAmount = BigDecimal.ZERO 每月填 0 + 注释
    "简化处理：使用固定的损耗数据"
  - 决策: byte-port 可达 (literal 0 是 deterministic constant), Python mirror as zeros.
    NOT defer entire inventory endpoint, 因为:
      a) getLossTrendChart 仅 default mode 内部 chart 之一, 实际还不被 default mode 调用
         (default mode 只调 calculateKpiCards / getInventoryAgingChart / getExpiryRiskChart /
         buildMaterialCategoryValueChart, NOT getLossTrendChart)
      b) 其他 14 个 service methods 全 real DB query
      c) 即使 future 把 getLossTrendChart 接入 default mode, mock-zero literal 仍可 byte-port

  - 这跟 PR #37 deferred 决策不矛盾, 是 sub-domain 级 vs entire-service 级的 mock 区分。
  - 防御性: PR-C arithmetic depth tests 包含 TestInventoryLossTrendChartMock
    显式断言 12 月输出全 0, 防 future 改动偷偷接入 real query.
```

**Out of scope (不 port to Python)**:
- `getLossAnalysis` / `getLossReasonChart` / `getLossTrendChart` / `getHealthScore` / `getHealthRadarChart` **作为独立 controller mode** — 它们都不被 controller dispatch
  - **BUT** `getHealthScore` 必须 port 因为 `calculateKpiCards` (default mode) 链式调用 (line 1049)
  - `getHealthRadarChart` 也 port 因为 default mode 的 charts list 中**虽未直接 add** 但 sister specs 模板要求 dashboard 展示综合指标; **Apply 验证**: 实际看 `getInventoryHealth` line 105-108, charts list 只有 `getInventoryAgingChart` + `getExpiryRiskChart` + `buildMaterialCategoryValueChart` — radar **不在内**; **决策**: PR-B 不 port `getHealthRadarChart`, `getLossAnalysis`, `getLossReasonChart`, `getLossTrendChart` (4 个 internal methods 全 not-reached); 仅 port `getHealthScore` (KPI card chain reach)
- T6 nginx cutover (独立 phase)
- AI insights LLM 路径 (inventory aiInsights 是 rule-based, 不涉 LLM)
- Byte gate 升级 strict-byte (Phase 2A backlog)
- `MaterialBatchStatus` enum 多状态展开 (Java 仅 query `AVAILABLE`, 其他 IN_STOCK/FRESH/EXPIRED/SCRAPPED 不 query — Python mirror)
- Java side T-INV-9 asymmetric-null fix (cleanup follow-up; out of Phase 2A scope)
- Java side `findExpiringBatches` ORDER BY 二级 tiebreaker 缺失 (out of Phase 2A scope; 见 §7 risks)

### 1.4 Inventory-specific 设计差异 vs sister specs

| 维度 | procurement #40 | region #41 | department #36 | **inventory** |
|---|---|---|---|---|
| 模式数 | 4 (supplier/cost/trend + default) | 4 (sales/cost/efficiency + default) | composite (内部 5 module) | 4 (turnover/expiry/aging + default) |
| Repository 数 | 2 (batches+suppliers) | 多 | 多 | **3** (batches + consumptions + adjustments) |
| 时间字段 | `receipt_date` (单一) | mixed | mixed | **4 不同字段** (production_date / expire_date / receipt_date / adjustment_time) |
| `Map.of(N)` 风险 (Rule 8) | 无 (LinkedHashMap) | 无 | 无 | **无** (LinkedHashMap, grep 验证 0 hits) |
| LinkedHashMap fixed-order 站点 | ~5 | ~10 | ~12 | **16** (T-INV-5, 最高) |
| Mock 含量 | 0 (全 real) | 0 | 0 | **1 处** (T-INV-8 类别 B) |
| Alert helper 数 | 3 (on-time/quality/concentration) | 多 | 多 | **4 named + 4 inline** = 8 sites (T-INV-1) |
| Div-by-zero guard 数 | 1 | 多 | 多 | **5** (T-INV-2) |
| `MetricCalculatorService` 用法 | `calculateMomGrowth` × N sites | mixed | mixed | **注入但 Java 实际不调用** (验证: grep `metricCalculatorService\.` 在 InventoryHealthAnalysisServiceImpl 内 0 hits 业务调用; 仅 `@RequiredArgsConstructor` 注入); Python 端**不需要 import** MoM helper |
| `getCurrentQuantity()` @Transient | N/A (procurement 用 `getTotalValue()` ≠) | N/A | N/A | **必须 inline 计算** (T-INV-13 新增, `receiptQuantity - usedQuantity - reservedQuantity`) |

**`MetricCalculatorService` 注入但不用** 是 Java side dead code. Python 端忽略 (不 import `_calculate_mom_growth` from procurement, 不 hoist 到 shared util). Phase 3+ Java cleanup 候选项. Spec §3.2 imports 不引用.

---

## 2. 架构 + 文件 delta

### 2.1 文件级修改

```
PR-A (per-type 3 modes: turnover + expiry + aging):
  tests/fixtures/java-smartbi-golden/
    ├─ analysis-inventory-F999-turnover.json   [NEW via record-java-golden.sh]
    ├─ analysis-inventory-F999-expiry.json     [NEW]
    └─ analysis-inventory-F999-aging.json      [NEW]
    (F001 dual goldens 推迟到 PR-A impl chat 内 record, 防 spec PR diff 过大)

  backend/python/smartbi_compat/api/analysis_inventory.py    [NEW, ~700-850 LOC]
    + analysis_inventory_router (FastAPI APIRouter)
    + GET /api/mobile/{factoryId}/smart-bi/analysis/inventory endpoint dispatcher
    + _get_inventory_analysis() main dispatcher by analysisType
    + _get_turnover_mode() / _get_expiry_mode() / _get_aging_mode() entry points
    # ─── turnover mode (3 sub-services) ───
    + _get_turnover_analysis()                  sub-service 1, 4 metrics + 1 amount
    + _get_turnover_by_category()               sub-service 2, ranking sorted desc
    + _get_turnover_trend_chart()               sub-service 3, MONTH period
    # ─── expiry mode (3 sub-services) ───
    + _get_expiry_risk_analysis()               sub-service 4, 5 metrics
    + _get_expiring_batches_ranking()           sub-service 5, FEFO sort + 7/15/30 inline alert
    + _get_expiry_risk_chart()                  sub-service 6, 5-bucket LinkedHashMap
    # ─── aging mode (3 sub-services) ───
    + _get_aging_metrics()                      sub-service 7, 3 metrics + inline 10/20 alert
    + _get_inventory_aging_chart()              sub-service 8, 4-bucket LinkedHashMap
    + _get_long_aging_batches_ranking()         sub-service 9, age desc sort + 90/120 inline alert
    # ─── 4 named alert helpers ───
    + _determine_turnover_alert_level()         T1: 6/12 (regular dir)
    + _determine_inventory_days_alert_level()   T1: 30/60 (INVERSE)
    + _determine_expiry_risk_alert_level()      T1: 10/15 (INVERSE)
    + _determine_loss_rate_alert_level()        T1: 2/5 (INVERSE) — 用于 PR-B health score path
    # ─── SQL helpers ───
    + _query_material_batches_by_status()       T-INV-12: ORDER BY id (Java 无)
    + _query_material_consumptions_in_range()   T-INV-12: ORDER BY id (Java 无) + atTime(23,59,59)
    + _query_expiring_batches()                 T-INV-12: ORDER BY expire_date ASC (mirror Java L175)
    + _query_expired_batches()                  T-INV-12: ORDER BY id (Java 无)
    + _query_inventory_value_total()            scalar SUM, mirror Java L195-197
    + _query_batch_adjustments_in_range()       per-batch loop helper, ORDER BY adjustment_time DESC (mirror Java)
    # ─── shared logic helpers ───
    + _get_current_quantity()                   T-INV-13: receiptQuantity - usedQuantity - reservedQuantity (inline)
    + _calculate_total_inventory_value()        sum of getCurrentQuantity * unitPrice with null-safe
    + _convert_to_kpi_cards()                   MetricResult → KPICard mapping
    + _format_currency()                        T8 styled, "%,.2f" no trailing %
    # ─── threshold constants ───
    + _TURNOVER_RED / _TURNOVER_YELLOW          Decimal const (6 / 12)
    + _INVENTORY_DAYS_RED / _INVENTORY_DAYS_YELLOW  (60 / 30, INVERSE)
    + _EXPIRY_RISK_RED / _EXPIRY_RISK_YELLOW    (15 / 10, INVERSE)
    + _LOSS_RATE_RED / _LOSS_RATE_YELLOW        (5 / 2, INVERSE)
    + _AGING_FRESH / _AGING_NORMAL / _AGING_WARNING  (30 / 60 / 90)
    + _DEFAULT_EXPIRY_WARNING_DAYS              (30)
    + _HIGH_RISK_EXPIRY_DAYS                    (7)
    + _SCALE / _DISPLAY_SCALE / _QUANTIZE_HALF_UP

  backend/python/main.py                                       [EDIT]
    + register analysis_inventory_router

  tests/python/smartbi_compat/test_analysis_inventory_contract.py  [NEW, ~400-500 LOC]
    + class TestAnalysisInventoryTurnoverMode (3 tests)
    + class TestAnalysisInventoryExpiryMode (3 tests)
    + class TestAnalysisInventoryAgingMode (3 tests)
    + _strip_volatile masks data.overview.lastUpdated (extends VOLATILE_KEYS coverage if not already)

PR-B (default mode = overview DashboardResponse):
  tests/fixtures/java-smartbi-golden/
    └─ analysis-inventory-F999-default.json    [NEW]

  backend/python/smartbi_compat/api/analysis_inventory.py    [EDIT, +~400-500 LOC]
    + _get_inventory_health()                   default mode entry, returns DashboardResponse
    + _calculate_kpi_cards()                    5 KPI cards builder (chains to getTurnoverAnalysis +
                                                getExpiryRiskAnalysis + getHealthScore)
    + _get_health_score()                       MetricResult, T-INV-9 asymmetric null
    + _calculate_loss_rate_for_health_score()   PRIVATE subset of Java getLossAnalysis (LOSS_RATE
                                                only) — needed because Java getHealthScore L866-869
                                                calls public getLossAnalysis but Python
                                                `_get_loss_analysis` is NOT exported (out-of-scope
                                                per §1.3). Body fully specified in §3.9.
                                                **Cycle 2 audit fix BLOCKER 1 (§7 risk #7).**
    + _build_material_category_value_chart()    PIE top-10 by category
    + _generate_ai_insights()                   T6 rule-based, NO LLM (3 conditional insights)
    + _generate_suggestions()                   T6 rule-based 短文 list (3 conditional)
    + _build_empty_dashboard()                  fallback for empty batches (1 AIInsight + 1 suggestion)
    + DashboardResponse JSON shape mirror — 同 procurement PR-B 模板
                                              (kpiCards / charts / rankings / aiInsights /
                                               suggestions / lastUpdated)

  tests/python/smartbi_compat/test_analysis_inventory_contract.py  [EDIT]
    + class TestAnalysisInventoryDefaultMode (3 tests:
        empty-batches / populated / asymmetric-null T-INV-9 regression)

PR-C (arithmetic depth tests):
  tests/python/smartbi_compat/test_analysis_inventory_contract.py  [EDIT]
    + class TestInventoryAlertHelpersArithmetic           (4 helpers × 4 boundary = 16 tests)
    + class TestInventoryDivByZeroGuards                  (5 sites × 3 cases = 15 tests)
    + class TestInventoryDateArithmetic                   (annualization + days-until-expiry signed semantics +
                                                            null receiptDate aging bucket → "90天以上")
    + class TestInventoryLinkedHashMapOrder               (regression: 3 chart dicts insertion order)
    + class TestInventoryLossTrendChartMock               (T-INV-8 — assert 12-month all-zero output)
    + class TestInventoryHealthScoreAsymmetric            (T-INV-9 regression: turnover null=0pts vs
                                                            expiry/loss/aging null=full pts)
    + class TestInventoryAgingBucketBoundaries            (30/60/90/null-receipt-date → bucket map)
    + class TestInventoryGetCurrentQuantityFormula        (T-INV-13: null-receipt → ZERO,
                                                            null-used/reserved → 0 default)
    + class TestInventoryExpiringRankingInlineAlert       (per-batch 7/15/30 days)
    + class TestInventoryLongAgingRankingInlineAlert      (per-batch 90/120 days)
    + Map.of SALT flip detection deferred (inventory 无 Map.of 调用 — 验证 §3 + Rule 8)
```

### 2.2 关键架构决策 (12)

1. **新文件 `analysis_inventory.py`** — 跟 sister precedent (`analysis_procurement.py` / `analysis_finance.py` / `analysis_department.py`) 一致
2. **3 个 Repository → 6 个 SQL helpers** — inventory 比 procurement 多 1 个 (adjustments 跨表 per-batch loop). 每个 helper 必须显式列 ORDER BY 真相 (Rule 5/6/T-INV-12)
3. **`getCurrentQuantity()` @Transient inline 计算** (T-INV-13): Python 端必须从 row dict 直接 `receiptQuantity - usedQuantity - reservedQuantity`, 不能简化为 `receiptQuantity`. Java SQL `calculateInventoryValue` (L195-196) 也用同样公式聚合 — Python `_query_inventory_value_total` 1:1 mirror SQL
4. **8 alert decision sites, 4 named helpers + 4 inline** — Python 必须区分: helpers 抽出复用, inline 保 inline (跟 Java 1:1, 不抽 helper). 防止 sister chats 误以为所有 alert 都该抽 helper
5. **6 inline threshold pairs** + **2 单值阈值** + **3 aging bucket boundaries**, NOT shared `alert_thresholds.py` (verified empty for inventory): 6/12, 30/60 inv, 10/15 inv, 2/5 inv, 7-day expiry, 30-day expiry warning, 30/60/90 aging
6. **No `Map.of(N)` Rule 8 risk** (verified — grep `Map\.of\(` in InventoryHealthAnalysisServiceImpl.java = 0 hits) — 但 T-INV-5 LinkedHashMap insertion order 16 sites 仍是 byte-shape 头号风险
7. **`getLossTrendChart` 类别 B mock literal mirror** (T-INV-8) — Python 输出全 0, NOT 计算 real values. PR-C dedicated test 锁定. **NOT** port for default mode (Java default mode 不调用)
8. **T-INV-9 asymmetric null verbatim mirror** — Java getHealthScore L835/862/881/899 turnover null = 0pts 加, expiry/loss/aging null = full pts 加. 几乎确定是 Java bug, 但 byte-shape parity > defensive fix. PR-C regression test 锁定. **Cross-spec lineage** (cite §7):
   - department PR #36 §3.4 'C1 wording mismatch' (Java comment 跟 impl 不一致, port verbatim impl)
   - profit/cost specs in main: BigDecimal.ZERO division-by-zero guard 跟 Java 1:1 mirror, 不 paper over edge cases
   - Rule 3 spirit: 1:1 mirror Java semantics, byte-shape parity > defensive fix
9. **PR slicing — 3 PRs**:
   - **PR-A** (per-type 3 modes: turnover + expiry + aging): 9 sub-services + 4 named alert helpers + 6 SQL helpers + arithmetic-depth shared. ~750 LOC code + ~400 LOC tests
   - **PR-B** (default mode = `getInventoryHealth` DashboardResponse): 1 mode entry + `_calculate_kpi_cards` + `_get_health_score` (T-INV-9) + `_build_material_category_value_chart` + `_generate_ai_insights` + `_generate_suggestions` + `_build_empty_dashboard`. ~450 LOC + tests
   - **PR-C** (arithmetic depth tests): 10 test classes covering alert helpers / div-by-zero guards / date arithmetic / LinkedHashMap order / mock-zero / asymmetric null / aging bucket / current-quantity formula / 2 inline rankings
10. **Goldens**: 4 files — `analysis-inventory-F999-{turnover,expiry,aging,default}.json`. **HARD prereq before PR-A plan**: 必须先跑 `record-java-golden.sh` 录制 4 个 goldens (Jackson HashMap-hash 顺序 baked into LinkedHashMap iteration; 不可逆推)
11. **F001 + F999 dual fixtures** — F001 record 推迟到 PR-A impl chat (避免 spec PR 跨 fixtures 提交), 但 dual-record 在 PR-A T6 阶段是 mandatory (sister precedent 已 enforce)
12. **`MetricCalculatorService` Java side 注入但不调用** — Python 端不 import shared MoM helper, 不 hoist 任何东西到 shared util

---

## 3. Java 引用 + 算法

### 3.1 Java reference 表

| 函数 / 元素 | 位置 | 备注 |
|---|---|---|
| Controller `/analysis/inventory` | `SmartBIAnalysisController.java:411-448` | 4 modes per-type dispatcher |
| `getInventoryHealth` (default mode) | `InventoryHealthAnalysisServiceImpl.java:89-135` | DashboardResponse + lastUpdated volatile, 3 chart list, 2 ranking, recursive call chain |
| `getTurnoverAnalysis` | 同上, 141-203 | 4 metrics: TURNOVER_RATE / INVENTORY_DAYS / CONSUMPTION_AMOUNT / INVENTORY_VALUE |
| `getTurnoverTrendChart` | 同上, 207-251 | LINE chart, MONTH period 简化 (起始 withDayOfMonth(1), 月迭代) |
| `getTurnoverByCategory` | 同上, 255-288 | groupingBy material_type_id, sorted desc, all GREEN alert |
| `getExpiryRiskAnalysis` | 同上, 294-371 | 5 metrics: EXPIRY_RISK_RATE / EXPIRING_COUNT / HIGH_RISK_COUNT / EXPIRED_COUNT / EXPIRING_VALUE |
| `getExpiringBatchesRanking` | 同上, 375-417 | FEFO sort by expire_date ASC, limit 20, **inline alert 7/15/30 days** |
| `getExpiryRiskChart` | 同上, 421-478 | PIE chart, 5-bucket LinkedHashMap pre-populate, 5-color array |
| `getLossAnalysis` | 同上, 484-545 | **不 port** (controller 不调; default mode 不调) |
| `getLossReasonChart` | 同上, 549-618 | **不 port** (同上) |
| `getLossTrendChart` | 同上, 622-654 | **类别 B mock** (line 634 hardcoded ZERO); **不 port** (controller 不调; default mode 不调). PR-C 不 test (因为 Python 端没有此函数). 整段写入 §7 risks 警告 future contributor 不要 lazy port |
| `getInventoryAgingChart` | 同上, 660-716 | BAR chart, 4-bucket LinkedHashMap pre-populate, 4-color array |
| `getAgingMetrics` | 同上, 720-770 | 3 metrics: SLOW_MOVING_RATE (inline 10/20 alert) + SLOW_MOVING_VALUE + AVG_AGING_DAYS (Optional) |
| `getLongAgingBatchesRanking` | 同上, 774-818 | age desc sort, limit 20, **inline alert 90/120 days** |
| `getHealthScore` | 同上, 824-921 | **T-INV-9** asymmetric null. 4 dimensions weighted (30+30+20+20=100). **不被 controller direct dispatch**, 仅 default mode 经 `calculateKpiCards` 调用 |
| `getHealthRadarChart` | 同上, 925-998 | **不 port** (default mode `getInventoryHealth` line 105-108 charts list 实际不包含 radar) |
| `calculateKpiCards` (private) | 同上, 1005-1053 | 5 KPI cards: INVENTORY_VALUE + BATCH_COUNT + TURNOVER_RATE + EXPIRY_RISK_RATE + HEALTH_SCORE |
| `calculateTotalInventoryValue` (private) | 同上, 1058-1063 | sum batches.getCurrentQuantity() * unit_price (null-safe) |
| `buildMaterialCategoryValueChart` (private) | 同上, 1068-1102 | groupBy materialTypeId, sort desc, limit 10, PIE |
| `generateAiInsights` (private) | 同上, 1107-1177 | rule-based, 3 conditional insights (expiry / turnover / health) |
| `generateSuggestions` (private) | 同上, 1182-1217 | rule-based, 3 conditional suggestions (expiring count / long-aging count / low turnover) |
| `buildEmptyDashboard` (private) | 同上, 1222-1236 | empty fallback (1 AIInsight + 1 suggestion + lastUpdated still volatile) |
| `convertToKPICards` (private) | 同上, 1241-1287 | MetricResult → KPICard mapping (RED/YELLOW/GREEN → red/yellow/green; UP/DOWN/STABLE → up/down/flat) |
| `determineTurnoverAlertLevel` (private) | 同上, 1294-1302 | 6/12 RED YELLOW |
| `determineInventoryDaysAlertLevel` (private) | 同上, 1307-1315 | 60/30 RED YELLOW (**inverse**) |
| `determineExpiryRiskAlertLevel` (private) | 同上, 1320-1328 | 15/10 RED YELLOW (**inverse**, **strict `>`**) |
| `determineLossRateAlertLevel` (private) | 同上, 1333-1341 | 5/2 RED YELLOW (**inverse**, **strict `>`**) — 仅 PR-B health score path 使用 |
| `formatCurrency` (private) | 同上, 1346-1351 | `String.format("%,.2f", v.setScale(2, HALF_UP).doubleValue())`, null → "-" |
| Constants (class-level) | 同上, 58-83 | SCALE=4, DISPLAY_SCALE=2, ROUNDING_MODE=HALF_UP, 8 thresholds, 4 aging boundaries |
| `MaterialBatchRepository.findByFactoryIdAndStatus` | `MaterialBatchRepository.java:146` | JPA derived, **NO ORDER BY** (T-INV-12) |
| `MaterialBatchRepository.findExpiringBatches` | 同上, 173-177 | `@Query(... ORDER BY m.expireDate ASC)` (single col, **YES** ORDER BY) |
| `MaterialBatchRepository.findExpiredBatches` | 同上, 182-185 | `@Query(... no ORDER BY)` |
| `MaterialBatchRepository.calculateInventoryValue` | 同上, 195-197 | scalar `SELECT SUM((receiptQty - usedQty - reservedQty) * unitPrice) WHERE status='AVAILABLE'` |
| `MaterialConsumptionRepository.findByTimeRange` | `MaterialConsumptionRepository.java:40-44` | `@Query(... no ORDER BY)`, LocalDateTime params |
| `MaterialBatchAdjustmentRepository.findByMaterialBatchIdAndAdjustmentTimeBetweenOrderByAdjustmentTimeDesc` | `MaterialBatchAdjustmentRepository.java:33` | derived method name, **YES** `ORDER BY adjustment_time DESC` (in name) |
| `MaterialBatch.getCurrentQuantity()` | `MaterialBatch.java:167-175` | `@Transient`: receiptQty - usedQty - reservedQty, null-safe |
| `MaterialBatchStatus.AVAILABLE` enum | `MaterialBatchStatus.java` | 仅此一个状态被 query (其他 IN_STOCK/FRESH/EXPIRED 不 query) |
| `alert_thresholds.json` | (verified, no `inventory` key) | All 8 thresholds inline-only |

### 3.2 Imports

```python
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _strip_volatile,         # already covers "lastUpdated" key (Tier 1 finance baseline)
    VOLATILE_KEYS,
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,
    _utc_now_iso,
)
from smartbi_compat.schema_compat import wrap_response   # ⚠️ Cycle 4 BLOCKER 1 fix —
                                                          #    wrap_response lives in
                                                          #    schema_compat NOT analysis_finance
                                                          #    (sister specs procurement #40 +
                                                          #    department #36 had same import
                                                          #    error; this spec corrects)

from smartbi_compat.auth import verify_jwt_and_factory, AuthContext   # ⚠️ Cycle 4 BLOCKER 2 fix —
                                                                       #    actual symbol is
                                                                       #    verify_jwt_and_factory,
                                                                       #    NOT verify_factory_access
                                                                       #    (sister specs same error)

# ⚠️ Cycle 4 BLOCKER 1 fix — `_fetch_all` does NOT yet exist in `analysis_finance.py`.
# Sister specs (procurement #40, department #36) assume it but reference a not-yet-extant
# helper. This spec MUST handle this via one of the following PR-A0 prereqs:
#
#   Option (a, RECOMMENDED): PR-A0 follow-up adds canonical wrapper to analysis_finance.py:
#       async def _fetch_all(sql: str, *args) -> list[dict]:
#           from smartbi.config import get_cretas_pool
#           pool = await get_cretas_pool()
#           async with pool.acquire() as conn:
#               rows = await conn.fetch(sql, *args)
#           return [dict(r) for r in rows]
#     Then this spec's `_query_*` helpers `await _fetch_all(sql, ...)` work. PR-A impl
#     chat opens a tiny PR-A0 to land the helper, then proceeds. Sister specs benefit
#     too — this becomes shared util.
#
#   Option (b): Inline `pool = await get_cretas_pool(); async with pool.acquire() as conn:`
#     in each `_query_*` helper. ~5 LOC duplication × 6 helpers = 30 LOC bloat. Not preferred.
#
# Spec assumes Option (a) for the `await _fetch_all(...)` pseudo-code in §3.3. Impl chat
# decides whether to land PR-A0 or inline. If Option (b), each `_query_*` helper expands
# accordingly during impl plan.

# NOTE: NOT imported (intentional):
#   - _calculate_mom_growth from analysis_procurement (inventory has NO MoM metric;
#     Java side `MetricCalculatorService` 注入但不调用 — see §1.4 design diff)
#   - _get_period_key from analysis_finance (Rule 2 fix) — inventory `getTurnoverTrendChart`
#     hardcodes MONTH period via direct `LocalDate.withDayOfMonth(1)` 月迭代, 不走通用
#     period dispatcher; WEEK / DAY 不可达 (controller hardcodes period="MONTH" line 429)
#   - python-dateutil relativedelta — inventory MONTH iteration 用 `LocalDate.plusMonths(1)`
#     mirror via custom `_plus_months(d, n)` 即可 (procurement spec §3.10b 同模式)
```

### 3.3 SQL helpers (T-INV-12 ORDER BY truth + Rule 5 + Rule 6)

**T-INV-12 ORDER BY truth table** (verified by Round 2 grep against `*Repository.java`):

| Repository method | Java has ORDER BY? | Python helper ORDER BY |
|---|---|---|
| `MaterialBatchRepository.findByFactoryIdAndStatus` (L146) | NO (JPA derived) | `ORDER BY id` (department C2 fix pattern) |
| `MaterialBatchRepository.findExpiringBatches` (L173-177) | YES `ORDER BY m.expireDate ASC` (single col) | **mirror exact**: `ORDER BY expire_date ASC` (NO secondary `id`) |
| `MaterialBatchRepository.findExpiredBatches` (L182-185) | NO | `ORDER BY id` |
| `MaterialBatchRepository.calculateInventoryValue` (L195-197) | scalar SUM (no ORDER BY needed) | scalar SUM (single row) |
| `MaterialConsumptionRepository.findByTimeRange` (L40-44) | NO | `ORDER BY id` |
| `MaterialBatchAdjustmentRepository.findByMaterialBatchIdAndAdjustmentTimeBetweenOrderByAdjustmentTimeDesc` | YES `ORDER BY adjustment_time DESC` (in derived name) | **mirror exact**: `ORDER BY adjustment_time DESC` (NO secondary `id`) |

⚠️ Per user lock-in (Round 2): Java 已有 ORDER BY 时 Python **不补 `id` 二级 tiebreaker**, 1:1 mirror. 仅 Java 无 ORDER BY 时 Python 补 `ORDER BY id`. `findExpiringBatches` single-col `expire_date ASC` 在 PostgreSQL 同 expire_date 多 row 时 secondary order 不确定 — **Java side bug**, out of Phase 2A scope, 见 §7.

```python
async def _query_material_batches_by_status(
    factory_id: str, status: str = "AVAILABLE"
) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findByFactoryIdAndStatus (L146).

    JPA derived query, NO ORDER BY in Java → row order unstable. Python adds
    explicit ORDER BY id for byte-shape determinism (T-INV-12 lock).

    Soft-delete: WHERE deleted_at IS NULL (mirror @Where annotation if present).
    Status: parameter (Java callers all pass MaterialBatchStatus.AVAILABLE).

    Rule 5: SELECT * future-proof for schema additions.
    Rule 6: input boundary None-check.
    """
    if factory_id is None:
        raise ValueError("_query_material_batches_by_status: factory_id required")
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status = $2
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, status)


async def _query_material_consumptions_in_range(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java MaterialConsumptionRepository.findByTimeRange (L40-44).

    @Query JPQL `WHERE m.factoryId = :factoryId AND m.consumptionTime BETWEEN :startTime AND :endTime`
    — NO ORDER BY → Python adds `ORDER BY id` (T-INV-12 lock).

    ⚠️ T-INV-7 atTime(23, 59, 59) trap — Java callers convert LocalDate to LocalDateTime
    via `startDate.atStartOfDay()` (00:00:00) and `endDate.atTime(23, 59, 59)`
    (NOT 23:59:59.999999 — 1-second gap before midnight). Python equivalent:
        start_dt = datetime.combine(start_date, time.min)         # 00:00:00
        end_dt = datetime.combine(end_date, time(23, 59, 59))     # 23:59:59 (no microseconds)
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_material_consumptions_in_range: start_date/end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time(23, 59, 59))
    sql = """
        SELECT *
        FROM material_consumptions
        WHERE factory_id = $1
          AND consumption_time BETWEEN $2 AND $3
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, start_dt, end_dt)


async def _query_expiring_batches(
    factory_id: str, warning_date: date
) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findExpiringBatches (L173-177).

    @Query JPQL `WHERE m.factoryId = :factoryId AND m.expireDate BETWEEN CURRENT_DATE AND :warningDate ORDER BY m.expireDate ASC`
    — **YES ORDER BY** (single col `expire_date ASC`). Python mirror exact, NO secondary id.

    ⚠️ Java side `CURRENT_DATE` = SQL function (server time at query exec). Python
    mirrors: pass `date.today()` from Python, OR use SQL `CURRENT_DATE`. **决策**:
    Python 用 SQL `CURRENT_DATE` mirror exactly (避免 Python `date.today()` 跟 server
    timezone 偏差导致 byte parity drift).

    ⚠️ Note: Java does NOT filter by status='AVAILABLE' here. So expiring query
    returns batches of ANY status. Python mirror.
    """
    if warning_date is None:
        raise ValueError("_query_expiring_batches: warning_date required")
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND expire_date BETWEEN CURRENT_DATE AND $2
          AND deleted_at IS NULL
        ORDER BY expire_date ASC
    """
    return await _fetch_all(sql, factory_id, warning_date)


async def _query_expired_batches(factory_id: str) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findExpiredBatches (L182-185).

    @Query JPQL `WHERE m.factoryId = :factoryId AND m.status != 'EXPIRED' AND m.expireDate < CURRENT_DATE`
    — NO ORDER BY → Python adds `ORDER BY id`.

    ⚠️ Note Java filter `status != 'EXPIRED'` — counts already-expired-by-date batches
    that haven't been transitioned to EXPIRED status yet. Python mirror exactly.
    """
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status != 'EXPIRED'
          AND expire_date < CURRENT_DATE
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id)


async def _query_inventory_value_total(factory_id: str) -> Decimal:
    """Mirror Java MaterialBatchRepository.calculateInventoryValue (L195-197).

    @Query JPQL: SELECT SUM((m.receiptQuantity - m.usedQuantity - m.reservedQuantity) * m.unitPrice)
                 FROM MaterialBatch m WHERE m.factoryId = :factoryId AND m.status = 'AVAILABLE'

    ⚠️ Java returns null when no rows (BigDecimal — Java NullPointer-prone). Caller
    must null-coalesce to ZERO. Python mirror: NULL aggregate → coalesce to Decimal('0').

    ⚠️ T-INV-13 — formula matches getCurrentQuantity() @Transient.
    SQL nulls inside SUM expression: PostgreSQL treats NULL arithmetic as NULL → that
    row contributes nothing. Same as Java's null-safe @Transient (which returns ZERO
    if receiptQuantity null). **Caveat**: Java @Transient also coalesces usedQuantity
    and reservedQuantity to ZERO before subtract; SQL `(NULL - x - y) * unitPrice`
    propagates NULL. **Java DB query and Java @Transient method 在 receiptQuantity 非 null
    但 usedQuantity 或 reservedQuantity null 时 behavior 不同**:
      - @Transient: receiptQuantity - 0 - 0 = receiptQuantity (counts the row)
      - SQL: receiptQuantity - NULL - NULL = NULL (drops the row)
    
    本 spec **Python 端 mirror Java SQL behavior** (因 controller default mode
    KPI 卡用 `_query_inventory_value_total` SQL 路径而非 in-memory iteration).
    所有 in-memory iteration 路径 (calculateTotalInventoryValue 1058-1063)
    用 `_get_current_quantity()` 严格 mirror @Transient null-coalesce (T-INV-13).
    
    **PR-C 测试**: `TestInventoryGetCurrentQuantityFormula` 锁定 in-memory path;
    `_query_inventory_value_total` 不需要单独 test (mirror SQL 即可).
    """
    sql = """
        SELECT COALESCE(
            SUM((m.receipt_quantity - m.used_quantity - m.reserved_quantity) * m.unit_price),
            0
        ) AS inventory_value
        FROM material_batches m
        WHERE m.factory_id = $1
          AND m.status = 'AVAILABLE'
          AND m.deleted_at IS NULL
    """
    rows = await _fetch_all(sql, factory_id)
    if not rows or rows[0].get("inventory_value") is None:
        return Decimal("0")
    return _to_decimal(rows[0]["inventory_value"])


async def _query_batch_adjustments_in_range(
    batch_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java MaterialBatchAdjustmentRepository.findByMaterialBatchIdAnd
    AdjustmentTimeBetweenOrderByAdjustmentTimeDesc.

    Derived method name has `OrderByAdjustmentTimeDesc` → **YES ORDER BY**.
    Python mirror exactly: `ORDER BY adjustment_time DESC` (NO secondary id).

    ⚠️ T-INV-7 atTime(23, 59, 59) — same boundary trap as
    _query_material_consumptions_in_range.

    **Usage** (Cycle 4 NIT 10 fix — corrected from earlier "all unused" claim):
    - **PR-A**: NOT called. PR-A impl chat may omit this helper.
    - **PR-B**: REQUIRED — `_calculate_loss_rate_for_health_score` (§3.9) calls this
      helper to fetch per-batch adjustments for LOSS_RATE computation feeding
      `_get_health_score` dimension 3. (Java getHealthScore L866 calls public
      getLossAnalysis L498-503 which calls findByMaterialBatchIdAnd...
      Python mirrors via this private helper inside `_calculate_loss_rate_for_health_score`.)
    - **PR-C**: indirectly tested via TestInventoryHealthScoreAsymmetric +
      TestInventoryHealthScoreTierArithmetic (loss rate is one of 4 health
      score dimensions).
    """
    if start_date is None or end_date is None:
        raise ValueError("_query_batch_adjustments_in_range: dates required")
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time(23, 59, 59))
    sql = """
        SELECT *
        FROM material_batch_adjustments
        WHERE material_batch_id = $1
          AND adjustment_time BETWEEN $2 AND $3
        ORDER BY adjustment_time DESC
    """
    return await _fetch_all(sql, batch_id, start_dt, end_dt)
```

### 3.4 Constants + scale (T-INV-1 8 thresholds + 4 aging boundaries)

```python
# Mirror Java InventoryHealthAnalysisServiceImpl L58-83

_SCALE             = Decimal("0.0001")     # SCALE=4 (Java line 58)
_DISPLAY_SCALE     = Decimal("0.01")       # DISPLAY_SCALE=2 (Java line 59)
_QUANTIZE_HALF_UP  = ROUND_HALF_UP         # Java RoundingMode.HALF_UP (line 60)

# T-INV-1 alert thresholds — 4 named helpers + 4 inline (see §3.6)
#
# ⚠️ Cycle 4 MAJOR 4 fix — threshold UNIT scale notes:
#   Turnover thresholds (6/12) compare against rate in 次/年 (raw scale).
#   InventoryDays thresholds (30/60) compare against days (raw scale).
#   ExpiryRisk thresholds (10/15) compare against PERCENTAGE (already × 100).
#   LossRate thresholds (2/5) compare against PERCENTAGE (already × 100).
#   Slow-moving inline (10/20) compare against PERCENTAGE (already × 100).
#   Aging boundary (30/60/90) compare against days (raw scale).
#
# Easy to confuse a rate-scale threshold with a percentage-scale threshold —
# Java getHealthScore (§3.9) inline arithmetic is the trap site.
#
# Named helper thresholds:
_TURNOVER_RED          = Decimal("6")      # Java line 64, regular dir (lower=worse)
_TURNOVER_YELLOW       = Decimal("12")     # Java line 66
_INVENTORY_DAYS_RED    = Decimal("60")     # Java L1308 inline new BigDecimal("60"), INVERSE
_INVENTORY_DAYS_YELLOW = Decimal("30")     # Java L1311 inline, INVERSE
_EXPIRY_RISK_RED       = Decimal("15")     # Java line 68, INVERSE (strict `>`)
_EXPIRY_RISK_YELLOW    = Decimal("10")     # Java line 70, INVERSE (strict `>`)
_LOSS_RATE_RED         = Decimal("5")      # Java line 72, INVERSE (strict `>`)
_LOSS_RATE_YELLOW      = Decimal("2")      # Java line 74, INVERSE (strict `>`)

# Aging segment boundaries (days) — Java line 77-79
_AGING_FRESH    = 30   # 0-30 days bucket upper bound
_AGING_NORMAL   = 60   # 31-60 days bucket upper bound
_AGING_WARNING  = 90   # 61-90 days bucket upper bound; ageDays > 90 = "90天以上"

# Expiry warning — Java line 82-83
_DEFAULT_EXPIRY_WARNING_DAYS = 30
_HIGH_RISK_EXPIRY_DAYS       = 7

# Slow-moving rate inline thresholds (Java L747-751, getAgingMetrics ternary)
# NOT a named helper, inline in _get_aging_metrics; constants exported for PR-C boundary tests
_SLOW_MOVING_RED_INLINE    = Decimal("20")  # > 20% RED
_SLOW_MOVING_YELLOW_INLINE = Decimal("10")  # > 10% YELLOW

# Health score overall alert (Java L903-910, getHealthScore inline)
# 用于 PR-B health score 总体 alert
_HEALTH_SCORE_GREEN_MIN  = Decimal("80")    # >= 80 GREEN
_HEALTH_SCORE_YELLOW_MIN = Decimal("60")    # >= 60 YELLOW

# Per-batch ranking inline thresholds (Java L398-404 + L799-805)
# `getExpiringBatchesRanking` per-row alert
_EXPIRING_RANKING_RED_DAYS    = 7    # daysUntilExpiry <= 7 RED
_EXPIRING_RANKING_YELLOW_DAYS = 15   # daysUntilExpiry <= 15 YELLOW
# `getLongAgingBatchesRanking` per-row alert
_LONG_AGING_RANKING_RED_DAYS    = 120   # ageDays > 120 RED
_LONG_AGING_RANKING_YELLOW_DAYS = 90    # ageDays > 90 YELLOW (uses AGING_WARNING constant)
```

### 3.5 Shared logic helpers

```python
def _get_current_quantity(batch: dict) -> Decimal:
    """Mirror Java MaterialBatch.getCurrentQuantity() @Transient (MaterialBatch.java:167-175).

    Formula: receiptQuantity - usedQuantity - reservedQuantity
    Null-safe:
      - receiptQuantity null → return ZERO (Java line 169-171)
      - usedQuantity null → 0 default (Java line 172)
      - reservedQuantity null → 0 default (Java line 173)

    ⚠️ T-INV-13 — Java SQL `calculateInventoryValue` (L195-197) 跟此 @Transient method
    对 null component 的处理**不同** (SQL: NULL propagates → row drops; @Transient:
    null coalesce ZERO → row counts). Spec 决策: in-memory path (calculateTotalInventoryValue
    L1058-1063) 用本 helper mirror @Transient; SQL path (_query_inventory_value_total)
    mirror Java SQL behavior. 两路径 byte-parity 各自对齐 Java.
    """
    rq = batch.get("receipt_quantity")
    if rq is None:
        return Decimal("0")
    used = batch.get("used_quantity")
    reserved = batch.get("reserved_quantity")
    used_dec = _to_decimal(used) if used is not None else Decimal("0")
    reserved_dec = _to_decimal(reserved) if reserved is not None else Decimal("0")
    return _to_decimal(rq) - used_dec - reserved_dec


def _calculate_total_inventory_value(batches: list[dict]) -> Decimal:
    """Mirror Java InventoryHealthAnalysisServiceImpl.calculateTotalInventoryValue (L1058-1063).

    Java:
      batches.stream()
        .map(b -> b.getCurrentQuantity().multiply(
            b.getUnitPrice() != null ? b.getUnitPrice() : BigDecimal.ZERO))
        .reduce(BigDecimal.ZERO, BigDecimal::add)

    Python equivalent: sum(currentQuantity * unitPrice (default 0)) over batches.

    Rule 1: explicit is-None check on unit_price.
    """
    total = Decimal("0")
    for b in batches:
        cq = _get_current_quantity(b)
        up = b.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        total += cq * up_dec
    return total


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java formatCurrency (L1346-1351).

    Java:
      if (value == null) return "-";
      return String.format("%,.2f", value.setScale(DISPLAY_SCALE=2, HALF_UP).doubleValue());

    ⚠️ T8 styled — 千分位 + 2 位小数, NO trailing "%" or "元" (caller adds unit suffix).
    """
    if value is None:
        return "-"
    quantized = value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return f"{float(quantized):,.2f}"


def _convert_to_kpi_cards(metric_results: list[dict]) -> list[dict]:
    """Mirror Java convertToKPICards (L1241-1287).

    Mapping:
      AlertLevel name → status: RED→"red" / YELLOW→"yellow" / default→"green"
      ChangeDirection: UP→"up" / DOWN→"down" / default→"flat"

    KPICard JSON shape (Java @Builder field order):
      [key, title, rawValue, value, unit, changeRate, change, trend, status, description]
    """
    cards = []
    for metric in metric_results:
        alert = metric.get("alertLevel")
        if alert == "RED":
            status = "red"
        elif alert == "YELLOW":
            status = "yellow"
        else:
            status = "green"

        direction = metric.get("changeDirection")
        if direction == "UP":
            trend = "up"
        elif direction == "DOWN":
            trend = "down"
        else:
            trend = "flat"

        # Java line 1276-1278:
        # value = formattedValue if non-null else (value.toString() if non-null else "-")
        formatted = metric.get("formattedValue")
        raw_value = metric.get("value")
        if formatted is not None:
            display_value = formatted
        elif raw_value is not None:
            display_value = str(raw_value)
        else:
            display_value = "-"

        cards.append({
            "key":         metric.get("metricCode"),
            "title":       metric.get("metricName"),
            "rawValue":    raw_value,
            "value":       display_value,
            "unit":        metric.get("unit"),
            "changeRate":  metric.get("changePercent"),
            "change":      metric.get("changeValue"),
            "trend":       trend,
            "status":      status,
            "description": metric.get("description"),
        })
    return cards
```

### 3.6 Alert-level helpers (4 named) + 4 inline alert decisions

**Named helpers (mirror Java private methods):**

```python
def _determine_turnover_alert_level(turnover_rate: Decimal) -> str:
    """Mirror Java determineTurnoverAlertLevel (L1294-1302).
    Regular direction (lower = worse): RED < 6, YELLOW < 12, GREEN."""
    if turnover_rate < _TURNOVER_RED:
        return "RED"
    if turnover_rate < _TURNOVER_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_inventory_days_alert_level(inventory_days: Decimal) -> str:
    """Mirror Java determineInventoryDaysAlertLevel (L1307-1315).
    INVERSE direction (higher = worse): RED > 60, YELLOW > 30, GREEN."""
    if inventory_days > _INVENTORY_DAYS_RED:
        return "RED"
    if inventory_days > _INVENTORY_DAYS_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_expiry_risk_alert_level(expiry_risk_rate: Decimal) -> str:
    """Mirror Java determineExpiryRiskAlertLevel (L1320-1328).
    INVERSE direction, **strict `>`**: RED > 15, YELLOW > 10, GREEN.

    PR-C boundary test:
      15.0 → YELLOW (NOT RED; strict `> 15` for RED)
      15.01 → RED
      10.0 → GREEN (NOT YELLOW; strict `> 10` for YELLOW)
      10.01 → YELLOW
    """
    if expiry_risk_rate > _EXPIRY_RISK_RED:
        return "RED"
    if expiry_risk_rate > _EXPIRY_RISK_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_loss_rate_alert_level(loss_rate: Decimal) -> str:
    """Mirror Java determineLossRateAlertLevel (L1333-1341).
    INVERSE direction, **strict `>`**: RED > 5, YELLOW > 2, GREEN.

    Used by PR-B health score path only (getLossAnalysis NOT controller-dispatched).
    """
    if loss_rate > _LOSS_RATE_RED:
        return "RED"
    if loss_rate > _LOSS_RATE_YELLOW:
        return "YELLOW"
    return "GREEN"
```

**Inline alert decisions (4 sites, NOT extracted as helpers — port verbatim per Rule 3):**

| Site | Java location | Logic | Python pattern |
|---|---|---|---|
| `getExpiringBatchesRanking` per-batch | L398-404 | `daysUntilExpiry <= 7 → RED; <= 15 → YELLOW; else GREEN` | inline if/elif in `_get_expiring_batches_ranking` |
| `getLongAgingBatchesRanking` per-batch | L799-805 | `ageDays > 120 → RED; > 90 → YELLOW; else GREEN` | inline if/elif in `_get_long_aging_batches_ranking` |
| `getAgingMetrics` SLOW_MOVING_RATE | L747-751 | `> 20 → RED; > 10 → YELLOW; else GREEN` (INVERSE) | inline ternary in `_get_aging_metrics` |
| `getHealthScore` overall | L903-910 | `>= 80 → GREEN; >= 60 → YELLOW; else RED` (regular direction) | inline if/elif in `_get_health_score` (PR-B) |

⚠️ Spec **不抽出**这 4 个 inline 为 helper. Java 1:1 mirror = inline. Sister specs (procurement #40 §3.7) 同 pattern.

### 3.7 Mode dispatcher + 9 sub-services (PR-A)

```python
analysis_inventory_router = APIRouter()


@analysis_inventory_router.get("/api/mobile/{factory_id}/smart-bi/analysis/inventory")
async def get_inventory_analysis(
    factory_id: str,
    startDate: date = Query(..., description="Start date"),
    endDate: date = Query(..., description="End date"),
    analysisType: Optional[str] = Query(None, description="turnover/expiry/aging or null=overview"),
    auth: AuthContext = Depends(verify_factory_access),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getInventoryAnalysis (L411-448).

    Dispatcher by analysisType. Returns wrap_response shape:
      {success: bool, data: {...}, message: str}
    """
    result: dict[str, Any] = {
        "startDate": startDate.isoformat(),
        "endDate": endDate.isoformat(),
    }

    if analysisType == "turnover":
        result["metrics"] = await _get_turnover_analysis(factory_id, startDate, endDate)
        result["ranking"] = await _get_turnover_by_category(factory_id, startDate, endDate)
        result["trendChart"] = await _get_turnover_trend_chart(factory_id, startDate, endDate, "MONTH")
    elif analysisType == "expiry":
        result["riskAnalysis"] = await _get_expiry_risk_analysis(factory_id)
        result["expiringBatches"] = await _get_expiring_batches_ranking(factory_id, _DEFAULT_EXPIRY_WARNING_DAYS)
        result["riskChart"] = await _get_expiry_risk_chart(factory_id)
    elif analysisType == "aging":
        result["agingMetrics"] = await _get_aging_metrics(factory_id)
        result["agingChart"] = await _get_inventory_aging_chart(factory_id)
        result["longAgingBatches"] = await _get_long_aging_batches_ranking(factory_id, _AGING_NORMAL)
    else:
        # default mode → DashboardResponse (PR-B)
        result["overview"] = await _get_inventory_health(factory_id, startDate, endDate)

    return wrap_response(result)
```

#### 3.7.1 `_get_turnover_analysis` (4 metrics, mirror Java L141-203)

```python
async def _get_turnover_analysis(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getTurnoverAnalysis (L141-203).

    Returns 4 MetricResult entries:
      [TURNOVER_RATE, INVENTORY_DAYS, CONSUMPTION_AMOUNT, INVENTORY_VALUE]

    Algorithm (Java line refs):
      L147 currentInventoryValue = repo.calculateInventoryValue(factoryId)  // null → ZERO
      L153-156 consumptions = repo.findByTimeRange(factoryId, atStartOfDay, atTime(23,59,59))
      L158-161 totalConsumption = sum(c.totalCost where non-null)
      L164 daysBetween = ChronoUnit.DAYS.between(start, end) + 1
      L165-167 annualizedConsumption = totalConsumption * 365 / daysBetween (SCALE=4)
      L169-171 turnoverRate = (currentInventoryValue > 0) ? annualized/inventory : ZERO  ⚠️ T-INV-2 div guard
      L173-180 metric 1: TURNOVER_RATE (DISPLAY_SCALE=2, alert via _determine_turnover_alert_level)
      L183-185 inventoryDays = (turnoverRate > 0) ? 365/turnoverRate : 999  ⚠️ T-INV-2 div guard, fallback 999
      L187-194 metric 2: INVENTORY_DAYS (setScale(0, HALF_UP), alert _determine_inventory_days_alert_level)
      L197 metric 3: CONSUMPTION_AMOUNT (MetricResult.of factory; no setScale, no alertLevel)
      L200 metric 4: INVENTORY_VALUE (MetricResult.of factory)
    """
    current_inventory_value = await _query_inventory_value_total(factory_id)
    # _query_inventory_value_total already coalesces null → Decimal('0')

    consumptions = await _query_material_consumptions_in_range(factory_id, start_date, end_date)
    total_consumption = Decimal("0")
    for c in consumptions:
        tc = c.get("total_cost")
        if tc is not None:
            total_consumption += _to_decimal(tc)

    days_between = (end_date - start_date).days + 1
    annualized = (total_consumption * Decimal("365") / Decimal(days_between)).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP
    )

    if current_inventory_value > Decimal("0"):
        turnover_rate = (annualized / current_inventory_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )
    else:
        turnover_rate = Decimal("0")

    metrics: list[dict] = []

    # Metric 1: TURNOVER_RATE
    turnover_display = turnover_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    metrics.append({
        "metricCode":      "TURNOVER_RATE",
        "metricName":      "库存周转率",
        "value":           _decimal_to_number(turnover_display),
        "formattedValue":  f"{float(turnover_rate):.1f} 次/年",  # Java %.1f doubleValue
        "unit":            "次/年",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      _determine_turnover_alert_level(turnover_rate),
        "description":     None,
    })

    # Metric 2: INVENTORY_DAYS — Java fallback 999 when turnover_rate <= 0
    if turnover_rate > Decimal("0"):
        inventory_days = (Decimal("365") / turnover_rate).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )
    else:
        inventory_days = Decimal("999")
    inv_days_zero_scale = inventory_days.quantize(Decimal("1"), rounding=_QUANTIZE_HALF_UP)
    metrics.append({
        "metricCode":      "INVENTORY_DAYS",
        "metricName":      "库存天数",
        "value":           _decimal_to_number(inv_days_zero_scale),
        "formattedValue":  f"{float(inventory_days):.0f} 天",
        "unit":            "天",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      _determine_inventory_days_alert_level(inventory_days),
        "description":     None,
    })

    # Metric 3: CONSUMPTION_AMOUNT (MetricResult.of factory — no formattedValue, no alert)
    metrics.append(_metric_result_of("CONSUMPTION_AMOUNT", "期间消耗", total_consumption, "元"))

    # Metric 4: INVENTORY_VALUE
    metrics.append(_metric_result_of("INVENTORY_VALUE", "库存价值", current_inventory_value, "元"))

    return metrics


def _metric_result_of(code: str, name: str, value: Decimal, unit: str) -> dict:
    """Mirror Java MetricResult.of(code, name, value, unit) static factory.

    @Builder default emits null for unset fields.
    """
    return {
        "metricCode":      code,
        "metricName":      name,
        "value":           _decimal_to_number(value),
        "formattedValue":  None,
        "unit":            unit,
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      None,
        "description":     None,
    }
```

#### 3.7.2 `_get_turnover_trend_chart` (LINE chart, MONTH iteration mirror)

```python
async def _get_turnover_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Mirror Java getTurnoverTrendChart (L207-251).

    Java 简化处理: 月度迭代 (line 213 注释), 不真正按 period 参数分支:
      L214 current = startDate.withDayOfMonth(1)
      L215-237 while !current.isAfter(endDate):
        monthEnd = min(current.plusMonths(1).minusDays(1), endDate)
        consumptions = findByTimeRange(current.atStartOfDay, monthEnd.atTime(23,59,59))
        monthConsumption = sum(c.totalCost where non-null)
        chartData.add({"month": "yyyy-MM", "consumption": monthConsumption.setScale(2)})
        current = current.plusMonths(1)
      L239-241 options: showDataLabels=false, smooth=true

    ⚠️ Period parameter is **ignored** by Java impl. Python mirror: ignore parameter
    (or at least always do MONTH iteration). Spec keeps `period` parameter for
    signature parity but doesn't dispatch on it — controller hardcodes "MONTH" anyway.

    ⚠️ T-INV-7 atTime(23, 59, 59) — same trap as _query_material_consumptions_in_range.
    """
    chart_data: list[dict] = []
    current = start_date.replace(day=1)

    while current <= end_date:
        # plusMonths(1).minusDays(1) — last day of current month
        month_end = _plus_months(current, 1) - _one_day()
        if month_end > end_date:
            month_end = end_date

        month_consumptions = await _query_material_consumptions_in_range(
            factory_id, current, month_end
        )
        month_consumption = Decimal("0")
        for c in month_consumptions:
            tc = c.get("total_cost")
            if tc is not None:
                month_consumption += _to_decimal(tc)

        chart_data.append({
            "month":       f"{current.year}-{current.month:02d}",
            "consumption": _decimal_to_number(
                month_consumption.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        })
        current = _plus_months(current, 1)

    options = {
        "showDataLabels": False,
        "smooth":         True,
    }

    return {
        "chartType":   "LINE",
        "title":       "消耗趋势",
        "xAxisField":  "month",
        "yAxisField":  "consumption",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }


def _plus_months(d: date, n: int) -> date:
    """Mirror Java LocalDate.plusMonths(n). Calendar-month arithmetic with
    end-of-month clamping (Java Jan 31 + 1 month = Feb 28/29).

    Inline impl (avoids dateutil dep, sister specs procurement §3.10b 同 pattern):
    """
    year = d.year
    month = d.month + n
    while month > 12:
        year += 1
        month -= 12
    while month < 1:
        year -= 1
        month += 12
    # Clamp day to last day of target month
    import calendar as _cal
    last_day = _cal.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def _one_day():
    from datetime import timedelta
    return timedelta(days=1)
```

#### 3.7.3 `_get_turnover_by_category` (ranking, mirror Java L255-288)

```python
async def _get_turnover_by_category(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getTurnoverByCategory (L255-288).

    ⚠️ start_date/end_date parameters are **NOT used** by Java impl (line 258 only
    queries findByFactoryIdAndStatus, no time filter). Python mirror — accepts
    parameters for signature parity but ignores them.

    Algorithm:
      L258 batches = findByFactoryIdAndStatus(factoryId, AVAILABLE)
      L261-269 categoryValues = groupingBy(materialTypeId,
                                            reducing(ZERO, b.currentQuantity * unitPrice, ::add))
      L274-276 sorted = entries.sorted(comparingByValue().reversed())
      L278-285 RankingItem entries: rank, name=materialTypeId, value, alertLevel=GREEN

    RankingItem fields (Java @Builder):
      [rank, name, value, target, completionRate, alertLevel]
    target/completionRate NOT set → null in JSON.
    """
    batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is not None:
            cq = _get_current_quantity(b)
            up = b.get("unit_price")
            up_dec = _to_decimal(up) if up is not None else Decimal("0")
            value = cq * up_dec
            category_values[mtid] = category_values.get(mtid, Decimal("0")) + value

    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (mtid, value) in enumerate(sorted_entries, start=1):
        rankings.append({
            "rank":           rank,
            "name":           mtid,
            "value":          _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         None,
            "completionRate": None,
            "alertLevel":     "GREEN",
        })
    return rankings
```

#### 3.7.4 `_get_expiry_risk_analysis` (5 metrics, Java L294-371)

```python
async def _get_expiry_risk_analysis(factory_id: str) -> list[dict]:
    """Mirror Java getExpiryRiskAnalysis (L294-371).

    Returns 5 MetricResult entries:
      [EXPIRY_RISK_RATE, EXPIRING_COUNT, HIGH_RISK_COUNT, EXPIRED_COUNT, EXPIRING_VALUE]

    ⚠️ Uses `LocalDate.now()` (line 298). Python equivalent: `date.today()` BUT this
    breaks byte-parity across timezones. Spec decision: use Python `date.today()`
    (mirror Java behavior of pulling system clock); golden record at known fixed
    date during impl phase. Test mock can monkeypatch `date.today()` for determinism.

    Algorithm:
      L298 today = LocalDate.now()
      L299-300 warningDate = today + 30 days; highRiskDate = today + 7 days
      L303 allBatches = findByFactoryIdAndStatus(factoryId, AVAILABLE)
      L306 expiringBatches = findExpiringBatches(factoryId, warningDate)
      L309-311 highRiskBatches = expiringBatches.filter(expireDate <= highRiskDate)
      L314 expiredBatches = findExpiredBatches(factoryId)
      L317 totalValue = calculateTotalInventoryValue(allBatches)
      L318 expiringValue = calculateTotalInventoryValue(expiringBatches)
      L319-321 expiryRiskRate = (totalValue > 0) ? expiringValue/totalValue * 100 : 0
                                                                 ⚠️ T-INV-2 div guard
      L323-331 metric 1: EXPIRY_RISK_RATE (alert via _determine_expiry_risk_alert_level,
                                            description "30天内临期库存占比")
      L333-342 metric 2: EXPIRING_COUNT (alert: empty→GREEN, else→YELLOW; inline)
      L344-354 metric 3: HIGH_RISK_COUNT (alert: empty→GREEN, else→RED; inline,
                                          description "7天内过期")
      L356-365 metric 4: EXPIRED_COUNT (alert: empty→GREEN, else→RED; inline)
      L367 metric 5: EXPIRING_VALUE (MetricResult.of factory)
    """
    today = date.today()
    warning_date = today + _days(_DEFAULT_EXPIRY_WARNING_DAYS)
    high_risk_date = today + _days(_HIGH_RISK_EXPIRY_DAYS)

    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")
    expiring_batches = await _query_expiring_batches(factory_id, warning_date)
    high_risk_batches = [
        b for b in expiring_batches
        if b.get("expire_date") is not None and b["expire_date"] <= high_risk_date
    ]
    expired_batches = await _query_expired_batches(factory_id)

    total_value = _calculate_total_inventory_value(all_batches)
    expiring_value = _calculate_total_inventory_value(expiring_batches)

    if total_value > Decimal("0"):
        expiry_risk_rate = (expiring_value / total_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        ) * Decimal("100")
    else:
        expiry_risk_rate = Decimal("0")

    metrics: list[dict] = []
    risk_display = expiry_risk_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)

    # Metric 1: EXPIRY_RISK_RATE
    metrics.append({
        "metricCode":      "EXPIRY_RISK_RATE",
        "metricName":      "临期风险率",
        "value":           _decimal_to_number(risk_display),
        "formattedValue":  f"{float(expiry_risk_rate):.1f}%",
        "unit":            "%",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      _determine_expiry_risk_alert_level(expiry_risk_rate),
        "description":     "30天内临期库存占比",
    })

    # Metric 2: EXPIRING_COUNT (inline alert)
    expiring_count_alert = "GREEN" if not expiring_batches else "YELLOW"
    metrics.append({
        "metricCode":      "EXPIRING_COUNT",
        "metricName":      "临期批次数",
        "value":           len(expiring_batches),  # Java new BigDecimal(int) → number
        "formattedValue":  f"{len(expiring_batches)} 批",
        "unit":            "批",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      expiring_count_alert,
        "description":     None,
    })

    # Metric 3: HIGH_RISK_COUNT (inline alert)
    high_risk_alert = "GREEN" if not high_risk_batches else "RED"
    metrics.append({
        "metricCode":      "HIGH_RISK_COUNT",
        "metricName":      "高风险批次",
        "value":           len(high_risk_batches),
        "formattedValue":  f"{len(high_risk_batches)} 批",
        "unit":            "批",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      high_risk_alert,
        "description":     "7天内过期",
    })

    # Metric 4: EXPIRED_COUNT (inline alert)
    expired_alert = "GREEN" if not expired_batches else "RED"
    metrics.append({
        "metricCode":      "EXPIRED_COUNT",
        "metricName":      "已过期批次",
        "value":           len(expired_batches),
        "formattedValue":  f"{len(expired_batches)} 批",
        "unit":            "批",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      expired_alert,
        "description":     None,
    })

    # Metric 5: EXPIRING_VALUE (MetricResult.of factory)
    metrics.append(_metric_result_of("EXPIRING_VALUE", "临期库存价值", expiring_value, "元"))

    return metrics


def _days(n: int):
    from datetime import timedelta
    return timedelta(days=n)
```

#### 3.7.5 `_get_expiring_batches_ranking` (FEFO sort + inline 7/15/30 alert, Java L375-417)

```python
async def _get_expiring_batches_ranking(
    factory_id: str, days_to_expiry: int = 30
) -> list[dict]:
    """Mirror Java getExpiringBatchesRanking (L375-417).

    Algorithm:
      L378 warningDate = LocalDate.now() + daysToExpiry
      L379 expiringBatches = findExpiringBatches(factoryId, warningDate)
      L385-389 sorted = filter(expireDate non-null).sorted(byExpireDate ASC).limit(20)
      L391-414 per batch:
        daysUntilExpiry = ChronoUnit.DAYS.between(today, expireDate)
        value = currentQuantity * (unitPrice ?: ZERO)
        alertLevel inline (T-INV-1 inline site #1):
          <= 7 → RED, <= 15 → YELLOW, else GREEN
        RankingItem: rank, name=batchNumber, value, target=daysUntilExpiry,
                     completionRate=currentQuantity, alertLevel

    ⚠️ Note: `_query_expiring_batches` returns rows already ORDER BY expire_date ASC
    (mirror Java SQL). But Java additionally filters non-null expireDate after fetch
    (line 386 — defensive) and limits to 20. Python mirror.
    """
    today = date.today()
    warning_date = today + _days(days_to_expiry)
    expiring_batches = await _query_expiring_batches(factory_id, warning_date)

    # Java line 385-389: filter non-null expireDate (defensive — query already filters
    # via BETWEEN CURRENT_DATE AND :warningDate, but Java still re-checks)
    filtered = [b for b in expiring_batches if b.get("expire_date") is not None]
    # SQL already ORDER BY expire_date ASC; limit 20
    sorted_batches = filtered[:20]

    rankings = []
    for rank, batch in enumerate(sorted_batches, start=1):
        days_until_expiry = (batch["expire_date"] - today).days
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        # Inline alert (T-INV-1 inline site #1): NOT extracted as helper
        if days_until_expiry <= _EXPIRING_RANKING_RED_DAYS:
            alert_level = "RED"
        elif days_until_expiry <= _EXPIRING_RANKING_YELLOW_DAYS:
            alert_level = "YELLOW"
        else:
            alert_level = "GREEN"

        rankings.append({
            "rank":           rank,
            "name":           batch.get("batch_number"),
            "value":          _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         days_until_expiry,    # Java new BigDecimal(long) → number
            "completionRate": _decimal_to_number(
                cq.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "alertLevel":     alert_level,
        })

    return rankings
```

#### 3.7.6 `_get_expiry_risk_chart` (PIE chart, 5-bucket LinkedHashMap, Java L421-478)

```python
async def _get_expiry_risk_chart(factory_id: str) -> dict:
    """Mirror Java getExpiryRiskChart (L421-478).

    ⚠️ T-INV-5 — LinkedHashMap pre-populates 5 buckets in EXACT order:
      ["正常（>30天）", "关注（15-30天）", "预警（7-15天）", "紧急（<7天）", "无保质期"]
    Python dict literal must mirror insertion order.

    ⚠️ NOTE: chart `data` array iterates dict.entries — pre-populated zero buckets
    EMIT (not filtered like getLossReasonChart L597). Output is always 5 entries.

    ⚠️ Bucket boundary trap (Java L444-453, **strict `<` boundaries**):
      < 7  → "紧急（<7天）"
      < 15 → "预警（7-15天）"   (i.e., 7..14 fall here)
      < 30 → "关注（15-30天）"  (i.e., 15..29 fall here)
      else → "正常（>30天）"    (i.e., 30+ falls here, despite label "(>30天)")
      expireDate null → "无保质期"

    options LinkedHashMap order: [showPercentage, showLegend, colors] (Java L466-468)
    colors Arrays.asList — 5 elements, must match bucket count + order:
      ["#52c41a", "#faad14", "#ff7a45", "#ff4d4f", "#8c8c8c"]
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    # T-INV-5: Pre-populate dict in EXACT Java insertion order
    risk_distribution: dict[str, Decimal] = {
        "正常（>30天）":   Decimal("0"),
        "关注（15-30天）": Decimal("0"),
        "预警（7-15天）":  Decimal("0"),
        "紧急（<7天）":    Decimal("0"),
        "无保质期":        Decimal("0"),
    }

    for batch in all_batches:
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        expire_date = batch.get("expire_date")
        if expire_date is None:
            risk_distribution["无保质期"] += value
            continue

        days_until_expiry = (expire_date - today).days
        if days_until_expiry < 7:
            risk_distribution["紧急（<7天）"] += value
        elif days_until_expiry < 15:
            risk_distribution["预警（7-15天）"] += value
        elif days_until_expiry < 30:
            risk_distribution["关注（15-30天）"] += value
        else:
            risk_distribution["正常（>30天）"] += value

    # Java L456-463: chart_data iterates dict.entries (preserves insertion order)
    chart_data = [
        {
            "status": status_label,
            "value":  _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for status_label, value in risk_distribution.items()
    ]

    options = {
        "showPercentage": True,
        "showLegend":     True,
        "colors":         ["#52c41a", "#faad14", "#ff7a45", "#ff4d4f", "#8c8c8c"],
    }

    return {
        "chartType":   "PIE",
        "title":       "临期风险分布",
        "xAxisField":  "status",
        "yAxisField":  "value",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }
```

#### 3.7.7 `_get_aging_metrics` (3 metrics + inline 10/20 alert, Java L720-770)

```python
async def _get_aging_metrics(factory_id: str) -> list[dict]:
    """Mirror Java getAgingMetrics (L720-770).

    Returns 2 or 3 MetricResult (AVG_AGING_DAYS conditional):
      [SLOW_MOVING_RATE, SLOW_MOVING_VALUE, AVG_AGING_DAYS?]

    Algorithm:
      L723 today = LocalDate.now()
      L724 allBatches = findByFactoryIdAndStatus(factoryId, AVAILABLE)
      L727 totalValue = calculateTotalInventoryValue(allBatches)
      L730-735 slowMovingValue = sum(currentQty * unitPrice for batches with
                                      receiptDate non-null AND ageDays > 90)
      L737-739 slowMovingRate = (totalValue > 0) ? slowMovingValue/totalValue * 100 : 0
                                                                  ⚠️ T-INV-2 div guard
      L741-753 metric 1: SLOW_MOVING_RATE (inline alert >20 RED, >10 YELLOW, else GREEN —
                                            T-INV-1 inline site #3)
      L756 metric 2: SLOW_MOVING_VALUE (MetricResult.of factory)
      L759-762 avgAging = mapToLong(daysBetween).average() → OptionalDouble
      L764-767 metric 3 conditional: only if avgAging.isPresent()
                                      AVG_AGING_DAYS = new BigDecimal(avgAging.getAsDouble()).setScale(0)

    ⚠️ T-INV-3 ChronoUnit.DAYS.between(receiptDate, today) — for non-null receipt_date.
    ⚠️ Java line 766: avgAging.getAsDouble() returns double, then new BigDecimal(double).
       Double-to-BigDecimal can introduce precision artifacts. Python equivalent:
       avg_days = sum / count → Decimal directly, OR statistics.mean → Decimal.
       Spec recommends: compute as Decimal arithmetic from start to avoid drift.
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")
    metrics: list[dict] = []

    total_value = _calculate_total_inventory_value(all_batches)

    slow_moving_value = Decimal("0")
    for b in all_batches:
        rd = b.get("receipt_date")
        if rd is None:
            continue
        age_days = (today - rd).days
        if age_days > _AGING_WARNING:
            cq = _get_current_quantity(b)
            up = b.get("unit_price")
            up_dec = _to_decimal(up) if up is not None else Decimal("0")
            slow_moving_value += cq * up_dec

    if total_value > Decimal("0"):
        slow_moving_rate = (slow_moving_value / total_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        ) * Decimal("100")
    else:
        slow_moving_rate = Decimal("0")

    # Inline alert (T-INV-1 inline site #3): NOT extracted as helper
    if slow_moving_rate > _SLOW_MOVING_RED_INLINE:
        slow_alert = "RED"
    elif slow_moving_rate > _SLOW_MOVING_YELLOW_INLINE:
        slow_alert = "YELLOW"
    else:
        slow_alert = "GREEN"

    rate_display = slow_moving_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    metrics.append({
        "metricCode":      "SLOW_MOVING_RATE",
        "metricName":      "呆滞库存率",
        "value":           _decimal_to_number(rate_display),
        "formattedValue":  f"{float(slow_moving_rate):.1f}%",
        "unit":            "%",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      slow_alert,
        "description":     "90天以上库龄占比",
    })

    metrics.append(_metric_result_of("SLOW_MOVING_VALUE", "呆滞库存价值", slow_moving_value, "元"))

    # AVG_AGING_DAYS conditional (Java L764 isPresent check)
    age_days_list = [
        (today - b["receipt_date"]).days
        for b in all_batches
        if b.get("receipt_date") is not None
    ]
    if age_days_list:
        # Compute as Decimal mean, then setScale(0, HALF_UP) — mirror Java L766
        avg_days = (Decimal(sum(age_days_list)) / Decimal(len(age_days_list))).quantize(
            Decimal("1"), rounding=_QUANTIZE_HALF_UP
        )
        metrics.append(_metric_result_of("AVG_AGING_DAYS", "平均库龄", avg_days, "天"))

    return metrics
```

#### 3.7.8 `_get_inventory_aging_chart` (BAR chart, 4-bucket LinkedHashMap, Java L660-716)

```python
async def _get_inventory_aging_chart(factory_id: str) -> dict:
    """Mirror Java getInventoryAgingChart (L660-716).

    ⚠️ T-INV-5 — LinkedHashMap pre-populates 4 buckets in EXACT order:
      ["0-30天", "31-60天", "61-90天", "90天以上"]
    Python dict literal must mirror.

    ⚠️ Aging bucket boundaries (Java L684-692, **inclusive `<=` upper**):
      ageDays <= 30 → "0-30天"
      ageDays <= 60 → "31-60天"   (i.e., 31..60 fall here)
      ageDays <= 90 → "61-90天"   (i.e., 61..90 fall here)
      else          → "90天以上"  (i.e., 91+)
      receipt_date null → "90天以上" (Java L678-680, special case)

    ⚠️ T-INV-3 — null receipt_date is bucketed into "90天以上", NOT "0-30天".
    PR-C `TestInventoryAgingBucketBoundaries` 显式 test 此 case.

    options LinkedHashMap order: [showDataLabels, colors]
    colors: ["#52c41a", "#1890ff", "#faad14", "#ff4d4f"] — 4 elements
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    # T-INV-5: pre-populate in EXACT Java order
    aging_distribution: dict[str, Decimal] = {
        "0-30天":   Decimal("0"),
        "31-60天":  Decimal("0"),
        "61-90天":  Decimal("0"),
        "90天以上": Decimal("0"),
    }

    for batch in all_batches:
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        receipt_date = batch.get("receipt_date")
        if receipt_date is None:
            aging_distribution["90天以上"] += value
            continue

        age_days = (today - receipt_date).days
        if age_days <= _AGING_FRESH:
            aging_distribution["0-30天"] += value
        elif age_days <= _AGING_NORMAL:
            aging_distribution["31-60天"] += value
        elif age_days <= _AGING_WARNING:
            aging_distribution["61-90天"] += value
        else:
            aging_distribution["90天以上"] += value

    chart_data = [
        {
            "aging": age_label,
            "value": _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for age_label, value in aging_distribution.items()
    ]

    options = {
        "showDataLabels": True,
        "colors":         ["#52c41a", "#1890ff", "#faad14", "#ff4d4f"],
    }

    return {
        "chartType":   "BAR",
        "title":       "库龄分布",
        "xAxisField":  "aging",
        "yAxisField":  "value",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }
```

#### 3.7.9 `_get_long_aging_batches_ranking` (age desc sort + inline 90/120 alert, Java L774-818)

```python
async def _get_long_aging_batches_ranking(
    factory_id: str, min_days: int = 60
) -> list[dict]:
    """Mirror Java getLongAgingBatchesRanking (L774-818).

    Algorithm:
      L777 today = LocalDate.now()
      L778 allBatches = findByFactoryIdAndStatus(factoryId, AVAILABLE)
      L784-791 longAgingBatches = filter(receiptDate non-null)
                                       .filter(ageDays >= minDays)
                                       .sorted(by ageDays DESC)  ← Java line 787-789
                                       .limit(20)
      L793-815 per batch:
        ageDays = ChronoUnit.DAYS.between(receiptDate, today)
        value = currentQuantity * (unitPrice ?: ZERO)
        alertLevel inline (T-INV-1 inline site #2):
          > 120 → RED, > 90 → YELLOW, else GREEN
        RankingItem: rank, name=batchNumber, value, target=ageDays,
                     completionRate=currentQuantity, alertLevel

    ⚠️ **T-INV-14 (Cycle 2 BLOCKER 2 lock-in)** — Java L786 uses `>= minDays`
    (**INCLUSIVE**) for filter, default 60. Python pseudo-code below mirrors with
    `>=`. A batch aged exactly 60 days IS included. Implementation MUST NOT silently
    use `>` (strict greater) or it drops the boundary case. PR-C
    `TestInventoryLongAgingFilterBoundary` 显式 test ageDays==60 inclusion.

    Note `>= 60` filter then `> 90` YELLOW threshold means ageDays in [60, 90]
    falls to GREEN (the inline else clause). PR-C boundary test verifies.
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    filtered = [
        b for b in all_batches
        if b.get("receipt_date") is not None
        and (today - b["receipt_date"]).days >= min_days
    ]

    # Java line 787-789: sort by ageDays DESC (older batches first)
    filtered.sort(
        key=lambda b: (today - b["receipt_date"]).days,
        reverse=True,
    )
    long_aging = filtered[:20]

    rankings = []
    for rank, batch in enumerate(long_aging, start=1):
        age_days = (today - batch["receipt_date"]).days
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        # Inline alert (T-INV-1 inline site #2): NOT extracted
        if age_days > _LONG_AGING_RANKING_RED_DAYS:
            alert_level = "RED"
        elif age_days > _LONG_AGING_RANKING_YELLOW_DAYS:
            alert_level = "YELLOW"
        else:
            alert_level = "GREEN"

        rankings.append({
            "rank":           rank,
            "name":           batch.get("batch_number"),
            "value":          _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         age_days,
            "completionRate": _decimal_to_number(
                cq.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "alertLevel":     alert_level,
        })

    return rankings
```

### 3.8 Default mode `_get_inventory_health` (DashboardResponse, PR-B)

```python
async def _get_inventory_health(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getInventoryHealth (L89-135).

    DashboardResponse JSON shape (Java @Builder field order):
      [kpiCards, charts, rankings, aiInsights, suggestions, lastUpdated]

    Empty batches → buildEmptyDashboard (L1222-1236) — emits empty list/map +
    1 AIInsight + 1 suggestion + lastUpdated still volatile.

    ⚠️ T-INV-11 — recursive call chain (NOT optimized):
      _get_inventory_health → _calculate_kpi_cards
        → _get_turnover_analysis (3rd query of allBatches)
        → _get_expiry_risk_analysis (3rd query of allBatches in expiry path)
        → _get_health_score
          → _get_turnover_analysis again
          → _get_expiry_risk_analysis again
          → _get_loss_analysis (NOT ported — would need T-INV-8 handling)
          → _get_aging_metrics

    ⚠️ T-INV-8 — getInventoryHealth charts list (Java L105-108) does NOT include
    radar or loss-trend chart. Default mode charts are exactly:
      [getInventoryAgingChart, getExpiryRiskChart, buildMaterialCategoryValueChart]
    PR-B port reflects this — no radar, no loss-anything.

    ⚠️ getHealthScore depends on _get_loss_analysis (Java L866-869 calls
    getLossAnalysis to fetch LOSS_RATE for healthScore dimension #3). Since
    PR-B does not port getLossAnalysis as a public method, _get_health_score
    calls a private inline `_calculate_loss_rate_for_health_score(factory_id,
    start_date, end_date)` helper that mirrors getLossAnalysis line 484-528
    (just enough to compute LOSS_RATE; no public-facing metrics list).
    """
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    if not all_batches:
        return _build_empty_dashboard()

    # Java line 101: kpiCards
    metric_results = await _calculate_kpi_cards(all_batches, factory_id, start_date, end_date)
    kpi_cards = _convert_to_kpi_cards(metric_results)

    # Java line 105-108: charts list (3 charts) + LinkedHashMap by title.replace(" ", "_")
    chart_list = [
        await _get_inventory_aging_chart(factory_id),
        await _get_expiry_risk_chart(factory_id),
        _build_material_category_value_chart(all_batches),
    ]
    charts: dict[str, dict] = {}
    for chart in chart_list:
        title = chart.get("title")
        key = title.replace(" ", "_") if title else f"chart_{len(charts)}"
        charts[key] = chart

    # Java line 115-119: rankings LinkedHashMap with keys "expiring", "aging"
    expiring_ranking = await _get_expiring_batches_ranking(factory_id, _DEFAULT_EXPIRY_WARNING_DAYS)
    aging_ranking = await _get_long_aging_batches_ranking(factory_id, _AGING_NORMAL)
    rankings = {
        "expiring": expiring_ranking,
        "aging":    aging_ranking,
    }

    # Java line 122-125: rule-based generators (NO LLM)
    ai_insights = _generate_ai_insights(all_batches, metric_results, factory_id)
    suggestions = _generate_suggestions(all_batches, metric_results)

    # Java line 127-134: DashboardResponse @Builder field order
    return {
        "kpiCards":    kpi_cards,
        "charts":      charts,
        "rankings":    rankings,
        "aiInsights":  ai_insights,
        "suggestions": suggestions,
        "lastUpdated": _utc_now_iso(),    # T2 volatile, stripped by _strip_volatile
    }


async def _calculate_kpi_cards(
    batches: list[dict], factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java calculateKpiCards (L1005-1053).

    Returns 5 KPI metrics:
      [INVENTORY_VALUE, BATCH_COUNT, TURNOVER_RATE, EXPIRY_RISK_RATE, HEALTH_SCORE]

    ⚠️ KPI 3 (TURNOVER_RATE) and KPI 4 (EXPIRY_RISK_RATE) are pulled from
    sub-service results via filter+findFirst. If sub-service returned no metric
    with that code, the KPI is **omitted** (Java line 1035 `if (turnover != null)`).
    """
    kpi_cards: list[dict] = []

    # KPI 1: INVENTORY_VALUE (computed directly from batches in-memory, NOT via
    # _query_inventory_value_total — Java line 1010-1018 uses
    # calculateTotalInventoryValue helper)
    total_value = _calculate_total_inventory_value(batches)
    kpi_cards.append({
        "metricCode":      "INVENTORY_VALUE",
        "metricName":      "库存总值",
        "value":           _decimal_to_number(
            total_value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
        ),
        "formattedValue":  _format_currency(total_value),
        "unit":            "元",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      "GREEN",
        "description":     None,
    })

    # KPI 2: BATCH_COUNT
    kpi_cards.append({
        "metricCode":      "BATCH_COUNT",
        "metricName":      "库存批次",
        "value":           len(batches),
        "formattedValue":  f"{len(batches):,}",   # Java %,d format
        "unit":            "批",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      "GREEN",
        "description":     None,
    })

    # KPI 3: TURNOVER_RATE — pulled from getTurnoverAnalysis result
    turnover_metrics = await _get_turnover_analysis(factory_id, start_date, end_date)
    turnover = next(
        (m for m in turnover_metrics if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover is not None:
        kpi_cards.append(turnover)

    # KPI 4: EXPIRY_RISK_RATE — pulled from getExpiryRiskAnalysis result
    expiry_metrics = await _get_expiry_risk_analysis(factory_id)
    expiry_risk = next(
        (m for m in expiry_metrics if m.get("metricCode") == "EXPIRY_RISK_RATE"),
        None,
    )
    if expiry_risk is not None:
        kpi_cards.append(expiry_risk)

    # KPI 5: HEALTH_SCORE — always added (Java L1049-1050)
    health_score = await _get_health_score(factory_id, start_date, end_date)
    kpi_cards.append(health_score)

    return kpi_cards


def _build_material_category_value_chart(batches: list[dict]) -> dict:
    """Mirror Java buildMaterialCategoryValueChart (L1068-1102).

    PIE chart of top-10 material categories by total value.
    Algorithm:
      L1069-1077 categoryValues = groupingBy(materialTypeId,
                                              reducing(currentQty * unitPrice))
      L1079-1088 chartData = entries.sorted(byValue desc).limit(10)
                                      .map(entry → {category, value (DISPLAY_SCALE=2)})
      L1090-1092 options: [showPercentage=true, showLegend=true]
    """
    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is None:
            continue
        cq = _get_current_quantity(b)
        up = b.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec
        category_values[mtid] = category_values.get(mtid, Decimal("0")) + value

    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)
    chart_data = [
        {
            "category": mtid,
            "value":    _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for mtid, value in sorted_entries[:10]
    ]

    options = {
        "showPercentage": True,
        "showLegend":     True,
    }

    return {
        "chartType":   "PIE",
        "title":       "材料类别库存占比",
        "xAxisField":  "category",
        "yAxisField":  "value",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }


def _generate_ai_insights(
    batches: list[dict], kpi_cards: list[dict], factory_id: str
) -> list[dict]:
    """Mirror Java generateAiInsights (L1107-1177).

    Rule-based, NO LLM. 3 conditional insights:
    1. Expiry risk:
       - rate > EXPIRY_RED_THRESHOLD (15) → RED insight
       - rate > EXPIRY_YELLOW_THRESHOLD (10) → YELLOW insight
       - else: no insight
    2. Turnover:
       - rate < TURNOVER_RED_THRESHOLD (6) → RED insight
       - rate < TURNOVER_YELLOW_THRESHOLD (12) → YELLOW insight
       - else: no insight
    3. Health score:
       - score >= 80 → GREEN insight (good)
       - else: no insight (Java only emits "good" message)

    AIInsight JSON shape (Java @Builder):
      [level, category, message, actionSuggestion]

    ⚠️ %.1f / %.0f formatting trap — Java uses doubleValue() for format strings.
    Python uses float() conversion of Decimal which can introduce display drift
    for very precise values, but for byte-shape parity with golden recordings
    (already capture Java output), Python str f"{float(...):.Nf}" matches.
    """
    insights: list[dict] = []

    # Insight 1: Expiry risk
    expiry_risk = next(
        (m for m in kpi_cards if m.get("metricCode") == "EXPIRY_RISK_RATE"),
        None,
    )
    if expiry_risk is not None and expiry_risk.get("value") is not None:
        rate = _to_decimal(expiry_risk["value"])
        if rate > _EXPIRY_RISK_RED:
            insights.append({
                "level":            "RED",
                "category":         "临期风险",
                "message":          f"临期风险率高达 {float(rate):.1f}%，需要立即处理",
                "actionSuggestion": "建议优先消耗临期库存，考虑促销或转让处理",
            })
        elif rate > _EXPIRY_RISK_YELLOW:
            insights.append({
                "level":            "YELLOW",
                "category":         "临期风险",
                "message":          f"临期风险率为 {float(rate):.1f}%，需要关注",
                "actionSuggestion": "建议制定临期库存消化计划",
            })

    # Insight 2: Turnover
    turnover = next(
        (m for m in kpi_cards if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover is not None and turnover.get("value") is not None:
        rate = _to_decimal(turnover["value"])
        if rate < _TURNOVER_RED:
            insights.append({
                "level":            "RED",
                "category":         "周转效率",
                "message":          f"库存周转率仅 {float(rate):.1f} 次/年，库存积压严重",
                "actionSuggestion": "建议减少采购量，加快库存消化，优化安全库存设置",
            })
        elif rate < _TURNOVER_YELLOW:
            insights.append({
                "level":            "YELLOW",
                "category":         "周转效率",
                "message":          f"库存周转率 {float(rate):.1f} 次/年，有优化空间",
                "actionSuggestion": "建议优化采购批次和频率，提高周转效率",
            })

    # Insight 3: Health score (only emits when score >= 80, NOT for low scores)
    health_score = next(
        (m for m in kpi_cards if m.get("metricCode") == "HEALTH_SCORE"),
        None,
    )
    if health_score is not None and health_score.get("value") is not None:
        score = _to_decimal(health_score["value"])
        if score >= Decimal("80"):
            insights.append({
                "level":            "GREEN",
                "category":         "整体健康",
                "message":          f"库存健康评分 {float(score):.0f} 分，状况良好",
                "actionSuggestion": "继续保持当前库存管理策略",
            })

    return insights


def _generate_suggestions(batches: list[dict], kpi_cards: list[dict]) -> list[str]:
    """Mirror Java generateSuggestions (L1182-1217).

    Rule-based, returns list[str]. 3 conditional suggestions:
    1. expiringCount > 0 (batches expiring within 30 days)
    2. longAgingCount > 0 (batches with ageDays > 90)
    3. turnover < TURNOVER_YELLOW_THRESHOLD (12)
    """
    suggestions: list[str] = []
    today = date.today()

    # Suggestion 1
    warning_date = today + _days(_DEFAULT_EXPIRY_WARNING_DAYS)
    expiring_count = sum(
        1 for b in batches
        if b.get("expire_date") is not None and b["expire_date"] <= warning_date
    )
    if expiring_count > 0:
        suggestions.append(f"有 {expiring_count} 批库存将在30天内过期，建议优先安排使用")

    # Suggestion 2
    long_aging_count = sum(
        1 for b in batches
        if b.get("receipt_date") is not None
        and (today - b["receipt_date"]).days > _AGING_WARNING
    )
    if long_aging_count > 0:
        suggestions.append(f"有 {long_aging_count} 批库存库龄超过90天，建议检查使用计划或考虑处理")

    # Suggestion 3
    turnover = next(
        (m for m in kpi_cards if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover is not None and turnover.get("value") is not None:
        rate = _to_decimal(turnover["value"])
        if rate < _TURNOVER_YELLOW:
            suggestions.append("库存周转率偏低，建议优化安全库存设置，减少不必要的采购")

    return suggestions


def _build_empty_dashboard() -> dict:
    """Mirror Java buildEmptyDashboard (L1222-1236).

    Empty fallback when no batches found. Emits exact Java strings:
      kpiCards: []
      charts: {}
      rankings: {}
      aiInsights: 1 entry [level=YELLOW, category=数据状态, ...]
      suggestions: ["请先录入库存数据以开始分析"]
      lastUpdated: still volatile (gets stripped by _strip_volatile in tests)
    """
    return {
        "kpiCards":    [],
        "charts":      {},
        "rankings":    {},
        "aiInsights":  [{
            "level":            "YELLOW",
            "category":         "数据状态",
            "message":          "当前暂无库存数据",
            "actionSuggestion": "请先录入原材料批次数据",
        }],
        "suggestions": ["请先录入库存数据以开始分析"],
        "lastUpdated": _utc_now_iso(),
    }
```

### 3.9 `_get_health_score` (T-INV-9 asymmetric null mirror, Java L824-921)

```python
async def _get_health_score(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getHealthScore (L824-921).

    Returns single MetricResult (HEALTH_SCORE).

    ⚠️⚠️ T-INV-9 — ASYMMETRIC NULL HANDLING (Java bug, port verbatim).

    Algorithm (4 weighted dimensions, 30+30+20+20 = 100 max):

    Dimension 1 — TURNOVER (max 30 pts), Java L830-844:
      turnoverRate = getTurnoverAnalysis().filter(TURNOVER_RATE).findFirst().orElse(null)
      if (turnoverRate != null && turnoverRate.value != null):
        rate = turnoverRate.value
        if (rate >= TURNOVER_YELLOW_THRESHOLD=12)  +30
        elif (rate >= TURNOVER_RED_THRESHOLD=6)    +20
        else                                        +10
      // ⚠️ Java L835-844 has NO else branch — turnover null → 0 added (penalty)

    Dimension 2 — EXPIRY (max 30 pts), Java L846-863:
      expiryRisk = getExpiryRiskAnalysis().filter(EXPIRY_RISK_RATE).findFirst().orElse(null)
      if (expiryRisk != null && expiryRisk.value != null):
        rate = expiryRisk.value
        if (rate < EXPIRY_YELLOW_THRESHOLD=10)  +30
        elif (rate < EXPIRY_RED_THRESHOLD=15)   +20
        else                                     +10
      else:
        // ⚠️ Java L862 — null → +30 (FULL POINTS, NOT penalty!)
        +30

    Dimension 3 — LOSS (max 20 pts), Java L865-882:
      lossRate = getLossAnalysis().filter(LOSS_RATE).findFirst().orElse(null)
      if (lossRate != null && lossRate.value != null):
        rate = lossRate.value
        if (rate < LOSS_YELLOW_THRESHOLD=2)  +20
        elif (rate < LOSS_RED_THRESHOLD=5)   +12
        else                                  +5
      else:
        // ⚠️ Java L881 — null → +20 (FULL POINTS)
        +20

    Dimension 4 — AGING (max 20 pts), Java L884-901:
      slowMoving = getAgingMetrics().filter(SLOW_MOVING_RATE).findFirst().orElse(null)
      if (slowMoving != null && slowMoving.value != null):
        rate = slowMoving.value
        if (rate < 10)  +20
        elif (rate < 20) +12
        else             +5
      else:
        // ⚠️ Java L899 — null → +20 (FULL POINTS)
        +20

    Overall alert (Java L903-910, inline ternary T-INV-1 site #4):
      if score >= 80   GREEN
      elif score >= 60 YELLOW
      else             RED

    Output (Java L912-920):
      MetricResult: code=HEALTH_SCORE, name="库存健康评分",
                    value=score.setScale(0, HALF_UP),
                    formattedValue=String.format("%.0f 分", score.doubleValue()),
                    unit="分", alertLevel=overallAlert,
                    description="满分100分"

    ⚠️⚠️ T-INV-9 spec decision: PORT VERBATIM. Do NOT make handling symmetric.
    PR-C `TestInventoryHealthScoreAsymmetric` regression test asserts:
      - all 4 metrics None: score = 0+30+20+20 = 70 (NOT 0)
      - turnover None alone: score = 0 + (expiry/loss/aging contributions)
      - expiry None alone: score = (turnover) + 30 + (loss/aging)
    Cross-spec lineage: see §7 risk #2.

    ⚠️⚠️ **T-INV-15 — DO NOT reuse named alert helpers inside this function!**
    (Cycle 2 audit MAJOR 3 lock-in)

    The 4 named helpers (`_determine_*_alert_level`) use **DIFFERENT comparison
    direction** than the inline scoring tiers below:
      - `_determine_turnover_alert_level`: rate < RED (regular dir, lower=worse)
        BUT scoring uses `rate >= TURNOVER_YELLOW` for full pts (Java L837)
      - `_determine_expiry_risk_alert_level`: rate > RED (inverse, strict >)
        BUT scoring uses `rate < EXPIRY_YELLOW` for full pts (Java L854)
      - `_determine_loss_rate_alert_level`: rate > RED (inverse, strict >)
        BUT scoring uses `rate < LOSS_YELLOW` for full pts (Java L873)
      - aging slow-moving (no helper, inline 10/20 INVERSE in getAgingMetrics)
        BUT scoring uses `rate < 10` for 20pts (Java L892)

    Implementation MUST inline the comparisons exactly as Java getHealthScore
    L835-901 — calling the named helpers and mapping AlertLevel → score is WRONG
    (would invert thresholds for 3 of 4 dimensions and break the score).
    """
    health_score = Decimal("0")

    # Dimension 1 — TURNOVER (max 30 pts) — null → +0 (Java L835-844 NO else)
    turnover_metrics = await _get_turnover_analysis(factory_id, start_date, end_date)
    turnover_rate = next(
        (m for m in turnover_metrics if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover_rate is not None and turnover_rate.get("value") is not None:
        rate = _to_decimal(turnover_rate["value"])
        if rate >= _TURNOVER_YELLOW:
            health_score += Decimal("30")
        elif rate >= _TURNOVER_RED:
            health_score += Decimal("20")
        else:
            health_score += Decimal("10")
    # else: +0 (T-INV-9 asymmetric — turnover null is penalty)

    # Dimension 2 — EXPIRY (max 30 pts) — null → +30 (Java L862 FULL POINTS)
    expiry_metrics = await _get_expiry_risk_analysis(factory_id)
    expiry_risk = next(
        (m for m in expiry_metrics if m.get("metricCode") == "EXPIRY_RISK_RATE"),
        None,
    )
    if expiry_risk is not None and expiry_risk.get("value") is not None:
        rate = _to_decimal(expiry_risk["value"])
        if rate < _EXPIRY_RISK_YELLOW:
            health_score += Decimal("30")
        elif rate < _EXPIRY_RISK_RED:
            health_score += Decimal("20")
        else:
            health_score += Decimal("10")
    else:
        health_score += Decimal("30")    # T-INV-9 asymmetric

    # Dimension 3 — LOSS (max 20 pts) — null → +20 (Java L881 FULL POINTS)
    loss_metrics = await _calculate_loss_rate_for_health_score(factory_id, start_date, end_date)
    loss_rate = next(
        (m for m in loss_metrics if m.get("metricCode") == "LOSS_RATE"),
        None,
    )
    if loss_rate is not None and loss_rate.get("value") is not None:
        rate = _to_decimal(loss_rate["value"])
        if rate < _LOSS_RATE_YELLOW:
            health_score += Decimal("20")
        elif rate < _LOSS_RATE_RED:
            health_score += Decimal("12")
        else:
            health_score += Decimal("5")
    else:
        health_score += Decimal("20")    # T-INV-9 asymmetric

    # Dimension 4 — AGING (max 20 pts) — null → +20 (Java L899 FULL POINTS)
    aging_metrics = await _get_aging_metrics(factory_id)
    slow_moving = next(
        (m for m in aging_metrics if m.get("metricCode") == "SLOW_MOVING_RATE"),
        None,
    )
    if slow_moving is not None and slow_moving.get("value") is not None:
        rate = _to_decimal(slow_moving["value"])
        if rate < Decimal("10"):
            health_score += Decimal("20")
        elif rate < Decimal("20"):
            health_score += Decimal("12")
        else:
            health_score += Decimal("5")
    else:
        health_score += Decimal("20")    # T-INV-9 asymmetric

    # Overall alert (T-INV-1 inline site #4)
    if health_score >= _HEALTH_SCORE_GREEN_MIN:
        alert_level = "GREEN"
    elif health_score >= _HEALTH_SCORE_YELLOW_MIN:
        alert_level = "YELLOW"
    else:
        alert_level = "RED"

    score_zero_scale = health_score.quantize(Decimal("1"), rounding=_QUANTIZE_HALF_UP)
    return {
        "metricCode":      "HEALTH_SCORE",
        "metricName":      "库存健康评分",
        "value":           _decimal_to_number(score_zero_scale),
        "formattedValue":  f"{float(health_score):.0f} 分",
        "unit":            "分",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      alert_level,
        "description":     "满分100分",
    }


async def _calculate_loss_rate_for_health_score(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror subset of Java getLossAnalysis (L484-545) — ONLY LOSS_RATE metric.

    Public getLossAnalysis is NOT controller-dispatched (see §1.3 out-of-scope),
    but getHealthScore (Java L866-869) calls it for LOSS_RATE dimension input.

    This helper computes JUST the LOSS_RATE metric for health score consumption.
    Returns list[dict] (mirrors public getLossAnalysis return type) but with
    only the LOSS_RATE entry — health score's filter+findFirst pattern works
    transparently with this single-element list.

    Algorithm (Java L484-528, just the LOSS_RATE pieces):
      L490 allBatches = findByFactoryIdAndStatus(factoryId, AVAILABLE)
      L491 totalInventoryValue = calculateTotalInventoryValue(allBatches)
      L494-518 per batch, fetch adjustments in time range, accumulate by type:
        - "loss" type → lossAmount += abs(adjQty) * unitPrice
        - "damage" type → damageAmount += abs(adjQty) * unitPrice
        - "correction" AND adjQty < 0 → correctionAmount += abs(adjQty) * unitPrice
      L520 totalLoss = lossAmount + damageAmount + correctionAmount
      L526-528 lossRate = (totalInventoryValue > 0)
                          ? totalLoss / totalInventoryValue * 100 : 0
                          ⚠️ T-INV-2 div guard

    Returns: [{metricCode: "LOSS_RATE", value: lossRate, alertLevel: ...}]
    """
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")
    total_inventory_value = _calculate_total_inventory_value(all_batches)

    loss_amount = Decimal("0")
    damage_amount = Decimal("0")
    correction_amount = Decimal("0")

    for batch in all_batches:
        adjustments = await _query_batch_adjustments_in_range(
            batch["id"], start_date, end_date
        )
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")

        for adj in adjustments:
            adj_qty = _to_decimal(adj["adjustment_quantity"])
            adj_value = abs(adj_qty) * up_dec
            adj_type = adj.get("adjustment_type")

            if adj_type == "loss":
                loss_amount += adj_value
            elif adj_type == "damage":
                damage_amount += adj_value
            elif adj_type == "correction" and adj_qty < Decimal("0"):
                correction_amount += adj_value

    total_loss = loss_amount + damage_amount + correction_amount

    if total_inventory_value > Decimal("0"):
        loss_rate = (total_loss / total_inventory_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        ) * Decimal("100")
    else:
        loss_rate = Decimal("0")

    rate_display = loss_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return [{
        "metricCode":      "LOSS_RATE",
        "metricName":      "损耗率",
        "value":           _decimal_to_number(rate_display),
        "formattedValue":  f"{float(loss_rate):.2f}%",
        "unit":            "%",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      _determine_loss_rate_alert_level(loss_rate),
        "description":     None,
    }]
```

---

## 4. Byte-shape gate

### 4.1 Golden recording (HARD prereq for impl plan)

**Before** PR-A impl chat creates implementation plan, the spec author MUST record 4 goldens:

```bash
./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31&analysisType=turnover" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-turnover.json

./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31&analysisType=expiry" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-expiry.json

./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31&analysisType=aging" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-aging.json

./scripts/record-java-golden.sh F999 \
    /api/mobile/F999/smart-bi/analysis/inventory \
    --params "startDate=2025-01-01&endDate=2025-01-31" \
    > tests/fixtures/java-smartbi-golden/analysis-inventory-F999-default.json
```

⚠️ **Golden record date sensitivity**: `getExpiryRiskAnalysis` and `getInventoryAgingChart`
use `LocalDate.now()` (Java) / `date.today()` (Python). Goldens captured at date X will
diverge from Python output at date Y unless test fixture mocks today's date.

⚠️ **Cycle 4 MAJOR 6 — F999 seed determinism constraint** for `_query_expiring_batches`:

The query result has single-col `ORDER BY expire_date ASC` (mirrors Java, see §3.3 +
Risk 3). When `_get_expiring_batches_ranking` does `filtered[:20]` truncation, batches
sharing identical `expire_date` get an unstable secondary order from PostgreSQL.

**F999 seed MUST guarantee no two AVAILABLE batches share `expire_date`** (or, if
ranking returns ≤20 total batches, the truncation never triggers — alternate
mitigation). Add to `db_seed_inventory_full` fixture in `conftest.py` (PR-A impl
chat):

    # Assertion in fixture
    expire_dates = [b.expire_date for b in seeded_batches if b.status == 'AVAILABLE']
    assert len(set(expire_dates)) == len(expire_dates), \\
        "F999 inventory seed must use unique expire_date per AVAILABLE batch"

If this fixture invariant breaks (e.g., future seed expansion), goldens will become
flaky across DB re-creates. PR-A impl plan must enforce this via fixture assertion,
NOT via lifting the no-`id`-tiebreaker rule (Risk 3 lock-in).

**Test impl strategy**: PR-A contract tests use `monkeypatch.setattr` on
`smartbi_compat.api.analysis_inventory.date` to freeze today; goldens recorded
at corresponding fixed date during impl phase.

### 4.2 Byte-shape gate strategy

- **Phase 2A gate**: dict-eq tolerance (numeric `0` vs `0.0` equivalent; trailing whitespace
  in strings ignored). Same as procurement / department / region.
- **Strict-byte gate (Phase 2B+)**: deferred. Requires canonical JSON serialization
  comparison. Inventory has 16 LinkedHashMap order sites — strict-byte upgrade
  will catch any insertion-order regression undetected by dict-eq.

### 4.3 `_strip_volatile` extension

Inventory `lastUpdated` already covered by `_strip_volatile` (`analysis_finance.VOLATILE_KEYS`
includes `"lastUpdated"`). NO extension needed.

Verification command (during PR-A impl):
```python
from smartbi_compat.api.analysis_finance import VOLATILE_KEYS
assert "lastUpdated" in VOLATILE_KEYS
```

---

## 5. Test strategy

### 5.1 PR-A contract tests (per-mode goldens)

**File**: `tests/python/smartbi_compat/test_analysis_inventory_contract.py`

```python
class TestAnalysisInventoryTurnoverMode:
    """3 tests — empty/populated/edge"""
    
    def test_turnover_empty_factory(self, client, monkeypatch_today):
        # Factory with no batches → metrics list empty/zeros
        # Asserts dict-eq vs analysis-inventory-F999-turnover-empty.json
        # (subset of golden where DB pre-seed empty)
        
    def test_turnover_populated_matches_golden(self, client, db_seed_inventory_full,
                                                monkeypatch_today):
        # F999 full seed; dict-eq vs main golden
        
    def test_turnover_zero_consumption_div_guard(self, client,
                                                  db_seed_inventory_no_consumption):
        # T-INV-2 div guard: turnoverRate = 0 when consumption empty
        # inventoryDays = 999 (Java fallback)


class TestAnalysisInventoryExpiryMode:
    """3 tests — empty/populated/all-null-expiry"""

    def test_expiry_all_no_expire_date(self, client, db_seed_inventory_null_expiry):
        # All batches have expire_date=NULL
        # → riskAnalysis.expiringBatches = 0, expiringBatchesRanking = []
        # → riskChart.data: only "无保质期" bucket has value, others zero


class TestAnalysisInventoryAgingMode:
    """3 tests — empty/populated/null-receipt-date"""

    def test_aging_null_receipt_date_bucket(self, client,
                                             db_seed_inventory_null_receipt):
        # T-INV-3: null receipt_date → "90天以上" bucket
        # Verify aging chart bucket assignment
```

### 5.2 PR-B default mode tests (DashboardResponse + asymmetric null T-INV-9)

```python
class TestAnalysisInventoryDefaultMode:
    """3 tests — empty/populated/T-INV-9 asymmetric"""

    def test_default_empty_dashboard(self, client, db_seed_empty,
                                      monkeypatch_today, strip_volatile):
        # buildEmptyDashboard branch — assert exact AIInsight + suggestion strings

    def test_default_populated_matches_golden(self, client, db_seed_inventory_full,
                                                monkeypatch_today, strip_volatile):
        # Full DashboardResponse vs golden, lastUpdated stripped

    def test_default_health_score_asymmetric_null_regression(self, client,
                                                              db_seed_inventory_partial):
        # T-INV-9 — DB seed where SOME metric inputs null
        # Assert score includes 30+20+20=70 from null defaults (NOT 0)
```

### 5.3 PR-C arithmetic depth tests

```python
class TestInventoryAlertHelpersArithmetic:
    """4 named helpers × 4 boundary cases = 16 tests"""
    # Turnover (regular): rate=5.99→RED, 6.0→YELLOW, 11.99→YELLOW, 12.0→GREEN
    # InventoryDays (inverse): days=60.01→RED, 60.0→YELLOW, 30.01→YELLOW, 30.0→GREEN
    # ExpiryRisk (inverse strict-): 15.0→YELLOW (NOT RED!), 15.01→RED,
    #                                10.0→GREEN (NOT YELLOW!), 10.01→YELLOW
    # LossRate (inverse strict-): 5.0→YELLOW, 5.01→RED, 2.0→GREEN, 2.01→YELLOW

class TestInventoryDivByZeroGuards:
    """5 sites × 3 cases = 15 tests"""
    # Each site: denominator=0 (returns 0 or fallback), denominator=tiny epsilon
    # (computes), denominator=normal (computes)

class TestInventoryDateArithmetic:
    """Annualization + days-until-expiry signed semantics + null receipt → '90天以上'"""

class TestInventoryLinkedHashMapOrder:
    """Regression — assert chart_data list order matches Java pre-population.

    ⚠️ **Cycle 4 MAJOR 5 lock-in**: under Phase 2A dict-eq gate, naive
    `assertEqual(response, golden)` IGNORES key order in dict comparisons.
    Tests MUST explicitly assert positional order:

        # ❌ THEATER (passes when Python dict reorders silently):
        assert chart["data"] == golden["data"]

        # ✅ REAL ORDER ASSERTION:
        actual_status_order = [d["status"] for d in chart["data"]]
        assert actual_status_order == ["正常（>30天）", "关注（15-30天）",
                                       "预警（7-15天）", "紧急（<7天）", "无保质期"]

    Coverage:
      expiry-risk-chart: 5-bucket positional order via list comp on data["status"]
      aging-chart: 4-bucket positional order via list comp on data["aging"]
      material-category-chart: top-10 sorted desc by value (assert ordered list)

    Defensive — also assert ALL 5 (or 4) keys present even when only one bucket
    has non-zero value: Java L456 always emits all entries, Python pre-populated
    dict iteration does too."""

class TestInventoryLossTrendChartMock:
    """T-INV-8 — assert _get_loss_trend_chart NOT exported from analysis_inventory.py.
       Defensive: if future commit adds it, this test FAILS to force review."""

class TestInventoryHealthScoreAsymmetric:
    """T-INV-9 regression. 5 cases:
       - all 4 inputs None → 0 + 30 + 20 + 20 = 70 (NOT 0)
       - all 4 inputs non-null full points → 30+30+20+20 = 100
       - all 4 inputs non-null worst → 10+10+5+5 = 30
       - turnover None alone → 0 + (other 3 contributions, depending)
       - expiry None alone → (turnover) + 30 + (loss/aging)"""


class TestInventoryHealthScoreTierArithmetic:
    """T-INV-15 — boundary tier arithmetic for 4 inline scoring branches in
    _get_health_score. Catches off-by-one on `>=` vs `>` and direction-inverted
    comparison errors (Cycle 2 audit MAJOR 4 lock-in).

    Per dimension, test 6 cases at threshold boundaries:

    Dimension 1 — TURNOVER (Java L837/839 use `>=`):
      rate=11.99 → +20 (not +30)
      rate=12.00 → +30 (boundary inclusive)
      rate=5.99  → +10
      rate=6.00  → +20 (boundary inclusive)
      rate=0.0   → +10
      rate=20.0  → +30

    Dimension 2 — EXPIRY (Java L854/856 use `<` strict):
      rate=9.99  → +30
      rate=10.0  → +20 (boundary excludes 10 from full pts)
      rate=14.99 → +20
      rate=15.0  → +10 (boundary excludes 15 from mid pts)
      rate=0.0   → +30
      rate=100.0 → +10

    Dimension 3 — LOSS (Java L873/875 use `<` strict):
      rate=1.99  → +20
      rate=2.0   → +12 (boundary excludes)
      rate=4.99  → +12
      rate=5.0   → +5  (boundary excludes)

    Dimension 4 — AGING slow-moving (Java L892/894 use `<` strict):
      rate=9.99  → +20
      rate=10.0  → +12
      rate=19.99 → +12
      rate=20.0  → +5

    Total ~24 boundary tests.
    """


class TestInventoryLongAgingFilterBoundary:
    """T-INV-14 (Cycle 2 BLOCKER 2 lock-in) — _get_long_aging_batches_ranking
    filter must be `>=` inclusive, not `>` strict. Test:
      ageDays=59, min_days=60 → batch EXCLUDED
      ageDays=60, min_days=60 → batch INCLUDED (boundary case)
      ageDays=61, min_days=60 → batch INCLUDED"""

class TestInventoryAgingBucketBoundaries:
    """4 boundaries × 2 sides = 8 tests (30/31, 60/61, 90/91, null receipt)"""

class TestInventoryGetCurrentQuantityFormula:
    """T-INV-13. Cases:
       - receiptQuantity null → ZERO regardless of other fields
       - usedQuantity null → treated as 0
       - reservedQuantity null → treated as 0
       - all 3 non-null → receiptQty - usedQty - reservedQty"""

class TestInventoryExpiringRankingInlineAlert:
    """4 boundary tests for 7/15 days inline ternary"""

class TestInventoryLongAgingRankingInlineAlert:
    """4 boundary tests for 90/120 days inline ternary"""
```

---

## 6. PR slicing

| PR | Scope | Estimated LOC | Goldens | Audit cycles |
|---|---|---|---|---|
| **PR-A** | per-type 3 modes (turnover/expiry/aging) + 9 sub-services + 4 named alert helpers + 6 SQL helpers + 4 inline alert sites | ~750 LOC code + ~400 LOC tests | F999-turnover, F999-expiry, F999-aging | 2 cycles |
| **PR-B** | default mode `getInventoryHealth` + DashboardResponse builders + `_get_health_score` (T-INV-9) + `_calculate_loss_rate_for_health_score` (private subset) + `_build_material_category_value_chart` + `_generate_ai_insights` + `_generate_suggestions` + `_build_empty_dashboard` | ~450 LOC code + ~200 LOC tests | F999-default | 2 cycles |
| **PR-C** | 10 arithmetic-depth test classes covering 4 alert helpers / 5 div-by-zero guards / date arithmetic / LinkedHashMap order regression / mock-zero / asymmetric null / aging bucket / current-quantity formula / 2 inline rankings | 0 LOC code + ~600 LOC tests | (none new) | 1 cycle |

**Sequencing**:
1. **Spec PR (this)** — merged first, no impl
2. **PR-A** — depends on Spec PR + 3 goldens recorded; impl chat starts here
3. **PR-B** — depends on PR-A merged (uses helpers from PR-A); 1 golden recorded
4. **PR-C** — depends on PR-B merged; pure tests, no impl

---

## 7. Open risks

### Risk 1 — T-INV-8 mock taxonomy ambiguity (resolved)

**State**: resolved via §1.3 mock taxonomy A/B documentation.

**Cross-spec lineage**:
- PR #37 (类别 A defer): quality + production full-mock generators deferred entirely.
- This spec (类别 B mirror): inventory `getLossTrendChart` hardcoded zeros literal-mirror.

**Future work**: when sister specs touch other Java services with mock-shaped behavior,
they must pick A or B per the §1.3 table. Spec author flag any ambiguous cases for
explicit decision in the brainstorm Round 1.

### Risk 2 — T-INV-9 asymmetric null Java side cleanup (deferred)

**State**: Java `getHealthScore` L835/862/881/899 has asymmetric null handling.
Almost certainly unintended (turnover null=0pts vs expiry/loss/aging null=full pts).

**Decision**: PORT VERBATIM. Phase 2A byte-shape parity > defensive fix.

**Cross-spec lineage** (mirror Rule 3 1:1 mirror Java semantics):
- department PR #36 §3.4 'C1 wording mismatch': Java comment 跟 impl 不一致 (说 "取最新记录"
  but actually MAX); spec ports verbatim impl, comment不对齐 stays.
- profit/cost specs in main: BigDecimal.ZERO division-by-zero guard 1:1 mirror, 不 paper
  over edge cases.
- Rule 3 spirit: 1:1 mirror Java semantics, byte-shape parity > defensive fix.

**Cleanup follow-up** (Phase 3+, NOT this PR):
- Java side `getHealthScore` should normalize null handling (probably: turnover null
  also +30 to match symmetry, OR all 4 dims null → 0 to make "no data" deterministic).
- Once Java side fixed, Python port via fresh golden recording + dict-eq diff.
- Backlog item co-tracked with T6 nginx cutover.

### Risk 3 — T-INV-12 `findExpiringBatches` single-col ORDER BY tiebreaker

**State**: Java `MaterialBatchRepository.findExpiringBatches` (L173-177) `ORDER BY
m.expireDate ASC` (single col). Same-expire-date rows return non-deterministic
secondary order from PostgreSQL.

**Decision** (per user lock-in): Python mirrors exact Java SQL — single col `ORDER BY
expire_date ASC`, NO `id` tiebreaker.

**Cleanup follow-up** (Phase 3+, NOT this PR):
- Java side should add `, id ASC` secondary tiebreaker.
- Once Java side fixed, Python adds `id` tiebreaker too via fresh golden recording.

### Risk 4 — `MetricCalculatorService` dead-code injection (Java side)

**State**: `InventoryHealthAnalysisServiceImpl` constructor injects `MetricCalculatorService`
but `grep metricCalculatorService\\.` in the impl returns 0 business calls. Field is
unused dead code.

**Decision**: Python ignores. Does NOT import `_calculate_mom_growth` or hoist any helper.

**Cleanup follow-up** (Phase 3+): Java side remove unused field.

### Risk 5 — `getCurrentQuantity` SQL vs @Transient null-handling divergence (T-INV-13)

**State**: §3.3 `_query_inventory_value_total` mirrors SQL behavior (NULL propagates →
row drops); §3.5 `_get_current_quantity` mirrors @Transient (null usedQty/reservedQty
→ ZERO default). Two paths produce different values when receiptQuantity non-null
but usedQuantity OR reservedQuantity null.

**Decision**: Mirror Java behavior on both paths exactly. PR-C
`TestInventoryGetCurrentQuantityFormula` locks in-memory path; SQL path
not separately tested (mirror ≡ SQL parity).

**Cleanup follow-up** (Phase 3+): Java side normalize @Transient and SQL formulas
(probably make SQL `COALESCE(used, 0)` etc to match @Transient). Once Java
fixed, golden re-record + dict-eq.

### Risk 7 — Private `_calculate_loss_rate_for_health_score` duplicates Java getLossAnalysis logic (Cycle 2 BLOCKER 1)

**State**: Java `getHealthScore` L866-869 calls public `getLossAnalysis(...)` to obtain
LOSS_RATE for dimension 3. But `getLossAnalysis` is NOT controller-dispatched (out-of-scope
per §1.3). Python solves this by extracting just the LOSS_RATE computation as private
helper `_calculate_loss_rate_for_health_score` (§3.9), mirroring Java L484-528 logic
subset.

**Decision**: Subset extraction is correct. Private helper does NOT export public
loss analysis surface; only feeds health score consumer. PR-C boundary test classes
cover the helper indirectly via `TestInventoryHealthScoreAsymmetric` and
`TestInventoryHealthScoreTierArithmetic` — explicit standalone test deferred (would
duplicate Java algorithm coverage already provided by health score tests).

**Cleanup follow-up** (Phase 3+):
- If future scope expansion requires public `_get_loss_analysis`, the private helper
  body becomes its core; expose by renaming + adding remaining 4 metrics
  (LOSS_AMOUNT, LOSS_MISSING, LOSS_DAMAGE, LOSS_CORRECTION).
- Java side cleanup candidate: extract `getLossRateOnly` from `getLossAnalysis` to
  remove unused metrics from health score's call path.

### Risk 6 — `LocalDate.now()` / `date.today()` timezone & test determinism

**State**: 5 sub-services use `LocalDate.now()` (Java) / `date.today()` (Python):
`getExpiryRiskAnalysis`, `getExpiringBatchesRanking`, `getExpiryRiskChart`,
`getInventoryAgingChart`, `getAgingMetrics`, `getLongAgingBatchesRanking`,
`generateSuggestions`.

**Decision**: Goldens record at known Beijing-time date (server time is UTC+8).
Tests `monkeypatch.setattr` `analysis_inventory.date` to the recording date
to ensure deterministic byte parity.

**Cleanup follow-up**: not strictly needed; pattern works. Phase 3+ if test
infrastructure standardizes a "frozen time" decorator, refactor.

---

## 8. References

- [`.claude/rules/python-java-port.md`](../../../.claude/rules/python-java-port.md) — Rule 1-8
  - Rule 1: explicit `is not None` (not Python `or` falsy)
  - Rule 2: WEEK calendar-year (NOT triggered — inventory hardcodes MONTH iteration)
  - Rule 3: 1:1 mirror Java signatures + semantics
  - Rule 4: `_decimal_to_number` for FastAPI Decimal serialization
  - Rule 5: SELECT * for shared SQL helpers
  - Rule 6: input boundary None-check on new SQL helpers
  - Rule 7: Decimal threshold compare for non-integer thresholds (NOT triggered for inventory — all integer thresholds)
  - Rule 8: `Map.of(N)` Jackson hash order — **NOT triggered** (inventory has 0 `Map.of` sites; all `LinkedHashMap.put()` + `Arrays.asList`)

- [PR #18 finance payable spec](https://github.com/j4xie/my-prototype-logistics/pull/18) — per-type pattern source
- [PR #21+#22 finance profit](https://github.com/j4xie/my-prototype-logistics/pull/21) — per-type peers
- [PR #25+#28 finance cost](https://github.com/j4xie/my-prototype-logistics/pull/25) — per-type peers + arithmetic depth
- [PR #30 `_get_period_key` calendar-year fix](https://github.com/j4xie/my-prototype-logistics/pull/30)
- [PR #32 finance 3 sub-endpoints](https://github.com/j4xie/my-prototype-logistics/pull/32) — first Map.of(N) trap discovery
- [PR #33+#34 finance receivable+budget specs](https://github.com/j4xie/my-prototype-logistics/pull/33)
- [PR #35 Rule 8 入 python-java-port.md](https://github.com/j4xie/my-prototype-logistics/pull/35)
- [PR #36 `/analysis/department` composite spec](https://github.com/j4xie/my-prototype-logistics/pull/36) — sister Tier 2 lock-in 模式 + C1 wording 模式 (T-INV-9 lineage)
- **[PR #37 defer quality + production](https://github.com/j4xie/my-prototype-logistics/pull/37) — 类别 A mock-defer 决策 (cross-ref §1.3)**
- [PR #38 finance budget per-type real impl](https://github.com/j4xie/my-prototype-logistics/pull/38) — PR-A pattern
- [PR #39 `/datasource` fields + history GET](https://github.com/j4xie/my-prototype-logistics/pull/39)
- **[PR #40 `/analysis/procurement` per-type spec](https://github.com/j4xie/my-prototype-logistics/pull/40) — Tier 2 直接前驱, 4-mode dispatcher 模板源**
- [PR #41 `/analysis/region` per-type spec](https://github.com/j4xie/my-prototype-logistics/pull/41) — sister Tier 2

**Java source files** (read locks):
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:411-448` — controller dispatcher
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java` — 1352 LOC service impl
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/InventoryHealthAnalysisService.java` — interface (15 methods)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialBatch.java:167-175` — `getCurrentQuantity()` @Transient formula
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/MaterialBatchStatus.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/MaterialBatchRepository.java:134-197` — 4 query methods used
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/MaterialConsumptionRepository.java:40-44` — `findByTimeRange`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/MaterialBatchAdjustmentRepository.java:33` — `findByMaterialBatchIdAnd...OrderByAdjustmentTimeDesc`

**Python sister modules** (import targets):
- `backend/python/smartbi_compat/api/analysis_finance.py` — Tier 1 baseline (`_strip_volatile`, `VOLATILE_KEYS`, `_decimal_to_number`, `_to_decimal`, `_utc_now_iso`, `_fetch_all`, `wrap_response`)
- `backend/python/smartbi_compat/auth.py` — `verify_factory_access`, `AuthContext`

**Audit history**: see frontmatter top.
