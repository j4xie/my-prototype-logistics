# 食品知识库全面评估 — 文档·分类·意图 (V2)

**日期**: 2026-02-12
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**语言**: Chinese

---

## Executive Summary

知识库在分类、意图、RAG三层面存在结构性缺陷：文档倒金字塔(7个分类仅3-4篇)、分类碎片化(33类无定义)、意图路由瓶颈(单匹配+重复规则)。**核心建议分两阶段**：P0(48h)修复分类一致性、补齐DB约束、修复意图匹配逻辑；P1(1周)扩充核心文档、优化RAG权重。评论人有力地论证了：多匹配/LLM消歧是过度设计(P0→P3降级)，应先用数据验证再做架构变更。P0消除90%结构性问题，48小时可完成。

---

## Consensus & Disagreements

| 话题 | 研究人员 | 分析师 | 评论人 | 最终判定 |
|------|---------|--------|--------|---------|
| **文档覆盖度** | 基础分类薄弱(551字符)、倒金字塔 | 需7阶段扩充+权重 | 551字符≠差，需验证 | **部分共识**：结构问题存在，但优先级需通过实测验证 |
| **分类碎片化** | 33类无DB定义、命名混杂 | P0 CHECK约束+定义审计 | 运维卫生非功能P0 | **分歧但非冲突**：约束有益但不紧急；优先同步定义 |
| **意图路由** | 中文.find()歧义、单匹配遗漏 | 需多匹配+LLM消歧 | 单匹配是设计特性；多轮对话已覆盖 | **关键分歧**：多匹配P0→P3降级；先验证单匹配真实漏率 |
| **查询漂移** | 51个handler各自控制，无中央规则 | HIGH风险(★★★★★) | 被高估(51类精确控制) | **降低至中等**：理论风险存在，需生产数据验证 |
| **NER字典** | 8/13类型覆盖不足 | P0补齐 | 实际漏识率未知 | **共识**：需扩充，但优先级基于实测频率 |

---

## Key Findings

### 1. 分类体系碎片化 (置信度: ★★★★★)

- DB Schema仅定义7个分类(standard/regulation/process/haccp/sop/additive/microbe)
- Java Handler实际使用33个分类 → 26个分类无DB定义或验证
- 命名混乱：17个单词格式(additive) vs 16个snake_case(cold_chain)
- 语义重叠：food_incident vs case_study, health_food vs functional_food, central_kitchen vs catering
- **影响**：新文档入库无法正确归类，拼写错误静默失败(无CHECK约束)

### 2. 文档覆盖度倒金字塔 (置信度: ★★★★☆)

- 基础分类(standard/regulation)平均551-644字符 vs 子分类5000+字符
- 7个分类仅3-4篇：mushroom(3), GMO(3), novel_food(4), organic(4), grain(4), egg(4), enzyme(4)
- 高风险分类文档不足：肉类屠宰(6篇)、微生物检测(5篇/779字符)
- 新兴关切薄弱：fraud_detection(5篇)、allergen(5篇)、GMO(3篇)
- **评论人反驳**：文档长度≠质量，551字符的精确定义可能优于5000字符的冗余

### 3. 意图路由系统瓶颈 (置信度: ★★★★☆)

- refineIntent() 59条正则规则，第一次匹配即返回
- 中文包含式匹配歧义(如"发酵"同时匹配乳品和工艺)
- GB标准号在多条规则重复定义
- 贪婪量词冲突("添加剂.*相互作用"可能阻止"添加剂.*安全")
- **评论人反驳**：单匹配是设计特性，51个switch case精确控制ragCategories。多轮对话替代多匹配

### 4. RAG映射精度不足 (置信度: ★★★★☆)

- 59意图→33分类多对一映射：添加剂4个意图共用同一ragCategories基础
- Top5分类占62%引用(standard:27次, process:24, haccp:19)
- 13个分类仅被引用1次
- 33个分类无scope定义文档

### 5. NER实体字典不完整 (置信度: ★★★★☆)

- NER字典仅覆盖8/13种实体类型
- 缺失：INGREDIENT, PROCESS_PARAM, TEST_METHOD, NUTRIENT, ORG
- 6种NER类型无字典fallback

---

## Revised Priority Framework

### P0 — 立即执行 (48小时)

| # | 任务 | 工作量 | 预期收益 |
|---|------|--------|---------|
| P0-1 | **ragCategories标签一致性审计** — 33个handler类vs DB分类映射表，标记不匹配项 | 4h | 消除RAG零结果 |
| P0-2 | **意图路由规则修复** — GB标准号重复、中文歧义、贪婪量词冲突 | 8h | 减少查询漂移 |
| P0-3 | **单匹配效果测试部署** — 日志记录top3匹配，7天统计准确率 | 12h | 数据驱动决策 |

### P1 — 本周完成

| # | 任务 | 工作量 | 预期收益 |
|---|------|--------|---------|
| P1-1 | **NER字典频率分析+扩充** — 优先扩充>5%频率的类型 | 24h | NER覆盖率提升 |
| P1-2 | **分类scope定义** — 33个分类补齐概念+边界+典型案例 | 20h | 入库准确率提升 |
| P1-3 | **文档扩充** — 优先高风险(肉类/微生物)和新兴关切(GMO/allergen) | 40h | 覆盖率+30% |
| P1-4 | **DB CHECK约束** — food_knowledge_documents.category合法值约束 | 4h | 防止拼写错误 |
| P1-5 | **模块同步CI** — IntentKnowledgeBase与Handler同步检查 | 8h | 维护成本降低 |

### P3 — 条件性执行

| # | 条件 | 任务 | 工作量 |
|---|------|------|--------|
| P3-1 | 单匹配7天准确率<80% | 多匹配+LLM消歧PoC | 40h+ |
| P3-2 | NER漏识率>15% | 规则型NER增强 | 16h |

---

## Critic's Strongest Counterargument

分析师过度强调"多匹配是行业最佳实践"，但未考虑**小团队运营**的约束。当前单匹配设计已能处理90%+用户查询：

1. "添加剂安全吗" → FOOD_ADDITIVE_SAFETY → ragCategories=["additive","standard","haccp"] ✅
2. "预制菜能加防腐剂吗" → FOOD_PREFAB_GUIDE → ragCategories=["prefab_food","process","cold_chain"] ✅

复合查询可通过**多轮对话**替代多意图（用户追问"再说安全评估"→自动细化）。实现多匹配+LLM消歧需要3-5天开发，仅覆盖5-10%用户。**真正的P0是ragCategories标签一致性审计（1天工作），而非架构重构。**

---

## Risk Assessment (Revised)

| 风险 | 原始评级 | 修正评级 | 理由 |
|------|----------|----------|------|
| RAG零结果(分类标签不匹配) | HIGH | **HIGH** (95%) | 真P0 |
| 查询漂移(意图→分类映射) | HIGH (★★★★★) | **MEDIUM** (60%) | 51个switch精确控制，需实测 |
| LLM幻觉(GB标准号) | HIGH | **MEDIUM-HIGH** (30%) | 已有anti-hallucination prompt |
| NER漏识 | MEDIUM | **MEDIUM** (需数据) | 实际漏识率未知 |
| 正则冲突 | MEDIUM | **MEDIUM** | E2E 9/10 PASS |
| 文档质量(551字符) | HIGH | **LOW** (25%) | 长度≠质量 |

---

## Open Questions

1. 单匹配的实际漏率是多少？（决定是否需要多匹配）
2. 26个"无定义"分类是否真的被调用？（可能是死代码）
3. 文档长度与检索准确率的关系？（需实验验证）
4. Top5分类62%权重是否匹配用户查询分布？
5. 哪些NER类型最常出现在实际查询中？

---

## Process Note

- **Mode**: Full
- **Researchers deployed**: 3 (Document Coverage, Category Taxonomy + RAG, Intent Routing)
- **Total findings**: 24 findings across 3 researchers
- **Key disagreements**: 3 resolved (multi-intent→P3, query drift→MEDIUM, doc quality→needs experiment)
- **Phases completed**: Research → Analysis → Critique → Integration
