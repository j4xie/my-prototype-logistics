import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import FactoryManagementScreen from '../screens/platform/FactoryManagementScreen';
import { AIQuotaManagementScreen } from '../screens/platform';
import UserManagementScreen from '../screens/management/UserManagementScreen';
import WhitelistManagementScreen from '../screens/management/WhitelistManagementScreen';

export type PlatformStackParamList = {
  PlatformDashboard: undefined;
  FactoryManagement: undefined;
  AIQuotaManagement: undefined;
  UserManagement: undefined;
  WhitelistManagement: undefined;
  SystemMonitoring?: undefined;      // 暂不需要
  PlatformReports?: undefined;       // 暂不需要
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

      {/*
        暂不需要的页面:
        - SystemMonitoring (系统监控)
        - PlatformReports (平台报表)
      */}
    </Stack.Navigator>
  );
}

export default PlatformStackNavigator;
