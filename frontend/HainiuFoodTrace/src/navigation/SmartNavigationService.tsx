import React from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import { Alert } from 'react-native';
import { RootStackParamList, ROLE_ROUTE_MAPPING } from './types';
import { USER_ROLE_CONFIG } from '../components/permissions/RoleSelector';

/**
 * 智能导航服务
 * 提供基于用户权限和角色的智能导航功能
 */
class SmartNavigationServiceClass {
  private navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>;
  private isNavigationReady: boolean = false;
  private pendingNavigations: Array<() => void> = [];
  private navigationHistory: string[] = [];
  private currentUser: any = null;

  constructor() {
    this.navigationRef = React.createRef();
  }

  /**
   * 设置导航容器引用
   */
  setNavigationRef(ref: React.RefObject<NavigationContainerRef<RootStackParamList>>) {
    this.navigationRef = ref;
  }

  /**
   * 设置导航准备就绪
   */
  setNavigationReady() {
    this.isNavigationReady = true;
    
    // 执行待处理的导航
    this.pendingNavigations.forEach(navigation => navigation());
    this.pendingNavigations = [];
  }

  /**
   * 更新当前用户信息
   */
  setCurrentUser(user: any) {
    this.currentUser = user;
  }

  /**
   * 监听导航状态变化
   */
  onNavigationStateChange(state: any) {
    if (state?.routes) {
      const currentRoute = this.getCurrentRouteName(state);
      if (currentRoute && currentRoute !== this.getCurrentRoute()) {
        this.navigationHistory.push(currentRoute);
        
        // 保持历史记录在合理长度
        if (this.navigationHistory.length > 50) {
          this.navigationHistory = this.navigationHistory.slice(-30);
        }
      }
    }
  }

  /**
   * 获取当前路由名称
   */
  getCurrentRouteName(state?: any): string | undefined {
    const navigationState = state || this.navigationRef.current?.getRootState();
    if (!navigationState) return undefined;

    const findCurrentRoute = (state: any): string | undefined => {
      if (state.index !== undefined && state.routes) {
        const currentRoute = state.routes[state.index];
        if (currentRoute.state) {
          return findCurrentRoute(currentRoute.state);
        }
        return currentRoute.name;
      }
      return undefined;
    };

    return findCurrentRoute(navigationState);
  }

  /**
   * 获取当前路由
   */
  getCurrentRoute(): string {
    const currentRoute = this.getCurrentRouteName();
    return currentRoute || 'Unknown';
  }

  /**
   * 安全导航 - 等待导航准备就绪
   */
  private safeNavigate(navigationFn: () => void) {
    if (this.isNavigationReady) {
      navigationFn();
    } else {
      this.pendingNavigations.push(navigationFn);
    }
  }

  /**
   * 导航到指定路由
   */
  navigate(routeName: keyof RootStackParamList, params?: any) {
    this.safeNavigate(() => {
      try {
        this.navigationRef.current?.navigate(routeName as any, params);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    });
  }

  /**
   * 重置导航栈
   */
  reset(routes: Array<{ name: keyof RootStackParamList; params?: any }>) {
    this.safeNavigate(() => {
      try {
        this.navigationRef.current?.reset({
          index: routes.length - 1,
          routes: routes
        });
      } catch (error) {
        console.error('Navigation reset error:', error);
      }
    });
  }

  /**
   * 返回上一页
   */
  goBack() {
    this.safeNavigate(() => {
      try {
        if (this.navigationRef.current?.canGoBack()) {
          this.navigationRef.current.goBack();
        } else {
          // 如果无法返回，导航到默认主页
          this.navigateToDefaultScreen();
        }
      } catch (error) {
        console.error('Go back error:', error);
      }
    });
  }

  /**
   * 根据用户角色获取默认路由
   */
  getDefaultRouteForRole(role: string): keyof RootStackParamList {
    // 系统开发者 - 可以选择进入任何区域
    if (role === 'system_developer') {
      return 'Main';
    }

    // 平台用户 - 进入平台管理
    if (role === 'platform_super_admin' || role === 'platform_operator') {
      return 'Main'; // 会显示平台管理选项
    }

    // 工厂用户 - 根据权限级别决定
    const roleInfo = USER_ROLE_CONFIG[role];
    if (roleInfo) {
      switch (roleInfo.level) {
        case 0: // factory_super_admin - 工厂管理
          return 'Main';
        case 5: // permission_admin - 权限管理
        case 10: // department_admin - 部门管理
          return 'Main';
        case 30: // operator - 操作界面
        case 50: // viewer - 查看界面
        default:
          return 'Main';
      }
    }

    return 'Main';
  }

  /**
   * 智能导航到用户默认页面
   */
  navigateToUserDefault(user?: any) {
    const currentUser = user || this.currentUser;
    if (!currentUser?.role) {
      this.navigate('Main');
      return;
    }

    const defaultRoute = this.getDefaultRouteForRole(currentUser.role);
    this.navigate(defaultRoute);
  }

  /**
   * 导航到默认屏幕
   */
  navigateToDefaultScreen() {
    if (this.currentUser) {
      this.navigateToUserDefault(this.currentUser);
    } else {
      this.navigate('Main');
    }
  }

  /**
   * 智能登录后导航
   */
  navigateAfterLogin(user: any) {
    this.setCurrentUser(user);
    
    // 根据用户类型和角色智能导航
    const { role, userType } = user;
    
    if (role === 'system_developer') {
      // 系统开发者显示选择界面
      this.navigate('Main');
    } else if (userType === 'platform') {
      // 平台用户进入平台管理
      this.navigate('Main');
    } else if (userType === 'factory') {
      // 工厂用户根据角色进入相应界面
      this.navigateToUserDefault(user);
    } else {
      // 默认进入主界面
      this.navigate('Main');
    }
  }

  /**
   * 权限验证失败后的导航
   */
  navigateOnPermissionDenied(requiredRole?: string, requiredPermission?: string) {
    Alert.alert(
      '权限不足',
      `您没有访问此功能的权限。${
        requiredRole ? `需要角色: ${requiredRole}` : ''
      }${
        requiredPermission ? `需要权限: ${requiredPermission}` : ''
      }`,
      [
        {
          text: '返回',
          onPress: () => this.goBack()
        },
        {
          text: '回到首页',
          onPress: () => this.navigateToDefaultScreen()
        }
      ]
    );
  }

  /**
   * 导航到权限不足页面
   */
  navigateToUnauthorized(requiredRole?: string, requiredPermission?: string) {
    this.navigate('Unauthorized', {
      requiredRole,
      requiredPermission
    });
  }

  /**
   * 网络错误时的导航处理
   */
  handleNetworkError() {
    Alert.alert(
      '网络连接错误',
      '请检查您的网络连接后重试',
      [
        {
          text: '重试',
          onPress: () => {
            // 重新加载当前页面
            const currentRoute = this.getCurrentRoute();
            this.navigate(currentRoute as any);
          }
        },
        {
          text: '离线模式',
          onPress: () => {
            // 可以实现离线模式逻辑
            console.log('Entering offline mode');
          }
        }
      ]
    );
  }

  /**
   * 深度链接处理
   */
  handleDeepLink(url: string) {
    try {
      const urlParts = url.split('://');
      if (urlParts.length < 2) return false;

      const path = urlParts[1];
      const pathParts = path.split('/');
      
      if (pathParts.length > 0) {
        const routeName = pathParts[0];
        const params = this.parseUrlParams(pathParts.slice(1));
        
        // 验证路由是否存在
        const validRoutes: (keyof RootStackParamList)[] = [
          'Auth', 'Main', 'Platform', 'NotFound', 'Unauthorized'
        ];
        
        if (validRoutes.includes(routeName as any)) {
          this.navigate(routeName as any, params);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Deep link parsing error:', error);
      return false;
    }
  }

  /**
   * 解析URL参数
   */
  private parseUrlParams(pathParts: string[]): any {
    const params: any = {};
    
    for (let i = 0; i < pathParts.length; i += 2) {
      if (i + 1 < pathParts.length) {
        params[pathParts[i]] = decodeURIComponent(pathParts[i + 1]);
      }
    }
    
    return params;
  }

  /**
   * 获取导航历史
   */
  getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }

  /**
   * 清除导航历史
   */
  clearNavigationHistory() {
    this.navigationHistory = [];
  }

  /**
   * 检查是否可以返回
   */
  canGoBack(): boolean {
    return this.navigationRef.current?.canGoBack() || false;
  }

  /**
   * 获取导航状态信息
   */
  getNavigationState() {
    return {
      currentRoute: this.getCurrentRoute(),
      canGoBack: this.canGoBack(),
      history: this.getNavigationHistory(),
      isReady: this.isNavigationReady,
      currentUser: this.currentUser
    };
  }

  /**
   * 批量导航操作
   */
  batch(operations: Array<() => void>) {
    operations.forEach(operation => {
      try {
        operation();
      } catch (error) {
        console.error('Batch navigation operation error:', error);
      }
    });
  }

  /**
   * 条件导航 - 基于用户权限
   */
  navigateIfHasPermission(
    routeName: keyof RootStackParamList,
    checkPermission: () => boolean,
    params?: any,
    fallbackRoute?: keyof RootStackParamList
  ) {
    if (checkPermission()) {
      this.navigate(routeName, params);
    } else {
      if (fallbackRoute) {
        this.navigate(fallbackRoute);
      } else {
        this.navigateToUnauthorized();
      }
    }
  }

  /**
   * 延迟导航
   */
  navigateWithDelay(
    routeName: keyof RootStackParamList,
    delay: number = 0,
    params?: any
  ) {
    setTimeout(() => {
      this.navigate(routeName, params);
    }, delay);
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.navigationRef = React.createRef();
    this.isNavigationReady = false;
    this.pendingNavigations = [];
    this.navigationHistory = [];
    this.currentUser = null;
  }
}

// 创建单例实例
export const SmartNavigationService = new SmartNavigationServiceClass();

// 导出类型用于其他地方使用
export type SmartNavigationServiceType = SmartNavigationServiceClass;

export default SmartNavigationService;