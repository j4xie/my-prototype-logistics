package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.LeaveBalance;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.repository.hr.LeaveBalanceRepository;
import com.cretas.aims.service.hr.LeaveBalanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeaveBalanceServiceImpl implements LeaveBalanceService {

    private final LeaveBalanceRepository balanceRepository;

    @Override
    @Transactional
    public LeaveBalance addEarned(String factoryId, Long userId, LeaveType leaveType,
                                  String yearMonth, BigDecimal hours) {
        LeaveBalance balance = upsertWithLock(factoryId, userId, leaveType, yearMonth);
        balance.setEarnedHours(balance.getEarnedHours().add(hours));
        balance.setLastCalculatedAt(LocalDateTime.now());
        log.info("LeaveBalance addEarned factory={} user={} type={} month={} +{}h",
                factoryId, userId, leaveType, yearMonth, hours);
        return balanceRepository.save(balance);
    }

    @Override
    @Transactional
    public LeaveBalance addUsed(String factoryId, Long userId, LeaveType leaveType,
                                String yearMonth, BigDecimal hours) {
        LeaveBalance balance = upsertWithLock(factoryId, userId, leaveType, yearMonth);
        balance.setUsedHours(balance.getUsedHours().add(hours));
        balance.setLastCalculatedAt(LocalDateTime.now());
        log.info("LeaveBalance addUsed factory={} user={} type={} month={} +{}h",
                factoryId, userId, leaveType, yearMonth, hours);
        return balanceRepository.save(balance);
    }

    private LeaveBalance upsertWithLock(String factoryId, Long userId,
                                       LeaveType leaveType, String yearMonth) {
        return balanceRepository
                .findForUpdateByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
                        factoryId, userId, leaveType, yearMonth)
                .orElseGet(() -> balanceRepository.save(LeaveBalance.builder()
                        .factoryId(factoryId)
                        .userId(userId)
                        .leaveType(leaveType)
                        .yearMonth(yearMonth)
                        .earnedHours(BigDecimal.ZERO)
                        .usedHours(BigDecimal.ZERO)
                        .lastCalculatedAt(LocalDateTime.now())
                        .build()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LeaveBalance> getBalance(String factoryId, Long userId,
                                             LeaveType leaveType, String yearMonth) {
        return balanceRepository.findByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
                factoryId, userId, leaveType, yearMonth);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveBalance> listForUserMonth(String factoryId, Long userId, String yearMonth) {
        return balanceRepository.findByFactoryIdAndUserIdAndYearMonth(factoryId, userId, yearMonth);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveBalance> listForUser(String factoryId, Long userId) {
        return balanceRepository.findByFactoryIdAndUserIdOrderByYearMonthDesc(factoryId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveBalance> listByTypeMonth(String factoryId, LeaveType leaveType, String yearMonth) {
        return balanceRepository.findByFactoryIdAndLeaveTypeAndYearMonth(factoryId, leaveType, yearMonth);
    }
}
