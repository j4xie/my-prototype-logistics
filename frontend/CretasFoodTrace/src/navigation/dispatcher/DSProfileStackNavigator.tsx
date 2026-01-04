/**
 * 调度员个人中心 Stack 导航器
 *
 * 包含个人中心相关的所有页面:
 * - DSProfileScreen - 个人中心首页
 * - DSStatisticsScreen - 统计分析
 * - SchedulingSettingsScreen - 排产设置
 *
 * @version 1.2.0
 * @since 2025-12-28
 * @updated 2025-12-29 - 添加 DSStatisticsScreen
 * @updated 2026-01-03 - 添加 SchedulingSettingsScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DSProfileScreen from '../../screens/dispatcher/profile/DSProfileScreen';
import DSStatisticsScreen from '../../screens/dispatcher/profile/DSStatisticsScreen';
import SchedulingSettingsScreen from '../../screens/settings/SchedulingSettingsScreen';

// 复用现有Profile页面
import FeedbackScreen from '../../screens/profile/FeedbackScreen';
import MembershipScreen from '../../screens/profile/MembershipScreen';

type DSProfileStackParamList = {
  DSProfile: undefined;
  DSStatistics: undefined;
  SchedulingSettings: undefined;
  Feedback: undefined;
  Membership: undefined;
};

const Stack = createStackNavigator<DSProfileStackParamList>();

export function DSProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="DSProfile" component={DSProfileScreen} />
      <Stack.Screen name="DSStatistics" component={DSStatisticsScreen} />
      <Stack.Screen name="SchedulingSettings" component={SchedulingSettingsScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
    </Stack.Navigator>
  );
}

export default DSProfileStackNavigator;
