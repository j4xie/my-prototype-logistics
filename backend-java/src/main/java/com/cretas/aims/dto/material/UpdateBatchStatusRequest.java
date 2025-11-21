package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 更新批次状态请求
 */
@Data
@Schema(description = "更新批次状态请求")
public class UpdateBatchStatusRequest {

    @Schema(description = "新状态")
    @NotBlank(message = "状态不能为空")
    private String status;

    @Schema(description = "备注")
    private String notes;
}
