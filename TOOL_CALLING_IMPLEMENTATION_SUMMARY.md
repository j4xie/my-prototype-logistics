# DashScopeClient Tool Calling Implementation Summary

## Task Overview

Extended DashScopeClient to support OpenAI-compatible Function Calling, enabling LLM to intelligently invoke tools based on user input.

## Changes Made

### 1. DTO Extensions

#### ChatCompletionRequest.java
**Location**: `backend-java/src/main/java/com/cretas/aims/ai/dto/ChatCompletionRequest.java`

**Added Fields**:
```java
// 可用工具列表
private List<Tool> tools;

// 工具选择策略 ("auto", "none", 或指定工具)
@JsonProperty("tool_choice")
private Object toolChoice;
```

**Backward Compatible**: Existing methods unchanged, new fields are optional.

---

#### ChatCompletionResponse.java
**Location**: `backend-java/src/main/java/com/cretas/aims/ai/dto/ChatCompletionResponse.java`

**Added Field to Message class**:
```java
// 工具调用列表 (当 LLM 决定调用工具时返回)
@JsonProperty("tool_calls")
private List<ToolCall> toolCalls;
```

**Backward Compatible**: Existing methods unchanged, field is null when not used.

---

#### ChatMessage.java
**Location**: `backend-java/src/main/java/com/cretas/aims/ai/dto/ChatMessage.java`

**Added Fields**:
```java
// 工具调用列表 (仅 assistant 角色)
@JsonProperty("tool_calls")
private List<ToolCall> toolCalls;

// 工具调用 ID (仅 tool 角色)
@JsonProperty("tool_call_id")
private String toolCallId;
```

**New Factory Methods**:
```java
// 创建 assistant 消息带工具调用
public static ChatMessage assistant(String content, List<ToolCall> toolCalls)

// 创建 tool 消息 (工具执行结果)
public static ChatMessage tool(String result, String toolCallId)
```

---

### 2. DashScopeClient Extensions

**Location**: `backend-java/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java`

**New Imports**:
```java
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
```

**New Core Method**:
```java
/**
 * 带工具调用的对话 (OpenAI Function Calling)
 */
public ChatCompletionResponse chatCompletionWithTools(
    List<ChatMessage> messages,
    List<Tool> tools,
    String toolChoice)
```

**New Convenience Methods**:
```java
// 简化调用
public ChatCompletionResponse chatWithTools(
    String systemPrompt,
    String userInput,
    List<Tool> tools)

// 检查响应是否包含工具调用
public boolean hasToolCalls(ChatCompletionResponse response)

// 获取第一个工具调用
public ToolCall getFirstToolCall(ChatCompletionResponse response)

// 获取所有工具调用
public List<ToolCall> getAllToolCalls(ChatCompletionResponse response)
```

**Key Features**:
- Uses low temperature (0.0-0.3) for consistent tool calling
- Fully backward compatible - existing methods unchanged
- Automatic tool call detection and parsing
- Supports multiple tool calls in single response

---

### 3. Infrastructure Components

#### ToolExecutionManager.java (NEW)
**Location**: `backend-java/src/main/java/com/cretas/aims/ai/tool/ToolExecutionManager.java`

**Purpose**: Orchestrates the complete Tool Calling workflow

**Key Features**:
- Manages multi-turn conversations with tools
- Automatically discovers and registers available tools
- Handles tool execution and result passing
- Supports permission-based tool access
- Prevents infinite loops with max iteration limit

**Usage**:
```java
@Autowired
private ToolExecutionManager toolExecutionManager;

String answer = toolExecutionManager.execute(
    "You are a warehouse assistant.",
    "查找面粉原料",
    "F001"  // factoryId
);
```

---

#### CreateIntentToolExecutor.java (NEW)
**Location**: `backend-java/src/main/java/com/cretas/aims/ai/tool/CreateIntentToolExecutor.java`

**Purpose**: Example tool implementation for creating AI intents

**Demonstrates**:
- Tool definition with JSON Schema
- Parameter parsing and validation
- Permission checking
- Error handling
- Result formatting

---

#### ToolExecutionTest.java (NEW)
**Location**: `backend-java/src/test/java/com/cretas/aims/ai/tool/ToolExecutionTest.java`

**Purpose**: Comprehensive tests for Tool Calling functionality

**Tests Cover**:
- Basic tool calling
- Multi-turn conversations
- Forced tool selection
- Helper method usage
- Tool definition building
- ChatMessage tool support

---

### 4. Documentation

#### FUNCTION_CALLING_USAGE.md (NEW)
**Location**: `backend-java/FUNCTION_CALLING_USAGE.md`

**Contents**:
- Complete API reference
- Usage examples (basic, multi-turn, forced choice)
- Best practices
- Integration guide
- Testing guide

---

## API Changes Summary

### Request Format

```json
{
  "model": "qwen-plus",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "search_materials",
        "description": "搜索原料",
        "parameters": {
          "type": "object",
          "properties": {
            "keyword": {"type": "string"}
          },
          "required": ["keyword"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

### Response Format (with tool call)

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "search_materials",
              "arguments": "{\"keyword\": \"面粉\"}"
            }
          }
        ]
      }
    }
  ]
}
```

---

## Usage Examples

### Example 1: Simple Tool Calling

```java
// Define tools
Tool searchTool = Tool.of(
    "search_materials",
    "搜索原料",
    Map.of("type", "object", "properties", Map.of(
        "keyword", Map.of("type", "string")
    ))
);

// Call LLM
ChatCompletionResponse response = dashScopeClient.chatWithTools(
    "You are a warehouse assistant.",
    "帮我查找面粉",
    List.of(searchTool)
);

// Check for tool calls
if (dashScopeClient.hasToolCalls(response)) {
    ToolCall call = dashScopeClient.getFirstToolCall(response);
    String functionName = call.getFunction().getName();
    String arguments = call.getFunction().getArguments();

    // Execute tool...
}
```

### Example 2: Multi-Turn Conversation

```java
List<ChatMessage> conversation = new ArrayList<>();
conversation.add(ChatMessage.system("You are a helpful assistant."));
conversation.add(ChatMessage.user("查找面粉"));

// Round 1: LLM requests tool call
ChatCompletionResponse r1 = dashScopeClient.chatCompletionWithTools(
    conversation, tools, "auto"
);

if (dashScopeClient.hasToolCalls(r1)) {
    ToolCall toolCall = dashScopeClient.getFirstToolCall(r1);

    // Add assistant's tool call to history
    conversation.add(ChatMessage.assistant(null, List.of(toolCall)));

    // Execute tool and add result
    String result = executeToolFunction(toolCall);
    conversation.add(ChatMessage.tool(result, toolCall.getId()));

    // Round 2: LLM processes result
    ChatCompletionResponse r2 = dashScopeClient.chatCompletionWithTools(
        conversation, tools, "auto"
    );

    String finalAnswer = r2.getContent();
}
```

### Example 3: Using ToolExecutionManager

```java
@Autowired
private ToolExecutionManager toolExecutionManager;

// Simple usage
String answer = toolExecutionManager.execute(
    "You are a warehouse assistant.",
    "查找面粉并统计库存",
    "F001"
);

System.out.println(answer);
// Output: "我找到了2种面粉：高筋面粉100kg，低筋面粉50kg。总计150kg。"
```

---

## Implementation Notes

### 1. Backward Compatibility

**Guaranteed**:
- All existing methods unchanged
- Existing code continues to work without modification
- New fields are optional in requests
- New fields are null in responses when not used

### 2. Thread Safety

- `DashScopeClient` is thread-safe (uses immutable OkHttpClient)
- `ToolExecutionManager` is stateless (safe for concurrent use)
- Conversation history is passed as parameter (no shared state)

### 3. Error Handling

**Tool Execution Errors**:
```java
try {
    String result = executeToolFunction(toolCall);
    conversation.add(ChatMessage.tool(result, toolCall.getId()));
} catch (Exception e) {
    String errorResult = String.format(
        "{\"error\": \"%s\", \"message\": \"%s\"}",
        e.getClass().getSimpleName(),
        e.getMessage()
    );
    conversation.add(ChatMessage.tool(errorResult, toolCall.getId()));
}
```

**LLM API Errors**:
```java
ChatCompletionResponse response = dashScopeClient.chatWithTools(...);
if (response.hasError()) {
    log.error("LLM error: {}", response.getErrorMessage());
    // Handle error...
}
```

### 4. Performance Considerations

**Temperature**:
- Tool calling uses low temperature (0.0-0.3) for consistency
- Configurable via `config.getLowTemperature()`

**Timeout**:
- Uses default timeout (30s) for tool calling
- Thinking mode timeout (60s) still applies when enabled

**Token Usage**:
- Tool definitions consume tokens
- Keep descriptions concise but clear
- Typical overhead: 50-200 tokens per tool

---

## Testing

### Unit Tests

Run tests:
```bash
cd backend-java
mvn test -Dtest=ToolExecutionTest
```

### Integration Tests

Prerequisites:
- DashScope API key configured
- Qwen-Plus or Qwen-Max model available

Run:
```bash
mvn test -Dtest=ToolExecutionTest#testBasicToolCalling
```

### Manual Testing

```bash
# Start backend
mvn spring-boot:run

# Test via API
curl -X POST http://localhost:10010/api/ai/tool-call \
  -H "Content-Type: application/json" \
  -d '{
    "systemPrompt": "You are a helpful assistant.",
    "userInput": "查找面粉",
    "factoryId": "F001"
  }'
```

---

## Migration Guide

### For Existing Code

**No changes required** - all existing code continues to work:

```java
// Still works exactly as before
String response = dashScopeClient.chat(
    "You are a helpful assistant.",
    "Hello"
);
```

### To Add Tool Support

**Option 1: Use ToolExecutionManager (Recommended)**

```java
@Autowired
private ToolExecutionManager manager;

String answer = manager.execute(systemPrompt, userInput, factoryId);
```

**Option 2: Use DashScopeClient Directly**

```java
ChatCompletionResponse response = dashScopeClient.chatWithTools(
    systemPrompt,
    userInput,
    tools
);
```

**Option 3: Implement Custom ToolExecutor**

```java
@Component
public class MyToolExecutor implements ToolExecutor {
    // Implement interface methods...
}
```

---

## Related Files

### Core Implementation
- `/backend-java/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java`
- `/backend-java/src/main/java/com/cretas/aims/ai/dto/ChatCompletionRequest.java`
- `/backend-java/src/main/java/com/cretas/aims/ai/dto/ChatCompletionResponse.java`
- `/backend-java/src/main/java/com/cretas/aims/ai/dto/ChatMessage.java`

### Supporting DTOs
- `/backend-java/src/main/java/com/cretas/aims/ai/dto/Tool.java` (already existed)
- `/backend-java/src/main/java/com/cretas/aims/ai/dto/ToolCall.java` (already existed)

### Infrastructure
- `/backend-java/src/main/java/com/cretas/aims/ai/tool/ToolExecutor.java` (already existed)
- `/backend-java/src/main/java/com/cretas/aims/ai/tool/ToolExecutionManager.java` (NEW)
- `/backend-java/src/main/java/com/cretas/aims/ai/tool/CreateIntentToolExecutor.java` (NEW)

### Tests & Documentation
- `/backend-java/src/test/java/com/cretas/aims/ai/tool/ToolExecutionTest.java` (NEW)
- `/backend-java/FUNCTION_CALLING_USAGE.md` (NEW)
- `/TOOL_CALLING_IMPLEMENTATION_SUMMARY.md` (NEW - this file)

---

## Next Steps

### 1. Implement More Tools

Create additional `ToolExecutor` implementations:
- `SearchMaterialToolExecutor` - 搜索原料
- `GetInventoryStatsToolExecutor` - 库存统计
- `GetDeviceStatusToolExecutor` - 设备状态
- `CreateShipmentToolExecutor` - 创建发货单

### 2. Add Controller Endpoint

```java
@PostMapping("/ai/tool-call")
public ApiResponse<String> executeWithTools(
    @RequestBody ToolCallRequest request) {

    String answer = toolExecutionManager.execute(
        request.getSystemPrompt(),
        request.getUserInput(),
        request.getFactoryId()
    );

    return ApiResponse.success(answer);
}
```

### 3. Frontend Integration

```typescript
// services/api/aiService.ts
export const executeWithTools = async (
  systemPrompt: string,
  userInput: string,
  factoryId: string
): Promise<string> => {
  const response = await apiClient.post('/ai/tool-call', {
    systemPrompt,
    userInput,
    factoryId
  });
  return response.data;
};
```

### 4. Add Monitoring

```java
@Aspect
@Component
public class ToolCallMonitoringAspect {

    @Around("execution(* ToolExecutor.execute(..))")
    public Object monitorToolExecution(ProceedingJoinPoint joinPoint) {
        // Log tool calls, measure performance, track errors...
    }
}
```

---

## Troubleshooting

### Issue: LLM doesn't call tools

**Solutions**:
1. Check tool descriptions - make them more detailed
2. Add examples in system prompt
3. Use forced tool choice: `toolChoice = "search_materials"`
4. Lower temperature (already done)

### Issue: Invalid tool arguments

**Solutions**:
1. Validate arguments before execution
2. Add more constraints in JSON Schema
3. Provide examples in parameter descriptions
4. Use strict mode (if supported): `function.setStrict(true)`

### Issue: Infinite loop

**Solutions**:
1. Set appropriate `maxIterations` (default: 5)
2. Check tool execution logic for errors
3. Ensure tool results are properly formatted
4. Add timeout protection

---

## References

- [OpenAI Function Calling Documentation](https://platform.openai.com/docs/guides/function-calling)
- [Qwen API Documentation](https://help.aliyun.com/document_detail/2712576.html)
- [JSON Schema](https://json-schema.org/)
- Project Rules: `.claude/rules/api-response-handling.md`

---

**Implementation Date**: 2026-01-06
**Status**: ✅ Complete
**Backward Compatible**: ✅ Yes
**Tested**: ✅ Unit tests created (require DashScope API key to run)
