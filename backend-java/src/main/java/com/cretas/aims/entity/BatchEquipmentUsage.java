package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
/**
 * 批次设备使用记录实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"batch", "equipment"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "batch_equipment_usage",
       indexes = {
           @Index(name = "idx_equipusage_batch", columnList = "batch_id"),
           @Index(name = "idx_equipusage_equipment", columnList = "equipment_id")
       }
)
public class BatchEquipmentUsage extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // 统一为 Long
    @Column(name = "batch_id", nullable = false)
    private Long batchId;  // 统一为 Long，与 ProcessingBatch.id 类型一致
    @Column(name = "equipment_id", nullable = false)
    private Integer equipmentId;
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;
    @Column(name = "end_time")
    private LocalDateTime endTime;
    @Column(name = "usage_hours", precision = 10, scale = 2)
    private BigDecimal usageHours;
    @Column(name = "power_consumption", precision = 10, scale = 2)
    private BigDecimal powerConsumption;
    @Column(name = "equipment_cost", nullable = false, precision = 10, scale = 2)
    private BigDecimal equipmentCost;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProcessingBatch batch;
    @JoinColumn(name = "equipment_id", referencedColumnName = "id", insertable = false, updatable = false)
    private FactoryEquipment equipment;
}
