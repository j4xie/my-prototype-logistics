import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ProcessingScreen } from '../screens/main/ProcessingScreen';
import { EmployeeInputScreen } from '../screens/employee/EmployeeInputScreen';
import {
  ProcessingDashboardScreen,
  MaterialReceiptScreen,
  EmployeeClockScreen,
  EquipmentUsageScreen,
  CostAnalysisDashboard,
  DataExportScreen
} from '../screens/processing';
import { WorkRecordScreen } from '../screens/processing/WorkRecordScreen';
import { WhitelistManagementScreen } from '../screens/management/WhitelistManagementScreen';

export type ProcessingStackParamList = {
  ProcessingHome: undefined;
  ProcessingDashboard: undefined;
  WorkRecord: undefined;
  EmployeeInput: undefined;
  // 成本核算系统 - Phase 2 核心功能
  MaterialReceipt: undefined;
  EmployeeClock: undefined;
  EquipmentUsage: undefined;
  CostAnalysis: undefined;
  WhitelistManagement: undefined;
  DataExport: undefined;
  // DeepSeek功能延后到Phase 3
  // DeepSeekAnalysis: undefined;
  // 待开发的高级功能（配合后端开发进度）
  QualityControl: undefined;
  EquipmentManagement: undefined;
  BatchManagement: undefined;
};

const Stack = createStackNavigator<ProcessingStackParamList>();

export const ProcessingStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="ProcessingDashboard"
    >
      <Stack.Screen name="ProcessingHome" component={ProcessingScreen} />
      <Stack.Screen name="ProcessingDashboard" component={ProcessingDashboardScreen} />
      <Stack.Screen name="WorkRecord" component={WorkRecordScreen} />
      <Stack.Screen name="EmployeeInput" component={EmployeeInputScreen} />

      {/* Phase 2 成本核算系统 */}
      <Stack.Screen
        name="MaterialReceipt"
        component={MaterialReceiptScreen}
        options={{ title: '原料接收' }}
      />
      <Stack.Screen
        name="EmployeeClock"
        component={EmployeeClockScreen}
        options={{ title: '员工打卡' }}
      />
      <Stack.Screen
        name="EquipmentUsage"
        component={EquipmentUsageScreen}
        options={{ title: '设备使用' }}
      />
      <Stack.Screen
        name="CostAnalysis"
        component={CostAnalysisDashboard}
        options={{ title: '成本分析' }}
      />
      <Stack.Screen
        name="DataExport"
        component={DataExportScreen}
      <Stack.Screen
        name="WhitelistManagement"
        component={WhitelistManagementScreen}
        options={{ title: 'u767du540du5355u7ba1u7406' }}
      />
        options={{ title: '数据导出' }}
      />

      {/* Phase 3 功能预留 */}
      {/* <Stack.Screen name="DeepSeekAnalysis" component={DeepSeekAnalysisScreen} /> */}
    </Stack.Navigator>
  );
};