import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ProcessingScreen } from '../screens/main/ProcessingScreen';
import { EmployeeInputScreen } from '../screens/employee/EmployeeInputScreen';
import { DeepSeekAnalysisScreen } from '../screens/analysis/DeepSeekAnalysisScreen';

export type ProcessingStackParamList = {
  ProcessingHome: undefined;
  EmployeeInput: undefined;
  DeepSeekAnalysis: undefined;
  // 未来可以添加更多处理相关的屏幕
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
    >
      <Stack.Screen name="ProcessingHome" component={ProcessingScreen} />
      <Stack.Screen name="EmployeeInput" component={EmployeeInputScreen} />
      <Stack.Screen name="DeepSeekAnalysis" component={DeepSeekAnalysisScreen} />
      {/* 其他处理相关屏幕可以在这里添加 */}
    </Stack.Navigator>
  );
};