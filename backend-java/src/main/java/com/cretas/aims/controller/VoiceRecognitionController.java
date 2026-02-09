package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.voice.BatchVoiceTaskRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionConfigDTO;
import com.cretas.aims.dto.voice.VoiceRecognitionRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionResponse;
import com.cretas.aims.entity.voice.BatchVoiceTask;
import com.cretas.aims.entity.voice.VoiceRecognitionConfig;
import com.cretas.aims.entity.voice.VoiceRecognitionHistory;
import com.cretas.aims.service.IFlytekVoiceService;
import com.cretas.aims.service.VoiceRecognitionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import com.cretas.aims.util.ErrorSanitizer;

/**
 * 语音识别控制器
 * 提供讯飞语音识别代理 API，包括历史记录、配置管理、批量识别
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-12-28
 * @updated 2025-12-31 - 添加历史记录、配置管理、批量识别功能
 */
@Tag(name = "语音识别", description = "讯飞语音识别代理 API，支持实时识别、历史记录、配置管理、批量识别")
@RestController
@RequestMapping("/api/mobile")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class VoiceRecognitionController {

    private final IFlytekVoiceService voiceService;
    private final VoiceRecognitionService voiceRecognitionService;

    // ==================== 基础语音识别 ====================

    /**
     * 语音识别
     *
     * POST /api/mobile/voice/recognize
     */
    @Operation(summary = "语音识别", description = "将音频数据转换为文本，支持多种音频格式和采样率")
    @PostMapping("/voice/recognize")
    public ResponseEntity<ApiResponse<VoiceRecognitionResponse>> recognize(
            @Valid @RequestBody VoiceRecognitionRequest request) {

        log.info("收到语音识别请求: format={}, encoding={}, sampleRate={}, audioLength={}",
            request.getFormat(),
            request.getEncoding(),
            request.getSampleRate(),
            request.getAudioData() != null ? request.getAudioData().length() : 0);

        try {
            VoiceRecognitionResponse response = voiceService.recognize(request);

            if (response.getCode() == 0) {
                log.info("语音识别成功: text={}", response.getText());
                return ResponseEntity.ok(ApiResponse.success(response));
            } else {
                log.warn("语音识别失败: code={}, message={}",
                    response.getCode(), response.getMessage());
                return ResponseEntity.ok(ApiResponse.error(response.getMessage()));
            }

        } catch (Exception e) {
            log.error("语音识别异常", e);
            return ResponseEntity.ok(ApiResponse.error("语音识别服务异常: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 语音识别(带历史记录保存)
     *
     * POST /api/mobile/{factoryId}/voice/recognize
     */
    @Operation(summary = "语音识别(带历史)", description = "语音识别并自动保存识别历史记录，记录用户、设备、IP等信息")
    @PostMapping("/{factoryId}/voice/recognize")
    public ResponseEntity<ApiResponse<VoiceRecognitionResponse>> recognizeWithHistory(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "用户ID", example = "1") @RequestParam(required = false) Long userId,
            @Parameter(description = "用户名", example = "admin") @RequestParam(required = false) String username,
            @Valid @RequestBody VoiceRecognitionRequest request,
            HttpServletRequest httpRequest) {

        log.info("收到语音识别请求(带历史): factoryId={}, format={}, audioLength={}",
            factoryId, request.getFormat(),
            request.getAudioData() != null ? request.getAudioData().length() : 0);

        try {
            String clientIp = getClientIp(httpRequest);
            String deviceInfo = httpRequest.getHeader("User-Agent");

            VoiceRecognitionResponse response = voiceRecognitionService.recognizeAndSaveHistory(
                    factoryId, userId, username, request, clientIp, deviceInfo);

            if (response.getCode() == 0) {
                return ResponseEntity.ok(ApiResponse.success(response));
            } else {
                return ResponseEntity.ok(ApiResponse.error(response.getMessage()));
            }

        } catch (Exception e) {
            log.error("语音识别异常", e);
            return ResponseEntity.ok(ApiResponse.error("语音识别服务异常: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 检查语音服务状态
     *
     * GET /api/mobile/voice/health
     */
    @Operation(summary = "检查语音服务状态", description = "检查讯飞语音识别服务的可用性和版本信息")
    @GetMapping("/voice/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("available", voiceService.isAvailable());
        status.put("version", voiceService.getVersion());
        status.put("provider", "iFlytek");

        return ResponseEntity.ok(ApiResponse.success(status));
    }

    /**
     * 获取支持的音频格式
     *
     * GET /api/mobile/voice/formats
     */
    @Operation(summary = "获取支持的音频格式", description = "返回支持的采样率、音频格式、编码方式、语言等信息")
    @GetMapping("/voice/formats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSupportedFormats() {
        Map<String, Object> formats = new HashMap<>();

        formats.put("sampleRates", new int[]{16000, 8000});
        formats.put("formats", new String[]{"raw", "mp3", "speex", "speex-wb"});
        formats.put("encodings", new String[]{"raw", "lame", "speex", "speex-wb"});
        formats.put("languages", new String[]{"zh_cn", "en_us"});
        formats.put("maxDuration", 60);

        return ResponseEntity.ok(ApiResponse.success(formats));
    }

    // ==================== 历史记录管理 ====================

    /**
     * 获取语音识别历史记录
     *
     * GET /api/mobile/{factoryId}/voice/history
     */
    @Operation(summary = "获取语音识别历史记录", description = "分页查询语音识别历史，支持按用户、业务场景、时间范围筛选")
    @GetMapping("/{factoryId}/voice/history")
    public ResponseEntity<ApiResponse<Page<VoiceRecognitionHistory>>> getHistory(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "页码，从0开始", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量", example = "20") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "用户ID", example = "1") @RequestParam(required = false) Long userId,
            @Parameter(description = "业务场景: QUALITY_INSPECTION/MATERIAL_RECEIPT等", example = "QUALITY_INSPECTION") @RequestParam(required = false) String businessScene,
            @Parameter(description = "开始时间", example = "2025-01-01T00:00:00") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @Parameter(description = "结束时间", example = "2025-01-31T23:59:59") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {

        Pageable pageable = PageRequest.of(page, size);
        Page<VoiceRecognitionHistory> history;

        if (userId != null) {
            history = voiceRecognitionService.getHistoryByUser(factoryId, userId, pageable);
        } else if (businessScene != null) {
            history = voiceRecognitionService.getHistoryByBusinessScene(factoryId, businessScene, pageable);
        } else if (startTime != null && endTime != null) {
            history = voiceRecognitionService.getHistoryByTimeRange(factoryId, startTime, endTime, pageable);
        } else {
            history = voiceRecognitionService.getHistory(factoryId, pageable);
        }

        return ResponseEntity.ok(ApiResponse.success(history));
    }

    /**
     * 获取识别统计数据
     *
     * GET /api/mobile/{factoryId}/voice/stats
     */
    @Operation(summary = "获取识别统计数据", description = "获取指定时间范围内的语音识别统计，包括调用次数、成功率等")
    @GetMapping("/{factoryId}/voice/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "开始时间，默认30天前", example = "2025-01-01T00:00:00") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @Parameter(description = "结束时间，默认当前时间", example = "2025-01-31T23:59:59") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {

        if (startTime == null) {
            startTime = LocalDateTime.now().minusDays(30);
        }
        if (endTime == null) {
            endTime = LocalDateTime.now();
        }

        Map<String, Object> stats = voiceRecognitionService.getRecognitionStats(factoryId, startTime, endTime);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    // ==================== 配置管理 ====================

    /**
     * 获取语音识别配置
     *
     * GET /api/mobile/{factoryId}/voice/config
     */
    @Operation(summary = "获取语音识别配置", description = "获取工厂的语音识别配置，包括默认参数、限额、存储设置等")
    @GetMapping("/{factoryId}/voice/config")
    public ResponseEntity<ApiResponse<VoiceRecognitionConfig>> getConfig(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId) {
        VoiceRecognitionConfig config = voiceRecognitionService.getOrCreateConfig(factoryId);
        return ResponseEntity.ok(ApiResponse.success(config));
    }

    /**
     * 更新语音识别配置
     *
     * PUT /api/mobile/{factoryId}/voice/config
     */
    @Operation(summary = "更新语音识别配置", description = "更新工厂的语音识别配置，包括默认语言、采样率、限额等")
    @PutMapping("/{factoryId}/voice/config")
    public ResponseEntity<ApiResponse<VoiceRecognitionConfig>> updateConfig(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "操作用户ID", example = "1") @RequestParam Long userId,
            @Parameter(description = "操作用户名", example = "admin") @RequestParam String username,
            @Valid @RequestBody VoiceRecognitionConfigDTO configDTO) {

        VoiceRecognitionConfig config = convertToEntity(configDTO);
        VoiceRecognitionConfig updated = voiceRecognitionService.updateConfig(
                factoryId, config, userId, username);

        log.info("语音识别配置已更新: factoryId={}, userId={}", factoryId, userId);
        return ResponseEntity.ok(ApiResponse.success(updated));
    }

    // ==================== 批量识别任务 ====================

    /**
     * 创建批量识别任务
     *
     * POST /api/mobile/{factoryId}/voice/batch
     */
    @Operation(summary = "创建批量识别任务", description = "创建批量语音识别任务，一次提交多个音频文件进行异步识别")
    @PostMapping("/{factoryId}/voice/batch")
    public ResponseEntity<ApiResponse<BatchVoiceTask>> createBatchTask(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "用户ID", example = "1") @RequestParam Long userId,
            @Parameter(description = "用户名", example = "admin") @RequestParam String username,
            @Valid @RequestBody BatchVoiceTaskRequest request) {

        try {
            VoiceRecognitionRequest templateRequest = new VoiceRecognitionRequest();
            templateRequest.setFormat(request.getFormat());
            templateRequest.setEncoding(request.getEncoding());
            templateRequest.setSampleRate(request.getSampleRate());
            templateRequest.setLanguage(request.getLanguage());

            BatchVoiceTask task = voiceRecognitionService.createBatchTask(
                    factoryId, userId, username,
                    request.getAudioDataList(), templateRequest, request.getNotes());

            return ResponseEntity.ok(ApiResponse.success(task));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(ApiResponse.error(ErrorSanitizer.sanitize(e)));
        } catch (IllegalStateException e) {
            return ResponseEntity.ok(ApiResponse.error(ErrorSanitizer.sanitize(e)));
        } catch (Exception e) {
            log.error("创建批量任务失败", e);
            return ResponseEntity.ok(ApiResponse.error("创建批量任务失败: " + ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 获取批量任务列表
     *
     * GET /api/mobile/{factoryId}/voice/batch
     */
    @Operation(summary = "获取批量任务列表", description = "分页查询批量语音识别任务，支持按状态筛选")
    @GetMapping("/{factoryId}/voice/batch")
    public ResponseEntity<ApiResponse<Page<BatchVoiceTask>>> getBatchTasks(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "页码，从0开始", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量", example = "20") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "任务状态: PENDING/PROCESSING/COMPLETED/FAILED/CANCELLED", example = "PROCESSING") @RequestParam(required = false) String status) {

        Pageable pageable = PageRequest.of(page, size);
        Page<BatchVoiceTask> tasks;

        if (status != null) {
            tasks = voiceRecognitionService.getBatchTasksByStatus(factoryId, status, pageable);
        } else {
            tasks = voiceRecognitionService.getBatchTasks(factoryId, pageable);
        }

        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    /**
     * 获取批量任务详情
     *
     * GET /api/mobile/{factoryId}/voice/batch/{taskNumber}
     */
    @Operation(summary = "获取批量任务详情", description = "获取批量识别任务的详细信息，包括每个音频文件的识别结果")
    @GetMapping("/{factoryId}/voice/batch/{taskNumber}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBatchTaskDetail(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "任务编号", example = "BATCH-20250101-001") @PathVariable String taskNumber) {

        try {
            Map<String, Object> result = voiceRecognitionService.getBatchTaskResult(taskNumber);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(ApiResponse.error(ErrorSanitizer.sanitize(e)));
        }
    }

    /**
     * 取消批量任务
     *
     * DELETE /api/mobile/{factoryId}/voice/batch/{taskNumber}
     */
    @Operation(summary = "取消批量任务", description = "取消待处理或处理中的批量识别任务")
    @DeleteMapping("/{factoryId}/voice/batch/{taskNumber}")
    public ResponseEntity<ApiResponse<BatchVoiceTask>> cancelBatchTask(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @Parameter(description = "任务编号", example = "BATCH-20250101-001") @PathVariable String taskNumber,
            @Parameter(description = "操作用户ID", example = "1") @RequestParam Long userId) {

        try {
            BatchVoiceTask task = voiceRecognitionService.cancelBatchTask(taskNumber, userId);
            return ResponseEntity.ok(ApiResponse.success(task));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.ok(ApiResponse.error(ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== 私有方法 ====================

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // 多个代理时取第一个
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    private VoiceRecognitionConfig convertToEntity(VoiceRecognitionConfigDTO dto) {
        return VoiceRecognitionConfig.builder()
                .factoryId(dto.getFactoryId())
                .enabled(dto.getEnabled())
                .defaultLanguage(dto.getDefaultLanguage())
                .defaultSampleRate(dto.getDefaultSampleRate())
                .defaultFormat(dto.getDefaultFormat())
                .defaultEncoding(dto.getDefaultEncoding())
                .maxAudioDuration(dto.getMaxAudioDuration())
                .saveAudioToOss(dto.getSaveAudioToOss())
                .saveHistory(dto.getSaveHistory())
                .historyRetentionDays(dto.getHistoryRetentionDays())
                .dailyLimit(dto.getDailyLimit())
                .userDailyLimit(dto.getUserDailyLimit())
                .batchMaxConcurrent(dto.getBatchMaxConcurrent())
                .batchMaxFiles(dto.getBatchMaxFiles())
                .notes(dto.getNotes())
                .build();
    }
}
