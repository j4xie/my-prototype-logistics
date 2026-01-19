package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.Merchant;

import java.util.List;
import java.util.Map;

/**
 * 策略干预服务接口
 * 基于抖音推荐系统"商业与生态博弈"设计
 *
 * 核心公式:
 * FinalScore = BaseScore
 *            + 0.10 × 新商家30天内
 *            + 0.15 × 新品7天内
 *            + 0.10 × 有促销活动
 *            + 0.05 × 高毛利商品
 *            + 0.10 × 溯源完整度
 */
public interface StrategyInterventionService {

    /**
     * 计算商品的策略干预分数
     *
     * @param product 商品
     * @return 策略干预加分 (可为负数)
     */
    double calculateStrategyBoost(GoodsSpu product);

    /**
     * 计算商品的策略干预分数 (含商家信息缓存)
     *
     * @param product 商品
     * @param merchantCache 商家信息缓存 (避免重复查询)
     * @return 策略干预加分
     */
    double calculateStrategyBoost(GoodsSpu product, Map<Long, Merchant> merchantCache);

    /**
     * 批量计算策略干预分数
     *
     * @param products 商品列表
     * @return 商品ID -> 策略加分 映射
     */
    Map<String, Double> calculateStrategyBoosts(List<GoodsSpu> products);

    /**
     * 应用策略干预重排序
     * 在原有排序基础上叠加策略干预分数
     *
     * @param products 商品列表 (已按基础分排序)
     * @param baseScores 基础分数映射 (商品ID -> 基础分)
     * @return 重排序后的商品列表
     */
    List<GoodsSpu> applyStrategyReranking(List<GoodsSpu> products, Map<String, Double> baseScores);

    /**
     * 获取策略干预详情 (用于调试和解释)
     *
     * @param product 商品
     * @return 各项策略的加分详情
     */
    Map<String, Double> getStrategyBreakdown(GoodsSpu product);

    /**
     * 检查商品是否有活跃促销
     *
     * @param product 商品
     * @return 是否有促销
     */
    boolean hasActivePromotion(GoodsSpu product);

    /**
     * 检查商品溯源完整度
     *
     * @param productId 商品ID
     * @return 溯源完整度 (0-1)
     */
    double getTraceabilityScore(String productId);
}
