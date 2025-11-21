package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
/**
 * 加工批次实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "supervisor", "batchWorkSessions", "equipmentUsages"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "processing_batches",
       indexes = {
           @Index(name = "idx_batch_factory", columnList = "factory_id"),
           @Index(name = "idx_batch_number", columnList = "batch_number"),
           @Index(name = "idx_batch_status", columnList = "status")
       }
)
public class ProcessingBatch extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "batch_number", nullable = false, unique = true, length = 50)
    private String batchNumber;
    @Column(name = "product_name", nullable = false)
    private String productName;
    @Column(name = "quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(name = "actual_quantity", precision = 10, scale = 2)
    private BigDecimal outputQuantity;  // 映射到actual_quantity字段

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;
    @Column(name = "start_time")
    private LocalDateTime startTime;
    @Column(name = "end_time")
    private LocalDateTime endTime;
    @Column(name = "status", nullable = false, length = 20)
    private String status = "pending"; // pending, processing, completed, cancelled
    @Column(name = "supervisor_id")
    private Integer supervisorId;
    // 成本相关字段
    @Column(name = "material_cost", precision = 10, scale = 2)
    private BigDecimal materialCost;
    @Column(name = "labor_cost", precision = 10, scale = 2)
    private BigDecimal laborCost;
    @Column(name = "equipment_cost", precision = 10, scale = 2)
    private BigDecimal equipmentCost;
    @Column(name = "other_cost", precision = 10, scale = 2)
    private BigDecimal otherCost;
    @Column(name = "total_cost", precision = 10, scale = 2)
    private BigDecimal totalCost;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /**
     * 生产效率（百分比）
     * 用于Dashboard KPI计算
     * ✅ 修复: 添加缺失字段 (2025-11-20)
     */
    @Column(name = "production_efficiency", precision = 5, scale = 2)
    private BigDecimal productionEfficiency;

    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervisor_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User supervisor;
    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<BatchWorkSession> batchWorkSessions = new ArrayList<>();
    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<BatchEquipmentUsage> equipmentUsages = new ArrayList<>();

    /**
     * 批次状态枚举
     */
    public enum BatchStatus {
        PLANNING,      // 计划中
        IN_PROGRESS,   // 进行中
        COMPLETED,     // 已完成
        CANCELLED      // 已取消
    }
}
