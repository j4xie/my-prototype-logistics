package com.cretas.aims.dto.quality;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 质检处置评估结果 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Data
@Builder
public class DispositionEvaluationDTO {

    /**
     * 质检记录ID
     */
    private String inspectionId;

    /**
     * 生产批次ID
     */
    private Long productionBatchId;

    /**
     * 推荐的处置动作
     */
    private String recommendedAction;

    /**
     * 推荐动作的中文描述
     */
    private String recommendedActionDescription;

    /**
     * 是否需要审批
     */
    private Boolean requiresApproval;

    /**
     * 触发的规则名称
     */
    private String triggeredRuleName;

    /**
     * 规则配置ID
     */
    private String ruleConfigId;

    /**
     * 规则版本
     */
    private Integer ruleVersion;

    /**
     * 置信度 (0-100)
     */
    private BigDecimal confidence;

    /**
     * 处置理由
     */
    private String reason;

    /**
     * 可选的备选动作
     */
    private List<AlternativeAction> alternativeActions;

    /**
     * 质检结果摘要
     */
    private InspectionSummary inspectionSummary;

    /**
     * 备选动作
     */
    @Data
    @Builder
    public static class AlternativeAction {
        private String action;
        private String description;
        private Boolean requiresApproval;
    }

    /**
     * 质检结果摘要
     */
    @Data
    @Builder
    public static class InspectionSummary {
        private BigDecimal passRate;
        private BigDecimal defectRate;
        private String inspectionResult;
        private String qualityGrade;
        private BigDecimal sampleSize;
        private BigDecimal passCount;
        private BigDecimal failCount;
    }
}
