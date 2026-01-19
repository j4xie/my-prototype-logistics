package com.cretas.aims.entity.smartbi.enums;

/**
 * Analysis config type enumeration for SmartBI
 * Defines different types of analysis configurations
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum AnalysisConfigType {
    /**
     * KPI metrics configuration
     * Defines key performance indicators and their thresholds
     */
    KPI,

    /**
     * Chart configuration
     * Defines visualization settings and chart types
     */
    CHART,

    /**
     * Ranking configuration
     * Defines top-N analysis and comparison settings
     */
    RANKING,

    /**
     * Insight configuration
     * Defines AI-generated insight rules and patterns
     */
    INSIGHT
}
