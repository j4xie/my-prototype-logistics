package com.cretas.aims.config.smartbi;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * Python SmartBI 服务配置
 *
 * 配置 Python SmartBI 服务的连接参数和降级策略：
 * - enabled: 是否启用 Python 服务
 * - url: Python 服务地址
 * - timeout: 请求超时时间
 * - fallbackOnError: 错误时是否降级到 Java 实现
 *
 * 支持的端点：
 * - /health: 健康检查
 * - /api/smartbi/excel/parse: Excel 解析
 * - /api/smartbi/fields/detect: 字段检测
 * - /api/smartbi/fields/map: 字段映射 (LLM)
 * - /api/smartbi/chart/config: 图表配置推荐
 * - /api/smartbi/metrics/calculate: 指标计算
 * - /api/smartbi/forecast: 预测分析
 * - /api/smartbi/insight/generate: AI 洞察生成
 * - /api/smartbi/chart/build: 图表构建
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-24
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "python-smartbi")
public class PythonSmartBIConfig {

    /**
     * 是否启用 Python SmartBI 服务
     */
    private boolean enabled = false;

    /**
     * Python 服务 URL
     */
    private String url = "http://localhost:8081";

    /**
     * 请求超时时间（毫秒）
     */
    private int timeout = 30000;

    /**
     * 连接超时时间（毫秒）
     */
    private int connectTimeout = 5000;

    /**
     * 错误时是否降级到 Java 实现
     */
    private boolean fallbackOnError = true;

    /**
     * 健康检查间隔（毫秒）
     */
    private int healthCheckInterval = 30000;

    /**
     * 最大重试次数
     */
    private int maxRetries = 2;

    // ==================== API 端点配置 ====================

    /**
     * 健康检查端点
     */
    private String healthEndpoint = "/health";

    /**
     * Excel 解析端点
     */
    private String parseExcelEndpoint = "/api/excel/parse";

    /**
     * 字段检测端点
     */
    private String detectFieldsEndpoint = "/api/field/detect";

    /**
     * 字段映射端点 (LLM)
     */
    private String mapFieldsEndpoint = "/api/field/map-with-llm";

    /**
     * 图表配置端点
     */
    private String chartConfigEndpoint = "/api/chart/recommend";

    /**
     * 指标计算端点
     */
    private String calculateMetricsEndpoint = "/api/metrics/calculate";

    /**
     * 批量指标计算端点
     */
    private String calculateAllMetricsEndpoint = "/api/metrics/batch";

    /**
     * 预测端点
     */
    private String forecastEndpoint = "/api/forecast/predict";

    /**
     * AI 洞察端点
     */
    private String insightEndpoint = "/api/insight/generate";

    /**
     * 图表构建端点
     */
    private String buildChartEndpoint = "/api/chart/build";

    /**
     * 最小二乘法端点
     */
    private String leastSquaresEndpoint = "/api/ml/least-squares";

    // ==================== 分析服务端点 ====================

    /**
     * 财务概览端点
     */
    private String financeOverviewEndpoint = "/api/analysis/finance/overview";

    /**
     * 利润趋势端点
     */
    private String profitTrendEndpoint = "/api/analysis/finance/profit-trend";

    /**
     * 成本结构端点
     */
    private String costStructureEndpoint = "/api/analysis/finance/cost-structure";

    /**
     * 预算瀑布图端点
     */
    private String budgetWaterfallEndpoint = "/api/analysis/finance/budget-waterfall";

    /**
     * 预算对比实际端点
     */
    private String budgetVsActualEndpoint = "/api/analysis/finance/budget-vs-actual";

    /**
     * 同比环比端点
     */
    private String yoyMomEndpoint = "/api/analysis/finance/yoy-mom";

    /**
     * 销售 KPI 端点
     */
    private String salesKpisEndpoint = "/api/analysis/sales/kpis";

    /**
     * 销售员排名端点
     */
    private String salespersonRankingEndpoint = "/api/analysis/sales/ranking/salesperson";

    /**
     * 产品排名端点
     */
    private String productRankingEndpoint = "/api/analysis/sales/ranking/product";

    /**
     * 销售趋势端点
     */
    private String salesTrendEndpoint = "/api/analysis/sales/trend";

    /**
     * 区域分布端点
     */
    private String regionDistributionEndpoint = "/api/analysis/sales/region-distribution";

    @PostConstruct
    public void init() {
        log.info("Python SmartBI 配置加载完成:");
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
     * 获取 Excel 解析 URL
     */
    public String getParseExcelUrl() {
        return getFullUrl(parseExcelEndpoint);
    }

    /**
     * 获取字段检测 URL
     */
    public String getDetectFieldsUrl() {
        return getFullUrl(detectFieldsEndpoint);
    }

    /**
     * 获取字段映射 URL
     */
    public String getMapFieldsUrl() {
        return getFullUrl(mapFieldsEndpoint);
    }

    /**
     * 获取图表配置 URL
     */
    public String getChartConfigUrl() {
        return getFullUrl(chartConfigEndpoint);
    }

    /**
     * 获取指标计算 URL
     */
    public String getCalculateMetricsUrl() {
        return getFullUrl(calculateMetricsEndpoint);
    }

    /**
     * 获取批量指标计算 URL
     */
    public String getCalculateAllMetricsUrl() {
        return getFullUrl(calculateAllMetricsEndpoint);
    }

    /**
     * 获取预测 URL
     */
    public String getForecastUrl() {
        return getFullUrl(forecastEndpoint);
    }

    /**
     * 获取 AI 洞察 URL
     */
    public String getInsightUrl() {
        return getFullUrl(insightEndpoint);
    }

    /**
     * 获取图表构建 URL
     */
    public String getBuildChartUrl() {
        return getFullUrl(buildChartEndpoint);
    }

    /**
     * 获取最小二乘法 URL
     */
    public String getLeastSquaresUrl() {
        return getFullUrl(leastSquaresEndpoint);
    }

    // ==================== 分析服务 URL ====================

    /**
     * 获取财务概览 URL
     */
    public String getFinanceOverviewUrl() {
        return getFullUrl(financeOverviewEndpoint);
    }

    /**
     * 获取利润趋势 URL
     */
    public String getProfitTrendUrl() {
        return getFullUrl(profitTrendEndpoint);
    }

    /**
     * 获取成本结构 URL
     */
    public String getCostStructureUrl() {
        return getFullUrl(costStructureEndpoint);
    }

    /**
     * 获取预算瀑布图 URL
     */
    public String getBudgetWaterfallUrl() {
        return getFullUrl(budgetWaterfallEndpoint);
    }

    /**
     * 获取预算对比实际 URL
     */
    public String getBudgetVsActualUrl() {
        return getFullUrl(budgetVsActualEndpoint);
    }

    /**
     * 获取同比环比 URL
     */
    public String getYoyMomUrl() {
        return getFullUrl(yoyMomEndpoint);
    }

    /**
     * 获取销售 KPI URL
     */
    public String getSalesKpisUrl() {
        return getFullUrl(salesKpisEndpoint);
    }

    /**
     * 获取销售员排名 URL
     */
    public String getSalespersonRankingUrl() {
        return getFullUrl(salespersonRankingEndpoint);
    }

    /**
     * 获取产品排名 URL
     */
    public String getProductRankingUrl() {
        return getFullUrl(productRankingEndpoint);
    }

    /**
     * 获取销售趋势 URL
     */
    public String getSalesTrendUrl() {
        return getFullUrl(salesTrendEndpoint);
    }

    /**
     * 获取区域分布 URL
     */
    public String getRegionDistributionUrl() {
        return getFullUrl(regionDistributionEndpoint);
    }
}
