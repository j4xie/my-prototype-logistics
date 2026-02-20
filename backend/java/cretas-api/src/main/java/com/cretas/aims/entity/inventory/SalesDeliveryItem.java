package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.ProductType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * 发货行项目
 * 每行对应一种产品的发货明细
 * 发货确认后关联到扣减的 FinishedGoodsBatch
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"deliveryRecord", "productType", "finishedGoodsBatch"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "sales_delivery_items",
        indexes = {
                @Index(name = "idx_sdi_record", columnList = "delivery_record_id"),
                @Index(name = "idx_sdi_product", columnList = "product_type_id"),
                @Index(name = "idx_sdi_batch", columnList = "finished_goods_batch_id")
        }
)
public class SalesDeliveryItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "delivery_record_id", nullable = false, length = 191)
    private String deliveryRecordId;

    @Column(name = "product_type_id", nullable = false, length = 191)
    private String productTypeId;

    /** 产品名称（冗余） */
    @Column(name = "product_name", length = 200)
    private String productName;

    /** 发货数量 */
    @Column(name = "delivered_quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal deliveredQuantity;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice;

    /** 关联扣减的成品批次ID */
    @Column(name = "finished_goods_batch_id", length = 191)
    private String finishedGoodsBatchId;

    @Column(name = "remark", length = 500)
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_record_id", referencedColumnName = "id", insertable = false, updatable = false)
    private SalesDeliveryRecord deliveryRecord;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_type_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductType productType;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finished_goods_batch_id", referencedColumnName = "id", insertable = false, updatable = false)
    private FinishedGoodsBatch finishedGoodsBatch;
}
