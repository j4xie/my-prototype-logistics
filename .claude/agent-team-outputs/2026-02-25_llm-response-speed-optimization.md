# LLM API 响应速度瓶颈分析与优化方案

**日期**: 2026-02-25
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**Grounding**: ENABLED (代码验证)

---

## Executive Summary

- **核心结论**: 项目 LLM 响应瓶颈集中在 Python Insight 生成 (单次 ~35s, max_tokens=4500), 而非 Java 意图路由链。并行优化已在代码中实现, SSE 流式端点已存在但主流程未消费。
- **推荐优先级**: P0 前端切换至已有的 `/generate-stream` SSE 端点; P1 为 Insight 结果增加缓存层; P2 启用 DashScope 上下文缓存。
- **置信度**: 中高 -- 代码验证确认了并行/SSE 基础设施已就绪, 但 35s 延迟的根因(推理时间 vs. 排队延迟)尚未通过实测区分。
- **关键风险**: 若 35s 延迟来自 DashScope 排队而非推理, 则 SSE 只改善感知延迟, 不减少端到端时间。
- **工作量**: P0 预计 1-2 天 (前端改造), P1 预计 2-3 天, P2 需评估 DashScope API 兼容性。

---

## Consensus & Disagreements

| 议题 | 最终裁定 |
|------|---------|
| Python field+scenario 并行 | **已在 `unified_analyzer.py:1196` 实现**, 69s 基准已包含并行效果, 不应作为优化项 |
| Java 意图链 LLM 调用次数 | **实际仅 1-2 次**: `ResultFormatterServiceImpl` 纯 switch-case 模板零 LLM 调用, 参数提取有规则学习跳过 |
| SSE 流式端点可用性 | **已存在** (`insight.py:323`, `insight_generator.py:1203`), 前端主流程调用同步 `/generate` 未切换 |
| Nginx SSE 支持 | **已配置** `proxy_buffering off` (nginx-proxy-to-new-server.conf:47) |
| QPS 限流风险 | **实际低**: 内部系统仅 7 角色, 已有语义缓存减少 LLM 调用次数 |
| 并行调度限流 | **已有** `asyncio.Semaphore(max_concurrent_llm_calls=2)` (parallel_processor.py:170) |
| **未解决**: 35s 延迟根因 | 排队延迟 vs. 推理时间需实测 TTFT 区分 |

---

## Detailed Analysis

### 1. Insight 生成是核心瓶颈 (代码验证)

- `insight/generator.py:499`: `max_tokens: 4500`, system prompt + MECE 分析框架约 1200+ tokens
- `httpx.AsyncClient(timeout=60.0)` (第 52 行)
- 使用模型 `qwen3.5-flash-2026-02-23` (config.py:35), 已是 flash 级别
- 每个 sheet 生成一次 insight, 11 sheets 工作簿即 11 次 LLM 调用
- 35s 中多少时间属于排队 vs. 推理需实测

### 2. SSE 基础设施已就绪但未被主流程消费

- Python: `insight.py:323` 有完整的 `/generate-stream` SSE 端点
- Java: `IntentExecutorServiceImpl` 已使用 `SseEmitter`
- Nginx: `proxy_buffering off` 已配置
- 前端: `aiApiClient.ts:523` 已有 SSE 消费代码
- **切换成本低**: 仅需前端 SmartBI 组件改调 `/generate-stream`

### 3. Java 意图路由 LLM 开销被高估

- `ResultFormatterServiceImpl` 纯 switch-case 模板, 零 LLM 调用
- `ParameterExtractionLearningService` 规则学习可跳过 LLM
- `SemanticCacheService` 缓存命中时直接返回
- 实际 LLM 调用: 参数提取 (chatWithTools) + 可选对话 (chat/chatWithThinking)

### 4. 缓存体系现状

| 缓存层 | 覆盖 | 缺失 |
|--------|------|------|
| Java SemanticCacheService | 意图识别+执行结果 | - |
| Python AnalysisCacheManager | data/fields/scenario/metrics/charts | **insight 是否真正写入需验证** |
| Java SmartBIAnalysisCacheRepository | dashboard 级缓存 | - |
| DashScope 上下文缓存 | **完全未启用** | 需验证免费额度支持 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| Insight 生成是 Python 侧最大瓶颈 (~35s/sheet) | ★★★★★ | 3 agents 共识, 代码确认 |
| Python 并行优化已实现, 进一步空间极小 | ★★★★★ | 代码验证 5 处 asyncio.gather |
| SSE 端点已存在但主流程未消费 | ★★★★★ | 代码直接确认 |
| Java 意图链实际仅 1-2 次 LLM 调用 | ★★★★★ | 代码验证 |
| 35s 延迟来自推理而非排队 | ★★☆☆☆ | 无实测数据 |
| DashScope 上下文缓存可降低成本 | ★★★☆☆ | 免费额度是否支持未知 |

---

## Actionable Recommendations

### P0: 前端切换至 SSE 流式 (本周, 1-2天)

前端 SmartBI 组件从调用 `/api/insight/generate` 切换为 `/api/insight/generate-stream`:
- `backend/python/smartbi/api/insight.py` (已有, 无需修改)
- `backend/python/smartbi/services/insight_generator.py` (已有 `generate_insights_stream`)
- 前端 SmartBI 组件 (需改造 SSE 消费逻辑)
- **预估效果**: 用户感知延迟从 35s 黑屏降至 1-2s 首字

### P1: 验证并确保 Insight 缓存写入 (本周, 0.5天)

确认 `AnalysisCacheManager` 在 insight 生成后写入缓存:
- `backend/python/smartbi/services/cache/analysis_cache.py` (检查 save_analysis_async)
- `backend/python/smartbi/services/unified_analyzer.py` (确认 insight 结果写入 CachedAnalysis)

### P2: 精简 Insight Prompt (1-2周)

按数据规模分级:
- 小表 (<50行): max_tokens=2000, 简化为 2 维度
- 中表 (50-200行): max_tokens=3000, 标准 3 维度
- 大表 (>200行): 保持 max_tokens=4500
- 文件: `backend/python/smartbi/services/insight/generator.py`

### P3: 实测 TTFT 区分延迟根因 (本周, 0.5天)

临时启用 stream 模式记录首 chunk 时间戳:
- 若 TTFT > 10s → 瓶颈在 DashScope 排队, 需升级配额
- 若 TTFT < 3s → 瓶颈在输出生成, SSE 是最优解

### P4: DashScope 上下文缓存 (条件性)

若免费额度支持:
- 将 insight 固定 system prompt (~800 tokens) 启用缓存
- 预计减少 20-30% token 处理时间
- 文件: `backend/python/smartbi/services/insight/generator.py`

### P5: 多 Sheet 渐进式渲染 (条件性)

若批量上传场景频繁:
- `unified_analyzer.py:1784` 的 `asyncio.gather(*tasks)` 改为 `asyncio.as_completed()` + SSE 推送
- 每完成一个 sheet 立即推送到前端

---

## Implementation Status (2026-02-26)

### P0: SSE 流式切换 — ✅ 已部署

**改动文件:**
- `web-admin/src/api/smartbi/analysis.ts` — `_doEnrichSheetAnalysis` 中 `generateInsights` → `generateInsightsStream`
- `web-admin/src/api/smartbi/common.ts` — 新增 `'ai-streaming'` phase + `aiStreamChunk` 字段
- 前端已构建并部署到 139 服务器

**实测效果:**
- SSE 端点正常返回 200，157 chunks 逐字到达
- 用户在 ~16s 后看到首字（TTFT=16.66s），总生成几乎瞬间完成
- **修正预期**: 首字延迟 9-20s（非原报告预估的 1-2s），但用户从"35s 黑屏"改善为"16s 后开始看到文字流入"

### P1: 缓存验证 — ✅ 无需改动

Agent 验证了 `AnalysisCacheManager` + `unified_analyzer.py` 已正确写入 insight 缓存。`CachedAnalysis.insights` 字段在分析完成后写入，命中时跳过 LLM 调用。

### P2: 分级 Prompt — ✅ 已部署

**改动文件:**
- `backend/python/smartbi/services/insight_generator.py`:
  - `_get_tiered_config()`: small(<50行)=1500, medium(50-200)=2500, large(≥200)=4000 tokens
  - `_build_tiered_prompt()`: small=2维度, medium=3维度, large=4维度+敏感性分析
  - `generate_insights_stream()`: 修复流式路径未使用分级 max_tokens 的 bug
  - 修复中文引号语法错误 (ASCII `"` → `「」`)

**实测效果:**
- 3 行数据 → small tier (1500 tokens), 日志确认: `Streaming insight tier: small (rows=3, max_tokens=1500)`
- 小表生成几乎瞬间 (TTFT 后 <1s 即完成)

### P3: TTFT 诊断 — ✅ 已完成

**关键发现 (改变优化策略):**

| 模型 | TTFT | 生成时间 | 总时间 | TTFT占比 |
|------|------|---------|--------|---------|
| flash-0223 (长prompt) | 14.01s | 7.81s | 21.82s | 64% |
| flash-0223 (短prompt) | 9.34s | 7.69s | 17.03s | 55% |
| plus-0215 (长prompt) | 20.72s | 23.75s | 44.47s | 47% |
| flash (短prompt) | 8.81s | 6.12s | 14.92s | 59% |
| plus (长prompt) | 18.09s | 28.09s | 46.18s | 39% |

**结论**: TTFT 9-20 秒，50-64% 时间花在 DashScope prefill/排队。SSE 改善体验但无法消除等待。Prompt 压缩对降低 TTFT 有直接效果（短 prompt TTFT 低 30-50%）。

### P4: DashScope 上下文缓存 — ✅ 已部署

**关键发现 (2 个重大 bug 修复):**

1. **`extra_body` 无效 bug**: 项目全部 22 个 Python 文件使用 `"extra_body": {"enable_thinking": False}` 传参，但 DashScope OpenAI-compatible API 完全忽略 `extra_body` 嵌套参数。实测：
   - `extra_body` 方式: reasoning_tokens=789, 耗时 4.18s
   - 顶层 `enable_thinking: False`: reasoning_tokens=0, 耗时 **0.45s** (9.3x 加速)

2. **版本化模型不支持缓存**: `qwen3.5-flash-2026-02-23` 不返回 `cache_creation` 字段，显式缓存完全不生效。切换到 `qwen3.5-flash` (base) 后缓存正常。

**改动文件 (22 个):**
- `smartbi/config.py`: `llm_insight_model` 从 `qwen3.5-flash-2026-02-23` → `qwen3.5-flash`
- `smartbi/services/insight_generator.py`: 新增 `_build_cacheable_system_prompt()` (含分析方法论+行业基准，>1024 tokens), 修复 `extra_body` → 顶层参数
- `smartbi/api/ai_proxy.py` + 20 个其他文件: 修复 `"extra_body": {"enable_thinking": False}` → `"enable_thinking": False`

**实测效果 (qwen3.5-flash + no-thinking + cache):**

| 指标 | 修复前 | 修复后 | 改善 |
|------|--------|--------|------|
| TTFT (streaming) | 16-27s | **0.39s** | **40-69x** |
| Total time | 12-35s | **2.8-3.4s** | **4-12x** |
| Reasoning tokens | 800-2100 | **0** | 完全消除 |
| Cache hit rate | 0% | **87%** (1010/1157 tokens) | 新增 |
| Cache 成本 | 100% input | **10% cached** | 省 ~80% |

**缓存创建过程:**
- Run 1: `cache_creation_input_tokens: 1010` (首次请求创建缓存)
- Run 2: `cached_tokens: 1010` (命中! 87% prompt 被缓存)
- Run 3: `cached_tokens: 1010` (持续命中, 5分钟有效期)

### P5: 多 Sheet 渐进式渲染 — ✅ 已部署

**改动文件:**
- `backend/python/smartbi/api/excel.py` — 新增 `/api/excel/analyze-workbook-stream` SSE 端点
  - 调用 `UnifiedAnalyzer.analyze_all_sheets_stream()` (已有方法)
  - 使用 `asyncio.as_completed()` 替代 `asyncio.gather()`，每个 sheet 完成后立即推送 SSE 事件
  - 事件流: `start` → N × `sheet` → `done`
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` — 移除 2-sheet enrichment 限制
  - 旧逻辑: 只 enrich 前 2 个 sheet (R-16 防雪崩)
  - 新逻辑: 前 2 个立即启动，其余每隔 1.5s 依次启动
  - P4 将 LLM 调用从 35s→3s，并发不再是瓶颈

**实测效果 (3-sheet 工作簿):**
- SSE 端点正常工作: `start` → 3 × `sheet` → `done`
- 总耗时 34.7s (含 field detection + scenario + charts + insights)
- 首个 sheet 约 11s 完成后立即推送，前端可在 11s 开始渲染而非等待 35s

---

## Open Questions (Updated)

1. ~~35s 中 TTFT 是多少?~~ → **已解决**: TTFT 9-20s, 占 39-64%
2. ~~CachedAnalysis.insights 是否真正被写入和读取?~~ → **已验证**: 正常工作
3. ~~DashScope 免费额度是否支持上下文缓存?~~ → **已解决**: 支持，base model 可用
4. ~~免费额度 QPS/排队优先级是否低于付费?~~ → **部分解决**: `enable_thinking` bug 是主因，修复后 TTFT=0.39s
5. ~~是否可用更快的模型替代 plus?~~ → **已解决**: 修复 `enable_thinking` 后 flash 模型 3s 完成

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (代码层面、DashScope API、架构层优化)
- Browser explorer: OFF
- Total sources found: 24 (15+ 代码文件 + 10+ 外部来源)
- Key disagreements: 4 resolved, 1 unresolved → **resolved via P3 test**
- Phases completed: Research (parallel x3) → Analysis → Critique → Integration → Heal → **Implementation (parallel x5)**
- Fact-check: disabled (codebase-grounded topic)
- Healer: 5 checks passed, 0 auto-fixed (all passed ✅)
- Implementation: P0+P1+P2+P3+P4+P5 all deployed and verified
- **最大发现**: `extra_body` bug 导致所有 LLM 调用白白浪费 reasoning tokens
- Competitor profiles: N/A
