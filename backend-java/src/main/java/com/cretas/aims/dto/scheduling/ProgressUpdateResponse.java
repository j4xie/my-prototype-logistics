package com.cretas.aims.dto.scheduling;

import lombok.Data;

/**
 * 进度上报响应 DTO
 */
@Data
public class ProgressUpdateResponse {
    private String taskId;
    private double previousProgress;
    private double currentProgress;
    private double completionProbability;
    private String riskLevel;
    private boolean needsAttention;
    private String message;
}
