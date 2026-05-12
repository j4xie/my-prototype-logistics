package com.cretas.aims.entity.finance;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.security.PriceSensitive;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.enums.PaymentRecordStatus;
import lombok.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.hibernate.annotations.Where;

/**
 * 收款记录 — 独立于 ArApTransaction 的收款确认工作流
 *
 * 流程: PENDING → VERIFIED (或 REJECTED)
 * 验证通过后: 创建 ArApTransaction(AR_PAYMENT) + 更新 SalesOrder.paidAmount/settlementFlag
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "payment_records",
        indexes = {
                @Index(name = "idx_pay_factory", columnList = "factory_id"),
                @Index(name = "idx_pay_sales_order", columnList = "sales_order_id"),
                @Index(name = "idx_pay_customer", columnList = "customer_id"),
                @Index(name = "idx_pay_status", columnList = "status")
        })
@Where(clause = "deleted_at IS NULL")
public class PaymentRecord extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) id = UUID.randomUUID().toString();
    }

    @Column(name = "factory_id", nullable = false, length = 191)
    private String factoryId;

    /** 收款编号: PAY-YYYYMMDD-XXXX */
    @Column(name = "payment_number", nullable = false, length = 50)
    private String paymentNumber;

    @Column(name = "sales_order_id", length = 191)
    private String salesOrderId;

    @Column(name = "customer_id", length = 191)
    private String customerId;

    @Column(name = "customer_name", length = 200)
    private String customerName;

    @PriceSensitive
    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 32)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_date")
    private LocalDate paymentDate;

    /** 银行流水号/支付凭证号 */
    @Column(name = "payment_reference", length = 200)
    private String paymentReference;

    /** 收款凭证图片/文件 OSS URL */
    @Column(name = "receipt_url", length = 500)
    private String receiptUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PaymentRecordStatus status;

    @Column(name = "recorded_by")
    private Long recordedBy;

    @Column(name = "verified_by")
    private Long verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;
}
