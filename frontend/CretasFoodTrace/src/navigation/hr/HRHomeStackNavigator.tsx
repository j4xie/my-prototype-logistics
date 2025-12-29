/**
 * HR 首页 Stack 导航器
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HRHomeScreen from '../../screens/hr/home/HRHomeScreen';
import NewHiresScreen from '../../screens/hr/home/NewHiresScreen';
import LaborCostScreen from '../../screens/hr/analytics/LaborCostScreen';
import PerformanceScreen from '../../screens/hr/analytics/PerformanceScreen';
import WorkScheduleScreen from '../../screens/hr/scheduling/WorkScheduleScreen';
import BatchAssignmentScreen from '../../screens/hr/production/BatchAssignmentScreen';
import BatchWorkersScreen from '../../screens/hr/production/BatchWorkersScreen';
import StaffDetailScreen from '../../screens/hr/staff/StaffDetailScreen';
import StaffAIAnalysisScreen from '../../screens/hr/staff/StaffAIAnalysisScreen';
import AttendanceAnomalyScreen from '../../screens/hr/attendance/AttendanceAnomalyScreen';

import type { HRHomeStackParamList } from '../../types/hrNavigation';

const Stack = createNativeStackNavigator<HRHomeStackParamList>();

export default function HRHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HRHome" component={HRHomeScreen} />
      <Stack.Screen name="NewHires" component={NewHiresScreen} />
      <Stack.Screen name="LaborCost" component={LaborCostScreen} />
      <Stack.Screen name="Performance" component={PerformanceScreen} />
      <Stack.Screen name="WorkSchedule" component={WorkScheduleScreen} />
      <Stack.Screen name="BatchAssignment" component={BatchAssignmentScreen} />
      <Stack.Screen name="BatchWorkers" component={BatchWorkersScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="StaffAIAnalysis" component={StaffAIAnalysisScreen} />
      <Stack.Screen name="AttendanceAnomaly" component={AttendanceAnomalyScreen} />
    </Stack.Navigator>
  );
}
