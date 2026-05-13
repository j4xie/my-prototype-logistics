package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.SmartBIDashboardController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Locks the PR #476 R3.1 sibling sweep RBAC decision (2026-05-12): the 7 sibling
 * endpoints in {@link SmartBIDashboardController} must each be gated by
 * {@code analytics:read}, matching the {@code /dashboard/executive} reference
 * fix shipped in PR #480.
 *
 * <p>Background: PR #480 only gated {@code /dashboard/executive}. PR #476's
 * sweep identified 5 sibling families ({@code /dashboard/executive/custom},
 * {@code /dashboard} unified, {@code /analysis/dynamic}, {@code /analysis/dynamic/kpis},
 * and the {@code /dashboard/executive/insights*} family with 3 variants) that
 * return the same {@link com.cretas.aims.dto.smartbi.DashboardResponse} /
 * {@link com.cretas.aims.dto.smartbi.UnifiedDashboardResponse} shape and are
 * therefore vulnerable to the same {@code warehouse_mgr1} leak the PR #470 audit
 * caught on prod 139:8086. {@link com.cretas.aims.config.PriceFieldResponseAdvice}
 * field-level strip is not a defense — the leak is the entire payload (rankings,
 * KPIs, regional breakdowns), not just price columns.
 *
 * <p>The reflective check is a regression guard: if anyone removes or weakens the
 * annotation on any sibling, this test fails fast and points to PR #476 / PR #480.
 *
 * <p>AOP-level enforcement (warehouse 403 / admin 200 / 4位一体 rich body) is
 * exercised by the wider RBAC sweep evidence (PR #470 + R3 follow-ups) plus the
 * live BG post-deploy curl verification documented in the PR description.
 *
 * @see SmartBIDashboardExecutiveRbacTest reference single-endpoint pattern (PR #480)
 * @see com.cretas.aims.config.PermissionInterceptor 4位一体 response builder
 */
@DisplayName("PR #476 — SmartBIDashboard sibling endpoints gated by analytics:read")
class SmartBIDashboardSiblingsRbacTest {

    private static final String ANALYTICS_READ = "analytics:read";

    @Test
    @DisplayName("getDashboardLLMInsights (/dashboard/executive/insights) declares @RequirePermission(analytics:read)")
    void getDashboardLLMInsights_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class
                .getDeclaredMethod("getDashboardLLMInsights", String.class, String.class);
        assertGatedByAnalyticsRead(method, "/dashboard/executive/insights");
    }

    @Test
    @DisplayName("getDashboardLLMInsightsCustomRange (/dashboard/executive/insights/custom) declares @RequirePermission(analytics:read)")
    void getDashboardLLMInsightsCustomRange_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class.getDeclaredMethod(
                "getDashboardLLMInsightsCustomRange", String.class, LocalDate.class, LocalDate.class);
        assertGatedByAnalyticsRead(method, "/dashboard/executive/insights/custom");
    }

    @Test
    @DisplayName("streamInsightsCustom SSE (/dashboard/executive/insights/custom/stream) declares @RequirePermission(analytics:read)")
    void streamInsightsCustom_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class.getDeclaredMethod(
                "streamInsightsCustom", String.class, LocalDate.class, LocalDate.class);
        assertGatedByAnalyticsRead(method, "/dashboard/executive/insights/custom/stream");
    }

    @Test
    @DisplayName("getExecutiveDashboardCustomRange (/dashboard/executive/custom) declares @RequirePermission(analytics:read)")
    void getExecutiveDashboardCustomRange_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class.getDeclaredMethod(
                "getExecutiveDashboardCustomRange", String.class, LocalDate.class, LocalDate.class);
        assertGatedByAnalyticsRead(method, "/dashboard/executive/custom");
    }

    @Test
    @DisplayName("getUnifiedDashboard (/dashboard) declares @RequirePermission(analytics:read)")
    void getUnifiedDashboard_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class
                .getDeclaredMethod("getUnifiedDashboard", String.class, String.class);
        assertGatedByAnalyticsRead(method, "/dashboard");
    }

    @Test
    @DisplayName("getKPIsOnly (/analysis/dynamic/kpis) declares @RequirePermission(analytics:read)")
    void getKPIsOnly_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class
                .getDeclaredMethod("getKPIsOnly", String.class, Long.class);
        assertGatedByAnalyticsRead(method, "/analysis/dynamic/kpis");
    }

    @Test
    @DisplayName("analyzeDynamicData (/analysis/dynamic) declares @RequirePermission(analytics:read)")
    void analyzeDynamicData_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIDashboardController.class.getDeclaredMethod(
                "analyzeDynamicData", String.class, Long.class, String.class, boolean.class);
        assertGatedByAnalyticsRead(method, "/analysis/dynamic");
    }

    private static void assertGatedByAnalyticsRead(Method method, String routeForMessage) {
        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on " + method.getName() + " (" + routeForMessage + ") — "
                        + "see PR #476 R3.1 sweep / PR #480 reference. Removing this gate re-opens "
                        + "the warehouse_mgr1 dashboard/rankings leak across all sibling routes.");

        assertArrayEquals(new String[]{ANALYTICS_READ}, anno.value(),
                method.getName() + " must require exactly [analytics:read] — "
                        + "stricter (read_write) blocks sales_manager / restaurant_manager / viewer "
                        + "who legitimately need these dashboards.");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }
}
