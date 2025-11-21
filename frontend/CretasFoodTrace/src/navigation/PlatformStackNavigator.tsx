import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import FactoryManagementScreen from '../screens/platform/FactoryManagementScreen';
import SystemMonitoringScreen from '../screens/platform/SystemMonitoringScreen';
import PlatformReportsScreen from '../screens/platform/PlatformReportsScreen';
import { AIQuotaManagementScreen } from '../screens/platform';
import UserManagementScreen from '../screens/management/UserManagementScreen';
import WhitelistManagementScreen from '../screens/management/WhitelistManagementScreen';

export type PlatformStackParamList = {
  PlatformDashboard: undefined;
  FactoryManagement: undefined;
  AIQuotaManagement: undefined;
  UserManagement: undefined;
  WhitelistManagement: undefined;
  SystemMonitoring: undefined;
  PlatformReports: undefined;
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
    </Stack.Navigator>
  );
}

export default PlatformStackNavigator;
