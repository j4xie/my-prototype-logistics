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
  EnhancedLogin: undefined;                                       // 增强登录页面
  LoginScreen: undefined;                                         // 登录屏幕（新的命名）
  RegisterScreen: undefined;                                      // 注册屏幕（新API）
  RegisterPhaseOne: undefined;                                    // 旧的注册流程（已弃用）
  RegisterPhaseTwo: { phoneNumber: string; tempToken?: string };  // 旧的注册流程（已弃用）
  ForgotPassword: undefined;                                      // Phase 3 P2: 忘记密码

  // 主应用
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ==================== 主Tab导航参数 ====================

export type MainTabParamList = {
  HomeTab: undefined;
  ProcessingTab: NavigatorScreenParams<ProcessingStackParamList>;
  AttendanceTab: NavigatorScreenParams<AttendanceStackParamList>;  // ✅ 统一命名：TimeClockTab → AttendanceTab
  AdminTab: NavigatorScreenParams<AdminStackParamList>;
  ManagementTab: NavigatorScreenParams<ManagementStackParamList>;
  PlatformTab: NavigatorScreenParams<PlatformStackParamList>;  // 平台管理
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;  // 个人中心
  ReportTab: NavigatorScreenParams<ReportStackParamList>;  // 报表中心
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
  EquipmentManagement: undefined;  // P3-设备: 设备管理（CRUD、搜索、状态）
  EquipmentDetail: { equipmentId: number };
  EquipmentAlerts: { equipmentId?: string };

  // 成本分析
  CostAnalysisDashboard: { batchId?: string };
  TimeRangeCostAnalysis: undefined;
  CostComparison: { batchIds: string[] };
  DeepSeekAnalysis: { batchId: string };

  // AI智能分析
  AIReportList: undefined;
  AIAnalysisDetail: { reportId: number; reportType: string; title: string };
  BatchComparison: undefined;
  AIConversationHistory: { sessionId?: string };

  // 数据导出 - 已移至ProfileStackParamList，避免类型冲突
  // DataExport: { reportType: 'batch' | 'cost' | 'quality' | 'equipment' };

  // 生产计划管理
  ProductionPlanManagement: undefined;

  // 原材料管理
  MaterialReceipt: undefined;
  MaterialBatchManagement: undefined;

  // Phase 3 P2: 质检统计分析
  QualityAnalytics: undefined;

  // Phase 3 P2: 库存盘点
  InventoryCheck: undefined;

  // Phase 3 P2: 异常预警
  ExceptionAlert: undefined;
};

// ==================== 考勤模块导航参数 ====================
// ✅ 统一命名：TimeClockStackParamList → AttendanceStackParamList

export type AttendanceStackParamList = {
  TimeClockScreen: undefined;
  ClockHistory: { employeeId?: string };
  TimeStatistics: { employeeId?: string; period?: 'day' | 'week' | 'month' };
  WorkRecords: { employeeId?: string };

  // Phase 3 P2: 工时查询
  AttendanceHistory: undefined;

  // ✅ 添加缺失的路由定义
  DepartmentAttendance: undefined;
};

// ==================== 平台管理模块导航参数 ====================

export type PlatformStackParamList = {
  PlatformDashboard: undefined;
  FactoryManagement: undefined;
  AIQuotaManagement: undefined;
  UserManagement: undefined;
  WhitelistManagement: undefined;
  SystemMonitoring?: undefined;      // 可选：系统监控
  PlatformReports?: undefined;       // 可选：平台报表
};

// ==================== 工厂管理模块导航参数 ====================

export type ManagementStackParamList = {
  ManagementHome: undefined;
  ProductTypeManagement: undefined;
  MaterialTypeManagement: undefined;
  ConversionRate: undefined;
  WorkTypeManagement: undefined;
  AISettings: undefined;
  DepartmentManagement: undefined;
  UserManagement: undefined;
  WhitelistManagement: undefined;
  SupplierManagement: undefined;
  CustomerManagement: undefined;
  FactorySettings: undefined;
  MaterialSpecManagement: undefined; // Phase 4: 物料规格管理（已实现但暂未启用）
};

// ==================== 个人中心模块导航参数 ====================

export type ProfileStackParamList = {
  ProfileHome: undefined;

  // Phase 3 P2: 意见反馈
  Feedback: undefined;

  // Phase 3 P2: 数据导出 (可选，也可以放在ProcessingStackParamList)
  DataExport: { reportType?: 'production' | 'cost' | 'attendance' };
};

// ==================== 报表中心模块导航参数 ====================

export type ReportStackParamList = {
  ReportDashboard: undefined;
  ProductionReport: undefined;
  QualityReport: undefined;
  CostReport: undefined;
  EfficiencyReport: undefined;
  TrendReport: undefined;
  PersonnelReport: undefined;
  KPIReport: undefined;
  ForecastReport: undefined;
  AnomalyReport: undefined;
  RealtimeReport: undefined;
  DataExport: { reportType?: 'production' | 'cost' | 'attendance' };
};

// ==================== Admin模块导航参数 ====================
// ⚠️ 注意：AdminStackParamList已定义但暂未使用
// 相关功能已集成到PlatformStackNavigator和ManagementStackNavigator中
// 保留此定义供未来扩展使用，或在确认不需要后可删除

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

// 考勤模块屏幕Props
// ✅ 统一命名：TimeClockScreenProps → AttendanceScreenProps
export type AttendanceScreenProps<T extends keyof AttendanceStackParamList> =
  NativeStackScreenProps<AttendanceStackParamList, T>;

// 管理模块屏幕Props
export type AdminScreenProps<T extends keyof AdminStackParamList> =
  NativeStackScreenProps<AdminStackParamList, T>;

// 个人中心模块屏幕Props
export type ProfileScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;

// 工厂管理模块屏幕Props
export type ManagementScreenProps<T extends keyof ManagementStackParamList> =
  NativeStackScreenProps<ManagementStackParamList, T>;

// 报表中心模块屏幕Props
export type ReportScreenProps<T extends keyof ReportStackParamList> =
  NativeStackScreenProps<ReportStackParamList, T>;

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
