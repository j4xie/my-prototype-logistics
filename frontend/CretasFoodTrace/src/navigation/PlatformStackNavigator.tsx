import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import FactoryManagementScreen from '../screens/platform/FactoryManagementScreen';
import SystemMonitoringScreen from '../screens/platform/SystemMonitoringScreen';
import PlatformReportsScreen from '../screens/platform/PlatformReportsScreen';
import { AIQuotaManagementScreen } from '../screens/platform';
import UserManagementScreen from '../screens/management/UserManagementScreen';
import WhitelistManagementScreen from '../screens/management/WhitelistManagementScreen';
import { FactorySetupScreen } from '../screens/platform/FactorySetupScreen';
import { IndustryTemplateManagementScreen } from '../screens/platform/IndustryTemplateManagementScreen';
import { IndustryTemplateEditScreen } from '../screens/platform/IndustryTemplateEditScreen';
import { BlueprintManagementScreen } from '../screens/platform/BlueprintManagementScreen';

// System Monitoring Screens
import {
  SystemMetricsScreen,
  SystemHealthScreen,
  SystemLogsScreen,
  SystemAlertsScreen,
} from '../screens/platform/system';

// Blueprint Management Screens
import {
  BlueprintListScreen,
  BlueprintDetailScreen,
  BlueprintCreateScreen,
  BlueprintEditScreen,
  BlueprintVersionsScreen,
  BlueprintBindingsScreen,
  BlueprintPreviewScreen,
  BlueprintApplyScreen,
} from '../screens/platform/blueprint';

// Supplier Management Screens
import {
  SupplierAdmissionScreen,
  SupplierBlacklistScreen,
} from '../screens/platform/supplier';

// Config Change Tracking Screens
import {
  ConfigChangesetListScreen,
  ConfigChangesetDetailScreen,
} from '../screens/platform/config';

// AI Audit and Analysis Screens
import {
  AIAuditLogsScreen,
  IntentAnalysisScreen,
  AIBusinessInitScreen,
} from '../screens/platform/ai';

// Announcement Management Screens
import {
  AnnouncementCenterScreen,
  AnnouncementCreateScreen,
} from '../screens/platform/announcement';

// Rule Engine Screens
import {
  RuleListScreen,
  RuleEditScreen,
  RuleTestScreen,
  DrlCodeEditorScreen,
  DrlPreviewScreen,
  RulePackDetailScreen,
  StateMachineListScreen,
  StateMachineDesignerScreen,
  StateMachineDetailScreen,
} from '../screens/platform/rules';

// User and Role Management Screens
import {
  UserListScreen,
  UserDetailScreen,
  UserCreateScreen,
  UserAssignFactoryScreen,
  RoleListScreen,
  RoleEditScreen,
  RolePermissionsScreen,
} from '../screens/platform/user';

// Factory Management Screens
import {
  FactoryListScreen,
  FactoryDetailScreen,
  FactoryCreateScreen,
  FactoryEditScreen,
  FactoryAIQuickScreen,
  FactoryAIWizardScreen,
  FactoryAIPreviewScreen,
  FactoryQuotaScreen,
} from '../screens/platform/factory';

// Quota Management Screens
import {
  QuotaOverviewScreen,
  QuotaRulesScreen,
  QuotaRuleEditScreen,
  QuotaUsageStatsScreen,
} from '../screens/platform/quota';

// Scale Protocol Management Screens
import { ScaleProtocolListScreen } from '../screens/platform/scale/ScaleProtocolListScreen';
import ScaleProtocolDetailScreen from '../screens/platform/scale/ScaleProtocolDetailScreen';
import ScaleBrandModelListScreen from '../screens/platform/scale/ScaleBrandModelListScreen';

// ISAPI Device Management Screens (shared from factory-admin)
import { IsapiDeviceListScreen } from '../screens/factory-admin/isapi/IsapiDeviceListScreen';
import { IsapiDeviceDetailScreen } from '../screens/factory-admin/isapi/IsapiDeviceDetailScreen';
import { IsapiDeviceCreateScreen } from '../screens/factory-admin/isapi/IsapiDeviceCreateScreen';
import { IsapiSmartConfigScreen } from '../screens/factory-admin/isapi/IsapiSmartConfigScreen';

export type PlatformStackParamList = {
  // Dashboard
  PlatformDashboard: undefined;

  // Factory Management
  FactoryManagement: undefined;
  FactorySetup: { factoryId: string; factoryName?: string };
  FactoryList: undefined;
  FactoryDetail: { factoryId: string };
  FactoryCreate: undefined;
  FactoryEdit: { factoryId: string };
  FactoryQuota: { factoryId: string };
  FactoryAIQuick: { factoryId: string };
  FactoryAIWizard: { factoryId: string };
  FactoryAIPreview: { factoryId: string; templateData?: object };

  // AI Quota Management
  AIQuotaManagement: undefined;
  QuotaOverview: undefined;
  QuotaRules: undefined;
  QuotaRuleEdit: { ruleId?: string };
  QuotaUsageStats: undefined;

  // User & Role Management
  UserManagement: undefined;
  WhitelistManagement: undefined;
  UserList: undefined;
  UserDetail: { userId: string };
  UserCreate: undefined;
  UserAssignFactory: { userId: string };
  RoleList: undefined;
  RoleEdit: { roleId?: string };
  RolePermissions: { roleId: string };

  // System Monitoring
  SystemMonitoring: undefined;
  SystemMetrics: undefined;
  SystemHealth: undefined;
  SystemLogs: undefined;
  SystemAlerts: undefined;

  // Reports
  PlatformReports: undefined;

  // Industry Template Management
  IndustryTemplateManagement: undefined;
  IndustryTemplateEdit: { templateId?: string };

  // Blueprint Management
  BlueprintManagement: { blueprintId?: string; blueprintName?: string };
  BlueprintList: undefined;
  BlueprintDetail: { blueprintId: string; blueprintName: string };
  BlueprintCreate: undefined;
  BlueprintEdit: { blueprintId: string };
  BlueprintVersions: { blueprintId: string };
  BlueprintBindings: { blueprintId: string };
  BlueprintPreview: { blueprintId: string };
  BlueprintApply: { blueprintId: string; factoryId?: string };

  // Supplier Management
  SupplierAdmission: undefined;
  SupplierBlacklist: undefined;

  // Configuration Change Tracking
  ConfigChangesetList: undefined;
  ConfigChangesetDetail: { changesetId: string };

  // Announcement Management
  AnnouncementCenter: undefined;
  AnnouncementCreate: { announcementId?: string };

  // AI Audit and Analysis
  AIAuditLogs: undefined;
  IntentAnalysis: undefined;
  AIBusinessInit: { factoryId?: string };

  // Rule Engine
  RuleList: undefined;
  RuleEdit: { ruleId?: string };
  RuleTest: { ruleId: string };
  DrlCodeEditor: { ruleId?: string };
  DrlPreview: { ruleId: string };
  RulePackDetail: { packId: string };
  StateMachineList: undefined;
  StateMachineDesigner: { machineId?: string };
  StateMachineDetail: { machineId: string };

  // Scale Protocol Management
  ScaleProtocolList: undefined;
  ScaleProtocolDetail: { protocolId: string };
  ScaleBrandModelList: undefined;

  // ISAPI Device Management (Platform Admin can manage all factories)
  IsapiDeviceList: { factoryId?: string };
  IsapiDeviceDetail: { deviceId: string; factoryId?: string };
  IsapiDeviceCreate: { factoryId?: string };
  IsapiSmartConfig: { deviceId: string; channelId?: number; factoryId?: string };
};

const Stack = createNativeStackNavigator<PlatformStackParamList>();

/**
 * 平台管理模块导航器
 * 仅平台管理员可访问
 */
export function PlatformStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PlatformDashboard"
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 平台仪表板 - 主入口页面 */}
      <Stack.Screen
        name="PlatformDashboard"
        component={PlatformDashboardScreen}
      />

      {/* 工厂管理 - 管理所有工厂 */}
      <Stack.Screen
        name="FactoryManagement"
        component={FactoryManagementScreen}
      />

      {/* 工厂模板初始化 - 选择行业模板初始化工厂 */}
      <Stack.Screen
        name="FactorySetup"
        component={FactorySetupScreen}
      />

      {/* 用户管理 - 跨工厂用户管理 */}
      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
      />

      {/* 白名单管理 - 注册白名单管理 */}
      <Stack.Screen
        name="WhitelistManagement"
        component={WhitelistManagementScreen}
      />

      {/* AI配额管理 - 管理各工厂的AI调用配额 */}
      <Stack.Screen
        name="AIQuotaManagement"
        component={AIQuotaManagementScreen}
      />

      {/* 系统监控 - 监控平台运行状态 */}
      <Stack.Screen
        name="SystemMonitoring"
        component={SystemMonitoringScreen}
      />

      {/* 平台报表 - 数据统计报表 */}
      <Stack.Screen
        name="PlatformReports"
        component={PlatformReportsScreen}
      />

      {/* 行业模板管理 - 管理所有行业模板包 */}
      <Stack.Screen
        name="IndustryTemplateManagement"
        component={IndustryTemplateManagementScreen}
      />

      {/* 行业模板编辑 - 创建/编辑模板 */}
      <Stack.Screen
        name="IndustryTemplateEdit"
        component={IndustryTemplateEditScreen}
      />

      {/* 蓝图版本管理 - 管理工厂蓝图版本 */}
      <Stack.Screen
        name="BlueprintManagement"
        component={BlueprintManagementScreen}
      />

      {/* ===== 蓝图管理 ===== */}
      <Stack.Screen name="BlueprintList" component={BlueprintListScreen} />
      <Stack.Screen name="BlueprintDetail" component={BlueprintDetailScreen} />
      <Stack.Screen name="BlueprintCreate" component={BlueprintCreateScreen} />
      <Stack.Screen name="BlueprintEdit" component={BlueprintEditScreen} />
      <Stack.Screen name="BlueprintVersions" component={BlueprintVersionsScreen} />
      <Stack.Screen name="BlueprintBindings" component={BlueprintBindingsScreen} />
      <Stack.Screen name="BlueprintPreview" component={BlueprintPreviewScreen} />
      <Stack.Screen name="BlueprintApply" component={BlueprintApplyScreen} />

      {/* ===== 系统监控 ===== */}
      <Stack.Screen name="SystemMetrics" component={SystemMetricsScreen} />
      <Stack.Screen name="SystemHealth" component={SystemHealthScreen} />
      <Stack.Screen name="SystemLogs" component={SystemLogsScreen} />
      <Stack.Screen name="SystemAlerts" component={SystemAlertsScreen} />

      {/* ===== 供应商管理 ===== */}
      <Stack.Screen name="SupplierAdmission" component={SupplierAdmissionScreen} />
      <Stack.Screen name="SupplierBlacklist" component={SupplierBlacklistScreen} />

      {/* ===== 配置变更追踪 ===== */}
      <Stack.Screen name="ConfigChangesetList" component={ConfigChangesetListScreen} />
      <Stack.Screen name="ConfigChangesetDetail" component={ConfigChangesetDetailScreen} />

      {/* ===== 公告管理 ===== */}
      <Stack.Screen name="AnnouncementCenter" component={AnnouncementCenterScreen} />
      <Stack.Screen name="AnnouncementCreate" component={AnnouncementCreateScreen} />

      {/* ===== AI审计分析 ===== */}
      <Stack.Screen name="AIAuditLogs" component={AIAuditLogsScreen} />
      <Stack.Screen name="IntentAnalysis" component={IntentAnalysisScreen} />
      <Stack.Screen name="AIBusinessInit" component={AIBusinessInitScreen} />

      {/* ===== 规则引擎 ===== */}
      <Stack.Screen name="RuleList" component={RuleListScreen} />
      <Stack.Screen name="RuleEdit" component={RuleEditScreen} />
      <Stack.Screen name="RuleTest" component={RuleTestScreen} />
      <Stack.Screen name="DrlCodeEditor" component={DrlCodeEditorScreen} />
      <Stack.Screen name="DrlPreview" component={DrlPreviewScreen} />
      <Stack.Screen name="RulePackDetail" component={RulePackDetailScreen} />
      <Stack.Screen name="StateMachineList" component={StateMachineListScreen} />
      <Stack.Screen name="StateMachineDesigner" component={StateMachineDesignerScreen} />
      <Stack.Screen name="StateMachineDetail" component={StateMachineDetailScreen} />

      {/* ===== 用户角色管理 ===== */}
      <Stack.Screen name="UserList" component={UserListScreen} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} />
      <Stack.Screen name="UserCreate" component={UserCreateScreen} />
      <Stack.Screen name="UserAssignFactory" component={UserAssignFactoryScreen} />
      <Stack.Screen name="RoleList" component={RoleListScreen} />
      <Stack.Screen name="RoleEdit" component={RoleEditScreen} />
      <Stack.Screen name="RolePermissions" component={RolePermissionsScreen} />

      {/* ===== 工厂管理扩展 ===== */}
      <Stack.Screen name="FactoryList" component={FactoryListScreen} />
      <Stack.Screen name="FactoryDetail" component={FactoryDetailScreen} />
      <Stack.Screen name="FactoryCreate" component={FactoryCreateScreen} />
      <Stack.Screen name="FactoryEdit" component={FactoryEditScreen} />
      <Stack.Screen name="FactoryQuota" component={FactoryQuotaScreen} />
      <Stack.Screen name="FactoryAIQuick" component={FactoryAIQuickScreen} />
      <Stack.Screen name="FactoryAIWizard" component={FactoryAIWizardScreen} />
      <Stack.Screen name="FactoryAIPreview" component={FactoryAIPreviewScreen} />

      {/* ===== 配额管理扩展 ===== */}
      <Stack.Screen name="QuotaOverview" component={QuotaOverviewScreen} />
      <Stack.Screen name="QuotaRules" component={QuotaRulesScreen} />
      <Stack.Screen name="QuotaRuleEdit" component={QuotaRuleEditScreen} />
      <Stack.Screen name="QuotaUsageStats" component={QuotaUsageStatsScreen} />

      {/* ===== 电子秤协议管理 ===== */}
      <Stack.Screen name="ScaleProtocolList" component={ScaleProtocolListScreen} options={{ title: '协议管理' }} />
      <Stack.Screen name="ScaleProtocolDetail" component={ScaleProtocolDetailScreen} options={{ title: '协议详情' }} />
      <Stack.Screen name="ScaleBrandModelList" component={ScaleBrandModelListScreen} options={{ title: '品牌型号' }} />

      {/* ===== ISAPI 摄像头设备管理 ===== */}
      <Stack.Screen name="IsapiDeviceList" component={IsapiDeviceListScreen} options={{ title: '摄像头管理' }} />
      <Stack.Screen name="IsapiDeviceDetail" component={IsapiDeviceDetailScreen} options={{ title: '摄像头详情' }} />
      <Stack.Screen name="IsapiDeviceCreate" component={IsapiDeviceCreateScreen} options={{ title: '添加摄像头' }} />
      <Stack.Screen name="IsapiSmartConfig" component={IsapiSmartConfigScreen} options={{ title: '智能分析配置' }} />
    </Stack.Navigator>
  );
}

export default PlatformStackNavigator;
