package com.cretas.aims.dto.finance;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Request DTO for voiding a voucher.
 *
 * <p>Issue #712 fix (2026-05-17). reason is optional but recommended.
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "作废凭证请求体")
public class VoucherVoidRequest {

    @Schema(description = "作废原因 (可选, 缺省 '未填写原因')", example = "重复生成")
    private String reason;
}
