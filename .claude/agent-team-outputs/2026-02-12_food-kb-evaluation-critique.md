# 食品知识库评估报告 — Agent Team 多角色深度分析

**日期**: 2026-02-12
**模式**: Full (3 Researchers → Analyst → Critic → Integrator)
**主题**: 评估食品知识库的文档覆盖、分类体系和意图路由

---

## 执行摘要

食品知识库系统包含630篇文档、51个意图处理器、174个实体字典条目。核心发现：Analyst的"死数据"论断被Critic纠正 — Java FoodKnowledgeIntentHandler已实现51个switch case的完整路由架构，而非"仅7个硬编码分类"。**真正的P0风险是ragCategories标签与数据库category值的匹配一致性(未经验证)和LLM幻觉风险**，而非路由不可达。

---

## 团队共识与分歧

### 共识点
- 630篇文档、30+分类、Phase 1-6递进式扩充
- NER ONNX模型92.8%准确率、174实体词典
- RAG测试基线：20查询100%命中、avg相似度0.783

### 关键分歧

| 议题 | Analyst | Critic | 最终判决 |
|------|---------|--------|----------|
| Java路由完整性 | "只有7个硬编码" | "51个switch case完全覆盖" | **采纳Critic** ★★★★★ |
| food_intent_config用途 | "死数据" | "仅8个Phase 2意图走default" | **采纳Critic** ★★★★★ |
| RAG评分 | 88/100 | "选择偏差，实际70-80" | **修正至75/100** |
| 5个"完全缺失"领域 | "严重空白" | "3个已有handler，仅文档不足" | **修正为文档不足** |

---

## 总体评分(最终修正)

| 维度 | 初始评分 | 修正评分 | 置信度 | 关键风险 |
|------|---------|---------|--------|----------|
| 文档覆盖 | 52.7/100 | **58/100** | ★★★★☆ | 标签匹配缺陷 |
| 意图路由 | "严重" | **"部分优化"** | ★★★★☆ | 8个意图走默认 |
| RAG质量 | 88/100 | **75/100** | ★★★☆☆ | 选择偏差+缺失生产测试 |
| 分类器准确率 | 89.91% | **89.91%** | ★★★★★ | 无 |
| 系统成熟度 | 72/100 | **70/100** | ★★★★☆ | P0幻觉+标签风险 |

---

## Critic核心挑战

### 挑战一：「死数据」论断严重失实

分析师声称"Java硬编码仅7个ragCategories"是**错误的**。实际Java handler有**51个switch case**，覆盖dairy/bakery/beverage/frozen/condiment等大量分类。每个case传递语义检索标签(如`["dairy","milk","gb19301","pasteurization"]`)。

真正的问题仅是8个Phase 2新增意图走default分支(次优路由,非完全不可达)。修正严重度: P0→P1。

### 挑战二：RAG 88/100可能系统性高估

- 20个测试查询可能从文档标题派生(选择偏差)
- 缺少口语化/方言/跨域复合/否定式/时效性查询测试
- 生产环境预估：65-75/100
- 修正评分：75/100

### 挑战三：5个「完全缺失」领域评估不准

| 领域 | 分析师评估 | Critic纠正 | 实际优先级 |
|------|-----------|-----------|-----------|
| GMO转基因 | 缺失 | 仅标签标识部分与工厂相关 | P2-低 |
| 应急预案 | 缺失 | Java已有handler + Phase 6有6篇 | P1-中(需扩充) |
| 溯源/区块链 | 缺失 | Java已有handler，系统本身就是溯源系统 | P2-低 |
| 人员培训 | 缺失 | Java已有handler | P2-中(需入库文档) |
| 宠物食品 | 缺失 | 超出产品定位(人类食品) | P3-可忽略 |

### 真正的P0问题(Analyst未发现)

1. **ragCategories标签与数据库category字段匹配验证**: Java传`["dairy","milk"]`但DB中category可能是`dairy_products`→返回0结果→静默降级
2. **LLM幻觉风险**: RAG返回空时LLM可能编造GB标准号→食品安全合规风险

---

## 隐含假设清单

| 假设 | 风险 |
|------|------|
| ragCategories标签与DB category 1:1映射 | **高风险** — 未经验证 |
| 测试查询代表真实用户分布 | **高风险** — 选择偏差 |
| 文档数量与检索质量正相关 | **中风险** — 可能有冗余 |
| food_intent_config迁移脚本已在生产执行 | **中风险** — 未验证 |
| 分类器正确路由食品查询 | **中风险** — 170类中可能误路由 |

---

## 失败模式评级

| 失败模式 | 概率 | 影响 | 优先级 |
|---------|------|------|--------|
| ragCategories标签与DB category不匹配 | 中-高(40%) | 高 | **P0** |
| 口语化查询低于0.72阈值 | 高(60%) | 中 | **P1** |
| 分类器误路由到非FOOD类别 | 中(30%) | 高 | **P1** |
| LLM编造GB标准号(幻觉) | 中(35%) | 高 | **P0** |
| process类冗余导致次优排名 | 中(25%) | 低 | **P2** |

---

## 可操作性建议

### 立即行动(本周) — P0

```
Task 1: 审计ragCategories标签 (1天)
  SELECT DISTINCT category FROM food_knowledge_documents;
  对比Java 51个switch case的标签数组

Task 2: 加固LLM prompt (1天)
  buildFoodExpertPrompt()添加"禁止编造标准号"约束
  RAG空结果时明确标注"未查获相关权威文档"

Task 3: 生产标签匹配回测 (2天)
  收集100条生产查询日志
  分析标签不匹配导致0结果的比例
```

### 短期行动(2-4周) — P1

```
Task 4: Phase 2意图补全 (1天SQL + 5天内容)
  为8个新意图补充switch case或food_intent_config配置

Task 5: RAG阈值优化 (2周)
  收集500+真实查询
  计算最优相似度阈值(推荐0.60-0.65)

Task 6: 文档扩充 (3-6周)
  目标80篇新文档+实体字典200→260条
  高优：直播电商食品安全/预制菜国标/婴幼儿新规
```

### 可选行动 — P2

```
Task 7: 生产级RAG评估框架
  补充Faithfulness/Answer Relevancy/Context Precision

Task 8: 分类器增量微调(非全量重训)
  触发条件: 某领域错误率>15%
```

---

## 关键指标追踪

| 指标 | 基线 | 目标 | 频率 |
|------|------|------|------|
| RAG查询无结果率 | 未知 | <5% | 周 |
| LLM幻觉率 | 未知 | <2% | 周 |
| 标签匹配失败率 | 未知 | 0% | 实时 |
| 分类器F1 | 89.91% | 保持 | 月 |
| 文档覆盖率 | 58% | 70% | 月 |
| 平均RAG相似度 | 0.783 | 0.80+ | 周 |

---

## 开放问题

1. ragCategories标签规范化策略(精确/前缀/模糊匹配?)
2. 生产RAG质量NDCG@5/MRR指标(需4周数据)
3. LLM幻觉频率定量评估(需100条人工标注)
4. 食品知识库国际化(欧盟EC/美国CFR/日本JAS)

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (coverage audit, intent routing, RAG quality)
- Total sources found: ~15
- Key disagreements: 3 resolved (Critic corrections adopted), 1 unresolved (标签匹配需实测)
- Phases completed: Research → Analysis → Critique → Integration
