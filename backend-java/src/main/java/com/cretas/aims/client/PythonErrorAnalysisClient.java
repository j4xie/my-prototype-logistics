package com.cretas.aims.client;

import com.cretas.aims.config.PythonErrorAnalysisConfig;
import com.cretas.aims.dto.python.ErrorAnalysisRequest;
import com.cretas.aims.dto.python.ErrorAnalysisResponse;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Python Error Analysis 服务客户端
 *
 * 提供与 Python 错误分析服务的 HTTP 通信，支持：
 * - 日维度聚合统计
 * - 失败模式识别
 * - 关键词提取
 * - 服务健康检查
 *
 * 包含重试机制和健康状态缓存，避免频繁调用不可用的服务。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Component
public class PythonErrorAnalysisClient {

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    private final PythonErrorAnalysisConfig config;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    // 服务可用性状态
    private final AtomicBoolean serviceAvailable = new AtomicBoolean(false);
    private final AtomicLong lastHealthCheck = new AtomicLong(0);

    public PythonErrorAnalysisClient(
            PythonErrorAnalysisConfig config,
            @Qualifier("aiServiceHttpClient") OkHttpClient baseHttpClient,
            ObjectMapper objectMapper) {
        this.config = config;
        this.objectMapper = objectMapper;

        // 为 Python Error Analysis 服务创建专用的 HttpClient
        this.httpClient = baseHttpClient.newBuilder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .writeTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .build();
    }

    @PostConstruct
    public void init() {
        if (config.isEnabled()) {
            log.info("Python Error Analysis 客户端初始化: url={}", config.getUrl());
            // 异步检查服务可用性
            checkAvailabilityAsync();
        } else {
            log.info("Python Error Analysis 服务已禁用");
        }
    }

    // ==================== 健康检查 ====================

    /**
     * 检查 Python 服务是否可用
     *
     * 使用缓存机制避免频繁检查，健康检查间隔由配置决定。
     *
     * @return true 如果服务可用且响应正常
     */
    public boolean isAvailable() {
        if (!config.isEnabled()) {
            return false;
        }

        long now = System.currentTimeMillis();
        long lastCheck = lastHealthCheck.get();

        // 使用缓存的健康状态
        if (now - lastCheck < config.getHealthCheckInterval()) {
            return serviceAvailable.get();
        }

        // 需要重新检查
        return checkAvailability();
    }

    /**
     * 异步检查服务可用性
     */
    private void checkAvailabilityAsync() {
        new Thread(() -> {
            try {
                checkAvailability();
            } catch (Exception e) {
                log.warn("Python Error Analysis 服务健康检查失败: {}", e.getMessage());
            }
        }, "python-error-analysis-health-check").start();
    }

    /**
     * 同步检查服务可用性
     */
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
                    log.debug("Python Error Analysis 服务健康检查通过");
                } else {
                    log.warn("Python Error Analysis 服务健康检查失败: status={}", response.code());
                }

                return available;
            }
        } catch (IOException e) {
            serviceAvailable.set(false);
            lastHealthCheck.set(System.currentTimeMillis());
            log.warn("Python Error Analysis 服务不可达: {}", e.getMessage());
            return false;
        }
    }

    // ==================== 业务方法 ====================

    /**
     * 日维度聚合统计
     *
     * @param records 意图匹配记录列表
     * @return 聚合统计结果，服务不可用时返回 empty
     */
    public Optional<ErrorAnalysisResponse.AggregateResponse> aggregateDaily(List<IntentMatchRecord> records) {
        if (!isAvailable()) {
            log.debug("Python Error Analysis 服务不可用，跳过日维度聚合统计");
            return Optional.empty();
        }

        try {
            log.info("调用 Python Error Analysis 日维度聚合: recordsCount={}", records.size());

            List<ErrorAnalysisRequest.IntentMatchRecordDTO> dtos = records.stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());

            ErrorAnalysisRequest.AggregateRequest request = ErrorAnalysisRequest.AggregateRequest.builder()
                    .records(dtos)
                    .build();

            String json = objectMapper.writeValueAsString(request);
            RequestBody body = RequestBody.create(JSON, json);

            Request httpRequest = new Request.Builder()
                    .url(config.getAggregateDailyUrl())
                    .post(body)
                    .build();

            ErrorAnalysisResponse.ApiResponse<ErrorAnalysisResponse.AggregateResponse> response =
                    executeWithRetry(httpRequest, new TypeReference<>() {});

            if (response != null && Boolean.TRUE.equals(response.getSuccess())) {
                return Optional.ofNullable(response.getData());
            }

            if (response != null && response.getMessage() != null) {
                log.warn("日维度聚合统计失败: {}", response.getMessage());
            }
            return Optional.empty();

        } catch (Exception e) {
            log.error("调用 Python aggregate-daily API 失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 识别失败模式
     *
     * @param records      意图匹配记录列表
     * @param minFrequency 最小出现频率
     * @return 失败模式列表，服务不可用时返回 empty
     */
    public Optional<ErrorAnalysisResponse.FailurePatternResponse> identifyFailurePatterns(
            List<IntentMatchRecord> records, int minFrequency) {
        if (!isAvailable()) {
            log.debug("Python Error Analysis 服务不可用，跳过失败模式识别");
            return Optional.empty();
        }

        try {
            log.info("调用 Python Error Analysis 失败模式识别: recordsCount={}, minFrequency={}",
                    records.size(), minFrequency);

            List<ErrorAnalysisRequest.IntentMatchRecordDTO> dtos = records.stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());

            ErrorAnalysisRequest.FailurePatternRequest request = ErrorAnalysisRequest.FailurePatternRequest.builder()
                    .records(dtos)
                    .minFrequency(minFrequency)
                    .build();

            String json = objectMapper.writeValueAsString(request);
            RequestBody body = RequestBody.create(JSON, json);

            Request httpRequest = new Request.Builder()
                    .url(config.getFailurePatternsUrl())
                    .post(body)
                    .build();

            ErrorAnalysisResponse.ApiResponse<ErrorAnalysisResponse.FailurePatternResponse> response =
                    executeWithRetry(httpRequest, new TypeReference<>() {});

            if (response != null && Boolean.TRUE.equals(response.getSuccess())) {
                return Optional.ofNullable(response.getData());
            }

            if (response != null && response.getMessage() != null) {
                log.warn("失败模式识别失败: {}", response.getMessage());
            }
            return Optional.empty();

        } catch (Exception e) {
            log.error("调用 Python identify-failure-patterns API 失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 提取关键词
     *
     * @param inputs       用户输入列表
     * @param minFrequency 最小出现频率
     * @param topN         返回的关键词数量
     * @return 关键词列表，服务不可用时返回 empty
     */
    public Optional<ErrorAnalysisResponse.KeywordExtractionResponse> extractKeywords(
            List<String> inputs, int minFrequency, int topN) {
        if (!isAvailable()) {
            log.debug("Python Error Analysis 服务不可用，跳过关键词提取");
            return Optional.empty();
        }

        try {
            log.info("调用 Python Error Analysis 关键词提取: inputsCount={}, minFrequency={}, topN={}",
                    inputs.size(), minFrequency, topN);

            ErrorAnalysisRequest.KeywordExtractionRequest request = ErrorAnalysisRequest.KeywordExtractionRequest.builder()
                    .inputs(inputs)
                    .minFrequency(minFrequency)
                    .topN(topN)
                    .build();

            String json = objectMapper.writeValueAsString(request);
            RequestBody body = RequestBody.create(JSON, json);

            Request httpRequest = new Request.Builder()
                    .url(config.getExtractKeywordsUrl())
                    .post(body)
                    .build();

            ErrorAnalysisResponse.ApiResponse<ErrorAnalysisResponse.KeywordExtractionResponse> response =
                    executeWithRetry(httpRequest, new TypeReference<>() {});

            if (response != null && Boolean.TRUE.equals(response.getSuccess())) {
                return Optional.ofNullable(response.getData());
            }

            if (response != null && response.getMessage() != null) {
                log.warn("关键词提取失败: {}", response.getMessage());
            }
            return Optional.empty();

        } catch (Exception e) {
            log.error("调用 Python extract-keywords API 失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== DTO 转换 ====================

    /**
     * 将 IntentMatchRecord 实体转换为 DTO
     *
     * @param record 意图匹配记录实体
     * @return DTO 对象
     */
    private ErrorAnalysisRequest.IntentMatchRecordDTO toDTO(IntentMatchRecord record) {
        return ErrorAnalysisRequest.IntentMatchRecordDTO.builder()
                .id(record.getId())
                .userInput(record.getUserInput())
                .normalizedInput(record.getNormalizedInput())
                .matchedIntentCode(record.getMatchedIntentCode())
                .matchedIntentName(record.getMatchedIntentName())
                .matchedIntentCategory(record.getMatchedIntentCategory())
                .confidenceScore(record.getConfidenceScore() != null
                        ? record.getConfidenceScore().doubleValue() : null)
                .matchMethod(record.getMatchMethod() != null
                        ? record.getMatchMethod().name() : null)
                .isStrongSignal(record.isStrongSignal())
                .requiresConfirmation(record.isRequiresConfirmation())
                .llmCalled(record.getLlmCalled())
                .userConfirmed(record.getUserConfirmed())
                .executionStatus(record.getExecutionStatus() != null
                        ? record.getExecutionStatus().name() : null)
                .errorAttribution(record.getErrorAttribution() != null
                        ? record.getErrorAttribution().name() : null)
                .build();
    }

    // ==================== HTTP 请求执行 ====================

    /**
     * 执行请求并带重试机制
     *
     * @param request  HTTP 请求
     * @param typeRef  响应类型引用
     * @param <T>      响应类型
     * @return 响应对象
     * @throws IOException 如果所有重试都失败
     */
    private <T> T executeWithRetry(Request request, TypeReference<T> typeRef) throws IOException {
        int retries = 0;
        IOException lastException = null;

        while (retries <= config.getMaxRetries()) {
            try {
                return execute(request, typeRef);
            } catch (IOException e) {
                lastException = e;
                retries++;
                if (retries <= config.getMaxRetries()) {
                    log.warn("Python Error Analysis 请求失败，重试 {}/{}: {}",
                            retries, config.getMaxRetries(), e.getMessage());
                    try {
                        Thread.sleep(1000L * retries); // 指数退避
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IOException("请求被中断", ie);
                    }
                }
            }
        }

        // 标记服务不可用
        serviceAvailable.set(false);
        throw lastException;
    }

    /**
     * 执行单次请求
     *
     * @param request HTTP 请求
     * @param typeRef 响应类型引用
     * @param <T>     响应类型
     * @return 响应对象
     * @throws IOException 如果请求失败
     */
    private <T> T execute(Request request, TypeReference<T> typeRef) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "No response body";
                throw new IOException("Python Error Analysis 请求失败: status=" + response.code() + ", body=" + errorBody);
            }

            ResponseBody responseBody = response.body();
            if (responseBody == null) {
                return null;
            }

            String bodyStr = responseBody.string();
            return objectMapper.readValue(bodyStr, typeRef);
        }
    }

    // ==================== Getter ====================

    /**
     * 获取配置
     */
    public PythonErrorAnalysisConfig getConfig() {
        return config;
    }

    /**
     * 获取服务 URL
     */
    public String getServiceUrl() {
        return config.getUrl();
    }
}
