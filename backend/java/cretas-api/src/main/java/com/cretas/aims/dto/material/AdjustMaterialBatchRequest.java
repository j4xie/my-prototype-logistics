package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 调整原材料批次库存请求
 */
@Data
@Schema(description = "调整原材料批次库存请求")
public class AdjustMaterialBatchRequest {

    @Schema(description = "调整类型: INCREASE(增加) 或 DECREASE(减少)")
    @NotBlank(message = "调整类型不能为空")
    private String adjustmentType;

    @Schema(description = "调整数量")
    @NotNull(message = "调整数量不能为空")
    @DecimalMin(value = "0.01", message = "调整数量必须大于0")
    private BigDecimal quantity;

    @Schema(description = "调整原因")
    @NotBlank(message = "调整原因不能为空")
    private String reason;

    @Schema(description = "备注")
    private String notes;
}
