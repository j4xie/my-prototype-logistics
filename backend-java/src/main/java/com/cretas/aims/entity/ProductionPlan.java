package com.cretas.aims.entity;

import com.cretas.aims.entity.enums.ProductionPlanStatus;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
/**
 * 生产计划实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "productType", "createdBy", "materialConsumptions", "batchUsages"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "production_plans",
       indexes = {
           @Index(name = "idx_plan_factory", columnList = "factory_id"),
           @Index(name = "idx_plan_status", columnList = "status")
           // @Index(name = "idx_plan_date", columnList = "planned_date")  // 暂时注释 - 数据库表中没有此字段
       }
)
public class ProductionPlan extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "plan_number", nullable = false, unique = true, length = 50)
    private String planNumber;
    @Column(name = "product_type_id", nullable = false, length = 191)
    private String productTypeId;
    @Column(name = "planned_quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal plannedQuantity;
    @Column(name = "actual_quantity", precision = 10, scale = 2)
    private BigDecimal actualQuantity;
    // @Column(name = "planned_date", nullable = false)
    // private LocalDate plannedDate;  // 暂时注释 - 数据库表中没有此字段
    @Column(name = "start_time")
    private LocalDateTime startTime;
    @Column(name = "end_time")
    private LocalDateTime endTime;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProductionPlanStatus status = ProductionPlanStatus.PENDING;
    @Column(name = "customer_order_number", length = 100)
    private String customerOrderNumber;
    @Column(name = "priority")
    private Integer priority;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    // 成本相关字段
    @Column(name = "estimated_material_cost", precision = 10, scale = 2)
    private BigDecimal estimatedMaterialCost;
    @Column(name = "actual_material_cost", precision = 10, scale = 2)
    private BigDecimal actualMaterialCost;
    @Column(name = "estimated_labor_cost", precision = 10, scale = 2)
    private BigDecimal estimatedLaborCost;
    @Column(name = "actual_labor_cost", precision = 10, scale = 2)
    private BigDecimal actualLaborCost;
    @Column(name = "estimated_equipment_cost", precision = 10, scale = 2)
    private BigDecimal estimatedEquipmentCost;
    @Column(name = "actual_equipment_cost", precision = 10, scale = 2)
    private BigDecimal actualEquipmentCost;
    @Column(name = "estimated_other_cost", precision = 10, scale = 2)
    private BigDecimal estimatedOtherCost;
    @Column(name = "actual_other_cost", precision = 10, scale = 2)
    private BigDecimal actualOtherCost;
    @Column(name = "created_by", nullable = false)
    private Integer createdBy;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    @org.hibernate.annotations.BatchSize(size = 10)
    private Factory factory;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_type_id", referencedColumnName = "id", insertable = false, updatable = false)
    @org.hibernate.annotations.BatchSize(size = 20)
    private ProductType productType;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    @org.hibernate.annotations.BatchSize(size = 10)
    private User createdByUser;
    @OneToMany(mappedBy = "productionPlan", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialConsumption> materialConsumptions = new ArrayList<>();

    @OneToMany(mappedBy = "productionPlan", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductionPlanBatchUsage> batchUsages = new ArrayList<>();
}
