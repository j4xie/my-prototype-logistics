package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * Python Intent Classifier 服务配置
 *
 * 配置 Python 意图分类器服务的连接参数：
 * - enabled: 是否启用分类器服务
 * - url: Python 服务地址 (python-services 端口 8083)
 * - timeout: 请求超时时间
 * - weight: 分类器在融合评分中的权重
 *
 * 支持的端点：
 * - /api/classifier/classify: 单文本分类
 * - /api/classifier/classify/batch: 批量分类
 * - /api/classifier/confidence: 特定意图置信度
 * - /api/classifier/info: 模型信息
 * - /api/classifier/health: 健康检查
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-26
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "python-classifier")
public class PythonClassifierConfig {

    /**
     * 是否启用 Python 分类器服务
     */
    private boolean enabled = true;

    /**
     * Python 服务 URL (使用统一的 python-services)
     */
    private String url = "http://localhost:8083";

    /**
     * 请求超时时间（毫秒）
     */
    private int timeout = 10000;

    /**
     * 连接超时时间（毫秒）
     */
    private int connectTimeout = 3000;

    /**
     * 最大重试次数
     */
    private int maxRetries = 1;

    /**
     * 健康检查间隔（毫秒）
     */
    private long healthCheckInterval = 30000;

    /**
     * 分类器在融合评分中的权重
     * 默认 0.5，高于短语匹配(0.3)和语义匹配(0.2)
     */
    private double weight = 0.5;

    /**
     * 返回的 Top-K 结果数
     */
    private int topK = 5;

    /**
     * 最小置信度阈值
     */
    private double minConfidence = 0.1;

    // ==================== API 端点配置 ====================

    /**
     * 健康检查端点
     */
    private String healthEndpoint = "/api/classifier/health";

    /**
     * 单文本分类端点
     */
    private String classifyEndpoint = "/api/classifier/classify";

    /**
     * 批量分类端点
     */
    private String batchClassifyEndpoint = "/api/classifier/classify/batch";

    /**
     * 意图置信度端点
     */
    private String confidenceEndpoint = "/api/classifier/confidence";

    /**
     * 模型信息端点
     */
    private String infoEndpoint = "/api/classifier/info";

    @PostConstruct
    public void init() {
        log.info("Python Classifier 配置加载完成:");
        log.info("  - enabled: {}", enabled);
        log.info("  - url: {}", url);
        log.info("  - timeout: {}ms", timeout);
        log.info("  - connectTimeout: {}ms", connectTimeout);
        log.info("  - weight: {}", weight);
        log.info("  - topK: {}", topK);
        log.info("  - minConfidence: {}", minConfidence);
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
     * 获取分类 URL
     */
    public String getClassifyUrl() {
        return getFullUrl(classifyEndpoint);
    }

    /**
     * 获取批量分类 URL
     */
    public String getBatchClassifyUrl() {
        return getFullUrl(batchClassifyEndpoint);
    }

    /**
     * 获取置信度检查 URL
     */
    public String getConfidenceUrl() {
        return getFullUrl(confidenceEndpoint);
    }

    /**
     * 获取模型信息 URL
     */
    public String getInfoUrl() {
        return getFullUrl(infoEndpoint);
    }
}
