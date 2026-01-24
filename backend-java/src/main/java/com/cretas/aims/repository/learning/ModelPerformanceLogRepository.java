package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.ModelPerformanceLog;
import com.cretas.aims.entity.learning.ModelPerformanceLog.PeriodType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for ModelPerformanceLog entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface ModelPerformanceLogRepository extends JpaRepository<ModelPerformanceLog, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by factory, period type, and start time
     */
    Optional<ModelPerformanceLog> findByFactoryIdAndPeriodTypeAndPeriodStart(
            String factoryId, PeriodType periodType, LocalDateTime periodStart);

    /**
     * Find logs for factory in time range
     */
    List<ModelPerformanceLog> findByFactoryIdAndPeriodTypeAndPeriodStartBetweenOrderByPeriodStartAsc(
            String factoryId, PeriodType periodType,
            LocalDateTime startDate, LocalDateTime endDate);

    /**
     * Find latest log for factory
     */
    Optional<ModelPerformanceLog> findFirstByFactoryIdAndPeriodTypeOrderByPeriodStartDesc(
            String factoryId, PeriodType periodType);

    // ==================== Trend Analysis ====================

    /**
     * Get accuracy trend
     */
    @Query("SELECT l.periodStart, l.accuracyRate FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.periodStart >= :startDate " +
           "AND l.accuracyRate IS NOT NULL " +
           "ORDER BY l.periodStart ASC")
    List<Object[]> getAccuracyTrend(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Get match rate trend
     */
    @Query("SELECT l.periodStart, " +
           "       CASE WHEN l.totalRequests > 0 THEN CAST(l.matchedRequests AS double) / l.totalRequests ELSE 0 END " +
           "FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.periodStart >= :startDate " +
           "ORDER BY l.periodStart ASC")
    List<Object[]> getMatchRateTrend(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Get LLM fallback rate trend
     */
    @Query("SELECT l.periodStart, " +
           "       CASE WHEN l.totalRequests > 0 THEN CAST(l.llmFallbackCount AS double) / l.totalRequests ELSE 0 END " +
           "FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.periodStart >= :startDate " +
           "ORDER BY l.periodStart ASC")
    List<Object[]> getLlmFallbackTrend(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    // ==================== Aggregations ====================

    /**
     * Get total requests over period
     */
    @Query("SELECT SUM(l.totalRequests) FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.periodStart >= :startDate")
    Long getTotalRequests(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Get average accuracy over period
     */
    @Query("SELECT AVG(l.accuracyRate) FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.periodStart >= :startDate " +
           "AND l.accuracyRate IS NOT NULL")
    BigDecimal getAverageAccuracy(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Get average confidence over period
     */
    @Query("SELECT AVG(l.avgConfidence) FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.periodStart >= :startDate " +
           "AND l.avgConfidence IS NOT NULL")
    BigDecimal getAverageConfidence(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    // ==================== Performance Alerts ====================

    /**
     * Find periods with low accuracy
     */
    @Query("SELECT l FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.accuracyRate < :threshold " +
           "AND l.periodStart >= :startDate " +
           "ORDER BY l.periodStart DESC")
    List<ModelPerformanceLog> findLowAccuracyPeriods(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("threshold") BigDecimal threshold,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Find periods with high LLM usage
     */
    @Query("SELECT l FROM ModelPerformanceLog l " +
           "WHERE l.factoryId = :factoryId " +
           "AND l.periodType = :periodType " +
           "AND l.llmFallbackCount > l.totalRequests * :thresholdRatio " +
           "AND l.periodStart >= :startDate " +
           "ORDER BY l.periodStart DESC")
    List<ModelPerformanceLog> findHighLlmUsagePeriods(
            @Param("factoryId") String factoryId,
            @Param("periodType") PeriodType periodType,
            @Param("thresholdRatio") double thresholdRatio,
            @Param("startDate") LocalDateTime startDate);

    // ==================== Comparison ====================

    /**
     * Compare factory performance
     */
    @Query("SELECT l.factoryId, AVG(l.accuracyRate) FROM ModelPerformanceLog l " +
           "WHERE l.periodType = :periodType " +
           "AND l.periodStart >= :startDate " +
           "AND l.accuracyRate IS NOT NULL " +
           "GROUP BY l.factoryId " +
           "ORDER BY AVG(l.accuracyRate) DESC")
    List<Object[]> compareFactoryPerformance(
            @Param("periodType") PeriodType periodType,
            @Param("startDate") LocalDateTime startDate);

    // ==================== Cleanup ====================

    /**
     * Delete old logs
     */
    @Query("DELETE FROM ModelPerformanceLog l " +
           "WHERE l.periodType = :periodType " +
           "AND l.periodEnd < :cutoffDate")
    int deleteOldLogs(
            @Param("periodType") PeriodType periodType,
            @Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * Check if log exists
     */
    boolean existsByFactoryIdAndPeriodTypeAndPeriodStart(
            String factoryId, PeriodType periodType, LocalDateTime periodStart);
}
