package com.cretas.aims.entity.enums;

/**
 * 工厂用户角色枚举
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public enum FactoryUserRole {
    /**
     * 工厂超级管理员
     */
    factory_super_admin("工厂超级管理员", "拥有工厂所有权限"),
     /**
      * 权限管理员
      */
    permission_admin("权限管理员", "管理用户权限和角色"),
     /**
      * 部门管理员
      */
    department_admin("部门管理员", "管理部门相关业务"),
     /**
      * 操作员
      */
    operator("操作员", "执行日常操作任务"),
     /**
      * 查看者
      */
    viewer("查看者", "只能查看数据"),
     /**
      * 未激活用户
      */
    unactivated("未激活", "账户未激活");
    private final String displayName;
    private final String description;
    FactoryUserRole(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
