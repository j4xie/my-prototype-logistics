import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogisticsStackParamList } from '../types/navigation';
import LogisticsDashboardScreen from '../screens/logistics/LogisticsDashboardScreen';
import ShipmentManagementScreen from '../screens/management/ShipmentManagementScreen';

const Stack = createNativeStackNavigator<LogisticsStackParamList>();

/**
 * 物流模块堆栈导航器
 * 包含物流仪表板、出货列表等物流相关页面
 */
export function LogisticsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 物流仪表板 - 入口页 */}
      <Stack.Screen
        name="LogisticsDashboard"
        component={LogisticsDashboardScreen}
      />

      {/* 出货列表 */}
      <Stack.Screen
        name="ShipmentList"
        component={ShipmentManagementScreen}
      />
    </Stack.Navigator>
  );
}

export default LogisticsStackNavigator;
