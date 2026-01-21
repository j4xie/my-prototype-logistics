package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 生产设备实体
 * 代表独立的生产设备(可共享资源)
 *
 * 支持场景:
 * 1. 设备能力约束
 * 2. 设备共享/冲突检测
 * 3. 设备维护窗口
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_production_equipment")
public class ProductionEquipment {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 设备编号
     */
    private String equipmentNo;

    /**
     * 设备名称
     */
    private String equipmentName;

    /**
     * 设备类型: mixer/filler/sealer/labeler/wrapper
     */
    private String equipmentType;

    /**
     * 所属产线ID (空表示共享设备)
     */
    private String lineId;

    /**
     * 是否共享设备
     */
    private Boolean isShared;

    // ==================== 能力参数 ====================

    /**
     * 标准处理速度(件/小时)
     */
    private BigDecimal standardSpeed;

    /**
     * 最大处理速度(件/小时)
     */
    private BigDecimal maxSpeed;

    /**
     * 可处理的产品类别(逗号分隔)
     */
    private String productCategories;

    /**
     * 需要的操作人员数
     */
    private Integer requiredOperators;

    // ==================== 当前状态 ====================

    /**
     * 状态: available/running/setup/maintenance/fault
     */
    private String status;

    /**
     * 当前处理的订单ID
     */
    private String currentOrderId;

    /**
     * 当前处理的产品类别
     */
    private String currentProductCategory;

    /**
     * 预计空闲时间
     */
    private LocalDateTime estimatedFreeTime;

    // ==================== 维护信息 ====================

    /**
     * 上次维护时间
     */
    private LocalDateTime lastMaintenanceTime;

    /**
     * 下次计划维护时间
     */
    private LocalDateTime nextMaintenanceTime;

    /**
     * 累计运行时间(小时)
     */
    private BigDecimal totalRunningHours;

    /**
     * 故障率 (0-1)
     */
    private BigDecimal failureRate;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
