package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 用户行为事件表
 * 记录所有用户行为用于兴趣分析和推荐
 */
@Data
@TableName("user_behavior_events")
@EqualsAndHashCode(callSuper = true)
public class UserBehaviorEvent extends Model<UserBehaviorEvent> {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 微信用户ID (小程序openid)
     */
    private String wxUserId;

    /**
     * 事件类型: view/click/search/cart_add/cart_remove/purchase/favorite/share
     */
    private String eventType;

    /**
     * 事件发生时间
     */
    private LocalDateTime eventTime;

    /**
     * 目标类型: product/category/merchant/search
     */
    private String targetType;

    /**
     * 目标ID (商品ID/商家ID等)
     */
    private String targetId;

    /**
     * 目标名称 (用于快速查询)
     */
    private String targetName;

    /**
     * 事件详情数据 (JSON格式)
     */
    private String eventData;

    /**
     * 会话ID (用于追踪单次访问)
     */
    private String sessionId;

    /**
     * 设备类型: ios/android/devtools
     */
    private String deviceType;

    /**
     * IP地址
     */
    private String ipAddress;

    /**
     * 来源类型: home/search/category/recommend/share
     */
    private String sourceType;

    /**
     * 来源ID (分享者ID、推荐位ID等)
     */
    private String sourceId;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
