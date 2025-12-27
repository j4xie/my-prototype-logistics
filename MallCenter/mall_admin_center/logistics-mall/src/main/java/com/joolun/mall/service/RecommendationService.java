package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;

/**
 * 推荐服务接口
 * 基于用户兴趣生成个性化推荐
 */
public interface RecommendationService {

    /**
     * 获取首页推荐商品
     * @param wxUserId 用户ID
     * @param limit 数量限制
     * @return 推荐商品列表
     */
    List<GoodsSpu> getHomeRecommendations(String wxUserId, int limit);

    /**
     * 获取搜索结果的个性化排序
     * @param wxUserId 用户ID
     * @param keyword 搜索关键词
     * @param products 原始搜索结果
     * @return 重排序后的商品列表
     */
    List<GoodsSpu> reorderSearchResults(String wxUserId, String keyword, List<GoodsSpu> products);

    /**
     * 获取相似商品推荐
     * @param wxUserId 用户ID
     * @param productId 当前商品ID
     * @param limit 数量限制
     * @return 相似商品列表
     */
    List<GoodsSpu> getSimilarProducts(String wxUserId, String productId, int limit);

    /**
     * 获取购物车推荐
     * @param wxUserId 用户ID
     * @param cartProductIds 购物车中的商品ID
     * @param limit 数量限制
     * @return 推荐商品列表
     */
    List<GoodsSpu> getCartRecommendations(String wxUserId, List<String> cartProductIds, int limit);

    /**
     * 获取"猜你喜欢"推荐
     * @param wxUserId 用户ID
     * @param page 页码
     * @param size 每页数量
     * @return 推荐商品列表和分页信息
     */
    Map<String, Object> getYouMayLike(String wxUserId, int page, int size);

    /**
     * 获取热门推荐 (用于冷启动)
     * @param category 分类 (可选)
     * @param limit 数量限制
     * @return 热门商品列表
     */
    List<GoodsSpu> getPopularProducts(String category, int limit);

    /**
     * 刷新推荐缓存
     * @param wxUserId 用户ID
     */
    void refreshRecommendationCache(String wxUserId);
}
