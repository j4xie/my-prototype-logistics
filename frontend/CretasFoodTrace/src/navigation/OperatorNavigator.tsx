import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
// import { OperatorTabParamList } from '../types/navigation';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import WorkStackNavigator from './WorkStackNavigator';

const Tab = createBottomTabNavigator<any>();

/**
 * Operator专用底部Tab导航器
 * 只有考勤和工作两个tab，不显示首页、生产、管理等
 */
export function OperatorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#757575',
      }}
    >
      {/* 考勤Tab - 打卡、工时查询等 */}
      <Tab.Screen
        name="OperatorAttendanceTab"
        component={AttendanceStackNavigator}
        options={{
          title: '考勤',
          tabBarIcon: ({ color, size }) => (
            <Icon source="clock-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 工作Tab - 工作类型、工作记录 */}
      <Tab.Screen
        name="OperatorWorkTab"
        component={WorkStackNavigator}
        options={{
          title: '工作',
          tabBarIcon: ({ color, size }) => (
            <Icon source="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default OperatorNavigator;
