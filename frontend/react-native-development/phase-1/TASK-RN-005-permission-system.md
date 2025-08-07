# TASK-RN-005: 权限控制系统

> React Native Android开发 - 权限控制系统实现任务
>
> 创建时间: 2025-08-05
> 预计工期: 2天 (16小时)
> 优先级: 高
> 状态: 待开始

## 📋 任务概述

基于TASK-RN-003认证架构和TASK-RN-004登录系统，实现完整的权限控制系统，包括权限守卫组件、动态权限检查、权限状态管理和权限相关UI组件。

## 🎯 任务目标

- 建立完整的权限守卫和路由保护机制
- 实现动态权限检查和实时权限验证
- 创建权限状态全局管理系统
- 开发权限相关UI组件和交互界面
- 确保权限系统与web端完全对等

## 📋 详细步骤

### **Day 1: 权限守卫和路由保护** (8小时)

#### 1.1 权限守卫组件 (3小时)

**1.1.1 基础权限守卫**
```tsx
// src/components/auth/PermissionGuard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission, canAccessDepartment } from '@/utils/permissions';
import { UserRole, UserPermissions } from '@/types/auth';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: UserRole;
  requiredDepartment?: string;
  fallback?: React.ReactNode;
  showFallback?: boolean;
  onPermissionDenied?: () => void;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  requiredRole,
  requiredDepartment,
  fallback,
  showFallback = true,
  onPermissionDenied
}) => {
  const { user, permissions, userType } = useAuthStore();

  // 检查用户是否已登录
  if (!user || !permissions) {
    return showFallback ? (
      <PermissionDeniedFallback 
        reason="未登录"
        message="请先登录系统"
      />
    ) : null;
  }

  // 检查角色权限
  if (requiredRole && !checkRolePermission(permissions, requiredRole)) {
    onPermissionDenied?.();
    return showFallback ? (
      fallback || (
        <PermissionDeniedFallback 
          reason="角色权限不足"
          message={`需要${requiredRole}角色权限`}
        />
      )
    ) : null;
  }

  // 检查特定权限
  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    onPermissionDenied?.();
    return showFallback ? (
      fallback || (
        <PermissionDeniedFallback 
          reason="操作权限不足"
          message="您没有执行此操作的权限"
        />
      )
    ) : null;
  }

  // 检查部门访问权限
  if (requiredDepartment && !canAccessDepartment(user, requiredDepartment)) {
    onPermissionDenied?.();
    return showFallback ? (
      fallback || (
        <PermissionDeniedFallback 
          reason="部门权限不足"
          message={`无权访问${requiredDepartment}部门数据`}
        />
      )
    ) : null;
  }

  return <>{children}</>;
};

// 权限被拒绝时的回退组件
const PermissionDeniedFallback: React.FC<{
  reason: string;
  message: string;
}> = ({ reason, message }) => (
  <Card style={styles.deniedCard}>
    <Card.Content style={styles.deniedContent}>
      <Text style={styles.deniedTitle}>访问受限</Text>
      <Text style={styles.deniedMessage}>{message}</Text>
      <Text style={styles.deniedReason}>原因: {reason}</Text>
      <Button 
        mode="outlined" 
        onPress={() => {/* 返回上一页或首页 */}}
        style={styles.backButton}
      >
        返回
      </Button>
    </Card.Content>
  </Card>
);

// 检查角色权限
function checkRolePermission(permissions: UserPermissions, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'platform_super_admin': 0,
    'platform_operator': 10,
    'factory_super_admin': 20,
    'permission_admin': 30,
    'department_admin': 40,
    'operator': 50,
    'viewer': 60
  };

  const userRoleLevel = roleHierarchy[permissions.role as UserRole] ?? 100;
  const requiredRoleLevel = roleHierarchy[requiredRole] ?? 0;

  return userRoleLevel <= requiredRoleLevel;
}
```

**1.1.2 路由权限守卫**
```tsx
// src/components/navigation/ProtectedRoute.tsx
import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { NavigationProp } from '@react-navigation/native';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: UserRole;
  requiredModule?: keyof UserPermissions['modules'];
  navigation: NavigationProp<any>;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  requiredModule,
  navigation,
  redirectTo = 'Login'
}) => {
  const { isAuthenticated, permissions } = useAuthStore();

  // 未登录重定向到登录页
  if (!isAuthenticated) {
    React.useEffect(() => {
      navigation.navigate(redirectTo);
    }, []);
    return null;
  }

  // 检查模块访问权限
  if (requiredModule && permissions && !permissions.modules[requiredModule]) {
    return (
      <PermissionGuard
        requiredPermission="module_access_denied"
        fallback={
          <ModuleAccessDenied 
            moduleName={requiredModule}
            onNavigateBack={() => navigation.goBack()}
          />
        }
      />
    );
  }

  return (
    <PermissionGuard
      requiredPermission={requiredPermission}
      requiredRole={requiredRole}
      onPermissionDenied={() => {
        // 可选择重定向到无权限页面
        console.warn('Permission denied for route');
      }}
    >
      {children}
    </PermissionGuard>
  );
};

// 模块访问被拒绝组件
const ModuleAccessDenied: React.FC<{
  moduleName: string;
  onNavigateBack: () => void;
}> = ({ moduleName, onNavigateBack }) => (
  <View style={styles.moduleAccessDenied}>
    <Text style={styles.moduleTitle}>模块访问受限</Text>
    <Text style={styles.moduleMessage}>
      您的角色无权访问{moduleName}模块
    </Text>
    <Button mode="contained" onPress={onNavigateBack}>
      返回
    </Button>
  </View>
);
```

#### 1.2 动态权限检查 (3小时)

**1.2.1 权限检查Hook**
```tsx
// src/hooks/usePermissions.ts
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { 
  hasPermission, 
  canAccessDepartment, 
  generateDataFilter,
  calculateUserPermissions 
} from '@/utils/permissions';
import { UserRole, UserPermissions } from '@/types/auth';

export interface UsePermissionsReturn {
  // 权限检查方法
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  canAccessModule: (module: keyof UserPermissions['modules']) => boolean;
  canAccessDepartment: (department: string) => boolean;
  
  // 数据访问权限
  getDataFilter: (baseFilter?: any) => any;
  canViewAllData: () => boolean;
  canEditData: (dataOwner?: string, dataDepartment?: string) => boolean;
  canDeleteData: (dataOwner?: string, dataDepartment?: string) => boolean;
  
  // 用户管理权限
  canManageUser: (targetUser: any) => boolean;
  canAssignRole: (targetRole: UserRole) => boolean;
  canAccessUserData: (targetUser: any) => boolean;
  
  // 权限信息
  currentPermissions: UserPermissions | null;
  userType: 'platform' | 'factory' | null;
  roleLevel: number;
  departmentAccess: string;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, permissions, userType } = useAuthStore();

  const permissionChecks = useMemo(() => {
    if (!user || !permissions) {
      return createEmptyPermissionChecks();
    }

    return {
      hasPermission: (permission: string) => hasPermission(permissions, permission),
      
      hasRole: (role: UserRole) => permissions.role === role,
      
      hasAnyRole: (roles: UserRole[]) => roles.includes(permissions.role as UserRole),
      
      canAccessModule: (module: keyof UserPermissions['modules']) => 
        permissions.modules[module] === true,
      
      canAccessDepartment: (department: string) => 
        canAccessDepartment(user, department),
      
      getDataFilter: (baseFilter = {}) => 
        generateDataFilter(user, baseFilter),
      
      canViewAllData: () => 
        permissions.dataAccess === 'all' || permissions.dataAccess === 'factory_all',
      
      canEditData: (dataOwner?: string, dataDepartment?: string) => {
        // 检查编辑权限
        if (permissions.dataAccess === 'all') return true;
        if (permissions.dataAccess === 'factory_all' && user.factoryId) return true;
        if (permissions.dataAccess === 'department' && dataDepartment === user.department) return true;
        if (permissions.dataAccess === 'limited' && dataOwner === user.id) return true;
        return false;
      },
      
      canDeleteData: (dataOwner?: string, dataDepartment?: string) => {
        // 删除权限通常更严格
        if (permissions.dataAccess === 'all') return true;
        if (permissions.role === 'factory_super_admin' && user.factoryId) return true;
        if (permissions.role === 'department_admin' && dataDepartment === user.department) return true;
        return false;
      },
      
      canManageUser: (targetUser: any) => {
        // 用户管理权限检查
        if (permissions.role === 'platform_super_admin') return true;
        if (permissions.role === 'factory_super_admin' && targetUser.factoryId === user.factoryId) return true;
        if (permissions.role === 'permission_admin' && targetUser.factoryId === user.factoryId) return true;
        if (permissions.role === 'department_admin' && targetUser.department === user.department) return true;
        return false;
      },
      
      canAssignRole: (targetRole: UserRole) => {
        // 角色分配权限检查
        const roleHierarchy: Record<UserRole, number> = {
          'platform_super_admin': 0,
          'platform_operator': 10,
          'factory_super_admin': 20,
          'permission_admin': 30,
          'department_admin': 40,
          'operator': 50,
          'viewer': 60
        };
        
        const userRoleLevel = roleHierarchy[permissions.role as UserRole] ?? 100;
        const targetRoleLevel = roleHierarchy[targetRole] ?? 0;
        
        return userRoleLevel < targetRoleLevel; // 只能分配低于自己的角色
      },
      
      canAccessUserData: (targetUser: any) => {
        if (permissions.dataAccess === 'all') return true;
        if (permissions.dataAccess === 'factory_all' && targetUser.factoryId === user.factoryId) return true;
        if (targetUser.department === user.department) return true;
        return targetUser.id === user.id;
      },
      
      currentPermissions: permissions,
      userType: userType,
      roleLevel: getRoleLevel(permissions.role as UserRole),
      departmentAccess: permissions.departmentAccess || 'own'
    };
  }, [user, permissions, userType]);

  return permissionChecks;
}

// 创建空的权限检查对象
function createEmptyPermissionChecks(): UsePermissionsReturn {
  const emptyFn = () => false;
  return {
    hasPermission: emptyFn,
    hasRole: emptyFn,
    hasAnyRole: emptyFn,
    canAccessModule: emptyFn,
    canAccessDepartment: emptyFn,
    getDataFilter: () => ({}),
    canViewAllData: emptyFn,
    canEditData: emptyFn,
    canDeleteData: emptyFn,
    canManageUser: emptyFn,
    canAssignRole: emptyFn,
    canAccessUserData: emptyFn,
    currentPermissions: null,
    userType: null,
    roleLevel: 100,
    departmentAccess: 'none'
  };
}

// 获取角色等级
function getRoleLevel(role: UserRole): number {
  const roleHierarchy: Record<UserRole, number> = {
    'platform_super_admin': 0,
    'platform_operator': 10,
    'factory_super_admin': 20,
    'permission_admin': 30,
    'department_admin': 40,
    'operator': 50,
    'viewer': 60
  };
  return roleHierarchy[role] ?? 100;
}
```

#### 1.3 权限状态管理 (2小时)

**1.3.1 权限Store扩展**
```tsx
// src/stores/permissionStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserPermissions, UserRole } from '@/types/auth';

interface PermissionState {
  // 当前权限信息
  currentPermissions: UserPermissions | null;
  permissionCache: Map<string, boolean>;
  lastPermissionCheck: number;
  
  // 权限变更历史
  permissionHistory: Array<{
    timestamp: number;
    action: string;
    oldPermissions: UserPermissions | null;
    newPermissions: UserPermissions | null;
  }>;
  
  // 临时权限（如临时授权）
  temporaryPermissions: Array<{
    permission: string;
    expiresAt: number;
    grantedBy: string;
  }>;
}

interface PermissionActions {
  // 权限管理
  setPermissions: (permissions: UserPermissions) => void;
  clearPermissions: () => void;
  updatePermissions: (updates: Partial<UserPermissions>) => void;
  
  // 权限缓存
  cachePermissionCheck: (key: string, result: boolean) => void;
  getCachedPermissionCheck: (key: string) => boolean | null;
  clearPermissionCache: () => void;
  
  // 临时权限
  grantTemporaryPermission: (permission: string, durationMinutes: number, grantedBy: string) => void;
  revokeTemporaryPermission: (permission: string) => void;
  getTemporaryPermissions: () => string[];
  
  // 权限历史
  recordPermissionChange: (action: string, oldPermissions: UserPermissions | null, newPermissions: UserPermissions | null) => void;
  getPermissionHistory: () => PermissionState['permissionHistory'];
  clearPermissionHistory: () => void;
}

export const usePermissionStore = create<PermissionState & PermissionActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentPermissions: null,
      permissionCache: new Map(),
      lastPermissionCheck: 0,
      permissionHistory: [],
      temporaryPermissions: [],

      // 权限管理
      setPermissions: (permissions) => {
        const state = get();
        state.recordPermissionChange('SET_PERMISSIONS', state.currentPermissions, permissions);
        set({ 
          currentPermissions: permissions,
          lastPermissionCheck: Date.now() 
        });
      },

      clearPermissions: () => {
        const state = get();
        state.recordPermissionChange('CLEAR_PERMISSIONS', state.currentPermissions, null);
        set({ 
          currentPermissions: null,
          permissionCache: new Map(),
          temporaryPermissions: []
        });
      },

      updatePermissions: (updates) => {
        const state = get();
        if (state.currentPermissions) {
          const newPermissions = { ...state.currentPermissions, ...updates };
          state.recordPermissionChange('UPDATE_PERMISSIONS', state.currentPermissions, newPermissions);
          set({ 
            currentPermissions: newPermissions,
            lastPermissionCheck: Date.now() 
          });
        }
      },

      // 权限缓存
      cachePermissionCheck: (key, result) => {
        const state = get();
        const newCache = new Map(state.permissionCache);
        newCache.set(key, result);
        set({ permissionCache: newCache });
      },

      getCachedPermissionCheck: (key) => {
        const state = get();
        const cached = state.permissionCache.get(key);
        
        // 缓存5分钟过期
        if (cached !== undefined && Date.now() - state.lastPermissionCheck < 5 * 60 * 1000) {
          return cached;
        }
        return null;
      },

      clearPermissionCache: () => {
        set({ permissionCache: new Map() });
      },

      // 临时权限
      grantTemporaryPermission: (permission, durationMinutes, grantedBy) => {
        const state = get();
        const expiresAt = Date.now() + durationMinutes * 60 * 1000;
        const newTempPermissions = [
          ...state.temporaryPermissions.filter(p => p.permission !== permission),
          { permission, expiresAt, grantedBy }
        ];
        set({ temporaryPermissions: newTempPermissions });
      },

      revokeTemporaryPermission: (permission) => {
        const state = get();
        const newTempPermissions = state.temporaryPermissions.filter(p => p.permission !== permission);
        set({ temporaryPermissions: newTempPermissions });
      },

      getTemporaryPermissions: () => {
        const state = get();
        const now = Date.now();
        
        // 清理过期的临时权限
        const validPermissions = state.temporaryPermissions.filter(p => p.expiresAt > now);
        if (validPermissions.length !== state.temporaryPermissions.length) {
          set({ temporaryPermissions: validPermissions });
        }
        
        return validPermissions.map(p => p.permission);
      },

      // 权限历史
      recordPermissionChange: (action, oldPermissions, newPermissions) => {
        const state = get();
        const newHistory = [
          ...state.permissionHistory.slice(-50), // 保留最近50条记录
          {
            timestamp: Date.now(),
            action,
            oldPermissions,
            newPermissions
          }
        ];
        set({ permissionHistory: newHistory });
      },

      getPermissionHistory: () => get().permissionHistory,

      clearPermissionHistory: () => {
        set({ permissionHistory: [] });
      }
    }),
    {
      name: 'permission-storage',
      partialize: (state) => ({
        currentPermissions: state.currentPermissions,
        permissionHistory: state.permissionHistory.slice(-10), // 持久化最近10条历史
        temporaryPermissions: state.temporaryPermissions
      })
    }
  )
);
```

### **Day 2: 权限UI组件和高级功能** (8小时)

#### 2.1 权限相关UI组件 (4小时)

**2.1.1 权限选择器组件**
```tsx
// src/components/permission/PermissionPicker.tsx
import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { 
  Text, 
  Checkbox, 
  Card, 
  Searchbar, 
  Chip, 
  Button,
  List,
  Divider 
} from 'react-native-paper';
import { PLATFORM_PERMISSIONS, FACTORY_PERMISSIONS } from '@/config/permissions';
import { UserRole, UserType } from '@/types/auth';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionPickerProps {
  userType: UserType;
  selectedRole: UserRole;
  selectedPermissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
  onRoleChange: (role: UserRole) => void;
  disabled?: boolean;
  showRoleSelector?: boolean;
}

export const PermissionPicker: React.FC<PermissionPickerProps> = ({
  userType,
  selectedRole,
  selectedPermissions,
  onPermissionsChange,
  onRoleChange,
  disabled = false,
  showRoleSelector = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  const { canAssignRole } = usePermissions();

  // 获取可用的角色和权限
  const availableData = useMemo(() => {
    const permissionConfig = userType === 'platform_admin' ? PLATFORM_PERMISSIONS : FACTORY_PERMISSIONS;
    const roles = Object.keys(permissionConfig) as UserRole[];
    const currentRoleConfig = permissionConfig[selectedRole];
    
    return {
      roles: roles.filter(role => canAssignRole(role)),
      permissions: currentRoleConfig?.permissions || [],
      roleConfig: currentRoleConfig
    };
  }, [userType, selectedRole, canAssignRole]);

  // 权限分类
  const categorizedPermissions = useMemo(() => {
    const categories: Record<string, string[]> = {};
    
    availableData.permissions.forEach(permission => {
      const category = getPermissionCategory(permission);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(permission);
    });
    
    return categories;
  }, [availableData.permissions]);

  // 搜索过滤
  const filteredPermissions = useMemo(() => {
    if (!searchQuery) return categorizedPermissions;
    
    const filtered: Record<string, string[]> = {};
    Object.entries(categorizedPermissions).forEach(([category, permissions]) => {
      const matchingPermissions = permissions.filter(permission =>
        permission.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getPermissionDisplayName(permission).toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (matchingPermissions.length > 0) {
        filtered[category] = matchingPermissions;
      }
    });
    
    return filtered;
  }, [categorizedPermissions, searchQuery]);

  const handlePermissionToggle = (permission: string) => {
    if (disabled) return;
    
    const newPermissions = selectedPermissions.includes(permission)
      ? selectedPermissions.filter(p => p !== permission)
      : [...selectedPermissions, permission];
    
    onPermissionsChange(newPermissions);
  };

  const handleCategoryToggle = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSelectAllInCategory = (category: string) => {
    const categoryPermissions = filteredPermissions[category] || [];
    const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p));
    
    let newPermissions: string[];
    if (allSelected) {
      // 取消选择该分类的所有权限
      newPermissions = selectedPermissions.filter(p => !categoryPermissions.includes(p));
    } else {
      // 选择该分类的所有权限
      newPermissions = [...new Set([...selectedPermissions, ...categoryPermissions])];
    }
    
    onPermissionsChange(newPermissions);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 角色选择器 */}
      {showRoleSelector && (
        <Card style={styles.roleCard}>
          <Card.Title title="角色选择" />
          <Card.Content>
            <View style={styles.roleChips}>
              {availableData.roles.map(role => (
                <Chip
                  key={role}
                  selected={selectedRole === role}
                  onPress={() => !disabled && onRoleChange(role)}
                  disabled={disabled}
                  style={styles.roleChip}
                >
                  {getRoleDisplayName(role)}
                </Chip>
              ))}
            </View>
            
            {availableData.roleConfig && (
              <Text style={styles.roleDescription}>
                {availableData.roleConfig.description}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 权限搜索 */}
      <Searchbar
        placeholder="搜索权限..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* 权限统计 */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Text>
            已选择 {selectedPermissions.length} / {availableData.permissions.length} 个权限
          </Text>
        </Card.Content>
      </Card>

      {/* 权限分类列表 */}
      {Object.entries(filteredPermissions).map(([category, permissions]) => (
        <Card key={category} style={styles.categoryCard}>
          <List.Item
            title={getCategoryDisplayName(category)}
            description={`${permissions.length} 个权限`}
            left={props => <List.Icon {...props} icon="folder" />}
            right={props => (
              <View style={styles.categoryActions}>
                <Button
                  mode="text"
                  compact
                  onPress={() => handleSelectAllInCategory(category)}
                  disabled={disabled}
                >
                  {permissions.every(p => selectedPermissions.includes(p)) ? '取消全选' : '全选'}
                </Button>
                <List.Icon 
                  {...props} 
                  icon={expandedCategories.has(category) ? "chevron-up" : "chevron-down"} 
                />
              </View>
            )}
            onPress={() => handleCategoryToggle(category)}
          />
          
          {expandedCategories.has(category) && (
            <Card.Content>
              {permissions.map(permission => (
                <View key={permission} style={styles.permissionItem}>
                  <Checkbox
                    status={selectedPermissions.includes(permission) ? 'checked' : 'unchecked'}
                    onPress={() => handlePermissionToggle(permission)}
                    disabled={disabled}
                  />
                  <View style={styles.permissionInfo}>
                    <Text style={styles.permissionName}>
                      {getPermissionDisplayName(permission)}
                    </Text>
                    <Text style={styles.permissionCode}>
                      {permission}
                    </Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          )}
        </Card>
      ))}
    </ScrollView>
  );
};

// 辅助函数
function getPermissionCategory(permission: string): string {
  if (permission.includes('user')) return 'user_management';
  if (permission.includes('factory')) return 'factory_management';
  if (permission.includes('platform')) return 'platform_management';
  if (permission.includes('whitelist')) return 'whitelist_management';
  if (permission.includes('data')) return 'data_management';
  if (permission.includes('report')) return 'reporting';
  return 'other';
}

function getPermissionDisplayName(permission: string): string {
  const displayNames: Record<string, string> = {
    'create_factory': '创建工厂',
    'delete_factory': '删除工厂',
    'manage_all_factories': '管理所有工厂',
    'view_factories': '查看工厂列表',
    'manage_factory_users': '管理工厂用户',
    'create_users': '创建用户',
    'delete_users': '删除用户',
    'activate_users': '激活用户',
    'manage_whitelist': '管理白名单',
    // ... 更多映射
  };
  
  return displayNames[permission] || permission.replace(/_/g, ' ');
}

function getCategoryDisplayName(category: string): string {
  const categoryNames: Record<string, string> = {
    'user_management': '用户管理',
    'factory_management': '工厂管理',
    'platform_management': '平台管理',
    'whitelist_management': '白名单管理',
    'data_management': '数据管理',
    'reporting': '报表功能',
    'other': '其他权限'
  };
  
  return categoryNames[category] || category;
}

function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    'platform_super_admin': '平台超级管理员',
    'platform_operator': '平台操作员',
    'factory_super_admin': '工厂超级管理员',
    'permission_admin': '权限管理员',
    'department_admin': '部门管理员',
    'operator': '操作员',
    'viewer': '查看者'
  };
  
  return roleNames[role] || role;
}
```

**2.1.2 角色指示器组件**
```tsx
// src/components/permission/RoleIndicator.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip, Text, Card, Badge } from 'react-native-paper';
import { UserRole, UserType } from '@/types/auth';
import { useAuthStore } from '@/stores/authStore';

interface RoleIndicatorProps {
  role: UserRole;
  userType: UserType;
  department?: string;
  showDetails?: boolean;
  showBadge?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const RoleIndicator: React.FC<RoleIndicatorProps> = ({
  role,
  userType,
  department,
  showDetails = false,
  showBadge = true,
  size = 'medium'
}) => {
  const { permissions } = useAuthStore();

  const getRoleColor = (role: UserRole): string => {
    const colorMap: Record<UserRole, string> = {
      'platform_super_admin': '#D32F2F', // 红色 - 最高权限
      'platform_operator': '#F57C00',     // 橙色 - 平台操作
      'factory_super_admin': '#1976D2',   // 蓝色 - 工厂管理
      'permission_admin': '#7B1FA2',      // 紫色 - 权限管理
      'department_admin': '#388E3C',      // 绿色 - 部门管理
      'operator': '#616161',              // 灰色 - 普通操作
      'viewer': '#795548'                 // 棕色 - 只读权限
    };
    return colorMap[role] || '#616161';
  };

  const getRoleIcon = (role: UserRole): string => {
    const iconMap: Record<UserRole, string> = {
      'platform_super_admin': 'crown',
      'platform_operator': 'cog',
      'factory_super_admin': 'factory',
      'permission_admin': 'shield-account',
      'department_admin': 'account-group',
      'operator': 'account',
      'viewer': 'eye'
    };
    return iconMap[role] || 'account';
  };

  const getRoleLevel = (role: UserRole): number => {
    const levelMap: Record<UserRole, number> = {
      'platform_super_admin': 1,
      'platform_operator': 2,
      'factory_super_admin': 3,
      'permission_admin': 4,
      'department_admin': 5,
      'operator': 6,
      'viewer': 7
    };
    return levelMap[role] || 10;
  };

  const getPermissionCount = (): number => {
    return permissions?.features?.length || 0;
  };

  const roleColor = getRoleColor(role);
  const roleIcon = getRoleIcon(role);
  const roleLevel = getRoleLevel(role);
  const roleDisplayName = getRoleDisplayName(role);

  if (size === 'small') {
    return (
      <Chip
        icon={roleIcon}
        textStyle={{ color: roleColor }}
        style={[styles.smallChip, { borderColor: roleColor }]}
        compact
      >
        {roleDisplayName}
      </Chip>
    );
  }

  if (size === 'large') {
    return (
      <Card style={styles.largeCard}>
        <Card.Content>
          <View style={styles.largeHeader}>
            <View style={[styles.roleAvatar, { backgroundColor: roleColor }]}>
              <Text style={styles.roleAvatarText}>
                {roleDisplayName.charAt(0)}
              </Text>
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{roleDisplayName}</Text>
              <Text style={styles.roleType}>
                {userType === 'platform_admin' ? '平台用户' : '工厂用户'}
              </Text>
              {department && (
                <Text style={styles.department}>{department}部门</Text>
              )}
            </View>
            {showBadge && (
              <Badge style={[styles.levelBadge, { backgroundColor: roleColor }]}>
                L{roleLevel}
              </Badge>
            )}
          </View>
          
          {showDetails && (
            <View style={styles.roleDetails}>
              <Text style={styles.detailsTitle}>权限详情</Text>
              <View style={styles.permissionStats}>
                <Text>权限数量: {getPermissionCount()}</Text>
                <Text>数据访问: {permissions?.dataAccess || '未知'}</Text>
                <Text>部门权限: {permissions?.departmentAccess || '未知'}</Text>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  }

  // 默认 medium 尺寸
  return (
    <View style={styles.mediumContainer}>
      <Chip
        icon={roleIcon}
        textStyle={{ color: roleColor }}
        style={[styles.mediumChip, { borderColor: roleColor }]}
      >
        {roleDisplayName}
      </Chip>
      {showBadge && (
        <Badge 
          style={[styles.mediumBadge, { backgroundColor: roleColor }]}
          size={16}
        >
          {roleLevel}
        </Badge>
      )}
      {department && (
        <Text style={styles.mediumDepartment}>{department}</Text>
      )}
    </View>
  );
};

function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    'platform_super_admin': '平台超管',
    'platform_operator': '平台操作员',
    'factory_super_admin': '工厂超管',
    'permission_admin': '权限管理员',
    'department_admin': '部门管理员',
    'operator': '操作员',
    'viewer': '查看者'
  };
  
  return roleNames[role] || role;
}
```

#### 2.2 权限审计和日志 (2小时)

**2.2.1 权限审计组件**
```tsx
// src/components/permission/PermissionAudit.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { 
  Text, 
  Card, 
  List, 
  Chip, 
  Button,
  DataTable,
  Searchbar,
  Menu,
  IconButton 
} from 'react-native-paper';
import { usePermissionStore } from '@/stores/permissionStore';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';

interface PermissionAuditProps {
  userId?: string;
  showActions?: boolean;
  maxRecords?: number;
}

export const PermissionAudit: React.FC<PermissionAuditProps> = ({
  userId,
  showActions = true,
  maxRecords = 50
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  
  const { 
    getPermissionHistory, 
    clearPermissionHistory,
    getTemporaryPermissions 
  } = usePermissionStore();
  
  const { hasPermission } = usePermissions();
  
  const permissionHistory = getPermissionHistory();
  const temporaryPermissions = getTemporaryPermissions();

  // 过滤权限历史记录
  const filteredHistory = React.useMemo(() => {
    let filtered = permissionHistory;
    
    // 按类型过滤
    if (filterType !== 'all') {
      filtered = filtered.filter(record => record.action.toLowerCase().includes(filterType));
    }
    
    // 按搜索查询过滤
    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.action.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered.slice(-maxRecords);
  }, [permissionHistory, filterType, searchQuery, maxRecords]);

  const handleClearHistory = () => {
    if (hasPermission('audit_permissions')) {
      clearPermissionHistory();
    }
  };

  const getActionIcon = (action: string): string => {
    const actionIcons: Record<string, string> = {
      'SET_PERMISSIONS': 'account-plus',
      'CLEAR_PERMISSIONS': 'account-minus',
      'UPDATE_PERMISSIONS': 'account-edit',
      'GRANT_TEMPORARY': 'clock-plus',
      'REVOKE_TEMPORARY': 'clock-minus'
    };
    return actionIcons[action] || 'information';
  };

  const getActionColor = (action: string): string => {
    const actionColors: Record<string, string> = {
      'SET_PERMISSIONS': '#4CAF50',
      'CLEAR_PERMISSIONS': '#F44336',
      'UPDATE_PERMISSIONS': '#2196F3',
      'GRANT_TEMPORARY': '#FF9800',
      'REVOKE_TEMPORARY': '#9C27B0'
    };
    return actionColors[action] || '#757575';
  };

  return (
    <ScrollView style={styles.container}>
      {/* 临时权限显示 */}
      {temporaryPermissions.length > 0 && (
        <Card style={styles.tempPermissionCard}>
          <Card.Title 
            title="临时权限" 
            subtitle={`${temporaryPermissions.length} 个临时权限生效中`}
            left={(props) => <List.Icon {...props} icon="clock-alert" />}
          />
          <Card.Content>
            <View style={styles.tempPermissionList}>
              {temporaryPermissions.map((permission, index) => (
                <Chip key={index} style={styles.tempPermissionChip}>
                  {permission}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* 搜索和过滤 */}
      <View style={styles.filterSection}>
        <Searchbar
          placeholder="搜索权限操作..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="filter-variant" 
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item onPress={() => { setFilterType('all'); setMenuVisible(false); }} title="全部操作" />
          <Menu.Item onPress={() => { setFilterType('set'); setMenuVisible(false); }} title="设置权限" />
          <Menu.Item onPress={() => { setFilterType('update'); setMenuVisible(false); }} title="更新权限" />
          <Menu.Item onPress={() => { setFilterType('clear'); setMenuVisible(false); }} title="清除权限" />
          <Menu.Item onPress={() => { setFilterType('temporary'); setMenuVisible(false); }} title="临时权限" />
        </Menu>
      </View>

      {/* 权限历史记录 */}
      <Card style={styles.historyCard}>
        <Card.Title 
          title="权限变更历史" 
          subtitle={`显示最近 ${filteredHistory.length} 条记录`}
          right={(props) => 
            showActions && hasPermission('audit_permissions') ? (
              <Button onPress={handleClearHistory} mode="text">
                清除历史
              </Button>
            ) : null
          }
        />
        
        <Card.Content>
          {filteredHistory.length === 0 ? (
            <Text style={styles.emptyText}>暂无权限变更记录</Text>
          ) : (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>时间</DataTable.Title>
                <DataTable.Title>操作</DataTable.Title>
                <DataTable.Title>详情</DataTable.Title>
              </DataTable.Header>

              {filteredHistory.map((record, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell>
                    {format(new Date(record.timestamp), 'MM-dd HH:mm')}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <View style={styles.actionCell}>
                      <List.Icon 
                        icon={getActionIcon(record.action)} 
                        color={getActionColor(record.action)}
                      />
                      <Text style={styles.actionText}>
                        {getActionDisplayName(record.action)}
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text numberOfLines={2} style={styles.detailText}>
                      {getPermissionChangeDetails(record)}
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

// 辅助函数
function getActionDisplayName(action: string): string {
  const actionNames: Record<string, string> = {
    'SET_PERMISSIONS': '设置权限',
    'CLEAR_PERMISSIONS': '清除权限',
    'UPDATE_PERMISSIONS': '更新权限',
    'GRANT_TEMPORARY': '授予临时权限',
    'REVOKE_TEMPORARY': '撤销临时权限'
  };
  return actionNames[action] || action;
}

function getPermissionChangeDetails(record: any): string {
  if (record.action === 'CLEAR_PERMISSIONS') {
    return '用户权限已被清除';
  }
  
  if (record.action === 'SET_PERMISSIONS' && record.newPermissions) {
    return `设置为 ${record.newPermissions.role} 角色`;
  }
  
  if (record.action === 'UPDATE_PERMISSIONS') {
    return '权限配置已更新';
  }
  
  return '权限发生变更';
}
```

#### 2.3 权限同步和更新 (2小时)

**2.3.1 权限同步服务**
```tsx
// src/services/permissionSyncService.ts
import { AuthService } from './authService';
import { useAuthStore } from '@/stores/authStore';
import { usePermissionStore } from '@/stores/permissionStore';
import { NetworkManager } from './networkManager';

export interface PermissionSyncOptions {
  forceRefresh?: boolean;
  syncInterval?: number; // 毫秒
  maxRetries?: number;
}

export class PermissionSyncService {
  private static syncInterval: NodeJS.Timeout | null = null;
  private static lastSyncTime: number = 0;
  private static isSync
  ing: boolean = false;

  // 启动权限同步
  static startSync(options: PermissionSyncOptions = {}) {
    const { syncInterval = 30 * 60 * 1000, maxRetries = 3 } = options; // 默认30分钟同步一次

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncPermissions({ maxRetries });
      } catch (error) {
        console.error('定时权限同步失败:', error);
      }
    }, syncInterval);

    // 立即执行一次同步
    this.syncPermissions({ maxRetries });
  }

  // 停止权限同步
  static stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // 手动同步权限
  static async syncPermissions(options: PermissionSyncOptions = {}): Promise<boolean> {
    const { forceRefresh = false, maxRetries = 3 } = options;

    if (this.isSyncing && !forceRefresh) {
      console.log('权限同步正在进行中，跳过此次同步');
      return false;
    }

    this.isSyncing = true;

    try {
      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络不可用，无法同步权限');
      }

      // 检查是否需要同步
      if (!forceRefresh && !this.shouldSync()) {
        console.log('权限信息仍在有效期内，跳过同步');
        return true;
      }

      // 获取最新的用户信息和权限
      const userInfo = await this.retryOperation(
        () => AuthService.getCurrentUser(),
        maxRetries
      );

      // 更新本地权限状态
      await this.updateLocalPermissions(userInfo);

      this.lastSyncTime = Date.now();
      console.log('权限同步成功');
      return true;

    } catch (error: any) {
      console.error('权限同步失败:', error);
      
      // 如果是认证错误，清除本地状态
      if (error.code === 'AUTHENTICATION_ERROR') {
        await this.handleAuthenticationError();
      }
      
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  // 检查是否需要同步
  private static shouldSync(): boolean {
    const syncThreshold = 15 * 60 * 1000; // 15分钟
    return Date.now() - this.lastSyncTime > syncThreshold;
  }

  // 重试操作
  private static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 等待后重试
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw lastError;
  }

  // 更新本地权限状态
  private static async updateLocalPermissions(userInfo: any): Promise<void> {
    const authStore = useAuthStore.getState();
    const permissionStore = usePermissionStore.getState();

    // 检查权限是否发生变化
    const currentPermissions = authStore.permissions;
    const newPermissions = userInfo.user?.permissions || userInfo.admin?.permissions;

    if (!this.arePermissionsEqual(currentPermissions, newPermissions)) {
      // 权限发生变化，更新状态
      authStore.setPermissions(newPermissions);
      permissionStore.setPermissions(newPermissions);
      
      // 记录权限变更
      permissionStore.recordPermissionChange(
        'SYNC_UPDATE',
        currentPermissions,
        newPermissions
      );

      console.log('检测到权限变更，已更新本地状态');
    }

    // 更新用户信息
    if (userInfo.user) {
      authStore.setUser(userInfo.user);
      if (userInfo.factory) {
        authStore.setFactory(userInfo.factory);
      }
    } else if (userInfo.admin) {
      authStore.setUser(userInfo.admin);
    }
  }

  // 比较权限是否相等
  private static arePermissionsEqual(
    permissions1: any,
    permissions2: any
  ): boolean {
    if (!permissions1 && !permissions2) return true;
    if (!permissions1 || !permissions2) return false;

    // 简单的深度比较
    return JSON.stringify(permissions1) === JSON.stringify(permissions2);
  }

  // 处理认证错误
  private static async handleAuthenticationError(): Promise<void> {
    const authStore = useAuthStore.getState();
    const permissionStore = usePermissionStore.getState();

    // 清除认证状态
    authStore.logout();
    permissionStore.clearPermissions();

    console.log('检测到认证错误，已清除本地状态');
  }

  // 延迟函数
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取同步状态
  static getSyncStatus() {
    return {
      isRunning: this.syncInterval !== null,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      nextSyncTime: this.syncInterval ? this.lastSyncTime + 30 * 60 * 1000 : null
    };
  }
}

// 权限同步Hook
export function usePermissionSync() {
  const [syncStatus, setSyncStatus] = React.useState(PermissionSyncService.getSyncStatus());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(PermissionSyncService.getSyncStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startSync = (options?: PermissionSyncOptions) => {
    PermissionSyncService.startSync(options);
    setSyncStatus(PermissionSyncService.getSyncStatus());
  };

  const stopSync = () => {
    PermissionSyncService.stopSync();
    setSyncStatus(PermissionSyncService.getSyncStatus());
  };

  const manualSync = async (options?: PermissionSyncOptions) => {
    const result = await PermissionSyncService.syncPermissions(options);
    setSyncStatus(PermissionSyncService.getSyncStatus());
    return result;
  };

  return {
    syncStatus,
    startSync,
    stopSync,
    manualSync
  };
}
```

## 🏆 交付物

### 技术交付物
- [ ] **权限守卫组件** (PermissionGuard.tsx) - 基础权限控制
- [ ] **路由保护组件** (ProtectedRoute.tsx) - 路由级权限控制
- [ ] **权限检查Hook** (usePermissions.ts) - 完整权限检查API
- [ ] **权限状态管理** (permissionStore.ts) - 权限状态全局管理
- [ ] **权限选择器** (PermissionPicker.tsx) - 可视化权限配置
- [ ] **角色指示器** (RoleIndicator.tsx) - 角色显示组件
- [ ] **权限审计组件** (PermissionAudit.tsx) - 权限变更历史
- [ ] **权限同步服务** (permissionSyncService.ts) - 权限自动同步

### 功能交付物
- [ ] **多层级权限控制** - 页面、组件、操作级权限控制
- [ ] **动态权限验证** - 实时权限状态检查和更新
- [ ] **权限可视化管理** - 直观的权限选择和配置界面
- [ ] **权限审计追踪** - 完整的权限变更历史记录
- [ ] **临时权限支持** - 支持临时权限授予和自动过期
- [ ] **权限缓存优化** - 智能权限检查缓存机制

### 安全交付物
- [ ] **最小权限原则** - 默认最小权限，按需授权
- [ ] **权限分离控制** - 角色权限清晰分离
- [ ] **权限变更审计** - 所有权限变更可追溯
- [ ] **实时权限同步** - 服务端权限变更实时生效
- [ ] **权限失效保护** - 网络异常时的权限保护机制

## ✅ 验收标准

### 功能完整性验证
- [ ] 权限守卫正确拦截未授权访问
- [ ] 路由保护有效阻止无权限页面访问
- [ ] 动态权限检查实时响应权限变更
- [ ] 权限UI组件正确显示用户权限状态
- [ ] 权限同步服务正常工作

### 用户体验验证
- [ ] 权限拒绝时提示友好清晰
- [ ] 权限配置界面直观易用
- [ ] 角色切换流畅无卡顿
- [ ] 权限变更即时生效
- [ ] 离线时权限控制仍然有效

### 安全性验证
- [ ] 无法绕过权限检查访问受保护资源
- [ ] 权限提升攻击无效
- [ ] 权限变更有完整审计记录
- [ ] 临时权限正确过期失效
- [ ] 客户端权限与服务端一致

### 性能验证
- [ ] 权限检查响应时间 < 10ms
- [ ] 权限缓存命中率 > 90%
- [ ] 权限同步不影响UI响应
- [ ] 大量权限数据处理流畅
- [ ] 内存使用合理稳定

## 📊 时间分配

| 阶段 | 内容 | 预计时间 | 关键交付物 |
|------|------|----------|-----------|
| Day 1 上午 | 权限守卫组件 | 3小时 | PermissionGuard、ProtectedRoute |
| Day 1 下午 | 动态权限检查 | 3小时 | usePermissions Hook、权限工具 |
| Day 1 晚上 | 权限状态管理 | 2小时 | permissionStore、权限缓存 |
| Day 2 上午 | 权限UI组件 | 4小时 | PermissionPicker、RoleIndicator |
| Day 2 下午 | 权限审计日志 | 2小时 | PermissionAudit、变更追踪 |
| Day 2 晚上 | 权限同步服务 | 2小时 | 自动同步、状态同步 |
| **总计** | **权限控制系统完整实现** | **16小时** | **完整权限控制功能** |

## 🚨 风险与对策

### 技术风险
- **风险**: 权限检查性能影响用户体验
- **对策**: 智能缓存机制，异步权限验证

- **风险**: 权限状态不一致导致安全问题
- **对策**: 定期同步验证，服务端权限为准

- **风险**: 复杂权限逻辑难以维护
- **对策**: 清晰的权限模型，完善的文档

### 安全风险
- **风险**: 客户端权限被篡改
- **对策**: 服务端最终验证，客户端仅用于UI控制

- **风险**: 权限提升攻击
- **对策**: 严格的角色层级控制，权限最小化原则

### 用户体验风险
- **风险**: 权限拒绝提示过于严厉
- **对策**: 友好的错误提示，提供解决建议

- **风险**: 权限配置界面复杂难用
- **对策**: 直观的可视化设计，分步配置向导

## 🔄 与其他任务的接口

### 输入依赖
- **TASK-RN-003**: 认证架构和权限配置
- **TASK-RN-004**: 登录系统和用户状态
- **Web端权限系统**: 权限配置和API接口

### 输出到后续任务
- **TASK-RN-006**: 导航系统使用权限控制菜单
- **TASK-RN-007**: API客户端集成权限验证
- **TASK-RN-008**: 用户管理界面使用权限组件
- **所有业务模块**: 基于权限系统的访问控制

## 📝 开发检查点

### Day 1 检查点
- [ ] 权限守卫是否正确拦截
- [ ] 权限检查API是否完整
- [ ] 权限状态管理是否稳定
- [ ] 性能是否满足要求

### Day 2 检查点
- [ ] 权限UI组件是否易用
- [ ] 权限审计功能是否完善
- [ ] 权限同步是否正常
- [ ] 整体安全性是否达标

## 📞 技术支持

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**参考资料**: 
- Web端权限配置: `backend/src/config/permissions.js`
- TASK-RN-003认证架构: `TASK-RN-003-auth-architecture.md`
- TASK-RN-004登录系统: `TASK-RN-004-login-system.md`

---

**任务创建时间**: 2025-08-05
**计划开始时间**: TASK-RN-004完成后
**计划完成时间**: 开始后2个工作日

*此任务是应用安全的核心保障，确保用户只能访问其权限范围内的功能和数据。*