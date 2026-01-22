package com.cretas.aims.service.intent;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;
import java.util.List;

/**
 * 意图反馈服务
 *
 * 负责用户反馈收集和意图学习
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface IntentFeedbackService {

    /**
     * 记录正向反馈
     * 用户确认意图匹配正确时调用
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图编码
     * @param matchedKeywords 匹配的关键词列表
     */
    void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords);

    /**
     * 记录负向反馈
     * 用户拒绝意图匹配并选择正确意图时调用
     *
     * @param factoryId 工厂ID
     * @param rejectedIntentCode 被拒绝的意图编码
     * @param selectedIntentCode 用户选择的正确意图编码
     * @param matchedKeywords 原匹配的关键词列表
     */
    void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                 String selectedIntentCode, List<String> matchedKeywords);

    /**
     * 处理意图反馈请求
     * 统一处理反馈请求，支持正向和负向反馈
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param request 反馈请求
     */
    void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request);

    /**
     * 尝试自动学习关键词
     * 基于用户反馈自动学习新关键词
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图编码
     * @param keywords 待学习的关键词列表
     * @return 成功学习的关键词数量
     */
    int tryAutoLearnKeywords(String factoryId, String intentCode, List<String> keywords);

    /**
     * 尝试自动学习表达式
     * 基于用户输入自动学习新表达式
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图编码
     * @param expression 用户表达式
     * @return 是否成功学习
     */
    boolean tryAutoLearnExpression(String factoryId, String intentCode, String expression);
}
