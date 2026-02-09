package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.util.List;

/**
 * 任务风险信息 DTO
 */
@Data
public class TaskRiskDTO {
    private String taskId;
    private String taskNo;
    private String productName;
    private String lineName;
    private double completionProbability;
    private int estimatedDelayMinutes;
    private String riskLevel;
    private String riskReason;
    private List<String> suggestedActions;
}
