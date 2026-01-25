package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * Python Error Analysis 服务配置
 *
 * 配置 Python 错误分析服务的连接参数和降级策略：
 * - enabled: 是否启用 Python 服务
 * - url: Python 服务地址
 * - timeout: 请求超时时间
 * - fallbackOnError: 错误时是否降级
 *
 * 支持的端点：
 * - /health: 健康检查
 * - /api/analysis/aggregate-daily: 日维度聚合统计
 * - /api/analysis/identify-failure-patterns: 失败模式识别
 * - /api/analysis/extract-keywords: 关键词提取
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "python-error-analysis")
public class PythonErrorAnalysisConfig {

    /**
     * 是否启用 Python Error Analysis 服务
     */
    private boolean enabled = true;

    /**
     * Python 服务 URL
     */
    private String url = "http://localhost:8082";

    /**
     * 请求超时时间（毫秒）
     */
    private int timeout = 30000;

    /**
     * 连接超时时间（毫秒）
     */
    private int connectTimeout = 5000;

    /**
     * 错误时是否降级
     */
    private boolean fallbackOnError = true;

    /**
     * 最大重试次数
     */
    private int maxRetries = 2;

    /**
     * 健康检查间隔（毫秒）
     */
    private long healthCheckInterval = 30000;

    // ==================== API 端点配置 ====================

    /**
     * 健康检查端点
     */
    private String healthEndpoint = "/health";

    /**
     * 日维度聚合统计端点
     */
    private String aggregateDailyEndpoint = "/api/analysis/aggregate-daily";

    /**
     * 失败模式识别端点
     */
    private String failurePatternsEndpoint = "/api/analysis/identify-failure-patterns";

    /**
     * 关键词提取端点
     */
    private String extractKeywordsEndpoint = "/api/analysis/extract-keywords";

    @PostConstruct
    public void init() {
        log.info("Python Error Analysis 配置加载完成:");
        log.info("  - enabled: {}", enabled);
        log.info("  - url: {}", url);
        log.info("  - timeout: {}ms", timeout);
        log.info("  - connectTimeout: {}ms", connectTimeout);
        log.info("  - fallbackOnError: {}", fallbackOnError);
        log.info("  - maxRetries: {}", maxRetries);
    }

    /**
     * 检查服务是否可用
     */
    public boolean isAvailable() {
        return enabled && url != null && !url.isEmpty();
    }

    /**
     * 获取完整的端点 URL
     *
     * @param endpoint 端点路径
     * @return 完整 URL
     */
    public String getFullUrl(String endpoint) {
        String baseUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        String path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
        return baseUrl + path;
    }

    /**
     * 获取健康检查 URL
     */
    public String getHealthUrl() {
        return getFullUrl(healthEndpoint);
    }

    /**
     * 获取日维度聚合统计 URL
     */
    public String getAggregateDailyUrl() {
        return getFullUrl(aggregateDailyEndpoint);
    }

    /**
     * 获取失败模式识别 URL
     */
    public String getFailurePatternsUrl() {
        return getFullUrl(failurePatternsEndpoint);
    }

    /**
     * 获取关键词提取 URL
     */
    public String getExtractKeywordsUrl() {
        return getFullUrl(extractKeywordsEndpoint);
    }
}
