package com.cretas.aims.entity.sales;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.enums.SalesNeedPriority;
import com.cretas.aims.entity.enums.SalesNeedStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * 销售需求 — Sprint 4 W2 S-NEED-1.
 *
 * <p>客户提的购买意向: 客户/销售员录入 DRAFT → 销售员审核 CONFIRMED →
 * 一键转销售订单 CONVERTED_TO_SO (auto-create SalesOrder + 双向关联).
 *
 * <p><b>productId</b> 引用 ProductType.id (与 SalesOrderItem 一致, 无 FK 约束
 * 仅业务关联). 转换时映射为 SalesOrderItem.productTypeId.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "sales_needs",
        indexes = {
                @Index(name = "idx_sn_factory_status", columnList = "factory_id, status"),
                @Index(name = "idx_sn_customer", columnList = "factory_id, customer_id"),
                @Index(name = "idx_sn_converted_so", columnList = "converted_sales_order_id")
        }
)
@Where(clause = "deleted_at IS NULL")
public class SalesNeed extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @NotBlank
    @Column(name = "factory_id", nullable = false, length = 191)
    private String factoryId;

    @NotBlank
    @Column(name = "customer_id", nullable = false, length = 191)
    private String customerId;

    /** 客户名称冗余 (来自 Customer.name, 转换时也用此填 SalesOrder 关联). */
    @Column(name = "customer_name", length = 200)
    private String customerName;

    @NotBlank
    @Column(name = "product_id", nullable = false, length = 191)
    private String productId;

    /** 产品名称冗余. */
    @Column(name = "product_name", length = 200)
    private String productName;

    @NotNull
    @Positive
    @Column(name = "qty_demand", nullable = false, precision = 15, scale = 4)
    private BigDecimal qtyDemand;

    @NotBlank
    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "expected_delivery_date")
    private LocalDate expectedDeliveryDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 16)
    private SalesNeedPriority priority = SalesNeedPriority.NORMAL;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private SalesNeedStatus status = SalesNeedStatus.DRAFT;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    /** 转换后填充: 关联到 SalesOrder.id, 状态变 CONVERTED_TO_SO. */
    @Column(name = "converted_sales_order_id", length = 191)
    private String convertedSalesOrderId;

    /** 创建者 user id. */
    @Column(name = "created_by")
    private Long createdBy;
}
