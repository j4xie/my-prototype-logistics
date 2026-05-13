package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.MaterialConsumptionController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Locks the R6 V3 RBAC fix (R31 6-vulnerable verify, 2026-05-13): the material
 * consumption controller is gated class-wide by procurement:price:view.
 *
 * <p>Background (R31 prod sweep §V3): warehouse_mgr1 saw {@code unitPrice=¥45},
 * {@code totalCost=¥210,179} (stats), {@code totalCost=¥4,000} (batch cost),
 * full per-material cost array on {@code /processing/material-consumptions/*}.
 * The {@code enrichConsumptionWithMaps} helper line 414 emits unitPrice/totalCost
 * Map values bypassing field-level @PriceSensitive on the entity.
 *
 * <p>Gate uses {@code procurement:price:view} curated whitelist (PRICE_VIEW_ROLES)
 * rather than audit-suggested {@code production:read} — the latter would unblock
 * warehouse_manager (has production:read per PERMISSION_MATRIX line 167).
 *
 * @see com.cretas.aims.security.SmartBIDashboardExecutiveRbacTest reference pattern
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md">R31 audit</a>
 */
@DisplayName("R6 V3 — MaterialConsumptionController class-level gated by price:view")
class R6V3MaterialConsumptionRbacTest {

    private static final String PRICE_VIEW = "procurement:price:view";

    @Test
    @DisplayName("MaterialConsumptionController class declares @RequirePermission(procurement:price:view)")
    void materialConsumptionController_isAnnotatedClassLevel() {
        RequirePermission anno = MaterialConsumptionController.class.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present at class level — see R31 audit "
                        + "(docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md). "
                        + "Removing the gate re-opens 4 confirmed warehouse_mgr1 cost leaks.");

        assertArrayEquals(new String[]{PRICE_VIEW}, anno.value(),
                "MaterialConsumptionController must require exactly [procurement:price:view] — "
                        + "the curated whitelist is the only gate that excludes warehouse_manager "
                        + "(who has production:read but no price view).");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }

    /**
     * Verifies each leaking read endpoint inherits the class-level gate (no
     * method-level override that omits price:view). Mirrors PermissionInterceptor
     * line 56-60 resolution.
     */
    @Test
    @DisplayName("Each confirmed-leak consumption endpoint inherits class-level gate")
    void leakingEndpoints_inheritClassLevelGate() throws Exception {
        List<Method> leakingMethods = List.of(
                MaterialConsumptionController.class.getDeclaredMethod(
                        "getConsumptionStats", String.class, Long.class,
                        java.time.LocalDate.class, java.time.LocalDate.class,
                        String.class /* Authorization */),
                MaterialConsumptionController.class.getDeclaredMethod(
                        "getConsumptionById", String.class, Integer.class,
                        String.class /* Authorization */),
                MaterialConsumptionController.class.getDeclaredMethod(
                        "getBatchConsumptionCost", String.class, Long.class,
                        String.class /* Authorization */),
                MaterialConsumptionController.class.getDeclaredMethod(
                        "getBatchConsumptionSummary", String.class, Long.class)
        );

        for (Method m : leakingMethods) {
            RequirePermission methodAnno = m.getAnnotation(RequirePermission.class);
            if (methodAnno != null) {
                var values = Arrays.asList(methodAnno.value());
                assertTrue(values.contains(PRICE_VIEW),
                        m.getName() + " has method-level @RequirePermission that omits "
                                + "procurement:price:view — overrides class gate. Re-opens R31 §V3 leak.");
            }
        }
    }
}
