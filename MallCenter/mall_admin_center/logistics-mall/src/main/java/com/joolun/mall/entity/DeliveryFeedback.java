package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 配送反馈实体
 * 用于调度模型训练
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Data
@TableName("delivery_feedback")
public class DeliveryFeedback {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 订单ID
     */
    private String orderId;

    /**
     * 车辆ID
     */
    private String vehicleId;

    /**
     * 预测时长(分钟)
     */
    private Integer predictedDuration;

    /**
     * 实际时长(分钟)
     */
    private Integer actualDuration;

    /**
     * 是否准时
     */
    private Boolean isOnTime;

    /**
     * 延误分钟数
     */
    private Integer delayMinutes;

    /**
     * 延误原因
     */
    private String delayReason;

    /**
     * 客户评分1-5
     */
    private Integer customerRating;

    /**
     * 配送距离(km)
     */
    private BigDecimal distanceKm;

    /**
     * 天气情况
     */
    private String weatherCondition;

    /**
     * 交通状况
     */
    private String trafficLevel;

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
}
