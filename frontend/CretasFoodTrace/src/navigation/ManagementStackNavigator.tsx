import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ManagementScreen,
  ProductTypeManagementScreen,
  ConversionRateScreen,
  UserManagementScreen,
  WhitelistManagementScreen,
  SupplierManagementScreen,
  CustomerManagementScreen,
  MaterialTypeManagementScreen,
  WorkTypeManagementScreen,
} from '../screens/management';
import AISettingsScreen from '../screens/management/AISettingsScreen';

export type ManagementStackParamList = {
  ManagementHome: undefined;
  ProductTypeManagement: undefined;
  MaterialTypeManagement: undefined; // ✅ Phase 2新增
  ConversionRate: undefined;
  WorkTypeManagement: undefined; // ✅ Phase 2新增
  AISettings: undefined;
  UserManagement: undefined; // ✅ Phase 1
  WhitelistManagement: undefined; // ✅ Phase 1
  SupplierManagement: undefined; // ✅ Phase 2
  CustomerManagement: undefined; // ✅ Phase 2
  // ProductionPlanManagement 已移动到 Processing 模块
  // TODO: 以下页面待后续实现
  // FactorySettings: undefined;
};

const Stack = createNativeStackNavigator<ManagementStackParamList>();

/**
 * 管理模块导航器
 */
export function ManagementStackNavigator() {
  return (
    <Stack.Navigator
      id="ManagementStackNavigator"
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
        name="MaterialTypeManagement"
        component={MaterialTypeManagementScreen}
        options={{ title: '原材料类型管理' }}
      />
      <Stack.Screen
        name="ConversionRate"
        component={ConversionRateScreen}
      />
      <Stack.Screen
        name="WorkTypeManagement"
        component={WorkTypeManagementScreen}
        options={{ title: '工作类型管理' }}
      />
      <Stack.Screen
        name="AISettings"
        component={AISettingsScreen}
        options={{ title: 'AI分析设置' }}
      />
      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
        options={{ title: '用户管理' }}
      />
      <Stack.Screen
        name="WhitelistManagement"
        component={WhitelistManagementScreen}
        options={{ title: '白名单管理' }}
      />
      <Stack.Screen
        name="SupplierManagement"
        component={SupplierManagementScreen}
        options={{ title: '供应商管理' }}
      />
      <Stack.Screen
        name="CustomerManagement"
        component={CustomerManagementScreen}
        options={{ title: '客户管理' }}
      />

      {/*
        Phase 3+ 计划的页面:
        - FactorySettings (工厂设置)
        详见: docs/prd/PRD-Phase3-完善计划.md
      */}
    </Stack.Navigator>
  );
}

export default ManagementStackNavigator;
