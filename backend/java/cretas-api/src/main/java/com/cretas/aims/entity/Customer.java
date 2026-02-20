package com.cretas.aims.entity;

import lombok.*;
import org.hibernate.annotations.BatchSize;
import javax.persistence.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
/**
 * 客户实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "createdBy", "shipmentRecords"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "customers",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_customer_factory", columnList = "factory_id"),
           @Index(name = "idx_customer_is_active", columnList = "is_active")
       }
)
public class Customer extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "code", nullable = false, length = 50)
    private String code;
    @Column(name = "customer_code", nullable = false, length = 50)
    private String customerCode;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "type", length = 50)
    private String type;

    // 前端兼容字段 - businessType 和 customerType
    @Column(name = "business_type", length = 50)
    private String businessType;

    @Column(name = "customer_type", length = 50)
    private String customerType;

    @Column(name = "industry", length = 100)
    private String industry;
    @Column(name = "contact_name", length = 100)
    private String contactName;
    @Column(name = "contact_person", length = 100)
    private String contactPerson;
    @Column(name = "contact_phone", length = 20)
    private String contactPhone;
    @Column(name = "phone", length = 20)
    private String phone;
    @Column(name = "contact_email", length = 100)
    private String contactEmail;
    @Column(name = "email", length = 100)
    private String email;
    @Column(name = "shipping_address")
    private String shippingAddress;
    @Column(name = "billing_address")
    private String billingAddress;
    @Column(name = "tax_number", length = 50)
    private String taxNumber;
    @Column(name = "business_license", length = 100)
    private String businessLicense;
    @Column(name = "payment_terms", length = 200)
    private String paymentTerms;
    @Column(name = "credit_limit", precision = 12, scale = 2)
    private java.math.BigDecimal creditLimit;
    @Column(name = "current_balance", precision = 12, scale = 2)
    private java.math.BigDecimal currentBalance = java.math.BigDecimal.ZERO;
    @Column(name = "rating")
    private Integer rating;
    @Column(name = "rating_notes", columnDefinition = "TEXT")
    private String ratingNotes;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User createdByUser;
    @BatchSize(size = 20)
    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ShipmentRecord> shipmentRecords = new ArrayList<>();
}
