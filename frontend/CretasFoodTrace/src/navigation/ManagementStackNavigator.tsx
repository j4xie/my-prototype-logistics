import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ManagementStackParamList } from '../types/navigation';
import {
  ManagementScreen,
  // HRDashboardScreen and HREmployeeAIScreen moved to /screens/legacy/hr/
  // HR admin now uses HRNavigator with dedicated screens
  ProductTypeManagementScreen,
  ConversionRateScreen,
  MaterialConversionDetailScreen,
  UserManagementScreen,
  WhitelistManagementScreen,
  SupplierManagementScreen,
  SupplierAdmissionScreen,
  CustomerManagementScreen,
  MaterialTypeManagementScreen,
  WorkTypeManagementScreen,
  DepartmentManagementScreen,
  ShipmentManagementScreen,
  DisposalRecordManagementScreen,
  WorkSessionManagementScreen,
  SopConfigScreen,  // S4-2 SOP配置
} from '../screens/management';
import AISettingsScreen from '../screens/management/AISettingsScreen';
import IntentConfigScreen from '../screens/management/IntentConfigScreen';

// Phase 3 P2 - 工厂设置
import FactorySettingsScreen from '../screens/management/FactorySettingsScreen';

// Phase 4启用：规格配置管理
// import MaterialSpecManagementScreen from '../screens/management/MaterialSpecManagementScreen';

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
        name="MaterialTypeManagement"
        component={MaterialTypeManagementScreen}
        options={{ title: '原材料类型管理' }}
      />
      <Stack.Screen
        name="ConversionRate"
        component={ConversionRateScreen}
      />
      <Stack.Screen
        name="MaterialConversionDetail"
        component={MaterialConversionDetailScreen}
        options={{ title: '原料转换率详情' }}
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
        name="IntentConfig"
        component={IntentConfigScreen}
        options={{ title: 'AI意图配置' }}
      />
      <Stack.Screen
        name="DepartmentManagement"
        component={DepartmentManagementScreen}
        options={{ title: '部门管理' }}
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
        name="SupplierAdmission"
        component={SupplierAdmissionScreen}
        options={{ title: '供应商准入管理' }}
      />
      <Stack.Screen
        name="CustomerManagement"
        component={CustomerManagementScreen}
        options={{ title: '客户管理' }}
      />
      <Stack.Screen
        name="ShipmentManagement"
        component={ShipmentManagementScreen}
        options={{ title: '出货管理' }}
      />
      <Stack.Screen
        name="DisposalRecordManagement"
        component={DisposalRecordManagementScreen}
        options={{ title: '报废记录管理' }}
      />
      <Stack.Screen
        name="WorkSessionManagement"
        component={WorkSessionManagementScreen}
        options={{ title: '工作会话管理' }}
      />

      {/* Phase 3 P2 - 工厂设置 */}
      <Stack.Screen
        name="FactorySettings"
        component={FactorySettingsScreen}
        options={{ title: '工厂设置' }}
      />

      {/* S4-2 SOP配置 */}
      <Stack.Screen
        name="SopConfig"
        component={SopConfigScreen}
        options={{ title: 'SOP流程配置' }}
      />

      {/* HR管理员模块 - 已迁移到 HRNavigator
      HR admin now has dedicated navigation: HRNavigator.tsx
      HRDashboardScreen and HREmployeeAIScreen moved to /screens/legacy/hr/
      */}
      <Stack.Screen
        name="UserCreate"
        component={UserManagementScreen}
        options={{ title: '添加员工' }}
      />
      <Stack.Screen
        name="AttendanceStats"
        component={ManagementScreen}
        options={{ title: '考勤统计' }}
      />

      {/* Phase 4启用：规格配置管理
      <Stack.Screen
        name="MaterialSpecManagement"
        component={MaterialSpecManagementScreen}
        options={{ title: '规格配置管理' }}
      />
      */}
    </Stack.Navigator>
  );
}

export default ManagementStackNavigator;
