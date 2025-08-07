# TASK-RN-018: 权限与导航系统完善

> React Native Android开发 - Phase 2 Week 3
>
> 任务编号: TASK-RN-018
> 工期: 2.5天 (20小时)
> 优先级: 高
> 状态: 待开始
> 依赖: TASK-RN-017

## 🎯 任务目标

完善整个应用的权限控制和导航系统，实现基于用户角色的动态导航菜单、细粒度权限控制、友好的权限提示，确保系统安全性和用户体验的平衡。

## 📋 具体工作内容

### 1. 动态导航菜单实现 (6小时)

#### 导航配置管理器
```typescript
// src/navigation/NavigationConfig.ts
import { UserRole } from '@/types/auth';

interface NavigationItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  requiredRoles: UserRole[];
  requiredPermissions: string[];
  badge?: string | number;
  children?: NavigationItem[];
  order: number;
}

interface NavigationConfig {
  tabItems: NavigationItem[];
  drawerItems: NavigationItem[];
  headerActions: NavigationItem[];
}

class NavigationConfigManager {
  private baseConfig: NavigationConfig = {
    tabItems: [
      {
        id: 'home',
        title: '首页',
        icon: '🏠',
        route: 'Home',
        requiredRoles: ['platform_admin', 'factory_admin', 'employee', 'quality_inspector', 'production_manager', 'developer'],
        requiredPermissions: [],
        order: 1
      },
      {
        id: 'processing',
        title: '加工',
        icon: '🏭',
        route: 'Processing',
        requiredRoles: ['factory_admin', 'employee', 'production_manager'],
        requiredPermissions: ['processing.view'],
        order: 2
      },
      {
        id: 'farming',
        title: '养殖',
        icon: '🌾',
        route: 'Farming',
        requiredRoles: ['factory_admin', 'employee'],
        requiredPermissions: ['farming.view'],
        order: 3
      },
      {
        id: 'logistics',
        title: '物流',
        icon: '🚚',
        route: 'Logistics',
        requiredRoles: ['factory_admin', 'employee'],
        requiredPermissions: ['logistics.view'],
        order: 4
      },
      {
        id: 'sales',
        title: '销售',
        icon: '💰',
        route: 'Sales',
        requiredRoles: ['factory_admin', 'employee'],
        requiredPermissions: ['sales.view'],
        order: 5
      }
    ],
    drawerItems: [
      {
        id: 'admin',
        title: '系统管理',
        icon: '⚙️',
        route: 'AdminDashboard',
        requiredRoles: ['platform_admin', 'factory_admin'],
        requiredPermissions: ['admin.view'],
        order: 10,
        children: [
          {
            id: 'user_management',
            title: '用户管理',
            icon: '👥',
            route: 'UserManagement',
            requiredRoles: ['platform_admin', 'factory_admin'],
            requiredPermissions: ['users.manage'],
            order: 11
          },
          {
            id: 'whitelist',
            title: '白名单管理',
            icon: '📱',
            route: 'WhitelistManagement',
            requiredRoles: ['platform_admin', 'factory_admin'],
            requiredPermissions: ['whitelist.manage'],
            order: 12
          }
        ]
      }
    ],
    headerActions: []
  };

  // 根据用户权限生成导航配置
  generateNavigationForUser(user: User): NavigationConfig {
    return {
      tabItems: this.filterNavigationItems(this.baseConfig.tabItems, user),
      drawerItems: this.filterNavigationItems(this.baseConfig.drawerItems, user),
      headerActions: this.filterNavigationItems(this.baseConfig.headerActions, user)
    };
  }

  private filterNavigationItems(items: NavigationItem[], user: User): NavigationItem[] {
    return items
      .filter(item => this.hasRequiredAccess(item, user))
      .map(item => ({
        ...item,
        children: item.children ? this.filterNavigationItems(item.children, user) : undefined
      }))
      .sort((a, b) => a.order - b.order);
  }

  private hasRequiredAccess(item: NavigationItem, user: User): boolean {
    // 检查角色权限
    const hasRole = item.requiredRoles.includes(user.role);
    if (!hasRole) return false;

    // 检查细粒度权限
    if (item.requiredPermissions.length > 0) {
      return item.requiredPermissions.every(permission => 
        user.permissions.includes(permission)
      );
    }

    return true;
  }

  // 更新导航项的徽章
  updateNavigationBadge(itemId: string, badge: string | number | undefined): void {
    this.updateItemBadge(this.baseConfig.tabItems, itemId, badge);
    this.updateItemBadge(this.baseConfig.drawerItems, itemId, badge);
  }

  private updateItemBadge(items: NavigationItem[], itemId: string, badge: string | number | undefined): void {
    for (const item of items) {
      if (item.id === itemId) {
        item.badge = badge;
        return;
      }
      if (item.children) {
        this.updateItemBadge(item.children, itemId, badge);
      }
    }
  }
}

export const navigationConfigManager = new NavigationConfigManager();
```

#### 动态Tab导航器
```typescript
// src/navigation/DynamicTabNavigator.tsx
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '@/store/authStore';
import { navigationConfigManager } from './NavigationConfig';

const Tab = createBottomTabNavigator();

export function DynamicTabNavigator() {
  const { user } = useAuthStore();
  const [navigationConfig, setNavigationConfig] = useState(null);

  useEffect(() => {
    if (user) {
      const config = navigationConfigManager.generateNavigationForUser(user);
      setNavigationConfig(config);
    }
  }, [user]);

  if (!navigationConfig || !user) {
    return <LoadingScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const item = navigationConfig.tabItems.find(item => item.route === route.name);
          return (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: size, color }}>{item?.icon}</Text>
              {item?.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#757575',
        headerShown: false,
      })}
    >
      {navigationConfig.tabItems.map((item) => (
        <Tab.Screen
          key={item.id}
          name={item.route}
          component={getScreenComponent(item.route)}
          options={{
            title: item.title,
            tabBarBadge: item.badge ? item.badge : undefined,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

// 根据路由名获取组件
function getScreenComponent(routeName: string) {
  const componentMap = {
    'Home': HomeScreen,
    'Processing': ProcessingNavigator,
    'Farming': FarmingPlaceholder,
    'Logistics': LogisticsPlaceholder,
    'Sales': SalesPlaceholder,
  };

  return componentMap[routeName] || NotFoundScreen;
}
```

### 2. 细粒度权限控制 (6小时)

#### 权限检查钩子
```typescript
// src/hooks/usePermissions.ts
import { useAuthStore } from '@/store/authStore';
import { useMemo } from 'react';

interface PermissionResult {
  hasPermission: boolean;
  hasRole: boolean;
  canAccess: boolean;
  reason?: string;
}

export function usePermissions() {
  const { user } = useAuthStore();

  const checkPermission = useMemo(() => {
    return (permission: string): PermissionResult => {
      if (!user) {
        return {
          hasPermission: false,
          hasRole: false,
          canAccess: false,
          reason: '用户未登录'
        };
      }

      const hasPermission = user.permissions.includes(permission);
      
      return {
        hasPermission,
        hasRole: true,
        canAccess: hasPermission,
        reason: hasPermission ? undefined : '权限不足'
      };
    };
  }, [user]);

  const checkRole = useMemo(() => {
    return (roles: string | string[]): PermissionResult => {
      if (!user) {
        return {
          hasPermission: false,
          hasRole: false,
          canAccess: false,
          reason: '用户未登录'
        };
      }

      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      const hasRole = requiredRoles.includes(user.role);

      return {
        hasPermission: hasRole,
        hasRole,
        canAccess: hasRole,
        reason: hasRole ? undefined : '角色权限不足'
      };
    };
  }, [user]);

  const checkModuleAccess = useMemo(() => {
    return (module: string, level: number = 0): PermissionResult => {
      if (!user) {
        return {
          hasPermission: false,
          hasRole: false,
          canAccess: false,
          reason: '用户未登录'
        };
      }

      // 检查模块权限
      const modulePermission = `${module}.view`;
      const hasModulePermission = user.permissions.includes(modulePermission);

      // 检查权限级别
      const userLevel = user.permissionLevel || 0;
      const hasRequiredLevel = userLevel >= level;

      const canAccess = hasModulePermission && hasRequiredLevel;

      return {
        hasPermission: hasModulePermission,
        hasRole: hasRequiredLevel,
        canAccess,
        reason: !canAccess ? 
          (!hasModulePermission ? '无模块访问权限' : '权限级别不足') : 
          undefined
      };
    };
  }, [user]);

  return {
    checkPermission,
    checkRole,
    checkModuleAccess,
    user,
    isAuthenticated: !!user
  };
}
```

#### 权限组件包装器
```typescript
// src/components/permissions/PermissionWrapper.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionWrapperProps {
  children: React.ReactNode;
  permission?: string;
  role?: string | string[];
  module?: string;
  level?: number;
  fallback?: React.ReactNode;
  showReason?: boolean;
  requireAll?: boolean; // 是否需要满足所有条件
}

export function PermissionWrapper({
  children,
  permission,
  role,
  module,
  level = 0,
  fallback,
  showReason = false,
  requireAll = false
}: PermissionWrapperProps) {
  const { checkPermission, checkRole, checkModuleAccess } = usePermissions();

  const results = [];

  if (permission) {
    results.push(checkPermission(permission));
  }

  if (role) {
    results.push(checkRole(role));
  }

  if (module) {
    results.push(checkModuleAccess(module, level));
  }

  // 如果没有任何权限检查，默认允许访问
  if (results.length === 0) {
    return <>{children}</>;
  }

  // 根据requireAll决定逻辑
  const hasAccess = requireAll 
    ? results.every(result => result.canAccess)
    : results.some(result => result.canAccess);

  if (hasAccess) {
    return <>{children}</>;
  }

  // 显示fallback或权限不足提示
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showReason) {
    const reason = results.find(result => result.reason)?.reason || '权限不足';
    return (
      <View style={styles.permissionDenied}>
        <Text style={styles.permissionDeniedText}>🔒</Text>
        <Text style={styles.permissionReasonText}>{reason}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  permissionDenied: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16
  },
  permissionDeniedText: {
    fontSize: 48,
    marginBottom: 8
  },
  permissionReasonText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  }
});
```

### 3. 按钮级权限控制 (4小时)

#### 权限按钮组件
```typescript
// src/components/permissions/PermissionButton.tsx
import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Alert } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionButtonProps {
  title: string;
  onPress: () => void;
  permission?: string;
  role?: string | string[];
  module?: string;
  level?: number;
  style?: any;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  showTooltip?: boolean;
}

export function PermissionButton({
  title,
  onPress,
  permission,
  role,
  module,
  level = 0,
  style,
  disabled = false,
  variant = 'primary',
  showTooltip = true
}: PermissionButtonProps) {
  const { checkPermission, checkRole, checkModuleAccess } = usePermissions();

  // 检查权限
  const getPermissionResult = () => {
    if (permission) {
      return checkPermission(permission);
    }
    if (role) {
      return checkRole(role);
    }
    if (module) {
      return checkModuleAccess(module, level);
    }
    return { canAccess: true };
  };

  const permissionResult = getPermissionResult();
  const canAccess = permissionResult.canAccess && !disabled;

  const handlePress = () => {
    if (!canAccess) {
      if (showTooltip && permissionResult.reason) {
        Alert.alert('权限不足', permissionResult.reason);
      }
      return;
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        !canAccess && styles.disabled,
        style
      ]}
      onPress={handlePress}
      activeOpacity={canAccess ? 0.7 : 1}
    >
      <Text style={[
        styles.buttonText,
        styles[`${variant}Text`],
        !canAccess && styles.disabledText
      ]}>
        {title}
      </Text>
      {!canAccess && (
        <View style={styles.lockIcon}>
          <Text style={styles.lockIconText}>🔒</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 48
  },
  primary: {
    backgroundColor: '#1976d2'
  },
  secondary: {
    backgroundColor: '#757575'
  },
  danger: {
    backgroundColor: '#d32f2f'
  },
  disabled: {
    backgroundColor: '#e0e0e0'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  primaryText: {
    color: '#ffffff'
  },
  secondaryText: {
    color: '#ffffff'
  },
  dangerText: {
    color: '#ffffff'
  },
  disabledText: {
    color: '#9e9e9e'
  },
  lockIcon: {
    marginLeft: 8
  },
  lockIconText: {
    fontSize: 12
  }
});
```

### 4. 权限提示系统 (2小时)

#### 权限提示管理器
```typescript
// src/services/permissionHintService.ts
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PermissionHint {
  id: string;
  title: string;
  message: string;
  action?: {
    text: string;
    onPress: () => void;
  };
  showOnce?: boolean;
  priority: 'low' | 'medium' | 'high';
}

class PermissionHintService {
  private shownHints: Set<string> = new Set();

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('shown_permission_hints');
      if (stored) {
        this.shownHints = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('加载权限提示记录失败:', error);
    }
  }

  async showPermissionHint(hint: PermissionHint): Promise<void> {
    if (hint.showOnce && this.shownHints.has(hint.id)) {
      return;
    }

    Alert.alert(
      hint.title,
      hint.message,
      [
        {
          text: '了解',
          style: 'default'
        },
        ...(hint.action ? [{
          text: hint.action.text,
          onPress: hint.action.onPress
        }] : [])
      ]
    );

    if (hint.showOnce) {
      this.shownHints.add(hint.id);
      await this.saveShownHints();
    }
  }

  // 显示角色权限不足提示
  showRoleInsufficientHint(requiredRole: string, currentRole: string): void {
    const hint: PermissionHint = {
      id: `role_insufficient_${requiredRole}`,
      title: '权限不足',
      message: `此功能需要 ${this.getRoleDisplayName(requiredRole)} 权限，您当前是 ${this.getRoleDisplayName(currentRole)}`,
      showOnce: false,
      priority: 'medium'
    };

    this.showPermissionHint(hint);
  }

  // 显示功能权限不足提示
  showFeaturePermissionHint(feature: string): void {
    const hint: PermissionHint = {
      id: `feature_permission_${feature}`,
      title: '功能受限',
      message: `您暂时无法使用 ${this.getFeatureDisplayName(feature)} 功能，请联系管理员开通权限`,
      action: {
        text: '联系管理员',
        onPress: () => this.contactAdmin()
      },
      showOnce: true,
      priority: 'high'
    };

    this.showPermissionHint(hint);
  }

  // 显示首次使用提示
  showFirstTimeHint(feature: string): void {
    const hints = {
      processing: {
        id: 'first_time_processing',
        title: '欢迎使用加工模块',
        message: '您可以在这里录入生产数据、查看设备状态和获取智能分析建议',
        showOnce: true,
        priority: 'low' as const
      },
      qr_scanner: {
        id: 'first_time_qr_scanner',
        title: '二维码扫描提示',
        message: '将二维码置于框内即可自动识别，也可以点击"手动输入"按钮',
        showOnce: true,
        priority: 'medium' as const
      }
    };

    const hint = hints[feature];
    if (hint) {
      this.showPermissionHint(hint);
    }
  }

  private async saveShownHints(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'shown_permission_hints',
        JSON.stringify(Array.from(this.shownHints))
      );
    } catch (error) {
      console.error('保存权限提示记录失败:', error);
    }
  }

  private getRoleDisplayName(role: string): string {
    const roleNames = {
      'platform_admin': '平台管理员',
      'factory_admin': '工厂管理员',
      'production_manager': '生产经理',
      'quality_inspector': '质检员',
      'employee': '员工',
      'developer': '开发者'
    };
    return roleNames[role] || role;
  }

  private getFeatureDisplayName(feature: string): string {
    const featureNames = {
      'processing.create': '创建生产记录',
      'processing.edit': '编辑生产记录',
      'processing.delete': '删除生产记录',
      'quality.inspect': '质量检测',
      'admin.users': '用户管理',
      'admin.system': '系统设置'
    };
    return featureNames[feature] || feature;
  }

  private contactAdmin(): void {
    // 可以集成邮件、聊天或工单系统
    Alert.alert(
      '联系管理员',
      '请联系您的系统管理员开通相关权限\n\n管理员邮箱: admin@company.com',
      [
        { text: '知道了' }
      ]
    );
  }
}

export const permissionHintService = new PermissionHintService();
```

### 5. 导航状态管理 (2小时)

#### 导航状态存储
```typescript
// src/store/navigationStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavigationState {
  currentRoute: string;
  routeHistory: string[];
  navigationConfig: NavigationConfig | null;
  badges: Map<string, string | number>;
  
  // Actions
  setCurrentRoute: (route: string) => void;
  updateNavigationConfig: (config: NavigationConfig) => void;
  setBadge: (itemId: string, badge: string | number | undefined) => void;
  clearBadge: (itemId: string) => void;
  goBack: () => string | null;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set, get) => ({
      currentRoute: '',
      routeHistory: [],
      navigationConfig: null,
      badges: new Map(),

      setCurrentRoute: (route) => set(state => ({
        currentRoute: route,
        routeHistory: [...state.routeHistory.slice(-9), route] // 保留最近10个路由
      })),

      updateNavigationConfig: (config) => set({ navigationConfig: config }),

      setBadge: (itemId, badge) => set(state => {
        const newBadges = new Map(state.badges);
        if (badge !== undefined) {
          newBadges.set(itemId, badge);
        } else {
          newBadges.delete(itemId);
        }
        return { badges: newBadges };
      }),

      clearBadge: (itemId) => set(state => {
        const newBadges = new Map(state.badges);
        newBadges.delete(itemId);
        return { badges: newBadges };
      }),

      goBack: () => {
        const { routeHistory } = get();
        if (routeHistory.length > 1) {
          const previousRoute = routeHistory[routeHistory.length - 2];
          set(state => ({
            currentRoute: previousRoute,
            routeHistory: state.routeHistory.slice(0, -1)
          }));
          return previousRoute;
        }
        return null;
      }
    }),
    {
      name: 'navigation-storage',
      partialize: (state) => ({
        routeHistory: state.routeHistory.slice(-5), // 只持久化最近5个路由
        badges: Object.fromEntries(Array.from(state.badges.entries()))
      })
    }
  )
);
```

## ✅ 验收标准

### 功能验收
- [ ] **动态导航**: 根据用户角色动态生成导航菜单
- [ ] **权限控制**: 细粒度权限控制正常工作
- [ ] **按钮权限**: 按钮级权限控制有效
- [ ] **权限提示**: 友好的权限不足提示
- [ ] **导航状态**: 导航状态正确管理和持久化

### 安全性验收
- [ ] **权限验证**: 所有敏感操作都有权限验证
- [ ] **角色隔离**: 不同角色只能访问授权功能
- [ ] **数据保护**: 敏感数据有访问控制
- [ ] **操作审计**: 重要操作有权限记录

### 用户体验验收
- [ ] **导航清晰**: 用户能轻松找到可用功能
- [ ] **权限透明**: 用户清楚知道自己的权限范围
- [ ] **提示友好**: 权限不足时有清晰说明
- [ ] **操作流畅**: 权限检查不影响操作体验

## 🔗 依赖关系

### 输入依赖
- TASK-RN-017 移动端特色功能完成
- Phase 1 认证系统和权限架构
- 用户角色和权限配置

### 输出交付
- 完整的权限控制系统
- 动态导航系统
- 用户友好的权限提示
- 安全可靠的访问控制

---

**任务负责人**: [待分配]
**预估开始时间**: TASK-RN-017完成后
**预估完成时间**: 2.5个工作日后

*本任务完成后，整个应用将具备完善的权限控制和导航系统，确保安全性和易用性的完美平衡。*