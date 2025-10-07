import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AIQuotaManagementScreen } from '../screens/platform';

export type PlatformStackParamList = {
  AIQuotaManagement: undefined;
  // TODO: Phase 2功能 - 其他平台管理页面
  // PlatformDashboard: undefined;
  // FactoryList: undefined;
  // SystemMonitoring: undefined;
};

const Stack = createNativeStackNavigator<PlatformStackParamList>();

/**
 * 平台管理模块导航器
 * 仅平台管理员可访问
 */
export function PlatformStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* AI配额管理 - 管理各工厂的AI调用配额 */}
      <Stack.Screen
        name="AIQuotaManagement"
        component={AIQuotaManagementScreen}
      />

      {/* TODO: 添加其他平台管理页面 */}
      {/*
      <Stack.Screen
        name="PlatformDashboard"
        component={PlatformDashboardScreen}
      />
      <Stack.Screen
        name="FactoryList"
        component={FactoryListScreen}
      />
      */}
    </Stack.Navigator>
  );
}

export default PlatformStackNavigator;
