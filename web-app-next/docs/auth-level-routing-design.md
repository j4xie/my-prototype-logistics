# 权限级别路由系统设计

## 概述

本文档说明如何实现基于权限级别的自动路由系统，让不同权限级别的用户登录后自动跳转到对应的界面。

## 权限级别定义

```typescript
// 权限级别枚举
export enum UserLevel {
  PLATFORM_ADMIN = 0,    // 平台超级管理员
  SYSTEM_ADMIN = 1,      // 系统管理员
  DEPARTMENT_MANAGER = 2, // 部门经理
  OPERATOR = 3,          // 操作员
  VIEWER = 4,            // 查看员
  GUEST = 5              // 访客
}

// 权限级别到路由的映射
export const LEVEL_ROUTE_MAP: Record<UserLevel, string> = {
  [UserLevel.PLATFORM_ADMIN]: '/platform',
  [UserLevel.SYSTEM_ADMIN]: '/admin/dashboard',
  [UserLevel.DEPARTMENT_MANAGER]: '/admin/department',
  [UserLevel.OPERATOR]: '/farming',
  [UserLevel.VIEWER]: '/trace/query',
  [UserLevel.GUEST]: '/demo'
}
```

## 实现步骤

### 1. 更新类型定义

```typescript
// types/state.ts
export interface UserRole {
  id: string;
  name: string;
  description: string;
  level: UserLevel; // 使用枚举类型
  routePath: string; // 默认路由路径
  permissions: string[]; // 权限列表
}
```

### 2. 登录跳转逻辑

```typescript
// app/login/page.tsx
const handleLoginSuccess = () => {
  const { user } = useAuthStore.getState();

  // 基于权限级别自动跳转
  const targetRoute = getRouteByLevel(user.role.level);

  // 可选：检查路由权限
  if (hasAccessToRoute(user, targetRoute)) {
    router.push(targetRoute);
  } else {
    // 降级到最基础的可访问路由
    router.push(getFallbackRoute(user.role.level));
  }
}

// utils/auth-router.ts
export const getRouteByLevel = (level: UserLevel): string => {
  return LEVEL_ROUTE_MAP[level] || '/trace/query'; // 默认路由
}

export const hasAccessToRoute = (user: User, route: string): boolean => {
  // 检查用户是否有访问该路由的权限
  const requiredPermission = getRoutePermission(route);
  return user.permissions.some(p => p.resource === requiredPermission);
}
```

### 3. 路由权限保护

```typescript
// components/auth/RouteGuard.tsx
export const RouteGuard: React.FC<{
  children: React.ReactNode;
  requiredLevel?: UserLevel;
  requiredPermissions?: string[];
}> = ({ children, requiredLevel, requiredPermissions }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // 级别检查
  if (requiredLevel !== undefined && user.role.level > requiredLevel) {
    return <Navigate to={getFallbackRoute(user.role.level)} />;
  }

  // 权限检查
  if (requiredPermissions && !hasRequiredPermissions(user, requiredPermissions)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
}
```

### 4. 动态权限配置

```typescript
// config/role-config.ts
export const ROLE_CONFIGURATIONS = {
  [UserLevel.PLATFORM_ADMIN]: {
    defaultRoute: '/platform',
    allowedRoutes: ['*'], // 所有路由
    features: ['user-management', 'system-config', 'analytics'],
    redirectOnLogin: true
  },

  [UserLevel.SYSTEM_ADMIN]: {
    defaultRoute: '/admin/dashboard',
    allowedRoutes: ['/admin/*', '/farming/*', '/processing/*'],
    features: ['user-management', 'reports'],
    redirectOnLogin: true
  },

  [UserLevel.OPERATOR]: {
    defaultRoute: '/farming',
    allowedRoutes: ['/farming/*', '/processing/*', '/trace/*'],
    features: ['data-entry', 'basic-reports'],
    redirectOnLogin: true
  }
};

// 获取用户配置
export const getUserConfig = (level: UserLevel) => {
  return ROLE_CONFIGURATIONS[level] || ROLE_CONFIGURATIONS[UserLevel.VIEWER];
}
```

## 使用示例

### 登录时自动路由

```typescript
// 用户登录成功后
const user = await authAPI.login(credentials);
const config = getUserConfig(user.role.level);

if (config.redirectOnLogin) {
  router.push(config.defaultRoute);
} else {
  // 让用户手动选择
  router.push('/dashboard-selector');
}
```

### 页面权限保护

```typescript
// pages/admin/dashboard/page.tsx
export default function AdminDashboard() {
  return (
    <RouteGuard
      requiredLevel={UserLevel.SYSTEM_ADMIN}
      requiredPermissions={['admin:read']}
    >
      <DashboardContent />
    </RouteGuard>
  );
}
```

### 动态菜单生成

```typescript
// components/navigation/NavMenu.tsx
const NavMenu = () => {
  const { user } = useAuth();
  const config = getUserConfig(user.role.level);

  const menuItems = generateMenuByPermissions(
    user.permissions,
    config.allowedRoutes
  );

  return <Menu items={menuItems} />;
}
```

## 优势

1. **自动化**: 用户登录后自动跳转到合适的工作界面
2. **安全性**: 多层权限检查确保访问安全
3. **灵活性**: 可以轻松调整权限级别和路由映射
4. **可扩展**: 支持复杂的权限配置和动态路由
5. **用户体验**: 用户无需手动选择，直接进入工作界面

## 实施建议

1. **逐步迁移**: 先实现基础的级别路由，再添加复杂权限
2. **测试覆盖**: 为每个权限级别编写单元测试
3. **日志记录**: 记录权限检查和路由决策过程
4. **降级策略**: 为权限不足的情况提供友好的降级体验
5. **配置化**: 将权限配置外部化，便于运营调整
