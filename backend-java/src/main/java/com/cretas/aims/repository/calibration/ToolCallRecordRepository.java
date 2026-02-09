package com.cretas.aims.repository.calibration;

import com.cretas.aims.entity.calibration.ToolCallRecord;
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
 * 工具调用记录仓库接口
 */
@Repository
public interface ToolCallRecordRepository extends JpaRepository<ToolCallRecord, Long> {

    /**
     * 根据会话ID查询调用记录
     */
    List<ToolCallRecord> findBySessionIdOrderByCreatedAtDesc(String sessionId);

    /**
     * 根据工厂ID和时间范围查询
     */
    List<ToolCallRecord> findByFactoryIdAndCreatedAtBetween(
        String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 根据时间范围查询（全平台）
     */
    List<ToolCallRecord> findByCreatedAtBetween(LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 根据会话ID、工具名和参数哈希查询（用于冗余检测）
     */
    Optional<ToolCallRecord> findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
        String sessionId, String toolName, String parametersHash, LocalDateTime cutoffTime);

    /**
     * 根据工具名查询（分页）
     */
    Page<ToolCallRecord> findByToolName(String toolName, Pageable pageable);

    /**
     * 查询冗余调用
     */
    Page<ToolCallRecord> findByIsRedundantTrue(Pageable pageable);

    /**
     * 按工厂ID查询冗余调用
     */
    Page<ToolCallRecord> findByFactoryIdAndIsRedundantTrue(String factoryId, Pageable pageable);

    /**
     * 统计时间范围内的总调用数
     */
    @Query("SELECT COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.createdAt BETWEEN :startTime AND :endTime")
    Long countByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 统计成功调用数
     */
    @Query("SELECT COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.executionStatus = 'SUCCESS' AND t.createdAt BETWEEN :startTime AND :endTime")
    Long countSuccessfulByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 统计冗余调用数
     */
    @Query("SELECT COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.isRedundant = true AND t.createdAt BETWEEN :startTime AND :endTime")
    Long countRedundantByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 统计恢复的调用数
     */
    @Query("SELECT COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.recovered = true AND t.createdAt BETWEEN :startTime AND :endTime")
    Long countRecoveredByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 统计失败的调用数
     */
    @Query("SELECT COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.executionStatus = 'FAILED' AND t.createdAt BETWEEN :startTime AND :endTime")
    Long countFailedByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 计算平均执行时间
     */
    @Query("SELECT AVG(t.executionTimeMs) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.createdAt BETWEEN :startTime AND :endTime AND t.executionTimeMs IS NOT NULL")
    Double avgExecutionTimeByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 按工具名分组统计调用次数
     */
    @Query("SELECT t.toolName, COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.createdAt BETWEEN :startTime AND :endTime GROUP BY t.toolName ORDER BY COUNT(t) DESC")
    List<Object[]> countByToolNameAndFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 按执行状态分组统计
     */
    @Query("SELECT t.executionStatus, COUNT(t) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.createdAt BETWEEN :startTime AND :endTime GROUP BY t.executionStatus")
    List<Object[]> countByStatusAndFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 计算总输入token
     */
    @Query("SELECT COALESCE(SUM(t.inputTokens), 0) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.createdAt BETWEEN :startTime AND :endTime")
    Long sumInputTokensByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 计算总输出token
     */
    @Query("SELECT COALESCE(SUM(t.outputTokens), 0) FROM ToolCallRecord t WHERE t.factoryId = :factoryId AND t.createdAt BETWEEN :startTime AND :endTime")
    Long sumOutputTokensByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 查询最近的调用记录
     */
    List<ToolCallRecord> findTop20ByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * 按工厂分页查询
     */
    Page<ToolCallRecord> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 全平台分页查询
     */
    Page<ToolCallRecord> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
