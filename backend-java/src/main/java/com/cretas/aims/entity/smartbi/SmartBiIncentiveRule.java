package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * SmartBI Incentive Rule Entity - Dynamic incentive rule configuration
 *
 * <p>Supports multi-level incentive rules with configurable thresholds and rewards:
 * <ul>
 *   <li>Rule-based matching (e.g., SALES_TARGET, QUALITY_SCORE)</li>
 *   <li>Level system (Bronze, Silver, Gold, Diamond)</li>
 *   <li>Percentage-based or fixed-amount rewards</li>
 *   <li>Factory-specific configurations</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "smart_bi_incentive_rules",
       indexes = {
           @Index(name = "idx_rule_code", columnList = "rule_code"),
           @Index(name = "idx_factory_id", columnList = "factory_id"),
           @Index(name = "idx_rule_active", columnList = "rule_code, is_active")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiIncentiveRule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Rule code (e.g., SALES_TARGET, QUALITY_SCORE, ATTENDANCE_RATE)
     */
    @Column(name = "rule_code", nullable = false, length = 64)
    private String ruleCode;

    /**
     * Rule name for display
     */
    @Column(name = "rule_name", nullable = false, length = 128)
    private String ruleName;

    /**
     * Level name (e.g., Bronze, Silver, Gold, Diamond)
     */
    @Column(name = "level_name", nullable = false, length = 32)
    private String levelName;

    /**
     * Minimum value (inclusive) for this level
     */
    @Column(name = "min_value", nullable = false, precision = 15, scale = 4)
    private BigDecimal minValue;

    /**
     * Maximum value (exclusive) for this level
     * NULL means no upper limit
     */
    @Column(name = "max_value", precision = 15, scale = 4)
    private BigDecimal maxValue;

    /**
     * Reward rate (percentage of base amount)
     * e.g., 0.01 = 1%, 0.05 = 5%
     */
    @Column(name = "reward_rate", precision = 5, scale = 4)
    private BigDecimal rewardRate;

    /**
     * Fixed reward amount (used when rate is not applicable)
     */
    @Column(name = "reward_amount", precision = 15, scale = 2)
    private BigDecimal rewardAmount;

    /**
     * Rule description
     */
    @Column(name = "description", length = 255)
    private String description;

    /**
     * Factory ID (NULL means global rule)
     */
    @Column(name = "factory_id", length = 32)
    private String factoryId;

    /**
     * Whether this rule is active
     */
    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    /**
     * Sort order for display
     */
    @Builder.Default
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /**
     * Check if a value matches this rule's range
     * @param value The value to check
     * @return true if value is within [minValue, maxValue)
     */
    @Transient
    public boolean matches(BigDecimal value) {
        if (value == null || minValue == null) {
            return false;
        }

        boolean aboveMin = value.compareTo(minValue) >= 0;
        boolean belowMax = maxValue == null || value.compareTo(maxValue) < 0;

        return aboveMin && belowMax;
    }

    /**
     * Calculate reward based on base amount
     * @param baseAmount The base amount for calculation
     * @return Calculated reward amount
     */
    @Transient
    public BigDecimal calculateReward(BigDecimal baseAmount) {
        if (rewardAmount != null && rewardAmount.compareTo(BigDecimal.ZERO) > 0) {
            return rewardAmount;
        }

        if (rewardRate != null && baseAmount != null) {
            return baseAmount.multiply(rewardRate);
        }

        return BigDecimal.ZERO;
    }

    /**
     * Get display text for reward
     * @return Human-readable reward description
     */
    @Transient
    public String getRewardDisplay() {
        if (rewardAmount != null && rewardAmount.compareTo(BigDecimal.ZERO) > 0) {
            return String.format("%.2f 元", rewardAmount);
        }

        if (rewardRate != null) {
            return String.format("%.2f%%", rewardRate.multiply(new BigDecimal("100")));
        }

        return "-";
    }

    /**
     * Get display text for value range
     * @return Human-readable range description
     */
    @Transient
    public String getRangeDisplay() {
        if (maxValue == null) {
            return String.format(">= %.2f", minValue);
        }
        return String.format("[%.2f, %.2f)", minValue, maxValue);
    }
}
