package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;

/**
 * MMR (Maximal Marginal Relevance) 多样性控制服务
 * 基于抖音推荐系统"多样性控制"设计
 *
 * 核心公式:
 * MMR = λ × Score_i - (1-λ) × max_{j∈S} Sim(v_i, v_j)
 *
 * 其中:
 * - λ: 多样性系数 (0.7 = 70%看分数，30%看多样性)
 * - Score_i: 商品i的推荐分数
 * - Sim(v_i, v_j): 商品i和已选商品j的相似度
 * - S: 已选商品集合
 *
 * 目标: 避免推荐一整屏同类商品，提升用户发现新品类的可能
 */
public interface MMRDiversityService {

    /**
     * 应用MMR多样性重排序
     *
     * @param products 已按分数排序的商品列表
     * @param scores 商品分数映射
     * @param limit 返回数量
     * @return 多样性重排后的商品列表
     */
    List<GoodsSpu> applyMMRReranking(List<GoodsSpu> products, Map<String, Double> scores, int limit);

    /**
     * 应用MMR多样性重排序 (使用默认分数)
     *
     * @param products 已按分数排序的商品列表
     * @param limit 返回数量
     * @return 多样性重排后的商品列表
     */
    List<GoodsSpu> applyMMRReranking(List<GoodsSpu> products, int limit);

    /**
     * 计算两个商品的相似度
     *
     * @param product1 商品1
     * @param product2 商品2
     * @return 相似度 (0-1)
     */
    double calculateSimilarity(GoodsSpu product1, GoodsSpu product2);

    /**
     * 计算商品与已选集合的最大相似度
     *
     * @param product 待评估商品
     * @param selectedProducts 已选商品集合
     * @return 最大相似度
     */
    double calculateMaxSimilarity(GoodsSpu product, List<GoodsSpu> selectedProducts);

    /**
     * 计算MMR分数
     *
     * @param product 商品
     * @param relevanceScore 相关性分数
     * @param selectedProducts 已选商品集合
     * @param lambda 多样性系数
     * @return MMR分数
     */
    double calculateMMRScore(GoodsSpu product, double relevanceScore,
                             List<GoodsSpu> selectedProducts, double lambda);

    /**
     * 获取多样性分析报告
     *
     * @param products 商品列表
     * @return 分析报告 (分类分布、商家分布、价格分布等)
     */
    Map<String, Object> getDiversityAnalysis(List<GoodsSpu> products);

    /**
     * 检查推荐列表的多样性是否达标
     *
     * @param products 推荐商品列表
     * @param minCategories 最小分类数
     * @param maxSameCategoryRatio 同一分类最大占比
     * @return 是否达标
     */
    boolean checkDiversityThreshold(List<GoodsSpu> products, int minCategories, double maxSameCategoryRatio);
}
