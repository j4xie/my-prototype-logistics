/**
 * 角色映射工具 - 处理后端用户数据到前端格式的转换
 */

import { User } from '../types/auth';

/**
 * 根据角色生成默认权限
 */
function generatePermissionsFromRole(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    // 平台角色
    platform_admin: [
      'platform_access',
      'admin_access',
      'processing_access',
      'farming_access',
      'logistics_access',
      'trace_access',
    ],

    // 工厂角色
    factory_super_admin: [
      'admin_access',
      'processing_access',
      'farming_access',
      'logistics_access',
      'trace_access',
    ],
    permission_admin: [
      'admin_access',
    ],
    department_admin: [
      'processing_access', // 默认给生产权限,实际应根据department动态分配
    ],
    operator: [
      'processing_access', // 操作员可访问生产模块
    ],
    viewer: [
      'trace_access', // 查看者只能溯源查询
    ],
    unactivated: [],
  };

  return rolePermissions[role] || [];
}

/**
 * 转换后端用户数据为前端格式
 */
export function transformBackendUser(backendUser: any): User {
  console.log('🔄 transformBackendUser - Input:', JSON.stringify(backendUser, null, 2));

  // 如果已经是前端格式，直接返回
  if (backendUser.userType && (backendUser.platformUser || backendUser.factoryUser)) {
    console.log('✅ Already in frontend format');
    return backendUser as User;
  }

  // 转换后端格式到前端格式
  const baseUser = {
    id: backendUser.id?.toString() || '',
    username: backendUser.username || '',
    email: backendUser.email || '',
    phone: backendUser.phone || backendUser.phoneNumber,
    fullName: backendUser.fullName || backendUser.realName,
    avatar: backendUser.avatar,
    lastLoginAt: backendUser.lastLoginAt,
    createdAt: backendUser.createdAt || new Date().toISOString(),
    updatedAt: backendUser.updatedAt || new Date().toISOString(),
    isActive: backendUser.isActive !== false,
  };

  // 确定用户类型和角色
  const userType = backendUser.userType || backendUser.type || 'factory';
  const role = backendUser.role || backendUser.roleCode || 'viewer';

  console.log(`🎯 Determined userType: ${userType}, role: ${role}`);

  // 处理平台用户
  if (userType === 'platform' || role === 'platform_admin' || role === 'developer') {
    const user: User = {
      ...baseUser,
      userType: 'platform' as const,
      platformUser: {
        role: role === 'developer' ? 'platform_admin' : role,
        permissions: backendUser.permissions || generatePermissionsFromRole(role),
      },
    };
    console.log('✅ Created platform user:', JSON.stringify(user, null, 2));
    return user;
  }

  // 处理工厂用户
  const user: User = {
    ...baseUser,
    userType: 'factory' as const,
    factoryUser: {
      role: role,
      factoryId: backendUser.factoryId || '',
      department: backendUser.department,
      position: backendUser.position,
      permissions: backendUser.permissions || generatePermissionsFromRole(role),
    },
  };

  console.log('✅ Created factory user:', JSON.stringify(user, null, 2));
  return user;
}

/**
 * 获取用户角色
 */
export function getUserRole(user: User): string | null {
  if (user.userType === 'platform' && user.platformUser) {
    return user.platformUser.role;
  }

  if (user.userType === 'factory' && user.factoryUser) {
    return user.factoryUser.role;
  }

  return null;
}

/**
 * 获取用户显示名称
 */
export function getUserDisplayName(user: User): string {
  if (user.userType === 'platform' && user.platformUser) {
    return user.platformUser.fullName || user.username;
  }

  if (user.userType === 'factory' && user.factoryUser) {
    return user.factoryUser.fullName || user.username;
  }

  return user.username;
}

/**
 * 检查用户是否有特定角色
 */
export function hasRole(user: User, role: string): boolean {
  const userRole = getUserRole(user);
  return userRole === role;
}

/**
 * 检查用户是否是平台管理员
 */
export function isPlatformAdmin(user: User): boolean {
  return user.userType === 'platform' &&
    (hasRole(user, 'platform_super_admin') || hasRole(user, 'developer'));
}

/**
 * 检查用户是否是工厂管理员
 */
export function isFactoryAdmin(user: User): boolean {
  return user.userType === 'factory' &&
    (hasRole(user, 'factory_super_admin') || hasRole(user, 'permission_admin'));
}