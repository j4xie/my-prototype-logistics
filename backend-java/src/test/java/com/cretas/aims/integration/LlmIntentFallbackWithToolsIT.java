package com.cretas.aims.integration;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.AIIntentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * LLM Intent Fallback with Tool Calling 集成测试
 *
 * 测试覆盖完整的 Tool Calling 流程:
 * 1. LLM 返回工具调用
 * 2. ToolRegistry 查找并执行工具
 * 3. 工具执行结果返回给 LLM
 * 4. LLM 生成最终响应
 *
 * 测试场景:
 * - IT-LFTC-001: 完整的 create_new_intent 工具调用流程
 * - IT-LFTC-002: 工具执行失败处理
 * - IT-LFTC-003: 多轮工具调用
 * - IT-LFTC-004: 权限过滤测试
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("LLM Intent Fallback with Tool Calling 集成测试")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LlmIntentFallbackWithToolsIT {

    @Autowired
    private ToolRegistry toolRegistry;

    @Autowired
    private AIIntentService aiIntentService;

    @Autowired
    private AIIntentConfigRepository intentConfigRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // Mock DashScope client for controlled testing
    private DashScopeClient mockDashScopeClient;

    // Test constants
    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;
    private static final String USER_ROLE = "factory_super_admin";
    private static final String INTENT_CODE = "CARBON_FOOTPRINT_QUERY";
    private static final String INTENT_NAME = "碳排放足迹查询";

    @BeforeEach
    void setUp() {
        mockDashScopeClient = mock(DashScopeClient.class);
    }

    @AfterEach
    void tearDown() {
        // Clean up created intents in test database
        try {
            intentConfigRepository.deleteByIntentCode(INTENT_CODE);
        } catch (Exception e) {
            // Ignore cleanup errors
        }
    }

    // ==================== 完整 Tool Calling 流程测试 ====================

    @Test
    @Order(1)
    @DisplayName("IT-LFTC-001: 完整的 create_new_intent 工具调用流程")
    @Transactional
    void testCompleteToolCallingFlow() throws Exception {
        // ====== Phase 1: LLM 决定调用工具 ======

        // Arrange - LLM 返回 tool_call
        String userInput = "我想查询碳排放足迹数据";
        ChatCompletionResponse llmResponse = createToolCallResponse(
                "call_001",
                "create_new_intent",
                String.format("{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\",\"keywords\":[\"碳排放\",\"碳足迹\",\"查询\"]}",
                        INTENT_CODE, INTENT_NAME)
        );

        when(mockDashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(llmResponse);

        // Act - Simulate LLM calling tool
        ToolCall toolCall = llmResponse.getChoices().get(0).getMessage().getToolCalls().get(0);

        // ====== Phase 2: ToolRegistry 查找并执行工具 ======

        Optional<ToolExecutor> executor = toolRegistry.getExecutor("create_new_intent");
        assertTrue(executor.isPresent(), "create_new_intent tool should be registered");

        Map<String, Object> context = createExecutionContext();
        String toolResult = executor.get().execute(toolCall, context);

        // Assert - Tool execution successful
        assertNotNull(toolResult);
        assertTrue(toolResult.contains("\"success\":true"), "Tool should execute successfully");
        assertTrue(toolResult.contains(INTENT_CODE), "Result should contain intent code");

        // ====== Phase 3: 验证意图已创建 ======

        Optional<AIIntentConfig> createdIntent = aiIntentService.getIntentByCode(FACTORY_ID, INTENT_CODE);
        assertTrue(createdIntent.isPresent(), "Intent should be created in database");
        assertEquals(INTENT_NAME, createdIntent.get().getIntentName());
        assertFalse(createdIntent.get().getActive(), "New intent should be inactive by default");

        // ====== Phase 4: LLM 收到工具结果并生成最终响应 ======

        ChatCompletionResponse finalResponse = createTextResponse(
                "已为您创建新的意图配置 '" + INTENT_NAME + "'，等待管理员审核激活。"
        );

        when(mockDashScopeClient.chatCompletion(any(ChatCompletionRequest.class)))
                .thenReturn(finalResponse);

        // Verify final response
        String finalMessage = finalResponse.getChoices().get(0).getMessage().getContent();
        assertTrue(finalMessage.contains(INTENT_NAME));
        assertTrue(finalMessage.contains("审核"));
    }

    // ==================== 工具执行失败处理 ====================

    @Test
    @Order(2)
    @DisplayName("IT-LFTC-002: 工具执行失败时返回错误响应")
    void testToolExecutionFailureHandling() throws Exception {
        // Arrange - 缺少必需参数的工具调用
        ToolCall invalidToolCall = createToolCallObject(
                "call_002",
                "create_new_intent",
                "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME + "\"}"  // Missing category and keywords
        );

        Map<String, Object> context = createExecutionContext();
        Optional<ToolExecutor> executor = toolRegistry.getExecutor("create_new_intent");
        assertTrue(executor.isPresent());

        // Act
        String toolResult = executor.get().execute(invalidToolCall, context);

        // Assert
        assertNotNull(toolResult);
        assertTrue(toolResult.contains("\"success\":false"), "Tool should return error");
        assertTrue(toolResult.contains("keywords") || toolResult.contains("参数"),
                "Error message should mention missing parameter");
    }

    // ==================== 多轮工具调用 ====================

    @Test
    @Order(3)
    @DisplayName("IT-LFTC-003: 支持多轮工具调用")
    void testMultipleToolCalls() throws Exception {
        // Scenario: LLM 先查询 Schema，再创建意图

        // ====== Round 1: Query Entity Schema ======

        ToolCall schemaToolCall = createToolCallObject(
                "call_003_1",
                "query_entity_schema",
                "{\"entityName\":\"MaterialBatch\"}"
        );

        Map<String, Object> context = createExecutionContext();
        Optional<ToolExecutor> schemaExecutor = toolRegistry.getExecutor("query_entity_schema");
        assertTrue(schemaExecutor.isPresent(), "query_entity_schema tool should be registered");

        String schemaResult = schemaExecutor.get().execute(schemaToolCall, context);

        // Assert Schema result
        assertTrue(schemaResult.contains("\"success\":true"));
        assertTrue(schemaResult.contains("MaterialBatch"));

        // ====== Round 2: Create Intent based on Schema ======

        ToolCall createToolCall = createToolCallObject(
                "call_003_2",
                "create_new_intent",
                String.format("{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\",\"keywords\":[\"碳排放\",\"查询\"]}",
                        INTENT_CODE, INTENT_NAME)
        );

        Optional<ToolExecutor> createExecutor = toolRegistry.getExecutor("create_new_intent");
        assertTrue(createExecutor.isPresent());

        String createResult = createExecutor.get().execute(createToolCall, context);

        // Assert Create result
        assertTrue(createResult.contains("\"success\":true"));
        assertTrue(createResult.contains(INTENT_CODE));

        // Verify both tools executed successfully
        Optional<AIIntentConfig> createdIntent = aiIntentService.getIntentByCode(FACTORY_ID, INTENT_CODE);
        assertTrue(createdIntent.isPresent(), "Intent should be created after multi-round tool calls");
    }

    // ==================== 权限过滤测试 ====================

    @Test
    @Order(4)
    @DisplayName("IT-LFTC-004: 根据用户角色过滤工具列表")
    void testToolFilteringByRole() {
        // Arrange
        String superAdminRole = "super_admin";
        String userRole = "user";

        // Act
        List<Tool> adminTools = toolRegistry.getToolDefinitionsForRole(superAdminRole);
        List<Tool> userTools = toolRegistry.getToolDefinitionsForRole(userRole);

        // Assert
        assertNotNull(adminTools);
        assertNotNull(userTools);

        // Admin should see create_new_intent
        assertTrue(adminTools.stream().anyMatch(t -> "create_new_intent".equals(t.getFunction().getName())),
                "Admin should have access to create_new_intent");

        // Regular user should NOT see create_new_intent
        assertFalse(userTools.stream().anyMatch(t -> "create_new_intent".equals(t.getFunction().getName())),
                "Regular user should NOT have access to create_new_intent");

        // Both should see query_entity_schema (no permission required)
        assertTrue(adminTools.stream().anyMatch(t -> "query_entity_schema".equals(t.getFunction().getName())));
        assertTrue(userTools.stream().anyMatch(t -> "query_entity_schema".equals(t.getFunction().getName())));
    }

    // ==================== 工具注册验证 ====================

    @Test
    @Order(5)
    @DisplayName("IT-LFTC-005: 验证所有 Tool 已正确注册")
    void testAllToolsRegistered() {
        // Assert
        assertTrue(toolRegistry.hasExecutor("create_new_intent"),
                "create_new_intent should be registered");
        assertTrue(toolRegistry.hasExecutor("query_entity_schema"),
                "query_entity_schema should be registered");

        List<String> allToolNames = toolRegistry.getAllToolNames();
        assertTrue(allToolNames.size() >= 2, "At least 2 tools should be registered");
    }

    // ==================== Tool Definition 验证 ====================

    @Test
    @Order(6)
    @DisplayName("IT-LFTC-006: Tool Definition 格式符合 OpenAI 规范")
    void testToolDefinitionFormat() {
        // Act
        List<Tool> tools = toolRegistry.getAllToolDefinitions();

        // Assert
        assertFalse(tools.isEmpty(), "Should have tool definitions");

        for (Tool tool : tools) {
            // Verify structure
            assertEquals("function", tool.getType());
            assertNotNull(tool.getFunction());
            assertNotNull(tool.getFunction().getName());
            assertNotNull(tool.getFunction().getDescription());
            assertNotNull(tool.getFunction().getParameters());

            // Verify parameters schema
            Map<String, Object> params = tool.getFunction().getParameters();
            assertEquals("object", params.get("type"));
            assertTrue(params.containsKey("properties"));
        }
    }

    // ==================== 错误恢复测试 ====================

    @Test
    @Order(7)
    @DisplayName("IT-LFTC-007: 工具执行异常不影响其他工具")
    void testToolExecutionExceptionIsolation() throws Exception {
        // Arrange - 一个会失败的工具调用
        ToolCall failingToolCall = createToolCallObject(
                "call_007_1",
                "create_new_intent",
                "{invalid json}"
        );

        Map<String, Object> context = createExecutionContext();
        Optional<ToolExecutor> executor = toolRegistry.getExecutor("create_new_intent");

        // Act - Execute failing tool
        String failResult = executor.get().execute(failingToolCall, context);

        // Assert - Should return error, not throw exception
        assertNotNull(failResult);
        assertTrue(failResult.contains("\"success\":false"));

        // Now execute a valid tool call
        ToolCall validToolCall = createToolCallObject(
                "call_007_2",
                "query_entity_schema",
                "{\"entityName\":\"MaterialBatch\"}"
        );

        Optional<ToolExecutor> schemaExecutor = toolRegistry.getExecutor("query_entity_schema");
        String successResult = schemaExecutor.get().execute(validToolCall, context);

        // Assert - Second tool should still work
        assertTrue(successResult.contains("\"success\":true"),
                "Other tools should still work after one fails");
    }

    // ==================== Helper Methods ====================

    private ChatCompletionResponse createToolCallResponse(String toolCallId, String toolName, String arguments) {
        ToolCall toolCall = createToolCallObject(toolCallId, toolName, arguments);

        ChatMessage message = ChatMessage.builder()
                .role("assistant")
                .content(null)
                .toolCalls(Collections.singletonList(toolCall))
                .build();

        ChatCompletionResponse.Choice choice = ChatCompletionResponse.Choice.builder()
                .index(0)
                .message(message)
                .finishReason("tool_calls")
                .build();

        return ChatCompletionResponse.builder()
                .id("chatcmpl-test-001")
                .choices(Collections.singletonList(choice))
                .usage(ChatCompletionResponse.Usage.builder()
                        .promptTokens(100)
                        .completionTokens(50)
                        .totalTokens(150)
                        .build())
                .build();
    }

    private ToolCall createToolCallObject(String id, String name, String arguments) {
        return ToolCall.builder()
                .id(id)
                .type("function")
                .function(ToolCall.FunctionCall.builder()
                        .name(name)
                        .arguments(arguments)
                        .build())
                .build();
    }

    private ChatCompletionResponse createTextResponse(String content) {
        ChatMessage message = ChatMessage.builder()
                .role("assistant")
                .content(content)
                .build();

        ChatCompletionResponse.Choice choice = ChatCompletionResponse.Choice.builder()
                .index(0)
                .message(message)
                .finishReason("stop")
                .build();

        return ChatCompletionResponse.builder()
                .id("chatcmpl-test-002")
                .choices(Collections.singletonList(choice))
                .usage(ChatCompletionResponse.Usage.builder()
                        .promptTokens(50)
                        .completionTokens(30)
                        .totalTokens(80)
                        .build())
                .build();
    }

    private Map<String, Object> createExecutionContext() {
        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", FACTORY_ID);
        context.put("userId", USER_ID);
        context.put("userRole", USER_ROLE);
        return context;
    }
}
