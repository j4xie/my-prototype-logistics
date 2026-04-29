package com.cretas.aims.entity.warehouse;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import org.hibernate.annotations.Where;

/**
 * 周转耗材流水 — SHIP_OUT 随货发出 / RETURN_IN 客户归还 / LOSS 丢失赔偿 / ADJUST 手工调整
 */
@Entity
@Table(name = "reusable_container_transactions")
@Getter
@Setter
@Where(clause = "deleted_at IS NULL")
public class ReusableContainerTransaction extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", length = 64, nullable = false)
    private String factoryId;

    @Column(name = "container_id", length = 64, nullable = false)
    private String containerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", length = 16, nullable = false)
    private TransactionType transactionType;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "customer_id", length = 64)
    private String customerId;

    @Column(name = "customer_name", length = 128)
    private String customerName;

    @Column(name = "sales_delivery_id", length = 64)
    private String salesDeliveryId;

    @Column(name = "compensation_amount", precision = 12, scale = 2)
    private BigDecimal compensationAmount;

    @Column(name = "remark", length = 500)
    private String remark;

    public enum TransactionType { SHIP_OUT, RETURN_IN, LOSS, ADJUST }
}
