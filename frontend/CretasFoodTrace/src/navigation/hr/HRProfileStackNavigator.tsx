/**
 * HR 个人中心 Stack 导航器
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HRProfileScreen from '../../screens/hr/profile/HRProfileScreen';
import MyInfoScreen from '../../screens/hr/profile/MyInfoScreen';
import MyAttendanceScreen from '../../screens/hr/attendance/MyAttendanceScreen';
import AttendanceStatsScreen from '../../screens/hr/attendance/AttendanceStatsScreen';
import AttendanceAnomalyScreen from '../../screens/hr/attendance/AttendanceAnomalyScreen';
import AttendanceManageScreen from '../../screens/hr/attendance/AttendanceManageScreen';
import DepartmentListScreen from '../../screens/hr/department/DepartmentListScreen';
import DepartmentAddScreen from '../../screens/hr/department/DepartmentAddScreen';
import DepartmentDetailScreen from '../../screens/hr/department/DepartmentDetailScreen';
import WhitelistListScreen from '../../screens/hr/whitelist/WhitelistListScreen';
import WhitelistAddScreen from '../../screens/hr/whitelist/WhitelistAddScreen';
import WorkScheduleScreen from '../../screens/hr/scheduling/WorkScheduleScreen';
import StaffDetailScreen from '../../screens/hr/staff/StaffDetailScreen';

// 复用现有Profile页面
import FeedbackScreen from '../../screens/profile/FeedbackScreen';
import MembershipScreen from '../../screens/profile/MembershipScreen';

import type { HRProfileStackParamList } from '../../types/hrNavigation';

const Stack = createNativeStackNavigator<HRProfileStackParamList>();

export default function HRProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HRProfile" component={HRProfileScreen} />
      <Stack.Screen name="MyInfo" component={MyInfoScreen} />
      <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} />
      <Stack.Screen name="AttendanceStats" component={AttendanceStatsScreen} />
      <Stack.Screen name="AttendanceAnomaly" component={AttendanceAnomalyScreen} />
      <Stack.Screen name="AttendanceManage" component={AttendanceManageScreen} />
      <Stack.Screen name="DepartmentList" component={DepartmentListScreen} />
      <Stack.Screen name="DepartmentAdd" component={DepartmentAddScreen} />
      <Stack.Screen name="DepartmentDetail" component={DepartmentDetailScreen} />
      <Stack.Screen name="WhitelistList" component={WhitelistListScreen} />
      <Stack.Screen name="WhitelistAdd" component={WhitelistAddScreen} />
      <Stack.Screen name="WorkSchedule" component={WorkScheduleScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
    </Stack.Navigator>
  );
}
