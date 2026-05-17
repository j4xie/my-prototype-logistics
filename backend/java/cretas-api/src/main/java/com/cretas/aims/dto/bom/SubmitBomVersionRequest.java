package com.cretas.aims.dto.bom;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Request DTO for submitting a BomVersion for approval (DRAFT → PENDING_APPROVAL).
 *
 * <p>Issue #712 fix (2026-05-17). All fields optional.
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "提交 BomVersion 审批请求体")
public class SubmitBomVersionRequest {

    @Schema(description = "关联 ECN ID (可选)", example = "ECN-2026-0001")
    private String ecnId;
}
