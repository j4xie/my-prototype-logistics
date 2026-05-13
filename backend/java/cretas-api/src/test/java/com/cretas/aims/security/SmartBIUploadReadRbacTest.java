package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.SmartBIUploadController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Locks the PR #486 deferred sweep follow-up (2026-05-12): the 4 read endpoints
 * in {@link SmartBIUploadController} that previously had no RBAC gate must each
 * be guarded by {@code analytics:read}.
 *
 * <p>PR #486 listed these as out-of-scope same-cause findings ("different attack
 * surface: raw data dump vs analysis aggregates"). They still leak to
 * {@code warehouse_mgr1} because the controller-class has no
 * {@code @RequireRole}/{@code @RequirePermission} and the four GET methods
 * carried no method-level gate either.
 *
 * <p>The matching write/upload/backfill mutations on this controller are
 * separately gated by {@code analytics:read_write} (already on prod). The reads
 * use the broader {@code analytics:read} so sales/finance/restaurant_manager
 * and viewer roles can still preview their factory's upload history — matching
 * the PR #480/#486 convention.
 *
 * @see SmartBIDashboardSiblingsRbacTest reference sibling-sweep pattern (PR #486)
 * @see com.cretas.aims.config.PermissionInterceptor 4位一体 response builder
 */
@DisplayName("PR #486 deferred — SmartBIUpload read endpoints gated by analytics:read")
class SmartBIUploadReadRbacTest {

    private static final String ANALYTICS_READ = "analytics:read";

    @Test
    @DisplayName("getUploadHistory (/uploads) declares @RequirePermission(analytics:read)")
    void getUploadHistory_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIUploadController.class.getDeclaredMethod(
                "getUploadHistory", String.class, String.class, int.class, int.class);
        assertGatedByAnalyticsRead(method, "/uploads");
    }

    @Test
    @DisplayName("getUploadFields (/uploads/{uploadId}/fields) declares @RequirePermission(analytics:read)")
    void getUploadFields_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIUploadController.class.getDeclaredMethod(
                "getUploadFields", String.class, Long.class);
        assertGatedByAnalyticsRead(method, "/uploads/{uploadId}/fields");
    }

    @Test
    @DisplayName("getUploadData (/uploads/{uploadId}/data) declares @RequirePermission(analytics:read)")
    void getUploadData_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIUploadController.class.getDeclaredMethod(
                "getUploadData", String.class, Long.class, int.class, int.class);
        assertGatedByAnalyticsRead(method, "/uploads/{uploadId}/data");
    }

    @Test
    @DisplayName("getUploadsMissingFields (/uploads-missing-fields) declares @RequirePermission(analytics:read)")
    void getUploadsMissingFields_isAnnotatedWithAnalyticsRead() throws Exception {
        Method method = SmartBIUploadController.class.getDeclaredMethod(
                "getUploadsMissingFields", String.class);
        assertGatedByAnalyticsRead(method, "/uploads-missing-fields");
    }

    private static void assertGatedByAnalyticsRead(Method method, String routeForMessage) {
        RequirePermission anno = method.getAnnotation(RequirePermission.class);
        assertNotNull(anno,
                "@RequirePermission must be present on " + method.getName() + " (" + routeForMessage + ") — "
                        + "see PR #486 deferred sweep. Removing this gate re-opens the warehouse_mgr1 "
                        + "upload history / raw row dump leak (factory data dump).");

        assertArrayEquals(new String[]{ANALYTICS_READ}, anno.value(),
                method.getName() + " must require exactly [analytics:read] — "
                        + "stricter (read_write) blocks sales_manager / finance_manager / "
                        + "restaurant_manager / viewer who legitimately need to preview their "
                        + "factory's upload history.");

        assertFalse(anno.requireAll(),
                "requireAll should remain default (false) — only one permission is declared");
    }
}
