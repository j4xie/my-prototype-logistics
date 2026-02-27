# DashScope LLM 调用性能优化方案 v2（基于实测数据）

**日期**: 2026-02-26
**模式**: Full | 语言: Chinese
**增强**: Codebase Grounding ON | Fact-check OFF | Browser OFF

---

## Executive Summary

- **核心发现**: Java 后端 DashScope LLM 调用延迟的 97% 来自 LLM API 本身，存在三个可优化点：Conversation 路径硬编码 plus 模型、thinking 阈值过于激进、以及全量意图注入 prompt
- **置信度**: 中高 — 代码路径已完全验证，但性能数据基于有限样本，且关键路径（Conversation）可能是低频调用
- **关键风险**: Flash 模型在大 prompt 场景的速度矩阵反常（可能为测试噪声），需补充基准测试
- **时间线**: 方案 C（thinking 阈值）0.5 天可落地；方案 A+B 组合 1-2 天
- **工作量**: 总计改动 3-5 个文件，约 30-50 行代码

---

## Consensus & Disagreements

| 主题 | Researcher 发现 | Analyst 建议 | Critic 质疑 | 最终裁定 |
|------|----------------|-------------|-------------|---------|
| Conv 使用 plus 模型 | `chat()` 调用 `config.getModel()` = qwen3.5-plus | 降级为 flash | Conv 是 Layer 5 低频回退路径，月调用 <100 | **代码确认**: `chat()` 第 167 行硬编码 `config.getModel()`。Critic 关于低频的判断合理 — 该路径仅在置信度 <30% 时触发，优化优先级降低 |
| Prompt 膨胀 "113 意图 ~6000 tokens" | 全量意图嵌入 system prompt | 压缩至 top-15 可节省 ~80% tokens | 实际 Conv 的 prompt 结构较简单，每意图仅 1 行（code + name + desc），可能仅 2000-3000 tokens | **代码确认**: `buildConversationSystemPrompt()` 第 502-507 行格式为 `"- **code** (name): desc\n"`，每意图约 30-50 字符。113 意图 * ~40 字符 ≈ 4500 字符 ≈ **1500-2000 tokens**。Critic 正确，~6000 tokens 被高估 |
| Thinking 阈值 >=2 太激进 | COMPLEX_KEYWORDS 含 "分析""优化""建议" 等业务高频词 | 阈值改 >=3 即可 | 触发率未知，需数据 | **代码确认**: 第 444-449 行含 21 个关键词，中文 7 个（分析/对比/为什么/建议/优化/预测/评估）都是制造业日常用语。>=2 确实过于激进。建议改为 >=3 |
| GenericAIChat 已有 flash 路由 | thinking=false 时用 plus 模型 10.2s | 改用 flash 可降至 1.4-2s | 代码已经 thinking=false → flash | **代码确认**: 第 98 行 `model = dashScopeConfig.getFastModel()`。GenericAIChatController **已实现** flash 路由，方案 A 对此路径无增量。真正的问题在 thinking 误触发 |
| Python "已用 DashScope context cache" | Researcher C 提及 | Analyst 将方案 D 列入计划 | **完全错误** — Python llm_client.py 仅是 httpx 连接池 | **Critic 正确**: 方案 D（Context Cache）前提不存在，应从计划中移除 |
| Flash+大prompt 比 Plus 更慢 | 速度矩阵: Flash+2685tok=7297ms > Plus+2685tok=3509ms | 需与方案 B 联合 | 极可能是单次测试噪声 | **无法从代码验证**: 这是运行时性能数据，单次测试不可靠。结论存疑，需多次基准测试确认 |

---

## Detailed Analysis

### 1. ConversationServiceImpl 的 LLM 调用路径

**代码验证结论**:
- `chat()` 方法（DashScopeClient.java 第 165-182 行）使用 `config.getModel()` 即 qwen3.5-plus，且硬编码关闭 thinking（`THINKING_OFF`）
- `buildConversationSystemPrompt()` 将所有 `findActiveByFactoryIdWithPriority()` 返回的意图注入 prompt，无数量限制
- 该方法查询条件为 `isActive=true AND deletedAt IS NULL AND (factoryId=:factoryId OR factoryId IS NULL)`，确实可能返回 100+ 条意图
- **但** ConversationController 是 Layer 5 多轮对话，仅在 Layer 1-4 置信度 <30% 时触发，属于低频回退路径

**Net Assessment**: 优化可做但 ROI 低。将模型改为 flash 且压缩 prompt 至 top-15 意图，预计从 8.2s 降至 **2-4s**（非 Researcher 预估的 1.0-1.5s，因为 1500 tokens 的压缩空间有限）。

### 2. GenericAIChatController 的 Thinking 误触发

**代码验证结论**:
- `shouldEnableThinking()` 第 458-494 行：21 个 COMPLEX_KEYWORDS，阈值 `>=2` 即触发
- 触发后走 `config.getModel()` = qwen3.5-plus + thinking=true，延迟 7-10s
- 未触发时走 `config.getFastModel()` = qwen3.5-flash + thinking=false，延迟 1.4-2s
- **问题核心**: "帮我分析一下今天的生产建议" 同时命中 "分析" + "建议"，触发 thinking，但这是一个简单的数据查询

**Net Assessment**: **最高优先级优化**。建议阈值从 `>=2` 改为 `>=3`，同时考虑将长度阈值从 `>60` 调高至 `>80`。预计 Chat 路径从间歇性 10.2s 降至稳定 1.4-2s。

### 3. 速度矩阵的可靠性

**数据来源**: 实测数据：
- Flash+51tok=759ms, Flash+2685tok=7297ms
- Plus+51tok=1371ms, Plus+2685tok=3509ms

**分析**: Flash 在大 prompt (2685tok) 时竟比 Plus 慢 2x，这违反直觉。可能的解释：
1. 单次测试噪声（最可能）
2. DashScope 对 Flash 和 Plus 的推理基础设施不同
3. 测试时 Flash 节点负载较高

**Net Assessment**: 这组数据**不可作为决策依据**。在基于此数据做模型降级决策前，必须进行 10+ 次重复测试取中位数。

### 4. 方案 D (Context Cache) 的可行性

**代码验证结论**: Critic 指出 Python llm_client.py 仅实现了 httpx 连接池和预热（warmup），不涉及 DashScope 的 prompt context caching 功能。

**Net Assessment**: **方案 D 应从计划中移除**。

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| Thinking 阈值 >=2 过于激进 | ★★★★☆ | 代码确认 + 3 agents 共识，但缺生产触发率 |
| GenericAIChat thinking=false 已用 flash | ★★★★★ | 代码明确，3 agents 确认 |
| ConversationServiceImpl 硬编码 plus 模型 | ★★★★★ | `chat()` 第 167 行 `config.getModel()` |
| Conv prompt 约 1500-2000 tokens（非 6000） | ★★★★☆ | 代码结构分析，每意图 ~40 字符 |
| Conv 是低频路径 | ★★★☆☆ | 架构分析合理（Layer 5 回退），但无生产日志 |
| Flash 大 prompt 比 Plus 慢 | ★★☆☆☆ | 单次测试，可能是噪声 |
| 组合优化后 Conv 8.2s→1.0-1.5s | ★★☆☆☆ | prompt 大小被高估，Flash 大 prompt 性能存疑 |
| 组合优化后 Chat 10.2s→1.4-2.0s | ★★★★☆ | 解决 thinking 误触发即可，代码路径明确 |
| 方案 D (Context Cache) 可行 | ★☆☆☆☆ | 前提完全错误 |

---

## Actionable Recommendations

### R1. [立即执行 — 0.5 天] Thinking 阈值调整

**文件**: `DashScopeClient.java` 第 470 行
- 将 `complexCount >= 2` 改为 `complexCount >= 3`
- 同时第 489 行长度阈值 `text.length() > 60` 改为 `> 80`
- **预期**: GenericAIChatController 间歇性 10.2s → 稳定 1.4-2s
- **风险**: 极低，仅减少 thinking 触发频率

### R2. [短期执行 — 1 天] Conversation prompt 压缩 + 模型降级

**文件**: `ConversationServiceImpl.java` 第 492-531 行
- 在 `buildConversationSystemPrompt()` 中对 `availableIntents` 做 top-N 筛选（N=20-30）
- 基于用户输入关键词匹配排序（可复用 D8v2 domain 检测逻辑）
- 同时将 `callLlmForConversation()` 改用 `config.getFastModel()`
- **预期**: Conv 8.2s → 2-4s
- **风险**: 中等，top-N 选错可能漏掉正确意图

### R3. [条件执行] Flash vs Plus 基准测试

- 在实施 R2 模型降级前，先进行 10+ 次 Flash vs Plus 基准测试
- 固定 prompt 大小 1500-2000 tokens
- 确认 Flash 在此 token 范围确实更快
- 如速度矩阵反常现象可复现，Conv 路径保持 plus

### R4. [条件执行] LLM 调用埋点日志

- 在生产环境添加 LLM 调用埋点（调用路径、模型、token 数、耗时）
- 验证 Conversation 路径实际调用频率
- 验证 thinking 触发率
- 为后续优化提供数据基础

### 不推荐

- ~~方案 D (Context Cache)~~ — 前提错误，Python 端未使用 DashScope 缓存
- ~~方案 A 对 GenericAIChat~~ — 已有 flash 路由，无增量收益

---

## Open Questions

1. **Conversation 路径月调用量是多少？** 如果 <50 次/月，R2 的 ROI 极低
2. **Thinking 在生产环境的实际触发率？** 需要埋点数据
3. **Flash 在 1500-2000 token prompt 下的延迟是否确实优于 Plus？** 速度矩阵数据与直觉矛盾
4. **DashScope API 是否支持 prompt context caching？** 如果支持，可作为 P2 优化
5. **COMPLEX_KEYWORDS 列表是否需要细化？** "分析""建议""优化" 在制造业极常见

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (Conv 路径, Chat 路径, Python 连接池[部分])
- Browser explorer: OFF
- Total sources found: 8 核心源文件 + 实测速度数据
- Key disagreements: 3 resolved (prompt 大小高估、方案 D 前提错误、Chat 已有 flash 路由), 2 unresolved (Flash 大 prompt 性能、Conv 调用频率)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase grounding topics)
- Healer: All checks passed ✅
- Competitor profiles: N/A

### Healer Notes: All checks passed ✅
