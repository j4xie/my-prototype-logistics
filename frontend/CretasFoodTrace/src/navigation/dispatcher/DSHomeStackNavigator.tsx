/**
 * 调度员首页 Stack 导航器
 *
 * 包含首页相关的所有页面:
 * - DSHomeScreen - 调度工作台首页
 * - WorkshopStatusScreen - 车间实时状态
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DSHomeScreen from '../../screens/dispatcher/home/DSHomeScreen';
import WorkshopStatusScreen from '../../screens/dispatcher/home/WorkshopStatusScreen';

type DSHomeStackParamList = {
  DSHome: undefined;
  WorkshopStatus: undefined;
};

const Stack = createStackNavigator<DSHomeStackParamList>();

export function DSHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="DSHome" component={DSHomeScreen} />
      <Stack.Screen name="WorkshopStatus" component={WorkshopStatusScreen} />
    </Stack.Navigator>
  );
}

export default DSHomeStackNavigator;
