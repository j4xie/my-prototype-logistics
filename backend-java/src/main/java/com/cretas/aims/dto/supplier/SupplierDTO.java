package com.cretas.aims.dto.supplier;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
/**
 * 供应商数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SupplierDTO {
    private String id;
    private String factoryId;
    private String supplierCode;
    private String name;
    private String contactPerson;
    private String phone;
    private String email;
    private String address;
    private String businessLicense;
    private String taxNumber;
    private String bankName;
    private String bankAccount;
    // 业务信息
    private String suppliedMaterials;
    private String paymentTerms;
    private Integer deliveryDays;
    private BigDecimal creditLimit;
    private BigDecimal currentBalance;
    // 评级信息
    private Integer rating;
    private String ratingNotes;
    private String qualityCertificates;
    // 状态信息
    private Boolean isActive;
    private String notes;
    // 统计信息
    private Integer totalOrders;
    private BigDecimal totalAmount;
    private LocalDateTime lastOrderDate;
    // 审计信息
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private String createdByName;
}
