package com.cretas.aims.ai.tool.impl.processing;

import com.cretas.aims.ai.tool.impl.config.FactoryConfigAgentTool;
import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.service.ProcessTaskService;
import com.cretas.aims.service.ProcessWorkReportingService;
import com.cretas.aims.service.workflow.WorkflowNodeRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Process Task AI Tools unit tests
 *
 * Tests the 4 process task tools + 1 factory config agent tool.
 * Tools extend AbstractBusinessTool; we invoke doExecute/doPreview directly
 * using reflection to bypass the ToolCall-based execute() wrapper.
 *
 * UT-AI-01 ~ UT-AI-11
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@ExtendWith(MockitoExtension.class)
class ProcessTaskToolsTest {

    private static final String FACTORY_ID = "F001";

    // --- Tool instances ---
    @InjectMocks
    private ProcessTaskQueryTool queryTool;

    @InjectMocks
    private ProcessTaskCreateTool createTool;

    @InjectMocks
    private ProcessTaskAnalysisTool analysisTool;

    @InjectMocks
    private ProcessTaskSummaryTool summaryTool;

    @InjectMocks
    private FactoryConfigAgentTool configAgentTool;

    // --- Service mocks ---
    @Mock
    private ProcessTaskService processTaskService;

    @Mock
    private ProcessWorkReportingService processWorkReportingService;

    @Mock
    private WorkflowNodeRegistry workflowNodeRegistry;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        // AbstractTool.objectMapper is @Autowired and not covered by @InjectMocks
        // on the concrete tools, so inject it manually via reflection.
        injectObjectMapper(queryTool);
        injectObjectMapper(createTool);
        injectObjectMapper(analysisTool);
        injectObjectMapper(summaryTool);
        injectObjectMapper(configAgentTool);
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-01: All 5 tools return correct getToolName()
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-01: All 5 tools return correct getToolName()")
    void allToolsReturnCorrectToolName() {
        assertEquals("process_task_query", queryTool.getToolName());
        assertEquals("process_task_create", createTool.getToolName());
        assertEquals("process_task_analysis", analysisTool.getToolName());
        assertEquals("process_task_summary", summaryTool.getToolName());
        assertEquals("factory_config_agent", configAgentTool.getToolName());
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-02: ProcessTaskQueryTool.doExecute() no params -> getActiveTasks()
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-02: QueryTool with no params calls getActiveTasks()")
    void queryToolNoParamsCallsGetActiveTasks() throws Exception {
        List<ProcessTaskDTO> active = List.of(
                buildTaskDTO("T1", "切割", "牛肉干", "IN_PROGRESS"),
                buildTaskDTO("T2", "包装", "牛肉干", "PENDING")
        );
        when(processTaskService.getActiveTasks(FACTORY_ID)).thenReturn(active);

        Map<String, Object> params = new HashMap<>();
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(queryTool, FACTORY_ID, params, context);

        verify(processTaskService).getActiveTasks(FACTORY_ID);
        verify(processTaskService, never()).list(anyString(), anyString(), anyString(), any());

        assertNotNull(result.get("message"));
        assertTrue(result.get("message").toString().contains("2"));

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals(2, data.get("total"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-03: ProcessTaskCreateTool.supportsPreview() returns true
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-03: CreateTool supportsPreview() returns true")
    void createToolSupportsPreview() {
        assertTrue(createTool.supportsPreview());
        // Other tools should default to false
        assertFalse(queryTool.supportsPreview());
        assertFalse(analysisTool.supportsPreview());
        assertFalse(summaryTool.supportsPreview());
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-04: ProcessTaskCreateTool.doPreview() returns PREVIEW status
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-04: CreateTool doPreview() returns PREVIEW status without persisting")
    void createToolPreviewReturnsPreviewStatus() throws Exception {
        Map<String, Object> params = new HashMap<>();
        params.put("productTypeId", "PT001");
        params.put("workProcessId", "WP001");
        params.put("plannedQuantity", 100);
        params.put("unit", "kg");

        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoPreview(createTool, FACTORY_ID, params, context);

        assertEquals("PREVIEW", result.get("status"));
        assertEquals("PT001", result.get("productTypeId"));
        assertEquals("WP001", result.get("workProcessId"));
        assertNotNull(result.get("plannedQuantity"));
        assertEquals("kg", result.get("unit"));

        // Service.create() must NOT be called during preview
        verify(processTaskService, never()).create(anyString(), any());
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-05: ProcessTaskCreateTool.doExecute() creates task, returns id
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-05: CreateTool doExecute() calls service.create() and returns task id")
    void createToolExecuteCreatesTask() throws Exception {
        ProcessTaskDTO created = ProcessTaskDTO.builder()
                .id("TASK-NEW-001")
                .processName("切割")
                .productName("牛肉干")
                .plannedQuantity(new BigDecimal("200"))
                .unit("kg")
                .status("PENDING")
                .build();

        when(processTaskService.create(eq(FACTORY_ID), any(ProcessTaskDTO.class))).thenReturn(created);

        Map<String, Object> params = new HashMap<>();
        params.put("productTypeId", "PT001");
        params.put("workProcessId", "WP001");
        params.put("plannedQuantity", 200);
        params.put("unit", "kg");
        params.put("startDate", LocalDate.now().toString());

        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(createTool, FACTORY_ID, params, context);

        verify(processTaskService).create(eq(FACTORY_ID), any(ProcessTaskDTO.class));

        String message = result.get("message").toString();
        assertTrue(message.contains("TASK-NEW-001"), "message should contain the created task ID");

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals("TASK-NEW-001", data.get("id"));
        assertEquals("PENDING", data.get("status"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-06: ProcessTaskCreateTool.getRequiredParameters() includes 3 fields
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-06: CreateTool getRequiredParameters() includes productTypeId, workProcessId, plannedQuantity")
    void createToolRequiredParameters() {
        List<String> required = createTool.getRequiredParameters();

        assertEquals(3, required.size());
        assertTrue(required.contains("productTypeId"));
        assertTrue(required.contains("workProcessId"));
        assertTrue(required.contains("plannedQuantity"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-07: ProcessTaskAnalysisTool.doExecute() no runId -> analyzeAll
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-07: AnalysisTool with no productionRunId analyzes all active tasks")
    void analysisToolNoRunIdAnalyzesAll() throws Exception {
        List<ProcessTaskDTO> active = List.of(
                buildTaskDTOWithQuantities("T1", "IN_PROGRESS", new BigDecimal("100"), new BigDecimal("60")),
                buildTaskDTOWithQuantities("T2", "PENDING", new BigDecimal("200"), BigDecimal.ZERO),
                buildTaskDTOWithQuantities("T3", "COMPLETED", new BigDecimal("50"), new BigDecimal("50"))
        );
        when(processTaskService.getActiveTasks(FACTORY_ID)).thenReturn(active);

        Map<String, Object> params = new HashMap<>(); // no productionRunId
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(analysisTool, FACTORY_ID, params, context);

        verify(processTaskService).getActiveTasks(FACTORY_ID);
        verify(processTaskService, never()).getRunOverview(anyString(), anyString());

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");

        assertEquals(3, data.get("totalActiveTasks"));
        // total planned = 100+200+50=350, completed = 60+0+50=110
        // progress = 110/350 * 100 = 31.4%
        BigDecimal progress = (BigDecimal) data.get("overallProgressPercent");
        assertNotNull(progress);
        assertTrue(progress.compareTo(BigDecimal.ZERO) > 0);
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-08: FactoryConfigAgentTool action="start" returns 7 topic checklist
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-08: ConfigAgent action=start returns 7-topic checklist")
    void configAgentStartReturnsChecklist() throws Exception {
        Map<String, Object> params = new HashMap<>();
        params.put("action", "start");

        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(configAgentTool, FACTORY_ID, params, context);

        assertNotNull(result.get("message"));
        assertTrue(result.get("message").toString().contains("配置向导"));

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> checklist = (List<Map<String, Object>>) data.get("topicChecklist");
        assertEquals(7, checklist.size(), "Should have 7 config topics");

        // First topic should be "industry"
        assertEquals("industry", checklist.get(0).get("id"));
        assertEquals("pending", checklist.get(0).get("status"));

        // Progress should be 0
        assertEquals(0, data.get("progress"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-09: FactoryConfigAgentTool action="analyze" identifies covered topics
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-09: ConfigAgent action=analyze identifies covered topics and suggests next")
    void configAgentAnalyzeIdentifiesCoveredTopics() throws Exception {
        when(workflowNodeRegistry.getAllNodeSchemas()).thenReturn(List.of());

        Map<String, Object> params = new HashMap<>();
        params.put("action", "analyze");
        params.put("userInput", "我们做牛肉干，典型生产周期3天");
        params.put("topicsCovered", List.of("industry", "dimension"));

        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(configAgentTool, FACTORY_ID, params, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");

        // 2 out of 7 covered => progress ~28%
        int progress = (int) data.get("progress");
        assertEquals(28, progress);

        // Next topic should be "processes" (3rd topic)
        assertEquals("processes", data.get("nextTopicId"));
        assertNotNull(data.get("nextQuestion"));

        // Remaining should not include covered topics
        @SuppressWarnings("unchecked")
        List<String> remaining = (List<String>) data.get("topicsRemaining");
        assertFalse(remaining.contains("industry"));
        assertFalse(remaining.contains("dimension"));
        assertEquals(5, remaining.size());
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-10: FactoryConfigAgentTool action="generate" produces states+transitions
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-10: ConfigAgent action=generate produces states and transitions")
    void configAgentGenerateProducesStatesAndTransitions() throws Exception {
        when(workflowNodeRegistry.getAllNodeSchemas()).thenReturn(List.of(
                Map.of("nodeType", "plan_creation", "displayName", "计划创建")
        ));

        Map<String, Object> collectedConfig = new HashMap<>();
        collectedConfig.put("supplementPolicy", "allowed");

        Map<String, Object> params = new HashMap<>();
        params.put("action", "generate");
        params.put("collectedConfig", collectedConfig);

        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(configAgentTool, FACTORY_ID, params, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");

        assertEquals(FACTORY_ID, data.get("factoryId"));
        assertEquals("PRODUCTION_WORKFLOW", data.get("entityType"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> states = (List<Map<String, Object>>) data.get("states");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> transitions = (List<Map<String, Object>>) data.get("transitions");

        // With supplementPolicy != "forbidden", supplementing state should be added
        assertTrue(states.size() >= 5, "Should have at least 5 states (including supplementing + closed)");
        boolean hasSupplementing = states.stream()
                .anyMatch(s -> "supplementing".equals(s.get("code")));
        assertTrue(hasSupplementing, "Should include supplementing state");

        // Should have basic transitions + supplement transitions + close transition
        assertTrue(transitions.size() >= 5, "Should have at least 5 transitions");

        // Message should mention state and transition counts
        String message = result.get("message").toString();
        assertTrue(message.contains(String.valueOf(states.size())));
        assertTrue(message.contains(String.valueOf(transitions.size())));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-AI-11: FactoryConfigAgentTool action="node_schemas" calls WorkflowNodeRegistry
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-AI-11: ConfigAgent action=node_schemas calls WorkflowNodeRegistry.getAllNodeSchemas()")
    void configAgentNodeSchemasCallsRegistry() throws Exception {
        List<Map<String, Object>> schemas = List.of(
                Map.of("nodeType", "plan_creation", "displayName", "计划创建", "category", "计划"),
                Map.of("nodeType", "checkin_checkout", "displayName", "签到签退", "category", "考勤"),
                Map.of("nodeType", "quality_check", "displayName", "质检", "category", "质量")
        );
        when(workflowNodeRegistry.getAllNodeSchemas()).thenReturn(schemas);

        Map<String, Object> params = new HashMap<>();
        params.put("action", "node_schemas");

        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(configAgentTool, FACTORY_ID, params, context);

        verify(workflowNodeRegistry).getAllNodeSchemas();

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals(3, data.get("count"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> returnedSchemas = (List<Map<String, Object>>) data.get("nodeSchemas");
        assertEquals(3, returnedSchemas.size());

        String message = result.get("message").toString();
        assertTrue(message.contains("3"));
    }

    // ────────────────────────────────────────────────────────────────
    // Helper methods
    // ────────────────────────────────────────────────────────────────

    private ProcessTaskDTO buildTaskDTO(String id, String processName, String productName, String status) {
        return ProcessTaskDTO.builder()
                .id(id)
                .processName(processName)
                .productName(productName)
                .status(status)
                .plannedQuantity(new BigDecimal("100"))
                .completedQuantity(BigDecimal.ZERO)
                .pendingQuantity(BigDecimal.ZERO)
                .unit("kg")
                .startDate(LocalDate.now())
                .build();
    }

    private ProcessTaskDTO buildTaskDTOWithQuantities(String id, String status,
            BigDecimal planned, BigDecimal completed) {
        return ProcessTaskDTO.builder()
                .id(id)
                .processName("工序-" + id)
                .productName("产品-" + id)
                .status(status)
                .plannedQuantity(planned)
                .completedQuantity(completed)
                .pendingQuantity(BigDecimal.ZERO)
                .unit("kg")
                .startDate(LocalDate.now())
                .build();
    }

    /**
     * Invoke the protected doExecute() method via reflection.
     * The tools' public execute() requires a ToolCall object and full context validation;
     * calling doExecute() directly isolates the business logic under test.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeDoExecute(Object tool, String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        var method = findMethod(tool.getClass(), "doExecute");
        method.setAccessible(true);
        return (Map<String, Object>) method.invoke(tool, factoryId, params, context);
    }

    /**
     * Invoke the protected doPreview() method via reflection.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeDoPreview(Object tool, String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        var method = findMethod(tool.getClass(), "doPreview");
        method.setAccessible(true);
        return (Map<String, Object>) method.invoke(tool, factoryId, params, context);
    }

    private java.lang.reflect.Method findMethod(Class<?> clazz, String name) {
        while (clazz != null) {
            for (var m : clazz.getDeclaredMethods()) {
                if (m.getName().equals(name)) return m;
            }
            clazz = clazz.getSuperclass();
        }
        throw new IllegalArgumentException("Method not found: " + name);
    }

    /**
     * Inject ObjectMapper into the AbstractTool.objectMapper field
     * because @InjectMocks only injects fields declared on the concrete class.
     */
    private void injectObjectMapper(Object tool) throws Exception {
        Field field = findField(tool.getClass(), "objectMapper");
        field.setAccessible(true);
        field.set(tool, objectMapper);
    }

    private Field findField(Class<?> clazz, String name) {
        while (clazz != null) {
            try {
                return clazz.getDeclaredField(name);
            } catch (NoSuchFieldException e) {
                clazz = clazz.getSuperclass();
            }
        }
        throw new IllegalArgumentException("Field not found: " + name);
    }
}
