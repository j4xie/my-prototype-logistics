package com.joolun.mall.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * 用户行为事件发布器
 * 提供便捷的方法发布各类用户行为事件
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserBehaviorEventPublisher {

    private final ApplicationEventPublisher eventPublisher;

    /**
     * 发布浏览事件
     * @param userId 用户ID
     * @param productId 商品ID
     * @param duration 浏览时长(秒)
     */
    public void publishView(Long userId, String productId, int duration) {
        UserBehaviorEvent event = UserBehaviorEvent.view(this, userId, productId, duration);
        eventPublisher.publishEvent(event);
        log.debug("发布浏览事件: userId={}, productId={}", userId, productId);
    }

    /**
     * 发布点击事件
     * @param userId 用户ID
     * @param productId 商品ID
     * @param source 点击来源 (ai_chat, search, homepage, category等)
     */
    public void publishClick(Long userId, String productId, String source) {
        UserBehaviorEvent event = UserBehaviorEvent.click(this, userId, productId, source);
        eventPublisher.publishEvent(event);
        log.debug("发布点击事件: userId={}, productId={}, source={}", userId, productId, source);
    }

    /**
     * 发布搜索事件
     * @param userId 用户ID
     * @param query 搜索词
     * @param resultCount 结果数量
     */
    public void publishSearch(Long userId, String query, int resultCount) {
        UserBehaviorEvent event = UserBehaviorEvent.search(this, userId, query, resultCount);
        eventPublisher.publishEvent(event);
        log.debug("发布搜索事件: userId={}, query={}", userId, query);
    }

    /**
     * 发布购买事件
     * @param userId 用户ID
     * @param productId 商品ID
     * @param amount 购买金额
     */
    public void publishPurchase(Long userId, String productId, double amount) {
        UserBehaviorEvent event = UserBehaviorEvent.purchase(this, userId, productId, amount);
        eventPublisher.publishEvent(event);
        log.debug("发布购买事件: userId={}, productId={}, amount={}", userId, productId, amount);
    }

    /**
     * 发布收藏事件
     * @param userId 用户ID
     * @param productId 商品ID
     * @param isFavorite 是否收藏
     */
    public void publishFavorite(Long userId, String productId, boolean isFavorite) {
        UserBehaviorEvent event = UserBehaviorEvent.favorite(this, userId, productId, isFavorite);
        eventPublisher.publishEvent(event);
        log.debug("发布收藏事件: userId={}, productId={}, isFavorite={}", userId, productId, isFavorite);
    }

    /**
     * 发布AI对话事件
     * @param userId 用户ID
     * @param sessionId 会话ID
     * @param messageCount 消息数量
     */
    public void publishAiChat(Long userId, String sessionId, int messageCount) {
        UserBehaviorEvent event = UserBehaviorEvent.aiChat(this, userId, sessionId, messageCount);
        eventPublisher.publishEvent(event);
        log.debug("发布AI对话事件: userId={}, sessionId={}", userId, sessionId);
    }

    /**
     * 批量发布商品曝光事件
     * @param userId 用户ID
     * @param productIds 商品ID列表
     * @param source 曝光来源
     */
    public void publishImpressions(Long userId, java.util.List<String> productIds, String source) {
        for (String productId : productIds) {
            UserBehaviorEvent event = UserBehaviorEvent.view(this, userId, productId, 0);
            eventPublisher.publishEvent(event);
        }
        log.debug("发布曝光事件: userId={}, productCount={}, source={}", userId, productIds.size(), source);
    }
}
