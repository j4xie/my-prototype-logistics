# DashScopeClient - OpenAI Function Calling Usage Guide

## Overview

DashScopeClient now supports OpenAI-compatible Function Calling (Tool Calling), allowing the LLM to intelligently invoke tools/functions based on user input.

## Changes Made

### 1. DTO Extensions

#### ChatCompletionRequest
- Added `tools`: List of available tools
- Added `toolChoice`: Strategy for tool selection ("auto", "none", or specific tool)

#### ChatCompletionResponse.Message
- Added `toolCalls`: List of tool calls returned by LLM

### 2. New Methods in DashScopeClient

#### Core Method
```java
public ChatCompletionResponse chatCompletionWithTools(
    List<ChatMessage> messages,
    List<Tool> tools,
    String toolChoice)
```

#### Convenience Methods
```java
// Simple chat with tools
public ChatCompletionResponse chatWithTools(
    String systemPrompt,
    String userInput,
    List<Tool> tools)

// Check if response contains tool calls
public boolean hasToolCalls(ChatCompletionResponse response)

// Get first tool call
public ToolCall getFirstToolCall(ChatCompletionResponse response)

// Get all tool calls
public List<ToolCall> getAllToolCalls(ChatCompletionResponse response)
```

## Usage Examples

### Example 1: Basic Tool Calling

```java
// 1. Define available tools
Tool searchMaterialTool = Tool.of(
    "search_materials",
    "Search for materials in the database",
    Map.of(
        "type", "object",
        "properties", Map.of(
            "keyword", Map.of("type", "string", "description", "Search keyword"),
            "category", Map.of("type", "string", "description", "Material category")
        ),
        "required", List.of("keyword")
    )
);

Tool addMaterialTool = Tool.of(
    "add_material",
    "Add a new material to the database",
    Map.of(
        "type", "object",
        "properties", Map.of(
            "name", Map.of("type", "string", "description", "Material name"),
            "quantity", Map.of("type", "number", "description", "Quantity")
        ),
        "required", List.of("name", "quantity")
    )
);

List<Tool> tools = List.of(searchMaterialTool, addMaterialTool);

// 2. Call LLM with tools
ChatCompletionResponse response = dashScopeClient.chatWithTools(
    "You are a helpful assistant that helps manage materials.",
    "帮我查找包含'面粉'的原料",
    tools
);

// 3. Check if LLM wants to call a tool
if (dashScopeClient.hasToolCalls(response)) {
    ToolCall toolCall = dashScopeClient.getFirstToolCall(response);

    String functionName = toolCall.getFunction().getName();
    String arguments = toolCall.getFunction().getArguments();

    // Parse arguments and execute the tool
    log.info("LLM wants to call: {} with arguments: {}", functionName, arguments);

    // Example: {"keyword": "面粉", "category": "原料"}
    Map<String, Object> params = objectMapper.readValue(arguments, Map.class);

    // Execute the actual function
    if ("search_materials".equals(functionName)) {
        List<Material> results = materialService.search(
            (String) params.get("keyword"),
            (String) params.get("category")
        );

        // Send results back to LLM
        // ...
    }
} else {
    // LLM responded with text
    String content = response.getContent();
    log.info("LLM response: {}", content);
}
```

### Example 2: Multiple Tool Calls

```java
ChatCompletionResponse response = dashScopeClient.chatWithTools(
    "You are a warehouse assistant.",
    "请查询所有原料并更新库存报告",
    tools
);

if (dashScopeClient.hasToolCalls(response)) {
    List<ToolCall> toolCalls = dashScopeClient.getAllToolCalls(response);

    for (ToolCall toolCall : toolCalls) {
        String functionName = toolCall.getFunction().getName();
        String arguments = toolCall.getFunction().getArguments();

        // Execute each tool call
        executeToolCall(functionName, arguments);
    }
}
```

### Example 3: Forced Tool Selection

```java
// Force LLM to call a specific tool
ChatCompletionResponse response = dashScopeClient.chatCompletionWithTools(
    messages,
    tools,
    "search_materials"  // Force this tool to be called
);
```

### Example 4: Multi-Turn Conversation with Tools

```java
List<ChatMessage> conversationHistory = new ArrayList<>();

// Round 1: User request
conversationHistory.add(ChatMessage.system("You are a helpful assistant."));
conversationHistory.add(ChatMessage.user("查找面粉原料"));

ChatCompletionResponse response1 = dashScopeClient.chatCompletionWithTools(
    conversationHistory,
    tools,
    "auto"
);

// Round 2: LLM requests tool call
if (dashScopeClient.hasToolCalls(response1)) {
    ToolCall toolCall = dashScopeClient.getFirstToolCall(response1);

    // Add assistant's tool call to history
    conversationHistory.add(ChatMessage.assistant(
        null,
        List.of(toolCall)
    ));

    // Execute tool and add result
    String toolResult = executeToolAndGetResult(toolCall);
    conversationHistory.add(ChatMessage.tool(toolResult, toolCall.getId()));

    // Round 3: LLM processes tool result
    ChatCompletionResponse response2 = dashScopeClient.chatCompletionWithTools(
        conversationHistory,
        tools,
        "auto"
    );

    // Now LLM can provide final answer
    String finalAnswer = response2.getContent();
    log.info("Final answer: {}", finalAnswer);
}
```

## Tool Choice Options

| Value | Description |
|-------|-------------|
| `"auto"` | LLM decides whether to call tools (default) |
| `"none"` | LLM will not call any tools |
| Specific tool name | Force LLM to call a specific tool |

## Best Practices

1. **Use Low Temperature**: Function calling works best with low temperature (0.0-0.3) for consistent output
2. **Clear Descriptions**: Provide detailed function descriptions to help LLM understand when to use each tool
3. **Validate Arguments**: Always validate the arguments returned by LLM before executing functions
4. **Handle Errors**: Tool execution may fail - handle errors gracefully and report back to LLM
5. **Multi-Turn**: For complex tasks, use multi-turn conversations to let LLM iterate with tool results

## Integration with Existing Code

The new Tool Calling feature is fully backward compatible:
- Existing methods (`chat()`, `chatLowTemp()`, etc.) continue to work unchanged
- New methods are additions, not modifications
- No breaking changes to existing code

## Testing

```java
@Test
public void testToolCalling() {
    // Define test tool
    Tool testTool = Tool.of(
        "test_function",
        "A test function",
        Map.of("type", "object", "properties", Map.of())
    );

    // Call with tools
    ChatCompletionResponse response = dashScopeClient.chatWithTools(
        "You are a test assistant.",
        "Call the test function",
        List.of(testTool)
    );

    // Verify tool call
    assertTrue(dashScopeClient.hasToolCalls(response));
    assertEquals("test_function",
        dashScopeClient.getFirstToolCall(response).getFunction().getName());
}
```

## Notes

- Qwen-Plus and Qwen-Max models support OpenAI-compatible Function Calling
- DashScope API uses the same format as OpenAI's API
- Tool calls are automatically parsed from the response JSON
- The `toolChoice` parameter uses the same format as OpenAI
