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
| `aging` | `getAgingMetrics` + `getInventoryAgingChart` + `getLongAgingBatchesRanking(minDays=60)` | `[startDate, endDate, agingMetrics, agingChart, longAgingBatches]` |
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
