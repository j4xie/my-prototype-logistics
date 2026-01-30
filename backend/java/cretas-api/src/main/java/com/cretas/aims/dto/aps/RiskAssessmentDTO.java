package com.cretas.aims.dto.aps;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * 风险评估 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAssessmentDTO {

    /**
     * 任务ID
     */
    private String taskId;

    /**
     * 任务编号
     */
    private String taskNo;

    /**
     * 产品名称
     */
    private String productName;

    /**
     * 产线名称
     */
    private String lineName;

    /**
     * 完成概率 [0, 1]
     */
    private double completionProbability;

    /**
     * 风险等级: low/medium/high/critical
     */
    private String riskLevel;

    /**
     * 风险原因
     */
    private String riskReason;

    /**
     * 预计延迟分钟数
     */
    private int estimatedDelayMinutes;

    /**
     * 建议的行动措施
     */
    private List<String> suggestedActions;

    /**
     * 各风险因素权重贡献
     */
    private List<RiskFactor> riskFactors;

    /**
     * 风险因素明细
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskFactor {
        private String factorName;
        private double value;
        private double weight;
        private double contribution;
        private String description;
    }
}
