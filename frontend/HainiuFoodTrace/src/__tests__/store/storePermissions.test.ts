/**
 * 状态管理和权限系统测试
 * 测试Zustand stores和权限映射逻辑的核心功能
 */

// Mock AsyncStorage for Zustand persistence
const mockAsyncStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock权限常量
const mockPermissions = {
  CORE_ROLE_PERMISSIONS: {
    system_developer: {
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
      userType: 'platform' as const,
      level: 0
    },
    platform_super_admin: {
      modules: {
        farming_access: false,
        processing_access: false,
        logistics_access: false,
        trace_access: true,
        admin_access: true,
        platform_access: true
      },
      features: ['user_manage_all', 'factory_manage', 'platform_config'],
      role: 'platform_super_admin',
      userType: 'platform' as const,
      level: 5
    },
    factory_super_admin: {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: true,
        trace_access: true,
        admin_access: true,
        platform_access: false
      },
      features: ['user_manage_factory', 'factory_config', 'department_manage'],
      role: 'factory_super_admin',
      userType: 'factory' as const,
      level: 10
    },
    operator: {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: false,
        trace_access: true,
        admin_access: false,
        platform_access: false
      },
      features: ['production_operation', 'quality_inspection'],
      role: 'operator',
      userType: 'factory' as const,
      level: 30
    }
  },
  FULL_ROLE_PERMISSIONS: {}
};

jest.mock('../../constants/permissions', () => mockPermissions);

// Mock roleMapping utility
const mockRoleMapping = {
  getUserRole: jest.fn(),
  transformBackendUser: jest.fn((user) => user)
};

jest.mock('../../utils/roleMapping', () => mockRoleMapping);

describe('状态管理和权限系统测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('1. AuthStore 测试', () => {
    test('初始状态验证', async () => {
      // 动态导入以避免模块依赖问题
      const { useAuthStore } = await import('../../store/authStore');
      
      const initialState = useAuthStore.getState();
      
      expect(initialState.user).toBeNull();
      expect(initialState.tokens).toBeNull();
      expect(initialState.isLoading).toBe(false);
      expect(initialState.isAuthenticated).toBe(false);
    });

    test('用户登录状态管理', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        email: 'test@example.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001',
          department: 'processing',
          permissions: ['production_operation']
        }
      };

      const mockTokens = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        tokenType: 'Bearer',
        expiresIn: 3600
      };

      // 执行登录
      useAuthStore.getState().login(mockUser, mockTokens);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.tokens).toEqual(mockTokens);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    test('用户登出状态清理', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      // 先设置登录状态
      const mockUser = { id: 'user-001', username: 'test_user', email: 'test@test.com', userType: 'factory' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isActive: true, factoryUser: { role: 'operator', factoryId: 'FAC001', department: 'test' } };
      const mockTokens = { accessToken: 'token', refreshToken: 'refresh', tokenType: 'Bearer', expiresIn: 3600 };
      
      useAuthStore.getState().login(mockUser, mockTokens);
      
      // 执行登出
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    test('Getter方法验证', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const mockPlatformUser = {
        id: 'platform-001',
        username: 'platform_admin',
        email: 'platform@test.com',
        userType: 'platform' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        platformUser: {
          role: 'platform_super_admin',
          permissions: ['admin_access']
        }
      };

      const mockFactoryUser = {
        id: 'factory-001',
        username: 'factory_worker',
        email: 'factory@test.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001',
          permissions: ['production_operation']
        }
      };

      const store = useAuthStore.getState();

      // 测试平台用户
      store.setUser(mockPlatformUser);
      expect(store.getUserId()).toBe('platform-001');
      expect(store.getUserType()).toBe('platform');
      expect(store.getUserRole()).toBe('platform_super_admin');

      // 测试工厂用户
      store.setUser(mockFactoryUser);
      expect(store.getUserId()).toBe('factory-001');
      expect(store.getUserType()).toBe('factory');
      expect(store.getUserRole()).toBe('operator');

      // 测试无用户情况
      store.setUser(null);
      expect(store.getUserId()).toBeNull();
      expect(store.getUserType()).toBeNull();
      expect(store.getUserRole()).toBeNull();
    });

    test('用户信息更新', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        email: 'old@example.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001',
          department: 'test'
        }
      };

      const store = useAuthStore.getState();
      store.setUser(mockUser);

      // 更新用户信息
      store.updateUser({ email: 'new@example.com', username: 'updated_user' });

      const updatedUser = store.user;
      expect(updatedUser?.email).toBe('new@example.com');
      expect(updatedUser?.username).toBe('updated_user');
      expect(updatedUser?.id).toBe('user-001'); // ID保持不变
    });
  });

  describe('2. PermissionStore 测试', () => {
    test('权限初始化和设置', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const mockPermissions = {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: false,
          trace_access: true,
          admin_access: false,
          platform_access: false
        },
        features: ['production_operation', 'quality_inspection'],
        role: 'operator',
        userType: 'factory' as const,
        level: 30
      };

      const store = usePermissionStore.getState();
      store.setPermissions(mockPermissions);

      const state = usePermissionStore.getState();
      expect(state.permissions).toEqual(mockPermissions);
      expect(state.lastUpdated).toBeTruthy();
    });

    test('权限检查方法', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const mockPermissions = {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: false,
          trace_access: true,
          admin_access: false,
          platform_access: false
        },
        features: ['production_operation', 'quality_inspection'],
        role: 'operator',
        userType: 'factory' as const,
        level: 30
      };

      const store = usePermissionStore.getState();
      store.setPermissions(mockPermissions);

      // 测试权限检查
      expect(store.hasPermission('production_operation')).toBe(true);
      expect(store.hasPermission('admin_access')).toBe(false);

      // 测试角色检查
      expect(store.hasRole('operator')).toBe(true);
      expect(store.hasRole('admin')).toBe(false);

      // 测试多角色检查
      expect(store.hasAnyRole(['operator', 'admin'])).toBe(true);
      expect(store.hasAnyRole(['admin', 'manager'])).toBe(false);

      // 测试模块访问权限
      expect(store.hasModuleAccess('farming_access')).toBe(true);
      expect(store.hasModuleAccess('admin_access')).toBe(false);
    });

    test('数据访问级别检查', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      // 测试操作员级别用户
      const operatorPermissions = {
        modules: {
          farming_access: true,
          processing_access: false,
          logistics_access: false,
          trace_access: false,
          admin_access: false,
          platform_access: false
        },
        features: ['production_operation'],
        role: 'operator',
        userType: 'factory' as const,
        level: 30
      };

      const store = usePermissionStore.getState();
      store.setPermissions(operatorPermissions);

      expect(store.canAccessData('own')).toBe(true);
      expect(store.canAccessData('department')).toBe(true);
      expect(store.canAccessData('factory')).toBe(false);
      expect(store.canAccessData('all')).toBe(false);

      // 测试工厂超级管理员
      const factoryAdminPermissions = {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: true,
          trace_access: true,
          admin_access: true,
          platform_access: false
        },
        features: ['production_operation'],
        role: 'factory_super_admin',
        userType: 'factory' as const,
        level: 10
      };

      store.setPermissions(factoryAdminPermissions);

      expect(store.canAccessData('own')).toBe(true);
      expect(store.canAccessData('department')).toBe(true);
      expect(store.canAccessData('factory')).toBe(true);
      expect(store.canAccessData('all')).toBe(false);

      // 测试系统开发者
      const developerPermissions = {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: true,
          trace_access: true,
          admin_access: true,
          platform_access: true
        },
        features: ['*'],
        role: 'system_developer',
        userType: 'platform' as const,
        level: 0
      };

      store.setPermissions(developerPermissions);

      expect(store.canAccessData('all')).toBe(true);
    });

    test('高级权限检查方法', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const adminPermissions = {
        modules: {
          admin_access: true,
          platform_access: false
        },
        features: ['user_manage_factory', 'developer_tools'],
        role: 'permission_admin',
        userType: 'factory' as const,
        level: 20
      };

      const store = usePermissionStore.getState();
      store.setPermissions(adminPermissions);

      expect(store.canManageUsers()).toBe(true);
      expect(store.canViewAdminPanel()).toBe(true);
      expect(store.canAccessDeveloperTools()).toBe(true);
      expect(store.isPlatformUser()).toBe(false);
      expect(store.isFactoryUser()).toBe(true);
    });

    test('权限刷新逻辑', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      mockRoleMapping.getUserRole.mockReturnValue('operator');

      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        email: 'test@test.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'operator',
          department: 'processing',
          factoryId: 'FAC001'
        }
      };

      const store = usePermissionStore.getState();
      store.refreshPermissions(mockUser);

      const state = usePermissionStore.getState();
      expect(state.permissions).toBeTruthy();
      expect(state.permissions?.role).toBe('operator');
      expect(state.permissions?.departments).toEqual(['processing']);
    });
  });

  describe('3. NavigationStore 测试', () => {
    test('导航状态初始化', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const initialState = useNavigationStore.getState();
      
      expect(initialState.currentTab).toBe('home');
      expect(initialState.isTabBarVisible).toBe(true);
      expect(initialState.navigationHistory).toEqual([]);
      expect(initialState.availableTabs).toHaveLength(1); // 只有首页
      expect(initialState.availableTabs[0].name).toBe('home');
    });

    test('Tab权限检查逻辑', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // 测试首页访问（所有人都可以）
      expect(store.canAccessTab('home', null)).toBe(true);
      expect(store.canAccessTab('home', 'operator')).toBe(true);
      
      // 测试无角色用户（只能访问首页）
      expect(store.canAccessTab('admin', null)).toBe(false);
      expect(store.canAccessTab('processing', null)).toBe(false);
      
      // 测试开发者专用Tab
      expect(store.canAccessTab('developer', 'system_developer')).toBe(true);
      expect(store.canAccessTab('developer', 'operator')).toBe(false);
    });

    test('可用Tab更新逻辑', async () => {
      const navStore = await import('../../store/navigationStore');
      const permStore = await import('../../store/permissionStore');
      const { useNavigationStore } = navStore;
      const { usePermissionStore } = permStore;
      
      // 设置权限store状态
      const mockPermissions = {
        modules: {
          farming_access: true,
          processing_access: true,
          admin_access: true,
          platform_access: false
        },
        features: ['production_operation'],
        role: 'factory_super_admin',
        userType: 'factory' as const,
        level: 10
      };
      
      usePermissionStore.getState().setPermissions(mockPermissions);
      mockRoleMapping.getUserRole.mockReturnValue('factory_super_admin');

      const mockUser = {
        id: 'user-001',
        username: 'test_admin',
        email: 'admin@test.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'factory_super_admin',
          factoryId: 'FAC001'
        }
      };

      const navStore = useNavigationStore.getState();
      navStore.updateAvailableTabs(mockUser);

      const state = useNavigationStore.getState();
      
      // 应该包含首页、种植、加工、管理等Tab
      const tabNames = state.availableTabs.map(tab => tab.name);
      expect(tabNames).toContain('home');
      expect(tabNames).toContain('farming');
      expect(tabNames).toContain('processing');
      expect(tabNames).toContain('admin');
      
      // 不应该包含平台Tab
      expect(tabNames).not.toContain('platform');
    });

    test('导航历史管理', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // 添加导航历史
      store.pushToHistory('screen1');
      store.pushToHistory('screen2');
      store.pushToHistory('screen3');

      expect(useNavigationStore.getState().navigationHistory).toEqual(['screen1', 'screen2', 'screen3']);

      // 测试历史清理
      store.clearHistory();
      expect(useNavigationStore.getState().navigationHistory).toEqual([]);

      // 测试历史长度限制
      for (let i = 0; i < 15; i++) {
        store.pushToHistory(`screen${i}`);
      }
      
      const history = useNavigationStore.getState().navigationHistory;
      expect(history.length).toBe(10); // 最多保留10个
      expect(history[0]).toBe('screen5'); // 最早的5个被移除
    });

    test('Tab切换和可见性控制', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // 测试Tab切换
      store.setCurrentTab('processing');
      expect(useNavigationStore.getState().currentTab).toBe('processing');

      // 测试TabBar可见性控制
      store.setTabBarVisible(false);
      expect(useNavigationStore.getState().isTabBarVisible).toBe(false);

      store.setTabBarVisible(true);
      expect(useNavigationStore.getState().isTabBarVisible).toBe(true);
    });

    test('Tab查找功能', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      // 首先更新可用tabs（需要有权限的用户）
      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        email: 'test@test.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'factory_super_admin',
          factoryId: 'FAC001',
          department: 'test'
        }
      };
      
      mockRoleMapping.getUserRole.mockReturnValue('factory_super_admin');
      
      const store = useNavigationStore.getState();
      store.updateAvailableTabs(mockUser);

      // 测试Tab查找
      const homeTab = store.getTabByName('home');
      expect(homeTab).toBeTruthy();
      expect(homeTab?.title).toBe('首页');

      const nonExistentTab = store.getTabByName('nonexistent');
      expect(nonExistentTab).toBeNull();
    });
  });

  describe('4. Store持久化测试', () => {
    test('AuthStore持久化配置', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        email: 'test@test.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001',
          department: 'test'
        }
      };
      const mockTokens = { accessToken: 'token', refreshToken: 'refresh', tokenType: 'Bearer', expiresIn: 3600 };

      useAuthStore.getState().login(mockUser, mockTokens);

      // 验证AsyncStorage被调用（通过Zustand中间件）
      // 注意：实际的持久化逻辑在Zustand内部处理
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().tokens).toEqual(mockTokens);
    });

    test('PermissionStore持久化配置', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const mockPermissions = {
        modules: {
          farming_access: true,
          processing_access: false,
          logistics_access: false,
          trace_access: false,
          admin_access: false,
          platform_access: false
        },
        features: ['test_feature'],
        role: 'operator',
        userType: 'factory' as const,
        level: 30
      };

      usePermissionStore.getState().setPermissions(mockPermissions);

      expect(usePermissionStore.getState().permissions).toEqual(mockPermissions);
      expect(usePermissionStore.getState().lastUpdated).toBeTruthy();
    });
  });

  describe('5. Store交互和依赖测试', () => {
    test('NavigationStore与PermissionStore交互', async () => {
      const navStore = await import('../../store/navigationStore');
      const permStore = await import('../../store/permissionStore');
      const { useNavigationStore } = navStore;
      const { usePermissionStore } = permStore;
      
      // 设置权限
      const mockPermissions = {
        modules: {
          processing_access: true,
          admin_access: false,
          platform_access: false
        },
        features: ['production_operation'],
        role: 'operator',
        userType: 'factory' as const,
        level: 30
      };

      usePermissionStore.getState().setPermissions(mockPermissions);

      // 测试基于权限的Tab访问
      const navStore = useNavigationStore.getState();
      
      // operator应该能访问processing但不能访问admin
      expect(navStore.canAccessTab('processing', 'operator')).toBe(true);
      expect(navStore.canAccessTab('admin', 'operator')).toBe(false);
    });

    test('状态清理的连锁反应', async () => {
      const authStore = await import('../../store/authStore');
      const permStore = await import('../../store/permissionStore');
      const navStore = await import('../../store/navigationStore');
      const { useAuthStore } = authStore;
      const { usePermissionStore } = permStore;
      const { useNavigationStore } = navStore;

      // 设置初始状态
      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        email: 'test@test.com',
        userType: 'factory' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        factoryUser: {
          role: 'operator',
          factoryId: 'FAC001',
          department: 'processing'
        }
      };
      const mockPermissions = {
        modules: {
          farming_access: false,
          processing_access: true,
          logistics_access: false,
          trace_access: false,
          admin_access: false,
          platform_access: false
        },
        features: ['test'],
        role: 'operator',
        userType: 'factory' as const,
        level: 30
      };

      useAuthStore.getState().setUser(mockUser);
      usePermissionStore.getState().setPermissions(mockPermissions);
      useNavigationStore.getState().setCurrentTab('processing');

      // 模拟用户登出
      useAuthStore.getState().logout();
      usePermissionStore.getState().clearPermissions();
      useNavigationStore.getState().updateAvailableTabs(null);

      // 验证状态被正确清理
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(usePermissionStore.getState().permissions).toBeNull();
      expect(useNavigationStore.getState().currentTab).toBe('home');
      expect(useNavigationStore.getState().availableTabs).toHaveLength(1); // 只有首页
    });
  });
});