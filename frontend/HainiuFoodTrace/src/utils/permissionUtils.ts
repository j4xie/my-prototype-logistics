import { 
  UserRole, 
  USER_ROLES, 
  PLATFORM_ROLES, 
  FACTORY_ROLES 
} from '../types/auth';
import { 
  ROLE_LEVELS, 
  CORE_ROLE_PERMISSIONS, 
  FULL_ROLE_PERMISSIONS,
  ROLE_DATA_ACCESS,
  DataAccessLevel 
} from '../constants/permissions';

/**
 * 权限工具函数集合
 * 提供静态权限检查和计算功能
 */
export class PermissionUtils {
  
  /**
   * 检查角色是否有指定权限
   */
  static roleHasPermission(role: UserRole, permission: string): boolean {
    // 开发者拥有所有权限
    if (role === USER_ROLES.DEVELOPER) return true;
    
    const rolePermissions = FULL_ROLE_PERMISSIONS[role] || CORE_ROLE_PERMISSIONS[role];
    return rolePermissions?.features.includes(permission) || false;
  }

  /**
   * 检查角色是否有模块访问权限
   */
  static roleHasModuleAccess(role: UserRole, module: string): boolean {
    // 开发者拥有所有模块权限
    if (role === USER_ROLES.DEVELOPER) return true;
    
    const rolePermissions = FULL_ROLE_PERMISSIONS[role] || CORE_ROLE_PERMISSIONS[role];
    return rolePermissions?.modules[module as keyof typeof rolePermissions.modules] || false;
  }

  /**
   * 比较两个角色的权限级别
   * @returns -1: role1权限更高, 0: 权限相同, 1: role2权限更高
   */
  static compareRoles(role1: UserRole, role2: UserRole): number {
    const level1 = ROLE_LEVELS[role1];
    const level2 = ROLE_LEVELS[role2];
    
    if (level1 < level2) return -1;
    if (level1 > level2) return 1;
    return 0;
  }

  /**
   * 检查role1是否比role2权限更高
   */
  static isHigherRole(role1: UserRole, role2: UserRole): boolean {
    return this.compareRoles(role1, role2) === -1;
  }

  /**
   * 检查role1是否可以管理role2
   */
  static canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    // 开发者可以管理所有角色
    if (managerRole === USER_ROLES.DEVELOPER) return true;
    
    // 平台管理员可以管理非开发者角色
    if (managerRole === USER_ROLES.PLATFORM_ADMIN) {
      return targetRole !== USER_ROLES.DEVELOPER;
    }
    
    // 工厂超级管理员可以管理工厂内角色
    if (managerRole === USER_ROLES.FACTORY_SUPER_ADMIN) {
      const factoryRoles: UserRole[] = [
        USER_ROLES.PERMISSION_ADMIN,
        USER_ROLES.DEPARTMENT_ADMIN,
        USER_ROLES.OPERATOR,
        USER_ROLES.VIEWER
      ];
      return factoryRoles.includes(targetRole);
    }
    
    // 权限管理员可以管理部门角色
    if (managerRole === USER_ROLES.PERMISSION_ADMIN) {
      const departmentRoles: UserRole[] = [
        USER_ROLES.DEPARTMENT_ADMIN,
        USER_ROLES.OPERATOR,
        USER_ROLES.VIEWER
      ];
      return departmentRoles.includes(targetRole);
    }
    
    // 部门管理员可以管理操作员和查看者
    if (managerRole === USER_ROLES.DEPARTMENT_ADMIN) {
      const managedRoles: UserRole[] = [USER_ROLES.OPERATOR, USER_ROLES.VIEWER];
      return managedRoles.includes(targetRole);
    }
    
    return false;
  }

  /**
   * 获取角色的数据访问级别
   */
  static getRoleDataAccessLevel(role: UserRole): DataAccessLevel {
    return ROLE_DATA_ACCESS[role] || 'own';
  }

  /**
   * 检查角色是否可以访问指定数据级别
   */
  static canAccessDataLevel(role: UserRole, dataLevel: DataAccessLevel): boolean {
    const roleDataLevel = this.getRoleDataAccessLevel(role);
    
    // 数据访问级别检查 (ALL > FACTORY > DEPARTMENT > OWN)
    switch (roleDataLevel) {
      case 'all':
        return true;
      case 'factory':
        return ['factory', 'department', 'own'].includes(dataLevel);
      case 'department':
        return ['department', 'own'].includes(dataLevel);
      case 'own':
        return dataLevel === 'own';
      default:
        return false;
    }
  }

  /**
   * 获取角色可以管理的子角色列表
   */
  static getManagedRoles(managerRole: UserRole): UserRole[] {
    const allRoles = Object.values(USER_ROLES) as UserRole[];
    return allRoles.filter(role => this.canManageRole(managerRole, role));
  }

  /**
   * 获取角色的显示名称
   */
  static getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<string, string> = {
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
  }

  /**
   * 获取数据访问级别的显示名称
   */
  static getDataAccessLevelDisplayName(level: DataAccessLevel): string {
    const levelNames: Record<DataAccessLevel, string> = {
      all: '全部数据',
      factory: '工厂数据',
      department: '部门数据',
      own: '个人数据'
    };
    
    return levelNames[level] || level;
  }

  /**
   * 检查权限组合是否有效
   */
  static isValidPermissionCombination(role: UserRole, permissions: string[]): boolean {
    const rolePermissions = FULL_ROLE_PERMISSIONS[role] || CORE_ROLE_PERMISSIONS[role];
    if (!rolePermissions) return false;
    
    // 检查所有权限是否都在角色权限范围内
    return permissions.every(permission => 
      rolePermissions.features.includes(permission)
    );
  }

  /**
   * 获取角色的权限摘要
   */
  static getRolePermissionSummary(role: UserRole): {
    role: UserRole;
    level: number;
    dataAccess: DataAccessLevel;
    moduleCount: number;
    featureCount: number;
    canManageRoles: UserRole[];
  } {
    const rolePermissions = FULL_ROLE_PERMISSIONS[role] || CORE_ROLE_PERMISSIONS[role];
    const moduleAccess = rolePermissions?.modules || {};
    const features = rolePermissions?.features || [];
    
    return {
      role,
      level: ROLE_LEVELS[role] || 999,
      dataAccess: this.getRoleDataAccessLevel(role),
      moduleCount: Object.values(moduleAccess).filter(Boolean).length,
      featureCount: features.length,
      canManageRoles: this.getManagedRoles(role)
    };
  }
}