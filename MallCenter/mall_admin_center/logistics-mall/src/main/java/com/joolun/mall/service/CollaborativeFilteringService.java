package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;

/**
 * 协同过滤推荐服务
 * 实现Item-Based和User-Based协同过滤
 *
 * 核心算法:
 * score(u, i) = Σ(sim(i, j) × rating(u, j)) / Σ|sim(i, j)|
 * 其中 j 是用户u交互过的商品，sim(i,j)是商品相似度
 *
 * 交互类型权重:
 * - 购买(purchase): 1.0
 * - 加购(cart_add): 0.5
 * - 收藏(favorite): 0.4
 * - 浏览(view): 0.1
 *
 * @author MallCenter
 * @date 2026-01-19
 */
public interface CollaborativeFilteringService {

    /**
     * Item-Based CF: 基于商品相似度推荐
     * 根据用户历史交互商品，推荐相似商品
     *
     * @param wxUserId 用户ID
     * @param limit 返回数量
     * @return 推荐商品列表
     */
    List<GoodsSpu> getItemBasedRecommendations(String wxUserId, int limit);

    /**
     * 计算两个商品的相似度 (余弦相似度)
     * 基于用户-商品交互矩阵计算
     *
     * @param productId1 商品1 ID
     * @param productId2 商品2 ID
     * @return 相似度值 [0, 1]
     */
    double calculateItemSimilarity(String productId1, String productId2);

    /**
     * 获取商品的相似商品列表
     * 从预计算的相似度矩阵中获取
     *
     * @param productId 商品ID
     * @param limit 返回数量
     * @return 相似商品ID列表 (按相似度降序)
     */
    List<String> getSimilarItems(String productId, int limit);

    /**
     * 更新商品相似度矩阵 (定时任务调用)
     * 每天凌晨2点全量更新
     * 缓存到Redis: cf:item:similarity:{productId}
     */
    void updateSimilarityMatrix();

    /**
     * 获取用户的协同过滤推荐分数
     * 对候选商品计算CF得分
     *
     * @param wxUserId 用户ID
     * @param candidateIds 候选商品ID列表
     * @return 商品ID -> CF得分 映射
     */
    Map<String, Double> getUserCFScores(String wxUserId, List<String> candidateIds);

    /**
     * 获取与指定商品相似的商品推荐
     * 用于商品详情页的"相似商品"推荐
     *
     * @param productId 当前商品ID
     * @param wxUserId 用户ID (可选，用于个性化排序)
     * @param limit 返回数量
     * @return 相似商品列表
     */
    List<GoodsSpu> getSimilarProductRecommendations(String productId, String wxUserId, int limit);

    /**
     * 刷新指定商品的相似度缓存
     * 当商品信息更新时调用
     *
     * @param productId 商品ID
     */
    void refreshItemSimilarityCache(String productId);

    /**
     * 获取商品相似度矩阵更新状态
     *
     * @return 状态信息 (lastUpdateTime, totalItems, avgSimilarCount)
     */
    Map<String, Object> getSimilarityMatrixStatus();
}
