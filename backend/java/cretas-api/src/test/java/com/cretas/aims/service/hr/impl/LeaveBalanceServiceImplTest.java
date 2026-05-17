package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.LeaveBalance;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.repository.hr.LeaveBalanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * LeaveBalanceServiceImpl 单元测试 — Sprint 4 W2 Chat E.
 *
 * 覆盖: addEarned 新建 / addEarned 增量 / addUsed 增量 / pessimistic lock 路径.
 */
@DisplayName("LeaveBalanceServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class LeaveBalanceServiceImplTest {

    @Mock
    private LeaveBalanceRepository repository;

    @InjectMocks
    private LeaveBalanceServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final String YM = "2026-05";

    @Test
    @DisplayName("addEarned 不存在时创建新行 + earnedHours = hours")
    void addEarned_creates_new_when_not_exists() {
        when(repository.findForUpdateByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
                FACTORY, USER, LeaveType.COMPTIME, YM)).thenReturn(Optional.empty());
        when(repository.save(any(LeaveBalance.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        LeaveBalance result = service.addEarned(FACTORY, USER, LeaveType.COMPTIME, YM,
                new BigDecimal("4.5"));

        assertEquals(new BigDecimal("4.5"), result.getEarnedHours());
        assertEquals(BigDecimal.ZERO, result.getUsedHours());
        verify(repository, atLeast(1)).save(any(LeaveBalance.class));
    }

    @Test
    @DisplayName("addEarned 已存在时累加 earnedHours")
    void addEarned_increments_existing() {
        LeaveBalance existing = LeaveBalance.builder()
                .factoryId(FACTORY).userId(USER).leaveType(LeaveType.ANNUAL)
                .yearMonth(YM)
                .earnedHours(new BigDecimal("8")).usedHours(BigDecimal.ZERO)
                .build();
        when(repository.findForUpdateByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
                FACTORY, USER, LeaveType.ANNUAL, YM)).thenReturn(Optional.of(existing));
        when(repository.save(any(LeaveBalance.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        LeaveBalance result = service.addEarned(FACTORY, USER, LeaveType.ANNUAL, YM,
                new BigDecimal("16"));

        assertEquals(new BigDecimal("24"), result.getEarnedHours());
        assertEquals(BigDecimal.ZERO, result.getUsedHours());
    }

    @Test
    @DisplayName("addUsed 累加 usedHours 不动 earnedHours")
    void addUsed_increments_used_only() {
        LeaveBalance existing = LeaveBalance.builder()
                .factoryId(FACTORY).userId(USER).leaveType(LeaveType.ANNUAL)
                .yearMonth(YM)
                .earnedHours(new BigDecimal("40")).usedHours(new BigDecimal("8"))
                .build();
        when(repository.findForUpdateByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
                FACTORY, USER, LeaveType.ANNUAL, YM)).thenReturn(Optional.of(existing));
        when(repository.save(any(LeaveBalance.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        LeaveBalance result = service.addUsed(FACTORY, USER, LeaveType.ANNUAL, YM,
                new BigDecimal("8"));

        assertEquals(new BigDecimal("40"), result.getEarnedHours());
        assertEquals(new BigDecimal("16"), result.getUsedHours());
    }
}
