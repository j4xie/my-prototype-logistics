package com.cretas.aims.dto.customer;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.ContentRowHeight;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * RBAC-masked variant of {@link CustomerExportDTO} for export to users lacking
 * {@code procurement:price:view} permission.
 *
 * <p>Mirrors column structure of {@link CustomerExportDTO} 1:1 (same order, same
 * @ExcelProperty index values) but renders {@code creditLimit} (col 9) and
 * {@code currentBalance} (col 10) as {@code String} so the placeholder "—" can be
 * written instead of a numeric value. EasyExcel reflects over the @ExcelProperty
 * fields, so the warehouse caller's xlsx will be byte-shape parallel but with
 * "—" in the two price cells.
 *
 * <p>Used only on the masked path; the original BigDecimal-typed
 * {@link CustomerExportDTO} continues to drive the admin (full visibility) export
 * and the import flow (no masked import path exists — import requires real values).
 *
 * @since 2026-05-12 (PR P0-C sweep batch)
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@HeadRowHeight(20)
@ContentRowHeight(18)
public class CustomerMaskedExportDTO {

    /** Placeholder rendered in 信用额度 / 当前余额 cells when caller lacks procurement:price:view. */
    public static final String PRICE_MASK_PLACEHOLDER = "—";

    @ExcelProperty(value = "客户编码", index = 0)
    @ColumnWidth(15)
    private String customerCode;

    @ExcelProperty(value = "客户名称", index = 1)
    @ColumnWidth(20)
    private String name;

    @ExcelProperty(value = "客户类型", index = 2)
    @ColumnWidth(12)
    private String type;

    @ExcelProperty(value = "所属行业", index = 3)
    @ColumnWidth(15)
    private String industry;

    @ExcelProperty(value = "联系人", index = 4)
    @ColumnWidth(12)
    private String contactPerson;

    @ExcelProperty(value = "联系电话", index = 5)
    @ColumnWidth(15)
    private String phone;

    @ExcelProperty(value = "电子邮箱", index = 6)
    @ColumnWidth(25)
    private String email;

    @ExcelProperty(value = "收货地址", index = 7)
    @ColumnWidth(30)
    private String shippingAddress;

    @ExcelProperty(value = "付款条款", index = 8)
    @ColumnWidth(20)
    private String paymentTerms;

    @ExcelProperty(value = "信用额度", index = 9)
    @ColumnWidth(12)
    private String creditLimit;

    @ExcelProperty(value = "当前余额", index = 10)
    @ColumnWidth(12)
    private String currentBalance;

    @ExcelProperty(value = "评级", index = 11)
    @ColumnWidth(8)
    private Integer rating;

    @ExcelProperty(value = "状态", index = 12)
    @ColumnWidth(10)
    private String status;

    @ExcelProperty(value = "创建时间", index = 13)
    @ColumnWidth(20)
    private String createdAt;

    /**
     * Build a masked export row from a {@link CustomerDTO}. Price columns are
     * unconditionally replaced with {@link #PRICE_MASK_PLACEHOLDER} so admin-vs-warehouse
     * byte parity is preserved (warehouse cannot distinguish "no credit limit" from
     * "credit limit hidden" — both look identical).
     */
    public static CustomerMaskedExportDTO fromCustomerDTO(CustomerDTO dto) {
        if (dto == null) {
            return null;
        }
        return CustomerMaskedExportDTO.builder()
                .customerCode(dto.getCustomerCode())
                .name(dto.getName())
                .type(dto.getType())
                .industry(dto.getIndustry())
                .contactPerson(dto.getContactPerson())
                .phone(dto.getPhone())
                .email(dto.getEmail())
                .shippingAddress(dto.getShippingAddress())
                .paymentTerms(dto.getPaymentTerms())
                .creditLimit(PRICE_MASK_PLACEHOLDER)
                .currentBalance(PRICE_MASK_PLACEHOLDER)
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
