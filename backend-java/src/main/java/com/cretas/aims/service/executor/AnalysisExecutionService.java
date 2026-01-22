package com.cretas.aims.service.executor;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.Map;

/**
 * 分析类意图执行服务接口
 *
 * 负责分析类意图的执行，包括：
 * - 分析流程执行
 * - 对话式响应生成
 * - 预计算分析上下文获取
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface AnalysisExecutionService {

    /**
     * 执行分析流程
     */
    IntentExecuteResponse executeAnalysisFlow(String factoryId, IntentExecuteRequest request,
                                               AIIntentConfig intent,
                                               IntentMatchResult matchResult,
                                               Long userId, String userRole, String sessionId);

    /**
     * 生成对话式响应
     */
    String generateConversationalResponse(String factoryId, String userInput,
                                           AIIntentConfig intent, Object analysisData);

    /**
     * 获取预计算分析上下文
     */
    Map<String, Object> getPrecomputedAnalysisContext(String factoryId, String intentCode);

    /**
     * 判断是否为分析类意图
     */
    boolean isAnalysisIntent(AIIntentConfig intent);

    /**
     * 执行数据聚合分析
     */
    Object executeDataAggregation(String factoryId, AIIntentConfig intent,
                                   Map<String, Object> parameters);

    /**
     * 格式化分析结果
     */
    String formatAnalysisResult(Object analysisData, AIIntentConfig intent);
}
