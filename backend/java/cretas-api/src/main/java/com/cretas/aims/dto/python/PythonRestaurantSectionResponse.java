package com.cretas.aims.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Restaurant-specific section response. Same shape as the generic
 * {@link PythonSectionResponse}; kept as a distinct type for clearer
 * Java call sites and room for future per-domain typing (e.g. a typed
 * {@code data} sub-DTO per section).
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-04-10
 */
@Data
@NoArgsConstructor
public class PythonRestaurantSectionResponse {

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

    /**
     * Shallow-copy a generic {@link PythonSectionResponse} into the
     * restaurant-specific envelope. Used by
     * {@code PythonSmartBIClient.callRestaurantSection()} to delegate to
     * {@code callSection("restaurant", ...)} then adapt the result.
     */
    public static PythonRestaurantSectionResponse fromGeneric(PythonSectionResponse generic) {
        if (generic == null) {
            return null;
        }
        PythonRestaurantSectionResponse resp = new PythonRestaurantSectionResponse();
        resp.success = generic.isSuccess();
        resp.sectionName = generic.getSectionName();
        resp.status = generic.getStatus();
        resp.data = generic.getData();
        resp.warnings = generic.getWarnings();
        resp.cacheKey = generic.getCacheKey();
        resp.computedAtMs = generic.getComputedAtMs();
        resp.fromCache = generic.getFromCache();
        return resp;
    }
}
