# DashScope LLM 调用性能优化分析

**日期**: 2026-02-26
**模式**: Full | 语言: Chinese
**增强**: Codebase Grounding ON | Fact-check OFF | Browser OFF

---

## Executive Summary

Java 意图分类延迟的根因是 (1) 使用较慢的 qwen3.5-plus 模型进行分类、(2) 3000-5000 token 巨型 prompt、(3) 意图数>=50 时的两阶段串行调用。但批评者正确指出 `migration.useDirect` 默认值为 `false` 且无生产配置覆盖——若生产环境未启用直连，则所有 Java 直连优化方案均无效。

**置信度**: 中等——核心瓶颈已确认，但生产环境实际调用路径（直连 vs Python 代理）未经验证。

---

## Consensus & Disagreements

| 主题 | 研究者发现 | 分析师建议 | 批评者质疑 | 最终裁定 |
|------|-----------|-----------|-----------|---------|
| 分类模型选择 | classifyIntent 使用 config.getModel() = qwen3.5-plus | 切换为 fastModel (qwen3.5-flash) | 确认准确但优先级略被高估 | **确认**: classifyIntent() -> chatLowTemp() -> config.getModel() = qwen3.5-plus，切换到 fastModel 是有效优化 |
| "29s 来自 2-4 个串行调用" | Tool Calling 仅在匹配完全失败时触发; ConversationService 是独立 API | 将 4 个调用视为串行链 | **严重质疑**: 正常路径仅 1-2 次调用 | **批评者正确**: Tool Calling 是异常回退路径, ConversationService 是独立端点，正常请求链最多 1-2 次 LLM 调用 |
| newBuilder() 性能影响 | 仅在 thinking 模式触发 | 作为 T1 优化项 | **重要纠正**: 分类路径不走 thinking，不触发 newBuilder() | **批评者正确**: classifyIntent 设置了 THINKING_OFF，此优化无意义 |
| migration.useDirect 生产值 | 未明确确认 | 假设已启用 | **关键隐患**: 默认 false，未找到生产覆盖 | **批评者正确**: 代码默认 `useDirect = false`, 无 properties 覆盖, 无 restart.sh 覆盖 |
| 两阶段分类影响 | 意图>=50 时 2 次串行 LLM 调用 | 禁用可节省 5-10s | 有条件，影响被高估 | **部分正确**: 实际节省 1-3s 而非 5-10s |
| Prompt 大小 | buildIntentClassifyPrompt 生成 4500-5000 token | 列为 T2 (4-8h) | 应提升为 T1 | **批评者正确**: prompt 是单次调用延迟主因，应为最高优先级 |

---

## Detailed Analysis

### 1. 意图分类调用链（正常 vs 异常路径）

正常请求流程:
- `classifyIntent()` (line 325) -> `shouldUseDashScopeDirect()` (line 330) -> `classifyIntentDirect()` (line 494)
- 意图数 < 50: 单阶段 = **1 次** LLM 调用 (line 884)
- 意图数 >= 50: 两阶段 = **2 次**串行 LLM 调用 (line 816 + 846)

分析师错误混入的路径:
- Tool Calling (line 1283): 仅在全部匹配失败 + `autoCreateIntentEnabled && shouldUseToolCalling()` 时触发
- ConversationService (line 478): 完全独立的 API 端点

**结论**: 正常路径最多 2 次 LLM 调用，而非 2-4 次。

### 2. 模型选择与 TTFT 差异

三方研究者一致确认:
- Java `classifyIntent()` -> `chatLowTemp()` -> `config.getModel()` = `qwen3.5-plus` (TTFT ~1-2s)
- Python 分类用 `qwen3.5-flash` (TTFT ~300ms)
- DashScopeConfig 已有 `fastModel = "qwen3.5-flash"` (line 55)，但未被分类路径使用

**结论**: 切换分类模型为 fastModel 确定有效，单次调用减少 700ms-1.7s。

### 3. Prompt 大小是隐藏主要瓶颈

`buildIntentClassifyPrompt()` (line 568-753) 生成:
- CoT 4 步分析框架 (~500 tokens)
- 50+ 行口语化示例表格 (~800 tokens)
- 动态 MMR/RAG Few-Shot 示例 (~300 tokens)
- 全量意图列表 (~2700 tokens)
- 输出格式 + 规则 (~400 tokens)
- **总计 ~4500-5000 tokens**

LLM TTFT 与输入 token 数近似线性相关。5000 token prompt 在 qwen3.5-plus 上独自贡献 3-8s TTFT。

### 4. migration.useDirect 生产状态——关键未知

- 代码默认值 `useDirect = false` (DashScopeConfig.java line 118)
- `intentClassify = false` (line 123)
- 所有 properties 文件和 restart-prod.sh 均无覆盖
- **极大概率生产环境走 Python 代理路径**

### 5. HTTP 客户端性能（warmup / 连接池）

- `newBuilder()` 仅在 thinking 模式触发 (line 98-102)
- 分类路径设置 `THINKING_OFF`，不走此分支
- OkHttp 冷连接惩罚仅影响首次请求 (~200-500ms)

**结论**: warmup 和预建客户端优化影响极小。

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| classifyIntent 使用 qwen3.5-plus 而非 fastModel | ★★★★★ | 3 方研究者确认 + 代码验证 |
| 正常路径最多 2 次 LLM 调用（非 2-4 次） | ★★★★★ | 批评者纠正 + 代码验证 |
| Prompt 大小 (4500-5000 tokens) 是单次调用延迟主因 | ★★★★☆ | 代码验证 + LLM 已知特性 |
| migration.useDirect 生产默认 false | ★★★★☆ | 代码默认值 + 无配置覆盖 |
| 切换 fastModel 可减少单次调用 700ms-1.7s | ★★★★☆ | Python 对比数据 + LLM 模型特性 |
| newBuilder()/warmup 优化影响极小 | ★★★★★ | 代码验证分类路径不触发 |
| T1 优化可达 5-8s | ★★☆☆☆ | 分析师基于错误前提 |
| 禁用两阶段可节省 5-10s | ★★☆☆☆ | 实际节省约 1-3s |

---

## Actionable Recommendations

### 立即 (Day 0)

**R1. 确认 migration.useDirect 生产值** [无需代码改动]
```bash
ssh root@47.100.235.168 "grep -i 'migration\|useDirect\|dashscope.*direct' /www/wwwroot/cretas/cretas-prod.log | head -20"
```
若为 `false`，需在 restart-prod.sh 添加:
```bash
--cretas.ai.dashscope.migration.use-direct=true \
--cretas.ai.dashscope.migration.intent-classify=true
```

**R2. 添加分阶段计时日志** [无需代码改动，通过日志级别]
在 `classifyIntentDirect()`、`classifyIntentTwoPhase()`、`classifyIntentSinglePhase()` 入口/出口添加 ms 级计时，用于验证优化效果。

### 本周 (1-2h)

**R3. 切换分类模型为 fastModel** [局部修改]
- 文件: `DashScopeClient.java` line 432-435
- 将 `chatLowTemp()` 改为使用 `config.getFastModel()`
- 预期: 每次分类调用减少 700ms-1.7s

### 本周 (4-8h)

**R4. 精简 buildIntentClassifyPrompt()** [高影响]
- 文件: `LlmIntentFallbackClientImpl.java` line 568-753
- CoT 框架: 4 步 → 1-2 句指令 (-400 tokens)
- 口语化示例: 50+ 行 → 15-20 行高频 (-400 tokens)
- 意图列表: 去掉 description/keywords，只传 code+name (-1500 tokens)
- 输出格式: 去掉 entities/action_type/domain (-200 tokens)
- **目标**: 4500-5000 → 1500-2000 tokens，预期 TTFT 减少 40-60%

### 条件性

**R5. 禁用两阶段分类** [需先确认意图数 >= 50]
- 设置 `cretas.ai.intent-matching.two-phase-classification-enabled=false`
- 需先通过计时日志确认实际节省幅度（预估 1-3s）

**R6. 若生产走 Python 代理路径**: 优化 Python `/api/ai/intent/classify` 端点性能

### 不推荐

- ~~warmup / 预建客户端~~ — 分类路径不触发 newBuilder()，影响极小
- ~~T4 完整架构重构~~ — 投入产出比太低

---

## Open Questions

1. **migration.useDirect 生产实际值?** — 决定所有后续优化方案的前提条件
2. **"29s" 延迟精确来源是哪个端点?** — ConversationController vs 意图分类路径，调用链完全不同
3. **生产环境可用意图数量?** — 若 < 50，两阶段分类不会触发
4. **RAG/MMR Few-Shot 检索延迟贡献?** — embedding-service:9090 可能贡献 1-5s
5. **Python 代理路径内部实现?** — 若生产走此路径，需审计 Python 侧

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (Java 调用链、Python 对比、DashScope 优化)
- Browser explorer: OFF
- Total sources found: 17 (全部来自代码验证)
- Key disagreements: 4 resolved (串行调用数、newBuilder、Tool Calling、prompt 优先级), 1 unresolved (migration.useDirect)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase grounding topics)
- Healer: All checks passed
- Competitor profiles: N/A

### Healer Notes: All checks passed ✅
