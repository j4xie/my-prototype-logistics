package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.RawMaterialType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * 采购订单行项目
 * 每行对应一种原料/食材的采购明细
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"purchaseOrder", "materialType"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "purchase_order_items",
        indexes = {
                @Index(name = "idx_poi_order", columnList = "purchase_order_id"),
                @Index(name = "idx_poi_material", columnList = "material_type_id")
        }
)
public class PurchaseOrderItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "purchase_order_id", nullable = false, length = 191)
    private String purchaseOrderId;

    @Column(name = "material_type_id", nullable = false, length = 191)
    private String materialTypeId;

    /** 原料/食材名称（冗余，方便查询） */
    @Column(name = "material_name", length = 200)
    private String materialName;

    @NotNull
    @Positive
    @Column(name = "quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal quantity;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice;

    /** 税率（百分比，如 13 表示 13%） */
    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate = BigDecimal.ZERO;

    /** 已收货数量 */
    @Column(name = "received_quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal receivedQuantity = BigDecimal.ZERO;

    @Column(name = "remark", length = 500)
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", referencedColumnName = "id", insertable = false, updatable = false)
    private PurchaseOrder purchaseOrder;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_type_id", referencedColumnName = "id", insertable = false, updatable = false)
    private RawMaterialType materialType;

    // ==================== 计算属性 ====================

    /** 行金额 = 数量 × 单价 */
    @Transient
    public BigDecimal getLineAmount() {
        if (unitPrice == null || quantity == null) return BigDecimal.ZERO;
        return quantity.multiply(unitPrice).setScale(2, BigDecimal.ROUND_HALF_UP);
    }

    /** 含税金额 */
    @Transient
    public BigDecimal getLineAmountWithTax() {
        BigDecimal amount = getLineAmount();
        if (taxRate == null || taxRate.compareTo(BigDecimal.ZERO) == 0) return amount;
        BigDecimal taxMultiplier = BigDecimal.ONE.add(taxRate.divide(new BigDecimal("100"), 6, BigDecimal.ROUND_HALF_UP));
        return amount.multiply(taxMultiplier).setScale(2, BigDecimal.ROUND_HALF_UP);
    }

    /** 未收货数量 */
    @Transient
    public BigDecimal getPendingQuantity() {
        BigDecimal received = receivedQuantity != null ? receivedQuantity : BigDecimal.ZERO;
        return quantity.subtract(received);
    }
}
