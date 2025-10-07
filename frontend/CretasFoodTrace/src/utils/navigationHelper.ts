/**
 * 导航辅助工具
 * 实现智能路由逻辑,根据用户角色和权限决定登录后的跳转目标
 */

import { User, UserRole } from '../types/auth';
import { NavigationRoute } from '../types/navigation';

/**
 * 根据用户角色获取登录后应该跳转的路由
 */
export function getPostLoginRoute(user: User): NavigationRoute {
  const { userType } = user;

  // 平台用户
  if (userType === 'platform') {
    return getPlatformUserRoute(user);
  }

  // 工厂用户
  if (userType === 'factory') {
    return getFactoryUserRoute(user);
  }

  // 默认:主页
  return {
    screen: 'Main',
    params: { screen: 'HomeTab' },
  };
}

/**
 * 获取平台用户的路由
 */
function getPlatformUserRoute(user: User): NavigationRoute {
  if (user.userType !== 'platform') {
    return { screen: 'Main', params: { screen: 'HomeTab' } };
  }

  const { role } = user.platformUser;

  if (role === 'platform_admin') {
    // 平台管理员 → 主页(显示所有模块)
    return {
      screen: 'Main',
      params: { screen: 'HomeTab' },
    };
  }

  return { screen: 'Main', params: { screen: 'HomeTab' } };
}

/**
 * 获取工厂用户的路由
 */
function getFactoryUserRoute(user: User): NavigationRoute {
  if (user.userType !== 'factory') {
    return { screen: 'Main', params: { screen: 'HomeTab' } };
  }

  const { role, department } = user.factoryUser;

  switch (role) {
    case 'factory_super_admin':
      // 工厂超级管理员 → 主页(显示工厂概览)
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'permission_admin':
      // 权限管理员 → 主页(后续可跳转到用户管理)
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'department_admin':
      // 部门管理员 → 根据部门跳转到对应模块
      return getDepartmentAdminRoute(department);

    case 'operator':
      // 操作员 → 主页(显示快捷打卡)
      // TODO: 未来可直接跳转到打卡页面
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'viewer':
      // 查看者 → 主页(只读模式)
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'unactivated':
      // 未激活用户 → 不应该能登录,返回登录页
      return { screen: 'Login' };

    default:
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };
  }
}

/**
 * 获取部门管理员的路由(根据部门)
 */
function getDepartmentAdminRoute(department?: string): NavigationRoute {
  switch (department) {
    case 'processing':
      // 加工部门 → 生产仪表板
      return {
        screen: 'Main',
        params: {
          screen: 'ProcessingTab',
          params: { screen: 'ProcessingDashboard' },
        },
      };

    case 'farming':
      // 养殖部门 → 主页(养殖模块未开发)
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'logistics':
      // 物流部门 → 主页(物流模块未开发)
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'quality':
      // 质检部门 → 主页(质检模块未开发)
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    case 'management':
      // 管理部门 → 主页
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };

    default:
      // 默认 → 主页
      return {
        screen: 'Main',
        params: { screen: 'HomeTab' },
      };
  }
}

/**
 * 检查用户是否有模块访问权限
 */
export function hasModuleAccess(user: User, module: string): boolean {
  const permissions = user.userType === 'platform'
    ? user.platformUser?.permissions
    : user.factoryUser?.permissions;

  return checkPermission(permissions, module);
}

/**
 * 检查用户是否有某个权限
 */
export function hasPermission(user: User, permission: string): boolean {
  const permissions = user.userType === 'platform'
    ? user.platformUser?.permissions
    : user.factoryUser?.permissions;

  return checkPermission(permissions, permission);
}

/**
 * 检查权限 - 兼容数组和对象格式
 */
function checkPermission(permissions: any, perm: string): boolean {
  if (!permissions) return false;

  // 如果是数组格式
  if (Array.isArray(permissions)) {
    return permissions.includes(perm);
  }

  // 如果是对象格式 (后端返回的格式)
  if (typeof permissions === 'object') {
    // 检查 modules 对象
    if (permissions.modules && permissions.modules[perm] === true) {
      return true;
    }
    // 检查 features 数组
    if (Array.isArray(permissions.features) && permissions.features.includes(perm)) {
      return true;
    }
  }

  return false;
}

/**
 * 获取角色显示名称
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleMap: Record<string, string> = {
    platform_admin: '平台管理员',
    factory_super_admin: '工厂超级管理员',
    permission_admin: '权限管理员',
    department_admin: '部门管理员',
    operator: '操作员',
    viewer: '查看者',
    unactivated: '未激活用户',
  };
  return roleMap[role] || role;
}