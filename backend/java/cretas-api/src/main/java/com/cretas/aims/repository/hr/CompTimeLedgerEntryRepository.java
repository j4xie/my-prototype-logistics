package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.CompTimeLedgerEntry;
import com.cretas.aims.entity.hr.enums.CompTimeSourceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 调休账户明细 repository.
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@Repository
public interface CompTimeLedgerEntryRepository extends JpaRepository<CompTimeLedgerEntry, String> {

    /** 幂等检测: 同来源单据是否已入账. */
    Optional<CompTimeLedgerEntry> findBySourceTypeAndSourceRefId(
            CompTimeSourceType sourceType, String sourceRefId);

    /** 用户全部 ledger, 倒序 (最近的优先). */
    Page<CompTimeLedgerEntry> findByFactoryIdAndUserIdOrderByCreatedAtDesc(
            String factoryId, Long userId, Pageable pageable);

    /** 用户某时段 ledger. */
    @Query("SELECT e FROM CompTimeLedgerEntry e " +
           "WHERE e.factoryId = :factoryId AND e.userId = :userId " +
           "AND e.createdAt >= :from AND e.createdAt < :to " +
           "ORDER BY e.createdAt DESC")
    List<CompTimeLedgerEntry> findByUserAndDateRange(@Param("factoryId") String factoryId,
                                                     @Param("userId") Long userId,
                                                     @Param("from") LocalDateTime from,
                                                     @Param("to") LocalDateTime to);

    /** 用户某月 ledger — 用于月度报表. */
    List<CompTimeLedgerEntry> findByFactoryIdAndUserIdAndYearMonthOrderByCreatedAtDesc(
            String factoryId, Long userId, String yearMonth);
}
