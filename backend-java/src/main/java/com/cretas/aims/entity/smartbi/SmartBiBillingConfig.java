package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.BillingMode;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * SmartBI Billing Config Entity - Factory billing configuration
 *
 * Billing modes:
 * - QUOTA: Daily free quota with overage charges
 * - PAY_AS_YOU_GO: Pay per query
 * - UNLIMITED: Flat monthly fee, unlimited queries
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_billing_config",
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_factory_id", columnNames = {"factory_id"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiBillingConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Billing mode
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "billing_mode", length = 20)
    private BillingMode billingMode = BillingMode.QUOTA;

    /**
     * Daily free quota for QUOTA mode
     */
    @Builder.Default
    @Column(name = "daily_quota")
    private Integer dailyQuota = 50;

    /**
     * Price per query for PAY_AS_YOU_GO (CNY)
     */
    @Builder.Default
    @Column(name = "price_per_query", precision = 10, scale = 4)
    private BigDecimal pricePerQuery = new BigDecimal("0.10");

    /**
     * Monthly spending limit (CNY)
     */
    @Builder.Default
    @Column(name = "monthly_limit", precision = 15, scale = 2)
    private BigDecimal monthlyLimit = new BigDecimal("1000");

    /**
     * Alert when quota reaches this percentage
     */
    @Builder.Default
    @Column(name = "alert_threshold")
    private Integer alertThreshold = 80;

    /**
     * Whether billing is active
     */
    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    /**
     * Check if quota mode is enabled
     */
    @Transient
    public boolean isQuotaMode() {
        return BillingMode.QUOTA.equals(billingMode);
    }

    /**
     * Check if pay-as-you-go mode is enabled
     */
    @Transient
    public boolean isPayAsYouGoMode() {
        return BillingMode.PAY_AS_YOU_GO.equals(billingMode);
    }

    /**
     * Check if unlimited mode is enabled
     */
    @Transient
    public boolean isUnlimitedMode() {
        return BillingMode.UNLIMITED.equals(billingMode);
    }

    /**
     * Calculate estimated monthly cost based on usage
     */
    @Transient
    public BigDecimal estimateMonthlyCost(int avgDailyQueries) {
        if (isUnlimitedMode()) {
            return monthlyLimit; // Fixed monthly fee
        }
        if (isPayAsYouGoMode()) {
            return pricePerQuery.multiply(BigDecimal.valueOf(avgDailyQueries * 30L));
        }
        // QUOTA mode: only charge for overage
        int overagePerDay = Math.max(0, avgDailyQueries - dailyQuota);
        return pricePerQuery.multiply(BigDecimal.valueOf(overagePerDay * 30L));
    }
}
