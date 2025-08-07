import { 
  UserRole, 
  PlatformRole, 
  FactoryRole,
  User,
  PlatformUser,
  FactoryUser,
  PLATFORM_ROLES,
  FACTORY_ROLES,
  USER_ROLES
} from '../types/auth';

/**
 * 角色映射工具
 * 处理前后端角色名称差异和类型转换
 */

// 判断是否为平台角色
export const isPlatformRole = (role: UserRole): role is PlatformRole => {
  return Object.values(PLATFORM_ROLES).includes(role as PlatformRole);
};

// 判断是否为工厂角色
export const isFactoryRole = (role: UserRole): role is FactoryRole => {
  return Object.values(FACTORY_ROLES).includes(role as FactoryRole);
};

// 判断用户类型
export const isPlatformUser = (user: User): user is PlatformUser => {
  return user.userType === 'platform';
};

export const isFactoryUser = (user: User): user is FactoryUser => {
  return user.userType === 'factory';
};

// 获取用户的统一角色（兼容两种用户类型）
export const getUserRole = (user: User): UserRole => {
  if (isPlatformUser(user)) {
    return user.role;
  } else {
    return user.roleCode;
  }
};

// 角色显示名称映射
export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    // 平台角色
    [PLATFORM_ROLES.SYSTEM_DEVELOPER]: '系统开发者',
    [PLATFORM_ROLES.PLATFORM_SUPER_ADMIN]: '平台超级管理员',
    [PLATFORM_ROLES.PLATFORM_OPERATOR]: '平台操作员',
    // 工厂角色
    [FACTORY_ROLES.FACTORY_SUPER_ADMIN]: '工厂超级管理员',
    [FACTORY_ROLES.PERMISSION_ADMIN]: '权限管理员',
    [FACTORY_ROLES.DEPARTMENT_ADMIN]: '部门管理员',
    [FACTORY_ROLES.OPERATOR]: '操作员',
    [FACTORY_ROLES.VIEWER]: '查看者',
    [FACTORY_ROLES.UNACTIVATED]: '待激活用户'
  };
  
  return roleNames[role] || role;
};

// 部门显示名称映射
export const getDepartmentDisplayName = (department: string): string => {
  const departmentNames: Record<string, string> = {
    farming: '种植部',
    processing: '加工部',
    logistics: '物流部',
    quality: '质检部',
    management: '管理部'
  };
  
  return departmentNames[department] || department;
};

// 后端响应转换为前端User对象
export const transformBackendUser = (backendUser: any): User => {
  // 平台用户
  if (backendUser.userType === 'platform' || backendUser.role) {
    return {
      id: backendUser.id,
      username: backendUser.username,
      email: backendUser.email,
      phone: backendUser.phone || undefined,
      fullName: backendUser.fullName || undefined,
      role: backendUser.role,
      userType: 'platform',
      permissions: backendUser.permissions || generateDefaultPermissions(backendUser.role),
      avatar: backendUser.avatar || undefined,
      lastLoginAt: backendUser.lastLogin || undefined,
      createdAt: backendUser.createdAt
    } as PlatformUser;
  }
  
  // 工厂用户
  return {
    id: backendUser.id,
    username: backendUser.username,
    email: backendUser.email,
    phone: backendUser.phone || undefined,
    fullName: backendUser.fullName || undefined,
    roleCode: backendUser.roleCode || backendUser.role_code,
    factoryId: backendUser.factoryId || backendUser.factory_id,
    department: backendUser.department || undefined,
    position: backendUser.position || undefined,
    isActive: backendUser.isActive ?? backendUser.is_active ?? true,
    userType: 'factory',
    permissions: backendUser.permissions || generateDefaultPermissions(backendUser.roleCode || backendUser.role_code),
    avatar: backendUser.avatar || undefined,
    lastLoginAt: backendUser.lastLogin || backendUser.last_login || undefined,
    createdAt: backendUser.createdAt || backendUser.created_at
  } as FactoryUser;
};

// 生成默认权限（当后端未返回权限时）
const generateDefaultPermissions = (role: UserRole) => {
  // 这里应该根据角色生成默认权限
  // 暂时返回基础权限结构
  return {
    modules: {
      farming_access: false,
      processing_access: false,
      logistics_access: false,
      trace_access: false,
      admin_access: false,
      platform_access: false,
    },
    features: [],
    role: role,
    userType: isPlatformRole(role) ? 'platform' : 'factory',
    level: 100,
    departments: []
  };
};

// 判断用户是否有特定权限
export const userHasPermission = (user: User, permission: string): boolean => {
  return user.permissions.features.includes(permission);
};

// 判断用户是否有模块访问权限
export const userHasModuleAccess = (user: User, module: keyof User['permissions']['modules']): boolean => {
  return user.permissions.modules[module] || false;
};

// 获取用户角色级别（用于权限比较）
export const getUserRoleLevel = (user: User): number => {
  return user.permissions.level || 100;
};