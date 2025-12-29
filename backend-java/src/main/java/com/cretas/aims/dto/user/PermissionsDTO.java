package com.cretas.aims.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 用户权限数据传输对象
 * 与前端 UserPermissions 接口保持一致
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户权限信息")
public class PermissionsDTO {

    @Schema(description = "模块访问权限")
    private ModulesAccess modules;

    @Schema(description = "功能权限列表")
    private List<String> features;

    @Schema(description = "角色代码")
    private String role;

    @Schema(description = "用户类型: platform 或 factory")
    private String userType;

    @Schema(description = "角色级别")
    private Integer roleLevel;

    @Schema(description = "部门列表")
    private List<String> departments;

    /**
     * 模块访问权限
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "模块访问权限")
    public static class ModulesAccess {
        @Schema(description = "养殖模块访问权限")
        private Boolean farming_access;

        @Schema(description = "加工模块访问权限")
        private Boolean processing_access;

        @Schema(description = "物流模块访问权限")
        private Boolean logistics_access;

        @Schema(description = "溯源模块访问权限")
        private Boolean trace_access;

        @Schema(description = "管理模块访问权限")
        private Boolean admin_access;

        @Schema(description = "平台模块访问权限")
        private Boolean platform_access;

        @Schema(description = "调试模块访问权限")
        private Boolean debug_access;

        @Schema(description = "系统配置权限")
        private Boolean system_config;
    }

    /**
     * 根据角色代码构建权限对象
     */
    public static PermissionsDTO fromRole(String roleCode, String userType, List<String> rawPermissions) {
        ModulesAccess modules = buildModulesFromRole(roleCode, userType);

        return PermissionsDTO.builder()
                .modules(modules)
                .features(rawPermissions != null ? rawPermissions : List.of())
                .role(roleCode)
                .userType(userType)
                .roleLevel(getRoleLevel(roleCode))
                .build();
    }

    /**
     * 根据角色构建模块访问权限
     */
    private static ModulesAccess buildModulesFromRole(String roleCode, String userType) {
        ModulesAccess.ModulesAccessBuilder builder = ModulesAccess.builder();

        // 平台用户权限
        if ("platform".equals(userType)) {
            builder.platform_access(true)
                   .admin_access(true)
                   .farming_access(true)
                   .processing_access(true)
                   .logistics_access(true)
                   .trace_access(true);

            if ("super_admin".equals(roleCode) || "developer".equals(roleCode)) {
                builder.debug_access(true)
                       .system_config(true);
            }
            return builder.build();
        }

        // 工厂用户权限 - 根据角色设置
        switch (roleCode != null ? roleCode : "") {
            case "factory_super_admin":
                builder.admin_access(true)
                       .farming_access(true)
                       .processing_access(true)
                       .logistics_access(true)
                       .trace_access(true)
                       .system_config(true);
                break;
            case "department_admin":
                builder.admin_access(true)
                       .processing_access(true)
                       .trace_access(true);
                break;
            case "quality_inspector":
                builder.processing_access(true)
                       .trace_access(true);
                break;
            case "production_worker":
                builder.processing_access(true);
                break;
            case "warehouse_manager":
                builder.logistics_access(true)
                       .trace_access(true);
                break;
            case "logistics_worker":
                builder.logistics_access(true);
                break;
            case "salesperson":
                builder.trace_access(true);
                break;
            default:
                // 默认无权限
                break;
        }

        return builder.build();
    }

    /**
     * 获取角色级别
     */
    private static Integer getRoleLevel(String roleCode) {
        if (roleCode == null) return 0;

        switch (roleCode) {
            case "developer":
            case "super_admin":
                return 100;
            case "platform_admin":
                return 90;
            case "factory_super_admin":
                return 80;
            case "department_admin":
                return 70;
            case "quality_inspector":
            case "warehouse_manager":
                return 60;
            case "production_worker":
            case "logistics_worker":
            case "salesperson":
                return 50;
            default:
                return 0;
        }
    }
}
