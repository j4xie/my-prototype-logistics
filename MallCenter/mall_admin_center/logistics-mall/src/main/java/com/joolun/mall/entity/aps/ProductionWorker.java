package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 生产人员实体
 * 代表参与生产的工人
 *
 * 支持场景:
 * 1. 人员技能匹配
 * 2. 人员在产线间调配
 * 3. 班次管理
 * 4. 加速生产(增员)
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_production_worker")
public class ProductionWorker {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 工号
     */
    private String workerNo;

    /**
     * 姓名
     */
    private String workerName;

    /**
     * 所属部门
     */
    private String department;

    /**
     * 默认产线ID
     */
    private String defaultLineId;

    // ==================== 技能属性 ====================

    /**
     * 技能等级 1-5
     */
    private Integer skillLevel;

    /**
     * 可操作的产线类型(逗号分隔)
     */
    private String capableLineTypes;

    /**
     * 可操作的设备类型(逗号分隔)
     */
    private String capableEquipmentTypes;

    /**
     * 效率系数 (0.8-1.2)
     */
    private BigDecimal efficiencyFactor;

    // ==================== 班次信息 ====================

    /**
     * 当前班次: day/middle/night
     */
    private String currentShift;

    /**
     * 今日上班时间
     */
    private LocalTime shiftStart;

    /**
     * 今日下班时间
     */
    private LocalTime shiftEnd;

    /**
     * 是否可加班
     */
    private Boolean canOvertime;

    /**
     * 最大加班时长(小时)
     */
    private Integer maxOvertimeHours;

    // ==================== 当前状态 ====================

    /**
     * 状态: available/working/break/off
     */
    private String status;

    /**
     * 当前所在产线ID
     */
    private String currentLineId;

    /**
     * 当前任务订单ID
     */
    private String currentOrderId;

    /**
     * 今日累计工作时长(分钟)
     */
    private Integer todayWorkMinutes;

    /**
     * 预计空闲时间
     */
    private LocalDateTime estimatedFreeTime;

    // ==================== 统计信息 ====================

    /**
     * 本月工作天数
     */
    private Integer monthWorkDays;

    /**
     * 本月加班时长(小时)
     */
    private BigDecimal monthOvertimeHours;

    /**
     * 平均每小时产出
     */
    private BigDecimal avgOutputPerHour;

    // ==================== 元数据 ====================

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
