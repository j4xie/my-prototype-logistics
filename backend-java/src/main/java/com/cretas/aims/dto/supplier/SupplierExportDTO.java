package com.cretas.aims.dto.supplier;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.ContentRowHeight;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 供应商导出DTO
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
public class SupplierExportDTO {

    @ExcelProperty(value = "供应商编码", index = 0)
    @ColumnWidth(15)
    private String supplierCode;

    @ExcelProperty(value = "供应商名称", index = 1)
    @ColumnWidth(20)
    private String name;

    @ExcelProperty(value = "联系人", index = 2)
    @ColumnWidth(12)
    private String contactPerson;

    @ExcelProperty(value = "联系电话", index = 3)
    @ColumnWidth(15)
    private String phone;

    @ExcelProperty(value = "电子邮箱", index = 4)
    @ColumnWidth(25)
    private String email;

    @ExcelProperty(value = "地址", index = 5)
    @ColumnWidth(30)
    private String address;

    @ExcelProperty(value = "供应材料", index = 6)
    @ColumnWidth(25)
    private String suppliedMaterials;

    @ExcelProperty(value = "付款条款", index = 7)
    @ColumnWidth(20)
    private String paymentTerms;

    @ExcelProperty(value = "交货天数", index = 8)
    @ColumnWidth(10)
    private Integer deliveryDays;

    @ExcelProperty(value = "信用额度", index = 9)
    @ColumnWidth(12)
    private BigDecimal creditLimit;

    @ExcelProperty(value = "评级", index = 10)
    @ColumnWidth(8)
    private Integer rating;

    @ExcelProperty(value = "状态", index = 11)
    @ColumnWidth(10)
    private String status;

    @ExcelProperty(value = "创建时间", index = 12)
    @ColumnWidth(20)
    private String createdAt;

    /**
     * 从SupplierDTO转换为SupplierExportDTO
     */
    public static SupplierExportDTO fromSupplierDTO(SupplierDTO dto) {
        if (dto == null) {
            return null;
        }

        return SupplierExportDTO.builder()
                .supplierCode(dto.getSupplierCode())
                .name(dto.getName())
                .contactPerson(dto.getContactPerson())
                .phone(dto.getPhone())
                .email(dto.getEmail())
                .address(dto.getAddress())
                .suppliedMaterials(dto.getSuppliedMaterials())
                .paymentTerms(dto.getPaymentTerms())
                .deliveryDays(dto.getDeliveryDays())
                .creditLimit(dto.getCreditLimit())
                .rating(dto.getRating())
                .status(Boolean.TRUE.equals(dto.getIsActive()) ? "启用" : "禁用")
                .createdAt(formatDateTime(dto.getCreatedAt()))
                .build();
    }

    private static String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.toString().replace('T', ' ');
    }
}
