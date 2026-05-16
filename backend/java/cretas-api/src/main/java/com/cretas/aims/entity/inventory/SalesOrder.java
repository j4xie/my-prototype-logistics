package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.dto.sales.ExtraFeeItem;
import com.cretas.aims.security.PriceSensitive;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Formula;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.Where;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 销售订单
 * 通用：工厂销售出货 = 餐饮外卖/堂食/团购
 * 替代 ShipmentRecord 的无结构设计，支持多品出货
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "customer", "createdByUser", "items", "deliveryRecords"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "sales_orders",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"factory_id", "order_number"})
        },
        indexes = {
                @Index(name = "idx_so_factory", columnList = "factory_id"),
                @Index(name = "idx_so_customer", columnList = "customer_id"),
                @Index(name = "idx_so_status", columnList = "status"),
                @Index(name = "idx_so_order_date", columnList = "order_date")
        }
)
@Where(clause = "deleted_at IS NULL")
public class SalesOrder extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    /** Sprint3-E F-VFLAG-1: 凭证生成状态. UNCREATED → PENDING → CREATED / FAILED. */
    @Enumerated(EnumType.STRING)
    @Column(name = "vflag", nullable = false, length = 20)
    private com.cretas.aims.entity.enums.VoucherFlag vflag = com.cretas.aims.entity.enums.VoucherFlag.UNCREATED;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @NotBlank
    @Column(name = "factory_id", nullable = false)
    private String factoryId;

    @NotBlank
    @Column(name = "order_number", nullable = false, length = 50)
    private String orderNumber;

    @NotBlank
    @Column(name = "customer_id", nullable = false, length = 191)
    private String customerId;

    @Formula("(SELECT c.name FROM customers c WHERE c.id = customer_id)")
    private String customerName;

    @NotNull
    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    /** 要求交货日期 */
    @Column(name = "required_delivery_date")
    private LocalDate requiredDeliveryDate;

    /** 收货地址 */
    @Column(name = "delivery_address")
    private String deliveryAddress;

    @PriceSensitive
    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @PriceSensitive
    @Column(name = "discount_amount", precision = 15, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @PriceSensitive
    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private SalesOrderStatus status = SalesOrderStatus.DRAFT;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    /** Optimistic lock version — prevents silent last-write-wins on concurrent edits */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    // ==================== 销售扩展字段 ====================

    /** 业务员 */
    @Column(name = "salesperson", length = 100)
    private String salesperson;

    /** 业务员 user_id (新数据). 老订单为 NULL, 用 salesperson 字符串字段兜底.
     *  R6 (V20260425_09): converted from VARCHAR to BIGINT + FK to users(id) ON DELETE SET NULL. */
    @Column(name = "salesperson_id")
    private Long salespersonId;

    /** 是否含运费 */
    @Column(name = "shipping_included")
    private Boolean shippingIncluded;

    /** 运费 */
    @PriceSensitive
    @Column(name = "shipping_fee", precision = 15, scale = 2)
    private BigDecimal shippingFee;

    /** 其他费用 (装卸费/包装费/...) — JSON 数组 [{name, amount, remark}].
     * Note: each item's {@code amount} is also {@code @PriceSensitive} (see {@link ExtraFeeItem}). */
    @Type(JsonBinaryType.class)
    @Column(name = "extra_fees", columnDefinition = "jsonb")
    private List<ExtraFeeItem> extraFees;

    /** 实际发货金额 */
    @PriceSensitive
    @Column(name = "actual_shipped_amount", precision = 15, scale = 2)
    private BigDecimal actualShippedAmount;

    // ==================== 财务审核 ====================

    /** 财务审核人ID */
    @Column(name = "finance_reviewed_by")
    private Long financeReviewedBy;

    /** 财务审核时间 */
    @Column(name = "finance_reviewed_at")
    private LocalDateTime financeReviewedAt;

    /** 财务审核意见 */
    @Column(name = "finance_review_notes", columnDefinition = "TEXT")
    private String financeReviewNotes;

    /** 预估BOM成本（基于BOM + 历史采购均价） */
    @PriceSensitive
    @Column(name = "estimated_cost", precision = 15, scale = 2)
    private BigDecimal estimatedCost;

    /** 预估利润（totalAmount - estimatedCost） */
    @PriceSensitive
    @Column(name = "estimated_profit", precision = 15, scale = 2)
    private BigDecimal estimatedProfit;

    // ==================== 开票/回款/扩展 ====================

    /** 开票状态: NOT_INVOICED, PARTIAL_INVOICED, FULLY_INVOICED */
    @Column(name = "invoice_status", length = 32)
    private String invoiceStatus;

    /** 已开票金额 */
    @PriceSensitive
    @Column(name = "invoiced_amount", precision = 15, scale = 2)
    private BigDecimal invoicedAmount;

    /** 是否结清 */
    @Column(name = "settlement_flag")
    private Boolean settlementFlag;

    /** 已收款金额 */
    @PriceSensitive
    @Column(name = "paid_amount", precision = 15, scale = 2)
    private BigDecimal paidAmount;

    /** 关联报价单ID */
    @Column(name = "quote_id", length = 191)
    private String quoteId;

    /** 运输计划状态 */
    @Column(name = "transport_plan_status", length = 32)
    private String transportPlanStatus;

    /** 交付提醒日期 */
    @Column(name = "delivery_reminder_date")
    private java.time.LocalDate deliveryReminderDate;

    /** 下单箱数 */
    @Column(name = "box_quantity", precision = 15, scale = 2)
    private BigDecimal boxQuantity;

    /** P1-7 预订合同附件 URL (OSS path, v1 §2.4.3 客户会议 2257s 提及) */
    @Column(name = "contract_file_url", length = 500)
    private String contractFileUrl;

    /** P1-7 预订合同附件原文件名 */
    @Column(name = "contract_file_name", length = 255)
    private String contractFileName;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Customer customer;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User createdByUser;

    @OneToMany(mappedBy = "salesOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<SalesOrderItem> items = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "salesOrder", cascade = CascadeType.PERSIST, fetch = FetchType.LAZY)
    private List<SalesDeliveryRecord> deliveryRecords = new ArrayList<>();

    // ==================== 计算属性 ====================

    @Transient
    public BigDecimal calculateTotalAmount() {
        if (items == null || items.isEmpty()) return BigDecimal.ZERO;
        // Defensive: items[].getLineAmount() may return null when unitPrice stripped
        // (@PriceSensitive). Filter nulls so reduce doesn't NPE on BigDecimal::add.
        return items.stream()
                .map(SalesOrderItem::getLineAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Transient
    @PriceSensitive
    public BigDecimal getPayableAmount() {
        // PR #423 hardening: PriceFieldResponseAdvice strips totalAmount to null for
        // roles without procurement:price:view (e.g. warehouse_manager). Derived getter
        // must mirror that strip — otherwise Jackson NPEs on subtract(...) when
        // serializing for those roles → HTTP 500 (P0 fix 2026-05-12, PR #443).
        if (totalAmount == null) return null;
        BigDecimal discount = discountAmount != null ? discountAmount : BigDecimal.ZERO;
        BigDecimal tax = taxAmount != null ? taxAmount : BigDecimal.ZERO;
        return totalAmount.subtract(discount).add(tax);
    }

    /**
     * 收款状态 — v1 §2.4.4 "待收款/部分收款/已收款".
     * 从 paidAmount vs totalAmount 派生, 不存 DB.
     * @JsonProperty 确保 Jackson 将此 @Transient getter 序列化到 JSON 响应.
     */
    @Transient
    @JsonProperty("paymentStatus")
    public String getPaymentStatus() {
        BigDecimal paid = this.paidAmount != null ? this.paidAmount : BigDecimal.ZERO;
        BigDecimal total = this.totalAmount != null ? this.totalAmount : BigDecimal.ZERO;
        if (paid.compareTo(BigDecimal.ZERO) <= 0) return "UNPAID";
        if (paid.compareTo(total) >= 0) return "PAID";
        return "PARTIAL";
    }
}
