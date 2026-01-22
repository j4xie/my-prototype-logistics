package com.cretas.aims.service.executor.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.executor.AnalysisExecutionService;
import com.cretas.aims.service.executor.ResponseBuilderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 分析类意图执行服务实现
 *
 * 负责分析类意图的执行，包括数据聚合、报表生成等
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalysisExecutionServiceImpl implements AnalysisExecutionService {

    private final ResponseBuilderService responseBuilderService;
    private final ObjectMapper objectMapper;

    // 分析类意图代码集合
    private static final Set<String> ANALYSIS_INTENT_CODES = Set.of(
            "QUERY_PRODUCTION_STATS",
            "QUERY_QUALITY_REPORT",
            "QUERY_EFFICIENCY_ANALYSIS",
            "QUERY_COST_ANALYSIS",
            "QUERY_TREND_ANALYSIS",
            "GENERATE_DAILY_REPORT",
            "GENERATE_WEEKLY_REPORT",
            "ANALYZE_BOTTLENECK",
            "PREDICT_COMPLETION"
    );

    // 预计算分析结果缓存
    private final Map<String, Map<String, Object>> precomputedCache = new ConcurrentHashMap<>();

    @Override
    public IntentExecuteResponse executeAnalysisFlow(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intent,
                                                      IntentMatchResult matchResult,
                                                      Long userId, String userRole, String sessionId) {
        try {
            String intentCode = intent.getIntentCode();
            log.info("Executing analysis flow: {} for factory {}", intentCode, factoryId);

            // 获取预计算结果或执行新分析
            Map<String, Object> analysisContext = getPrecomputedAnalysisContext(factoryId, intentCode);

            // 提取请求参数
            Map<String, Object> parameters = extractParameters(request, matchResult);

            // 执行数据聚合
            Object analysisData = executeDataAggregation(factoryId, intent, parameters);

            // 生成响应消息
            String responseMessage = generateConversationalResponse(factoryId, request.getUserInput(),
                    intent, analysisData);

            return responseBuilderService.buildSuccessResponse(intent, analysisData, responseMessage);

        } catch (Exception e) {
            log.error("Analysis execution failed: {}", e.getMessage(), e);
            return responseBuilderService.buildErrorResponse(intent, "分析执行失败: " + e.getMessage(),
                    "ANALYSIS_ERROR");
        }
    }

    @Override
    public String generateConversationalResponse(String factoryId, String userInput,
                                                  AIIntentConfig intent, Object analysisData) {
        if (analysisData == null) {
            return "抱歉，未找到相关分析数据。";
        }

        // 使用响应模板
        String template = intent.getResponseTemplate();
        if (template != null && !template.isBlank()) {
            return responseBuilderService.applyResponseTemplate(intent, analysisData);
        }

        // 生成默认响应
        String intentCode = intent.getIntentCode();
        return switch (intentCode) {
            case "QUERY_PRODUCTION_STATS" -> formatProductionStatsResponse(analysisData);
            case "QUERY_QUALITY_REPORT" -> formatQualityReportResponse(analysisData);
            case "QUERY_EFFICIENCY_ANALYSIS" -> formatEfficiencyResponse(analysisData);
            case "QUERY_COST_ANALYSIS" -> formatCostAnalysisResponse(analysisData);
            case "PREDICT_COMPLETION" -> formatPredictionResponse(analysisData);
            default -> "分析完成，请查看详细数据。";
        };
    }

    @Override
    public Map<String, Object> getPrecomputedAnalysisContext(String factoryId, String intentCode) {
        String cacheKey = factoryId + ":" + intentCode;
        return precomputedCache.getOrDefault(cacheKey, new HashMap<>());
    }

    @Override
    public boolean isAnalysisIntent(AIIntentConfig intent) {
        if (intent == null) {
            return false;
        }

        // 检查意图代码
        if (ANALYSIS_INTENT_CODES.contains(intent.getIntentCode())) {
            return true;
        }

        // 检查意图分类
        String category = intent.getIntentCategory();
        return "analysis".equalsIgnoreCase(category) ||
                "report".equalsIgnoreCase(category) ||
                "statistics".equalsIgnoreCase(category);
    }

    @Override
    public Object executeDataAggregation(String factoryId, AIIntentConfig intent,
                                          Map<String, Object> parameters) {
        String intentCode = intent.getIntentCode();
        log.debug("Executing data aggregation for intent: {} with params: {}", intentCode, parameters);

        // 根据意图类型执行不同的聚合逻辑
        // 这里返回模拟数据，实际应该调用相应的服务
        return switch (intentCode) {
            case "QUERY_PRODUCTION_STATS" -> aggregateProductionStats(factoryId, parameters);
            case "QUERY_QUALITY_REPORT" -> aggregateQualityData(factoryId, parameters);
            case "QUERY_EFFICIENCY_ANALYSIS" -> aggregateEfficiencyData(factoryId, parameters);
            case "QUERY_COST_ANALYSIS" -> aggregateCostData(factoryId, parameters);
            case "PREDICT_COMPLETION" -> calculatePrediction(factoryId, parameters);
            default -> Map.of("message", "分析功能开发中");
        };
    }

    @Override
    public String formatAnalysisResult(Object analysisData, AIIntentConfig intent) {
        return responseBuilderService.applyResponseTemplate(intent, analysisData);
    }

    /**
     * 提取请求参数
     */
    private Map<String, Object> extractParameters(IntentExecuteRequest request, IntentMatchResult matchResult) {
        Map<String, Object> params = new HashMap<>();

        if (request.getParameters() != null) {
            params.putAll(request.getParameters());
        }

        // 从匹配结果中提取参数
        if (matchResult != null && matchResult.getExtractedParams() != null) {
            params.putAll(matchResult.getExtractedParams());
        }

        return params;
    }

    // ==================== 数据聚合方法 ====================

    private Map<String, Object> aggregateProductionStats(String factoryId, Map<String, Object> params) {
        // 模拟生产统计数据
        return Map.of(
                "totalOrders", 150,
                "completedOrders", 120,
                "inProgressOrders", 25,
                "pendingOrders", 5,
                "completionRate", 0.80,
                "avgCycleTime", 2.5
        );
    }

    private Map<String, Object> aggregateQualityData(String factoryId, Map<String, Object> params) {
        return Map.of(
                "totalInspections", 500,
                "passedCount", 485,
                "failedCount", 15,
                "passRate", 0.97,
                "topDefects", Map.of("外观瑕疵", 8, "尺寸偏差", 5, "其他", 2)
        );
    }

    private Map<String, Object> aggregateEfficiencyData(String factoryId, Map<String, Object> params) {
        return Map.of(
                "overallEfficiency", 0.85,
                "lineEfficiencies", Map.of(
                        "LINE-001", 0.88,
                        "LINE-002", 0.82,
                        "LINE-003", 0.85
                ),
                "bottlenecks", Map.of("设备故障", 3, "物料短缺", 2)
        );
    }

    private Map<String, Object> aggregateCostData(String factoryId, Map<String, Object> params) {
        return Map.of(
                "totalCost", 125000.00,
                "materialCost", 80000.00,
                "laborCost", 35000.00,
                "overheadCost", 10000.00,
                "costPerUnit", 25.00
        );
    }

    private Map<String, Object> calculatePrediction(String factoryId, Map<String, Object> params) {
        return Map.of(
                "predictedCompletion", "2026-01-25 18:00",
                "confidence", 0.85,
                "riskFactors", Map.of("设备老化", "中", "人员不足", "低")
        );
    }

    // ==================== 响应格式化方法 ====================

    private String formatProductionStatsResponse(Object data) {
        if (data instanceof Map) {
            Map<?, ?> stats = (Map<?, ?>) data;
            return String.format("生产统计：共%s个订单，已完成%s个，完成率%.1f%%",
                    stats.get("totalOrders"),
                    stats.get("completedOrders"),
                    ((Number) stats.get("completionRate")).doubleValue() * 100);
        }
        return "生产统计数据已生成。";
    }

    private String formatQualityReportResponse(Object data) {
        if (data instanceof Map) {
            Map<?, ?> stats = (Map<?, ?>) data;
            return String.format("质量报告：检验%s件，合格率%.1f%%",
                    stats.get("totalInspections"),
                    ((Number) stats.get("passRate")).doubleValue() * 100);
        }
        return "质量报告已生成。";
    }

    private String formatEfficiencyResponse(Object data) {
        if (data instanceof Map) {
            Map<?, ?> stats = (Map<?, ?>) data;
            return String.format("效率分析：整体效率%.1f%%",
                    ((Number) stats.get("overallEfficiency")).doubleValue() * 100);
        }
        return "效率分析已完成。";
    }

    private String formatCostAnalysisResponse(Object data) {
        if (data instanceof Map) {
            Map<?, ?> stats = (Map<?, ?>) data;
            return String.format("成本分析：总成本¥%.2f，单位成本¥%.2f",
                    ((Number) stats.get("totalCost")).doubleValue(),
                    ((Number) stats.get("costPerUnit")).doubleValue());
        }
        return "成本分析已完成。";
    }

    private String formatPredictionResponse(Object data) {
        if (data instanceof Map) {
            Map<?, ?> stats = (Map<?, ?>) data;
            return String.format("预计完成时间：%s，置信度%.0f%%",
                    stats.get("predictedCompletion"),
                    ((Number) stats.get("confidence")).doubleValue() * 100);
        }
        return "预测分析已完成。";
    }
}
