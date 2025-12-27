package com.joolun.mall.dto;

import lombok.Data;
import java.time.LocalDateTime;

/**
 * 行为事件DTO
 */
@Data
public class BehaviorEventDTO {
    /**
     * 微信用户ID
     */
    private String wxUserId;

    /**
     * 事件类型: view/click/search/cart_add/cart_remove/purchase/favorite/share
     */
    private String eventType;

    /**
     * 事件时间
     */
    private LocalDateTime eventTime;

    /**
     * 目标类型: product/category/merchant/search
     */
    private String targetType;

    /**
     * 目标ID
     */
    private String targetId;

    /**
     * 目标名称
     */
    private String targetName;

    /**
     * 事件详情 (JSON字符串)
     */
    private String eventData;

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 设备类型: ios/android/devtools
     */
    private String deviceType;

    /**
     * 来源类型: home/search/category/recommend/share
     */
    private String sourceType;

    /**
     * 来源ID
     */
    private String sourceId;
}
