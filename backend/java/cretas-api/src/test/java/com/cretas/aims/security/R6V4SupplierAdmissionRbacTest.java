package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.SupplierAdmissionController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Locks the R6 V4 RBAC fix (R31 6-vulnerable verify, 2026-05-13): the supplier
 * report endpoint is gated by procurement:price:view.
 *
 * <p>Background (R31 prod sweep §V4): warehouse_mgr1 saw
 * {@code data.supplier.currentBalance=¥900} on
 * {@code GET /supplier-admission/report/{supplierId}}. The
 * {@code buildSupplierSummary} helper extracts {@code creditLimit} +
 * {@code currentBalance} from the {@code @PriceSensitive} {@code Supplier}
 * entity into a hand-built Map, bypassing field-level price strip.
 *
 * <p>Gate uses {@code procurement:price:view} curated whitelist rather than
 * audit-suggested {@code procurement:read} — the latter would unblock
 * warehouse_manager (has procurement:read per PERMISSION_MATRIX line 171).
 *
 * @see com.cretas.aims.security.SmartBIDashboardExecutiveRbacTest reference pattern
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md">R31 audit</a>
 */
@DisplayName("R6 V4 — SupplierAdmissionController.getSupplierReport gated by price:view")
class R6V4SupplierAdmissionRbacTest {

    private static final String PRICE_VIEW = "procurement:price:view";

    @Test
    @DisplayName("getSupplierReport declares @RequirePermission(procurement:price:view)")
    void getSupplierReport_isAnnotatedWithPriceView() throws Exception {
        Method method = SupplierAdmissionController.class
                .getDeclaredMethod("getSupplierReport", String.class, String.class);

        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on getSupplierReport — see R31 audit "
                        + "(docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify.md). "
                        + "Removing this gate re-opens warehouse_mgr1 supplier balance leak.");

        assertArrayEquals(new String[]{PRICE_VIEW}, anno.value(),
                "getSupplierReport must require exactly [procurement:price:view] — "
                        + "the curated whitelist is the only gate that excludes warehouse_manager "
                        + "(who has procurement:read but no price view).");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }
}
