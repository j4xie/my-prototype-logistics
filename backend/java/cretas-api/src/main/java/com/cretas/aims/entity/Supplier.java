package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
/**
 * 供应商实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "createdBy", "materialBatches"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "suppliers",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_supplier_factory", columnList = "factory_id"),
           @Index(name = "idx_supplier_is_active", columnList = "is_active")
       }
)
public class Supplier extends BaseEntity {
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
    @Column(name = "supplier_code", nullable = false, length = 50)
    private String supplierCode;
    @Column(name = "name", nullable = false)
    private String name;
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
    @Column(name = "address")
    private String address;
    @Column(name = "business_license", length = 100)
    private String businessLicense;
    @Column(name = "tax_number", length = 50)
    private String taxNumber;
    @Column(name = "bank_name", length = 100)
    private String bankName;
    @Column(name = "bank_account", length = 50)
    private String bankAccount;
    @Column(name = "supplied_materials", columnDefinition = "TEXT")
    private String suppliedMaterials;
    @Column(name = "payment_terms", length = 200)
    private String paymentTerms;
    @Column(name = "delivery_days")
    private Integer deliveryDays;

    // 前端兼容字段
    @Column(name = "business_type", length = 50)
    private String businessType;

    @Column(name = "credit_level", length = 20)
    private String creditLevel;

    @Column(name = "delivery_area", length = 200)
    private String deliveryArea;

    @Column(name = "credit_limit", precision = 12, scale = 2)
    private BigDecimal creditLimit;
    @Column(name = "current_balance", precision = 12, scale = 2)
    private BigDecimal currentBalance = BigDecimal.ZERO;
    @Column(name = "rating")
    private Integer rating;
    @Column(name = "rating_notes", columnDefinition = "TEXT")
    private String ratingNotes;
    @Column(name = "quality_certificates", columnDefinition = "TEXT")
    private String qualityCertificates;
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
    @OneToMany(mappedBy = "supplier", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialBatch> materialBatches = new ArrayList<>();
}
