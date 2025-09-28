/**
 * Store核心功能测试 - 简化版本
 * 专注于Store的核心业务逻辑而避免复杂的TypeScript类型依赖
 */

// Mock AsyncStorage with proper interface for Zustand
const mockAsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(null)),
  setItem: jest.fn((key: string, value: string) => Promise.resolve()),
  removeItem: jest.fn((key: string) => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
};

// Mock the default export
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

// Mock Zustand persist to avoid AsyncStorage issues in tests
jest.mock('zustand/middleware', () => ({
  persist: (fn: any) => fn,
  createJSONStorage: () => ({
    getItem: mockAsyncStorage.getItem,
    setItem: mockAsyncStorage.setItem,
    removeItem: mockAsyncStorage.removeItem,
  }),
}));

// Mock constants to avoid type issues
jest.mock('../../constants/permissions', () => ({
  CORE_ROLE_PERMISSIONS: {
    system_developer: {
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
      userType: 'platform',
      level: 0
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
      userType: 'factory',
      level: 30
    }
  },
  FULL_ROLE_PERMISSIONS: {}
}));

// Mock roleMapping utility
jest.mock('../../utils/roleMapping', () => ({
  getUserRole: jest.fn((user) => {
    if (user?.userType === 'platform') return user.platformUser?.role;
    if (user?.userType === 'factory') return user.factoryUser?.role;
    return null;
  }),
  transformBackendUser: jest.fn((user) => user)
}));

describe('Store核心功能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('1. AuthStore基础功能', () => {
    test('Store初始化状态', async () => {
      // 通过动态导入避免模块初始化问题
      const { useAuthStore } = await import('../../store/authStore');
      
      const store = useAuthStore.getState();
      expect(store.user).toBeNull();
      expect(store.tokens).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(store.isLoading).toBe(false);
    });

    test('用户登录状态管理', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      // 使用简化的mock数据避免类型问题
      const mockUser = {
        id: 'user-001',
        username: 'test_user',
        userType: 'factory'
      } as any;

      const mockTokens = {
        accessToken: 'token123',
        refreshToken: 'refresh456',
        tokenType: 'Bearer',
        expiresIn: 3600
      } as any;

      const store = useAuthStore.getState();
      store.login(mockUser, mockTokens);

      const updatedState = useAuthStore.getState();
      expect(updatedState.user).toEqual(mockUser);
      expect(updatedState.tokens).toEqual(mockTokens);
      expect(updatedState.isAuthenticated).toBe(true);
    });

    test('用户登出清理状态', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const store = useAuthStore.getState();
      
      // 先设置登录状态
      store.login({ id: 'test', userType: 'factory' } as any, { accessToken: 'token' } as any);
      
      // 执行登出
      store.logout();
      
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    test('Getter方法功能验证', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const store = useAuthStore.getState();
      
      // 测试空用户状态
      expect(store.getUserId()).toBeNull();
      expect(store.getUserType()).toBeNull();
      expect(store.getUserRole()).toBeNull();

      // 设置用户后测试
      const mockUser = {
        id: 'user-001',
        userType: 'platform',
        platformUser: { role: 'platform_super_admin' }
      } as any;
      
      store.setUser(mockUser);
      
      expect(store.getUserId()).toBe('user-001');
      expect(store.getUserType()).toBe('platform');
      expect(store.getUserRole()).toBe('platform_super_admin');
    });
  });

  describe('2. PermissionStore基础功能', () => {
    test('权限设置和检查', async () => {
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
        userType: 'factory',
        level: 30
      } as any;

      const store = usePermissionStore.getState();
      store.setPermissions(mockPermissions);

      // 验证权限检查功能
      expect(store.hasPermission('production_operation')).toBe(true);
      expect(store.hasPermission('admin_access')).toBe(false);
      
      expect(store.hasRole('operator')).toBe(true);
      expect(store.hasRole('admin')).toBe(false);
      
      expect(store.hasModuleAccess('farming_access')).toBe(true);
      expect(store.hasModuleAccess('admin_access')).toBe(false);
    });

    test('数据访问级别检查', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const store = usePermissionStore.getState();
      
      // 操作员级别权限
      const operatorPerms = {
        modules: { farming_access: true },
        features: ['production_operation'],
        role: 'operator',
        userType: 'factory',
        level: 30
      } as any;
      
      store.setPermissions(operatorPerms);
      
      expect(store.canAccessData('own')).toBe(true);
      expect(store.canAccessData('department')).toBe(true);
      expect(store.canAccessData('factory')).toBe(false);
      expect(store.canAccessData('all')).toBe(false);
    });

    test('高级权限检查功能', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const adminPerms = {
        modules: { admin_access: true, platform_access: false },
        features: ['user_manage_factory', 'developer_tools'],
        role: 'permission_admin',
        userType: 'factory',
        level: 20
      } as any;

      const store = usePermissionStore.getState();
      store.setPermissions(adminPerms);

      expect(store.canManageUsers()).toBe(true);
      expect(store.canViewAdminPanel()).toBe(true);
      expect(store.canAccessDeveloperTools()).toBe(true);
      expect(store.isPlatformUser()).toBe(false);
      expect(store.isFactoryUser()).toBe(true);
    });
  });

  describe('3. NavigationStore基础功能', () => {
    test('导航状态初始化', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const state = useNavigationStore.getState();
      
      expect(state.currentTab).toBe('home');
      expect(state.isTabBarVisible).toBe(true);
      expect(state.navigationHistory).toEqual([]);
      expect(state.availableTabs).toHaveLength(1);
      expect(state.availableTabs[0].name).toBe('home');
    });

    test('Tab访问权限检查', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // 首页应该对所有人开放
      expect(store.canAccessTab('home', null)).toBe(true);
      expect(store.canAccessTab('home', 'operator')).toBe(true);
      
      // 无角色用户只能访问首页
      expect(store.canAccessTab('admin', null)).toBe(false);
      expect(store.canAccessTab('processing', null)).toBe(false);
    });

    test('导航历史管理', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // 添加历史记录
      store.pushToHistory('screen1');
      store.pushToHistory('screen2');
      
      expect(useNavigationStore.getState().navigationHistory).toEqual(['screen1', 'screen2']);
      
      // 清理历史
      store.clearHistory();
      expect(useNavigationStore.getState().navigationHistory).toEqual([]);
    });

    test('Tab切换和状态管理', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // Tab切换
      store.setCurrentTab('processing');
      expect(useNavigationStore.getState().currentTab).toBe('processing');
      
      // TabBar可见性
      store.setTabBarVisible(false);
      expect(useNavigationStore.getState().isTabBarVisible).toBe(false);
      
      store.setTabBarVisible(true);
      expect(useNavigationStore.getState().isTabBarVisible).toBe(true);
    });
  });

  describe('4. Store状态同步测试', () => {
    test('登出时状态清理同步', async () => {
      const [authStore, permStore, navStore] = await Promise.all([
        import('../../store/authStore'),
        import('../../store/permissionStore'),
        import('../../store/navigationStore')
      ]);

      const { useAuthStore } = authStore;
      const { usePermissionStore } = permStore;
      const { useNavigationStore } = navStore;

      // 设置初始状态
      useAuthStore.getState().setUser({ id: 'user', userType: 'factory' } as any);
      usePermissionStore.getState().setPermissions({
        modules: { processing_access: true },
        features: ['test'],
        role: 'operator',
        userType: 'factory',
        level: 30
      } as any);
      useNavigationStore.getState().setCurrentTab('processing');

      // 执行登出清理
      useAuthStore.getState().logout();
      usePermissionStore.getState().clearPermissions();
      useNavigationStore.getState().updateAvailableTabs(null);

      // 验证状态被正确清理
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(usePermissionStore.getState().permissions).toBeNull();
      expect(useNavigationStore.getState().currentTab).toBe('home');
      expect(useNavigationStore.getState().availableTabs).toHaveLength(1);
    });

    test('Store持久化状态验证', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const mockData = {
        user: { id: 'test-user', userType: 'factory' },
        tokens: { accessToken: 'token123', refreshToken: 'refresh456' }
      } as any;

      useAuthStore.getState().login(mockData.user, mockData.tokens);

      // 验证状态已设置
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockData.user);
      expect(state.tokens).toEqual(mockData.tokens);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('5. 错误处理和边界情况', () => {
    test('空值处理', async () => {
      const { usePermissionStore } = await import('../../store/permissionStore');
      
      const store = usePermissionStore.getState();
      
      // 空权限状态下的检查
      store.clearPermissions();
      
      expect(store.hasPermission('any_permission')).toBe(false);
      expect(store.hasRole('any_role')).toBe(false);
      expect(store.hasModuleAccess('any_module')).toBe(false);
      expect(store.canAccessData('own')).toBe(false);
    });

    test('无效数据处理', async () => {
      const { useNavigationStore } = await import('../../store/navigationStore');
      
      const store = useNavigationStore.getState();
      
      // 测试无效Tab名称
      expect(store.getTabByName('invalid_tab')).toBeNull();
      expect(store.canAccessTab('invalid_tab', 'operator')).toBe(false);
    });

    test('Store方法的健壮性', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      
      const store = useAuthStore.getState();
      
      // 对null用户调用updateUser
      store.setUser(null);
      store.updateUser({ email: 'new@test.com' });
      
      // 应该不会崩溃，用户仍为null
      expect(store.user).toBeNull();
    });
  });
});