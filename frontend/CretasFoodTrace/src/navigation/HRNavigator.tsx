/**
 * HR 主导航器
 *
 * 包装 Tab 导航器，处理全局路由
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HRTabNavigator from './HRTabNavigator';

// 共享屏幕
import StaffDetailScreen from '../screens/hr/staff/StaffDetailScreen';
import StaffAIAnalysisScreen from '../screens/hr/staff/StaffAIAnalysisScreen';
import StaffAddScreen from '../screens/hr/staff/StaffAddScreen';
import DepartmentDetailScreen from '../screens/hr/department/DepartmentDetailScreen';
import DepartmentAddScreen from '../screens/hr/department/DepartmentAddScreen';
import WhitelistAddScreen from '../screens/hr/whitelist/WhitelistAddScreen';
import BatchWorkersScreen from '../screens/hr/production/BatchWorkersScreen';
import AttendanceStatsScreen from '../screens/hr/attendance/AttendanceStatsScreen';
import AttendanceAnomalyScreen from '../screens/hr/attendance/AttendanceAnomalyScreen';
import MyAttendanceScreen from '../screens/hr/attendance/MyAttendanceScreen';
import MyInfoScreen from '../screens/hr/profile/MyInfoScreen';
import WorkScheduleScreen from '../screens/hr/scheduling/WorkScheduleScreen';
import LaborCostScreen from '../screens/hr/analytics/LaborCostScreen';
import PerformanceScreen from '../screens/hr/analytics/PerformanceScreen';
import BatchAssignmentScreen from '../screens/hr/production/BatchAssignmentScreen';
import NewHiresScreen from '../screens/hr/home/NewHiresScreen';

import type { HRStackParamList } from '../types/hrNavigation';

const Stack = createNativeStackNavigator<HRStackParamList>();

export default function HRNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* 主 Tab 导航 */}
      <Stack.Screen name="HRTabs" component={HRTabNavigator} />

      {/* 全局共享屏幕 - 可从任何 Tab 访问 */}
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="StaffAIAnalysis" component={StaffAIAnalysisScreen} />
      <Stack.Screen name="StaffAdd" component={StaffAddScreen} />
      <Stack.Screen name="DepartmentDetail" component={DepartmentDetailScreen} />
      <Stack.Screen name="DepartmentAdd" component={DepartmentAddScreen} />
      <Stack.Screen name="WhitelistAdd" component={WhitelistAddScreen} />
      <Stack.Screen name="BatchWorkers" component={BatchWorkersScreen} />
      <Stack.Screen name="AttendanceStats" component={AttendanceStatsScreen} />
      <Stack.Screen name="AttendanceAnomaly" component={AttendanceAnomalyScreen} />
      <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} />
      <Stack.Screen name="MyInfo" component={MyInfoScreen} />
      <Stack.Screen name="WorkSchedule" component={WorkScheduleScreen} />
      <Stack.Screen name="LaborCost" component={LaborCostScreen} />
      <Stack.Screen name="Performance" component={PerformanceScreen} />
      <Stack.Screen name="BatchAssignment" component={BatchAssignmentScreen} />
      <Stack.Screen name="NewHires" component={NewHiresScreen} />
    </Stack.Navigator>
  );
}
