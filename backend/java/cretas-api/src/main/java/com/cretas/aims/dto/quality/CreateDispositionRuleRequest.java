package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 创建处置规则请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "创建处置规则请求")
public class CreateDispositionRuleRequest {

    @NotBlank(message = "规则名称不能为空")
    @Schema(description = "规则名称", example = "高合格率自动放行", required = true)
    private String ruleName;

    @Schema(description = "规则描述", example = "当合格率 >= 95% 时自动放行")
    private String description;

    @NotNull(message = "最低合格率阈值不能为空")
    @Schema(description = "最低合格率阈值", example = "95.00", required = true)
    private BigDecimal minPassRate;

    @Schema(description = "最高缺陷率阈值", example = "5.00")
    private BigDecimal maxDefectRate;

    @NotBlank(message = "处置动作不能为空")
    @Schema(description = "触发的处置动作",
            example = "RELEASE",
            required = true,
            allowableValues = {"RELEASE", "CONDITIONAL_RELEASE", "REWORK", "SCRAP", "SPECIAL_APPROVAL", "HOLD"})
    private String action;

    @NotNull(message = "是否需要审批不能为空")
    @Schema(description = "是否需要审批", example = "false", required = true)
    private Boolean requiresApproval;

    @Schema(description = "审批级别",
            example = "SUPERVISOR",
            allowableValues = {"SUPERVISOR", "MANAGER", "QUALITY_HEAD", "FACTORY_MANAGER"})
    private String approvalLevel;

    @Schema(description = "规则优先级（数值越大优先级越高）", example = "10")
    private Integer priority;

    @Schema(description = "是否启用", example = "true")
    @Builder.Default
    private Boolean enabled = true;
}
