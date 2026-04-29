package com.cretas.aims.dto.smartbi;

import lombok.Data;

import java.util.Map;

/**
 * Confirm mapping request DTO for field mapping confirmation.
 * AUDIT-086: Extracted from SmartBIController inner class.
 */
@Data
public class ConfirmMappingRequest {
    /**
     * Bug #43 fix (2026-04-18): uploadId returned from /upload-and-analyze.
     * When set, confirmAndPersist skips re-persistence (rows already in DB with
     * full fidelity) and only updates smart_bi_pg_field_definitions with user's
     * confirmed mappings. Avoids the 50-row previewData truncation bug where
     * frontend sends back trimmed preview instead of full data.
     */
    private Long uploadId;

    /** Original parse response (from /upload or /upload-and-analyze) */
    private ExcelParseResponse parseResponse;

    /** User confirmed field mappings. Key: Excel column name, Value: standard field name */
    private Map<String, String> confirmedMappings;

    /** Data type: sales/finance/inventory/production/quality/procurement */
    private String dataType;

    /** Whether to save raw data (default true) */
    private Boolean saveRawData;

    /** Whether to generate chart (default true) */
    private Boolean generateChart;

    /** Chart template ID (optional, auto-recommend if not specified) */
    private Long chartTemplateId;

    /** Additional options */
    private Map<String, Object> options;
}
