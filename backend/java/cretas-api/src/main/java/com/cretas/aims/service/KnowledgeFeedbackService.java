package com.cretas.aims.service;

import java.util.List;

/**
 * 知识库反馈服务接口
 *
 * 收集用户反馈，用于知识库自学习和改进。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface KnowledgeFeedbackService {

    /**
     * 反馈类型
     */
    enum FeedbackType {
        POSITIVE,       // 正面反馈
        NEGATIVE,       // 负面反馈
        CORRECTION,     // 纠正
        AUTO_APPROVED   // 自动审核通过
    }

    /**
     * 记录用户反馈
     *
     * @param sessionId 会话ID
     * @param query 用户查询
     * @param response AI响应
     * @param type 反馈类型
     */
    void recordFeedback(String sessionId, String query, String response, FeedbackType type);

    /**
     * 记录用户反馈（带纠正文本）
     *
     * @param sessionId 会话ID
     * @param query 用户查询
     * @param response AI响应
     * @param type 反馈类型
     * @param correctionText 纠正文本
     */
    void recordFeedback(String sessionId, String query, String response,
                        FeedbackType type, String correctionText);

    /**
     * 从工厂数据中学习新知识
     *
     * @param factoryId 工厂ID
     */
    void learnFromFactoryData(String factoryId);

    /**
     * 获取未处理的反馈数量
     *
     * @return 未处理反馈数
     */
    long getUnprocessedFeedbackCount();

    /**
     * 处理反馈并更新知识库
     *
     * @param batchSize 批次大小
     * @return 处理数量
     */
    int processFeedbackBatch(int batchSize);
}
