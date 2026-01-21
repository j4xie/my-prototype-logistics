package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 人员分配实体
 * 记录人员在各任务/产线间的分配
 *
 * 支持场景:
 * 1. 人员调配 (一条线结束后调到另一条线)
 * 2. 加班安排
 * 3. 技能匹配
 * 4. 人员利用率分析
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_worker_assignment")
public class WorkerAssignment {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 排程批次号
     */
    private String scheduleBatchNo;

    /**
     * 人员ID
     */
    private String workerId;

    /**
     * 人员姓名
     */
    private String workerName;

    /**
     * 任务ID
     */
    private String taskId;

    /**
     * 产线ID
     */
    private String lineId;

    /**
     * 产线名称
     */
    private String lineName;

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
     * 计划工作时长(分钟)
     */
    private Integer plannedMinutes;

    /**
     * 实际工作时长(分钟)
     */
    private Integer actualMinutes;

    // ==================== 分配原因 ====================

    /**
     * 分配类型: initial/transfer/overtime/support
     * initial: 初始分配
     * transfer: 产线间调配
     * overtime: 加班
     * support: 临时支援
     */
    private String assignmentType;

    /**
     * 调配来源产线ID
     */
    private String fromLineId;

    /**
     * 调配原因
     */
    private String transferReason;

    // ==================== 状态 ====================

    /**
     * 状态: planned/confirmed/working/completed/cancelled
     */
    private String status;

    /**
     * 是否加班
     */
    private Boolean isOvertime;

    /**
     * 加班时长(分钟)
     */
    private Integer overtimeMinutes;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
