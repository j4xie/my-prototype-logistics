/**
 * HR 人员 Stack 导航器
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import StaffListScreen from '../../screens/hr/staff/StaffListScreen';
import StaffAddScreen from '../../screens/hr/staff/StaffAddScreen';
import StaffDetailScreen from '../../screens/hr/staff/StaffDetailScreen';
import StaffAIAnalysisScreen from '../../screens/hr/staff/StaffAIAnalysisScreen';
import BatchWorkersScreen from '../../screens/hr/production/BatchWorkersScreen';

import type { HRStaffStackParamList } from '../../types/hrNavigation';

const Stack = createNativeStackNavigator<HRStaffStackParamList>();

export default function HRStaffStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="StaffList" component={StaffListScreen} />
      <Stack.Screen name="StaffAdd" component={StaffAddScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="StaffAIAnalysis" component={StaffAIAnalysisScreen} />
      <Stack.Screen name="BatchWorkers" component={BatchWorkersScreen} />
    </Stack.Navigator>
  );
}
