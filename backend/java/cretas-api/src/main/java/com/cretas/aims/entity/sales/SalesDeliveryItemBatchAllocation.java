package com.cretas.aims.entity.sales;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * PC 端销售发货行的批次分配明细（P0-13 昆山六扇门客户需求）。
 *
 * <p>一行 {@code SalesDeliveryItem} 可以拆成多个批次分配，用于强制批次追溯：
 * 发货状态流转到 SHIPPED 之前，对应 item 的所有 allocation 数量之和必须等于
 * {@code SalesDeliveryItem.deliveredQuantity}。
 *
 * <p>注意：销售发货的"批次"是 {@code FinishedGoodsBatch}（成品批次），
 * 不是原材料批次 {@code MaterialBatch}。
 */
@Entity
@Table(name = "sales_delivery_item_batch_allocations",
        indexes = {
                @Index(name = "idx_sdiba_delivery_item", columnList = "factory_id, delivery_item_id"),
                @Index(name = "idx_sdiba_batch", columnList = "factory_id, finished_goods_batch_id")
        })
@Getter
@Setter
public class SalesDeliveryItemBatchAllocation extends BaseEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @Column(name = "factory_id", length = 64, nullable = false)
    private String factoryId;

    /** 关联 {@code SalesDeliveryItem.id}（Long 以字符串形式存储以便兼容未来改造）。 */
    @Column(name = "delivery_item_id", length = 64, nullable = false)
    private String deliveryItemId;

    /** 关联 {@code FinishedGoodsBatch.id}。 */
    @Column(name = "finished_goods_batch_id", length = 64, nullable = false)
    private String finishedGoodsBatchId;

    /** 冗余批次号，便于展示与审计。 */
    @Column(name = "batch_number", length = 64, nullable = false)
    private String batchNumber;

    @Column(name = "allocated_qty", precision = 18, scale = 4, nullable = false)
    private BigDecimal allocatedQty;

    @Column(name = "unit", length = 16)
    private String unit;
}
