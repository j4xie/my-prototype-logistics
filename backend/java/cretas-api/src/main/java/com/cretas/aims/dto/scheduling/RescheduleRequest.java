package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 重新调度请求
 */
@Data
public class RescheduleRequest {
    @NotNull(message = "计划ID不能为空")
    private String planId;

    // 原因
    private String reason;

    // 可选：是否保留已完成的排程
    private Boolean keepCompletedSchedules = true;

    // 可选：是否重新分配工人
    private Boolean reassignWorkers = true;

    // 可选：目标完成概率阈值
    private Double targetProbability = 0.8;
}
