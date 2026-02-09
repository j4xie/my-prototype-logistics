package com.cretas.aims.service.isapi;

import com.cretas.aims.ai.client.DashScopeVisionClient;
import com.cretas.aims.ai.client.DashScopeVisionClient.CameraAlertAnalysisResult;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.repository.isapi.IsapiEventLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * ISAPI 告警 AI 分析服务
 * 使用 Qwen VL 模型对告警图片进行智能分析
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IsapiAlertAnalysisService {

    private final DashScopeVisionClient visionClient;
    private final IsapiEventLogRepository eventLogRepository;

    // 图片下载HTTP客户端
    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();

    /**
     * 异步分析告警图片
     *
     * @param eventLog 事件日志
     * @param device   设备信息
     */
    @Async
    public void analyzeAlertAsync(IsapiEventLog eventLog, IsapiDevice device) {
        try {
            analyzeAlert(eventLog, device);
        } catch (Exception e) {
            log.error("异步分析告警失败: eventId={}, error={}", eventLog.getId(), e.getMessage());
        }
    }

    /**
     * 分析告警图片
     *
     * @param eventLog 事件日志
     * @param device   设备信息
     * @return 分析结果
     */
    @Transactional
    public CameraAlertAnalysisResult analyzeAlert(IsapiEventLog eventLog, IsapiDevice device) {
        // 检查是否有图片数据
        byte[] pictureData = eventLog.getPictureData();
        String imageBase64 = null;

        if (pictureData != null && pictureData.length > 0) {
            // 优先使用二进制数据
            imageBase64 = Base64.getEncoder().encodeToString(pictureData);
            log.debug("使用二进制图片数据: eventId={}, size={}", eventLog.getId(), pictureData.length);
        } else if (eventLog.getPictureUrl() != null && !eventLog.getPictureUrl().isEmpty()) {
            // 尝试从URL下载图片
            try {
                pictureData = downloadImage(eventLog.getPictureUrl());
                if (pictureData != null && pictureData.length > 0) {
                    imageBase64 = Base64.getEncoder().encodeToString(pictureData);
                    log.debug("从URL下载图片成功: eventId={}, url={}, size={}",
                            eventLog.getId(), eventLog.getPictureUrl(), pictureData.length);
                }
            } catch (Exception e) {
                log.warn("从URL下载图片失败: url={}, error={}", eventLog.getPictureUrl(), e.getMessage());
            }
        }

        if (imageBase64 == null) {
            log.debug("事件无图片数据，跳过 AI 分析: eventId={}", eventLog.getId());
            return CameraAlertAnalysisResult.error("无图片数据");
        }

        // 检查视觉服务是否可用
        if (!visionClient.isAvailable()) {
            log.warn("视觉服务不可用，跳过 AI 分析");
            return CameraAlertAnalysisResult.error("视觉服务不可用");
        }

        // 构建上下文信息
        Map<String, Object> context = new HashMap<>();
        context.put("deviceName", device.getDeviceName());
        context.put("location", device.getLocationDescription());
        context.put("channelId", eventLog.getChannelId());
        context.put("factoryId", device.getFactoryId());

        log.info("开始 AI 分析告警图片: eventId={}, eventType={}, device={}",
                eventLog.getId(), eventLog.getEventType(), device.getDeviceName());

        // 调用 AI 分析
        CameraAlertAnalysisResult result = visionClient.analyzeCameraAlert(
                imageBase64,
                eventLog.getEventType(),
                context
        );

        // 保存分析结果
        if (result.isSuccess()) {
            eventLog.setAiAnalysisResult(
                    result.getThreatLevel(),
                    result.getDetectedObjects(),
                    result.getObjectCount(),
                    result.getSceneDescription(),
                    result.getRiskAssessment(),
                    result.getRecommendedActions(),
                    result.getProductionImpact(),
                    result.isHygieneConcern(),
                    result.isSafetyConcern()
            );
            eventLogRepository.save(eventLog);

            log.info("AI 分析完成: eventId={}, threatLevel={}, requiresAction={}",
                    eventLog.getId(), result.getThreatLevel(), result.requiresImmediateAction());

            // 如果需要立即处理，可以触发额外告警
            if (result.requiresImmediateAction()) {
                log.warn("检测到高风险告警，需要立即处理: eventId={}, 风险评估={}",
                        eventLog.getId(), result.getRiskAssessment());
            }
        } else {
            log.warn("AI 分析失败: eventId={}, message={}", eventLog.getId(), result.getMessage());
        }

        return result;
    }

    /**
     * 根据事件 ID 重新分析
     *
     * @param eventId 事件 ID
     * @return 分析结果
     */
    @Transactional
    public CameraAlertAnalysisResult reanalyzeEvent(Long eventId) {
        IsapiEventLog eventLog = eventLogRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("事件不存在: " + eventId));

        IsapiDevice device = eventLog.getDevice();
        if (device == null) {
            return CameraAlertAnalysisResult.error("设备信息不存在");
        }

        return analyzeAlert(eventLog, device);
    }

    /**
     * 检查事件是否应该进行 AI 分析
     *
     * @param eventLog 事件日志
     * @return 是否应该分析
     */
    public boolean shouldAnalyze(IsapiEventLog eventLog) {
        // 心跳事件不分析
        if (eventLog.isHeartbeat()) {
            return false;
        }

        // 只分析 ACTIVE 状态的告警
        if (eventLog.getEventState() != IsapiEventLog.EventState.ACTIVE) {
            return false;
        }

        // 已分析过的不重复分析
        if (Boolean.TRUE.equals(eventLog.getAiAnalyzed())) {
            return false;
        }

        // 只分析以下类型的告警
        String eventType = eventLog.getEventType().toLowerCase();
        return switch (eventType) {
            case "linedetection",    // 越界检测
                 "fielddetection",   // 区域入侵
                 "facedetection",    // 人脸检测
                 "vmd",              // 移动侦测
                 "scenechangedetection" -> true;  // 场景变化
            default -> false;
        };
    }

    /**
     * 从URL下载图片
     *
     * @param imageUrl 图片URL
     * @return 图片二进制数据
     * @throws IOException 下载失败
     */
    private byte[] downloadImage(String imageUrl) throws IOException {
        Request request = new Request.Builder()
                .url(imageUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (compatible; CretasBot/1.0)")
                .build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("HTTP " + response.code() + ": " + response.message());
            }

            if (response.body() == null) {
                throw new IOException("Empty response body");
            }

            return response.body().bytes();
        }
    }
}
