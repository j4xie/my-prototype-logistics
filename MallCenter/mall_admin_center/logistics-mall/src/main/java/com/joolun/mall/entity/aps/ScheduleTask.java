package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 排程任务实体
 * 代表一个具体的生产任务安排(Gantt图中的一个块)
 *
 * 支持场景:
 * 1. 订单拆分 (一个订单拆成多个任务)
 * 2. 混批合并 (多个小订单合并成一个任务)
 * 3. 跨天任务 (任务跨越日期边界)
 * 4. 资源分配 (产线、设备、模具、人员)
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_schedule_task")
public class ScheduleTask {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 任务编号
     */
    private String taskNo;

    /**
     * 排程批次号 (同一次排程的标识)
     */
    private String scheduleBatchNo;

    /**
     * 关联生产订单ID
     */
    private String orderId;

    /**
     * 关联生产订单号
     */
    private String orderNo;

    /**
     * 任务类型: production/changeover/maintenance/break
     */
    private String taskType;

    // ==================== 产品信息 ====================

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
     * 产品类别
     */
    private String productCategory;

    /**
     * 计划生产数量
     */
    private BigDecimal plannedQty;

    /**
     * 实际完成数量
     */
    private BigDecimal completedQty;

    // ==================== 时间安排 ====================

    /**
     * 计划开始时间
     */
    private LocalDateTime plannedStart;

    /**
     * 计划结束时间
     */
    private LocalDateTime plannedEnd;

    /**
     * 实际开始时间
     */
    private LocalDateTime actualStart;

    /**
     * 实际结束时间
     */
    private LocalDateTime actualEnd;

    /**
     * 计划时长(分钟)
     */
    private Integer plannedDuration;

    /**
     * 实际时长(分钟)
     */
    private Integer actualDuration;

    /**
     * 是否跨天
     */
    private Boolean isCrossDay;

    // ==================== 资源分配 ====================

    /**
     * 分配的产线ID
     */
    private String lineId;

    /**
     * 分配的产线名称
     */
    private String lineName;

    /**
     * 分配的设备ID
     */
    private String equipmentId;

    /**
     * 分配的模具ID
     */
    private String moldId;

    /**
     * 分配的人员ID列表(逗号分隔)
     */
    private String workerIds;

    /**
     * 分配的人员数量
     */
    private Integer workerCount;

    // ==================== 换型信息 ====================

    /**
     * 前置订单ID
     */
    private String previousOrderId;

    /**
     * 换型时间(分钟)
     */
    private Integer changeoverMinutes;

    /**
     * 是否需要清洁
     */
    private Boolean requiresCleaning;

    // ==================== 约束满足 ====================

    /**
     * 是否满足时间窗口约束
     */
    private Boolean meetsTimeWindow;

    /**
     * 与交期的差距(分钟，负数表示提前)
     */
    private Integer deliveryGapMinutes;

    /**
     * 是否满足物料约束
     */
    private Boolean meetsMaterialConstraint;

    // ==================== 状态 ====================

    /**
     * 状态: planned/confirmed/in_progress/paused/completed/cancelled
     */
    private String status;

    /**
     * 在产线排程中的顺序
     */
    private Integer sequenceInLine;

    /**
     * 进度百分比 (0-100)
     */
    private Integer progressPercent;

    // ==================== 元数据 ====================

    /**
     * 是否混批任务
     */
    private Boolean isMixBatch;

    /**
     * 混批包含的订单ID列表(逗号分隔)
     */
    private String mixBatchOrderIds;

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
