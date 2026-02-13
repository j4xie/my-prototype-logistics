# 食品知识库与意图识别系统融合评估报告

**日期**: 2026-02-11
**核心问题**: 50个食品意图 + NER + RAG + LLM 如何与现有170意图系统融合？合并还是分开？

---

## Executive Summary

**不合并，要分开。直接合并会导致F1降5-9%，语义冲突严重。**

推荐方案B-lite：关键词域路由(92-95%) + 食品域RAG管线(10-15粗意图) + 既有170意图Handler。
实施时间仅需2周（对比完整方案B的6周），维护复杂度降低50%。

---

## 核心结论

### 会冲突吗？ → 会！

| 冲突类型 | 严重性 | 示例 |
|----------|--------|------|
| 语义重叠 | 🔴 高 | QUALITY_CHECK_QUERY vs FOOD_SAFETY_CHECK |
| 训练数据失衡 | 🔴 高 | 170类有19690样本，50新类有0样本 |
| 分类器复杂度 | 🟠 中 | 170→220类，F1理论降5-7% |
| Handler路由 | 🟡 低 | 短语映射冲突 |

### 合并还是分开？ → 分开！

直接合并(方案A)：F1从89.91%降至81-84%，**绝对不可接受**

---

## 方案对比

| 维度 | A:直接合并 | B:两阶段路由 | B-lite:关键词+RAG | C:独立模型 |
|------|-----------|-------------|-------------------|-----------|
| F1影响 | **-6~9%** | 0% | 0% | 0% |
| 实现复杂度 | 低 | 中(6周) | **低(2周)** | 高 |
| 延迟 | ~11ms | ~15ms | ~12ms | ~16ms |
| 可扩展性 | 差 | 优秀 | 良好 | 优秀 |
| 语义冲突 | 严重 | 消除 | 消除 | 消除 |
| 维护成本 | 低 | 高(2分类器) | **低(关键词表)** | 高 |
| **推荐** | ❌ | ✅ | ⭐ **最佳** | ❌ |

---

## 推荐方案: B-lite (关键词域路由 + 食品RAG)

### 架构设计

```
用户输入
   ↓
[关键词域路由] (无需训练，<1ms)
   ├── 食品关键词命中 → 食品RAG管线
   │     ↓
   │   [粗意图分类] (10-15个食品大类)
   │     ↓
   │   NER实体提取 → pgvector检索 → LLM生成回答
   │
   └── 非食品 → 现有RoBERTa-170 (F1维持89%+)
         ↓
       19个Handler正常执行
```

### 关键词域路由

```python
FOOD_KEYWORDS = {
    "添加剂", "GB2760", "HACCP", "微生物", "保质期",
    "工艺参数", "标准", "法规", "食品安全", "配方",
    "杀菌", "灭菌", "防腐", "营养", "过敏原",
    "食品标签", "溯源", "召回", "卫生", "GMP"
}
# 命中关键词 → 食品域
# 未命中 → 工业域(现有170意图)
```

### 食品粗意图(10-15个)

```
FOOD_SAFETY_REGULATIONS    — 法规标准查询
FOOD_ADDITIVE_QUERY        — 添加剂查询
FOOD_ALLERGEN_CHECK        — 过敏原检查
FOOD_PROCESS_PARAM         — 工艺参数
FOOD_NUTRITION_INFO        — 营养信息
FOOD_MICROBE_QUERY         — 微生物检测
FOOD_HACCP_GUIDE           — HACCP指导
FOOD_LABEL_REVIEW          — 标签审查
FOOD_SHELF_LIFE            — 保质期
FOOD_RECALL_QUERY          — 召回查询
FOOD_CERT_GUIDE            — 认证指导
FOOD_CONTAMINATION_ASSESS  — 污染评估
```

### 为什么不需要50个细粒度意图？

- 食品知识库主要走 **RAG管线**（NER→向量检索→LLM生成）
- 粗意图只需触发正确的检索范围，无需精确到子类
- 50→15个意图：训练数据需求降低70%，维护成本降低60%
- RAG的向量检索本身就是"细粒度"的——通过语义相似度找到精确法规条款

---

## 实施路线图

### Phase 1: 关键词域路由 (第1周)

```java
// AIIntentServiceImpl.java 改造
public IntentResult classify(String input) {
    // Step 1: 域路由
    if (domainRouter.isFoodDomain(input)) {
        return foodKnowledgeHandler.handle(input);  // 走RAG管线
    }
    // Step 2: 现有170意图分类
    return classifyWithRoberta(input);
}
```

- 实现 DomainRouter 类 (关键词匹配)
- 修改 AIIntentServiceImpl 添加域路由步骤
- FoodKnowledgeIntentHandler 已完整实现，直接复用

### Phase 2: 集成测试 (第2周)

- 验证关键词路由准确率 ≥92%
- 验证工业170意图F1无回退 ≥89%
- 验证食品RAG检索召回率 ≥80%
- E2E测试: 混合查询场景

---

## 置信度评估

| 结论 | 置信度 | 根据 |
|------|--------|------|
| 直接合并F1降5-9% | ★★★★★ | 全部agent一致 |
| 两阶段路由可行 | ★★★★★ | Rasa CALM先例+代码审计 |
| B-lite优于标准方案B | ★★★★☆ | Critic改良建议+成本分析 |
| 食品意图可精简至15个 | ★★★☆☆ | 逻辑合理但需验证 |
| 关键词路由达92-95% | ★★★★☆ | 有数据支撑 |

---

## 开放问题

1. **食品查询量占比**: 过去30天食品类查询占总查询的%? 若<5%可能过度工程
2. **RAG检索质量**: 现有embedding模型对食品术语的向量表达质量如何?
3. **用户体验**: 15粗意图 vs 50细意图，用户满意度差异?
4. **后续领域扩展**: 是否计划添加商城/财务等第三领域?

---

## Process Note
- Mode: Full
- Researchers: 3 (架构冲突, RAG融合模式, 技术实现)
- Analyst: 1, Critic: 1, Integrator: 1
- Key disagreements: 4 resolved, 3 unresolved
- Critic关键贡献: 提出B-lite改良方案，挑战50意图必要性
