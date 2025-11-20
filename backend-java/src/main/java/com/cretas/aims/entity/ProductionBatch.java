package com.cretas.aims.entity;

import com.cretas.aims.entity.enums.ProductionBatchStatus;
import com.cretas.aims.entity.enums.QualityStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import javax.persistence.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
/**
 * 生产批次实体
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)  // 继承 BaseEntity，需要调用 super
@Entity
@Table(name = "production_batches",
       indexes = {
           @Index(name = "idx_batch_factory", columnList = "factory_id"),
           @Index(name = "idx_batch_number", columnList = "batch_number"),
           @Index(name = "idx_batch_status", columnList = "status"),
           @Index(name = "idx_batch_plan", columnList = "production_plan_id")
       }
)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductionBatch extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;
    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;
     /**
      * 批次号
      */
    @Column(name = "batch_number", nullable = false, unique = true, length = 50)
    private String batchNumber;
     /**
      * 生产计划ID
      */
    @Column(name = "production_plan_id", length = 191)
    private String productionPlanId;
     /**
      * 产品类型ID
      */
    @Column(name = "product_type_id", nullable = false)
    private Integer productTypeId;
     /**
      * 产品名称
      */
    @Column(name = "product_name", length = 100)
    private String productName;
     /**
      * 计划数量
      */
    @Column(name = "planned_quantity", precision = 12, scale = 2)
    private BigDecimal plannedQuantity;
     /**
      * 实际产量
      */
    @Column(name = "actual_quantity", precision = 12, scale = 2)
    private BigDecimal actualQuantity;
     /**
      * 良品数量
      */
    @Column(name = "good_quantity", precision = 12, scale = 2)
    private BigDecimal goodQuantity;
     /**
      * 不良品数量
      */
    @Column(name = "defect_quantity", precision = 12, scale = 2)
    private BigDecimal defectQuantity;
     /**
      * 批次状态: PLANNED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
      */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ProductionBatchStatus status;
     /**
      * 质量状态: PENDING_INSPECTION, INSPECTING, PASSED, FAILED, PARTIAL_PASS, REWORK_REQUIRED, etc.
      */
    @Enumerated(EnumType.STRING)
    @Column(name = "quality_status", length = 30)
    private QualityStatus qualityStatus;
     /**
      * 开始时间
      */
    @Column(name = "start_time")
    private LocalDateTime startTime;
     /**
      * 结束时间
      */
    @Column(name = "end_time")
    private LocalDateTime endTime;
     /**
      * 生产线/设备ID
      */
    @Column(name = "equipment_id")
    private Integer equipmentId;
     /**
      * 生产线名称
      */
    @Column(name = "equipment_name", length = 100)
    private String equipmentName;
     /**
      * 负责人ID
      */
    @Column(name = "supervisor_id")
    private Integer supervisorId;
     /**
      * 负责人名称
      */
    @Column(name = "supervisor_name", length = 50)
    private String supervisorName;
     /**
      * 操作工人数
      */
    @Column(name = "worker_count")
    private Integer workerCount;
     /**
      * 工作时长（分钟）
      */
    @Column(name = "work_duration_minutes")
    private Integer workDurationMinutes;
     /**
      * 原料成本
      */
    @Column(name = "material_cost", precision = 12, scale = 2)
    private BigDecimal materialCost;
     /**
      * 人工成本
      */
    @Column(name = "labor_cost", precision = 12, scale = 2)
    private BigDecimal laborCost;
     /**
      * 设备成本
      */
    @Column(name = "equipment_cost", precision = 12, scale = 2)
    private BigDecimal equipmentCost;
     /**
      * 其他成本
      */
    @Column(name = "other_cost", precision = 12, scale = 2)
    private BigDecimal otherCost;
     /**
      * 总成本
      */
    @Column(name = "total_cost", precision = 12, scale = 2)
    private BigDecimal totalCost;
     /**
      * 单位成本
      */
    @Column(name = "unit_cost", precision = 12, scale = 4)
    private BigDecimal unitCost;
     /**
      * 良品率
      */
    @Column(name = "yield_rate", precision = 5, scale = 2)
    private BigDecimal yieldRate;
     /**
      * 效率（实际产量/计划产量）
      */
    @Column(name = "efficiency", precision = 5, scale = 2)
    private BigDecimal efficiency;
     /**
      * 备注
      */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
     /**
      * 创建人ID
      */
    @Column(name = "created_by")
    private Integer createdBy;

    // ==========================================
    // 注意: createdAt 和 updatedAt 字段已从 BaseEntity 继承
    // 不再需要在此定义，避免字段重复
    // ==========================================

    @PrePersist
    protected void onCreate() {
        super.onCreate();  // 调用 BaseEntity 的时间戳初始化
        if (status == null) {
            status = ProductionBatchStatus.PLANNED;
        }
    }
    @PreUpdate
    protected void onUpdate() {
        super.onUpdate();  // 调用 BaseEntity 的时间戳更新
        calculateMetrics();  // 保留业务逻辑：自动计算指标
    }

    /**
     * 计算各项指标
     */
    public void calculateMetrics() {
        // 计算总成本
        if (materialCost != null || laborCost != null || equipmentCost != null || otherCost != null) {
            totalCost = BigDecimal.ZERO;
            if (materialCost != null) totalCost = totalCost.add(materialCost);
            if (laborCost != null) totalCost = totalCost.add(laborCost);
            if (equipmentCost != null) totalCost = totalCost.add(equipmentCost);
            if (otherCost != null) totalCost = totalCost.add(otherCost);
        }

        // 计算单位成本
        if (totalCost != null && actualQuantity != null && actualQuantity.compareTo(BigDecimal.ZERO) > 0) {
            unitCost = totalCost.divide(actualQuantity, 4, RoundingMode.HALF_UP);
        }

        // 计算良品率
        if (goodQuantity != null && actualQuantity != null && actualQuantity.compareTo(BigDecimal.ZERO) > 0) {
            yieldRate = goodQuantity.multiply(BigDecimal.valueOf(100))
                    .divide(actualQuantity, 2, RoundingMode.HALF_UP);
        }

        // 计算效率
        if (actualQuantity != null && plannedQuantity != null && plannedQuantity.compareTo(BigDecimal.ZERO) > 0) {
            efficiency = actualQuantity.multiply(BigDecimal.valueOf(100))
                    .divide(plannedQuantity, 2, RoundingMode.HALF_UP);
        }

        // 计算工作时长
        if (startTime != null && endTime != null) {
            workDurationMinutes = (int) java.time.Duration.between(startTime, endTime).toMinutes();
        }
    }
}
