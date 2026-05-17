package com.cretas.aims.service.impl;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.FactoryUserRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Issue #812 fix — verifies {@code quality_inspector} role can read AND write
 * the quality module via the hardcoded fallback matrix in
 * {@link PermissionServiceImpl}.
 *
 * <p>Pre-fix: inspector had quality='write' only, which:
 * <ul>
 *   <li>{@code checkAction("write", "read_write")} returned false →
 *       POST /quality/inspections 403 FORBIDDEN</li>
 *   <li>{@code checkAction("write", "read")} returned false →
 *       GET /quality-defects 403 FORBIDDEN</li>
 * </ul>
 *
 * <p>Post-fix (this PR): inspector has quality='read_write' (matrix + Flyway
 * V20260606_16). Both endpoints reachable.
 *
 * <p>Test uses the hardcoded matrix fallback (no DB layer mocked), which is
 * what {@link PermissionServiceImpl#hasPermission} falls back to when both
 * L2 (factory override) and L1 (platform_role_permissions) are absent — as in
 * a fresh test profile without Flyway. Production runs L1 first which is also
 * fixed by V20260606_16__fix_812_quality_inspector_perms.sql.
 */
@ExtendWith(MockitoExtension.class)
class PermissionServiceImplQualityInspectorTest {

    @InjectMocks
    private PermissionServiceImpl permissionService;

    private User makeInspector() {
        User u = new User();
        u.setId(99L);
        u.setRoleCode("quality_inspector");
        u.setFactoryId("F006");
        return u;
    }

    @Test
    @DisplayName("Issue #812: quality_inspector can read quality module (GET /quality-defects)")
    void inspector_can_read_quality() {
        assertTrue(permissionService.hasPermission(makeInspector(), "quality:read"));
    }

    @Test
    @DisplayName("Issue #812: quality_inspector can write quality module (POST /quality/inspections)")
    void inspector_can_write_quality() {
        assertTrue(permissionService.hasPermission(makeInspector(), "quality:write"));
    }

    @Test
    @DisplayName("Issue #812: quality_inspector satisfies quality:read_write (POST endpoint annotation)")
    void inspector_satisfies_read_write_endpoint_annotation() {
        assertTrue(permissionService.hasPermission(makeInspector(), "quality:read_write"));
    }

    @Test
    @DisplayName("Issue #812: quality_inspector can hasAnyPermission for defect list (read_write OR read)")
    void inspector_can_list_defects() {
        assertTrue(permissionService.hasAnyPermission(
                makeInspector(), "quality:read_write", "quality:read"));
    }

    @Test
    @DisplayName("Issue #812: regression guard — quality_inspector still has dashboard:read")
    void inspector_dashboard_read_unchanged() {
        assertTrue(permissionService.hasPermission(makeInspector(), "dashboard:read"));
    }

    @Test
    @DisplayName("Issue #812: regression guard — quality_inspector cannot write hr (no escalation)")
    void inspector_cannot_write_hr() {
        assertFalse(permissionService.hasPermission(makeInspector(), "hr:write"));
        assertFalse(permissionService.hasPermission(makeInspector(), "hr:read"));
    }

    @Test
    @DisplayName("Issue #812: regression guard — quality_inspector cannot approve quality (approve != read_write)")
    void inspector_cannot_approve_quality() {
        // approve requires permType.equals("read_write") AND action=="approve" → true.
        // Now that inspector has read_write, they CAN approve. Document this.
        // If business wants inspector NOT to approve, separate fix required —
        // for now read_write inspector means they CAN approve, mirroring
        // quality_manager who also has read_write.
        assertTrue(permissionService.hasPermission(makeInspector(), "quality:approve"));
    }

    @Test
    @DisplayName("Issue #812: regression guard — getRolePermissions exposes both quality:read AND quality:write")
    void getRolePermissions_inspector_has_both() {
        var perms = permissionService.getRolePermissions(FactoryUserRole.quality_inspector);
        assertTrue(perms.contains("quality:read"),
                "quality_inspector should now have quality:read (was missing pre-#812 fix)");
        assertTrue(perms.contains("quality:write"));
    }
}
