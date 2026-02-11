package com.cretas.aims.config.efficiency;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * Python 效率识别服务配置
 *
 * 配置 Python 效率识别服务的连接参数：
 * - enabled: 是否启用 Python 服务
 * - url: Python 服务地址
 * - timeout: 请求超时时间
 *
 * 支持的端点：
 * - /health: 健康检查
 * - /api/efficiency/analyze-frame: 单帧分析
 * - /api/efficiency/analyze: 统一分析入口（效率+OCR+计数）
 * - /api/efficiency/streams/*: 多摄像头流管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-30
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "python-efficiency")
public class PythonEfficiencyConfig {

    /**
     * 是否启用 Python 效率识别服务
     */
    private boolean enabled = true;

    /**
     * Python 服务 URL
     */
    private String url = "http://localhost:8083";

    /**
     * 请求超时时间（毫秒）
     */
    private int timeout = 60000;

    /**
     * 连接超时时间（毫秒）
     */
    private int connectTimeout = 5000;

    /**
     * 健康检查间隔（毫秒）
     */
    private int healthCheckInterval = 30000;

    /**
     * 最大重试次数
     */
    private int maxRetries = 2;

    /**
     * 是否在 ISAPI 事件触发时自动分析
     */
    private boolean autoAnalyzeOnEvent = true;

    /**
     * 事件分析的冷却时间（秒）- 同一设备连续事件的最小间隔
     */
    private int eventCooldownSeconds = 30;

    /**
     * 默认工厂ID（用于事件触发时）
     */
    private String defaultFactoryId = "F001";

    // ==================== API 端点配置 ====================

    /**
     * 健康检查端点
     */
    private String healthEndpoint = "/api/efficiency/health";

    /**
     * 单帧分析端点
     */
    private String analyzeFrameEndpoint = "/api/efficiency/analyze-frame";

    /**
     * 统一分析端点（支持效率+OCR+计数）
     */
    private String analyzeEndpoint = "/api/efficiency/analyze";

    /**
     * 添加流端点
     */
    private String addStreamEndpoint = "/api/efficiency/streams/add";

    /**
     * 批量添加流端点
     */
    private String batchAddStreamEndpoint = "/api/efficiency/streams/batch-add";

    /**
     * 移除流端点
     */
    private String removeStreamEndpoint = "/api/efficiency/streams/remove";

    /**
     * 流状态端点
     */
    private String streamStatusEndpoint = "/api/efficiency/streams/status";

    /**
     * 成本概览端点
     */
    private String costSummaryEndpoint = "/api/efficiency/cost/summary";

    @PostConstruct
    public void init() {
        log.info("Python 效率识别配置加载完成:");
        log.info("  - enabled: {}", enabled);
        log.info("  - url: {}", url);
        log.info("  - timeout: {}ms", timeout);
        log.info("  - autoAnalyzeOnEvent: {}", autoAnalyzeOnEvent);
        log.info("  - eventCooldownSeconds: {}s", eventCooldownSeconds);
    }

    /**
     * 检查服务是否可用
     */
    public boolean isAvailable() {
        return enabled && url != null && !url.isEmpty();
    }

    /**
     * 获取完整的端点 URL
     */
    public String getFullUrl(String endpoint) {
        String baseUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        String path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
        return baseUrl + path;
    }

    public String getHealthUrl() {
        return getFullUrl(healthEndpoint);
    }

    public String getAnalyzeFrameUrl() {
        return getFullUrl(analyzeFrameEndpoint);
    }

    public String getAnalyzeUrl() {
        return getFullUrl(analyzeEndpoint);
    }

    public String getAddStreamUrl() {
        return getFullUrl(addStreamEndpoint);
    }

    public String getBatchAddStreamUrl() {
        return getFullUrl(batchAddStreamEndpoint);
    }

    public String getRemoveStreamUrl() {
        return getFullUrl(removeStreamEndpoint);
    }

    public String getStreamStatusUrl() {
        return getFullUrl(streamStatusEndpoint);
    }

    public String getCostSummaryUrl() {
        return getFullUrl(costSummaryEndpoint);
    }
}
