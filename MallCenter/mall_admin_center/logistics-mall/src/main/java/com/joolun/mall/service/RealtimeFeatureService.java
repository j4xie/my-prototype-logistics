package com.joolun.mall.service;

import java.util.List;
import java.util.Map;

/**
 * 实时特征服务接口
 * 提供用户和商品的实时特征计算和更新
 */
public interface RealtimeFeatureService {

    // ==================== 用户实时特征 ====================

    /**
     * 获取用户实时特征
     * @param userId 用户ID
     * @return 实时特征Map
     */
    Map<String, Object> getUserRealtimeFeatures(Long userId);

    /**
     * 记录用户浏览行为
     * @param userId 用户ID
     * @param productId 商品ID
     * @param duration 浏览时长(秒)
     */
    void recordView(Long userId, String productId, int duration);

    /**
     * 记录用户点击行为
     * @param userId 用户ID
     * @param productId 商品ID
     * @param source 点击来源
     */
    void recordClick(Long userId, String productId, String source);

    /**
     * 记录用户搜索行为
     * @param userId 用户ID
     * @param query 搜索词
     * @param resultCount 结果数量
     */
    void recordSearch(Long userId, String query, int resultCount);

    /**
     * 记录用户购买行为
     * @param userId 用户ID
     * @param productId 商品ID
     * @param amount 金额
     */
    void recordPurchase(Long userId, String productId, double amount);

    /**
     * 记录用户收藏行为
     * @param userId 用户ID
     * @param productId 商品ID
     * @param isFavorite 是否收藏 (true=收藏, false=取消收藏)
     */
    void recordFavorite(Long userId, String productId, boolean isFavorite);

    /**
     * 获取用户最近浏览的商品ID列表
     * @param userId 用户ID
     * @param limit 数量限制
     * @return 商品ID列表
     */
    List<String> getRecentViewedProducts(Long userId, int limit);

    /**
     * 获取用户最近搜索词
     * @param userId 用户ID
     * @param limit 数量限制
     * @return 搜索词列表
     */
    List<String> getRecentSearchQueries(Long userId, int limit);

    // ==================== 商品实时特征 ====================

    /**
     * 获取商品实时特征
     * @param productId 商品ID
     * @return 实时特征Map
     */
    Map<String, Object> getProductRealtimeFeatures(String productId);

    /**
     * 增加商品浏览量
     * @param productId 商品ID
     */
    void incrementProductView(String productId);

    /**
     * 增加商品点击量
     * @param productId 商品ID
     */
    void incrementProductClick(String productId);

    /**
     * 增加商品销量
     * @param productId 商品ID
     * @param quantity 数量
     */
    void incrementProductSales(String productId, int quantity);

    /**
     * 获取商品热度分数
     * @param productId 商品ID
     * @return 热度分数 (0-100)
     */
    double getProductHotScore(String productId);

    /**
     * 获取热门商品列表
     * @param limit 数量限制
     * @return 商品ID列表(按热度排序)
     */
    List<String> getHotProducts(int limit);

    // ==================== 实时统计 ====================

    /**
     * 获取实时统计数据
     * @return 统计数据
     */
    Map<String, Object> getRealtimeStats();

    /**
     * 获取用户活跃度分数
     * @param userId 用户ID
     * @return 活跃度分数 (0-100)
     */
    double getUserActivityScore(Long userId);

    /**
     * 获取用户价格敏感度
     * @param userId 用户ID
     * @return 价格敏感度 (0-1, 0=不敏感, 1=非常敏感)
     */
    double getUserPriceSensitivity(Long userId);
}
