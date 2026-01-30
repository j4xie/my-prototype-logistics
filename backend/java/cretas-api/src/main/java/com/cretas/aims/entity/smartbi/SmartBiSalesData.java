package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * SmartBI Sales Data Entity - Sales data parsed from Excel
 *
 * Contains:
 * - Sales transaction details
 * - Salesperson and department info
 * - Regional breakdown
 * - Product and customer info
 * - Financial metrics (amount, cost, profit, margin)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_sales_data",
       indexes = {
           @Index(name = "idx_factory_date", columnList = "factory_id, order_date"),
           @Index(name = "idx_salesperson", columnList = "factory_id, salesperson_name"),
           @Index(name = "idx_department", columnList = "factory_id, department"),
           @Index(name = "idx_region", columnList = "factory_id, region"),
           @Index(name = "idx_product", columnList = "factory_id, product_category")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiSalesData extends BaseEntity {

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
     * Order date
     */
    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    /**
     * Salesperson ID
     */
    @Column(name = "salesperson_id", length = 100)
    private String salespersonId;

    /**
     * Salesperson name
     */
    @Column(name = "salesperson_name", length = 100)
    private String salespersonName;

    /**
     * Department name
     */
    @Column(name = "department", length = 100)
    private String department;

    /**
     * Sales region
     */
    @Column(name = "region", length = 100)
    private String region;

    /**
     * Province
     */
    @Column(name = "province", length = 100)
    private String province;

    /**
     * City
     */
    @Column(name = "city", length = 100)
    private String city;

    /**
     * Customer name
     */
    @Column(name = "customer_name", length = 200)
    private String customerName;

    /**
     * Customer type
     */
    @Column(name = "customer_type", length = 100)
    private String customerType;

    /**
     * Product ID
     */
    @Column(name = "product_id", length = 100)
    private String productId;

    /**
     * Product name
     */
    @Column(name = "product_name", length = 200)
    private String productName;

    /**
     * Product category
     */
    @Column(name = "product_category", length = 100)
    private String productCategory;

    /**
     * Quantity sold
     */
    @Builder.Default
    @Column(name = "quantity", precision = 15, scale = 4)
    private BigDecimal quantity = BigDecimal.ZERO;

    /**
     * Sales amount
     */
    @Builder.Default
    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    /**
     * Unit price
     */
    @Builder.Default
    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    /**
     * Cost amount
     */
    @Builder.Default
    @Column(name = "cost", precision = 15, scale = 2)
    private BigDecimal cost = BigDecimal.ZERO;

    /**
     * Profit amount
     */
    @Builder.Default
    @Column(name = "profit", precision = 15, scale = 2)
    private BigDecimal profit = BigDecimal.ZERO;

    /**
     * Gross margin rate
     */
    @Builder.Default
    @Column(name = "gross_margin", precision = 10, scale = 4)
    private BigDecimal grossMargin = BigDecimal.ZERO;

    /**
     * Monthly sales target
     */
    @Builder.Default
    @Column(name = "monthly_target", precision = 15, scale = 2)
    private BigDecimal monthlyTarget = BigDecimal.ZERO;

    /**
     * Calculate target achievement rate
     */
    @Transient
    public BigDecimal getTargetAchievementRate() {
        if (monthlyTarget == null || monthlyTarget.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return amount.divide(monthlyTarget, 4, java.math.RoundingMode.HALF_UP);
    }
}
