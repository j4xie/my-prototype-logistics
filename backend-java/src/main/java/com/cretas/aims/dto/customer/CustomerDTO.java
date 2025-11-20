package com.cretas.aims.dto.customer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
/**
 * 客户数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CustomerDTO {
    private String id;
    private String factoryId;
    private String customerCode;
    private String name;
    private String type;
    private String industry;
    private String contactPerson;
    private String phone;
    private String email;
    private String shippingAddress;
    private String billingAddress;
    private String taxNumber;
    private String businessLicense;
    // 业务信息
    private String paymentTerms;
    private BigDecimal creditLimit;
    private BigDecimal currentBalance;
    // 评级信息
    private Integer rating;
    private String ratingNotes;
    // 状态信息
    private Boolean isActive;
    private String notes;
    // 统计信息
    private Integer totalOrders;
    private BigDecimal totalSales;
    private LocalDateTime lastOrderDate;
    private BigDecimal averageOrderValue;
    // 审计信息
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private String createdByName;
}
