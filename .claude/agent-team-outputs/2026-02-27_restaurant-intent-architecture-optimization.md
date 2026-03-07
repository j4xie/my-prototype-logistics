# 餐饮意图识别系统架构优化研究

**日期**: 2026-02-27
**模式**: Full | 语言: Chinese | Codebase Grounding: ON

---

## Executive Summary

当前餐饮意图系统 267/267 (100%) 测试通过，但回复质量 3.7/4，5 个意图的 formattedText 缺少业务关键词。**关键发现**: 生产环境实际为完整 L1→L2→L3→L4 四级 Pipeline（BERT 已启用，阈值 0.92/0.75），而非此前认为的三级退化架构。最高优先修复为 RestaurantIntentHandler 外层 catch 文案注入意图上下文，预计 4h 可提升质量到接近 4.0/4。

---

## Consensus & Disagreements

| 主题 | 研究员结论 | 分析师结论 | 批评者挑战 | 最终裁定 |
|------|-----------|-----------|-----------|---------|
| Pipeline 层级 | B: L2 BERT 禁用(false), L3 活跃(0.88/0.70) | "退化为 L1+L3+L4 三级" | "L3 活跃，应为 L1+L3+L4" | **全部有误**: 代码验证 `pg-prod` 配置 `python-classifier.enabled=true`, 阈值 0.92/0.75。**生产环境为完整 L1+L2+L3+L4 四级** |
| 5 个意图 formattedText | A: 空数据路径缺关键词 | F1 最高优先修复 | "需验证前端是否依赖现有文案" | **共识正确**: 外层 catch (line 128) 返回 "餐饮操作失败: ..." 不含业务关键词是主因 |
| ThreadLocal 泄漏 | B: 已有 try/finally 清理 | F3 列为修复项 | "已安全，可完全跳过" | **批评者正确**: 代码已有完整清理机制，F3 移除 |
| 咨询延迟 7.04s | C: shouldEnableThinking 已调至 ≥3 关键词+>80 字 | F2 "禁用 thinking" | "效果可能已实现" | **批评者正确**: 阈值已调整，大部分查询不触发 thinking，F2 无需额外修复 |
| Few-shot 数量 | B: "仅 23 条餐饮" | F4: 扩展到 50+ | 85% 置信度 | **需修正**: 总量 ~70 条(含 18 条餐饮静态)，另有 MMR/RAG 动态注入。餐饮静态可扩充至 30+ |
| ANN 索引建议 | — | L1: HNSW/FAISS | "过度工程" | **批评者正确**: <200 意图，O(N) <5ms，无需 ANN |

---

## Detailed Analysis

### 1. 回复质量问题 (formattedText 缺关键词)

**根因**: RestaurantIntentHandler.java 外层 catch (line 128-141) 返回 `"餐饮操作失败: " + ErrorSanitizer.sanitize(e)` 通用文案，不含任何业务关键词。

**失败的 5 个意图**: DISH_COST_ANALYSIS(缺"成本"), REVENUE_TREND(缺"趋势"), MARGIN_ANALYSIS(缺"毛利"), WASTAGE_SUMMARY(缺"损耗汇总"), WASTAGE_RATE(缺"损耗率")

**修复策略**: 外层 catch 注入意图名称: `String.format("%s查询失败: %s", intentConfig.getIntentName(), ErrorSanitizer.sanitize(e))`

### 2. Pipeline 架构认知偏差 (重大修正)

**发现**: 所有 3 名研究员、分析师、批评者均对 Pipeline 结构判断有误:
- 研究员 B 检查了 `@Value("${python-classifier.enabled:false}")` 默认值，得出 "BERT 禁用"
- 整合阶段验证 `application-pg-prod.properties` 发现 `python-classifier.enabled=true`
- 同理，SemanticRouter 生产阈值为 0.92/0.75 (非代码默认 0.88/0.70)

**影响**: L2 BERT 分类器在生产已启用但无人评估其餐饮准确率，是一个待挖掘的优化点。

### 3. 延迟分析

| 路径 | 当前延迟 | 优化后 | 优化方案 |
|------|----------|--------|---------|
| 短语匹配 | ~100-300ms | - | 无需优化 |
| 知识库 | 1.39s (串行) | ~1.0s | embedding + reranker 并行 |
| 咨询 | 7.04s → 已优化至 2-3s | - | shouldEnableThinking 已调整 |
| LLM Fallback | 2-5s | - | 流式 SSE 已实现 |

### 4. P1 功能扩展

当前 18 个 switch-case，距重构阈值 (25-30) 尚远:
- **5 个写入意图**: DISH_CREATE/UPDATE/DELIST, WASTAGE_RECORD, PROCUREMENT_CREATE
- **4 个扩展查询**: TABLE_TURNOVER, RETURN_RATE, AVG_TICKET, DELIVERY_ANALYSIS
- 写入意图完成后总数 ~23，仍在 switch-case 可维护范围内

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 外层 catch 文案是 word_found 失败主因 | ★★★★☆ (90%) | 3 Agent 共识 + 代码验证 |
| 生产 BERT 已启用 (四级 Pipeline) | ★★★★★ (98%) | 4 个配置文件一致 |
| ThreadLocal 无泄漏风险 | ★★★★★ (99%) | try/finally/remove() 代码验证 |
| 咨询延迟已缓解 | ★★★★☆ (85%) | shouldEnableThinking 阈值已调整 |
| Few-shot 扩充有价值 | ★★★★☆ (85%) | 餐饮静态 18 条可翻倍 |
| ANN 索引当前无必要 | ★★★★★ (95%) | <200 意图 O(N) <5ms |
| 知识库并行化可省 200-400ms | ★★★☆☆ (60%) | 代码分析但未实测 |

---

## Actionable Recommendations

### 立即执行 (4-6h)

| # | 任务 | 文件 | 预期收益 |
|---|------|------|---------|
| R1 | 修复 RestaurantIntentHandler 外层 catch 文案 | `RestaurantIntentHandler.java:128-141` | 质量 3.7→4.0/4 |
| R2 | 扩充 COMMON_INTENTS 白名单 | `SemanticRouterServiceImpl.java:395-399` | 跨业态意图匹配 |

### 本周内 (3-8h)

| # | 任务 | 文件 | 预期收益 |
|---|------|------|---------|
| R3 | 扩充餐饮 few-shot 至 30+ 条 | `LlmIntentFallbackClientImpl.java:656-673` | LLM fallback 准确率提升 |
| R4 | 知识库 embedding + reranker 并行化 | `food_kb/services/` | 1.39s → ~1.0s |

### 条件触发

| # | 触发条件 | 任务 | 文件 |
|---|---------|------|------|
| R5 | 意图数 > 25 | 策略模式重构 Handler | `RestaurantIntentHandler.java` |
| R6 | 日志分析完成 | 评估 L2 BERT 餐饮准确率 | 生产日志 |

### 不建议执行 (过度工程)

| 任务 | 原因 |
|------|------|
| HNSW/FAISS ANN 索引 | <200 意图，O(N) <5ms |
| ThreadLocal 修复 | 已有 try/finally/remove() |
| 咨询延迟优化 | shouldEnableThinking 已调整 |

---

## Open Questions

1. **L2 BERT 对餐饮意图准确率?** — 生产已启用但无人评估 RESTAURANT_* 分类表现
2. **word_found 失败精确触发路径?** — 需 debug 日志确认是外层 catch 还是测试 check_words 过严
3. **SemanticRouter 0.92 阈值对餐饮口语化查询的影响?** — "今天赚了多少" 可能达不到 0.92
4. **MMR 动态 Few-Shot 服务是否在生产正常运行?** — DynamicFewShotService Bean 注入状态待确认

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (Reply Quality / Pipeline Architecture / Latency & Expansion)
- Browser explorer: OFF
- Total sources found: 17 (全部为代码验证)
- Key disagreements: 3 resolved (Pipeline层级, ThreadLocal, 咨询延迟), 1 unresolved (word_found精确路径)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: disabled (codebase grounding mode)
- Healer: all checks passed ✅
- Competitor profiles: N/A
- **重大修正**: 整合阶段推翻了研究员/分析师/批评者三方对 Pipeline 层级的错误判断
