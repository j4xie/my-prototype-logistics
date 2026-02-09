package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.LearningTask;
import com.cretas.aims.entity.learning.LearningTask.TaskStatus;
import com.cretas.aims.entity.learning.LearningTask.TaskType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for LearningTask entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface LearningTaskRepository extends JpaRepository<LearningTask, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by task type and status
     */
    List<LearningTask> findByTaskTypeAndStatus(TaskType taskType, TaskStatus status);

    /**
     * Find by factory ID
     */
    List<LearningTask> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * Find pending tasks ready to execute
     */
    @Query("SELECT t FROM LearningTask t " +
           "WHERE t.status = 'PENDING' " +
           "AND (t.scheduledAt IS NULL OR t.scheduledAt <= :now) " +
           "ORDER BY t.priority DESC, t.scheduledAt ASC")
    List<LearningTask> findReadyToExecute(@Param("now") LocalDateTime now);

    /**
     * Find running tasks that may be timed out
     */
    @Query("SELECT t FROM LearningTask t " +
           "WHERE t.status = 'RUNNING' " +
           "AND t.startedAt < :timeout")
    List<LearningTask> findTimedOutTasks(@Param("timeout") LocalDateTime timeout);

    // ==================== Status Queries ====================

    /**
     * Find by status with pagination
     */
    Page<LearningTask> findByStatusOrderByPriorityDescScheduledAtAsc(
            TaskStatus status, Pageable pageable);

    /**
     * Find failed tasks for retry
     */
    @Query("SELECT t FROM LearningTask t " +
           "WHERE t.status = 'FAILED' " +
           "AND t.retryCount < t.maxRetries " +
           "ORDER BY t.priority DESC")
    List<LearningTask> findFailedTasksForRetry();

    /**
     * Count by status
     */
    long countByStatus(TaskStatus status);

    /**
     * Count by task type and status
     */
    long countByTaskTypeAndStatus(TaskType taskType, TaskStatus status);

    // ==================== Factory Specific ====================

    /**
     * Find latest task of type for factory
     */
    Optional<LearningTask> findFirstByFactoryIdAndTaskTypeOrderByCreatedAtDesc(
            String factoryId, TaskType taskType);

    /**
     * Check if task is running for factory
     */
    boolean existsByFactoryIdAndTaskTypeAndStatus(
            String factoryId, TaskType taskType, TaskStatus status);

    /**
     * Find tasks for factory by status
     */
    List<LearningTask> findByFactoryIdAndStatusOrderByPriorityDesc(
            String factoryId, TaskStatus status);

    // ==================== Updates ====================

    /**
     * Update status
     */
    @Modifying
    @Query("UPDATE LearningTask t " +
           "SET t.status = :status, " +
           "    t.startedAt = :startedAt " +
           "WHERE t.id = :id")
    int updateStatusStarted(
            @Param("id") Long id,
            @Param("status") TaskStatus status,
            @Param("startedAt") LocalDateTime startedAt);

    /**
     * Update progress
     */
    @Modifying
    @Query("UPDATE LearningTask t " +
           "SET t.progressPercent = :percent, " +
           "    t.progressMessage = :message " +
           "WHERE t.id = :id")
    int updateProgress(
            @Param("id") Long id,
            @Param("percent") int percent,
            @Param("message") String message);

    /**
     * Complete task
     */
    @Modifying
    @Query("UPDATE LearningTask t " +
           "SET t.status = 'COMPLETED', " +
           "    t.completedAt = :completedAt, " +
           "    t.result = :result, " +
           "    t.progressPercent = 100 " +
           "WHERE t.id = :id")
    int completeTask(
            @Param("id") Long id,
            @Param("completedAt") LocalDateTime completedAt,
            @Param("result") String result);

    /**
     * Fail task
     */
    @Modifying
    @Query("UPDATE LearningTask t " +
           "SET t.status = 'FAILED', " +
           "    t.completedAt = :completedAt, " +
           "    t.errorMessage = :error " +
           "WHERE t.id = :id")
    int failTask(
            @Param("id") Long id,
            @Param("completedAt") LocalDateTime completedAt,
            @Param("error") String error);

    /**
     * Retry task
     */
    @Modifying
    @Query("UPDATE LearningTask t " +
           "SET t.status = 'PENDING', " +
           "    t.retryCount = t.retryCount + 1, " +
           "    t.startedAt = NULL, " +
           "    t.completedAt = NULL " +
           "WHERE t.id = :id")
    int retryTask(@Param("id") Long id);

    // ==================== Cleanup ====================

    /**
     * Delete old completed tasks
     */
    @Modifying
    @Query("DELETE FROM LearningTask t " +
           "WHERE t.status IN ('COMPLETED', 'CANCELLED') " +
           "AND t.completedAt < :cutoffDate")
    int deleteOldCompletedTasks(@Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * Cancel pending tasks for factory
     */
    @Modifying
    @Query("UPDATE LearningTask t " +
           "SET t.status = 'CANCELLED', " +
           "    t.completedAt = :now " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.status = 'PENDING'")
    int cancelPendingTasks(
            @Param("factoryId") String factoryId,
            @Param("now") LocalDateTime now);
}
