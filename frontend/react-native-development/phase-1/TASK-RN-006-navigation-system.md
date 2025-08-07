# TASK-RN-006: 导航系统重构

> React Native Android开发 - 导航系统与权限集成任务
>
> 创建时间: 2025-08-05
> 预计工期: 1天 (8小时)
> 优先级: 高
> 状态: 待开始

## 📋 任务概述

基于TASK-RN-005权限控制系统，重构和增强导航系统，实现基于角色的动态导航、权限菜单控制、平台/工厂视图切换等功能。

## 🎯 任务目标

- 实现基于用户角色的动态导航结构
- 建立权限控制的菜单显示/隐藏机制
- 支持平台管理员在平台/工厂视图间切换
- 创建直观的导航UI和用户体验
- 确保导航安全性和权限一致性

## 📋 详细步骤

### **上午: 导航架构和权限集成** (4小时)

#### 1.1 导航架构设计 (2小时)

**1.1.1 权限导航配置**
```tsx
// src/config/navigationConfig.ts
import { UserRole, UserType } from '@/types/auth';

export interface NavigationItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  requiredPermission?: string;
  requiredRole?: UserRole;
  requiredModule?: string;
  children?: NavigationItem[];
  userTypes?: UserType[];
  showBadge?: boolean;
  badgeCount?: number;
}

// 平台管理员导航配置
export const PLATFORM_NAVIGATION: NavigationItem[] = [
  {
    id: 'platform_dashboard',
    title: '平台概览',
    icon: 'view-dashboard',
    route: 'PlatformDashboard',
    requiredModule: 'platform_access',
    userTypes: ['platform_admin']
  },
  {
    id: 'factory_management',
    title: '工厂管理',
    icon: 'factory',
    route: 'FactoryManagement',
    requiredPermission: 'view_factories',
    userTypes: ['platform_admin'],
    children: [
      {
        id: 'factory_list',
        title: '工厂列表',
        icon: 'format-list-bulleted',
        route: 'FactoryList',
        requiredPermission: 'view_factories'
      },
      {
        id: 'factory_create',
        title: '创建工厂',
        icon: 'plus',
        route: 'FactoryCreate',
        requiredPermission: 'create_factory'
      },
      {
        id: 'factory_analytics',
        title: '工厂分析',
        icon: 'chart-line',
        route: 'FactoryAnalytics',
        requiredPermission: 'view_platform_analytics'
      }
    ]
  },
  {
    id: 'user_management',
    title: '用户管理',
    icon: 'account-group',
    route: 'UserManagement',
    requiredPermission: 'manage_factory_users',
    userTypes: ['platform_admin'],
    children: [
      {
        id: 'platform_users',
        title: '平台用户',
        icon: 'account-star',
        route: 'PlatformUsers',
        requiredPermission: 'manage_platform_admins'
      },
      {
        id: 'factory_users',
        title: '工厂用户',
        icon: 'account-group',
        route: 'FactoryUsers',
        requiredPermission: 'manage_factory_users'
      }
    ]
  },
  {
    id: 'system_settings',
    title: '系统设置',
    icon: 'cog',
    route: 'SystemSettings',
    requiredPermission: 'platform_settings',
    requiredRole: 'platform_super_admin',
    userTypes: ['platform_admin']
  }
];

// 工厂用户导航配置
export const FACTORY_NAVIGATION: NavigationItem[] = [
  {
    id: 'factory_dashboard',
    title: '工厂概览',
    icon: 'view-dashboard',
    route: 'FactoryDashboard',
    userTypes: ['factory_user']
  },
  {
    id: 'farming',
    title: '养殖管理',
    icon: 'cow',
    route: 'FarmingManagement',
    requiredModule: 'farming_access',
    userTypes: ['factory_user'],
    children: [
      {
        id: 'livestock',
        title: '牲畜管理',
        icon: 'pig',
        route: 'LivestockManagement',
        requiredPermission: 'manage_livestock'
      },
      {
        id: 'feed',
        title: '饲料管理',
        icon: 'food-apple',
        route: 'FeedManagement',
        requiredPermission: 'manage_feed'
      },
      {
        id: 'health',
        title: '健康记录',
        icon: 'medical-bag',
        route: 'HealthRecords',
        requiredPermission: 'view_health_records'
      }
    ]
  },
  {
    id: 'processing',
    title: '加工管理',
    icon: 'factory',
    route: 'ProcessingManagement',
    requiredModule: 'processing_access',
    userTypes: ['factory_user'],
    children: [
      {
        id: 'production',
        title: '生产批次',
        icon: 'production',
        route: 'ProductionBatches',
        requiredPermission: 'manage_production'
      },
      {
        id: 'quality',
        title: '质量检测',
        icon: 'clipboard-check',
        route: 'QualityTests',
        requiredPermission: 'manage_quality'
      }
    ]
  },
  {
    id: 'logistics',
    title: '物流管理',
    icon: 'truck',
    route: 'LogisticsManagement',
    requiredModule: 'logistics_access',
    userTypes: ['factory_user'],
    children: [
      {
        id: 'transport',
        title: '运输订单',
        icon: 'truck-delivery',
        route: 'TransportOrders',
        requiredPermission: 'manage_transport'
      },
      {
        id: 'inventory',
        title: '库存管理',
        icon: 'warehouse',
        route: 'InventoryManagement',
        requiredPermission: 'manage_inventory'
      }
    ]
  },
  {
    id: 'trace',
    title: '溯源查询',
    icon: 'qrcode-scan',
    route: 'TraceQuery',
    requiredModule: 'trace_access',
    userTypes: ['factory_user']
  },
  {
    id: 'admin',
    title: '管理中心',
    icon: 'shield-account',
    route: 'AdminCenter',
    requiredModule: 'admin_access',
    requiredRole: 'factory_super_admin',
    userTypes: ['factory_user'],
    children: [
      {
        id: 'factory_users',
        title: '用户管理',
        icon: 'account-group',
        route: 'FactoryUserManagement',
        requiredPermission: 'manage_factory_users'
      },
      {
        id: 'whitelist',
        title: '白名单管理',
        icon: 'shield-check',
        route: 'WhitelistManagement',
        requiredPermission: 'manage_whitelist'
      },
      {
        id: 'roles',
        title: '角色权限',
        icon: 'account-key',
        route: 'RoleManagement',
        requiredPermission: 'manage_permissions'
      }
    ]
  }
];

// 获取用户可访问的导航项
export function getAccessibleNavigation(
  userType: UserType,
  userRole: UserRole,
  permissions: any
): NavigationItem[] {
  const baseNavigation = userType === 'platform_admin' ? PLATFORM_NAVIGATION : FACTORY_NAVIGATION;
  
  return filterNavigationByPermissions(baseNavigation, userType, userRole, permissions);
}

// 根据权限过滤导航项
function filterNavigationByPermissions(
  navigation: NavigationItem[],
  userType: UserType,
  userRole: UserRole,
  permissions: any
): NavigationItem[] {
  return navigation.filter(item => {
    // 检查用户类型
    if (item.userTypes && !item.userTypes.includes(userType)) {
      return false;
    }
    
    // 检查角色要求
    if (item.requiredRole && userRole !== item.requiredRole) {
      // 检查角色层级
      if (!isRoleAuthorized(userRole, item.requiredRole)) {
        return false;
      }
    }
    
    // 检查权限要求
    if (item.requiredPermission && !hasPermission(permissions, item.requiredPermission)) {
      return false;
    }
    
    // 检查模块访问权限
    if (item.requiredModule && !permissions.modules[item.requiredModule]) {
      return false;
    }
    
    // 递归过滤子项
    if (item.children) {
      const filteredChildren = filterNavigationByPermissions(
        item.children,
        userType,
        userRole,
        permissions
      );
      return { ...item, children: filteredChildren };
    }
    
    return true;
  });
}

// 检查角色授权
function isRoleAuthorized(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'platform_super_admin': 0,
    'platform_operator': 10,
    'factory_super_admin': 20,
    'permission_admin': 30,
    'department_admin': 40,
    'operator': 50,
    'viewer': 60
  };
  
  const userLevel = roleHierarchy[userRole] ?? 100;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;
  
  return userLevel <= requiredLevel;
}

// 检查权限
function hasPermission(permissions: any, requiredPermission: string): boolean {
  return permissions.features?.includes(requiredPermission) || false;
}
```

#### 1.2 动态导航组件 (2小时)

**1.2.1 主导航组件**
```tsx
// src/components/navigation/DynamicNavigation.tsx
import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { 
  Drawer, 
  List, 
  Divider, 
  Text, 
  Badge, 
  Avatar,
  Switch
} from 'react-native-paper';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { RoleIndicator } from '@/components/permission/RoleIndicator';
import { getAccessibleNavigation } from '@/config/navigationConfig';
import { NavigationProp } from '@react-navigation/native';

interface DynamicNavigationProps {
  navigation: NavigationProp<any>;
  onNavigate: (route: string) => void;
  currentRoute?: string;
}

export const DynamicNavigation: React.FC<DynamicNavigationProps> = ({
  navigation,
  onNavigate,
  currentRoute
}) => {
  const { user, permissions, userType, factory } = useAuthStore();
  const { hasPermission, canAccessModule } = usePermissions();

  // 计算可访问的导航项
  const accessibleNavigation = useMemo(() => {
    if (!user || !permissions) return [];
    
    return getAccessibleNavigation(
      userType as any,
      permissions.role as any,
      permissions
    );
  }, [user, permissions, userType]);

  // 平台/工厂视图切换状态
  const [viewMode, setViewMode] = React.useState<'platform' | 'factory'>('platform');

  const handleNavigationPress = (route: string) => {
    onNavigate(route);
  };

  const handleViewModeToggle = () => {
    if (userType === 'platform_admin' && hasPermission('developer_cross_platform')) {
      setViewMode(viewMode === 'platform' ? 'factory' : 'platform');
    }
  };

  const renderNavigationItem = (item: any, depth: number = 0) => {
    const isActive = currentRoute === item.route;
    
    return (
      <React.Fragment key={item.id}>
        <List.Item
          title={item.title}
          left={(props) => (
            <List.Icon 
              {...props} 
              icon={item.icon} 
              color={isActive ? '#1976D2' : undefined}
            />
          )}
          right={(props) => (
            <View style={styles.itemRight}>
              {item.showBadge && item.badgeCount && (
                <Badge style={styles.badge}>{item.badgeCount}</Badge>
              )}
              {item.children && (
                <List.Icon {...props} icon="chevron-right" />
              )}
            </View>
          )}
          style={[
            styles.navigationItem,
            { paddingLeft: 16 + depth * 16 },
            isActive && styles.activeItem
          ]}
          titleStyle={[
            styles.itemTitle,
            isActive && styles.activeItemTitle
          ]}
          onPress={() => {
            if (item.children && item.children.length > 0) {
              // 展开/收起子菜单的逻辑
              handleSubmenuToggle(item.id);
            } else {
              handleNavigationPress(item.route);
            }
          }}
        />
        
        {/* 渲染子菜单 */}
        {item.children && isSubmenuExpanded(item.id) && (
          <View style={styles.submenu}>
            {item.children.map((child: any) => renderNavigationItem(child, depth + 1))}
          </View>
        )}
      </React.Fragment>
    );
  };

  // 子菜单展开状态管理
  const [expandedSubmenus, setExpandedSubmenus] = React.useState<Set<string>>(new Set());

  const handleSubmenuToggle = (itemId: string) => {
    const newExpanded = new Set(expandedSubmenus);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedSubmenus(newExpanded);
  };

  const isSubmenuExpanded = (itemId: string) => expandedSubmenus.has(itemId);

  if (!user || !permissions) {
    return (
      <View style={styles.loadingContainer}>
        <Text>加载导航中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 用户信息头部 */}
      <View style={styles.userHeader}>
        <Avatar.Text 
          size={48} 
          label={user.fullName?.charAt(0) || 'U'} 
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.fullName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <RoleIndicator 
            role={permissions.role as any}
            userType={userType as any}
            department={user.department}
            size="small"
          />
        </View>
      </View>

      {/* 工厂信息（工厂用户显示） */}
      {factory && userType === 'factory_user' && (
        <View style={styles.factoryInfo}>
          <Text style={styles.factoryName}>{factory.name}</Text>
          <Text style={styles.factoryIndustry}>{factory.industry}</Text>
        </View>
      )}

      <Divider style={styles.divider} />

      {/* 视图模式切换（平台管理员专用） */}
      {userType === 'platform_admin' && hasPermission('developer_cross_platform') && (
        <View style={styles.viewModeSwitch}>
          <Text style={styles.switchLabel}>工厂视图模式</Text>
          <Switch
            value={viewMode === 'factory'}
            onValueChange={handleViewModeToggle}
          />
        </View>
      )}

      {/* 动态导航菜单 */}
      <View style={styles.navigationMenu}>
        {accessibleNavigation.map(item => renderNavigationItem(item))}
      </View>

      <Divider style={styles.divider} />

      {/* 底部功能 */}
      <View style={styles.bottomActions}>
        <List.Item
          title="设置"
          left={(props) => <List.Icon {...props} icon="cog" />}
          onPress={() => handleNavigationPress('Settings')}
        />
        <List.Item
          title="帮助"
          left={(props) => <List.Icon {...props} icon="help-circle" />}
          onPress={() => handleNavigationPress('Help')}
        />
        <List.Item
          title="退出登录"
          left={(props) => <List.Icon {...props} icon="logout" />}
          onPress={() => {
            // 调用登出逻辑
            useAuthStore.getState().logout();
            navigation.navigate('Login');
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  userHeader: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1976D2',
    alignItems: 'center'
  },
  userAvatar: {
    backgroundColor: '#1565C0'
  },
  userInfo: {
    marginLeft: 12,
    flex: 1
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14
  },
  factoryInfo: {
    padding: 16,
    backgroundColor: '#E3F2FD'
  },
  factoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2'
  },
  factoryIndustry: {
    fontSize: 14,
    color: '#666'
  },
  divider: {
    backgroundColor: '#e0e0e0'
  },
  viewModeSwitch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white'
  },
  switchLabel: {
    fontSize: 16,
    color: '#333'
  },
  navigationMenu: {
    backgroundColor: 'white'
  },
  navigationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  activeItem: {
    backgroundColor: '#E3F2FD'
  },
  itemTitle: {
    fontSize: 16,
    color: '#333'
  },
  activeItemTitle: {
    color: '#1976D2',
    fontWeight: 'bold'
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badge: {
    marginRight: 8
  },
  submenu: {
    backgroundColor: '#f9f9f9'
  },
  bottomActions: {
    backgroundColor: 'white',
    marginTop: 16
  }
});
```

### **下午: 导航状态管理和高级功能** (4小时)

#### 2.1 导航状态管理 (2小时)

**2.1.1 导航Store**
```tsx
// src/stores/navigationStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NavigationItem } from '@/config/navigationConfig';

interface NavigationState {
  // 当前导航状态
  currentRoute: string;
  currentTab: string;
  routeHistory: string[];
  
  // 导航配置
  accessibleNavigation: NavigationItem[];
  favoriteRoutes: string[];
  recentRoutes: string[];
  
  // UI状态
  isDrawerOpen: boolean;
  expandedMenus: Set<string>;
  viewMode: 'platform' | 'factory';
  showBadges: boolean;
  
  // 导航权限缓存
  routePermissions: Map<string, boolean>;
  lastPermissionCheck: number;
}

interface NavigationActions {
  // 导航操作
  setCurrentRoute: (route: string) => void;
  setCurrentTab: (tab: string) => void;
  addToHistory: (route: string) => void;
  clearHistory: () => void;
  
  // 导航配置
  setAccessibleNavigation: (navigation: NavigationItem[]) => void;
  addFavoriteRoute: (route: string) => void;
  removeFavoriteRoute: (route: string) => void;
  addRecentRoute: (route: string) => void;
  
  // UI控制
  toggleDrawer: (open?: boolean) => void;
  toggleMenu: (menuId: string) => void;
  setViewMode: (mode: 'platform' | 'factory') => void;
  toggleBadges: () => void;
  
  // 权限缓存
  cacheRoutePermission: (route: string, hasPermission: boolean) => void;
  getCachedRoutePermission: (route: string) => boolean | null;
  clearPermissionCache: () => void;
  
  // 导航分析
  getNavigationStats: () => NavigationStats;
  getMostUsedRoutes: (limit?: number) => Array<{ route: string; count: number }>;
}

interface NavigationStats {
  totalNavigations: number;
  uniqueRoutes: number;
  averageSessionRoutes: number;
  mostUsedRoute: string;
  navigationsByHour: Record<number, number>;
}

export const useNavigationStore = create<NavigationState & NavigationActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentRoute: '',
      currentTab: 'dashboard',
      routeHistory: [],
      accessibleNavigation: [],
      favoriteRoutes: [],
      recentRoutes: [],
      isDrawerOpen: false,
      expandedMenus: new Set(),
      viewMode: 'platform',
      showBadges: true,
      routePermissions: new Map(),
      lastPermissionCheck: 0,

      // 导航操作
      setCurrentRoute: (route) => {
        const state = get();
        if (route !== state.currentRoute) {
          set({ currentRoute: route });
          state.addToHistory(route);
          state.addRecentRoute(route);
        }
      },

      setCurrentTab: (tab) => {
        set({ currentTab: tab });
      },

      addToHistory: (route) => {
        const state = get();
        const newHistory = [...state.routeHistory.slice(-50), route]; // 保留最近50条
        set({ routeHistory: newHistory });
      },

      clearHistory: () => {
        set({ routeHistory: [] });
      },

      // 导航配置
      setAccessibleNavigation: (navigation) => {
        set({ accessibleNavigation: navigation });
      },

      addFavoriteRoute: (route) => {
        const state = get();
        if (!state.favoriteRoutes.includes(route)) {
          set({ favoriteRoutes: [...state.favoriteRoutes, route] });
        }
      },

      removeFavoriteRoute: (route) => {
        const state = get();
        set({ favoriteRoutes: state.favoriteRoutes.filter(r => r !== route) });
      },

      addRecentRoute: (route) => {
        const state = get();
        const newRecent = [route, ...state.recentRoutes.filter(r => r !== route)].slice(0, 10);
        set({ recentRoutes: newRecent });
      },

      // UI控制
      toggleDrawer: (open) => {
        const state = get();
        set({ isDrawerOpen: open !== undefined ? open : !state.isDrawerOpen });
      },

      toggleMenu: (menuId) => {
        const state = get();
        const newExpanded = new Set(state.expandedMenus);
        if (newExpanded.has(menuId)) {
          newExpanded.delete(menuId);
        } else {
          newExpanded.add(menuId);
        }
        set({ expandedMenus: newExpanded });
      },

      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      toggleBadges: () => {
        const state = get();
        set({ showBadges: !state.showBadges });
      },

      // 权限缓存
      cacheRoutePermission: (route, hasPermission) => {
        const state = get();
        const newCache = new Map(state.routePermissions);
        newCache.set(route, hasPermission);
        set({ 
          routePermissions: newCache,
          lastPermissionCheck: Date.now()
        });
      },

      getCachedRoutePermission: (route) => {
        const state = get();
        const cached = state.routePermissions.get(route);
        
        // 缓存3分钟过期
        if (cached !== undefined && Date.now() - state.lastPermissionCheck < 3 * 60 * 1000) {
          return cached;
        }
        return null;
      },

      clearPermissionCache: () => {
        set({ routePermissions: new Map() });
      },

      // 导航分析
      getNavigationStats: () => {
        const state = get();
        const routeCounts = state.routeHistory.reduce((acc, route) => {
          acc[route] = (acc[route] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const mostUsedRoute = Object.entries(routeCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

        return {
          totalNavigations: state.routeHistory.length,
          uniqueRoutes: Object.keys(routeCounts).length,
          averageSessionRoutes: state.routeHistory.length / Math.max(1, new Set(state.routeHistory).size),
          mostUsedRoute,
          navigationsByHour: {} // 可以根据需要实现按小时统计
        };
      },

      getMostUsedRoutes: (limit = 5) => {
        const state = get();
        const routeCounts = state.routeHistory.reduce((acc, route) => {
          acc[route] = (acc[route] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return Object.entries(routeCounts)
          .map(([route, count]) => ({ route, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      }
    }),
    {
      name: 'navigation-storage',
      partialize: (state) => ({
        favoriteRoutes: state.favoriteRoutes,
        recentRoutes: state.recentRoutes,
        viewMode: state.viewMode,
        showBadges: state.showBadges,
        routeHistory: state.routeHistory.slice(-20) // 持久化最近20条历史
      })
    }
  )
);
```

#### 2.2 面包屑导航和快速访问 (2小时)

**2.2.1 面包屑组件**
```tsx
// src/components/navigation/Breadcrumb.tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Chip, IconButton } from 'react-native-paper';
import { useNavigationStore } from '@/stores/navigationStore';
import { getAccessibleNavigation } from '@/config/navigationConfig';
import { useAuthStore } from '@/stores/authStore';

interface BreadcrumbProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  maxItems?: number;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentRoute,
  onNavigate,
  maxItems = 4
}) => {
  const { user, permissions, userType } = useAuthStore();
  const { routeHistory } = useNavigationStore();

  // 构建面包屑路径
  const breadcrumbPath = React.useMemo(() => {
    if (!user || !permissions) return [];

    const navigation = getAccessibleNavigation(
      userType as any,
      permissions.role as any,
      permissions
    );

    const findRouteInNavigation = (items: any[], targetRoute: string): any[] => {
      for (const item of items) {
        if (item.route === targetRoute) {
          return [item];
        }
        if (item.children) {
          const childResult = findRouteInNavigation(item.children, targetRoute);
          if (childResult.length > 0) {
            return [item, ...childResult];
          }
        }
      }
      return [];
    };

    const routePath = findRouteInNavigation(navigation, currentRoute);
    
    // 限制面包屑长度
    if (routePath.length > maxItems) {
      return [
        routePath[0],
        { id: 'ellipsis', title: '...', route: '', icon: 'dots-horizontal' },
        ...routePath.slice(-maxItems + 2)
      ];
    }
    
    return routePath;
  }, [currentRoute, user, permissions, userType, maxItems]);

  const handleBreadcrumbClick = (route: string) => {
    if (route && route !== currentRoute) {
      onNavigate(route);
    }
  };

  if (breadcrumbPath.length <= 1) {
    return null; // 不显示单级面包屑
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.breadcrumbContent}
      >
        {breadcrumbPath.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && (
              <IconButton
                icon="chevron-right"
                size={16}
                iconColor="#666"
                style={styles.separator}
              />
            )}
            
            <Chip
              mode={item.route === currentRoute ? 'flat' : 'outlined'}
              selected={item.route === currentRoute}
              disabled={item.id === 'ellipsis'}
              onPress={() => handleBreadcrumbClick(item.route)}
              style={[
                styles.breadcrumbChip,
                item.route === currentRoute && styles.currentChip
              ]}
              textStyle={[
                styles.chipText,
                item.route === currentRoute && styles.currentChipText
              ]}
              icon={item.icon}
              compact
            >
              {item.title}
            </Chip>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  breadcrumbContent: {
    alignItems: 'center',
    paddingHorizontal: 16
  },
  breadcrumbChip: {
    marginHorizontal: 2
  },
  currentChip: {
    backgroundColor: '#E3F2FD'
  },
  chipText: {
    fontSize: 14,
    color: '#666'
  },
  currentChipText: {
    color: '#1976D2',
    fontWeight: 'bold'
  },
  separator: {
    margin: 0,
    width: 24,
    height: 24
  }
});
```

**2.2.2 快速访问组件**
```tsx
// src/components/navigation/QuickAccess.tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, IconButton, Badge, Chip } from 'react-native-paper';
import { useNavigationStore } from '@/stores/navigationStore';
import { useAuthStore } from '@/stores/authStore';

interface QuickAccessProps {
  onNavigate: (route: string) => void;
  maxItems?: number;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  onNavigate,
  maxItems = 6
}) => {
  const { 
    favoriteRoutes, 
    recentRoutes, 
    getMostUsedRoutes,
    addFavoriteRoute,
    removeFavoriteRoute 
  } = useNavigationStore();
  
  const { permissions } = useAuthStore();

  // 获取常用路由
  const mostUsedRoutes = React.useMemo(() => {
    return getMostUsedRoutes(maxItems);
  }, [getMostUsedRoutes, maxItems]);

  // 智能推荐路由
  const recommendedRoutes = React.useMemo(() => {
    const allRoutes = new Set([
      ...favoriteRoutes,
      ...recentRoutes.slice(0, 3),
      ...mostUsedRoutes.map(r => r.route)
    ]);
    
    return Array.from(allRoutes).slice(0, maxItems);
  }, [favoriteRoutes, recentRoutes, mostUsedRoutes, maxItems]);

  const getRouteInfo = (route: string) => {
    // 这里可以从导航配置中获取路由信息
    const routeInfoMap: Record<string, { title: string; icon: string }> = {
      'FactoryDashboard': { title: '工厂概览', icon: 'view-dashboard' },
      'FactoryUserManagement': { title: '用户管理', icon: 'account-group' },
      'WhitelistManagement': { title: '白名单', icon: 'shield-check' },
      'PlatformDashboard': { title: '平台概览', icon: 'view-dashboard' },
      'FactoryManagement': { title: '工厂管理', icon: 'factory' },
      'LivestockManagement': { title: '牲畜管理', icon: 'cow' },
      'ProductionBatches': { title: '生产批次', icon: 'factory' },
      'TraceQuery': { title: '溯源查询', icon: 'qrcode-scan' }
    };
    
    return routeInfoMap[route] || { title: route, icon: 'circle' };
  };

  const handleRoutePress = (route: string) => {
    onNavigate(route);
  };

  const handleFavoriteToggle = (route: string) => {
    if (favoriteRoutes.includes(route)) {
      removeFavoriteRoute(route);
    } else {
      addFavoriteRoute(route);
    }
  };

  return (
    <Card style={styles.container}>
      <Card.Title title="快速访问" subtitle="常用功能和最近访问" />
      <Card.Content>
        {/* 收藏夹 */}
        {favoriteRoutes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>收藏夹</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.routeList}>
                {favoriteRoutes.slice(0, maxItems).map(route => {
                  const routeInfo = getRouteInfo(route);
                  return (
                    <Card key={route} style={styles.routeCard}>
                      <Card.Content style={styles.routeContent}>
                        <IconButton
                          icon={routeInfo.icon}
                          size={24}
                          onPress={() => handleRoutePress(route)}
                          style={styles.routeIcon}
                        />
                        <Text style={styles.routeTitle} numberOfLines={1}>
                          {routeInfo.title}
                        </Text>
                        <Badge style={styles.favoriteBadge}>★</Badge>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 最近访问 */}
        {recentRoutes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>最近访问</Text>
            <View style={styles.chipContainer}>
              {recentRoutes.slice(0, maxItems).map(route => {
                const routeInfo = getRouteInfo(route);
                return (
                  <Chip
                    key={route}
                    icon={routeInfo.icon}
                    onPress={() => handleRoutePress(route)}
                    style={styles.recentChip}
                    textStyle={styles.chipText}
                  >
                    {routeInfo.title}
                  </Chip>
                );
              })}
            </View>
          </View>
        )}

        {/* 常用功能 */}
        {mostUsedRoutes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>常用功能</Text>
            <View style={styles.routeGrid}>
              {mostUsedRoutes.slice(0, 4).map(({ route, count }) => {
                const routeInfo = getRouteInfo(route);
                const isFavorite = favoriteRoutes.includes(route);
                
                return (
                  <Card key={route} style={styles.gridCard}>
                    <Card.Content style={styles.gridContent}>
                      <View style={styles.gridHeader}>
                        <IconButton
                          icon={routeInfo.icon}
                          size={20}
                          onPress={() => handleRoutePress(route)}
                        />
                        <IconButton
                          icon={isFavorite ? 'star' : 'star-outline'}
                          size={16}
                          iconColor={isFavorite ? '#FF9800' : '#999'}
                          onPress={() => handleFavoriteToggle(route)}
                        />
                      </View>
                      <Text style={styles.gridTitle} numberOfLines={2}>
                        {routeInfo.title}
                      </Text>
                      <Text style={styles.usageCount}>使用 {count} 次</Text>
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333'
  },
  routeList: {
    flexDirection: 'row'
  },
  routeCard: {
    width: 100,
    marginRight: 8
  },
  routeContent: {
    alignItems: 'center',
    padding: 8
  },
  routeIcon: {
    margin: 0
  },
  routeTitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333'
  },
  favoriteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF9800'
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  recentChip: {
    margin: 4
  },
  chipText: {
    fontSize: 12
  },
  routeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  gridCard: {
    width: '48%',
    marginBottom: 8
  },
  gridContent: {
    padding: 12
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  usageCount: {
    fontSize: 12,
    color: '#666'
  }
});
```

## 🏆 交付物

### 技术交付物
- [ ] **权限导航配置** (navigationConfig.ts) - 基于角色的导航结构
- [ ] **动态导航组件** (DynamicNavigation.tsx) - 权限控制的导航菜单
- [ ] **导航状态管理** (navigationStore.ts) - 导航状态全局管理
- [ ] **面包屑导航** (Breadcrumb.tsx) - 层级导航指示
- [ ] **快速访问组件** (QuickAccess.tsx) - 智能推荐和快捷访问

### 功能交付物
- [ ] **角色化导航** - 不同角色显示不同导航结构
- [ ] **权限菜单控制** - 基于权限动态显示/隐藏菜单
- [ ] **平台/工厂视图切换** - 平台管理员可切换视图模式
- [ ] **智能导航推荐** - 基于使用频率的智能推荐
- [ ] **导航状态持久化** - 保存用户导航偏好和历史

### 用户体验交付物
- [ ] **直观的导航结构** - 清晰的层级和分组
- [ ] **快速访问机制** - 收藏夹和最近访问
- [ ] **响应式导航设计** - 适配不同屏幕尺寸
- [ ] **流畅的导航动画** - 平滑的切换效果
- [ ] **导航状态指示** - 当前位置和路径清晰显示

## ✅ 验收标准

### 功能完整性验证
- [ ] 不同角色显示正确的导航结构
- [ ] 权限控制正确隐藏无权限菜单项
- [ ] 面包屑导航准确显示当前路径
- [ ] 快速访问功能正常工作
- [ ] 导航状态正确持久化

### 权限安全验证
- [ ] 无权限菜单完全不可见
- [ ] 权限变更后导航即时更新
- [ ] 不能通过导航绕过权限控制
- [ ] 视图切换权限检查有效

### 用户体验验证
- [ ] 导航操作响应流畅
- [ ] 视觉设计统一美观
- [ ] 导航逻辑清晰易懂
- [ ] 支持键盘和辅助功能导航
- [ ] 不同屏幕尺寸正确显示

### 性能验证
- [ ] 导航渲染时间 < 100ms
- [ ] 权限检查不影响导航响应
- [ ] 导航状态管理内存使用合理
- [ ] 大量菜单项时性能稳定

## 📊 时间分配

| 阶段 | 内容 | 预计时间 | 关键交付物 |
|------|------|----------|-----------|
| 上午前半 | 导航架构设计 | 2小时 | navigationConfig.ts |
| 上午后半 | 动态导航组件 | 2小时 | DynamicNavigation.tsx |
| 下午前半 | 导航状态管理 | 2小时 | navigationStore.ts |
| 下午后半 | 面包屑和快速访问 | 2小时 | Breadcrumb.tsx, QuickAccess.tsx |
| **总计** | **导航系统完整实现** | **8小时** | **完整导航功能** |

## 🚨 风险与对策

### 技术风险
- **风险**: 导航权限检查影响性能
- **对策**: 权限缓存机制，异步权限验证

- **风险**: 复杂导航结构难以维护
- **对策**: 清晰的配置结构，模块化设计

### 用户体验风险
- **风险**: 导航层级过深影响使用
- **对策**: 智能推荐机制，快速访问功能

- **风险**: 权限变更导致导航混乱
- **对策**: 平滑的导航更新，状态保持

## 🔄 与其他任务的接口

### 输入依赖
- **TASK-RN-005**: 权限控制系统和权限检查API
- **TASK-RN-004**: 登录系统和用户状态管理
- **TASK-RN-003**: 认证架构和用户类型定义

### 输出到后续任务
- **TASK-RN-007**: API客户端使用导航状态
- **TASK-RN-008**: 用户管理界面集成导航组件
- **所有业务页面**: 使用导航组件和路由保护

## 📝 开发检查点

### 上午检查点
- [ ] 导航配置是否完整准确
- [ ] 动态导航组件是否正确渲染
- [ ] 权限控制是否有效工作
- [ ] 视图切换功能是否正常

### 下午检查点
- [ ] 导航状态管理是否稳定
- [ ] 面包屑导航是否准确
- [ ] 快速访问功能是否实用
- [ ] 整体用户体验是否流畅

## 📞 技术支持

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**参考资料**: 
- TASK-RN-005权限控制系统: `TASK-RN-005-permission-system.md`
- React Navigation文档: https://reactnavigation.org/
- 导航设计最佳实践

---

**任务创建时间**: 2025-08-05
**计划开始时间**: TASK-RN-005完成后
**计划完成时间**: 开始后1个工作日

*此任务是用户体验的重要组成部分，提供直观高效的应用导航体验。*