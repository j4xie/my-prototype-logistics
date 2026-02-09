package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * SmartBI Department Data Entity - Department performance data
 *
 * Contains:
 * - Department metadata
 * - Headcount and manager info
 * - Sales and cost metrics
 * - Per capita calculations
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_department_data",
       indexes = {
           @Index(name = "idx_factory_date", columnList = "factory_id, record_date"),
           @Index(name = "idx_department", columnList = "factory_id, department")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiDepartmentData extends BaseEntity {

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
     * Department name
     */
    @Column(name = "department", nullable = false, length = 100)
    private String department;

    /**
     * Department ID
     */
    @Column(name = "department_id", length = 100)
    private String departmentId;

    /**
     * Manager name
     */
    @Column(name = "manager_name", length = 100)
    private String managerName;

    /**
     * Number of employees
     */
    @Builder.Default
    @Column(name = "headcount")
    private Integer headcount = 0;

    /**
     * Department sales
     */
    @Builder.Default
    @Column(name = "sales_amount", precision = 15, scale = 2)
    private BigDecimal salesAmount = BigDecimal.ZERO;

    /**
     * Department target
     */
    @Builder.Default
    @Column(name = "sales_target", precision = 15, scale = 2)
    private BigDecimal salesTarget = BigDecimal.ZERO;

    /**
     * Department cost
     */
    @Builder.Default
    @Column(name = "cost_amount", precision = 15, scale = 2)
    private BigDecimal costAmount = BigDecimal.ZERO;

    /**
     * Per capita sales
     */
    @Builder.Default
    @Column(name = "per_capita_sales", precision = 15, scale = 2)
    private BigDecimal perCapitaSales = BigDecimal.ZERO;

    /**
     * Per capita cost
     */
    @Builder.Default
    @Column(name = "per_capita_cost", precision = 15, scale = 2)
    private BigDecimal perCapitaCost = BigDecimal.ZERO;

    /**
     * Calculate target achievement rate
     */
    @Transient
    public BigDecimal getTargetAchievementRate() {
        if (salesTarget == null || salesTarget.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return salesAmount.divide(salesTarget, 4, java.math.RoundingMode.HALF_UP);
    }

    /**
     * Calculate profit (sales - cost)
     */
    @Transient
    public BigDecimal getProfit() {
        return salesAmount.subtract(costAmount);
    }

    /**
     * Calculate per capita profit
     */
    @Transient
    public BigDecimal getPerCapitaProfit() {
        if (headcount == null || headcount == 0) {
            return BigDecimal.ZERO;
        }
        return getProfit().divide(BigDecimal.valueOf(headcount), 2, java.math.RoundingMode.HALF_UP);
    }
}
