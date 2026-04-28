package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Admin user-count endpoint for 4-eye degradation in data quality queue (Phase A A-3).
 *
 * Used by Python data_quality_queue_admin._get_admin_count_for_factory to decide when
 * 4-eye check should auto-degrade to single-admin mode (admin_count == 1).
 *
 * platform_admin is intentionally excluded (cross-factory role, not bound to one factory).
 *
 * @author Cretas Team
 * @since 2026-04-28
 */
@RestController
@RequestMapping("/api/mobile")
public class UserCountController {

    /**
     * Roles that count as "factory admins" for 4-eye degradation purposes.
     * platform_admin is explicitly excluded (cross-factory role).
     */
    private static final List<String> ADMIN_ROLES = List.of(
        "factory_super_admin", "permission_admin", "factory_admin"
    );

    @Autowired
    private UserRepository userRepository;

    /**
     * GET /api/mobile/{factoryId}/users/admin-count
     *
     * Returns the count of non-deleted users in the factory whose roleCode is one of
     * factory_super_admin, permission_admin, or factory_admin.
     *
     * Response: { success: true, data: { count: long } }
     */
    @GetMapping("/{factoryId}/users/admin-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> adminCount(
            @PathVariable String factoryId) {
        long count = userRepository.countByFactoryIdAndRoleCodeIn(factoryId, ADMIN_ROLES);
        return ResponseEntity.ok(ApiResponse.success(Map.of("count", count)));
    }
}
