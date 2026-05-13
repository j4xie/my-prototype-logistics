package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.inventory.PriceListController;
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
 * Locks the R6 V5 RBAC fix (R31 6-vulnerable verify, 2026-05-13): the price-list
 * controller is gated class-wide by procurement:price:view.
 *
 * <p>Background (R31 prod sweep §V5): warehouse_mgr1 saw the full PURCHASE
 * price book on {@code GET /price-lists/PL-F001-PURCHASE-2025} — 15 items each
 * with {@code standardPrice / minPrice / maxPrice} (sea bream, yellow croaker,
 * abalone, etc). Same on the SELLING price list. The PriceListItem entity does
 * not (yet) carry @PriceSensitive on these fields; the route gate is the only
 * line of defense.
 *
 * <p>Gate uses {@code procurement:price:view} curated whitelist rather than
 * audit-suggested {@code sales:read} — warehouse_manager has sales:read per
 * PERMISSION_MATRIX line 172.
 *
 * <p>The pre-existing method-level @RequirePermission on POST/DELETE writes
 * (sales:read_write, finance:read_write) overrides per
 * {@code PermissionInterceptor.preHandle} line 60 — write paths keep their
 * tighter gate; read paths inherit the class-level price:view.
 *
 * @see com.cretas.aims.security.SmartBIDashboardExecutiveRbacTest reference pattern
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md">R31 audit</a>
 */
@DisplayName("R6 V5 — PriceListController class-level gated by price:view")
class R6V5PriceListRbacTest {

    private static final String PRICE_VIEW = "procurement:price:view";

    @Test
    @DisplayName("PriceListController class declares @RequirePermission(procurement:price:view)")
    void priceListController_isAnnotatedClassLevel() {
        RequirePermission anno = PriceListController.class.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present at class level — see R31 audit "
                        + "(docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md). "
                        + "Removing the gate re-opens warehouse_mgr1 full-price-book leak.");

        assertArrayEquals(new String[]{PRICE_VIEW}, anno.value(),
                "PriceListController must require exactly [procurement:price:view] — "
                        + "the curated whitelist is the only gate that excludes warehouse_manager "
                        + "(who has sales:read but no price view).");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }

    /**
     * Read endpoints have no method-level @RequirePermission, so they inherit
     * the class-level price:view gate. Write endpoints (POST/DELETE) keep their
     * pre-existing tighter gate (sales:read_write OR finance:read_write) — this
     * test verifies the tighter gate also blocks warehouse_manager.
     */
    @Test
    @DisplayName("Read endpoints inherit class-level gate; write methods keep tighter sales/finance gate")
    void readsInheritClassWritesKeepTighterGate() throws Exception {
        // Reads: no method-level annotation → class-level applies
        List<Method> readMethods = List.of(
                PriceListController.class.getDeclaredMethod(
                        "listPriceLists", String.class, int.class, int.class),
                PriceListController.class.getDeclaredMethod(
                        "getEffective", String.class),
                PriceListController.class.getDeclaredMethod(
                        "getPriceList", String.class, String.class),
                PriceListController.class.getDeclaredMethod(
                        "lookupPrice", String.class, String.class, String.class)
        );
        for (Method m : readMethods) {
            RequirePermission methodAnno = m.getAnnotation(RequirePermission.class);
            // Either no method annotation (inherits class) OR contains price:view explicitly
            if (methodAnno != null) {
                assertTrue(Arrays.asList(methodAnno.value()).contains(PRICE_VIEW),
                        m.getName() + " has method-level @RequirePermission omitting price:view "
                                + "— overrides class gate. Re-opens R31 §V5 price-book leak.");
            }
        }

        // Writes: pre-existing method-level annotation (sales:read_write OR finance:read_write)
        // overrides class. Verify warehouse_manager would still fail (only has sales:read).
        Method create = PriceListController.class.getDeclaredMethod(
                "createPriceList", String.class, String.class,
                com.cretas.aims.dto.inventory.CreatePriceListRequest.class);
        RequirePermission createAnno = create.getAnnotation(RequirePermission.class);
        assertNotNull(createAnno, "createPriceList must keep its method-level write gate");
        var createPerms = Arrays.asList(createAnno.value());
        assertTrue(createPerms.contains("sales:read_write") || createPerms.contains("finance:read_write"),
                "createPriceList write gate must include sales:read_write OR finance:read_write");
    }
}
