package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.AIInsight;
import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.service.smartbi.SmartBIPromptService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * SmartBI Prompt 服务实现
 *
 * 提供 AI 分析所需的 Prompt 模板管理和填充功能。
 * 模板文件存储在 resources/prompts/smartbi/ 目录下，使用 Markdown 格式。
 *
 * 主要功能：
 * - 启动时加载所有模板到内存缓存
 * - 支持 {{variable}} 格式的占位符替换
 * - 支持嵌套对象访问（如 {{data.kpi.sales}}）
 * - 自动将复杂对象序列化为 JSON
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
public class SmartBIPromptServiceImpl implements SmartBIPromptService {

    // ==================== 常量定义 ====================

    /**
     * 模板资源路径前缀
     */
    private static final String TEMPLATE_PATH_PREFIX = "prompts/smartbi/";

    /**
     * 模板文件后缀
     */
    private static final String TEMPLATE_FILE_SUFFIX = ".md";

    /**
     * 占位符正则模式：匹配 {{variable}} 或 {{object.property}}
     */
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{([a-zA-Z_][a-zA-Z0-9_.]*?)\\}\\}");

    /**
     * 支持的分析类型与模板文件映射
     */
    private static final Map<String, String> ANALYSIS_TYPE_TO_TEMPLATE = Map.of(
            "OVERVIEW", "overview_analysis",
            "SALES", "sales_analysis",
            "DEPARTMENT", "department_analysis",
            "REGION", "region_analysis",
            "FINANCE", "finance_analysis",
            "QA", "qa_general"
    );

    // ==================== 依赖注入 ====================

    /**
     * JSON 序列化器
     */
    private final ObjectMapper objectMapper;

    /**
     * 模板缓存：分析类型 -> 模板内容
     */
    private final Map<String, String> templateCache = new ConcurrentHashMap<>();

    // ==================== 构造器 ====================

    /**
     * 构造函数，初始化 ObjectMapper
     */
    public SmartBIPromptServiceImpl() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    // ==================== 初始化 ====================

    /**
     * 服务初始化，加载所有模板到缓存
     */
    @PostConstruct
    public void init() {
        log.info("初始化 SmartBI Prompt 服务，开始加载模板...");
        loadAllTemplates();
        log.info("SmartBI Prompt 服务初始化完成，已加载 {} 个模板", templateCache.size());
    }

    /**
     * 加载所有模板文件到缓存
     */
    private void loadAllTemplates() {
        for (Map.Entry<String, String> entry : ANALYSIS_TYPE_TO_TEMPLATE.entrySet()) {
            String analysisType = entry.getKey();
            String templateName = entry.getValue();
            try {
                String templateContent = loadTemplateFromResource(templateName);
                if (templateContent != null && !templateContent.isEmpty()) {
                    templateCache.put(analysisType.toUpperCase(), templateContent);
                    log.debug("已加载模板: {} -> {}", analysisType, templateName);
                } else {
                    log.warn("模板内容为空: {}", templateName);
                }
            } catch (Exception e) {
                log.error("加载模板失败: {} - {}", templateName, e.getMessage());
            }
        }
    }

    /**
     * 从资源文件加载模板
     *
     * @param templateName 模板名称（不含后缀）
     * @return 模板内容字符串
     */
    private String loadTemplateFromResource(String templateName) {
        String resourcePath = TEMPLATE_PATH_PREFIX + templateName + TEMPLATE_FILE_SUFFIX;
        try {
            ClassPathResource resource = new ClassPathResource(resourcePath);
            if (!resource.exists()) {
                log.warn("模板文件不存在: {}", resourcePath);
                return null;
            }
            try (InputStream inputStream = resource.getInputStream()) {
                String content = StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
                log.debug("成功加载模板: {}, 长度: {} 字符", resourcePath, content.length());
                return content;
            }
        } catch (IOException e) {
            log.error("读取模板文件失败: {} - {}", resourcePath, e.getMessage());
            return null;
        }
    }

    // ==================== 模板管理接口实现 ====================

    @Override
    public String getPromptTemplate(String analysisType) {
        if (analysisType == null || analysisType.isEmpty()) {
            log.warn("分析类型为空");
            return null;
        }
        String template = templateCache.get(analysisType.toUpperCase());
        if (template == null) {
            log.warn("未找到分析类型对应的模板: {}", analysisType);
        }
        return template;
    }

    @Override
    public String fillPromptTemplate(String analysisType, Map<String, Object> data) {
        String template = getPromptTemplate(analysisType);
        if (template == null) {
            throw new IllegalArgumentException("未找到分析类型对应的模板: " + analysisType);
        }
        return replacePlaceholders(template, data);
    }

    @Override
    public boolean hasTemplate(String analysisType) {
        return analysisType != null && templateCache.containsKey(analysisType.toUpperCase());
    }

    @Override
    public List<String> getSupportedAnalysisTypes() {
        return new ArrayList<>(ANALYSIS_TYPE_TO_TEMPLATE.keySet());
    }

    @Override
    public void refreshTemplateCache() {
        log.info("刷新模板缓存...");
        templateCache.clear();
        loadAllTemplates();
        log.info("模板缓存刷新完成，已加载 {} 个模板", templateCache.size());
    }

    // ==================== 各类分析 Prompt 生成 ====================

    @Override
    public String getOverviewAnalysisPrompt(DashboardResponse dashboard) {
        log.debug("生成经营概览分析 Prompt");

        Map<String, Object> data = new LinkedHashMap<>();

        // KPI 数据
        if (dashboard.getKpiCards() != null) {
            data.put("kpi_data", formatKpiCardsFromKPICard(dashboard.getKpiCards()));
            data.put("kpi_json", serializeToJson(dashboard.getKpiCards()));
        }

        // 图表数据
        if (dashboard.getCharts() != null) {
            data.put("chart_data", formatCharts(new ArrayList<>(dashboard.getCharts().values())));
            data.put("chart_json", serializeToJson(dashboard.getCharts()));
        }

        // 排名数据
        if (dashboard.getRankings() != null) {
            List<RankingItem> flattenedRankings = dashboard.getRankings().values().stream()
                    .flatMap(List::stream)
                    .collect(Collectors.toList());
            data.put("ranking_data", formatRankings(flattenedRankings));
            data.put("ranking_json", serializeToJson(dashboard.getRankings()));
        }

        // 现有洞察
        if (dashboard.getAiInsights() != null) {
            data.put("existing_insights", formatInsights(dashboard.getAiInsights()));
        }

        // 现有建议
        if (dashboard.getSuggestions() != null) {
            data.put("existing_suggestions", String.join("\n", dashboard.getSuggestions()));
        }

        // 更新时间
        if (dashboard.getLastUpdated() != null) {
            data.put("last_updated", dashboard.getLastUpdated().toString());
        }

        // 当前时间
        data.put("current_time", java.time.LocalDateTime.now().toString());

        return fillPromptTemplate("OVERVIEW", data);
    }

    @Override
    public String getSalesAnalysisPrompt(Map<String, Object> salesData) {
        log.debug("生成销售分析 Prompt");

        Map<String, Object> data = new LinkedHashMap<>();

        // 处理各类销售数据
        if (salesData.containsKey("kpiCards")) {
            Object kpiCards = salesData.get("kpiCards");
            if (kpiCards instanceof List) {
                @SuppressWarnings("unchecked")
                List<MetricResult> kpiList = (List<MetricResult>) kpiCards;
                data.put("kpi_data", formatKpiCards(kpiList));
                data.put("kpi_json", serializeToJson(kpiList));
            }
        }

        if (salesData.containsKey("trendData")) {
            data.put("trend_data", serializeToJson(salesData.get("trendData")));
        }

        if (salesData.containsKey("rankings")) {
            Object rankings = salesData.get("rankings");
            if (rankings instanceof List) {
                @SuppressWarnings("unchecked")
                List<RankingItem> rankingList = (List<RankingItem>) rankings;
                data.put("ranking_data", formatRankings(rankingList));
                data.put("ranking_json", serializeToJson(rankingList));
            }
        }

        if (salesData.containsKey("productDistribution")) {
            data.put("product_distribution", serializeToJson(salesData.get("productDistribution")));
        }

        if (salesData.containsKey("customerData")) {
            data.put("customer_data", serializeToJson(salesData.get("customerData")));
        }

        // 时间范围
        if (salesData.containsKey("startDate")) {
            data.put("start_date", salesData.get("startDate").toString());
        }
        if (salesData.containsKey("endDate")) {
            data.put("end_date", salesData.get("endDate").toString());
        }

        data.put("current_time", java.time.LocalDateTime.now().toString());

        return fillPromptTemplate("SALES", data);
    }

    @Override
    public String getDepartmentAnalysisPrompt(Map<String, Object> deptData) {
        log.debug("生成部门分析 Prompt");

        Map<String, Object> data = new LinkedHashMap<>();

        if (deptData.containsKey("departmentList")) {
            data.put("department_list", serializeToJson(deptData.get("departmentList")));
        }

        if (deptData.containsKey("deptMetrics")) {
            data.put("dept_metrics", serializeToJson(deptData.get("deptMetrics")));
        }

        if (deptData.containsKey("memberPerformance")) {
            data.put("member_performance", serializeToJson(deptData.get("memberPerformance")));
        }

        if (deptData.containsKey("targetCompletion")) {
            data.put("target_completion", serializeToJson(deptData.get("targetCompletion")));
        }

        if (deptData.containsKey("comparisonData")) {
            data.put("comparison_data", serializeToJson(deptData.get("comparisonData")));
        }

        data.put("current_time", java.time.LocalDateTime.now().toString());

        return fillPromptTemplate("DEPARTMENT", data);
    }

    @Override
    public String getRegionAnalysisPrompt(Map<String, Object> regionData) {
        log.debug("生成区域分析 Prompt");

        Map<String, Object> data = new LinkedHashMap<>();

        if (regionData.containsKey("regionList")) {
            data.put("region_list", serializeToJson(regionData.get("regionList")));
        }

        if (regionData.containsKey("regionMetrics")) {
            data.put("region_metrics", serializeToJson(regionData.get("regionMetrics")));
        }

        if (regionData.containsKey("distributionData")) {
            data.put("distribution_data", serializeToJson(regionData.get("distributionData")));
        }

        if (regionData.containsKey("opportunityScores")) {
            data.put("opportunity_scores", serializeToJson(regionData.get("opportunityScores")));
        }

        if (regionData.containsKey("growthTrends")) {
            data.put("growth_trends", serializeToJson(regionData.get("growthTrends")));
        }

        data.put("current_time", java.time.LocalDateTime.now().toString());

        return fillPromptTemplate("REGION", data);
    }

    @Override
    public String getFinanceAnalysisPrompt(Map<String, Object> financeData) {
        log.debug("生成财务分析 Prompt");

        Map<String, Object> data = new LinkedHashMap<>();

        if (financeData.containsKey("revenue")) {
            data.put("revenue_data", serializeToJson(financeData.get("revenue")));
        }

        if (financeData.containsKey("cost")) {
            data.put("cost_data", serializeToJson(financeData.get("cost")));
        }

        if (financeData.containsKey("profit")) {
            data.put("profit_data", serializeToJson(financeData.get("profit")));
        }

        if (financeData.containsKey("margins")) {
            data.put("margin_data", serializeToJson(financeData.get("margins")));
        }

        if (financeData.containsKey("expenses")) {
            data.put("expense_data", serializeToJson(financeData.get("expenses")));
        }

        if (financeData.containsKey("cashFlow")) {
            data.put("cashflow_data", serializeToJson(financeData.get("cashFlow")));
        }

        if (financeData.containsKey("accountsReceivable")) {
            data.put("ar_data", serializeToJson(financeData.get("accountsReceivable")));
        }

        data.put("current_time", java.time.LocalDateTime.now().toString());

        return fillPromptTemplate("FINANCE", data);
    }

    @Override
    public String getQAPrompt(String userQuery, Map<String, Object> context) {
        log.debug("生成通用问答 Prompt, 用户查询: {}", userQuery);

        Map<String, Object> data = new LinkedHashMap<>();

        // 用户查询
        data.put("user_query", userQuery != null ? userQuery : "");

        // 上下文数据
        if (context != null) {
            if (context.containsKey("currentData")) {
                data.put("current_data", serializeToJson(context.get("currentData")));
            }

            if (context.containsKey("historicalData")) {
                data.put("historical_data", serializeToJson(context.get("historicalData")));
            }

            if (context.containsKey("metadata")) {
                data.put("metadata", serializeToJson(context.get("metadata")));
            }

            if (context.containsKey("conversationHistory")) {
                data.put("conversation_history", serializeToJson(context.get("conversationHistory")));
            }

            if (context.containsKey("availableMetrics")) {
                data.put("available_metrics", serializeToJson(context.get("availableMetrics")));
            }

            if (context.containsKey("dataSchema")) {
                data.put("data_schema", serializeToJson(context.get("dataSchema")));
            }
        }

        data.put("current_time", java.time.LocalDateTime.now().toString());

        return fillPromptTemplate("QA", data);
    }

    // ==================== 辅助方法 ====================

    /**
     * 替换模板中的占位符
     *
     * @param template 模板字符串
     * @param data     数据映射
     * @return 替换后的字符串
     */
    private String replacePlaceholders(String template, Map<String, Object> data) {
        if (template == null || data == null) {
            return template;
        }

        StringBuffer result = new StringBuffer();
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);

        while (matcher.find()) {
            String placeholder = matcher.group(1);
            Object value = resolveValue(placeholder, data);
            String replacement = valueToString(value);
            // 转义特殊字符以避免正则替换问题
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);

        return result.toString();
    }

    /**
     * 解析占位符对应的值
     * 支持点号分隔的嵌套访问，如 "kpi.sales.value"
     *
     * @param placeholder 占位符（不含 {{}}）
     * @param data        数据映射
     * @return 对应的值，如果不存在则返回空字符串占位符
     */
    @SuppressWarnings("unchecked")
    private Object resolveValue(String placeholder, Map<String, Object> data) {
        if (placeholder == null || data == null) {
            return "{{" + placeholder + "}}";
        }

        String[] parts = placeholder.split("\\.");
        Object current = data;

        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                // 尝试反射访问对象属性
                current = getPropertyValue(current, part);
            }

            if (current == null) {
                log.debug("占位符值未找到: {}", placeholder);
                return "{{" + placeholder + "}}";
            }
        }

        return current;
    }

    /**
     * 通过反射获取对象属性值
     *
     * @param obj          对象
     * @param propertyName 属性名
     * @return 属性值，如果获取失败则返回 null
     */
    private Object getPropertyValue(Object obj, String propertyName) {
        if (obj == null || propertyName == null) {
            return null;
        }

        try {
            // 尝试 getter 方法
            String getterName = "get" + Character.toUpperCase(propertyName.charAt(0)) + propertyName.substring(1);
            java.lang.reflect.Method method = obj.getClass().getMethod(getterName);
            return method.invoke(obj);
        } catch (Exception e) {
            log.trace("无法获取属性值: {} - {}", propertyName, e.getMessage());
            return null;
        }
    }

    /**
     * 将值转换为字符串
     *
     * @param value 值
     * @return 字符串表示
     */
    private String valueToString(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof String) {
            return (String) value;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof Collection || value instanceof Map) {
            return serializeToJson(value);
        }
        return value.toString();
    }

    /**
     * 将对象序列化为 JSON 字符串
     *
     * @param obj 对象
     * @return JSON 字符串
     */
    private String serializeToJson(Object obj) {
        if (obj == null) {
            return "null";
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("JSON 序列化失败: {}", e.getMessage());
            return obj.toString();
        }
    }

    /**
     * 格式化 KPI 卡片为可读文本 (MetricResult 版本)
     *
     * @param kpiCards KPI 卡片列表
     * @return 格式化的文本
     */
    private String formatKpiCards(List<MetricResult> kpiCards) {
        if (kpiCards == null || kpiCards.isEmpty()) {
            return "暂无 KPI 数据";
        }

        StringBuilder sb = new StringBuilder();
        for (MetricResult kpi : kpiCards) {
            sb.append("- ").append(kpi.getMetricName()).append(": ");
            if (kpi.getFormattedValue() != null) {
                sb.append(kpi.getFormattedValue());
            } else if (kpi.getValue() != null) {
                sb.append(kpi.getValue());
                if (kpi.getUnit() != null) {
                    sb.append(" ").append(kpi.getUnit());
                }
            }
            if (kpi.getChangePercent() != null) {
                sb.append(" (").append(kpi.getChangeDirection() != null ? kpi.getChangeDirection() : "")
                  .append(" ").append(kpi.getChangePercent()).append("%)");
            }
            if (kpi.getAlertLevel() != null && !"GREEN".equals(kpi.getAlertLevel())) {
                sb.append(" [").append(kpi.getAlertLevel()).append("]");
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    /**
     * 格式化 KPI 卡片为可读文本 (KPICard 版本)
     *
     * @param kpiCards KPI 卡片列表
     * @return 格式化的文本
     */
    private String formatKpiCardsFromKPICard(List<KPICard> kpiCards) {
        if (kpiCards == null || kpiCards.isEmpty()) {
            return "暂无 KPI 数据";
        }

        StringBuilder sb = new StringBuilder();
        for (KPICard kpi : kpiCards) {
            sb.append("- ").append(kpi.getTitle()).append(": ");
            if (kpi.getValue() != null) {
                sb.append(kpi.getValue());
            } else if (kpi.getRawValue() != null) {
                sb.append(kpi.getRawValue());
                if (kpi.getUnit() != null) {
                    sb.append(" ").append(kpi.getUnit());
                }
            }
            if (kpi.getChangeRate() != null) {
                sb.append(" (").append(kpi.getTrend() != null ? kpi.getTrend() : "")
                  .append(" ").append(kpi.getChangeRate()).append("%)");
            }
            if (kpi.getStatus() != null && !"green".equalsIgnoreCase(kpi.getStatus())) {
                sb.append(" [").append(kpi.getStatus().toUpperCase()).append("]");
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    /**
     * 格式化图表数据为可读文本
     *
     * @param charts 图表配置列表
     * @return 格式化的文本
     */
    private String formatCharts(List<ChartConfig> charts) {
        if (charts == null || charts.isEmpty()) {
            return "暂无图表数据";
        }

        StringBuilder sb = new StringBuilder();
        for (ChartConfig chart : charts) {
            sb.append("## ").append(chart.getTitle()).append("\n");
            sb.append("- 类型: ").append(chart.getChartType()).append("\n");
            if (chart.getData() != null && !chart.getData().isEmpty()) {
                sb.append("- 数据点数: ").append(chart.getData().size()).append("\n");
                // 显示前几个数据点作为示例
                int sampleSize = Math.min(3, chart.getData().size());
                sb.append("- 示例数据: ").append(serializeToJson(chart.getData().subList(0, sampleSize))).append("\n");
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    /**
     * 格式化排名数据为可读文本
     *
     * @param rankings 排名项列表
     * @return 格式化的文本
     */
    private String formatRankings(List<RankingItem> rankings) {
        if (rankings == null || rankings.isEmpty()) {
            return "暂无排名数据";
        }

        StringBuilder sb = new StringBuilder();
        for (RankingItem item : rankings) {
            sb.append(item.getRank()).append(". ").append(item.getName());
            if (item.getValue() != null) {
                sb.append(": ").append(item.getValue());
            }
            if (item.getCompletionRate() != null) {
                sb.append(" (完成率: ").append(item.getCompletionRate()).append("%)");
            }
            if (item.getAlertLevel() != null && !"GREEN".equals(item.getAlertLevel())) {
                sb.append(" [").append(item.getAlertLevel()).append("]");
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    /**
     * 格式化 AI 洞察为可读文本
     *
     * @param insights AI 洞察列表
     * @return 格式化的文本
     */
    private String formatInsights(List<AIInsight> insights) {
        if (insights == null || insights.isEmpty()) {
            return "暂无洞察";
        }

        StringBuilder sb = new StringBuilder();
        for (AIInsight insight : insights) {
            sb.append("[").append(insight.getLevel()).append("] ");
            if (insight.getCategory() != null) {
                sb.append("(").append(insight.getCategory()).append(") ");
            }
            sb.append(insight.getMessage());
            if (insight.getActionSuggestion() != null) {
                sb.append("\n  -> 建议: ").append(insight.getActionSuggestion());
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }
}
