package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.dto.Tool;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * ToolRegistry 单元测试
 *
 * 测试覆盖:
 * - UT-TR-001~005: 工具注册测试
 * - UT-TR-010~013: 工具获取测试
 * - UT-TR-020~022: 权限过滤测试
 * - UT-TR-030~032: Tool Definition 生成测试
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("ToolRegistry 单元测试")
@ExtendWith(MockitoExtension.class)
class ToolRegistryTest {

    private ToolRegistry toolRegistry;

    @Mock
    private ToolExecutor mockTool1;

    @Mock
    private ToolExecutor mockTool2;

    @Mock
    private ToolExecutor mockToolDisabled;

    @Mock
    private ToolExecutor mockToolWithPermission;

    // Test constants
    private static final String TOOL_1_NAME = "test_tool_1";
    private static final String TOOL_2_NAME = "test_tool_2";
    private static final String DISABLED_TOOL_NAME = "disabled_tool";
    private static final String PERMISSION_TOOL_NAME = "admin_only_tool";

    @BeforeEach
    void setUp() {
        // Setup mock tool 1
        when(mockTool1.getToolName()).thenReturn(TOOL_1_NAME);
        when(mockTool1.isEnabled()).thenReturn(true);
        when(mockTool1.requiresPermission()).thenReturn(false);
        when(mockTool1.getDescription()).thenReturn("Test Tool 1");
        when(mockTool1.getParametersSchema()).thenReturn(createMockSchema());

        // Setup mock tool 2
        when(mockTool2.getToolName()).thenReturn(TOOL_2_NAME);
        when(mockTool2.isEnabled()).thenReturn(true);
        when(mockTool2.requiresPermission()).thenReturn(false);
        when(mockTool2.getDescription()).thenReturn("Test Tool 2");
        when(mockTool2.getParametersSchema()).thenReturn(createMockSchema());

        // Setup disabled tool
        when(mockToolDisabled.getToolName()).thenReturn(DISABLED_TOOL_NAME);
        when(mockToolDisabled.isEnabled()).thenReturn(false);

        // Setup tool with permission
        when(mockToolWithPermission.getToolName()).thenReturn(PERMISSION_TOOL_NAME);
        when(mockToolWithPermission.isEnabled()).thenReturn(true);
        when(mockToolWithPermission.requiresPermission()).thenReturn(true);
        when(mockToolWithPermission.hasPermission("super_admin")).thenReturn(true);
        when(mockToolWithPermission.hasPermission("factory_super_admin")).thenReturn(true);
        when(mockToolWithPermission.hasPermission("user")).thenReturn(false);
        when(mockToolWithPermission.getDescription()).thenReturn("Admin Only Tool");
        when(mockToolWithPermission.getParametersSchema()).thenReturn(createMockSchema());

        // Create registry
        toolRegistry = new ToolRegistry();
    }

    // ==================== 工具注册测试 ====================

    @Nested
    @DisplayName("工具注册测试")
    class ToolRegistrationTests {

        @Test
        @DisplayName("UT-TR-001: 成功注册单个工具")
        void testRegisterSingleTool() {
            // Arrange
            setToolExecutors(List.of(mockTool1));

            // Act
            toolRegistry.init();

            // Assert
            assertTrue(toolRegistry.hasExecutor(TOOL_1_NAME));
            assertEquals(1, toolRegistry.getToolCount());
        }

        @Test
        @DisplayName("UT-TR-002: 成功注册多个工具")
        void testRegisterMultipleTools() {
            // Arrange
            setToolExecutors(List.of(mockTool1, mockTool2));

            // Act
            toolRegistry.init();

            // Assert
            assertTrue(toolRegistry.hasExecutor(TOOL_1_NAME));
            assertTrue(toolRegistry.hasExecutor(TOOL_2_NAME));
            assertEquals(2, toolRegistry.getToolCount());
        }

        @Test
        @DisplayName("UT-TR-003: 禁用的工具不被注册")
        void testDisabledToolNotRegistered() {
            // Arrange
            setToolExecutors(List.of(mockTool1, mockToolDisabled));

            // Act
            toolRegistry.init();

            // Assert
            assertTrue(toolRegistry.hasExecutor(TOOL_1_NAME));
            assertFalse(toolRegistry.hasExecutor(DISABLED_TOOL_NAME));
            assertEquals(1, toolRegistry.getToolCount());
        }

        @Test
        @DisplayName("UT-TR-004: 空工具名称的工具不被注册")
        void testEmptyNameToolNotRegistered() {
            // Arrange
            ToolExecutor emptyNameTool = mock(ToolExecutor.class);
            when(emptyNameTool.getToolName()).thenReturn("");
            when(emptyNameTool.isEnabled()).thenReturn(true);
            setToolExecutors(List.of(mockTool1, emptyNameTool));

            // Act
            toolRegistry.init();

            // Assert
            assertEquals(1, toolRegistry.getToolCount());
            assertTrue(toolRegistry.hasExecutor(TOOL_1_NAME));
        }

        @Test
        @DisplayName("UT-TR-005: 工具名称冲突时后者不被注册")
        void testDuplicateToolNameNotRegistered() {
            // Arrange
            ToolExecutor duplicateTool = mock(ToolExecutor.class);
            when(duplicateTool.getToolName()).thenReturn(TOOL_1_NAME); // Same name
            when(duplicateTool.isEnabled()).thenReturn(true);
            setToolExecutors(List.of(mockTool1, duplicateTool));

            // Act
            toolRegistry.init();

            // Assert
            assertEquals(1, toolRegistry.getToolCount());
            // Should keep the first one
            assertEquals(mockTool1, toolRegistry.getExecutor(TOOL_1_NAME).orElse(null));
        }
    }

    // ==================== 工具获取测试 ====================

    @Nested
    @DisplayName("工具获取测试")
    class ToolRetrievalTests {

        @BeforeEach
        void setUpRegistry() {
            setToolExecutors(List.of(mockTool1, mockTool2));
            toolRegistry.init();
        }

        @Test
        @DisplayName("UT-TR-010: getExecutor() 返回已注册的工具")
        void testGetExecutorReturnsRegisteredTool() {
            // Act
            Optional<ToolExecutor> result = toolRegistry.getExecutor(TOOL_1_NAME);

            // Assert
            assertTrue(result.isPresent());
            assertEquals(mockTool1, result.get());
        }

        @Test
        @DisplayName("UT-TR-011: getExecutor() 对未知工具返回空")
        void testGetExecutorReturnsEmptyForUnknown() {
            // Act
            Optional<ToolExecutor> result = toolRegistry.getExecutor("unknown_tool");

            // Assert
            assertFalse(result.isPresent());
        }

        @Test
        @DisplayName("UT-TR-012: hasExecutor() 对已注册工具返回 true")
        void testHasExecutorReturnsTrueForRegistered() {
            // Act & Assert
            assertTrue(toolRegistry.hasExecutor(TOOL_1_NAME));
            assertTrue(toolRegistry.hasExecutor(TOOL_2_NAME));
        }

        @Test
        @DisplayName("UT-TR-013: hasExecutor() 对未知工具返回 false")
        void testHasExecutorReturnsFalseForUnknown() {
            // Act & Assert
            assertFalse(toolRegistry.hasExecutor("unknown_tool"));
        }

        @Test
        @DisplayName("UT-TR-014: getAllToolNames() 返回所有工具名称")
        void testGetAllToolNames() {
            // Act
            List<String> names = toolRegistry.getAllToolNames();

            // Assert
            assertEquals(2, names.size());
            assertTrue(names.contains(TOOL_1_NAME));
            assertTrue(names.contains(TOOL_2_NAME));
        }
    }

    // ==================== 权限过滤测试 ====================

    @Nested
    @DisplayName("权限过滤测试")
    class PermissionFilteringTests {

        @BeforeEach
        void setUpRegistry() {
            setToolExecutors(List.of(mockTool1, mockToolWithPermission));
            toolRegistry.init();
        }

        @Test
        @DisplayName("UT-TR-020: getAllToolDefinitions() 返回所有工具（不过滤权限）")
        void testGetAllToolDefinitionsReturnsAll() {
            // Act
            List<Tool> tools = toolRegistry.getAllToolDefinitions();

            // Assert
            assertEquals(2, tools.size());
            assertTrue(tools.stream().anyMatch(t -> t.getFunction().getName().equals(TOOL_1_NAME)));
            assertTrue(tools.stream().anyMatch(t -> t.getFunction().getName().equals(PERMISSION_TOOL_NAME)));
        }

        @Test
        @DisplayName("UT-TR-021: getToolDefinitionsForRole() 过滤无权限的工具")
        void testGetToolDefinitionsForRoleFiltersUnauthorized() {
            // Act
            List<Tool> tools = toolRegistry.getToolDefinitionsForRole("user");

            // Assert
            assertEquals(1, tools.size());
            assertEquals(TOOL_1_NAME, tools.get(0).getFunction().getName());
        }

        @Test
        @DisplayName("UT-TR-022: getToolDefinitionsForRole() 返回有权限的所有工具")
        void testGetToolDefinitionsForRoleReturnsAuthorized() {
            // Act
            List<Tool> tools = toolRegistry.getToolDefinitionsForRole("super_admin");

            // Assert
            assertEquals(2, tools.size());
            assertTrue(tools.stream().anyMatch(t -> t.getFunction().getName().equals(TOOL_1_NAME)));
            assertTrue(tools.stream().anyMatch(t -> t.getFunction().getName().equals(PERMISSION_TOOL_NAME)));
        }

        @Test
        @DisplayName("UT-TR-023: 不需要权限的工具对所有角色可见")
        void testNoPermissionToolsVisibleToAll() {
            // Act
            List<Tool> adminTools = toolRegistry.getToolDefinitionsForRole("super_admin");
            List<Tool> userTools = toolRegistry.getToolDefinitionsForRole("user");

            // Assert
            assertTrue(adminTools.stream().anyMatch(t -> t.getFunction().getName().equals(TOOL_1_NAME)));
            assertTrue(userTools.stream().anyMatch(t -> t.getFunction().getName().equals(TOOL_1_NAME)));
        }
    }

    // ==================== Tool Definition 生成测试 ====================

    @Nested
    @DisplayName("Tool Definition 生成测试")
    class ToolDefinitionGenerationTests {

        @BeforeEach
        void setUpRegistry() {
            setToolExecutors(List.of(mockTool1));
            toolRegistry.init();
        }

        @Test
        @DisplayName("UT-TR-030: Tool Definition 包含正确的 name")
        void testToolDefinitionContainsCorrectName() {
            // Act
            List<Tool> tools = toolRegistry.getAllToolDefinitions();

            // Assert
            assertEquals(1, tools.size());
            Tool tool = tools.get(0);
            assertEquals(TOOL_1_NAME, tool.getFunction().getName());
        }

        @Test
        @DisplayName("UT-TR-031: Tool Definition 包含正确的 description")
        void testToolDefinitionContainsCorrectDescription() {
            // Act
            List<Tool> tools = toolRegistry.getAllToolDefinitions();

            // Assert
            Tool tool = tools.get(0);
            assertEquals("Test Tool 1", tool.getFunction().getDescription());
        }

        @Test
        @DisplayName("UT-TR-032: Tool Definition 包含正确的 parameters schema")
        void testToolDefinitionContainsCorrectParameters() {
            // Act
            List<Tool> tools = toolRegistry.getAllToolDefinitions();

            // Assert
            Tool tool = tools.get(0);
            assertNotNull(tool.getFunction().getParameters());
            assertEquals("object", tool.getFunction().getParameters().get("type"));
        }
    }

    // ==================== 边界条件测试 ====================

    @Nested
    @DisplayName("边界条件测试")
    class EdgeCaseTests {

        @Test
        @DisplayName("UT-TR-040: 空工具列表时正常初始化")
        void testInitWithEmptyList() {
            // Arrange
            setToolExecutors(Collections.emptyList());

            // Act
            toolRegistry.init();

            // Assert
            assertEquals(0, toolRegistry.getToolCount());
            assertTrue(toolRegistry.getAllToolNames().isEmpty());
        }

        @Test
        @DisplayName("UT-TR-041: null 工具列表时正常初始化")
        void testInitWithNullList() {
            // Arrange
            setToolExecutors(null);

            // Act
            toolRegistry.init();

            // Assert
            assertEquals(0, toolRegistry.getToolCount());
        }

        @Test
        @DisplayName("UT-TR-042: clear() 清空注册表")
        void testClearRegistry() {
            // Arrange
            setToolExecutors(List.of(mockTool1, mockTool2));
            toolRegistry.init();
            assertEquals(2, toolRegistry.getToolCount());

            // Act
            toolRegistry.clear();

            // Assert
            assertEquals(0, toolRegistry.getToolCount());
            assertFalse(toolRegistry.hasExecutor(TOOL_1_NAME));
        }

        @Test
        @DisplayName("UT-TR-043: 重复初始化不会重复注册")
        void testMultipleInitDoesNotDuplicate() {
            // Arrange
            setToolExecutors(List.of(mockTool1));

            // Act
            toolRegistry.init();
            int firstCount = toolRegistry.getToolCount();
            toolRegistry.init();
            int secondCount = toolRegistry.getToolCount();

            // Assert
            assertEquals(firstCount, secondCount);
        }
    }

    // ==================== Helper Methods ====================

    private void setToolExecutors(List<ToolExecutor> executors) {
        // Use reflection to set the private field
        try {
            java.lang.reflect.Field field = ToolRegistry.class.getDeclaredField("toolExecutors");
            field.setAccessible(true);
            field.set(toolRegistry, executors);
        } catch (Exception e) {
            throw new RuntimeException("Failed to set toolExecutors field", e);
        }
    }

    private Map<String, Object> createMockSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        Map<String, Object> param1 = new HashMap<>();
        param1.put("type", "string");
        param1.put("description", "Test parameter");
        properties.put("param1", param1);

        schema.put("properties", properties);
        schema.put("required", List.of("param1"));

        return schema;
    }
}
