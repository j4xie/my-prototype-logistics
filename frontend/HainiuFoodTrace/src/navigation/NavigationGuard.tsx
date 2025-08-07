import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { usePermission } from '../hooks/usePermission';
import { useLogin } from '../hooks/useLogin';
import { SmartNavigationService } from './SmartNavigationService';
import { RouteGuard, NavigationPermission } from './types';

// 路由守卫配置
const ROUTE_GUARDS: Record<string, NavigationPermission> = {
  // 平台管理路由
  'Platform': {
    routeName: 'Platform',
    requiredRoles: ['platform_super_admin', 'platform_operator'],
    requiredLevel: 1
  },
  'PlatformDashboard': {
    routeName: 'PlatformDashboard',
    requiredRoles: ['platform_super_admin', 'platform_operator'],
    requiredLevel: 1
  },
  
  // 工厂管理路由
  'Factory': {
    routeName: 'Factory',
    requiredRoles: ['factory_super_admin'],
    requiredLevel: 0
  },
  'FactoryDashboard': {
    routeName: 'FactoryDashboard',
    requiredRoles: ['factory_super_admin'],
    requiredLevel: 0
  },
  
  // 用户管理路由
  'UserManagement': {
    routeName: 'UserManagement',
    requiredRoles: ['platform_super_admin', 'factory_super_admin', 'permission_admin'],
    requiredPermissions: ['user.manage']
  },
  
  // 权限管理路由
  'PermissionManagement': {
    routeName: 'PermissionManagement',
    requiredRoles: ['platform_super_admin', 'factory_super_admin', 'permission_admin'],
    requiredPermissions: ['permission.manage']
  },
  
  // 加工管理路由
  'Processing': {
    routeName: 'Processing',
    requiredRoles: ['factory_super_admin', 'department_admin', 'operator'],
    requiredPermissions: ['processing.view'],
    checkDepartment: true
  },
  'ProcessingDashboard': {
    routeName: 'ProcessingDashboard',
    requiredRoles: ['factory_super_admin', 'department_admin', 'operator'],
    requiredPermissions: ['processing.view'],
    checkDepartment: true
  },
  'QualityControl': {
    routeName: 'QualityControl',
    requiredRoles: ['factory_super_admin', 'department_admin'],
    requiredPermissions: ['processing.quality_control'],
    requiredLevel: 10
  },
  
  // 物流管理路由
  'Logistics': {
    routeName: 'Logistics',
    requiredRoles: ['factory_super_admin'],
    requiredPermissions: ['logistics.view']
  },
  
  // 销售管理路由
  'Sales': {
    routeName: 'Sales',
    requiredRoles: ['factory_super_admin', 'department_admin'],
    requiredPermissions: ['sales.view']
  },
  
  // 报告路由
  'Reports': {
    routeName: 'Reports',
    requiredPermissions: ['report.view']
  },
  'ReportsDashboard': {
    routeName: 'ReportsDashboard',
    requiredPermissions: ['report.view']
  },
  
  // 系统设置路由
  'SystemSettings': {
    routeName: 'SystemSettings',
    requiredRoles: ['platform_super_admin'],
    requiredPermissions: ['system.admin']
  },
  
  // 审计日志路由
  'AuditLogs': {
    routeName: 'AuditLogs',
    requiredRoles: ['platform_super_admin', 'factory_super_admin'],
    requiredPermissions: ['audit.view']
  }
};

interface NavigationGuardProps {
  children: React.ReactNode;
}

/**
 * 导航守卫组件
 * 提供路由级别的权限验证和导航控制
 */
export const NavigationGuard: React.FC<NavigationGuardProps> = ({ children }) => {
  const [guardedRoutes, setGuardedRoutes] = useState<string[]>([]);
  const [navigationBlocked, setNavigationBlocked] = useState(false);

  const navigation = useNavigation();
  const route = useRoute();
  const { user, hasPermission, hasRole, hasAnyRole, isAuthenticated } = usePermission();
  const { networkStatus, isLoading } = useLogin();

  // 获取当前路由名称
  const currentRouteName = useMemo(() => {
    return route.name || 'Unknown';
  }, [route.name]);

  // 检查路由权限
  const checkRoutePermission = useCallback((routeName: string): { 
    hasAccess: boolean; 
    reason?: string; 
    requiredRole?: string; 
    requiredPermission?: string 
  } => {
    // 如果用户未认证，只允许访问认证相关路由
    if (!isAuthenticated) {
      const allowedUnauthenticatedRoutes = ['Login', 'Register', 'Activation', 'Auth'];
      if (!allowedUnauthenticatedRoutes.includes(routeName)) {
        return {
          hasAccess: false,
          reason: 'User not authenticated',
          requiredRole: undefined,
          requiredPermission: undefined
        };
      }
      return { hasAccess: true };
    }

    // 检查路由守卫配置
    const guardConfig = ROUTE_GUARDS[routeName];
    if (!guardConfig) {
      // 没有配置守卫的路由默认允许访问
      return { hasAccess: true };
    }

    // 系统开发者拥有所有权限
    if (user?.role === 'system_developer') {
      return { hasAccess: true };
    }

    // 检查自定义权限验证函数
    if (guardConfig.customCheck) {
      const customResult = guardConfig.customCheck(user);
      if (!customResult) {
        return {
          hasAccess: false,
          reason: 'Custom permission check failed',
          requiredRole: guardConfig.requiredRoles?.[0],
          requiredPermission: guardConfig.requiredPermissions?.[0]
        };
      }
    }

    // 检查用户级别权限
    if (guardConfig.requiredLevel !== undefined && user?.level !== undefined) {
      if (user.level > guardConfig.requiredLevel) {
        return {
          hasAccess: false,
          reason: 'Insufficient user level',
          requiredRole: guardConfig.requiredRoles?.[0],
          requiredPermission: guardConfig.requiredPermissions?.[0]
        };
      }
    }

    // 检查角色权限
    if (guardConfig.requiredRoles && guardConfig.requiredRoles.length > 0) {
      if (!hasAnyRole(guardConfig.requiredRoles)) {
        return {
          hasAccess: false,
          reason: 'Required role not found',
          requiredRole: guardConfig.requiredRoles[0],
          requiredPermission: guardConfig.requiredPermissions?.[0]
        };
      }
    }

    // 检查具体权限
    if (guardConfig.requiredPermissions && guardConfig.requiredPermissions.length > 0) {
      const missingPermissions = guardConfig.requiredPermissions.filter(
        permission => !hasPermission(permission)
      );
      
      if (missingPermissions.length > 0) {
        return {
          hasAccess: false,
          reason: 'Required permission not found',
          requiredRole: guardConfig.requiredRoles?.[0],
          requiredPermission: missingPermissions[0]
        };
      }
    }

    // 检查部门权限
    if (guardConfig.checkDepartment && user?.departmentId) {
      // TODO: 实现部门权限检查逻辑
      // 这里可以添加更复杂的部门权限验证
    }

    return { hasAccess: true };
  }, [isAuthenticated, user, hasPermission, hasRole, hasAnyRole]);

  // 处理路由权限验证失败
  const handlePermissionDenied = useCallback((
    routeName: string,
    reason: string,
    requiredRole?: string,
    requiredPermission?: string
  ) => {
    console.warn(`Navigation blocked to ${routeName}: ${reason}`);

    // 根据失败原因采取不同的处理策略
    switch (reason) {
      case 'User not authenticated':
        Alert.alert(
          '需要登录',
          '请先登录后再访问此功能',
          [
            {
              text: '去登录',
              onPress: () => SmartNavigationService.navigate('Auth')
            }
          ]
        );
        break;

      case 'Required role not found':
        SmartNavigationService.navigateOnPermissionDenied(requiredRole, requiredPermission);
        break;

      case 'Required permission not found':
        SmartNavigationService.navigateOnPermissionDenied(requiredRole, requiredPermission);
        break;

      case 'Insufficient user level':
        Alert.alert(
          '权限等级不足',
          '您的权限等级不足以访问此功能',
          [
            {
              text: '返回',
              onPress: () => SmartNavigationService.goBack()
            }
          ]
        );
        break;

      case 'Custom permission check failed':
        SmartNavigationService.navigateOnPermissionDenied(requiredRole, requiredPermission);
        break;

      default:
        SmartNavigationService.navigateToUnauthorized(requiredRole, requiredPermission);
        break;
    }

    setNavigationBlocked(true);
    
    // 重置阻塞状态
    setTimeout(() => {
      setNavigationBlocked(false);
    }, 1000);

  }, []);

  // 路由焦点效果 - 检查当前路由权限
  useFocusEffect(
    useCallback(() => {
      if (isLoading) return; // 等待认证状态确定

      const permissionCheck = checkRoutePermission(currentRouteName);
      
      if (!permissionCheck.hasAccess) {
        handlePermissionDenied(
          currentRouteName,
          permissionCheck.reason || 'Access denied',
          permissionCheck.requiredRole,
          permissionCheck.requiredPermission
        );
        return;
      }

      // 记录成功访问的路由
      if (!guardedRoutes.includes(currentRouteName)) {
        setGuardedRoutes(prev => [...prev, currentRouteName]);
      }

      // 更新导航服务的用户信息
      SmartNavigationService.setCurrentUser(user);

    }, [currentRouteName, checkRoutePermission, handlePermissionDenied, user, isLoading, guardedRoutes])
  );

  // 处理Android返回按钮
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // 如果导航被阻塞，阻止返回操作
        if (navigationBlocked) {
          return true;
        }

        // 检查是否可以安全返回
        if (SmartNavigationService.canGoBack()) {
          SmartNavigationService.goBack();
          return true;
        } else {
          // 如果无法返回，询问用户是否退出应用
          Alert.alert(
            '退出应用',
            '确定要退出应用吗？',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '退出',
                onPress: () => BackHandler.exitApp()
              }
            ]
          );
          return true;
        }
      });

      return () => backHandler.remove();
    }, [navigationBlocked])
  );

  // 监听网络状态变化
  useEffect(() => {
    if (networkStatus === 'offline') {
      // 网络离线时，限制某些需要网络的路由访问
      const networkRequiredRoutes = [
        'PlatformDashboard',
        'UserManagement', 
        'PermissionManagement',
        'SystemSettings',
        'AuditLogs'
      ];

      if (networkRequiredRoutes.includes(currentRouteName)) {
        Alert.alert(
          '网络连接异常',
          '此功能需要网络连接，请检查您的网络设置',
          [
            {
              text: '重试',
              onPress: () => {
                // 重新检查网络状态
                setTimeout(() => {
                  if (networkStatus === 'online') {
                    // 网络恢复，刷新当前页面
                    SmartNavigationService.navigate(currentRouteName as any);
                  }
                }, 1000);
              }
            },
            {
              text: '离线模式',
              onPress: () => SmartNavigationService.navigateToDefaultScreen()
            }
          ]
        );
      }
    }
  }, [networkStatus, currentRouteName]);

  // 全局导航拦截器
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // 如果导航被阻塞，阻止导航
      if (navigationBlocked) {
        e.preventDefault();
        return;
      }

      // 检查目标路由权限
      const targetRoute = e.data?.action?.payload?.name;
      if (targetRoute) {
        const permissionCheck = checkRoutePermission(targetRoute);
        
        if (!permissionCheck.hasAccess) {
          e.preventDefault();
          handlePermissionDenied(
            targetRoute,
            permissionCheck.reason || 'Access denied',
            permissionCheck.requiredRole,
            permissionCheck.requiredPermission
          );
        }
      }
    });

    return unsubscribe;
  }, [navigation, navigationBlocked, checkRoutePermission, handlePermissionDenied]);

  // 记录导航历史和统计
  useEffect(() => {
    // 记录用户访问的路由，用于分析用户行为
    console.log(`Navigation Guard: User ${user?.username || 'Unknown'} accessing route: ${currentRouteName}`);
    
    // 这里可以添加分析代码，比如发送到分析服务
    // AnalyticsService.trackNavigation(currentRouteName, user?.role);
  }, [currentRouteName, user]);

  return <>{children}</>;
};

export default NavigationGuard;