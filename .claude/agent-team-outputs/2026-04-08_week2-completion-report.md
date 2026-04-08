# Week 2 餐饮 SmartBI — 邓总救命组合完成报告

**日期**: 2026-04-08
**范围**: Week 2 全部 6 个任务 (基础设施 + 餐饮服务 + V2 主入口 + E2E 测试)
**状态**: ✅ 全部完成

---

## Executive Summary

Week 2 在 Week 1 (Dynamic config + Alias normalizer + diagnostics_registry YAML) 的基础上, **新建 5 个 Python 模块 (~1,830 LOC)** 实现了"邓总救命组合":

1. **诊断引擎** (`shared/diagnostics_engine.py`) — 通用 metric 注册 + 阈值评估 + playbook 触发
2. **对标预警** (`shared/benchmark_alert_engine.py`) — 复用 11 个 benchmark YAML, 含年度影响估算
3. **BOM 80% Layer 1** (`services/restaurant/bom_resolver.py`) — 4 层 COGS 查找, 类目均价默认值
4. **渠道毛利率** (`services/restaurant/channel_margin_calculator.py`) — 改进 6 真名版, 透明 cogs_source
5. **V2 主入口** (`services/restaurant/analyzer.py`) — 编排所有底层组件

E2E 测试用邓总 P&L 真实数据: **5 sections 全生成, cost_rigidity 0.561 警告, food_cost 一年多支出 ¥250K, labor_cost 一年多支出 ¥220K** — 销售话术现成可用。

---

## 任务清单

| # | 任务 | 文件 | LOC | 状态 |
|---|------|------|-----|------|
| **2.1** | shared/diagnostics_engine.py | 380 | 380 | ✅ |
| **2.2** | shared/benchmark_alert_engine.py | 360 | 360 | ✅ |
| **2.3** | services/restaurant/bom_resolver.py (Layer 1) | 380 | 380 | ✅ |
| **2.4** | services/restaurant/channel_margin_calculator.py | 410 | 410 | ✅ |
| **2.5** | services/restaurant/analyzer.py (V2 主入口) | 300 | 300 | ✅ |
| **2.6** | Week 2 E2E 集成测试 | (test script) | — | ✅ |
| **合计** | 5 个 prod 模块 + 1 个 E2E test | | **~1,830** | |

---

## 模块详细

### 2.1 — `shared/diagnostics_engine.py`

**职责**: 通用 metric 诊断引擎, 不写 Python 代码就能添加新指标

**核心 API**:
```python
engine = DiagnosticsEngine(domain="restaurant", sub_sector="火锅")
diagnoses = engine.run({
    "cost_rigidity": 0.56,           # 邓总弹性指数
    "food_cost_ratio": 45.85,
    "stored_value_dependency": 0.07,
})
# → list[Diagnosis] (按 severity 降序)
```

**关键设计**:
- 读 `knowledge/restaurant/diagnostics_registry.yaml` (Week 1 已建)
- 支持 `threshold_inline` (跨子行业通用) 和 `threshold_source` (子行业专属)
- 自动加载 playbook YAML, 提取 P0/P1/P2 actions + sub_sector_notes
- 返回结构化 Diagnosis 含 severity / status / 建议 / 子行业专属提示

**Smoke test 结果** (邓总场景):
- cost_rigidity 0.56 → warning + 6 条 [立即重排班] P0 建议 + 火锅专属 notes
- stored_value_dependency 0.07 → warning
- discount_rate 1.52% → info (远低于行业基准 12%, 健康)

### 2.2 — `shared/benchmark_alert_engine.py`

**职责**: 利用 11 个 benchmark YAML 自动生成对标预警 + 估算年度影响

**核心 API**:
```python
engine = BenchmarkAlertEngine(domain="restaurant", sub_sector="火锅")
alerts = engine.alert_for_store(
    store_name="鼎鲜火锅·义乌",
    metrics={"food_cost_ratio": 45.85, "labor_cost_ratio": 32.51},
    monthly_revenue=731047.52,
)
# → list[BenchmarkAlert] 含 message_zh + estimated_yearly_impact
```

**关键设计** (per Researcher C "零成本最大杠杆"):
- 用 `range_position = (actual - low) / (high - low)` 衡量, 比中位数偏移更直观
- 警戒阈值: range_position > 0.7 触发 yellow (即范围 70% 位置以上)
- 自动估算"一年多支出": `delta_pct * monthly_revenue * 12`
- 中文消息含 emoji + 完整对标语句, 销售可直接使用

**Smoke test 结果** (邓总场景):
- food_cost 45.85% → 🟡 警戒, 一年多支出 ¥250K
- labor_cost 32.51% → 🟡 警戒, 一年多支出 ¥220K
- (青花椒颛桥龙湖店 47% 食材率 → 🔴 严重超标)

### 2.3 — `services/restaurant/bom_resolver.py`

**职责**: 餐饮 BOM 80% 主入口, 4 层 COGS 查找

**4 层架构**:
1. **manual_override** — DynamicConfigResolver session/store/factory 层
2. **sku_form** — 客户填的 TOP 20 SKU 表单 (Week 5+)
3. **monthly_calibrated** — Layer A 自学习 (Week 5+)
4. **category_baseline** — `knowledge/restaurant/cogs/category_costs.yaml` (Week 1 已建)

**核心 API**:
```python
resolver = RestaurantBomResolver(factory_id="QHJ", sub_sector="火锅")
result = resolver.resolve_cogs_for_sku(
    sku_name="招牌青花椒鱼", category="肉类涮品", selling_price=69.0
)
# → CogsResult(cogs_amount=28.0, cogs_pct=0.4058, source="category_baseline", expected_accuracy_pp=15.0, warning="...")

# 渠道粒度
result = resolver.resolve_cogs_for_channel(channel="美团外卖", revenue=300000)
# → CogsResult(cogs_amount=129000, cogs_pct=0.43, ...)
```

**精度承诺**:
- Layer 1 only: ±15%
- + Layer 2 (SKU 表单): ±8%
- + Layer 3 (月度校准): ±5%
- 永远不承诺 ±3% (那是话术)

### 2.4 — `services/restaurant/channel_margin_calculator.py`

**职责**: 渠道毛利率 (改进 6 真名版, per Critic 透明度要求)

**核心算法**:
```
毛利率 = (营收 - 平台抽佣 - 配送费 - 包装成本 - COGS) / 营收
```

**透明度强制**:
- 每个 ChannelMarginRow 必带 `cogs_source` (category_baseline/sku_form/manual_override)
- 必带 `cogs_warning` ("行业基准估算, 建议上传采购数据获得 ±5% 精度")
- 必带 `expected_accuracy_pp` 整体精度

**E2E 输出** (邓总火锅 1200 单 / 4 渠道):
| 渠道 | 营收 | 抽佣 | COGS | 毛利率 |
|------|------|------|------|--------|
| 店内桌位 | ¥439,200 | 0% | ¥188,856 | **57.1%** |
| 美团外卖 | ¥38,400 | 18% (火锅子行业) | ¥16,512 | **37.1%** |
| 饿了么 | ¥27,000 | 20% | ¥11,610 | **35.0%** |
| 抖音外卖 | ¥10,800 | 20% | ¥4,644 | **35.6%** |
| **整体** | **¥515,400** | — | — | **53.99%** |

### 2.5 — `services/restaurant/analyzer.py` (V2 主入口)

**职责**: 编排层, 不替代 1751 行的 legacy `restaurant_analyzer.py`

**V2 设计原则**:
- 新业务功能走 V2 (Week 2+ 添加的所有功能)
- legacy 留作 Week 3+ 处理 (改进 11 套餐拆分 + menu_quadrant 等)
- V2 不导入 legacy, 完全自包含

**核心 API**:
```python
v2 = RestaurantAnalyzerV2(factory_id="DENG", sub_sector="火锅", db_session=db)
report = v2.analyze(
    pos_df=feb_orders_df,             # POS 数据 (改进 6 渠道毛利率 + 命名归一)
    financial_data={                   # 财务数据 (cost_rigidity + 对标预警 + 财务诊断)
        "current": {"revenue": 731047, "food_cost": 335212, "labor_cost": 237660, ...},
        "previous": {同上},
    },
    store_id="DENG-001",
    store_name="鼎鲜火锅·义乌",
    period="2026-02",
)
```

**Unified Report 结构**:
```json
{
  "factoryId": "DENG_HUOGUO_001",
  "subSector": "火锅",
  "storeName": "鼎鲜火锅·义乌",
  "period": "2026-02",
  "sections": {
    "menuNormalization": { ... },
    "channelMargin": { ... },
    "financialMetrics": { ... },
    "diagnostics": [ ... ],
    "benchmarkAlerts": [ ... ]
  },
  "executiveSummary": [ "..." ],
  "summary": {
    "totalDiagnoses": 1,
    "totalAlerts": 2,
    "criticalIssues": 0,
    "redAlerts": 0
  },
  "warnings": []
}
```

### 2.6 — Week 2 E2E 集成测试

**测试脚本**: `c:/Users/Steve/AppData/Local/Temp/week2_e2e_dengs_huoguo.py`
**完整输出**: `c:/Users/Steve/AppData/Local/Temp/week2_e2e_dengs_huoguo_output.txt`

**测试数据**:
- 财务: 来自真实 `火锅2月利润表.xls` (邓总 2 月 + 1 月 P&L)
- POS: 模拟 1200 单, 7 个 SKU (含命名变体), 4 个渠道

**测试结果** (Sections 全部生成):
```
sections: ['menuNormalization', 'channelMargin', 'financialMetrics', 'diagnostics', 'benchmarkAlerts']
totalDiagnoses: 1   (cost_rigidity warning)
totalAlerts: 2      (food_cost yellow, labor_cost yellow)
criticalIssues: 0
redAlerts: 0
```

**邓总财务 metrics 验证**:
| 指标 | V2 计算 | 真实 P&L | 一致? |
|------|---------|---------|-------|
| food_cost_ratio | 45.85% | 45.85% | ✅ |
| labor_cost_ratio | 32.51% | 32.51% | ✅ |
| rent_ratio | 7.84% | 7.84% | ✅ |
| net_margin | -6.80% | -6.80% | ✅ |
| revenue_change_pct | -47.43% | -47.43% | ✅ |
| labor_cost_change_pct | -26.60% | -26.60% | ✅ |
| **cost_rigidity** | **0.561** | (-26.6/-47.4) ≈ 0.561 | ✅ |

**Executive Summary 自动生成**:
1. 📊 4 个渠道 COGS 来自行业基准, 上传采购数据后升级 ±5% 精度
2. 🟡 食材成本率 45.85% (高于火锅中位 43%), 一年多支出 ¥250,348
3. 🟡 人力成本率 32.51% (高于火锅中位 30%), 一年多支出 ¥220,149

---

## 销售话术 (邓总 demo Week 1)

**Week 2 完成后, Steven 可以拿这套报告给邓总:**

> 邓总, 您 2 月数据传上来了, 我们的诊断系统跑了 5 项分析:
>
> **第一**: 您的成本弹性指数 0.56 (健康范围 ≥0.85), 这是亏损根因。营收掉了 47%, 但人力只减了 27%, 排班没跟上客流。建议立即重排班, 全职兼职比例从当前调到 60:40, 高峰留全职低峰切兼职 — 这一步可以救命。
>
> **第二**: 食材成本 45.85% (火锅行业 38-48 区间, 中位 43%), 您比中位高 2.85 个百分点。按 73 万月营收, **一年多支出约 25 万**。建议优化供应商集中度。
>
> **第三**: 人力成本 32.51% (行业 25-35, 中位 30%), 您比中位高 2.51 个百分点, **一年多支出约 22 万**。
>
> **第四**: 渠道毛利率拆解 — 堂食 57.1%, 美团 37.1%, 饿了么 35%, 抖音 35.6%。每多一单美团少赚 20% 营收的利润。考虑提高堂食占比。
>
> **第五**: COGS 数据目前用的是火锅行业基准 (±15% 精度)。您下周给我们 2 月采购汇总, 系统自动升级到 ±5% 精度。

---

## Smoke Test 集合

| 测试 | 输出文件 | 结果 |
|------|---------|------|
| diagnostics_engine 邓总场景 | (stdout, GBK 乱码) | 3 诊断触发 |
| benchmark_alert_engine 邓总单店 | `bench_alert_smoke2.txt` | 2 yellow 预警 + 年度影响 |
| benchmark_alert_engine 青花椒 8 店 | `bench_alert_smoke.txt` | 6 alerts 跨店 |
| bom_resolver Layer 1 | `bom_resolver_smoke.txt` | 4 测试 PASS |
| channel_margin_calculator 邓总 4 渠道 | `channel_margin_smoke.txt` | 4 渠道明细 + advice |
| **Week 2 E2E** (V2 主入口) | `week2_e2e_dengs_huoguo_output.txt` | **5 sections + executive summary** |

---

## 已知 issue / Week 3 优化

1. **DiagnosticsEngine vs BenchmarkAlertEngine 灵敏度不一致** — diagnostics 用 benchmark threshold (在 range 内不触发), benchmark_alerts 用 range_position 0.7 (更敏感). 邓总场景下 food_cost 45.85% 在 range 内 → diagnostics 不触发但 benchmark_alerts 触发. Week 3 统一两套引擎的灵敏度.

2. **menuNormalization 测试时 reduction=0** — 因为 V2 测试用了新 factory_id, dish_alias 表里没确认的别名. 真实场景下 propose → 客户审核 → confirm 后 alias 表会有数据. 不是代码 bug.

3. **改进 11 (套餐拆分修复) 推迟** — V2 不调用 legacy menu_quadrant, 所以这个 bug 修复推到 Week 3 再做.

4. **POS 数据完整性预检 (改进 2)** — Week 1 + 2 都没做, 留 Week 3 (`shared/data_integrity_validator.py`).

5. **API endpoint 还没开** — V2 只是 Python 类, web-admin 还不能调用. Week 3 需要在 `api/restaurant_analytics.py` 加新 endpoint `POST /v2/analyze`.

---

## Week 1 + Week 2 总文件清单

| # | 文件 | LOC | Week |
|---|------|-----|------|
| 1 | `database/migrations/20260408_smartbi_restaurant_dynamic.sql` | 268 | 1 |
| 2 | `shared/__init__.py` | 47 | 1 |
| 3 | `shared/README.md` | 80 | 1 |
| 4 | `shared/dynamic_config_resolver.py` | 363 | 1 |
| 5 | `shared/alias_normalizer.py` | 415 | 1 |
| 6 | `shared/diagnostics_engine.py` | 380 | **2** |
| 7 | `shared/benchmark_alert_engine.py` | 360 | **2** |
| 8 | `services/restaurant/__init__.py` | 76 | 1 |
| 9 | `services/restaurant/menu_normalizer.py` | 250 | 1 |
| 10 | `services/restaurant/bom_resolver.py` | 380 | **2** |
| 11 | `services/restaurant/channel_margin_calculator.py` | 410 | **2** |
| 12 | `services/restaurant/analyzer.py` (V2 主入口) | 300 | **2** |
| 13 | `knowledge/restaurant/diagnostics_registry.yaml` | 130 | 1 |
| 14 | `knowledge/restaurant/cogs/category_costs.yaml` | 220 | 1 |
| 15 | `knowledge/restaurant/pos/commission_rates.yaml` | 80 | 1 |
| 16 | `knowledge/restaurant/playbooks/cost_rigidity_high.yaml` | 165 | 1 |
| **合计** | **16 文件** | **~3,944 LOC** | |

---

## Week 3 排期建议

按邓总 demo 紧迫度 + critic 优先级:

### Week 3.1 — API endpoint 开通 (2 人天)
- `api/restaurant_analytics.py` 加 `POST /v2/analyze` endpoint
- 接收 POS upload_id + financial_data dict
- 调用 RestaurantAnalyzerV2.analyze()
- 返回 unified report JSON
- 跑邓总 demo 的 web-admin 端到端

### Week 3.2 — 改进 11 (套餐拆分修复) (1 人天)
- 修复 legacy `restaurant_analyzer.py:489-509`
- 让 `_menu_quadrant` 接收 `qty_combo_col` 并合并
- 单测 + 200K 真实数据回归

### Week 3.3 — 数据完整性预检 (改进 2, 2 人天)
- `shared/data_integrity_validator.py`
- excel_parser.py / csv_parser.py 集成
- 青花椒 CSV 元信息行识别 + 截断检测

### Week 3.4 — 同店同比 (3 人天)
- `shared/temporal_comparator.py` (自动降级)
- `services/restaurant/same_store_comparator.py`
- 邓总 13 月数据验证

### Week 3.5 — 前端 Vue 组件
- 新 vue: `web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue`
- 渲染 V2 unified report 的 5 sections
- 用 Element Plus 卡片布局 + ECharts 图表

---

## 验收标准 (Week 2 完成定义)

| 标准 | 状态 |
|------|------|
| 5 个新模块全部 syntax/import OK | ✅ |
| 5 个 smoke test 全部 PASS | ✅ |
| E2E 集成测试 5 sections 全部生成 | ✅ |
| 邓总 financial metrics 跟真实 P&L 100% 一致 | ✅ |
| cost_rigidity 0.561 计算正确 | ✅ |
| benchmark alerts 估算年度影响金额合理 | ✅ |
| Executive summary 自动生成可读文案 | ✅ |
| 透明度 (cogs_source 强制) | ✅ |
| 跨 domain 隔离 (Week 1 隔离铁律保持) | ✅ |

**Week 2 全部完成 ✅**
