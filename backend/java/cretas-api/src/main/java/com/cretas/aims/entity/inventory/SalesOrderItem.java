package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.security.PriceSensitive;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import org.hibernate.annotations.Where;

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
@Where(clause = "deleted_at IS NULL")
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

    @PriceSensitive
    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice;

    @PriceSensitive
    @Column(name = "discount_rate", precision = 5, scale = 2)
    private BigDecimal discountRate = BigDecimal.ZERO;

    /** 已发货数量 */
    @Column(name = "delivered_quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal deliveredQuantity = BigDecimal.ZERO;

    /** 已被生产计划/调拨锁住的数量. Sprint3-G S-LOCK-1.
     *  写回路径: SalesOrderShortageReportListener.onSalesOrderFinanceApproved (lockedQty MVP=0,
     *  production_plan reservation 接入留 Sprint3-G follow-up). */
    @Column(name = "locked_qty", nullable = false, precision = 15, scale = 4)
    private BigDecimal lockedQty = BigDecimal.ZERO;

    /** 已 BOM 展开 + 备货 (reserve 给生产) 的数量. Sprint3-G S-LOCK-1.
     *  写回路径: SalesOrderShortageReportListener 从 ShortageReport 派生
     *  reservedQty = quantity - shortfallQuantity (LineItemMatch 已可用部分). */
    @Column(name = "reserved_qty", nullable = false, precision = 15, scale = 4)
    private BigDecimal reservedQty = BigDecimal.ZERO;

    @Column(name = "remark", length = 500)
    private String remark;

    /** 成本单价 (含税) */
    @PriceSensitive
    @Column(name = "cost_unit_price", precision = 15, scale = 4)
    private BigDecimal costUnitPrice;

    /** 税率 (%) */
    @PriceSensitive
    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate;

    /** 规格 (如 200g/盒, 310g*42袋/箱) */
    @Column(name = "specification", length = 200)
    private String specification;

    /** 箱数 = 数量/箱系数, 可手动修改 */
    @Column(name = "box_quantity", precision = 15, scale = 2)
    private BigDecimal boxQuantity;

    /**
     * 来源仓库 code (T4-D1, issue #525): WH-LOG (总仓) / WH-WKS (线边仓).
     *
     * <p>F006 客户反馈 (第四次会议 702-732): 成品会调回总仓, 总仓再安排发货.
     * Sales order line items record which warehouse to ship from. UI uses
     * {@code utils/warehouse.ts:warehouseDisplayLabel} for the human label.
     *
     * <p>Nullable: legacy rows + drafts where user hasn't picked yet.
     * Migration: {@code V20260514_01__add_sales_order_item_source_warehouse_code.sql}
     *
     * <p>Downstream linkage (T4-D5, separate ticket): outbound shipment logic
     * to honor this field when deducting inventory from the chosen warehouse.
     */
    @Column(name = "source_warehouse_code", length = 20)
    private String sourceWarehouseCode;

    /** 成本小计 = 数量 × 成本单价. Price-sensitive: returns null when costUnitPrice stripped. */
    @Transient
    @PriceSensitive
    public BigDecimal getCostTotal() {
        // Defensive null guard — costUnitPrice is @PriceSensitive, stripped to null
        // for warehouse_manager. Original ZERO fallback would have leaked "0.00" cost
        // for stripped rows, misleading non-price users into thinking cost is free.
        if (costUnitPrice == null || quantity == null) return null;
        return quantity.multiply(costUnitPrice).setScale(2, BigDecimal.ROUND_HALF_UP);
    }

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

    /** 行金额 = 数量 × 单价. Price-sensitive: returns null when unitPrice stripped. */
    @Transient
    @PriceSensitive
    public BigDecimal getLineAmount() {
        // Defensive null guard — unitPrice is @PriceSensitive, stripped to null
        // for warehouse_manager. Return null (not ZERO) to signal "not visible" vs "free".
        if (unitPrice == null || quantity == null) return null;
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
        if (quantity == null) return BigDecimal.ZERO;
        BigDecimal delivered = deliveredQuantity != null ? deliveredQuantity : BigDecimal.ZERO;
        return quantity.subtract(delivered);
    }

    /**
     * 缺料数量 = quantity - reservedQty (clamp ≥0). Sprint3-G S-LOCK-1.
     *
     * <p>非 @Column — Jackson 序列化走 getter, 客户端拿 shortageQty 直接显示红色 chip.
     * 不加 @JsonIgnore (Jackson 默认序列化 @Transient 公有 getter).
     */
    @Transient
    public BigDecimal getShortageQty() {
        BigDecimal demand = this.quantity != null ? this.quantity : BigDecimal.ZERO;
        BigDecimal reserved = this.reservedQty != null ? this.reservedQty : BigDecimal.ZERO;
        BigDecimal shortage = demand.subtract(reserved);
        return shortage.signum() < 0 ? BigDecimal.ZERO : shortage;
    }
}
