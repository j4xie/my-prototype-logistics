package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 执行处置请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "执行处置请求")
public class ExecuteDispositionRequest {

    @NotNull(message = "生产批次ID不能为空")
    @Schema(description = "生产批次ID", example = "123", required = true)
    private Long batchId;

    @NotBlank(message = "质检记录ID不能为空")
    @Schema(description = "质检记录ID", example = "INS-2025-001", required = true)
    private String inspectionId;

    @NotBlank(message = "处置动作不能为空")
    @Schema(description = "处置动作代码",
            example = "RELEASE",
            required = true,
            allowableValues = {"RELEASE", "CONDITIONAL_RELEASE", "REWORK", "SCRAP", "SPECIAL_APPROVAL", "HOLD"})
    private String actionCode;

    @Schema(description = "操作员备注", example = "质检合格，符合放行标准")
    private String operatorComment;

    @NotNull(message = "执行人ID不能为空")
    @Schema(description = "执行人ID", example = "22", required = true)
    private Long executorId;

    @Schema(description = "审批人ID（如果需要审批）", example = "1")
    private Long approverId;
}
