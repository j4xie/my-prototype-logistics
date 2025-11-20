package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
/**
 * 原材料消耗记录实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "productionPlan", "batch", "recorder"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "material_consumptions",
       indexes = {
           @Index(name = "idx_consumption_factory", columnList = "factory_id"),
           @Index(name = "idx_consumption_plan", columnList = "production_plan_id"),
           @Index(name = "idx_consumption_batch", columnList = "batch_id"),
           @Index(name = "idx_consumption_time", columnList = "consumption_time")
       }
)
public class MaterialConsumption extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "production_plan_id", length = 191)
    private String productionPlanId;
    @Column(name = "production_batch_id", length = 191)
    private String productionBatchId;
    @Column(name = "batch_id", nullable = false)
    private String batchId;
    @Column(name = "quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity;
    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;
    @Column(name = "total_cost", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalCost;
    @Column(name = "consumption_time", nullable = false)
    private LocalDateTime consumptionTime;
    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;
    @Column(name = "recorded_by", nullable = false)
    private Integer recordedBy;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_plan_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductionPlan productionPlan;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private MaterialBatch batch;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User recorder;
}
