import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TraceStackParamList } from '../types/navigation';

import {
  TraceabilityScreen,
  TraceabilityDetailScreen,
  PublicTraceScreen,
} from '../screens/traceability';

const Stack = createNativeStackNavigator<TraceStackParamList>();

/**
 * 溯源模块堆栈导航器
 * 包含溯源查询、详情、公开溯源等页面
 */
export function TraceStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TraceDashboard" component={TraceabilityScreen} />
      <Stack.Screen name="TraceQuery" component={TraceabilityScreen} />
      <Stack.Screen name="TraceDetail" component={TraceabilityDetailScreen} />
      <Stack.Screen name="PublicTrace" component={PublicTraceScreen} />
    </Stack.Navigator>
  );
}

export default TraceStackNavigator;
