package com.cretas.aims.client;

import com.cretas.aims.config.efficiency.PythonEfficiencyConfig;
import com.cretas.aims.dto.efficiency.EfficiencyAnalysisRequest;
import com.cretas.aims.dto.efficiency.EfficiencyAnalysisResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Python 效率识别服务客户端
 *
 * 提供与 Python 效率识别服务的 HTTP 通信，支持：
 * - 单帧效率分析
 * - 统一分析（效率+OCR+计数）
 * - 多摄像头流管理
 * - 成本监控
 *
 * 特性：
 * - 事件冷却机制：避免同一设备短时间内重复分析
 * - 健康检查缓存：减少不必要的健康检查调用
 * - 重试机制：自动重试失败的请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-30
 */
@Slf4j
@Component
public class PythonEfficiencyClient {

    private final PythonEfficiencyConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    // 服务可用性状态
    private final AtomicBoolean serviceAvailable = new AtomicBoolean(false);
    private final AtomicLong lastHealthCheck = new AtomicLong(0);

    // 设备事件冷却（deviceId -> lastAnalysisTime）
    private final Map<String, LocalDateTime> deviceCooldowns = new ConcurrentHashMap<>();

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    public PythonEfficiencyClient(PythonEfficiencyConfig config,
                                   @Qualifier("aiServiceHttpClient") OkHttpClient baseHttpClient,
                                   ObjectMapper objectMapper) {
        this.config = config;
        this.objectMapper = objectMapper;

        // 为效率分析服务创建专用的 HttpClient（较长超时）
        this.httpClient = baseHttpClient.newBuilder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .writeTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .build();
    }

    @PostConstruct
    public void init() {
        if (config.isEnabled()) {
            log.info("Python 效率识别客户端初始化: url={}", config.getUrl());
            checkAvailabilityAsync();
        } else {
            log.info("Python 效率识别服务已禁用");
        }
    }

    // ==================== 可用性检查 ====================

    /**
     * 检查 Python 服务是否可用
     */
    public boolean isAvailable() {
        if (!config.isEnabled()) {
            return false;
        }

        long now = System.currentTimeMillis();
        long lastCheck = lastHealthCheck.get();

        if (now - lastCheck < config.getHealthCheckInterval()) {
            return serviceAvailable.get();
        }

        return checkAvailability();
    }

    private void checkAvailabilityAsync() {
        new Thread(() -> {
            try {
                checkAvailability();
            } catch (Exception e) {
                log.warn("Python 效率识别服务健康检查失败: {}", e.getMessage());
            }
        }, "python-efficiency-health-check").start();
    }

    private boolean checkAvailability() {
        try {
            Request request = new Request.Builder()
                    .url(config.getHealthUrl())
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                boolean available = response.isSuccessful();
                serviceAvailable.set(available);
                lastHealthCheck.set(System.currentTimeMillis());

                if (available) {
                    log.debug("Python 效率识别服务健康检查通过");
                } else {
                    log.warn("Python 效率识别服务健康检查失败: status={}", response.code());
                }

                return available;
            }
        } catch (IOException e) {
            serviceAvailable.set(false);
            lastHealthCheck.set(System.currentTimeMillis());
            log.warn("Python 效率识别服务不可达: {}", e.getMessage());
            return false;
        }
    }

    // ==================== 冷却机制 ====================

    /**
     * 检查设备是否在冷却期内
     */
    public boolean isDeviceInCooldown(String deviceId) {
        LocalDateTime lastAnalysis = deviceCooldowns.get(deviceId);
        if (lastAnalysis == null) {
            return false;
        }

        LocalDateTime cooldownEnd = lastAnalysis.plusSeconds(config.getEventCooldownSeconds());
        return LocalDateTime.now().isBefore(cooldownEnd);
    }

    /**
     * 更新设备冷却时间
     */
    public void updateDeviceCooldown(String deviceId) {
        deviceCooldowns.put(deviceId, LocalDateTime.now());
    }

    /**
     * 清除设备冷却
     */
    public void clearDeviceCooldown(String deviceId) {
        deviceCooldowns.remove(deviceId);
    }

    // ==================== 效率分析 API ====================

    /**
     * 分析单帧图片（效率分析）
     *
     * @param imageBase64 Base64 编码的图片
     * @param cameraId    摄像头ID
     * @param location    位置描述
     * @return 分析结果
     */
    public Optional<EfficiencyAnalysisResponse> analyzeFrame(
            String imageBase64, String cameraId, String location) {

        EfficiencyAnalysisRequest request = EfficiencyAnalysisRequest.forEfficiencyAnalysis(
                imageBase64, cameraId, location);

        return analyzeUnified(request);
    }

    /**
     * 分析单帧（带设备冷却检查）
     *
     * @param imageBase64 Base64 编码的图片
     * @param deviceId    设备ID（用于冷却检查）
     * @param cameraId    摄像头ID
     * @param location    位置描述
     * @return 分析结果，如果在冷却期内返回 empty
     */
    public Optional<EfficiencyAnalysisResponse> analyzeFrameWithCooldown(
            String imageBase64, String deviceId, String cameraId, String location) {

        // 检查冷却
        if (isDeviceInCooldown(deviceId)) {
            log.debug("设备 {} 在冷却期内，跳过分析", deviceId);
            return Optional.empty();
        }

        Optional<EfficiencyAnalysisResponse> result = analyzeFrame(imageBase64, cameraId, location);

        // 更新冷却
        if (result.isPresent() && result.get().isSuccess()) {
            updateDeviceCooldown(deviceId);
        }

        return result;
    }

    /**
     * 统一分析入口（支持效率+OCR+计数）
     *
     * @param request 分析请求
     * @return 分析结果
     */
    public Optional<EfficiencyAnalysisResponse> analyzeUnified(EfficiencyAnalysisRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python 效率识别服务未启用");
            return Optional.empty();
        }

        try {
            log.info("调用 Python 效率分析: cameraId={}, types={}",
                    request.getCameraId(), request.getAnalysisTypes());

            Request httpRequest = new Request.Builder()
                    .url(config.getAnalyzeUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            EfficiencyAnalysisResponse response = executeWithRetry(httpRequest, EfficiencyAnalysisResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("效率分析失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 混合分析（效率+OCR+计数）
     */
    public Optional<EfficiencyAnalysisResponse> analyzeMixed(
            String imageBase64, String cameraId, String location) {

        EfficiencyAnalysisRequest request = EfficiencyAnalysisRequest.forMixedAnalysis(
                imageBase64, cameraId, location);

        return analyzeUnified(request);
    }

    // ==================== 多摄像头流管理 ====================

    /**
     * 添加摄像头流到分析池
     */
    public Optional<Map<String, Object>> addStream(
            String streamId, String rtspUrl, int intervalSeconds, String analysisType) {

        if (!config.isEnabled()) {
            return Optional.empty();
        }

        try {
            Map<String, Object> requestBody = Map.of(
                    "stream_id", streamId,
                    "rtsp_url", rtspUrl,
                    "interval_seconds", intervalSeconds,
                    "analysis_type", analysisType
            );

            Request request = new Request.Builder()
                    .url(config.getAddStreamUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                    .build();

            return Optional.ofNullable(executeWithRetry(request, Map.class));

        } catch (IOException e) {
            log.error("添加流失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 批量添加摄像头流
     */
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> batchAddStreams(java.util.List<Map<String, Object>> streams, int intervalSeconds) {
        if (!config.isEnabled()) {
            return Optional.empty();
        }

        try {
            Map<String, Object> requestBody = Map.of(
                    "streams", streams,
                    "interval_seconds", intervalSeconds
            );

            Request request = new Request.Builder()
                    .url(config.getBatchAddStreamUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                    .build();

            return Optional.ofNullable(executeWithRetry(request, Map.class));

        } catch (IOException e) {
            log.error("批量添加流失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 移除摄像头流
     */
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> removeStream(String streamId) {
        if (!config.isEnabled()) {
            return Optional.empty();
        }

        try {
            Map<String, Object> requestBody = Map.of("stream_id", streamId);

            Request request = new Request.Builder()
                    .url(config.getRemoveStreamUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                    .build();

            return Optional.ofNullable(executeWithRetry(request, Map.class));

        } catch (IOException e) {
            log.error("移除流失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 获取所有流状态
     */
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> getStreamStatus() {
        if (!config.isEnabled()) {
            return Optional.empty();
        }

        try {
            Request request = new Request.Builder()
                    .url(config.getStreamStatusUrl())
                    .get()
                    .build();

            return Optional.ofNullable(executeWithRetry(request, Map.class));

        } catch (IOException e) {
            log.error("获取流状态失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== 成本监控 ====================

    /**
     * 获取成本概览
     */
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> getCostSummary() {
        if (!config.isEnabled()) {
            return Optional.empty();
        }

        try {
            Request request = new Request.Builder()
                    .url(config.getCostSummaryUrl())
                    .get()
                    .build();

            return Optional.ofNullable(executeWithRetry(request, Map.class));

        } catch (IOException e) {
            log.error("获取成本概览失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== 通用请求执行 ====================

    private <T> T executeWithRetry(Request request, Class<T> responseType) throws IOException {
        int retries = 0;
        IOException lastException = null;

        while (retries <= config.getMaxRetries()) {
            try {
                return execute(request, responseType);
            } catch (IOException e) {
                lastException = e;
                retries++;
                if (retries <= config.getMaxRetries()) {
                    log.warn("Python 效率识别请求失败，重试 {}/{}: {}",
                            retries, config.getMaxRetries(), e.getMessage());
                    try {
                        Thread.sleep(1000L * retries);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IOException("请求被中断", ie);
                    }
                }
            }
        }

        serviceAvailable.set(false);
        throw lastException;
    }

    private <T> T execute(Request request, Class<T> responseType) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "No response body";
                throw new IOException("Python 效率识别请求失败: status=" + response.code() + ", body=" + errorBody);
            }

            String responseBody = response.body() != null ? response.body().string() : "";
            return objectMapper.readValue(responseBody, responseType);
        }
    }

    // ==================== Getter ====================

    public PythonEfficiencyConfig getConfig() {
        return config;
    }
}
