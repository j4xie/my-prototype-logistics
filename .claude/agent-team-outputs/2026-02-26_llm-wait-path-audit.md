# 全量 LLM 用户等待路径审计报告

**审计日期**: 2026-02-26
**审计范围**: Python 服务 (8083) + Java 后端 (10010) 全部 LLM 调用点
**审计类型**: 只读分析，不涉及代码变更

---

## 一、Python 服务 LLM 调用清单（20+ 条路径）

### A. AI Proxy 端点（Java 后端调用 Python）

**文件**: `smartbi/api/ai_proxy.py` → `_call_llm()` → 共享连接池 `common/llm_client.py`

| # | 端点 | 功能 | max_tokens | 超时 | 温度 | 模型 | 缓存 | 流式 |
|---|------|------|-----------|------|------|------|------|------|
| P1 | `POST /api/ai/rule/parse` | 规则解析 → JSON | 2000 | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |
| P2 | `POST /api/ai/state-machine/parse` | 状态机描述 → 定义 | 2000 | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |
| P3 | `POST /api/ai/intent/classify` | 意图分类 | 2000 | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |
| P4 | `POST /api/ai/intent/clarify` | 歧义澄清生成 | 2000 | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |
| P5 | `POST /api/ai/intent/parse-data-operation` | 数据操作解析 | 2000 | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |
| P6 | `POST /api/ai/form/generate-schema` | 表单 Schema 生成 | **3000** | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |
| P7 | `POST /api/ai/factory/batch-initialize` | 工厂配置初始化 | **4000** | 30s | 0.3 | qwen3.5-plus-2026-02-15 | DashScope ephemeral | 否 |

**关键实现细节**:
- 所有端点共享 `_call_llm()` 函数，payload 中 system prompt 带 `"cache_control": {"type": "ephemeral"}`
- 连接池: `httpx.AsyncClient(max_connections=20, max_keepalive_connections=10, keepalive_expiry=30)`
- 启动时预热: `init_llm_client()` 发送 `qwen3.5-flash max_tokens=1` 的 warmup 请求
- Cache 命中日志: `[ContextCache] HIT cached={cached}/{total} tokens`
- 错误处理: 所有端点 catch → `{"success": false, "message": "处理失败，请稍后重试"}`
- **无应用层结果缓存**，仅 DashScope prompt cache (5 min TTL)

---

### B. Insight 分析

**文件**: `smartbi/api/insight.py` → `smartbi/services/insight_generator.py`

| # | 端点 | 功能 | max_tokens | 超时 | 温度 | 模型 | 缓存 | 流式 |
|---|------|------|-----------|------|------|------|------|------|
| P8 | `POST /api/insight/generate` | AI 业务洞察 | 1500-4000 (分层) | 60-120s | 0.4 | llm_insight_model (qwen3.5-flash) | ✅ InsightCache (1h TTL) | 否 |
| P9 | `POST /api/insight/generate-stream` | 流式 AI 洞察 | 1500-4000 (分层) | 60-120s | 0.2 | llm_insight_model | ✅ InsightCache | ✅ SSE |

**Token 分层策略**:
- Small (rows < 50): max_tokens = 1500
- Medium (50-200 rows): max_tokens = 2500
- Large (rows ≥ 200): max_tokens = 4000

**InsightResultCache** (`common/insight_cache.py`):
- 类型: 内存 TTL 缓存
- Key: `SHA256(upload_id + sheet_index + first-5-rows JSON)[:24]`
- TTL: 3600 秒 (1 小时)
- 最大条目: 200 (LRU 淘汰)

**重试逻辑**:
- 最大重试: 2 次 (LLM_MAX_RETRIES)
- 超时递增: 60s → 75s (base + attempt * 15s)
- 退避: `2^attempt * 2` 秒
- HTTP 4xx/5xx → 重试，全部失败 → 返回空字符串

**DashScope Context Cache**: system prompt 带 `cache_control: ephemeral`，TTFT 从 ~15s → ~0.4s

---

### C. SmartBI 分析链路（enrichSheet 触发）

**文件**: `smartbi/services/` 下各服务，由 `unified_analyzer.py` 并行调度 (`asyncio.gather`)

| # | 服务文件 | 功能 | max_tokens | 超时 | 温度 | 模型 | 缓存 | 流式 |
|---|---------|------|-----------|------|------|------|------|------|
| P10 | `structure/llm_analyzer.py` | 表结构分析 | 2000-8000 (自适应) | 30-180s (自适应) | 0.2 | llm_mapper_model (qwen3.5-122b-a10b) | ❌ 无 | 否 |
| P11 | `field/llm_mapper.py` | 字段映射 | 2000 | httpx 默认 | 0.3 | llm_mapper_model | ❌ 无 | 否 |
| P12 | `field/detector_llm.py` | LLM 字段类型检测 | 2000 | httpx 默认 | 0.3 | llm_fast_model (qwen3.5-flash) | ✅ FieldDetectionCache (1h, 500条) | 否 |
| P13 | `scenario_detector.py` | 场景识别 | 1500 | httpx 默认 | 0.3 | llm_fast_model | ✅ ScenarioCache (1h, 500条) | 否 |
| P14 | `chart/recommender.py` | 图表类型推荐 | 默认 | httpx 默认 | 可变 | 配置模型 | ✅ 结构签名缓存 (1h) | 否 |
| P15 | `data_cleaner.py` | 数据清洗 | 1500-3000 | 30-60s | 未指定 | 配置模型 | ❌ 无 (规则持久化) | 否 |

**P10 自适应计算**:
- max_tokens = BASE_TOKENS + (col_count × 50)，范围 [2000, 8000]
- timeout = BASE_TIMEOUT + (cells/100 × 5)，范围 [30s, 180s]

**P12 FieldDetectionCache**: Key = `MD5(normalized_columns + sample_types)[:16]`
**P13 ScenarioCache**: Key = `MD5(sorted_columns + type_signature)[:16]`，LRU 淘汰 (超容量时清理 10%)

**所有 P10-P14 均有规则 fallback**: LLM 失败时退回基于关键字/正则的检测

---

### D. 跨 Sheet 分析

| # | 端点 | 功能 | max_tokens | 超时 | 模型 | 缓存 | 流式 |
|---|------|------|-----------|------|------|------|------|
| P16 | `POST /api/smartbi/cross-sheet-analysis` | 跨 Sheet LLM 总结 | 默认 | httpx 默认 | 配置模型 | ❌ 无 | 否 |

**文件**: `smartbi/services/cross_sheet_aggregator.py` → `_generate_ai_summary()`
**Fallback**: LLM 失败时返回统计摘要 (`llm_fallback = True`)

---

### E. Chat 系列端点

**文件**: `smartbi/api/chat.py` → `InsightGenerator.generate_insights()` / `_call_llm_stream_text()`

| # | 端点 | 功能 | max_tokens | 超时 | 温度 | 模型 | 缓存 | 流式 |
|---|------|------|-----------|------|------|------|------|------|
| P17a | `POST /api/chat/drill-down` | 图表下钻分析 | 1500-4000 (自适应) | 60-120s | 0.4 | qwen3.5-plus | ❌ 无 (仅数据缓存) | 否 |
| P17b | `POST /api/chat/root-cause` | 根因分析 | 1500-4000 | 60-120s | 0.4 | qwen3.5-plus | ❌ 无 | 否 |
| P17c | `POST /api/chat/general-analysis` | 通用数据查询 | 1500-4000 | 60-120s | 0.2 | qwen3.5-plus | ❌ 无 | ✅ SSE |
| P17d | `POST /api/chat/multi-dimension` | 多维分析 | 1500-4000 | 60-120s | 0.4 | qwen3.5-plus | ❌ 无 | 否 |
| P17e | `POST /api/chat/benchmark` | 行业基准对比 | 1500-4000 | 60-120s | 0.4 | qwen3.5-plus | ❌ 无 | 否 |

**速率限制**: `llm_limiter.llm_rate_limit()` 信号量控制并发

---

### F. 视觉模型（VL）

**文件**: `common/vl_client.py` (QwenVLClient) + 各 service

| # | 模块/方法 | 功能 | 模型 | max_tokens | 超时 | 温度 | 缓存 | DB |
|---|---------|------|------|-----------|------|------|------|-----|
| P18a | `vl_client.py` → `analyze()` | 单图分析 | 自动选择 (效率→vl-plus, OCR/场景→vl-max) | 2000 | 120s | 0.3 | ❌ 无 | ❌ |
| P18a' | `vl_client.py` → `analyze_with_context()` | 双图对比分析 | vl-max | 3000 | 120s | 0.3 | ❌ 无 | ❌ |
| P18b | `efficiency_recognition/scene_understanding_service.py` | 场景理解 v1 | qwen-vl-max / LLM_VL_MODEL_DEEP | 3000 | 120s | 0.2 | 内存 dict | ✅ PG |
| P18c | `scene_intelligence/scene_understanding_service.py` | 场景理解 v2 | qwen-vl-max / VL_MODEL_DEEP_REASONING | 3000 | 120s | 0.3 | 内存 dict | ❌ |
| P18d | `efficiency_recognition/video_analyzer.py` → `analyze_frame()` | 帧效率分析 | qwen-vl-max | 2000 | 120s | 0.3 | ❌ 无 | ❌ |
| P18d' | `video_analyzer.py` → `analyze_ocr()` | 产品标签 OCR | qwen-vl-max | 1500 | 120s | 0.2 | ❌ 无 | ❌ |
| P18d'' | `video_analyzer.py` → `analyze_counting()` | 库存计数 | qwen-vl-max | 1000 | 120s | 0.2 | ❌ 无 | ❌ |
| P18e | `efficiency_recognition/tracking_service.py` | 工人特征提取 | qwen-vl-max | 2000 | 120s | 0.2 | ❌ 无 | ✅ PG |

**视频处理**: FFmpeg 抽帧 (5 秒间隔, 最多 10 帧), JPEG quality 2/100
**特征匹配**: 置信度阈值 0.6, 时间窗口 300s, 工牌权重 0.50 (最高)
**隐私**: 仅体态特征，无人脸识别

---

### G. 客户需求/工厂入驻

**文件**: `client_requirement/ai_consultant.py` (AIConsultant)

| # | 端点/方法 | 功能 | max_tokens | 超时 | 温度 | 模型 | 缓存 | 流式 |
|---|---------|------|-----------|------|------|------|------|------|
| P19a | `POST /wizard/start-module` | AI 顾问初始对话 | 800 | 60s | 0.5 | settings.llm_model (qwen3.5-plus) | ❌ 无 | 否 |
| P19b | `POST /wizard/chat` | 顾问多轮对话 | 800 | 60s | 0.5 | settings.llm_model | ❌ 无 | 否 |
| P19c | `POST /wizard/assessment` | 需求评估生成 | **4000** | 60s | 0.2 | settings.llm_model | ❌ 无 | 否 |

**Fallback**: LLM 不可用时使用 FALLBACK_QUESTIONS 预定义问题
**历史截断**: 保留最近 20 轮对话
**速率限制**: `llm_rate_limit()` 信号量

---

### H. 食品知识库

**文件**: `food_kb/services/reranker.py` (DashScopeReranker)

| # | 功能 | 模型 | API 端点 | 超时 | 缓存 | 备注 |
|---|------|------|---------|------|------|------|
| P20 | Reranker 重排序 | gte-rerank-v2 | `/api/v1/services/rerank/text-rerank/text-rerank` | 15s | ❌ 无 | 非 chat/completions，独立 API |

**限制**: 最大 500 文档，每文档 4000 tokens (截断至 ~1500 字符)
**替代模型**: qwen3-rerank
**错误处理**: 失败时返回原始文档顺序
**统计**: 跟踪 calls_count、error_count、average_latency

---

## 二、Java 后端 LLM 调用清单（12+ 条路径）

### 核心 LLM 客户端: DashScopeClient

**文件**: `ai/client/DashScopeClient.java`
**配置**: `config/DashScopeConfig.java`

| 配置项 | 值 |
|--------|-----|
| baseUrl | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| model (默认) | `qwen3.5-plus` |
| fastModel | `qwen3.5-flash` |
| correctionModel | `qwen-turbo` |
| visionModel | `qwen2.5-vl-3b-instruct` |
| maxTokens | 2000 |
| temperature | 0.7 (normal) / 0.3 (lowTemp) |
| timeout | 60s / thinkingTimeout: 120s |
| thinkingEnabled | true |
| defaultThinkingBudget | 50 (0-100) |

**重试逻辑**: 最大 3 次, 退避 1s→2s→4s, 4xx 不重试, 5xx/IOException 重试
**连接池**: OkHttp 连接复用

| 方法 | 用途 | 温度 | Thinking | 超时 |
|------|------|------|----------|------|
| `chat()` | 通用对话 | 0.7 | **OFF** | 60s |
| `chatLowTemp()` | 精确输出 (分类/解析) | 0.3 | **OFF** | 60s |
| `chatWithThinking()` | 复杂分析 | 0.3 | **ON** (budget) | **120s** |
| `chatCompletionStream()` | 流式响应 | 0.7 | 可选 | **120s** |
| `classifyIntent()` | 意图分类 (= chatLowTemp) | 0.3 | **OFF** | 60s |
| `chatWithTools()` | Function calling 参数提取 | 0.3 | **OFF** | 60s |
| `chatCompletionWithTools()` | 高级 Function calling | 0.3 | **OFF** | 60s |

---

### A. 通用 AI 对话

**文件**: `GenericAIChatController.java`

| # | 端点 | 功能 | LLM 方法 | 模型路由 | 超时 | 缓存 | 流式 |
|---|------|------|---------|---------|------|------|------|
| J1a | `POST /api/mobile/ai/chat` | 通用 AI 对话 | `chatCompletion()` | 自动: thinking→plus, 简单→flash | 60/120s | ❌ 无 | 否 |
| J1b | `POST /api/mobile/ai/chat/stream` | 通用 AI 对话（流式） | `chatCompletionStream()` | 同上 | 120s | ❌ 无 | ✅ SSE |

**模型选择**: `shouldEnableThinking()` 关键词检测
- ≥2 复杂关键词 (分析/对比/为什么/建议/预测/评估...) 或长度>60字 → qwen3.5-plus + thinking
- 简单指令 (你好/谢谢/再见...) 或长度<6字 → qwen3.5-flash
- Thinking ON → max_tokens=2000; OFF → max_tokens=500

**SSE 事件**: `meta` (模型信息) → `token` (内容块) → `done` (完整响应) / `error`

---

### B. 会话对话

**文件**: `ConversationController.java` → `ConversationServiceImpl.java`

| # | 端点 | 功能 | LLM 方法 | 超时 | 缓存 | 流式 |
|---|------|------|---------|------|------|------|
| J2a | `POST /conversation/start` | 开始会话 | `chat()` (temp 0.7) | 60s | ❌ 无 | 否 |
| J2b | `POST /conversation/{id}/reply` | 继续会话 | `chat()` | 60s | ❌ 无 | 否 |
| J2c | `POST /conversation/{id}/confirm` | 确认结束 (无 LLM) | — | — | — | — |
| J2d | `POST /conversation/{id}/cancel` | 取消 (无 LLM) | — | — | — | — |

**触发条件**: 意图识别置信度 < 30% 时启动澄清会话
**语义缓存**: ConversationService 对相同 prompt 有缓存 (line ~462+)

---

### C. 表单助手

**文件**: `FormAssistantController.java` → `FormAssistantService.java`

| # | 端点 | 功能 | LLM 方法 | 模型 | 超时 | 缓存 | 流式 |
|---|------|------|---------|------|------|------|------|
| J3a | `POST /form-assistant/parse` | 表单解析 | `chatWithThinking()` / `chatLowTemp()` | qwen3.5-plus | 60/120s | ❌ 无 | 否 |
| J3b | `POST /form-assistant/parse/stream` | 表单解析（流式） | 同 J3a (SSE 包装) | qwen3.5-plus | 60/120s | ❌ 无 | ✅ SSE |
| J3c | `POST /form-assistant/ocr` | OCR + 解析 | `chatCompletion()` + Vision | **qwen2.5-vl-3b-instruct** | 60s | ❌ 无 | 否 |
| J3d | `POST /form-assistant/generate-schema` | 表单 Schema 生成 | `chatWithThinking()` / `chatLowTemp()` | qwen3.5-plus | 60/120s | ❌ 无 | 否 |

**配额**: J3d 消耗 1 配额单位/次

---

### D. 意图分类（LLM fallback）

**文件**: `AIIntentServiceImpl.java` → `LlmIntentFallbackClientImpl.java`

| # | 功能 | LLM 方法 | 模型 | 超时 | 缓存 |
|---|------|---------|------|------|------|
| J4 | Intent LLM fallback | `classifyIntent()` (= chatLowTemp) | qwen3.5-plus | 60s | ✅ Embedding 缓存 + Intent 配置缓存 |

**调用模式** (可配置切换):
1. **DashScope Direct**: 两阶段 (分类→category, 精确→intent) 或单阶段
2. **Python Service**: HTTP POST to `/api/ai/intent/classify`

**Fallback 链**: DashScope Direct → Python Service → 关键词/正则 → `IntentMatchResult.empty()` / 触发澄清对话

---

### E. 意图执行

**文件**: `IntentExecutorServiceImpl.java`

| # | 功能 | LLM 方法 | 模型 | 超时 | 缓存 |
|---|------|---------|------|------|------|
| J5a | Tool-based 参数提取 (function calling) | `chatWithTools()` | qwen3.5-plus | 60s | ❌ 无 |
| J5b | 流式执行 (咨询路径) | `chatCompletionStream()` | qwen3.5-plus | 120s | ❌ 无 |

**Thinking Mode 执行**:
```
if (enableThinkingMode) → chatWithThinking(budget)
  if (error) → fallback to chat()
else → chat()
```

---

### F. Intent Handlers (额外 LLM 调用点)

**文件**: `service/handler/*.java`

| Handler | LLM 方法 | 用途 | 温度 |
|---------|---------|------|------|
| DataOperationIntentHandler | `chatLowTemp()` | 数据操作解析 | 0.3 |
| DecorationIntentHandler | `chatLowTemp()` | 装饰/布局定制 | 0.3 |
| FoodKnowledgeIntentHandler | `chat()` | RAG 无结果时 fallback | 0.7 |
| FormIntentHandler | `chatLowTemp()` | 表单生成解析 | 0.3 |
| PageDesignIntentHandler | `chatLowTemp()` (多次) | 页面设计解析 | 0.3 |
| ScaleDeviceIntentHandler | Vision (`DashScopeVisionClient`) | 设备铭牌识别 | 0.3 |

---

## 三、缓存状态全景

| 状态 | 路径 | 数量 | 占比 |
|------|------|------|------|
| ✅ 应用层结果缓存 | P8/P9 (InsightCache), P12 (FieldDetectionCache), P13 (ScenarioCache), P14 (ChartCache) | 5 | 14.7% |
| 🟡 DashScope prompt cache only | P1-P7 (ai_proxy), P8/P9 (insight system prompt) | 9 | 26.5% |
| 🟡 内存 dict (非 LLM 结果) | P18b/P18c (scene_understandings) | 2 | 5.9% |
| 🔵 嵌入/配置缓存 (非 LLM 结果) | J4 (embedding + intent config) | 1 | 2.9% |
| ❌ 完全无缓存 | 其余全部 | 17 | 50.0% |
| **合计** | | **34** | |

### 缓存机制详情

| 缓存名称 | 类型 | Key 策略 | TTL | 容量 | 命中率预估 |
|----------|------|---------|-----|------|----------|
| InsightResultCache | 内存 TTL | SHA256(upload_id + sheet + rows)[:24] | 1h | 200 | 高 (重复查看) |
| FieldDetectionCache | 内存 TTL | MD5(columns + types)[:16] | 1h | 500 | 中 (结构相同) |
| ScenarioCache | 内存 LRU+TTL | MD5(sorted_cols + types)[:16] | 1h | 500 | 中-高 |
| ChartRecommendCache | 内存 TTL | columns + sample data | 1h | — | 中 |
| DashScope Ephemeral | API 层 | system prompt hash (自动) | 5min | 无限 | 高 (相同 prompt) |

---

## 四、延迟 TOP 10 热力图

| 排名 | 路径 | 最大延迟 | 典型延迟 | 原因 | 用户感知 |
|------|------|---------|---------|------|---------|
| 1 | P18d 视频多帧分析 | **40s+** | 15-25s | 多帧 VL 调用 (最多 10 帧 × 120s/帧) | 明显等待 |
| 2 | P10 表结构分析 (大文件) | **180s** | 5-30s | 自适应 timeout，大 Excel 列多 | 首次上传 |
| 3 | P18c 场景理解 v2 | **20s** | 10-15s | VL max/deep 模型 | 可接受 |
| 4 | P8 Insight 生成 (无缓存) | **120s** | 5-15s | 重试最大 60+75=135s | 首次生成 |
| 5 | P15 数据清洗 | **15s** | 5-10s | 多次 LLM 调用 (问题识别+规则生成) | 可优化 |
| 6 | P17a-e Chat 系列 | **120s** | 5-15s | 同 Insight 引擎，无结果缓存 | 每次等待 |
| 7 | J3c OCR 解析 | **20s** | 8-15s | Vision model + 图像处理 | 可接受 |
| 8 | P19c 需求评估 | **60s** | 8-15s | 4000 tokens 完整评估 | 一次性 |
| 9 | J5a Function Calling | **60s** | 3-8s | 参数提取 + 工具调用 | 可接受 |
| 10 | P16 跨 Sheet 分析 | **60s** | 3-8s | 无超时限制 (httpx 默认) | 每次等待 |

---

## 五、模型使用矩阵

| 模型 | 配置名 | 使用场景 | 路径数 |
|------|--------|---------|--------|
| `qwen3.5-plus-2026-02-15` | llm_model (Python) / model (Java) | AI Proxy, Chat, 意图, 对话, 表单, 顾问 | 18 |
| `qwen3.5-flash` | llm_fast_model / fastModel | 字段检测, 场景识别, 简单查询 | 4 |
| `qwen3.5-122b-a10b` | llm_mapper_model | 表结构分析, 字段映射 | 2 |
| `qwen3.5-27b` | llm_chart_model | 图表推荐 | 1 |
| `qwen-vl-max` | llm_vl_model | 场景理解, 视频分析, 追踪 | 6 |
| `qwen-vl-plus` | — | 效率分析 (成本优化) | 1 |
| `qwen2.5-vl-3b-instruct` | visionModel (Java) | OCR, 铭牌识别 | 2 |
| `qwen-turbo` | correctionModel | Correction Agent 结果修正 | 1 |
| `gte-rerank-v2` | — | 食品知识库重排序 | 1 |

---

## 六、已实施优化清单

| # | 优化措施 | 位置 | 效果 |
|---|---------|------|------|
| 1 | 共享 HTTP 连接池 | `common/llm_client.py` | 节省 ~200ms/次 (DNS+TLS) |
| 2 | Insight 结果缓存 | `common/insight_cache.py` | 重复查看 5-15s → 5ms |
| 3 | DashScope prompt cache | ai_proxy 全部端点 + insight | TTFT 降低，token 费用降低 |
| 4 | 场景+图表推荐缓存 | scenario_detector + chart_recommender | 相同结构文件 0 延迟 |
| 5 | 字段检测缓存 | field/detector_llm.py | 相同列结构复用 |
| 6 | Thinking 模式自动检测 | Java `shouldEnableThinking()` | 简单 query 用 flash (更快) |
| 7 | Token 分层 | insight_generator.py | 小文件仅 1500 tokens |
| 8 | 速率限制 | `llm_limiter.py` 信号量 | 防止 API 过载 |
| 9 | LLM client warmup | `init_llm_client()` | 首次请求无冷启动 |
| 10 | OkHttp 连接池 | Java DashScopeClient | TCP 连接复用 |

---

## 七、待优化机会（按用户体验影响排序）

| 优先级 | 路径 | 问题 | 优化方案 | 预期效果 |
|--------|------|------|---------|---------|
| **P0** | P10 结构分析 | 每次上传都重新分析，最大 180s | 结构签名缓存 (同 P12/P13 模式) | 重复上传 30s → 0s |
| **P0** | P11 字段映射 | 无缓存，无显式超时 | 添加缓存 + 30s 超时 | 重复分析 5s → 0s |
| **P1** | P17a-e Chat 系列 | 每次问答都调 LLM，无结果缓存 | InsightCache 集成 (传 upload_id) | 重复问题 15s → 5ms |
| **P1** | P16 跨 Sheet 分析 | 无缓存，无显式超时 | 结果缓存 (upload_id 维度) + 60s 超时 | 重复查看 8s → 0s |
| **P2** | J1a 通用 AI 对话 | 无缓存 | 常见问答语义缓存 | 重复问题 10s → 0s |
| **P2** | P15 数据清洗 | 多次 LLM 调用，问题识别无缓存 | 缓存 issue 识别结果 | 重复上传 15s → 3s |
| **P2** | P11 字段映射 | 无显式超时 (httpx 默认 ~5min) | 设置 30s 超时防止挂死 | 避免无限等待 |
| **P3** | P1-P7 AI Proxy | 仅 prompt cache，无应用层结果缓存 | 相同输入结果缓存 (LRU + TTL) | 重复请求 5s → 0s |
| **P3** | VL 系列 (P18) | 所有 VL 调用无缓存 | 帧级结果缓存 (图片 hash) | 重复分析 20s → 0s |
| **P3** | P16/P17 | 无显式超时 | 统一 60s 超时 | 避免 httpx 默认 5min 挂死 |

---

## 八、验证方法

此审计为只读分析。验证完整覆盖的命令:

```bash
# Python: 检查所有 LLM 调用点
grep -r "chat/completions\|_call_llm\|generate_insights\|rerank" backend/python/ --include="*.py" | grep -v __pycache__ | wc -l

# Java: 检查所有 DashScopeClient 调用
grep -r "chatCompletion\|chatLowTemp\|chatWithThinking\|chatWithTools\|classifyIntent" backend/java/ --include="*.java" | wc -l

# 线上日志验证实际调用频率
ssh root@47.100.235.168 "grep 'HTTP Request: POST.*dashscope' /www/wwwroot/cretas/python-prod.log | tail -50"
```

---

## 附录 A: Java 端补充 LLM 调用路径 (Grep 二次验证)

初始审计覆盖了 J1-J5 和 Intent Handler 共 12 条主路径。Grep 二次验证发现以下额外 LLM 调用点（均在意图执行管线内部，用户间接等待）：

| # | 文件 | 方法 | LLM 调用 | 用途 | 温度 | 用户等待影响 |
|---|------|------|---------|------|------|------------|
| J6 | `SmallLlmComplexityDetectorImpl` | `detectComplexity()` | `chatLowTemp()` | 查询复杂度检测 (路由 thinking/flash) | 0.3 | 管线内部，增加 ~2-5s |
| J7 | `QueryPreprocessorServiceImpl` | `rewrite()` | `chatLowTemp()` | 查询改写 (纠正/规范化) | 0.3 | 管线内部，增加 ~2-5s |
| J8 | `ResultValidatorServiceImpl` | `validateSemantic()` | `chatLowTemp()` | 执行结果语义验证 | 0.3 | 管线内部，增加 ~2-5s |
| J9 | `CorrectionAgentServiceImpl` | `correct()` | `chatCompletion()` | CRITIC 风格结果修正 | correctionModel (qwen-turbo) | 管线内部，增加 ~2-5s |
| J10 | `LongTextHandlerImpl` | `summarize()` | `chatCompletion()` (max_tokens=200) | 长文本摘要 | 0.3 | 管线内部，增加 ~1-3s |
| J11 | `AnalysisRouterServiceImpl` | `analyze()` | `chatWithThinking()` / `chat()` | 数据分析路由 (SmartBI→LLM) | 可选 thinking | 管线内部，增加 ~3-15s |
| J12 | `LLMFieldMappingServiceImpl` | `mapField()` / `batchMap()` | `chatLowTemp()` ×2 | 字段映射 (单字段+批量) | 0.3 | SmartBI 链路，增加 ~3-8s |
| J13 | `AdaptiveChartGeneratorImpl` | `generateChart()` | `chatLowTemp()` | ECharts 配置生成 | 0.3 | SmartBI 链路，增加 ~3-8s |
| J14 | `ChartSufficiencyEvaluatorImpl` | `evaluate()` ×2 | `chatLowTemp()` | 图表充分性评估 (初始+详细) | 0.3 | SmartBI 链路，增加 ~3-8s |
| J15 | `IntentDisambiguationService` | `disambiguate()` | `chatCompletion()` (temp=0.1) | 意图消歧 | 0.1 | 管线内部，增加 ~2-5s |
| J16 | `AIAnalysisService` | `analyze()` | `chatWithThinking()` / `chat()` | 通用 AI 分析 | 可选 thinking | 管线内部，增加 ~3-15s |
| J17 | `SopParseDocumentTool` | `parseDocument()` ×2 | `chatCompletion()` + Vision | SOP 文档解析 (图片+文本) | 0.3 | 工具执行，增加 ~5-15s |

**重要说明**: J6-J17 不是独立的用户面端点，而是 J4/J5 意图管线或 SmartBI 链路中的内部 LLM 调用。一次用户请求可能触发多个串行 LLM 调用。

### 意图执行管线最坏路径（串行 LLM 调用）

```
用户输入 → J6 复杂度检测 (2-5s)
         → J7 查询改写 (2-5s)
         → J4 意图分类 (2-5s, 可能两阶段)
         → J15 意图消歧 (2-5s, 如有歧义)
         → J5a 参数提取 (3-8s, function calling)
         → [执行业务逻辑]
         → J8 结果验证 (2-5s)
         → J9 结果修正 (2-5s, 如需要)
         → J10 长文本摘要 (1-3s, 如超长)
最坏总延迟: 18-46s (不含业务逻辑执行时间)
```

---

## 附录 B: Python 端补充说明

Grep 二次验证发现以下额外文件匹配 LLM 调用模式：

| 文件 | 说明 | 是否新增 LLM 路径 |
|------|------|----------------|
| `food_kb/services/query_rewriter.py` | 查询改写 | 否 (仅引用 generate_insights，不直接调 LLM) |
| `food_kb/services/knowledge_retriever.py` | 知识检索 | 否 (仅用向量检索，不调 LLM) |
| `chat/api/routes.py` | Chat 路由 | 否 (调用 InsightGenerator.generate_insights，已在 P17 覆盖) |
| `smartbi/api/excel.py` | Excel 路由 | 否 (仅引用 generate_insights 在 enrichSheet 中) |
| `smartbi/services/llm_structure_analyzer.py` | 旧版结构分析 | 否 (被 `structure/llm_analyzer.py` 取代) |
| `smartbi/services/llm_mapper.py` | 旧版字段映射 | 否 (被 `field/llm_mapper.py` 取代) |
| `smartbi/services/field_detector_llm.py` | 旧版字段检测 | 否 (被 `field/detector_llm.py` 取代) |

---

## 附录 C: 修正后的总量统计

| 类别 | 数量 |
|------|------|
| Python 用户面 LLM 路径 | 20 条 (P1-P20) |
| Java 用户面 LLM 路径 | 12 条 (J1-J5 含子路径) |
| Java 管线内部 LLM 路径 | 12 条 (J6-J17) |
| **全部 LLM 调用点** | **44 条** |
| 有应用层缓存 | 5 条 (14.7% of 用户面) |
| 有 DashScope prompt cache | 9 条 (28.1% of 用户面) |
| 完全无缓存 | 18 条 (56.2% of 用户面) |

---

## 附录 D: Python 模型配置完整表

**文件**: `backend/python/smartbi/config.py`

| 配置项 | 值 | 用途 |
|--------|-----|------|
| `llm_model` | `qwen3.5-plus-2026-02-15` | AI Proxy, Chat, 顾问 |
| `llm_fast_model` | `qwen3.5-flash` | 字段检测, 场景识别 |
| `llm_insight_model` | `qwen3.5-flash` | Insight 生成 |
| `llm_chart_model` | `qwen3.5-27b` | 图表推荐 |
| `llm_mapper_model` | `qwen3.5-122b-a10b` | 表结构, 字段映射 |
| `llm_reasoning_model` | `qwen3.5-397b-a17b` | 推理 (未使用) |
| `llm_vl_model` | `qwen-vl-max` | VL 分析 |
| `llm_base_url` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | API 基础 URL |
