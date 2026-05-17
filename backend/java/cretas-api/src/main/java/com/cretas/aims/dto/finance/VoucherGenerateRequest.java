package com.cretas.aims.dto.finance;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for single-voucher generation from a business document.
 *
 * <p>Issue #712 fix (2026-05-17): replaces raw Map in VoucherController.
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "生成单个凭证请求体")
public class VoucherGenerateRequest {

    @Schema(description = "业务单类型 (PURCHASE_ORDER / SALES_ORDER ...)",
            required = true, example = "PURCHASE_ORDER")
    @NotBlank(message = "businessType 不能为空")
    private String businessType;

    @Schema(description = "业务单 ID", required = true, example = "PO-2026-001")
    @NotBlank(message = "businessId 不能为空")
    private String businessId;
}
