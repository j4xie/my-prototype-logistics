package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 调度 Dashboard DTO
 */
@Data
public class SchedulingDashboardDTO {
    private LocalDate date;

    // 计划统计
    private Integer totalPlans;
    private Integer confirmedPlans;
    private Integer inProgressPlans;
    private Integer completedPlans;

    // 排程统计
    private Integer totalSchedules;
    private Integer pendingSchedules;
    private Integer inProgressSchedules;
    private Integer completedSchedules;
    private Integer delayedSchedules;

    // 产能统计
    private Integer totalPlannedQuantity;
    private Integer totalCompletedQuantity;
    private BigDecimal overallCompletionRate;
    private BigDecimal averageEfficiency;

    // 人员统计
    private Integer totalWorkers;
    private Integer checkedInWorkers;
    private Integer temporaryWorkers;
    private Integer onLeaveWorkers;

    // 告警统计
    private Integer totalAlerts;
    private Integer criticalAlerts;
    private Integer unresolvedAlerts;

    // 产线状态
    private List<ProductionLineDTO> productionLines;

    // 实时排程
    private List<LineScheduleDTO> currentSchedules;

    // 未解决告警
    private List<SchedulingAlertDTO> alerts;
}
