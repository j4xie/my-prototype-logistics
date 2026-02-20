package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.ProductType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * 销售订单行项目
 * 每行对应一种产品/菜品，有正式 FK 到 ProductType
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"salesOrder", "productType"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "sales_order_items",
        indexes = {
                @Index(name = "idx_soi_order", columnList = "sales_order_id"),
                @Index(name = "idx_soi_product", columnList = "product_type_id")
        }
)
public class SalesOrderItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sales_order_id", nullable = false, length = 191)
    private String salesOrderId;

    @Column(name = "product_type_id", nullable = false, length = 191)
    private String productTypeId;

    /** 产品名称（冗余） */
    @Column(name = "product_name", length = 200)
    private String productName;

    @NotNull
    @Positive
    @Column(name = "quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal quantity;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice;

    @Column(name = "discount_rate", precision = 5, scale = 2)
    private BigDecimal discountRate = BigDecimal.ZERO;

    /** 已发货数量 */
    @Column(name = "delivered_quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal deliveredQuantity = BigDecimal.ZERO;

    @Column(name = "remark", length = 500)
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_order_id", referencedColumnName = "id", insertable = false, updatable = false)
    private SalesOrder salesOrder;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_type_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductType productType;

    // ==================== 计算属性 ====================

    /** 行金额 = 数量 × 单价 */
    @Transient
    public BigDecimal getLineAmount() {
        if (unitPrice == null || quantity == null) return BigDecimal.ZERO;
        BigDecimal amount = quantity.multiply(unitPrice).setScale(2, BigDecimal.ROUND_HALF_UP);
        if (discountRate != null && discountRate.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal discountMultiplier = BigDecimal.ONE.subtract(
                    discountRate.divide(new BigDecimal("100"), 6, BigDecimal.ROUND_HALF_UP));
            amount = amount.multiply(discountMultiplier).setScale(2, BigDecimal.ROUND_HALF_UP);
        }
        return amount;
    }

    /** 未发货数量 */
    @Transient
    public BigDecimal getPendingQuantity() {
        BigDecimal delivered = deliveredQuantity != null ? deliveredQuantity : BigDecimal.ZERO;
        return quantity.subtract(delivered);
    }
}
