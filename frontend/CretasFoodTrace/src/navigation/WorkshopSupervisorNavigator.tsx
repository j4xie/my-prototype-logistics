/**
 * Workshop Supervisor 导航器入口
 * 仅 department_admin (车间主任) 角色使用
 * 5个Tab: 首页 | 批次 | 人员 | 设备 | 我的
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkshopSupervisorTabNavigator from './WorkshopSupervisorTabNavigator';

const Stack = createNativeStackNavigator();

export function WorkshopSupervisorNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkshopSupervisorMain" component={WorkshopSupervisorTabNavigator} />
    </Stack.Navigator>
  );
}

export default WorkshopSupervisorNavigator;
