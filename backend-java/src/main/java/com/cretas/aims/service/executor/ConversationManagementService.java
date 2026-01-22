package com.cretas.aims.service.executor;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;
import java.util.Map;

/**
 * 对话上下文管理服务接口
 *
 * 负责对话上下文的管理，包括：
 * - 会话记忆更新
 * - 实体槽位提取
 * - 澄清问题生成
 * - 缺失参数解析
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface ConversationManagementService {

    /**
     * 更新对话记忆
     */
    void updateConversationMemory(String factoryId, Long userId, String sessionId,
                                   String userInput, String assistantResponse,
                                   String intentCode);

    /**
     * 提取并更新实体槽位
     */
    Map<String, Object> extractAndUpdateEntitySlots(String factoryId, Long userId,
                                                     String sessionId, String userInput,
                                                     AIIntentConfig intent);

    /**
     * 使用澄清问题丰富响应
     */
    IntentExecuteResponse enrichWithClarificationQuestions(IntentExecuteResponse response,
                                                            AIIntentConfig intent,
                                                            List<String> missingParams);

    /**
     * 解析缺失参数
     */
    List<String> parseMissingParameters(AIIntentConfig intent, Map<String, Object> providedParams);

    /**
     * 生成缺失参数的澄清问题
     */
    String generateClarificationQuestionsForMissingParams(List<String> missingParams,
                                                           AIIntentConfig intent);

    /**
     * 获取或创建对话上下文
     */
    ConversationContext getOrCreateContext(String factoryId, Long userId, String sessionId);
}
