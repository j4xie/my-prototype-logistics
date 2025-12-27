package com.joolun.mall.service;

import com.joolun.mall.entity.UserBehaviorEvent;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.entity.UserRecommendationProfile;

import java.util.List;
import java.util.Map;

/**
 * 用户行为追踪服务
 * 记录用户行为并更新兴趣标签
 */
public interface UserBehaviorTrackingService {

    /**
     * 记录用户行为事件
     */
    void trackEvent(UserBehaviorEvent event);

    /**
     * 批量记录用户行为事件
     */
    void trackEvents(List<UserBehaviorEvent> events);

    /**
     * 记录商品浏览事件
     */
    void trackProductView(String wxUserId, String productId, String productName,
                          Map<String, Object> eventData);

    /**
     * 记录搜索事件
     */
    void trackSearch(String wxUserId, String keyword, int resultCount);

    /**
     * 记录加购事件
     */
    void trackCartAdd(String wxUserId, String productId, String productName, int quantity);

    /**
     * 记录购买事件
     */
    void trackPurchase(String wxUserId, List<String> productIds, Map<String, Object> orderInfo);

    /**
     * 获取用户兴趣标签
     */
    List<UserInterestTag> getUserInterestTags(String wxUserId, int limit);

    /**
     * 获取用户推荐画像
     */
    UserRecommendationProfile getUserProfile(String wxUserId);

    /**
     * 更新用户兴趣标签 (基于最近行为)
     */
    void updateUserInterests(String wxUserId);

    /**
     * 获取用户搜索历史
     */
    List<String> getSearchHistory(String wxUserId, int limit);

    /**
     * 获取用户最近浏览的商品
     */
    List<String> getRecentViewedProducts(String wxUserId, int limit);

    /**
     * 完成冷启动
     * 用户首次使用时选择偏好后调用，保存初始偏好并标记冷启动已完成
     *
     * @param wxUserId 用户ID
     * @param preferences 用户选择的偏好 (categories, priceRange, brands)
     */
    void completeColdStart(String wxUserId, Map<String, Object> preferences);

    /**
     * 检查用户是否需要显示冷启动弹窗
     *
     * @param wxUserId 用户ID
     * @return true = 需要显示冷启动弹窗 (首次用户), false = 不需要显示
     */
    boolean needsShowColdStart(String wxUserId);

    /**
     * 处理被忽略的推荐 (负向反馈)
     * 当用户请求新推荐或离开页面时，对之前展示但未点击的探索推荐发送负向反馈
     *
     * @param wxUserId 用户ID
     * @return 处理的负向反馈数量
     */
    int processIgnoredRecommendations(String wxUserId);
}
