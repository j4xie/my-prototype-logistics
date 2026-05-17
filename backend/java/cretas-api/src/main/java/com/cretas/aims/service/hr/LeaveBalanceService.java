package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.LeaveBalance;
import com.cretas.aims.entity.hr.enums.LeaveType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 假期余额服务.
 *
 * <p>{@link #addEarned} 和 {@link #addUsed} 使用 pessimistic-lock upsert,
 * 调用方需在事务内执行 (典型来自 LeaveRequestService.approve / OvertimeRequestService.approve).
 *
 * @author Cretas Team — Sprint 4 W2 Chat E
 * @since 2026-05-16
 */
public interface LeaveBalanceService {

    /**
     * 累计已获取小时数 (调休 / 年假发放等).
     *
     * @param yearMonth 'YYYY-MM' 格式
     */
    LeaveBalance addEarned(String factoryId, Long userId, LeaveType leaveType,
                          String yearMonth, BigDecimal hours);

    /**
     * 累计已使用小时数 (请假审批通过).
     */
    LeaveBalance addUsed(String factoryId, Long userId, LeaveType leaveType,
                        String yearMonth, BigDecimal hours);

    /** 单查 — 不存在返 empty. */
    Optional<LeaveBalance> getBalance(String factoryId, Long userId,
                                     LeaveType leaveType, String yearMonth);

    /** 用户单月所有类型. */
    List<LeaveBalance> listForUserMonth(String factoryId, Long userId, String yearMonth);

    /** 用户所有月份倒序. */
    List<LeaveBalance> listForUser(String factoryId, Long userId);

    /** 工厂某类型某月所有用户. */
    List<LeaveBalance> listByTypeMonth(String factoryId, LeaveType leaveType, String yearMonth);
}
