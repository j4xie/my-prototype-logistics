package com.cretas.aims.repository;

import com.cretas.aims.entity.intent.ErrorAttributionStatistics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 错误归因统计数据访问接口
 *
 * 提供:
 * - 每日统计数据的CRUD操作
 * - 日期范围查询
 * - 趋势分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Repository
public interface ErrorAttributionStatisticsRepository extends JpaRepository<ErrorAttributionStatistics, String> {

    // ==================== 基本查询 ====================

    /**
     * 根据工厂ID和日期查询
     */
    Optional<ErrorAttributionStatistics> findByFactoryIdAndStatDate(String factoryId, LocalDate statDate);

    /**
     * 查询工厂的所有统计记录（按日期降序）
     */
    List<ErrorAttributionStatistics> findByFactoryIdOrderByStatDateDesc(String factoryId);

    /**
     * 查询工厂特定日期范围的统计
     */
    List<ErrorAttributionStatistics> findByFactoryIdAndStatDateBetweenOrderByStatDateAsc(
            String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 趋势分析 ====================

    /**
     * 查询最近N天的统计
     */
    @Query("SELECT s FROM ErrorAttributionStatistics s WHERE s.factoryId = :factoryId " +
           "AND s.statDate >= :startDate ORDER BY s.statDate ASC")
    List<ErrorAttributionStatistics> findRecentStatistics(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate);

    /**
     * 计算日期范围内的平均匹配成功率
     */
    @Query("SELECT AVG(CAST(s.matchedCount AS double) / NULLIF(s.totalRequests, 0)) " +
           "FROM ErrorAttributionStatistics s WHERE s.factoryId = :factoryId " +
           "AND s.statDate BETWEEN :startDate AND :endDate")
    Double calculateAverageMatchRate(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 计算日期范围内的总请求数
     */
    @Query("SELECT SUM(s.totalRequests) FROM ErrorAttributionStatistics s " +
           "WHERE s.factoryId = :factoryId AND s.statDate BETWEEN :startDate AND :endDate")
    Long sumTotalRequests(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 计算日期范围内的LLM Fallback次数
     */
    @Query("SELECT SUM(s.llmFallbackCount) FROM ErrorAttributionStatistics s " +
           "WHERE s.factoryId = :factoryId AND s.statDate BETWEEN :startDate AND :endDate")
    Long sumLlmFallbackCount(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // ==================== 错误归因汇总 ====================

    /**
     * 汇总各类错误归因数量
     */
    @Query("SELECT SUM(s.ruleMissCount), SUM(s.ambiguousCount), SUM(s.falsePositiveCount), " +
           "SUM(s.userCancelCount), SUM(s.systemErrorCount) " +
           "FROM ErrorAttributionStatistics s WHERE s.factoryId = :factoryId " +
           "AND s.statDate BETWEEN :startDate AND :endDate")
    List<Object[]> sumErrorAttributions(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 查询错误率最高的日期
     */
    @Query("SELECT s FROM ErrorAttributionStatistics s WHERE s.factoryId = :factoryId " +
           "AND s.statDate BETWEEN :startDate AND :endDate " +
           "ORDER BY (s.failedCount + s.cancelledCount) * 1.0 / NULLIF(s.totalRequests, 0) DESC")
    List<ErrorAttributionStatistics> findHighestErrorRateDays(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // ==================== 信号质量分析 ====================

    /**
     * 计算平均强信号比例
     */
    @Query("SELECT AVG(CAST(s.strongSignalCount AS double) / " +
           "NULLIF(s.strongSignalCount + s.weakSignalCount, 0)) " +
           "FROM ErrorAttributionStatistics s WHERE s.factoryId = :factoryId " +
           "AND s.statDate BETWEEN :startDate AND :endDate")
    Double calculateAverageStrongSignalRate(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 计算用户确认率趋势
     */
    @Query("SELECT s.statDate, " +
           "CAST(s.userConfirmedCount AS double) / " +
           "NULLIF(s.userConfirmedCount + s.userRejectedCount, 0) " +
           "FROM ErrorAttributionStatistics s WHERE s.factoryId = :factoryId " +
           "AND s.statDate BETWEEN :startDate AND :endDate ORDER BY s.statDate ASC")
    List<Object[]> getConfirmationRateTrend(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // ==================== 清理操作 ====================

    /**
     * 删除旧统计数据（保留策略：默认365天）
     */
    int deleteByStatDateBefore(LocalDate cutoffDate);

    /**
     * 检查特定日期是否已有统计
     */
    boolean existsByFactoryIdAndStatDate(String factoryId, LocalDate statDate);
}
