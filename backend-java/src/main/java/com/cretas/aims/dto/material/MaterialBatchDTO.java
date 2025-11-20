package com.cretas.aims.dto.material;

import com.cretas.aims.entity.enums.MaterialBatchStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 原材料批次数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "原材料批次信息")
public class MaterialBatchDTO {

    @Schema(description = "批次ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "批次号")
    private String batchNumber;

    @Schema(description = "原材料类型ID")
    private String materialTypeId;

    @Schema(description = "原材料名称")
    private String materialName;

    @Schema(description = "原材料代码")
    private String materialCode;

    @Schema(description = "原材料类别")
    private String materialCategory;

    @Schema(description = "供应商ID")
    private String supplierId;

    @Schema(description = "供应商名称")
    private String supplierName;

    @Schema(description = "入库日期")
    private LocalDate receiptDate;

    @Schema(description = "到期日期")
    private LocalDate expireDate;

    @Schema(description = "入库数量")
    private BigDecimal receiptQuantity;

    @Schema(description = "数量单位")
    private String quantityUnit;

    @Schema(description = "每单位重量(kg)")
    private BigDecimal weightPerUnit;

    @Schema(description = "入库总重量(kg)")
    private BigDecimal totalWeight;

    @Schema(description = "当前数量")
    private BigDecimal currentQuantity;

    @Schema(description = "单位")
    private String unit;

    @Schema(description = "入库总价值(元)")
    private BigDecimal totalValue;

    @Schema(description = "单价(元/kg)")
    private BigDecimal unitPrice;

    @Schema(description = "总价")
    private BigDecimal totalPrice;

    @Schema(description = "状态")
    private MaterialBatchStatus status;

    @Schema(description = "状态显示名称")
    private String statusDisplayName;

    @Schema(description = "存储位置")
    private String storageLocation;

    @Schema(description = "质量证书")
    private String qualityCertificate;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "创建人ID")
    private Integer createdBy;

    @Schema(description = "创建人姓名")
    private String createdByName;

    @Schema(description = "最后使用时间")
    private LocalDateTime lastUsedAt;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "剩余天数")
    private Integer remainingDays;

    @Schema(description = "库存占用率")
    private BigDecimal usageRate;

    /**
     * 是否已消耗完（用完/过期/报废）
     */
    @Schema(description = "是否已消耗完")
    public Boolean getIfRunout() {
        if (status == null) {
            return false;
        }
        return status == MaterialBatchStatus.USED_UP ||
               status == MaterialBatchStatus.EXPIRED ||
               status == MaterialBatchStatus.SCRAPPED;
    }
}