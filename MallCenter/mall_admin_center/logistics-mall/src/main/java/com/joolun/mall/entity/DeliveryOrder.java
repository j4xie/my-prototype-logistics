package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 配送订单实体
 * 用于订单-车辆调度优化系统
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Data
@TableName("delivery_order")
public class DeliveryOrder {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 关联OrderInfo
     */
    private String orderId;

    /**
     * 客户ID
     */
    private String customerId;

    /**
     * 配送地址
     */
    private String deliveryAddress;

    /**
     * 纬度
     */
    private BigDecimal latitude;

    /**
     * 经度
     */
    private BigDecimal longitude;

    /**
     * 区域
     */
    private String district;

    /**
     * 期望最早配送时间
     */
    private LocalDateTime expectedStart;

    /**
     * 期望最晚配送时间
     */
    private LocalDateTime expectedEnd;

    /**
     * 优先级 1-5
     */
    private Integer priority;

    /**
     * 重量(kg)
     */
    private BigDecimal weight;

    /**
     * 体积(m³)
     */
    private BigDecimal volume;

    /**
     * 商品件数
     */
    private Integer itemCount;

    /**
     * 是否需要冷链
     */
    private Boolean requiresCold;

    /**
     * 分配的车辆ID
     */
    private String vehicleId;

    /**
     * 在路线中的顺序
     */
    private Integer sequenceInRoute;

    /**
     * 计划配送时间
     */
    private LocalDateTime scheduledTime;

    /**
     * 实际开始时间
     */
    private LocalDateTime actualStartTime;

    /**
     * 实际完成时间
     */
    private LocalDateTime actualEndTime;

    /**
     * 状态: pending/scheduled/delivering/completed/failed
     */
    private String status;

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
