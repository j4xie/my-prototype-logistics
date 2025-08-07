/**
 * 导航系统类型定义
 * 定义所有路由、参数和权限配置
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DrawerScreenProps } from '@react-navigation/drawer';

// 根栈导航参数
export type RootStackParamList = {
  // 认证相关
  Auth: NavigatorScreenParams<AuthStackParamList>;
  // 主应用
  Main: NavigatorScreenParams<MainTabParamList>;
  // 平台管理
  Platform: NavigatorScreenParams<PlatformStackParamList>;
  // 工厂管理
  Factory: NavigatorScreenParams<FactoryStackParamList>;
  // 通用屏幕
  NotFound: undefined;
  Unauthorized: { requiredRole?: string; requiredPermission?: string };
  Maintenance: undefined;
};

// 认证栈参数
export type AuthStackParamList = {
  Login: undefined;
  Register: { phoneNumber?: string };
  PhoneVerification: { phoneNumber: string; verificationType: 'register' | 'reset' };
  CompleteProfile: { tempToken: string; userType: 'platform' | 'factory' };
  ResetPassword: { phoneNumber: string; verificationCode: string };
  BiometricSetup: { userId: string };
};

// 主标签页参数
export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Processing: NavigatorScreenParams<ProcessingStackParamList>;
  Logistics: NavigatorScreenParams<LogisticsStackParamList>;
  Sales: NavigatorScreenParams<SalesStackParamList>;
  Reports: NavigatorScreenParams<ReportsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// 主页栈参数
export type HomeStackParamList = {
  Dashboard: undefined;
  Notifications: undefined;
  QuickActions: undefined;
  RoleSelector: undefined;
};

// 加工模块栈参数
export type ProcessingStackParamList = {
  ProcessingDashboard: undefined;
  ProductionList: { status?: 'active' | 'completed' | 'pending' };
  ProductionDetail: { productionId: string };
  QualityControl: { productionId?: string };
  EmployeeInput: { mode: 'manual' | 'scan' };
  EquipmentManagement: undefined;
  ProcessingAnalytics: { dateRange?: string };
};

// 物流模块栈参数
export type LogisticsStackParamList = {
  LogisticsDashboard: undefined;
  WarehouseManagement: undefined;
  ShipmentList: { status?: string };
  ShipmentDetail: { shipmentId: string };
  VehicleTracking: undefined;
  DeliverySchedule: undefined;
};

// 销售模块栈参数
export type SalesStackParamList = {
  SalesDashboard: undefined;
  OrderList: { status?: string };
  OrderDetail: { orderId: string };
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
  PriceManagement: undefined;
};

// 报告模块栈参数
export type ReportsStackParamList = {
  ReportsDashboard: undefined;
  ProductionReports: { type: string };
  QualityReports: { dateRange?: string };
  TraceabilityReports: { productId?: string };
  CustomReports: undefined;
  ExportCenter: undefined;
};

// 个人中心栈参数
export type ProfileStackParamList = {
  ProfileDashboard: undefined;
  PersonalInfo: undefined;
  SecuritySettings: undefined;
  PermissionView: undefined;
  NotificationSettings: undefined;
  About: undefined;
};

// 平台管理栈参数
export type PlatformStackParamList = {
  PlatformDashboard: undefined;
  UserManagement: { userType?: 'platform' | 'factory' };
  FactoryManagement: undefined;
  SystemSettings: undefined;
  AuditLogs: { dateRange?: string };
  DataAnalytics: undefined;
};

// 工厂管理栈参数
export type FactoryStackParamList = {
  FactoryDashboard: undefined;
  EmployeeManagement: { departmentId?: string };
  DepartmentManagement: undefined;
  PermissionManagement: undefined;
  ProductionSettings: undefined;
  FactoryReports: undefined;
};

// 导航权限配置
export interface NavigationPermission {
  routeName: string;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requiredLevel?: number;
  checkDepartment?: boolean;
  customCheck?: (user: any) => boolean;
}

// 菜单项配置
export interface MenuItem {
  key: string;
  title: string;
  icon: string;
  route: string;
  params?: any;
  badge?: string | number;
  color?: string;
  subItems?: MenuItem[];
  permission?: NavigationPermission;
  hideInProduction?: boolean;
  platformOnly?: boolean;
  factoryOnly?: boolean;
}

// 导航主题配置
export interface NavigationTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
    tabBar: {
      active: string;
      inactive: string;
      background: string;
    };
    drawer: {
      active: string;
      inactive: string;
      background: string;
    };
  };
}

// 导航选项配置
export interface NavigationOptions {
  gestureEnabled?: boolean;
  animationEnabled?: boolean;
  headerShown?: boolean;
  tabBarVisible?: boolean;
  drawerLockMode?: 'unlocked' | 'locked-closed' | 'locked-open';
  orientation?: 'portrait' | 'landscape' | 'all';
}

// 路由守卫配置
export interface RouteGuard {
  name: string;
  beforeEnter?: (to: string, from: string, next: (result?: boolean | string) => void) => void;
  beforeLeave?: (to: string, from: string, next: (result?: boolean | string) => void) => void;
  canActivate?: () => boolean | Promise<boolean>;
  canDeactivate?: () => boolean | Promise<boolean>;
}

// 导航状态
export interface NavigationState {
  currentRoute: string;
  previousRoute: string;
  params: any;
  isNavigating: boolean;
  history: string[];
  guards: RouteGuard[];
}

// 导航事件
export type NavigationEvent = 
  | { type: 'NAVIGATE'; payload: { route: string; params?: any } }
  | { type: 'GO_BACK' }
  | { type: 'RESET'; payload: { routes: string[] } }
  | { type: 'SET_PARAMS'; payload: { params: any } }
  | { type: 'GUARD_BLOCKED'; payload: { route: string; reason: string } };

// Screen Props 类型助手
export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  StackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = 
  StackScreenProps<AuthStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  BottomTabScreenProps<MainTabParamList, T>;

export type ProcessingStackScreenProps<T extends keyof ProcessingStackParamList> = 
  StackScreenProps<ProcessingStackParamList, T>;

// 导出导航常量
export const NAVIGATION_CONSTANTS = {
  // 默认路由
  DEFAULT_AUTH_ROUTE: 'Login',
  DEFAULT_MAIN_ROUTE: 'Home',
  DEFAULT_PLATFORM_ROUTE: 'PlatformDashboard',
  DEFAULT_FACTORY_ROUTE: 'FactoryDashboard',
  
  // 动画配置
  ANIMATION_DURATION: 300,
  GESTURE_RESPONSE_DISTANCE: 50,
  
  // 标签栏配置
  TAB_BAR_HEIGHT: 60,
  TAB_ICON_SIZE: 24,
  
  // 抽屉配置
  DRAWER_WIDTH: 280,
  DRAWER_EDGE_WIDTH: 20,
} as const;

// 角色路由映射
export const ROLE_ROUTE_MAPPING: Record<string, string> = {
  system_developer: 'Home',
  platform_super_admin: 'Platform',
  platform_operator: 'Platform',
  factory_super_admin: 'Factory',
  permission_admin: 'Factory',
  department_admin: 'Processing',
  operator: 'Processing',
  viewer: 'Reports'
};