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
    return user.platformUser?.role || 'platform_operator';
  } else {
    return user.factoryUser?.role || 'operator';
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
      avatar: backendUser.avatar || undefined,
      lastLoginAt: backendUser.lastLogin || undefined,
      createdAt: backendUser.createdAt,
      updatedAt: backendUser.updatedAt,
      isActive: backendUser.isActive ?? true,
      userType: 'platform',
      platformUser: {
        role: backendUser.role,
        permissions: backendUser.permissions || []
      }
    } as PlatformUser;
  }
  
  // 工厂用户
  return {
    id: backendUser.id,
    username: backendUser.username,
    email: backendUser.email,
    phone: backendUser.phone || undefined,
    fullName: backendUser.fullName || undefined,
    avatar: backendUser.avatar || undefined,
    lastLoginAt: backendUser.lastLogin || backendUser.last_login || undefined,
    createdAt: backendUser.createdAt || backendUser.created_at,
    updatedAt: backendUser.updatedAt || backendUser.updated_at,
    isActive: backendUser.isActive ?? backendUser.is_active ?? true,
    userType: 'factory',
    factoryUser: {
      role: backendUser.roleCode || backendUser.role_code,
      factoryId: backendUser.factoryId || backendUser.factory_id,
      department: backendUser.department || undefined,
      position: backendUser.position || undefined,
      permissions: backendUser.permissions || []
    }
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
  if (isPlatformUser(user)) {
    return user.platformUser.permissions.includes(permission);
  } else {
    return user.factoryUser.permissions.includes(permission);
  }
};

// 判断用户是否有管理权限
export const userHasAdminAccess = (user: User): boolean => {
  const role = getUserRole(user);
  return ['system_developer', 'platform_super_admin', 'factory_super_admin', 'permission_admin'].includes(role);
};

// 获取用户工厂ID（工厂用户专用）
export const getUserFactoryId = (user: User): string | undefined => {
  if (isFactoryUser(user)) {
    return user.factoryUser.factoryId;
  }
  return undefined;
};