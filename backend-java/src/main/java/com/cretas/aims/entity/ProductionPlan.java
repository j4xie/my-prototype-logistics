package com.cretas.aims.entity;

import com.cretas.aims.entity.enums.MixedBatchType;
import com.cretas.aims.entity.enums.PlanSourceType;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.enums.ProductionPlanType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@ToString(exclude = {"factory", "productType", "createdByUser", "materialConsumptions", "batchUsages"})
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
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

    @Column(name = "expected_completion_date")
    private LocalDate expectedCompletionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProductionPlanStatus status = ProductionPlanStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "plan_type")
    private ProductionPlanType planType = ProductionPlanType.FROM_INVENTORY;
    @Column(name = "customer_order_number", length = 100)
    private String customerOrderNumber;
    @Column(name = "priority")
    private Integer priority;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // 未来计划自动匹配相关字段
    @Column(name = "allocated_quantity", precision = 10, scale = 2)
    private BigDecimal allocatedQuantity = BigDecimal.ZERO;  // 已分配的原料数量

    @Column(name = "is_fully_matched")
    private Boolean isFullyMatched = false;  // 是否完全匹配

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
    private Long createdBy;

    // ==================== 调度员模块扩展字段 ====================

    /**
     * 计划来源类型
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 30)
    private PlanSourceType sourceType = PlanSourceType.MANUAL;

    /**
     * 关联订单ID
     */
    @Column(name = "source_order_id", length = 50)
    private String sourceOrderId;

    /**
     * 客户名称
     */
    @Column(name = "source_customer_name", length = 100)
    private String sourceCustomerName;

    /**
     * AI预测置信度 (0-100)
     */
    @Column(name = "ai_confidence")
    private Integer aiConfidence;

    /**
     * 预测原因 (如: 冬季火锅需求+15%)
     */
    @Column(name = "forecast_reason", length = 255)
    private String forecastReason;

    /**
     * CR值 (Critical Ratio)
     * CR = (交期-今日) / 工期，越小越紧急
     */
    @Column(name = "cr_value", precision = 5, scale = 2)
    private BigDecimal crValue;

    /**
     * 是否混批
     */
    @Column(name = "is_mixed_batch")
    private Boolean isMixedBatch = false;

    /**
     * 混批类型
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "mixed_batch_type", length = 30)
    private MixedBatchType mixedBatchType;

    /**
     * 混批关联订单 (JSON格式)
     * 格式: ["ORD-001", "ORD-002", "ORD-003"]
     */
    @Column(name = "related_orders", columnDefinition = "JSON")
    private String relatedOrders;

    // 关联关系
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    @org.hibernate.annotations.BatchSize(size = 10)
    private Factory factory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_type_id", referencedColumnName = "id", insertable = false, updatable = false)
    @org.hibernate.annotations.BatchSize(size = 20)
    private ProductType productType;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    @org.hibernate.annotations.BatchSize(size = 10)
    private User createdByUser;

    @JsonIgnore
    @OneToMany(mappedBy = "productionPlan", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialConsumption> materialConsumptions = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "productionPlan", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductionPlanBatchUsage> batchUsages = new ArrayList<>();

    /**
     * 计算剩余需要匹配的原料数量
     */
    public BigDecimal getRemainingQuantity() {
        if (plannedQuantity == null) return BigDecimal.ZERO;
        if (allocatedQuantity == null) return plannedQuantity;
        return plannedQuantity.subtract(allocatedQuantity);
    }

    /**
     * 计算匹配进度百分比
     */
    public Integer getMatchingProgress() {
        if (plannedQuantity == null || plannedQuantity.compareTo(BigDecimal.ZERO) == 0) {
            return 0;
        }
        if (allocatedQuantity == null) return 0;
        return allocatedQuantity.multiply(new BigDecimal(100))
                .divide(plannedQuantity, 0, java.math.RoundingMode.HALF_UP)
                .intValue();
    }

    // ==================== 调度员模块辅助方法 ====================

    /**
     * 计算CR值 (Critical Ratio)
     * CR = (交期-今日) / 预估工期
     * CR < 1 表示紧急, CR > 1 表示有余裕
     *
     * @param estimatedWorkDays 预估工期（天数）
     * @return CR值
     */
    public BigDecimal calculateCrValue(int estimatedWorkDays) {
        if (expectedCompletionDate == null || estimatedWorkDays <= 0) {
            return null;
        }
        long daysUntilDeadline = java.time.temporal.ChronoUnit.DAYS.between(
                LocalDate.now(), expectedCompletionDate);
        if (daysUntilDeadline < 0) {
            return BigDecimal.ZERO; // 已超期
        }
        return new BigDecimal(daysUntilDeadline)
                .divide(new BigDecimal(estimatedWorkDays), 2, java.math.RoundingMode.HALF_UP);
    }

    /**
     * 判断是否紧急 (CR < 1)
     */
    public boolean isUrgent() {
        return crValue != null && crValue.compareTo(BigDecimal.ONE) < 0;
    }

    /**
     * 判断是否来自客户订单
     */
    public boolean isFromCustomerOrder() {
        return sourceType == PlanSourceType.CUSTOMER_ORDER;
    }

    /**
     * 判断是否来自AI预测
     */
    public boolean isFromAiPrediction() {
        return sourceType == PlanSourceType.AI_FORECAST;
    }

    /**
     * 获取计划来源显示名称
     */
    public String getSourceTypeDisplayName() {
        return sourceType != null ? sourceType.getDisplayName() : "手动创建";
    }

    /**
     * 获取混批类型显示名称
     */
    public String getMixedBatchTypeDisplayName() {
        return mixedBatchType != null ? mixedBatchType.getDisplayName() : null;
    }

    /**
     * 获取AI预测置信度等级
     * @return HIGH(>85%), MEDIUM(60-85%), LOW(<60%)
     */
    public String getAiConfidenceLevel() {
        if (aiConfidence == null) {
            return null;
        }
        if (aiConfidence >= 85) {
            return "HIGH";
        } else if (aiConfidence >= 60) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }
}
