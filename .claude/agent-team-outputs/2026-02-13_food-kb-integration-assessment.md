# 食品知识库（Food KB）集成完整性与冲突风险评估

**日期**: 2026-02-13
**模式**: Full (5 agents)
**研究员**: 3 (意图路由 / Handler完整性 / 前端集成)

---

## Executive Summary

- **推荐**: 食品知识库集成**可投产但需优先修复**——核心功能E2E验证完成，但存在路由歧义、反馈数据不完整、Python客户端缺retry三个显著缺口
- **置信度**: 中等偏高(72%) — 三个研究员观点一致，但批评员指出反馈闭环完成度被过度评估(实为55% vs 70%)
- **关键风险**: 反馈数据映射不完整(Java缺4字段)导致所有RN端提交的反馈无法追溯文档和意图，影响持续优化
- **时间影响**: 核心功能即时可用；字段映射修复需3-5天；ONNX重训练可推迟至下周
- **工作量**: P0验证1天，P1修复3-5天，P2优化7-10天

---

## Consensus & Disagreements

| 话题 | 研究员A | 研究员B | 研究员C | 分析师 | 批评员 | 最终裁定 |
|------|---------|---------|---------|--------|--------|---------|
| **Layer 0短语覆盖率** | 98短语，3歧义 | — | — | 主要覆盖足够 | 风险被评估为"高"，实际应为"中" | **中等风险** — 98短语覆盖主流查询，但新分类扩展时需维护 |
| **ONNX缺失FOOD_KNOWLEDGE_QUERY** | ★★★★★优先级 | — | — | P2重训练 | 风险过度评估(高→中，实际miss率10%)，因Layer 0保底 | **中风险，延期可接受** |
| **Handler功能** | 简化版80% | 简化但覆盖80%+需求 | — | 足够 | 复杂对比查询可能答案质量不佳(置信度80%→70%) | **可接受，需后续LLM增强** |
| **Drools bypass安全性** | — | 只读安全 | — | 无需修改 | 确认无风险 | **安全** ✅ |
| **RAG Pipeline完整度** | — | 95%完整 | — | 低风险P1 | 未挑战 | **95%完整，添加retry** |
| **反馈闭环完成度** | — | Python 100% | Vue 100%, RN缺/log-query | 70%完成 | **关键挑战：实为55%** | **55%完成，P1必修** |
| **Python客户端** | — | 缺retry | — | P1 | 未挑战 | **需改用executeWithRetry()** |

**关键争议解决**:
1. **ONNX风险等级** — 分析师评"高"，批评员降至"中" → 采纳批评员，理由：Layer 0短语保底机制有效
2. **反馈闭环完成度** — 分析师70%，批评员55% → 采纳55%，理由：Java端字段映射缺失导致反馈数据无法完整记录

---

## 评估矩阵

| 维度 | 状态 | 风险 | 优先级 |
|------|------|------|--------|
| Layer 0 路由 | 98短语覆盖，但3个歧义 | 中 | P0 |
| ONNX 覆盖 | 缺失FOOD_KNOWLEDGE_QUERY | 中(非高) | P2(需重训练) |
| Handler 功能 | 简化版覆盖80%需求 | 低 | P2 |
| Drools 安全 | 只读bypass安全 | 低 | 无需修改 ✅ |
| RAG Pipeline | 95%完整 | 低 | P1(retry) |
| 反馈闭环-Python | 100%完整 | 无 | 完成 ✅ |
| 反馈闭环-Java | 缺4字段映射 | 中 | P1 |
| 反馈闭环-RN | 缺/log-query调用 | 中 | P1 |
| 反馈闭环-Vue | 100%完整 | 无 | 完成 ✅ |
| 文档覆盖 | 817篇42分类 | 低 | 持续扩充 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 核心功能可投产 | ★★★★☆ (80%) | 3研究员+E2E验证通过，但反馈数据质量问题降分 |
| Layer 0短语覆盖足够 | ★★★★☆ (78%) | 98短语，批评员质证miss率低 |
| ONNX缺失非立即阻塞 | ★★★★☆ (75%) | Layer 0保底，批评员证据支持"中风险" |
| Handler简化版80%足够 | ★★★☆☆ (65%) | 批评员指出复杂查询可能缺质量 |
| Drools bypass安全 | ★★★★★ (95%) | 只读无风险，无异议 |
| 反馈闭环实为55%完成 | ★★★★☆ (82%) | Java缺4字段是致命缺陷 |
| Python client需统一retry | ★★★★☆ (80%) | 一致性论证，未反驳 |

---

## 失败模式评估

| 失败模式 | 概率 | 影响 | 说明 |
|----------|------|------|------|
| 食品查询miss Layer 0 | 低(10%) | 高 | 路由到错误意图 |
| 歧义短语误拦截操作查询 | 中(20%) | 中 | 用户想查操作数据得到知识文档 |
| Python服务不可用 | 低(5%) | 高 | 无fallback文案 |
| 反馈数据不完整 | 高(90%) | 中 | 字段映射缺失 |
| RAG返回低质量文档 | 低(15%) | 中 | similarity < 0.80时concatenate 3 docs |

---

## Actionable Recommendations

### 1. 立即(Immediate) — 今天

- **验证ai_intent_configs表** — 确认FOOD_KNOWLEDGE_QUERY记录是否存在
  ```sql
  SELECT * FROM ai_intent_configs WHERE intent_type = 'FOOD_KNOWLEDGE_QUERY' OR intent_key = 'FOOD_KNOWLEDGE_QUERY';
  ```

- **审核3个歧义短语** — 评估"冷链管理"、"食品检测"、"添加剂使用量"是否需要添加消歧关键词
  - 建议方案：保留短语，但在Handler中添加消歧逻辑（检查是否包含"标准""规定""要求"等知识类关键词）

### 2. 短期(Short-term) — 本周

- **Java FeedbackController字段映射补全** (P1, 3-4小时)
  - 添加: `retrievedDocIds`, `retrievedDocTitles`, `sessionId`, `intentCode`

- **RN FeedbackWidget添加/log-query调用** (P1, 2小时)

- **Python SmartBIClient改用executeWithRetry()** (P1, 1小时)

- **单元测试反馈闭环** (2小时)

### 3. 有条件(Conditional)

- **IF 知识库 >1000篇** → 短语维护自动化 + 季度覆盖率审查
- **IF ONNX继续缺标签** → P2阶段重训练(171类)，可延期因Layer 0保底
- **IF Python可用性 <99%** → 添加fallback文案 + circuit breaker
- **IF 平均rating <3.5** → 升级LLM增强版Handler

---

## Open Questions

1. SemanticRouter(Layer 2)的食品知识意图覆盖率?
2. 817篇文档的相似度分布(多少查询命中 < 0.80)?
3. NER非阻塞模式是否会遗漏关键食品安全实体?
4. 反馈数据的去重和异常值检测?
5. Handler的上下文长度上限(RAG返回3文档时的token长度)?

---

## Summary for Decision-Makers (30秒版本)

✅ **绿灯可投产**: 核心食品知识库功能已E2E验证(10/10通过)，Layer 0短语路由可靠(98短语, Miss率<10%)

⚠️ **黄灯小缺口**:
- Java反馈控制器缺4字段映射 → 所有RN反馈无法追溯 (影响持续优化，非功能缺陷)
- Python客户端缺retry → 网络抖动可导致空响应 (概率5%，易修)
- RN隐式反馈检测未启用 → /log-query调用缺失 (2小时可修)

🔵 **蓝灯延期项**: ONNX缺FOOD_KNOWLEDGE_QUERY标签可推迟(Layer 0已保底，下周重训练)

**立即行动**: 验证Intent配置表 + 修复4个字段映射 + 添加retry + 启用/log-query (5天工期)

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 12+ (代码审查 + E2E测试报告 + 数据库快照)
- Key disagreements: 2 resolved (ONNX风险等级, 反馈完成度), 1 unresolved (SemanticRouter覆盖率)
- Phases completed: Research → Analysis → Critique → Integration
- Report confidence: 72%
