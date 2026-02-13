package com.cretas.aims.client;

import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.python.*;
import com.cretas.aims.dto.python.ClassifierRequest;
import com.cretas.aims.dto.python.ClassifierResponse;
import com.cretas.aims.dto.python.ClassifierBatchResponse;
import com.cretas.aims.dto.python.PythonAnalysisRequest;
import com.cretas.aims.dto.python.PythonAnalysisResponse;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Python SmartBI 服务客户端
 *
 * 提供与 Python SmartBI 服务的 HTTP 通信，支持：
 * - Excel 解析
 * - 指标计算
 * - 预测分析
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
public class PythonSmartBIClient {

    private final PythonSmartBIConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    // 服务可用性状态
    private final AtomicBoolean serviceAvailable = new AtomicBoolean(false);
    private final AtomicLong lastHealthCheck = new AtomicLong(0);

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    public PythonSmartBIClient(PythonSmartBIConfig config,
                               @Qualifier("aiServiceHttpClient") OkHttpClient baseHttpClient,
                               ObjectMapper objectMapper) {
        this.config = config;
        this.objectMapper = objectMapper;

        // 为 Python SmartBI 服务创建专用的 HttpClient
        this.httpClient = baseHttpClient.newBuilder()
                .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
                .readTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .writeTimeout(config.getTimeout(), TimeUnit.MILLISECONDS)
                .build();
    }

    @PostConstruct
    public void init() {
        if (config.isEnabled()) {
            log.info("Python SmartBI 客户端初始化: url={}", config.getUrl());
            // 异步检查服务可用性
            checkAvailabilityAsync();
        } else {
            log.info("Python SmartBI 服务已禁用");
        }
    }

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
                log.warn("Python SmartBI 服务健康检查失败: {}", e.getMessage());
            }
        }, "python-smartbi-health-check").start();
    }

    /**
     * 同步检查服务可用性
     */
    private boolean checkAvailability() {
        try {
            Request request = new Request.Builder()
                    .url(config.getUrl() + "/health")
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                boolean available = response.isSuccessful();
                serviceAvailable.set(available);
                lastHealthCheck.set(System.currentTimeMillis());

                if (available) {
                    log.debug("Python SmartBI 服务健康检查通过");
                } else {
                    log.warn("Python SmartBI 服务健康检查失败: status={}", response.code());
                }

                return available;
            }
        } catch (IOException e) {
            serviceAvailable.set(false);
            lastHealthCheck.set(System.currentTimeMillis());
            log.warn("Python SmartBI 服务不可达: {}", e.getMessage());
            return false;
        }
    }

    // ==================== Excel 解析 ====================

    /**
     * 使用 Python 服务解析 Excel 文件
     *
     * @param file      Excel 文件
     * @param factoryId 工厂ID
     * @param dataType  数据类型提示
     * @return 解析结果
     * @throws IOException 如果请求失败
     */
    public ExcelParseResponse parseExcel(MultipartFile file, String factoryId, String dataType) throws IOException {
        return parseExcel(file, factoryId, dataType, 0, 1);
    }

    /**
     * 使用 Python 服务解析 Excel 文件（带 sheet 和 header 参数）
     *
     * @param file       Excel 文件
     * @param factoryId  工厂ID
     * @param dataType   数据类型提示
     * @param sheetIndex Sheet 索引（0-based）
     * @param headerRows 表头行数
     * @return 解析结果
     * @throws IOException 如果请求失败
     */
    /**
     * 调用 Python /auto-parse 端点解析 Excel
     *
     * 注意：/auto-parse 使用 StructureDetector 自动检测表头结构，
     * headerRows 参数会被忽略（保留参数是为了向后兼容）
     *
     * @param file        Excel 文件
     * @param factoryId   工厂 ID
     * @param dataType    数据类型
     * @param sheetIndex  Sheet 索引 (从 0 开始)
     * @param headerRows  [已废弃] 表头行数（Python auto-parse 会忽略此参数）
     * @return 解析结果
     */
    public ExcelParseResponse parseExcel(MultipartFile file, String factoryId, String dataType,
                                          int sheetIndex, int headerRows) throws IOException {
        log.info("调用 Python SmartBI /auto-parse: fileName={}, factoryId={}, dataType={}, sheetIndex={} (headerRows={} 将被忽略)",
                file.getOriginalFilename(), factoryId, dataType, sheetIndex, headerRows);

        RequestBody fileBody = RequestBody.create(
                MediaType.parse("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                file.getBytes()
        );

        // 注意：/auto-parse 端点使用 StructureDetector 自动检测，不需要 header_rows
        MultipartBody.Builder bodyBuilder = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", file.getOriginalFilename(), fileBody)
                .addFormDataPart("sheetIndex", String.valueOf(sheetIndex));

        // 添加可选的 factory_id 用于自定义字段映射
        if (factoryId != null && !factoryId.isEmpty()) {
            bodyBuilder.addFormDataPart("factory_id", factoryId);
        }

        Request request = new Request.Builder()
                .url(config.getParseExcelUrl())
                .post(bodyBuilder.build())
                .build();

        return executeWithRetry(request, ExcelParseResponse.class);
    }

    // ==================== 指标计算 ====================

    /**
     * 使用 Python 服务计算指标
     *
     * @param metricCode    指标代码
     * @param data          数据列表
     * @param fieldMappings 字段映射
     * @return 指标计算结果
     * @throws IOException 如果请求失败
     */
    public MetricResult calculateMetric(String metricCode, List<Map<String, Object>> data,
                                        Map<String, String> fieldMappings) throws IOException {
        log.info("调用 Python SmartBI 计算指标: metricCode={}, dataSize={}", metricCode, data.size());

        Map<String, Object> requestBody = Map.of(
                "metricCode", metricCode,
                "data", data,
                "fieldMappings", fieldMappings
        );

        Request request = new Request.Builder()
                .url(config.getCalculateMetricsUrl())
                .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                .build();

        return executeWithRetry(request, MetricResult.class);
    }

    /**
     * 批量计算指标
     *
     * @param data          数据列表
     * @param fieldMappings 字段映射
     * @return 指标计算结果列表
     * @throws IOException 如果请求失败
     */
    public List<MetricResult> calculateAllMetrics(List<Map<String, Object>> data,
                                                   Map<String, String> fieldMappings) throws IOException {
        log.info("调用 Python SmartBI 批量计算指标: dataSize={}", data.size());

        Map<String, Object> requestBody = Map.of(
                "data", data,
                "fieldMappings", fieldMappings
        );

        Request request = new Request.Builder()
                .url(config.getCalculateAllMetricsUrl())
                .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                .build();

        return executeWithRetry(request, new TypeReference<List<MetricResult>>() {});
    }

    // ==================== 预测分析 ====================

    /**
     * 使用 Python 服务进行销售预测
     *
     * @param factoryId    工厂ID
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param forecastDays 预测天数
     * @return 预测结果
     * @throws IOException 如果请求失败
     */
    public ForecastResult forecastSales(String factoryId, LocalDate startDate,
                                         LocalDate endDate, int forecastDays) throws IOException {
        log.info("调用 Python SmartBI 销售预测: factoryId={}, startDate={}, endDate={}, forecastDays={}",
                factoryId, startDate, endDate, forecastDays);

        Map<String, Object> requestBody = Map.of(
                "factoryId", factoryId,
                "startDate", startDate.toString(),
                "endDate", endDate.toString(),
                "forecastDays", forecastDays,
                "metricType", "sales_amount"
        );

        Request request = new Request.Builder()
                .url(config.getForecastUrl())
                .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                .build();

        return executeWithRetry(request, ForecastResult.class);
    }

    /**
     * 使用 Python 服务进行通用指标预测
     *
     * @param factoryId    工厂ID
     * @param metricType   指标类型
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param forecastDays 预测天数
     * @param algorithm    预测算法（可选）
     * @return 预测结果
     * @throws IOException 如果请求失败
     */
    public ForecastResult forecastMetric(String factoryId, String metricType,
                                          LocalDate startDate, LocalDate endDate,
                                          int forecastDays, String algorithm) throws IOException {
        log.info("调用 Python SmartBI 指标预测: factoryId={}, metricType={}, algorithm={}",
                factoryId, metricType, algorithm);

        Map<String, Object> requestBody = Map.of(
                "factoryId", factoryId,
                "metricType", metricType,
                "startDate", startDate.toString(),
                "endDate", endDate.toString(),
                "forecastDays", forecastDays,
                "algorithm", algorithm != null ? algorithm : "AUTO"
        );

        Request request = new Request.Builder()
                .url(config.getForecastUrl())
                .post(RequestBody.create(JSON, objectMapper.writeValueAsString(requestBody)))
                .build();

        return executeWithRetry(request, ForecastResult.class);
    }

    // ==================== 通用请求执行 ====================

    /**
     * 执行请求并带重试机制
     */
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
                    log.warn("Python SmartBI 请求失败，重试 {}/{}: {}", retries, config.getMaxRetries(), e.getMessage());
                    try {
                        Thread.sleep(1000 * retries); // 指数退避
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
     * 执行请求并带重试机制（TypeReference 版本）
     */
    private <T> T executeWithRetry(Request request, TypeReference<T> typeReference) throws IOException {
        int retries = 0;
        IOException lastException = null;

        while (retries <= config.getMaxRetries()) {
            try {
                return execute(request, typeReference);
            } catch (IOException e) {
                lastException = e;
                retries++;
                if (retries <= config.getMaxRetries()) {
                    log.warn("Python SmartBI 请求失败，重试 {}/{}: {}", retries, config.getMaxRetries(), e.getMessage());
                    try {
                        Thread.sleep(1000 * retries);
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

    /**
     * 执行单次请求
     */
    private <T> T execute(Request request, Class<T> responseType) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "No response body";
                throw new IOException("Python SmartBI 请求失败: status=" + response.code() + ", body=" + errorBody);
            }

            String responseBody = response.body() != null ? response.body().string() : "";
            return objectMapper.readValue(responseBody, responseType);
        }
    }

    /**
     * 执行单次请求（TypeReference 版本）
     */
    private <T> T execute(Request request, TypeReference<T> typeReference) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "No response body";
                throw new IOException("Python SmartBI 请求失败: status=" + response.code() + ", body=" + errorBody);
            }

            String responseBody = response.body() != null ? response.body().string() : "";
            return objectMapper.readValue(responseBody, typeReference);
        }
    }

    // ==================== 新增：字段检测 ====================

    /**
     * 检测字段类型和语义
     *
     * @param request 检测请求
     * @return 检测结果，服务不可用时返回 empty
     */
    public Optional<PythonFieldDetectionResponse> detectFields(PythonFieldDetectionRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过字段检测");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 字段检测: headersCount={}",
                    request.getHeaders() != null ? request.getHeaders().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(config.getDetectFieldsUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonFieldDetectionResponse response = executeWithRetry(httpRequest, PythonFieldDetectionResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("字段检测失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：从样本数据检测字段
     */
    public Optional<PythonFieldDetectionResponse> detectFields(
            List<Map<String, Object>> sampleData, List<String> headers) {
        PythonFieldDetectionRequest request = PythonFieldDetectionRequest.builder()
                .sampleData(sampleData)
                .headers(headers)
                .build();
        return detectFields(request);
    }

    // ==================== 新增：字段映射 (LLM) ====================

    /**
     * 使用 LLM 映射字段
     *
     * @param request 映射请求
     * @return 映射结果
     */
    public Optional<PythonFieldMappingResponse> mapFields(PythonFieldMappingRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过字段映射");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 字段映射 (LLM): dataType={}, headersCount={}",
                    request.getDataType(),
                    request.getHeaders() != null ? request.getHeaders().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(config.getMapFieldsUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonFieldMappingResponse response = executeWithRetry(httpRequest, PythonFieldMappingResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("字段映射失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：映射字段
     */
    public Optional<PythonFieldMappingResponse> mapFields(List<String> headers, String dataType) {
        PythonFieldMappingRequest request = PythonFieldMappingRequest.builder()
                .headers(headers)
                .dataType(dataType)
                .build();
        return mapFields(request);
    }

    // ==================== 新增：图表配置推荐 ====================

    /**
     * 获取图表配置推荐
     *
     * @param request 配置请求
     * @return 配置结果
     */
    public Optional<PythonChartConfigResponse> getChartConfig(PythonChartConfigRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过图表配置推荐");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 图表配置推荐: dataType={}, fieldsCount={}",
                    request.getDataType(),
                    request.getFields() != null ? request.getFields().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(config.getChartConfigUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonChartConfigResponse response = executeWithRetry(httpRequest, PythonChartConfigResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("图表配置推荐失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：根据字段获取图表配置
     */
    public Optional<PythonChartConfigResponse> getChartConfig(
            List<PythonChartConfigRequest.FieldInfo> fields, String dataType) {
        PythonChartConfigRequest request = PythonChartConfigRequest.builder()
                .fields(fields)
                .dataType(dataType)
                .build();
        return getChartConfig(request);
    }

    // ==================== 新增：指标计算 (新版 DTO) ====================

    /**
     * 计算指标 (使用新版 DTO)
     *
     * @param request 计算请求
     * @return 计算结果
     */
    public Optional<PythonMetricResponse> calculateMetricsV2(PythonMetricRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过指标计算");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 指标计算 V2: dataSize={}, metricsCount={}",
                    request.getData() != null ? request.getData().size() : 0,
                    request.getMetrics() != null ? request.getMetrics().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(config.getCalculateMetricsUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonMetricResponse response = executeWithRetry(httpRequest, PythonMetricResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("指标计算 V2 失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== 新增：预测分析 (新版 DTO) ====================

    /**
     * 执行预测 (使用新版 DTO)
     *
     * @param request 预测请求
     * @return 预测结果
     */
    public Optional<PythonForecastResponse> forecastV2(PythonForecastRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过预测分析");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 预测分析 V2: algorithm={}, periods={}, dataSize={}",
                    request.getAlgorithm(),
                    request.getPeriods(),
                    request.getData() != null ? request.getData().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(config.getForecastUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonForecastResponse response = executeWithRetry(httpRequest, PythonForecastResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("预测分析 V2 失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：执行预测
     */
    public Optional<PythonForecastResponse> forecast(List<Double> data, String algorithm, int periods) {
        PythonForecastRequest request = PythonForecastRequest.builder()
                .data(data)
                .algorithm(algorithm)
                .periods(periods)
                .build();
        return forecastV2(request);
    }

    // ==================== 新增：AI 洞察生成 ====================

    /**
     * 生成 AI 洞察
     *
     * @param request 洞察请求
     * @return 洞察结果
     */
    public Optional<PythonInsightResponse> generateInsight(PythonInsightRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过 AI 洞察生成");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI AI 洞察生成: dataType={}, insightType={}",
                    request.getDataType(),
                    request.getInsightType());

            Request httpRequest = new Request.Builder()
                    .url(config.getInsightUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonInsightResponse response = executeWithRetry(httpRequest, PythonInsightResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("AI 洞察生成失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：生成洞察
     */
    public Optional<PythonInsightResponse> generateInsight(Map<String, Object> analysisData, String dataType) {
        PythonInsightRequest request = PythonInsightRequest.builder()
                .analysisData(analysisData)
                .dataType(dataType)
                .build();
        return generateInsight(request);
    }

    // ==================== 新增：图表构建 ====================

    /**
     * 构建图表
     *
     * @param request 构建请求
     * @return 图表配置
     */
    public Optional<PythonChartResponse> buildChart(PythonChartRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过图表构建");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 图表构建: chartType={}, dataSize={}",
                    request.getChartType(),
                    request.getData() != null ? request.getData().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(config.getBuildChartUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonChartResponse response = executeWithRetry(httpRequest, PythonChartResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("图表构建失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：构建图表
     */
    public Optional<PythonChartResponse> buildChart(
            String chartType,
            List<Map<String, Object>> data,
            String dimensionField,
            List<String> metricFields) {
        PythonChartRequest request = PythonChartRequest.builder()
                .chartType(chartType)
                .data(data)
                .dimensionField(dimensionField)
                .metricFields(metricFields)
                .build();
        return buildChart(request);
    }

    /**
     * 便捷方法：构建图表 (返回 Map)
     */
    public Optional<Map<String, Object>> buildChartConfig(String chartType, Map<String, Object> data) {
        PythonChartRequest request = PythonChartRequest.builder()
                .chartType(chartType)
                .build();

        return buildChart(request)
                .filter(PythonChartResponse::isSuccess)
                .map(PythonChartResponse::getChartConfig);
    }

    // ==================== 新增：Excel 解析 (新版 DTO) ====================

    /**
     * 解析 Excel 文件 (使用新版 DTO)
     *
     * @param file    Excel 文件
     * @param request 解析参数
     * @return 解析结果
     */
    public Optional<PythonExcelParseResponse> parseExcelV2(MultipartFile file, PythonExcelParseRequest request) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过 Excel 解析");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 解析 Excel V2: fileName={}, factoryId={}, dataType={}",
                    file.getOriginalFilename(), request.getFactoryId(), request.getDataType());

            RequestBody fileBody = RequestBody.create(
                    MediaType.parse("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                    file.getBytes()
            );

            MultipartBody.Builder bodyBuilder = new MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", file.getOriginalFilename(), fileBody);

            if (request.getFactoryId() != null) {
                bodyBuilder.addFormDataPart("factoryId", request.getFactoryId());
            }
            if (request.getDataType() != null) {
                bodyBuilder.addFormDataPart("dataType", request.getDataType());
            }
            if (request.getSheetName() != null) {
                bodyBuilder.addFormDataPart("sheetName", request.getSheetName());
            }
            if (request.getHeaderRow() != null) {
                bodyBuilder.addFormDataPart("headerRow", request.getHeaderRow().toString());
            }
            if (request.getAutoDetectType() != null) {
                bodyBuilder.addFormDataPart("autoDetectType", request.getAutoDetectType().toString());
            }
            if (request.getMaxRows() != null && request.getMaxRows() > 0) {
                bodyBuilder.addFormDataPart("maxRows", request.getMaxRows().toString());
            }

            Request httpRequest = new Request.Builder()
                    .url(config.getParseExcelUrl())
                    .post(bodyBuilder.build())
                    .build();

            PythonExcelParseResponse response = executeWithRetry(httpRequest, PythonExcelParseResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("Excel 解析 V2 失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== 新增：最小二乘法求解 ====================

    /**
     * 调用 Python 服务求解最小二乘问题
     *
     * @param matrixA        系数矩阵 A (m x n)
     * @param vectorB        目标向量 b (m x 1)
     * @param regularization 正则化参数
     * @return 求解结果，服务不可用时返回 empty
     */
    public Optional<PythonLeastSquaresResponse> solveLeastSquares(
            List<List<Double>> matrixA,
            List<Double> vectorB,
            double regularization) {

        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过最小二乘法求解");
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI 最小二乘法求解: matrixRows={}, matrixCols={}, vectorSize={}",
                    matrixA.size(),
                    matrixA.isEmpty() ? 0 : matrixA.get(0).size(),
                    vectorB.size());

            PythonLeastSquaresRequest request = PythonLeastSquaresRequest.builder()
                    .matrixA(matrixA)
                    .vectorB(vectorB)
                    .regularization(regularization)
                    .method("ridge")
                    .build();

            Request httpRequest = new Request.Builder()
                    .url(config.getLeastSquaresUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonLeastSquaresResponse response = executeWithRetry(httpRequest, PythonLeastSquaresResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("最小二乘法求解失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 便捷方法：从二维数组调用最小二乘法
     *
     * @param matrixA        系数矩阵 (double[][])
     * @param vectorB        目标向量 (double[])
     * @param regularization 正则化参数
     * @return 求解结果
     */
    public Optional<PythonLeastSquaresResponse> solveLeastSquares(
            double[][] matrixA,
            double[] vectorB,
            double regularization) {

        // 转换为 List
        List<List<Double>> matrix = new java.util.ArrayList<>();
        for (double[] row : matrixA) {
            List<Double> rowList = new java.util.ArrayList<>();
            for (double val : row) {
                rowList.add(val);
            }
            matrix.add(rowList);
        }

        List<Double> vector = new java.util.ArrayList<>();
        for (double val : vectorB) {
            vector.add(val);
        }

        return solveLeastSquares(matrix, vector, regularization);
    }

    // ==================== 分析服务 ====================

    /**
     * 获取财务概览
     *
     * @param data 财务数据
     * @return 财务概览结果
     */
    public Optional<PythonAnalysisResponse> getFinanceOverview(List<Map<String, Object>> data) {
        return callAnalysisEndpoint(config.getFinanceOverviewUrl(), PythonAnalysisRequest.of(data), "财务概览");
    }

    /**
     * 获取利润趋势
     *
     * @param data       财务数据
     * @param periodType 周期类型 (monthly, quarterly, yearly)
     * @return 利润趋势结果
     */
    public Optional<PythonAnalysisResponse> getProfitTrend(List<Map<String, Object>> data, String periodType) {
        return callAnalysisEndpoint(config.getProfitTrendUrl(),
                PythonAnalysisRequest.of(data, periodType), "利润趋势");
    }

    /**
     * 获取成本结构
     *
     * @param data 成本数据
     * @return 成本结构结果
     */
    public Optional<PythonAnalysisResponse> getCostStructure(List<Map<String, Object>> data) {
        return callAnalysisEndpoint(config.getCostStructureUrl(), PythonAnalysisRequest.of(data), "成本结构");
    }

    /**
     * 获取预算瀑布图数据
     *
     * @param data 预算数据
     * @return 瀑布图数据
     */
    public Optional<PythonAnalysisResponse> getBudgetWaterfall(List<Map<String, Object>> data) {
        return callAnalysisEndpoint(config.getBudgetWaterfallUrl(), PythonAnalysisRequest.of(data), "预算瀑布图");
    }

    /**
     * 获取预算对比实际
     *
     * @param data 预算和实际数据
     * @return 对比结果
     */
    public Optional<PythonAnalysisResponse> getBudgetVsActual(List<Map<String, Object>> data) {
        return callAnalysisEndpoint(config.getBudgetVsActualUrl(), PythonAnalysisRequest.of(data), "预算对比实际");
    }

    /**
     * 获取同比环比分析
     *
     * @param data       时间序列数据
     * @param periodType 周期类型
     * @return 同比环比结果
     */
    public Optional<PythonAnalysisResponse> getYoyMomComparison(List<Map<String, Object>> data, String periodType) {
        return callAnalysisEndpoint(config.getYoyMomUrl(),
                PythonAnalysisRequest.of(data, periodType), "同比环比分析");
    }

    /**
     * 获取销售 KPI
     *
     * @param data 销售数据
     * @return 销售 KPI 结果
     */
    public Optional<PythonAnalysisResponse> getSalesKpis(List<Map<String, Object>> data) {
        return callAnalysisEndpoint(config.getSalesKpisUrl(), PythonAnalysisRequest.of(data), "销售KPI");
    }

    /**
     * 获取销售员排名
     *
     * @param data 销售数据
     * @param topN 返回前 N 名
     * @return 销售员排名结果
     */
    public Optional<PythonAnalysisResponse> getSalespersonRanking(List<Map<String, Object>> data, int topN) {
        return callAnalysisEndpoint(config.getSalespersonRankingUrl(),
                PythonAnalysisRequest.ofRanking(data, topN), "销售员排名");
    }

    /**
     * 获取产品排名
     *
     * @param data 销售数据
     * @param topN 返回前 N 名
     * @return 产品排名结果
     */
    public Optional<PythonAnalysisResponse> getProductRanking(List<Map<String, Object>> data, int topN) {
        return callAnalysisEndpoint(config.getProductRankingUrl(),
                PythonAnalysisRequest.ofRanking(data, topN), "产品排名");
    }

    /**
     * 获取销售趋势
     *
     * @param data       销售数据
     * @param periodType 周期类型 (daily, weekly, monthly)
     * @return 销售趋势结果
     */
    public Optional<PythonAnalysisResponse> getSalesTrend(List<Map<String, Object>> data, String periodType) {
        return callAnalysisEndpoint(config.getSalesTrendUrl(),
                PythonAnalysisRequest.of(data, periodType), "销售趋势");
    }

    /**
     * 获取区域分布
     *
     * @param data 销售数据
     * @return 区域分布结果
     */
    public Optional<PythonAnalysisResponse> getRegionDistribution(List<Map<String, Object>> data) {
        return callAnalysisEndpoint(config.getRegionDistributionUrl(), PythonAnalysisRequest.of(data), "区域分布");
    }

    /**
     * 通用分析端点调用
     */
    private Optional<PythonAnalysisResponse> callAnalysisEndpoint(String url, PythonAnalysisRequest request, String operationName) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过{}", operationName);
            return Optional.empty();
        }

        try {
            log.info("调用 Python SmartBI {}: dataSize={}", operationName,
                    request.getData() != null ? request.getData().size() : 0);

            Request httpRequest = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            PythonAnalysisResponse response = executeWithRetry(httpRequest, PythonAnalysisResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("{}失败: {}", operationName, e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== Getter ====================

    /**
     * 获取配置
     */
    public PythonSmartBIConfig getConfig() {
        return config;
    }

    /**
     * 获取服务 URL
     */
    public String getServiceUrl() {
        return config.getUrl();
    }

    // ==================== 意图分类器 ====================

    /**
     * 调用 Python 意图分类服务
     *
     * @param text 待分类文本
     * @return 分类结果
     */
    public Optional<ClassifierResponse> classifyIntent(String text) {
        return classifyIntent(text, 3);
    }

    /**
     * 调用 Python 意图分类服务（指定 top-k）
     *
     * @param text 待分类文本
     * @param topK 返回 top-k 个结果
     * @return 分类结果
     */
    public Optional<ClassifierResponse> classifyIntent(String text, int topK) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过意图分类");
            return Optional.empty();
        }

        try {
            log.debug("调用 Python 意图分类: text='{}'", text);

            ClassifierRequest request = ClassifierRequest.of(text, topK);

            Request httpRequest = new Request.Builder()
                    .url(config.getClassifyUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            ClassifierResponse response = executeWithRetry(httpRequest, ClassifierResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("意图分类失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 批量意图分类
     *
     * @param texts 文本列表
     * @return 批量分类结果
     */
    public Optional<ClassifierBatchResponse> classifyIntentBatch(List<String> texts) {
        return classifyIntentBatch(texts, 1);
    }

    /**
     * 批量意图分类（指定 top-k）
     *
     * @param texts 文本列表
     * @param topK  每个文本返回 top-k 个结果
     * @return 批量分类结果
     */
    public Optional<ClassifierBatchResponse> classifyIntentBatch(List<String> texts, int topK) {
        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过批量意图分类");
            return Optional.empty();
        }

        try {
            log.debug("调用 Python 批量意图分类: count={}", texts.size());

            ClassifierRequest request = ClassifierRequest.ofBatch(texts, topK);

            Request httpRequest = new Request.Builder()
                    .url(config.getClassifyBatchUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            ClassifierBatchResponse response = executeWithRetry(httpRequest, ClassifierBatchResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("批量意图分类失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 检查分类器是否可用
     *
     * @return 分类器健康状态
     */
    public boolean isClassifierAvailable() {
        if (!config.isEnabled()) {
            return false;
        }

        try {
            Request request = new Request.Builder()
                    .url(config.getClassifierHealthUrl())
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    String body = response.body().string();
                    // 检查 model_loaded 字段
                    return body.contains("\"model_loaded\":true") || body.contains("\"model_loaded\": true");
                }
            }
        } catch (IOException e) {
            log.warn("分类器健康检查失败: {}", e.getMessage());
        }
        return false;
    }

    // ==================== LinUCB 计算 ====================

    /**
     * 调用 Python 计算 LinUCB UCB 值
     *
     * @param matrixA A 矩阵 (n x n)
     * @param vectorB b 向量 (n)
     * @param context 上下文特征向量 (n)
     * @param alpha   探索参数
     * @return UCB 计算结果
     */
    public Optional<LinUCBComputeResponse> computeLinUCB(
            double[][] matrixA,
            double[] vectorB,
            double[] context,
            double alpha) {

        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过 LinUCB UCB 计算");
            return Optional.empty();
        }

        try {
            log.debug("调用 Python LinUCB UCB 计算: contextDim={}", context.length);

            LinUCBComputeRequest request = LinUCBComputeRequest.builder()
                    .matrixA(toNestedList(matrixA))
                    .vectorB(toList(vectorB))
                    .context(toList(context))
                    .alpha(alpha)
                    .build();

            Request httpRequest = new Request.Builder()
                    .url(config.getLinucbComputeUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            LinUCBComputeResponse response = executeWithRetry(httpRequest, LinUCBComputeResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("LinUCB UCB 计算失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 调用 Python 更新 LinUCB 模型
     *
     * @param matrixA A 矩阵
     * @param vectorB b 向量
     * @param context 上下文特征
     * @param reward  观察到的奖励
     * @return 更新后的模型参数
     */
    public Optional<LinUCBUpdateResponse> updateLinUCBModel(
            double[][] matrixA,
            double[] vectorB,
            double[] context,
            double reward) {

        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过 LinUCB 模型更新");
            return Optional.empty();
        }

        try {
            log.debug("调用 Python LinUCB 模型更新: reward={}", reward);

            LinUCBUpdateRequest request = LinUCBUpdateRequest.builder()
                    .matrixA(toNestedList(matrixA))
                    .vectorB(toList(vectorB))
                    .context(toList(context))
                    .reward(reward)
                    .build();

            Request httpRequest = new Request.Builder()
                    .url(config.getLinucbUpdateUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            LinUCBUpdateResponse response = executeWithRetry(httpRequest, LinUCBUpdateResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("LinUCB 模型更新失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 批量计算多个工人的 LinUCB UCB 值
     *
     * @param matrixAList A 矩阵列表
     * @param vectorBList b 向量列表
     * @param context     共享上下文
     * @param alpha       探索参数
     * @return 批量计算结果
     */
    public Optional<LinUCBBatchResponse> batchComputeLinUCB(
            List<double[][]> matrixAList,
            List<double[]> vectorBList,
            double[] context,
            double alpha) {

        if (!config.isEnabled()) {
            log.debug("Python SmartBI 服务未启用，跳过 LinUCB 批量计算");
            return Optional.empty();
        }

        try {
            log.debug("调用 Python LinUCB 批量计算: workerCount={}", matrixAList.size());

            List<List<List<Double>>> matrixAListConverted = new java.util.ArrayList<>();
            for (double[][] matrix : matrixAList) {
                matrixAListConverted.add(toNestedList(matrix));
            }

            List<List<Double>> vectorBListConverted = new java.util.ArrayList<>();
            for (double[] vector : vectorBList) {
                vectorBListConverted.add(toList(vector));
            }

            LinUCBBatchRequest request = LinUCBBatchRequest.builder()
                    .matrixAList(matrixAListConverted)
                    .vectorBList(vectorBListConverted)
                    .context(toList(context))
                    .alpha(alpha)
                    .build();

            Request httpRequest = new Request.Builder()
                    .url(config.getLinucbBatchUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(request)))
                    .build();

            LinUCBBatchResponse response = executeWithRetry(httpRequest, LinUCBBatchResponse.class);
            return Optional.ofNullable(response);

        } catch (IOException e) {
            log.error("LinUCB 批量计算失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== 食品知识库 ====================

    /**
     * 食品知识库 RAG 查询
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> queryFoodKnowledge(String query, List<String> categories, int topK) {
        log.info("食品知识库查询: query={}, categories={}, topK={}", query, categories, topK);
        try {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("query", query);
            body.put("top_k", topK);
            body.put("similarity_threshold", 0.55);
            if (categories != null && !categories.isEmpty()) {
                body.put("categories", categories);
            }
            Request request = new Request.Builder()
                    .url(config.getFoodKbQueryUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(body)))
                    .build();
            return executeWithRetry(request, Map.class);
        } catch (IOException e) {
            log.error("食品知识库查询失败: {}", e.getMessage());
            Map<String, Object> errorResult = new java.util.HashMap<>();
            errorResult.put("success", false);
            errorResult.put("message", e.getMessage());
            return errorResult;
        }
    }

    /**
     * 食品知识库实体提取 (NER)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> extractFoodEntities(String text) {
        log.debug("食品知识库实体提取: text={}", text);
        try {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("text", text);
            body.put("use_model", true);
            Request request = new Request.Builder()
                    .url(config.getFoodKbExtractEntitiesUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(body)))
                    .build();
            return executeWithRetry(request, Map.class);
        } catch (IOException e) {
            log.warn("食品知识库实体提取失败: {}", e.getMessage());
            Map<String, Object> errorResult = new java.util.HashMap<>();
            errorResult.put("success", false);
            return errorResult;
        }
    }

    // ==================== 食品知识库反馈 ====================

    /**
     * 提交食品知识库反馈
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> submitFoodKBFeedback(Map<String, Object> feedbackRequest) {
        log.info("提交食品知识库反馈: query={}", feedbackRequest.get("query"));
        try {
            Request request = new Request.Builder()
                    .url(config.getFoodKbFeedbackSubmitUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(feedbackRequest)))
                    .build();
            return executeWithRetry(request, Map.class);
        } catch (IOException e) {
            log.error("提交食品知识库反馈失败: {}", e.getMessage());
            Map<String, Object> errorResult = new java.util.HashMap<>();
            errorResult.put("success", false);
            errorResult.put("message", e.getMessage());
            return errorResult;
        }
    }

    /**
     * 记录食品知识库查询日志
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> logFoodKBQuery(Map<String, Object> logRequest) {
        log.debug("记录食品知识库查询: query={}", logRequest.get("query"));
        try {
            Request request = new Request.Builder()
                    .url(config.getFoodKbFeedbackLogQueryUrl())
                    .post(RequestBody.create(JSON, objectMapper.writeValueAsString(logRequest)))
                    .build();
            return executeWithRetry(request, Map.class);
        } catch (IOException e) {
            log.warn("记录食品知识库查询日志失败（非致命）: {}", e.getMessage());
            Map<String, Object> errorResult = new java.util.HashMap<>();
            errorResult.put("success", false);
            return errorResult;
        }
    }

    /**
     * 获取食品知识库反馈统计
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getFoodKBFeedbackStats() {
        log.info("获取食品知识库反馈统计");
        try {
            Request request = new Request.Builder()
                    .url(config.getFoodKbFeedbackStatsUrl())
                    .get()
                    .build();
            return executeWithRetry(request, Map.class);
        } catch (IOException e) {
            log.error("获取食品知识库反馈统计失败: {}", e.getMessage());
            Map<String, Object> errorResult = new java.util.HashMap<>();
            errorResult.put("success", false);
            errorResult.put("message", e.getMessage());
            return errorResult;
        }
    }

    // ==================== 辅助转换方法 ====================

    /**
     * 将 double[][] 转换为 List<List<Double>>
     */
    private List<List<Double>> toNestedList(double[][] matrix) {
        List<List<Double>> result = new java.util.ArrayList<>();
        for (double[] row : matrix) {
            result.add(toList(row));
        }
        return result;
    }

    /**
     * 将 double[] 转换为 List<Double>
     */
    private List<Double> toList(double[] array) {
        List<Double> result = new java.util.ArrayList<>();
        for (double val : array) {
            result.add(val);
        }
        return result;
    }
}
