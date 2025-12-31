package com.cretas.aims.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
/**
 * 产品类型实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "createdBy", "conversions", "productionPlans"})
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "product_types",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_product_factory", columnList = "factory_id"),
           @Index(name = "idx_product_is_active", columnList = "is_active")
       }
)
public class ProductType extends BaseEntity {
    @Id
    @Column(name = "id", length = 100)
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
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "category", length = 50)
    private String category;
    @Column(name = "unit", nullable = false, length = 20)
    private String unit;
    @Column(name = "unit_price", precision = 10, scale = 2)
    private BigDecimal unitPrice;
    @Column(name = "production_time_minutes")
    private Integer productionTimeMinutes;
    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;

    // ==================== Sprint 2 S2-1: Form Template Association ====================

    /**
     * Associated form template ID for this product type
     * Allows different product types to have specialized input forms
     */
    @Column(name = "form_template_id", length = 100)
    private String formTemplateId;

    // ==================== Sprint 2 S2-5: SOP Configuration Association ====================

    /**
     * Default SOP configuration ID for this product type
     * Links to SopConfig entity for standardized operating procedures
     */
    @Column(name = "default_sop_config_id", length = 50)
    private String defaultSopConfigId;

    // ==================== Phase 5: SKU Configuration Fields ====================

    /**
     * Standard work hours to produce one unit
     * Used by scheduling system for capacity planning
     */
    @Column(name = "work_hours", precision = 10, scale = 2)
    private BigDecimal workHours;

    /**
     * Processing steps as JSON array
     * Format: [{"stageType": "SLICING", "orderIndex": 1, "requiredSkillLevel": 3, "estimatedMinutes": 30}, ...]
     */
    @Column(name = "processing_steps", columnDefinition = "JSON")
    private String processingSteps;

    /**
     * Skill requirements as JSON object
     * Format: {"minLevel": 2, "preferredLevel": 4, "specialSkills": ["knife_handling"]}
     */
    @Column(name = "skill_requirements", columnDefinition = "JSON")
    private String skillRequirements;

    /**
     * Required equipment IDs as JSON array
     * Format: ["EQ-001", "EQ-002"]
     */
    @Column(name = "equipment_ids", columnDefinition = "JSON")
    private String equipmentIds;

    /**
     * Associated quality check item IDs as JSON array
     * Format: ["QC-001", "QC-002"]
     */
    @Column(name = "quality_check_ids", columnDefinition = "JSON")
    private String qualityCheckIds;

    /**
     * Production complexity score (1-5)
     * Used by LinUCB feature extraction for worker recommendation
     */
    @Column(name = "complexity_score")
    private Integer complexityScore;

    // ==================== End Phase 5 Fields ====================

    @Column(name = "package_spec", length = 100)
    private String packageSpec;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    // 关联关系 (使用 @JsonIgnore 防止循环引用)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User createdByUser;

    @JsonIgnore
    @OneToMany(mappedBy = "productType", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialProductConversion> conversions = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "productType", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductionPlan> productionPlans = new ArrayList<>();
}
