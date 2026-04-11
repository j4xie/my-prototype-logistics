package com.cretas.aims.dto.python;

import lombok.Builder;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

/**
 * Restaurant-specific section request. Thin wrapper over
 * {@link PythonSectionRequest} providing a builder with default
 * {@code sub_sector=火锅} and a {@link #toGeneric()} converter.
 *
 * <p>Use {@code PythonSmartBIClient.callRestaurantSection()} for
 * restaurant calls; the generic {@code callSection("restaurant", ...)}
 * is also valid and produces the exact same HTTP request.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-04-10
 */
@Data
@Builder
public class PythonRestaurantSectionRequest {

    private String factoryId;

    private String uploadId;

    @Builder.Default
    private String subSector = "火锅";

    private String storeId;

    private String storeName;

    @Builder.Default
    private String period = "current";

    @Builder.Default
    private Map<String, Object> params = new HashMap<>();

    /**
     * Convert to the domain-agnostic request used by
     * {@code PythonSmartBIClient.callSection()}.
     */
    public PythonSectionRequest toGeneric() {
        return PythonSectionRequest.builder()
                .factoryId(factoryId)
                .uploadId(uploadId)
                .subSector(subSector)
                .storeId(storeId)
                .storeName(storeName)
                .period(period)
                .params(params != null ? params : new HashMap<>())
                .build();
    }
}
