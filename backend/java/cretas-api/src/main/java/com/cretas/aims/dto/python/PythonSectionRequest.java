package com.cretas.aims.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * Generic request body for {@code POST /api/smartbi/{domain}/sections/{section_name}}.
 *
 * <p>Snake_case JSON field names match the Python FastAPI Pydantic model
 * (see {@code SectionRequestBody} in {@code smartbi/api/restaurant_sections.py}).
 * The DTO is intentionally domain-agnostic so {@link com.cretas.aims.client.PythonSmartBIClient#callSection}
 * can be reused from any business-domain Tool (restaurant, retail, beauty, ...).
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-04-10
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonSectionRequest {

    /** Factory identifier (required). */
    @JsonProperty("factory_id")
    private String factoryId;

    /** Upload identifier (optional — some sections do not need one). */
    @JsonProperty("upload_id")
    private String uploadId;

    /** Sub-sector tag, default {@code 火锅}. */
    @JsonProperty("sub_sector")
    @Builder.Default
    private String subSector = "火锅";

    /** Store identifier (optional, for multi-store tenants). */
    @JsonProperty("store_id")
    private String storeId;

    /** Store display name (optional). */
    @JsonProperty("store_name")
    private String storeName;

    /** Period label, default {@code current}. */
    @Builder.Default
    private String period = "current";

    /** Section-specific inputs (POS DataFrame, financial data, ...). */
    @Builder.Default
    private Map<String, Object> params = new HashMap<>();
}
