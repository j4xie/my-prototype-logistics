package com.cretas.aims.entity.smartbi.enums;

/**
 * SmartBI action types for usage tracking and billing
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum ActionType {
    /**
     * Excel file upload
     */
    UPLOAD,

    /**
     * Dashboard view
     */
    DASHBOARD,

    /**
     * Natural language query
     */
    QUERY,

    /**
     * Data drilldown operation
     */
    DRILLDOWN,

    /**
     * Data export
     */
    EXPORT
}
