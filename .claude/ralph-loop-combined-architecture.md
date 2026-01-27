# Combined Architecture: Preprocessing + RAG Enhancement

## Overview

两个方案互补性分析：

| 方案 | 位置 | 类型 | 解决的问题 |
|------|------|------|-----------|
| **预处理增强** | 输入端 (Layer -1 到 0.3) | 规则型 | 拼写错误、特殊字符、实体提取 |
| **RAG 增强** | 决策端 (Layer 4+) | 学习型 | 中置信度决策、Few-Shot 示例 |

## Combined Architecture

```
用户输入: "销受情况"
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ [Phase 1: 预处理增强] - 解决输入质量问题                      │
├─────────────────────────────────────────────────────────────┤
│ Layer -1: 拼写纠正 (Pinyin-based)                           │
│   "销受情况" → "销售情况"                                    │
│                                                             │
│ Layer -0.5: 特殊字符清理                                    │
│   "【销售】报表" → "销售报表"                                │
│                                                             │
│ Layer 0.3: 实体预提取                                       │
│   "张三上周的考勤" → entities: {person: "张三", time: "上周"} │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ [Phase 2: 现有匹配层] - 保持不变                              │
├─────────────────────────────────────────────────────────────┤
│ Layer 0: 短语匹配优先短路 (0.98)                             │
│ Layer 0.5: 动词+名词消歧 (>=0.80)                           │
│ Layer 0.6: TwoStageClassifier (>=0.92)                      │
│ Layer 1: 精确表达匹配 (Hash)                                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ [Phase 3: 语义路由] - SemanticRouterService                  │
├─────────────────────────────────────────────────────────────┤
│ Step 1: GTE 向量语义路由 (Top-5)                            │
│ Step 2: 精确验证 (+短语/操作分数)                           │
│ Step 2.5: 多意图检测                                        │
│ Step 3: 置信度决策                                          │
└─────────────────────────────────────────────────────────────┘
    │
    ├── 置信度 >= 0.85: 直接返回 ✓
    │
    ├── 置信度 0.65-0.85:
    │   ↓
    │   ┌─────────────────────────────────────────────────────┐
    │   │ [Phase 4: RAG 候选补充] - NEW                       │
    │   ├─────────────────────────────────────────────────────┤
    │   │ 1. 检索相似历史案例 (余弦相似度 Top-5)               │
    │   │ 2. 找到高置信历史 (>=0.85) → 直接采用               │
    │   │ 3. 找到相关案例 → 补充候选 + 权重调整               │
    │   │ 4. 无相关历史 → 原流程 ArenaRL + LLM Reranking      │
    │   └─────────────────────────────────────────────────────┘
    │
    └── 置信度 < 0.65:
        ↓
        ┌─────────────────────────────────────────────────────┐
        │ [Phase 5: RAG Few-Shot 增强 LLM] - NEW              │
        ├─────────────────────────────────────────────────────┤
        │ 1. 检索 3-5 个相似成功案例                          │
        │ 2. 注入 LLM Fallback Prompt 作为 Few-Shot 示例      │
        │ 3. 调用 LLM 进行最终决策                            │
        └─────────────────────────────────────────────────────┘
```

## Implementation Priority Matrix

| Phase | 功能 | 预期提升 | 复杂度 | 依赖 |
|-------|------|----------|--------|------|
| **P0** | 特殊字符清理 | +3% | Low | ✅ 已完成 |
| **P0** | 错别字短语映射 | +2% | Low | ✅ 已完成 |
| **P1** | RAG 检索服务 (候选补充) | +5-8% | Medium | MySQL + EmbeddingClient |
| **P1** | RAG Few-Shot 增强 | +3-5% | Medium | RAG 检索服务 |
| **P2** | Pinyin 拼写纠正 | +3% | Medium | pinyin4j 依赖 |
| **P2** | 实体预提取 (Date/Person) | +2% | Medium | 正则 + 词典 |
| **P3** | 上下文理解 (ConversationContext) | +2% | High | Session 管理 |

## RAG Implementation Details

### 数据源优先级

```java
// RAGDataSource.java
public enum RAGDataSource {
    HIGH_CONFIDENCE_SUCCESS(0.85, "成功案例", 1.0),    // 最高优先
    LEARNED_EXPRESSION(1.0, "已验证表达", 0.95),       // 精确匹配
    CORRECTED_FAILURE(0.0, "纠正案例", 0.9),          // 避免错误
    LLM_HIGH_CONFIDENCE(0.9, "LLM高置信", 0.85);      // Few-shot

    double minConfidence;
    String description;
    double weight;
}
```

### 检索服务接口

```java
public interface RAGRetrievalService {
    /**
     * 检索相似历史案例用于候选补充
     */
    List<RAGCandidate> retrieveSimilarCases(
        String factoryId,
        String userInput,
        int topK,
        double minSimilarity
    );

    /**
     * 获取 Few-Shot 示例用于 LLM 增强
     */
    List<RAGExample> getFewShotExamples(
        String factoryId,
        String userInput,
        int count
    );

    /**
     * 检查是否有可复用的高置信历史
     */
    Optional<RAGCandidate> findDirectMatch(
        String factoryId,
        String userInput,
        double minConfidence
    );
}
```

### 集成点

1. **AIIntentServiceImpl.doRecognizeIntentWithConfidence()**
   - 在 ArenaRL 之前调用 `ragService.findDirectMatch()`
   - 如果找到直接返回

2. **AIIntentServiceImpl.tryLlmReranking()**
   - 调用 `ragService.retrieveSimilarCases()` 获取候选
   - 合并到现有候选列表，调整权重

3. **LlmIntentFallbackClientImpl.buildIntentClassifyPrompt()**
   - 调用 `ragService.getFewShotExamples()`
   - 动态注入到 Few-Shot 示例表

## Expected Combined Impact

| 测试集 | 当前 | +预处理 | +RAG | 综合预期 |
|--------|------|---------|------|----------|
| Simple | 94% | 94% | 95%+ | **95-96%** |
| Complex | 44% | 47% | 55%+ | **55-60%** |

## Research Support

- [REIC: RAG-Enhanced Intent Classification](https://arxiv.org/...) - RAG 比 Few-shot 提升 26%
- [Agentic RAG Survey](https://arxiv.org/...) - Query Refinement Agent 模式
- [Intent Detection in LLMs](https://arxiv.org/html/2410.01627v1) - RAG 增强 OOS 检测
- [Chinese Spelling Correction Survey](https://arxiv.org/html/2502.11508v1) - 82.4% 错误来自相同拼音

## Next Steps

1. **立即可做 (已完成)**:
   - ✅ 特殊字符清理
   - ✅ 错别字短语映射

2. **短期 (1-2 天)**:
   - [ ] RAG 检索服务实现 (MySQL 暴力搜索)
   - [ ] AIIntentServiceImpl 集成 RAG 候选补充
   - [ ] LLM Prompt Few-Shot 动态注入

3. **中期 (3-5 天)**:
   - [ ] Pinyin4j 拼写纠正
   - [ ] 实体预提取 (Date/Person)
   - [ ] RAG 效果监控和调优
