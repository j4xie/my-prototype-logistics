package com.cretas.aims.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * ECN impact analysis report (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>Returned by {@code ECNService.calculateImpact(bomRecipeId, changes)} and persisted
 * onto {@code engineering_change_notices.impact_scope} JSONB.
 *
 * <p>Day 4-5 scope: skeleton shape only. Full population (open-order scan, customer
 * notification list) implemented in Day 8-9 when batch operations exercise this path.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EcnImpactReport {

    /** SKUs (product type ids) that this recipe maps to. */
    @Builder.Default
    private List<String> affectedSkus = new ArrayList<>();

    /** Customers with open orders against affected SKUs. */
    @Builder.Default
    private List<String> affectedCustomers = new ArrayList<>();

    /** Open sales orders still using the prior BOM. */
    @Builder.Default
    private int openOrderCount = 0;

    /** Free-form description of open orders (id + status + customer summary). */
    @Builder.Default
    private List<String> openOrderSummary = new ArrayList<>();

    /** Warning text aggregated during impact calc (e.g. "no canonical material for substitute"). */
    @Builder.Default
    private List<String> warnings = new ArrayList<>();
}
