# AI助手答复质量与内容匹配度深度分析

**日期**: 2026-02-16
**前提**: 意图路由 accuracy 已达 120/120 (100%)
**研究方法**: 3 Researcher (haiku) + 1 Analyst (sonnet) + 1 Critic (sonnet) + 1 Integrator (haiku)

---

## Executive Summary

当前AI助手答复质量呈现**两极分化**：食品知识咨询达到4.48/5.0的专业水准，但工厂数据查询仅3.9/5.0（42%执行失败）。质量瓶颈**不在分类层**（已100%准确），而在**执行层、数据完整性、边界处理**三个维度。Critic深度挑战了分析师对架构的理解，暴露了关键集成问题：ResultFormatterServiceImpl存在但未使用、FOOD_KNOWLEDGE_QUERY部署风险、以及42%失败误诊。

---

## Consensus & Disagreements

| 主题 | 研究员发现 | 分析师结论 | 评论家挑战 | 最终裁决 |
|------|----------|---------|---------|---------|
| **食品知识质量** | 4.48/5.0，11/12成功 | 可交付 | DB无记录部署风险 | **Medium置信度** — 功能优秀但部署有Critical风险 |
| **42%工厂查询失败** | 7/12(58.3%)有效 | QUERY handler缺失 | **完全错误** — Handler基于intentCategory非"QUERY" | **Low置信度** — 需日志验证真正根因 |
| **message仅"执行成功"** | 内容不够丰富 | 需每个handler写buildXxxMessage() | **严重夸大** — ResultFormatterServiceImpl(1189行)已存在 | **Low置信度** — 一行代码集成 |
| **读写混淆** | "查看入库记录"→CREATE | 需修复映射 | **与代码矛盾** — "记录"匹配STATUS_WORDS | **Very Low置信度** — bug可能不存在 |
| **数值查询失败** | 0/2完全失败 | Layer 0规则缺失 | 一致认可 | **High置信度** — 修复<30分钟 |
| **P0工作量** | N/A | 2-3天 | <2小时 | **Very Low on分析师估计** — 被夸大6-8倍 |

---

## Detailed Quality Scores

### 食品知识域 (FOOD_KNOWLEDGE) — 4.48/5.0

| 查询类型 | 评分 | 回答特点 |
|---------|------|---------|
| 法规标准(GB) | 5.0/5.0 | GB 2760添加剂、GB 14881卫生规范引用准确 |
| 温度/工艺参数 | 4.8/5.0 | 具体数值(72-78°C)，不模糊 |
| HACCP流程 | 4.5/5.0 | 结构化分点，步骤清晰 |
| 发酵/消费者指南 | 2.0/5.0 | RAG低置信度→硬编码模板"示例数据" |

**优点**: 平均1575字符，包含温度参数+法规引用+工艺步骤，格式统一
**弱点**: RAG覆盖不足时fallback质量差，20篇种子文档有盲区
**部署风险**: FOOD_KNOWLEDGE_QUERY在migration SQL无记录，新环境可能完全失效

### 工厂数据域 (FACTORY_DATA) — 3.9/5.0

| 查询类型 | 评分 | 成功率 |
|---------|------|--------|
| 设备状态 | 4.8/5.0 | 100% — 完整设备列表+运行状态 |
| 库存查询 | 4.8/5.0 | 100% — 物料名称+数量+预警值 |
| 质检统计 | 4.8/5.0 | 100% — 合格率+检测项目 |
| 数值统计 | 0/5.0 | 0% — "几批""多少"完全失败 |
| DATA_OP | 1.5/5.0 | ~30% — DashScope依赖超时 |

**优点**: 已有handler(设备/库存/质检)表现优秀
**弱点**: 42%执行失败，数值查询0%成功，响应延迟2-18秒
**Critic发现**: ResultFormatterServiceImpl已有1189行完整格式化实现，仅未集成到主管线

### 边界/混合场景 — 3.2/5.0

| 类型 | 评分 |
|------|------|
| 食品知识边界 | 4.1/5.0 — 语义理解能力强 |
| 工厂数据边界 | 2.4/5.0 — 执行层问题严重 |
| 语义区分 | 5.0/5.0 — "应该多少度"vs"是多少"正确 |
| 长句(>30字) | 3.0/5.0 — 部分细节丢失 |
| 超短(2-3字) | 3.5/5.0 — 食品好，工厂差 |

---

## Actionable Recommendations

### Immediate (P0 — ~1.5小时)

1. **验证42%失败真正根因（30分钟）**
   - 查看日志区分：DB缺配置 vs DashScope超时 vs Tool初始化失败
   - `tail -f logs/cretas-backend-error.log | grep -E "ai_intent_configs|handler|DashScope"`

2. **集成ResultFormatter到主管线（15分钟）**
   - AIIntentServiceImpl添加一行：`resultFormatter.formatAndSet(result, context)`
   - 预期效果："执行成功" → "今日共生产牛肉12批，合格率95%"

3. **添加数值查询规则（20分钟）**
   - TwoStageIntentClassifier Layer 0：匹配"几批/多少/用了"模式
   - 预期效果："牛肉加工了几批" 成功路由

4. **确认FOOD_KNOWLEDGE_QUERY DB记录（5分钟）**
   - `SELECT * FROM ai_intent_configs WHERE intent_code = 'FOOD_KNOWLEDGE_QUERY'`
   - 若无→立即INSERT

### Short-term (P1 — 本周)

5. **修复RAG低置信度fallback（2-3天）**
   - 低置信度时改为LLM生成通用答复，不返回硬编码模板

6. **DashScope超时监控（1天）**
   - 添加超时告警，量化P50/P95/P99延迟

### Conditional (P2 — 视验证结果)

7. **若DashScope频繁超时** → 添加本地embedding fallback (1-2周)
8. **若Tool架构初始化问题** → 检查Tool vs Handler优先级 (1天)

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| FOOD_KNOWLEDGE_QUERY DB未注册 | Medium | Critical | 部署前强制检查 |
| DashScope全面超时 | Medium | High | 本地fallback+监控 |
| 修复引入分类回归 | Low | High | 120条回归测试 |
| ResultFormatter格式化不匹配handler key | High | Medium | 单元测试覆盖 |

---

## Open Questions

1. 42%失败的真正根因是什么？（DB/DashScope/Tool？）
2. "查看入库记录"→CREATE 是否真实存在？（Critic认为代码不支持此结论）
3. FOOD_KNOWLEDGE_QUERY在生产DB是否已注册？
4. DashScope embedding/reranker的失败率具体是多少？

---

## Process Note

- Mode: Full
- Researchers deployed: 3
- Total queries tested: 40 (live API)
- Key disagreements: 4 resolved (Critic纠正分析师4个架构误判), 2 unresolved (需日志验证)
- Phases completed: Research → Analysis → Critique → Integration
- Work estimate revision: 分析师6-10天 → Critic修正<2小时 (6-8倍夸大)
