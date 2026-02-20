package com.cretas.aims.entity.smartbi.enums;

/**
 * Metric type enumeration for SmartBI field definitions
 * Defines how a field is used in analytics
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum MetricType {
    /**
     * Quantitative measure (can be aggregated)
     * Examples: sales amount, quantity, revenue
     */
    MEASURE,

    /**
     * Categorical dimension (used for grouping)
     * Examples: product category, region, customer type
     */
    DIMENSION,

    /**
     * Time dimension (used for time series analysis)
     * Examples: order date, created_at, month
     */
    TIME
}
