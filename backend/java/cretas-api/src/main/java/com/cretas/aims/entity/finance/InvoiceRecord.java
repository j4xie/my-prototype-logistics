package com.cretas.aims.entity.finance;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.entity.enums.InvoiceType;
import lombok.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 开票记录 — 独立于 ArApTransaction 的开票工作流
 *
 * 流程: REQUESTED → APPROVED → ISSUED (或 REJECTED/CANCELLED)
 * 开票完成后同时回写 SalesOrder.invoicedAmount/invoiceStatus
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "invoice_records",
        indexes = {
                @Index(name = "idx_inv_factory", columnList = "factory_id"),
                @Index(name = "idx_inv_sales_order", columnList = "sales_order_id"),
                @Index(name = "idx_inv_customer", columnList = "customer_id"),
                @Index(name = "idx_inv_status", columnList = "status")
        })
public class InvoiceRecord extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) id = UUID.randomUUID().toString();
    }

    @Column(name = "factory_id", nullable = false, length = 191)
    private String factoryId;

    /** 发票编号: INV-YYYYMMDD-XXXX */
    @Column(name = "invoice_number", nullable = false, length = 50)
    private String invoiceNumber;

    @Column(name = "sales_order_id", length = 191)
    private String salesOrderId;

    @Column(name = "customer_id", length = 191)
    private String customerId;

    @Column(name = "customer_name", length = 200)
    private String customerName;

    /** 不含税金额 */
    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /** 税额 */
    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount;

    /** 价税合计 */
    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "invoice_type", length = 20)
    private InvoiceType invoiceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private InvoiceStatus status;

    // ==================== 申请 ====================

    @Column(name = "requested_by")
    private Long requestedBy;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    // ==================== 审核 ====================

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    // ==================== 开具 ====================

    @Column(name = "issued_at")
    private LocalDateTime issuedAt;

    /** 发票PDF的OSS URL */
    @Column(name = "invoice_pdf_url", length = 500)
    private String invoicePdfUrl;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;
}
