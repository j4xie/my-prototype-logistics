package com.cretas.aims.entity.smartbi.enums;

/**
 * Data source type enumeration for SmartBI
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum DatasourceType {
    /**
     * Excel file upload
     */
    EXCEL,

    /**
     * External API integration
     */
    API,

    /**
     * Database connection
     */
    DB,

    /**
     * Catch-all custom datasource (Apr 16 2026)
     */
    CUSTOM;

    /**
     * Map frontend-friendly names (DATABASE) to backend enum (DB).
     * Accepts: EXCEL, API, DB, DATABASE, CUSTOM — case-insensitive.
     */
    public static DatasourceType fromClientType(String raw) {
        if (raw == null) return null;
        String v = raw.trim().toUpperCase();
        if ("DATABASE".equals(v)) return DB;
        try { return DatasourceType.valueOf(v); } catch (IllegalArgumentException e) { return CUSTOM; }
    }

    /**
     * Emit frontend-friendly type string (DB → DATABASE).
     */
    public String toClientType() {
        return this == DB ? "DATABASE" : name();
    }
}
