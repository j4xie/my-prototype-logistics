package com.cretas.aims.repository;

import com.cretas.aims.entity.AIQuotaUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * AI配额使用数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
@Repository
public interface AIQuotaUsageRepository extends JpaRepository<AIQuotaUsage, Long> {

    /**
     * 查找工厂当前周的配额使用情况
     */
    Optional<AIQuotaUsage> findByFactoryIdAndWeekStart(String factoryId, LocalDate weekStart);

    /**
     * 检查工厂当前周配额是否存在
     */
    boolean existsByFactoryIdAndWeekStart(String factoryId, LocalDate weekStart);

    /**
     * 获取工厂的历史配额使用记录（用于分析）
     */
    List<AIQuotaUsage> findByFactoryIdOrderByWeekStartDesc(String factoryId);

    /**
     * 获取工厂指定时间范围的配额使用记录
     */
    List<AIQuotaUsage> findByFactoryIdAndWeekStartBetween(
            String factoryId, LocalDate startWeek, LocalDate endWeek);

    /**
     * 增加配额使用次数
     */
    @Modifying
    @Query("UPDATE AIQuotaUsage q SET q.usedCount = q.usedCount + :count " +
           "WHERE q.factoryId = :factoryId AND q.weekStart = :weekStart")
    int incrementUsedCount(@Param("factoryId") String factoryId,
                          @Param("weekStart") LocalDate weekStart,
                          @Param("count") Integer count);

    /**
     * 统计所有工厂当前周的配额使用情况
     */
    @Query("SELECT q.factoryId, q.usedCount, q.quotaLimit FROM AIQuotaUsage q " +
           "WHERE q.weekStart = :currentWeek")
    List<Object[]> findAllCurrentWeekUsage(@Param("currentWeek") LocalDate currentWeek);

    /**
     * 查找超额使用的工厂
     */
    @Query("SELECT q FROM AIQuotaUsage q WHERE q.weekStart = :weekStart " +
           "AND q.usedCount >= q.quotaLimit")
    List<AIQuotaUsage> findExceededQuotas(@Param("weekStart") LocalDate weekStart);

    /**
     * 统计工厂的总配额使用次数
     */
    @Query("SELECT SUM(q.usedCount) FROM AIQuotaUsage q WHERE q.factoryId = :factoryId")
    Long sumTotalUsageByFactory(@Param("factoryId") String factoryId);

    /**
     * 计算工厂的平均配额使用率
     */
    @Query("SELECT AVG(CAST(q.usedCount AS double) / q.quotaLimit * 100) FROM AIQuotaUsage q " +
           "WHERE q.factoryId = :factoryId")
    Double calculateAverageUsageRate(@Param("factoryId") String factoryId);

    /**
     * 删除旧的配额记录（保留最近26周即半年）
     */
    @Modifying
    @Query("DELETE FROM AIQuotaUsage q WHERE q.weekStart < :cutoffDate")
    int deleteOldQuotaRecords(@Param("cutoffDate") LocalDate cutoffDate);
}
