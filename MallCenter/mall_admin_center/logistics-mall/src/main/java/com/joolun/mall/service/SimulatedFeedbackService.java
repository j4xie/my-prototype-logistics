package com.joolun.mall.service;

import java.util.Map;

/**
 * 模拟反馈服务
 * 基于用户画像和聚类信息生成模拟的点击/购买反馈，用于训练CTR模型
 *
 * 点击概率计算公式:
 * P(click|user, item) = base_ctr × cluster_affinity × category_match × price_match × recency_boost
 *
 * 研究依据:
 * - G-UBS: 基于用户群组的行为模拟，过滤隐式负反馈噪声
 * - AMAN策略: 未观察物品视为负样本，但需处理分布偏差
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
public interface SimulatedFeedbackService {

    /**
     * 基础CTR (行业平均)
     */
    double BASE_CTR = 0.05;

    /**
     * 基础CVR (点击后购买转化率)
     */
    double BASE_CVR = 0.15;

    /**
     * 生成模拟反馈
     * 处理最近N天的推荐日志，基于用户画像生成点击/购买反馈
     *
     * @param days 处理的天数范围 (默认7天)
     * @return 处理统计，包含:
     *   - processed: 处理的日志数
     *   - clicked: 模拟点击数
     *   - purchased: 模拟购买数
     *   - clickRate: 模拟点击率
     */
    Map<String, Object> generateSimulatedFeedback(int days);

    /**
     * 使用默认7天范围生成模拟反馈
     *
     * @return 处理统计
     */
    default Map<String, Object> generateSimulatedFeedback() {
        return generateSimulatedFeedback(7);
    }

    /**
     * 从反馈数据训练CTR模型
     * 读取RecommendationLog中有反馈的记录，构建训练数据并更新CTR模型
     *
     * @return 训练统计，包含:
     *   - samples: 训练样本数
     *   - positiveRate: 正样本率
     *   - success: 是否成功
     */
    Map<String, Object> trainCTRModelFromFeedback();

    /**
     * 计算用户对商品的点击概率
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return 点击概率 [0, 1]
     */
    double calculateClickProbability(String wxUserId, String productId);

    /**
     * 计算用户对商品的购买概率 (基于点击)
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @param hasClicked 是否已点击
     * @return 购买概率 [0, 1]
     */
    double calculatePurchaseProbability(String wxUserId, String productId, boolean hasClicked);

    /**
     * 获取聚类亲和度
     * 计算用户聚类与商品品类的匹配度
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return 亲和度系数 [0.3, 2.0]
     */
    double getClusterAffinity(String wxUserId, String productId);

    /**
     * 获取模拟反馈统计
     *
     * @return 统计信息，包含:
     *   - totalSimulated: 总模拟反馈数
     *   - lastSimulatedTime: 最后模拟时间
     *   - avgClickRate: 平均模拟点击率
     *   - avgPurchaseRate: 平均模拟购买率
     */
    Map<String, Object> getSimulationStats();
}
