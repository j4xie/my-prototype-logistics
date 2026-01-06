package com.cretas.aims.ai.tool.impl;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CreateIntentTool 单元测试
 *
 * 测试覆盖:
 * - UT-CIT-001~005: 参数解析测试
 * - UT-CIT-010~013: 意图创建测试
 * - UT-CIT-020~023: 权限检查测试
 * - UT-CIT-030~033: 错误处理测试
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("CreateIntentTool 单元测试")
@ExtendWith(MockitoExtension.class)
class CreateIntentToolTest {

    @Mock
    private AIIntentService aiIntentService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private CreateIntentTool createIntentTool;

    // Test constants
    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;
    private static final String INTENT_CODE = "QUERY_MATERIAL_BATCH";
    private static final String INTENT_NAME = "查询原料批次";
    private static final String CATEGORY = "QUERY";

    @BeforeEach
    void setUp() {
        // ObjectMapper is already injected via @Spy and @InjectMocks
    }

    // ==================== 基础方法测试 ====================

    @Nested
    @DisplayName("基础方法测试")
    class BasicMethodTests {

        @Test
        @DisplayName("getToolName() 返回正确的工具名称")
        void testGetToolName() {
            assertEquals("create_new_intent", createIntentTool.getToolName());
        }

        @Test
        @DisplayName("getDescription() 返回非空描述")
        void testGetDescription() {
            String description = createIntentTool.getDescription();
            assertNotNull(description);
            assertFalse(description.isEmpty());
            assertTrue(description.contains("意图"));
        }

        @Test
        @DisplayName("isEnabled() 默认返回 true")
        void testIsEnabled() {
            assertTrue(createIntentTool.isEnabled());
        }

        @Test
        @DisplayName("requiresPermission() 返回 true")
        void testRequiresPermission() {
            assertTrue(createIntentTool.requiresPermission());
        }
    }

    // ==================== 参数 Schema 测试 ====================

    @Nested
    @DisplayName("参数 Schema 测试")
    class ParameterSchemaTests {

        @Test
        @DisplayName("UT-CIT-001: getParametersSchema() 返回有效的 JSON Schema")
        void testGetParametersSchemaReturnsValidSchema() {
            // Act
            Map<String, Object> schema = createIntentTool.getParametersSchema();

            // Assert
            assertNotNull(schema);
            assertEquals("object", schema.get("type"));
            assertTrue(schema.containsKey("properties"));
            assertTrue(schema.containsKey("required"));
        }

        @Test
        @DisplayName("UT-CIT-002: Schema 包含所有必需字段")
        void testSchemaContainsRequiredFields() {
            // Act
            Map<String, Object> schema = createIntentTool.getParametersSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
            @SuppressWarnings("unchecked")
            List<String> required = (List<String>) schema.get("required");

            // Assert
            assertTrue(properties.containsKey("intentCode"));
            assertTrue(properties.containsKey("intentName"));
            assertTrue(properties.containsKey("category"));
            assertTrue(properties.containsKey("keywords"));

            assertEquals(4, required.size());
            assertTrue(required.contains("intentCode"));
            assertTrue(required.contains("intentName"));
            assertTrue(required.contains("category"));
            assertTrue(required.contains("keywords"));
        }

        @Test
        @DisplayName("UT-CIT-003: Schema 包含可选字段")
        void testSchemaContainsOptionalFields() {
            // Act
            Map<String, Object> schema = createIntentTool.getParametersSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) schema.get("properties");

            // Assert
            assertTrue(properties.containsKey("description"));
            assertTrue(properties.containsKey("semanticDomain"));
            assertTrue(properties.containsKey("semanticAction"));
            assertTrue(properties.containsKey("semanticObject"));
            assertTrue(properties.containsKey("sensitivityLevel"));
        }

        @Test
        @DisplayName("UT-CIT-004: category 枚举值正确")
        void testCategoryEnumValues() {
            // Act
            Map<String, Object> schema = createIntentTool.getParametersSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
            @SuppressWarnings("unchecked")
            Map<String, Object> category = (Map<String, Object>) properties.get("category");
            @SuppressWarnings("unchecked")
            List<String> enumValues = (List<String>) category.get("enum");

            // Assert
            assertNotNull(enumValues);
            assertTrue(enumValues.contains("QUERY"));
            assertTrue(enumValues.contains("DATA_OP"));
            assertTrue(enumValues.contains("FORM"));
            assertTrue(enumValues.contains("MATERIAL"));
            assertTrue(enumValues.contains("QUALITY"));
        }

        @Test
        @DisplayName("UT-CIT-005: keywords 定义为数组类型")
        void testKeywordsDefinedAsArray() {
            // Act
            Map<String, Object> schema = createIntentTool.getParametersSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
            @SuppressWarnings("unchecked")
            Map<String, Object> keywords = (Map<String, Object>) properties.get("keywords");

            // Assert
            assertEquals("array", keywords.get("type"));
            assertTrue(keywords.containsKey("items"));
            assertEquals(2, keywords.get("minItems"));
            assertEquals(10, keywords.get("maxItems"));
        }
    }

    // ==================== 意图创建测试 ====================

    @Nested
    @DisplayName("意图创建测试")
    class IntentCreationTests {

        @Test
        @DisplayName("UT-CIT-010: 成功创建意图")
        void testCreateIntentSuccess() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = createContext();

            AIIntentConfig createdIntent = new AIIntentConfig();
            createdIntent.setIntentCode(INTENT_CODE);
            createdIntent.setIntentName(INTENT_NAME);
            createdIntent.setCategory(CATEGORY);
            createdIntent.setActive(false);

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenReturn(createdIntent);

            // Act
            String result = createIntentTool.execute(toolCall, context);

            // Assert
            assertNotNull(result);
            assertTrue(result.contains("\"success\":true"));
            assertTrue(result.contains(INTENT_CODE));
            verify(aiIntentService, times(1)).createIntent(any(AIIntentConfig.class));
        }

        @Test
        @DisplayName("UT-CIT-011: 创建的意图默认为 inactive 状态")
        void testCreatedIntentIsInactive() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                // Verify it's created as inactive
                assertFalse(config.getActive());
                return config;
            });

            // Act
            String result = createIntentTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
            verify(aiIntentService).createIntent(argThat(config -> !config.getActive()));
        }

        @Test
        @DisplayName("UT-CIT-012: 创建的意图包含工厂ID")
        void testCreatedIntentContainsFactoryId() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                assertEquals(FACTORY_ID, config.getFactoryId());
                return config;
            });

            // Act
            createIntentTool.execute(toolCall, context);

            // Assert
            verify(aiIntentService).createIntent(argThat(config -> FACTORY_ID.equals(config.getFactoryId())));
        }

        @Test
        @DisplayName("UT-CIT-013: 关键词正确序列化为 JSON")
        void testKeywordsSerializedCorrectly() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                String keywordsJson = config.getKeywords();
                assertNotNull(keywordsJson);
                // Verify it's valid JSON array
                assertTrue(keywordsJson.startsWith("["));
                assertTrue(keywordsJson.endsWith("]"));
                return config;
            });

            // Act
            createIntentTool.execute(toolCall, context);

            // Assert
            verify(aiIntentService).createIntent(any(AIIntentConfig.class));
        }
    }

    // ==================== 权限检查测试 ====================

    @Nested
    @DisplayName("权限检查测试")
    class PermissionTests {

        @Test
        @DisplayName("UT-CIT-020: super_admin 有权限")
        void testSuperAdminHasPermission() {
            assertTrue(createIntentTool.hasPermission("super_admin"));
        }

        @Test
        @DisplayName("UT-CIT-021: factory_super_admin 有权限")
        void testFactorySuperAdminHasPermission() {
            assertTrue(createIntentTool.hasPermission("factory_super_admin"));
        }

        @Test
        @DisplayName("UT-CIT-022: platform_admin 有权限")
        void testPlatformAdminHasPermission() {
            assertTrue(createIntentTool.hasPermission("platform_admin"));
        }

        @Test
        @DisplayName("UT-CIT-023: 普通用户无权限")
        void testRegularUserNoPermission() {
            assertFalse(createIntentTool.hasPermission("user"));
            assertFalse(createIntentTool.hasPermission("worker"));
            assertFalse(createIntentTool.hasPermission("operator"));
        }
    }

    // ==================== 错误处理测试 ====================

    @Nested
    @DisplayName("错误处理测试")
    class ErrorHandlingTests {

        @Test
        @DisplayName("UT-CIT-030: 缺少必需参数返回错误")
        void testMissingRequiredParamReturnsError() throws Exception {
            // Arrange - missing keywords
            String argumentsJson = "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME + "\",\"category\":\"" + CATEGORY + "\"}";
            ToolCall toolCall = createToolCall(argumentsJson);
            Map<String, Object> context = createContext();

            // Act
            String result = createIntentTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
            assertTrue(result.contains("keywords"));
        }

        @Test
        @DisplayName("UT-CIT-031: 无效的 JSON 参数返回错误")
        void testInvalidJsonReturnsError() throws Exception {
            // Arrange
            String invalidJson = "{invalid json}";
            ToolCall toolCall = createToolCall(invalidJson);
            Map<String, Object> context = createContext();

            // Act
            String result = createIntentTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
        }

        @Test
        @DisplayName("UT-CIT-032: 服务异常返回错误响应")
        void testServiceExceptionReturnsError() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class)))
                    .thenThrow(new RuntimeException("Database connection failed"));

            // Act
            String result = createIntentTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
            assertTrue(result.contains("创建意图失败"));
        }

        @Test
        @DisplayName("UT-CIT-033: 缺少 context 必需字段返回错误")
        void testMissingContextFieldsReturnsError() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = new HashMap<>();
            // Missing factoryId and userId

            // Act & Assert
            assertThrows(IllegalArgumentException.class, () -> {
                createIntentTool.execute(toolCall, context);
            });
        }

        @Test
        @DisplayName("UT-CIT-034: 空 keywords 列表返回错误")
        void testEmptyKeywordsReturnsError() throws Exception {
            // Arrange
            String argumentsJson = "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME + "\",\"category\":\"" + CATEGORY + "\",\"keywords\":[]}";
            ToolCall toolCall = createToolCall(argumentsJson);
            Map<String, Object> context = createContext();

            // Act
            String result = createIntentTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
            assertTrue(result.contains("keywords"));
        }
    }

    // ==================== 可选参数测试 ====================

    @Nested
    @DisplayName("可选参数测试")
    class OptionalParametersTests {

        @Test
        @DisplayName("带 description 参数创建意图")
        void testCreateIntentWithDescription() throws Exception {
            // Arrange
            String description = "这是一个用于查询原料批次的意图";
            String argumentsJson = "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME +
                    "\",\"category\":\"" + CATEGORY + "\",\"keywords\":[\"原料\",\"批次\",\"查询\"],\"description\":\"" + description + "\"}";
            ToolCall toolCall = createToolCall(argumentsJson);
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                assertEquals(description, config.getDescription());
                return config;
            });

            // Act
            createIntentTool.execute(toolCall, context);

            // Assert
            verify(aiIntentService).createIntent(any(AIIntentConfig.class));
        }

        @Test
        @DisplayName("带语义分类参数创建意图")
        void testCreateIntentWithSemanticFields() throws Exception {
            // Arrange
            String argumentsJson = "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME +
                    "\",\"category\":\"" + CATEGORY + "\",\"keywords\":[\"原料\",\"批次\"]," +
                    "\"semanticDomain\":\"物料\",\"semanticAction\":\"查询\",\"semanticObject\":\"批次\"}";
            ToolCall toolCall = createToolCall(argumentsJson);
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                assertEquals("物料", config.getSemanticDomain());
                assertEquals("查询", config.getSemanticAction());
                assertEquals("批次", config.getSemanticObject());
                return config;
            });

            // Act
            createIntentTool.execute(toolCall, context);

            // Assert
            verify(aiIntentService).createIntent(any(AIIntentConfig.class));
        }

        @Test
        @DisplayName("带 sensitivityLevel 参数创建意图")
        void testCreateIntentWithSensitivityLevel() throws Exception {
            // Arrange
            String argumentsJson = "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME +
                    "\",\"category\":\"" + CATEGORY + "\",\"keywords\":[\"原料\",\"批次\"],\"sensitivityLevel\":\"HIGH\"}";
            ToolCall toolCall = createToolCall(argumentsJson);
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                assertEquals("HIGH", config.getSensitivityLevel());
                return config;
            });

            // Act
            createIntentTool.execute(toolCall, context);

            // Assert
            verify(aiIntentService).createIntent(any(AIIntentConfig.class));
        }

        @Test
        @DisplayName("未提供 sensitivityLevel 时使用默认值 MEDIUM")
        void testDefaultSensitivityLevel() throws Exception {
            // Arrange
            ToolCall toolCall = createValidToolCall();
            Map<String, Object> context = createContext();

            when(aiIntentService.createIntent(any(AIIntentConfig.class))).thenAnswer(invocation -> {
                AIIntentConfig config = invocation.getArgument(0);
                assertEquals("MEDIUM", config.getSensitivityLevel());
                return config;
            });

            // Act
            createIntentTool.execute(toolCall, context);

            // Assert
            verify(aiIntentService).createIntent(any(AIIntentConfig.class));
        }
    }

    // ==================== Helper Methods ====================

    private ToolCall createValidToolCall() {
        String argumentsJson = "{\"intentCode\":\"" + INTENT_CODE + "\",\"intentName\":\"" + INTENT_NAME +
                "\",\"category\":\"" + CATEGORY + "\",\"keywords\":[\"原料\",\"批次\",\"查询\"]}";
        return createToolCall(argumentsJson);
    }

    private ToolCall createToolCall(String argumentsJson) {
        return ToolCall.builder()
                .id("call_123")
                .type("function")
                .function(ToolCall.FunctionCall.builder()
                        .name("create_new_intent")
                        .arguments(argumentsJson)
                        .build())
                .build();
    }

    private Map<String, Object> createContext() {
        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", FACTORY_ID);
        context.put("userId", USER_ID);
        context.put("userRole", "factory_super_admin");
        return context;
    }
}
