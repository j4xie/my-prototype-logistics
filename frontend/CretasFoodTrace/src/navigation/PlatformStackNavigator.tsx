import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AIQuotaManagementScreen } from '../screens/platform';

export type PlatformStackParamList = {
  AIQuotaManagement: undefined;
  // PlatformDashboard: undefined;      // 待 Phase 4 实现
  // FactoryList: undefined;            // 待 Phase 4 实现
  // SystemMonitoring: undefined;       // 待 Phase 4 实现
};

const Stack = createNativeStackNavigator<PlatformStackParamList>();

/**
 * 平台管理模块导航器
 * 仅平台管理员可访问
 */
export function PlatformStackNavigator() {
  return (
    <Stack.Navigator
      id="PlatformStackNavigator"
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* AI配额管理 - 管理各工厂的AI调用配额 */}
      <Stack.Screen
        name="AIQuotaManagement"
        component={AIQuotaManagementScreen}
      />

      {/*
        Phase 4+ 计划的页面:
        - PlatformDashboard (平台仪表板)
        - FactoryList (工厂列表)
        - SystemMonitoring (系统监控)
        详见: docs/prd/PRD-Phase3-完善计划.md
      */}
    </Stack.Navigator>
  );
}

export default PlatformStackNavigator;
