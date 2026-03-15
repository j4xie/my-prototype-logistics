package com.cretas.aims.service.workflow;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * WorkflowNodeRegistry unit tests
 *
 * Mirrors the ToolRegistry pattern: Spring DI injects descriptors, @PostConstruct registers them.
 * Tests validate registration logic, conflict handling, disabled filtering, and schema retrieval.
 *
 * UT-WNR-01 ~ UT-WNR-06
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@ExtendWith(MockitoExtension.class)
class WorkflowNodeRegistryTest {

    private WorkflowNodeRegistry registry;

    // ────────────────────────────────────────────────────────────────
    // UT-WNR-01: 6 descriptors registered after init
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WNR-01: 6 enabled descriptors are all registered after init()")
    void sixDescriptorsRegisteredAfterInit() {
        List<WorkflowNodeDescriptor> descriptors = List.of(
                createDescriptor("plan_creation", "计划创建", "计划", true),
                createDescriptor("checkin_checkout", "签到签退", "考勤", true),
                createDescriptor("cumulative_report", "累计报工", "报工", true),
                createDescriptor("approval", "审批", "管理", true),
                createDescriptor("quality_check", "质检", "质量", true),
                createDescriptor("completion_mark", "完工标记", "管理", true)
        );

        registry = buildAndInit(descriptors);

        assertEquals(6, registry.getRegisteredCount());
        assertEquals(6, registry.getAllNodes().size());

        // Each descriptor should be retrievable by nodeType
        for (WorkflowNodeDescriptor d : descriptors) {
            WorkflowNodeDescriptor found = registry.getNode(d.getNodeType());
            assertNotNull(found, "Should find node: " + d.getNodeType());
            assertEquals(d.getDisplayName(), found.getDisplayName());
        }
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WNR-02: Disabled descriptor not registered
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WNR-02: Disabled descriptor is skipped during registration")
    void disabledDescriptorNotRegistered() {
        List<WorkflowNodeDescriptor> descriptors = List.of(
                createDescriptor("plan_creation", "计划创建", "计划", true),
                createDescriptor("legacy_node", "旧节点", "废弃", false),  // disabled
                createDescriptor("quality_check", "质检", "质量", true)
        );

        registry = buildAndInit(descriptors);

        assertEquals(2, registry.getRegisteredCount());
        assertNull(registry.getNode("legacy_node"), "Disabled node should not be registered");
        assertNotNull(registry.getNode("plan_creation"));
        assertNotNull(registry.getNode("quality_check"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WNR-03: Duplicate nodeType conflict (first kept)
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WNR-03: Duplicate nodeType conflict - first descriptor wins")
    void duplicateNodeTypeFirstKept() {
        WorkflowNodeDescriptor first = createDescriptor("quality_check", "质检-V1", "质量", true);
        WorkflowNodeDescriptor duplicate = createDescriptor("quality_check", "质检-V2", "质量", true);

        List<WorkflowNodeDescriptor> descriptors = List.of(first, duplicate);

        registry = buildAndInit(descriptors);

        assertEquals(1, registry.getRegisteredCount());
        WorkflowNodeDescriptor registered = registry.getNode("quality_check");
        assertNotNull(registered);
        assertEquals("质检-V1", registered.getDisplayName(),
                "First descriptor should be kept on conflict");
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WNR-04: getAllNodeSchemas() returns correct format
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WNR-04: getAllNodeSchemas() returns maps with expected keys")
    void getAllNodeSchemasReturnsCorrectFormat() {
        List<WorkflowNodeDescriptor> descriptors = List.of(
                createFullDescriptor("plan_creation", "计划创建", "创建任务", "mdi-clipboard-text",
                        "#409EFF", "计划",
                        Map.of("type", "object"),
                        Map.of("allowMultiDay", true),
                        List.of("checkin_checkout"),
                        List.of())
        );

        registry = buildAndInit(descriptors);

        List<Map<String, Object>> schemas = registry.getAllNodeSchemas();
        assertEquals(1, schemas.size());

        Map<String, Object> schema = schemas.get(0);
        assertEquals("plan_creation", schema.get("nodeType"));
        assertEquals("计划创建", schema.get("displayName"));
        assertEquals("创建任务", schema.get("description"));
        assertEquals("mdi-clipboard-text", schema.get("icon"));
        assertEquals("#409EFF", schema.get("color"));
        assertEquals("计划", schema.get("category"));
        assertNotNull(schema.get("configSchema"));
        assertNotNull(schema.get("defaultConfig"));
        assertNotNull(schema.get("allowedNextNodes"));
        assertNotNull(schema.get("availableGuards"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WNR-05: getNodeSchemasByCategory() filters correctly
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WNR-05: getNodeSchemasByCategory() returns only matching category")
    void getNodeSchemasByCategoryFilters() {
        List<WorkflowNodeDescriptor> descriptors = List.of(
                createDescriptor("plan_creation", "计划创建", "计划", true),
                createDescriptor("checkin_checkout", "签到签退", "考勤", true),
                createDescriptor("approval", "审批", "管理", true),
                createDescriptor("completion_mark", "完工标记", "管理", true),
                createDescriptor("quality_check", "质检", "质量", true)
        );

        registry = buildAndInit(descriptors);

        List<Map<String, Object>> managementSchemas = registry.getNodeSchemasByCategory("管理");
        assertEquals(2, managementSchemas.size());

        Set<String> nodeTypes = managementSchemas.stream()
                .map(s -> s.get("nodeType").toString())
                .collect(Collectors.toSet());
        assertTrue(nodeTypes.contains("approval"));
        assertTrue(nodeTypes.contains("completion_mark"));

        List<Map<String, Object>> qualitySchemas = registry.getNodeSchemasByCategory("质量");
        assertEquals(1, qualitySchemas.size());
        assertEquals("quality_check", qualitySchemas.get(0).get("nodeType"));

        // Non-existing category returns empty
        List<Map<String, Object>> empty = registry.getNodeSchemasByCategory("不存在");
        assertTrue(empty.isEmpty());
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WNR-06: Empty descriptor list initializes cleanly
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WNR-06: Empty or null descriptor list initializes without error")
    void emptyDescriptorListInitializesCleanly() {
        // null list (Spring @Autowired(required=false) with no beans)
        registry = buildAndInit(null);
        assertEquals(0, registry.getRegisteredCount());
        assertTrue(registry.getAllNodes().isEmpty());
        assertTrue(registry.getAllNodeSchemas().isEmpty());

        // empty list
        registry = buildAndInit(Collections.emptyList());
        assertEquals(0, registry.getRegisteredCount());
        assertTrue(registry.getAllNodes().isEmpty());
    }

    // ────────────────────────────────────────────────────────────────
    // Helper methods
    // ────────────────────────────────────────────────────────────────

    /**
     * Build a WorkflowNodeRegistry with the given descriptors and invoke init().
     * This simulates Spring's DI + @PostConstruct lifecycle.
     */
    private WorkflowNodeRegistry buildAndInit(List<WorkflowNodeDescriptor> descriptors) {
        WorkflowNodeRegistry reg = new WorkflowNodeRegistry();
        try {
            java.lang.reflect.Field field = WorkflowNodeRegistry.class.getDeclaredField("descriptors");
            field.setAccessible(true);
            field.set(reg, descriptors);
        } catch (Exception e) {
            throw new RuntimeException("Failed to inject descriptors", e);
        }
        reg.init();
        return reg;
    }

    /**
     * Create a minimal WorkflowNodeDescriptor stub.
     */
    private WorkflowNodeDescriptor createDescriptor(String nodeType, String displayName,
            String category, boolean enabled) {
        return new WorkflowNodeDescriptor() {
            @Override public String getNodeType() { return nodeType; }
            @Override public String getDisplayName() { return displayName; }
            @Override public String getDescription() { return displayName + " 描述"; }
            @Override public Map<String, Object> getConfigSchema() { return Map.of("type", "object"); }
            @Override public List<String> getAllowedNextNodes() { return List.of(); }
            @Override public String getCategory() { return category; }
            @Override public boolean isEnabled() { return enabled; }
        };
    }

    /**
     * Create a full WorkflowNodeDescriptor with all fields.
     */
    private WorkflowNodeDescriptor createFullDescriptor(String nodeType, String displayName,
            String description, String icon, String color, String category,
            Map<String, Object> configSchema, Map<String, Object> defaultConfig,
            List<String> allowedNextNodes, List<String> availableGuards) {
        return new WorkflowNodeDescriptor() {
            @Override public String getNodeType() { return nodeType; }
            @Override public String getDisplayName() { return displayName; }
            @Override public String getDescription() { return description; }
            @Override public String getIcon() { return icon; }
            @Override public String getColor() { return color; }
            @Override public String getCategory() { return category; }
            @Override public Map<String, Object> getConfigSchema() { return configSchema; }
            @Override public Map<String, Object> getDefaultConfig() { return defaultConfig; }
            @Override public List<String> getAllowedNextNodes() { return allowedNextNodes; }
            @Override public List<String> getAvailableGuards() { return availableGuards; }
        };
    }
}
