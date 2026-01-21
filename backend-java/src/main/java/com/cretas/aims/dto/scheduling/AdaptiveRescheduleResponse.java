package com.cretas.aims.dto.scheduling;

import lombok.Data;

/**
 * 重排响应 DTO
 */
@Data
public class AdaptiveRescheduleResponse {
    private String scheduleBatchNo;
    private int rescheduledTasks;
    private double beforeOnTimeRate;
    private double afterOnTimeRate;
    private double improvementPercent;
}
