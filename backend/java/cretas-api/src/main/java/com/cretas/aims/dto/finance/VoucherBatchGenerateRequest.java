package com.cretas.aims.dto.finance;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for batch-voucher generation (all UNCREATED → CREATED for a business type).
 *
 * <p>Issue #712 fix (2026-05-17).
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "批量生成凭证请求体")
public class VoucherBatchGenerateRequest {

    @Schema(description = "业务单类型", required = true, example = "PURCHASE_ORDER")
    @NotBlank(message = "businessType 不能为空")
    private String businessType;
}
