package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.restaurant.RestaurantDashboardController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Locks the R6 V1 RBAC fix (R31 6-vulnerable verify, 2026-05-13): the restaurant
 * dashboard summary aggregate must be gated to roles holding price/finance access.
 *
 * <p>Background (R31 prod sweep §V1, doc 2026-05-12-r31-6-vulnerable-prod-verify.md):
 * {@code GET /restaurant-dashboard/summary} emits {@code thisMonthWastageCost}
 * (BigDecimal aggregate over {@code WastageRecord.estimatedCost @PriceSensitive}).
 * Hand-built {@code Map<String,Object>} bypasses field-level price strip; the
 * value happened to be 0 on F001 May data but would leak any non-zero aggregate.
 * Warehouse_mgr1 (no finance / no procurement:price:view) saw the field on prod.
 *
 * <p>The reflective check is a regression guard: removing or weakening the
 * annotation re-opens the leak.
 *
 * @see com.cretas.aims.security.SmartBIDashboardExecutiveRbacTest reference pattern
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md">R31 audit</a>
 */
@DisplayName("R6 V1 — RestaurantDashboardController.summary gated by price/finance")
class R6V1RestaurantDashboardRbacTest {

    @Test
    @DisplayName("summary declares @RequirePermission with price:view OR finance:read")
    void summary_isAnnotatedWithPriceOrFinance() throws Exception {
        Method method = RestaurantDashboardController.class
                .getDeclaredMethod("summary", String.class);

        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on summary — see R31 audit "
                        + "(docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md). "
                        + "Removing this gate re-opens warehouse_mgr1 wastage-cost leak.");

        var values = Arrays.asList(anno.value());
        assertTrue(values.contains("procurement:price:view"),
                "summary must include procurement:price:view — curated whitelist excludes warehouse_manager");
        assertTrue(values.contains("finance:read"),
                "summary must include finance:read — restaurant_manager / dispatcher / sales need access");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — any of the listed permissions admits");
    }
}
