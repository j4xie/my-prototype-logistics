package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 生产线实体
 * 代表一条独立的生产产线
 *
 * 支持场景:
 * 1. 多产线并行生产
 * 2. 产线能力差异
 * 3. 产线可生产品类限制
 * 4. 多班次管理
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_production_line")
public class ProductionLine {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 产线编号
     */
    private String lineNo;

    /**
     * 产线名称
     */
    private String lineName;

    /**
     * 产线类型: assembly/packaging/processing/mixing
     */
    private String lineType;

    /**
     * 所属车间ID
     */
    private String workshopId;

    // ==================== 能力参数 ====================

    /**
     * 标准产能(件/小时)
     */
    private BigDecimal standardCapacity;

    /**
     * 最大产能(件/小时)
     */
    private BigDecimal maxCapacity;

    /**
     * 效率系数 (0.8-1.2)
     */
    private BigDecimal efficiencyFactor;

    /**
     * 可生产的产品类别(逗号分隔)
     */
    private String productCategories;

    /**
     * 标准人员配置数
     */
    private Integer standardWorkerCount;

    /**
     * 最小人员配置数
     */
    private Integer minWorkerCount;

    /**
     * 最大人员配置数
     */
    private Integer maxWorkerCount;

    // ==================== 班次配置 ====================

    /**
     * 班次模式: single/double/triple
     */
    private String shiftMode;

    /**
     * 早班开始时间
     */
    private LocalTime shift1Start;

    /**
     * 早班结束时间
     */
    private LocalTime shift1End;

    /**
     * 中班开始时间
     */
    private LocalTime shift2Start;

    /**
     * 中班结束时间
     */
    private LocalTime shift2End;

    /**
     * 晚班开始时间
     */
    private LocalTime shift3Start;

    /**
     * 晚班结束时间
     */
    private LocalTime shift3End;

    // ==================== 当前状态 ====================

    /**
     * 状态: available/running/maintenance/offline
     */
    private String status;

    /**
     * 当前生产的订单ID
     */
    private String currentOrderId;

    /**
     * 当前生产的产品类别
     */
    private String currentProductCategory;

    /**
     * 当前班次人数
     */
    private Integer currentWorkerCount;

    /**
     * 今日已完成产量
     */
    private BigDecimal todayOutput;

    /**
     * 预计空闲时间
     */
    private LocalDateTime estimatedFreeTime;

    // ==================== 维护信息 ====================

    /**
     * 下次计划维护时间
     */
    private LocalDateTime nextMaintenanceTime;

    /**
     * 维护周期(小时)
     */
    private Integer maintenanceCycleHours;

    /**
     * 自上次维护累计运行时间(小时)
     */
    private BigDecimal runningHoursSinceMaintenance;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
