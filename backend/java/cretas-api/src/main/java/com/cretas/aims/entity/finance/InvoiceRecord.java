package com.cretas.aims.entity.finance;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.security.PriceSensitive;
import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.entity.enums.InvoiceType;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.Where;

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
@Where(clause = "deleted_at IS NULL")
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

    /** 不含税金额 (各税率小计之和) */
    @PriceSensitive
    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /** 税额 (各税率小计之和) */
    @PriceSensitive
    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount;

    /** 价税合计 */
    @PriceSensitive
    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    /**
     * 税率分组明细 — 一笔订单可能同时含 9% 原料 + 13% 加工费两个税项,
     * 开票申请按 tax_rate 自动分组聚合,财务审批和开票时按组显示。
     *
     * 结构示例:
     * <pre>
     * [
     *   {"taxRate": 9.00,  "taxableAmount": 5000.00, "taxAmount": 450.00, "lineCount": 3},
     *   {"taxRate": 13.00, "taxableAmount": 2000.00, "taxAmount": 260.00, "lineCount": 2}
     * ]
     * </pre>
     *
     * 来源: 客户原话 (会议 2645-2660s) — 六扇门最核心财务诉求 (V3 P0-3 / G1)
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tax_breakdown", columnDefinition = "jsonb")
    private List<TaxBreakdownEntry> taxBreakdown;

    /** 税率分组明细行 */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaxBreakdownEntry {
        /** 税率百分比, 如 9.00 / 13.00 */
        private BigDecimal taxRate;
        /** 该税率下的不含税金额合计 */
        @PriceSensitive
        private BigDecimal taxableAmount;
        /** 该税率下的税额合计 = taxableAmount × taxRate / 100 */
        @PriceSensitive
        private BigDecimal taxAmount;
        /** 该税率涉及的订单行数 */
        private Integer lineCount;
    }

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

    /** 发票PDF原文件名 (供下载时保留客户上传的文件名) */
    @Column(name = "invoice_file_name", length = 255)
    private String invoiceFileName;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;
}
