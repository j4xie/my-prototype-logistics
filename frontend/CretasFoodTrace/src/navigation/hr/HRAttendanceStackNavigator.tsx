/**
 * HR 考勤 Stack 导航器
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AttendanceManageScreen from '../../screens/hr/attendance/AttendanceManageScreen';
import AttendanceStatsScreen from '../../screens/hr/attendance/AttendanceStatsScreen';
import AttendanceAnomalyScreen from '../../screens/hr/attendance/AttendanceAnomalyScreen';
import MyAttendanceScreen from '../../screens/hr/attendance/MyAttendanceScreen';
import StaffDetailScreen from '../../screens/hr/staff/StaffDetailScreen';

import type { HRAttendanceStackParamList } from '../../types/hrNavigation';

const Stack = createNativeStackNavigator<HRAttendanceStackParamList>();

export default function HRAttendanceStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="AttendanceManage" component={AttendanceManageScreen} />
      <Stack.Screen name="AttendanceStats" component={AttendanceStatsScreen} />
      <Stack.Screen name="AttendanceAnomaly" component={AttendanceAnomalyScreen} />
      <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
    </Stack.Navigator>
  );
}
