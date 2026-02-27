package com.cretas.aims.dto.production;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.format.DateTimeFormat;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.ContentRowHeight;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 生产计划Excel导入/导出DTO
 * 用于EasyExcel读写，包含列映射注解
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-26
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@HeadRowHeight(20)
@ContentRowHeight(18)
public class ProductionPlanImportDTO {

    @ExcelProperty(value = "产品名称*", index = 0)
    @ColumnWidth(20)
    private String productName;

    @ExcelProperty(value = "计划数量*", index = 1)
    @ColumnWidth(15)
    private BigDecimal plannedQuantity;

    @ExcelProperty(value = "预计完成日期*", index = 2)
    @ColumnWidth(20)
    @DateTimeFormat("yyyy-MM-dd")
    private LocalDate expectedCompletionDate;

    @ExcelProperty(value = "优先级(1-10)", index = 3)
    @ColumnWidth(15)
    private Integer priority;

    @ExcelProperty(value = "产线编号", index = 4)
    @ColumnWidth(20)
    private String productionLineCode;

    @ExcelProperty(value = "预计工人数", index = 5)
    @ColumnWidth(15)
    private Integer estimatedWorkers;

    @ExcelProperty(value = "车间主管(用户名)", index = 6)
    @ColumnWidth(20)
    private String supervisorUsername;

    @ExcelProperty(value = "客户订单号", index = 7)
    @ColumnWidth(20)
    private String customerOrderNumber;

    @ExcelProperty(value = "备注", index = 8)
    @ColumnWidth(30)
    private String notes;
}
