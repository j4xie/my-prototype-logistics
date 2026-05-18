package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.CompTimeBalance;
import com.cretas.aims.entity.hr.CompTimeLedgerEntry;
import com.cretas.aims.entity.hr.enums.CompTimeSourceType;
import com.cretas.aims.entity.hr.enums.CompTimeTransactionType;
import com.cretas.aims.repository.hr.CompTimeBalanceRepository;
import com.cretas.aims.repository.hr.CompTimeLedgerEntryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * CompTimeServiceImpl 单元测试.
 *
 * 覆盖: addEarn 新建 balance / addEarn 累加 / addUse / 跨月 carry-over /
 * 幂等 (重复 ref skip) / hours ≤ 0 拒绝.
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@DisplayName("CompTimeServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class CompTimeServiceImplTest {

    @Mock
    private CompTimeBalanceRepository balanceRepository;

    @Mock
    private CompTimeLedgerEntryRepository ledgerRepository;

    @InjectMocks
    private CompTimeServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final Long APPROVER = 99L;
    private static final LocalDateTime MAY_20 = LocalDateTime.of(2026, 5, 20, 18, 0);
    private static final String MAY_YM = "2026-05";

    @Test
    @DisplayName("addEarn 新建 balance + 写 ledger (EARN)")
    void addEarn_creates_balance_and_ledger() {
        when(ledgerRepository.findBySourceTypeAndSourceRefId(
                CompTimeSourceType.OT_APPROVED, "OT-1")).thenReturn(Optional.empty());
        when(balanceRepository.findForUpdate(FACTORY, USER, MAY_YM)).thenReturn(Optional.empty());
        when(balanceRepository.findLatestBefore(FACTORY, USER, MAY_YM))
                .thenReturn(Collections.emptyList());
        when(balanceRepository.save(any(CompTimeBalance.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(ledgerRepository.save(any(CompTimeLedgerEntry.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        CompTimeLedgerEntry e = service.addEarn(FACTORY, USER, new BigDecimal("4"),
                CompTimeSourceType.OT_APPROVED, "OT-1", MAY_20, "test note", APPROVER);

        assertEquals(CompTimeTransactionType.EARN, e.getTransactionType());
        assertEquals(new BigDecimal("4"), e.getHours());
        assertEquals(MAY_YM, e.getYearMonth());
        assertEquals(new BigDecimal("4"), e.getBalanceAfterHours());
        assertEquals(APPROVER, e.getOperatorId());
        verify(balanceRepository, atLeast(1)).save(any(CompTimeBalance.class));
        verify(ledgerRepository).save(any(CompTimeLedgerEntry.class));
    }

    @Test
    @DisplayName("addUse 扣减 availableHours")
    void addUse_decrements_balance() {
        CompTimeBalance existing = CompTimeBalance.builder()
                .factoryId(FACTORY).userId(USER).yearMonth(MAY_YM)
                .earnedThisMonth(BigDecimal.ZERO).usedThisMonth(BigDecimal.ZERO)
                .availableHours(new BigDecimal("10")).build();
        when(ledgerRepository.findBySourceTypeAndSourceRefId(any(), any()))
                .thenReturn(Optional.empty());
        when(balanceRepository.findForUpdate(FACTORY, USER, MAY_YM))
                .thenReturn(Optional.of(existing));
        when(balanceRepository.save(any(CompTimeBalance.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(ledgerRepository.save(any(CompTimeLedgerEntry.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        CompTimeLedgerEntry e = service.addUse(FACTORY, USER, new BigDecimal("3"),
                CompTimeSourceType.LEAVE_APPROVED, "L-1", MAY_20, "leave", APPROVER);

        assertEquals(CompTimeTransactionType.USE, e.getTransactionType());
        assertEquals(new BigDecimal("3"), existing.getUsedThisMonth());
        assertEquals(new BigDecimal("7"), existing.getAvailableHours());
        assertEquals(new BigDecimal("7"), e.getBalanceAfterHours());
    }

    @Test
    @DisplayName("幂等: 同 (sourceType, sourceRefId) 第二次返已有 ledger 不动 balance")
    void duplicate_ref_returns_existing_no_balance_change() {
        CompTimeLedgerEntry existing = CompTimeLedgerEntry.builder()
                .id("L-EXIST").factoryId(FACTORY).userId(USER)
                .transactionType(CompTimeTransactionType.EARN)
                .hours(new BigDecimal("4"))
                .sourceType(CompTimeSourceType.OT_APPROVED).sourceRefId("OT-DUP")
                .yearMonth(MAY_YM).balanceAfterHours(new BigDecimal("4")).build();
        when(ledgerRepository.findBySourceTypeAndSourceRefId(
                CompTimeSourceType.OT_APPROVED, "OT-DUP"))
                .thenReturn(Optional.of(existing));

        CompTimeLedgerEntry result = service.addEarn(FACTORY, USER, new BigDecimal("4"),
                CompTimeSourceType.OT_APPROVED, "OT-DUP", MAY_20, "dup", APPROVER);

        assertEquals("L-EXIST", result.getId());
        verify(balanceRepository, never()).findForUpdate(any(), any(), any());
        verify(balanceRepository, never()).save(any());
        verify(ledgerRepository, never()).save(any());
    }

    @Test
    @DisplayName("addEarn hours ≤ 0 抛 IllegalArgumentException")
    void zero_or_negative_hours_rejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.addEarn(FACTORY, USER, BigDecimal.ZERO,
                        CompTimeSourceType.OT_APPROVED, "OT-2", MAY_20, "z", APPROVER));
        assertThrows(IllegalArgumentException.class,
                () -> service.addEarn(FACTORY, USER, new BigDecimal("-1"),
                        CompTimeSourceType.OT_APPROVED, "OT-3", MAY_20, "n", APPROVER));
    }

    @Test
    @DisplayName("跨月 carry-over: 新月新建 balance 时 availableHours = 上月剩余")
    void cross_month_carry_over() {
        CompTimeBalance april = CompTimeBalance.builder()
                .yearMonth("2026-04")
                .earnedThisMonth(new BigDecimal("8")).usedThisMonth(new BigDecimal("0"))
                .availableHours(new BigDecimal("8")).build();
        when(ledgerRepository.findBySourceTypeAndSourceRefId(any(), any()))
                .thenReturn(Optional.empty());
        when(balanceRepository.findForUpdate(FACTORY, USER, MAY_YM)).thenReturn(Optional.empty());
        when(balanceRepository.findLatestBefore(FACTORY, USER, MAY_YM))
                .thenReturn(List.of(april));
        when(balanceRepository.save(any(CompTimeBalance.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(ledgerRepository.save(any(CompTimeLedgerEntry.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        CompTimeLedgerEntry e = service.addEarn(FACTORY, USER, new BigDecimal("4"),
                CompTimeSourceType.OT_APPROVED, "OT-NEW", MAY_20, "新月", APPROVER);

        // carry-over 8 + earn 4 = 12
        assertEquals(new BigDecimal("12"), e.getBalanceAfterHours());
    }
}
