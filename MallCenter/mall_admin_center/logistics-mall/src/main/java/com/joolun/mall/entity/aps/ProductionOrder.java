package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 生产订单实体
 * APS (Advanced Planning and Scheduling) 系统核心实体
 *
 * 支持场景:
 * 1. 多产线协调
 * 2. 混批生产
 * 3. 工艺约束
 * 4. 跨天排程
 * 5. 紧急插单
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_production_order")
public class ProductionOrder {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 生产订单号
     */
    private String orderNo;

    /**
     * 关联销售订单ID
     */
    private String salesOrderId;

    /**
     * 产品ID
     */
    private String productId;

    /**
     * 产品名称
     */
    private String productName;

    /**
     * 产品规格
     */
    private String productSpec;

    /**
     * 产品类别 (用于换型时间计算)
     */
    private String productCategory;

    /**
     * 计划数量
     */
    private BigDecimal plannedQty;

    /**
     * 已完成数量
     */
    private BigDecimal completedQty;

    /**
     * 单位
     */
    private String unit;

    // ==================== 时间约束 ====================

    /**
     * 最早开始时间 (工艺约束)
     */
    private LocalDateTime earliestStart;

    /**
     * 最晚完成时间 (交期)
     */
    private LocalDateTime latestEnd;

    /**
     * 计划开始时间 (排程结果)
     */
    private LocalDateTime plannedStart;

    /**
     * 计划完成时间 (排程结果)
     */
    private LocalDateTime plannedEnd;

    /**
     * 实际开始时间
     */
    private LocalDateTime actualStart;

    /**
     * 实际完成时间
     */
    private LocalDateTime actualEnd;

    // ==================== 工艺约束 ====================

    /**
     * 工艺路线ID
     */
    private String routingId;

    /**
     * 当前工序序号
     */
    private Integer currentOperationSeq;

    /**
     * 总工序数
     */
    private Integer totalOperations;

    /**
     * 标准工时(分钟/单位)
     */
    private BigDecimal standardTime;

    /**
     * 前置等待时间(分钟) - 如质检等待
     */
    private Integer preWaitTime;

    /**
     * 后置等待时间(分钟) - 如冷却时间
     */
    private Integer postWaitTime;

    // ==================== 资源需求 ====================

    /**
     * 指定产线ID (可为空表示自动分配)
     */
    private String assignedLineId;

    /**
     * 需要的设备类型
     */
    private String requiredEquipmentType;

    /**
     * 需要的模具ID
     */
    private String requiredMoldId;

    /**
     * 需要的人员技能等级 (1-5)
     */
    private Integer requiredSkillLevel;

    /**
     * 需要的人员数量
     */
    private Integer requiredWorkerCount;

    // ==================== 物料约束 ====================

    /**
     * 物料BOM ID
     */
    private String bomId;

    /**
     * 物料齐套状态: ready/partial/waiting
     */
    private String materialStatus;

    /**
     * 物料预计到达时间
     */
    private LocalDateTime materialArrivalTime;

    // ==================== 优先级与状态 ====================

    /**
     * 优先级 1-10 (10最高)
     */
    private Integer priority;

    /**
     * 是否紧急插单
     */
    private Boolean isUrgent;

    /**
     * 状态: pending/scheduled/in_progress/paused/completed/cancelled
     */
    private String status;

    /**
     * 是否允许拆分生产
     */
    private Boolean allowSplit;

    /**
     * 是否允许跨天
     */
    private Boolean allowCrossDay;

    /**
     * 是否允许混批
     */
    private Boolean allowMixBatch;

    // ==================== 排程结果 ====================

    /**
     * 分配的产线ID
     */
    private String scheduledLineId;

    /**
     * 分配的设备ID
     */
    private String scheduledEquipmentId;

    /**
     * 排程批次号
     */
    private String scheduleBatchNo;

    /**
     * 在排程中的顺序
     */
    private Integer scheduleSequence;

    /**
     * 预计换型时间(分钟)
     */
    private Integer changeoverTime;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    /**
     * 备注
     */
    private String remark;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
