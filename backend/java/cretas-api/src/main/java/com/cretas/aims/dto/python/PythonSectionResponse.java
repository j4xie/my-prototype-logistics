package com.cretas.aims.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Generic response envelope for {@code POST /api/smartbi/{domain}/sections/{section_name}}.
 *
 * <p>Python router returns camelCase keys: {@code sectionName, cacheKey,
 * computedAtMs, fromCache}. See {@code compute_section} in
 * {@code smartbi/api/restaurant_sections.py}.
 *
 * <p>{@code status} is one of {@code "ok" | "skipped" | "failed"} (mirrors
 * {@code SectionStatus} in the Python side).
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-04-10
 */
@Data
@NoArgsConstructor
public class PythonSectionResponse {

    /** True iff {@code status == "ok"}. */
    private boolean success;

    @JsonProperty("sectionName")
    private String sectionName;

    /** One of {@code "ok" | "skipped" | "failed"}. */
    private String status;

    private Map<String, Object> data;

    private List<String> warnings;

    @JsonProperty("cacheKey")
    private String cacheKey;

    @JsonProperty("computedAtMs")
    private Long computedAtMs;

    @JsonProperty("fromCache")
    private Boolean fromCache;
}
