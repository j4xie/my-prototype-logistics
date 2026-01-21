package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 生产模具实体
 * 代表生产所需的模具(稀缺共享资源)
 *
 * 支持场景:
 * 1. 模具共享冲突
 * 2. 模具换型时间
 * 3. 模具使用寿命管理
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_production_mold")
public class ProductionMold {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 模具编号
     */
    private String moldNo;

    /**
     * 模具名称
     */
    private String moldName;

    /**
     * 模具类型
     */
    private String moldType;

    /**
     * 适用产品规格(逗号分隔)
     */
    private String applicableSpecs;

    /**
     * 适用产品类别
     */
    private String productCategory;

    // ==================== 能力参数 ====================

    /**
     * 穴数(每次生产数量)
     */
    private Integer cavityCount;

    /**
     * 标准周期时间(秒)
     */
    private Integer standardCycleTime;

    /**
     * 安装时间(分钟)
     */
    private Integer setupTime;

    /**
     * 拆卸时间(分钟)
     */
    private Integer teardownTime;

    // ==================== 使用状态 ====================

    /**
     * 状态: available/in_use/maintenance/scrapped
     */
    private String status;

    /**
     * 当前所在设备ID
     */
    private String currentEquipmentId;

    /**
     * 当前所在产线ID
     */
    private String currentLineId;

    /**
     * 当前生产的订单ID
     */
    private String currentOrderId;

    /**
     * 预计空闲时间
     */
    private LocalDateTime estimatedFreeTime;

    // ==================== 寿命管理 ====================

    /**
     * 设计寿命(次数)
     */
    private Integer designLifeCycles;

    /**
     * 已使用次数
     */
    private Integer usedCycles;

    /**
     * 剩余寿命百分比
     */
    private BigDecimal remainingLifePercent;

    /**
     * 上次维护时间
     */
    private LocalDateTime lastMaintenanceTime;

    /**
     * 维护周期(使用次数)
     */
    private Integer maintenanceCycleCounts;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
