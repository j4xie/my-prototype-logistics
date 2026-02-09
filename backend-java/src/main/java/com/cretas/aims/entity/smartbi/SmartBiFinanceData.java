package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.RecordType;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * SmartBI Finance Data Entity - Financial data parsed from Excel
 *
 * Contains:
 * - Cost records (material, labor, overhead)
 * - Accounts Receivable (AR)
 * - Accounts Payable (AP)
 * - Budget vs Actual
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_finance_data",
       indexes = {
           @Index(name = "idx_factory_date", columnList = "factory_id, record_date"),
           @Index(name = "idx_record_type", columnList = "factory_id, record_type"),
           @Index(name = "idx_department", columnList = "factory_id, department"),
           @Index(name = "idx_aging", columnList = "factory_id, aging_days")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiFinanceData extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Reference to excel upload record
     */
    @Column(name = "upload_id")
    private Long uploadId;

    /**
     * Record date
     */
    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    /**
     * Record type: COST, AR, AP, BUDGET
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "record_type", nullable = false, length = 20)
    private RecordType recordType;

    /**
     * Department name
     */
    @Column(name = "department", length = 100)
    private String department;

    /**
     * Cost/Budget category
     */
    @Column(name = "category", length = 100)
    private String category;

    /**
     * Customer name (for AR)
     */
    @Column(name = "customer_name", length = 200)
    private String customerName;

    /**
     * Supplier name (for AP)
     */
    @Column(name = "supplier_name", length = 200)
    private String supplierName;

    /**
     * Material cost
     */
    @Builder.Default
    @Column(name = "material_cost", precision = 15, scale = 2)
    private BigDecimal materialCost = BigDecimal.ZERO;

    /**
     * Labor cost
     */
    @Builder.Default
    @Column(name = "labor_cost", precision = 15, scale = 2)
    private BigDecimal laborCost = BigDecimal.ZERO;

    /**
     * Overhead cost
     */
    @Builder.Default
    @Column(name = "overhead_cost", precision = 15, scale = 2)
    private BigDecimal overheadCost = BigDecimal.ZERO;

    /**
     * Total cost
     */
    @Builder.Default
    @Column(name = "total_cost", precision = 15, scale = 2)
    private BigDecimal totalCost = BigDecimal.ZERO;

    /**
     * Accounts Receivable amount
     */
    @Builder.Default
    @Column(name = "receivable_amount", precision = 15, scale = 2)
    private BigDecimal receivableAmount = BigDecimal.ZERO;

    /**
     * Collection amount
     */
    @Builder.Default
    @Column(name = "collection_amount", precision = 15, scale = 2)
    private BigDecimal collectionAmount = BigDecimal.ZERO;

    /**
     * Aging days
     */
    @Builder.Default
    @Column(name = "aging_days")
    private Integer agingDays = 0;

    /**
     * Accounts Payable amount
     */
    @Builder.Default
    @Column(name = "payable_amount", precision = 15, scale = 2)
    private BigDecimal payableAmount = BigDecimal.ZERO;

    /**
     * Payment amount
     */
    @Builder.Default
    @Column(name = "payment_amount", precision = 15, scale = 2)
    private BigDecimal paymentAmount = BigDecimal.ZERO;

    /**
     * Budget amount
     */
    @Builder.Default
    @Column(name = "budget_amount", precision = 15, scale = 2)
    private BigDecimal budgetAmount = BigDecimal.ZERO;

    /**
     * Actual amount
     */
    @Builder.Default
    @Column(name = "actual_amount", precision = 15, scale = 2)
    private BigDecimal actualAmount = BigDecimal.ZERO;

    /**
     * Variance amount
     */
    @Builder.Default
    @Column(name = "variance_amount", precision = 15, scale = 2)
    private BigDecimal varianceAmount = BigDecimal.ZERO;

    /**
     * Due date
     */
    @Column(name = "due_date")
    private LocalDate dueDate;

    /**
     * Check if AR/AP is overdue
     */
    @Transient
    public boolean isOverdue() {
        return dueDate != null && LocalDate.now().isAfter(dueDate);
    }

    /**
     * Get budget variance percentage
     */
    @Transient
    public BigDecimal getBudgetVarianceRate() {
        if (budgetAmount == null || budgetAmount.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return varianceAmount.divide(budgetAmount, 4, java.math.RoundingMode.HALF_UP);
    }
}
