/**
 * 模块级权限控制常量定义
 * 基于您的完整权限控制方案实现
 */

// 五大核心模块权限
export const MODULE_PERMISSIONS = {
  FARMING_ACCESS: 'farming_access',
  PROCESSING_ACCESS: 'processing_access', 
  LOGISTICS_ACCESS: 'logistics_access',
  ADMIN_ACCESS: 'admin_access',
  PLATFORM_ACCESS: 'platform_access'
} as const;

// 辅助功能权限
export const FEATURE_PERMISSIONS = {
  USER_MANAGE_OWN_DEPT: 'user_manage_own_dept',
  USER_MANAGE_ALL: 'user_manage_all',
  WHITELIST_MANAGE_OWN_DEPT: 'whitelist_manage_own_dept',
  WHITELIST_MANAGE_ALL: 'whitelist_manage_all',
  STATS_VIEW_OWN_DEPT: 'stats_view_own_dept',
  STATS_VIEW_ALL: 'stats_view_all'
} as const;

// 用户角色定义
export const USER_ROLES = {
  PLATFORM_ADMIN: 'platform_admin',     // 平台管理员 (level 0)
  SUPER_ADMIN: 'super_admin',           // 工厂超级管理员 (level 0)
  PERMISSION_ADMIN: 'permission_admin', // 权限管理员 (level 5)
  DEPARTMENT_ADMIN: 'department_admin', // 部门管理员 (level 10)
  USER: 'user'                          // 普通工人 (level 50)
} as const;

// 部门定义
export const DEPARTMENTS = {
  FARMING: 'farming',
  PROCESSING: 'processing',
  LOGISTICS: 'logistics',
  QUALITY: 'quality',
  MANAGEMENT: 'management',
  ADMIN: 'admin'
} as const;

// 权限级别定义
export const ROLE_LEVELS = {
  [USER_ROLES.PLATFORM_ADMIN]: 0,
  [USER_ROLES.SUPER_ADMIN]: 0,
  [USER_ROLES.PERMISSION_ADMIN]: 5,
  [USER_ROLES.DEPARTMENT_ADMIN]: 10,
  [USER_ROLES.USER]: 50
} as const;

/**
 * 用户权限信息接口
 */
export interface UserPermissions {
  modules: {
    [MODULE_PERMISSIONS.FARMING_ACCESS]?: boolean;
    [MODULE_PERMISSIONS.PROCESSING_ACCESS]?: boolean;
    [MODULE_PERMISSIONS.LOGISTICS_ACCESS]?: boolean;
    [MODULE_PERMISSIONS.ADMIN_ACCESS]?: boolean;
    [MODULE_PERMISSIONS.PLATFORM_ACCESS]?: boolean;
  };
  features: string[];
  role: keyof typeof USER_ROLES;
  roleLevel: number;
  department?: keyof typeof DEPARTMENTS;
}

/**
 * 模块访问状态
 */
export interface ModuleAccessState {
  farming: boolean;
  processing: boolean;
  logistics: boolean;
  admin: boolean;
  platform: boolean;
}

/**
 * 角色权限模板定义
 */
export const ROLE_PERMISSION_TEMPLATES = {
  // 平台管理员 - 只能管理平台
  [USER_ROLES.PLATFORM_ADMIN]: {
    modules: {
      [MODULE_PERMISSIONS.PLATFORM_ACCESS]: true
    },
    features: []
  },
  
  // 工厂超级管理员 - 所有业务模块 + 完整管理权限
  [USER_ROLES.SUPER_ADMIN]: {
    modules: {
      [MODULE_PERMISSIONS.FARMING_ACCESS]: true,
      [MODULE_PERMISSIONS.PROCESSING_ACCESS]: true,
      [MODULE_PERMISSIONS.LOGISTICS_ACCESS]: true,
      [MODULE_PERMISSIONS.ADMIN_ACCESS]: true
    },
    features: [
      FEATURE_PERMISSIONS.USER_MANAGE_ALL,
      FEATURE_PERMISSIONS.WHITELIST_MANAGE_ALL,
      FEATURE_PERMISSIONS.STATS_VIEW_ALL
    ]
  },
  
  // 权限管理员 - 只有用户管理权限
  [USER_ROLES.PERMISSION_ADMIN]: {
    modules: {
      [MODULE_PERMISSIONS.ADMIN_ACCESS]: true
    },
    features: [
      FEATURE_PERMISSIONS.USER_MANAGE_ALL
    ]
  },
  
  // 部门管理员 - 本部门模块 + 部门管理权限
  [USER_ROLES.DEPARTMENT_ADMIN]: {
    modules: {}, // 根据部门动态设置
    features: [
      FEATURE_PERMISSIONS.USER_MANAGE_OWN_DEPT,
      FEATURE_PERMISSIONS.WHITELIST_MANAGE_OWN_DEPT,
      FEATURE_PERMISSIONS.STATS_VIEW_OWN_DEPT
    ]
  },
  
  // 普通工人 - 本部门模块访问
  [USER_ROLES.USER]: {
    modules: {}, // 根据部门动态设置
    features: []
  }
} as const;

/**
 * 部门模块映射关系
 */
export const DEPARTMENT_MODULE_MAPPING = {
  [DEPARTMENTS.FARMING]: MODULE_PERMISSIONS.FARMING_ACCESS,
  [DEPARTMENTS.PROCESSING]: MODULE_PERMISSIONS.PROCESSING_ACCESS,
  [DEPARTMENTS.LOGISTICS]: MODULE_PERMISSIONS.LOGISTICS_ACCESS,
  [DEPARTMENTS.QUALITY]: MODULE_PERMISSIONS.PROCESSING_ACCESS, // 质检归属生产模块
  [DEPARTMENTS.MANAGEMENT]: MODULE_PERMISSIONS.ADMIN_ACCESS,
  [DEPARTMENTS.ADMIN]: MODULE_PERMISSIONS.ADMIN_ACCESS
} as const;

/**
 * 生成用户权限配置
 */
export function generateUserPermissions(
  role: keyof typeof USER_ROLES,
  department?: keyof typeof DEPARTMENTS
): UserPermissions {
  // Convert role key to role value for template lookup
  const roleValue = USER_ROLES[role];
  const template = ROLE_PERMISSION_TEMPLATES[roleValue];
  
  // 防御性编程：如果template不存在，使用默认权限
  if (!template) {
    console.warn(`[Permissions] 角色模板不存在: ${roleValue} (key: ${role}), 使用默认权限`);
    return {
      modules: {},
      features: [],
      role,
      roleLevel: ROLE_LEVELS[roleValue] || 99,
      department
    };
  }
  
  const permissions: UserPermissions = {
    modules: { ...template.modules },
    features: [...template.features],
    role,
    roleLevel: ROLE_LEVELS[roleValue],
    department
  };

  // 为部门角色添加对应的模块权限
  if (department && (role === 'DEPARTMENT_ADMIN' || role === 'USER')) {
    const modulePermission = DEPARTMENT_MODULE_MAPPING[department];
    if (modulePermission) {
      permissions.modules[modulePermission] = true;
    }
  }

  return permissions;
}

/**
 * 权限验证工具函数
 */
export class PermissionChecker {
  /**
   * 检查模块访问权限
   */
  static hasModuleAccess(
    userPermissions: UserPermissions,
    module: keyof typeof MODULE_PERMISSIONS
  ): boolean {
    const moduleKey = MODULE_PERMISSIONS[module];
    return userPermissions.modules[moduleKey] === true;
  }

  /**
   * 检查功能权限
   */
  static hasFeaturePermission(
    userPermissions: UserPermissions,
    feature: string
  ): boolean {
    return userPermissions.features.includes(feature);
  }

  /**
   * 检查角色级别权限
   */
  static hasRoleLevel(
    userPermissions: UserPermissions,
    requiredLevel: number
  ): boolean {
    return userPermissions.roleLevel <= requiredLevel;
  }

  /**
   * 生成模块访问状态
   */
  static getModuleAccessState(userPermissions: UserPermissions): ModuleAccessState {
    return {
      farming: this.hasModuleAccess(userPermissions, 'FARMING_ACCESS'),
      processing: this.hasModuleAccess(userPermissions, 'PROCESSING_ACCESS'),
      logistics: this.hasModuleAccess(userPermissions, 'LOGISTICS_ACCESS'),
      admin: this.hasModuleAccess(userPermissions, 'ADMIN_ACCESS'),
      platform: this.hasModuleAccess(userPermissions, 'PLATFORM_ACCESS')
    };
  }
}

// 导出类型
export type ModulePermission = keyof typeof MODULE_PERMISSIONS;
export type FeaturePermission = keyof typeof FEATURE_PERMISSIONS;
export type UserRole = keyof typeof USER_ROLES;
export type Department = keyof typeof DEPARTMENTS;