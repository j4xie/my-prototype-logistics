# D24/D29 架构级修复方案 — Agent Team 研究报告

**日期**: 2026-02-28
**主题**: 餐饮意图识别系统 D24（语气词干扰 10/15=66.7%）和 D29（上下文追问 5/12=41.7%）的架构修复方案
**约束**: 不破坏工厂(F001)/餐饮(F002)共享 pipeline

---

## Executive Summary

- **D24 修复**: 仅需在 `matchPhrase` 调用前对输入做语气词清洗，改动量约 15 行，在 `AIIntentServiceImpl.java` 的 5 处 matchPhrase 调用点前清洗传入参数
- **D29 修复**: 两阶段 — 第一阶段在 AIIntentServiceImpl 层用规则检测追问模式（30-50行），第二阶段（视效果）改造 LLM fallback 接口注入 chatHistory（80-100行）
- **置信度**: 高 — 三方 Agent 对根因诊断达成共识
- **核心风险**: 正则过度清洗可能破坏时间上下文检测(L499)和 D8v2 的 originalInputHolder ThreadLocal

---

## 根因分析

### D24 语气词干扰

**根因**: `matchPhrase(L677)` 使用未经 `filterModalParticles` 处理的原始 `userInput` 参数做匹配。语气词前缀（"嗯"、"呃"、"请问一下哈"等）拉低覆盖率计算的 `coverageRatio`，导致短语匹配 miss。

**关键代码**:
```java
// AIIntentServiceImpl.java L677 — 使用原始 userInput，非 processedInput
Optional<String> earlyPhraseMatch = knowledgeBase.matchPhrase(userInput, businessDomain);
```

**辅助原因**: `filterModalParticles()` (L837-845) 仅用 `$` 锚定处理句尾语气词，无法清理句首/句中填充词。

### D29 上下文追问

**根因**: `LlmIntentFallbackClientImpl.classifyIntent()` 签名无 sessionId/chatHistory 参数（L327），LLM 每次只收到单轮 userInput，无法理解追问语境（如"那利润呢"缺少上文"今天营业额"）。

**现有基础设施**:
- `ConversationMemoryService` 已存在且已注入 AIIntentServiceImpl（L103, L509, L589）
- `sessionId` 参数已在 recognize 接口中传递
- `CONTEXT_CONTINUE` 意图已在 COMMON_INTENTS 中定义

---

## 推荐方案

### D24: 方案 B — matchPhrase 调用点前 normalize（立即执行，~15行）

在 AIIntentServiceImpl.java 的 5 处 matchPhrase 调用前，对传入参数调用语气词清洗。**不修改 `userInput` 变量本身**，避免影响时间上下文检测和 originalInputHolder。

```java
// L677: 修改前
Optional<String> earlyPhraseMatch = knowledgeBase.matchPhrase(userInput, businessDomain);

// L677: 修改后
String cleanedForPhrase = filterFillerWordsForPhrase(userInput);
Optional<String> earlyPhraseMatch = knowledgeBase.matchPhrase(cleanedForPhrase, businessDomain);
```

需要在 L1138、L3360、L5154、L5456 等其他 matchPhrase 调用点做同样处理。

**预计效果**: D24 从 66.7% → 88-92%
**跨域安全**: 完全安全，不引入 domain 分支

### D29: 两阶段方案

**第一阶段（本周，30-50行）**: AIIntentServiceImpl 层面规则检测追问模式
- 利用已注入的 ConversationMemoryService 获取最近 1-3 轮对话
- 检测追问特征：代词开头（"那/它/这个"）、省略主语短查询（<6字）、时间延续词
- 命中时路由到 CONTEXT_CONTINUE 意图

**第二阶段（视效果，80-100行）**: LLM fallback 接口增强
- 仅当第一阶段覆盖率低于 80% 时实施
- 改造 `classifyIntent()` 签名注入 chatHistory 参数
- Prompt 中拼接最近 3 轮历史对话

---

## 共识与分歧

| 议题 | 共识/分歧 | 结论 |
|------|----------|------|
| D24 根因 | 共识 | matchPhrase 使用未清洗 userInput |
| D24 方案 A（入口正则）vs B（matchPhrase normalize） | 分歧 → 已裁定 | 采纳 Critic：方案 B 更安全，方案 A 可能破坏时间检测 |
| D29 根因 | 共识 | LLM fallback 无 chatHistory |
| D29 先改 LLM 接口 vs 先用规则层 | 分歧 → 已裁定 | 采纳 Critic：规则层优先，工作量更小且 ConversationMemoryService 已就绪 |
| ">50字才触发预处理" | 已否决 | Critic 代码验证无此阈值门控 |

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 正则过度清洗破坏时间检测 | 中 | 高 | 方案 B 不修改 userInput 变量本身 |
| 追问规则误触发 | 低 | 中 | 仅对 <6 字 + 代词开头 的组合触发 |
| 488 条 E2E 回归 | 中 | 高 | 修改后全量运行 restaurant-full-e2e.py |
| LLM 接口签名变更连锁影响 | 中 | 高 | 第二阶段才实施，第一阶段用规则层避开 |

---

## 实施路线

```
Phase 1 — 立即 (D24, 1天):
  ├─ AIIntentServiceImpl.java: 5处matchPhrase调用点前加filterFiller
  ├─ 新增 filterFillerWordsForPhrase() 方法 (~15行)
  └─ 全量回归 488 E2E 测试

Phase 2 — 本周 (D29 第一阶段, 2天):
  ├─ AIIntentServiceImpl.java: 添加追问模式检测方法
  ├─ 利用 ConversationMemoryService 获取最近轮次
  ├─ 检测命中 → 路由 CONTEXT_CONTINUE
  └─ 全量回归 + 单独验证 D29 12条用例

Phase 3 — 视效果 (D29 第二阶段, 3-5天):
  ├─ LlmIntentFallbackClient 接口新增 chatHistory 重载
  ├─ classifyIntentDirect() 中注入历史消息
  └─ 全量回归
```

---

## Open Questions

1. matchPhrase 清洗后 2 字极短输入是否可能变空字符串？
2. "那个"既是填充词也可能是指示代词，如何区分？
3. ConversationMemoryService 存储的历史是否包含意图分类结果？
4. CONTEXT_CONTINUE 意图的 IntentExecutorServiceImpl 是否有执行逻辑？
5. 前端 sessionId 传递是否稳定覆盖所有入口？

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (A: pipeline代码, B: 会话管理, C: 业界实践)
- Total sources found: 7 core code files + 3 external references
- Key disagreements: 2 resolved (方案A vs B优先级, D29工作量), 1 unresolved (D29规则层覆盖率)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded topic)
- Healer: all checks passed ✅
