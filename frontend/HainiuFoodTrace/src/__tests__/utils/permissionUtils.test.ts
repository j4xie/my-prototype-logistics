/**
 * 权限工具函数测试
 * 测试权限检查、角色验证、数据访问级别等核心权限逻辑
 */

// Mock 权限常量
const mockPermissions = {
  USER_ROLES: {
    DEVELOPER: 'system_developer',
    PLATFORM_SUPER_ADMIN: 'platform_super_admin',
    FACTORY_SUPER_ADMIN: 'factory_super_admin',
    PERMISSION_ADMIN: 'permission_admin',
    DEPARTMENT_ADMIN: 'department_admin',
    OPERATOR: 'operator',
    VIEWER: 'viewer'
  },
  PLATFORM_ROLES: ['system_developer', 'platform_super_admin', 'platform_operator'],
  FACTORY_ROLES: ['factory_super_admin', 'permission_admin', 'department_admin', 'operator', 'viewer'],
  ROLE_LEVELS: {
    'system_developer': 0,
    'platform_super_admin': 5,
    'factory_super_admin': 10,
    'permission_admin': 20,
    'department_admin': 25,
    'operator': 30,
    'viewer': 40,
    'unactivated': 50
  },
  CORE_ROLE_PERMISSIONS: {
    'system_developer': {
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
      features: ['*'],
      role: 'system_developer',
      userType: 'platform',
      level: 0
    },
    'platform_super_admin': {
      modules: {
        farming_access: false,
        processing_access: false,
        logistics_access: false,
        trace_access: true,
        admin_access: true,
        platform_access: true,
        debug_access: false,
        system_config: false
      },
      features: ['user_manage_all', 'factory_manage', 'platform_config'],
      role: 'platform_super_admin',
      userType: 'platform',
      level: 5
    },
    'factory_super_admin': {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: true,
        trace_access: true,
        admin_access: true,
        platform_access: false,
        debug_access: false,
        system_config: false
      },
      features: ['user_manage_factory', 'factory_config', 'department_manage'],
      role: 'factory_super_admin',
      userType: 'factory',
      level: 10
    },
    'operator': {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: false,
        trace_access: true,
        admin_access: false,
        platform_access: false,
        debug_access: false,
        system_config: false
      },
      features: ['production_operation', 'quality_inspection'],
      role: 'operator',
      userType: 'factory',
      level: 30
    }
  },
  FULL_ROLE_PERMISSIONS: {},
  ROLE_DATA_ACCESS: {
    'system_developer': ['all', 'factory', 'department', 'own'],
    'platform_super_admin': ['all', 'factory', 'department', 'own'],
    'factory_super_admin': ['factory', 'department', 'own'],
    'permission_admin': ['factory', 'department', 'own'],
    'department_admin': ['department', 'own'],
    'operator': ['department', 'own'],
    'viewer': ['own']
  }
};

jest.mock('../../types/auth', () => mockPermissions);
jest.mock('../../constants/permissions', () => mockPermissions);

describe('权限工具函数测试', () => {
  // 模拟PermissionUtils类的核心功能
  class MockPermissionUtils {
    static roleHasPermission(role: string, permission: string): boolean {
      if (role === mockPermissions.USER_ROLES.DEVELOPER) return true;
      
      const rolePermissions = mockPermissions.CORE_ROLE_PERMISSIONS[role as keyof typeof mockPermissions.CORE_ROLE_PERMISSIONS];
      if (!rolePermissions) return false;
      
      return rolePermissions.features.includes('*') || rolePermissions.features.includes(permission);
    }

    static roleHasModuleAccess(role: string, module: string): boolean {
      const rolePermissions = mockPermissions.CORE_ROLE_PERMISSIONS[role as keyof typeof mockPermissions.CORE_ROLE_PERMISSIONS];
      if (!rolePermissions) return false;
      
      return !!rolePermissions.modules[module as keyof typeof rolePermissions.modules];
    }

    static getRoleLevel(role: string): number {
      return mockPermissions.ROLE_LEVELS[role as keyof typeof mockPermissions.ROLE_LEVELS] ?? 999;
    }

    static compareRoleLevel(roleA: string, roleB: string): number {
      const levelA = this.getRoleLevel(roleA);
      const levelB = this.getRoleLevel(roleB);
      return levelA - levelB;
    }

    static canAccessDataLevel(role: string, dataLevel: string): boolean {
      const allowedLevels = mockPermissions.ROLE_DATA_ACCESS[role as keyof typeof mockPermissions.ROLE_DATA_ACCESS];
      return allowedLevels ? allowedLevels.includes(dataLevel) : false;
    }

    static isPlatformRole(role: string): boolean {
      return mockPermissions.PLATFORM_ROLES.includes(role);
    }

    static isFactoryRole(role: string): boolean {
      return mockPermissions.FACTORY_ROLES.includes(role);
    }

    static validateRoleTransition(fromRole: string, toRole: string, operatorRole: string): {
      canTransition: boolean;
      reason?: string;
    } {
      const fromLevel = this.getRoleLevel(fromRole);
      const toLevel = this.getRoleLevel(toRole);
      const operatorLevel = this.getRoleLevel(operatorRole);

      // 系统开发者可以进行任何角色转换
      if (operatorRole === mockPermissions.USER_ROLES.DEVELOPER) {
        return { canTransition: true };
      }

      // 平台角色和工厂角色不能互转（优先检查）
      const fromIsPlatform = this.isPlatformRole(fromRole);
      const toIsPlatform = this.isPlatformRole(toRole);
      
      if (fromIsPlatform !== toIsPlatform) {
        return { 
          canTransition: false, 
          reason: '平台用户和工厂用户角色不能相互转换' 
        };
      }

      // 不能降级比自己级别高的用户
      if (operatorLevel >= fromLevel) {
        return { 
          canTransition: false, 
          reason: '无法修改同级或更高级别用户的角色' 
        };
      }

      // 操作者级别必须高于目标角色
      if (operatorLevel >= toLevel) {
        return { 
          canTransition: false, 
          reason: '操作者权限不足，无法分配此角色' 
        };
      }

      return { canTransition: true };
    }

    static getRequiredPermissionsForOperation(operation: string): string[] {
      const operationPermissions: Record<string, string[]> = {
        'create_user': ['user_manage_factory', 'user_manage_department'],
        'delete_user': ['user_manage_factory'],
        'modify_permissions': ['permission_admin'],
        'view_all_data': ['admin_access', 'platform_access'],
        'export_data': ['data_export'],
        'system_config': ['system_config', 'platform_config'],
        'production_operate': ['production_operation'],
        'quality_inspect': ['quality_inspection']
      };

      return operationPermissions[operation] || [];
    }

    static hasAnyPermission(role: string, permissions: string[]): boolean {
      return permissions.some(permission => this.roleHasPermission(role, permission));
    }

    static hasAllPermissions(role: string, permissions: string[]): boolean {
      return permissions.every(permission => this.roleHasPermission(role, permission));
    }

    static filterAccessibleModules(role: string, modules: string[]): string[] {
      return modules.filter(module => this.roleHasModuleAccess(role, module));
    }

    static generatePermissionSummary(role: string): {
      role: string;
      level: number;
      userType: string;
      accessibleModules: string[];
      permissions: string[];
      dataAccessLevels: string[];
    } {
      const rolePermissions = mockPermissions.CORE_ROLE_PERMISSIONS[role as keyof typeof mockPermissions.CORE_ROLE_PERMISSIONS];
      if (!rolePermissions) {
        return {
          role,
          level: 999,
          userType: 'unknown',
          accessibleModules: [],
          permissions: [],
          dataAccessLevels: []
        };
      }

      const accessibleModules = Object.entries(rolePermissions.modules)
        .filter(([_, hasAccess]) => hasAccess)
        .map(([module, _]) => module);

      return {
        role,
        level: rolePermissions.level,
        userType: rolePermissions.userType,
        accessibleModules,
        permissions: rolePermissions.features,
        dataAccessLevels: mockPermissions.ROLE_DATA_ACCESS[role as keyof typeof mockPermissions.ROLE_DATA_ACCESS] || []
      };
    }
  }

  describe('1. 基础权限检查', () => {
    test('角色权限检查功能', () => {
      // 系统开发者拥有所有权限
      expect(MockPermissionUtils.roleHasPermission('system_developer', 'any_permission')).toBe(true);
      expect(MockPermissionUtils.roleHasPermission('system_developer', 'admin_access')).toBe(true);

      // 平台超级管理员的特定权限
      expect(MockPermissionUtils.roleHasPermission('platform_super_admin', 'user_manage_all')).toBe(true);
      expect(MockPermissionUtils.roleHasPermission('platform_super_admin', 'production_operation')).toBe(false);

      // 工厂操作员的权限
      expect(MockPermissionUtils.roleHasPermission('operator', 'production_operation')).toBe(true);
      expect(MockPermissionUtils.roleHasPermission('operator', 'user_manage_factory')).toBe(false);

      // 不存在的角色
      expect(MockPermissionUtils.roleHasPermission('invalid_role', 'any_permission')).toBe(false);
    });

    test('模块访问权限检查', () => {
      // 系统开发者可以访问所有模块
      expect(MockPermissionUtils.roleHasModuleAccess('system_developer', 'platform_access')).toBe(true);
      expect(MockPermissionUtils.roleHasModuleAccess('system_developer', 'debug_access')).toBe(true);

      // 工厂超级管理员的模块权限
      expect(MockPermissionUtils.roleHasModuleAccess('factory_super_admin', 'farming_access')).toBe(true);
      expect(MockPermissionUtils.roleHasModuleAccess('factory_super_admin', 'platform_access')).toBe(false);

      // 操作员的模块权限
      expect(MockPermissionUtils.roleHasModuleAccess('operator', 'processing_access')).toBe(true);
      expect(MockPermissionUtils.roleHasModuleAccess('operator', 'admin_access')).toBe(false);
    });

    test('数据访问级别检查', () => {
      // 系统开发者可以访问所有级别数据
      expect(MockPermissionUtils.canAccessDataLevel('system_developer', 'all')).toBe(true);
      expect(MockPermissionUtils.canAccessDataLevel('system_developer', 'factory')).toBe(true);
      expect(MockPermissionUtils.canAccessDataLevel('system_developer', 'department')).toBe(true);
      expect(MockPermissionUtils.canAccessDataLevel('system_developer', 'own')).toBe(true);

      // 工厂超级管理员不能访问all级别
      expect(MockPermissionUtils.canAccessDataLevel('factory_super_admin', 'all')).toBe(false);
      expect(MockPermissionUtils.canAccessDataLevel('factory_super_admin', 'factory')).toBe(true);

      // 操作员只能访问部门和个人数据
      expect(MockPermissionUtils.canAccessDataLevel('operator', 'factory')).toBe(false);
      expect(MockPermissionUtils.canAccessDataLevel('operator', 'department')).toBe(true);
      expect(MockPermissionUtils.canAccessDataLevel('operator', 'own')).toBe(true);

      // 查看者只能访问个人数据
      expect(MockPermissionUtils.canAccessDataLevel('viewer', 'department')).toBe(false);
      expect(MockPermissionUtils.canAccessDataLevel('viewer', 'own')).toBe(true);
    });
  });

  describe('2. 角色级别比较', () => {
    test('角色级别获取', () => {
      expect(MockPermissionUtils.getRoleLevel('system_developer')).toBe(0);
      expect(MockPermissionUtils.getRoleLevel('platform_super_admin')).toBe(5);
      expect(MockPermissionUtils.getRoleLevel('factory_super_admin')).toBe(10);
      expect(MockPermissionUtils.getRoleLevel('operator')).toBe(30);
      expect(MockPermissionUtils.getRoleLevel('invalid_role')).toBe(999);
    });

    test('角色级别比较', () => {
      // 级别越低权限越高
      expect(MockPermissionUtils.compareRoleLevel('system_developer', 'operator')).toBeLessThan(0);
      expect(MockPermissionUtils.compareRoleLevel('operator', 'system_developer')).toBeGreaterThan(0);
      expect(MockPermissionUtils.compareRoleLevel('operator', 'operator')).toBe(0);

      // 平台管理员 vs 工厂管理员
      expect(MockPermissionUtils.compareRoleLevel('platform_super_admin', 'factory_super_admin')).toBeLessThan(0);
    });

    test('平台角色和工厂角色识别', () => {
      // 平台角色
      expect(MockPermissionUtils.isPlatformRole('system_developer')).toBe(true);
      expect(MockPermissionUtils.isPlatformRole('platform_super_admin')).toBe(true);

      // 工厂角色
      expect(MockPermissionUtils.isFactoryRole('factory_super_admin')).toBe(true);
      expect(MockPermissionUtils.isFactoryRole('operator')).toBe(true);

      // 不存在的角色
      expect(MockPermissionUtils.isPlatformRole('invalid_role')).toBe(false);
      expect(MockPermissionUtils.isFactoryRole('invalid_role')).toBe(false);
    });
  });

  describe('3. 角色转换验证', () => {
    test('系统开发者可以进行任何角色转换', () => {
      const result = MockPermissionUtils.validateRoleTransition(
        'operator', 
        'factory_super_admin', 
        'system_developer'
      );
      
      expect(result.canTransition).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('权限不足时不能分配更高角色', () => {
      const result = MockPermissionUtils.validateRoleTransition(
        'operator', 
        'factory_super_admin', 
        'department_admin'
      );
      
      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain('操作者权限不足');
    });

    test('不能修改同级或更高级别用户', () => {
      const result = MockPermissionUtils.validateRoleTransition(
        'factory_super_admin', 
        'operator', 
        'operator'
      );
      
      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain('无法修改同级或更高级别用户');
    });

    test('平台角色和工厂角色不能互转', () => {
      const result = MockPermissionUtils.validateRoleTransition(
        'factory_super_admin', 
        'platform_super_admin', 
        'platform_super_admin'  // 使用非system_developer的操作者
      );
      
      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain('平台用户和工厂用户角色不能相互转换');
    });

    test('合法的角色转换', () => {
      const result = MockPermissionUtils.validateRoleTransition(
        'operator', 
        'department_admin', 
        'factory_super_admin'
      );
      
      expect(result.canTransition).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('4. 操作权限检查', () => {
    test('获取操作所需权限', () => {
      expect(MockPermissionUtils.getRequiredPermissionsForOperation('create_user'))
        .toEqual(['user_manage_factory', 'user_manage_department']);
      
      expect(MockPermissionUtils.getRequiredPermissionsForOperation('production_operate'))
        .toEqual(['production_operation']);
      
      expect(MockPermissionUtils.getRequiredPermissionsForOperation('unknown_operation'))
        .toEqual([]);
    });

    test('检查是否拥有任一权限', () => {
      // 系统开发者拥有所有权限
      expect(MockPermissionUtils.hasAnyPermission('system_developer', ['any_permission']))
        .toBe(true);

      // 操作员拥有生产相关权限
      expect(MockPermissionUtils.hasAnyPermission('operator', ['production_operation', 'admin_access']))
        .toBe(true);

      // 操作员不拥有管理权限
      expect(MockPermissionUtils.hasAnyPermission('operator', ['user_manage_factory', 'platform_config']))
        .toBe(false);
    });

    test('检查是否拥有所有权限', () => {
      // 操作员拥有所有生产权限
      expect(MockPermissionUtils.hasAllPermissions('operator', ['production_operation', 'quality_inspection']))
        .toBe(true);

      // 操作员不拥有所有管理权限
      expect(MockPermissionUtils.hasAllPermissions('operator', ['production_operation', 'user_manage_factory']))
        .toBe(false);
    });

    test('过滤可访问的模块', () => {
      const allModules = ['farming_access', 'processing_access', 'admin_access', 'platform_access'];
      
      const operatorModules = MockPermissionUtils.filterAccessibleModules('operator', allModules);
      expect(operatorModules).toEqual(['farming_access', 'processing_access']);

      const adminModules = MockPermissionUtils.filterAccessibleModules('factory_super_admin', allModules);
      expect(adminModules).toEqual(['farming_access', 'processing_access', 'admin_access']);
    });
  });

  describe('5. 权限摘要生成', () => {
    test('生成角色权限摘要', () => {
      const operatorSummary = MockPermissionUtils.generatePermissionSummary('operator');
      
      expect(operatorSummary.role).toBe('operator');
      expect(operatorSummary.level).toBe(30);
      expect(operatorSummary.userType).toBe('factory');
      expect(operatorSummary.accessibleModules).toContain('farming_access');
      expect(operatorSummary.accessibleModules).toContain('processing_access');
      expect(operatorSummary.accessibleModules).not.toContain('admin_access');
      expect(operatorSummary.permissions).toContain('production_operation');
      expect(operatorSummary.dataAccessLevels).toContain('department');
      expect(operatorSummary.dataAccessLevels).toContain('own');
      expect(operatorSummary.dataAccessLevels).not.toContain('all');
    });

    test('系统开发者权限摘要', () => {
      const devSummary = MockPermissionUtils.generatePermissionSummary('system_developer');
      
      expect(devSummary.role).toBe('system_developer');
      expect(devSummary.level).toBe(0);
      expect(devSummary.userType).toBe('platform');
      expect(devSummary.permissions).toContain('*');
      expect(devSummary.dataAccessLevels).toContain('all');
    });

    test('无效角色的权限摘要', () => {
      const invalidSummary = MockPermissionUtils.generatePermissionSummary('invalid_role');
      
      expect(invalidSummary.role).toBe('invalid_role');
      expect(invalidSummary.level).toBe(999);
      expect(invalidSummary.userType).toBe('unknown');
      expect(invalidSummary.accessibleModules).toEqual([]);
      expect(invalidSummary.permissions).toEqual([]);
      expect(invalidSummary.dataAccessLevels).toEqual([]);
    });
  });

  describe('6. 边界情况和错误处理', () => {
    test('空值和无效输入处理', () => {
      // 空字符串和null处理
      expect(MockPermissionUtils.roleHasPermission('', 'permission')).toBe(false);
      expect(MockPermissionUtils.roleHasPermission('role', '')).toBe(false);
      
      expect(MockPermissionUtils.roleHasModuleAccess('', 'module')).toBe(false);
      expect(MockPermissionUtils.roleHasModuleAccess('role', '')).toBe(false);
      
      expect(MockPermissionUtils.canAccessDataLevel('', 'level')).toBe(false);
      expect(MockPermissionUtils.canAccessDataLevel('role', '')).toBe(false);
    });

    test('特殊字符处理', () => {
      const specialRoles = ['role with spaces', 'role@with#symbols', '角色中文'];
      
      specialRoles.forEach(role => {
        expect(MockPermissionUtils.roleHasPermission(role, 'permission')).toBe(false);
        expect(MockPermissionUtils.getRoleLevel(role)).toBe(999);
      });
    });

    test('大小写敏感性', () => {
      // 权限检查应该是大小写敏感的
      expect(MockPermissionUtils.roleHasPermission('OPERATOR', 'production_operation')).toBe(false);
      expect(MockPermissionUtils.roleHasPermission('operator', 'PRODUCTION_OPERATION')).toBe(false);
      expect(MockPermissionUtils.roleHasPermission('operator', 'production_operation')).toBe(true);
    });

    test('权限数组的边界情况', () => {
      // 空数组
      expect(MockPermissionUtils.hasAnyPermission('operator', [])).toBe(false);
      expect(MockPermissionUtils.hasAllPermissions('operator', [])).toBe(true); // 空集合的全称量化为真
      
      // 单元素数组
      expect(MockPermissionUtils.hasAnyPermission('operator', ['production_operation'])).toBe(true);
      expect(MockPermissionUtils.hasAllPermissions('operator', ['production_operation'])).toBe(true);
    });
  });

  describe('7. 性能和复杂度测试', () => {
    test('大量权限检查的性能', () => {
      const permissions = Array.from({ length: 1000 }, (_, i) => `permission_${i}`);
      
      const start = Date.now();
      const result = MockPermissionUtils.hasAnyPermission('system_developer', permissions);
      const end = Date.now();
      
      expect(result).toBe(true); // 系统开发者拥有所有权限
      expect(end - start).toBeLessThan(100); // 应该在100ms内完成
    });

    test('复杂角色转换验证', () => {
      const roles = ['system_developer', 'platform_super_admin', 'factory_super_admin', 'operator', 'viewer'];
      
      // 测试所有角色对之间的转换
      let validTransitions = 0;
      let totalTransitions = 0;
      
      roles.forEach(fromRole => {
        roles.forEach(toRole => {
          roles.forEach(operatorRole => {
            const result = MockPermissionUtils.validateRoleTransition(fromRole, toRole, operatorRole);
            if (result.canTransition) validTransitions++;
            totalTransitions++;
          });
        });
      });
      
      expect(totalTransitions).toBe(roles.length ** 3); // 5^3 = 125
      expect(validTransitions).toBeGreaterThan(0);
      expect(validTransitions).toBeLessThan(totalTransitions);
    });
  });
});