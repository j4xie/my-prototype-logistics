# LLM Function Calling 实施计划

> **目标**: 使用 OpenAI-compatible Function Calling 替换硬编码的意图创建逻辑
> **创建日期**: 2026-01-06
> **状态**: 进行中 (Task 2/6)

---

## 📋 背景与目标

### 当前问题
位置: `LlmIntentFallbackClientImpl.java:421-436`

```java
if (matchedConfig == null) {
    log.warn("DashScope returned unknown intent code: '{}'", intentCode);

    // 🔴 硬编码逻辑 - 需要替换
    if (autoCreateIntentEnabled && factoryId != null) {
        if (!"UNKNOWN".equalsIgnoreCase(intentCode)) {
            tryCreateIntentSuggestion(factoryId, userInput, intentCode, null, reasoning, confidence);
        }
    }
}
```

### 目标架构
```
用户输入
  ↓
LLM 识别意图 (Qwen-Plus)
  ↓
LLM 决定: 需要创建新意图
  ↓
LLM 调用工具: create_new_intent(intent_code, intent_name, ...)
  ↓
ToolRegistry 路由到 CreateIntentTool
  ↓
CreateIntentTool 执行: AIIntentService.createIntent()
  ↓
返回结果给 LLM 继续对话 (ReAct 循环)
```

---

## 🏗️ 架构分析

### 现有系统架构

#### 1. Intent 执行流程
```
IntentExecutorServiceImpl (1143 lines)
  ├─ AIIntentService.recognizeIntentWithConfidence()  # 意图识别
  ├─ Permission Check                                  # 权限校验
  ├─ Approval Check                                    # 审批检查
  ├─ Drools Gateway Validation                        # 业务规则
  └─ Handler Routing                                   # 路由到具体 Handler
       ├─ FormIntentHandler (FORM 类别)
       ├─ DataOperationIntentHandler (DATA_OP 类别)
       ├─ MaterialIntentHandler (MATERIAL 类别)
       └─ ... (更多 Handler)
```

#### 2. Handler 注册机制
```java
@PostConstruct
public void init() {
    for (IntentHandler handler : handlers) {  // Spring 自动注入所有 Handler
        String category = handler.getSupportedCategory();
        handlerMap.put(category, handler);
        log.info("注册意图处理器: category={}, handler={}", category, handler.getClass().getSimpleName());
    }
}
```

#### 3. LLM Fallback 流程
```
LlmIntentFallbackClientImpl
  ├─ 1. 构建 Prompt (系统提示词 + 意图列表)
  ├─ 2. 调用 DashScopeClient.chatCompletion()
  ├─ 3. 解析 LLM 返回的 intent_code
  ├─ 4. 匹配本地意图配置
  └─ 5. 如果未匹配 → 硬编码创建建议 (❌ 需要替换)
```

### 集成点分析

| 组件 | 作用 | 集成方式 |
|------|------|----------|
| **ToolRegistry** | 管理工具执行器 | 类似 `handlerMap`，使用 Spring 依赖注入 |
| **ToolExecutor** | 工具执行接口 | 类似 `IntentHandler` 接口 |
| **CreateIntentTool** | 创建意图工具 | 实现 `ToolExecutor`，调用 `AIIntentService` |
| **DashScopeClient** | LLM API 客户端 | 扩展支持 `tools` 参数 |
| **LlmIntentFallbackClientImpl** | LLM Fallback 逻辑 | 替换硬编码为 Tool Calling |

---

## 📝 详细实施步骤

### ✅ Task 1: 扩展 DTO 支持 Function Calling

**状态**: 已完成

**已创建文件**:
- ✅ `ai/dto/Tool.java` - OpenAI-compatible 工具定义
- ✅ `ai/dto/ToolCall.java` - LLM 工具调用响应

**待扩展文件**:
```java
// ChatCompletionRequest.java - 需要添加
private List<Tool> tools;           // 工具列表
private Object toolChoice;          // "auto" | "none" | "required" | {"type":"function","function":{"name":"xxx"}}

// ChatCompletionResponse.java - 需要添加
@JsonProperty("tool_calls")
private List<ToolCall> toolCalls;   // LLM 返回的工具调用
```

---

### 🔄 Task 2: 创建 Tool 执行框架

**状态**: 进行中 (2/3 完成)

**已创建文件**:
- ✅ `ai/tool/ToolExecutor.java` - 工具执行器接口
  ```java
  public interface ToolExecutor {
      String getToolName();                    // 工具名称
      String getDescription();                 // 工具描述
      Map<String, Object> getParametersSchema(); // 参数 Schema
      String execute(ToolCall, context);       // 执行逻辑
      boolean isEnabled();                     // 是否启用
      boolean requiresPermission();            // 是否需要权限
      boolean hasPermission(String userRole);  // 权限检查
  }
  ```

- ✅ `ai/tool/ToolRegistry.java` - 工具注册中心
  ```java
  @Component
  public class ToolRegistry {
      private Map<String, ToolExecutor> toolMap;  // 工具映射表

      @PostConstruct
      public void init() {
          // Spring 自动注入所有 ToolExecutor 实现并注册
      }

      public Optional<ToolExecutor> getExecutor(String toolName);
      public List<Tool> getAllToolDefinitions();
      public List<Tool> getToolDefinitionsForRole(String userRole);
  }
  ```

**待创建文件**:
- ⏳ `ai/tool/AbstractTool.java` - 抽象基类
  ```java
  public abstract class AbstractTool implements ToolExecutor {
      // 提供通用功能:
      // - 参数解析 (JSON → Map)
      // - 异常处理
      // - 日志记录
      // - 权限校验辅助方法
  }
  ```

**设计要点**:
1. 使用 Spring `@Autowired(required = false)` 自动收集工具
2. `@PostConstruct` 初始化时注册到 `toolMap`
3. 类似 `IntentExecutorServiceImpl.handlerMap` 的设计模式

---

### ⏳ Task 3: 实现 CreateIntentTool

**文件**: `ai/tool/impl/CreateIntentTool.java`

**工具定义**:
```java
@Component
public class CreateIntentTool extends AbstractTool {

    @Autowired
    private AIIntentService aiIntentService;

    @Override
    public String getToolName() {
        return "create_new_intent";
    }

    @Override
    public String getDescription() {
        return "当用户的意图在系统中不存在时，创建一个新的意图配置。" +
               "适用场景: 用户提出了新的需求，系统无法识别其意图。" +
               "例如: 用户说 '我想查看设备维护历史'，但系统没有对应的意图。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        // JSON Schema 定义参数
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "intent_code", Map.of(
                    "type", "string",
                    "description", "意图代码，大写字母+下划线，如 QUERY_EQUIPMENT_HISTORY"
                ),
                "intent_name", Map.of(
                    "type", "string",
                    "description", "意图名称，简短描述，如 '查询设备维护历史'"
                ),
                "description", Map.of(
                    "type", "string",
                    "description", "详细描述此意图的用途和适用场景"
                ),
                "keywords", Map.of(
                    "type", "array",
                    "items", Map.of("type", "string"),
                    "description", "关键词列表，用于意图识别，如 ['设备', '维护', '历史']"
                ),
                "category", Map.of(
                    "type", "string",
                    "enum", List.of("QUERY", "DATA_OP", "FORM", "REPORT", "SYSTEM"),
                    "description", "意图分类"
                )
            ),
            "required", List.of("intent_code", "intent_name", "keywords", "category")
        );
    }

    @Override
    public String execute(ToolCall toolCall, Map<String, Object> context) {
        // 1. 解析参数
        Map<String, Object> args = parseArguments(toolCall.getFunction().getArguments());

        // 2. 构建 AIIntentConfig
        String factoryId = (String) context.get("factoryId");
        AIIntentConfig config = AIIntentConfig.builder()
            .intentCode((String) args.get("intent_code"))
            .intentName((String) args.get("intent_name"))
            .description((String) args.get("description"))
            .keywords((List<String>) args.get("keywords"))
            .category((String) args.get("category"))
            .factoryId(factoryId)
            .active(false)  // 初始禁用，需人工审核
            .build();

        // 3. 调用服务创建
        AIIntentConfig created = aiIntentService.createIntent(config);

        // 4. 返回结果给 LLM
        return String.format(
            "{\"success\": true, \"intent_code\": \"%s\", \"message\": \"意图已创建，待管理员审核后启用\"}",
            created.getIntentCode()
        );
    }
}
```

**核心逻辑**:
- 替换 `LlmIntentFallbackClientImpl.tryCreateIntentSuggestion()` 的功能
- 调用 `AIIntentService.createIntent()` 创建意图
- 初始状态设为 `active=false`，需要人工审核后启用

---

### ⏳ Task 4: 扩展 DashScopeClient 支持 Function Calling

**修改文件**: `ai/client/DashScopeClient.java`

**新增方法**:
```java
/**
 * 带工具调用的聊天补全
 *
 * @param messages 对话消息列表
 * @param tools 可用工具列表
 * @param toolChoice 工具选择策略 ("auto" | "none" | "required")
 * @return 聊天补全响应（可能包含 tool_calls）
 */
public ChatCompletionResponse chatCompletionWithTools(
    List<Message> messages,
    List<Tool> tools,
    Object toolChoice
) {
    ChatCompletionRequest request = ChatCompletionRequest.builder()
        .model(MODEL_QWEN_PLUS)
        .messages(messages)
        .tools(tools)           // 🆕 添加工具列表
        .toolChoice(toolChoice) // 🆕 添加工具选择
        .build();

    return chatCompletion(request);
}
```

**响应解析**:
```java
// 检查 finish_reason
if ("tool_calls".equals(response.getFinishReason())) {
    List<ToolCall> toolCalls = response.getMessage().getToolCalls();
    // 处理工具调用
}
```

**API 文档参考**: 通义千问 Function Calling
- Request: `tools` 数组, `tool_choice` 字段
- Response: `message.tool_calls` 数组, `finish_reason: "tool_calls"`

---

### ⏳ Task 5: 修改 LlmIntentFallbackClientImpl 使用 Tool Calling

**修改文件**: `service/impl/LlmIntentFallbackClientImpl.java`

**核心变更** (lines 421-436):

```java
// ❌ 删除硬编码逻辑:
if (matchedConfig == null) {
    if (autoCreateIntentEnabled && factoryId != null) {
        if (!"UNKNOWN".equalsIgnoreCase(intentCode)) {
            tryCreateIntentSuggestion(factoryId, userInput, intentCode, null, reasoning, confidence);
        }
    }
}

// ✅ 替换为 Tool Calling:
if (matchedConfig == null) {
    log.info("未匹配到意图，尝试使用 Tool Calling 创建新意图");

    // 1. 获取可用工具
    List<Tool> tools = toolRegistry.getToolDefinitionsForRole(userRole);

    // 2. 重新调用 LLM，带上工具定义
    List<Message> messages = buildMessagesWithTools(userInput, existingIntents);
    ChatCompletionResponse response = dashScopeClient.chatCompletionWithTools(
        messages,
        tools,
        "auto"  // 让 LLM 自动决定是否调用工具
    );

    // 3. 检查是否有工具调用
    if (response.hasToolCalls()) {
        for (ToolCall toolCall : response.getToolCalls()) {
            String toolName = toolCall.getFunction().getName();

            // 4. 执行工具
            Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolName);
            if (executor.isPresent()) {
                Map<String, Object> context = Map.of(
                    "factoryId", factoryId,
                    "userId", userId,
                    "userRole", userRole
                );

                String result = executor.get().execute(toolCall, context);
                log.info("工具执行结果: tool={}, result={}", toolName, result);

                // 5. (可选) 将结果返回给 LLM 继续对话 (ReAct 循环)
                // messages.add(Message.toolResult(toolCall.getId(), result));
                // response = dashScopeClient.chatCompletionWithTools(messages, tools, "auto");
            }
        }
    }
}
```

**ReAct 循环实现** (可选高级功能):
```java
while (response.hasToolCalls() && iteration < MAX_ITERATIONS) {
    for (ToolCall toolCall : response.getToolCalls()) {
        String result = executeToolCall(toolCall, context);
        messages.add(Message.toolResult(toolCall.getId(), result));
    }
    response = dashScopeClient.chatCompletionWithTools(messages, tools, "auto");
    iteration++;
}
```

---

### ⏳ Task 6: 编写测试用例

**测试文件**:
- `test/.../ai/tool/CreateIntentToolTest.java` - 单元测试
- `test/.../service/impl/LlmIntentFallbackWithToolsIT.java` - 集成测试

**测试场景**:

#### 1. 单元测试 - CreateIntentTool
```java
@Test
public void testExecute_创建新意图() {
    // Given
    ToolCall toolCall = ToolCall.of(
        "call_123",
        "create_new_intent",
        "{\"intent_code\":\"QUERY_EQUIPMENT_HISTORY\",\"intent_name\":\"查询设备历史\",...}"
    );
    Map<String, Object> context = Map.of("factoryId", "F001");

    // When
    String result = createIntentTool.execute(toolCall, context);

    // Then
    assertThat(result).contains("\"success\": true");
    verify(aiIntentService).createIntent(any(AIIntentConfig.class));
}
```

#### 2. 集成测试 - LLM Tool Calling
```java
@Test
public void testRecognizeIntent_自动创建新意图() {
    // Given
    String userInput = "我想查看设备的维护历史记录";
    String factoryId = "F001";

    // 模拟 LLM 返回工具调用
    ChatCompletionResponse mockResponse = ChatCompletionResponse.builder()
        .message(Message.builder()
            .role("assistant")
            .content(null)
            .toolCalls(List.of(
                ToolCall.of("call_123", "create_new_intent", "{...}")
            ))
            .build())
        .finishReason("tool_calls")
        .build();

    when(dashScopeClient.chatCompletionWithTools(any(), any(), any()))
        .thenReturn(mockResponse);

    // When
    Optional<AIIntentConfig> result = llmClient.recognizeIntent(factoryId, userInput);

    // Then
    verify(toolRegistry).getExecutor("create_new_intent");
    verify(aiIntentService).createIntent(any());
}
```

#### 3. 端到端测试
```java
@Test
public void testE2E_用户输入新需求_自动创建意图() {
    // 1. 用户输入系统未知的需求
    String userInput = "帮我生成一份本月的能耗报表";

    // 2. 执行意图识别
    Optional<AIIntentConfig> intent = aiIntentService.recognizeIntent("F001", userInput);

    // 3. 验证 LLM 自动创建了新意图
    assertThat(intent).isEmpty();  // 首次无匹配

    // 4. 验证数据库中新增了意图配置（待审核状态）
    AIIntentConfig created = aiIntentConfigRepository
        .findByIntentCode("GENERATE_ENERGY_REPORT")
        .orElseThrow();

    assertThat(created.isActive()).isFalse();  // 初始禁用
    assertThat(created.getIntentName()).contains("能耗报表");
}
```

---

## 🔍 关键设计决策

### 1. 为什么选择 Tool Calling 而不是 Prompt Engineering？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Prompt Engineering** | 简单快速 | 输出不稳定，需解析自然语言 |
| **Function Calling** ✅ | 结构化输出，LLM 自主决策 | 需要扩展 API，实现复杂 |

**选择理由**:
- Function Calling 提供结构化输出，避免解析错误
- LLM 自主决定何时创建意图，更智能
- 符合 LangChain Agent 架构趋势

### 2. 工具执行框架设计

**参考架构**: `IntentExecutorServiceImpl` + `IntentHandler`

```
IntentExecutorServiceImpl     ≈     ToolRegistry
     ├─ handlerMap                    ├─ toolMap
     ├─ @PostConstruct                ├─ @PostConstruct
     └─ Handler 路由                  └─ ToolExecutor 路由

IntentHandler Interface      ≈     ToolExecutor Interface
     ├─ getSupportedCategory()        ├─ getToolName()
     ├─ handle()                      ├─ execute()
     └─ supportsSemanticsMode()       └─ requiresPermission()
```

**设计原则**:
- 遵循现有 Handler 模式，降低学习成本
- 使用 Spring 依赖注入，自动发现工具
- 支持权限控制和启用/禁用

### 3. ReAct 循环实现

**基础版 (Task 5)**: 单次工具调用
```
LLM → Tool Call → Execute → Return Result
```

**高级版 (可选)**: 多轮对话
```
LLM → Tool Call 1 → Execute → Return Result → LLM → Tool Call 2 → ...
```

**实现建议**:
- 基础版本先实现单次调用
- 后续迭代支持 ReAct 循环（需要设置 `MAX_ITERATIONS` 防止死循环）

---

## 📊 进度跟踪

| Task | 状态 | 文件 | 完成度 |
|------|------|------|--------|
| Task 1 | ✅ 已完成 | Tool.java, ToolCall.java | 100% |
| Task 2 | 🔄 进行中 | ToolExecutor.java, ToolRegistry.java, AbstractTool.java | 67% |
| Task 3 | ⏳ 待开始 | CreateIntentTool.java | 0% |
| Task 4 | ⏳ 待开始 | DashScopeClient.java (扩展) | 0% |
| Task 5 | ⏳ 待开始 | LlmIntentFallbackClientImpl.java (重构) | 0% |
| Task 6 | ⏳ 待开始 | 测试文件 | 0% |

**总体进度**: 约 11% (1/6 完成 + 2/6 进行中 33%)

---

## 🎯 验收标准

### 功能验收
- [ ] 用户输入未知意图时，LLM 自动调用 `create_new_intent` 工具
- [ ] 工具成功创建意图配置（`active=false` 待审核状态）
- [ ] 管理员可在后台看到新创建的意图
- [ ] 管理员审核通过后，意图可正常使用
- [ ] 不再依赖 `tryCreateIntentSuggestion()` 硬编码逻辑

### 性能验收
- [ ] LLM 调用延迟 < 3s (带 Tool Calling)
- [ ] 工具执行时间 < 500ms
- [ ] 无内存泄漏，工具注册表稳定

### 代码质量
- [ ] 所有类有完整 Javadoc 注释
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试覆盖关键流程
- [ ] 无 Checkstyle 警告

---

## 🚀 后续扩展

### Phase 2: 更多工具
- `update_intent_keywords` - 更新意图关键词
- `disable_intent` - 禁用意图
- `query_intent_usage_stats` - 查询意图使用统计

### Phase 3: Agent 架构
- 实现完整 ReAct 循环
- 支持多工具协同调用
- 工具链式调用（Tool Chaining）

### Phase 4: 可视化
- 管理后台展示 LLM 工具调用日志
- 工具调用流程图
- 意图自学习效果分析

---

## 📚 参考资料

- [OpenAI Function Calling 文档](https://platform.openai.com/docs/guides/function-calling)
- [通义千问 Function Calling](https://help.aliyun.com/zh/model-studio/developer-reference/function-call)
- [LangChain Agent 架构](https://python.langchain.com/docs/modules/agents/)
- 项目内部参考:
  - `IntentExecutorServiceImpl.java` - Handler 注册模式
  - `AIIntentService.java` - 意图管理接口
  - `LlmIntentFallbackClientImpl.java` - LLM Fallback 实现

---

## 👥 联系人

- 开发负责人: Cretas Team
- 技术支持: Claude Code
- 更新日期: 2026-01-06
