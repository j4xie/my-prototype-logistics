package com.cretas.aims.service;

import com.cretas.aims.dto.voice.VoiceRecognitionRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionResponse;
import com.cretas.aims.entity.voice.BatchVoiceTask;
import com.cretas.aims.entity.voice.VoiceRecognitionConfig;
import com.cretas.aims.entity.voice.VoiceRecognitionHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 语音识别服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface VoiceRecognitionService {

    // ==================== 语音识别 ====================

    /**
     * 执行语音识别并保存历史记录
     */
    VoiceRecognitionResponse recognizeAndSaveHistory(
            String factoryId, Long userId, String username,
            VoiceRecognitionRequest request, String clientIp, String deviceInfo);

    // ==================== 历史记录管理 ====================

    /**
     * 分页查询历史记录
     */
    Page<VoiceRecognitionHistory> getHistory(String factoryId, Pageable pageable);

    /**
     * 按用户分页查询历史记录
     */
    Page<VoiceRecognitionHistory> getHistoryByUser(String factoryId, Long userId, Pageable pageable);

    /**
     * 按时间范围查询历史记录
     */
    Page<VoiceRecognitionHistory> getHistoryByTimeRange(
            String factoryId, LocalDateTime startTime, LocalDateTime endTime, Pageable pageable);

    /**
     * 按业务场景查询历史记录
     */
    Page<VoiceRecognitionHistory> getHistoryByBusinessScene(
            String factoryId, String businessScene, Pageable pageable);

    /**
     * 按关联业务ID查询历史记录
     */
    List<VoiceRecognitionHistory> getHistoryByRelatedBusinessId(String factoryId, String relatedBusinessId);

    /**
     * 获取识别统计数据
     */
    Map<String, Object> getRecognitionStats(String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 删除过期历史记录
     */
    void deleteExpiredHistory(String factoryId);

    // ==================== 配置管理 ====================

    /**
     * 获取工厂配置
     */
    Optional<VoiceRecognitionConfig> getConfig(String factoryId);

    /**
     * 获取或创建默认配置
     */
    VoiceRecognitionConfig getOrCreateConfig(String factoryId);

    /**
     * 更新配置
     */
    VoiceRecognitionConfig updateConfig(String factoryId, VoiceRecognitionConfig config, Long userId, String username);

    /**
     * 检查是否超出使用限制
     */
    boolean checkUsageLimit(String factoryId, Long userId);

    // ==================== 批量识别任务 ====================

    /**
     * 创建批量识别任务
     */
    BatchVoiceTask createBatchTask(
            String factoryId, Long userId, String username,
            List<String> audioDataList, VoiceRecognitionRequest templateRequest, String notes);

    /**
     * 获取批量任务详情
     */
    Optional<BatchVoiceTask> getBatchTask(String taskNumber);

    /**
     * 分页查询批量任务
     */
    Page<BatchVoiceTask> getBatchTasks(String factoryId, Pageable pageable);

    /**
     * 按状态查询批量任务
     */
    Page<BatchVoiceTask> getBatchTasksByStatus(String factoryId, String status, Pageable pageable);

    /**
     * 取消批量任务
     */
    BatchVoiceTask cancelBatchTask(String taskNumber, Long userId);

    /**
     * 获取批量任务结果
     */
    Map<String, Object> getBatchTaskResult(String taskNumber);

    /**
     * 处理待处理的批量任务 (由调度器调用)
     */
    void processPendingBatchTasks();
}
