package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.enums.TransferItemType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * 调拨行项目
 * 支持原料和成品两种类型调拨
 * item_type = RAW_MATERIAL → material_type_id (关联 raw_material_types)
 * item_type = FINISHED_GOODS → product_type_id (关联 product_types)
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"transfer"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "internal_transfer_items",
        indexes = {
                @Index(name = "idx_iti_transfer", columnList = "transfer_id"),
                @Index(name = "idx_iti_material", columnList = "material_type_id"),
                @Index(name = "idx_iti_product", columnList = "product_type_id")
        }
)
public class InternalTransferItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transfer_id", nullable = false, length = 191)
    private String transferId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 32)
    private TransferItemType itemType;

    /** 原料类型ID（item_type=RAW_MATERIAL时使用） */
    @Column(name = "material_type_id", length = 191)
    private String materialTypeId;

    /** 产品类型ID（item_type=FINISHED_GOODS时使用） */
    @Column(name = "product_type_id", length = 191)
    private String productTypeId;

    /** 物品名称（冗余） */
    @Column(name = "item_name", length = 200)
    private String itemName;

    /** 调拨数量 */
    @Column(name = "quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal quantity;

    /** 实际到货数量（签收时填） */
    @Column(name = "received_quantity", precision = 15, scale = 4)
    private BigDecimal receivedQuantity;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    /** 调拨单价（按总部定价或协议价） */
    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice;

    /** 调出方批次ID（发货时关联） */
    @Column(name = "source_batch_id", length = 191)
    private String sourceBatchId;

    /** 调入方批次ID（签收确认后创建） */
    @Column(name = "target_batch_id", length = 191)
    private String targetBatchId;

    @Column(name = "remark", length = 500)
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_id", referencedColumnName = "id", insertable = false, updatable = false)
    private InternalTransfer transfer;

    // ==================== 计算属性 ====================

    @Transient
    public BigDecimal getLineAmount() {
        if (unitPrice == null || quantity == null) return BigDecimal.ZERO;
        return quantity.multiply(unitPrice).setScale(2, BigDecimal.ROUND_HALF_UP);
    }
}
