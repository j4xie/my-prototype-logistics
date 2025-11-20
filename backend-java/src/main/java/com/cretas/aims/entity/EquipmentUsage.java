package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;
/**
 * 设备使用记录实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"equipment", "productionBatch"})
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "equipment_usages",
       indexes = {
           @Index(name = "idx_usage_equipment", columnList = "equipment_id"),
           @Index(name = "idx_usage_batch", columnList = "production_batch_id"),
           @Index(name = "idx_usage_start", columnList = "start_time")
       }
)
public class EquipmentUsage extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;
    @Column(name = "equipment_id", nullable = false, length = 191)
    private String equipmentId;  // 修改为String，与FactoryEquipment.id一致
    @Column(name = "production_batch_id")
    private String productionBatchId;
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;
    @Column(name = "end_time")
    private LocalDateTime endTime;
    @Column(name = "duration_hours")
    private Integer durationHours;
    @Column(name = "operator_id")
    private Integer operatorId;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipment_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Equipment equipment;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductionBatch productionBatch;
}
