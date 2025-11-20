package com.cretas.aims.dto.equipment;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.ContentRowHeight;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 设备导出DTO
 * 用于Excel导出，包含EasyExcel注解
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-20
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@HeadRowHeight(20)
@ContentRowHeight(18)
public class EquipmentExportDTO {

    @ExcelProperty(value = "设备编码", index = 0)
    @ColumnWidth(15)
    private String equipmentCode;

    @ExcelProperty(value = "设备名称", index = 1)
    @ColumnWidth(20)
    private String name;

    @ExcelProperty(value = "设备类型", index = 2)
    @ColumnWidth(15)
    private String type;

    @ExcelProperty(value = "型号", index = 3)
    @ColumnWidth(15)
    private String model;

    @ExcelProperty(value = "制造商", index = 4)
    @ColumnWidth(15)
    private String manufacturer;

    @ExcelProperty(value = "序列号", index = 5)
    @ColumnWidth(20)
    private String serialNumber;

    @ExcelProperty(value = "购买日期", index = 6)
    @ColumnWidth(12)
    private String purchaseDate;

    @ExcelProperty(value = "购买价格", index = 7)
    @ColumnWidth(12)
    private BigDecimal purchasePrice;

    @ExcelProperty(value = "当前价值", index = 8)
    @ColumnWidth(12)
    private BigDecimal currentValue;

    @ExcelProperty(value = "状态", index = 9)
    @ColumnWidth(10)
    private String status;

    @ExcelProperty(value = "位置", index = 10)
    @ColumnWidth(15)
    private String location;

    @ExcelProperty(value = "小时成本", index = 11)
    @ColumnWidth(12)
    private BigDecimal hourlyCost;

    @ExcelProperty(value = "总运行时长(小时)", index = 12)
    @ColumnWidth(15)
    private Integer totalRunningHours;

    @ExcelProperty(value = "维护间隔(小时)", index = 13)
    @ColumnWidth(15)
    private Integer maintenanceIntervalHours;

    @ExcelProperty(value = "上次维护日期", index = 14)
    @ColumnWidth(15)
    private String lastMaintenanceDate;

    @ExcelProperty(value = "需要维护", index = 15)
    @ColumnWidth(10)
    private String needsMaintenance;

    @ExcelProperty(value = "创建时间", index = 16)
    @ColumnWidth(20)
    private String createdAt;

    /**
     * 从EquipmentDTO转换为EquipmentExportDTO
     */
    public static EquipmentExportDTO fromEquipmentDTO(EquipmentDTO dto) {
        if (dto == null) {
            return null;
        }

        return EquipmentExportDTO.builder()
                .equipmentCode(dto.getEquipmentCode())
                .name(dto.getName())
                .type(dto.getType())
                .model(dto.getModel())
                .manufacturer(dto.getManufacturer())
                .serialNumber(dto.getSerialNumber())
                .purchaseDate(formatDate(dto.getPurchaseDate()))
                .purchasePrice(dto.getPurchasePrice())
                .currentValue(dto.getCurrentValue())
                .status(dto.getStatus())
                .location(dto.getLocation())
                .hourlyCost(dto.getHourlyCost())
                .totalRunningHours(dto.getTotalRunningHours())
                .maintenanceIntervalHours(dto.getMaintenanceIntervalHours())
                .lastMaintenanceDate(formatDate(dto.getLastMaintenanceDate()))
                .needsMaintenance(Boolean.TRUE.equals(dto.getNeedsMaintenance()) ? "是" : "否")
                .createdAt(formatDateTime(dto.getCreatedAt()))
                .build();
    }

    private static String formatDate(LocalDate date) {
        if (date == null) {
            return "";
        }
        return date.toString();
    }

    private static String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.toString().replace('T', ' ');
    }
}
