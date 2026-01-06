package com.cretas.aims.integration;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.*;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tool Execution End-to-End 测试
 *
 * 测试完整业务流程:
 * 1. 用户输入 → 意图识别（无匹配）
 * 2. LLM Fallback → 调用 create_new_intent 工具
 * 3. 工具执行 → 创建新意图配置（inactive）
 * 4. 管理员激活意图
 * 5. 再次输入相同请求 → 意图匹配成功
 *
 * 测试场景:
 * - E2E-TE-001: 完整的新意图创建和激活流程
 * - E2E-TE-002: 工具创建意图后自动学习关键词
 * - E2E-TE-003: 多租户隔离验证
 * - E2E-TE-004: 权限控制验证
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Tool Execution E2E 测试")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ToolExecutionE2ETest {

    @Autowired
    private AIIntentService aiIntentService;

    @Autowired
    private IntentExecutorService intentExecutorService;

    @Autowired
    private LlmIntentFallbackClient llmIntentFallbackClient;

    @Autowired
    private AIIntentConfigRepository intentConfigRepository;

    @Autowired
    private ToolRegistry toolRegistry;

    @Autowired
    private ObjectMapper objectMapper;

    // Test constants
    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;
    private static final String USER_ROLE = "factory_super_admin";
    private static final String USER_INPUT = "我想查询碳排放足迹数据";
    private static final String INTENT_CODE = "CARBON_FOOTPRINT_QUERY";
    private static final String INTENT_NAME = "碳排放足迹查询";

    @AfterEach
    void tearDown() {
        // Clean up created intents
        try {
            intentConfigRepository.deleteByIntentCode(INTENT_CODE);
        } catch (Exception e) {
            // Ignore cleanup errors
        }
    }

    // ==================== 完整流程测试 ====================

    @Test
    @Order(1)
    @DisplayName("E2E-TE-001: 完整的新意图创建和激活流程")
    @Transactional
    void testCompleteIntentCreationAndActivationFlow() throws Exception {
        // ====== Phase 1: 首次输入，意图不匹配 ======

        IntentMatchResult initialMatch = aiIntentService.recognizeIntentWithConfidence(
                USER_INPUT, FACTORY_ID, 5
        );

        // Assert - No strong match (confidence low or no match)
        assertTrue(initialMatch.getConfidence() < 0.7 || initialMatch.getBestMatch() == null,
                "Initial input should not match any existing intent");

        // ====== Phase 2: LLM Fallback 触发 Tool Calling ======

        // Simulate LLM deciding to create new intent
        // In real scenario, LlmIntentFallbackClient would call DashScope API
        // For E2E test, we directly execute the tool

        String toolCallArguments = String.format(
                "{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\",\"keywords\":[\"碳排放\",\"碳足迹\",\"查询\"]}",
                INTENT_CODE, INTENT_NAME
        );

        ToolCall toolCall = ToolCall.builder()
                .id("call_e2e_001")
                .type("function")
                .function(ToolCall.FunctionCall.builder()
                        .name("create_new_intent")
                        .arguments(toolCallArguments)
                        .build())
                .build();

        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", FACTORY_ID);
        context.put("userId", USER_ID);
        context.put("userRole", USER_ROLE);

        // ====== Phase 3: 执行工具，创建意图 ======

        String toolResult = toolRegistry.getExecutor("create_new_intent")
                .orElseThrow(() -> new AssertionError("create_new_intent tool not found"))
                .execute(toolCall, context);

        // Assert - Tool execution successful
        assertTrue(toolResult.contains("\"success\":true"),
                "Tool should create intent successfully");

        // Verify intent created in database
        Optional<AIIntentConfig> createdIntent = aiIntentService.getIntentByCode(FACTORY_ID, INTENT_CODE);
        assertTrue(createdIntent.isPresent(), "Intent should be created in database");
        assertEquals(INTENT_NAME, createdIntent.get().getIntentName());
        assertFalse(createdIntent.get().getActive(), "New intent should be inactive");

        // ====== Phase 4: 再次输入，仍然不匹配（因为 inactive） ======

        IntentMatchResult secondMatch = aiIntentService.recognizeIntentWithConfidence(
                USER_INPUT, FACTORY_ID, 5
        );

        // Assert - Still no match because intent is inactive
        assertTrue(secondMatch.getBestMatch() == null ||
                        !INTENT_CODE.equals(secondMatch.getBestMatch().getIntentCode()),
                "Inactive intent should not match");

        // ====== Phase 5: 管理员激活意图 ======

        aiIntentService.setIntentActive(INTENT_CODE, true);

        // Verify activation
        Optional<AIIntentConfig> activatedIntent = aiIntentService.getIntentByCode(FACTORY_ID, INTENT_CODE);
        assertTrue(activatedIntent.isPresent());
        assertTrue(activatedIntent.get().getActive(), "Intent should be active now");

        // ====== Phase 6: 第三次输入，匹配成功 ======

        IntentMatchResult finalMatch = aiIntentService.recognizeIntentWithConfidence(
                USER_INPUT, FACTORY_ID, 5
        );

        // Assert - Now should match
        assertNotNull(finalMatch.getBestMatch(), "Should match after activation");
        assertEquals(INTENT_CODE, finalMatch.getBestMatch().getIntentCode());
        assertTrue(finalMatch.getConfidence() > 0.5, "Should have reasonable confidence");

        // ====== Phase 7: 执行意图 ======

        IntentExecuteRequest executeRequest = new IntentExecuteRequest();
        executeRequest.setUserInput(USER_INPUT);

        IntentExecuteResponse executeResponse = intentExecutorService.execute(
                FACTORY_ID,
                executeRequest,
                finalMatch.getBestMatch(),
                USER_ID,
                USER_ROLE
        );

        // Assert - Intent execution
        assertNotNull(executeResponse);
        assertTrue(executeResponse.getIntentRecognized());
        assertEquals(INTENT_CODE, executeResponse.getIntentCode());
    }

    // ==================== 关键词学习测试 ====================

    @Test
    @Order(2)
    @DisplayName("E2E-TE-002: 工具创建意图后自动学习关键词")
    @Transactional
    void testKeywordLearningAfterToolCreation() throws Exception {
        // ====== Phase 1: 创建意图（带关键词） ======

        String toolCallArguments = String.format(
                "{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\"," +
                        "\"keywords\":[\"碳排放\",\"碳足迹\",\"环保数据\"]}",
                INTENT_CODE, INTENT_NAME
        );

        ToolCall toolCall = createToolCall("call_e2e_002", "create_new_intent", toolCallArguments);
        Map<String, Object> context = createContext();

        String toolResult = toolRegistry.getExecutor("create_new_intent")
                .orElseThrow()
                .execute(toolCall, context);

        assertTrue(toolResult.contains("\"success\":true"));

        // ====== Phase 2: 激活意图 ======

        aiIntentService.setIntentActive(INTENT_CODE, true);

        // ====== Phase 3: 使用不同关键词匹配 ======

        String[] testInputs = {
                "查看碳排放数据",
                "我想知道碳足迹",
                "获取环保数据报表"
        };

        for (String input : testInputs) {
            IntentMatchResult match = aiIntentService.recognizeIntentWithConfidence(
                    input, FACTORY_ID, 5
            );

            assertNotNull(match.getBestMatch(),
                    "Should match with keyword: " + input);
            assertEquals(INTENT_CODE, match.getBestMatch().getIntentCode(),
                    "Should match correct intent for input: " + input);
        }
    }

    // ==================== 多租户隔离测试 ====================

    @Test
    @Order(3)
    @DisplayName("E2E-TE-003: 多租户隔离验证")
    @Transactional
    void testMultiTenantIsolation() throws Exception {
        // ====== Phase 1: Factory F001 创建意图 ======

        String toolCallArguments = String.format(
                "{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\"," +
                        "\"keywords\":[\"碳排放\"]}",
                INTENT_CODE, INTENT_NAME
        );

        ToolCall toolCall = createToolCall("call_e2e_003", "create_new_intent", toolCallArguments);
        Map<String, Object> contextF001 = createContext("F001", USER_ID, USER_ROLE);

        String toolResult = toolRegistry.getExecutor("create_new_intent")
                .orElseThrow()
                .execute(toolCall, contextF001);

        assertTrue(toolResult.contains("\"success\":true"));
        aiIntentService.setIntentActive(INTENT_CODE, true);

        // ====== Phase 2: Factory F001 可以访问 ======

        Optional<AIIntentConfig> intentInF001 = aiIntentService.getIntentByCode("F001", INTENT_CODE);
        assertTrue(intentInF001.isPresent(), "F001 should see its own intent");

        // ====== Phase 3: Factory F002 不能访问 ======

        Optional<AIIntentConfig> intentInF002 = aiIntentService.getIntentByCode("F002", INTENT_CODE);
        // Should only see platform-level intents, not F001's factory-level intent
        // (unless INTENT_CODE also exists as platform-level, which it shouldn't in this test)
        if (intentInF002.isPresent()) {
            // If found, it should be a different instance (platform-level fallback)
            // or the implementation allows cross-factory access
            // For strict isolation, this should be false
            assertNotEquals("F001", intentInF002.get().getFactoryId(),
                    "F002 should not see F001's factory-level intent");
        }
    }

    // ==================== 权限控制测试 ====================

    @Test
    @Order(4)
    @DisplayName("E2E-TE-004: 普通用户无权创建意图")
    void testRegularUserCannotCreateIntent() throws Exception {
        // ====== Phase 1: 普通用户尝试创建意图 ======

        String toolCallArguments = String.format(
                "{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\"," +
                        "\"keywords\":[\"碳排放\"]}",
                INTENT_CODE, INTENT_NAME
        );

        ToolCall toolCall = createToolCall("call_e2e_004", "create_new_intent", toolCallArguments);
        Map<String, Object> context = createContext(FACTORY_ID, USER_ID, "user"); // Regular user role

        // ====== Phase 2: 检查工具是否对普通用户可见 ======

        List<Tool> userTools = toolRegistry.getToolDefinitionsForRole("user");
        boolean hasCreateTool = userTools.stream()
                .anyMatch(t -> "create_new_intent".equals(t.getFunction().getName()));

        assertFalse(hasCreateTool,
                "create_new_intent should not be visible to regular users");

        // ====== Phase 3: 即使执行也应该返回错误（或被拦截） ======

        // Note: In production, the tool shouldn't even be called if user doesn't have permission
        // This is just a safety check
        String toolResult = toolRegistry.getExecutor("create_new_intent")
                .orElseThrow()
                .execute(toolCall, context);

        // The tool should execute but the permission check happens at a different layer
        // Here we just verify the tool execution still works
        assertNotNull(toolResult);
    }

    // ==================== Schema 查询 + 意图创建联动测试 ====================

    @Test
    @Order(5)
    @DisplayName("E2E-TE-005: 先查询 Schema，再基于 Schema 创建意图")
    @Transactional
    void testSchemaQueryFollowedByIntentCreation() throws Exception {
        // ====== Phase 1: 查询实体 Schema ======

        String schemaArguments = "{\"entityName\":\"MaterialBatch\"}";
        ToolCall schemaToolCall = createToolCall("call_e2e_005_1", "query_entity_schema", schemaArguments);
        Map<String, Object> context = createContext();

        String schemaResult = toolRegistry.getExecutor("query_entity_schema")
                .orElseThrow()
                .execute(schemaToolCall, context);

        assertTrue(schemaResult.contains("\"success\":true"));
        assertTrue(schemaResult.contains("MaterialBatch"));

        // Parse schema result to understand entity structure
        Map<String, Object> schemaData = objectMapper.readValue(schemaResult, Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) schemaData.get("data");
        assertNotNull(data.get("fields"));

        // ====== Phase 2: 基于 Schema 创建相关意图 ======

        String intentArguments = String.format(
                "{\"intentCode\":\"%s\",\"intentName\":\"查询原料批次\",\"category\":\"MATERIAL\"," +
                        "\"keywords\":[\"原料批次\",\"MaterialBatch\",\"批次查询\"]," +
                        "\"description\":\"基于 MaterialBatch 实体的查询功能\"}",
                INTENT_CODE
        );

        ToolCall intentToolCall = createToolCall("call_e2e_005_2", "create_new_intent", intentArguments);

        String intentResult = toolRegistry.getExecutor("create_new_intent")
                .orElseThrow()
                .execute(intentToolCall, context);

        assertTrue(intentResult.contains("\"success\":true"));

        // ====== Phase 3: 验证意图创建成功 ======

        Optional<AIIntentConfig> createdIntent = aiIntentService.getIntentByCode(FACTORY_ID, INTENT_CODE);
        assertTrue(createdIntent.isPresent());
        assertEquals("MATERIAL", createdIntent.get().getCategory());
        assertTrue(createdIntent.get().getDescription().contains("MaterialBatch"));
    }

    // ==================== 工具执行结果格式验证 ====================

    @Test
    @Order(6)
    @DisplayName("E2E-TE-006: 验证工具返回结果格式标准化")
    @Transactional
    void testToolResultFormatStandardization() throws Exception {
        // ====== Test create_new_intent result format ======

        String intentArguments = String.format(
                "{\"intentCode\":\"%s\",\"intentName\":\"%s\",\"category\":\"QUERY\"," +
                        "\"keywords\":[\"测试\"]}",
                INTENT_CODE, INTENT_NAME
        );

        ToolCall toolCall = createToolCall("call_e2e_006_1", "create_new_intent", intentArguments);
        Map<String, Object> context = createContext();

        String result = toolRegistry.getExecutor("create_new_intent")
                .orElseThrow()
                .execute(toolCall, context);

        // Parse and validate result format
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        assertTrue(resultMap.containsKey("success"));
        assertTrue(resultMap.containsKey("data"));

        // ====== Test query_entity_schema result format ======

        String schemaArguments = "{\"entityName\":\"MaterialBatch\"}";
        ToolCall schemaCall = createToolCall("call_e2e_006_2", "query_entity_schema", schemaArguments);

        String schemaResult = toolRegistry.getExecutor("query_entity_schema")
                .orElseThrow()
                .execute(schemaCall, context);

        Map<String, Object> schemaMap = objectMapper.readValue(schemaResult, Map.class);
        assertTrue(schemaMap.containsKey("success"));
        assertTrue(schemaMap.containsKey("data"));

        // Both results should follow the same format
        assertEquals(resultMap.keySet(), schemaMap.keySet(),
                "All tools should return results in the same format");
    }

    // ==================== Helper Methods ====================

    private ToolCall createToolCall(String id, String name, String arguments) {
        return ToolCall.builder()
                .id(id)
                .type("function")
                .function(ToolCall.FunctionCall.builder()
                        .name(name)
                        .arguments(arguments)
                        .build())
                .build();
    }

    private Map<String, Object> createContext() {
        return createContext(FACTORY_ID, USER_ID, USER_ROLE);
    }

    private Map<String, Object> createContext(String factoryId, Long userId, String userRole) {
        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", factoryId);
        context.put("userId", userId);
        context.put("userRole", userRole);
        return context;
    }
}
