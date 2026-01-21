package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 排程冲突实体
 * 记录排程过程中检测到的资源冲突
 *
 * 支持场景:
 * 1. 设备冲突 (多订单需要同一设备)
 * 2. 模具冲突 (模具被占用)
 * 3. 人员冲突 (人员不足)
 * 4. 时间冲突 (无法满足交期)
 * 5. 物料冲突 (物料未到)
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_schedule_conflict")
public class ScheduleConflict {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 排程批次号
     */
    private String scheduleBatchNo;

    /**
     * 冲突类型: equipment/mold/worker/time_window/material/capacity
     */
    private String conflictType;

    /**
     * 冲突严重度: low/medium/high/critical
     */
    private String severity;

    // ==================== 冲突详情 ====================

    /**
     * 冲突订单1 ID
     */
    private String order1Id;

    /**
     * 冲突订单1 编号
     */
    private String order1No;

    /**
     * 冲突订单2 ID (可能为空)
     */
    private String order2Id;

    /**
     * 冲突订单2 编号
     */
    private String order2No;

    /**
     * 冲突资源ID (设备/模具/人员ID)
     */
    private String conflictResourceId;

    /**
     * 冲突资源名称
     */
    private String conflictResourceName;

    /**
     * 冲突时间段开始
     */
    private LocalDateTime conflictStart;

    /**
     * 冲突时间段结束
     */
    private LocalDateTime conflictEnd;

    /**
     * 冲突描述
     */
    private String description;

    // ==================== 解决方案 ====================

    /**
     * 建议的解决方案
     */
    private String suggestedSolution;

    /**
     * 是否已解决
     */
    private Boolean isResolved;

    /**
     * 解决方式
     */
    private String resolutionMethod;

    /**
     * 解决时间
     */
    private LocalDateTime resolvedAt;

    /**
     * 解决备注
     */
    private String resolutionNote;

    // ==================== 影响评估 ====================

    /**
     * 影响的订单数
     */
    private Integer affectedOrderCount;

    /**
     * 预计延迟时间(分钟)
     */
    private Integer estimatedDelayMinutes;

    /**
     * 影响的交付金额(元)
     */
    private Integer affectedDeliveryValue;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
