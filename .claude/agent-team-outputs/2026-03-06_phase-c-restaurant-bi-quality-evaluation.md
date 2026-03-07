# Phase C 餐饮 BI 新增维度质量评估报告

**日期**: 2026-03-06
**模式**: Full (4 Researcher + Analyst + Critic + Integrator)
**研究员**: 代码算法验证 / 生产API数据验证 / 行业基准对比 / 浏览器可视化验证

---

## 执行摘要

Phase C 新增维度（价格带分析、HHI品类集中度、门店效率矩阵）工程实现质量优秀，算法正确、边界保护充分、前后端类型完全对齐。但存在**系统性语义错配问题**：`unit_price`（单品均价中位数）在3处被当作"客单价"与行业基准（人均消费）比较，导致分析结论可能误导用户。行业基准数据有4项与最新行业报告存在显著偏差。**总评：B**，工程层 A-，语义/基准层 C+。

---

## 质量矩阵：3个维度 x 6个质量轴

| 质量轴 | 价格带分析 | 品类集中度 HHI | 门店效率矩阵 | 综合 |
|--------|-----------|---------------|-------------|------|
| 算法正确性 | ★★★★☆ | ★★★★★ | ★★★★★ | A |
| 边界保护 | ★★★★☆ | ★★★★★ | ★★★★★ | A |
| 前后端一致性 | ★★★★★ | ★★★★★ | ★★★★★ | A+ |
| 生产数据验证 | ★★☆☆☆ | ★★★★★ | ★★★★☆ | B |
| 行业基准 | ★★☆☆☆ | N/A | N/A | C+ |
| 可视化渲染 | ★★★★★ | ★★★★★ | ★★★★☆ | A- |

---

## 共识与分歧

| 维度 | 共识 | 分歧 | 最终判定 |
|------|------|------|----------|
| HHI 算法 | 全员确认正确(DOJ/FTC标准) | 无 | 确认正确 |
| 价格带分档 | 5档无间隙，逻辑完备 | 无 | 确认正确 |
| 门店4象限 | 逻辑正确，分布合理 | 无 | 确认正确 |
| 边界保护 | 充分(零销量/空数据/小样本) | 无 | 确认充分 |
| 前后端一致性 | TypeScript完全对齐 | 无 | A+ |
| avgUnitPrice维度错配 | 全员确认存在 | Analyst定P0, Critic降P1 | **P1** |
| unit_profit命名 | Critic发现，影响范围广 | 严重性评估不同 | **P2** |
| 行业基准偏差 | R-C评★2 | Critic认为口径差异可解释部分 | C+，需更新 |

---

## 发现的问题（按优先级排序）

### P1 — 统一修复3处维度混淆（本迭代，1-2天）

`unit_price`（单品均价中位数）在3处被当作"客单价"与 `average_ticket` 基准比较：

| 位置 | 文件:行号 | 影响 |
|------|----------|------|
| `_price_band_analysis` | `restaurant_analyzer.py:586-601` | `pricePositioning="偏低"` 误导 |
| `_operations_metrics` | `restaurant_analyzer.py:427-428` | `priceVsBenchmark.actual` 错误 |
| `_platform_readiness` | `restaurant_analyzer.py:445-446,512` | 平台准入价格检查误判 |

**东门口实际数据**: avgUnitPrice=¥19.2(品均中位数) vs benchmarkMedian=¥110(客单价基准)

**修复方案**: 将 `avgUnitPrice` 重命名为 `medianItemPrice`，对标基准改用同维度数据或明确标注维度差异。`unit_profit` 重命名为 `unit_revenue`（无成本数据不应称利润）。

### P2 — 行业基准数据更新（下一迭代，1周内）

| 指标 | 当前值 | 建议更新 | 来源 |
|------|--------|---------|------|
| 食材成本率 | 28-38%, median 33% | 35-45%, median 40% | 中国饭店协会2025年报 |
| 火锅客单价 | 80-150, median 110 | 50-120, median 75 | 美团2024火锅品类报告 |
| 净利率 | 3-12%, median 7% | 1-10%, median 4% | 2024餐饮产业白皮书 |
| 万店品牌数 | 10 | 8 | 36氪/美团数据 |

### P3 — 负价格过滤（随手修）

`_price_band_analysis` 入口添加: `item_df = item_df[item_df["unit_price"] > 0]`

### P3 — 散点图窄屏图例重叠

门店效率散点图在窄列布局下图例与X轴标签重叠。增大 `grid.bottom` 或将 legend 移至 top。

### P3 — 变量命名规范化

`avg_unit` 实为 `median()` 计算，建议改为 `median_unit_price`。

---

## 置信度评级

| 评估项 | 置信度 | 依据 |
|--------|--------|------|
| 算法正确性 | 95% | 代码审查 + 实际数据验证双重确认 |
| 边界保护完备性 | 90% | 代码覆盖充分，负价格为唯一缺口 |
| 前后端一致性 | 98% | 字段级逐一比对 |
| 维度错配问题 | 99% | 代码明确确认 |
| 行业基准偏差幅度 | 70% | 口径差异可解释部分偏差 |
| 可视化质量 | 90% | 浏览器实测通过 |

---

## 开放问题

1. **客单价数据源缺失**: 当前仅有SKU级数据，无订单级数据，无法计算真正客单价。是否需要在导入阶段要求订单维度？
2. **行业基准地域适配**: 当前为全国均值，一线/三四线差异40-60%。是否引入城市层级参数？
3. **基准更新机制**: 当前硬编码在 `benchmark.py`，是否迁移到数据库支持定期更新？
4. **unit_profit 长期定义**: 未来引入成本数据后是否保留利润维度命名空间？

---

## 评分总结

| 维度 | 评分 |
|------|------|
| 算法正确性 | A |
| 工程质量 | A |
| 可视化 | A- |
| 语义正确性 | C+ |
| 行业基准准确度 | C+ |
| **综合总评** | **B** |

---

## Process Note

- Mode: Full
- Researchers deployed: 4
- Browser explorer: ON (2 pages visited — overview + dianping-gap)
- Total sources found: 28+
- Key disagreements: 1 resolved (P0→P1 降级)
- Phases completed: Research (parallel) + Browser → Analysis → Critique → Integration → Heal
- Fact-check: integrated into Researcher C (12 industry sources verified)
- Healer: All checks passed
- Competitor profiles: N/A

### Healer Notes: All checks passed
- Structural completeness: All sections present (Executive Summary, Matrix, Consensus, Recommendations, Open Questions)
- Cross-reference integrity: All researcher findings correctly cited
- Confidence consistency: Integrator aligned with Critic's revised levels
- Actionable recommendations: Each has concrete file:line references
- Browser evidence integration: Browser findings integrated into visualization assessment
