/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 优惠券
 *
 * @author JL
 * @date 2024-12-25
 */
@Data
@TableName("mall_coupon")
public class Coupon implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * 优惠券ID
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 优惠券名称
     */
    private String name;

    /**
     * 优惠券类型: FIXED-满减券, PERCENT-折扣券, AMOUNT-现金券
     */
    private String type;

    /**
     * 满减门槛金额
     */
    private BigDecimal minAmount;

    /**
     * 折扣金额
     */
    private BigDecimal discountAmount;

    /**
     * 折扣百分比 (如: 8.5 表示85折)
     */
    private BigDecimal discountPercent;

    /**
     * 最大优惠金额
     */
    private BigDecimal maxDiscount;

    /**
     * 总发行量
     */
    private Integer totalCount;

    /**
     * 已领取数量
     */
    private Integer receivedCount;

    /**
     * 已使用数量
     */
    private Integer usedCount;

    /**
     * 适用商品ID (逗号分隔，空表示全部商品)
     */
    private String applicableSpuIds;

    /**
     * 适用分类ID (逗号分隔，空表示全部分类)
     */
    private String applicableCategoryIds;

    /**
     * 生效时间
     */
    private LocalDateTime startTime;

    /**
     * 失效时间
     */
    private LocalDateTime expireTime;

    /**
     * 状态: 0-禁用, 1-启用
     */
    private String status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
