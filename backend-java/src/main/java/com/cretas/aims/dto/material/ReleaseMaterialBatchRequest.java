package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 释放原材料批次预留请求
 */
@Data
@Schema(description = "释放原材料批次预留请求")
public class ReleaseMaterialBatchRequest {

    @Schema(description = "释放数量")
    @NotNull(message = "释放数量不能为空")
    @DecimalMin(value = "0.01", message = "释放数量必须大于0")
    private BigDecimal quantity;

    @Schema(description = "备注")
    private String notes;
}
