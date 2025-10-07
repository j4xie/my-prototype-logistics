/**
 * 导航类型定义
 * 定义应用中所有导航器的参数类型
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// ==================== Root导航参数 ====================

export type RootStackParamList = {
  // 认证流程
  Login: undefined;
  RegisterPhaseOne: undefined;
  RegisterPhaseTwo: { phoneNumber: string; tempToken?: string };

  // 主应用
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ==================== 主Tab导航参数 ====================

export type MainTabParamList = {
  HomeTab: undefined;
  ProcessingTab: NavigatorScreenParams<ProcessingStackParamList>;
  TimeClockTab: NavigatorScreenParams<TimeClockStackParamList>;
  AdminTab: NavigatorScreenParams<AdminStackParamList>;
  ManagementTab: NavigatorScreenParams<ManagementStackParamList>;
  PlatformTab: NavigatorScreenParams<PlatformStackParamList>;  // 平台管理
  ProfileTab: undefined;  // 个人中心
  // 未来模块预留
  FarmingTab?: NavigatorScreenParams<FarmingStackParamList>;
  LogisticsTab?: NavigatorScreenParams<LogisticsStackParamList>;
  TraceTab?: NavigatorScreenParams<TraceStackParamList>;
};

// ==================== 生产模块导航参数 ====================

export type ProcessingStackParamList = {
  ProcessingDashboard: undefined;

  // 批次管理
  BatchList: { status?: string; search?: string };
  BatchDetail: { batchId: string; readonly?: boolean };
  CreateBatch: undefined;
  EditBatch: { batchId: string };

  // 质检管理
  QualityInspectionList: { batchId?: string };
  CreateQualityRecord: { batchId: string; inspectionType: 'raw_material' | 'process' | 'final_product' };
  QualityInspectionDetail: { inspectionId: string };

  // 设备监控
  EquipmentMonitoring: undefined;
  EquipmentDetail: { equipmentId: string };
  EquipmentAlerts: { equipmentId?: string };

  // 成本分析
  CostAnalysisDashboard: { batchId?: string };
  CostComparison: { batchIds: string[] };
  DeepSeekAnalysis: { batchId: string };

  // 数据导出
  DataExport: { reportType: 'batch' | 'cost' | 'quality' | 'equipment' };

  // 生产计划管理
  ProductionPlanManagement: undefined;
};

// ==================== 打卡模块导航参数 ====================

export type TimeClockStackParamList = {
  TimeClockScreen: undefined;
  ClockHistory: { employeeId?: string };
  TimeStatistics: { employeeId?: string; period?: 'day' | 'week' | 'month' };
  WorkRecords: { employeeId?: string };
};

// ==================== 平台管理模块导航参数 ====================

export type PlatformStackParamList = {
  AIQuotaManagement: undefined;
  // TODO: Phase 2平台管理功能
  // PlatformDashboard: undefined;
  // FactoryList: undefined;
  // SystemMonitoring: undefined;
};

// ==================== 工厂管理模块导航参数 ====================

export type ManagementStackParamList = {
  ManagementHome: undefined;
  ProductTypeManagement: undefined;
  ConversionRate: undefined;
  AISettings: undefined;
  // TODO: Phase 2功能
  // SupplierManagement: undefined;
  // CustomerManagement: undefined;
  // UserManagement: undefined;
  // FactorySettings: undefined;
};

// ==================== Admin模块导航参数 ====================

export type AdminStackParamList = {
  UserManagement: undefined;
  UserDetail: { userId: string };
  CreateUser: undefined;
  EditUser: { userId: string };
  UserRoleHistory: { userId: string };

  WhitelistManagement: undefined;
  AddToWhitelist: undefined;
  WhitelistDetail: { whitelistId: string };

  PermissionManagement: undefined;
  RolePermissions: { role: string };
  PermissionSettings: undefined;
};

// ==================== 未来模块导航参数(预留) ====================

export type FarmingStackParamList = {
  FarmingDashboard: undefined;
  // ... 养殖模块页面
};

export type LogisticsStackParamList = {
  LogisticsDashboard: undefined;
  // ... 物流模块页面
};

export type TraceStackParamList = {
  TraceDashboard: undefined;
  // ... 溯源模块页面
};

// ==================== 屏幕Props类型 ====================

// Root导航屏幕Props
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// 主Tab屏幕Props
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  NativeStackScreenProps<MainTabParamList, T>;

// 生产模块屏幕Props
export type ProcessingScreenProps<T extends keyof ProcessingStackParamList> =
  NativeStackScreenProps<ProcessingStackParamList, T>;

// 打卡模块屏幕Props
export type TimeClockScreenProps<T extends keyof TimeClockStackParamList> =
  NativeStackScreenProps<TimeClockStackParamList, T>;

// 管理模块屏幕Props
export type AdminScreenProps<T extends keyof AdminStackParamList> =
  NativeStackScreenProps<AdminStackParamList, T>;

// ==================== 导航配置 ====================

/**
 * 路由配置接口
 */
export interface NavigationRoute {
  screen: string;
  params?: Record<string, any>;
}

/**
 * 模块状态
 */
export type ModuleStatus = 'available' | 'coming_soon' | 'locked';

/**
 * 模块配置
 */
export interface ModuleConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: ModuleStatus;
  progress?: number; // 开发进度百分比
  requiredPermissions: string[];
  route?: string;
  color: string;
}

/**
 * 导航守卫配置
 */
export interface NavigationGuardConfig {
  requireAuth: boolean;
  requiredPermissions?: string[];
  requiredRole?: string[];
  fallbackRoute?: string;
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
