package com.cretas.aims.controller.auth;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.auth.UserMenuPermission;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.service.auth.UserMenuPermissionService;
import com.cretas.aims.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.cretas.aims.config.RequireRole;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 用户级菜单权限覆盖 Controller (P0-6 昆山六扇门)
 *
 * <p>提供 role 权限之上的 user-level GRANT/REVOKE 管理接口。
 *
 * <p>TODO 下一轮: 集成到 {@code @PreAuthorize} 或 JWT filter,
 * 让请求鉴权自动调用 {@code getEffectiveMenus} 替代直接查 role。
 * 本轮仅保证 Service + Controller 可独立工作,不改现有鉴权流。
 *
 * @since 2026-04-08
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/users/{userId}/menu-permissions")
@RequiredArgsConstructor
public class UserMenuPermissionController {

    private final UserMenuPermissionService service;

    /** 列出该用户的所有 override */
    @GetMapping
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<List<UserMenuPermission>>> list(
            @PathVariable String factoryId,
            @PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.listUserOverrides(factoryId, userId)));
    }

    /** 计算用户的最终有效菜单集合 */
    @GetMapping("/effective")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<Set<String>>> getEffective(
            @PathVariable String factoryId,
            @PathVariable String userId,
            @RequestParam("role") FactoryUserRole role) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getEffectiveMenus(factoryId, userId, role)));
    }

    /** 追加授权 */
    @RequirePermission({"system:read_write"})
    @PostMapping("/grant")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<UserMenuPermission>> grant(
            @PathVariable String factoryId,
            @PathVariable String userId,
            @RequestBody Map<String, String> body) {
        String menuCode = body.get("menuCode");
        String remark = body.get("remark");
        if (menuCode == null || menuCode.isBlank()) {
            throw new BusinessException(400, "menuCode 不能为空");
        }
        UserMenuPermission saved = service.grantMenu(
                factoryId, userId, menuCode, currentOperator(), remark);
        return ResponseEntity.ok(ApiResponse.success("授权成功", saved));
    }

    /** 撤销授权 */
    @RequirePermission({"system:read_write"})
    @PostMapping("/revoke")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<UserMenuPermission>> revoke(
            @PathVariable String factoryId,
            @PathVariable String userId,
            @RequestBody Map<String, String> body) {
        String menuCode = body.get("menuCode");
        String remark = body.get("remark");
        if (menuCode == null || menuCode.isBlank()) {
            throw new BusinessException(400, "menuCode 不能为空");
        }
        UserMenuPermission saved = service.revokeMenu(
                factoryId, userId, menuCode, currentOperator(), remark);
        return ResponseEntity.ok(ApiResponse.success("撤销成功", saved));
    }

    /** 清除 override, 回归 role 默认 */
    @RequirePermission({"system:read_write"})
    @DeleteMapping("/{menuCode}")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<Void>> clear(
            @PathVariable String factoryId,
            @PathVariable String userId,
            @PathVariable String menuCode) {
        service.clearUserOverride(factoryId, userId, menuCode);
        return ResponseEntity.ok(ApiResponse.successMessage("已清除"));
    }

    private String currentOperator() {
        try {
            return org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication().getName();
        } catch (Exception e) {
            return "system";
        }
    }
}
