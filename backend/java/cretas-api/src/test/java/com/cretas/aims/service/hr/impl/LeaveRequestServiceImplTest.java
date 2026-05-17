package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.entity.hr.LeaveRequest;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.LeaveRequestRepository;
import com.cretas.aims.service.ApprovalChainService;
import com.cretas.aims.service.hr.LeaveBalanceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * LeaveRequestServiceImpl 单元测试 — Sprint 4 W2 Chat E.
 *
 * 覆盖: create dedup R4 / submit DRAFT→SUBMITTED / approve SUBMITTED→APPROVED +
 * LeaveBalance integration for tracked types / 非 tracked 类型 skip balance /
 * state guard 拒绝非法转移.
 */
@DisplayName("LeaveRequestServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class LeaveRequestServiceImplTest {

    @Mock
    private LeaveRequestRepository repository;

    @Mock
    private LeaveBalanceService balanceService;

    @Mock
    private ApprovalChainService approvalChainService;

    private LeaveRequestServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final Long APPROVER = 99L;

    @BeforeEach
    void setUp() throws Exception {
        service = new LeaveRequestServiceImpl(repository, balanceService);
        Field f = LeaveRequestServiceImpl.class.getDeclaredField("approvalChainService");
        f.setAccessible(true);
        f.set(service, approvalChainService);
    }

    private LeaveRequest sample(HrRequestStatus status, LeaveType type) {
        return LeaveRequest.builder()
                .id("L-001").factoryId(FACTORY).userId(USER)
                .leaveType(type)
                .startDate(LocalDate.of(2026, 5, 20))
                .endDate(LocalDate.of(2026, 5, 22))
                .durationHours(new BigDecimal("24"))
                .status(status).build();
    }

    @Test
    @DisplayName("create R4 防呆: 时段重叠返 409 BusinessException")
    void create_dedup_rejects_overlap() {
        LeaveRequest existing = sample(HrRequestStatus.SUBMITTED, LeaveType.ANNUAL);
        when(repository.findOverlappingActive(eq(FACTORY), eq(USER),
                any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(existing));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY, USER, LeaveType.ANNUAL,
                        LocalDate.of(2026, 5, 21), LocalDate.of(2026, 5, 23),
                        new BigDecimal("16"), "test"));
        assertTrue(ex.getMessage().contains("L-001") || ex.getMessage().contains("已有"));
    }

    @Test
    @DisplayName("approve ANNUAL 触发 LeaveBalance.addUsed (tracked type)")
    void approve_calls_balance_for_tracked_type() {
        LeaveRequest req = sample(HrRequestStatus.SUBMITTED, LeaveType.ANNUAL);
        when(repository.findByIdAndFactoryId("L-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequest result = service.approve(FACTORY, APPROVER, "L-001");

        assertEquals(HrRequestStatus.APPROVED, result.getStatus());
        assertNotNull(result.getApprovedAt());
        verify(balanceService).addUsed(FACTORY, USER, LeaveType.ANNUAL, "2026-05",
                new BigDecimal("24"));
    }

    @Test
    @DisplayName("approve PERSONAL (非 tracked) 不动 LeaveBalance")
    void approve_skips_balance_for_non_tracked() {
        LeaveRequest req = sample(HrRequestStatus.SUBMITTED, LeaveType.PERSONAL);
        when(repository.findByIdAndFactoryId("L-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequest result = service.approve(FACTORY, APPROVER, "L-001");

        assertEquals(HrRequestStatus.APPROVED, result.getStatus());
        verify(balanceService, never()).addUsed(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("approve 非 SUBMITTED 状态拒绝")
    void approve_rejects_non_submitted() {
        LeaveRequest req = sample(HrRequestStatus.DRAFT, LeaveType.ANNUAL);
        when(repository.findByIdAndFactoryId("L-001", FACTORY)).thenReturn(Optional.of(req));

        assertThrows(BusinessException.class,
                () -> service.approve(FACTORY, APPROVER, "L-001"));
    }

    @Test
    @DisplayName("submit 触发 ApprovalChainService.requiresApproval; needsApproval=true 留 SUBMITTED")
    void submit_with_approval_required_stays_submitted() {
        LeaveRequest req = sample(HrRequestStatus.DRAFT, LeaveType.ANNUAL);
        when(repository.findByIdAndFactoryId("L-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(approvalChainService.requiresApproval(eq(FACTORY),
                eq(DecisionType.LEAVE_APPROVAL), anyMap())).thenReturn(true);

        LeaveRequest result = service.submit(FACTORY, USER, "L-001");

        assertEquals(HrRequestStatus.SUBMITTED, result.getStatus());
        verify(balanceService, never()).addUsed(any(), any(), any(), any(), any());
    }
}
