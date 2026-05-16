/**
 * Workshop Supervisor 导航器入口
 * 仅 department_admin (车间主任) 角色使用
 * 5个Tab: 首页 | 批次 | 人员 | 设备 | 我的
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkshopSupervisorTabNavigator from './WorkshopSupervisorTabNavigator';
// AI 对话 (U-NAV-1 跨角色复用 FA 端 AIChatScreen, Sprint 2 Track G Day 9)
import AIChatScreen from '../screens/factory-admin/ai-analysis/AIChatScreen';

const Stack = createNativeStackNavigator();

export function WorkshopSupervisorNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkshopSupervisorMain" component={WorkshopSupervisorTabNavigator} />
      {/* AI 对话 (U-NAV-1 Sprint 2 Track G Day 9) */}
      <Stack.Screen name="AIChat" component={AIChatScreen} options={{ headerShown: true, title: 'AI 对话' }} />
    </Stack.Navigator>
  );
}

export default WorkshopSupervisorNavigator;
