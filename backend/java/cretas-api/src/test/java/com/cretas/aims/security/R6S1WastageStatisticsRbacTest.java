package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.restaurant.WastageRecordController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Locks the R6 sibling sweep (Rule 8) finding: WastageRecordController.statistics
 * was identified as same-cause leak alongside V1-V5 — emits {@code totalCost}
 * from raw query rows (Object[] aggregation) bypassing entity-level @PriceSensitive.
 *
 * <p>Background: pre-existing CRUD endpoints had {@code @RequirePermission(inventory:read_write)}
 * which warehouse_manager passes (has inventory:read_write per PERMISSION_MATRIX
 * line 169). Statistics had NO RBAC gate. Adding price/finance gate to align
 * with V1 Restaurant dashboard pattern.
 *
 * @see R6V1RestaurantDashboardRbacTest sibling pattern
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md">R31 audit</a>
 */
@DisplayName("R6 sibling — WastageRecordController.statistics gated by price/finance")
class R6S1WastageStatisticsRbacTest {

    @Test
    @DisplayName("statistics declares @RequirePermission with price:view OR finance:read")
    void statistics_isAnnotatedWithPriceOrFinance() throws Exception {
        Method method = WastageRecordController.class
                .getDeclaredMethod("statistics", String.class, LocalDate.class, LocalDate.class);

        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on statistics — see R31 sibling sweep. "
                        + "Removing this gate re-opens warehouse_mgr1 wastage-cost leak via raw-row aggregation.");

        var values = Arrays.asList(anno.value());
        assertTrue(values.contains("procurement:price:view"),
                "statistics must include procurement:price:view — curated whitelist excludes warehouse_manager");
        assertTrue(values.contains("finance:read"),
                "statistics must include finance:read — restaurant_manager / dispatcher / finance need cost summaries");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — any of the listed permissions admits");
    }
}
