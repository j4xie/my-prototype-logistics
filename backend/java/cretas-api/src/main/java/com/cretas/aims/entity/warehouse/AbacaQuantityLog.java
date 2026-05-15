package com.cretas.aims.entity.warehouse;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 抄码品实际重量记录 (W-ABA-1)
 *
 * <p>1 个原材料批次 (material_batch) 可分多次称重 (1:N), 每条记录对应"第 N 箱"的实际重量.</p>
 *
 * <p>典型场景:</p>
 * <ul>
 *   <li>仓管员扫 PDF QR → 入库收货页 → 第 1 箱 12.5kg / 第 2 箱 13.8kg / ... 逐箱录入</li>
 *   <li>批次总重量 = SUM(actual_weight) WHERE material_batch_id=...</li>
 *   <li>双签机制: weighedBy 录入, verifiedBy 复核 (可选)</li>
 * </ul>
 *
 * @see com.cretas.aims.entity.RawMaterialType#isAbacaPackaging
 */
@Entity
@Table(name = "abaca_quantity_log", indexes = {
        @Index(name = "idx_aql_factory_batch", columnList = "factory_id,material_batch_id"),
        @Index(name = "idx_aql_material_type", columnList = "factory_id,raw_material_type_id")
})
@Where(clause = "deleted_at IS NULL")
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class AbacaQuantityLog extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "material_batch_id", nullable = false, length = 191)
    private String materialBatchId;

    @Column(name = "raw_material_type_id", nullable = false, length = 191)
    private String rawMaterialTypeId;

    /** 关联采购单行项 — 可空 (手工入库时无 PO) */
    @Column(name = "purchase_order_item_id", length = 191)
    private String purchaseOrderItemId;

    /** 第几箱 (1, 2, 3, ...) */
    @Column(name = "box_index", nullable = false)
    private Integer boxIndex;

    /** 实际称重 (单位由 unit 决定, 默认 kg) */
    @Column(name = "actual_weight", nullable = false, precision = 12, scale = 4)
    private BigDecimal actualWeight;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    /** SCALE=电子秤 / MANUAL=手工 / IMPORTED=批量导入 */
    @Column(name = "weighing_method", nullable = false, length = 20)
    private String weighingMethod;

    /** 电子秤设备 ID (如对接 scale Tool) */
    @Column(name = "scale_device_id", length = 50)
    private String scaleDeviceId;

    @Column(name = "weighed_at", nullable = false)
    private LocalDateTime weighedAt;

    @Column(name = "weighed_by", nullable = false)
    private Long weighedBy;

    /** 复核员 user_id (双签机制, 可选) */
    @Column(name = "verified_by")
    private Long verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "notes", length = 500)
    private String notes;

    /** 入库前钩子: 自动填 UUID / 默认单位 / 默认称重时间 / 默认称重方式. */
    @PrePersist
    void prePersistDefaults() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (unit == null || unit.isBlank()) {
            unit = "kg";
        }
        if (weighingMethod == null || weighingMethod.isBlank()) {
            weighingMethod = "SCALE";
        }
        if (weighedAt == null) {
            weighedAt = LocalDateTime.now();
        }
    }

    /** 是否已复核 (双签完成). */
    public boolean isVerified() {
        return verifiedBy != null && verifiedAt != null;
    }
}
