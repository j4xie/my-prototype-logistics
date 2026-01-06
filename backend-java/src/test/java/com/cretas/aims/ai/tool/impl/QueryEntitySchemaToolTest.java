package com.cretas.aims.ai.tool.impl;

import com.cretas.aims.ai.dto.ToolCall;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.persistence.EntityManager;
import javax.persistence.metamodel.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * QueryEntitySchemaTool 单元测试
 *
 * 测试覆盖:
 * - UT-QEST-001~005: 实体名称映射测试
 * - UT-QEST-010~013: Schema 提取测试
 * - UT-QEST-020~023: 错误处理测试
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("QueryEntitySchemaTool 单元测试")
@ExtendWith(MockitoExtension.class)
class QueryEntitySchemaToolTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private Metamodel metamodel;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private QueryEntitySchemaTool queryEntitySchemaTool;

    // Test constants
    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;

    @BeforeEach
    void setUp() {
        when(entityManager.getMetamodel()).thenReturn(metamodel);
    }

    // ==================== 基础方法测试 ====================

    @Nested
    @DisplayName("基础方法测试")
    class BasicMethodTests {

        @Test
        @DisplayName("getToolName() 返回正确的工具名称")
        void testGetToolName() {
            assertEquals("query_entity_schema", queryEntitySchemaTool.getToolName());
        }

        @Test
        @DisplayName("getDescription() 返回非空描述")
        void testGetDescription() {
            String description = queryEntitySchemaTool.getDescription();
            assertNotNull(description);
            assertFalse(description.isEmpty());
            assertTrue(description.contains("Schema"));
        }

        @Test
        @DisplayName("requiresPermission() 返回 false")
        void testRequiresPermission() {
            assertFalse(queryEntitySchemaTool.requiresPermission());
        }

        @Test
        @DisplayName("isEnabled() 默认返回 true")
        void testIsEnabled() {
            assertTrue(queryEntitySchemaTool.isEnabled());
        }
    }

    // ==================== 参数 Schema 测试 ====================

    @Nested
    @DisplayName("参数 Schema 测试")
    class ParameterSchemaTests {

        @Test
        @DisplayName("getParametersSchema() 返回有效的 JSON Schema")
        void testGetParametersSchemaReturnsValidSchema() {
            // Act
            Map<String, Object> schema = queryEntitySchemaTool.getParametersSchema();

            // Assert
            assertNotNull(schema);
            assertEquals("object", schema.get("type"));
            assertTrue(schema.containsKey("properties"));
            assertTrue(schema.containsKey("required"));
        }

        @Test
        @DisplayName("Schema 包含 entityName 必需参数")
        void testSchemaContainsEntityName() {
            // Act
            Map<String, Object> schema = queryEntitySchemaTool.getParametersSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
            @SuppressWarnings("unchecked")
            List<String> required = (List<String>) schema.get("required");

            // Assert
            assertTrue(properties.containsKey("entityName"));
            assertEquals(1, required.size());
            assertTrue(required.contains("entityName"));
        }

        @Test
        @DisplayName("entityName 参数描述支持多种格式")
        void testEntityNameDescriptionMentionsFormats() {
            // Act
            Map<String, Object> schema = queryEntitySchemaTool.getParametersSchema();
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
            @SuppressWarnings("unchecked")
            Map<String, Object> entityName = (Map<String, Object>) properties.get("entityName");
            String description = (String) entityName.get("description");

            // Assert
            assertTrue(description.contains("中文") || description.contains("英文") || description.contains("下划线"));
        }
    }

    // ==================== 实体名称映射测试 ====================

    @Nested
    @DisplayName("实体名称映射测试")
    class EntityNameMappingTests {

        @Test
        @DisplayName("UT-QEST-001: 中文实体名称映射成功")
        void testChineseEntityNameMapping() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("原料批次");
            Map<String, Object> context = createContext();
            mockEntityType("MaterialBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
            assertTrue(result.contains("MaterialBatch"));
        }

        @ParameterizedTest
        @DisplayName("UT-QEST-002: 支持多种命名格式")
        @ValueSource(strings = {"MaterialBatch", "materialbatch", "material_batch"})
        void testMultipleNamingFormats(String entityName) throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall(entityName);
            Map<String, Object> context = createContext();
            mockEntityType("MaterialBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
            assertTrue(result.contains("MaterialBatch"));
        }

        @Test
        @DisplayName("UT-QEST-003: PascalCase 格式直接识别")
        void testPascalCaseDirectRecognition() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("ProcessingBatch");
            Map<String, Object> context = createContext();
            mockEntityType("ProcessingBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
            assertTrue(result.contains("ProcessingBatch"));
        }

        @Test
        @DisplayName("UT-QEST-004: 未知实体名称返回错误")
        void testUnknownEntityNameReturnsError() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("UnknownEntity");
            Map<String, Object> context = createContext();
            when(metamodel.getEntities()).thenReturn(Collections.emptySet());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
            assertTrue(result.contains("实体不存在") || result.contains("未识别"));
        }

        @Test
        @DisplayName("UT-QEST-005: 大小写不敏感匹配")
        void testCaseInsensitiveMatching() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MATERIALBATCH");
            Map<String, Object> context = createContext();
            mockEntityType("MaterialBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
        }
    }

    // ==================== Schema 提取测试 ====================

    @Nested
    @DisplayName("Schema 提取测试")
    class SchemaExtractionTests {

        @Test
        @DisplayName("UT-QEST-010: Schema 包含实体名称")
        void testSchemaContainsEntityName() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MaterialBatch");
            Map<String, Object> context = createContext();
            mockEntityType("MaterialBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);
            Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resultMap.get("data");

            // Assert
            assertEquals("MaterialBatch", data.get("entityName"));
        }

        @Test
        @DisplayName("UT-QEST-011: Schema 包含 Java 类名")
        void testSchemaContainsJavaClass() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MaterialBatch");
            Map<String, Object> context = createContext();
            mockEntityType("MaterialBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);
            Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resultMap.get("data");

            // Assert
            assertNotNull(data.get("javaClass"));
            assertTrue(data.get("javaClass").toString().contains("MaterialBatch"));
        }

        @Test
        @DisplayName("UT-QEST-012: Schema 包含字段列表")
        void testSchemaContainsFieldsList() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MaterialBatch");
            Map<String, Object> context = createContext();
            List<Attribute<?, ?>> attributes = createMockAttributes();
            mockEntityType("MaterialBatch", attributes);

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);
            Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resultMap.get("data");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> fields = (List<Map<String, Object>>) data.get("fields");

            // Assert
            assertNotNull(fields);
            assertEquals(attributes.size(), fields.size());
        }

        @Test
        @DisplayName("UT-QEST-013: 字段信息包含名称和类型")
        void testFieldInfoContainsNameAndType() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MaterialBatch");
            Map<String, Object> context = createContext();
            mockEntityType("MaterialBatch", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);
            Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resultMap.get("data");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> fields = (List<Map<String, Object>>) data.get("fields");
            Map<String, Object> firstField = fields.get(0);

            // Assert
            assertTrue(firstField.containsKey("name"));
            assertTrue(firstField.containsKey("javaType"));
            assertTrue(firstField.containsKey("persistent"));
            assertTrue(firstField.containsKey("collection"));
        }

        @Test
        @DisplayName("UT-QEST-014: Schema 包含字段计数")
        void testSchemaContainsFieldCount() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MaterialBatch");
            Map<String, Object> context = createContext();
            List<Attribute<?, ?>> attributes = createMockAttributes();
            mockEntityType("MaterialBatch", attributes);

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);
            Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resultMap.get("data");

            // Assert
            assertEquals(attributes.size(), data.get("fieldCount"));
        }
    }

    // ==================== 错误处理测试 ====================

    @Nested
    @DisplayName("错误处理测试")
    class ErrorHandlingTests {

        @Test
        @DisplayName("UT-QEST-020: 缺少 entityName 参数返回错误")
        void testMissingEntityNameReturnsError() throws Exception {
            // Arrange
            String argumentsJson = "{}";
            ToolCall toolCall = createToolCall(argumentsJson);
            Map<String, Object> context = createContext();

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
        }

        @Test
        @DisplayName("UT-QEST-021: 无效的 JSON 参数返回错误")
        void testInvalidJsonReturnsError() throws Exception {
            // Arrange
            String invalidJson = "{invalid json}";
            ToolCall toolCall = ToolCall.builder()
                    .id("call_123")
                    .type("function")
                    .function(ToolCall.FunctionCall.builder()
                            .name("query_entity_schema")
                            .arguments(invalidJson)
                            .build())
                    .build();
            Map<String, Object> context = createContext();

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
        }

        @Test
        @DisplayName("UT-QEST-022: EntityManager 异常返回错误响应")
        void testEntityManagerExceptionReturnsError() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("MaterialBatch");
            Map<String, Object> context = createContext();

            when(entityManager.getMetamodel()).thenThrow(new RuntimeException("Database connection failed"));

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
            assertTrue(result.contains("查询Schema失败"));
        }

        @Test
        @DisplayName("UT-QEST-023: 实体不在 Metamodel 中返回错误")
        void testEntityNotInMetamodelReturnsError() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("NonExistentEntity");
            Map<String, Object> context = createContext();
            when(metamodel.getEntities()).thenReturn(Collections.emptySet());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":false"));
            assertTrue(result.contains("实体不存在") || result.contains("未识别"));
        }
    }

    // ==================== 特殊实体测试 ====================

    @Nested
    @DisplayName("特殊实体测试")
    class SpecialEntitiesTests {

        @ParameterizedTest
        @DisplayName("常见实体名称别名测试")
        @ValueSource(strings = {"原料批次", "生产批次", "产品类型", "质检记录", "出货记录"})
        void testCommonEntityAliases(String chineseName) throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall(chineseName);
            Map<String, Object> context = createContext();

            // Map Chinese names to entity types
            String entityName = getEntityNameForChinese(chineseName);
            mockEntityType(entityName, createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
        }

        @Test
        @DisplayName("设备实体支持简写")
        void testEquipmentEntityShorthand() throws Exception {
            // Arrange
            ToolCall toolCall = createToolCall("设备");
            Map<String, Object> context = createContext();
            mockEntityType("Equipment", createMockAttributes());

            // Act
            String result = queryEntitySchemaTool.execute(toolCall, context);

            // Assert
            assertTrue(result.contains("\"success\":true"));
            assertTrue(result.contains("Equipment"));
        }

        @Test
        @DisplayName("考勤记录多格式支持")
        void testAttendanceRecordMultiFormat() throws Exception {
            // Arrange
            String[] formats = {"考勤", "AttendanceRecord", "attendance_record"};

            for (String format : formats) {
                ToolCall toolCall = createToolCall(format);
                Map<String, Object> context = createContext();
                mockEntityType("AttendanceRecord", createMockAttributes());

                // Act
                String result = queryEntitySchemaTool.execute(toolCall, context);

                // Assert
                assertTrue(result.contains("\"success\":true"), "Failed for format: " + format);
            }
        }
    }

    // ==================== Helper Methods ====================

    private ToolCall createToolCall(String entityName) {
        String argumentsJson = "{\"entityName\":\"" + entityName + "\"}";
        return createToolCall(argumentsJson);
    }

    private ToolCall createToolCall(String argumentsJson) {
        return ToolCall.builder()
                .id("call_123")
                .type("function")
                .function(ToolCall.FunctionCall.builder()
                        .name("query_entity_schema")
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

    private void mockEntityType(String entityName, List<Attribute<?, ?>> attributes) {
        @SuppressWarnings("unchecked")
        EntityType<Object> entityType = mock(EntityType.class);

        when(entityType.getName()).thenReturn(entityName);
        when(entityType.getJavaType()).thenReturn((Class) Object.class);

        // Mock getAttributes to return Set
        Set<Attribute<?, ?>> attributeSet = new HashSet<>(attributes);
        @SuppressWarnings("unchecked")
        Set<Attribute<Object, ?>> typedAttributeSet = (Set) attributeSet;
        when(entityType.getAttributes()).thenReturn(typedAttributeSet);

        Set<EntityType<?>> entities = new HashSet<>();
        entities.add(entityType);
        when(metamodel.getEntities()).thenReturn(entities);
    }

    private List<Attribute<?, ?>> createMockAttributes() {
        List<Attribute<?, ?>> attributes = new ArrayList<>();

        // Mock id attribute
        Attribute<?, ?> idAttr = createMockAttribute("id", Long.class, false, false);
        attributes.add(idAttr);

        // Mock batchNumber attribute
        Attribute<?, ?> batchNumberAttr = createMockAttribute("batchNumber", String.class, false, false);
        attributes.add(batchNumberAttr);

        // Mock createdAt attribute
        Attribute<?, ?> createdAtAttr = createMockAttribute("createdAt", java.time.LocalDateTime.class, false, false);
        attributes.add(createdAtAttr);

        return attributes;
    }

    @SuppressWarnings("unchecked")
    private Attribute<?, ?> createMockAttribute(String name, Class<?> type, boolean isAssociation, boolean isCollection) {
        Attribute<Object, Object> attribute = mock(Attribute.class);
        when(attribute.getName()).thenReturn(name);
        when(attribute.getJavaType()).thenReturn((Class) type);
        when(attribute.isAssociation()).thenReturn(isAssociation);
        when(attribute.isCollection()).thenReturn(isCollection);
        return attribute;
    }

    private String getEntityNameForChinese(String chineseName) {
        switch (chineseName) {
            case "原料批次":
                return "MaterialBatch";
            case "生产批次":
                return "ProcessingBatch";
            case "产品类型":
                return "ProductType";
            case "质检记录":
                return "QualityCheckRecord";
            case "出货记录":
                return "ShipmentRecord";
            default:
                return "Unknown";
        }
    }
}
