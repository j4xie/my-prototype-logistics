package com.cretas.aims.dto.quality;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 特批放行申请请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Data
public class SpecialApprovalRequest {

    /**
     * 请求的处置动作
     */
    @NotNull(message = "请求动作不能为空")
    private String requestedAction;

    /**
     * 申请原因 (必填)
     */
    @NotBlank(message = "申请原因不能为空")
    private String reason;

    /**
     * 紧急程度 (HIGH/MEDIUM/LOW)
     */
    private String urgency;

    /**
     * 预期影响说明
     */
    private String expectedImpact;

    /**
     * 风险评估说明
     */
    private String riskAssessment;

    /**
     * 补救措施说明
     */
    private String mitigationPlan;

    /**
     * 附加备注
     */
    private String notes;
}
