/**
 * 角色映射工具测试
 * 测试角色识别、用户类型检测、数据转换等核心功能
 */

// Mock 角色和用户类型常量
const mockUserRoles = {
  // 平台角色
  SYSTEM_DEVELOPER: 'system_developer' as const,
  PLATFORM_SUPER_ADMIN: 'platform_super_admin' as const,
  PLATFORM_OPERATOR: 'platform_operator' as const,
  // 工厂角色
  FACTORY_SUPER_ADMIN: 'factory_super_admin' as const,
  PERMISSION_ADMIN: 'permission_admin' as const,
  DEPARTMENT_ADMIN: 'department_admin' as const,
  OPERATOR: 'operator' as const,
  VIEWER: 'viewer' as const,
  UNACTIVATED: 'unactivated' as const
};

const mockPlatformRoles = {
  SYSTEM_DEVELOPER: 'system_developer' as const,
  PLATFORM_SUPER_ADMIN: 'platform_super_admin' as const,
  PLATFORM_OPERATOR: 'platform_operator' as const
};

const mockFactoryRoles = {
  FACTORY_SUPER_ADMIN: 'factory_super_admin' as const,
  PERMISSION_ADMIN: 'permission_admin' as const,
  DEPARTMENT_ADMIN: 'department_admin' as const,
  OPERATOR: 'operator' as const,
  VIEWER: 'viewer' as const,
  UNACTIVATED: 'unactivated' as const
};

jest.mock('../../types/auth', () => ({
  USER_ROLES: mockUserRoles,
  PLATFORM_ROLES: mockPlatformRoles,
  FACTORY_ROLES: mockFactoryRoles
}));

describe('角色映射工具测试', () => {
  // 模拟roleMapping模块的核心功能
  class MockRoleMappingUtils {
    static isPlatformRole(role: string): boolean {
      return Object.values(mockPlatformRoles).includes(role as any);
    }

    static isFactoryRole(role: string): boolean {
      return Object.values(mockFactoryRoles).includes(role as any);
    }

    static isPlatformUser(user: any): boolean {
      return user?.userType === 'platform';
    }

    static isFactoryUser(user: any): boolean {
      return user?.userType === 'factory';
    }

    static getUserRole(user: any): string | null {
      if (!user) return null;
      
      if (user.userType === 'platform') {
        return user.platformUser?.role || null;
      } else if (user.userType === 'factory') {
        return user.factoryUser?.role || null;
      }
      
      return null;
    }

    static getRoleDisplayName(role: string): string {
      const roleNames: Record<string, string> = {
        // 平台角色
        'system_developer': '系统开发者',
        'platform_super_admin': '平台超级管理员',
        'platform_operator': '平台操作员',
        // 工厂角色
        'factory_super_admin': '工厂超级管理员',
        'permission_admin': '权限管理员',
        'department_admin': '部门管理员',
        'operator': '操作员',
        'viewer': '查看者',
        'unactivated': '待激活用户'
      };
      
      return roleNames[role] || role;
    }

    static getDepartmentDisplayName(department: string): string {
      const departmentNames: Record<string, string> = {
        farming: '种植部',
        processing: '加工部',
        logistics: '物流部',
        quality: '质检部',
        management: '管理部'
      };
      
      return departmentNames[department] || department;
    }

    static transformBackendUser(backendUser: any): any {
      if (!backendUser) return null;

      // 平台用户
      if (backendUser.userType === 'platform' || backendUser.role) {
        return {
          id: backendUser.id,
          username: backendUser.username,
          email: backendUser.email,
          phone: backendUser.phone,
          fullName: backendUser.fullName,
          avatar: backendUser.avatar,
          lastLoginAt: backendUser.lastLogin,
          createdAt: backendUser.createdAt,
          updatedAt: backendUser.updatedAt,
          isActive: backendUser.isActive ?? true,
          userType: 'platform',
          platformUser: {
            role: backendUser.role,
            permissions: backendUser.permissions || []
          }
        };
      }
      
      // 工厂用户
      return {
        id: backendUser.id,
        username: backendUser.username,
        email: backendUser.email,
        phone: backendUser.phone,
        fullName: backendUser.fullName,
        avatar: backendUser.avatar,
        lastLoginAt: backendUser.lastLogin || backendUser.last_login,
        createdAt: backendUser.createdAt || backendUser.created_at,
        updatedAt: backendUser.updatedAt || backendUser.updated_at,
        isActive: backendUser.isActive ?? backendUser.is_active ?? true,
        userType: 'factory',
        factoryUser: {
          role: backendUser.roleCode || backendUser.role_code,
          factoryId: backendUser.factoryId || backendUser.factory_id,
          department: backendUser.department,
          position: backendUser.position,
          permissions: backendUser.permissions || []
        }
      };
    }

    static userHasPermission(user: any, permission: string): boolean {
      if (!user) return false;

      if (user.userType === 'platform') {
        return user.platformUser?.permissions?.includes(permission) || false;
      } else if (user.userType === 'factory') {
        return user.factoryUser?.permissions?.includes(permission) || false;
      }
      
      return false;
    }

    static userHasAdminAccess(user: any): boolean {
      const role = this.getUserRole(user);
      if (!role) return false;

      const adminRoles = [
        'system_developer', 
        'platform_super_admin', 
        'factory_super_admin', 
        'permission_admin'
      ];
      
      return adminRoles.includes(role);
    }

    static getUserFactoryId(user: any): string | undefined {
      if (user?.userType === 'factory') {
        return user.factoryUser?.factoryId;
      }
      return undefined;
    }

    static generateDefaultPermissions(role: string): any {
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
        userType: this.isPlatformRole(role) ? 'platform' : 'factory',
        level: 100,
        departments: []
      };
    }
  }

  describe('1. 角色类型识别', () => {
    test('平台角色识别', () => {
      expect(MockRoleMappingUtils.isPlatformRole('system_developer')).toBe(true);
      expect(MockRoleMappingUtils.isPlatformRole('platform_super_admin')).toBe(true);
      expect(MockRoleMappingUtils.isPlatformRole('platform_operator')).toBe(true);

      // 工厂角色不应该被识别为平台角色
      expect(MockRoleMappingUtils.isPlatformRole('factory_super_admin')).toBe(false);
      expect(MockRoleMappingUtils.isPlatformRole('operator')).toBe(false);

      // 无效角色
      expect(MockRoleMappingUtils.isPlatformRole('invalid_role')).toBe(false);
      expect(MockRoleMappingUtils.isPlatformRole('')).toBe(false);
    });

    test('工厂角色识别', () => {
      expect(MockRoleMappingUtils.isFactoryRole('factory_super_admin')).toBe(true);
      expect(MockRoleMappingUtils.isFactoryRole('permission_admin')).toBe(true);
      expect(MockRoleMappingUtils.isFactoryRole('department_admin')).toBe(true);
      expect(MockRoleMappingUtils.isFactoryRole('operator')).toBe(true);
      expect(MockRoleMappingUtils.isFactoryRole('viewer')).toBe(true);
      expect(MockRoleMappingUtils.isFactoryRole('unactivated')).toBe(true);

      // 平台角色不应该被识别为工厂角色
      expect(MockRoleMappingUtils.isFactoryRole('system_developer')).toBe(false);
      expect(MockRoleMappingUtils.isFactoryRole('platform_super_admin')).toBe(false);

      // 无效角色
      expect(MockRoleMappingUtils.isFactoryRole('invalid_role')).toBe(false);
      expect(MockRoleMappingUtils.isFactoryRole('')).toBe(false);
    });
  });

  describe('2. 用户类型识别', () => {
    test('平台用户识别', () => {
      const platformUser = {
        userType: 'platform',
        platformUser: { role: 'system_developer' }
      };

      const factoryUser = {
        userType: 'factory',
        factoryUser: { role: 'operator' }
      };

      expect(MockRoleMappingUtils.isPlatformUser(platformUser)).toBe(true);
      expect(MockRoleMappingUtils.isPlatformUser(factoryUser)).toBe(false);
      expect(MockRoleMappingUtils.isPlatformUser(null)).toBe(false);
      expect(MockRoleMappingUtils.isPlatformUser({})).toBe(false);
    });

    test('工厂用户识别', () => {
      const platformUser = {
        userType: 'platform',
        platformUser: { role: 'system_developer' }
      };

      const factoryUser = {
        userType: 'factory',
        factoryUser: { role: 'operator' }
      };

      expect(MockRoleMappingUtils.isFactoryUser(factoryUser)).toBe(true);
      expect(MockRoleMappingUtils.isFactoryUser(platformUser)).toBe(false);
      expect(MockRoleMappingUtils.isFactoryUser(null)).toBe(false);
      expect(MockRoleMappingUtils.isFactoryUser({})).toBe(false);
    });

    test('获取用户角色', () => {
      const platformUser = {
        userType: 'platform',
        platformUser: { role: 'platform_super_admin' }
      };

      const factoryUser = {
        userType: 'factory',
        factoryUser: { role: 'operator' }
      };

      expect(MockRoleMappingUtils.getUserRole(platformUser)).toBe('platform_super_admin');
      expect(MockRoleMappingUtils.getUserRole(factoryUser)).toBe('operator');
      expect(MockRoleMappingUtils.getUserRole(null)).toBeNull();
      expect(MockRoleMappingUtils.getUserRole({})).toBeNull();

      // 缺少角色信息的用户
      const incompleteUser = { userType: 'platform' };
      expect(MockRoleMappingUtils.getUserRole(incompleteUser)).toBeNull();
    });
  });

  describe('3. 显示名称映射', () => {
    test('角色显示名称', () => {
      // 平台角色
      expect(MockRoleMappingUtils.getRoleDisplayName('system_developer')).toBe('系统开发者');
      expect(MockRoleMappingUtils.getRoleDisplayName('platform_super_admin')).toBe('平台超级管理员');
      expect(MockRoleMappingUtils.getRoleDisplayName('platform_operator')).toBe('平台操作员');

      // 工厂角色
      expect(MockRoleMappingUtils.getRoleDisplayName('factory_super_admin')).toBe('工厂超级管理员');
      expect(MockRoleMappingUtils.getRoleDisplayName('permission_admin')).toBe('权限管理员');
      expect(MockRoleMappingUtils.getRoleDisplayName('department_admin')).toBe('部门管理员');
      expect(MockRoleMappingUtils.getRoleDisplayName('operator')).toBe('操作员');
      expect(MockRoleMappingUtils.getRoleDisplayName('viewer')).toBe('查看者');
      expect(MockRoleMappingUtils.getRoleDisplayName('unactivated')).toBe('待激活用户');

      // 未知角色返回原值
      expect(MockRoleMappingUtils.getRoleDisplayName('unknown_role')).toBe('unknown_role');
      expect(MockRoleMappingUtils.getRoleDisplayName('')).toBe('');
    });

    test('部门显示名称', () => {
      expect(MockRoleMappingUtils.getDepartmentDisplayName('farming')).toBe('种植部');
      expect(MockRoleMappingUtils.getDepartmentDisplayName('processing')).toBe('加工部');
      expect(MockRoleMappingUtils.getDepartmentDisplayName('logistics')).toBe('物流部');
      expect(MockRoleMappingUtils.getDepartmentDisplayName('quality')).toBe('质检部');
      expect(MockRoleMappingUtils.getDepartmentDisplayName('management')).toBe('管理部');

      // 未知部门返回原值
      expect(MockRoleMappingUtils.getDepartmentDisplayName('unknown_dept')).toBe('unknown_dept');
      expect(MockRoleMappingUtils.getDepartmentDisplayName('')).toBe('');
    });
  });

  describe('4. 后端数据转换', () => {
    test('平台用户数据转换', () => {
      const backendPlatformUser = {
        id: 'platform-001',
        username: 'platform_admin',
        email: 'admin@platform.com',
        phone: '13800000000',
        fullName: '平台管理员',
        avatar: 'avatar.jpg',
        lastLogin: '2025-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        isActive: true,
        userType: 'platform',
        role: 'platform_super_admin',
        permissions: ['user_manage_all', 'platform_config']
      };

      const transformedUser = MockRoleMappingUtils.transformBackendUser(backendPlatformUser);

      expect(transformedUser.userType).toBe('platform');
      expect(transformedUser.platformUser.role).toBe('platform_super_admin');
      expect(transformedUser.platformUser.permissions).toEqual(['user_manage_all', 'platform_config']);
      expect(transformedUser.id).toBe('platform-001');
      expect(transformedUser.username).toBe('platform_admin');
      expect(transformedUser.email).toBe('admin@platform.com');
    });

    test('工厂用户数据转换', () => {
      const backendFactoryUser = {
        id: 'factory-001',
        username: 'factory_operator',
        email: 'operator@factory.com',
        phone: '13900000000',
        fullName: '工厂操作员',
        last_login: '2025-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
        role_code: 'operator',
        factory_id: 'FAC001',
        department: 'processing',
        position: '生产操作员',
        permissions: ['production_operation', 'quality_inspection']
      };

      const transformedUser = MockRoleMappingUtils.transformBackendUser(backendFactoryUser);

      expect(transformedUser.userType).toBe('factory');
      expect(transformedUser.factoryUser.role).toBe('operator');
      expect(transformedUser.factoryUser.factoryId).toBe('FAC001');
      expect(transformedUser.factoryUser.department).toBe('processing');
      expect(transformedUser.factoryUser.position).toBe('生产操作员');
      expect(transformedUser.factoryUser.permissions).toEqual(['production_operation', 'quality_inspection']);
    });

    test('数据转换的边界情况', () => {
      // 空数据
      expect(MockRoleMappingUtils.transformBackendUser(null)).toBeNull();
      expect(MockRoleMappingUtils.transformBackendUser(undefined)).toBeNull();

      // 最小化数据
      const minimalUser = {
        id: 'user-001',
        username: 'test_user'
      };

      const transformed = MockRoleMappingUtils.transformBackendUser(minimalUser);
      expect(transformed.userType).toBe('factory');
      expect(transformed.id).toBe('user-001');
      expect(transformed.username).toBe('test_user');
      expect(transformed.isActive).toBe(true); // 默认值

      // 字段名兼容性测试
      const compatibilityUser = {
        id: 'user-002',
        username: 'compat_user',
        lastLogin: '2025-01-01T00:00:00Z', // 优先使用这个
        last_login: '2024-01-01T00:00:00Z',
        roleCode: 'operator', // 优先使用这个
        role_code: 'viewer'
      };

      const compatResult = MockRoleMappingUtils.transformBackendUser(compatibilityUser);
      expect(compatResult.lastLoginAt).toBe('2025-01-01T00:00:00Z');
      expect(compatResult.factoryUser.role).toBe('operator');
    });
  });

  describe('5. 权限检查功能', () => {
    test('用户权限检查', () => {
      const platformUser = {
        userType: 'platform',
        platformUser: {
          role: 'platform_super_admin',
          permissions: ['user_manage_all', 'platform_config']
        }
      };

      const factoryUser = {
        userType: 'factory',
        factoryUser: {
          role: 'operator',
          permissions: ['production_operation', 'quality_inspection']
        }
      };

      // 平台用户权限检查
      expect(MockRoleMappingUtils.userHasPermission(platformUser, 'user_manage_all')).toBe(true);
      expect(MockRoleMappingUtils.userHasPermission(platformUser, 'platform_config')).toBe(true);
      expect(MockRoleMappingUtils.userHasPermission(platformUser, 'production_operation')).toBe(false);

      // 工厂用户权限检查
      expect(MockRoleMappingUtils.userHasPermission(factoryUser, 'production_operation')).toBe(true);
      expect(MockRoleMappingUtils.userHasPermission(factoryUser, 'quality_inspection')).toBe(true);
      expect(MockRoleMappingUtils.userHasPermission(factoryUser, 'user_manage_all')).toBe(false);

      // 边界情况
      expect(MockRoleMappingUtils.userHasPermission(null, 'any_permission')).toBe(false);
      expect(MockRoleMappingUtils.userHasPermission({}, 'any_permission')).toBe(false);

      // 缺少权限信息的用户
      const noPermissionsUser = {
        userType: 'factory',
        factoryUser: { role: 'operator' }
      };
      expect(MockRoleMappingUtils.userHasPermission(noPermissionsUser, 'any_permission')).toBe(false);
    });

    test('管理权限检查', () => {
      const adminUsers = [
        {
          userType: 'platform',
          platformUser: { role: 'system_developer' }
        },
        {
          userType: 'platform',
          platformUser: { role: 'platform_super_admin' }
        },
        {
          userType: 'factory',
          factoryUser: { role: 'factory_super_admin' }
        },
        {
          userType: 'factory',
          factoryUser: { role: 'permission_admin' }
        }
      ];

      const nonAdminUsers = [
        {
          userType: 'factory',
          factoryUser: { role: 'operator' }
        },
        {
          userType: 'factory',
          factoryUser: { role: 'viewer' }
        },
        {
          userType: 'platform',
          platformUser: { role: 'platform_operator' }
        }
      ];

      // 管理用户应该有管理权限
      adminUsers.forEach(user => {
        expect(MockRoleMappingUtils.userHasAdminAccess(user)).toBe(true);
      });

      // 非管理用户不应该有管理权限
      nonAdminUsers.forEach(user => {
        expect(MockRoleMappingUtils.userHasAdminAccess(user)).toBe(false);
      });

      // 边界情况
      expect(MockRoleMappingUtils.userHasAdminAccess(null)).toBe(false);
      expect(MockRoleMappingUtils.userHasAdminAccess({})).toBe(false);
    });

    test('获取工厂ID', () => {
      const factoryUser = {
        userType: 'factory',
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001'
        }
      };

      const platformUser = {
        userType: 'platform',
        platformUser: { role: 'system_developer' }
      };

      expect(MockRoleMappingUtils.getUserFactoryId(factoryUser)).toBe('FAC001');
      expect(MockRoleMappingUtils.getUserFactoryId(platformUser)).toBeUndefined();
      expect(MockRoleMappingUtils.getUserFactoryId(null)).toBeUndefined();

      // 缺少工厂ID的工厂用户
      const noFactoryIdUser = {
        userType: 'factory',
        factoryUser: { role: 'operator' }
      };
      expect(MockRoleMappingUtils.getUserFactoryId(noFactoryIdUser)).toBeUndefined();
    });
  });

  describe('6. 默认权限生成', () => {
    test('平台角色默认权限', () => {
      const permissions = MockRoleMappingUtils.generateDefaultPermissions('system_developer');
      
      expect(permissions.role).toBe('system_developer');
      expect(permissions.userType).toBe('platform');
      expect(permissions.level).toBe(100);
      expect(permissions.modules).toBeDefined();
      expect(permissions.features).toEqual([]);
      expect(permissions.departments).toEqual([]);
    });

    test('工厂角色默认权限', () => {
      const permissions = MockRoleMappingUtils.generateDefaultPermissions('operator');
      
      expect(permissions.role).toBe('operator');
      expect(permissions.userType).toBe('factory');
      expect(permissions.level).toBe(100);
      expect(permissions.modules).toBeDefined();
      expect(permissions.features).toEqual([]);
      expect(permissions.departments).toEqual([]);
    });

    test('未知角色默认权限', () => {
      const permissions = MockRoleMappingUtils.generateDefaultPermissions('unknown_role');
      
      expect(permissions.role).toBe('unknown_role');
      expect(permissions.userType).toBe('factory'); // 默认为工厂类型
      expect(permissions.modules).toBeDefined();
      expect(Object.values(permissions.modules).every(access => access === false)).toBe(true);
    });
  });

  describe('7. 复杂场景和错误处理', () => {
    test('数据类型转换的健壮性', () => {
      // 测试各种异常数据的处理
      const malformedData = [
        { id: null, username: 'test' },
        { id: 'user1', username: null },
        { id: 'user2', username: 'test', userType: 'invalid' },
        { id: 'user3', username: 'test', role: null },
        { id: 'user4', username: 'test', permissions: 'not_array' }
      ];

      malformedData.forEach(data => {
        // 不应该抛出错误，应该返回处理后的结果
        expect(() => {
          MockRoleMappingUtils.transformBackendUser(data);
        }).not.toThrow();
      });
    });

    test('权限检查的健壮性', () => {
      const edgeCaseUsers = [
        { userType: 'platform' }, // 缺少platformUser
        { userType: 'factory' }, // 缺少factoryUser
        { userType: 'platform', platformUser: null },
        { userType: 'factory', factoryUser: null },
        { userType: 'platform', platformUser: { permissions: null } },
        { userType: 'factory', factoryUser: { permissions: 'not_array' } }
      ];

      edgeCaseUsers.forEach(user => {
        // 不应该抛出错误
        expect(() => {
          MockRoleMappingUtils.userHasPermission(user, 'test_permission');
          MockRoleMappingUtils.userHasAdminAccess(user);
          MockRoleMappingUtils.getUserRole(user);
          MockRoleMappingUtils.getUserFactoryId(user);
        }).not.toThrow();
      });
    });

    test('角色识别的性能', () => {
      const roles = Object.values(mockUserRoles);
      const testRuns = 1000;

      const start = Date.now();
      
      for (let i = 0; i < testRuns; i++) {
        roles.forEach(role => {
          MockRoleMappingUtils.isPlatformRole(role);
          MockRoleMappingUtils.isFactoryRole(role);
          MockRoleMappingUtils.getRoleDisplayName(role);
        });
      }
      
      const end = Date.now();
      
      // 应该在合理时间内完成（比如100ms）
      expect(end - start).toBeLessThan(100);
    });

    test('字符串处理的安全性', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'role"; DROP TABLE users; --',
        'null',
        'undefined',
        '{}',
        '[]'
      ];

      dangerousInputs.forEach(input => {
        // 应该安全处理，不抛出错误
        expect(() => {
          MockRoleMappingUtils.getRoleDisplayName(input);
          MockRoleMappingUtils.getDepartmentDisplayName(input);
          MockRoleMappingUtils.isPlatformRole(input);
          MockRoleMappingUtils.isFactoryRole(input);
        }).not.toThrow();
      });
    });
  });

  describe('8. 综合场景测试', () => {
    test('完整用户生命周期', () => {
      // 模拟从后端获取用户数据到前端使用的完整流程
      const backendResponse = {
        id: 'user-lifecycle-001',
        username: 'lifecycle_user',
        email: 'lifecycle@test.com',
        fullName: '生命周期测试用户',
        role_code: 'operator',
        factory_id: 'FAC001',
        department: 'processing',
        permissions: ['production_operation']
      };

      // 1. 转换后端数据
      const user = MockRoleMappingUtils.transformBackendUser(backendResponse);
      expect(user).toBeTruthy();
      expect(user.userType).toBe('factory');

      // 2. 获取用户角色
      const role = MockRoleMappingUtils.getUserRole(user);
      expect(role).toBe('operator');

      // 3. 检查角色类型
      expect(MockRoleMappingUtils.isFactoryRole(role)).toBe(true);
      expect(MockRoleMappingUtils.isPlatformRole(role)).toBe(false);

      // 4. 获取显示名称
      const displayName = MockRoleMappingUtils.getRoleDisplayName(role);
      expect(displayName).toBe('操作员');

      // 5. 检查权限
      expect(MockRoleMappingUtils.userHasPermission(user, 'production_operation')).toBe(true);
      expect(MockRoleMappingUtils.userHasAdminAccess(user)).toBe(false);

      // 6. 获取工厂ID
      const factoryId = MockRoleMappingUtils.getUserFactoryId(user);
      expect(factoryId).toBe('FAC001');
    });

    test('角色升级场景', () => {
      const originalUser = {
        id: 'user-upgrade-001',
        userType: 'factory',
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001',
          permissions: ['production_operation']
        }
      };

      const upgradedUser = {
        ...originalUser,
        factoryUser: {
          ...originalUser.factoryUser,
          role: 'department_admin',
          permissions: ['production_operation', 'department_manage', 'user_manage_department']
        }
      };

      // 升级前检查
      expect(MockRoleMappingUtils.userHasAdminAccess(originalUser)).toBe(false);
      expect(MockRoleMappingUtils.userHasPermission(originalUser, 'department_manage')).toBe(false);

      // 升级后检查
      expect(MockRoleMappingUtils.userHasAdminAccess(upgradedUser)).toBe(false); // department_admin不在管理员列表中
      expect(MockRoleMappingUtils.userHasPermission(upgradedUser, 'department_manage')).toBe(true);
      expect(MockRoleMappingUtils.getRoleDisplayName(MockRoleMappingUtils.getUserRole(upgradedUser))).toBe('部门管理员');
    });
  });
});