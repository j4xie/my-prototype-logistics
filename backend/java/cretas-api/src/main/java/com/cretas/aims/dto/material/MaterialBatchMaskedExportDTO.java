package com.cretas.aims.dto.material;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.HeadFontStyle;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * RBAC-masked variant of {@link MaterialBatchExportDTO} for export to users lacking
 * {@code procurement:price:view} permission.
 *
 * <p>Mirrors column structure 1:1 but renders {@code purchasePrice} (col 10) and
 * {@code inventoryValue} (col 11) as {@code String} so the placeholder "—" can be
 * written instead of a numeric value. Both fields are {@code @PriceSensitive} in
 * the source entity / DTO ({@code MaterialBatch.unitPrice}, computed value).
 *
 * @since 2026-05-12 (PR P0-C sweep batch)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@HeadRowHeight(25)
@HeadFontStyle(fontHeightInPoints = 11)
public class MaterialBatchMaskedExportDTO {

    public static final String PRICE_MASK_PLACEHOLDER = "—";

    @ExcelProperty(value = "批次号", index = 0)
    @ColumnWidth(20)
    private String batchNumber;

    @ExcelProperty(value = "原材料类型", index = 1)
    @ColumnWidth(18)
    private String materialTypeName;

    @ExcelProperty(value = "供应商", index = 2)
    @ColumnWidth(20)
    private String supplierName;

    @ExcelProperty(value = "初始数量", index = 3)
    @ColumnWidth(12)
    private BigDecimal initialQuantity;

    @ExcelProperty(value = "当前数量", index = 4)
    @ColumnWidth(12)
    private BigDecimal currentQuantity;

    @ExcelProperty(value = "已使用数量", index = 5)
    @ColumnWidth(12)
    private BigDecimal usedQuantity;

    @ExcelProperty(value = "预留数量", index = 6)
    @ColumnWidth(12)
    private BigDecimal reservedQuantity;

    @ExcelProperty(value = "单位", index = 7)
    @ColumnWidth(8)
    private String unit;

    @ExcelProperty(value = "状态", index = 8)
    @ColumnWidth(10)
    private String status;

    @ExcelProperty(value = "存储位置", index = 9)
    @ColumnWidth(15)
    private String storageLocation;

    @ExcelProperty(value = "采购单价", index = 10)
    @ColumnWidth(12)
    private String purchasePrice;

    @ExcelProperty(value = "库存价值", index = 11)
    @ColumnWidth(12)
    private String inventoryValue;

    @ExcelProperty(value = "入库日期", index = 12)
    @ColumnWidth(12)
    private LocalDate receiveDate;

    @ExcelProperty(value = "过期日期", index = 13)
    @ColumnWidth(12)
    private LocalDate expiryDate;

    @ExcelProperty(value = "剩余天数", index = 14)
    @ColumnWidth(10)
    private Integer remainingDays;

    @ExcelProperty(value = "质量等级", index = 15)
    @ColumnWidth(10)
    private String qualityGrade;

    @ExcelProperty(value = "备注", index = 16)
    @ColumnWidth(30)
    private String notes;

    /**
     * Build a masked export row from the unmasked {@link MaterialBatchExportDTO}.
     * Non-price columns are copied verbatim; {@code purchasePrice} and
     * {@code inventoryValue} are replaced with {@link #PRICE_MASK_PLACEHOLDER}.
     */
    public static MaterialBatchMaskedExportDTO fromExportDTO(MaterialBatchExportDTO src) {
        if (src == null) {
            return null;
        }
        return MaterialBatchMaskedExportDTO.builder()
                .batchNumber(src.getBatchNumber())
                .materialTypeName(src.getMaterialTypeName())
                .supplierName(src.getSupplierName())
                .initialQuantity(src.getInitialQuantity())
                .currentQuantity(src.getCurrentQuantity())
                .usedQuantity(src.getUsedQuantity())
                .reservedQuantity(src.getReservedQuantity())
                .unit(src.getUnit())
                .status(src.getStatus())
                .storageLocation(src.getStorageLocation())
                .purchasePrice(PRICE_MASK_PLACEHOLDER)
                .inventoryValue(PRICE_MASK_PLACEHOLDER)
                .receiveDate(src.getReceiveDate())
                .expiryDate(src.getExpiryDate())
                .remainingDays(src.getRemainingDays())
                .qualityGrade(src.getQualityGrade())
                .notes(src.getNotes())
                .build();
    }
}
