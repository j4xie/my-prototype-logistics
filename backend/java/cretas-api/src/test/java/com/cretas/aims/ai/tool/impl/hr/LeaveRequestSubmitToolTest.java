package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.entity.hr.LeaveBalance;
import com.cretas.aims.entity.hr.LeaveRequest;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.service.hr.LeaveBalanceService;
import com.cretas.aims.service.hr.LeaveRequestService;
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
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link LeaveRequestSubmitTool}.
 *
 * <p>Covers:
 * <ul>
 *   <li>Naming/type metadata (getToolName / ActionType=WRITE / RiskLevel=MEDIUM / supportsPreview)</li>
 *   <li>Preview path R1 — sufficient balance (canDo=true)</li>
 *   <li>Preview path R1 — insufficient balance (canDo=false + 缺 hours)</li>
 *   <li>Preview — non-tracked leave type (PERSONAL) skips balance check</li>
 *   <li>Execute happy path — create + submit + R2 context message</li>
 *   <li>Execute R4 — 时段重叠 BusinessException(409) → DUPLICATE + actionHint</li>
 *   <li>Default duration computation — (endDate - startDate + 1) * 8h</li>
 * </ul>
 *
 * @since 2026-05-17 (Sprint 5 Tool 4)
 */
@ExtendWith(MockitoExtension.class)
class LeaveRequestSubmitToolTest {

    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1001L;

    @InjectMocks
    private LeaveRequestSubmitTool submitTool;

    @Mock
    private LeaveRequestService leaveRequestService;

    @Mock
    private LeaveBalanceService leaveBalanceService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        injectObjectMapper(submitTool);
    }

    @Test
    @DisplayName("UT-LV-01: Tool metadata — name/ActionType=WRITE/RiskLevel=MEDIUM/supportsPreview=true")
    void toolMetadata() {
        assertEquals("hr_leave_submit", submitTool.getToolName());
        assertEquals(ToolExecutor.ActionType.WRITE, submitTool.getActionType());
        assertEquals(ToolExecutor.RiskLevel.MEDIUM, submitTool.getRiskLevel());
        assertTrue(submitTool.supportsPreview());
        assertTrue(submitTool.getDescription().contains("请假"));
        assertEquals(3, submitTool.getRequiredParameters().size());
        assertTrue(submitTool.getRequiredParameters().contains("leaveType"));
        assertTrue(submitTool.getRequiredParameters().contains("startDate"));
        assertTrue(submitTool.getRequiredParameters().contains("endDate"));
    }

    @Test
    @DisplayName("UT-LV-02: Preview ANNUAL with sufficient balance — canDo=true, message includes context")
    void previewSufficientBalance() throws Exception {
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 3);  // 3 days = 24h
        String yearMonth = YearMonth.from(start).toString();

        LeaveBalance balance = LeaveBalance.builder()
                .factoryId(FACTORY_ID).userId(USER_ID)
                .leaveType(LeaveType.ANNUAL)
                .yearMonth(yearMonth)
                .earnedHours(new BigDecimal("40"))   // 5 days
                .usedHours(new BigDecimal("8"))      // 1 day used
                .balanceHours(new BigDecimal("32"))  // 32h available > 24h requested
                .build();
        when(leaveBalanceService.getBalance(FACTORY_ID, USER_ID, LeaveType.ANNUAL, yearMonth))
                .thenReturn(Optional.of(balance));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", start.toString());
        params.put("endDate", end.toString());

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW", result.get("status"));
        assertEquals(true, result.get("canDo"));
        assertEquals("ANNUAL", result.get("leaveType"));
        assertEquals(USER_ID, result.get("userId"));
        assertEquals(3L, result.get("requestedDays"));
        assertEquals(0, ((BigDecimal) result.get("requestedHours")).compareTo(new BigDecimal("24")));
        assertEquals(0, ((BigDecimal) result.get("availableHours")).compareTo(new BigDecimal("32")));

        String msg = result.get("message").toString();
        assertTrue(msg.contains("ANNUAL"));
        assertTrue(msg.contains(String.valueOf(USER_ID)));
        assertTrue(msg.contains("32h"));
        assertTrue(msg.contains("24"));
        assertTrue(msg.contains("✓"));

        // R1: preview does NOT call create/submit
        verify(leaveRequestService, never()).create(any(), any(), any(), any(), any(), any(), any());
        verify(leaveRequestService, never()).submit(any(), any(), any());
    }

    @Test
    @DisplayName("UT-LV-03: Preview ANNUAL with insufficient balance — canDo=false, shortage shown")
    void previewInsufficientBalance() throws Exception {
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 5);  // 5 days = 40h
        String yearMonth = "2026-06";

        LeaveBalance balance = LeaveBalance.builder()
                .factoryId(FACTORY_ID).userId(USER_ID)
                .leaveType(LeaveType.ANNUAL)
                .yearMonth(yearMonth)
                .earnedHours(new BigDecimal("16"))
                .usedHours(new BigDecimal("0"))
                .balanceHours(new BigDecimal("16"))  // 16h < 40h requested → shortage 24h
                .build();
        when(leaveBalanceService.getBalance(FACTORY_ID, USER_ID, LeaveType.ANNUAL, yearMonth))
                .thenReturn(Optional.of(balance));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", start.toString());
        params.put("endDate", end.toString());

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW", result.get("status"));
        assertEquals(false, result.get("canDo"));
        String msg = result.get("message").toString();
        assertTrue(msg.contains("⚠️"));
        assertTrue(msg.contains("40"));   // requestedHours
        assertTrue(msg.contains("16h"));  // availableHours
        assertTrue(msg.contains("24"));   // shortage = 40-16
    }

    @Test
    @DisplayName("UT-LV-04: Preview PERSONAL (non-tracked) skips balance, canDo=true")
    void previewNonTrackedType() throws Exception {
        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "PERSONAL");
        params.put("startDate", "2026-06-10");
        params.put("endDate", "2026-06-10");  // 1 day = 8h

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW", result.get("status"));
        assertEquals(true, result.get("canDo"));
        assertEquals(1L, result.get("requestedDays"));
        String msg = result.get("message").toString();
        assertTrue(msg.contains("PERSONAL"));
        assertTrue(msg.contains("不占用月度余额"));

        // 非跟踪型不查 balance
        verify(leaveBalanceService, never()).getBalance(any(), any(), any(), any());
    }

    @Test
    @DisplayName("UT-LV-05: Preview invalid date range (endDate < startDate) returns PREVIEW_INVALID early")
    void previewInvalidDateRange() throws Exception {
        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", "2026-06-10");
        params.put("endDate", "2026-06-05");  // before start

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW_INVALID", result.get("status"));
        assertTrue(result.get("message").toString().contains("不能早于"));
        // 早期 short-circuit, 不查 balance, 不 create
        verify(leaveBalanceService, never()).getBalance(any(), any(), any(), any());
    }

    @Test
    @DisplayName("UT-LV-06: Execute happy path — create + submit, message contains R2 context")
    void executeHappyPath() throws Exception {
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 2);  // 2 days = 16h

        LeaveRequest draft = LeaveRequest.builder()
                .id("LR-001").factoryId(FACTORY_ID).userId(USER_ID)
                .leaveType(LeaveType.ANNUAL)
                .startDate(start).endDate(end)
                .durationHours(new BigDecimal("16"))
                .status(HrRequestStatus.DRAFT)
                .build();
        LeaveRequest submitted = LeaveRequest.builder()
                .id("LR-001").factoryId(FACTORY_ID).userId(USER_ID)
                .leaveType(LeaveType.ANNUAL)
                .startDate(start).endDate(end)
                .durationHours(new BigDecimal("16"))
                .status(HrRequestStatus.SUBMITTED)
                .submittedAt(LocalDateTime.now())
                .build();

        when(leaveRequestService.create(eq(FACTORY_ID), eq(USER_ID), eq(LeaveType.ANNUAL),
                eq(start), eq(end), any(BigDecimal.class), any()))
                .thenReturn(draft);
        when(leaveRequestService.submit(FACTORY_ID, USER_ID, "LR-001")).thenReturn(submitted);

        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", start.toString());
        params.put("endDate", end.toString());
        params.put("reason", "私事");

        Map<String, Object> result = invokeDoExecute(submitTool, FACTORY_ID, params, ctx());

        // Both calls invoked
        verify(leaveRequestService).create(eq(FACTORY_ID), eq(USER_ID), eq(LeaveType.ANNUAL),
                eq(start), eq(end), any(BigDecimal.class), eq("私事"));
        verify(leaveRequestService).submit(FACTORY_ID, USER_ID, "LR-001");

        String msg = result.get("message").toString();
        // R2 context: id + user + type + date range + duration + status
        assertTrue(msg.contains("LR-001"));
        assertTrue(msg.contains(String.valueOf(USER_ID)));
        assertTrue(msg.contains("ANNUAL"));
        assertTrue(msg.contains("2026-06-01"));
        assertTrue(msg.contains("2026-06-02"));
        assertTrue(msg.contains("SUBMITTED"));
        assertTrue(msg.contains("待审批"));

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals("LR-001", data.get("id"));
        assertEquals(USER_ID, data.get("userId"));
        assertEquals("SUBMITTED", data.get("status"));
    }

    @Test
    @DisplayName("UT-LV-07: Execute auto-approve path — submit returns APPROVED (no approval chain)")
    void executeAutoApproved() throws Exception {
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 1);  // 1 day

        LeaveRequest draft = LeaveRequest.builder().id("LR-002").factoryId(FACTORY_ID)
                .userId(USER_ID).leaveType(LeaveType.SICK)
                .startDate(start).endDate(end)
                .durationHours(new BigDecimal("8"))
                .status(HrRequestStatus.DRAFT).build();
        LeaveRequest approved = LeaveRequest.builder().id("LR-002").factoryId(FACTORY_ID)
                .userId(USER_ID).leaveType(LeaveType.SICK)
                .startDate(start).endDate(end)
                .durationHours(new BigDecimal("8"))
                .status(HrRequestStatus.APPROVED)
                .submittedAt(LocalDateTime.now()).build();

        when(leaveRequestService.create(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(draft);
        when(leaveRequestService.submit(any(), any(), eq("LR-002"))).thenReturn(approved);

        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "SICK");
        params.put("startDate", start.toString());
        params.put("endDate", end.toString());

        Map<String, Object> result = invokeDoExecute(submitTool, FACTORY_ID, params, ctx());

        String msg = result.get("message").toString();
        assertTrue(msg.contains("APPROVED"));
        assertTrue(msg.contains("已自动批准"));
    }

    @Test
    @DisplayName("UT-LV-08: R4 — 时段重叠 BusinessException(409) → DUPLICATE status + actionHint")
    void executeOverlapReturnsDuplicate() throws Exception {
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 3);

        when(leaveRequestService.create(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new BusinessException(409,
                        "您在 2026-06-01 ~ 2026-06-05 期间已有请假申请 (LR-EXIST, 状态=SUBMITTED), 请先撤回或修改原申请"));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", start.toString());
        params.put("endDate", end.toString());

        Map<String, Object> result = invokeDoExecute(submitTool, FACTORY_ID, params, ctx());

        assertEquals("DUPLICATE", result.get("status"));
        String msg = result.get("message").toString();
        assertTrue(msg.contains("⚠️"));
        assertTrue(msg.contains("LR-EXIST"));
        assertTrue(msg.contains("SUBMITTED"));
        // actionHint present
        assertNotNull(result.get("actionHint"));
        assertTrue(result.get("actionHint").toString().contains("查看现有申请"));

        // submit NOT called because create threw
        verify(leaveRequestService, never()).submit(any(), any(), any());
    }

    @Test
    @DisplayName("UT-LV-09: Default duration — (end - start + 1) * 8h when durationHours not provided")
    void defaultDurationCalculation() throws Exception {
        when(leaveBalanceService.getBalance(any(), any(), any(), any())).thenReturn(Optional.empty());

        // 5 days inclusive = 40h
        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", "2026-06-01");
        params.put("endDate", "2026-06-05");

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals(0, ((BigDecimal) result.get("requestedHours")).compareTo(new BigDecimal("40")));
        assertEquals(5L, result.get("requestedDays"));
    }

    @Test
    @DisplayName("UT-LV-10: Explicit durationHours overrides default day*8 calculation (half-day support)")
    void explicitDurationOverridesDefault() throws Exception {
        when(leaveBalanceService.getBalance(any(), any(), any(), any())).thenReturn(Optional.empty());

        // 1 day default would be 8h, but explicit 4h (half-day)
        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "ANNUAL");
        params.put("startDate", "2026-06-01");
        params.put("endDate", "2026-06-01");
        params.put("durationHours", 4);  // explicit override

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals(0, ((BigDecimal) result.get("requestedHours")).compareTo(new BigDecimal("4")));
    }

    @Test
    @DisplayName("UT-LV-11: Invalid leaveType returns PREVIEW_INVALID with friendly message (post-#810 audit fix)")
    void invalidLeaveTypeReturnsFriendlyPreviewInvalid() throws Exception {
        // Per audit fix #810: BusinessException at param-parse stage is now CAUGHT in doPreview
        // and returned as structured PREVIEW_INVALID map (instead of propagating + getting
        // sanitized to generic "操作执行失败" by AbstractBusinessTool framework wrap).
        Map<String, Object> params = new HashMap<>();
        params.put("leaveType", "INVALID_TYPE");
        params.put("startDate", "2026-06-01");
        params.put("endDate", "2026-06-01");

        Map<String, Object> result = invokeDoPreview(submitTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW_INVALID", result.get("status"));
        assertEquals(400, ((Number) result.get("code")).intValue());
        String message = String.valueOf(result.get("message"));
        assertTrue(message.contains("不支持的请假类型"),
                "Expected message to mention 不支持的请假类型, got: " + message);
        assertTrue(message.contains("ANNUAL"),
                "Expected message to list ANNUAL as valid option, got: " + message);
    }

    // ─────────── Helpers ───────────

    private Map<String, Object> ctx() {
        return Map.of("factoryId", FACTORY_ID, "userId", USER_ID);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeDoExecute(Object tool, String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        var method = findMethod(tool.getClass(), "doExecute");
        method.setAccessible(true);
        try {
            return (Map<String, Object>) method.invoke(tool, factoryId, params, context);
        } catch (java.lang.reflect.InvocationTargetException ite) {
            // Unwrap so test assertions on BusinessException etc. behave naturally
            if (ite.getCause() instanceof RuntimeException re) throw re;
            if (ite.getCause() instanceof Exception ee) throw ee;
            throw ite;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeDoPreview(Object tool, String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        var method = findMethod(tool.getClass(), "doPreview");
        method.setAccessible(true);
        try {
            return (Map<String, Object>) method.invoke(tool, factoryId, params, context);
        } catch (java.lang.reflect.InvocationTargetException ite) {
            if (ite.getCause() instanceof RuntimeException re) throw re;
            if (ite.getCause() instanceof Exception ee) throw ee;
            throw ite;
        }
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
