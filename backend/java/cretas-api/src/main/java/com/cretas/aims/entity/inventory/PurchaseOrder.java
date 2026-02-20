package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.PurchaseType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 采购订单实体
 * 通用设计：工厂采购原料 = 餐饮进货食材
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "supplier", "createdByUser", "approvedByUser", "items", "receiveRecords"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "purchase_orders",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"factory_id", "order_number"})
        },
        indexes = {
                @Index(name = "idx_po_factory", columnList = "factory_id"),
                @Index(name = "idx_po_supplier", columnList = "supplier_id"),
                @Index(name = "idx_po_status", columnList = "status"),
                @Index(name = "idx_po_order_date", columnList = "order_date"),
                @Index(name = "idx_po_type", columnList = "purchase_type")
        }
)
public class PurchaseOrder extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

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
    @Column(name = "supplier_id", nullable = false, length = 191)
    private String supplierId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "purchase_type", nullable = false, length = 32)
    private PurchaseType purchaseType = PurchaseType.DIRECT;

    @NotNull
    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    @Column(name = "expected_delivery_date")
    private LocalDate expectedDeliveryDate;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private PurchaseOrderStatus status = PurchaseOrderStatus.DRAFT;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_at")
    private java.time.LocalDateTime approvedAt;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Supplier supplier;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User createdByUser;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User approvedByUser;

    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PurchaseOrderItem> items = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.PERSIST, fetch = FetchType.LAZY)
    private List<PurchaseReceiveRecord> receiveRecords = new ArrayList<>();

    // ==================== 计算属性 ====================

    /**
     * 计算总金额（从行项目汇总）
     */
    @Transient
    public BigDecimal calculateTotalAmount() {
        if (items == null || items.isEmpty()) return BigDecimal.ZERO;
        return items.stream()
                .map(PurchaseOrderItem::getLineAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 是否全部到货
     */
    @Transient
    public boolean isFullyReceived() {
        if (items == null || items.isEmpty()) return false;
        return items.stream().allMatch(item ->
                item.getReceivedQuantity() != null &&
                        item.getReceivedQuantity().compareTo(item.getQuantity()) >= 0);
    }
}
