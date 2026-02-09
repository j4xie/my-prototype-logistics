package com.cretas.aims.entity.smartbi.enums;

/**
 * SmartBI billing modes
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum BillingMode {
    /**
     * Daily quota based billing
     */
    QUOTA,

    /**
     * Pay per query billing
     */
    PAY_AS_YOU_GO,

    /**
     * Unlimited usage (enterprise plan)
     */
    UNLIMITED
}
