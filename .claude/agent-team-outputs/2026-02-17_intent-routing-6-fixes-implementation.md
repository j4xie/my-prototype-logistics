# 意图路由系统6个失败Case修复实现方案

**日期**: 2026-02-17
**模式**: Full (5 agents)
**语言**: Chinese

---

## Executive Summary

放弃一步完成全部6个案例的MVP方案，改为分阶段修复。第一阶段(6.5-7h)处理Case 2/3/5/6，第二阶段处理Case 1(LLM消歧)，第三阶段(T3)处理Case 4(多槽位组合引擎)。

关键发现:
- Case3 不能添加到FOOD_ENTITY_WORDS（会误拦质检查询），需独立检测路径
- Case5 是hard blocker: SALES_STATS意图无handler，必须先实现
- Case4 短语补丁覆盖率仅30-40%（非Analyst估计的80%），需T3架构投资
- Case1 采用LLM消歧方案而非查询指示词白名单（更可维护）

---

## 第一阶段：立即执行（6.5-7小时，4/6 cases）

### Fix 1: Case3 "大肠杆菌超标的原因和预防措施" (1h)

**问题**: "大肠杆菌"不在FOOD_ENTITY_WORDS，查询落入GENERAL_QUESTION→NEED_CLARIFICATION

**方案**: 创建独立食品知识问题检测（不污染FOOD_ENTITY_WORDS）

**为什么不添加到FOOD_ENTITY_WORDS**: Critic发现添加后"大肠杆菌检测报告"等工厂质检查询会被误拦截为食品知识

**具体改动**:
- 文件: `IntentKnowledgeBase.java`
- 新增方法: `isFoodSafetyKnowledgeQuery(String text)`
- 逻辑: 匹配模式 `(如何|怎么|标准|要求|原因|预防|措施|注意) + (大肠杆菌|沙门氏菌|黄曲霉毒素|李斯特菌|金黄色葡萄球菌|致病菌|病原菌|农药残留|兽药残留|重金属超标|微生物超标)`
- 关键区分: "大肠杆菌超标的原因" → 食品知识 ✓ / "大肠杆菌检测报告" → 质检数据 ✗
- 在 `AIIntentServiceImpl` 食品知识拦截点调用此方法

### Fix 2: Case5 "销量前五的产品是哪些" (1.5h)

**问题**: "销量"不在短语映射，且SALES_STATS意图无handler

**方案**: 添加短语映射 + 实现SALES_STATS handler

**具体改动**:
1. `IntentKnowledgeBase.java` phraseToIntentMapping:
   - "销量" → SALES_STATS
   - "销售额" → SALES_STATS
   - "销量排名" → SALES_RANKING
   - "销售排名" → SALES_RANKING
   - "畅销产品" → SALES_RANKING

2. `TwoStageIntentClassifier.java`:
   - STATS_WORDS 添加: "销量", "销售额"
   - RANKING_WORDS 新增: "前五", "前十", "排名", "最畅销", "TOP"

3. `CRMIntentHandler.java`:
   - 新增 case "SALES_STATS" → handleSalesStats()
   - 新增 case "SALES_RANKING" → handleSalesRanking()
   - handleSalesStats(): 查询工厂销售统计(按产品分组)
   - handleSalesRanking(): 查询TOP N产品(ORDER BY sales DESC LIMIT N)

### Fix 3: Case2 "逾期未完成的订单" (3h)

**问题**: detectQuestionType()中"未完成"的"完成"匹配UPDATE_WORDS

**方案**: 添加否定前缀检查 + 边界case处理

**具体改动**:
- 文件: `TwoStageIntentClassifier.java`
- 新增常量: `NEGATION_PREFIXES = {"未", "没有", "没", "不", "非", "无", "尚未"}`
- 新增方法: `hasNegationPrefix(String text, String matchedWord)`
  - 检查matchedWord前方是否紧邻否定前缀（距离≤2字符）
  - 双重否定检测（2个否定词→正面）
  - 特殊排除: 若同时包含UPDATE动作词("标记为","更新为","修改为") → 保持UPDATE
- 在 detectQuestionType() 中: 若UPDATE_WORDS命中但有否定前缀 → 翻转为QUERY

**边界case**:
- "逾期未完成的订单" → 否定+"完成" → QUERY ✓
- "将未完成的订单标记为完成" → 否定但有"标记为" → UPDATE ✓
- "没有发现异常的批次" → 否定+"发现" → QUERY ✓

### Fix 4: Case6 "张三这个月请了几天假" (2h)

**问题**: 人名"张三"未被识别，HR domain未被优先

**方案**: 审计+修复SlotExtractor人名检测路径 + HR domain权重提升

**具体改动**:
1. 审计 `AIIntentServiceImpl.execute()` 确认HR分支是否调用SlotExtractor
2. 若未调用，添加 `extractSlots()` 调用
3. `TwoStageIntentClassifier.java`:
   - 在Stage1 domain分类中: 若extractedSlots.hasPersonName() → domain置信度 HR += 0.15
   - 添加HR关键词: "请假", "考勤", "出勤", "旷工", "休假", "年假"

---

## 第二阶段：本周实施（3h, 1 case）

### Fix 5: Case1 "库房里还剩多少猪肉" (3h)

**问题**: 食品实体"猪肉"触发hasEntityIntentConflict()强制路由到FOOD_KNOWLEDGE

**方案**: 传入真实intentCode + LLM消歧（而非查询指示词白名单）

**具体改动**:
1. `AIIntentServiceImpl.java` 3个调用点:
   - ONNX路径 (~line 628): 传入 onnxResult.intentCode
   - SemanticRouter路径 (~line 689): 传入 semanticMatch.intentCode
   - TwoStage路径 (~line 1020): 传入 twoStageResult.intentCode

2. `IntentDisambiguationService.java` (新建):
   - 使用 DashScopeClient.chatCompletion() 调用 qwen-turbo
   - System prompt: 区分A=食品知识(怎么做/标准/注意) vs B=工厂数据(多少/列表/状态/库存)
   - ConcurrentHashMap缓存, 500条, 30min TTL
   - Fallback: LLM不可用时保持现有行为(跳转FOOD_KNOWLEDGE)

3. 修改 hasEntityIntentConflict() 的3个调用点:
   - 冲突检测=true时 → 调用 disambiguationService.disambiguate()
   - 若LLM判断=FACTORY_DATA → 保留原意图（不跳转）
   - 若LLM判断=FOOD_KNOWLEDGE → 跳转FOOD_KNOWLEDGE_QUERY

---

## 第三阶段：T3长期方案（2-4周, 1 case）

### Fix 6: Case4 "上周生产了多少批次的牛肉产品"

**问题**: 多条件(时间+数量+产品)无法组合，IntentCompositionConfig只支持单Modifier

**临时方案** (第一阶段中30min):
- 添加5-7个常见短语到phraseToIntentMapping
- "生产了多少批次"→PROCESSING_STATS 等
- 预期覆盖: 35-40%

**T3架构方案** (2-4周):
1. **MultiSlotCompositionEngine**: 输入(domain, action, slots集合, modifiers) → 组合意图码
2. **SlotEnhancementService**: LLM补全缺失槽位(product NER)
3. **ConfidenceAwareRouter**: 分层路由(纯规则/规则+LLM/LLM消歧/降级)

---

## 置信度评估

| 修复项 | 置信度 | 理由 |
|--------|--------|------|
| Case3 独立检测路径 | ★★★★★ | 3方共识，避免副作用 |
| Case5 短语+handler | ★★★★★ | Critic确认hard blocker已纳入 |
| Case2 否定词处理 | ★★★★☆ | 需3h覆盖边界case |
| Case6 人名路由 | ★★★★☆ | 需代码审计确认路径 |
| Case1 LLM消歧 | ★★★★☆ | 依赖DashScope可用性 |
| Case4 短语补丁 | ★★☆☆☆ | 仅40%覆盖 |
| Case4 T3方案 | ★★★★☆ | 架构投资需2-4周 |

---

## 实施顺序

```
Day 1 (6.5-7h):
  1. Case3: 食品知识独立检测 (1h)
  2. Case5: 销售短语+handler (1.5h)
  3. Case2: 否定词处理 (3h)
  4. Case6: 人名检测路由 (2h)
  5. Case4: 短语补丁临时方案 (0.5h)
  6. Build + Deploy + 验证 (1h)

Day 2-3:
  7. Case1: 传入真实intentCode + LLM消歧 (3h)
  8. 回归测试120+30查询 (2h)

T3 (Week 3-4):
  9. Case4: MultiSlotCompositionEngine
```

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (T1 config, T2 architecture, T3 long-term)
- Key disagreements resolved: 4 (Case3副作用, Case5 handler blocker, Case2工时, Case4覆盖率)
- Phases completed: Research → Analysis → Critique → Integration
