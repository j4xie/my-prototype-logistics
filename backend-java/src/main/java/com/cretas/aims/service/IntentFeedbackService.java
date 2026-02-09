package com.cretas.aims.service;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;

import java.util.List;

/**
 * 意图反馈服务接口
 *
 * 处理用户对意图识别结果的反馈，用于持续优化意图识别模型
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface IntentFeedbackService {

    /**
     * 记录正向反馈（用户确认识别正确）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param matchedKeywords 匹配的关键词
     */
    void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords);

    /**
     * 记录负向反馈（用户纠正识别错误）
     *
     * @param factoryId 工厂ID
     * @param rejectedIntentCode 被拒绝的意图代码
     * @param selectedIntentCode 用户选择的正确意图代码
     * @param matchedKeywords 匹配的关键词
     */
    void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                 String selectedIntentCode, List<String> matchedKeywords);

    /**
     * 处理完整的意图反馈请求
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param request 反馈请求
     */
    void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request);
}
