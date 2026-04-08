package com.cretas.aims.service.auth.impl;

import com.cretas.aims.entity.auth.UserMenuPermission;
import com.cretas.aims.entity.auth.UserMenuPermission.GrantType;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.repository.auth.UserMenuPermissionRepository;
import com.cretas.aims.service.PermissionService;
import com.cretas.aims.service.auth.UserMenuPermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 用户级菜单权限覆盖实现 (P0-6 昆山六扇门)
 *
 * @since 2026-04-08
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserMenuPermissionServiceImpl implements UserMenuPermissionService {

    private final UserMenuPermissionRepository repository;
    private final PermissionService permissionService;

    @Override
    @Transactional(readOnly = true)
    public Set<String> getEffectiveMenus(String factoryId, String userId, FactoryUserRole role) {
        // 1. role 默认权限集
        Set<String> effective = role == null
                ? new HashSet<>()
                : new HashSet<>(permissionService.getRolePermissions(role));

        // 2. 应用 user-level overrides
        List<UserMenuPermission> overrides = repository.findByFactoryIdAndUserId(factoryId, userId);
        for (UserMenuPermission o : overrides) {
            if (o.getGrantType() == GrantType.GRANT) {
                effective.add(o.getMenuCode());
            } else if (o.getGrantType() == GrantType.REVOKE) {
                effective.remove(o.getMenuCode());
            }
        }
        return effective;
    }

    @Override
    @Transactional
    public UserMenuPermission grantMenu(String factoryId, String userId, String menuCode,
                                         String grantedBy, String remark) {
        return upsert(factoryId, userId, menuCode, GrantType.GRANT, grantedBy, remark);
    }

    @Override
    @Transactional
    public UserMenuPermission revokeMenu(String factoryId, String userId, String menuCode,
                                          String grantedBy, String remark) {
        return upsert(factoryId, userId, menuCode, GrantType.REVOKE, grantedBy, remark);
    }

    @Override
    @Transactional
    public void clearUserOverride(String factoryId, String userId, String menuCode) {
        repository.deleteByFactoryIdAndUserIdAndMenuCode(factoryId, userId, menuCode);
        log.info("[P0-6] 清除用户菜单覆盖 factory={} user={} menu={}", factoryId, userId, menuCode);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserMenuPermission> listUserOverrides(String factoryId, String userId) {
        return repository.findByFactoryIdAndUserId(factoryId, userId);
    }

    private UserMenuPermission upsert(String factoryId, String userId, String menuCode,
                                       GrantType type, String grantedBy, String remark) {
        UserMenuPermission entity = repository
                .findByFactoryIdAndUserIdAndMenuCode(factoryId, userId, menuCode)
                .orElseGet(UserMenuPermission::new);
        entity.setFactoryId(factoryId);
        entity.setUserId(userId);
        entity.setMenuCode(menuCode);
        entity.setGrantType(type);
        entity.setGrantedBy(grantedBy);
        entity.setRemark(remark);
        UserMenuPermission saved = repository.save(entity);
        log.info("[P0-6] 用户菜单覆盖 upsert factory={} user={} menu={} type={} by={}",
                factoryId, userId, menuCode, type, grantedBy);
        return saved;
    }
}
