package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 创建原材料批次请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "创建原材料批次请求")
public class CreateMaterialBatchRequest {

    @Schema(description = "原材料类型ID", required = true)
    @NotNull(message = "原材料类型不能为空")
    private String materialTypeId;

    @Schema(description = "供应商ID", required = true)
    @NotNull(message = "供应商不能为空")
    private String supplierId;

    @Schema(description = "入库日期", required = true)
    @NotNull(message = "入库日期不能为空")
    private LocalDate receiptDate;

    @Schema(description = "入库数量", required = true, example = "10")
    @NotNull(message = "入库数量不能为空")
    @DecimalMin(value = "0.01", message = "入库数量必须大于0")
    private BigDecimal receiptQuantity;

    @Schema(description = "数量单位", required = true, example = "箱")
    @NotBlank(message = "数量单位不能为空")
    private String quantityUnit;

    @Schema(description = "每单位重量(kg)", example = "10.5")
    @DecimalMin(value = "0.001", message = "每单位重量必须大于0")
    private BigDecimal weightPerUnit;

    @Schema(description = "入库总重量(kg)", required = true)
    @NotNull(message = "入库总重量不能为空")
    @DecimalMin(value = "0.001", message = "入库总重量必须大于0")
    private BigDecimal totalWeight;

    @Schema(description = "入库总价值(元)", required = true)
    @NotNull(message = "入库总价值不能为空")
    @DecimalMin(value = "0.01", message = "入库总价值必须大于0")
    private BigDecimal totalValue;

    @Schema(description = "单价(元/kg，可选，不填则自动计算)")
    @DecimalMin(value = "0.01", message = "单价必须大于0")
    private BigDecimal unitPrice;

    @Schema(description = "到期日期（可选，不填则根据保质期天数自动计算）")
    private LocalDate expireDate;

    @Schema(description = "存储位置")
    @Size(max = 100, message = "存储位置不能超过100个字符")
    private String storageLocation;

    @Schema(description = "质量证书")
    @Size(max = 100, message = "质量证书不能超过100个字符")
    private String qualityCertificate;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注不能超过500个字符")
    private String notes;
}