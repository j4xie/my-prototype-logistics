package com.cretas.aims.service.smartbi.chart.impl;

import com.cretas.aims.dto.smartbi.chart.*;
import com.cretas.aims.entity.smartbi.SmartBiExcelUpload;
import com.cretas.aims.repository.smartbi.SmartBiExcelUploadRepository;
import com.cretas.aims.service.smartbi.chart.*;
import com.cretas.aims.service.smartbi.ChartTemplateService;
import com.cretas.aims.ai.client.DashScopeClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Adaptive Chart Generator Implementation
 *
 * Main orchestration service that coordinates:
 * - Feature extraction from uploaded data
 * - Sufficiency evaluation of chart types
 * - Optimal chart generation using LLM
 * - Optional chart fusion for composite visualizations
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdaptiveChartGeneratorImpl implements AdaptiveChartGenerator {

    private final DataFeatureExtractor featureExtractor;
    private final ChartSufficiencyEvaluator sufficiencyEvaluator;
    private final ChartFusionService fusionService;
    private final ChartTemplateService chartTemplateService;
    private final SmartBiExcelUploadRepository uploadRepository;
    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    private static final String CHART_GENERATION_SYSTEM_PROMPT = """
        你是一个专业的 ECharts 图表配置专家。请根据提供的数据和需求生成 ECharts 配置。

        要求：
        1. 返回严格的 JSON 格式的 ECharts option 配置
        2. 不要添加任何额外文字、解释或 markdown 标记
        3. 图表标题、图例、轴标签使用中文
        4. 配色方案使用专业的商务色系
        5. 确保数据正确映射到图表中
        6. 添加适当的 tooltip 提示配置

        常用配色方案：
        - 主色调：#5470c6, #91cc75, #fac858, #ee6666, #73c0de
        - 背景色：#ffffff 或透明
        """;

    private static final int MAX_SAMPLE_ROWS = 10;
    private static final int DEFAULT_MAX_CHARTS = 3;

    @Override
    public AdaptiveChartResponse generateAdaptive(Long uploadId, AdaptiveChartRequest request) {
        log.info("Starting adaptive chart generation for uploadId: {}", uploadId);

        // 1. Load upload data
        SmartBiExcelUpload upload = uploadRepository.findById(uploadId)
                .orElseThrow(() -> new RuntimeException("Upload not found: " + uploadId));

        List<Map<String, Object>> data = parseUploadData(upload);
        List<String> headers = parseHeaders(upload);

        if (data.isEmpty()) {
            log.warn("No data found for uploadId: {}", uploadId);
            return AdaptiveChartResponse.builder()
                    .charts(Collections.emptyList())
                    .build();
        }

        // 2. Extract features
        DataFeatures features = featureExtractor.extract(data, headers);
        log.debug("Extracted features: columns={}, numeric={}, categorical={}, time={}",
                features.getColumnCount(),
                features.getNumericColumns().size(),
                features.getCategoricalColumns().size(),
                features.getTimeColumns().size());

        // 3. Evaluate sufficiency (if requested)
        ChartSufficiencyResult evaluation = null;
        if (request.isEvaluateFirst()) {
            evaluation = sufficiencyEvaluator.evaluateInitial(data, features);
            log.debug("Sufficiency evaluation: sufficient={}, score={}",
                    evaluation.isSufficient(), evaluation.getSufficiencyScore());
        }

        // 4. Generate optimal charts
        int maxCharts = request.getMaxCharts() != null ? request.getMaxCharts() : DEFAULT_MAX_CHARTS;
        List<AdaptiveChartResponse.GeneratedChart> charts =
                generateOptimalCharts(data, features, evaluation, maxCharts);

        // 5. Optional: Fuse charts
        if (request.isFusionEnabled() && charts.size() > 1) {
            try {
                ChartFusionService.FusionStrategy strategy = fusionService.recommendFusionStrategy(charts);
                AdaptiveChartResponse.GeneratedChart fusedChart = fusionService.fuseCharts(charts, strategy);
                if (fusedChart != null) {
                    charts.add(fusedChart);
                    log.debug("Added fused chart with strategy: {}", strategy);
                }
            } catch (Exception e) {
                log.warn("Chart fusion failed: {}", e.getMessage());
            }
        }

        log.info("Adaptive chart generation completed. Generated {} charts for uploadId: {}",
                charts.size(), uploadId);

        return AdaptiveChartResponse.builder()
                .evaluation(evaluation)
                .charts(charts)
                .dataFeatures(features)
                .build();
    }

    @Override
    public List<AdaptiveChartResponse.GeneratedChart> generateOptimalCharts(
            List<Map<String, Object>> data,
            DataFeatures features,
            ChartSufficiencyResult evaluation,
            int maxCharts) {

        List<AdaptiveChartResponse.GeneratedChart> charts = new ArrayList<>();
        Set<String> generatedTypes = new HashSet<>();

        // Determine chart types to generate based on features and evaluation
        List<ChartSufficiencyResult.SuggestedChart> suggestions =
                evaluation != null && evaluation.getSuggestedCharts() != null ?
                        evaluation.getSuggestedCharts() :
                        suggestChartsFromFeatures(features);

        // Sort by priority
        suggestions.sort((a, b) -> getPriorityOrder(a.getPriority()) - getPriorityOrder(b.getPriority()));

        for (ChartSufficiencyResult.SuggestedChart suggestion : suggestions) {
            if (charts.size() >= maxCharts) break;
            if (generatedTypes.contains(suggestion.getType())) continue;

            try {
                AdaptiveChartResponse.GeneratedChart chart =
                        generateChart(data, features, suggestion.getType(), suggestion.getPurpose());

                if (chart != null) {
                    charts.add(chart);
                    generatedTypes.add(suggestion.getType());
                    log.debug("Generated chart: type={}, purpose={}", suggestion.getType(), suggestion.getPurpose());
                }
            } catch (Exception e) {
                log.warn("Failed to generate chart type {}: {}", suggestion.getType(), e.getMessage());
            }
        }

        return charts;
    }

    @Override
    public AdaptiveChartResponse.GeneratedChart generateChart(
            List<Map<String, Object>> data,
            DataFeatures features,
            String chartType,
            String purpose) {

        try {
            // Build LLM prompt for ECharts generation
            String prompt = buildChartGenerationPrompt(data, features, chartType, purpose);

            // Call LLM to generate ECharts config
            String response = dashScopeClient.chatLowTemp(CHART_GENERATION_SYSTEM_PROMPT, prompt);

            // Parse response to Map
            String cleanedJson = cleanJsonResponse(response);
            Map<String, Object> echartsOption = objectMapper.readValue(
                    cleanedJson,
                    new TypeReference<Map<String, Object>>() {}
            );

            return AdaptiveChartResponse.GeneratedChart.builder()
                    .id("chart_" + UUID.randomUUID().toString().substring(0, 8))
                    .type(chartType)
                    .purpose(purpose)
                    .priority(determinePriority(chartType, features))
                    .echartsOption(echartsOption)
                    .build();

        } catch (Exception e) {
            log.error("Failed to generate chart type {}: {}", chartType, e.getMessage(), e);
            return null;
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Parse upload data from JSON stored in entity
     */
    private List<Map<String, Object>> parseUploadData(SmartBiExcelUpload upload) {
        try {
            String dataFeatures = upload.getDataFeatures();
            if (dataFeatures == null || dataFeatures.isEmpty()) {
                log.warn("No data features found for upload: {}", upload.getId());
                return Collections.emptyList();
            }

            // Try to parse as data features JSON with embedded data
            Map<String, Object> featuresMap = objectMapper.readValue(
                    dataFeatures,
                    new TypeReference<Map<String, Object>>() {}
            );

            // Check if there's embedded sample data
            if (featuresMap.containsKey("sampleData")) {
                Object sampleData = featuresMap.get("sampleData");
                if (sampleData instanceof List) {
                    return ((List<?>) sampleData).stream()
                            .filter(item -> item instanceof Map)
                            .map(item -> (Map<String, Object>) item)
                            .collect(Collectors.toList());
                }
            }

            // Check if there's full data
            if (featuresMap.containsKey("data")) {
                Object data = featuresMap.get("data");
                if (data instanceof List) {
                    return ((List<?>) data).stream()
                            .filter(item -> item instanceof Map)
                            .map(item -> (Map<String, Object>) item)
                            .collect(Collectors.toList());
                }
            }

            // If no embedded data, return empty list
            log.debug("No embedded data in features, upload may need reprocessing");
            return Collections.emptyList();

        } catch (Exception e) {
            log.error("Failed to parse upload data: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Parse headers from upload metadata
     */
    private List<String> parseHeaders(SmartBiExcelUpload upload) {
        try {
            String fieldMappings = upload.getFieldMappings();
            if (fieldMappings == null || fieldMappings.isEmpty()) {
                // Try to get from data features
                String dataFeatures = upload.getDataFeatures();
                if (dataFeatures != null && !dataFeatures.isEmpty()) {
                    Map<String, Object> featuresMap = objectMapper.readValue(
                            dataFeatures,
                            new TypeReference<Map<String, Object>>() {}
                    );
                    if (featuresMap.containsKey("columns")) {
                        Object columns = featuresMap.get("columns");
                        if (columns instanceof List) {
                            return ((List<?>) columns).stream()
                                    .map(Object::toString)
                                    .collect(Collectors.toList());
                        }
                    }
                }
                return Collections.emptyList();
            }

            // Parse field mappings to extract source columns
            Map<String, String> mappings = objectMapper.readValue(
                    fieldMappings,
                    new TypeReference<Map<String, String>>() {}
            );

            return new ArrayList<>(mappings.keySet());

        } catch (Exception e) {
            log.error("Failed to parse headers: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Suggest chart types based on extracted data features
     */
    private List<ChartSufficiencyResult.SuggestedChart> suggestChartsFromFeatures(DataFeatures features) {
        List<ChartSufficiencyResult.SuggestedChart> suggestions = new ArrayList<>();

        // Time series data -> Line chart
        if (features.isHasTimeSeries() && !features.getTimeColumns().isEmpty()) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("line")
                    .purpose("展示数据随时间的变化趋势")
                    .priority("high")
                    .build());
        }

        // Proportion data -> Pie chart
        if (features.isHasProportion() || (features.getCategoricalColumns().size() == 1
                && features.getNumericColumns().size() == 1)) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("pie")
                    .purpose("展示各部分占比构成")
                    .priority("medium")
                    .build());
        }

        // Budget vs Actual -> Bar chart
        if (features.isHasBudgetActual()) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("bar")
                    .purpose("展示预算与实际的对比分析")
                    .priority("high")
                    .build());
        }

        // YoY/MoM comparison -> Grouped bar
        if (features.isHasYoYMoM()) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("bar")
                    .purpose("展示同比环比变化")
                    .priority("high")
                    .build());
        }

        // Comparison data -> Bar chart
        if (features.isHasComparison() && !features.getCategoricalColumns().isEmpty()) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("bar")
                    .purpose("展示不同类别的数据对比")
                    .priority("medium")
                    .build());
        }

        // Hierarchical data -> Treemap
        if (features.isHasHierarchy()) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("treemap")
                    .purpose("展示层级结构数据")
                    .priority("low")
                    .build());
        }

        // Multiple numeric columns -> Radar for comparison
        if (features.getNumericColumns().size() >= 3) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("radar")
                    .purpose("多维度指标对比分析")
                    .priority("low")
                    .build());
        }

        // Default: Bar chart if nothing else suggested
        if (suggestions.isEmpty() && !features.getNumericColumns().isEmpty()) {
            suggestions.add(ChartSufficiencyResult.SuggestedChart.builder()
                    .type("bar")
                    .purpose("展示数据分布")
                    .priority("medium")
                    .build());
        }

        return suggestions;
    }

    /**
     * Build the prompt for LLM to generate ECharts configuration
     */
    private String buildChartGenerationPrompt(
            List<Map<String, Object>> data,
            DataFeatures features,
            String chartType,
            String purpose) {

        StringBuilder prompt = new StringBuilder();

        prompt.append("请为以下数据生成一个 ").append(getChartTypeName(chartType)).append("。\n\n");
        prompt.append("图表目的：").append(purpose).append("\n\n");

        // Data structure description
        prompt.append("数据结构：\n");
        prompt.append("- 总行数：").append(features.getRowCount()).append("\n");
        prompt.append("- 列名：").append(String.join(", ", features.getColumns())).append("\n");

        if (!features.getNumericColumns().isEmpty()) {
            prompt.append("- 数值列：").append(String.join(", ", features.getNumericColumns())).append("\n");
        }
        if (!features.getCategoricalColumns().isEmpty()) {
            prompt.append("- 分类列：").append(String.join(", ", features.getCategoricalColumns())).append("\n");
        }
        if (!features.getTimeColumns().isEmpty()) {
            prompt.append("- 时间列：").append(String.join(", ", features.getTimeColumns())).append("\n");
        }

        // Sample data
        prompt.append("\n样本数据（JSON 格式）：\n");
        try {
            List<Map<String, Object>> sampleData = data.stream()
                    .limit(MAX_SAMPLE_ROWS)
                    .collect(Collectors.toList());
            prompt.append(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(sampleData));
        } catch (Exception e) {
            prompt.append("[数据序列化失败]");
        }

        // Value ranges for context
        if (features.getValueRanges() != null && !features.getValueRanges().isEmpty()) {
            prompt.append("\n\n数值范围：\n");
            features.getValueRanges().forEach((col, range) -> {
                prompt.append(String.format("- %s: 最小值=%.2f, 最大值=%.2f, 平均值=%.2f\n",
                        col, range.getMin(), range.getMax(), range.getAvg()));
            });
        }

        // Chart-specific instructions
        prompt.append("\n\n生成要求：\n");
        prompt.append(getChartTypeInstructions(chartType, features));

        prompt.append("\n请直接返回 JSON 格式的 ECharts option 配置，不要添加任何其他内容。");

        return prompt.toString();
    }

    /**
     * Get Chinese name for chart type
     */
    private String getChartTypeName(String chartType) {
        return switch (chartType.toLowerCase()) {
            case "line" -> "折线图";
            case "bar" -> "柱状图";
            case "pie" -> "饼图";
            case "scatter" -> "散点图";
            case "radar" -> "雷达图";
            case "treemap" -> "矩形树图";
            case "heatmap" -> "热力图";
            case "funnel" -> "漏斗图";
            case "gauge" -> "仪表盘";
            case "waterfall" -> "瀑布图";
            default -> chartType + "图";
        };
    }

    /**
     * Get chart-type specific generation instructions
     */
    private String getChartTypeInstructions(String chartType, DataFeatures features) {
        StringBuilder instructions = new StringBuilder();

        switch (chartType.toLowerCase()) {
            case "line" -> {
                instructions.append("1. 使用时间列作为 X 轴\n");
                instructions.append("2. 数值列作为 Y 轴数据系列\n");
                instructions.append("3. 添加平滑曲线效果（smooth: true）\n");
                instructions.append("4. 显示数据点和悬浮提示\n");
                instructions.append("5. 如有多条线，添加图例\n");
            }
            case "bar" -> {
                instructions.append("1. 分类列作为 X 轴类目\n");
                instructions.append("2. 数值列作为 Y 轴数值\n");
                instructions.append("3. 如有多组数据，使用分组柱状图\n");
                instructions.append("4. 添加数据标签显示具体数值\n");
                instructions.append("5. 考虑添加背景阴影增强对比\n");
            }
            case "pie" -> {
                instructions.append("1. 分类列作为饼图各部分名称\n");
                instructions.append("2. 数值列作为各部分数值\n");
                instructions.append("3. 添加百分比显示\n");
                instructions.append("4. 使用环形图效果（radius: ['40%', '70%']）\n");
                instructions.append("5. 添加图例和提示\n");
            }
            case "radar" -> {
                instructions.append("1. 数值列名作为雷达图各维度\n");
                instructions.append("2. 每行数据作为一个数据系列\n");
                instructions.append("3. 设置合理的最大值刻度\n");
                instructions.append("4. 添加区域填充效果\n");
                instructions.append("5. 使用不同颜色区分系列\n");
            }
            case "treemap" -> {
                instructions.append("1. 构建层级数据结构\n");
                instructions.append("2. 使用分类列作为层级名称\n");
                instructions.append("3. 数值列决定矩形大小\n");
                instructions.append("4. 添加层级下钻功能\n");
                instructions.append("5. 使用渐变色增强视觉效果\n");
            }
            default -> {
                instructions.append("1. 根据数据特征选择合适的轴和系列配置\n");
                instructions.append("2. 确保图表可读性和美观性\n");
                instructions.append("3. 添加必要的交互功能\n");
            }
        }

        return instructions.toString();
    }

    /**
     * Clean JSON response from LLM (remove markdown code blocks, etc.)
     */
    private String cleanJsonResponse(String response) {
        if (response == null || response.isEmpty()) {
            return "{}";
        }

        String cleaned = response.trim();

        // Remove markdown code blocks
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }

        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();

        // Validate it looks like JSON
        if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
            // Try to find JSON object in the response
            int startBrace = cleaned.indexOf("{");
            int endBrace = cleaned.lastIndexOf("}");
            if (startBrace != -1 && endBrace > startBrace) {
                cleaned = cleaned.substring(startBrace, endBrace + 1);
            }
        }

        return cleaned;
    }

    /**
     * Determine chart priority based on type and features
     */
    private String determinePriority(String chartType, DataFeatures features) {
        // High priority scenarios
        if ("line".equals(chartType) && features.isHasTimeSeries()) {
            return "high";
        }
        if ("bar".equals(chartType) && features.isHasBudgetActual()) {
            return "high";
        }
        if ("bar".equals(chartType) && features.isHasYoYMoM()) {
            return "high";
        }
        if ("pie".equals(chartType) && features.isHasProportion()) {
            return "high";
        }

        // Medium priority scenarios
        if ("bar".equals(chartType) && features.isHasComparison()) {
            return "medium";
        }
        if ("pie".equals(chartType) && features.getCategoricalColumns().size() == 1) {
            return "medium";
        }

        // Low priority for others
        return "low";
    }

    /**
     * Get numeric order for priority comparison
     */
    private int getPriorityOrder(String priority) {
        if (priority == null) return 99;
        return switch (priority.toLowerCase()) {
            case "high" -> 1;
            case "medium" -> 2;
            case "low" -> 3;
            default -> 99;
        };
    }
}
