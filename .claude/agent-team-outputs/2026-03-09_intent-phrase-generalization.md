# 意图识别系统"举一反三"能力提升方案

> Agent Team 研究报告 | 2026-03-09

## 执行摘要

当前意图识别系统的"举一反三"能力受限，根因并非短语覆盖不足，而是**冲突检测机制过度保守**与**嵌入向量区分度不足**的双重制约。好消息是：系统已具备 LLM 消歧兜底（`tryDisambiguateConflict`）、LearnedExpression 持久化学习、以及向量检索+LLM精排的两阶段架构。改进应聚焦于优化现有机制而非重建架构。

---

## 根因分析

### 案例："生产500公斤带鱼罐头" → 应匹配 PRODUCTION_PLAN_CREATE

**失败链条**：
1. PHRASE_MATCH 命中 `"生产罐头"→PRODUCTION_PLAN_CREATE`
2. `hasEntityIntentConflict()` 检测到"罐头" ∈ FOOD_ENTITY_WORDS，且 PRODUCTION_PLAN_CREATE ∈ FACTORY_DATA_INTENT_PREFIXES
3. `DATA_CONTEXT_SIGNALS` 白名单不含"生产" → 冲突判定为 true
4. 触发 `tryDisambiguateConflict()` LLM 消歧（注意：**并非直接否决**，Critic 验证了这一点）
5. LLM 消歧的二元逻辑（食品知识 vs 工厂数据）对含数量词的操作指令区分不足

### 系统性根因

| 根因 | 置信度 | 影响 |
|------|--------|------|
| **冲突检测的结构化特征不足** — 仅靠词表白名单，无法识别"数量词+单位"等操作指令特征 | 90% | 所有含食品实体词的工厂操作 |
| **SEMANTIC 层被 32 个 GUARD/EXCLUDE 削弱** — 27 个 GUARD + 5 个 EXCLUDE，语义路由器变成瑞士奶酪 | 75% | 约 10% 的意图被降级或排除 |
| **Embedding 模型区分度不足** — gte-base-zh 在业务领域存在"语义黑洞"（3 个意图已确认） | 70% | 同义表达可能落入错误的语义区域 |

### Analyst vs Critic 关键纠正

| 议题 | Analyst 原判 | Critic 纠正 | 最终结论 |
|------|-------------|------------|----------|
| 冲突检测是否"简单否决" | 串行否决架构 | 已有 LLM 消歧兜底 | **Critic 正确** — 问题在消歧精度而非架构 |
| LearnedExpression 重启丢失 | 是（需修复） | 否（走 DB 查询） | **Critic 正确** — 此 bug 不存在 |
| 需要新建两阶段架构 | 需要 5-7 天 | 现有架构已是两阶段 | **Critic 正确** — 应优化而非重建 |
| 多锚点嵌入 ROI | 高 | 被高估 | **部分同意** — 需先提升 embedding 质量 |

---

## 方案对比矩阵

| 方案 | 核心思路 | 举一反三能力 | 改动量 | 置信度 |
|------|----------|-------------|--------|--------|
| **A. 结构化特征检测** | 检测数量词+单位、操作动词等特征，增强冲突判断 | 中高 | 1-2天 | 90% |
| **B. DashScope 批量生成** | LLM 离线生成同义表达，扩充种子数据 | 中 | 2-3天 | 85% |
| **C. Embedding 模型升级** | 替换/微调 gte-base-zh 提升语义区分度 | 高 | 1-2周 | 75% |
| **D. 多锚点嵌入** | 每意图 5-10 个向量锚点 | 中（依赖C） | 3-5天 | 40% |
| **E. 优化 SemanticRouter 守卫** | 缩减 GUARD 列表，提升直接执行比例 | 中 | 1周 | 70% |
| **F. 结构化分类特征** | 动词类型+名词域+数量词+疑问句式 并行打分 | 最高 | 1-2周 | 65% |

---

## 可执行建议

### P0: 立即执行（1-3天）

#### 1. 增强 `hasEntityIntentConflict()` 的结构化特征

**文件**: `IntentKnowledgeBase.java` line ~8200

- 检测数量词+单位模式（`\d+[公斤|kg|吨|箱|件|瓶]`）→ 强指向工厂操作
- 检测 `CORE_VERBS_FOR_DISAMBIGUATION` 中的生产/采购/发货类动词 + 食品实体 → 工厂操作
- 创建 `OPERATION_CONTEXT_SIGNALS`（"生产"、"加工"、"排产"、"下单"）

#### 2. DashScope 批量生成同义表达

- 筛选 phraseMapping 中表达数 < 5 的意图
- 用 DashScope 生成每意图 20-30 条变体
- 通过 `addPhraseMapping()` 注入 + 写入 `learned_expressions` 表

### P1: 短期执行（1-2周）

#### 3. 语义黑洞系统性解决

- 离线计算所有意图 embedding 的"中心距离"，自动识别黑洞意图
- 将关键词守卫规则从代码移入 DB 配置

#### 4. 意图识别回归测试集

- 从日志提取被冲突检测拦截后由 LLM 翻转的 case
- 建立 200+ 条测试集覆盖冲突/黑洞/同义表达

### P2: 条件性执行

#### 5. Embedding 模型升级（P0+P1 效果不足时）

- 评估 text2vec-chinese 或 m3e-base 替换 gte-base-zh
- 或在当前模型上用领域数据 fine-tune

#### 6. 主动学习闭环（有运营团队时）

- LLM 消歧结果 → 候选表达 → 人工确认 → LearnedExpression
- 形成"识别失败→消歧→学习→下次直接命中"闭环

---

## 待解决问题

1. `tryDisambiguateConflict()` 的实际可用率和延迟？如果常不可用，冲突检测退化为简单否决
2. 310 个 Tool 中有多少存在语义黑洞问题？需离线分析向量分布
3. DashScope 生成的同义表达中跨意图冲突比例？需设计去重机制
4. `DATA_CONTEXT_SIGNALS` 是否应迁移到 DB 配置？
5. 缺少意图识别准确率的持续监控指标

---

## 业界参考

| 方案 | 来源 | 核心发现 |
|------|------|----------|
| PAG-LLM 运行时复述+聚合 | SIGIR 2024 | 减少 22.7% 误分类 |
| EDA 数据增强 | EMNLP 2019 (5000+ 引用) | 50% 数据达 100% 效果 |
| Voiceflow 混合架构 | 生产验证 4 个月 | NLU top-10→LLM 精排，成本 1/3~1/5 |
| Few-shot LLM 分类 | ACL 2023 Industry | 每意图 2-5 示例即可 |
| text2vec-chinese | GitHub 3.5k stars | 中文句向量，可导出 ONNX |
| Semantic Router | GitHub 3.2k stars | 每意图 5-10 utterance 定义路由 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 25+
- Key disagreements: 4 raised, 4 resolved (Critic corrections adopted)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (claims primarily code-grounded)
- Healer: all checks passed ✅
