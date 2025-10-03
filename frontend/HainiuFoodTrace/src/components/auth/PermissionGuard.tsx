import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePermission } from '../../hooks/usePermission';
import { UserRole } from '../../types/auth';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  role?: UserRole;
  roles?: UserRole[];
  module?: string;
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

/**
 * 权限保护组件
 * 根据用户权限控制内容显示
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  role,
  roles = [],
  module,
  fallback = null,
  showFallback = false
}) => {
  const { 
    hasPermission, 
    hasRole, 
    hasAnyRole, 
    hasModuleAccess,
    isLoading 
  } = usePermission();

  // 加载中状态
  if (isLoading) {
    return null;
  }

  // 检查权限
  const hasRequiredPermission = permission ? hasPermission(permission) : true;
  
  // 检查角色
  const hasRequiredRole = role ? hasRole(role) : true;
  const hasRequiredRoles = roles.length > 0 ? hasAnyRole(roles) : true;
  
  // 检查模块访问权限
  const hasRequiredModule = module ? hasModuleAccess(module) : true;

  // 判断是否有权限访问
  const hasAccess = hasRequiredPermission && hasRequiredRole && hasRequiredRoles && hasRequiredModule;

  if (!hasAccess) {
    if (showFallback && fallback) {
      return <>{fallback}</>;
    }
    
    if (showFallback) {
      return (
        <View style={styles.noPermissionContainer}>
          <Text style={styles.noPermissionText}>您没有权限访问此内容</Text>
        </View>
      );
    }
    
    return null;
  }

  return <>{children}</>;
};

/**
 * 基于角色的简单权限守卫
 */
interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  fallback = null
}) => {
  return (
    <PermissionGuard 
      roles={allowedRoles} 
      fallback={fallback}
      showFallback={!!fallback}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * 基于模块的权限守卫
 */
interface ModuleGuardProps {
  children: React.ReactNode;
  module: string;
  fallback?: React.ReactNode;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({
  children,
  module,
  fallback = null
}) => {
  return (
    <PermissionGuard 
      module={module} 
      fallback={fallback}
      showFallback={!!fallback}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * 开发者专用权限守卫
 */
interface DeveloperGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const DeveloperGuard: React.FC<DeveloperGuardProps> = ({
  children,
  fallback = null
}) => {
  return (
    <RoleGuard 
      allowedRoles={['system_developer']} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  );
};

/**
 * 平台管理员权限守卫
 */
interface PlatformAdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PlatformAdminGuard: React.FC<PlatformAdminGuardProps> = ({
  children,
  fallback = null
}) => {
  return (
    <RoleGuard 
      allowedRoles={['system_developer', 'platform_super_admin']} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  );
};

/**
 * 工厂管理员权限守卫
 */
interface FactoryAdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FactoryAdminGuard: React.FC<FactoryAdminGuardProps> = ({
  children,
  fallback = null
}) => {
  return (
    <RoleGuard 
      allowedRoles={['system_developer', 'factory_super_admin', 'permission_admin']} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  );
};

const styles = StyleSheet.create({
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noPermissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});