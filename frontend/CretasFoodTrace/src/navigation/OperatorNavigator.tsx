import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
// import { OperatorTabParamList } from '../types/navigation';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import WorkStackNavigator from './WorkStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';

const Tab = createBottomTabNavigator<any>();

/**
 * Operator专用底部Tab导航器
 * 考勤、工作、个人中心三个tab
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

      {/* 个人中心Tab - 账号信息、退出登录 */}
      <Tab.Screen
        name="OperatorProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default OperatorNavigator;
