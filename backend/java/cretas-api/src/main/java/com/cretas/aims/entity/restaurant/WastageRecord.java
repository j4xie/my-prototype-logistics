package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * 食材损耗记录实体（餐饮版）
 *
 * <p>记录食材的各类损耗，包括过期、破损、变质、加工损耗等。
 * 审批通过后自动扣减对应物料批次库存并记录损耗成本。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "wastage_records",
        indexes = {
                @Index(name = "idx_wastage_factory", columnList = "factory_id"),
                @Index(name = "idx_wastage_date", columnList = "wastage_date"),
                @Index(name = "idx_wastage_status", columnList = "status"),
                @Index(name = "idx_wastage_type", columnList = "type"),
                @Index(name = "idx_wastage_factory_date", columnList = "factory_id,wastage_date")
        }
)
public class WastageRecord extends BaseEntity {

    // ========== 主键 ==========

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    // ========== 归属与单号 ==========

    @NotBlank
    @Column(name = "factory_id", nullable = false, length = 100)
    private String factoryId;

    /**
     * 损耗单号（如：WST-20260220-001）
     */
    @Column(name = "wastage_number", length = 50)
    private String wastageNumber;

    /**
     * 损耗日期
     */
    @NotNull
    @Column(name = "wastage_date", nullable = false)
    private LocalDate wastageDate;

    // ========== 类型与状态 ==========

    /**
     * 损耗类型
     */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private WastageType type;

    /**
     * 审批状态
     */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private Status status = Status.DRAFT;

    // ========== 食材信息 ==========

    /**
     * 食材类型 ID (raw_material_types.id)
     */
    @NotBlank
    @Column(name = "raw_material_type_id", nullable = false, length = 191)
    private String rawMaterialTypeId;

    /**
     * 物料批次 ID (material_batches.id)，可选
     */
    @Column(name = "material_batch_id", length = 191)
    private String materialBatchId;

    /**
     * 损耗数量
     */
    @NotNull
    @Column(name = "quantity", nullable = false, precision = 10, scale = 4)
    private BigDecimal quantity;

    /**
     * 计量单位
     */
    @Column(name = "unit", length = 20)
    private String unit;

    /**
     * 估算损失金额（损耗量 × 单价）
     */
    @Column(name = "estimated_cost", precision = 15, scale = 2)
    private BigDecimal estimatedCost;

    /**
     * 损耗原因描述
     */
    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    // ========== 审批信息 ==========

    /**
     * 上报人 ID
     */
    @Column(name = "reported_by")
    private Long reportedBy;

    /**
     * 审批人 ID
     */
    @Column(name = "approved_by")
    private Long approvedBy;

    /**
     * 审批时间
     */
    @Column(name = "approved_at")
    private java.time.LocalDateTime approvedAt;

    /**
     * 备注
     */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // ========== 枚举 ==========

    /**
     * 损耗类型
     * <ul>
     *   <li>EXPIRED — 过期报废</li>
     *   <li>DAMAGED — 物理破损（包装损坏、运输破损）</li>
     *   <li>SPOILED — 变质（冷链断链、存储不当）</li>
     *   <li>PROCESSING — 加工损耗（切割、去皮、煮制蒸发等正常损耗）</li>
     *   <li>OTHER — 其他原因</li>
     * </ul>
     */
    public enum WastageType {
        EXPIRED,
        DAMAGED,
        SPOILED,
        PROCESSING,
        OTHER
    }

    /**
     * 审批状态
     * <ul>
     *   <li>DRAFT — 草稿</li>
     *   <li>SUBMITTED — 已提交</li>
     *   <li>APPROVED — 已审批（自动扣减库存）</li>
     * </ul>
     */
    public enum Status {
        DRAFT,
        SUBMITTED,
        APPROVED
    }
}
