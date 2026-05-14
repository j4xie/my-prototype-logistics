package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 创建抄码品称重日志请求 DTO.
 *
 * <p>典型 payload (单箱):</p>
 * <pre>
 * {
 *   "materialBatchId": "...",
 *   "rawMaterialTypeId": "...",
 *   "boxIndex": 3,
 *   "actualWeight": 12.5,
 *   "unit": "kg",
 *   "weighingMethod": "SCALE"
 * }
 * </pre>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "抄码品单箱称重请求")
public class CreateAbacaQuantityLogRequest {

    @NotBlank(message = "批次 ID 不能为空")
    @Schema(description = "原料批次 ID", required = true)
    private String materialBatchId;

    @NotBlank(message = "原料类型 ID 不能为空")
    @Schema(description = "原料类型 ID (raw_material_types.id)", required = true)
    private String rawMaterialTypeId;

    /** 可空 — 后端自动分配 (现有最大 boxIndex + 1). */
    @Min(value = 1, message = "箱号必须 >= 1")
    @Schema(description = "第几箱 (1, 2, 3...). 不填则自动分配下一个箱号")
    private Integer boxIndex;

    @NotNull(message = "实际重量不能为空")
    @DecimalMin(value = "0.0001", message = "重量必须大于 0")
    @Schema(description = "实际称重 (单位由 unit 决定)", required = true)
    private BigDecimal actualWeight;

    @Schema(description = "计量单位 (kg / g), 默认 kg", defaultValue = "kg")
    private String unit;

    @Schema(description = "称重方式: SCALE=电子秤 / MANUAL=手工 / IMPORTED=批量导入", defaultValue = "SCALE")
    private String weighingMethod;

    @Schema(description = "电子秤设备 ID (如有对接)")
    private String scaleDeviceId;

    @Schema(description = "关联的采购单行项 ID (可选)")
    private String purchaseOrderItemId;

    @Schema(description = "备注")
    private String notes;
}
