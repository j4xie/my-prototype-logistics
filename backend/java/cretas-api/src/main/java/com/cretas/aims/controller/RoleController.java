package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.service.PermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 角色管理 Controller
 *
 * 提供角色权限查询接口,支持前端"角色管理 → 查看权限"功能.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-04-14
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/roles")
@RequiredArgsConstructor
@Tag(name = "角色管理", description = "工厂角色权限查询")
public class RoleController {

    private final PermissionService permissionService;

    /**
     * 前端显示的功能模块列表 (与 web-admin/src/views/system/roles/list.vue 保持一致)
     */
    private static final Map<String, String> DISPLAY_MODULES = new LinkedHashMap<>();
    static {
        DISPLAY_MODULES.put("production", "生产管理");
        DISPLAY_MODULES.put("quality", "质检管理");
        DISPLAY_MODULES.put("warehouse", "仓库管理");
        DISPLAY_MODULES.put("procurement", "采购管理");
        DISPLAY_MODULES.put("sales", "销售管理");
        DISPLAY_MODULES.put("hr", "人事管理");
        DISPLAY_MODULES.put("equipment", "设备管理");
        DISPLAY_MODULES.put("finance", "财务管理");
        DISPLAY_MODULES.put("system", "系统设置");
        DISPLAY_MODULES.put("ai", "AI 分析");
        DISPLAY_MODULES.put("report", "报表中心");
        DISPLAY_MODULES.put("dashboard", "数据看板");
    }

    /**
     * 获取某个角色在各功能模块上的权限明细.
     *
     * 返回格式 (前端 list.vue `rolePermissions` 期望的结构):
     * <pre>
     * [
     *   { "module": "production", "label": "生产管理", "access": "rw" },
     *   { "module": "quality",    "label": "质检管理", "access": "r"  },
     *   ...
     * ]
     * </pre>
     *
     * access 值含义: rw=读写 / r=只读 / w=只写 / -=无权限
     *
     * @param factoryId 工厂ID (路径占位,当前版本仅用于路由匹配,未做工厂隔离校验)
     * @param roleName  角色代码 (必须与 {@link FactoryUserRole} 枚举一致,如 factory_super_admin)
     */
    /**
     * Issue #817 (2026-05-17): 工厂角色列表 root LIST endpoint.
     *
     * <p>之前 web-admin {@code system/roles/list.vue} 硬编码 14 个角色; 任何 FE
     * 想动态拉角色列表 (e.g. user assignment dropdown) 撞 404. 本 endpoint 暴露
     * {@link FactoryUserRole} 枚举为公开 API.
     *
     * <p>返回结构 (camelCase, 跟 FE list.vue {@code roles} 数组保持一致):
     * <pre>
     * [
     *   { "name": "factory_super_admin", "displayName": "工厂总监",
     *     "description": "拥有工厂所有权限", "level": 0, "department": "all" },
     *   ...
     * ]
     * </pre>
     *
     * <p>过滤掉 {@code unactivated} 以及 deprecated {@code production_manager}
     * (已 alias 到 dispatcher).
     */
    @GetMapping
    @Operation(summary = "工厂角色列表",
            description = "Issue #817 — 替代前端硬编码角色列表, 支持 user assignment dropdown")
    @RequirePermission({"system:read_write", "system:read"})
    public ApiResponse<List<Map<String, Object>>> listRoles(@PathVariable String factoryId) {
        log.debug("listRoles: factoryId={}", factoryId);

        List<Map<String, Object>> result = new ArrayList<>();
        for (FactoryUserRole role : FactoryUserRole.values()) {
            if (!role.isActive() || role == FactoryUserRole.production_manager) {
                // 跳过 unactivated + deprecated production_manager (已 alias dispatcher)
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", role.name());
            row.put("displayName", role.getDisplayName());
            row.put("description", role.getDescription());
            row.put("level", role.getLevel());
            row.put("department", role.getDepartment());
            result.add(row);
        }
        return ApiResponse.success(result);
    }

    @GetMapping("/{roleName}/permissions")
    @Operation(summary = "查询角色权限", description = "返回角色在各功能模块的读写权限明细")
    public ApiResponse<List<Map<String, Object>>> getRolePermissions(
            @PathVariable String factoryId,
            @PathVariable String roleName) {

        log.debug("getRolePermissions: factoryId={}, roleName={}", factoryId, roleName);

        FactoryUserRole role = FactoryUserRole.fromRoleCode(roleName);
        Set<String> flatPerms = permissionService.getRolePermissions(role);

        // 将 "module:read" / "module:write" 的扁平集合反向汇总为每个模块的 access 字符串
        Map<String, Boolean> hasRead = new HashMap<>();
        Map<String, Boolean> hasWrite = new HashMap<>();
        for (String p : flatPerms) {
            int idx = p.indexOf(':');
            if (idx <= 0) continue;
            String module = p.substring(0, idx);
            String action = p.substring(idx + 1);
            if ("read".equals(action)) {
                hasRead.put(module, true);
            } else if ("write".equals(action)) {
                hasWrite.put(module, true);
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, String> entry : DISPLAY_MODULES.entrySet()) {
            String module = entry.getKey();
            String label = entry.getValue();

            boolean r = Boolean.TRUE.equals(hasRead.get(module));
            boolean w = Boolean.TRUE.equals(hasWrite.get(module));
            String access;
            if (r && w) {
                access = "rw";
            } else if (r) {
                access = "r";
            } else if (w) {
                access = "w";
            } else {
                access = "-";
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("module", module);
            row.put("label", label);
            row.put("access", access);
            result.add(row);
        }

        return ApiResponse.success(result);
    }
}
