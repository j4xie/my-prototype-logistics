package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Set;

/**
 * 多臂老虎机探索器接口
 * 统一 Thompson Sampling 和 LinUCB 等探索算法的调用接口
 *
 * 核心概念:
 * - 探索 (Exploration): 尝试推荐用户未接触过的内容，发现新兴趣
 * - 利用 (Exploitation): 推荐已知用户喜欢的内容，最大化即时收益
 * - Bandit算法的目标是平衡探索与利用，最大化长期累积收益
 */
public interface BanditExplorer {

    /**
     * 获取探索性推荐（用户从未/很少接触的分类或商品）
     *
     * @param wxUserId 微信用户ID
     * @param knownCategories 用户已知兴趣的分类集合
     * @param limit 返回数量限制
     * @return 探索性推荐的商品列表
     */
    List<GoodsSpu> getExplorationRecommendations(String wxUserId,
                                                  Set<String> knownCategories,
                                                  int limit);

    /**
     * 更新强化学习奖励
     * 当用户对推荐内容产生正向/负向行为时调用
     *
     * @param wxUserId 微信用户ID
     * @param itemId 商品ID或分类ID（取决于具体实现）
     * @param isPositive 是否正向反馈 (点击/购买=true, 曝光未互动=false)
     */
    void updateReward(String wxUserId, String itemId, boolean isPositive);

    /**
     * 获取算法名称，用于日志和监控
     *
     * @return 算法名称 (如 "ThompsonSampling", "LinUCB")
     */
    String getAlgorithmName();

    /**
     * 决定是否进行探索
     *
     * @param explorationRate 探索率 (0.0-1.0)
     * @return true表示应该探索新内容
     */
    boolean shouldExplore(double explorationRate);

    /**
     * 使用默认探索率决定是否探索
     *
     * @return true表示应该探索新内容
     */
    default boolean shouldExplore() {
        return shouldExplore(0.2);  // 默认20%探索率
    }

    /**
     * 获取探索来源（用于追踪反馈）
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return 探索来源标识，如果不是探索推荐则返回null
     */
    String getExplorationSource(String wxUserId, String productId);

    /**
     * 处理探索商品的用户反馈
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @param isPositive 是否正向反馈
     */
    void handleExplorationFeedback(String wxUserId, String productId, boolean isPositive);
}
