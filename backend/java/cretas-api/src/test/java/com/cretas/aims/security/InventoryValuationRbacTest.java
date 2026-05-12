package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.MaterialBatchController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Locks the E5 §5.2 RBAC decision (2026-05-12): the inventory-valuation aggregate
 * endpoint must be gated by {@code procurement:price:view} permission.
 *
 * <p>Background: the endpoint returns a naked {@code BigDecimal} (factory inventory
 * value SUM). {@code PriceFieldResponseAdvice} field-level strip cannot mask a
 * scalar response body. Per the precedent of
 * {@code EquipmentController.calculateDepreciatedValue}, naked-Decimal financial
 * endpoints are protected by {@link RequirePermission} access gate rather than
 * by {@link PriceSensitive} field strip.
 *
 * <p>This reflective check is a regression guard: if anyone removes or weakens
 * the annotation, this test fails fast and points to the decision doc.
 *
 * <p>Whitelist semantics (which roles have / lack {@code procurement:price:view})
 * are already covered by {@link PriceViewPermissionTest}; AOP-level enforcement
 * is exercised by the wider R2 RBAC sweep evidence. Here we only assert that the
 * annotation itself is in place with the expected permission code.
 *
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-e5-valuation-rbac-decision.md">Decision doc</a>
 */
@DisplayName("E5 §5.2 — getInventoryValuation gated by procurement:price:view")
class InventoryValuationRbacTest {

    private static final String PRICE_VIEW = "procurement:price:view";

    @Test
    @DisplayName("MaterialBatchController.getInventoryValuation declares @RequirePermission(procurement:price:view)")
    void getInventoryValuation_isAnnotatedWithPriceViewPermission() throws Exception {
        Method method = MaterialBatchController.class
                .getDeclaredMethod("getInventoryValuation", String.class);

        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on getInventoryValuation — "
                        + "see docs/qa-audits/2026-05-12-e5-valuation-rbac-decision.md");

        assertArrayEquals(new String[]{PRICE_VIEW}, anno.value(),
                "getInventoryValuation must require exactly [procurement:price:view] — "
                        + "weakening this gate re-opens the C5 §5.2 leak");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }
}
