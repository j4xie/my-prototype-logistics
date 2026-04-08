package com.cretas.aims.service.auth;

import com.cretas.aims.entity.auth.UserMenuPermission;
import com.cretas.aims.entity.enums.FactoryUserRole;

import java.util.List;
import java.util.Set;

/**
 * 用户级菜单权限覆盖 Service (P0-6 昆山六扇门)
 *
 * <p>在 role 默认权限集合的基础上应用 user-level GRANT/REVOKE 覆盖,
 * 得到该用户最终可访问的菜单/权限 code 集合。
 *
 * @since 2026-04-08
 */
public interface UserMenuPermissionService {

    /**
     * 计算用户最终有效菜单 = (role 默认 ∪ GRANT) - REVOKE
     *
     * @param factoryId 工厂 ID
     * @param userId    用户 ID
     * @param role      用户角色 (从 JWT 中拿)
     * @return 最终有效菜单/权限 code 集合
     */
    Set<String> getEffectiveMenus(String factoryId, String userId, FactoryUserRole role);

    /** 追加授权 (upsert, 覆盖已有 REVOKE) */
    UserMenuPermission grantMenu(String factoryId, String userId, String menuCode,
                                  String grantedBy, String remark);

    /** 撤销授权 (upsert, 覆盖已有 GRANT) */
    UserMenuPermission revokeMenu(String factoryId, String userId, String menuCode,
                                   String grantedBy, String remark);

    /** 清除 override, 回归 role 默认 */
    void clearUserOverride(String factoryId, String userId, String menuCode);

    /** 列出用户的所有 override (前端展示) */
    List<UserMenuPermission> listUserOverrides(String factoryId, String userId);
}
