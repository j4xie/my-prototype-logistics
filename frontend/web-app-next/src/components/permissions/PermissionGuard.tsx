/**
 * 权限守卫组件
 * 根据用户权限控制组件的显示和访问
 */

import React from 'react';
import { usePermissions, usePermissionCheck, useMultiPermissionCheck, useDepartmentAccess } from '@/hooks/usePermissions';
import { Loading } from '@/components/ui/loading';

interface PermissionGuardProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 无权限时显示的内容 */
  fallback?: React.ReactNode;
  /** 加载时显示的内容 */
  loading?: React.ReactNode;
  /** 必需的权限（单个） */
  permission?: string;
  /** 必需的权限（多个） */
  permissions?: string[];
  /** 多权限检查是否需要全部满足 */
  requireAll?: boolean;
  /** 需要访问的部门 */
  department?: string;
  /** 自定义权限检查函数 */
  customCheck?: () => boolean;
  /** 是否在无权限时完全隐藏（不渲染任何内容） */
  hideWhenDenied?: boolean;
}

export function PermissionGuard({
  children,
  fallback = null,
  loading = <Loading />,
  permission,
  permissions,
  requireAll = false,
  department,
  customCheck,
  hideWhenDenied = false
}: PermissionGuardProps) {
  const { isLoading: permissionsLoading } = usePermissions();
  
  // 单权限检查
  const { hasPermission: hasSinglePermission, isLoading: singleLoading } = usePermissionCheck(
    permission || ''
  );
  
  // 多权限检查
  const { hasPermission: hasMultiPermissions, isLoading: multiLoading } = useMultiPermissionCheck(
    permissions || [],
    requireAll
  );
  
  // 部门访问检查
  const { canAccess: canAccessDept, isLoading: deptLoading } = useDepartmentAccess(
    department || ''
  );

  // 确定加载状态
  const isLoading = permissionsLoading || singleLoading || multiLoading || deptLoading;

  // 确定权限状态
  const hasAccess = (() => {
    // 自定义检查优先
    if (customCheck) {
      return customCheck();
    }

    // 部门访问检查
    if (department && !canAccessDept) {
      return false;
    }

    // 单权限检查
    if (permission && !hasSinglePermission) {
      return false;
    }

    // 多权限检查
    if (permissions && permissions.length > 0 && !hasMultiPermissions) {
      return false;
    }

    return true;
  })();

  // 加载中状态
  if (isLoading) {
    return <>{loading}</>;
  }

  // 有权限时显示子组件
  if (hasAccess) {
    return <>{children}</>;
  }

  // 无权限时的处理
  if (hideWhenDenied) {
    return null;
  }

  return <>{fallback}</>;
}

// 平台管理员专用守卫
interface PlatformGuardProps extends Omit<PermissionGuardProps, 'permission' | 'permissions'> {
  permission?: string;
  permissions?: string[];
}

export function PlatformGuard({ permission, permissions, ...props }: PlatformGuardProps) {
  const { getUserType } = usePermissions();
  
  const customCheck = () => {
    const userType = getUserType();
    return userType === 'platform_admin';
  };

  return (
    <PermissionGuard
      {...props}
      permission={permission}
      permissions={permissions}
      customCheck={customCheck}
    />
  );
}

// 工厂用户专用守卫
interface FactoryGuardProps extends Omit<PermissionGuardProps, 'permission' | 'permissions'> {
  permission?: string;
  permissions?: string[];
}

export function FactoryGuard({ permission, permissions, ...props }: FactoryGuardProps) {
  const { getUserType } = usePermissions();
  
  const customCheck = () => {
    const userType = getUserType();
    return userType === 'factory_user';
  };

  return (
    <PermissionGuard
      {...props}
      permission={permission}
      permissions={permissions}
      customCheck={customCheck}
    />
  );
}

// 角色守卫
interface RoleGuardProps extends Omit<PermissionGuardProps, 'customCheck'> {
  /** 允许的角色列表 */
  roles: string[];
}

export function RoleGuard({ roles, ...props }: RoleGuardProps) {
  const { getUserRole } = usePermissions();
  
  const customCheck = () => {
    const userRole = getUserRole();
    return roles.includes(userRole);
  };

  return <PermissionGuard {...props} customCheck={customCheck} />;
}

// 部门守卫
interface DepartmentGuardProps extends Omit<PermissionGuardProps, 'department'> {
  /** 用户必须属于的部门 */
  department: string;
  /** 是否允许跨部门访问的角色 */
  allowCrossDepartment?: boolean;
}

export function DepartmentGuard({ 
  department, 
  allowCrossDepartment = true, 
  ...props 
}: DepartmentGuardProps) {
  const { canAccessDepartment, getUserRole } = usePermissions();
  
  const customCheck = () => {
    // 如果允许跨部门访问，检查用户角色
    if (allowCrossDepartment) {
      const userRole = getUserRole();
      const crossDepartmentRoles = ['factory_super_admin', 'permission_admin'];
      if (crossDepartmentRoles.includes(userRole)) {
        return true;
      }
    }
    
    return canAccessDepartment(department);
  };

  return <PermissionGuard {...props} customCheck={customCheck} />;
}

// 组合守卫 - 支持复杂的权限逻辑
interface CompositeGuardProps extends Omit<PermissionGuardProps, 'customCheck'> {
  /** 权限检查配置 */
  checks: Array<{
    type: 'permission' | 'role' | 'department' | 'custom';
    value?: string | string[];
    func?: () => boolean;
    operator?: 'AND' | 'OR';
  }>;
  /** 检查之间的默认操作符 */
  defaultOperator?: 'AND' | 'OR';
}

export function CompositeGuard({ 
  checks, 
  defaultOperator = 'AND', 
  ...props 
}: CompositeGuardProps) {
  const { hasPermission, getUserRole, canAccessDepartment } = usePermissions();
  
  const customCheck = () => {
    const results = checks.map(check => {
      switch (check.type) {
        case 'permission':
          if (Array.isArray(check.value)) {
            return check.value.some(p => hasPermission(p));
          }
          return hasPermission(check.value as string);
          
        case 'role':
          const userRole = getUserRole();
          if (Array.isArray(check.value)) {
            return check.value.includes(userRole);
          }
          return userRole === check.value;
          
        case 'department':
          return canAccessDepartment(check.value as string);
          
        case 'custom':
          return check.func ? check.func() : false;
          
        default:
          return false;
      }
    });

    // 根据操作符计算最终结果
    if (defaultOperator === 'OR') {
      return results.some(result => result);
    } else {
      return results.every(result => result);
    }
  };

  return <PermissionGuard {...props} customCheck={customCheck} />;
}

// 无权限提示组件
interface AccessDeniedProps {
  /** 提示消息 */
  message?: string;
  /** 详细说明 */
  description?: string;
  /** 自定义样式类名 */
  className?: string;
}

export function AccessDenied({ 
  message = '访问被拒绝', 
  description = '您没有权限访问此内容',
  className = ''
}: AccessDeniedProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg 
          className="w-8 h-8 text-red-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{message}</h3>
      <p className="text-gray-600 max-w-md">{description}</p>
    </div>
  );
}

export default PermissionGuard;