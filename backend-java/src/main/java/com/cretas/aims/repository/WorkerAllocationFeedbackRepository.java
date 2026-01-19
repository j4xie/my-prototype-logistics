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

    // ==================== 策略干预查询方法 ====================

    /**
     * 计算工人指定日期后的实际工时总和
     */
    @Query("SELECT SUM(f.actualHours) FROM WorkerAllocationFeedback f " +
           "WHERE f.workerId = :workerId AND f.factoryId = :factoryId " +
           "AND f.assignedAt >= :startTime AND f.completedAt IS NOT NULL")
    Double sumActualHoursByWorkerAndDate(
            @Param("workerId") Long workerId,
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime);

    /**
     * 查找工人指定日期后的工作日期列表 (去重)
     */
    @Query("SELECT DISTINCT CAST(f.assignedAt AS LocalDate) FROM WorkerAllocationFeedback f " +
           "WHERE f.workerId = :workerId AND f.factoryId = :factoryId " +
           "AND f.assignedAt >= :startTime AND f.completedAt IS NOT NULL " +
           "ORDER BY CAST(f.assignedAt AS LocalDate) DESC")
    List<java.time.LocalDate> findDistinctWorkDatesByWorker(
            @Param("workerId") Long workerId,
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime);

    /**
     * 统计工人指定工序类型在指定日期后的执行次数
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f " +
           "WHERE f.workerId = :workerId AND f.factoryId = :factoryId " +
           "AND f.taskType = :processType AND f.assignedAt >= :startTime")
    Integer countByWorkerAndProcessType(
            @Param("workerId") Long workerId,
            @Param("factoryId") String factoryId,
            @Param("processType") String processType,
            @Param("startTime") LocalDateTime startTime);

    /**
     * 统计工人指定日期后的任务数
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f " +
           "WHERE f.workerId = :workerId AND f.factoryId = :factoryId " +
           "AND f.assignedAt >= :startTime")
    Integer countByWorkerAndDateAfter(
            @Param("workerId") Long workerId,
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime);

    // ==================== 指标计算查询方法 ====================

    /**
     * 每日指标聚合
     * 返回: [日期, 任务数, 平均效率, 平均预测误差率, 不同工人数, 不同任务类型数]
     */
    @Query("SELECT DATE(f.assignedAt), COUNT(f), AVG(f.actualEfficiency), " +
           "AVG(ABS(f.predictedScore - f.actualEfficiency) / NULLIF(f.predictedScore, 0)), " +
           "COUNT(DISTINCT f.workerId), COUNT(DISTINCT f.taskType) " +
           "FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.assignedAt >= :startDate GROUP BY DATE(f.assignedAt) ORDER BY DATE(f.assignedAt)")
    List<Object[]> getDailyMetrics(@Param("factoryId") String factoryId, @Param("startDate") LocalDateTime startDate);

    /**
     * 整体指标汇总
     * 返回: [总任务数, 平均效率, 不同工人数, 已完成任务数]
     */
    @Query("SELECT COUNT(f), AVG(f.actualEfficiency), COUNT(DISTINCT f.workerId), " +
           "SUM(CASE WHEN f.completedAt IS NOT NULL THEN 1 ELSE 0 END) " +
           "FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.assignedAt >= :startDate")
    Object[] getOverallMetrics(@Param("factoryId") String factoryId, @Param("startDate") LocalDateTime startDate);

    /**
     * 按工艺阶段类型统计预测准确率
     * 返回: [工艺类型, 准确率, 样本数]
     */
    @Query("SELECT f.stageType, AVG(1.0 - ABS(f.predictedScore - f.actualEfficiency) / NULLIF(f.predictedScore, 0)), COUNT(f) " +
           "FROM WorkerAllocationFeedback f WHERE f.factoryId = :factoryId " +
           "AND f.actualEfficiency IS NOT NULL AND f.predictedScore IS NOT NULL " +
           "AND f.assignedAt >= :startDate GROUP BY f.stageType")
    List<Object[]> getPredictionAccuracyByStageType(@Param("factoryId") String factoryId, @Param("startDate") LocalDateTime startDate);

    /**
     * 统计工人执行的不同任务类型数量
     */
    @Query("SELECT COUNT(DISTINCT f.taskType) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.assignedAt >= :startDate")
    Integer countDistinctTaskTypesByWorker(@Param("factoryId") String factoryId,
                                           @Param("workerId") Long workerId,
                                           @Param("startDate") LocalDateTime startDate);

    /**
     * 获取工厂内所有不同的工人ID
     */
    @Query("SELECT DISTINCT f.workerId FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.assignedAt >= :startDate")
    List<Long> findDistinctWorkerIds(@Param("factoryId") String factoryId, @Param("startDate") LocalDateTime startDate);

    /**
     * 获取工人最近一次执行指定任务类型的时间
     */
    @Query("SELECT MAX(f.assignedAt) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId AND f.taskType = :taskType")
    LocalDateTime findLastTaskDateByWorkerAndType(@Param("factoryId") String factoryId,
                                                   @Param("workerId") Long workerId,
                                                   @Param("taskType") String taskType);

    // ==================== 公平性与技能维护查询方法 ====================

    /**
     * 统计工厂指定时间段内所有工人的分配数
     * 返回每个工人的分配数量 [workerId, count]
     */
    @Query("SELECT f.workerId, COUNT(f) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.assignedAt >= :startTime " +
           "GROUP BY f.workerId")
    List<Object[]> countAllocationsByWorkerInPeriod(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime);

    /**
     * 获取工厂所有有分配记录的工人ID列表（不限时间）
     */
    @Query("SELECT DISTINCT f.workerId FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId")
    List<Long> findAllDistinctWorkerIdsByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 查找在指定时间段内执行过特定工序的工人
     */
    @Query("SELECT DISTINCT f.workerId FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.taskType = :taskType " +
           "AND f.assignedAt >= :startTime")
    List<Long> findWorkersWhoDidTaskTypeInPeriod(
            @Param("factoryId") String factoryId,
            @Param("taskType") String taskType,
            @Param("startTime") LocalDateTime startTime);

    /**
     * 检查工人是否在指定时间段内执行过特定工序
     */
    @Query("SELECT CASE WHEN COUNT(f) > 0 THEN true ELSE false END FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.taskType = :taskType AND f.assignedAt >= :startTime")
    boolean existsByWorkerAndTaskTypeInPeriod(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("taskType") String taskType,
            @Param("startTime") LocalDateTime startTime);

    // ==================== 临时工管理查询方法 ====================

    /**
     * 统计工人在指定时间之后的分配次数
     * 用于临时工最低分配数保证检查
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.workerId = :workerId " +
           "AND f.createdAt > :since")
    long countByFactoryIdAndWorkerIdAndCreatedAtAfter(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("since") LocalDateTime since);

    /**
     * 统计工厂在指定时间之后的总分配次数
     * 用于自适应学习的样本数统计
     */
    @Query("SELECT COUNT(f) FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.createdAt > :since")
    long countByFactoryIdAndCreatedAtAfter(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);

    // ==================== Fair-MAB 公平性调度查询方法 ====================

    /**
     * 查找指定时间段内活跃的工人ID列表 (用于Fair-MAB公平性计算)
     * 基于createdAt字段筛选，返回有分配记录的工人
     */
    @Query("SELECT DISTINCT f.workerId FROM WorkerAllocationFeedback f " +
           "WHERE f.factoryId = :factoryId AND f.createdAt > :since")
    List<Long> findDistinctWorkerIdsByFactoryIdAndCreatedAtAfter(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);
}
