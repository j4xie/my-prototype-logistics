# Tool Calling 使用示例

## 场景描述

用户输入无法匹配现有意图时，系统将启动 Tool Calling 流程，询问 LLM 是否应该创建新的意图配置。

## 工作流程

### 1. 初始意图分类

```
用户输入: "我想查看碳排放数据"
↓
LLM 意图分类: 返回 "CARBON_FOOTPRINT_QUERY" (不在已知意图列表中)
↓
matchedConfig == null
```

### 2. 启动 Tool Calling

```java
// LlmIntentFallbackClientImpl.parseDirectClassifyResponse()
if (matchedConfig == null) {
    if (shouldUseToolCalling()) {
        return tryCreateIntentViaToolCalling(...);
    }
}
```

### 3. 构建提示词

系统自动构建提示词：

```
你是一个智能意图识别助手。用户的输入无法匹配现有的意图配置。

## 当前情况

- 用户输入: "我想查看碳排放数据"
- 首次分类结果: CARBON_FOOTPRINT_QUERY (不在已知列表中)
- 推理说明: 用户明确表达了查询碳排放数据的需求

## 已有意图列表

- QUERY_MATERIAL (查询原料): 查询原料批次信息
- QUERY_PRODUCTION (查询生产): 查询生产记录
- QUERY_QUALITY (查询质量): 查询质量检测记录
...

## 你的任务

请判断是否需要创建新的意图配置。如果用户的需求确实是一个新的功能模式，调用 `create_new_intent` 工具。
如果用户的需求可能是错误输入、或不应该作为独立意图，则不要调用任何工具。

## 决策标准

创建新意图的条件：
- 用户描述了明确的功能需求
- 该需求在现有意图列表中找不到相似项
- 该需求具有可重复性（不是一次性的特殊请求）

不创建新意图的情况：
- 用户输入过于模糊或无意义
- 用户可能是在测试系统
- 用户的需求可以通过现有意图满足（只是表达方式不同）
```

### 4. LLM 决策

#### 场景 A: LLM 决定创建新意图

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "根据用户的明确需求，建议创建新的意图配置来处理碳排放数据查询。",
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "create_new_intent",
          "arguments": "{\"intentCode\":\"CARBON_FOOTPRINT_QUERY\",\"intentName\":\"查询碳排放\",\"category\":\"QUERY\",\"keywords\":[\"碳排放\",\"碳足迹\",\"排放数据\"],\"description\":\"查询企业或产品的碳排放数据\"}"
        }
      }]
    }
  }]
}
```

**日志输出**:
```
[Tool Calling] Calling DashScope with 6 tools
[Tool Calling] LLM requested 1 tool calls
[Tool Calling] Executing tool: create_new_intent
[Tool Calling] Tool execution result: {"success":true,"data":{"intentCode":"CARBON_FOOTPRINT_QUERY",...}}
```

**结果**: 创建新的意图配置（待审核状态）

#### 场景 B: LLM 决定不创建

用户输入: "asdfgh"

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "用户输入无意义，不建议创建新意图。"
    }
  }]
}
```

**日志输出**:
```
[Tool Calling] Calling DashScope with 6 tools
[Tool Calling] LLM decided NOT to create new intent
```

**结果**: 返回空匹配结果

### 5. 工具执行

```java
// CreateIntentTool.execute()
AIIntentConfig intentConfig = new AIIntentConfig();
intentConfig.setIntentCode("CARBON_FOOTPRINT_QUERY");
intentConfig.setIntentName("查询碳排放");
intentConfig.setIntentCategory("QUERY");
intentConfig.setKeywords("[\"碳排放\",\"碳足迹\",\"排放数据\"]");
intentConfig.setActive(false);  // 待审核状态

AIIntentConfig created = aiIntentService.createIntent(intentConfig);
```

### 6. 返回结果

```java
return IntentMatchResult.builder()
    .userInput(userInput)
    .confidence(0.0)
    .matchMethod(MatchMethod.LLM)
    .isStrongSignal(false)
    .requiresConfirmation(true)
    .clarificationQuestion("已创建新的意图配置，等待管理员审核激活后即可使用。")
    .build();
```

## 降级场景

### 场景 1: ToolRegistry 未启动

```java
if (toolRegistry == null || !toolRegistry.hasExecutor("create_new_intent")) {
    log.warn("[Legacy Mode] Tool Calling unavailable, using hardcoded logic");
    // 使用旧的硬编码逻辑
    tryCreateIntentSuggestion(...);
}
```

### 场景 2: DashScopeClient 不可用

```java
if (dashScopeClient == null || !dashScopeClient.isAvailable()) {
    // 降级到 Python 服务或旧逻辑
}
```

## 完整请求示例

### ChatCompletionRequest

```java
ChatCompletionRequest request = ChatCompletionRequest.builder()
    .model("qwen-plus")
    .messages(List.of(
        ChatMessage.system("你是一个智能意图识别助手..."),
        ChatMessage.user("我想查看碳排放数据")
    ))
    .tools(List.of(
        Tool.of("create_new_intent", "创建新的意图配置", createIntentSchema),
        Tool.of("update_intent", "更新现有意图配置", updateIntentSchema),
        // ... 其他工具
    ))
    .toolChoice("auto")  // LLM 自主决定
    .maxTokens(2000)
    .temperature(0.1)  // 低温度确保稳定性
    .build();
```

### ChatCompletionResponse

```java
ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

if (response.hasError()) {
    // 处理错误
}

List<ToolCall> toolCalls = response.getChoices().get(0)
    .getMessage().getToolCalls();

if (toolCalls != null && !toolCalls.isEmpty()) {
    for (ToolCall toolCall : toolCalls) {
        ToolExecutor executor = toolRegistry.getExecutor(
            toolCall.getFunction().getName()
        ).orElse(null);

        if (executor != null) {
            String result = executor.execute(toolCall, context);
            log.info("Tool execution result: {}", result);
        }
    }
}
```

## 日志监控

### 正常流程日志

```
[INFO ] Tool Calling mode ENABLED - will use create_new_intent tool instead of hardcoded logic
[INFO ] Calling LLM fallback for intent classification: factoryId=F001, input='我想查看碳排放数据'
[WARN ] DashScope returned unknown intent code: 'CARBON_FOOTPRINT_QUERY'
[INFO ] [Tool Calling] Intent not matched, asking LLM whether to create new intent
[DEBUG] [Tool Calling] Starting tool calling workflow for intent creation
[DEBUG] [Tool Calling] Available tools: [create_new_intent, update_intent, query_entity_schema, ...]
[INFO ] [Tool Calling] Calling DashScope with 6 tools
[INFO ] [Tool Calling] LLM requested 1 tool calls
[INFO ] [Tool Calling] Executing tool: create_new_intent
[INFO ] ✅ 注册工具: name=create_new_intent, class=CreateIntentTool, requiresPermission=true
[INFO ] [Tool Calling] Tool execution result: {"success":true,"data":{...}}
```

### 降级流程日志

```
[INFO ] Tool Calling mode DISABLED - fallback to legacy auto-create logic
[WARN ] [Legacy Mode] Tool Calling unavailable, using hardcoded logic
[INFO ] [CREATE_INTENT] LLM suggested new intent code: CARBON_FOOTPRINT_QUERY for input: 我想查看碳排放数据
```

### 错误处理日志

```
[ERROR] [Tool Calling] DashScope API error: API rate limit exceeded
[ERROR] [Tool Calling] Failed to execute tool calling workflow: Connection timeout
[WARN ] [Tool Calling] Tool executor not found: unknown_tool
```

## 测试用例

### 测试 1: 正常创建新意图

**输入**: "我想查询碳排放数据"
**期望**: LLM 调用 create_new_intent，创建 CARBON_FOOTPRINT_QUERY 意图
**验证**: 检查数据库是否有新的 AIIntentConfig 记录（active=false）

### 测试 2: 拒绝无意义输入

**输入**: "asdfgh"
**期望**: LLM 不调用任何工具
**验证**: 返回空匹配结果，不创建新意图

### 测试 3: 降级到旧逻辑

**前置条件**: 禁用 ToolRegistry
**输入**: "我想查询碳排放数据"
**期望**: 使用旧的 tryCreateIntentSuggestion 逻辑
**验证**: 检查日志中是否有 "[Legacy Mode]" 标记

### 测试 4: 多工具可用场景

**工具列表**: create_new_intent, update_intent, query_entity_schema
**输入**: "我想更新现有的查询意图"
**期望**: LLM 可能调用 update_intent 而不是 create_new_intent
**验证**: 检查 tool_calls 中的工具名称

## 配置建议

### application.properties

```properties
# 启用自动创建意图
cretas.ai.intent.auto-create.enabled=true

# 最小置信度阈值（Tool Calling 模式下此配置影响较小）
cretas.ai.intent.auto-create.min-confidence=0.6

# 工厂级意图自动审批
cretas.ai.intent.auto-create.factory-auto-approve=true

# DashScope 配置
cretas.ai.dashscope.api-key=${DASHSCOPE_API_KEY}
cretas.ai.dashscope.model=qwen-plus
cretas.ai.dashscope.low-temperature=0.1

# 启用 DashScope 直接调用
cretas.ai.dashscope.migration.intent-classify=true

# 日志级别
logging.level.com.cretas.aims.service.impl.LlmIntentFallbackClientImpl=DEBUG
logging.level.com.cretas.aims.ai.tool=DEBUG
```

## 性能优化

### 1. 缓存工具定义

```java
// 在 ToolRegistry 中缓存工具定义列表
private List<Tool> cachedToolDefinitions = null;

public List<Tool> getAllToolDefinitions() {
    if (cachedToolDefinitions == null) {
        cachedToolDefinitions = buildToolDefinitions();
    }
    return cachedToolDefinitions;
}
```

### 2. 并发限制

```java
// 使用 Semaphore 限制并发 Tool Calling 请求
private final Semaphore toolCallingSemaphore = new Semaphore(10);

private IntentMatchResult tryCreateIntentViaToolCalling(...) {
    if (!toolCallingSemaphore.tryAcquire()) {
        log.warn("Tool Calling concurrency limit reached, fallback to legacy mode");
        // 降级到旧逻辑
    }
    try {
        // Tool Calling 流程
    } finally {
        toolCallingSemaphore.release();
    }
}
```

### 3. 超时控制

```java
// 在 DashScopeClient 中设置超时
OkHttpClient client = httpClient.newBuilder()
    .readTimeout(30, TimeUnit.SECONDS)  // Tool Calling 超时
    .build();
```

## 扩展示例

### ReAct Loop（未来版本）

```java
// 第一轮：LLM 调用工具
ChatCompletionResponse response1 = dashScopeClient.chatCompletion(request);
List<ToolCall> toolCalls = extractToolCalls(response1);

// 执行工具
String toolResult = executor.execute(toolCalls.get(0), context);

// 第二轮：将工具结果返回给 LLM
ChatCompletionRequest request2 = ChatCompletionRequest.builder()
    .model(model)
    .messages(List.of(
        systemMessage,
        userMessage,
        ChatMessage.assistant(null, toolCalls),  // LLM 的工具调用
        ChatMessage.tool(toolResult, toolCalls.get(0).getId())  // 工具执行结果
    ))
    .build();

ChatCompletionResponse response2 = dashScopeClient.chatCompletion(request2);
// LLM 根据工具结果生成最终回复
```

## 故障排查

### 问题 1: Tool Calling 从不触发

**检查**:
1. `shouldUseToolCalling()` 返回 true？
2. ToolRegistry 是否初始化？
3. DashScopeClient 是否可用？

**解决**: 检查日志中的启动信息

### 问题 2: LLM 总是不调用工具

**检查**:
1. 系统提示词是否清晰？
2. 工具描述是否准确？
3. 温度参数是否过高？

**解决**: 调整提示词和温度参数

### 问题 3: 工具执行失败

**检查**:
1. 工具参数 schema 是否正确？
2. LLM 返回的参数是否符合 schema？
3. 执行上下文是否完整？

**解决**: 添加参数验证和详细日志

## 总结

Tool Calling 架构将意图创建的决策权交给了 LLM，提供了更灵活、可扩展的解决方案。通过详细的日志记录和降级机制，确保了系统的稳定性和可观测性。
