import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import { UserRole, UserPermissions, User } from '../../types/auth';
import { ROLE_LEVELS, FULL_ROLE_PERMISSIONS } from '../../constants/permissions';

interface PermissionCheckOptions {
  requireAll?: boolean; // 是否需要所有权限都满足
  checkLevel?: boolean; // 是否检查权限级别
  checkDepartment?: boolean; // 是否检查部门权限
  cacheResult?: boolean; // 是否缓存结果
  retryOnFailure?: boolean; // 权限检查失败时是否重试
}

interface EnhancedPermissionGuardProps {
  children: React.ReactNode;
  
  // 基础权限检查
  requiredAuth?: boolean;
  
  // 权限检查参数
  permissions?: string[];
  roles?: UserRole[];
  modules?: string[];
  department?: string;
  minimumLevel?: number;
  
  // 数据访问权限
  dataOwner?: string;
  dataDepartment?: string;
  dataLevel?: 'all' | 'factory' | 'department' | 'own';
  
  // UI 控制
  fallback?: React.ReactNode;
  showFallback?: boolean;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  
  // 行为控制
  options?: PermissionCheckOptions;
  onPermissionDenied?: (reason: string) => void;
  onPermissionGranted?: () => void;
}

interface PermissionCache {
  [key: string]: {
    result: boolean;
    timestamp: number;
    ttl: number;
  };
}

export const EnhancedPermissionGuard: React.FC<EnhancedPermissionGuardProps> = ({
  children,
  requiredAuth = false,
  permissions = [],
  roles = [],
  modules = [],
  department,
  minimumLevel,
  dataOwner,
  dataDepartment,
  dataLevel,
  fallback,
  showFallback = true,
  loadingComponent,
  errorComponent,
  options = {},
  onPermissionDenied,
  onPermissionGranted,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionResult, setPermissionResult] = useState<{
    hasAccess: boolean;
    reason: string;
    details: any;
  } | null>(null);

  const { user, isAuthenticated } = useAuthStore();
  const { permissions: userPermissions } = usePermissionStore();

  // 权限缓存
  const [permissionCache, setPermissionCache] = useState<PermissionCache>({});

  const {
    requireAll = false,
    checkLevel = false,
    checkDepartment = false,
    cacheResult = true,
    retryOnFailure = false,
  } = options;

  /**
   * 生成缓存键
   */
  const getCacheKey = useMemo(() => {
    const keyParts = [
      user?.id || 'anonymous',
      permissions.join(','),
      roles.join(','),
      modules.join(','),
      department || '',
      minimumLevel?.toString() || '',
      dataOwner || '',
      dataDepartment || '',
      dataLevel || '',
      JSON.stringify(options),
    ];
    return keyParts.join('|');
  }, [
    user?.id,
    permissions,
    roles,
    modules,
    department,
    minimumLevel,
    dataOwner,
    dataDepartment,
    dataLevel,
    options,
  ]);

  /**
   * 从缓存获取结果
   */
  const getCachedResult = (key: string): boolean | null => {
    const cached = permissionCache[key];
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      // 过期了，删除缓存
      setPermissionCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      return null;
    }
    
    return cached.result;
  };

  /**
   * 设置缓存结果
   */
  const setCachedResult = (key: string, result: boolean, ttlMs: number = 5 * 60 * 1000) => {
    if (!cacheResult) return;
    
    setPermissionCache(prev => ({
      ...prev,
      [key]: {
        result,
        timestamp: Date.now(),
        ttl: ttlMs,
      },
    }));
  };

  /**
   * 检查权限
   */
  const checkPermissions = async (): Promise<{
    hasAccess: boolean;
    reason: string;
    details: any;
  }> => {
    try {
      // 检查是否已登录
      if (!isAuthenticated || !user) {
        return {
          hasAccess: false,
          reason: '未登录',
          details: { step: 'authentication' }
        };
      }

      // 如果只需要认证，允许通过
      if (requiredAuth && !permissions && !roles && !modules) {
        return {
          hasAccess: true,
          reason: '已认证用户',
          details: { step: 'authentication_only' }
        };
      }

      // 如果没有权限数据，但用户已登录，临时允许通过
      if (!userPermissions) {
        console.warn('权限数据未加载，临时允许通过');
        return {
          hasAccess: true,
          reason: '权限数据未加载，临时允许',
          details: { step: 'fallback' }
        };
      }

      // 检查缓存
      const cacheKey = getCacheKey;
      const cachedResult = getCachedResult(cacheKey);
      if (cachedResult !== null) {
        return {
          hasAccess: cachedResult,
          reason: cachedResult ? '权限检查通过 (缓存)' : '权限不足 (缓存)',
          details: { step: 'cache', cached: true }
        };
      }

      const checks: Array<{
        name: string;
        passed: boolean;
        reason: string;
      }> = [];

      // 1. 角色检查
      if (roles.length > 0) {
        const roleCheck = checkRoles(user, roles, requireAll);
        checks.push({
          name: 'role',
          passed: roleCheck.passed,
          reason: roleCheck.reason
        });
      }

      // 2. 权限特性检查
      if (permissions.length > 0) {
        const permissionCheck = checkPermissionFeatures(userPermissions, permissions, requireAll);
        checks.push({
          name: 'permissions',
          passed: permissionCheck.passed,
          reason: permissionCheck.reason
        });
      }

      // 3. 模块访问权限检查
      if (modules.length > 0) {
        const moduleCheck = checkModuleAccess(userPermissions, modules, requireAll);
        checks.push({
          name: 'modules',
          passed: moduleCheck.passed,
          reason: moduleCheck.reason
        });
      }

      // 4. 权限级别检查
      if (checkLevel && minimumLevel !== undefined) {
        const levelCheck = checkPermissionLevel(userPermissions, minimumLevel);
        checks.push({
          name: 'level',
          passed: levelCheck.passed,
          reason: levelCheck.reason
        });
      }

      // 5. 部门权限检查
      if (checkDepartment && department) {
        const deptCheck = checkDepartmentAccess(user, department);
        checks.push({
          name: 'department',
          passed: deptCheck.passed,
          reason: deptCheck.reason
        });
      }

      // 6. 数据访问权限检查
      if (dataLevel) {
        const dataCheck = checkDataAccess(user, userPermissions, {
          level: dataLevel,
          owner: dataOwner,
          department: dataDepartment
        });
        checks.push({
          name: 'data',
          passed: dataCheck.passed,
          reason: dataCheck.reason
        });
      }

      // 判断总体结果
      const failedChecks = checks.filter(check => !check.passed);
      const hasAccess = failedChecks.length === 0;

      const result = {
        hasAccess,
        reason: hasAccess 
          ? '权限检查通过' 
          : `权限不足: ${failedChecks.map(c => c.reason).join('; ')}`,
        details: {
          checks,
          user: user.id,
          role: userPermissions.role,
          userType: userPermissions.userType
        }
      };

      // 缓存结果
      setCachedResult(cacheKey, hasAccess);

      return result;

    } catch (error: any) {
      console.error('Permission check error:', error);
      return {
        hasAccess: false,
        reason: `权限检查失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  };

  /**
   * 执行权限检查
   */
  const performPermissionCheck = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkPermissions();
      setPermissionResult(result);
      
      if (result.hasAccess) {
        onPermissionGranted?.();
      } else {
        onPermissionDenied?.(result.reason);
      }
    } catch (error: any) {
      setError(error.message);
      
      // 如果启用重试且是网络错误，稍后重试
      if (retryOnFailure && error.message.includes('Network')) {
        setTimeout(() => {
          performPermissionCheck();
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }, [retryOnFailure, onPermissionGranted, onPermissionDenied, checkPermissions]);

  useEffect(() => {
    performPermissionCheck();
  }, [
    performPermissionCheck,
    user?.id,
    userPermissions?.role,
    permissions,
    roles,
    modules,
    department,
    minimumLevel,
    dataOwner,
    dataDepartment,
    dataLevel,
    getCacheKey,
  ]);

  // 加载状态
  if (isLoading) {
    return loadingComponent || <DefaultLoadingComponent />;
  }

  // 错误状态
  if (error) {
    return errorComponent || <DefaultErrorComponent error={error} onRetry={performPermissionCheck} />;
  }

  // 权限检查结果
  if (!permissionResult?.hasAccess) {
    if (!showFallback) return null;
    
    return fallback || (
      <DefaultPermissionDeniedComponent 
        reason={permissionResult?.reason || '权限不足'}
        details={permissionResult?.details}
        onContactAdmin={() => {
          // 可以实现联系管理员的功能
          console.log('Contact admin for permission');
        }}
      />
    );
  }

  return <>{children}</>;
};

/**
 * 检查角色
 */
function checkRoles(user: User, requiredRoles: UserRole[], requireAll: boolean): {
  passed: boolean;
  reason: string;
} {
  const userRole = getUserRole(user);
  
  if (requireAll) {
    // 需要所有角色 (通常不现实，但保留此选项)
    const hasAllRoles = requiredRoles.every(role => role === userRole);
    return {
      passed: hasAllRoles,
      reason: hasAllRoles ? '角色匹配' : `需要所有角色: ${requiredRoles.join(', ')}`
    };
  } else {
    // 需要任意一个角色
    const hasAnyRole = requiredRoles.includes(userRole);
    return {
      passed: hasAnyRole,
      reason: hasAnyRole ? '角色匹配' : `需要角色之一: ${requiredRoles.join(', ')}`
    };
  }
}

/**
 * 检查权限特性
 */
function checkPermissionFeatures(permissions: UserPermissions, requiredPermissions: string[], requireAll: boolean): {
  passed: boolean;
  reason: string;
} {
  if (requireAll) {
    const hasAllPermissions = requiredPermissions.every(perm => permissions.features.includes(perm));
    return {
      passed: hasAllPermissions,
      reason: hasAllPermissions ? '权限匹配' : `缺少权限: ${requiredPermissions.filter(p => !permissions.features.includes(p)).join(', ')}`
    };
  } else {
    const hasAnyPermission = requiredPermissions.some(perm => permissions.features.includes(perm));
    return {
      passed: hasAnyPermission,
      reason: hasAnyPermission ? '权限匹配' : `需要权限之一: ${requiredPermissions.join(', ')}`
    };
  }
}

/**
 * 检查模块访问权限
 */
function checkModuleAccess(permissions: UserPermissions, requiredModules: string[], requireAll: boolean): {
  passed: boolean;
  reason: string;
} {
  const moduleAccess = permissions.modules as any;
  
  if (requireAll) {
    const hasAllModules = requiredModules.every(module => moduleAccess[module] === true);
    return {
      passed: hasAllModules,
      reason: hasAllModules ? '模块权限匹配' : `缺少模块权限: ${requiredModules.filter(m => !moduleAccess[m]).join(', ')}`
    };
  } else {
    const hasAnyModule = requiredModules.some(module => moduleAccess[module] === true);
    return {
      passed: hasAnyModule,
      reason: hasAnyModule ? '模块权限匹配' : `需要模块权限之一: ${requiredModules.join(', ')}`
    };
  }
}

/**
 * 检查权限级别
 */
function checkPermissionLevel(permissions: UserPermissions, minimumLevel: number): {
  passed: boolean;
  reason: string;
} {
  const userLevel = permissions.level || ROLE_LEVELS[permissions.role as keyof typeof ROLE_LEVELS] || 100;
  const hasLevel = userLevel <= minimumLevel;
  
  return {
    passed: hasLevel,
    reason: hasLevel ? '权限级别满足' : `权限级别不足，需要级别 ${minimumLevel} 或更高，当前级别 ${userLevel}`
  };
}

/**
 * 检查部门权限
 */
function checkDepartmentAccess(user: User, requiredDepartment: string): {
  passed: boolean;
  reason: string;
} {
  if (user.userType === 'platform') {
    return { passed: true, reason: '平台用户有所有部门权限' };
  }
  
  const factoryUser = user as any;
  const userDepartment = factoryUser.factoryUser?.department;
  const userDepartments = factoryUser.factoryUser?.departments || [];
  
  const hasAccess = userDepartment === requiredDepartment || 
                   userDepartments.includes(requiredDepartment);
  
  return {
    passed: hasAccess,
    reason: hasAccess ? '部门权限匹配' : `无权访问${requiredDepartment}部门`
  };
}

/**
 * 检查数据访问权限
 */
function checkDataAccess(
  user: User, 
  permissions: UserPermissions, 
  data: { level: string; owner?: string; department?: string }
): {
  passed: boolean;
  reason: string;
} {
  const { level, owner, department } = data;
  
  switch (level) {
    case 'all':
      const canAccessAll = permissions.userType === 'platform' || 
                          permissions.role === 'system_developer';
      return {
        passed: canAccessAll,
        reason: canAccessAll ? '有全部数据权限' : '需要平台管理员权限'
      };
      
    case 'factory':
      const canAccessFactory = user.userType === 'platform' || 
                              (user as any).factoryUser?.factoryId;
      return {
        passed: canAccessFactory,
        reason: canAccessFactory ? '有工厂数据权限' : '需要工厂用户权限'
      };
      
    case 'department':
      const canAccessDept = checkDepartmentAccess(user, department || '').passed;
      return {
        passed: canAccessDept,
        reason: canAccessDept ? '有部门数据权限' : '需要部门权限'
      };
      
    case 'own':
      const canAccessOwn = user.id === owner;
      return {
        passed: canAccessOwn,
        reason: canAccessOwn ? '有个人数据权限' : '只能访问自己的数据'
      };
      
    default:
      return { passed: true, reason: '无特殊数据权限要求' };
  }
}

/**
 * 获取用户角色
 */
function getUserRole(user: User): UserRole {
  if (user.userType === 'platform') {
    return (user as any).platformUser?.role || 'platform_operator';
  } else {
    return (user as any).factoryUser?.role || 'operator';
  }
}

/**
 * 默认加载组件
 */
const DefaultLoadingComponent: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="small" color="#4ECDC4" />
    <Text style={styles.loadingText}>检查权限...</Text>
  </View>
);

/**
 * 默认错误组件
 */
const DefaultErrorComponent: React.FC<{
  error: string;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
    <Text style={styles.errorText}>权限检查失败</Text>
    <Text style={styles.errorDetail}>{error}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
      <Text style={styles.retryText}>重试</Text>
    </TouchableOpacity>
  </View>
);

/**
 * 默认权限拒绝组件
 */
const DefaultPermissionDeniedComponent: React.FC<{
  reason: string;
  details?: any;
  onContactAdmin: () => void;
}> = ({ reason, details, onContactAdmin }) => (
  <View style={styles.deniedContainer}>
    <Ionicons name="lock-closed" size={48} color="#FF6B6B" />
    <Text style={styles.deniedTitle}>访问受限</Text>
    <Text style={styles.deniedReason}>{reason}</Text>
    
    {details?.checks && (
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>权限检查详情:</Text>
        {details.checks.map((check: any, index: number) => (
          <Text key={index} style={[
            styles.detailsText,
            { color: check.passed ? '#4ECDC4' : '#FF6B6B' }
          ]}>
            {check.name}: {check.passed ? '✓' : '✗'} {check.reason}
          </Text>
        ))}
      </View>
    )}
    
    <TouchableOpacity style={styles.contactButton} onPress={onContactAdmin}>
      <Text style={styles.contactText}>联系管理员</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginTop: 8,
    marginBottom: 4,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  deniedReason: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  detailsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 12,
    marginBottom: 4,
  },
  contactButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  contactText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default EnhancedPermissionGuard;