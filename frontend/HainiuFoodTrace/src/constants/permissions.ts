import { 
  UserRole, 
  USER_ROLES, 
  PLATFORM_ROLES,
  FACTORY_ROLES,
  UserPermissions 
} from '../types/auth';

// 部门权限定义
export const DEPARTMENTS = {
  FARMING: 'farming',
  PROCESSING: 'processing', 
  LOGISTICS: 'logistics',
  QUALITY: 'quality',
  MANAGEMENT: 'management'
} as const;

export type Department = typeof DEPARTMENTS[keyof typeof DEPARTMENTS];

// 权限特性定义
export const PERMISSIONS = {
  // 模块访问权限
  FARMING_ACCESS: 'farming_access',
  PROCESSING_ACCESS: 'processing_access',
  LOGISTICS_ACCESS: 'logistics_access',
  TRACE_ACCESS: 'trace_access',
  ADMIN_ACCESS: 'admin_access',
  PLATFORM_ACCESS: 'platform_access',
  
  // 功能权限
  USER_MANAGE_ALL: 'user_manage_all',
  USER_MANAGE_FACTORY: 'user_manage_factory',
  USER_MANAGE_DEPARTMENT: 'user_manage_department',
  USER_VIEW_ALL: 'user_view_all',
  
  // 数据权限
  DATA_VIEW_ALL: 'data_view_all',
  DATA_VIEW_FACTORY: 'data_view_factory',
  DATA_VIEW_DEPARTMENT: 'data_view_department',
  DATA_EXPORT: 'data_export',
  
  // 系统权限
  SYSTEM_CONFIG: 'system_config',
  DEBUG_ACCESS: 'debug_access',
  DEVELOPER_TOOLS: 'developer_tools',
  
  // 平台权限
  PLATFORM_MANAGE_ALL: 'platform_manage_all',
  FACTORY_MANAGE_ALL: 'factory_manage_all',
  WHITELIST_MANAGE: 'whitelist_manage'
} as const;

// 角色级别定义（数字越小权限越高）
export const ROLE_LEVELS = {
  // 平台角色
  [PLATFORM_ROLES.SYSTEM_DEVELOPER]: -1,
  [PLATFORM_ROLES.PLATFORM_SUPER_ADMIN]: 0,
  [PLATFORM_ROLES.PLATFORM_OPERATOR]: 1,
  // 工厂角色
  [FACTORY_ROLES.FACTORY_SUPER_ADMIN]: 0,
  [FACTORY_ROLES.PERMISSION_ADMIN]: 5,
  [FACTORY_ROLES.DEPARTMENT_ADMIN]: 10,
  [FACTORY_ROLES.OPERATOR]: 30,
  [FACTORY_ROLES.VIEWER]: 50,
  [FACTORY_ROLES.UNACTIVATED]: 99
} as const;

// 核心角色权限配置（渐进式实现 - 第一阶段）
export const CORE_ROLE_PERMISSIONS: Record<string, UserPermissions> = {
  // 系统开发者 - 所有权限
  [PLATFORM_ROLES.SYSTEM_DEVELOPER]: {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: true,
      debug_access: true,
      system_config: true
    },
    features: [
      PERMISSIONS.USER_MANAGE_ALL,
      PERMISSIONS.DATA_VIEW_ALL,
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.SYSTEM_CONFIG,
      PERMISSIONS.DEBUG_ACCESS,
      PERMISSIONS.DEVELOPER_TOOLS,
      PERMISSIONS.PLATFORM_MANAGE_ALL,
      PERMISSIONS.FACTORY_MANAGE_ALL,
      PERMISSIONS.WHITELIST_MANAGE
    ],
    role: 'system_developer',
    userType: 'platform',
    level: ROLE_LEVELS[PLATFORM_ROLES.SYSTEM_DEVELOPER],
    departments: Object.values(DEPARTMENTS)
  },

  // 平台超级管理员 - 平台管理权限
  [PLATFORM_ROLES.PLATFORM_SUPER_ADMIN]: {
    modules: {
      farming_access: false,
      processing_access: false,
      logistics_access: false,
      trace_access: false,
      admin_access: false,
      platform_access: true,
    },
    features: [
      PERMISSIONS.PLATFORM_MANAGE_ALL,
      PERMISSIONS.FACTORY_MANAGE_ALL,
      PERMISSIONS.USER_MANAGE_ALL,
      PERMISSIONS.WHITELIST_MANAGE,
      PERMISSIONS.DATA_VIEW_ALL,
      PERMISSIONS.DATA_EXPORT
    ],
    role: 'platform_super_admin',
    userType: 'platform',
    level: ROLE_LEVELS[PLATFORM_ROLES.PLATFORM_SUPER_ADMIN],
    departments: []
  },

  // 工厂超级管理员 - 基础业务权限
  [FACTORY_ROLES.FACTORY_SUPER_ADMIN]: {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: false,
    },
    features: [
      PERMISSIONS.USER_MANAGE_FACTORY,
      PERMISSIONS.DATA_VIEW_FACTORY,
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.FARMING_ACCESS,
      PERMISSIONS.PROCESSING_ACCESS,
      PERMISSIONS.LOGISTICS_ACCESS,
      PERMISSIONS.TRACE_ACCESS
    ],
    role: 'factory_super_admin',
    userType: 'factory',
    level: ROLE_LEVELS[FACTORY_ROLES.FACTORY_SUPER_ADMIN],
    departments: Object.values(DEPARTMENTS)
  }
};

// 完整角色权限配置（渐进式实现 - 第二阶段扩展）
export const FULL_ROLE_PERMISSIONS: Record<string, UserPermissions> = {
  ...CORE_ROLE_PERMISSIONS,

  // 平台操作员
  [PLATFORM_ROLES.PLATFORM_OPERATOR]: {
    modules: {
      farming_access: false,
      processing_access: false,
      logistics_access: false,
      trace_access: false,
      admin_access: false,
      platform_access: true,
    },
    features: [
      PERMISSIONS.USER_VIEW_ALL,
      PERMISSIONS.DATA_VIEW_ALL,
      'platform_view_all',
      'factory_view_all'
    ],
    role: 'platform_operator',
    userType: 'platform',
    level: ROLE_LEVELS[PLATFORM_ROLES.PLATFORM_OPERATOR],
    departments: []
  },

  // 权限管理员
  [FACTORY_ROLES.PERMISSION_ADMIN]: {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: false,
    },
    features: [
      PERMISSIONS.USER_MANAGE_FACTORY,
      PERMISSIONS.DATA_VIEW_FACTORY,
      'permission_manage',
      'role_assign'
    ],
    role: 'permission_admin',
    userType: 'factory',
    level: ROLE_LEVELS[FACTORY_ROLES.PERMISSION_ADMIN],
    departments: Object.values(DEPARTMENTS)
  },

  // 部门管理员
  [FACTORY_ROLES.DEPARTMENT_ADMIN]: {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: false,
      platform_access: false,
    },
    features: [
      PERMISSIONS.USER_MANAGE_DEPARTMENT,
      PERMISSIONS.DATA_VIEW_DEPARTMENT,
      'department_manage'
    ],
    role: 'department_admin',
    userType: 'factory',
    level: ROLE_LEVELS[FACTORY_ROLES.DEPARTMENT_ADMIN],
    departments: [] // 将在运行时根据用户所属部门设置
  },

  // 操作员
  [FACTORY_ROLES.OPERATOR]: {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: false,
      admin_access: false,
      platform_access: false,
    },
    features: [
      'data_input',
      'data_view_own',
      'basic_operations'
    ],
    role: 'operator',
    userType: 'factory',
    level: ROLE_LEVELS[FACTORY_ROLES.OPERATOR],
    departments: [] // 将在运行时根据用户所属部门设置
  },

  // 查看者
  [FACTORY_ROLES.VIEWER]: {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: false,
      platform_access: false,
    },
    features: [
      'data_view_own',
      'report_view'
    ],
    role: 'viewer',
    userType: 'factory',
    level: ROLE_LEVELS[FACTORY_ROLES.VIEWER],
    departments: [] // 将在运行时根据用户所属部门设置
  }
};

// 数据访问规则
export const DATA_ACCESS_RULES = {
  ALL: 'all',           // 所有数据
  FACTORY: 'factory',   // 工厂内数据
  DEPARTMENT: 'department', // 部门内数据
  OWN: 'own'            // 个人数据
} as const;

export type DataAccessLevel = typeof DATA_ACCESS_RULES[keyof typeof DATA_ACCESS_RULES];

// 根据角色获取数据访问级别
export const ROLE_DATA_ACCESS: Record<UserRole, DataAccessLevel> = {
  // 平台角色
  [PLATFORM_ROLES.SYSTEM_DEVELOPER]: DATA_ACCESS_RULES.ALL,
  [PLATFORM_ROLES.PLATFORM_SUPER_ADMIN]: DATA_ACCESS_RULES.ALL,
  [PLATFORM_ROLES.PLATFORM_OPERATOR]: DATA_ACCESS_RULES.ALL,
  // 工厂角色
  [FACTORY_ROLES.FACTORY_SUPER_ADMIN]: DATA_ACCESS_RULES.FACTORY,
  [FACTORY_ROLES.PERMISSION_ADMIN]: DATA_ACCESS_RULES.FACTORY,
  [FACTORY_ROLES.DEPARTMENT_ADMIN]: DATA_ACCESS_RULES.DEPARTMENT,
  [FACTORY_ROLES.OPERATOR]: DATA_ACCESS_RULES.DEPARTMENT,
  [FACTORY_ROLES.VIEWER]: DATA_ACCESS_RULES.OWN,
  [FACTORY_ROLES.UNACTIVATED]: DATA_ACCESS_RULES.OWN
};