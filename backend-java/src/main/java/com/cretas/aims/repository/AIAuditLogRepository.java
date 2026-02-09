package com.cretas.aims.repository;

import com.cretas.aims.entity.AIAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * AI审计日志数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
@Repository
public interface AIAuditLogRepository extends JpaRepository<AIAuditLog, Long> {

    /**
     * 分页查询工厂的审计日志
     */
    Page<AIAuditLog> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 根据用户ID分页查询审计日志
     */
    Page<AIAuditLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /**
     * 根据Session ID查询审计日志（追踪对话历史）
     */
    List<AIAuditLog> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    /**
     * 查询工厂特定时间范围的审计日志
     */
    List<AIAuditLog> findByFactoryIdAndCreatedAtBetween(
            String factoryId, LocalDateTime startDate, LocalDateTime endDate);

    /**
     * 查询批次的所有AI请求历史
     */
    List<AIAuditLog> findByBatchIdOrderByCreatedAtDesc(String batchId);

    /**
     * 统计工厂的总AI请求次数
     */
    @Query("SELECT COUNT(a) FROM AIAuditLog a WHERE a.factoryId = :factoryId " +
           "AND a.createdAt >= :startDate")
    long countTotalRequests(@Param("factoryId") String factoryId,
                           @Param("startDate") LocalDateTime startDate);

    /**
     * 统计工厂消耗配额的请求次数
     */
    @Query("SELECT COUNT(a) FROM AIAuditLog a WHERE a.factoryId = :factoryId " +
           "AND a.consumedQuota = true AND a.createdAt >= :startDate")
    long countQuotaConsumedRequests(@Param("factoryId") String factoryId,
                                   @Param("startDate") LocalDateTime startDate);

    /**
     * 统计工厂的缓存命中率
     */
    @Query("SELECT COUNT(a) * 100.0 / NULLIF(COUNT(*), 0) FROM AIAuditLog a " +
           "WHERE a.factoryId = :factoryId AND a.cacheHit = true " +
           "AND a.createdAt >= :startDate")
    Double calculateCacheHitRate(@Param("factoryId") String factoryId,
                                 @Param("startDate") LocalDateTime startDate);

    /**
     * 统计工厂的平均响应时间
     */
    @Query("SELECT AVG(a.responseTimeMs) FROM AIAuditLog a WHERE a.factoryId = :factoryId " +
           "AND a.isSuccess = true AND a.createdAt >= :startDate")
    Double calculateAverageResponseTime(@Param("factoryId") String factoryId,
                                       @Param("startDate") LocalDateTime startDate);

    /**
     * 统计工厂的成功率
     */
    @Query("SELECT COUNT(a) * 100.0 / NULLIF(COUNT(*), 0) FROM AIAuditLog a " +
           "WHERE a.factoryId = :factoryId AND a.isSuccess = true " +
           "AND a.createdAt >= :startDate")
    Double calculateSuccessRate(@Param("factoryId") String factoryId,
                                @Param("startDate") LocalDateTime startDate);

    /**
     * 按问题类型统计请求数量
     */
    @Query("SELECT a.questionType, COUNT(a) FROM AIAuditLog a " +
           "WHERE a.factoryId = :factoryId AND a.createdAt >= :startDate " +
           "GROUP BY a.questionType")
    List<Object[]> countRequestsByType(@Param("factoryId") String factoryId,
                                      @Param("startDate") LocalDateTime startDate);

    /**
     * 查询失败的请求（用于排查问题）
     */
    List<AIAuditLog> findByFactoryIdAndIsSuccessFalseOrderByCreatedAtDesc(String factoryId);

    /**
     * 查询最活跃的用户（按请求次数）
     */
    @Query("SELECT a.userId, COUNT(a) as requestCount FROM AIAuditLog a " +
           "WHERE a.factoryId = :factoryId AND a.userId IS NOT NULL " +
           "AND a.createdAt >= :startDate " +
           "GROUP BY a.userId ORDER BY requestCount DESC")
    List<Object[]> findMostActiveUsers(@Param("factoryId") String factoryId,
                                      @Param("startDate") LocalDateTime startDate,
                                      Pageable pageable);

    /**
     * 删除旧的审计日志（保留3年用于合规）
     */
    @Modifying
    @Query("DELETE FROM AIAuditLog a WHERE a.createdAt < :cutoffDate")
    int deleteOldAuditLogs(@Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * 统计总配额消耗（考虑权重）
     */
    @Query("SELECT SUM(a.quotaCost) FROM AIAuditLog a WHERE a.factoryId = :factoryId " +
           "AND a.createdAt >= :startDate AND a.consumedQuota = true")
    Long sumTotalQuotaCost(@Param("factoryId") String factoryId,
                          @Param("startDate") LocalDateTime startDate);
}
