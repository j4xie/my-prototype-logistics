package com.cretas.aims.dto.production;

import com.cretas.aims.entity.enums.ProductionPlanType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 创建生产计划请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "创建生产计划请求")
public class CreateProductionPlanRequest {

    @Schema(description = "产品类型ID", required = true)
    @NotNull(message = "产品类型不能为空")
    private String productTypeId;

    @Schema(description = "计划数量", required = true)
    @NotNull(message = "计划数量不能为空")
    @DecimalMin(value = "0.01", message = "计划数量必须大于0")
    private BigDecimal plannedQuantity;

    @Schema(description = "计划日期", required = true)
    @NotNull(message = "计划日期不能为空")
    @FutureOrPresent(message = "计划日期不能是过去")
    private LocalDate plannedDate;

    @Schema(description = "预计完成日期（默认为计划日期+1天）")
    private LocalDate expectedCompletionDate;

    @Schema(description = "客户订单号")
    @Size(max = 100, message = "客户订单号不能超过100个字符")
    private String customerOrderNumber;

    @Schema(description = "优先级(1-10)")
    @Min(value = 1, message = "优先级最小为1")
    @Max(value = 10, message = "优先级最大为10")
    private Integer priority = 5;

    @Schema(description = "预估材料成本")
    @DecimalMin(value = "0", message = "预估材料成本不能为负数")
    private BigDecimal estimatedMaterialCost;

    @Schema(description = "预估人工成本")
    @DecimalMin(value = "0", message = "预估人工成本不能为负数")
    private BigDecimal estimatedLaborCost;

    @Schema(description = "预估设备成本")
    @DecimalMin(value = "0", message = "预估设备成本不能为负数")
    private BigDecimal estimatedEquipmentCost;

    @Schema(description = "预估其他成本")
    @DecimalMin(value = "0", message = "预估其他成本不能为负数")
    private BigDecimal estimatedOtherCost;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注不能超过500个字符")
    private String notes;

    @Schema(description = "客户ID")
    private Integer customerId;

    @Schema(description = "原材料批次ID列表")
    private String[] materialBatchIds;

    @Schema(description = "计划类型 (FUTURE=未来计划, FROM_INVENTORY=基于库存)", example = "FROM_INVENTORY")
    private ProductionPlanType planType = ProductionPlanType.FROM_INVENTORY;

    @Schema(description = "是否使用自动计算转换率")
    private Boolean autoCalculateConversionRate = false;
}