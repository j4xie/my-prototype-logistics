package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 质检处置动作 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "质检处置动作")
public class DispositionActionDTO {

    @Schema(description = "动作代码",
            example = "RELEASE",
            allowableValues = {"RELEASE", "CONDITIONAL_RELEASE", "REWORK", "SCRAP", "SPECIAL_APPROVAL", "HOLD"})
    private String actionCode;

    @Schema(description = "动作名称", example = "放行")
    private String actionName;

    @Schema(description = "动作描述", example = "直接放行 - 质检合格")
    private String description;

    @Schema(description = "是否需要审批", example = "false")
    private Boolean requiresApproval;

    @Schema(description = "审批级别",
            example = "SUPERVISOR",
            allowableValues = {"SUPERVISOR", "MANAGER", "QUALITY_HEAD", "FACTORY_MANAGER"})
    private String approvalLevel;

    @Schema(description = "适用条件说明", example = "合格率 >= 95%")
    private String applicableCondition;
}
