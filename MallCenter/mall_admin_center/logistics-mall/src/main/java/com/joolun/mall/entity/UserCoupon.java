/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户优惠券
 *
 * @author JL
 * @date 2024-12-25
 */
@Data
@TableName("mall_user_coupon")
public class UserCoupon implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * 用户优惠券ID
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 用户ID
     */
    private String userId;

    /**
     * 优惠券ID
     */
    private String couponId;

    /**
     * 状态: 0-未使用, 1-已使用, 2-已过期
     */
    private String status;

    /**
     * 领取时间
     */
    private LocalDateTime receiveTime;

    /**
     * 使用时间
     */
    private LocalDateTime useTime;

    /**
     * 使用的订单ID
     */
    private String orderId;

    /**
     * 过期时间
     */
    private LocalDateTime expireTime;

    /**
     * 优惠券信息 (非数据库字段)
     */
    @TableField(exist = false)
    private Coupon coupon;

    /**
     * 是否可用 (非数据库字段)
     */
    @TableField(exist = false)
    private Boolean canUse;

    /**
     * 不可用原因 (非数据库字段)
     */
    @TableField(exist = false)
    private String disabledReason;
}
