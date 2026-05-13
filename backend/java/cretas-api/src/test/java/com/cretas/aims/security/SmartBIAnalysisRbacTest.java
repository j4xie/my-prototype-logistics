package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.SmartBIAnalysisController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Locks the PR #476 R3.1 same-cause sweep RBAC decision (2026-05-12): the two
 * domain analysis read endpoints in {@link SmartBIAnalysisController} —
 * {@code /analysis/production} and {@code /analysis/quality} — must be gated by
 * {@code analytics:read}, matching the {@code /dashboard/executive} reference
 * fix shipped in PR #480 and the sibling sweep in
 * {@link SmartBIDashboardSiblingsRbacTest}.
 *
 * <p>Background: Both endpoints return a {@code Map} payload that embeds the
 * same {@link com.cretas.aims.dto.smartbi.DashboardResponse} shape (rankings,
 * trend charts, KPI metrics) the PR #470 audit caught {@code warehouse_mgr1}
 * exfiltrating from {@code /dashboard/executive}. They were missed by PR #480
 * because that PR only gated the {@code /dashboard/*} family; PR #476's R3.1
 * sweep classified them as direct same-cause siblings.
 *
 * <p>Write endpoints in the same controller ({@code /query}, {@code /drill-down})
 * are separately gated by {@code analytics:read_write} and intentionally not
 * covered here.
 *
 * @see SmartBIDashboardSiblingsRbacTest sibling Dashboard endpoints sweep
 * @see SmartBIDashboardExecutiveRbacTest single-endpoint reference (PR #480)
 */
@DisplayName("PR #476 — SmartBIAnalysis read endpoints gated by analytics:read")
class SmartBIAnalysisRbacTest {

    private static final String ANALYTICS_READ = "analytics:read";

    @Test
    @DisplayName("getProductionAnalysis (/analysis/production) declares @RequirePermission(analytics:read)")
    void getProductionAnalysis_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIAnalysisController.class.getDeclaredMethod(
                "getProductionAnalysis", String.class, LocalDate.class, LocalDate.class, String.class);
        assertGatedByAnalyticsRead(method, "/analysis/production");
    }

    @Test
    @DisplayName("getQualityAnalysis (/analysis/quality) declares @RequirePermission(analytics:read)")
    void getQualityAnalysis_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIAnalysisController.class.getDeclaredMethod(
                "getQualityAnalysis", String.class, LocalDate.class, LocalDate.class, String.class);
        assertGatedByAnalyticsRead(method, "/analysis/quality");
    }

    private static void assertGatedByAnalyticsRead(Method method, String routeForMessage) {
        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on " + method.getName() + " (" + routeForMessage + ") — "
                        + "see PR #476 R3.1 same-cause sweep. Removing this gate re-opens the "
                        + "warehouse_mgr1 rankings/KPI leak on the production/quality dashboards.");

        assertArrayEquals(new String[]{ANALYTICS_READ}, anno.value(),
                method.getName() + " must require exactly [analytics:read] — "
                        + "stricter (read_write) blocks sales_manager / restaurant_manager / viewer "
                        + "who legitimately need these analysis views.");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }
}
