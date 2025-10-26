import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TimeClockScreen, AttendanceStatisticsScreen } from '../screens/attendance';

export type AttendanceStackParamList = {
  TimeClock: undefined;
  AttendanceStatistics: undefined; // ✅ Phase 2新增
  // AttendanceHistory: undefined;  // 待 Phase 3 实现
};

const Stack = createNativeStackNavigator<AttendanceStackParamList>();

/**
 * 考勤模块导航器
 * Phase 2新增
 */
export function AttendanceStackNavigator() {
  return (
    <Stack.Navigator
      id="AttendanceStackNavigator"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="TimeClock"
        component={TimeClockScreen}
        options={{ title: '考勤打卡' }}
      />
      <Stack.Screen
        name="AttendanceStatistics"
        component={AttendanceStatisticsScreen}
        options={{ title: '工时统计' }}
      />

      {/*
        Phase 3+ 计划的页面:
        - AttendanceHistory (考勤历史)
        详见: docs/prd/PRD-Phase3-完善计划.md
      */}
    </Stack.Navigator>
  );
}

export default AttendanceStackNavigator;
