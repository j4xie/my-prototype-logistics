package com.cretas.aims.ai.tool.impl.production;

import com.cretas.aims.dto.production.DeliveryWarnDTO;
import com.cretas.aims.service.ProductionPlanService;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ProductionPlanDeliveryWarnTool} (Sprint 5 Tool 1).
 *
 * Pattern mirrors {@code ProcessTaskToolsTest} — invoke doExecute() directly via
 * reflection to bypass the ToolCall-based execute() wrapper.
 */
@ExtendWith(MockitoExtension.class)
class ProductionPlanDeliveryWarnToolTest {

    private static final String FACTORY_ID = "F001";

    @InjectMocks
    private ProductionPlanDeliveryWarnTool tool;

    @Mock
    private ProductionPlanService productionPlanService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        injectObjectMapper(tool);
    }

    // ────────────────────────────────────────────────────────────────
    // T1: Tool metadata
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T1: getToolName returns 'production_plan_delivery_warn_query'")
    void toolNameIsCorrect() {
        assertEquals("production_plan_delivery_warn_query", tool.getToolName());
    }

    @Test
    @DisplayName("T2: getRequiredParameters is empty (all optional)")
    void noRequiredParameters() {
        assertTrue(tool.getRequiredParameters().isEmpty());
    }

    @Test
    @DisplayName("T3: ActionType=READ via *_query convention")
    void actionTypeIsRead() {
        assertEquals(com.cretas.aims.ai.tool.ToolExecutor.ActionType.READ, tool.getActionType());
    }

    // ────────────────────────────────────────────────────────────────
    // T4: doExecute with no params → default 7-day window, all warnings returned
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T4: doExecute() with no params calls service with windowDays=7")
    @SuppressWarnings("unchecked")
    void executeWithDefaultWindow() throws Exception {
        List<DeliveryWarnDTO> mockWarnings = List.of(
                buildWarning("P1", "PN001", "牛肉干", "客户A", -2L, "OVERDUE"),
                buildWarning("P2", "PN002", "猪蹄", "客户B", 1L, "URGENT"),
                buildWarning("P3", "PN003", "牛肉条", "客户C", 5L, "WARN")
        );
        when(productionPlanService.getDeliveryWarnings(eq(FACTORY_ID), eq(7))).thenReturn(mockWarnings);

        Map<String, Object> params = new HashMap<>();
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(tool, FACTORY_ID, params, context);

        verify(productionPlanService).getDeliveryWarnings(FACTORY_ID, 7);

        // R2 context check — message carries counts
        String message = result.get("message").toString();
        assertTrue(message.contains("3 条交货预警"), "message should report 3 warnings, was: " + message);
        assertTrue(message.contains("窗口 7 天"), "message should report window, was: " + message);
        assertTrue(message.contains("超期 1"), "message should break down by level, was: " + message);

        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals(7, data.get("windowDays"));
        assertEquals(3, data.get("totalCount"));
        assertNull(data.get("warnLevelFilter"));

        Map<String, Integer> counts = (Map<String, Integer>) data.get("countsByLevel");
        assertEquals(1, counts.get("OVERDUE"));
        assertEquals(1, counts.get("URGENT"));
        assertEquals(1, counts.get("WARN"));
        assertEquals(0, counts.get("NORMAL"));

        // groups should NOT contain NORMAL (empty groups dropped)
        Map<String, Object> groups = (Map<String, Object>) data.get("groups");
        assertTrue(groups.containsKey("OVERDUE"));
        assertTrue(groups.containsKey("URGENT"));
        assertTrue(groups.containsKey("WARN"));
        assertFalse(groups.containsKey("NORMAL"));

        // R2 row context: each row carries planNumber + productTypeName + sourceCustomerName
        List<Map<String, Object>> overdueRows = (List<Map<String, Object>>) groups.get("OVERDUE");
        Map<String, Object> overdueRow = overdueRows.get(0);
        assertEquals("PN001", overdueRow.get("planNumber"));
        assertEquals("牛肉干", overdueRow.get("productTypeName"));
        assertEquals("客户A", overdueRow.get("sourceCustomerName"));
        assertEquals(-2L, overdueRow.get("daysUntilDeadline"));
    }

    // ────────────────────────────────────────────────────────────────
    // T5: doExecute with custom windowDays
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T5: doExecute() with windowDays=14 propagates to service")
    void executeWithCustomWindow() throws Exception {
        when(productionPlanService.getDeliveryWarnings(eq(FACTORY_ID), eq(14))).thenReturn(List.of());

        Map<String, Object> params = new HashMap<>();
        params.put("windowDays", 14);
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(tool, FACTORY_ID, params, context);

        verify(productionPlanService).getDeliveryWarnings(FACTORY_ID, 14);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals(14, data.get("windowDays"));
        assertEquals(0, data.get("totalCount"));
    }

    // ────────────────────────────────────────────────────────────────
    // T6: doExecute with warnLevel filter (case-insensitive)
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T6: doExecute() with warnLevel='urgent' filters to URGENT only (case-insensitive)")
    @SuppressWarnings("unchecked")
    void executeWithWarnLevelFilterCaseInsensitive() throws Exception {
        List<DeliveryWarnDTO> mockWarnings = List.of(
                buildWarning("P1", "PN001", "牛肉干", "客户A", -2L, "OVERDUE"),
                buildWarning("P2", "PN002", "猪蹄", "客户B", 1L, "URGENT"),
                buildWarning("P3", "PN003", "牛肉条", "客户C", 5L, "WARN")
        );
        when(productionPlanService.getDeliveryWarnings(eq(FACTORY_ID), eq(7))).thenReturn(mockWarnings);

        Map<String, Object> params = new HashMap<>();
        params.put("warnLevel", "urgent");  // lower-case input
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(tool, FACTORY_ID, params, context);

        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals(1, data.get("totalCount"));
        assertEquals("URGENT", data.get("warnLevelFilter"));

        Map<String, Object> groups = (Map<String, Object>) data.get("groups");
        assertEquals(1, groups.size());
        assertTrue(groups.containsKey("URGENT"));
    }

    // ────────────────────────────────────────────────────────────────
    // T7: invalid warnLevel falls back to ALL gracefully
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T7: doExecute() with invalid warnLevel='FOO' falls back gracefully (no exception)")
    @SuppressWarnings("unchecked")
    void executeWithInvalidWarnLevelFallsBack() throws Exception {
        List<DeliveryWarnDTO> mockWarnings = List.of(
                buildWarning("P1", "PN001", "牛肉干", "客户A", -2L, "OVERDUE")
        );
        when(productionPlanService.getDeliveryWarnings(eq(FACTORY_ID), eq(7))).thenReturn(mockWarnings);

        Map<String, Object> params = new HashMap<>();
        params.put("warnLevel", "FOO");
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        Map<String, Object> result = invokeDoExecute(tool, FACTORY_ID, params, context);

        Map<String, Object> data = (Map<String, Object>) result.get("data");
        // FOO scrubbed → treated as no filter
        assertNull(data.get("warnLevelFilter"));
        assertEquals(1, data.get("totalCount"));
    }

    // ────────────────────────────────────────────────────────────────
    // T8: windowDays<=0 sanitized to default 7
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T8: windowDays=0 is sanitized to default 7")
    void invalidWindowDaysFallsBackToDefault() throws Exception {
        when(productionPlanService.getDeliveryWarnings(eq(FACTORY_ID), eq(7))).thenReturn(List.of());

        Map<String, Object> params = new HashMap<>();
        params.put("windowDays", 0);
        Map<String, Object> context = Map.of("factoryId", FACTORY_ID, "userId", 1L);

        invokeDoExecute(tool, FACTORY_ID, params, context);

        verify(productionPlanService).getDeliveryWarnings(FACTORY_ID, 7);
        verify(productionPlanService, never()).getDeliveryWarnings(anyString(), eq(0));
    }

    // ────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────

    private DeliveryWarnDTO buildWarning(String planId, String planNumber, String productName,
                                         String customerName, Long days, String level) {
        return DeliveryWarnDTO.builder()
                .planId(planId)
                .planNumber(planNumber)
                .factoryId(FACTORY_ID)
                .productTypeId("PT-" + planId)
                .productTypeName(productName)
                .plannedQuantity(new BigDecimal("100"))
                .actualQuantity(new BigDecimal("50"))
                .expectedCompletionDate(LocalDate.now().plusDays(days))
                .status("IN_PROGRESS")
                .daysUntilDeadline(days)
                .warnLevel(level)
                .sourceCustomerName(customerName)
                .build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeDoExecute(Object tool, String factoryId,
                                                Map<String, Object> params, Map<String, Object> context) throws Exception {
        var method = findMethod(tool.getClass(), "doExecute");
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
