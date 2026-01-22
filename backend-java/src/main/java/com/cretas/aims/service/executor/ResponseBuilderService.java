package com.cretas.aims.service.executor;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;

/**
 * 响应构建服务接口
 *
 * 负责各类响应的构建和格式化，包括：
 * - 无匹配响应
 * - 澄清响应
 * - 候选动作
 * - 默认建议
 * - 验证失败响应
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface ResponseBuilderService {

    /**
     * 构建无匹配响应
     */
    IntentExecuteResponse buildNoMatchResponse(String factoryId, IntentExecuteRequest request,
                                                IntentMatchResult matchResult);

    /**
     * 构建澄清响应
     */
    IntentExecuteResponse buildClarificationResponse(String factoryId, IntentExecuteRequest request,
                                                      IntentMatchResult matchResult);

    /**
     * 构建候选动作列表
     */
    List<IntentExecuteResponse.CandidateAction> buildCandidateActions(IntentMatchResult matchResult);

    /**
     * 构建默认建议
     */
    List<String> buildDefaultSuggestions(String factoryId);

    /**
     * 构建验证失败响应
     */
    IntentExecuteResponse buildValidationFailureResponse(String factoryId,
                                                          IntentExecuteRequest request,
                                                          AIIntentConfig intent,
                                                          String validationMessage);

    /**
     * 处理验证失败
     */
    IntentExecuteResponse handleValidationFailure(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intent,
                                                   List<String> validationErrors);

    /**
     * 构建成功响应
     */
    IntentExecuteResponse buildSuccessResponse(String message, Object data, AIIntentConfig intent);

    /**
     * 构建错误响应
     */
    IntentExecuteResponse buildErrorResponse(String message, String errorCode);
}
