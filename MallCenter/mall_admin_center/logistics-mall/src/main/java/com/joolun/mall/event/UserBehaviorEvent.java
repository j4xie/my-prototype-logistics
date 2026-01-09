package com.joolun.mall.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 用户行为事件
 * 用于触发实时特征更新
 */
@Getter
public class UserBehaviorEvent extends ApplicationEvent {

    private final Long userId;
    private final String productId;
    private final BehaviorType behaviorType;
    private final String source;
    private final double value;
    private final long eventTime;

    public UserBehaviorEvent(Object source, Long userId, String productId,
                             BehaviorType behaviorType, String eventSource, double value) {
        super(source);
        this.userId = userId;
        this.productId = productId;
        this.behaviorType = behaviorType;
        this.source = eventSource;
        this.value = value;
        this.eventTime = System.currentTimeMillis();
    }

    /**
     * 行为类型枚举
     */
    public enum BehaviorType {
        VIEW,           // 浏览
        CLICK,          // 点击
        SEARCH,         // 搜索
        PURCHASE,       // 购买
        FAVORITE,       // 收藏
        UNFAVORITE,     // 取消收藏
        ADD_CART,       // 加入购物车
        REMOVE_CART,    // 移出购物车
        SHARE,          // 分享
        COMMENT,        // 评论
        AI_CHAT         // AI对话
    }

    /**
     * 创建浏览事件
     */
    public static UserBehaviorEvent view(Object source, Long userId, String productId, int duration) {
        return new UserBehaviorEvent(source, userId, productId, BehaviorType.VIEW, "view", duration);
    }

    /**
     * 创建点击事件
     */
    public static UserBehaviorEvent click(Object source, Long userId, String productId, String clickSource) {
        return new UserBehaviorEvent(source, userId, productId, BehaviorType.CLICK, clickSource, 1);
    }

    /**
     * 创建搜索事件
     */
    public static UserBehaviorEvent search(Object source, Long userId, String query, int resultCount) {
        return new UserBehaviorEvent(source, userId, query, BehaviorType.SEARCH, "search", resultCount);
    }

    /**
     * 创建购买事件
     */
    public static UserBehaviorEvent purchase(Object source, Long userId, String productId, double amount) {
        return new UserBehaviorEvent(source, userId, productId, BehaviorType.PURCHASE, "purchase", amount);
    }

    /**
     * 创建收藏事件
     */
    public static UserBehaviorEvent favorite(Object source, Long userId, String productId, boolean isFavorite) {
        BehaviorType type = isFavorite ? BehaviorType.FAVORITE : BehaviorType.UNFAVORITE;
        return new UserBehaviorEvent(source, userId, productId, type, "favorite", isFavorite ? 1 : 0);
    }

    /**
     * 创建AI对话事件
     */
    public static UserBehaviorEvent aiChat(Object source, Long userId, String sessionId, int messageCount) {
        return new UserBehaviorEvent(source, userId, sessionId, BehaviorType.AI_CHAT, "ai_chat", messageCount);
    }
}
