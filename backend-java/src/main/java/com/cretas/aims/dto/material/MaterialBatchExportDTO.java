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
import java.time.LocalDateTime;

/**
 * 原材料批次导出DTO（用于Excel导出）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@HeadRowHeight(25)
@HeadFontStyle(fontHeightInPoints = 11)
public class MaterialBatchExportDTO {

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
    private BigDecimal purchasePrice;

    @ExcelProperty(value = "库存价值", index = 11)
    @ColumnWidth(12)
    private BigDecimal inventoryValue;

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
     * 计算库存价值
     */
    public void calculateInventoryValue() {
        if (currentQuantity != null && purchasePrice != null) {
            this.inventoryValue = currentQuantity.multiply(purchasePrice);
        }
    }

    /**
     * 计算剩余天数
     */
    public void calculateRemainingDays() {
        if (expiryDate != null) {
            this.remainingDays = (int) java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), expiryDate);
        }
    }
}
