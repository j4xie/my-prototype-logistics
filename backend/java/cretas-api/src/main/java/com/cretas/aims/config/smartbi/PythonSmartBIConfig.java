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
 * - /api/excel/auto-parse: Excel 智能解析（零代码自动检测表头、字段映射）
 * - /api/excel/list-sheets: 获取 Excel Sheet 列表
 * - /api/field/detect: 字段检测
 * - /api/field/map-with-llm: 字段映射 (LLM)
 * - /api/smartbi/chart/config: 图表配置推荐
 * - /api/smartbi/metrics/calculate: 指标计算
 * - /api/smartbi/forecast: 预测分析
 * - /api/smartbi/insight/generate: AI 洞察生成
 * - /api/smartbi/chart/build: 图表构建
 *
 * @author Cretas Team
 * @version 1.2.0
 * @since 2026-02-05
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
     * 注意：已禁用 Java fallback，所有 SmartBI 功能完全由 Python 服务处理
     */
    private boolean fallbackOnError = false;

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
     * Excel 智能解析端点 (主力)
     * 零代码自动检测表头结构、字段映射
     * 参数：sheet_name, sheetIndex, transpose, header_rows_override
     */
    private String parseExcelEndpoint = "/api/excel/auto-parse";

    /**
     * Excel Sheet 列表端点
     * 获取 Excel 文件中所有 Sheet 的基本信息
     */
    private String listSheetsEndpoint = "/api/excel/list-sheets";

    /**
     * Excel 规则优先解析端点 (保留，用于特殊场景)
     * 使用规则优先的解析策略，适用于已知格式的文件
     */
    private String smartParseEndpoint = "/api/excel/smart-parse";

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

    /**
     * LinUCB UCB 计算端点
     */
    private String linucbComputeEndpoint = "/api/linucb/compute-ucb";

    /**
     * LinUCB 模型更新端点
     */
    private String linucbUpdateEndpoint = "/api/linucb/update-model";

    /**
     * LinUCB 批量计算端点
     */
    private String linucbBatchEndpoint = "/api/linucb/batch-compute";

    // ==================== 意图分类器端点 ====================

    /**
     * 意图分类端点
     */
    private String classifyEndpoint = "/api/classifier/classify";

    /**
     * 批量意图分类端点
     */
    private String classifyBatchEndpoint = "/api/classifier/classify/batch";

    /**
     * 分类器信息端点
     */
    private String classifierInfoEndpoint = "/api/classifier/info";

    /**
     * 分类器健康检查端点
     */
    private String classifierHealthEndpoint = "/api/classifier/health";

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

    /**
     * 财务数据提取端点
     */
    private String extractFinanceEndpoint = "/api/finance/extract";

    /**
     * 食品知识库查询端点 (RAG)
     */
    private String foodKbQueryEndpoint = "/api/food-kb/query";

    /**
     * 食品知识库实体提取端点 (NER)
     */
    private String foodKbExtractEntitiesEndpoint = "/api/food-kb/extract-entities";

    /**
     * 食品知识库实体查找端点
     */
    private String foodKbEntityLookupEndpoint = "/api/food-kb/entity-lookup";

    /**
     * 食品知识库反馈提交端点
     */
    private String foodKbFeedbackSubmitEndpoint = "/api/food-kb/feedback";

    /**
     * 食品知识库查询日志端点
     */
    private String foodKbFeedbackLogQueryEndpoint = "/api/food-kb/feedback/log-query";

    /**
     * 食品知识库反馈统计端点
     */
    private String foodKbFeedbackStatsEndpoint = "/api/food-kb/feedback/stats";

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
     * 获取 Excel 智能解析 URL (主力端点)
     */
    public String getParseExcelUrl() {
        return getFullUrl(parseExcelEndpoint);
    }

    /**
     * 获取 Excel Sheet 列表 URL
     */
    public String getListSheetsUrl() {
        return getFullUrl(listSheetsEndpoint);
    }

    /**
     * 获取 Excel 规则优先解析 URL
     */
    public String getSmartParseUrl() {
        return getFullUrl(smartParseEndpoint);
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

    /**
     * 获取 LinUCB UCB 计算 URL
     */
    public String getLinucbComputeUrl() {
        return getFullUrl(linucbComputeEndpoint);
    }

    /**
     * 获取 LinUCB 模型更新 URL
     */
    public String getLinucbUpdateUrl() {
        return getFullUrl(linucbUpdateEndpoint);
    }

    /**
     * 获取 LinUCB 批量计算 URL
     */
    public String getLinucbBatchUrl() {
        return getFullUrl(linucbBatchEndpoint);
    }

    // ==================== 意图分类器 URL ====================

    /**
     * 获取意图分类 URL
     */
    public String getClassifyUrl() {
        return getFullUrl(classifyEndpoint);
    }

    /**
     * 获取批量意图分类 URL
     */
    public String getClassifyBatchUrl() {
        return getFullUrl(classifyBatchEndpoint);
    }

    /**
     * 获取分类器信息 URL
     */
    public String getClassifierInfoUrl() {
        return getFullUrl(classifierInfoEndpoint);
    }

    /**
     * 获取分类器健康检查 URL
     */
    public String getClassifierHealthUrl() {
        return getFullUrl(classifierHealthEndpoint);
    }

    /**
     * 获取财务数据提取 URL
     */
    public String getExtractFinanceUrl() {
        return getFullUrl(extractFinanceEndpoint);
    }

    /**
     * 获取食品知识库查询 URL (RAG)
     */
    public String getFoodKbQueryUrl() {
        return getFullUrl(foodKbQueryEndpoint);
    }

    /**
     * 获取食品知识库实体提取 URL (NER)
     */
    public String getFoodKbExtractEntitiesUrl() {
        return getFullUrl(foodKbExtractEntitiesEndpoint);
    }

    /**
     * 获取食品知识库实体查找 URL
     */
    public String getFoodKbEntityLookupUrl() {
        return getFullUrl(foodKbEntityLookupEndpoint);
    }

    /**
     * 获取食品知识库反馈提交 URL
     */
    public String getFoodKbFeedbackSubmitUrl() {
        return getFullUrl(foodKbFeedbackSubmitEndpoint);
    }

    /**
     * 获取食品知识库查询日志 URL
     */
    public String getFoodKbFeedbackLogQueryUrl() {
        return getFullUrl(foodKbFeedbackLogQueryEndpoint);
    }

    /**
     * 获取食品知识库反馈统计 URL
     */
    public String getFoodKbFeedbackStatsUrl() {
        return getFullUrl(foodKbFeedbackStatsEndpoint);
    }
}
