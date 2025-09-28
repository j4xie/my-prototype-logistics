/**
 * Store集成测试 - 增强版本
 * 测试多个Store之间的协调工作和状态同步
 */

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(null)),
  setItem: jest.fn((key: string, value: string) => Promise.resolve()),
  removeItem: jest.fn((key: string) => Promise.resolve()),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

// Mock Zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (fn: any, config: any) => fn,
  createJSONStorage: () => mockAsyncStorage,
}));

// Mock constants and types
jest.mock('../../constants/permissions', () => ({
  CORE_ROLE_PERMISSIONS: {
    system_developer: {
      modules: { platform_access: true, admin_access: true },
      features: ['*'],
      role: 'system_developer',
      userType: 'platform',
      level: 0
    },
    operator: {
      modules: { farming_access: true, processing_access: true },
      features: ['production_operation'],
      role: 'operator',
      userType: 'factory',
      level: 30
    }
  }
}));

jest.mock('../../utils/roleMapping', () => ({
  getUserRole: jest.fn((user) => {
    if (user?.userType === 'platform') return user.platformUser?.role;
    if (user?.userType === 'factory') return user.factoryUser?.role;
    return null;
  })
}));

describe('Store集成测试 - 增强版本', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. 多Store状态协调', () => {
    test('登录流程的完整Store状态同步', () => {
      // 模拟完整的Store系统
      class StoreIntegration {
        private authStore: any;
        private permissionStore: any;
        private navigationStore: any;

        constructor() {
          this.authStore = {
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false
          };

          this.permissionStore = {
            permissions: null,
            lastUpdated: null
          };

          this.navigationStore = {
            currentTab: 'home',
            availableTabs: [{ name: 'home', title: '首页' }],
            isTabBarVisible: true
          };
        }

        // 模拟完整登录流程
        performLogin(userCredentials: any, userPermissions: any) {
          try {
            // 1. 设置加载状态
            this.authStore.isLoading = true;

            // 2. 更新认证Store
            this.authStore.user = {
              id: 'user-001',
              username: userCredentials.username,
              userType: userCredentials.userType,
              ...(userCredentials.userType === 'platform' 
                ? { platformUser: { role: userCredentials.role } }
                : { factoryUser: { role: userCredentials.role, factoryId: 'FAC001' } })
            };
            this.authStore.tokens = {
              accessToken: 'mock_access_token',
              refreshToken: 'mock_refresh_token'
            };
            this.authStore.isAuthenticated = true;
            this.authStore.isLoading = false;

            // 4. 更新权限Store
            this.permissionStore.permissions = userPermissions;
            this.permissionStore.lastUpdated = Date.now();

            // 5. 更新导航Store
            this.updateNavigationForUser(this.authStore.user, userPermissions);

            return { success: true, user: this.authStore.user };
          } catch (error) {
            this.authStore.isLoading = false;
            throw error;
          }
        }

        private updateNavigationForUser(user: any, permissions: any) {
          const availableTabs = [{ name: 'home', title: '首页' }];

          if (permissions?.modules?.farming_access) {
            availableTabs.push({ name: 'farming', title: '种植' });
          }

          if (permissions?.modules?.processing_access) {
            availableTabs.push({ name: 'processing', title: '加工' });
          }

          if (permissions?.modules?.admin_access) {
            availableTabs.push({ name: 'admin', title: '管理' });
          }

          this.navigationStore.availableTabs = availableTabs;
          
          // 如果当前tab不在可用列表中，切换到home
          const currentTabExists = availableTabs.some(tab => 
            tab.name === this.navigationStore.currentTab
          );
          
          if (!currentTabExists) {
            this.navigationStore.currentTab = 'home';
          }
        }

        // 模拟登出流程
        async performLogout() {
          // 清理认证Store
          this.authStore.user = null;
          this.authStore.tokens = null;
          this.authStore.isAuthenticated = false;
          this.authStore.isLoading = false;

          // 清理权限Store
          this.permissionStore.permissions = null;
          this.permissionStore.lastUpdated = null;

          // 重置导航Store
          this.navigationStore.currentTab = 'home';
          this.navigationStore.availableTabs = [{ name: 'home', title: '首页' }];
          this.navigationStore.isTabBarVisible = true;

          return { success: true };
        }

        // Store状态获取器
        getAuthState() { return { ...this.authStore }; }
        getPermissionState() { return { ...this.permissionStore }; }
        getNavigationState() { return { ...this.navigationStore }; }

        // 权限检查
        hasPermission(permission: string): boolean {
          if (!this.permissionStore.permissions) return false;
          return this.permissionStore.permissions.features?.includes('*') ||
                 this.permissionStore.permissions.features?.includes(permission) ||
                 false;
        }

        hasModuleAccess(module: string): boolean {
          if (!this.permissionStore.permissions) return false;
          return !!this.permissionStore.permissions.modules?.[module];
        }

        canNavigateToTab(tabName: string): boolean {
          return this.navigationStore.availableTabs.some(tab => tab.name === tabName);
        }
      }

      const storeSystem = new StoreIntegration();

      // 测试初始状态
      expect(storeSystem.getAuthState().user).toBeNull();
      expect(storeSystem.getAuthState().isAuthenticated).toBe(false);
      expect(storeSystem.getPermissionState().permissions).toBeNull();
      expect(storeSystem.getNavigationState().availableTabs).toHaveLength(1);

      // 测试平台管理员登录
      const platformCredentials = {
        username: 'platform_admin',
        userType: 'platform',
        role: 'system_developer'
      };

      const platformPermissions = {
        modules: { platform_access: true, admin_access: true, farming_access: true },
        features: ['*'],
        role: 'system_developer',
        userType: 'platform',
        level: 0
      };

      const result = storeSystem.performLogin(platformCredentials, platformPermissions);
      
      expect(result.success).toBe(true);

      // 验证认证状态
      const authState = storeSystem.getAuthState();
      expect(authState.user).toBeTruthy();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user.userType).toBe('platform');

      // 验证权限状态
      const permissionState = storeSystem.getPermissionState();
      expect(permissionState.permissions).toBeTruthy();
      expect(permissionState.lastUpdated).toBeTruthy();

      // 验证导航状态
      const navigationState = storeSystem.getNavigationState();
      expect(navigationState.availableTabs.length).toBeGreaterThan(1);
      expect(storeSystem.canNavigateToTab('admin')).toBe(true);
      expect(storeSystem.hasPermission('any_permission')).toBe(true);
      expect(storeSystem.hasModuleAccess('platform_access')).toBe(true);
    });

    test('用户角色切换的Store状态更新', async () => {
      class RoleChangeStoreSystem {
        private stores: any = {
          auth: { user: null, isAuthenticated: false },
          permission: { permissions: null },
          navigation: { currentTab: 'home', availableTabs: [{ name: 'home' }] }
        };

        setUser(user: any, permissions: any) {
          this.stores.auth.user = user;
          this.stores.auth.isAuthenticated = !!user;
          this.stores.permission.permissions = permissions;
          this.updateNavigationForRole(permissions?.role);
        }

        private updateNavigationForRole(role: string) {
          const tabsByRole = {
            'system_developer': ['home', 'farming', 'processing', 'admin', 'platform'],
            'factory_super_admin': ['home', 'farming', 'processing', 'admin'],
            'operator': ['home', 'farming', 'processing'],
            'viewer': ['home']
          };

          const availableTabs = (tabsByRole[role as keyof typeof tabsByRole] || ['home'])
            .map(name => ({ name, title: name }));

          this.stores.navigation.availableTabs = availableTabs;

          // 检查当前tab是否仍然可用
          const currentTabValid = availableTabs.some(tab => 
            tab.name === this.stores.navigation.currentTab
          );

          if (!currentTabValid) {
            this.stores.navigation.currentTab = 'home';
          }
        }

        getAvailableTabNames(): string[] {
          return this.stores.navigation.availableTabs.map((tab: any) => tab.name);
        }

        getCurrentTab(): string {
          return this.stores.navigation.currentTab;
        }

        getUserRole(): string | null {
          return this.stores.permission.permissions?.role || null;
        }
      }

      const system = new RoleChangeStoreSystem();

      // 测试操作员权限
      system.setUser(
        { id: 'user1', userType: 'factory', factoryUser: { role: 'operator' } },
        { role: 'operator', modules: { farming_access: true, processing_access: true } }
      );

      expect(system.getAvailableTabNames()).toEqual(['home', 'farming', 'processing']);
      expect(system.getUserRole()).toBe('operator');

      // 测试升级为管理员
      system.setUser(
        { id: 'user1', userType: 'factory', factoryUser: { role: 'factory_super_admin' } },
        { role: 'factory_super_admin', modules: { admin_access: true } }
      );

      expect(system.getAvailableTabNames()).toEqual(['home', 'farming', 'processing', 'admin']);
      expect(system.getUserRole()).toBe('factory_super_admin');

      // 测试降级为查看者
      system.setUser(
        { id: 'user1', userType: 'factory', factoryUser: { role: 'viewer' } },
        { role: 'viewer', modules: {} }
      );

      expect(system.getAvailableTabNames()).toEqual(['home']);
      expect(system.getUserRole()).toBe('viewer');
      expect(system.getCurrentTab()).toBe('home'); // 自动切换到home
    });
  });

  describe('2. Store状态持久化集成', () => {
    test('Store状态的保存和恢复', async () => {
      class PersistentStoreSystem {
        private data: any = {};

        async saveState(key: string, state: any) {
          this.data[key] = JSON.stringify(state);
          return mockAsyncStorage.setItem(key, this.data[key]);
        }

        async loadState(key: string) {
          mockAsyncStorage.getItem.mockResolvedValue(this.data[key] || null);
          const stored = await mockAsyncStorage.getItem(key);
          return stored ? JSON.parse(stored) : null;
        }

        async clearState(key: string) {
          delete this.data[key];
          return mockAsyncStorage.removeItem(key);
        }

        // 模拟完整的状态保存流程
        async saveCompleteState(authState: any, permissionState: any, navigationState: any) {
          await Promise.all([
            this.saveState('auth', authState),
            this.saveState('permissions', permissionState),
            this.saveState('navigation', navigationState)
          ]);
        }

        // 模拟完整的状态恢复流程
        async restoreCompleteState() {
          const [authState, permissionState, navigationState] = await Promise.all([
            this.loadState('auth'),
            this.loadState('permissions'),
            this.loadState('navigation')
          ]);

          return {
            auth: authState || { user: null, isAuthenticated: false },
            permissions: permissionState || { permissions: null },
            navigation: navigationState || { currentTab: 'home', availableTabs: [{ name: 'home' }] }
          };
        }

        // 模拟清理所有状态
        async clearAllStates() {
          await Promise.all([
            this.clearState('auth'),
            this.clearState('permissions'),
            this.clearState('navigation')
          ]);
        }
      }

      const persistSystem = new PersistentStoreSystem();

      // 准备测试状态
      const authState = {
        user: { id: 'user1', username: 'test_user' },
        tokens: { accessToken: 'token123' },
        isAuthenticated: true
      };

      const permissionState = {
        permissions: { role: 'operator', modules: { farming_access: true } },
        lastUpdated: Date.now()
      };

      const navigationState = {
        currentTab: 'farming',
        availableTabs: [{ name: 'home' }, { name: 'farming' }]
      };

      // 测试保存状态
      await persistSystem.saveCompleteState(authState, permissionState, navigationState);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('auth', expect.any(String));
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('permissions', expect.any(String));
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('navigation', expect.any(String));

      // 测试恢复状态
      const restoredState = await persistSystem.restoreCompleteState();
      
      expect(restoredState.auth.user.id).toBe('user1');
      expect(restoredState.permissions.permissions.role).toBe('operator');
      expect(restoredState.navigation.currentTab).toBe('farming');

      // 测试清理状态
      await persistSystem.clearAllStates();
      
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('permissions');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('navigation');
    });

    test('状态恢复时的一致性验证', async () => {
      class StateValidationSystem {
        validateAndFixState(restoredStates: any) {
          const { auth, permissions, navigation } = restoredStates;
          const fixes: string[] = [];

          // 验证认证状态一致性
          if (auth.isAuthenticated && !auth.user) {
            auth.isAuthenticated = false;
            auth.tokens = null;
            fixes.push('修复认证状态不一致');
          }

          // 验证权限状态
          if (auth.user && !permissions.permissions) {
            permissions.permissions = this.generateMinimalPermissions(auth.user);
            fixes.push('生成默认权限');
          }

          // 验证导航状态
          if (auth.user && permissions.permissions) {
            const validTabs = this.getValidTabsForRole(permissions.permissions.role);
            if (!validTabs.includes(navigation.currentTab)) {
              navigation.currentTab = 'home';
              fixes.push('修正无效的当前Tab');
            }

            navigation.availableTabs = validTabs.map(name => ({ name, title: name }));
          } else {
            navigation.currentTab = 'home';
            navigation.availableTabs = [{ name: 'home', title: 'home' }];
            fixes.push('重置导航状态');
          }

          return { states: { auth, permissions, navigation }, fixes };
        }

        private generateMinimalPermissions(user: any) {
          return {
            role: user.factoryUser?.role || user.platformUser?.role || 'viewer',
            modules: { farming_access: false },
            features: []
          };
        }

        private getValidTabsForRole(role: string): string[] {
          const tabsByRole: Record<string, string[]> = {
            'system_developer': ['home', 'farming', 'processing', 'admin'],
            'operator': ['home', 'farming', 'processing'],
            'viewer': ['home']
          };

          return tabsByRole[role] || ['home'];
        }
      }

      const validationSystem = new StateValidationSystem();

      // 测试不一致状态的修复
      const inconsistentState = {
        auth: { user: null, isAuthenticated: true, tokens: { accessToken: 'token' } },
        permissions: { permissions: null },
        navigation: { currentTab: 'admin', availableTabs: [] }
      };

      const result = validationSystem.validateAndFixState(inconsistentState);

      expect(result.states.auth.isAuthenticated).toBe(false);
      expect(result.states.auth.tokens).toBeNull();
      expect(result.states.navigation.currentTab).toBe('home');
      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.fixes).toContain('修复认证状态不一致');
      expect(result.fixes).toContain('重置导航状态');
    });
  });

  describe('3. Store错误处理和恢复', () => {
    test('Store操作异常的处理', async () => {
      class ErrorHandlingStoreSystem {
        private state: any = {
          auth: { user: null, isAuthenticated: false },
          errors: []
        };

        async performOperation(operation: () => Promise<any>) {
          try {
            const result = await operation();
            this.clearErrors();
            return { success: true, result };
          } catch (error: any) {
            this.recordError(error);
            return { success: false, error: error.message };
          }
        }

        private recordError(error: any) {
          this.state.errors.push({
            message: error.message,
            timestamp: Date.now(),
            type: error.constructor.name
          });

          // 保持错误日志在合理范围内
          if (this.state.errors.length > 10) {
            this.state.errors.shift();
          }
        }

        private clearErrors() {
          this.state.errors = [];
        }

        getErrors() {
          return [...this.state.errors];
        }

        hasErrors() {
          return this.state.errors.length > 0;
        }

        // 模拟可能失败的Store操作
        async simulateFailingLogin() {
          throw new Error('网络连接失败');
        }

        async simulatePartialFailure() {
          // 部分成功，部分失败的场景
          this.state.auth.user = { id: 'user1' };
          throw new Error('权限加载失败');
        }
      }

      const errorSystem = new ErrorHandlingStoreSystem();

      // 测试完全失败的操作
      const failResult = await errorSystem.performOperation(
        () => errorSystem.simulateFailingLogin()
      );

      expect(failResult.success).toBe(false);
      expect(failResult.error).toBe('网络连接失败');
      expect(errorSystem.hasErrors()).toBe(true);
      expect(errorSystem.getErrors()).toHaveLength(1);

      // 测试部分失败的操作
      const partialResult = await errorSystem.performOperation(
        () => errorSystem.simulatePartialFailure()
      );

      expect(partialResult.success).toBe(false);
      expect(errorSystem.getErrors()).toHaveLength(2);

      // 测试错误日志限制
      for (let i = 0; i < 15; i++) {
        await errorSystem.performOperation(() => {
          throw new Error(`Error ${i}`);
        });
      }

      expect(errorSystem.getErrors().length).toBe(10); // 应该被限制在10个
    });

    test('Store状态回滚机制', () => {
      class TransactionStoreSystem {
        private state: any = {
          auth: { user: null, tokens: null },
          permissions: { permissions: null },
          navigation: { currentTab: 'home' }
        };

        private snapshots: any[] = [];

        createSnapshot() {
          this.snapshots.push(JSON.parse(JSON.stringify(this.state)));
          return this.snapshots.length - 1;
        }

        rollbackToSnapshot(snapshotIndex: number) {
          if (snapshotIndex >= 0 && snapshotIndex < this.snapshots.length) {
            this.state = JSON.parse(JSON.stringify(this.snapshots[snapshotIndex]));
            return true;
          }
          return false;
        }

        clearSnapshots() {
          this.snapshots = [];
        }

        // 模拟事务性操作
        performTransaction(operations: (() => void)[]) {
          const snapshotIndex = this.createSnapshot();
          
          try {
            operations.forEach(op => op());
            return { success: true };
          } catch (error) {
            this.rollbackToSnapshot(snapshotIndex);
            return { success: false, error };
          }
        }

        // 状态访问器
        getState() { return { ...this.state }; }
        
        // 状态修改器
        updateAuth(updates: any) {
          if (typeof updates !== 'object') throw new Error('Invalid auth updates');
          this.state.auth = { ...this.state.auth, ...updates };
        }

        updatePermissions(updates: any) {
          if (updates === null || typeof updates !== 'object') throw new Error('Invalid permission updates');
          this.state.permissions = { ...this.state.permissions, ...updates };
        }

        updateNavigation(updates: any) {
          if (typeof updates !== 'object') throw new Error('Invalid navigation updates');
          this.state.navigation = { ...this.state.navigation, ...updates };
        }
      }

      const transactionSystem = new TransactionStoreSystem();

      // 测试成功的事务
      const successResult = transactionSystem.performTransaction([
        () => transactionSystem.updateAuth({ user: { id: 'user1' } }),
        () => transactionSystem.updatePermissions({ permissions: { role: 'operator' } }),
        () => transactionSystem.updateNavigation({ currentTab: 'farming' })
      ]);

      expect(successResult.success).toBe(true);
      expect(transactionSystem.getState().auth.user.id).toBe('user1');
      expect(transactionSystem.getState().permissions.permissions.role).toBe('operator');

      // 测试失败的事务和回滚
      const originalState = transactionSystem.getState();
      
      const failResult = transactionSystem.performTransaction([
        () => transactionSystem.updateAuth({ user: { id: 'user2' } }),
        () => transactionSystem.updatePermissions(null), // 这会失败
        () => transactionSystem.updateNavigation({ currentTab: 'admin' })
      ]);

      expect(failResult.success).toBe(false);
      
      // 状态应该回滚到事务开始前
      const rolledBackState = transactionSystem.getState();
      expect(rolledBackState.auth.user.id).toBe(originalState.auth.user.id);
      expect(rolledBackState.permissions.permissions.role).toBe(originalState.permissions.permissions.role);
      expect(rolledBackState.navigation.currentTab).toBe(originalState.navigation.currentTab);
    });
  });

  describe('4. Store性能和内存管理', () => {
    test('Store内存使用优化', () => {
      class OptimizedStoreSystem {
        private cache: Map<string, any> = new Map();
        private maxCacheSize = 50;
        private accessCount: Map<string, number> = new Map();

        set(key: string, value: any) {
          // LRU缓存实现
          if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
            // 找到访问次数最少的key
            let lruKey = '';
            let minAccess = Infinity;
            
            for (const [cacheKey, _] of this.cache) {
              const access = this.accessCount.get(cacheKey) || 0;
              if (access < minAccess) {
                minAccess = access;
                lruKey = cacheKey;
              }
            }

            if (lruKey) {
              this.cache.delete(lruKey);
              this.accessCount.delete(lruKey);
            }
          }

          this.cache.set(key, value);
          this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
        }

        get(key: string) {
          if (this.cache.has(key)) {
            this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
            return this.cache.get(key);
          }
          return null;
        }

        getCacheStats() {
          return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys()),
            accessCounts: Object.fromEntries(this.accessCount)
          };
        }

        clearCache() {
          this.cache.clear();
          this.accessCount.clear();
        }
      }

      const optimizedSystem = new OptimizedStoreSystem();

      // 测试缓存基本功能
      optimizedSystem.set('user1', { id: 'user1', name: 'Test User 1' });
      optimizedSystem.set('user2', { id: 'user2', name: 'Test User 2' });

      expect(optimizedSystem.get('user1')).toBeTruthy();
      expect(optimizedSystem.get('user3')).toBeNull();

      // 测试缓存大小限制和LRU逻辑
      for (let i = 3; i <= 55; i++) {
        optimizedSystem.set(`user${i}`, { id: `user${i}`, name: `Test User ${i}` });
      }

      const stats = optimizedSystem.getCacheStats();
      expect(stats.size).toBe(50); // 应该不超过最大大小

      // 访问一些项目以增加访问计数
      optimizedSystem.get('user50');
      optimizedSystem.get('user50');
      optimizedSystem.get('user51');

      // 添加新项目，应该移除访问次数少的项目
      optimizedSystem.set('user56', { id: 'user56' });
      
      expect(optimizedSystem.get('user50')).toBeTruthy(); // 应该保留（访问次数多）
      expect(optimizedSystem.getCacheStats().size).toBe(50);
    });

    test('Store状态变更监听性能', () => {
      class PerformantStoreSystem {
        private state: any = { counter: 0, data: {} };
        private listeners: Map<string, Set<() => void>> = new Map();
        private batchedUpdates: any[] = [];
        private batchTimeout: any = null;

        subscribe(path: string, listener: () => void) {
          if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
          }
          this.listeners.get(path)!.add(listener);

          // 返回取消订阅函数
          return () => {
            this.listeners.get(path)?.delete(listener);
            if (this.listeners.get(path)?.size === 0) {
              this.listeners.delete(path);
            }
          };
        }

        update(path: string, value: any, batch = true) {
          if (batch) {
            this.batchedUpdates.push({ path, value, timestamp: Date.now() });
            
            if (this.batchTimeout) {
              clearTimeout(this.batchTimeout);
            }
            
            this.batchTimeout = setTimeout(() => {
              this.flushBatchedUpdates();
            }, 0);
          } else {
            this.applyUpdate(path, value);
            this.notifyListeners(path);
          }
        }

        private flushBatchedUpdates() {
          const affectedPaths = new Set<string>();
          
          this.batchedUpdates.forEach(({ path, value }) => {
            this.applyUpdate(path, value);
            affectedPaths.add(path);
          });

          // 通知所有受影响的路径
          affectedPaths.forEach(path => {
            this.notifyListeners(path);
          });

          this.batchedUpdates = [];
          this.batchTimeout = null;
        }

        private applyUpdate(path: string, value: any) {
          if (path === 'counter') {
            this.state.counter = value;
          } else if (path.startsWith('data.')) {
            const key = path.substring(5);
            this.state.data[key] = value;
          }
        }

        private notifyListeners(path: string) {
          const listeners = this.listeners.get(path);
          if (listeners) {
            listeners.forEach(listener => listener());
          }
        }

        getState() { return { ...this.state }; }
        getListenerCount() { return this.listeners.size; }
        getBatchedUpdateCount() { return this.batchedUpdates.length; }
      }

      const performantSystem = new PerformantStoreSystem();
      let notificationCount = 0;

      // 订阅状态变更
      const unsubscribe = performantSystem.subscribe('counter', () => {
        notificationCount++;
      });

      // 测试批量更新
      performantSystem.update('counter', 1);
      performantSystem.update('counter', 2);
      performantSystem.update('counter', 3);

      expect(performantSystem.getBatchedUpdateCount()).toBe(3);

      // 手动触发批量更新刷新 (避免setTimeout)
      performantSystem['flushBatchedUpdates']();
      
      expect(notificationCount).toBe(1); // 只应该通知一次（批量处理）
      expect(performantSystem.getState().counter).toBe(3);
      expect(performantSystem.getBatchedUpdateCount()).toBe(0);

      // 测试取消订阅
      unsubscribe();
      expect(performantSystem.getListenerCount()).toBe(0);
    });
  });
});