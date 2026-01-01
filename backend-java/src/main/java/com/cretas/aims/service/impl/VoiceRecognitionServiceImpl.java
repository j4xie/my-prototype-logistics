package com.cretas.aims.service.impl;

import com.cretas.aims.dto.voice.VoiceRecognitionRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionResponse;
import com.cretas.aims.entity.voice.BatchVoiceTask;
import com.cretas.aims.entity.voice.VoiceRecognitionConfig;
import com.cretas.aims.entity.voice.VoiceRecognitionHistory;
import com.cretas.aims.repository.voice.BatchVoiceTaskRepository;
import com.cretas.aims.repository.voice.VoiceRecognitionConfigRepository;
import com.cretas.aims.repository.voice.VoiceRecognitionHistoryRepository;
import com.cretas.aims.service.IFlytekVoiceService;
import com.cretas.aims.service.OssService;
import com.cretas.aims.service.VoiceRecognitionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 语音识别服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoiceRecognitionServiceImpl implements VoiceRecognitionService {

    private final IFlytekVoiceService flytekVoiceService;
    private final VoiceRecognitionHistoryRepository historyRepository;
    private final VoiceRecognitionConfigRepository configRepository;
    private final BatchVoiceTaskRepository batchTaskRepository;
    private final ObjectMapper objectMapper;
    private final OssService ossService;

    // ==================== 语音识别 ====================

    @Override
    @Transactional
    public VoiceRecognitionResponse recognizeAndSaveHistory(
            String factoryId, Long userId, String username,
            VoiceRecognitionRequest request, String clientIp, String deviceInfo) {

        long startTime = System.currentTimeMillis();

        // 检查使用限制
        if (!checkUsageLimit(factoryId, userId)) {
            VoiceRecognitionResponse response = new VoiceRecognitionResponse();
            response.setCode(-1);
            response.setMessage("已超出今日使用限制");
            return response;
        }

        // 执行识别
        VoiceRecognitionResponse response = flytekVoiceService.recognize(request);
        long recognitionDuration = System.currentTimeMillis() - startTime;

        // 获取配置，检查是否需要保存历史
        VoiceRecognitionConfig config = getOrCreateConfig(factoryId);
        if (config.getSaveHistory() != null && config.getSaveHistory()) {
            // 如果配置了保存音频到 OSS，异步上传
            String audioOssPath = null;
            if (config.getSaveAudioToOss() != null && config.getSaveAudioToOss()
                    && request.getAudioData() != null && !request.getAudioData().isEmpty()) {
                try {
                    audioOssPath = ossService.uploadAudio(
                            request.getAudioData(),
                            request.getFormat() != null ? request.getFormat() : "raw",
                            factoryId,
                            response.getSid() != null ? response.getSid() : UUID.randomUUID().toString()
                    );
                    log.info("音频已保存到 OSS: {}", audioOssPath);
                } catch (Exception e) {
                    log.warn("保存音频到 OSS 失败，但不影响识别结果: {}", e.getMessage());
                }
            }

            // 保存历史记录
            VoiceRecognitionHistory history = VoiceRecognitionHistory.builder()
                    .factoryId(factoryId)
                    .userId(userId)
                    .username(username)
                    .sessionId(response.getSid())
                    .recognizedText(response.getText())
                    .statusCode(response.getCode())
                    .statusMessage(response.getMessage())
                    .audioOssPath(audioOssPath)
                    .audioFormat(request.getFormat())
                    .audioEncoding(request.getEncoding())
                    .sampleRate(request.getSampleRate())
                    .language(request.getLanguage())
                    .audioSizeBytes(request.getAudioData() != null ? (long) request.getAudioData().length() : 0L)
                    .recognitionDurationMs((int) recognitionDuration)
                    .businessScene("GENERAL")
                    .clientIp(clientIp)
                    .deviceInfo(deviceInfo)
                    .build();

            historyRepository.save(history);
            log.info("语音识别历史已保存: factoryId={}, userId={}, success={}",
                    factoryId, userId, response.getCode() == 0);
        }

        return response;
    }

    // ==================== 历史记录管理 ====================

    @Override
    public Page<VoiceRecognitionHistory> getHistory(String factoryId, Pageable pageable) {
        return historyRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
    }

    @Override
    public Page<VoiceRecognitionHistory> getHistoryByUser(String factoryId, Long userId, Pageable pageable) {
        return historyRepository.findByFactoryIdAndUserIdOrderByCreatedAtDesc(factoryId, userId, pageable);
    }

    @Override
    public Page<VoiceRecognitionHistory> getHistoryByTimeRange(
            String factoryId, LocalDateTime startTime, LocalDateTime endTime, Pageable pageable) {
        return historyRepository.findByFactoryIdAndTimeRange(factoryId, startTime, endTime, pageable);
    }

    @Override
    public Page<VoiceRecognitionHistory> getHistoryByBusinessScene(
            String factoryId, String businessScene, Pageable pageable) {
        return historyRepository.findByFactoryIdAndBusinessSceneOrderByCreatedAtDesc(
                factoryId, businessScene, pageable);
    }

    @Override
    public List<VoiceRecognitionHistory> getHistoryByRelatedBusinessId(String factoryId, String relatedBusinessId) {
        return historyRepository.findByFactoryIdAndRelatedBusinessIdOrderByCreatedAtDesc(
                factoryId, relatedBusinessId);
    }

    @Override
    public Map<String, Object> getRecognitionStats(String factoryId, LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> stats = new HashMap<>();

        List<Object[]> statsData = historyRepository.getSuccessRateStats(factoryId, startTime, endTime);
        if (!statsData.isEmpty() && statsData.get(0) != null) {
            Object[] row = statsData.get(0);
            Long totalCount = (Long) row[0];
            Long successCount = row[1] != null ? ((Number) row[1]).longValue() : 0L;

            stats.put("totalCount", totalCount);
            stats.put("successCount", successCount);
            stats.put("failureCount", totalCount - successCount);
            stats.put("successRate", totalCount > 0 ? (double) successCount / totalCount * 100 : 0.0);
        } else {
            stats.put("totalCount", 0L);
            stats.put("successCount", 0L);
            stats.put("failureCount", 0L);
            stats.put("successRate", 0.0);
        }

        // 今日统计
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        stats.put("todayCount", historyRepository.countTodayByFactoryId(factoryId, todayStart));

        return stats;
    }

    @Override
    @Transactional
    public void deleteExpiredHistory(String factoryId) {
        VoiceRecognitionConfig config = getOrCreateConfig(factoryId);
        int retentionDays = config.getHistoryRetentionDays() != null ? config.getHistoryRetentionDays() : 90;
        LocalDateTime expireTime = LocalDateTime.now().minusDays(retentionDays);
        historyRepository.deleteExpiredRecords(factoryId, expireTime);
        log.info("已删除 {} 工厂 {} 天前的历史记录", factoryId, retentionDays);
    }

    // ==================== 配置管理 ====================

    @Override
    public Optional<VoiceRecognitionConfig> getConfig(String factoryId) {
        return configRepository.findByFactoryId(factoryId);
    }

    @Override
    @Transactional
    public VoiceRecognitionConfig getOrCreateConfig(String factoryId) {
        return configRepository.findByFactoryId(factoryId)
                .orElseGet(() -> {
                    VoiceRecognitionConfig newConfig = VoiceRecognitionConfig.builder()
                            .factoryId(factoryId)
                            .enabled(true)
                            .defaultLanguage("zh_cn")
                            .defaultSampleRate(16000)
                            .defaultFormat("raw")
                            .defaultEncoding("raw")
                            .maxAudioDuration(60)
                            .saveAudioToOss(false)
                            .saveHistory(true)
                            .historyRetentionDays(90)
                            .dailyLimit(0)
                            .userDailyLimit(0)
                            .batchMaxConcurrent(5)
                            .batchMaxFiles(50)
                            .build();
                    return configRepository.save(newConfig);
                });
    }

    @Override
    @Transactional
    public VoiceRecognitionConfig updateConfig(
            String factoryId, VoiceRecognitionConfig config, Long userId, String username) {
        VoiceRecognitionConfig existing = getOrCreateConfig(factoryId);

        // 更新可配置的字段
        if (config.getEnabled() != null) existing.setEnabled(config.getEnabled());
        if (config.getDefaultLanguage() != null) existing.setDefaultLanguage(config.getDefaultLanguage());
        if (config.getDefaultSampleRate() != null) existing.setDefaultSampleRate(config.getDefaultSampleRate());
        if (config.getDefaultFormat() != null) existing.setDefaultFormat(config.getDefaultFormat());
        if (config.getDefaultEncoding() != null) existing.setDefaultEncoding(config.getDefaultEncoding());
        if (config.getMaxAudioDuration() != null) existing.setMaxAudioDuration(config.getMaxAudioDuration());
        if (config.getSaveAudioToOss() != null) existing.setSaveAudioToOss(config.getSaveAudioToOss());
        if (config.getSaveHistory() != null) existing.setSaveHistory(config.getSaveHistory());
        if (config.getHistoryRetentionDays() != null) existing.setHistoryRetentionDays(config.getHistoryRetentionDays());
        if (config.getDailyLimit() != null) existing.setDailyLimit(config.getDailyLimit());
        if (config.getUserDailyLimit() != null) existing.setUserDailyLimit(config.getUserDailyLimit());
        if (config.getBatchMaxConcurrent() != null) existing.setBatchMaxConcurrent(config.getBatchMaxConcurrent());
        if (config.getBatchMaxFiles() != null) existing.setBatchMaxFiles(config.getBatchMaxFiles());
        if (config.getNotes() != null) existing.setNotes(config.getNotes());

        existing.setLastModifiedBy(userId);
        existing.setLastModifiedByName(username);

        log.info("更新语音识别配置: factoryId={}, userId={}", factoryId, userId);
        return configRepository.save(existing);
    }

    @Override
    public boolean checkUsageLimit(String factoryId, Long userId) {
        VoiceRecognitionConfig config = getOrCreateConfig(factoryId);

        // 检查是否启用
        if (config.getEnabled() != null && !config.getEnabled()) {
            return false;
        }

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();

        // 检查工厂每日限制
        if (config.getDailyLimit() != null && config.getDailyLimit() > 0) {
            Long todayCount = historyRepository.countTodayByFactoryId(factoryId, todayStart);
            if (todayCount >= config.getDailyLimit()) {
                log.warn("工厂 {} 今日识别次数已达上限: {}", factoryId, config.getDailyLimit());
                return false;
            }
        }

        // 检查用户每日限制
        if (config.getUserDailyLimit() != null && config.getUserDailyLimit() > 0 && userId != null) {
            Long userTodayCount = historyRepository.countTodayByUserIdAndFactoryId(factoryId, userId, todayStart);
            if (userTodayCount >= config.getUserDailyLimit()) {
                log.warn("用户 {} 今日识别次数已达上限: {}", userId, config.getUserDailyLimit());
                return false;
            }
        }

        return true;
    }

    // ==================== 批量识别任务 ====================

    @Override
    @Transactional
    public BatchVoiceTask createBatchTask(
            String factoryId, Long userId, String username,
            List<String> audioDataList, VoiceRecognitionRequest templateRequest, String notes) {

        // 检查配置
        VoiceRecognitionConfig config = getOrCreateConfig(factoryId);
        if (config.getBatchMaxFiles() != null && audioDataList.size() > config.getBatchMaxFiles()) {
            throw new IllegalArgumentException("超出单次最大文件数限制: " + config.getBatchMaxFiles());
        }

        // 检查当前处理中的任务数
        Long pendingCount = batchTaskRepository.countPendingTasksByFactoryId(factoryId);
        if (config.getBatchMaxConcurrent() != null && pendingCount >= config.getBatchMaxConcurrent()) {
            throw new IllegalStateException("当前处理中的任务数已达上限: " + config.getBatchMaxConcurrent());
        }

        // 生成任务编号
        String taskNumber = generateTaskNumber(factoryId);

        // 创建任务
        BatchVoiceTask task = BatchVoiceTask.builder()
                .taskNumber(taskNumber)
                .factoryId(factoryId)
                .userId(userId)
                .username(username)
                .status("PENDING")
                .totalFiles(audioDataList.size())
                .processedFiles(0)
                .successCount(0)
                .failureCount(0)
                .progress(0)
                .audioFormat(templateRequest.getFormat())
                .audioEncoding(templateRequest.getEncoding())
                .sampleRate(templateRequest.getSampleRate())
                .language(templateRequest.getLanguage())
                .businessScene("BATCH_PROCESS")
                .notes(notes)
                .build();

        // 保存任务
        task = batchTaskRepository.save(task);

        // 保存音频数据到结果JSON中(临时存储)
        try {
            Map<String, Object> initialData = new HashMap<>();
            initialData.put("audioDataList", audioDataList);
            initialData.put("results", new ArrayList<>());
            task.setResultJson(objectMapper.writeValueAsString(initialData));
            task = batchTaskRepository.save(task);
        } catch (Exception e) {
            log.error("保存批量任务数据失败", e);
        }

        log.info("创建批量识别任务: taskNumber={}, factoryId={}, totalFiles={}",
                taskNumber, factoryId, audioDataList.size());

        return task;
    }

    @Override
    public Optional<BatchVoiceTask> getBatchTask(String taskNumber) {
        return batchTaskRepository.findByTaskNumber(taskNumber);
    }

    @Override
    public Page<BatchVoiceTask> getBatchTasks(String factoryId, Pageable pageable) {
        return batchTaskRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
    }

    @Override
    public Page<BatchVoiceTask> getBatchTasksByStatus(String factoryId, String status, Pageable pageable) {
        return batchTaskRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageable);
    }

    @Override
    @Transactional
    public BatchVoiceTask cancelBatchTask(String taskNumber, Long userId) {
        BatchVoiceTask task = batchTaskRepository.findByTaskNumber(taskNumber)
                .orElseThrow(() -> new IllegalArgumentException("任务不存在: " + taskNumber));

        if (!"PENDING".equals(task.getStatus()) && !"PROCESSING".equals(task.getStatus())) {
            throw new IllegalStateException("只能取消待处理或处理中的任务");
        }

        task.setStatus("CANCELLED");
        task.setCompletedAt(LocalDateTime.now());
        log.info("取消批量识别任务: taskNumber={}, userId={}", taskNumber, userId);

        return batchTaskRepository.save(task);
    }

    @Override
    public Map<String, Object> getBatchTaskResult(String taskNumber) {
        BatchVoiceTask task = batchTaskRepository.findByTaskNumber(taskNumber)
                .orElseThrow(() -> new IllegalArgumentException("任务不存在: " + taskNumber));

        Map<String, Object> result = new HashMap<>();
        result.put("taskNumber", task.getTaskNumber());
        result.put("status", task.getStatus());
        result.put("progress", task.getProgress());
        result.put("totalFiles", task.getTotalFiles());
        result.put("processedFiles", task.getProcessedFiles());
        result.put("successCount", task.getSuccessCount());
        result.put("failureCount", task.getFailureCount());
        result.put("startedAt", task.getStartedAt());
        result.put("completedAt", task.getCompletedAt());
        result.put("totalDurationMs", task.getTotalDurationMs());
        result.put("errorMessage", task.getErrorMessage());

        // 解析结果JSON
        if (task.getResultJson() != null && !"PENDING".equals(task.getStatus())) {
            try {
                Map<String, Object> resultData = objectMapper.readValue(
                        task.getResultJson(), Map.class);
                result.put("results", resultData.get("results"));
            } catch (Exception e) {
                log.error("解析任务结果失败", e);
            }
        }

        return result;
    }

    @Override
    @Async
    @Transactional
    public void processPendingBatchTasks() {
        List<BatchVoiceTask> pendingTasks = batchTaskRepository.findPendingTasks();
        for (BatchVoiceTask task : pendingTasks) {
            try {
                processSingleBatchTask(task);
            } catch (Exception e) {
                log.error("处理批量任务失败: taskNumber={}", task.getTaskNumber(), e);
                task.setStatus("FAILED");
                task.setErrorMessage(e.getMessage());
                task.setCompletedAt(LocalDateTime.now());
                batchTaskRepository.save(task);
            }
        }
    }

    // ==================== 私有方法 ====================

    private String generateTaskNumber(String factoryId) {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String random = String.format("%04d", new Random().nextInt(10000));
        return "VT-" + factoryId + "-" + dateStr + "-" + random;
    }

    @SuppressWarnings("unchecked")
    private void processSingleBatchTask(BatchVoiceTask task) {
        task.setStatus("PROCESSING");
        task.setStartedAt(LocalDateTime.now());
        batchTaskRepository.save(task);

        try {
            // 解析任务数据
            Map<String, Object> taskData = objectMapper.readValue(task.getResultJson(), Map.class);
            List<String> audioDataList = (List<String>) taskData.get("audioDataList");
            List<Map<String, Object>> results = new ArrayList<>();

            int successCount = 0;
            int failureCount = 0;

            for (int i = 0; i < audioDataList.size(); i++) {
                String audioData = audioDataList.get(i);

                // 构建请求
                VoiceRecognitionRequest request = new VoiceRecognitionRequest();
                request.setAudioData(audioData);
                request.setFormat(task.getAudioFormat());
                request.setEncoding(task.getAudioEncoding());
                request.setSampleRate(task.getSampleRate());
                request.setLanguage(task.getLanguage());

                // 执行识别
                VoiceRecognitionResponse response = flytekVoiceService.recognize(request);

                // 记录结果
                Map<String, Object> resultItem = new HashMap<>();
                resultItem.put("index", i);
                resultItem.put("code", response.getCode());
                resultItem.put("message", response.getMessage());
                resultItem.put("text", response.getText());
                resultItem.put("sid", response.getSid());
                results.add(resultItem);

                if (response.getCode() == 0) {
                    successCount++;
                } else {
                    failureCount++;
                }

                // 更新进度
                task.setProcessedFiles(i + 1);
                task.setSuccessCount(successCount);
                task.setFailureCount(failureCount);
                task.setProgress((int) ((i + 1) * 100.0 / audioDataList.size()));

                // 更新结果
                taskData.put("results", results);
                task.setResultJson(objectMapper.writeValueAsString(taskData));
                batchTaskRepository.save(task);

                // 检查是否被取消
                Optional<BatchVoiceTask> latestTask = batchTaskRepository.findByTaskNumber(task.getTaskNumber());
                if (latestTask.isPresent() && "CANCELLED".equals(latestTask.get().getStatus())) {
                    log.info("批量任务已取消: taskNumber={}", task.getTaskNumber());
                    return;
                }
            }

            // 完成任务
            task.setStatus("COMPLETED");
            task.setCompletedAt(LocalDateTime.now());
            task.setTotalDurationMs(
                    java.time.Duration.between(task.getStartedAt(), task.getCompletedAt()).toMillis());

            // 清除原始音频数据，只保留结果
            taskData.remove("audioDataList");
            task.setResultJson(objectMapper.writeValueAsString(taskData));

            batchTaskRepository.save(task);
            log.info("批量识别任务完成: taskNumber={}, success={}, failure={}",
                    task.getTaskNumber(), successCount, failureCount);

        } catch (Exception e) {
            log.error("处理批量任务异常: taskNumber={}", task.getTaskNumber(), e);
            task.setStatus("FAILED");
            task.setErrorMessage(e.getMessage());
            task.setCompletedAt(LocalDateTime.now());
            batchTaskRepository.save(task);
        }
    }
}
