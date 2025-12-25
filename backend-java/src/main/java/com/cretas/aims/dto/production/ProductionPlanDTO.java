package com.cretas.aims.dto.production;

import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.enums.ProductionPlanType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 生产计划数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "生产计划信息")
public class ProductionPlanDTO {

    @Schema(description = "计划ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "计划编号")
    private String planNumber;

    @Schema(description = "产品类型ID")
    private String productTypeId;

    @Schema(description = "产品名称")
    private String productName;

    @Schema(description = "产品单位")
    private String productUnit;

    @Schema(description = "计划数量")
    private BigDecimal plannedQuantity;

    @Schema(description = "实际数量")
    private BigDecimal actualQuantity;

    @Schema(description = "计划日期 (从startTime自动推导，如果startTime存在)")
    private LocalDate plannedDate;

    @Schema(description = "开始时间")
    private LocalDateTime startTime;

    @Schema(description = "结束时间")
    private LocalDateTime endTime;

    @Schema(description = "预计完成日期")
    private LocalDate expectedCompletionDate;

    @Schema(description = "状态")
    private ProductionPlanStatus status;

    @Schema(description = "状态显示名称")
    private String statusDisplayName;

    @Schema(description = "计划类型 (FUTURE=未来计划, FROM_INVENTORY=基于库存)")
    private ProductionPlanType planType;

    @Schema(description = "计划类型显示名称")
    private String planTypeDisplayName;

    @Schema(description = "转换率是否已配置")
    private Boolean conversionRateConfigured;

    @Schema(description = "转换率")
    private BigDecimal conversionRate;

    @Schema(description = "损耗率")
    private BigDecimal wastageRate;

    @Schema(description = "客户订单号")
    private String customerOrderNumber;

    @Schema(description = "优先级")
    private Integer priority;

    @Schema(description = "预估材料成本")
    private BigDecimal estimatedMaterialCost;

    @Schema(description = "实际材料成本")
    private BigDecimal actualMaterialCost;

    @Schema(description = "预估人工成本")
    private BigDecimal estimatedLaborCost;

    @Schema(description = "实际人工成本")
    private BigDecimal actualLaborCost;

    @Schema(description = "预估设备成本")
    private BigDecimal estimatedEquipmentCost;

    @Schema(description = "实际设备成本")
    private BigDecimal actualEquipmentCost;

    @Schema(description = "预估其他成本")
    private BigDecimal estimatedOtherCost;

    @Schema(description = "实际其他成本")
    private BigDecimal actualOtherCost;

    @Schema(description = "总成本")
    private BigDecimal totalCost;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "创建人ID")
    private Long createdBy;

    @Schema(description = "创建人姓名")
    private String createdByName;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    // ======= 未来计划匹配相关字段 =======

    @Schema(description = "已分配的原料数量")
    private BigDecimal allocatedQuantity;

    @Schema(description = "是否完全匹配")
    private Boolean isFullyMatched;

    @Schema(description = "匹配进度百分比")
    private Integer matchingProgress;

    @Schema(description = "剩余需求量")
    private BigDecimal remainingQuantity;
}