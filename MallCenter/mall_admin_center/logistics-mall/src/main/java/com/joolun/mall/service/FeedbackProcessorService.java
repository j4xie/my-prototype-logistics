package com.joolun.mall.service;

import java.util.Map;

/**
 * 反馈处理服务
 * 处理真实用户反馈和模拟反馈，将反馈数据关联到推荐日志并训练CTR模型
 *
 * 处理流程:
 * UserBehaviorEvent → FeedbackProcessor → RecommendationLog.isClicked
 *                                       → CTRPredictionService.updateModel()
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
public interface FeedbackProcessorService {

    /**
     * 处理真实用户反馈
     * 从UserBehaviorEvent中提取点击/购买事件，更新RecommendationLog
     *
     * @return 处理统计，包含:
     *   - processedClicks: 处理的点击事件数
     *   - processedPurchases: 处理的购买事件数
     *   - matchedLogs: 匹配到的推荐日志数
     */
    Map<String, Object> processRealFeedback();

    /**
     * 处理模拟反馈
     * 调用SimulatedFeedbackService生成反馈，然后训练CTR模型
     *
     * @return 处理统计
     */
    Map<String, Object> processSimulatedFeedback();

    /**
     * 从反馈数据训练CTR模型
     * 读取最近N天有反馈的RecommendationLog，构建训练数据
     *
     * @param days 天数范围
     * @return 训练统计
     */
    Map<String, Object> trainCTRFromRecentFeedback(int days);

    /**
     * 处理单个点击事件
     * 将点击事件关联到最近的推荐日志
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return 是否成功匹配
     */
    boolean processClickEvent(String wxUserId, String productId);

    /**
     * 处理单个购买事件
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return 是否成功匹配
     */
    boolean processPurchaseEvent(String wxUserId, String productId);

    /**
     * 获取反馈处理统计
     *
     * @return 统计信息，包含:
     *   - totalProcessed: 总处理数
     *   - realFeedbackCount: 真实反馈数
     *   - simulatedFeedbackCount: 模拟反馈数
     *   - lastProcessTime: 最后处理时间
     *   - ctrModelSamples: CTR模型训练样本数
     */
    Map<String, Object> getProcessingStats();
}
