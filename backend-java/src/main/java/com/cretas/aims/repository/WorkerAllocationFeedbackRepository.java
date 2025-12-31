package com.cretas.aims.repository;

import com.cretas.aims.entity.enums.ProcessingStageType;
import com.cretas.aims.entity.ml.WorkerAllocationFeedback;
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
 * 工人分配反馈记录仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Repository
public interface WorkerAllocationFeedbackRepository extends JpaRepository<WorkerAllocationFeedback, String> {

    /**
     * 根据工厂ID和任务ID查找反馈
     */
    List<WorkerAllocationFeedback> findByFactoryIdAndTaskId(String factoryId, String taskId);

    /**
     * 根据工厂ID和工人ID查找反馈
     */
    List<WorkerAllocationFeedback> findByFactoryIdAndWorkerId(String factoryId, Long workerId);

    /**
     * 查找未处理的反馈记录（用于模型更新）
     */
    @Query("SELECT f FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.isProcessed = false AND f.completedAt IS NOT NULL " +
           "ORDER BY f.completedAt ASC")
    List<WorkerAllocationFeedback> findUnprocessedFeedbacks(@Param("factoryId") String factoryId);

    /**
     * 查找指定时间范围内的反馈
     */
    @Query("SELECT f FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.completedAt BETWEEN :startTime AND :endTime")
    List<WorkerAllocationFeedback> findByFactoryIdAndCompletedAtBetween(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 分页查询工人的历史反馈
     */
    @Query("SELECT f FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.workerId = :workerId ORDER BY f.assignedAt DESC")
    Page<WorkerAllocationFeedback> findWorkerHistory(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            Pageable pageable);

    /**
     * 计算工人的平均效率
     */
    @Query("SELECT AVG(f.actualEfficiency) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.actualEfficiency IS NOT NULL")
    Double calculateAvgEfficiency(@Param("factoryId") String factoryId, @Param("workerId") Long workerId);

    /**
     * 计算工人的平均质量分
     */
    @Query("SELECT AVG(f.actualQuality) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.actualQuality IS NOT NULL")
    Double calculateAvgQuality(@Param("factoryId") String factoryId, @Param("workerId") Long workerId);

    /**
     * 统计工人完成的任务数
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.completedAt IS NOT NULL")
    long countCompletedTasks(@Param("factoryId") String factoryId, @Param("workerId") Long workerId);

    /**
     * 标记反馈为已处理
     */
    @Modifying
    @Query("UPDATE WorkerAllocationFeedback f SET f.isProcessed = true, f.processedAt = :processedAt " +
           "WHERE f.id IN :ids")
    int markAsProcessed(@Param("ids") List<String> ids, @Param("processedAt") LocalDateTime processedAt);

    /**
     * 查找超时未完成的分配（用于监控）
     */
    @Query("SELECT f FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.completedAt IS NULL AND f.assignedAt < :timeoutThreshold")
    List<WorkerAllocationFeedback> findOverdueFeedbacks(
            @Param("factoryId") String factoryId,
            @Param("timeoutThreshold") LocalDateTime timeoutThreshold);

    /**
     * 统计工厂的总反馈数
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计未处理的反馈数
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.isProcessed = false AND f.completedAt IS NOT NULL")
    long countUnprocessedFeedbacks(@Param("factoryId") String factoryId);

    // ==================== Phase 3: 工艺维度查询方法 ====================

    /**
     * 根据工厂ID和工艺类型查找反馈
     * 用于个人效率分解计算
     */
    @Query("SELECT f FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.stageType = :stageType AND f.completedAt IS NOT NULL")
    List<WorkerAllocationFeedback> findByFactoryIdAndStageType(
            @Param("factoryId") String factoryId,
            @Param("stageType") ProcessingStageType stageType);

    /**
     * 统计工厂指定工艺类型的反馈数
     * 用于判断是否有足够数据进行效率计算
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.stageType = :stageType AND f.completedAt IS NOT NULL")
    long countByFactoryIdAndStageType(
            @Param("factoryId") String factoryId,
            @Param("stageType") ProcessingStageType stageType);

    /**
     * 根据工艺类型查找所有工厂的反馈 (用于跨工厂分析)
     */
    List<WorkerAllocationFeedback> findByStageType(ProcessingStageType stageType);

    /**
     * 计算工人在特定工艺上的平均效率
     */
    @Query("SELECT AVG(f.actualEfficiency) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.stageType = :stageType AND f.actualEfficiency IS NOT NULL")
    Double calculateAvgEfficiencyByStage(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("stageType") ProcessingStageType stageType);
}
