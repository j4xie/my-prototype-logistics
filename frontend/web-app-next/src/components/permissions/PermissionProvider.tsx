'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionChecker, UserPermissions } from '@/types/permissions';

interface PermissionContextType {
  permissions: UserPermissions | null;
  isLoading: boolean;
  hasModuleAccess: (module: string) => boolean;
  hasFeatureAccess: (feature: string) => boolean;
  hasRoleLevel: (level: number) => boolean;
  canAccessRoute: (route: string) => boolean;
  refresh: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

/**
 * 权限上下文提供者
 * 为整个应用提供权限检查功能
 */
export default function PermissionProvider({ children }: PermissionProviderProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 刷新权限
  const refresh = () => {
    if (isAuthenticated && user?.permissions) {
      setPermissions(user.permissions);
    } else {
      setPermissions(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [isAuthenticated, user]);

  // 模块权限检查
  const hasModuleAccess = (module: string): boolean => {
    if (!permissions || !permissions.modules) return false;

    // 简化的权限检查
    const moduleMap: Record<string, string> = {
      'farming': 'farming_access',
      'processing': 'processing_access',
      'logistics': 'logistics_access',
      'admin': 'admin_access',
      'platform': 'platform_access'
    };

    const moduleKey = moduleMap[module];
    if (!moduleKey || !permissions.modules) return false;

    // 类型安全的访问
    switch (moduleKey) {
      case 'farming_access': return permissions.modules.farming_access === true;
      case 'processing_access': return permissions.modules.processing_access === true;
      case 'logistics_access': return permissions.modules.logistics_access === true;
      case 'admin_access': return permissions.modules.admin_access === true;
      case 'platform_access': return permissions.modules.platform_access === true;
      default: return false;
    }
  };

  // 功能权限检查
  const hasFeatureAccess = (feature: string): boolean => {
    if (!permissions || !permissions.features) return false;
    return permissions.features.includes(feature);
  };

  // 角色级别检查
  const hasRoleLevel = (level: number): boolean => {
    if (!permissions) return false;
    return PermissionChecker.hasRoleLevel(permissions, level);
  };

  // 路由权限检查
  const canAccessRoute = (route: string): boolean => {
    if (!permissions) return false;

    // 路由权限映射
    const routePermissions: Record<string, { module?: string; level?: number }> = {
      '/farming': { module: 'farming', level: 50 },
      '/processing': { module: 'processing', level: 50 },
      '/logistics': { module: 'logistics', level: 50 },
      '/admin': { module: 'admin', level: 10 },
      '/platform': { module: 'platform', level: 0 }
    };

    // 检查具体路由
    for (const [path, requirement] of Object.entries(routePermissions)) {
      if (route.startsWith(path)) {
        // 检查模块权限
        if (requirement.module && !hasModuleAccess(requirement.module)) {
          return false;
        }

        // 检查级别权限
        if (requirement.level !== undefined && !hasRoleLevel(requirement.level)) {
          return false;
        }

        return true;
      }
    }

    // 默认允许访问公共路由
    return true;
  };

  const contextValue: PermissionContextType = {
    permissions,
    isLoading: isLoading || authLoading,
    hasModuleAccess,
    hasFeatureAccess,
    hasRoleLevel,
    canAccessRoute,
    refresh
  };

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * 权限上下文Hook
 */
export function usePermissionContext() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
}

/**
 * 权限检查HOC
 */
export function withPermission<T extends object>(
  Component: React.ComponentType<T>,
  requiredModule?: string,
  requiredLevel?: number
) {
  return function PermissionWrappedComponent(props: T) {
    const { hasModuleAccess, hasRoleLevel } = usePermissionContext();

    // 检查模块权限
    if (requiredModule && !hasModuleAccess(requiredModule)) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>您没有访问此功能的权限</p>
          <p className="text-sm">需要 {requiredModule} 模块权限</p>
        </div>
      );
    }

    // 检查级别权限
    if (requiredLevel !== undefined && !hasRoleLevel(requiredLevel)) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>您的权限级别不足</p>
          <p className="text-sm">需要级别 {requiredLevel} 或更高权限</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

/**
 * 权限检查组件
 */
interface PermissionCheckProps {
  module?: string;
  level?: number;
  feature?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionCheck({
  module,
  level,
  feature,
  children,
  fallback
}: PermissionCheckProps) {
  const { hasModuleAccess, hasRoleLevel, hasFeatureAccess } = usePermissionContext();

  // 检查模块权限
  if (module && !hasModuleAccess(module)) {
    return fallback ? <>{fallback}</> : null;
  }

  // 检查级别权限
  if (level !== undefined && !hasRoleLevel(level)) {
    return fallback ? <>{fallback}</> : null;
  }

  // 检查功能权限
  if (feature && !hasFeatureAccess(feature)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
