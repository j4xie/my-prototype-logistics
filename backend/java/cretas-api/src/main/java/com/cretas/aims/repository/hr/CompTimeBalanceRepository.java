package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.CompTimeBalance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

/**
 * 调休账单月度余额 repository.
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@Repository
public interface CompTimeBalanceRepository extends JpaRepository<CompTimeBalance, String> {

    Optional<CompTimeBalance> findByFactoryIdAndUserIdAndYearMonth(
            String factoryId, Long userId, String yearMonth);

    /** 悲观锁 — service upsert 时用, 防并发覆盖. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM CompTimeBalance b " +
           "WHERE b.factoryId = :factoryId AND b.userId = :userId " +
           "AND b.yearMonth = :yearMonth")
    Optional<CompTimeBalance> findForUpdate(@Param("factoryId") String factoryId,
                                           @Param("userId") Long userId,
                                           @Param("yearMonth") String yearMonth);

    /** 拿员工最近一个月 ≤ 给定 yearMonth 的余额, 用于跨月累计计算. */
    @Query("SELECT b FROM CompTimeBalance b " +
           "WHERE b.factoryId = :factoryId AND b.userId = :userId " +
           "AND b.yearMonth < :yearMonth " +
           "ORDER BY b.yearMonth DESC")
    List<CompTimeBalance> findLatestBefore(@Param("factoryId") String factoryId,
                                          @Param("userId") Long userId,
                                          @Param("yearMonth") String yearMonth);

    List<CompTimeBalance> findByFactoryIdAndUserIdOrderByYearMonthDesc(
            String factoryId, Long userId);

    /** 工厂某月所有员工余额 — HR 报表用. */
    List<CompTimeBalance> findByFactoryIdAndYearMonth(String factoryId, String yearMonth);
}
