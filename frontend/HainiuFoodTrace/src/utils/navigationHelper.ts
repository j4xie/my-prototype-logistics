import { useAuthStore } from '../store/authStore';

/**
 * 根据用户角色和部门决定登录后的跳转路由
 */
export const getPostLoginRoute = (): { screen: string; params?: any } => {
  const { user, getUserType, getUserRole } = useAuthStore.getState();

  if (!user) {
    return { screen: 'home' };
  }

  const userType = getUserType();
  const role = getUserRole();

  // 平台管理员 - 直接跳转到平台界面
  if (userType === 'platform') {
    return {
      screen: 'platform',
      params: { initialRoute: 'PlatformDashboard' }
    };
  }

  // 工厂用户
  if (userType === 'factory') {
    // 获取部门信息
    const department = 'factoryUser' in user ? user.factoryUser.department : null;

    // 开发者或工厂超级管理员 - 跳转到首页
    if (role === 'system_developer' || role === 'factory_super_admin') {
      return { screen: 'home' };
    }

    // 权限管理员 - 跳转到权限管理界面（可以管理所有部门）
    if (role === 'permission_admin') {
      return {
        screen: 'management',
        params: { initialRoute: 'PermissionManagement' }
      };
    }

    // 部门管理员和普通工人 - 直接跳转到对应模块
    if (department) {
      const departmentRoutes: Record<string, string> = {
        farming: 'farming',
        processing: 'processing',
        logistics: 'logistics',
        quality: 'quality',
        management: 'home' // 管理部门跳转到首页
      };

      const targetScreen = departmentRoutes[department] || 'home';
      return { screen: targetScreen };
    }
  }

  // 默认跳转到首页
  return { screen: 'home' };
};

/**
 * 判断用户是否为部门管理员
 */
export const isDepartmentManager = (): boolean => {
  const { user, getUserRole } = useAuthStore.getState();

  if (!user || user.userType !== 'factory') {
    return false;
  }

  const role = getUserRole();
  return role === 'department_admin';
};

/**
 * 判断用户是否有白名单管理权限
 * @param scope - 'all': 全工厂白名单, 'department': 本部门白名单
 */
export const hasWhitelistPermission = (scope: 'all' | 'department' = 'department'): boolean => {
  const { user, getUserRole } = useAuthStore.getState();

  if (!user || user.userType !== 'factory') {
    return false;
  }

  const role = getUserRole();

  // 工厂超级管理员和权限管理员 - 全工厂白名单权限
  if (role === 'factory_super_admin' || role === 'permission_admin') {
    return true;
  }

  // 部门管理员 - 仅本部门白名单权限
  if (role === 'department_admin') {
    return scope === 'department';
  }

  return false;
};

/**
 * 判断用户是否为权限管理员（跨部门权限管理）
 */
export const isPermissionAdmin = (): boolean => {
  const { user, getUserRole } = useAuthStore.getState();

  if (!user || user.userType !== 'factory') {
    return false;
  }

  const role = getUserRole();
  return role === 'permission_admin';
};

/**
 * 获取用户的白名单管理范围
 * @returns 'all' | 'department' | null
 */
export const getWhitelistScope = (): 'all' | 'department' | null => {
  const { user, getUserRole } = useAuthStore.getState();

  if (!user || user.userType !== 'factory') {
    return null;
  }

  const role = getUserRole();

  // 工厂超级管理员和权限管理员 - 全工厂
  if (role === 'factory_super_admin' || role === 'permission_admin') {
    return 'all';
  }

  // 部门管理员 - 本部门
  if (role === 'department_admin') {
    return 'department';
  }

  return null;
};

/**
 * 获取用户可访问的模块列表
 */
export const getUserAccessibleModules = (): string[] => {
  const { user, getUserType, getUserRole } = useAuthStore.getState();

  if (!user) {
    return [];
  }

  const userType = getUserType();
  const role = getUserRole();

  // 平台管理员可以访问平台管理模块
  if (userType === 'platform') {
    return ['platform'];
  }

  // 开发者和工厂超级管理员可以访问所有模块
  if (role === 'system_developer' || role === 'factory_super_admin') {
    return ['home', 'farming', 'processing', 'logistics', 'quality', 'admin', 'reports', 'system'];
  }

  // 权限管理员 - 可以访问管理模块和报表
  if (role === 'permission_admin') {
    return ['home', 'management', 'reports', 'admin'];
  }

  // 普通工厂用户只能访问自己部门的模块
  if (userType === 'factory' && 'factoryUser' in user) {
    const department = user.factoryUser.department;
    const modules: string[] = ['home']; // 所有人都能看到首页（但可能内容不同）

    if (department) {
      modules.push(department); // 添加所属部门模块
    }

    // 部门管理员额外权限（可以看到报表等）
    if (isDepartmentManager()) {
      modules.push('reports');
    }

    return modules;
  }

  return ['home'];
};
