package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 任务预测 DTO
 */
@Data
public class TaskPredictionDTO {
    private String taskId;
    private double completionProbability;
    private String riskLevel;
    private LocalDateTime predictedEnd;
    private int estimatedDelayMinutes;
    private Map<String, Double> featureContributions; // 各特征的贡献度
}
