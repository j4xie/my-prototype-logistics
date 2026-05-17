package com.cretas.aims.dto.bom;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request DTO for ECN reject action.
 *
 * <p>Issue #712 fix (2026-05-17).
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "ECN 拒绝请求体")
public class EcnRejectRequest {

    @Schema(description = "审批人 user ID", required = true, example = "1")
    @NotNull(message = "approverId 不能为空")
    private Long approverId;

    @Schema(description = "拒绝原因", required = true, example = "成本核算不达标")
    @NotBlank(message = "rejectionReason 不能为空")
    private String rejectionReason;
}
