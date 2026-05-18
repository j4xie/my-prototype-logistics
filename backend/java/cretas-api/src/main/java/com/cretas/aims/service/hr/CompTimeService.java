package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.CompTimeBalance;
import com.cretas.aims.entity.hr.CompTimeLedgerEntry;
import com.cretas.aims.entity.hr.enums.CompTimeSourceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 调休账单 service — 余额查询 + 入账 (EARN) / 出账 (USE) + 明细查询.
 *
 * <p>由 listener (CompTimeEventListener) 调用入账; 直接调用属手工调整 (operator=HR).
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
public interface CompTimeService {

    /**
     * 调休入账 (EARN — 加班审批通过).
     *
     * <p>幂等: {@code (sourceType, sourceRefId)} UNIQUE; 重复入账返已有 ledger entry.
     *
     * @return 新创建或已存在的 ledger entry
     */
    CompTimeLedgerEntry addEarn(String factoryId, Long userId, BigDecimal hours,
                                CompTimeSourceType sourceType, String sourceRefId,
                                LocalDateTime sourceTime, String note, Long operatorId);

    /**
     * 调休出账 (USE — 请假审批通过).
     *
     * <p>幂等: 同 addEarn.
     *
     * @return 新创建或已存在的 ledger entry
     */
    CompTimeLedgerEntry addUse(String factoryId, Long userId, BigDecimal hours,
                               CompTimeSourceType sourceType, String sourceRefId,
                               LocalDateTime sourceTime, String note, Long operatorId);

    /** 某用户某月余额. */
    Optional<CompTimeBalance> getBalance(String factoryId, Long userId, String yearMonth);

    /** 某用户全部月份余额, 倒序. */
    List<CompTimeBalance> listBalances(String factoryId, Long userId);

    /** 工厂某月所有员工余额 — HR 报表. */
    List<CompTimeBalance> listFactoryMonth(String factoryId, String yearMonth);

    /** 用户分页 ledger 明细 (倒序最近). */
    Page<CompTimeLedgerEntry> listLedger(String factoryId, Long userId, Pageable pageable);

    /** 用户时段 ledger 明细. */
    List<CompTimeLedgerEntry> listLedgerByDateRange(String factoryId, Long userId,
                                                    LocalDateTime from, LocalDateTime to);

    /** 用户某月 ledger 明细. */
    List<CompTimeLedgerEntry> listLedgerByMonth(String factoryId, Long userId, String yearMonth);
}
