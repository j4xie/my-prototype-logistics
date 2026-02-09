package com.cretas.aims.entity.smartbi.enums;

/**
 * 部门类型枚举
 * 用于区分不同级别的部门组织
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
public enum DepartmentType {
    /**
     * 部门
     * 一级部门，如：销售部、市场部、研发部、财务部
     */
    DEPARTMENT,

    /**
     * 子部门/分组
     * 二级部门或组，如：销售一部、前端组、应收组
     */
    SUB_DEPARTMENT
}
