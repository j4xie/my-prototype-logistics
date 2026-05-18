package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.hr.LeaveRequest;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.UserRepository;
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
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link LeaveRequestApproveTool} (closes #848).
 *
 * <p>Covers:
 * <ul>
 *   <li>UT-LV-AP-01: metadata (name/ActionType=WRITE/RiskLevel=MEDIUM/supportsPreview)</li>
 *   <li>UT-LV-AP-02: Preview APPROVE happy path — SUBMITTED → canDo=true + R2 context</li>
 *   <li>UT-LV-AP-03: Preview REJECT happy path — notes filled, canDo=true</li>
 *   <li>UT-LV-AP-04: Preview already-APPROVED → canDo=false + state message</li>
 *   <li>UT-LV-AP-05: Preview LeaveRequest not found → PREVIEW_NOT_FOUND</li>
 *   <li>UT-LV-AP-06: REJECT without notes → PREVIEW_INVALID (R3 dropdown + required-notes)</li>
 *   <li>UT-LV-AP-07: Invalid decision enum → PREVIEW_INVALID friendly</li>
 *   <li>UT-LV-AP-08: Execute APPROVE → Service.approve called, R2 message contains context</li>
 *   <li>UT-LV-AP-09: Execute REJECT → Service.reject called with notes, rejectReason in data</li>
 *   <li>UT-LV-AP-10: Execute on APPROVED → DUPLICATE + actionHint (R4 dedup)</li>
 *   <li>UT-LV-AP-11: Execute on missing id → NOT_FOUND</li>
 * </ul>
 *
 * @since 2026-05-18 (#848 follow-up)
 */
@ExtendWith(MockitoExtension.class)
class LeaveRequestApproveToolTest {

    private static final String FACTORY_ID = "F001";
    private static final Long APPROVER_ID = 9001L;
    private static final Long REQUESTOR_ID = 1001L;
    private static final String LEAVE_ID = "LR-001";

    @InjectMocks
    private LeaveRequestApproveTool approveTool;

    @Mock
    private LeaveRequestService leaveRequestService;

    @Mock
    private UserRepository userRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        injectObjectMapper(approveTool);
    }

    @Test
    @DisplayName("UT-LV-AP-01: Tool metadata — name/ActionType=WRITE/RiskLevel=MEDIUM/supportsPreview=true")
    void toolMetadata() {
        assertEquals("hr_leave_approve", approveTool.getToolName());
        assertEquals(ToolExecutor.ActionType.WRITE, approveTool.getActionType());
        assertEquals(ToolExecutor.RiskLevel.MEDIUM, approveTool.getRiskLevel());
        assertTrue(approveTool.supportsPreview());
        assertTrue(approveTool.getDescription().contains("批准"));
        assertTrue(approveTool.getDescription().contains("驳回"));
        assertEquals(2, approveTool.getRequiredParameters().size());
        assertTrue(approveTool.getRequiredParameters().contains("leaveRequestId"));
        assertTrue(approveTool.getRequiredParameters().contains("decision"));
    }

    @Test
    @DisplayName("UT-LV-AP-02: Preview APPROVE on SUBMITTED — canDo=true + R2 context (requestor / type / period / status)")
    void previewApproveSubmittedHappyPath() throws Exception {
        when(leaveRequestService.getById(FACTORY_ID, LEAVE_ID))
                .thenReturn(Optional.of(submittedLeaveRequest()));
        when(userRepository.findById(REQUESTOR_ID))
                .thenReturn(Optional.of(buildUser("张三", "zhangsan")));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "APPROVE");

        Map<String, Object> result = invokeDoPreview(approveTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW", result.get("status"));
        assertEquals(true, result.get("canDo"));
        assertEquals(LEAVE_ID, result.get("leaveRequestId"));
        assertEquals("APPROVE", result.get("decision"));
        assertEquals(APPROVER_ID, result.get("approverId"));
        assertEquals(REQUESTOR_ID, result.get("requestorUserId"));
        assertEquals("张三", result.get("requestorName"));
        assertEquals("ANNUAL", result.get("leaveType"));
        assertEquals("SUBMITTED", result.get("currentStatus"));

        String msg = result.get("message").toString();
        assertTrue(msg.contains("✓"), "Expected ✓ in message: " + msg);
        assertTrue(msg.contains("批准"), "Expected '批准' in message: " + msg);
        assertTrue(msg.contains("张三"), "Expected '张三' in message: " + msg);
        assertTrue(msg.contains("ANNUAL"), "Expected 'ANNUAL' in message: " + msg);
        assertTrue(msg.contains(LEAVE_ID), "Expected LEAVE_ID in message: " + msg);
        assertTrue(msg.contains(String.valueOf(APPROVER_ID)),
                "Expected APPROVER_ID in message: " + msg);

        // R1: preview does NOT call approve/reject
        verify(leaveRequestService, never()).approve(any(), any(), any());
        verify(leaveRequestService, never()).reject(any(), any(), any(), any());
    }

    @Test
    @DisplayName("UT-LV-AP-03: Preview REJECT with notes — canDo=true, notes present")
    void previewRejectHappyPath() throws Exception {
        when(leaveRequestService.getById(FACTORY_ID, LEAVE_ID))
                .thenReturn(Optional.of(submittedLeaveRequest()));
        when(userRepository.findById(REQUESTOR_ID))
                .thenReturn(Optional.of(buildUser("张三", "zhangsan")));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "REJECT");
        params.put("notes", "本周生产高峰, 延期审批");

        Map<String, Object> result = invokeDoPreview(approveTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW", result.get("status"));
        assertEquals(true, result.get("canDo"));
        assertEquals("REJECT", result.get("decision"));
        assertEquals("本周生产高峰, 延期审批", result.get("notes"));
        String msg = result.get("message").toString();
        assertTrue(msg.contains("驳回"), "Expected '驳回' in message: " + msg);
    }

    @Test
    @DisplayName("UT-LV-AP-04: Preview on already-APPROVED LeaveRequest — canDo=false + state message")
    void previewAlreadyApproved() throws Exception {
        LeaveRequest approved = submittedLeaveRequest();
        approved.setStatus(HrRequestStatus.APPROVED);
        approved.setApprovedAt(LocalDateTime.now().minusHours(1));
        when(leaveRequestService.getById(FACTORY_ID, LEAVE_ID))
                .thenReturn(Optional.of(approved));
        when(userRepository.findById(REQUESTOR_ID))
                .thenReturn(Optional.of(buildUser("张三", "zhangsan")));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "APPROVE");

        Map<String, Object> result = invokeDoPreview(approveTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW", result.get("status"));
        assertEquals(false, result.get("canDo"));
        assertEquals("APPROVED", result.get("currentStatus"));
        String msg = result.get("message").toString();
        assertTrue(msg.contains("⚠️"), "Expected ⚠️ in message: " + msg);
        assertTrue(msg.contains("APPROVED"), "Expected APPROVED in message: " + msg);
        assertTrue(msg.contains("SUBMITTED"), "Expected SUBMITTED reference in message: " + msg);

        // Did NOT mutate
        verify(leaveRequestService, never()).approve(any(), any(), any());
    }

    @Test
    @DisplayName("UT-LV-AP-05: Preview LeaveRequest not found → PREVIEW_NOT_FOUND")
    void previewNotFound() throws Exception {
        when(leaveRequestService.getById(FACTORY_ID, "LR-MISSING"))
                .thenReturn(Optional.empty());

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", "LR-MISSING");
        params.put("decision", "APPROVE");

        Map<String, Object> result = invokeDoPreview(approveTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW_NOT_FOUND", result.get("status"));
        assertEquals(404, ((Number) result.get("code")).intValue());
        assertTrue(result.get("message").toString().contains("LR-MISSING"));
    }

    @Test
    @DisplayName("UT-LV-AP-06: REJECT without notes → PREVIEW_INVALID (R3 required-notes enforcement)")
    void previewRejectWithoutNotesInvalid() throws Exception {
        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "REJECT");
        // notes intentionally omitted

        Map<String, Object> result = invokeDoPreview(approveTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW_INVALID", result.get("status"));
        assertEquals(400, ((Number) result.get("code")).intValue());
        String msg = result.get("message").toString();
        assertTrue(msg.contains("notes"), "Expected message mentions notes requirement: " + msg);
        assertTrue(msg.contains("REJECT") || msg.contains("驳回"),
                "Expected message mentions REJECT context: " + msg);

        // Did NOT even look up leaveRequest — short-circuit on param validation
        verify(leaveRequestService, never()).getById(any(), any());
    }

    @Test
    @DisplayName("UT-LV-AP-07: Invalid decision enum → PREVIEW_INVALID with friendly message")
    void previewInvalidDecisionEnum() throws Exception {
        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "MAYBE");  // invalid

        Map<String, Object> result = invokeDoPreview(approveTool, FACTORY_ID, params, ctx());

        assertEquals("PREVIEW_INVALID", result.get("status"));
        assertEquals(400, ((Number) result.get("code")).intValue());
        String msg = result.get("message").toString();
        assertTrue(msg.contains("不支持的审批决定"),
                "Expected 不支持的审批决定: " + msg);
        assertTrue(msg.contains("APPROVE"), "Expected APPROVE in valid options: " + msg);
        assertTrue(msg.contains("REJECT"), "Expected REJECT in valid options: " + msg);
    }

    @Test
    @DisplayName("UT-LV-AP-08: Execute APPROVE — Service.approve called, R2 context message")
    void executeApproveHappyPath() throws Exception {
        LeaveRequest approved = submittedLeaveRequest();
        approved.setStatus(HrRequestStatus.APPROVED);
        approved.setApprovedAt(LocalDateTime.now());
        when(leaveRequestService.approve(FACTORY_ID, APPROVER_ID, LEAVE_ID))
                .thenReturn(approved);
        when(userRepository.findById(REQUESTOR_ID))
                .thenReturn(Optional.of(buildUser("张三", "zhangsan")));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "APPROVE");
        params.put("notes", "已通过");

        Map<String, Object> result = invokeDoExecute(approveTool, FACTORY_ID, params, ctx());

        verify(leaveRequestService).approve(FACTORY_ID, APPROVER_ID, LEAVE_ID);
        verify(leaveRequestService, never()).reject(any(), any(), any(), any());

        String msg = result.get("message").toString();
        // R2 context: approver + 申请人 + 决定 + leaveId + 终态
        assertTrue(msg.contains("批准"), "Expected '批准' in: " + msg);
        assertTrue(msg.contains(LEAVE_ID), "Expected LEAVE_ID in: " + msg);
        assertTrue(msg.contains("张三"), "Expected 张三 in: " + msg);
        assertTrue(msg.contains("APPROVED"), "Expected APPROVED in: " + msg);
        assertTrue(msg.contains(String.valueOf(APPROVER_ID)), "Expected APPROVER_ID in: " + msg);

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals(LEAVE_ID, data.get("id"));
        assertEquals("APPROVE", data.get("decision"));
        assertEquals(APPROVER_ID, data.get("approverId"));
        assertEquals(REQUESTOR_ID, data.get("requestorUserId"));
        assertEquals("张三", data.get("requestorName"));
        assertEquals("APPROVED", data.get("status"));
        assertNotNull(data.get("approvedAt"));
    }

    @Test
    @DisplayName("UT-LV-AP-09: Execute REJECT — Service.reject called with notes, rejectReason in data")
    void executeRejectHappyPath() throws Exception {
        LeaveRequest rejected = submittedLeaveRequest();
        rejected.setStatus(HrRequestStatus.REJECTED);
        rejected.setRejectedAt(LocalDateTime.now());
        rejected.setRejectReason("本周生产高峰, 延期审批");
        when(leaveRequestService.reject(FACTORY_ID, APPROVER_ID, LEAVE_ID, "本周生产高峰, 延期审批"))
                .thenReturn(rejected);
        when(userRepository.findById(REQUESTOR_ID))
                .thenReturn(Optional.of(buildUser("张三", "zhangsan")));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "REJECT");
        params.put("notes", "本周生产高峰, 延期审批");

        Map<String, Object> result = invokeDoExecute(approveTool, FACTORY_ID, params, ctx());

        verify(leaveRequestService).reject(FACTORY_ID, APPROVER_ID, LEAVE_ID, "本周生产高峰, 延期审批");
        verify(leaveRequestService, never()).approve(any(), any(), any());

        String msg = result.get("message").toString();
        assertTrue(msg.contains("驳回"), "Expected '驳回' in: " + msg);
        assertTrue(msg.contains("REJECTED"), "Expected REJECTED in: " + msg);

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.get("data");
        assertEquals("REJECT", data.get("decision"));
        assertEquals("REJECTED", data.get("status"));
        assertEquals("本周生产高峰, 延期审批", data.get("rejectReason"));
        assertNotNull(data.get("rejectedAt"));
    }

    @Test
    @DisplayName("UT-LV-AP-10: R4 — Execute on already-APPROVED → DUPLICATE + actionHint")
    void executeAlreadyApprovedDuplicate() throws Exception {
        when(leaveRequestService.approve(FACTORY_ID, APPROVER_ID, LEAVE_ID))
                .thenThrow(new BusinessException("仅 SUBMITTED 可审批, 当前=APPROVED"));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", LEAVE_ID);
        params.put("decision", "APPROVE");

        Map<String, Object> result = invokeDoExecute(approveTool, FACTORY_ID, params, ctx());

        assertEquals("DUPLICATE", result.get("status"));
        String msg = result.get("message").toString();
        assertTrue(msg.contains("⚠️"));
        assertTrue(msg.contains("APPROVED"));
        assertNotNull(result.get("actionHint"));
        assertTrue(result.get("actionHint").toString().contains("撤回")
                || result.get("actionHint").toString().contains("最新状态"));
    }

    @Test
    @DisplayName("UT-LV-AP-11: Execute on missing id → NOT_FOUND")
    void executeNotFound() throws Exception {
        when(leaveRequestService.approve(FACTORY_ID, APPROVER_ID, "LR-MISSING"))
                .thenThrow(new ResourceNotFoundException("LeaveRequest not found: LR-MISSING"));

        Map<String, Object> params = new HashMap<>();
        params.put("leaveRequestId", "LR-MISSING");
        params.put("decision", "APPROVE");

        Map<String, Object> result = invokeDoExecute(approveTool, FACTORY_ID, params, ctx());

        assertEquals("NOT_FOUND", result.get("status"));
        assertEquals(404, ((Number) result.get("code")).intValue());
        assertTrue(result.get("message").toString().contains("LR-MISSING"));
        assertNotNull(result.get("actionHint"));
    }

    // ─────────── Helpers ───────────

    private LeaveRequest submittedLeaveRequest() {
        return LeaveRequest.builder()
                .id(LEAVE_ID)
                .factoryId(FACTORY_ID)
                .userId(REQUESTOR_ID)
                .leaveType(LeaveType.ANNUAL)
                .startDate(LocalDate.of(2026, 6, 1))
                .endDate(LocalDate.of(2026, 6, 3))
                .durationHours(new BigDecimal("24"))
                .reason("家中有事")
                .status(HrRequestStatus.SUBMITTED)
                .submittedAt(LocalDateTime.now().minusMinutes(30))
                .build();
    }

    private User buildUser(String fullName, String username) {
        User u = new User();
        u.setId(REQUESTOR_ID);
        u.setFactoryId(FACTORY_ID);
        u.setUsername(username);
        u.setFullName(fullName);
        return u;
    }

    private Map<String, Object> ctx() {
        return Map.of("factoryId", FACTORY_ID, "userId", APPROVER_ID);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeDoExecute(Object tool, String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        var method = findMethod(tool.getClass(), "doExecute");
        method.setAccessible(true);
        try {
            return (Map<String, Object>) method.invoke(tool, factoryId, params, context);
        } catch (java.lang.reflect.InvocationTargetException ite) {
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
