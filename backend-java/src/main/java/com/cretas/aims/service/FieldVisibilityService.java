package com.cretas.aims.service;

import java.util.List;
import java.util.Map;

public interface FieldVisibilityService {
    /**
     * Get hidden fields for each entity type based on client survey responses.
     * Returns map: entityType -> list of hidden field names
     */
    Map<String, List<String>> getHiddenFields(String factoryId);

    /**
     * Check if a specific field is visible for an entity type in a factory.
     */
    boolean isFieldVisible(String factoryId, String entityType, String fieldKey);

    /**
     * Recompute and cache field visibility for a factory.
     */
    void recomputeVisibility(String factoryId);

    /**
     * Get null rate percentages for each field in the given entity type's table.
     * Returns map: fieldName -> nullPercentage (0.0 - 100.0)
     */
    Map<String, Double> getFieldNullCounts(String factoryId, String entityType);
}
