package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
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
public class SalesOrder extends BaseEntity {

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
    @Column(name = "customer_id", nullable = false, length = 191)
    private String customerId;

    @NotNull
    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    /** 要求交货日期 */
    @Column(name = "required_delivery_date")
    private LocalDate requiredDeliveryDate;

    /** 收货地址 */
    @Column(name = "delivery_address")
    private String deliveryAddress;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "discount_amount", precision = 15, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private SalesOrderStatus status = SalesOrderStatus.DRAFT;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

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
        return items.stream()
                .map(SalesOrderItem::getLineAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Transient
    public BigDecimal getPayableAmount() {
        BigDecimal discount = discountAmount != null ? discountAmount : BigDecimal.ZERO;
        BigDecimal tax = taxAmount != null ? taxAmount : BigDecimal.ZERO;
        return totalAmount.subtract(discount).add(tax);
    }
}
