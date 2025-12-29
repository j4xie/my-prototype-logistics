/**
 * 调度员个人中心 Stack 导航器
 *
 * 包含个人中心相关的所有页面:
 * - DSProfileScreen - 个人中心首页
 * - DSStatisticsScreen - 统计分析
 *
 * @version 1.1.0
 * @since 2025-12-28
 * @updated 2025-12-29 - 添加 DSStatisticsScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DSProfileScreen from '../../screens/dispatcher/profile/DSProfileScreen';
import DSStatisticsScreen from '../../screens/dispatcher/profile/DSStatisticsScreen';

type DSProfileStackParamList = {
  DSProfile: undefined;
  DSStatistics: undefined;
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
    </Stack.Navigator>
  );
}

export default DSProfileStackNavigator;
