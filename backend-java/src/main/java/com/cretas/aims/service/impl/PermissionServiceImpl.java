package com.cretas.aims.service.impl;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.service.PermissionService;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 权限服务实现
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-12-27
 */
@Service
public class PermissionServiceImpl implements PermissionService {

    /**
     * 模块列表
     */
    private static final List<String> ALL_MODULES = Arrays.asList(
            "dashboard", "production", "warehouse", "quality",
            "procurement", "sales", "hr", "equipment", "finance", "system", "analytics"
    );

    /**
     * 角色权限矩阵 (内存缓存)
     * 格式: role -> module -> permission_type (none/read/write/read_write)
     */
    private static final Map<FactoryUserRole, Map<String, String>> PERMISSION_MATRIX = new HashMap<>();

    static {
        // 初始化权限矩阵
        initPermissionMatrix();
    }

    private static void initPermissionMatrix() {
        // factory_super_admin: 所有模块读写
        Map<String, String> superAdminPerms = new HashMap<>();
        ALL_MODULES.forEach(m -> superAdminPerms.put(m, "read_write"));
        PERMISSION_MATRIX.put(FactoryUserRole.factory_super_admin, superAdminPerms);

        // dispatcher (调度): 生产读写 + 全模块只读 + 数据分析读写
        Map<String, String> dispatcherPerms = new HashMap<>();
        dispatcherPerms.put("dashboard", "read_write");
        dispatcherPerms.put("production", "read_write");
        dispatcherPerms.put("warehouse", "read");
        dispatcherPerms.put("quality", "read");
        dispatcherPerms.put("procurement", "read");
        dispatcherPerms.put("sales", "read");       // 新增: 可查看销售数据
        dispatcherPerms.put("hr", "read");
        dispatcherPerms.put("equipment", "read");
        dispatcherPerms.put("finance", "read");     // 新增: 可查看财务分析
        dispatcherPerms.put("system", "read");
        dispatcherPerms.put("analytics", "read_write"); // 新增: 数据分析中心
        PERMISSION_MATRIX.put(FactoryUserRole.dispatcher, dispatcherPerms);
        PERMISSION_MATRIX.put(FactoryUserRole.production_manager, dispatcherPerms); // 向后兼容

        // quality_manager
        Map<String, String> qualityManagerPerms = new HashMap<>();
        qualityManagerPerms.put("dashboard", "read");
        qualityManagerPerms.put("production", "read");
        qualityManagerPerms.put("quality", "read_write");
        PERMISSION_MATRIX.put(FactoryUserRole.quality_manager, qualityManagerPerms);

        // workshop_supervisor
        Map<String, String> workshopPerms = new HashMap<>();
        workshopPerms.put("dashboard", "read");
        workshopPerms.put("production", "read_write");
        workshopPerms.put("warehouse", "read");
        workshopPerms.put("quality", "write");
        workshopPerms.put("hr", "read");
        workshopPerms.put("equipment", "read");
        PERMISSION_MATRIX.put(FactoryUserRole.workshop_supervisor, workshopPerms);

        // quality_inspector
        Map<String, String> inspectorPerms = new HashMap<>();
        inspectorPerms.put("dashboard", "read");
        inspectorPerms.put("production", "read");
        inspectorPerms.put("quality", "write");
        PERMISSION_MATRIX.put(FactoryUserRole.quality_inspector, inspectorPerms);

        // operator
        Map<String, String> operatorPerms = new HashMap<>();
        operatorPerms.put("dashboard", "read");
        operatorPerms.put("production", "write");
        PERMISSION_MATRIX.put(FactoryUserRole.operator, operatorPerms);

        // warehouse_manager
        Map<String, String> warehouseManagerPerms = new HashMap<>();
        warehouseManagerPerms.put("dashboard", "read_write");
        warehouseManagerPerms.put("warehouse", "read_write");
        warehouseManagerPerms.put("production", "read");
        PERMISSION_MATRIX.put(FactoryUserRole.warehouse_manager, warehouseManagerPerms);

        // warehouse_worker
        Map<String, String> warehouseWorkerPerms = new HashMap<>();
        warehouseWorkerPerms.put("dashboard", "read");
        warehouseWorkerPerms.put("warehouse", "write");
        PERMISSION_MATRIX.put(FactoryUserRole.warehouse_worker, warehouseWorkerPerms);

        // hr_admin
        Map<String, String> hrPerms = new HashMap<>();
        hrPerms.put("dashboard", "read");
        hrPerms.put("hr", "read_write");
        PERMISSION_MATRIX.put(FactoryUserRole.hr_admin, hrPerms);

        // equipment_admin
        Map<String, String> equipmentPerms = new HashMap<>();
        equipmentPerms.put("dashboard", "read");
        equipmentPerms.put("equipment", "read_write");
        PERMISSION_MATRIX.put(FactoryUserRole.equipment_admin, equipmentPerms);

        // procurement_manager
        Map<String, String> procurementPerms = new HashMap<>();
        procurementPerms.put("dashboard", "read");
        procurementPerms.put("procurement", "read_write");
        procurementPerms.put("warehouse", "read");
        PERMISSION_MATRIX.put(FactoryUserRole.procurement_manager, procurementPerms);

        // sales_manager
        Map<String, String> salesPerms = new HashMap<>();
        salesPerms.put("dashboard", "read");
        salesPerms.put("sales", "read_write");
        salesPerms.put("warehouse", "read");
        PERMISSION_MATRIX.put(FactoryUserRole.sales_manager, salesPerms);

        // finance_manager: 财务主管 - SmartBI完整权限（含上传Excel）
        Map<String, String> financePerms = new HashMap<>();
        financePerms.put("dashboard", "read");
        financePerms.put("finance", "read_write");
        financePerms.put("production", "read");
        financePerms.put("procurement", "read");
        financePerms.put("sales", "read");
        financePerms.put("analytics", "read_write");  // SmartBI 完整权限
        PERMISSION_MATRIX.put(FactoryUserRole.finance_manager, financePerms);

        // viewer: 所有模块只读
        Map<String, String> viewerPerms = new HashMap<>();
        ALL_MODULES.stream()
                .filter(m -> !m.equals("system"))
                .forEach(m -> viewerPerms.put(m, "read"));
        PERMISSION_MATRIX.put(FactoryUserRole.viewer, viewerPerms);

        // 向后兼容的角色
        PERMISSION_MATRIX.put(FactoryUserRole.permission_admin, superAdminPerms);
        PERMISSION_MATRIX.put(FactoryUserRole.department_admin, dispatcherPerms);

        // unactivated: 无权限
        PERMISSION_MATRIX.put(FactoryUserRole.unactivated, new HashMap<>());
    }

    @Override
    public boolean hasPermission(User user, String permissionCode) {
        if (user == null || permissionCode == null || permissionCode.isEmpty()) {
            return false;
        }

        FactoryUserRole role = user.getRoleEnum();
        if (role == null || role == FactoryUserRole.unactivated) {
            return false;
        }

        // 超级管理员拥有所有权限
        if (role == FactoryUserRole.factory_super_admin) {
            return true;
        }

        // 解析权限代码 (格式: module:action)
        String[] parts = permissionCode.split(":");
        if (parts.length != 2) {
            return false;
        }
        String module = parts[0];
        String action = parts[1];

        // 检查角色权限矩阵
        Map<String, String> rolePerms = PERMISSION_MATRIX.get(role);
        if (rolePerms == null) {
            return false;
        }

        String permType = rolePerms.get(module);
        if (permType == null || permType.equals("none")) {
            return false;
        }

        // 检查操作权限
        switch (action) {
            case "read":
                return permType.contains("read");
            case "write":
                return permType.contains("write");
            case "*":
                return true;
            default:
                return permType.equals("read_write");
        }
    }

    @Override
    public boolean hasAnyPermission(User user, String... permissionCodes) {
        if (permissionCodes == null || permissionCodes.length == 0) {
            return false;
        }
        for (String code : permissionCodes) {
            if (hasPermission(user, code)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean hasAllPermissions(User user, String... permissionCodes) {
        if (permissionCodes == null || permissionCodes.length == 0) {
            return false;
        }
        for (String code : permissionCodes) {
            if (!hasPermission(user, code)) {
                return false;
            }
        }
        return true;
    }

    @Override
    public Set<String> getUserPermissions(User user) {
        Set<String> permissions = new HashSet<>();
        if (user == null) {
            return permissions;
        }

        FactoryUserRole role = user.getRoleEnum();
        if (role == null) {
            return permissions;
        }

        Map<String, String> rolePerms = PERMISSION_MATRIX.get(role);
        if (rolePerms == null) {
            return permissions;
        }

        for (Map.Entry<String, String> entry : rolePerms.entrySet()) {
            String module = entry.getKey();
            String permType = entry.getValue();

            if (permType.contains("read")) {
                permissions.add(module + ":read");
            }
            if (permType.contains("write")) {
                permissions.add(module + ":write");
            }
        }

        return permissions;
    }

    @Override
    public List<String> getAccessibleModules(User user) {
        if (user == null) {
            return Collections.emptyList();
        }

        FactoryUserRole role = user.getRoleEnum();
        if (role == null) {
            return Collections.emptyList();
        }

        Map<String, String> rolePerms = PERMISSION_MATRIX.get(role);
        if (rolePerms == null) {
            return Collections.emptyList();
        }

        return rolePerms.entrySet().stream()
                .filter(e -> !e.getValue().equals("none"))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    @Override
    public boolean canAccessModule(User user, String module) {
        if (user == null || module == null) {
            return false;
        }

        FactoryUserRole role = user.getRoleEnum();
        if (role == null || role == FactoryUserRole.unactivated) {
            return false;
        }

        if (role == FactoryUserRole.factory_super_admin) {
            return true;
        }

        Map<String, String> rolePerms = PERMISSION_MATRIX.get(role);
        if (rolePerms == null) {
            return false;
        }

        String permType = rolePerms.get(module);
        return permType != null && !permType.equals("none");
    }

    @Override
    public boolean canManageUser(User manager, User target) {
        if (manager == null || target == null) {
            return false;
        }
        return manager.canManage(target);
    }

    @Override
    public boolean canAccessFactory(User user, String factoryId) {
        if (user == null || factoryId == null) {
            return false;
        }

        // 用户只能访问自己所属工厂的数据
        return factoryId.equals(user.getFactoryId());
    }

    @Override
    public boolean matchPermission(String pattern, String permission) {
        if (pattern == null || permission == null) {
            return false;
        }

        // 完全匹配
        if (pattern.equals(permission)) {
            return true;
        }

        // 通配符匹配
        if (pattern.equals("*") || pattern.equals("*:*")) {
            return true;
        }

        String[] patternParts = pattern.split(":");
        String[] permParts = permission.split(":");

        if (patternParts.length != 2 || permParts.length != 2) {
            return false;
        }

        boolean moduleMatch = patternParts[0].equals("*") || patternParts[0].equals(permParts[0]);
        boolean actionMatch = patternParts[1].equals("*") || patternParts[1].equals(permParts[1]);

        return moduleMatch && actionMatch;
    }

    @Override
    public Set<String> getRolePermissions(FactoryUserRole role) {
        Set<String> permissions = new HashSet<>();
        if (role == null) {
            return permissions;
        }

        Map<String, String> rolePerms = PERMISSION_MATRIX.get(role);
        if (rolePerms == null) {
            return permissions;
        }

        for (Map.Entry<String, String> entry : rolePerms.entrySet()) {
            String module = entry.getKey();
            String permType = entry.getValue();

            if (permType.contains("read")) {
                permissions.add(module + ":read");
            }
            if (permType.contains("write")) {
                permissions.add(module + ":write");
            }
        }

        return permissions;
    }
}
