package com.joolun.mall.service;

import java.util.Map;

/**
 * 自适应探索率服务
 *
 * 根据用户状态动态调整探索率:
 * - cold_start (冷启动): 35% - 新用户需要更多探索
 * - warming (预热期): 25% - 适度探索
 * - mature (成熟用户): 12% - 少探索多利用
 * - inactive (不活跃): 30% - 重新激活需要探索
 *
 * 探索策略:
 * - LinUCB: Upper Confidence Bound 探索
 * - Thompson Sampling: 贝叶斯概率探索
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
public interface AdaptiveExplorationService {

    /**
     * 用户状态常量
     */
    String STATUS_COLD_START = "cold_start";
    String STATUS_WARMING = "warming";
    String STATUS_MATURE = "mature";
    String STATUS_INACTIVE = "inactive";

    /**
     * 默认探索率配置
     */
    double RATE_COLD_START = 0.35;
    double RATE_WARMING = 0.25;
    double RATE_MATURE = 0.12;
    double RATE_INACTIVE = 0.30;
    double RATE_MATURE_DECLINING = 0.30;  // 活跃度下降的成熟用户

    /**
     * 探索率上下限
     */
    double MIN_EXPLORATION_RATE = 0.05;
    double MAX_EXPLORATION_RATE = 0.40;

    /**
     * 计算用户的自适应探索率
     *
     * @param wxUserId 用户ID
     * @return 探索率 [0.05, 0.40]
     */
    double calculateExplorationRate(String wxUserId);

    /**
     * 获取用户状态
     *
     * @param wxUserId 用户ID
     * @return 用户状态 (cold_start, warming, mature, inactive)
     */
    String getUserStatus(String wxUserId);

    /**
     * 检测用户活跃度是否下降
     * 比较最近7天与之前7天的行为数
     *
     * @param wxUserId 用户ID
     * @return 是否活跃度下降
     */
    boolean isActivityDecreasing(String wxUserId);

    /**
     * LinUCB探索决策
     * 使用Upper Confidence Bound计算探索分数
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @param predictedCTR 预测的CTR
     * @return 带UCB加成的分数
     */
    double calculateLinUCBScore(String wxUserId, String productId, double predictedCTR);

    /**
     * Thompson Sampling探索决策
     * 从Beta分布采样获得概率
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return 采样概率
     */
    double sampleThompson(String wxUserId, String productId);

    /**
     * 更新探索统计
     * 在用户点击/未点击后更新Beta分布参数
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @param clicked 是否点击
     */
    void updateExplorationStats(String wxUserId, String productId, boolean clicked);

    /**
     * 判断是否应该进行探索
     * 根据探索率随机决定
     *
     * @param wxUserId 用户ID
     * @return 是否探索
     */
    boolean shouldExplore(String wxUserId);

    /**
     * 获取探索服务统计
     *
     * @return 统计信息
     */
    Map<String, Object> getExplorationStats();

    /**
     * 获取用户的探索历史
     *
     * @param wxUserId 用户ID
     * @return 探索历史
     */
    Map<String, Object> getUserExplorationHistory(String wxUserId);
}
