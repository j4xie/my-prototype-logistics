package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 预留原材料批次请求
 */
@Data
@Schema(description = "预留原材料批次请求")
public class ReserveMaterialBatchRequest {

    @Schema(description = "预留数量")
    @NotNull(message = "预留数量不能为空")
    @DecimalMin(value = "0.01", message = "预留数量必须大于0")
    private BigDecimal quantity;

    @Schema(description = "生产计划ID")
    private String planId;

    @Schema(description = "生产批次ID")
    private String productionBatchId;

    @Schema(description = "备注")
    private String notes;
}
