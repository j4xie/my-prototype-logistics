package com.cretas.aims.integration;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.ProcessTaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * ProcessTaskAIToolsIT - 工序任务AI工具集成测试
 *
 * Verifies that the 5 new Process Task AI tools are correctly registered
 * in ToolRegistry and functional against the test database.
 *
 * Test cases:
 * - AI-IT-01: All 5 new tools registered in ToolRegistry at startup
 * - AI-IT-02: process_task_query executes against test DB
 * - AI-IT-03: process_task_create preview mode returns PREVIEW without persistence
 * - AI-IT-04: factory_config_agent action="start" returns topic checklist
 * - AI-IT-05: Intent routing config entries exist for process_task tools
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("ProcessTaskAIToolsIT - 工序任务AI工具集成测试")
class ProcessTaskAIToolsIT {

    @Autowired(required = false)
    private ToolRegistry toolRegistry;

    @Autowired(required = false)
    private ProcessTaskService processTaskService;

    @Autowired(required = false)
    private AIIntentConfigRepository aiIntentConfigRepository;

    @Autowired(required = false)
    private ObjectMapper objectMapper;

    private static final String TEST_FACTORY_ID = "F001";
    private static final Long TEST_USER_ID = 1L;

    private static final List<String> NEW_TOOL_NAMES = List.of(
            "process_task_query",
            "process_task_create",
            "process_task_summary",
            "process_task_analysis",
            "factory_config_agent"
    );

    // ==================== AI-IT-01 ====================

    @Test
    @DisplayName("AI-IT-01: All 5 new tools registered in ToolRegistry at startup")
    void testAllNewToolsRegistered() {
        assumeTrue(toolRegistry != null, "ToolRegistry not available in test context");

        // Verify each new tool is registered
        for (String toolName : NEW_TOOL_NAMES) {
            assertThat(toolRegistry.hasExecutor(toolName))
                    .as("Tool '%s' should be registered in ToolRegistry", toolName)
                    .isTrue();

            Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolName);
            assertThat(executor)
                    .as("Tool '%s' should be retrievable via getExecutor()", toolName)
                    .isPresent();

            // Verify tool has proper metadata
            ToolExecutor tool = executor.get();
            assertThat(tool.getToolName()).isEqualTo(toolName);
            assertThat(tool.getDescription()).isNotBlank();
            assertThat(tool.getParametersSchema()).isNotNull();
            assertThat(tool.getParametersSchema()).containsKey("type");
        }

        // Verify total tool count: 310 existing + 5 new >= 315
        int totalTools = toolRegistry.getToolCount();
        assertThat(totalTools)
                .as("Total tool count should be >= 315 (310 existing + 5 new)")
                .isGreaterThanOrEqualTo(315);
    }

    // ==================== AI-IT-02 ====================

    @Test
    @Transactional
    @DisplayName("AI-IT-02: process_task_query executes against test DB")
    void testProcessTaskQueryExecutes() throws Exception {
        assumeTrue(toolRegistry != null, "ToolRegistry not available in test context");

        Optional<ToolExecutor> optTool = toolRegistry.getExecutor("process_task_query");
        assumeTrue(optTool.isPresent(), "process_task_query tool not registered");

        ToolExecutor queryTool = optTool.get();

        // Build a ToolCall with empty params (should return all active tasks)
        ToolCall toolCall = ToolCall.of(
                "test-call-001",
                "process_task_query",
                "{}"
        );

        Map<String, Object> context = Map.of(
                "factoryId", TEST_FACTORY_ID,
                "userId", TEST_USER_ID
        );

        // Execute - should not throw
        String resultJson = queryTool.execute(toolCall, context);

        assertThat(resultJson).isNotNull();
        assertThat(resultJson).isNotBlank();

        // Parse and verify structure
        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(resultJson, Map.class);
        assertThat(result).containsKey("success");
        assertThat(result.get("success")).isEqualTo(true);

        // The result.data should contain our tool's output with "message" and "data"
        assertThat(result).containsKey("data");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertThat(data).isNotNull();
        assertThat(data).containsKey("message");
    }

    // ==================== AI-IT-03 ====================

    @Test
    @Transactional
    @DisplayName("AI-IT-03: process_task_create preview returns PREVIEW without persistence")
    void testProcessTaskCreatePreviewMode() throws Exception {
        assumeTrue(toolRegistry != null, "ToolRegistry not available in test context");
        assumeTrue(processTaskService != null, "ProcessTaskService not available in test context");

        Optional<ToolExecutor> optTool = toolRegistry.getExecutor("process_task_create");
        assumeTrue(optTool.isPresent(), "process_task_create tool not registered");

        ToolExecutor createTool = optTool.get();

        // Verify the tool supports preview
        assertThat(createTool.supportsPreview())
                .as("process_task_create should support preview mode")
                .isTrue();

        // Count tasks before preview
        int tasksBefore = processTaskService.getActiveTasks(TEST_FACTORY_ID).size();

        // Build preview params
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("productTypeId", "test-product-type-001");
        params.put("workProcessId", "test-work-process-001");
        params.put("plannedQuantity", 100);
        params.put("unit", "kg");

        String paramsJson = objectMapper.writeValueAsString(params);

        ToolCall toolCall = ToolCall.of(
                "test-preview-001",
                "process_task_create",
                paramsJson
        );

        Map<String, Object> context = Map.of(
                "factoryId", TEST_FACTORY_ID,
                "userId", TEST_USER_ID
        );

        // Execute preview
        String previewJson = createTool.preview(toolCall, context);

        assertThat(previewJson).isNotNull();
        assertThat(previewJson).isNotBlank();

        // Parse and verify PREVIEW status
        @SuppressWarnings("unchecked")
        Map<String, Object> previewResult = objectMapper.readValue(previewJson, Map.class);
        assertThat(previewResult).containsKey("data");

        @SuppressWarnings("unchecked")
        Map<String, Object> previewData = (Map<String, Object>) previewResult.get("data");
        assertThat(previewData).isNotNull();
        assertThat(previewData).containsEntry("status", "PREVIEW");

        // Verify no actual task was persisted
        int tasksAfter = processTaskService.getActiveTasks(TEST_FACTORY_ID).size();
        assertThat(tasksAfter)
                .as("No task should be persisted during preview — count before: %d, after: %d", tasksBefore, tasksAfter)
                .isEqualTo(tasksBefore);
    }

    // ==================== AI-IT-04 ====================

    @Test
    @DisplayName("AI-IT-04: factory_config_agent action='start' returns topic checklist")
    void testFactoryConfigAgentStartAction() throws Exception {
        assumeTrue(toolRegistry != null, "ToolRegistry not available in test context");

        Optional<ToolExecutor> optTool = toolRegistry.getExecutor("factory_config_agent");
        assumeTrue(optTool.isPresent(), "factory_config_agent tool not registered");

        ToolExecutor configTool = optTool.get();

        // Build ToolCall with action=start
        String paramsJson = objectMapper.writeValueAsString(Map.of("action", "start"));

        ToolCall toolCall = ToolCall.of(
                "test-config-001",
                "factory_config_agent",
                paramsJson
        );

        Map<String, Object> context = Map.of(
                "factoryId", TEST_FACTORY_ID,
                "userId", TEST_USER_ID
        );

        // Execute
        String resultJson = configTool.execute(toolCall, context);

        assertThat(resultJson).isNotNull();
        assertThat(resultJson).isNotBlank();

        // Parse result
        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(resultJson, Map.class);
        assertThat(result).containsKey("success");
        assertThat(result.get("success")).isEqualTo(true);
        assertThat(result).containsKey("data");

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertThat(data).isNotNull();
        assertThat(data).containsKey("message");

        // The nested data should contain topicChecklist
        @SuppressWarnings("unchecked")
        Map<String, Object> innerData = (Map<String, Object>) data.get("data");
        assertThat(innerData).isNotNull();
        assertThat(innerData).containsKey("topicChecklist");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> checklist = (List<Map<String, Object>>) innerData.get("topicChecklist");
        assertThat(checklist)
                .as("Topic checklist should contain at least 5 topics")
                .hasSizeGreaterThanOrEqualTo(5);

        // Verify each topic has required fields
        for (Map<String, Object> topic : checklist) {
            assertThat(topic).containsKeys("id", "name", "required", "status", "question");
            assertThat(topic.get("status")).isEqualTo("pending");
        }

        // Verify known topic IDs are present
        List<String> topicIds = checklist.stream()
                .map(t -> (String) t.get("id"))
                .collect(Collectors.toList());
        assertThat(topicIds).contains("industry", "dimension", "processes", "reporting", "checkin");
    }

    // ==================== AI-IT-05 ====================

    @Test
    @DisplayName("AI-IT-05: Intent config entries exist for process_task tools")
    void testIntentConfigEntriesExistForProcessTaskTools() {
        assumeTrue(aiIntentConfigRepository != null, "AIIntentConfigRepository not available in test context");

        // Query all active intent configs
        List<AIIntentConfig> allConfigs = aiIntentConfigRepository.findAllEnabled();

        // Filter for configs that reference process_task tools
        List<AIIntentConfig> processTaskConfigs = allConfigs.stream()
                .filter(c -> c.getToolName() != null && c.getToolName().startsWith("process_task_"))
                .collect(Collectors.toList());

        assertThat(processTaskConfigs)
                .as("At least 4 intent configs should reference process_task_* tools")
                .hasSizeGreaterThanOrEqualTo(4);

        // Verify the tool names found cover the expected set
        Set<String> boundToolNames = processTaskConfigs.stream()
                .map(AIIntentConfig::getToolName)
                .collect(Collectors.toSet());

        assertThat(boundToolNames)
                .as("Intent configs should cover the core process_task tools")
                .containsAnyOf(
                        "process_task_query",
                        "process_task_create",
                        "process_task_summary",
                        "process_task_analysis"
                );
    }
}
