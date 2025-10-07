import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ManagementScreen,
  ProductTypeManagementScreen,
  ConversionRateScreen,
} from '../screens/management';
import AISettingsScreen from '../screens/management/AISettingsScreen';

export type ManagementStackParamList = {
  ManagementHome: undefined;
  ProductTypeManagement: undefined;
  ConversionRate: undefined;
  AISettings: undefined;
  // ProductionPlanManagement 已移动到 Processing 模块
  // TODO: 以下页面待Phase 2实现
  // SupplierManagement: undefined;
  // CustomerManagement: undefined;
  // UserManagement: undefined;
  // FactorySettings: undefined;
};

const Stack = createNativeStackNavigator<ManagementStackParamList>();

/**
 * 管理模块导航器
 */
export function ManagementStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="ManagementHome"
        component={ManagementScreen}
      />
      <Stack.Screen
        name="ProductTypeManagement"
        component={ProductTypeManagementScreen}
      />
      <Stack.Screen
        name="ConversionRate"
        component={ConversionRateScreen}
      />
      <Stack.Screen
        name="AISettings"
        component={AISettingsScreen}
        options={{ title: 'AI分析设置' }}
      />
      {/* ProductionPlanManagement 已移动到 Processing 模块 */}
      {/* TODO: 添加其他管理页面 */}
    </Stack.Navigator>
  );
}

export default ManagementStackNavigator;
