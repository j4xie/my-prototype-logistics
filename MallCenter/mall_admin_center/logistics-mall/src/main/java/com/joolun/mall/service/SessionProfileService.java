package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 会话级实时画像服务
 * 基于抖音推荐系统"实时反馈闭环飞轮"设计
 *
 * 核心公式:
 * v_u^new = v_u^old + η × (v_product - v_u^old)
 *
 * 学习率配置:
 * - 强信号（购买）: η = 0.3
 * - 中信号（加购/收藏）: η = 0.15
 * - 弱信号（浏览 >10s）: η = 0.05
 *
 * 会话画像特点:
 * - TTL: 30分钟 (用户离开后自动过期)
 * - 实时更新: 行为发生后立即生效
 * - 与长期画像融合: 推荐时混合使用
 */
public interface SessionProfileService {

    /**
     * 记录商品浏览行为 (实时更新会话画像)
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param product 浏览的商品
     * @param durationSeconds 浏览时长(秒)
     */
    void recordView(String wxUserId, String sessionId, GoodsSpu product, int durationSeconds);

    /**
     * 记录加购行为 (中信号)
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param product 加购的商品
     */
    void recordCartAdd(String wxUserId, String sessionId, GoodsSpu product);

    /**
     * 记录收藏行为 (中信号)
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param product 收藏的商品
     */
    void recordFavorite(String wxUserId, String sessionId, GoodsSpu product);

    /**
     * 记录购买行为 (强信号)
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param products 购买的商品列表
     */
    void recordPurchase(String wxUserId, String sessionId, List<GoodsSpu> products);

    /**
     * 记录搜索行为
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param keyword 搜索关键词
     */
    void recordSearch(String wxUserId, String sessionId, String keyword);

    /**
     * 获取会话级兴趣分类 (用于推荐召回)
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @return 感兴趣的分类ID集合 (按权重排序)
     */
    Set<String> getSessionCategories(String wxUserId, String sessionId);

    /**
     * 获取会话级兴趣权重
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @return 标签 -> 权重 映射
     */
    Map<String, Double> getSessionInterestWeights(String wxUserId, String sessionId);

    /**
     * 获取会话级价格偏好
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @return 价格偏好 (min, max, avg)
     */
    Map<String, Double> getSessionPricePreference(String wxUserId, String sessionId);

    /**
     * 获取会话内最近浏览的商品ID
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param limit 数量限制
     * @return 商品ID列表
     */
    List<String> getRecentViewedInSession(String wxUserId, String sessionId, int limit);

    /**
     * 计算商品与会话画像的匹配度
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @param product 商品
     * @return 匹配度 (0-1)
     */
    double calculateSessionMatch(String wxUserId, String sessionId, GoodsSpu product);

    /**
     * 融合长期画像和会话画像的兴趣权重
     *
     * @param longTermWeights 长期画像权重
     * @param sessionWeights 会话画像权重
     * @param sessionWeight 会话权重占比 (0-1)
     * @return 融合后的权重
     */
    Map<String, Double> mergeInterestWeights(
            Map<String, Double> longTermWeights,
            Map<String, Double> sessionWeights,
            double sessionWeight);

    /**
     * 检查会话是否活跃
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     * @return 是否活跃
     */
    boolean isSessionActive(String wxUserId, String sessionId);

    /**
     * 清除会话画像 (用户主动登出时)
     *
     * @param wxUserId 用户ID
     * @param sessionId 会话ID
     */
    void clearSessionProfile(String wxUserId, String sessionId);
}
