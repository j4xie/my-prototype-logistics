package com.cretas.aims.service.executor;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.MultiIntentResult;

/**
 * 多意图编排服务接口
 *
 * 负责多意图的编排和执行，包括：
 * - 多意图并行执行
 * - 多意图串行执行
 * - 结果合并
 * - 确认响应构建
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface MultiIntentOrchestrationService {

    /**
     * 执行多意图
     */
    IntentExecuteResponse executeMultiIntent(String factoryId, IntentExecuteRequest request,
                                              MultiIntentResult multiIntentResult,
                                              Long userId, String userRole, String sessionId);

    /**
     * 并行执行多意图
     */
    IntentExecuteResponse executeMultiIntentParallel(String factoryId, IntentExecuteRequest request,
                                                      MultiIntentResult multiIntentResult,
                                                      Long userId, String userRole, String sessionId);

    /**
     * 串行执行多意图
     */
    IntentExecuteResponse executeMultiIntentSequential(String factoryId, IntentExecuteRequest request,
                                                        MultiIntentResult multiIntentResult,
                                                        Long userId, String userRole, String sessionId);

    /**
     * 合并多意图执行结果
     */
    IntentExecuteResponse mergeMultiIntentResults(java.util.List<IntentExecuteResponse> responses);

    /**
     * 构建多意图确认响应
     */
    IntentExecuteResponse buildMultiIntentConfirmationResponse(MultiIntentResult multiIntentResult);
}
