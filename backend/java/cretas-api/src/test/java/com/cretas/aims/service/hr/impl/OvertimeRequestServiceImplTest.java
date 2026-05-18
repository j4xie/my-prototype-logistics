package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.OvertimeRequest;
import com.cretas.aims.entity.hr.enums.CompensationType;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.entity.hr.enums.OvertimeType;
import com.cretas.aims.event.OvertimeApprovedEvent;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.OvertimeRequestRepository;
import com.cretas.aims.service.ApprovalChainService;
import com.cretas.aims.service.hr.LeaveBalanceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * OvertimeRequestServiceImpl 单元测试.
 *
 * 覆盖: create HOLIDAY+COMPTIME 拒绝 / approve COMPTIME → addEarned /
 * approve CASH 不动 balance.
 */
@DisplayName("OvertimeRequestServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class OvertimeRequestServiceImplTest {

    @Mock
    private OvertimeRequestRepository repository;

    @Mock
    private LeaveBalanceService balanceService;

    @Mock
    private ApprovalChainService approvalChainService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private OvertimeRequestServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final Long APPROVER = 99L;

    @BeforeEach
    void setUp() throws Exception {
        service = new OvertimeRequestServiceImpl(repository, balanceService, eventPublisher);
        Field f = OvertimeRequestServiceImpl.class.getDeclaredField("approvalChainService");
        f.setAccessible(true);
        f.set(service, approvalChainService);
    }

    private OvertimeRequest sample(HrRequestStatus status, CompensationType comp) {
        return OvertimeRequest.builder()
                .id("O-001").factoryId(FACTORY).userId(USER)
                .overtimeType(OvertimeType.WEEKDAY)
                .startTime(LocalDateTime.of(2026, 5, 20, 18, 0))
                .endTime(LocalDateTime.of(2026, 5, 20, 22, 0))
                .hours(new BigDecimal("4"))
                .compensationType(comp).status(status).build();
    }

    @Test
    @DisplayName("create HOLIDAY + COMPTIME 校验失败 (法定不可转调休)")
    void create_rejects_holiday_with_comptime() {
        // validate() runs before findOverlappingActive — 不 stub repository
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY, USER, OvertimeType.HOLIDAY,
                        LocalDateTime.of(2026, 5, 1, 9, 0),
                        LocalDateTime.of(2026, 5, 1, 17, 0),
                        new BigDecimal("8"), CompensationType.COMPTIME, "test"));
        assertTrue(ex.getMessage().contains("调休") || ex.getMessage().contains("节假日"));
    }

    @Test
    @DisplayName("approve COMPTIME → LeaveBalance.addEarned (LeaveType.COMPTIME)")
    void approve_comptime_adds_earned() {
        OvertimeRequest req = sample(HrRequestStatus.SUBMITTED, CompensationType.COMPTIME);
        when(repository.findByIdAndFactoryId("O-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(OvertimeRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        OvertimeRequest result = service.approve(FACTORY, APPROVER, "O-001");

        assertEquals(HrRequestStatus.APPROVED, result.getStatus());
        verify(balanceService).addEarned(FACTORY, USER, LeaveType.COMPTIME, "2026-05",
                new BigDecimal("4"));
        verify(eventPublisher).publishEvent(any(OvertimeApprovedEvent.class));
    }

    @Test
    @DisplayName("approve CASH 不动 LeaveBalance 但仍发布事件")
    void approve_cash_skips_balance() {
        OvertimeRequest req = sample(HrRequestStatus.SUBMITTED, CompensationType.CASH);
        when(repository.findByIdAndFactoryId("O-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(OvertimeRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        OvertimeRequest result = service.approve(FACTORY, APPROVER, "O-001");

        assertEquals(HrRequestStatus.APPROVED, result.getStatus());
        verify(balanceService, never()).addEarned(any(), any(), any(), any(), any());
        // 事件仍发布 — 让 future Payroll listener 拿到 CASH OT
        verify(eventPublisher).publishEvent(any(OvertimeApprovedEvent.class));
    }
}
