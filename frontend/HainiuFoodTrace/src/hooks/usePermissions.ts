import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { UserRole, UserPermissions, User } from '../types/auth';
import { ROLE_LEVELS, FULL_ROLE_PERMISSIONS } from '../constants/permissions';

export interface PermissionCheckOptions {
  requireAll?: boolean;
  checkLevel?: boolean;
  checkDepartment?: boolean;
  cacheResult?: boolean;
  cacheTTL?: number;
}

export interface EnhancedPermissionCheckResult {
  hasAccess: boolean;
  reason: string;
  details: {
    checks: Array<{
      name: string;
      passed: boolean;
      reason: string;
    }>;
    user?: string;
    role?: string;
    userType?: string;
    cached?: boolean;
  };
}

export interface DataAccessOptions {
  level: 'all' | 'factory' | 'department' | 'own';
  owner?: string;
  department?: string;
}

interface PermissionCache {
  [key: string]: {
    result: EnhancedPermissionCheckResult;
    timestamp: number;
    ttl: number;
  };
}

export interface UsePermissionsReturn {
  // 基础权限检查
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasModuleAccess: (module: string) => boolean;
  
  // 增强权限检查
  checkPermissions: (options: {
    permissions?: string[];
    roles?: UserRole[];
    modules?: string[];
    department?: string;
    minimumLevel?: number;
    dataAccess?: DataAccessOptions;
  }, checkOptions?: PermissionCheckOptions) => Promise<EnhancedPermissionCheckResult>;
  
  // 权限级别检查
  hasMinimumLevel: (level: number) => boolean;
  getUserLevel: () => number;
  
  // 部门权限检查
  hasDepartmentAccess: (department: string) => boolean;
  getUserDepartments: () => string[];
  
  // 数据访问权限
  hasDataAccess: (options: DataAccessOptions) => boolean;
  
  // 状态
  isLoading: boolean;
  error: string | null;
  
  // 缓存管理
  clearCache: () => void;
  getCacheStats: () => {
    totalEntries: number;
    hitRate: number;
    averageAge: number;
  };
  
  // 权限刷新
  refreshPermissions: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, permissions: userPermissions, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionCache, setPermissionCache] = useState<PermissionCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });

  /**
   * 生成缓存键
   */
  const generateCacheKey = useCallback((
    permissions: string[] = [],
    roles: UserRole[] = [],
    modules: string[] = [],
    department?: string,
    minimumLevel?: number,
    dataAccess?: DataAccessOptions,
    options: PermissionCheckOptions = {}
  ): string => {
    const keyParts = [
      user?.id || 'anonymous',
      permissions.sort().join(','),
      roles.sort().join(','),
      modules.sort().join(','),
      department || '',
      minimumLevel?.toString() || '',
      dataAccess ? JSON.stringify(dataAccess) : '',
      JSON.stringify(options),
    ];
    return keyParts.join('|');
  }, [user?.id]);

  /**
   * 获取缓存结果
   */
  const getCachedResult = useCallback((key: string): EnhancedPermissionCheckResult | null => {
    const cached = permissionCache[key];
    if (!cached) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }
    
    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      // 过期了，删除缓存
      setPermissionCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }
    
    setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    return {
      ...cached.result,
      details: {
        ...cached.result.details,
        cached: true
      }
    };
  }, [permissionCache]);

  /**
   * 设置缓存结果
   */
  const setCachedResult = useCallback((
    key: string, 
    result: EnhancedPermissionCheckResult, 
    ttlMs: number = 5 * 60 * 1000
  ) => {
    setPermissionCache(prev => ({
      ...prev,
      [key]: {
        result: {
          ...result,
          details: {
            ...result.details,
            cached: false
          }
        },
        timestamp: Date.now(),
        ttl: ttlMs,
      },
    }));
  }, []);

  /**
   * 基础权限检查 - hasPermission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!isAuthenticated || !userPermissions) return false;
    return userPermissions.features.includes(permission);
  }, [isAuthenticated, userPermissions]);

  /**
   * 基础角色检查 - hasRole
   */
  const hasRole = useCallback((role: UserRole): boolean => {
    if (!isAuthenticated || !userPermissions) return false;
    return userPermissions.role === role;
  }, [isAuthenticated, userPermissions]);

  /**
   * 多角色检查 - hasAnyRole
   */
  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    if (!isAuthenticated || !userPermissions) return false;
    return roles.includes(userPermissions.role as UserRole);
  }, [isAuthenticated, userPermissions]);

  /**
   * 模块权限检查 - hasModuleAccess
   */
  const hasModuleAccess = useCallback((module: string): boolean => {
    if (!isAuthenticated || !userPermissions) return false;
    const moduleAccess = userPermissions.modules as any;
    return moduleAccess[module] === true;
  }, [isAuthenticated, userPermissions]);

  /**
   * 获取用户权限级别
   */
  const getUserLevel = useCallback((): number => {
    if (!userPermissions) return 100; // 最低权限
    return userPermissions.level || ROLE_LEVELS[userPermissions.role as keyof typeof ROLE_LEVELS] || 100;
  }, [userPermissions]);

  /**
   * 权限级别检查
   */
  const hasMinimumLevel = useCallback((level: number): boolean => {
    const userLevel = getUserLevel();
    return userLevel <= level; // 数字越小权限越高
  }, [getUserLevel]);

  /**
   * 获取用户部门列表
   */
  const getUserDepartments = useCallback((): string[] => {
    if (!user || user.userType === 'platform') return [];
    
    const factoryUser = user as any;
    const departments = factoryUser.factoryUser?.departments || [];
    const department = factoryUser.factoryUser?.department;
    
    if (department && !departments.includes(department)) {
      departments.push(department);
    }
    
    return departments;
  }, [user]);

  /**
   * 部门权限检查
   */
  const hasDepartmentAccess = useCallback((department: string): boolean => {
    if (!user) return false;
    
    // 平台用户有所有部门权限
    if (user.userType === 'platform') return true;
    
    const userDepartments = getUserDepartments();
    return userDepartments.includes(department);
  }, [user, getUserDepartments]);

  /**
   * 数据访问权限检查
   */
  const hasDataAccess = useCallback((options: DataAccessOptions): boolean => {
    if (!isAuthenticated || !user || !userPermissions) return false;
    
    const { level, owner, department } = options;
    
    switch (level) {
      case 'all':
        return userPermissions.userType === 'platform' || 
               userPermissions.role === 'system_developer';
        
      case 'factory':
        return user.userType === 'platform' || 
               (user as any).factoryUser?.factoryId;
        
      case 'department':
        return department ? hasDepartmentAccess(department) : false;
        
      case 'own':
        return user.id === owner;
        
      default:
        return true;
    }
  }, [isAuthenticated, user, userPermissions, hasDepartmentAccess]);

  /**
   * 增强权限检查
   */
  const checkPermissions = useCallback(async (
    options: {
      permissions?: string[];
      roles?: UserRole[];
      modules?: string[];
      department?: string;
      minimumLevel?: number;
      dataAccess?: DataAccessOptions;
    },
    checkOptions: PermissionCheckOptions = {}
  ): Promise<EnhancedPermissionCheckResult> => {
    const {
      permissions = [],
      roles = [],
      modules = [],
      department,
      minimumLevel,
      dataAccess
    } = options;

    const {
      requireAll = false,
      checkLevel = false,
      checkDepartment = false,
      cacheResult = true,
      cacheTTL = 5 * 60 * 1000
    } = checkOptions;

    setIsLoading(true);
    setError(null);

    try {
      // 检查是否已登录
      if (!isAuthenticated || !user || !userPermissions) {
        return {
          hasAccess: false,
          reason: '用户未登录',
          details: {
            checks: [{
              name: 'authentication',
              passed: false,
              reason: '用户未登录'
            }]
          }
        };
      }

      // 检查缓存
      if (cacheResult) {
        const cacheKey = generateCacheKey(
          permissions, roles, modules, department, minimumLevel, dataAccess, checkOptions
        );
        const cachedResult = getCachedResult(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      const checks: Array<{
        name: string;
        passed: boolean;
        reason: string;
      }> = [];

      // 1. 角色检查
      if (roles.length > 0) {
        const roleCheckPassed = requireAll 
          ? roles.every(role => hasRole(role))
          : roles.some(role => hasRole(role));
        
        checks.push({
          name: 'roles',
          passed: roleCheckPassed,
          reason: roleCheckPassed 
            ? '角色验证通过' 
            : `需要角色${requireAll ? '全部' : '之一'}: ${roles.join(', ')}`
        });
      }

      // 2. 权限特性检查
      if (permissions.length > 0) {
        const permissionCheckPassed = requireAll
          ? permissions.every(perm => hasPermission(perm))
          : permissions.some(perm => hasPermission(perm));
        
        checks.push({
          name: 'permissions',
          passed: permissionCheckPassed,
          reason: permissionCheckPassed 
            ? '权限验证通过'
            : `需要权限${requireAll ? '全部' : '之一'}: ${permissions.join(', ')}`
        });
      }

      // 3. 模块访问权限检查
      if (modules.length > 0) {
        const moduleCheckPassed = requireAll
          ? modules.every(module => hasModuleAccess(module))
          : modules.some(module => hasModuleAccess(module));
        
        checks.push({
          name: 'modules',
          passed: moduleCheckPassed,
          reason: moduleCheckPassed 
            ? '模块权限验证通过'
            : `需要模块权限${requireAll ? '全部' : '之一'}: ${modules.join(', ')}`
        });
      }

      // 4. 权限级别检查
      if (checkLevel && minimumLevel !== undefined) {
        const levelCheckPassed = hasMinimumLevel(minimumLevel);
        const currentLevel = getUserLevel();
        
        checks.push({
          name: 'level',
          passed: levelCheckPassed,
          reason: levelCheckPassed 
            ? `权限级别满足 (${currentLevel})`
            : `权限级别不足，需要 ≤${minimumLevel}，当前 ${currentLevel}`
        });
      }

      // 5. 部门权限检查
      if (checkDepartment && department) {
        const deptCheckPassed = hasDepartmentAccess(department);
        
        checks.push({
          name: 'department',
          passed: deptCheckPassed,
          reason: deptCheckPassed 
            ? '部门权限验证通过'
            : `无权访问 ${department} 部门`
        });
      }

      // 6. 数据访问权限检查
      if (dataAccess) {
        const dataCheckPassed = hasDataAccess(dataAccess);
        
        checks.push({
          name: 'data',
          passed: dataCheckPassed,
          reason: dataCheckPassed 
            ? '数据访问权限验证通过'
            : `无权访问 ${dataAccess.level} 级别数据`
        });
      }

      // 判断总体结果
      const failedChecks = checks.filter(check => !check.passed);
      const hasAccess = failedChecks.length === 0;

      const result: EnhancedPermissionCheckResult = {
        hasAccess,
        reason: hasAccess 
          ? '权限验证通过' 
          : `权限不足: ${failedChecks.map(c => c.reason).join('; ')}`,
        details: {
          checks,
          user: user.id,
          role: userPermissions.role,
          userType: userPermissions.userType
        }
      };

      // 缓存结果
      if (cacheResult) {
        const cacheKey = generateCacheKey(
          permissions, roles, modules, department, minimumLevel, dataAccess, checkOptions
        );
        setCachedResult(cacheKey, result, cacheTTL);
      }

      return result;

    } catch (error: any) {
      const errorMessage = `权限检查失败: ${error.message}`;
      setError(errorMessage);
      
      return {
        hasAccess: false,
        reason: errorMessage,
        details: {
          checks: [{
            name: 'error',
            passed: false,
            reason: error.message
          }]
        }
      };
    } finally {
      setIsLoading(false);
    }
  }, [
    isAuthenticated,
    user,
    userPermissions,
    hasRole,
    hasPermission,
    hasModuleAccess,
    hasMinimumLevel,
    getUserLevel,
    hasDepartmentAccess,
    hasDataAccess,
    generateCacheKey,
    getCachedResult,
    setCachedResult
  ]);

  /**
   * 清除权限缓存
   */
  const clearCache = useCallback(() => {
    setPermissionCache({});
    setCacheStats({ hits: 0, misses: 0 });
  }, []);

  /**
   * 获取缓存统计
   */
  const getCacheStats = useCallback(() => {
    const totalEntries = Object.keys(permissionCache).length;
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;
    
    // 计算平均缓存年龄
    const now = Date.now();
    const ages = Object.values(permissionCache).map(entry => now - entry.timestamp);
    const averageAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
    
    return {
      totalEntries,
      hitRate: Math.round(hitRate * 100) / 100,
      averageAge: Math.round(averageAge / 1000) // 转换为秒
    };
  }, [permissionCache, cacheStats]);

  /**
   * 刷新权限
   */
  const refreshPermissions = useCallback(async () => {
    // 这里应该调用AuthService来刷新用户权限
    // 暂时清除缓存来强制重新检查
    clearCache();
  }, [clearCache]);

  // 清理过期缓存 (每分钟执行一次)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPermissionCache(prev => {
        const newCache = { ...prev };
        let hasChanges = false;
        
        Object.keys(newCache).forEach(key => {
          if (now > newCache[key].timestamp + newCache[key].ttl) {
            delete newCache[key];
            hasChanges = true;
          }
        });
        
        return hasChanges ? newCache : prev;
      });
    }, 60000); // 每分钟清理一次

    return () => clearInterval(interval);
  }, []);

  return {
    // 基础权限检查
    hasPermission,
    hasRole,
    hasAnyRole,
    hasModuleAccess,
    
    // 增强权限检查
    checkPermissions,
    
    // 权限级别检查
    hasMinimumLevel,
    getUserLevel,
    
    // 部门权限检查
    hasDepartmentAccess,
    getUserDepartments,
    
    // 数据访问权限
    hasDataAccess,
    
    // 状态
    isLoading,
    error,
    
    // 缓存管理
    clearCache,
    getCacheStats,
    
    // 权限刷新
    refreshPermissions
  };
}

export default usePermissions;