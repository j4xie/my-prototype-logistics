# 意图路由 57 个失败案例深度根因分析与长期解决方案

**日期**: 2026-02-19
**Agent Team**: Full Mode (3 Researchers → Analyst → Critic → Integrator)
**基线**: 353/410 (86%), 57 failures from expanded E2E test

---

## Executive Summary

57个失败的根本原因是 **matchPhrase Layer 0 的单一决策权架构** — 它作为第一层以纯子串匹配返回结果，完全跳过后续5层的语义理解能力。这不是配置问题，而是设计取舍的必然结果（speed-first, <1ms）。

**关键结论（Critic修正后）**: 应优先实施 S5（LLM fallback for UNMATCHED），而非逐个补丁（S1-S4）。原因：32个UNMATCHED中大部分是结构性歧义，只有LLM能解决；S1-S4只能推到~91-92%天花板。

---

## 5 大根因

### RC1: matchPhrase Layer 0 决策权过大 (影响: 18个A类)

**代码位置**: `IntentKnowledgeBase.java:~5382` matchPhrase()

- LinkedHashMap按长度DESC排序，第一个substring命中即返回
- **不理解动词**: "新建一条猪肉的入库记录" — "入库记录"(4字) matches QUERY，忽略"新建"
- **不理解优先级**: "生产批次质量报告" — "生产批次"和"质量报告"同长度，HashMap顺序决定胜负
- **不理解语境**: "通过质检" — "质检" matches QUERY，"通过"被忽略
- TwoStageClassifier 有 CREATE_WORDS/DELETE_WORDS 动词检测，但 Layer 0 命中后直接返回，TwoStage永远不被调用

### RC2: 6层管道信息孤立 (影响: 10个A类+D类)

每层独立决策，不共享信息：
- matchPhrase 不知道 TwoStage 检测到了动词
- TwoStage 不知道 matchPhrase 匹配了什么名词
- SemanticRouter 不知道前两层的置信度
- **结果**: 每层做出的最优局部决策 ≠ 全局最优

### RC3: FOOD domain 关键词过度捕获 (影响: 2个D类)

**代码位置**: `IntentKnowledgeBase.java:~5561` FOOD_ENTITY_WORDS

- "过期"/"变质"/"腐烂" 在 FOOD_ENTITY_WORDS 中
- `hasEntityIntentConflict()` 拦截含这些词的查询 → FOOD_KNOWLEDGE_QUERY
- "过期未处理的质检报告" 被拦截到食品知识，实际是质量管理查询
- **本质**: 食品科学词汇 vs 工厂运营词汇的交集区无消歧机制

### RC4: strippedInput 覆盖不足 (影响: 3个N类)

**代码位置**: `IntentKnowledgeBase.java:~5498`

- 只剥离: 数量+单位 (100kg, 50公斤), 批次号 (MB001, B-20241001)
- 不剥离: 人名 ("李明的出勤记录" → 无法匹配"出勤记录")
- 不剥离: 条件表达 ("少于100公斤的原料" → 无法匹配"原料")
- 不剥离: 礼貌前缀 ("劳驾查一下" → 无法剥离"劳驾"到"查一下")

### RC5: 间接表达无推理层 (影响: 6个O3+R类)

- "猪肉快不够了" → 应推理为 LOW_STOCK 查询
- "设备好像有点问题" → 应推理为 ALERT 查询
- "不要这个订单了" → 应推理为 ORDER_DELETE
- 纯substring匹配无法处理隐喻、暗示、否定式表达
- 需要 LLM 级别的语义理解

---

## 6 个解决方案 (S0-S5) — Integrator 调整后优先级

### Phase 1 (本周, 预期 86%→91%)

| 方案 | 描述 | 预期收益 | 工时 | 风险 |
|------|------|----------|------|------|
| **S0** | Golden Set 回归测试 — 353个PASS用例作为自动化基线 | 防回归 | 4h | 零 |
| **S5** | LLM fallback for UNMATCHED — 复用IntentDisambiguationService | +15-20个 | 1-2天 | 低 |
| **S1** | FOOD domain关键词精确化 — "过期"/"变质"从FOOD_ENTITY_WORDS移除 | +2个 | 2h | 低 |
| **S2** | 食品安全事件词 — 瘦肉精/三聚氰胺/苏丹红/地沟油/反式脂肪酸 | +5个 | 2h | 零 |

**S5 优先的理由 (Critic修正)**:
- 32个UNMATCHED中，大部分是结构性歧义（间接表达、省略动词、否定式操作）
- IntentDisambiguationService 已有 DashScope + 缓存基础设施（500条, 1h TTL）
- 只需将 UNMATCHED 终态改为 "call LLM with top-3 candidate intents"
- 单次调用~1.4s，但只影响当前 UNMATCHED 的查询（用户体验从"无法理解"变为"稍慢但正确"）

### Phase 2 (下周, 预期 91%→93-95%)

| 方案 | 描述 | 预期收益 | 工时 | 风险 |
|------|------|----------|------|------|
| **S3** | 轻量级正则NER — 人名/数量/礼貌前缀剥离 | +3-4个 | 1天 | 低 |
| **S4** | 缺失phrase补充 — ~20个低风险phrase | +8-10个 | 4h | 中(需S0回归) |
| **C-fix** | 测试期望修正 — 7个C类中2-3个可接受/2个需新intent | +2-3个 | 2h | 零 |

### Phase 3 (按需, 预期 95%→96-98%)

| 方案 | 描述 | 预期收益 | 工时 | 风险 |
|------|------|----------|------|------|
| **S6** | matchPhrase候选集模式 — 返回top-3而非first-match | +5-8个A类 | 2-3周 | 高 |

**S6 降级理由 (Integrator)**:
- 当前2954条phrase中存在大量同长度冲突，候选集模式需要新的ranking层
- 改动触及核心管道，353个PASS用例回归风险极高
- ROI取决于S5 LLM fallback的实际效果 — 如果S5能解决大部分A类问题，S6不必要

---

## 行业对标

| 方案 | 类比系统 | 准确率范围 |
|------|----------|-----------|
| 当前(纯规则+分类器) | 早期Rasa/LUIS | 85-90% |
| +S5 LLM fallback | 百度UNIT hybrid mode | 90-93% |
| +S6 候选集+reranking | 阿里小蜜 cascading pipeline | 93-95% |
| 全量LLM router | GPT-4/Claude function calling | 95-98% (但延迟10x) |

---

## 预期改进路径 (Integrator调整后)

```
当前: 353/410 (86%)
  ├─ S0 (回归测试): 防回归基线
  ├─ S5 (LLM fallback): +15-20 → 368-373/410 (90-91%)
  ├─ S1+S2 (FOOD+安全词): +7 → 375-380/410 (91-93%)
  │
  ├─ S3 (NER): +3-4 → 378-384/410 (92-94%)
  ├─ S4 (phrases): +8-10 → 386-394/410 (94-96%)
  ├─ C-fix: +2-3 → 388-397/410 (95-97%)
  │
  └─ S6 (候选集, 按需): +5-8 → 393-405/410 (96-99%)
```

**注意**: 数字有重叠（同一case可能被多个方案修复），实际收益略低于理论值。Critic建议保守目标：Phase 1: 88-91%, Phase 2: 93-95%。

---

## Immediate Next Actions

1. **建立 S0 Golden Set** — 将353个PASS用例固化为自动化回归测试
2. **测量 UNMATCHED 分布** — 32个UNMATCHED中有多少能被LLM正确路由
3. **S5 原型验证** — 在 IntentDisambiguationService 中添加 UNMATCHED → LLM fallback 路径
4. **S1 精确化** — 从 FOOD_ENTITY_WORDS 移除 "过期"/"变质"，验证食品知识查询不退化

---

## Data Gaps

1. **LLM对UNMATCHED的准确率**: 32个UNMATCHED送给LLM，能正确路由多少？
2. **S5延迟影响**: 1.4s/call在用户体验上是否可接受？
3. **缓存命中率**: 生产环境中相似查询的重复率是多少？
4. **FOOD关键词移除的回归风险**: "过期"/"变质"移除后，真正的食品知识查询是否退化？

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (root cause code analysis, industry NLU benchmarks, evolution path design)
- Key disagreements: 3 resolved (priority order, S6 necessity, target numbers), 1 unresolved (S5 actual accuracy)
- Phases completed: Research → Analysis → Critique → Integration
- Critic's key contribution: Priority reversal — S5 LLM fallback should be Phase 1, not Phase 2
