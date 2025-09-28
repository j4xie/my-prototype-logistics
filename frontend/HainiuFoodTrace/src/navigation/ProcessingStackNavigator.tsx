import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ProcessingScreen } from '../screens/main/ProcessingScreen';
import { EmployeeInputScreen } from '../screens/employee/EmployeeInputScreen';
import { ProcessingDashboardScreen } from '../screens/processing/ProcessingDashboardScreen';
import { WorkRecordScreen } from '../screens/processing/WorkRecordScreen';

export type ProcessingStackParamList = {
  ProcessingHome: undefined;
  ProcessingDashboard: undefined;
  WorkRecord: undefined;
  EmployeeInput: undefined;
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
      {/* Phase 3 功能预留 */}
      {/* <Stack.Screen name="DeepSeekAnalysis" component={DeepSeekAnalysisScreen} /> */}
    </Stack.Navigator>
  );
};