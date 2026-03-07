# SmartBI 全量测试数据质量审计报告

**日期**: 2026-03-04
**模式**: Full (3 Researchers → Analyst → Critic → Integrator)
**评估范围**: 36个测试Excel文件 (food×4, mfg×4, retail×4, restaurant×12, edge×6, stress×4)

---

## Executive Summary

SmartBI 在标准中文数据 + LLM 在线场景下表现良好（火锅 17 sheets 全部成功，每 sheet 7 图表 + AI 洞察），但存在 **2 个已确认 P0 缺陷**（雷达图仅首行、dead code 未接入 prompt）和 **3 个 P1 问题**（action_items 丢弃、场景检测英文关键词、面积图条件堆叠）。E2E 覆盖严重不足（仅 1 个完整行业文件验证），压力测试空白。建议 3-5 人天完成 P0/P1 修复。

---

## 最终评分

| 维度 | 评分 | 置信度 | 关键发现 |
|------|------|--------|----------|
| A. 生成速度 | **6/10** | ★★★☆☆ | 缓存命中 TTFT 0.4s，未命中 15-20s，重试上限 137s (200s 前端超时内) |
| B. 图表质量 | **6/10** | ★★★★☆ | 雷达图仅首行(P0-D确认)，面积图条件堆叠(P1-H)，混合类型0图表 |
| C. AI分析质量 | **7/10** | ★★★★☆ | 三层 tier 自适应 prompt，知识库注入，但 dead code 导致写作规则未生效 |
| D. 文字质量 | **7/10** | ★★★★☆ | action_items/title/dimension/confidence 被丢弃，写作铁律未注入 prompt |
| E. 边界用例 | **3/10** | ★★☆☆☆ | 混合类型不崩溃但0图表，其余边界未测 |
| F. 压力测试 | **?/10** | ★☆☆☆☆ | 完全未执行 |
| G. 跨行业一致性 | **5/10** | ★★☆☆☆ | scenario_detector 英文关键词仅影响 LLM 离线路径，insight_generator 有独立中文检测 |

**综合评分: 68/100** (排除 F 压力测试)

---

## 关键共识与分歧

| 主题 | Researcher | Analyst | Critic | 最终裁决 |
|------|-----------|---------|--------|---------|
| P0-C 折线图 KeyError | 标记 P0 | 列入高风险 | **否决** — 三级防御链 | **降为 P2** — `build()` 有 `_validate_and_resolve_field()` + None fallback + try/except |
| P0-A/B 场景检测英文关键词 | "完全失效" | 高风险 | **部分否决** — 仅 LLM 离线路径 | **降为 P1** — insight_generator 有独立中文检测 (L436-446) |
| P0-D 雷达图仅首行 | P0 | P0 | **确认** | **确认 P0** — `iloc[0]` 直接可见，三方一致 |
| P0-E dead code | P0 | P0 | **确认** | **确认 P0** — output_schema/rules 构建但未返回 |
| P1-O 字段丢弃 | P1 | P1 | **确认+扩展** | **确认 P1** — 额外发现 title/dimension/confidence 也被丢弃 |
| 三套场景检测系统 | 架构缺陷 | 建议合并 | 可能合理分工 | **标记技术债** — 各有不同职责，非紧急合并 |
| 修复时间估算 | — | 2-3 人天 | 过于乐观 | **调整为 3-5 人天** — 雷达图需设计聚合策略 |

---

## 已确认缺陷清单

### P0 级 (影响数据完整性/分析质量)

**P0-D: 雷达图仅展示首行数据**
- 文件: `chart_builder.py` L826-827 (`safe_first()` 使用 `iloc[0]`)
- 影响: 多行数据集的雷达图仅展示第一行，其余数据被静默丢弃
- 修复方向: 需设计多行聚合策略 (均值/中位数/Top-N多系列)
- 预估工时: 2-4h

**P0-E: _build_tiered_prompt() 中 output_schema/rules 是 dead code**
- 文件: `insight_generator.py` L875-959
- 影响: L959 仅返回 `data_block`，约 90 行精心编写的 prompt 模板（写作铁律、输出格式规范）完全未发送给 LLM
- 修复方向: 将 output_schema/rules 接入返回值，拼入 prompt
- 预估工时: 1-2h

### P1 级 (影响功能完整性)

**P1-O: action_items/title/dimension/confidence 字段被丢弃**
- 文件: `insight_generator.py` L1764-1772
- 影响: LLM 生成的可执行建议和维度分类在解析时被忽略
- 修复: 在清洗逻辑中保留这些字段
- 预估工时: 30min

**P1-A/B: scenario_detector cn_keywords 全英文**
- 文件: `scenario_detector.py` L554-628
- 影响: LLM 离线时规则降级路径无法匹配中文数据
- 修复: 添加中文关键词 (参照 insight_generator L436-446)
- 预估工时: 2-3h

**P1-H: 面积图多系列条件堆叠**
- 文件: `chart_builder.py` L532
- 影响: 多系列面积图自动堆叠，可能导致视觉误导
- 修复: 添加堆叠标记或允许用户选择堆叠/独立模式
- 预估工时: 30min

### P2 级 (低优先级)

**P2-C: 折线图 KeyError (原 P0-C)**
- 文件: `chart_builder.py` L425
- 实际状态: `_validate_and_resolve_field()` 三级模糊匹配 + None fallback + try/except 完整防御链，正常流程不可触发
- 建议: 保持现状或添加日志监控

---

## 数据盲区

| 盲区 | 影响 | 优先级 |
|------|------|--------|
| 压力测试完全空白 (5万行文件未测) | 无法评估大数据量下的内存/超时/OOM 风险 | 高 |
| 跨行业 E2E 覆盖极低 (仅火锅 1 个文件) | food/mfg/retail 行业一致性未验证 | 高 |
| LLM 离线降级实际未测 | P1-A/B 的真实影响无法确认 | 中 |
| 并发测试缺失 | 多用户同时上传场景未知 | 中 |
| 前端渲染验证缺失 | 图表在 Vue 前端的实际展示效果未确认 | 低 |

---

## 修复优先级路线图

### 立即执行 (Day 1-2)
1. **P0-D 雷达图首行** → `chart_builder.py` — 需先确定聚合策略
2. **P0-E dead code 接入** → `insight_generator.py` — 将写作规则注入 prompt
3. **P1-O 恢复丢弃字段** → `insight_generator.py` — 简单字段添加

### 本周内 (Day 3-5)
4. **P1-A/B 中文关键词** → `scenario_detector.py` — 参照 insight_generator 模式
5. **P1-H 面积图标记** → `chart_builder.py` — 添加堆叠提示
6. **补充 E2E 行业覆盖** → 重新上传 6 个行业测试文件

### 条件执行
7. 三套场景检测系统合并 → 仅在跨行业 E2E 暴露不一致问题后考虑
8. 压力测试 → 系统面向多用户场景前执行
9. LLM 重试超时优化 → 用户反馈等待过长时处理

---

## Open Questions

1. 雷达图多行聚合策略：平均值 vs 中位数 vs 用户自选？
2. dead code 接入后 prompt token 预算影响？
3. 前端 AIInsightPanel.vue 是否已有 action_items 渲染逻辑？
4. 混合类型 sheet 0 图表的根因：类型推断 vs 字段匹配 vs 规划器跳过？
5. LLM 生产环境可用率数据？（决定 P1-A/B 是否可进一步降级）

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (代码架构审计 + 浏览器 E2E 行业 + 浏览器 E2E 边界/压力)
- Browser explorer: ON (2 agents, 均因连接中断部分失败)
- Total sources: 5 核心 Python 文件 + 1 完整 E2E 结果 + 89 个已有测试脚本
- Key disagreements: 3 resolved (P0-C 降级, P0-A/B 缩窄, 三系统评价), 1 unresolved (修复时间)
- Phases: Research → Analysis → Critique → Integration → Self-Healing
- Healer: All checks passed ✅
