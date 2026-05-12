package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.SmartBIDashboardController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Locks the PR #470 R3.1 RBAC decision (2026-05-12) for the only SmartBI
 * analysis endpoint that still lives in Java: {@code /dashboard/executive}.
 *
 * <p>Background: PR #470 caught {@code warehouse_mgr1} (role
 * {@code warehouse_manager}, no {@code analytics} permission) reading regional
 * sales rankings from {@code GET /dashboard/executive} on prod 139:8086.
 * The audit's same-cause sweep also caught 6 analysis endpoints that had
 * already moved to Python in T6.5 Phase C (gated separately by the Python
 * {@code require_analytics_read} dependency); this endpoint stayed in Java
 * because it's a unified dashboard composing the migrated services.
 *
 * <p>The reflective check is a regression guard: if anyone removes or weakens
 * the annotation, this test fails fast and points to PR #470 audit §4 / §5.
 *
 * <p>Whitelist semantics (which roles do/don't have {@code analytics:read})
 * live in {@code PermissionServiceImpl.PERMISSION_MATRIX}. AOP-level
 * enforcement is covered by the wider RBAC sweep evidence (PR #470 + R3
 * follow-ups).
 *
 * @see <a href="../../../../../../../docs/qa-audits/2026-05-12-r3-finance-l4-deep-results.md">PR #470 audit doc</a>
 * @see com.cretas.aims.security.InventoryValuationRbacTest reference pattern
 */
@DisplayName("PR #470 — /dashboard/executive gated by analytics:read")
class SmartBIDashboardExecutiveRbacTest {

    private static final String ANALYTICS_READ = "analytics:read";

    @Test
    @DisplayName("SmartBIDashboardController.getExecutiveDashboard declares @RequirePermission(analytics:read)")
    void getExecutiveDashboard_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class
                .getDeclaredMethod("getExecutiveDashboard", String.class, String.class);

        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on getExecutiveDashboard — "
                        + "see PR #470 audit (docs/qa-audits/2026-05-12-r3-finance-l4-deep-results.md). "
                        + "Removing this gate re-opens the warehouse_mgr1 region-ranking leak.");

        assertArrayEquals(new String[]{ANALYTICS_READ}, anno.value(),
                "getExecutiveDashboard must require exactly [analytics:read] — "
                        + "PR #470 §3 R3.1 recommendation. Stricter (read_write) blocks "
                        + "sales_manager / restaurant_manager / viewer who legitimately "
                        + "need this dashboard.");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }
}
