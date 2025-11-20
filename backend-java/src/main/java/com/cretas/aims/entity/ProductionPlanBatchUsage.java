package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
/**
 * 生产计划批次使用关联实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"productionPlan", "materialBatch"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "production_plan_batch_usage",
       indexes = {
           @Index(name = "idx_planbatch_plan", columnList = "production_plan_id"),
           @Index(name = "idx_planbatch_batch", columnList = "material_batch_id")
       }
)
public class ProductionPlanBatchUsage extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;
    @Column(name = "production_plan_id", nullable = false, length = 191)
    private String productionPlanId;
    @Column(name = "material_batch_id", nullable = false)
    private String materialBatchId;
    @Column(name = "batch_id", nullable = false)
    private String batchId;
    @Column(name = "planned_quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal plannedQuantity;
    @Column(name = "actual_quantity", precision = 10, scale = 2)
    private BigDecimal actualQuantity;
    @Column(name = "reserved_quantity", precision = 10, scale = 2)
    private BigDecimal reservedQuantity = BigDecimal.ZERO;
    @Column(name = "used_quantity", precision = 10, scale = 2)
    private BigDecimal usedQuantity = BigDecimal.ZERO;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_plan_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductionPlan productionPlan;
    @JoinColumn(name = "material_batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private MaterialBatch materialBatch;
}
