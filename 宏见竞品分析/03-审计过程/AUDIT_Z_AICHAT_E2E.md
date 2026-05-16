# AUDIT Z — AIChat 端到端真实流程

**追溯目标**: 用户在 AIChatScreen 输入 "查询今天的生产任务" → SSE 流 → 意图识别 → Tool → 业务数据 → 富组件渲染。
**审计基线**: 不为证明可用而粉饰，stub 直报 stub；声明 vs 实现差异显式标注。
**审计日期**: 2026-05-14

---

## §1 8 步流程审计表

| # | 步骤 | 入口文件:行 | verdict | 关键代码 |
|---|------|-------------|---------|----------|
| 1 | **前端发起 handleSend()** | `frontend/CretasFoodTrace/src/screens/factory-admin/ai-analysis/AIChatScreen.tsx:323` | ✅ 完整可用 | L611: `await aiApiClient.executeIntentStream(messageText, callbacks, factoryId, entityType);` — 注册 **11 个回调** (onStart/onCacheHit/onCacheMiss/onProgress/onIntentRecognized/onExecuting/onMeta/onToken/onResult/onComplete/onError)。`isLoading` + 占位 message 后逐 token 累积 (L422–434 `setMessages(...content: streamedContent`)。 |
| 2 | **API 客户端 SSE** | `frontend/CretasFoodTrace/src/services/api/aiApiClient.ts:993` | ⚠️ 主路径可用，sessionId 缺 | L5 `import EventSource from 'react-native-sse';`。L1019–1028: `new EventSource<SSEEventNames>(fullUrl, { method: 'POST', body: JSON.stringify({ userInput, ...(entityType && { entityType }) }), pollingInterval: 0 })`。**body 不含 sessionId** — SSE 路径无多轮上下文。11 个 `addEventListener` 与回调一一对应 (L1036–1145)。 |
| 3 | **后端入口 Controller** | `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/AIIntentConfigController.java:254` | ✅ 完整可用 | `@PostMapping(value = "/execute/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)` 路径 `/api/mobile/{factoryId}/ai-intents/execute/stream`。L257 `public SseEmitter executeIntentStream(...)` 委托给 `intentExecutorService.executeStream` (L273)。`@RateLimit(count=20, period=60, USER)` 真生效。`@RequirePermission({"system:read_write"})`。 |
| 4 | **意图识别 8 路管道** | `service/impl/AIIntentServiceImpl.java:288` + `service/intent/impl/IntentRecognitionPipelineServiceImpl.java:418` | ⚠️ 8 路其中 6 路真实，PHRASE_MATCH/KEYWORD 大量复用走"语义优先"分支 | `AIIntentServiceImpl.recognizeIntentWithConfidence` (L288–374)：先检查 Python matcher feature flag (Phase 2B canary, L294–358)，未启用则委托给 `pipelineService.recognizeIntentWithConfidence`。Pipeline 真实分支落点 (grep `MatchMethod.*`)：EXACT (L1129 hash 表，`expressionLearningService.matchExactExpression`)、PHRASE_MATCH (L448 v33.1 早期短语)、SEMANTIC (L5147 `embeddingClient.encode`)、FUSION (L5147 阈值落 medium 时降级)、CLASSIFIER (L1230 `multiLabelIntentClassifier.classifyMultiLabel`)、LLM (L2260 `llmFallbackClient.classifyIntent`)。**REGEX/KEYWORD 没有独立分支，按 v6.0 架构合并入语义评分项 (L1158–1162 注释明示"v7.0 移除短语映射优先检查")**。 |
| 5 | **SSE 路由执行 4 分支** | `service/execution/SseStreamingService.java:130` + `service/execution/IntentExecutionOrchestrator.java:161` | ✅ 完整可用 | SSE 路径：L214 调 `aiIntentService.recognizeIntentWithConfidence`，根据 `matchResult` 决定走 cache_hit 直接复用 (L173–185)、Skill 优先 (L267 `dynamicToolSelectionService.trySkillRoute`，**16 个内置 Skill + 数据库 SmartBiSkill**)、Slot Filling (L288 缺参补全)、最终 `executeAndStreamResult` (L312) 调 Tool。**ToolDirect / Skill / Dynamic / NoMatch 4 分支由 Orchestrator L288–314 投递，并通过 `branchToolDirect.incrementAndGet()` (L264/L291/L301) 真实计数到 Prometheus。** |
| 6 | **Tool 执行 (查询生产批次)** | `ai/tool/impl/processing/ProcessingBatchListTool.java:97` + `ai/tool/AbstractBusinessTool.java:68` | ✅ 完整可用，真查 DB | `doExecute` L111 `pageResponse = processingService.getBatches(factoryId, status, pageRequest)` — 真实 JPA 查询。L114–132 将每个 `ProductionBatch` entity 映射为 dict (batchId / batchNumber / productName / status / plannedQuantity / yieldRate / supervisorName / startTime …)。`AbstractBusinessTool.execute` L68–100 包裹完整 try-catch + `sanitizeErrorMessage`，**IllegalArgumentException → "参数验证失败"**, 其他 → `buildSanitizedErrorResult`，不暴露堆栈。 |
| 7 | **响应组装 IntentExecuteResponse** | `dto/ai/IntentExecuteResponse.java:30` | ✅ 完整字段，但缺 candidates | 字段：`intentRecognized / intentCode / intentName / intentCategory / confidence / matchMethod / status / message / formattedText / clarificationQuestions / missingParameters / resultData / affectedEntities / suggestedActions / fromCache / cacheHitType / sessionId / conversationRound / subResults / validationResultInfo`。**`candidates` 字段不在 DTO 中** — 前端 AIChatScreen L499 期待 `result.candidates`，实际后端通过 `topCandidates` 字段写在 `IntentMatchResult` 内，再被 SseStreamingService 在 `intent_recognized` event 中部分透出 (`matchMethod` only)。前端候选解析会取到 `undefined`，回落到 `suggestedActions`。 |
| 8 | **前端渲染 RichContentRenderer** | `components/ai/RichContentRenderer.tsx:26` + `screens/.../AIChatScreen.tsx:524` | ✅ 完整可用 | `detectRichData()` L26–59：识别 5 类 — LIST (`content` 数组 + `totalElements`，来自 `buildPageResult`)、CONFIRM (status=PREVIEW/PAGINATION_READY)、STATS (`totalOrders/totalAmount/statusCounts`)、DETAIL (`orderId/planId/batchId/transferId`)、否则返回 undefined。`ProcessingBatchListTool` L135 调 `buildPageResult` → 真实 LIST 渲染。L80–128 `ListRenderer` 自动从首项推断 5 列，最多 10 行，附 "共 N 条·第 X/Y 页·说"下一页"查看更多"。 |

---

## §2 真实流的可演示能力

**可以拿去 demo 的环节** (经源码核实)：

1. **真 SSE 逐 token 流** — 路径 `Python /api/llm/chat-stream → Java PythonLLMClient (PythonLLMClient.java L122) → SseStreamingService L489 `emitter.send(SseEmitter.event().name("token").data(token))` → react-native-sse 的 `addEventListener('token')` → setMessages 累加`。一般咨询问题 (questionType=GENERAL_QUESTION) 会真走 LLM token 流。**业务意图 (DATA_OPERATION) 不走 token 流**，而是先 `progress / intent_recognized / executing`，最后一次性 `result` event。

2. **真意图识别管道** — 6 路真实分支 + 1 个 LLM 兜底（`LlmIntentFallbackClient.classifyIntent`，DashScopeClient L29 是 shim，全部转发 `PythonLLMClient → Python /api/llm/intent-classify → 通义千问/DeepSeek 4-provider 路由`）。EXACT/PHRASE_MATCH/SEMANTIC/FUSION/CLASSIFIER/LLM 都有独立 `MatchMethod` enum 值并真实写库 (`saveIntentMatchRecord` L1146/1185/2212/2227)。**Phase 2B 还在做 Python matcher canary** (AIIntentServiceImpl L294)，但默认走 legacy Java pipeline。

3. **真 Embedding gRPC** — `GrpcEmbeddingClient.java L31 @Service @ConditionalOnProperty(name = "embedding.mode", havingValue = "grpc")`，启动 `@PostConstruct` 真实健康检查 `embeddingStub.healthCheck` → 端口 9090。失败回落 `NoOpEmbeddingClient`（embedding-disabled 模式，SEMANTIC/FUSION 分支会被跳过）。

4. **真 Tool 业务查询** — `ProcessingBatchListTool` 真调 `processingService.getBatches` JPA 查 PostgreSQL `production_batches` 表。返回结构通过 `buildPageResult` 形成 `{content:[], totalElements, totalPages, currentPage, hasMore}`，前端 RichContentRenderer 真渲染表格。**337+ Tool 全部 @Component 自动注册到 ToolRegistry**（CLAUDE.md 数据，与 `find tool/impl/*.java | wc -l = 404` 一致级别）。

5. **真 Skill 编排** — `SkillRegistryImpl.java L99 @PostConstruct` 注册 16+ 内置 Skill (inventory-analysis / production-tracking / quality-inspection / material-batch 等，每个绑定 3-5 个 tool)。SSE 路径 L267 `trySkillRoute` 在 Tool 之前优先匹配。

**不能拿去 demo 的环节**：

1. ❌ **多轮上下文在 SSE 路径缺失** — `aiApiClient.executeIntentStream` L1026 body `{userInput, entityType}` **不含 sessionId**。后端 `SseStreamingService.executeStreamAsync` L214 调 `aiIntentService.recognizeIntentWithConfidence(... request.getSessionId())` 传的是 request DTO 里的 sessionId，但前端从未填。非 SSE 的 `executeIntent` (`@PostMapping("/execute")` Controller L205) 才支持，但 AIChatScreen 不用这条路径。

2. ⚠️ **"5 分钟 TTL"是 IntentResultCache (Caffeine)，不是 Redis** — CLAUDE.md 提到的 AI 缓存 5 分钟 TTL，实测 `IntentResultCache.java:64-72` 是 `Caffeine.newBuilder().expireAfterWrite(Duration.ofSeconds(ttlSeconds))`，**进程内缓存**，重启即丢，多实例不共享。真正持久缓存是 `SemanticCacheServiceImpl` 用 JPA 表 `semantic_cache` (entity L29-35)，TTL 单位是**小时** `plusHours(config.getCacheTtlHours())` L170。**没有 Redis 层托管 AI 结果**，Redis (`CacheService.java`) 只用于 batch 业务数据缓存。

3. ⚠️ **流式响应只在通用咨询走真 token 流** — 业务意图（DATA_OPERATION 等）SSE 只发 `progress / intent_recognized / executing / result / complete` 几个事件，Tool 执行是同步阻塞的 (`executeAndStreamResult` L312)。前端 `onToken` 回调注册了，但业务路径不会触发。**对客户而言这看起来像"假流式"** — 用户输入业务问题，UI 只能看到状态切换，最后一次性出结果，**没有打字机效果**。

4. ❌ **candidates 字段前后端不对齐** — 前端 `AIChatScreen.tsx:499` 期待 `result.candidates`，DTO `IntentExecuteResponse.java` 无此字段（只有 `suggestedActions / subResults`）。`IntentMatchResult.topCandidates` 在意图识别阶段存在，但 SSE 通过 `intent_recognized` event 只透出 `matchMethod`，不下发候选列表。**结果**：用户输入模糊时，UI 期待显示意图候选，实际只能落回 `suggestedActions` (来自 `SlotFilling` 或 LLM 显式构造)。

---

## §3 vs 宏见传统 ERP "无 AI 仅菜单" 的根本差异

| 维度 | 宏见传统 ERP | Cretas AIChat (真实实现) |
|------|--------------|--------------------------|
| **入口方式** | 多级菜单（"生产管理 → 批次列表 → 状态筛选 → 提交查询"，4-6 次点击） | 自然语言一句"查询今天的生产任务" |
| **意图理解** | 无 — 用户必须找到正确菜单项 | **6 路真实分支** (EXACT 哈希 / PHRASE 短语库 / SEMANTIC 向量 / FUSION / CLASSIFIER ONNX / LLM 兜底) + 1 路 Python canary。意图识别命中 → ToolName → 执行业务 |
| **数据查询** | 固定 SQL 报表，参数靠表单 | 337+ Tool 注册 `@Component`，每个 Tool 有 `parameterSchema` JSON Schema，LLM 真 function-calling 抽取参数 → 调 JPA Service |
| **结果展示** | 固定 grid，HTML 表格 | `RichContentRenderer` 自动从 `resultData` shape 推断 LIST/DETAIL/STATS/CONFIRM 4 种渲染，移动端自适应 5 列 × 10 行 |
| **缺参处理** | 表单 required 校验，弹窗"必填" | `SlotFillingService` (L286) + LLM 生成自然语言澄清问题 (`clarificationQuestions[]`)，多轮收集 |
| **多轮对话** | 无 — 每次操作独立 | DTO `sessionId / conversationRound / maxConversationRounds` + `ConversationMemoryService` JPA 持久化。**但 AIChat 的 SSE 路径前端没传 sessionId**（见 §2 缺陷 1） |
| **错误反馈** | "查询失败 (HTTP 500)" 或弹窗堆栈 | `ErrorSanitizer.sanitize(e)` (`SseStreamingService.java:318`) + Tool 层 `buildSanitizedErrorResult`。前端 `onError` 显示 i18n 错误文案 |
| **可扩展性** | 加新功能 = 加菜单 + 加页面 + 加接口 | 加新 Tool = 1 个 `@Component` 类继承 `AbstractBusinessTool`，重启自动注册到 `ToolRegistry`，不需要前端改动 |
| **真实性** | 100% 显式（菜单全在） | **混合**：流式 token / 意图识别 / Tool 执行 / 富渲染 = 真；多轮对话 SSE 缺 sessionId / candidates 字段不对齐 / "5分钟 Redis 缓存"实际是 JVM Caffeine = 声明 vs 实现差距 |

**结论**：与宏见对比，Cretas AIChat 在 **入口、意图识别、Tool 调度、富渲染** 4 个核心环节都有真实代码支撑，不是 demo 摆设。但仍有 4 处 ⚠️/❌ 待修：
1. SSE 多轮 sessionId 未传递（前端缺）
2. 业务意图无真 token 流（用户体感"假流式"）
3. AI 缓存层非 Redis（架构文档与实现不一致）
4. candidates 字段前后端不对齐（影响澄清场景 UX）

这 4 处都是**架构正确 + 局部接线漏掉**的状态，不是 stub，修复成本 < 1 天/项。

---

## 关键文件清单（绝对路径）

| 层 | 文件 |
|---|---|
| 前端 Screen | `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\ai-analysis\AIChatScreen.tsx` (1251 行) |
| 前端 API client | `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\services\api\aiApiClient.ts` (1176 行) |
| 前端富渲染 | `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ai\RichContentRenderer.tsx` (230 行) |
| 后端 Controller | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\controller\AIIntentConfigController.java` |
| 后端 Facade | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\impl\IntentExecutorServiceImpl.java` (69 行 facade) |
| 后端 Orchestrator | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\execution\IntentExecutionOrchestrator.java` (1272 行) |
| 后端 SSE 服务 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\execution\SseStreamingService.java` (619 行) |
| 后端识别 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\impl\AIIntentServiceImpl.java` + `service\intent\impl\IntentRecognitionPipelineServiceImpl.java` (5383 行) |
| 后端 Tool 示例 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\processing\ProcessingBatchListTool.java` |
| 后端 Tool 基类 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\AbstractBusinessTool.java` |
| 后端 LLM 客户端 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\client\DashScopeClient.java` (shim) + `PythonLLMClient.java` (真客户端) |
| 后端 Embedding | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\impl\GrpcEmbeddingClient.java` |
| 后端语义缓存 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\impl\SemanticCacheServiceImpl.java` |
| 后端意图缓存 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\cache\IntentResultCache.java` (Caffeine JVM 内) |
| 后端 Skill 注册 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\skill\impl\SkillRegistryImpl.java` |
| DTO 响应 | `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\dto\ai\IntentExecuteResponse.java` |
