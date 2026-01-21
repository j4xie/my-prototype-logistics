package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 配送路线实体
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Data
@TableName("delivery_route")
public class DeliveryRoute {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 车辆ID
     */
    private String vehicleId;

    /**
     * 路线日期
     */
    private LocalDate routeDate;

    /**
     * 订单总数
     */
    private Integer totalOrders;

    /**
     * 总里程(km)
     */
    private BigDecimal totalDistance;

    /**
     * 预计时长(分钟)
     */
    private Integer estimatedDuration;

    /**
     * 实际时长(分钟)
     */
    private Integer actualDuration;

    /**
     * 开始时间
     */
    private LocalDateTime startTime;

    /**
     * 结束时间
     */
    private LocalDateTime endTime;

    /**
     * 路线序列JSON
     */
    private String routeSequence;

    /**
     * 状态: planned/in_progress/completed/cancelled
     */
    private String status;

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
