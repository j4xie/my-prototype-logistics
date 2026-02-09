package com.cretas.aims.repository;

import com.cretas.aims.entity.AIAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * AI分析结果数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
@Repository
public interface AIAnalysisResultRepository extends JpaRepository<AIAnalysisResult, Long> {

    /**
     * 根据工厂ID和批次ID查找最新的批次分析
     */
    Optional<AIAnalysisResult> findFirstByFactoryIdAndBatchIdAndReportTypeOrderByCreatedAtDesc(
            String factoryId, String batchId, String reportType);

    /**
     * 根据工厂ID和报告类型查找最新报告（用于周报/月报）
     */
    Optional<AIAnalysisResult> findFirstByFactoryIdAndReportTypeAndExpiresAtAfterOrderByCreatedAtDesc(
            String factoryId, String reportType, LocalDateTime now);

    /**
     * 查找工厂在特定时间段的报告
     */
    List<AIAnalysisResult> findByFactoryIdAndReportTypeAndPeriodStartGreaterThanEqualAndPeriodEndLessThanEqual(
            String factoryId, String reportType, LocalDateTime periodStart, LocalDateTime periodEnd);

    /**
     * 检查工厂特定周期的报告是否已存在
     */
    boolean existsByFactoryIdAndReportTypeAndPeriodStartAndPeriodEnd(
            String factoryId, String reportType, LocalDateTime periodStart, LocalDateTime periodEnd);

    /**
     * 删除过期的报告（清理任务）
     */
    @Modifying
    @Query("DELETE FROM AIAnalysisResult a WHERE a.expiresAt < :now")
    int deleteExpiredReports(@Param("now") LocalDateTime now);

    /**
     * 统计工厂的缓存命中率
     */
    @Query("SELECT COUNT(a) FROM AIAnalysisResult a WHERE a.factoryId = :factoryId " +
           "AND a.createdAt >= :startDate AND a.expiresAt >= :now")
    long countValidCachedReports(@Param("factoryId") String factoryId,
                                 @Param("startDate") LocalDateTime startDate,
                                 @Param("now") LocalDateTime now);

    /**
     * 查找即将过期的报告（用于预生成）
     */
    List<AIAnalysisResult> findByReportTypeAndExpiresAtBetween(
            String reportType, LocalDateTime start, LocalDateTime end);

    /**
     * 获取工厂所有有效的报告
     */
    List<AIAnalysisResult> findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
            String factoryId, LocalDateTime now);

    /**
     * 按批次ID查找所有相关报告
     */
    List<AIAnalysisResult> findByBatchIdOrderByCreatedAtDesc(String batchId);

    /**
     * 统计工厂不同类型报告的数量
     */
    @Query("SELECT a.reportType, COUNT(a) FROM AIAnalysisResult a " +
           "WHERE a.factoryId = :factoryId AND a.expiresAt >= :now " +
           "GROUP BY a.reportType")
    List<Object[]> countReportsByType(@Param("factoryId") String factoryId,
                                      @Param("now") LocalDateTime now);
}
