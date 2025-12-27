package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 完成概率响应 DTO
 */
@Data
public class CompletionProbabilityResponse {
    private String scheduleId;
    private String productionLineName;
    private String batchNumber;
    private BigDecimal probability;
    private BigDecimal meanHours;
    private BigDecimal stdHours;
    private BigDecimal percentile90;
    private BigDecimal confidenceLower;
    private BigDecimal confidenceUpper;
    private Integer remainingQuantity;
    private Double deadlineHours;
    private Integer currentWorkers;
    private String riskLevel; // low, medium, high, critical
    private String suggestion;

    // AI 预测相关字段
    private String predictionMode;      // "hybrid" 或 "llm_only"
    private String modelVersion;        // ML模型版本（如果使用）
    private BigDecimal confidence;      // 预测置信度
    private BigDecimal predictedEfficiency; // 预测效率
    private String explanation;         // AI 解释
    private String riskAnalysis;        // 风险分析
}
