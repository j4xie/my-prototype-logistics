/**
 * 调度员人员管理 Stack 导航器
 *
 * 包含人员管理相关的所有页面:
 * - PersonnelListScreen - 人员列表
 * - PersonnelDetailScreen - 人员详情
 * - PersonnelTransferScreen - 人员调动
 * - PersonnelScheduleScreen - 排班日历
 * - PersonnelAttendanceScreen - 人员考勤
 *
 * @version 1.1.0
 * @since 2025-12-28
 * @updated 2025-12-29 - 添加 PersonnelAttendanceScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PersonnelListScreen from '../../screens/dispatcher/personnel/PersonnelListScreen';
import PersonnelDetailScreen from '../../screens/dispatcher/personnel/PersonnelDetailScreen';
import PersonnelTransferScreen from '../../screens/dispatcher/personnel/PersonnelTransferScreen';
import PersonnelScheduleScreen from '../../screens/dispatcher/personnel/PersonnelScheduleScreen';
import PersonnelAttendanceScreen from '../../screens/dispatcher/personnel/PersonnelAttendanceScreen';

type DSPersonnelStackParamList = {
  PersonnelList: undefined;
  PersonnelDetail: { employeeId: string };
  PersonnelTransfer: undefined;
  PersonnelSchedule: undefined;
  PersonnelAttendance: undefined;
};

const Stack = createStackNavigator<DSPersonnelStackParamList>();

export function DSPersonnelStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PersonnelList" component={PersonnelListScreen} />
      <Stack.Screen name="PersonnelDetail" component={PersonnelDetailScreen} />
      <Stack.Screen name="PersonnelTransfer" component={PersonnelTransferScreen} />
      <Stack.Screen name="PersonnelSchedule" component={PersonnelScheduleScreen} />
      <Stack.Screen name="PersonnelAttendance" component={PersonnelAttendanceScreen} />
    </Stack.Navigator>
  );
}

export default DSPersonnelStackNavigator;
