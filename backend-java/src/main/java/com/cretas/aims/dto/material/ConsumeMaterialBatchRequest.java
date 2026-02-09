package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 消耗原材料批次请求
 */
@Data
@Schema(description = "消耗原材料批次请求")
public class ConsumeMaterialBatchRequest {

    @Schema(description = "消耗数量")
    @NotNull(message = "消耗数量不能为空")
    @DecimalMin(value = "0.01", message = "消耗数量必须大于0")
    private BigDecimal quantity;

    @Schema(description = "加工批次ID")
    private String processId;

    @Schema(description = "备注")
    private String notes;
}
