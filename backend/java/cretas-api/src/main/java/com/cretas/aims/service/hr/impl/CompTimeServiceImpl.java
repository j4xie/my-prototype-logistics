package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.CompTimeBalance;
import com.cretas.aims.entity.hr.CompTimeLedgerEntry;
import com.cretas.aims.entity.hr.enums.CompTimeSourceType;
import com.cretas.aims.entity.hr.enums.CompTimeTransactionType;
import com.cretas.aims.repository.hr.CompTimeBalanceRepository;
import com.cretas.aims.repository.hr.CompTimeLedgerEntryRepository;
import com.cretas.aims.service.hr.CompTimeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/**
 * 调休账单 service 实现.
 *
 * <p>核心逻辑:
 * <ol>
 *   <li>入账/出账先查同 (sourceType, sourceRefId) 是否已 ledger — 幂等</li>
 *   <li>upsert 月度 CompTimeBalance, 维护 earnedThisMonth/usedThisMonth/availableHours</li>
 *   <li>availableHours 跨月累计: 当月新建时, 取上月最近的 availableHours 作为起点</li>
 *   <li>insert ledger entry, 记录 balanceAfterHours snapshot</li>
 *   <li>DataIntegrityViolationException 兜底 (race condition) — 重新查后返已有 entry</li>
 * </ol>
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompTimeServiceImpl implements CompTimeService {

    private final CompTimeBalanceRepository balanceRepository;
    private final CompTimeLedgerEntryRepository ledgerRepository;

    @Override
    @Transactional
    public CompTimeLedgerEntry addEarn(String factoryId, Long userId, BigDecimal hours,
                                       CompTimeSourceType sourceType, String sourceRefId,
                                       LocalDateTime sourceTime, String note, Long operatorId) {
        return record(factoryId, userId, hours,
                CompTimeTransactionType.EARN, sourceType, sourceRefId,
                sourceTime, note, operatorId);
    }

    @Override
    @Transactional
    public CompTimeLedgerEntry addUse(String factoryId, Long userId, BigDecimal hours,
                                      CompTimeSourceType sourceType, String sourceRefId,
                                      LocalDateTime sourceTime, String note, Long operatorId) {
        return record(factoryId, userId, hours,
                CompTimeTransactionType.USE, sourceType, sourceRefId,
                sourceTime, note, operatorId);
    }

    /** Core upsert + ledger insert. */
    private CompTimeLedgerEntry record(String factoryId, Long userId, BigDecimal hours,
                                       CompTimeTransactionType txnType,
                                       CompTimeSourceType sourceType, String sourceRefId,
                                       LocalDateTime sourceTime, String note, Long operatorId) {
        if (hours == null || hours.signum() <= 0) {
            throw new IllegalArgumentException("hours must be > 0, got " + hours);
        }
        if (sourceTime == null) {
            sourceTime = LocalDateTime.now();
        }
        String yearMonth = YearMonth.from(sourceTime.toLocalDate()).toString();

        // 防呆 R4 — 幂等检测: 同来源单据已入账则返已有
        if (sourceRefId != null) {
            Optional<CompTimeLedgerEntry> existing =
                    ledgerRepository.findBySourceTypeAndSourceRefId(sourceType, sourceRefId);
            if (existing.isPresent()) {
                log.info("CompTime ledger idempotent skip: type={} ref={} (already recorded as {})",
                        sourceType, sourceRefId, existing.get().getId());
                return existing.get();
            }
        }

        // upsert balance with pessimistic lock
        CompTimeBalance balance = upsertBalance(factoryId, userId, yearMonth);
        BigDecimal newAvailable;
        if (txnType == CompTimeTransactionType.EARN) {
            balance.setEarnedThisMonth(balance.getEarnedThisMonth().add(hours));
            newAvailable = balance.getAvailableHours().add(hours);
        } else {
            balance.setUsedThisMonth(balance.getUsedThisMonth().add(hours));
            newAvailable = balance.getAvailableHours().subtract(hours);
        }
        balance.setAvailableHours(newAvailable);
        balance.setLastCalculatedAt(LocalDateTime.now());
        balanceRepository.save(balance);

        // insert ledger
        CompTimeLedgerEntry entry = CompTimeLedgerEntry.builder()
                .factoryId(factoryId)
                .userId(userId)
                .transactionType(txnType)
                .hours(hours)
                .sourceType(sourceType)
                .sourceRefId(sourceRefId)
                .yearMonth(yearMonth)
                .balanceAfterHours(newAvailable)
                .note(note)
                .operatorId(operatorId)
                .build();
        try {
            CompTimeLedgerEntry saved = ledgerRepository.save(entry);
            log.info("CompTime ledger {} factory={} user={} txn={} hours={} ref={} balance->{}",
                    saved.getId(), factoryId, userId, txnType, hours, sourceRefId, newAvailable);
            return saved;
        } catch (DataIntegrityViolationException dive) {
            // 兜底 race condition: 并发插入同 source_ref, DB UNIQUE 抛错 — 重新查后返
            log.warn("CompTime ledger insert race for ref={}, fallback to existing", sourceRefId);
            return ledgerRepository.findBySourceTypeAndSourceRefId(sourceType, sourceRefId)
                    .orElseThrow(() -> dive);
        }
    }

    /**
     * upsert 月度 balance. 若新建, available_hours 起点 = 上月最近 available_hours
     * (跨月累计语义).
     */
    private CompTimeBalance upsertBalance(String factoryId, Long userId, String yearMonth) {
        Optional<CompTimeBalance> existing = balanceRepository.findForUpdate(
                factoryId, userId, yearMonth);
        if (existing.isPresent()) {
            return existing.get();
        }
        // 新建: 取上月最近的 availableHours 作为起点
        BigDecimal carryOver = balanceRepository
                .findLatestBefore(factoryId, userId, yearMonth).stream()
                .findFirst()
                .map(CompTimeBalance::getAvailableHours)
                .orElse(BigDecimal.ZERO);

        return balanceRepository.save(CompTimeBalance.builder()
                .factoryId(factoryId)
                .userId(userId)
                .yearMonth(yearMonth)
                .earnedThisMonth(BigDecimal.ZERO)
                .usedThisMonth(BigDecimal.ZERO)
                .availableHours(carryOver)
                .lastCalculatedAt(LocalDateTime.now())
                .build());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CompTimeBalance> getBalance(String factoryId, Long userId, String yearMonth) {
        return balanceRepository.findByFactoryIdAndUserIdAndYearMonth(factoryId, userId, yearMonth);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompTimeBalance> listBalances(String factoryId, Long userId) {
        return balanceRepository.findByFactoryIdAndUserIdOrderByYearMonthDesc(factoryId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompTimeBalance> listFactoryMonth(String factoryId, String yearMonth) {
        return balanceRepository.findByFactoryIdAndYearMonth(factoryId, yearMonth);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CompTimeLedgerEntry> listLedger(String factoryId, Long userId, Pageable pageable) {
        return ledgerRepository.findByFactoryIdAndUserIdOrderByCreatedAtDesc(
                factoryId, userId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompTimeLedgerEntry> listLedgerByDateRange(String factoryId, Long userId,
                                                           LocalDateTime from, LocalDateTime to) {
        return ledgerRepository.findByUserAndDateRange(factoryId, userId, from, to);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompTimeLedgerEntry> listLedgerByMonth(String factoryId, Long userId,
                                                       String yearMonth) {
        return ledgerRepository.findByFactoryIdAndUserIdAndYearMonthOrderByCreatedAtDesc(
                factoryId, userId, yearMonth);
    }
}
