package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.util.ArrayList;
import java.util.List;
/**
 * 工厂实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"users", "suppliers", "customers", "productionPlans", "materialBatches"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "factories",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"name"})  // 工厂名称全局唯一
       },
       indexes = {
           @Index(name = "idx_factory_code", columnList = "industry_code, region_code, factory_year"),
           @Index(name = "idx_legacy_id", columnList = "legacy_id"),
           @Index(name = "idx_industry", columnList = "industry_code"),
           @Index(name = "idx_region", columnList = "region_code"),
           @Index(name = "idx_year", columnList = "factory_year"),
           @Index(name = "idx_name", columnList = "name")  // 加速工厂名称查询
       }
)
public class Factory extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false)
    private String id;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "industry")
    private String industry;
    @Column(name = "address")
    private String address;
    @Column(name = "employee_count")
    private Integer employeeCount;
    @Column(name = "subscription_plan")
    private String subscriptionPlan;
    @Column(name = "contact_name")
    private String contactName;
    @Column(name = "contact_phone")
    private String contactPhone;
    @Column(name = "contact_email")
    private String contactEmail;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    @Column(name = "confidence")
    private Float confidence;
    @Column(name = "factory_year")
    private Integer factoryYear;
    @Column(name = "industry_code")
    private String industryCode;
    @Column(name = "inference_data", columnDefinition = "json")
    private String inferenceData;
    @Column(name = "legacy_id")
    private String legacyId;
    @Column(name = "manually_verified", nullable = false)
    private Boolean manuallyVerified = false;
    @Column(name = "region_code")
    private String regionCode;
    @Column(name = "sequence_number")
    private Integer sequenceNumber;
    @Column(name = "ai_weekly_quota", nullable = false)
    private Integer aiWeeklyQuota = 20;
    // 关联关系
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<User> users = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Supplier> suppliers = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Customer> customers = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductionPlan> productionPlans = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialBatch> materialBatches = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<RawMaterialType> rawMaterialTypes = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductType> productTypes = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<WorkType> workTypes = new ArrayList<>();
    @OneToMany(mappedBy = "factory", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FactoryEquipment> equipment = new ArrayList<>();
}
