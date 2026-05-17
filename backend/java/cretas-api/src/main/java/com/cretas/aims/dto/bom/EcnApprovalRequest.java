package com.cretas.aims.dto.bom;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request DTO for ECN approve action.
 *
 * <p>Issue #712 fix (2026-05-17). Replaces raw {@code Map<String, Object>}
 * in {@code EcnController.approve}.
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "ECN 审批通过请求体")
public class EcnApprovalRequest {

    @Schema(description = "审批人 user ID", required = true, example = "1")
    @NotNull(message = "approverId 不能为空")
    private Long approverId;
}
