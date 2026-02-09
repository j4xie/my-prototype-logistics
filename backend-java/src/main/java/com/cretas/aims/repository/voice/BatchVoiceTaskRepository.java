package com.cretas.aims.repository.voice;

import com.cretas.aims.entity.voice.BatchVoiceTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 批量语音识别任务仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface BatchVoiceTaskRepository extends JpaRepository<BatchVoiceTask, Long> {

    /**
     * 按任务编号查询
     */
    Optional<BatchVoiceTask> findByTaskNumber(String taskNumber);

    /**
     * 按工厂ID分页查询
     */
    Page<BatchVoiceTask> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 按工厂ID和状态分页查询
     */
    Page<BatchVoiceTask> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, String status, Pageable pageable);

    /**
     * 按用户ID分页查询
     */
    Page<BatchVoiceTask> findByFactoryIdAndUserIdOrderByCreatedAtDesc(
            String factoryId, Long userId, Pageable pageable);

    /**
     * 获取工厂当前处理中的任务数
     */
    @Query("SELECT COUNT(t) FROM BatchVoiceTask t WHERE t.factoryId = :factoryId " +
           "AND t.status IN ('PENDING', 'PROCESSING')")
    Long countPendingTasksByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 获取待处理的任务列表
     */
    @Query("SELECT t FROM BatchVoiceTask t WHERE t.status = 'PENDING' ORDER BY t.createdAt ASC")
    List<BatchVoiceTask> findPendingTasks();

    /**
     * 获取工厂的待处理任务
     */
    @Query("SELECT t FROM BatchVoiceTask t WHERE t.factoryId = :factoryId " +
           "AND t.status IN ('PENDING', 'PROCESSING') ORDER BY t.createdAt ASC")
    List<BatchVoiceTask> findPendingTasksByFactoryId(@Param("factoryId") String factoryId);
}
