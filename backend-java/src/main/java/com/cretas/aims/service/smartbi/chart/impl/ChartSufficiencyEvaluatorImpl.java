package com.cretas.aims.service.smartbi.chart.impl;

import com.cretas.aims.dto.smartbi.chart.*;
import com.cretas.aims.dto.smartbi.chart.ChartSufficiencyResult.SuggestedChart;
import com.cretas.aims.service.smartbi.chart.ChartSufficiencyEvaluator;
import com.cretas.aims.ai.client.DashScopeClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * LLM-based chart sufficiency evaluator implementation.
 *
 * Evaluates whether a chart type adequately displays the data information,
 * and suggests alternative or additional charts when the current chart
 * is insufficient.
 *
 * Uses DashScope (Alibaba Cloud LLM) for intelligent evaluation with
 * rule-based fallback when LLM is unavailable.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChartSufficiencyEvaluatorImpl implements ChartSufficiencyEvaluator {

    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    // Threshold for determining if a chart is sufficient
    private static final int SUFFICIENCY_THRESHOLD = 70;

    // Chart type constants
    private static final String CHART_LINE = "line";
    private static final String CHART_BAR = "bar";
    private static final String CHART_PIE = "pie";
    private static final String CHART_WATERFALL = "waterfall";
    private static final String CHART_COMBO = "combo";
    private static final String CHART_RADAR = "radar";
    private static final String CHART_TREEMAP = "treemap";
    private static final String CHART_SCATTER = "scatter";
    private static final String CHART_HEATMAP = "heatmap";
    private static final String CHART_AREA = "area";

    // ==================== System Prompts ====================

    private static final String SYSTEM_PROMPT = """
        你是一个数据可视化专家。请评估当前图表是否充分展示了数据信息。

        你必须返回严格的JSON格式响应，不要添加任何额外文字或markdown代码块标记。

        评估标准：
        1. 数据特征覆盖度：图表是否能展示所有重要的数据特征
        2. 视觉表达力：图表类型是否适合当前数据结构
        3. 信息完整性：是否有重要信息被遗漏
        4. 可解读性：用户是否能从图表中获取关键洞察

        图表类型适用场景：
        - line: 时间序列趋势、变化趋势
        - bar: 分类比较、排名、预算对比
        - pie: 占比分析（类别2-7个时最佳）
        - waterfall: 累计变化、损益分解
        - combo: 多指标对比（不同量纲）
        - radar: 多维度评估、能力对比
        - treemap: 层级结构、占比+层级
        - scatter: 相关性分析、分布
        - area: 堆叠趋势、累计值
        - heatmap: 两维度交叉分析
        """;

    private static final String EVALUATION_PROMPT_TEMPLATE = """
        ## 数据特征
        - 数据行数: %d
        - 数值列: %s
        - 分类列: %s
        - 时间列: %s
        - 是否有时间序列: %s
        - 是否有预算对比: %s
        - 是否有同比环比: %s
        - 是否有层级结构: %s
        - 是否有占比分析: %s
        - 是否有比较关系: %s

        ## 当前图表
        - 类型: %s

        ## 评估要求
        请评估当前图表是否能充分展示以上数据特征，返回JSON格式：
        {
          "sufficient": true或false,
          "sufficiencyScore": 0-100的整数,
          "displayedInfo": ["已展示的信息1", "已展示的信息2"],
          "missingInfo": ["缺失的信息1", "缺失的信息2"],
          "recommendation": "建议的改进方案",
          "suggestedCharts": [
            {"type": "chart_type", "purpose": "展示什么信息", "priority": "high/medium/low"}
          ]
        }
        """;

    private static final String INITIAL_EVALUATION_PROMPT_TEMPLATE = """
        ## 数据特征
        - 数据行数: %d
        - 数值列: %s
        - 分类列: %s
        - 时间列: %s
        - 是否有时间序列: %s
        - 是否有预算对比: %s
        - 是否有同比环比: %s
        - 是否有层级结构: %s
        - 是否有占比分析: %s
        - 是否有比较关系: %s

        ## 评估要求
        请根据数据特征推荐最合适的图表组合，返回JSON格式：
        {
          "sufficient": false,
          "sufficiencyScore": 0,
          "displayedInfo": [],
          "missingInfo": ["需要展示的信息1", "需要展示的信息2"],
          "recommendation": "推荐的图表组合方案",
          "suggestedCharts": [
            {"type": "chart_type", "purpose": "展示什么信息", "priority": "high/medium/low"}
          ]
        }

        注意：
        - 优先推荐能覆盖主要数据特征的图表
        - high优先级的图表最多2个
        - medium优先级的图表用于补充展示
        - 总共推荐不超过5个图表
        """;

    // ==================== Interface Implementation ====================

    @Override
    public ChartSufficiencyResult evaluate(
            List<Map<String, Object>> data,
            DataFeatures features,
            String currentChartType) {

        log.info("[ChartSufficiencyEvaluator] Evaluating chart: type={}, rowCount={}",
                currentChartType, features.getRowCount());

        // Build prompt with data features
        String prompt = buildEvaluationPrompt(features, currentChartType);

        try {
            // Check if LLM is available
            if (dashScopeClient == null || !dashScopeClient.isAvailable()) {
                log.warn("[ChartSufficiencyEvaluator] LLM not available, using rule-based evaluation");
                return ruleBasedEvaluation(features, currentChartType);
            }

            // Call LLM with low temperature for consistent output
            String response = dashScopeClient.chatLowTemp(SYSTEM_PROMPT, prompt);

            // Parse JSON response
            ChartSufficiencyResult result = parseEvaluationResult(response);

            log.info("[ChartSufficiencyEvaluator] Evaluation complete: sufficient={}, score={}",
                    result.isSufficient(), result.getSufficiencyScore());

            return result;

        } catch (Exception e) {
            log.error("[ChartSufficiencyEvaluator] LLM evaluation failed, using rule-based fallback", e);
            return ruleBasedEvaluation(features, currentChartType);
        }
    }

    @Override
    public ChartSufficiencyResult evaluateInitial(
            List<Map<String, Object>> data,
            DataFeatures features) {

        log.info("[ChartSufficiencyEvaluator] Initial evaluation: rowCount={}", features.getRowCount());

        // For initial evaluation, recommend best chart types based on data features
        String prompt = buildInitialEvaluationPrompt(features);

        try {
            if (dashScopeClient == null || !dashScopeClient.isAvailable()) {
                log.warn("[ChartSufficiencyEvaluator] LLM not available, using rule-based recommendation");
                return ruleBasedInitialRecommendation(features);
            }

            String response = dashScopeClient.chatLowTemp(SYSTEM_PROMPT, prompt);
            ChartSufficiencyResult result = parseEvaluationResult(response);

            log.info("[ChartSufficiencyEvaluator] Initial evaluation complete: {} charts recommended",
                    result.getSuggestedCharts() != null ? result.getSuggestedCharts().size() : 0);

            return result;

        } catch (Exception e) {
            log.error("[ChartSufficiencyEvaluator] LLM initial evaluation failed, using rule-based fallback", e);
            return ruleBasedInitialRecommendation(features);
        }
    }

    // ==================== Prompt Building ====================

    /**
     * Build evaluation prompt for existing chart
     */
    private String buildEvaluationPrompt(DataFeatures features, String currentChartType) {
        return String.format(EVALUATION_PROMPT_TEMPLATE,
                features.getRowCount(),
                formatList(features.getNumericColumns()),
                formatList(features.getCategoricalColumns()),
                formatList(features.getTimeColumns()),
                features.isHasTimeSeries(),
                features.isHasBudgetActual(),
                features.isHasYoYMoM(),
                features.isHasHierarchy(),
                features.isHasProportion(),
                features.isHasComparison(),
                currentChartType != null ? currentChartType : "未选择"
        );
    }

    /**
     * Build prompt for initial chart recommendation
     */
    private String buildInitialEvaluationPrompt(DataFeatures features) {
        return String.format(INITIAL_EVALUATION_PROMPT_TEMPLATE,
                features.getRowCount(),
                formatList(features.getNumericColumns()),
                formatList(features.getCategoricalColumns()),
                formatList(features.getTimeColumns()),
                features.isHasTimeSeries(),
                features.isHasBudgetActual(),
                features.isHasYoYMoM(),
                features.isHasHierarchy(),
                features.isHasProportion(),
                features.isHasComparison()
        );
    }

    /**
     * Format list for prompt
     */
    private String formatList(List<String> list) {
        if (list == null || list.isEmpty()) {
            return "无";
        }
        return String.join(", ", list);
    }

    // ==================== Response Parsing ====================

    /**
     * Parse LLM response into ChartSufficiencyResult
     */
    private ChartSufficiencyResult parseEvaluationResult(String response) {
        try {
            String cleanJson = cleanJsonResponse(response);
            JsonNode json = objectMapper.readTree(cleanJson);

            // Parse basic fields
            boolean sufficient = getJsonBoolean(json, "sufficient", false);
            int sufficiencyScore = getJsonInt(json, "sufficiencyScore", 0);
            String recommendation = getJsonString(json, "recommendation", "");

            // Parse lists
            List<String> displayedInfo = parseStringList(json, "displayedInfo");
            List<String> missingInfo = parseStringList(json, "missingInfo");

            // Parse suggested charts
            List<SuggestedChart> suggestedCharts = parseSuggestedCharts(json);

            return ChartSufficiencyResult.builder()
                    .sufficient(sufficient)
                    .sufficiencyScore(sufficiencyScore)
                    .displayedInfo(displayedInfo)
                    .missingInfo(missingInfo)
                    .recommendation(recommendation)
                    .suggestedCharts(suggestedCharts)
                    .build();

        } catch (Exception e) {
            log.error("[ChartSufficiencyEvaluator] Failed to parse LLM response: {}", e.getMessage());
            // Return a default insufficient result
            return ChartSufficiencyResult.builder()
                    .sufficient(false)
                    .sufficiencyScore(0)
                    .displayedInfo(Collections.emptyList())
                    .missingInfo(List.of("解析失败，无法确定"))
                    .recommendation("建议检查数据格式后重试")
                    .suggestedCharts(Collections.emptyList())
                    .build();
        }
    }

    /**
     * Parse suggested charts from JSON
     */
    private List<SuggestedChart> parseSuggestedCharts(JsonNode json) {
        List<SuggestedChart> charts = new ArrayList<>();
        JsonNode chartsNode = json.get("suggestedCharts");

        if (chartsNode != null && chartsNode.isArray()) {
            for (JsonNode chartNode : chartsNode) {
                SuggestedChart chart = SuggestedChart.builder()
                        .type(getJsonString(chartNode, "type", CHART_BAR))
                        .purpose(getJsonString(chartNode, "purpose", "数据展示"))
                        .priority(getJsonString(chartNode, "priority", "medium"))
                        .build();
                charts.add(chart);
            }
        }

        return charts;
    }

    /**
     * Parse string list from JSON
     */
    private List<String> parseStringList(JsonNode json, String fieldName) {
        List<String> result = new ArrayList<>();
        JsonNode node = json.get(fieldName);

        if (node != null && node.isArray()) {
            for (JsonNode item : node) {
                if (item.isTextual()) {
                    result.add(item.asText());
                }
            }
        }

        return result;
    }

    /**
     * Clean JSON response (remove markdown code blocks)
     */
    private String cleanJsonResponse(String response) {
        if (response == null) {
            return "{}";
        }

        String cleaned = response.trim();

        // Remove markdown code block markers
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }

        return cleaned.trim();
    }

    // ==================== Rule-Based Fallback ====================

    /**
     * Rule-based evaluation when LLM is unavailable
     */
    private ChartSufficiencyResult ruleBasedEvaluation(DataFeatures features, String currentChartType) {
        List<String> displayedInfo = new ArrayList<>();
        List<String> missingInfo = new ArrayList<>();
        List<SuggestedChart> suggestedCharts = new ArrayList<>();

        int score = 50; // Base score

        if (currentChartType == null || currentChartType.isEmpty()) {
            return ruleBasedInitialRecommendation(features);
        }

        String chartType = currentChartType.toLowerCase();

        // Evaluate based on chart type and data features

        // Time series evaluation
        if (features.isHasTimeSeries()) {
            if (CHART_LINE.equals(chartType) || CHART_AREA.equals(chartType)) {
                displayedInfo.add("时间序列趋势");
                score += 15;
            } else {
                missingInfo.add("时间序列趋势展示不够直观");
                suggestedCharts.add(createSuggestedChart(CHART_LINE, "展示时间趋势变化", "high"));
                score -= 10;
            }
        }

        // Budget vs Actual evaluation
        if (features.isHasBudgetActual()) {
            if (CHART_BAR.equals(chartType) || CHART_COMBO.equals(chartType)) {
                displayedInfo.add("预算与实际对比");
                score += 10;
            } else if (CHART_WATERFALL.equals(chartType)) {
                displayedInfo.add("预算差异分解");
                score += 15;
            } else {
                missingInfo.add("预算对比展示不够清晰");
                suggestedCharts.add(createSuggestedChart(CHART_BAR, "预算vs实际双柱对比", "high"));
                score -= 10;
            }
        }

        // YoY/MoM evaluation
        if (features.isHasYoYMoM()) {
            if (CHART_LINE.equals(chartType) || CHART_COMBO.equals(chartType)) {
                displayedInfo.add("同比环比趋势");
                score += 10;
            } else {
                missingInfo.add("同比环比变化趋势");
                suggestedCharts.add(createSuggestedChart(CHART_LINE, "同比环比趋势对比", "medium"));
                score -= 5;
            }
        }

        // Proportion evaluation
        if (features.isHasProportion()) {
            int categoryCount = features.getCategoricalColumns() != null ?
                    features.getCategoricalColumns().size() : 0;

            if (CHART_PIE.equals(chartType)) {
                if (categoryCount >= 2 && categoryCount <= 7) {
                    displayedInfo.add("占比分析");
                    score += 15;
                } else {
                    displayedInfo.add("占比分析（类别较多，展示效果可能不佳）");
                    score += 5;
                }
            } else if (CHART_TREEMAP.equals(chartType)) {
                displayedInfo.add("层级占比分析");
                score += 10;
            } else {
                missingInfo.add("占比分布情况");
                suggestedCharts.add(createSuggestedChart(CHART_PIE, "各类别占比分析", "medium"));
                score -= 5;
            }
        }

        // Hierarchy evaluation
        if (features.isHasHierarchy()) {
            if (CHART_TREEMAP.equals(chartType)) {
                displayedInfo.add("层级结构展示");
                score += 15;
            } else {
                missingInfo.add("层级结构关系");
                suggestedCharts.add(createSuggestedChart(CHART_TREEMAP, "层级结构可视化", "low"));
                score -= 5;
            }
        }

        // Comparison evaluation
        if (features.isHasComparison()) {
            if (CHART_BAR.equals(chartType) || CHART_RADAR.equals(chartType)) {
                displayedInfo.add("多维度比较");
                score += 10;
            } else {
                missingInfo.add("对比关系不够明显");
                suggestedCharts.add(createSuggestedChart(CHART_BAR, "分类比较分析", "medium"));
            }
        }

        // Multiple numeric columns
        if (features.getNumericColumns() != null && features.getNumericColumns().size() > 2) {
            if (!CHART_COMBO.equals(chartType) && !CHART_RADAR.equals(chartType)) {
                missingInfo.add("多指标综合展示");
                suggestedCharts.add(createSuggestedChart(CHART_COMBO, "多指标组合分析", "low"));
            }
        }

        // Normalize score
        score = Math.max(0, Math.min(100, score));

        // Determine sufficiency
        boolean sufficient = score >= SUFFICIENCY_THRESHOLD && missingInfo.isEmpty();

        // Build recommendation
        String recommendation = buildRuleBasedRecommendation(sufficient, displayedInfo, missingInfo);

        // Sort and limit suggested charts
        suggestedCharts = suggestedCharts.stream()
                .sorted((a, b) -> priorityOrder(a.getPriority()) - priorityOrder(b.getPriority()))
                .limit(5)
                .collect(Collectors.toList());

        return ChartSufficiencyResult.builder()
                .sufficient(sufficient)
                .sufficiencyScore(score)
                .displayedInfo(displayedInfo)
                .missingInfo(missingInfo)
                .recommendation(recommendation)
                .suggestedCharts(suggestedCharts)
                .build();
    }

    /**
     * Rule-based initial chart recommendation when LLM is unavailable
     */
    private ChartSufficiencyResult ruleBasedInitialRecommendation(DataFeatures features) {
        List<String> missingInfo = new ArrayList<>();
        List<SuggestedChart> suggestedCharts = new ArrayList<>();

        // Primary chart selection based on data features

        // Time series -> Line chart (high priority)
        if (features.isHasTimeSeries()) {
            missingInfo.add("时间序列趋势分析");
            suggestedCharts.add(createSuggestedChart(CHART_LINE, "展示数据随时间的变化趋势", "high"));
        }

        // Budget vs Actual -> Bar chart (high priority)
        if (features.isHasBudgetActual()) {
            missingInfo.add("预算与实际对比");
            suggestedCharts.add(createSuggestedChart(CHART_BAR, "预算与实际完成情况对比", "high"));
            // Also suggest waterfall for variance analysis
            suggestedCharts.add(createSuggestedChart(CHART_WATERFALL, "预算差异分解分析", "medium"));
        }

        // YoY/MoM -> Comparison chart (high priority)
        if (features.isHasYoYMoM()) {
            missingInfo.add("同比环比分析");
            if (!features.isHasTimeSeries()) {
                suggestedCharts.add(createSuggestedChart(CHART_LINE, "同比环比趋势对比", "high"));
            }
            suggestedCharts.add(createSuggestedChart(CHART_BAR, "同比环比柱状对比", "medium"));
        }

        // Proportion -> Pie chart (medium priority)
        if (features.isHasProportion()) {
            missingInfo.add("占比分布分析");
            int categoryCount = features.getCategoricalColumns() != null ?
                    features.getCategoricalColumns().size() : 0;
            if (categoryCount <= 7) {
                suggestedCharts.add(createSuggestedChart(CHART_PIE, "各类别占比分布", "medium"));
            } else {
                suggestedCharts.add(createSuggestedChart(CHART_TREEMAP, "大量类别占比展示", "medium"));
            }
        }

        // Hierarchy -> Treemap (medium priority)
        if (features.isHasHierarchy()) {
            missingInfo.add("层级结构展示");
            suggestedCharts.add(createSuggestedChart(CHART_TREEMAP, "层级结构与占比", "medium"));
        }

        // Comparison -> Bar chart (medium priority)
        if (features.isHasComparison() && !features.isHasBudgetActual()) {
            missingInfo.add("分类对比分析");
            suggestedCharts.add(createSuggestedChart(CHART_BAR, "分类数据对比", "medium"));
        }

        // Multiple metrics -> Combo or Radar (low priority)
        if (features.getNumericColumns() != null && features.getNumericColumns().size() > 2) {
            missingInfo.add("多指标综合分析");
            suggestedCharts.add(createSuggestedChart(CHART_COMBO, "多指标组合展示", "low"));
            if (features.getNumericColumns().size() >= 3 && features.getNumericColumns().size() <= 8) {
                suggestedCharts.add(createSuggestedChart(CHART_RADAR, "多维度能力雷达图", "low"));
            }
        }

        // Default recommendation if no specific features detected
        if (suggestedCharts.isEmpty()) {
            if (features.getNumericColumns() != null && !features.getNumericColumns().isEmpty()) {
                suggestedCharts.add(createSuggestedChart(CHART_BAR, "基础数据对比展示", "high"));
            }
            missingInfo.add("数据可视化分析");
        }

        // Remove duplicates and limit
        suggestedCharts = suggestedCharts.stream()
                .collect(Collectors.toMap(
                        SuggestedChart::getType,
                        chart -> chart,
                        (existing, replacement) ->
                                priorityOrder(existing.getPriority()) <= priorityOrder(replacement.getPriority())
                                        ? existing : replacement
                ))
                .values()
                .stream()
                .sorted((a, b) -> priorityOrder(a.getPriority()) - priorityOrder(b.getPriority()))
                .limit(5)
                .collect(Collectors.toList());

        // Build recommendation text
        String recommendation = buildInitialRecommendation(features, suggestedCharts);

        return ChartSufficiencyResult.builder()
                .sufficient(false)
                .sufficiencyScore(0)
                .displayedInfo(Collections.emptyList())
                .missingInfo(missingInfo)
                .recommendation(recommendation)
                .suggestedCharts(suggestedCharts)
                .build();
    }

    // ==================== Helper Methods ====================

    /**
     * Create a SuggestedChart object
     */
    private SuggestedChart createSuggestedChart(String type, String purpose, String priority) {
        return SuggestedChart.builder()
                .type(type)
                .purpose(purpose)
                .priority(priority)
                .build();
    }

    /**
     * Convert priority string to numeric order
     */
    private int priorityOrder(String priority) {
        if ("high".equalsIgnoreCase(priority)) return 1;
        if ("medium".equalsIgnoreCase(priority)) return 2;
        if ("low".equalsIgnoreCase(priority)) return 3;
        return 4;
    }

    /**
     * Build rule-based recommendation text
     */
    private String buildRuleBasedRecommendation(boolean sufficient,
            List<String> displayedInfo, List<String> missingInfo) {
        StringBuilder sb = new StringBuilder();

        if (sufficient) {
            sb.append("当前图表能够充分展示数据的主要特征。");
            if (!displayedInfo.isEmpty()) {
                sb.append("已展示：").append(String.join("、", displayedInfo)).append("。");
            }
        } else {
            sb.append("当前图表可能无法完整展示数据信息。");
            if (!missingInfo.isEmpty()) {
                sb.append("建议补充展示：").append(String.join("、", missingInfo)).append("。");
            }
        }

        return sb.toString();
    }

    /**
     * Build initial recommendation text
     */
    private String buildInitialRecommendation(DataFeatures features, List<SuggestedChart> charts) {
        StringBuilder sb = new StringBuilder();
        sb.append("根据数据特征分析，推荐以下图表组合：");

        List<SuggestedChart> highPriority = charts.stream()
                .filter(c -> "high".equalsIgnoreCase(c.getPriority()))
                .collect(Collectors.toList());

        List<SuggestedChart> otherPriority = charts.stream()
                .filter(c -> !"high".equalsIgnoreCase(c.getPriority()))
                .collect(Collectors.toList());

        if (!highPriority.isEmpty()) {
            sb.append(" 主要图表：");
            sb.append(highPriority.stream()
                    .map(c -> c.getType() + "(" + c.getPurpose() + ")")
                    .collect(Collectors.joining("、")));
            sb.append("。");
        }

        if (!otherPriority.isEmpty()) {
            sb.append(" 补充图表：");
            sb.append(otherPriority.stream()
                    .map(c -> c.getType() + "(" + c.getPurpose() + ")")
                    .collect(Collectors.joining("、")));
            sb.append("。");
        }

        return sb.toString();
    }

    // ==================== JSON Utility Methods ====================

    private String getJsonString(JsonNode node, String field, String defaultValue) {
        JsonNode valueNode = node.get(field);
        return valueNode != null && !valueNode.isNull() ? valueNode.asText() : defaultValue;
    }

    private int getJsonInt(JsonNode node, String field, int defaultValue) {
        JsonNode valueNode = node.get(field);
        return valueNode != null && valueNode.isNumber() ? valueNode.asInt() : defaultValue;
    }

    private boolean getJsonBoolean(JsonNode node, String field, boolean defaultValue) {
        JsonNode valueNode = node.get(field);
        return valueNode != null && valueNode.isBoolean() ? valueNode.asBoolean() : defaultValue;
    }
}
