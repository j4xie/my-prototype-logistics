package com.cretas.aims.dto.materialtype;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.ContentRowHeight;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import com.cretas.aims.entity.MaterialType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 原材料类型导出DTO
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
public class MaterialTypeExportDTO {

    @ExcelProperty(value = "原材料编码", index = 0)
    @ColumnWidth(15)
    private String materialCode;

    @ExcelProperty(value = "原材料名称", index = 1)
    @ColumnWidth(20)
    private String name;

    @ExcelProperty(value = "类别", index = 2)
    @ColumnWidth(15)
    private String category;

    @ExcelProperty(value = "计量单位", index = 3)
    @ColumnWidth(10)
    private String unit;

    @ExcelProperty(value = "存储方式", index = 4)
    @ColumnWidth(12)
    private String storageType;

    @ExcelProperty(value = "描述", index = 5)
    @ColumnWidth(30)
    private String description;

    @ExcelProperty(value = "状态", index = 6)
    @ColumnWidth(10)
    private String status;

    @ExcelProperty(value = "创建时间", index = 7)
    @ColumnWidth(20)
    private String createdAt;

    /**
     * 从MaterialType转换为MaterialTypeExportDTO
     */
    public static MaterialTypeExportDTO fromMaterialType(MaterialType materialType) {
        if (materialType == null) {
            return null;
        }

        return MaterialTypeExportDTO.builder()
                .materialCode(materialType.getMaterialCode())
                .name(materialType.getName())
                .category(materialType.getCategory())
                .unit(materialType.getUnit())
                .storageType(materialType.getStorageType())
                .description(materialType.getDescription())
                .status(Boolean.TRUE.equals(materialType.getIsActive()) ? "启用" : "停用")
                .createdAt(formatDateTime(materialType.getCreatedAt()))
                .build();
    }

    private static String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.toString().replace('T', ' ');
    }
}
