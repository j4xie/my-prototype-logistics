# SEMANTIC 层导致意图路由精度暴降：完整根因分析报告

> 生成时间: 2026-02-25 | Agent Team: Full Mode | 4 阶段完整流水线

---

## Executive Summary

- **Recommendation**: 实施 Phase A（提升阈值 0.75→0.88 + recognize 加 Layer 0 前置过滤）作为立即行动，同步启动 Phase B（k-NN 投票 + 短语补充）设计
- **Confidence**: High (★★★★☆) — 三个研究团队代码共识强，Critic 对根因排序提出有效质疑并被采纳
- **Key Risk**: 阈值过高导致 recall 下降（误杀低置信度合法意图），k-NN 设计不当导致过度平滑
- **Timeline**: Phase A 2-3 天恢复至 88-92%；Phase B 5-7 天设计验证；embedding 完全修复 2-4 周
- **Cost/Effort**: Phase A 低（配置+局部修改 3 个类），Phase B 中（架构调整 5+ 个类），Phase C 高（模型微调需 GPU）

---

## 背景数据

| 指标 | Embedding ON | Embedding OFF | 差值 |
|------|-------------|---------------|------|
| Phase 1 recognize | 964/1181 (82%) | 1176/1181 (100%) | **-18%** |
| Phase 2 execute | 93/94 (99%) | 93/94 (99%) | 0% |

---

## Consensus & Disagreements

| Topic | Researchers | Analyst | Critic | Final Verdict |
|-------|-----------|---------|--------|--------------|
| Layer 0.4 直接 return | ★★★★★ 越权拦截 | ★★★★★ 根因 | ★★★☆☆ 影响被高估 | **Critic 修正有效**：L0.4 return 对两个路径平等应用，不是 recognize 独有问题 |
| topN=1 vs topN=3 | ★★★★★ 确认差异 | ★★★★★ 主根因 | ★★★★★ 完全同意 | **Full Consensus**：topN=1 是 recognize 低精度的首要根因 |
| SemanticRouter 0.70-0.88 直接返回 | ★★★★★ | ★★★★★ | ★★★☆☆ 实为 NeedReranking | **Critic 纠正准确**：0.70-0.88 不是直接返回，而是走 LLM 二次排序 |
| 单 NN 胜者通吃 | ★★★★★ 赢者通吃 | ★★★★★ Critical | ★★★☆☆ 非根因 | **Critic 降权合理**：单 NN 是快速路径特性，topN=1 才是元凶 |
| 向量空间密度失衡 | ★★★★★ 量化验证 | ★★★★★ Critical | ★★★★☆ 真实但非首因 | **修正优先级**：Phase B 问题，不是 82% 暴降的直接原因 |

---

## 根因排序（Critic 修正版）

### Primary — topN=1（★★★★★ 代码验证）

- **位置**：AIIntentConfigController.java:160 `recognizeIntentWithConfidence(..., 1, null, null)`
- **机制**：recognize 硬编码 topN=1，只取单一最佳候选，无冗余池；execute 用 topN=3 保留降级空间
- **影响**：SEMANTIC 层错误匹配时，recognize 无法 fallback；execute 有 NEED_CLARIFICATION 兜底
- **修复难度**：低（参数改动）

### High — SEMANTIC 阈值过低 + 无确认机制（★★★★☆）

| 组件 | 阈值 | 位置 |
|------|------|------|
| SemanticIntentMatcher | 0.75 | SemanticIntentMatcher.java:69 |
| SemanticRouterServiceImpl (reranking) | 0.70 | SemanticRouterServiceImpl.java:70 |
| SemanticRouterServiceImpl (directExecute) | 0.88 | SemanticRouterServiceImpl.java:63 |
| 统一搜索 | 0.60 | AIIntentServiceImpl.java:5393 |

- **问题**：0.75 意味着 25% 的向量距离容差；锚点短语稀疏时，泛化短语轻易跨越边界
- **Critic 修正**：0.70-0.88 是 NeedReranking（走 LLM），非"直接返回"；但阈值仍过低

### Medium — Layer 0 前置过滤在 recognize 缺失（★★★★☆）

- **execute 有**：IntentExecutorServiceImpl.java:363-496 完整 Layer 0（GENERAL_QUESTION/CONVERSATIONAL/食品知识/AgenticRAG）
- **recognize 无**：AIIntentConfigController.java:150-181 直接调用识别，无前置检测
- **影响**：~20% 边界查询进入 SEMANTIC 层被错误路由

### Medium — 向量锚点稀疏"黑洞"效应（★★★★☆）

```
QUALITY_CHECK_CREATE:      8 条短语（平均 13.78 的 58%）
MATERIAL_BATCH_RELEASE:    5 条短语（平均 13.78 的 36%）
对比 FOOD_KNOWLEDGE_QUERY: 273 条短语
总计: 3653 短语 / 265 意图
```

- 短语少 → 质心估算偏 → 覆盖范围扩大 → 单 NN 策略下泛化短语容易跨越边界
- **修复**：k-NN 投票 + 补充锚点（Phase B）

---

## recognize vs execute 路径差异

| 维度 | recognize (82%) | execute (99%) |
|-----|-----------------|---------------|
| **Layer 0 前置** | ❌ 无 | ✅ 有（363-496行） |
| **topN** | 1（硬编码） | 3（配置值） |
| **低置信度处理** | 直接返回 → 算 FAIL | NEED_CLARIFICATION → 算 PASS |
| **测试指标** | 意图码精确匹配（严格） | 响应有效性（宽松） |

**核心洞察**：execute 不是因为 SEMANTIC 更准，而是架构上为低置信度设计了兜底。recognize 直接暴露了 SEMANTIC 层所有弱点。

---

## Confidence Assessment

| 结论 | 置信度 | 证据基础 |
|------|--------|---------|
| topN=1 是首要根因 | ★★★★★ | 代码验证 + 全员共识 |
| Layer 0 缺失加重问题 | ★★★★☆ | 代码验证 + 影响范围 ~20% |
| SEMANTIC 阈值 0.75 偏低 | ★★★★☆ | 代码验证 + 量化分析 |
| 向量锚点稀疏→黑洞效应 | ★★★★☆ | 代码验证 + 统计分析 |
| 单 NN 是设计缺陷 | ★★★☆☆ | Critic 降权：快速路径特性，非根因 |
| embedding 稳定性问题 | ★★★☆☆ | 未验证，需诊断数据 |
| Phase A 可恢复至 88-92% | ★★★★☆ | 业界经验，需验证性测试 |

---

## Actionable Recommendations

### 1. Immediate（做现在，2-3 天）

**A1：recognize 提升 topN + SEMANTIC 阈值**
- `AIIntentConfigController.java:160`：topN 从 1 改为 3
- `SemanticIntentMatcher.java:69`：阈值从 0.75 改为 0.88
- `SemanticRouterServiceImpl.java:70`：rerankingThreshold 从 0.70 改为 0.80
- 预期：recognize 82% → 86-89%

**A2：recognize 加 Layer 0 前置过滤**
- 从 `IntentExecutorServiceImpl.java:363-410` 复用 GENERAL_QUESTION/CONVERSATIONAL 检测
- 在 `AIIntentConfigController.recognize()` 前置 `knowledgeBase.detectQuestionType()`
- 预期：+2-3%，总计 88-92%

**配置审计**
- 确认 `cretas.ai.semantic.enabled` 当前值
- 确认 embedding 服务 (gRPC 9090) 状态
- 文档化禁用原因和重启计划

### 2. Short-term（本周，5-7 天）

**B1：k-NN 投票聚合**
- `SemanticIntentMatcher.java:206-227`：取 top-5 结果，按意图聚合投票
- 阈值同步提升至 0.85
- 预期：93-95%

**B2：补充短语锚点**
- QUALITY_CHECK_CREATE：8 → 20 条
- MATERIAL_BATCH_RELEASE：5 → 15 条
- 使用 feedback 日志或领域专家标注

**Embedding 稳定性诊断**
- 采集 gRPC 9090 可用性、相似度方差、响应时间
- 建立告警：相似度方差 >0.1 时自动禁用

### 3. Conditional

- **如果 B1+B2 后仍 <93%**：执行 Phase C embedding 模型 fine-tuning（2-4 周）
- **如果 embedding 相似度漂移 >0.15**：永久禁用 embedding，改用 BM25 + LLM 路由
- **如果 recognize 用例扩展到 2000+ 后 Phase A 只达 85%**：重设计 recognize API 为返回 Top-3 候选

---

## Open Questions

1. **[Critical]** embedding 稳定性指标是否已采集？gRPC 9090 相似度方差是多少？
2. **[High]** `semanticFirstRouting` 配置当前值？0.50 阈值是否 dead code？
3. **[High]** 1181 个失败用例按意图分布？是否集中在 QUALITY_CHECK_CREATE/MATERIAL_BATCH_RELEASE？
4. **[Medium]** embedding 模型选择是否最优？gte-base-zh vs bge-large-zh 对比？
5. **[Medium]** recognize 精度达到多少是"足以重启 embedding"的阈值？
6. **[Low]** Layer 0.4 快速路径的实际流量占比？

---

## Process Note

- **Mode**: Full
- **Researchers deployed**: 3（路由优先级、向量空间质量、recognize vs execute 路径）
- **Total tool uses**: 69 (research) + 27 (analyst) + 24 (critic) + 17 (integrator) = 137
- **Total sources**: 8 个核心 Java 文件 + IntentKnowledgeBase 统计分析
- **Key disagreements**: 3 resolved (Critic 修正 L0.4 影响、MEDIUM 层行为、单 NN 定性), 2 unresolved (锚点稀疏优先级、semanticFirstRouting 状态)
- **Phases completed**: Research (parallel) → Analysis → Critique → Integration → Heal
- **Fact-check**: disabled（内部代码分析）
- **Healer**: All structural checks passed ✅ — Executive Summary present, Comparison Matrix complete, Recommendations actionable with code locations, Cross-references valid

### Code Verification Summary (Critic Phase)

| Claim | Status | Source |
|-------|--------|--------|
| Layer 0.4 直接 return (行1112) | ✅ VERIFIED | AIIntentServiceImpl.java:1059-1122 |
| recognize topN=1 vs execute topN=3 | ✅ VERIFIED | AIIntentConfigController.java:160 vs IntentExecutorServiceImpl.java:540 |
| SEMANTIC 阈值默认 0.75 | ✅ VERIFIED | SemanticIntentMatcher.java:69 |
| QUALITY_CHECK_CREATE 8条短语 | ✅ VERIFIED | IntentKnowledgeBase.java grep 统计 |
| SemanticRouter 三级阈值 0.70/0.88 | ✅ VERIFIED | SemanticRouterServiceImpl.java:63,70 |
