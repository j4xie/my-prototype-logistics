/**
 * 调度员 Tab 导航器
 *
 * 5个主要标签页:
 * - 首页 (HomeTab) - 调度工作台
 * - 计划 (PlanTab) - 生产计划管理
 * - AI调度 (AITab) - AI智能调度中心
 * - 人员 (PersonnelTab) - 人员管理
 * - 我的 (ProfileTab) - 个人中心
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DispatcherTabParamList, DISPATCHER_THEME } from '../types/dispatcher';

// Stack Navigators
import DSHomeStackNavigator from './dispatcher/DSHomeStackNavigator';
import DSPlanStackNavigator from './dispatcher/DSPlanStackNavigator';
import DSAIStackNavigator from './dispatcher/DSAIStackNavigator';
import DSPersonnelStackNavigator from './dispatcher/DSPersonnelStackNavigator';
import DSProfileStackNavigator from './dispatcher/DSProfileStackNavigator';

const Tab = createBottomTabNavigator<DispatcherTabParamList>();

export function DispatcherTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: DISPATCHER_THEME.primary,
        tabBarInactiveTintColor: DISPATCHER_THEME.textMuted,
        tabBarStyle: {
          backgroundColor: DISPATCHER_THEME.cardBackground,
          borderTopColor: DISPATCHER_THEME.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DSHomeStackNavigator}
        options={{
          tabBarLabel: '首页',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PlanTab"
        component={DSPlanStackNavigator}
        options={{
          tabBarLabel: '计划',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AITab"
        component={DSAIStackNavigator}
        options={{
          tabBarLabel: 'AI调度',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="robot" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PersonnelTab"
        component={DSPersonnelStackNavigator}
        options={{
          tabBarLabel: '人员',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={DSProfileStackNavigator}
        options={{
          tabBarLabel: '我的',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default DispatcherTabNavigator;
