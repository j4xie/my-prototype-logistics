package com.cretas.aims.dto.customer;

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
 * 客户导出DTO
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
public class CustomerExportDTO {

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
    private BigDecimal creditLimit;

    @ExcelProperty(value = "当前余额", index = 10)
    @ColumnWidth(12)
    private BigDecimal currentBalance;

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
     * 从CustomerDTO转换为CustomerExportDTO
     */
    public static CustomerExportDTO fromCustomerDTO(CustomerDTO dto) {
        if (dto == null) {
            return null;
        }

        return CustomerExportDTO.builder()
                .customerCode(dto.getCustomerCode())
                .name(dto.getName())
                .type(dto.getType())
                .industry(dto.getIndustry())
                .contactPerson(dto.getContactPerson())
                .phone(dto.getPhone())
                .email(dto.getEmail())
                .shippingAddress(dto.getShippingAddress())
                .paymentTerms(dto.getPaymentTerms())
                .creditLimit(dto.getCreditLimit())
                .currentBalance(dto.getCurrentBalance())
                .rating(dto.getRating())
                .status(Boolean.TRUE.equals(dto.getIsActive()) ? "启用" : "禁用")
                .createdAt(formatDateTime(dto.getCreatedAt()))
                .build();
    }

    /**
     * 格式化日期时间为字符串
     */
    private static String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.toString().replace('T', ' ');
    }

    // Manual getters and setters (Lombok @Data not working)
    public String getCustomerCode() {
        return customerCode;
    }

    public void setCustomerCode(String customerCode) {
        this.customerCode = customerCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getIndustry() {
        return industry;
    }

    public void setIndustry(String industry) {
        this.industry = industry;
    }

    public String getContactPerson() {
        return contactPerson;
    }

    public void setContactPerson(String contactPerson) {
        this.contactPerson = contactPerson;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getShippingAddress() {
        return shippingAddress;
    }

    public void setShippingAddress(String shippingAddress) {
        this.shippingAddress = shippingAddress;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public void setPaymentTerms(String paymentTerms) {
        this.paymentTerms = paymentTerms;
    }

    public BigDecimal getCreditLimit() {
        return creditLimit;
    }

    public void setCreditLimit(BigDecimal creditLimit) {
        this.creditLimit = creditLimit;
    }

    public BigDecimal getCurrentBalance() {
        return currentBalance;
    }

    public void setCurrentBalance(BigDecimal currentBalance) {
        this.currentBalance = currentBalance;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
