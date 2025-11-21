package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 使用原材料批次请求
 */
@Data
@Schema(description = "使用原材料批次请求")
public class UseMaterialBatchRequest {

    @Schema(description = "使用数量", required = true)
    @NotNull(message = "使用数量不能为空")
    @DecimalMin(value = "0.01", message = "使用数量必须大于0")
    private BigDecimal quantity;

    @Schema(description = "用途/目的")
    private String purpose;

    @Schema(description = "生产计划ID")
    private String productionPlanId;

    @Schema(description = "备注")
    private String notes;
}
