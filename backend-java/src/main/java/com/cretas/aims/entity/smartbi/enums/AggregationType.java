package com.cretas.aims.entity.smartbi.enums;

/**
 * Aggregation type enumeration for SmartBI field definitions
 * Defines how measure fields should be aggregated
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum AggregationType {
    /**
     * Sum aggregation
     */
    SUM,

    /**
     * Average aggregation
     */
    AVG,

    /**
     * Count aggregation
     */
    COUNT,

    /**
     * Count distinct values
     */
    COUNT_DISTINCT,

    /**
     * Minimum value
     */
    MIN,

    /**
     * Maximum value
     */
    MAX,

    /**
     * No aggregation (for dimensions)
     */
    NONE
}
