package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.UserProfile;

import java.util.List;
import java.util.Map;

/**
 * 冷启动服务接口
 *
 * 解决两类冷启动问题:
 * 1. 新用户冷启动 - 没有行为历史的用户
 * 2. 新商品冷启动 - 没有交互数据的商品
 *
 * 策略设计:
 * - 新用户: 热门推荐 + 随机探索 + 新品曝光 + 兴趣问卷(可选)
 * - 新商品: 属性匹配 + 强制曝光配额 + 商家信誉加权
 */
public interface ColdStartService {

    // ==================== 用户冷启动 ====================

    /**
     * 判断用户是否为冷启动用户
     *
     * @param wxUserId 用户ID
     * @return true表示冷启动用户
     */
    boolean isNewUser(String wxUserId);

    /**
     * 获取新用户的冷启动推荐
     *
     * 策略:
     * - 40% 热门商品 (销量Top)
     * - 30% 高评分商品 (评分>4.5)
     * - 20% 新品 (上架7天内)
     * - 10% 随机探索 (保持多样性)
     *
     * @param wxUserId 用户ID
     * @param limit 返回数量
     * @return 推荐商品列表
     */
    List<GoodsSpu> getNewUserRecommendations(String wxUserId, int limit);

    /**
     * 获取用户冷启动阶段
     *
     * @param wxUserId 用户ID
     * @return 冷启动阶段: "new"(0行为), "warming"(1-10行为), "warm"(>10行为)
     */
    String getColdStartStage(String wxUserId);

    /**
     * 计算用户冷启动程度 (0-1)
     * 0表示完全冷启动，1表示完全热启动
     *
     * @param wxUserId 用户ID
     * @return 热度分数
     */
    double getUserWarmthScore(String wxUserId);

    /**
     * 将冷启动推荐与个性化推荐融合
     *
     * 融合公式: result = warmth × personalized + (1-warmth) × coldStart
     *
     * @param wxUserId 用户ID
     * @param personalizedProducts 个性化推荐列表
     * @param coldStartProducts 冷启动推荐列表
     * @param limit 返回数量
     * @return 融合后的推荐列表
     */
    List<GoodsSpu> blendRecommendations(String wxUserId,
                                        List<GoodsSpu> personalizedProducts,
                                        List<GoodsSpu> coldStartProducts,
                                        int limit);

    // ==================== 商品冷启动 ====================

    /**
     * 判断商品是否为冷启动商品
     *
     * @param productId 商品ID
     * @return true表示冷启动商品
     */
    boolean isNewProduct(String productId);

    /**
     * 获取冷启动商品列表
     *
     * @param limit 返回数量
     * @return 冷启动商品列表
     */
    List<GoodsSpu> getColdStartProducts(int limit);

    /**
     * 计算商品冷启动程度
     *
     * @param productId 商品ID
     * @return 热度分数 (0-1)
     */
    double getProductWarmthScore(String productId);

    /**
     * 为冷启动商品计算初始分数
     *
     * 使用商品属性估计初始CTR:
     * - 商家评分
     * - 价格区间流行度
     * - 分类热度
     * - 促销状态
     *
     * @param product 商品
     * @param userProfile 用户画像
     * @return 预估分数
     */
    double estimateColdStartScore(GoodsSpu product, UserProfile userProfile);

    /**
     * 获取应该强制曝光的新品配额
     *
     * @param totalLimit 总推荐数量
     * @return 新品配额数量
     */
    int getNewProductQuota(int totalLimit);

    /**
     * 注入冷启动商品到推荐列表
     *
     * @param products 原推荐列表
     * @param coldStartProducts 冷启动商品
     * @param quota 配额数量
     * @return 注入后的列表
     */
    List<GoodsSpu> injectColdStartProducts(List<GoodsSpu> products,
                                            List<GoodsSpu> coldStartProducts,
                                            int quota);

    // ==================== 兴趣引导 ====================

    /**
     * 获取兴趣引导问题
     * 用于新用户首次进入时快速获取偏好
     *
     * @return 兴趣问题列表 (问题ID -> 问题内容)
     */
    Map<String, String> getInterestQuestions();

    /**
     * 处理用户兴趣回答
     *
     * @param wxUserId 用户ID
     * @param answers 回答 (问题ID -> 选项)
     */
    void processInterestAnswers(String wxUserId, Map<String, List<String>> answers);

    /**
     * 根据兴趣回答生成初始推荐
     *
     * @param wxUserId 用户ID
     * @param limit 返回数量
     * @return 基于兴趣的推荐
     */
    List<GoodsSpu> getInterestBasedRecommendations(String wxUserId, int limit);

    // ==================== 统计与监控 ====================

    /**
     * 获取冷启动统计信息
     *
     * @return 统计数据
     */
    Map<String, Object> getColdStartStats();

    /**
     * 记录冷启动商品曝光
     * 用于后续分析冷启动效果
     *
     * @param productId 商品ID
     * @param wxUserId 用户ID
     * @param position 展示位置
     */
    void recordColdStartExposure(String productId, String wxUserId, int position);
}
